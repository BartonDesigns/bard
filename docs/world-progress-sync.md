# Shared world progress seam

Status: client contract and offline outbox implemented; authoritative Worker endpoint is not implemented or deployed. This is the BR-006 foundation, not a claim that browser storage or the current discovery Worker provides multiplayer state.

## What is shared

The seam carries only small, game-defined world-development events. Each event has:

- `worldId`: the canonical planet/world identity;
- `projectId`: the persistent development project, such as a named resonant passage;
- `eventId`: the client idempotency key;
- `actorId`: a stable player identity supplied by the account/session layer;
- `clientSequence`: the actor's monotonic local sequence;
- `kind`: `contribution`, `stage` or `effect`;
- a bounded, structured `payload` such as a site, stage, amount or effect ID.

The client never treats an event as shared until the provider returns `serverVersion` and `serverAt`. A server must apply the event atomically, deduplicate `eventId`, reject stale cursor writes, and return a cursor that the client can use for reconnect/catch-up. World effects must be applied by a versioned game adapter, not by arbitrary client JSON.

## What stays private

NPC dialogue, conversation IDs, transcripts, memories, prompts, mature settings and personal journals are deliberately rejected from public payloads. The existing per-NPC archive and social/quest saves remain browser-local until a separately designed private account sync exists. A shared quest outcome can credit a contribution without publishing the conversation that led to it.

## Client API

`island/src/persistence/world-progress.js` provides:

- `createWorldProgressClient({ worldId, actorId, provider, storage })`: private outbox, cursor, idempotency, validation and server-event subscription;
- `createOfflineWorldProgressProvider()`: explicit offline mode. It queues work but never claims it reached another player;
- `createWorldProgressHttpProvider({ baseURL, headers })`: an opt-in adapter for a future `/v1/world-progress/events` contract. It does not read credentials or assume the currently deployed discovery Worker supports this route;
- `validateWorldProgressEvent(...)`: testable client/server-event validation.

The local cache key is `crysis-world-progress-v1`. It contains only public outbox records, the last authoritative cursor, acknowledged event cache and rejection metadata. It is not a universal save and should not be used as the source of truth for a world effect.

## Proposed Worker contract

The future authoritative service can expose:

```text
POST /v1/world-progress/events
{ schema: 1, worldId, cursor, events: [public client events] }
→ { schema: 1, worldId, cursor, accepted: [server events], events: [], rejected: [{eventId, code}] }

GET /v1/world-progress/events?worldId=...&after=...
→ { schema: 1, worldId, cursor, accepted: [], events: [server events], rejected: [] }
```

The current `l99-discovery` Worker serves place briefs, `/talk` and planner capability. It does not implement these routes. Do not point the client at it and infer that a `200` from `/status` proves shared world progress. A future deployment needs authenticated or abuse-resistant actor identity, Durable Object or equivalent canonical world storage, rate/size limits, idempotent event handling, snapshot/catch-up policy, migration/version rules and a release smoke with two independent clients.

## Verification

`node island/tools/world-progress.test.mjs` covers private-field rejection, offline persistence without a multiplayer claim, idempotent acknowledgements, reconnect cursor/catch-up, and the opt-in HTTP boundary. It does not establish a deployed backend or two-browser shared-world result. Those remain BR-006 acceptance work.
