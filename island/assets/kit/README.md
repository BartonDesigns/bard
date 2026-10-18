# Soldier kit models

The soldiers' head kit as real models: a high-cut ballistic helmet (shell, rubber edge trim,
side rails, front shroud, loop panels), night vision stowed up on its mount with the battery
pouch, cable and strobe, and an electronic headset on the rails.

These are the game's own work, made by `island/tools/blender/soldier_kit.py` (Blender as a
Python module) on a reference head taken from the game's own bodies (`ref-head.obj`), and
packed for the web by `island/tools/bake-soldier-kit.mjs`. Nothing here comes from outside
the project.

| File | What it is |
|------|------------|
| `soldier-kit.glb` | the game meshes: `helmet`, `nvg`, `headset` (quantised, meshopt) |
| `soldier-kit.json` | the reference head's measurements the game scales from, and triangle counts |
| `kit-albedo.webp` | colour |
| `kit-normal.webp` | tangent-space normals (OpenGL), baked from the detailed copies |
| `kit-orm.webp` | red: ambient occlusion; green: roughness; blue: metal below 0.5, the wearer's colour taken above it |

To remake them:

```sh
python3.13 -m venv /tmp/bpy && /tmp/bpy/bin/pip install bpy
/tmp/bpy/bin/python island/tools/blender/soldier_kit.py /tmp/kit 2048 64 preview
node island/tools/bake-soldier-kit.mjs /tmp/kit
```

`people/kit-models.js` loads them with the people's assets; `people/garment.js` fits each
piece to a head and lays it into the person's kit mesh.
