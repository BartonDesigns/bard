# Spells, aether fabric and the new controls (October 16, 2026)

The owner asked for:
- better aiming and movement controls: keep click and drag to aim, add Alt / Option to drag the
  camera view around, and a double tap of Alt / Option back to aiming;
- hotkeys 1 to 5 for weapons and 6 to 0 for spells;
- a spell system on par with The Elder Scrolls and World of Warcraft, learned with dark and
  light aether fabric. It should be wide, add a variety of gameplay, and reward exploring.

## Controls

| Key | What it does |
|---|---|
| Click, then move the mouse | Aim (as before: the mouse is captured, the view and the aim move together) |
| Alt / Option | Camera: the cursor is freed, a click-drag turns the view, clicks fire nothing. Keys you hold (W and the rest) carry on. A chip at the top says so. Spells cast at the cursor while you look about. |
| Alt / Option twice quickly | Back to aiming (the mouse is captured again) |
| 1 to 5 | Take up the weapon on that key; press it again to put it away |
| 6 to 0 | Cast the spell bound to that key (a beam is held) |
| N | The spellbook |
| Shift + Mark and Recall | Mark anew instead of returning |

The weapons you own fill the keys 1 to 5 as you come by them: the best of each kind first, in
the field arms' order, then the spares. A weapon stays on its key until it is sold or traded
away (`combat/hotbar.js`, kept as `l99-hotbar`). The bar along the bottom shows both sets of
keys, and a tap on it works on a touch screen.

The camera mode lives in `player.js` (`state.lookMode`, `setLookMode`). Firing and close combat
already needed the captured mouse, so in camera mode a click only turns the view. Spells can also
change your pace (`speedK`), jump (`jumpK`), fall (`fallK`), and let you walk on water
(`waterWalk`).

## Aether fabric

Magic is woven from the aether, which runs through the world in two strands (`magic/aether.js`):

- **Light motes**: gold. Likelier the higher and more open the ground. They show only while the
  sun is up.
- **Dark motes**: violet. Likelier on low ground. They show only after dark.
- **At dusk and dawn**: both show, and each gives half as much again.
- **Wells**: rare, bright springs of one strand, worth 18 to 31 fabric. Once found, a well is a
  place you can return to with Sunwell Gate.

Walk into a mote to gather it. Placement is fixed by the world: a hash of a 46 m cell, or a
420 m cell for wells, and the world's key. Each world has its own aether, the same every visit.
A gathered mote comes back after 15 minutes, a well after 40.

Fabric also comes from how you fight: sparing a fighter gives 2 light, a kill 1 dark, and killing
someone who surrendered 3 dark.

## Learning and casting (`magic/spells.js`)

- **Weaving:** a spell is woven from its strand's fabric. Light spells take light fabric, dark
  spells dark. Tiers cost 10, 30, 80 and 200. Twilight spells take 60 percent of that from
  each strand.
- **The ladder:** every school has four tiers. A spell past tier 1 needs one spell of the tier
  below in the same school.
- **Affinity:** every thread you weave becomes affinity with its strand. Affinity makes that
  strand's spells up to half again as strong and up to a third cheaper. It also raises your
  mana pool and how fast mana returns.
- **Twilight:** twilight spells can only be woven by someone who carries both strands deeply:
  20, 60, 150 and 320 affinity with each, by tier.
- **Time of day:** light spells are a quarter stronger by day, dark spells a third stronger at
  night, twilight spells a third stronger at dusk and dawn. Each strand loses a tenth in the
  other's time.
- **Mana and cooldowns:**
  - Mana: 100, plus 4 for every spell known, plus affinity, up to 260.
  - Mana returns at 7 a second, or 4 while you are being fought.
  - Each spell has its own cooldown.

You start with Sunspark, Shadowbolt, Mend and Lumen on 6 to 9, and 12 fabric of each strand.
Everything is kept between visits (`l99-magic`).

## The spells

47 spells in 11 schools.

### Light

| School | Spells, by tier |
|---|---|
| **Radiance** | Sunspark (bolt) · Lance of Dawn (three lances that fall out of the sun, or the moon at night) · Solar Flare (a column of light from wherever the sun stands, that blinds; by night from the moon once mastered) · Judgement (pillar of light from the sky) |
| **Restoration** | Mend · Renewal (heal over time) · Sanctuary (healing ground that slows foes) · Resurgence (two minutes in which a lethal blow is turned aside) |
| **Warding** | Aegis (absorbs blows) · Radiant Aura (burns those close) · Bulwark (nothing reaches you for 3.5 s) · Banish (throws foes back and makes them flee) |
| **Dawn** | Lumen (a light at your shoulder) · Dawnsight (see the aether through walls) · Swiftstride (speed, high jumps, gentle falls) · Waterstride (walk on water) · Daybreak (turns the night to dawn) · Sunwell Gate (travel to a well you have found) |

