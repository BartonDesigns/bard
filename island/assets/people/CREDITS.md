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

The locs, braids and cornrows and the stand-in hair (`src/people/hair.js`), the short
beards, goatees, moustaches and stubble grown from the skin (`src/people/hairkit.js`), the eyes' iris and cornea
(`src/people/face.js`), the lashes, brows and tear line, the skin shading
(`src/people/skin.js`) and the clothes (`src/people/garment.js`) are drawn by the game's
own code, with no other textures.

## Hair and beards (`hair/`)

Baked by `tools/bake-people-hair.mjs` into `hair/<id>.bin.gz` (each vertex tied to the base
mesh, as the MakeHuman proxy files have it; heavier meshes thinned) and `hair/<id>.webp` (the
texture made grey and alpha, 512 px, so the game can tint it; no colour kept). Only assets
released as CC0 or CC-BY are used; assets under AGPL or with no stated licence were left out.

CC-BY 4.0 assets: © their authors, used under the Creative Commons Attribution licence
(https://creativecommons.org/licenses/by/4.0/). Changes: converted, retextured to grey and
alpha, resized, and some meshes simplified.

| id | Asset | Author | Licence | Source |
|----|-------|--------|---------|--------|
| afro01 | afro01 | MakeHuman team | CC0 | MakeHuman system assets (makehuman-community-hair 1.3.0, http://ppa.launchpad.net/makehuman-official/makehuman-community/; https://github.com/makehumancommunity) |
| bob01 | bob01 | MakeHuman team | CC0 | MakeHuman system assets (as above) |
| bob02 | bob02 | MakeHuman team | CC0 | MakeHuman system assets |
| braid01 | braid01 | MakeHuman team | CC0 | MakeHuman system assets |
| long01 | long01 | MakeHuman team | CC0 | MakeHuman system assets |
| ponytail01 | ponytail01 | MakeHuman team | CC0 | MakeHuman system assets |
| short01 | short01 | MakeHuman team | CC0 | MakeHuman system assets |
| short02 | short02 | MakeHuman team | CC0 | MakeHuman system assets |
| short03 | short03 | MakeHuman team | CC0 | MakeHuman system assets |
| short04 | short04 | MakeHuman team | CC0 | MakeHuman system assets |
| updo50s | 50s Updo | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2001 |
| adrienne | Adrienne Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1862 |
| braidbun | Braid Bun | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2177 |
| daisy | Daisy Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1859 |
| grump | Grump Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2796 |
| hazel | Hazel Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2816 |
| curlybob | Inverted Curly Bob | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2683 |
| island | Island Princess Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1811 |
| katherine | Katherine Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1863 |
| keylth | Keylth Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2173 |
| hippy | Lady Hippy Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1812 |
| puffs | Micky Afro | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2817 |
| shortdaisy | Short Daisy Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1860 |
| tousled | That 80s Babe Hair | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/2174 |
| wavybob | Wavy Bob | Elvaerwyn | CC-BY | http://www.makehumancommunity.org/node/1551 |
| viking | Beard Viking | Rehman Polanski | CC0 | MakeHuman community assets (http://www.makehumancommunity.org) |
| moustache | Moustache Viking | Rehman Polanski | CC0 | MakeHuman community assets (http://www.makehumancommunity.org) |
| scruffy | Scruffy Beard 1 | Elvaerwyn | CC-BY | MakeHuman community assets (http://www.makehumancommunity.org) |

The MakeHuman community site and its asset server could not be reached when these were
baked; the files were taken from public copies of the same packs on GitHub
(Ismail-Bzk/Synthetic_Face_Generator: the community hair pack `hair02_ccby` with its
`hair02.json` listing each asset's author, licence and page; TomasKlecer/mpfb_backup: the
system hair and the CC0 beards; RavinMaddHatter/Madhatters-Table-Top-RPG-Mini-Maker: the
scruffy beard), each file's own header naming its author and licence.
