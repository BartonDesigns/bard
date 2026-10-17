// Armour and combat gear captures. Bundle the preview first:
//   npx esbuild island/tools/armor-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> node island/tools/armor-browser.cjs
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || path.join(ROOT, 'docs/verification/armor');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
const SETS = [['knight'], ['sergeant'], ['squire', 1278, true], ['operator', 77], ['rigged', 3311, true], ['mage', 9172, true], ['ranger', 5150]];
const MIL = [1, 2, 3, 4, 5, 6, 7].map((k) => [`militia/${k * 104729}`, 900 + k, k % 3 === 0]).concat([['soldier/77', 77], ['soldier/31', 31]]);
const SHOTS = [
	['sets-front', SETS, [0, 1.15, -7.2, 0, 0.95, 0, 30], 1.0],
	['sets-back', SETS, [0, 1.3, 7.2, 0, 0.95, 0, 30], 1.0],
	['knight-close', [['knight']], [0.9, 1.5, -2.1, 0, 1.15, 0, 32]],
	['sergeant-close', [['sergeant']], [-0.9, 1.5, -2.1, 0, 1.15, 0, 32]],
	['operator-close', [['operator', 77]], [0.9, 1.5, -2.1, 0, 1.15, 0, 32]],
	['operator-head', [['operator', 77]], [0.55, 1.75, -0.75, 0, 1.6, 0, 30]],
	['knight-hand', [['knight']], [0.75, 0.95, -0.75, 0.2, 0.78, 0, 30]],
	['operator-hand', [['operator', 77]], [0.75, 0.95, -0.75, 0.2, 0.78, 0, 30]],
	['knight-legs', [['knight']], [0.6, 0.6, -1.6, 0, 0.45, 0, 32]],
	['mage-close', [['mage', 9172, true]], [-0.8, 1.5, -2.0, 0, 1.15, 0, 32]],
	['militia', MIL, [0, 1.2, -8.6, 0, 0.95, 0, 30], 0.9],
];
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/armor-preview.js"></script>'); return; }
		const file = name === '/island/dist/armor-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=1600&h=800`);
	await page.waitForFunction(() => window.AP_READY, null, { timeout: 240000 });
	for (const [name, list, c, gap] of SHOTS) {
		const info = await page.evaluate(([l, g]) => window.AP.lineup(l, g), [list, gap]);
		const url = await page.evaluate((c) => window.AP.cam(...c), c);
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log(name, JSON.stringify(info.map((x) => x.acc)).slice(0, 300));
	}
	console.log('failed programs', await page.evaluate(() => window.AP.failed()));
	console.log(errs.length ? 'ERR ' + errs.join(' | ').slice(0, 800) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
