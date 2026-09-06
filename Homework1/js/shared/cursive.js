/**
 * Single-stroke cursive, generated rather than set in a face. One continuous
 * path enters at the baseline, writes the phrase, and leaves at the baseline —
 * so the same polyline that draws a vibrating line can draw handwriting, and
 * anything in between.
 *
 * x advances left to right, y is positive upward, the baseline is y = 0 and
 * the x-height is y = 1. Every letter is an ordered list of strokes, because
 * a d is a bowl and then a stem, and writing it the other way round is not a d.
 */

const ASC = 1.85;
const DESC = -0.85;

function quad(pts, c, to, steps = 6) {
  const from = pts[pts.length - 1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
    });
  }
}

const at = (pts) => pts[pts.length - 1];

// Each stroke takes the pen from where it is to where it leaves, and reports
// how far along the line it travelled.
const STROKE = {
  /** An over-arc: rounded on top, cornered at the line. n, m, i. */
  arch(pts, x, s = 1) {
    const w = 0.66 * s;
    quad(pts, { x: x + w * 0.02, y: 1.18 }, { x: x + w * 0.5, y: 1 });
    quad(pts, { x: x + w * 0.98, y: 1.16 }, { x: x + w, y: 0 });
    return w;
  },

  /** An under-arc: cornered on top, rounded at the line. u, y. */
  trough(pts, x, s = 1) {
    const w = 0.62 * s;
    quad(pts, { x: x + w * 0.1, y: 0.94 }, { x: x + w * 0.24, y: 1 });
    quad(pts, { x: x + w * 0.42, y: -0.16 }, { x: x + w * 0.8, y: 0.34 });
    quad(pts, { x: x + w * 0.96, y: 0.86 }, { x: x + w, y: 1 });
    quad(pts, { x: x + w * 1.04, y: 0.5 }, { x: x + w * 1.02, y: 0 }, 4);
    return w * 1.02;
  },

  /** A pointed valley. v, w. */
  wedge(pts, x, s = 1) {
    const w = 0.58 * s;
    quad(pts, { x: x + w * 0.1, y: 0.9 }, { x: x + w * 0.22, y: 1 }, 3);
    pts.push({ x: x + w * 0.6, y: 0.02 });
    pts.push({ x: x + w, y: 1 });
    return w;
  },

  /** A round body, written the way a hand makes an o, closing at the top. */
  bowl(pts, x, s = 1) {
    const w = 0.7 * s;
    const r = w / 2;
    const cx = x + r;
    quad(pts, { x: x + w * 0.04, y: 0.86 }, { x: cx, y: 1 });
    quad(pts, { x: cx + r * 1.02, y: 0.88 }, { x: x + w, y: 0.5 });
    quad(pts, { x: cx + r * 0.98, y: 0.1 }, { x: cx, y: 0 });
    quad(pts, { x: cx - r * 1.0, y: 0.1 }, { x: x, y: 0.5 });
    quad(pts, { x: cx - r * 0.86, y: 0.9 }, { x: cx - r * 0.1, y: 0.97 });
    // Out of the top of the bowl and back down to the line to carry on.
    quad(pts, { x: x + w * 0.92, y: 0.86 }, { x: x + w * 1.04, y: 0 });
    return w * 1.04;
  },

  /** An open bowl: c, which never closes. */
  hook(pts, x, s = 1) {
    const w = 0.58 * s;
    quad(pts, { x: x + w * 0.16, y: 0.9 }, { x: x + w * 0.62, y: 0.98 });
    quad(pts, { x: x + w * 0.1, y: 1.02 }, { x: x + w * 0.06, y: 0.5 });
    quad(pts, { x: x + w * 0.04, y: 0.02 }, { x: x + w * 0.66, y: 0.06 });
    quad(pts, { x: x + w * 0.92, y: 0.08 }, { x: x + w, y: 0 }, 3);
    return w;
  },

  /** The tall loop of l, h, b, k: up the right, over, down the left. */
  stem(pts, x, s = 1) {
    const top = ASC * s;
    const w = 0.34;
    quad(pts, { x: x + w * 1.5, y: top * 0.5 }, { x: x + w * 0.95, y: top });
    quad(pts, { x: x + w * 0.1, y: top * 0.98 }, { x: x + w * 0.3, y: top * 0.52 });
    quad(pts, { x: x + w * 0.52, y: top * 0.08 }, { x: x + w * 0.86, y: 0 });
    return w * 0.86;
  },

  /** A straight tall stroke, for t: shorter, and no loop. */
  post(pts, x, s = 0.66) {
    const top = ASC * s;
    quad(pts, { x: x + 0.16, y: top * 0.6 }, { x: x + 0.2, y: top }, 4);
    quad(pts, { x: x + 0.24, y: top * 0.4 }, { x: x + 0.3, y: 0 }, 4);
    return 0.3;
  },

  /** The loop below the line: g, y, j, p, f, z. */
  tail(pts, x, s = 1) {
    const deep = DESC * s;
    quad(pts, { x: x + 0.2, y: deep * 0.55 }, { x: x + 0.14, y: deep });
    quad(pts, { x: x - 0.3, y: deep * 1.0 }, { x: x - 0.22, y: deep * 0.34 });
    quad(pts, { x: x - 0.02, y: 0.02 }, { x: x + 0.26, y: 0.06 });
    quad(pts, { x: x + 0.34, y: 0.04 }, { x: x + 0.36, y: 0 }, 3);
    return 0.36;
  },

  /** A straight descender, for q. */
  drop(pts, x) {
    quad(pts, { x: x + 0.12, y: DESC * 0.5 }, { x: x + 0.16, y: DESC });
    quad(pts, { x: x + 0.34, y: DESC * 0.8 }, { x: x + 0.4, y: 0 });
    return 0.4;
  },

  /** The small closed loop of e. */
  eye(pts, x, s = 1) {
    const w = 0.5 * s;
    quad(pts, { x: x + w * 0.1, y: 0.44 }, { x: x + w * 0.52, y: 0.52 });
    quad(pts, { x: x + w * 0.86, y: 0.6 }, { x: x + w * 0.5, y: 0.98 });
    quad(pts, { x: x + w * 0.04, y: 0.9 }, { x: x + w * 0.1, y: 0.36 });
    quad(pts, { x: x + w * 0.4, y: -0.06 }, { x: x + w * 1.05, y: 0.04 });
    return w * 1.05;
  },

  /** The s curl. */
  curl(pts, x, s = 1) {
    const w = 0.44 * s;
    quad(pts, { x: x + w * 0.9, y: 0.5 }, { x: x + w * 0.72, y: 0.96 });
    quad(pts, { x: x + w * 0.1, y: 1.02 }, { x: x + w * 0.24, y: 0.5 });
    quad(pts, { x: x + w * 0.4, y: 0.08 }, { x: x + w, y: 0.02 });
    return w;
  },

  /** The shoulder of r: a short arch that stops high. */
  shoulder(pts, x) {
    quad(pts, { x: x + 0.06, y: 1.0 }, { x: x + 0.22, y: 0.82 });
    quad(pts, { x: x + 0.34, y: 1.05 }, { x: x + 0.46, y: 0.86 });
    quad(pts, { x: x + 0.5, y: 0.4 }, { x: x + 0.52, y: 0 }, 4);
    return 0.52;
  },

  /** k's knot, and x's crossing — both drawn without lifting. */
  knot(pts, x) {
    quad(pts, { x: x + 0.02, y: 0.9 }, { x: x + 0.3, y: 0.52 });
    quad(pts, { x: x - 0.06, y: 0.4 }, { x: x + 0.26, y: 0.34 });
    quad(pts, { x: x + 0.48, y: 0.2 }, { x: x + 0.5, y: 0 });
    return 0.5;
  },
  cross(pts, x) {
    quad(pts, { x: x + 0.04, y: 1.02 }, { x: x + 0.46, y: 0.94 });
    quad(pts, { x: x + 0.1, y: 0.6 }, { x: x - 0.02, y: 0.46 });
    quad(pts, { x: x + 0.3, y: 0.2 }, { x: x + 0.48, y: 0 });
    return 0.48;
  },
  bar(pts, x) {
    // t's crossbar, doubling back over the stroke just written.
    quad(pts, { x: x - 0.22, y: 1.25 }, { x: x - 0.34, y: 1.12 }, 3);
    quad(pts, { x: x + 0.1, y: 1.2 }, { x: x + 0.06, y: 0.06 }, 4);
    return 0.06;
  },
  zig(pts, x) {
    quad(pts, { x: x + 0.1, y: 1.0 }, { x: x + 0.44, y: 0.96 }, 3);
    pts.push({ x: x + 0.06, y: 0.06 });
    quad(pts, { x: x + 0.3, y: 0.0 }, { x: x + 0.5, y: 0.04 }, 3);
    return 0.5;
  },
};

