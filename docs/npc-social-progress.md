# Persistent NPC implementation and verification

Updated 4 October 2026 UTC. Branch: `codex/persistent-npc-social`, PR #8.
Base: `efcd210305b18262a3d301a95703eff4cd3bf982` (planet/orbit and museum release, PR #7).
Durable checkpoints: `39bbb13` (plan/status), `a49b5eb` (resident source and tests).

## Implemented

- Separate saved identities, DNA, home and last positions, conversation turns, memories and tasks from temporary crowd bodies.
- Transfer the person you meet into a bounded resident renderer, restoring saved appearance and position after streaming and reload.
- Validated conversation commands: follow, wait, home, quest companion, local scout and report, warn villagers, calm and status. Commands work offline.
- Local warnings spread within 120 metres and expire; nearby people visibly react. No global panic.
- Collision-aware companions and scouts. Generic nearby scouting selects a clear local route; obstructed named routes produce an honest blocked report.
- People journal in the guide; immediate command saves, movement checkpoints every two seconds, and pagehide flush in browser localStorage.
- Preserve a previous save backup and surface storage errors rather than silently dropping residents. Earth rebasing preserves the latest movement before flush.
- Existing location resume, world discovery and quest saves remain in place. The new store adds NPC progress rather than replacing those saves.

## Verified

Twenty-four Node tests pass: eleven state, seven actor and six controller tests. Changed JS passes unused-variable lint and the production bundle builds.

The actual faceplate browser test uses a 480×320 touch profile with real procedural village NPCs, meshes, movement and terrain. It verifies:

- Talking promotes the exact existing crowd body and removes it from crowd recycling.
- A guide-issued follow command moves the NPC 9.64 metres; wait stops further movement.
- Warning moves a nearby control villager 1.04 metres and leaves the distant control unmoved; all clear ends the reaction.
- A named scouting destination blocked by terrain produces a blocked report, never a false completion.
- Generic nearby scouting travels 10.46 metres, reaches within 1.56 metres of the endpoint and returns within 1.76 metres of home before reporting completion.
- A real page reload preserves the same identity, DNA, home, chat history, mode and completed task.
- Streaming out releases all six owned geometries; returning creates a new body with the same saved identity and DNA.
- Meeting five additional people respects the phone cap of four rendered residents. Reset leaves zero resident bodies while retaining six saved records.
- Zero page/console errors, zero failed shader programs and no lost WebGL context.

Evidence: `docs/verification/npc/report.json`, `resident.png`, `remembered-people.png`.
Reproduction: `island/tools/social-browser.cjs`; run a local server and browser in the same command environment with Playwright Chromium. Software rendering verifies function and resource disposal, not native-phone frame rate.

## Remaining boundaries

- Saves belong to this browser. Cross-device/account saves are not implemented.
- Quest companions travel with the player and use the player floor/collision model. Dungeon combat, authored dungeon escort integration, inventory errands, shopping/delivery and full pathfinding remain future work.
- Warning propagation is a bounded local social simulation, not a physically routed messenger quest.
- Companions remain grounded on their current world; automatic cross-world transport is not implemented.
- Named medieval-cast adapters, relationship/reputation systems, musical bonds/song requests and legacy social-save migration remain tracked in `docs/npc-social-plan.md`. Existing authored systems and saves are preserved.

## Continue safely

Read this file and the plan, inspect PR #8 and current main, and continue from the latest checkpoint. Do not re-create saved NPC identities or replace prior content. Main is production. Build with `npm --prefix island run build`, lint changed JS, run state/actor/controller tests and the social browser test before shipping. Keep implementation checkpoints in Git, not only in chat context.
