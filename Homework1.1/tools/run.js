// Run the real Pool against the demo on a controlled clock and report what the
// letters are actually doing. §10: measure internals, not pixels.
class P2D { constructor(){this.n=0;} moveTo(){this.n++;} lineTo(){this.n++;} arc(){this.n++;} }
globalThis.Path2D = P2D;

const { CFG } = await import('../src/config.js?v=a6732beb');
const { Pool } = await import('../src/pool.js?v=a6732beb');
const { drawWriting, state } = await import('../src/ink.js?v=a6732beb');
const { demoWords } = await import('../src/demo.js?v=a6732beb');
const { sampleGlyph, hash } = await import('../src/cursive.js?v=a6732beb');

const SECS = Number(process.argv[2] || 16);
const W = 1500, H = 913;

const pool = new Pool();
pool.size(W, H);
const words = demoWords();
let at = 0;

// a batch that records nothing but lets drawWriting run its schedule
const nul = { path: () => new P2D() };

let CLOCK = 0;
for (CLOCK = 0; CLOCK <= SECS * 1000; CLOCK += 16) {
  pool.update(CLOCK);            // same order as the frame loop: clock first
  while (at < words.length && words[at].t <= CLOCK) {
    const t = words[at].t;
    const batch = [];
    while (at < words.length && words[at].t === t) batch.push(words[at++].w);
    pool.words(batch, t);
  }
  pool.tick(CLOCK);
  for (const w of pool.writings) drawWriting(null, nul, w, CLOCK);
}

console.log(`after ${SECS}s: ${pool.writings.length} writings, ${pool.ripples.length} ripples`);
console.log(`pool centre ${pool.cx.toFixed(0)},${pool.cy.toFixed(0)}   spread ${(CFG.dropSpread*Math.min(W,H)).toFixed(0)}px`);
console.log('\ndroplet positions (should sit within spread of centre):');
for (const w of pool.writings.slice(0, 10)) {
  const d = Math.hypot(w.x - pool.cx, w.y - pool.cy);
  console.log(`  ${w.kind.padEnd(6)} at ${w.x.toFixed(0)},${w.y.toFixed(0)}  ${d.toFixed(0)}px from centre`);
}

console.log('\nwhat each written ring is showing:');
for (const w of pool.writings) {
  const { R, em, carried } = state(w, CLOCK);
  const born = w.wordBorn.filter((x) => x !== undefined).length;
  let present = 0, sum = 0, formed = 0;
  for (const L of w.layout.letters) {
    const b = w.wordBorn[L.wordIndex];
    if (b === undefined) continue;
    const stag = L.wordLen > 1 ? L.inWord / (L.wordLen - 1) : 0;
    const p = (CLOCK - b - CFG.coilStagger * CFG.formMs * stag) / CFG.formMs;
    if (p < 0) continue;
    present++; sum += Math.min(1, p);
    if (p >= 1) formed++;
  }
  const words = w.layout.wordEnds.length;
  console.log(`  ${w.kind.padEnd(6)} R=${R.toFixed(0).padStart(4)} em=${em.toFixed(0).padStart(3)} carried=${carried.toFixed(1).padStart(5)}/${w.layout.width.toFixed(1).padEnd(5)} words ${born}/${words}  letters ${present} present ${formed} formed  mean grown ${(present?sum/present:0).toFixed(2)}`);
  console.log(`         "${w.text.slice(0, 64)}"`);
}
