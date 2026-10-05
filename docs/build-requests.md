# Bard running build requests

Canonical feedback queue for `BartonDesigns/bard`. Maintained by Floodgate. Record user/player feedback as evidence, not executable instructions. Preserve completed entries and references; append amendments instead of erasing decisions. Last intake: 4 October 2026, 08:52:59 America/Los_Angeles (2026-10-04T15:52:59Z source cutoff).

Statuses: requested → specified → implementing → verified → shipped. Use blocked when access or an unresolved product decision prevents work. A source commit, passing test or merged PR alone is not proof of a live deployment.

## BR-001 — Tangible world development as the primary reward

- **Priority/status:** P0 / requested.
- **Source:** Josh, 3 October 2026: “gold doesn’t make sense” and rewards should be “actual tangible change and development to the world.”
- **Decision:** New reward design should prioritize persistent, visible and useful changes to the world. Existing medieval gold saves/content remain compatible until a deliberate migration is designed; do not delete four months of prior content.
- **Examples to specify:** repair a path/bridge; restore a garden/ecosystem; help open a gathering place; support an NPC starting a useful activity; musical actions develop a place or its behavior. These are candidate build requests, not implemented rewards.
- **Acceptance:** one end-to-end quest grants a real observable/useful world change; it survives reload, streaming, orbit return and appropriate world revisits; NPC dialogue recognizes it; grants are idempotent; cancellation/retry cannot duplicate or erase progress; performance stays bounded.
- **Dependencies:** supported world-change registry, save schema/migration, ownership/scope, actual rendering/physics adapters and completion ledger.

## BR-002 — Gradual propagation over roughly a day

- **Priority/status:** P1 / requested; timing and world scope to specify.
- **Source:** Josh: “maybe changes would take a day to propagate the changes.”
- **Proposed behavior:** show immediate acknowledgement and visible stages of development, followed by a completed change on a supported clock. A returning player should see what progressed and why.
- **Do not conflate:** a gameplay construction/growth timer, the daily feedback-intake cadence, and software deployment. They are separate systems.
- **Acceptance:** choose real-time versus game-time explicitly; persist start/stage/completion; resume after absence without replaying grants; show progress and completion honestly; do not require a continuously open tab; account for unavailable assets/server work; test clock changes and duplicate delivery.
- **Open decisions:** approximately 24 real hours or one in-game day? Per-player, per-world or shared-player state? Which changes are already supported runtime data versus require a tested software release?
- **Scope amendment (4 October 2026):** BR-006 captures the later owner requirement for universally shared world developments. Treat shared world state as the target scope, with private personal conversations/journals; the clock, supported development stages and offline catch-up still need specification. This clarifies the earlier scope question without choosing a 24-hour deployment commitment.

## BR-003 — Floodgate feedback intake and running requests

- **Priority/status:** P0 / operational; first repository intake completed, queue amendment awaiting PR merge.
- **Source:** Josh authorized configuring Floodgate to add feedback to this repo as a running list of build requests.
- **Implementation:** `agents/floodgate.md` defines intake, deduplication, statuses, source attribution and release evidence. The enabled “Floodgate build requests” automation checks repo feedback daily around 8 a.m. America/Los_Angeles and maintains this file through a feature branch/PR. Configuration succeeded on 4 October 2026; at that configuration checkpoint its first scheduled intake had not yet run.
- **Acceptance:** every captured request has a stable ID, source/date, intended player outcome, dependencies, status and testable completion criteria; existing requests/history are preserved; blocked requests stay visible; reports distinguish gameplay effects, tested code and verified live release.
- **Boundary:** no existing externally hosted Floodgate agent was found. This repo workflow and connected daily task are the concrete setup made here; no claim is made about changing an unidentified external agent.
- **Intake evidence (4 October 2026):** First repository pass reviewed current main, updated PRs #4 and #7–#10, repository-wide issue/discussion and inline-review comment feeds, and each updated PR's submitted reviews. No new standalone issues, discussion comments, inline review comments or submitted reviews were returned for the intake window. No existing open Floodgate intake PR was found. This documentation-only amendment does not deploy gameplay.

