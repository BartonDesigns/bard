# Night lighting, part 2 (October 16, 2026)

Part 1 (`docs/night-lighting-2026-10-15.md`) set the standard: dark overall, light only where
real lights are, no glowing walls. Part 2 lights what part 1 left dark: the landmarks and civic
art, the bridges and freeways, the skyline, the street lamps by era, the cars, and the sky
itself. It also fixes the day interiors' near-white fire bay and two bugs.

## The lights

### Landmarks, bridges and the skyline (`bay/floodlights.js`, new)

- Floodlights on the landmarks: the Ferry Building's clock tower, City Hall's dome, Coit Tower,
  the Transamerica spire, the Campanile, Hoover Tower, the Oakland Temple, the Golden Gate's
  towers and others. They light the landmarks' own materials through a third lamp list
  (`world/nightfield.js LF`). The list holds the few floodlights that matter most from where
  you are, chosen twice a second, so a tower is lit from below by its real geometry: brightest
  low, its far side dark, its spire fading into the night.
- The bridges: lamps along the decks and their pools on the roadway, the Bay Lights on the
  west span's cables, the anchorages catching the deck lamps' spill (unlit, they read as black
  holes). The Golden Gate's towers are floodlit from the deck (`bay/bridge.js`).
- The port's high masts over the Oakland terminals, the lighthouses' flashes.
- Red obstruction lights on everything tall, after FAA practice: a steady red from 90 m up
  (two at opposite corners of a broad roof), a flashing one from 150 m, every flashing light
  in the city in step at thirty a minute. Sutro Tower and the cranes too.
- Cost: two draws (every lamp, beacon and LED a point; every pool a quad), built once when the
  Bay loads and again for the skyline's beacons when its towers are known. The night and the
  clock switch them in the shader.

### The skyline (`bay/city.js`, `bay/towers.js`)

- Offices and towers light by the floor and the zone, whole runs of a floor at once. From far
  off a tower is a dark mass with lit bands and patches, not an even grey.
- A tower's lobby is lit all night, warm, its tall glass bright at the street.
- One in five towers over 110 m has a lit crown: uplights at the foot of the top floors
  washing up the facade, each its own scallop.
- Parking garages: open concrete decks every 3 m, a stripe of light under each deck's ceiling
  all night.
- Dark glass at night shows only a little of the city's glow (at the old 0.05 to 0.13 a curtain
  wall read as a glowing tower).

### Street lamps by era (`bay/streetlamps.js`, new; `bay/streetlife.js`)

- An old core's acorn lanterns burn a warm 2700 K. The cobra heads of the older streets and
  arterials are high-pressure sodium orange, with a share refitted to white LED (more on busy
  roads and newer tracts). The newest subdivisions have slim 4000 K LED heads.
- Each lamp throws a pool on the road and sidewalk: I over the slant distance squared times
  the cosine, fading to nothing at two and a half times its height, a cobra head's further
  along the street than across. One quad each, tilted to the slope. The freeways get a lamp
  each side about every 40 m.
- The nearest lamps light the walls and trees by them (`world/nightfield.js SF` for the city's
  buildings, `NF` for the houses and trees). They come on at dusk by their photocells, a little
  before the porch lights.

### Cars (`bay/carlights.js`, new)

- Every car in the traffic shows headlights in front and tail lights behind; the brake lights
  come on as it slows hard or waits at a corner, easing in and out.
- The nearest few, and yours, throw low beams on the road: a pool starting a few metres out,
  brightest about ten on, fading by thirty. Your own lamps also light the walls and trees
  ahead.
- A car with its door open has its dome light on.
- Cost: two draws, refilled each frame from the traffic's own list, no allocation.

### Civic art (`civic/colony-art.js`, `bay/nightlights.js`)

An LED bar over each piece washes it from above after dark (one additive draw for them all).
The big murals and graffiti pieces on the long walls get a lamp over them too.

### Homes at night (`interiors/index.js`, `interiors/lighting.js`, `bay/houses.js`)

Each household goes to bed at its own hour, between 22:30 and 01:30. After that one lamp stays
on (a table lamp if there is one, else the brightest light) and the screens.

### The sky (`world/sky.js`, `world/solar.js`, `main.js`)

- The Moon is where it really is tonight, lit on the sun's side (its phase), with faint
  earthshine on the dark side and the seas darker. A glow round it in the air scales with how
  lit it is. Moonlight follows its real direction and phase: long shadows when it is low; with
  it down or new, only the faint light of the night sky from overhead. On another world the
  moon stays opposite the sun and full.
- The cities' glow on a clear night lies toward the cities (`main.js` weighs the urban land
  round you by direction; `sky.glowToward`) and washes out the stars there. Under a low
  overcast the clouds' undersides read orange-grey, lit from below, brightest toward the city.

## Day interiors: the fire bay

Part 1 left the fire bay near-white by day. In the page the bay floor's bake was about 2.35, 2.7
times the node bake of the same plan, under the day's indoor exposure lift (`main.js`, up to
1.55 indoors by day). Two things reach that floor in the page and not in the node bake, and
both are fixed at the source:

- **A tower's floors were built inside the fire station's block.** When a service takes a
  block, `bay/towers.js` still built a tower's own floors there. Their stone floors, panels and
  lamps were drawn through the fire bay. `services/index.js` now marks the block
  (`b.ref.service`), and `towers.js` leaves a service's block alone.
- **The sun lit the rooms through the roof.** The interiors' meshes did not receive shadows,
  so by day the sun fell on every floor at full strength. They now receive the shell's and the
  walls' shadows (`interiors/lighting.js job`). The sun's direct light in a room is also scaled
  by how much sky the spot sees through the windows (the bake's sky share, `vIl.a`), so a floor
  by a window takes it and the middle of a deep hall takes little.

The day exposure lift itself is unchanged: it is the eye adjusting from the street, and with
the floor no longer lit through the roof it has nothing to blow out.

Not measured in the page: a probe that went to a fire station by day to read the bay floor's
bake timed out twice in this container's software rendering (a station has to be found and its
rooms built and baked). The fix is checked by the unit tests and by the three worlds loading
cleanly; the owner should look at a fire bay by day on a real device.

## Bugs

- `bay/nightlights.js` had no `dispose`. It now has one, and `bay/streets.js` calls it along
  with the floodlights' and the car lights'.
- Two `bay-landmarks` meshes (#3a3c40, #55646a) had NaN normals: a landmark open all the way up
  (the lighthouse's lantern room) built a band of zero height above the gaps, and a cylinder of
  zero height has NaN normals. That band is skipped now.

## Tests

`node --test island/tools/night-lighting-2.test.mjs` (8): the Moon's place and phase, street
lamps by era, the towers' red lights by height and in step, the landmarks' choice of
floodlights, the cars' brake lights and beams, the three lamp lists, the evening letting go of
what it drew, and no NaN normals in the landmarks. `night-lighting.test.mjs` updated for homes'
bedtime lamp.
