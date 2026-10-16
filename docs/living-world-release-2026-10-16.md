# Permanent standing and living communities: release checkpoint

Owner request, 16 October 2026: bring permanent reputation and shared projects to production, with NPCs pursuing activities independently and retaining their families and money. This integrates PR #25 and PR #31 with main `71eea2c0dc3557fd035913ab621a71be87278bc5`, preserving the newer destruction, repair, law, military, nature, graphics and loading work. Earlier checkpoints remain historical evidence; this document supersedes their branch-only implementation assumptions.

## What is implemented

- Permanent personal standing, authenticated soul recovery and durable deed receipts. Leaving, changing rooms, being arrested or waiting does not erase standing. The eight-second Quiet Well ritual beneath Gargantua is the normal reset; it does not erase possessions, projects or other people's history. Keep the private soul recovery key before changing devices or clearing browser data.
- Shared, region-scoped path, garden, gathering and music projects at discovered places. Proposals require confirmation, a five-second on-site survey and three real work/service contributions. A server clock then enforces at least 24 hours of construction, with alarms and visible stages. This is a supported construction cycle, not a promise to ship arbitrary code in one day.
- Known adults have saved daily activity, NPC-initiated family visits, participation and public history. Household visits recur during local daytime and can finish without a player. Hazardous or destroyed locations pause them. Joining reserves the opportunity; absence cannot silently complete it for the player. Physical deliveries and repairs still require the real source's completion evidence.
- First-observed family/member assignments survive local reload and streaming. The regional server retains the first registered household summary so later observations cannot replace it. The Story view and NPC context expose family responsibilities and activity.
- Existing household money plans and NPC-to-account links now persist across reload. Wages, pensions, rent, bills, food and dependent costs continue to determine the daily balance while away. Household profiles sync to the existing ledger even when no extra cash transaction occurred. Merchant exchanges have saved, once-only local payment receipts.
- Grounded bargaining and connected personal quest chapters are integrated with the current game. Dialogue proposes supported terms; explicit confirmation and actual source evidence govern trades and quest outcomes.

## Player entry points

Open the guide's **Story** tab. **Life around you** shows the area's recorded activity, family responsibilities and participation controls. Join a family visit and speak to its requester. **Community projects** lists discovered nearby sites and the survey/work controls. The Story standing section shows save mode and soul recovery controls. Private conversations stay private.

Local mode is explicitly labelled. Existing shared projects remain read-only when their server is unavailable; local work is not silently represented as shared completion.

## Deployment boundary

Frontend publication and Cloudflare deployment are separate. The release commit contains the rebuilt frontend and both tested Workers. At the read-only production check recorded in `verification/living-world-release-2026-10-16/production-capabilities.json`, rooms still lacked permanent reputation, living-world, project and household features. Discovery still lacked quest continuity, bargaining and project planning. Wrangler in the implementation workspace was not authenticated. No Worker deployment or live shared-world acceptance is claimed by this checkpoint.

From the owner's authenticated **Bard** checkout, after this branch is merged:

```sh
cd "$HOME/bard-worker-deploy"
git switch main
git pull --ff-only
node server/deploy-living-world.mjs --deploy
```

The helper verifies the Bard repository and the existing Worker names, installs their locked dependencies, runs tests and deployment dry-runs, deploys `l99-rooms` and `l99-discovery`, then checks public capabilities. It does not touch Oursite or create another Worker identity. The existing `l99-ledger` code is unchanged. Cloudflare runs deployed Workers after the terminal closes.

After deployment, run `node server/verify-workers.mjs`. Then use two independent browsers in the same world and region: observe the same project/participants, return after absence, verify a source-backed completion, restore a soul with its key, and check the ritual and actual model conversation. A capability flag alone is not this gameplay acceptance test.

## Verification and limits

- Full island Node suite: 950 tests, 947 pass. Three known main failures remain: packed RGB manifest/cache agreement, Svalbard flora and regional vegetation refresh in the Node DOM fixture. Those source/test files are unchanged by this release.
- Rooms: 105 existing assertions and 44 Node tests pass. Discovery: 117 assertions pass. Existing ledger: 3 tests pass.
- Household suite: 6 tests cover first-family retention, reload, corrupt-save preservation, daily account continuity, once-only payment, autonomous visits, player reservation, hazards, conversation attribution and profile-only synchronization.
- Real local workerd/SQLite: household integration 8 checks pass; project integration 25 and construction-clock/alarm 7 pass. The soul integration passes two-socket attribution, a new room/socket, the actual eight-second ritual, shared refresh and old-epoch rejection.
- Desktop and touch-emulated Guide/bargaining fixture passes with no page errors or overflow. Production terrain check passes actual site discovery, proposal, elapsed survey and visible construction markers. Reports identify controlled inputs and bundle hashes; they are automated local evidence, not human playtests.
- Both Worker dry-runs, the frontend build and focused unused/undefined-symbol lint pass. The final built bundle enters MAGMA 4242, TERRAN 77 and Earth 1337 and renders three frames in each without runtime/frame/shader errors; the report and bundle hash are recorded in this verification directory.

This is bounded simulation of registered people, not every unseen inhabitant in an infinite universe. Regional activity retains up to 128 actors/requests and catches up at most 24 hours per advance. Only supported abstract social activity can complete by time alone. Household demographic memory has a 4096-entry local ceiling and never evicts older identities to admit new ones. Births, marriages, inheritance and autonomous offscreen physical construction are not added here. Household records and summaries persist; this does not establish cross-device synchronization of every family animation or private journal. The inherited shared money service uses observed client events, not an authoritative, abuse-resistant universal trading engine; merchant inventory remains local.
