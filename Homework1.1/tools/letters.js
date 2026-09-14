// §13.3 — look at the letters before trusting them.
// Usage: node tools/letters.js [text] [rows]
//
// The sampler works in EM units (x-height = CFG.letterHeight em), so the guide
// lines have to be in em units too or ascenders fall off the top of the grid.
import { sampleGlyph, layout } from '../src/cursive.js?v=a6732beb';
import { CFG } from '../src/config.js?v=a6732beb';

const text = process.argv[2] || 'abcdefghijklmnopqrstuvwxyz';
const rows = Number(process.argv[3] || 28);

const top = (1 + CFG.ascender) * CFG.letterHeight + 0.08;
const bot = -CFG.descender * CFG.letterHeight - 0.08;
const cellY = (top - bot) / (rows - 1);
const asp = 2.0;                       // terminal cells are ~2x taller than wide
const cellX = cellY / asp;
const pxPerEm = 1 / cellY;             // grid rows per em

function render(str) {
  const { letters, width } = layout(str);
  const pad = 3;
  const cols = Math.ceil(width / cellX) + pad + 2;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
  const put = (ex, ey, mark) => {
    const cx = Math.round(ex / cellX) + pad;
    const cy = Math.round((top - ey) / cellY);
    if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) grid[cy][cx] = mark;
  };
  for (const L of letters) {
    const g = sampleGlyph(L.ch, pxPerEm * CFG.letterHeight, 0);
    const starts = new Set(g.starts);
    for (let i = 1; i < g.count; i++) {
      if (starts.has(i)) continue;     // the pen is lifted here
      const dx = g.x[i] - g.x[i - 1], dy = g.y[i] - g.y[i - 1];
      const n = Math.ceil(Math.max(Math.abs(dx) / cellX, Math.abs(dy) / cellY)) + 1;
      for (let s = 0; s <= n; s++) put(L.at + g.x[i - 1] + dx * s / n, g.y[i - 1] + dy * s / n, '#');
    }
  }
  for (let c = 0; c < cols; c++) {
    for (const yv of [0, CFG.letterHeight]) {
      const cy = Math.round((top - yv) / cellY);
      if (grid[cy] && grid[cy][c] === ' ') grid[cy][c] = '.';
    }
  }
  return grid.map((r) => r.join('').replace(/\s+$/, '')).join('\n');
}

for (const chunk of text.match(/.{1,14}/g) || []) console.log(render(chunk) + '\n');
