# Water and shoreline (October 16, 2026)

The owner, a visual designer and animator: "There is a hard edge of water on the shore waves.
We see the same beautiful saturate-and-dry with the waves, but the ocean waves' edge is a hard
line and doesn't follow a realistic, natural beach splash. Go way beyond this, and look at
connecting areas that are off."

The wet sand's darkening and drying was good. Where the water's surface met the sand there was
a hard, straight line, and in places a flat turquoise polygon lying on the beach.

## Why the edge was hard

Three faults, each enough on its own:

1. **The island's shallows read 5 to 8 m deep.** The sea's ground (`world/ocean.js groundAt`)
   eased the island's own floor into the real Bay Area survey across a band from
   `uHalf - 1400` to `uHalf - 60` metres: with the island's half of 1300 m that band starts
   100 m *inside* the centre, so it covered every beach. Under the island the survey is open
   sea about 13 m down, so at the waterline the water was drawn as if 5 to 8 m deep: one
   opaque turquoise right up to the sand, and the full open swell (its strength goes by depth)
   breaking on the beach. The terrain's depth test was all that cut it off: a hard line.
2. **The water's depth and the swash were worked out at the sea's vertices**, which are 3 m
   apart 10 m from you and 7 m apart at 30 m (`radialGrid(300, 70000, 3.3)`). The edge's alpha,
   the swash's front, its foam and the colour by depth were interpolated between them, so every
   contour was a straight line across a triangle. Where a vertex's swash stood above the sand,
   the whole triangle filled with water: the turquoise polygon on the beach.
3. **The water's own colour did not fade to the ground under it.** Even a centimetre of water
   was drawn with the full body colour and the full sky sheen, so where it met the wet sand
   (which reflects no sky) there was a step in colour and brightness.

## What changed

### The shore's sums, shared (`world/shore.js`, new)

The swash moved here from `world/terrain.js` (which re-exports `SWASH_GLSL`), with plain
JavaScript copies of every sum for the tests:

- **Timing.** Each wave rushes up in a fifth of its period, slowing as it climbs (a quarter
  sine), stalls for a tenth with barely a centimetre of movement, then drains over the rest,
  slow at first and gathering pace (`1 - d^1.5`). Two trains (8.3 s and 11.9 s) with a phase
  wandering along the shore, as before; some waves run further than others.
- **The front is never a line.** Each wave's top carries lobes a few metres across and
  fingers under a metre (0.07 m and 0.028 m of height: 2.3 m and 0.9 m along a 3 % beach),
  drawn anew for each wave.
- `swashState` gives the reach, this wave's top, the seconds since it stalled and its phase,
  so the sea can draw the uprush, the backwash and what the wave leaves behind, and the
  terrain can darken exactly where the water ran.
- `swashSheet`: the sheet over the sand is a third of the height it climbs, so it thins to
  exactly nothing at its front.
- `waterBody(d, red absorption, murk)`: how much the water covers the ground under it. None at
  the edge; through clear tropical water the bed still shows at 3 m.
- `breakOn(slope, shelter)`: spilling breakers on gentle open beaches (a rise of 1 in 250 to
  1 in 10), none on steep shores (the swell surges up them) or in shelter.
- `shoreQuality(tier, phone)`: the reach of the per-pixel ground and the foam's detail by the
  governor's tier, filling the object it is given (nothing made each frame).

### The sea (`world/ocean.js`)

- **The island's beaches are the island's.** The survey's floor only eases in where the
  island's own floor is already deeper than 3 to 9 m (or at the map's very edge), so the far
  blend still hides the map's square while every beach and shallow keeps its true depth. The
  swell now fades over the shallows and the rollers take over, as the CPU's `waveHeight`
  (which walks on the island's own heights) always assumed.
- **The ground under every pixel.** Out to 520 m (160 m on a phone; less on the lower tiers)
  each pixel reads the ground under itself, the island's height map or the survey (the globe's
  coasts past the survey are read at the vertices). The water's depth there is exact, so its
  cover fades to nothing exactly where the surface meets the sand or the rock, and the colour
  by depth is continuous from the beach through the shallows to the deep, with no triangle
  facets and no seam at the reach (blended over its last 30 %).
