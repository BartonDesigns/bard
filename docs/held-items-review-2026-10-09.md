# Bard armament and held-item review

Review baseline: `eec57ca3c97e019cd4b53106d67e9744ed0fe2f2` on `claude/affectionate-heisenberg-3g4qv1`.
Review date: 9 October 2026 UTC (8 October Pacific).

## Assessment

**Not yet at the owner's AAA quality target.** This is an art assessment of the exact exported assets, not a claim that a particular triangle count or texture size establishes AAA quality.

The three rifles/carbines have distinct silhouettes, bevels, sight glass, sling geometry and tier finishes. High and low detail models exist. Utility items are recognizable at icon size but expose simple primitive construction up close. Static exports do not validate grip alignment, arm animation, gameplay lighting or real-device performance.

## Where the art is built

| Source | Responsibility |
|---|---|
| `island/src/crysis/held-items.js` | Procedural geometry, shared material atlas/shader, tier finishes, LODs and hand grip frames |
| `island/src/crysis/viewmodel.js` | First-person forearms/hands, item placement, equip/aim/reload animation |
| `island/src/ui/gear-studio.js` | Inventory thumbnails and rotating item previews |
| `island/src/ui/gear.js` | Gear UI and equipped-item integration |
| `island/src/gameplay/arms.js` | Item IDs, names and catalog |
| `island/src/gameplay/gear-levels.js` | Levels and tier definitions |
| `island/tools/held-review-entry.mjs` | Isolated renderer used for these exports |

Within `held-items.js`, builders are `aurora`, `mossback`, `warden`, `bow`, `lantern`, `medkit`, `toolRoll`, `net`, `scentKit`, `brace` and `flare`. `BUILD` maps item IDs to builders; `itemModel()` returns the renderable model; `HOLDS` defines attachment frames. These are Three.js procedural assets, not a set of imported FBX/Blender models.

## Priority findings

| Priority | Observed issue | Acceptance for the next art pass |
|---|---|---|
| P0 | Medkit and repair-roll canvas has large triangular color patches | Stable material IDs at every angle, distance and detail level; no unintended iridescence |
| P0 | Eight catalog entries have no dedicated held model | Every intended carryable entry has an explicit mesh and grip, or an intentional documented nonvisual behavior |
| P1 | Net bag reads as an opaque bowl | Visible open mesh or an appropriate cutout material at gameplay distance |
| P1 | Utility construction is sparse; large surfaces reveal faceting and simple shapes | Authored seams, closures, fabric thickness, attachment details and consistent bevel treatment |
| P1 | Cloth checks and some surface noise are oversized or repetitive | Material scale and roughness consistent with the object, with localized wear instead of uniform noise |
| P1 | Static renders do not prove hand fit or animation | First/third-person review of grip contact, wrists, support hand, aim, equip and reload; no clipping |
| P2 | Tier changes mainly recolor/repattern shared geometry | Owner-approved finish language that improves readability while preserving material identity |
| P2 | No device timing evidence in this pack | Measured CPU/GPU/frame cost and LOD behavior on target desktop and phone hardware |

### Confirmed shader diagnosis

`vSurf.z` packs the atlas tile and edge wear. The existing shader uses `floor(vSurf.z)` and `fract(vSurf.z)`. A whole-number canvas tile value of 13 can interpolate just below 13 and select tile 12, which the shader treats as iridescent film. The accompanying diagnostic changes only that unpacking:

```glsl
float kTile = floor(vSurf.z + 0.0001);
float kWear = clamp((vSurf.z - kTile) * 2.0, 0.0, 0.98);
```

The before/after medkit and repair-roll renders show the observed patches disappear. This correction is a render-only diagnostic and has **not** been applied to the model source. Baseline sheets and the interactive viewer remain faithful to `eec57ca`.

## Model inventory

Triangle counts are derived from model geometry, not estimated. Mesh count is not a guarantee of total in-game draw calls. Values are Common / Level 1; upper tiers may add effects.

| Item | High triangles | Low triangles | High meshes |
|---|---:|---:|---:|
| Aurora Trail Rifle | 15,064 | 3,268 | 4 |
| Mossback Scout Rifle | 8,516 | 2,600 | 4 |
| Warden Spark Carbine | 8,332 | 2,560 | 3 |
| Reedline Hunting Bow | 1,756 | 1,160 | 1 |
| Hunting Net | 1,232 | 304 | 1 |
| Trail Scent Kit | 600 | 224 | 1 |
| Door Brace | 548 | 404 | 1 |
| Lantern Alarm | 2,256 | 660 | 1 |
| Field Medkit | 1,064 | 508 | 1 |
| Camp Lantern | 2,160 | 620 | 1 |
| Repair Roll | 1,028 | 492 | 1 |
| Station Signal Flare | 640 | 328 | 1 |

No dedicated held mesh: Trail Rifle Cartridge Box, Scout Rifle Cartridge Box, Spark Cell Pack, Reedline Arrow Quiver, Relay Transceiver Board, Kestrel Flight Recorder, Sealed Regolith Core, Harvest Crate. `itemModel()` returns null for these IDs in this baseline.

## Export contents and method

- `Bard-held-items-overview.png`: all 12 modeled items, independently framed.
- `Bard-armaments-review.png`: four armaments in three inspection angles.
- `Bard-utility-01-review.png` and `Bard-utility-02-review.png`: eight utilities in three angles.
- `Bard-armament-finishes.png`: four armaments across five tiers, all at Level 7.
- `Bard-held-items-sprite-sheet.png`: transparent 3200 × 6408 PNG; 12 rows × four views. Each cell is 800 × 534.
- `Bard-held-items-sprite-sheet.json`: item IDs, view labels and pixel rectangles.
- `individual/`: 68 transparent PNGs, including four base angles per item and 20 armament tier renders.
- `Bard-model-review.html`: self-contained WebGL2 viewer; open in a desktop browser. Model, tier, level, LOD, wireframe, turntable and PNG export controls are included.
- `Bard-material-diagnostic.png`: baseline vs shader-only correction; not part of the baseline atlas.
- `model-metrics.json`: measured geometry counts and catalog coverage.

Renders use the production `itemModel()` and its shaders, Three.js 0.186.1, ACES filmic tone mapping, exposure 1.1, the gear studio's RoomEnvironment and matching key/rim/ambient lights. An orthographic camera frames each model independently; the sheet does not compare real-world scale. No generative imagery, texture repainting or image retouching was used.

Validation: all 68 asset views rendered in Chromium 153 without reported page or shader errors. Viewer controls were exercised through a model/tier/LOD/wireframe/view change, reset, and PNG download. A full game animation, mobile GPU, audio or multiplayer review is not claimed.

## Release continuity

Moon/Deep was selectively released to `main` in `42bced7a3ab89a20aaae34beb2b49853d19eda6e`. GitHub Pages run `37877283504` succeeded, and production HTML references the matching engine hash `0956a97800`. Gear, trading, weapons art and combat remain on the feature branch. No Worker deployment occurred.
