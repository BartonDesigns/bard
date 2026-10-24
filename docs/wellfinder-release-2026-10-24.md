# Wellfinder and the final rite — 24 October 2026

## How to use it

Open **Gear → Character → Wellfinder**. The sheet lists up to five nearby procedural aether wells, with distance, compass bearing, discovery status and fabric refill time. Light and dark availability follows the current daylight. A bearing is a direction, not a navigable route: find safe ground yourself.

At level 99, finish all seven character trials, reach a well at dusk or dawn, and choose **Perform the rite**. The button explains what is still missing. A depleted well can host the rite without waiting for its 40-minute fabric refill. Gathering from a ready well still performs the rite automatically when eligible.

The rite retains the existing ascension reward and immediate local save. It does not grant extra fabric, reset a well's refill timer, bypass trials or grant repeated ascension rewards. This is not a new cross-device or server-backed progression system.

## Implementation and verification

- Surveys actual seeded well placement in a bounded 5×5-cell area, not invented quest destinations. No additional world meshes, textures or particles are allocated by the guide.
- Checks horizontal and vertical reach. At touching distance, uses the same cached well elevation or collision floor as gathering, rather than assuming terrain is the final floor.
- Rechecks level, all trials, location and twilight at the time the rite button is pressed. Buffered item progress is applied before evaluating the rite.
- Fixes the level-99 announcement to count all completed trials, not only newly completed trials.
- Automated coverage includes deterministic placement, bounded sampling, invalid worlds, vertical separation, depleted wells, daylight, world-seed separation, collision floors, one-time ascension and save/reload.
- Release checks: engine build; full engine Node test suite; loading-screen syntax; Bard Chronicle consistency; focused source diff review. Final command results and deployment evidence are recorded in the release PR.
- Fresh browser/physical-device visual smoke was not performed: browser installation is unavailable in this environment. Automated checks do not substitute for that visual check.

Frontend-only change. No Cloudflare Worker source, credentials or deployment is changed. Existing Worker deployment requirements remain separate.
