# Workplaces, malls and character contact

11 October 2026. This pass addresses commercial identity, full-height tower interiors,
large shopping buildings, long hair and clothing/body contact.

## Building use and height

Office source lots stay commercial. They no longer become apartments merely because
they exceed nine or twelve metres. Multi-storey offices and large retail anchors are
routed to the tower system instead of the single-room commercial builder. Schools,
parking structures and ordinary residential lots keep their own builders.

A tower has a deterministic programme on every occupied storey, a roof, structural
slabs at every height and an elevator directory. The renderer retains at most three
furnished floors near the player's altitude; office floors hidden by the current floor
are not drawn. Arrival from above works without first visiting the lobby. The collision
query uses the complete plan rather than only the two previously rendered levels.
Selection prefers the lot containing the player, allowing neighbouring commercial
buildings to hand over correctly. Merged temporary geometry and per-floor sign textures
are disposed on eviction.

Seven tenant programmes plus periodic sky commons vary the fit-out: product studios,
client services, engineering, finance, coworking, conference centres and executive offices.
Workstations have monitors, keyboards, books, cups and rounded chairs. Glass meeting rooms,
focus/private rooms, pantries, printing areas, restroom stalls, columns, lighting,
wayfinding and clear circulation give the spaces commercial functions. A small share of
tall towers can include two guest-apartment floors; office buildings never randomly
become entirely residential. Generated modern downtowns can include 45–74-storey landmarks.

Regional profiles use actual globe coordinates. Pacific coast, Japan, East Asia,
Southeast Asia, Europe, Gulf and international profiles vary workstation spacing,
privacy-room allocation, timber ceiling baffles and shared-floor intervals. These are
expandable design profiles, not surveyed reproductions of real buildings.

Large retail anchors become malls with multiple occupied levels, perimeter shop units,
shopfronts, displays, a top-floor food court, central atrium, guards and paired walkable
escalator treads. Rendering and collision share the same atrium openings and step heights.
The escalators provide a walking connection; powered step animation is not implemented.
Generated large shopping sites have taller anchors to accommodate multiple retail floors.

## Architectural references

The programme is informed by public project descriptions, without copying their plans:

- Gensler, [Meta Park Tower, San Francisco](https://www.gensler.com/projects/meta-park-tower):
  a vertical workplace with distributed amenity clusters, cafes, collaborative areas and
  floor-group wayfinding.
- Mori Building, [Toranomon Hills office information](https://www.toranomonhills.com/about/office/index.html)
  and [floor directory](https://www.toranomonhills.com/floor_map/mt_map_1f.html): office-led
  mixed-use towers with shared business amenities and retail/food podiums.

## Hair and clothing

Three original curve-groom recipes add layered centre-part hair, long loose waves and
side-part layers. Geometry is fitted to each person's skull, uses rounded ribbon
cross-sections, layered roots and tapered ends, and inherits the existing damped guides
and hair/body contact. The 96/108-guide recipes produce 19,968/22,464 triangles. The strand
coverage atlas is generated mathematically, with no borrowed image. Existing credited
MakeHuman styles remain available. Recipes live in `island/assets/people/hair/long-grooms.json`.

Clothing gains twelve posed body capsules and post-skinning contact correction, capped
at 35 mm. Rest-overlap calibration preserves the tailored starting silhouette instead
of inflating it to match approximate capsules. Shoes are excluded. This is body-contact
correction, not a cloth simulation with self-collision or collision against world objects.
The sampled posed checks show reduced proxy overlap, but still leave roughly 31–42 mm
of maximum residual overlap in some poses. Those measurements are against approximate
capsules, not exact visible-skin penetration; do not report clipping as fully solved.

## Verification

- 16 Node tests pass: 70 occupied floors, commercial routing, regional selection, slab
  coverage/atrium holes, bidirectional escalator traversal, pose-space contact, rest
  calibration, groom geometry/weights, garment surfaces, hair response and gait.
- Production tower renderer fixture covers offices, conferences, upper apartments, a
  five-level mall, food court and a Japanese-profile office. It traverses all 70 occupied
  levels plus roof, checks every floor and a maximum three-floor cache, and clicks the
  real elevator button to travel to level 60. Geometry settles at 24 retained resources
  after the traversal. Desktop and phone-size viewport runs have no shader/page errors.
- Production character fixture covers all three new grooms with cotton, hoodie and jacket,
  plus a fitted garment, standing and seated. Both viewport runs check twelve finite
  posed capsules, normalized skin weights, hair lighting frames, guide limits and the
  35 mm contact bound. Existing walking rifle contact checks pass.
- `npm run build` in `island/` passes. Both Worker `/status` routes remain ready; this
  release requires no Worker deployment.

Evidence is in `docs/verification/workplaces-and-contact/`. The browser fixtures use
Chromium/SwiftShader and phone-size emulation, not physical iPhone/Safari performance.
No AAA art-quality or worldwide street-by-street coverage certification is implied.
Office emergency stairs, richer service rooms, additional storefront merchandise,
full cloth/self-collision, and higher-fidelity groom art remain further work.

Reproduce with `node --test island/tools/workplace.test.mjs island/tools/cloth-contact.test.mjs
island/tools/character-surfaces.test.mjs island/tools/hair-motion.test.mjs island/tools/gait.test.mjs`.
Bundle `workplace-preview.mjs` or `character-contact-preview.mjs` with esbuild, then run
its matching browser script with `ARMAMENT_RIG_BUNDLE`, `ARMAMENT_ART_OUT`, `PLAYWRIGHT_MODULE`
and `CHROME_EXECUTABLE` set. Add `CHARACTER_DEVICE=phone` for the phone viewport.
