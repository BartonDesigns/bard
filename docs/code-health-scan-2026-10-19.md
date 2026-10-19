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

## Verification

| Check | Main | This branch |
|---|---|---|
| Node suite (`island/tools/*.test.mjs`) | 1,076 run, 4 fail | 1,082 run (+6 picnic), 3 fail; `noise.test.mjs` 4/4 |
| Server unit tests (discovery, rooms, unit sets, ledger) | 117, 107, 46, 3 pass | identical |
| Root tool tests (gargantua, audio interrupted) | 3, 1 pass | identical |
| Faceplate parse gate (every inline script as the browser runs it) | 99/99 | 97/97 (two data blocks gone) |
| Headless flight boot (`L99Boot176.flight()`) | alive, 1 page error in 1 of 2 runs | alive, 0 errors in 4 of 5 runs* |
| Hair after the gate | 5 + 3 styles | 5 + 3 styles |
| Faceplate DOMContentLoaded, local server | 689 to 1,192 ms | 499 to 545 ms |

\* The one error was the canvas race, before fix 4. Three runs after it are clean.

**Failing tests:** all three on the branch are the ones that already fail on main (the RGB asset manifest, Svalbard flora, regional vegetation refresh). The fourth main failure that run, the sequencer timing test, is timing sensitive and passed on the branch.

**Timing caveat:** the page-load numbers are a local server, so they show parse and compile time, not network time. On a phone network the 2.4 MB of transfer that is gone matters more.

**Island smoke:** `tools/handoff-release-smoke.cjs` in its loading scope passed on the branch. Seven worlds rendered and lit (Earth island, Bay Area, globe at Bend, Terran architecture and interior, Moon colony, Magma), every shader program ran within the sampler limits, and there were no page errors, console errors or failed requests.

## Left for the owner, most important first

### 1. Runtime source patching of the V1 engines

This is the real spaghetti. Every time the world core or flight engine loads, the page rewrites their source text with string replacements before running it. The patchers are themselves patched: later blocks replace `L99MaterialsFlight191.patchFlight`, `.patchCore` and `L99CavesMaterials191.patchCaves` with wrappers that call the previous version first.

- **World core: 23 transforms** on every island or flight open, not cached. Leaves, waters, touch-play, a timeout fix and the river shader fix; then `L99MaterialsFlight191.patchCore`, which is itself 7 deep (the original plus wrappers from 204, 205, motion 211, visibility 211, 216 and 217); then 11 more nested `patchCore` layers: hair 192, people 193, details 194, hair 195, wardrobe 195, details 196, hair 197, hair 199, hair 202, hair 203 and groom 203.
- **Flight: 15 transforms.** World HUD 190, flight 190, `L99MaterialsFlight191.patchFlight` (the original plus 10 wrappers: 204, 205, 207, 208, 209, 210, motion 211, visibility 211, 216 and 217), routes 223 and dive 227.
- **The retired V1 caves: 13 transforms.** `patchCaves` (the original plus 7 wrappers) and five cave 227 layers.

**Why it is fragile:** each layer finds anchors that the layer before it inserted, and throws if one is missing. A change to one link can break every link after it.

**Measured cost** (the page's own patch blocks run in node against the shipped runtime files, desktop CPU, five runs): the world-core chain takes 206 to 287 ms and the flight chain 1.34 to 1.49 s, without dive 227, which would not load outside a browser. It is all main-thread string work, and a phone is several times slower. `PATCHCACHE_227` caches flight and caves on the device after the first time, but not the world core, which is patched on every island or flight open.

**The fix:** bake each chain into a new runtime file once, at build time, the way `tools/build-gargantua.mjs` already patches `flight-179.js.gz`. Then delete the patch functions from about 30 blocks of `index.html` (the runtime helpers those blocks also define, such as `L99HairFix192.project`, stay).

**Decision needed first:** several patches read URL test flags (`?nowater`, `?noforms`, `?noriver`, `?oldtrees`...) and kill switches (`_RIVER_FIX227`, `_LEAVES227`...) at patch time. Baking ends those unless they become runtime checks inside the baked code.

### 2. V1 retirement

V1 surfaces and caves are already guarded off (`V1_GUARD_227`). The V1 flight engine remains the galaxy cockpit. `docs/flight-migration-inventory.md` is the contract for replacing it.

Once it is replaced, all of this can go: `runtime/flight-179`, `world-core-179`, `caves-179`, `characters-kay-176`, the two hair files, and roughly 40 patch blocks in `index.html`.

### 3. God functions in the engine

| Function | Lines | Note |
|---|---:|---|
| `createIslandWorld` (`main.js`) | 2,107 | Every branch edits it; the `HOOKS` bag is its wiring. |
| `accessoryGeometry` (`people/garment.js`) | 1,797 | |
| `createCity` (`bay/city.js`) | 1,663 | |
| `createGuide` (`guide/guide.js`) | 1,468 | |
| `createCombat` (`combat/combat.js`) | 1,204 | |

**Recommendation:** split `createIslandWorld` along its seams (DOM and HUD, settings panel, per-frame loop, system wiring). Do it when no other branch is open, or it will conflict with all of them.

### 4. Features that are silently dead

- **MIDI CC steering and throttle** (`steer_x`, `steer_y`, `throttle` in the MIDI module) write `steerTargetYaw`, `steerTargetPitch` and `cockpitThrottle`. Those have been local to the flight module since it became a module, so the writes never reach it (each is `typeof`-guarded, so nothing throws). The throttle line also still uses the retired `0.2 + v * 3.8` curve. Restoring this needs the flight engine to expose a steering and throttle setter.
- **Responder liveries:** `signage/cars.js` `vehicleLivery()` builds ambulance and fire-engine decals, but nothing calls it. Wiring it into `services/responders.js` would be a look change.
- **The flight loading panel's Cancel** only hides the panel; the load carries on.
- **`L99AuthoredHair202/203.prepare()`** are never called.

### 5. Smaller items

- **Exact helper copies still left** in PR files: `bay/water.js` and `region/ice.js` (smoothstep), `people/motion.js` (clamp). Fold them in after #101 and #103 merge.
- **Identical copies with no shared home yet:** the sine hash (`hh`, 8), the sRGB-to-linear colour helper (`lin`, 6), the angle wrap (5) and the `JSON` clone (5).
- **The `magic/skills.js` and `magic/stats.js` import cycle** is harmless (calls happen inside functions only). Its cause is that `refreshMods` in skills.js duplicates `refreshStats` in stats.js.
- **Seeds without a product:** `guide/world-projects.js` and `persistence/world-progress.js` are only used by tests. They are deliberate seams waiting for the shared backend (BR-006).
- **`site-manifest.json`** is stale for `index.html`. Only `tools/build-gargantua.mjs` updates it.
