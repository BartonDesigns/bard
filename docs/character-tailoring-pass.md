# Character construction and motion continuation

## Clothing

Non-stretch tops now bridge torso hollows with rounded front and back panels. Loose torso
fabric drops leg influences where spine weights exist, so a leg step does not pull the
shirt into the thigh. Cage triangles crossing a hem are retained before cutting, avoiding
missing triangular slivers at the visible edge.

Necklines, cuffs and hems are cut into the geometry and finished with a 3.2 mm rolled
return. Edge vertices interpolate and normalize their strongest four bone weights; garment
region IDs remain discrete. Everything stays in the existing clothing mesh and material.
Fabric bump and tonal contrast are reduced, and denim stitches use millimetre-scale spacing
with filtering instead of large painted dashes. Stretch clothing keeps its close fit.

The rifle clearance proxy uses the dressed torso bounds and a broader front section.
It remains a conservative stock/receiver sample, not a triangle-level collision solver.

## Hair

Four independent, critically damped guide responses now react to head translation and
rotation. Each imported clump selects a guide; roots stay pinned and displacement is bounded
to 30 mm. Teleports and resumed/off-screen animation clear momentum. Repeated render passes
at the same time do not advance simulation. The update reuses its vectors and quaternions.

Imported hair runs two capsule-projection passes after movement, including a finite fallback
for a vertex exactly on an axis. Shading has a restrained, tinted backlight response and
less extreme texture contrast. The original groom assets remain in use.

## Validation

The production MakeHuman browser harness covers 54 rifle fits across three sizes, aiming
and carry pitches, walking/fire/reload, plus cotton, fleece, open layered jackets and stretch
outfits on male/female characters. It renders standing/seated states, checks finite geometry,
normalized skin weights, edge construction, bounded non-uniform hair guide motion and shader
errors. It runs in desktop and phone-emulated Chromium. Reports and sample renders are in
`docs/verification/character-tailoring/`.

`node --test island/tools/hair-motion.test.mjs island/tools/gait.test.mjs` covers five motion
checks, including 30/60/120 Hz guide response, repeated renders and teleport resets.
The production build and `git diff --check` are also release gates.

## Live Worker verification

`node server/verify-workers.mjs` reads both deployed status endpoints and checks the site's
CORS access and expected capabilities. It never deploys or calls inference. The 11 October
check confirms discovery exposes `social_intent` and `story_quest`. Rooms still returns
`{ok:true,version:1,maxPlayers:8}` without `trade-v2`, `combat-v1` or `combat-guard-v1`.
Updating the Wrangler CLI does not deploy that Worker. The multiplayer source passes its
105 tests but still requires deployment from the owner's authenticated computer. Follow
`server/multiplayer/README.md`. This session has no Cloudflare deployment credentials.

## Remaining art and simulation work

This pass improves the existing procedural clothing cage; it does not replace it with
authored garment patterns, a cloth solver or body/cloth self-collision. Some shoulder and
sleeve shapes still need dedicated topology. Hair cards remain visible in some long styles;
four guide responses and body capsules are not a full strand simulation or hair self-collision.
Physical iPhone/Safari frame time, whole-world crowd performance and an AAA art sign-off
remain unverified.
