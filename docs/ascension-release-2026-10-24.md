# The hundredth: release notes, October 24, 2026

Experience now carries characters and gear to level 99. Seven character trials lead to an earned ascension at an aether well at dusk or dawn. Weapons and garments have their own final trials and level-100 awakenings. Open **Gear → Character** (Shift+I on desktop) to see the trials and progress; inspect an item to see its own trial.

## Integrated assets and behavior

- Seven distinct gold-and-ink vector emblems in the Character trial list. They are local, decorative SVGs, with no image downloads, shader effects or extra texture memory. Text names and numeric progress remain readable independently.
- Preserves current main's five garment slots, newer weapons, honor, combat HUD and mobile quick spells.
- Preserves legacy character levels above 99, XP, earned points, perks, mastery and moonlit spells. The rite awards one additional point without lowering old levels.
- Preserves existing gear awakenings at 5/10/15/20, then adds the hundredth. No player loses an existing unlock.
- Saves progression on page hide, visibility change and world disposal; pending gear gains wait while inventory is trade-locked.
- Trades negotiate both room and peer capability. Existing rooms retain their level-20 or level-10 limits; unsupported gear stays in the bag.

## Verification

- Full engine suite: 1,503 passing, zero failing.
- Rooms: 122 checks passing; account/reputation/projects/household/communication suite: 67 passing.
- Production bundle build passes. Focused tests cover migration, inventory identity, awakening preservation, trials, rite gating, one-time rewards and vector coverage.
- Fresh browser screenshots are **not verified**: the environment has no Chromium binary and both browser installation attempts returned invalid archives. The updated browser fixture is included for rerunning `node island/tools/character-sheet-browser.cjs` in an environment with Chromium. No physical-phone performance claim.

## Separate Worker release

The rooms Worker source supports `gear-levels-100` and retains `gear-levels-20` compatibility. This environment is not authenticated to Cloudflare, so this release does **not** deploy the Worker. From the authorized Bard checkout, deploy `server/multiplayer` using its existing configuration, then verify `/status` and a two-client high-level trade. Do not deploy from Oursite or use a temporary account.

Frontend publication and byte verification are recorded in the release PR. This document does not assert production deployment of backend changes.
