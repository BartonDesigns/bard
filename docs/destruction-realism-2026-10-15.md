# Walls you break through (15 October 2026)

A wall in a house is now a wall: paper-faced drywall, studs at 16 inch centres with pink batts between them, building paper, wire lath and stucco outside, each with its own strength. Punch it and it dents, cracks and goes through between the studs (on a stud it stops dead and your hand hurts); shoot it and a round leaves a small hole going in and a torn blow-out coming out, chips stucco from outside, and a burst chews through to the lath; a blast or a car opens a breach with the studs broken and the batts hanging out, and when it is big enough you walk (or duck) through it. Every hole is cut through the wall's thickness and drawn layer by layer from both sides. Engine-wide: every wall the house builder (`bay/houses.js`) and the interiors builder (`interiors/`) put up near you, by building type, era and region.

All of it lives in `island/src/structures/walls/`. The shared files carry only marked hook lines.

## 1. Wall assemblies (`assembly.js`)

`assemblyFor({ use, era, ext, siding, region })` picks one of these, room side first:

| assembly | layers | where |
| --- | --- | --- |
| stuccoTract | drywall, 2x4 studs at 406 mm with kraft-faced batts, paper, stucco on wire lath | tract houses (1970s to 1990s), apartments |
| stuccoNew | drywall, studs with unfaced batts, OSB, house wrap, stucco on wire lath | new houses |
| stuccoPostwar | drywall, empty stud bays, paper, stucco on wire lath (three coats over open framing) | ranch and split-level houses |
| stuccoPrewar | plaster on wood lath, empty bays, board sheathing, paper, stucco | prewar houses |
| sidingPrewar, sidingTract, sidingNew | the same with wood siding outside (plywood or OSB under it) | sided houses; city row houses (Victorian, Edwardian, Mission) |
| veneer | drywall, studs and batts, OSB, paper, an air gap, one wythe of brick | houses with brick fronts |
| partition | drywall both sides of empty studs | interior walls |
| partitionPlaster | plaster on lath both sides | interior walls of old houses and row houses |
| partitionSteel | drywall both sides of steel studs at 610 mm with sound batts | offices, shops |
| brick | plaster on two wythes of brick | old apartment blocks and shops |
| brickRender | the same rendered outside | the European villages |
| block | painted concrete block | stores, schools, garages |
| concrete | drywall, a gap, 200 mm of concrete with bars at 200 mm | offices |
| concreteBare | concrete with its bars | warehouses, parking |
| timberJp | plaster board, studs with rock wool, plywood, paper, render | the Japanese towns |

Era comes from the builder: the houses' eras (`bay/decor.js` houseEra: prewar, ranch, split, tract, modern), the streets' (`bay/streetera.js`: historic, prewar, postwar, tract, new) or an interior's style (victorian, edwardian, sunset, mission, modern, plain); all fold into old, mid, late, new. The core layer (the cavity, else the thickest) is stretched or squeezed so the layers fill the builder's wall thickness exactly (0.16 m and 0.11 m for houses, 0.18 m and 0.1 m for interiors).

Each material has a strength against blows and against rounds, the share of a round that passes through it, and whether it is hard (a fist that meets it is hurt) or soft (a body pushes through it). Stucco carries its wire lath, plaster its wood lath, concrete its bars, each as a second damage channel.

## 2. Damage cells (`cells.js`)

Each run of wall between openings (a piece) is divided into cells (9 cm on the high tier, 10 medium, 12.5 low, 15 minimal and phones; `world/governor.js` qualityNow() and isPhone), and every layer keeps, per cell, how far it is broken (0 whole, 1 and over broken). Allocated the first time a wall is struck.

- **Blunt** (fists, bats, pipes, a car's nose): energy spread over a radius (7 cm a fist, 11 cm a bat), from the struck face inward. Each layer takes what it can; once it gives way the rest goes on at 55%. Board over a stud is three times as strong (it cracks, it does not hole), and studs shrug off light blows (a fist barely marks one; a bat's heavy swings split it in about twenty). The edge of a hole crumbles more easily.
- **Rounds**: through the cell they strike, each layer taking its share (`penetrate()` is the same rule); the way out tears a bigger hole than the way in; a stopped round spalls the face it stopped in. A rifle round (58) costs a partition 10 to 20%, a stucco wall about half, a stud more; brick and concrete stop it. One round pocks stucco, a burst of six into one spot breaks through it; the wire lath holds.
- **Blast**: energy at the middle cell falling off to a radius; tears out bays, studs, lath and all.
- A batt counts as torn (seen through) only at 2.5 times its strength, so a fist through the drywall shows the batt bulging out, not a void.

