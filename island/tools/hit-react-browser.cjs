// Hit zones and reactions, close up. Bundle the preview first:
//   npx esbuild island/tools/hit-react-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> node island/tools/hit-react-browser.cjs
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || '/tmp/hit-react';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
const FRONT = [0, 1.35, -8.5, 0, 0.95, 0, 36];
// [name, hits, opts, camera]
const SHOTS = [
	['zones', [null], { zones: 0 }, [2.2, 1.4, -3.4, 0, 1.0, 0, 34]],
	['react-shoulder', [['shoulder', 'R'], ['shoulder', 'L'], ['shoulder', 'R'], ['arm', 'R']], { at: 0.45, seed: 3 }, FRONT],
	['react-centre', [['chest'], ['chest'], ['chest'], ['gut'], ['gut']], { at: 0.4, seed: 5 }, FRONT],
	['react-head-legs', [['head', null, 0.12], ['head', null, 0.12], ['leg', 'R'], ['leg', 'L'], ['leg', 'R', 0.3, 0.7]], { at: 0.35, seed: 7 }, FRONT],
	['react-unarmed', [['shoulder', 'R'], ['gut'], ['leg', 'L'], ['chest']], { at: 0.45, armed: false, seed: 9 }, FRONT],
	['clutch-close', [['shoulder', 'R']], { at: 0.6, seed: 3 }, [1.0, 1.55, -2.2, 0, 1.25, 0, 32]],
	['clutch-side', [['shoulder', 'R']], { at: 0.6, seed: 3 }, [-2.4, 1.4, -1.2, 0, 1.1, 0, 32]],
	['clutch-unarmed', [['shoulder', 'R'], ['leg', 'L', 0.2], ['gut', null, 0.3]], { at: 0.55, armed: false, seed: 11, gap: 1.2 }, [0, 1.3, -5.5, 0, 0.95, 0, 34]],
];
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/hr-preview.js"></script>'); return; }
		const file = name === '/island/dist/hr-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=1600&h=800`);
	await page.waitForFunction(() => window.HR_READY, null, { timeout: 240000 });
	const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
	for (const [name, hits, opts, c] of SHOTS) {
		if (only && !only.includes(name)) continue;
		const info = await page.evaluate(([h, o]) => window.HR.show(h, o), [hits, opts]);
		const url = await page.evaluate((c) => window.HR.cam(...c), c);
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log(name, JSON.stringify(info));
	}
	if (!only || only.includes('limp')) {
		await page.evaluate(() => window.HR.show([null, null, null], {}));
		for (const [i, n] of [[12, 'limp-a'], [9, 'limp-b']]) { await page.evaluate((i) => window.HR.limp('R', 0.5, i), i); const url = await page.evaluate(() => window.HR.cam(5, 1.2, -4, 0, 0.9, 0, 40)); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(url.split(',')[1], 'base64')); }
	}
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
