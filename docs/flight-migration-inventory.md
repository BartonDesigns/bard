# Bard flight preservation and Crysis migration inventory

Audited 3 October 2026. Baseline: `8936385168b9f88e1e323aa14a5cbc2fadfde550`. Companion: [`flight-migration-catalog.json`](flight-migration-catalog.json).

## What this protects

The flight build is a musical universe, not just a space camera. Keep its worlds, lore, discoveries, people, saved progress and two-way relationship with the faceplate while replacing the rendering and travel machinery. This inventory is a migration contract, not a claim that every retained feature is currently reachable or has been tested.

The default build already routes planet landings into Crysis (`index.html`, `island-landing227`). Most old surface mechanics are still present in the packed JavaScript but bypassed unless `_V1_SURFACES` is enabled. A feature surviving in the file is not proof that the player can still use it.

This branch adds a native surface-to-atmosphere-to-orbit shell under `island/src/space/`, retaining the current world and input. It does **not** replace the legacy galaxy. The separate **Explore galaxy** path remains while the feature inventory is migrated and verified. No full flight replacement is ready merely because ascent looks seamless.

The implementing agent verified the Earth round trip in the browser: the same world/context survives, no loading overlay appears, the return uses the exact departure x/z, and no page/shader errors occur. Camera orientation and momentum remain controllable through frame rotation. See `island/ORBITAL-FLIGHT.md` for the test scope and real-device checks still needed. This is a retained local ground patch under a coarse orbital globe, not yet a fully spherical streamed terrain mesh.

## Scope and evidence

Read the actual gzip-decoded flight source (5,282,083 bytes; 69,103 lines), all six decoded world-core strings (1,074,285-byte JSON package), the site’s runtime patch layers, `HANDOFF.md`, `island/README.md`, and the Crysis module tree. Named anchors and decoded line numbers are in the catalog; gzip source line numbers refer to its decompressed text. The catalog includes exact authored JavaScript tables, not rewritten lore.

The fetched graph contains 621 reachable commits, 14 May–3 October 2026. The historical scan considered **227 flight/index revisions**, read **225 distinct file blobs** and decoded **143 distinct flight payloads**, including gzip-in-base64, with **zero decode errors**. It recovered **72 historical-only named symbols** and compared **28 changed authored-table versions**, preserving **56 historical-only string values**. Every payload is identified by commit, path, blob and decoded SHA-256 in the JSON. Work never committed, inaccessible private branches, or files absent from Git cannot be certified from this repository.

## Non-negotiable release gates

1. **No feature disappears by omission.** Every active feature below needs a disposition: migrated and tested, temporarily reachable through the retained legacy path, or explicitly retired by a product decision. A generic visual substitute does not count.
2. **One continuous local flight.** Keep renderer, player, input, velocity, world identity and audio through ascent/descent. Reverse direction at any altitude. Return to the captured exit point with uninterrupted controllable orientation without a loading room, canned camera, new spawn, or input pause.
3. **Keep the galaxy available.** Until galaxy generation, navigation, stars, anomalies, stations and narrative progression pass parity, retain the old space build and make the boundary explicit. Do not describe a single orbital globe as the rebuilt universe.
4. **Music changes the world.** Verify real synth, DJ and microphone input; note-on/hold/release; tempo/scale/lead selection; nearby flora movement; animal behavior; playable surfaces; collision-generated notes; busking/bonding and song requests. Band-driven glow alone fails parity.
5. **Save identities survive.** Never use a transient planet-pool index as identity. Preserve galaxy/system/body identity, type, raw seed, palette, generated surface seed, discoveries, homes, NPCs, quests and the exact local exit anchor. Preserve old keys until migration succeeds and is recoverable.
6. **Mobile performance is measured.** Test multiple warm round trips, rapid reversals, low/high altitude, another planet, context loss and sustained music on an actual phone. Track resource counts, input latency and frame time; software-renderer smoke checks alone do not prove device performance.
7. **No old loading illusion.** A steerable loading-room shader still replaces the playable world. It may serve cold boot or the retained inter-engine boundary, but it is not seamless local ascent.

## Canon and authored content retained

| Collection | Exact content found | Source anchor |
|---|---:|---|
| `LORE_FRAGMENTS` | 33 Pelagic Void / Bathyal Epoch whispers | decoded flight:7656 |
| `CODEX_VERSES` | 38 original canon verses | decoded flight:7694 |
| `MISSING_CODEX` | 100 recoverable fragments, Books LXXVIII–CX | decoded flight:7753 |
| `WAR_CHRONICLES_ORDER` | 13 Order war chronicles | decoded flight:7942 |
| `WAR_CHRONICLES_VOID` | 13 Void war chronicles | decoded flight:7957 |
| `FACTION_LEADER_LORE` | 18 total leader and neutral audience passages | decoded flight:48892 |
| `_SURF_LORE` | 16 shore, vantage, wilds and night fragments | decoded flight:9695 |
| `CREEDS` | 7 creeds, including Reedfolk | decoded flight:67162 |
| `THREADS` | 6 biography threads; 12 subject substitutions | decoded flight:67172 |
| `MOVEMENTS` | 4 Long Chord movements | decoded flight:8208 |
| `BEATS` | 6 Final Cadence beats | decoded flight:8215 |
| `PLANET_PALETTES` | 30 palettes, including 2 primal variants | decoded flight:9032 |
| `STAR_TYPES` | 10 stellar classes | decoded flight:11723 |
| `REAL_STAR_NAMES` | 171 named-star entries | decoded flight:11746 |
| `GALAXY_TYPES` | 8 galaxy morphologies | decoded flight:11809 |
| `_ST_TYPES` | 3 galactic station types | decoded flight:9316 |

The fictional cosmology includes the Architect/Geometrician, First Point, Hidden Matrix, Zero-Point/Divine Sanctuary, Theron the Mason, Lyra the Weaver, Long Chord, Coda, Reedfolk, Dissonant and Conductor. The Pelagic Void strand includes the Bathyal Epoch, Architeuthis Architects and Drowned Sectors. These are authored game lore. A label mentioning a system or capability does not establish that gameplay exists.

The endgame sequence is First Bar → Movements → Coda → Last Bar/Threshold → Pupil → Zero-Point → Rest or Sustain. The exact authored lines, conditional sequence and recursion implementation are preserved in the JSON. The legacy face-change call is optional, and its adapter must be checked before treating soundtrack switching as working behavior. Regions must continue to respect the current faceplate.

## Planet type contract

| Legacy identity | Retained meaning | Crysis coverage / unresolved difference |
|---|---|---|
| TERRAN | Green worlds, jungles, grasslands, savanna, rust terrain; two primal palettes | Highland/temperate profile; some seeds route to MEDIEVAL. Keep primal and civil-world identity explicit. |
| OCEAN | Oceans, lagoons, abyssal water, shores and marine life | Atoll/tropical profile with caves and stilt/coral settlements. Underwater and world-scale water parity still requires comparison. |
| MAGMA | Volcanic ground and lava | Volcano profile and eruptions. This is not automatically parity with landable stellar photospheres. |
| ICE | Glacial ground, cold sky, aurora | Glacier/boreal profile, ice caves and snow. Distinguish ice giant identity from solid ice world. |
| ARID | Deserts, mesas, dunes, sparse life or barren surfaces | Mesa profile, oasis alternate biome, sandstone/adobe structures. Preserve dead versus living desert diversity. |
| TOXIC | Acid color families, swamp, fungal life and hostile-looking air | Swamp/fungal profile with rust/bunker architecture; actual hazard mechanics need independent evidence. |
| GAS | Giant atmosphere with cloud immersion and floating stations | Current profile is a **moon of a gas giant**. Both experiences must remain distinct and reachable. |
| MYSTICAL | Fae palettes, castles, crystals and fantastical creatures | Enchanted profile, fae structures and crystal caves. Keep separate from medieval castles. |
| SHEPHERD | Ringed/special world; two orbit palettes | TERRAN-derived ringed profile. It is missing from the old terrain-index array, so do not use array indices as type IDs. |
| SINGULARITY | Dark-star/black-hole-associated world | MYSTICAL-derived profile. Black-hole traversal and Final Cadence remain separate systems. |
| BAYAREA / Earth | Sol Earth with real location identity | Crysis Earth supersedes V1 Bay. Preserve latitude/longitude and exit location; do not generate a new tropical island on return. |
| Primal flag | Dinosaur-rich variants of TERRAN | Crysis `isWildWorld` and dinosaur roster exist; preserve the flag through descriptors instead of relying on generic TERRAN fallback. |
| Stellar surface | Landable photosphere, magma ocean, class-dependent heat/color effects | Currently routed to MAGMA by the adapter; photosphere identity requires explicit migration. |
| TROPICAL / MEDIEVAL | Crysis-specific island and castle-realm profiles | Retain both additions; MEDIEVAL includes its own quests/dungeons and is not the deleted V1 dungeon. |
| BARREN / GAS_GIANT | Crysis aliases | Both alias the GAS moon profile today; avoid claiming distinct generators. |

Space palette classification, surface shader index and Crysis profile key are three different taxonomies. `PLANET_TYPES` in V1 has 10 entries, `_PLANET_CLASS_MAP` has 9, and the Crysis profile supports additional aliases. Preserve string identities and descriptor versions across the migration.

## Feature coverage matrix

Status words refer to source evidence, not a completed device test. **Bypassed** means the old surface implementation exists but normal planetfall is redirected into Crysis. **Not migrated** means no corresponding implementation was found in the inspected Crysis modules. **Partial** means related behavior exists but parity has not been established.

