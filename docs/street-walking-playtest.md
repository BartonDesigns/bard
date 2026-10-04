# Street-walking gameplay review

Owner request: deploy exploration agents, report improvements, restore rich seamless procedural caves. Review date: 4 October 2026 Pacific.

## Method and limits

One automated browser explorer plus source inspection, not human interviews or a simulated panel passed off as players. Chromium, SwiftShader, 960×640, local production bundle, seed 1337 tropical island, offline built-in dialogue. Test placement deliberately moves to the village; it does not assess normal spawn framing. Production player movement/collision runs for 600 fixed 1/60-second updates. The journal uses the real runtime API. The attempted NPC interaction was inconclusive: after walking, the active crowd pool contained no eligible adult, so no NPC dialogue was exercised. This is not classified as a game defect. This is functional inspection, not native-device frame-rate measurement, live cloud language evaluation, or a completed cave traversal. Screenshots and raw report are in `docs/verification/street-walking/`.

## Observed functional result

The production controller moved 51.57 metres over ten simulated seconds without a page error. After that route the visible scene remained the same surface world, with buildings and vegetation. Four sea-cave tunnels were registered in the current tropical world. This baseline does not verify the new cave migration being developed concurrently.

## Findings and prioritized improvements

| Priority | Evidence | Suggested change | Acceptance |
|---|---|---|---|
| P0 | Guide snapshot includes 13 exploration goals; opening Quests with no story shows only “Ask someone nearby for an adventure.” The legacy exploration goals are absent from that view. | Put exploration and accepted NPC objectives in one readable journal with one selected objective. | A new player can select a real cave entrance from the journal, see where to go, and understand what completes it. |
| P0 | Current guide source discovers caves only from `W.caverns.tunnels`; cave completion checks proximity and negative world Y. Current tropical runtime exposes four sea tunnels. | Register all new planet cave mouths as real locations and validate cave progress by cave/chamber identity rather than a universal below-zero test. | Inland caves above sea level and planetary caves can be found, discussed, visited and completed without false completion at the surface. |
| P1 | Built-in story objective types are visit, return, talk and scout. Validator correctly rejects invented rewards and unsupported actions. | Add one measured musical cave task with an actual persistent world effect: restore a resonant passage, grow light-bearing flora, or repair a safe crossing. | Instrument input changes rendered/collidable world state; reload preserves it; NPC acknowledgement follows the actual event. Shared propagation remains dependent on the authoritative backend. |
| P1 | Snapshot offers name, distance and compass direction for sea caves; visible street view does not communicate a cave route. This screenshot is a deliberately chosen location, not proof that no signs exist anywhere. | Add optional entrance pin, terrain-following route hints, and a spatial musical motif increasing near the mouth. | A player can walk from settlement to entrance without flight, teleportation, or keeping dialogue open. Cues can be dismissed. |
| P1 | Companions have bounded walk/scout actions; dungeon support needs actual tunnel navigation and floor clearance, not merely dialogue promises. | Introduce “lead me there,” “wait by the entrance,” and “come back if blocked,” backed by a reachable path. | A companion traverses the same portal/corridor as the player and reports obstruction honestly; no surface-to-underground teleport. |
| P2 | The journal empty state and model setting are visible, but the empty state does not distinguish authored exploration from model-generated stories. | Make the available next action explicit for offline play; retain a small authored local adventure when the model is unavailable. | Offline users can start a grounded quest with a visible outcome and no dependency on cloud setup. |

## Cave gameplay slice to prioritize

The strongest next slice is settlement → audible landmark → walkable mouth → short branching cave → musical environmental change → return to the same resident. Preserve active controls, camera, instrument notes, companion identity and saved quest state through the entire loop. Use distinct cave flora/materials/acoustics by planet. Make the first cave readable before expanding branching depth; a large network without entrances, return cues and meaningful interactions will not solve the current discovery problem.

The suggested reward is a concrete development, not gold: a safely lit passage usable on the next visit. Do not advertise it as globally shared until two independent clients see the same authoritative state.
