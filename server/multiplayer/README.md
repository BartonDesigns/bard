## Persistent reputation update

`SOULS` stores personal reputation separately from expiring rooms. Deploy this Worker after the persistent-reputation change is merged; retain both migrations in `wrangler.toml`. `/status.features` must include `persistent-reputation-v1`. The discovery Worker is separate and needs no deployment for this feature. See [the design, recovery instructions, cave ritual and verification limits](../../docs/persistent-reputation.md).

# The rooms server (multiplayer, Cloudflare free plan)

## Shared reputation update

The new client uses `reputation-v1` to share public crime reports and completed-work
recognition. Deploy this Worker to activate it; the Pages client safely retains local
behavior on an older server. Run from anywhere inside the Bard checkout:

```sh
cd "$(git rev-parse --show-toplevel)"
git pull --ff-only
npm --prefix server/multiplayer ci
npm --prefix server/multiplayer run deploy
node server/verify-workers.mjs
```

`/status.features` must include `reputation-v1`. No discovery redeploy is needed.
See `../../docs/shared-reputation-pass.md` for bounds, authority and checks. Only public
event kinds, location, player identity and an opaque NPC/completion key are shared;
dialogue, quest prose and wallet contents remain private. The room stores up to 96 facts,
16 per actor, and restores them on reconnect. This is not a globally persistent economy.

`npm run test:integration` runs the production Worker in workerd through Miniflare,
including real WebSocket clients. `node test/conversation.test.mjs` also needs Playwright
and Chromium and exercises the actual game dialogue against that Worker.

`server/multiplayer` is a second small Cloudflare Worker, `l99-rooms`. It lets friends play
together. The host taps **Invite friends** and gets a six-letter room code and a link
(`https://level99bard.com/?room=CODE`). Friends who open the link land where the host is, and
everyone sees everyone else walk, run, fly, swim and drive. The host's time of day and weather
apply to everyone. The meetings and gatherings the host arranges with townsfolk show up for
guests too, read only, with a pin, and a gathering's crowd turns up for everyone.

It runs entirely on Cloudflare's **Workers Free** plan: one Worker and one SQLite-backed Durable
Object class, using WebSockets. You don't need a card on file. It is separate from the discovery
server, so deploying one never touches the other.

The game works without it. While `island/src/net/config.js` has no address, there is no Invite
or Join, nothing connects, and a `?room=` link just opens the game as usual.

## How it works

| Route | What |
|---|---|
| `GET /status` | `{ ok, version, maxPlayers, features }`. |
| `POST /rooms` | `{ id }` → `{ code }`: a new room, owned by that player. |
| `GET /rooms/:code/ws?id=&name=&seed=` | Joins the room by WebSocket. |

- **Rooms:** each room is one Durable Object (`src/room.js`). It holds:
  - who is in the room;
  - the host;
  - the host's world (hour, clock speed, weather, game clock);
  - up to 30 of the host's meetings and gatherings.

  It passes each player's pose (position, facing, walk/run/idle/fly/drive/swim, vehicle,
  world) to the others, and every few seconds their spot, for **Go to**.
- **Hibernation:** players who stand still only send a `ping` every 10 s. The runtime answers
  those without waking the room, so a quiet room costs almost nothing.
- **Players:** there are no accounts. A player is an id their browser made up (kept in
  `localStorage`), a name they chose, and the seed of their body, so friends see the same
  MakeHuman body they see as themselves.
- **The host:** whoever made the room. If the host leaves, the player who has been there
  longest takes over. When the room's owner comes back, they get the host's seat back. The host
  can end the room (**End room**), which closes it for everyone.
- **Leaving and returning:**
  - A player who is silent for 30 s (no message and no ping) is dropped.
  - If the line drops, the game reconnects by itself, waiting 1 s, 2 s, 4 s … up to 30 s.
  - An empty room is kept for 30 minutes so people can reconnect, then forgotten.
