import { createThoughts } from '../shared/thoughts.js';

export const meta = {
  id: 'sail',
  title: '6 · Dandelion, sails',
  blurb: 'A full head stands in the wind. Talking winds words into a spiral sail; the wider it grows, the more wind it catches.',
};

const C = {
  seedCount: 17, seedReach: 78, reachJitter: 18, angleJitter: 0.1, regrowEase: 0.05,
  sailFont: '18px "Times New Roman", Times, serif',
  sailInner: 21, sailPitch: 3.8, sailMax: 230, sailEase: 0.12,
  filaments: 11, filamentLength: 21, filamentSpread: 1.15,
  headRadius: 11, stemLength: 0.26, stemCurl: 0.5, headAt: { x: 0.5, y: 0.7 },
  windBase: { x: 1.45, y: -0.68 }, windSway: { x: 0.5, y: 0.22 }, swayAngle: 0.055,
  sailCatch: 0.009, gust: 1.007, liftJitter: 0.4, driftSpin: 0.004,
  wobble: 0.55, wobbleRate: 0.009, fadeMargin: 70,
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function create() {
  const head = { seeds: [], flying: [], active: null };
  let size = { w: 0, h: 0 };
  let placed = 0;

  const thoughts = createThoughts({
    max: 20, min: 8, pauseMs: 1400,
    onWords(tokens) {
      if (!head.active) head.active = pickSeed();
      if (!head.active) return;
      for (const tk of tokens) head.active.words.push(tk.text);
    },
    onEnd({ t }) { release(t); },
  });

  function makeSeed() {
    const seed = {
      angle: placed * GOLDEN + (Math.random() - 0.5) * C.angleJitter,
      reach: C.seedReach + (Math.random() - 0.5) * C.reachJitter,
      words: [], sailR: 0, alpha: 0, spin: 0, spinRate: 0,
      wobblePhase: Math.random() * Math.PI * 2,
    };
    placed++;
    return seed;
  }

  function fillHead() {
    head.seeds = []; head.flying = []; head.active = null; placed = 0;
    for (let i = 0; i < C.seedCount; i++) head.seeds.push(makeSeed());
  }

  function pickSeed() {
    const bare = head.seeds.filter((s) => !s.words.length && s.alpha > 0.4);
    if (bare.length) return bare[Math.floor(Math.random() * bare.length)];
    return head.seeds.find((s) => !s.words.length) || null;
  }

  /** The wind, never quite steady: a slow sway with a slower one under it. */
  function wind(now) {
    const t = now * 0.001;
    return {
      x: C.windBase.x + Math.sin(t * 0.15) * C.windSway.x
        + Math.sin(t * 0.06 + 1.1) * C.windSway.x * 0.45,
      y: C.windBase.y + Math.sin(t * 0.11 + 1.7) * C.windSway.y,
    };
  }

  function sway(now) {
    const t = now * 0.001;
    return Math.sin(t * 0.15) * C.swayAngle + Math.sin(t * 0.06 + 1.1) * C.swayAngle * 0.4;
  }

  /** The stem: rooted where it stands, bending only near the top. */
  function stem(now) {
    const length = size.h * C.stemLength;
    const baseX = size.w * C.headAt.x;
    const baseY = size.h * C.headAt.y + length;
    const lean = sway(now);
    const points = [];
    let x = baseX, y = baseY;
    for (let i = 0; i <= 26; i++) {
      points.push({ x, y });
      const k = i / 26;
      const angle = -Math.PI / 2 + (C.stemCurl + lean * 3) * k * k;
      x += Math.cos(angle) * (length / 26);
      y += Math.sin(angle) * (length / 26);
    }
    const top = points[points.length - 1];
    return { points, head: { x: top.x, y: top.y } };
  }

  function seedTip(anchor, seed) {
    return {
      x: anchor.x + Math.cos(seed.angle) * seed.reach,
      y: anchor.y + Math.sin(seed.angle) * seed.reach,
    };
  }

  function release(now) {
    const seed = head.active;
    head.active = null;
    if (!seed || !seed.words.length) return;
    const tip = seedTip(stem(now).head, seed);
    seed.x = tip.x; seed.y = tip.y;
    const w = wind(now);
    const grip = 1 + seed.sailR * C.sailCatch;
    seed.vx = w.x * grip + (Math.random() - 0.5) * C.liftJitter;
    seed.vy = w.y * grip + (Math.random() - 0.5) * C.liftJitter;
    seed.spinRate = (Math.random() - 0.5) * C.driftSpin * 2;
    head.seeds.splice(head.seeds.indexOf(seed), 1);
    head.flying.push(seed);
    head.seeds.push(makeSeed());
  }

  function drawPappus(ctx, alpha) {
    if (alpha < 0.02) return;
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < C.filaments; i++) {
      const a = -C.filamentSpread + (i / (C.filaments - 1)) * C.filamentSpread * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(a) * C.filamentLength * 0.55, Math.sin(a) * C.filamentLength * 0.4,
        Math.cos(a) * C.filamentLength, Math.sin(a) * C.filamentLength
      );
      ctx.stroke();
    }
  }

  /** Every word of the thought wound outward around its seed. */
  function drawSail(ctx, seed, at, alpha) {
    ctx.font = C.sailFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const space = ctx.measureText(' ').width;
    let theta = 0;
    let r = C.sailInner;
    ctx.save();
    ctx.translate(at.x, at.y);
    for (const word of seed.words) {
      const width = ctx.measureText(word).width;
      r = Math.min(C.sailMax, C.sailInner + C.sailPitch * theta);
      ctx.save();
      ctx.rotate(theta + seed.angle);
      ctx.translate(r, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.85})`;
      ctx.fillText(word, 0, 0);
      ctx.restore();
      theta += (width + space) / Math.max(r, 8);
    }
    ctx.restore();
    seed.sailR += (r - seed.sailR) * C.sailEase;
  }

  function drawSeedForm(ctx, seed, at, alpha) {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(seed.angle);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.75})`;
    ctx.beginPath();
    ctx.ellipse(-4, 0, 3.4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPappus(ctx, alpha * (seed.words.length ? 0.35 : 1));
    ctx.restore();
    if (seed.words.length) drawSail(ctx, seed, at, alpha);
  }

  return {
    resize(ctx, w, h) { size = { w, h }; if (!head.seeds.length) fillHead(); },
    words(ctx, list, t) { thoughts.add(list, t); },

    tick(now) {
      thoughts.tick(now);
      for (const seed of head.seeds) seed.alpha += (1 - seed.alpha) * C.regrowEase;
      const w = wind(now);
      for (let i = head.flying.length - 1; i >= 0; i--) {
        const seed = head.flying[i];
        seed.wobblePhase += C.wobbleRate;
        const grip = 1 + seed.sailR * C.sailCatch;
        seed.vx += (w.x * grip - seed.vx) * 0.05;
        seed.vy += (w.y * grip - seed.vy) * 0.05;
        seed.vx *= C.gust; seed.vy *= C.gust;
        seed.x += seed.vx + Math.cos(seed.wobblePhase) * C.wobble;
        seed.y += seed.vy + Math.sin(seed.wobblePhase) * C.wobble * 0.6;
        seed.spin += seed.spinRate;
        const outside = Math.max(
          -seed.x - seed.sailR, seed.x - seed.sailR - size.w,
          -seed.y - seed.sailR, seed.y - seed.sailR - size.h, 0
        );
        seed.alpha = Math.max(0, 1 - outside / C.fadeMargin);
        if (seed.alpha <= 0) head.flying.splice(i, 1);
      }
    },

    draw(ctx, now) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';

      for (const seed of head.flying) {
        ctx.save();
        ctx.translate(seed.x, seed.y);
        ctx.rotate(seed.spin);
        drawSeedForm(ctx, seed, { x: 0, y: 0 }, seed.alpha);
        ctx.restore();
      }

      const { points, head: anchor } = stem(now);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.stroke();

      for (const seed of head.seeds) {
        const tip = seedTip(anchor, seed);
        ctx.strokeStyle = `rgba(0, 0, 0, ${seed.alpha * 0.45})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        drawSeedForm(ctx, seed, tip, seed.alpha);
      }

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, C.headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (this.ghostText) {
        ctx.font = 'italic 16px "Times New Roman", Times, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.fillText(this.ghostText, anchor.x, anchor.y + 34);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    },

    ghost(text) { this.ghostText = text; },
    ghostText: '',

    reset() { thoughts.reset(); fillHead(); },
  };
}
