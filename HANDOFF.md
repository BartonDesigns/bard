# Level 99 Bard: handoff notes

How the project fits together, how to work on it and ship it safely, what has been built so
far, and where it is heading. Read this before changing anything; the island engine's own
file-by-file map is in `island/README.md`.

## Owner feedback to work next (7 October 2026, after a context clear)

The owner flew north from the Bay and noted these points. Nothing below is built yet. The code
pointers are where each fix most likely starts.

1. **Trees in the Pacific Northwest lakes and rivers.** Every lake has trees standing in the
   water, and you can see them from under water. Trees at the edge of a natural lake are fine and
   wanted. Water and land need a real shoreline between them.
   - Cause: `earth/globetrees.js` `lay()` only skips a tree when the ground is below sea level
     (`if (h < 1) continue;`). It never checks the lake mask. The terrain shader knows where lakes
     are (`vGC.y` = `gLake`, `vGC.z` = `gLevel` in `earth/globeterrain.js`), but the CPU tree
     placement does not.
   - Fix: give the trees a lake and river test on the CPU: under water (`h < level - 0.3`), no
     tree; a band a few metres above the level gets reeds, shrubs and the odd shoreline tree. The
     terrain also needs a shoreline in the colour, a wet bank and a beach or reeds, like the coast's
     `shore` term but for lake levels. The existing open item "creek and lake banks near sea level
     coming out beach-tan" is the same work.
2. **Diving by direction.** You should go under water by looking or steering down, not by
   pressing a down-arrow or dive key. Today `player.js` `jump()` sets `s.diving` only from the
   jump/dive button, and diving ends when you rise above the surface. Change: while swimming,
   pitching down past a threshold (about −20°) while moving forward starts the dive. Swimming
   under water already follows where you look.
3. **Bend, Oregon "city blocks". Done.** The owner chose real buildings, never fake grids. The globe ground no
   longer paints streets (`earth/globeterrain.js`); its built-up tint shows only from 1.5 km out.
   Streets and buildings come only from the town the generator grows. Bend is size 2 (1.7 km reach).
4. **The flight approach needs the owner's review and approval.** Write up how flying works
   (height floors, speed tiers, how the ground streams in ahead of you, the arrival into towns) and
   show the owner before changing it. Do not ship flight changes without approval.
5. **Detail under you and ahead. Done.** The owner wants the sharp circle under the player and also cast
   ahead. `earth/globe.js` leads the fine and mid ground rings and the near trees along the view:
   0.6 of your height, between 40 and 450 m (trees at most 150 m), and none when looking straight down.
6. **Cinematic automated motion.** Explore mode (`explore.js`) should feel epic: sweeping
   crane and drone moves, slow reveals over ridges and coasts, long glides at golden hour, cuts
   timed to the music. It already has shots (`dolly`, `orbit` …) and phrase cuts from
   `autoMusic.pulse()`. This pass is about the shots' quality: higher and wider establishing
   shots, parallax past foreground, and easing that does not feel mechanical.
7. **Enter Gargantua and the Sun.** The owner wants to fly into both. `space/flight.js`
   `hazards()` now pushes you back with `startBounce()` at `SUN.safe` and `GARGANTUA.safe`, and
   `space/frame.js` keeps their shells in `clearance()`.
   - Gargantua: the inside of the black hole, with its event horizon at the centre, is already
     designed (`runtime/gargantua228.mjs`, drawn in `space/view.js`). Replace the bounce with an
     entry sequence through the disk and photon ring into that interior, and a way back out (a
     warp or a timed return).
   - The Sun: an entry through the corona and photosphere into a glowing interior, with the heat
     warning kept as atmosphere instead of a wall, and a way back out.
   - Show the owner the look before shipping.

## Gear, levels and trading (8 October 2026)