- **Limits:**
  - 8 players a room;
  - 3 KB a message (a full trade offer of 12 levelled items a side fits);
  - 20 messages a second per player, with bursts up to 40 (a flood closes that socket);
  - 20 new rooms an hour from one address.
- **Trades:** a `trade` message names one player (`to`); only that player gets it, with who it
  is from. The sender hears back `trade-ack` (whether that player was here), which is how the
  game tells an up-to-date server from an old one.
- **Privacy:** what you say to townsfolk is never sent. The server cleans every message
  (`island/src/net/protocol.js`, shared by the game and the server), and only these fields can
  pass:
  - poses, including the visible held item and its level and tier;
  - spots;
  - the hour and weather;
  - the plain facts of a meeting: the resident's name, the place, the time, and a gathering's
    kind, size and seed;
  - direct trade offers and protocol acknowledgements;
  - room PvP rules, bounded hit reports, shot effects and host-announced boss states.

  Room making is limited by a salted hash of the address, kept in memory only.
- **Origins:** only the game's own site may make or join rooms (`ALLOWED_ORIGINS`). Localhost
  is also allowed, for development.

### Staying free

The Workers Free plan allows, per day:
- 100,000 Worker requests;
- 100,000 Durable Object requests, where 20 incoming WebSocket messages count as one;
- 13,000 GB-s of Durable Object time.

A player sends about ten poses a second while moving, and almost nothing while still. Two
players walking the whole time come to about one request a second, which is about 3,600 an
hour. A room is awake while anyone in it moves, which is about 450 GB-s an hour. Together that
is roughly **25 room-hours of active play a day**, with more when people stand still.

If a day's allowance runs out, Cloudflare refuses new connections until 00:00 UTC. The game
keeps working alone, and the chip says it is reconnecting. Nothing is ever billed.

## Gear and combat feature release

The game can now trade gear between two friends in a room. The rooms server passes each trade
message to the one friend it is for (`trade` in `src/room.js`), checks its size and fields, and
counts it in the same rate limit as everything else. Inventories stay in each player's browser.

Gear has levels (1 to 10) and quality tiers (Common to Legendary), and every item is its own
instance with an id, so a trade names exactly which items change hands, with their level and
tier. The pose can carry the held item's level and tier too (`hl`, `ht`), so friends see its
glow. A message may now be up to 3 KB, so a full offer of 12 items a side fits.

A server without `trade-v2` in `/status.features` quietly drops trade messages. The game notices
(no answer within 4 seconds) and says **"Trading needs the rooms server update."** Everything
else keeps working.

To update the live server, open Terminal and run these one at a time, from the repository's
root folder:

```
cd server/multiplayer
```
```
npm install
```
```
npm test
```
(it should end `105 passed, 0 failed`)
```
npx wrangler deploy
```

If Wrangler asks you to log in, run `npx wrangler login`, then `npx wrangler deploy` again.
Nothing in the game needs to change: the address stays the same. Rooms open during the deploy
reconnect by themselves.

To check: open `https://l99-rooms.joshbarton1921.workers.dev/status` (it shows `{"ok":true,...}`),
then in two windows join one room, open 🎒 **Gear**, and tap **Trade** next to your friend.

## Combat validation

The host chooses the room's PvP rule, which defaults off. The server enforces it before
forwarding player hits. It checks the same world, the declared held game item, range,
damage type, valid player body parts and a per-player firing-rate damage allowance. Player
reports normalize to the recipient's own `me` target. Shared boss hits are sent only to the
host after the host has announced that boss; guests cannot publish boss state or change
room rules. Shot effects stay on the sender's world and begin near its last pose.

The client applies the shared minor/surrender/restraint protection gate before local or
network damage. Server checks bound the existing account-free game protocol; inventories,
item ownership, personal morality and ambient NPC simulation remain local browser state.
This is not an account-backed inventory or a fully server-simulated world.

After deployment, `/status.features` must contain `trade-v2`, `combat-v1` and
`combat-guard-v1`. The URL does not change. Use the two-client check below before publishing
the matching client build.

