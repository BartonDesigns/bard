# Signage art and place identity — 15 October 2026

Implemented on `codex/signage-art-direction`, based on main `65fc364` (PRs 38 and 39). This is a frontend art/rendering change. No Worker deployment, credential change, economy replacement or change to the open NPC/quest implementation branches.

## Visual direction

Preserve the carved, gilded, organic and illustrated artwork. Add a second vocabulary of confident consumer wordmarks: simple flat ink, distinctive lettering, one focal detail, no enclosing sticker outline. Modern business boards also vary between framed and borderless treatments. Tall banners use open compositions; the lower hem is a physical detail, not a graphic frame.

Six transparent 4×2 sheets (48 marks) are saved in `island/assets/signage/`, with 1536×768 desktop and 768×384 mobile WebPs. The images were generated with the built-in image-generation tool. Exact prompts are in [prompts.json](../island/assets/signage/prompts.json). Runtime generation is never used.

| Family | Treatment | Where used |
|---|---|---|
| Heritage | Carved wood, worn gold leaf, trade symbols | Medieval inn/forge and market counters; natural-world village wayfinding |
| Mystic | Roots, copper, jade and botanical forms | Fae cave markets and mystical village wayfinding |
| Modern | Illustrated craft-business marks | Selected storefront boards, banners and street stickers |
| Orbital | Practical service insignia | Actual colony hub, port and outpost names; dome/bunker cave markets |
| Consumer | Borderless typographic brands | Phone/coffee banners and grocery products |
| Commerce | Illustrated retail/packaging symbols | Retained asset vocabulary for future placements; not loaded during normal gameplay yet |

Consumer identities: morrow (phone/network), LOOP (network), DAYBREAK (coffee), plain (milk), OAT & CO. (oats), POMIERO (pasta), little orchard (fruit), tidy (household). These are fictional game brands, not real service integrations. LOOP is available in the atlas for later network-service placements; it does not falsely turn a technology office into a service retailer.

## Placement and player outcomes

- Earth storefront banners use the actual economy establishment name and category. Phone-repair shops receive phone identity; cafés receive coffee identity. Existing hours, door markings and safety signage remain separate. Narrow façades skip the banner rather than obstructing a doorway.
- Banners run from near floor level to near the ground-floor ceiling/eaves: about 3–3.7 m at stores, 2.65 m at medieval businesses, 2.05 m beneath cave-market canopies, 2.7 m at village paths and 3.6 m at colony sites. They are sized to their host; they do not run through multiple stories.
- Medieval boards have solid bevelled timber, brackets, rings and rivets. Tall natural-world banners have a shallow cloth billow and top/bottom rods. Orbital banners are rigid, with metal supports. Two outward faces remain readable from either side.
- Grocery labels are placed on the actual generated carton faces, using their model-local position, shelf row and orientation. They share the signage atlas and instanced batches. Produce, cereal/coffee, pasta, dairy and household brands follow department rows. Unsupported frozen/snack/baking categories retain their prior products rather than receiving misleading branding.
- Actual open business requests enable “HELP WANTED” on the matching business banner. Taking, finishing or expiring a request changes the signage key on the next half-second poll. This uses the existing business board, not an invented quest availability flag. It does not label every village/colony site as a quest giver.
- Natural settlements get village/pier wayfinding; residential cottages do not acquire fake commercial identities. Colony signs use names and kinds from the current planet's colony plan. Cave markets use the current civilization's visual family.
- Service ads can say “Join online” with `morrow.example`. This is a deliberately fictional, non-clickable in-world address. A real signup service, transaction or external website has **not** been built by this art pass.

## Rendering and budgets

Images load lazily by family and device tier. Existing readable procedural text remains when loading fails. Atlas revisions refresh after successful image decoding. No per-product material or draw call is added. Store labels cap at 24 per shop on mobile / 72 desktop (fewer when a department lacks matching art), sharing the existing regional decal caps. World art caps at 16 / 32 signs per collection, with at most three merged draws and distance visibility at 110 / 220 m. Disposal guards late image callbacks and releases geometries, materials and textures.

The physical aspect ratio is maintained while drawing into atlas cells so tall signs do not stretch emblems. Existing visual treatments and prior generated sheets are retained.

## Validation and evidence

- `node --test island/tools/signage.test.mjs island/tools/signage-art.test.mjs`: 15 passing checks, covering layer order, deterministic placement, real tenant identity, doorway/height bounds, civilization mapping, actual site names and alpha-preserving mobile assets.
- `node --test island/tools/economy.test.mjs island/tools/colony-space.test.mjs`: 15 passing checks for business/request semantics and colony collision behavior.
- `npm run build --prefix island`: production build, including the checked-in engine bundle and entry cache key.
- `island/tools/signage-art-smoke.mjs`: Chromium/SwiftShader review with desktop, phone-sized and image-download-failure cases. Checks real Canvas/Three rendering, finite geometry, bounded draw calls, disposal and the actual commercial-store + streamed-signage integration. These are renderer/fixture checks, **not** a real-device performance benchmark or an exhaustive universe playthrough.
- Seven sample signs use three merged draws; desktop atlas 1536×1024 and phone atlas 768×512. No page exceptions or failed HTTP responses in the successful image-loading runs. Offline case intentionally blocks art downloads and verifies text fallback.

[Desktop renderer review](images/signage/art-desktop.png) · [Mobile-sized renderer review](images/signage/art-mobile.png)

To rerun the browser check, install Playwright + Chromium or set `BARD_PLAYWRIGHT_MODULE` to its module path and `BARD_CHROMIUM_EXECUTABLE` to a compatible browser. `BARD_ART_REVIEW_OUT` selects the screenshot directory. The script removes its temporary review bundle afterward.

## Release boundary

This document records implementation and local verification. A feature-branch push or PR is not evidence that production has deployed. Check the PR/merge and frontend deployment separately before calling the art live. No Cloudflare Worker changes are required for these assets.
