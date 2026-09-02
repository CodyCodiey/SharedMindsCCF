/**
 * The physics the map-shaped versions share: nodes shove each other apart,
 * links pull them together, and the view scales so nothing is ever lost off
 * the edge of the field.
 */
export function createForce(options) {
  const o = {
    repulsion: 26000,
    springLength: 150,
    springK: 0.012,
    gravity: 0.0015,
    clusterGravity: 0.02,
    damping: 0.86,
    maxSpeed: 6,
    separation: 10,
    fitPadding: 40,
    fitEase: 0.05,
    minZoom: 0.14,
    ...options,
  };

  const field = { x: 0, y: 0, w: 0, h: 0 };
  const view = { scale: 1, x: 0, y: 0 };

  return {
    field,
    view,
    setField(x, y, w, h) {
      field.x = x; field.y = y; field.w = w; field.h = h;
    },

    /** Screen point → the world the nodes live in. */
    toWorld(point) {
      return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
    },

    step(nodes, links, homeOf) {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          const f = o.repulsion / d2;
          a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
          b.vx += (dx / d) * f; b.vy += (dy / d) * f;

          const min = a.r + b.r + o.separation;
          if (d < min) {
            const push = (min - d) * 0.5;
            a.x -= (dx / d) * push; a.y -= (dy / d) * push;
            b.x += (dx / d) * push; b.y += (dy / d) * push;
          }
        }
      }

      for (const link of links) {
        const { a, b } = link;
        if (!nodes.includes(a) || !nodes.includes(b)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const rest = o.springLength * (1 - link.weight * 0.45) + a.r + b.r;
        const f = (d - rest) * o.springK * (0.4 + link.weight);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }

      const cx = field.x + field.w / 2;
      const cy = field.y + field.h / 2;
      for (const node of nodes) {
        node.vx += (cx - node.x) * o.gravity;
        node.vy += (cy - node.y) * o.gravity;
        const home = homeOf ? homeOf(node) : null;
        if (home) {
          node.vx += (home.x - node.x) * o.clusterGravity;
          node.vy += (home.y - node.y) * o.clusterGravity;
        }
        node.vx *= o.damping;
        node.vy *= o.damping;
        const speed = Math.hypot(node.vx, node.vy);
        if (speed > o.maxSpeed) {
          node.vx = (node.vx / speed) * o.maxSpeed;
          node.vy = (node.vy / speed) * o.maxSpeed;
        }
        node.x += node.vx;
        node.y += node.vy;
      }
    },

    /** Ease the view so everything stays on screen, however much there is. */
    fit(nodes) {
      if (!nodes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x - n.r - 20); maxX = Math.max(maxX, n.x + n.r + 20);
        minY = Math.min(minY, n.y - n.r - 20); maxY = Math.max(maxY, n.y + n.r + 20);
      }
      const p = o.fitPadding;
      const w = Math.max(1, maxX - minX + p * 2);
      const h = Math.max(1, maxY - minY + p * 2);
      const scale = Math.max(o.minZoom, Math.min(1, field.w / w, field.h / h));
      view.scale += (scale - view.scale) * o.fitEase;
      view.x += (field.x + field.w / 2 - ((minX + maxX) / 2) * scale - view.x) * o.fitEase;
      view.y += (field.y + field.h / 2 - ((minY + maxY) / 2) * scale - view.y) * o.fitEase;
    },

    reset() {
      view.scale = 1; view.x = 0; view.y = 0;
    },
  };
}

/**
 * Chunk nodes by label propagation over their links: each repeatedly adopts
 * whichever chunk its neighbours mostly belong to. Anything unlinked shares
 * the loose chunk, so nothing is dropped for being lonely.
 */
export function assignClusters(nodes, links, iterations = 10) {
  const near = new Map(nodes.map((n) => [n, []]));
  for (const link of links) {
    if (!near.has(link.a) || !near.has(link.b)) continue;
    near.get(link.a).push({ node: link.b, w: link.weight });
    near.get(link.b).push({ node: link.a, w: link.weight });
  }
  for (const node of nodes) if (node.cluster === undefined) node.cluster = node.id;

  for (let pass = 0; pass < iterations; pass++) {
    let moved = false;
    for (const node of nodes) {
      const list = near.get(node);
      if (!list.length) continue;
      const tally = new Map();
      for (const { node: other, w } of list) {
        tally.set(other.cluster, (tally.get(other.cluster) || 0) + w);
      }
      let best = node.cluster;
      let bestW = tally.get(node.cluster) || 0;
      for (const [cluster, w] of tally) {
        if (w > bestW || (w === bestW && cluster < best)) { best = cluster; bestW = w; }
      }
      if (best !== node.cluster) { node.cluster = best; moved = true; }
    }
    if (!moved) break;
  }
  for (const node of nodes) if (!near.get(node).length) node.cluster = -1;
}

/** Lay the chunks out on a stable grid inside the field. */
export function bucketGrid(nodes, field) {
  const ids = [...new Set(nodes.map((n) => n.cluster))].sort((a, b) => a - b);
  const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
  const rows = Math.max(1, Math.ceil(ids.length / cols));
  const centers = new Map();
  ids.forEach((id, i) => {
    centers.set(id, {
      x: field.x + (field.w / cols) * ((i % cols) + 0.5),
      y: field.y + (field.h / rows) * (Math.floor(i / cols) + 0.5),
    });
  });
  return centers;
}
