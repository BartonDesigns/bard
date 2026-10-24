# BARD — The Relic Armory

Twenty weapon concepts, eight legendary armor pieces, and four boss reward families. October 24, 2026.

## What this implementation changes

- Ordinary player-credited hostile kills can drop armor: half of Superior/Masterwork bonus rewards and 35% of Legendary bonus rewards. Base rarity bands remain 5% Legendary, 8% Masterwork, 25% Superior, with existing pity guarantees (rare within five, legendary within twelve qualifying kills). These guarantees are for gear, not a particular item or armor slot.
- Each of the four bosses grants one weapon from its two-item family **and** one of its two armor pieces, in addition to its older reward. These families also remain eligible as rare world drops, not boss-exclusive items.
- Armor uses the same atomic pickup/save path as weapons, with no ammunition attached. Take & equip wears the correct slot; existing gear remains in the bag. Ground armor has an owned, disposable low-poly prop and rarity marker.
- Legendary armor begins at level 15 or higher with a fixed school and existing level-15 spell alteration active. It does not automatically teach unknown spells. Two pieces of the same school do not double the alteration.
- All twenty weapons now have separate geometry builders. Hand/reload rigs and ammo families remain shared for compatibility. Low/high geometry is tested for finite values, distinct fingerprints, and a 20,000-triangle ceiling.

## Boss families

| Boss | Weapon pool (one per victory) | Armor pool (one per victory) | Visual / magical relationship |
| --- | --- | --- | --- |
| Lumen Leviathan | First Morning; Winter Debt | Lumencrest Circlet; Gallery Scale Mail | Crystal crest, prisms and teeth; Radiance armor splits Sunspark into three |
| Cinder Colossus | Orchard of Ashes; Wildfire Canticle | Cinder Core Cuirass; Ashwalker Greaves | Charred metal, ember cores; Primal armor makes Cinder leave burning ground |
| Stormwarden | Stormglass Repeater; Cathedral of Sparks | Stormwarden Flightcoat; Stormwarden Gauntlets | Swept fins and induction contacts; Storm armor extends Chain Lightning |
| Fog Mother | Black Tide; Gravesong Resonator | Fog Mother's Veil; Drowned Procession Boots | Salt-worn cloth, bridge-red seams and resonators; Shadow armor adds cloak after Shadowstep |

## Weapon concept gallery

These are **generated art-direction concepts, not game screenshots**. The procedural implementation is an initial silhouette/material pass, not the fine carved, painted, and cloth detail visible in these images. Armor currently uses themed adaptations of existing wearable shapes; bespoke armor meshes are still a fidelity follow-up. Browser/device visual QA has not been completed in this environment.

