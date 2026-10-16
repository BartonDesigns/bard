# Phone performance re-audit (October 15, 2026)

The owner plays on an iPhone. Since the phone stability pass of October 14 (`docs/phone-stability-2026-10-14.md`: the quality governor, the graphics meter, crash and context-loss recovery), a lot has landed: law and order, close combat, streets by era, catastrophes, structures polish, storefronts and daily life, environmental graphics, the rebuild site, third-person clothing, first-person sleeves, weapon hands and finger poses, walls you break through, and the skin. This pass re-runs the phone harness against main (through #43) with new steps for each of those, and trims the biggest phone costs at their source. A desktop on the high tier draws what it drew before; each change is checked for that in `island/tools/phone-audit.test.mjs`.

## The budget table

The harness (`harness2.cjs`, `walk.js`, `table2.cjs` in the scratchpad's `phone2/`, from October 14's `harness.cjs`) loads `island/dev.html` as an iPhone 15 Pro in landscape (852 x 393, DPR 3, touch, iOS user agent), CPU throttled 4x through CDP, the world ticking without drawing (`NORENDER`, as on October 14: software GL on this machine, at a load average of 30 to 47 on 4 cores, gives no frames at all with drawing on). Heap after a forced GC; triangles as the scene would draw them (instances counted, no frustum test). "#33" is October 14's after column; "main" is origin/main through #43; "here" is this branch. Each cell: heap after GC (MB) / drawn triangles.

| step | #33 after | main | here | what else |
|---|---|---|---|---|
| Earth spawn | 70 / 1.89M | 71 / 1.90M | 90 / 1.90M | (the heap here caught a collection mid-way: 70 MB before it) |
| downtown, walking | 88 / 2.58M | 91 / 2.55M | 90 / 2.55M | |
| downtown, standing (signs, shops) | | 109 / 2.88M | 112 / 3.21M | heap before GC 141 / 119 MB; sign sheet 1024 square, 66 to 90% full |
| beside someone | 114 (talking) / 3.15M | 133 / 2.92M | 112 / 3.21M | |
| rifle in first person | | 133 / 2.96M | 159 / 2.97M | arm layer 29,280 / 24,256 triangles; heap before GC 436 / 240 MB |
| fist fight (two squaring up) | | 143 / 3.21M | 138 / 3.36M | heap before GC 249 / 142 MB |
| rebuild site, 25 m off | | 187 / 3.15M | 147 / 3.52M | the site 25,222 / 22,756 triangles in 8 draws (a different building each run) |
| earthquake, magnitude 7 | | 155 / 3.25M | 156 / 3.25M | heap before GC 697 / 155 MB (see the follow-ups) |
| December night, 21:30 | | 166 / 3.12M | 163 / 2.48M | here at minimal (shadows off), main at low |
| driving | 133 / 2.43M | 169 / 3.40M | 163 / 2.85M | |
| a shop inside | 131 / 2.78M | 197 / 3.03M | 162 / 2.85M | (no shop near in either run) |
| a house shot full of holes | | 275 / 3.30M | 301 / 3.30M | main threw on the first round (the crash below); here 1,680 rounds, 26 walls broken, 83,505 wall vertices at level 2 (the tier was minimal); at main's detail the same walls would be about five times that (the 40-round stucco wall: 28,176 vertices at level 0 against 5,550 and 4,128), with no bound (a run of main with only the crash fixed found no house built near in time, so this is the per-wall measurement, not a harness number) |
| military base | 138 / 1.93M | 334 / 2.73M | 332 / 2.68M | (no base placed near the suburb in either) |
| downtown again | 146 / 5.55M | page crashed | 174 / 4.96M | |

What the table can and cannot say:

- **Structural numbers only.** Frames came a few at a time (0 to 290 a step), so the streaming city, the crowd and the governor's tier were at different moments in the two runs; single rows can go either way. The rows that measure a fixed thing are the arm layer, the walls and the rules in the test.
- **The heap climbs over the walk** from about 70 MB to 330 MB, on main and here alike (follow-ups).
- **The skin's cost is per pixel** and does not show in any of these; it is counted in the test (lookups a pixel by variant) and in the captures (`phone2/skin-before`, `skin-after`: the medium skin tone by day on a phone viewport, the rifle, the fists, the forearm and a face; they match, with the veins a little straighter).
- **Graphics memory** from the meter stays near 87 to 105 MB in both runs because nothing new is uploaded without drawing; the textures this pass changes are counted by size instead (the skin's noise +0.25 MB, the car decal sheet -1.5 MB with its mipmaps, the walls' atlas 5.3 MB only once a wall breaks).

## What changed

### Skin on phones (`people/skin.js`)

The skin's detail is value noise. On the October 15 skin, a phone's hands made about 13 noise lookups a pixel and the crowd's skin 4, each lookup 8 hashes and 7 blends.

- **Noise from a texture.** Phones (`SKIN_PHONE`, part of the phone variant, so still 2 programs a device) read the noise from one shared 64 x 64 x 64 one-byte 3D texture (`skinNoiseTexture`, 256 KB). The fetch lands where smoothstep puts it between the lattice points, so the linear filter gives the same curve as the hashed noise: one fetch in place of eight hashes.
- **Fewer octaves on phones.** One octave for the blotches (two before), one for the fine pores (two, plus the age lines), one pair of vein warps (two pairs). The nail plate's noise and the roughness grain are left out (both are below what a phone screen shows). Your hands: 6 fetches a pixel (13 hashed before). The crowd: 2 (4).
- **The governor's lower tiers.** `uSkinQ.z` turns the noise off on the low and minimal tiers (the creases, nails, palm lines and tendons stay; nothing wanders or mottles), and the pores' reach is 4 m, 4 m, 2.5 m and 0 on a phone's high, medium, low and minimal tiers (8, 8, 6, 4 on a desktop). A phone on minimal makes no noise lookups at all. No tier change compiles anything (one shared uniform).
- **Blotches past 12 m** are skipped by a branch (they had faded to nothing there), on every device.
- Desktop high: unchanged (the same 7 lookups on the crowd and 18 on your hands, checked by preprocessing the shader in the test).

### Your arms on phones (`people/hand-surface.js`, `crysis/viewmodel.js`, `combat/anatomical-hand.js`)

The first-person arm layer refines the body's hand and forearm triangles once (each split in four) for the close-up detail: 29,280 triangles with a tee. A phone now refines the fingers and the thumb alone (`fingersOnly`: a corner whose heaviest bone is a finger's), where the nails, the joints' creases and the grip are; the back of the hand, the palm and the forearm keep the body's own surface (mostly under a sleeve, and on a 6-inch screen already round). The triangles beside the refined ones are split along the shared edges (into two or three), so there are no cracks; the test checks every inner edge is shared by two triangles and the area and winding are kept. On the phone viewport: 24,256 triangles (refining the whole hand gave 26,708, the fingers being most of it), and the captures look the same. `handRefine(P, { phone, ratio })` picks: a desktop refines it all, a phone the fingers, and the governor's lowest tiers (pixel ratio under 0.75) none, as before. The fists (`createAnatomicalHand`) now follow the same rule (they were always refined).

