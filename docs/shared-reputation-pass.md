# Shared room reputation

The client and rooms Worker now support `reputation-v1`. This capability is negotiated
in the WebSocket welcome. Older servers keep the existing local NPC behavior and receive
no unsupported reports. Updating the client alone does not activate shared memory.

## Behavior

- Vehicle impacts, assaults, robberies and fires enter a room's public incident log.
  Valid shot effects also create bounded gunfire reports on the server.
- Each record's player and time come from its socket and the server clock. A sender
  cannot name someone else as the responsible player. Names, kind, coordinates and an
  opaque event ID are the public fields; conversation text and quest prose are excluded.
- Nearby NPCs distinguish personally witnessed danger from local reports. Innocent
  players hear concern about the other player's actions instead of being blamed.
- Shared facts are scoped to their world, area and height. Earth's latitude/longitude
  prevents a floating render frame in a different city from becoming the same location.
- Completed conversation quests can be reported when returning near the issuer, with
  a completion flag and procedural NPC key. Issuers recognize their player's work;
  nearby strangers can acknowledge that the player has been helping locally.
- Records survive reconnects, host changes and Durable Object reconstruction. Late
  arrivals receive small snapshot batches, which never replay old attacks as live events.
- A room stores up to 96 facts, with at most 16 from one actor. Crime memory expires
  after 10 minutes; nearby alarm about someone else lasts 90 seconds. Completed-work
  reports expire after 24 hours. Existing room expiry still removes an empty room after
  30 minutes. Leaving clears the client's shared cache.

Remote gunfire now retains the actual sender ID instead of a generic placeholder.
Vehicle and remote-incident physical alarms also reject occupants on other floors.
Small differences in packet latency cannot cause a freshly server-stamped record to be
silently dropped; future dates beyond a bounded tolerance remain rejected.

## Authority and limits

This remains an account-free, client-simulated game. The server checks message shape,
proximity, world, driving state, deduplication and rate limits. It does not independently
simulate ambient NPC collisions or verify a player's whole quest route. Reports never
grant currency or inventory. Actual quest evidence and idempotent reward receipts remain
with the existing quest/inventory systems. A modified client can lie about its own actions,
but cannot use this message to accuse a different socket or pay itself a reward.

The room log is shared reputation and completion recognition, not a globally persistent
NPC brain or synchronized ambient population. A procedural NPC key recognizes a matching
seed nearby. It does not synchronize different clients' crowd casting, conversations,
NPC schedules or personal saved residents across rooms.

## Verification

- Existing room checks, plus focused reputation checks covering attribution, privacy,
  geographical rebasing, floor limits, flood bounds, duplicate expiry, device clock skew,
  legacy fallback, quest recognition and Durable Object reconstruction.
- Real production Worker in workerd with three socket clients: trade/PvP regressions,
  remote driving incident, innocent-player response, late join, reconnect, host promotion
  and completion attribution.
- Production game in Chromium touch emulation with a local Worker and a remote socket:
  actual earned quest credits, shared completion, remote crime dialogue, no false blame,
  fear blocking new work, room leave cleanup and quest/wallet reload persistence.
- Worker bundle dry run. Physical iPhone/Safari and production multi-client validation
  still require the server deployment and device access.

## Deployment

No Cloudflare credential is configured in the build workspace. The GitHub Pages client
can be published independently; shared reputation remains inactive until the owner
deploys the updated `l99-rooms` Worker. Run from anywhere inside the local Bard checkout:

```sh
cd "$(git rev-parse --show-toplevel)"
git pull --ff-only
npm --prefix server/multiplayer ci
npm --prefix server/multiplayer run deploy
node server/verify-workers.mjs
```

The live rooms `/status.features` must include `reputation-v1`. The discovery Worker does
not need deployment. The root rooms URL returning `not found` remains expected.
