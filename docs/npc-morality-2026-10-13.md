# People on the compass (13 October 2026)

People now have dispositions of their own, do quests for each other with or without you, and their deeds move their own standing and their region's tally. It runs wherever the shared people pool has people: the Bay's towns, the globe's towns, the island village and other worlds' settlements.

## Files

- `island/src/people/disposition.js`: a person's disposition (pure).
- `island/src/people/moral-regions.js`: regions grouped like area codes, and a town's situation (pure).
- `island/src/people/npc-money.js`: a small adapter in front of the economy's bank (`economy/bank.js`, attached at merge); until then a stand-in keeps balances in memory.
- `island/src/people/npc-quests-core.js`: the shared quest descriptor, sources, deciding, settling, far-away ticks, scene lines (pure).
- `island/src/people/npc-quests.js`: the runtime: scenes you can see, the bag left alone, favours among people, the far tick, the debug view.
- `island/src/combat/morality.js`: new deeds (`return-bag`, `steal-bag`, `take-from-thief`, `return-stolen`, `keep-stolen`, `betray-errand`, `pocket-cash`) and `createCommons`, the ledger of everyone else's deeds. The player's compass scores exactly as before.
- `island/src/people/errands.js`, `errands-core.js`: `theft()` for a theft by someone else in front of you; the snatch is now neutral to catch and only giving it back is a good deed; a favour you turn down is handed to the people about.
- `island/src/people/chatter.js`, `chatter-lines.js`, `island/src/guide/guide.js`: people mention what they did or saw lately, and money facts from the bank's `moneyTalk`, in passing and in conversation.
- `island/src/people/bag-spots.js`: where a bag gets left (benches, bus shelters, cafe and restaurant tables and doorsteps, park benches and picnic tables), the words for each, and the establishment provider (pure).
- `island/src/people/npc-leads.js`: leads from thefts out of your sight: the words and the book of leads (pure).
- `island/src/bay/streetlife.js` `seatsNear`, `island/src/bay/parkkit.js` `seatsNear`: the benches, shelters, park benches and picnic tables near a point, read back for the bags.
- `island/tools/npc-morality.test.mjs`, `island/tools/npc-quests-more.test.mjs`: tests.

## Dispositions