### Broken walls (`structures/walls/index.js`, `mesh.js`)

A broken wall was traced on a grid twice as fine as its damage cells, and a bulging batt split twice (16 triangles for each one): about 28,000 vertices for a stucco tract wall with 40 rounds in it, and a few hundred thousand for a shot-up house.

- **Levels of detail** (`DETAIL` in `mesh.js`): 0 is the build as it was; 1 traces on the cells' own grid and splits a batt once; 2 also leaves out the small bits (paper flaps, splinters, the old plaster's lath strips). The same 40-round stucco wall: 28,176, 5,550 and 4,128 vertices.
- **Caps** (`wallQuality`): a wall over its tier's `maxVerts` is drawn a level coarser, and once all the broken walls round you pass the tier's `budget`, a newly broken one starts at the coarsest. Phone: level 1 (2 on minimal), 8,000 a wall, 60,000 in all. Desktop low: level 1, 12,000, 100,000; medium: level 0, 24,000, 200,000; minimal: level 2, 8,000, 60,000; high: level 0 and no caps (as before).
- **The governor reaches it.** A step down redraws the broken walls drawn finer than the new tier allows (`onQuality`), and a wall struck for the first time takes the tier's cell size at that moment (what was done is kept by position, so the grid can differ).
- `walls.info()` reports `lvl`, `maxVerts` and `budget`; the structures and walls have a `dispose()` (main.js teardown) that lets go of the quality listener.