- **Built (on the branch):** the 🎒 Gear sheet (rail button, the places menu, or I) and a trade
  window between friends in a room.
  - **Items are instances** (inventory version 2, `gameplay/arms.js`; version 1 saves migrate to
    Common, level 1): each has an id, a level 1-10, a tier (Common, Fine, Superior, Masterwork,
    Legendary) and experience. `gameplay/gear-levels.js` holds the stats (game numbers per item:
    light radius, heal, accuracy, range …), value, upgrade cost, combining and experience.
  - **Levelling up:** experience from carrying the held item on foot and from hunts
    (`arms-runtime.js` `carry`, `train`); **Upgrade** at an outfitter, ranger camp or trader (credits
    plus one Repair Roll); **Combine** two of the same item and tier into the next tier. Shops buy
    back by level and tier. Transactions: `train` (not journaled), `upgrade`, `combine`, `sell` by uid.
  - **Models** (`crysis/held-items.js`): turned and extruded shapes with canvas-drawn wood, leather,
    brushed metal and canvas; the trim metal shows the tier, a polished inlay from level 4, a
    glowing core from level 7, motes at Legendary; about 2-3.4k triangles each (low LOD for friends
    and phones). Held in the right hand (the fingers close round it: `motion.js` `grip`) or low in
    the first-person view. The fictional rifles are stylised, with no working parts.
  - **Gear sheet** (`ui/gear.js`, look in `ui/gear-look.js`): slots with tier edges, level badges
    and counts; an item's detail view with its model turning (`ui/gear-studio.js`, its own small
    renderer, which also draws the slot thumbnails), level bar, stats with next-level values,
    Hold, Upgrade, Combine and Sell.
  - **Trade window** (`ui/trade-window.js`): your offer and theirs side by side (stacked on a
    phone), coin stacks, your bag to drag or tap from, tooltips with stats and green/red
    differences against what you hold, a big Accept per side that lights its panel, a flash when a
    change clears them, and a 1.5 s hold once both accept (either can still cancel). Sounds through
    `world/soundbus.js`.
  - **Protocol:** trades name instances `{u, i, l, t, x}` (`net/protocol.js` `cleanTradeSide`);
    the pose carries `h`, `hl`, `ht`; messages may be 3 KB. The asker commits after the hold
    (`gameplay/trade.js` `tick` with `HOLD_MS`); each side applies its own side once as
    `trade:<id>`, the very instances moving under their ids (a clash is renamed, never lost).
  - **Server:** the `trade` relay and its `trade-ack` in `server/multiplayer/src/room.js`. **Not
    live until the owner redeploys** (steps in `server/multiplayer/README.md`). Against the old
    server the game says "Trading needs the rooms server update." after 4 s.
  - Tests: `node island/tools/trade.test.mjs` (trades, levels, upgrades, combining, migration),
    `cd server/multiplayer && npm test`.
- **Left:** a player market (posting offers at the community exchange: `createPlayerOffer` exists,
  no screen), item Use actions (experience from use once they exist), and the plan below.

## Next weapons and gear steps: a plan (not built)

Everything stays a game abstraction: fictional items, encounters resolved by game rules, no
real-world handling or instructions, nothing graphic. Theft and heat stay exactly as the core
defines them.

### 1. Using items
- One **Use** button beside the held item (and the E key), shown when the item has a use here.
  `applyInventoryTransaction` already has `use` with an activity; the runtime adds
  `use(itemId, context)` that picks the activity from where you are (a hunt trail, your home, a
  shelter) and returns a short game outcome.
- Per kind, short and readable:
  - **Camp lantern:** a soft point light (one, pooled, phones skip it at night under low quality)
    that lights a cave or a shelter encounter.
  - **Field medkit:** clears an "injured" state from an encounter (consumed).
  - **Repair roll / door brace:** repair or secure a home object (consumed / placed).
  - **Lantern alarm:** placed; it chimes and calls friendly townsfolk when an encounter starts nearby.
  - **Signal flare:** a coloured light in the sky that friends in the room see (one `event`).
  - **Hunting net / scent kit:** reveal or finish a tracking trail.
- Placed items are world props with an id, saved in the inventory journal, so a reload keeps them.

### 2. Hunting (game-only)
- A **trail encounter**, not a shooting simulation. Starting a hunt (already `hunt` in the
  runtime) lays a short trail of tracks and markers near the source using the existing fauna
  (`landFauna`). Following it, the scent kit and the net reveal and finish steps.