### Space and navigation

| ID / feature | Legacy evidence | Crysis coverage | Required migration and test |
|---|---|---|---|
| FLT-001 **Continuous planet ascent and return** (P0) | active transfer, loading room. `dive227-code`, `island-landing227`, `L99Journey170`:949 | new orbital shell. `space/frame.js`; `space/flight.js`; `space/view.js`; `player.js`; `main.js` | Keep the same player, renderer, world and camera under a curved reference frame. Reverse at arbitrary altitude and descend to the captured exit point; no Journey handoff on this round trip. Verify forward, reverse, sideways and mobile look throughout. |
| FLT-002 **Deterministic three-dimensional star systems** (P0) | active patched legacy space. `generateSystem`:12561, `universe207-code` | not migrated. `space/view.js` | Port patched Universe207 identity and placement, not the obsolete two-dimensional cell assumptions. Revisit the same system and compare bodies, seed and positions. |
| FLT-003 **Solar system and Earth home identity** (P0) | active patched legacy space. `SOL_BODIES`:13381, `SOL_MOONS`:13408, `universe207-code` | partial shell. `space/frame.js`; `space/view.js`; `earth/globe.js`; `main.js` | Preserve Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto and moon/ring descriptors; Earth's real globe location remains distinct from procedural world seeds. |
| FLT-004 **Planet appearance and palette families** (P1) | active legacy space. `PLANET_PALETTES`:9032, `buildPlanets`:10876, `_applyPlanetClass`:13620, `celestial205-code` | partial shell. `planet/profile.js`; `space/view.js` | Preserve 30 palettes, clouds, storms, rings, ice caps, city lights, ocean glints, relief, atmosphere and optical silhouette. Compare fixed seeds from orbit and ground. |
| FLT-005 **Ten stellar classes and named stars** (P1) | active legacy space. `STAR_TYPES`:11723, `REAL_STAR_NAMES`:11746, `buildSystemStar`:11855, `celestial205-code` | not migrated. `space/view.js`; `world/sky.js` | Preserve all 10 classes, the 171-name lookup, class-dependent corona/photosphere and giant-to-dwarf hierarchy. Earth astronomy is a separate sky contract. |
| FLT-006 **Eight galaxy morphologies and musical names** (P0) | active patched legacy space. `GALAXY_TYPES`:11809, `galaxyName`:11826, `galaxies209-code`, `galaxies210-code` | not migrated. `space/view.js` | Preserve spiral, barred, elliptical, lenticular, irregular, ring, dwarf spheroidal and starburst volumes; Home Spiral and deterministic names; rendered target shape must match destination. |
| FLT-007 **Continuous intergalactic flight** (P0) | active replacement patch. `galaxies209-code`, `galaxies210-code` | not migrated. `space/flight.js` | Preserve fixed world-space galaxy centers, full-throttle crossing, target acquisition and fades. Old timed jump and camera-tethered galaxies are superseded; do not reinstate them. |
| FLT-008 **Star impostors, dust and far-to-near handoff** (P1) | active patched legacy space. `buildGalaxyImpostors`:12961, `_buildNeighborStars`:13123, `_updateNeighborStars`:13151, `universe207-code`, `galaxies210-code` | partial orbital backdrop. `space/view.js` | Match directional continuity and star identity as impostors become actual systems; no grid, abrupt scale pop or camera-following destination. |
| FLT-009 **Aeon sky and previous-universe traces** (P2) | active source, visual reachability unverified. `buildAeonSky`:3229, `_aeonKeyNow`:3214 | not migrated | Preserve authored previous-aeon visual layer and deterministic key; test that it renders in its intended conditions, rather than infer physics from lore. |
| FLT-010 **Nebula layers and galactic dust** (P1) | active legacy space. `buildMilkyWay`:3289, `buildSpaceNebulas`:3422, `_buildNebulae`:12884, `_spawnWispNebulae`:9279 | partial orbital backdrop. `space/view.js` | Retain large galaxy dust lanes, local wisps, deep-space volumes and no hard far-plane cut; budgets scale by device. |
| FLT-011 **Comets and asteroid belts** (P1) | active legacy space. `_spawnComets`:12724, `_spawnAsteroidBelt`:12786 | not migrated | Preserve eccentric comet motion/tails and seeded debris belts; demonstrate traversal without collision traps or unbounded objects. |
| FLT-012 **6DOF movement and inertia** (P0) | active legacy space. `installFlightControls`:2227, `shipQuat`:1106, `shipVel`:1107, `_autoFlightSpaceTick`:1210 | partial new shell. `player.js`; `space/frame.js`; `space/flight.js` | Retain quaternion steering, velocity, throttle and manual takeover; native shell must remain responsive at arbitrary altitude. Space control parity remains pending. |
| FLT-013 **Cruise, boost and auto-level** (P0) | active legacy space. `THROTTLE_MIN_PCT`:1100, `setAutoFlight`:1163, `autoLevelShip`:1311 | partial new shell. `player.js`; `space/flight.js` | Preserve cruise intent, throttle ramp, boost and recoverable upright orientation; manual input immediately overrides assistance, and AUTO avoids unselected bodies. |
| FLT-014 **Scan, NAV, lock, warp and orbit** (P1) | active legacy space. `renderNavTargets`:8777, `enterScanMode`:66625, `tryLockOnPlanet`:13980, `startWarpTo`:14008, `toggleOrbitMode`:66398, `_orbitYield`:66726 | not migrated beyond shell HUD. `space/flight.js` | Preserve explicit target/approach intent, scan camera versus ship heading, orbit yielding to input, target distance and tap-card hit area. |
| FLT-015 **Space streaks, exhaust and ship feedback** (P1) | active legacy space. `buildStarStreaks`:3111, `updateStarStreaks`:3144, `updateEngineParticles`:31259, `_cockpitFrameTick`:56920 | partial new shell. `space/view.js` | Preserve speed legibility, audio response and comfort controls without forcing camera shake or recreating deleted ship interiors. |
| FLT-016 **Planets, star surfaces and black-hole body entry** (P0) | patched to Crysis by default. `checkPlanetCollisions`:14641, `_starLandTarget`:14738, `_blackHoleLandTarget`:14801, `island-landing227` | semantic mismatch. `planet/profile.js`; `planet/volcano.js` | A star's molten photosphere is currently mapped to a MAGMA ground world; a black-hole target maps to SINGULARITY. Record and resolve these distinct experiences explicitly before replacement. |
| FLT-017 **Central Gargantua black hole** (P0) | active legacy space. `createGalacticGargantua228`:5134, `triggerBlackHoleEvent`:6865, `runtime/gargantua228.mjs` | not migrated | Retain supplied Schwarzschild renderer, central location, lensing/disk/photon ring, entry behavior and mobile 200/desktop 320 step budgets; never double-lens it. |
| FLT-018 **Black-hole passage and galaxy exit** (P1) | active patched source. `updateBlackHoleVisualizer`:6898, `_exitBlackHole`:6955, `galaxies209-code` | not migrated | Preserve passage effects and return control. Patch209 keeps wormhole travel within the same galaxy; do not resurrect the older automatic galaxy increment. |
| FLT-019 **Seven rare space anomaly kinds** (P1) | active legacy source. `buildPhobiaEncounters`:6089, `KIND_DISPLAY`:8764 | not migrated | Preserve Titan, Swarm, Scaffold, World-Eater, Sub-Glacial, Dyson and Singing Singularity builders and discovery. Current selection uses Date.now despite a seeded comment; choose stable IDs deliberately. |
| FLT-020 **Megastructure landing and walking** (P1) | active legacy space path. `phobiaLandingSurface`:6223, `updateMegastructureLanding`:6320, `updateMegaWalk`:6488, `liftoffFromMegastructure`:6656 | not migrated | Preserve oriented surface normals, tangent movement, hover/walk heights and liftoff for supported shapes. Do not flatten these into standard planets. |
| FLT-021 **Alien space serpent and surface serpent riding** (P1) | space active, surface portion bypassed. `buildAlienSnake`:4390, `updateAlienSnake`:4443, `buildSurfaceSnake`:4224, `updateSurfaceSnake`:4269, `SNAKE_PLANET_LINES`:4179 | not migrated | Preserve following, dialogue, ride request, mounted steering and surface-to-space takeoff identity; verify dismount and camera freedom. |
| FLT-022 **Faction fleets and space combat** (P1) | active legacy space. `buildFactionShips`:7129, `updateFactionShips`:7240, `_spawnFactionBeam`:7171, `_spawnFactionExplosion`:7201 | not migrated | Retain Order/Void patrol/interception, firing, debris and bounded respawn; validate lifetime caps and allegiance interactions. |
| FLT-023 **Three galactic station types** (P1) | active legacy space. `_ST_TYPES`:9316, `spawnGalacticStations`:9317, `_stBuildDeck`:9424, `_stToggleDock`:9645 | not migrated | Preserve Ring, Spire and Hub Freighter, walkable interiors and station rotation freezing while aboard; retain saved ship pose on undock. |
| FLT-024 **Quartermasters, cargo runs and ranks** (P1) | active station source. `_stationTick`:10652, `_cargoMission`:10727 | not migrated | Preserve crate pickup/delivery, express contracts, run count and title thresholds; carry mission and station IDs across streaming. |
| FLT-025 **Research outpost network** (P1) | implemented local quest foundation. `_RESEARCH_FIELDS`:9569, `_researchEstablish`:9585 | not migrated | Retain four themed research fields and four-outpost completion ceremony. This is a local game quest, not actual scientific computation; 3D expansion was only a future note. |

