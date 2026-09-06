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
const langPicker = null;
const blurbEl = document.getElementById('blurb');

const SPEEDS = [1, 4, 12, 40];
// What the user has chosen, and what the version on screen can actually use.
let preferred = 'en-US';
try { preferred = localStorage.getItem('soc-lang') || 'en-US'; } catch { /* private mode */ }
let lang = 'en-US';
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

  // Only the version that can write another script offers one.
  lang = 'en-US';
  speech.setLang(lang);
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
