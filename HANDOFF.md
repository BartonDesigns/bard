# Level 99 Bard: handoff notes

How the project fits together, how to work on it and ship it safely, what has been built so
far, and where it is heading. Read this before changing anything; the island engine's own
file-by-file map is in `island/README.md`.

## Start here (handoff, 1 October 2026)

This round paused at the end of a weekly budget, about four days before it resets. **The live
site may have moved on since these notes were written** (another agent, or the owner, may have
shipped work). Before doing anything:

1. `git fetch origin` and compare `main` with the working branch `claude/affectionate-heisenberg-3g4qv1`
   (`git log --oneline origin/main -15`, `git log --oneline origin/main..origin/claude/affectionate-heisenberg-3g4qv1`).
   Work from whichever is newest; never overwrite newer live work with older branch files.
2. Read this file's "Known issues" and "Open threads" below, then `island/README.md`.
3. Ship only through the checks in "Branches and shipping": build, lint, smoke test, fast-forward.

### Open threads

- **Persistent NPC work (4 October 2026):** Branch `codex/persistent-npc-social` adds
  separate saved identities and actor streaming, conversation history, a People journal,
  validated follow/wait/home/scout/quest-companion commands and bounded local warnings.
  Existing world discovery and quest saves remain intact. Development checkpoints and
  exact validation status live in `docs/npc-social-progress.md`; the broader social design
  and deferred dungeon/inventory/music integrations are in `docs/npc-social-plan.md`.
  Do not equate logical warning spread with physical messenger delivery, or a travelling
  quest companion with implemented dungeon combat. Saves currently belong to this browser.


- **Museum photo pass (3 October 2026):** The five supplied Fort Baker photographs now
  guide the existing museum: warm cream clapboard with consistent board spacing, red
  roofs, brown shutters, green enamel lamps, broad porch rails, light porch canopies,
  stroller frames/wheels/hoods and signal flags. The original mapped footprints, indoor
  exhibits, cafe, Lookout Cove and Faith remain. Ground-following entrance stairs use
  the player floor model, and porch openings remain clear. A deterministic coastal
  cypress grove adds spreading limbs, roots and shaded earth in three material batches,
  avoiding mapped buildings and roads. Museum geometry and grove materials release on
  streaming unload; terminal disposal also releases its persistent materials/textures.
  Validation and screenshots: `docs/discovery-museum-validation.md`.


- **HUD follow-up (3 October 2026):** Location banners now have one owner. Late bridge
  initialization updates the existing banner instead of creating an abandoned duplicate;
  world teardown removes it. Names fade ten real seconds after area entry, including
  when render updates pause, and old text/timers clear on a new area or travel/hide/orbit.
  The flight button and B cycle 1× → 3× → 6× → 9× → 1×, showing the current multiplier.
  The same multiplier applies on the surface and in orbit; legacy boolean boost callers
  still map to 1×/3×. Regression sources: `flight-hud.test.mjs`, `flight-hud-browser.cjs`
  and the updated three-trip orbital test (now tests 3×, 6× and 9×).
  The follow-up museum photos have now been received and used; see the museum pass below.


- **Completion pass (3 October 2026, same draft branch):** All ten authored kinetic rig
  types now run natively, with distinct pooled visuals and real faceplate event notes.
  Sky & World offers the ten choices, scale/root, live garden physics and droplet density,
  replay drop/cascade tempo, and explicit track-tempo sync. One rig remains the bounded
  native policy; save/multi-rig/progression parity is separate from completing these types.
  `world/solar.js` drives actual sun and celestial orientation from globe latitude and
  selected month, sharing seasonal geometry with regional climate. Polar clocks advance
  throughout midnight sun/night. The Bay clock convention remains unchanged.
  Offline atlas refresh corrected 37/72 packed tiles and the orbit map; all 32,400,000
  survey-derived elevation/land/lake/amplitude bytes are unchanged. Svalbard now uses
  tundra colours, -4 C annual mean and zero tree cover. The Manaus GPU diagnosis found
  an 18 km city tint masking forest; broad urban colour now respects forest/snow while
  actual buildings/roads and city lights remain. GPU pixel tests confirm all three cases.
  Active orbit now blocks globe rebasing, preserving departure coordinates on lateral
  atmospheric travel. 94 Node regressions pass; build, lint and GPU ground checks pass.
  All ten rigs pass actual placement/voice/render checks; 20 replacement cycles return
  exactly to 258 geometries/72 textures. Polar sky, unchanged orbit frame, held-note
  boulder motion and three exact-return flights pass without shader/context errors.
  Explicit month/region changes now invalidate the short climate cache immediately;
  four first-update browser cases confirm matching sky/weather in both hemispheres.
  See `docs/crysis-completion-validation.md` for measured evidence. Native iPhone/Safari speed
  and real-device listening cannot be certified by the software-rendered browser here.
  The older regional/kinetic bullets below describe the previous checkpoint; their
  eight-rig, stale-ground and fixed-solar-latitude gaps are resolved by this pass.


