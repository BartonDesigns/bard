# Streets by era and by season (14 October 2026)

The three things still open from section 7 of `docs/HANDOFF-roads-and-realism-2026-10-13.md`: the pothole favour (with a pothole layer in the road shader), street trees and pavement by era, and seasonal touches. All of it engine-wide: the mapped Bay regions, the towns the civilization engine grows on the globe (they arrive in the same shape and go through the same road map), and, where it applies, the procedural street grid.

## Eras (`bay/streetera.js`)

Every 250 m neighbourhood gets one of five eras, worked out once and kept until the regions round it change:

| era | trees | sidewalk | kerb | lamp | potholes per 100 m of lane |
| --- | --- | --- | --- | --- | --- |
| historic | London planes, ginkgos, elms in tree wells with iron grates, 9 m apart | brick, running bond along the street | granite | acorn lantern on a post | 0.9 |
| prewar | big sycamores, planes, elms and oaks behind the sidewalk, 11 m, gappy | old scored concrete, slabs lifted and cracked by roots | square, worn | cobra head | 1.4 |
| postwar | maples, pears, crape myrtles, oaks, some palms, 14 m | scored concrete | square | cobra head | 0.8 |
| tract | younger, tidier, narrower crowns, more palms, 13 m | clean concrete | rolled | cobra head | 0.3 |
| new | saplings on stakes in a string-straight row, 10.5 m | new concrete, broom finish | rolled | slim LED | 0.05 |

The pothole rate is then scaled by the street's class (service and residential most, primaries less, freeways none) and by a kilometre-scale neglect roll.

How the era is chosen (`guessEra`, pure and tested):

1. Start dates. If three or more buildings in the cell carry `start_date` (or `year`) the median year decides. **The current bake does not keep start dates**; the hook is there (`real.near('boxes')` rows with `start_date`) for when `tools/bake-realcity.py` is taught to keep them.
2. Otherwise the houses' own era there (`decor.js houseEra`, the same tracts the house models use), leaned on by:
   - an old town centre (`OLD_TOWNS`: San Francisco, Oakland, Berkeley, Alameda, Palo Alto, San Jose, Old Town Danville, Pleasanton, Livermore, Walnut Creek, Martinez, Benicia and others): its core is historic when it is packed (land use 13 or shops), its ring older;
   - the street pattern: a square grid with no dead ends reads older, curves and cul-de-sacs newer (`gridRegularity`, angles folded into a quarter turn);
   - for a grown town (crysis), distance from its centre: a dense regular core is historic, the edge newest.

`eraMap(real)` is the runtime cache, one per real city, shared by the road map, the trees, the lamps and the potholes.

## The paint layer

`realcity.js` already drew a second "paint" target with the yellow lines (R) and lane wear, patches and covers (G). It is RGBA now (one format change), and `potholes.js paintStreet()` adds per street (one call site in `drawRoadMap`):

- **B**: a pothole's depth as a distance field (0.5 on its rim, rising inward), or 0.3 inside a patch where a hole was filled.
- **A**: the street's era and bearing, `(era * 48 + bearing / 3.75 deg) + 1` over 255, drawn as a band out past the sidewalk. Read with `texelFetch` so it is never blended. The bearing lets the sidewalk's joints and bricks run along and across the street.

The ground shader (`terrain.js`, functions in `weathering.js`):

- `potholeAge`: broken edge, crumbled lip, the base course and loose stone inside, the depth fed to `wxBump` so the light reads it, water standing in it after rain (`uWet`); a filled hole is fresh black asphalt with the existing patch seam.
- `walkEra`: brick for the historic core, scored concrete for the rest, older slabs lifted at a joint by roots (lit step and shadow, real bump), cracked across, dirt in the joints; the newest bright with a broom finish. Falls back to `walkAge` where no era is painted.
- `kerbEra`: granite, square concrete, or a wider rolled kerb.
- `asphaltAge` leans its age on the era (`wxEraAge`): black on a new subdivision, grey and cracked on an old street.
- The procedural grid's streets get analytic potholes (one chance per 5 m of lane, more in the older towns).
- Yards brown off in late summer where nobody waters (`uLawnDry`, `seasons.js SEASON_U`).

## Potholes you feel (`bay/potholes.js`)

Holes are laid out per street from its own dice (`holesFor`), in the wheel paths, sometimes in twos and threes. While you drive, the holes within 70 m are gathered every few seconds into a typed array; each frame the four wheel contacts are checked against them. A wheel dropping in gives a ka-thunk (synthesised, through `soundBus`), a jolt of the driver's eye (a stiff spring on `camera.position.y`), and, with the physics car, a downward impulse at that corner (`applyImpulseAtPoint`) that the springs throw back. No allocation per frame.

Filled holes are kept in this browser (`localStorage` `crysis-potholes-v1`).

## The pothole favour (`people/errands-core.js`, `people/errands.js`, `bay/roadcrew.js`)

A new favour kind, `pothole`: someone near a pothole not yet reported asks you to report it ("There is a pothole on Hartz Avenue that nearly took my wheel off..."). Say yes, walk to the pin and stand by it for a moment (or drive right over it) and the report goes in; they pay 25 credits and up, it counts as a favour on the compass, and toward a new daily goal (`pothole1`).

