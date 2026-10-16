# The planet floor: the ground drawn and the ground walked

Owner, on the live game (iPhone): "on planet the floor texture suddenly drops like 1000 m while still allowing you to walk on an invisible surface". This is the record of what was measured, what was found, what changed and what still needs a phone to confirm.

## How a planet's ground works

Every planet (and Earth's island) is one generated height map, 2.6 km across (`world/islandgen.js`). Two things read it:

- **The ground you walk on**: `player.floorAt` reads `island.heightAt` on the CPU (plus caves, decks and built floors on top).
- **The ground you see**: `world/terrain.js` draws one camera-centred grid (320 segments, dense underfoot and coarse toward its 2.2 km rim). The graphics card lifts each vertex from a float texture of the same numbers. The grid's centre follows the camera in 4 m steps (`userData.update(camera)`).

The two agree only while three things hold: the grid is centred on the camera, it draws the texture made from those numbers, and it is shown.

## What was measured

A browser harness (`island/tools/planet-floor-browser.cjs`) loads a world in headless Chromium and compares, at each step, the walked floor with the ground as drawn under the player. The drawn height comes from the GPU itself: `Crysis.groundProbe(x, z)` (`world/groundprobe.js`) draws the scene once from straight above into an 8 by 8 target with a float depth buffer and reads the depth back. Any gap over 5 m is flagged.

Runs (logs and captures in the session scratchpad, `planetfloor/`):

| Run | World | Steps | Result |
|---|---|---|---|
| run1 | MAGMA 4242, desktop | spawn, walk, CPU grid of every place a floor other than the land holds you up | drawn = walked to 0.01 m; no raised floors on the 20 m grid |
| run2 | MAGMA 4242, iPhone emulation (DPR 3, touch, iPhone UA) | governor tiers minimal, low, medium, high; context lost and restored; out past the map's edge; up to 70 km and down; landing | drawn = walked to 0.01 m at every step on land |
| run3 | Earth 1337, iPhone emulation | spawn, geometry scan | drawn = walked |
| throw | MAGMA 4242 and ICE 5255, iPhone emulation, before and after the fix | one step of the frame failing every frame, then crossing the land from end to end | before: the drawn ground lags (0.4 to 0.9 m off on the measured points); after: 0.01 to 0.03 m |
| cavethrow | MAGMA 4242, iPhone emulation, before and after the fix | down in a cave chamber, one step of the frame starts failing, then back up on the surface | before: **the surface stays hidden; the walked floor is 61.06 m and the first thing drawn under it is the cave's lava floor at 10.65 m, 50.4 m below** (capture `before-cave/...cave-throw-surface.png`); after: the ground is drawn at 61.11 m (`after-cave/...`) |
| after the merge with main (#44) | TERRAN 77, iPhone emulation | cavethrow, CPU raised-floor grid, tiers 3 to 0, context loss and restore, past the edge, orbit and landing | back on the surface with the frame failing: walked 55.56 m, drawn 55.57 m, shown; every other step drawn = walked to 0.01 to 0.03 m |
| soak | MEDIEVAL 5255, TOXIC 77, iPhone emulation | eight land points, the three cave mouths, a chamber | drawn = walked to 0.03 m; no frame errors kept; the guard saw no incident |
| nan | Earth 1337, MAGMA 4242, TERRAN 77, MYSTICAL 77 | every drawable's vertices and instance matrices | no position or matrix that is not finite (two Bay landmark meshes with NaN normals, below) |

So the obvious suspects are cleared on these worlds: the governor's tiers do not touch the ground; a lost and restored graphics context re-uploads the height texture correctly; the orbital climb and descent and the landing leave the ground right; past the map's edge the land is seabed and you swim.

## What was found

**The ground step of the frame could be skipped while the player still moved.** The frame (`main.js tick`) moves the player early, then runs about forty systems, and only near the end keeps the camera-centred ground under the camera (terrain, sea, grass, turf, litter) and decides what of the surface is shown (`updateIslandReach`, the sea and plants' visibility). The frame runs in a `try`: if any system throws, the rest of the frame is skipped, the error is logged once to the console, and the scene is drawn anyway.

On a planet the systems between the player's move and the ground step are the planet's own: the floating terraces, the colony, the cliff settlement, the dwellings, the realm of castles, the underworld (and with it the dinosaurs and the cave village), the volcano, the alien works, the world beyond the horizon and the Deep. Should any of them throw once per frame, from then on the player keeps walking on the right ground (collision is fine) but the surface's state is frozen where the failure began:

- **If it began underground (in the caves, a dungeon or the Deep), the surface stays hidden after you climb out.** You walk on the land you cannot see, and the first thing drawn under you is the cave below: its floor, its lava, its rock. On MAGMA 4242 that floor is 50 m down; under higher ground, or with the Deep's rock (drawn up to about 600 m below its hall), it is much further, and where nothing is drawn at all the sky's lower half and the fog read as a floor far below. This is the owner's report, reproduced (table above, `cavethrow`).
- On the surface, the ground stays centred where the failure began: the hills under you are drawn from its coarser rings (decimetres to metres off as measured; 5 to 14 m at worst in the Node test), the grass, turf and litter stay behind, and more than 2.2 km off along either axis nothing is drawn.
- The caves' own sense of how far underground the camera is (`underworld.inside()`) also stands still, since their step is one of those skipped. Even with the ground step moved, that alone would keep the surface hidden; so the surface is now shown whenever the eye is above the land and in no cave, whatever that reckoning says.
- On a phone nobody sees the console.

**What was not found.** No planet system threw in these runs; the harness makes one throw on purpose (the whale's update stands for any of them). Which step throws on the owner's iPhone is not known, so the frame's failures are now kept on the device (below) to name it. No other condition reproduced a gap: tiers, context loss and restore, orbit and landing, and past the map's edge all measured clean. The tallest land on any planet is under 300 m, so a drop of hundreds of metres can only be the surface not drawn at all, never the surface drawn at the wrong height.

## The fix

- `main.js`: the ground step is its own function (`followGround`, with `surfaceOpen` for what is shown), called at its usual place in the frame and also from the frame's `catch`. Whatever else fails, the ground, sea, grass and turf stay under the camera and their visibility stays right.
- `main.js surfaceOpen`: an eye above the land and in no cave (no cave floor under it) always sees the surface, whatever the caves' eased reckoning says.
- `main.js`: each distinct failure of the frame is kept on the device (`localStorage l99-frame-errors`, the last eight, with the first lines of the stack and the world type). `Crysis.frameErrors()` reads them back on a later visit.

## The guard

`world/floorguard.js`, run every half second from the ground step:

- It rebuilds the drawn ground on the CPU exactly as the vertex shader makes it: the grid's own vertex positions round its centre now, each lifted from the texture's own data, and the triangle under the player interpolated (`drawnTerrainHeight`). On the Moon it includes the far relief and the curvature drop.
- It compares that with the walked floor where the walked land is the height map's (not on a deck or a roof, not in a cave, the Deep or a dungeon, not flying or swimming, not on Earth's graded roads). A gap over 4 m, no ground drawn, or the ground hidden while the surface should be open, is an incident.
- It repairs at the source: the grid re-centred under the camera, the texture's data put back to the land's own numbers and uploaded again (on a second look in a row), the mesh shown. It logs `[floor guard]` with what it found and what it did.
- It checks the ground's own program: on a device that could not build it (or lost it and could not build it again) three draws no ground at all, so the guard swaps in a lean ground (`terrain.js leanTerrainMaterial`): the same grid lifted the same way from the same texture, cave mouths cut, coloured only by height and the planet's sand and grass. Never a void.
- `Crysis.floorGuard()` tells the looks, incidents, repairs and the last bad one.

The guard costs one bilinear read per grid corner (three or four) and a floor lookup every half second.

## The iPhone capture (pale spikes behind the trees)

The owner's portrait capture from Earth (a quest by the water) shows huge pale flat triangles reaching up out of the ground behind the trees, and a lighter band with a hard vertical edge down the right half. They do not share the floor's cause, as far as can be measured here, and they were not reproduced in software GL:

- **Not the ground grid.** On Earth (island spawn), MAGMA, TERRAN, ICE and the other planets the ground drawn under the player matched the walked ground at every probe, on every governor tier and after a context loss and restore.
- **No geometry with vertices at infinity.** A scan of every drawable in the scene (`STEPS=nan`) found no position or instance matrix that is not a finite number on Earth, MAGMA or TERRAN. It did find two `bay-landmarks` meshes (540 vertices each, MeshStandardMaterial, colours #3a3c40 and #55646a) whose normals are NaN on 864 of 1620 components: their lighting is undefined, which a phone may draw black or white. That is a real defect for whoever owns `bay/` landmarks, not a cause of spikes.
- **What the shapes look like.** Pale, flat and fully fogged means drawn at a great distance or with a vertex at infinity; tall triangles sharing edges, from a line on the ground upward, read like a grid of the graphics card's own making (the Bay ground, the globe's terrain or the water carving, all lifted on the GPU from half-float textures) with garbage in some vertices. On Apple's graphics a vertex that comes out infinite or not a number is drawn as a triangle to the edge of the view, where desktop drivers drop it, which would explain why only the iPhone shows them. The hard-edged lighter band matches the sunbeams' sheets (`world/sunrays.js`), whose light outside the sun's shadow box is a flat value with a hard edge; forced on at the island spawn in Chromium they showed nothing of the kind.
- **Next step, on the device.** `Crysis.frameErrors()` after such a view, and a capture with `Crysis.rays('off')` to rule the sunbeams in or out.

## Tests

- `node --test island/tools/planet-floor.test.mjs` (7 tests): the guard's grid is `radialGrid`, bounded and far; centred on the player the drawn ground equals the walked ground on MAGMA, TERRAN, ICE, MYSTICAL and ARID under any 4 m snap of the centre; the shader's texture read equals `heightAt`; a grid left behind misdraws by metres and leaves a void past 2.2 km (and nothing past a bounded map's edge, while the Moon runs on); the verdicts; the guard re-centres a stale grid, puts back a texture that lost its data and shows a hidden ground; the lean ground's shader edits land on three's own chunks and the guard swaps it in once when the full program will not run.
- Harness: `ROOT=<repo> OUT=<dir> PHONE=1 PLANETS=MAGMA:4242,TERRAN:77 STEPS=walk,grid,tier,lost,far,orbit,throw,cavethrow,soak,scan,nan,rays node island/tools/planet-floor-browser.cjs` (EARTH:1337 opens Earth; NOSHOT=1 skips captures, which take minutes at phone size in software GL). Give it time on a loaded machine: the frames are waited on by count, not by time.

## Confirming on a phone

1. Open the live game on the iPhone, land on a planet and play as before.
2. If the floor goes again, stay put a few seconds: the guard should put the ground back within half a second. Open the Safari Web Inspector from a Mac if one is at hand and run `Crysis.floorGuard()` and `Crysis.frameErrors()`; without one, the next visit to the page keeps `Crysis.frameErrors()` for whoever looks.
3. `frameErrors` names the failing step (the stack's first lines and the world type): that is the next thing to fix, at its own source.
4. If `floorGuard().lastBad.verdict` is `unbuilt`, the device could not build the ground's program and the lean ground stood in: report the device and iOS version.
