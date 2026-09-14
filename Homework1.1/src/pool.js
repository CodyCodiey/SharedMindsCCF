// §2, §5, §6, §7 — the water, and what falls into it.
//
// One entry point: words(list, time). Microphone, typing and transcript all
// come through here and nothing downstream can tell them apart.
//
// Two clocks, deliberately. `time` is the SOURCE clock (a transcript's own
// timeline) and decides where thoughts break; the animation runs on wall time,
// so a transcript played fast still breaks where the speaker actually paused.

import { CFG, loadedWord } from './config.js?v=a6732beb';
import { layout } from './cursive.js?v=a6732beb';
import { Segmenter } from './segmenter.js?v=a6732beb';
import { stem, isContent, tokenise } from './words.js?v=a6732beb';

export class Pool {
  constructor() {
    this.ripples = [];
    this.writings = [];
    this.stream = [];               // every word ever said, in order
    this.index = new Map();         // stem -> [positions]
    this.lastRecall = new Map();    // stem -> source time
    this.open = null;               // the thought currently falling
    this.after = [];                // thoughts still troubling the water
    this.log = [];
    this.sealed = 0;                 // only ever counts up; the log rotates
    // Words go into the stream, the index and the segmenter, but nothing
    // reaches the water. It is how a transcript can be loaded past the point
    // the frame can draw: the pool remembers all of it, and shows what it can.
    this.silent = false;
    this.clock = 0;                 // the animation clock, set by update()
    this.w = 800; this.h = 600;
    this.seg = new Segmenter();     // the pool drives the ring lifecycle itself
  }

  size(w, h) { this.w = w; this.h = h; }
  get cx() { return this.w * CFG.centreX; }
  get cy() { return this.h * CFG.centreY; }

  // The furthest screen corner: a ring is gone once it passes this.
  get reach() {
    return Math.hypot(Math.max(this.cx, this.w - this.cx), Math.max(this.cy, this.h - this.cy));
  }

  /**
   * The one way in. `list` is plain words; `time` is the SOURCE clock.
   *
   * Everything that goes in the water is stamped with this.clock, the same
   * animation clock the renderer draws with. Reading performance.now() here
   * instead lets the two drift, and a droplet born a hair after the frame it
   * is drawn in has a negative age: its ring shrinks and its letters never
   * start forming.
   */
  words(list, time) {
    // Tokenise here, not at each source. Typing and the microphone already do
    // it; a caption track does not, so 9% of a real transcript arrived with
    // punctuation still attached — "circuit," and "circuit" were two different
    // memories, and "right." and "um," never read as the hedges they are.
    for (const raw of list) for (const word of tokenise(raw)) {
      const s = stem(word);
      const content = isContent(word);
      const pos = this.stream.length;
      this.stream.push({ word, stem: s, content, t: time });

      // §5 — a word brings back its past. Judged before this occurrence is
      // indexed, so the first repeat sees exactly one prior.
      let echo = false;
      if (content) {
        const priors = this.index.get(s);
        if (priors && priors.length) { echo = true; if (!this.silent) this.recall(s, priors, time); }
        if (priors) priors.push(pos); else this.index.set(s, [pos]);
      }

      // Ask where the boundaries fall before deciding which water this word
      // lands on. A word that starts a new thought must not be written on the
      // old thought's ring.
      const ev = this.seg.feed(word, time);
      if (this.silent) {          // remembered, but it never troubles the water
        if (ev.before) this.sealed++;
        if (ev.after) this.sealed++;
        continue;
      }
      if (ev.before) this.seal(ev.before);

      // §2.1 — the first word of a thought creates the droplet, so the ring is
      // already travelling before we know how the sentence ends.
      if (!this.open) this.drop();

      // §6 — every word adds weight.
      const weight = 1 + (content ? CFG.contentWeight : 0) + (echo ? CFG.echoWeight : 0);
      this.open.weight += weight;
      // §2.2 — every word spoken sends a bare ripple out from THAT droplet.
      // The ripple belongs to the thought, and carries the weight of the word
      // that sent it: a loaded word troubles the water harder than "the".
      this.ripple(this.open, weight / loadedWord());
      // The words ride the ring as they are said; the ring reveals each one
      // only once it has widened enough to carry it.
      this.open.text = this.open.text ? this.open.text + ' ' + word : word;
      this.open.layout = layout(this.open.text);
      this.open.said++;

      if (ev.after) this.seal(ev.after);
    }
  }

  /** Called every frame on the source clock, so a trailing silence still closes. */
  tick(sourceTime) {
    if (this.seg.tick(sourceTime)) this.seal('silence');
  }

  drop() {
    const r = CFG.dropSpread * Math.min(this.w, this.h) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const w = {
      kind: 'spoken', text: '', layout: layout(''),
      x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r,
      born: this.clock, scale: 1, weight: 0, said: 0,
      wordBorn: [], seed: Math.random(), alpha: 1, sealed: false,
    };
    this.open = w;
    this.writings.push(w);
    this.ripple(w, 1);
    this.trim();
  }

