# Military bases, police and fists (13 October 2026)

Roaming militias are gone. Armed people now belong somewhere: soldiers at military bases and
their checkpoints, militia at their own compounds, police in cruisers that come when called.
Everything lives in the shared engine and works anywhere on Earth: the Bay and every globe
region, including the towns grown on the globe.

## What changed, by file

| Area | Files |
| --- | --- |
| Factions | `island/src/combat/factions.js`: Meridian Guard (`guard`, military, stationed), Harbour Police (`police`), Ironvale Legion (`ironvale`, invaders). Ridgeback militia is `stationed` with no zones. |
| Clothing | `island/src/combat/outfits.js` (new); `island/src/people/garment.js` (camo pattern 28; bandana, plate carrier, trucker cap, police peaked cap, beret); `island/src/people/body.js` (the new caps count as hats). |
| Squads | `island/src/combat/ai-squads.js`: outfits per side, posts (gate, tower, loop, compound, scene) with a leash, the station rule, police and military call-outs. |
| Fists | `island/src/combat/brawl.js` (rules), `island/src/combat/melee.js` (runtime), `island/src/people/actions.js` (guard, jab, cross, hook, shove, grab, swing, reel). |
| Combat glue | `island/src/combat/combat.js`: `api.hooks` (posts, trespass, event, police), militia compounds, gang and boss events, police instead of the old patrol for the wanted level, melee wiring, a few more api handles (`projectile`, `blast`, `firstHit`, `landShot`, `me`, `squads`). |
| Military | `island/src/military/`: `rules.js` (pure), `kit.js` (materials, builder), `models.js` (vehicles), `base-model.js` (exteriors), `index.js` (runtime), `drive-mil.js` (driving and flying), `dispatch.js` (convoys, air support, invasions), `police.js` (cruisers), `route.js` (road routing), `sound.js`. |
| Shared hooks | `island/src/main.js` (create, update, floors and walls, `Crysis.military()`, `Crysis.base()`), `island/src/drive.js` (board military vehicles; `stop(force)`), `island/src/vehicles/physics.js` (optional custom spec and feel). |
| Tests | `island/tools/military.test.mjs` |

## Siting

`rules.siteScore` samples a 7 by 7 grid over the footprint (380 x 280 m for a garrison, about
1420 x 460 m for an air station). It rejects water, towns (Bay urban density, globe towns'
reach, regional settlements) and built land, then fits a plane through the ground: grade above
2.5 percent or more than 5 m (7 m for an airfield) of ground left above or below the plane is
too rough. The pad is that plane raised just above every sample, banked with earth to the
ground. A freeway or highway within 3 km, or the coast, scores higher. `chooseSite` nudges a
candidate in a spiral and turns it until the ground agrees, or drops it.

Candidates: four in the Bay, named originally after the kind of ground they stand on (Diablo
Flats Depot on old depot grassland by Highway 4, Suisun Plain Air Station on farm flats off
I-80, Pillar Bluff Airstrip on the coastal terrace by Highway 1, Gull Point Air Station on
filled land on the Bay), and a seeded grid over the globe (0.5 degree cells, about 42 percent
holding a candidate, a third of those air stations). Names come from an original word list.

## The base

Fence with a gate, boom and guardhouse; barracks; a headquarters; an armoury bunker; a motor
pool; a fuel point; a helipad; four watchtowers; on an air station a marked, lit runway,
taxiways, an apron, three arched hangars and a control tower. One merged geometry per material
(about 9 draws for a whole base). The parked vehicles are instanced by kind and material and
shared by every base in view.

Interior hook: each barracks, headquarters and armoury has a frame
`{ builder, origin: { x, y, z }, yaw, width, depth, height, floors, floorHeight, base }`.
`HOOKS.military.setInteriors({ buildBarracks, buildWarRoom, buildDepot })` (or the short names)
registers builders; each is called with its frame and may return an `Object3D` or
`{ group, floor, push }`. When a builder returns `push`, that building stops being a solid box.
`Crysis.military.api.frames(name)` lists a base's frames.

Police stations hook: `Crysis.military.api.setStations((x, z) => ({ x, z, name }))`. Cruisers
leave from the station when one is within 3 km of the trouble.

## Spawning rules

- No faction of kind militia or military has zones, so the ambient director never spawns them.
- A stationed side (`guard`, `ridgeback`) may only be made within a post's reach: a base
  (its fence plus 30 m), its checkpoint (60 m), a deployment at a scene (120 to 160 m), or a
  militia compound (70 m). `ctx.mayStation` refuses anything else.
- Militia compounds are fixed per world (1.4 km cells, about a third occupied, never in water
  or among buildings); the director only places militia at the nearest compound within 260 m.
- Garrison: each post is a squad made when you come within 250 m of it and released when you
  leave; losses stay down and the base restocks one soldier every three minutes.

## Vehicles and controls

V beside a parked military vehicle boards it (drive.js asks `vehicleToEnter` first); V or Esc
leaves once it has stopped (aircraft must be on the ground). C swaps the behind view and the seat.