From the cells: `throughAt` (light and sight pass: every layer open), `passableAt` (a body passes: no unbroken solid layer, the wire torn, the bars broken), and `breachOf`: the widest run of passable columns from no more than a step (32 cm) above the floor, `stand` at 1.75 m high and 0.5 m wide, `crawl` at 0.75 m. A stud bay alone (0.37 m clear) is neither: fists never open a way through a framed wall.

## 3. Holes with depth (`mesh.js`)

A damaged wall is drawn in place of the builder's own triangles (taken out of the merged meshes by the vertex ranges the builder now records, `Builder.mark()` / `since()` in `bay/housekit.js`, kept to put back). Each layer has its own field over the cells (its damage, noise shared with the other layers and some of its own), traced with marching squares:

- The faces either side keep the builder's materials and colours (the room's paint or paper, the stucco or siding), with ragged holes; away from damage the faces are merged into long quads. Baseboards break where a hole reaches the floor.
- Each hole's edge is cut through its layer: white gypsum with torn paper flaps bent into the hole, grey plaster, stucco's grey base coats under a finish coat that spalls off wider, OSB, black paper, concrete with its cover spalled.
- Inside: the brown back of the far board; studs (split and splintered where they broke, a crack drawn up a cracked one), plates at the foot and head; batts bulging out of the hole (kraft facing round the rim, pink or yellow fibre where it tore, tufts pulled out at the edge); the stucco's wire lath across its hole, bent; the old plaster's wooden lath strips; a cable at outlet height, a pair of copper pipes in a wet wall.
- Brick and block: whole units out along their mortar lines in running bond (the two wythes offset), loose ones round the hole a little out of line, the sides of every unit next to a gap drawn.
- Concrete: bars at 200 mm, both faces, shown where the cover is off, bent the way the blow went, broken only by a very heavy blast.

Materials: the builder's own for the faces, one atlas material for every section (`textures.js`: 16 tiles in one canvas, each repeating inside its square), one alpha-tested material for the wire. Built when a wall changes (a wall or two a frame, 8 ms at most), merged per wall.

The marks on the face (`decals.js`, one instanced mesh, 320 or 120 on a phone): knuckle dents, cracks, a round's small hole and its blow-out, chipped stucco, brick and concrete, scorch; dropped when a hole opens under them.

## 4. Damage sources