- The finish is a "tag" or "capture" moment: the animal is marked, calmly walks or runs off, and
  you get a trophy card and credits. No wounds, no bodies, nothing graphic. The bow and the trail
  rifles only change the range and the quiet of the tag.
- Wildlife in protected or populated places is never a target; children and townsfolk never are.

### 3. Home defence (game-only)
- A **shelter encounter** at your home (Guide home or a cottage): at night a "prowler" event
  (a shadowy, faceless figure, never a named townsperson, never a child) tests the home.
- Prepared homes win without contact: door braces, lantern alarms and lanterns raise a "secured"
  score; the alarm calls friendly neighbours; the guard items "deter", and the figure leaves.
  The Warden Spark Carbine stays non-lethal, as the catalogue says: it ends the encounter with a
  flash and the figure fleeing.
- Friends in the room can help: the host's encounter is shared like gatherings (an `event`), and
  each guest's preparations count.

### 4. How combat would fit the existing bodies, poses and ragdolls
- **Poses:** `people/motion.js` already plays held poses and keyed actions (`people/actions.js`:
  pitch, bat, crouch, ready). Add a few game actions in the same form: `aim` (both arms raised,
  for the bow and long items), `brace` (the item held across the body), `toss` (the net), and
  `raise` (the lantern up). The held item rides the right wrist as it does now.
- **Your body:** in third person (`people/self.js`), the action plays on your avatar; in first
  person the view model in `crysis/held-items.js` tilts with the same action.
- **Friends:** the pose's `a` gains these action names (validated in `protocol.js` like the walk
  states), so friends see the same motion.
- **Outcomes, not damage:** an encounter resolves by rules (preparation, item, skill, a roll),
  like `resolveTheftAttempt`. A "stagger" on an encounter figure reuses `people/ragdoll.js`'s
  `hit()` with a small push, as the shove (X) already does: a stumble and getting back up, never
  injury. Ragdolls stay for falls and pushes, not for harm.
- **Multiplayer:** each player stays the owner of their own state; the host decides an
  encounter's outcome and shares it as an `event`, so everyone sees the same ending.

### 5. Order of work
1. Use button and the simple uses (lantern, medkit, repair, flare). 2. Placed home items and the
shelter encounter. 3. The hunting trail and tag. 4. The action poses and their multiplayer field.
5. A shared encounter in rooms.

## Resume here (7 October 2026)

- **Multiplayer v1 (on the branch, not live until the owner deploys):** friends join the host's game and see each other.
  - **Server:** `server/multiplayer` is a second Worker, `l99-rooms` (Workers Free: one SQLite Durable Object per room, WebSockets with hibernation). The deploy steps are in `server/multiplayer/README.md`: `npm install`, `npm test`, `npm run deploy`, then put the address in `island/src/net/config.js` (`ROOMS_URL`) and rebuild. While it is empty, there is no Invite or Join, nothing connects, and `?room=` links just open the game.
  - **Wire format:** `island/src/net/protocol.js`, shared by the game and the server, which cleans every message. Only poses, spots, the hour and weather, and the plain facts of the host's meetings ever travel; no dialogue.
  - **Limits:** 8 a room, 3 KB a message, 20 messages a second (bursts of 40), 30 s silence drops a player, empty rooms kept 30 min.
  - **Host:** if the host leaves, the longest-present player takes over; the owner gets the seat back on return. **End room** closes the room for everyone.
  - **Client (`island/src/net/`):**
    - `client.js`: connection, with reconnect and backoff.
    - `remotes.js`: MakeHuman bodies from each player's `l99-me` seed, 150 ms interpolation, name tags, a simple car or boat. Bodies for the nearest 7 within 260 m (3 within 140 m on a phone); further away, only a tag.
    - `follow.js`: follow within 4.5 m. It steers through `player.state.auto`, so you can still look around. Nudging is fine; 1.5 s of your own movement ends it. More than 150 m away, you are put beside the leader.
    - `multiplayer.js`: glue and UI:
      - 👥 Invite friends and Join (room code) at the top of the 📍 places menu;
      - a room chip at the top left;
      - a player list with Follow and Go to;
      - tap a friend in the world for Follow or Go to.
    - Guests take the host's hour, clock speed and weather (mode and weather day). The host's meetings and gatherings come as a read-only "The host's plans" list in the room panel, with a pin, and a gathering's crowd plays from its seed in a guest-only appointment book. The guest's own journal and `guide.js` are not touched.
  - **Joining:** `?room=CODE` (in `index.html` and `dev.html`) calls `joinRoom`, then waits for the host's spot code and arrives through `share.openAt`, the one-load resume path, 3 m behind the host.
  - **Tests:**
    - `cd server/multiplayer && npm test`: 58 checks.
    - `node island/tools/multiplayer.test.mjs`: 21 checks.
    - Headless two-page run against `wrangler dev`: `/tmp/claude-0/mp/two.cjs`.
  - **Not yet:**
    - The plans are not in the Quests journal.
    - Remote players are not shown in third-person driving poses inside real car models.
    - No voice or chat.