- **The swash per pixel.** On the island's beaches the sheet is worked out per pixel from the
  shared swash, so its front follows the same broken line the terrain wets. Near by, over the
  beach up to the top of the run, the surface is laid just clear of the sand (its highest
  point round each vertex, plus 4 cm) so the sheet and its foam always have a surface to be
  drawn on; the pixels drop everything that is not water.
- **The edge.** The water lays its own colour over the ground drawn under it by its cover,
  none at the edge. The bed as the water should show it (bed times the water's transmission,
  red first, plus the light scattered in it) is had from that cover and an estimate of the bed
  (wet sand at the very edge, paler sand deeper, reef), so the real wet sand is tinted
  turquoise under the water with no step where they meet. The sky's sheen grows in over the
  first 2 cm of water and the sun's glints over the first 1 cm, so there is no bright rim.
- **The swash's look.** A bore of froth at its front as it rushes up; clear thin water behind;
  stalled and draining, the front runs thin and clear and the foam it carried breaks into lace
  carried down the beach; bubbles pop in the backwash (small, each in its own time); a line of
  lace left at the top of the run lies on the sand after the water has gone, breaking up and
  fading over a few seconds. Thin running water is never glassy: churned on the uprush, combed
  into streaks on the backwash.
- **Foam drawn as foam.** Every foam (breakers, swash, lace, rock, posts, the current line) is
  a density laid over a lace of bubbles: cells whose walls thicken as the foam does, read
  through a slow warp at two scales, with holes and patches; it settles to its average where
  finer than the pixel or on a device that draws little detail.
