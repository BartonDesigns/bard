# Bow visual and grip pass

The Reedline bow now has a shared animated rig for the first-person view, third-person body, and projectile arrow. The support hand stays on the riser. The drawing hand follows the nock, then stays near the cheek briefly when the string releases. Both flexible limbs bend independently, and both string segments terminate at their actual limb tips and the moving nock.

`island/src/crysis/bow-visual.js` owns this geometry and the `createBowArrow(material, low)` mesh factory. The merged arrow includes a shaft, nock collar, three vanes, and tip. It uses the same lit material as the held kit. The draw is 0.28 metres, chosen to fit the existing short, medium and tall character skeletons. The arrow is 0.745 metres long and points along local +X, with its origin at the nock.

The bow stays beside the face in aimed third-person poses. Reach fitting preserves that lateral lane, adjusting forward and vertical placement instead of pulling the shaft through the face. First-person forearms use separate carry and aim elbow targets so the drawing arm exits the right side of the view.

The view and body both accept `bow({ draw, loaded, nock })`, where draw and nock are normalized. `fire()` starts release follow-through, and `cancel()` lets the string down while also cancelling any visual reload. The shot origin comes from the actual visible arrow tip. `info().bow` exposes contact and alignment measurements for review tools.

Validation: `node --test island/tools/bow-visual.test.mjs` covers desktop and phone geometry, ready/quarter/half/full draw, endpoint alignment, release follow-through, replacement nocking and cancellation. Body-fit and visual evidence are recorded by the armament review gate; numerical contact checks alone do not establish the final art quality.
