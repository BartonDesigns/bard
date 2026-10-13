// Renders the house and office look review: bundles decor-preview.mjs, serves it, and saves
// a PNG per shot with its draw and material counts.
//   node island/tools/decor-browser.cjs [outdir] [prefix]
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.argv[2] || '/tmp/claude-0/review/interiors';
const PREFIX = process.argv[3] || 'after';
const BUNDLE = path.join(require('node:os').tmpdir(), 'decor-review.js');
const SHOTS = [
	['prewar-living', 'inside(0, ["living", "dining"])'], ['prewar-kitchen', 'inside(0, ["kitchen"])'], ['prewar-bed', 'inside(0, ["bed", "master"])'],
	['ranch-living', 'inside(1, ["living", "family"])'], ['ranch-kitchen', 'inside(1, ["kitchen"])'], ['ranch-bath', 'inside(1, ["bath", "mbath"])'],
	['split-family', 'inside(2, ["family", "living"])'], ['split-kitchen', 'inside(2, ["kitchen"])'],
	['tract-living', 'inside(3, ["living", "family"])'], ['tract-kitchen', 'inside(3, ["kitchen"])'], ['tract-bed', 'inside(3, ["bed"])'],
	['modern-living', 'inside(4, ["living", "family"])'], ['modern-kitchen', 'inside(4, ["kitchen"])'],
	['victorian-dining', 'inside(5, ["dining", "living"])'], ['victorian-bed', 'inside(5, ["master", "bed"])'],
	['ext-prewar', 'outside(0)'], ['ext-ranch', 'outside(1)'], ['ext-split', 'outside(2)'], ['ext-tract', 'outside(3)'], ['ext-modern', 'outside(4)'], ['ext-victorian', 'outside(5)'],
	['office-a', 'office(0, 30)'], ['office-b', 'office(0, 33)'], ['office-c', 'office(1, 12)'], ['office-d', 'office(2, 6)'],
];
(async () => {
	const esbuild = require(path.join(ROOT, 'island/node_modules/esbuild'));
	await esbuild.build({ entryPoints: [path.join(ROOT, 'island/tools/decor-preview.mjs')], bundle: true, format: 'esm', outfile: BUNDLE, logLevel: 'warning' });
	await fs.mkdir(OUT, { recursive: true });
	const server = http.createServer(async (req, res) => {
		const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (p === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><style>html,body{margin:0;overflow:hidden}</style><script type="module" src="/b.js"></script>'); return; }
		if (p === '/b.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(BUNDLE)); return; }
		try { res.end(await fs.readFile(path.join(ROOT, p))); } catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [], report = [];
	try {
		const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
		await page.goto(`http://127.0.0.1:${server.address().port}/`);
		await page.waitForFunction(() => window.DECOR_READY, null, { timeout: 120000 });
		if (process.env.DECOR_NAMES) await page.evaluate(() => { window.DECOR_NAMES = true; });
		const only = process.env.SHOTS ? new Set(process.env.SHOTS.split(',')) : null;
		for (const [name, expr] of SHOTS) {
			if (only && !only.has(name)) continue;
			const meta = await page.evaluate('decorReview.' + expr);
			const file = path.join(OUT, `${PREFIX}-${name}.png`);
			await page.screenshot({ path: file });
			report.push({ name, file, ...meta });
			console.log(JSON.stringify({ name, ...meta }));
		}
	} finally {
		await fs.writeFile(path.join(OUT, `${PREFIX}-report.json`), JSON.stringify({ report, errors }, null, 2));
		await browser.close(); server.close();
	}
	if (errors.length) { console.error('ERRORS', errors.slice(0, 10)); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 1; });
