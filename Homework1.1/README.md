# Droplet

A thought, embodied as a drop of water, falls into a pool. Its ripples carry its
words outward. What a word reminds you of falls in beside it.

Built from `DROPLET.md` alone — no code from the version it describes.

## Running it

```sh
npm start                 # http://localhost:8080
```

The server also serves the page, which is what gives the microphone the secure
context it needs — `localhost` counts. Type into the box at the bottom; press
**demo** in the panel to watch a built-in stream; paste a YouTube URL and press
**fetch captions** to replay a real transcript (needs `yt-dlp` on PATH).

Query parameters, for looking at it without touching anything:

| | |
|---|---|
| `?demo` | play the built-in stream |
| `?rate=8` | hurry a transcript along |
| `?bare` | hide the panel |
| `?diag` | draw the frame's internals on the frame itself |
| `?preroll=20000` | run 20s of the piece at a fixed step, then hand over to the animation frame |

## Reading the code

| | |
|---|---|
| `src/config.js` | every tuneable number (§12) and the panel's schema |
| `src/words.js` | tokenising, stemming, hedges, what counts as content |
| `src/segmenter.js` | §4, where a thought ends |
| `src/glyphs.js` | §8, one skeleton per letter |
| `src/cursive.js` | sampling those skeletons into ink |
| `src/ink.js` | §3, the line becoming the words |
| `src/pool.js` | §2/§5/§6/§7, the water and what falls into it |
| `src/render.js` | batching, guards, the frame |
| `src/input.js` | §9, three sources into one `words(list, time)` |
| `src/panel.js` | the six controls, and the config export |
| `server/vtt.js` | captions to word-level timings |

Built in §13's order, and each step checked before the next. The tools are how:

```sh
npm run letters -- "mind"     # rasterise letters to the terminal (§13.3)
npm run segment               # print thoughts as plain text (§13.2)
npm run probe                 # the spec's own measurements, reproduced
node tools/run.js 16          # 16s of the demo through the real Pool
```

`tools/forming.html` draws one word at eight ages on eight rings — the fastest
way to see whether §3 still works after touching anything.
`tools/drive.html` types a sentence into the running app the way a person does
and reports what the pool made of it.

## Things the spec left implicit

The spec is written to be rebuilt from, and mostly it is. Five places needed a
decision, and each is pinned to a measurement in the text rather than to taste.

**`carried` is counted in em units, against the *scaled* em.** §2.5 gives the
formula but not the units. Reading it as em-units reproduces both measurements
exactly: a 37.7 em sentence is 52% carried at R=143 and 86% at R=419, against
the stated 52% and 87%. It also explains a detail the spec does not mention —
while the ring is still growing, `carried` is *constant*, because `grow` rises
in step with R. A long sentence genuinely waits tens of seconds for water.

**Charge is counted in fully-loaded words.** §6 gives per-word weights but two
measurements that a raw sum cannot produce. Dividing by one fully-loaded word's
weight (`1 + contentWeight + echoWeight` = 4.6) gives exactly 1 for *"well i
mean it is"* and exactly 17 for seventeen words that all mean something and have
all been said before. `chargeMax` (42) is then a guard that never binds, which
is how `minGap` and the arc guards behave too.

**A hedge does not end a thought it begins.** §4 says a hedge ends a thought,
but §6 measures *"well i mean it is"* as one thought carrying 1 — so "well"
cannot have broken it. A hedge is where a thought ran out; as the first word
there is nothing yet to run out of. This also makes the output read better:
*"um i mean if you take the body out of it"* stays whole.

**Cohesion judges the recent window against what came *before* it.** §4 says the
last content words are compared with what the thought has been about. Compared
against the whole thought the window always contains itself, the cosine is never
below about 0.8, and the rule can never fire. Excluding the window makes it fire
where you would want it to.

**A space advances about 0.81 em** (`wordGap * letterWidth + letterSpacing`).
Chosen because it puts a 60-character sentence at ~37 em, which is what §2.5's
two percentages require of the sentence they were measured on.

One number did not come out: §3 measures ink peaking 62px above its ring, and
`floatRise: 1.7` at `em: 30` peaks at about 54px. The formula and the constant
are both given explicitly, so both are kept as written; `floatRise` is a slider.

## Deliberate departures from the spec

**A ripple belongs to its thought.** §2.2 calls them "bare ripples", and they
were: `ripple(x, y)` copied a coordinate and forgot which thought sent it. So
every ripple in the pool drew at the same fixed `rippleInk` regardless of what
made it, a remembered fragment's water stayed at full strength while the
fragment faded out from under it, and `trim()` — counting writings against a
budget it only ever spent on ripples — deleted the entire water surface on
every call once enough writings were alive. A ripple now holds the writing
itself: it reads its centre and its ink from that thought at draw time, carries
the weight of the word that sent it (§6's own per-word weight, so a loaded word
troubles the water harder than "the"), and leaves when the thought leaves.