  // §4 fired. The thought does not exit — it has been leaving since it arrived
  // — but it now starts spending its charge.
  seal(why) {
    const w = this.open;
    this.open = null;
    if (!w) return;
    w.sealed = true;
    w.sealedAt = this.clock;      // a thought only starts sinking once it is said
    w.why = why;
    // §6 — charge counted in fully-loaded words: "well i mean it is" -> 1,
    // a seventeen-word technical sentence -> 17.
    w.charge = Math.min(CFG.chargeMax, Math.round(w.weight / loadedWord()));
    if (w.charge > 0) this.after.push({ w, left: w.charge, next: this.clock + CFG.afterRippleMs });
    this.sealed++;
    this.log.push({ why, text: w.text, charge: w.charge, said: w.said });
    if (this.log.length > 60) this.log.shift();
  }

  // §5 — a recurrence throws round(priorCount ^ connotation) droplets, a
  // DIFFERENT earlier occurrence each, so a loaded word scatters several
  // different pasts at once.
  recall(s, priors, time) {
    // Stamped on the SOURCE clock, which restarts when the source does. Once a
    // stored time was ahead of the current clock, time - last stayed negative
    // and that word could never be remembered again.
    const last = this.lastRecall.get(s);
    if (last !== undefined && time >= last && time - last < CFG.recallGapMs) return;
    this.lastRecall.set(s, time);

    const want = Math.min(CFG.maxDroplets, priors.length,
      Math.max(1, Math.round(Math.pow(priors.length, CFG.connotation))));
    // Not every past moment is worth bringing back. A window of "and the of it"
    // carries nothing; one thick with content words, and with words that recur
    // through the talk, carries what the talk is actually about. So candidates
    // are ranked by the §6 weight of the company they kept — shuffled first, so
    // that equal-weight pasts still come back in a different order each time.
    const pick = priors.slice();
    for (let i = pick.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pick[i], pick[j]] = [pick[j], pick[i]];
    }
    const worth = new Map(pick.map((pos) => [pos, this.weighRecall(pos)]));
    pick.sort((a, b) => worth.get(b) - worth.get(a));

    // §5 wants a DIFFERENT earlier occurrence each — and that has to hold
    // against the water as well as within one throw. recallGapMs (1300) lets a
    // word throw again well inside recallLife (4200), so a fresh shuffle could
    // land on the same past three times over while the first copy was still
    // visible, and the fragment sat there doubled. Skip anything the pool is
    // already carrying, by the words it reads as rather than by its position:
    // two different occurrences of a repeated phrase say the same thing.
    const already = new Set();
    for (const x of this.writings) if (x.kind === 'recall') already.add(x.text);

