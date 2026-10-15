# Storefronts and daily life (14 October 2026)

The economy (docs/economy-2026-10-13.md) made a third or more of every town's buildings
businesses with names and boards, but many still read as houses with a small sign, their
insides followed the old building kinds, the regional kit's towns (Japan, the small European
villages) were left out, harbour trades were rare in coastal towns, and a person's stated
wealth disagreed with their bank balance. This pass makes a business read as one from the
street and from inside, plans the regional towns too, finds the coast properly, reconciles
wealth with the bank, and gives the working day to the people walking about.

## What a business shows (economy/frontage.js, pure)

Every one of the 80 or so types has a profile: its front (`glass` a glazed shopfront,
`office` an office window with blinds, `lodging` a porch and its desk, `bays` roll-up doors,
`home` it stays a house, `none` its own building), what can be seen through the glass (one of
22 display kinds), its hours (a quarter of an hour jitter per building so a street does not
open at once), what it does after hours (`shutter` rolled down, `night` a dim light left on,
`dark`, `lit` the sign and room stay on), weekend closing for offices, its outdoor seating,
who stands out front while it is open, and how its rooms are fitted out.

- `stateAt(E, hours, dow, out)`: open, lit (1 open, 0.7 opening, 0.6 closing up, 0.18 a night
  light), shutter (0 up to 1 down, rolled over twenty minutes), the phase. Fills `out`, so the
  once-a-minute refresh makes no garbage.
- `frontSpec(use, run, wallH, style)`: the glazing on the face. A house gets a shop window
  under its eaves (at most 8.5 m, at least 0.7 m of wall either side, kick plate 0.42 m, head
  at most 2.55 m and 0.75 m under the wall top); a shopfront row its glass from 0.45 to 3.3 m
  under the city's sign band; a big box up to 22 m of glazing; a block of flats a shop in the
  middle of its ground floor; a workshop its bays. `fasciaOf(spec)` fits the board into the
  wall above the glass (about a quarter as high as wide, never above the wall top).
- `gapRoom(gap, use)`: how far out things may stand: the gap to the kerb (measured from the
  mapped and grown towns' streets, economy/layer.js `gapAt`) less 1.8 m of pavement kept clear.
- `postsFor`, `shiftOf`, `phaseOf`, `lifeAt`: the staff spots out front, a worker's shift
  (in half an hour before opening, out forty minutes after closing, at most ten hours, lunch in
  the middle), and the town's mix of errands by the hour (the walk in to work peaks at 08:06,
  lunch at 12:36, home at 17:36; shopping 09:00 to 20:00; the evening out after 18:30).
- `coastScan(H, x, z, sea)` and `coastClass`: the coast from rings of twelve samples out to
  1.6 km (two dry outer rings reject inland in 24 samples); 3 on the waterfront (200 m), 2 by
  the harbour (480 m), 1 near the coast.

## Drawn (economy/storefront.js)

All instanced: one draw for every shopfront's glazing, one for the fascias, one for the
awnings, one per kind of pavement thing.

- The glazing is a plane a few centimetres proud of the wall. Its fragment shader draws the
  frame, mullions every two metres or so, a transom, the kick plate and a glazed door with its
  handle, the roller shutter rolling down from its box, an office's blinds, a workshop's bay
  door; and through the glass a room (interior mapping: the eye's ray into a box as deep as
  about 60% of the building): the back wall and sides by display kind (shelves of goods,
  books, a bar's bottles on a mirror, menu panels, garments on a rail, gear on pegs, a salon's
  mirrors, washing machines, a pegboard of tools, a guest house's key board), a lit ceiling
  with lamps, the floor; and standing in the room the counter with the person behind it while
  it is open, tables with people at them (fewer late), desks, mannequins or gear racks, a car
  on its lift, a hull on its cradle. By day the room is dim (daylight through the window),
  after dark it is as lit as `stateAt` says (warm), at a glancing angle the glass reflects
  more and shows less. When a building's rooms are built for real near you (interiors/,
  bay/houses.js, commercial.js; city.js `setBuilt`), its painted shopfront is hidden.
