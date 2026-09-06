import { createThoughts } from '../shared/thoughts.js';
import { writePhrase, canWrite } from '../shared/cursive.js';
import { isJapanese } from '../shared/lexicon.js';

export const meta = {
  id: 'vibration',
  title: '9 · Vibration',
  blurb: 'A field of vibrating strings. The thought being spoken is written out of the middle line in one unbroken stroke, then settles back among the others.',
};

const C = {
  lines: 19,
  margin: 46,
  samples: 132,          // points per line of plain vibration
  minGap: 1.15,          // no closer than this on screen: below a pixel is waste
  modes: 4,
  modeMin: 11,           // high mode numbers: a string, not a swell
  modeMax: 42,           // kept under what the sampling can actually show
  amp: 9,
  ampFalloff: 0.6,
  rate: 0.0042,          // fast enough to read as vibration
  tremor: 0.22,          // fine unresolved shiver on top
  tremorRate: 0.031,

  em: 44,                // px per em: a fixed, readable hand
  emBack: 0.62,          // background thoughts, relative to their size
  fit: 0.92,             // fraction of the line a thought may fill
  maxRows: 5,            // lines a single thought may run over
  emMin: 15,             // ...and if it still will not fit, it shrinks to this

  // The generated hand only knows the latin alphabet. Anything else is
  // written in a face instead, still rising out of the line it sits on.
  brushFont: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
  slant: 0.17,           // a hand writes on the lean, but not so far it hurts
  formMs: 1100,          // how long one word takes to find its shape
  wiggle: 0.42,          // how far it loops about before it settles
  wiggleRate: 0.006,
  slideEase: 0.12,       // how the writing glides left as more arrives
  slideStep: 11,         // ...and never further than this in one frame
  recallDim: 0.5,        // how much less formed a recall's other words are
  tautPull: 1.06,        // a leaving string is drawn slightly longer as it straightens
  riseEase: 0.1,
  fallEase: 0.03,
  backLevel: 0.5,        // how far a settled thought stays resolved
  holdMs: 34000,         // it stays legible in the field this long
  fadeMs: 9000,
  keep: 5,               // thoughts held in the background at once

  // Nothing said is ever discarded: it drops into a latent space and comes
  // back when the sentence being spoken reaches for the same words.
  recallGapMs: 2200,     // the least time between two things resurfacing
  recallWords: 2,        // words either side of the earlier occurrence
  recallLevel: 0.72,     // recalls are legible, but only for a moment
  recallHoldMs: 1900,
  recallFadeMs: 1100,
  recallRise: 0.16,      // they arrive quickly, the way a stray thought does

  // Some things surface for no reason at all.
  burstEveryMs: 7500,
  burstChance: 0.55,

  // A settled thought does not dissolve into the wave; it comes into and out
  // of legibility, swelling and retreating.
  swellPeriodMs: 15000,
  swellFloor: 0.16,      // faintest it gets
  swellPeak: 0.88,       // clearest it gets
  backLevelSwing: 0.1,   // its letters barely change height while it does

  // A thought gathers presence as it grows.
  growWords: 14,         // words by which it is at full weight
  growFloor: 0.55,
  quiet: 0.93,           // how still the line goes where writing appears
};

