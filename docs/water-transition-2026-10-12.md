# Water transitions and airborne swimming

The reported symptom was water appearing high above streets after visiting another planet.
The investigation found two concrete faults: swimming depended on bed depth without
checking the player's altitude, and world teardown left the shared water-carving atlas
and water/vegetation hooks alive. Water callbacks also followed the mutable current-world
reference rather than the world that created them.

Changes:

- Swimming requires contact with the local liquid surface. Airborne arrivals fall normally;
  submerged arrivals retain their depth instead of being pulled to a distant surface.
- Physics and underwater effects use the current world's sea/lake level and exclude dry
  caves and airless worlds. The ocean underside is clipped where it lies below dry ground.
- World replacement releases water jobs, meshes, shared carving and hooks. Old atlas
  work or cleanup cannot modify a replacement atlas. Entry resets underwater state,
  muffled audio, ocean visibility sampling and camera clipping planes.
- Water callbacks retain their own world. Ocean rendering and physics share wave strength.

Verification: production build; nine water movement/contact/lifecycle tests; production
bundle browser transitions Earth → submerged ocean planet → Moon → Earth with an iPhone
user agent and touch viewport. Checks cover airborne and submerged arrivals, dry-world
water exclusion, old-water detachment and readiness, ground-relative spawn height and
no browser runtime errors. Existing diving, surfacing and cave movement tests still pass.
The exact original planet seed/save was not supplied; physical iPhone Safari was not tested.

Run `node --test island/tools/water-movement.test.mjs island/tools/water-transition.test.mjs`
and `node island/tools/water-transition-browser.cjs` (Playwright/Chromium paths may be set
through `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE`).