- Fascias: a box behind the name board, in the board's colour a shade darker, over every
  glazed front (the boards are still economy/layer.js's atlas, now sized to the facade).
- Awnings: sloping canvas with a valance and cheeks, striped or plain in the business's
  colours, over a house's new shop window (the city's own flat awnings stay on its rows).
- The pavement: A-frame boards by the door (taken in when it shuts), bistro sets (a round
  table and two chairs in the awning's colours) where the room allows, umbrellas (furled when
  shut), planters either side of a main-street shop, a bike rack by cafés and bike shops, a
  parking sign by a converted house's drive, pallets by a workshop's doors. The old lotkit
  tables, umbrellas and boards are no longer used for businesses; their other props (antlers,
  outriggers, nets, kegs, crates, cars, menu boards, monuments) stay, and the staff posts use
  them (the mechanic by the car, the fisher by the boat).

Cost: on a desktop 420 shopfronts, 840 fascias, 420 awnings, about 1,900 pavement things;
a phone 160, 320, 160 and about 600 (no bike racks). Fronts are made within 380 m (200 m on
a phone). The state refresh is once a game minute plus a half-second check for built rooms.

## Interiors (interiors/estab-fit.js, estab-kit.js)

The businesses' fit-outs serve all three kinds of building built inside:

- flats over shops (plan.js planRow, furnish.js shopFit) and the halls (bigFit, a store's
  front region): `P.estab` from the economy (interiors/index.js);
- houses that are businesses (bay/houseplan.js `opt.estab` from bay/houses.js): the ground
  floor's rooms re-typed (`houseRoles`: the living room the front, the dining and family rooms
  more of it or a breakfast room, lounge or waiting room, the kitchen a commercial kitchen or
  stockroom, a den the office, the garage the workshop or store), the front rooms' windows
  made low wide shop windows, no curtains or blinds on them; a guest house's bedrooms get
  luggage racks.

Front of house by fit: café and counter (the counter with espresso machine and till, the
menu board over it, a pastry case, a booth, little tables), bakery (two cases, bread racks),
restaurant, pizzeria, diner, sushi (host's stand by the door, booths down a side wall, tables,
the pass on the wall shared with the kitchen, a pizza oven, a diner's counter with stools, a
sushi bar with its glass case), pub and tasting room (the back bar of bottles with the bar
counter in front, stools, a booth), books and records, florist, grocer and general store,
hardware, pharmacy, pet, liquor, gift, antiques, gear and bait (walls of rods and paddles, a
canoe on the wall, a live bait case), clothes and tailor (rails, mannequins in the window, a
mirror), butcher and fish market, salon and barber (mirror stations with chairs, a basin at
the back, waiting chairs), laundromat, gym and yoga, clinic, dental, office, studio,
reception and B&B (the front desk with the keys on the wall behind it, armchairs, a luggage
rack), breakfast room, lounge, garage and workshops (a lift with a car up on it, the tool
chest, the pegboard, the tyres), daycare. Back of house: kitchen (range and hood, fryer,
fridge, prep table), bakehouse (deck oven), stockroom, workshop, office.

