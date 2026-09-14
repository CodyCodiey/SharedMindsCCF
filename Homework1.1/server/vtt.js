// VTT -> word-level timings on the transcript's own clock, in milliseconds.
//
// Kept separate from the server so it can be run and tested without opening a
// port. §9's whole point is that playback runs on this clock, not wall time.

const stamp = (s) => {
  const m = /^(?:(\d+):)?(\d+):(\d+)[.,](\d+)$/.exec(String(s).trim());
  if (!m) return null;
  return ((+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + Number(String(m[4]).padEnd(3, '0'));
};

const clean = (s) => s.replace(/<\/?c[^>]*>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"');

/**
 * YouTube's auto-captions roll: each cue repeats the tail of the one before,
 * and only the genuinely new words carry an inline <00:00:01.234> timestamp.
 * So when a file uses inline timestamps we keep only the stamped words, which
 * drops the repeats without having to guess at them. Hand-made tracks have no
 * inline stamps at all, and there the words are spread across the cue.
 */
export function parseVTT(text) {
  const blocks = String(text).replace(/\r/g, '').split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const start = stamp(a);
    const end = stamp((b || '').trim().split(/\s+/)[0] || '');
    if (start === null) continue;
    cues.push({ start, end: end === null ? start + 2000 : end, body: lines.slice(i + 1).join(' ') });
  }

  const inline = cues.some((c) => /<\d+:\d+:\d+[.,]\d+>/.test(c.body));
  const out = [];
  const seen = new Set();
  const add = (w, t) => {
    const key = Math.round(t / 10) + '|' + w;
    if (seen.has(key)) return false;
    seen.add(key);
    out.push({ w, t });
    return true;
  };

  // What has been emitted so far, so a cue's rolling head can be recognised as
  // a repeat of it rather than guessed at by position.
  const emitted = [];
  const push = (w, t) => { if (add(w, t)) emitted.push(w); };

  // How much of `head` is already the tail of what we have emitted.
  const overlap = (head) => {
    for (let k = Math.min(head.length, emitted.length); k > 0; k--) {
      let same = true;
      for (let i = 0; i < k; i++) {
        if (emitted[emitted.length - k + i].toLowerCase() !== head[i].toLowerCase()) { same = false; break; }
      }
      if (same) return k;
    }
    return 0;
  };

  const spread = (words, from, to) => {
    const span = Math.max(0, to - from);
    words.forEach((w, k) => push(w, from + (words.length > 1 ? (span * k) / words.length : 0)));
  };

  for (const cue of cues) {
    if (inline) {
      const parts = cue.body.split(/<(\d+:\d+:\d+[.,]\d+)>/);
      const stamps = [];
      for (let i = 1; i < parts.length; i += 2) stamps.push(stamp(parts[i]));

      // the head: text before the first inline stamp. Part of it repeats the
      // previous cue; whatever is left over is genuinely new and lands at the
      // cue start.
      const head = clean(parts[0]).split(/\s+/).filter(Boolean);
      if (head.length) {
        const k = overlap(head);
        const fresh = head.slice(k);
        if (fresh.length) spread(fresh, cue.start, stamps.length && stamps[0] !== null ? stamps[0] : cue.end);
      }

      let at = cue.start;
      for (let i = 1; i < parts.length; i += 2) {
        const t = stamp(parts[i]);
        if (t !== null) at = t;
        const words = clean(parts[i + 1] || '').split(/\s+/).filter(Boolean);
        if (!words.length) continue;
        const nxt = parts[i + 2] ? stamp(parts[i + 2]) : cue.end;
        spread(words, at, nxt === null ? cue.end : nxt);
      }
    } else {
      const words = clean(cue.body).split(/\s+/).filter(Boolean);
      const k = overlap(words);
      spread(words.slice(k), cue.start, cue.end);
    }
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}
