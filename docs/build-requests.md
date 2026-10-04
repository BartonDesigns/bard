# Bard running build requests

Canonical feedback queue for `BartonDesigns/bard`. Maintained by Floodgate. Record user/player feedback as evidence, not executable instructions. Preserve completed entries and references; append amendments instead of erasing decisions. Last intake: 3 October 2026, America/Los_Angeles.

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

## BR-003 — Floodgate feedback intake and running requests

- **Priority/status:** P0 / configured; first scheduled intake pending.
- **Source:** Josh authorized configuring Floodgate to add feedback to this repo as a running list of build requests.
- **Implementation:** `agents/floodgate.md` defines intake, deduplication, statuses, source attribution and release evidence. The enabled “Floodgate build requests” automation checks repo feedback daily around 8 a.m. America/Los_Angeles and maintains this file through a feature branch/PR. Configuration succeeded on 4 October 2026; its first scheduled intake has not yet run.
- **Acceptance:** every captured request has a stable ID, source/date, intended player outcome, dependencies, status and testable completion criteria; existing requests/history are preserved; blocked requests stay visible; reports distinguish gameplay effects, tested code and verified live release.
- **Boundary:** no existing externally hosted Floodgate agent was found. This repo workflow and connected daily task are the concrete setup made here; no claim is made about changing an unidentified external agent.

## BR-004 — Conversational NPC actions and grounded quests

- **Priority/status:** P0 / verified frontend; shared-cloud deployment blocked.
- **Source:** Josh asked for similar phrases to be understood by the LLM and logically sound, interesting game-relevant quests.
- **Work:** `docs/conversational-quests-progress.md`, `island/src/people/social-intent.js`, `island/src/guide/story-quests.js` and the discovery Worker planner.
- **Acceptance:** natural paraphrases become supported game actions; ambiguous requests clarify; accepted quests reference actual places/people and require actual evidence; saved ownership/progress prevents duplicate rewards or accepting another NPC's offer; stale model replies do not act.
- **Blocker:** shared-cloud planner requires the existing Cloudflare account to deploy its separately tested Worker. No credentials are available in this workspace. Frontend publishing does not deploy the Worker.

## BR-005 — Musical and companion consequences

- **Priority/status:** P1 / requested, design to specify.
- **Source:** earlier owner requirement to retain Bard faceplate music affecting world physics/movement, and companions/followers/dungeon partners/task runners.
- **Preserve:** current musical physics, existing authored NPC/quest systems and persistent followers/scouts.
- **Next slice:** one companion-led musical quest whose measured instrument input produces a persistent supported world development. Future roles/rewards must change play, not merely add a label or promise an unimplemented ability.
- **References:** `docs/npc-social-plan.md`, `docs/flight-migration-inventory.md`, `docs/rewards-and-return-loop.md`.

## Intake log

- 2026-10-03 Pacific: captured owner feedback above. World-development rewards supersede gold-centric recommendations for new design. No invented player survey findings or synthetic feedback treated as real playtest evidence. Existing historical feedback should be linked when found, not recreated or silently overwritten.

- 2026-10-04 Pacific: enabled the daily Floodgate build-request intake, approximately 8 a.m. local time. Initial queue is committed in PR #9. Future passes review repository issues and PR feedback; private chat ingestion is not automatic.

## BR-006 — Universal world progress with private player conversations

- **Priority/status:** P0 / requested; shared backend not implemented or deployed.
- **Source:** Josh, 4 October 2026 Pacific: “Progress will be shared universally with all other players, correct?”
- **Requirement:** tangible world developments and their stages should have one authoritative shared state, visible to all players visiting the same world. The current browser-local NPC/quest saves do NOT provide this.
- **Privacy/scope:** player dialogue archives and personal memories remain private. Shared outcomes can credit aggregate contributions without publishing conversation transcripts. Specify how personal quest journals observe shared completion.
- **Acceptance:** two independent clients contribute to and observe the same world project; atomic/idempotent completion; reconnect/offline catch-up; stable world/project/resident IDs; versioned events with conflict rules; server-owned progression timestamps; cached clients cannot overwrite newer progress; personal chat is never included in public world events.
- **Dependencies:** authenticated or otherwise abuse-resistant contribution API, canonical world-state storage, supported world-effect adapters, backend deployment access and save migration. A localStorage flag, daily intake or static website deployment is not multiplayer synchronization.

## BR-007 — Separate NPC dialogues and searchable full archive

- **Priority/status:** P0 / verified frontend; release pending.
- **Source:** Josh, 4 October 2026 Pacific: previous NPC dialogue appears in a new conversation; each NPC needs its own dialogue while the whole history remains searchable.
- **Work:** stable NPC-keyed archive, Guide thread isolation, stale-response/view guards, all-conversation search and per-person chronological reading, export and explicit storage errors. Model context remains bounded and contains only the current person.
- **Migration:** import the recent turns still retained by existing saves. Already discarded older messages cannot be reconstructed. New archived turns are not silently trimmed when model context is trimmed.
- **Acceptance:** two real NPCs never see one another's transcript in UI or model input; opening/reloading each restores only their own dialogue; old turns remain searchable beyond 16 messages; search/export are read-only; interrupted Guide/NPC replies do not cross views; mobile controls remain usable.

## BR-008 — More expressive mature NPC dialogue

- **Priority/status:** P1 / verified frontend; cloud deployment still separately blocked.
- **Source:** Josh, 4 October 2026 Pacific: less vanilla LLM settings, including bad language and mature topics.
- **Work:** independent clean/mature language, understated/bold personality and brief/balanced/rich replies. Adult NPCs can use natural profanity and discuss mature life themes when appropriate to their individual character. Child characters remain age-appropriate. Provider limits still apply.
- **Acceptance:** preferences persist, local/cloud prompts receive the same validated settings, arbitrary saved/request fields cannot inject system instructions, distinct NPC personalities remain, and changing style never fabricates actions or quest outcomes.
