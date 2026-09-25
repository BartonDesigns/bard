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
- `src/people/people.js` — the population: walkers on the block pavements (crossing at corners), joggers, pairs chatting, people waiting; more downtown and by day
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
- `src/bay/city.js` — buildings on the street grids by style, the skylines, SF's tallest landmarks, the Bay Bridge. Up close every lot is lived in: tract houses with side yards, garage doors, porches, front doors, walks, foundation shrubs and back fences; older towns with deep porches and a driveway to a garage out back; SF rows with garages and front stairs at street level, bay windows from the first floor, and shopping streets with shopfronts, signs and awnings
- `src/bay/landmarks.js` — landmarks across SF, the East Bay, the Peninsula, the South Bay and San Ramon, the port cranes, the other bridges
- `src/bay/roads.js` — the freeways (I-680, I-580, SR-24, I-80, I-880, US-101, I-280) and the Iron Horse Trail, with lamps and traffic at night
- `src/bay/streetlife.js` — the street at eye level: parked cars at the kerbs, moving traffic, street lamps that glow at night, signals, hydrants, meters, bins, benches, bus shelters
- `src/bay/citysound.js` — the sound of the streets: the city bed, passing cars (panned, Doppler), your footsteps and the people's, voices where people talk, birds by day and crickets at night
- `src/bay/labels.js` — the notation as you enter each city, water or landmark
- `src/world/starcat.js` — 6317 real stars (HYG v4.1, CC BY-SA 4.0) for the night sky

Earth in the Sol system is Crysis Earth: diving to Earth lands here, and ⇪ from here puts
the ship in orbit round Earth. The old flight build's Bay Area surface is gone.

Home: `Crysis.setHome(lat, lon)` marks your home (kept only in that browser's storage, never
published); `Crysis.goHome()` takes you there.

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