### The rebuild site (`structures/rebuild.js`)

The kit's, the trucks' and the cranes' LOD distances and the crew's radius scale with `rebuildLodScale(phone, far)`: 0.6 on a phone, times the tier's view reach (so a phone on medium switches to the far shapes at 53 m for the kit and 43 m for the trucks instead of 110 and 90). A desktop on high: as made.

### Storefronts and daily life (`economy/storefront.js`, `economy/daily-life.js`)

The glazed fronts, fascias, awnings and the pavement's furniture take `frontShare(tier)` of the device's caps: all on high and medium, 75% on low, 56% on minimal (nearest first, so the far ones go); a tier change redraws them. The staff spots out front take the tier's people share (`peopleCap`), as the crowd does.

### The cars' decal sheet (`signage/cars.js`)

The pools (plates, stickers, permits, liveries) fill 54% of a phone's 1024 x 1024 sheet. A phone's sheet is now 1024 x 768 (`CAR_ATLAS`; 640 until the police vans' livery and the military stencils joined the pools), which every locale's pools fill without a repack: about 1.1 MB less on the graphics with its mipmaps, and about 1 MB less canvas. The region's sign sheet was left as it is: downtown it reaches 90% of a phone's 1024 square.

### Everyone's clothes on phones (`people/garment.js`, one marked line)

Third-person clothing split every body's upper garments once more as it was dressed (`refineGarmentSurface`: four triangles for each, the shoulders rounded by up to 4 mm), for the folds. A phone draws no folds (`uPoseK` is 0 on phones), and in the allocation profile of a walk downtown the dressing of the bodies streaming in was the largest single maker of garbage (`dress`, `clothGeometry`, `refineGarmentSurface`, `finishGarmentEdges`: about a fifth of the bytes) and of main-thread time. `refineCloth()` now leaves the clothes' own surface on a phone and on a desktop's low and minimal tiers (the edges are still finished; `finishGarmentEdges` already handled an unsplit surface). A desktop on high or medium: as before.

### Garbage while the world streams in (`vehicles/layers.js`, `structures/overlap.js`)

The allocation profile of a walk downtown (CPU x4, the world ticking without drawing) put two pure helpers near the top: `unfight` (run on every car model as it loads: a small array per face and per comparison) and the overlap solver that settles each region's buildings (`penetration`, `inside`, `segBox`, `leastTrim`, `leastShift`: array literals and a spread copy of a building for every trial). Both are rewritten without them and give exactly the same results (checked against the old code on random meshes and random crowded blocks with roads; `tools/vehicle-layers.test.mjs` and `tools/structures-overlap.test.mjs` pass). Under the harness's throttled, unoptimised code V8 still boxes the numbers these return, so the profile shows them smaller rather than gone.

### The broken walls' atlas, made when first needed (`structures/walls/index.js`)

The section atlas (a 1024 x 1024 canvas, 4 MB, drawn with thousands of specks) and the wire's texture were made when the world was built. They are now made the first time a wall is drawn broken.

### Canvases

`canvas.cjs` (in the scratchpad) holds every 2D canvas weakly with the stack that made it and lists the survivors after a forced collection. On an emulated phone: 147 canvases and 57 MB at the spawn, 171 and 68 MB downtown, none over 4 MB (the economy's sign sheet, the walls' atlas (now lazy), the region's sign sheet, the tattoo flash, the car decals at 2.5 MB now). It is a long tail, so no single change moves it much; Safari counts canvas memory against the page, so it is worth watching.

### Leaks on unload

- `bay/holidaylights.js` registered a quality listener it never let go; with it went the whole scope (the bulbs' arrays and the Points). It now has `dispose()`, called from `streets.dispose()`.
- The walls' new quality listener is let go by `structures.dispose()` (main.js teardown, one line).

### A crash on every shot at the world (`combat/combat.js`, `structures/index.js`)

`combat.firstHit` marks every hit on the world `wall: true`, which overwrote the record the walls you break through keep under `wall`; and `structures.hit` (since the destruction realism pass) sent any hit with `wall` set to the walls. So a round that landed on a building's box, a pane or the ground called `walls.hit` with `true` and threw (`Cannot read properties of undefined (reading 'cells')`). The harness found it in the shot-up house step. `firstHit` keeps the record (`wall: b.wall || true`) and `structures.hit` sends only a hit that carries one (`h.wall.W`). Two lines, marked.

## Does the governor reach the new systems?

Each system that landed since the governor, and how it hears the tier (`world/governor.js`: `qualityNow()` read, `onQuality` told, `tierNow()` compared, `peopleCap` for bodies):

| system | how | what steps down |
|---|---|---|
| skin (`people/skin.js`) | `onQuality` | fine detail, the pores' reach, the noise's octaves (this pass) |
| first-person arms (`crysis/viewmodel.js`, `combat/anatomical-hand.js`) | `qualityNow()` when built | the refinement (none under 0.75 resolution; the fingers alone on a phone, this pass) |
| first-person sleeves (`people/sleeve.js`) | `qualityNow()`, `onQuality` | the cheaper cloth shading on low and minimal |
| third-person clothing folds (`people/body.js`) | `tierNow()` | folds within 22 m, 10 m on low and below and on phones |
| broken walls (`structures/walls/`) | `qualityNow()` when struck or redrawn, `onQuality` | cell size, the trace's level, the caps (this pass: before, the tier was read once when the world was made) |
| rebuild site (`structures/rebuild.js`) | `tierNow()`, `qualityNow()` each frame | the lite kit, trucks and work lights; the LOD distances and the crew's radius (this pass); crew numbers |
| signage (`signage/index.js`) | `qualityNow()`, `onQuality` | reach and the small decals |
| storefronts (`economy/storefront.js`) | `tierNow()` each game minute | how many fronts, fascias, awnings and pavement things (this pass; before, none) |
| staff out front (`economy/daily-life.js`) | `peopleCap` | how many staff spots are filled (this pass; before, none) |
| street trees, sprinklers, holiday lights (`bay/`) | `qualityNow()`, `onQuality` | reach, heads, the strings rebuilt |
| catastrophes' effects (`cataclysm/fx.js`) | `qualityNow()` | particles |
| law and order, close combat, squads, families, gatherings | `peopleCap` (through the squads and the crowd) | bodies |

Not on the tier: the earthquake's caps on what it breaks near you (`cataclysm/quake.js`, phone or not only); see the follow-ups.

### Crash mark and graphics loss with the new memory users

The new users of memory are the skin's 3D noise texture (a `Data3DTexture` that keeps its data, so three uploads it again after a restore), the signage and car decal canvases (`CanvasTexture`, likewise from their canvases), the broken walls' meshes (plain geometry) and the arm layer. None frees its source after upload, so a restored context has everything it needs. `contextloss2.cjs` (in the scratchpad) takes an emulated phone downtown with a rifle in first person, loses and restores the context, and counts the 3D and large 2D texture uploads after the restore; then it hands the stored governor record (with a world still marked live) to a fresh page, which must say the last visit went without a goodbye and start a tier lower.

## Verification

- `node --test island/tools/phone-audit.test.mjs`: the skin's lookups a pixel by variant (the shader preprocessed for each set of defines: 7 and 18 on a desktop as before, at most 2 and 6 on a phone, the phone's from the texture), the tiers' pores and octaves, the noise data; the fingers-only refinement crack-free (every inner edge shared by two triangles, area and winding kept) and who gets which; the walls' tiers, caps and levels on a real broken wall; the rebuild site's LOD scale, the storefronts' share and the staff cap; every locale's car decals fitting a phone's sheet without a repack; the clothes' split on a desktop's high and medium tiers only.
- The whole suite: 654 of 658 pass; the 4 that fail are the known ones (RGB manifest, nearby tiles teardown, Svalbard flora, regional vegetation refresh).
- `unfight` and the overlap solver checked against the old code: identical results on 20 random layered meshes and 12 random crowded blocks with roads.
- Lint (no-unused-vars, no-undef) clean on every changed file.
- Release smoke (MAGMA, TERRAN, Earth): SMOKE OK.
- Skin captures on a phone viewport before and after (`phone2/skin-before`, `skin-after`): no shader errors, the same number of programs (24) before and after, the same look; the arm layer 29,280 triangles before, 24,256 after.
- Graphics loss on an emulated phone downtown with a rifle (`contextloss2.cjs`): the page does not reload, the tier steps from medium to low and the ceiling to low, frames are drawn again after the restore, and the 3D textures (the skin's noise among them) are uploaded again. (Its count of large 2D uploads read 0 because three sends textures through `texStorage2D` and `texSubImage2D`, which the probe does not wrap; and its error filter caught the engine's own `[graphics lost]` diagnostic. Neither is a fault of the engine.)
- Crash mark: the stored record of a page with a world still on screen, handed to a fresh page, gives "the last visit ended without a goodbye: starting lighter", `crashedLastTime: true` and a ceiling of medium.
- The walk on main crashed the page on the way back downtown (a renderer crash in the headless browser after the house and the base, heap 334 MB after GC); the walk on this branch finished. One run each, so this is not proof of anything.

## What to check on the iPhone

1. **Frame time with your hands in view.** Hold a rifle (and then the fists) close to a bright sky and watch `Crysis.governor().frameMs`. The skin was the heaviest pixel shader on the screen; see whether the tier now holds with your hands in view. Look closely at the hands: the creases, nails and palm lines should be as before; the veins wander a little less.
2. **Faces at conversation distance.** The pores and blotches are now from a texture; they should look the same. If anything looks tiled (a pattern repeating every few centimetres), say so: the noise repeats every 64 cells.
3. **Shoot a house to pieces.** Walk into a suburb (San Ramon), shoot the walls from both sides, and check the page stays up and `Crysis.world().structures.walls.info()` keeps `verts` near the budget (60,000) with `lvl` 1 or 2. Shooting at buildings, panes and the ground no longer throws (it did on main since the destruction pass).
4. **People streaming in downtown.** The crowd's clothes are no longer split on a phone. Check shirts and jackets still read well at a few metres (shoulders, cuffs, hems).
5. **A rebuild site from across the street.** The trucks and the kit switch to their far shapes at about half the distance on a phone; check nothing pops close enough to notice.
6. **A graphics loss.** Background Safari with the game in first person, come back, and check "Graphics restored, at lighter settings" and that the hands, the signs and the car plates come back.

## Follow-ups

- **The earthquake.** In the walk the quake step allocated over 500 MB on main (heap before GC 697 MB against 155 MB after, in 5 frames). On this branch the same step ran 43 frames and measured 155 MB before GC, so the spike on main more likely came from what was streaming in at the time (car models, a region settling, people dressed: all cheaper here) than from the quake. That is not proven: the allocation profile of the quake on this branch lost its page (a renderer crash with the heap profiler attached). A profile of the quake alone (`STEPS=disaster PROFILE=1 NORENDER=1`) is the next step, and the quake's caps (`cataclysm/quake.js CAP`, phone or not) could follow the tier.
- **Shells every frame.** `structures/damage.js update` builds a sorted list and a JSON key for every wreck each frame (left alone: the integration agent is in that file).
- **The heap climbs over a long walk** (about 70 MB at the spawn to 330 MB at the end, on main and here alike). Most of it is what each place leaves behind (houses, the crowd's bodies, regions); a heap snapshot comparison between "downtown" and "downtown again" would show what stays.
- **Rendered numbers.** With drawing on, this machine gave no frames at all at the time, so GPU bytes, draw calls and programs could not be measured for the new steps; the structural numbers above are from the world ticking without drawing.
- **Arms.** The fingers are most of the refined arm (the fingers alone 24,256 triangles, the hand 26,708, all of it 29,280). A further cut would need the hand map to work on the body's own finger surface.
