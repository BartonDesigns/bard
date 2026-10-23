// The spell gallery: each spell's look (src/magic/looks.js) played out in a small scene of its own
// (a caster, three foes, ground and sky) in headless Chromium, one capture per spell, so the 47 can
// be set side by side and told apart. Nothing of the game is loaded: only three, fx.js and looks.js.
//
// OUT=<dir> [ONLY=sunspark,eclipse] [FLIGHT=1: bolts mid-flight] [GROW=<s>: Gargantua s seconds in] [SELF=1: spells on yourself, just cast]
//   [LEVEL=1..5: Lance of Dawn at that mastery] [DIVE=1: its lances caught diving in] [SIZE=960x600] node island/tools/spell-looks-browser.cjs
/* global Game, document */
const fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = process.env.OUT || '/tmp/spell-looks';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const bundle = require('../node_modules/esbuild').buildSync({ stdin: { contents: "export * as THREE from 'three'; export { createMagicFx } from './src/magic/fx.js'; export { createLens } from './src/magic/lens.js'; export { LOOK } from './src/magic/looks.js'; export { SPELLS, gargantuaSize, gargantuaRange, GARGANTUA_LIFT } from './src/magic/spells.js'; export { lanceShape, lanceSky, lanceVolley, lanceFlight, lanceStrikes } from './src/magic/lances.js';", resolveDir: root }, bundle: true, format: 'iife', globalName: 'Game', write: false }).outputFiles[0].text;

