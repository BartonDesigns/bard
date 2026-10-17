# Spells in your statistics, garments, and gear that wakes (October 17, 2026)

The owner asked for:
- the spell logic integrated into the player's statistics, with specific attributes;
- clothing and weapons with higher levels;
- levels that grant magical buffs for particular spells, and that augment and alter how things work;
- then (the same day): level 99, and endgame tasks to reach level 100, for you and for gear alike.

This builds on the spells and the skills menu ([spells-and-controls-2026-10-16.md](spells-and-controls-2026-10-16.md),
[skills-and-magic-menu-2026-10-16.md](skills-and-magic-menu-2026-10-16.md)). The spells reached main in PR #60.
The skills menu has not, so this branch carries it, with main merged in.

## What changed, in a line each

- **Level 99, then 100★** ([below](#level-99-and-the-hundredth)): experience takes you, and every weapon and
  garment, to 99. The hundredth is earned: yours by seven trials and a rite at an aether well, an item's by a
  trial of its own.
- **Gear goes to level 99** (was 10). Growth is the same 7% a level up to 10, then 5% a level to 20, then ever
  slower to three times at 99.
- **Garments**: eight to wear, two for each of four slots (head, body, hands, feet), sold at outfitters,
  ranger camps and traders. They are worn, never held.
- **Attunement**: every weapon and garment is attuned to one of the eleven schools of magic, fixed by its own
  id. Two hoods are rarely alike.
- **Awakenings**: at levels 5, 25, 50 and 75 an item's magic wakes: its school's spells grow stronger, then
  cheaper and quicker, then one of them changes (a garment) or its hits carry the school (a weapon), then
  spells come free (a garment) or the weapon casts on its own (a weapon). The hundredth wakes it once more.
- **Seven attributes**: Vigour, Resolve, Precision, Swiftness, Potency, Focus and Haste. Your ranks and level
  feed them, and so do your gear. They, your perks and your gear's magic become one set of numbers that the
  spells and the fight read.
- **The Character view** (Shift+I, or Character in the gear sheet) shows all of it. (C was taken: it is down when flying and the dodge in close combat.)

## Level 99, and the hundredth

Experience goes as far as 99, for you and for gear. The hundredth, shown as **100★**, is never experience: it
is earned.

### Your level (`magic/skills.js`, `magic/trials.js`)

- **To 99**: the first 30 levels take what they always did (100, then 35 more a level). Past 30 the climb
  steepens by 4·(level − 30)² a level: about 17,000 experience to 30 and about 605,000 to 99. At 99 experience
  no longer counts. A save from before, above 99, comes back at 99.
- **The trials of the hundredth** open at 99. Deeds done before then count:

| Trial | What it asks |
|---|---|
| ✦ Master of Schools | rank 100 in three schools of magic |
| ⛈ Twilight Unbound | weave Tempest or Rewind, the deepest twilight spells |
| ♜ Giant-feller | bring down three of the great beasts and machines |
| ⊙ Wellwalker | find twelve aether wells, in any of the worlds |
| ❦ The Open Hand | spare twenty-five who fought you |
| ⚔ Heirloom | raise a weapon to level 99 |
| ♛ Regalia | wear a garment on every slot, each at level 75 or more |

- **Counting**:
  - The great beasts and the mercy are counted from the fight's own record (`combat/morality.js` events
    `boss-slain` and `spare`), kept as `deeds` with your magic.
  - The wells are those you have found (Sunwell Gate takes you back to them).
  - Heirloom and Regalia read what you own and wear.
- **Telling**: each trial is told once as it is done (`newlyDone`), every few seconds. Reaching 99 says how many
  are done already.
- **The rite**: with every trial done, gather from an aether well at dusk or dawn, when both strands show
  (`aether.js strandsShowing`). Daybreak can bring the dawn.
- **The hundredth** (`state.ascended`, kept with your magic, and only ever on 99) gives:
  - a skill point;
  - five to every attribute;
  - its own banner, and a pillar of light at the well.

### Gear (`gameplay/gear-levels.js`, `gameplay/arms.js`)

- **To 99**: experience takes an item to 99. An outfitter's upgrades stop there too.
  - It takes 60 a level to 10, then 600 and 8 more a level: about 87,000 from 1 to 99.
  - An item's numbers grow 1.63 times by 10, 2.13 by 20, 3 by 99, and 3.3 at the hundredth.
- **An item's trial** (`ASCEND_TRIALS`, a catalog item's `ascend`): at 99 its experience stops, and `x` counts
  its trial instead:
  - **A weapon**: bring down one of the great beasts or machines with it in hand.
  - **A garment**: cast 300 spells of its own school while wearing it.
  - Each step is a `trial` transaction, counted like experience and not journaled. The last step makes it 100★.
