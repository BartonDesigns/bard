// The wardrobe lineup (wardrobe-preview.mjs). Bundle the preview first:
//   island/node_modules/.bin/esbuild island/tools/wardrobe-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> [SET=day|night|office|beach|suburb|kids|hats|<seeds>] [N=8] [HEADS=1] [BODIES=1] node island/tools/wardrobe-browser.cjs
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || path.join(ROOT, 'docs/verification/wardrobe'), SET = process.env.SET || 'day';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream', '.bin': 'application/octet-stream' };
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/wardrobe-preview.js"></script>'); return; }
		const file = name === '/island/dist/wardrobe-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, ...(process.env.PHONE ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } : {}) });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=1400&h=900&set=${SET}&n=${process.env.N || 8}`);
	await page.waitForFunction(() => window.WP_READY, null, { timeout: 300000 });
	await page.waitForTimeout(8000);
	await page.evaluate(() => window.WP.step(60));
	if (process.env.EVAL) console.log('eval', await page.evaluate(process.env.EVAL));
	const save = (name, url) => { fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); console.log(name); };
	console.log(JSON.stringify(await page.evaluate(() => window.WP.describe()), null, 0));
	save(SET + '-front', await page.evaluate(() => window.WP.row(0)));
	save(SET + '-back', await page.evaluate(() => window.WP.row(3)));
	if (process.env.HEADS) {
		const n = await page.evaluate(() => window.WP.folk.length);
		for (let i = 0; i < n; i++) save(`${SET}-head-${i}`, await page.evaluate((i) => window.WP.shot(i, 0.55, 1, 0.08, 0.03, 40), i));
	}
	if (process.env.BODIES) {
		const n = await page.evaluate(() => window.WP.folk.length);
		for (let i = 0; i < n; i++) save(`${SET}-body-${i}`, await page.evaluate((i) => window.WP.shot(i, 2.4, 1, -0.5, -0.72, 40), i));
	}
	console.log('stats', JSON.stringify(await page.evaluate(() => window.WP.stats())));
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
