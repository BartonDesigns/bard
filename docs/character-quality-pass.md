# Character pose, gait, hair and clothing pass

The supplied recording showed a third-person rifle passing through the torso and clothing following the body too closely. Terrain was explicitly excluded from this pass.

## Changes

- Third-person long-arm fitting now resolves a torso exclusion envelope as well as wrist reach. The support palm can slide rearward along the fore-end for shorter arms. Rifle shape, trigger-hand contact and first-person sight alignment remain intact.
- Walking gets a deterministic signature from the character seed: cadence, stance duration, step width, lift, pelvis sway/roll/twist and slight left/right timing asymmetry. Bounded low-frequency drift adds variation without moving the first-person camera. Existing planted-foot IK still owns ground contact.
- Procedural coils and afro fallbacks use shaped helical guide locks with matching rounded follower strands. Authored imported styles remain the final groom when available. Roots remain anchored; hair has bounded inertial and clump motion. Imported styles keep their groom assets, strand-direction highlights and capsule collision projection. Hair stays one mesh per head, with a reduced phone strand budget.
- Clothing allowances now distinguish fitted, regular, straight, wide, baggy and oversized cuts. Non-stretch torso garments bridge contours below the chest; hems and compression zones gain geometry folds, with subtle movement at free hems. Cloth micro-normal strength is reduced. T-shirts no longer inherit a generational scoop neckline; shaped necklines retain skin beneath their cut edge.

## Research and limits

Pixar's 2026 SIGGRAPH talk, *Blazing a New Trail of Curls*, describes low-resolution silhouette guides, procedural detailed curl guides, directly corresponding render hairs and Fizt Strands collision/implicit simulation:
https://research.pixar.com/docs/2026.SiggraphTalks.BEB.pdf

RenderMan documents strand-oriented, multiple-lobe hair shading:
https://rmanwiki-26.pixar.com/space/REN26/19661553

This browser implementation adapts guide/follower structure, root anchoring and bounded secondary motion. It does not implement Pixar's proprietary Fizt solver, hair self-collision, a full cloth simulation, or film rendering quality. Garment topology still derives from the MakeHuman cage. Extreme garments, body morphs and poses can require further authored fit work. No claim is made that gait identification is generally more reliable than face recognition.

## Verification

`tools/character-quality-browser.cjs` uses production MakeHuman geometry, motion, clothing, hair, held-item fitting and shaders. It checks 54 rifle fits across 1.5 m, 1.75 m and 2.0 m bodies, three rifles, carry/aim and three aim pitches, plus walking/fire/reload. It records wrist-contact error and penetration of the torso proxy, and renders close-ups of coils, afro and imported waves with different clothing fits. A torso proxy is not a complete triangle/triangle collision proof.

`tools/gait.test.mjs` checks seed persistence, 1,000 distinct signatures, drift bounds and continuity. First/third-person rifle render checks covered 12 desktop and 12 phone-emulated states with no shader errors. Evidence is in `docs/verification/character-quality/`. Chromium software WebGL is used; native iPhone frame rate and physical Safari remain unmeasured.
