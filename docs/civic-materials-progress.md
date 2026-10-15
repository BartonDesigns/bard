# Civic materials — 2026-10-15

Implemented weathered galvanized sign backs, subtle enamel sign faces, physically scaled service-vehicle diamond tread, four transparent damage decals, and eight distressed graffiti tags. Surface scars are deterministically placed only on eligible industrial/alley/dumpster/abutment surfaces, capped at 6 per mobile region and 16 per desktop region. Existing civic/storefront graffiti exclusions remain.

Integrated into the existing Crysis signage atlas and service fleet, preserving the 200-brand expansion and Claude's main-branch hand/skin work through 95a4ee68a15d1d9008edb9e8f8650ddd2c02b04c. No Worker or credential changes.

Validation: production build; 15 focused geometry/signage/material tests; Chromium desktop, mobile viewport and blocked-asset rendering fixtures. Fixtures exercise the actual ambulance model, sign front/back shader, plate close-up, moving directional light and both Canvas darkening blend modes. Screenshots/reports are in `docs/verification/civic-materials/`. This is renderer-level verification, not a physical-iPhone or full-universe playtest.

Close-up review caught and fixed GPU texture storage not resizing after the placeholder upload. Blank sign backs also now retain their back-face identity instead of showing mirrored front lettering under Three's two-pass transparency. The generated tread image is retained as a reusable visual reference; runtime relief is mathematical so its highlights follow scene lighting.

Owner follow-up included before merge: 24 additional graphics, including all seven requested custom names, chrome-style tags, Latin/Chicano-inspired clowns and crucifix/rose murals, anti-authority commentary and four strange characters. Placement remains stable and uses existing eligibility rules. Gloss is per instance, so the two chrome tags share the paint batch without giving every tag a shiny finish. All five graffiti families and every tile are covered by a reachability test. Updated total: 16 focused tests; the desktop/mobile/blocked-asset fixture includes all eight runtime civic sheets and the glossy paint shader.
