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
- `src/main.js` — renderer, loop, HUD, settings, Journey adapter

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
