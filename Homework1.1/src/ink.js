// §3 — the core mechanic: the line becomes the words.
//
// A letter begins as a straight chunk of the ring lying exactly where the
// letter will be. It breaks off and floats — an arc peaking early — rising off
// the ring and drifting sideways, so the piece is still a straight chunk of
// line when it is highest. It only becomes a letter on the way down.
//
// The chunk and the letterform are matched by arc length: parameter u runs
// 0..1 through all of a letter's strokes end to end, and the same u picks the
// point on the chunk. So at p = 0 every stroke lies on the ring, contiguous and
// indistinguishable from the water; the pen lifts appear as the letter forms.

import { CFG } from './config.js?v=a6732beb';
import { sampleGlyph, hash } from './cursive.js?v=a6732beb';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / Math.max(1e-6, e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Radius, growth, effective em and how much of the sentence the water carries. */
export function state(w, now) {
  const R = CFG.minRadius + CFG.carrySpeed * (now - w.born);
  // §2.4 — the writing grows with the water beneath it.
  const grow = 1 + Math.min(CFG.spreadTo, (R - CFG.minRadius) / Math.max(1e-6, CFG.minRadius));
  const em = CFG.em * grow * w.scale;
  // §2.5 — the writing is never squeezed to fit; a word waits for water.
  // minGap keeps at least that much ring unwritten, so a sentence can never
  // close the circle and run into its own beginning.
  const round = (2 * Math.PI * R) / Math.max(1e-6, em);
  const carried = Math.min(w.layout.width, round * CFG.fill, Math.max(0, round - CFG.minGap));
  return { R, grow, em, carried };
}

/**
 * Draw one written ring. Appends into `batch`; strokes nothing itself.
 * Returns the angular span the ring is broken over, or null if nothing is up.
 */
export function drawWriting(ctx, batch, w, now) {
  const { R, grow, em, carried } = state(w, now);
  if (!(R > 0) || !isFinite(R) || !isFinite(em) || em <= 0) return null;

  const { letters, wordEnds } = w.layout;

  // §2.5 — a word appears only once the ring can carry all of it.
  for (let i = 0; i < wordEnds.length; i++) {
    if (w.wordBorn[i] === undefined && wordEnds[i] !== undefined && wordEnds[i] <= carried) {
      w.wordBorn[i] = now;
    }
  }

  // The visible sentence is centred on the top of the ring and runs clockwise.
  // A new word arriving would jump the whole sentence round the ring to
  // re-centre it, so the centring turns rather than cuts (turnEase).
  //
  // A word must still FIT, not merely have been born once. wordBorn was latched
  // and never re-read, so turning up the hand (or down the wrap) left words on
  // a ring that could no longer carry them, and a sentence wrapped past 2π and
  // wrote over its own beginning — the thing minGap exists to prevent.
  let visible = 0;
  for (let i = 0; i < wordEnds.length; i++) {
    if (w.wordBorn[i] !== undefined && wordEnds[i] <= carried) visible = wordEnds[i];
  }
  if (visible <= 0) return null;
  const target = visible / 2;
  if (w.half === undefined) w.half = target;
  else {
    const dt = Math.max(0, Math.min(100, now - (w.drawnAt === undefined ? now : w.drawnAt)));
    w.half += (target - w.half) * (1 - Math.exp(-CFG.turnEase * dt / 16));
  }
  w.drawnAt = now;
  const half = w.half;

  const width = Math.max(0.15, CFG.inkWidth * grow * w.scale);
  // A remembered fragment marks the word that brought it back: that word keeps
  // the fragment's full ink and a heavier stroke, its company is dimmed. Two
  // buckets, not two draws — §10's batching still holds.
  const marked = w.link !== undefined;
  const plain = batch.path(marked ? w.alpha * CFG.linkDim : w.alpha, width);
  const lit = marked ? batch.path(w.alpha, width * CFG.linkWeight) : plain;
  if (!plain && !lit) return null;      // faded below the finest band

  let firstS = Infinity, lastS = -Infinity;

  for (const L of letters) {
    const born = w.wordBorn[L.wordIndex];
    if (born === undefined || wordEnds[L.wordIndex] > carried) continue;
    // §3 — the head of a word lands before its tail. One schedule drives both
    // the ink and the break in the ring, so they cannot disagree (§10).
    const stagger = L.wordLen > 1 ? L.inWord / (L.wordLen - 1) : 0;
    const p = (now - born - CFG.coilStagger * CFG.formMs * stagger) / Math.max(1, CFG.formMs);
    if (p < 0) continue;
    const grown = clamp(p, 0, 1);

    firstS = Math.min(firstS, L.at - half);
    lastS = Math.max(lastS, L.at + L.adv - half);

    const path = L.wordIndex === w.link ? lit : plain;
    if (!path) continue;
    const g = sampleGlyph(L.ch, em * CFG.letterHeight, (hash(L.ch + L.i) * 4) | 0);
    if (!g.count) continue;

    const arc = Math.sin(Math.PI * Math.pow(grown, 0.45));  // peaks early
    const shape = smoothstep(CFG.shapeFrom, 1, grown);
    const lift = CFG.floatRise * arc;
    const dir = hash(L.ch + L.i + w.seed) < 0.5 ? -1 : 1;
    const drift = CFG.floatDrift * arc * dir;

    const starts = g.starts;
    let sIdx = 0;
    for (let i = 0; i < g.count; i++) {
      // a straight chunk of the ring, lying exactly where the letter will be
      const chunk = g.u[i] * L.adv;
      const x = chunk + (g.x[i] - chunk) * shape + drift;
      const y = g.y[i] * shape + lift;
      const th = -Math.PI / 2 + ((L.at + x - half) * em) / R;
      const rr = R + y * em;
      if (!(rr > 0) || !isFinite(rr) || !isFinite(th)) continue;
      const px = w.x + rr * Math.cos(th);
      const py = w.y + rr * Math.sin(th);
      if (sIdx < starts.length && starts[sIdx] === i) { path.moveTo(px, py); sIdx++; }
      else path.lineTo(px, py);
    }
  }

  if (firstS === Infinity) return null;
  // §3 — that stretch of line has BECOME the words, so the ring is broken over
  // the writing's span plus gapPad either side.
  return { a0: -Math.PI / 2 + (firstS * em) / R - CFG.gapPad,
           a1: -Math.PI / 2 + (lastS * em) / R + CFG.gapPad,
           R, width, alpha: w.alpha };
}
