# Continuous Crysis orbital flight

The planet's player, renderer and world remain alive throughout ascent and descent.
The launch control now starts an interruptible climb. Flying up manually works too.
There is no Journey transfer, loading card, world teardown, forced pitch, or input reset
on this route. Reversing direction in the atmosphere is supported.

This is the first migration pass. It does not replace the existing galaxy simulation.
**Sky & World → Explore galaxy** retains that route, including its existing loading
handoff. The complete flight preservation inventory lives in `../docs/`.
Do not remove the legacy engine until its active features have verified replacements.

## Controls and return position

- `F` / the flight button enables flight; WASD / joystick moves where you look.
- Space / ⇡ climbs; C / ⇣ descends toward the departure planet. Shift and the ×1 / ×3 /
  ×6 / ×9 booster cycle remain available. Releasing movement eases velocity to zero.
- The rocket starts a continuous climb, with no cinematic. Steering, looking,
  pressing a movement key, clicking the rocket again, or losing focus cancels it.
- At 12 km the local ground frame and precise departure coordinates are captured.
  Orbital rendering blends in over 12–60 km; above 60 km ground rendering and streaming
  stop while the same player keeps running. Space is labelled above 100 km.
- The ×1 / ×3 / ×6 / ×9 booster control remains visible and usable after the orbital
  renderer takes over. `B` and the touch button use the same cycle, and music adds only
  a bounded thrust response.
- A return from another side rebases the orbital coordinate frame above 95 km,
  carrying camera orientation, velocity, the moon, sun, stars and globe together.
  The retained ground patch remains at the original departure coordinates. Radial
  descent returns to those coordinates; the player can steer away during descent.
- The last surface save is retained while in orbit. Reloading resumes that departure
  area using the existing Crysis save system, rather than saving invalid space coordinates
  as a surface address. Arbitrary deep-space pose persistence is not implemented.

## Rendering and music

`src/space/frame.js` owns coordinate math and speed limits. `flight.js` bridges the
existing player/HUD and `view.js` draws a camera-relative orbital pass. There is one
WebGL context, one fullscreen mesh, one globe texture, and no extra render targets.
The Earth texture is baked from the same local globe cells as the surface using
`node island/tools/bake-orbit-earth.mjs`. Its credits are in `assets/globe/CREDITS.md`.
Other planets use their seeded profile colours. If the Earth texture fails to load,
the procedural fallback remains controllable. That fallback does not reproduce real
continents.

The faceplate's `L99Continuity` analyser continues to update every frame. Bass drives
the atmosphere response, mids the galactic haze, and highs/pulses the stars. Bass and
strike pulses add at most 12% to **commanded** thrust; music alone cannot accelerate
the player or change heading. Surface ambience fades with atmosphere density through
a transient gain; the user's world volume setting and the instrument audio are unchanged.
This is a new orbital response layer, not full parity with the old resonance rigs,
levitation, fauna reactions, shockwaves, and lore/music progression.

## Verification

```
npm --prefix island ci
node island/tools/orbit.test.mjs
node island/tools/world-resources.test.mjs
node island/tools/realcity-lifecycle.test.mjs
node tools/gargantua.test.mjs
npm --prefix island run build
BARD_URL=http://127.0.0.1:8766 node island/tools/orbit-browser.cjs
```

The browser test requires Playwright/Chromium and a local server for the whole repo.
It advances the real player controller at fixed timesteps between rendered boundary
checks, so it is a functional round-trip regression rather than a real-time performance
benchmark. It checks held keyboard input in space, launch-assist cancellation, touch
release, repeated exact-coordinate return, the same world/context, analyser response,
no transition loading overlay, and page/shader errors.

The orbital unit test also covers the companion collider, the fixed Sun and Gargantua
positions, and the deep-space gears with their approach guard.

