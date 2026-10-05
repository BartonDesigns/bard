# Tangible world-development rewards

This document defines the first implementation seam for BR-001. A completed,
grounded exploration quest can grant a visible world project such as a repaired
path, restored garden, opened gathering place or music-responsive landmark. The
reward is the change in the place, not a pile of gold.

## Current prototype

`island/src/guide/world-projects.js` is a deliberately small, deterministic
ledger. `projectForQuest()` accepts only a completed quest with a real
exploration target. The target is selected from the quest's validated visit,
return or scout step. The model cannot name an arbitrary effect, add a new
capability or claim that a project happened.

`createWorldProjects().complete()` writes a stable project record:

- one world/body key;
- one stable target slot, so retrying the same outcome is idempotent;
- a bounded anchor for a future renderer or physics adapter;
- `status: "complete"` and `stage: "visible"`;
- a concise label and player-facing benefit;
- explicit `scope: "private-preview"`, `shared: false` and
  `backend: "br-006-shared-backend-pending"`.

The state is kept in `crysis-world-projects-v1`, survives reload when browser
storage is available, preserves corrupt bytes instead of overwriting them, and
reports session-only operation when storage fails. Cancellation and narrative
claims do not create projects. A bounded 96-project per-world ledger keeps
storage and iteration predictable.

The focused test is:

```sh
node island/tools/world-projects.test.mjs
```

It covers target validation, four project families, reload, duplicate retry,
cancellation, world isolation, explicit non-shared scope, corrupt saves and the
bounded ledger.

## Rendering and NPC seam

The ledger is the data contract for the next integration pass. A world renderer
should consume `state(bodyKey).projects` and use the stable `targetId` and
optional `anchor` to reveal the appropriate authored/procedural change. It must
not infer a project from prose. Examples:

| Project kind | Visible/useful change | Natural NPC acknowledgement |
| --- | --- | --- |
| `path` | repaired marker, clearer footpath, or small bridge maintenance | “The route is easier to follow now.” |
| `garden` | regrown planting beds and returning small wildlife | “The garden has started feeding people again.” |
| `gathering` | usable table, notice board, shelter or local meeting point | “People have somewhere to meet here now.” |
| `resonance` | persistent reactive light or musical response at a cave/landmark | “The place answers when the music is played.” |

NPC prompt context should receive the ledger’s sanitized `label`, `targetName`
and `benefit`, not the storage record or a private conversation. A resident can
remember that a project exists without seeing another player’s transcript.

## Shared-world boundary

This prototype is not multiplayer synchronization. Two browsers do not yet
share its localStorage. Universal progress remains blocked on BR-006:
authenticated or abuse-resistant contribution writes, canonical world storage,
atomic/idempotent events, conflict rules, server-owned timestamps and tested
world-effect adapters. When that backend exists, this ledger can become a cache
and migration layer by replacing its persistence adapter while preserving
project IDs and idempotency rules.

The roughly one-day propagation idea remains a separate BR-002 design decision.
This prototype intentionally completes its local preview immediately and does
not claim a real-time clock, background worker or software deployment promise.

## Integration checklist

1. Inject one `createWorldProjects` instance into the Guide/world context.
2. On a validated story quest transition to `complete`, call `complete()` once
   with the resolved target record.
3. Apply the returned project to one real renderer/physics adapter, keeping the
   adapter deterministic and bounded.
4. Include only sanitized project summaries in NPC context and the Guide’s
   world snapshot.
5. Add a browser smoke test for completing one quest, leaving/re-entering the
   area, reloading, and seeing the same visible change.
6. Add a two-client integration test only after BR-006’s Worker and canonical
   storage are deployed and authorized.

