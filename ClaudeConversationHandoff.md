# Claude conversation handoff: Level 99 Bard / "Crysis" engine

Paste this file, or point a new chat at it, to continue the work from the long October 2026 build conversation. It was written on 12 October 2026 from GitHub `main` at `edf1b23` and updated the same evening at `c18412c`.

- **Deeper detail:** `HANDOFF.md` has per-release notes, newest first, and `docs/*.md` has per-pass evidence.
- **File-by-file map:** `island/README.md`.

## 1. The project in one paragraph

Level 99 Bard is a music-and-world game at **level99bard.com**. It is a faceplate synth UI in `index.html` plus a Three.js engine in `island/src`, built with `cd island && npm run build`. The build writes `island/dist/island.js` and stamps a `?v=` hash into `index.html`. The engine covers:
- the real Bay Area and a globe-scale Earth;
- procedural planets, the Moon colony, and space flight (Sun, Gargantua);
- people (MakeHuman bodies), NPC conversations and quests;
- multiplayer rooms (a Cloudflare Worker);
- gear and trading;
- combat with a morality compass.

`main` deploys live through GitHub Pages. Work branch: `claude/affectionate-heisenberg-3g4qv1`, now level with main.

## 2. Owner rules (keep these)

### Code and process
- **Code style:** tabs, no unused variables, no underscore-prefixed names, short plain comments in the codebase's voice.
- **No model identifiers** in code, commits or docs.
- **No home address** anywhere in the repo.
- **No secrets:** never print, log or commit API keys or secrets (`IP_SALT` is the owner's alone).
- **Free tier only:** no paid APIs; Cloudflare free tier only.
- **Never commit** `node_modules`, `.wrangler`, `dist-*before*` or scratch files. Agents commit with `git add <their files>`, never `-A`.
- **Commit trailer:**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016nHni3xbAgn8jvK8yrprvP
  ```

### Approvals
- **Look changes** (skin, hair, faces, new looks) are shown to the owner before shipping.
- **Deploying:** the owner allows deploying to production yourself (push to `main`) after the smoke test passes.

### Content
- **Places and people:** neutral real places, no brand logos, no stereotypes or mocked accents, dignity for people in encampments.
- **Combat is M-rated, with minors protected:**
  - **No one under 18 can be hit or harmed.** Children and teens are covered. In the lore this is "the Spark", a ward the young carry until they come of age. It is enforced by `isMinor()` in the hit filter, with a test.
  - **Allowed:** blood hits that fade, ragdolls, deaths.
  - **Not allowed:** dismemberment, torture, sexual violence, executing restrained or surrendered people.
  - **Factions** are fictional and mixed: no real groups, symbols or ethnic, religious or national ties.
  - **The player can attack anyone except minors, and arson works.** Choices are scored on the morality compass rather than blocked. People in encampments are never designated targets or rewarded kills, and harming them scores heavily.
  - **No real-world weapon instructions or mechanisms,** and no real brands.
- **Moon crew** are real MakeHuman bodies only, never blocky figures. Hair goes under the helmet and over the collar indoors.

### Working with agents
- **Token budget:** the owner asks for lean work.
- **At most 3–4 agents at once.** Seven parallel agents hit the account usage limit three times in one day.
- **Prefer numbers over screenshots.** Send review images to the owner rather than viewing them yourself.

## 3. What is live now (`main` `c18412c`, 12 October 2026, evening)

### Newest: three releases since the first version of this file
- **Local speech and controls** (`d5017f6`, `docs/local-speech-controls-2026-10-12.md`):
  - NPC and Guide replies are spoken by **Kokoro 82M**, running locally in a web worker (`guide/local-speech.js`, `local-speech-worker.js`). First use downloads about 100 MB of model data from jsDelivr and Hugging Face, which is then cached.
  - The device voice is the fallback and can be chosen in Guide settings. No server, Worker or paid API is involved. Qwen TTS is not used.
  - Touch players get visible Fly, Gear, Places and Controls buttons. Controls opens a two-column scrolling panel.
  - The weapon HUD is smaller and sits in the lower left; field contracts dock into the left-hand layout.
- **Shooter controls** (`9c4512d`, `docs/shooter-controls-2026-10-12.md`):
  - **Phone:** bigger, separate Fire and Aim buttons. Hold Fire and drag the same finger to aim while shooting. Tap Aim to toggle the sights. Zoom scales look sensitivity.
  - **Desktop:** click once to capture the mouse. Mouse-look works without dragging, left-click fires, right-click holds the sights, and Escape releases the cursor. R reloads and Z changes fire mode.
  - New file `combat/look-drag.js`.
- **Water transitions** (`c18412c`, `docs/water-transition-2026-10-12.md`):
  - Fixes water appearing high above streets after visiting another planet, and swimming in mid-air. Swimming now needs contact with the local water surface.
  - World teardown now releases the water jobs, meshes, shared carving atlas and hooks.
  - Each world's water callbacks keep their own world, so leaving and re-entering can't mix them up.
  - New file `world/water-contact.js`.

### Later the same evening (`e1f5174` to `64afa91`, `docs/chatter-and-city-surfaces-2026-10-12.md`)
- **Passing chatter** (`people/chatter.js`, `people/chatter-lines.js`): people you walk past react in their own Kokoro voices, panned in 3D, with captions; afraid if they saw you hurt someone; two people talking each say a line. `Crysis.chatter()`.
- **City surfaces:** tower floors and ceilings, tower floor plates, glazed doors, overlapping neighbour buildings and roof eaves, the skyline copy of near towers, sunroom glass, and cliff-settlement rooms no longer flicker through each other. Census tool: `island/tools/zfight-browser.cjs` (`FAR=1` for depth-precision risk).
- **Headless testing note:** the loading card waits for a tap on Enter world; until it is clicked the world never updates. The census tool and the smoke script now click it.

### 13 October: gameplay loops (`a6eb413` onward, `docs/gameplay-loops-2026-10-13.md`)
- **Favours** (`people/errands.js`): people ask in passing or when asked in conversation; lost items (a wallet can be kept), catch a friend, carry something, fix a car with a Repair Roll. People in a favour are held in the world (`p.held`).
- **Bag snatch** incidents with a chase; witnesses remember.
- **Fares** (`vehicles/fares.js`): hails while driving, fares, tips, stars, rush fares.
- **Use** control for held items (`gameplay/item-use.js`): medkits, repair rolls.
- **Today's goals** (`gameplay/daily.js`), **ranks** (`gameplay/ranks.js`), **Story** tab in the guide; chatter that knows your standing.
- **Moon rovers** ride over the ground (`planet/colony/colony.js`).
- `HOOKS.morality` is now set (families' food deeds used to only queue).

### Everything before that

Everything started in this conversation shipped, much of it in the 9 October "handoff completion" release. More has landed since: cinematic loading, workplaces and malls, character tailoring, field contracts, and shared reputation.

### Multiplayer and server
- **Rooms:** invite link (`?room=`), friends' glide smoothing, phones joining reliably.
- **Rooms Worker:** deployed by the owner. `/status` advertises `trade-v2`, `combat-v1` and `combat-guard-v1`. Read-only check: `node server/verify-workers.mjs`.

### Ground and world
- **Cross-device ground fix:** all survey levels load before placement, a baked built mask keeps the ground flat under buildings, and grading and creek carving stay out from under footprints.
- **Sunken roads fixed:** grading no longer caches the -60 m loading height.
- **Globe:** Bend and the globe towns, with no painted street grids; ground detail cast ahead of the player.
- **Planets:**
  - unique landfalls;
  - the black-hole realm ("Held Note");
  - native entry into both the **Sun and Gargantua** (`docs/stellar-entry-2026-10-09.md`);
  - planet flight vistas with raised clouds.
- **Water and Explore:** no trees standing in lakes, diving by steering down, wider cinematic Explore shots.

### The Moon
- Terrain to the horizon, with 6 outposts.
- Enterable colony interiors and 16 named crew (talk, routines, quest line, earthrise gathering).
- A maglev to sites about 10 km out, hydroponic crops and lived-in signage.
- EVA suits on real bodies, plus indoor lighting so every skin tone reads.

### Caves
- **Resonance stones** strike with E, a tap or the button.
- **The Deep:** endless descent with depth bands and waystones.
- **The Deep Gate** now sits in an underground hall at the end of a cave shaft (the island's passage under the summit, and planet tunnels), with a continuous rope descent and return.

### Gear and armaments
- Gear v2: item instances with levels 1–10 and five tiers, upgrade and combine.
- Gear sheet, Diablo-style trade window and shops.
- 20 ranked armament chassis with optics and a full bow (draw, nock, arrows), plus explicit grips. The upside-down hold is fixed.

### Combat (`island/src/combat/`)
- Weapons, health and HUD.
- Factions and squad AI.
- Civilians, police heat and a morality compass.
- Car damage and fire, destructible props.
- Bosses (`bosses.js`, `boss-defs.js`).
- Field contracts and recoverable weapons from fallen fighters.
- The Off-Duty Orchestra picnic encounter.

### Architecture
- Cliff settlements on TERRAN, SHEPHERD, ICE and GAS: synthwave dusk, mist bands, glow, heaped cumulus.
- Grand procedural interiors with sliding doors and lifts.

### People
- Teens, households, schedules, schools and food (`people/teens|households|schedules|food.js`).
- Fabric weave on all clothing and tailored garments.
- Hair motion and body-collision projection, reduced cloth/body overlap.
- Workplace routines in offices and malls; witnessed incidents and paid conversation quests.

### Loading
- Cinematic loading: 14 real captures in a random slideshow with Pause/Play, and guarded entry, retry and back.

## 4. What is still open from this conversation

These are honest gaps, as recorded in `HANDOFF.md` and `docs/`.

### Owner decisions and reviews needed
1. **Armaments: AAA art sign-off.** `HANDOFF.md` says "AAA assessment: not approved". The owner wanted "2026 gaming quality".
   - Review the exports in `docs/held-items-review-2026-10-09.md` and `docs/armament-ranks-pass.md`, then do a focused art pass on what the owner flags.
   - Native-device frame time is not measured.
2. **Architecture versus the reference video:** shipped, but the mist was still flatter and greyer at mid distance than the video's thick pink sea, and the cumulus are flat billboards.
   - Black frames were seen once in tests, cause unconfirmed; watch for them on device.
   - MYSTICAL and TROPICAL worlds have no settlement yet.
   - Interiors: approximate furniture on round floors, and open doors seen from far away show the skin.
3. **Brows redo:** still on the old version since the revert (`8ba8b81`). The owner wants them **filled in and dense, not arched or scraggly**, with a few unibrows (about 1%). Show the owner before shipping.
4. **Flight approach:** the 7 October feedback asked for a write-up of how flying works (height floors, speed tiers, streaming ahead, arrival into towns), reviewed by the owner before any flight change. Not done unless found in `docs/flight-*`.

### Engineering follow-ups
5. **People clipping:** reduced, not eliminated. There is no full cloth or self-collision. Check high collars, puffers, and long hair, locs and braids while walking.
6. **Vehicles:** duplicate car faces are removed. Confirm intersection softening (bumper and fender, mirror and door, wheel arches), and check the rovers, maglev and arch craft.
7. **The Moon:**
   - suit parts are rigid shells, so the torso can clip the arms at extremes;
   - the boots are boxy;
   - rover rides are instant teleports;
   - the far maglev station is modest;
   - a "Talk" prompt once appeared mid-ride;
   - scheduled walking routes still need a live visual pass.
8. **The Deep:**
   - no per-band ambient sound;
   - small cracks where coarse and fine chunks meet;
   - the phone strike button may still show "(E)";
   - the lift is lightly tested.
9. **Ground:**
   - in Marin the drawn and walked ground can differ, because the GPU draws only 3 fine survey slots;
   - creek carve range differs by device (720 m against 1100 m);
   - road grading exists only within 512 m of your own camera, so it affects remote players.
10. **Multiplayer:**
    - **Shared reputation** (`reputation-v1`): needs the owner's Worker deploy. Don't call it live until `/status` lists it.
    - **Trading on the live Worker:** the owner deployed `trade-v2`, but real two-player trading hasn't been confirmed in production.
    - **Old gaps to re-check:** the host's plans reaching guests, and Follow stopping early.
11. **Gear:**
    - a player market screen (`createPlayerOffer` exists, but there is no UI);
    - a general **Use** action for items (experience from use).
12. **Combat polish:**
    - server-authoritative missions;
    - shared loot (unclaimed loot is local to the visit);
    - physical-device timing;
    - boss tuning and live play.
13. **Since the newest releases:**
    - **Kokoro speech:** latency and memory on a real phone (the first-use download is about 100 MB) are unmeasured.
    - **Fire-and-drag aiming and touch layouts:** emulated only, not tried on a real phone.
    - **Water fix:** your original planet seed and save that showed the floating water weren't available, so the exact case is unconfirmed. Re-check it on device.
14. **Physical device QA everywhere:** almost all checks are Chromium software rendering. Real iPhone and Safari performance and look are unverified across the board.

15. **Chatter and surfaces (12 October evening):** real Kokoro voices in passing are unheard on a phone (model hosts blocked in the sandbox); the 100 MB download now also starts on the first remark; the island village has about 80 m² of floor layers 2.6 cm apart.

16. **Gameplay loops (13 October):** fare drop-off and every loop are unchecked on a real phone; favours need people about (few at night); a lost-pet favour would need an animated dog (a look change for the owner first).

17. **Music fidelity (13 October):** see `docs/music-fidelity-2026-10-13.md`. Timing is locked to the audio clock (`L99Clock` in index.html) and the world's sounds and voices now enter ahead of the peak guard. Unheard on a real phone; the phone's `balanced` audio buffer adds a little latency to live play (override: localStorage `l99-audio-latency`). The opt-in arp lookahead (`_useLookaheadARP`) is still off by default.

### Parked (do not start unless asked)
- The game trailer (1080p60 with a 4K60 script).
- The P5 leaderboard and world morality status page. The compass now exists in `combat/morality.js`, so this could be unparked when the owner wants it.

## 5. How to ship (selective, verified)

1. **Build a ship tree.** In `/tmp/claude-0/ship` (or any clean clone), `git fetch && git reset --hard origin/main`. Apply only the approved files from the branch; take `main.js` hunks by hand when several areas touch it. Then run `cd island && npm run build`.
2. **Serve and smoke test.** Serve the tree with `python3 -m http.server 8768` and run the smoke script. The old one was `/tmp/claude-0/planet/smoke-ship.js`, which may be gone after a container restart; recreate it as a Playwright run of `island/dev.html` at `?planet=MAGMA&seed=4242`, `?planet=TERRAN&seed=77`, Earth, and a 16-sampler check. It must print the magma, terran and earth lines and samplers "ok", with no PAGEERROR or SHADER errors.
   - Playwright: `require('/opt/node22/lib/node_modules/playwright')`, args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. SwiftShader runs at about 0.2–1 fps, so force work synchronously and check state rather than timing.
3. **Push.** Check `git merge-base --is-ancestor origin/main HEAD`, then `git push origin HEAD:main`.
4. **Merge back.** Merge main back into the work branch. For `dist` and `index.html` conflicts, take ours and rebuild.
5. **Workers:** the owner deploys them. These are one-line commands for zsh on a Mac:
   ```
   cd ~/bard-server
   git pull origin main
   cd server/multiplayer
   npm install
   npm test
   npx wrangler deploy
   ```
   The workers.dev domain is blocked from the cloud sandbox (403), so verify through the owner, or with `server/verify-workers.mjs` where reachable.

## 6. Gotchas learned the hard way

- Never `pkill -f` or `pgrep -f` a pattern that appears in your own command line; it kills your own shell (exit 144). Kill by PID.
- `ss` isn't installed.
- **Container restarts** lose background processes and `/tmp/claude-0/*` review images. Commit work often.
- **Usage limits** stop all running agents at once. Commit their WIP snapshots, then resume each agent by its ID, or re-create it from the area table in `HANDOFF.md`.
- **Apple Metal shader-size limits:** keep the Bay ground shader small.
- **The 16-sampler cap** applies per shader stage on Safari and phones.
- **Headless speed:** town growth (`crysis/civ.js`) and water pumping happen a few ms per frame, so headless tests need `civ().flush()` or direct pumps to see results.
- **Browser tests:** the newer test tools take `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` environment variables. Many areas now have checked-in browser checks (`island/tools/*-browser.cjs`, `tools/loading-handoff-browser.cjs`) and node tests (`node --test island/tools/*.test.mjs`); run the relevant ones before shipping.
- **The V1 runtimes are source in `runtime/src`** (the world core, flight, the V1 caves), already carrying every change the page used to patch into them at load. To change one, edit it there and run `node tools/pack-runtimes.mjs`. Never add a patch layer to `index.html`: `island/tools/runtime-pack.test.mjs` fails if one comes back. `runtime/src/README.md` lists the switches that still work.
- **`createIslandWorld`'s phases** live in `island/src/island-build.js`, `island-frame.js`, `island-panel.js` and `island-teardown.js`, and read its bindings through `iw` (stable ones destructured at the top, changing ones as `iw.name`). A binding one of them needs that `iw` lacks gets a getter (and a setter if it changes) in `main.js`; `island/tools/island-world.test.mjs` checks.
- **The stop hook** wants no uncommitted changes at the end of a turn. With agents running, snapshot with `git add -A -- island server index.html docs HANDOFF.md`, unstage `node_modules` and `.wrangler`, then commit and push to the branch.

## 7. Suggested next steps, in order

1. Ask the owner which of section 4's decisions to take first: armament art review, the architecture look pass, or brows.
2. Physical-device pass on iPhone and Safari: frame time, black frames, the new fire-and-drag aiming and touch controls, Kokoro speech (download, latency, memory), the floating-water case after planet travel, and the loading slideshow.
3. Owner deploys the rooms Worker for `reputation-v1`; then a live two-player test of trading, combat and PvP-off.
4. Focused art pass on armaments, then brows, then the architecture mist and clouds (mist volume, volumetric cumulus, selective glow).
5. Moon polish (suits, rover drive), Deep ambience, and the ground issues (Marin slots, carve range).