- **Regional expansion and kinetic instruments (3 October 2026, same draft branch):**
  Community-aware occupations/dialogue now distinguish cities from rural kits and keep
  Arctic traditions tied to their authored cultures. Steppe herders have boots and long
  trousers. Polar daylight uses latitude/month geometry; warm rain, winter pollen and
  cold-night fireflies are gated; aurora brightness is increased within the existing budget.
  Regional audio owns and releases its nodes, schedules calls/bells on the audio clock,
  and pauses on hide/orbit. Sky & World now places one native bounce garden or pendulum
  wave on nearby clear, flat ground. Collisions play the current faceplate with bounded
  voices; Stop/Replay/Clear and garden gravity/bounce controls are exposed. These are two
  of ten legacy rigs, with no persistence or general rigid-body/player-platform claim.
  Regional profiles and kinetic behavior have 34 new Node regressions (66 total pass).
  Existing real-faceplate music integration and three exact-return orbital trips pass. Review the draft
  branch visually before live; native device performance and listening remain open.
  Headless visual smoke rendered Svalbard tundra/aurora, Manaus canopy and Mongolian
  steppe without page/shader errors. Ground shading still appears too pale in the first
  two daytime views. Svalbard's baked g0-6 tile still stores -14 C/sea colours despite
  the current atlas's -4 C mean/tundra colours: refresh atlas-derived climate/ground
  planes while preserving elevation/land. Manaus's baked data matches the atlas;
  diagnose its GPU sampling before changing snow logic. `sky.js` still uses the Bay Area solar latitude; regional polar
  daylight currently governs climate/talk, not a globally accurate rendered sun path.

- **Native music/identity follow-up (3 October 2026, same draft branch):** Shared music sampling
  now includes synth, enabled mic and DJ sources with frequency-aligned FFT merging; held synth
  voices and dominant BPM feed `music/performance.js`. Nearby island boulders lift, fall and bounce
  through actual instance matrices and vertical collision filtering. Flying fauna reacts under
  the old opt-in music-mode setting. Full plant, wild-country, remaining kinetic-rig and social parity remain
  open. `space/body.js` separates original body identity from unchanged integer terrain seeds and
  carries it through homes/share/resume; orbit page-hide cannot overwrite the departure save.
  Eight body/performance tests, three bridge tests and real faceplate voice/rock/home integration
  pass. See the updated inventory and `island/ORBITAL-FLIGHT.md` for scope and device-test limits.


- **Continuous Crysis orbit (3 October 2026, feature branch):** Native flight now crosses
  the old ceiling using the existing player and renderer. `island/src/space/` blends a
  camera-relative orbital pass over the retained ground, preserves the departure
  position/frame, and rebases a returning flight before the ground reappears. The rocket
  starts an interruptible climb; WASD/touch and Space/C remain live throughout. The
  instrument analyser continues in orbit; bass/pulses affect bounded commanded thrust,
  and bass/mids/highs affect atmosphere/haze/stars. Ground ambience fades independently
  of music. The original galaxy route remains in Sky & World → Explore galaxy; its
  existing handoff still loads. This is not complete migration of flight's four months
  of features. Read `island/ORBITAL-FLIGHT.md` and `docs/flight-migration-inventory.md`
  before replacing or removing any legacy feature. The latter also lists features that
  the pre-existing default Crysis landing route already bypasses. Five coordinate/speed
  regressions and the three-round-trip Chromium controller check pass. Earth ascent
  to 180 km and return preserve the same world/context with 0 m departure error and no
  loading overlay; held controls, touch cancellation and live analyser response pass.
  Five orbital planet profiles compile with one mesh/texture and no shader errors.
  Existing 16 resource/Bay/black-hole regressions pass. Native iPhone/Safari and sustained
  real-time performance remain unverified. Do not call the entire flight migration done.


