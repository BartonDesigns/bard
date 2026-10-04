# Regional homes and roads beyond the Bay

Owner request: 4 October 2026, 11:21 Pacific. Baseline: `b56bf077816edd2f685dbf3916772dcc1c3e8cf2`. Branch: `codex/global-roads-regional-homes`.

The goal is visible, grounded regional homes and connected local streets/highways outside the Bay Area. Procedural roads represent the game's generated network; they are not a claim of exact surveyed road coverage worldwide.

## Implemented corrections

- Dense regional street paint used a different grid phase from the building blocks, putting roads through block centres.
- Dense building placement bypassed wet/slope checks, and the lowest-corner foundation could bury uphill facades.
- Highway route prioritization favoured endpoints instead of the player approaching the middle of a long route.
- Highway/town joins did not refresh when a town's asynchronously generated streets arrive without its ID changing.
- Regional towns claimed by their own architecture kit did not supply street endpoints to the existing highway join path.
- Road ribbon heights and grading used inconsistent sampling; streaming caches lacked explicit bounds.
- Regional grid crossings previously lacked endpoint junctions for driving. Streets now split at shared intersections.
- Road-link classification forced connectors to be one-way. Driving now honors an explicit `oneway: false`.

Houses now use rotated nine-point footprint checks and high-corner foundations with stone skirts. Corners and shop signs retain clearance. Native regional streets feed the same road registry used by driving and grading. Highways prioritize their corridor, refresh asynchronous town connections, sample connector water/slope constraints, and apply the same berm texture as terrain. Floating-frame and disposal cleanup release old road data.

## Verification and release

The production bundle builds and 49 targeted Node regressions pass across roads, housing, regional people/environment/sound and real-city lifecycle. Nine changed runtime files pass unused-variable lint; the diff has no whitespace errors. Tests exercise generated Kyoto streets through the real driving graph (left/straight/right turns), bidirectional highway connectors, an over-700 km synthetic corridor approached at its midpoint, floating-frame continuity, disposal, and water rejection.

The final full-site browser pass succeeds for Kyoto, Beijing and Fresno with zero page/shader errors, finite geometry, local driving turns and onward options at both connector ends. Evidence is recorded under `docs/verification/world-expansion/`.

| Actual rendered place | Registered local street segments | Local turn options | Highway connectors meeting streets | Vegetation overlaps / nearby samples |
| --- | ---: | ---: | ---: | ---: |
| Kyoto | 1,114 | 3 | 2, zero gap | 0 / 3,949 |
| Beijing | 1,320 | 4 | 2, zero gap | 0 / 3,129 |
| Fresno | 5,573 | 4 | 2, zero gap | 0 / 2,127 |

Road vertex clearance matches the intended 0.12 m offset (observed 0.107–0.129 m in Kyoto; approximately 0.12 m elsewhere). Linked programs stay within 16 samplers per stage / 32 combined; the three-city run observed a maximum of 13 active samplers. The driving checks use the production graph, not a claim of a human-driven full intercity journey. The broader release smoke passes the faceplate/phone cave-direction controls, generated Earth island, Bay Area, Svalbard, MAGMA surface and MAGMA underground with zero page/shader errors. It observed at most 13 samplers per stage and 20 combined, within the 16/32 limits. See `docs/verification/world-expansion-smoke/report.json`. Close-up follow-ups now pass at actual registered street-segment midpoints. Both poses are on the lane; post-move checks sampled 13 Kyoto and 673 Beijing tree/regional-plant instances with zero reserved-space overlaps. Beijing shows an inhabited street with clear facades; Kyoto retains some visible low ground cover but the large trunk obstruction is gone. This gate covers those two vegetation layers, not every decorative ground-cover system. Exact poses and screenshots are retained in the three-city report; follow-up source reports are summarized there. Do not claim universal street coverage, exact real-world highway geography or native-device frame rates from these checks.

The cave release remains live at baseline. Its verified deployment is [PR #12](https://github.com/BartonDesigns/bard/pull/12) and [Pages run 37223202101](https://github.com/BartonDesigns/bard/actions/runs/37223202101). This expansion should preserve that release and the remaining cave migration inventory.

## Visual diagnostic follow-up

The first rendered street check found real tree/foliage overlap in regional streets and planned building footprints. Finite geometry and connected road counts alone did not establish visual acceptance. This blocked publication. Both vegetation layers now reserve planned footprints and streets, with crown clearance and stable occupancy revisions. The existing NPC `blocked()` predicate remains homes-only; separate `vegetationBlocked()` reserves roads without stopping NPC street travel. Tests prove pre-stream exclusion, preserved park space and one refresh on occupancy change. The final browser and close-up passes confirm the correction within the stated layer scope. Fresno uses the retained Bay coordinate frame while geographically outside the Bay; validation must check actual latitude/longitude rather than assume every non-Bay town uses a new frame.

## Deployment boundary

Frontend release is pending publication. The verified build SHA-256 is `ba651d0a337d3ae9ddb8b5e0c3d78181a3c33484434974e449bd365f839b53e3` for `index.html` and `324cd83897d931d2f80bd14898bf2a9a2b282043374a07d91ebab302a14b08eb` for `island/dist/island.js`. The release PR will retain Pages run and live-asset verification evidence. Cloudflare Worker deployment was not changed or verified by this frontend release; shared-cloud progress remains a separate requirement.
