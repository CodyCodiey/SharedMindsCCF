// §4 — where a thought ends.
//
// Everything here runs on the SOURCE clock (a transcript's own timeline, or
// wall time for mic and typing), never on animation time. That is what lets a
// transcript be replayed at any speed and still break in the same places.
//
// feed() reports boundaries as data rather than closing the thought itself,
// because the pool has to seal the right ring before the word lands on it: a
// word that starts a new thought must not be written on the old one's water.

import { CFG } from './config.js?v=a6732beb';
import { isContent, isHedge, stem, bag, cosine } from './words.js?v=a6732beb';

export class Segmenter {
  constructor(onThought) {
    this.onThought = onThought || (() => {});
    this.words = [];
    this.contentStems = [];
    this.lastT = -Infinity;
  }

  get open() { return this.words.length > 0; }

  /** Returns {before, after}: why the thought ended, either side of this word. */
  feed(word, t) {
    const s = stem(word);
    const content = isContent(word);
    let before = null;

    // A change of subject is judged before the word joins, so the word that
    // turned the corner starts the new thought rather than ending the old one.
    if (this.open && content && this.turnedAway(s)) before = 'subject';
    // Silence is judged against the previous word's own time.
    else if (this.open && t - this.lastT >= CFG.pauseMs) before = 'silence';
    if (before) this.close(before);

    this.words.push({ word, stem: s, content, t });
    if (content) this.contentStems.push(s);
    this.lastT = t;

    let after = null;
    // A hedge is where a thought ran out, so it ends the thought it trails. As
    // the FIRST word there is nothing yet to run out of: "well i mean it is"
    // is one thought, not "well" and then the rest (§6 measures it as one).
    if (CFG.breakOnHedge && isHedge(word) && this.words.length > 1) after = 'hedge';
    else if (this.words.length >= CFG.maxWords) after = 'length';
    else if (this.contentStems.length >= CFG.contentMax) after = 'content';
    if (after) this.close(after);

    return { before, after };
  }

  // §4: the recent content words no longer echoing what the thought has been
  // about. The window is judged against what came BEFORE it — measured against
  // the whole thought it would always contain itself and never fire.
  turnedAway(incoming) {
    // The thought is cut off at contentMax content words, and detecting drift
    // needs a whole window of off-topic words to arrive before that. A window
    // near the cap leaves room for exactly one check, with most of the window
    // still on-topic — so the window shrinks with the cap rather than quietly
    // putting the rule out of reach.
    const w = Math.max(1, Math.min(Math.round(CFG.cohesionWindow),
                                   Math.max(1, Math.floor(CFG.contentMax / 3))));
    const back = w - 1;
    // slice(-0) is slice(0) — the whole array, not an empty tail. With a
    // window of 1 that made `recent` the entire history and the rule could
    // never fire.
    const recent = [...(back > 0 ? this.contentStems.slice(-back) : []), incoming];
    const before = this.contentStems.slice(0, Math.max(0, this.contentStems.length - back));
    // The thought is cut off at contentMax content words, so asking for
    // contentMin before the rule may fire can put it out of reach entirely.
    // Ask for what is actually reachable instead of silently never firing.
    const need = Math.max(1, Math.min(CFG.contentMin, CFG.contentMax - w));
    if (before.length < need) return false;
    return cosine(bag(before), bag(recent)) < CFG.cohesion;
  }

  /** Called every frame with the source clock so a trailing silence still closes. */
  tick(t) {
    if (this.open && t - this.lastT >= CFG.pauseMs) { this.close('silence'); return 'silence'; }
    return null;
  }

  close(why) {
    if (!this.words.length) return;
    const thought = { words: this.words, why, start: this.words[0].t, end: this.lastT };
    this.words = [];
    this.contentStems = [];
    this.onThought(thought);
  }

  // Convenience for the terminal tool, where nothing rides the water.
  push(word, t) { return this.feed(word, t); }
}

export const asText = (thought) => thought.words.map((w) => w.word).join(' ');
