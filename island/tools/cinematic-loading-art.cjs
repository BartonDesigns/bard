// Capture authentic orbital imagery using the production stellar renderer.
// Run with the same browser environment as cinematic-loading-browser.cjs.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { build } = require('esbuild'), sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
(async () => {
	const bundle = await build({ entryPoints: [path.join(__dirname, 'stellar-preview-entry.mjs')], bundle: true, format: 'esm', write: false });
	const server = http.createServer((req, res) => {
		res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
		res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].contents : '<meta charset="utf-8"><script type="module" src="/fixture.js"></script>');
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	let browser;
	try {
		browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
		const page = await browser.newPage(); await page.goto('http://127.0.0.1:' + server.address().port);
		await page.waitForFunction(() => window.STELLAR_READY);
		const capture = await page.evaluate(() => {
			stellar.renderer.setSize(1600, 1000); stellar.camera.aspect = 1.6; stellar.camera.updateProjectionMatrix();
			stellar.go('gargantua', 7); stellar.camera.rotation.x -= .16; stellar.orbit().render(0);
			return stellar.png();
		});
		await sharp(Buffer.from(capture.split(',')[1], 'base64')).webp({ quality: 88 }).toFile(path.join(root, 'assets/loading/horizon.webp'));
		console.log('Saved Gargantua from the production renderer.');
	} finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
