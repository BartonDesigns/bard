# Native Sun and Gargantua entry

The native orbital route no longer stops at the old eight-radius Sun/Gargantua
shells. Planet and moon collision remain intact. Stellar approaches decelerate to
a finite speed, allowing both entry and an ordinary powered exit.

The Sun uses a molten-plasma interior in the native orbital pass. Heat remains
atmospheric; shields hold. Return to orbit or Escape initiates the existing warp
back to the departure planet. The effect is tied to the actual Sun position, so
it cannot wash out a planetary surface or a distant sun view.

Gargantua retains the supplied ray tracer and its disk, lensing and photon ring.
Inside 1.8 Rs, a 3.2-second controlled passage approaches the horizon. Return to
orbit or Escape can turn back before the world voyage starts. The existing
SINGULARITY voyage then opens the existing Held Note realm; its Leave the horizon
control returns to the Event Ring. Once discovered, the realm retains its existing
warp destination. The initial seed 2281969 produces the Event Ring of Ondravor on
both phone and desktop terrain resolutions after all relevant terrain planners.

Passage tokens, disposal checks and timeout recovery prevent an old or rejected
voyage callback from reviving a crossing. Pause cancels the passage while retaining
the distant orbital frame. Disposal removes the added exit control and listener.

## Evidence

- `node --test island/tools/orbit.test.mjs island/tools/stellar-destination.test.mjs`:
  11 checks, including finite movement into/out of both stellar regions and the
  actual first-visit destination's Event Ring on both terrain resolutions.
- `stellar-browser.cjs`: 13 checks using the production orbital controller/view
  and Held Note renderer; zero page or shader errors. Covers both old exclusion
  shells, solar entry/return, horizon cancellation/entry/exit, one pending voyage,
  and rejection after disposal.
- Screens in `verification/stellar-entry/` were inspected. The disk image retains
  the original lensed disk; the inner horizon image is black because those
  center-facing rays are captured. The next image shows the Held Note realm.

The renderer harness isolates native controllers and renderers; the final release
smoke owns the complete `main.js` voyage/world-build integration. These checks do
not certify native mobile frame rate or every seeded world.

Reproduce the rendered check after bundling the harness:

```sh
island/node_modules/.bin/esbuild island/tools/stellar-preview-entry.mjs --bundle --format=esm --outfile=island/dist/stellar-preview.js
node island/tools/stellar-browser.cjs
```

The browser script accepts `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE`, `CHROMIUM_ARGS`
and `STELLAR_REVIEW_DIR` for an installed local browser/runtime. The generated
preview bundle is a review artifact, not a shipped application asset.
