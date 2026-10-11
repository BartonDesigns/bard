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
