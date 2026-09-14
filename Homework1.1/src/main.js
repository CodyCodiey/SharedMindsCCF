// Wiring. Nothing decides anything here — it only connects the sources to the
// one words(list, time) call, runs the frame, and keeps the panel in step.

import { CFG } from './config.js?v=a6732beb';
import { Pool } from './pool.js?v=a6732beb';
import { Renderer } from './render.js?v=a6732beb';
import { Typing, Mic, Transcript } from './input.js?v=a6732beb';
import { buildPanel, exportConfig } from './panel.js?v=a6732beb';
import { demoWords } from './demo.js?v=a6732beb';
import { state as inkState } from './ink.js?v=a6732beb';

const $ = (id) => document.getElementById(id);

// §10 — an error that only reaches the console looks exactly like a blank
// page. Put it where it can be read.
// Errors get their own line. They used to be written into #stat, which the
// frame loop overwrites with counters four times a second — so the message the
// comment below promised was readable had always gone by the time you looked.
const shout = (msg) => { const el = $('err'); el.textContent = String(msg); el.hidden = false; };
addEventListener('error', (e) => shout('error: ' + e.message));
addEventListener('unhandledrejection', (e) => shout('error: ' + e.reason));

const pool = new Pool();
const view = new Renderer($('pool'));

// The one way in. Every source ends up here and none of them are told apart.
const say = (list, time) => pool.words(list, time);

const typing = new Typing($('type'), say);
const mic = new Mic(say, (s) => {
  $('micstate').textContent = s;
  // The button shows INTENT, not the recogniser's moment-to-moment state. The
  // API stops and restarts itself constantly on silence; the light should stay
  // on for as long as you asked it to listen.
  const b = $('micbtn');
  const fatal = /^(unsupported|needs)/.test(s) || /^error/.test(s);
  b.classList.toggle('on', mic.want && !fatal);
  b.classList.toggle('bad', fatal);
  b.title = fatal ? s : mic.want ? 'listening — click to stop' : 'listen';
});
const tape = new Transcript(say, (s) => {
  $('tstate').textContent = s;
  if (s !== 'done') return;
  // a looping talk starts over, hearing itself fresh
  if (looping) { pool.reset(); tape.play(); if (tape.playing) useSource(tape); return; }
  // otherwise hand the clock back rather than leaving it stopped
  useSource(typing);
  $('play').textContent = 'play';
});

// Which clock the segmenter runs on. A transcript brings its own, and the two
// share no timeline at all — so switching between them closes whatever was
// mid-sentence rather than welding two unrelated thoughts together.
let source = typing;
function useSource(next) {
  if (next === source) return;
  if (next !== tape && flooding) { flooding = false; tape.rate = wantedRate; }
  pool.cut();
  source = next;
}

/* ---------------------------------------------------------------- speaking */

function toggleMic() {
  if (mic.want) { mic.stop(); useSource(typing); }
  else { mic.start(); useSource(mic); }
}
$('mic').addEventListener('click', toggleMic);
$('micbtn').addEventListener('click', toggleMic);

// A talk that is already word-timed and worth watching the piece think about.
// Saved to disk as well, so the piece needs no server of its own to play it —
// the captions are the only thing yt-dlp was ever needed for.
const BRAINRETCH = 'https://www.youtube.com/watch?v=zj8c-V7EfOE&t=1s';
// Resolved against THIS MODULE, not against the page. A bare relative path is
// resolved against the document's base URL, so it only found the file while the
// page sat at the site root — anywhere else it 404'd, and the silent fallback
// below turned that into an invisible trip to the caption API.
const BRAINRETCH_FILE = new URL('../transcripts/brainretch-2026.json', import.meta.url).href;
// A short written passage, timed as breath rather than speech — what the embed
// loops. The talk is ninety-four minutes; this is the paragraph beside it.
const PASSAGE_FILE = new URL('../transcripts/passage.json', import.meta.url).href;

/** The saved form keeps two parallel arrays rather than 14,605 little objects. */
async function loadFile(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
  const d = await res.json();
  if (Array.isArray(d.words)) return d.words;
  return d.w.map((w, i) => ({ w, t: d.t[i] }));
}