### Dark

| School | Spells, by tier |
|---|---|
| **Shadow** | Shadowbolt · Shadowstep (blink) · Umbral Cloak (hunters lose you) · Night Terror (cone of fear) · Eclipse (holds, then tears) |
| **Void** | Void Shard (piercing) · Repulse (force cone) · Gravity Well (pulls in, then collapses) · Event Horizon (holds and drains) |
| **Blight** | Hex of Decay (rot over time) · Withering (slow and rot) · Plague Cloud · Soul Siphon (beam that heals you) · Contagion (rot that spreads to the next when its victim falls) |
| **Umbral** | Nightsight (see in the dark, and living things through walls) · Summon Shade · Grave Host (three shades) · Dark Pact (a third of your life for full mana and stronger spells) |

### Twilight (both strands)

| School | Spells, by tier |
|---|---|
| **Storm** | Thunderclap (stunning nova) · Chain Lightning · Ball Lightning (rolling orb) · Tempest (a storm of strikes that also puts out fires) |
| **Chrono** | Mark and Recall · Quicken (cooldowns run three times as fast, and you move faster) · Stasis (freeze one foe) · Rewind (back to where and how hale you were five seconds ago) |
| **Primal** | Cinder (fire bolt that sets things alight) · Frost Nova (freezes those close) · Call Rain (puts out every fire within 40 m) |

## How spells meet the rest of the game

- **Harm:** spell damage goes through the fight's own door (`combat.deal`). The Spark's ward on
  children, surrender, and the morality of harming bystanders all hold for spells as for shots.
- **Area spells:** novas, clouds, auras, wells, storms and the shades strike only hostile fighters
  and bosses. Bolts and beams strike whatever they meet, like a shot.
- **Statuses:** held, slowed, afraid and rotting are laid on a fighter's `hex`.
  `combat/ai-squads.js` reads it: held fighters stand still, afraid ones run from you, slowed
  ones walk slower. `magic/caster.js` wears it off. Bosses take the harm but ignore statuses.
- **Wards and cloak:** a blow at you passes `combat.hooks.shield` (Aegis, Bulwark, Resurgence).
  `combat.hooks.cloak` hides you from fighters choosing a target. Any harm you deal ends the
  cloak.
- **Fire:** Cinder lights what will burn (`combat.igniteAt`). Tempest and Call Rain put fires out
  (`combat.douse`), which is useful against the wildfires and burning houses of the
  catastrophes.
- **Light:** Lumen and Nightsight lift the eye's exposure in the dark (one factor in `main.js`).
  No scene lights are added, so no materials recompile.
- **Elements** (`magic/elements.js`): what lands sets off its element's affliction, with a look of
  its own on the body. Radiant sears (25% of the blow again over 3 s). Fire burns (40% over 4 s).
  Frost chills (60% pace for 3 s), and the third chill in a row freezes for 1.5 s. Storm jolts
  (0.35 s) and 30% leaps to the nearest other foe. Shadow leaves dread (15% more from you for
  4 s). Void unravels (30% strikes again 0.9 s later). Blight rots (30% over 6 s). Follow-on damage
  is a share of the blow as it landed and never sets off another. Bosses take the damage and the
  dread but are never slowed, frozen or jolted. A foe your element kills goes down its way: burned
  to ash, seared to light, shattered, scattered as sparks, dissolved to shadow, folded into
  nothing, or melted.
- **Aether and your name:** a mote gives more of the strand your reputation leans to (up to twice
  the light at +100, twice the dark at -100) and less of the other, down to half (`aetherShare`).
  Sparing a foe still gives light fabric, and a kill gives dark.
- **Daybreak** moves the sky's clock to dawn over six seconds (by night only, once every five
  minutes).
- **Performance:**
  - All the glow comes from one fixed pool of additive points (`magic/fx.js`): 3,200 on a desktop,
    1,400 on a phone, one draw. Nothing is made while you cast.
  - The sight spells draw that pool over the walls while they last.
  - Each school has a short synthesised voice on the world's sound bus.

## How each spell looks

Every spell has a look of its own (`magic/looks.js`), drawn from Diablo IV first, then Guild Wars 2
and World of Warcraft. The idea is that you can name a spell from its silhouette and colour alone.

- **Each school has a motif.** Radiance uses gold stars and spears of light. Restoration uses leaves
  and green rings. Warding uses hexagons and white gales. Dawn uses rose runes. Shadow uses black ink
  smoke with violet rims and eyes. Void uses crystal shards and warped rings. Blight uses poison
  drips and fog. Umbral uses wraiths. Storm uses forked lightning. Chrono uses clockwork runes.
  Primal uses flame, ice and rain.
