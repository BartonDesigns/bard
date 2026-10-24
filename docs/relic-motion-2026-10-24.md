# BARD — relics that remember how to move

## 24 October 2026: implementation and reference handoff

Twenty weapons and eight armor pieces have their own visual animation, following a completed wraparound art pass. The 24 sheets cover each weapon individually and the armor in four matching pairs. Existing concept artwork is preserved. These are external appearance and motion guides, not UV textures or in-game captures; generated views can contain interpretive differences and are not exact mesh blueprints.

The runtime is a lightweight procedural interpretation of these designs, not a pixel-for-pixel reproduction of the highly detailed illustrations. This pass adds moving motifs to existing models; it does not silently replace every garment with a newly sculpted high-poly mesh. Effects are cosmetic: existing boss provenance, rarity rules, school spells, damage and armor statistics remain unchanged.

## Every relic has a separate visual verb

| Relic | Animation | Wraparound reference |
| --- | --- | --- |
| Sunbreak Testament | Three lighthouse beacons sweep in staggered phases. | [Four views + motion](images/relic-turnarounds/sunbreak-testament.png) |
| Black Tide | Salt ribbons sway in an invisible returning tide. | [Four views + motion](images/relic-turnarounds/black-tide.png) |
| Stormglass Repeater | A contained arc crawls between the tuning forks. | [Four views + motion](images/relic-turnarounds/stormglass-repeater.png) |
| Widow’s Meridian | Three clock hands slip backward on different schedules. | [Four views + motion](images/relic-turnarounds/widows-meridian.png) |
| Orchard of Ashes | Charred seed petals unfold around a breathing ember. | [Four views + motion](images/relic-turnarounds/orchard-of-ashes.png) |
| Pilgrim’s Last Light | A hanging sanctuary lantern swings beneath its arch. | [Four views + motion](images/relic-turnarounds/pilgrims-last-light.png) |
| Event Horizon | Violet accretion spirals inward against a counter-turning halo. | [Four views + motion](images/relic-turnarounds/event-horizon.png) |
| Copper Saint | Protective copper seams expand into a shield outline. | [Four views + motion](images/relic-turnarounds/copper-saint.png) |
| Moth King’s Lantern | A spectral moth flutters around the lantern. | [Four views + motion](images/relic-turnarounds/moth-kings-lantern.png) |
| Choir of Thorns | Thorn chimes answer each other in a traveling wave. | [Four views + motion](images/relic-turnarounds/choir-of-thorns.png) |
| Dawn Engine | A geared sunwheel turns around its luminous axle. | [Four views + motion](images/relic-turnarounds/dawn-engine.png) |
| Winter Debt | Suspended ice shards pause, then retrace their orbit. | [Four views + motion](images/relic-turnarounds/winter-debt.png) |
| Cathedral of Sparks | Five organ pipes charge in a rising sequence. | [Four views + motion](images/relic-turnarounds/cathedral-of-sparks.png) |
| Gravesong Resonator | Funeral bells swing in alternating pendulum rhythms. | [Four views + motion](images/relic-turnarounds/gravesong-resonator.png) |
| Hearth of the Exile | Green hearth flames breathe and bend in three vents. | [Four views + motion](images/relic-turnarounds/hearth-of-the-exile.png) |
| Gargantua’s Whisper | Broken island fragments orbit an impossible stone. | [Four views + motion](images/relic-turnarounds/gargantuas-whisper.png) |
| Wildfire Canticle | Ember pressure corkscrews forward toward the horn. | [Four views + motion](images/relic-turnarounds/wildfire-canticle.png) |
| Oathkeeper Lattice | Crystal ward panes fold into alignment one by one. | [Four views + motion](images/relic-turnarounds/oathkeeper-lattice.png) |
| Hollow Crown | Five broken crown tips levitate independently. | [Four views + motion](images/relic-turnarounds/hollow-crown.png) |
| First Morning | A watchful slit-pupil eye glances, rests and occasionally blinks. | [Four views + motion](images/relic-turnarounds/first-morning.png) |
| Lumencrest Circlet | Crystal rays sweep around a quiet prismatic crest. | [Four views + motion](images/relic-turnarounds/lumen-armor.png) |
| Gallery Scale Mail | A descending caustic wave ripples across crystal scales. | [Four views + motion](images/relic-turnarounds/lumen-armor.png) |
| Cinder Core Cuirass | Reactor shutters breathe around the living furnace. | [Four views + motion](images/relic-turnarounds/cinder-armor.png) |
| Ashwalker Greaves | Heat travels downward through the greave seams. | [Four views + motion](images/relic-turnarounds/cinder-armor.png) |
| Stormwarden Flightcoat | Armored flight vanes open and settle like gills. | [Four views + motion](images/relic-turnarounds/stormwarden-armor.png) |
| Stormwarden Gauntlets | Charge crawls across the knuckle conductors. | [Four views + motion](images/relic-turnarounds/stormwarden-armor.png) |
| Fog Mother’s Veil | Mourning threads drift and curl in a private fog. | [Four views + motion](images/relic-turnarounds/fogmother-armor.png) |
| Drowned Procession Boots | Remembered footfalls send out alternating tide rings. | [Four views + motion](images/relic-turnarounds/fogmother-armor.png) |

