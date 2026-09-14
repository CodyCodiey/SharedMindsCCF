// A stream of consciousness with its own clock, so the piece can be watched
// without a microphone or a network. Words repeat on purpose: that is what
// gives §5 something to remember.

const TEXT = `so the thing about the circuit is that the circuit computes with the body
| and the body is part of the circuit right
| um i mean if you take the body out of it then what you have is just a machine
| doing arithmetic
|| and nobody actually cares about arithmetic
| well maybe they do but the interesting bit is when the circuit and the body are the same thing
|| honestly i keep coming back to this
| because the circuit shows up in everything i read about cognition and perception
|| and yesterday i was making bread and the dough was doing the thinking for me
| my hands knew the dough before i did
|| the body again
| the body always the body
||| anyway`;

// Seeded, so two runs of tools/run.js can be diffed against each other. A demo
// that shuffles its own timings is not something you can regress against.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** @returns {{w:string,t:number}[]} words on the demo's own clock */
export function demoWords(seed = 20260908) {
  const rand = rng(seed);
  const out = [];
  let t = 400;
  for (const tok of TEXT.split(/\s+/)) {
    if (!tok) continue;
    if (/^\|+$/.test(tok)) { t += tok.length * 620; continue; }   // a pause, in beats
    t += 230 + rand() * 120;
    out.push({ w: tok, t: Math.round(t) });
  }
  return out;
}