**Ripples travel at the same speed as the words, and never pass them.** §7 had
bare water at `rippleSpeed` 0.34 and the writing ring at `carrySpeed` 0.016 —
twenty-one times slower — and called the inconsistency "worth it". It is not.
Rings from one droplet overtook each other and the pool read as jitter. Water
does not do that: every ring from a single disturbance travels at the same wave
speed, so they stay nested, evenly spaced, and never cross. A ripple now travels
at `carrySpeed` from its own birth, which makes the constraint structural rather
than enforced — the word ring set off `minRadius` ahead and has been travelling
since the thought landed, so the gap is always
`minRadius + carrySpeed * (ripple born - thought born)`, never less than
`minRadius`, whatever the sliders are doing. Checked over 162k ripple-frames
with both settings yanked mid-flight: closest approach 40px, on a `minRadius` of
40. `rippleSpeed` and `rippleLetGo` are gone.

**A wave train has a wavelength.** Once ripples travel at `carrySpeed`, a word
every 260ms lays rings 4px apart, which is hatching rather than water — and the
spacing cannot be widened, because the ripples have to stay slow to stay behind
the words. So rings closer together than `rippleGap` merge instead of stacking:
a burst of speech makes one bigger wave, not six invisible ones. A thought that
laid 20 rings 4px apart now lays 5, about 30px apart.

**A spoken thought recedes once it has been said.** §2.7 says it "never fades
while any of it is visible", and with the §12 numbers that is a pile-up: a ring
needs ~52s to clear the corner while thoughts land every few seconds, so
thirteen sentences end up alive at once, all centred on -90° per §2, all at the
`spreadTo` ceiling — the oldest text the biggest and boldest thing on screen.
Measured at 40s: 16.1k px of writing, thirteen sentences, twelve of them at
maximum size. A thought now holds full ink while it is being said and for a
while after, then lets go to `thoughtSink` — the same hold-then-release shape
§7 gives the ripples. Same measurement after: 4.2k px, three sentences leading.
§10's rule is kept exactly — it dims by INK, never by how far the letters
formed; every letter still forms in full.

The two work together only because of the first: the ripples read `w.alpha`, so
a thought's water sinks with the thought instead of outliving it.

Still true, and not addressed: every sentence is centred on the top of its ring,
so the loudest two or three still cross each other in the same wedge above the
pool. Giving each thought its own angle would fix it and would depart from §2.

## Dropped, per §11

`growEase`, `leaveMs`, `burstSpeed`, `recallEcho`, `spreadSpeed` and
`wordCentre()` are not here. Neither are the nine earlier versions or
`column.js` / `force.js` / `graph-version.js`. Everything in `config.js` drives
something — `ascender`, `descender`, `turnEase` and `minGap` included.

## The controls

§13.7 asked for sliders grouped in sections. That came to about fifty, which is
not a control panel — it is fifty ways to make the piece worse. Two groups now,
named for what they do rather than what they are called in the code:

**the pool** — speed (`carrySpeed`), ring (`minRadius`), hand (`em`),
wrap (`fill`), forming (`formMs`), scatter (`dropSpread`), water (`rippleInk`)

**thoughts** — pause (`pauseMs`), length (`maxWords`), weight (`contentMax`),
subject (`cohesion`), hedges (`breakOnHedge`), sinking (`thoughtLife`)

Everything else is a settled constant. **export settings** prints all of them,
so a tuning session can be kept.

Worth knowing about *wrap*: the arc a sentence covers is exactly `2π × fill`,
independent of both the hand and the ring — the R and em cancel. So wrap sets
the angle, and a *smaller hand* is what fits more words into it.

## Scale, and the departure §2.4 needed

The piece was rebuilt at §12's numbers and read far too large: `em` 30 with
`spreadTo` 1.1 grew the writing to 63px — a 35px x-height — so a thought was at
its biggest and boldest when it was oldest and least relevant. The hand is now
14px and grows to 20px rather than 63px (`spreadTo` 0.45). §2.4's behaviour is
kept — the writing still grows with the water beneath it — just not to twice
the size.

Two other changes came with it. A thought now lands carrying about 31 em, most
of a sentence, rather than 19.6; and a letter takes 800ms to form with a 360ms
head-to-tail stagger, rather than 1600ms and 1280ms. Words arrive at something
closer to the speed they were said.

