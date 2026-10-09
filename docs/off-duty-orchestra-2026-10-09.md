# Off-Duty Orchestra

The owner's reference is a relaxed outdoor music gathering where friends casually fire
different arms into the air while the musicians keep playing. The upward shots are the
central joke. The encounter uses original synthesized music, not the reference recording.

## Implemented

- Four adult MakeHuman performers: Misha and Lev on two folk string instruments, Sasha
  and Nikolai adding staggered sky shots. They keep sitting and playing through the noise.
- Two distinct held models per occurrence, rotating through the existing Mossback,
  Warden and Aurora. Shared model caches stay intact. Both hands use the existing IK;
  the weapons lift, flash at their real muzzle points, recoil and settle.
- Original plucked-string phrase follows the world's BPM within a relaxed range.
  Existing weapon sound cues provide the comic percussion. All audio uses the world bus.
- A woven picnic rug, stools, food board, cups, thermos and bag. Static geometry batches
  by material. The review scene fell from 239 to 107 draw calls after batching; its total
  262,792 triangles includes all four people and the review background, not the whole game.
- A nearby **Join the rhythm** button adds clapping, without taking over the camera.
- Nine percent chance per eligible walking minute, a saved 30-minute cooldown per world,
  daytime 10:00–19:00, Earth/Tropical/Terran. Siting tests a seven-metre footprint for
  slope, obstacles, roads and water, behind a shoulder 28–40 metres away. The performance
  lasts eight minutes, waiting until the player is 15 metres away before expiry cleanup.
  Leaving by 110 metres clears it immediately. No spawn during flight, diving, caves,
  indoor shelter or vehicle/game modes.
- Hiding pauses sound and interaction. World replacement, origin shifts and departure
  clear owned resources. Cancelled asset loads cannot install late actors. Bodies block
  walking; the encounter does not send damage, faction, reward or network events.

## Source and review

- `island/src/encounters/picnic-jam.js`: scheduling, siting, UI and cleanup.
- `picnic-performers.js`: real bodies, instrument grips and sky-shot animation.
- `picnic-props.js`, `picnic-audio.js`, `picnic-plan.js`: props, original sound and pure rules.
- `island/src/main.js`: world tick, hide/teardown, collision and debug hooks.
- `Crysis.picnic()` reports state. `await Crysis.picnicGo()` tries a nearby valid patch;
  `await Crysis.picnicGo({x, z})` tests a specified patch. Daytime/mode/siting gates still apply.
- `island/tools/picnic-preview-entry.mjs` renders the actual production encounter in a
  neutral clearing. Bundle it to `island/dist/picnic-preview.js` and serve the repository
  root so body textures and rigs resolve. Its camera and frame controls support exports.
- Exported review: four-second H.264/AAC clip plus PNG. Audio export uses the same music
  and weapon cue functions, scheduled to match the captured animation. The clearing's
  plain trees and ground are staging scenery, not a replacement for the game's forest.

## Verification and limits

- `npm --prefix island run build`: passed. Generated engine/index files are not included
  in this source checkpoint, following the branch handoff rule. Rebuild before running it.
- `node --test island/src/encounters/picnic-plan.test.mjs`: four tests passed for mode gates,
  full-footprint rejection, cooldown/chance and staggered firing cadence.
- `node island/tools/picnic-browser.cjs`: twelve checks passed in Chromium 153, with zero
  page/shader errors. Checks cover four adults, distinct weapons, shots and upward muzzle
  direction, rhythm interaction, audio output/pause, body collision, origin/world/distance
  teardown, repeat creation, button disposal and cancelled asynchronous loading.
  The script requires Playwright and the bundled preview. `CHROME_EXECUTABLE`,
  `PLAYWRIGHT_MODULE` and optional JSON `CHROMIUM_ARGS` can select an existing runtime.
- The weapons and musicians were inspected in the rendered frames. This is a functional
  staging candidate, not an AAA approval. Full-world siting/landscape integration,
  prolonged close-up hand/contact review and real-phone frame pacing remain to review.
  Earlier armament material/utility defects remain listed in the held-item review.

This is source work on the existing feature branch, not a new live or Worker deployment.
HANDOFF.md requires the owner to see new looks before shipping. Keep the live Moon/Deep
release separate from the branch's unfinished gear, combat and other world work.
