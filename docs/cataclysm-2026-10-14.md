# Catastrophes: earthquakes, wildfires and eruptions (14 October 2026)

The owner asked for every building to be breakable, with crews that come and rebuild over two to five game hours, "unless there's a city wide cataclysmic event." The breaking and the crews were already in `island/src/structures/` (see `docs/structures-2026-10-14.md`), with a `cataclysm(true)` switch that holds the crews off. This adds what decides when a catastrophe comes, what it looks and sounds like, who answers it, and what you can do. Everything lives in `island/src/cataclysm/`; the shared files carry a few marked lines.

Three kinds, done properly rather than many done thinly: **earthquake** (the Bay is quake country), **wildfire** (the dry hills), and on magma worlds a great **eruption** with ashfall. Flood and storm surge are not built (see the end).

## 1. When: the director and the schedule

`schedule.js` is pure (no scene, no clock), tested in `island/tools/cataclysm.test.mjs`.

- The game keeps its own clock in hours: the sky's hour of the day, unwrapped (a skip of more than six hours is a jump, not time passing), kept in localStorage `l99.cataclysm.v1` with the events already met. A game day is about eleven and a half real minutes.
- Each game day, each region rolls once from the world's seed, the region's id and the day (`eventFor`). The same world gives everyone the same catastrophes on the same days. The region is the people's (`people/moral-regions.js` through `npc-quests.regionNow()`): the Bay's seven, globe cells about 150 km across, a planet's own.
- What the land allows (`envOf`, `chancesFor`): in the Bay a quake 1.2% a day, elsewhere on Earth 0.5%; a wildfire up to 1.6% a day scaled by how dry the month is (the Bay's: green to May, gold by July, the season running to November) and how much open country is round you; on a magma world an eruption 3% and a quake 0.8%; any other planet a quake 0.4%. Ten years of game days in the East Bay give about 75 (a region sees one every couple of months of game days; one every several hours of play at most).
- Never two close together: 72 game hours of quiet after each, wherever you are (`QUIET`). An event is met if you are in its region from its start until three quarters of a game hour after (`LATE`), and only once (`seen`).
- Severity 0..1 per event (skewed towards the milder). A quake's magnitude is 5.4 to 7.6 from it; its reach `quakeRadius` (about 240 m at 6, 480 m at 7, 730 m at 7.6), the shaking at a distance `shakeAt` (falling off with the log of distance), its length `quakeDuration` (8 s plus 9 s a magnitude over 5), its arrival (the waves cross a kilometre in about a third of a second), and its aftershocks (Bath's law: the largest about 1.2 below the main shock; Omori: crowded early, thinning out over eight minutes).

`index.js` checks every three seconds whether one is due where you are (not while loading, not while one is under way or recovering). On a new world whatever was happening ends where it is.

## 2. Earthquake (`quake.js`)

The epicentre is placed from the event's bearing and distance from you (60 to 300 m). Then:

