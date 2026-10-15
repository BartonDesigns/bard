# Third-person clothing and holds (October 15, 2026)

What the avatar in third person and every NPC (civilians, police, soldiers, gang members, militia, workers) wear and how they hold a long arm. The first-person hands and sleeves are a separate piece of work (`crysis/viewmodel.js`, `crysis/held-items.js`, the first-person garment module) and were not touched here.

## 1. What was wrong

The cloth mesh (`people/garment.js`) is cut from the body's own cloth cage and pushed out along the skin normals by a fit allowance. That gave every sleeve the arm's own cross-section, inflated: a round tube. The allowance was the same all the way down, so a loose sleeve was widest where the arm is thinnest and flared into a bell at the wrist (an oversized hoodie stood 47 mm off the forearm all round). There were no cuffs, no waistbands, nothing gathered, and nothing moved with the pose except the skinning, so a bent elbow just bent the tube. Vests and plate carriers were axis-aligned boxes floating 4 to 5 cm off the chest; a hoodie's hood was a torus behind the neck; shirts had no collars; the combat helmet was a bowl down to the eyes. The low-ready carry put the strong elbow out at shoulder height (a chicken wing), and NPCs never raised their guns.

## 2. Sleeves and hems (`people/garment-shape.js`)

Pure functions, baked into the cloth mesh at dressing time:

- `sleeveEase(garment, t, dc, outer)`: the stand-off of a sleeve at `t` along the arm (0 the shoulder joint, 1 the elbow, 2 the wrist) and `dc` metres above its cuff. Snug at the armhole, opening to about 13 mm at the bicep (regular fit; scaled by `looseness`: slim 0.55, oversized 1.9), narrowing by about a quarter down the forearm. Long sleeves end in a cuff: a knit rib hugs the wrist at 2.8 mm with the spare length stacked just above it; a woven shirt has a firm band of 6.5 to 8 mm; a jacket's open end narrows a little. A short sleeve opens toward its hem. `rolled` (a new sleeve length, cut at 30% of the forearm) ends in a thick roll of 12 to 15 mm below the elbow.
- `waistbandEase(garment, h)`: a ribbed top (hoodie, sweat, half-zip, track top, fleece, knit) draws in to the hips over its last 6 cm and blouses just above.
- `armT(point, cut)`: where a rest-pose point lies along the arm, from the joints `landmarks()` now keeps (`cut.arm`).
- Edges: each cut edge's turned-back return now has its own thickness (`finishGarmentEdges`): 3 to 3.4 mm for a rib, 2.6 mm for a shirt cuff, 9 mm for a rolled sleeve, and a sleeveless armhole is cut clean in a curve instead of left to whole cage triangles (the hi-vis vest's jagged shoulders).

## 3. Folds that follow the pose (vertex shader, no cloth simulation)

`SLEEVE_POSE_GLSL` runs in the cloth's vertex shader after skinning and before the existing body contact (`cloth-collide.js`), on sleeve vertices only. Each vertex carries two bytes (`sleeve`: its place along the arm and its slack). It reads the posed upper-arm and forearm capsules the contact pass already uploads, so it costs no new uniforms per frame:

- the slack hangs under the arm, by how far the arm is from vertical (an arm held out sags underneath and is drawn in on top);
- a few soft lobes round the arm, drifting along it, so the cross-section is never a circle;
- a bent elbow gathers ripples on its inside and draws the sleeve taut over its point;
- a raised arm gathers cloth on top of the shoulder and pulls it in under the arm.

The fragment's creases (`folds()`) now follow the sleeve: sharp-crested hang folds down it, drag lines spiralling off a bent elbow, compression rings at the elbow and stacked folds above a long cuff, all scaled by the live bend (`vFold`).

## 4. Making (fragment shader `tailor()`, uniform `uKind`)

Per top and per layer: ribbed cuffs, waistband and neck on knits; a shirt cuff with its seam and button; a button placket (full on shirts, short on polos and henleys) and a chest pocket on shirts; a hoodie's kangaroo pouch with its slanted openings; seams round the armhole, down the sides and over the shoulders, all as colour and a small bump (`gDetail`), faded out once a pixel covers more than about a centimetre. A new pattern `hivis`: fluorescent cloth (a little self-lit) with two reflective bands round the body and braces over the shoulders, the tape retro-reflective (it brightens toward the eye).

## 5. Pieces laid on the dressed body (`people/garment-kit.js`)