### Lore, quests and persistent progress

| ID / feature | Legacy evidence | Crysis coverage | Required migration and test |
|---|---|---|---|
| FLT-026 **Pelagic Void / Bathyal Epoch canon** (P0) | active legacy space lore. `LORE_FRAGMENTS`:7656, `updateLoreSystem`:8709 | not migrated. `guide/guide.js` | Preserve all 33 exact whispers and their pacing, Architeuthis Architects, Drowned Sectors, cosmic ocean/plankton/tides and interrupted construction. New guide prose is not a substitute. |
| FLT-027 **Codex of the Architect original canon** (P0) | legacy surface implementation bypassed. `CODEX_VERSES`:7694, `CODEX_BOOKS`:55058, `SCALE_TO_BOOKS`:55071 | not migrated. `guide/guide.js` | Preserve all 38 authored verses, 11 book group mappings and scale-based selection; do not renumber index-based collected progress. |
| FLT-028 **100 Missing Codex fragments** (P0) | legacy surface implementation bypassed. `MISSING_CODEX`:7753, `codexEntryForSeed`:7891, `_buildCodexShrine`:8032, `_codexShrineTick`:8060 | not migrated. `guide/guide.js`; `planet/medieval/quests.js` | Retain Books LXXVIII–CX, deterministic assignment, scan reveal, walk-to-shard collection, shrine, fanfare, reader and NPC reuse; migrate indices to stable fragment IDs losslessly. |
| FLT-029 **Order and Void doctrine** (P0) | space/surface split. `WAR_CHRONICLES_ORDER`:7942, `WAR_CHRONICLES_VOID`:7957, `ALLEGIANCE_VERSES`:48846, `ALLEGIANCE_HOSTILE_LINES`:48872, `FACTION_LEADER_LORE`:48892 | not migrated. `people/persona.js` | Preserve 13 chronicles per side, greeting/hostility variants, 18 leader/neutral audience lines and allegiance cooldown; generic NPC conversations do not cover doctrine. |
| FLT-030 **Faction capitals, fronts and persistent war** (P1) | legacy surface implementation bypassed. `setPlayerAllegiance`:48924, `spawnShelters`:47697, `_makeCapital`:49809, `_makeBattleBorder`:52644, `updateLeaderAudiences`:55302 | not migrated. `planet/alien.js`; `planet/medieval/realm.js` | Preserve capital audiences, faction identity, ruined/standing settlements and per-world war state; no random reset on re-entry. |
| FLT-031 **Long Chord / Reedfolk / Coda arc** (P0) | implemented legacy space path. `_buildTesseractPanels`:5515, `CREEDS`:67162, `MOVEMENTS`:8208, `BEATS`:8215, `_FinalCadence`:5697 | not migrated | Preserve First Bar, four Movements, Coda, Dissonant, Last Bar, Pupil, Zero-Point, Architect and Conductor reveal. Reproduce actual triggers, not just lore labels. |
| FLT-032 **Final Cadence choice and recursion** (P1) | implemented, effects require verification. `_FinalCadence`:5697, `_applyCanonReopen`:8254, `_placeRecursionPupil`:8264, `_buildGodWorld`:8261 | not migrated | Preserve Rest versus Sustain and visible outcome; legacy comments disagree on 8x versus 200x. Verify actual scale implementation and optional face-selection hook before claiming parity. |
| FLT-033 **Black-hole cavern quest** (P1) | implemented first-stage path. `_buildCavern`:5738, `cockpitAnimate`:61307 | not migrated. `planet/underworld.js` | Preserve descent, dark mass, crystal cavern and pupil route; a separate later Stage-2 hook is only a placeholder and must stay labeled as such. |
| FLT-034 **Shore, summit, wild and night field lore** (P1) | legacy surface implementation bypassed. `_SURF_LORE`:9695, `_surfLoreTick`:10103, `_RGLORE`:17262 | not migrated. `region/landmarks.js`; `guide/guide.js` | Preserve 16 location-sensitive fragments and eight region-lore templates. Never present the fictional cosmology as real astronomy. |
| FLT-035 **Persistent folk creeds and biographies** (P0) | legacy surface implementation bypassed. `CREEDS`:67162, `THREADS`:67172, `THREAD_T`:67186, `NAMES_A`:67158, `REED_NAMES`:67160 | new people, no old identity migration. `people/persona.js`; `people/body.js` | Preserve six settlement creeds plus Reedfolk, 24 first-name parts/20 suffixes/10 Reed names, temperaments and six life threads with 12 subjects; map old deterministic identity IDs to new actors. |
| FLT-036 **NPC memory, relationships and chronicles** (P1) | legacy surface implementation bypassed. `MEM_KEY`:67215, `PAIR_BASE`:67342, `NEWS_WED`:67377, `NEWS_RIFT`:67381, `NEWS_RECON`:67385, `DEED_LINES`:67640 | partial new personas. `people/persona.js`; `guide/guide.js` | Retain meeting/disposition, music/build/riding deeds, friend confidences, weddings/rifts/reconciliations and long-absence drift from l99npc1. Do not silently reset reputation. |
| FLT-037 **Listening gardens and stone choir** (P0) | implemented core, patched journal. `L99Explore175`:529, `L99TouchMusic175`:1029, `quests217-code` | separate Crysis music minigames. `music.js`; `games/stones.js`; `games/morse.js` | Preserve five stones and phrase 1-3-5-3-1, clear near/raycast eligibility, label tap assist and restoration; active patch keeps progress on wrong notes and removes timeout. |
| FLT-038 **Echo journey and keeper links** (P1) | implemented /caves neighbor path. `quests217-code`, `L99Journey170`:949 | separate Crysis caves and quests. `planet/underworld.js`; `planet/medieval/quests.js` | Preserve learn/ascend/weave, collected echoes and keeper completion through shared choir; do not revive duplicate Field Journal panels or old timed reset semantics. |
| FLT-039 **Material survey and music activities** (P1) | active shared quest patch for legacy realms. `quests217-code`, `expedition216-code`, `L99Band166`:431 | partial playable surfaces. `music.js`; `games/index.js` | Preserve stone/wood/crystal survey, orchestra participation, trail guidance and explicit activity selection in one journal; adapt realm island instead of leaving flight-only gates. |
| FLT-040 **Deep species observation and discovery** (P1) | legacy surface implementation bypassed. `_scanKnowledge`:18360, `_majorDiscovery`:19141, `_revealDiscovery`:19105 | partial field guide. `nature/fieldguide.js`; `crysis/ecology.js`; `crysis/land.js` | Preserve five evidence tiers: silhouette, anatomy, diet, behavior and food-web role, observed feeding/fleeing and species-specific findings; migrate per-seed catalogue. |
| FLT-041 **Animal and townsperson bonding** (P1) | legacy surface implementation bypassed. `_bondBook`:18387, `_bondCrowdAgent`:18685, `_bondFleeSuppressed`:18581, `_bondFriendLore`:18656 | not migrated. `people/persona.js`; `crysis/landfauna.js` | Preserve persistent names, trust 30/60/85, companions, guardians, summon/whistle, music/feeding trust and friend-shared observations; prove revisit recognition. |
| FLT-042 **Busking and universal renown** (P0) | legacy surface implementation bypassed. `_songTick`:18189, `_RENOWN_TIERS`:18769, `_renownLoad`:18479, `_renownAdd`:18139 | not migrated. `music/automusic.js`; `people/actions.js` | Preserve audience gathering, stranger/busker/songsmith/bard/legend thresholds 0/20/45/75/100, tune recognition and max-merge of old per-world renown. |
| FLT-043 **Song requests and booked sets** (P0) | legacy surface implementation bypassed. `_REQ_MOODS`:18816, `_songReqTick`:18856, `_songGig`:18829 | not migrated | Preserve bright/dark/warm/wild requests, actual faceplate recognition, listening-duration reward, deadlines and booked-location sets; do not count silence as performance. |
| FLT-044 **Bookmarks, share URLs and return poses** (P0) | active but destination conversion incomplete. `bookmarkCurrentLocation`:66778, `teleportToBookmark`:66841, `expedition216-code`, `island-landing227` | independent save/share system. `share.js`; `storage.js`; `space/frame.js` | Convert legacy seed/type/face/location links and 160-place/120-visit notebook without dropping coordinates. Keep local exit anchor separate from the global body ID. |
| FLT-045 **Save/export/import/cloud hook** (P0) | implemented legacy settings. `saveCockpitState`:31804, `loadCockpitState`:31816, `BOOKMARKS_KEY`:66763, `expedition216-code` | partial: versioned body descriptors in Crysis homes/share/resume; full legacy progress migration pending. `space/body.js`; `share.js` | Preserve old key names and versioned imports; optional user-configured cloud URL is an old hook, not a newly authorized service. Test failed/full storage without destructive overwrite. |
| FLT-046 **Fossils and relics** (P1) | legacy surface implementation bypassed. `_fossilSites`:17050, `l99_fossils`:21246, `l99_relics`:60028, `L99Dig172`:1056 | partial new collections. `surprises.js`; `planet/medieval/quests.js` | Preserve Chord fossil discovery, relic counts and excavation finds. Match by stable discovery ID rather than nearest random replacement. |

### Planet surfaces and built worlds

