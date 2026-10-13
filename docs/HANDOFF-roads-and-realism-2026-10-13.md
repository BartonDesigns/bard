# Handoff: roads, trees and street realism (13 October 2026)

Paste this whole file into the new conversation. It is self-contained; the longer background is in `ClaudeConversationHandoff.md` (sections 2, 5 and 6 are the rules, shipping and gotchas) and `HANDOFF.md` in the repo.

## 1. Where things are

- **Repo:** GitHub `BartonDesigns/bard`. Work branch from the last session: `claude/affectionate-heisenberg-3g4qv1`. Start a new branch from `main` for this work.
- **Live:** `main` deploys through GitHub Pages. `main` includes everything below, up to the commit that added this file.
- **Engine:** `island/src` (Three.js), built with `cd island && npm run build` (writes `island/dist/island.js` and stamps `?v=` into `index.html`). The faceplate synth is the single huge `index.html` (5.7 MB; edit with exact, unique anchors).
- **Tests:** `node --test island/tools/*.test.mjs`. Four were already failing before this work and still fail: the RGB asset manifest, nearby tiles teardown (flaky), Svalbard flora, regional vegetation refresh. Anything else failing is new.

## 2. Owner rules (must keep)

- Tabs; no unused variables; no underscore-prefixed names; short plain comments in the codebase's voice. **Never use em dashes** anywhere (code, comments, docs, copy).
- No model identifiers in code, commits or docs. No home address in the repo. No secrets ever printed or committed. Free tier only. No real brands or logos.
- Never commit `node_modules`, `.wrangler`, `dist-*before*`, `.claude/` or scratch files. Commit with `git add <files>`, never `-A`.
- **Look changes are shown to the owner (Josh) before shipping:** send before/after images, wait for approval. Roads, trees and overpasses are look changes.
- Deploying to `main` is allowed once the smoke test passes.
- At most 3 to 4 agents at once; lean token use. Prefer numbers over screenshots; send review images to Josh rather than studying them yourself.
- M-rated combat; minors are never harmed.
- Commit trailer: the one given in that session's system reminder.

## 3. How to ship