## Where it works

- Weapon rigs animate in first-person and third-person hands, inventory inspection and nearby ground loot. Firing gives a bounded local charge response; it never changes another copy's state.
- Armor motifs follow the actual head, chest, shin, wrist or foot bones. Wardrobe serialization keeps existing codes intact and reproduces the motif on remote avatars. Armor ground pickups and inventory turntables now animate too. The inventory armor preview is a pickup-sized representation, not a full dressed avatar.
- First Morning has left/right glances with resting intervals and a complete brief blink about every 8.7 seconds. Event Horizon has two-sided accretion shading and counter-turning tilted rings.
- Reduced-motion preference freezes ambient relic motion and stops automatic inventory rotation; manual rotation remains available.

## Performance and lifetime

Each effect uses at most six mesh draws and 1,400 triangles (the tests enforce the ceilings); complete weapon models remain below 20,000 triangles. Low LOD keeps the defining effect with reduced geometry. Named relics replace the old generic mote cloud, rather than stacking on top of it. No new lights, downloaded textures, particle systems, timers, or per-frame geometry/material allocation are added. Each rig owns and releases its resources on item swap, loot removal, inspection close, redress and body disposal. Existing shared weapon geometry is never released by a private rig.

Ground effects are visible/updated only within 10 m on touch devices or 18 m otherwise. Worn armor motifs are hidden beyond 18 m. This bounds nearby detail but is not a claim of measured frame-rate improvement.

## Validation and release boundary

Before publication: 36 focused tests pass (seven new motion tests plus existing loot, equipment, spell and migration checks); production bundle builds. Tests cover all 28 rigs at both LODs, finite bounded transforms, stable resource identities, independent instance state, blink/gaze timing, reduced motion, repeated disposal, wardrobe round-trip, bone attachment and 24-sheet coverage.

Visual GPU playtesting remains unverified: the available browser previously failed to initialize Bard's 3D renderer even with lighter graphics. Do not present these generated sheets or CPU geometry checks as live-game screenshots or a verified mobile frame-time run. Full regression results and Pages publication evidence belong in the release PR after publication.

Frontend-only change. No Cloudflare Worker deployment, credential changes or new trade/PvP capability claim. The prior Worker deployment requirement for newer legendary item IDs remains separate.

## In-game acceptance pass

1. Inspect Event Horizon from both sides; verify the inward violet swirl and opposite ring motion. Equip, fire, swap away and back.
2. Inspect First Morning for at least 12 seconds; observe resting gaze, left/right movement and a full blink with no eye visible through the closed lid.
3. Inspect all 20 weapons and eight armor pieces; compare each motion to the table, including a low-detail remote model.
4. Defeat a boss, collect its themed weapon and armor, equip the armor, and inspect the matching motif on a second player's avatar. Reload and confirm ownership/wardrobe persist. Updated server capability is still required for server-governed interactions with these IDs.
5. Drop/collect gear repeatedly, reopen inspection repeatedly, change clothes and move between regions. Check GPU resource counts settle rather than grow.
6. On mobile and desktop enable reduced motion, verify stationary effects, rotate manually, and test restoration after backgrounding the browser. Record device, frame times and graphics errors honestly.

## Art provenance

Generated with the built-in image-generation tool using the approved concept images as references. All final prompts and source/output paths are retained in [the prompt manifest](relic-turnaround-prompts-2026-10-24.json). Original concepts are untouched; the new sheets live under `docs/images/relic-turnarounds/`.