| ID / feature | Legacy evidence | Crysis coverage | Required migration and test |
|---|---|---|---|
| FLT-047 **Seeded planetary terrain and continental biomes** (P0) | legacy surface implementation bypassed. `_terrainBaseH`:20093, `_BIO_DEFS`:17354, `surfaceHeightAt`:27579, `_ECO_TYPE_BASE`:17372 | broad implementation, different generator. `world/islandgen.js`; `planet/profile.js`; `planet/biomes.js` | Preserve type semantics and desert/jungle/marsh/forest/grass/alpine/marine diversity; do not claim identical geography under a different seed algorithm. Saved places need explicit conversion. |
| FLT-048 **Hydrology, lakes, cross-chunk rivers** (P1) | legacy surface implementation bypassed. `_bakeHydrology`:20291, `_hydroBuildNetwork`:20404, `_ensureWatershedNetwork`:36487, `L99Waters170`:1310 | implemented alternative. `planet/waters.js`; `crysis/hydro.js`; `crysis/rivers.js`; `bay/water.js` | Verify downhill drainage, continuous river geometry, lake levels and matching collision/water queries across tile and orbit re-entry. |
| FLT-049 **Ocean, foam, reflections and underwater optics** (P1) | legacy surface implementation bypassed. `_updateWaterReflections`:23556, `_updateWaterRefraction`:23517, `_uwBuild`:22942, `waters227` | implemented alternative. `world/ocean.js`; `underwater.js`; `reef.js`; `sealife.js` | Retain coast foam, refraction/reflection, depth absorption, caustics, reefs and swim/dive interaction; no water sheet through land/caves. |
| FLT-050 **Surface weather and four cloud regimes** (P1) | legacy surface implementation bypassed. `_cloudProfileFor`:43813, `_spawnVolumetricClouds`:43840, `_weatherTick`:40627, `_weatherAudioTick`:40669 | implemented alternative. `world/weather.js`; `world/sky.js` | Preserve cumulus/stratus/cirrus/storm identity, rain/snow, lightning/thunder, wetness, puddles, fog and weather-driven fauna; fade continuously with altitude. |
| FLT-051 **Day/night, stars, moon and aurora** (P1) | legacy surface implementation bypassed. `DAY_CYCLE_DURATION`:15759, `_spawnCelestials`:43489, `_spawnStars`:43469, `_spawnAurora`:40727 | implemented and expanded Earth astronomy. `calendar.js`; `world/sky.js`; `world/starcat.js`; `region/ice.js` | Keep procedural planet cycles distinct from true Earth date/location sky. Verify night visibility, luminaries, aurora and seasonal controls survive orbit return. |
| FLT-052 **One observer-relative rainbow** (P2) | legacy surface implementation bypassed. `SURF_RB_COUNT`:14850, `_spawnSeaSpray`:40301 | implemented alternative. `world/rainbow.js` | Preserve a single view-relative refractive rainbow, tied to light/moisture; confirm no duplicate fixed rings. |
| FLT-053 **Procedural flora collection and habitat distribution** (P1) | legacy surface implementation bypassed. `buildFloraSpecies`:27609, `_floraCommunity`:27401, `_floraSpeciesPatch`:27369, `L99Trees127`:78 | partial alternative collection. `world/vegetation.js`; `nature/plants.js`; `region/flora.js`; `crysis/land.js` | Preserve all species keys listed in catalog, climate/elevation/habitat constraints, rare fantastic species and near/far LOD. Similar generic trees are not species parity. |
| FLT-054 **Rock formations and ground detail** (P1) | legacy surface implementation bypassed. `_HERO_FORMS`:29068, `_heroPlaceInChunk`:29183, `_heroRegisterCollider`:29336, `_spawnGroundStones`:43545 | implemented alternative. `nature/rocks.js`; `world/terrain.js`; `bay/diablo.js` | Retain arches, stacks, mesas, hoodoos, fins, boulders/scree, weathering and climbable collision; tiny pebbles remain cosmetic. |
| FLT-055 **Mystical castles and creatures** (P1) | legacy surface implementation bypassed. `_spawnMysticalWorld`:37202, `_makeMysticalCastle`:37176, `_makeMysticalBeing`:37186 | partial alien/medieval alternative. `planet/aliencivs.js`; `planet/medieval/realm.js` | Preserve fae architecture, crystal structures and authored creature roles; separate MYSTICAL from MEDIEVAL rather than conflating them. |
| FLT-056 **Gas giant cloud immersion and floating decks** (P0) | legacy surface implementation bypassed. `_spawnGasClouds`:14464, `_buildGasInterior`:14608, `_ensureGasStations`:23656 | replaced by moon semantics. `planet/profile.js` | Retain direct cloud flight and gas-deck stations as distinct locations; a rocky gas-giant moon does not replace either. |
| FLT-057 **Molten sun/star ground** (P1) | legacy surface implementation bypassed. `_ensureMagmaSpires`:57623, `_ensureMagmaBubbles`:57739, `_starLandTarget`:14738 | volcanic planet alternative only. `planet/volcano.js`; `magma.js` | Preserve star-colored lava oceans, magma spires, bubbles, arcs and stellar class-specific color/speed; do not label a terrestrial volcano as photosphere parity. |
| FLT-058 **Surface caves and walkable passage** (P0) | legacy surface implementation bypassed. `spawnCaves`:35563, `ensureFlightDoors170`:69007, `flightEnterCave170`:69018, `L99CaveOpenings171`:1143 | implemented alternative. `planet/cavenet.js`; `planet/underworld.js`; `planet/caveruins.js`; `planet/cavevillage.js` | Preserve entrance position, seed, ruin/village identity, light at exits, safe headroom, and same-world return. Shared V1 /caves is separate from native caves. |
| FLT-059 **Digging, terrain deformation and buried finds** (P1) | legacy surface implementation bypassed. `L99Dig172`:1056, `flightDigDirtySite172`:69057, `flightDigId172`:69054 | not migrated as same mechanic. `planet/cavenet.js` | Preserve persistent excavation shape, reservations, cave opening, water exclusion, collision and buried relics; retain round-trip portal position. |
| FLT-060 **Construction and persistent snapped pieces** (P1) | legacy surface implementation bypassed. `_buildPlace`:44961, `_buildSnapTarget`:44859, `_buildAutoSave`:44981, `_buildRestoreForSeed`:44989 | not migrated. `interiors/` | Preserve walls/floors/ramps, snap, rotate, remove, standable floors, collisions and l99_build_ seed records. Procedural houses are not player construction. |
| FLT-061 **Plot home crafter and homestead planning** (P1) | legacy surface implementation bypassed. `_plotTap`:10337, `_plotTap`:10337, `homestead`:39667 | separate home bookmarks only. `share.js`; `interiors/cottage.js` | Preserve two-corner plot, deterministic house/garden/fence and persisted ownership; Crysis home coordinate markers are not a home-building tool. |
| FLT-062 **Village, town, city, capital and ruins** (P1) | legacy surface implementation bypassed. `_makeVillage`:49286, `_makeTown`:49727, `_makeCapital`:49809, `_ruinSettlement`:49897, `CITY_ARCHETYPES`:48319 | broad newer civilization. `crysis/civgen.js`; `planet/alien.js`; `planet/medieval/realm.js`; `region/settle.js` | Map each settlement tier and four old city archetypes explicitly, including cyber city, magical spires, industrial crucible and medieval citadel. Keep lore/faction sites stable. |
| FLT-063 **Dense suburbs and rural scatter** (P1) | legacy surface implementation bypassed. `_spawnCityHalo`:45605, `_spawnRuralScatter`:39655, `_makeMarket`:49665 | implemented alternative. `crysis/civgen.js`; `bay/realcity.js`; `bay/houses.js`; `bay/edgelands.js` | Preserve duplexes, townhouses, courts, driveways, yards, fences, pools, sheds, garages, mailbox/street furniture and market life through a visual/interaction checklist. |
| FLT-064 **Roads, bridges, interchanges and traffic** (P1) | legacy surface implementation bypassed. `_ribbonBuild`:50578, `_ribbonSupports`:50656, `_roadSigns`:51050, `_spawnSuburbTraffic`:47263, `_updateSuburbFleet`:47389 | implemented and expanded. `bay/realcity.js`; `bay/freeways.js`; `bay/streetlife.js`; `vehicles/` | Preserve grades, bridge decks, ramps, lane signs/paint, right-lane flow, yielding and pedestrian crossing; no hover roads or crossing overlaps. |
| FLT-065 **Buildings and anomaly interiors** (P1) | planet portion bypassed, anomaly portion remains. `_buildInteriorRoom`:41041, `_doorScout`:43358, `_enterBuilding`:41728, `_boardAnomaly`:41805 | implemented buildings, no space boarding equivalent. `interiors/index.js`; `interiors/alien.js`; `bay/houses.js` | Keep enterable rooms/furniture/door collisions and anomaly/wreck access separate; preserve interiors actually supported by each body type. |
| FLT-066 **Harbors, coastal structures and shipping** (P2) | legacy surface implementation bypassed. `_spawnHarbors`:44307, `_spawnCoastalStructures`:44155, `_spawnSettlementShipping`:44653, `_spawnWatercraft`:40083 | partial alternative. `boat.js`; `bay/wharf.js`; `world/boatmodel.js` | Retain piers, beaches, harbors, boats/canoes and inter-settlement routes; test docking/boarding, water-following and open navigation. |
| FLT-067 **Aircraft, contrails and meteor sky life** (P2) | legacy surface implementation bypassed. `_spawnAircraft`:40158, `_updateContrails`:21756, `_spawnMeteors`:40543 | partial world sky. `world/sky.js`; `surprises.js` | Preserve appropriate aircraft routes, contrails, meteor frequency and draw-distance behavior; no aircraft stationary at eye level. |
| FLT-068 **Surfing, swimming, underwater return** (P1) | legacy surface implementation bypassed. `_surfTick`:23158, `_surfEndRide`:23456, `_uwTick`:23086, `_swimSurfaceBtn`:22916 | implemented alternative. `player.js`; `underwater.js`; `games/surf.js` | Preserve catchable wave sets, ride/dismount, dive and explicit return-to-surface control; verify camera never traps below terrain. |
| FLT-069 **Fishing and treasure catches** (P1) | legacy surface implementation bypassed. `L99Fishing170`:1035, `flightWaterAt170`:27581 | independent fishing implementation. `fishing.js`; `bay/lake.js` | Preserve water habitat, cast/bite/strike/reel loop, species/catch records and rare treasure IDs; demonstrate progression mapping, not only a visible rod. |
| FLT-070 **Bay Area and authored coastal landmarks** (P1) | deliberately replaced V1 Earth. `_bayBuildLandmarks`:27183, `_bayAreaHeight`:26538, `_bayBuildDrivable`:25471, `island-landing227` | implemented and expanded. `bay/`; `earth/`; `region/` | Keep Crysis Earth as authority, retaining Golden Gate, San Francisco, East Bay, Mt Diablo and Santa Cruz intent. Do not restore the obsolete compressed Bay terrain. |

