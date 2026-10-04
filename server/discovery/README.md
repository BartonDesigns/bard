# Discovery server

The shared "location saver" for Level 99 Bard. It makes sure every place has one brief (its districts, streets, signs, chatter, music and so on), the same for every player, for good.

- The first player to come to a place has its brief made on **Workers AI**, within the free daily allowance.
- Everyone after that gets the same brief.
- The server is a Cloudflare Worker with two SQLite-backed Durable Objects and one Cron Trigger. It runs entirely on the **Workers Free plan**.

## How it works

```
GET  /brief/:id    the kept brief, or 404 if no one has discovered the place yet
POST /discover     { id, lat, lon, name, pop }: returns the brief (made now if needed),
                   or 202 while it is still being made
GET  /status       today's Neuron use (nothing about players)
```

**Place ids.** An id is either an atlas city's id (`lisbon`) or a generated town's (`gen:<slug>:<lat>,<lon>`).

**Checking a town's request.** For a generated town the server checks that:
- `lat` and `lon` round to the id's values;
- the point is on land according to the atlas;
- `pop` is an integer from 0 to 3;
- `name` slugs to the id's slug.

**The prompt.** The server builds the prompt from its own bundled copy of the atlas and the game's brief code. It imports `island/src/earth/`, so there is one source of truth. No text a player sends ever reaches the model: a town's name is written `{town}`, and each player's game puts the name in.

**One brief per place.** Each place has its own Durable Object (`BriefStore`), named by its id.
- A Durable Object runs one request at a time, and everyone asking about a place reaches the same one.
- So concurrent first discoveries share one generation.
- If generation takes longer than `WAIT_MS`, waiters get `202`, and the game looks again later.

**The ledger.** One `Ledger` Durable Object keeps the day's Neurons, the per-address rate limits, and the list of atlas cities already done.
- Before each call it reserves the worst case: the prompt plus `MAX_TOKENS` of output, at the model's Neuron price.
- It only allows the call if `used + reserved + worst case ≤ DAILY_NEURONS`.
- After the call it replaces the reservation with the actual cost from `usage`. If the reply has no `usage`, it charges the worst case.
- `DAILY_NEURONS` defaults to 8,000 and is capped at 9,500 in code, so the server can never go past the free 10,000.

**When the allowance is used up.** When the day's allowance is spent (or the model fails twice on a place), the server keeps the atlas brief as that place's canonical brief. Once a place is discovered, it stays as the first player saw it. The trade-off is that such a place never gets the richer, model-made brief. The nightly round reduces this for real cities (see below).

**The nightly round.** A cron at 23:50 UTC, just before the allowance resets, spends whatever is left of the day on the biggest atlas cities no one has discovered yet, up to `NIGHT_MAX` a night. Unlike player discoveries, the nightly round never keeps an atlas brief; it leaves the city for another night.

**What is stored.** Per place: `{ v, id, source, brief, made: 'YYYY-MM-DD' }`. Nothing about who discovered it.

**Rate limits.** Rate limits count a salted hash of the address and the day, in memory only. No address is ever stored.

**CORS.** Allowed origins are `https://level99bard.com`, `https://www.level99bard.com` and `http://localhost` / `127.0.0.1` on any port (turn localhost off with `ALLOW_LOCALHOST = "false"`). A `POST` without an allowed `Origin` is refused.

## Deploy (all free)

1. **Create a Cloudflare account** at dash.cloudflare.com. The Free plan needs no payment method.
2. **Install and log in:**
   ```sh
   cd server/discovery
   npm install
   npx wrangler login
   ```
3. **Deploy:**
   ```sh
   npx wrangler deploy
   ```
   This does everything in one step: it creates the Worker, the two Durable Objects (from the `migrations` in `wrangler.toml`), the Workers AI binding (the `[ai]` block, with nothing to create by hand) and the nightly cron. The first time, wrangler asks you to pick a `workers.dev` subdomain. It prints the URL, e.g. `https://l99-discovery.<subdomain>.workers.dev`.
4. **Optional: set a salt for the address hash.** Enter any random string when prompted:
   ```sh
   npx wrangler secret put IP_SALT
   ```
