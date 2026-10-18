# Soldier kit models

The soldiers' head kit as real models: a high-cut ballistic helmet (shell, rubber edge trim,
side rails, front shroud, loop panels), night vision stowed up on its mount with the battery
pouch, cable and strobe, and an electronic headset on the rails. And the plate carrier's
kit: magazine pouches and their magazines, the admin pouch, the dangler, the radio, the
push-to-talk, the medical pouch, the tourniquet, the back panel, the drag handle and the
shoulder straps' buckles. The combat boot, and the combat glove's and the knight's
gauntlet's detail (baked onto the hand's own skin, laid on by the tables in `soldier-kit.json`).

These are the game's own work, made by `island/tools/blender/soldier_kit.py` (Blender as a
Python module) on a reference head taken from the game's own bodies (`ref-head.obj`), and
packed for the web by `island/tools/bake-soldier-kit.mjs`. Nothing here comes from outside
the project.

| File | What it is |
|------|------------|
| `soldier-kit.glb` | the game meshes: `helmet`, `nvg`, `headset`; `mag`, `magpouch`, `admin`, `dangler`, `radio`, `ptt`, `med`, `tq`, `back`, `handle`, `buckle`; `boot` (quantised, meshopt) |
| `soldier-kit.json` | the reference head's and foot's measurements the game scales from, the glove's and the gauntlet's tables (each hand's body faces, the atlas at their corners and, for the gauntlet, how much further each corner stands off), and triangle counts |
| `kit-albedo.webp` | colour |
| `kit-normal.webp` | tangent-space normals (OpenGL), baked from the detailed copies |
| `kit-orm.webp` | red: ambient occlusion; green: roughness; blue: metal below 0.5, the wearer's colour taken above it |
| `kit-*-phone.webp` | the same three maps at half size, which phones load instead |

To remake them:

```sh
python3.13 -m venv /tmp/bpy && /tmp/bpy/bin/pip install bpy
/tmp/bpy/bin/python island/tools/blender/soldier_kit.py /tmp/kit 2048 32 preview
node island/tools/bake-soldier-kit.mjs /tmp/kit
```

`people/kit-models.js` loads them with the people's assets; `people/garment.js` fits each
piece to a head (`putModel`) or lays it on the plate carrier (`putPart`), into the person's kit mesh.
