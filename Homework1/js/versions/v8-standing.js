import { createThoughts } from '../shared/thoughts.js';

export const meta = {
  id: 'standing',
  title: '8 · Standing waves',
  blurb: 'A field of standing waves. The word being spoken resolves out of the middle one and sinks back; what was said echoes across the others.',
};

// A script face if the machine has one, falling back through what most do.
const SCRIPT = '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive';

const C = {
  waves: 15,
  margin: 40,
  samples: 190,          // points per wave line
  harmonics: 3,
  ampBase: 26,           // the middle wave's swing
  ampFalloff: 0.62,      // quieter toward the edges
  speed: 0.0011,
  breath: 0.00017,       // slow drift in amplitude, so it never settles

  centreSize: 86,        // type size of the word being spoken
  echoSize: 30,
  riseEase: 0.13,
  fallEase: 0.055,
  holdMs: 900,           // how long a finished word stays formed

  echoDelayMs: 700,
  echoGapMs: 2600,
  echoPeak: 0.62,        // echoes never fully resolve
  echoDecay: 0.62,
  echoes: 3,

  quiet: 0.9,            // how much the wave stills where a word is forming
  wordSpan: 1.35,        // how far along the line a word's influence reaches
};

export function create() {
  let size = { w: 0, h: 0 };
  let waves = [];
  let words = [];
  let current = null;
  let ghostWord = null;

  // Kept only so a finished thought can nudge its words back into the field.
  const thoughts = createThoughts({
    min: 8, max: 22, pauseMs: 2000,
    onEnd({ t }) {
      for (const w of words) if (w.wave === centre() && w.state === 'hold') retreat(w, t);
    },
  });

  const centre = () => (waves.length - 1) >> 1;

  function build() {
    waves = [];
    const usable = size.h - C.margin * 2;
    for (let i = 0; i < C.waves; i++) {
      const t = C.waves === 1 ? 0.5 : i / (C.waves - 1);
      const fromCentre = Math.abs(t - 0.5) * 2;
      waves.push({
        y: C.margin + usable * t,
        // Each line carries its own set of standing modes, so the field
        // never repeats across rows.
        modes: Array.from({ length: C.harmonics }, (_, h) => ({
          n: 1 + h * 2 + Math.floor(Math.random() * 3),
          amp: (1 / (h + 1)) * (0.5 + Math.random() * 0.7),
          omega: 0.6 + Math.random() * 1.5,
          phase: Math.random() * Math.PI * 2,
        })),
        amp: C.ampBase * (1 - fromCentre * C.ampFalloff),
        weight: 1 - fromCentre * 0.55,
      });
    }
  }

  /** A standing wave: fixed nodes, the whole line breathing between them. */
  function waveY(wave, x, now) {
    const u = (x - C.margin) / Math.max(1, size.w - C.margin * 2);
    let sum = 0;
    for (const m of wave.modes) {
      sum += m.amp
        * Math.sin(Math.PI * m.n * u)
        * Math.cos(now * C.speed * m.omega + m.phase);
    }
    const breath = 0.75 + 0.25 * Math.sin(now * C.breath + wave.y);
    return wave.y + sum * wave.amp * breath;
  }

  function speakWord(text, now) {
    if (current) retreat(current, now);
    const word = {
      text,
      wave: centre(),
      x: size.w / 2,
      size: C.centreSize,
      m: 0, target: 1,
      state: 'rise',
      at: now,
      echoesLeft: C.echoes,
      strength: 1,
    };
    words.push(word);
    current = word;
    return word;
  }

  function retreat(word, now) {
    word.state = 'retreat';
    word.target = 0;
    word.at = now;
    if (current === word) {
      current = null;
      // Step it back into the field as it goes, rather than letting it sink
      // where the next word is already arriving: what was just said belongs
      // off-centre, on another line, smaller.
      stepBack(word);
    }
  }

  /** Move a word off the middle wave, one row out and to one side. */
  function stepBack(word) {
    const mid = centre();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const rows = 1 + Math.floor(Math.random() * 2);
    word.wave = Math.max(0, Math.min(waves.length - 1, mid + dir * rows));
    word.size = C.centreSize * 0.42;
    word.x = size.w / 2 + (Math.random() < 0.5 ? -1 : 1)
      * size.w * (0.1 + Math.random() * 0.26);
  }

  /** A word that has sunk back surfaces again somewhere else, fainter. */
  function echo(word, now) {
    const others = waves.map((_, i) => i).filter((i) => i !== centre());
    word.wave = others[Math.floor(Math.random() * others.length)];
    word.size = C.echoSize * (0.75 + Math.random() * 0.5);
    word.x = size.w * (0.16 + Math.random() * 0.68);
    word.strength *= C.echoDecay;
    word.target = C.echoPeak * word.strength;
    word.state = 'rise';
    word.at = now;
    word.echoesLeft--;
  }

  return {
    resize(ctx, w, h) {
      size = { w, h };
      build();
      for (const word of words) if (word.wave === centre()) word.x = w / 2;
    },

    words(ctx, list, t) {
      thoughts.add(list, t);
      // One word at a time in the middle: speech arrives, resolves, sinks.
      for (const raw of list) {
        const text = String(raw).trim();
        if (text) speakWord(text, t);
      }
      ghostWord = null;
    },

    tick(now) {
      thoughts.tick(now);

      for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        const ease = word.target > word.m ? C.riseEase : C.fallEase;
        word.m += (word.target - word.m) * ease;

        if (word.state === 'rise' && word.m > word.target - 0.02) {
          word.state = 'hold';
          word.at = now;
        } else if (word.state === 'hold' && word !== current
                   && now - word.at > C.holdMs) {
          retreat(word, now);
        } else if (word.state === 'retreat' && word.m < 0.02) {
          if (word.echoesLeft > 0
              && now - word.at > C.echoDelayMs + Math.random() * C.echoGapMs) {
            echo(word, now);
          } else if (word.echoesLeft <= 0) {
            words.splice(i, 1);
          }
        }
      }
    },

    draw(ctx, now) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const live = words.filter((w) => w.m > 0.01);
      const ghost = ghostWord && ghostWord.text
        ? [{ ...ghostWord, wave: centre(), x: size.w / 2, size: C.centreSize, m: 0.34 }]
        : [];

      waves.forEach((wave, index) => {
        const here = live.concat(ghost).filter((w) => w.wave === index);
        drawWave(ctx, wave, index, here, now);
        for (const word of here) drawWord(ctx, wave, word, now);
      });
    },

    ghost(text) {
      ghostWord = text ? { text: text.split(/\s+/).pop() || '' } : null;
    },

    reset() {
      thoughts.reset();
      words = []; current = null; ghostWord = null;
      build();
    },
  };

  /**
   * The line itself, stilled wherever a word is surfacing — the vibration
   * resolving into speech and letting go of it again.
   */
  function drawWave(ctx, wave, index, here, now) {
    const step = (size.w - C.margin * 2) / C.samples;
    ctx.beginPath();
    for (let i = 0; i <= C.samples; i++) {
      const x = C.margin + i * step;
      let calm = 0;
      for (const word of here) {
        const reach = word.size * C.wordSpan * 2;
        const d = Math.abs(x - word.x) / Math.max(1, reach);
        if (d < 1) calm = Math.max(calm, (1 - d) * word.m * C.quiet);
      }
      const y = wave.y + (waveY(wave, x, now) - wave.y) * (1 - calm);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const centred = index === centre();
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.1 + wave.weight * (centred ? 0.5 : 0.28)})`;
    ctx.lineWidth = centred ? 1.15 : 0.75;
    ctx.stroke();
  }

  /**
   * The word rises out of its line: at nothing it is flat against the wave,
   * at full it stands clear of it. Stroked, never filled, so it reads as the
   * same drawn line the field is made of.
   */
  function drawWord(ctx, wave, word, now) {
    const m = Math.max(0.01, Math.min(1, word.m));
    const baseline = wave.y + (waveY(wave, word.x, now) - wave.y) * (1 - m * C.quiet);
    const eased = m * m * (3 - 2 * m);

    ctx.save();
    ctx.translate(word.x, baseline);
    // Vertical squash is the morph: the letters flatten back into the line.
    ctx.scale(1, eased);
    ctx.font = `${word.size}px ${SCRIPT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 1.1 / Math.max(eased, 0.12);
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.28 + eased * 0.62})`;
    ctx.strokeText(word.text, 0, word.size * 0.32);
    ctx.restore();
  }
}
