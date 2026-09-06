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