- **Planet stability (3 October 2026):** Repeated TROPICAL/ICE round trips reproduced
  texture growth from 66 to 426 allocated textures over five round trips. World teardown
  now captures resources before subsystem removal, including shader-injected maps,
  instance buffers, skeleton maps, custom shadow materials and light targets. Hidden
  cottage material palettes have their own cleanup. Pending shader warm-up work is
  canceled on world replacement; render lists are cleared. Bay height-map requests are
  aborted on departure, decoded bitmaps/canvases released promptly, and late results cannot
  restart the old terrain. Context loss pauses world updates until restoration.
  Phones start at 1.25 pixel ratio, capped at 1.5; canvas/effect multisampling is disabled,
  sun shadows use 1024 instead of 2048, and road targets use half-size dimensions without
  multisample attachments. Desktop budgets remain as before. The full native device crash
  is not reproduced here; these fixes address measured leaks and reduce phone GPU pressure.
  Replaced photographic fallback maps are retained for cleanup; late material upgrades are
  canceled after disposal. Final phone-profile TROPICAL/ICE round trip: 64 textures before,
  63 after (no growing texture count). Forced context loss/restoration succeeds. A preceding
  150-second stationary soak held geometry/texture/heap counts steady. Faceplate, island,
  Bay, globe and volcanic-planet smoke checks pass with no unexpected page/shader errors;
  9 active samplers maximum in the safe-mode world run. Five resource regressions, eight
  Bay regressions and three black-hole regressions pass (16 total).
  Regressions: `node island/tools/world-resources.test.mjs` plus the Bay and black-hole tests.


- **Central black hole and Bay lifecycle (3 October 2026):** The galactic-center hole now
  uses the supplied GARGANTUA reference's Schwarzschild integration, turbulent disk,
  Doppler shading and photon ring. Editable source: `runtime/gargantua228.mjs`; rebuild
  the packed flight engine and its cache URLs with `node tools/build-gargantua.mjs`.
  Central location, radius, flight controls and horizon entry remain in the existing engine.
  The old approximate central lens is disabled to avoid warping the new disk twice;
  small anomalies retain their renderer. The reference's procedural sky blends into
  Bard's backdrop locally; its standalone UI, analytics and SDK are not included.
  Phones use 200 integration steps, desktop 320, with no added textures/render targets.
- **Bay streaming lifecycle:** `realcity.js` cancels tile requests after travel, vertical
  departure and world teardown. Late callbacks cannot insert an old tile or clear a newer
  request. Teardown releases road render targets, combined maps, generated-town textures
  and drawing resources, and resets shared shader bindings. `main.js` calls this cleanup
  when replacing the world. These are specific resource-leak fixes, not a claim that every
  device graphics-loss cause is resolved.
- **Verification (3 October):** island rebuild; unused-variable lint on changed modules;
  three black-hole regressions and seven Bay lifecycle regressions pass. Chromium/SwiftShader
  renders the reference's elevated and edge-on views using flight's bundled Three r160.
  Actual faceplate/flight/island/Bay/globe/volcanic-planet smoke checks pass with no page or
  shader errors; flight reports 39 healthy programs. World shaders use at most 9 active
  samplers in this safe-mode smoke run, below the 16-per-stage budget. Native iPhone
  performance and prolonged Bay streaming still need device testing.
  Run regression checks after `npm --prefix island ci` with
  `node tools/gargantua.test.mjs` and `node island/tools/realcity-lifecycle.test.mjs`.

