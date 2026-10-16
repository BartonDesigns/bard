# Living-world verification — 14 October 2026

This is automated development evidence, not a live release or a human playtest. The branch integrates main `b05ea02` and PR #25 head `3f8e663`.

## Checks run

- New client suites: `living-world`, `living-world-runtime`, `negotiation`, `negotiation-runtime`, `negotiation-intent`, `bank-receipts` — 98 tests passing. These cover bounded simulation, claims, consent, scope/identity races, save failures, source evidence, service terms, replay and ledger recovery.
- Existing integration suites: `quest-immersion`, `story-quests`, `social-intent`, `social-state`, `arms`, `arms-runtime`, `economy` — 65 tests passing.
- Claude's realism regressions: `npc-morality`, `npc-quests-more`, `military`, `structures-runtime`, `chatter`, `world-awareness` — 56 tests passing.
- `npm --prefix server/multiplayer test` — 105 existing room assertions plus 33 Node tests passing.
- `npm --prefix server/multiplayer run test:living-integration` — 14 checks passing against real local workerd and SQLite, including two identities, concurrent retry, reservation theft rejection, body isolation, source permission and terminal replay protection.
- `npm --prefix server/discovery test` — 107 assertions passing.
- Production bundle and Worker deployment dry-runs pass. Dry-runs do not deploy.
- `git diff --check` passes.

## Visual/interaction evidence

`ui-browser-report.json` and `activity-*.png` / `agreement-*.png` come from `island/tools/living-world-browser.cjs`: actual Guide, negotiation runtime, inventory and ledger; controlled activity facade, model proposals and completion evidence. Both 1280×900 desktop and 390×844 touch-emulated Chromium pass. Tests cover unusual conversational phrasing, a real conditional quote, stale buttons, spoken agreement without purchase, explicit confirmation, missing-evidence rejection, once-only exchange and no layout overflow. The fixture's 1000-to-20 offer uses a supplied service worth enough to justify it; it is not a guarantee every production merchant has such a job.

`engine/browser-report.json`, `engine/personal-story-phone.png` and `engine/route-marker-phone.png` come from the production bundle through `island/tools/quest-immersion-browser.cjs`. Three actual quest chapters complete with explicit reports, trust reaches the expected value and a persistent local route marker is rendered. Model replies are deterministic and physical objective positions are controlled. The standalone engine runs in software WebGL; it does not certify the complete faceplate, a physical phone, Safari or production performance. The test output directory was overridden so older PR #25 evidence remains intact.

The journal's local mode was exercised against a server without the new living-world capability. The UI reports that boundary instead of claiming cloud persistence.

## Deployment evidence and remaining gates

`production-capabilities.json` records read-only checks of the existing production `/status` endpoints on 14 October 2026. CORS is valid, but rooms lacks persistent reputation/living-world capabilities and Discovery lacks quest-continuity/negotiation capabilities. Wrangler reports no authenticated Cloudflare account in this workspace. Neither Worker was deployed here, and frontend changes are not claimed live.

Required production acceptance: deploy the updated rooms and Discovery Workers from the authorized Bard checkout, publish the frontend separately, run `node server/verify-workers.mjs`, then test two real clients in the same region, actual departures/returns, one source-backed completion, bargaining at a staffed shop, repair/destruction transitions, Soul recovery and physical mobile behaviour. Genuine LLM quality remains a playtest gate. See `../../living-world-and-negotiation.md` for limits and exact deployment commands.