5. **Check it:**
   ```sh
   curl -H 'origin: https://level99bard.com' https://l99-discovery.<subdomain>.workers.dev/status
   ```
6. **Point the game at it.** In `island/src/earth/config.js`, set `DISCOVERY_URL` to that URL. Then run `cd island && npm run build` and publish the site as usual.

No KV namespace or D1 database needs creating. The Durable Objects hold everything.

## Local testing

- `npm test` runs the Node checks, with the Durable Objects and Workers AI mocked. It needs no account and no network. It covers:
  - generating once;
  - twelve concurrent discoveries making exactly one generation;
  - the allowance ceiling and the 4006 error;
  - rate limits;
  - id, lat/lon, land, pop and name validation;
  - CORS;
  - the nightly round.
- `npm run dev:local` runs the Worker in the real runtime (workerd) with `test/local.toml`: no account and no AI binding. Every discovery keeps the atlas brief, so you can try the routes, CORS and storage by hand.
- `npm run dev` (`wrangler dev`) needs `wrangler login`. It runs the AI binding against your account, so calls use real (free) Neurons.
- `npm run check` bundles the Worker without deploying.

## Settings (`wrangler.toml` `[vars]`)

| var | default | |
|---|---|---|
| `MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Supports JSON mode. If the schema can't be met, the server asks once more without it and reads the reply leniently. |
| `NEURONS_IN_PER_M` / `NEURONS_OUT_PER_M` | 26668 / 204805 | The model's price from the Workers AI pricing page. Change these together with `MODEL`. |
| `MAX_TOKENS` | 2000 | A brief is about 1,200 to 1,500 tokens of JSON. |
| `DAILY_NEURONS` | 8000 | The day's ceiling; capped at 9,500 in code. |
| `RATE_PER_HOUR` | 12 | Generations one address may start per hour. |
| `WAIT_MS` | 25000 | How long a discovery waits before answering 202. |
| `NIGHT_MAX` | 30 | The most atlas cities the nightly round makes. |

**Throughput.** At these prices a brief costs about 300 Neurons (worst case about 440). That is roughly 25 briefs a day on the free allowance. Covering all 904 atlas cities with the nightly round alone takes about five weeks; player discoveries come first each day.

## Staying free

- **Keep the account on the Workers Free plan.** On Free, going over any limit returns an error; nothing can be billed. On Workers Paid ($5 a month), usage past the included amounts would be billed. The Neuron ceiling still holds, but the plan itself costs money.
- **The free allowance is shared per account.** It is 10,000 Neurons a day across the whole account, resetting at 00:00 UTC. Other Workers AI use on the same account counts against it, so the default ceiling of 8,000 leaves some room.
- **Choose free models only.** Some models (e.g. kimi-k2.6, glm-5.2) now require Workers Paid and return 403 on Free. Don't switch `MODEL` to one of them.

### Conversational actions and quest proposals

`POST /talk` also accepts an optional `planning: {kind, context}` alongside the existing
`npc` and `history`. Kinds are `social_intent` and `story_quest`; `GET /status` advertises
those supported by this deployed Worker in `planning`. The client does not send a system
prompt and never attempts a planning call against an older Worker without this capability.

The server constructs fixed instructions, whitelists bounded context fields, and validates
returned JSON against actual supplied destination and resident identifiers. Social proposals
select from the supported actions; quest proposals contain two to four visit, return, talk,
or completed-scout objectives. Neither endpoint executes an action or marks an objective
complete. The game independently checks current state, requests explicit quest acceptance,
and advances objectives only from observed game evidence.

Planner calls keep the existing 6,144-character request limit, allowed-origin check, hourly
conversation rate limit, and free daily conversation allowance. Social output is capped at
220 tokens and a quest at 900; the full prompt and these output caps are reserved in the
same ledger before inference. Malformed or unavailable model output returns the offline
fallback, and an inference that ran is still accounted for. No model or pricing changes
are required.

Frontend deployment does not deploy this Worker. Run `npm test`, `npm run check`, then
`npm run deploy` from this directory using the owner's existing Cloudflare login. Verify
`/status` advertises both planning kinds after deployment. The game retains the player's
existing model selection; this update does not automatically enable cloud conversation.
