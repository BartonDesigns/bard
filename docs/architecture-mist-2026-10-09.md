# Architecture mist completion, 9 October 2026

The in-cloud screen veil now follows the same displaced band, coverage lanes, tower
openings, drift, ground clearance and radial fade as the rendered mist. The old veil
used flat heights and an unconditional opacity floor, which obscured the settlement
while the camera stood in clear air. The new CPU field also interpolates the actual
triangles used by the 30-segment phone and 52-segment desktop decks. It retains dense
cloud and clears opacity immediately on leaving it or entering an interior.

No cloud deck, wisp or hero-cloud geometry or shader was changed. CPU/GPU sine-hash
precision remains approximate; this is not a pixel-exact noise equivalence claim.

## Rendered phone verification

The restored source was bundled into a scratch preview of the full game. Production
`index.html` and `island/dist/island.js` were not changed by the harness. Chromium with
SwiftShader rendered TERRAN and GAS worlds at seed 4242, dusk 18.5, at 640 × 420 with
a Mobile Safari user agent and touch enabled. This activates the real phone tier;
touch alone does not select it.

Ten fixed-camera before/after pairs cover a clear lane and dense cloud in each of the
two bands, plus an outside overview, on both worlds. The before frame substitutes only
the original veil opacity and colour. The rest of the world, wind, clock, lighting,
cloud geometry and camera remain fixed.

- All ten pairs passed with zero page, shader or GL errors, context losses, black
  samples or failed local asset requests.
- Both worlds used six layers, 30 segments, 5,766 deck vertices and three mist meshes.
  Before/after geometry counts were identical.
- All four clear-air samples changed from 0.339–0.850 opacity to exactly zero.
- The dense samples remained visible at 0.215–0.850 opacity, including displaced
  cloud above the old flat-height envelope.
- Both outside overviews were byte-identical before/after PNGs.
- The retained clear-lane and dense-cloud images were visually inspected. The towers
  and bridges remain visible through gaps while dense cloud still obscures them.

This run completes the previously pending phone check. The earlier desktop pass used
11 layers and 52 segments; it was not repeated here. After workspace recovery the
production bundle exactly matched the previously tested source build (SHA-256
`508952955d1266750a79d16be5937b053d2376ed59bd8def8131e20a95e2a26d`). The five tests in
`island/tools/arch-mist.test.mjs` also cover both mesh resolutions and production
opacity reset. Software WebGL does not establish physical iPhone/Safari performance.

## Evidence and reproduction

`docs/verification/architecture-mist/report.json` contains all ten measurements and
PNG hashes. Eight representative PNGs are retained alongside it, covering the clear
and cloudy states on both worlds; `retained` records which images are included.

Bundle `island/tools/arch-mist-preview.mjs` with esbuild as an ESM browser bundle to a
scratch file. Run `island/tools/arch-mist-browser.cjs` with `ARCH_MIST_BUNDLE` pointing
to it, `ARCH_MIST_OUT` selecting an output directory, and Playwright/Chromium selected
through `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` and `CHROMIUM_ARGS`. The harness hosts
its own asset server. Run under `flock /tmp/bard-browser.lock` when sharing a renderer.
It defaults to the bounded phone checks; `ARCH_MIST_TIERS=desktop,phone` runs both
viewports with a fresh browser process for each.
