# Combat, gear and rooms completion checks

This pass finishes concrete gameplay/integration gaps in the existing handoff. It does not
introduce the parked hunting/shelter roadmap or claim AAA art or physical-device performance.

## Behavior repaired

- Minors, surrendered people and restrained people are excluded at the common hit gate.
  Direct target ages and body ages use the same `isMinor` classifier. Warded flares stop
  harmlessly instead of igniting a nearby object. Surrendered fighters remain protected as
  they leave. Family actors supplied by main use the same civilian controller and ward.
- Real mouse fire consumes magazine rounds and persists the current magazine. R reloads
  from reserve. Gear/trade sheets, music typing, hidden pages and pending inventory trades
  suppress player fire and reload. Third-person aim uses the actual held-item pose and
  pitch, with right mouse and a touch Aim button. Tracers preserve its actual muzzle.
- Pending squad loads/queued builds are cancelled by generation on close/travel. Pending
  reservations enforce the actor cap. `combat.reset()` clears targets, projectiles, fires,
  pooled activity, audio and HUD; it detaches retained geometry before world disposal.
  Boss disposal cancels delayed attacks and releases its own resources. `gear.suspend()`
  detaches the cached carried model and hides aim controls before world disposal.
- Combat cues now use the shared world sound bus and respect its volume/output. Closing
  the world cancels active combat cue nodes.
- Prepared trades reserve inventory against spending, sales, training and new mutations
  until commit/rollback resolves. Offer comparisons include experience, and sending an
  instance whose experience changed fails cleanly. Explicit empty vendor stock stays sold
  out in the sheet and both purchase entry points.
- Family aid spends the gear wallet through `arms.spendCredits()` and all seven food deeds
  enter the same persistent morality table. No separate play-money wallet is required.
- PvP reports now address the recipient's `me` target. The Worker enforces host-only rules,
  same world, equipped fictional item, reach, damage type, valid body parts and firing-rate
  damage bounds. Shared boss reports go to the host only after its announcement. Shot
  effects stay on the same world and start near the sender. `/status.features` identifies
  the required `trade-v2`, `combat-v1`, `combat-guard-v1` server release.

## Validation

- 18 combat rule tests and 7 arms-runtime tests pass.
- Trade tests: 70 checks; multiplayer client tests: 21 checks; Worker tests: 105 checks.
- `npm run check` in `server/multiplayer` passes the production Worker dry run.
- `npm run test:integration` runs two actual game RoomClients over real WebSockets through
  Wrangler's local Cloudflare Durable Object runtime: 11 checks pass for held gear, trade
  and duplicate packets, PvP health, world isolation, host rules, shared boss routing and
  host promotion. This container needed a loopback-only OS interface discovery shim because
  its `os.networkInterfaces()` is unavailable; game/server/transport behavior was unchanged.
- Production game browser check (`tools/combat-gameplay-check.cjs`) passed actual canvas
  firing (24→23), R reload (reserve 48→47), right-mouse sights, I-menu fire/reload suppression,
  close during person loading, reopening cached gear, and travelling during person loading.
  Chromium software WebGL reported zero page/shader errors and healthy context/programs.
  The reusable check also includes third-person input and explicit HUD visibility checks.
  Root's final coordinated run verifies the final art/build together.

## Release integration and boundary

`main.js` calls `combat.reset()` and `gear.suspend()` before world resource capture and on
close. It supplies resident and family pools to combat and the common arms wallet to families.
The client build must be accompanied by the rooms Worker feature deployment. This environment
has no Cloudflare credential or Wrangler login; the successful dry run and local integration
are not a live deployment claim. Root is handling the live release.

Rooms remain account-free. Inventories, item ownership, personal morality and ambient NPC
simulation remain browser-local. The Worker validates and bounds the current cooperative
boss/PvP protocol; this does not claim universal shared progress or a fully server-simulated
world. Those are separately parked roadmap items.
