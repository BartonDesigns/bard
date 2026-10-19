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
// [name, people, camera [x, y, z, tx, ty, tz, fov], gap, pose, light]
const K = [['knight']], O = [['operator', 77]];
const SHOTS = [
	['sets-front', SETS, [0, 1.15, -7.2, 0, 0.95, 0, 30], 1.0],
	['sets-world', SETS, [0, 1.15, -7.2, 0, 0.95, 0, 30], 1.0, 'idle', 'world'],
	['knight-clay', K, [0, 1.3, -2.3, 0, 1.12, 0, 32], 1, 'idle', 'clay'],
	['knight-clay-side', K, [2.3, 1.3, -0.4, 0, 1.12, 0, 32], 1, 'idle', 'clay'],
	['knight-clay-back', K, [-0.9, 1.5, 2.1, 0, 1.15, 0, 32], 1, 'idle', 'clay'],
	['knight-clay-helm', K, [0.5, 1.55, -0.72, 0, 1.49, 0, 30], 1, 'idle', 'clay'],
	['knight-clay-helm-side', K, [0.8, 1.52, -0.12, 0, 1.5, 0, 28], 1, 'idle', 'clay'],
	['knight-helm-side', K, [0.8, 1.52, -0.12, 0, 1.5, 0, 28]],
	['knight-neck', K, [0.3, 1.45, -0.7, 0, 1.38, 0, 30]],
	['knight-clay-neck', K, [0.3, 1.45, -0.7, 0, 1.38, 0, 30], 1, 'idle', 'clay'],
	['knight-waist', K, [0.35, 1.05, -0.9, 0, 1.0, 0, 30]],
	['knight-waist-side', K, [0.75, 1.0, -0.25, 0, 0.98, 0, 30]],
	['knight-front', K, [0, 1.3, -2.3, 0, 1.12, 0, 32]],
	['knight-close', K, [0.9, 1.5, -2.1, 0, 1.15, 0, 32]],
	['knight-back', K, [-0.9, 1.5, 2.1, 0, 1.15, 0, 32]],
	['knight-helm', K, [0.5, 1.55, -0.72, 0, 1.49, 0, 30]],
	['knight-shoulder', K, [0.75, 1.5, -0.6, 0.15, 1.35, 0, 30]],
	['knight-hand', K, [0.75, 0.95, -0.75, 0.2, 0.78, 0, 30]],
	['knight-hands-close', K, [0.5, 0.82, -0.62, 0.2, 0.66, 0, 28]],
	['knight-hands-back', K, [0.8, 0.8, 0.12, 0.22, 0.66, 0, 28]],
	['knight-hands-aim', K, [1.0, 1.45, -1.1, 0.1, 1.2, 0, 32], 1, 'aim'],
	['knight-legs', K, [0.6, 0.6, -1.6, 0, 0.45, 0, 32]],
	['knight-world', K, [0.9, 1.5, -2.1, 0, 1.15, 0, 32], 1, 'idle', 'world'],
	['knight-walk', K, [1.6, 1.3, -1.6, 0, 1.0, 0, 34], 1, 'walk'],
	['knight-crouch', K, [1.4, 1.2, -1.8, 0, 0.8, 0, 34], 1, 'crouch'],
	['knight-aim', K, [1.6, 1.3, -1.6, 0, 1.1, 0, 34], 1, 'aim'],
	['knight-raise', K, [1.6, 1.4, -1.8, 0, 1.25, 0, 36], 1, 'raise'],
	['operator-clay', O, [0, 1.35, -1.6, 0, 1.2, 0, 32], 1, 'idle', 'clay'],
	['operator-clay-side', O, [1.6, 1.4, -0.3, 0, 1.25, 0, 32], 1, 'idle', 'clay'],
	['operator-clay-head', O, [0.55, 1.75, -0.75, 0, 1.6, 0, 30], 1, 'idle', 'clay'],
	['operator-front', O, [0, 1.35, -1.6, 0, 1.2, 0, 32]],
	['operator-close', O, [0.9, 1.5, -2.1, 0, 1.15, 0, 32]],
	['operator-back', O, [-0.9, 1.5, 2.1, 0, 1.15, 0, 32]],
	['operator-head', O, [0.55, 1.75, -0.75, 0, 1.6, 0, 30]],
	['operator-helmet-side', O, [0.75, 1.7, -0.05, 0, 1.62, 0, 28]],
	['operator-carrier', O, [0.35, 1.3, -0.95, 0, 1.15, 0, 30]],
	['operator-hand', O, [0.75, 0.95, -0.75, 0.2, 0.78, 0, 30]],
	['operator-boots', O, [0.55, 0.35, -0.95, 0, 0.12, 0, 30]],
	['operator-boots-side', O, [1.0, 0.25, -0.1, 0, 0.1, 0, 28]],
	['operator-boots-walk', O, [1.1, 0.4, -1.0, 0, 0.18, 0, 34], 1, 'walk'],
	['operator-boots-crouch', O, [1.1, 0.4, -1.0, 0, 0.18, 0, 34], 1, 'crouch'],
	['operator-hands-close', O, [0.45, 1.0, -0.6, 0.18, 0.82, 0, 26]],
	['operator-hands-back', O, [0.75, 0.95, 0.1, 0.2, 0.82, 0, 26]],
	['operator-hands-aim', O, [1.0, 1.45, -1.1, 0.1, 1.2, 0, 32], 1, 'aim'],
	['operator-world', O, [0.9, 1.5, -2.1, 0, 1.15, 0, 32], 1, 'idle', 'world'],
	['operator-walk', O, [1.6, 1.3, -1.6, 0, 1.0, 0, 34], 1, 'walk'],
	['operator-crouch', O, [1.4, 1.2, -1.8, 0, 0.8, 0, 34], 1, 'crouch'],
	['operator-aim', O, [1.6, 1.3, -1.6, 0, 1.1, 0, 34], 1, 'aim'],
	['operator-raise', O, [1.6, 1.4, -1.8, 0, 1.25, 0, 36], 1, 'raise'],
	['rigged-close', [['rigged', 3311, true]], [0.9, 1.5, -2.1, 0, 1.15, 0, 32]],
	['militia', MIL, [0, 1.2, -8.6, 0, 0.95, 0, 30], 0.9],
	['militia-world', MIL, [0, 1.2, -8.6, 0, 0.95, 0, 30], 0.9, 'idle', 'world'],
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
	// (PHONE=1: as a phone sees it, with its lighter kit and textures)
	const page = await browser.newPage({ viewport: { width: 1600, height: 800 }, ...(process.env.PHONE ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } : {}) });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=1600&h=800`);
	await page.waitForFunction(() => window.AP_READY, null, { timeout: 240000 });
	// (SHOTS=a,b: only those)
	const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
	const stats = {};
	for (const [name, list, c, gap, pose, light] of SHOTS) {
		if (only && !only.includes(name)) continue;
		await page.evaluate((m) => window.AP.light?.(m), light || 'inspect');
		const info = await page.evaluate(([l, g, p]) => window.AP.lineup(l, g, p), [list, gap, pose || 'idle']);
		const t0 = Date.now(), url = await page.evaluate((c) => window.AP.cam(...c), c);
		stats[name] = { ...(await page.evaluate(() => window.AP.stats?.() || {})), renderMs: Date.now() - t0, accTris: info.map((x) => x.accTris) };
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log(name, JSON.stringify(info.map((x) => x.acc)).slice(0, 300));
	}
	fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify({ load: await page.evaluate(() => window.AP_LOAD || null), shots: stats }, null, 1));
	console.log('failed programs', await page.evaluate(() => window.AP.failed()));
	console.log(errs.length ? 'ERR ' + errs.join(' | ').slice(0, 800) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