| Weapon | Concept | Design target |
| --- | --- | --- |
| Sunbreak Testament | [Image](images/relic-concepts/sunbreak-testament.png) | A long asymmetrical lighthouse rifle: crescent-shaped hollow brass shoulder stock, straight slim barrel sheltered by THREE stepped lighthouse buttresses, a broad sunrise fan sight, worn ivory grips. Strong long horizontal silhouette with a crescent cutout at rear. Radiance school, warm gold light. |
| Black Tide | [Image](images/relic-concepts/black-tide.png) | A fictional harpoon-like scout rifle carved from salt-black driftwood, a deep hooked whale-tail shoulder stock, single long angular steel prow emitter, knotted rope bindings and small blue-green sea glass. Sleek downward-hooked silhouette, no generic assault-rifle receiver. Shadow school, inky violet glints. |
| Stormglass Repeater | [Image](images/relic-concepts/stormglass-repeater.png) | A storm-powered tuning-fork repeater with TWO very long parallel open metal prongs, an exposed luminous cyan glass bridge suspended BETWEEN them, compact ring-shaped rear grip and battered blue ceramic insulators. Stark forked negative-space silhouette. Storm school. |
| Widow’s Meridian | [Image](images/relic-concepts/widows-meridian.png) | A very long clockmaker rifle with a slim off-center brass spine, THREE exposed circular clockwork discs decreasing in size toward its needle-thin muzzle, a teardrop ebony shoulder rest and trailing short mourning ribbon. Side profile defined by stacked clock discs rather than a tactical receiver. Chrono school, lavender. |
| Orchard of Ashes | [Image](images/relic-concepts/orchard-of-ashes.png) | An organic rifle grown from one heavily charred twisting branch, upward split-branch fork at front cradling an ember-red seed pod, smooth polished burl shoulder stock with a distinctive root curl, blackened iron bands. Asymmetrical branch silhouette, no modern tactical parts. Primal school. |
| Pilgrim’s Last Light | [Image](images/relic-concepts/pilgrims-last-light.png) | A travelling healer's folded shrine-rifle: long cream ceramic rectangular reliquary with THREE little warm light windows, aged brass carrying arch high above, leather-wrapped slender grip, a gently curved shepherd-hook butt. Mint glass at front; repair stitches on travelling leather. Restoration school. Distinct arched top silhouette. |
| Event Horizon | [Image](images/relic-concepts/event-horizon.png) | A long-range black gravity projector, not a conventional rifle: giant near-circular tilted obsidian halo at front, empty black center, narrow long graphite spine into a forked tail stock, a single gold index line and tiny violet seams. Huge ring versus thin rear silhouette. Void school. Restraint, no greeble clutter. |
| Copper Saint | [Image](images/relic-concepts/copper-saint.png) | A compact defensive firearm built behind a broad pointed copper kite-shield at front, small horizontal aperture, squared walnut rear support, leather palm grip, hammered rivets and hand-engraved names. Broad shield-forward silhouette, practical and worn. Warding school, verdigris. |
| Moth King’s Lantern | [Image](images/relic-concepts/moth-kings-lantern.png) | A handheld arcane launcher shaped like an antique lantern suspended inside TWO tall moth-wing metal arches, short rear handle, luminous dusty-violet pearl inside pierced brass cage, black silk tassel. Tall butterfly-wing silhouette, NOT a rifle wearing wings. Umbral school. |
| Choir of Thorns | [Image](images/relic-concepts/choir-of-thorns.png) | A two-handed spellcaster made of THREE interlocking thornwood hoops that form an open curved horn around a suspended green seed crystal; crooked wooden handle and wrapped rear handhold; little bronze chime teeth. A hollow curling thorn crown silhouette, no gun body or barrel. Blight school. |
| Dawn Engine | [Image](images/relic-concepts/dawn-engine.png) | An arcane accelerator resembling a handheld sunwheel: one large vertical radial brass wheel at front, scalloped sun rays, narrow horizontal lever grip and short asymmetric counterweight at rear, scratched ochre enamel. Wheel dominates profile, visible empty spokes. Dawn school, peach-gold light. |
| Winter Debt | [Image](images/relic-concepts/winter-debt.png) | A glacial trident spellcaster with THREE unequal long icy prongs projecting horizontally, silver binding yoke around dark frozen central gem, angular white-birch rear handhold, thin dangling ledger tags. Very long jagged icicle silhouette, no rifle housing. Chrono school, pale cyan. |
| Cathedral of Sparks | [Image](images/relic-concepts/cathedral-of-sparks.png) | A portable thunder organ weapon: FIVE upright oxidized brass organ pipes at different heights on a compact ebony soundbox, two-handed grips, blue ceramic resonance nodes, tiny cathedral tracery. Wide upright organ-pipe silhouette, not a conventional gun. Storm school. |
| Gravesong Resonator | [Image](images/relic-concepts/gravesong-resonator.png) | A macabre acoustic spellcaster: TWO long curving bone-white tuning tines joined to a black oval resonator, short dark wrapped handle, three little pewter bells hanging inside the opening. An elongated U-shaped fork with a hollow oval at rear, asymmetrical carved burial marks. Shadow school, muted lilac. |
| Hearth of the Exile | [Image](images/relic-concepts/hearth-of-the-exile.png) | A compact travelling hearth weapon, a squat faceted bronze brazier with an arched protective handle above, THREE low chimney vents, green warm flame behind amber windows, leather two-hand braces. Strong lantern-pot silhouette, homely worn craft, no rifle parts. Restoration school. |
| Gargantua’s Whisper | [Image](images/relic-concepts/gargantuas-whisper.png) | An alien ritual focus: one massive split obsidian crescent holds a floating rough black island-stone in its empty center, thin inverted brass crescent grip beneath, TWO short uneven antenna-like stone slivers behind. Minimal sculptural crescent silhouette, tiny violet gravitational arcs. Void school. |
| Wildfire Canticle | [Image](images/relic-concepts/wildfire-canticle.png) | An incendiary musical hybrid weapon built like a short brass horn with a VERY wide flared bell, spiral copper tube coil around a black ceramic furnace, long worn wood palm grip, red heat scars. Bell-and-coil silhouette unmistakably different from all rifles. Primal school. |
| Oathkeeper Lattice | [Image](images/relic-concepts/oathkeeper-lattice.png) | A ward-projecting crystalline lattice weapon: open elongated diamond frame with crisscross silver bars, turquoise panes in only some cells, compact leather double-hand grip at one end, four angular corner prongs. Rectilinear transparent kite silhouette with negative space. Warding school. |
| Hollow Crown | [Image](images/relic-concepts/hollow-crown.png) | An umbral crown-launcher: FIVE tall broken black-metal crown points forming a wide open semicircle around a hollow violet ring, compact short handle below and rear brace, one small cracked gold king's seal. Regal jagged fan silhouette, no rifle chassis. Umbral school. |
| First Morning | [Image](images/relic-concepts/first-morning.png) | A radiant prism projector: THREE nested fan-shaped ivory-and-gold sunrise vanes spread around a thick triangular glass prism, long gracefully curved gold lower grip, asymmetrical small rear counterweight. Layered fan and triangular prism silhouette. Radiance school, champagne light. |

## Armor concept gallery

- [Lumencrest Circlet + Gallery Scale Mail](images/relic-concepts/lumen-armor.png)
- [Cinder Core Cuirass + Ashwalker Greaves](images/relic-concepts/cinder-armor.png)
- [Stormwarden Flightcoat + Stormwarden Gauntlets](images/relic-concepts/stormwarden-armor.png)
- [Fog Mother's Veil + Drowned Procession Boots](images/relic-concepts/fogmother-armor.png)

## Verification / remaining boundaries

Focused loot, inventory migration, magic and geometry checks pass. Full suite results and publication proof are recorded on the release PR after publication. Local pickup persistence is not a claim of authoritative shared-cloud inventory. No Worker deployment is performed here; live multiplayer catalog support for these IDs requires an authorized deployment of the updated Worker. Frontend publication and Worker publication must be verified independently.

Art was generated with the built-in image-generation tool. The exact shared weapon style prompt, per-weapon prompts, boss direction and armor design subjects are retained in [the prompt manifest](relic-art-direction-2026-10-24.json). Images are documentation-only: they are not preloaded into gameplay or allocated as GPU textures.
