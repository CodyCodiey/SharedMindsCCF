# Droplet — a recreation spec

A thought falls into a pool. Its ripples carry its words outward. What a word
reminds you of falls in beside it.

This describes version 10 of an exploration in visualising a stream of
consciousness. It is written so the piece can be rebuilt from scratch without
the code that produced it. Everything below was arrived at by trying it and
watching; the section on what went wrong is as important as the rest.

---

## 1. What the piece is

A white field. Speech falls into it as droplets. Each droplet sends rings of
water outward, and one of those rings carries the sentence being spoken,
written in a generated handwriting that is made from the ring itself. When a
word comes round again, the company it kept before falls in as smaller
droplets elsewhere on the pool, shows itself, and evacuates.

Black on white throughout. No colour, no fills, no images. Every mark is a
stroked line.

## 2. The lifecycle of a spoken thought

1. **It lands.** The first word of a thought creates a droplet at a random
   point within `dropSpread` (0.22) of the pool's centre, so thoughts do not
   all fall in the same place.
2. **It rings.** Every word spoken sends a bare ripple out from that droplet.
3. **It writes.** The droplet's own ring starts at `minRadius` (120px) and
   travels outward at `carrySpeed` (0.016 px/ms) from the moment it lands. The
   sentence is written on that ring, centred on its top and running clockwise,
   and rides outward with it.
4. **It grows.** As the ring widens the writing grows with the water beneath
   it: `1 + min(spreadTo, (R − start) / start)`, capped at `spreadTo` (1.1).
5. **It waits for water.** The writing is never squeezed to fit. A word is
   drawn only once the ring can carry it —
   `carried = min(pathWidth, 2πR · fill / em)`, `fill` = 0.78 — so a long
   sentence arrives a part at a time as its ripple spreads. Measured: 52% of a
   sentence on a 143px ring, 87% by 419px.
6. **It ends** (see §4) and simply carries on outward. There is no separate
   exit animation; it has been leaving since it arrived.
7. **It goes** when its radius passes the distance to the furthest screen
   corner. It never fades while any of it is visible.

## 3. The core mechanic: the line becomes the words

This is the heart of the piece and the thing worth getting right first.

- A letter begins as **a straight chunk of the ring**, lying exactly where the
  letter will be.
- It **breaks off and floats**: an arc peaking early (`sin(π · grown^0.45)`),
  rising `floatRise` (1.7 em) off the ring and drifting sideways, so the piece
  is still a straight chunk of line when it is highest. It leaves the line as
  line, and only becomes a letter on the way down.
- It **settles** into its letterform over `formMs` (1600ms), with the head of a
  word landing before its tail (`coilStagger` 0.8).
- The ring's own circle is **broken** over the angular span of the writing plus
  `gapPad` (0.05 rad) either side. The line is not a stage the words stand on;
  that stretch of line has *become* the words.

Measured on one word forming: ink rises 3 → 25 → 44 → 62px above its ring,
then settles at 31px.

## 4. Where a thought ends

Any of these, whichever comes first:

- **A hesitation.** `um, uh, er, erm, hmm, ah, oh, like, well, anyway,
  basically, actually, literally, honestly, kinda, sorta, maybe, perhaps,
  probably, whatever, right, okay, yeah` — the sound of a thought running out
  is where it ran out. This is the most characterful rule and it fires often.
- **Length.** 20 words said, or 10 content words.
- **Silence.** 700ms.
- **A change of subject.** The last 10 content words no longer echoing what the
  thought has been about (cosine below 0.13).

Count *words said*, not only content words: a rambling sentence is mostly
grammar, and a content-word cap alone let 48 words run as a single thought.

## 5. Memory: how a word brings back its past

- Every content word is stemmed and indexed against every earlier position it
  was said at.
