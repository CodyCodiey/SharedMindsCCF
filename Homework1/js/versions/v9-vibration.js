import { createThoughts } from '../shared/thoughts.js';
import { writePhrase } from '../shared/cursive.js';

export const meta = {
  id: 'vibration',
  title: '9 · Vibration',
  blurb: 'A field of vibrating strings. The thought being spoken is written out of the middle line in one unbroken stroke, then settles back among the others.',
};

const C = {
  lines: 19,
  margin: 46,
  samples: 132,          // points per line of plain vibration
  minGap: 1.6,           // no closer than this on screen: below a pixel is waste
  modes: 4,
  modeMin: 11,           // high mode numbers: a string, not a swell
  modeMax: 42,           // kept under what the sampling can actually show
  amp: 9,
  ampFalloff: 0.6,
  rate: 0.0042,          // fast enough to read as vibration
  tremor: 0.22,          // fine unresolved shiver on top
  tremorRate: 0.031,

  emMax: 52,             // px per em when a thought is short
  emMin: 11,
  emBack: 0.62,          // background thoughts, relative to their size
  fit: 0.86,             // fraction of the line a thought may fill

  riseEase: 0.1,
  fallEase: 0.03,
  backLevel: 0.5,        // how far a settled thought stays resolved
  holdMs: 34000,         // it stays legible in the field this long
  fadeMs: 9000,
  keep: 5,               // thoughts held in the background at once
  quiet: 0.85,           // how still the line goes where writing appears
};

