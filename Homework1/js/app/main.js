import { VERSIONS } from '../versions/index.js';
import { createSpeech } from './speech.js';
import { createReplay } from './replay.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const recordButton = document.getElementById('record');
const fallback = document.getElementById('fallback');
const statusEl = document.getElementById('status');
const sourceEl = document.getElementById('source');
const videoInput = document.getElementById('video');
const speedButton = document.getElementById('speed');
const playButton = document.getElementById('playpause');
const progressBar = document.querySelector('#progress span');
const picker = document.getElementById('version');
const tuneButton = document.getElementById('tune');
const panel = document.getElementById('panel');
const knobs = document.getElementById('knobs');
const resetButton = document.getElementById('reset');
const exportButton = document.getElementById('export');
const exported = document.getElementById('exported');
const exportText = document.getElementById('exportText');
const exportNote = document.getElementById('exportNote');
const blurbEl = document.getElementById('blurb');

const SPEEDS = [1, 4, 12, 40];
let current = null;
let ghost = '';

/* ---- versions ---- */

for (const version of VERSIONS) {
  const option = document.createElement('option');
  option.value = version.meta.id;
  option.textContent = version.meta.title;
  picker.append(option);
}

let defaults = null;

/**
 * The panel, in sections. Only one section is open at a time, so there is
 * never more on screen than can be taken in at once.
 */
function buildPanel(version) {
  knobs.textContent = '';
  exported.hidden = true;
  const specs = version.CONTROLS;
  if (!specs || !current.config) {
    const none = document.createElement('p');
    none.className = 'none';
    none.textContent = 'This one has no controls yet.';
    knobs.append(none);
    defaults = null;
    return;
  }
  defaults = { ...current.config };

  const groups = new Map();
  for (const spec of specs) {
    const name = spec.group || 'Everything else';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(spec);
  }

  const sections = [];
  const openOnly = (which) => {
    sections.forEach((s, i) => {
      s.body.hidden = i !== which;
      s.head.className = i === which ? 'section open' : 'section';
    });
  };

  [...groups.entries()].forEach(([name, members], index) => {
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'section';
    head.textContent = name;
    head.addEventListener('click', () => openOnly(index));

    const body = document.createElement('div');
    body.className = 'section-body';
    for (const spec of members) body.append(knobFor(spec));

    knobs.append(head, body);
    sections.push({ head, body });
  });
  openOnly(0);
}

/** One labelled slider, wired to the running piece. */
function knobFor(spec) {
  const wrap = document.createElement('div');
  wrap.className = 'knob';
  const label = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = spec.label;
  const value = document.createElement('b');

  if (spec.type === 'choice') {
    const select = document.createElement('select');
    select.className = 'choice';
    for (const option of spec.options) {
      const item = document.createElement('option');
      item.value = option;
      item.textContent = option;
      select.append(item);
    }
    select.value = current.config[spec.key];
    select.addEventListener('change', () => current.set(spec.key, select.value));
    label.append(name);
    wrap.append(label, select);
    spec.input = select;
    return wrap;
  }

  const input = document.createElement('input');
  input.type = 'range';
  input.min = spec.min;
  input.max = spec.max;
  input.step = spec.step;
  input.value = current.config[spec.key];
  const show = () => { value.textContent = Number(input.value).toString(); };
  show();
  input.addEventListener('input', () => {
    current.set(spec.key, Number(input.value));
    show();
  });
  label.append(name, value);
  wrap.append(label, input);
  spec.input = input;
  return wrap;
}

resetButton.addEventListener('click', () => {
  if (!defaults || !current.config) return;
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value === 'number' || typeof value === 'string') current.set(key, value);
  }
  buildPanel(VERSIONS.find((v) => v.meta.id === picker.value));
  exported.hidden = true;
});

tuneButton.addEventListener('click', () => { panel.hidden = !panel.hidden; });