- **Tools**: a tool stops at 99 (it has no trial).
- **Combining** keeps the higher of the two, with its experience or its trial's progress.
- **Level 100★ wakes its magic once more** (Ascended):
  - **A garment**: its school's spells 10% stronger still, and its free spell one sooner (never sooner than
    every second).
  - **A weapon**: its hits 10% harder, and its Spellshot one hit sooner.
- **Items show their level** as `100★` in gold at the hundredth. The item view shows the trial's progress in
  place of experience at 99.

## Attributes (`magic/stats.js`)

| Attribute | One point gives | Grows with you from |
|---|---|---|
| ❤ Vigour | +2.5 life, +0.02 life a second out of a fight | Resilience rank ÷ 4 |
| ⛨ Resolve | 0.4% less harm | Resilience rank ÷ 6 |
| ⌖ Precision | +0.8% weapon harm, +0.8% on heads and weak points | Marksman rank ÷ 4 |
| » Swiftness | +0.3% pace, +0.3% jump | Athletics rank ÷ 4 |
| ✦ Potency | +0.6% power, every spell | your three best schools' ranks ÷ 12 |
| ◈ Focus | +2.5 mana pool, +0.05 mana a second | (your level − 1) ÷ 2 |
| ⌁ Haste | 0.5% quicker cooldowns | Chrono rank ÷ 5 |

- **Your own growth** lends at most 30 points to any attribute (`BASE_CAP`). Gear adds on top, and the
  hundredth five more to each.
- **Gear** lends attributes as rows in `'pt'` in `gameplay/gear-levels.js` (`STATS`). They are whole points
  that grow with level and tier, like any other stat.
- **Composing** (`composeMods`): the perks first (`skills.js computeMods`). Then each attribute's points times
  its rates. Then the gear's school-scoped magic (power, mana and cd for its school). Harm turned aside is
  capped at 60% (`ARMOR_CAP`); the perks alone were capped at 50%.
- **Life**: your life is 100 plus Vigour's share. `combat.setLifeMax(n)` sets it, and you keep the share of
  life you had.
- **When it is worked out** (`magic/index.js restat`): four times a second, it checks what you wear and hold,
  your level, your perks and your ranks. It works the mods out again only when one of them changed.
- **Perk previews**: a perk's "before → after" in the skills menu now counts your attributes and gear too
  (`composeMods(state, perks)`).

## Garments (`gameplay/arms.js`)

| Slot | Garment | Attributes at level 1, Common | Price |
|---|---|---|---|
| Head | Wayfarer's Hood | Focus 3, Resolve 2 | 90 |
| Head | Stargazer Circlet | Potency 3, Haste 2 | 140 |
| Body | Aetherweave Coat | Vigour 3, Potency 2 | 160 |
| Body | Ranger's Jacket | Resolve 3, Precision 2 | 130 |
| Hands | Spellbinder Gloves | Haste 3, Potency 2 | 110 |
| Hands | Fieldcraft Gloves | Precision 3, Swiftness 2 | 80 |
| Feet | Trailstrider Boots | Swiftness 3, Vigour 2 | 100 |
| Feet | Duskwalker Boots | Swiftness 3, Focus 2 | 120 |

A Legendary garment lends about 3.5 times as much at level 20 (11 and 7), about 5 times at 99 (15 and 10), and
5.4 times at 100★. The weapons now lend attributes as well:
- Aurora: Precision 3
- Mossback: Precision 2 and Focus 1
- Warden: Precision 2 and Resolve 1
- Reedline: Precision 2 and Swiftness 1

**Wearing**:
- `inventory.worn` is a slot-to-uid map, kept with the save.
- `EQUIP` with a garment's uid puts it on its own slot, and the one there comes off. `UNEQUIP` with a garment
  slot takes it off.
