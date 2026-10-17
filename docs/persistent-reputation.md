# Persistent reputation and the Quiet Well

Owner direction, 13 October 2026 Pacific: reputation never clears with time; releasing it requires cleansing the player's soul in a tunnel beneath Gargantua's island.

## What this changes

The existing four-axis compass is now backed by a personal Durable Object, separate from multiplayer rooms. Mercy, law, protection, honesty, world/place totals and the lifetime deed count have no time-to-live. Leaving a room, ending it, changing socket identity, dying, travelling or reloading does not clear this standing. Good deeds can change how people regard you; waiting cannot. Claude's NPC dispositions, autonomous quests, regional tallies, money adapter and street work are preserved. Regional society can still change over time independently of the player's reputation.

All newly accepted deeds have permanent, deduplicated server receipts. The recent display holds 200 entries; pruning that display never removes a receipt or changes accumulated standing. Existing saved compass totals and recent history migrate once. History already removed by older builds cannot be reconstructed. Completed conversation quests also record a favour with a stable quest receipt.

Large place/world snapshots are stored in transactional chunks rather than truncating history at a storage-value limit. A 600-new-deeds-per-minute soul budget limits bursts; delayed deeds remain in the client's outbox and duplicate receipts do not consume the budget.

A private 256-bit recovery key identifies a soul. The server hashes it to address storage; public room messages never include the key, conversations, quest prose or the personal journal. Room sockets bind their public standing by proving possession of this key, rather than trusting a player name or transient room ID. Nearby NPC context distinguishes another player's reputation from your own. Local personal reputation informs conversation even outside a room.

The browser saves each pending deed separately so two tabs do not overwrite one another's outboxes. Offline play remains possible. Sync deduplicates retries and applies the server snapshot plus unsent deeds; an old cleansing epoch cannot restore old guilt. Story reports local/cloud save status and provides **Save soul recovery key** and **Restore a saved soul**. Save the key privately before clearing browser data or moving devices. Without the key there is no account recovery mechanism. Storage failure is shown, not described as a successful save.

## The place and the action

Open space navigation and choose **Gargantua’s island**. It is the authored singularity world with seed 2281969. Follow **Soul tunnel**, walk through the hillside mouth and continue to **The Quiet Well**. The 400 m passage and chamber are added to the existing signed-distance cave field, using its streaming rock, lighting, terrain openings and walking collision. There is no separate cave scene or cave loading screen. Existing space navigation and the Held Note remain available.

At the well, select **Cleanse your soul**, read the consequences, then begin. Remain in reach for eight seconds. Walking away cancels. The server requires the canonical world/type, proximity, underground elevation and its own elapsed time. It rejects surface use, other worlds, early/expired challenges and arbitrary reset requests.

Cleansing starts a new reputation epoch and clears both good and harmful personal standing, including place/world reputation and reputation-driven bounty. It preserves possessions, bank/quest progress, conversation archives, independent NPC/region history and tangible world changes. The server retains old deed receipts and a cleansing receipt for audit; they no longer influence current reputation. Old room reports and witness memories stop affecting the cleansed player's standing. Immediate police pursuit and present danger are separate gameplay systems, not a reputation deletion mechanism.

## Authority and boundaries

This is durable, authenticated reputation for an account-free, client-simulated game. The server owns the saved ledger, scoring table, receipts, clock and cleansing epochs. It does not run the full world simulation: it cannot independently prove every offline deed or prevent a modified client from lying about its own simulated position. Possessing a recovery key grants control of that soul. Do not share it as an invitation code. Persistent world projects shared universally remain a separate build request.

## Release and deployment

Initially built on main `1995d17324ceb43f1842e026fe017da6a8d2ae67`, including the latest merged street and NPC work. At inspection both pushed `claude/*` branches were already contained in main; unpushed edits are unavailable. This work uses its own feature branch and does not rewrite another contributor's branch.

Frontend build and Worker deployment are separate. The new rooms migration adds SQLite Durable Object class `Soul`, binding `SOULS`, while retaining the existing `Room` binding/migration. No Discovery deployment was needed for the original reputation-only slice. The subsequent immersion work on this branch **does** need Discovery deployment; see `quest-immersion.md` for the combined release steps. The capability is **persistent-reputation-v1**. Until that Worker is deployed, the client retains local standing and queued deeds and cannot perform an authoritative cleansing.

From the Bard checkout after this change is merged:

```sh
cd "$HOME/bard-worker-deploy" &&
git switch main &&
git pull --ff-only &&
npm --prefix server/multiplayer ci &&
npm --prefix server/multiplayer run deploy &&
node server/verify-workers.mjs
```

The commands above deploy the reputation-only backend. For the full branch, follow the combined release in `quest-immersion.md`. The verifier must show rooms ready, including `reputation-v1` and `persistent-reputation-v1`. A deployed capability flag alone is not a production gameplay acceptance test. Use two independent clients: earn a deed, observe correctly attributed standing in a room, end the room, restore/join another room, reload, then complete the Quiet Well ritual and confirm both clients receive the new epoch. Existing credentials are not modified by this change.

## Verification

- `node --test island/tools/persistent-reputation.test.mjs`: offline/reload, recovery, two-tab merging, failure retention, NPC attribution and the authored cave field at phone/desktop resolutions.
- `npm --prefix server/multiplayer test`: existing room, trade/combat and reputation regressions plus permanent receipts, reconstruction, migration, concurrent retries, CORS/authentication, wrong-place/early/expired cleansing and stale-epoch rejection.
- `node server/multiplayer/test/soul-integration.test.mjs` against a local Worker: real workerd storage, two sockets, authenticated public standing, end/new room with a new socket identity, real eight-second ritual and shared cleansing update. This script refuses production URLs.
- `node island/tools/npc-morality.test.mjs`: Claude's dispositions, regions, quests, money and theft semantics.
- `node island/tools/soul-browser.cjs`: production bundle, actual player collision, cave render, Story copy and touch cleansing controls. Uses the standalone engine page because this sandbox's single-process Chromium crashes on the full faceplate page; this is not a full-site release smoke or physical Safari certification.
- `npm --prefix island run build` and `npm --prefix server/multiplayer run check`.

Recorded results and remaining release gates are in `docs/verification/persistent-reputation/`. No production Worker deployment is claimed by these local checks.