### Creatures and inhabitants

| ID / feature | Legacy evidence | Crysis coverage | Required migration and test |
|---|---|---|---|
| FLT-071 **Ecological profile and twelve food-web roles** (P1) | legacy surface implementation bypassed. `_ECO_TYPE_BASE`:17372, `_NICHE_ROLES`:17464, `_foodWeb`:17484 | implemented alternative. `crysis/ecology.js`; `crysis/land.js` | Preserve environmental constraints, trophic relationships, generated species names, producer/decomposer through migratory roles; inspect fixed-seed food webs. |
| FLT-072 **Procedural fauna body grammar** (P1) | legacy surface implementation bypassed. `_faunaBody`:17649, `_ecoSkinTex`:17582, `_makeDragonBody`:17825, `L99FaunaGenome131`:72 | implemented alternative. `crysis/landfauna.js`; `crysis/fish.js`; `world/creatures.js` | Retain distinct locomotion/body plans, skin patterns, size variation and rare outliers; anatomy names in lore must match visible animals. |
| FLT-073 **Primal dinosaurs and juveniles** (P1) | legacy surface implementation bypassed. `_dinoBody`:37215, `_dinoSilhouette`:37337, `_spawnJuvenile`:37773, `L99Dinos141`:173 | implemented newer dinosaur set. `planet/dinosaurs.js` | Preserve family variety, predation/grazing, juvenile behavior, rare giants, eyes/teeth/skin/fur/feathers and believable ground contact; compare legacy species roster with seven newer kinds. |
| FLT-074 **Dinosaur, pterosaur and dragon mounts** (P1) | legacy surface implementation bypassed. `_updateDinoRide`:14216, `_updateDragonRide`:14318, `_birdPatternTick`:35300 | not verified in newer fauna. `planet/dinosaurs.js` | Preserve mount/dismount, saddle camera, ground versus air movement, bank/glide/thermal/flock return and non-stuck height; cannot infer riding from rendered dinos. |
| FLT-075 **Wild animal behavior and sensory differences** (P1) | legacy surface implementation bypassed. `updateFauna`:37819, `_discoveryTick`:18185, `_faunaSocial`:17954 | partial newer fauna. `crysis/landfauna.js`; `planet/dinosaurs.js`; `bay/wildlife.js` | Preserve feeding, flock/herd separation, shelter, night/weather schedules, predation, blind seismic behavior and high-moon territorial discoveries. |
| FLT-076 **Calls, tracks and physical presence** (P2) | legacy surface implementation bypassed. `_emitCall`:19210, `_stampTrack`:19280, `_updateFootprints`:21405, `_updateFootDust`:35522 | partial alternative. `audio/`; `bay/naturesound.js`; `main.js` | Preserve positional contact/alarm calls, fading tracks, dust, soft shadows and footsteps appropriate to ground. |
| FLT-077 **Birds, fish, marine and small life** (P1) | legacy surface implementation bypassed. `_spawnBirds`:40186, `_spawnMarineLife`:43655, `_spawnBeachEcology`:43594, `_spawnButterflies`:40559, `_spawnFireflies`:40271 | implemented and expanded. `reef.js`; `sealife.js`; `crysis/fish.js`; `crysis/inverts.js`; `nature/smalllife.js`; `bay/wildlife.js` | Preserve birds landing/perching and flock patterns; fish schools/jumps, jellyfish/corals, crabs/seaweed, butterflies/fireflies. Verify bounded pools and appropriate habitats. |
| FLT-078 **People variety and rig fidelity** (P1) | legacy surface implementation bypassed. `L99Citizens132`:127, `L99Appearance146`:2457, `L99Rare152`:499, `L99HumanRig150`:447 | implemented newer MakeHuman people. `people/body.js`; `people/hairkit.js`; `people/skin.js`; `people/wardrobe.js` | Preserve body/height diversity, rare extremes, hair/beards, skin variety, outfits and human/skeleton/other old races as explicit roster decisions; new models do not automatically cover old identities. |
| FLT-079 **Social contact, pets, combat and garments** (P1) | legacy shared implementation, reachability varies. `L99Social155`:870, `L99Contact154`:334, `L99Combat159`:431, `L99Fingers156`:400, `L99Fabric156`:376, `L99Kaykin154`:429 | partial new actions/physics. `people/actions.js`; `people/garment.js`; `people/ragdoll.js`; `vehicles/impact.js` | Catalog handshake/hug/hold-hands, pet holding, contact reactions, sit/stand/crouch/crawl, finger and garment fit before replacing old actors. Distinguish procedural animation from full rigid-body collision. |
| FLT-080 **Resident routines and functional towns** (P1) | legacy surface implementation bypassed. `L99Residents158`:500, `L99Habitat158`:1613, `L99Housing151`:260, `L99Town160`:718 | implemented alternative. `people/people.js`; `people/persona.js`; `interiors/index.js`; `vehicles/life.js` | Preserve home/work/restaurant/shop roles, doorway use, room navigation, cooking/vehicle affordances where actually implemented; verify interactions rather than comment promises. |
| FLT-081 **NPC band invitation and call-response** (P0) | legacy shared implementation for caves/flight. `L99Band166`:431, `L99Purpose166`:536, `L99Dialogue150`:784 | not migrated to island realm. `people/actions.js`; `music/automusic.js` | Preserve invitation, roles, follower positioning, recording player Lead 1 phrases, harmony/BPM/key-aware replies and stop control; expand hard-coded realm gates intentionally. |

### Music and reactive world contract