- A garment is never held: `arms.hold(garment)` wears it.
- A garment sold, traded or combined away is no longer worn (`recount`).
- **Look**: garments do not change how you look yet. The avatar's clothes still come from its own seed. Showing
  worn garments on the body is a look change, so it is left for the owner to see first.
  - Their pictures in the gear sheet are emoji in the tier's frame, with the school's mark in the corner.

## Attunement and awakenings (`gameplay/gear-magic.js`)

### Attunement

The school comes from a hash of the item's uid and id. So it survives upgrades, trades, and combining (you keep
the one you open). It needs nothing new in the save, the trade messages or the server.

| Item | Schools it can carry |
|---|---|
| Garments | all eleven |
| Aurora Trail Rifle | Radiance, Storm, Void, Warding, Dawn |
| Mossback Scout Rifle | Shadow, Blight, Umbral, Chrono, Void |
| Warden Spark Carbine | Storm, Warding, Chrono, Restoration, Radiance |
| Reedline Hunting Bow | Primal, Radiance, Shadow, Blight, Dawn, Restoration |

Tools, supplies and ammunition carry no magic.

### Awakenings

Tier `t` is 0 (Common) to 4 (Legendary).

| Level | Name | A garment | A weapon (held) |
|---|---|---|---|
| 5 | Attuned | its school's spells +5% + 2%·t stronger | the same |
| 25 | Flow | its school's spells cost 6% + 2%·t less mana and come back that much sooner | Spellstrike: each hit takes 0.3 + 0.1·t s off the school's cooldowns |
| 50 | Altered | one of its school's spells works differently (below) | Infused: its hits carry the school (below) |
| 75 | Mastery | every 5th, 4th or 3rd spell of its school (by tier) costs nothing and starts no cooldown | Spellshot: every 6 to 3 hits (by tier) it casts one of the school's spells by itself |
| 100★ | Ascended | its school 10% stronger still, its free spell one sooner | its hits 10% harder, its Spellshot one hit sooner |

How they combine:
- Two garments of one school add their power and flow together. For Mastery, the more generous one counts.
- Only the weapon in your hand counts.

### Altered spells (garments, level 50)

| School | Spell | How it changes |
|---|---|---|
| Radiance | Sunspark | three sparks in a fan, each three fifths as strong |
| Restoration | Mend | goes on healing half as much again over 6 s |
| Warding | Aegis | also lights a radiant aura round you for 10 s |
| Dawn | Swiftstride | carries you across water too |
| Shadow | Shadowstep | leaves you cloaked for 3 s |
| Void | Void Shard | passes through everyone in its path (up to eight) |
| Blight | Hex of Decay | leaps to the nearest foe when its victim falls |
| Umbral | Summon Shade | calls two shades |
| Storm | Chain Lightning | leaps three more times |
| Chrono | Mark and Recall | returning closes a quarter of your wounds |
| Primal | Cinder | leaves the ground burning for 4 s where it lands |

`spells.js shaped()` applies the change (`mods.alter`) to the caster's copy of the spell, after the perks.
`caster.js` carries it out:
- `split` and `dmgK`: Sunspark's fan.
- `renew`: Mend's healing after.
- `aura`: Aegis's aura.
- `cloakAfter`: Shadowstep's cloak.
- `pierce: 'all'`: Void Shard.
- `burn`: Cinder's ground.
- `recallHeal`: Mark and Recall.

The others (`status.spread`, `n`, `jumps`, `waterWalk`) were already read by the caster. The catalog itself
never changes.

### Infused weapons (level 50)

The numbers grow by 15% a tier.

| School | Its hits |
|---|---|
| Radiance | Dazzling: hold the foe 0.5 s |
| Shadow | Dreadful: the foe flees 1.5 s |
| Void | Hollow: +15% harm |
| Blight | Festering: rot, 5 harm a second for 4 s |
| Storm | Arcing: 35% of the hit leaps to the nearest other foe within 8 m |
| Primal | Searing: smoulder, 7 harm a second for 3 s |
| Warding | Warding: 5 ward on you a hit, up to 40 |
| Restoration | Mending: you mend 6% of the harm dealt |
| Dawn | Fleet: 12% faster for 3 s |
| Chrono | Stilling: the foe slowed to 60% for 2.5 s |
| Umbral | Hungering: 3 mana a hit |

**Spellshot spells** (level 75):

