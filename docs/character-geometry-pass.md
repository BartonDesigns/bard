# Shoulder, sleeve and fitted-groom refinement

11 October 2026. Continuation of the character tailoring release.

## Clothing changes

Loose torso fabric now keeps shoulder and arm influences across the armhole. The previous
filter removed those alongside leg weights, leaving stiff shoulders as the arms lowered.
Leg influences are still removed from loose torso vertices where other weights remain.

Short, cap, elbow and long cuffs use planes perpendicular to each person's upper-arm or
forearm bones. Geometry cutting, covered-skin selection and coloured cuff bands use the
same coordinates. This removes the slanted flap produced by a horizontal rest-pose cut.
Light sleeves also have less padding around the deltoid; puffers retain their allowance.

Upper garments receive one curved subdivision pass before their neckline, cuff and hem
returns are constructed. Original surface vertices stay in place; new edge samples are
limited to 4 mm of displacement and do not round inward along the average normal. Skin
weights blend by bone identity, keep the strongest four influences, and normalize. Flat
garment regions and UV seam positions are preserved. Clothing remains one mesh/material.
This is surface refinement, not cloth simulation or a complete collision guarantee.

## Hair changes

Hair normals and strand directions are rebuilt after the groom is fitted to this head.
Normals wrap around the fitted locks; tangent directions follow the texture grain and
are orthogonal to the normals. Cached groom data is not mutated. The work runs at fitting
time without adding hair triangles or per-frame simulation work.

Gray selection now uses a stable strand column and clump seed, instead of texture
luminance that changed along a strand and produced white speckles. Fine strands blend
to their average gray coverage at a distance. Existing guide movement and body capsules
remain in use.

## Verification

The review fixture now sets `dna.sex` as well as `dna.male`. Earlier wardrobe labels alone
did not guarantee the intended body morph. Current reports record the actual parameter.

- Eight surface, gait and hair-motion unit checks pass.
- Desktop and phone-emulated Chromium each pass 54 rifle fits across three body sizes,
  three rifles, carry/aim and three pitches. Sampled torso-proxy penetration is zero and
  hand contacts meet the 4 mm gate. Walking, firing and reloading also pass.
- Both runs render four outfits standing and seated: regular cotton, oversized fleece,
  an open layered jacket and fitted stretch clothing. Skin weights normalize, geometry
  stays finite, hair frames are unit/orthogonal, guide movement is bounded and varied,
  and there are no browser or shader errors.
- The four outfits have 10,336–19,263 vertices and 14,124–26,926 triangles. This increases
  clothing detail and GPU vertex work; physical-phone and whole-crowd frame time is not
  measured by this software-rendered review.
- The production build and `git diff --check` pass. Reports and representative renders
  are in `docs/verification/character-geometry/`.
- Both deployed Worker status endpoints pass required capabilities and live-site CORS.
  The owner deployed rooms. This session did not deploy a Worker or call model inference.

Commands:

```sh
node --test island/tools/character-surfaces.test.mjs island/tools/hair-motion.test.mjs island/tools/gait.test.mjs
node server/verify-workers.mjs
cd island && npm run build
```

## Next quality work

Long-hair cards and their ear/face cutouts are still visible close up. Better authored
grooms, fitted garment patterns and cloth/body collision remain larger art tasks.
Production two-client gameplay and physical iPhone/Safari performance still need their
own verification. This pass does not establish film-quality hair or AAA art completion.