- **Shapes:** `fx.js` draws twelve shapes: orb, star, ring, shard, flame, streak, rune, smoke, eyes,
  cross, hex and leaf.
- **Three kinds of particle:** glowing ones, dark "ink" ones (so shadow and smoke read as dark and
  not as glow), and hard streaks. Streaks have a white-hot core and a sharp edge and come in two
  forms:
  - Sparks, stretched along their own flight.
  - Segments, used for lightning, a bolt's spear, a beam's core and a falling lance.
- **Force over fluff (October 17):** the shared bursts, lines, lightning, rings, pillars and swirls
  now throw hard sparks and strokes as well as glow.
  - Bolts fly as spears of light with a white core.
  - Hits slam: a hot flash, a ring snapping out, rays thrown on through along the blow, falling
    debris and a ring on the ground.
  - The forms that changed:
    - Judgement drops a blade with a crossguard.
    - Lance of Dawn falls as true shafts and stands where it struck.
    - Frost Nova cracks the ground and raises ice spikes.
    - Night Terror rakes red claws.
    - Repulse throws a hard front of force.
- **Ground marks:** rings and runes on the ground are flat decals, not points.
- **Pools:** glow 3,200 (1,400 on a phone), ink 700 (300), streaks 1,600 (500), decals 48 (24). Nothing is made while
  you cast.
- **Lance of Dawn** is now an area spell. Three lances fall point first around where you aim. By
  day they come out of the sun in gold, and by night out of the moon in silver. A ring on the ground
  warns where each will land.
- **Solar Flare** brings down a column of directed light from the sun's real place in the sky onto
  where you aim, then bursts. By night it is refused and costs nothing, unless it channels the moon
  (`state.moonlit`, an array of ids the skills side fills when the spell reaches mastery III;
  `Crysis.magic.moonlit()` on the console). Then it comes from the moon, in silver, a fifth weaker.
- **Gargantua**, Void's fifth rung: a black hole appears as a dot on the horizon and swells until it
  fills the whole sky by 8.5 s (a dark veil takes the sky behind you too). Over ten seconds it draws in
  and destroys every hostile fighter within 600 m, and takes a quarter of any boss's life.
- **The gallery:** `node island/tools/spell-looks-browser.cjs` plays every look in a small scene of
  its own, with no game loaded, and saves one picture per spell to `/tmp/spell-looks` (`ONLY=` picks
  some; `FLIGHT=1` catches bolts mid-flight).

## Console

`Crysis.magic`:
- `.info()`
- `.give('light', 100)`: add fabric.
- `.all()`: know every spell.
- `.learn(id)`, `.bind(slot, id)`, `.cast(id)`
- `.hud.open()`: open the spellbook.

## Tests

`node --test island/tools/magic.test.mjs` (14):
- every spell is whole, and no school's ladder is missing a rung;
- the runtime handles every kind of spell;
- weaving, affinity and the ladder, and twilight's gate;
- power by the time of day, affinity and the pact;
- mana and cooldowns, quickened too;
- what is kept between visits, with rubbish dropped;
- the aether's placement (the same every time, none in the sea, each world its own, high ground
  leaning to light, wells rare), and which strands show when and coming back;
- the weapons on the keys 1 to 5;
- the look modes and the keys being wired;
- every spell has a look of its own, and no two look alike;
- Solar Flare needs the sun until it channels the moon, and the aether leans to your name;
- each element does its own thing to the one it strikes.

## Found on the way: memory while the mouse is captured

While checking this work in the container's headless Chromium (software rendering), the
browser was killed for running out of memory twice, at 5 and then 12.6 GB. Each time it
happened after the mouse had been captured for aiming (pointer lock), not because of the
spells. The same happens with main's own build, without this work:

- **The jump:** capturing the mouse on Earth took the browser from 2.1 GB to about 4.1 GB at
  once.
- **What stayed still:** the view did not move, and the renderer's counts held (468
  geometries, 119 textures, 450 shader programs).
- **Where it sits:** the renderer process held 2.6 GB and the GPU process 1 GB.
- **What it took to crash:** night, and a long stretch of casting and fighting on top of that,
  took it over the container's limit.
- **What was clean without capture:** every spell was cast on its own, then night was rendered,
  and the browser stayed between 2.0 and 2.3 GB.

This may be particular to this headless browser, but it is worth checking on a desktop. In
Chrome's Task Manager (Shift+Esc), watch the tab's memory before and after clicking into the
world to aim. If it jumps by gigabytes there too, it is a bug in main, not in the spells.

## Part 2 (October 17): hands, bodies, friends, things picked up, the bar

The owner, on the first round: no casting animation; brawlers and townsfolk untouched by holds,
slows and fear; friends not seeing spells; bats and pipes not on the keys; the bar in the middle
of the screen.

