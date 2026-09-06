import { tokenize, thoughtEnded, scoreWords, extractTopic } from './text.js';

/**
 * Watches speech go by and decides where one thought ends and the next
 * begins, handing each finished thought to whoever asked for it — already
 * scored, named, and quoted.
 */
export function createThoughts(options = {}) {
  const o = {
    min: 8, max: 20, block: 10, threshold: 0.11,
    maxWords: Infinity,     // words said, not just the ones that carry meaning
    pauseMs: 3200,
    onWords: () => {},
    onEnd: () => {},
    ...options,
  };

  const state = {
    tokens: [],        // of the thought in progress
    keys: [],
    docFreq: new Map(),
    docCount: 0,
    lastWordAt: 0,
    index: 0,          // how many thoughts have finished
  };

  function end(t) {
    if (!state.tokens.length) return;
    const tokens = state.tokens;
    const keys = state.keys;
    state.tokens = [];
    state.keys = [];

    if (keys.length >= 3) {
      state.docCount++;
      for (const k of new Set(keys)) {
        state.docFreq.set(k, (state.docFreq.get(k) || 0) + 1);
      }
      const scores = scoreWords(keys, state.docFreq, state.docCount);
      const topic = extractTopic(tokens, scores, o);
      if (topic.label) {
        o.onEnd({ tokens, keys, scores, topic, index: state.index++, t });
      }
    }
  }

  return {
    state,
    /** Change how a thought is bounded while it is running. */
    configure(changes) { Object.assign(o, changes); },
    add(words, t) {
      const tokens = tokenize(words);
      if (!tokens.length) return [];
      for (const tk of tokens) {
        state.tokens.push(tk);
        if (tk.content) state.keys.push(tk.key);
      }
      state.lastWordAt = t;
      o.onWords(tokens, state.index, t);
      if (thoughtEnded(state.keys, o, state.tokens.length)) end(t);
      return tokens;
    },
    tick(now) {
      if (state.tokens.length && now - state.lastWordAt > o.pauseMs) end(now);
    },
    end,
    reset() {
      state.tokens = []; state.keys = [];
      state.docFreq = new Map(); state.docCount = 0;
      state.index = 0; state.lastWordAt = 0;
    },
  };
}
