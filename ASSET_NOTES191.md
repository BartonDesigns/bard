# Build 191 material artwork

This build uses four original material atlases made with the built-in image generation tool. Each atlas contains four material swatches. The delivered WebP files are 1024 × 1024; the originals are retained separately. Together, the four production images add about 1.44 MiB of downloads. Only the instrument image is requested on the faceplate. World images load on demand and preserve the existing materials when unavailable.

## Material sets

| Atlas | Top left | Top right | Bottom left | Bottom right |
| --- | --- | --- | --- | --- |
| geology.webp | Limestone | Granite | Basalt | Sandstone |
| ground.webp | Moss and woodland floor | Loamy soil and gravel | Pale sand | Riverbed stones |
| architecture.webp | Lime plaster | Limestone masonry | Slate roofing | Cedar timber |
| instrument.webp | Etched olive brass | Graphite aluminum | Pearlescent enamel | Walnut |

Normal and roughness maps are derived at low resolution from the source detail. They provide restrained shading relief, not measured scans or displacement geometry. No geometry, collision, musical mapping, or instrument audio is replaced by these assets. Mirrored sampling and inset atlas coordinates avoid hard wrap seams and neighboring material bleed.

## Generation prompt set

### Geology

Use case: photorealistic-natural. Asset type: production game material texture atlas, a single square image with exactly four equal square quadrants, 2 by 2, meeting at the exact center; no gutters, frame, labels, or text. Orthographic close-up flat albedo material scan under diffuse overcast light, no perspective, directional shadows, or vignette. Top left: warm pale gray limestone, fine layered deposits, tiny fissures and restrained mineral staining. Top right: cool gray weathered granite with fine quartz mineral flecks and irregular hairline fractures. Bottom left: dark charcoal basalt, compact fine porous lava stone, subtly brown-gray pits and restrained broad cracks, not black. Bottom right: warm muted ochre sandstone with fine sediment lamination and realistic weathering, not bright orange. Photoreal natural surfaces for a realistic cave and planetary explorer. Moderate contrast and no overly dark baked crevices. Consistent scale within each quadrant. No plants, water, ornaments, animals, or objects.

### Ground

Use case: photorealistic-natural. Asset type: production game ground material atlas, one square image made of exactly four equal square quadrants, 2 by 2, meeting at the center. No gutters, borders, labels, or text. Straight-down orthographic scanned albedo textures, diffuse overcast lighting, no horizon, perspective, directional shadows, or vignette. Top left: dense low moss, fine olive green meadow fibers, tiny fern litter and fragmented oak leaves blending into dark woodland soil. Top right: medium warm brown loamy earth with irregular small gravel grains, tiny dry grass fragments, roots and naturally mottled soil. Bottom left: pale warm beige fine sand with delicate irregular wind ripple grain and sparse tiny mineral flecks. Bottom right: damp riverbed gravel of small flattened slate and rounded gray-brown stones with fine sand between, no visible water or directional gloss highlights. Restrained natural colors, consistent scale, and evenly distributed fine detail.

### Instrument finishes

Use case: product-mockup. Asset type: four precision instrument surface materials in a single square 2 by 2 atlas. Four equal quadrants meeting at the center, no borders, separators, labels, instruments, buttons, knobs, screens, or wires. Orthographic flat scan under soft diffuse even lighting. Top left: aged pale olive-gold brass, finely brushed and delicately etched with almost imperceptible interlocking geometric linework, warm patina. Top right: deep neutral graphite anodized aluminum with charcoal crossbrushing and microscopic scratches, satin finish. Bottom left: pale blush ivory pearlescent ceramic enamel with subtle finely distributed mother-of-pearl iridescence. Bottom right: dark warm walnut with fine straight flowing grain and tiny natural pores, low-gloss oiled hardwood. No directional spotlight, bright specular streaks, vignette, singular objects, or join lines.

### Architecture

Use case: photorealistic-natural. Asset type: environment architecture material atlas, one square image of four equal square quadrants meeting at the center. No gaps, frames, labels, or borders. Flat orthographic scanned albedo with diffuse even lighting, no perspective or cast shadows. Top left: warm ivory aged lime plaster, subtle stains, granular mineral finish and hairline cracks, no dramatic peeling. Top right: rough hand-laid pale gray limestone masonry with varied small rectangular irregular blocks and narrow naturally recessed mortar joints. Bottom left: small dark blue-gray natural slate roof shingles with restrained green-gray variation, overlapping rows and fine worn stone texture. Bottom right: weathered warm gray-brown cedar planks, fine straight grain, a few small natural knots and narrow seams. Moderate color contrast, fine tactile realism, uniformly filled quadrants.

## Upload

For an existing installation, use texture-update191.zip. Upload the four images into textures/realism191/ first, then replace index.html. Keep all existing runtime and asset folders. UPLOAD.txt has the exact file list. This update requires those five runtime files; it is not an index-only update.

## Verification

The generated materials render successfully with both bundled Three.js versions (r128 and r160). Checks covered shader compilation, material fallback, duplicate-request caching, terrain and building maps, and cave entrance UVs. A full cave-to-forest-surface transition completed with no page, shader, or WebGL errors. A geometry rotation compatibility error that previously prevented some Glen Vale districts from finishing is corrected.

All 11 faceplates were checked at a 390px mobile viewport. The three lead banks retain press/release feedback, and the circuit layers remain behind the keys. Artwork failure does not block the faceplate. Existing audio modules and Build 190 entry fixes remain unchanged. Browser tests used Chromium and mobile emulation; physical iPhone/Safari timing was not measured.
