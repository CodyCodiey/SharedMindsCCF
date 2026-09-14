// §9 — three sources, all funnelling into one words(list, time) call so nothing
// downstream can tell them apart.
//
// Each source owns a CLOCK. Typing and the microphone run on wall time; a
// transcript runs on its own timeline, which is what lets it be replayed fast
// while the speaker's real pauses still decide where thoughts break.

import { tokenise } from './words.js?v=a6732beb';

/** Typing — the fallback that is also how you test. */
export class Typing {
  constructor(input, sink) {
    this.sink = sink;
    this.pending = '';
    input.addEventListener('input', () => {
      const text = input.value;
      // everything before the last space is finished; the tail is still being typed
      const cut = text.lastIndexOf(' ');
      if (cut < 0) return;
      const done = text.slice(0, cut);
      input.value = text.slice(cut + 1);
      const list = tokenise(done);
      if (list.length) this.sink(list, performance.now());
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const list = tokenise(input.value);
      input.value = '';
      if (list.length) this.sink(list, performance.now());
    });
  }
  now() { return performance.now(); }
}

/**
 * Microphone via the Web Speech API. Chrome only, and it needs a secure
 * context — localhost counts. Errors are surfaced, not swallowed.
 */
export class Mic {
  constructor(sink, onState) {
    this.sink = sink;
    this.onState = onState || (() => {});
    this.rec = null;
    this.want = false;
    this.sent = new Map();
    this.base = 0;
    this.recent = [];        // the tail of what has actually been said
    this.rejoining = false;  // true for the first result after a restart
    this.began = new Map();  // when each utterance first appeared
    this.guess = new Map();   // the previous interim, to see what has settled
    this.lastAt = 0;         // the last moment anything was spoken
  }

  get supported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start() {
    if (!this.supported) { this.onState('unsupported: Chrome only'); return; }
    if (!window.isSecureContext) { this.onState('needs https or localhost'); return; }
    this.want = true;
    this.open();
  }

  stop() {
    this.want = false;
    if (this.rec) { try { this.rec.stop(); } catch (e) { /* already stopped */ } }
    this.onState('off');
  }

  open() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    this.rec = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => this.onState('listening');
    rec.onerror = (e) => {
      // Only a real failure stops it. 'no-speech' is how the API says "quiet so
      // far" — it fires after a few seconds of silence and the recogniser is
      // restarted underneath — and 'aborted' is that restart happening. Passing
      // either on as an error made the button drop out of its listening state
      // every ten seconds while it was, in fact, still listening.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.want = false;
      this.onState('error: ' + e.error);
    };
    rec.onend = () => {
      // auto-restart on silence
      this.sent.clear();
      this.began.clear();
      this.guess.clear();
      this.base += 1e6;
      // The result indices start again from zero, so the finished utterance can
      // arrive a second time under a fresh key with nothing to compare it to.
      this.rejoining = true;
      if (this.want) setTimeout(() => { if (this.want) this.open(); }, 250);
      else this.onState('off');
    };
    rec.onresult = (e) => {
      const t = performance.now();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const all = tokenise(res[0].transcript);
        const key = this.base + i;
        // An interim result is not spoken, but it does say WHEN this phrase
        // started — which is the only clock the words have.
        if (!this.began.has(key)) this.began.set(key, t);
        // A word is spoken once it has stopped changing.
        //
        // Waiting for the final result meant nothing could be drawn until the
        // recogniser committed, which it only does after a pause — so a
        // hesitation could never draw at the moment it was said. But emitting
        // every guess writes words that get taken back: "there is if" becomes
        // "there is if you is you if".
        //
        // A word the recogniser has now offered twice running is one it has
        // settled on. So the common prefix of this guess and the one before it
        // is safe to say; everything past that is still being decided. A final
        // result is settled by definition.
        const before = this.guess.get(key) || [];
        this.guess.set(key, all);
        let settled;
        if (res.isFinal) {
          settled = all;
        } else {
          let n = 0;
          while (n < before.length && n < all.length && before[n] === all[n]) n++;
          settled = all.slice(0, n);
        }
        const already = this.sent.get(key) || 0;
        let words = settled.slice(already);
        // Rejoining after a restart the indices begin again, so the count is no
        // help — there, compare against what was actually said.
        if (this.rejoining && words.length) {
          words = this.dropEcho(words);
          this.rejoining = false;
        }
        if (words.length) {
          // Spread the phrase across the time it actually took to say.
          //
          // Stamping every word with the moment the recogniser committed left
          // the phrase with no rhythm inside it and one long gap in front of
          // it — and since the recogniser only commits after a pause, that gap
          // ended a thought at every phrase. Spread out, the silences land
          // where the speaker actually paused.
          const began = Math.max(this.began.get(key) ?? t, this.lastAt);
          const span = Math.max(0, t - began);
          const n = words.length;
          words.forEach((w, k) => this.sink([w], n > 1 ? began + (span * k) / n : t));
          this.lastAt = t;
          this.recent = [...this.recent, ...words].slice(-60);
        }
        // never let the mark slip backwards when a guess gets shorter
        this.sent.set(key, Math.max(already, settled.length));
      }
    };
    try { rec.start(); } catch (err) { this.onState('error: ' + err.message); }
  }

  /**
   * How much of `words` has already been said.
   *
   * Not a contiguous overlap: the recogniser REVISES as well as repeats, so
   * "you told the you're the only one" comes back as "you told the only one"
   * and no run of words matches. Walking it as a subsequence of what was
   * already said finds the join anyway — every word accounted for, in order,
   * gaps allowed — and only the genuinely new tail is left.
   */
  dropEcho(words) {
    const tail = this.recent;
    let at = 0, matched = 0;
    while (matched < words.length) {
      const found = tail.indexOf(words[matched], at);
      if (found === -1) break;
      at = found + 1;
      matched++;
    }
    // Three words is the threshold. Below that it is more likely somebody
    // repeating themselves than the recogniser handing the same phrase back.
    return matched >= 3 ? words.slice(matched) : words;
  }

  now() { return performance.now(); }
}

