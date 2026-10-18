# Graphics pressure and recovery, 17 October 2026

The owner reports repeated “The graphics did not come back” messages. This pass starts from main `19d239f1ecadecbf46bea07bc573ef73d389b868`, including the newly merged water reflections. The message alone does not identify the device's hardware/driver cause.

## Changes

- A context that fails to return within eight seconds opens the existing actionable **Reload game / Return to Bard** screen. It no longer leaves a frozen world behind a long-lived toast. A late build completion or restoration cannot reopen the failed session. Reload remains the player's choice, with no automatic reload loop.
- Build phases wait while a context is lost. Successful restoration releases them; timeout or repeated loss rejects them. The last valid place and social state are checkpointed when a playable world loses its context.
- Restoration starts at Low or lower, releases optional water targets and shadow maps, and uses a smaller drawing buffer. Repeated/unrecoverable losses remember Minimal. Safe-mode resolution now actually follows the tier on small screens.
- Explicit High/Low still preserve visual preferences on a healthy device, but memory pressure can now step them down. The session memory ceiling cannot be undone just by reapplying settings.
- Water reflections no longer call Three's whole-scene compiler, which traverses hidden objects too. Only visible reflected materials in the mirrored camera's frustum are warmed, two materials per batch, including streamed content. The procedural sky reflection remains while batches finish.
- Disabled/offscreen water passes release their targets and unbind their textures. Teardown and context loss cancel stale warm-up work. Healthy-device art, textures and supported reflections are retained.

## Verification

- **53/53 focused Node checks pass:** graphics loading/pressure, governor, signage recovery, world resources and shore behavior.
- **Production-renderer fault injection passes:** first restoration, repeated-loss blocking, a first context that never returns, late build completion, late restoration, reload action and ordinary loading retry.
- **Actual WebGL controlled fixture:** four visible materials warm in two batches instead of compiling all 44 visible/hidden materials. Five programs including depth versus 45 for the old whole-scene call. Turning the passes off releases 1,228,800 texture bytes and 307,200 renderbuffer bytes in this fixture. These are controlled resource measurements, not whole-game FPS or crash-rate percentages.
- **Production Earth build:** desktop and iPhone-sized/touch emulation load, draw and preserve the world through forced loss/restoration, without page exceptions, recorded frame exceptions or monitored shader warnings. The phone test uses the previously reported Earth coordinates with High selected and a saved Minimal recovery ceiling; all 11 found signage materials use the compact path.
- **Full island suite:** 985/989 in the concurrent run. Three failures reproduce on unchanged main: RGB atlas manifest, Svalbard flora and regional-housing vegetation. The fourth, nearby real-city tile completion, is a 20-ms timing-sensitive fixture; unchanged main passes it, and this branch passes all eight lifecycle tests when rerun without the software browser workload. Its source and production subsystem are unchanged.

All browser runs use Chromium/SwiftShader. Native iPhone/Safari GPU performance and elimination of all driver resets are **not verified**. Software-rendered timings are slow and are included as evidence, not advertised as device benchmarks. See the JSON records under [verification/graphics-recovery-2026-10-17](verification/graphics-recovery-2026-10-17/).

## Reproduce

```sh
npm ci --prefix island
npm run build --prefix island
node --test island/tools/graphics-loading.test.mjs island/tools/graphics-pressure.test.mjs island/tools/governor.test.mjs island/tools/signage-recovery.test.mjs island/tools/world-resources.test.mjs island/tools/shore.test.mjs
node tools/signage-recovery-browser.cjs
BARD_TEST_EARTH=1 BARD_TEST_RESTORE=1 node tools/loading-performance.cjs
BARD_TEST_PHONE=1 BARD_TEST_EARTH=1 BARD_TEST_SPOT=1 BARD_TEST_RESTORE=1 node tools/loading-performance.cjs
```

Browser harnesses accept `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE`. This is a frontend-only change; no Cloudflare Worker deployment is required.

