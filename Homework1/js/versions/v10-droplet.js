import { createThoughts } from '../shared/thoughts.js';
import { writePhrase, HAND } from '../shared/cursive.js';

export const meta = {
  id: 'droplet',
  title: '10 · Droplet',
  blurb: 'A thought falls into a pool. Its ripples carry the words outward; what it reminds you of falls in beside it.',
};

const C = {
  // The pool
  centre: { x: 0.5, y: 0.52 },
  ripples: 7,            // rings a droplet sends out
  rippleInk: 0.4,        // how dark a new ring is
  maxRings: 260,
  rippleSpeed: 0.016,    // pixels a millisecond
  wobble: 0,           // how far a ring departs from a circle
  wobbleModes: 3,
  wobbleRate: 0.0005,
  margin: 60,
  samples: 220,          // points around a ring

  // The hand
  em: 30,
  letterHeight: 0.56,
  letterWidth: 0.72,
  letterSpacing: 0.09,
  wordGap: 1,
  ascender: 0.8,
  descender: 1.1,
  roundness: 0.74,

  // The ring a sentence is written on
  minRadius: 120,
  fill: 0.78,            // how much of the ring the words may take up
  growEase: 0.022,
  gapPad: 0.05,          // clear angle either side of the writing, in radians

  // Taking shape
  formMs: 1600,
  floatRise: 1.7,        // how far a piece of ring lifts on its way to being a letter
  coilStagger: 0.8,
  minGap: 1.15,

  // Ending
  maxWords: 20,
  pauseMs: 700,
  leaveMs: 3200,
  leaveStagger: 0.75,
  burstSpeed: 0.05,      // how fast the ring runs outward as it goes

  // What falls in beside it
  recallGapMs: 1300,
  recallWords: 2,
  recallEcho: 3,
  burstEveryMs: 7500,
  burstChance: 0,        // nothing comes back unless a word calls it
  contentWeight: 1.4,    // what a word that means something adds
  echoWeight: 2.2,       // what a word said before adds again
  chargeMax: 42,         // the most a thought may carry
  afterRippleMs: 620,    // how often it goes on ringing once said
  dropSpread: 0.22,      // how far from the middle a thought may land
  connotation: 0.72,     // how many of a word's pasts return at once
  maxDroplets: 7,        // the most a single word may throw
  smallDrop: 0.62,       // a lesser droplet, against the size of the main one
  spreadSpeed: 0.016,    // how fast one goes on opening out after it lands
  spreadTo: 1.1,         // how much larger its writing grows as it spreads
  turnEase: 0.03,        // how gently the ring turns as a sentence lengthens
};

