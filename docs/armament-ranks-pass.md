# Ranked armament detail pass

The three firearms and Reedline bow now have five named chassis variants, driven by existing Common through Legendary quality. Each successive tier changes merged geometry as well as finish. Existing item IDs, saved inventory instances, level scaling, combining, trading and combat balance remain intact. Gear inspection and trade tooltips show the variant name and Mark I–V as numeric marks.

| Quality | Aurora | Mossback | Warden | Reedline |
| --- | --- | --- | --- | --- |
| Common | Field | Trail | Patrol | Reed |
| Fine | Ranger | Tracker | Watchkeeper | Grove |
| Superior | Pathfinder | Outrider | Sentinel | Windrunner |
| Masterwork | Vanguard | Wayfinder | Bastion | Moonstring |
| Legendary | Sunward | Elderwood | Citadel | Dawnbound |

Firearms have rounded receiver shoulders, deeper stock cheek sections, reinforced collars, slotted fore-end shells, lower braces and supported exterior crests. Smooth turned parts use 36 segments and long scopes 40 at high detail. The bow receives layered limb pockets, tier-specific pocket plates, counterweight collars and riser braces. Nothing changes the hand anchors, sight axes, muzzle coordinates or moving ammunition-cell path.

The player's first- and third-person items now use detailed geometry on phones too; NPC/distant-item low detail remains available. The phone forearm sleeves are also enabled, covering the cropped skin mesh's pointed ends. World-lit surfaces and existing live scope optics remain in use. These are game models, not physical weapon specifications.

At level 7, high-detail firearm meshes span 12,976–26,168 triangles; low detail spans 3,908–8,304. Bow meshes span 2,760–4,656 high and 1,704–3,180 low. More triangles alone do not establish art quality: actual first-person frames were inspected, including phone carry and aimed views. Chassis parts stay merged, rather than creating one draw call per fitting.

Verification: 40 rank/detail renders passed shader, triangle-budget and rank-geometry checks. The existing all-item finite-geometry validation also passes. Forty real-rig first/third-person pose cases and 27 bow body-fit cases pass with no browser/shader errors. A final phone pose rerun verifies the sleeve correction. All 39 focused bow, combat, acquisition and inventory tests pass. Reports and representative images are in `verification/armament-ranks/`.

Remaining: native iPhone full-world frame time, further full-world carry/reload/input review, and a user art-quality review of all variants. This pass does not establish an AAA art sign-off or finish every non-armament handheld item.
