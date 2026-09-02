// Every knob worth tuning by feel lives here.
export const CONFIG = {
  margin: 48,

  // The plant
  headAt: { x: 0.5, y: 0.7 },   // where the head sits in the viewport
  stemLength: 0.26,             // fraction of viewport height
  stemCurl: 0.5,                // radians of lean along the stem
  headRadius: 11,

  // Seeds — a full head stands there from the start, bare and waiting
  seedCount: 17,
  seedReach: 78,                // how far a seed's stalk leaves the head
  reachJitter: 18,
  angleJitter: 0.1,
  regrowEase: 0.05,

  // The sail: words spiralling around the seed that is being spoken into
  sailFont: '18px "Times New Roman", Times, serif',
  sailInner: 21,                // radius the spiral starts at
  sailPitch: 3.8,               // radius gained per radian (must clear the type)
  sailMax: 230,
  sailEase: 0.12,

  // Pappus — the crown of filaments at the seed's outer end
  filaments: 11,
  filamentLength: 21,
  filamentSpread: 1.15,

  // Wind — never still, always swaying
  windBase: { x: 1.45, y: -0.68 },
  windSway: { x: 0.5, y: 0.22 },
  swayAngle: 0.055,             // how far the whole plant leans with it
  sailCatch: 0.009,             // extra speed per pixel of sail radius
  gust: 1.007,                  // a seed keeps gathering speed as it goes
  liftJitter: 0.4,
  driftSpin: 0.004,
  wobble: 0.55,
  wobbleRate: 0.009,
  fadeMargin: 70,               // starts fading this far outside the frame

  // Phrases
  phraseWords: 6,
  phrasePauseMs: 900,

  // When a thought is over
  pauseMs: 1400,
  minSegmentContent: 8,
  maxSegmentContent: 20,
  blockSize: 10,
  cohesionThreshold: 0.11,
};