| ID / feature | Legacy evidence | Crysis coverage | Required migration and test |
|---|---|---|---|
| FLT-082 **One continuous faceplate audio context** (P0) | active shared contract. `audioBridge`:437, `L99Continuity`:652, `audio-routes223` | implemented shared bridge. `music.js`; `music/automusic.js` | Do not recreate/suspend audio when crossing atmosphere, orbit or a streaming boundary. Hold notes, sustain, sequencer and loops continuously while returning. |
| FLT-083 **Synth, DJ and microphone reactivity** (P0) | active legacy mixer, island sampling partial. `_mergeReactiveFreq`:406, `audioBridge`:437, `L99Continuity`:652 | shared synth/DJ/enabled-mic analyser merge, with frequency-aligned FFT bins; native capture/device validation pending. `music.js`; `music/performance.js` | Verify synth-only, DJ-only and mic-only input all drive the same live bands; legacy per-bin max merge plus 1.12 DJ gain must not disappear when flight is parked. |
| FLT-084 **Tempo, key, scale and lead voice identity** (P0) | active music contract. `audioBridge`:437, `_acVoice`:692, `_AC_LEAD_JOB`:685, `L99Continuity`:652 | implemented composer contract. `music/automusic.js`; `music/score.js` | Retain current faceplate, root, scale, BPM, lead trims and Lead 3's degree encoding; no world or region may silently choose another faceplate. |
| FLT-085 **Kick-propagated shockwaves** (P0) | legacy surface implementation bypassed. `_floraEnsureUniforms`:38904, `_hookFloraWaveShader`:38935, `updateFlora`:39063 | partial: bounded radial bass-attack impulses on nearby island boulders; plant shader fronts pending. `music/performance.js`; `world/vegetation.js` | Restore bounded spatial fronts from note/drum events with per-plant delay/amplitude; distinguish these from the new strike-light ripple and verify silence decay. |
| FLT-086 **Held-note rock levitation and release** (P0) | legacy shader movement bypassed. `_hookFloraWaveShader`:38935, `updateFlora`:39063 | implemented for streamed island boulders: held-voice spring lift, ballistic release/bounce, moved instance picking/shadows and vertical collision filtering; wild-country/outcrop parity pending. `music/performance.js`; `world/vegetation.js`; `player.js` | Preserve hold-to-rise and release-to-ballistic-fall/bounce. Legacy transform is visual shader displacement, not a moved collision body; decide physical collision explicitly and test both. |
| FLT-087 **BPM-locked sway and bright-note rattle** (P0) | legacy surface implementation bypassed. `_floraDominantBpm`:39047, `updateFlora`:39063 | partial band-driven vegetation. `world/grass.js`; `world/vegetation.js` | Retain strongest audible DJ/synth tempo, kick ducking, sustained canopy rattle and treble shimmer; no motion from silent noise floor. |
| FLT-088 **Terrain, water, lava and sky response** (P0) | legacy surface implementation bypassed. `updateSurface`:57928, `buildSurfaceStages170`:1791, `processAudioReactiveMaterials`:14976 | partial newer material response. `world/ocean.js`; `world/grass.js`; `planet/alienkit.js`; `main.js` | Preserve per-biome response, bass swell/lava pulse and melodic material changes without breaking terrain collision or visibility. Demonstrate same phrase on contrasting worlds. |
| FLT-089 **Space, stars, black hole and nebula response** (P0) | active legacy space. `cockpitAnimate`:61307, `updateBlackHoleVisualizer`:6898, `updatePhobiaEncounters`:7479 | partial new orbital shell. `space/view.js`; `space/flight.js` | Preserve star scintillation, photosphere, rings/grid, nebula, magnetar and Gargantua band response; native shell response is a starting subset, not galaxy parity. |
| FLT-090 **Music to actual movement and behavior** (P0) | legacy mixed visual/behavior systems. `updateFauna`:37819, `_songTick`:18189, `_bondCrowdAgent`:18685, `updateSurface`:57928 | partial: bounded orbital thrust plus opt-in flying-wildlife steering; trust and wider species behavior pending. `space/flight.js`; `crysis/landfauna.js` | Keep expressive bounded note influence on movement, nearby animals and interaction, with player steering dominant. Cap velocities, avoid forced collision and document which effects alter simulation. |
| FLT-091 **Bass attraction and treble repulsion** (P0) | opt-in legacy music mode. `updateFauna`:37819, `setMusicMode`:13604 | partial: music-mode opt-in flying wildlife responds to low/held melody and bright-energy repulsion; full grazer/ground-species parity pending. `crysis/landfauna.js`; `music/performance.js` | Preserve nearby grazers/floaters approaching bass and hoppers/birds retreating from bright energy, blended with flee/herd priorities; verify enabled/disabled semantics. |
| FLT-092 **World-shaping musical generation** (P0) | opt-in legacy music mode. `SCALE_MOODS`:13516, `FACEPLATE_AFFINITY`:13579, `_pickBiasedPalette`:13707, `_galaxyBiasPalette`:13748 | not migrated. `planet/profile.js` | Preserve scale/face weighting for unborn worlds, keep every palette reachable and visited world identity stable. Note seven newer palettes have no original PALETTE_TAGS entries. |
| FLT-093 **Scale-selected lore and remembered songs** (P1) | opt-in legacy surface feature. `SCALE_TO_BOOKS`:55071, `_pickCodexVerseForScale`:55086, `enterSurface`:56350 | not migrated. `people/persona.js` | Preserve different Codex books by scale and each world's remembered prior song; playing a phrase after returning should recall it without renaming the planet. |
| FLT-094 **Playable surfaces and strike-position pitch** (P0) | implemented shared touch contract. `L99TouchMusic175`:1029, `L99TouchMusic175`:68975, `quests217-code` | implemented. `music.js`; `pulse.js` | Preserve material-aware note mapping, continuous drag playing, per-object/instance strike position, gesture ownership and releaseAllNotes on cancel/blur; same feel on ground and in orbit UI. |
| FLT-095 **Resonance garden and kinetic instrument rigs** (P0) | legacy surface implementation bypassed. `_rgSpawn`:22296, `_rgSpawnPendulums`:21998, `_rgSpawnDominoes`:22050, `_rgSpawnChimes`:22092, `_rgSpawnCradle`:22160, `_rgSpawnDroplets`:22184, `_rgSpawnHarp`:22204, `_rgSpawnStairs`:22223, `_rgSpawnFountain`:22250, `_rgSpawnWaveBars`:22277, `_rgTick`:22473 | All ten native authored rig types; one opt-in rig per world with player controls and bounded pools. `music/kinetic-model.js`; `music/kinetic-rigs.js`; `music/kinetic-view.js`; `music/kinetic.js`; `music/kinetic-placement.js`; `main.js` | All ten authored rigs and their distinct musical event sources are present. UI provides placement/replay/stop/clear, scale/root, garden physics/drop, garden/domino cascade tempo and droplet density. Preserve the current bounded single-rig lifecycle. Multiple simultaneous rigs, saved settings/placement and legacy progression remain separate migration work; no general rigid-body or player-platform collision claim. |
| FLT-096 **Kinetic world events play the faceplate** (P0) | legacy resonance bridge. `_rgNote`:21905, `L99CaveInstrument`:572 | Native musical events from all ten rigs route through actual faceplate playLead/stopLead. `music/kinetic-model.js`; `music/kinetic-rigs.js`; `music/kinetic-view.js`; `music/kinetic.js`; `music/kinetic-placement.js`; `main.js` | Impacts, transfers, crests, gusts and periapsis crossings use owned note IDs, active faceplate scale or four authored scales, distance attenuation and timed release. Eight voices, 24 notes/second, four-note bursts; stop only owned voices. Continue native audible instrument/FX/gain acceptance. Individual-ball stereo and arbitrary world-collision sonification remain outside this bridge. |
| FLT-097 **Three-lead adaptive score and phrasing** (P1) | active legacy composer. `_acDirectorTick`:950, `_acSection`:958, `_acLoopTick`:788, `_AC_ARC_TARGET`:771 | implemented newer composer. `music/automusic.js`; `music/context.js`; `music/score.js` | Preserve melodic/pad/bass/counter/ostinato roles, phrase/bar transitions, crest/climax and breathing silence. Never stop user-owned loops; score stops only loops it owns. |
| FLT-098 **Ambient world sounds and mix respect** (P1) | legacy implementation surface bypassed. `_ambienceTick`:10188, `_faunaCall`:10156, `playFootstep`:66992, `_foleyDuckTick`:23480, `_ceremony`:8141 | implemented and expanded. `world/soundbus.js`; `audio/`; `bay/naturesound.js` | Preserve biome beds, calls, weather, footstep/collision sounds and ducking; all honor master/world sliders without feedback storms or duplicate directors. |
| FLT-099 **Psychedelic visual mode** (P1) | active patch over legacy rendering. `celestial205-code`, `perception208-code` | different mushroom experience. `planet/mushrooms.js` | Preserve recursive growth, material flow, morphing, color phases, gas-like aura and scintillation in the space renderer; mushroom onset/peak/fade is related but distinct. |
| FLT-100 **Drum-hit obstacles and tap percussion weapons** (P1) | active legacy visualizer source. `spawnObstacle`:8994, `fireWeapon`:9126, `weaponSoundForRegion`:9168, `WEAPON_POOL_SIZE`:9089 | not migrated | Preserve region-to-drum/FX mapping and finite pools where still reachable; verify active patch disables or retains mode before exposing in new flight. |

### Controls, performance and deliberate retirements

| ID / feature | Legacy evidence | Crysis coverage | Required migration and test |
|---|---|---|---|
| FLT-101 **Keyboard/touch ownership and music access** (P0) | active site contract. `L99Keyboard149`, `L99TouchMusic175`:1029, `mobile-world-js176`, `multitouch227` | implemented newer input. `player.js`; `main.js`; `drive.js` | Preserve lower-right look, simultaneous movement/music, plus/minus octaves, number-row drums and context actions; Space jump must not also trigger an unintended drum. |
| FLT-102 **Cold boot, caching and loading policy** (P0) | active loader with transitional rooms. `L99Boot176`, `room227-code`, `dive227-code` | native shell removes repeated handoff. `main.js`; `space/flight.js` | Initial engine download may still be required. Warm ascent/return must show no load room, progress screen or blocked controls; first-time remote destination streaming must remain playable. |
| FLT-103 **Streaming and generation budgets** (P0) | active legacy / newer alternatives. `updateChunks`:30677, `_flushDeferredSurfacePopulation`:34649, `flight190-code` | implemented newer budgeted systems. `bay/realcity.js`; `crysis/civ.js`; `world/shaderwarm.js`; `main.js` | Keep bounded work per frame, altitude/near-far LOD, staged population and cancelable jobs; measure frame/input latency and GPU resources on real phone. |
| FLT-104 **GPU lifecycle and context recovery** (P0) | active legacy / repaired Crysis. `setFlightResolution176`:1396, `_applyPerfTaper`:15945, `_diagShaders`:63087 | implemented resource fixes. `world/resources.js`; `world/gpulite.js`; `world/shaderwarm.js`; `main.js` | No texture/geometry growth across repeated round trips; preserve Apple light path and phone budgets; forced context restore must recover retained location and controls. |
| FLT-105 **Comfort, visibility and graphics controls** (P1) | active patches/settings. `L99World175`:960, `comfort214-code`, `look227`, `cycleQuality`:31367, `visibility211-code` | partial newer panel. `main.js`; `player.js`; `world/gpulite.js` | Retain comfort view, reduced effects, ledge guard, clear night ground, quality choices and deliberate camera control; avoid reintroducing hidden essential controls. |
| FLT-106 **Popout and VR entry** (P2) | implemented legacy capabilities. `_popOutVisualizer`:38822, `navigator.xr`:63042 | not migrated | Popout reparents the live DOM and uses main audio; independent broadcast popout comments are stale. VR session request exists but device support and feature parity require direct testing. |
| FLT-107 **Full walkable personal ship interior** (P2) | deliberately removed da079. `_buildShipInterior`:41709, `_boardOwnShip`:43260 | not a current requirement to resurrect | Archive historical bridge, studio, bunk/crew rooms, interactive helm and hull. Retain anomaly/station interiors separately; mark a restoration decision explicitly. |
| FLT-108 **Legacy voxel dungeon/combat/minimap** (P2) | deliberately removed da083. `_genDungeon`:36861, `_genGGDungeon`:36862, `_dungeon`:16135 | newer separate medieval dungeon. `planet/medieval/dungeon.js`; `planet/medieval/foes.js`; `planet/medieval/quests.js` | Archive prior roots/bone/crystal/ember/arcane themes, Coda relics/companion, doors/levers, descent/combat and minimap; no automatic restoration of removed code. |
| FLT-109 **Old timed entry and orbit-reset handoff** (P0) | superseded by requested native shell. `enterSurface`:56350, `exitSurface`:57546, `dive227-code` | replaced for local ascent/return. `space/frame.js`; `space/flight.js`; `main.js` | Keep historical evidence but retire this path for local orbit, including zeroed velocity and new spawn orientation. Explore galaxy remains an explicit separate legacy handoff. |

