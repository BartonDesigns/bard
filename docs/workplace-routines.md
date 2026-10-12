# Workplace routines

Office workers and meeting colleagues now leave their stations, walk to available
meeting seats or the pantry, pause there, and return. Individual seeds vary the
starting delay, dwell time and pace. Pantry destinations and shop browsing/stock
stations are explicit floor-plan points, not extra crowd spawn positions.

Shoppers browse actual shop interiors, return to their checkout, negotiate and buy.
Vendors can leave the till to check stock between customers. Checkout time advances
only with both actors present and available. Each transaction consumes one unit of
shop stock and 12 credits from that ambient customer's limited budget. An encounter
receipt prevents repeated deductions. Unaffordable or sold-out purchases decline;
shopping bags remain visible after a successful purchase. This ledger never changes
the player's wallet or inventory.

Routes use the furnished floor's collision rectangles and atrium bounds. A lazy grid
of approximately 24,000 cells at most is retained per cached floor, with extra route
clearance for turning. Runtime movement is constrained before the character rig
updates. Floor bounds, walls, furniture and atrium/escalator openings are excluded.
Unavailable routes wait and retry, without teleportation. Temporary destinations are
reserved and released; the original station remains reserved for the return trip.

Conversation and danger suspend the actor's routine. Work conversations stop movement
instead of making a seated worker chase the player. After interruption, the route is
recomputed from the actual position. Nearby actors and the player slow movement.
Existing context-aware dialogue reads the current walking/work/break activity.
Meeting group identifiers now distinguish tables on different rows of the same floor.

## Verification

- 19 automated navigation, routine, transaction, workplace and awareness/quest checks pass.
- The production floor/character fixture simulates 242 seconds in an office and 220
  seconds in a mall, including conversation suspension and resumption. Office actors
  complete returns and a refreshment visit; mall actors complete two purchases and
  browse again. No sampled navigation violations, page errors or shader errors.
- Screenshots and the actual run report are in `verification/workplace-routines/`.
- The production bundle is rebuilt and its site cache key updated.
- Worker verification confirms discovery's planners and rooms trading/combat. Rooms
  still lacks `reputation-v1`; this frontend routine pass does not require that flag.

## Remaining scope

These are bounded local work cycles on the currently populated floor. Cross-floor
travel, commuting, universally synchronized NPC schedules, persistent shop/customer
ledgers and player commerce are not implemented by this pass. Ambient budgets and
stock last only for their actor/floor lifetime. No full workday/calendar simulation,
new world-changing quest, or physical iPhone/Safari performance certification is claimed.

Run the fixture by bundling `island/tools/workplace-routine-preview.mjs` to
`island/dist/routine-review.js`, then running `island/tools/workplace-routine-browser.cjs`
with `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` and `ARMAMENT_ART_OUT` set for the environment.
The temporary review bundle is not part of the release.
