# Handoff client release, 9 October 2026

The owner authorized completion and live publication of the current handoff. The release
includes the eight-person floor-seated Off-Duty Orchestra, complete held-item catalog and
rig fixes, combat and gear, family life, shoreline and diving fixes, architecture's first
version, cinematic Explore, and native Sun/Gargantua entry.

Built from a clean checkout based on live main `42bced7`, selecting the current source and
excluding the branch's `island/vtmp/` scratch previews. Its production engine is byte-for-byte
identical to the source checkout used for all final gameplay checks:

- Engine URL key: `2babcc429c`.
- SHA-256: `b88798a98269b232a49e63cc0487b7526707e305a68d80b07ee59c9dfb69d637`.
- Source completion checkpoint: `fe36e1d89f35e10f094db2acab64fd94a88dade8`.

## Release gates

`tools/combat-gameplay-check.cjs` passed nine checks with actual canvas, keyboard and mouse
input. These cover firing/ammunition, reload, both camera modes' aiming, narrow-screen HUD
layout, menu suppression, close/reopen, cancellation of queued people and world travel.
No page or shader errors. Evidence is in `verification/combat-gameplay/`.

`tools/handoff-release-smoke.cjs` passed thirteen views in the real production bundle:
Earth island, Bay Area, Bend, TERRAN exterior/interior, Moon colony and medic room, MAGMA,
Deep gate/bottom/return, Held Note and Event Ring. The Deep's actual heard phrase opens the
gate; descent and ascent finish with control unlocked. Native Gargantua crossing builds
the SINGULARITY world, enters the Held Note and returns through Leave the horizon.
There were no page/shader errors, failed local asset requests or lost WebGL contexts.
Peak shader use was 21 combined samplers and 13 per stage, within the checked limits.
The full report is `verification/handoff-release/report.json`.

Area-specific unit, local two-client and rendered checks are recorded in the combat, family,
held-item, weapon-hand, world-finish and stellar-entry documents. Browser evidence uses
Chromium software WebGL at a 640×420 touch viewport. It does not establish physical-phone
performance, every procedural seed, or an AAA art-quality sign-off. The bow still has its
existing presentation cues rather than a newly authored string-draw/nocking animation.

## Rooms server boundary

The client is ready to publish. The updated rooms Worker passed 105 checks, a deployment
dry run and eleven checks with two real RoomClients through local Durable Objects. Its
production upgrade cannot be performed here: there is no Cloudflare credential or configured
deployment integration. Live trading/PvP must not be described as upgraded until the owner
deploys and `/status.features` advertises `trade-v2`, `combat-v1` and `combat-guard-v1`.

From the owner's existing clone, run:

```sh
cd ~/bard-server
git pull origin claude/affectionate-heisenberg-3g4qv1
cd server/multiplayer
npm ci
npm test
npx wrangler deploy
```

The next bounded building duty is architecture mist immersion, matching camera density
to rendered cloud bands, tower cutouts and ground clearance. Preserve the existing bands,
dusk color and verified bloom behavior.
