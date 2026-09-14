// Every tuneable number in the piece, in one place, mirroring DROPLET.md §12.
// The control panel writes straight into CFG, so nothing may cache these values
// across frames.

export const CFG = {
  // the pool
  centreX: 0.5,
  centreY: 0.52,
  dropSpread: 0.28,
  margin: 60,
  // §7 had bare water travel twenty times faster than the ring carrying the
  // writing, and called that inconsistency worth it. It is not: rings from one
  // disturbance overtook each other and the pool read as jitter. Water does not
  // do that — every ring from a single drop travels at the same wave speed, so
  // they stay nested, evenly spaced, and never cross. So a ripple travels at
  // carrySpeed too, and can never catch the ring that carries the words.
  rippleReach: 900,   // px over which a ripple spreads itself away
  rippleGap: 30,      // the wavelength: rings closer than this merge into one
  rippleInk: 0.2,
  // A ripple used to vanish mid-journey rather than fade: `1 - rad/rippleReach`
  // drove its ink to nothing long before its thought was done, a hard epsilon
  // in the renderer cut 61% of live ripples outright, and four alpha bands can
  // only express an 8:1 range where 37:1 was needed. rippleFloor is how far
  // spreading alone may dim one; rippleTail is the distance over which it
  // actually goes, at the END of its life, where the fading belongs.
  rippleFloor: 0.35,
  rippleTail: 95,
  carrySpeed: 0.036,
  maxRings: 1400,
  wobble: 0,

  // the ring a sentence is written on
  minRadius: 20,
  fill: 1,
  gapPad: 0.05,
  spreadTo: 0.45,
  turnEase: 0.03,

  // the hand
  em: 10,
  letterHeight: 0.56,
  letterWidth: 0.72,
  letterSpacing: 0.09,
  wordGap: 1,
  ascender: 0.8,
  descender: 1.1,
  roundness: 0.74,
  handNoise: 0.022,   // per-point wander, em. §10: low-frequency ALONG the stroke
  handCycles: 0.5,    // cycles per em of stroke length. more than ~1 reads as chop
  inkWidth: 1.6,      // px at scale 1

  // taking shape
  formMs: 575,
  floatRise: 1.7,
  coilStagger: 0.45,
  floatDrift: 0.35,
  shapeFrom: 0.22,    // grown at which the chunk starts becoming a letter
  minGap: 1.15,

  // ending a thought
  maxWords: 20,
  pauseMs: 1640,
  breakOnHedge: true,
  contentMin: 5,      // cohesion may not fire before this many content words
  contentMax: 10,     // a thought ends here regardless
  cohesionWindow: 4,  // the recent content words judged against the rest
  cohesion: 0.13,

  // a thought sinking
  // §2.7 has a spoken thought hold full ink until it leaves the screen. With a
  // thought landing every few seconds and a ring taking ~52s to clear the
  // corner, that stacks a dozen sentences at full strength through the same
  // wedge of the pool. So a thought now recedes once it has been said: it goes
  // on travelling, but it sinks into the water and lets the newest one speak.
  // §10's rule holds — dim by INK, never by how far the letters formed.
  thoughtLife: 7000,
  thoughtLetGo: 0.6,
  thoughtSink: 0.08,

  // memory
  connotation: 0.72,
  maxDroplets: 5,
  recallWords: 4,
  recallGapMs: 1300,
  recallLife: 4200,
  recallInk: 0.6,
  recallFade: 1.2,
  smallDrop: 0.62,
  // The word that dragged the memory up sits at the centre of the fragment.
  // It is drawn at the fragment's full ink and a heavier stroke; the company it
  // kept is dimmed to linkDim, so the link reads first and the rest is context.
  // Black on white throughout (§1), so the highlight is weight, not colour.
  linkDim: 0.42,
  linkWeight: 1.7,
  recallNear: 0.28,   // × the distance to the furthest corner
  recallFar: 0.92,
  contentWeight: 1.4,
  echoWeight: 2.2,
  chargeMax: 42,
  afterRippleMs: 620,
};

// One fully-loaded word's weight. Charge is counted in these, so a thought's
// charge reads as "how many loaded words' worth of trouble it left in the water".
export const loadedWord = () => 1 + CFG.contentWeight + CFG.echoWeight;

// The controls, in two groups. Everything not here is a settled constant: the
// letterforms and the way ink lifts off the water were the parts worth leaving
// alone. `export settings` prints all of them.
export const SCHEMA = [
  ['the pool', [
    ['carrySpeed', 0.004, 0.14, 0.001, 'speed',
     'how fast the water moves — the words and their ripples together'],
    ['minRadius', 20, 400, 5, 'ring',
     'how wide the ring is when a thought lands, and how far its ripples trail behind'],
    ['em', 4, 60, 1, 'hand',
     'how big the writing is — a smaller hand fits more of a sentence on the ring'],
    ['fill', 0.15, 1, 0.01, 'wrap',
     'how far round the ring a sentence reaches (this alone sets the angle: 2π × wrap)'],
    ['formMs', 150, 3000, 25, 'forming',
     'how long a letter takes to leave the water and become itself'],
    ['dropSpread', 0, 0.5, 0.01, 'scatter',
     'how far from the centre thoughts land'],
    ['rippleInk', 0, 1, 0.01, 'water',
     'how present the ripples are'],
    ['rippleTail', 10, 600, 5, 'fade',
     'the distance a ripple takes to fade out at the end, instead of vanishing'],
  ]],
  ['thoughts', [
    ['pauseMs', 120, 3000, 20, 'pause',
     'the silence that ends a thought'],
    ['maxWords', 3, 60, 1, 'length',
     'words said before a thought breaks'],
    ['contentMax', 2, 30, 1, 'weight',
     'words that mean something before a thought breaks'],
    ['cohesion', 0, 0.6, 0.005, 'subject',
     'how far the words must drift to count as a change of subject'],
    ['breakOnHedge', 0, 1, 1, 'hedges',
     'let um, well, like, actually end a thought where it ran out'],
    ['thoughtLife', 500, 60000, 250, 'sinking',
     'how long a thought stays loud before it sinks into the water'],
    ['maxDroplets', 0, 12, 1, 'references',
     'how many past moments a word may bring back at once'],
    ['recallWords', 1, 10, 1, 'fragment',
     'how many words either side of a remembered word come back with it'],
    ['recallLife', 800, 20000, 100, 'holding',
     'how long a remembered fragment stays before it evacuates'],
  ]],
];
