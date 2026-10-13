# Roads, overpasses, trees and places that make sense (13 October 2026)

Josh asked for smooth intersections, trees off the roads, inner-city overpasses for people and cars, and pools and parks only where they belong. Three audits measured the world first (in node on the real survey heights and baked map data, and in headless Chromium); the fixes are rules, not hand edits.

## Junctions and road surfaces (`bay/berms.js`, `drive.js`, `vehicles/physics.js`)

Found:
- Each road was smoothed on its own with a box filter cut short at its ends. The map splits roads at every junction, so every road end was pulled toward its own middle: two roads meeting on a slope disagreed by about 37 m times the grade (3 m at 8%, 5.6 m at 15%).
- Where roads overlap, the first road stamped won every grid cell, turning that disagreement into a step at the other road's kerb.
- The road-following car built a second profile of its own and could float 2.8 m above the drawn road or sink 1 m into it.
- Overpass decks were floors for anything under them: the road-following car rose onto a deck it passed under, and the free car's height field (sampled at y = 1e4) put an invisible wall under every overpass.

Fixed:
- Profiles are smoothed with their ends carried on straight (an odd reflection: a plane comes back as itself).
- Every junction gets a pad, a plane fitted to the ground and held to 5%, and every road meeting there is pinned to it, eased from the pad's grade into its own over a vertical curve.
- Curvature is held under 1.5 m/s² at 15 m/s; overlapping roads are blended by weight instead of first wins.
- The road-following car rides the same graded ground as people and the free car (decks still cached along the road). The free car samples floors at its own height and regrids when it climbs.

Numbers (node harness on real data; kink is the worst 2 m second difference in a 12 m junction box; acceleration at 15 m/s):

| Area | Worst kink before, after (m) | Junction kinks over 10 cm before, after | Worst acceleration before, after (m/s²) |
|---|---|---|---|
| San Ramon | 1.24, 0.16 | 27, 4 | 4.9, 2.9 |
| Danville | 2.15, 0.47 | 48, 13 | 6.6, 4.6 |
| San Jose | 0.27, 0.13 | 7, 1 | 1.2, 0.3 |
| Mill Valley | 3.94, 0.43 | 35, 10 | 14.6, 7.0 |

Regrading costs about the same as before (60 to 200 ms per 100 m of travel on desktop).

## Overpasses (`bay/freeways.js`, `bay/overpass.js`, `bay/realcity.js`)

Found: every mapped bridge counted the road joining its own end as a road underneath, so it rose 5.6 m right at its ends: cliffs at both ends of every overpass and humps on small creek bridges. Mapped footbridges were painted flat across the lanes they cross.

Fixed:
- A deck clears only the roads that cross its line (at a fair angle, clear of its last few metres), never the ones that join it or run alongside.
- It ramps down along the road it carries on to (6% for cars, 1 in 12 on foot, steeper only where the road runs out), through plain joins and never across a junction, on fill between retaining walls; the crest and feet are eased.
- Town street overpasses carry sidewalks; a footbridge mapped as an overpass's sidewalk rides the road's deck.
- Footbridges over streets stand on their own deck: a railing up the ramps and, over traffic, a chain-link cage, sides and arched roof, on slim columns. 135 mapped footbridges qualify across the regions (for example the Mary Avenue bridge over I-280 and the I-680 crossings in San Ramon).
- Deck heights come from each road's graded profile (`berms.along()`), the same wherever you stand.

## Trees (`bay/clearance.js`, `bay/city.js`, `crysis/civgen.js`)

Found (trees 3 m or taller within 450 m): downtown SF had 30 trunks on the carriageway and 36 on sidewalks, nearly all from the office and shop grounds planted 0.8 to 3.8 m from the wall with no road check; San Ramon had 44 on driveways and many in cul-de-sac turning circles from the baked map trees. Junctions had no sight-triangle rule. The only runtime guard was an 8 to 10 m land raster.

Fixed:
- One clearance grid per city rebuild (16 m cells): carriageways plus sidewalk on walked streets, turning circles, trails and footways, driveways and walks, the freeways beyond the mapped regions, and a sight triangle at every junction of three or more legs (9 m along each kerb, 15 m with an arterial).
- Every tree and planter shrub passes it.
- Office and shop trees stand far enough out to clear their walls.
- Globe-town trees keep out of streets.

Cost: about 70 ms to build and 1 ms per thousand checks, once per 300 m of travel.

## Pools, parks and the Diablo summit

Found: the summit pool was baked (the stone Summit Building was taken for a house and given a pool; the building is dropped at runtime but its pool was not). Of 155,748 baked pools, 23,391 were above 300 m, on slopes over 8 degrees, on non-residential land or with no home. Grid parks, courts and complexes ignored slope.

Fixed:
- No pool within 400 m of the summit.
- A mapped pool needs a level yard (under 1.2 m drop), below 300 m, on land people live on: about 23,200 of the flagged pools go, and about 158 remain (mostly pools 12 to 15 m from their house).
- Grid yard pools need a level deck; park blocks, courts and dog parks need a block that falls under 2.5 m; apartment complexes with pools under 3 m, all below 300 m.
- Globe-town pools need a slope under 10%; parks are checked at their corners.
- Mount Diablo State Park's tables, grills and restroom gather at Juniper Campground. The summit keeps its building, beacon, car park and view.
- The radio buildings high on the ridge get no yard props.

## Not done yet

- Corners (curb ramps, crosswalks, stop bars), pavement age, street trees by era, puddles, crossing choreography and sound under bridges (handoff section 7).
- The bake should learn the same pool and tree rules (driveways and turning circles in its `blocked` area) on the next re-bake.
- Globe highways get no grading until a Bay region has loaded (`berms.update` waits for `real.loaded()`), and their ribbon vertices are 20 m apart.
- Grid trees can stand in a mapped area for the seconds before its data arrives.
- Nothing here has been checked on a real phone.
