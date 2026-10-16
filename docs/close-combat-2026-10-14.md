# Close combat, October 14, 2026

Fists, blocks, dodges and takedowns now work like a modern action game, everywhere in the engine. They build on the security pass's melee (`combat/melee.js`, `combat/brawl.js`), the police and dispatch (`military/police.js`, `military/dispatch.js`) and the people's rigs (`people/motion.js`, `people/actions.js`).

## Controls

| | Desktop | Touch (phone) |
|---|---|---|
| Light strike (jab, cross, jab, cross in a steady rhythm) | Tap left mouse, or tap Q | Tap **Strike** |
| Heavy strike (charged, then you wobble) | Hold left mouse, release to throw | Hold **Strike**, release |
| Block | Hold right mouse | Hold **Block** |
| Parry | Raise the block just as a blow lands (0.16 s window) | Same, with **Block** |
| Dodge | C, with WASD for the direction (back if none) | **Dodge**, with the stick for the direction |
| Takedown from behind | Q when the "Q Takedown" prompt shows | **Takedown** (the Grab button lights up) |
| Grab, then throw | Hold Q; tap again to throw | **Grab**, then **Throw** |
| Shove | X (unchanged) | |
| Bat, pipe, bottle | Walk over one to pick it up; strikes swing it, a hold brings it down overhead | Same |

On a phone the cluster shows only while you are unarmed. **Strike** is always there, in the Fire button's place above the jump. **Block**, **Dodge** and **Grab** join it once a fight is on (or when a takedown is possible). The cluster sits relative to `--l99-low`, the top of the thumb's stack, so it moves up when the boat or rod buttons show. It hides while the controls menu is open, while driving and while holding a weapon. The weapon's Fire, Aim, Reload and Mode buttons are hidden while unarmed, so the two sets never overlap.

## Feel

- **Timing** (`combat/melee-rules.js`, revised October 15): `createStriker()` turns the button into strikes and is the one timing model for fists and for every item (bat, pipe, bottle, knife, machete), on the mouse, Q and the touch Strike button alike.
  - A tap throws a quick strike. Bare-handed taps alternate a jab off the lead hand and a cross off the rear one; with something in hand, a tap is its quick slash or swing.
  - Taps keep a beat. A strike starts no sooner than 0.27 s (`BEAT`) after the last one began, and one press is kept for the next while the rest are let go. Mashing therefore gives the same steady one-two as tapping in time, about 3.7 punches a second. A pause of more than 0.7 s (`RHYTHM`) starts again from the jab.
  - The jab is 0.26 s from press to ready, the cross 0.31 s.
  - A hold past 0.22 s (`HEAVY_HOLD`) is a heavy: the rear hand's power punch, or the item's overhead. It waits drawn back at the end of its wind-up while the hold goes on, charging fully over a further 0.8 s (`CHARGE_FULL`) to 1.8 times the damage, and goes when the button is let go.
  - A thrown heavy leaves you wobbling (`wobble()`): 0.35 to 0.75 s with the view rolling and your pace cut to as little as a third, and longer still when it meets nothing.
  - The tests drive the striker at 60 frames a second: one tap, mashing, taps in time, a pause, holds short and long, items.