async function loadCaptions(url, play, file) {
  if (!url && !file) { $('tstate').textContent = 'paste a url'; return; }
  $('tstate').textContent = 'loading…';
  try {
    let words;
    if (file) {
      // A saved transcript is the whole point: no server, no yt-dlp, no wait.
      // If it will not load, say so — do not quietly reach for the network
      // instead, which is the one thing this is here to avoid.
      words = await loadFile(file);
    } else {
      // only an arbitrary URL needs the caption service, and only in dev
      const res = await fetch('api/captions?url=' + encodeURIComponent(url));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      words = data.words;
    }
    tape.load(words);
    if (play) { tape.play(); if (tape.playing) { useSource(tape); $('play').textContent = 'pause'; } }
  } catch (err) {
    // §9/§10 — surfaced, not swallowed
    $('tstate').textContent = 'failed: ' + err.message;
  }
}

$('demo').addEventListener('click', () => runDemo());

/** The built-in stream of consciousness — no server, no network. */
function runDemo() {
  tape.load(demoWords());
  tape.play();
  if (tape.playing) { useSource(tape); $('play').textContent = 'pause'; }
}

$('fetch').addEventListener('click', () => loadCaptions($('url').value.trim(), false));
$('brainretch').addEventListener('click', () => loadCaptions(BRAINRETCH, true, BRAINRETCH_FILE));
$('burst').addEventListener('click', () => burst(BRAINRETCH, BRAINRETCH_FILE));

const rate = $('rate'), rateval = $('rateval');

/** How many transcript-milliseconds pass per animation millisecond. */
function setRate(v) {
  if (!isFinite(v) || v <= 0) { rateval.value = String(tape.rate); return; }
  // the clock advances by frame deltas, so a rate change simply takes effect on
  // the next frame — there is nothing to rebase
  tape.rate = v;
  wantedRate = v;
  rate.value = v;
  rateval.value = String(v);
}
rate.addEventListener('input', () => setRate(Number(rate.value)));
rateval.addEventListener('change', () => setRate(Number(rateval.value)));

$('play').addEventListener('click', () => {
  // A flood and a silent load both read as "playing" from the button, though
  // only one of them is running the tape — so stop either one first.
  if (flooding || soaking) {
    flooding = false;
    soaking = false;
    tape.playing = false;
    tape.rate = wantedRate;
    useSource(typing);
    $('play').textContent = 'play';
    $('tstate').textContent = `stopped · ${pool.stream.length.toLocaleString()} words in`;
    return;
  }
  if (tape.playing) {
    tape.pause();
    useSource(typing);
    $('play').textContent = 'play';
    return;
  }
  // play() bails out when nothing is loaded; taking the source anyway froze the
  // segmenter's clock at 0 and no thought could ever end on silence again
  tape.play();
  if (tape.playing) { useSource(tape); $('play').textContent = 'pause'; }
});

// Wind the whole talk into the pool at once — the flood is the point — but
// only ever as fast as the frame can carry it. Rings accumulate faster than
// they drain, so the cost of a frame rises with the flood; the tape's rate
// eases up while frames are cheap and backs off the moment they are not, and
// finds its own level. Nothing is skipped and nothing is hidden: every thought
// still breaks where the speaker paused, and you watch the pool fill.
const FLOOD_CEILING = 200;   // never wind the tape faster than this
const FRAME_BUDGET = 15;     // ms — one frame at 60fps, near enough
const FLOOD_RINGS = 300;     // as much of the talk as a frame can carry
const SOAK_CHUNK = 3000;     // words absorbed per frame once the pool is full
let flooding = false;
let soaking = false;
let floodRate = 6;
let wantedRate = 1;

async function burst(url, file) {
  await loadCaptions(url, false, file);
  if (!tape.words.length) return;
  wantedRate = Number(rate.value) || 1;
  floodRate = 6;
  tape.rate = floodRate;
  tape.play();
  if (!tape.playing) return;
  flooding = true;
  useSource(tape);
  $('play').textContent = 'pause';
}

