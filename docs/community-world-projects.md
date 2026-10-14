# Shared community projects

Implementation checkpoint: 14 October 2026, `codex/living-world-negotiation`, continuing PR #31. This is implemented gameplay and a shared server contract; it is not yet a production release. Main was rechecked at `b05ea02`, preserving the concurrent economy, military, destruction and repair work.

## Playable loop

Open **Guide → Story → Community projects**, or ask the Guide/a resident to improve a discovered place. Natural-language interpretation selects an existing site and one of four bounded improvements. A review button confirms the proposal; model output cannot submit coordinates, change ownership, spend funds or declare a project complete.

At the marked site, survey for five active seconds, then record the survey. Contribute three 30-second sessions of work, recording each explicitly. A confirmed physical job at the same source can contribute a work unit instead; completed NPC work is credited to that NPC, not silently converted into a player's personal reward. Merely simulated social activity never counts as physical construction. Source receipts cannot be reused across projects.

One survey and three work units begin construction. The shared service sets the earliest completion to **24 real hours later**, then a Durable Object alarm finishes it when observed conditions permit. Players need not leave a tab open. The UI shows preparation, construction, completion and delays. This timing is a gameplay requirement, not a promise of arbitrary requested software shipping in a day.

The result is visible at its saved location:

| Improvement | Current scene effect |
| --- | --- |
| Marked path | Ground-safe waymarks and stepping stones |
| Community garden | Raised planting beds, foliage and flowers on suitable worlds |
| Gathering place | Benches and lanterns |
| Musical stones | A small stone instrument, explicitly playable through the Bard faceplate voices, with measured music response |

These are small scene additions. Path markers do not excavate roads, benches are not a new seating system, gardens do not mint food, and this adapter does not rebuild damaged houses or acquire land. Existing terrain, structures, economy and repair crews retain their responsibilities. Sites are checked for dry footing, slope, buildings, roads, trees and collision clearance. Once saved, a project never jumps to another spot to dodge an obstruction. Earth latitude/longitude survives frame rebasing; planet/region keys isolate other worlds.

## Persistence and trust

The existing `LivingRegion` Durable Object now owns project state, shared contributions, operation receipts, timed work challenges, site observations and alarm completion. It reuses the `LIVING` binding and `v3-living-regions` migration already introduced in this branch. There is no extra Worker or credential. `/status` advertises `world-projects-v1` only when the binding exists.

The same Soul identifies the contributor across clients. Server time prevents a client clock from accelerating shared work or the 24-hour delay. Source jobs must be completed, physical, match the site, and belong to/allow the contributing player; recorded NPC outcomes preserve the original NPC attribution. Client-observed geography and movement remain client observations, not independently authoritative server physics or legal property rights. Public history excludes conversation transcripts and private Soul credentials.

The client pins region and identity across asynchronous operations. A saved outbox retries an uncertain contribution with the same operation ID; it cannot silently issue a second credit. Shared cached state is never overwritten by a local preview or promoted from local completion. Corrupt storage is retained and changes pause. Moving away, flying, backgrounding or encountering danger stops active work; returning requires a fresh observation. Recent public events are bounded, while server audit history and source deduplication remain durable. A region supports 64 projects and reports capacity explicitly rather than deleting older developments.

If the service lacks the new capability, the feature is labelled **Saved on this device**. Local development is a preview using the device clock, with no claim of universal synchronization or clock-tamper resistance. Previously shared records stay offline/read-only when the service is unavailable. The older private quest-marker ledger and proposed `/v1/world-progress/events` contract remain intact; this implementation uses typed operations under `/living/:world/:region` instead.

## Release and continuation

The production check at 2026-10-14T17:32:28Z found Discovery advertising only `social_intent` and `story_quest`, and rooms advertising only trade/combat capabilities. Neither this project service nor the prior reputation/living-world/negotiation upgrade is live there. See `verification/community-projects/production-capabilities.json`.

Merge the reviewed frontend/Worker changes, deploy both existing Bard Workers from the authorized Bard checkout, and publish the frontend separately. The deployment commands are in [living-world-and-negotiation.md](living-world-and-negotiation.md). `node server/verify-workers.mjs` now also requires `world-projects-v1`, `community_project_intent` and `community-project-intent-v1`. A successful frontend deployment alone does not meet that gate.

Before a production completion claim: two independent authenticated clients must see the same project, contribute without duplicate credit, reload/travel and recover their shared state, then see a real server-timed completion. Check genuine model paraphrases and an actual phone/Safari. Automated accelerated-clock fixtures demonstrate logic; they do not represent waiting a real day in production. Full universal asset ownership, arbitrary construction, shared wallet/merchant settlement, and infinite unseen-population simulation remain separate work.

Implementation areas: `people/community-projects-core.js` (pure lifecycle), `people/community-projects.js` (client persistence/actions), `people/community-project-sites.js` (observed scene sites), `guide/community-project-marks.js` (scenery/music), Guide project intent/UI, and the existing rooms/Discovery Workers. Verification commands and evidence are recorded in `verification/community-projects/README.md`.
