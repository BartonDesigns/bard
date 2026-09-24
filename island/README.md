# Island engine (stage 1)

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
- `src/world/grass.js` — the grass carpet around the player
- `src/world/village.js` — the fishing village, pier and boat
- `src/world/distant.js` — far islands and the neighbouring town with its lighthouse
- `src/player.js` — walking, looking, swimming, collisions
- `src/music.js` — faceplate bands, play surfaces, ripples
- `src/main.js` — renderer, loop, HUD, settings, Journey adapter

## Faceplate contract

- `window.L99Island` — `open({seed})`, `close()`, `active()`, `link()`
- Registers realm `island` with `L99TouchMusic175` and `L99Journey170`
- `L99Keyboard149.world()` reports `island` while it is open
- Reads `L99Continuity.bands` for music reactivity
