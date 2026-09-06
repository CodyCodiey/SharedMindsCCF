// Function words, discourse glue, hedges and fillers. These still appear in
// the stream as text, but they never anchor an arc or name an idea — they are
// how speech moves, not what it is about.
export const STOPWORDS = new Set(`
a an the and or but so if then than that this these those which who whom whose
of in on at to from by for with without about into onto over under through
between among across around after before during since until while
i you he she it we they me him her us them my your his its our their mine yours
myself yourself itself themselves ourselves
is am are was were be been being do does did done doing have has had having
will would can could shall should may might must let lets
not no nor yes yeah yep nope never always
just very really quite too also as up down out off back again still even only
what when where why how here there now today
like know think thing things stuff sort kind bit lot lots
mean means meant say says said saying tell tells told talk talks talked talking
go goes going went get gets got getting make makes made making
want wants wanted need needs needed try tries tried trying use uses used using
see sees saw seeing look looks looked looking come comes came take takes took
put puts guess suppose maybe probably actually basically literally obviously
sure okay ok right well right um uh er hmm ah oh yeah so-called
gonna wanna gotta kinda sorta cuz cause because though although however
whether rather instead anyway lately day days week weeks month year time times keep keeps kept coming came able means way ways
pretty real full whole half part parts side end ends start starts stop stops
feel feels felt seem seems seemed become becomes became happen happens
ago once twice soon later earlier already ever anymore else enough
somewhere anywhere everywhere nowhere everyone anyone
around away along forth ahead behind beside toward towards versus
actually honestly seriously exactly totally definitely certainly
one two three four five six seven eight nine ten first second next last
some any all both each every other another same such own more most much many
lot little few less least good bad great big small new old
someone something anything nothing everything somebody nobody everybody
period comma question mark exclamation point newline
`.trim().split(/\s+/));

// Adverbs and light morphology that survive the stopword list but never make
// a good name for an idea.
const WEAK_SUFFIX = /(?:ly|n't)$/;

const CONTRACTION = /(?:'ve|'ll|'re|'d|'s|'m|n't)$/;

// Japanese carries its grammar in particles and light verbs, the way English
// carries it in articles and prepositions. None of them are what a thought is
// about.
export const JP_STOPWORDS = new Set(`
は が を に へ と の で や か も ば ね よ な さ ぞ ぜ わ し つ っ
です ます でした ました である だった だろう でしょう ください
する した して しない します される され できる できた
ある あった ない なく なかった いる いた いない なる なった なり
これ それ あれ どれ この その あの どの ここ そこ あそこ どこ
わたし わたくし ぼく おれ あなた かれ かのじょ みんな
こと もの ため よう ところ とき ばあい かんじ
そして しかし でも だから けど けれど また まあ ただ
とても すごく ちょっと もっと すこし たくさん ぜんぶ ほとんど
やっぱり やはり たぶん もしかして なんか なんて ええと あの
から まで より など だけ しか ほど くらい ぐらい
one
`.trim().split(/\s+/));

const KANJI = /[\u4e00-\u9faf\u3400-\u4dbf]/;
const KATAKANA = /[\u30a0-\u30ff\uff66-\uff9f]/;
const HIRAGANA = /[\u3040-\u309f]/;

/** Any Japanese script at all. */
export function isJapanese(text) {
  return KANJI.test(text) || KATAKANA.test(text) || HIRAGANA.test(text);
}

export function normalize(word) {
  const text = String(word).trim();
  if (isJapanese(text)) {
    // Keep the script, drop the punctuation.
    return text.replace(/[\u3000-\u303f\uff01-\uff0f\uff1a-\uff20]/g, '');
  }
  return text.toLowerCase().replace(/[^a-z0-9'-]/g, '').replace(/^'+|'+$/g, '');
}

/** "i've" is "i"; "doesn't" is "does". Contractions are never the subject. */
function root(norm) {
  return norm.replace(CONTRACTION, '') || norm;
}

/** Crude singularization so "robot" and "robots" count as one idea. */
export function stem(norm) {
  if (isJapanese(norm)) return norm;   // no inflection to strip here
  norm = root(norm);
  if (norm.length > 4 && norm.endsWith('ies')) return norm.slice(0, -3) + 'y';
  if (norm.length > 4 && norm.endsWith('ses')) return norm.slice(0, -2);
  if (norm.length > 3 && norm.endsWith('s') && !norm.endsWith('ss')) return norm.slice(0, -1);
  if (norm.length > 5 && norm.endsWith('ing')) return norm.slice(0, -3);
  if (norm.length > 4 && norm.endsWith('ed')) return norm.slice(0, -2);
  return norm;
}

/** A content word: something a thought could actually be about. */
export function isContent(norm) {
  if (!norm) return false;

  if (isJapanese(norm)) {
    if (JP_STOPWORDS.has(norm)) return false;
    // Kanji and katakana carry the substance; a run of hiragana on its own is
    // usually grammar, unless it is long enough to be a word in its own right.
    if (KANJI.test(norm) || KATAKANA.test(norm)) return true;
    return norm.length >= 3;
  }

  if (norm.length < 3) return false;
  if (WEAK_SUFFIX.test(norm)) return false;
  const base = root(norm);
  if (base.length < 3) return false;
  // A stopword is a stopword in every inflection: "thinking" is no more
  // about something than "think" is.
  if (STOPWORDS.has(norm) || STOPWORDS.has(base) || STOPWORDS.has(stem(base))) {
    return false;
  }
  return /[a-z]/.test(norm);
}

