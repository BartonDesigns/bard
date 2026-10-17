# Armour and combat gear, worn and seen (2026-10-17)

What you wear now shows on your body: you see it in third person, on your own arms in first person, and on your
friends in a shared room. There are five slots, head to foot: **Head**, **Top**, **Legs**, **Hands** and **Feet**.
The militia were also re-kitted the way soldiers dress today.

![The sets, left to right: ranger, mage, rigged, operator, squire, sergeant, knight](verification/armor/sets-front.png)

## The pieces

There are 29 garments in `island/src/gameplay/arms.js` (19 are new). Each one's look is in
`island/src/people/armor-looks.js`.

| Slot | Aether | The old kingdoms | Modern |
| --- | --- | --- | --- |
| Head | Wayfarer's Hood, Stargazer Circlet | Kettle Helm (wide brim), Great Helm (closed, eye slit, brass cross) | Ops Cap with headset, Ballistic Helmet (high cut, night-vision mount, headset) |
| Top | Aetherweave Coat, Ranger's Jacket | Gambeson (quilted), Mail Hauberk, Plate Cuirass (breast and back plate, fauld, pauldrons) | Combat Shirt, Chest Rig, Plate Carrier |
| Legs | Aetherweave Trousers, Ranger's Trousers | Mail Chausses, Plate Greaves (cuisses, knee cops, greaves) | Combat Trousers with knee pads |
| Hands | Spellbinder Gloves, Fieldcraft Gloves | Plate Gauntlets, Leather Bracers | Tactical Gloves (knuckle guard) |
| Feet | Trailstrider Boots, Duskwalker Boots | Sabatons, Riding Boots | Combat Boots (coyote) |

Modern gear is multicam, with no real makers, insignia or unit marks.

## What it does

The stats for each piece are in `gear-levels.js` STATS. `composeMods` (`magic/stats.js`) folds them into
`state.mods`.

- **Armour**: each piece takes a share of the damage you take. The share grows with the item's level, up to its
  cap. The total is capped at 60%.
- **Weight**: you carry 8 kg for free. Each kilogram over that makes you 1% slower and lowers your jump. The most
  weight can slow you is 30%.
- **Steel and spells**: steel lowers the power of every spell (Spellcraft, shown as −N%).
  - A full knight's kit is 27 kg, so you move 19% slower, and your spells lose 21%.
  - Modern gear has no spell penalty and is light: a plate carrier is 9 kg for 14% armour.
- **Where it shows**:
  - the Character sheet has a Load line;
  - the skills menu shows steel as a red `−N%` chip in each spell's power sources.

## How it is drawn

`dressInGear(style, worn)` lays each worn piece over the clothes you already have on. Each slot replaces only its
own part: a helm takes the place of a cap, and trousers take the place of trousers.

The pieces are built in `people/garment.js` `accessoryGeometry`.

### The knight: dark, worn, fitted plate

![The knight, close](verification/armor/knight-close.png)

- **Fitted shells** (`fitTube`): each plate is measured round its own axis (the torso, a bone, the head) against
  the skin and the clothes under it. The shape is smoothed into broad curves that never sink under the clothes,
  then stood off by the plate's thickness. Edges follow the cut of the piece, so they run clean.
  - **Cuirass**: breast and back plate with a ridge down the breast, cut away for the arms. Below the waist is a
    fauld of lames, each stepping out over the one above with a bright worn edge and a dark seam.
  - **Pauldrons**: a dome and lapping lames over each shoulder, with plate down the upper arm.
  - **Great helm**: shut to the chin, a sight slit, breaths on one cheek, a comb, and a gorget.
  - **Greaves**: cuisses, knee cops and greaves. **Sabatons**: lames down the foot.
  - **Gauntlets**: a dark leather glove with steel lames over the back of the hand, a vambrace and an elbow cop.
- **A torn tabard** over the plate: a narrow panel down the breast and back with a sword device, widening below the
  belt into a skirt to the knee with a ragged hem. Below the hip it moves with the thighs.
