// Captures the first-person sleeves for review: every outfit (tools/sleeve-preview.mjs) with each
// rifle and the bow at carry, aim and reload, and the fists at guard, strike and block, on a
// desktop and a phone viewport. Build the preview first:
//   cd island && node_modules/.bin/esbuild tools/sleeve-preview.mjs --bundle --format=esm --outfile=dist/sleeve-preview.js
//   node tools/sleeve-browser.mjs
// SLEEVE_OUT names the folder for the images, SLEEVE_BUNDLE another build of the preview to load; SLEEVE_OUTFITS, SLEEVE_ITEMS and SLEEVE_VIEWS
// (comma lists) narrow what is captured; SLEEVE_PORTRAIT=1 holds the phone upright (390x844). CHROME_EXECUTABLE and PLAYWRIGHT_MODULE as for the
// other hand harnesses.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import http from 'node:http';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'), chromium = pw.chromium || pw.default?.chromium;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = process.env.SLEEVE_OUT || root + '/docs/verification/sleeves';
await fs.mkdir(out, { recursive: true });
const list = (k, all) => process.env[k] ? process.env[k].split(',') : all;
const server = http.createServer(async (req, res) => { try { const name = new URL(req.url, 'http://local').pathname; res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : (name === '/' || name.endsWith('.html')) ? 'text/html' : 'application/octet-stream'); res.end(name === '/' ? '<html></html>' : await fs.readFile(name === '/island/dist/sleeve-preview.js' && process.env.SLEEVE_BUNDLE ? process.env.SLEEVE_BUNDLE : root + name)); } catch { res.statusCode = 404; res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const report = [], errors = []; let browser;
const ITEMS = list('SLEEVE_ITEMS', ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine', 'reedline-hunting-bow', 'fists']);
try {
	browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	for (const view of list('SLEEVE_VIEWS', ['desktop', 'phone'])) {
		const phone = view === 'phone';
		const page = await browser.newPage({ viewport: phone ? (process.env.SLEEVE_PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }) : { width: 1100, height: 700 }, ...(phone ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', isMobile: true, hasTouch: true } : {}) });
		page.setDefaultTimeout(600000);
		page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
		await page.goto('http://127.0.0.1:' + server.address().port + '/');
		await page.setContent('<script type="module" src="/island/dist/sleeve-preview.js"></script>');
		await page.waitForFunction(() => window.SLEEVE_READY, {}, { timeout: 600000 });
		const save = async name => fs.writeFile(out + '/' + view + '-' + name + '.png', Buffer.from((await page.evaluate(() => sleeveReview.png())).split(',')[1], 'base64'));
		for (const outfit of list('SLEEVE_OUTFITS', ['tee', 'hoodie', 'police', 'military', 'layered'])) {
			const dressed = await page.evaluate(o => sleeveReview.dress(o), outfit);
			for (const item of ITEMS) for (const stage of item === 'fists' ? ['guard', 'strike', 'block'] : ['carry', 'aim', 'reload']) {
				const row = await page.evaluate(([item, stage]) => item === 'fists' ? sleeveReview.fist(stage) : sleeveReview.weapon(item, stage), [item, stage]);
				assert.equal(row.failed, 0);
				if (item !== 'fists') for (const side of ['L', 'R']) if (row['contact' + side + 'mm'] != null) assert.ok(row['contact' + side + 'mm'] < 3, JSON.stringify(row));
				report.push({ view, outfit, ...dressed, item, stage, armTris: row.armTris, garment: row.garment, calls: row.calls, tris: row.tris });
				await save(outfit + '-' + item + '-' + stage);
				console.log(view, outfit, item, stage, row.armTris ?? row.tris, row.calls);
			}
		}
		await page.close();
	}
	assert.deepEqual(errors, []);
	await fs.writeFile(out + '/report.json', JSON.stringify({ report, errors }, null, 2)); console.log(JSON.stringify({ states: report.length, errors }));
} finally { await browser?.close(); server.close(); }
