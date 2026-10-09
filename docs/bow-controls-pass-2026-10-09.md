# Bow controls and projectile pass

Hold the mouse or Draw button to draw for 0.85 seconds. Release sends one arrow; a tap below 20% draw lets down without spending it. Partial draw scales projectile speed by `0.45 + 0.55q` and damage by `0.35 + 0.65q²`. Full draw keeps the existing maximum damage and speed. Arrows follow the sight direction with natural gravity rather than automatic upward compensation.

The bow holds one arrow at every level and tier. After release it nocks the next arrow in 0.9 seconds when reserve is available. Manual reload remains available. A short release recovery is separate from nocking, so a newly nocked arrow can be drawn immediately. Reserve is transferred only at completion. Reload callbacks carry a serial that invalidates abandoned animations.

Blur, hidden tab, pointer cancellation or leaving the fire control, equipment changes, gear/trade/places menus, swimming, knock-out and travel cancel a draw without firing. A failed or throwing weapon view cannot spend ammunition or advance the shot count. Bow state is sent to both first- and third-person rigs. The touch control says Draw, Release or Nocking, with draw percentage in the HUD.

Flying arrows reuse the held arrow geometry and world-lit material. Meshes are pooled (8 mobile, 16 desktop) with tracer fallback at the cap. Their tips follow collision positions while the shaft rotates with velocity. Travel clears the pool and disposes its geometry, preserving the shared material.

Validation: `node --test island/tools/bow-controls.test.mjs island/tools/combat.test.mjs`. These tests cover state, acceptance, cancellation, reserve transfer and existing combat behavior. Browser visual/input verification is a separate release gate.

The restored implementation passed all 29 focused/existing combat tests. The production native-input harness (`tools/armament-input-smoke.cjs`) was attempted twice against bundle SHA-256 `3e7f81da3580cd64cecbc6e078643f2477b0ff60a662965e50bf9d63fa98ad49`. Both attempts ended when Chromium closed during the initial page navigation, before game boot. No native-input assertions completed, so this run does not establish phone input, production nocking, or production scope behavior. Failure evidence is retained in `docs/verification/armament-input/report.json`.
