import { CONFIG } from './config.js';
import { stage, stem, wind } from './stage.js';

/**
 * A dandelion that is already whole: a full head of bare seeds, standing in
 * the wind. Speaking winds words around one of them, spiralling outward into
 * a sail — the longer the thought, the wider the sail and the more wind it
 * catches when it finally lets go.
 */
export const head = {
  seeds: [],
  flying: [],
  active: null,
  buffer: [],
  lastWordAt: 0,
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
let placed = 0;

function makeSeed() {
  const seed = {
    angle: placed * GOLDEN,
    reach: CONFIG.seedReach + (Math.random() - 0.5) * CONFIG.reachJitter,
    words: [],
    sailR: 0,
    alpha: 0,
    spin: 0,
    spinRate: 0,
    wobblePhase: Math.random() * Math.PI * 2,
  };
  seed.angle += (Math.random() - 0.5) * CONFIG.angleJitter;
  placed++;
  return seed;
}

export function fillHead() {
  head.seeds = [];
  head.flying = [];
  head.active = null;
  head.buffer = [];
  placed = 0;
  for (let i = 0; i < CONFIG.seedCount; i++) head.seeds.push(makeSeed());
}

export function addWords(words, now) {
  // The first word of a thought picks the seed that will carry it.
  if (!head.active) head.active = pickSeed();
  if (!head.active) return;
  for (const word of words) head.active.words.push(word);
  head.lastWordAt = now;
}

/** Whichever bare seed is nearest the top of the head takes the next thought. */
function pickSeed() {
  const bare = head.seeds.filter((s) => !s.words.length && s.alpha > 0.4);
  if (!bare.length) return head.seeds.find((s) => !s.words.length) || null;
  return bare[Math.floor(Math.random() * bare.length)];
}

/** The thought is done: this seed lets go, carried by the sail it grew. */
export function release(now) {
  const seed = head.active;
  head.active = null;
  if (!seed || !seed.words.length) return;

  const { head: anchor } = stem(now);
  const tip = seedTip(anchor, seed);
  seed.x = tip.x;
  seed.y = tip.y;

  const w = wind(now);
  // A bigger sail catches more of the same wind.
  const catch_ = 1 + seed.sailR * CONFIG.sailCatch;
  seed.vx = w.x * catch_ + (Math.random() - 0.5) * CONFIG.liftJitter;
  seed.vy = w.y * catch_ + (Math.random() - 0.5) * CONFIG.liftJitter;
  seed.spinRate = (Math.random() - 0.5) * CONFIG.driftSpin * 2;

  head.seeds.splice(head.seeds.indexOf(seed), 1);
  head.flying.push(seed);
  head.seeds.push(makeSeed());   // the head grows a new bare seed in its place
}

function seedTip(anchor, seed) {
  return {
    x: anchor.x + Math.cos(seed.angle) * seed.reach,
    y: anchor.y + Math.sin(seed.angle) * seed.reach,
  };
}

export function tickSeeds(now) {
  for (const seed of head.seeds) seed.alpha += (1 - seed.alpha) * CONFIG.regrowEase;

  const w = wind(now);
  for (let i = head.flying.length - 1; i >= 0; i--) {
    const seed = head.flying[i];
    seed.wobblePhase += CONFIG.wobbleRate;
    // Still in the same wind it left in, and still swaying with it.
    // It keeps taking the wind, and the wind keeps building under the sail.
    const catch_ = 1 + seed.sailR * CONFIG.sailCatch;
    seed.vx += (w.x * catch_ - seed.vx) * 0.05;
    seed.vy += (w.y * catch_ - seed.vy) * 0.05;
    seed.vx *= CONFIG.gust;
    seed.vy *= CONFIG.gust;
    seed.x += seed.vx + Math.cos(seed.wobblePhase) * CONFIG.wobble;
    seed.y += seed.vy + Math.sin(seed.wobblePhase) * CONFIG.wobble * 0.6;
    seed.spin += seed.spinRate;

    const outside = Math.max(
      -seed.x - seed.sailR, seed.x - seed.sailR - stage.width,
      -seed.y - seed.sailR, seed.y - seed.sailR - stage.height, 0
    );
    seed.alpha = Math.max(0, 1 - outside / CONFIG.fadeMargin);
    if (seed.alpha <= 0) head.flying.splice(i, 1);
  }
}

/* ---- drawing ---- */

export function drawPlant(ctx, now) {
  const { points, head: anchor } = stem(now);

  ctx.lineCap = 'round';
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
  ctx.arc(anchor.x, anchor.y, CONFIG.headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return anchor;
}

export function drawFlying(ctx) {
  for (const seed of head.flying) {
    ctx.save();
    ctx.translate(seed.x, seed.y);
    ctx.rotate(seed.spin);
    drawSeedForm(ctx, seed, { x: 0, y: 0 }, seed.alpha);
    ctx.restore();
  }
}

/** The achene, its bare pappus, and — if it has been spoken into — its sail. */
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

function drawPappus(ctx, alpha) {
  if (alpha < 0.02) return;
  ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
  ctx.lineWidth = 0.6;
  const n = CONFIG.filaments;
  for (let i = 0; i < n; i++) {
    const a = -CONFIG.filamentSpread + (i / (n - 1)) * CONFIG.filamentSpread * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      Math.cos(a) * CONFIG.filamentLength * 0.55,
      Math.sin(a) * CONFIG.filamentLength * 0.4,
      Math.cos(a) * CONFIG.filamentLength,
      Math.sin(a) * CONFIG.filamentLength
    );
    ctx.stroke();
  }
}

/**
 * The sail: every word of the thought wound outward around the seed, each set
 * along the tangent so the line of speech curls into a disc. Its outer radius
 * is what the wind pushes on.
 */
function drawSail(ctx, seed, at, alpha) {
  ctx.font = CONFIG.sailFont;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const space = ctx.measureText(' ').width;
  let theta = 0;
  let r = CONFIG.sailInner;

  ctx.save();
  ctx.translate(at.x, at.y);

  for (const word of seed.words) {
    const width = ctx.measureText(word).width;
    r = Math.min(CONFIG.sailMax, CONFIG.sailInner + CONFIG.sailPitch * theta);

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

  // Ease the recorded radius so the wind's grip grows smoothly.
  seed.sailR += (r - seed.sailR) * CONFIG.sailEase;
}