Remembered fragments are placed against the distance to the furthest corner
(0.28-0.92 of it) rather than 1.9-3.4x `minRadius`, and clamped to stay on
screen. They used to huddle in a ring just outside the writing; they now scatter
across the pool, which is where other places the mind has been belong.

## Loading a talk

**load brainretch in 2026** fetches the captions for one particular talk,
loads them, and starts playing. 14,605 words over 94 minutes, with 1,304
pauses long enough to end a thought — so at `rate 1` it takes as long as the
talk did. Turn the rate up.

## Grammar is not meaning

Contractions were counting as content words, which meant they drew charge, were
indexed, and threw memory droplets. Measured on a 94-minute talk, *it's* was the
single most repeated word that "meant something" — ahead of every real subject
in the piece — with *don't*, *i'm*, *that's* and *you're* just behind it.

Two causes. `isContent()` was measured on the raw word while `stem()` was worked
out separately, so `it's` was checked against the stopword list rather than
`it`. And an automatic caption track drops the apostrophe, so `youll` and `dont`
arrive as words of their own. Both forms are listed now, and a word carrying a
clitic is judged on its stem as well.

Only on a clitic, though: applied to every word, the stem test swallowed real
ones — *thinking* stems to *think*, which is in the list, and a talk about
thinking lost the word.

## Water that fades instead of vanishing

A ripple was drawn for about 16% of its thought's life and then simply stopped.
Three things did it, and only one was the obvious one:

- `if (a <= 0.01) continue` in the renderer cut **61%** of the live ripples every
  frame — more than the band floor did.
- `left = 1 - rad/rippleReach` drove a ripple's ink to zero at a fixed distance,
  which is a second and much earlier death than `!r.w.gone`. A fade, arriving
  long before the thought it belonged to was finished.
- §7's four strength bands can express an 8:1 range. Holding a ripple's ink from
  the drop to the screen edge needs **37:1** — spreading costs 2.9x and a sunk
  thought another 12.5x — so no band count alone could have fixed it.

Now: spreading dims a ripple only as far as `rippleFloor`, and it goes out over
`rippleTail` at the END of its life, whichever comes first — its own limit, or
its thought reaching the corner. The water Batch runs 16 bands on a gamma-2.2
curve, which puts the resolution where a ripple actually spends its time (finest
ink 0.0005, against 0.031 for 16 linear bands). Measured: drawn for **96%** of
its thought's life instead of 16%, stepping 0.025 → 0.010 → 0.002 → gone over
the last second and a bit. `stroke()` goes from about 5 a frame to 34 at worst —
§10's cliff was 122.

**fade** in the panel is `rippleTail`: the distance a ripple takes to go.

## Playing without a server

`transcripts/brainretch-2026.json` holds the talk word-timed — 14,605 words, 94
minutes, 212KB as two parallel arrays rather than 14,605 small objects. The
**load** and **burst** buttons read it directly and only fall back to `yt-dlp`
if it is missing, so the piece runs off any static file host. `fetch captions`
for an arbitrary URL is the one thing that still wants the local server.

**esc** hides the panel, from anywhere, including mid-sentence in the box.

## Memory, marked and unrepeated

**A fragment the water is already carrying is not thrown again.** `recallGapMs`
(1300) says how often a word may reach back; `recallLife` (4200) says how long
what it brings stays visible. A word could therefore throw three times over
while its own last fragment was still on screen, and a fresh shuffle would
sometimes land on the same past — so the same words sat there doubled, 4.7% of
frames. §5 asks for "a different earlier occurrence each", and that now holds
against the pool as well as within one throw: candidates are skipped by the
words they read as, not by their position, since two occurrences of a repeated
phrase say the same thing. Nothing else was lost — 19 fragments over 60s where
there had been 21, and the two that went were the duplicates.

One consequence worth knowing: where a word recurs densely, a throw that wanted
three pasts may only find one it is not already showing. `tools/probe.js`
reports what a recurrence *wants* separately from what it throws, so that check
measures the rule rather than the state of the screen.

**The linking word is marked.** A remembered fragment is company around one
word — the recurrence that dragged it up. That word now keeps the fragment's
full ink and a heavier stroke while its company dims to `linkDim`, so the link
reads first and the rest is context. Black on white throughout (§1), so the
highlight is weight rather than colour, and it costs no extra `stroke()` calls:
the marked word is simply a second bucket in the same batch.

## What a review turned up

A pass over the whole tree, with the findings reproduced rather than read:

- **The server died on `GET /%`.** `decodeURIComponent` throws `URIError` on a
  malformed escape, and an unhandled throw in an async handler takes the process
  with it — one request killed the page and the microphone's secure context.
  Now a 400, with a catch around every request and a last-resort net besides.
