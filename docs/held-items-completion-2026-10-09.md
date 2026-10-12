# Held-item completion

The first three asset-review defects are corrected in production source:

- Canvas tile 13 no longer interpolates into iridescent film tile 12. Tile selection
  has a small boundary tolerance and decoded edge wear is clamped. The shader cache
  version changes with the fix.
- All 20 inventory entries now have an explicit model, icon and grip. New models cover
  two supply boxes, a charge pack, a quiver, the relay board, flight recorder, sealed
  regolith core and harvest crate. These remain closed, fictional game supplies.
- The net uses crossed cords with actual holes at both detail levels. It remains one
  shared-material mesh: 2,960 high-detail triangles and 656 low-detail triangles.

The new items use the existing tier/level finish system and shared geometry cache.
High/low counts range from 636/468 for the scout box to 2,480/1,600 for the harvest
crate. There are no new textures, asset fetches or additional per-item draw calls.

## Verification

`island/tools/held-review-entry.mjs` now includes a validation entry. It checks every
catalog entry for finite geometry, explicit nonsingular grip frames and lower LOD
budgets. A ray grid confirms 78% of the sampled net bag area is open. A production
shader probe reads back all 16 tile IDs and both wear endpoints at three oblique
angles, detecting the original interpolation failure rather than inspecting source
strings. Forty full-size views and 80 low/high/tier combinations rendered without
page or shader errors in Chromium 153.

Reproduce with an installed Playwright Chromium:

```
cd island
npx esbuild tools/held-review-entry.mjs --bundle --format=iife --outfile=dist/held-review.js
flock /tmp/bard-browser.lock node tools/held-browser.cjs
```

`CHROME_EXECUTABLE`, `PLAYWRIGHT_MODULE` and JSON `CHROMIUM_ARGS` support an existing
renderer runtime. The temporary review bundle is not a production asset.

Review exports: `Bard-new-held-models.png` and `Bard-held-material-fixes.png`, rendered
from the real models. The prior review pack is retained as the before-state; its
missing-model and shader findings describe that older checkpoint.

These checks establish coverage and remove the observed material/geometry defects.
They are not a claim of AAA art quality or real-phone GPU performance.
