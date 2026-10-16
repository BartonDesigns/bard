# Quest variety and combat response

Repeated theft scenes now share one persistent encounter budget across regions and worlds. Bags, snatches, and materialized theft leads require at least twenty minutes of active simulation between occurrences, including the first occurrence in a new save. Background bag/snatch weighting falls from 38% to 3%. Ambient favours leave 150–240 seconds between offers, avoid recent kinds and consecutive families, and prefer unseen tasks. Explicit conversations remain available. Sparse areas may repeat their only available task after twelve minutes.

Six local tasks have distinct completion conditions: accompany an NPC to a meeting point, deliver and apply a first-aid kit, rush a parcel, check on a neighbour and report back, inspect three locations, or collect three pieces of litter. They use the existing favour prompts, objective markers, reward rules, and actor cleanup. Timed deliveries expire without payment. Escort and survey routes use walkable ground checks.

Six field contracts add perimeter surveys, holding a cleared position, marksman encounters, a scouted approach, successive blockade squads, and a relay survey/defence. The original three introductory contracts remain first; later contracts rotate through eight scenarios instead of repeating the last relay forever. Survey/hold objectives must finish before opening the cache, and rewards remain single-use.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Quick strike | Click or Q | Strike |
| Charged heavy | Hold Shift + click/Q, then release | Hold Heavy, then release |
| Grab or throw | J | Grab |
| Select/release target | L or middle mouse | Lock/Unlock |
| Cycle target | Shift+L | Next |

Target selection shows a bracket, distance, and off-screen direction. It prioritizes enemies, requires line of sight, and clears on invalid targets, menus, world changes, or sustained occlusion. It does not move the camera or steer projectiles. Selected melee targets still require the original reach, facing arc, line of sight, and protection checks.

Quick strikes begin on the input press instead of waiting to distinguish a tap from a hold. One follow-up strike can be buffered. Heavy attacks have an explicit control, and cancelled touches cannot release an unintended heavy. Gun trigger edges are captured in the input handler so a press/release between animation frames is retained. Cosmetic impact effects no longer slow the player's strike timer. Civilian collision bounds refresh before weapon input is consumed.

## Validation

- 84 focused Node tests cover encounter persistence and rarity, sparse-area recovery, all six local task lifecycles, expiry/interruption, target eligibility, contract rotation/objectives, weapons, bows, melee, and touch controls.
- Deterministic 30/60 fps tests start a jab synchronously on press and reach its impact within 67 ms of simulation time, with no extra strike on release.
- `island/tools/target-controls-browser.cjs` checks keyboard/touch selection and cycling, unchanged camera direction, occlusion, inactive cancellation, wrong-finger rejection, heavy cancellation, and usable controls at 390×844 and 844×390.
- `tools/combat-response-live.cjs` exercises the production bundle: Q begins a jab inside its event handler; Shift+Q charges; a synthetic touch down/up in the same JavaScript task produces exactly one real shot; inventory blocks fire; no frame or page exceptions occur. The report includes the bundle SHA-256.
- `npm run build --prefix island` rebuilds the shipped bundle and its cache version. `git diff --check` passes.

Browser checks use Chromium software WebGL. The existing trusted pointer-lock mouse-movement fixture could not observe movement in this headless runtime, so it is not claimed as passing. These checks verify input handling and simulation timing, not a zero-latency or real-device frame-rate guarantee.