- **Apple devices and the Bay ground shader (2 October 2026):** Apple's shader compiler (every
  browser on iPhone, iPad and Mac) loses the graphics building the full Bay ground shader
  (`bay/terrain.js`, ~180 KB, its height pipeline inlined many times). Apple devices now take a
  light version from the start (`world/gpulite.js`, `GROUND_LITE` in the shader): plainer ground,
  no painted street detail. Next: restructure the full shader so Apple can build it (fewer
  inlined `gradedHeight`/`bayHeight` calls in the vertex stage, the colour block split), then
  drop the Apple default. Switches on the site's address: `?debug` (on-screen console with Copy),
  `?lite` / `?full`, `?safe` (no AA, shadows or high resolution), `?offline` (no discovery server).

- **Regional kit** (`island/src/region/`, `earth/data/polar.js`, regional hooks in `earth/globe.js`,
  `globetowns.js`, `globetrees.js`, `people/persona.js`, `body.js`, `people.js`, `music/`): a
  regional style layer keyed by atlas region and climate (far north and polar sea, jungle, desert,
  bazaars, East Asia, valleys and story landmarks, and the other climates the globe crosses), with
  regional people, clothes and talk. Built in stages; what each region type has and what is left is
  in its section under "How the main systems work". Next: finish and verify the region types, one
  screenshot and one conversation each, then widen.
- **Townsfolk's cloud voice:** the discovery server is deployed at
  `https://l99-discovery.joshbarton1921.workers.dev` and `island/src/earth/config.js` points at it.
  Check `/status` in a browser. Both models' Neuron prices in `server/discovery/wrangler.toml`
  were checked against the Workers AI pricing page (1 October 2026) and match. Next layer
  (agents with memory, shared happenings) is in `server/README.md`.
- **Street-level Bay:** done and live (eight new areas, tiles streamed by distance). Gaps: Castro
  Valley, Moraga, Richmond and El Cerrito, Novato, south of Mountain View. The place-name banner (`bay/labels.js`) now runs on the real
  clock, so it no longer lags behind and names a town already passed at low frame rates.
- **Hair refinement** (asked for "next week"): see Known issues.
- **Graphics lost on a device** (reported 1 October 2026, Safari): the game now recovers or says to
  reload, but the cause is likely memory (Bay tiles plus regional towns). Next: a lower memory budget
  on phones (fewer `uRealBs` slots, smaller tile radius).
- **Discovery server:** `GET /brief/:id` now answers 204 for an undiscovered place (was 404). The
  game accepts both; the owner needs to redeploy (`cd server/discovery && npm run deploy`) for it to
  take effect.
- **Hiker lighting** against the hillside: checked (1 October 2026, Diablo at 15:30). Lit by the same
  sun as the slope, with shadows on the ground, nothing to fix.
- **Regional talk** re-checked in 8 places (Svalbard, Marrakesh, Istanbul, Kyoto, Manaus, Ulaanbaatar,
  Zermatt, Iqaluit). Fixed: harbour and ferry talk inland (a coast flag in `region/here.js`), Amazon
  and Moroccan food. Still to look at: herders' clothes (skate shoes, chains), and big cities
  described as villages (Kyoto, Marrakesh).

## What it is

**Level 99 Bard** (level99bard.com) is a playable instrument. The faceplate (`index.html`)
is a synthesizer and sequencer with swappable "faceplates" (BARD, SYNTHWAVE, DNB, HYPHY,
DANCEHALL, MAESTRO, BREW...), each with its own sounds, scale, key and tempo. From the
faceplate you can open worlds that play along with the music:

- **Caves**: a generative cave world with its own calm generative score (`runtime/caves-179.html.gz`).
- **Flight**: space flight between procedural planets.
- **Crysis** (the island engine, `island/`): a tropical island set in the real San Francisco
  Bay Area at true scale, a globe you can fly east across to China, and wild planets.
  Real streets, buildings, trails and terrain; MakeHuman people with history, conversation,
  hair, skin and tattoos; weather, seasons, the real night sky; music that follows where you
  are and what you do.

## Repository map

| Path | What |
|---|---|
| `index.html` | The faceplate and the site (one large file; edited in place, no build step) |
| `island/` | The Crysis engine: ES modules in `island/src`, bundled to `island/dist/island.js` |
| `island/assets/` | Baked data and art (terrain, real-city data, people, hair, textures) |
| `island/tools/` | Bake scripts and checkers (`bake-people-hair.mjs`, `interior-check.mjs`, ...) |
| `runtime/` | Packed builds the faceplate loads on demand (caves, flight, characters) |
| `server/` | Cloudflare Worker (free tier) for the location saver / discovery |
| `trailer/` | Trailer tooling (parked) |
| `textures/`, `assets/` | Site-level art |

