// Headless check of the whole pipeline. §10: measure internals, not pixels —
// when a number looks wrong, suspect the ruler first, so this reads the
// geometry that goes into the path rather than looking at rendered frames.

class P2D {
  constructor() { this.cmds = []; }
  moveTo(x, y) { this.cmds.push(['m', x, y]); }
  lineTo(x, y) { this.cmds.push(['l', x, y]); }
  arc(x, y, r, a0, a1) { this.cmds.push(['a', x, y, r, a0, a1]); }
}
globalThis.Path2D = P2D;
globalThis.window = { devicePixelRatio: 2, innerWidth: 1200, innerHeight: 800 };

const ctxStub = {
  globalAlpha: 1, lineWidth: 1, strokeStyle: '', fillStyle: '', font: '',
  lineCap: '', lineJoin: '',
  setTransform() {}, fillRect() {}, fillText() {}, stroke() { ctxStub.strokes++; },
  strokes: 0,
};
const canvasStub = { width: 0, height: 0, clientWidth: 1200, clientHeight: 800, getContext: () => ctxStub };

const { CFG } = await import('../src/config.js?v=a6732beb');
const { Pool } = await import('../src/pool.js?v=a6732beb');
const { Renderer } = await import('../src/render.js?v=a6732beb');
const { drawWriting, state } = await import('../src/ink.js?v=a6732beb');
const { layout } = await import('../src/cursive.js?v=a6732beb');

const line = (s) => console.log(s);

// The spec's own §12 numbers. The piece has since been tuned away from several
// of them, but these checks are on the FORMULAS, so they pin the constants the
// measurements were taken with — and put back whatever they changed (§10).
const SPEC = {
  em: 30, letterHeight: 0.56, letterWidth: 0.72, letterSpacing: 0.09, wordGap: 1,
  ascender: 0.8, descender: 1.1, minRadius: 120, fill: 0.78, spreadTo: 1.1,
  carrySpeed: 0.016, minGap: 1.15, formMs: 1600, floatRise: 1.7, coilStagger: 0.8,
  shapeFrom: 0.22, floatDrift: 0.35,
};
function underSpec(fn) {
  const kept = {};
  for (const k of Object.keys(SPEC)) { kept[k] = CFG[k]; CFG[k] = SPEC[k]; }
  try { return fn(); } finally { Object.assign(CFG, kept); }
}

/* -------- §2.5: the writing waits for water -------------------------------- */
line('\n§2.5  a word is drawn only once the ring can carry it   [at §12 settings]');
underSpec(() => {
  const w = { layout: layout('x'.repeat(400)), scale: 1, born: 0 };
  for (const R of [143, 419]) {
    const t = (R - CFG.minRadius) / CFG.carrySpeed;
    const s = state(w, t);
    line(`  R=${R.toFixed(0).padStart(3)}px  grow=${s.grow.toFixed(3)}  em=${s.em.toFixed(1)}px  carried=${s.carried.toFixed(1)}em`);
  }
  // the spec measured 52% of a sentence at 143px and 87% at 419px
  const sentenceEm = 37.7;
  for (const R of [143, 419]) {
    const t = (R - CFG.minRadius) / CFG.carrySpeed;
    const c = Math.min(sentenceEm, state({ layout: { width: sentenceEm }, scale: 1, born: 0 }, t).carried);
    line(`  a 37.7em sentence at R=${R}: ${(c / sentenceEm * 100).toFixed(0)}% carried   (spec: ${R === 143 ? 52 : 87}%)`);
  }
});

/* -------- §3: the line becomes the words ----------------------------------- */
line('\n§3    ink rising off its ring, one letter forming   [at §12 settings]');
underSpec(() => {
  const w = {
    kind: 'spoken', text: 'l', layout: layout('l'), x: 0, y: 0,
    born: 0, scale: 1, wordBorn: [], seed: 0.3, alpha: 1, sealed: true,
  };
  const batch = { path: () => (batch.last = new P2D()) };
  const marks = [];
  for (let t = 0; t <= 2600; t += 100) {
    batch.last = null;
    drawWriting(ctxStub, batch, w, t);
    const { R } = state(w, t);
    if (!batch.last || !batch.last.cmds.length) { marks.push([t, null]); continue; }
    let hi = -Infinity;
    for (const c of batch.last.cmds) hi = Math.max(hi, Math.hypot(c[1], c[2]) - R);
    marks.push([t, hi]);
  }
  const shown = marks.filter((m) => m[1] !== null);
  line('  ms:   ' + shown.map((m) => String(m[0]).padStart(5)).join(''));
  line('  above:' + shown.map((m) => (m[1] > -900 ? m[1].toFixed(0) : '-').padStart(5)).join(''));
  const settled = shown[shown.length - 1][1];
  line(`  peak ${Math.max(...shown.map((m) => m[1])).toFixed(0)}px, settles ${settled.toFixed(0)}px   (spec: rises to 62, settles 31)`);
});

