# Weapon hands

The #36 anatomical hands now hold each weapon finger by finger. Before this change the first-person fingers were the avatar's own uniform carry curl: a clenched fist beside the grip, fingers 15 mm or more inside the stock, no trigger finger, and the support fingers through the handguard.

## How it works

- `island/src/crysis/finger-pose.js` is new. It reads a finger rig off the player's own body: three bones a finger, the axis each curls about, and the skin vertices of every finger and the palm with their weights. It reads the held weapon as triangles in a small grid, so any point can be asked how far it is from the surface (negative inside). Each finger is solved on that surface. **Wrap** fingers close until a segment touches, then the joints past it close on. **Reach** fingers bring a pad, or the crease of the last joint, to a point. **Fixed** fingers take given angles. The skin then has the last word. A finger sunk into the surface opens until it is clear, and one that floats closes until it touches. The palm rests on the surface, a little soft at the heel. If a knuckle stays sunk, the palm moves off up to 6 mm and the fingers close again. Poses are four numbers a finger and blend as numbers. Each frame they become rotations of the fifteen finger bones under the wrist, with no allocation.
- The solve runs once per weapon, tier and level when the item comes to hand, and is cached. Measured cost: a few tens of milliseconds on desktop software GL.
- `held-items.js GRIPS` holds a plan per pose for every weapon. `HOLDS` gained a twist round the grip axis (`holdFrame()`). The Mossback has its own grip frame for its thumbhole stock.

## Per weapon

| Weapon | Strong hand | Support hand | Reload |
| --- | --- | --- | --- |
| Aurora trail rifle | High grip: web under the tang, three fingers wrapped round the front strap, thumb round the back strap. Index straight along the receiver above the guard when carried, sprinting, reloading or changing; on the trigger at the sights and for 0.55 s after a shot. | Under the handguard, fingers angled forward up the far side, thumb along the near side. | Hand to the cell at 0.08 to 0.2, closes on its side and front, out with the out cue at 0.22, off screen to a pouch, back with a fresh one, seated by 0.8 with a palm push (in cue), up to the new charging knob, drawn back 34 mm and let go (ready cue at 0.925), back on the handguard by 1.0. Timings are unchanged (2.3 s). |
| Mossback scout rifle | Same, on the integrated grip; the thumb goes through the thumbhole. | Round the barrel tube. | Same choreography, 2.0 s. |
| Warden spark carbine | Same as the Aurora. | Under the tall front body, fingers up its side. | Same choreography, 1.7 s. |
| Reedline hunting bow | Draw hand as on main: the body's own curl on the string, the same placement, draw length and anchor (a hooked-finger draw to a jaw anchor was tried and read worse, so it was taken back out). | Bow hand loosely round the riser; the whole palm and heel rest on the grip without pressing in (`solveHand` firm fit). | The arrow comes from the quiver as before. |

## Feel

- **Trigger:** the finger draws through on the break, and the hand tightens on the kick. A beat later (0.12 to 0.46 s) it eases and closes again on the grip.
- **Breathing:** a breath of tension through both hands.
- **Weight:** a slow wander of the muzzle, largest with the long rifles and much tighter at the sights. The turn-lag springs overshoot slightly.
- **Wrists:** the forearm runs back from the hand's own axis, bent about 12° back and 18° toward the little finger. The elbow points only steer it. Measured wrists at carry: strong hand 3° to 6° back and 26° to 28° ulnar; support 21° back and 15° ulnar.
- **Transitions:** each finger eases toward its new pose, so fists to weapon and back, reload phases and bow states blend rather than snap.

## Models

- First-person copies (`itemModel({ view: true })`) leave the sling strap off and keep the mounts. With no body to hang against, the strap cut through the support hand.
- The three rifles have a charging knob of their own (`CHARGERS`): a slot in the body and a knob in its own mesh, about 150 triangles. Third person shows it static.
- `CELL_HOLD` is now a side grab on the cell. `cellPath` seats the fresh cell at 0.8. Both are shared with third person.

## Measured contact

Every finger's rendered skin was measured against the weapon's own mesh (`tools/weapon-hands-preview.mjs fingerContact`). The figure is the deepest point per hand in mm; negative means inside. BEFORE was measured with a 16 mm search reach, so -15 means 15 mm or deeper.

| Desktop | Before R / L | After R / L |
| --- | --- | --- |
| Aurora carry / fire / reload / charge | -15 / -9.8, -15 / -9.8, -15 / -15.8, -15 / n.a. | -1.2 / -2.8, -2.3 / -2.8, -2.1 / -2.1, -1.2 / -0.1 |
| Mossback carry / fire / reload / charge | -15.7 / -16 throughout | -4.0 / -3.2, -4.0 / -3.2, -4.0 / -2.0, -4.0 / -8.5 |
| Warden carry / fire / reload / charge | -15 / -15.9 throughout | -2.4 / -20.6 (support thumb), -2.4 / -20.6, -2.4 / -2.0, -2.4 / -2.2 |
| Bow carry / aim / reload | -1.4 / -12.9 throughout | -1.4 / -3.5 (riser thumb; palm -3.1) |

