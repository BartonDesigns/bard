# Planet flight vistas

The native orbital material now adds regional land variation using each planet's existing grass, rock and sand palette, lighter coastal water, restrained directional ridge shading, and sun reflections restricted to liquid water. Airless, ice, lava and cloud-deck profiles do not receive the water highlight. Earth continues to use its existing mapped geography and land mask.

Clouds occupy a separate nine-kilometre shell with a matching drifting shadow field, raised silhouette, viewing-angle opacity and warm terminator lighting. The shell respects nearer companion occlusion. Atmospheric scattering remains the existing bounded eight-sample pass. Airless worlds have neither clouds nor atmospheric scattering.

Fine surface modulation fades with screen-space footprint so distant planets do not acquire noisy stippled relief. Phone detail omits the additional directional relief sample. No new textures, mesh streams, render targets or draw calls are introduced in the orbital pass.

Validation: 9 orbital movement tests pass. The standalone production-material fixture rendered 18 combinations: Terran orbit/horizon, Ocean, Arid, Magma, Ice, Gas moon, airless and mapped Earth, each at desktop and phone detail. All passed shader compilation, non-empty frame and WebGL-error checks; both Earth cases loaded the map. Representative frames and the full report are in `verification/flight-vistas/`. Before/after frames were visually reviewed and distant relief softened after that review.

Reproduce: bundle `island/tools/flight-vista-preview.mjs` with esbuild, then run `island/tools/flight-vista-browser.cjs` with BARD_VISTA_BUNDLE, BARD_PLAYWRIGHT, BARD_BROWSER and BARD_VISTA_OUT pointing to the local runtime. BARD_VISTA_BEFORE optionally accepts the old space/view.js for comparison frames. The production build is generated with `cd island && npm run build`.

Scope: this is the native orbital/high-altitude visual pass. It does not add new playable land, buildings, or biomes, or make procedural globe continents identical to the local landing terrain. The fixture does not establish full-world frame rate or native iPhone/Safari behavior. The earlier terrain boundary repair and its native-device follow-up remain separate.
