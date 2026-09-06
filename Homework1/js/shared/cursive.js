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
 * The pen lifts between letters. Joining them was what made a word one
 * undifferentiated run, and the line underneath carries on regardless, so
 * nothing is lost by letting each letter stand on its own.
 *
 * Each letter starts at (0, 0) and is a list of quadratic segments given as
 * [controlX, controlY, endX, endY]. A letter may finish anywhere; the join
 * to the next one brings the pen back down to the line.
 */

// A letter is one or more strokes. Each stroke is [startX, startY] followed by
// quadratic segments [controlX, controlY, endX, endY]. The pen lifts between
// strokes, so a crossbar or a dot is its own mark rather than a doubling back.
const LETTERS = {
  a: { w: 0.64, k: [[[0.6, 0.72],
    [0.5, 1.02, 0.3, 1.0], [0.02, 0.96, 0.04, 0.5], [0.06, 0.04, 0.32, 0.03],
    [0.58, 0.06, 0.6, 0.5], [0.6, 0.2, 0.62, 0.0]]] },
  b: { w: 0.62, k: [[[0.06, 1.7],
    [0.02, 0.9, 0.08, 0.4], [0.1, 0.1, 0.12, 0.0],
    [0.3, 0.02, 0.42, 0.14], [0.62, 0.36, 0.5, 0.62], [0.38, 0.84, 0.1, 0.6]]] },
  c: { w: 0.56, k: [[[0.52, 0.82],
    [0.42, 1.0, 0.22, 0.98], [0.0, 0.92, 0.04, 0.48],
    [0.06, 0.04, 0.3, 0.04], [0.46, 0.06, 0.54, 0.2]]] },
  d: { w: 0.66, k: [[[0.56, 1.72],
    [0.6, 0.9, 0.6, 0.4], [0.6, 0.1, 0.64, 0.0]],
    [[0.56, 0.86],
    [0.4, 1.0, 0.22, 0.94], [0.0, 0.84, 0.04, 0.44],
    [0.08, 0.04, 0.32, 0.04], [0.5, 0.06, 0.58, 0.2]]] },
  e: { w: 0.54, k: [[[0.06, 0.44],
    [0.28, 0.5, 0.46, 0.5], [0.5, 0.9, 0.24, 0.92],
    [0.0, 0.86, 0.06, 0.36], [0.16, 0.0, 0.5, 0.14]]] },
  f: { w: 0.5, k: [[[0.34, 1.72],
    [0.36, 1.9, 0.2, 1.8], [0.1, 1.6, 0.14, 0.9],
    [0.16, 0.2, 0.12, -0.5], [0.06, -0.8, -0.04, -0.7]],
    [[0.0, 0.94], [0.2, 1.0, 0.46, 0.96]]] },
  g: { w: 0.64, k: [[[0.58, 0.82],
    [0.46, 1.0, 0.26, 0.98], [0.02, 0.9, 0.06, 0.48],
    [0.08, 0.04, 0.32, 0.04], [0.54, 0.06, 0.56, 0.5]],
    [[0.56, 0.6],
    [0.58, 0.1, 0.54, -0.44], [0.5, -0.82, 0.24, -0.76], [0.08, -0.72, 0.12, -0.4]]] },
  h: { w: 0.66, k: [[[0.06, 1.72],
    [0.02, 0.9, 0.06, 0.4], [0.08, 0.1, 0.1, 0.0]],
    [[0.12, 0.52],
    [0.2, 0.98, 0.42, 0.94], [0.62, 0.88, 0.62, 0.42], [0.62, 0.14, 0.66, 0.0]]] },
  i: { w: 0.26, k: [[[0.08, 0.92],
    [0.14, 0.5, 0.16, 0.24], [0.18, 0.04, 0.26, 0.02]],
    [[0.14, 1.24], [0.2, 1.32, 0.24, 1.24], [0.2, 1.14, 0.14, 1.24]]] },
  j: { w: 0.3, k: [[[0.16, 0.92],
    [0.2, 0.4, 0.18, -0.4], [0.14, -0.78, -0.04, -0.7]],
    [[0.18, 1.24], [0.24, 1.32, 0.28, 1.24], [0.24, 1.14, 0.18, 1.24]]] },
  k: { w: 0.62, k: [[[0.06, 1.72],
    [0.02, 0.9, 0.06, 0.4], [0.08, 0.1, 0.1, 0.0]],
    [[0.56, 0.86], [0.3, 0.66, 0.14, 0.44]],
    [[0.24, 0.54], [0.44, 0.34, 0.6, 0.0]]] },
  l: { w: 0.3, k: [[[0.1, 1.74],
    [0.04, 0.9, 0.1, 0.36], [0.14, 0.06, 0.3, 0.0]]] },
  m: { w: 1.06, k: [[[0.04, 0.92],
    [0.06, 0.4, 0.06, 0.0]],
    [[0.04, 0.66], [0.12, 0.98, 0.32, 0.94], [0.5, 0.9, 0.5, 0.44], [0.5, 0.16, 0.5, 0.0]],
    [[0.5, 0.66], [0.58, 0.98, 0.78, 0.94], [0.96, 0.9, 0.96, 0.44], [0.96, 0.16, 1.0, 0.0]]] },
  n: { w: 0.62, k: [[[0.04, 0.92],
    [0.06, 0.4, 0.06, 0.0]],
    [[0.04, 0.66], [0.14, 0.98, 0.36, 0.94], [0.58, 0.88, 0.58, 0.42], [0.58, 0.14, 0.62, 0.0]]] },
  o: { w: 0.62, k: [[[0.3, 0.98],
    [0.02, 0.94, 0.04, 0.5], [0.06, 0.04, 0.32, 0.04],
    [0.58, 0.06, 0.58, 0.5], [0.58, 0.94, 0.3, 0.98]]] },
  p: { w: 0.62, k: [[[0.04, 0.92],
    [0.08, 0.2, 0.04, -0.6], [0.02, -0.8, 0.0, -0.72]],
    [[0.06, 0.62], [0.16, 0.96, 0.36, 0.92], [0.6, 0.86, 0.58, 0.46],
    [0.56, 0.06, 0.3, 0.06], [0.14, 0.06, 0.08, 0.2]]] },
  q: { w: 0.64, k: [[[0.58, 0.82],
    [0.46, 1.0, 0.26, 0.98], [0.02, 0.9, 0.06, 0.48],
    [0.08, 0.04, 0.32, 0.04], [0.54, 0.06, 0.56, 0.5]],
    [[0.56, 0.6], [0.6, 0.0, 0.56, -0.6], [0.56, -0.76, 0.64, -0.62]]] },
  r: { w: 0.5, k: [[[0.04, 0.92],
    [0.06, 0.4, 0.06, 0.0]],
    [[0.04, 0.62], [0.14, 0.96, 0.3, 0.92], [0.42, 0.9, 0.5, 0.8]]] },
  s: { w: 0.46, k: [[[0.42, 0.86],
    [0.34, 1.0, 0.16, 0.94], [0.0, 0.86, 0.14, 0.62],
    [0.28, 0.42, 0.34, 0.26], [0.38, 0.04, 0.04, 0.1]]] },
  t: { w: 0.42, k: [[[0.18, 1.5],
    [0.2, 0.8, 0.2, 0.2], [0.22, 0.02, 0.4, 0.08]],
    [[0.02, 1.0], [0.18, 1.06, 0.38, 1.0]]] },
  u: { w: 0.62, k: [[[0.04, 0.92],
    [0.02, 0.3, 0.16, 0.06], [0.34, -0.04, 0.5, 0.2], [0.54, 0.4, 0.54, 0.92]],
    [[0.54, 0.62], [0.56, 0.2, 0.62, 0.0]]] },
  v: { w: 0.54, k: [[[0.02, 0.92],
    [0.16, 0.36, 0.26, 0.02], [0.38, 0.4, 0.52, 0.92]]] },
  w: { w: 0.86, k: [[[0.02, 0.92],
    [0.12, 0.36, 0.22, 0.02], [0.32, 0.5, 0.42, 0.86],
    [0.52, 0.5, 0.62, 0.02], [0.74, 0.4, 0.84, 0.92]]] },
  x: { w: 0.54, k: [[[0.02, 0.9], [0.26, 0.5, 0.5, 0.02]],
    [[0.5, 0.9], [0.26, 0.5, 0.02, 0.02]]] },
  y: { w: 0.6, k: [[[0.02, 0.92],
    [0.02, 0.3, 0.16, 0.08], [0.34, -0.02, 0.5, 0.24]],
    [[0.52, 0.92], [0.5, 0.2, 0.42, -0.42], [0.36, -0.8, 0.12, -0.7]]] },
  z: { w: 0.56, k: [[[0.04, 0.9], [0.3, 0.96, 0.52, 0.92],
    [0.28, 0.5, 0.08, 0.08], [0.3, 0.02, 0.54, 0.06]],
    [[0.3, 0.06], [0.34, -0.5, 0.2, -0.66], [0.06, -0.8, 0.02, -0.6]]] },
};

