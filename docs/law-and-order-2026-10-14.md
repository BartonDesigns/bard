# Law and order (October 14, 2026)

Behaviour quality for the police, the gangs, the military and everyone caught between them, and an escalation ladder that runs engine-wide on Earth. New code is in `island/src/law/`; the police and the dispatch (`island/src/military/police.js`, `dispatch.js`) and the squads (`island/src/combat/ai-squads.js`) gained the capabilities it drives. Everything plugs in through `combat.hooks`, so the fight still works with the law module absent.

## The ladder

Nothing happens until somebody tells.

- **Witnesses.** Every offence goes to `hooks.crime(kind, at)`. An officer with a clear sight of it (or its victim) counts it at once. Passers-by with a clear sight line (children never count) phone it in after a delay by kind: gunfire 5 to 12 s, an assault 9 to 20 s, a robbery 12 to 26 s, property damage 20 to 40 s, shorter the more people saw it (divided by the square root of the witnesses, up to four). Several witnesses of one crime make one call. A crime nobody saw is nobody's business. Gunfire that was only heard is reported as shots fired at a place: a car goes to look, but nobody is after you.
- **Trouble among others** (a brawl, a gang's gunfire, a corner crew squaring up) goes through the same calls (`hooks.event` is now the law's), then to the police, their tactical team, or the military (`routeTrouble`).
- **Levels** (`responsePlan`): 1 reported (one patrol car), 2 pursuit (two cars), 3 backup (a roadblock on the road ahead of you), 4 tactical (the tactical team in its van from the police quarters, a second roadblock), 5 military (the nearest base sends a convoy and a helicopter). The military is never asked below five, base guards no longer turn on you at three, and convoy guns no longer fire on you at four.
- **Force.** Officers hold their fire and close in to arrest unless you are armed (they shout a warning and give you two and a half seconds to put it away), have fired in the last 30 s, or the level is four or more.
- **Where they go.** Cars head for where you were last seen (`wanted.last`: a sighting, or the place a crime was reported), not wherever you are now. On arrival without sight of you the officers search a ring round that spot.
- **De-escalation.** Out of sight, the police search for 18, 25, 35, 50 or 75 s (by stars) before the points start to ebb (`SEARCH`, used by `combat/heat.js tickWanted`). At nothing for 25 s every unit goes home; officers walk back to their car and get in before it drives off, and it is only let go once out of your sight. Roadblocks are lifted 20 s after the level drops under three.
- **Arrest.** Unarmed and standing still near an officer for three seconds, or hands up (H, or the Surrender button on a touch screen), and they come and cuff you. An officer reaching you while you are unarmed takes you down and cuffs you. Downed with officers near is an arrest rather than the hospital. Booked at the nearest police station (`services.stationAt`), fined (60 per star at the worst, 3 per remaining point, 150 more if you ran; capped at 5000). The fine is taken through `arms.spendCredits` (owed when you cannot pay) and paid into the station's account through `HOOKS.npcMoney` when the bank adapter is attached. Running from officers who have you in sight is an offence of its own (evade, once per matter: it makes a punch a pursuit).

## Gangs and militia

- **Territory** follows the regions (`people/moral-regions.js`, through `npcQuests.regionNow()`): the region's town situation (trouble) and its morality tally (`commons.region(id)`) decide how much ground the gangs hold. Cells are 420 m; owners are drawn on a coarser grid so a gang holds a stretch of streets, and where two stretches meet is a border (`law/gangs.js territoryAt`).
- **Corners.** Corner crews of two to four (more in the evening and where strong) hang out at street corners (where road ends meet) in a gang's ground, chosen the same way each visit and never made where you can see. They recruit now and then, faster where the region has gone wrong. They mind their own business with a patrol about and drift off round the corner when one pulls up; officers leave them be unless they are fighting. A crew that ends up fighting is called in like any gang fight.
- **Gang wars** start mostly where two gangs' ground meets, at most every four minutes, out of sight, and are called in by those who hear them. The old random gang shootout every two minutes in any town is gone.
- **Militia** compounds only out of town: open country, two buildings or fewer within 300 m, at least 1.5 km from a town (`militiaAllowed`, `hooks.campOk`).

## Tactics

- **Cover.** Parked cruisers are cover for the officers (`hooks.cover`), besides the props and buildings already used.
- **Flanking and suppressing** are the squads' own (unchanged). **Falling back:** once a second, a squad that has lost people and is outnumbered (or badly hurt) falls back; police and soldiers hold longer, machines and creatures never (`squadMorale`).
- **Medics.** A fighter who falls waits where they fell for the ambulance from the nearest hospital (`services.injury`), which takes them away; up to four waiting at once (two on a phone).
- **Roadblocks** on the road graph (`world.real` roads, `roadblockSpot`): a point 140 to 260 m ahead along your heading (220 to 380 m when you drive fast), on the biggest road, two cruisers parked across it, officers behind them. Never put up where you can see.
- **Nothing appears or vanishes in view.** Cruisers come from the station or a road out of sight; the old on-foot fallback, bounty hunters and corner crews use a hidden spot; units far away move faster than they would drive; nothing is dropped where you can see it.
- **No walking through buildings.** Squad bodies are pushed out of building boxes each step (`combat` `keepOut`, cached per 24 m cell), and sidestep along a wall when they make no headway for 1.6 s. Vehicles stop on the road nearest the goal instead of driving the last stretch through a block (`route.js trimToRoad`); a convoy pulls up nose to tail on the road at the scene.