- **The bar:** at the bottom of the screen on a desktop. It was placed above the right-hand stack
  of buttons (`--l99-low`), which on a tall desktop window is half way up. On a touch screen it
  still sits above the thumbs' controls.
- **Your hand casting (`magic/hands.js`):**
  - Your own hand (the anatomical hand, from your body) comes up open, palm to the aim, and the
    school's light gathers in it.
  - It is held a breath, longer for a tier 4 spell, and for as long as a beam pours, then let down.
  - The right hand casts; with a bat or a pipe in the right hand, the left does.
  - With a field arm in your hands, only the light shows (the weapon's own hands stay on it).
  - While the hand is up, the boxing guard steps aside (`combat.hooks.casting`).
- **Your body casting:** in third person the body thrusts a hand out toward the aim (the new
  `cast` gesture, `people/motion.js`), or both hands for a tier 4 spell (`cast2`).
- **Brawlers and townsfolk:**
  - Holds, slows and fear now reach the people of the town and anyone brawling with you.
  - A townsperson held stands still. Afraid, they run from where the spell was cast; slowed, they
    run slower (`combat/civilians.js`).
  - A brawler held drops its guard and stands; afraid, it runs; slowed, it closes slower
    (`combat/melee-foes.js`, reading the hex on the body).
  - Areas still harm only the hostile: the townsfolk in one take its hold, slow or terror, never
    its harm. A bolt still strikes whoever it meets.
  - Stasis now holds a townsperson too. Children are never touched.
- **Friends see your spells (`magic/net.js`):**
  - A spell goes to the room as one of the shots friends already see, marked by its style (7),
    from where it was cast to where it went.
  - Which spell it was rides in the hundredths of a metre of its end, which the room keeps. So the
    room's server needs nothing new and the live server carries it today.
  - Friends see bolts fly, beams pour (pulsed every 0.3 s while held), bursts, strikes and storms
    land where you aimed, blinks and gates leave and arrive, and spells on yourself flare about you.
- **Things picked up on the keys (`combat/melee.js`, `combat/hotbar.js`):**
  - A bat, pipe, bottle, knife or machete you pick up gets a key after your field arms.
  - With something already in hand, or a field arm drawn, what you walk over is stowed: up to
    three carried things.
  - A key takes one up; the same key stows it again.
  - Drawing a field arm stows what you were swinging rather than dropping it (it is dropped only
    if there is no room).
  - A bat that splinters or a bottle that shatters leaves its key.

## Part 3 (October 17): beams as blasts (`magic/beam.js`)

A held beam (Lance of Dawn, Soul Siphon) now works like a charged blast:

- **It gathers first.** For 0.32 s (`CHARGE`), light spirals into your hands and a ball of it
  swells there, with a rising whine. Both hands come up together, heels touching. In third
  person the body takes a new `beam` stance (`people/motion.js`), held for as long as it pours,
  and eases out when you let go (`M.ungesture`).
- **Then it lets go with a punch.** A ring of light bursts out across the beam at the hands, the
  column's head races to the end in 0.12 s, the column swells wide for a moment, and the camera
  kicks.
- **The column.** A white-hot core inside a sheath of the school's colour, on one open cylinder,
  drawn additive. Pressure swells and pinches run down it, it streaks and flickers, and it widens
  with distance so it stays big far off. Near your own eyes it thins so it doesn't blind you.
  Shock rings are thrown off at the hands, motes stream along it, the end sprays sparks back the
  way it came, dust rings spread where it strikes, and the camera rumbles while it pours.
- **It drives fighters back.** Every 0.25 s a fighter in the beam is shoved along it (less for a
  drain).
- **Sound.** The whine rises to the release, then a roar (band-passed noise and a low hum) plays
  while it pours and dies away when you let go (`beamVoice` in `magic/fx.js`).
- **A tap still fires.** Once it has let go, it pours for at least 0.3 s (`MIN_BLAST`).
- **Friends see one steady column.** The first word gathers at their hands, and each pulse (every
  0.3 s) keeps the column alive for 0.45 s, so it no longer flickers as separate pulses.
- **Let go, it thins to a thread and is gone** (0.2 s).
- Three beams are made at the start and reused (yours plus two friends'), so nothing is created
  while casting.

Console: `Crysis.magic.hold('lance-of-dawn', ms)` casts and holds a beam, as a tap on the bar does.

**Fixed on the way:** the spellbook counted as open until it had been opened once. Its hidden
state lived only in its stylesheet, and `isOpen()` read the inline style. So, from the start,
every weapon key and spell key was refused, and the first N only shut a book that was already
hidden. It is now open only when `open()` made it so.

## Not done yet

- Your hand casting is drawn without a sleeve.
- Bosses still take the harm of a spell but none of its statuses.
- Things picked up and stowed are not kept between visits (field arms are).