- **The shaking.** A sharp first jolt (the P wave), the rolling S waves building to their worst by three seconds, holding, then dying away over the last 30%. The view sways, rolls and jolts by how hard the ground moves where you are; the trees thrash (`uGust`); the ground rumbles (brown noise under 95 Hz swelling and sagging, a mid band over it); windows rattle and crockery clatters; dust lifts off everything round you.
- **The buildings.** Every building within reach (the nearest 420 to you, 160 on a phone) gets a fate from `damageFor(shaking there, toughness, height, roll)`: nothing, glass lost, walls cracked open, the top storeys down, or the whole of it down. The toughness is the structures' own (timber house 0.75, shop 1, block 1.25, steel tower 1.8); mid-height buildings fare a little worse, very tall ones a little better. The roll is from the event and the building's id, so the same quake breaks the same buildings. Each happens as the shaking reaches it, through `structures.damage.hole`, `bringDown` and `glass.blast` (chunks as Rapier bodies, dust, collapse sounds, rubble and shells kept until the crews rebuild). Caps per quake: 7 collapses, 10 partial, 26 cracked, 40 glass (3, 4, 10, 14 on a phone); past a cap a building comes off one step lighter.
- **Falling glass** off the panes near you, and others cracking, a few at a time while it shakes.
- **Car alarms** set off along the street (the nearest parked cars, up to 3 voiced, 1 on a phone), each where its car is, with a hazard blink.
- **Cracks in the street**: jagged dark fissures on open ground near you and near the heart (9, 4 on a phone), kept until the crews have rebuilt.
- **The hurt.** People beside what fell are hurt: told to the nearest hospital (`services.injury`: an ambulance comes, or they walk in), or trapped against its wall (yours to dig out), or hurt and waiting for help to the hospital (yours to carry). Up to 7 (3).
- **Gas fires**: six to twenty seconds after the shaking stops, one or two of the broken buildings near you catch (combat's building fires, which call `services.dispatchFire`: an engine and its crew come from the nearest station).
- **Aftershocks** over the next minutes, each in the news; a strong one brings more glass down off the cracked buildings.

## 3. Wildfire (`wildfire.js`, `front.js`)

- It starts in the dry country upwind of you (the best fuel near the spot the event names), never on water, a roof or among buildings. If there is no dry country near enough (downtown), it is a brush fire that was out before it began.
- **Fuel** per cell: open country (the town map's density, `bayArea.urbanAt`, 0 in the streets), dried by the month, more under trees (`vegetation.obstacles`).
- **The front** (`front.js`, pure, tested): 10 m cells (14 m on a phone). A burning cell heats up over four seconds, burns 14 to 48 s by its fuel, and spreads to its eight neighbours, faster downwind (by the world's wind, `uWindDir`, `uWind`) and uphill (the flames lean onto the slope), now and then throwing an ember two to four cells downwind to start a spot fire. With an 0.8 fuel and a moderate wind it reaches about 90 m in two minutes and 300 m in five. A cell that burned or was put out does not burn again. Bounded: 360 burning and 760 cells in all at most (140 and 260 on a phone), by severity.
- **Drawn**: flames along the front (an instanced billboard each with its own licking, leaning flame shader; 180, 56 on a phone; the nearest cells first, two flames each up close), a smoke column (soft, lit puffs that climb, spread and drift downwind, warm underneath where the fire lights them), embers on the wind from the near flames, scorched black ground behind it.
- **The sky**: brown-orange haze and a red sun, thicker downwind and nearer the fire.
- **Houses** in its way catch (combat's building fires; answered by their stations).
- **Engines** to the front near you every 35 s while it burns (`services.dispatchFire`); their crews' hoses knock the front down within 32 m of where they are put down, and you see their spray.
- Too close to the flames, it burns you. Its roar and crackle grow as you near it.
- **Held** when no flame is left; the aftermath follows.

## 4. Eruption (`eruption.js`, magma worlds)

The vent is made to blow (`planet/volcano.js erupt()`, the mountain's own fountain, lava and ash column), the ground trembles for a minute and a half with booms rolling off the cone, and the ash comes down: grey flakes falling round you (110 a second, 30 on a phone), the sky going grey-brown and the sun dim, lightning flashing in the ash cloud with its thunder late behind it. The aftermath thins the ash out.

## 5. What it does to the world (`response.js`)

- **The crews are held off** (`structures.cataclysm(true)`) from the start, through the emergency, and through a recovery of 0.9 to 2.1 game hours after it (by severity). Then `cataclysm(false)`, and every crew comes at once: the structures move every waiting rebuild's start to then, so trucks, scaffolding and cranes go up across the damage together. The cracks and scorch marks go once the crews are in.
- **The services**, as they already work: the hurt to the nearest hospital, fires to the nearest fire station; a police cruiser to the scene (`military/police.js event({ kind: 'disaster' })`, with its own dispatch line); for anything but a mild one, the Meridian Guard (`military/dispatch.js event({ kind: 'disaster' })`, a new `disaster` force in `military/rules.js`: two trucks and a jeep by road, a helicopter over it; their troops only ever engage hostiles).
- **The people near you** (26 at most, 10 on a phone): in a quake most drop where they are and cover their heads while it shakes (some run), then get away from the buildings and walk to a shelter; from a fire or the ash they get out of the way and go. The shelter is the nearest park (probed through `parks.parkAt`) or else open ground away from the trouble with no building within 25 m; a relief station is put up there (two canopies, cots, water, a generator light and a sign). Gathered, they stand about looking back towards it, and someone says something now and then in their own voice (chatter).
- **Helping each other**: the good-hearted (their disposition's protect and mercy) are left free, and the hurt are offered to them as quests through `npcQuests.addSource` (one descriptor each: go to them, stay with them). Whoever takes one is chosen by their own disposition like any favour, and their good deed (`disaster-help`) goes on their compass and their region's tally.
- When it is over everyone is let go, the needs left are the crews' (the services told), and the relief station comes down when the recovery ends.

## 6. What you can do (`quests.js`)

The nearest is marked with the guide's pin and chip (`guide.js waypointMark` asks `api.cataclysm.mark()` first: an emergency comes before a meeting). You do it by going there and staying at it, shown on the alert's bar, so it is the same with a keyboard or a thumb:

| quest | how | deed (compass) | credits |
| --- | --- | --- | --- |
| Dig someone out of the rubble | stay beside them 4.5 s (broken pieces heaved aside, dust) | `disaster-rescue` (mercy +8, protect +12) | 120 |
| Help someone hurt to the hospital | stay by them to help them up, then lead the way; they follow you on foot, or ride with you in a car; within 38 m of the hospital they are admitted | `disaster-carry` (mercy +7, protect +9) | 150 |
| Get water on the burning building | stand close and keep the water on it (`combat.douse`) until it is out | `disaster-fire` (protect +9) | 110 |
| Take a hose to the fire line | stay by the flames: the front within 18 m goes out under your water | `disaster-fire` | 100 |

Someone dug out who is badly hurt asks to be taken to the hospital next. Rescue and carry count towards today's "patch up someone who is hurt" goal (`daily.note('tend')`). Credits go through the inventory (`arms.apply`, peer `relief`), as the daily goals' do. Your deeds count in your region's tally too (`commons.follow`).

## 7. On the screen and in the ears (`hud.js`, `sound.js`, `fx.js`)

- **The alert**: a banner under the waypoint chip with a blinking red EMERGENCY ALERT stripe and the phase (SHAKING, SPREADING, ASHFALL, AFTERMATH, RECOVERY, REBUILDING), the headline ("Earthquake, magnitude 6.8: the East Bay"), what to do now ("Drop, cover and hold on"; "Stay clear of damaged buildings. Shelter at Lafayette Park"), the news one line at a time (aftershocks, hospitals, the relief station, the Guard, evacuation orders, air quality), and the bar while you work. It folds to the stripe after a while and opens again for news. The two tones of the emergency alert sound when it begins.
- **fx.js**: fixed pools made once (flames 180/56, smoke 520/140, sparks 420/120, ground marks 320/90); nothing is allocated as it runs.

## 8. For the other modules: `HOOKS.cataclysm`

```js
const off = HOOKS.cataclysm.on((e) => {
	// e.type: 'start' | 'phase' | 'over' (the emergency ends, recovery begins) | 'recovered' (the crews are let in)
	// e.kind: 'quake' | 'wildfire' | 'eruption'; e.region: { id, name }; e.severity 0..1; e.magnitude (a quake's)
	// e.x, e.z, e.r: where and how far it reaches (metres); e.phase; e.at (game hours); e.id
});
HOOKS.cataclysm.state();      // the same for what is happening now, or null
HOOKS.cataclysm.active();     // under way
HOOKS.cataclysm.recovering(); // over, crews not yet in
```

The economy (bank, businesses) can close shops in reach, raise prices for water and repairs, pay out insurance on `recovered`, or post relief jobs as quests (`npcQuests.addSource`). Nothing here touches the economy's files.

## 9. The console

```js
Crysis.cataclysm()                    // how it stands: what is under way, its detail, the people, the quests, the recovery, the next due here
Crysis.cataclysm.quake(7.1)           // a quake near you now (or { at: { x, z }, distance })
Crysis.cataclysm.wildfire(0.8)        // a wildfire upwind (severity 0..1; { distance })
Crysis.cataclysm.eruption()           // on a magma world ({ force: true } elsewhere)
Crysis.cataclysm.skip(30)             // run the one under way on by seconds
Crysis.cataclysm.end()                // the all-clear: recovery begins
Crysis.cataclysm.recover()            // the crews in now
Crysis.cataclysm.clear()              // all of it gone
Crysis.cataclysm.upcoming(365)        // the coming ones in this region
Crysis.cataclysm.rate(40)             // forty times as likely, for testing (1 as made)
```

## 10. Shared-file lines

- `main.js`: the import, one block after the hospital hook (create, `guideApi.cataclysm`, `HOOKS.cataclysm`), one line in the frame after the military's update, one getter on `window.Crysis`.
- `guide/guide.js`: three lines at the top of `waypointMark`.
- `combat/combat.js`: `igniteAt(x, z, r)` (a fire not set by you), `firesNear(x, z, r)`, `douse(id, k)` on the public api.
- `combat/morality.js`: four rules (`disaster-rescue`, `disaster-carry`, `disaster-fire`, `disaster-help`).
- `military/rules.js`: the `disaster` force. `military/police.js`: its dispatch line.

## Not done

- Flood and storm surge on the coast (the bay's water level raised over the low shore, the wet ground drawn dark, people to high ground) would fit the same director: a kind in `chancesFor` for coastal regions in the winter storms, a runner beside the others.
- Far-off events (in a region you are not in) are not played or reported; a news line for them would be a small addition.
- The trapped and hurt are people near you; the far side of a big quake is told only in the news.
- The rebuild after a wildfire covers the buildings that caught; the burnt ground itself greens again only when the marks are cleared at the end of the recovery.
