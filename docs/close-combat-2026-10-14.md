# Close combat, October 14, 2026

Fists, blocks, dodges and takedowns now work like a modern action game, everywhere in the engine. They build on the security pass's melee (`combat/melee.js`, `combat/brawl.js`), the police and dispatch (`military/police.js`, `military/dispatch.js`) and the people's rigs (`people/motion.js`, `people/actions.js`).

## Controls

| | Desktop | Touch (phone) |
|---|---|---|
| Light strike (jab, cross, hook string) | Tap left mouse, or tap Q | Tap **Strike** |
| Heavy strike (charged) | Hold left mouse, release to throw | Hold **Strike**, release |
| Block | Hold right mouse | Hold **Block** |
| Parry | Raise the block just as a blow lands (0.16 s window) | Same, with **Block** |
| Dodge | C, with WASD for the direction (back if none) | **Dodge**, with the stick for the direction |
| Takedown from behind | Q when the "Q Takedown" prompt shows | **Takedown** (the Grab button lights up) |
| Grab, then throw | Hold Q; tap again to throw | **Grab**, then **Throw** |
| Shove | X (unchanged) | |
| Bat, pipe, bottle | Walk over one to pick it up; strikes swing it, a hold brings it down overhead | Same |

On a phone the cluster shows only while you are unarmed. **Strike** is always there, in the Fire button's place above the jump. **Block**, **Dodge** and **Grab** join it once a fight is on (or when a takedown is possible). The cluster sits relative to `--l99-low`, the top of the thumb's stack, so it moves up when the boat or rod buttons show. It hides while the controls menu is open, while driving and while holding a weapon. The weapon's Fire, Aim, Reload and Mode buttons are hidden while unarmed, so the two sets never overlap.

## Feel

- **Timing** (`combat/melee-rules.js MOVES`): each strike has a wind-up, an active moment when it can land, and a recovery. A jab is 0.30 s from press to ready, a hook 0.48 s, a heavy 0.82 s. A press late in a strike is kept for the next one in the string (`canBuffer`), and the next starts during the recovery (`canFollow`). Holding past 0.22 s turns the press into a heavy, drawn back while held and charged up to 1.6 times the damage.
- **Hit-stop**: a landed blow holds still for 45 ms (light), 65 ms (an item) or 85 ms (heavy), 110 ms on a parry. Your fists stay at full extension and the struck body freezes through the motion rig (`motion.js S.freeze`) before the reaction plays.
- **Camera**: a blow you land dips and rolls the view; one you take snaps it away from the attacker; a block shoves it back (`combat/melee-feel.js`, springs added on top of the view each frame).
- **Flash**: a faint vignette at the screen edges. It is warm on heavy blows you land, pale on parries and red on hits you take. It is gentler on phones and is driven by the Web Animations API, so nothing runs per frame.
- **Sound** (`combat/melee-sound.js`): every piece is synthesised once per audio context into a buffer, the same way `bay/bridgesound.js` makes its knock, and played through `world/soundbus.js`. The pieces: swish, heavy swish, body thud, face slap and crack, heavy crunch, block clack, parry clap, bat thock, pipe clang, glass, body fall, grunt, breath, dodge scuff. Each blow plays two or three of them layered, pitched and levelled at random each time, panned left or right and dulled with distance. A phone plays fewer layers and at most 6 voices (14 on desktop).
- **Your fists** (`combat/melee-view.js`): procedural forearms and hands (knuckles, a wrapped thumb, wrist, forearm, a sleeve with a cuff), coloured from your own body's skin and top. They hold a breathing guard that bobs with your steps. Each strike moves through three key poses on its own timing. A block covers the face, a dodge tucks the arms, a takedown wraps the right arm round the throat, and an item is held two-handed.
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
- **Police and arrest**: punching a townsperson where someone can see reports a fight to dispatch (`hooks.event({ kind: 'brawl' })`, at most once a minute), so a cruiser comes. Officers within 70 m after a fight of yours (with wanted at 2 stars or less and your hands empty) try to arrest you rather than shoot. They close round you and order you down.
  - Keep still for 2.4 s within 3.6 m and you are cuffed (1.8 s, held in place), fined 40 credits plus 25 for each person hurt (never more than you have), and your wanted level is cleared.
  - Strike or swing at them and you have resisted: they fight you hand to hand while you stay close, and you get at least one star.
  - Run more than 32 m and you are wanted (one star).
- **Morality**: four new deeds in `combat/morality.js`.
  - `start-fight`: the first blow on a civilian not already fighting you.
  - `break-up-fight`: hitting or grabbing one of two townsfolk fighting each other, which ends their fight.
  - `submit-arrest` and `resist-arrest`.
  Blows on someone who has already struck you carry `selfDefence` and `hostileTarget` through a new `blow.moral` field that `combat.js yours()` merges in. Those blows cost very little and do not raise the wanted level.
- **Weapons of opportunity**: a pipe joins the bat and the bottle (`brawl.js BLOWS.pipe`, `improvised`). Every two to four and a half minutes in town, one of them is left lying within 7 to 15 m of you (never more than three about), to be picked up by walking over it, the same way as before. A bat splinters after 16 hits and a bottle shatters after 2. Drawing a weapon drops whatever you were holding.

## Phones and performance

The per-frame paths allocate nothing: the foe list, the turn queue (plain arrays), the fist poses (fixed `Float32Array`s and springs), the camera springs and the scratch vectors are all reused. The work that does allocate runs only on events or on a timer: the takedown scan every 0.15 s, the squad scan every 0.25 s, sound and flash per blow. `isPhone` sets the voice cap, the sound layers, how many fight at once and how many take turns, the gap between turns, the flash strength and how many people stop to watch.

## Wiring

- `main.js`: one line after the military, `combat.melee.bind({ avatar, self: you })`, so that in third person your own body blocks, chokes, gets cuffed and plays each strike.
- `combat.js`: the melee context gains `isPhone`, `player`, `input`, `speed`, `squads`, `witnessed`, `wanted`, `deed`, `credits` and `pay`; civilians hear fists at 7 m; `yours()` merges `blow.moral`.
- `ai-squads.js`: `personStep` hands a squad member with `h.melee` set to the foes. It only moves the body, and the gun stays out only while they are arresting you.
- `people/motion.js`: `jolt()` and `S.freeze` (hit-stop). `people/actions.js`: `block`, `shuffle`, `haymaker`, `overhead`, `flinch`, `getup`, `choke`, `choked`, `cuffed`.

Console: `Crysis.combat.melee.info()` (now with foes, turns, arrest and watchers), `.spar(n)` (the nearest n grown-ups square up to you), `.swing('heavy')`, `.block(true)`, `.dodge()`, `.takedown()`.

## Tests

`island/tools/melee.test.mjs` covers the strike phases and the buffer and follow windows, the string, heavy charge and counters, parry, block, guard break and dodge grace, which side a blow came from and how hard it takes someone, hit-stop limits, takedown geometry, turn-taking (the longest waiting goes first, the breath between turns, two at once only with four or more and never on a phone), the arrest steps (comply, resist, flee, a weapon is not keeping still) and the fine, the fight deeds and their scores, and the pipe.
