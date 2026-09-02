import { createThoughts } from '../shared/thoughts.js';
import { createForce, assignClusters, bucketGrid } from '../shared/force.js';
import { cosine, addVec } from '../shared/text.js';

export const meta = {
  id: 'fern',
  title: '4 · Fern & whirligig',
  blurb: 'The live thought grows as a frond; finished, it curls into a spinning whirligig and flies to its bucket.',
};

const FONT = '"Times New Roman", Times, serif';

export function create() {
  const force = createForce({ clusterGravity: 0.024, separation: 12 });
  const frond = { pinnae: [], buffer: [] };
  let nodes = [];
  let links = [];
  let centers = new Map();
  let size = { w: 0, h: 0 };
  let pending = null;

  const thoughts = createThoughts({
    max: 20, min: 8,
    onWords(tokens) {
      for (const tk of tokens) {
        frond.buffer.push(tk.text);
        if (/[.?!]$/.test(tk.text) || frond.buffer.length >= 6) cutPinna();
      }
      if (frond.pinnae.length >= 5) thoughts.end(performance.now());
    },
    onEnd({ topic, scores }) {
      cutPinna();
      pending = { topic, scores, pinnae: frond.pinnae };
      frond.pinnae = [];
    },
  });

  function cutPinna() {
    if (!frond.buffer.length) return;
    frond.pinnae.push({
      text: frond.buffer.join(' '),
      side: frond.pinnae.length % 2 === 0 ? 1 : -1,
      grow: 0, len: 0,
    });
    frond.buffer = [];
  }

  function base() { return { x: size.w * 0.5, y: size.h * 0.94 }; }

  /** The spine of the growing frond, curling as it lengthens. */
  function rachis() {
    const b = base();
    const count = frond.pinnae.length + (frond.buffer.length ? 1 : 0);
    const length = 90 + count * 44;
    const samples = Math.max(12, Math.round(length / 8));
    const points = [];
    let x = b.x, y = b.y, angle = -Math.PI / 2;
    for (let i = 0; i <= samples; i++) {
      points.push({ x, y, angle });
      angle += 0.055 * (i / samples);
      x += Math.cos(angle) * (length / samples);
      y += Math.sin(angle) * (length / samples);
    }
    return points;
  }

  function launch(ctx) {
    if (!pending) return;
    const { topic, scores, pinnae } = pending;
    pending = null;
    ctx.font = `15px ${FONT}`;
    const origin = force.toWorld(base());
    const node = {
      id: nodes.length,
      label: topic.label,
      quote: topic.quote,
      vec: addVec(new Map(), scores),
      vanes: (pinnae.length ? pinnae : [{ text: topic.label }]).map((p) => ({
        len: Math.max(16, Math.min(74, ctx.measureText(p.text).width * 0.34)),
      })),
      x: origin.x, y: origin.y,
      vx: Math.cos(-Math.PI / 2) * 6.5, vy: Math.sin(-Math.PI / 2) * 6.5,
      spin: Math.random() * 6.28,
      spinRate: 0.26 * (Math.random() < 0.5 ? -1 : 1),
      flying: true, alpha: 0, weight: 1,
    };
    node.r = node.vanes.reduce((m, v) => Math.max(m, v.len), 0);
    nodes.push(node);

    const all = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const w = cosine(nodes[i].vec, nodes[j].vec);
        if (w >= 0.13) all.push({ a: nodes[i], b: nodes[j], weight: w });
      }
    }
    all.sort((x, y) => y.weight - x.weight);
    const degree = new Map();
    links = [];
    for (const link of all) {
      const da = degree.get(link.a) || 0, db = degree.get(link.b) || 0;
      if (da >= 3 || db >= 3) continue;
      degree.set(link.a, da + 1); degree.set(link.b, db + 1);
      links.push(link);
    }
    assignClusters(nodes, links);
  }

  return {
    resize(ctx, w, h) {
      size = { w, h };
      force.setField(48, 48, w - 96, h * 0.66 - 48);
    },

    words(ctx, list, t) { thoughts.add(list, t); },

    tick(now, ctx) {
      thoughts.tick(now);
      if (pending && ctx) launch(ctx);
      for (const p of frond.pinnae) p.grow += (1 - p.grow) * 0.12;

      centers = bucketGrid(nodes, force.field);
      for (const node of nodes) node.alpha += (1 - node.alpha) * 0.07;

      const landed = nodes.filter((n) => !n.flying);
      force.step(landed, links.filter((l) => !l.a.flying && !l.b.flying),
        (n) => centers.get(n.cluster));
      force.fit(nodes);

      for (const node of nodes) {
        node.spin += node.spinRate;
        if (!node.flying) continue;
        node.spinRate = Math.sign(node.spinRate) *
          Math.max(0.006, Math.abs(node.spinRate) * 0.982);
        const home = centers.get(node.cluster);
        if (!home) continue;
        const dx = home.x - node.x, dy = home.y - node.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = Math.min(6, dist * 0.06);
        node.vx += ((dx / dist) * speed - node.vx) * 0.07;
        node.vy += ((dy / dist) * speed - node.vy) * 0.07;
        node.x += node.vx; node.y += node.vy;
        if (dist < 46) { node.flying = false; node.spinRate = Math.sign(node.spinRate) * 0.006; }
      }
    },

    draw(ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';

      const zoom = force.view.scale;
      const hair = Math.max(zoom, 0.3);
      ctx.save();
      ctx.translate(force.view.x, force.view.y);
      ctx.scale(zoom, zoom);

      for (const link of links) {
        if (link.a.flying || link.b.flying) continue;
        const alpha = Math.min(link.a.alpha, link.b.alpha) * (0.14 + link.weight * 0.5);
        if (alpha < 0.02) continue;
        ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.lineWidth = (0.5 + link.weight * 2) / hair;
        ctx.beginPath();
        ctx.moveTo(link.a.x, link.a.y);
        ctx.lineTo(link.b.x, link.b.y);
        ctx.stroke();
      }

      for (const node of nodes) {
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(node.spin);
        ctx.strokeStyle = `rgba(0, 0, 0, ${node.alpha * 0.62})`;
        ctx.lineWidth = 1 / hair;
        node.vanes.forEach((vane, i) => {
          const a = (i / node.vanes.length) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(
            Math.cos(a - 0.36) * vane.len * 0.62, Math.sin(a - 0.36) * vane.len * 0.62,
            Math.cos(a) * vane.len, Math.sin(a) * vane.len
          );
          ctx.stroke();
        });
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.max(12 / Math.max(zoom, 0.26), 13)}px ${FONT}`;
        ctx.fillStyle = `rgba(0, 0, 0, ${node.alpha})`;
        ctx.fillText(node.label, node.x, node.y + node.r + 14);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();

      // The frond: the thought still being spoken, in screen space.
      const points = rachis();
      const all = frond.pinnae.concat(
        frond.buffer.length || this.ghostText
          ? [{
              text: [frond.buffer.join(' '), this.ghostText].filter(Boolean).join(' '),
              side: frond.pinnae.length % 2 === 0 ? 1 : -1, grow: 1, live: true,
            }]
          : []
      );
      for (let i = 1; i < points.length; i++) {
        const k = i / points.length;
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.5 - k * 0.28})`;
        ctx.lineWidth = 2.1 * (1 - k * 0.72);
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }

      ctx.font = `15px ${FONT}`;
      ctx.textBaseline = 'middle';
      all.forEach((pinna, i) => {
        const t = (i + 0.7) / (all.length + 0.7);
        const at = points[Math.min(points.length - 1, Math.round(t * (points.length - 1)))];
        const width = ctx.measureText(pinna.text).width;
        const angle = at.angle + (1.02 + 0.16 * (i / Math.max(1, all.length))) * pinna.side;
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(angle);
        const flip = Math.cos(angle) < 0;
        if (flip) { ctx.rotate(Math.PI); ctx.textAlign = 'right'; } else ctx.textAlign = 'left';
        ctx.scale(pinna.grow, pinna.grow);
        const dir = flip ? -1 : 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dir * (width + 12), 0);
        ctx.stroke();
        ctx.fillStyle = pinna.live ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.88)';
        ctx.fillText(pinna.text, dir * 8, 0);
        ctx.restore();
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    },

    ghost(text) { this.ghostText = text; },
    ghostText: '',

    reset() {
      thoughts.reset(); force.reset();
      nodes = []; links = []; centers = new Map(); pending = null;
      frond.pinnae = []; frond.buffer = [];
    },
  };
}
