# World handoff completion, 9 October 2026 UTC

## Changes

- Globe vegetation now samples inland lake and streamed river levels. Submerged roots are
  excluded, the near bank favours shrubs, and occasional trees remain above the water.
  Both near and far vegetation tiers use this rule. Lake levels come from the same CPU
  heightfield metadata used by the lake shader, with its mask and bed-clearance thresholds.
- Globe lakes expose `waterAt` for player swimming. The Earth `main.js` hook includes it
  after the existing Boardwalk and streamed-water samplers. Raised lake surfaces previously
  rendered without supplying that level to the player.
- Globe lake banks blend damp soil/gravel into grass; the ocean retains sand. Bay creek/lake
  masks suppress the sea-level beach treatment. Snow continues to cover cold banks.
- Swimming forward while looking below 20 degrees starts a dive. Looking down while idle,
  reversing or in a cave does not. Upward swimming still returns to the surface, and the
  bottom clearance remains enforced. The first above-surface descending frame no longer
  cancels a dive.
- Explore has wider establishing views, slow crane moves and side reveals, with zero-velocity
  easing at each end. Animated shots finish their phrase-length move before the next cut.
  Beat-driven distance pumping is removed. Flight physics, speed tiers, approach height,
  ground streaming and manual control bindings are unchanged.
- The existing car WIP already contained cabin/wheel-liner containment and layered model
  depth offsets. Duplicate imported faces with cyclically rotated indices now count as
  duplicates instead of raised trim. Modified geometry bounds are refreshed.

## Verification

`node --test island/tools/water-movement.test.mjs island/tools/vehicle-layers.test.mjs island/tools/explore-shots.test.mjs`
passes 11 tests, exercising real player updates, actual Explore camera/steering and all ten
procedural vehicle shell/cabin builders, as well as depth layers and shoreline rules.

Bundle and run `island/tools/world-finish-preview.mjs` plus `world-finish-browser.cjs` for
the isolated WebGL review. Chromium/SwiftShader produced zero page, shader or GL errors.
Seven architecture-bloom strength/on/off transitions retained the scene and restored the
render target and auto-clear setting; a framebuffer resize also passed. Mean image
brightness was 75.61 without glow and 78.23 at full glow. No black frame reproduced in this
isolated check, so the bloom implementation was not changed speculatively.

The actual globe-tree builder placed **zero** plants in the submerged fixture and **511**
on its raised bank/dry counterparts. These use the same seed and candidate positions.

`docs/verification/world-finish/vehicles.png` and `render.json` retain the rendered vehicle
overview and measurements. The image shows current procedural fallback models; it does not
claim all imported models, native-device performance or a full-world architecture walk.
The release coordinator runs the full Bay/globe/planet shader and architecture smoke on the
rebuilt release. Main.js integration and generated assets are owned by that release step.
