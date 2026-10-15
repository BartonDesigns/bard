# Environmental graphics: signs, decals, stickers, graffiti and grime (14 October 2026)

All of it lives in `island/src/signage/`. Shared files carry small, marked hook lines only.

## Design rationale

**Hierarchy.** A street is read in passes: first what you must obey (stop, yield, do not enter, the speed), then where you are (the street-name blades, the exit, the destination), then what is offered (the hours on the glass, the cards a shop takes, the aisle numbers), and last the noise of people living there (stickers, flyers, tags, gum). The system keeps those passes apart. Regulatory and guide signs are retroreflective, on posts at the heights the manuals use (about 2.1 m to the bottom of a sign in town, 6.6 m to the bottom of a gantry), sized in the manuals' proportions, with nothing decorative on them. Wayfinding (blades, totems, hospital signs) is mixed case where the eye reads words and capitals where it reads a command. Shop decals sit where hands and eyes go: push or pull at the handle (1.12 m), the hours at eye height (1.48 m), the street number on the transom, the alarm sticker low in the corner of the window. Street noise is kept below the official layer in the stack and above the wall.

**Typography.** One sans family from the system (Inter or Liberation Sans here, Helvetica or Arial on players' devices), condensed by scaling the way the highway alphabets are narrower than a text face, tracking opened on capitals, legends sized to the panel with a border's width of margin. A serif only where a trade would use one (gold leaf, the park board, a college sticker). Japanese legends use the system's CJK gothic. No trademarked typeface is reproduced.

**Regional systems** (`systems.js`, chosen by `economy/establishments.js localeAt`):

| system | where | stop | speed | warnings | guide | blades | traffic |
| --- | --- | --- | --- | --- | --- | --- | --- |
| us | the United States and Canada | red octagon, STOP | white rectangle, mph | yellow diamond, school pentagon in fluorescent yellow-green | green, route on a generic shield | green, block number | right |
| americas | Mexico, Latin America, Brazil | octagon, ALTO | white rectangle, km/h | yellow diamond | green | green | right |
| vienna | Europe and most of the world | octagon, STOP | red ring, km/h | red triangle | blue, route in a circle | blue enamel | right |
| uk | Britain | octagon, STOP | red ring, mph | red triangle | green | white plate, black legend | left |
| jp | Japan | red inverted triangle, 止まれ | red ring, blue numerals | yellow diamond | blue, route in a box | blue | left |
| au | Australia | octagon | white rectangle, km/h | yellow diamond | green | green | left |
| orbital | the procedural planets (API only for now) | HALT | ring | hexagon | graphite and cyan | graphite | right |

Plates follow the region too: an American plate with the state in script and a dealer's frame on some, the EU's blue band (a ring of dots, not the emblem) with the country letters, Britain's white front and yellow rear, Japan's white plate with green characters and its region and class number. Windscreen stickers follow local habit: a resident parking permit in the US, the green emissions disc in Germany, the inspection sticker top centre in Japan.

**Materials** (`materials.js`). Each decal answers light in its own way, not its host's:

- retro: prismatic sheeting on road signs and plates. By day an ordinary semi-matte face; at night, when you drive, the headlights' light comes straight back to the driver (the camera stands in for the lamps), bright inside the beam and falling off with distance, dark outside it. The blank's back is bare aluminium in the same silhouette.
- vinyl: glossy printed or cut vinyl, a tight highlight over matte brick or painted metal (stickers, door signs, aisle markers, totems, liveries).
- glass: cut vinyl on a window, seen from both sides; from inside it reads mirrored and duller (the adhesive side); frosted film is translucent white; a little of the room's light comes through at night.
- paper: posters, flyers, shelf tags, the transit map. No sheen, a corner peeling where the paste let go (cut away past the fold, the pale back curled beside it), yellowing and stains with age.
- foil: gold leaf, metallic alarm stickers, suite plaques, the fire engines' scrolls.
- paint: spray paint; the wall's grain shows through, and a crew's buff is a roller block a shade off the wall.
- grime: no texture at all. Rust runs, soot plumes over kitchen vents, water streaks, trodden gum and oil blots are worked out in the shader by `GRIME_GLSL`, added to `bay/weathering.js` beside the wall weathering it extends (it uses the same `wxN` and `wxH` noise).

## Layering: nothing fights, at any distance

`layers.js` defines the stack: surface, grime, paint, poster (and sign faces), sticker, sticker on sticker. Each layer is lifted a few millimetres further off its host along the host's normal (3 mm, then 1.5 mm a layer; 5 mm and 2.5 mm on a phone), biased toward the eye with `polygonOffset` in the depth buffer's own steps (units -3 per layer step, -6 on a phone), and drawn with a higher `renderOrder` (20 and up, after the opaque world and the glass). Decals write no depth, so where two decals overlap the later one is simply on top, decided by draw order rather than by depth, at any distance and on a phone's coarser depth buffer. The bias holds far off where a fixed lift alone would not; the lift holds at grazing angles. Inside one batch instances draw in order, so a new tag over a crew's buff is pushed after it. Ground decals (gum, oil) are tilted to the local slope and lifted 3 cm. Everything fades out before it would shimmer (signs at 420 m, stickers by 90 to 140 m; less on a phone).

`island/tools/signage.test.mjs` checks that every layer is lifted further, biased further and drawn later than the one under it, on both desktop and phone settings.

## Batching and phones

One atlas (`atlas.js`, canvas 2D, 2048 square; 1024 on a phone with faces drawn at 55%) holds every face in the region, each drawn once and shared by every instance. Faces are packed on shelves; when the region wants more than fits, the sheet is repacked from the tallest down, and since drawing depends only on the face record a repack looks the same. One instanced draw per material and layer (`batch.js`), plus one for the posts, one for the totems' slabs and one merged mesh for the gantries: in practice 8 to 12 draws for a region. Per-instance data is the matrix, the atlas cell (`aCell`) and four flags (`aFx`: back mode, seed, wear, extra). Rebuilds happen when you have moved about a quarter of the radius or when the streets, freeways, businesses, built shops or rebuild sites change; nothing allocates per frame (the cars' decals write into preallocated arrays). Radius 420 m (260 m on a phone), shops' glass within 170 m (110 m), shop interiors within 55 m (30 m; no shelf tags on a phone). Caps are halved on a phone, and graffiti density is multiplied by 0.6. The quality governor (`world/governor.js qualityNow()`) narrows the radius with its `far` and, at the low tiers, takes the phone's lighter set of small decals (fewer stickers and tags, no gum, no shelf tags); a change of tier rebuilds the region. The atlas size is fixed when the world is made (its faces are drawn at three quarters of their nominal density, and the hours cards carry no shop name so every shop keeping the same hours shares one). Everything is disposed with the world.

