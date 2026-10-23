// Teen faces, hoodies and hair close up. Bundle the preview first:
//   island/node_modules/.bin/esbuild island/tools/face-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> [PHONE=1] [SHOTS=a,b] node island/tools/face-browser.cjs
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || path.join(ROOT, 'docs/verification/faces');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream', '.bin': 'application/octet-stream' };
// [name, person, distance, direction (0 front, 1 three-quarter, 2 side, 3 back), dy, ty, fov]
const SHOTS = [
	['face-30cm', 0, 0.3, 1, 0.03, 0.04, 50],
	['face-girl-30cm', 2, 0.32, 1, 0.03, 0.04, 50],
	['face-1m', 1, 1.0, 0, 0.02, 0.0, 40],
	['face-3m', 0, 3.0, 1, -0.05, -0.12, 14],
	['face-6m', 1, 6.0, 0, -0.05, -0.12, 10],
	['eyes-20cm', 1, 0.2, 0, 0.05, 0.06, 40],
	['hood-collar', 1, 0.45, 1, -0.05, -0.14, 55],
	['hoodie-back', 0, 1.3, 3, -0.2, -0.3, 50],
	['hoodie-shoulder', 0, 0.7, 2, -0.1, -0.22, 50],
	['white-fabric', 2, 0.35, 0, -0.2, -0.32, 50],
	['hair-30cm', 0, 0.35, 2, 0.12, 0.08, 50],
	['hair-girl', 2, 0.6, 3, 0.05, 0.0, 50],
];
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/face-preview.js"></script>'); return; }
		const file = name === '/island/dist/face-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 900, height: 900 }, ...(process.env.PHONE ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } : {}) });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=900&h=900${process.env.LIGHT ? '&light=' + process.env.LIGHT : ''}`);
	await page.waitForFunction(() => window.FP_READY, null, { timeout: 300000 });
	// (the hair styles come in over the network: let them, then settle the bodies)
	await page.waitForTimeout(8000);
	await page.evaluate(() => window.FP.step(60));
	// (EVAL: a line of script run before the shots, for trying a change by hand)
	if (process.env.EVAL) console.log('eval', await page.evaluate(process.env.EVAL));
	const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
	for (const [name, ...a] of SHOTS) {
		if (only && !only.includes(name)) continue;
		const url = await page.evaluate((a) => window.FP.shot(...a), a);
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log(name);
	}
	console.log('stats', JSON.stringify(await page.evaluate(() => window.FP.stats())));
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
