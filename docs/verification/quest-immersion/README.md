# Quest immersion verification — 14 October 2026 UTC

Integrated base: `f0365cd09c0965bee78f6abcf88087b82b6f5236`. Continued on `codex/persistent-reputation` / PR #25. No gameplay deployment was performed.

| Check | Result |
| --- | --- |
| Client quest, relationship, social, chatter, world-awareness and persistent-reputation suite | 86 passed |
| Claude military and police suite | 11 passed |
| Claude NPC morality suite | 8 passed |
| Discovery Worker validation/planner suite | 97 passed |
| Discovery deployment dry run | Passed |
| Frontend production bundle build | Passed |
| Production-engine NPC conversation fixture | Passed all three chapters, no page/shader errors |
| Phone presentation | 390×844 touch emulation captured; Story and visible route post inspected |
| Production capability check | Not ready: rooms lacks both reputation flags; Discovery lacks the new continuity flag |

`browser-report.json` records the actual objective evidence and personal trust after each chapter (3, 6, 9). The browser fixture uses `island/dev.html` with the actual production engine bundle, remembered resident, real Guide controls, target IDs and quest state. It uses deterministic model replies, places the player at required locations, and pauses the render loop between evidence steps. It verifies a premature semantic report cannot advance the quest, opening a dialog and saying hello do not finish it, actual report-button clicks complete it, and choosing the marked route produces a visible saved post. It is an automated integration fixture, not a human traversal study or live-model quality test.

The first visual pass exposed unsafe placement near a steep cave mouth. The final implementation checks dry, level footing; unsuitable stops remain available in a quiet journal route. The final marked-route capture is at a surveyed village stop on level ground. The shared-voice status label in the fixture is expected: production inference is not used.

- `personal-story-phone.png`: personal relationship and persistent outcome ahead of the existing daily activities.
- `route-marker-phone.png`: the actual small route post on safe ground in the rendered scene.
- `production-capabilities.json`: read-only checks at 2026-10-14 05:02 UTC; these are deployment facts, not gameplay acceptance.

Reproduce from the repo root:

```sh
node --test island/tools/quest-immersion.test.mjs island/tools/social-intent.test.mjs island/tools/social-state.test.mjs island/tools/social-actors.test.mjs island/tools/social-controller.test.mjs island/tools/story-quests.test.mjs island/tools/world-awareness.test.mjs island/tools/chatter.test.mjs island/tools/persistent-reputation.test.mjs
node island/tools/military.test.mjs
node island/tools/npc-morality.test.mjs
npm --prefix server/discovery test
npm --prefix server/discovery run check
npm --prefix island run build
node island/tools/quest-immersion-browser.cjs
node server/verify-workers.mjs
```

Browser fixture prerequisites: installed Playwright (`PLAYWRIGHT_MODULE` or runtime dependency path) and Chromium (`CHROME_EXECUTABLE` override supported). It runs its static server, local soul HTTP fixture and browser in one process. It does not use production credentials. The original real-workerd and Quiet Well tests remain documented in `../persistent-reputation/`.

The sandbox’s single-process Chromium still cannot complete the full faceplate page. Full-site smoke in a normal browser, physical iPhone/Safari acceptance and live shared-planner story quality remain open. Relationships and route projects are device-local; these tests do not establish universal multiplayer world changes.

The final travel-lifecycle correction removes the marker group before departing-world resource disposal and rebuilds it on return. The focused nine-test immersion suite verifies reset, foreign-body suppression and return with the saved marker. The bundle was rebuilt after the captured conversation pass; this lifecycle-only change does not alter those visuals or conversation controls.
