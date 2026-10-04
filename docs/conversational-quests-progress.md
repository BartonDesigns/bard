# Conversational actions and grounded story quests

Work checkpoint, 4 October 2026 UTC. Branch `codex/conversational-quests`, based on `6d660c8` (persistent NPC release, PR #8).

## Implemented

An exact supported request still takes the immediate path. Other conversational requests use a structured LLM planner when the selected model supports it, with conservative offline paraphrases when unavailable. The model proposes one intention, confidence, and a supplied destination ID. Game validation, resident eligibility, collision and task state decide the actual action. Ambiguity produces a question. Negated/hypothetical statements, unsupported output and stale replies cannot issue actions.

Quest proposals contain two to four grounded objectives. The game validates actual places/NPCs, requires a spatial objective and explicit acceptance, and advances only on observed visits, conversations or newly completed scouting reports. Proposals cannot invent items, combat, rewards, unlocks or destination IDs. Offers, ownership, acceptance, ordered evidence and completion persist separately from existing exploration and medieval quest saves. Completed stories become a remembered event for the offering NPC, once, including after recovery.

People and Quests tabs expose saved relationships and story progress. Offers can be accepted or declined conversationally or through journal buttons. Offline grounded offers remain available when the model is absent. Recent quest history informs later proposals, but long-term campaign quality remains an area for playtesting.

## Provider and deployment boundary

The website bundle supports WebLLM and Ollama planning and the upgraded shared-cloud protocol. The discovery Worker has fixed server-authored planning prompts, bounded data, validated output and the existing request/origin/free-budget limits. Older cloud deployments are capability-detected and do not receive unsupported planning requests.

The Cloudflare Worker needs a separate deployment. This workspace has no Cloudflare credentials or Wrangler login. Its implementation, tests and deployment dry-run are complete, but it is NOT claimed live. Publishing GitHub Pages does not deploy that Worker. Deployment instructions are in `server/discovery/README.md`; do not ask the owner to paste secret tokens into chat.

## Verification

10 intent tests, 14 story tests and 5 model-transport/context tests pass. The discovery Worker passes 94 assertions and a deployment dry-run. Existing social actor checks pass; changed JS lint and production build pass.

`island/tools/conversational-browser.cjs` runs the actual faceplate, NPC bodies and guide UI with deterministic model responses. It verifies paraphrased follow/scout/warn execution; clarification and malformed-response non-execution; stale conversation/world response rejection; blocked legacy quest-tag bypass; explicit acceptance; ordered visit/return/talk evidence; altitude and textual claims not completing quests; true reload persistence; and a 480×320 journal layout. This validates execution of model proposals, not semantic quality of a live LLM. Live-model language quality and native-device responsiveness still need real provider/device playtesting.

## Continue

Final browser checks passed: conversational acceptance belongs to the current NPC; shared quest completion is remembered exactly once before and after reload. Save the evidence and publish through a feature PR. Connect the existing Cloudflare account to deploy the Worker. Keep frontend and Worker deployment status separate. Do not overwrite older social, quest or flight content.
