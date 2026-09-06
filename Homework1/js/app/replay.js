/**
 * Plays a fetched transcript back into the stream. Words arrive on their
 * original timing, so the pauses that shaped the real rant still shape the
 * segmentation — speed only scales how fast that clock runs.
 */
export function createReplay({ onWords, onStatus, onEnd }) {
  let words = [];
  let index = 0;
  let virtual = 0;      // transcript time, ms
  let wall = 0;         // last real timestamp, ms
  let playing = false;
  let speed = 1;
  let title = '';

  function load(record) {
    words = record.words || [];
    title = record.title || '';
    index = 0;
    virtual = 0;
    wall = performance.now();
    playing = words.length > 0;
    onStatus(playing ? `playing ${speed}×` : 'empty transcript');
  }

  function tick() {
    if (!playing) return;
    const now = performance.now();
    virtual += (now - wall) * speed;
    wall = now;

    const batch = [];
    while (index < words.length && words[index].t * 1000 <= virtual) {
      batch.push(words[index].w);
      index++;
    }
    if (batch.length) onWords(batch, virtual);

    if (index >= words.length) {
      playing = false;
      onStatus('transcript ended');
      onEnd();
    }
  }

  return {
    load,
    tick,
    get playing() { return playing; },
    get active() { return words.length > 0; },
    get title() { return title; },
    /** The model's clock while a transcript is driving it. */
    now() { return virtual; },
    progress() {
      return words.length ? index / words.length : 0;
    },
    setSpeed(value) {
      speed = value;
      if (playing) onStatus(`playing ${speed}×`);
    },
    get speed() { return speed; },
    toggle() {
      if (!words.length) return false;
      playing = !playing;
      wall = performance.now();
      onStatus(playing ? `playing ${speed}×` : 'transcript paused');
      return playing;
    },
    stop() {
      playing = false;
      words = [];
      index = 0;
    },
  };
}
