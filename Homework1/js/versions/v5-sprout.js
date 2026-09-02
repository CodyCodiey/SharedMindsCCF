import { createThoughts } from '../shared/thoughts.js';

export const meta = {
  id: 'sprout',
  title: '5 · Dandelion, sprouting',
  blurb: 'Phrases sprout as seeds around a bare head. When the thought ends they let go one by one.',
};

const FONT = '14px "Times New Roman", Times, serif';
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function create() {
  const head = { seeds: [], departing: [], flying: [], buffer: [], index: 0 };
  let size = { w: 0, h: 0 };

  const thoughts = createThoughts({
    max: 20, min: 8, pauseMs: 3200,
    onWords(tokens) {
      for (const tk of tokens) {
        head.buffer.push(tk.text);
        if (/[.?!]$/.test(tk.text) || head.buffer.length >= 6) cutPhrase();
      }
      if (head.seeds.length >= 9) thoughts.end(performance.now());
    },
    onEnd({ t }) { release(t); },
  });

  function cutPhrase() {
    if (!head.buffer.length) return;
    head.seeds.push({
      text: head.buffer.join(' '),
      angle: head.index * GOLDEN + (Math.random() - 0.5) * 0.16,
      grow: 0, alpha: 1, spin: 0, wobblePhase: Math.random() * 6.28,
    });
    head.index++;
    head.buffer = [];
  }

  function release(now) {
    cutPhrase();
    head.seeds.forEach((seed, i) => {
      seed.releaseAt = now + i * 110;
      head.departing.push(seed);
    });
    head.seeds = [];
  }

  /** Stem and head, leaning as a whole with the wind. */
  function stem(now) {
    const headX = size.w * 0.5;
    const headY = size.h * 0.7;
    const length = size.h * 0.26;
    const t = now * 0.001;
    const lean = Math.sin(t * 0.31) * 0.055 + Math.sin(t * 0.13 + 1.1) * 0.022;
    const points = [];
    let x = headX + lean * length * 0.5, y = headY, angle = Math.PI / 2 - lean;
    for (let i = 0; i <= 26; i++) {
      points.push({ x, y });
      angle += (0.5 / 26) * (i / 26) + lean / 26;
      x += Math.cos(angle) * (length / 26);
      y += Math.sin(angle) * (length / 26);
    }
    return { points, head: { x: points[0].x, y: points[0].y } };
  }

  function drawSeed(ctx, seed, origin, alpha) {
    const width = ctx.measureText(seed.text).width;
    const reach = (30 + width + 16) * seed.grow;
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(seed.angle);
    const flip = Math.cos(seed.angle + (seed.spin || 0)) < 0;
    if (flip) ctx.scale(-1, -1);

    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(reach, 0);
    ctx.stroke();

    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.ellipse(13 * seed.grow, 0, 3.2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (seed.grow > 0.25) {
      ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.9 * seed.grow})`;
      ctx.save();
      ctx.translate(30 * seed.grow, 0);
      ctx.scale(seed.grow, seed.grow);
      ctx.fillText(seed.text, 0, 0);
      ctx.restore();
    }

    // The pappus: the crown of filaments that catches the wind.
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * seed.grow * 0.45})`;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 11; i++) {
      const a = -1.15 + (i / 10) * 2.3;
      ctx.beginPath();
      ctx.moveTo(reach, 0);
      ctx.quadraticCurveTo(
        reach + Math.cos(a) * 9, Math.sin(a) * 7,
        reach + Math.cos(a) * 17, Math.sin(a) * 17
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    resize(ctx, w, h) { size = { w, h }; },
    words(ctx, list, t) { thoughts.add(list, t); },

    tick(now) {
      thoughts.tick(now);
      const anchor = stem(now).head;
      for (const seed of head.seeds) seed.grow += (1 - seed.grow) * 0.09;

      for (let i = head.departing.length - 1; i >= 0; i--) {
        const seed = head.departing[i];
        seed.grow += (1 - seed.grow) * 0.09;
        if (now < seed.releaseAt) continue;
        head.departing.splice(i, 1);
        seed.x = anchor.x; seed.y = anchor.y;
        seed.vx = Math.cos(seed.angle) * 0.6 + 1.5 + (Math.random() - 0.5) * 0.5;
        seed.vy = Math.sin(seed.angle) * 0.6 - 0.85 + (Math.random() - 0.5) * 0.5;
        seed.spinRate = (Math.random() - 0.5) * 0.01;
        head.flying.push(seed);
      }

      const drift = Math.sin(now * 0.0006);
      for (let i = head.flying.length - 1; i >= 0; i--) {
        const seed = head.flying[i];
        seed.wobblePhase += 0.018;
        seed.x += seed.vx + drift * 0.9 + Math.cos(seed.wobblePhase) * 0.9;
        seed.y += seed.vy + Math.sin(seed.wobblePhase) * 0.45;
        seed.spin += seed.spinRate;
        const outside = Math.max(-seed.x, seed.x - size.w, -seed.y, seed.y - size.h, 0);
        seed.alpha = Math.max(0, 1 - outside / 140);
        if (seed.alpha <= 0) head.flying.splice(i, 1);
      }
    },

    draw(ctx, now) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';
      ctx.font = FONT;
      ctx.textBaseline = 'middle';

      for (const seed of head.flying) {
        ctx.save();
        ctx.translate(seed.x, seed.y);
        ctx.rotate(seed.spin);
        drawSeed(ctx, seed, { x: 0, y: 0 }, seed.alpha);
        ctx.restore();
      }

      const { points, head: anchor } = stem(now);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.stroke();

      for (const seed of head.seeds) drawSeed(ctx, seed, anchor, 1);
      for (const seed of head.departing) drawSeed(ctx, seed, anchor, 1);

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (this.ghostText) {
        ctx.font = 'italic 14px "Times New Roman", Times, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillText(this.ghostText, anchor.x, anchor.y + 34);
        ctx.textAlign = 'left';
      }
      ctx.textBaseline = 'alphabetic';
    },

    ghost(text) { this.ghostText = text; },
    ghostText: '',

    reset() {
      thoughts.reset();
      head.seeds = []; head.departing = []; head.flying = [];
      head.buffer = []; head.index = 0;
    },
  };
}