- When a word recurs it throws `round(priorCount ^ connotation)` droplets,
  `connotation` = 0.72, capped at `maxDroplets` (7) — **a different earlier
  occurrence each**, so a loaded word scatters several different pasts at once.
  Said twice it throws one; said repeatedly it threw eight, each carrying a
  different company: *"the circuit computes with"*, *"and the circuit is the"*,
  *"body the circuit again and"*, *"and the circuit once more"*.
- Each droplet lands 1.9–3.4 × `minRadius` from the centre at `smallDrop`
  (0.62) scale, carrying ±`recallWords` (2) of the text around that occurrence.
- **A remembered fragment fades and evacuates** over `recallLife` (4200ms).
  Only what has just been said stays at full ink. Measured side by side:
  remembered 0.56 → 0.33 → 0.10 → gone, while the spoken one held at 1.00.

## 6. What a thought carries

Every word adds weight: `1 + contentWeight (1.4 if it means something) +
echoWeight (2.2 if it has been said before)`, capped at `chargeMax` (42).

After the thought has been said, it emits one further ripple every
`afterRippleMs` (620ms), spending one unit of charge each time. A loaded
sentence troubles the water long after it lands; a slight one is finished
almost as it arrives. Measured: *"well i mean it is"* carries 1 and sends 1
more ring; a seventeen-word technical sentence carries 17 and sends 17.

## 7. The water

- Bare ripples travel at `rippleSpeed` (0.34 px/ms) — fast. They reach
  `rippleReach` (560px) and are gone, holding full strength for the first 65%
  of the run and letting go over the last 35% (`rippleLetGo`).
- **Bare water and written water are different speeds.** The ripples are
  ephemeral; the ring carrying writing is twenty times slower because the words
  have to be readable. This is the one place the physics is deliberately
  inconsistent, and it is worth it.
- Rings are **true circles** drawn as arcs (`ctx.arc`), four path points each,
  not polylines. A wobble option exists and is off; with wobble the ring falls
  back to a sampled polyline.
- Rings are grouped into four strength bands and stroked four times, not once
  per ring.

## 8. The hand

Procedural single-stroke cursive, generated, not a font. A font was tried and
rejected: it reads better but breaks the claim that the line becomes the words.

- Each letter is **one or more strokes**; the pen lifts between them and
  between letters. A `t` is a stem and a bar, an `i` is a stem and a dot, an
  `x` is two diagonals.
- Each stroke is a start point plus quadratic segments, in em units, baseline
  y = 0, x-height y = 1.
- Bent at draw time by: `xHeight` (0.56 — letters much wider than tall reads
  best), `width` (0.72), `spacing` (0.09), `wordGap` (1), `ascender` (0.8),
  `descender` (1.1), `roundness` (0.74).
- Letters must be told apart **by shape, not by rhythm**. See §10.

## 9. Input

Three sources, all funnelling into one `words(list, time)` call so nothing
downstream can tell them apart:

- **Microphone** via the Web Speech API (`continuous`, `interimResults`), with
  auto-restart on silence and errors surfaced rather than swallowed. Chrome
  only; it needs a secure context, and `localhost` counts.
- **Typing**, as a fallback that is also how you test.
- **A video transcript.** The browser cannot fetch captions cross-origin, so a
  tiny local Node server shells out to `yt-dlp` for the caption track, parses
  the VTT to word-level timings, and the page replays it. Playback drives the
  model on the *transcript's own clock*, so the real pauses still decide where
  thoughts break however fast it is played back.

## 10. What went wrong, and what it cost

The expensive lessons. Most of the rebuild's value is in not repeating these.

**Letters are told apart by shape, not rhythm.** Composing every letter from
four shared primitives made `a` and `o` byte-identical, `e` a zigzag, and an
`i` exactly as wide as one hump of an `n` — so "mind" was six identical humps.
No amount of size, spacing or smoothing fixes this. Give each letter its own
skeleton, let the pen lift, and give `i` its dot.

**Dim by ink, not by height.** Making background words recede by reducing how
far they had *formed* just made them short. Twice.

