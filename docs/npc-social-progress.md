# Persistent NPC work checkpoint

Updated 4 October 2026. Branch: `codex/persistent-npc-social`.
Base: `efcd210305b18262a3d301a95703eff4cd3bf982` (live planet/orbit and museum release, PR #7).

## Implemented, verification in progress

- Separate saved identities, DNA, home and last positions, conversation turns, memories and tasks from temporary crowd bodies.
- Transfer the person you meet into a bounded resident renderer, restoring their identity after streaming and reload.
- Validated conversation commands: follow, wait, home, quest companion, local scout and report, warn villagers, calm and status.
- Local warnings spread within a bounded radius and expire; nearby people visibly react. No global panic.
- Collision-aware companions and scouts, with honest blocked-route reports.
- People journal in the guide; immediate command saves and periodic movement checkpoints in browser localStorage.
- Preserve an earlier save backup and surface storage errors rather than silently dropping residents.

## Verification

Eleven state tests and six actor tests passed. Build succeeds. Full in-game browser verification is underway; this checkpoint is not a release claim.

## Remaining and boundaries

- Finish browser tests of actual dialogue, following, warnings, scout return, reload and streaming identity.
- Review and publish tested source and generated bundle through a feature PR.
- Saves currently belong to this browser. Cross-device/account saves are not implemented.
- Quest companions travel with the player; dungeon combat, inventory errands, shopping/delivery and full pathfinding remain future work.
- Warning propagation is a local social simulation, not a physically routed messenger quest.
- Broader design and preservation boundaries: `docs/npc-social-plan.md`.

## Continue safely

Read this file and the plan, inspect the branch diff and tests, then continue from the current checkpoint. Do not re-create NPC identities or replace prior content. Main is production. Build with `npm --prefix island run build`, lint changed JS, run state/actor tests and the social browser test before shipping.
