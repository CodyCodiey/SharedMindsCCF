import { normalize, isContent, stem, isJapanese } from './lexicon.js';

// Japanese is written without spaces, so the words have to be found rather
// than split out. Every browser that can do speech can also do this.
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('ja', { granularity: 'word' })
  : null;

/** Split raw speech into tokens the versions can all agree on. */
export function tokenize(words) {
  const out = [];
  for (const raw of expand(words)) {
    const text = String(raw).trim();
    if (!text) continue;
    const norm = normalize(text);
    const content = isContent(norm);
    out.push({ text, norm, content, key: content ? stem(norm) : '' });
  }
  return out;
}

/** Break any Japanese in the incoming speech into its actual words. */
function expand(words) {
  if (!segmenter) return words;
  const out = [];
  for (const raw of words) {
    const text = String(raw);
    if (!isJapanese(text)) { out.push(text); continue; }
    for (const part of segmenter.segment(text)) {
      const piece = part.segment.trim();
      if (piece) out.push(piece);
    }
  }
  return out;
}

export function counts(list) {
  const m = new Map();
  for (const k of list) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

export function cosine(a, b) {
  let dot = 0;
  for (const [k, v] of a) if (b.has(k)) dot += v * b.get(k);
  if (!dot) return 0;
  let na = 0, nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  return dot / Math.sqrt(na * nb);
}

export function addVec(target, source) {
  for (const [k, v] of source) target.set(k, (target.get(k) || 0) + v);
  return target;
}

/**
 * How much this stretch of talk leans on each word, relative to every other
 * stretch: term frequency damped by how many thoughts use the word at all.
 */
export function scoreWords(keys, docFreq, docCount) {
  const tf = counts(keys);
  const scores = new Map();
  for (const [k, n] of tf) {
    const df = docFreq.get(k) || 1;
    const idf = Math.log((docCount + 1) / df) + 0.35;
    scores.set(k, (1 + Math.log(n)) * idf);
  }
  return scores;
}

/**
 * What a stretch of talk was about: the phrase the speaker leaned on, and the
 * most loaded thing they actually said, quoted rather than paraphrased.
 */
export function extractTopic(tokens, scores, options = {}) {
  const maxWords = options.labelMaxWords ?? 3;
  const keywordCount = options.keywords ?? 5;
  const fragmentWords = options.fragmentWords ?? 9;

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const keywords = ranked.slice(0, keywordCount).map(([k]) => k);
  if (!keywords.length) return { label: '', quote: '', keywords: [] };

  const top3 = new Set(keywords.slice(0, 3));
  const phrases = new Map();
  for (let n = 2; n <= maxWords; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const run = tokens.slice(i, i + n);
      // Opens and closes on something real, carries at most one glue word,
      // and never straddles the end of a sentence.
      if (!run[0].content || !run[n - 1].content) continue;
      if (run.filter((tk) => !tk.content).length > 1) continue;
      if (run.slice(0, -1).some((tk) => /[.?!]$/.test(tk.text))) continue;
      const phrase = run.map((tk) => tk.norm).join(' ');
      const weight = run.reduce(
        (sum, tk) => sum + (tk.content ? scores.get(tk.key) || 0 : 0), 0
      );
      const prev = phrases.get(phrase);
      phrases.set(phrase, { n: (prev ? prev.n : 0) + 1, weight, size: n });
    }
  }

  let best = null;
  for (const [phrase, info] of phrases) {
    const anchored = phrase.split(' ').some((w) => top3.has(stem(w)));
    if (info.n < 2 && !anchored) continue;
    const score = info.weight * (info.n > 1 ? 1.8 : 1) * (info.size > 2 ? 1.18 : 1);
    if (!best || score > best.score) best = { phrase, score };
  }

  let label = surfaceOf(tokens, keywords[0]);
  if (best && best.score > ranked[0][1] * 1.05) {
    label = best.phrase;
    for (const w of best.phrase.split(' ')) {
      const k = stem(w);
      if (isContent(w) && !keywords.includes(k)) keywords.unshift(k);
    }
  }

  return {
    label,
    quote: bestFragment(tokens, scores, label, fragmentWords),
    keywords: keywords.slice(0, keywordCount + 1),
  };
}

function surfaceOf(tokens, key) {
  for (const tk of tokens) if (tk.key === key) return tk.norm;
  return key;
}

/** The heaviest window of words in the stretch, trimmed to open and close well. */
export function bestFragment(tokens, scores, label, width) {
  const w = Math.min(width, tokens.length);
  if (!w) return '';
  const labelWords = new Set((label || '').split(' '));

  let bestScore = -1;
  let at = 0;
  for (let i = 0; i + w <= tokens.length; i++) {
    let score = 0;
    for (let j = i; j < i + w; j++) {
      const tk = tokens[j];
      if (!tk.content) continue;
      score += scores.get(tk.key) || 0;
      if (labelWords.has(tk.norm)) score += 0.6;
    }
    if (score > bestScore) { bestScore = score; at = i; }
  }

  let start = at;
  let end = at + w - 1;
  while (start < end && !tokens[start].content) start++;
  while (end > start && !tokens[end].content) end--;
  return tokens.slice(start, end + 1).map((tk) => tk.text).join(' ');
}

/**
 * Where one thought ends: the last few content words stop echoing anything
 * the thought has been about, or it simply runs too long.
 */
export function thoughtEnded(keys, options) {
  const { min, max, block, threshold } = options;
  if (keys.length >= max) return true;
  if (keys.length < min) return false;
  if (keys.length < block + min) return false;
  return cosine(counts(keys.slice(0, -block)), counts(keys.slice(-block))) < threshold;
}
