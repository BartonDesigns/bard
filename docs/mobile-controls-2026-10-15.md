# Mobile controls (October 15, 2026)

The owner plays on an iPhone and asked for the touch controls, in portrait and landscape, to lose
the words under them and become minimal, semi-transparent buttons. This pass gives every touch
control in the game one look and one layout, in both orientations, without changing what any of
them does. The mouse and keyboard are untouched, apart from a few tooltips.

## How it works

`island/src/ui/touch-skin.js` is the one place that decides how the touch HUD looks and where it
sits. `main.js` calls `skinTouch(dom.mount)` once, right after `buildDom()`; it only does anything
when the mount has the `l99-touch` class (a phone, or a coarse pointer). Every module still makes
its own buttons and keeps its own bindings.

- A MutationObserver on the mount looks at each button as it is added, docked, renamed or given
  new words. A button straight in the mount, or in one of the HUD's groups (`l99-thumb`,
  `l99-quick`, `l99-prompts`, `l99-left`, `l99-pair`, `l99-pad`), is matched by its name (its
  `aria-label`, `title` or words) to a glyph in `RULES`, and marked `data-skin` and
  `data-glyph`.
- The glyphs are 24 px line drawings kept as SVG strings in `GLYPHS`, drawn in CSS as an inline
  `data:` SVG mask over a white fill. No icon font and no external file.
- Buttons inside the controls menu, panels and dialogs keep their words (they are lists you read).
  Every other button in the HUD shows a glyph and never words: one nothing here knows (a quest's
  changing action, a colony errand, the friends chip) gets the general "act here" glyph, a
  pointing hand, and keeps its name for screen readers.
- Names: every dressed button keeps its `aria-label`. A button that had none is given its own words
  as its name (without emoji, key hints or arrows), and the name follows the words as they change;
  a button that leaves the HUD gets its words back and the given name is taken off. A title is set
  where there was none, for the desktop tooltip.
- Context: a quarter-second check sets `l99-c-drive` (the pedals are showing) and `l99-c-fish`
  (the cast button is showing) on the mount, so the CSS can hide what does not apply (no fists
  or weapon buttons while the rod is out, since the cast takes the primary place; no fists, weapon
  buttons or jump while driving). Put the rod away (the rod button) to shoot again.
- `firstTime(key)` shows a tip once per device (once per visit when storage is blocked). The
  control tips on a phone now use it: moving and looking, boarding the boat, driving (per mode),
  each military vehicle, and "water here" for the rod.

All the skin's rules sit under `#l99-island-mount.l99-touch.l99-skin:not(#l99-none)`; the id in
`:not()` lifts them over the HUD's older touch rules in `main.js` without editing those.

## The look

- Round buttons: a dark translucent disc (`rgba(12,16,20,.32)`) with a 1 px light ring
  (`rgba(255,255,255,.24)`) and a faint shadow, a white glyph at 88% opacity. No backdrop blur
  (not cheap over the world on a phone).
- Sizes: the primary action 68 px; actions 52 px; the top bar and the fire mode 44 px; the
  steering arrows 64 px; a vehicle's gun 60 px. Nothing is under 44 px.
- Pressed: brighter fill, brighter ring, scaled to 94%. On (flying, aiming down the sights, the rod
  out, driving, music on, a lit takedown, the menu open): a teal fill and ring. The modules' own
  "on" colour (`#01a982`, inline) is read for this, as are `aria-pressed`, `aria-expanded` and the
  melee buttons' `on` and `lit` classes.
- Unavailable is hidden, not greyed (a `disabled` button is hidden). The one exception kept: Fire
  dims while reloading or empty, a moment's state rather than a control you cannot use.
- No words on or under any HUD button. The quick buttons' captions ("Fly", "Gear", "Places",
  "Controls"), FIRE, AIM, Strike, Block, Dodge, Grab, the rod's H, the pedals' arrows as text,
  "Sedan", "Assist", "⛵ Board", "💬 Talk", "🩹 Use", "🚪 Open", "✋ Surrender" and the like are
  all icons now. The fishing meter's line of instructions is hidden on touch (the bar says it).
  The ammo readout keeps only the count on touch (the weapon's name and the reload line are hidden;
  the Mode glyph shows the fire mode and Fire dims when empty).
