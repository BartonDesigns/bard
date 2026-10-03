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
- Space / ⇡ climbs; C / ⇣ descends toward the departure planet. Shift and ×3 boost
  remain available. Releasing movement eases velocity to zero.
- The rocket starts a continuous climb, with no cinematic. Steering, looking,
  pressing a movement key, clicking the rocket again, or losing focus cancels it.
- At 12 km the local ground frame and precise departure coordinates are captured.
  Orbital rendering blends in over 12–60 km; above 60 km ground rendering and streaming
  stop while the same player keeps running. Space is labelled above 100 km.
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

Native iPhone/Safari performance, long sessions, and visual continuity across every
biome remain device/acceptance checks. The orbital globe is a coarse rendering level;
the ground is still a retained local patch, not a fully spherical terrain mesh.
The native orbital pass currently includes the departure planet, moon, sun and stars;
the legacy universe's other systems remain on the galaxy route.