## Working on it

### Build and lint

```
cd island
npm install
npm run build        # writes dist/island.js; commit it (GitHub Pages serves it)
npx eslint <files>   # the project's lint rules
```

Open `island/dev.html` from a local server (`python3 -m http.server`) to run the engine on its
own, or `index.html` for the full site.

### Code style

- Tabs for indentation in the engine; no unused variables; no underscore-prefixed names.
- Comments are short, plain sentences in the codebase's voice (what the thing is, why).
- Keep state setters and handlers that drive UI even when a linter calls them unused.
- No model names or identifiers in code, comments or commits.

### Rules that must hold

- Never write anyone's home address into the repo. Never print, log or commit API keys.
- No paid APIs. The location saver runs on Cloudflare's free tier; conversation falls back to
  offline, in-character replies when no free model is available.
- Regions never choose the player's faceplate automatically.
- Content: real places start neutral and only decay through gameplay; no real-world harm
  recipes; no sexual violence and nothing involving minors; encampments are portrayed with
  dignity; no real brand logos; no stereotypes or caricature.
- Hair, people and other look-and-feel changes are shown to the owner before they go live.

### Branches and shipping

- Work happens on a feature branch. **`main` is the live site** (GitHub Pages, level99bard.com).
- To ship, build a clean tree from `origin/main` plus exactly the changes you are shipping
  (a second worktree works well), rebuild `island/dist/island.js` there, run the smoke test,
  check it fast-forwards (`git merge-base --is-ancestor origin/main HEAD`), then
  `git push origin HEAD:main`.
- Work in progress from helpers can be snapshotted to the feature branch (marked "In progress"),
  never to `main`.

### Testing headless

- Playwright with Chromium on SwiftShader (software GL). It runs at about one frame a second:
  a Bay Area test takes 10–25 minutes. Game time is clamped per frame, so it runs slower than
  real time.
- One browser at a time: wrap runs in `flock /tmp/<lock> ...` when several are queued.
- Screenshots need a long timeout (`page.screenshot({ timeout: 300000 })`).
- The smoke test loads the faceplate, the island, the Bay, the globe and the planets and fails
  on any page error or shader error, and checks texture units (≤16 per stage, ≤32 combined).
- `window.Crysis` is the engine's debug handle: `Crysis.audio()`, `Crysis.drive`,
  `Crysis.people()`, `Crysis.interiors()`, `Crysis.month(m)`, `Crysis.tattoo(...)` and more
  (see the end of `island/src/main.js`).

## How the main systems work

- **World and ground** (`island/src/bay/terrain.js`, `geo.js`, `realcity.js`, `berms.js`): baked
  survey heights in levels; a camera-centred ground grid displaced on the GPU. The game walks
  on the same heights (`island.heightAt`), and people stand on the ground as drawn
  (`island.drawnAt`), so nobody sinks into a hillside the mesh is too coarse to show. Roads are
  graded with berms; trails are cut level into the slope.
- **The mapped cities** (`island/src/bay/realcity.js`, `realtiles.js`, `tools/bake-realcity.py`): real
  streets and footprints from Overture Maps. The big cities are baked as cells of one tile grid
  (`assets/bayarea/real/t/<i>_<j>`, about 2.6 by 2.8 km); only the regions within about 3 km are
  fetched and they are dropped past 4.5 km, so start-up and memory do not grow with the map. The
  ground shader holds the loaded regions nearest you in 16 box slots (tiles side by side merged)
  and one coarse map drawn from all of them. Where the mapped regions meet the procedural world the
  generated blocks, grid and freeways stop 60 m inside the edge, and the mapped data stops there too.
- **Seasons and calendar** (`island/src/calendar.js`): today's month, or one picked in the Sky &
  World panel; hills, bloom, leaves, snow, birds, fish, clothes and holidays follow it.
- **Sky** (`island/src/world/sky.js`, `constellations.js`): sun, moon and planets where they
  really are, a real star catalogue, constellation figures snapped to it; stargazing is a
  night-only game on the real sky.
