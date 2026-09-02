import { CONFIG } from './config.js';
import { normalize, isContent, stem } from './lexicon.js';

/**
 * All that is left of the model: knowing when one thought ends and the next
 * begins. Nothing is collected, scored or compared any more — a finished
 * thought only has to signal that the head should let go.
 */
export const model = {
  segment: null,
  contentKeys: [],     // content words of the open thought, in order
  lastTokenTime: 0,
  thoughts: 0,
};

let onThoughtEnd = () => {};

export function setOnThoughtEnd(fn) {
  onThoughtEnd = fn;
}

export function pushWords(words, t = performance.now()) {
  if (!model.segment) openSegment(t);

  for (const raw of words) {
    const text = raw.trim();
    if (!text) continue;
    const norm = normalize(text);
    if (isContent(norm)) model.contentKeys.push(stem(norm));
    model.segment.words++;
  }
  model.lastTokenTime = t;

  if (shouldEnd()) endThought(t);
}

function openSegment(t) {
  model.segment = { startT: t, words: 0 };
  model.contentKeys = [];
}

/**
 * A thought is over when it has run long, or when the last handful of content
 * words stops echoing anything it has been about so far.
 */
function shouldEnd() {
  const keys = model.contentKeys;
  if (keys.length >= CONFIG.maxSegmentContent) return true;
  if (keys.length < CONFIG.minSegmentContent) return false;

  const b = CONFIG.blockSize;
  if (keys.length < b + CONFIG.minSegmentContent) return false;
  return cosine(counts(keys.slice(0, -b)), counts(keys.slice(-b)))
    < CONFIG.cohesionThreshold;
}

function counts(list) {
  const m = new Map();
  for (const k of list) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

function cosine(a, b) {
  let dot = 0;
  for (const [k, v] of a) if (b.has(k)) dot += v * b.get(k);
  if (!dot) return 0;
  let na = 0, nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  return dot / Math.sqrt(na * nb);
}

/** Called every frame: a long enough silence ends the thought. */
export function tickSegments(now) {
  if (model.segment && model.segment.words &&
      now - model.lastTokenTime > CONFIG.pauseMs) {
    endThought(now);
  }
}

export function endThought(t = performance.now()) {
  if (!model.segment || !model.segment.words) return;
  model.segment = null;
  model.contentKeys = [];
  model.thoughts++;
  onThoughtEnd(t);
}

export function resetModel() {
  model.segment = null;
  model.contentKeys = [];
  model.lastTokenTime = 0;
  model.thoughts = 0;
}
