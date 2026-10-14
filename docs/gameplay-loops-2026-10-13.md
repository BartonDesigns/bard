# Gameplay loops (13 October 2026)

Live on `main`, `a6eb413` to the commit carrying this note. All of it runs where people are about (the Bay, the island village, the globe towns that have people) and costs little per frame: a few distance checks a second.

## Favours in passing (`people/errands.js`, `people/errands-core.js`)

Someone you pass now and then asks for a favour instead of a word in passing (about one remark in five once the first few are done; never children, the frightened, joggers, or while you drive or fly). Walk up and the talk control says **Help** (Enter / tap). Asking someone in a conversation whether they need help can also turn one up, with "I'll do it" and "Not now" buttons.

- **lost:** keys, a phone, glasses, an earbud, a ticket, a scarf or a wallet dropped 12-38 m away. The pin's ring marks a 9 m patch; the thing glints. Walk over it to pick it up, bring it back. A found **wallet** can be kept by walking off with it: 60 credits and a dishonest deed on the compass.
- **catch:** a friend just walked off without their bag (or umbrella, notebook...). They are pointed out by direction from your view only (never by appearance). Run after them.
- **pass:** take a coffee, envelope, flowers, a charger or a parcel to someone waiting 20-75 m away.
- **repair:** their parked car will not start. A **Repair Roll** used beside it fixes it; one comes to hand automatically if you carry one, or you are told where to buy one.
- The people involved are held in the world until it ends (`p.held`, never recycled), and released a few seconds after their goodbye. Leaving (220 m) or a fight taking them ends it quietly.
- Reward: 30-140 credits by kind and distance, a `favour` deed on the compass. Ranks and milestones below.

## Street incidents: a bag snatched (`errands.js` `snatch`)

Rarely (a 5 s check, 8%, at least four minutes apart) when you are on foot near two grown-ups, one's bag is snatched. The thief runs at 5.4 m/s, away from you, turning aside from water. Catch them (within 2 m) and they drop it and flee; that is a neutral `take-from-thief` deed (it was `stop-thief` before `docs/npc-morality-2026-10-13.md`). Pick it up and give it back for 80+ credits and a `return-stolen` deed, or walk off with it (`keep-stolen`). After 50 s they are gone. Everyone within 40 m remembers the robbery (not by you) through `world-awareness.js`, so they are shaken in passing and in conversation.

## Fares (`vehicles/fares.js`, `vehicles/fares-core.js`)

While driving, someone on the pavement up ahead hails you (a 2.5 s check, 35%, 45 s apart; 70 s on phones). Pull up within 7 m and stop: they get in (their body is kept aside, unseen) and the pin shows the kerb they want, 350-1300 m off (nearer where the land is small). Stop within 16 m: fare by distance, tip for quick and smooth (a jolt over 25 m/s² is a hit; over 24 m/s for 3 s scares them), 1-5 stars. One in four is **in a hurry**: a clock on the chip, half again on time, speed forgiven. They talk from the car in their own voice, and say goodbye at the kerb in their own body. Leaving the car lets them out unpaid. `drive.carAt()` gives the car's place and speed.

## Using what you hold (`gameplay/item-use.js`)

A **Use** control (U) appears while holding an item with a use. **Field Medkit:** patches up a hurt bystander in front of you first (`tend` deed, they thank you), else your own wounds by its Heal stat. **Repair Roll:** fixes a favour's car. Single-use items are spent and the next comes to hand; others train toward their next level.

## Today's goals, ranks and the Story tab (`gameplay/daily.js`, `gameplay/ranks.js`)

Three goals a day (by the local date, the same for everyone), each a different kind, paid as done, 150 bonus for all three. Ladders for favours (Stranger to Local legend), fares (Off duty to Legend of the road) and five-star rides; reaching a rank is announced. The guide's **Story** tab shows today's goals, your compass title and axes, both ladders with progress, what is under way (with a way to give up a favour) and your latest deeds. Once your name gets around, some passers-by say so (`chatter-lines.js` `standing`).

## Moon rovers (`planet/colony/colony.js`, `maglev.js`)

Riding to a site off the maglev now carries you in a rover's cab along a track over the terrain (from outside the hub's airlock if you are in it), easing to about 80 km/h, with the maglev's strip, Skip and announcements. No talk prompt while riding.

## Also

- `HOOKS.morality` was never set, so families' food deeds only queued; it is set now.
- New compass deeds: `favour`, `kept-wallet`, `stop-thief`, `tend`.
- Console: `Crysis.errands()` (`.ask()`, `.snatch()`, `.accept()`, `.cancel()`), `Crysis.fares()` (`.hail()`), `Crysis.daily()`, `Crysis.chatter()`.
- Tests: `node --test island/tools/{errands,fares,item-use,daily,ranks,chatter}.test.mjs`. In-game checks were run headless for a lost-item favour, a bag snatch, a conversation favour, a fare pickup, a Moon rover ride and the Story tab.

## Not verified

On a real phone: none of it. Fare drop-off was checked in tests, not in the running game (the headless car could not be steered there). Favours rely on people being about: few at night.