/**
 * A video transcript, replayed on its own clock. The browser cannot fetch
 * captions cross-origin, so server/server.js shells out to yt-dlp and parses
 * the VTT to word-level timings; this just plays them back.
 */
export class Transcript {
  constructor(sink, onState) {
    this.sink = sink;
    this.onState = onState || (() => {});
    this.words = [];
    this.at = 0;
    this.rate = 1;
    this.playing = false;
    this.clock = 0;      // the transcript's own time
    this.prev = null;    // the previous frame, to advance it by
  }

  load(words) {
    this.words = words.slice().sort((a, b) => a.t - b.t);
    this.at = 0;
    this.clock = this.words.length ? this.words[0].t - 100 : 0;
    this.prev = null;
    this.onState(`${this.words.length} words`);
  }

  play() {
    if (!this.words.length) { this.onState('nothing loaded'); return; }
    if (this.at >= this.words.length) { this.at = 0; this.clock = this.words[0].t - 100; }
    this.playing = true;
    this.prev = null;
  }

  pause() { this.playing = false; this.prev = null; }

  /** The transcript's own clock, in its own milliseconds. */
  now() { return this.clock; }

  /**
   * Advanced by the frame, not by the wall. Playback that reads a wall clock
   * hands the model one enormous jump whenever frames are delayed — a
   * backgrounded tab, a slow load — and the whole transcript arrives in a
   * single frame with every thought landing at once. Stepping by the frame
   * delta (and refusing to believe a very long one) keeps the pauses real.
   */
  tick(now) {
    if (!this.playing) return;
    if (this.prev === null) this.prev = now;
    const dt = Math.min(250, Math.max(0, now - this.prev));
    this.prev = now;
    this.clock += dt * this.rate;

    const t = this.clock;
    let batch = [], stamp = null;
    while (this.at < this.words.length && this.words[this.at].t <= t) {
      // each word keeps its OWN time — that is what preserves the real pauses
      const wd = this.words[this.at++];
      if (batch.length && wd.t !== stamp) { this.sink(batch, stamp); batch = []; }
      stamp = wd.t;
      batch.push(wd.w);
    }
    if (batch.length) this.sink(batch, stamp);
    if (this.at >= this.words.length) { this.playing = false; this.onState('done'); }
  }
}
