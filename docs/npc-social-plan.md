# Persistent people and social play

Status: design and implementation checkpoint, 4 October 2026 UTC. The roadmap below separates the full design from the initial bounded implementation; nothing here claims a live deployment. Owner request: retain progress, revisit people, make spoken instructions cause real actions, local warning/panic, companions, followers, dungeon partners and task runners.

## Proposed target for the first complete social slice

The following is the intended acceptance scenario, not a claim about the current implementation. Meet a resident, ask them to warn the village, see them walk to nearby residents and pass on the warning, watch those residents become alarmed, then recruit one willing adult to follow, wait or return home. Leave the area, fly to orbit, return and reload: the same identities, relationship, completed warning and party orders remain. The journal explains what happened. Implement this offline first; cloud dialogue can phrase confirmed results but must not be required to act.

The proposed next adapters are the medieval named cast for stable homes and existing dungeon/quest routes, plus one fixed island village roster to prove the general crowd integration. The current runtime instead promotes encountered ambient residents; neither of these authored roster adapters is claimed complete. Do not describe arbitrary city crowds or dungeon combat partners as complete until their adapters pass the same checks.

## Existing systems to reuse

| System | Current evidence | Integration |
|---|---|---|
| `people/people.js` | Bounded pooled bodies, avoidance, public doors, engage/release, external talker registration. `seedN` depends on allocation; recycling clears `persona`. | Add persistent resident IDs independent of body slots; keep rendering and collision. |
| `region/folk.js` | Regional clothes/jobs and seeded generation, but allocation counter and latitude contribute to seed. | Replace encounter-order identity with stable settlement resident slots. |
| `people/persona.js` | Seeded persona, regional context, offline replies, mood/gesture tags. | Freeze biography at first creation; refresh weather/current events separately. |
| `guide/guide.js` | Conversation records in a `WeakMap` keyed by rendered person; bounded model history. `crysis-journal` persists visits, while person histories do not. | Key records by resident ID; separate user command handling from generated text. Ignore late replies after actor/world replacement. |
| `planet/medieval/folk.js` | Authored cast IDs and seeds derived from realm/cast identity. | Best named resident adapter; preserve named cast, wardrobe and anchors. |
| `planet/medieval/quests.js` | `crysis-realm-${realm.seed}` stores quests, items, beacons and health; authored rescue/delivery quests already exist. | Emit task progress through existing quest transitions, never duplicate payouts or replace saves. |
| `space/body.js` | `worldBody().key` retains galaxy/system/body/raw seed independently of terrain seed. | Use this body key in every social identity and event. |
| `share.js` | Homes/resume keep body identity and geographic positions. | Reuse coordinate conventions; persist absolute geographic position on Earth, never rebased render coordinates. |
| `server/discovery/src/talk.js`, `server/README.md` | Free cloud response service; server-side memory/shared happenings remain proposals. | Supply bounded game facts when needed. No server migration or paid service needed for first slice. |
| `docs/flight-migration-inventory.md` | FLT-036 memory/relationships, FLT-041 bonds, FLT-043 song requests, FLT-081 band responses remain preservation obligations. | Build migration adapters and explicit parity tests; leave original records intact. |

## Identity and saves

A resident exists as data even when no mesh is loaded. Use a versioned tuple of body key, stable settlement ID and resident slot/authored ID. Do not use pool index, display name, rounded current camera position or integer terrain seed alone. On Earth use fixed geographic cells or mapped venue IDs for home settlements; on procedural worlds use authored settlement IDs/local coordinates. Store the generation version so future population improvements cannot rename existing friends.

A resident record contains appearance seed, frozen biography, home anchor, current logical location, meeting count, disposition/trust, structured remembered events, current order and party membership. Current climate and mood are dynamic context, not replacements for birthplace or name. Instantiated actors hold only `residentId` and a generation token. The resident store owns truth.

For ambient passers-by, promote a deterministic resident into saved state on first meaningful contact. Named residents, quest givers and recruited people are always pinned. The journal offers “People” with home area, last known whereabouts and order status. Revisit home at a predictable daily window or see their destination in the journal. Persistent presence does not mean keeping every distant body rendered or every person standing motionless forever.

Use a small versioned local store for the first slice, with schema validation, revision, last successful write and a last-good backup. Save immediately after accepted orders, relationships, quest completion and recruitment, then debounce movement summaries. Flush on page hide and before travel/world disposal. Never claim “Saved” after a storage failure; keep playing in memory with one clear notice. Bound recent structured memories; never evict pinned identities or active quests to make space. Retain an export/import route before expanding beyond a small save budget.

This is same-browser persistence. Cross-device accounts/shared multiplayer require a separate explicit design. Avoid silently uploading transcripts. Store concise game facts by default, such as `warned:windmill-road` and `helped:bread`, rather than private conversation text.

