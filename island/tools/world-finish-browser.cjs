// Bundle world-finish-preview.mjs to dist/world-finish-preview.js first. Run Chromium serially.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
	const root = path.resolve(__dirname, '../..');
	const server = http.createServer(async (req, res) => {
		try {
			const name = new URL(req.url, 'http://local').pathname;
			if (name === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<html></html>'); return; }
			const file = path.resolve(root, '.' + name); if (!file.startsWith(root + path.sep)) throw Error('path');
			res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'); res.end(await fs.readFile(file));
		} catch { res.statusCode = 404; res.end(); }
	});
	await new Promise(r => server.listen(0, '127.0.0.1', r));
	let browser;
	try {
		browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined,
			args: process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
		const page = await browser.newPage({ viewport: { width: 960, height: 600 } }), errors = [];
		page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
		await page.goto('http://127.0.0.1:' + server.address().port + '/');
		await page.setContent('<script type="module" src="/island/dist/world-finish-preview.js"></script>');
		await page.waitForFunction(() => window.WORLD_REVIEW_READY, {}, { timeout: 120000 });
		const report = await page.evaluate(() => worldReview.checks());
		for (const frame of report.frames) {
			assert.equal(frame.restored, true); assert.equal(frame.error, 0);
			assert.ok(frame.after.lit > 560000, 'no black frame');
			assert.ok(frame.after.mean >= frame.before.mean - .1, 'additive glow cannot darken the scene');
		}
		assert.equal(report.resize, 0); assert.equal(report.failed, 0); assert.equal(report.lost, false); assert.deepEqual(errors, []);
		assert.equal(report.vegetation.submerged, 0); assert.ok(report.vegetation.bank > 100); assert.ok(report.vegetation.dry > 100);
		if (process.env.BARD_WORLD_REVIEW_OUT) {
			await fs.mkdir(process.env.BARD_WORLD_REVIEW_OUT, { recursive: true });
			await fs.writeFile(path.join(process.env.BARD_WORLD_REVIEW_OUT, 'vehicles.png'), Buffer.from((await page.evaluate(() => worldReview.png())).split(',')[1], 'base64'));
			await fs.writeFile(path.join(process.env.BARD_WORLD_REVIEW_OUT, 'render.json'), JSON.stringify(report, null, 2));
		}
		console.log(JSON.stringify(report));
	} finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
