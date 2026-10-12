# World continuation from 9d3f040

Branch: `claude/affectionate-heisenberg-3g4qv1`.
Status: source fixes and regenerated client bundle on the feature branch. Not deployed to
`main`; no Cloudflare Worker was deployed. Existing branch WIP remains intact.

## Moon crew

The crew previously advanced through the motion rig without applying the colony collision
functions. The rig now has an optional constraint callback, applied after horizontal motion
and before the foot placement calculation. Only the lunar crew uses the new callback.
`crew-space.js` applies the existing room/wall constraints, separates nearby bodies on the
same deck, allows extra space for EVA suits, and reapplies room constraints after separation.
Constraints do not move someone on another deck. Roster destinations inside a furniture
margin move to its clear edge so the actor can reach the waypoint.

The colony's previous reflection environment derives from its black sky. A second shared
environment represents the lit room ceiling, walls and floor for indoor skin and clothing.
It switches with the crew member's actual location and leaves skin colour, facial structure
and hair unchanged. This is an unreviewed lighting candidate, not a claim that the appearance
is approved. `Crysis.world().colony.lightFix(false/true)` remains available for comparison.

Pending asynchronous body creation exits after disposal; it cannot append a new body after
the world has been destroyed. The interior reflection target is released with the colony.

Files: `island/src/people/motion.js`, `island/src/planet/colony/crew-space.js`,
`crew-life.js`, `colony.js`, and `island/tools/colony-space.test.mjs`.

## Deep Gate

The hall relocation existed at the starting checkpoint, but its floor was still solid along
the rope. `planDeep` now adds a closed subterranean shaft to the cave field before meshing.
It has its own upper cap and does not add a surface opening or reuse the daylight shaft.
The seal supplies a walking floor at the hall's original elevation. The open rim retains its
collision guard, and explicit rope interaction owns the continuous descent.

The upper cave draws the mouth; the narrower Deep lining stops below the hall instead of
protruding into it. Down/up travel rejects unavailable states, clears swimming/diving on
entry, aligns the camera at the landing, and releases movement on arrival or disposal. The
dark background disappears immediately when leaving. Gate phrases and delayed waystone
returns are cancelled when the world is disposed, preventing an old return callback from
moving the player later. The existing `crysis-deep-v1` keys are preserved.

Files: `island/src/planet/cavenet.js`, `deep.js`, the `underFloor` hook in `main.js`,
and `island/tools/deep-gate.test.mjs`.

## Automated verification

Passed on Node 24:

```bash
npm --prefix island run build
node --test island/tools/colony-crew.test.mjs island/tools/colony-space.test.mjs island/tools/deep-gate.test.mjs island/tools/cave-streaming.test.mjs island/tools/cave-elements.test.mjs island/tools/social-actors.test.mjs island/tools/trade.test.mjs island/tools/combat.test.mjs island/tools/families.test.mjs
npm --prefix server/multiplayer test
git diff --check
```

The Node runner reports 53 test entries passed. The trade entry separately reports 70
checks passed. The rooms runner reports 92 checks passed. Changed JavaScript source also
passes `node --check`. The Deep tests use real Three.js geometry and the real cave/Deep
runtime with minimal DOM stubs; they do not render pixels or compile GPU shaders.

Coverage added:

- Underground hall and rope clearance in 12 island/planet fixtures: TROPICAL, TERRAN, ICE
  and MAGMA, each at seeds 1337, 4242 and 42. Existing surface openings remain unchanged.
- Closed seal floor, continuous descent and ascent, unlock and camera alignment, saved gate
  reload, pending return cancellation, and immediate dark-background removal.
- Crew collision with walls and furniture, passage through module doorways, separation from
  overlapping peers, EVA clearance and independence between different decks.

The existing cave-elements test needed browser audio globals before its dynamic import,
because the checkpoint's resonance module imports the shared sound bus. Its original
persistence, corrupt-save, mobile/desktop and disposal assertions remain intact.

## Required rendered review

Chromium is absent in this container. Playwright's download endpoint returned an HTML
“Site Unavailable” response, so no screenshots or GPU smoke result were produced. ESLint
is absent from the environment and npm cache; no lint pass is claimed. Do not ship to main
until the handoff's rendering, lint and owner-review gates are completed.

On a machine with the normal browser/test dependencies:

1. Serve the repository and open `island/dev.html?planet=MOON&seed=4242&safe&offline`.
   Review Samuel and the other crew in the med bay, mess and lounge, with the comparison
   light switch above. Check skin detail and highlights indoors and through an airlock.
2. Walk the scheduled crew routes through doors and around furniture; look for stuck
   waypoints, crowded goals, foot sliding and clipping with eight desktop/four phone bodies.
   Numeric collision tests do not prove every generated route completes.
3. Open the Earth island and a TERRAN or MAGMA world. `Crysis.deepGo('gate')` positions the
   player in the new hall. Complete the audible phrase using E/touch, then descend with the
   rope prompt. Inspect the open rim, shaft join, descent, landing and return. Verify actual
   input on a phone-sized viewport as well as desktop.
4. Follow the gallery across depth bands, touch a waystone, reload and revisit. The guide and
   waystone prompts should lead to the underground hall. Run the standard faceplate, Earth,
   planet and sampler-budget smoke before assembling any selective release.

Weapons appearance, end-to-end combat, architecture rendering, vehicles and family visual
review remain the subsequent handoff work. The automated rules checks here do not establish
their release readiness or verify a deployed multiplayer server.