From the repository root, `node server/verify-workers.mjs` checks both production Workers
and prints any missing capabilities. It exits nonzero if either service needs an update or
cannot be verified. It only reads `/status`; it does not deploy or use model inference.

## Setting it up

You already have a Cloudflare account and Wrangler from the discovery server (see
`server/README.md` if not).

1. **Install** (from the repository's root):
   ```
   cd server/multiplayer
   npm install
   npx wrangler login        # only if this computer is not logged in yet
   ```
2. **Optional: set the salt** used to hash addresses for the room-making limit. Use any long
   random string; it can be the same as the discovery server's:
   ```
   openssl rand -hex 32
   npx wrangler secret put IP_SALT
   ```
   (Without it the limit still works, with a fixed salt.)
3. **Check, then deploy:**
   ```
   npm test          # offline checks: should end "105 passed, 0 failed"
   npm run check     # a dry run of the deploy
   npm run deploy
   ```
   Wrangler prints the Worker's address, for example
   `https://l99-rooms.<your-subdomain>.workers.dev`.
4. **Point the game at it.** Put the address in `island/src/net/config.js`:
   ```js
   export const ROOMS_URL = 'https://l99-rooms.<your-subdomain>.workers.dev';
   ```
   Then rebuild (`cd island && npm run build`), commit `island/dist/island.js` and
   `index.html`, and ship as usual.
5. **Try it:**
   - Open `<address>/status` in a browser. You should see `{"ok":true,...}`.
   - In the game, open the places menu (the 📍 button). **👥 Invite friends** is at the top.
     Send the link to a friend, or open it in a second browser or a private window.
   - The room chip (top left) shows the code and how many are here. Tap it for the player list:
     **Follow**, **Go to**, **Copy link**, **Leave** / **End room**. Tapping a friend in the
     world offers the same.
   - Phones work too.

## Trying it on this computer

```
cd server/multiplayer && npm run dev                 # the rooms server on http://localhost:8790
cd ../.. && python3 -m http.server 8781              # the game
```

Then open `http://localhost:8781/island/dev.html?rooms=http://localhost:8790` and, in a second
window, the link that **Invite friends** gives. The `?rooms=` override works only on a page
served from localhost.

## Tests

- `npm test` here: rooms, presence, the host's world and events, host promotion, the limits,
  stale players and the Worker's routes. Runs in Node with stand-ins, offline.
- `node island/tools/trade.test.mjs`: trading, two inventories over a wire that drops and
  repeats messages (nothing is lost or made twice).
- `node island/tools/multiplayer.test.mjs`: the client's follow steering, interpolation, and
  reconnect with backoff.

### Real two-client integration

`npm run test:integration` boots the actual bundled Worker in Wrangler's local Durable
Object runtime and connects two real game RoomClients over WebSockets. Eleven checks cover
joining, held gear, item/credit exchange, repeated commits, PvP on/off with health damage,
world isolation, host-only rules, shared boss routing and host promotion. It creates a
temporary local store and removes it after the test; it never touches the live Worker.

The 9 October 2026 container run passed using a loopback-only OS interface discovery shim
because the container does not expose `os.networkInterfaces()`. No game, network message,
Durable Object or WebSocket behavior was substituted. `npm run check` also passed the
production Worker dry-run bundle.

## Shared citizen activity (14 October 2026)

The `LivingRegion` Durable Object adds a separate, persistent namespace per universe body
and region. It is independent of multiplayer room lifetime. Its appended migration is
`v3-living-regions`; deploying the frontend alone does not enable it. `/status` and room
welcomes advertise `living-world-v1` only when the `LIVING` binding is present.

The browser uses the same private Soul bearer capability as `/souls/me` and an allowed
Origin for `GET` / `POST /living/:encodedWorld/:encodedRegion`. The Worker derives a
different public traveller ID for each region; the capability and underlying Soul ID are
never published. A capability authenticates possession, not a verified human account or
proof of physical location. Citizens, places, hazards and requests are client observations,
not an authoritative worldwide geography database.

POST accepts `{id, op, ...}` with a stable operation ID. Supported operations are:

- `register`: up to 16 `actors`, 16 `requests`, and an optional observed `situation`.
- `reserve`, `join`, `release`: a `requestId`, with the player identity supplied by the Worker.
- `influence`: a `requestId`, registered `choiceId`, and optional public proposal `reason`.
- `report-source`: a `requestId`, exact registered `source`, stable `evidenceId`, and
  `outcome` (`completed` or `failed`), plus `actorId` for an NPC result.

Identity, elapsed time, rewards and money cannot be set by the caller. An influence action
records the citizen's response to a proposal. Registered scheduling choices may prioritize,
defer or resume work with consent; they do not purchase consent or enact construction.
Generic `confirm` and `observe-start` are intentionally unavailable over this HTTP interface.
Private conversations must not be sent as public proposal reasons.

Source reports are accepted only from the original registration observer, or an owning or
participating player reporting their own outcome. NPC IDs must match the assigned citizen.
An original observer may align an unassigned request with an actual source actor only if
the actor is registered and eligible, no player has claimed/joined it, and current observed
conditions allow it. Different assignments and disasters cannot be overridden by a report.
Every source result is labelled `provenance: 'client-observed'` in both state and public audit;
it is not independent server verification of geometry or possessions. The endpoint transfers
no items, money or quest rewards and mutates no physical world geometry. LLM narration is
never a source receipt. Exact operation retries are idempotent; reused evidence cannot
settle a second request.

The response contains `{feature, world, region, you, revision, now, view, events, receipt?}`.
GET also supplies `history: {events, before, total}` with newest entries first; pass
`?before=<sequence>&limit=50` to read older entries. Durable activity records and operation
receipts survive reconstruction even when the bounded in-memory view drops older events.
A repeated operation ID returns its original receipt; changing its payload returns 409.
All commands in an observation batch are validated before a transaction writes anything.

Alarms advance registered work in five-minute steps while actionable requests exist.
Without open work the object sleeps; returning visitors update routines lazily. Catch-up
is bounded to 24 hours and records skipped unobserved time instead of inventing history.
Player reservations do not expire when the player leaves. NPCs may report abstract work
but physical work stops at `awaiting-confirmation`; they cannot silently finish a player's
quest. Only `conversation`, `checkin` and `observation` requests with `completionMode: 'social'`
may finish abstractly while absent. Their events explicitly carry `simulated: true` and
create no rewards or assets. A real engine source receipt can report a physical outcome
with the client-observed limits described above; the server does not independently simulate
geometry. Temporary hazard expires after 30 minutes, but destroyed/inaccessible sites and
unavailable actors remain blocked until a fresh observation changes them.

The core limits each region to 128 citizens and 128 active/unresolved requests and reports
capacity errors explicitly. Terminal requests move into durable archival records that also
prevent replay/reobservation from resurrecting them; the latest 16 remain in the view and
their public history remains paginated. Unresolved work and player claims are never evicted.
Cross-region population migration is not implemented by this API.

`npm test` includes the living-region checks for authenticated shared views, reservation
ownership, concurrent retry receipts, atomic batches, absent-player progression, history
pagination, proposal boundaries and persistent operation budgets. `npm run check` only
bundles a dry-run Worker; it does not deploy or establish live capability support.
`npm run test:living-integration` exercises real local workerd and SQLite Durable Objects
with two authenticated identities, concurrency and isolated bodies, without live writes.

### Shared community development

The same `LIVING` Durable Object also persists bounded community projects and advertises
`world-projects-v1`. No new binding or migration is needed beyond `v3-living-regions`.
Deploy the updated **rooms/multiplayer Worker** after the frontend is ready; this is separate
from the discovery/planner Worker. Frontend publication alone cannot activate shared
project progression. The canonical ledger, timers, deduplication, stage changes and deadline
live on the server. Locations, nearby presence, hazards and physical services remain
client-observed, not independently simulated geometry or proof of land ownership.

`register` additionally accepts `sites` (up to 16 per batch, 64 per region):

```json
{
  "id": "observe-coastal-site", "op": "register", "actors": [], "requests": [],
  "sites": [{
    "id": "coastal-path", "name": "Coastal path", "source": "place",
    "anchor": { "x": 10, "y": 2, "z": 20, "lat": 37.7, "lon": -122.4 }
  }]
}
```

`source` is `place`, `business` or `living-request`. The last requires `requestId` matching
an existing request at that site. Optional `npcId` must be a registered citizen; the server
uses that citizen's name. First observations establish canonical names and anchors;
reobservation cannot move the site or replace its source. Optional paired latitude/longitude
preserves Earth locations across render-origin rebasing. Site IDs are at most 96 characters.
Proposals for different site IDs within 12 horizontal meters and three vertical meters of
an existing project are refused to avoid overlapping decorations. This is a scenery bound,
not permission to change land ownership, homes, terrain or arbitrary road networks.

New operations require the existing private Soul bearer capability and stable `id`:

- `project-propose`: `{project: {siteId, kind}}`. Kinds: `path`, `garden`, `gathering`,
  `resonance`. The server supplies the canonical site name and anchor.
- `project-start`: `{projectId, kind: "survey" | "work"}`. Its private operation receipt
  includes `challenge: {id, projectId, kind, startedAt, readyAt, expiresAt}`. Survey takes
  at least five server seconds; work takes 30. Challenges expire after ten minutes.
  A fresh start replaces this traveller's previous action, invalidating its challenge ID.
  Retrying the exact same operation ID returns the original challenge.
- `project-complete`: `{projectId, challengeId}`. The actor-bound challenge must have
  elapsed on the server and survived observed danger. Client-supplied time, money,
  completion status or progress cannot accelerate or reward it.
- `project-service`: `{projectId, requestId}`. This consumes only an already-completed,
  physical, guarded source receipt at the exact project site. Conversation, simulated NPC
  check-ins, LLM assertions and invented evidence never become work. Player results belong
  to their reporting participant; NPC results require the original observer and actual
  assigned citizen. A source result contributes only once, permanently.

Guarded `report-source` automatically contributes an eligible physical result when a
project exists at that site. An archived receipt can be credited explicitly later if the
project was proposed afterward. Contributions retain player-observed or NPC-observed
provenance and actual actor attribution. This API mints no money, stock or reputation.

One survey and three timed work or physical-service contributions starts `building`.
Publication requires a **minimum full 24 hours after the last required contribution**.
The existing alarm advances both NPC work and project stages while players are absent;
publication and its durable public history are idempotent. Unsafe sites remain delayed,
not silently repaired. This is timing of an in-game project, not a promise to ship arbitrary
requested application code within a day.

Register can also include `projectSituation: {hazard, blockedSites, observedSites}`. Each
list is bounded to 32 known canonical site IDs; blocked sites must be among observed sites.
Per-observer records are bounded to 64. Clearing only removes this observer's previous
blocks at explicitly observed sites, never another observer's report. Hazard expires after
30 minutes; site blocks persist until their observer reports that site clear. Conditions
also include living-world danger and destroyed sites. Unsafe observations interrupt pending
challenges and require a fresh start. New danger at the publication deadline is applied
before completion.

Responses add `features`, canonical `sites`, and
`projects: {version, world, region, revision, updatedAt, projects, events}`. Project stages,
contributor counts, deadlines, blocking reasons and recent history are shared. Private
challenges and permanent source-deduplication records are absent from the public project
view. Existing paginated region history includes project events.

`npm test` covers clock spoofing, source permissions, replay, concurrent completion,
interrupted/replaced challenges, isolation, observer-scoped danger, atomic write failure
and overlapping sites. `npm run test:projects-integration` runs two identities through the
production Worker in local workerd/SQLite, then tests overdue alarms with an isolated
test-only constructor clock. Its fixture is never imported by production and adds no live
HTTP/environment override. These local tests do not establish live Worker deployment.
