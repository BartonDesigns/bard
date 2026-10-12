# Terrain boundary and surface visibility repair

The reported San Francisco, Pacific Ocean and San Jose views exposed a surface ownership defect. Every world now has an underground scene. Its per-frame visibility loop re-enabled the local island ground, grass and turf. The subsequent distance culler returned early while the camera remained in the same distance band, so the island mesh stayed visible outside its intended area after the first frame.

Changes:
- `world/surfacevisibility.js` composes cave visibility and island distance on every frame for camera-centred ground layers. Static island scenery still updates only when its distance band changes.
- `main.js` delegates those layers to that single visibility owner. Cave return no longer depends on crossing a distance-band boundary.
- The finite island terrain shader also clips fragments outside the actual height-map bounds. Its clamped border heights cannot extend a ground sheet across the Pacific or an inland city. Lunar terrain retains its intentional far extension.
- Bay survey heights, building heights and the coastline data are unchanged.

Verification:
- Replayed the previous `islandReach` function from the release source at San Francisco: outside-island terrain was hidden on frame 0, re-enabled on frames 1 and 2.
- Four targeted regressions pass: repeated frames over the Pacific/San Francisco/San Jose; cave descent/return without changing the distance band; the lunar far extension; island scenery visibility with lights and the sailing boat preserved.
- Existing Bay shader and world-resource regressions also pass: 11 tests total. JavaScript syntax and `git diff --check` pass.
- An isolated WebGL readback sampled 567 real Bay positions. Pacific points with CPU heights below -2 m did not become positive on the GPU. This rules out a general positive-ocean error in the baked survey/height sampler on Chromium software GL; it does not establish physical Safari parity.

Run: `node --test island/tools/surface-visibility.test.mjs island/tools/bay-ground-shader.test.mjs island/tools/world-resources.test.mjs`.

- Production-world software render at 37.754, -122.515, 600 m altitude: Pacific water is visible; local island terrain, grass and turf are hidden. `pacific-software-render.png` and `render-state.json` preserve the result. Manually hiding island terrain produces the identical image because that mesh is already hidden. This capture does not reproduce the original Safari ridge pattern and is not an original-versus-fixed visual comparison.

Physical iPhone/Safari confirmation of the user's exact saved location remains a follow-up. The confirmed visibility conflict and finite-map leak are repaired; the software-GPU findings must not be described as native-device proof.