Legacy migration: inventory the exact old `l99npc1` and bond-book schemas before writing adapters. Preserve originals, record migration version and source identity, import only a proven world/person match, and show unmatched old friends in an archived journal instead of assigning them to an unrelated current resident. The same caution applies to medieval seed-keyed saves when two original bodies share an integer terrain seed. Never clear old quest keys on first load.

## Commands that actually do something

One deterministic command boundary owns state mutations. Input text or a button proposes `{type, actorId, targetId, scope, requestId}`. Validate actor eligibility, current order, target existence, same world/area, party capacity and quest prerequisites before acceptance. Return an explicit accepted/refused/clarification result and the current task status. Generate conversational wording only after this result exists.

First supported commands: warn the village, follow me, wait here, return home, cancel your task, and report your progress. Show these as contextual choices as well as typed phrases. An unsupported free-form command gets an honest response; it does not receive a fake promise. Negations, hypothetical questions, quoted requests and third-person discussion must not fire an action. “Don't warn anyone” is cancellation/refusal context, not a warning. “If I told you to warn them…” does nothing. Ambiguous targets show a small choice of actual nearby places/people.

Every accepted order has an ID and state: accepted, moving, performing, completed, blocked, canceled or failed. Repeated clicks/model retries reuse the request ID. One primary order per NPC; a replacement explicitly supersedes the previous order. Dialogue mood and gesture tags never award loot, move actors or mutate relationships. A cloud reply cannot introduce arbitrary commands or targets.

## Local warnings and panic

A warning is a localized event with source, body/settlement, bounded radius, severity, creation time, expiry and unique ID. The messenger visibly approaches reachable neighbors, speaks/gestures, then recipients react. Each recipient remembers each event once; duplicate relays never multiply panic or rewards. Begin with a fixed settlement membership/radius and one relay generation, not unlimited contagion across the globe.

Use separate concern and belief. A player warning can cause local alarm without creating a real monster/fire in the simulation. Visible threat events carry stronger evidence; false alarms can later reduce trust. Personality and role affect responses: a guard checks the road, a shopkeeper seeks shelter, another resident checks on family. Cap agitation, decay it over simulation time and offer “all clear”/reassurance that only resolves the matching event. A new warning must not overwrite every resident with a permanent identical panic state.

First budget: up to eight recipients, at most one relay delivery per second and one active warning per settlement. Tune after tests. Use ordinary collision/path constraints and safe gathering anchors, not arbitrary teleporting or fleeing into water. If unreachable, record blocked and explain it. On reload/offscreen return, restore the event's remaining logical state without replaying every animation or applying its effect twice. Define expiry against capped elapsed game time; do not run thousands of catch-up ticks after a long absence.

## Companions, quests and errands

| Role | Contract | Completion and travel |
|---|---|---|
| Companion/follower | Willing eligible adult joins a bounded party; follows a reachable trailing point; can wait, regroup or dismiss. | Wait keeps an anchor; dismiss returns home. Never removes their resident identity. |
| Dungeon quest partner | Explicit party member with supported role, such as guide, torch bearer or existing rescue escort. | Use the current medieval dungeon/quest transitions. Enter/exit once, resume same quest ID, persist return anchor; combat/healing roles need separate implementations. |
| Runner | Accepts a reachable delivery/check-in job with source, destination, payload and reward contract. | Pickup and delivery are distinct saved steps; no completion by merely elapsed time while the NPC is visibly stuck. |
| Local messenger | Warns actual residents and reports who was reached. | Completed when bounded recipient list is exhausted; partial/blocked outcomes remain visible. |
| Musical ally | Trust from actual playing; later invitation to band or song request. | Reuse measured held voices/phrases/BPM and active faceplate; silence and menu toggles give no credit. |

A companion is reserved from ambient recycling and counts within existing character limits. Start with one active follower, then widen only after measured headroom. Keep a short breadcrumb route along valid player ground movement; use local avoidance and public-door hooks. If the path fails, stop and report “I can't reach you,” then allow regroup at a reachable safe anchor. Do not teleport through walls, into locked rooms, off cliffs or across planets just to maintain a distance threshold.

Orbit is a specific boundary: grounded companions wait at the saved departure meeting point and say so; their data remains active but their actor need not render. Cross-planet travel asks for a supported transport contract in a later slice. Dungeon transitions may carry only eligible current party members, once, via established safe entry/exit anchors. Clear pending navigation and speech when worlds dispose, but retain logical orders. A player's death/recovery must specify where each party member regroups and must not duplicate their actor.

