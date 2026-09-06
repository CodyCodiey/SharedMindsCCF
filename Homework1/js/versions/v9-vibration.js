import { createThoughts } from '../shared/thoughts.js';
import { writePhrase, HAND } from '../shared/cursive.js';

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
  amp: 40,
  ampFalloff: 0.6,
  rate: 0.0095,          // fast enough to read as vibration
  tremor: 0.14,          // fine unresolved shiver on top
  tremorRate: 0.031,
  tremorPace: 0.55,      // how much faster speech shakes the strings
  paceWindowMs: 2600,    // the stretch of talk the pace is taken over

  em: 65,                // px per em: a fixed, readable hand

  // The shape of the hand itself.
  letterHeight: 0.56,    // x-height against the width of the letters
  letterWidth: 0.72,
  letterSpacing: 0.09,
  wordGap: 1,
  ascender: 0.8,
  descender: 1.1,
  roundness: 0.74,

  emBack: 0.82,          // a fragment brought back, against the hand size
  fit: 0.92,             // fraction of the line a thought may fill
  maxRows: 5,            // lines a single thought may run over
  emMin: 15,             // ...and if it still will not fit, it shrinks to this

  slant: 0.34,           // a hand writes on the lean, but not so far it hurts
  formMs: 800,          // how long one word takes to find its shape
  wiggle: 0.55,          // how far it loops about before it settles
  wiggleRate: 0.018,
  wiggleSpread: 1.25,    // cycles of swing per em along the stroke
  slideEase: 0.08,       // how the writing glides left as more arrives
  slideStep: 5,          // ...and never further than this in one frame
  recallDim: 0.5,        // how much less formed a recall's other words are
  // A word arrives wound up and unwinds into its letters, the way a ball of
  // yarn is pulled out into a thread.
  gapPad: 26,            // clear space either side of the writing
  coilRadius: 0.2,         // winding added on top of the chunk, if wanted
  coilTurns: 0.8,
  coilStagger: 0.8,      // the head of the word lands before its tail
  tautPull: 1.06,        // a leaving string is drawn slightly longer as it straightens
  settleEase: 0.055,     // how a thought travels to the string it settles on
  riseEase: 0.1,
  fallEase: 0.03,
  backLevel: 0.5,        // how far a settled thought stays resolved
  leaveMs: 2600,         // how long a finished thought takes to unwrite
  leaveStagger: 0.75,    // how far the right end leads the left on the way out

  // Nothing said is ever discarded: it drops into a latent space and comes
  // back when the sentence being spoken reaches for the same words.
  recallGapMs: 1300,     // the least time between two things resurfacing
  recallWords: 2,        // words either side of the earlier occurrence
  recallLevel: 0.72,     // recalls are legible, but only for a moment
  recallHoldMs: 1900,   // for something that surfaced unprompted
  recallEcho: 3,        // how much longer a linked one stays after its thought goes
  recallFadeMs: 1100,
  recallRise: 0.16,      // they arrive quickly, the way a stray thought does

  // Where one thought ends. These live here so the panel can reach them.
  maxWords: 40,          // words said before a thought is cut off
  pauseMs: 700,         // silence long enough to end one

  // Some things surface for no reason at all.
  burstEveryMs: 7500,
  burstChance: 0.55,

  // A settled thought does not dissolve into the wave; it comes into and out
  // of legibility, swelling and retreating.
  swellPeriodMs: 26500,
  swellFloor: 0.16,      // faintest it gets
  swellPeak: 0.88,       // clearest it gets
  backLevelSwing: 0.1,   // its letters barely change height while it does

  // A thought gathers presence as it grows.
  growWords: 14,         // words by which it is at full weight
  growFloor: 0.55,
  quiet: 0.18,           // how still the line goes where writing appears
};