function load(id) {
  const version = VERSIONS.find((v) => v.meta.id === id) || VERSIONS[VERSIONS.length - 1];
  current = version.create();
  ghost = '';

  blurbEl.textContent = version.meta.blurb;
  picker.value = version.meta.id;
  current.resize(ctx, window.innerWidth, window.innerHeight);
  // Switching starts the piece over, so a demo always begins from nothing.
  replay.stop();
  speech.stop();
  sourceEl.dataset.loaded = 'false';
  progressBar.style.width = '0%';
  setStatus('ready', false);
  buildPanel(version);
  try { localStorage.setItem('soc-version', version.meta.id); } catch { /* private mode */ }
}

picker.addEventListener('change', () => load(picker.value));

/* ---- canvas ---- */

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (current) current.resize(ctx, w, h);
}

function speak(text, t) {
  const words = typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : text;
  if (!words.length || !current) return;
  current.words(ctx, words, t);
}

function setStatus(text, listening) {
  statusEl.textContent = text;
  if (listening !== undefined) {
    recordButton.setAttribute('aria-pressed', String(Boolean(listening)));
    recordButton.querySelector('.label').textContent = listening ? 'Listening' : 'Speak';
  }
}

/* ---- input ---- */

const speech = createSpeech({
  onPhrase(text, isFinal) {
    if (isFinal) { ghost = ''; speak(text, clock()); }
    else ghost = text;
  },
  onStatus: setStatus,
});

recordButton.addEventListener('click', () => { replay.stop(); speech.toggle(); });

fallback.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  speak(fallback.value, clock());
  fallback.value = '';
  ghost = '';
});
fallback.addEventListener('input', () => { ghost = fallback.value; });

const replay = createReplay({
  onWords: (words, virtual) => speak(words, virtual),
  onStatus: setStatus,
  onEnd: () => { playButton.textContent = '▶'; },
});

// A transcript runs on its own clock, so the pauses in the real rant still
// decide where thoughts end however fast it is played back.
function clock() {
  return replay.active ? replay.now() : performance.now();
}

async function loadVideo(url) {
  sourceEl.classList.add('busy');
  setStatus('fetching captions…', false);
  videoInput.blur();
  try {
    const res = await fetch('/api/transcript', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'could not fetch that video');

    speech.stop();
    current.reset();
    current.resize(ctx, window.innerWidth, window.innerHeight);
    ghost = '';
    replay.load(data);
    sourceEl.dataset.loaded = 'true';
    playButton.textContent = '❚❚';
    videoInput.value = data.title;
  } catch (err) {
    setStatus(err.message.slice(0, 46), false);
    sourceEl.dataset.loaded = 'false';
  } finally {
    sourceEl.classList.remove('busy');
  }
}

videoInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const url = videoInput.value.trim();
  if (url) loadVideo(url);
});
videoInput.addEventListener('focus', () => videoInput.select());

speedButton.addEventListener('click', () => {
  const next = SPEEDS[(SPEEDS.indexOf(replay.speed) + 1) % SPEEDS.length];
  replay.setSpeed(next);
  speedButton.textContent = `${next}×`;
});
playButton.addEventListener('click', () => {
  playButton.textContent = replay.toggle() ? '❚❚' : '▶';
});

window.addEventListener('resize', fitCanvas);
document.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
  // Number keys jump straight to a version, for demoing without the mouse.
  if (event.key === '`') { panel.hidden = !panel.hidden; return; }
  const n = Number(event.key);
  if (n >= 1 && n <= VERSIONS.length) load(VERSIONS[n - 1].meta.id);
});

if (!speech.supported) setStatus('no speech api — type instead', false);

/* ---- loop ---- */

function frame() {
  const now = clock();
  replay.tick();
  if (current) {
    current.ghost(ghost);
    current.tick(now, ctx);
    current.draw(ctx, now);
  }
  if (replay.active) progressBar.style.width = `${replay.progress() * 100}%`;
  requestAnimationFrame(frame);
}


fitCanvas();
let saved = null;
try { saved = localStorage.getItem('soc-version'); } catch { /* private mode */ }
load(saved || VERSIONS[VERSIONS.length - 1].meta.id);
fitCanvas();
requestAnimationFrame(frame);
