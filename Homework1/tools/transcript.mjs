import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
export const STORE = join(HERE, '..', 'transcripts');

/**
 * Pull a video's caption track with yt-dlp and turn it into word-level
 * timings. This reads what was said, not what was shown — there is no video
 * understanding here, only the transcript.
 */
export async function fetchTranscript(url) {
  // Serve a transcript already on disk rather than asking YouTube again —
  // repeated requests are what gets this machine rate-limited.
  const known = videoId(url);
  if (known) {
    try {
      return JSON.parse(await readFile(join(STORE, `${known}.json`), 'utf8'));
    } catch { /* not cached yet */ }
  }

  const dir = await mkdtemp(join(tmpdir(), 'soc-'));
  try {
    const { stdout } = await run('yt-dlp', [
      '--skip-download',
      '--write-auto-subs', '--write-subs',
      // Ask only for real English tracks. A glob like "en.*" also matches
      // machine-translated ones (en-de, en-fr, …), which multiplies requests
      // and gets the whole call rate-limited.
      '--sub-langs', 'en-orig,en,en-US,en-GB',
      '--retries', '5', '--sleep-requests', '1',
      '--sub-format', 'vtt',
      '--print-json', '--no-warnings',
      '-o', join(dir, 'cap.%(ext)s'),
      url,
    ], { maxBuffer: 32 * 1024 * 1024 });

    const meta = JSON.parse(stdout.trim().split('\n').pop());
    const files = (await readdir(dir)).filter((f) => f.endsWith('.vtt'));
    if (!files.length) {
      throw new Error('no captions available for this video');
    }

    const vtt = await readFile(join(dir, files[0]), 'utf8');
    const words = parseVtt(vtt);
    if (!words.length) throw new Error('caption track was empty');

    const record = {
      id: meta.id,
      title: meta.title || meta.id,
      url: meta.webpage_url || url,
      duration: meta.duration || (words[words.length - 1].t + 2),
      wordCount: words.length,
      words,
    };

    await mkdir(STORE, { recursive: true });
    await writeFile(join(STORE, `${record.id}.json`), JSON.stringify(record));
    await writeIndex();
    return record;
  } catch (err) {
    throw new Error(explain(err.message));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The video id out of any of YouTube's url shapes. */
function videoId(url) {
  const m =
    /[?&]v=([\w-]{6,})/.exec(url) ||
    /youtu\.be\/([\w-]{6,})/.exec(url) ||
    /\/(?:shorts|live|embed)\/([\w-]{6,})/.exec(url);
  return m ? m[1] : null;
}

/** yt-dlp failures are long and shell-shaped; say what actually happened. */
function explain(message) {
  if (/429|Too Many Requests/.test(message)) {
    return 'YouTube is rate-limiting this machine — wait a few minutes';
  }
  if (/Sign in to confirm|bot/i.test(message)) {
    return 'YouTube wants a sign-in for this video';
  }
  if (/no captions available|caption track was empty/.test(message)) {
    return 'that video has no caption track';
  }
  if (/Private video|unavailable|Video unavailable/i.test(message)) {
    return 'that video is private or unavailable';
  }
  if (/ERROR:\s*(.+)/.test(message)) {
    return RegExp.$1.slice(0, 80);
  }
  return message.slice(0, 80);
}

const ENTITY = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** Caption files are XML-escaped; ">>" is a speaker change, not a word. */
function cleanText(text) {
  return text
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITY[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/>>+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');   // [Music], [Applause], …
}

const CUE = /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/;
const INLINE = /<(\d{2}:\d{2}:\d{2}\.\d{3})>/;

function seconds(stamp) {
  const [h, m, s] = stamp.split(':');
  return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
}

/**
 * YouTube auto-captions are a rolling window: every cue repeats the tail of
 * the one before it, and carries inline per-word timestamps. Keeping only
 * words whose timestamp is later than everything emitted so far both dedupes
 * the roll and preserves real speech timing — which is what drives the pause
 * detection downstream.
 */
export function parseVtt(vtt) {
  const words = [];
  let last = -1;
  const lines = vtt.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const cue = CUE.exec(lines[i]);
    if (!cue) continue;
    const start = seconds(cue[1]);

    const body = [];
    for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
      body.push(lines[j]);
    }
    const text = body.join(' ');
    if (!text.trim()) continue;

    // split() with a capture group alternates: text, stamp, text, stamp…
    const parts = text.split(/<(\d{2}:\d{2}:\d{2}\.\d{3})>/);
    let t = start;
    let leading = true;

    for (const part of parts) {
      if (INLINE.test(`<${part}>`)) {
        t = seconds(part);
        leading = false;
        continue;
      }
      const clean = cleanText(
        part.replace(/<\/?c[^>]*>/g, '').replace(/<[^>]*>/g, '')
      );
      let run = clean.trim().split(/\s+/).filter(Boolean);
      if (!run.length) continue;

      if (leading) {
        // The head of a rolling cue repeats the tail of the one before it.
        // Timestamps cannot catch this (the repeat carries the new cue's
        // start), so drop the overlap by matching the words themselves.
        run = dropOverlap(run, words);
        if (!run.length) continue;
      } else if (t <= last) {
        continue;   // a stamped repeat of something already said
      }

      run.forEach((w) => {
        words.push({ w, t: Number(t.toFixed(2)) });
      });
      last = t;
    }
  }
  return words;
}

/** Trim the longest run of words that the transcript has just emitted. */
function dropOverlap(run, emitted) {
  const max = Math.min(run.length, emitted.length, 40);
  for (let k = max; k > 0; k--) {
    let match = true;
    for (let i = 0; i < k; i++) {
      if (emitted[emitted.length - k + i].w !== run[i]) { match = false; break; }
    }
    if (match) return run.slice(k);
  }
  return run;
}

export async function writeIndex() {
  await mkdir(STORE, { recursive: true });
  const files = (await readdir(STORE)).filter(
    (f) => f.endsWith('.json') && f !== 'index.json'
  );
  const entries = [];
  for (const file of files) {
    const rec = JSON.parse(await readFile(join(STORE, file), 'utf8'));
    entries.push({
      id: rec.id, title: rec.title, url: rec.url,
      duration: rec.duration, wordCount: rec.wordCount,
    });
  }
  entries.sort((a, b) => a.title.localeCompare(b.title));
  await writeFile(join(STORE, 'index.json'), JSON.stringify(entries, null, 2));
  return entries;
}

// CLI: node tools/transcript.mjs <youtube-url>
if (process.argv[1] && process.argv[1].endsWith('transcript.mjs')) {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: node tools/transcript.mjs <youtube-url>');
    process.exit(1);
  }
  fetchTranscript(url).then(
    (r) => console.log(`saved "${r.title}" — ${r.wordCount} words, ${Math.round(r.duration)}s`),
    (e) => { console.error(`failed: ${e.message}`); process.exit(1); }
  );
}
