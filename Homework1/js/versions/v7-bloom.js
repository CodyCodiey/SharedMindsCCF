import { createThoughts } from '../shared/thoughts.js';

export const meta = {
  id: 'bloom',
  title: '7 · Bloom & compost',
  blurb: 'A thought grows from the dirt, flowers, then dies — its words drifting down to be taken back into the soil.',
};

const FONT = '"Times New Roman", Times, serif';

const C = {
  soilAt: 0.82,          // horizon, as a fraction of the viewport
  soilDepth: 150,
  stemBase: 70,
  stemPerWord: 8.5,
  stemMax: 430,
  growEase: 0.06,
  leafWords: 5,

  bloomMs: 900,          // petals opening
  holdMs: 1100,          // the flower at its full
  wiltMs: 2200,          // stem going over, petals going grey

  petalMin: 5,
  petalMax: 13,
  petalLength: 34,
  petalWidth: 13,
  discRadius: 13,

  gravity: 0.055,
  fallDrift: 0.42,
  tumble: 0.012,
  sinkMs: 1400,          // how long a word takes to disappear into the dirt
  vigorPerWord: 0.006,   // what the soil gives back to the next flower
  maxSpecks: 500,
};

export function create() {
  let size = { w: 0, h: 0 };
  let flowers = [];
  let falling = [];
  let specks = [];
  let absorbed = 0;
  let growing = null;

  const thoughts = createThoughts({
    min: 8, max: 22, pauseMs: 2000,
    onWords(tokens, index, t) {
      if (!growing) growing = startFlower(t);
      for (const tk of tokens) {
        growing.words.push(tk.text);
        growing.buffer.push(tk.text);
        if (/[.?!]$/.test(tk.text) || growing.buffer.length >= C.leafWords) cutLeaf(growing);
      }
    },
    onEnd({ topic, t }) {
      if (!growing) return;
      cutLeaf(growing);
      growing.label = topic.label;
      growing.state = 'bloom';
      growing.stateAt = t;
      growing = null;
    },
  });

  function soilY() { return size.h * C.soilAt; }

  function startFlower(t) {
    // Everything the dirt has taken back goes into the next thing it grows.
    const vigor = 1 + Math.min(0.65, absorbed * C.vigorPerWord);
    const flower = {
      x: size.w * (0.5 + (Math.random() - 0.5) * 0.16),
      words: [], buffer: [], leaves: [],
      height: 0, targetHeight: C.stemBase * vigor,
      lean: (Math.random() - 0.5) * 0.5,
      droop: 0,
      vigor,
      bloom: 0,
      label: '',
      state: 'grow',
      stateAt: t,
      alpha: 1,
    };
    flowers.push(flower);
    return flower;
  }

  function cutLeaf(flower) {
    if (!flower.buffer.length) return;
    flower.leaves.push({
      text: flower.buffer.join(' '),
      side: flower.leaves.length % 2 === 0 ? 1 : -1,
      at: 0.3 + flower.leaves.length * 0.14,
      grow: 0,
    });
    flower.buffer = [];
    flower.targetHeight = Math.min(
      C.stemMax * flower.vigor,
      (C.stemBase + flower.words.length * C.stemPerWord) * flower.vigor
    );
  }

  /** The stem, rooted in the soil, bending more as the flower goes over. */
  function stemOf(flower) {
    const points = [];
    const samples = 24;
    let x = flower.x;
    let y = soilY();
    const bend = flower.lean + flower.droop * 2.4;
    for (let i = 0; i <= samples; i++) {
      points.push({ x, y });
      const k = i / samples;
      const angle = -Math.PI / 2 + bend * k * k;
      x += Math.cos(angle) * (flower.height / samples);
      y += Math.sin(angle) * (flower.height / samples);
    }
    return points;
  }

  /** The flower dies and lets its words go, one shaken loose at a time. */
  function shed(flower, tip) {
    for (const word of flower.words) {
      falling.push({
        text: word,
        x: tip.x + (Math.random() - 0.5) * 40,
        y: tip.y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 0.7,
        vy: -Math.random() * 0.4,
        rot: (Math.random() - 0.5) * 0.6,
        rotRate: (Math.random() - 0.5) * C.tumble,
        phase: Math.random() * Math.PI * 2,
        alpha: 1,
        sinkAt: 0,
      });
    }
    flower.words = [];
  }

  return {
    resize(ctx, w, h) { size = { w, h }; },
    words(ctx, list, t) { thoughts.add(list, t); },

    tick(now) {
      thoughts.tick(now);

      for (const flower of flowers) {
        flower.height += (flower.targetHeight - flower.height) * C.growEase;
        for (const leaf of flower.leaves) leaf.grow += (1 - leaf.grow) * 0.1;

        const since = now - flower.stateAt;
        if (flower.state === 'bloom') {
          flower.bloom = Math.min(1, since / C.bloomMs);
          if (since > C.bloomMs + C.holdMs) {
            flower.state = 'wilt';
            flower.stateAt = now;
            shed(flower, stemOf(flower).at(-1));
          }
        } else if (flower.state === 'wilt') {
          const k = Math.min(1, since / C.wiltMs);
          flower.droop = k * k;
          flower.bloom = Math.max(0, 1 - k * 1.2);
          flower.alpha = 1 - k;
          // Once it is over, the stem sinks back into the ground too.
          flower.targetHeight = flower.height * (1 - k * 0.02);
          if (k >= 1) flower.state = 'gone';
        }
      }
      flowers = flowers.filter((f) => f.state !== 'gone');

      const ground = soilY();
      for (let i = falling.length - 1; i >= 0; i--) {
        const word = falling[i];
        if (!word.sinkAt) {
          word.vy += C.gravity;
          word.phase += 0.03;
          word.x += word.vx + Math.sin(word.phase) * C.fallDrift;
          word.y += word.vy;
          word.rot += word.rotRate;
          if (word.y >= ground) {
            word.y = ground;
            word.sinkAt = now;
          }
        } else {
          // Taken back into the dirt: it settles, dims, and is gone.
          const k = Math.min(1, (now - word.sinkAt) / C.sinkMs);
          word.alpha = 1 - k;
          word.y = ground + k * 16;
          if (k >= 1) {
            falling.splice(i, 1);
            absorbed++;
            specks.push({ x: word.x, y: ground + 6 + Math.random() * C.soilDepth * 0.6 });
            if (specks.length > C.maxSpecks) specks.shift();
          }
        }
      }
    },

    draw(ctx, now) {
      const ground = soilY();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.lineCap = 'round';

      // Soil: a horizon, and under it everything that has been taken back.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, ground);
      ctx.lineTo(size.w, ground);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      for (const speck of specks) {
        ctx.beginPath();
        ctx.arc(speck.x, speck.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const flower of flowers) drawFlower(ctx, flower);

      ctx.font = `15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const word of falling) {
        ctx.save();
        ctx.translate(word.x, word.y);
        ctx.rotate(word.rot);
        ctx.fillStyle = `rgba(0, 0, 0, ${word.alpha * 0.85})`;
        ctx.fillText(word.text, 0, 0);
        ctx.restore();
      }

      if (this.ghostText && growing) {
        const tip = stemOf(growing).at(-1);
        ctx.font = `italic 15px ${FONT}`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.fillText(this.ghostText, tip.x, tip.y - 26);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    },

    ghost(text) { this.ghostText = text; },
    ghostText: '',

    reset() {
      thoughts.reset();
      flowers = []; falling = []; specks = [];
      absorbed = 0; growing = null;
    },
  };

  function drawFlower(ctx, flower) {
    const points = stemOf(flower);
    const tip = points[points.length - 1];
    const a = flower.alpha;

    ctx.strokeStyle = `rgba(0, 0, 0, ${a * 0.62})`;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // Leaves: each a phrase, set along the stem it grew on.
    ctx.font = `13px ${FONT}`;
    ctx.textBaseline = 'middle';
    for (const leaf of flower.leaves) {
      const at = points[Math.min(points.length - 1, Math.round(leaf.at * (points.length - 1)))];
      if (!at) continue;
      const width = ctx.measureText(leaf.text).width;
      const angle = (-0.5 + flower.droop * 1.1) * leaf.side;
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(leaf.side > 0 ? angle : Math.PI - angle);
      ctx.scale(leaf.grow, leaf.grow);
      const dir = leaf.side > 0 ? 1 : -1;
      ctx.textAlign = leaf.side > 0 ? 'left' : 'right';
      ctx.strokeStyle = `rgba(0, 0, 0, ${a * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dir * (width + 14), 0);
      ctx.stroke();
      if (leaf.side < 0) ctx.scale(-1, -1);
      ctx.fillStyle = `rgba(0, 0, 0, ${a * 0.8})`;
      ctx.fillText(leaf.text, leaf.side > 0 ? 10 : -10, 0);
      ctx.restore();
    }

    if (flower.bloom <= 0.01) return;

    // The head: petals opening around a disc, more of them the longer
    // the thought ran.
    const petals = Math.max(C.petalMin, Math.min(
      C.petalMax, C.petalMin + Math.floor(flower.leaves.length * 1.4)
    ));
    const open = flower.bloom;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.strokeStyle = `rgba(0, 0, 0, ${a * 0.7})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2 + flower.droop * 0.6;
      const len = C.petalLength * open * flower.vigor;
      const wide = C.petalWidth * open;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(C.discRadius * 0.7, 0);
      ctx.quadraticCurveTo(C.discRadius + len * 0.5, -wide, C.discRadius + len, 0);
      ctx.quadraticCurveTo(C.discRadius + len * 0.5, wide, C.discRadius * 0.7, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, C.discRadius * open, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(0, 0, 0, ${a * 0.8})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    if (flower.label) {
      ctx.font = `${14 * open}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0, 0, 0, ${a * open})`;
      ctx.fillText(flower.label, tip.x, tip.y - C.discRadius - C.petalLength - 12);
    }
  }
}
