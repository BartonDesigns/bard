# Sound design: engines, thrusters and the places' air (14 October 2026)

The world had a quiet car hum, a few military engine tones and good beds for the city and the
wild. It now has engines with gears, a tank that clatters, jets that spool and crackle, rotors
that slap, thrusters that follow your flight, freeways you hear from their side, rain that
sounds like what it falls on, and the faceplate's own quieter sounds carried into the world so
the instrument and the world feel like one thing. Everything still goes through the one way in
(`world/soundbus.js`), under the world's compressor, the duck while music plays and the peak
guard (see `docs/music-fidelity-2026-10-13.md`).

## Files

| Area | Files |
| --- | --- |
| The engines' arithmetic (pure, tested) | `island/src/audio/engine-model.js`: profiles by kind, the gearbox, firing rate, spool, distance, air, Doppler, budgets, voice picking |
| Engines and traffic | `island/src/audio/engines.js`: voices, the vehicles' bus, the ears, occlusion, sleeping voices, the traffic pool |
| Faceplate sounds for the world | `island/src/audio/palette.js` |
| Thrusters | `island/src/audio/thrusters.js` |
| Places' air and rain on surfaces | `island/src/audio/environment.js` |
| Wiring | `island/src/audio/audio.js` (one call each per frame; `space(dt)` for the orbital frame), `island/src/world/soundbus.js` (`cabinOut()`) |
| Hooks elsewhere | `island/src/drive.js` (your car: `hum()` in the road and free modes, stopped in `stop()`), `island/src/military/sound.js` (engine now a wrapper on `engines.js`; rounds capped, varied, duller far off), `island/src/military/drive-mil.js` (three `engine.set` calls pass where the vehicle is, its nose, and your seat), `island/src/military/dispatch.js` (one call passes `u.pos`), `island/src/bay/citysound.js` (the nearest-car tone replaced by the traffic pool; horn at the faceplate's 415/524 Hz), `island/src/main.js` (one line: `worldAudio.space(dt)` in the space branch) |
| Tests and tools | `island/tools/engine-sound.test.mjs`, `island/tools/engine-sound-browser.cjs` (headless run, node counts), `island/tools/engine-sound-samples.cjs` (offline WAV renders) |

## The engine model

Each kind has a profile (`PROFILES`): cylinders, idle and red line, the speed each gear reaches at
the red line, fuel (petrol, diesel, turbine, rotor), and character: a V engine's burble, a
diesel's knock, a turbo's or a gearbox's whine, an exhaust resonance, crackles on a sports car,
how long a change takes. Kinds: sedan, hatch, crossover, suv, pickup, van, delivery, sports,
truck, bus, apc, jeep, tank (gas turbine), jet, heli. There are no motorbikes in the game yet; a
profile is one line when there are.

`gearbox(profile, speed, throttle, dt, state)` gives the gear and rpm. It changes up early at a
gentle throttle and late flat out, down when it labours, holds the throttle off through a change
(the revs drop to the next gear), slips the clutch pulling away (revs before speed), and puts
reverse in first. The note is the firing rate, `rpm / 60 × cylinders / 2`: a V8 at 3,000 rpm
sings at 200 Hz, a four at 100 Hz. Physics has no gears of its own, so the speed and the throttle
from `vehicles/physics.js` drive it.

The sound of a combustion engine: a buzzy pulse at the firing rate (a periodic wave, odd
harmonics stronger), a half-rate sine for the burble, a low-pass that opens with load and an
exhaust peak; combustion grit (noise puffed at the firing rate); a diesel's knock (bright noise
struck by a square at the firing rate, strongest at idle); a turbo whistle or gearbox whine; on
your car the tyres' roar with speed and a squeal on the handbrake; on a sports car two to five
crackles off the throttle and one at a quick change up. At the wheel the faceplate's metronome
click marks a change, far quieter than on the faceplate.

The tank: two turbine sines rising with the spool, the turbine's air roar, a low rumble, the
tracks' clatter (noise struck at the rate links meet the sprocket, speed / 0.17 m) and the road
wheels' clank. The jet: a spool that takes about three seconds up and longer down, a whine and
its compressor partner, a roar that opens with the spool (louder behind it, the whine louder
ahead), a rumble, and the afterburner: a hiss broken by two square beats out of step, an
irregular crackle. The helicopter: a spike wave at the blade rate (four blades × 4.6 Hz at full
rotor speed) strikes a band of noise (the slap, sharper with load and speed) and a low thump; the
tail rotor five times faster; the turbine.

