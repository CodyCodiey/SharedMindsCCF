import { createColumn } from '../shared/column.js';
import { createThoughts } from '../shared/thoughts.js';

export const meta = {
  id: 'constellation',
  title: '1 · Constellation',
  blurb: 'Dark stream, arcs between repeated words, thoughts condensing into bubbles.',
};

const GUTTER = 0.16;

export function create() {
  const column = createColumn({ left: GUTTER, focusRatio: 0.66 });
  const occurrences = new Map();
  let bubbles = [];
  let links = [];

  const thoughts = createThoughts({
    pauseMs: 2500, max: 24,
    onEnd({ topic, index }) {
      bubbles.push({
        index,
        label: topic.label,
        keys: new Set(topic.keywords),
        r: 0, targetR: 30 + Math.min(28, topic.keywords.length * 6),
        x: 0, y: 0, alpha: 0,
      });
      rebuildLinks();
    },
  });

  function rebuildLinks() {
    links = [];
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const A = bubbles[i].keys;
        let shared = 0;
        for (const k of bubbles[j].keys) if (A.has(k)) shared++;
        if (!shared) continue;
        const weight = shared / (A.size + bubbles[j].keys.size - shared);
        if (weight >= 0.2) links.push({ a: bubbles[i], b: bubbles[j], weight });
      }
    }
  }

  return {
    resize(ctx, w, h) { column.resize(ctx, w, h); },

    words(ctx, list, t) {
      const tokens = thoughts.add(list, t);
      column.add(ctx, tokens, thoughts.state.index);
      for (const token of tokens) {
        if (!token.content) continue;
        let ids = occurrences.get(token.key);
        if (!ids) occurrences.set(token.key, (ids = []));
        ids.push(token);
      }
    },

    tick(now) {
      thoughts.tick(now);
      column.tick();

      // Condensed thoughts stack down the gutter, newest lowest.
      const { height } = column.state;
      const step = Math.min(96, (height - 160) / Math.max(1, bubbles.length));
      const shown = bubbles.slice(-Math.max(1, Math.floor((height - 160) / 60)));
      shown.forEach((b, i) => {
        b.x = column.state.width * GUTTER * 0.5;
        b.y = 100 + i * step;
        b.r += (b.targetR - b.r) * 0.08;
        b.alpha += (1 - b.alpha) * 0.06;
      });
      for (const b of bubbles) if (!shown.includes(b)) b.alpha += (0 - b.alpha) * 0.08;
    },

    draw(ctx) {
      const { width, height, cameraY } = column.state;
      ctx.fillStyle = '#07080b';
      ctx.fillRect(0, 0, width, height);
      const wash = ctx.createRadialGradient(
        width * 0.55, height * 0.62, 0, width * 0.55, height * 0.62,
        Math.max(width, height) * 0.8
      );
      wash.addColorStop(0, 'rgba(30, 42, 60, 0.55)');
      wash.addColorStop(1, 'rgba(7, 8, 11, 0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';

      for (const link of links) {
        const alpha = Math.min(link.a.alpha, link.b.alpha) * (0.2 + link.weight * 0.6);
        if (alpha < 0.02) continue;
        ctx.strokeStyle = `hsla(28, 90%, 70%, ${alpha})`;
        ctx.lineWidth = 0.6 + link.weight * 3;
        ctx.beginPath();
        ctx.moveTo(link.a.x, link.a.y);
        ctx.quadraticCurveTo(
          (link.a.x + link.b.x) / 2 - Math.abs(link.b.y - link.a.y) * 0.28,
          (link.a.y + link.b.y) / 2, link.b.x, link.b.y
        );
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const b of bubbles) {
        if (b.alpha < 0.02) continue;
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        glow.addColorStop(0, `rgba(122, 211, 255, ${0.16 * b.alpha})`);
        glow.addColorStop(1, `rgba(122, 211, 255, ${0.02 * b.alpha})`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(122, 211, 255, ${0.35 * b.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `13px ${column.options.fontFamily}`;
        ctx.fillStyle = `rgba(238, 236, 230, ${0.85 * b.alpha})`;
        ctx.fillText(b.label, b.x, b.y);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Arcs: every repeated word sweeping back to where it was last said.
      for (const [, ids] of occurrences) {
        if (ids.length < 2) continue;
        const heat = Math.min(1, (ids.length - 1) / 5);
        for (let i = 0; i < ids.length - 1; i++) {
          const a = ids[i];
          const b = ids[i + 1];
          const da = column.depth(a.y);
          const db = column.depth(b.y);
          if (!da || !db) continue;
          const ax = a.x + a.w / 2;
          const ay = a.y - cameraY - 14;
          const bx = b.x + b.w / 2;
          const by = b.y - cameraY - 14;
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy) || 1;
          const bulge = Math.min(len * 0.22, 260);
          ctx.strokeStyle = `hsla(${196 - heat * 40}, 90%, ${62 + heat * 12}%, ${Math.min(da, db) * (0.28 + heat * 0.5)})`;
          ctx.lineWidth = 0.7 + heat * 3.2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(
            (ax + bx) / 2 + (-dy / len) * bulge,
            (ay + by) / 2 + (dx / len) * bulge, bx, by
          );
          ctx.stroke();
        }
      }

      column.setFont(ctx);
      ctx.textAlign = 'left';
      for (const token of column.tokens) {
        const y = token.y - cameraY;
        if (y < -80 || y > height + 40) continue;
        const d = column.depth(token.y);
        if (!d) continue;
        ctx.fillStyle = token.content
          ? `rgba(238, 236, 230, ${d})`
          : `rgba(232, 230, 223, ${d * 0.42})`;
        ctx.fillText(token.text, token.x, y);
      }
      column.drawGhost(ctx, this.ghostText, 'rgba(122, 211, 255, 0.55)');
    },

    ghost(text) { this.ghostText = text; },
    ghostText: '',

    reset() {
      column.reset(); thoughts.reset();
      occurrences.clear(); bubbles = []; links = [];
    },
  };
}
