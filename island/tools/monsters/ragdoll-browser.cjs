// Shoot a creature going limp in headless Chromium (the game's body, light and ragdoll).
//   npx esbuild island/tools/monsters/ragdoll-preview.mjs --bundle --format=esm --outfile=<bundle>
//   BUNDLE=<bundle> ID=ridge-hound OUT=<dir> node island/tools/monsters/ragdoll-browser.cjs
// FROM=left|front|behind SPEED=4 MASS=60 LIMP=1 (0.35: a knockdown, then it gets up: RISE=1)
// TIMES=0,0.25,0.6,1.2,3 (seconds into the fall to shoot) VIEWS=three,side PHONE=1 (a phone's
// piece count). Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, ID = process.env.ID || 'ridge-hound', OUT = process.env.OUT || '/tmp/ragdoll-preview';
const TIMES = (process.env.TIMES || '0,0.25,0.6,1.2,3').split(',').map(Number), VIEWS = (process.env.VIEWS || 'three').split(',');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.json': 'application/json' };
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const p = new URL(req.url, 'http://x').pathname;
		if (p === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/b.js"></script>'); return; }
		const f = p === '/b.js' ? BUNDLE : p === '/rapier.mjs' ? path.join(root, 'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs') : p.startsWith('/assets/') ? path.join(root, p) : null;
		if (!f) { res.writeHead(404); res.end(); return; }
		fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const W = +(process.env.W || 900), H = +(process.env.H || 700);
	const page = await browser.newPage({ viewport: { width: W, height: H } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error' && !/texture|GL_INVALID/i.test(m.text())) errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=${W}&h=${H}&phone=${process.env.PHONE || 0}`);
	await page.waitForFunction(() => window.RP_READY, null, { timeout: 120000 });
	const info = await page.evaluate((id) => window.RP.load(id), ID);
	console.log('body', JSON.stringify(info));
	const save = async (name, view) => {
		const url = await page.evaluate((v) => window.RP.shot(v), view);
		fs.writeFileSync(path.join(OUT, `${ID}-${name}-${view}.png`), Buffer.from(url.split(',')[1], 'base64'));
	};
	for (const v of VIEWS) await save('standing', v);
	const how = { from: process.env.FROM || 'left', speed: +(process.env.SPEED || 4), mass: +(process.env.MASS || 60), limp: +(process.env.LIMP ?? 1) };
	const ok = await page.evaluate((how) => window.RP.strike(how), how);
	console.log('struck', ok, JSON.stringify(how));
	// (the ragdoll builds once Rapier is ready: a tick)
	await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
	let t = 0;
	const log = [];
	for (const T of TIMES.sort((a, b) => a - b)) {
		const n = Math.max(0, Math.round((T - t) * 60));
		const i = await page.evaluate((n) => window.RP.step(1 / 60, n), n);
		t = T;
		log.push({ t: T, ...i, rag: undefined, live: i.rag.live, err: i.rag.err });
		console.log('t', T, JSON.stringify({ top: i.top, low: i.low, spread: i.spread, live: i.rag.live, err: i.rag.err, at: i.at }));
		for (const v of VIEWS) await save(`t${T}`, v);
	}
	if (process.env.RISE) {
		const i = await page.evaluate(() => window.RP.rise(1 / 60, 10));
		console.log('rising', JSON.stringify({ top: i.top, low: i.low }));
		for (const v of VIEWS) await save('rise-0', v);
		const j = await page.evaluate(() => window.RP.rise(1 / 60, 60));
		console.log('risen', JSON.stringify({ top: j.top, low: j.low }));
		for (const v of VIEWS) await save('rise-1', v);
	}
	fs.writeFileSync(path.join(OUT, `${ID}-log.json`), JSON.stringify(log, null, 1));
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close();
	server.close();
	if (errs.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
