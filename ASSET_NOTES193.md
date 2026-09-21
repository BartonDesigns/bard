# Build 193 character materials

Two generated grayscale atlases add microdetail to existing materials. Existing face diffuse textures, skin tone, geometry, and hair fit remain unchanged.

- `textures/people193/fibers.webp`: 1024 × 1024, quadrants linen, wool, leather, suede.
- `textures/people193/detail.webp`: 1024 × 1024, quadrants skin pores, mature skin creases, straight hair fibers, wavy hair fibers.
- Generated using the built-in image generation tool. Exported as WebP for delivery; the original generated images remain separate.
- Runtime derives subtle tangent-space normals and roughness from grayscale detail. These are artistic approximations, not measured photogrammetry or scanned physical materials.
- New images load asynchronously and cache per rendering engine. Missing files retain existing materials.
- Skin and hair retain their original pigment. The curly undercoat replaces its old stamped-ring pattern with fibers normalized to the previous base brightness. Clothing fiber contrast is achromatic and restrained.
- Microdetail maps are capped at 256 pixels, with a 512-pixel color tile for the visible curly undercoat. Unused color maps do not allocate GPU textures.

## Generation prompts

### fibers

Use case: photorealistic-natural. Asset type: a production game material texture atlas, square 1024 by 1024. Create one perfectly aligned 2x2 atlas with no gutters, no borders, no text or labels: upper left natural fine linen plain weave, upper right dense soft wool twill, lower left supple worn fine-grain leather, lower right velvety short-nap suede. Every quadrant occupies exactly one quarter of the image and each has uniform surface coverage, photographed orthographically straight down at a consistent close scale. Neutral warm gray materials so the engine can tint them to garment colors. Physically convincing fine fibers and micrograin. Flat diffuse shadowless albedo illumination, no baked directional highlights, no wrinkles, no seams, no buttons, no large stains, no objects. Details should remain soft and natural, no repeating dot patterns, no embossed geometric pattern. Each individual quadrant should have matching edge tones and be suitable for repeating as a fabric material. This is a texture asset, not a contact-sheet photograph of swatches; surfaces touch at precise center boundaries.

### detail

Use case: photorealistic-natural. Asset type: a neutral detail texture atlas for procedural 3D character materials, square 1024 by 1024, a precise 2x2 atlas without gutters or labels. Upper left: subtle fine natural human skin pore microstructure, no features or facial anatomy, a uniformly covered tiny patch of skin. Upper right: mature human skin fine creases and micro-pores, restrained delicate lines, no deep cracks. Lower left: many fine closely packed straight individual hair fibers running vertically top to bottom, with very slight natural variation and continuous dense coverage. Lower right: many fine closely packed wavy hair fibers, mostly running vertically, natural gently interlocking curves and varied widths. All four quadrants are low-contrast neutral gray material surfaces with uniform diffuse shadowless illumination, designed to add microdetail to an existing colored material. No skin-tone colors, no face, no heads, no locks or isolated objects, no shine, no cast shadows, no bald patches. Fine hair fibers should feel like actual microscopy of hair, not chunky ribbons or stripes. Exactly four equal quadrants, edges meet at the center, matching edge tones within each tile, no border, no text, no watermark. This is a production texture atlas, not an illustration of people.
