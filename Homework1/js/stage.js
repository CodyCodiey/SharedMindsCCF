import { CONFIG } from './config.js';

export const stage = { width: 0, height: 0 };

export function resizeStage(width, height) {
  stage.width = width;
  stage.height = height;
}

/** The wind, never quite steady: a slow sway with a slower one under it. */
export function wind(now) {
  const t = now * 0.001;
  return {
    x: CONFIG.windBase.x
      + Math.sin(t * 0.15) * CONFIG.windSway.x
      + Math.sin(t * 0.06 + 1.1) * CONFIG.windSway.x * 0.45,
    y: CONFIG.windBase.y + Math.sin(t * 0.11 + 1.7) * CONFIG.windSway.y,
  };
}

/** How far the plant is leaning right now. */
export function sway(now) {
  const t = now * 0.001;
  return (
    Math.sin(t * 0.15) * CONFIG.swayAngle +
    Math.sin(t * 0.06 + 1.1) * CONFIG.swayAngle * 0.4
  );
}

/** The stem: rooted where it stands, bending only near the top. */
export function stem(now = 0) {
  const length = stage.height * CONFIG.stemLength;
  const baseX = stage.width * CONFIG.headAt.x;
  const baseY = stage.height * CONFIG.headAt.y + length;
  const lean = sway(now);

  // Bend grows with the square of the height, so the foot of the stem holds
  // still and all the movement gathers in the head it carries.
  const points = [];
  const samples = 26;
  let x = baseX;
  let y = baseY;
  for (let i = 0; i <= samples; i++) {
    points.push({ x, y });
    const k = i / samples;
    const angle = -Math.PI / 2 + (CONFIG.stemCurl + lean * 3) * k * k;
    x += Math.cos(angle) * (length / samples);
    y += Math.sin(angle) * (length / samples);
  }
  const top = points[points.length - 1];
  return { points, head: { x: top.x, y: top.y }, lean };
}
