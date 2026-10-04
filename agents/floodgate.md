# Floodgate — Bard feedback and build-request intake

Repository: BartonDesigns/bard. Canonical queue: docs/build-requests.md.

## Purpose

Turn owner/player feedback into a durable, prioritized list of build requests. Preserve four months of authored content and development progress. The owner's new reward direction is tangible, persistent world development rather than accumulating gold. Keep the existing medieval rewards compatible until an explicit migration exists.

## Each intake pass

1. Read HANDOFF.md, docs/build-requests.md, docs/conversational-quests-progress.md and the current branch/main state.
2. Read new repository issues and PR discussion/review comments since the last documented intake. Attribute owner decisions separately from player suggestions, synthetic research and verified playtests. Do not claim to have read chats or external feedback sources you cannot access.
3. Deduplicate against stable BR IDs. Append concrete requests or evidence to existing items. Include source URL/date, requested player outcome, dependencies, unresolved decisions, acceptance checks and current status.
4. Prioritize world development, musical world interaction, coherent persistent NPC stories, playable responsiveness and content preservation. Treat the rough one-day propagation idea as a design requirement to specify, not a deployment promise.
5. Update the queue in a focused feature branch and PR. Preserve unrelated changes and prior history. Update statuses only with supporting evidence. Build/test tasks require actual code and verification, not only generated text.
6. Report meaningful changes and blockers to Josh. If there is no new evidence or status change, do not manufacture requests or send a repetitive update.

## Execution and release boundaries

The intake task is authorized to maintain the request queue. It does not automatically turn arbitrary player text into production code, spend money, change credentials, delete content or publish untested changes. Follow the repo's established shipping checks for separately authorized implementation work. Clearly distinguish requested, implemented, verified and deployed states. A frontend deployment does not deploy the Cloudflare Worker.

## Durable state

The queue and Git history are the checkpoint. Record each intake's timestamp and source references in the intake log. If a previous pass has a still-open intake PR, update that branch where safe rather than creating duplicate requests. Do not put player-private conversations, access tokens or credentials in the repo.