export function create() {
  let size = { w: 0, h: 0 };
  let lines = [];
  let live = [];         // what is legible in the field right now
  let history = [];      // every word ever spoken, in order, never discarded
  let occurrences = new Map();   // word -> everywhere it has been said
  let active = null;     // the thought being spoken
  let ghostText = '';
  let nextRecall = 0;
  let nextBurst = 0;

  const thoughts = createThoughts({
    min: 5, max: 10, maxWords: 16, pauseMs: 1500, threshold: 0.13,
    onWords(tokens) {
      if (!active) active = begin();
      for (const tk of tokens) active.words.push(tk.text);
      active.text = active.words.join(' ');
      active.path = null;         // rebuilt on the next draw
      active.rows = null;
      active.em = 0;
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
      words: [], text: '', path: null, wordAt: [],
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
    thought.swellPhase = Math.random() * Math.PI * 2;

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

  /**
   * Every word is tied to every other place it has been said. When one comes
   * round again, the text either side of an earlier time it was spoken
   * surfaces in the background — the same word, in the company it kept
   * before — and wiggles itself into shape there.
   */
  function remember(token, now) {
    const seen = occurrences.get(token.key);
    if (!seen || seen.length < 2) return;
    if (now < nextRecall) return;

    // Any earlier time it was said, other than this one.
    const earlier = seen.slice(0, -1);
    const at = earlier[Math.floor(Math.random() * earlier.length)];
    const found = around(at);
    if (!found || !found.text) return;

    const line = freeLine();
    if (line === null) return;

    surface(found, line, now);
  }

  /** Put a fragment on a background line, briefly. */
  function surface({ text, focus }, line, now) {
    nextRecall = now + C.recallGapMs;
    live.push({
      words: text.split(' '), text, path: null, wordAt: [], focusWord: focus,
      line, m: 0, target: C.recallLevel,
      state: 'recalled', at: now, alpha: 1, glow: 1, back: true,
      swellPhase: Math.random() * Math.PI * 2,
    });
  }

  /**
   * Nothing said is only ever reached for on purpose. From time to time the
   * background throws something up unprompted.
   */
  function burst(now) {
    if (history.length < 6) return null;
    const at = Math.floor(Math.random() * history.length);
    const found = around(at);
    if (!found || !found.text) return null;
    const line = freeLine();
    if (line === null) return null;
    surface(found, line, now);
    return found.text;
  }

  /** The words either side of one occurrence, as they were said. */
  function around(index) {
    const from = Math.max(0, index - C.recallWords);
    const to = Math.min(history.length, index + C.recallWords + 1);
    const words = history.slice(from, to).map((tk) => tk.text);
    // Japanese sets without spaces between its words.
    return {
      text: words.join(words.some((w) => isJapanese(w)) ? '' : ' '),
      focus: index - from,
    };
  }

  /** A line away from the middle that nothing is currently written on. */
  function freeLine() {
    const taken = new Set(live.map((t) => t.line));
    const order = [];
    for (let d = 2; d < lines.length; d++) order.push(centre() - d, centre() + d);
    const open = order.filter((i) => i >= 0 && i < lines.length && !taken.has(i));
    return open.length ? open[Math.floor(Math.random() * open.length)] : null;
  }

  /** Cursive is generated once per thought and reused until its text grows. */
  function pathOf(thought) {
    if (!thought.path) {
      thought.drawn = canWrite(thought.text);
      thought.path = thought.drawn
        ? writePhrase(thought.text)
        : { points: [], width: 0.001, words: thought.text.split(/\s+/).length };

      // How far along the stroke each point lies. A word pulled straight
      // spaces its points by this, so the loops unfurl rather than collapse.
      const pts = thought.path.points;
      const run = new Array(pts.length);
      let total = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        run[i] = total;
      }
      thought.path.run = run;
    }
    return thought.path;
  }

  /** Rows for text written in a face: broken between words by measured width. */
  function brushRows(ctx, thought) {
    const em = emOf(thought);
    ctx.font = `${em}px ${C.brushFont}`;
    const room = (size.w - C.margin * 2) * C.fit;
    const rows = [];
    let row = null;
    let index = 0;

    const parts = thought.text.includes(' ')
      ? thought.text.split(/\s+/)
      : [...thought.text];      // unspaced script: set it character by character
    for (const word of parts) {
      if (!word) { index++; continue; }
      const w = ctx.measureText(word).width;
      const space = ctx.measureText(' ').width;
      if (row && row.width + space + w > room) { rows.push(row); row = null; }
      if (!row) row = { words: [], width: 0 };
      row.words.push({ text: word, w, at: row.width + (row.words.length ? space : 0), index });
      row.width += w + (row.words.length > 1 ? space : 0);
      index++;
    }
    if (row) rows.push(row);
    return rows;
  }

  function emOf(thought) {
    return thought.em || (thought.back ? C.em * C.emBack : C.em);
  }

  /** Break a stroke between words at whatever width it is given. */
  function wrapAt(path, limit) {
    const pts = path.points;
    const spans = [];
    for (let i = 0; i < pts.length; i++) {
      const w = pts[i].w ?? 0;
      const span = spans[w] || (spans[w] = { from: i, to: i, x0: pts[i].x, x1: pts[i].x });
      span.to = i;
      span.x1 = Math.max(span.x1, pts[i].x);
    }
    const rows = [];
    let row = null;
    for (const span of spans) {
      if (!span) continue;
      if (row && span.x1 - row.x0 > limit) { rows.push(row); row = null; }
      if (!row) row = { from: span.from, to: span.to, x0: span.x0, x1: span.x1 };
      else { row.to = span.to; row.x1 = span.x1; }
    }
    if (row) rows.push(row);
    return rows;
  }

  /**
   * A thought too long for one string carries on down the next, broken
   * between words. If it will not fit even then, the hand gets smaller
   * rather than the sentence getting cut off.
   */
  function rowsOf(thought) {
    const ideal = thought.back ? C.em * C.emBack : C.em;
    if (thought.rows && thought.rowsAt === size.w && thought.rowsIdeal === ideal) {
      return thought.rows;
    }
    const path = pathOf(thought);
    if (!thought.drawn) return thought.rows || [];
    const room = (size.w - C.margin * 2) * C.fit;

    let em = ideal;
    let rows = wrapAt(path, room / em);
    while (rows.length > C.maxRows && em > C.emMin) {
      em = Math.max(C.emMin, em * 0.88);
      rows = wrapAt(path, room / em);
    }

    thought.em = em;
    thought.rows = rows;
    thought.rowsAt = size.w;
    thought.rowsIdeal = ideal;
    return rows;
  }

  return {
    resize(ctx, w, h) { size = { w, h }; build(); },
    words(ctx, list, t) {
      const tokens = thoughts.add(list, t);
      ghostText = '';
      // Tie each word to everywhere it has been said before, and let one of
      // those earlier moments come back.
      for (const token of tokens) {
        history.push(token);
        if (!token.content) continue;
        const key = token.key;
        let seen = occurrences.get(key);
        if (!seen) occurrences.set(key, (seen = []));
        seen.push(history.length - 1);
        remember(token, t);
      }
    },

    tick(now) {
      thoughts.tick(now);

      // Something surfaces unbidden every so often.
      if (now > nextBurst) {
        nextBurst = now + C.burstEveryMs * (0.5 + Math.random());
        if (Math.random() < C.burstChance && now > nextRecall) burst(now);
      }

      for (let i = live.length - 1; i >= 0; i--) {
        const thought = live[i];
        const rise = thought.state === 'recalled' ? C.recallRise : C.riseEase;
        const ease = thought.target > thought.m ? rise : C.fallEase;
        thought.m += (thought.target - thought.m) * ease;

        // Background writing swells into legibility and retreats again: it is
        // the ink that comes and goes, not the shape of the letters.
        if (thought.back && thought.state !== 'sinking') {
          const swell = 0.5 + 0.5 * Math.sin(
            (now / C.swellPeriodMs) * Math.PI * 2 + (thought.swellPhase || 0)
          );
          thought.glow = C.swellFloor + (C.swellPeak - C.swellFloor) * swell;
          if (thought.state === 'settled') {
            thought.target = C.backLevel + C.backLevelSwing * (swell - 0.5);
          }
        } else if (!thought.back) {
          // A thought gathers weight as it accumulates.
          const grown = Math.min(1, thought.words.length / C.growWords);
          thought.glow = C.growFloor + (1 - C.growFloor) * grown;
        }

        if (thought.state === 'settled' && now - thought.at > C.holdMs) {
          thought.state = 'fading';
          thought.at = now;
        }
        if (thought.state === 'recalled' && now - thought.at > C.recallHoldMs) {
          thought.state = 'sinking';
          thought.at = now;
        }
        if (thought.state === 'sinking') {
          const k = Math.min(1, (now - thought.at) / C.recallFadeMs);
          thought.taut = k;
          thought.target = C.recallLevel * (1 - k);
          thought.glow = (thought.glow ?? 1) * (1 - k * 0.6);
          thought.alpha = 1 - k * 0.85;
          // It goes back to being latent, not gone.
          if (k >= 1) live.splice(i, 1);
        }
        if (thought.state === 'fading') {
          const k = Math.min(1, (now - thought.at) / C.fadeMs);
          thought.taut = k;
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

      for (const t of live) {
        pathOf(t);
        if (!t.drawn && (!t.rows || t.rowsAt !== size.w)) {
          t.rows = brushRows(ctx, t);
          t.rowsAt = size.w;
          t.em = emOf(t);
        }
      }

      lines.forEach((line, index) => {
        // Whichever thought has a row on this string writes it here.
        let thought = null;
        let row = null;
        for (const t of live) {
          if (t.m <= 0.004) continue;
          const rows = t.drawn ? rowsOf(t) : (t.rows || []);
          const which = index - t.line;
          if (which >= 0 && which < rows.length) { thought = t; row = rows[which]; break; }
        }
        drawLine(ctx, line, index, thought, row, now);
      });
    },

    ghost(text) {
      ghostText = text || '';
      if (active && ghostText) {
        // Interim speech rides on the end of the thought being written.
        const shown = `${active.words.join(' ')} ${ghostText}`.trim();
        if (shown !== active.text) { active.text = shown; active.path = null; active.rows = null; active.em = 0; }
      }
    },

    reset() {
      thoughts.reset();
      live = []; history = []; occurrences = new Map();
      active = null; ghostText = ''; nextRecall = 0; nextBurst = 0;
      build();
    },
  };

  /**
   * One unbroken stroke per line: it vibrates in from the left, writes
   * whatever thought lives here, and vibrates away to the right. At full the
   * writing stands clear; at nothing the letters lie flat and the line is
   * only a vibrating string again.
   */
  function drawLine(ctx, line, index, thought, row, now) {
    const left = C.margin;
    const right = size.w - C.margin;
    const centred = index === centre();

    let startX = right;
    let endX = right;
    let path = null;
    let em = 0;
    if (thought) {
      path = pathOf(thought);
      em = emOf(thought);
      const width = thought.drawn ? (row.x1 - row.x0) * em : row.width;
      const rowIndex = index - thought.line;

      // Every row ends at the right margin and grows leftward, so the hand
      // writes toward a fixed edge and the line slides left to make room
      // rather than the whole row shuffling about to stay centred. A row
      // whose width changes as the thought wraps re-settles smoothly.
      thought.sx = thought.sx || [];
      const target = Math.max(left, right - width);
      const held = thought.sx[rowIndex];
      if (held === undefined) {
        thought.sx[rowIndex] = target;
      } else {
        // Capped, so even a wrap that changes a row's width all at once is
        // travelled rather than jumped.
        const move = (target - held) * C.slideEase;
        const capped = Math.max(-C.slideStep, Math.min(C.slideStep, move));
        thought.sx[rowIndex] = held + capped;
      }

      startX = thought.sx[rowIndex];
      endX = Math.min(right, startX + width);
    }

    const step = (right - left) / C.samples;
    const points = [];
    const brushed = [];

    for (let x = left; x < startX; x += step) {
      points.push({ x, y: line.y + vibration(line, x, now) });
    }

    if (thought && !thought.drawn) {
      // A face, not the generated hand: the line runs quietly beneath while
      // the words rise out of it.
      const m = Math.min(1, thought.m);
      const eased = m * m * (3 - 2 * m);
      const still = 1 - eased * C.quiet;
      for (let x = startX; x <= endX; x += (endX - startX) / 8 || 1) {
        points.push({ x, y: line.y + vibration(line, x, now) * still });
      }
      brushed.push({ thought, row, line, startX, eased, now });
    } else if (thought) {
      const m = Math.min(1, thought.m);
      const eased = m * m * (3 - 2 * m);
      // The letters shiver until they are fully resolved.
      const jitter = (1 - eased) * line.amp * 0.5;
      const still = 1 - eased * C.quiet;
      const gap2 = C.minGap * C.minGap;

      // Leaving, a word is a string pulled tight from both ends: its loops
      // unfurl, its points spread evenly along their own length, and the
      // whole of it draws straight onto the line it was written on.
      const taut = thought.taut || 0;
      const run = path.run;
      const runFrom = run ? run[row.from] : 0;
      const runLen = run ? Math.max(1e-6, run[row.to] - runFrom) : 1;
      const tautWidth = (row.x1 - row.x0) * em * C.tautPull;

      // Words that have only just arrived have no birthday yet; they get
      // this moment, and start finding their shape from here.
      while (thought.wordAt.length < (path.words || 1)) thought.wordAt.push(now);

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

      for (let i = row.from; i <= row.to; i++) {
        const p = pts[i];

        // Each word finds its own shape in its own time, so the phrase
        // writes itself along rather than appearing all at once.
        const born = thought.wordAt[p.w] ?? now;
        const age = (now - born) / C.formMs;
        const grown = age <= 0 ? 0 : age >= 1 ? 1 : age * age * (3 - 2 * age);
        // In something recalled, only the word that reached back is fully
        // formed; the company it kept stays half-resolved around it.
        const dim = thought.focusWord === undefined || thought.focusWord === p.w
          ? 1 : C.recallDim;
        const lm = grown * eased * dim;
        const loose = 1 - lm;

        // Until it is formed the stroke loops about the place it is heading,
        // and the lean of the hand comes in with the height of the letter.
        const swing = loose * C.wiggle * em;
        const phase = now * C.wiggleRate + p.x * 5.5 + line.seed;
        const x = startX + ((p.x - row.x0) + p.y * lm * C.slant) * em
          + Math.cos(phase) * swing;

        const f = ((x - startX) / span) * taps;
        const k = Math.min(taps - 1, Math.max(0, Math.floor(f)));
        const ride = tap[k] + (tap[k + 1] - tap[k]) * (f - k);
        const y = line.y + ride
          - p.y * em * lm
          + Math.sin(phase * 1.3) * swing * 0.7
          + (jitter ? Math.sin(p.x * 37 + now * C.tremorRate * 1.6) * jitter * loose : 0);

        let px = x;
        let py = y;
        if (taut > 0 && run) {
          const along = (run[i] - runFrom) / runLen;
          px = x + (startX + along * tautWidth - x) * taut;
          py = y + (line.y + ride - y) * taut;
        }

        // Points closer together than a pixel cost the same to draw and
        // show nothing, so only keep the ones that move the pen.
        const dx = px - lastX;
        const dy = py - lastY;
        if (i !== row.to && dx * dx + dy * dy < gap2) continue;
        points.push({ x: px, y: py });
        lastX = px;
        lastY = py;
      }
    }

    for (let x = endX; x <= right; x += step) {
      points.push({ x, y: line.y + vibration(line, x, now) });
    }

    if (points.length < 2) return;
    curve(ctx, points);

    // Ink follows meaning: a line carrying writing is drawn as writing,
    // heavier and darker than a line that is only vibrating.
    const ink = thought ? thought.alpha * (thought.glow ?? 1) : 1;
    const written = Boolean(thought) && thought.m > 0.1;
    const weight = 0.1 + line.weight * (centred ? 0.55 : 0.3);
    ctx.strokeStyle = `rgba(0, 0, 0, ${(written ? Math.min(0.92, weight + 0.34) : weight) * ink})`;
    ctx.lineWidth = written
      ? (centred ? 1.9 : 1.3) * (0.6 + 0.4 * (thought.glow ?? 1))
      : (centred ? 1.1 : 0.75);
    ctx.stroke();

    for (const b of brushed) drawBrush(ctx, b);
  }

  /**
   * Words set in a face, each rising out of the line in its own time — the
   * same emergence as the written hand, for scripts it cannot draw.
   */
  function drawBrush(ctx, { thought, row, line, startX, eased, now }) {
    const em = emOf(thought);
    ctx.font = `${em}px ${C.brushFont}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    while (thought.wordAt.length < row.words[row.words.length - 1].index + 1) {
      thought.wordAt.push(now);
    }

    for (const word of row.words) {
      const born = thought.wordAt[word.index] ?? now;
      const age = (now - born) / C.formMs;
      const grown = age <= 0 ? 0 : age >= 1 ? 1 : age * age * (3 - 2 * age);
      const lm = Math.max(0.02, grown * eased);
      const loose = 1 - lm;
      const swing = loose * C.wiggle * em;
      const phase = now * C.wiggleRate + word.at * 0.04 + line.seed;

      ctx.save();
      ctx.translate(
        startX + word.at + Math.cos(phase) * swing,
        line.y + vibration(line, startX + word.at, now) * (1 - eased * C.quiet)
          + Math.sin(phase * 1.3) * swing * 0.7
      );
      ctx.scale(1, lm);
      ctx.lineWidth = 1.1 / Math.max(lm, 0.12);
      ctx.strokeStyle = `rgba(0, 0, 0, ${(0.3 + lm * 0.6) * thought.alpha})`;
      ctx.strokeText(word.text, 0, em * 0.34);
      ctx.restore();
    }
  }
}

/**
 * Run a curve through the points rather than joining them with facets: the
 * pen never turns a corner, so sparse points still read as handwriting.
 */
function curve(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const next = pts[i + 1];
    ctx.quadraticCurveTo(
      pts[i].x, pts[i].y,
      (pts[i].x + next.x) / 2, (pts[i].y + next.y) / 2
    );
  }
  const end = pts[pts.length - 1];
  const before = pts[pts.length - 2];
  ctx.quadraticCurveTo(before.x, before.y, end.x, end.y);
}