- **Explore mode (on the branch):** `island/src/explore.js`, O or the compass button in the mode group. A hands-free cruise in the current mode (walk/run with B, fly at the chosen tier, drive assist picking turns, space from body to body), steering by a wandering course weighed 4 times a second against slopes, water, walls, trees, trails, coasts and ridges. Turns auto music on without saving it (`auto(on, true)`), biases its energy and tempo by the tier (`bias`), and shifts key and queues a section on a new place (`shift`, `queue`); the camera cuts on phrases and eases on 4-bar lines from `autoMusic.pulse()`. HUD fades after 7 s; place names as a lower third (from `labels.where`). Esc, W/S, ↑/↓, Space, C or the stick held end it; `Crysis.explore()` reports distance, clearance, blocked count and shots. Test: `/tmp/claude-0/explore/run.cjs`.

- **Off-world colonies (on the branch, `island/src/planet/colony/`):** a procedural kit replacing Earth-style settlement on hostile worlds.
  - `styles.js` (per-world parts, materials and lights: MOON, MAGMA, TOXIC), `plan.js` (sites the hub in a crater floor or the flattest ground, the spaceport, outposts, solar farms; levels them into the height map and wears the roads into the path mask), `parts.js` (domes, berm-buried modules, glass corridors, printed/shielded towers and sealed spires, pads, control tower, landers, mine rig, dishes, scrubber stacks, maglev), `mats.js` (one lit material, its look per vertex: plates, printed strata, night windows, regolith, solar cells, lamps, blinking running lights, coolant flow), `colony.js` (build, LOD, instanced solar/fins/rovers/suited colonists, trains, night lights, arrival names, `go()`).
  - Moon: Tranquility Colony; MAGMA: Basalt Hold (coolant lines, heat-shield towers); TOXIC: Clearsky Spires (spires, scrubber field). Warp list: "Moon: Tranquility Colony" lands at its spaceport. `Crysis.colony()` / `Crysis.colonyGo()`.
  - Hostile worlds (MAGMA, TOXIC, SINGULARITY, GAS/BARREN) now hide the clapboard fishing village (`profile.noVillage`), no villagers spawn where there is no village, and the Moon's vacuum light is hard (shadow radius 1, little fill).
  - **The Moon to the horizon:** `world/lunarfar.js` is one relief function written twice (JS and GLSL, the same sine-free hash): rolling mare, highland ridges, craters of two size classes (the big ones with central peaks). `islandgen.js` `heightAt` blends into it past `island.half` (so you walk on what is drawn); `terrain.js` adds 28 outer rings to the ground grid out to 32 km and a curvature drop; `main.js` keeps the ground visible out there, thins the fog and pushes the far plane to 40 km (`island.far`).
  - **Far sites** (`styles.js` `outer`, `parts.js` far-site builders): Copernicus Deep Mine and Daedalus Observatory on great crater rims, Far Side Relay, Wreck of the Kestrel, First Landing Plaza (bootprints, an empty plinth), Storm Shelter Four; dark rover tracks out to each, rovers on them, names on arrival.
  - **Interiors:** every hub shell is walkable (`parts.js`: dome ring wall with doorways, hollow corridors, open modules with bulkheads and doors, airlocks; their walls are colliders). `interiors.js` furnishes them when near (dome farm, mess, quarters, med bay, workshop with a rover, lounge, supply depot, the tower lounge, the control room) with an indoor-lit material, and lets go when far. `life.js`: lifts (stand on the glowing pad), airlocks that cycle with a suit-up/suit-down note, terminals (E or the button) with the colony map and rides out to any site; the depot lists stores and hands them to `opts.give` once the inventory exposes one (the hook). Crew work indoors out of their suits; some walk out through the airlocks and come out suited.
  - Not yet: ICE, suits from the people system.