    let thrown = 0;
    for (const pos of pick) {
      if (thrown >= want) break;
      const text = this.recallText(pos);
      if (!text || already.has(text)) continue;
      already.add(text);
      this.dropRecall(pos, text);
      thrown++;
    }
  }

  /**
   * What a past moment is worth surfacing, by §6's own reckoning: every content
   * word around it is worth contentWeight, and one that recurs elsewhere in the
   * talk is worth echoWeight on top — a word the speaker keeps returning to is
   * the talk's subject, not its grammar.
   */
  weighRecall(pos) {
    const from = Math.max(0, pos - CFG.recallWords);
    const to = Math.min(this.stream.length - 1, pos + CFG.recallWords);
    let worth = 0;
    for (let i = from; i <= to; i++) {
      const x = this.stream[i];
      if (!x || !x.content) continue;
      worth += CFG.contentWeight;
      const priors = this.index.get(x.stem);
      if (priors && priors.length > 1) worth += CFG.echoWeight;
    }
    return worth;
  }

  /** The words around one earlier occurrence: ±recallWords of company. */
  recallText(pos) {
    return this.stream
      .slice(Math.max(0, pos - CFG.recallWords), pos + CFG.recallWords + 1)
      .map((x) => x.word).join(' ');
  }

  dropRecall(pos, text = this.recallText(pos)) {
    if (!text) return;
    // which word of the fragment is the one that recurred
    const link = pos - Math.max(0, pos - CFG.recallWords);
    // Scattered over the pool rather than huddled just outside the ring: these
    // are other places the mind has been, so they land elsewhere. Measured
    // against the distance to the furthest corner, then kept on screen.
    const span = Math.max(0, CFG.recallFar - CFG.recallNear);
    const rad = this.reach * (CFG.recallNear + Math.random() * span);
    const ang = Math.random() * Math.PI * 2;
    const m = CFG.margin;
    const w = {
      kind: 'recall', pos, link, text, layout: layout(text),
      x: Math.min(this.w - m, Math.max(m, this.cx + Math.cos(ang) * rad)),
      y: Math.min(this.h - m, Math.max(m, this.cy + Math.sin(ang) * rad)),
      born: this.clock, scale: CFG.smallDrop, weight: 0, said: 0,
      wordBorn: [], seed: Math.random(), alpha: CFG.recallInk, sealed: true,
    };
    this.writings.push(w);
    this.ripple(w, 1);
    this.trim();
  }

  /**
   * A ripple belongs to the thought that sent it — not to a copy of where that
   * thought happened to be. It reads its centre from the writing at draw time,
   * takes the writing's ink (so a remembered fragment's water evacuates with
   * the fragment instead of outliving it at full strength), and goes when the
   * writing goes. `strength` is how hard this particular word hit the water.
   */
  /** Close whatever is mid-sentence because the clock underneath it changed.
   *  Without this, a thought begun on the wall clock is continued on a
   *  transcript's, the gap between the two words reads as hugely negative, and
   *  two unrelated sentences are welded into one. */
  cut(why = 'source') {
    this.seg.close(why);
    this.seal(why);
    this.seg.lastT = -Infinity;
  }

  /** Empty the water AND forget everything said. clear() deliberately keeps the
   *  stream and the index; this does not, because each pass of a looping talk
   *  should hear it fresh rather than remembering the last twenty times. */
  reset() {
    this.clear();
    this.stream.length = 0;
    this.index.clear();
    this.lastRecall.clear();
    this.sealed = 0;
    this.log.length = 0;
  }

  /** Empty the water. The segmenter has to let go of its half-said thought
   *  too, or the next word inherits a word count and a boundary that belong to
   *  a sentence nothing on screen remembers. */
  clear() {
    this.ripples.length = 0;
    this.writings.length = 0;
    this.after.length = 0;
    this.open = null;
    this.sealed++;
    this.seg.words = [];
    this.seg.contentStems = [];
    this.seg.lastT = -Infinity;
  }

  ripple(w, strength = 1) {
    if (!w) return;
    // A wave train has a wavelength. Travelling at carrySpeed, a word every
    // 260ms would lay rings 4px apart — which is not water, it is hatching.
    // Words said closer together than the water can separate them do not make
    // two rings; they make one, harder. A burst of speech is a bigger wave.
    const last = w.lastRipple;
    if (last && !last.dead && (this.clock - last.born) * CFG.carrySpeed < CFG.rippleGap) {
      last.strength = Math.min(1.6, last.strength + strength);
      return;
    }
    const r = { w, born: this.clock, strength };
    w.lastRipple = r;
    this.ripples.push(r);
    this.trim();
  }

  trim() {
    // Ripples get their own budget. Counting writings against it meant that a
    // pool holding maxRings writings deleted every ripple the instant it was
    // made, and the water stopped moving altogether.
    const over = this.ripples.length - CFG.maxRings;
    // Anything dropped is marked, so a writing still holding it as its most
    // recent ripple does not merge new words into an object nothing draws.
    if (over > 0) for (const r of this.ripples.splice(0, over)) r.dead = true;
  }

  /** Ages the water. Call this at the TOP of the frame: it sets the one clock
   *  everything else in the pool is stamped with. */
  update(now) {
    this.clock = now;
    // A ripple goes with the thought that sent it, or when it passes the
    // furthest screen corner — the same rule §2.7 gives a written ring. The old
    // fixed-distance life never fired at laptop size; it only mattered for a
    // thought left open forever by a paused tape, and the corner covers that.
    const far = this.reach + CFG.margin;
    this.ripples = this.ripples.filter(
      (r) => !r.w.gone && CFG.carrySpeed * (now - r.born) < far
    );

    // §6 — one further ripple every afterRippleMs, spending one unit of charge
    for (const a of this.after) {
      while (a.left > 0 && now >= a.next) {
        this.ripple(a.w, 1);
        a.left--;
        a.next += CFG.afterRippleMs;
      }
    }
    this.after = this.after.filter((a) => a.left > 0);

    // §2.7 — a written ring goes when it passes the furthest screen corner;
    // §5 — a remembered fragment fades and evacuates over recallLife.
    const edge = this.reach + CFG.margin;
    this.writings = this.writings.filter((w) => {
      const R = CFG.minRadius + CFG.carrySpeed * (now - w.born);
      let keep;
      if (w.kind === 'recall') {
        const u = (now - w.born) / Math.max(1, CFG.recallLife);
        w.alpha = u >= 1 ? 0 : CFG.recallInk * Math.pow(1 - u, CFG.recallFade);
        keep = u < 1 && R < edge;
      } else {
        // §2.7 still decides when it is gone; this only decides how loud it is
        // on the way. It holds full ink while it is being said and for a while
        // after, then lets go — the same hold-then-release the ripples use.
        const u = w.sealedAt === undefined ? 0
          : Math.min(1, (now - w.sealedAt) / Math.max(1, CFG.thoughtLife));
        const hold = 1 - CFG.thoughtLetGo;
        const s = u <= hold ? 1 : 1 - (u - hold) / Math.max(1e-6, CFG.thoughtLetGo);
        w.alpha = CFG.thoughtSink + (1 - CFG.thoughtSink) * Math.max(0, s);
        keep = R < edge || w === this.open;
      }
      // the ripples read this on the next pass and leave with it
      if (!keep) w.gone = true;
      return keep;
    });
  }
}