## Placing a voice

Every engine is a voice in the world: level falls as 1 / distance past a reference (5 m for a car,
10 m a tank, 20 m a rotor, 25 m a jet) and eases to nothing at its range (450 m, 900 m, 2 km,
3 km); the air takes the highs off (a low-pass at `20000 / (1 + d / 110)` Hz, never under 500);
it is panned by where it is (never fully to one side); its pitch and its noises' playback rates
follow the Doppler factor from its speed toward or away from you (source velocity is worked out
from its own positions, the ears' from the camera's). A mapped building between you and it (a 2D
test against the few boxes near the line, three times a second per voice) dulls it to 900 Hz and
takes 5 dB off. Indoors the vehicles' bus closes to 500 Hz. In a vehicle's seat its engine is
centred, filtered to 1.5 kHz and a little quieter.

## The mix and the budget

Voices are ranked by priority × how loud they would be: yours 3, the military's 2, others 1. Only
the top few have nodes: the rest sleep (their state still follows, so a voice wakes at the right
rpm), fading out, and their nodes are let go after 1.2 s asleep. A voice already sounding keeps
its place unless a newcomer is half as loud again (no flicker between two of a kind).

| | Desktop | Phone |
| --- | --- | --- |
| Engine voices | 6 | 3 |
| Traffic voices | 4 | 2 |
| Gun rounds ringing at once | 6 | 3 |
| Exhaust crackles at once | 4 | 2 |
| Environment one-shots | 4 | 2 |

Node cost: a full combustion voice (your car, a diesel) about 27 nodes, a passing petrol car 16,
a tank 24, a jet 22, a rotor 20; on a phone the grit, knock, whine, burble, compressor partner,
clank and tail rotor are left out (8 to 19 nodes). A traffic voice is 9 nodes (a firing note and
the tyres), the far traffic hum 4. Worst case on a desktop is about 190 engine nodes; on a phone
about 70. No convolution anywhere in this work; the rain textures are one- or two-second loops
baked once per context (one second and fewer drops on a phone).

Levels were set by rendering and measuring (see Samples): the car you drive from behind about
-21 dB RMS flat out, a truck -20, a tank passing at 12 m -23, a jet passing at 100 m -22, a
helicopter at 50 m -25, traffic at 4 m -27 to -30; all through the world's compressor and duck.

## Traffic

`createTraffic()` (driven from `citysound.js`, which already has the street's cars with their
positions and velocities) gives its few voices to the loudest moving cars within 160 m, each with
its own gearbox state (the throttle guessed from its acceleration), Doppler and pan, tyres
brighter and louder on wet roads, through the walls indoors. The cars it cannot voice (beyond
160 m to 400 m, or more than the voices) are the faceplate's car hum (two sawtooths at 52 and
55.5 Hz beating under a 160 Hz low-pass), its level by how many there are. The pool lets go of all
its nodes four seconds after the street empties.

## Thrusters

`thrusters.js` reads your flight from the player's state and space flight's info (no hooks in
`space/flight.js` or `flight-speed.js` were needed): thrust is your speed on a log scale against
where the booster is heading, plus how fast it is rising. A pink hiss (brighter harder) and a brown
rumble follow it; a deep tail (the burn heard after) lingers when you ease off. Stepping the
booster up kicks (a falling 80 to 32 Hz thump and a rising whoosh), stepping it down settles. In
space, the faceplate's flight ambient loop is the cabin, and in the far gears (×100 and up) the
abyss's 35 Hz groan wanders under it. A warp is a long rising rush, and arriving plays the
faceplate's ceremony chord at a fifth of its level. They play through `cabinOut()`, a gate in
`soundbus.js` under the world's volume but not the air's, so they go on in space where
`worldAir(0)` silences everything outside. Near the ground they sit under the air rushing past.

## Environment

