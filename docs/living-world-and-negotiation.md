# Living citizens and conversational bargaining

Work checkpoint: 14 October 2026. Branch `codex/living-world-negotiation` integrates main `b05ea02` (the merged economy, named businesses, payroll, military polish and building repair work) with the persistent reputation and connected-quest work from PR #25, head `3f8e663`. It preserves both histories and does not change Claude's branches. Unpushed edits in another editor are not available to this checkout.

## What players can do

Open the Guide's **Story → Life around you**. Discovered requests show who is involved, the place, current work, reasons for delays and a recent public history. Players can join, contact or mark participants, advance their own ordered objectives, leave supported activities, and propose prioritizing, deferring or resuming work. The citizen can agree or refuse; accepted scheduling choices change the work schedule. Completed helper work requires a participating player's acknowledgment and does not become that player's service-discount credit.

The journal observes actual adult citizens, nearby business requests and existing physical NPC scenes. The shared people pool covers Earth and other inhabited worlds; named Moon crew also contribute their authored identities and observed work/home anchors without replacing their movement or colony errands. A small daily check-in rule connects real nearby adults at known sites. Their public activity facts inform conversation. Existing per-NPC conversations and the searchable archive remain separate.

Approach a shop's actual attendant and ask naturally for a price, a better deal, a reputation discount, or work in exchange for a lower price. The classifier proposes a supported intent; inventory and source rules decide the offer. "What would I need to do to get this for 20?" can produce a service-backed deal only when that merchant has suitable real work and sufficient value. A large discount is not guaranteed. Unsupported items, invented property rights and nonexistent jobs cannot be sold by prose. Spoken agreement opens review; **explicit confirmation** reserves the deal, and a separate exchange action redeems it after the conditions are met.

## Persistence and simulation

`living-world-core.js` is a pure, versioned reducer. The browser adapter records observed requests and scene outcomes, saves progress, and scopes it by body and region. Player claims survive leaving, reload and offline play. Delayed actions are rejected after travel or Soul identity changes. Unreadable saves are retained rather than overwritten. Terminal local requests are archived with replay tombstones when the active view fills.

The rooms Worker's new `LivingRegion` SQLite Durable Object stores the shared regional journal independently of temporary rooms. It authenticates the existing private Soul capability and derives a public regional traveller ID. Operation receipts, claims and history are durable; old history can be paginated. No private NPC dialogue or Soul key is published as activity text.

Known NPC intentions advance in five-minute steps, including alarms while players are away. Catch-up is limited to 24 hours per advance and explicitly records omitted unobserved time. With no actionable work the region sleeps and routines update when visited. Each region supports 128 registered citizens and 128 active/unresolved requests; terminal jobs are archived. This is a bounded simulation of discovered people, not continuous physics for an infinite unseen population or cross-region population migration.

Only explicitly social check-ins/conversations/observations may complete abstractly while absent. Such history is labelled simulated and creates no assets or rewards. Physical deliveries, repairs and other jobs wait for their source. Existing rendered NPC scenes can submit client-observed completion; a player's delivery requires ordered location/pickup/delivery steps, and work waits require 30 seconds of active presence. Unsupported physical `fix` or `chase` steps remain pending until their actual gameplay adapter confirms them. Text claims alone cannot complete them.

Earthquakes/cataclysm state, nearby damaged structures and unavailable citizens pause work. Fresh observations clear persistent site blocks; the existing structure system continues to own destruction and repair crews. This journal does not rebuild a building, construct a coastal path, spend civic funds or transfer land ownership. A persuasion choice can reschedule supported work; physical infrastructure proposals still need a construction/ownership adapter.

## Bargaining and ownership

Negotiation uses the existing real item catalog and arms inventory, named businesses and assigned staff, actual service requests, trust and reputation. Offers include seller, body, item instance, stock revision, price, terms and expiry. The player must be close enough and on the correct floor; unsafe shops cannot trade.

