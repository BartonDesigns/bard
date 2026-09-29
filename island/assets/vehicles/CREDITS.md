# Vehicle models

The close-up cars, the delivery van and the bus are openly licensed models, baked for the
web by `tools/bake-vehicles.mjs` (turned and scaled to real size, logos and plates left out,
materials folded so the game can paint them, wheels split onto their hubs, simplified,
textures to WebP, meshopt-compressed). Every other kind of car, and every car in the
distance, is the game's own lofted body (`src/bay/cars.js`).

All four are used under **Creative Commons Attribution 4.0 International**
(https://creativecommons.org/licenses/by/4.0/). They were changed: see above.

| File | Kind in the game | Work | Author | Source | Licence |
|------|------------------|------|--------|--------|---------|
| `sports.glb`, `sports-mid.glb` | sports car | "Car Concept" | Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH (itself from a public-domain CC0 model by Unity Fan) | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept | CC BY 4.0 |
| `crossover.glb`, `crossover-mid.glb` | crossover | "Red Car" | Camay (https://sketchfab.com/Camay) | https://sketchfab.com/3d-models/red-car-595228b5dda74defb25a767a04b3da0d | CC BY 4.0 |
| `delivery.glb`, `delivery-mid.glb` | delivery van | "European Delivery Van" | Evan Hiltz (https://sketchfab.com/evan.hiltz) | https://sketchfab.com/3d-models/european-delivery-van-0b2f1ad95a79419f9a092420024d329c | CC BY 4.0 |
| `bus.glb` | city bus | "Generic Town Bus" | own.guest (https://sketchfab.com/own.guest) | https://sketchfab.com/3d-models/generic-town-bus-14fe03d792914d51b6c6250b393c44fd | CC BY 4.0 |

The Car Concept's Khronos and 3D Commerce logo decals and its licence plate were removed
(they are the Khronos Group's marks, not part of the CC BY grant). The bus's route sign
texture was removed. None of the models carries a maker's badge.

Credit lines, as the authors ask for them:

- This work is based on "Car Concept" (https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) by Eric Chadwick / Darmstadt Graphics Group GmbH, licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Red Car" (https://sketchfab.com/3d-models/red-car-595228b5dda74defb25a767a04b3da0d) by Camay (https://sketchfab.com/Camay) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "European Delivery Van" (https://sketchfab.com/3d-models/european-delivery-van-0b2f1ad95a79419f9a092420024d329c) by Evan Hiltz (https://sketchfab.com/evan.hiltz) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Generic Town Bus" (https://sketchfab.com/3d-models/generic-town-bus-14fe03d792914d51b6c6250b393c44fd) by own.guest (https://sketchfab.com/own.guest) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

The same credits are shown in the game (the drive panel's "Vehicle credits").

## Where the rest came from

- Driving physics: Rapier (`@dimforge/rapier3d-compat`, Apache-2.0), loaded only when you
  drive, from `dist/rapier.mjs` (copied there by `build.mjs`).
- Model decoding: three.js's meshopt decoder (MIT).
- Drivers and passengers: the game's own MakeHuman people (`src/people/`, CC0 base mesh).

## Looked at and left out

- three.js's example sports car: its licence could not be confirmed, and it is a real
  maker's design.
- Low-poly car packs (Kenney, Quaternius, Poly by Google): toy proportions.
- Several pickups and a work truck found alongside the van: CC BY-NC or CC BY-NC-ND, or
  real makers' models.