// What is worth reaching for while it is running.
export const CONTROLS = [
  { key: 'em', label: 'hand size', min: 16, max: 80, step: 1 },
  { key: 'letterHeight', label: 'letter height', min: 0.4, max: 1.4, step: 0.02, shape: true },
  { key: 'letterWidth', label: 'letter width', min: 0.6, max: 1.8, step: 0.02, shape: true },
  { key: 'letterSpacing', label: 'letter spacing', min: 0, max: 0.5, step: 0.01, shape: true },
  { key: 'wordGap', label: 'word spacing', min: 0.1, max: 1.4, step: 0.02, shape: true },
  { key: 'ascender', label: 'ascender reach', min: 0.3, max: 1.8, step: 0.02, shape: true },
  { key: 'descender', label: 'descender drop', min: 0.3, max: 1.8, step: 0.02, shape: true },
  { key: 'roundness', label: 'roundness', min: 0.2, max: 1.9, step: 0.02, shape: true },
  { key: 'slant', label: 'lean', min: 0, max: 0.5, step: 0.01 },
  { key: 'formMs', label: 'time to form a word', min: 200, max: 3000, step: 50 },
  { key: 'gapPad', label: 'gap around the writing', min: 0, max: 80, step: 2 },
  { key: 'coilRadius', label: 'winding', min: 0, max: 3, step: 0.05 },
  { key: 'coilTurns', label: 'winds in the ball', min: 0, max: 6, step: 0.1 },
  { key: 'coilStagger', label: 'unravel stagger', min: 0, max: 2, step: 0.05 },
  { key: 'wiggle', label: 'wiggle', min: 0, max: 1.2, step: 0.02 },
  { key: 'wiggleSpread', label: 'wiggle along the stroke', min: 0.1, max: 4, step: 0.05 },
  { key: 'wiggleRate', label: 'wiggle speed', min: 0.001, max: 0.03, step: 0.001 },
  { key: 'amp', label: 'vibration', min: 0, max: 40, step: 0.5 },
  { key: 'rate', label: 'vibration speed', min: 0.0005, max: 0.02, step: 0.0005 },
  { key: 'tremor', label: 'tremor', min: 0, max: 1.5, step: 0.02 },
  { key: 'tremorPace', label: 'tremor from speaking pace', min: 0, max: 3, step: 0.05 },
  { key: 'emBack', label: 'size of a recalled fragment', min: 0.3, max: 1.2, step: 0.02 },
  { key: 'quiet', label: 'stillness under writing', min: 0, max: 1, step: 0.02 },
  { key: 'maxWords', label: 'words per thought', min: 4, max: 40, step: 1, thought: true },
  { key: 'pauseMs', label: 'silence that ends a thought', min: 400, max: 5000, step: 100, thought: true },
  { key: 'leaveMs', label: 'time to unwrite', min: 600, max: 8000, step: 100 },
  { key: 'leaveStagger', label: 'right-to-left lead', min: 0, max: 2, step: 0.05 },
  { key: 'swellPeriodMs', label: 'swell of the background', min: 3000, max: 40000, step: 500 },
  { key: 'recallGapMs', label: 'gap between recalls', min: 500, max: 10000, step: 100 },
  { key: 'recallEcho', label: 'how long a link lingers', min: 0, max: 6, step: 0.25 },
  { key: 'burstEveryMs', label: 'time between bursts', min: 1500, max: 30000, step: 500 },
  { key: 'lines', label: 'strings', min: 5, max: 41, step: 2, rebuild: true },
  { key: 'slideStep', label: 'glide speed', min: 1, max: 30, step: 1 },
];

