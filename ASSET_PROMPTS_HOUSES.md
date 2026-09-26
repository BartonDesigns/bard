# Texture prompts: San Ramon houses, yards and hills

These are the materials the enterable houses still paint in code. Each prompt makes one
2 × 2 atlas in the same style as the build 191 atlases (`ASSET_NOTES191.md`), so the
engine cuts it up the same way (`island/src/world/photomats.js`).

**What to generate**
- One square image per prompt: 2048 × 2048 if the tool allows it, 1024 × 1024 at least.
- Save it as WebP (quality about 85) under `textures/houses/` with the file name given.
- Keep the quadrant order exactly as written: top left, top right, bottom left, bottom right.
- If an image comes back with borders, labels, perspective or a visible object, generate it again.

The engine makes each swatch seamless and derives its relief itself. It also tints most
materials per house or room (stucco colours, carpet shades, wood tones), so
restrained, even colour works better than a striking one.

---

## 1. floors.webp

Use case: photorealistic-natural. Asset type: production game floor material texture atlas, one square image of exactly four equal square quadrants, 2 by 2, meeting at the exact centre; no gutters, borders, frames, labels or text. Straight-down orthographic scanned albedo, soft diffuse overcast light, no perspective, no directional shadows, no vignette, no reflections or specular glare. Each quadrant shows about 1 metre by 1 metre of floor at a consistent scale.
Top left: light natural white oak engineered hardwood floor, planks about 13 cm wide running vertically, random plank lengths with staggered end joints, fine straight grain, a few small knots, satin finish, subtle board-to-board tone variation.
Top right: wall-to-wall residential cut-pile carpet in neutral light greige, dense soft fibres, faint vacuum-track shading, no pattern.
Bottom left: 30 cm beige porcelain floor tiles with a soft travertine-like mottling, straight narrow light-grey grout lines, a grid of about three by three tiles.
Bottom right: sealed smooth grey garage concrete slab, fine trowel marks, faint pale tyre scuffs and a few small oil spots, no cracks or joints.
Restrained natural colours, even detail over each whole quadrant.

## 2. interior.webp

Use case: photorealistic-natural. Asset type: production game interior material texture atlas, one square image of exactly four equal square quadrants, 2 by 2, meeting at the centre; no gutters, borders, labels or text. Flat orthographic scanned albedo under even diffuse light, no perspective, shadows, vignette or glare. Each quadrant shows about 1 metre by 1 metre.
Top left: painted interior drywall in warm off-white eggshell paint, very fine orange-peel spray texture, perfectly even colour, no seams, stains or objects.
Top right: glossy white ceramic subway tile backsplash, 7.5 by 15 cm tiles in a running bond, thin light-grey grout lines, very slightly uneven handmade glaze, no reflections of objects.
Bottom left: light quartz kitchen countertop, soft white with fine grey speckle and a few faint soft grey veins.
Bottom right: painted white shaker cabinet door wood, flat panel surface with fine brush and wood-grain texture under the paint, no hardware, no panel edges.
Neutral, clean and realistic.

## 3. exterior.webp

Use case: photorealistic-natural. Asset type: production game exterior architecture material atlas, one square image of exactly four equal square quadrants, 2 by 2, meeting at the centre; no gutters, borders, labels or text. Orthographic flat albedo under diffuse overcast daylight, no perspective, cast shadows, vignette or glare. Each quadrant shows about 1.5 metres by 1.5 metres.
Top left: California tract-house exterior stucco, sand-float finish, fine even sand grain with soft trowel swirls, pale neutral warm beige, very faint weathering near the bottom, no cracks or stains.
Top right: white painted steel sectional garage door surface with a faint embossed woodgrain texture, horizontal orientation of grain, flat, no panel edges, no windows, no hardware.
Bottom left: broom-finished grey concrete driveway, fine parallel broom lines running horizontally, light weathering, a little dust, no joints or cracks.
Bottom right: weathered redwood fence boards standing vertically, about 14 cm wide, warm grey-brown, fine grain, a few small knots, narrow gaps showing a darker shadow between boards.
Moderate contrast, realistic suburban materials.

## 4. roofs.webp

Use case: photorealistic-natural. Asset type: production game roofing material atlas, one square image of exactly four equal square quadrants, 2 by 2, meeting at the centre; no gutters, borders, labels or text. Straight-down orthographic view of a roof surface as if laid flat, diffuse overcast light, no perspective, sky or horizon, no directional shadows. Each quadrant shows about 2 metres by 2 metres of roof, with courses running horizontally and the downslope toward the bottom of the image.
Top left: charcoal grey flat concrete roof tiles, overlapping horizontal courses, slightly weathered with faint pale lichen specks.
Top right: brown and terracotta blended concrete S-profile barrel roof tiles in even overlapping courses, muted Mediterranean colours, sun-faded.
Bottom left: weathered grey-brown architectural asphalt composition shingles, dimensional laminated tabs, fine mineral granules.
Bottom right: warm grey-brown weathered wood shake roof shingles, split cedar texture, overlapping courses.
Muted, sun-faded Northern California colours; even coverage.

## 5. hills.webp (for the East Bay hills, optional)

Use case: photorealistic-natural. Asset type: production game ground material atlas, one square image of exactly four equal square quadrants, 2 by 2, meeting at the centre; no gutters, borders, labels or text. Straight-down orthographic scanned albedo, diffuse overcast light, no horizon, perspective, directional shadows or vignette. Each quadrant shows about 1.5 metres by 1.5 metres of ground.
Top left: dry golden summer California grassland, flattened wild oat and brome straw, pale gold and tan stems over a little dusty soil.
Top right: green spring California grassland, short fresh grass with a few clover leaves and tiny yellow and purple wildflowers, dense and even.
Bottom left: coast live oak leaf litter, small dry brown and grey-green holly-like oak leaves and a few acorn caps over dark soil.
Bottom right: packed decomposed-granite and sandstone hiking trail surface, fine tan grit with small angular pebbles and faint footprints, no plants.
Restrained natural colours, consistent scale, even detail.
