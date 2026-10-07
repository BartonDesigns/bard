# The rooms server (multiplayer, Cloudflare free plan)

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
| `GET /status` | `{ ok, version, maxPlayers }`. |
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
  - 2 KB a message;
  - 20 messages a second per player, with bursts up to 40 (a flood closes that socket);
  - 20 new rooms an hour from one address.
- **Privacy:** what you say to townsfolk is never sent. The server cleans every message
  (`island/src/net/protocol.js`, shared by the game and the server), and only these fields can
  pass:
  - poses;
  - spots;
  - the hour and weather;
  - the plain facts of a meeting: the resident's name, the place, the time, and a gathering's
    kind, size and seed.

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
   npm test          # offline checks: should end "58 passed, 0 failed"
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
- `node island/tools/multiplayer.test.mjs`: the client's follow steering, interpolation, and
  reconnect with backoff.