- **Fists and swings** (`combat/melee.js`): a strike with nobody in reach asks `ctx.wallBlow(move)` (combat.js), which asks `structures.blow(eye, dir, reach, move)`. A wall built near you takes it (walls), else a pane (cracked, holed, broken), else any other wall (hard). The strike holds still and kicks the view; on something hard it holds longer, and a bare fist hurts (1.5, a haymaker 4) with a hint the first time.
- **Rounds**: `combat.js` worldHit passes what its own boxes met to `structures.ray(o, d, max, prior, max0)`: a house built near you stands in for its box below its roof (`{ none: true }` when nothing of it is struck), its walls met where they stand, holes let rays through. `structures.hit()` hands a wall hit to `walls.hit()`, which returns `{ through, dmg }` for a round that goes on (combat's own one-onward rule, as for panes).
- **Blasts**: `structures.blast()` gives every wall in reach to `walls.blast()` first; a building whose walls are known here is no longer wrecked by a small blast (its hole under 1.8 m is the walls'), a big one still wrecks it as before. Heavy rounds (120 to 240) and blasts landing on such a building go to the walls too.
- **Cars**: into a house built near you (above 20 kJ) the wall is broken through where the nose struck (`walls.impact`), the house left standing; anything else as before.
- An interior's outside wall is struck from inside only; from the street its block is struck as it was (pocks, the old holes), and where the wall has been broken from inside the block's face is cut away round the hole (`cuts.js`, read by the block shader in `bay/city.js`) so it shows from the street.

## 5. Passing through, light and sight

The wall's boxes that stop you are cut round a breach (the original box disabled in place, four boxes of the remainder added once and reused). A crawl breach lets you through ducked (the view lowered while you are in it). An interior's paths for its people (`workplace-navigation`) are found again from its boxes. Rays pass where every layer is open, so a hole lets sight through for witnesses and squads (combat's `blocked()` and `firstHit()`), and light through it (the sun's shadows pass; the baked light is the lighting work's, below).

`walls.breaches(x, z, r)` lists every way through near a point for anything that plans paths.

## 6. Debris and feel

- `chips.js`: one instanced mesh, a fixed pool (360 high, 260 medium, 160 low, 90 minimal, 100 phone) of plain arrays: flakes of gypsum and paper, splinters, tufts of batt (slow, floating), stucco, brick, block and concrete bits. Each flies, tumbles, bounces on the floor under it, slides to a stop, lies flat; shrinks away after 1 to 4 minutes, when the pool needs it, or when the wall is repaired. No allocation per frame; nothing done for lying pieces.
- Dust (`debris.puff`, small and long-lived indoors) out of every break and every exit.
- Sound per material through the world's bus (`structures/audio.js` wall()): drywall's papery crunch and crackle, stucco's grit, wood's knock and crack, brick's dull thud and the bits falling, concrete's hard knock, a batt's whump, a steel stud's ring.
- Windows (`glass.js`): the first round stars a pane with a web of cracks, the next knocks a hole through it (ragged, the glass crazed round it, a few shards), the next makes the hole bigger, the next brings it down; a blast, a bat or 99 and over at once. A house's windows (`bay/houses.js`) are panes now too: kept on the house's lot record (so the glazier comes), their glass taken out of the house's mesh and their box out of what stops you when broken, put back when repaired; you climb through the frame (`vault.js`).

## 7. For other systems

```js
const W = world.structures.walls;
W.ray(o, d, max)                 // { t, n, surface, material, wall } or null
W.hit(h, at, dir, dmg, type)     // a shot that met a wall: { through, dmg } or { stop }
W.blow(eye, dir, reach, move)    // a fist or a swing: { material, hard, stud, broke, holed, through, at }
W.blast(at, r, dmg)              // every wall in reach
W.impact(at, dir, joules, half)  // a car's nose
W.repair(id)                     // every wall of building id put right (id: bid(lot), as the structures records)
W.repairWall(id, key)            // one wall
W.damaged()                      // [{ id, walls: [keys], t }] the buildings with broken walls
W.breaches(x, z, r)              // [{ x, y, z, w, h, kind, nx, nz, id, key }]
W.on((e) => {})                  // { type: 'change' | 'repair', id, key, source, root, holes: [{ x, y, z, w, h, nx, ny, nz }], breach }
window.addEventListener('crysis-wall', (e) => e.detail)   // the same, without the root
W.info()                         // sources, walls, broken, verts, breaches, cell, chips, marks, kept
```

- **Rebuild crews** (`rebuild.js`, not edited here): wall damage is kept apart from the structures records (so a broken wall alone does not wreck a building or start a full rebuild). When a building is repaired (`ctx.repaired`), its walls are put right too. A crew for walls alone can poll `walls.damaged()` and call `walls.repair(id)` or `repairWall(id, key)` when its work is done.
- **Interior lighting** (`interiors/lighting.js`, `lightbake.js`, not edited here): listen with `walls.on()` (or the window event) and re-bake or open a light path at each hole in `holes` (world centre, size, the wall's normal); `type: 'repair'` closes it.
- The disasters' `damage.hole()` and `bringDown()` are unchanged.

## 8. Kept

`localStorage` `l99.structures.walls.v1` (try/catch): by building id, each wall by a key from its level, axis, position and run, each damaged cell by its place on the wall in centimetres (so it comes back at another cell size), its ratio in sixteenths, at most 200 buildings. Restored when the builder builds the wall again; cleared by `repair`.

## 9. Cost

- Undamaged walls: nothing drawn or kept beyond a small record per wall of each building near you (houses within about 60 m, interiors within 85 m).
- A damaged wall: its own meshes (the builder's materials it uses, usually two or three, plus one section and one wire draw), about 3 000 to 30 000 vertices by how broken it is. The builder's triangles for it are zeroed, not removed.
- Debris: one draw for the chips, one for the marks; dust in the existing dust draw.
- A shot's ray: a box test per building near, a slab test per wall of the ones it enters.
- The block shader: a loop over at most 12 cut boxes, only when there are any.

## 10. Verification

- `node --test island/tools/destruction-walls.test.mjs`: assemblies by building, era and region; layers filling the wall; punches between studs (dent, crack, through in three to eight); a stud (hard, never broken by a fist, broken by a bat); rounds through a partition and a stucco wall and stopped by brick and concrete; concentrated fire; a blast's breach; breach sizes (stand, crawl, a stud bay too narrow, a hole up the wall no doorway, a plate stepped over, four hundred punches never open a framed wall); keeping across cell sizes; the drawing of every kind of wall (no NaN).
- `island/tools/destruction-browser.cjs` in headless Chromium: see the pictures and the report it writes.

## Left for later

- No kicks: the melee has none yet; a kick would go through `ctx.wallBlow` the same way.
- Commercial shops (`economy` buildings drawn by `bay/commercial.js`) and the towers' lobbies (`bay/towers.js`) are not registered; their walls are as before.
- An interior's outside wall broken through from inside opens a way out through the block; the block is cut away round the hole for the eye, but the floors of a tall block above it are as they were.
- A round goes through one wall or pane at most (combat's one-onward rule).
- People are not hurt by debris.