Lighting is not touched (materials, lamps and shadows belong to the interior lighting work).
Instead each fit-out records where its lamps would hang: `P.lightAnchors` / `plan.lightAnchors`
entries `{ kind, x, y, z, room, level }` with kinds `pendant` (over tables and booths),
`counter`, `heatlamp` (over the pass), `track` (over shelves), `sconce` (by a salon mirror),
`task` (over a bench, a dentist's chair), `hood`. `W.interiors.lightAnchors()` gives the built
ones in world coordinates with their building and establishment id.

## The regional kit's towns

economy/layer.js `setRegional(fn)` (main.js passes the globe's regional settlements) reads the
built cells' lots every two seconds within 800 m (520 m on a phone), turns them into the
economy's buildings (`RTYPE`: shophouses and neon blocks are shopfronts, a store is retail,
a townhouse a row, the rest houses with their wall height and floor), plans them with the
place's locale (Takayama gets ramen, izakaya and sushi; Honfleur bakeries and bistros) and
shows them: boards, fronts, the pavement's things. `Crysis.economy()` reports `regional`.

## The coast and the harbour trades

The coast was two rings of eight samples at 170 and 380 m against a sea level of 0.1 m on the
globe; Eureka's waterfront stands on DEM only a metre or so above its bay and Half Moon Bay's
centre is a kilometre from the sea. Now: rings out to 1.6 km against half a metre on the globe
(`setSea(fn)` takes the globe's own sea test if one is wired; none is yet), cached per 40 m cell; buildings carry `shore` 0 to
3. establishments.js weights the water's trades (outfitter, bait, seafood, surf, fish market,
boatyard, gift, ice cream) twice over plus a share on the waterfront and a smaller share near
the coast in any setting but downtown and the woods; a fish market can now take a waterfront
house or shopfront. `Crysis.economy().harbour` counts them near you.

## Wealth

people/npc-money.js: with the bank attached, `wealth(id)` comes from `bank.standing(id)`
(balance over a week's costs) through `wealthOfStanding`, on the same steps as the bank's
own mood words: broke below -0.8, struggling to -0.3, getting by to +0.37, comfortable to +1,
flush beyond. The 150-credit scale stays only for the stand-in balances before the bank is
attached. `standing(id)` is passed through.

## Daily life (economy/daily-life.js, people/people.js)

`addLife(fn)` in people.js takes a source of the working day (main.js wires
`createDailyLife(economy)`): once a second within 90 m, the staff spots of the businesses open
now and the doors (just in at the facade, out at the kerb). New arrivals among the walkers may
be cast as:

- staff out front (capped at 8, 3 on a phone): the server by the tables, the mechanic
  crouched at the car, the fisher at the boat, the shopkeeper at the door, the baker or a
  smoker on a break, the host on the porch; held in place with their pose and the odd
  gesture; when the place shuts they walk in through its door;
- people coming out of a door (customers of the open places, staff of the ones just shut,
  people back from lunch) who walk out to the kerb and on along the street;
- people walking to a door (in to work in the morning, to lunch, to shop, an evening out) who
  go in (fading at the door).

Inside, the fit-outs' staff spots (behind the counter, at the range, at the chair) are among
the seats the existing venue logic fills, so a café built near you has someone behind its
counter and people at its tables. Cost: no per-frame allocation in the steering; everything
is near you and capped.

## Hooks for other systems

- Environmental graphics: every business's `E.anchors` (and `economy.anchors(x, z, r)`): the
  door glass (`door`, 0.92 x 2.05 m), the hours spot beside it (`hours`), the window
  (`window`), the fascia (`fascia`, surface `board`), the A-frame's face (`aboard`,
  `chalkboard`): world position, the way it faces (nx, nz), size, surface, establishment id,
  hours. Vinyls, hours stickers, aisle signs and price tags are theirs.
- Interior lighting: `lightAnchors` (above).
- `economy.raw(x, z, r)`: the establishments themselves (hours, posts, doors, face).
- `economy.tick(cam, hours, night, dt)` every frame (main.js).

## Files

New: `island/src/economy/frontage.js`, `storefront.js`, `daily-life.js`,
`island/src/interiors/estab-fit.js`, `estab-kit.js`, `island/tools/storefronts.test.mjs`.
Changed: `economy/layer.js` (fronts, fascias sized to the facade, the coast, gap to the kerb,
staff posts, anchors, the regional towns, tick), `economy/establishments.js` (shore weights),
`interiors/furnish.js`, `interiors/index.js`, `interiors/kit.js` (`hasKit`),
`bay/houseplan.js`, `bay/houses.js`, `bay/city.js` (`setBuilt`), `people/people.js`,
`people/npc-money.js`, `main.js` (three grouped lines: tick, regional source, daily life).

## Left to do

- The regional towns' fronts sit on each structure's bounding face; a deep veranda or a
  set-back door can leave the glazing in front of posts.
- The far shopfront shows people as silhouettes; the real people are only in rooms built near.
- Commuters are cast near you; nobody is followed from home to work across town.