1. Build, run node tests.
2. Smoke: a Playwright Chromium + SwiftShader script that serves the repo root, opens `island/dev.html?planet=MAGMA&seed=4242`, `?planet=TERRAN&seed=77` and Earth (no query), **clicks "Enter world" on the loading card** (the world never updates until it is clicked), waits, and fails on any page or shader error. Playwright: `require('/opt/node22/lib/node_modules/playwright')`, args `--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Use a fresh port each run (old servers linger). Runs take about 10 minutes; run them in the background.
3. `git fetch -q --depth=50 origin main && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main && git push origin HEAD`.

Headless gotchas: SwiftShader runs at about 1 fps (dt is capped at 0.05), so force state and check it rather than timing. Headless Earth starts on the island at night with few people; set `Crysis.world().sky.state.hours = 12.5`. `Crysis.scene()` gives the scene. The coplanar census tool is `island/tools/zfight-browser.cjs` (env FAR, EVAL, EVAL2, GOTO, PHONE, ZF_OUT, SETTLE).

## 4. Shipped today (context, nothing to do)

- **Chatter:** passers-by remark in their own Kokoro voice, positioned in 3D (`people/chatter.js`, `chatter-lines.js`, `guide/local-speech.js`).
- **Gameplay loops:** favours (lost item, catch a friend, pass something on, repair a car, the lost dog), bag snatches, taxi fares (rush fares), Use (U) for medkits and repair rolls, three daily goals, ranks, the guide's Story tab, Moon rovers. Notes: `docs/gameplay-loops-2026-10-13.md`.
- **City surfaces:** overlapping buildings trimmed, slabs inset (downtown SF coplanar area 1,686 to 183 m²).
- **House eras and interiors** (approved today): `bay/decor.js`, era looks for Victorian, prewar, ranch, split-level, tract, modern; wallpaper and paint by era; offices. Commercial buildings cost one more draw call each.
- **Props and the lost dog** (approved today): `people/propkit.js`, `bags.js`, `favour-props.js`, `dog.js`, `dog-voice.js` (whimper to happy, reunion). `Crysis.errands.pet()` starts a lost-dog favour.
- **Music fidelity:** the music runs on the audio clock (`L99Clock` in `index.html`) and world sounds and voices go through the peak guard (`world/soundbus.js`). Notes: `docs/music-fidelity-2026-10-13.md`. Any new world sound must play through `soundBus()` or `worldOut()` from `world/soundbus.js`, never `window._masterClip` or `ctx.destination`.

## 5. The task for this conversation

Josh's words, condensed: remove trees obstructing roads and place trees strategically; make all intersections smooth (no extreme dips or bumps); build inner-city overpasses for pedestrians and vehicles; fix pools and parks placed where they make no sense (a pool on the summit of Mt Diablo); have agents do a comprehensive review of items and roadways; explore other realism.

### Suggested order

1. **Audit first, in numbers (agents are fine here, 2 to 3 at once):**
   - Roads: sample every intersection and every 10 m of road in the Bay and a few globe towns; report the grade change across each junction and the worst bumps (vertical acceleration a car would feel at 15 m/s). `drive.carAt()` gives a car's place and speed if you want a driven check.
   - Trees: count trees whose trunk or canopy overlaps a road or sidewalk polygon (street, freeway, trail), and trees inside buildings.
   - Pools and parks: list every pool and park with its slope, elevation and the land use around it; flag pools above about 300 m, on slopes over about 8 degrees, outside a backyard, or not beside a home or complex.
2. **Fix by rule, not by hand:** a placement rule each for trees (setback from curb and driveways, spacing, never in a junction's sight triangle), pools (flat backyard of ranch, tract, modern or a complex; never on a summit, a hillside or public land) and parks (flat, beside homes, near a road).
3. **Smooth the junctions:** blend each road's grade into a level junction pad; ease vertical curves; make sure the car physics and the people's footing follow the same surface.
4. **Overpasses:** a few believable ones first (a pedestrian bridge over a freeway; a road over a road downtown), with ramps people and cars actually use. Freeways are in `bay/roads.js` (grade already smoothed with cut and fill).
5. Show Josh before/after images, then ship.

### Where to look

- Roads and freeways: `island/src/bay/roads.js`, `freeways.js`, `realtiles.js`, `realcity.js`, `bridge.js`, `carve.js`, `terrain.js`.
- Trees: `bay/city.js` (`riverTreesNear`, `waterTreesNear`), `bay/footprints.js`, `bay/terrain.js`, `bay/forestfloor.js`, `crysis/civgen.js` (globe towns).
- Pools and parks: `bay/lotkit.js` (a complex's pool), `bay/houseplan.js`, `bay/places.js`, `bay/parkkit.js`, `bay/diablo.js` (the summit and its car park), `bay/discovery.js`.
- Cars and people: `vehicles/drive.js`, `bay/cars.js`, `people/people.js`, `bay/streetlife.js`.

## 6. Also still open

- **Sound design:** engines, thrusters and boosters, and environment sounds. Survey the Bard faceplate's own sound effects in `index.html` (the flight routes in `L99Route223` and the kits) and reuse the subtle, muted ones in the world.
- **iPhone:** nothing from today has been checked on a real phone (frame time, voices, music timing, the bigger `balanced` audio buffer). An on-device performance readout was proposed and deferred.
- The opt-in arpeggiator lookahead (`_useLookaheadARP`) is still off by default.

## 7. Creative suggestions beyond Josh's list

Streets that read as real:
- **Corners done properly:** curb ramps with yellow tactile domes, painted crosswalks (continental stripes downtown, plain lines in the suburbs), stop bars, and storm drains at the low corner. Smoothing the junctions makes this possible.
- **Pavement with a history:** patched asphalt and utility cuts, concrete panels with expansion joints in older neighbourhoods, manhole covers, raised pavement markers on freeways. Match the age to the house eras from `decor.js`.
- **Street trees by era and city:** London planes and ginkgos in tree wells with grates in older city streets; young trees on stakes in new tract streets; roots lifting the sidewalk in old blocks; leaves under the deciduous ones in autumn.
- **Puddles where the road dips** after rain, reflecting street lights, so the weather and the smoothing work show each other off.

Overpasses with life:
- **Pedestrian bridges with the chain-link cage** over Bay freeways, people crossing above traffic, and a moment of wind and traffic roar on the span.
- **Sound under a bridge:** a short reverb and the thump of expansion joints as cars cross (through `audio/acoustics.js`), and tyre noise that changes with the surface.

Traffic and people:
- **Crossing choreography:** people wait at a corner, cross together, the audible walk signal's chirp and countdown; cars yield.
- **Buses at stops** with people boarding, delivery vans double-parked with hazard lights, a car parallel-parking.
- **Dogs on leads in parks,** and the lost dog following you home after the reunion.

Places that make sense:
- **Pools you would expect:** backyard pools in ranch and tract neighbourhoods, a covered pool in winter, a community pool in a complex, none in old dense blocks or on hills. Parks with a playground, dog run, picnic tables and a path that leads somewhere.
- **The Diablo summit as it is:** the stone summit building, the beacon, the car park, viewing spots, and nothing domestic.

Making it a game:
- A **"good street" daily goal** (cross at a crosswalk, return a found item to a park bench) and a **pothole report favour** that sends a crew to patch a road you drove over.
- **Seasons in the street:** leaves, a few holiday lights in December, sprinklers on summer mornings.

Keep phones in mind: instance everything, watch draw calls (the new commercial decor already adds one per building), and check frame time on the phone variant of the smoke test before shipping.
