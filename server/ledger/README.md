# Ledger server

The source of truth for the town's money in Level 99 Bard: households, people living alone, the
player. It runs entirely on the **Workers Free plan**: one Worker, one SQLite-backed Durable
Object, one Cron Trigger.

## How it works

Every account's balance is a deterministic **baseline** (`island/src/economy/ledger-core.js`:
wages on payday, pension, rent and bills monthly, food and living daily, the children's
allowance, lunches and clothes) plus a **delta** of what actually happened to it (a request
paid, a wallet stolen or handed back, a hospital bill). Only accounts with something on top of
the baseline are stored.

```
GET  /status                   { ok, pending, day }
POST /events                   { events: [[account, day, amount, kind, counterparty, base?]], profiles: { account: plan } }
GET  /account/:id              plan, settled state, balance and 90 daily balances
GET  /admin                    the admin page (chart and recent transactions)
GET  /admin/api/accounts       header x-admin-key
GET  /admin/api/account/:id    header x-admin-key
POST /admin/api/settle         header x-admin-key: settle now
```

- Clients (island/src/economy/bank.js) keep working offline and post their queued events when
  the ledger is reachable. Events are checked: known account ids, the last week's days only,
  at most 5,000 credits each, at most 500 a batch.
- A plan is accepted once per account (every client derives the same one from the same seed).
- The cron settles every account with events just after midnight UTC and keeps its balance
  and a daily snapshot (90 days); each account keeps its last 20 transactions.
- Kind codes are in `KIND` in ledger-core.js (1 wage, 2 bonus, 3 sale, 4 request ... 15 hospital).

## Deploy (the owner)

```
cd server/ledger && npm install && npx wrangler secret put ADMIN_KEY && npx wrangler deploy
```

Then point the game at it once in the browser console: `localStorage.setItem('crysis-ledger-url', 'https://l99-ledger.<you>.workers.dev')` (or open the game with `?ledger=<url>`). The admin page is `https://l99-ledger.<you>.workers.dev/admin`.

## Test

```
cd server/ledger && npm test
```
