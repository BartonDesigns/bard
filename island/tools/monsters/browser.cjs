// Shoot a creature model in headless Chromium (the game's renderer and light).
//   npx esbuild island/tools/monsters/preview.mjs --bundle --format=esm --outfile=<bundle>
//   BUNDLE=<bundle> GLB=<model.glb> META=<meta.json> OUT=<dir> node island/tools/monsters/browser.cjs
// SHOTS=view:pose:t,... (view front|side|back|three|low; pose rest|walk|strike|hit|death).
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const BUNDLE = process.env.BUNDLE, GLB = process.env.GLB, META = process.env.META, OUT = process.env.OUT;
const SHOTS = (process.env.SHOTS || 'front:rest:0,side:rest:0,back:rest:0,three:rest:0,three:walk:0.25,three:strike:0.45').split(',').map((s) => s.split(':'));
const ORTHO = process.env.ORTHO !== '0';
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const files = { '/b.js': [BUNDLE, 'text/javascript'], '/m.glb': [GLB, 'model/gltf-binary'], '/meta.json': [META, 'application/json'] };
	const server = http.createServer((req, res) => {
		const p = new URL(req.url, 'http://x').pathname;
		if (p === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/b.js"></script>'); return; }
		const f = files[p];
		if (!f) { res.writeHead(404); res.end(); return; }
		fs.readFile(f[0], (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', f[1]); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const W = +(process.env.W || 900), H = +(process.env.H || 1200);
	const page = await browser.newPage({ viewport: { width: W, height: H } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=${W}&h=${H}`);
	await page.waitForFunction(() => window.MP_READY, null, { timeout: 120000 });
	const info = await page.evaluate((m) => window.MP.load('/m.glb', m ? '/meta.json' : null), !!META);
	console.log('model', JSON.stringify(info));
	if (process.env.CLAY) await page.evaluate(() => window.MP.clay(false));
	const h = info.size[1];
	// (a long body framed by its length, not its height)
	const span = Math.max(h, info.size[2] * 0.6, info.size[0] * 0.6);
	for (const [view, pose, t] of SHOTS) {
		await page.evaluate(([p, t]) => window.MP.pose(p, +t), [pose, t || 0]);
		const ortho = ORTHO && ['front', 'side', 'back'].includes(view) ? span * 0.53 : null;
		const url = await page.evaluate(([v, h, o, s]) => window.MP.shot(v, h, o, undefined, undefined, undefined, s), [view, h, ortho, span]);
		const name = `${view}-${pose}${t && t !== '0' ? '-' + t : ''}`;
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log('shot', name);
	}
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close();
	server.close();
})().catch((e) => { console.error(e); process.exit(1); });
