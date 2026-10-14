# Interior lighting (October 14, 2026)

The owner's complaint, from a fire station's apparatus bay: interiors looked flat, the ceiling
fixtures glowed but lit nothing, no falloff, no pools of light, no dark corners, no contact
shadows under the engine or the bench, no gleam on the polished floor.

The cause: every interior was lit the same way everywhere. The walls and ceilings carried a
flat emissive glow (the house kit's `paintLit` and `ceilingLit`, the shops' and towers' `FILL`
glow, the colony's room glow), the outdoor hemisphere light reached every room in full, and one
to four point lights followed you about at night. The fixtures were decoration.

## One system for every interior

`island/src/interiors/lighting.js` (with the plain number work in `lightbake.js`). A builder
hands over what it built:

```js
lightInterior(root, { id, occluders, levels, bounds, roomOf, rooms, litOf, lamps, dust, hours, home, sky, exclude })
```

Every field is optional; the lighting finds what it needs in the geometry when it is not given.

| Builder | What it gives |
| --- | --- |
| `interiors/index.js` (row houses, flats over shops, apartments, halls, warehouses, schools, stores, garages, parking, and every `addSite` plan: hospitals, police and fire stations, armories, the military's war rooms, depots and barracks, the landmarks) | each full level: solid boxes without the glass, its floor and ceiling, its rooms (which are lit, which dusty), its hours |
| `bay/houses.js` | the house's solid boxes, both floors, its rooms by cell and which are lit; the stucco and siding left out |
| `bay/commercial.js` | its light panels, screens, neon and the cinema screen as lamps, the solid boxes without the storefront glass, its opening hours |
| `bay/towers.js` | each floor, its panels, screens and glows, its hours |
| `interiors/cottage.js`, `interiors/alien.js` | their furniture and lamps (the walls are another module's, so the day's light is left as it falls) |
| `interiors/medieval.js` | the hearth as a fire that flickers |
| `planet/colony/interiors.js` | the kit's glowing pieces (`aGlow` 5) as lamps; the flat room glow (`colony/mats.js` ROOM) dropped where the bake is |
| `planet/arch/interiors.js` | its own lights (`furnish.js` now returns them) as fixtures, the bake added as glow (that world's rooms glow rather than take light), its own unshaded glow dropped where the bake is |

## What it does, a slice a frame

1. **Fixtures that light.** The lamps are found in the geometry: the triangles of a lamp
   material (the house kit's `lamp` and `bulb`, the lamps a builder names, a glow attribute)
   split into connected pieces, each piece made a fixture by its shape and where it hangs:
   `tube` (long and thin, up high), `panel` (flat, up high: facing down; on a wall: a screen
   or sign facing into the room), `down` (a small ceiling light), `point` (a lamp shade, a
   bulb), `spot`. Explicit fixtures can be given too (the hearth, the arch lights). Each is
   on or off by its room (`litOf`), dusty or not (`dust`), and a few in dusty rooms flicker.
2. **Baked light.** The geometry is cut finer (1 m cells on a desktop, 1.6 m on a phone, kept
   under a vertex budget) so a big floor can hold a pool under each fixture. For every vertex:
   inverse-square light from each fixture near enough, times the cosine at the surface and the
   fixture's spread, tested by a ray against the solid boxes (the builder's, plus a thin box
   behind every big flat face of the building: its walls, floors, ceilings and big furniture);
   the brightest six fixtures are tested, the nearest two sample by sample for soft edges, the
   rest shaded as those were. One bounce per room: the room's light times its walls' and
   floor's colour, given back to all of it (less in the corners), so colour bleeds.
3. **Ambient occlusion and the sky.** Rays round each vertex's normal: those that leave the
   building through a window or a door are its share of the sky (the day's skylight is scaled
   by it: bright by the windows, dim at the back of the room, dark in a windowless one by day
   but for its fixtures); those that hit close darken the corners, the seams where walls meet
   the floor and ceiling, and under furniture and parked cars (contact shadows). People get
   soft dark spots under them while you are inside.
4. **Real lights.** Four (two on a phone) point lights stand at the brightest fixtures near
   you in the building you are in, not following you; they light the people and what moves.
   The nearest casts shadows on a desktop with shadows on. The baked rooms take none of their
   light (it is already in them) but do take their shadows, so a person still darkens the
   floor beside them.
5. **Surfaces.** Each baked material gets a per-building copy whose shader reads the bake
   (`onBeforeCompile`, program shared by every copy): the skylight by the sky share, the
   fixtures' light added, and a gleam of the fixtures on what is polished from the direction
   most of their light comes from (a desktop only). Floors and fittings tuned: sealed
   concrete 0.52 roughness, tile 0.26, stone 0.22, paint, ceilings and fabric matte. Glass,
   metal and gloss keep their reflections, dimmed in dark rooms.
6. **Fixture look.** Lamps glow whenever their fixture is on (a little by day, more after
   dark), with a soft halo; faint beams of light down through the air in garages, warehouses,
   engine bays, sally ports, depots and bars; the broken ones flicker.
7. **Day and night.** Sunlight through the windows is the sun's own (shadowed by the
   building), the sky's share is baked, the fixtures add. Homes are dimmer by day; shops,
   offices, schools, malls and landmarks switch to a few night lights outside their hours.

## Cost

Bake: once per building, a few milliseconds a frame (3 by default; `L99Lighting.budget(ms)`),
kept by id (8 buildings, 48 MB on a desktop; 3 and 12 MB on a phone) so a building built again
comes back at once. Per frame: the uniforms, the real lights' choice every 0.2 s, the halo and
beam draws (one each per building). Memory: 12 bytes a vertex for the light (16-bit light and
sky share, 8-bit direction) plus the finer cut geometry.

Measured headless (node, on a shared machine): a 24 by 36 m warehouse 24k vertices cut to 73k,
24 fixtures, about 2.3 s of bake work, 3.9 MB; a 20 by 30 m store 81k to 126k vertices, 6.7 MB;
a row house's ground floor 38k to 58k vertices, 3.1 MB.

## Looking round

`L99Lighting.info()`: the buildings lit, their fixtures (on, dusty), vertices, bake time, the
real lights. `L99Lighting.budget(600)` bakes at once (tests on a slow machine).

## Tests

`node --test island/tools/interior-lighting.test.mjs`: falloff (inverse square and cosine), a
wall's shadow, the sky through an opening and not under a roof, the same numbers every time,
slicing over frames, the bounce, rays, the finer cut keeping shape, winding and every attribute,
lamp geometry made fixtures of the right shape, every interior builder handing its rooms over,
and a planned hall built and lit as the game does with a pool under a light and darker corners.
