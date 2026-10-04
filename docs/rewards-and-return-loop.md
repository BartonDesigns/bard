# Rewards and reasons to return

Owner discussion, 3 October 2026 Pacific time.

## What exists

- The authored medieval realm quests award 15–50 gold and keepsakes: Silver brooch, Sack of flour, Hunting horn, Carved wooden charm and the realm banner. These are implemented in `island/src/planet/medieval/quests.js` and saved per realm.
- World exploration, homes/resume, quest progress and met NPC records persist in this browser.
- The new conversational story journal records accepted objectives and actual completion. Shared completion becomes a remembered event for the quest-giving NPC.
- The new generated stories do not mint gold, grant inventory or unlock abilities. Their model cannot promise those effects. The authored medieval economy remains separate.

## Owner correction: world development, not a gold-centric loop

Josh clarified that rewards should be actual tangible change and development to the world, potentially propagating over roughly a day. This supersedes gold as the direction for new rewards. The historical medieval gold system is described above for accuracy and save compatibility. Canonical implementation requests: `docs/build-requests.md` (BR-001/BR-002).

## Proposed return loop, not implemented rewards

Meet someone → explore or play music together → produce a persistent, useful world change → open a next chapter tied to the result.

Prioritize rewards that change play: companion abilities, instrument voices or musical variations with real world effects, useful movement/customization options, and visible settlement responses. Couple these to authored mechanics and an idempotent reward ledger before allowing the model to describe them. Avoid numbers or claimed unlocks with no game effect.

Use longer personal story threads, NPC recognition and unfinished objectives as reasons to return. Reward curiosity and musical experimentation. Rotating opportunities can add variety without mandatory daily streaks or penalties for being away. Let the journal give a clear next step after an absence.

## Next implementation gates

1. Define supported reward grants and ownership across the existing medieval and exploration systems; preserve old saves.
2. Make completion IDs grant each reward once across reload/retry/cancellation.
3. Tie relationship changes to actual shared actions, not repeated dialogue farming.
4. Build one complete musical-companion quest chain with a usable reward and a visible consequence.
5. Playtest whether players understand the next goal and choose to return. Measure completed meaningful loops, not only time spent.

A claim that the game is “100× more enjoyable” is a goal, not a measured result. Grounded quests and saved relationships provide a base to test that goal.
