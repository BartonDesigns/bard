// The spell gallery: each spell's look (src/magic/looks.js) played out in a small scene of its own
// (a caster, three foes, ground and sky) in headless Chromium, one capture per spell, so the 47 can
// be set side by side and told apart. Nothing of the game is loaded: only three, fx.js and looks.js.
//
// OUT=<dir> [ONLY=sunspark,eclipse] node island/tools/spell-looks-browser.cjs
/* global Game, document */
const fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = process.env.OUT || '/tmp/spell-looks';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const bundle = require('../node_modules/esbuild').buildSync({ stdin: { contents: "export * as THREE from 'three'; export { createMagicFx } from './src/magic/fx.js'; export { LOOK } from './src/magic/looks.js'; export { SPELLS } from './src/magic/spells.js';", resolveDir: root }, bundle: true, format: 'iife', globalName: 'Game', write: false }).outputFiles[0].text;

(async () => {
	fs.mkdirSync(out, { recursive: true });
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
	const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	await page.setContent('<body style="margin:0;background:#000"><canvas id="c" width="480" height="300"></canvas></body>');
	await page.addScriptTag({ content: bundle });
	const ids = await page.evaluate(() => {
		const { THREE, createMagicFx, SPELLS } = Game;
		const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
		renderer.setSize(480, 300, false);
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x4a5866);
		scene.fog = new THREE.Fog(0x4a5866, 25, 70);
		scene.add(new THREE.HemisphereLight(0xbfd4e6, 0x3a3326, 1.6));
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x55603f }));
		ground.rotation.x = -Math.PI / 2; scene.add(ground);
		const body = (x, z, c) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 8), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, 0.85, z); scene.add(m); };
		body(0, 0, 0x6c8fb3); body(0, -8, 0xa0483a); body(-2.2, -9.5, 0xa0483a); body(2.4, -9, 0xa0483a);
		const camera = new THREE.PerspectiveCamera(55, 480 / 300, 0.1, 200);
		camera.position.set(5.5, 4.2, 6); camera.lookAt(0, 1.2, -4);
		const fx = createMagicFx(scene, {});
		fx.resize(300, 55);
		window.__g = { THREE, renderer, scene, camera, fx, SPELLS };
		return SPELLS.map((s) => s.id);
	});
	for (const id of ids) {
		if (only && !only.includes(id)) continue;
		await page.evaluate((id) => {
			const { renderer, scene, camera, fx, SPELLS } = window.__g, { LOOK } = Game;
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
				const to = foes[0], N = 16;
				run(N * dt, (_, n) => { const u = n / N, p = v(hand.x + (to.x - hand.x) * u, hand.y + (to.y - hand.y) * u, hand.z + (to.z - hand.z) * u); const d = v(to.x - hand.x, to.y - hand.y, to.z - hand.z), l = Math.hypot(d.x, d.y, d.z); L.trail?.(fx, p, v(d.x / l, d.y / l, d.z / l), l / N); });
				L.hit?.(fx, to, dir); run(0.12); if (L.mark) run(0.6, () => L.mark(fx, T, {}));
			} else if (k === 'beam') run(0.6, (tt) => L.beam?.(fx, hand, foes[0], tt));
			else if (k === 'burst' || k === 'strike') { const D = spell.delay || 0.5; run(D, (tt, n) => { if (n % 2 === 0) L.tell?.(fx, at, spell.r, tt / D); }); L.blast?.(fx, at, spell.r); run(k === 'strike' ? 0.18 : 0.12); if (L.mark) run(0.4, () => L.mark(fx, T, {})); }
			else if (k === 'lances') {
				// (three spears out of a low afternoon sun, one after another)
				const d = v(0.45, 0.8, 0.4), l = Math.hypot(d.x, d.y, d.z); d.x /= l; d.y /= l; d.z /= l;
				const pts = [0, 1, 2].map((i) => { const a = i / 3 * 6.283 + 0.5; return v(at.x + Math.cos(a) * spell.spread, 0.02, at.z + Math.sin(a) * spell.spread); });
				pts.forEach((p) => L.tell?.(fx, p, spell.r, 0, false));
				const T0 = 0.32, landed = [false, false, false];
				run(0.18 * 2 + T0 * 0.8, (tt) => pts.forEach((p, i) => { const u = (tt - 0.18 * i) / T0; if (u < 0) return; if (u >= 1) { if (!landed[i]) { landed[i] = true; L.blast?.(fx, p, spell.r, false); } return; } const h = 26 * (1 - u); L.fall?.(fx, v(p.x + d.x * h, p.y + d.y * h, p.z + d.z * h), d, false); }));
			}
			else if (k === 'nova') { L.blast?.(fx, v(0, 0.08, 0), spell.r); run(0.2); if (L.mark) run(0.4, () => L.mark(fx, { bound: v(1.5, 1.2, -1.5) }, {})); }
			else if (k === 'cone') { L.cone?.(fx, eye, dir, spell.range, spell.angle); run(0.25); }
			else if (k === 'chain') { L.arc?.(fx, hand, foes[0]); L.arc?.(fx, foes[0], foes[1]); L.arc?.(fx, foes[1], foes[2]); run(0.08); }
			else if (k === 'orb') { const p = v(0.3, 1.2, -0.6); run(1, (tt) => { p.z -= 6 * dt; L.orb?.(fx, p, tt); if (Math.random() < 0.15) L.arc?.(fx, p, foes[0]); }); }
			else if (k === 'well') { const c = v(0, 1, -8); run(1.2, (tt, n) => { if (n % 3 === 0) L.tick?.(fx, c, spell.r, tt); }); }
			else if (k === 'cloud' || k === 'zone' || k === 'aura') { const c = k === 'cloud' ? at : v(0, 0.02, 0); run(1.6, (tt, n) => { if (n % (k === 'aura' ? 8 : 15) === 0) L.tick?.(fx, c, spell.r, tt); }); }
			else if (k === 'storm') { run(1.6, (tt, n) => { L.cloud?.(fx, at, spell.r); L.rain?.(fx, at, spell.r); if (n % 9 === 0) { const a = Math.random() * 6.28, r = Math.random() * spell.r; L.strike?.(fx, v(at.x + Math.cos(a) * r, 15, at.z + Math.sin(a) * r), v(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r)); } }); }
			else if (k === 'summon') { L.self?.(fx, eye); const n = spell.n || 1; run(1.2, (tt) => { for (let i = 0; i < n; i++) { const a = tt * 1.4 + i / n * 6.28; L.body?.(fx, v(Math.cos(a) * 1.6, 1.5 + Math.sin(a * 1.7) * 0.25, Math.sin(a) * 1.6), tt); } }); }
			else if (k === 'stasis') run(1.2, () => L.mark?.(fx, T, {}));
			else if (k === 'douse') run(1.4, () => L.rain?.(fx, v(0, 1.68, -4), 10));
			else if (k === 'rewind') { L.self?.(fx, eye, [...Array(20)].map((_, i) => v(Math.sin(i / 3) * 2, 1.68, -i * 0.4))); run(0.3); }
			else { L.self?.(fx, eye); run(L.on ? 1.2 : 0.35, (tt) => L.on?.(fx, eye, tt, dir, true)); }
			renderer.render(scene, camera);
		}, id);
		await page.locator('#c').screenshot({ path: path.join(out, id + '.png') });
		process.stdout.write(id + ' ');
	}
	console.log('\nerrors:', JSON.stringify(errors));
	await browser.close();
	if (errors.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