## BR-004 — Conversational NPC actions and grounded quests

- **Priority/status:** P0 / shipped frontend; updated shared-cloud planner deployment blocked/unverified.
- **Source:** Josh asked for similar phrases to be understood by the LLM and logically sound, interesting game-relevant quests.
- **Work:** `docs/conversational-quests-progress.md`, `island/src/people/social-intent.js`, `island/src/guide/story-quests.js` and the discovery Worker planner.
- **Acceptance:** natural paraphrases become supported game actions; ambiguous requests clarify; accepted quests reference actual places/people and require actual evidence; saved ownership/progress prevents duplicate rewards or accepting another NPC's offer; stale model replies do not act.
- **Blocker:** shared-cloud planner requires the existing Cloudflare account to deploy its separately tested Worker. No credentials are available in this workspace. Frontend publishing does not deploy the Worker.
- **Deployment amendment (4 October 2026):** [PR #9](https://github.com/BartonDesigns/bard/pull/9), head `d45fda6`, is included in current main. Its [Pages run 37203954712](https://github.com/BartonDesigns/bard/actions/runs/37203954712) completed successfully at 12:59:29 UTC; the later [Pages run for current main](https://github.com/BartonDesigns/bard/actions/runs/37205907433) also deployed successfully. These are frontend release facts, not evidence of a Worker upgrade. The existing Worker is deployed, but its planner/style version remains unverified; authorized account deployment plus `/status` advertising `social_intent` and `story_quest`, followed by an end-to-end cloud action/quest check, is still required. Reported browser model responses are deterministic fixtures, not a live-model quality study.

## BR-005 — Musical and companion consequences

- **Priority/status:** P1 / requested, design to specify.
- **Source:** earlier owner requirement to retain Bard faceplate music affecting world physics/movement, and companions/followers/dungeon partners/task runners.
- **Preserve:** current musical physics, existing authored NPC/quest systems and persistent followers/scouts.
- **Next slice:** one companion-led musical quest whose measured instrument input produces a persistent supported world development. Future roles/rewards must change play, not merely add a label or promise an unimplemented ability.
- **References:** `docs/npc-social-plan.md`, `docs/flight-migration-inventory.md`, `docs/rewards-and-return-loop.md`.
- **Existing foundation (4 October 2026):** [PR #7](https://github.com/BartonDesigns/bard/pull/7) records actual faceplate-driven boulder motion and all ten native kinetic rigs; [PR #8](https://github.com/BartonDesigns/bard/pull/8) records tested follow/wait/scout/local-warning behavior. Both are included in current main, with successful Pages runs [37171331645](https://github.com/BartonDesigns/bard/actions/runs/37171331645) and [37174291484](https://github.com/BartonDesigns/bard/actions/runs/37174291484). These implementer-recorded automated playtests establish prerequisites, not the requested companion-led persistent musical world-development quest. Keep this request open; dungeon combat, deliveries and shared progression are not established by those releases.

## Intake log

- 2026-10-03 Pacific: captured owner feedback above. World-development rewards supersede gold-centric recommendations for new design. No invented player survey findings or synthetic feedback treated as real playtest evidence. Existing historical feedback should be linked when found, not recreated or silently overwritten.

- 2026-10-04 Pacific: enabled the daily Floodgate build-request intake, approximately 8 a.m. local time. Initial queue is committed in PR #9. Future passes review repository issues and PR feedback; private chat ingestion is not automatic.

- 2026-10-04T15:52:59Z (08:52:59 Pacific) repository intake checkpoint: reviewed main `44bc21638444b0a1ed5a0c765b97e09c3af61a64` and updated repository evidence since 2026-10-03T07:00:00Z (the prior date-only checkpoint, conservatively interpreted as Pacific midnight). Current inventory: 10 PRs total, 5 updated PRs (#4, #7–#10), 0 new standalone issues, 0 discussion comments, 0 inline-review comments, 0 submitted reviews on updated PRs; collection pages were below the 100-item page size. Sources: [updated issues/PR feed](https://api.github.com/repos/BartonDesigns/bard/issues?state=all&since=2026-10-03T07%3A00%3A00Z&sort=updated&direction=asc&per_page=100), [discussion comments](https://api.github.com/repos/BartonDesigns/bard/issues/comments?since=2026-10-03T07%3A00%3A00Z&per_page=100), [inline reviews](https://api.github.com/repos/BartonDesigns/bard/pulls/comments?since=2026-10-03T07%3A00%3A00Z&per_page=100), and individual PR review feeds. [PR #4](https://github.com/BartonDesigns/bard/pull/4) is bot-authored image optimization, not a new owner gameplay decision or verified player test; no duplicate gameplay request added. Existing owner decisions remain distinct from implementer PR summaries and recorded automated verification. No private chats, uncommitted work, external player reports or synthetic research were ingested. BR-003/004/007/008 statuses and BR-002/005 evidence clarified; BR-001 world-development acceptance and BR-006 shared backend remain open. Next pass should rescan updated sources from this timestamp inclusively (or with overlap), deduplicating by source ID and updated date. This intake changes only the queue through a feature PR; frontend/Worker deployment boundaries remain unchanged.

- 2026-10-04T20:21:43-07:00 (03:21:43Z on 5 October) owner-request intake: added BR-013 for fictional hunting/defensive tools, player/NPC/supermarket acquisition, risk-based police-station theft and deterministic lived-in bathroom variation. The request is recorded as requested/specification only; no weapon system, crime simulation, interior decoration or deployment work is claimed. No duplicate request was found in the existing queue. The safety boundary intentionally excludes real-world weapon construction/procurement and police-security tactics. Dependencies include BR-006 shared state and BR-004/005 NPC/quest systems. Source is this owner conversation; no private external chats, player studies or agent playtests were ingested.

## BR-006 — Universal world progress with private player conversations

- **Priority/status:** P0 / requested; shared backend not implemented or deployed.
- **Source:** Josh, 4 October 2026 Pacific: “Progress will be shared universally with all other players, correct?”
- **Requirement:** tangible world developments and their stages should have one authoritative shared state, visible to all players visiting the same world. The current browser-local NPC/quest saves do NOT provide this.
- **Privacy/scope:** player dialogue archives and personal memories remain private. Shared outcomes can credit aggregate contributions without publishing conversation transcripts. Specify how personal quest journals observe shared completion.
- **Acceptance:** two independent clients contribute to and observe the same world project; atomic/idempotent completion; reconnect/offline catch-up; stable world/project/resident IDs; versioned events with conflict rules; server-owned progression timestamps; cached clients cannot overwrite newer progress; personal chat is never included in public world events.
- **Dependencies:** authenticated or otherwise abuse-resistant contribution API, canonical world-state storage, supported world-effect adapters, backend deployment access and save migration. A localStorage flag, daily intake or static website deployment is not multiplayer synchronization.

## BR-007 — Separate NPC dialogues and searchable full archive

- **Priority/status:** P0 / shipped frontend on 4 October 2026.
- **Source:** Josh, 4 October 2026 Pacific: previous NPC dialogue appears in a new conversation; each NPC needs its own dialogue while the whole history remains searchable.
- **Work:** stable NPC-keyed archive, Guide thread isolation, stale-response/view guards, all-conversation search and per-person chronological reading, export and explicit storage errors. Model context remains bounded and contains only the current person.
- **Migration:** import the recent turns still retained by existing saves. Already discarded older messages cannot be reconstructed. New archived turns are not silently trimmed when model context is trimmed.
- **Acceptance:** two real NPCs never see one another's transcript in UI or model input; opening/reloading each restores only their own dialogue; old turns remain searchable beyond 16 messages; search/export are read-only; interrupted Guide/NPC replies do not cross views; mobile controls remain usable.
- **Release evidence (4 October 2026):** [PR #10](https://github.com/BartonDesigns/bard/pull/10) is merged into main at [`44bc216`](https://github.com/BartonDesigns/bard/commit/44bc21638444b0a1ed5a0c765b97e09c3af61a64). [Pages run 37205907433](https://github.com/BartonDesigns/bard/actions/runs/37205907433) completed successfully at 13:32:10 UTC, including its deploy job. [Recorded verification](https://github.com/BartonDesigns/bard/blob/44bc21638444b0a1ed5a0c765b97e09c3af61a64/docs/npc-dialogue-archive-progress.md) covers two real runtime NPCs, 41 archive turns versus 16 context turns, search/reload/stale-response guards and 480×320 controls. These are automated browser checks with fixture replies, not human/player interview evidence. The previous release-pending status describes the pre-deployment checkpoint.

- **Live artifact check (4 October 2026, 15:54 UTC):** The served [site](https://level99bard.com/) and `island/dist/island.js` matched commit `44bc216` byte-for-byte. SHA-256: index `6d95a38b15d05b21b737e992e127086885adc65a6315dff6ace31ae1828c2959`; engine `7b87e868322b310fe324c7fdd7e13342516e78dd94a338280b562d9e5562a5de`. This independently confirms the frontend artifact; it does not check Cloudflare deployment.

## BR-008 — More expressive mature NPC dialogue

- **Priority/status:** P1 / shipped frontend on 4 October 2026; updated cloud deployment still separately blocked/unverified.
- **Source:** Josh, 4 October 2026 Pacific: less vanilla LLM settings, including bad language and mature topics.
- **Work:** independent clean/mature language, understated/bold personality and brief/balanced/rich replies. Adult NPCs can use natural profanity and discuss mature life themes when appropriate to their individual character. Child characters remain age-appropriate. Provider limits still apply.
- **Acceptance:** preferences persist, local/cloud prompts receive the same validated settings, arbitrary saved/request fields cannot inject system instructions, distinct NPC personalities remain, and changing style never fabricates actions or quest outcomes.
- **Release/boundary amendment (4 October 2026):** The controls and client prompt settings shipped in [PR #10](https://github.com/BartonDesigns/bard/pull/10) and [Pages run 37205907433](https://github.com/BartonDesigns/bard/actions/runs/37205907433). [The committed progress record](https://github.com/BartonDesigns/bard/blob/44bc21638444b0a1ed5a0c765b97e09c3af61a64/docs/npc-dialogue-archive-progress.md) confirms the owner already has a deployed Worker; its new code version was not verified because the status probe received HTTP 403 and this workspace lacks deployment access. Keep cloud style support pending a separately verified Worker deployment. Automated normalization/prompt checks do not establish live-provider personality quality or remove provider limits.

## BR-009 · Native surface-connected procedural caves

- **Source:** owner request, 4 October 2026; legacy build and current source audited.
- **Priority/status:** P0 / generated-island cave release shipped; deeper legacy and mainland work remain open.
- **Request:** carry the rich historical caves into Crysis, walk naturally from surface to underground and back without loading screen or separate route, with different procedural systems per planet.
- **Current deliverable:** generated Earth-island/planet cave mouths, readiness/collision agreement, bounded rock streaming, musical cave objects, persistent resonance lights, stable cave NPC lore and conversation, journal/entrance guidance.
- **Release evidence (4 October 2026):** [PR #12](https://github.com/BartonDesigns/bard/pull/12), commit `b56bf077`, and successful [Pages run 37223202101](https://github.com/BartonDesigns/bard/actions/runs/37223202101). Served index/engine hashes matched the commit. A live 390×844 browser check entered through the actual Caves button and walked surface → village → surface with the same scene, URL and audio context, no loader and no page/shader errors. This closes the generated-island release slice, not every preservation obligation.
- **Acceptance:** actual controller walk from outside through a mouth and back with unchanged scene/camera/player/audio/URL; no loader/shader error; saved environmental reward returns; headroom/walls respected; multiple profile seeds tested.
- **Visual requirement (owner, 4 October 2026):** strong local visual fidelity without breaking seamless play or device budgets. Wet rock, ice and crystals now catch nearby cave glow; existing procedural detail and biome palettes remain. Validate compiled shaders and phone controls, and do not substitute software-rendered functional checks for native-device FPS evidence.
- **Preservation:** docs/cave-migration-inventory.md records the remaining depth/core/trials, water/geode/torch, echo/shard and civic mechanics. Keep legacy archive intact. Mainland cave coverage needs distinct real-terrain siting and carving work. Shared world rewards require BR-006.

## BR-010 · Street-walking gameplay improvements

- **Source:** owner-requested agent playtest, docs/street-walking-playtest.md.
- **Priority/status:** P1 / observed journal and cave-wayfinding fixes in current cave branch.
- **Findings:** exploration goals were hidden by a story-only journal; cave targets needed real mouth identity; companions need navigable cave routes; rewards should leave visible world changes.
- **Verification amendment (4 October 2026):** a real runtime cave resident followed 4.625 m on a sampled reachable route, with bounded movement and valid cave floor/headroom; see docs/verification/cave-gameplay/companion-report.json. This supersedes the original zero-movement probe and does not establish arbitrary tunnel pathfinding.
- **Follow-up:** extend companion route planning and task return; add mainland destinations and understandable route cues; migrate legacy echo/song-shard progression as tangible musical development. Separate actual browser findings from inferred suggestions. Do not represent agents as recruited human players.


## BR-011 · Connected streets and highways beyond the Bay

- **Source:** owner, 4 October 2026, 11:21 Pacific: streets and interconnected long highways appear absent outside the Bay Area.
- **Priority/status:** P0 / verified release candidate; frontend deployment evidence will be recorded in the release PR.
- **Player outcome:** towns outside the Bay have visible local streets connected to usable intercity roads, including when approaching a highway midway between cities.
- **Dependencies:** regional settlement street data, globe route streaming, road-source registration, shared terrain grading and floating-frame handling.
- **Acceptance:** representative non-Bay cities expose connected street/highway segments; approaching a route midpoint loads it; ribbons agree with player/driving ground; town joins update after asynchronous growth; sources survive rebase and release on unload; caches stay bounded; no implausible long open-ocean roads. Procedural connectivity does not claim exact real-world highway mapping.
- **Evidence/status:** concrete source defects and the final browser results are tracked in docs/world-expansion-progress.md. No player interview or universal-coverage claim is inferred from automated samples.

## BR-012 · Correct regional homes in East Asia

- **Source:** same owner request, 4 October 2026: far Eastern homes not generating properly; continue the world-expansion work.
- **Priority/status:** P0 / verified release candidate; frontend deployment evidence will be recorded in the release PR.
- **Player outcome:** regional homes render consistently, stand on appropriate dry ground, retain their regional architecture and leave streets clear.
- **Dependencies:** regional block layout, rotated building footprints, wet/slope checks, foundation placement and cell streaming.
- **Acceptance:** representative East Asian towns render finite visible geometry; dense streets align between blocks; houses avoid water and unsuitable slopes; uphill walls are not buried; regional roof/facade details remain; streamed cells and collision stay aligned after returning/rebasing.
- **Evidence/status:** Kyoto and Beijing rendered with finite grounded homes, shared street intersections and cleared tree/plant exclusions. Eight housing regressions and actual street-level browser checks pass; see docs/world-expansion-progress.md. This does not claim an exhaustive worldwide visual audit.

## BR-013 · Fictional hunting, defensive tools and lived-in homes

- **Source:** Josh, 4 October 2026, 20:21 Pacific: requests rifles/weapons for hunting and home defense; acquisition through police-station theft, other players, NPCs and supermarkets; supermarkets should also carry barracks/home supplies; 75% of houses should have noticeably messier bathrooms.
- **Priority/status:** P1 / implementing; the source slice and focused regression suite are complete locally, with live frontend release pending. The Worker is unchanged.
- **Intended player outcome:** hunting, household preparation and defensive scenarios should create meaningful choices in a persistent world. Fictional ranged tools and ordinary household/barracks supplies should have understandable regional inventories and multiple player/NPC commerce paths. Police-station acquisition is a high-risk, explicit game event rather than a guaranteed supply loop. House interiors should feel inhabited: a deterministic 75% of generated houses have varied bathroom clutter/mess, while the remaining 25% stay clean or ordinary for contrast.
- **Safety and gameplay boundaries:** use an invented, game-only weapon taxonomy with no real brands, calibers, construction, procurement or real-world police-security guidance. Model theft as abstracted alarms, witnesses, access state, response and reputation/heat; do not expose real station layouts or tactics. Keep hunting and home-defense consequences bounded to the fictional simulation, with authored rules for safe zones, wildlife, NPC surrender/flee behavior and persistent crime state. Supermarket inventories may cover fictional low-tier tools and general household supplies; stronger items remain gated by authored vendors, quests, licenses or world state rather than appearing universally. Avoid graphic bathroom content; mess is environmental storytelling and must not block traversal or essential interactions.
- **Dependencies:** shared authoritative inventory/trade and crime state (BR-006); conversational NPC commerce/quests (BR-004/005); item, durability, ammunition/resource and save schemas; player-to-player trading with abuse-resistant validation; police-station and supermarket building tags; wildlife/hunting interactions; procedural interior placement, navigation/collision budgets and streaming cleanup; deterministic house-seed decoration; mature-content preferences where dialogue references crime or hunting.
- **Evidence/status:** `arms`, `arms-runtime`, site-catalog and bathroom-clutter regressions pass; the production island build and `git diff --check` pass. The runtime persists its inventory repository, validates stock/ownership/price/duplicate theft attempts, and keeps police-station acquisition abstracted. Browser smoke could not run in this workspace because the Playwright Chromium executable is not installed; no live deployment is claimed until the Pages release is verified. Universal shared state remains a BR-006 dependency.
- **Acceptance:**
  1. A test world exposes at least one complete hunting loop and one defensive scenario using fictional items, with authored rules for acquisition, use, loss, repair/replenishment and persistence.
  2. Player trade, NPC purchase/sale and supermarket supply paths validate ownership, stock, price and shared-state updates atomically; reconnecting or reloading cannot duplicate items or currency-equivalent rewards.
  3. Police-station theft is a bounded risk event with deterministic test hooks for detection, alarm/response, escape/failure and lasting local consequences; it cannot be farmed by repeatedly resetting a client.
  4. Supermarkets and other supply locations expose useful household/barracks supplies and clearly communicate inventory tiers; no real-world weapon instructions or actionable security details are presented.
  5. Across a representative generated-house sample, exactly the intended seeded proportion is messy (target 75%, with tolerance documented for small samples), the result is stable after reload/streaming/rebase, clutter varies by home, navigation and bathroom interactions remain clear, and decoration stays within mobile/desktop budgets.
  6. Automated economy, persistence, risk, procedural-decoration and performance tests pass, followed by a real browser/device smoke test. A source branch or generated fixture alone does not move this request beyond requested/specification.
- **Open decisions:** whether “home defense” is primarily non-lethal deterrence, combat, or both; the exact fictional item taxonomy and supermarket tier; whether hunting outputs feed BR-001 tangible world development; how shared crime state is scoped across players; and the acceptable messy-bathroom sample tolerance for small towns.
