/**
 * Single-stroke cursive, generated rather than set in a face. One continuous
 * path enters at the baseline, writes the phrase, and leaves at the baseline —
 * so the same polyline that draws a vibrating line can draw handwriting, and
 * anything in between.
 *
 * x advances left to right, y is positive upward, the baseline is y = 0 and
 * the x-height is y = 1. Every letter is its own skeleton rather than a
 * composition of shared parts, because letters are told apart by their
 * shapes and not by their rhythm: an a and an o differ, and so must these.
 *
 * Each letter starts at (0, 0) and is a list of quadratic segments given as
 * [controlX, controlY, endX, endY]. A letter may finish anywhere; the join
 * to the next one brings the pen back down to the line.
 */

const LETTERS = {
  a: { w: 0.64, s: [
    [0.08, 0.82, 0.34, 1.0], [0.0, 0.94, 0.04, 0.5], [0.06, 0.04, 0.34, 0.03],
    [0.58, 0.06, 0.6, 0.5], [0.58, 0.96, 0.36, 0.99], [0.62, 0.62, 0.64, 0.0],
  ] },
  b: { w: 0.92, s: [
    [0.3, 1.02, 0.2, 1.72], [0.02, 1.78, 0.08, 0.92], [0.14, 0.34, 0.34, 0.06],
    [0.5, 0.0, 0.66, 0.2], [0.86, 0.5, 0.72, 0.78], [0.6, 0.98, 0.92, 0.72],
  ] },
  c: { w: 0.58, s: [
    [0.34, 1.02, 0.46, 0.94], [0.06, 1.0, 0.05, 0.5],
    [0.04, 0.04, 0.36, 0.06], [0.5, 0.1, 0.58, 0.02],
  ] },
  d: { w: 0.96, s: [
    [0.08, 0.82, 0.34, 1.0], [0.0, 0.94, 0.04, 0.5], [0.06, 0.04, 0.34, 0.03],
    [0.58, 0.06, 0.6, 0.52], [0.72, 1.1, 0.74, 1.72],
    [0.86, 1.76, 0.8, 0.9], [0.82, 0.3, 0.96, 0.0],
  ] },
  e: { w: 0.54, s: [
    [0.24, 0.06, 0.3, 0.44], [0.4, 0.78, 0.2, 0.76],
    [0.0, 0.68, 0.1, 0.24], [0.28, 0.0, 0.54, 0.16],
  ] },
  f: { w: 0.72, s: [
    [0.36, 1.05, 0.28, 1.74], [0.08, 1.8, 0.16, 1.0],
    [0.2, 0.4, 0.24, -0.3], [0.2, -0.82, 0.04, -0.78],
    [-0.08, -0.74, 0.06, -0.3], [0.16, 0.2, 0.72, 0.04],
  ] },
  g: { w: 0.7, s: [
    [0.08, 0.82, 0.34, 1.0], [0.0, 0.94, 0.04, 0.5], [0.06, 0.04, 0.34, 0.03],
    [0.58, 0.06, 0.6, 0.5], [0.62, 0.1, 0.58, -0.5],
    [0.5, -0.86, 0.28, -0.78], [0.14, -0.72, 0.42, -0.34], [0.62, -0.1, 0.7, 0.0],
  ] },
  h: { w: 1.0, s: [
    [0.3, 1.02, 0.2, 1.72], [0.02, 1.78, 0.08, 0.9], [0.12, 0.3, 0.2, 0.0],
    [0.34, 0.66, 0.5, 1.0], [0.66, 1.14, 0.68, 0.5], [0.7, 0.16, 1.0, 0.0],
  ] },
  i: { w: 0.3, s: [
    [0.1, 0.5, 0.2, 0.82], [0.28, 0.94, 0.26, 0.4], [0.28, 0.12, 0.3, 0.0],
    // The dot, looped in above without the pen leaving the paper.
    [0.24, 0.9, 0.16, 1.34], [0.1, 1.5, 0.2, 1.46], [0.3, 1.42, 0.3, 0.0],
  ] },
  j: { w: 0.36, s: [
    [0.1, 0.5, 0.2, 0.84], [0.3, 0.96, 0.3, -0.34],
    [0.26, -0.84, 0.06, -0.78], [-0.06, -0.72, 0.18, -0.3], [0.34, -0.06, 0.42, 0.0],
  ] },
  k: { w: 0.88, s: [
    [0.3, 1.02, 0.2, 1.72], [0.02, 1.78, 0.08, 0.9], [0.12, 0.3, 0.2, 0.0],
    [0.3, 0.62, 0.6, 0.92], [0.36, 0.72, 0.34, 0.42],
    [0.5, 0.5, 0.7, 0.24], [0.78, 0.1, 0.88, 0.0],
  ] },
  l: { w: 0.46, s: [
    [0.32, 1.02, 0.22, 1.74], [0.02, 1.8, 0.1, 0.9], [0.16, 0.28, 0.46, 0.0],
  ] },
  m: { w: 1.5, s: [
    [0.14, 0.62, 0.3, 1.0], [0.46, 1.14, 0.48, 0.5], [0.5, 0.16, 0.5, 0.0],
    [0.64, 0.62, 0.8, 1.0], [0.96, 1.14, 0.98, 0.5], [1.0, 0.16, 1.0, 0.0],
    [1.14, 0.62, 1.3, 1.0], [1.46, 1.14, 1.48, 0.5], [1.5, 0.16, 1.5, 0.0],
  ] },
  n: { w: 1.0, s: [
    [0.14, 0.62, 0.3, 1.0], [0.46, 1.14, 0.48, 0.5], [0.5, 0.16, 0.5, 0.0],
    [0.64, 0.62, 0.8, 1.0], [0.96, 1.14, 0.98, 0.5], [1.0, 0.16, 1.0, 0.0],
  ] },
  o: { w: 0.72, s: [
    [0.08, 0.82, 0.34, 1.0], [0.0, 0.94, 0.04, 0.5], [0.06, 0.04, 0.34, 0.03],
    [0.62, 0.06, 0.66, 0.5], [0.68, 0.9, 0.44, 0.98], [0.66, 0.86, 0.72, 0.62],
  ] },
  p: { w: 0.8, s: [
    [0.06, 0.8, 0.16, 1.0], [0.24, 0.3, 0.2, -0.5],
    [0.16, -0.84, 0.3, -0.8], [0.42, -0.76, 0.34, 0.1],
    [0.4, 0.72, 0.56, 0.86], [0.82, 0.96, 0.8, 0.5], [0.78, 0.06, 0.8, 0.0],
  ] },
  q: { w: 0.72, s: [
    [0.08, 0.82, 0.34, 1.0], [0.0, 0.94, 0.04, 0.5], [0.06, 0.04, 0.34, 0.03],
    [0.58, 0.06, 0.6, 0.5], [0.64, 0.0, 0.56, -0.6],
    [0.6, -0.84, 0.72, -0.62], [0.74, -0.3, 0.72, 0.0],
  ] },
  r: { w: 0.7, s: [
    [0.12, 0.6, 0.26, 0.98], [0.34, 1.04, 0.34, 0.72],
    [0.46, 1.06, 0.58, 0.9], [0.66, 0.5, 0.7, 0.0],
  ] },
  s: { w: 0.5, s: [
    [0.28, 0.96, 0.4, 0.92], [0.34, 1.06, 0.14, 0.9],
    [0.02, 0.76, 0.2, 0.5], [0.42, 0.28, 0.36, 0.12],
    [0.24, -0.02, 0.5, 0.06],
  ] },
  t: { w: 0.5, s: [
    [0.2, 0.94, 0.24, 1.56], [0.3, 0.8, 0.34, 0.06],
    [0.42, 0.16, 0.5, 0.22], [0.2, 1.24, 0.02, 1.16], [0.3, 1.3, 0.5, 1.16],
  ] },
  u: { w: 1.0, s: [
    [0.1, 0.6, 0.22, 1.0], [0.24, 0.5, 0.26, 0.22],
    [0.3, -0.06, 0.46, 0.06], [0.54, 0.4, 0.6, 1.0],
    [0.62, 0.5, 0.64, 0.22], [0.68, -0.06, 0.84, 0.06], [0.94, 0.4, 1.0, 0.92],
  ] },
  v: { w: 0.64, s: [
    [0.06, 0.86, 0.16, 1.0], [0.3, 0.28, 0.36, 0.02], [0.46, 0.5, 0.64, 0.94],
  ] },
  w: { w: 1.0, s: [
    [0.06, 0.86, 0.14, 1.0], [0.24, 0.28, 0.3, 0.02],
    [0.4, 0.5, 0.5, 1.0], [0.6, 0.28, 0.66, 0.02], [0.78, 0.5, 1.0, 0.94],
  ] },
  x: { w: 0.64, s: [
    [0.05, 0.8, 0.14, 1.0], [0.36, 0.62, 0.56, 0.0],
    [0.42, 0.28, 0.1, 0.46], [0.32, 0.58, 0.64, 0.34],
  ] },
  y: { w: 0.78, s: [
    [0.06, 0.86, 0.14, 1.0], [0.22, -0.1, 0.44, 0.04],
    [0.5, 0.56, 0.54, 1.0], [0.52, 0.2, 0.44, -0.5],
    [0.38, -0.84, 0.2, -0.78], [0.08, -0.72, 0.36, -0.32], [0.62, -0.06, 0.78, 0.02],
  ] },
  z: { w: 0.66, s: [
    [0.12, 0.94, 0.24, 0.98], [0.5, 1.04, 0.62, 0.98],
    [0.3, 0.6, 0.16, 0.1], [0.4, 0.02, 0.58, 0.06],
    [0.52, -0.5, 0.34, -0.72], [0.14, -0.86, 0.12, -0.5], [0.2, -0.12, 0.66, 0.02],
  ] },
};

