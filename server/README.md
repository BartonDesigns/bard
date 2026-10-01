# The game's server (Cloudflare, free plan)

One small Cloudflare Worker, `server/discovery`, gives every player the same world and lets the
townsfolk talk. It runs entirely on Cloudflare's **Workers Free** plan: a Worker, two
SQLite-backed Durable Objects, the Workers AI binding and one nightly cron. Nothing here needs
a card on file, and it never spends past the free daily allowance.

The game works without it. Until it is deployed, places use the atlas's own briefs and people
answer with their built-in lines, so nothing breaks while you set it up.

## What it does

| Route | What |
|---|---|
| `GET /brief/:id` | A place's brief (districts, streets, signs, chatter, music), the same for every player. 404 until someone discovers the place. |
| `POST /discover` | `{ id, lat, lon, name, pop }`: makes a brief the first time a place is reached, then keeps it forever. |
| `POST /talk` | `{ npc, history }`: a townsperson's next line, in the game's mood and gesture tags. The game sends only who the person is and the last few lines; the server writes the instructions, with the content rules built in (`src/talk.js`). |
| `GET /status` | The day's allowance: used, left, and conversation's share. No secrets, nothing about players. |

A nightly cron spends whatever is left of the day on the biggest atlas cities no one has
discovered yet, just before the allowance resets at 00:00 UTC.

### Staying free

- Workers AI's free allowance is 10,000 Neurons a day. The ledger (`src/ledger.js`) caps the day
  at `DAILY_NEURONS` (8,000, never more than 9,500). Before every call it reserves the worst case
  the call could cost, and settles the real cost after, so the day can never go over.
- Conversation has its own share, `TALK_NEURONS` (3,000), so talking can never starve the place
  briefs, and its own hourly limit per player, `TALK_PER_HOUR` (60).
- Models and their prices (Neurons per million tokens, from the Workers AI pricing page) are in
  `wrangler.toml`: `MODEL` for briefs, `TALK_MODEL` for people. **If you change a model, change
  its prices with it,** or the ledger's arithmetic is wrong.
- When the day's share is used, the server says so and the game falls back to its own lines.

### Privacy

- Players are counted for rate limits by a salted hash of their address and the day, kept in
  memory only. No address is ever stored.
- What a player says to a townsperson is sent to Workers AI to answer and is not kept anywhere.
- Only the game's own site may call it (`ALLOWED_ORIGINS`; localhost for development).

## Setting it up (first time, from no account)

1. **Make a Cloudflare account.** Go to dash.cloudflare.com/sign-up, sign up with an email,
   and verify it. The free plan is the default; you don't need to add a card or a domain.
2. **Install the tools** on your computer: Node.js 20 or newer, then in this folder:
   ```
   cd server/discovery
   npm install
   npx wrangler login        # opens the browser to authorise wrangler with your account
   ```
3. **Set the salt** used to hash player addresses, a long random string you keep to yourself:
   ```
   npx wrangler secret put IP_SALT
   ```
4. **Check, then deploy:**
   ```
   npm test                  # the offline checks: no account, no network
   npm run check             # a dry run of the deploy
   npm run deploy
   ```
   Wrangler prints the Worker's address, for example
   `https://l99-discovery.<your-subdomain>.workers.dev`. The first time, Cloudflare asks you to
   choose that `workers.dev` subdomain.
5. **Point the game at it.** Put the address in `island/src/earth/config.js`:
   ```js
   export const DISCOVERY_URL = 'https://l99-discovery.<your-subdomain>.workers.dev';
   ```
   Then rebuild (`cd island && npm run build`), commit `dist/island.js` and ship as usual.
6. **Try it.**
   - Open `<address>/status` in a browser: you should see the day's allowance.
   - In the game, open the Guide's settings (⚙), choose **Free cloud voice (people only)**, and
     stop someone in the street to talk.
   - It works on phones too, since nothing runs on the device.

If the site moves to another address, add it to `ALLOWED_ORIGINS` in `wrangler.toml` and
deploy again.

### Running it locally

`npm run dev:local` runs the Worker on your machine (`http://localhost:8787`) with
`test/local.toml`. Set `DISCOVERY_URL` to that address while developing. Workers AI calls still
go to Cloudflare and count against the same free allowance.

## Next steps (the townsfolk as agents)

This is the groundwork. The next layer, still on the free plan:

- **Memory:** a Durable Object per townsperson (keyed by their seed and place) that remembers a
  few facts about the world they have seen, such as the weather, the festival or the traveller
  who helped them. It would never keep what players typed. Cloudflare's Agents SDK (the `agents`
  package) is built on Durable Objects and fits this shape.
- **Shared happenings:** a place's day (market day, a storm, a lost dog) decided once on the
  server, so every player in that place hears the same news from its people.
- **Moderation:** a cheap classification pass on replies before they are sent, from the same
  allowance.
