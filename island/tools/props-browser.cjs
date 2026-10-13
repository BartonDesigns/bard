// Review renders of carried things and the lost dog: contact sheets of the shared bags
// (near and far, with triangle counts), the favour props, people carrying bags mid-stride,
// the dog in each mood, the reunion frame by frame, and the dog's sounds as WAV files.
// Bundle first:  npx esbuild island/tools/props-preview.mjs --bundle --format=esm --outfile=island/dist/props-review.js
// Then:          node island/tools/props-browser.cjs   (PROPS_OUT for the folder; PROPS_ONLY=bags,dog,... to pick)
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.PROPS_BUNDLE || path.join(ROOT, 'island/dist/props-review.js');
const OUT = process.env.PROPS_OUT || '/tmp/claude-0/review/props';
const ONLY = (process.env.PROPS_ONLY || 'bags,closeups,favours,people,dogrest,dog,reunion,sounds').split(',');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
(async () => {
	await fs.mkdir(OUT, { recursive: true });
	const server = http.createServer(async (req, res) => {
		try {
			const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
			if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden;background:#222}</style><script type="module" src="/island/dist/props-review.js"></script>'); return; }
			const file = pathname === '/island/dist/props-review.js' ? BUNDLE : path.join(ROOT, pathname);
			if (!file.startsWith(ROOT + path.sep) && file !== BUNDLE) { res.writeHead(403).end(); return; }
			res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(await fs.readFile(file));
		} catch { res.writeHead(404).end(); }
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	const errors = [], report = {};
	try {
		const p = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
		p.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
		p.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text().slice(0, 400)); } });
		await p.goto(`http://127.0.0.1:${server.address().port}/`);
		await p.waitForFunction(() => window.PROPS_READY, null, { timeout: 120000 });
		const shot = async (name) => { const url = await p.evaluate(() => propsReview.snap()); await fs.writeFile(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', name); };
		if (ONLY.includes('bags')) { report.bags = await p.evaluate(() => propsReview.bagSheet()); await shot('bags-contact-sheet.png'); }
		if (ONLY.includes('closeups')) { await p.evaluate(() => propsReview.bagCloseups([0, 2, 4])); await shot('bags-closeups-1.png'); await p.evaluate(() => propsReview.bagCloseups([7, 8, 9])); await shot('bags-closeups-2.png'); }
		if (ONLY.includes('favours')) { report.favours = await p.evaluate(() => propsReview.favourSheet()); await shot('favour-props.png'); }
		if (ONLY.includes('people')) {
			report.people = await p.evaluate(() => propsReview.people());
			await shot('people-carrying.png');
			await p.evaluate(() => propsReview.strapCloseup()); await shot('backpack-straps.png');
		}
		if (ONLY.includes('dogrest')) { await p.evaluate(() => propsReview.dogRest()); await shot('dog-as-built.png'); }
		if (ONLY.includes('dog')) { report.dog = await p.evaluate(() => propsReview.dogMoods()); await shot('dog-moods.png'); }
		if (ONLY.includes('reunion')) {
			await p.evaluate(() => propsReview.reunionStart());
			const frames = [];
			for (let i = 0; i < 48; i++) { const f = await p.evaluate(() => propsReview.reunionFrame(1 / 8, 2)); frames.push(f); if (i % 2 === 0) await shot(`reunion-${String(i / 2).padStart(2, '0')}.png`); }
			report.reunion = frames.filter((f, i) => i % 6 === 0);
		}
		if (ONLY.includes('sounds')) {
			const s = await p.evaluate(() => propsReview.sounds());
			report.sounds = {};
			for (const [name, v] of Object.entries(s)) { await fs.writeFile(path.join(OUT, name), Buffer.from(v.b64, 'base64')); report.sounds[name] = { seconds: v.seconds, peak: v.peak }; console.log('wrote', name); }
		}
	} finally {
		await browser.close(); server.close();
	}
	report.errors = errors;
	await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
	console.log(JSON.stringify(report, null, 1));
	if (errors.length) process.exit(1);
})();
