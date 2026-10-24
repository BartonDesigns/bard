// Shoot a mob of one creature kind in headless Chromium (monsters/mob.mjs: the game's bodies,
// each varied, under the game's light):
//   npx esbuild island/tools/monsters/mob.mjs --bundle --format=esm --outfile=<bundle>
//   BUNDLE=<bundle> KINDS=drain-skulker,ridge-hound OUT=<dir> node island/tools/monsters/mob-browser.cjs
// (the bundle is served as if it sat in island/dist, so the models resolve as in the game; it is
// never written there: dist is the committed build)
// QS: more of the page's query (contact=0: no shade under them, st=0.4: how far into a strike).
// SHOTS=name:light:view:what,... where what is rest | menace | march | run | strike-<kind> |
// skid | side | a beat's name (each run from a fresh mob, the same draw every time: SEED).
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const KINDS = (process.env.KINDS || 'drain-skulker').split(',');
const OUT = process.env.OUT, BUNDLE = process.env.BUNDLE;
const N = +(process.env.N || 5), SEED = +(process.env.SEED || 7);
const SHOTS = (process.env.SHOTS || 'rest:day:three:rest,menace:day:three:menace,march:day:three:march,dusk:dusk:front:menace,night:night:three:menace').split(',').map((s) => s.split(':'));
const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.json': 'application/json', '.wasm': 'application/wasm' };
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (p === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/dist/mob-preview.js"></script>'); return; }
		const f = p === '/dist/mob-preview.js' ? BUNDLE : path.join(ROOT, p);
		if (f !== BUNDLE && !f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
		fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const W = +(process.env.W || 1200), H = +(process.env.H || 600);
	const page = await browser.newPage({ viewport: { width: W, height: H } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error' || /shader|program/i.test(m.text())) errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=${W}&h=${H}${process.env.QS ? '&' + process.env.QS : ''}`);
	await page.waitForFunction(() => window.MOB_READY, null, { timeout: 120000 });
	for (const kind of KINDS) {
		for (const [name, light, view, what] of SHOTS) {
			const info = await page.evaluate(async ([k, n, seed, light, what]) => {
				const M = window.MOB;
				const r = await M.load(k, n, { seed });
				M.light(light);
				const ph = [];
				if (what === 'rest') M.step(2.5);
				else if (what === 'menace') M.step(2.5, 1 / 30, { menace: 1 });
				else if (what === 'march') { M.step(0.2, 1 / 30, { speed: 1.4 }); ph.push(M.step(2.0, 1 / 30, { speed: 1.4, pace: true, move: true })); }
				else if (what === 'run') { M.step(0.2, 1 / 30, { speed: 5 }); ph.push(M.step(1.3, 1 / 30, { speed: 5, pace: true, move: true })); }
				else if (what === 'skid') { M.step(1, 1 / 30, { speed: 5 }); M.step(0.25, 1 / 30, { speed: 3, skid: 1, menace: 1 }); }
				else if (what === 'side') M.step(1.2, 1 / 30, { side: 1.2, menace: 1 });
				else if (what.startsWith('strike-')) { M.step(1, 1 / 30, { menace: 1 }); M.strike(what.slice(7)); M.step(+(new URLSearchParams(location.search).get('st') || 0.4), 1 / 30, { menace: 1 }); }
				else { M.step(0.5, 1 / 30, { menace: 0.3 }); M.beat(what); M.step(0.6, 1 / 30, { menace: 0.3 }); }
				return { ...r, ph };
			}, [kind, N, SEED, light, what]);
			const url = await page.evaluate((v) => window.MOB.shot(v), view);
			const file = path.join(OUT, `${kind}-${name}.png`);
			fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
			console.log('shot', path.basename(file), JSON.stringify(info));
		}
	}
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 2000) : 'no errors');
	await browser.close();
	server.close();
	process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