`torsoField` turns the dressed torso (the cloth's own rest-pose body panels plus the bare torso) into a front and back height field; `necklineRing` finds the top's actual neck edge. On those:

- **Plate carriers** (police and military): front and back plates following the chest and back 12 mm off the clothes with rounded edges, the top corners cut in for the arms; a cummerbund round the waist; straps over the shoulders; magazine, admin and radio pouches standing on the plate with their flaps (police: a radio on the strap, the badge on the plate, a reflective band).
- **Hood down**: its opening rolled round the neck, the crown lying in a soft fold down the upper back, and drawstrings with their tips hanging down the chest.
- **Collars** on shirts and polos (and anything marked `collar`): the stand, the fold and the fall, with points at the front.
- **Combat helmet**: the brow above the eyebrows, cut over the ears, down to the nape behind, with a lip, in a matte cloth cover.

## 6. Who wears what

- Soldiers (`combat/outfits.js`): about a third with the jacket's sleeves rolled over a pattern tee; militia in the camouflage look roll theirs (the jacket's over a short-sleeved shirt) about a third of the time. Each is the outfit's last random draw, so every other part of a fighter's kit is unchanged.
- Civilians (`people/wardrobe.js`): a woven shirt worn on its own on a mild day is rolled by about a third (from the seed, no draw taken).
- Crossing guards and road workers (`people/family-life.js`): a navy work shirt with rolled sleeves under a hi-vis vest.

## 7. Holds

The hand placement and the two-bone arm solve stay in `crysis/held-items.js` (not edited). What changed on the body side:

- **Bladed carry** (`people/actions.js` `carry` and `reload`): the chest turned 0.4 rad to the gun side and leaning in, the head kept on the way they face. The support shoulder comes forward to the guard and the strong elbow hangs down by the side: on the 1.68 m police officer with the scout rifle the strong elbow went from level with the shoulder (2 cm below it) to 18 cm below it.
- **Trigger finger** (`people/motion.js` `trigger(side, k)`): with a long arm in both hands, the strong hand's index lies straight along the frame at the ready and hooks round the trigger when aiming, eased in and out.
- **NPCs aim when engaging** (`combat/ai-squads.js` `aimHold`): the gun comes up to the shoulder on the target (pitch included) while they shoot with sight of it, at the ready while moving fast or searching; the trigger finger follows. The avatar's finger follows your aim (`ui/gear.js`, one line).

## 8. Cost

Per body, measured in the preview (`island/tools/thirdperson-preview.mjs`):

| | before | after |
|---|---|---|
| cloth mesh, tee | 10,366 vertices, 14,125 triangles | 10,320 vertices, 14,085 triangles |
| cloth mesh, oversized hoodie | 11,707 / 16,834 | 11,939 / 17,038 |
| accessories, hoodie (hood and strings) | 264 triangles | about 700 |
| accessories, police (cap, carrier) | 340 | 1,468 |
| accessories, soldier (helmet, carrier, gloves) | 536 | 1,564 |
| extra vertex data | | 2 bytes a cloth vertex (about 22 KB a body) |

Draw calls and programs are unchanged (the carrier, hood and collar are in the accessory mesh; the garment program key moved to `crysis-garment-9`). Nothing new is allocated per frame. The pose folds run only near the camera: `P.lod(dist)` fades them out by 22 m (10 m on a phone or when the governor is at low or minimal), and a phone starts with them off until `lod` brings someone close; the fragment details stop once a pixel covers a centimetre. The accessory pieces take fewer segments on a phone (`lo`).

## 9. Verification

Before and after captures (headless Chromium, software GL) in the session scratchpad `thirdperson/`: civilians in a tee, an oversized hoodie, an oxford shirt and an open jacket over a tee, a worker in hi-vis, the police officer and the soldier at the ready and aiming, the gang member aiming a carbine, the avatar aiming a rifle and drawing the bow, and close-ups of sleeves, cuffs, the hood and the hands on the weapon. `node island/tools/thirdperson-browser.cjs` re-takes them (bundle the preview first; see its header). Tests: `island/tools/garment-shape.test.mjs` (sleeve profiles, waistbands, arm position, pose folds, the torso field, carrier, hood and collar geometry).

## 10. Left for later

- There is no pistol item in the game (`crysis/held-items.js` has the rifles, the carbine and the bow), so the gang members carry carbines; a sidearm hold would need the item and its grips there first.
- When the support hand cannot reach a long rifle's guard on a short body, held-items slides it back toward the magazine (up to 19 cm on the scout rifle); a fix belongs in its placement, which this work did not touch.
- The trigger finger is laid along the frame by curl only; resting it high on the receiver would need the finger's spread.
- Shoulder pinching on extreme raises is reduced by the shoulder fold term but the cage's skin weights still govern the armhole.
