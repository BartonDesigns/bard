# Loading screen imagery

Real Bard/Crysis captures, encoded as WebP. No generated concept art or promised future features.

| Asset | Source | Framing |
| --- | --- | --- |
| `horizon.webp` | `island/tools/cinematic-loading-art.cjs`, using the production orbital renderer through `stellar-preview-entry.mjs` | 1600×1000; Gargantua at seven radii; camera pitched down 0.16 radians for title space. |
| `resonance.webp` | `docs/verification/cave-gameplay/resonance.png` | Original 960×640 gameplay frame. |
| `settlement.webp` | `docs/verification/handoff-release/terran-architecture.png` | Original 640×420 gameplay frame. |
| `beyond.webp` | `docs/verification/stellar-entry/Gargantua-held-note.png` | Original 640×400 native realm capture. |

The shared UI applies a restrained saturation/contrast/brightness grade, vignette and static grain with CSS. The source imagery remains authentic. Per-image focal points and crops accommodate portrait and landscape screens. Images load one scene at a time; their availability never controls world readiness. No remote stock-image dependency.

To refresh Gargantua, run `node island/tools/cinematic-loading-art.cjs` with Playwright and a Chromium executable available (see `docs/cinematic-loading.md`). Other assets retain their source framing and are only encoded as WebP at quality 88.

## Fourteen-image correction, 12 October 2026

Added ten distinct existing game captures. Each loading session picks one image randomly and keeps it until entry, cancellation or retry. The last selection is remembered for this browser tab to avoid immediate repeats across reloads. Only the selected image is fetched. Source labels belong here, not in the player-facing screen.

| Asset | Source | Framing |
| --- | --- | --- |
| `island.webp` | `docs/verification/handoff-release/earth-island.png` | Original 640×420 game capture, WebP quality 88. |
| `discovery.webp` | `docs/verification/discovery/courtyard.png` | Original 960×600 game capture, WebP quality 88. |
| `deep.webp` | `docs/verification/handoff-release/deep-gate.png` | Original 640×420 game capture, WebP quality 88. |
| `interior.webp` | `docs/verification/handoff-release/terran-interior.png` | Original 640×420 game capture, WebP quality 88. |
| `earth.webp` | `docs/verification/flight-vistas/earth-orbit-desktop.png` | Original 640×420 game capture, WebP quality 88. |
| `terran.webp` | `docs/verification/flight-vistas/terran-orbit-desktop.png` | Original 640×420 game capture, WebP quality 88. |
| `atmosphere.webp` | `docs/verification/flight-vistas/terran-horizon-desktop.png` | Original 640×420 game capture, WebP quality 88. |
| `sun.webp` | `docs/verification/stellar-entry/Sun-interior.png` | Original 640×400 game capture, WebP quality 88. |
| `streets.webp` | `docs/verification/world-expansion/beijing-street.png` | Original 800×500 game capture, WebP quality 88. |
| `crew.webp` | `docs/verification/handoff-release/moon-crew-room.png` | Original 640×420 game capture, WebP quality 88. |

12 October follow-up: automatic random rotation restored at ten-second intervals, with Pause/Play and reduced-motion support. No slide numbers or screenshot subtitles. The same 14 authentic assets remain in use.