- **Cliff settlements (on the branch, `island/src/planet/arch/`):** an advanced people's settlement grown into the cliffs of TERRAN (Verdance), SHEPHERD (Ringfall Terraces), ICE (Glasshollow) and GAS (Stratos Reach); art direction from the owner's dusk/synthwave reference (violet dusk, dark towers with pink/violet/warm window grids in a fog sea lit from below, a lone monolith, the white cliff complex, the lakeside cube house, glowing flower fields).
  - `styles.js` (per-world counts, kinds, colours), `plan.js` (scans the heightfield for cliff lips with a level top and air under them, picks the densest cluster, seats each house's back into the top with a blend that never touches the face, towers on the valley floor or in the cloud sea, bridges where the gap is clear, contour footpaths, the mist band's height from the gorge floors, a monolith out at sea, a shore house on a knoll by the water), `arch.js` (cantilever houses on V struts and a swept root sunk in the face with stone collars and buttresses, terraced houses stepping down the face with stairs, domes and drums on some backs, slab-tower clusters and turning spires with lifts, bridges, the shore house, the cottage; colliders, LOD, lifts, craft, arrival names, `go()`, a violet lean of the sky's air tint at dusk restored on dispose), `mats.js` (one lit material, look per vertex: concrete, glazing with mixed-colour lit panes, rock, timber, planted, lamps, beacons, pool water, metal; plus balustrade glass and a multiplied contact shade), `clouds.js` (the mist band: thin layers whose noise is read upstream of each tower so it parts round them and meanders in their lee, glowing pink from the works at dusk; wisps streaming round the towers; a veil when you fly into it), `glow.js` (light streaks on the water turned toward you; additive points for flowers and hamlet lamps).
  - **Interiors (task 2):** `rooms.js` plans each building's floors (towers: a stack of seeded floor heights 6–20 m, lift core, rooms along one axis parted by portal walls, grand floors with a gallery and stair; houses: vestibule + hall over the drop, terrace suites, the shore house's two rooms), `furnish.js` builds a floor's shell and furnishing (instanced kit, per-floor theme, light baked to vertices), `interiors.js` walks them (extraFloor/extraPush via `arch.floor/push`, lifts, room names, builds ±1–2 floors near you and disposes on leaving, hides a spire's hull while inside). `Crysis.archGo('b:f')` stands you inside building b floor f (`'b:f:gallery'`, `'b:f:r1'`). Dusk sky: `sky.js` uDusk gradient/clouds/no air tint at dusk.
  - Wired in `main.js` after the realm plan (its clear goes into `fieldPlan.clear`), built after the colony with the extraFloor/extraPush chain. `Crysis.arch()` tells of it; `Crysis.archGo(i)` stands you on house i's deck over the drop (then the towers, then the shore house).
  - Rough: the mist band is one height per settlement (houses higher up stand clear of it); the sky's dusk tint is a single-hue lean, not a true violet-to-magenta gradient; no people on the decks; MYSTICAL and TROPICAL are not hosts yet.