export const CONTROLS = [
  { key: 'em', label: 'How big the handwriting is', min: 12, max: 60, step: 1, group: 'The hand' },
  { key: 'letterHeight', label: 'Letter height, against their width', min: 0.3, max: 1.2, step: 0.02, shape: true, group: 'The hand' },
  { key: 'letterWidth', label: 'Letter width', min: 0.4, max: 1.6, step: 0.02, shape: true, group: 'The hand' },
  { key: 'letterSpacing', label: 'Space between letters', min: 0, max: 0.5, step: 0.01, shape: true, group: 'The hand' },
  { key: 'wordGap', label: 'Space between words', min: 0.1, max: 1.6, step: 0.02, shape: true, group: 'The hand' },
  { key: 'roundness', label: 'How roundly the pen turns corners', min: 0.2, max: 1.9, step: 0.02, shape: true, group: 'The hand' },

  { key: 'minRadius', label: 'How wide the first ring is', min: 40, max: 400, step: 5, group: 'The pool' },
  { key: 'fill', label: 'How far round a ring the words may run', min: 0.2, max: 1, step: 0.02, group: 'The pool' },
  { key: 'ripples', label: 'How many rings a droplet sends out', min: 1, max: 14, step: 1, group: 'The pool' },
  { key: 'rippleSpeed', label: 'How fast they travel', min: 0.01, max: 0.2, step: 0.005, group: 'The pool' },
  { key: 'rippleInk', label: 'How dark a new ripple is', min: 0.05, max: 1, step: 0.05, group: 'The pool' },
  { key: 'wobble', label: 'How far a ring departs from a circle', min: 0, max: 20, step: 0.2, group: 'The pool' },

  { key: 'formMs', label: 'How long one word takes to take shape', min: 200, max: 3000, step: 50, group: 'Taking shape' },
  { key: 'floatRise', label: 'How far a piece lifts off its ring', min: 0, max: 4, step: 0.05, group: 'Taking shape' },
  { key: 'coilStagger', label: 'How far a word’s tail lags its head', min: 0, max: 2, step: 0.05, group: 'Taking shape' },
  { key: 'turnEase', label: 'How gently the ring turns as words are added', min: 0.01, max: 0.4, step: 0.01, group: 'Taking shape' },
  { key: 'growEase', label: 'How quickly the ring opens out', min: 0.01, max: 0.3, step: 0.01, group: 'Taking shape' },

  { key: 'maxWords', label: 'How many words before a sentence breaks off', min: 4, max: 40, step: 1, thought: true, group: 'Ending a sentence' },
  { key: 'pauseMs', label: 'Silence that ends a sentence', min: 300, max: 4000, step: 50, thought: true, group: 'Ending a sentence' },
  { key: 'leaveMs', label: 'How long a finished sentence takes to unwrite', min: 500, max: 6000, step: 100, group: 'Ending a sentence' },
  { key: 'leaveStagger', label: 'How far the head leads on the way out', min: 0, max: 2, step: 0.05, group: 'Ending a sentence' },
  { key: 'burstSpeed', label: 'How fast the ring runs outward as it goes', min: 0, max: 0.6, step: 0.01, group: 'Ending a sentence' },

  { key: 'contentWeight', label: 'What a word that means something adds', min: 0, max: 4, step: 0.1, group: 'The pool' },
  { key: 'echoWeight', label: 'What a word said before adds again', min: 0, max: 5, step: 0.1, group: 'The pool' },
  { key: 'afterRippleMs', label: 'How often a thought goes on ringing', min: 150, max: 3000, step: 50, group: 'The pool' },
  { key: 'chargeMax', label: 'The most a thought may carry', min: 4, max: 120, step: 2, group: 'The pool' },
  { key: 'dropSpread', label: 'How far from the middle a thought may land', min: 0, max: 0.5, step: 0.01, group: 'The pool' },
  { key: 'connotation', label: 'How many of a word’s pasts return at once', min: 0, max: 1.4, step: 0.02, group: 'Coming back' },
  { key: 'maxDroplets', label: 'The most a single word may throw', min: 1, max: 20, step: 1, group: 'Coming back' },
  { key: 'smallDrop', label: 'Size of a droplet that falls in beside it', min: 0.2, max: 1.2, step: 0.02, group: 'Coming back' },
  { key: 'spreadSpeed', label: 'How fast a returning droplet spreads', min: 0.005, max: 0.2, step: 0.005, group: 'Coming back' },
  { key: 'spreadTo', label: 'How much larger its words grow', min: 0, max: 3, step: 0.1, group: 'Coming back' },
  { key: 'recallGapMs', label: 'Least time between two droplets', min: 400, max: 8000, step: 100, group: 'Coming back' },
  { key: 'burstEveryMs', label: 'How often one falls unprompted', min: 1500, max: 30000, step: 500, group: 'Coming back' },
];

