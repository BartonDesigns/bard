# Cinematic loading screens

11 October 2026. Feature branch: `codex/cinematic-loading`. Not a live-release claim.

The owner requested screenshot-led mobile and desktop loading, mechanic hints, cinematic treatment and protection from engaging before the game is prepared.

## Player experience

- Four real captures introduce orbital travel, musical caves, conversational residents and hidden musical worlds. Restrained grading, vignette and grain keep them tied to the actual game. Asset provenance is in `assets/loading/README.md`.
- The loading screen appears before the engine import, then names actual preparation phases: landscape, lighting, surroundings and arrival. It does not invent a percentage or impose a minimum wait.
- Stories rotate every ten seconds. Previous, next and pause controls allow browsing; reduced-motion preference disables automatic rotation and animation.
- Once preparation and the first world render finish, **Enter world** appears. Inputs and simulation stay held until the player chooses to enter. Saved-place arrivals continue the streaming work needed to prepare the scene, while player motion and combat remain blocked.
- **Back to Bard** is available while loading. A late result cannot reopen the screen. Failed preparation offers retry; missing artwork cannot strand the player. Graphics failures receive a distinct recovery explanation.
- Layouts cover portrait phones, small phones, short landscape screens and desktop, with safe-area padding, 44-pixel minimum targets, focus containment, a live status and inert background UI, including elements mounted during import.

## Integration

`loading-screen.js` is a small shared loader available from the HTML head, before the game listeners register. The standalone engine imports the same singleton as a fallback. `island/build.mjs` fingerprints both loader and engine URLs.

The faceplate world door, saved resume, shared-place/room entry, cave door and legacy flight boot use the shared presentation. Nested arrival work uses the existing loading session. Native surface-to-orbit travel and cave walking do not acquire new loading screens.

`main.js` pauses partial-world updates during construction, deduplicates concurrent builds and removes a failed partial build before retry. `share.js` rejects an unavailable essential Bay survey instead of treating the timeout as a ready saved arrival. Optional surroundings retain their existing streaming behavior.

The original hidden `dom.loading` integration handle remains for compatibility. No Worker deployment or backend change is needed.

## Verification

Run from the repository root after `npm run build --prefix island`:

```sh
node island/tools/cinematic-loading-browser.cjs --engine
```

Use `PLAYWRIGHT_MODULE` for a nonstandard Playwright installation and `CHROME_EXECUTABLE` for its browser executable. The test creates its own local HTTP server. Run only one browser at a time. `cinematic-loading-art.cjs` accepts the same environment variables when refreshing the orbital capture.

Evidence is in `docs/verification/cinematic-loading/`:

- Desktop 1440×900, portrait 390×844, small phone 320×568, landscape 844×390 and short landscape 844×320: keyboard and background-click blocking, touch entry, scene browsing, focus, readiness and input restoration.
- Failed task retry, late completion after cancellation, reduced-motion behavior and missing-image resilience.
- Actual faceplate engine-import failure uses the recovery screen.
- Real bundled Moon world renders before readiness, stays still against keyboard input while covered, and accepts flight input after entry. No page errors or failed linked programs in that case.

These are Chromium responsive/touch-emulation and software-WebGL checks, not native iPhone/Safari timing or a complete Earth/legacy-flight playthrough. The exact production-art rendering fixture is used for the refreshed orbital screenshot. No physical-device performance claim is made.
