# Spells in your statistics, garments, and gear that wakes (October 17, 2026)

The owner asked for:
- the spell logic integrated into the player's statistics, with specific attributes;
- clothing and weapons with higher levels;
- levels that grant magical buffs for particular spells, and that augment and alter how things work.

This builds on the spells and the skills menu ([spells-and-controls-2026-10-16.md](spells-and-controls-2026-10-16.md),
[skills-and-magic-menu-2026-10-16.md](skills-and-magic-menu-2026-10-16.md)). Those two branches had not reached
main, so this branch carries them, merged with main as of `ad0743c`.

## What changed, in a line each

- **Gear goes to level 20** (was 10). Growth is the same 7% a level up to 10, then 5% a level.
- **Garments**: eight to wear, two for each of four slots (head, body, hands, feet), sold at outfitters,
  ranger camps and traders. They are worn, never held.
- **Attunement**: every weapon and garment is attuned to one of the eleven schools of magic, fixed by its own
  id. Two hoods are rarely alike.
- **Awakenings**: at levels 5, 10, 15 and 20 an item's magic wakes: its school's spells grow stronger, then
  cheaper and quicker, then one of them changes (a garment) or its hits carry the school (a weapon), then
  spells come free (a garment) or the weapon casts on its own (a weapon).
- **Seven attributes**: Vigour, Resolve, Precision, Swiftness, Potency, Focus and Haste. Your ranks and level
  feed them, and so do your gear. They, your perks and your gear's magic become one set of numbers that the
  spells and the fight read.
- **The Character view** (Shift+I, or Character in the gear sheet) shows all of it. (C was taken: it is down when flying and the dodge in close combat.)

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

- **Your own growth** lends at most 30 points to any attribute (`BASE_CAP`). Gear adds on top.
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

A Legendary garment at level 20 lends about 3.5 times as much (11 and 7). The weapons now lend attributes as well:
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
| 10 | Flow | its school's spells cost 6% + 2%·t less mana and come back that much sooner | Spellstrike: each hit takes 0.3 + 0.1·t s off the school's cooldowns |
| 15 | Altered | one of its school's spells works differently (below) | Infused: its hits carry the school (below) |
| 20 | Mastery | every 5th, 4th or 3rd spell of its school (by tier) costs nothing and starts no cooldown | Spellshot: every 6 to 3 hits (by tier) it casts one of the school's spells by itself |

How they combine:
- Two garments of one school add their power and flow together. For Mastery, the more generous one counts.
- Only the weapon in your hand counts.

### Altered spells (garments, level 15)

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

### Infused weapons (level 15)

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

**Spellshot spells** (level 20):

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
- **Upgrade at an outfitter**: as before, now to level 20.
- **Infuse with aether fabric** (the item view's Infuse buttons, or `Crysis.magic.infuse(uid, strand, n)`):
  - Each thread gives 3 experience. It takes fabric of the school's strand: light, dark, or either for a
    twilight school.
  - It never takes more than the item can use, and it is refused while a trade is open.
  - This is where the spell economy feeds gear.

**Level-up messages**: when an item reaches a level that wakes its magic, the message says what woke
(`awakenedBetween`).

## The Character view (`ui/gear.js drawChar`)

The view has these parts, top to bottom:
1. **Level**, and skill points waiting.
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
- its four awakenings, with those still asleep dimmed and the level that wakes them;
- Wear or Take off (a garment);
- Infuse.

**Slots** show the school's mark in their corner; a worn one has a green dot. Tooltips show the attunement and
the next awakening.

**The gear sheet's top line** shows your level, life, mana and harm taken.

## The network

- **Levels on the wire**: `net/protocol.js` now allows levels up to `MAX_LEVEL` in a held item's pose and in
  trades. The rooms server imports the same file.
- **The server says so**: the server now names `gear-levels-20` in its welcome and on `/status`.
  `server/verify-workers.mjs` requires it, so it reports the live Worker as out of date until the owner
  redeploys.
- **Until the owner redeploys the rooms Worker**:
  - The old server would silently drop a trade message holding an item above level 10, and the trade would
    stall. So the trade window refuses such an item when the room's server does not name the feature, and
    says why.
  - Friends see a held item above level 10 at level 1's look.
- **Server tests**: `cd server/multiplayer && npm test`: 107 pass. Two are new: gear at the highest level
  travels, and the welcome names the feature.

## Console

`Crysis.magic`:
- `.stats()`: the whole sheet.
- `.info()`: now has `life` and `gear` (each with its school).
- `.infuse(uid, 'light', 10)`
- `.restat()`

## Tests

`node --test island/tools/gear-magic.test.mjs` (11):
- **Levels to 20**: the first ten grow as before, slower growth past them, and the wire's bounds.
- **Garments**: two a slot, sold at outfitters, worn by uid, one to a slot, never held, kept between visits, and
  no longer worn once sold.
- **Attunement**: every weapon and garment, stable through levels and combining; the weapons together reach all
  eleven schools; garments spread evenly; the strands it takes.
- **Awakenings**:
  - they wake at 5, 10, 15 and 20, and their words;
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

`trade.test.mjs` and the server's `room.test.mjs` now take the level bound from `MAX_LEVEL`.

**In the running island**: `node island/tools/character-sheet-browser.cjs` (Chromium, software WebGL):
1. It seeds a save with four garments, a bow, fabric and ranks.
2. **Enter world** is pressed, then Shift+I opens the Character view.
3. A worn coat's item view opens.
4. Ten light fabric are infused into the boots.
5. Altered spells are cast: three sparks, two shades.
6. The view is checked at a phone's width with no sideways scroll.
7. It checks that nothing throws.

Screenshots are in [verification/character-sheet/](verification/character-sheet/).

## Not done yet

- **Garments on the body**: worn garments do not change the avatar's look, and have no 3D model in the gear sheet.
  Both are look changes for the owner to see first.
- **Re-attuning**: an item cannot be re-attuned. Its school is fixed by its id.
- **Where garments come from**: they are not yet found in the world (field contracts' caches, aether wells). Only
  shops sell them.
- **Other players**: multiplayer does not show other players' spellshots or attunements.
