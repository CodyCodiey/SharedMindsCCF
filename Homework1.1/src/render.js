// §7, §10 — putting it on the glass.
//
// Every stroke() is a rasterised path with a fixed cost, so everything sharing
// an ink and a weight goes into ONE path. 122 stroke calls a frame froze the
// browser; grouping took it to about 20 for the same picture.

import { CFG } from './config.js?v=a6732beb';
import { drawWriting, state } from './ink.js?v=a6732beb';

class Batch {
  // gamma > 1 spaces the bands perceptually rather than linearly, so the faint
  // end — where a ripple spends most of its life — gets the resolution. 16
  // gamma-2.2 bands reach an ink of 0.0005; 16 linear ones stop at 0.031.
  constructor(bands, gamma = 1) { this.bands = bands; this.gamma = gamma; this.map = new Map(); }
  /** null when the ink has faded below the finest band — the caller draws
   *  nothing rather than being floored up to a visible minimum and then
   *  vanishing outright, which is what made a fading fragment pop out. */
  path(alpha, width) {
    if (!(alpha > 0)) return null;
    const u = this.gamma === 1 ? alpha : Math.pow(alpha, 1 / this.gamma);
    const a = Math.min(this.bands, Math.round(u * this.bands));
    if (a < 1) return null;
    const wq = Math.max(1, Math.round(width * 4));
    const key = a * 4096 + wq;
    let e = this.map.get(key);
    if (!e) {
      const ink = this.gamma === 1 ? a / this.bands : Math.pow(a / this.bands, this.gamma);
      e = { p: new Path2D(), a: ink, w: wq / 4 };
      this.map.set(key, e);
    }
    return e.p;
  }
  stroke(ctx) {
    for (const e of this.map.values()) {
      ctx.globalAlpha = e.a;
      ctx.lineWidth = e.w;
      ctx.stroke(e.p);
    }
    return this.map.size;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.strokes = 0;
    this.error = null;
    this.resize();
  }

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.w = w; this.h = h;
  }

  frame(pool, now) {
    const ctx = this.ctx;
    // §10 — one throw inside the frame loop ends the animation for good and
    // looks exactly like a blank page. Say so on the glass instead.
    try {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.strokeStyle = '#000';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // §7 — bare ripples, grouped into four strength bands. Each one reads its
      // centre and its ink from the thought that sent it, so the water a
      // thought makes stays that thought's water for as long as it lasts.
      // §7 asked for four strength bands. Four can express an 8:1 range and a
      // ripple needs 37:1 to hold its ink from the drop to the screen edge, so
      // it went out at a quarter of the way and looked like it had popped.
      const water = new Batch(16, 2.2);
      const speed = Math.max(1e-6, CFG.carrySpeed);
      const gone = pool.reach + CFG.margin;
      for (const r of pool.ripples) {
        // Same wave speed as the ring carrying the words, measured from this
        // ripple's own birth. The word ring set off minRadius ahead of it and
        // has been travelling since the thought landed, so the gap between them
        // is minRadius + carrySpeed*(r.born - w.born) — it cannot be overtaken.
        const rad = speed * (now - r.born);
        const lead = CFG.minRadius + speed * (now - r.w.born);
        if (!(rad > 0) || rad >= lead) continue;
        // A circular wave spreads its energy round a growing circumference, so
        // it weakens as it widens — but only down to rippleFloor. It used to be
        // multiplied by a second ramp that reached zero at rippleReach, which
        // is a death, not a fade, and it arrived long before the thought's own.
        const spread = CFG.rippleFloor + (1 - CFG.rippleFloor) * Math.sqrt(CFG.minRadius / (CFG.minRadius + rad));
        // and it goes out over rippleTail at the END: whichever comes first,
        // the ripple reaching its own limit or its thought reaching the corner.
        const room = Math.min(CFG.rippleReach - rad, gone - lead);
        const tail = Math.min(1, Math.max(0, room) / Math.max(1, CFG.rippleTail));
        const a = CFG.rippleInk * spread * tail * r.strength * r.w.alpha;
        // no epsilon: below the finest band Batch.path() already draws nothing,
        // and a hard cut here was removing 61% of the live ripples every frame
        if (!(a > 0)) continue;
        const p = water.path(a, Math.max(0.15, CFG.inkWidth * 0.6 * r.w.scale));
        if (p) this.ring(p, r.w.x, r.w.y, rad, 0, Math.PI * 2);
      }

      // the rings that carry writing, and the writing itself
      const rings = new Batch(12);
      const ink = new Batch(20);
      for (const w of pool.writings) {
        const gap = drawWriting(ctx, ink, w, now);
        // one source for the radius: the same state() the writing was placed by
        const { R } = state(w, now);
        if (!(R > 0) || !isFinite(R)) continue;
        const lw = Math.max(0.15, CFG.inkWidth * 0.75 * w.scale);
        const p = rings.path(w.alpha, lw);
        if (!p) continue;
        if (!gap) this.ring(p, w.x, w.y, R, 0, Math.PI * 2);
        else if (gap.a1 - gap.a0 < Math.PI * 2 - 0.02) this.ring(p, w.x, w.y, R, gap.a1, gap.a0 + Math.PI * 2);
      }

      let n = water.stroke(ctx);
      n += rings.stroke(ctx);
      n += ink.stroke(ctx);
      this.strokes = n;
      ctx.globalAlpha = 1;
      this.error = null;
    } catch (err) {
      this.error = err && err.message ? err.message : String(err);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#000';
      ctx.font = '14px ui-monospace, monospace';
      ctx.fillText('frame stopped: ' + this.error, 20, 30);
    }
  }

  /** Diagnostic lines, drawn on the same frame they describe. */
  note(lines) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c00';
    ctx.font = '12px ui-monospace, monospace';
    lines.forEach((l, i) => ctx.fillText(l, 12, 18 + i * 15));
  }

  // §7 — true circles as arcs, four path points each, not polylines. Wobble
  // falls back to a sampled polyline. §10: ctx.arc throws on a negative or
  // non-finite radius, and one throw ends the animation for good.
  ring(path, x, y, r, a0, a1) {
    if (!(r > 0) || !isFinite(r) || !isFinite(x) || !isFinite(y)) return;
    if (!isFinite(a0) || !isFinite(a1) || a1 <= a0) return;
    if (CFG.wobble > 0) {
      const steps = Math.max(12, Math.min(180, Math.round(r * 0.25)));
      for (let i = 0; i <= steps; i++) {
        const t = a0 + (a1 - a0) * (i / steps);
        const rr = r + Math.sin(t * 3 + x * 0.01) * CFG.wobble + Math.sin(t * 5 + y * 0.013) * CFG.wobble * 0.5;
        if (!(rr > 0)) continue;
        const px = x + rr * Math.cos(t), py = y + rr * Math.sin(t);
        if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
      }
      return;
    }
    path.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0));
    path.arc(x, y, r, a0, a1);
  }
}