| School | Spell | School | Spell |
|---|---|---|---|
| Radiance | Solar Flare | Primal | Cinder |
| Shadow | Night Terror | Warding | Aegis |
| Void | Repulse | Restoration | Mend |
| Blight | Plague Cloud | Dawn | Swiftstride |
| Storm | Chain Lightning | Chrono | Stasis |
| Umbral | Summon Shade | | |

A Spellshot spell is cast along your aim. You do not need to know it, and it costs no mana and starts no cooldown
(`caster.cast(id, { free: true, quiet: true })`).

**Where the weapon's magic applies:**
- **Your own shots only**, at those who fight you: fighters and the great beasts. Never your fists (`blow.melee`),
  never a bystander. So harming a bystander is never rewarded, and the Spark's ward and the morality rules stay
  as they were.
- **After the hit**: what the hit carries is done once it has landed. `hooks.power` queues it and
  `magic/index.js afterHits` does it, so no harm is dealt inside another blow.

## Growing gear

Ways to level an item:
- **Using it**:
  - A weapon learns from its hits, from carrying it and from kills, as before.
  - Garments learn from the mana you spend casting, twice as fast for their own school.
  - The coat and hood learn from the harm you take.
  - Boots learn from the ground you cover.
  - All of this is counted every 8 s (`arms.trainMany`), so automatic fire does not write the save on every hit.