`environment.js`, over the existing beds (citysound, naturesound, weather, ambience):
the air rushing past with speed (none walking, dull inside a car, none in space through the air
gate); a freeway's roar from its side (motorway and trunk roads within 450 m, looked up every
1.5 s, louder by day, swelling); a downtown's air handling (the faceplate's city hum: a 68 Hz
triangle and a 91 Hz sine under a 210 Hz low-pass); a far mower or leaf blower in the suburbs on a
fine day; the desert's thin high wind and low gusts; the dark wind over snow; the canopy's rustle
in the woods; ravens over snow and summits, a dove's three coos at dawn and dusk in the desert;
and the rain on what is round you, a texture of drops for each: leaves, the street, the car's
metal roof (in a seat), a roof over you (indoors), water, and soft ground; cross-faded as you move.
The existing wind by altitude and exposure, the rain hiss and the room tone indoors stay where they
were (`world/weather.js`, `bay/citysound.js`).

## The faceplate's sounds reused

From the flight route (`runtime/flight-179.js.gz`, played there through `L99Route223`'s
`flight-sfx` and `flight-foley` buses), the subtle ones, re-made in `audio/palette.js` and turned
down:

| Faceplate | Where in the world |
| --- | --- |
| The flight's ambient loop (smoothed-noise wind at 480 Hz, sine pads at 110 and 165 Hz breathing at 0.06 and 0.09 Hz) | the ship's cabin in space |
| The nearest car's sub hum (sawtooths at 52 and 55.5 Hz, 160 Hz low-pass) | the traffic beyond the voices |
| The hum near the shelters (68 Hz triangle, 91 Hz sine, 210 Hz low-pass) | a downtown's air handling |
| The abyss's dread (35 Hz sine, 0.18 Hz wander of 8 Hz) | the far burn in the high gears |
| The ceremony's triad (G3, third, fifth, octave, triangle) | arriving from a warp |
| The metronome's click (square, 45 ms) | a gear change at the wheel |
| The suburban horn (square 415 and 524 Hz, 1.4 kHz low-pass) | the city's horns (were 405 and 510) |

The faceplate's bird chirp and rain hiss already match the world's own (citysound's chirp, the
weather's rain), so they were left as they are. The drum kits and instrument voices are music and
stay with the music.

## Checks

- `node --test island/tools/engine-sound.test.mjs`: rpm from speed and gear (rises in a gear,
  drops at each change, stays between idle and red line), earlier changes at part throttle, clutch
  slip, no load through a change, reverse, firing rates, spool times, distance, air and Doppler,
  voice picking with hysteresis, phone budgets, thrust mapping; and with a pretend audio context:
  only the budget's voices have nodes, your car outranks the rest, every node is let go when the
  engines stop, and the traffic pool keeps to its voices and lets go when the street empties.
- `node island/tools/engine-sound-browser.cjs`: enters the world headless, steps the audio by hand
  (600 frames standing, 300 flying with the booster stepped twice, 300 landed, 600 standing) and
  fails if nodes keep being made at the end; then stands, drives with W held, flies stepping the
  booster, takes a military vehicle if a base is near, counting every audio node made and
  disconnected and reporting the engines, beds and thrusters over time. SwiftShader runs the world
  at about 0.3 frames a second, so the real-frame phases are slow and stretched; the hand-stepped
  phase is the reliable leak check. Results on `?planet=TERRAN&seed=77`, desktop and phone: no
  growth after landing (121 nodes made, then none over 600 more frames), thrusters on with two
  kicks and their 13 nodes let go after landing, the engines within budget and released. On the
  Bay Area (first run) your car's voice woke at 2,373 rpm and was within budget.
- It found a leak that predates this work: `ambience.js`'s planet-air bed made a gain every frame
  on worlds with no air of their own (TERRAN, OCEAN, TROPICAL...), about 30 a second. Fixed.
- Driving on a planet with no street vehicles threw in `drive.js` (`W.vehicles.setMine`); now
  guarded, so the free car (and its engine) works there too.
- `OUT=dir node island/tools/engine-sound-samples.cjs`: renders car-rev, truck-pull, jet-pass,
  rotor-pass, tank-pass, traffic, flight-boost, space-cabin, rain-car-roof and rain-leaves to WAV.

## Left to do

- Engines for the people's own cars parked and starting, the boats, and the boardwalk rides.
- A starter-motor crank and a stall; a proper reverse whine; surface-dependent tyre noise (gravel
  and dirt) for the free car (the road assist knows the road class, the physics does not).
- The police cruisers' engines (their sirens are there).
- Occlusion only knows the mapped buildings (`real.near('boxes')`); terrain does not block.
- Distant jets and helicopters on patrol fly constant (rpm 0.6); dispatch could pass their speed.