/** Called at the end of every frame while the pool is filling. */
function paceFlood(cost) {
  if (!flooding) return;
  if (!tape.playing) {           // the talk ran out
    flooding = false;
    tape.rate = wantedRate;
    return;
  }
  // Once the pool holds as much as a frame can draw, stop filling it and take
  // the rest of the talk in silently: the whole thing is still remembered, and
  // waiting for it to arrive ring by ring would take the length of the talk.
  if (pool.writings.length >= FLOOD_RINGS) { soakTheRest(); return; }

  floodRate = cost > FRAME_BUDGET
    ? Math.max(1, floodRate * 0.88)
    : Math.min(FLOOD_CEILING, floodRate * 1.04);
  tape.rate = floodRate;
  const last = tape.words[tape.words.length - 1];
  if (!last) return;
  $('tstate').textContent =
    `flooding ${((100 * tape.now()) / last.t).toFixed(0)}% · x${floodRate.toFixed(0)} · ${pool.writings.length} rings`;
}

/** Take the remainder of the tape into memory without drawing any of it. */
function soakTheRest() {
  flooding = false;
  soaking = true;
  tape.playing = false;
  tape.rate = wantedRate;
  const total = tape.words.length;
  const swallow = () => {
    if (!soaking) return;          // pause stopped it
    pool.silent = true;
    const until = Math.min(total, tape.at + SOAK_CHUNK);
    for (; tape.at < until; tape.at++) pool.words([tape.words[tape.at].w], tape.words[tape.at].t);
    pool.silent = false;
    if (tape.at < total) {
      $('tstate').textContent = `remembering ${((100 * tape.at) / total).toFixed(0)}%`;
      requestAnimationFrame(swallow);
      return;
    }
    soaking = false;
    useSource(typing);
    $('play').textContent = 'play';
    $('tstate').textContent =
      `${pool.stream.length.toLocaleString()} words in · ${pool.sealed} thoughts · ${pool.index.size.toLocaleString()} remembered — talk to it`;
  };
  swallow();
}

/* ------------------------------------------------------------------- panel */

buildPanel($('sliders'));
$('export').addEventListener('click', () => {
  const text = exportConfig();
  $('out').value = text;
  $('out').select();
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
});
$('clear').addEventListener('click', () => pool.clear());
// The panel has no button. It starts closed and esc is the only way to it, so
// what a visitor gets is the piece and nothing else — no chrome to click, and
// nothing to fiddle with by accident on a phone, where it covered the screen.
const togglePanel = () => $('panel').classList.toggle('hidden');

// Escape works from anywhere, including mid-sentence in the box — nothing else
// here wants that key.
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  togglePanel();
});

/* -------------------------------------------------------------------- loop */

let logged = 0;
function drawLog() {
  // pool.log keeps only the last 60, so its LENGTH stops changing after 60
  // thoughts and the panel used to freeze there for the rest of the session.
  if (pool.sealed === logged) return;
  logged = pool.sealed;
  const box = $('log');
  box.textContent = '';
  for (const e of pool.log.slice(-24).reverse()) {
    const d = document.createElement('div');
    d.innerHTML = `<b>${e.why} ·${e.charge}</b> ${esc(e.text)}`;
    box.appendChild(d);
  }
}
const esc = (s) => s.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));

let last = 0, frames = 0;
const diag = new URLSearchParams(location.search).has('diag');
function step(now) {
  frames++;
  const began = performance.now();
  // size first: a droplet created by tape.tick() below has to land in the pool
  // as it actually is, not in the 800x600 one the Pool starts life with
  pool.size(view.w, view.h);
  pool.update(now);          // sets the pool's clock, then ages the water
  tape.tick(now);            // any words this brings in are stamped with it
  pool.tick(source.now());
  view.frame(pool, now);
  paceFlood(performance.now() - began);

  if (diag) view.note(diagLines(now));
  if (now - last > 250) {
    last = now;
    $('stat').textContent = view.error
      ? 'stopped'
      : `${pool.writings.length}w ${pool.ripples.length}r ${view.strokes}s`;
    drawLog();
  }
}

