# Code health scan, 19 October 2026

An end-to-end scan of the repository for tangled, duplicated and dead code, with the fixes that were safe to make now and the larger ones left for the owner. Branch `claude/heal-spaghetti-scan`, from `main` at `36e2cfb`.

## How the scan was done

- **Engine (`island/src`, 673 files, 185,000 lines):**
  - ESLint with correctness rules only (undefined names, unused names, unreachable code, duplicate branches and keys).
  - The import graph from all three build entries (`main.js`, `guide/local-speech-worker.js`, `earth/data/index.js`): cycles and unreachable files.
  - An export census that counts imports from the engine, `island/tools`, the root `tools` and the server workers (which import engine modules directly).
  - A behaviour-based duplicate finder: every self-contained top-level helper is run against `noise.js`'s helpers over a fuzz set and counts as a copy only if every output matches bit for bit (NaN and -0 included).
  - Function length and copy-paste (jscpd) censuses.
- **Faceplate (`index.html`):** all 102 inline scripts linted together against the page's own globals (top-level declarations and every `window.` property any script or inline handler writes), plus a search for `window` functions that are called but defined nowhere (page, engine, runtime files).
- **Server and tools:** the same lint over `server`, `tools` and `island/tools`.

## What was fixed

### 1. Engine: code that never runs or is never read (`171bd2f`)

- `interiors/furnish.js`: the "big dining room" branch could never run (an earlier branch takes every dining room, and nothing sets `rm.big`).
- `nature/fogbelt.js`: imported by nothing.
- 31 exports that nothing imports and nothing in their module uses. Several were computed at startup for nothing (`PLANET_TYPES`, `DINOSAUR_KINDS`, `SERVICE_KIT`, `INFUSION_NAMES`, `PIECES` and others).
- Unused names, and what the removals left behind.
- `encounters/picnic-plan.test.mjs` sat inside `src`, so the suite never ran its 6 tests. It is now `island/tools/picnic-plan.test.mjs` and passes.

**Check:** the unminified bundle differs from main only by these removals.

### 2. Faceplate: hair data out of the page, dead code out (`345ceef`)

**The two authored-hair data blocks** (`authored-hair202-data`, `authored-hair203-data`) were 3.5 MB of the page, 2.4 MB of its 3.1 MB gzipped transfer. They are parsed on every visit, for hair that only a V1 body wears.
- They are now `runtime/hair-assets-202.json.gz` and `-203.json.gz`.
- The human asset gate (`HUMAN_ASSET_GATE_145`) loads them with the body mesh and skins. Every V1 body already waits on that gate (`create()` throws without `L99HumanData145`), so the hair is always there first. Errors and retry go through the same gate.
- The JSON was checked deep-equal to what the old blocks built.
- Credits: `runtime/hair-credits202.html`.

**Result:**

| | Before | After |
|---|---:|---:|
| `index.html` | 5.80 MB | 2.32 MB |
| `index.html`, gzipped | 3.13 MB | 0.70 MB |

After the bake (fix 5) the page is 2.10 MB, 0.63 MB gzipped.

