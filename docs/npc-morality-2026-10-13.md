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
- `island/tools/npc-morality.test.mjs`: tests.

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

- **A bag left alone:** every 70 to 140 s (150 to 240 on phones) a grown-up walking 12 to 50 m from you sets their bag down and walks on. Grown-ups passing within 7 m notice it, each once. One may pick it up, call the owner back ("Excuse me! Your bag!"), walk it over, hand it back and be paid (a `return-bag` deed); one may pocket it and walk off quickly (`steal-bag`). If nobody bothers within 45 s the owner comes back for it. Walk away (95 m) and it resolves among the people still there.
- **Favours among people:** now and then someone asks another person nearby (lost item, carry something over, catch a friend, fix a car), and favours you turn down are offered to the people about. The giver waits; the taker walks the steps with the thing in hand.
- **Business requests:** open requests from any source within 75 m are offered to the people near their first step.
- At most one scene on phones, two elsewhere, plus one bag. A scene that wanders 95 m from you, or loses its person to the world, finishes the way it was going to, out of sight.
- Children and teens are never givers, takers, owners, victims or thieves (`dna.child`, `dna.minor`, `dna.teen`).

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
- `Crysis.morality.bag('return' | 'steal' | 'auto')` leaves a bag near you now (the nearest passer-by returns or steals it, or decides for themselves); `.favour()`; `.tick(n)`; `.run(s)` runs the scenes on by s seconds of game time (for a slow machine); `.money('npc:123')`; `.regions()`; `.log(n)`; `.where()`.

## Cost

Per frame: timers and at most two scenes (a steering function and a prop's position each). Once a second: one pass over the pool (about 26 people) for the bag and the matching. The far tick is a handful of arithmetic operations every 25 s. One small localStorage write every 15 s (the commons), only when something changed.

## Left to do

- At merge: `HOOKS.npcQuests.addSource(fromRequests(requests))` for the economy's requests, `HOOKS.npcMoney.use(bank)` for the bank, and the hospital on `HOOKS.npcHurt`.
- Bags on real benches, cafe tables and bus shelters (the visible bag is set down on the sidewalk; the far tick names the other places).
- A far betrayal could leave a lead for you to follow up later; only thefts in view are yours to answer now.
- People in families and social scenes (`families.actors()`, `social.actors`) are not takers yet; only the walking pool is.