`disposition(seed, { region, world, situation, standing, wealth })` gives the four compass axes (mercy, law, protect, honest), each -1 to +1, plus `good` (their mean), `greed`, `nerve`, `reliable` and `pace`. The seed (the body's `dna.seed`, the same one the persona grows from) sets a general goodness and each axis around it, so most people are decent and a few are not. Then:

- the region's tally pulls hardest (a region that has gone bad makes its people worse), the world's tally lightly;
- the town's situation: more trouble lowers law and honesty and raises greed;
- their own standing (their deeds so far): people become what they do;
- their balance (through the money adapter, so the bank's household balance once attached): the hard-up are tempted more, the comfortable less.

`chooseDeed(d, tempt, roll)` says `help`, `betray` or `pass`; `followThrough(d, roll)` says whether they finish. A few numbers per person, cached for 8 s.

## Regions

The Bay's places (`bay/places.js`) are grouped by county, the way area codes group them: the City and the Peninsula (SF, San Mateo), Marin, the East Bay (Oakland, Berkeley, Richmond, Hayward, Fremont), the Diablo and Tri-Valley towns over the hills (Walnut Creek, San Ramon, Pleasanton, Livermore, Concord), the South Bay, the North Bay and Santa Cruz. On the globe a region is the atlas region plus a cell about 150 km across, named for its biggest atlas town ("the Lyon area"). The island village and each other world are a region each.

A town's situation (`situationOf`: trouble and means, 0 to 1) is not survey data: it grows from the town's size, the kind of street (downtown, office, industrial, quiet...) and a hash of the town's name, so it is the same every visit.

Each region keeps a tally on the four axes in `createCommons` (localStorage `l99-commons-v1`): NPC deeds count 0.15 of their score, your deeds 0.5 (through `commons.follow(morality, regionNow)`; your compass itself is unchanged). Each deed first settles the tally 0.4% towards the middle, so a region is what it has done lately. A world tally gathers every region's deeds more lightly. Each person's own standing is kept for the 300 seen most lately.

## One descriptor for every quest

```
{ id, kind, title, giver: { type: 'business'|'person', id, name, x, z },
  steps: [{ do: 'go'|'pickup'|'deliver'|'talk'|'wait'|'fix'|'chase', at: { x, z, name, establishmentId? }, item?: { name, shape } }],
  reward: { credits, from }, deeds: { done, betray? }, tempt: 0..1, region, expires }
```

Sources are `{ id, near(x, z, r), take(id, takerId), complete(id, takerId, outcome) }`, added with `HOOKS.npcQuests.addSource(src)`. The favours are one source (`favourQuest` wraps lost item, catch, pass, repair, the lost dog and snatches); bags left alone are another (`bagQuest`). `fromRequests({ requestsNear, takeRequest, completeRequest })` turns the economy's requests into a source; the main session adds it at merge. Outcomes passed to `complete` are `done`, `betray` or `abandon`.

Who takes one is their disposition's: the helpful and the greedy say yes, the honest finish, the tempted (tempt times greed, against honesty and law) run off with it, the unreliable drift off halfway. Done pays the taker the reward (a `transfer` from the giver if the giver is a person, an `earn` from the business otherwise) and records `deeds.done` on their compass and their region's; betrayed `earn`s them the loot (kind `theft`) and records `deeds.betray`, and what they took can be got back (below).

## Near you: scenes

- **A bag left alone:** every 70 to 140 s (150 to 240 on phones) a grown-up walking near a bench, a bus shelter, a cafe or restaurant (its table or its doorstep), a park bench or a picnic table 12 to 50 m from you walks to it with their bag in hand, sets it down and walks on (below, Where bags are left); with nothing like that about, they set it down on the sidewalk. Grown-ups passing within 7 m notice it, each once. One may pick it up, call the owner back ("Excuse me! Your bag!"), walk it over, hand it back and be paid (a `return-bag` deed); one may pocket it and walk off quickly (`steal-bag`). If nobody bothers within 45 s the owner comes back for it. Walk away (95 m) and it resolves among the people still there.
- **Favours among people:** now and then someone asks another person nearby (lost item, carry something over, catch a friend, fix a car), and favours you turn down are offered to the people about. The giver waits; the taker walks the steps with the thing in hand.
- **Business requests:** open requests from any source within 75 m are offered to the people near their first step.
- At most one scene on phones, two elsewhere, plus one bag. A scene that wanders 95 m from you, or loses its person to the world, finishes the way it was going to, out of sight.
- Children and teens are never givers, takers, owners, victims or thieves (`dna.child`, `dna.minor`, `dna.teen`).

## Where bags are left

`bag-spots.js` gathers spots near you: `{ kind, x, y, z, heading, place?, venue?, door? }`.

- **bench**, **shelter**: the street's benches and bus shelters (`world.street.seatsNear(x, z, r)`, read back off their instances).
- **park**, **picnic**: the park benches (including the ones round a playground) and picnic tables (`world.parks.seatsNear`, with the park's name: "left on a bench in Central Park").
- **doorstep**, **table**: cafes and restaurants from an establishment provider, `(x, z, r) -> [{ id, kind: 'cafe'|'restaurant'|'shop', name, door: { x, y, z, heading, inside, outside }, tables: [{ x, y, z, h, heading }] }]`. Until the economy's registry lands it reads the walk-in shops (`world.commercial.doorsNear`, `commercialEstablishments`); point it at the registry with `HOOKS.npcQuests.establishments(fn)`. A table inside is reached through the door: the owner walks in, sets it down on a chair at a table, walks back out; whoever takes it walks in and out the same way.

One spot is chosen by kind first (bench 1, park bench 1.2, shelter 0.8, table 0.7, doorstep 0.6, picnic table 0.6), so fifty benches do not drown out the one cafe. The bag sits on the seat of a bench (to one side, 0.48 m up), at the back of a shelter, on a picnic table's top, on a cafe chair, or just off a doorstep. The quest's title and what people say later follow the spot ("Ana's bag, left at the bus shelter"; "grabbed a bag off a cafe table").

## Families and teens

People out with their families (`family-life.js`: parents on the school run, shoppers) and the residents you know (`social-actors.js`) join the walking pool as takers for bags and favours (`createNpcQuests({ others })`). Anyone sat down, at work, in a line or minding a stall (the guard, volunteers, diners, the food bank line) is left out.

- A child or a teen who comes within 9 m of a bag left alone says so ("Look! Somebody forgot their bag!", "Yo, somebody left their bag here.") and never touches it.
- The grown-up with the child (the one they are walking beside) is told and goes first, from up to 16 m; anyone within 10 m of the child is watched. With children of their own beside them a grown-up is tempted at 0.4 of the usual, watched at 0.6.
- A parent handing a bag back says a word to the kids on the way ("Come on, we are giving this back."), and the child follows at their side as always.
- Children and teens are never givers, takers, owners, victims or thieves, in any kind, near or far, and never the thief found from a lead.

## More kinds from the people side

Each is a descriptor with an honest end and a betraying one, decided by disposition (`decide`), recorded on the compass and the region's tally (`settle`), and paid through the money adapter. A step marked `turn` is where a betrayal happens when it is not a pickup.

| kind | honest | betraying | pay |
| --- | --- | --- | --- |
| `favour.groceries` | carried to their car, its owner walking alongside (`favour`) | walked off with (`betray-errand`) | 25+ from them |
| `favour.pet` | the dog found where it ran to, won over, brought home (`favour`); near you the dog is there (`dog.js`), follows the helper and runs to its person | none: nothing to steal | 60 from them |
| `favour.directions` | the way pointed out (`give-directions`) | the wrong way on purpose (`mislead`); they thank you all the same | nothing |
| `favour.jumpstart` | stood by the car while it turned over (`favour`) | the money up front, then gone (`pocket-cash`); they say so a moment later | 50 from them (the cheat takes it) |
| `favour.fall` | helped up (`help-fallen`) | their pockets gone through (`rob-fallen`): a theft like a bag, yours to answer near you, a lead out of sight | nothing (the thief takes their wallet) |

New deeds in `combat/morality.js`: `give-directions` (honest +2), `mislead` (honest -5), `help-fallen` (mercy +4, protect +5), `rob-fallen` (mercy -6, law -7, protect -8, honest -8).

Near you they come up among the favours (`spawnFavour`, every 80 to 160 s, picked by who is about: a car parked near for a jump-start or groceries). Far away they are in the far tick's mix. Loot taken from a person now comes out of their own account (`transfer`), so a cheated or robbed person is poorer for it; a theft leaves something to carry back only when an item was taken.

For you:

- **Groceries** (someone with a car parked near): carry them to the car; they walk behind you. Walk off down the street with them and you kept them (`betray-errand`).
- **A jump-start**: stand by the car a few seconds while they try it.
- **Directions** (one person in five is not from round here): say yes and they thank you; `give-directions`, no pay.
- **Someone fallen**: walk up to them (within 2.6 m) before anyone else does and you help them up (`errands.helped`, `help-fallen`).
- What a favour pays now comes out of the giver's own account through `HOOKS.npcMoney` (`spend(npc, credits, 'reward', 'player')`), as does a kept wallet.

## Leads: thefts out of your sight

A bag or a snatch (or a fall robbed) taken out of your sight now and then leaves a lead (`npc-leads.js`): about one theft in three in the far tick, more for a bag you walked away from, and every thief who got out of your view near you. At most five open at a time and one at a time in a region (four minutes apart); each goes cold after 45 minutes; kept in localStorage `l99-leads-v1`.

- **Talk:** about a third of the grown-ups in that region have heard ("Someone grabbed a bag off a bench on the corner this morning.", "Did you hear? Someone snatched a bag from a person in the street this afternoon."), in passing (`chatter-lines.js` `self.lead`) and as a fact in conversation.
- **The guide's story:** a LEADS section lists them: "Someone took Ana's bag off a cafe table this morning in Oakland. The thief may still be about."
- **A marker:** in the lead's region, a ring 25 m across round where it happened (a bench or a doorstep 90 to 300 m from you when you first come into the region, or a stretch of sidewalk), after any favour's own pin.
- **The thief:** within 90 m of the place, every few seconds a grown-up walking 15 to 60 m from you may turn out to be carrying it (the prop in hand, a hint, the marker on them). Walk within 10 m and they walk off quickly with it: `errands.theft({ lead })`, the same choice as any theft. Take it off them (`take-from-thief`, neutral); bring it back to where it was taken (`return-stolen`, the only boost; its owner gets the money back through the adapter), keep it (`keep-stolen`) or let them go (the lead closes either way).

## Your choices on someone else's theft

When someone takes a bag (or a delivery) within 60 m of you, `errands.theft` makes it yours: the owner cries out, the thief walks off quickly and breaks into a run if you close in, the pin and the hint say "Catch them and take it, or let them go."

- **Let them go:** nothing on your compass. Their deed stands.
- **Take it off them:** they drop it; `take-from-thief`, a deed with no weight on any axis. You now have it.
- **Give it back to its owner** (the person, or the business's door when it was a delivery): `return-stolen` (protect and honest up), the snatch reward, and their thanks. This is the only boost.
- **Walk off with it:** `keep-stolen` (honest and law down).

The street snatch you could always come across follows the same rule now (catching the thief used to be a `stop-thief` deed; it is now neutral).

## Far away

Every 25 s (40 on phones) one quest is played out in your current region among its residents (the same 400 seeded people per region, so the same names recur in the log), every third tick another in a region you have been to, and other sources' quests more than 150 m from you can be taken by residents too. Coming back after time away plays one event per 5 minutes away, up to 24, across the regions you know. Each is a few arithmetic operations.

## Money, hospitals

The economy owns the one bank for everyone (household wallets, baselines, the daily settle). Quests only call it through `npc-money.js`: `earn(id, credits, kind, counterparty)`, `spend(...)`, `transfer(from, to, credits, kind)`, `balance(id)`, `wealth(id)` (-1 broke to +1 well off, from the balance) and `talk(id)` (the bank's `moneyTalk`). `HOOKS.npcMoney.use(bank)` attaches the bank; until then balances live in memory for the session, grown from each id (40 to 300 credits). No separate wallet is kept.

`HOOKS.npcHurt(fn)` tells a listener (the hospital) of anyone in the people pool knocked down (a thief brought down, a fight, a car): `{ npcId, name, at, why, region, child, inQuest }`, once per fall. The hospital bills through the bank.

## Talk

People remember for ten minutes what they did or saw: "Somebody handed my bag back. Can you believe it?", "Keep an eye on your things. I just saw someone swipe a bag." (`chatter-lines.js` `DEED`). In a conversation the same memory is a fact for the model (`npcQuests.factsFor(p)`, added in `guide.js` `personContext`), with up to two money facts from `moneyTalk`. In passing, about one remark in eight from someone with a money fact is that fact (`self.money`); nothing until the bank is attached.

## Debug

- `Crysis.morality()`: your compass as before, plus `npc`: the region and its tally, the world's tally, the town's situation, the nearest grown-ups (temper, axes, greed, balance, deeds, what they saw), scenes under way, the bag, open favours, sources and the latest NPC deeds.
- `Crysis.morality.bag('return' | 'steal' | 'auto')` leaves a bag near you now, on the nearest bench, shelter, cafe or park seat if there is one (the nearest passer-by returns or steals it, or decides for themselves); `.favour(kind)` (`'groceries'`, `'pet'`, `'directions'`, `'jumpstart'`, `'fall'`, or the older kinds); `.lead('bag' | 'snatch' | 'fall')` a theft just out of sight near you, left as a lead; `.leads()`; `.spots()` the places a bag could be left near you; `.tick(n)`; `.run(s)` runs the scenes on by s seconds of game time (for a slow machine); `.money('npc:123')`; `.regions()`; `.log(n)`; `.where()`.

## Cost

Per frame: timers and at most two scenes (a steering function and a prop's position each). Once a second: one pass over the pool (about 26 people) for the bag and the matching. The far tick is a handful of arithmetic operations every 25 s. One small localStorage write every 15 s (the commons), only when something changed.

## Left to do

- At merge: `HOOKS.npcQuests.addSource(fromRequests(requests))` for the economy's requests, `HOOKS.npcMoney.use(bank)` for the bank, and the hospital on `HOOKS.npcHurt`.
- At merge: point the bags at the economy's establishment registry with `HOOKS.npcQuests.establishments((x, z, r) => ...)` (until then the walk-in cafes and restaurants stand in).
- A lead's owner is a place, not a person: you bring the thing back to where it was taken. An owner waiting there (a body recruited near the spot) would be warmer.
- Bag owners are walkers from the pool only; a family adult could leave one too.
- The gathering crowds (`gathering-scene.js`) are instanced and are not takers.
- Groceries carried by you show no bags in your hands.