- **Hit-stop**: a landed blow holds still for 45 ms (light), 65 ms (an item) or 85 ms (heavy), 110 ms on a parry. Your fists stay at full extension and the struck body freezes through the motion rig (`motion.js S.freeze`) before the reaction plays.
- **Camera** (`combat/melee-feel.js`, springs added on top of the view each frame): a blow you land dips and rolls the view; one you take snaps it away from the attacker; a block shoves it back. Your own strikes turn it with the shoulders: a touch right with a jab, about 3 degrees left with a cross. A heavy being charged coils the view away and down, with a tremble and a slow sway that grow with the charge. Thrown, it turns hard and lunges the eye forward, and the hit-stop holds on contact.
- **Flash**: a faint vignette at the screen edges. It is warm on heavy blows you land, pale on parries and red on hits you take. It is gentler on phones and is driven by the Web Animations API, so nothing runs per frame.
- **Sound** (`combat/melee-sound.js`): every piece is synthesised once per audio context into a buffer, the same way `bay/bridgesound.js` makes its knock, and played through `world/soundbus.js`. The pieces: swish, heavy swish, body thud, face slap and crack, heavy crunch, block clack, parry clap, bat thock, pipe clang, glass, body fall, grunt, breath, dodge scuff. Each blow plays two or three of them layered, pitched and levelled at random each time, panned left or right and dulled with distance. A phone plays fewer layers and at most 6 voices (14 on desktop).
- **Your fists** (`combat/melee-view.js`; the anatomical hands, sleeves and skin from #36, #41, #42 and #43 are unchanged): a boxer's guard, the lead hand forward and a little higher, the rear one back by the chin, elbows in. Each fist is placed by where it falls on screen (`SCREEN`), never further out than shoulder width (`WIDE`). On a narrow phone screen the fists sit further from the eye and wider apart on the screen, so both always show at the bottom and never meet in the middle.
  - A jab or a cross runs straight out along its own shoulder's line toward the crosshair, about head height. The fist turns over only in the last of the extension, the other hand is pulled back to cover, and the fist snaps back to the guard.
  - A held heavy draws the rear hand back and up toward the shoulder, the lead up to cover, the hand trembling more the longer it is held. A block covers the face, a dodge tucks the arms, a takedown wraps the right arm round the throat, and an item is held two-handed.
- **Reactions on NPCs**: `motion.jolt(dx, dz, k, twist, hold)` is a new procedural channel on every rig. Springs on the chest, head and hips throw the body the way the blow travelled, with a twist on hooks and swings. `reaction()` decides between a flinch, a stagger (pushed back, the attack broken off) and a knockdown (the existing Rapier ragdoll). The fallen get back up with the new `getup` action instead of popping upright.

## Defence

- **Block** takes 85% off a blow from the front. A heavy blow breaks it: half the damage gets through and you are rocked for 0.55 s.
- **Parry**: a block raised within 0.16 s of the blow landing takes no damage. The attacker staggers, open for 1.2 s, and your next strike within 0.85 s is a counter worth 1.7 times the damage and more likely to drop them.
- **Dodge**: 0.34 s at up to 8.5 m/s. From 0.03 s to 0.24 s nothing lands, and a dodge that slips a blow also earns a short counter window.

## The NPC side (`combat/melee-foes.js`)

- **Who squares up**: a townsperson you hit, if they have the temper (as before). Gang members, militia, raiders, smugglers, Hearthguard and hired guns whose target is you also close to fists once within 6.5 m while your hands are empty: they put the gun away (`ai-squads.js` hands them to the foes through `h.melee`) and pick it up again when you draw a weapon or get away. Officers fight hand to hand only after you resist them. Soldiers never do. Five at most at once (three on a phone).
- **Turns** (`createTurns`): one strikes at a time, or two when four or more are on you (never two on a phone), with a 0.45 to 1.0 s breath between turns (0.7 to 1.3 s on a phone). Whoever has waited longest goes next. The rest circle you in a boxer's shuffle (the new looping `shuffle` action), spread round a ring and changing direction now and then.
- **Tells and feints**: before a strike they step in, and a heavy is drawn right back (the new `haymaker` and `overhead` actions). The tell lasts about 0.34 s for a light strike and 0.62 s for a heavy, shorter for skilled fighters. Up to 28% of strikes are feints. A blow lands only at its moment, and your defence decides it then (`melee.js incoming()`).
- **Their guard**: they sometimes block when they see your blow coming. That turns a light strike (20% gets through and they slide back) but not a heavy.
- **Onlookers**: people within 6.5 m flinch (the new `flinch` action). Those from 8 to 20 m stop and watch the fight, and about 40% film it with their phones out. Fist fights alarm civilians within 7 m (gunfire is still 25 to 35 m), so the crowd watches instead of scattering.
- **Takedown from behind**: within 1.7 m, behind them (more than about 115 degrees off where they face), and they are unaware. A squad member counts as unaware when not alert and not targeting you; a townsperson when not already fleeing, fighting or talking. You hold them in a choke (`choke` and `choked` actions) for 1.2 s, then they go limp for 22 s. A fighter knocked out this way is out of the fight: they wake surrendered and slip away later, and their squad is not alerted.
- **Police and arrest**: fists go through the law like any other crime. A blow on a townsperson is weighed by `combat.js yours()` and reported through `crime()` to the law (`law/index.js`), whose witnesses call it in. Its officers close in and arrest you the law's way: keep still, or put your hands up (H), and you are cuffed, booked and fined. Townsfolk fighting each other still report their brawl through `ctx.event`. Officers never join a fist fight: they are left to the law's own tactics. A blow on someone who has already struck you is self-defence (`blow.moral`, below): it is not counted as a crime.
- **Morality**: two new deeds in `combat/morality.js`.
  - `start-fight`: the first blow on a civilian not already fighting you.
  - `break-up-fight`: hitting or grabbing one of two townsfolk fighting each other, which ends their fight.
  Blows on someone who has already struck you carry `selfDefence` and `hostileTarget` through a new `blow.moral` field that `combat.js yours()` merges in. Those blows cost very little and are not counted as a crime.
- **Weapons of opportunity**: a pipe joins the bat and the bottle (`brawl.js BLOWS.pipe`, `improvised`). Every two to four and a half minutes in town, one of them is left lying within 7 to 15 m of you (never more than three about), to be picked up by walking over it, the same way as before. A bat splinters after 16 hits and a bottle shatters after 2. Drawing a weapon drops whatever you were holding.

## Phones and performance

The per-frame paths allocate nothing: the foe list, the turn queue (plain arrays), the fist poses (fixed `Float32Array`s and springs), the camera springs and the scratch vectors are all reused. The work that does allocate runs only on events or on a timer: the takedown scan every 0.15 s, the squad scan every 0.25 s, sound and flash per blow. `isPhone` sets the voice cap, the sound layers, how many fight at once and how many take turns, the gap between turns, the flash strength and how many people stop to watch.

## Wiring

- `main.js`: one line after the military, `combat.melee.bind({ avatar, self: you })`, so that in third person your own body blocks, chokes, gets cuffed and plays each strike.
- `combat.js`: the melee context gains `isPhone`, `player`, `input`, `speed`, `squads` and `deed`; civilians hear fists at 7 m (`civilians.js` too, for a townsperson struck by a fist); `yours()` merges `blow.moral`.
- `ai-squads.js`: `personStep` hands a squad member with `h.melee` set to the foes. It only moves the body, and the gun is put away.
- `people/motion.js`: `jolt()` and `S.freeze` (hit-stop). `people/actions.js`: `block`, `shuffle`, `haymaker`, `overhead`, `flinch`, `getup`, `choke`, `choked`, `cuffed`.

Console: `Crysis.combat.melee.info()` (now with foes, turns and watchers), `.spar(n)` (the nearest n grown-ups square up to you), `.swing('heavy')`, `.block(true)`, `.dodge()`, `.takedown()`.

## Tests

`island/tools/melee.test.mjs` covers the strike phases and the buffer and follow windows, the string, heavy charge and counters, parry, block, guard break and dodge grace, which side a blow came from and how hard it takes someone, hit-stop limits, takedown geometry, turn-taking (the longest waiting goes first, the breath between turns, two at once only with four or more and never on a phone), the fight deeds and their scores, and the pipe.