// One monotonic clock, advanced by frame deltas rather than trusted from the
// frame's own timestamp. A timestamp that jumps — a slow load, a backgrounded
// tab, a headless browser, anything else stepping the piece — would otherwise
// age every droplet at once, or age it backwards.
let clock = 0, lastFrame = null;
function frame(now) {
  requestAnimationFrame(frame);
  if (lastFrame === null) lastFrame = now;
  clock += Math.min(100, Math.max(0, now - lastFrame));
  lastFrame = now;
  step(clock);
}

/** Run the piece forward by hand, in fixed steps, on the same clock. */
function advance(ms, dt = 16) {
  for (let t = 0; t < ms; t += dt) { clock += dt; step(clock); }
}

addEventListener('resize', () => view.resize());
view.resize();
pool.size(view.w, view.h);
requestAnimationFrame(frame);

// ?loop repeats the written passage; ?loop=talk repeats the whole rant;
// ?demo plays the built-in stream;
// ?rate=8 hurries either; ?tune opens the panel
// (esc does too — it is hidden by default and has no button).
const q = new URLSearchParams(location.search);
if (q.has('rate')) setRate(Number(q.get('rate')) || 1);
if (q.has('tune')) $('panel').classList.remove('hidden');
if (q.has('loop')) startLoop(q.get('loop'));
else if (q.has('demo')) runDemo();
else $('type').focus();

// ?preroll=20000 runs 20s of the piece at a fixed step before handing over to
// the animation frame. Headless browsers grant very few real frames, so this is
// how a screenshot can be taken of a moment well into the piece.
if (q.has('preroll')) advance(Number(q.get('preroll')) || 0, Number(q.get('dt')) || 16);

/* -------------------------------------------------------------------- loop */

// ?loop plays the talk itself, end to end, over and over — and gets out of the
// way the moment anyone touches it. The point of the embed is the rant, not a
// demo of one; but a visitor who starts typing should not be talked over.
const LOOP_IDLE = 60000;   // how long after the last touch before it resumes
let looping = false;
let idleTimer = null;

async function startLoop(which) {
  const file = which === 'talk' ? BRAINRETCH_FILE : PASSAGE_FILE;
  await loadCaptions(BRAINRETCH, false, file);
  if (!tape.words.length) return;
  looping = true;
  tape.play();
  if (tape.playing) useSource(tape);
}

/** Someone is using it. Stand down, and wait a minute after they stop. */
function nudge() {
  if (!looping) return;
  if (tape.playing) { tape.pause(); useSource(typing); }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!looping || tape.playing) return;
    tape.play();
    if (tape.playing) useSource(tape);
  }, LOOP_IDLE);
}

for (const [el, ev] of [
  [$('type'), 'input'], [$('type'), 'focus'], [$('type'), 'keydown'],
  [$('micbtn'), 'click'], [$('pool'), 'pointerdown'],
]) el.addEventListener(ev, nudge, { passive: true });

// ?diag draws the frame's internals onto the same frame they describe, so a
// screenshot cannot disagree with them. §10: measure internals, not pixels.
function diagLines(now) {
  const bits = [`t=${now.toFixed(0)} frames=${frames} src=${source.now().toFixed(0)} clock=${pool.clock.toFixed(0)} w=${pool.writings.length} r=${pool.ripples.length} said=${pool.stream.length}`];
  for (const w of pool.writings.slice(0, 6)) {
    const { R, em, carried } = inkState(w, now);
    let present = 0, formed = 0;
    for (const L of w.layout.letters) {
      const b = w.wordBorn[L.wordIndex];
      if (b === undefined) continue;
      const stag = L.wordLen > 1 ? L.inWord / (L.wordLen - 1) : 0;
      const p = (now - b - CFG.coilStagger * CFG.formMs * stag) / CFG.formMs;
      if (p >= 0) present++;
      if (p >= 1) formed++;
    }
    bits.push(`${w.kind[0]} age=${(now - w.born).toFixed(0)} R=${R.toFixed(0)} em=${em.toFixed(0)} carried=${carried.toFixed(1)}/${w.layout.width.toFixed(1)} formed ${formed}/${present} of ${w.layout.letters.length}  "${w.text.slice(0, 40)}"`);
  }
  return bits;
}

// handy while tuning
window.droplet = { pool, view, CFG, say, tape, mic, advance };