- **Breakers.** On gentle open beaches the roller shoals and steepens through 3 to 0.3 m of
  water, its crest pitching forward (the crest's points carried shoreward, more on the front
  face), and turns to white water: a lip of foam at the crest and a bore rolling in behind it,
  then broken patches in the inner surf. None on steep shores or in shelter (inside the
  island's drowned crater and inside the Golden Gate the rollers are also smaller).
- **Rock.** On steep shores the swell bursts white against the rock and pours off in streams.
- **What stands in the water.** The pier's posts, the boat's hull (bow and stern) and you,
  wading, ring the water with spreading ripples and a wash of foam (`userData.tick`, from one
  line in `main.js`; 8 at once, 4 on a phone; no allocation).
- **Rain** pocks the water near you with rings that spread and fade.
- **Rivers meeting the sea.** Where a stream runs out into the sea (`bay/water.js mouths`), a
  plume of silty brown-green water spreads off its mouth, the ripples lie down in it, and a
  ragged current line of foam and scum runs along its edge.
- **Folds.** Where the surface laid over the sand folds so a triangle faces away from you, it
  is still shaded as the top of the water (only with the eye under water is a face turned away
  the underside); the beach's clearance is only laid on gentle slopes (under 0.15).
- **From below.** Inside Snell's window (about 49 degrees round straight up) the whole sky is
  squeezed into a circle, the horizon at its rim, the sun's disc in it, with a thin bright ring
  at the window's edge; outside it the surface mirrors the dim water below; further off it all
  fades into the blue.
- **Night.** The few nearest lamps along the shore (`world/nightfield.js`, filled by the
  night lights) lie in the water as streaks drawn out by the ripples. Foam is lit by the sun by
  day and the sky and moon by night (it no longer kept a tenth of the day's sun after dark).
  The moon's glittering path is as it was.
- **Another world's sea.** A toxic world's foam is a yellow-green scum (`uLiquid`).

### The wet sand and rock (`world/terrain.js`)

- The ground reads the same `swashState` as the sea: soaked under the sheet, and glossy where
  this wave has just been, going dull over a few seconds as it drains (the wet band up to the
  run's top, which the owner liked, is as it was). Freshly drained sand carries a faint sheen
  of the sky.
- A steep shore (a rise of one in five or more) is rock and shingle down into the sea, dark and
  wet from the waterline up to where the spray reaches (about twice the run), drying above it
  where the grass begins, and shiny where wet.

### A planet's lakes and streams on the ground (`planet/waters.js`, `world/shore.js`)

A green world's lakes lay flat over meadow, the grass blades standing up through the water and
the bed drawn as grass. The planet's water plan now leaves a map of its water over the island
(`island.waterMap`: r the water itself, g its banks, fading over about three cells, some 10 m),
uploaded once as `shared.uWaterMap` (`waterMapTexture`; a blank 1 x 1 on Earth). The ground lays
silt on the bed and darkens the banks to glossy wet mud (`terrain.js`); the grass keeps out of the
water and thins on its wet banks (`grass.js`, one line; `WATERMAP_GLSL` for anything else that
should keep out of the water).

### Spray (`world/spray.js`)

Surf bursting on the rocks near you: the sea finds the steep shores round you from the ground's
heights (`userData.splashes`, looked for again as you move on) and each roller's crest arriving
throws drops up and out from the waterline with a mist hanging after it; the pier's posts in the
surf throw a smaller slap. Two slots on a desktop, one on a phone, in the spray's existing draw.

### Lakes, rivers and lava (`bay/water.js`)

- Lakes lap: the edge creeps up the shore and back with each wavelet, by its own amount all
  along the shore, and the lace of foam rises with it, so the line is never still or straight.
- Creek edges creep in and out with the ripples.
- Waterfalls into a lake: where a stream drops into a lake near you (the nearest four falls
  whose foot lies in open water, `plunges` in `bay/water.js`, looked for again with the
  water's plan), the lake boils white at the fall's foot, rings run out from it and the foam
  thins out into drifting patches. Falls into a stream's own pool already had their white water
  in the ribbon; the spray and mist above both are `world/spray.js`'s, as before.
- Lava: at its margin a flow chills to a thick dark crust against the ground, its cracks
  closing, broken here and there where the melt breaks out and glows along the edge.

## Cost

Per pixel, only where the water is near and shallow: four height-map reads (the survey's
lookups out over the Bay Area), two swash trains, the foam's lace (nine hashes, near only),
and the loops over the touches (8 or 4), the lamps (16 or 6) and the river mouths (4), each
cut short by distance. The deep sea pays nothing new beyond the plume and lamp tests. Vertices
near the shore read the ground four more times for the bed's slope and, on the beach, four more
for the surface's clearance. No new draws, no new textures, no new render targets: there is no
depth pre-pass; the terrain's own height lookup stands in for the depth buffer everywhere,
phones included.

## Hooks for the other agents

- `world/shore.js`: `swashState`, `swashLevel`, `swashRunMax` (CPU) and `SWASH_GLSL`, for
  anything that must know where the water is on a beach (footprints washed out, things left
  by the tide).
- `ocean.userData.splashes(cam, t, out, n)`: where the surf is bursting now.
- `ocean.userData.tick(dt, world, camera, rain)`: what touches the sea this frame.
- `water.mouths(x, z, r, out, n)`: where streams meet the sea.
- `shared.uWaterMap`, `WATERMAP_GLSL waterMapAt(w)`: a planet's lakes and streams (r) and their
  wet banks (g), for anything that should keep out of the water or be wet beside it (the land
  agent's vegetation and ground details).

## Checks

- `node --test island/tools/shore.test.mjs`: the swash's timing (rush, stall, drain gathering
  pace), its limits and continuity, the broken front, the sheet thinning to nothing, the cover
  at the edge, where waves break, the quality by tier, and that the sea and the ground share
  the one swash.
