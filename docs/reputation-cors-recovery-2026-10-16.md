# Reputation CORS recovery — 2026-10-16

The uploaded console report repeatedly rejected `Authorization` on `/souls/me`
and reported a missing `rapier.mjs.map`. A read-only production check confirmed
that the deployed `l99-rooms` Worker permits only `content-type` in its preflight
and advertises only `trade-v2`, `combat-v1` and `combat-guard-v1`. The repository's
Worker already permits Authorization and implements Souls; that server release
has not been deployed to the existing Cloudflare Worker.

## Changes

- The Soul client checks public `/status` without credentials before any private
  request, including recovery. An older Worker stays in local mode and is checked
  again after five minutes. Concurrent probes share one request.
- Transport/CORS failures back off from 30 seconds to five minutes. New deeds and
  frame updates cannot override that cooldown. The local outbox and identity are
  retained, and saving resumes when the server becomes available.
- The guide labels unsupported cloud saving as local saving. Worker status only
  advertises persistent reputation when the SOULS binding exists; a missing
  binding returns a readable service error instead of throwing.
- The deployment verifier checks the real Authorization/JSON preflight as well
  as feature flags. CORS still accepts only configured game origins.
- The build copies Rapier's matching source map beside its module. The map is
  fetched by debugging tools, not during ordinary gameplay loading.

## Verification

- 21 focused Soul client/server tests passed, including queued save preservation,
  recovery, deduplication, unsupported deployments, cooldowns, missing bindings and
  allowed/denied origins.
- The complete rooms suite passed: 105 existing room checks and 46 Node tests.
- Real cross-origin Chromium checks exercised an old Worker, actual rejected
  preflights, subsequent server availability, and upload of queued deeds through
  the production handler. The source map returns a valid version-3 map.
- Local workerd passed the actual preflight and durable-storage/socket integration
  checks, including reputation recovery, cleansing and stale-epoch rejection.
- The production frontend build and whitespace checks pass.

Run the client/browser checks with:

```sh
node --test island/tools/soul-availability.test.mjs island/tools/persistent-reputation.test.mjs server/multiplayer/test/soul.test.mjs
node tools/soul-cors-browser.cjs
npm test --prefix server/multiplayer
```

The browser script accepts `CHROME_EXECUTABLE` and `PLAYWRIGHT_MODULE`.

## Remaining server deployment

GitHub Pages publication updates the game, not Cloudflare Workers. Wrangler has
no authenticated account in this workspace. Automatic approval review also
blocked its deployment dry-run because of possible source transmission to
Cloudflare; no remote Worker upload or deployment was performed. Local bundle,
handler and browser checks are separate from that unavailable deployment check.

From the authenticated Bard checkout, update and deploy the existing rooms Worker:

```sh
git pull --ff-only
npm ci --prefix server/multiplayer
npm run deploy --prefix server/multiplayer
```

Keep all existing Durable Object migrations. Do not replace the Worker identity.
The live `/status` must advertise `persistent-reputation-v1` and `/souls/me`
preflights must explicitly allow `authorization, content-type`. Cloud saves and
cross-device recovery remain unavailable until this deployment succeeds; local
deeds are retained. The game rechecks support automatically, or reload to recheck
immediately. `node server/verify-workers.mjs` checks this and reports any separate
Discovery capabilities still awaiting deployment.
