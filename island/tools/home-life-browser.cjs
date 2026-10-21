// Families at home review: bundles home-preview-entry.mjs (production houses.js houses and the
// real family-life.js/home-life.js people), serves it, and saves a PNG per shot with what the
// house is doing.
//   node island/tools/home-life-browser.cjs [outdir] [prefix]      (SHOTS=a,b to pick)
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.argv[2] || '/tmp/claude-0/review/home-life';
const PREFIX = process.argv[3] || 'home';
const BUNDLE = path.join(require('node:os').tmpdir(), 'home-review.js');
// [name, expression]: inside(house, room types, hour, corner) | scatter(why)
const SHOTS = [
	['tract-dinner', 'inside(0, ["dining", "kitchen"], 18.8)'],
	['tract-dinner-close', 'near(0, 1.4, 0.3)'],
	['tract-tv', 'inside(0, ["family", "living"], 20.6)'],
	['tract-tv-close', 'near(0, 1.8, 0.4)'],
	['tract-night-master', 'inside(0, ["master"], 2.5)'],
	['tract-night-close', 'near(0, 1.5, 0.8)'],
	['tract-night-close2', 'near(1, 1.2, 1.2, -1)'],
	['tract-night-bed', 'inside(0, ["bed"], 2.5)'],
	['tract-cooking', 'inside(0, ["kitchen"], 17.9, 1)'],
	['tract-morning', 'inside(0, ["kitchen", "dining"], 7.2)'],
	['ranch-tv', 'inside(1, ["family", "living"], 20.2)'],
	['ranch-night', 'inside(1, ["master", "bed"], 3)'],
	['small-evening', 'inside(2, ["living"], 19.6)'],
	['split-dinner', 'inside(3, ["dining", "kitchen"], 18.9)'],
	['split-dinner-scatter', 'scatter("window", 1.2)'],
	['split-dinner-after', 'scatter("window", 8)'],
	['tract-tv-scatter', 'inside(0, ["family", "living"], 20.6)'],
	['tract-tv-scatter-after', 'scatter("window", 7)'],
	['ranch-tv-scatter', 'inside(1, ["family", "living"], 20.2)'],
	['ranch-tv-scatter-after', 'scatter("wall", 7)'],
];
(async () => {
	const esbuild = require(path.join(ROOT, 'island/node_modules/esbuild'));
	await esbuild.build({ entryPoints: [path.join(ROOT, 'island/tools/home-preview-entry.mjs')], bundle: true, format: 'esm', outfile: BUNDLE, logLevel: 'warning' });
	await fs.mkdir(OUT, { recursive: true });
	const server = http.createServer(async (req, res) => {
		const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (p === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><style>html,body{margin:0;overflow:hidden}</style><script type="module" src="/island/dist/home-review-b.js"></script>'); return; }
		if (p === '/island/dist/home-review-b.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(BUNDLE)); return; }
		try { res.end(await fs.readFile(path.join(ROOT, p))); } catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [], report = [];
	try {
		const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
		await page.goto(`http://127.0.0.1:${server.address().port}/`);
		await page.waitForFunction(() => window.HOME_READY, null, { timeout: 120000 });
		const only = process.env.SHOTS ? new Set(process.env.SHOTS.split(',')) : null;
		for (const [name, expr] of SHOTS) {
			if (only && !only.has(name)) continue;
			const meta = await page.evaluate('homeReview.' + expr);
			const file = path.join(OUT, `${PREFIX}-${name}.png`);
			await page.screenshot({ path: file });
			const actors = await page.evaluate(() => homeReview.placed());
			report.push({ name, file, ...meta, actors });
			console.log(JSON.stringify({ name, ...meta, actors }));
		}
	} finally {
		await fs.writeFile(path.join(OUT, `${PREFIX}-report.json`), JSON.stringify({ report, errors }, null, 2));
		await browser.close(); server.close();
	}
	if (errors.length) { console.error('ERRORS', errors.slice(0, 10)); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 1; });