- Changing captions are glyph changes: Grab becomes Takedown (a lit hand with a mark), or Throw
  (an arc); Strike becomes Swing (a bat, pipe or bottle) or Slash (a blade: the hunting knife and
  the machete); the cast button follows cast, hook and reel. Only the `aria-label` and title
  change with them.

## The layout

Measured from the safe area (notch, home indicator, rounded corners), the same in both orientations
unless said:

| place | where (from the bottom right) | size | what goes there |
|---|---|---|---|
| P | right 16, bottom 16 | 68 | Fire (Draw, Release for the bow), Strike (Swing with a bat), Go (the pedal), Cast/Strike!/Reel |
| L1 | right 100, bottom 24 | 52 | Aim, Block, Brake and reverse |
| D1 | right 90, bottom 90 | 52 | Reload, Dodge, a vehicle's gun or cannon (60) |
| D2 | right 144, bottom 144 | 52 (44 for Mode) | fire Mode, Grab / Takedown / Throw |
| L2 | right 164, bottom 24 | 52 | Surrender |
| column | right 24, from bottom 98 up | 52 | Descend, Jump/Climb/Dive/Swim up; then leave the car, the boat, the rod; then which car, assist, camera. Wraps leftwards when the screen is short |

- Left thumb: the resting stick bottom left (it still appears where your thumb lands). In a
  vehicle the stick gives way to Steer left and Steer right (64 px) at the bottom left; in an
  aircraft, Up and Down sit above them.
- Between the thumbs, in a row along the bottom: things to act on nearby (talk or help, use, doors,
  pick up, throw, put down, the tattoo studio, a service, a game to play). In landscape the row
  starts right of the ammo.
- Top row: back (chevron) on the left; music and sky and world settings on the right. In
  landscape fly, gear, places and the controls menu join the right of that row; in portrait they
  stand in a column down the right edge, under the quest's band.
- The quest's band: the quest chip ("Where Andre was robbed · 5 m · ...") has its own band under
  the top row, centred, as wide as the screen allows. Nothing sits on it: the skin measures the chip
  each quarter second and everything that sits under the top row (the left column with your home
  and the field contract, the portrait column of fly/gear/places/menu, the wanted stars, the
  driving read-out, the boss bar, the tips) starts below its bottom (`--qb`). A button some module
  places itself that still lands on the chip or the driving read-out is moved down below it.
- Tips: centred under the bands, clear of the side columns and the driving read-out (portrait top
  116 px, landscape 104 px, lower when the quest shows), never under a button. Wanted stars under
  the top row on the right.
- Safari's bars: the address and tool bars, shown or collapsed, are read from the visual viewport
  and added to the safe areas (`--vvt`, `--vvb`), so nothing sits under them.
- Health and ammo: above the stick in portrait (narrowed so they never reach the cluster on a
  320 px screen); along the top between the back button and the right-hand row in landscape.
- The controls menu (☷) still opens its sheet of labelled entries (the ways to go elsewhere, the
  explorer, flight speed, the rocket, games, the guide, credits). While it is open, everything but
  the top bar is hidden.

Rotation is live: the layout is all CSS (safe-area `env()` values and one landscape media query),
so it follows the device as it turns.

## Looking round

`island/src/ui/touch-look.js`, used by `player.js`:

- An acceleration curve on the look drag: its speed (smoothed over the last moves) sets the gain,
  0.7x for a slow, precise drag, 1x at an ordinary 0.6 px/ms, up to 2.6x for a fast swipe that turns
  far. The aim sensitivity in Sky and World scales it as before.
- Invert look up and down, and gyro aiming, as two switches in Sky and World on a touch screen
  (kept on the device). The gyro reads the device's turn rate (DeviceMotion), about the screen's
  axes for the way it is held, and adds it to the drag; on iOS the switch's tap asks for the
  permission, and with it left on, the first tap on the world starts it again in a later visit.
- The view drifts back to level while you walk on the stick with no hand on the view for 1.5 s
  (never while aiming down the sights, flying or swimming).
