import { createColumn } from './column.js';
import { createThoughts } from './thoughts.js';
import { createForce, assignClusters, bucketGrid } from './force.js';
import { cosine, addVec } from './text.js';

/**
 * The two map-shaped versions: a monochrome column of speech on the right,
 * and on the left the ideas it produced, drifting under their own physics.
 * They are the same machine — the later one only chunks its ideas, scales to
 * fit them all, and lets each say more about itself.
 */
export function createGraphVersion(options = {}) {
  const o = {
    chunking: false,
    fit: false,
    quotes: false,
    retire: 0,           // 0 keeps every idea
    mergeThreshold: 0.32,
    linkThreshold: 0.13,
    maxLinks: 3,
    graphWidth: 0.4,
    ...options,
  };

  const column = createColumn({ left: o.graphWidth, focusRatio: 0.7 });
  const force = createForce({ clusterGravity: o.chunking ? 0.024 : 0 });
  let nodes = [];
  let links = [];
  let centers = new Map();

  const thoughts = createThoughts({
    onEnd({ topic, scores }) {
      absorb(topic, scores);
      rebuildLinks();
    },
  });

  function absorb(topic, scores) {
    let best = null;
    let bestScore = 0;
    for (const node of nodes) {
      const score = node.label === topic.label ? 1 : cosine(node.vec, scores);
      if (score > bestScore) { bestScore = score; best = node; }
    }
    if (best && bestScore >= o.mergeThreshold) {
      best.weight += 1;
      best.pulse = 1;
      addVec(best.vec, scores);
      if (o.quotes && topic.quote) best.quote = topic.quote;
      return;
    }
    nodes.push({
      id: nodes.length,
      label: topic.label,
      quote: o.quotes ? topic.quote : '',
      vec: addVec(new Map(), scores),
      weight: 1, pulse: 1, alpha: 0,
      x: force.field.x + force.field.w / 2 + (Math.random() - 0.5) * 200,
      y: force.field.y + force.field.h / 2 + (Math.random() - 0.5) * 200,
      vx: 0, vy: 0, r: 30,
    });
  }

  function rebuildLinks() {
    const all = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const w = cosine(nodes[i].vec, nodes[j].vec);
        if (w >= o.linkThreshold) all.push({ a: nodes[i], b: nodes[j], weight: w });
      }
    }
    all.sort((x, y) => y.weight - x.weight);
    const degree = new Map();
    links = [];
    for (const link of all) {
      const da = degree.get(link.a) || 0;
      const db = degree.get(link.b) || 0;
      if (da >= o.maxLinks || db >= o.maxLinks) continue;
      degree.set(link.a, da + 1); degree.set(link.b, db + 1);
      links.push(link);
    }
    // The earlier version let weak ideas go; the later one keeps everything.
    if (o.retire && nodes.length > o.retire) {
      nodes.slice()
        .sort((a, b) => (a.weight - b.weight) || (a.id - b.id))
        .slice(0, nodes.length - o.retire)
        .forEach((n) => { n.retiring = true; });
    }
    if (o.chunking) assignClusters(nodes, links);
  }

  function radiusOf(node) {
    const chars = node.label.length + (node.quote ? node.quote.length * 0.62 : 0);
    return o.quotes
      ? Math.min(108, 34 + Math.sqrt(node.weight) * 7 + Math.sqrt(chars) * 4.6)
      : Math.min(74, 26 + Math.sqrt(node.weight) * 11);
  }

  return {
    resize(ctx, w, h) {
      column.resize(ctx, w, h);
      force.setField(52, 52, w * o.graphWidth - 78, h - 156);
    },

    words(ctx, list, t) {
      column.add(ctx, thoughts.add(list, t), thoughts.state.index);
    },

    tick(now) {
      thoughts.tick(now);
      column.tick();
      if (o.chunking) centers = bucketGrid(nodes, force.field);
      for (const node of nodes) {
        node.r = radiusOf(node);
        node.alpha += ((node.retiring ? 0 : 1) - node.alpha) * 0.06;
        node.pulse *= 0.94;
      }
      force.step(nodes, links, o.chunking ? (n) => centers.get(n.cluster) : null);
      if (o.fit) force.fit(nodes);
      nodes = nodes.filter((n) => !(n.retiring && n.alpha < 0.02));
      links = links.filter((l) => nodes.includes(l.a) && nodes.includes(l.b));
    },

    draw(ctx) {
      const { width, height, cameraY } = column.state;
      const zoom = force.view.scale;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';

      ctx.save();
      if (o.fit) {
        ctx.beginPath();
        ctx.rect(0, 0, column.leftEdge() - 26, height);
        ctx.clip();
        ctx.translate(force.view.x, force.view.y);
        ctx.scale(zoom, zoom);
      }
      const hair = o.fit ? Math.max(zoom, 0.35) : 1;

      for (const link of links) {
        const alpha = Math.min(link.a.alpha, link.b.alpha) * (0.18 + link.weight * 0.55);
        if (alpha < 0.02) continue;
        const dx = link.b.x - link.a.x, dy = link.b.y - link.a.y;
        const len = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.lineWidth = (0.5 + link.weight * 2.4) / hair;
        ctx.beginPath();
        ctx.moveTo(link.a.x, link.a.y);
        ctx.quadraticCurveTo(
          (link.a.x + link.b.x) / 2 + (-dy / len) * len * 0.1,
          (link.a.y + link.b.y) / 2 + (dx / len) * len * 0.1,
          link.b.x, link.b.y
        );
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const node of nodes) {
        if (node.alpha < 0.02) continue;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(0, 0, 0, ${node.alpha * (0.35 + node.pulse * 0.65)})`;
        ctx.lineWidth = (0.75 + Math.min(2.5, node.weight * 0.35) + node.pulse * 1.5) / hair;
        ctx.stroke();
        drawLabel(ctx, node, zoom);
        if (node.weight > 1) {
          ctx.font = `${10 / hair}px ui-monospace, Menlo, monospace`;
          ctx.fillStyle = `rgba(0, 0, 0, ${node.alpha * 0.45})`;
          ctx.fillText(`×${node.weight}`, node.x, node.y + node.r - 10 / hair);
        }
      }
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(column.leftEdge() - 26, 0);
      ctx.lineTo(column.leftEdge() - 26, height);
      ctx.stroke();

      column.setFont(ctx);
      for (const token of column.tokens) {
        const y = token.y - cameraY;
        if (y < -80 || y > height + 40) continue;
        const d = column.depth(token.y);
        if (!d) continue;
        ctx.fillStyle = `rgba(0, 0, 0, ${token.content ? d : d * 0.34})`;
        ctx.fillText(token.text, token.x, y);
      }
      column.drawGhost(ctx, this.ghostText, 'rgba(0, 0, 0, 0.38)');
    },

    ghost(text) { this.ghostText = text; },
    ghostText: '',

    reset() {
      column.reset(); thoughts.reset(); force.reset();
      nodes = []; links = []; centers = new Map();
    },
  };

  function drawLabel(ctx, node, zoom) {
    const scale = o.fit ? Math.max(zoom, 0.28) : 1;
    const size = o.quotes
      ? Math.max(12 / scale, Math.min(18, node.r * 0.3))
      : Math.max(11 / scale, Math.min(17, node.r * 0.34));
    const maxWidth = node.r * 1.5;

    ctx.font = `${size}px ${column.options.fontFamily}`;
    const nameLines = wrap(ctx, node.label, maxWidth, 2);
    const quoteSize = size * 0.72;
    let quoteLines = [];
    if (node.quote) {
      ctx.font = `italic ${quoteSize}px ${column.options.fontFamily}`;
      quoteLines = wrap(ctx, node.quote, maxWidth, 3);
    }
    const nameLH = size * 1.1;
    const quoteLH = quoteSize * 1.12;
    const total = nameLines.length * nameLH + quoteLines.length * quoteLH;
    let y = node.y - total / 2 + nameLH * 0.6;

    ctx.font = `${size}px ${column.options.fontFamily}`;
    ctx.fillStyle = `rgba(0, 0, 0, ${node.alpha})`;
    for (const line of nameLines) { ctx.fillText(line, node.x, y); y += nameLH; }

    if (quoteLines.length) {
      y += size * 0.2;
      ctx.font = `italic ${quoteSize}px ${column.options.fontFamily}`;
      ctx.fillStyle = `rgba(0, 0, 0, ${node.alpha * 0.55})`;
      for (const line of quoteLines) { ctx.fillText(line, node.x, y); y += quoteLH; }
    }
  }
}

function wrap(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const word of (text || '').split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}
