// Third-person clothing and holds captures. Bundle the preview first:
//   npx esbuild island/tools/thirdperson-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> [TAG=before|after] [ONLY=tee,police] node island/tools/thirdperson-browser.cjs
// Every capture is read back with toDataURL (the drawing buffer is kept), never page.screenshot,
// which can time out on a loaded software renderer.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || path.join(ROOT, 'docs/verification/third-person'), TAG = process.env.TAG || 'after';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
// name, show options, camera [x, y, z, tx, ty, tz, fov]
const SHOTS = [
	['tee', 'tee', {}, [1.3, 1.25, -2.9, 0, 0.98, 0, 36]],
	['tee-sleeve', 'tee', {}, [0.75, 1.42, -0.95, 0.12, 1.3, 0, 30]],
	['hoodie', 'hoodie', {}, [1.3, 1.25, -2.9, 0, 0.98, 0, 36]],
	['hoodie-back', 'hoodie', {}, [-1.0, 1.55, 1.6, 0, 1.3, 0, 30]],
	['hoodie-cuff', 'hoodie', {}, [0.85, 1.0, -0.9, 0.2, 0.95, 0, 30]],
	['shirt', 'shirt', {}, [1.3, 1.2, -2.8, 0, 0.92, 0, 36]],
	['shirt-cuff', 'shirt', {}, [0.8, 1.0, -0.85, 0.18, 0.9, 0, 30]],
	['jacket', 'jacket', {}, [1.3, 1.25, -2.9, 0, 0.98, 0, 36]],
	['worker', 'worker', {}, [1.3, 1.25, -2.9, 0, 0.98, 0, 36]],
	['police-patrol', 'police', {}, [1.4, 1.3, -2.9, 0, 1.0, 0, 36]],
	['police-aim', 'police', { aim: true }, [-1.9, 1.45, -2.2, 0, 1.2, -0.2, 36]],
	['soldier-patrol', 'soldier', {}, [1.4, 1.3, -2.9, 0, 1.0, 0, 36]],
	['soldier-aim', 'soldier', { aim: true }, [1.9, 1.5, -2.3, 0, 1.25, -0.2, 36]],
	['soldier-hands', 'soldier', { aim: true }, [-0.9, 1.55, -1.25, 0, 1.38, -0.3, 30]],
	['gang-aim', 'gang', { aim: true }, [1.6, 1.45, -2.5, 0, 1.2, -0.2, 36]],
	['avatar-aim', 'avatar', { aim: true }, [2.0, 1.55, -1.7, 0, 1.3, -0.2, 36]],
	['avatar-hands', 'avatar', { aim: true }, [0.95, 1.6, -1.15, 0, 1.4, -0.3, 30]],
	['avatar-bow', 'avatar', { aim: true, gun: 'reedline-hunting-bow', draw: 1 }, [1.9, 1.6, -2.4, 0, 1.35, -0.1, 36]],
];
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/thirdperson-preview.js"></script>'); return; }
		const file = name === '/island/dist/thirdperson-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
	page.setDefaultTimeout(600000);
	await page.goto(`http://127.0.0.1:${server.address().port}/`, { timeout: 600000 });
	await page.waitForFunction(() => window.TP_READY, null, { timeout: 600000 });
	if (process.env.PATCH) await page.evaluate(process.env.PATCH);
	const only = process.env.ONLY ? process.env.ONLY.split(',') : null, report = {};
	for (const [label, who, opts, c] of SHOTS) {
		if (only && !only.includes(label) && !only.includes(who)) continue;
		const t0 = Date.now();
		const meta = await page.evaluate(([who, opts]) => window.TP.show(who, opts), [who, opts]);
		await page.waitForTimeout(+(process.env.WAIT || 3000));
		const png = await page.evaluate((c) => window.TP.cam(...c), c);
		fs.writeFileSync(path.join(OUT, `${TAG}-${label}.png`), Buffer.from(png.split(',')[1], 'base64'));
		delete meta.outfit;
		report[label] = meta;
		console.log(label, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(meta));
	}
	report.failedPrograms = await page.evaluate(() => window.TP.failed());
	report.errors = errs;
	fs.writeFileSync(path.join(OUT, `${TAG}-report.json`), JSON.stringify(report, null, 1));
	console.log(errs.length ? 'ERRORS ' + errs.slice(0, 5).join(' | ') : 'no errors', 'failed programs', report.failedPrograms);
	await browser.close(); server.close();
})();