Normal purchases and negotiated purchases share the same finite daily stock. Confirmation reserves the exact item. Service discounts bind a real request, its beneficiary, completion receipt, agreement and reward mode; that work cannot also pay its original cash reward or count twice. Cancelling a service agreement restores the original cash terms once. Item/payment application uses saved transaction receipts and recovery; a failed merchant-ledger save remains pending and retries without charging the player again. Completed player business work records its authored reputation deed with a stable source receipt.

**Merchant stock, agreements, inventory and the wallet remain device-scoped**, matching the current economy. The bank's existing settlement mechanism is preserved. This work does not introduce universal escrow, shared merchant scarcity, account-backed assets, arbitrary property sales or universally replicated construction. Shared regional claims coordinate participation; client-observed physical evidence is labelled as such and is not independent server proof of geometry. Recovering a Soul does not migrate the device's inventory.

Tangible persistent world development remains the reward direction. The inherited quest chapters can leave visible local route markers and relationships, while old credit rewards remain compatible. Roughly one-day propagation of future shared world projects remains a design requirement; it is not a promise of arbitrary requested code shipping within a day.

## Release status and verification

The frontend bundle builds. Automated checks cover the reducer, runtime, reservations, emergency pause, delayed cross-world/identity actions, save recovery, ownership, source receipts, discounts, duplicate rewards, merchant settlement and existing economy/military/structure/quest behaviour. Desktop and 390×844 touch-emulated Guide fixtures cover model paraphrases, consent, stale offers, missing evidence, once-only exchanges and layout. The production engine fixture completes all three relationship chapters and renders a persistent route marker. Evidence is in `docs/verification/living-world/`.

These are automated fixtures with controlled model proposals and, where needed, positioned physical evidence. They are not live-model quality tests, physical-phone/Safari tests or production multi-player acceptance. Local workerd/SQLite checks exercise two authenticated identities, concurrent operations, persistence, history and isolated bodies. Worker dry-runs bundle code only.

The read-only production check on 14 October 2026 found:

| Service | Existing live capability | Missing for this build |
| --- | --- | --- |
| Discovery | `social_intent`, `story_quest` | `negotiation_intent`, `quest-continuity-v1`, `negotiation-intent-v1` |
| Rooms | `trade-v2`, `combat-v1`, `combat-guard-v1` | `reputation-v1`, `persistent-reputation-v1`, `living-world-v1` |

The existing Workers are reachable, but these new capabilities are **not live**. Wrangler in this workspace reports no authenticated account. No production deployment or credential changes were performed. Older Workers leave the browser in an explicitly labelled local mode rather than claiming shared persistence.

After merging, deploy from the separate **Bard** checkout, never the corporate Oursite directory:

```sh
cd "$HOME/bard-worker-deploy"
git switch main
git pull --ff-only
npm --prefix server/multiplayer ci
npm --prefix server/multiplayer test
npm --prefix server/multiplayer run deploy
npm --prefix server/discovery ci
npm --prefix server/discovery test
npm --prefix server/discovery run deploy
node server/verify-workers.mjs
```

Use the already authorized Cloudflare account; if that terminal is not authenticated, complete Wrangler's normal login there. Rooms retains its original migration and adds `v2-souls` and `v3-living-regions`. Discovery adds the negotiation planner. Publish the frontend through the repository's normal hosting flow separately. Once deployment succeeds, the terminal window can close; Cloudflare runs the deployed Workers and alarms independently.

Before calling this fully live, verify the capability check and use two independent clients in the same region: observe the same activity, reserve it on one client, confirm the other cannot steal it, leave and return, complete a real source-backed objective, and verify its shared history. Repeat after planet travel and Soul recovery. Test a real shop's bargain, cancellation, service completion and once-only exchange. Check a destroyed workplace pauses and resumes after the actual repair system clears it. Review genuine LLM phrasing and phone performance before widening release claims.