**Also removed (unreachable or never read):**
- Six functions nothing calls, counting the self-test's `$` helper.
- The SOUND toggle body after `FACE_AUDIO_222` `mount()`'s early return.
- Two unused tables (`YEE_VOICES`, replaced by music234's `SHOUT`; `SLICE_NAMES`).
- 12 variables that were set and never read.
- The DJ PANIC's calls to `panic()` and `window._allNotesOff`, which exist nowhere. PANIC still stops the decks and the sequencer, as its title says.
- Two comments that described code that had since changed.

### 3. Engine: one copy of the seeded random and the small maths (`48bd429`)

`noise.js` already exported `mulberry32`, `smoothstep`, `clamp` and `lerp`, yet 66 modules kept 70 copies of their own: 15 generators, 26 smoothsteps, 26 clamps and 3 lerps.

**The fix:** each copy is now an import from `noise.js` under its local name, so no call site changed. Modules that exported their copy (`audio/synth.js` `rng`, `people/body.js` `rng`, `combat/outfits.js` `seeded` and others) re-export the shared one.

**Left alone:**
- Copies that behave differently, such as the four generators that turn a zero seed into 1 (`bay/edgecamp.js`, `bay/edgeplan.js`, `region/index.js`, `region/settle.js`).
- The three files the open PRs change: `bay/water.js`, `region/ice.js` and `people/motion.js`.

**New test:** `island/tools/noise.test.mjs` pins the generator's sequence for four seeds, since every world now grows from this one copy. It fails on a mutated constant and on main.

### 4. Flight: the expedition view waits for the cockpit's canvas (`6c7876c`)

**The bug:** `EXPEDITION_216` gives each world a `canvas216()` accessor, and `uiTick` calls it every tick. The flight accessor read `cockpitRenderer.domElement` in the window between the flight module registering and its renderer existing. That threw an uncaught page error, seen on main in one of two headless flight boots.

**The fix:** both accessors now return null until the renderer exists; `applyView` already skips a missing canvas.

### 5. The V1 runtimes ship baked (`e92d476`, `e1cf871`, `52158e8`)

This was the biggest item on the owner list below. Every time the world core or the flight engine loaded, the page rewrote their source text with chains of string replacements before running it, each layer wrapping the one before: 23 transforms for the world core (on the first island or flight open of every visit), 15 for flight, 13 for the retired V1 caves.

**The fix,** one runtime at a time, each its own commit:
- The text each chain produced was captured in a real browser and is now plain source in `runtime/src`: `world-core/*.js` (one file per block), `flight.js` and `caves.html`.
- `tools/pack-runtimes.mjs` packs them into `runtime/world-core-235.json.gz`, `flight-235.js.gz` and `caves-235.html.gz`, stamps their addresses in `index.html` with a hash, and records them in `site-manifest.json`. The page fetches and runs them as they are.
- Every patch layer is gone from `index.html`: the `patchCore`, `patchFlight` and `patchCaves` chains, the leaves, waters, touch-play, dive and cave 227 layers, and the blocks that held nothing else. With nothing left to patch, the device patch cache (`PATCHCACHE_227`) went too, and with it the fingerprinting of every inline script at page load; the page deletes the old cache once.
- `tools/build-gargantua.mjs` now edits `runtime/src/flight.js` and packs it.
- `island/tools/runtime-pack.test.mjs` checks the packed files hold their source, the stamps are current, and no runtime patch comes back. `runtime/src/README.md` says how to change a runtime.

**What it saves:** the world-core chain measured 206 to 287 ms and the flight chain 1.34 to 1.49 s of main-thread string work on a desktop (node, five runs); a phone is several times slower. The world core was patched on the first island or flight open of every visit; flight and caves on the first open after every deploy (then from a device cache).

**What stayed the same:**
- The one value that depended on the device (flight's terrain parallax depth, shallower on touch screens) is now chosen when its shader is built.
- Every address-bar test flag and kill switch still works: each is read inside the baked code. Three switches that chose a patch while it was being applied are retired: `?oldtrees` (`_LEAVES227`), `?noriver` (`_RIVER_FIX227`) and `_TOUCHPLAY228`.

**Checked in a browser, per runtime:**
- The executed text matches the old pipeline's: byte for byte for the world core and the caves; for flight, byte for byte once the parallax depth is folded in, on a desktop and on an emulated phone.
- The L99 globals differ only by the removed patch members, and every member the runtimes read still exists.
- The flight boots with no errors, and the V1 caves open through the shell's door with no errors.

### 6. MIDI steering and throttle reach the flight engine (`52c8144`)

The MIDI CC map's `steer_x`, `steer_y` and `throttle` wrote page globals that have been the flight module's own variables since it became a module, so the knobs did nothing. The flight engine now publishes `L99FlightControls` (`yaw`, `pitch`, `throttle`), the CC handler calls it, and throttle follows the engine's linear scale (zero is zero). A scan of every inline script for bare uses of the engine's private names found no other code like it. In a browser, CC throttle 0.5, 1 and 0 show 2.0x, 4.0x and 0.0x on the cockpit's readout.

### 7. `createIslandWorld` in four modules (`ba40cee`, `6205f46`)

Its four biggest inner functions moved beside it, unchanged in what they do:

| Module | Was | Lines |
|---|---|---:|
| `island-build.js` | `buildWorld` | 447 |
| `island-frame.js` | `tick` | 340 |
| `island-panel.js` | `buildPanel` | 161 |
| `island-teardown.js` | `teardown` | 65 |

Each keeps its old name in `main.js` as a one-line function that hands over. They share `createIslandWorld`'s bindings through one object, `iw`: stable bindings are destructured at the top of each module, so their code reads as before; bindings that change (`world`, `time`, `last`...) are read and set as `iw.name`, whose getter and setter reach the same binding. The move was done by a script over the syntax tree, and none of the four runs while `createIslandWorld` is still setting up (checked transitively), so every binding exists before they read it. `createIslandWorld` is now 1,156 lines and `main.js` 1,850 (from 2,896 on today's main). `island/tools/island-world.test.mjs` keeps `iw` and the modules in step.

**Check:** the node suite, and the release smoke's loading scope: on the final tree all seven worlds draw exactly what they drew before the split (calls, triangles, points, lines). Earth's island, the first, is sampled the instant you enter, racing its first frames, so its counts can vary from run to run on either version; the other six never did.

### 8. One copy of the sine hash and the angle wrap (`93bd1e9`)

`noise.js` gained `sineHash` (10 copies replaced) and `wrapAngle` (4; the fifth, in `crysis/viewmodel.js`, waits for #101). Each file imports it under its old local name. `noise.test.mjs` pins both. Earlier, `62c866c` folded in the last two smoothstep copies once #103 merged.

### 9. Dead code, and one finding corrected (`52c8144`, `d4d6db4`)

- **The responder livery builder** (`signage/cars.js` `vehicleLivery`) was never called. Rendering it on today's ambulance and fire engine showed why wiring it would be wrong: the bodies (`services/vehicle-model.js`) already carry their own markings, so its decals would sit over them twice. It was written for the boxes the responders used to be. Removed; the bundle and the car atlas are unchanged.
- **`L99AuthoredHair202/203.prepare()`**, never called: removed.
- **The loading panel's Cancel** (listed below as dead): on a closer look it is only used by the retired V1 caves door, and Cancel there does abandon the entry (the shell checks `showing` before it opens the caves) while the download finishes into the cache. Flight uses the shared loading screen. Nothing to fix.

### 10. What #101 was holding back (`2d45723`, `891e337`, `f5aac70`)

Once #101 merged:

- `people/motion.js`'s clamp and `crysis/viewmodel.js`'s angle wrap import `noise.js`'s. motion.js keeps its own loop-based wrap, which differs for large angles.
- `world/srgb.js` holds the sRGB-to-linear colour (6 copies) and `persistence/json-copy.js` the JSON copy of saved state (9 copies). `world-progress.js` keeps its own, which passes `null` and `undefined` through. `shared-helpers.test.mjs` pins both.
- **The import cycle is gone.** The perk tree and its maths moved to `magic/perks.js`, which needs neither `skills.js` nor `stats.js`; both import it, and `skills.js` re-exports what its callers used. The engine has no import cycles now.
- **The car atlas** stops drawing the six responder faces nothing uses. Every remaining cell (1,872, in 8 locales on both sheets) fingerprinted before and after: 1,634 pixel-identical, 238 moved in the packing and within 9/255, the dithering any repack gives.
- `main.js` drops a `const` that only repeated `HOOKS.account`.

### 11. Four more big functions split

The same script and method as `createIslandWorld`: each moved part keeps its old name as a one-line function that hands over, and reads the function's bindings through one object.

| Function | Was | Now | Moved to | Shared through |
|---|---:|---:|---|---|
| `createCity` (`bay/city.js`) | 1,681 | 897 | `bay/city-blocks.js` (filling the blocks), `bay/city-dressing.js` (grounds, details, pulling overlaps apart) | `cc` |
| `accessoryGeometry` (`people/garment.js`) | 1,797 | 1,123 | `people/garment-gloves.js`, `garment-tube.js` (sleeves, belts, straps), `garment-armour.js` (close helm, harness) | `ga` |
| `createGuide` (`guide/guide.js`) | 1,761 | 1,236 | `guide/guide-screens.js` (quests, projects, living activity, story, caves, archive, settings), `guide/guide-ask.js` (talking to people and the guide) | `gd` |
| `createCombat` (`combat/combat.js`) | 1,341 | 1,025 | `combat/combat-shots.js` (shots, projectiles, blasts, knockouts, fire), `combat/combat-director.js` (the director, bosses, creatures, hold-ups) | `cb` |

`island/tools/split-contexts.test.mjs` (which replaces `island-world.test.mjs`) keeps all five objects in step with their modules: every name a module takes has a getter, everything it sets has a setter, nothing that changes is copied out, and nothing is provided that no module uses.

**Check:** every person's kit (151 people: each armour set, militia, soldiers and 120 townspeople) builds byte-identical geometry before and after; the city builds the same buildings, trees and kit at seven spots round San Francisco; the guide and combat tests, the node suite and the release smoke pass.

## Verification

On the final tree (main merged in at `8a9fc2f`, #101 included):

| Check | Result |
|---|---|
| Node suite (`island/tools/*.test.mjs`) | 1,136 run, 2 fail (below) |
| Server unit tests | rooms 118, multiplayer 50, ledger 3, discovery 117: all pass |
| Root tool tests (gargantua, audio interrupted) | 3 and 1: pass |
| Faceplate parse gate (every inline script as the browser runs it) | 87/87 (100/100 on today's main) |
| `index.html` | 2.10 MB, 0.63 MB gzipped (5.80 MB and 3.13 MB on today's main) |
| Release smoke, loading scope (7 worlds) | passed: all rendered and lit, no page or console errors, no failed requests. Run back to back with the merged tree before today's later commits (`8a9fc2f`), every world's draw counts are identical. (Globe Bend's counts follow the clock: the same tree drew 224 calls earlier in the evening and 222 later.) |
| Flight boot, V1 caves, MIDI throttle (headless) | the flight boots; the V1 caves open, stay responsive and descend; CC throttle shows 2.0x, 4.0x, 0.0x; no page errors |
| The four later splits | kit geometry byte-identical for 151 people; the city's buildings, trees, kit and props identical at seven spots round San Francisco; combat driven through `Crysis.combat` (shots, a projectile, a blast, squads, an aimed hit, a boss, wanted level, a knockout) behaves the same on both builds with no page errors; the quest immersion check completes all three chapters; the dialogue check passes |

**Failing tests:** Svalbard flora and the regional vegetation refresh, which failed on main before this branch began. The sequencer timing and real-city nearby-tiles tests can fail under heavy load (on main too) and pass alone; on the final run they passed.

**Browser checks with known limits in this container:** `tools/loading-handoff-browser.cjs` passes its desktop half; its phone half times out on a tap on main as well (software GL in emulated phone mode). `island/tools/dialogue-browser.cjs` waited for townspeople who only come out once the world's Enter button is pressed; it presses it now and passes. `tools/combat-gameplay-check.cjs` has the same gap, and with Enter pressed its held mouse button still never fires, on the build before these splits too, so it was left as it is and combat was driven through `Crysis.combat` instead.

**Timing caveat:** page-load numbers are a local server, so they show parse and compile time, not network time.

## Left for the owner, most important first

### 1. V1 retirement: a product decision, not a cleanup

This is the one open item code health cannot close by itself. `docs/flight-migration-inventory.md` makes retiring V1 a migration with release gates: every V1 feature needs a disposition (migrated and tested, kept reachable, or retired by your decision), the galaxy stays V1 until Crysis matches it, and phone round trips are measured. None of that is a refactor.

What V1 still is today:

- **The galaxy cockpit** (`runtime/src/flight.js`, 1.35 MB packed). It is how you explore space, so it stays until the galaxy gates pass.
- **The shared world core**, which the island runs for its play surfaces and Journey. It stays.
- **The V1 surfaces and caves**, off by default (`V1_GUARD_227`): planetfall goes to Crysis, and the old caves (`runtime/src/caves.html`, 0.52 MB packed) only open with `window._V1_SURFACES = true`, which nothing sets.

**The decision for you:** may `window._V1_SURFACES = true` stop working? It is the last way back to the old surfaces and caves. If yes, the V1 caves document and its packed file go, with the bypassed surface code in `flight.js` and the guard checks round it; the island's cave lore (`planet/cave-lore.js`, copied word for word from the V1 caves) stays, and its test, which checks it against the V1 source, would pin it on its own instead. If you would rather keep the way back until the inventory's surface items are signed off, nothing needs doing: the runtimes are ordinary editable source now (`runtime/src`), so they cost nothing to keep.

Note: `docs/flight-migration-catalog.json` and `docs/cave-migration-inventory.md` cite line numbers in the pre-bake files at their audit's baseline commit; the same code lives on in `runtime/src`, at new lines.

### 2. The big functions, after the splits

| Function | Lines | Was |
|---|---:|---:|
| `createGuide` (`guide/guide.js`) | 1,236 | 1,761 |
| `createIslandWorld` (`main.js`) | 1,156 | 2,107 |
| `accessoryGeometry` (`people/garment.js`) | 1,123 | 1,797 |
| `createCombat` (`combat/combat.js`) | 1,025 | 1,341 |
| `createCity` (`bay/city.js`) | 897 | 1,681 |

Still long, but what each shares with its parts is now listed in one object (`gd`, `iw`, `ga`, `cb`, `cc`), which is the map for any further split. The biggest of the shared lists (the guide's, 124 names) says where its next seam is: the replies and negotiations still read most of its state.

### 3. Smaller items

- **Seeds without a product:** `guide/world-projects.js` and `persistence/world-progress.js` are only used by tests. They are deliberate seams waiting for the shared backend (BR-006), so they stay.