The cars' decals have their own small atlas (2048 by 1024; 1024 square on a phone), redrawn only when the locale changes: 48 plates, 24 bumper stickers, 12 rear-window stickers, 8 permits and the liveries.

## Placement rules (`placement.js`, plain numbers, tested)

- **Junctions** are points shared by two or more drive roads (as realcity.js finds its crosswalks). Two collectors or more crossing are signalled (streetlife.js stands signals there): no stop or yield. Otherwise the minor legs stop (or yield, in a Vienna town sometimes); all minor streets get an all-way stop with its plaque in the American manner about half the time, otherwise the street with the shorter run gives way (and in a Vienna town nobody, now and then: priority to the right). Stop and yield signs stand on the incoming lane's curb just past the crosswalk and stop bar, facing the traffic, on its own side of the road (left in Japan, Britain and Australia).
- **Street-name blades**: one corner per junction of two named streets, two blades crossed on one post at 2.95 and 3.13 m, each square to its street, readable from both sides, the real OSM names with the suffix abbreviated in the American manner, block numbers in the US.
- **Speed limits** leaving a junction on the outbound right, about a third of the arterials' legs and a tenth of the residential ones, in the system's units and the road class's usual value; a school zone pentagon or triangle and the school speed where a school (map kind 7) is within 160 m.
- **One way and do not enter** on carriageways mapped one way (the `divided` flag; their points run with the traffic): ONE WAY back to back facing the cross street at the mouth with the arrow worked out for each side's viewer, DO NOT ENTER at the far end.
- **No parking** downtown (land use 7 or 8) now and then, tow-away or hours.
- **Freeways**: an exit link (one starting on the mainline) gets an EXIT gore sign 45 m down the ramp between ramp and mainline, and a gantry 400 m back up the mainline (none within 70 m of a bridge, none within 250 m of another) with the exit's guide sign over the right lanes (exit number tab, the cross street's real name, the distance) and the route's pull-through sign over the left (generic shield, direction, destination). Every bridge face over a road gets its clearance (US feet and inches, metres elsewhere), from the real height under the girder.
- **Shop doors and windows** (every business the economy plans, within 170 m): PULL at the handle (the inside face is left blank so it is not read mirrored), the hours (days, times in 12 or 24 hours by system, closed Sundays for some trades), the street number on the transom (gold leaf on a quarter), invented card marks, the access figure, no smoking, an alarm company's sticker low in a corner (sometimes over an older company's), the name in gold leaf or cut vinyl on the display window, a sale poster inside the glass for groceries, pharmacies, hardware and the like, an OPEN card; offices a suite plaque and no soliciting. Where bay/commercial.js has built the shop the decals sit on its real glass at its real door, so the vinyl reads differently from the glass behind it; elsewhere on the business's face.
- **Back doors** on the alleys: STAFF ONLY, deliveries, the number, a tow-away sign by the door.
- **Grocery and retail interiors** (built shops within 55 m): an aisle marker hung from the ceiling over each aisle with its number and what is on its shelves (by trade), a department sign over the back wall, price tags along the shelf lips (some on sale).
- **Cars**: plates front (where the system requires) and rear, a dealer's frame on 40% of American plates, bumper stickers on a third, a rear-window sticker on a sixth, permits by region; the same car always carries the same set (seeded by its id, or where it was parked). Police cruisers carry POLICE and an invented badge on their white doors and a roof number; ambulances AMBULANCE on the box sides and mirrored on the front, a heart-and-pulse mark (no protected emblem), retroreflective chevrons on the back; fire engines gold-leaf FIRE RESCUE and a scroll line.
- **Public space**: a bus stop flag on its post at every shelter and a system map on the shelter's panel; downtown wayfinding totems at some corners with the nearest places, arrows worked out for each face, and the minutes' walk; the hospital's EMERGENCY sign at its front by the street and H signs with arrows at the two junctions nearest it; construction boards, a permit and a road-work warning round every building being rebuilt.
- **Graffiti** (`graffitiFor`): surfaces are the freeways' sound walls (their traffic side), the overpass piers (all four faces) and ramp abutments, the alleys' back walls and dumpsters, industrial buildings (map kind 9 or land use 8), sign backs and posts. Never a business's front, never a civic building, a school or a service's building. Density is each surface kind's base times the writers' pressure: `0.45 + 1.7 trouble - 0.7 (means - 0.5) - 0.12 law`, from the region's situation and morality tally (people/moral-regions.js through npc-quests' `where()`), times the land use (industrial most, residential and parks least). Tags mostly, throw-ups a quarter of the time, a full piece now and then on a long wall, wheatpaste posters in alleys and on industrial walls, sticker clusters on sign backs and posts, flyers with tear-off tabs. City crews buff some each week (more where it is well off) and some get written over again.
- **Grime** (`grimeFor`): water streaks off the sound walls and piers, rust under fixtures and soot over kitchens' vents in the alleys (a food business's back door), gum by the bus stops, busy doors and downtown crosswalks, oil by the dumpsters.