- **People** (`island/src/people/`): MakeHuman bodies, a spring-driven motion rig, wardrobes by
  place and month, skin with vitiligo for about 1 in 100, tattoos with their own stories,
  personas for conversation, MakeHuman CC0 hair and beards fitted to each face, and greying with
  age. Walkers give way to you, keep out of walls (`island.extraPush`) and turn back when stuck.
- **Music** (`island/src/music/`): auto music composes on the faceplate's own instruments, key
  and tempo. Since this round it follows the caves' approach: chords held for bars, arpeggios
  carrying them, a melody that rests whole phrases, a bass on the chord, and a soft kit (kick,
  rim, hats) only in some sections. Your footsteps keep its time.
- **Sound** (`island/src/audio/`, `bay/naturesound.js`, `world/soundbus.js`): footsteps by
  surface, rooms and reverb, city and nature beds, night animals (owls, crickets, frogs,
  coyotes, the odd wolf when you are long alone in the wild). Everything the world plays goes
  through one gate, the World sounds slider.
- **Getting around** (`island/src/drive.js`, `player.js`): walking, jumping, swimming, flying;
  drive mode drives a real car or walks a trail hands-free (the letter keys then play music;
  arrows pick turns, hold to turn round, Shift+arrow steps off, Space jumps off, Esc stops).
  Rocks are solid and climbable, brush slows you, pebbles never trip you.
- **Buildings** (`island/src/interiors/`, `bay/houses.js`, `houseplan.js`, `commercial.js`):
  footprints from real map data raised into houses, shops, offices and landmarks, with generated
  floor plans, furniture and doors. Plans are rectangles cut with straight walls and one proper
  hall; `node island/tools/interior-check.mjs` checks thousands of plans for crossing walls,
  slivers, narrow passages, small rooms and blocked doors (`HOUSEPLAN=` / `CITYPLAN=` compare an
  older planner). Public doors open for walkers too: `interiors.walkers(list)`,
  `interiors.doorsNear(x, z, r)`, `interiors.addDoors(...)`; townsfolk now and then step into
  shops, the summit museum and restrooms. The Mt Diablo Summit Building is a real interior
  (lobby, museum, gift shop, upper gallery, stair to the deck).
