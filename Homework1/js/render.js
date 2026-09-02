import { stage } from './stage.js';
import { drawPlant, drawFlying } from './dandelion.js';

export function draw(ctx, ghost, now) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, stage.width, stage.height);

  // Seeds already gone drift behind the plant they left.
  drawFlying(ctx);
  const anchor = drawPlant(ctx, now);
  if (ghost) drawGhost(ctx, ghost, anchor);
}

/** Words still being spoken, not yet wound onto a sail. */
function drawGhost(ctx, ghost, anchor) {
  ctx.font = 'italic 16px "Times New Roman", Times, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.fillText(ghost, anchor.x, anchor.y + 34);
  ctx.textAlign = 'left';
}
