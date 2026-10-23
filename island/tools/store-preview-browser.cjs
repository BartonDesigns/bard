// Pictures of the walk-in shops' fit-outs from inside the door (store-preview-entry.mjs).
// Bundle first:
//   island/node_modules/.bin/esbuild island/tools/store-preview-entry.mjs --bundle --format=esm --outfile=island/dist/store-review.js
// then: node island/tools/store-preview-browser.cjs [names...]   (STORE_OUT: where the pictures go;
// STORE_DEVICE=phone for a phone's size and settings; STORE_HOURS: the hour, 13 by default)
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.STORE_BUNDLE || path.join(ROOT, 'island/dist/store-review.js');
const OUT = process.env.STORE_OUT || path.join(ROOT, '../store-review');
const phone = process.env.STORE_DEVICE === 'phone', missing = new Set();
(async () => {
	await fs.mkdir(OUT, { recursive: true });
	const server = http.createServer(async (req, res) => {
		const p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
		if (p === '/') { res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden}</style><script>window.PHONE=${phone}</script><script type="module" src="/store-review.js"></script>`); return; }
		if (p === '/store-review.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(BUNDLE)); return; }
		// (the game's own files: the photographic materials the house kit asks for)
		for (const dir of ['island', 'island/dist', '']) {
			const f = path.join(ROOT, dir, p);
			if (!f.startsWith(ROOT)) break;
			try { const data = await fs.readFile(f); res.setHeader('Content-Type', { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' }[path.extname(f)] || 'application/octet-stream'); res.end(data); return; } catch {}
		}
		missing.add(p);
		res.writeHead(404).end();
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
	const errors = [], report = [];
	try {
		const page = await browser.newPage({ viewport: phone ? { width: 390, height: 664 } : { width: 1280, height: 800 } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/GL_INVALID|texture|WebGL: too many errors/i.test(t)) errors.push(m.type() + ': ' + t); } });
		await page.goto(`http://127.0.0.1:${server.address().port}/`);
		await page.waitForFunction(() => window.STORE_READY, null, { timeout: 120000 });
		const names = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => storeReview.names);
		const hours = +(process.env.STORE_HOURS || 13);
		for (const spec of names) {
			// name, or name@x,z,yaw for a view of one's own
			const [name, v] = spec.split('@');
			const view = v ? v.split(',').map(Number) : null;
			const r = await page.evaluate(([n, h, w]) => storeReview.show(n, h, w), [name, hours, view]);
			report.push(r);
			// (the canvas itself: a page screenshot waits on the compositor, which a software GL keeps slow)
			const png = await page.evaluate(() => storeReview.renderer.domElement.toDataURL('image/png'));
			await fs.writeFile(path.join(OUT, `${name}${v ? '-' + v.replace(/,/g, '_') : ''}-${hours}h${phone ? '-phone' : ''}.png`), Buffer.from(png.split(',')[1], 'base64'));
			console.log(JSON.stringify({ name: r.name, ms: r.ms, draws: r.draws, tris: r.tris, programs: r.programs, light: r.light.map((q) => [q.state, q.fixtures, q.verts, q.ms]) }));
		}
	} finally {
		await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify({ report, errors }, null, 2));
		await browser.close(); server.close();
		if (errors.length) console.log('errors:', errors.slice(0, 20));
		if (missing.size) console.log('missing:', [...missing].slice(0, 20));
	}
})().catch((e) => { console.error(e); process.exitCode = 1; });
