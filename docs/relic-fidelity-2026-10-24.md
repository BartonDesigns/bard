# The relics take shape

This pass continues the 20 legendary weapons and eight boss-linked armor pieces from the
retained [wraparound sheets](relic-motion-2026-10-24.md). It changes their in-game models,
not the loot odds, damage, school abilities, inventory IDs, or boss relationships.

## What players should see

- Distinct material palettes instead of the shared all-gold legendary shop finish:
  dark obsidian, worn ivory, driftwood, bronze, copper, silver and restrained colored cores.
- More actual depth: lighthouse chambers, clock dials, lantern cages, shield relief,
  hollow pipe rims, layered crescent blades, crystal settings, sun-wheel vanes and ivory sails.
- The same unique animated identities, including Event Horizon's vortex and First Morning's
  glancing, blinking eye. Static detail does not replace their private animated rigs.
- Eight authored armor display models instead of generic cylinders: a crystal leaf circlet,
  overlapping scale mail, furnace cuirass, plated greaves, long flightcoat, articulated
  gauntlets, open mourning hood and salt-worn laced boots.
- Bone-mounted relief on equipped armor. Existing skinned garments still provide cloth,
  sleeves and joint deformation; no rigid display mannequin is attached to the player.
  Stormwarden's flightcoat now uses the long-coat garment rather than a recolored plate carrier.
- Small shared brushed-grain and woven-fiber maps add close-up surface and roughness variation
  to armor. The maps are generated locally, not fetched from the concept-art gallery.

## Technical limits and verification

Static weapon detail is merged into the existing body mesh. Straight rods no longer waste
24 longitudinal segments. Tests enforce fewer than 12,000 triangles per complete high-detail
weapon and fewer than 4,000 in low detail, including animated attachments; low detail remains
under 65% of the high-detail count. No extra lights or particle emitters were added.

Armor sculptures use at most three merged material batches. Each complete armor display
is below 5,500 triangles; each low-detail bone-local relief is below 1,600. Worn relief
uses the existing 18-meter effect/detail cutoff. The two 128-square surface maps are shared
across copies. Owned mesh/material cleanup does not dispose those shared maps.

`island/tools/relic-fidelity.test.mjs` checks material identity, budgets, unique armor volumes,
finite geometry/colors, UVs, shared texture lifetime, bone following and disposal. Existing
motion, boss loot, inventory, gear magic and migration tests remain part of the focused gate.

The actual generated geometry was also reviewed in a CPU-rendered contact sheet. This is
**not** a gameplay screenshot or a shader/lighting validation. The available game browser
previously failed to initialize 3D; an on-device close-up, movement/clipping and GPU performance
check is still required. These are enhanced procedural models, not sculpted/baked AAA assets
or a claim of pixel-identical reproduction of the illustration sheets.

Release scope: frontend only. No Cloudflare Worker deployment, multiplayer capability change,
credential change, balance change, or unrelated Claude work is included.

## Device acceptance pass

1. Refresh after the published bundle updates; inspect and rotate each item in Gear.
2. Check both faces of the weapons, including the open horn mouth and hollow pipe rims.
3. Equip each armor slot; walk, crouch, attack and switch gear. Check relief stays on its bone
   and does not cover the face or intersect hands. Check another player's wardrobe separately.
4. Observe the vortex and occasional eye movement; verify reduced-motion freezes the effects.
5. Repeat equip/unequip and inspection on mobile. Watch memory, context recovery and frame time;
   the triangle budgets alone are not a measured FPS guarantee.

## Follow-up: reverse-side construction and actual-rig fit

The next pass adds separate rear construction to all eight armor sculptures: circlet clasp
and leaves, overlapping mail/back plates, cuirass fastening straps, a flightcoat back yoke
and split tails, greave closures, gauntlet palm leather, veil stitching/charms and boot pull loops.
These details remain merged into the same three material batches. The complete high-detail
armor sculptures remain below 5,500 triangles and low-detail worn relief below 1,600.

Inspection of the actual garment/rig convention found an attachment error: body/head/shin/foot
relic fronts were placed at negative Z and rotated by PI, although the character's front is
positive Z in rest space. Those attachments now face forward. Chest and head placement uses
measured torso/skull dimensions when available, including depth scaling to keep the new rear
relief outside the torso. Missing measurements retain finite fallback anchors.

Gauntlets require a different frame: their long axis follows the wrist-to-middle-finger
direction, and the metal relief faces the dorsal side, not the palm. They now derive that
frame from the actual rest skeleton, instead of assuming a globally downward hand.

`island/tools/relic-fit.test.mjs` reads the shipped compressed human mesh and full patched rig.
It checks eye/front orientation, front/rear torso clearance at three size profiles, skull fit,
both hand frames, posed arm/wrist following, rear geometry and fallback behavior. The focused
relic suite now has 45 passing tests. A reverse-side CPU geometry preview was inspected as well.
These geometric checks still do not replace an on-device clothing-clipping or GPU lighting test.
