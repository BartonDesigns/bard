# V1 runtimes, as source

The three V1 engines the page still runs live here as plain source. Each already carries every change the page used to make to it at load.

| Source | Packed file the page fetches | What it is |
|---|---|---|
| `world-core/*.js`, one file per block | `runtime/world-core-235.json.gz` | The shared world core. The page runs one block a frame. |
| `flight.js` | `runtime/flight-235.js.gz` | The flight engine, imported as one module. |
| `caves.html` | `runtime/caves-235.html.gz` | The retired V1 caves document. It only opens with `window._V1_SURFACES = true`. |

## Changing one

1. Edit the source here.
2. Run `node tools/pack-runtimes.mjs`. It packs the file, stamps its address in `index.html` with a hash of the packed bytes, and records it in `site-manifest.json`.
3. Run `node --test island/tools/runtime-pack.test.mjs`. It checks the packed files and stamps, and that the page does not patch a runtime again.

Do not add a patch layer to `index.html`. Until build 235 the page rewrote these engines with chains of string replacements as it loaded them, each layer wrapping the one before: 23 for the world core, 15 for flight and 13 for the caves. Those chains are baked in here now.

`tools/build-gargantua.mjs` embeds `runtime/gargantua228.mjs` (the central black hole) in `flight.js` and packs it.

## Where the baked changes came from

Code a layer added carries its build tag, such as `FLIGHT_190`, `UNIVERSE207_RUNTIME` or `RAIL_227`. To read a layer's own notes, open `index.html` from before build 235 in git history and find the block with that tag.

## Switches that still work

These are read by the baked code while it runs, so they work as before when set before the world loads. The address-bar forms are set by `TESTFLAGS_227` in `index.html`.

| Switch | Address bar | Turns off |
|---|---|---|
| `window._CAVE_WATER227 = false` | `?nowater` | Wet rock and mineral stains in the V1 caves |
| `window._CAVE_FORMATIONS227 = false` | `?noforms` | Rock species and angled formations |
| `window._CAVE_RAIL = false` | `?norail` | The ride out of a cave exit |
| `window._CAVE_HOLES = false` | `?ramps` | The new cave mouths (back to the old ramps) |
| `window._CAVE_LAZY_SIGNS = false` | `?fullsigns` | Painting sign labels only near you |
| `window._CAVE_LAZY_INTERIORS = false` | `?fullrooms` | Building house interiors only near you |
| `window._LOOK227 = false` | `?nolook` | The V1 surface light, sea and grade |
| `window._WATERS227 = false` | `?oldwater` | Connected water (`WATERS_227`) in the world core and on the V1 surface |
| `window._ENTRY_DIVE = false` | | The sky dive at planetfall (read by `DIVE_227` in the page) |

Baking retired three switches that chose a patch while it was applied: `_LEAVES227` (`?oldtrees`), `_RIVER_FIX227` (`?noriver`) and `_TOUCHPLAY228`.