export function create() {
  let size = { w: 0, h: 0 };
  let drops = [];        // everything written on the pool
  let rings = [];        // the plain rings spreading out
  let active = null;
  let history = [];
  let occurrences = new Map();
  let nextRecall = 0;
  let nextBurst = 0;
  let ghostText = '';

  const thoughts = createThoughts({
    min: 5, max: 10, threshold: 0.13,
    maxWords: C.maxWords, pauseMs: C.pauseMs, breakOnHedge: true,
    onWords(tokens, index, t) {
      if (!active) active = begin(t);
      for (const tk of tokens) active.words.push(tk.text);
      active.text = active.words.join(' ');
      active.path = null;
    },
    onClose({ t }) { release(t); },
  });

  const pool = () => ({ x: size.w * C.centre.x, y: size.h * C.centre.y });

  /** How far a ring must reach from here before none of it is on screen. */
  function reachOf(at) {
    return Math.max(
      Math.hypot(at.x, at.y),
      Math.hypot(size.w - at.x, at.y),
      Math.hypot(at.x, size.h - at.y),
      Math.hypot(size.w - at.x, size.h - at.y)
    );
  }

  function begin(now) {
    const centre = pool();
    const reach = Math.min(size.w, size.h) * C.dropSpread;
    const angle = Math.random() * Math.PI * 2;
    const away = reach * Math.sqrt(Math.random());
    const drop = {
      words: [], text: '', path: null, wordAt: [],
      at: {
        x: Math.max(C.margin, Math.min(size.w - C.margin, centre.x + Math.cos(angle) * away)),
        y: Math.max(C.margin, Math.min(size.h - C.margin, centre.y + Math.sin(angle) * away)),
      },
      scale: 1, baseScale: 1, main: true,
      radius: C.minRadius, want: C.minRadius,
      m: 0, taut: 0, alpha: 1, state: 'writing',
      bornAt: now, since: now,
      seed: Math.random() * 100,
    };
    drops.push(drop);
    splash(drop, now);
    return drop;
  }

  /** A droplet lands: rings start travelling out from where it fell. */
  /**
   * Where a word sits on its ring. Each word is its own nucleus: what
   * ripples, ripples from there rather than from the middle of the thought.
   */
  function wordCentre(drop, index) {
    const path = pathOf(drop);
    const wr = path.wordRange && path.wordRange[index];
    if (!wr) return drop.at;
    const pts = path.points;
    const mid = (pts[wr.from].x + pts[wr.to].x) / 2;
    const em = drop.em ?? C.em * drop.baseScale;
    const R = Math.max(1, drop.radius);
    const span = (path.width * em) / R;
    const from = drop.from ?? (-Math.PI / 2 - span / 2);
    const a = from + (mid * em) / R;
    return { x: drop.at.x + Math.cos(a) * R, y: drop.at.y + Math.sin(a) * R };
  }

  function splashAt(at, now, scale, seed) {
    rings.push({ at, r: 4, born: now, scale, seed });
    if (rings.length > C.maxRings) rings.splice(0, rings.length - C.maxRings);
  }

  function splash(drop, now) {
    rings.push({ at: drop.at, r: 4, born: now, scale: drop.scale, seed: drop.seed });
    if (rings.length > C.maxRings) rings.splice(0, rings.length - C.maxRings);
  }

  function release(now) {
    const drop = active;
    active = null;
    if (!drop) return;
    // Nothing to do but let it go: it has been riding outward since it
    // landed, and simply carries on.
    drop.spreading = true;
  }

  /**
   * Something said before falls in beside the thought that called it back —
   * a smaller droplet, somewhere else on the pool.
   */
  function remember(token, now) {
    const seen = occurrences.get(token.key);
    if (!seen || seen.length < 2 || now < nextRecall) return;

    // The more often a word has been said, the more of its pasts come back
    // at once: a loaded word throws a scatter of droplets, each carrying a
    // different company it once kept.
    const earlier = seen.slice(0, -1);
    const many = Math.max(1, Math.min(
      C.maxDroplets,
      Math.round(Math.pow(earlier.length, C.connotation))
    ));

    const pool = earlier.slice();
    for (let k = 0; k < many && pool.length; k++) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      surface(pick, now, active);
    }
    nextRecall = now + C.recallGapMs;
  }

  function surface(index, now, source) {
    const from = Math.max(0, index - C.recallWords);
    const to = Math.min(history.length, index + C.recallWords + 1);
    const text = history.slice(from, to).map((tk) => tk.text).join(' ');
    if (!text) return;

    const centre = pool();
    const angle = Math.random() * Math.PI * 2;
    const away = C.minRadius * (1.9 + Math.random() * 1.5);
    const drop = {
      words: text.split(' '), text, path: null, wordAt: [],
      at: {
        x: Math.max(80, Math.min(size.w - 80, centre.x + Math.cos(angle) * away)),
        y: Math.max(80, Math.min(size.h - 80, centre.y + Math.sin(angle) * away)),
      },
      scale: C.smallDrop, baseScale: C.smallDrop, main: false,
      radius: C.minRadius * C.smallDrop, want: C.minRadius * C.smallDrop,
      m: 0, taut: 0, alpha: 1, state: 'writing',
      bornAt: now, since: now, source, until: 0,
      focusWord: index - from,
      seed: Math.random() * 100,
    };
    drops.push(drop);
    splash(drop, now);
  }

  function useHand() {
    HAND.xHeight = C.letterHeight;
    HAND.width = C.letterWidth;
    HAND.spacing = C.letterSpacing;
    HAND.wordGap = C.wordGap;
    HAND.ascender = C.ascender;
    HAND.descender = C.descender;
    HAND.roundness = C.roundness;
  }

  function pathOf(drop) {
    if (!drop.path) {
      useHand();
      drop.path = writePhrase(drop.text);
      const pts = drop.path.points;
      const run = new Array(pts.length);
      let total = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        run[i] = total;
      }
      drop.path.run = run;

      const marks = [];
      const words = [];
      pts.forEach((p, i) => {
        const m = marks[p.s] || (marks[p.s] = { from: i, to: i, x0: p.x, x1: p.x });
        m.to = i; m.x0 = Math.min(m.x0, p.x); m.x1 = Math.max(m.x1, p.x);
        const w = words[p.w] || (words[p.w] = { from: i, to: i });
        w.to = i;
      });
      drop.path.markRange = marks;
      drop.path.wordRange = words;
    }
    return drop.path;
  }

  /** A ring is not a circle: it carries the same wobble the water would. */
  function wobbleAt(seed, angle, r, now) {
    let sum = 0;
    for (let k = 1; k <= C.wobbleModes; k++) {
      sum += Math.sin(angle * (k * 2 + 1) + seed + now * C.wobbleRate * k) / k;
    }
    return sum * C.wobble;
  }

  return {
    config: C,
    set(key, value) {
      C[key] = value;
      const spec = CONTROLS.find((c) => c.key === key);
      if (spec && spec.thought) thoughts.configure({ [key]: value });
      for (const d of drops) if (spec && spec.shape) d.path = null;
    },

    resize(ctx, w, h) {
      size = { w, h };
      for (const d of drops) if (d.main) d.at = pool();
    },

    words(ctx, list, t) {
      const tokens = thoughts.add(list, t);
      ghostText = '';
      for (const token of tokens) {
        // Every word said is a thing falling in the water, and every word
        // adds to what the thought is carrying: a word that means something
        // weighs more than a word that only joins, and one that has been
        // said before weighs more again.
        if (active) {
          active.toSplash = (active.toSplash || []);
          active.toSplash.push(active.words.length - 1);
          const seenBefore = token.content && (occurrences.get(token.key) || []).length;
          active.charge = (active.charge || 0)
            + 1
            + (token.content ? C.contentWeight : 0)
            + (seenBefore ? C.echoWeight : 0);
          active.charge = Math.min(active.charge, C.chargeMax);
        }
        history.push(token);
        if (!token.content) continue;
        let seen = occurrences.get(token.key);
        if (!seen) occurrences.set(token.key, (seen = []));
        seen.push(history.length - 1);
        remember(token, t);
      }
    },

    ghost(text) {
      ghostText = text || '';
      if (active && ghostText) {
        const shown = `${active.words.join(' ')} ${ghostText}`.trim();
        if (shown !== active.text) { active.text = shown; active.path = null; }
      }
    },

    tick(now) {
      thoughts.tick(now);

      if (now > nextBurst) {
        nextBurst = now + C.burstEveryMs * (0.5 + Math.random());
        if (history.length > 6 && Math.random() < C.burstChance && now > nextRecall) {
          surface(Math.floor(Math.random() * history.length), now, null);
        }
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.r = (now - ring.born) * C.rippleSpeed + 4;
        // It keeps going until there is none of it left to see, rather than
        // dimming away in front of us.
        if (ring.r > reachOf(ring.at)) rings.splice(i, 1);
      }
      if (rings.length > C.ripples * 8) rings.splice(0, rings.length - C.ripples * 8);

      // Every word said sends a bare ripple out from the droplet it belongs
      // to — the same waves the writing rides on, without any writing.
      for (const drop of drops) {
        if (!drop.toSplash || !drop.toSplash.length) continue;
        for (let k = 0; k < drop.toSplash.length; k++) {
          splashAt(drop.at, now, drop.baseScale, drop.seed);
        }
        drop.toSplash = [];
      }

      // What a thought is carrying goes on ringing after it has been said:
      // a loaded one troubles the water for a long time, a slight one is
      // finished almost as soon as it lands. It rings from its words, not
      // from its middle.
      for (const drop of drops) {
        if (!(drop.charge > 0)) continue;
        if (now < (drop.nextRing ?? 0)) continue;
        drop.nextRing = now + C.afterRippleMs;
        const words = Math.max(1, drop.words.length);
        splashAt(drop.at, now, drop.baseScale, drop.seed);
        drop.charge -= 1;
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.m += ((drop.state === 'leaving' ? 1 : 1) - drop.m) * 0.1;

        // The ring opens out to hold what has been said on it.
        const path = pathOf(drop);

        // The ring a sentence is written on is one of its own ripples: it
        // leaves the droplet when the thought lands and keeps travelling,
        // and the words ride outward on it.
        const start = C.minRadius * drop.baseScale;
        drop.radius = start + (now - drop.bornAt) * C.rippleSpeed;
        const R = drop.radius;

        // Riding out, the writing grows with the water under it. It is not
        // squeezed to fit: a word waits until the ring is wide enough to
        // carry it, and appears when it is.
        const opened = 1 + Math.min(C.spreadTo, (R - start) / Math.max(1, start));
        drop.em = C.em * drop.baseScale * opened;
        drop.scale = drop.em / Math.max(0.001, C.em);
        drop.alpha = 1;

        if (R > reachOf(drop.at) + drop.em * 2) drops.splice(i, 1);
      }
    },

    draw(ctx, now) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // The pool: rings spreading from everything that has fallen in.
      // Every ring is drawn alike: they do not dim as they widen, they
      // simply carry on until they have left the screen.
      ctx.beginPath();
      for (const ring of rings) addRing(ctx, ring.at, ring.r, ring.seed, now, null);
      ctx.strokeStyle = `rgba(0, 0, 0, ${C.rippleInk})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();

      for (const drop of drops) drawDrop(ctx, drop, now);
    },

    reset() {
      thoughts.reset();
      drops = []; rings = []; history = []; occurrences = new Map();
      active = null; ghostText = ''; nextRecall = 0; nextBurst = 0;
    },
  };

  /** One ring of the pool, wobbling, optionally broken over a span of angle. */
  function addRing(ctx, at, r, seed, now, hole) {
    // A real canvas throws on a radius that is negative or not a number,
    // and one throw in the drawing loop used to end the animation for good.
    if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
    if (hole && (!Number.isFinite(hole[0]) || !Number.isFinite(hole[1]))) hole = null;
    // With no wobble asked for, these are true circles — drawn as arcs
    // rather than as a great many short straight pieces.
    if (C.wobble === 0) {
      if (!hole) {
        ctx.moveTo(at.x + r, at.y);
        ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      } else {
        const a0 = hole[1];
        const a1 = hole[0] + Math.PI * 2;
        ctx.moveTo(at.x + Math.cos(a0) * r, at.y + Math.sin(a0) * r);
        ctx.arc(at.x, at.y, r, a0, a1);
      }
      return;
    }

    let started = false;
    for (let i = 0; i <= C.samples; i++) {
      const a = (i / C.samples) * Math.PI * 2 - Math.PI / 2;
      if (hole && a > hole[0] && a < hole[1]) { started = false; continue; }
      const rr = r + wobbleAt(seed, a, r, now);
      const x = at.x + Math.cos(a) * rr;
      const y = at.y + Math.sin(a) * rr;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
  }

  /** A droplet: the ring it wrote on, and the words standing off it. */
  function drawDrop(ctx, drop, now) {
    const path = pathOf(drop);
    const em = drop.em ?? C.em * drop.baseScale;
    const R = drop.radius;

    // How much of the writing this ring can carry yet. Anything past it is
    // waiting for the water to widen.
    const carried = Math.min(path.width, (Math.PI * 2 * R * C.fill) / Math.max(1, em));
    const span = (carried * em) / Math.max(1, R);
    // Where the sentence begins on the ring is eased: a word arriving
    // lengthens the writing, and without this the whole ring swung round to
    // recentre it in a single frame.
    const wantFrom = -Math.PI / 2 - span / 2;
    if (drop.from === undefined) drop.from = wantFrom;
    drop.from += (wantFrom - drop.from) * C.turnEase;
    const from = drop.from;
    const ink = drop.alpha;

    // Its own ring, broken where the words are.
    ctx.beginPath();
    addRing(ctx, drop.at, R, drop.seed, now,
      [from - C.gapPad, from + span + C.gapPad]);
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 * ink})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    if (!Number.isFinite(R) || R <= 0) return;

    const pts = path.points;
    const run = path.run;
    const gap2 = C.minGap * C.minGap;
    while (drop.wordAt.length < (path.words || 1)) drop.wordAt.push(now);

    ctx.beginPath();
    let mark = [];
    let current = -1;
    let lastX = -1e9;
    let lastY = -1e9;
    let any = false;
    const flush = () => {
      if (mark.length > 1) { addCurve(ctx, mark); any = true; }
      mark = [];
    };

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x > carried) break;      // not yet borne up by the ring
      if (p.s !== current) { flush(); current = p.s; lastX = -1e9; lastY = -1e9; }

      const born = drop.wordAt[p.w] ?? now;
      const age = (now - born) / C.formMs;
      const grown = age <= 0 ? 0 : age >= 1 ? 1 : age * age * (3 - 2 * age);

      const wr = path.wordRange[p.w] || { from: 0, to: pts.length - 1 };
      const u = wr.to > wr.from ? (i - wr.from) / (wr.to - wr.from) : 1;
      const pulled = Math.max(0, Math.min(1, grown * (1 + C.coilStagger) - u * C.coilStagger));

      // Leaving runs the way the writing ran: the head returns first.
      const across = path.width > 0 ? p.x / path.width : 1;
      const taut = Math.max(0, Math.min(1,
        drop.taut * (1 + C.leaveStagger) - across * C.leaveStagger));
      if (taut >= 0.995) { flush(); lastX = -1e9; lastY = -1e9; continue; }

      const lm = pulled * (1 - taut);

      // Along the ring, and out from it.
      const a = from + (p.x * em) / Math.max(1, R);
      const lift = grown > 0.001 && grown < 0.999 && taut < 0.001
        ? Math.sin(Math.PI * Math.pow(grown, 0.45)) * C.floatRise * em
        : 0;
      const rr = R + wobbleAt(drop.seed, a, R, now) + p.y * em * lm + lift;
      const px = drop.at.x + Math.cos(a) * rr;
      const py = drop.at.y + Math.sin(a) * rr;

      const dx = px - lastX;
      const dy = py - lastY;
      if (i !== pts.length - 1 && dx * dx + dy * dy < gap2) continue;
      mark.push({ x: px, y: py });
      lastX = px;
      lastY = py;
    }
    flush();

    if (any) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.85 * ink})`;
      ctx.lineWidth = drop.main ? 1.7 : 1.3;
      ctx.stroke();
    }
  }
}

function addCurve(ctx, pts) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const next = pts[i + 1];
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + next.x) / 2, (pts[i].y + next.y) / 2);
  }
  const end = pts[pts.length - 1];
  const before = pts[pts.length - 2];
  ctx.quadraticCurveTo(before.x, before.y, end.x, end.y);
}