- **Street-level gaps filled (on the branch):** 125 new cells of the shared tile grid, baked with
  `tools/bake-realcity.py --tiles` from Overture 2026-09-23.0 (raw data in `/tmp/claude-0/expand/ov-*`):
  Castro Valley `cv` (10 tiles, 0.6 MB), Moraga and Canyon `moraga` (12, 0.8 MB), Richmond and
  El Cerrito `rich` (23, 4.4 MB), Novato `novato` (24, 2.1 MB), Sunnyvale and Santa Clara `svl`
  (25, 6.3 MB), Santa Clara, north San Jose and Milpitas `sjn` (31, 7.5 MB). Tiles median 90 KB,
  max 579 KB (the older ones: 199 / 656 KB).
  - The bake now drops a road or building that a neighbouring region already holds (whole regions
    keep footprints past their edges); seam check `/tmp/claude-0/expand/seam.py <area>`: 0 duplicate
    roads or buildings at the seams.
  - Terrain: a 15 m level `h10` over Novato (h1 stopped at 38.12); the water bake's Novato tiles and
    lakes were redone against it and merged (`/tmp/claude-0/expand/watermerge.py`), the rest of the
    water kept as it was (a full rebake no longer reproduces it byte for byte elsewhere).
  - Banners and the Guide: Canyon, Point Richmond, Alviso, Berryessa, Hamilton, Ignacio and Marinwood;
    Lake Chabot, Saint Mary's College, the Rosie the Riveter Memorial and Mission Santa Clara as areas;
    five Guide landmarks.

- **Live:** main is at `a50b1da`. It includes:
  - meetings people keep (`people/appointments.js`) and gatherings (`people/gatherings.js`, `gathering-scene.js`);
  - one-load resume into the saved spot and hour (`share.js` `go()`);
  - space: Moon landing (MOON profile), the black hole fixed in the orbit frame, `space/nav.js` markers, gears ×9→×100k on B, warp on J or the Warp button, and the Sun pushing you back;
  - the edges pass: water edges, interior corner shading, contact shadows (`bay/contact.js`), texture scale;
  - the phone memory budget, streets drawn on the light ground, and High as the default graphics.
- **Agents running on `claude/affectionate-heisenberg-3g4qv1`** (results land there):
  1. **World expansion:** street-level Castro Valley, Moraga, Richmond/El Cerrito, Novato and south of Mountain View; then the trail saw-tooth, the globe sky latitude, and the regional talk fixes. Scratch in `/tmp/claude-0/expand/`.
  2. **Skin:** blotchy, too-bright T-zone and sheen on NPC faces. Scratch in `/tmp/claude-0/skin/`.
  3. **Multiplayer v1:** a Cloudflare Worker with Durable Objects and room codes (`?room=`), avatars with interpolation, Follow, host-synced time, weather, gatherings and meetings. Code and a deploy guide are in `server/multiplayer`. Scratch in `/tmp/claude-0/mp/`. The owner must deploy it.
- **Discovery Worker:** the planner update is deployed and confirmed live by the owner (7 Oct): the cloud voice now plans real quests and social intents. This sandbox can't reach workers.dev (proxy 403).
- **Open items:**
  - **Brows:** redo them filled in and dense, and show the owner first. The current brows are the old ones.
  - **Edges:**
    - a street before/after;
    - contact shade for people, rocks, fences and logs;
    - bevels on outside corners;
    - the dashed line at the Half Moon Bay waterline;
    - creek and lake banks near sea level coming out beach-tan.
  - **Moon:** boulders and trails are still on the surface.
- **Ship steps:**
  1. In `/tmp/claude-0/ship`, `git fetch` and `reset --hard origin/<branch>`.
  2. Check `merge-base --is-ancestor origin/main HEAD`.
  3. Serve the folder on 8768 and run `node /tmp/claude-0/planet/smoke-ship.js`. It must show 0 errors and "samplers ok"; a screenshot timeout alone is fine.
  4. `git push origin HEAD:main`. The owner allows deploying.
  - **Gotcha:** never `pkill -f` a pattern that appears in your own command line; it kills the shell (exit 144).
  - **To ship only part of the branch:** reset the ship tree to `origin/main`, then apply the specific commits' source diffs and rebuild.
