# Held firearms and environmental optics, 2026-10-09

This pass improves the three fictional firearms while preserving their hand grips, muzzle positions, collision dimensions and combat behavior. It is the first firearm art pass, not a claim that the complete held-item catalogue meets a finished AAA art bar.

## Exterior and materials

- Aurora: receiver gasket and cover layers, inset exterior fasteners, fore-end pressure pads, textured cheek contact, small stock fittings and receiver seams.
- Mossback: layered receiver cover, fore-end pads, raised cheek contact and stock fittings. Woodland texture contrast is softened so the shapes remain legible under sunlight.
- Warden: layered compact receiver cover, raised fore-end pads, side-cell protection straps and a cheek cover over the exposed stock rails.
- Details are merged into the existing item mesh rather than emitted as separate draws. Low LOD drops the fine screws and pad ridges.
- Atlas bump relief is reduced from 1.6 to 0.3. Edge wear is broken up in stable item coordinates instead of drawing a continuous silver outline on every edge. Firearm finish wear is reduced while maintaining tier differences.

## Functional optics

`island/src/crysis/scope-optics.js` captures the actual world scene through two bounded cameras. A forward camera supplies the magnified image when aiming with Aurora or Mossback. A backwards-facing camera supplies a horizontally mirrored image of the scene behind the player. Reflection increases toward the glass edge and remains restrained while aiming. The Warden reflex window remains transparent with its illuminated dot.

The controller clones only the equipped instance's lens materials. NPC and inventory-preview lenses cannot inherit the live camera textures. Phone viewmodels request `optics: true` to retain simple separate lens geometry even with low-detail firearm bodies; ordinary low-detail NPC items keep merged opaque lenses.

| Capture | Desktop | Phone |
| --- | --- | --- |
| Aiming image | 384 × 384, maximum 15 Hz | 256 × 256, maximum 8 Hz |
| Rear reflection | 128 × 128, maximum 6.7 Hz | 64 × 64, maximum 3 Hz |

The rear capture skips frames if the camera has not moved, with an 0.8-second refresh for moving surroundings. The forward capture runs only during aiming. The controller restores render targets, viewport, scissor, auto-clear, XR, tone mapping and shadow update flags after each capture. Hiding, changing gear and teardown restore original materials and free render targets.

Fine illuminated reticles replace the oversized crosshair and dot. Capture textures stay in linear space and are tone-mapped once with the final item render.

## Reproducible checks

Bundle `island/tools/scope-optics-preview.mjs` to `/tmp/bard-optics-preview.js` with the repository's esbuild, then run `flock /tmp/bard-browser.lock node island/tools/scope-optics-browser.cjs`. The harness uses the installed `playwright-core` and Chromium runtime, with optional `BARD_RENDER_RUNTIME`, `BARD_OPTICS_BUNDLE` and `BARD_OPTICS_OUT` overrides.

The check renders all three firearms at desktop and phone detail, checks WebGL errors and renderer-state restoration, changes a real rear-facing scene surface from red to blue to verify reflection response, checks scoped-versus-reflex forward capture, and verifies reset frees targets. Integration images and the generated report provide the final evidence.

### Result

The focused browser check passed for all six firearm/detail combinations with zero JavaScript, shader or WebGL errors. Each capture restored the checked renderer state. Both scoped rifles captured the forward scene; the Warden did not allocate a forward target. Changing the rear scene from red to blue changed the sampled lens pixel from `[41,36,57]` to `[10,37,77]`, proving the reflection is live scene content. Reset released both targets and all private lens materials. The Aurora image was visually inspected: the magnified checker target remains visible behind the illuminated crosshair.

Triangle counts at level 7, common finish, including local optics: Aurora 16,992 / 3,756, Mossback 10,208 / 3,028, Warden 10,080 / 2,924 (desktop / phone). These are a controlled render-fixture check. Full-world mobile frame time and final first-person framing are separate integration gates.