**Every `stroke()` is a rasterised path with fixed cost.** 122 stroke calls a
frame froze the browser while the JavaScript ran in 0.48ms. Group everything
sharing a colour and weight into one path: 122 → 22, same picture.

**Do not sample finer than a pixel.** Curves emitted points 0.4px apart;
decimate by screen distance instead.

**Per-point noise must be low-frequency *along* the stroke.** A wiggle
advancing 5.5 cycles per em made neighbouring points pull opposite ways —
that is chop, not motion. Half a cycle per em reads as a loose hand.

**Sample to exact endpoints.** Stepping evenly from one margin left every line
11px short of the other, and quantised every gap edge to the same grid so
nothing lined up.

**Two things that must line up need the same schedule.** The break in a line
closed linearly while the ink left on a staggered schedule, so the line
reappeared on top of words still standing.

**Canvas throws where a test double does not.** `ctx.arc` rejects a negative or
non-finite radius. One throw inside the frame loop ends the animation for good
and looks exactly like a blank page. Guard the values, and wrap the loop in a
`try/catch` that puts the message on screen.

**Measure internals, not pixels.** Repeated false readings came from metrics
confounded by draw order, by batching subpaths into one path, by detection
thresholds, and by comparing frames where the content had changed. When a
number looks wrong, suspect the ruler first.

**Module-level config is shared between instances.** Comparative tests must
restore what they change.

## 11. Vestigial in the current build

Worth dropping rather than porting: `growEase`, `leaveMs`, `burstSpeed`,
`recallEcho`, `spreadSpeed` are unreferenced. `wordCentre()` is left from an
inverted model where words emitted ripples rather than riding them. The nine
earlier versions and the shared modules only they use (`column.js`, `force.js`,
`graph-version.js`) are archive; version 10 needs only the thought segmenter
and the cursive generator.

## 12. Settings as they stand

```js
// the pool
centre: {x: 0.5, y: 0.52},  dropSpread: 0.22,   margin: 60
rippleSpeed: 0.34,  rippleReach: 560,  rippleLetGo: 0.35,  rippleInk: 0.4
carrySpeed: 0.016,  maxRings: 1400,    wobble: 0

// the ring a sentence is written on
minRadius: 120,  fill: 0.78,  gapPad: 0.05,  spreadTo: 1.1,  turnEase: 0.03

// the hand
em: 30,  letterHeight: 0.56,  letterWidth: 0.72,  letterSpacing: 0.09
wordGap: 1,  ascender: 0.8,  descender: 1.1,  roundness: 0.74

// taking shape
formMs: 1600,  floatRise: 1.7,  coilStagger: 0.8,  minGap: 1.15

// ending a thought
maxWords: 20,  pauseMs: 700,  breakOnHedge: true
min content words: 5,  max: 10,  cohesion threshold: 0.13

// memory
connotation: 0.72,  maxDroplets: 7,  recallWords: 2,  recallGapMs: 1300
recallLife: 4200,   smallDrop: 0.62
contentWeight: 1.4, echoWeight: 2.2,  chargeMax: 42,  afterRippleMs: 620
```

## 13. Build it in this order

1. A canvas, sized for the device pixel ratio, and typed words reaching a
   `words(list, time)` function. Verify by typing before touching a microphone.
2. The thought segmenter — hesitations, length, silence, cohesion. Print the
   thoughts as plain text and read them. If the boundaries are wrong here,
   nothing downstream can look right.
3. The cursive generator, rendered as plain horizontal writing on a straight
   line. Rasterise single letters to a terminal grid and *look at them* before
   going further.
4. The chunk-of-line-becomes-letter morph, still on a straight line.
5. Bend the line into a ring and put it on the pool.
6. Ripples, charge, and memory.
7. A control panel of sliders grouped in sections, with an export that prints
   the settings as a config block. This is how the piece actually gets tuned —
   build it early, not last.
