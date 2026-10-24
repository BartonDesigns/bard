# Twenty relics enter the world

## Finding them

Defeated enemy squads now roll bonus equipment independently of the weapon they were carrying. This covers hostile creatures, crawlers, drones and fighters killed by the player. Civilians, children, companions, crews and surrendered/disarmed people do not qualify. Ordinary weapon recovery remains unchanged.

- First eligible kill on fresh loot counters: rare-or-better gear.
- Normal rolls: 5% Legendary, 8% Masterwork, 25% Superior (the blue rare tier), 62% no bonus.
- Bad-luck protection: rare-or-better within five eligible kills and a named Legendary within twelve. Counters persist locally through reloads and world changes. Guarantees count generated drops, not pickups; unclaimed field loot is not saved across world visits.
- Look for blue, violet or gold columns above equipment. Approach and press **E** to take, **Shift+E** to equip, or use the touch buttons. Matching ammunition is included. Original carried weapons may lie beside the bonus item.
- Great bosses award one of these named relics in addition to their previous equipment and credits. If the inventory transaction fails, the new relic remains as a pickup near the player for this world visit. The pre-existing credit/legacy reward does not gain a retry ledger in this patch.

## The collection

Every relic has a stable inventory ID, individual damage/cadence/capacity, a fixed magic school, lore, school-colored inlays and procedural collar/crystal geometry. They use established firearm hand and reload rigs rather than twenty new bespoke rigs. All are Legendary quality and start at least at level 15, so their existing school infusion is active; further magic unlocks through normal progression. No new spell system is claimed.

| Relic | Family | School |
| --- | --- | --- |
| Sunbreak Testament | Rifle | Radiance |
| Black Tide | Scout rifle | Shadow |
| Stormglass Repeater | Repeater | Storm |
| Widow’s Meridian | Long rifle | Chrono |
| Orchard of Ashes | Scout rifle | Primal |
| Pilgrim’s Last Light | Rifle | Restoration |
| Event Horizon | Long rifle | Void |
| Copper Saint | Rifle | Warding |
| Moth King’s Lantern | Hybrid carbine | Umbral |
| Choir of Thorns | Crystal spellcaster | Blight |
| Dawn Engine | Hybrid carbine | Dawn |
| Winter Debt | Crystal spellcaster | Chrono |
| Cathedral of Sparks | Hybrid carbine | Storm |
| Gravesong Resonator | Crystal spellcaster | Shadow |
| Hearth of the Exile | Hybrid carbine | Restoration |
| Gargantua’s Whisper | Crystal spellcaster | Void |
| Wildfire Canticle | Hybrid carbine | Primal |
| Oathkeeper Lattice | Crystal spellcaster | Warding |
| Hollow Crown | Hybrid carbine | Umbral |
| First Morning | Crystal spellcaster | Radiance |

## Release boundaries

These are local PvE drops and ordinary saved inventory items. They are not newly generated shop stock. New IDs are included in the shared source catalog, but the multiplayer Worker must be redeployed before server-validated trading/PvP recognizes them; frontend publication does not deploy that Worker. No Worker credentials or deployment are changed here.

Pre-publication checks cover all twenty items firing/reloading, attunement, model geometry, pity boundaries, pickup/save/reload/equip, duplicate protection and existing inventory/loot rules, plus the engine build. The full engine suite is run after publication per the owner's release preference; final results and production byte checks belong in the PR. Browser/physical-device visual testing remains unverified in this environment.
