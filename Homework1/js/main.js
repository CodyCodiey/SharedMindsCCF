import { CONFIG } from './config.js';
import { pushWords, tickSegments, endThought, resetModel, setOnThoughtEnd } from './model.js';
import { resizeStage } from './stage.js';
import { addWords, tickSeeds, release, fillHead } from './dandelion.js';
import { draw } from './render.js';
import { createSpeech } from './speech.js';
import { createReplay } from './replay.js';

export { CONFIG };

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

const SPEEDS = [1, 4, 12, 40];
let ghost = '';

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resizeStage(w, h);
}

// When a thought finishes, the head lets go of everything it was holding.
setOnThoughtEnd((t) => release(t));

function speak(text, t) {
  const words = typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : text;
  if (!words.length) return;
  addWords(words, t);
  pushWords(words, t);
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
  onEnd: () => { endThought(replay.now()); playButton.textContent = '▶'; },
});

// A transcript runs the model on its own clock, so the pauses in the real
// rant still decide where thoughts end.
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
    resetModel();
    fillHead();
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
  if (event.key === 'Escape') endThought(clock());
});

sourceEl.dataset.loaded = 'false';
if (!speech.supported) setStatus('no speech api — type instead', false);

/* ---- loop ---- */

function frame() {
  const now = clock();
  replay.tick();
  tickSegments(now);
  tickSeeds(now);

  draw(ctx, ghost, now);
  if (replay.active) progressBar.style.width = `${replay.progress() * 100}%`;
  requestAnimationFrame(frame);
}

fitCanvas();
fillHead();
requestAnimationFrame(frame);
