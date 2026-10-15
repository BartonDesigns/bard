# Night lighting (October 15, 2026)

The owner's notes, from walking the streets and the rooms after dark: the rooms and buildings
should be dark at night; many houses in the distance read bright white or grey, as if glowing;
the lit windows, porch lights and string lights are welcome, the blindly bright walls are not.
Wanted: building spotlights and landscape lighting in the evening, little solar yard lights,
the arborist's uplit trees. Aimed at a realistic, cinematic night: dark overall, light only
where real lights are.

## Why the walls glowed

Three lifts, all applied everywhere regardless of what lamps were near:

1. **The city's building shader** (`bay/city.js`, `buildingMaterial`, used by every gridded,
   mapped and grown town's building, the far house blocks and the skyline) added, after dark,
   the wall's own colour times 0.14 (a cool "city glow") plus 0.3 warm on everything below
   16 m (a "streetlight spill"), as emission. A house is all below 16 m, so a far house's wall
   gave back about 0.44 of its colour as light, two and a half times what the moon gave the near
   houses' walls (lit by the moon only), on every face, shadowed or not. That is the glowing far
   houses: near houses were moonlit, far ones self-lit.
2. **Exposure** (`world/sky.js`) rose from 1.15 to 1.3 at night, lifting everything 13 percent.
3. **The moon** was 0.5 strong, a cool directional light opposite the sun every night.

Indoors (the interior lighting branch, merged here): the bake was multiplied by 1.25 after
dark, the real lights by 2.2, the lamps' glow by 2.2, and main.js lifted exposure by 15 percent
indoors at night. The fire station's bay floor read flat and near-white because its 3.6 m grid
of tubes at 4.6 m is, in the bake as in life, an even field of light (the node bake: 0.87 under
a tube and 0.84 between), lifted again by all of the above; the bake had pools only where the
fixtures were far apart.

## What changed

### The walls

- `city.js`: the uniform glow is gone. After dark a wall has only what reaches it: the moon and
  sky, a small spill of the street lamps on the shop fronts at the sidewalk (SF rows with doors,
  retail, flats over shops; ground floor only), and its household's own lamps from the plan
  (below): the porch light by the door (a sconce one side of it on a house, a lantern over a row
  house's door up its steps), pooled on the wall round it with a warm core that becomes a
  pixel-sized point far off, and the light over the garage doors. One new per-instance attribute
  (`aNL`) carries each building's porch and garage hours, colour and side.
- `sky.js`: exposure 1.15 day and night; the moon 0.36.
- `main.js`: the indoor exposure lift is by day only (`1 + indoorK * 0.55 * dayK`, the same as
  before by day).
- Towers' and shops' unbaked interior fill glow no longer rises after dark.

### Interiors

- No night lift: the bake, the lamps' glow and the real lights are the same strength by night
  as by day (the real lights 1.2 times their fixture, from 1.6 to 2.2).
- **Night lights.** Every place that is not a home and not a hospital keeps only its night
  lights on when it is shut, and after dark if it never shuts (stations, armories, landmarks):
  about one fixture in each 9 m square of each room, plus screens and signs. The bake now keeps,
  per vertex, the night lights' share of the light (`inight`, one byte), so switching is a
  uniform (`ibakeNight`), no rebake. The fire bay at night: 19 of 56 fixtures, floor light 0.09
  between and 0.3 to 0.45 under the kept tubes (node bake), pools with dark between. Halos,
  dusty beams and the real lights follow the night lights.
- A shut shop keeps its night lights at 60 percent instead of every lamp at 8 percent.
- Unlit rooms in houses stay as the bake leaves them: no lamp, no light but the windows'.

### The evening's lights outside (new)

`bay/nightplan.js` (plain numbers) decides, per household from its seed, what it has and when:
a porch light (84 percent of houses; 30 percent all night, the rest off between ten and three by
their own timers; warm incandescent, 3000 K or 4000 K), path lights down the walk (2 to 6, on
bigger lots more often), solar stakes along the bed (4 to 9, each battery its own, fading
through the night, the weak ones out by midnight), the light over the garage or a motion light
there, an uplight in the front yard's tree, and on the nicer houses a pair or three of uplights
washing the front wall. Each household's lights come on at its own point of dusk (a photocell or
timer, 0.18 to 0.5 of the sky's night). Offices, towers (some on all four faces), shops and
apartments are washed by uplights at a spacing of their own, some till late, some all night;
civic buildings (stations, hospitals, armories) all night. A few downtown street trees in their
wells and park trees are uplit. Shop signs (economy/layer.js) are lit while the business is open
(and the bars' and late places'), dark after hours.

`bay/nightlights.js` draws it, filled when the city round you is rebuilt (420 m on a desktop,
220 m on a phone, times the governor's reach): one draw of points (every lamp's glow, never
smaller than a pixel and a half, so far streets are strings of small points), one draw of quads
(the pools of light on the ground under porch, path, solar, garage and tree lights; the cones up
the walls from the uplights; additive), both switched in the shader by the hour from the same
plan (`lev()`), so nothing is touched per frame but two uniforms. Motion lights: the nearest
eight can wake, when you come within 7.5 m, for 45 seconds.

`world/nightfield.js`: the nearest 16 lamps (6 on a phone) light the near trees' bark and leaves
(leaves lit through from behind too) and the houses' outside walls (stucco, siding, garage
doors) by a short list of lights in those materials' shaders: porch and garage lights all round,
tree uplights as spots aimed up the trunk into the canopy. No three.js lights are added (their
count changing would rebuild every program, and every material would pay for them).

## Measurements

MEASURE

## Cost

COST

## Pictures

PICTURES

## Tests

`node --test island/tools/night-lighting.test.mjs`: when a lamp is on (dusk by its own point,
off at its own hour, all night, after midnight), solar fading, motion lights, the same household
every time and households differing, bigger houses lit more and boarded ones dark, civic
buildings washed all night, the far house's door where the city draws it and the shader's switch
matching the plan, the night lights a shut place keeps, the bake's night share, and the field's
shader patch.

## Follow-ups

- Landmarks (bay/landmarks.js, the regional landmarks) are not yet washed.
- The ground pools are flat quads: on a steep drive they can cut into the slope.
- Path lights assume the walk runs straight out from the door (6.5 m, 4 m on a mapped lot).
