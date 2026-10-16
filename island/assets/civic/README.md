# Civic surfaces v1

Generated with OpenAI's built-in imagegen on 2026-10-15. Exact prompts and encoded-file hashes are in `prompts.json` and `manifest.json`. Existing brand artwork is retained.

| Sheet | Layout | Runtime use |
| --- | --- | --- |
| galvanized | repeating albedo | Civic sign backs; service-vehicle tread albedo |
| enamel | repeating albedo | Subtle chalked finish on road sign fronts |
| diamond-plate | repeating visual reference | Available source texture; not layered over runtime tread relief, avoiding doubled baked highlights |
| damage | 2 columns × 2 rows | Road grime, rust/chips, scratches, soot, in reading order |
| graffiti | 4 columns × 2 rows | DUSK, RILL, NOMA, KITE, VEX, LOAM, DRIFT, ECHO |

Damage and graffiti retain real alpha, including semitransparent overspray. `drawCivicDecal` supports source-over, multiply and darken in Canvas. Service paint and metal composite damage into the material base color before lighting, with roughness and metalness responses. World wall scars use alpha-blended, lit paint decals; they do not use framebuffer multiply. No emissive damage layer.

EMS steps/skirting and other service-vehicle plate parts use a shared, tileable 256px mathematical height/roughness pair, a 40cm physical UV repeat and a 3mm bump scale. Linear data maps remain separate from sRGB color maps. Existing fleet sky reflections are retained. Road signs preserve headlight retroreflection; blank backs use one double-sided rendering pass so the printed front does not show through mirrored.

Two image tiers: 1024px surfaces/1536px graffiti desktop, half-width mobile. Assets are loaded lazily, shared across vehicles and sign batches, and atlas refresh follows image completion. Missing files retain base materials/procedural tags without blocking gameplay. These are authored surface wear, not a new damage simulation or persistence system.

## Street-art expansion

Four further alpha sheets add 24 graphics (32 authored graffiti graphics total):

- `graffiti-names`: 4LOC/0H, LRDGS, HAYSTACK, NUTNUTNUT, ptfo, BAMMER, 110klay011, NO SIGNAL.
- `graffiti-revolt`: mixed Latin phrases, anti-authority slogans and surreal street commentary, 8 tiles.
- `graffiti-characters`: pigeon, three-eyed alien, television-headed rat and one-eyed mushroom, 4 tiles.
- `graffiti-devotional`: Latin/Chicano-inspired clown portrait, crucifix with roses, paired clown masks/VIDA lettering and sacred heart, 4 tiles.

The user clarified that “Latin inspired” means the visual tradition, hence the dedicated clown/devotional sheet. Character and devotional artwork keeps its aspect ratio. Generated pieces mix with existing procedural writers using stable seeds; civic and storefront exclusions still apply. 4LOC/0H and BAMMER get a lower-roughness metallic paint response through the existing instance flag, weathering toward matte as wear increases. All other tags remain matte. No extra draw batch is needed for the glossy tags. Generated chrome artwork contains stylized reflective cues; scene lighting adds the actual specular response.

Exact supplemental prompts and hashes: `graffiti-expansion-prompts.json`, `graffiti-expansion-manifest.json`.
