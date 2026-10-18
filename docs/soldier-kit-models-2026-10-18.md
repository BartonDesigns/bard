# Soldier kit as real 3D models, and a forged great helm (October 18, 2026)

## What changed

- **Soldiers' head kit as real models.** This covers three pieces:
  - The high-cut ballistic helmet: shell, rubber edge trim, side rails, front shroud and loop panels.
  - Night vision stowed up on its mount, with the battery pouch behind it, its cable and a strobe.
  - The electronic headset on the rails, with a boom mic on the left cup.

  Each piece is modelled twice in Blender: a light game mesh, and a detailed copy (bevels, rail windows, screw heads, ribbed focus rings and knobs, grit, weave). The detailed copy is baked into one 2048 atlas:
  - colour;
  - tangent-space normals;
  - occlusion, roughness, and metal or the wearer's colour.

  The game fits each piece to each head and lays it into the person's existing kit mesh, so it is still one draw per person. The painted parts take the helmet's own colour.
- **Knight's great helm.** It now sits tight to the head and is forged in hard planes instead of a round shell:
  - six facets per level, creased down the front and back and at the cheeks;
  - a keel over the crown;
  - a heavy brow over the sight;
  - a visor that comes to a beak.

  This is Josh's "Greek proportions, too round and soft and balloon" ask. The code is `closeHelm` in `people/garment.js` (`facet()`).

![Soldier kit before and after](verification/armor/compare-soldier-kit-models.jpg)
![Great helm before and after](verification/armor/compare-great-helm-planes.jpg)
![The kit in Blender](verification/armor/soldier-kit-blender-side.png)

## How it works

- **Modelling:** `island/tools/blender/soldier_kit.py`, run with Blender as a Python module (`pip install bpy`, Python 3.13).
  - It models to `ref-head.obj`, an operator's head taken from the game, in the kit frame: metres, origin at the skull's middle at eye height, +y up, +z forward.
  - The shell is raycast off that head, stood off it on the pads, and smoothed.
  - Pieces are parametric: the shell grid, swept rails, cables and trim, patches laid on the shell, lathed cups.
  - UVs are in metres and packed into one atlas.
  - Every map except occlusion is baked selected-to-active in Cycles. Occlusion comes from the game meshes and the head.
  - The `preview` argument renders Cycles previews.
- **Packing:** `island/tools/bake-soldier-kit.mjs` writes to `island/assets/kit`.
  - The GLB is quantised and meshopt-compressed.
  - The colour map is lossy WebP and the normal map is lossy q92.
  - The occlusion/roughness/metal-tint map is lossless at 1024. Lossy WebP shares chroma between channels, which bled metal into the rails.
- **Runtime:**
  - `people/kit-models.js` loads the kit with the people's assets. On a phone it halves the maps.
  - `garment.js` `putModel` scales each piece from the reference head to this head's width, depth and height over the eyes.
  - The kit material treats id 11 as "read the atlas" (`propkit.js`, `KIT_ATLAS`), with derivative tangents, the green channel flipped for glTF UVs, and baked occlusion on the sky light.
  - If the files fail to load, the old procedural kit is built instead.

## Cost

- **Triangles:** the operator's kit mesh is 63.0k, against 64.4k for the procedural version. The militia average is 40.1k, against 39.9k. Draw calls are unchanged.
- **Download:** 1.5 MB in all.

| File | Size |
|------|------|
| GLB | 141 KB |
| Colour map | 174 KB |
| Normal map | 612 KB |
| Occlusion/roughness/metal-tint map | 614 KB |

- **GPU memory:** three 2048 maps with mips are about 50 MB on desktop. On phones the maps are halved.

## Not done yet

- The plate carrier and pouches, uniforms, boots and gloves are still procedural. They are the next pieces to move to Blender.
- The knight's own models.
- There is no chin strap or helmet cover (camouflage) yet.
- GPU frame time has not been measured.
