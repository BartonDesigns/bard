# People assets

The people (`src/people/`) are built on the MakeHuman base mesh and its data. All of it is
released under **CC0 1.0 Universal** (public domain dedication,
https://creativecommons.org/publicdomain/zero/1.0/) by the MakeHuman team; attribution is not
required, and is given here anyway.

| File | What it holds | Source | Licence |
|------|---------------|--------|---------|
| `../../../textures/human-base-*.json.gz` | the hm08 base mesh, its skin weights, the ancestry, sex, age, muscle and weight targets, the blink, mouth and brow targets | MakeHuman, https://github.com/makehumancommunity/makehuman | CC0 |
| `../../../textures/human-*_(fe)male-*.webp` | the painted skin maps | MakeHuman system assets | CC0 |
| `rig150.json` | the 64-bone rig's joints and skin weights | MakeHuman default skeleton | CC0 |
| `faces.json` | the face shape targets (nose, chin, jaw, cheeks, forehead, brows, mouth and lips, eyes, ears, head shape, neck), only the vertices that move, quantised; the eyelash strips of the base mesh | MakeHuman `makehuman/data/targets/*` and `makehuman/data/3dobjs/base.obj`, https://github.com/makehumancommunity/makehuman (explicitly released as CC0 in September 2020; original copyright Manuel Bastioni, 2014; Data Collection AB, Joel Palmius, Jonas Hauquier, 2020) | CC0 |

`faces.json` is baked by `tools/bake-people-faces.mjs`, which also computes the skin's
per-vertex shading (ambient occlusion, thin flesh, the T-zone, the flush) and the brow
lines from the base mesh; those are the game's own.

The hair (cards grown on each head, `src/people/hair.js`), the eyes' iris and cornea
(`src/people/face.js`), the lashes, brows and tear line, the skin shading
(`src/people/skin.js`) and the clothes (`src/people/garment.js`) are drawn by the game's
own code, with no other textures.
