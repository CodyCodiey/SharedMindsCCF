// Tokenising, stemming, and deciding which words mean something.

// §4: the sound of a thought running out.
export const HEDGES = new Set([
  'um', 'uh', 'er', 'erm', 'hmm', 'ah', 'oh', 'like', 'well', 'anyway',
  'basically', 'actually', 'literally', 'honestly', 'kinda', 'sorta', 'maybe',
  'perhaps', 'probably', 'whatever', 'right', 'okay', 'yeah',
]);

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'because', 'as',
  'of', 'at', 'by', 'for', 'with', 'about', 'into', 'through', 'to', 'from',
  'in', 'on', 'off', 'out', 'over', 'under', 'up', 'down', 'again', 'once',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does',
  'did', 'doing', 'have', 'has', 'had', 'having', 'will', 'would', 'shall',
  'should', 'can', 'could', 'may', 'might', 'must', 'i', 'me', 'my', 'myself',
  'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it',
  'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'there',
  'here', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'now', 'also', 'get', 'got', 'go', 'going', 'know', 'think', 'mean',
  'thing', 'things', 'really', 'much', 'many', 'one', 'two', 'lot', 'bit',
  'want', 'need', 'make', 'made', 'say', 'said', 'see', 'come', 'came',

  // Contractions are grammar, not meaning. They arrive both ways: a hand-made
  // caption track keeps the apostrophe, an automatic one usually drops it, and
  // "it's" was the most-repeated "meaningful" word in a 94-minute talk.
  "i'm", "i've", "i'll", "i'd", "it's", "that's", "there's", "here's",
  "what's", "who's", "let's", "he's", "she's", "we're", "we've", "we'll",
  "we'd", "you're", "you've", "you'll", "you'd", "they're", "they've",
  "they'll", "they'd", "don't", "doesn't", "didn't", "isn't", "aren't",
  "wasn't", "weren't", "can't", "couldn't", "wouldn't", "shouldn't", "won't",
  "haven't", "hasn't", "hadn't", "ain't",
  'im', 'ive', 'ill', 'youre', 'youve', 'youll', 'youd', 'hes', 'shes',
  'weve', 'were', 'theyre', 'theyve', 'theyll', 'theyd', 'thats', 'whats',
  'theres', 'heres', 'whos', 'lets', 'dont', 'doesnt', 'didnt', 'isnt',
  'arent', 'wasnt', 'werent', 'cant', 'cannot', 'couldnt', 'wouldnt',
  'shouldnt', 'wont', 'havent', 'hasnt', 'hadnt', 'aint',
  'gonna', 'wanna', 'gotta', 'yall', 'cuz', 'cos', 'coz',
]);

// Split anything a source hands us into single words. Apostrophes survive;
// everything else is a separator.
//
// Accents are folded to the base letter first — captions are full of them, and
// splitting on [a-z] alone turned "café" into "caf" and "naïve" into "na","ve".
// Letters outside Latin are kept rather than deleted, so a transcript in
// another script still segments into thoughts and still remembers its own
// words; the hand only has Latin letterforms, so it draws them as plain marks.
export function tokenise(text) {
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .split(/[^\p{L}\p{N}']+/u)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

// A small suffix stemmer. It only has to make "circuit"/"circuits" collide;
// it is not trying to be Porter.
export function stem(word) {
  let w = word
    .replace(/n't$/, '')            // don't -> do, doesn't -> does
    .replace(/'(s|re|ve|ll|d|m|t)$/, '');
  if (w.length > 4 && /(ies)$/.test(w)) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && /(sses|shes|ches|xes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && /[^s]s$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && /ingly$/.test(w)) w = w.slice(0, -5);
  else if (w.length > 4 && /ing$/.test(w)) w = w.slice(0, -3);
  else if (w.length > 4 && /edly$/.test(w)) w = w.slice(0, -4);
  else if (w.length > 3 && /ed$/.test(w)) w = w.slice(0, -2);
  if (w.length > 4 && /ly$/.test(w)) w = w.slice(0, -2);
  if (w.length > 4 && /(er|est)$/.test(w)) w = w.replace(/(er|est)$/, '');
  if (w.length > 2 && /([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);
  return w || word;
}

export function isContent(word) {
  if (word.length < 3) return false;
  if (HEDGES.has(word)) return false;
  if (STOP.has(word)) return false;
  // Judge the stem too, but only for a word carrying a clitic — this was
  // measured on the raw word alone, so "it's" missed "it" in the list and
  // became the most repeated word that "meant something" in a 94-minute talk.
  // Applied to every word it also swallowed real ones: "thinking" stems to
  // "think", which is in the list, and a talk about thinking lost the word.
  if (word.includes("'")) {
    const s = stem(word);
    if (s !== word && (STOP.has(s) || HEDGES.has(s))) return false;
  }
  return /\p{L}/u.test(word);
}

export function isHedge(word) {
  return HEDGES.has(word);
}

// Cosine over two bags of stems. Used to notice a change of subject.
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const o = b.get(k); if (o) dot += v * o; }
  for (const v of b.values()) nb += v * v;
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

export function bag(stems) {
  const m = new Map();
  for (const s of stems) m.set(s, (m.get(s) || 0) + 1);
  return m;
}
