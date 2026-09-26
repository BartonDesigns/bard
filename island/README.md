# Crysis (the island engine, stage 1)

The tropical island world for Level 99 Bard. It is a separate ES-module
project bundled into `dist/island.js`, which the faceplate (`../index.html`)
loads on demand from the sea door (`≋`) or when space flight enters a
TERRAN or OCEAN planet.

## Build

```
npm install
npm run build     # writes dist/island.js (commit it; GitHub Pages serves it)
npm run watch     # rebuild on save while developing
```

Open `dev.html` from a local server to run the island on its own
(`dev.html?seed=42` for another island).

## Layout

- `src/world/islandgen.js` — seeded height map, coast, reef, peak, village site, paths
- `src/world/terrain.js` — GPU-displaced ground, sand/grass/rock/path shading
- `src/world/ocean.js` — rolling Gerstner swell, depth colour, caustics, foam
- `src/world/sky.js` — sky, sun and moon, clouds, haze, the light rig and clock
- `src/world/photomats.js` — the generated photographic atlases (`textures/realism191`, `people193`, `materials-*.webp`, and `textures/houses/*` when made from `ASSET_PROMPTS_HOUSES.md`): each swatch cut out, made seamless, turned into a tintable detail map with derived relief, loaded in the background. Used by the houses (stucco, planks, walnut, linen, suede, granite, aluminium, enamel), Mt Diablo (Rock City's and Castle Rock's sandstone and the summit's blocks, sampled from the world position on three planes), the trails (packed loam and gravel close by), the open ground's grain (the hill grasses by season when they exist), every tree's bark, and the island village's cedar and limestone
- `src/world/weather.js` — weather that keeps pace with the clock: a slow seeded rhythm from clear to fair cumulus, passing showers and the odd storm; cirrus on its own rhythm. Showers are places (cells of rain born upwind and carried over by the wind, dark cloud above, curtains of rain below, rain on you as they pass); everything answers to the one wind (clouds drift, cirrus faster aloft, rain slants, trees and grass bend, a flock of birds wheels and drifts downwind); the ground darkens and glosses when wet and dries after; lightning in a storm (flash, bolt toward its cell, thunder after the distance's delay); rain sound, muffled indoors. Settings: Weather (auto or held: clear, fair, showers, storm), Rain, Cloud cover, Wind
- `src/world/rainbow.js` — the rainbow from the physics: Airy theory for each wavelength and drop size (supernumerary fringes inside the primary, the fast fade outside it), Fresnel losses per surface (the secondary fainter and reversed), water's dispersion, the sun's half-degree disc, the CIE 1931 observer; baked to `assets/rainbow.png` by `node tools/bake-rainbow.mjs`. The sky adds it as light round the antisolar point wherever sunlit rain lies along the line of sight (Alexander's dark band between the bows follows), with drop size from the rain rate; by the full moon, a nearly white moonbow
- `src/world/sky.js` also carries the planets at their real angles from the sun tonight (Keplerian elements for today's date) and satellites crossing in the hours after dusk
- `src/world/vegetation.js` — palms, hardwoods, banana, fern, shrubs, boulders (streamed)
- `src/world/grass.js` — two layers of grass around the player (turf underfoot, longer reach), shadowed
- `src/world/litter.js` — pebbles, fallen leaves, shells and coral bits, wrapped around the player on the GPU
- `src/world/village.js` — the fishing village, pier and boat
- `src/world/distant.js` — far islands and the neighbouring town with its lighthouse
- `src/player.js` — walking, looking, swimming and diving, collisions
- `src/boat.js` — the village boat: board, throttle and steer, rides the swell, leaves a wake
- `src/whale.js` — a humpback in the bay: blows, sounds with flukes up, breaches on a hard bass hit
- `src/music.js` — faceplate bands, play surfaces, ripples
- `src/crysis/land.js` — Crysis land ecology: land profile → canopy tree species (crown architecture, tints, habitats), palm, tree fern, elephant ear, screw pine, wildflowers, and the animals' genomes; community field for stands
- `src/crysis/landfauna.js` — butterflies, songbirds, a lorikeet flock, sandpipers, ghost crabs and lizards, pooled round the player
- `src/crysis/ecology.js` — Crysis ecology: seed → marine profile → food web → species genomes (corals, fish, small life), community field, `describe()`
- `src/crysis/fish.js` — fish grown from genomes (lofted body, fins, tail, painted pattern) and niche behaviour (clouds over heads, grazing groups, pairs, bait balls, patrolling predators, rays)
- `src/crysis/inverts.js` — sea stars, sea cucumbers, giant clams, feather dusters and garden eels that duck, moon jellies
- `src/reef.js` — coral heads grown from the ecology's coral species, placed by depth, exposure and community
- `src/caverns.js`, `src/magma.js`, `src/underwater.js`, `src/sealife.js` — sea caves and arches, the vent and lava tube, basalt and kelp, the vent swarm
- `src/people/body.js` — people built from the CC0 MakeHuman base mesh (from the caves build): Bay Area ancestry mix, sex, age, height, build, clothing fitted from the body cage, fitted hair, eyes, face morphs, a 64-bone skeleton with fingers
- `src/people/motion.js` — the motion rig: critically damped springs on every drive value, a continuous gait phase, planted feet that stay put while the body passes over, two-bone leg IK, heel strike and toe roll, pelvis bob/roll/sway, arm counter-swing with lagging elbows, head and eye gaze, blinking and talking
- `src/people/persona.js` — who someone is when you stop to talk: name, age, job, neighbourhood and temperament from their seed and where you met; the prompt the conversational model plays them from; simple in-character replies without a model; and their body language read from what they say (mood and gesture tags, or the words: yes/no, jokes, directions, doubt, questions, emphasis)
- `src/world/lodfade.js` — detail levels dissolve into each other (and out at the draw distance) instead of popping; used by the island's plants and the city's trees, whose far crowns take the size and average colour of the near trees
- `src/people/people.js` — the population: walkers on the block pavements (crossing at corners), joggers, pairs chatting, people waiting; more downtown and by day
- `src/drive.js` — Drive (🚗 or V): snap onto the road, street or trail you are on and it carries you at the road's own pace (25 mph on a residential street, 65 on a freeway, hiking pace on a trail); ← / → choose the next turn, ↑ straight on, ↓ turn round, Shift to hurry. Follows the real road graph where the map is real (looking through the short links of a junction to the road beyond), and the town street grids everywhere else
- `src/main.js` — renderer, loop, HUD, settings, Journey adapter

## Earth: the Bay Area

On Earth (the sea door, and landing on Earth from flight) the island sits in the Gulf
of the Farallones, 25 km west of the Golden Gate, and the real Bay Area surrounds it at
true scale:

- `src/bay/geo.js` — the lat/lon ↔ world mapping, the baked height levels
- `assets/bayarea/h0–h2.png` — real terrain and bathymetry (AWS Terrain Tiles: USGS 3DEP,
  NOAA, ETOPO1), 120 m over the nine counties, 60 m over the core bay, 15 m round the
  Golden Gate; rebuilt with `node tools/bake-bayarea.mjs`
- `src/bay/places.js` — every GeoNames place in the nine counties plus waters and
  landmarks; rebuilt with `node tools/places-bayarea.cjs <cities.json dir>`
- `src/bay/terrain.js` — the streamed ground (California grass, oak, redwood, chaparral,
  street grids, city lights), and the shared height function
- `src/bay/bridge.js` — the Golden Gate Bridge at its real dimensions (walkable deck)
- `src/bay/styles.js` — how each area is built (land-use zoning: industry, retail, campuses; tract eras; SF districts): real street-grid bearings, block sizes, house styles (SF rows, the Sunset, older towns, valley suburbs with curving streets, business parks)
- `src/bay/city.js` — buildings on the street grids by style, the skylines, SF's tallest landmarks, the Bay Bridge. Street and yard trees are the island's leaf-card trees in Bay Area species (plane, live oak, redwood/cypress, shrubs), detailed close by and simplified further out. Up close every lot is lived in: tract houses with side yards, garage doors, porches, front doors, walks, foundation shrubs and back fences; older towns with deep porches and a driveway to a garage out back; SF rows with garages and front stairs at street level, bay windows from the first floor, and shopping streets with shopfronts, signs and awnings
- `src/bay/landmarks.js` — landmarks across SF, the East Bay, the Peninsula, the South Bay and San Ramon, the port cranes, the other bridges
- `src/bay/roads.js` — the freeways (I-680, I-580, SR-24, I-80, I-880, US-101, I-280) and the Iron Horse Trail, with lamps and traffic at night
- `src/bay/cars.js` — cars with real proportions (sedan, hatchback, SUV, pickup, minivan): smooth lofted bodies, glass cabins, cut wheel arches with tyres and alloys, lamps, clear-coat paint that reflects the sky
- `src/bay/streetlife.js` — the street at eye level: parked cars at the kerbs, moving traffic, street lamps that glow at night, signals, hydrants, meters, bins, benches, bus shelters
- `src/bay/citysound.js` — the sound of the streets: the city bed, passing cars (panned, Doppler), your footsteps and the people's, voices where people talk, birds by day and crickets at night
- `src/bay/realcity.js` — the real city, where it is mapped street by street (San Ramon, Danville, Mt Diablo State Park and Clayton, with the edges of Dublin, Walnut Creek and Concord): real roads with sidewalks, kerbs, cul-de-sacs, driveways and lane lines painted into the ground from a road map rendered round you; real building footprints raised as houses with hip roofs, doors and garages facing their street; yard, street and park trees; pools; street life and walkers on the real streets. Data: Overture Maps (© OpenStreetMap contributors, ODbL; Microsoft and Google footprints), fetched with `python3 tools/overture-fetch.py <release> <W> <S> <E> <N> <dir>` and baked with `python3 tools/bake-realcity.py <dir> <name>` into `assets/bayarea/real/`
- `assets/bayarea/h3.png`–`h6.png` — 10 m terrain over San Ramon, Mt Tamalpais and Mission Peak, 12 m over Mt Diablo (`node tools/bake-bayarea.mjs h3`)
- `assets/bayarea/real/` — the mapped regions: `eastbay` (Tri-Valley and Mt Diablo), `tam` (Mt Tamalpais, Mill Valley), `missionpeak` (Mission Peak, Fremont's foothills). The road maps round you store distance to each edge, so streets, kerbs and paint lines stay straight and sharp up close
- `src/bay/houses.js`, `src/bay/houseplan.js`, `src/bay/housekit.js` — the real houses up close, and inside. Within about 45 m (30 m on a phone) each mapped house stops being a painted block and is built whole from its footprint: stucco walls with thickness and a concrete foot, windows with frames, glass, sills, foam surrounds, blinds and curtains; a front door, garage doors and the back slider that open (🚪 or E); a stoop with steps down to the walk; fascia, gutters and downspouts. Inside, `houseplan.js` lays out the floors a 1980s-90s Tri-Valley tract house has: the garage and front door exactly where the facade shows them, the stairs beside the entry, then living and dining rooms at the front, kitchen and family room open to each other at the back, powder room and laundry by the garage, and upstairs a hall and landing with the master suite (bath, walk-in closet), bedrooms and a hall bath; single-storey houses get a bedroom wing. Rooms grow from seeds as rectangles and then into what is left; doorways join them (wide cased openings between the public rooms, a door into each of the others, swinging into the room it serves). Floors are oak, tile, carpet or concrete by room; each room is furnished by rule against its walls, clear of its doors, windows and the stairs (sofas facing TVs, beds against a wall with nightstands, counters round the kitchen with the sink under the window, the range and hood, fridge and island, vanities, tubs and toilets, washer and dryer, shelves, bins, a workbench and often a car in the garage). The same house is always the same: its position seeds it. The towns the civilization engine grows beyond the survey get the same treatment: their houses are built whole and can be walked into too. The far block dissolves into the near house over a band of distance, so nothing pops; walls, doors, rails, stairs and furniture are solid, and the floors and stairs carry you. `node tools/houseplan-test.mjs <lat> <lon> [radius] [count]` prints the plans round a place as text
- `src/bay/diablo.js` — Mt Diablo's landmarks: Rock City's sandstone with walk-in wind caves and honeycomb tafoni, Castle Rock's crags, the summit's stone visitor centre with its tower and beacon; carved with marching cubes from a distance field that also makes them solid
- wild land in the mapped region (city.js `wildLand`): oak woodland on north slopes and down the canyons, chaparral on the hot south-facing ridges, gray pines, blue oaks in the grass, grown from the terrain's slope, aspect, height and gullies; the Season setting (☀) turns the hills from spring green to summer gold, defaulting to the time of year
- `src/bay/labels.js` — the notation as you enter each city, water or landmark
- `src/world/starcat.js` — 6317 real stars (HYG v4.1, CC BY-SA 4.0) for the night sky

### The civilization engine: towns beyond the survey

Past the surveyed land the terrain goes on and seeds towns of its own (`terrain.js`
`towns`). From afar they are the ground shader's street grid; come within a couple of
kilometres of one and the Crysis civilization engine grows it street by street, from
what the real Bay Area taught it:

- `tools/learn-civ.py` reads the baked regions (`eastbay`, `tam`, `missionpeak`, plus the
  raw East Bay land use and the San Ramon heights) and writes `src/crysis/civstats.json`
  (about 5 KB): the road-class mix and widths; residential street segment lengths,
  curvature, junction degrees, cul-de-sac frequency and depth; arterial and collector
  spacing; block sizes; building sizes and heights by kind; setbacks, lot frontage,
  driveways, pools; trees per hectare by land use; land-use shares and adjacency; how
  big schools, parks and shopping centres are and how many per thousand houses; how far
  commercial land sits from an arterial; how steep built land gets; street-name suffixes
  by street type and the common name words. Rerun it after rebaking a region.
- `src/crysis/civgen.js` grows a town from those numbers: an arterial grid at the learned
  spacing (1.75 km), turned to the town's angle and bending round steep ground and water;
  a collector across each superblock; shopping centres on the corners of the central
  crossings, schools beside collectors, parks; residential streets grown from the
  collectors, each wandering with a learned curvature, steering off slopes, joining the
  street ahead or stopping short as a court, with side streets branching off and a gap
  filler sending a street into any open ground left; then lots down both sides at the
  learned frontage and setback, a house on each facing its street with its garage,
  driveway, front walk, sometimes a pool, yard and street trees; and an 8–10 m land-use
  map. Deterministic from the seed; the output has exactly the shape of a baked real
  region. `generateTownSteps` yields between pieces so it can run a few ms a frame.
  `node tools/civ-preview.mjs [radius] [seed] [suburb|older] [out.png]` grows one on
  made-up hills, times it, compares its network with the learned numbers and draws it.
- `src/crysis/civ.js` grows the nearest town as you approach (6 ms a frame; a 1.5 km
  town takes about 0.4 s of work, the biggest about 1.8 s), hands it to
  `realcity.js addRegion()` and drops it with `removeRegion()` when you leave (the last two
  are cached). While one is registered it is in the real city's spatial index, so the
  buildings, street furniture, parked and moving cars, drive mode and the walkers all use
  it, the road maps paint its streets, and its land-use map stands in for the main
  region's in the ground shader (which paints its lawns, parks, schools and parking and
  keeps the procedural grid off the town). `Crysis.world().civ.flush()` finishes the one
  being grown at once.

Earth in the Sol system is Crysis Earth: diving to Earth lands here, and ⇪ from here puts
the ship in orbit round Earth. The old flight build's Bay Area surface is gone.

Home: `Crysis.setHome(lat, lon)` marks your home (kept only in that browser's storage, never
published); `Crysis.goHome()` takes you there.

## People you can talk to

Walk up to someone and press Enter (or 💬): they stop, turn to you and listen. The
on-device model plays them from their persona; their gestures and face follow their words
as they stream. They can send you somewhere nearby, which goes into the journal as a quest
and completes when you get there. The model loads by itself on first launch where the
browser has WebGPU (Llama 3.2 1B on desktop, Qwen 2.5 0.5B on phones; ⚙ in the Guide
changes it or turns it off); without one, everyone answers with simple built-in replies.
New places you reach get a one-line field note in the journal.

## The Guide (✦, or G)

A companion you talk to by text or voice. It knows where you are and what is around you,
keeps a journal of things to find, answers questions about the places, and can act (take
you somewhere, change the hour, fly). Its voice is a model on your own device:

- **On this device (WebGPU)** — WebLLM runs Qwen 2.5 or Llama 3.2 in the browser; downloads
  once (0.9–2.3 GB), then works offline. Nothing leaves the device.
- **Ollama** — a local Ollama server (`OLLAMA_ORIGINS=https://level99bard.com ollama serve`).
- **Built-in** — with no model it still answers from the world itself.

`src/guide/llm.js` (backends) and `src/guide/guide.js` (world snapshot, journal, actions, panel).

## Crysis

The engine grows its world from the seed. The ocean and the land (flora communities, fauna)
are on the Crysis ecology; terrain types and the caves and flight
systems of the older builds move onto it next. `Crysis.ecology()` in the console prints
the open island's food web.

## Faceplate contract

- `window.L99Island` — `open({seed})`, `close()`, `active()`, `link()`
- `window.Crysis` — `world()`, `ecology()`
- Registers realm `island` with `L99TouchMusic175` and `L99Journey170`
- `L99Keyboard149.world()` reports `island` while it is open
- Reads `L99Continuity.bands` for music reactivity (the whale also answers a strong bass hit; its blow and song are its own synthesized voice, played into the faceplate lead bus `leadBus227`)
- When space flight landed you here (`packet.planet.origin`), `⇪ To the ship` asks Journey to hand the view back to flight above the same planet