/** How the hand is shaped. Every letter is bent by these before it is drawn. */
export const HAND = {
  xHeight: 1,       // height of the small letters against their width
  width: 1,         // how wide each letter runs
  spacing: 0.22,    // air between letters
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
  const pts = [];
  let x = 0;
  let word = 0;
  let stroke = 0;

  for (const ch of String(text).toLowerCase()) {
    if (ch === ' ') {
      word++;
      x += HAND.wordGap;
      continue;
    }
    const letter = LETTERS[ch];
    if (!letter) continue;

    // The pen comes down at the start of each stroke and lifts at its end,
    // so a dot or a crossbar is its own mark.
    for (const marks of letter.k) {
      const [from, ...segs] = marks;
      pts.push({ x: x + from[0] * HAND.width, y: height(from[1]), w: word, s: stroke });
      for (const seg of segs) {
        const [cx, cy, ex, ey] = bend(seg, pts[pts.length - 1], x);
        quad(pts, cx, cy, ex, ey);
      }
      for (let i = pts.length - 1; i >= 0 && pts[i].s === undefined; i--) {
        pts[i].s = stroke;
        pts[i].w = word;
      }
      stroke++;
    }
    x += letter.w * HAND.width + HAND.spacing;
  }

  return { points: pts, width: Math.max(x, 0.001), words: word + 1, strokes: stroke };
}

/**
 * Bend one segment of a letter into the current hand: letters run wider or
 * narrower, sit taller or shorter, reach further above and below the line,
 * and turn roundly or sharply.
 */
function height(y) {
  const h = y * HAND.xHeight;
  if (y > 1) return HAND.xHeight + (y - 1) * HAND.xHeight * HAND.ascender;
  if (y < 0) return h * HAND.descender;
  return h;
}

function bend([cx, cy, ex, ey], from, x) {
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


