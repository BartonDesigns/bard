# Buildings as things: overlaps, alleys, glass, vaults, destruction and rebuilds (14 October 2026)

All of it lives in `island/src/structures/`. The shared files carry only marked hook lines.

## 1. No building through another, a street or a landmark

`overlap.js` settles footprints (plain numbers, no three.js). For each overlap the smaller building gives way: trimmed back along the side that frees it soonest (never more than 45% of a side, never under 2.4 m), nudged up to 2.5 m if it stands free, or left out. A building mostly inside another stays only if it stands taller (a tower on its podium, a crown); otherwise it was hidden anyway and goes. A service way through a building (a drive-through, a garage ramp) is trimmed clear where it can be but never costs the building. Order: landmarks, then streets, then each other, biggest first.

- Surveyed regions: `realcity.js load()` awaits `settleRegionSoon(G, onLandmark, signal)` after `setBack()`, a few milliseconds at a time.
- Grid towns: `city.js update()` calls `settleLots(list, x, z)` (`lots.js`) after the mapped buildings join the list. The surveyed lots never move; the gridded ones give way to them, to each other, to the freeways (34 m) and the Iron Horse Trail (4 m) where `bay/roads.js` draws them through the grid, and to landmarks.
- Grown towns: `civgen.js` calls `finishTown(boxes, roads, seed)` (`town.js`).

Counts (`island/tools/structures-overlap.test.mjs`, run on the baked data; "before" is after the existing setback):

| region | buildings | building pairs through each other | buildings in a street | after | trimmed / left out |
| --- | --- | --- | --- | --- | --- |
| Sausalito (whole) | 6463 | 476 | 69 | 0 / 0 | 474 / 138 |
| Cupertino (whole) | 21031 | 672 | 9 | 0 / 0 | 727 / 168 |
| San Jose (whole) | 17701 | 1158 | 36 | 0 / 0 | 1095 / 330 |
| East Bay (whole) | 154640 | 4554 | 138 | 0 / 0 | 4783 / 659 |
| SF downtown grid (browser) | 6975 | 806 (+2 on landmarks) | 0 | 5 / 0 | 539 / 130 |

A grown test town (3437 buildings) comes out with none. East Bay takes about 3 s to settle, sliced across frames while it loads.

## 2. Alleys

`alleys.js planAlleys()` finds rows of shops, offices and towers facing one street (three or more side by side, or one strip of at least 45 m), lays a 4.4 m service lane 0.9 m behind their deepest back wall, runs it on to a street where the way is clear (or leaves it as a service court), and gives each building a back door and every 17 to 25 m a dumpster. Never across a building (tested), never where a lane already runs.

- Surveyed regions: planned a 250 m cell at a time round you (`alleyview.js`), handed to the real city as a road source (`real.addSource`), so `drawRoadMap` paints them; `R.repaint()` (one line in realcity.js) repaints the maps when new ones arrive.
- Grown towns: added to the town's roads before its map is painted.
- Grid: planned from each block's paved yard (downtown and main-street blocks), drawn as asphalt strips.
- Dumpsters and steel back doors with a lamp: two instanced meshes.

San Jose plans 47 alleys (4.3 km), Cupertino 33, East Bay 81; the SF grid round the financial district about 350.

## 3. Glass

`glass.js`. Curtain walls (floor to ceiling panes on every storey with mullions) on most towers and flat-roofed offices near you, plate-glass fronts on shops (the side facing the street), sliders on modern grid houses; the buildings `interiors/` has built keep their own windows, and those become the panes. One instanced mesh with its own reflecting glass shader (the sky and sun in it, lit rooms at night, the frame, radial cracks); up to 7000 panes (2400 on a phone) within 170 m (95 m).

- Shot: the first hit stars it with radial cracks and rings from where it struck; a second, or a hit of 50 damage or more, shatters it: shards spin down and settle (pooled instanced shards), the crash and the shards ringing down (synthesised, through `soundBus()`).
- Run through: the body's momentum into the pane (80 kg at a sprint) against 420 + 60 x the pane's area; a walk cracks a big pane, a sprint goes through. A broken shop front also loses its low sill's wall box, so you step through.
- Drive through: the car's front, its weight (x 0.1) and speed into the pane: any car at a jog breaks a shop front, a crawl cracks it.
- A blast breaks panes within 1.1 r and cracks out to 2.4 r.
- Kept per building as face, place and height; an interior built later opens the same window (glass taken out of its mesh, its wall box removed). Stays broken until a glazier repairs it.

## 4. Vaulting

`vault.js`. Jump facing an interior's window (sill 0.3 to 1.4 m above your feet, head at least 1.15 m up, 0.55 m wide; open, broken, or crashed through as you go) or a low thin wall, rail or planter (0.45 to 1.3 m high, at most 1.8 m thick) within 1.35 m, or sprint into a low one. 0.52 to 0.78 s: step in rising onto the hands (two hands set on the sill where they plant, seen as you pass over them), the hop with the head kept under a window's head, landing into a dip at the knees and up, leaving at the pace you came in. The camera looks down at the hands at the plant and rolls a touch into the hop. Refused where the far side drops more than a storey or rises. Hooks in `player.js`: `s.move(dt)` and `s.tryVault(how)`.