The businesses ask it too (`economy/requests.js`): a food place, shop, place to stay or garage with an unreported pothole within 150 m of its door may put "...'s deliveries keep hitting a pothole on ...: report it to the city" on its board (kind `pothole`, steps go and wait at the hole, 12 credits and up). `bay/streets.js` hands the board its pothole source (`setPotholeSource`); whoever completes the request, you or someone in the town walking it (`people/npc-quests.js`), sends the crew.

The city's crew (`roadcrew.js`) comes about 20 s later: a white patch truck in the lane short of the hole with its arrow board flashing, cones in a taper and round the hole, two or three workers in hi-vis raking and tamping (thuds), hot asphalt growing in the hole. After 45 s the hole is filled (`potholes.fix`, the road map repainted: a square of fresh black patch from then on) and they leave. If you are far away the hole is filled anyway, a little later; reports from an earlier visit are filled on the next.

## Street trees (`bay/streettrees.js`, `bay/city.js`)

The bake planted one plain row of trees 3 m behind every residential sidewalk. Within 1 km (650 m on a phone) those are taken out and each street is planted again by its era: species, height, crown width (`nx`), spacing, gaps, tree wells (at the kerb, in the sidewalk) or the strip behind the sidewalk, stakes on the newest, palms where the climate suits (fewer in the fog belt). They go into the city's tree list, so they are drawn by its near, middle and far tiers, and pass through the existing filters: no tree on a carriageway, drive, trail, corner or sight triangle (`clearance.js`; only a tree in a well may stand in the sidewalk, via a second clear distance per piece). Cap 9000 (3500 on a phone), nearest kept.

`city.js` gains a fourth tree tier, palms (`vegetation.js palm()`, now with `nuts: false` for the streets' fan and date palms), a fourth impostor in the far atlas, narrow crowns, and autumn colour on the deciduous street trees (`seasons.js autumnK`, through the instance tint).

Round you (240 m, 140 m on a phone) `createStreetDecor` draws, instanced: the stakes and ties of the young trees, the iron grates of the tree wells, and in autumn drifts of fallen leaves under the deciduous ones (`leafDrift`).

## Lamps (`bay/streetlife.js`)

The mapped streets' lamps follow the era: acorn lanterns on posts every 24 m in an old core (their light pool now always on the ground under them), slim LED poles in the newest subdivisions, cobra heads elsewhere and on the arterials.

## Seasons (`bay/seasons.js`, all pure and tested)

- **Holiday lights** (`holidaylights.js`): from the day after Thanksgiving through 6 January, lit after dark. About 55% of houses (the same ones every night, and the same ones `houses.js` gives its eave bulbs up close) string all colours, warm white or cool white icicles along their eaves; downtown street trees (tree wells, historic era) are wound with warm white up the trunk and through the crown. One `THREE.Points` draw, one buffer filled when the city round you is rebuilt, the twinkle in the shader; 52,000 bulbs within 300 m on a desktop, 14,000 within 170 m on a phone. A house's points fade out across the 36 to 46 m hand-over to its own model.
- **Sprinklers** (`sprinklers.js`): May to October, each watering house's impact head runs once between 5 and 7:45 in the morning (its own start and length). Droplets thrown in a ballistic arc and swept slowly across the lawn and quickly back, all worked out in the vertex shader from the hour and the clock; a wet half disc darkening the lawn and the sidewalk's edge while it runs and drying over two hours (multiply blend, its timing also in the shader); a looped tick-tick and ratchet from the nearest running head. 64 heads by 90 droplets within 95 m on a desktop, 24 by 36 within 55 m on a phone. Nothing on the CPU per frame but a few uniforms and the nearest-head check.
- **Autumn**: deciduous street trees turn from October to a peak about Thanksgiving; their leaves lie under them into January (and the gutters already collect them, `uLeafFall`).
- **Late summer lawns**: `lawnDry` peaks in August and September.

`?date=2026-12-15` in the address (calendar.js) or the month picker in Sky & World shows any of these.

## Console

`Crysis.streets()` the era where you stand and every count; `Crysis.streets.holes(r)` the potholes round you; `Crysis.streets.report()` reports the nearest to its crew; `Crysis.streets.crew()` puts a crew to work on the nearest now.

## Phones

Everything is instanced or one draw: the trees join the city's tiers; stakes, grates and leaves three instanced meshes; lights one point cloud; sprinklers one point cloud and two instanced meshes. Counts are lower on a phone throughout (see above). The paint target grows from two channels to four (1024 square on a phone, no multisampling).

## Not done, and notes

- Start dates are not in the bake yet (see above), so every era is the guess.
- Car bumps come from the mapped and grown towns' holes; the procedural grid's painted holes are not felt.
- Deciduous trees colour but keep their leaf cards through winter.
- Tests: `island/tools/streets-by-era.test.mjs` (eras, rows, trees, potholes, the era cache, holiday window, sprinklers, autumn, lawns, the favour).
