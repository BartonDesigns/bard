# Personal relationships and connected quests

Owner continuation, 14 October 2026 UTC: make the existing reputation and quest lines more immersive. This extends PR #25, integrating main `f0365cd09c0965bee78f6abcf88087b82b6f5236` (Claude’s military, police and melee work). It does not change another contributor’s branch or claim access to unpushed edits.

## What the player experiences

A remembered resident now has personal history with the traveller, separate from public reputation. Accepting work records a promise; completing it adds trust. Declining an offer carries no penalty, but abandoning accepted work or missing a meeting affects that relationship. Kept appointments count once. Harm the resident actually witnessed is distinct from rumours or another player’s actions. A polite apology does not erase it. Damaged trust can make a resident refuse to follow or scout; conversation and opportunities to follow through remain available.

Greetings, gestures, passing remarks and model context draw on that history. A friend can acknowledge your help while questioning your wider harmful reputation. Immediate danger still takes precedence. There is no time-based trust decay; the Quiet Well starts fresh personal standing while preserving completed chapters and visible projects.

The first three structured quests with a resident form a connected arc:

1. Discover a real place worth sharing, then return with your own impression.
2. Compare the route and decide who it is for: mark surveyed stops, or keep a quiet route in the journal.
3. Follow through on the choice and return to discuss it, with the previous chapter and outcome supplied to the planner.

The game owns the chapter, objectives, evidence and consequence. The LLM supplies bounded quest prose using the resident’s occupation/interests, relationship and actual available places. No model may grant trust, create items, fabricate a completed visit, or invent executable effects. The offline fallback uses the same arc and validation. When all three chapters are finished, existing ordinary quest generation remains available; this is not an infinite authored campaign.

Opening the dialog or saying hello no longer completes a talk objective. Report back explicitly, in your own words or with the report button, while physically near the correct resident. Earlier visits/scouting must actually be complete. The text of a report is saved as the traveller’s account, not proof of invented discoveries. A high-confidence semantic intent can recognize an unfamiliar phrasing; uncertainty cannot skip objectives.

The marked choice adds small persistent trail posts at dry, level surveyed footings. Unsafe stops are never given signs; if none is suitable, the conversation explains why and disables that choice. The quiet choice saves the route and its stop names without changing the landscape. Marker meshes are bounded to the nearest 16 within 180 metres, on the current body, with shared materials, no new lights or colliders, and disposal. Earth positions use the existing geographic rebase adapter.

Story now begins with **People who know you** and **What we left behind**. The three new chapters reward relationships and a supported world change, not credits. Older paid quest saves, daily goals, inventory and military/economy work remain compatible.

## Persistence and honest scope

`crysis-quest-chronicle-v1` stores receipts, bonds, chapter outcomes and route projects. Personal bonds are namespaced to the current recovery identity; recovering another soul cannot inherit its predecessor’s relationship receipts. Epoch handling prevents old completion history from restoring pre-cleansing trust. World markers and completed chapters are not deleted by cleansing. Corrupt data is preserved, and quota/unavailable storage errors are shown.

**These relationships, personal quest chapters and route projects are saved on this device. They are not universally shared construction or cloud-synced NPC memory.** Restoring a soul on a new device restores the durable reputation ledger described in `persistent-reputation.md`; it does not recover the local conversation/quest journal. BR-006 remains open for authoritative shared world projects. No one-day propagation schedule is implemented by this slice.

The model still works within visit/return/talk/scout objectives. This does not add companion combat, deliveries, branching faction wars or promises of unsimulated consequences. Literary quality with the production model needs a live playtest; deterministic fixtures verify mechanics, not how compelling every generated story will be.

## Deployment

Frontend, rooms Worker and Discovery Worker are separate releases. This branch has not deployed any of them.

- Publish the rebuilt frontend after review and full-site smoke.
- Deploy `server/multiplayer` for the original soul ledger/Quiet Well, including the `SOULS` migration. Require `reputation-v1` and `persistent-reputation-v1` in `/status`.
- **This follow-up also needs a Discovery deployment** for retained personality/chapter context and semantic `quest_report`. Require `features: ["quest-continuity-v1"]` alongside the existing planners. Earlier notes saying Discovery was unchanged describe the original reputation-only slice.

After merging, from the separate Bard checkout with authorized Cloudflare access:

```sh
cd "$HOME/bard-worker-deploy" &&
git switch main &&
git pull --ff-only &&
npm --prefix server/multiplayer ci &&
npm --prefix server/multiplayer run deploy &&
npm --prefix server/discovery ci &&
npm --prefix server/discovery run deploy &&
node server/verify-workers.mjs
```

The read-only production check at **2026-10-14 05:02 UTC** found both existing Discovery planners available, but not the new continuity feature. Rooms still lacked both reputation flags. No credentials were changed or deployment performed.

## Acceptance and verification

See `docs/verification/quest-immersion/README.md` for commands, captures and limits. The production-engine fixture completes all three chapters through the NPC conversation UI with deterministic model proposals and positioned physical evidence. It checks that a premature report, opening a conversation and saying hello cannot finish work, then chooses a marked route and captures it on level ground. Unit tests cover the quiet alternative, reload, cleansing, identity separation, deduplication, witness attribution, storage failures and terrain rejection.

Before live release, smoke the full faceplate in a normal desktop browser and on a physical phone, then use the deployed shared planner with un-scripted requests. Verify another client’s reputation attribution separately from local relationships; do not label local route markers universal multiplayer progress.