## Full flora roster found in the retained generator

The catalog stores a source anchor for every key. Several are geometry recipes shared with native-tree overrides, so this roster is an implementation inventory, not a claim that every plant spawns on every planet.

`mushroom`, `palm`, `crystal`, `spore`, `fern`, `pine`, `oak`, `willow`, `alien_5`, `thorn`, `bush`, `tuft`, `rock`, `boulder`, `outcrop`, `scree`, `flower`, `reed`, `clover`, `frond`, `stalk`, `succulent`, `ice_plant`, `cattail`, `welwitschia`, `lithops`, `saguaro`, `resurrection`, `queen_night`, `snake_plant`, `old_man_cactus`, `crown_thorns`, `porcupine_tomato`, `dragons_blood`, `venus_flytrap`, `ghost_orchid`, `sundew`, `white_egret`, `cobra_lily`, `pitcher`, `sacred_lotus`, `water_hyacinth`, `air_plant`, `titan_arum`, `baobab`, `beech`, `birch`, `sensitive_plant`, `rainbow_euc`, `black_bat`, `wollemi`, `walking_palm`, `jade_vine`, `bleeding_heart`, `banyan`, `bird_paradise`, `monkey_orchid`, `strangler_fig`, `ginkgo`, `rafflesia`, `voodoo_lily`, `pelican_flower`, `monstera`, `sea_poison`, `edelweiss`, `mandrake`, `whomping_willow`, `spore_cap`, `whisperweed`, `star_lotus`, `chrono_vine`, `fire_fern`, `singing_orchid`, `nebula_moss`, `void_root`.

## What the music contract must preserve

| Signal or action | World response to preserve | Important distinction |
|---|---|---|
| Kick transient | Expanding fronts, individual plant bounce/whip, rock thump | Spatial shader deformation in the legacy path; not automatically collision movement. |
| Held bright note / chord | Rock lift/hover, canopy rattle | Release uses a ballistic envelope and bounce. A glow-only replacement loses the interaction. |
| Audible BPM | Sway clock follows the dominant synth or adjusted DJ deck | Silence gates movement; sustained pads should not masquerade as kick hits. |
| Bass / high bands | Fauna approach or retreat, water/lava/sky changes, star and black-hole response | Animal steering changes simulation; many material effects only change appearance. |
| Player melody | NPC call-and-response, audience, trust, renown and requests | Playback must use the active faceplate and respect user mix/loops. |
| Touch/drag on an object | Strike-position note, material identity and contact ripple | Note release/cancellation and camera gesture ownership must remain dependable. |
| Bouncing musical rig | Impacts generate active faceplate notes | Actual ball gravity, kinematic pendulums/harps and decorative displacement are different mechanisms. |
| Scale / face change with music mode enabled | Bias future world palettes and NPC book selection | Never rewrite visited world identity; preserve the opt-in setting. |
| Ascent / return | Audio clock, held notes, loops and world response continue | New orbital band/thrust behavior covers only this shell, not full galaxy music parity; it adds at most 12% to commanded thrust and cannot move or steer the player by itself. |

The current Crysis bridge already samples `L99Continuity`, feeds bass/mid/high uniforms, makes struck surfaces ring, moves grass/wind, lights alien inlays and triggers a whale breach on a strong bass edge. Crysis also has a three-lead composer. Those are meaningful existing pieces; the native kinetic implementation now adds all ten authored rig types and a bounded faceplate note bridge, as detailed below. Full legacy rig, audience, bond, request and galaxy parity remains open; individual migration rows track the newer surface-response work.


## Native kinetic rig types

All ten authored rig types now have native models, distinct renderers and real faceplate
notes: bounce garden, pendulum wave, domino spiral, chime tree, Newton’s cradle, droplet
pool, gravity harp, Plinko staircase, ball fountain and kinetic wave. The garden uses
integrated gravity/restitution; other rigs retain authored kinematic behavior and trigger
notes at their contacts, crossings, gusts, crests or periapsis. They are not a universal
rigid-body or player-platform collision system.

Sky & World exposes rig choice and Place/Replay/Stop/Clear, current Bard or four legacy
scales and fixed-scale pitch offset. Garden gravity/bounce and droplet density are live;
garden drop height and garden/domino cascade tempo apply on replay. Placement captures
audible BPM; replay respects the chosen setting and an explicit button copies track tempo.

| Native limit | Current implementation |
|---|---|
| Rigs per world | One; placing another replaces it |
| Garden / pendulum | 192 default garden balls, 256 maximum; 15 pendulums maximum |
| Dominoes / chimes / cradle | 60/80 tiles; 7/12 chimes; five cradle balls |
| Droplets / harp | 10/24 drops plus six ripples; 3/6 orbiting bodies |
| Stairs / fountain / wave | One ball over 16 steps; six shots over 8/16 pads; 20/32 bars |
| Faceplate | Eight live voices, 24 notes/second, four-note bursts |
| Distance / catch-up | 120-unit audible radius; 0.1-second catch-up in ≤1/120-second substeps |

`kinetic-rigs.js` holds authored models, `kinetic-view.js` their pooled geometry, and
`kinetic-placement.js` their count-aware sampled footprints. Placement rejects water,
blocked sites, unknown terrain and excessive slope. Models emit actual `playLead` and
`stopLead` events through owned IDs and timed release; current host instrument, FX and
gain remain in control. The bridge does not add per-ball stereo panning.

Hide/orbit releases rig voices and freezes its motion. Returning to the retained surface
keeps it available for explicit Replay. Active orbital anchors now block globe frame
rebasing so lateral ascent cannot invalidate the departure. Teleport/share relocation,
ordinary Earth frame changes and world replacement clear the rig. Multi-rig persistence,
legacy progression and arbitrary world-collision sonification remain separate work.

The combined Node suite has 94 passing regressions, including all ten musical models,
renderer matrices/resource cleanup, placement, solar geometry and atlas refresh. Browser
checks exercise the real faceplate and GPU, with evidence in the PR and HANDOFF. Headless
software rendering does not certify native iPhone/Safari speed or listening quality.

## Persistence and identity checklist

The machine catalog lists all literal local-storage keys/prefixes found across flight, core and index. At minimum migrate:

- `level99-codex-collected`, `level99-allegiance`, `level99-war:<seed>`, `l99npc1`.
- `l99scan_<seed>`, `l99bond_<seed>`, `l99renown_all` and old `l99renown_<seed>`.
- `l99_build_<seed>`, plot/homestead records, `l99_fossils`, `l99_relics`, `l99_explored`.
- `l99-cargo-runs`, cargo title flags, `l99_research_outposts`, `l99galaxy`, `l99-planet-names`.
- `level99-bookmarks-v1`, `l99-places216`, `l99-world-view216`, `l99-quests217`, shared Journey links, excavation/fishing/choir/echo state.
- `level99-music-mode`, cockpit quality/comfort/input preferences, user faceplate, instrument selections and mix.

Use a versioned descriptor containing galaxy ID, system coordinates/ID, body ID, original floating seed, generated integer seed, original type, effective Crysis profile, palette, primal/special flags, and per-body surface anchor. The landing adapter still uses the historical integer terrain seed. The new `space/body.js` descriptor separately retains raw fractional seed, original type, effective profile, palette/primal flags and supplied body/system/galaxy identity. Homes/share/resume now retain that descriptor and resident-world comparisons use it. Existing terrain is unchanged. Full legacy progress-key migration and old bookmark redirection remain open; never silently assign a new place.

## Findings that prevent accidental regressions

- **Current source versus comments:** `MISSING_CODEX` contains 100 entries despite the older “42 fragments” header. Anomaly spawn comments promise per-system seeding but the builder starts from `Date.now()`. The list contains seven random kinds although an older comment says eight.
- **Black-hole duplication:** central Gargantua replaces the old approximate central lens. The old Abyssal Accretion builder/label remains but is removed from the random anomaly choices. Do not spawn a second central lens.
- **World generation mismatch:** 30 palettes versus 23 music tag entries leaves later mystical/shepherd/primal entries with baseline musical weight. Record this, then choose an intentional mapping.
- **Codex indexing:** `CODEX_BOOKS.HYMN` is `[35,36,36]` while the final original verse is index 37. Preserve source evidence and decide whether to fix the repeated index; do not mistake it for a new verse.
- **Old ship and dungeon blocks:** explicit da079/da083 removals win over older descriptive comments. Archived ship/dungeon material is part of historical retention, not automatically a requirement to make those removed controls visible again.
- **Final Cadence:** an old comment says 200x while the authored Sustain line says 8x; actual giant-world implementation and optional hooks must be checked before describing the outcome.
- **Research:** the research network is local quest/progress data referencing real citizen science; it performs no research.
- **Popout:** current popout reparents the same live DOM and continues using main-window audio. Earlier BroadcastChannel descriptions refer to an older architecture.
- **Native orbit is a shell:** it does not yet contain the ten-star/eight-galaxy ecology of legacy flight. Keep the explicit galaxy path while this checklist is completed.

