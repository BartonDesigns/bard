# Persistent reputation verification

Tested against main `1995d17324ceb43f1842e026fe017da6a8d2ae67` in an isolated feature branch. The latest pushed Claude branches were contained in that main. No other contributor's branch was changed.

| Check | Result |
| --- | --- |
| Existing room/trade/combat checks | 105 passed |
| Existing shared incident tests | 10 passed |
| Durable soul server tests | 8 passed |
| Client persistence, recovery race, NPC context and cave-field tests | 6 passed |
| Claude NPC dispositions/regions/quests/money tests | 8 passed |
| Real local workerd and two WebSockets | Passed: saved standing, attributed summary, room end/new room/new socket ID, eight-second cleansing, new epoch and stale-event rejection |
| Frontend build | Passed; checked-in engine bundle and cache token regenerated |
| Worker deployment dry run | Passed; existing ROOMS and new SOULS bindings present |
| Chromium production engine bundle | Passed; zero page/shader errors, all shader programs runnable |

The browser test walks the real collision path from outside the tunnel to the well, roughly 138 m below the island. It remains in the same world throughout, records a favour and robbery through the game ledger, waits for cloud-save acknowledgement, checks Story, uses both cleansing buttons and verifies zero current deeds with two lifetime receipts. It captures 640×420 and 390×844 touch layouts. The visual pass also cleared a procedural column from the ritual space and hides the navigation beam on arrival.

See `browser-report.json`, `quiet-well-landscape.png` and `quiet-well-portrait.png`. These are local verification captures, not production playtests. The final recovery-status race guard was covered by the client regression test and the bundle rebuilt after the capture; it does not change the cave rendering or controls.

## Remaining release gates

- The complete faceplate page crashes this sandbox's single-process Chromium before DOM readiness. The working standalone engine page runs the actual bundled game. A full faceplate smoke on a normal browser and physical iPhone/Safari performance remain unverified; do not represent the local fixture as those checks.
- The read-only production check at **2026-10-14 02:40 UTC** found Discovery's `social_intent` and `story_quest` available, but rooms advertised neither `reputation-v1` nor `persistent-reputation-v1`. See `production-capabilities.json`.
- This branch has not deployed a Worker or changed credentials. Merge/publish the frontend and deploy **server/multiplayer**, including the new Durable Object migration, with authorized Cloudflare access. Discovery does not need deployment for this feature.
- After deployment, check `/status` and complete the documented two-client save/reload/new-room/cleansing acceptance flow in production. A capability flag alone is insufficient.

The account-free key and client-simulated authority limits are explicit in `docs/persistent-reputation.md`. There is no claim of server-authoritative world physics or universal persistent world development.

## Follow-up integration

The immersion continuation integrates main `f0365cd` and additionally changes Discovery. The earlier reputation-only deployment statement above is historical; use `docs/quest-immersion.md` for the combined release and `docs/verification/quest-immersion/` for fresh capability evidence. Neither Worker was deployed by this continuation.