Hand-made letterforms (`graffiti.js`): one skeleton alphabet (a stroke per part of each letter), written three ways. A tag is thin and fast (slant, crowding, bounce, shake, a swoosh, a crown or halo, drips where the can was held); a throw-up is the same skeleton stroked fat in outline, filled fast with streaks and a highlight; a piece adds a colour cloud behind, an extruded shadow, a gradient fill, cut lines, shine, stars and the writer's name, crew and year. Writers' names come from sounds writers like and are checked against the economy's list of brands.

## API: how another system places a sign or a decal

```js
// any records of your own, in placement.js's shape; kept until removed
world.signage.add('mysystem:42', [
	{ mat: 'retro', layer: 3, face: { k: 'speed', sys: 'us', n: 25, unit: 'mph' }, x, z, hy: 2.45, nx, nz, w: 0.61, h: 0.76, back: 0 },
]);
world.signage.remove('mysystem:42');
// a shop's glass, by your own geometry (the storefronts: front is the glass plane, door its
// distance along the face; glass false for an opaque door)
world.signage.storefront('shop:7', { name, type, use, x, z }, { x, z, nx, nz, run, g, door }, { glass: true });
// the cars: pass seed (or seedAt [x, z]) and livery in fleet.add's options; a vehicle built from
// boxes takes its livery as meshes: root.add(...vehicleLivery('ambulance'))
```

Face kinds (`faces.js FACE_KINDS`): stop, yield, allway, speed, oneway, noentry, noparking, school, work, blade, guide, exitgore, clearance, busstop, transitmap, totem, hospital, parkrules, site, permit, pushpull, hours, address, payment, access, nosmoking, alarm, window, sale, open, suite, nosolicit, staff, deliveries, aisle, dept, price, talker, plate, bumper, wsticker, cpermit, livery, tag, throwup, piece, buff, wheatpaste, sticker, flyer. `drawFace(g, x, y, w, h, face)` draws any of them into another canvas. `Crysis.signage()` reports the system, the atlas, the batches and draws; `Crysis.signage.headlights(true)` turns the camera's lamps on to look at the sheeting at night on foot; `Crysis.signage.where('blade')` lists where records of a kind stand.

## Hooks in shared files

- `bay/freeways.js`: records `marks()` (sound wall faces, piers, abutments, bridge faces with clearance, freeway crossings) and `builds()`; exports `DEST` and `routeOf`.
- `bay/weathering.js`: `GRIME_GLSL`.
- `economy/layer.js`: each business keeps `E.front` (the face it fronts the street with); `plan()`.
- `bay/commercial.js`: built shops record their shelf rows (`aisles`) and `list()` gives `doorX`, `glassZ`, `aisles`, `ceil`.
- `vehicles/fleet.js`: `setFleetDecals(factory)`; each fleet asks for a decal set and passes near cars through.
- `bay/streetlife.js`, `vehicles/life.js`, `vehicles/index.js`, `military/police.js`: a seed (and the police livery) in `fleet.add`'s options.
- `services/responders.js`: the livery meshes added to each responder's body.
- `main.js`: create after the freeways, update after them, dispose with the world, `Crysis.signage`.

## Not yet

- The procedural grid towns (bay/city.js's own streets) get shop glass, alleys, cars and freeway marks but no street signs: their streets are not in the real city's road list.
- Military vehicles carry no stencils yet (their parked kinds are instanced in military/; `vehicleLivery` has a 'military' face ready).
- The orbital system exists but is not yet wired into the planets' colonies.
- Rail corridors: the baked maps carry no rail, so none are painted.
