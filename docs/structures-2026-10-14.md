# Buildings as things: overlaps, alleys, glass, vaults, destruction and rebuilds (14 October 2026)

Section 7 is the polish pass the same day: wrecks, crews, shots through glass, the tank's shell, the landmarks.

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

## 7. Polish (the second pass, same day)

### Wrecks that read as wrecks (`shell.js`, `damage.js`, `debris.js`)

- The shell's intact wall runs are merged into big quads and the windows on them are drawn by the shell's own material (`shellMaterial()`: each vertex carries its facade, style, storey, column and whether the glass is in, broken or not yet glazed). A 116 m tower with one car-sized hole was 110 000 vertices, now about 11 000; built into growing typed arrays, one shell a frame while the work goes on (a fresh wreck at once).
- Holes have ragged edges (cells by a hole drawn three by three against a jittered radius), the wall's thickness and bars showing out of the break.
- A partial collapse's top runs along a broken line from one column edge to the next (no stair steps), bars standing out of it. The floor slabs are whole where the walls still hold them and end in broken edges where they do not; the pieces that cracked off hang from their bars, swung down 30 to 70 degrees. Columns stand up out of the break with their bars bent at the top.
- Rooms behind the openings: painted partitions on the storeys a hole or the break looks into, desks, cabinets and sofas by the holes, pale ceilings.
- The heap leans the way the top fell (the low side of the slant), about a fifth of the height at its peak, lumpy in clumps; blocks of every size on it (grit, chunks, broken slabs with their bars), slabs pancaked into a full collapse, patches of the wall's colour, a room's paint and soot. Whatever stood on a fallen building's roof (parapets, the rooftop units, roof props) goes with it.
- Dust: a cloud up off the fall, a wall of it rolling out along the street (furthest the way it fell), a haze over the heap that hangs a minute and more, every puff rising, hanging, then sinking to settle. A fresh wreck burns (most of a blast's holes, three or four places in a collapse): additive flames and dark smoke until the crew is at it (an hour and a half of game time at most). The chunk pool and its caps are as they were (96 chunks, 36 on a phone).

### The crews (`crewkit.js`, `rebuild.js`)

- Trucks by the stage, built of merged solids: a dump truck heaped with rubble while it is cleared; a cement mixer with a turning drum and a flatbed of bars while the frame rises; blocks on pallets for the walls; glass on its A-frame and the glazier's van at the end. A mobile crane on its outriggers (upper works slewing, boom up, counterweight behind, hook on its rope) for the middling jobs, a tower crane with a braced jib and counterweights over the tall or broad ones.
- The site: mesh fence panels on concrete feet with the works' banners (CITY WORKS, HARD HAT AREA; no real names), barriers at the gate, cones along the kerb, a skip, pallets, bundles of bars, the site cabin and a loo.
- Scaffolding: standards on base plates, ledgers, boarded lifts with toe boards and guard rails, braces, a ladder; the street side netted.
- Workers instanced across every site (six draws for all of them: two vest colours, legs, arms, heads in a range of skin tones, hard hats in four colours), shovelling at the rubble, hammering up on the lifts at the work's height, carrying from the trucks, walking the front, one at the gate.
- Stages seen on the building (`shell.js`): rubble cleared (to 14%), the frame rising storey by storey with formwork at the top (18 to 66%), the walls closed in in bare concrete behind it (30 to 82%), glazed and finished from the ground up (50 to 97%).

### Shots, the cannon and the landmarks (`index.js`, `marks.js`, `monuments.js`)

- A round goes through the first pane it meets (cracking or breaking it) and on with 55% of its damage (70% for an energy bolt); a blast or fire stops there. Hitscan and projectiles both. A round that enters a building through a pane crosses its rooms to the far wall, so people inside can still be hit.
- Shots now meet the gridded towns' buildings (they passed through them before: combat's own boxes are the surveyed ones), a wrecked one as its walls stand.
- Every round leaves a pock on a wall; 40 damage or more a chip and a spray of grit; 120 or more, or a blast, a hole and its scorch. Pooled decals, one draw (260, 90 on a phone).
- The tank's cannon (`military/drive-mil.js`) calls `structures.shell(at, dir, hit, 260)` before its burst: a hole up to 3.2 m through the wall it struck, thrown inward, scorched.
- A car into a wall opens a breach at least as wide as its nose (0.55 + 0.6 sqrt(E / 100 kJ) m over the building's toughness), two holes side by side above 150 kJ.
- Landmarks (the rects `bay/footprints.js` keeps): a height grid of their geometry (2 m cells, scanned a slice at a time once one is within a kilometre) for where a shot meets them; pocks as decals, chips and scorch drawn by their own materials (patched once, the 24 marks nearest you), and they never come down: their strength never falls below half. In a cataclysm they take a beating like the rest and fall: cut away above a ragged line (their shadows too), stubs and a heap over their ground, a great cloud. Kept in `l99.structures.landmarks.v1`; marks fade after eight game hours, a fallen landmark is put back three hours after the cataclysm ends. `Crysis.demolish(x, z)` on a landmark strikes it hard instead.

### Hooks in shared files

- `combat/combat.js` `landShot`: `onward` parameter; on through a pane (`hit.through`, `hit.pierced`, `hit.end`); projectiles fly on through one pane; the tracer drawn to where the round ended.
- `military/drive-mil.js` `shells()`: one line, `W()?.structures?.shell?.(at, dir, hit, 260)`.
- `bay/footprints.js`: `export const landmarkRects = RECTS`.

### Cost

Shells: one draw each as before, a tenth of the vertices for a mostly whole one; a collapse about 15 000 to 31 000 (a phone builds a lighter one). Debris: four draws (chunks, dust and smoke, flames, shards). Marks: one. Crews: per site the merged kit, the fence's cloth, the scaffold and its net, a drum or a crane's upper works (five or six), plus six for every worker anywhere. Landmarks: no extra draws; one shader recompile of their materials the first time one is struck.

### Verified in headless Chromium (SwiftShader)

Logic checked with the frame loop held and the world stepped by hand (player and structures each step at 1/30 s; the machine was too loaded for real frames), pictures rendered from inside the page with the camera outside the buildings.

- A sprint through a pane breaks it (a curtain-wall pane 1.72 by 3.52 m: through at 10 m/s, the body carried on through); a walk into the next one only cracked it.
- A car driven into a wall punches a hole: the free-driving crossover (1750 kg), throttle forced, 12.1 m/s into a tower's face, stopped dead at 2.6 m, a hole in the front face (0.46 m with the old sizing; the sizing now makes it 0.74 m on a tower, about 1 m on a shop, two holes side by side above 150 kJ).
- The low-wall vault finishes: no low wall stands in the downtown grid, so one was placed (5 by 0.5 m, 0.9 m high); a sprint into it vaulted at 0.9 m without a jump (16 steps, 0.53 s) and landed on the far side carrying on at 7 m/s, grounded; from a standstill the jump key at 0.95 m vaulted it in 19 steps.
- A round at a pane: through at 55% (58 to 31.9), the tracer to where it ended; a blast stopped at its pane; a round that entered a building ends at its far wall.
- The tank's shell (`structures.shell` then combat's burst) at a grid tower from 22 m: met the lot, a 1.21 m hole and the burst's 3.8 m one in its front, fire inside, the crew there within the hour.
- The Ferry Building: rounds met it (the height grid, 8403 cells), three heavy rounds chipped it, ten blasts and shells scorched it and left it at strength 0.63 (never below half); with the cataclysm on it came down (cut along a ragged line, stubs and heap over its ground); three game hours after the cataclysm ended it stood again, marks gone.
- No page, console or shader errors through the runs.
- `island/tools/structures-browser.cjs` (SETTLE=30000) on the final build: a building brought half down (collapse 0.51), its block set aside (scale 0), a 36 696-vertex shell in its place, a crew of seven clearing, a round through a pane at 31.9, no errors.
- A damaged surveyed (mapped) building shows its broken shell, not its model: in the first run of this pass the surveyed San Francisco buildings were loaded and a surveyed tower and a surveyed office were each drawn as their shells (the same path as the gridded ones: the instanced block set aside, the shell built). The workplace towers (`bay/towers.js`) built a tower whole within 28 m regardless; they now skip a wrecked one. In the later runs the surveyed region did not load (its data host was unreachable), so the final smoke ran on a gridded building.
- Pictures (before: the first pass; after: this one), kept outside the repository: before-partial, before-full, before-crew; after-partial, after-partial-top, after-full, after-crew-clearing, after-crew-frame, after-crew-glazing, cannon-hole, landmark-scorched, landmark-cataclysm.
- The browser runs were cut short three times by the machine restarting, and one served a cached bundle; the last pictures are from a fresh profile on the final build.

