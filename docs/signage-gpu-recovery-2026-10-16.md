# Signage graphics recovery — 2026-10-16

The follow-up desktop log lost WebGL twice while linking `signage-retro-3`,
including immediately after restoration. The governor was already Minimal, but
signage still used the full physical material. The last linked shader identifies
the recovery path to simplify; it does not establish a hardware or driver cause.

## Changes

- Low and Minimal use a compact signage shader without physical lighting,
  environment maps, shadow loops or civic texture samplers. It retains the atlas,
  sign backs, wear, cloth motion, daylight, headlight reflection and fog.
- A signage failure remembers the compact path for three days, even with High
  selected. Recovery replaces existing and hidden signs; cached vehicle decal
  templates also select the current material when new vehicles are created.
- The first graphics loss can restore normally. A second within one minute blocks
  rendering and new world builds until the player chooses Reload game. A late
  loading completion cannot replace that error with Enter world. There is no
  automatic page-reload loop.
- A new tap resumes interrupted or suspended audio even after a previous
  successful unlock. Governor diagnostics report frame time in explicit High/Low.
- The production bundle and HTML cache keys are rebuilt on top of the latest
  night-lighting release (`ecdd1c7`).

## Verification

45 focused Node tests passed for signage, civic materials, graphics startup,
shader warm-up, governor behavior and interrupted audio.

The browser harness compiled all eight signage kinds in Chromium/SwiftShader.
Its largest shader stage decreased from 85,037 to 5,262 characters (about 94%).
Pixel checks confirmed headlight reflection on the printed front and a dark metal
back. Forced context loss against the production renderer verified first-loss
recovery, compact replacement, blocked rendering after the second loss, persistent
recovery settings, the reload button, and late-loading completion. Ordinary
loading failure still retries and enters normally.

The production Earth world also loaded and rendered at the reported coordinates
with High selected and a saved Minimal ceiling. All 10 signage materials found
in the scene used the compact path; none retained the full shader. The 20-frame
sample had no context loss, frame exceptions or shader/material warnings.

Reproduce:

```sh
node --test island/tools/signage-recovery.test.mjs island/tools/signage.test.mjs island/tools/civic-materials.test.mjs island/tools/graphics-loading.test.mjs island/tools/governor.test.mjs tools/audio-interrupted.test.cjs
node tools/signage-recovery-browser.cjs
BARD_TEST_EARTH=1 BARD_TEST_SPOT=1 node tools/loading-performance.cjs
```

Browser harnesses accept `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` for the local
runtime. The location smoke test uses the reported Earth coordinates
`55590, 174, -940` and a saved Minimal ceiling with High selected, without a prior
signage-specific recovery flag. Graphics results use software rendering, not a
native Safari GPU. These checks do not establish desktop FPS or guarantee that
the browser cannot lose its graphics context for other reasons.