/* -------- §6: what a thought carries --------------------------------------- */
line('\n§6    charge');
{
  const mk = (text) => {
    const p = new Pool();
    p.size(1200, 800);
    let t = 0;
    for (const word of text.split(' ')) { t += 260; p.words([word], t); }
    p.tick(t + 5000);
    return p.log;
  };
  for (const e of mk('well i mean it is')) line(`  [${e.why}] "${e.text}" -> carries ${e.charge}`);
  // a seventeen-word sentence in which every word means something and every
  // word has been said before — the §6 anchor: it should carry 17 and send 17.
  {
    const p = new Pool();
    p.size(1200, 800);
    const keep = { maxWords: CFG.maxWords, contentMax: CFG.contentMax, breakOnHedge: CFG.breakOnHedge, cohesion: CFG.cohesion };
    CFG.maxWords = 17; CFG.contentMax = 99; CFG.breakOnHedge = false; CFG.cohesion = -1;
    const s = 'neural circuit computes distributed representation across cortical columns during sustained attention within visual hierarchy beneath predictive load';
    let t = 0;
    for (const word of s.split(' ')) { t += 200; p.words([word], t); }   // say it once to index it
    for (const word of s.split(' ')) { t += 200; p.words([word], t); }   // now every word is an echo
    p.tick(t + 5000);
    const e = p.log[p.log.length - 1];
    line(`  [${e.why}] ${e.said} loaded words -> carries ${e.charge}   (spec: 17 words -> 17)`);
    // §10: module-level config is shared between instances; restore what you change.
    Object.assign(CFG, keep);
  }
}

/* -------- §5: memory -------------------------------------------------------- */
line('\n§5    a word brings back its past');
// What a recurrence WANTS to throw is round(priorCount ^ connotation); what it
// actually throws also skips any past the water is already carrying, so the two
// are reported apart — otherwise the check silently measures screen state.
{
  const want = (n) => Math.min(CFG.maxDroplets, n, Math.max(1, Math.round(Math.pow(n, CFG.connotation))));
  line('  wanted, by priorCount ^ connotation: ' +
    [1, 2, 3, 4, 8, 17].map((n) => `${n}->${want(n)}`).join('  '));
}
{
  const p = new Pool();
  p.size(1200, 800);
  let t = 0;
  const text = 'the circuit computes with the body and the circuit is the body the circuit again and the circuit once more the circuit returns';
  const before = [];
  for (const word of text.split(' ')) {
    t += 400;
    const n0 = p.writings.length;
    p.words([word], t);
    const made = p.writings.filter((w) => w.kind === 'recall').length;
    before.push([word, made]);
  }
  let prev = 0;
  for (const [word, made] of before) {
    if (made > prev) line(`  "${word}" threw ${made - prev} droplet(s)  [after skipping what was already floating]`);
    prev = made;
  }
  const frags = p.writings.filter((w) => w.kind === 'recall').map((w) => `"${w.text}"`);
  line('  carrying: ' + frags.slice(0, 4).join(', '));
}

/* -------- §10: stroke calls ------------------------------------------------- */
line('\n§10   every stroke() is a rasterised path with fixed cost');
{
  const view = new Renderer(canvasStub);
  const p = new Pool();
  p.size(1200, 800);
  let t = 0;
  const text = ('the circuit computes with the body and the body is part of the circuit i keep coming back to this '
    + 'because the circuit shows up in everything i read about cognition and perception and the extended mind ').repeat(3);
  for (const word of text.trim().split(/\s+/)) { t += 260; p.words([word], t); }
  p.update(t);
  ctxStub.strokes = 0;
  view.frame(p, t);
  line(`  ${p.writings.length} written rings + ${p.ripples.length} ripples  ->  ${view.strokes} stroke calls`);
  line(`  frame error: ${view.error || 'none'}`);
}
