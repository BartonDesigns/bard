# Sunken road terrain repair

The recording shows severe vertical drops and objects above a lower road surface. A confirmed loading-order bug can cause this: road geometry streams independently of the Bay survey. Road grading previously cached profiles against the temporary -60 metre loading height. Once the survey arrived, those profiles survived, cutting deep trenches through the real terrain. Buildings wait for the survey and therefore stood above those roads.

`createBerms` now waits for the survey readiness supplied by `main.js`. Pending terrain disables both grading textures and invalidates cached profiles. The first ready frame rebuilds without requiring camera movement or a road revision. Profiles live in a per-world WeakMap instead of on reusable road objects, and construction disables previous-world grading bindings.

This changes the common physics and rendering road grade. It does not conceal holes with a second floor or change the survey, coastline, road layout, natural relief or graphic quality settings. Existing sessions need a reload to receive the new engine and rebuild their cached grades.

## Verification

- 19 passing Node tests: the new loading/reload/world-cache regressions, existing intercity road and drive tests, island surface visibility, and Bay phone material checks.
- GPU regression with the actual SF survey and terrain vertex shader, forcing a synthetic road to arrive before the survey: old order gives road height -59.991 m where the survey is 93.406 m. The fixed order gives 92.679 m, preserving normal road grading.
- Four browser cases: before/after in desktop full and touch-emulated lite mode. The before image has a deep vertical trench; the after image removes it. No shader, page, WebGL or context-loss errors.
- Each case samples 441 points in each of SF, San Jose, San Ramon and the Pacific. GPU and CPU ground agree within 0.101 m across these 1,764 points, consistent with existing half-float height storage.
- Production build and whitespace validation pass.

Evidence is in `docs/verification/terrain-loading/`. The forced loading sequence reproduces the confirmed mechanism with real survey data; it is not an exact replay of the user's unidentified saved coordinates. Physical iPhone/Safari confirmation remains open.

## Reproduce

Run `node --test island/tools/terrain-loading.test.mjs island/tools/globe-roads.test.mjs island/tools/surface-visibility.test.mjs island/tools/bay-ground-shader.test.mjs`.

Bundle `island/tools/terrain-height-preview.mjs` as an ES module with esbuild. Run `island/tools/terrain-loading-browser.cjs` with `TERRAIN_BUNDLE` set to that bundle, `PLAYWRIGHT_MODULE` to the installed Playwright module and `CHROME_EXECUTABLE` to Chromium if needed. The runner serves the bundle and real local assets on an ephemeral localhost port. Its `unsafe` comparison intentionally bypasses only the new readiness gate, reproducing the old load ordering.