- **Fishing** (`island/src/fishing.js`, `bay/lake.js`): near water a rod icon (or H) takes the
  rod out and casts; R strikes and reels. A varnished cane rod with silk wraps, rings and a
  reel; a sagging line to a red-and-white float. Lake Annabel's water sits just below its path
  with a low concrete edge (its bed carved on water.js's fine grid).

- **Regional kit** (`island/src/region/`): `kits.js` holds 22 profiles (polar, station, snow, alpine,
  himalaya, andes, village, farm, outback, mediterranean, desert, pueblo, bazaar, steppe, savanna,
  sahel, jungle, island, eastvillage, eastcity, southcity, southasia). `choose.js` picks one from
  the atlas region, its coldest and warmest months, rain, height and town size, blending near
  borders; anything unmatched is "village". `structures.js`/`layout.js`/`settle.js` build
  vertex-coloured buildings in 120 m cells (no textures); `landmarks.js` has 52 real landmarks
  and 30 generated kinds with legends; `ice.js` the sea ice and aurora; `folk.js`, `dress.js`,
  `talk.js` the people, clothes and talk (persona `region`, `lang`, `facts` feed the cloud voice).
  Left to do: re-check talk in the eight regions shot before the folk fix, reframe the jungle and
  steppe views, look at Svalbard after the tundra fix, a brighter aurora, jobs matched to a
  person's community, and the call to prayer and night sounds checked with audio.

## History

- **Late August to mid September 2026:** the faceplate's builds (up to Bard Build 226), caves and
  space flight.
- **24 September:** Stage 1 of the island engine: a tropical island joined to the faceplate.
- **25–27 September:** grass, ground and water realism; the civilization engine; walk-in shops,
  restaurants, offices and venues; Highway 1 beaches; the Discovery Museum with children;
  alien architecture on other planets.
- **28–29 September:** the Earth atlas (hundreds of regions and cities) and a city director;
  dinosaurs on wild planets; third person, ragdolls, carjacking, real car driving.
- **30 September:** the globe east to China; weathering and decay; cars; skin rework and vitiligo;
  the month picker and seasons; tattoo parlors and inked townsfolk; the real night sky and
  stargazing; drums 30% quieter with a drum volume slider.
- **1 October:** MakeHuman hair and beards (round 3). Then this round: calmer world music, music
  keys while walking a trail, trails in the ground, rocks and brush, footsteps in time, night
  animals, World sounds, a whole deer, the sea drawn only where it is in reach, interiors
  without awkward hallways and the remaining fake buildings made real, Lake Annabel at ground
  level and fishing by choice with a wooden rod.
- **1 October, later:** more street-level Bay. San Francisco (all of it, with Treasure Island and the
  Headlands' south side), Oakland, Berkeley, Emeryville, Alameda and Albany; Orinda, Lafayette, Walnut
  Creek, Pleasant Hill and Concord; the Peninsula from Daly City to Mountain View; San Leandro,
  Hayward, Union City and Fremont; San Rafael and the 101 towns of Marin, all baked from Overture in
  265 tiles (about 60 MB) and fetched by distance. The ground's nine region slots became 16 slots of
  the loaded regions nearest you; the far skylines use the real towers.

- **1 October (later):** interiors 2.0 (every landmark solid; the public ones walked into);
  street-level Bay across SF, Oakland and Berkeley, Walnut Creek and Concord, the Peninsula,
  Fremont and Hayward, Marin; the Cloudflare discovery server deployed with the townsfolk's free
  cloud voice; the regional kit begun.

## Known issues and next refinements

- **Hair (next week):** grey shows as streaks rather than salt-and-pepper; dark slabs under long
  straight hair; stray strands at the ear on the bobs, the tousled cut and the fade; white beards
  see-through on pale skin; brows heavy on some women.
- **Hikers:** their lighting against the hillside has not been looked at yet (no hikers were in the
  test frames).
- **Landmarks (interiors 2.0):** every landmark is solid; the public ones are walked into
  (`island/src/interiors/landmarks.js`, `bay/landmarks.js`, `bay/footprints.js` keeps the generated
  city out of them). Not yet seen in a test frame: Hoover Tower, Lick, the windmills, the arenas'
  bowls, Tribune Tower, Oakland and San Ramon City Halls, the barns. The Oakland Temple's roof can
  be stepped onto from uphill. The wharf's shops keep their own small rooms (only six interiors
  are built near you at once).
- **House plans:** 259 of 4050 test plans still flag small things (1 m² corners at hall
  junctions, a few 2.0–2.2 m living rooms or kitchens, doors against a stairwell).
- **Fishing:** the float's final size was not seen in a test frame.
- **Trails:** a faint saw-tooth where the ground mesh meets the trail's cut.
- **Sky:** the sky is computed for the Bay's latitude even on the globe.

- **Mapped cities:** the terrain under Oakland's and Berkeley's hills and the Peninsula is the 60 m
  survey (only San Francisco has 15 m), so hillside houses there sit on coarse ground; the tiles
  have no creeks of their own beyond the Bay-wide water bake. Gaps between the baked areas: Castro
  Valley, Moraga and Canyon, Richmond and El Cerrito, Novato, south of Mountain View. Golden Gate
  Park's woods under the mapped land use have not been looked at in a test frame yet. Real
  places start neutral (only the grown towns weather). In the headless tests a tile takes tens of
  seconds to arrive (a frame there is seconds long); on a device it is about 50–100 ms of parsing.

## Parked

- The trailer (1080p60, a 4K60 script).
- The leaderboard and world morality status page, until quest and game mechanics exist.

## Future direction

- **Play:** quests and game mechanics that give the parked morality page something to measure.
- **People:** hair refinement; more clothing variety by region; conversation that remembers you.
- **Music:** each world's score as intelligent as the caves', faceplate by faceplate; the world
  answering what you play (footsteps, animals, weather in time).
- **World:** more real regions at street level beyond the Bay; interiors for every landmark;
  doors and errands for townsfolk; wildlife by region and season.
- **Performance:** keep the ground and water drawn only where they can be seen; phone budgets
  for every new system.
