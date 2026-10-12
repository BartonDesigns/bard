# Cinematic loading screens

11 October 2026. Feature branch: `codex/cinematic-loading`. Not a live-release claim.

The owner requested screenshot-led mobile and desktop loading, mechanic hints, cinematic treatment and protection from engaging before the game is prepared.

## Original player experience (superseded by the 14-screen correction below)

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

## Release integration, 12 October 2026

The owner requested live publication. Integrated with main `b15d343b8c1a6d400173df9c6f52c6ce5dd1bbc4`, preserving the newer NPC, workplace, reputation and character work. The same 11 loading-browser check groups passed after rebuilding.

The release smoke also passed seven rendered views: Earth island, Bay Area, the wider globe at Bend, Terran exterior/interior, Moon colony and Magma. No page/shader errors, lost graphics context or failed local assets. The maximum linked-program sampler counts were 13 per shader stage and 21 combined. This is software Chromium evidence, not physical Safari timing. See `docs/verification/cinematic-release-loading/`.

```sh
BARD_QA_SCOPE=loading node tools/handoff-release-smoke.cjs
```

The smoke harness now dismisses the explicit entry screen before checking a rendered world. Engine SHA-256: `36d6b4281698d2fe25d305d4bd1fbd58f526ce7315a4b1d559a7cb7006d20bf8`. No Worker deployment is part of this release. Live deployment and public-asset verification are recorded on [PR #18](https://github.com/BartonDesigns/bard/pull/18).

## Reopening after Back, 12 October 2026

The original screenshot-led release is live as `b60dd1d0e1219f35b63492958396ff02d86b5faf`; Pages run [38241158332](https://github.com/BartonDesigns/bard/actions/runs/38241158332) succeeded and the public loader, engine and four images matched the tested bytes. Actual production desktop/phone entry checks displayed the artwork and navigation.

A continuation review found that choosing Back during an unfinished load and immediately opening another door silently discarded the new request. Faceplate entry requests now identify themselves explicitly. A new request displays its guarded screen immediately and waits for cancelled work and cleanup before starting. Nested calls from cancelled work still stop instead of waiting on themselves. Cancelling several queued requests runs only the final surviving request. No new images, gameplay transitions or backend deployment are included.

All 13 cinematic browser check groups pass, including success/failure after cancellation, repeated cancellation, nested-call deadlock protection, responsive layouts, recovery and bundled Moon input/readiness. The earlier seven-view renderer gate remains applicable to this UI-only change. Full faceplate handoff evidence is recorded separately in `docs/verification/loading-handoff/` by `tools/loading-handoff-browser.cjs`. These checks use software Chromium and emulated touch, not native Safari or a hardware performance certification.

The handoff test uses the current mobile **More controls → Fly** menu. The retired legacy cockpit button remains hidden; this continuation does not restore that old entry path or claim a legacy-flight playthrough. Run `node tools/loading-handoff-browser.cjs` for the actual desktop/phone door checks. Set `BARD_QA_IMAGES=1` only when world screenshots are needed.

## Fourteen-screen correction, 12 October 2026

The owner clarified that the loader must offer 14 screens selected randomly, rather than four screens rotating as a slideshow. The current implementation uses 14 distinct real game captures and chooses one per top-level loading session. The selected image stays fixed through preparation and readiness. Session storage avoids an immediate repeat on the next load or reload where storage is available. Nested preparation shares the selected image.

Slideshow controls, page counts, screenshot subtitles, chapter labels and extra explanatory copy are removed. Each screen retains a short title, one hint of ten words or fewer, actual loading status and the relevant entry/recovery controls. Portrait framing preserves the recognizable planets and horizon. All 14 WebPs total 394,004 bytes; each session fetches only its chosen image. Source provenance is recorded in `assets/loading/README.md`.

The build and all 15 browser check groups pass, including all 14 captures at desktop and phone sizes (28 scene previews), five responsive layouts, static selection/repeat avoidance, cancellation/reentry, recovery, and a real bundled Moon render with guarded input. `docs/verification/cinematic-loading/report.json` records no errors. These are Chromium responsive/touch emulation and software-WebGL checks, not physical Safari performance tests. Prior release/history evidence remains above. Publication evidence belongs in the correction PR. No Worker update is needed.

## Unnumbered slideshow restored (12 October 2026)

The owner requested automatic slides again after the static-image release. The 14-image loader now starts randomly and chooses another image every ten seconds without immediate repeats. No slide numbers, screenshot subtitles or extra descriptive copy return. A compact Pause/Play button controls rotation; reduced-motion preferences keep artwork static. Hiding the loader clears its timer. Entry, retry and cancellation guards are unchanged. This supersedes the static-selection behavior below. No Worker change is required.

Validation: build, syntax and diff checks pass. All 14 UI browser check groups pass, including responsive previews for every image, timed rotation, pause, reduced-motion stability, retry and cancellation/reentry. The real Moon engine check from the prior release was not repeated for this presentation-only change.
