# Phone stability and performance (October 14, 2026)

The owner plays on an iPhone. Approaching or talking to people used to flash the page white and
drop back to the Bard faceplate. That is Safari closing the page's process: on an iPhone the
graphics share the page's memory, and there is no warning event. PR #28 and the voice work took the
100 MB voice model out of the passing path. This pass works on the rest of the engine, so the world
holds its frames and its memory on a phone and recovers when the graphics are lost.

## What changed

### A quality governor (`island/src/world/governor.js`)

There are four tiers: high, medium, low and minimal. Each tier sets:

| tier | pixel ratio (of the device's best) | shadows | shadow map | shadows drawn | crowd | view reach and car detail | clouds in water | sunbeams, spray |
|---|---|---|---|---|---|---|---|---|
| high | 1.00 | on | full | every frame | 100% | 100% | on | device default |
| medium | 0.85 | on | half | every other frame | 75% | 80% | on | device default |
| low | 0.70 | off | | | 50% | 60% | off | low |
| minimal | 0.55 | off | | | 30% | 45% | off | low |

- **Defaults.** Phones now default to the AUTO setting and start at medium. A computer still
  defaults to HIGH. The HIGH and LOW buttons in the settings fix the tier.
- **Stepping down.** On AUTO, the tier drops one step when frames average over 28 ms for 4 s. It
  also drops at once when estimated memory passes 80% of its budget: 700 MB on a phone (graphics
  plus script heap), 2.5 GB elsewhere. Steps are at least 6 s apart.
- **Stepping up.** The tier rises one step after 25 s of frames under 18 ms with memory under 60%,
  and not within 45 s of a step down.
- **Who reads the tier.** `qualityNow()` is a shared singleton, so systems read the tier
  themselves:
  - `people/people.js`: crowd size, plus spare bodies let go.
  - `vehicles/fleet.js`: cars switch to their coarser shapes nearer.
  - `reef.js`: reef chunk reach.
  - `people/chatter.js`: the phone's voice-model load waits while the tier is low or below.
  - `main.js` `applyQuality`: resolution, shadows, shadow map size, clouds in the water, sunbeams
    and spray.
  - The `main.js` tick: the camera's far plane, and shadows drawn every other frame.
- **Voice model.** A phone stepped down to low lets go of the local voice model.
- **Console.** `Crysis.governor()` reports the tier, the ceiling, the mode, the smoothed frame
  time, memory against the budget, the graphics' MB, how many people bodies are alive, the pixel
  ratio, and whether the last visit crashed.

### Memory you can see on a phone (`island/src/world/gpumeter.js`)

Safari reports no memory figure. The meter wraps the context's texture, buffer and renderbuffer
calls and counts the bytes handed over and freed. This gives an estimate of the graphics' memory
(mipmaps counted as an extra third) that the governor reads once a second. The context is reset
when the graphics are restored.

### A crash mark: no white-flash loop

While a world is on screen, the governor keeps a `live` mark in `localStorage` (`l99-governor`).
The mark is cleared when the page is hidden, closed (`pagehide`) or leaves the world.

If the next load finds the mark still set, the last page went without a goodbye, most likely
Safari closing it. That lowers the device's **ceiling** (the best tier it may use) by one. A second
crash within ten minutes starts the device at minimal. The ceiling comes back one tier a day.

Nothing reloads by itself. `share.js` already declines to resume to the last spot within
15 minutes of a graphics loss.

### Graphics loss is recoverable (`main.js`, the `webglcontextlost` listener)

When the graphics are lost:

1. The world holds still. `preventDefault()` was already called, so the browser may restore the
   graphics.
2. The governor lowers the ceiling one tier for the next few days and applies the lower tier at
   once.
3. On `webglcontextrestored`, three rebuilds its state. The engine resets the meter and the texture
   units, warms the shaders again, re-applies the quality, restarts the frame clock, and says
   "Graphics restored, at lighter settings".

If the graphics have not come back after 8 s, the old hint to reload appears. A scripted loss and
restore on an emulated phone passes; see the verification section.

### Phones keep fewer people bodies (`island/src/people/people.js`, `body.js`)

Each body is a few MB of geometry (the face morphs are four full-body targets), plus its morph
texture on the graphics.

- **Caps.** The crowd's pool was capped at 26 adults and 12 children on every device. A phone now
  keeps 16 and 6, and the tier scales the crowd further.
- **Letting bodies go.** When the pool holds more bodies than the tier allows, spare bodies idle
  for more than 20 s are freed, one a second, through the same detach and `freeBody` that the
  residents use.
- **Shared code.** `freeBody` moved to `body.js`; `social-actors.js` re-exports it.
- **Counting.** `body.js` counts the bodies alive across every system (`bodyCount()`), so
  `Crysis.governor().bodies` shows the total.

### The island's spawn no longer draws the reef through the sea

At the Earth spawn, the camera stands on the hill above the bay, within the bay's reach and under
40 m. The engine drew the whole reef: 460 instanced meshes and 2.7 million triangles, 0.77 million
of them again in the shadow pass. It also drew the fish, sealife and inverts, all through the water
surface.

On a governed tier (anything below high), the bay's life is now drawn only once the camera is
within 6 m of the sea or under it. The reef casts shadows only for an eye under the water. Its
chunk reach also follows the tier.

### Shadows every other frame on medium

Downtown, the city's instanced buildings and trees cast about 1.1 million triangles into the shadow
pass, and the parked fleet adds more. On medium the shadow map is redrawn every other frame
(`renderer.shadowMap.autoUpdate` off, `needsUpdate` set on alternate frames). This is safe because
three's shadow matrix only changes when the map is drawn, so a stale map still lines up with what
it shows. The scope optics' own save and restore of these flags still holds.

## The harness

The harness files are under `/tmp/claude-0/.../scratchpad/phone/`:

- **`harness.cjs`** loads `island/dev.html` in Playwright Chromium:
  - iPhone 15 Pro UA, touch, landscape 852x393, DPR 3, CPU throttled 4x through CDP.
  - It walks the session: Earth spawn, downtown SF while walking, beside the nearest person, a
    conversation with them, driving, a shop interior, the nearest military base, then downtown
    again.
  - At each step it records:
    - the JS heap (CDP), before and after a forced GC;
    - the graphics' memory, from hooked WebGL calls;
    - `renderer.info` (textures, geometries, programs, calls, triangles);
    - a per-group census of drawn and shadow triangles and geometry MB;
    - the people pool, frame times, and the main thread's own work per frame;
    - the governor's report and a screenshot.
- **Run options.** `BUNDLE` serves another build of the engine in place of `island/dist/island.js`
  (main's, for a before run). `NORENDER` keeps the world ticking but drawing nothing, so software GL
  does not starve the frames.
- **`contextloss.cjs`** loses and restores the context through `WEBGL_lose_context` and checks
  three things: the page did not reload, the ceiling dropped, and frames are drawn again.
- **`table.cjs`** turns runs into the tables below.

## Before and after

The world was run ticking but not drawing (`NORENDER`), with the CPU at 4x. Before is main's bundle (with the economy); after is this branch. `drawTris` and `shadowTris` count the triangles the scene would draw and cast, with instances included and no frustum test. `pool` is the crowd's bodies and their geometry.

| step | heap after GC (before / after) | crowd pool | drawn tris | shadow tris | tier (after) |
|---|---|---|---|---|---|
| Earth spawn (island) | 75 / 70 MB | 0 / 0 | 2.57M / 1.89M | 0.35M / 0.17M | medium |
| downtown, walking | 95 / 88 MB | 4 (13 MB) / 2 (6 MB) | 2.84M / 2.58M | 1.54M / 0.40M | medium |
| conversation | 121 / 114 MB | 11 (38 MB) / 4 (13 MB) | 2.42M / 3.15M | 1.51M / 1.75M | medium |
| driving | 145 / 133 MB | 28 (99 MB) / 14 (51 MB) | 2.91M / 2.43M | 1.90M / 1.47M | low (shadows off) |
| interior | 136 / 131 MB | 28 (98 MB) / 14 (51 MB) | 3.64M / 2.78M | 2.58M / 1.77M | low |
| military base | 137 / 138 MB | 28 (97 MB) / 14 (51 MB) | 1.76M / 1.93M | 0.48M / 0.66M | low |
| downtown again | 131 / 146 MB | 28 (98 MB) / 14 (51 MB) | 6.28M / 5.55M | 2.78M / 2.29M | low |

- **Shadows.** The shadow column counts casters even where the tier has shadows off (low) or draws them every other frame (medium). At low the shadow pass is gone entirely; at medium its cost halves.
- **Crowd.** The crowd's bodies are halved: 98 MB of geometry before, 51 MB after. Each body's morph texture on the graphics is not counted here, because nothing is uploaded without drawing.
- **The spawn.** Measured with drawing on, the island spawn went from 5.48M triangles and 798 draw calls (main) to 1.89M triangles and 219 draw calls (this branch), at a pixel ratio of 1.275 instead of 1.5.
- **Comparisons the walk cannot make.** Some steps compare different moments of a moving crowd and streaming city, so single rows can go either way. The conversation row is one: before had a person 54 m off to talk to, after had none at that moment.
- **Bodies in other systems.** Across all systems, the bodies alive reached 33 by the end of the after walk (`Crysis.governor().bodies`). That is cars' occupants, families and the military beyond the crowd's 14; see the follow-ups.
- **Graphics loss.** `contextloss.cjs` passes. The page does not reload, the tier steps from medium to low and the ceiling to low, frames are drawn again after the restore, and the meter reads the same before and after.

The machine these ran on was shared with several other agents' browsers (a load average of 15 to
45 on 4 cores), and the GL is software (SwiftShader). Frame times and per-frame CPU are therefore
not meaningful here: a step got 0 to 2 frames in 20 s. Only the structural figures are reliable:
memory, triangles, draw calls, counts, the people pool, and the governor's state.

## Follow-ups

- **Bodies from other systems.** Families, car occupants (`vehicles/life.js`), region folk, squads and gatherings should read `qualityNow().people` and cap themselves. The bodies alive reached 33 on a phone walk. (Done on October 15: each caps itself through `peopleCap(n, least)` in `world/governor.js`. Car drivers, walkers, their cache and the owners' episodes; region folk; squad members and their pool of spare bodies; a family scene's actors, set as it is staged; a gathering's crowd. On a tier down the spare bodies are let go one a frame. The car people and the region folk now let theirs go through `freeBody`, so their materials and skeletons go too and `bodyCount` comes down: before, both only disposed the geometry, and the count only went up.)
- **Garbage per frame.** The heap before GC ran 100 to 200 MB above the heap after it, so something allocates a lot every frame. A CPU and allocation profile of the walk (the harness's `PROFILE=1 NORENDER=1` with `analyze.cjs`) was not run, because the shared machine was too loaded. That profile is the next step to find the allocating loops.
- **Underwater life on the high tier.** The fish, sealife, underwater and caverns groups (about 0.7M triangles) are still drawn on the high tier near the island's bay.
- **Per-body memory.** Each body's face morphs are four full-body targets, mostly zeros. A face-only morph, or adding the morphs only when someone is close, would cut a body's memory by about a third.
- **Real device numbers.** Frame times need a real iPhone, or at least a GPU that is not shared.

## For the lead

- `main.js` changes are grouped:
  - imports;
  - the meter after the shader wrapper;
  - the context loss and restore listeners;
  - the quality default and governor creation;
  - `applyQuality`;
  - one line in the tick for the reef gate, one for the far plane, and the shadow cadence before
    the render;
  - the governor step at the end of the tick;
  - `live` in `show()` and `hide()`, with the visibility and `pagehide` listeners;
  - `Crysis.governor`.
- Systems that build their own people bodies (families, car people, folk, squads, gatherings) are
  not capped by the governor. They are counted in `Crysis.governor().bodies`. If that number runs
  high on a phone, those systems should read `qualityNow().people` the way `people.js` does.
- `index.html` is the faceplate, and it stays resident while the world runs: 5.7 MB of inline
  script plus its own audio graph. It is outside this pass, but it is memory the world shares on a
  phone.
- Owner check on the iPhone:
  1. Run `Crysis.governor()` in Safari's Web Inspector, or watch the AUTO button in the settings.
  2. Walk downtown among people and talk to someone.
  3. If the page ever does flash white, the next load says so in the console (`[governor] the last
     visit ended without a goodbye`) and starts lighter.
