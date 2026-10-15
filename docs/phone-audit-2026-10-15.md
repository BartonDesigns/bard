# Phone performance re-audit (October 15, 2026)

The owner plays on an iPhone. Since the phone stability pass of October 14 (`docs/phone-stability-2026-10-14.md`: the quality governor, the graphics meter, crash and context-loss recovery), a lot has landed: law and order, close combat, streets by era, catastrophes, structures polish, storefronts and daily life, environmental graphics, the rebuild site, third-person clothing, first-person sleeves, weapon hands and finger poses, walls you break through, and the skin. This pass re-runs the phone harness against main (through #43) with new steps for each of those, and trims the biggest phone costs at their source. A desktop on the high tier draws what it drew before; each change is checked for that in `island/tools/phone-audit.test.mjs`.

__TABLE__

## What changed

### Skin on phones (`people/skin.js`)

The skin's detail is value noise. On the October 15 skin, a phone's hands made about 13 noise lookups a pixel and the crowd's skin 4, each lookup 8 hashes and 7 blends.

- **Noise from a texture.** Phones (`SKIN_PHONE`, part of the phone variant, so still 2 programs a device) read the noise from one shared 64 x 64 x 64 one-byte 3D texture (`skinNoiseTexture`, 256 KB). The fetch lands where smoothstep puts it between the lattice points, so the linear filter gives the same curve as the hashed noise: one fetch in place of eight hashes.
- **Fewer octaves on phones.** One octave for the blotches (two before), one for the fine pores (two, plus the age lines), one pair of vein warps (two pairs). The nail plate's noise and the roughness grain are left out (both are below what a phone screen shows). Your hands: 6 fetches a pixel (13 hashed before). The crowd: 2 (4).
- **The governor's lower tiers.** `uSkinQ.z` turns the noise off on the low and minimal tiers (the creases, nails, palm lines and tendons stay; nothing wanders or mottles), and the pores' reach is 4 m, 4 m, 2.5 m and 0 on a phone's high, medium, low and minimal tiers (8, 8, 6, 4 on a desktop). A phone on minimal makes no noise lookups at all. No tier change compiles anything (one shared uniform).
- **Blotches past 12 m** are skipped by a branch (they had faded to nothing there), on every device.
- Desktop high: unchanged (the same 7 lookups on the crowd and 18 on your hands, checked by preprocessing the shader in the test).

### Your arms on phones (`people/hand-surface.js`, `crysis/viewmodel.js`, `combat/anatomical-hand.js`)

The first-person arm layer refines the body's hand and forearm triangles once (each split in four) for the close-up detail. On a phone the forearm gains little from it (it is mostly under a sleeve, and on a 6-inch screen its silhouette is already round), so a phone now refines the hand alone (`handOnly`: a corner on the wrist, a metacarpal or a finger). The triangles beside the refined ones are split along the shared edges (into two or three), so there are no cracks; the test checks every inner edge is shared by two triangles and the area and winding are kept. `handRefine(P, { phone, ratio })` picks: a desktop refines it all, a phone the hand, and the governor's lowest tiers (pixel ratio under 0.75) none, as before. The fists (`createAnatomicalHand`) now follow the same rule (they were always refined).

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

The pools (plates, stickers, permits, liveries) fill 54% of a phone's 1024 x 1024 sheet. A phone's sheet is now 1024 x 640 (`CAR_ATLAS`), which every locale's pools fill without a repack: 1.5 MB less on the graphics with its mipmaps, and 1.5 MB less canvas. The region's sign sheet was left as it is: downtown it reaches 90% of a phone's 1024 square.

### Leaks on unload

- `bay/holidaylights.js` registered a quality listener it never let go; with it went the whole scope (the bulbs' arrays and the Points). It now has `dispose()`, called from `streets.dispose()`.
- The walls' new quality listener is let go by `structures.dispose()` (main.js teardown, one line).

### A crash on every shot at the world (`combat/combat.js`, `structures/index.js`)

`combat.firstHit` marks every hit on the world `wall: true`, which overwrote the record the walls you break through keep under `wall`; and `structures.hit` (since the destruction realism pass) sent any hit with `wall` set to the walls. So a round that landed on a building's box, a pane or the ground called `walls.hit` with `true` and threw (`Cannot read properties of undefined (reading 'cells')`). The harness found it in the shot-up house step. `firstHit` keeps the record (`wall: b.wall || true`) and `structures.hit` sends only a hit that carries one (`h.wall.W`). Two lines, marked.

__GOVERNOR__

__VERIFY__

__IPHONE__
