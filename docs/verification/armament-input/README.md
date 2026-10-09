# Production input gate status

Status: blocked before game boot. No input checks completed.

Two attempts navigated the production page with the mobile Chromium profile under the shared browser lock. The browser closed during navigation on both attempts, before the game engine started. The preserved report contains the tested bundle hash and exact failure. No page JavaScript error was observed before termination; that is not a passing runtime check.

`tools/armament-input-smoke.cjs` is ready to check actual mouse hold/release, trusted CDP touch cancellation/release, ammunition conservation, menu/blur cancellation, interrupted/restarted gun reload and live optic capture counters when the runtime can complete navigation. Its blur event is injected to exercise the lifecycle handler; mouse and touch input are delivered through browser input APIs.

The separate pure bow/combat suite completed 29/29 tests successfully. Production browser input verification remains outstanding.
