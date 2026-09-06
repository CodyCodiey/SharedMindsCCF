import { writePhrase } from './cursive.js';
export function draw(text, emRows = 8) {
  const p = writePhrase(text);
  const minY = -0.95, maxY = 1.95;
  const rows = Math.round((maxY - minY) * emRows);
  const perEmX = emRows * 2;
  const cols = Math.min(230, Math.round(p.width * perEmX) + 3);
  const g = Array.from({ length: rows }, () => Array(cols).fill(' '));
  let prev = null;
  for (const q of p.points) {
    const x = Math.round(q.x * perEmX), y = Math.round((maxY - q.y) * emRows);
    if (prev) { const n = Math.max(Math.abs(x-prev.x), Math.abs(y-prev.y), 1);
      for (let i=0;i<=n;i++){ const xi=Math.round(prev.x+(x-prev.x)*i/n), yi=Math.round(prev.y+(y-prev.y)*i/n);
        if (g[yi]&&g[yi][xi]!==undefined) g[yi][xi]='#'; } }
    prev = { x, y };
  }
  const base = Math.round(maxY * emRows), xh = Math.round((maxY-1)*emRows);
  console.log(`  ${text}`);
  g.forEach((r,i)=>{ const l=r.join('').replace(/\s+$/,'');
    if (l.trim()||i===base) console.log((i===base?'_':(i===xh?'-':' '))+l); });
  console.log();
}
for (const w of process.argv.slice(2)) draw(w);