Native iPhone/Safari performance, long sessions, and visual continuity across every
biome remain device/acceptance checks. The orbital globe is a coarse rendering level;
the ground is still a retained local patch, not a fully spherical terrain mesh.
The native orbital pass includes the departure planet, its companion (Earth's Moon,
the Moon's Earth, or a gas giant), the Sun, stars and Gargantua. All are fixed world
positions in the orbital frame (`frame.js`: MOON, SUN, GARGANTUA); nothing is steered
toward the view. The old camera-facing beacon (a red nine-lobed ring round a black
core, eased onto the view centre) is gone; labelled markers (`nav.js`) mark the bodies
and can be tapped to target one.

- **Gears:** B cycles 1/3/6/9 near a world; above 100 km it carries on to ×100, ×1k,
  ×10k and ×100k. The gear eases in proportion; speed toward a surface or safety shell
  is held to three times the gap per second, so approaches slow exponentially.
  Stars streak from about 250 km/s.
- **Warp:** J or the ⤳ Warp button lists the home world, its companion, the Sun,
  Gargantua and one world of every planet type. Local bodies: about 3.4 s of tunnel,
  dropping out at a safe distance. Other worlds: the tunnel, then `voyage()` in
  `main.js` builds the world through `api.open` and drops the ship 160 km above it.
- **Moon:** a `MOON` profile (grey regolith, 46 craters, airless, 0.17 g). Descending
  within 25 km of the Moon lands through the same world build. The Moon sits 150,000 km
  out at its real radius, so it reads larger from Earth orbit.
- **Sun and Gargantua:** heat haze, warning and shield readout inside 40 solar radii;
  inside 8 (or 8 Rs of Gargantua, or a giant's cloud tops) the ship is eased back out.

The legacy universe's other systems remain on the galaxy route.

## Body identity and physical music response

`space/body.js` carries a versioned descriptor through world reuse and saved locations.
It preserves the original fractional seed, type, palette/primal flags, supplied body/system/galaxy IDs,
and the effective Crysis profile, separately from the established integer terrain seed.
Old links remain readable. Full legacy progress migration and universe-registry population remain open.
Departure saving now works even for a straight vertical launch; page-hide saving in orbit cannot
replace the departure with space coordinates.

The shared faceplate sampler includes synth, enabled microphone and DJ audio even before legacy
flight loads. `music/performance.js` exposes actual held/released synth voices and audible bass
attacks. Recorded tracks/mic input supply bands, not invented note identities. Dominant audible
BPM is available to consumers. No new audio routing or microphone permission is introduced.

Nearby streamed island boulders use spring lift while an audible synth note is held, then gravity
and bounded bounce after release. Actual instance matrices move, including picking and shadows;
vertical collision filtering lets the player pass beneath lifted rocks. They do not become
standable moving platforms or full rigid bodies. Bass fronts produce delayed bounded impulses.
Wild-country boulders/outcrops and the full plant shockwave shaders still need migration.
Flying wildlife responds under the existing opt-in music-mode setting; the Sky & World panel
exposes it. Full species behavior, trust and audience remain outstanding. All ten native kinetic instrument types
are now available; multi-rig persistence and wider legacy progression remain outstanding.

Checks: `node island/tools/music-performance.test.mjs`,
`node island/tools/music-bridge.test.mjs`, and
`BARD_URL=http://127.0.0.1:8766 node island/tools/music-browser.cjs`.
The browser test uses a real faceplate voice lifecycle with controlled analyser energy; source-mix
fixtures cover DJ/mic FFT combinations. These do not replace native device/listening tests.


## Native kinetic instruments

Sky & World places any of the ten authored rigs on sampled clear, flat ground: garden,
pendulum, dominoes, chimes, cradle, droplets, harp, stairs, fountain and wave bars.
`music/kinetic-rigs.js` retains their distinct event timing; `kinetic-view.js` renders
pooled geometry for their distinct silhouettes. All events use actual faceplate
`playLead`/`stopLead`, preserving the current instrument/FX. This route does not provide
per-ball stereo panning.

The menu exposes Stop/Replay/Clear, current or authored scale and pitch offset, live
garden gravity/restitution, replay drop height and cascade tempo, and droplet density.
Pendulum and other authored periods remain independent of the tempo control. Placing
uses audible BPM; later replay respects manual settings, with an explicit track-tempo
sync button. One rig, eight concurrent voices, 24 notes/second and bounded catch-up
limit work. Stops/hide/orbit release owned voices; Clear/travel/teardown dispose meshes.
Replay after returning is explicit. Globe frame rebasing is held while an orbital
anchor is active, so a lateral ascent cannot invalidate the saved departure coordinates.
Rigs are not saved across reload/world replacement and do not provide player-platform
collisions; multi-rig persistence and wider progression are separate migration work.

Checks include `kinetic.test.mjs`, `kinetic-placement.test.mjs`, the authored-rig/model
and renderer tests, `expansion-browser.cjs` and `completion-browser.cjs` in `island/tools`.
These check the actual faceplate integration and bounded resource use; software-browser
timing is not native iPhone/Safari performance certification.