export function create() {
  let size = { w: 0, h: 0 };
  let lines = [];
  let live = [];         // what is legible in the field right now
  let history = [];      // every word ever spoken, in order, never discarded
  let occurrences = new Map();   // word -> everywhere it has been said
  let active = null;     // the thought being spoken
  let ghostText = '';
  let nextRecall = 0;
  let spoken = [];       // when the recent words arrived
  let pace = 0;          // words a second, eased
  let nextBurst = 0;

  const thoughts = createThoughts({
    min: 5, max: 10, threshold: 0.13,
    maxWords: C.maxWords, pauseMs: C.pauseMs,
    onWords(tokens, index, t) {
      if (!active) active = begin(t);
      for (const tk of tokens) active.words.push(tk.text);
      active.text = active.words.join(' ');
      active.path = null;         // rebuilt on the next draw
      active.rows = null;
      active.em = 0;
    },
    // A thought too slight to be named still finishes and settles back.
    onClose({ t }) { leave(t); },
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
      * C.tremor * (1 + C.tremorPace * pace);
    return (sum + shiver) * line.amp;
  }

  function begin(now) {
    const thought = {
      bornAt: now,
      words: [], text: '', path: null, wordAt: [],
      line: centre(), m: 0, target: 1,
      state: 'writing', at: 0, alpha: 1,
      back: false,
    };
    live.push(thought);
    return thought;
  }

  /**
   * The thought is finished. It does not move anywhere else on the screen —
   * it unwrites itself back into the string it came out of, from the right
   * end leftward, leaving the line clear for the next one.
   */
  function leave(now) {
    const thought = active;
    active = null;
    if (!thought) return;
    thought.state = 'leaving';
    thought.at = now;
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

    surface(found, line, now, active);
  }

  /** Put a fragment on a background line, briefly. */
  function surface({ text, focus }, line, now, source) {
    nextRecall = now + C.recallGapMs;
    live.push({
      words: text.split(' '), text, path: null, wordAt: [], focusWord: focus,
      line, m: 0, target: C.recallLevel,
      state: 'recalled', at: now, alpha: 1, glow: 1, back: true,
      // What called it back, so it can stay while that thought is on screen.
      source, until: 0,
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
    return { text: words.join(' '), focus: index - from };
  }

  /** A line away from the middle that nothing is currently written on. */
  function freeLine() {
    const taken = new Set(live.map((t) => t.line));
    const order = [];
    for (let d = 2; d < lines.length; d++) order.push(centre() - d, centre() + d);
    const open = order.filter((i) => i >= 0 && i < lines.length && !taken.has(i));
    return open.length ? open[Math.floor(Math.random() * open.length)] : null;
  }

  /** Set the hand to the current shape before anything is written with it. */
  function useHand() {
    HAND.xHeight = C.letterHeight;
    HAND.width = C.letterWidth;
    HAND.spacing = C.letterSpacing;
    HAND.wordGap = C.wordGap;
    HAND.ascender = C.ascender;
    HAND.descender = C.descender;
    HAND.roundness = C.roundness;
  }

  /** Cursive is generated once per thought and reused until its text grows. */
  function pathOf(thought) {
    if (!thought.path) {
      useHand();
      thought.path = writePhrase(thought.text);

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

      // Where each word begins and ends along the stroke, so it can be
      // wound into a ball and unwound again as one thing.
      const range = [];
      pts.forEach((p, i) => {
        const w = p.w ?? 0;
        const r = range[w] || (range[w] = { from: i, to: i, x0: p.x, x1: p.x });
        r.to = i;
        r.x0 = Math.min(r.x0, p.x);
        r.x1 = Math.max(r.x1, p.x);
      });
      thought.path.wordRange = range;

      // And where each mark begins and ends: the piece of line that breaks
      // off and becomes it.
      const marks = [];
      pts.forEach((p, i) => {
        const k = p.s ?? 0;
        const m = marks[k] || (marks[k] = { from: i, to: i, x0: p.x, x1: p.x });
        m.to = i;
        m.x0 = Math.min(m.x0, p.x);
        m.x1 = Math.max(m.x1, p.x);
      });
      thought.path.markRange = marks;
    }
    return thought.path;
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
    /** The knobs above, live: changing one takes effect on the next frame. */
    config: C,
    set(key, value) {
      C[key] = value;
      const spec = CONTROLS.find((c) => c.key === key);
      if (spec && spec.rebuild) build();
      if (spec && spec.thought) thoughts.configure({ [key]: value });
      // Reshaping the hand means everything on screen must be written again.
      for (const t of live) {
        if (spec && spec.shape) t.path = null;
        t.rows = null;
        t.rowsAt = -1;
        t.em = 0;
      }
    },
    resize(ctx, w, h) { size = { w, h }; build(); },
    words(ctx, list, t) {
      const tokens = thoughts.add(list, t);
      for (const _ of tokens) spoken.push(t);
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

      // How fast the words are coming. The strings shake harder the faster
      // they arrive, and settle again when the speaking does.
      while (spoken.length && now - spoken[0] > C.paceWindowMs) spoken.shift();
      const perSecond = spoken.length / (C.paceWindowMs / 1000);
      pace += (perSecond - pace) * 0.08;

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

        // A resurfaced fragment swells into legibility and retreats again:
        // it is the ink that comes and goes, not the shape of the letters.
        if (thought.back && thought.state !== 'sinking') {
          const swell = 0.5 + 0.5 * Math.sin(
            (now / C.swellPeriodMs) * Math.PI * 2 + (thought.swellPhase || 0)
          );
          thought.glow = C.swellFloor + (C.swellPeak - C.swellFloor) * swell;
        } else if (!thought.back) {
          // A thought gathers weight as it accumulates.
          const grown = Math.min(1, thought.words.length / C.growWords);
          thought.glow = C.growFloor + (1 - C.growFloor) * grown;
        }

        if (thought.state === 'leaving') {
          const k = Math.min(1, (now - thought.at) / C.leaveMs);
          thought.taut = k;
          // Once it has gone back into the line there is nothing left of it.
          if (k >= 1) {
            // Remember when it went, so anything it called back knows how
            // long it was here.
            thought.goneAt = now;
            live.splice(i, 1);
            continue;
          }
        }
        if (thought.state === 'recalled') {
          const src = thought.source;
          if (src && !src.goneAt) {
            // The word that called it back is still on the screen, so it
            // stays: the two are visibly holding on to each other.
            thought.until = 0;
          } else {
            // Once that thought has gone, it lingers about twice as long
            // again before letting go.
            const life = src ? Math.max(600, src.goneAt - src.bornAt) : C.recallHoldMs;
            if (!thought.until) {
              thought.until = (src ? src.goneAt : thought.at) + life * C.recallEcho;
            }
            if (now > thought.until) { thought.state = 'sinking'; thought.at = now; }
          }
        }
        if (thought.state === 'sinking') {
          const k = Math.min(1, (now - thought.at) / C.recallFadeMs);
          thought.taut = k;
          thought.target = C.recallLevel * (1 - k);
          thought.glow = (thought.glow ?? 1) * (1 - k * 0.6);
          thought.alpha = 1 - k * 0.85;
          if (k >= 1) live.splice(i, 1);
        }
      }
    },

    draw(ctx, now) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const t of live) pathOf(t);

      // Where everything sits this frame, so the strings know what to leave
      // room for before they are drawn.
      const placed = place(now);
      lines.forEach((line, index) => drawString(ctx, line, index, placed, now));
      for (const p of placed) drawWriting(ctx, p, now);
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
      live = []; history = []; occurrences = new Map(); spoken = []; pace = 0;
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
  function spacing() {
    return (size.h - C.margin * 2) / Math.max(1, C.lines - 1);
  }

  /** The string nearest a given height, for its vibration and its seed. */
  function lineAt(y) {
    let best = lines[0];
    for (const line of lines) {
      if (Math.abs(line.y - y) < Math.abs(best.y - y)) best = line;
    }
    return best;
  }

  /**
   * Ease every thought toward where it belongs rather than putting it there:
   * a thought settling into the background travels to its new string and
   * shrinks on the way, instead of arriving already moved.
   */
  function place(now) {
    const out = [];
    const gapH = spacing();

    for (const thought of live) {
      if (thought.m <= 0.004) continue;
      const rows = rowsOf(thought);
      if (!rows.length) continue;

      const wantY = (lines[thought.line] || lines[0]).y;
      const wantEm = emOf(thought);
      if (thought.yNow === undefined) { thought.yNow = wantY; thought.emNow = wantEm; }
      thought.yNow += (wantY - thought.yNow) * C.settleEase;
      thought.emNow += (wantEm - thought.emNow) * C.settleEase;

      rows.forEach((row, rowIndex) => {
        const em = thought.emNow;
        const width = (row.x1 - row.x0) * em;
        const y = thought.yNow + rowIndex * gapH;

        thought.sx = thought.sx || [];
        const held = thought.sx[rowIndex];
        const target = C.margin;
        thought.sx[rowIndex] = held === undefined
          ? target
          : held + Math.max(-C.slideStep, Math.min(C.slideStep, (target - held) * C.slideEase));

        const m = Math.min(1, thought.m);
        out.push({
          thought, row, rowIndex, em, y,
          line: lineAt(y),
          startX: thought.sx[rowIndex],
          width,
          eased: m * m * (3 - 2 * m),
        });
      });
    }
    return out;
  }

  /**
   * A string, broken wherever something is written on it. The break opens
   * from the middle of the writing outward as the words form, so the line
   * parts rather than snapping in two.
   */
  function drawString(ctx, line, index, placed, now) {
    const left = C.margin;
    const right = size.w - C.margin;
    const centred = index === centre();
    const near = placed.filter((p) => Math.abs(p.y - line.y) < spacing() * 0.55);

    const holes = near.map((p) => {
      const centreX = p.startX + p.width / 2;
      const half = (p.width / 2 + C.gapPad) * p.eased;
      return [centreX - half, centreX + half];
    }).filter(([a, b]) => b - a > 1);

    const step = (right - left) / C.samples;
    const runs = [];
    let strung = [];
    for (let x = left; x <= right; x += step) {
      if (holes.some(([a, b]) => x > a && x < b)) {
        if (strung.length > 1) runs.push(strung);
        strung = [];
        continue;
      }
      strung.push({ x, y: line.y + vibration(line, x, now) });
    }
    if (strung.length > 1) runs.push(strung);

    if (!runs.length) return;
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.1 + line.weight * (centred ? 0.5 : 0.28)})`;
    ctx.lineWidth = centred ? 1.1 : 0.75;
    ctx.beginPath();
    for (const piece of runs) addCurve(ctx, piece);
    ctx.stroke();
  }

  function drawWriting(ctx, placement, now) {
    const { thought, row, em, y, line, startX, eased } = placement;
    const right = size.w - C.margin;
    const endX = Math.min(right, startX + placement.width);
    const centred = Math.abs(y - lines[centre()].y) < spacing() * 0.5;
    const path = pathOf(thought);

    // The string itself, running the whole width and going still under
    // whatever is written on it.

    // The writing: each letter its own mark, rising out of the string.
    const pts = path.points;
    const run = path.run;
    const runFrom = run ? run[row.from] : 0;
    const runLen = run ? Math.max(1e-6, run[row.to] - runFrom) : 1;
    const leaving = thought.taut || 0;
    const tautWidth = (row.x1 - row.x0) * em * C.tautPull;
    const gap2 = C.minGap * C.minGap;

    while (thought.wordAt.length < (path.words || 1)) thought.wordAt.push(now);

    // The line's own movement, sampled coarsely across the writing so the
    // letters ride it instead of being speckled by it.
    const span = Math.max(1, endX - startX);
    const taps = Math.max(2, Math.ceil(span / 26));
    const tap = [];
    for (let k = 0; k <= taps; k++) {
      const x = startX + (span * k) / taps;
      tap.push(vibration(line, x < right ? x : right, now));
    }

    // Dissolving, the letters flatten onto the string and the gaps between
    // them are drawn back in, fading up as they go: the line closes rather
    // than snapping shut.
    const joins = [];
    let prevEnd = null;
    let opening = false;
    let letter = [];
    let current = -1;
    let lastX = -1e9;
    let lastY = -1e9;
    const ink = thought.alpha * (thought.glow ?? 1);

    // Every mark of this thought shares one colour and one weight, so they
    // are gathered into a single path and stroked once.
    ctx.beginPath();
    let anyMark = false;
    const flush = () => {
      if (letter.length > 1) { addCurve(ctx, letter); anyMark = true; }
      letter = [];
    };

    for (let i = row.from; i <= row.to; i++) {
      const p = pts[i];
      if (p.s !== current) {
        flush();
        lastX = -1e9;
        lastY = -1e9;
        current = p.s;
        opening = true;
      }

      const born = thought.wordAt[p.w] ?? now;
      const age = (now - born) / C.formMs;
      const grown = age <= 0 ? 0 : age >= 1 ? 1 : age * age * (3 - 2 * age);
      const dim = thought.focusWord === undefined || thought.focusWord === p.w
        ? 1 : C.recallDim;

      // How far along its own word this point lies, and how much of the
      // word has been pulled straight by now: the head lands first.
      const wr = (path.wordRange && path.wordRange[p.w]) || { from: row.from, to: row.to, x0: 0, x1: 1 };
      // Unwriting runs along the row: the right-hand end goes back into the
      // line first and the rest follows leftward.
      const across = row.x1 > row.x0 ? (p.x - row.x0) / (row.x1 - row.x0) : 1;
      const taut = Math.max(0, Math.min(1,
        leaving * (1 + C.leaveStagger) - (1 - across) * C.leaveStagger));
      const u = wr.to > wr.from ? (i - wr.from) / (wr.to - wr.from) : 1;
      const pulled = Math.max(0, Math.min(1,
        grown * (1 + C.coilStagger) - u * C.coilStagger));
      const lm = pulled * eased * dim * (1 - taut);
      const loose = 1 - lm;

      const swing = loose * C.wiggle * em;
      const phase = now * C.wiggleRate + p.x * C.wiggleSpread + line.seed;
      const x = startX + ((p.x - row.x0) + p.y * lm * C.slant) * em
        + Math.cos(phase) * swing;

      const f = ((x - startX) / span) * taps;
      const k = Math.min(taps - 1, Math.max(0, Math.floor(f)));
      const ride = tap[k] + (tap[k + 1] - tap[k]) * (f - k);
      const py0 = y + ride - p.y * em * lm + Math.sin(phase * 1.3) * swing * 0.7;

      let px = x;
      let py = py0;

      // Before it is a letter it is a piece of the line: a straight chunk
      // lying where the letter will be, which breaks off and curls up into
      // the shape. Winding can be added on top of that.
      if (lm < 0.999) {
        const mr = (path.markRange && path.markRange[p.s]) || wr;
        const runFromMark = run ? run[mr.from] : 0;
        const markLen = run ? Math.max(1e-6, run[mr.to] - runFromMark) : 1;
        const along = run ? (run[i] - runFromMark) / markLen : 0;
        const chunkWidth = (mr.x1 - mr.x0) * em;
        let flatX = startX + (mr.x0 - row.x0) * em + along * chunkWidth;
        let flatY = y + ride;

        if (C.coilRadius > 0) {
          const angle = u * C.coilTurns * Math.PI * 2 + now * 0.0004 + line.seed;
          const radius = C.coilRadius * em * u;
          flatX += Math.cos(angle) * radius;
          flatY += Math.sin(angle) * radius * 0.55;
        }

        px = flatX + (px - flatX) * lm;
        py = flatY + (py - flatY) * lm;
      }

      if (taut > 0 && run) {
        const along = (run[i] - runFrom) / runLen;
        px = x + (startX + along * tautWidth - x) * taut;
        py = py0 + (y + ride - py0) * taut;
      }

      const dx = px - lastX;
      const dy = py - lastY;
      if (i !== row.to && dx * dx + dy * dy < gap2) continue;

      if (opening) {
        if (prevEnd && taut > 0.01) joins.push([prevEnd, { x: px, y: py }]);
        opening = false;
      }
      letter.push({ x: px, y: py });
      prevEnd = { x: px, y: py };
      lastX = px;
      lastY = py;
    }
    flush();
    if (anyMark) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.92, 0.5 + line.weight * 0.4) * ink})`;
      ctx.lineWidth = (centred ? 1.9 : 1.4) * (0.6 + 0.4 * (thought.glow ?? 1));
      ctx.stroke();
    }

    // The joins come in with the dissolve, so the marks knit back together.
    if (joins.length && leaving > 0.01) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.92, 0.5 + line.weight * 0.4) * ink * leaving})`;
      ctx.lineWidth = (centred ? 1.9 : 1.4) * (0.6 + 0.4 * (thought.glow ?? 1));
      ctx.beginPath();
      for (const [a, b] of joins) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
  }

}

/**
 * Run a curve through the points rather than joining them with facets: the
 * pen never turns a corner, so sparse points still read as handwriting.
 */
function curve(ctx, pts) {
  ctx.beginPath();
  addCurve(ctx, pts);
}

/**
 * Append a curve to whatever path is open. Every stroke() is a separate
 * rasterised path, so anything sharing a colour and a weight is gathered
 * into one path and stroked once.
 */
function addCurve(ctx, pts) {
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
