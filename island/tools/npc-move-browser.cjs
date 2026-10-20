// Fighters running low and going over fences and ledges, close up. Bundle the preview first:
//   npx esbuild island/tools/npc-move-preview.mjs --bundle --format=esm --outfile=<bundle>
// then: BUNDLE=<bundle> OUT=<dir> node island/tools/npc-move-browser.cjs
// Read back with toDataURL (the drawing buffer is kept), never page.screenshot.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.BUNDLE, OUT = process.env.OUT || '/tmp/npc-move';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
// [name, kind, list, opts, camera]
const SIDE = (z = -3) => [4.2, 1.2, z, 0, 0.9, z, 36];
const SHOTS = [
	['run-low', 'run', [{ low: 0, speed: 3.6, run: 1 }, { low: 0.5, speed: 3.2, run: 1 }, { low: 1, speed: 3.0, run: 1 }, { low: 1, speed: 1.6, run: 0 }], {}, [6, 1.2, -3.5, 0, 0.8, 0, 36]],
	['run-low-side', 'run', [{ low: 1, speed: 3.0, run: 1 }], {}, [4.2, 1.1, 0, 0, 0.8, 0, 36]],
	['run-low-unarmed', 'run', [{ low: 1, speed: 3.0, run: 1 }], { armed: false }, [4.2, 1.1, 0, 0, 0.8, 0, 36]],
	...[0.25, 0.45, 0.6, 0.8].map((t) => [`hop-${t}`, 'vault', [['fence', t]], {}, SIDE()]),
	['hop-front', 'vault', [['fence', 0.5]], {}, [0, 1.7, -7, 0, 1.0, -3, 36]],
	...[0.3, 0.6, 0.8].map((t) => [`mantle-${t}`, 'vault', [['ledge', t]], {}, SIDE(-3.2)]),
	['hop-unarmed', 'vault', [['fence', 0.48]], { armed: false }, SIDE()],
];
(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		if (name === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><body style="margin:0"><script type="module" src="/island/dist/mv-preview.js"></script>'); return; }
		const file = name === '/island/dist/mv-preview.js' ? BUNDLE : path.join(ROOT, name);
		fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
	const errs = [];
	page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
	await page.goto(`http://127.0.0.1:${server.address().port}/?w=1600&h=800`);
	await page.waitForFunction(() => window.MV_READY, null, { timeout: 240000 });
	const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
	for (const [name, kind, list, opts, c] of SHOTS) {
		if (only && !only.includes(name)) continue;
		const info = await page.evaluate(([k, l, o]) => window.MV[k](l, o), [kind, list, opts]);
		const url = await page.evaluate((c) => window.MV.cam(...c), c);
		fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
		console.log(name, JSON.stringify(info));
	}
	console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ').slice(0, 1500) : 'no errors');
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
