// The building crews before and after, close up. Bundle the preview first:
//   npx esbuild island/tools/crew-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> node island/tools/crew-browser.cjs
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || path.join(ROOT, 'docs/verification/crew');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
const WORK = ['carry', 'shoulder', 'pane', 'hammer', 'shovel', 'guide', 'pour'];
const MORE = ['lay', 'talk', 'idle', 'walk', 'hammer', 'shovel', 'carry'];
// [name, poses, mode, camera [x, y, z, tx, ty, tz, fov], t (the task's clock)]
const SHOTS = [
	['before-work', WORK, 'figures', [0, 1.5, -9.5, 0, 0.95, 0, 34]],
	['after-work', WORK, 'people', [0, 1.5, -9.5, 0, 0.95, 0, 34]],
	['after-work-side', WORK, 'people', [7, 1.6, -6, 0, 0.95, 0, 40]],
	['before-more', MORE, 'figures', [0, 1.5, -9.5, 0, 0.95, 0, 34]],
	['figures-far', [...WORK, ...MORE], 'figures', [0, 6, -40, 0, 0.95, 0, 22]],
	['after-more', MORE, 'people', [0, 1.5, -9.5, 0, 0.95, 0, 34]],
	['after-close-hammer', ['hammer'], 'people', [1.2, 1.5, -2.2, 0, 1.0, 0, 34], 0.2],
	['after-close-hammer-up', ['hammer'], 'people', [1.2, 1.5, -2.2, 0, 1.0, 0, 34], 0.48],
	['after-close-shovel', ['shovel'], 'people', [1.6, 1.4, -2.0, 0, 0.8, 0, 36], 0.3],
	['after-close-carry', ['carry', 'shoulder'], 'people', [1.6, 1.5, -2.8, 0, 1.0, 0, 38]],
	['after-close-pane', ['pane', 'guide'], 'people', [1.6, 1.5, -2.8, 0, 1.0, 0, 38]],
	['after-close-face', ['talk'], 'people', [0.3, 1.65, -1.1, 0, 1.6, 0, 30]],
	// the far figures made of a real body (crewbake.js), close enough to judge and as seen
	['baked-work', WORK, 'baked', [0, 1.5, -9.5, 0, 0.95, 0, 34]],
	['baked-more', MORE, 'baked', [0, 1.5, -9.5, 0, 0.95, 0, 34]],
	['baked-face', ['talk', 'hammer'], 'baked', [0.6, 1.7, -2.6, 0, 1.45, 0, 30]],
	['baked-far', [...WORK, ...MORE], 'baked', [0, 6, -40, 0, 0.95, 0, 22]],
];
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/crew-preview.js"></script>'); return; }
		const file = name === '/island/dist/crew-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 1600, height: 800 }, ...(process.env.PHONE ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } : {}) });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=1600&h=800`);
	await page.waitForFunction(() => window.CP_READY, null, { timeout: 240000 });
	const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
	for (const [name, poses, mode, c, t] of SHOTS) {
		if (only && !only.includes(name)) continue;
		const info = await page.evaluate(([p, m, t]) => window.CP.show(p, 1.6, m, t ?? 0.3), [poses, mode, t]);
		if (t !== undefined) await page.evaluate(([t, m]) => (m === 'baked' ? window.CP.atBaked(t) : window.CP.at(t)), [t, mode]);
		const url = await page.evaluate((c) => window.CP.cam(...c), c);
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log(name, mode === 'baked' ? JSON.stringify(await page.evaluate(() => window.CP.crew.bakes())) : JSON.stringify(info.map((b) => [b.pose, b.tool, b.fade])).slice(0, 400));
	}
	console.log('stats', JSON.stringify(await page.evaluate(() => window.CP.stats())));
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
