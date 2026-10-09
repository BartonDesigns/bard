# Held-weapon rig validation, 9 October 2026 UTC

The review uses the actual loaded MakeHuman mesh, skeleton and motion controller,
production `createViewmodel` and `createHand`, and current item meshes/materials.
It does not substitute a simplified hand rig.

The baseline exposed three release defects:

- Third-person support hands missed long-arm foregrips by 140–303 mm, because the fixed
  item placement was beyond the body's arm reach. Item position now fits both actual arm
  lengths before the existing IK solves the hands. Weapon dimensions remain unchanged.
- Third-person aiming had no held-item implementation. The new aim pose follows pitch,
  with gear routing right-mouse, touch and API intent. The bow is now upright and faces
  ahead instead of inheriting an arbitrary dangling-hand orientation.
- First-person bow placement applied its horizontal sign twice, putting the bow on the
  wrong side. This is corrected and bow aiming is supported. First-person sleeves now
  use a continuous cloth surface attached to the real forearm skeleton, removing the
  exposed pointed edges from the former cropped skin triangles.

`weapon-hand-preview.mjs` and `weapon-hand-browser.mjs` reproduce the review. Bundle the
entry with esbuild to `island/dist/weapon-hand-preview.js`, then run the browser script
serially with other WebGL tests. It accepts `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE`,
`CHROMIUM_ARGS` and `BARD_WEAPON_REVIEW_OUT`. The review clock advances with simulation
updates, preserving production weapon fire-rate checks.

Verified in Chromium/SwiftShader:

- 40 states: Aurora, Mossback, Warden and Reedline in first and third person, each carrying,
  aiming, firing, reloading and returned to ready.
- All fire/reload calls accepted; all reloads completed; aiming remained forward-facing.
- 36 further real-body configurations: adult heights 1.50, 1.75 and 2.00 m, four weapons,
  and pitch −0.45, 0 and +0.45 radians. Muzzle elevation followed the requested pitch.
- Maximum measured active hand-contact error was **0.0 mm at the reported 0.1 mm precision**.
  During long-arm reloads the support hand intentionally leaves the foregrip to follow
  the moving cell. `contactLmm` measures that active target; `palmLmm` still measures its
  distance from the normal foregrip, so those values are intentionally different.
- No page or shader errors. First-person hands and sleeves were visually inspected, as
  were the third-person carries and aim poses.

Current screenshots and complete measurements are in `docs/verification/weapon-hands/`.
The bow retains its existing one-hand presentation and fire/reload cue behavior; this
pass does not add a separate string-draw/nocking animation. These checks establish rig
contact and functional animation states, not an AAA art or native-device performance
sign-off. Production mouse/touch and gameplay checks are recorded by the release gate.
