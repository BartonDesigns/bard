# Procedural civic artwork — October 16, 2026

## Player-facing changes

The generated civic and graffiti pack is assigned to real procedural surfaces. This extends the existing Earth road-sign, vehicle, retail and brand integration; it does not replace the existing world-style signs.

- Generated city industry (`kind=5`) now qualifies even outside surveyed industrial land-use. Surveyed industrial buildings remain eligible. Wall placement uses the building's real foundation/top and rotation, respects storefront clearance, and excludes civic/service buildings and wrecks. Replacing streamed lots, collapsing a host or repairing it refreshes the art while the camera is stationary.
- Colony workshops, lounges and depots receive seeded side-wall tags or character/devotional pieces. Medical, quarters and mess airlocks receive wear only. Station art stays in the opaque band below the windows. Airlock doors and their safety labels remain clear.
- Airlock floors and station platforms receive physically scaled tread plate with albedo, bump and roughness maps. Dust/scuffs suit the dry colonies; toxic colonies use corrosion. Material lighting uses the colony environment and normal scene lights.
- All five existing graffiti families are reachable in the colony selection: the original tags, requested names, Latin/revolt lettering, characters and devotional/clown pieces. Selection is deterministic by site and world seed.
- Sampling of the authored names and devotional sheets follows their uneven gutters, avoiding adjacent lettering fragments and clipped masks. The same bounds scale to the phone sheets.

## Runtime and ownership

`civic/placement.js` provides surface contracts; `planet/colony/parts.js` registers actual flat walls and decks. `civic/colony-art.js` streams those records, uses one paint batch and one instanced plate batch, and releases its own atlas/materials on world disposal. It never generates images during play. Earth keeps the existing signage placement pipeline and authored/procedural fallback writers.

Desktop: up to 48 decals and 18 decks within 160 m. Phone: up to 20 decals and 8 decks within 85 m. Governor quality reduces the budget/range. Decisions refresh at 2 Hz or immediately on sufficient movement, quality change or decoded artwork. Distant instances disappear and return with the same identity. Maximum added colony cost is two draw calls, independent of visible decal/deck count.

Inspect Earth with `Crysis.signage.where('tag', 20)` or `where('piece', 20)`; returned records now include the artwork sheet/tile. On a colony, `Crysis.colony().civicArt` reports the visible count, atlas, draw count and selected families. Full anchors are available at `L99Island.world().colony.civicArt.where()`.

## Verification

- `node --test island/tools/procedural-civic.test.mjs island/tools/civic-materials.test.mjs island/tools/signage.test.mjs island/tools/signage-art.test.mjs island/tools/hand-service-geometry.test.mjs island/tools/integration.test.mjs`: **34 passed**.
- `node island/tools/procedural-civic-smoke.mjs`: **desktop, mobile touch emulation and blocked-image fallback passed**, using real hub/station builders and colony materials. Finite geometry, no shader/WebGL errors or failed HTTP responses, maps present, lighting response, stream-out/return identity and disposal verified.
- Desktop fixture: 15 decals, 7 decks, 2 added draws. Phone fixture at the reviewed airlock: 5 decals, 3 decks, 2 draws. With the camera distant: zero decals/decks/draws.
- Reviewed screenshots of the airlock side wall, station lower band and platform; corrected the observed neighboring-tag bleed before rerunning.
- `npm run build` in `island`: passed, updating the tracked bundle and cache-busted entry URL.

The renderer harness can use `BARD_PLAYWRIGHT_MODULE` and `BARD_CHROMIUM_EXECUTABLE`; output defaults to `/tmp/bard-procedural-civic`. These are focused rendered fixtures, not a full universe playtest, physical iPhone performance result or proof of public deployment. No Cloudflare Worker change is involved.

Base: `db07439` (main through PR #46). Claude's recent storefront, grid streets, park boards, grocery, military/police signage and planet-floor work was retained.
