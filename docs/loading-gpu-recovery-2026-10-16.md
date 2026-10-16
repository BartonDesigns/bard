# Loading and graphics recovery — 2026-10-16

The reported desktop failures included a lost context during renderer construction,
null shader precision data, widespread invalid shader programs, and three separate
console warnings. The logs do not establish a specific hardware/driver root cause.

## Changes

- Desktop defaults to Auto, starting at medium and adapting to slow frames. Saved
  High/Low selections remain supported. Render resolution has a total pixel budget
  as well as a DPR cap; MSAA is reserved for explicit High.
- Renderer creation validates WebGL and shader precision before Three initializes.
  A failed attempt releases its context and retries once on a fresh canvas with
  lighter options. HUDs and event listeners are created only after success.
- Shader warm-up uses asynchronous compilation where supported, skips hidden and
  offscreen content, and runs one batch at a time. Background compilation pauses
  when frames are slow. Context loss cancels pending warm-up bookkeeping so an
  unfinished compiler query cannot keep loading waiting indefinitely.
- Initial world visibility is established before warm-up. Heavy world-building
  phases yield to the browser. The unbounded second Earth shader warm-up is removed.
- The governor sees elapsed frame time instead of only the capped simulation step.
  Graphics memory estimates account for MSAA and discard obsolete resource records
  after restoration.
- Terrain shader failures remember the lighter terrain preference immediately.
  Later unrelated failures no longer erase the evidence before context loss.
- House shading stores its RGBA requirement as builder metadata, preserving it
  through material cloning and wall damage, rather than passing the unsupported
  `vertexAlphas` constructor option. Redundant conversion of already non-indexed
  geometry is removed from the reported saltpond bush and the deep geometry merger.
- SVG and multi-size ICO favicons are provided; the HTML points to both.

## Verification

47 focused Node tests passed across graphics startup, shader warm-up, governor,
resource disposal, house/wall damage, and underground traversal. The new cases cover
null precision, bounded retries, pixel budgets, hidden/offscreen warm-up, asynchronous
cancellation, restored GPU accounting, and RGBA house materials.

The shipped bundle was exercised in headless Chromium with SwiftShader:

- One invalid initial context recovers using a fresh canvas.
- Two invalid contexts produce a useful error and leave no HUD; a later retry
  creates exactly one HUD and a functioning renderer.
- Generated island and Earth worlds load and render without frame exceptions.
- Forced context loss/restoration preserves the world and resumes rendering at
  a lighter tier. The Earth run reported no shader/material/geometry warnings.
- Both favicon resources return HTTP 200 locally.

The test environment uses software graphics. Frame times and startup times are not
claims about desktop GPU performance or Safari. Initial profiling showed reduced
graphics work and a modest loading-time change; first-load world generation remains
substantial. Zero latency or elimination of every hardware/driver reset is not
established by these checks.

Reproduce with `node --test island/tools/graphics-loading.test.mjs
island/tools/governor.test.mjs island/tools/world-resources.test.mjs
island/tools/destruction-house.test.mjs island/tools/destruction-walls.test.mjs
island/tools/deep-gate.test.mjs` (as one command). Browser harnesses are
`tools/graphics-startup-browser.cjs` and `tools/loading-performance.cjs`;
set `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` as needed. The latter accepts
`BARD_TEST_EARTH=1`, `BARD_TEST_RESTORE=1`, and `BARD_PERF_OUT`.
