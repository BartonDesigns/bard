# Skills and magic menu (October 16, 2026)

The owner asked for a spell-learning interface that is open from the player's menu at any time,
with levelling up and points, laid out like Skyrim's skill constellations: each skill category on
its own page in full view, sliding between pages, slotting in the next skills, and a clear
understanding of what each one does. It had to be of AAA quality and perform well on phones and
laptops.

## Opening it

- **Tab** or **N** (N was the spellbook's key; K is the morality compass and L the target lock).
- **✦ Skills and magic** at the top of the places menu.
- A tap on your fabric at the end of the spell bar (phones). A green **+n** there means skill
  points are waiting.

It opens wherever you are on foot. While it is open the fight holds still (`combat.update` is
skipped) and the world is not drawn under it (`magic.covering()` in `main.js`), so the menu costs
the phone almost nothing.

## Pages

Fourteen pages, each a constellation over its own nebula:

- **Light:** Radiance, Restoration, Warding, Dawn
- **Dark:** Shadow, Void, Blight, Umbral
- **Twilight:** Storm, Chrono, Primal
- **Body:** Marksman, Athletics, Resilience

Each page shows the skill's rank (0 to 100) with a bar to the next, its strand, and a faint figure
that gives the page its shape (a lance, a shield, a crescent, a spiral, an hourglass, a bow). The
stars are the spells (circles) and the perks (diamonds), joined by lines:

| Star | Means |
|---|---|
| Bright, with a flare | Known or unlocked |
| Pulsing ring, flowing line to it | Ready to weave or unlock now |
| Grey ring | Its line is open but something is missing (fabric, rank, a point) |
| Faint | Out of reach: what it hangs from is not yours yet |

## Moving about

| Phone | Laptop |
|---|---|
| Swipe left or right between pages | ← → (or A D, Q E), the arrows at the sides, the wheel or a trackpad swipe, or a drag |
| Tap a skill chip at the top to jump | Click a chip; Home and End for the first and last |
| Tap a star to read it | Click a star; ↑ ↓ (or W S) step through the stars |
| Tap the sheet's handle (or swipe it up) for all its numbers | Everything shows in the side panel |
| Weave or Unlock button | Enter, or a double-click on the star |
| Slot buttons 6 to 0 | The keys 6 to 0 |
| ✕ | Tab, N or Esc |

## What a star tells you

- **Spells:** a small looping picture of the spell at work (a bolt flying, a beam held, a ring
  bursting, lightning leaping from foe to foe, a ward catching a blow, and so on), then its
  numbers as they are for you now: harm, harm a second, healing, what a ward absorbs, mana,
  cooldown, reach, radius, how long it lasts, and what it does to those struck (holds,
  frightens, slows, rots). When your perks change a number the old one is shown struck through.
  A line says how strong it is just now and why (time of day, affinity, perks).
- **Perks:** each effect in plain words, and the effect on one of your own spells, before and
  after (for example "On Sunspark: harm 28 → 32").
- **What it takes,** ticked or crossed: the spell or perk it hangs from, fabric, twilight
  affinity, the rank, a skill point.
- A known spell has **Slot to key** buttons for 6 to 0.

## Levels, points and ranks (`magic/skills.js`)

- **Experience** comes from the mana you spend casting, the fabric you weave (and gather), the
  harm your weapons deal, the harm you live through, the ground you cover on foot (a point every
  15 m, not flying or riding), mercy (25) and kills (10).
- **Levels:** 100 experience to level 2, then 35 more for each level after. A level gives one
  skill point; you start with one. Going up a level shows a banner and plays a chord.
- **Ranks:** each skill's rank rises with its own use: a school with the mana spent on it (and
  fabric woven into it), Marksman with weapon harm, Athletics with ground covered, Resilience with
  harm taken. Rank r takes 5·r^1.5 use (rank 20 ≈ 450, rank 70 ≈ 2,930).
- **Spells** are still woven with aether fabric as before (`magic/spells.js`). **Perks** take a
  skill point, the node they hang from, and a rank.

## Ultimates

A tier 5 spell is a school's ultimate: it needs a tier 4 spell of its school, like any other step
on the ladder, and also the school's highest rank (100). `skills.js` adds the rank rule
(`spellBlock`), and the menu and `onWeave` check it before weaving. An ultimate's star is larger,
ringed with a slow halo, and its info says "Ultimate spell".

**Gargantua** is the Void's ultimate. Josh asked for a black hole on the horizon that drags every
hostile NPC in over 10 seconds and takes 25% off a boss. The spell itself (its numbers, its
in-world effect, its weave cost) is being built on the spells branch. This branch keeps its star
at the top of the Void spiral, above Event Horizon (`LAYOUT.void.spells.gargantua`), and an
animated preview keyed on the id `gargantua` (or the kind `singularity`). The star appears once
the spell is in the book.

## The perks

65 perks, 4 or 5 on each school and 6 on each body page. They are a stat, a share and a scope (a
school, a strand, or everything), summed into `state.mods`:

- **Spells:** power, mana cost, cooldown, duration, area, reach, and how long holds, fear and rot
  last. `spells.js` reads them in `spellPower`, `manaCost`, `cooldownOf`, `manaMax` and
  `manaRegen`, and `shaped()` gives the caster a copy of the spell with its duration, area,
  reach and statuses stretched (the catalog is never changed).
- **Fabric:** a quarter more light (Aether Sense) or dark (Dark Eyes) from each mote and well.
- **Body:** running pace, jump, gentler falls (`player.state.speedK`, `jumpK`, `fallK`), less
  harm taken (up to half), life coming back out of a fight, weapon harm, head and weak-point
  hits, harm to bosses, mana for each weapon hit, and more experience.

Weapon perks reach the fight through a new door, `combat.hooks.power(T, blow)`, which reshapes a
blow your weapons deal (spells already pass their own power).

## Kept between visits

Level, experience, perks and each skill's use are kept with the rest of your magic (`l99-magic`).
On load, unknown perks, perks whose parent is gone, and more perks than points are dropped.

## Console

`Crysis.magic`:
- `.skills.open('void')`: open on a page.
- `.xp(500)`: experience.
- `.use('radiance', 900)`: use of a skill (ranks).
- `.perk('searing-light')`: take a perk.
- `.info()` now has `level`, `xp`, `points` and `perks`.

## Tests

`node --test island/tools/skills.test.mjs` (7):
- every page is a whole constellation (spells placed, perks hung from nodes on the same page,
  stars apart, figures valid, words for every effect);
- ranks from use, to 100;
- levels, points and experience carried over;
- what a perk takes (point, parent, rank, either of two parents);
- the perks on the spells' rules, and the catalog left alone;
- kept between visits, rubbish dropped, perks trimmed to the points;
- the keys, the places menu, the fight held and the world not drawn while it is open.

## Performance

- Built once, the first time it opens. 14 pages, about 150 buttons, one SVG of lines per page.
- Movement is transforms and opacity only. The looping animations (pulses, twinkles, flowing
  lines, drifting nebula) run only on the page in view, and not at all with reduced motion.
- One small canvas draws the stars (140 on a phone, 260 on a laptop, at most 1.25× pixel ratio
  on a phone) with a parallax as pages slide, and the spell picture. Both stop when it closes.
- The world is not drawn while it covers the screen.

## Not done yet

- Perks cannot be refunded.
- The game does not pause entirely while it is open: the fight holds, but traffic and people go
  on.
- Opening it while driving, on a boat or in another full screen is refused with a hint.