/** How the hand is shaped. Every letter is bent by these before it is drawn. */
export const HAND = {
  xHeight: 1,       // height of the small letters against their width
  width: 1,         // how wide each letter runs
  spacing: 0.1,     // air between letters
  wordGap: 0.42,
  ascender: 1,      // how far the tall loops reach above the x-height
  descender: 1,     // how far the tails drop below the line
  roundness: 1,     // 0 draws the turns as corners, 2 balloons them
};

function quad(pts, cx, cy, x, y, steps = 5) {
  const from = pts[pts.length - 1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * from.x + 2 * u * t * cx + t * t * x,
      y: u * u * from.y + 2 * u * t * cy + t * t * y,
    });
  }
}

/** Whether this text can be written by the hand defined above. */
export function canWrite(text) {
  const letters = String(text).toLowerCase().replace(/[^a-z]/g, '');
  return letters.length > 0 && [...letters].every((ch) => LETTERS[ch]);
}

/**
 * Write a phrase as one continuous stroke. Returns points in em units with y
 * measured up from the baseline, and the total advance.
 */
export function writePhrase(text) {
  const pts = [{ x: 0, y: 0, w: 0 }];
  let x = 0;
  let word = 0;

  for (const ch of String(text).toLowerCase()) {
    if (ch === ' ') {
      quad(pts, x + HAND.wordGap * 0.48, -0.2 * HAND.xHeight, x + HAND.wordGap, 0, 4);
      word++;
      mark(pts, word);
      x += HAND.wordGap;
      continue;
    }
    const letter = LETTERS[ch];
    if (!letter) continue;

    // Bring the pen to where this letter begins, without lifting it.
    const here = pts[pts.length - 1];
    if (Math.abs(here.y) > 0.001 || Math.abs(here.x - x) > 0.001) {
      quad(pts, (here.x + x) / 2, here.y * 0.4, x, 0, 3);
    }

    for (const seg of letter.s) {
      const [cx, cy, ex, ey] = bend(seg, pts[pts.length - 1], x);
      quad(pts, cx, cy, ex, ey);
    }
    x += letter.w * HAND.width + HAND.spacing;
    mark(pts, word);
  }

  // Finish on the line.
  const end = pts[pts.length - 1];
  if (Math.abs(end.y) > 0.001) quad(pts, end.x + 0.06, end.y * 0.4, x, 0, 3);
  mark(pts, word);

  return { points: pts, width: Math.max(x, 0.001), words: word + 1 };
}

/**
 * Bend one segment of a letter into the current hand: letters run wider or
 * narrower, sit taller or shorter, reach further above and below the line,
 * and turn roundly or sharply.
 */
function bend([cx, cy, ex, ey], from, x) {
  const height = (y) => {
    const h = y * HAND.xHeight;
    if (y > 1) return HAND.xHeight + (y - 1) * HAND.xHeight * HAND.ascender;
    if (y < 0) return h * HAND.descender;
    return h;
  };
  const endX = x + ex * HAND.width;
  const endY = height(ey);
  // A control point is moved relative to the line it is pulling away from,
  // so roundness opens and closes the turns without moving the letter.
  const midX = (from.x + endX) / 2;
  const midY = (from.y + endY) / 2;
  const ctrlX = x + cx * HAND.width;
  const ctrlY = height(cy);
  return [
    midX + (ctrlX - midX) * HAND.roundness,
    midY + (ctrlY - midY) * HAND.roundness,
    endX,
    endY,
  ];
}

/** Stamp every point written since the last mark with its word. */
function mark(pts, word) {
  for (let i = pts.length - 1; i >= 0 && pts[i].w === undefined; i--) pts[i].w = word;
}