- **`yt-dlp` had no timeout**, so a stalled fetch left the request open forever
  and the panel on "fetching…" with nothing ever surfaced. Ninety seconds, then
  it is killed and the reason is reported.
- **`weight` below 9 silently disabled `subject`** — two sliders in the same
  group, one switching the other off with no indication. The cohesion window and
  its threshold now shrink with the cap instead of going out of reach. One
  setting (`weight` 7) still misses a hard drift by a single word; that is a
  real boundary rather than a dead zone.
- **`slice(-0)` is `slice(0)`** — the whole array, not an empty tail. A cohesion
  window of 1 made the recent window the entire history, so the rule could never
  fire.
- **The thoughts panel froze after 60 entries.** `pool.log` keeps the last 60,
  so its length stops changing and the redraw test never fired again. It counts
  seals now, which only goes up.
- **Switching between the microphone and a transcript welded two thoughts
  together**, because the two clocks share no timeline and the gap between them
  read as hugely negative. Changing source now closes whatever was mid-sentence.
- **`play` with nothing loaded** took the source anyway and froze the
  segmenter's clock at 0, after which nothing could end on silence. It only
  takes the source if playback actually started, and hands it back when the tape
  runs out.
- **A word's memory could be suppressed for good.** `lastRecall` is stamped on
  the source clock; once a stored time was ahead of the current one the gap
  stayed negative forever.
- **A ripple deleted by `trim()` was still held as a thought's most recent one**,
  so every later word merged into an object nothing draws and that thought
  stopped rippling.
- **`wordBorn` was latched and never re-read**, so turning up the hand left
  words on a ring that could no longer carry them and a sentence wrapped past 2π
  onto its own beginning. A word must still fit, not merely have been born.
- **Ink was floored to the finest band**, so a fading fragment stopped at 0.10
  and then vanished outright. Below the finest band it now draws nothing.
- **Interim speech results get revised, not just extended** — "i read about" can
  become "i red a boat". Counting words sent assumed the list only grew as a
  prefix of itself. It compares the words now, and says when it was revised.
- **Errors were written into the same element the frame loop overwrites** four
  times a second, so the message was gone before it could be read. They get
  their own line.
- **Clearing the pool left the segmenter mid-sentence**, so the next word
  inherited a word count from a thought nothing on screen remembered.
- **The panel's number boxes turned an empty field into 0** (`Number('')`), and
  `trim()` counted writings against a budget it only spent on ripples.
- Accents are folded before splitting, so *café* and *naïve* survive as words
  rather than *caf* and *na*, *ve*; letters outside Latin are kept so a
  transcript in another script still segments and still remembers, though the
  hand has only Latin letterforms to draw them with.
- `demo.js` is seeded, so two runs of `tools/run.js` can be diffed.

Ten minutes of continuous speech holds at 47 writings and 78 ripples, worst
frame 1.8ms against a 16.7ms budget, 19MB. Every control at both rails draws
clean, with no non-finite geometry and no thrown frames.

## The §10 lessons, and where they live

- **Letters are told apart by shape, not rhythm** — `glyphs.js` gives every
  letter its own skeleton, lets the pen lift, and dots the `i`. `npm run letters
  -- "mind"` is the check.
- **Dim by ink, not by height** — a remembered fragment fades by `alpha` only
  (`pool.update`); its letters form exactly as far as a spoken one's.
- **Every `stroke()` has a fixed cost** — `render.js` groups by ink and weight
  into one path each. 250 rings and their writing stroke 5 times.
- **Do not sample finer than a pixel** — `cursive.js` decimates by screen
  distance and keeps exact endpoints.
- **Noise must be low-frequency along the stroke** — `handCycles` is half a
  cycle per em, applied perpendicular to the local tangent.
- **Two things that must line up need the same schedule** — the break in the
  ring is derived from the same per-letter `grown` that places the ink, so they
  cannot disagree.
- **Canvas throws where a test double does not** — every radius and angle is
  guarded, and the frame loop is wrapped; the message goes on the glass.
- **Measure internals, not pixels** — `tools/probe.js` and `?diag`.
- **Module-level config is shared between instances** — `tools/probe.js`
  restores everything it changes.

One more, learned here: **the whole piece must run on one clock, and that clock
must be advanced, not read.** The pool
stamped droplets with `performance.now()` while the renderer drew with the
animation frame's timestamp. When those two drift — a slow load, a background
tab, a headless browser — a droplet is born after the frame that draws it, its
age goes negative, and its letters never start forming. It looks exactly like a
hand that cannot write. `Pool.clock` is now set once per frame and everything in
the water is stamped with it; transcript playback advances by frame delta for
the same reason.
