// §8/§10 — turning skeletons into sampled ink.
//
// Output is in EM UNITS with the baseline at y = 0 and y pointing up. Callers
// scale by the ring's growth and bend the result onto the water.
//
// Three lessons from §10 live here:
//   · do not sample finer than a pixel — decimate by SCREEN distance;
//   · sample to exact endpoints, or every stroke lands short of its own end;
//   · per-point noise must be low-frequency ALONG the stroke (~half a cycle
//     per em). Faster than that and neighbouring points pull opposite ways,
//     which is chop, not a loose hand.

import { CFG } from './config.js?v=a6732beb';
import { glyphOf, ASC_REF, DESC_REF } from './glyphs.js?v=a6732beb';

const VARIANTS = 4;
const cache = new Map();

// A cheap deterministic hash, so the same letter in the same word always wanders
// the same way and nothing flickers between frames.
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const lerp = (a, b, t) => a + (b - a) * t;

// px is the letter's on-screen x-height. Quantised so the cache has a handful
// of entries per glyph rather than one per frame.
function level(px) {
  return Math.max(0, Math.min(40, Math.round(Math.log2(Math.max(2, px)) * 3)));
}

/**
 * Sample one glyph into a flat point list.
 * Returns { x, y, u, starts, count, len } where u is cumulative arc length
 * normalised over the whole letter (all strokes end to end) — that is what the
 * chunk-of-line morph runs along.
 */
export function sampleGlyph(ch, pxHeight, variant) {
  const lv = level(pxHeight);
  const key = `${ch}|${lv}|${variant}|${CFG.roundness.toFixed(2)}|${CFG.handNoise.toFixed(3)}|${CFG.handCycles.toFixed(2)}|${CFG.letterWidth.toFixed(2)}|${CFG.letterHeight.toFixed(2)}|${CFG.ascender.toFixed(2)}|${CFG.descender.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const glyph = glyphOf(ch);
  const out = { x: [], y: [], u: [], starts: [], count: 0, len: 0 };
  if (!glyph) { cache.set(key, out); return out; }

  const px = Math.pow(2, lv / 3);            // nominal x-height in px
  const sx = CFG.letterWidth;                // unit x  -> em
  const sy = CFG.letterHeight;               // unit y  -> em
  // Anything above the x-height is ascender and anything below the baseline is
  // descender, each scaled by its own setting so §12's numbers mean something.
  const ay = CFG.ascender / ASC_REF, dy = CFG.descender / DESC_REF;
  const yOf = (u) => (u > 1 ? 1 + (u - 1) * ay : u < 0 ? u * dy : u) * sy;
  const pxPerEm = px / Math.max(0.001, CFG.letterHeight);
  const minStep = 1 / Math.max(0.001, pxPerEm); // one screen pixel, in em
  const phase = hash(ch + variant) * Math.PI * 2;

  // Pass one: walk every stroke, emit points no finer than a pixel, keep exact
  // endpoints, and accumulate arc length as we go.
  let run = 0;
  for (const st of glyph.s) {
    const pts = [];
    let px0 = st[0] * sx, py0 = yOf(st[1]);
    pts.push([px0, py0]);
    for (let i = 2; i < st.length; i += 4) {
      const cxu = st[i] * sx, cyu = yOf(st[i + 1]);
      const x1 = st[i + 2] * sx, y1 = yOf(st[i + 3]);
      // roundness pulls the control point toward the chord: 1 is the drawn
      // curve, 0 is a straight line between the ends.
      const mx = (px0 + x1) / 2, my = (py0 + y1) / 2;
      const cx = lerp(mx, cxu, CFG.roundness), cy = lerp(my, cyu, CFG.roundness);
      const rough = (Math.hypot(cx - px0, cy - py0) + Math.hypot(x1 - cx, y1 - cy)) * pxPerEm;
      const steps = Math.max(2, Math.min(28, Math.ceil(rough / 1.4)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, it = 1 - t;
        const bx = it * it * px0 + 2 * it * t * cx + t * t * x1;
        const by = it * it * py0 + 2 * it * t * cy + t * t * y1;
        const last = pts[pts.length - 1];
        // decimate by screen distance, but never drop the endpoint
        if (s === steps || Math.hypot(bx - last[0], by - last[1]) >= minStep) pts.push([bx, by]);
      }
      px0 = x1; py0 = y1;
    }
    if (pts.length < 2) pts.push([pts[0][0] + minStep, pts[0][1]]);

    // Pass two: wander. The offset is perpendicular to the local tangent and
    // advances CFG.handCycles per em of stroke travelled.
    out.starts.push(out.count);
    let along = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (i > 0) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const n = Math.sin(along * CFG.handCycles * Math.PI * 2 + phase) * CFG.handNoise;
      const x = p[0] + -ty * n, y = p[1] + tx * n;
      if (out.count > 0 && i > 0) {
        run += Math.hypot(x - out.x[out.count - 1], y - out.y[out.count - 1]);
      }
      out.x.push(x); out.y.push(y); out.u.push(run);
      out.count++;
    }
  }

  out.len = run || 1;
  for (let i = 0; i < out.count; i++) out.u[i] /= out.len;
  cache.set(key, out);
  if (cache.size > 4000) cache.clear();
  return out;
}

export const advanceOf = (ch) => {
  if (ch === ' ') return CFG.wordGap * CFG.letterWidth + CFG.letterSpacing;
  const g = glyphOf(ch);
  return g ? g.w * CFG.letterWidth + CFG.letterSpacing : CFG.letterSpacing;
};

/**
 * Lay a string out as letters along a straight path.
 * Offsets are in em units; `width` is what §2 calls pathWidth.
 */
export function layout(text) {
  const letters = [];
  let at = 0, wordIndex = 0, inWord = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const adv = advanceOf(ch);
    if (ch === ' ') { at += adv; wordIndex++; inWord = 0; continue; }
    letters.push({ ch, at, adv, wordIndex, inWord, i });
    at += adv;
    inWord++;
  }
  // How many letters each word has (for the head-before-tail stagger) and where
  // each word ends (§2.5 reveals a word only once the ring can carry all of it).
  const counts = [], ends = [];
  for (const l of letters) {
    counts[l.wordIndex] = (counts[l.wordIndex] || 0) + 1;
    ends[l.wordIndex] = l.at + l.adv;
  }
  for (const l of letters) l.wordLen = counts[l.wordIndex];
  return { letters, width: at, wordEnds: ends };
}