- A double tap does nothing (the page's own zoom is off, `no-page-zoom`).
- The weapon's framing in portrait is the weapon view's own (unchanged): the scope and barrel sit
  right of and below the crosshair, and the smaller, translucent cluster now covers only the grip
  and magazine. Moving the weapon up and toward the middle was tried and put the scope on the
  crosshair, so it was left as it is. The crosshair stays clear of every control.

## Per control

- **Move stick and look area**: the stick floats: it appears under the left thumb wherever it
  first touches in the lower left (the left 42% of the screen, below its top 35%), and its resting
  ring is only a faint hint. Everywhere else on the world is the free-look zone (the whole right
  two-thirds and the top), so the right thumb drags to look anywhere while the left thumb walks;
  both work at once (each touch is followed by its own pointer id) and a touch that starts on a
  button is the button's, never a look.
- **Fire, Aim, Reload, Mode** (`combat/hud.js`, `crysis/viewmodel.js`, `ui/gear.js`): icon
  only; the FIRE and AIM captions are gone and Fire keeps its icon when its name changes (Draw,
  Release, Nocking for the bow); Reload and Mode have titles; the Mode glyph shows one, two or
  three rounds for semi, burst and auto.
- **Jump, Climb, Dive, Swim up, Descend**: in the column above the primary, descend below climb.
  There is no separate crouch or sprint control on touch (the stick runs), so none was added.
- **Close combat** (`combat/melee-touch.js`): Strike, Block, Dodge, Grab round the primary; the
  word labels are gone; the name (and title) changes to Swing, Takedown or Throw, which also
  changes the glyph; the takedown is lit.
- **Surrender** (`law/index.js`): a flag icon at L2, named "Surrender" with the title
  "Surrender (H)", inside the safe area.
- **Driving** (`drive.js`): the pad is split, steering under the left thumb and go and brake under
  the right; the pad's names follow the mode (Steer left, Go, Brake and reverse when you drive
  yourself; Turn left next, Straight on, Turn round on the road assist). While you drive, the road
  button leaves the controls menu for the column as an exit icon ("Stop driving (V)"), with which
  car, assist and the camera above it.
- **Tank, jet, helicopter** (`military/drive-mil.js`): Fire or Cannon at D1 (60 px), Up and Down
  above the steering for the aircraft; the buttons carry `l99-mil` and `data-mil` for their places
  and titles for the desktop.
- **Boat** (`main.js` act button): Board and Leave as boat and exit icons in the column.
- **Fishing** (`fishing.js`): the rod in the column (lit when out), the cast/strike/reel button at
  the primary place with its glyph following the state, the meter's bar between the thumbs.
- **Interact and talk**: icons in the bottom row.
- **Quick buttons and the right rail**: fly, gear and places are icon discs in the top row with
  music and settings; the controls menu button shows a grid, and a cross while open.
- **Back and contracts** (`combat/contracts-view.js`): back is a chevron; the idle contracts card
  folds to a clipboard icon (`cv-idle`), opening to the brief and to the mission's objective as
  before.

## Checking it

- `island/tools/touch-skin.test.mjs`: every control's name maps to the expected glyph and every
  glyph has a drawing; a first-use tip shows once.
- `island/tools/touch-look.test.mjs`: the curve, the gyro's axes in each orientation, the pitch's
  easing.
- `island/tools/mobile-controls-browser.cjs`: now applies the skin as `main.js` does, shows the
  real quest chip, and fails if any control covers the quest text or if any HUD button shows words, a caption (`::after`) or a visible label element inside it, that each has a name and is at least 44 px, that the top bar,
  Fire, Reload, Mode, Aim, Jump, Fly and the menu do not overlap and stay on screen at 390x664,
  844x390, 844x320, 320x568 and on the desktop (where the skin stays off), plus the menu and the
  contract panel as before.
- Real page, touch emulation, iPhone 14 sizes (390x844 portrait, 844x390 landscape) at device pixel
  ratio 3 with the notch and home indicator insets (47/34 portrait, 47/47/21 landscape): before
  and after screenshots of each state, listed in the hand-off.

## Not changed

- What any control does, its keys, or the desktop HUD.
- The controls menu sheet, the settings panel, the places and games lists, the compass, the loot
  card and the contract brief keep their words: they are lists and cards you read, opened on
  purpose.
- The status read-outs that are not controls: the driving line (street and speed) at the top
  centre, the boss bar, the call-outs, a field contract's objective while one is on, and the
  first-use tips, all clear of the buttons.
