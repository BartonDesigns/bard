# Community project verification — 14 October 2026

This checkpoint continues PR #31 with implemented shared projects, in-world scenery and conversational controls. It does not certify a production deployment, an actual phone, a live language model or a real 24-hour production wait.

## Automated checks

| Check | Result |
| --- | --- |
| `node --test island/tools/community-project*.test.mjs` | 63 passed: 17 core, 16 runtime, 14 marks, 8 site adapter, 8 intent/presentation |
| Existing living-world, negotiation, quest, story, social, arms and economy suites | 157 passed |
| Existing structures, military and economy suites | 36 passed; overlap with the previous group is intentional, not an additional unique-test total |
| `npm --prefix server/multiplayer test` | 105 room assertions and 44 Node tests passed |
| `npm --prefix server/multiplayer run test:projects-integration` | 25 real local Worker/SQLite checks and 7 controlled-clock alarm checks passed |
| `npm --prefix server/multiplayer run test:living-integration` | 14 existing local Worker/SQLite checks passed |
| `npm --prefix server/discovery test` | 117 assertions passed |
| Frontend build and both existing Worker dry-runs | Passed; dry-run does not deploy |

The runtime suite also exercises the real Worker handler and LivingRegion with in-memory durable storage: source registration, authenticated challenge receipts, survey/work contribution, alarm completion after a controlled day with the client disposed, and restoration. The separate workerd integration exercises real SQLite and concurrent identities. A test-only clock harness is isolated in `server/multiplayer/test/fixtures/`; production accepts neither a clock-override route nor a client-selected timestamp.

## Browser evidence

`ui-browser-report.json` and `project-work-*` / `project-complete-*` show the actual Guide and actual client runtime at desktop and 390×844 touch-emulated sizes. Controlled scene/model/time inputs cover paraphrase interpretation, explicit review, early-finish refusal, movement cancellation, pause, all three work sessions, saved completion, cross-world/cross-NPC safeguards and overflow. Completed project facts enter the correct NPC's model context; a recovery-key sentinel and another NPC's private conversation do not. Existing real negotiation/inventory browser regression also passes at both sizes.

`project-visual-report.json` and `world-projects-*` render all four project kinds through the actual Three.js adapter on controlled terrain. All four lifecycle stages render without page errors. Four completed sites use 24 draw calls and 2,438 triangles in this fixture. These measurements cover the project scenery, not total game or physical-phone frame time. Geometry tests cover ocean/ground/obstruction checks, canonical nonrelocating placement, dry lunar terrain, Earth frame rebasing, resource reuse, LOD and explicit musical input.

`project-engine-report.json` records the separate production-bundle smoke on real generated TERRAN terrain and actual named Guide places. The tester positions the player at discovered sites; project stages and survey progress are not injected. It passes discovery, a garden proposal, a real elapsed survey and rendered preparing-stage supplies, with no page, shader or caught frame errors; `real-engine-project-phone.png` shows the actual site. Its tested bundle hash is in that report. The initial attempt exposed the physics clock's 50ms frame clamp slowing work at low FPS. Project observation now uses its own active frame interval capped at 250ms, while physics remains unchanged. Hidden/loading/paused sessions cancel observation instead of crediting absence.

## Production boundary

`production-capabilities.json` is a read-only check at **2026-10-14T17:32:28Z**. Existing rooms and Discovery respond with valid CORS, but lack the new reputation/living-world/world-project and negotiation/community-planner capabilities. `wrangler whoami` also reports no authenticated Cloudflare account in this workspace. No temporary preview account, deployment or credential modification was used.

The source and frontend bundle are published on the feature branch. Merge/publication of the frontend and deployment of both existing Workers are separate steps. Two real production clients, genuine model phrasing, real-day alarm completion and actual-phone/Safari checks remain release acceptance gates. See [the gameplay and deployment contract](../../community-world-projects.md).