(async () => {
	fs.mkdirSync(out, { recursive: true });
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const [VW, VH] = (process.env.SIZE || '480x300').split('x').map(Number);
	const page = await browser.newPage({ viewport: { width: VW, height: VH } });
	const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	await page.setContent(`<body style="margin:0;background:#000"><canvas id="c" width="${VW}" height="${VH}"></canvas></body>`);
	await page.evaluate(([w, h, lv, dive]) => { window.__vw = w; window.__vh = h; window.__level = lv; window.__dive = dive; }, [VW, VH, +process.env.LEVEL || 0, !!process.env.DIVE]);
	await page.addScriptTag({ content: bundle });
	if (process.env.FLIGHT) await page.evaluate(() => { window.__flight = true; });
	if (process.env.GROW) await page.evaluate((g) => { window.__grow = g; }, +process.env.GROW);
	// (SELF=1: what a spell on yourself throws out, caught a tenth of a second in)
	if (process.env.SELF) await page.evaluate(() => { window.__self = true; });
	const ids = await page.evaluate(() => {
		const { THREE, createMagicFx, createLens, SPELLS } = Game;
		const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
		renderer.setSize(window.__vw, window.__vh, false);
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x4a5866);
		scene.fog = new THREE.Fog(0x4a5866, 25, 70);
		scene.add(new THREE.HemisphereLight(0xbfd4e6, 0x3a3326, 1.6));
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x55603f }));
		ground.rotation.x = -Math.PI / 2; scene.add(ground);
		const body = (x, z, c) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 8), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, 0.85, z); scene.add(m); };
		body(0, 0, 0x6c8fb3); body(0, -8, 0xa0483a); body(-2.2, -9.5, 0xa0483a); body(2.4, -9, 0xa0483a);
		const camera = new THREE.PerspectiveCamera(55, window.__vw / window.__vh, 0.1, 400);
		camera.position.set(5.5, 4.2, 6); camera.lookAt(0, 1.2, -4);
		const fx = createMagicFx(scene, {});
		fx.resize(window.__vh, 55);
		// (the black holes bend the frame round them (magic/lens.js); a banded backdrop behind them
		// shows the bending, which a flat grey sky would hide)
		const lens = createLens(), cv = document.createElement('canvas');
		cv.width = 1024; cv.height = 512;
		const g2 = cv.getContext('2d');
		for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) { g2.fillStyle = (x + y) % 2 ? '#5d7184' : '#3b4a5a'; g2.fillRect(x * 32, y * 32, 32, 32); }
		g2.fillStyle = '#e8dcc0'; for (let n = 0; n < 400; n++) g2.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
		const backdrop = new THREE.CanvasTexture(cv);
		backdrop.mapping = THREE.EquirectangularReflectionMapping;
		const flat = scene.background;
		window.__g = { THREE, renderer, scene, camera, fx, SPELLS, lens, backdrop, flat };
		return SPELLS.map((s) => s.id);
	});
	for (const id of ids) {
		if (only && !only.includes(id)) continue;
		await page.evaluate((id) => {
			const { renderer, scene, camera, fx, SPELLS, lens, backdrop, flat } = window.__g, { LOOK } = Game;
			const bends = id === 'gargantua';
			scene.background = bends ? backdrop : flat; scene.fog.far = bends ? 4000 : 70;
			const draw = () => { renderer.render(scene, camera); if (bends) lens.post(renderer, camera, fx.lenses(), 1, fx.grade()); };
			const spell = SPELLS.find((s) => s.id === id), L = LOOK[id] || {};
			const v = (x, y, z) => ({ x, y, z }), dir = v(0, -0.03, -1), hand = v(0.3, 1.45, -0.6), eye = v(0, 1.68, 0);
			const foes = [v(0, 1.2, -8), v(-2.2, 1.2, -9.5), v(2.4, 1.2, -9)], T = { bound: foes[0] };
			fx.clear();
			const dt = 1 / 30;
			let t = 0;
			const run = (secs, each) => { for (let n = 0; n < secs / dt; n++) { each?.(t, n); fx.update(dt); t += dt; } };
			const k = spell.kind, at = v(0, 0.02, -8);
			L.cast?.(fx, hand);
			if (k === 'bolt') {
				// (a bolt flies to the first foe and lands; the trail still hangs in the air)
				// (FLIGHT=1: caught mid-flight instead)
				const to = foes[0], N = 16;
				run((window.__flight ? 10 : N) * dt, (_, n) => { const u = n / N, p = v(hand.x + (to.x - hand.x) * u, hand.y + (to.y - hand.y) * u, hand.z + (to.z - hand.z) * u); const d = v(to.x - hand.x, to.y - hand.y, to.z - hand.z), l = Math.hypot(d.x, d.y, d.z); L.trail?.(fx, p, v(d.x / l, d.y / l, d.z / l), l / N); });
				if (!window.__flight) { L.hit?.(fx, to, dir); run(0.12); } if (L.mark) run(0.6, () => L.mark(fx, T, {}));
			} else if (k === 'beam') run(0.6, (tt) => L.beam?.(fx, hand, foes[0], tt));
			else if (k === 'burst' || k === 'strike') { const D = spell.delay || 0.5; run(D, (tt, n) => { if (n % 2 === 0) L.tell?.(fx, at, spell.r, tt / D); }); L.blast?.(fx, at, spell.r); run(k === 'strike' ? 0.18 : 0.12); if (L.mark) run(0.4, () => L.mark(fx, T, {})); }
			else if (k === 'lances') {
				// (the volley at mastery LEVEL (1..5; none: I) out of a low sun off to the left and
				// beyond, so each spear is seen side on as it dives; caught just after the last strikes,
				// or (DIVE=1) as the last is still coming in)
				const lv = window.__level || 1, S = Game.lanceShape(spell, lv, 1 + 0.12 * (lv - 1)), sky = Game.lanceSky(v(-0.75, 0.55, -0.35), null);
				S.night = false;
				const V = Game.lanceVolley(v(0, 0, -8), S, sky), last = V[V.length - 1];
				const T = window.__dive ? Game.lanceStrikes(last) - 0.1 : Game.lanceStrikes(last) + 0.14;
				const H = V.map(() => null), state = V.map(() => 0);
				V.forEach((P) => { P.phase = Math.random(); L.tell?.(fx, v(P.x, 0.02, P.z), P.r, 0, false, S, Game.lanceStrikes(P)); });
				run(T, (tt) => V.forEach((P, i) => {
					if (state[i] === 2) return;
					const f = Game.lanceFlight(P, tt), d = P.dir;
					if (f.stage === 'wait') return;
					const tip = v(P.x + d.x * f.d, 0.02 + d.y * f.d, P.z + d.z * f.d);
					if (!state[i]) { state[i] = 1; H[i] = fx.lance(); L.sky?.(fx, tip, false, S, P); }
					if (f.stage === 'struck') { state[i] = 2; const b = P.len * 0.1; L.fly?.(fx, H[i], v(P.x - d.x * b, 0.02 - d.y * b, P.z - d.z * b), d, P, S, false, 1); H[i]?.fade(1); L.blast?.(fx, v(P.x, 0.02, P.z), P.r, false, S, P); L.stand?.(fx, v(P.x - d.x * b, 0.02 - d.y * b, P.z - d.z * b), d, P, false, 0); return; }
					L.fly?.(fx, H[i], tip, d, P, S, false, f.a);
					if (f.stage === 'dive') L.fall?.(fx, tip, d, false, S, P, Math.min(40, f.v * 0.12));
				}));
			}
			else if (k === 'flare') {
				// (out of a high afternoon sun, charging, then the blast)
				const d = v(0.35, 0.85, 0.3), l = Math.hypot(d.x, d.y, d.z), top = v(at.x + d.x / l * 70, at.y + d.y / l * 70, at.z + d.z / l * 70), D = spell.delay;
				run(D, (tt) => { L.tell?.(fx, at, spell.r, tt / D, false); L.beam?.(fx, top, at, tt / D, false); });
				L.blast?.(fx, at, spell.r, false); run(0.01);
			}
			else if (k === 'singularity') {
				// (Gargantua far off on the horizon, fed for a while; the nearest foe streaking into it.
				// GROW=<s>: instead, as it stands s seconds in, at its true distance and size)
				if (window.__grow != null) {
					const s = spell, R = Game.gargantuaSize(s, window.__grow), e = camera.position;
					camera.far = 6000; camera.updateProjectionMatrix();
					// (as in the game: its heart a little over the eye's level, the lower part of the shadow
					// under the horizon, at its range then)
					const h = v(-30, e.y + R * Game.GARGANTUA_LIFT, -Game.gargantuaRange(s, window.__grow));
					// (and the ending's grade as it stands then)
					fx.gradeFrom(s.t); fx.update(Math.max(0, window.__grow - 0.6));
					run(0.6, (tt) => L.tick?.(fx, h, R, tt, e, window.__grow / s.t));
					draw();
					camera.far = 200; camera.updateProjectionMatrix();
					return;
				}
				const e = camera.position, h = v(-14, e.y + 10 * Game.GARGANTUA_LIFT, -120);
				run(1.2, (tt) => L.tell?.(fx, v(h.x, h.y - (1 - tt / 1.2) * 25, h.z), 10, tt / 1.2, e));
				run(1.4, (tt, n) => { L.tick?.(fx, h, 10, tt, e); if (n === 36) L.arc?.(fx, foes[0], h); });
			}
			else if (k === 'nova') { L.blast?.(fx, v(0, 0.08, 0), spell.r); run(0.2); if (L.mark) run(0.4, () => L.mark(fx, { bound: v(1.5, 1.2, -1.5) }, {})); }
			else if (k === 'cone') { L.cone?.(fx, eye, dir, spell.range, spell.angle); run(0.25); }
			else if (k === 'chain') { L.arc?.(fx, hand, foes[0]); L.arc?.(fx, foes[0], foes[1]); L.arc?.(fx, foes[1], foes[2]); run(0.08); }
			else if (k === 'orb') { const p = v(0.3, 1.2, -0.6); run(1, (tt) => { p.z -= 6 * dt; L.orb?.(fx, p, tt); if (Math.random() < 0.15) L.arc?.(fx, p, foes[0]); }); }
			else if (k === 'well') { const c = v(0, 1, -8); run(1.2, (tt, n) => { if (n % 3 === 0) L.tick?.(fx, c, spell.r, tt); }); }
			else if (k === 'cloud' || k === 'zone' || k === 'aura') { const c = k === 'cloud' ? at : v(0, 0.02, 0); run(1.6, (tt, n) => { if (n % (k === 'aura' ? 8 : 15) === 0) L.tick?.(fx, c, spell.r, tt); }); }
			else if (k === 'storm') { run(1.6, (tt, n) => { L.cloud?.(fx, at, spell.r); L.rain?.(fx, at, spell.r); if (n % 9 === 0) { const a = Math.random() * 6.28, r = Math.random() * spell.r; L.strike?.(fx, v(at.x + Math.cos(a) * r, 15, at.z + Math.sin(a) * r), v(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r)); } }); }
			else if (k === 'summon' && window.__self) { L.self?.(fx, eye); run(0.12); }
			else if (k === 'summon') { L.self?.(fx, eye); const n = spell.n || 1; run(1.2, (tt) => { for (let i = 0; i < n; i++) { const a = tt * 1.4 + i / n * 6.28; L.body?.(fx, v(Math.cos(a) * 1.6, 1.5 + Math.sin(a * 1.7) * 0.25, Math.sin(a) * 1.6), tt); } }); }
			else if (k === 'stasis') run(1.2, () => L.mark?.(fx, T, {}));
			else if (k === 'douse') run(1.4, () => L.rain?.(fx, v(0, 1.68, -4), 10));
			else if (k === 'rewind') { L.self?.(fx, eye, [...Array(20)].map((_, i) => v(Math.sin(i / 3) * 2, 1.68, -i * 0.4))); run(0.3); }
			else if (window.__self) { L.self?.(fx, eye); run(0.12); }
			else { L.self?.(fx, eye); run(L.on ? 1.2 : 0.35, (tt) => L.on?.(fx, eye, tt, dir, true)); }
			draw();
		}, id);
		await page.locator('#c').screenshot({ path: path.join(out, id + (process.env.LEVEL ? `-${process.env.LEVEL}` : '') + (process.env.DIVE ? '-dive' : '') + '.png') });
		process.stdout.write(id + ' ');
	}
	console.log('\nerrors:', JSON.stringify(errors));
	await browser.close();
	if (errors.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
