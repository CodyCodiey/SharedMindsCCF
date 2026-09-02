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

export function normalize(word) {
  return word.toLowerCase().replace(/[^a-z0-9'-]/g, '').replace(/^'+|'+$/g, '');
}

/** "i've" is "i"; "doesn't" is "does". Contractions are never the subject. */
function root(norm) {
  return norm.replace(CONTRACTION, '') || norm;
}

/** Crude singularization so "robot" and "robots" count as one idea. */
export function stem(norm) {
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
  if (!norm || norm.length < 3) return false;
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