## 5. Destruction

`damage.js`, `shell.js`, `debris.js`. A blast (combat's `blast()`), a car or truck striking a wall (the speed lost in a moment: E = m dv^2 / 2 above 50 kJ), a blast-type or 120+ damage round: a hole where it struck (radius from the force and the building's toughness: timber house 0.75, shop 1, other 1.25, curtain-wall tower 1.8), chunks thrown as Rapier rigid bodies (a world of their own, fetched the first time something breaks; capped at 96, 36 on a phone, recycled), dust, the crunch. Strength falls with each hole; under 0.42 the top comes down on a slant (towers over 45 m lose only their top), under 0.14 all of it down to stubs over a mound, the lost storeys falling as great slabs with a rumble and a shake.

A damaged building within 300 m (170 on a phone, at most 14 or 6) is drawn as its shell: the instanced block and roof set aside, walls as panels by storey (spandrel, window, head) with the holes left out (ragged, the wall's thickness and soot showing), floors visible through them, a slab pancaked into a partial collapse, the rubble heaped with blocks, slabs and rebar lying on it. One mesh per building, one shared vertex-coloured material. The shell's walls stop you (a hole at the foot is a way in), the rubble is walked on, and a car meets the walls as they stand (`carBoxes` via drive.js). Further off the block stands scorched (the city shader's burnt look) or as a stump. Interiors, houses and shops built whole near it give way (`interiors/index.js` `release`, `houses.js` drops a wrecked group; a commercial.js shop is hidden, see below).

Kept in `localStorage` (`l99.structures.v1`, try/catch, up to 320 buildings): id `b<2x>:<2z>`, holes `[face, u, y, r]`, collapse, strength, panes, timings, the game clock.

## 6. Rebuilds and the cataclysm switch

`rebuild.js`. A third of an hour (game time) after the damage a crew arrives: trucks at the kerb, cones and fencing, three to six workers (walking their beats or at the wall, climbing with the work), hammering and the odd grinder. Rubble cleared (0 to 12%), scaffolding up (12 to 37%) with netting on the street side, the building back storey by storey in bare concrete (30 to 85%), glazed and struck (90%+). Two to five game hours by severity; a tower crane over buildings taller than 14 m or larger than 600 m2. A broken window alone: a glazier's van, two workers, 0.6 to 1.2 hours. The clock is the sky's hours unwrapped (daylight hours pass in about nine real minutes), kept with the records.

`structures.cataclysm(true)` holds everything: nobody comes and work under way freezes; `false` lets those waiting be seen to a third of an hour later and resumes the rest after a quarter hour. Other systems call `world.structures.cataclysm(on)` (or `Crysis.structures.cataclysm(on)`).

## Console

`Crysis.structures()` (overlaps grid and settled, alleys, glass, damage near, rebuilds, debris, vault, kept, hours), `.cataclysm(on)`, `.crack()`, `.shatter()`, `.vault()`, `.ahead()`, `.advance(h)`, `.recount()`; `Crysis.demolish(x, z, k)` (k 1 all of it, about 0.6 a part).

## Cost

Glass: one draw call. Shells: one per damaged building near (at most 14). Debris: three draws (chunks, dust, shards). Crews: a few meshes per site. Alleys: three draws. Grid settling runs on each city rebuild (every 300 m): about 0.8 s on SwiftShader for 7000 lots, much less on a GPU machine's CPU.

## Verification

- `node --test island/tools/*.test.mjs`: 426 pass of 430, the 4 failures already there before this work (RGB asset manifest, nearby tiles teardown, Svalbard flora, regional vegetation refresh). New: `structures-overlap.test.mjs` (6), `structures-runtime.test.mjs` (4).
- Headless Chromium with SwiftShader, three runs, no page, console or shader errors. SF financial district (grid): 808 overlaps before, 5 after on the first rebuild (before the change that drops hidden inner lots); 353 grid alleys, 237 dumpsters, 194 back doors; 7000 panes. A pane cracked, then shattered with its neighbours; a building demolished (collapse 0.93, shell 3750 vertices, 96 chunks with Rapier live, 300 shards); crews on site after advancing the clock (a glazing job done in 1.1 h, a 2.5 h and a 5 h rebuild under way, a crane on the 45 m building); `cataclysm(true)` held progress at 0.513 and 0.26 over an advanced hour. A window vault from inside an office crashed through its glass (`ahead()` found it at 0.75 m, sill 0.9 m). At about one frame a second a 0.8 s vault spans tens of seconds, so the landing was not captured.

## Left for later and limits

- commercial.js (the economy agent's file) builds shops whole near you; a wrecked one is hidden by finding its root, but its walls still push. After merging, add `if (grp.wrecked)` to its drop condition as houses.js has it.
- Landmarks and the bespoke sites (bridge, Discovery Museum, Boardwalk) are not destructible.
- People are never hurt by debris or collapse (nobody, of any age).
- Bullets stop at the first pane; holes come from blasts, cars and heavy rounds (no current weapon does 120).
- Vaulting covers the interiors' windows and low walls; not the shell's broken walls or cars.
