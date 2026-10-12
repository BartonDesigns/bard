# Families finish pass, 9 October 2026 UTC

The existing household/schedule/teen implementation is retained. The finish pass closes
runtime, gameplay and lifecycle gaps rather than replacing the people or their art.

- Household food, well-being, bank donations and garden plots persist by neighbourhood.
  The local cache is bounded; old food history is compacted when saved.
- Contextual aid buttons appear near food banks, markets, grocery walks and dinners.
  They spend the inventory wallet and feed the common morality ledger. Donated food is
  distributed to households by need instead of remaining an unused number on the bank.
- Children, teens, parents and neighbours use the same `combat/targets.js` minor protection
  through the combat actor provider. Staged actors honor civilian overrides, conversation
  pauses, ragdolls and cleanup. Infants are no longer silently converted into walking
  preschool bodies for dinners.
- The school run selects distinct households. Household adoption keeps age, life stage,
  school and minority classification consistent. Rendered bodies match member sex.
- Dinner guests use existing house chairs with their actual dimensions, rotations and
  seat counts. No second table is created inside a real dining room. Dinner backpacks
  are removed. The standalone review room remains available for staging.
- Family walking uses the resident wall/terrain constraint. Async stages are cancelled
  on clear, travel and disposal. Worlds, rebases, caves and flight clear old gatherings.
  The scene group reattaches after scene cleanup. Geometry, text textures, props and
  body allocations release on teardown; cached shared materials remain owned centrally.

## Verification

`node --test island/tools/families.test.mjs island/tools/social-actors.test.mjs`
passes 8 family checks and 11 resident checks. Family coverage includes 2,500 seeded
households on all seven weekdays, school/work/dinner schedules, teenager ward coverage,
food access, finite donations and conservation of bank food, and dining chair placement.

Real MakeHuman browser scenes are reproducible with:

```sh
node island/node_modules/esbuild/bin/esbuild island/tools/family-preview-entry.mjs --bundle --format=esm --outfile=island/dist/family-preview.js
node island/tools/families-browser.cjs
```

The browser tool accepts `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE`, `CHROMIUM_ARGS` and
`FAMILY_REVIEW_DIR`. Its local server runs inside the browser process environment.
The generated preview bundle is a review artifact and is not part of the production build.

All 17 browser checks passed with zero page or shader errors. Geometry returned to its
three-geometry baseline after repeated gatherings. The checks cover cancellation, the age lineup and ward flags, school/teen/dinner/
food-bank stages, actual aid interaction and wallet cost, saved garden state, world and
origin teardown, scene reattachment, existing furniture reuse and geometry disposal.
Review frames and the exact check results live in `docs/verification/families/`.
This is isolated desktop render and controller verification, not an AAA art approval or
real-phone/full-world performance measurement.