- **A leather belt** with an iron buckle at the waist.
- **Steel** is kit gloss 3 (`propkit.js`). It is part metal, so it stays grey in a world with no reflections.
  - It is dulled with grime in patches: rough, darker and a little rust brown there.
  - Where it is clean it carries fine bright scratches.
  - Edges are worn bright.

![The knight from behind](verification/armor/knight-back.png)

### Modern kit

![The operator](verification/armor/operator-front.png)

- **Plate carrier**, made to the body:
  - padded plate bags front and back, with the swimmer's cut at the top corners and rows of webbing;
  - a cummerbund round the sides, and straps over the shoulders;
  - on the front: three magazine pouches with the magazines showing, an admin pouch with a loop patch, and a dangler
    pouch under the plate;
  - on the sides: a radio pouch with its antenna and a cable up to the talk switch on the strap, a medical pouch, and
    a tourniquet;
  - behind: a zip-on panel and a drag handle.
- **Chest rig**: four magazine pouches on a panel, its harness, and a strap round the waist.
- Multicam carriers have the pattern printed on the bags and pouches. Soldiers in woodland wear ranger green.
- **Ballistic helmet**, made to the head:
  - a high cut over the ears, with a rubber trim round the edge;
  - rails along the sides, loop patches, and a shroud at the brow;
  - night vision: dual tubes stowed up, with a battery pack behind, its cable over the crown, and a strobe.
- **Headset**: rounded cups on arms to the rails, and a boom mic. Sunglasses under modern headgear become black
  shooting glasses.
- **Knee pads**: a padded sleeve with a hard cap, strapped above and below the knee.
- **Camouflage** on clothes is in smaller blotches than before.

![The operator's helmet](verification/armor/operator-head.png)

### How far this can go

Everything here is built from code at load time, with no models or textures. That gets the shapes, cuts and
details right. The last step to a AAA look would be authored models with painted or scanned PBR textures, loaded as
glTF.

When your gear changes, the avatar rebuilds your body in place. The first-person arms rebuild from the new body.

**Multiplayer**: the pose carries `wr`, a short wear code. `net/protocol.js` checks it, and `net/remotes.js`
rebuilds a friend's body when it changes. **The rooms Worker must be redeployed for friends to see your gear.**

## The militia

![Militia and soldiers](verification/armor/militia.png)

- **Militia**, in `combat/outfits.js` `militia()`:
  - Two in three wear modern kit: a multicam or plain combat shirt, a plate carrier or a chest rig, and a cap or
    a helmet with a headset (some with night vision).
  - Some also wear knee pads, a shemagh and gloves.
  - The rest keep the older camouflage look.
- **Soldiers**:
  - wear night vision more often, and nearly always a headset;
  - often wear knee pads;
  - wear coyote boots with desert or multicam.
- **Armour follows the kit**: `kitArmour(style)` scales a fighter's armour by what they wear (plates, a rig, a
  helmet, knee pads). A fighter in a plate carrier is harder to drop than one in a shirt.

## Checks

- **Tests**: `node --test island/tools/gear-magic.test.mjs` covers the five slots, every piece's look, armour,
  weight, the steel penalty, `dressInGear`, the wear code and the pose check. `military.test.mjs` covers the
  militia's kit and `kitArmour`.
- **Pictures**: `npx esbuild island/tools/armor-preview.mjs --bundle --format=esm --outfile=<b>`, then
  `BUNDLE=<b> OUT=<dir> node island/tools/armor-browser.cjs`. This renders the sets, close-ups and the militia
  with no page errors and no failed shaders.
- **In the running game**: a knight's kit and an operator's kit were each seeded into the save. The game was entered
  and switched to third person. You wear the kit, and there are no errors.

![In the game: the knight](verification/armor/in-game-knight.png)

![In the game: the operator](verification/armor/in-game-operator.png)

## Not done yet

- **Rooms Worker**: friends see your gear only after the rooms Worker is redeployed.
- **First-person steel**: in first person, steel gauntlets show as plain grey gloves (`people/sleeve.js` draws
  cloth gloves). They show as plate in third person.
- **Under the hauberk**: where the mail skirt and the chausses meet, a little of the cut shows.