## Migration order

1. Stabilize native resident-world ascent/re-entry and save the departure anchor. Verify input, camera and uninterrupted faceplate sound first.
2. Add one shared versioned body registry and music-event contract. Keep legacy IDs, seeds, progress and optional realm adapters readable.
3. Restore high-value music mechanics in the Crysis surface: kick fronts, held-note motion, fauna behavior, playable objects and kinetic instruments, then audience/bonds/requests.
4. Port universe descriptors, all planet/star/galaxy types and continuous space travel. Preserve legacy space until every row is covered.
5. Port narrative progression, stations, anomalies, factions and endgame with save compatibility. Mark historical removals explicitly.
6. Close parity gates on desktop and a real phone; then retire the legacy renderer through a deliberate release, not an incidental file deletion.

## Additional roster and historical recovery

The JSON now preserves **79 current authored tables**, **75 flora geometry keys**, **48 dinosaur/pterosaur/marine names**, **288 lore-display expressions**, the exact endgame/persistent-folk/shared-dialogue source blocks, and focused retired ship/dungeon blocks. The 111 feature groups are a practical migration checklist; the source section/function indexes provide finer implementation anchors. Historical symbol detection is a candidate comparison, not proof that every old execution path is fully understood.

### Full retained prehistoric name bank

The older header says 40 species, but its actual four arrays contain 48 names. Not all are dinosaurs, and a name does not promise a unique mesh or scientifically accurate reconstruction. Crysis currently offers seven kinds; keep the remaining roster as explicit migration work.

- **Herbivore group — 22:** TRICERATOPS, ANKYLOSAURUS, EDMONTOSAURUS, PARASAUROLOPHUS, PACHYCEPHALOSAURUS, CORYTHOSAURUS, LAMBEOSAURUS, STYRACOSAURUS, PENTACERATOPS, TOROSAURUS, MAIASAURA, PROTOCERATOPS, EUOPLOCEPHALUS, SAUROLOPHUS, ALAMOSAURUS, ARGENTINOSAURUS, THERIZINOSAURUS, GALLIMIMUS, STRUTHIOMIMUS, IGUANODON, DIPLODOCUS, CAMARASAURUS.
- **Carnivore group — 14:** TYRANNOSAURUS REX, VELOCIRAPTOR, DAKOTARAPTOR, DROMAEOSAURUS, TROODON, CARNOTAURUS, ALBERTOSAURUS, GORGOSAURUS, DASPLETOSAURUS, TARBOSAURUS, SPINOSAURUS, BARYONYX, GIGANOTOSAURUS, OVIRAPTOR.
- **Flying group — 10:** QUETZALCOATLUS, PTERANODON, HATZEGOPTERYX, NYCTOSAURUS, TROPEOGNATHUS, TAPEJARA, DSUNGARIPTERUS, RHAMPHORHYNCHUS, DIMORPHODON, PTERODACTYLUS.
- **Marine group — 2:** MOSASAURUS, ELASMOSAURUS.

### Historical feature dispositions

| ID / feature | Evidence | Retention action |
|---|---|---|
| FLT-110 **Earlier procedural anomaly variants** | `d567016:index.html`, decoded `_makeVariantStructure:3430` | Removed/superseded early generator; 30 proper names, 15 passages and six structural archetypes: hollow torus, nested-ring cathedral, obelisk/spire, polyhedral eye, spinal rib cage and lattice. Archive exact lore; decide whether new Crysis galaxy reintroduces these as identifiable sites. |
| FLT-111 **Scaffold inscriptions** | `9aa6374:index.html`, decoded `_inscriptionTexture:3301` | Four emissive architectural inscriptions from Books LXXVIII–LXXXI. Preserve exact heading/text pairs and choose whether to restore their spatial presentation; do not count removed panels as currently reachable. |

The full personal ship once contained a bridge/helm, studio, bunks and crew space; its current entry/build functions are explicit no-ops after da079. The earlier dungeon had five themes (roots, crystal, ember, bone, arcane), descending levels, doors/levers, Coda relics, a companion, combat/mobs and a minimap; da083 deliberately removed it. Those implementations remain recoverable from `c8777e9:flight.html` and are archived in focused JSON blocks. The Crysis medieval dungeon is an independent replacement with its own quests.

### Removed anomaly names — exact authored list

The Hollow Vespers, Cathedral of the First Tide, Ribcage of the Architect, The Fluted Behemoth, Wreath of Drowned Stars, Vault of Negative Pressure, The Mute Chorale, Reliquary of the Great Migration, The Mournful Spire, Cradle of Forgotten Light, The Pelagic Throne, Lighthouse of the Abyss, The Sleeping Cartographer, Procession of the Slow Engines, The Curling Reef, Anchor of the Architect, The Long Silence, Crown of the Hibernator, Lattice of Bone-Iron, The Threshold That Hums, Reservoir of Dead Gravities, The Watcher Between Shoals, Sepulchre of the Tide, The Veil of Old Salts, Pier of the Vanished Builders, The Folded Compass, Pillar of the Inverted Sea, The Listener, Choir of the Bathyal Wake, The Pale Recursion.

These names come from `d5670164:flight.html` (`VARIANT_NAMES`). The earlier generator selected 12–20 session-seeded variants. This is historical evidence, not an assertion that those sites currently spawn.

### Removed anomaly lore — exact authored passages

- An incomplete monument. Whatever it commemorated is also incomplete.
- Sub-bass measurements indicate this is hollow. Or pretending to be.
- Star charts list this object as 'redacted by request'.
- Three previous expeditions catalogued it; none returned to update the entry.
- Mass exceeds expected for its volume. Density may be biological.
- Reads as stationary on long-range. Reads as drifting on close approach.
- The Architeuthis Architects did not sign their work, but they signed this.
- Spectrographic analysis suggests it remembers being a star.
- Cosmic background radiation thins inside its shadow.
- It is exactly the wrong size to be either a planet or a vessel.
- Maps from the Bathyal Epoch labelled this region with a single character: 縄.
- The Pelagic Void left it here, and the Pelagic Void did not return for it.
- Local time runs ~0.4% slower in its proximity.
- Construction marks suggest it was begun but never claimed.
- Its silence is precisely the wrong shape to be empty space.

### Scaffold inscriptions — exact authored text

Source: `9aa63742:flight.html`, decoded `_inscriptions` near line 3295.

- **LXXVIII · THE SECOND MAKING** — And the Architect looked upon the first draft, and found it good — yet not perfect.
- **LXXIX · THE LEDGER OF LIGHT** — The Architect renders the far worlds last — not from neglect, but to spare them the wear of being seen.
- **LXXX · ON THE SIZE OF THINGS** — He made the giant and the dwarf from the same intention. Largeness is not greatness.
- **LXXXI · THE ORBIT OF RETURN** — Nothing fixed in its place is ever truly lost. Only the wandering things must be sought.

Other recovered table differences include the older Mercury=MAGMA / Venus=TOXIC classification and an earlier console-only Final Cadence choice prompt. They are stored with their original commits; they do not override current planet descriptors or the implemented newer ending. The history also contains obsolete popout broadcasting, diagnostic helpers, road helpers and earlier score logic, retained in the symbol evidence index rather than promoted to new product requirements.

### Preservation checks completed

- Every feature has a source, Crysis disposition and migration/test requirement; all current named legacy/core anchors and referenced Crysis paths resolve.
- Authored JSON parses; current and historical data are separated; retired/comment-only behavior is identified.
- All 111 feature IDs are unique and appear once in the report. The catalog stores exact table initializers so functions or dynamic JS semantics are not silently lost during JSON conversion.
- History payloads were decoded and hashed; no old engine files were restored or edited.
- This audit did not execute every legacy feature. Whole-flight retirement still requires the explicit parity and music-physics gates above.

## Native music and identity update — 3 October 2026

The shared faceplate bridge now merges synth, enabled microphone and DJ analyser data by frequency (including differing FFT sizes/sample rates), without requiring the old flight renderer to load first. The performance snapshot reads real active synth voices, respects scheduled start times, and exposes held/released/retriggered notes plus the dominant audible synth/deck BPM. Recorded audio contributes bands/attacks, not guessed discrete notes.

Nearby **streamed island boulders** now rise on held audible synth notes, fall ballistically on release and bounce to rest. Their instance matrices move, so shadows and ray picking follow. The existing lateral collision query excludes lifted rocks outside the player's height. They are not general rigid bodies, moving platforms, destructible terrain or musical collision instruments. Bass attacks propagate bounded radial impulses; this does not yet port the full plant shockwave shaders or wild-country outcrops.

Flying land fauna has bounded attraction to low/held melody and repulsion from bright energy under the existing opt-in music-mode setting (also available in Sky & World). Ground/burrow behavior, persistent trust and the full legacy species response contract remain migration work.

Eight body/performance regressions and three live-page bridge regressions pass. A full faceplate browser check holds/releases a real synth voice, verifies ~3.9 m boulder lift through the actual instance matrix, verifies the player's collision filter before/after settling, and round-trips a fractional body identity through a saved home. The analyser gate is controlled in that functional test; it is not a listening test or native-device performance benchmark. DJ/microphone source combinations use deterministic analyser fixtures and still need real-device capture/listening checks.