- **Upgrade at an outfitter**: as before, now to level 99 (never the hundredth).
- **Infuse with aether fabric** (the item view's Infuse buttons, or `Crysis.magic.infuse(uid, strand, n)`):
  - Each thread gives 3 experience. It takes fabric of the school's strand: light, dark, or either for a
    twilight school.
  - It never takes more than the item can use, and it is refused while a trade is open.
  - This is where the spell economy feeds gear.

**Level-up messages**: when an item reaches a level that wakes its magic, the message says what woke
(`awakenedBetween`). At 99 it says what the item's trial asks.

## The Character view (`ui/gear.js drawChar`)

The view has these parts, top to bottom:
1. **Level** (100★ at the hundredth), the trials done at 99, and skill points waiting. At 99 the trials
   come next: each with its progress, then the rite once all are done. Before 99 they sit lower down, dimmed,
   saying they open at 99.
2. **Three tiles**: life, mana (with its return out of and in a fight), and harm taken.
3. **The seven attributes**, each with:
   - its total and a bar;
   - what it does now, in words;
   - where every point comes from (ranks, level, each item by name).
4. **The four garment slots and the hand**.
5. **Spellcraft as it stands now**: each school's power (the hour, affinity, perks, Potency and gear), mana
   cost and cooldown, and its mastery if any.
6. **The magic awake in your gear**, item by item. A tap opens the item.
7. **The body**: weapon harm, weak points, great beasts, pace, jump, falls and experience. Then your affinity.

**The item view** now shows:
- its attunement;
- its attributes;
- its five awakenings, with those still asleep dimmed and the level that wakes them;
- at 99, its trial for the hundredth and how far along it is (the Upgrade button says "Earned by its trial");
- Wear or Take off (a garment);
- Infuse.

**Slots** show the school's mark in their corner; a worn one has a green dot. Tooltips show the attunement and
the next awakening.

**The gear sheet's top line** shows your level, life, mana and harm taken.

## The network

- **Levels on the wire**: `net/protocol.js` now allows levels up to `MAX_LEVEL` in a held item's pose and in
  trades. The rooms server imports the same file.
- **The server says so**: the server now names `gear-levels-100` in its welcome and on `/status`.
  `server/verify-workers.mjs` requires it, so it reports the live Worker as out of date until the owner
  redeploys.
- **Until the owner redeploys the rooms Worker**:
  - The old server would silently drop a trade message holding an item above level 10, and the trade would
    stall. So the trade window refuses such an item when the room's server does not name the feature, and
    says why.
  - Friends see a held item above level 10 at level 1's look.
- **Server tests**: `cd server/multiplayer && npm test`: 107 pass. Two are new: gear at the highest level
  (100★) travels, and the welcome names the feature.

## Console

`Crysis.magic`:
- `.stats()`: the whole sheet.
- `.info()`: now has `life`, `gear` (each with its school), `levelShown`, `ascended` and `deeds`.
- `.trials()`: the trials as they stand, and what the rite still needs.
- `.infuse(uid, 'light', 10)`
- `.restat()`

## Tests

`node --test island/tools/gear-magic.test.mjs` (12):
- **Levels to 99, then 100★**:
  - the first twenty grow as before, every level grows, and ever slower to three times at 99;
  - experience stops at 99, a trial's steps make the hundredth, and the wire's bounds.
- **Outfitters and trials**: an outfitter stops at 99; a garment's trial counts and makes it 100★; a tool has
  none; combining keeps the higher one's progress.
- **Garments**: two a slot, sold at outfitters, worn by uid, one to a slot, never held, kept between visits, and
  no longer worn once sold.
- **Attunement**: every weapon and garment, stable through levels and combining; the weapons together reach all
  eleven schools; garments spread evenly; the strands it takes.
- **Awakenings**:
  - they wake at 5, 25, 50, 75 and the hundredth, and their words; the trial in words;
  - every school's alteration, infusion and spellshot is real;
  - stacking, mastery and the weapon's share.
- **Attributes**: from ranks and level, capped, with gear by name.
- **Spells' numbers**:
  - your statistics become the spells' own numbers: power, mana, cooldown and the mana pool;
  - life, harm taken and its cap;
  - the sheet.
- **Alterations** reshape their spells, and the catalog is left alone.
- **The caster, on a pretend fight**:
  - three sparks;
  - a shard through three foes, where an unaltered one passes through only one;
  - the cloak after a step;
  - a lingering mend;
  - a recall that mends;
  - burning ground.
- **Free casts**: mastery's free cast needs no mana and starts no cooldown; a spellshot casts a spell you do not
  know.
- **A weapon's hits**: arcs, ward, holds and Spellstrike reach the caster.
- **Wiring**: the runtime and screens are wired.

`node --test island/tools/trials.test.mjs` (6):
- **Your level**: experience to 99 and no further, the first thirty levels as they were, a point a level, an
  old save past 99 back at 99, the hundredth only on 99.
- **The seven trials**, each read from what you have done or own; deeds counted from the fight's record.
- **Opening and telling**: they open at 99, deeds before then count, each is told once.
- **The rite**:
  - it is refused with a trial left, at noon, or away from a well, and made at a well at dusk;
  - the hundredth gives a skill point and five to every attribute.
- **Saving**: the hundredth, the deeds and the told trials are kept between visits; rubbish is dropped.
- **Wiring**: the runtime counts, tells and makes the rite, and the screens show it.

`trade.test.mjs` and the server's `room.test.mjs` take the level bound from `MAX_LEVEL`.

**In the running island**: `node island/tools/character-sheet-browser.cjs` (Chromium, software WebGL):
1. It seeds a level 99 save five trials into seven. You wear garments at 60, 80, 99 (its trial 120 of 300) and
   100★, and hold a bow at 99, with fabric and ranks.
2. **Enter world** is pressed, then Shift+I opens the Character view with its trials.
3. The coat at 100★ opens, then the circlet at 99 with its trial.
4. Ten light fabric are infused into the boots.
5. Altered spells are cast: three sparks, two shades.
6. The view at 100★ is shown.
7. The view is checked at a phone's width with no sideways scroll.
8. It checks that nothing throws.

Screenshots are in [verification/character-sheet/](verification/character-sheet/).

## Not done yet

- **Garments on the body**: worn garments do not change the avatar's look, and have no 3D model in the gear sheet.
  Both are look changes for the owner to see first.
- **Re-attuning**: an item cannot be re-attuned. Its school is fixed by its id.
- **Where garments come from**: they are not yet found in the world (field contracts' caches, aether wells). Only
  shops sell them.
- **Other players**: multiplayer does not show other players' spellshots or attunements, or their hundredth.
- **Spare skill points**: with 99 levels and the hundredth there are 100 skill points and 65 perks, so late
  points have nothing to buy yet.
- **Tuning**: the curves and the trials' counts are first numbers, not played through: experience to 99
  (about 605,000 for you, 87,000 for an item), and the trials (300 spells, twelve wells, three great beasts,
  twenty-five spared). Each is one constant (`skills.js xpNeed`, `gear-levels.js xpNeed` and
  `ASCEND_TRIALS`, `trials.js TRIALS`).
