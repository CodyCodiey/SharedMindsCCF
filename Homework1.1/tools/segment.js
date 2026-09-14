// Read step 2 of the build order: print the thoughts as plain text and look at
// them. Usage: node tools/segment.js  (reads a sample, or stdin)
import { Segmenter, asText } from '../src/segmenter.js?v=a6732beb';
import { tokenise } from '../src/words.js?v=a6732beb';

const sample = `so the thing about the circuit is that the circuit computes with
the body and the body is part of the circuit right um i mean if you take the
body out of it then what you have is just a machine that is basically doing
arithmetic and nobody actually cares about arithmetic well maybe they do but
the interesting bit is when the circuit and the body are the same thing
honestly i keep coming back to this because the circuit again and again shows
up in everything i read about cognition and perception and the extended mind
and yesterday i was making bread and the dough was doing the thinking for me`;

const text = process.argv[2] || sample;
const words = tokenise(text);
let t = 0;
const seg = new Segmenter((th) => {
  console.log(`[${th.why.padEnd(7)}] ${asText(th)}`);
});
for (const w of words) {
  // fake a speaking rhythm: 260ms a word, with a long pause at every 'yesterday'
  t += w === 'yesterday' ? 1400 : 260;
  seg.push(w, t);
}
seg.tick(t + 5000);