### Still to do

- A round through a pane of a building with no rooms built stops at the box behind it; the second round at a broken pane does too.
- A collapsed landmark's floors and walls still stop you where they stood (bay/landmarks.js floor and push); only its look and the shots know it fell.
- The tank does not breach walls by ramming (its physics has only the surveyed boxes).
- People are never hurt by debris, collapse or fire (nobody, of any age).
- The landmark scorch was softened after its last picture (its fine noise read as squares); not seen again in the browser.
- A phone builds the lighter shells and scaffolds by isPhone; the quality governor (world/governor.js qualityNow()) could drive the caps instead.
- The car-into-wall breach sizing was changed after its browser check (the check made a 0.46 m hole with the old sizing); the new sizing is covered by the code only.

## Left for later and limits

- commercial.js (the economy agent's file) builds shops whole near you; a wrecked one is hidden by finding its root, but its walls still push. After merging, add `if (grp.wrecked)` to its drop condition as houses.js has it.
- The bespoke sites (the bridge, the Discovery Museum, the Boardwalk) are not destructible; the landmarks are marked and, in a cataclysm, fall (section 7).
- People are never hurt by debris or collapse (nobody, of any age).
- Rounds go through one pane (section 7); holes come from blasts, cars, the tank's shell and rounds of 120 or more.
- Vaulting covers the interiors' windows and low walls; not the shell's broken walls or cars.
