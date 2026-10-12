# Field contracts, enemy roles and pickup feedback

This pass adds a playable progression loop to weapon recovery. It is a bounded local encounter system, not a claim that the entire game has reached AAA quality.

## How to play

On foot in open Terran/island, arid, or Earth countryside, select **Field contracts** at the upper left, read the brief, and select **Accept contract**. Find a fairly level clearing if placement cannot find safe open ground. Follow the objective's bearing and distance to the cache. Recover its weapon using E / Shift+E or the touch buttons, then return to the green rally marker for payment.

| Contract | Objective progression | Cache | Payment |
| --- | --- | --- | --- |
| First light | Locate an abandoned cache, collect the kit, return | Common Aurora, level 2, ammunition | 120 credits + repair roll |
| Broken supply line | Locate cache, clear flanker and marksman, recover, return | Fine Warden, level 4, ammunition | 240 credits + repair roll |
| The last relay | Locate cache, clear two role-based waves, recover, return | Superior Mossback, level 6, ammunition | 420 credits + repair roll |

Later relay contracts scale to level 8 and Masterwork caches after five completions. Credit scaling caps at 720. Legendary equipment remains in the existing boss/combine paths. Surrender, restraint or flight from combat counts as clearing an opponent; execution is never required. A warning delay separates incoming waves. Ambient random fights pause during an active contract; wanted-level responses retain their existing rules.

Completed-contract count and cache recovery persist. Abandoning/reloading after taking a cache does not grant another kit: reaccepting that step permits finishing its return objective. Stable inventory transaction IDs also prevent repeat kit/payment transactions. Failed reward transactions leave the return objective active for retry. Leaving the world, getting knocked out, abandoning, or moving more than 220 metres from the site cancels the encounter. Collected gear remains owned. Incomplete stage/location is not resumed across world travel or reload; the same progression step can be accepted again.

## Enemy roles

- Flankers carry Wardens, move faster, and seek a close lateral approach with short bursts and light armour.
- Marksmen carry Mossbacks, seek 32–42 metre standoff, and fire slower, more accurate single shots.
- Suppressors carry Auroras, seek 21–28 metre positions, and trade movement speed for armour and sustained bursts.

Roles change actual movement, range, firing cadence, accuracy, health and armour. Pooled NPC bodies reset their kit per spawn, and dropped gear matches their visible weapon and quality. Role names appear in incoming-wave calls and target metadata. This pass does not add new bespoke character meshes, recorded dialogue or new navigation/pathfinding.

## Presentation and resource ownership

Caches have bevelled metal shells, recessed padding, ribbed trays, inner straps, rank marks, round handles/hinges and a printed inner-lid panel. The lid opens after unlocking; its light changes from amber to green. The existing high-detail weapon rests in the tray. World models lift toward the player over 0.48 seconds on pickup. First-person support hands release, reach and return to the grip; firing/reloading is suppressed during this action. Existing equip motion raises the selected weapon. Third person uses the world pickup motion, without a new full-body grab animation.

Distinct short layered cues accompany pickup, latch opening, acceptance, incoming waves and completion. Filtered noise supplies handling transients and quiet pitched layers supply UI/radio confirmation. All use the shared world volume/mute bus, bounded voices and explicit cleanup. These are synthesized cues, not a full recorded Foley or voice-over pass.

One contract/cache is active at a time. Actor counts retain existing phone/desktop limits. Partial spawns cancel rather than silently awarding victory; async spawn completions respect cancellation. Mission cache drops are protected from ordinary loot eviction/expiry. Cache meshes, textures, markers and pickup effects clean up on cancellation/travel.

## Verification

- `node --test island/tools/field-contracts.test.mjs island/tools/loot.test.mjs island/tools/combat.test.mjs island/tools/bow-controls.test.mjs island/tools/arms.test.mjs`: 43 passing test entries, including stage gates, role budgets, stable rewards/cache IDs, cache retention, weapon tiers, save/load, duplicate inputs and bow/combat regressions.
- `contracts-browser.cjs` with bundled `loot-preview.mjs`: all three contracts on desktop and touch, production AI/squad deaths, surrender completion, waves, locked/unlocked cache, pickup motion, payment, persistence, and abandon/reload/reaccept without duplicate cache gear. Shader/GL/page checks accompany render evidence.
- `loot-browser.cjs`: existing desktop and touch fallen-fighter acquisition checks pass with the new pickup path.
- `armament-art-browser.cjs` with `ARMAMENT_PICKUP=1`: all four armaments on desktop and phone, real MakeHuman hand targets, visible support-hand movement, blocked fire/reload, restored grips after motion and no shader/page errors.
- Production build and whitespace checks. Evidence in `docs/verification/field-contracts/`.

Tests use controlled flat terrain, production code and Chromium software rendering. Physical iPhone performance, broad terrain placement/navigation playtests, combat/economy balance, recorded audio polish, bespoke enemy silhouettes and authoritative multiplayer objectives remain follow-up work. The local contract system does not require or upgrade the outstanding rooms Worker deployment.
