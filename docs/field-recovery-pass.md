# Fallen-fighter equipment recovery

The acquisition gap was real: squad deaths hid their held models and removed bodies after twelve seconds, with no equipment transfer. This pass connects production squad deaths to visible, collectible weapons and the existing saved inventory.

## Player flow

Approach the weapon beside a fallen armed fighter and look toward it. Within 3.4 metres, the recovery card shows its named variant, quality, level, combat damage, range, magazine, included ammunition and damage difference from the held weapon. Press **E** to take it or **Shift+E** to take and equip. Touch has separate **Take** and **Take & equip** buttons. Both preserve existing inventory; ordinary Take leaves the current hand unchanged.

The fighter's actual displayed weapon level and tier are copied at spawn, including pooled NPC bodies. Recovery grants that weapon plus one matching ammunition pack. It uses one atomic, idempotent inventory transaction and saves through the existing arms repository. Failed transactions leave the drop available. Selection and collection check distance and walls, and collection rechecks facing. Recovery is unavailable in menus, trades, while typing, flying, swimming, driving or knocked out. The visible prompt consumes E before other world interactions.

Drops use the existing detailed weapon models with a restrained quality-coloured floor marker. The most recent twelve nearby bodies can remain for sixty seconds; equipment remains after bodies fade. At most 32 drops are retained on desktop and 16 with touch controls. Old drops expire after ten minutes only when more than forty metres away. Oldest drops are evicted at capacity. Unclaimed drops clear when leaving the world or reloading the page. Collected gear persists. This is local encounter loot, not synchronized shared-world loot.

Gear now explains recovery and combining. Existing acquisition paths remain: buy from nearby shops, combine matching same-quality items into a higher rank, upgrade levels at outfitters, and earn existing boss rewards. Ordinary squad equipment currently spans Common through Superior; Masterwork comes through combining, and Legendary through combining or existing boss rewards.

## Verification

- `node --test island/tools/loot.test.mjs island/tools/combat.test.mjs island/tools/arms.test.mjs island/tools/bow-controls.test.mjs`: 36 passing tests. Recovery exercises all twenty armament/rank combinations, save/load, duplicates, failed transaction retry, range/walls/facing, exclusions, lifetime and capacity.
- `loot-preview.mjs` runs production combat, squad spawning and death, Rapier ragdolls, recovery UI and saved inventory on flat fixture terrain. `loot-browser.cjs` checks desktop keyboard and emulated phone taps, actual fallen body, exact loadout, take/equip, retained prior gear, reload persistence, busy state, trade lock, range, facing and input ownership. Reports and screenshots are in `docs/verification/field-recovery/`.
- Production build and whitespace checks pass. Software WebGL verifies shaders and UI operation, not real-device frame time or a full-world performance sign-off.

## Further work toward the requested quality

1. Authored encounter progression: distinct enemy roles, readable faction equipment and elite ranks, clear danger/reward signals, patrols and varied objectives.
2. Broader acquisition: discoverable weapon caches, mission rewards, shop directions and a reliable first-weapon onboarding path; balance ammunition, credits, upgrades and duplicate drops through playtests.
3. Physical interaction polish: weapon drop motion, pickup hand animation, settled-body gear placement, layered pickup/reload/impact audio and stronger enemy hit/cover transitions.
4. Richer equipment choices: attachments with gameplay tradeoffs, accurate comparisons beyond raw damage, inspect animations and a complete material/detail pass for remaining utilities.
5. World and production finish: ground-to-flight continuity, meaningful planet destinations, full-world mobile profiling, long-session/save recovery tests and authoritative shared loot after the rooms backend is deployed.

These are remaining work, not features delivered by this pass. Higher polygon counts alone do not establish AAA quality.
