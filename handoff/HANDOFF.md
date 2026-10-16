# Handoff: unfinished work, 16 October 2026

Everything through PR #48 is on main and live at level99bard.com, and water and shoreline (section 2) and land seams (section 3) have since shipped. The workstreams below were stopped part way (owner's call: they were costing too much). Each one's unfinished work is saved as a patch in this folder. Apart from those two, none of it is on main, built or tested.

## Picking one up in a new conversation

Work on **one at a time**, in the main checkout. No background agents, and no long capture loops: the container renders in software at under one frame per second, so a single screenshot can take minutes.

```
git fetch origin main && git checkout -B <your-branch> origin/main
git apply --3way handoff/wip-<name>.patch     # resolve any conflicts; main has moved past the patch's base
cd island && npm run build
node --test island/tools/*.test.mjs            # known failures: RGB manifest, nearby tiles teardown (flaky),
                                               # Svalbard flora, regional vegetation refresh
npx eslint@8 --no-eslintrc --env es2022,browser --parser-options=sourceType:module,ecmaVersion:latest \
  --rule '{"no-unused-vars":"error","no-undef":"error"}' <changed files>
```

Before going live, load the three worlds once (MAGMA seed 4242, TERRAN seed 77, Earth) in headless Chromium and check the console for errors. The old smoke script lived in the session's scratchpad and is gone; `island/tools/planet-floor-browser.cjs` and `island/tools/mobile-controls-browser.cjs` show how to load `island/dev.html` and press "Enter world".

House rules:
- tabs, plain-prose comments in the surrounding style;
- no em dashes in code comments or docs;
- keep `main.js` edits small;
- keep the no-page-zoom block (`index.html` NO_PAGE_ZOOM, `main.js` `no-page-zoom`);
- resolve `index.html` / `island/dist/island.js` merge conflicts by taking main's and rebuilding.

## 1. Night lighting, part 2: `wip-night2.patch`

23 files: bridge.js, carlights.js (new), floodlights.js (new), streetlamps.js (new), landmarks.js, nightlights.js, city.js, houses.js, towers.js, streets.js, streetlife.js, civic/colony-art.js, interiors/index.js, interiors/lighting.js, sky.js, nightfield.js, services/index.js, signage/index.js, main.js and others. Docs and tests may be incomplete.

Brief:
- **Day interiors:** the fire bay is near-white by day. The in-page bake is about 2.7x the node bake of the same plan, and day exposure is lifted 1.55. Fix the cause, then add floor pools and window light.
- **Landmarks and civic art (#47) at night:** uplights and spots.
- **Bridges and freeways:** deck and tower lights, road pools, aviation lights.
- **Skyline:** beacons, crowns, lobby glow, city glow on cloud.
- **Street lamps by era:** sodium on older streets, LED on newer.
- **Cars:** headlight pools, tail and brake lights.
- **Sky:** moon phase and shadows, stars washed out near cities.
- **Bugs:** `bay/nightlights.js` needs a `dispose`, wired into `streets.js`. Two `bay-landmarks` meshes (#3a3c40, #55646a) have NaN normals.

Owner's standard: dark overall, light only where real lights are, no glowing walls (see docs/night-lighting-2026-10-15.md).

## 2. Water and shoreline: `wip-water.patch`

**Shipped** (branch `claude/water-shoreline`): the patch was finished, built, tested and merged to main. See `docs/water-shoreline-2026-10-16.md`. The notes below are kept for the record.

11 files: world/ocean.js, world/shore.js, world/spray.js, world/terrain.js, world/grass.js, bay/water.js, planet/waters.js, main.js, tools/shore.test.mjs, docs/water-shoreline-2026-10-16.md, HANDOFF.md.

The agent had four commits and was updating its doc when it was stopped.

Owner's words: "There is a hard edge of water on the shore waves. We see the same beautiful saturate-and-dry with the waves, but the ocean waves' edge is a hard line and doesn't follow a realistic natural beach splash. Go way beyond this, and look at connecting areas that are off."

Brief:
- **Shore edge:** soft, depth-based alpha at the shoreline.
- **Swash:** a thin sheet running up the beach with a broken foamy edge, synced to the existing wet-sand drying.
- **Surf:** foam lace, backwash bubbles, breakers on sloping beaches.
- **Shallows:** turquoise water with caustics.
- **Every water junction:** rocks, piers, river mouths, lakes, waterfalls, wading, rain, horizon and LOD seams, the Bay/globe sea seam, underwater looking up, lava shores.
- **Night:** reflections of the night lights.

Check the island beach at eye level along the waterline first; that's the owner's view.

## 3. Land seams and nature QA: `wip-landseams.patch`

**Shipped** (branch `claude/land-seams`), with the far hills' facets reduced as well. See `docs/nature-qa-2026-10-16.md`. The notes below are kept for the record.

18 files: a new world/groundsnap.js, plus vegetation.js, grass.js, terrain.js, lodfade.js, sunrays.js, bay/berms.js, bay/terrain.js, bay/city.js, bay/streettrees.js, earth/globeterrain.js, earth/globetrees.js, nature/rocks.js, nature/wildground.js, region/flora.js, tools/nature-qa.test.mjs, docs/nature-qa-2026-10-16.md, HANDOFF.md.

The agent had two commits and was updating a test when it was stopped.

Brief: audit, then fix at the source:
- trees, rocks and props floating or sunk on slopes (a ground-snapping pass using the exact rendered height, berms included);
- hard ground-texture lines, to be blended by slope, height and noise;
- LOD and tile seams, and pop-in;
- roads meeting terrain;
- cliff bases;
- biome and snow-line transitions;
- the Bay's surveyed terrain against the globe's terrain;
- wind not swaying in sync;
- mid-range shadows.

Also: harden any vertex displacement that could give NaN or huge values. The owner saw pale stretched triangle spikes on iPhone; suspects are a GPU-lifted grid or the sunbeam sheets (`world/sunrays.js`).

Note: patches 2 and 3 both touch `world/terrain.js` and `world/grass.js`. Apply one, ship it, then apply the other.

## Smaller open items

- Two-handed bat and pipe: the off hand hangs open.
- A faint seam above fresh wall holes.
- Masonry holes can leave unsupported bricks.
- Layered walls aren't in `commercial.js` shops or tower lobbies yet.
- Floods and storm surge aren't built.
- Voice clips: huggingface.co is blocked by the environment's network policy.

## Ask the owner to check on the iPhone

- Frame rate with a rifle and with fists.
- Whether gyro aiming turns the right way.
- Whether the controls stay clear of the quest as Safari's bar shows and hides.
- If the floor ever drops: run `Crysis.frameErrors()` from Safari's Web Inspector.
- If the pale spikes come back: a screenshot after `Crysis.rays('off')`.