- Tank: W/S, A/D (turns on the spot at a crawl), Rapier physics at 42 t; the turret slews to
  where you look, the gun follows your pitch; click or Q fires a shell (3.6 s reload).
- Armoured truck, jeep: same physics, lighter; the roof gun fires while held.
- Jet: W/S throttle (Shift afterburner), A/D roll, up/down pitch, left/right rudder, Space
  brakes; rotate past flying speed, gear retracts and lowers by itself; a hard, banked or
  gear-up landing is a crash. Click or Q fires the gun.
- Helicopter: rotor spools up; up/down climb, W/S fly, A/D turn, left/right slide.
- Touch: the drive pad, plus Fire (and Up/Down for aircraft).

Taking a vehicle or a carbine from the armoury (L at its door) makes the base hostile for a while;
staying inside the fence past a warning does too.

## Fists

Unarmed, left click, Q or Punch throws a jab, cross and hook; held Q grabs and throws; X still
shoves. Dropped bats and bottles are picked up by walking over them. A hot-tempered person you hit
fights back. In urban areas now and then two adults quarrel: words, shove, fists, a bottle or bat;
most cool down. Fists bring the police; among gangs it can end in guns. Minors are never targets
or brawlers (`canMelee`, the targets.js ward).

## Dispatch

`planDispatch`: the nearest ready base within reach (gang 15 km, boss 40 km, invasion 160 km,
wanted backup 12 km) sends road units when within 25 km and it has them, air units for big
trouble or when far. A patrol is cheap state far away (distance along its road route); within
1.8 km it is drawn, on the scene its troops deploy, its guns engage the other side, helicopters
circle, the jet makes passes. It leaves after 150 s or 40 s of quiet; survivors return to the base.
Gang gunfire goes to the police first; three gang deaths within 90 s bring the military. A boss
spawning calls the military. Invasions come every 25 to 50 minutes (or
`Crysis.military.api.invade()`) from another region over land when possible.

## Police

`policePlan(stars, officers, have)`: a cruiser for every two officers needed, military backup at
four stars (air at five). Cruisers are the town's sedan in navy with white doors and a flashing
light bar; sirens through the world bus; two officers get out at the scene. A parked cruiser is a
solid car you can take.

## Console

- `Crysis.military()`: bases near (status, distance, garrison manned, losses, units, parked),
  patrols, police.
- `Crysis.base('Pillar')`: to a base's gate (the nearest with no name).
- `Crysis.military.api.invade()`, `.alert('boss' | 'gang' | 'riot', severity)`, `.frames(name)`,
  `.setInteriors({...})`, `.setStations(fn)`.
- `Crysis.combat.melee.quarrel()`, `.info()`.

## Cost

A built base: about 9 draw calls. Parked vehicles: one draw per kind and material (about 25 for
every base in view). Police cruisers: the fleet's draws plus 4 instanced overlays. Moving convoy
vehicles are ordinary meshes (5 to 10 draws each), only within 1.8 km. Bases are built within
5.2 km and dropped past 7 km; siting is one candidate a frame at most. Phones: no shadows from
bases or parked vehicles, at most 5 soldiers per base plus the checkpoint.

## Polish (14 October 2026)

### Vehicles (`military/models.js`, `military/kit.js`)

Every vehicle is built from its parts (+z forward, origin on the ground) with a small builder
of lofts, slabs (`prism`), aerofoil panels (`panel`), rounded sections (`sring`) and tubes. Each
part is one geometry carrying its surface per vertex (`mtl`, the `M` numbers) and its rest-pose
position (`opos`), drawn in one shared material, `kit.vehicle` (parked), `kit.vehicleLit`
(in use: lamps glow at night, strobes and beacons flash) or `kit.vehicleBurnt` (wrecks). The
paint colour is the instance colour, so no vehicle owns a material.

- Tank: lower and upper hull of sloped plates, a raised composite slab on the glacis, skirts
  in panels with rubber edges, seven paired road wheels a side, idler, toothed sprocket and
  return rollers, track belts with uv in metres along them whose links scroll by each side's
  run (left and right differ in a turn); wedge turret with cheek armour, mantlet and dust boot,
  commander's cupola with periscopes, panoramic and gunner's sights, loader's machine gun,
  smoke dischargers, bustle rack with bags, aerials; gun with thermal sleeve bands, fume
  extractor, muzzle reference and muzzle (the shell leaves from `userData.muzzle`).
- Armoured truck: faceted V-hull, flared arches, bull bar, lights in guards, armoured glass,
  side and rear doors, roof gun ring with shield, smoke dischargers, cans.
- Jeep and cargo truck: lofted body and bonnet, flared arches, bull bars, roll cage with gun
  ring (jeep), canvas tilt (truck). Wheels are one instanced draw that rolls and steers.
- Jet: lofted fuselage with chines and spine, framed bubble canopy, raked intakes, swept wings
  with leading edge extensions, flaps and ailerons, all-moving tailplanes, twin canted fins with
  rudders (`userData.pose({ surf, gear, throttle, ab })`), nose and main gear that fold away with
  their doors, twin nozzles, a soft flame with the throttle and a long afterburner flame.
