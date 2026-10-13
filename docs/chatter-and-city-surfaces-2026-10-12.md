# Passing chatter and city surfaces (12 October 2026)

Live on `main` from `e1f5174` (chatter), `9f6bd5d`, `e1fe9e7` and `64afa91` (surfaces).

## Passing chatter

People you walk past notice you and say something in their own voice.

- **Files:** `people/chatter.js` (who, when, the body and caption), `people/chatter-lines.js` (pure: the lines, overheard pairs, a person's pitch), the remark channel in `guide/local-speech.js`, `guide.voice` in `guide/guide.js`, a hook in `people/motion.js` (`S.remark`).
- **Voice:** the same local Kokoro voices as conversations, so a person sounds the same passing as talking. Played through an HRTF panner at the speaker's head, so it pans and fades as you pass. Pitch shifts a little by age and person (`voiceShape`), with the model's speed compensating so the pace stays natural. Four more voices in the pool: `af_aoede`, `af_kore`, `bf_emma`, `bm_fable`.
- **Timing:** the line is made as they approach and dropped if you have walked out of earshot (14 m) by then. A conversation always cuts a remark off, and a remark never starts over one. The model loads in the background (`warm`) the first time someone would speak; until then remarks are captions only.
- **What they react to:** being aimed at, having seen you hurt someone, local reports, you being wanted (same facts as conversations, `world-awareness.js`); a fast car on the pavement; you being hurt; you sprinting at them; jogging; being on the phone; storms, rain, late night; their mood, temper and work. Most people only nod or say nothing. Two people talking each say a line to the other. Children wave and get a caption, no voice (Kokoro has no child voices).
- **Later the same evening (`b956e39`, `2b3b6a5`):** people sitting at a table or working side by side are overheard as a pair (meals, the check, emails, meetings, the printer; shop pairs on sizes and prices). Walking into someone gets "excuse me" even from the quiet ones (every 20 s at most each). Outgoing people talk a little quicker; a person's conversation voice now has the same pitch and pace as in passing.
- **Body:** they look at you (or at their friend), their mouth moves while the line plays, and they gesture.
- **Console:** `Crysis.chatter()`.
- **Tests:** `node --test island/tools/chatter.test.mjs` (lines, fear priority, quiet majority, pairs, voice shaping, and the selection loop on stand-in bodies); `island/tools/chatter-voice-browser.cjs` (remark channel: panning, pitch, priority, out-of-earshot drop; a protocol stand-in worker unless `REAL=1`, since the model hosts are blocked in the sandbox). Seen in game: a walker turned and said "Hey, good morning." with its caption.
- **Not verified:** the real voices' sound and latency on a phone; the 100 MB first download now starts when someone first speaks in passing, not only on a first conversation.

## City surfaces that flickered through each other

Found and checked with `island/tools/zfight-browser.cjs`, a census of every drawn triangle near you that shares a plane with another draw. `FAR=1` counts only layers the 24-bit depth buffer cannot separate from where you stand (near plane 0.25 m). The tool clicks past the loading card; without that the world never runs in headless tests.

- **Tower interiors (`bay/towers.js`):** each storey's ceiling top lay exactly on the floor above (carpet, stone or oak flickering with white ceiling), as did the mullions, their band and the columns; the far structure slabs shared the floor plates' edges. Now they stop 18 cm short and the slabs sit inside the floors. Downtown San Francisco: 1,686 m² down to 183 m² (the rest is tree detail levels dissolving by design).
- **Tower floor plates (`interiors/workplace-plan.js`):** flush with the facade at every storey; now 15 cm inside (`SLAB_INSET`).
- **Glazed front doors (`interiors/build.js`):** the pane lay 1 mm over a solid leaf; now a frame with the pane in the middle.
- **Neighbouring buildings (`bay/city.js` `apart`):** overlapping mapped buildings are drawn trimmed back off the larger one; parts of one building whose fronts are within 25 cm get a 30 cm step; roof eaves stop short of a taller neighbouring wall. The lot keeps its own place and size (`o.fit`, `o.ovFit` change only what is drawn).
- **Skyline (`bay/city.js` `skylineBeside`):** a tower built near you is left out of the far skyline copy that stood in the same place.
- **Sunroom glass:** now well inside its bars.
- **Cliff settlement rooms (`planet/arch/rooms.js`, `furnish.js`):** outer room walls stood exactly on the building skin, with pilasters and skirting proud of it; they now stand 14 cm inside (`INSET`), and wall pieces have no underside. TERRAN seed 77: about 280 m² of wall-skin fighting gone.
- **Checked clean:** Bend (2.2 million triangles, nothing), the Moon colony (0.1 m²).
- **Still open:** the island village has about 80 m² of floor-level surfaces 2.6 cm apart (all houses); a few 3-5 cm deck and glass layers in cliff settlements that only flicker beyond about 350 m; nothing has been looked at on a real phone.