- **Tokens:** the owner asks for lean work: one or two agents at a time, numbers before screenshots, and they approve looks before shipping.

## Earlier resume note (6 October 2026, night)

- **Live:** main is at `8ba8b81`. It includes:
  - this week's world work;
  - sprinklers;
  - streets drawn on the light ground (`bay/terrain.js`, under GROUND_LITE_F);
  - the phone memory budget, about 500 MB down to 255 MB, with the travel leak fixed;
  - the hair fixes: salt-and-pepper grey, long-hair undersides, ears, white beards, the afro growing from the scalp.
- **Brows:** reverted to the old version. The owner wants them filled in and dense, not arched and sparse. Redo them and show the owner before shipping.
- **Next, in the owner's order:**
  1. **Quests:**
     - no hollow NPC promises: an agreed meeting becomes a real journal quest, with game time and its real-time equivalent;
     - waypoints, a map pin and a direction hint;
     - NPCs keep their appointments;
     - gatherings and events run in the engine without the cloud.
     - The Worker's quest planner (`server/discovery`) is not deployed; the owner must run `npm run deploy` with Cloudflare.
  2. **Skin:** blotchy, too-bright oily T-zone highlights in some light (`people/` skin shader).
  3. **Multiplayer:** see friends' avatars, follow-the-leader within a radius, quest together, host-synced world. Cloudflare Durable Objects (free tier).
- **Teleport test** (iPhone profile, SR→SF→Kyoto→Newark→SR): no context loss, textures 102→137. Script: `/tmp/claude-0/roadsbug/tele.js`.
- **Ship steps:**
  1. In `/tmp/claude-0/ship`, reset to the branch.
  2. Rebuild.
  3. Serve the folder on 8768 and run `node /tmp/claude-0/planet/smoke-ship.js`. It must show 0 errors and "samplers ok".
  4. `git push origin HEAD:main` (the owner allows this).
- **Tokens:** the owner asks for fewer agents and screenshots. Check with numbers first.

## Release (6 October 2026)

- **Live ground fix (iPhone, Dougherty Valley):**
  - The camera could skim into fences and house walls in fast low flight, so the ground looked see-through with straight walls below.
  - `player.js` now keeps the flying and walking floor above both the walked ground and the drawn ground. The margin rises with speed: 1.2 m at ×1, about 4 m at ×6.
  - Phone road maps keep their edge ramps two texels wide (`realcity.js`).
  - Not yet seen on a real iPhone.
- **Graphics:** High is the default, phones included, and is remembered (`l99-quality`). The light ground (`world/gpulite.js`) is used only after a graphics loss while the Bay ground builds, and for 3 days (`l99-gpu-lite3`). Pressing High clears that and reloads into the full ground.
- **Far rain and storms** (`world/sky.js`, `world/weather.js`):
  - Shower cells are 1.6–4.2 km across.
  - A storm spreads a dark, uneven cloud deck about three times wider than its rain, and dims the sky toward it down to the horizon.
  - The rain shaft keeps an even width, leans with the wind and fades at its edges.
- **Time speed:** a real-time step between paused and 0.1× (`sky.state.real`).
- **South Bay salt ponds** (`bay/saltponds.js`, `bay/saltpondmap.js`):
  - 98 ponds traced from the height survey, in crimson, rose, salmon, teal or white crust, with walkable levees and pylons.
  - A marsh of mudflat, cordgrass, pickleweed (red from August to November) and gumplant.
  - The ponds lower the Bay height textures; these are re-uploaded whole.
- **Outside the Bay:**
  - **Local roads** (`earth/globelanes.js`): section-line grids in the Midwest and Central Valley, lanes between villages, drives to houses. They are drivable and stay visible from the air.
  - **Ground** (`earth/globeterrain.js`): fields with crops and rows on flat valley land only, and grass that is gold in summer and fall, green in winter and spring (`uGDry`).
  - **Regional trees** (`region/flora.js`): rebuilt on the Bay's leafy vegetation in place of the low-poly shapes, including eucalyptus windbreaks and groves, and snowy spruce.