// Ordered, because a d is a bowl and then a stem.
const LETTERS = {
  a: ['bowl'],
  b: ['stem', ['bowl', 0.82]],
  c: ['hook'],
  d: ['bowl', 'stem'],
  e: ['eye'],
  f: ['stem', 'tail'],
  g: ['bowl', 'tail'],
  h: ['stem', 'arch'],
  i: [['arch', 0.78]],
  j: [['arch', 0.7], 'tail'],
  k: ['stem', 'knot'],
  l: ['stem'],
  m: ['arch', 'arch', 'arch'],
  n: ['arch', 'arch'],
  o: ['bowl'],
  p: ['arch', 'drop'],
  q: ['bowl', 'drop'],
  r: ['shoulder'],
  s: ['curl'],
  t: ['post', 'bar'],
  u: ['trough', 'trough'],
  v: ['wedge'],
  w: ['wedge', 'wedge'],
  x: ['arch', 'cross'],
  y: ['trough', 'tail'],
  z: ['zig', 'tail'],
};

/**
 * Write a phrase as one continuous stroke. Returns points in em units with y
 * measured up from the baseline, and the total advance.
 */
export function writePhrase(text) {
  const pts = [{ x: 0, y: 0 }];
  let x = 0;

  for (const ch of String(text).toLowerCase()) {
    if (ch === ' ') {
      quad(pts, { x: x + 0.22, y: -0.05 }, { x: x + 0.44, y: 0 }, 4);
      x += 0.44;
      continue;
    }
    const recipe = LETTERS[ch];
    if (!recipe) continue;

    // The joining stroke up out of the line and into the letter.
    quad(pts, { x: x + 0.08, y: 0.22 }, { x: x + 0.1, y: 0.06 }, 3);
    x += 0.1;
    for (const step of recipe) {
      const [name, scale] = Array.isArray(step) ? step : [step, 1];
      x += STROKE[name](pts, x, scale);
    }
    if (Math.abs(at(pts).y) > 0.001) quad(pts, { x: x + 0.06, y: 0.08 }, { x: x + 0.1, y: 0 }, 3);
    x = Math.max(x, at(pts).x) + 0.06;
  }
  return { points: pts, width: Math.max(x, 0.001) };
}