Future runners can deliver a sealed message, collect an already-owned item, survey a known waypoint or escort someone along an authored route. Validate inventory ownership and reserve cargo atomically; cancellation returns it once. Rewards use completion IDs so reload, repeated dialogue and retry cannot pay twice. Unsupported open-ended tasks should suggest available tasks, not quietly invent economy changes.

## Implementation sequence and gates

1. Add pure social identity/store/event modules, tests and a read-only people journal. Integrate stable medieval cast and one island roster. Demonstrate same NPC after reload and stream out/in before adding autonomy.
2. Add offline validated orders and one following/wait/home controller. Tie guide response to actual accepted result. Demonstrate movement/collision, cancellation and restored party state.
3. Add localized messenger and concern reactions, event deduplication/decay, report outcome and calm/all-clear. Show a visual before live, as HANDOFF requires for people changes.
4. Adapt one existing dungeon escort and one authored delivery quest to the same task lifecycle. Verify items/rewards and travel boundaries. Expand city/regional residents only after these adapters pass.
5. Migrate proven legacy social records and restore music bonding/song requests/band behavior against preservation inventory. Broader emergent NPC relationships and shared server happenings remain separately tracked work.

Acceptance checks:

- Speak to two people, reload, revisit and verify distinct IDs, same names/appearance/home, remembered facts and no inherited history from recycled actor slots.
- Change display name, region streaming order, weather/month and render origin; identity remains unchanged. Distinct fractional planet seeds remain distinct social worlds.
- Offline text and buttons produce the same state transitions. Negated/hypothetical/quoted commands, unknown targets and fabricated model action tags cause no world mutation.
- Warning reaches only eligible local recipients, visibly changes behavior, records who received it once, decays and survives reload without duplicate spread. Adjacent settlements stay unchanged.
- Follow, wait, resume, cancel and return-home respect doors, terrain, unreachable routes and actor budgets. Departing to orbit leaves the person at the promised anchor; re-entry/reload finds the same person.
- Dungeon entry/exit, recovery and world replacement produce one companion, one saved order and no stale async callbacks.
- Reload before/after pickup and delivery, cancel, repeat completion and retry a request: inventory conserved and reward granted exactly once.
- Storage unavailable/corrupt/full: playable fallback, honest unsaved indicator, last-good recovery and original legacy data preserved.
- Run sustained movement plus repeated streaming/travel; character geometry, listeners and memory remain bounded. Benchmark before/after on the existing phone profile; do not substitute software-renderer timing for native phone responsiveness.

## Remember development progress too

Keep this design, a small implementation checkpoint and test evidence in the repository on the feature branch. After each working slice record commit SHA, files changed, exact verified behaviors, remaining limitations and next concrete task. Mark partial work explicitly. Update HANDOFF once a coherent checkpoint is committed; avoid rewriting earlier evidence as if newly rerun. Git provides durable recovery; chat context is not the project database. Keep production saves and implementation progress distinct, and never include actual player's private conversations in test fixtures or committed artifacts.

## Initial state-layer implementation checkpoint

`people/social-state.js` now implements a versioned local resident store with body/home/appearance identity, frozen biography, position, modes/tasks, bounded local chat and event memories, last-good backup recovery and surfaced storage errors. Met identities are never silently evicted. Position updates are batched until the caller flushes; orders and memories save immediately. `parseSocialIntent` recognizes only bounded direct commands and rejects negated, conditional or quoted forms.

Warnings currently expand logically at 8 metres per second to at most 120 metres, affect only the same body, decay over 120 seconds and expose at most eight remembered recipients at one per second. Duplicate local warnings and a 30-second source cooldown prevent amplification. This is local gameplay alarm, not proven physical messenger delivery or a settlement social graph. Existing unknown ambient residents can react by position; receipt memory for them requires promotion to a resident.

`node island/tools/social-state.test.mjs`: eleven tests passed on this checkpoint, covering reload/frozen identity, distinct worlds/home slots, bounded history without roster eviction, save failure/retry, corrupt-save recovery and preservation when recovery fails, warning bounds/time/reload, local all-clear, Earth coordinate wrap and command intent handling including named scouting targets. Actor/guide integration is separately owned and requires browser verification. Save data and legacy migration are not yet cross-device; no old social records are deleted or auto-matched. Dungeon combat assistance, inventory runners, personality-based propagation, musical bonds and legacy social parity remain explicit later gates.

Controller review: `people/social.js` now refuses physical orders without a live adopted actor, checks the resident belongs to the current body, refreshes the actor position before local actions, validates scout coordinates and terrain, limits recruiting to adults, and discloses failed persistence in accepted replies. `node island/tools/social-controller.test.mjs` passes four integration tests for live-actor eligibility, scout validation, save failure/age eligibility, and party limits/cancellation. These use the real controller and actor adoption with lightweight bodies; they do not replace rendered browser verification.