Median finger penetration per hand dropped from 11 to 15 mm on the strong hand to 0.3 to 2 mm. Palm-to-grip frame error stays at 0 mm. The arm layer is still 27,848 triangles. The finger solve adds no geometry. On quality tiers below 0.75 resolution, the refined hand surface is skipped, giving about a quarter of the hand triangles.

## Verification

- `node --test island/tools/weapon-hands.test.mjs`: 9 tests covering rig reading, signed distance, wrap contact, reach, blending without allocation, plan coverage, cell timing and the bow hook riding the nock.
- `node --test island/tools/*.test.mjs`: 599 pass. The 4 known failures remain (RGB manifest, nearby tiles teardown, Svalbard flora, regional vegetation refresh).
- Smoke: SMOKE OK.
- Browser captures: `island/tools/weapon-hands-browser.mjs`, with bundle `tools/weapon-hands-preview.mjs`. It covers 4 weapons at carry, aim, fire, reload (0.32) and charge (0.9), on desktop 1100x700 and on a phone viewport (844x390, iPhone UA), with four closeups per state.

## Thumb fix and joint ranges (October 15, later)

The owner saw the strong-hand thumb bent backwards past its natural line. Cause: the thumb used the body's finger curl axis, which for the thumb's own orientation swings it back rather than across the palm, and the solver could push it there. Now:

- **Thumb axes.** Each thumb joint curls about the axis that carries it toward the little finger's knuckle (`finger-pose.js fingerRig`). Its spread lifts it off the palm toward whatever the palm faces, so it can go round a handle.
- **Ranges.** Every joint has an anatomical range in its own bone frame (`LIMITS`), enforced after every solve and every blend (`limitPose`), in first person and in close combat.
  - Fingers: knuckle 0 to 90 degrees (10 back), middle joint 0 to 110, last 0 to 80, spread 17 either way.
  - Thumb: saddle joint lift to 57 and flex 52 (12 back); knuckle 0 to 60, never back; last joint 0 to 80, 3 back at most.
- **J-hook on the rifles.** On the Aurora and Warden pistol grips the thumb hooks round the back strap like a J, its pad on the far side, tip forward and down. On the Mossback it goes through the thumbhole and lies along the far side. The strong hand moved back so the thumb's base sits behind the strap. The pressing thumb is judged by its own skin (`soft`), so the thenar may press the strap about 2.5 mm, as a real hand does.
- **Support thumbs.** The support, cell, charge and riser thumbs are judged by their skin too. The Warden support thumb is now -2.9 mm (was -20).
- **Draw hand.** It keeps main's placement and closed fingers, now in the solver, with the thumb flexed gently toward the palm.
- **Close combat.** `combat/anatomical-hand.js` now poses through the same solver.
  - Fist: fingers folded, thumb laid over the index and middle fingers.
  - Grip: the fingers close on the held thing's handle and the thumb wraps over them.
  - The other hand on a two-handed bat or pipe closes on a stand-in shaft.
- **New items.** `combat/melee-items.js` adds a hunting knife and a machete (hammer grips, blade out past the thumb, edge forward) beside the bat, pipe and bottle. The bottle is now held by the neck. Each new item has:
  - rules in `melee-rules.js`: knife 15 / 26 heavy, quick; machete 21 / 33, like the bat;
  - brawl blows in `brawl.js`;
  - a hold in the brawlers' hands and as a dropped item (`melee.js`);
  - a rarer spawn in town (knife 8%, machete 6% of drops).
  - Held in one hand, the other stays up in its guard.
- **Tests:** `tools/weapon-hands.test.mjs` runs every weapon grip and every close-combat item through the solver on the real geometry. It asserts every joint stays inside its range, the thumb is never back at its knuckle, and no wrapped finger sinks in.

The reverse knife grip was not added: a hammer grip reads cleanly at this distance.

## Left to do

- The Warden support thumb (-20 mm) still sinks in; the bow hand's thumb and palm press about 3 mm into the riser.
- The strong thumb wraps round the back strap rather than lying along the left side, because the receiver sits low over these grips.
- The charge pose's ring and little fingers float 5 to 12 mm. Narrowed on October 15 (integration): they no longer relax off the receiver and close on toward it where it is near (`rest`), now 2 to 5 mm (ring 2.9 / 5.4 / 3.2, little 2.1 / 2.8 / 3.6 on the Aurora, Warden and Mossback; were 6.4 / 8.6 / 6.7 and 4.2 / 5.1 / 4.5). They curl past the side of the receiver, so the last few millimetres would need a plan of their own.
- The index at carry floated about 6 mm off the receiver (Aurora 6.7, Warden 5.9, Mossback 3.7). Fixed on October 15: the carried index is laid on the frame (`lay` in `finger-pose.js`: its spread and knuckle searched within its range for the pose whose skin rests on the surface, nearest the pose it had, its tip never lower than it was, so it stays straight and never drops onto or into the trigger guard; a version that let it curl or drop put the tip into the guard and was taken back out). Now 1.8 / 1.8 / 0.0 mm off (Aurora, Warden, Mossback). Joint limits unchanged (`limitPose` after every solve).
- The carry framing still leaves the strong hand below the bottom edge on desktop.
- Melee items (bat, pipe, bottle) still use the uniform `anatomical-hand.js` grip curl.
- Not verified: iPhone hardware frame rate.
