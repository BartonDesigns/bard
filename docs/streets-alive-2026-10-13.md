# Streets that read as real (13 October 2026, late)

The section 7 ideas from the roads handoff that are in now, plus building setbacks.

- **Corners** (`bay/realcity.js` corners()): every town junction of three or more legs where one street is among built-up land gets a crosswalk across each leg, just clear of the cross street's sidewalk. Continental stripes run along the traffic downtown and on the arterials; the suburbs get two plain lines. Each has a stop bar across the lane coming in, and yellow curb-ramp domes at either end. Legs are measured along the street (its first points are often a few metres apart). About 80 crosswalk legs at 25 junctions round downtown Danville.
- **Walk signals and the good-street goal** (`bay/crosswalks.js`, `gameplay/daily.js`): downtown and arterial crosswalks tick at the curb, a slow locator tick while it says wait and a rapid tick for the walk, on a 40 s cycle each. Crossing curb to curb inside the stripes counts toward a new daily goal (cross at a crosswalk three times).
- **Crossing choreography** (`people/people.js`): a walker changing sides at a corner goes by the nearest crosswalk, to its curb, a look both ways, and where there is a signal a wait for the walk (shared timing, `walkNow()`), so people gather and cross together.
- **Sound of the overpasses** (`bay/bridgesound.js`): a two-axle ka-thunk as your car runs on or off a deck; under an overpass the traffic overhead knocks on its joints now and then.
- **Buses at stops** (`bay/streetlife.js`): a bus coming by a shelter in its lane draws up and waits six to twelve seconds.
- **Dogs on leads** (`people/dogwalkers.js`): about one in six grown-ups walking the streets, a block or a park has their dog along (dog.js), at heel, with a lead from hand to collar. Three at most near you, one on a phone.
- **Globe highways** (`bay/berms.js`, `earth/globeroads.js`): graded like the Bay's roads even before a Bay region loads, and their ribbons get a vertex every 6 m so they follow the ground.
- **Buildings set back from the street** (`bay/realcity.js` setBack()): no mapped building stands in a carriageway or on its sidewalk, and homes sit 2.5 m further back behind a front yard. Each house moves whole (wings, garage), away from its street or both streets on a corner, by 3.5 m at most; its drive and walk follow. About 13% of the East Bay's buildings move, 1.9 m on average. This adds roughly a second to the East Bay region's load on desktop; watch it on phones.

Already present and left as they were: rain puddles, asphalt patches, cracks, tar snakes and utility covers (bay/weathering.js).

Still open from section 7: the pothole favour (needs a pothole layer in the road shader), street trees and pavement by era, seasonal touches (holiday lights, sprinklers). The structures pass (no intersecting buildings, alleys, breakable windows, destructible buildings and rebuild crews) follows the economy work.