- Helicopter: lofted cabin and boom, cockpit glazing, door gunners each side, engine cowlings and
  exhausts, stub wings and pods, skids, chin sensor, four-blade rotor and tail rotor that blur
  into discs (`kit.disc`) at speed.
- Paint: camouflage in three tones of the instance colour (original blotches), panel seams and
  rivets, chipped edges, streaks; aircraft smooth with soot behind the nozzles; mud and dust up
  the lower hull and running gear; the photographic aluminium swatch as metal grain.

### Performance

Parked vehicles: one instanced draw per kind near and one coarse draw past `LOD_FAR` (150 m,
95 m on phones), repartitioned as the camera moves 12 m. Convoy and driven vehicles are a
`THREE.LOD` with the coarse model past the same distance. Triangles per vehicle (near / far):
tank 14.1k / 1.8k, armoured truck 6.6k / 2.3k, jeep 4.7k / 1.8k, cargo truck 5.6k / 2.1k,
jet 3.8k / 2.2k, helicopter 2.9k / 1.5k. Before: tank 3.0k in 6 draws, armoured truck 1.3k in 5,
jeep 1.1k in 6, helicopter 1.3k in 4, jet 1.6k in 5 (26 parked draws at an air station; now 6
to 12). A base is 11 merged meshes and one point cloud of halos (was 9 meshes): about 51k
triangles for an air station (was 24k), 31k for a garrison.

### Flight (`military/flight.js`, `tools/flight-pilot.mjs`)

The jet and helicopter fly through pure steps (`jetStep`, `heliStep`) that `drive-mil.js` and
the tests share. The test pilot forces inputs at 60 steps a second: the jet rolls, rotates at
72 m/s, lifts off at about 450 m, climbs to 300 m with the gear up, flies a four-leg circuit,
descends a three degree slope with gear and flaps down, flares and touches down at 1.3 m/s sink,
wings level, then brakes to a stop on the runway. The helicopter spools up, climbs to 30 m,
holds within 0.12 m, flies 200 m, stops and sets down on a held descend at 1.8 m/s.

Fixed: a held descend in the helicopter used to arrive at 9 m/s and always crash (it now slows
near the ground); lifting off bounced on the ground every frame; the sink when slow jumped in
one frame; the gear and its doors snapped; aircraft and parked jets stood 0.1 to 0.14 m into
the runway, taxiways and apron.

### Bases (`military/base-model.js`)

- Clutter: jersey barrier chicane at the gate and lines at the motor pool and apron, sandbags
  at the guardhouse, armoury and tower feet, wire-mesh blast walls (fill under the chain-link
  material), stacked containers, fuel bladders in an earth berm, generators, a guyed lattice
  mast, three flags with original emblems (`kit.flag`, waving), forklifts, aircraft tugs, a
  windsock; a dressed road checkpoint (`buildCheckpoint`).
- Apron lead-in lines, stop bars and edge lines; taxiway centrelines along their length and
  hold bars where links meet the runway. Two more jets on the apron stands; motor pool vehicles
  park nose out; a cargo truck at every motor pool.
- Night: floodlight masts and street lamps throw pools of light (`kit.glow`, with beams under the
  apron and gate masts), some windows are lit, and every light has a halo that reads from far
  off (`kit.halo` point cloud): runway edge lights every 30 m, thresholds, the approach run with
  a flashing lead, slope indicator lights, taxiway blues, helipad ambers, red obstruction lights
  blinking on masts, a green and white beacon on the control tower.
- Grading: the pad's edges are graded in six rows eased down (or up) to the ground, reaching
  further where they have further to fall (7 to 70 m, smoothed along the edge, rounded at the
  corners) and grassed like the pad; `floor()` walks the same profile.
- Trees: `sportsfields.keepClear` / `releaseClear` register the fence plus 14 m as a clearing;
  the Bay's trees (`inClearing`), the globe's trees and the regional flora keep out of it.
- Convoys: a patrol coming into sight re-routes from where it is along the roads loaded now (the
  survey's, the globe's, a grown town's), keeping the stretch behind it (`route.joinRoute`).

Changes outside `military/`: `sportsfields.js` (`keepClear`, `releaseClear`, custom clearing
tests), `earth/globe.js` (globe trees ask `inClearing`, its version in the trees' key),
`region/index.js` (regional flora asks `inClearing`).

## Known limits

- Base pads are still a plane; the terrain under them is not lowered, so a high fill keeps a
  long graded bank (up to 70 m) rather than a cut.
- Trees already placed before a base is built go when the vegetation next lays out its patch
  (the Bay's trees at once; globe trees on their next slice).
- Convoys re-route along loaded roads once in sight; out of sight they follow the route found
  at launch, which crosses the ground where no roads were loaded.
- Road wheels and the tank's sprocket do not turn (the track links do); tank and jet LODs swap
  without a fade.
- Interiors arrive with the commander's builders; until then barracks, HQ and armoury are solid.