export function create() {
  let size = { w: 0, h: 0 };
  let lines = [];
  let live = [];         // thoughts in the field
  let active = null;     // the one being spoken
  let ghostText = '';

  const thoughts = createThoughts({
    min: 8, max: 26, pauseMs: 2200,
    onWords(tokens) {
      if (!active) active = begin();
      for (const tk of tokens) active.words.push(tk.text);
      active.text = active.words.join(' ');
      active.path = null;         // rebuilt on the next draw
    },
    onEnd({ t }) { settle(t); },
  });

  const centre = () => (lines.length - 1) >> 1;

  function build() {
    lines = [];
    const usable = size.h - C.margin * 2;
    for (let i = 0; i < C.lines; i++) {
      const t = C.lines === 1 ? 0.5 : i / (C.lines - 1);
      const off = Math.abs(t - 0.5) * 2;
      lines.push({
        y: C.margin + usable * t,
        modes: normalize(Array.from({ length: C.modes }, () => ({
          n: C.modeMin + Math.floor(Math.random() * (C.modeMax - C.modeMin)),
          amp: 0.35 + Math.random() * 0.8,
          rate: 0.55 + Math.random() * 1.9,
          phase: Math.random() * Math.PI * 2,
        }))),
        amp: C.amp * (1 - off * C.ampFalloff),
        weight: 1 - off * 0.5,
        seed: Math.random() * 100,
      });
    }
  }

  /** Share one line's swing out among its modes, so adding modes makes the
   *  vibration busier rather than wider. */
  function normalize(modes) {
    const total = modes.reduce((sum, m) => sum + m.amp, 0) || 1;
    for (const m of modes) m.amp /= total;
    return modes;
  }

  /**
   * A vibrating string: fixed ends, many modes, fast — plus a fine tremor so
   * it never resolves into a smooth swell.
   */
  function vibration(line, x, now) {
    const u = (x - C.margin) / Math.max(1, size.w - C.margin * 2);
    let sum = 0;
    for (const m of line.modes) {
      sum += m.amp * Math.sin(Math.PI * m.n * u)
        * Math.cos(now * C.rate * m.rate + m.phase);
    }
    const shiver = Math.sin(u * 220 + now * C.tremorRate + line.seed)
      * Math.sin(u * 91 - now * C.tremorRate * 0.7)
      * C.tremor;
    return (sum + shiver) * line.amp;
  }

  function begin() {
    const thought = {
      words: [], text: '', path: null,
      line: centre(), m: 0, target: 1,
      state: 'writing', at: 0, alpha: 1,
      back: false,
    };
    live.push(thought);
    return thought;
  }

  /** The thought is finished: it settles back among the other strings. */
  function settle(now) {
    if (!active) return;
    const thought = active;
    active = null;
    thought.state = 'settled';
    thought.back = true;
    thought.at = now;
    thought.target = C.backLevel;

    // Take a line away from the middle, alternating up and down the field.
    const taken = new Set(live.filter((t) => t !== thought && t.back).map((t) => t.line));
    const order = [];
    for (let d = 2; d < lines.length; d++) {
      order.push(centre() - d, centre() + d);
    }
    thought.line = order.find((i) => i >= 0 && i < lines.length && !taken.has(i))
      ?? (Math.random() < 0.5 ? 0 : lines.length - 1);

    const settled = live.filter((t) => t.back);
    if (settled.length > C.keep) settled[0].state = 'fading';
  }

  /** Cursive is generated once per thought and reused until its text grows. */
  function pathOf(thought) {
    if (!thought.path) thought.path = writePhrase(thought.text);
    return thought.path;
  }

  function emOf(thought) {
    const path = pathOf(thought);
    const room = (size.w - C.margin * 2) * C.fit;
    let em = Math.min(C.emMax, room / Math.max(path.width, 0.4));
    if (thought.back) em *= C.emBack;
    return Math.max(C.emMin, em);
  }

  return {
    resize(ctx, w, h) { size = { w, h }; build(); },
    words(ctx, list, t) { thoughts.add(list, t); ghostText = ''; },

    tick(now) {
      thoughts.tick(now);
      for (let i = live.length - 1; i >= 0; i--) {
        const thought = live[i];
        const ease = thought.target > thought.m ? C.riseEase : C.fallEase;
        thought.m += (thought.target - thought.m) * ease;

        if (thought.state === 'settled' && now - thought.at > C.holdMs) {
          thought.state = 'fading';
          thought.at = now;
        }
        if (thought.state === 'fading') {
          const k = Math.min(1, (now - thought.at) / C.fadeMs);
          thought.alpha = 1 - k;
          thought.target = C.backLevel * (1 - k);
          // Fully faded, it is just vibration again.
          if (k >= 1) live.splice(i, 1);
        }
      }
    },

    draw(ctx, now) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      lines.forEach((line, index) => {
        const here = live.filter((t) => t.line === index && t.m > 0.004);
        drawLine(ctx, line, index, here, now);
      });
    },

    ghost(text) {
      ghostText = text || '';
      if (active && ghostText) {
        // Interim speech rides on the end of the thought being written.
        const shown = `${active.words.join(' ')} ${ghostText}`.trim();
        if (shown !== active.text) { active.text = shown; active.path = null; }
      }
    },

    reset() {
      thoughts.reset();
      live = []; active = null; ghostText = '';
      build();
    },
  };

  /**
   * One unbroken stroke per line: it vibrates in from the left, writes
   * whatever thought lives here, and vibrates away to the right. At full the
   * writing stands clear; at nothing the letters lie flat and the line is
   * only a vibrating string again.
   */
  function drawLine(ctx, line, index, here, now) {
    const left = C.margin;
    const right = size.w - C.margin;
    const thought = here[0];
    const centred = index === centre();

    let startX = right;
    let endX = right;
    let path = null;
    let em = 0;
    if (thought) {
      path = pathOf(thought);
      em = emOf(thought);
      const width = path.width * em;
      startX = Math.max(left, (size.w - width) / 2);
      endX = Math.min(right, startX + width);
    }

    const step = (right - left) / C.samples;
    const points = [];

    for (let x = left; x < startX; x += step) {
      points.push({ x, y: line.y + vibration(line, x, now) });
    }

    if (thought) {
      const m = Math.min(1, thought.m);
      const eased = m * m * (3 - 2 * m);
      // The letters shiver until they are fully resolved.
      const jitter = (1 - eased) * line.amp * 0.5;
      const still = 1 - eased * C.quiet;
      const gap2 = C.minGap * C.minGap;

      // The line's vibration is sampled coarsely across the writing and
      // interpolated: letters should ride the string, not be speckled by it.
      const span = Math.max(1, endX - startX);
      const taps = Math.max(2, Math.ceil(span / 26));
      const tap = [];
      for (let k = 0; k <= taps; k++) {
        const x = startX + (span * k) / taps;
        tap.push(vibration(line, x < right ? x : right, now) * still);
      }
      let lastX = -1e9;
      let lastY = -1e9;
      const pts = path.points;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const x = startX + p.x * em;
        const f = ((x - startX) / span) * taps;
        const k = Math.min(taps - 1, Math.max(0, Math.floor(f)));
        const ride = tap[k] + (tap[k + 1] - tap[k]) * (f - k);
        const y = line.y + ride
          - p.y * em * eased
          + (jitter
            ? Math.sin(p.x * 37 + now * C.tremorRate * 1.6 + line.seed) * jitter
            : 0);
        // Points closer together than a pixel cost the same to draw and
        // show nothing, so only keep the ones that move the pen.
        const dx = x - lastX;
        const dy = y - lastY;
        if (i !== pts.length - 1 && dx * dx + dy * dy < gap2) continue;
        points.push({ x, y });
        lastX = x;
        lastY = y;
      }
    }

    for (let x = endX; x <= right; x += step) {
      points.push({ x, y: line.y + vibration(line, x, now) });
    }

    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);

    const ink = thought ? thought.alpha : 1;
    ctx.strokeStyle = `rgba(0, 0, 0, ${(0.1 + line.weight * (centred ? 0.55 : 0.3)) * ink})`;
    ctx.lineWidth = centred ? 1.2 : 0.8;
    ctx.stroke();
  }
}