- **Sprinklers and falling water** (`world/spray.js`, `world/sprinklers.js`, `world/falls.js`):
  - Droplet streaks with rainbow colour, mist and wet lawns.
  - House timers: a fixed 20% of houses water at sunrise, another 20% at 3 am.
  - Spray and mist at creek cascades and cave falls.
  - A head-to-head layout per lot with zones is in progress, paused; notes are in the landscaping work.
- **Next on the list:**
  - phone memory budget;
  - hair refinement (show the user before shipping);
  - ~~street-level gaps~~ (done 7 October, see Resume here);
  - regional dress and talk fixes;
  - the trail saw-tooth;
  - sky latitude on the globe.

## Release checkpoint (4 October 2026)

The current branch `codex/guide-general-travel-defaults` carries the next playable
space/guide pass. The Guide now understands broad conversational travel requests such as
“take me toward the Far East”, resolves them to authored atlas cities while the atlas is
still loading, and keeps deliberate model/provider choices across temporary offline or GPU
failure conditions. Mature, bold, rich dialogue is the default for adult NPCs and the Guide;
child NPCs remain age-gated. Orbital HUD controls stay live through ascent, boosters cycle
1×/3×/6×/9×, Gargantua is a distant camera-relative landmark, and the Moon clamps to a
walkable procedural crater surface with a music-reactive sky. Focused Guide, orbit, cave,
social, atlas/road, and Gargantua checks pass; Chromium smoke confirms no loading overlay,
shader error, or WebGL context loss during Earth return, booster cycling, Gargantua view,
and lunar landing. The generated `index.html` and `island/dist/island.js` are kept in sync
with the source. This checkpoint is ready for a feature-branch PR; Cloudflare Worker
deployment remains a separate authorized step.

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

- **Regional homes and roads (4 October Pacific):** `docs/world-expansion-progress.md` tracks BR-011/012: grounded East Asian homes, streets aligned between regional blocks, connected highways beyond the Bay, and bounded road streaming/terrain grading. Preserve the live cave release and verify actual rendered towns before reporting worldwide coverage.

- **Seamless caves (4 October Pacific):** `docs/seamless-caves-progress.md` tracks native surface/cave integration, verification and remaining legacy gaps; `docs/cave-migration-inventory.md` preserves 27 categories. Street-agent observations are in `docs/street-walking-playtest.md`. The cave release candidate passes the actual faceplate door, controller round trip, saved musical rewards, local companion movement and shader/phone-UI gates; release PR deployment evidence determines live status. Do not claim full deep-cave or mainland coverage from the generated-island release.

- **NPC dialogue/archive (4 October Pacific):** `docs/npc-dialogue-archive-progress.md` records per-NPC transcript isolation, searchable full history and tone settings. BR-006 explicitly requires future universal world progress; current local NPC/quest saves are not shared multiplayer state. Preserve private conversations and do not claim backend synchronization without two-client evidence.

- **Conversational quests and Floodgate (3 October Pacific):** See `docs/conversational-quests-progress.md` for provider/deployment boundaries and verified gameplay. The owner now prioritizes persistent world development as rewards, with roughly day-long propagation to specify. The canonical running build queue is `docs/build-requests.md`, maintained under `agents/floodgate.md`. Keep legacy content/saves compatible; do not equate queue intake or generated prose with a shipped world change.

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
- **Street-level Bay:** done and live (eight new areas, tiles streamed by distance). The gaps were
  filled on 7 October (see Resume here). The place-name banner (`bay/labels.js`) now runs on the real
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
  and Moroccan food. Herders everywhere now wear boots or sandals and no chain (`region/dress.js`,
  7 October); Kyoto and Marrakesh are called cities (`region/community.js`, checked 7 October).

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
- **Trails:** the faint saw-tooth where the ground mesh meets the trail's cut is softened (7 October:
  the tread is averaged over the vertex spacing, `bay/berms.js`); not yet seen in a test frame.
- **Sky:** follows the player's latitude on the globe (`main.js` passes `globeLL(...).lat` to
  `createSky`; `tools/solar.test.mjs`).

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
