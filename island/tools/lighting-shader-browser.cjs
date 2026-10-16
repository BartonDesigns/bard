// Compiles the interior lighting's material copies in a real WebGL context (headless Chromium,
// software GL): a lit room of each material kind drawn with the fixture lights and shadows on.
//   node island/tools/lighting-shader-browser.cjs   (SHOT=file.png saves what it drew)
// Prints the programs, the lights and any shader errors; exits 1 on an error.
const path = require('node:path');
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');

(async () => {
	const r = await esbuild.build({ entryPoints: [path.join(__dirname, 'lighting-shader-entry.mjs')], bundle: true, format: 'esm', write: false, target: 'es2022', logLevel: 'warning' });
	const code = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [];
	try {
		const page = await browser.newPage();
		page.on('pageerror', (e) => errors.push('page: ' + e.message));
		page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 2000)); });
		await page.setContent(`<!doctype html><body><script type="module">${code}</script></body>`);
		let res = null;
		for (let i = 0; i < 240 && !res; i++) { await page.waitForTimeout(500); res = await page.evaluate(() => window.RESULT || null); }
		if (res?.image && process.env.SHOT) require('node:fs').writeFileSync(process.env.SHOT, Buffer.from(res.image.split(',')[1], 'base64'));
		if (res) delete res.image;
		console.log(JSON.stringify(res));
		if (!res || res.errors.length) process.exitCode = 1;
	} finally { await browser.close(); }
	if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 1; });