## Phones

One corner crew instead of two, at most two cars and one roadblock, a tactical team of three, two casualties waiting. The squads' cap (6 on a phone) still bounds everything. The law allocates nothing per frame but for the crimes and calls themselves.

## Scenario harness

`island/tools/law-scenarios-browser.cjs` enters Earth, goes to Union Square, and stages five scenes, stepping the fight, the military and the law directly at 0.1 s (a software renderer is far too slow to wait for): a gang fight downtown, a punch thrown at a passer-by with others about, a shootout with a gang crew, a boss and an invasion. Every game second it records the wanted level, the cruisers, the convoys and each side's squads, and looks for units stuck in place, inside buildings, made or let go in plain view, police ignoring a crime, and the military sent for a small one. `GOTO=lat,lon SCENES=gang,crime node island/tools/law-scenarios-browser.cjs <outdir> <tag>`.

### Results, before and after (Union Square, software renderer, the machine heavily loaded)

| Scene | Before (main) | After |
| --- | --- | --- |
| Gang fight downtown | a cruiser sent 1 s after the fight started (nobody had called), on scene at 18 s; 6 gang members made in plain view at 74 to 82 m; 399 samples of units inside buildings | the call comes through at 11 s (gunfire heard), the cruiser is on scene at 21 s; nobody made in view, nobody inside a building; 3 short stuck flags (members walking into a wall before the sidestep) |
| Punch a passer-by | one star the instant the blow landed, before anyone could have called; no police ever sent; the star gone at 16 s | nothing until the witness's call at about 15 s, one star (reported), one car on scene at 27 s; officers search where it happened, the level ebbs, they walk back to the car at 61 s, board and drive off by 66 s, gone out of sight by 76 s |
| Shootout | the gang crew never took the harness's shots (it aims from the camera while the player is in flight mode after `goTo`); no response either side | the same harness limitation; one crew member made at 37 m in view (the test's own `spawn` at 30 m, not the game's) |
| Boss | no base sited near enough within the run: no dispatch | run cut short by a machine restart |
| Invasion | the Ironvale column under way; no base sited near enough to answer within 150 s | run cut short by a machine restart |

The before run also shows why the old police never came for the punch: the combat director answers the wanted level only while the player is on foot (not in flight mode, where `goTo` leaves you); the law answers regardless.

Known gaps from the runs: in the after run's gang scene the two crews never got a sight line of each other and stood their ground for the whole minute and a half (the police arrived and stood by with them); the gang war the law starts itself (`ambient`) now sends each crew toward the other's corner so they meet; the console's `Crysis.combat.fight()` (what the harness uses) still places two crews and leaves them. The boss, invasion and convoy scenes still need a full run on a quiet machine with a base sited.

## Console

`Crysis.law()`: the level and stage, points, whether you are seen and how long they have searched, the calls on their way (and in how long), the plan, custody, the region and territory here, the corner crews, roadblocks, the cruisers and the counts. `Crysis.law.surrender()`, `.arrest()`, `.territory(x, z)`, `.incident(e)`; `Crysis.lawStep(dt)` runs it on (tests).

## Tests

`island/tools/escalation.test.mjs` (15 tests) covers the ladder, the routing, the search and ebb, arrests and fines, territory, corners, recruiting, gang stances, militia siting, roadblocks, hidden spots, morale and the building push. `island/tools/military.test.mjs` now expects the military only at five stars.

## Hooks for others

- `combat.hooks`: `crime`, `holdFire`, `ignore`, `cover`, `arrest`, `booked`, `death`, `ambient`, `campOk` (all set by `law/index.js`); `event` and `police` are overridden by the law after the military sets them.
- `combat` API: `report(kind, at)`, `lastSeen()`, `armed()`, `speed()`, `blocked(a, b)`, `spotHidden(min, max)`, `clearWanted()`, `wantedState()`.
- Police: `need(plan, at)`, `block(spot, from)`, `clearBlocks()`, `standDown()`, `cover(x, z, r)`, `law.last`, `law.view`.
- Squads: `h.recall` (stop fighting, walk to `h.post`), `h.corner`, `h.awaitMedic` / `h.collected`.
- Melee was not restructured; brawls still report through `ctx.event`, which now reaches the law's witnesses.
