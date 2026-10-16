// Captures the skin for review (tools/skin-preview.mjs): the fists at guard, each rifle at carry
// with its grip close-up, the bow, the bare forearm in a tee, across skin tones, by day and
// indoors, on a desktop and a phone viewport; and a person's face and hands at conversation
// distance. Build the preview first:
//   cd island && node_modules/.bin/esbuild tools/skin-preview.mjs --bundle --format=esm --outfile=dist/skin-preview.js
//   SKIN_OUT=/some/dir node tools/skin-browser.mjs
// SKIN_BUNDLE loads another build of the preview (a BEFORE build, say); SKIN_TONES, SKIN_LIGHTS,
// SKIN_VIEWS and SKIN_SHOTS (comma lists) narrow what is captured; SKIN_FULL=1 adds the other
// rifles and the bow for every tone and light (by default they are captured for the first tone
// by day only). SETTLE: milliseconds to wait before each capture on a loaded machine.
/* global skinReview, process, Buffer */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import http from 'node:http';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'), chromium = pw.chromium || pw.default?.chromium;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = process.env.SKIN_OUT || root + '/docs/verification/skin';
await fs.mkdir(out, { recursive: true });
const list = (k, all) => process.env[k] ? process.env[k].split(',') : all;
const server = http.createServer(async (req, res) => { try { const name = new URL(req.url, 'http://local').pathname; res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name === '/' ? 'text/html' : 'application/octet-stream'); res.end(name === '/' ? '<html></html>' : await fs.readFile(name === '/island/dist/skin-preview.js' && process.env.SKIN_BUNDLE ? process.env.SKIN_BUNDLE : root + name)); } catch { res.statusCode = 404; res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const settle = +(process.env.SETTLE || 1500);
const SHOTS = list('SKIN_SHOTS', ['fists', 'aurora', 'others', 'forearm', 'npc']);
const report = [], errors = []; let browser;
try {
	browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	for (const view of list('SKIN_VIEWS', ['desktop', 'phone'])) {
		const phone = view === 'phone';
		const page = await browser.newPage({ viewport: phone ? { width: 844, height: 390 } : { width: 1100, height: 700 }, ...(phone ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', isMobile: true, hasTouch: true } : {}) });
		page.setDefaultTimeout(1200000);
		page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
		await page.goto('http://127.0.0.1:' + server.address().port + '/');
		await page.setContent('<script type="module" src="/island/dist/skin-preview.js"></script>');
		await page.waitForFunction(() => window.SKIN_READY, {}, { timeout: 1200000 });
		const save = async (name, data) => {
			await page.waitForTimeout(settle);
			const png = data || await page.evaluate(() => skinReview.png());
			if (png) await fs.writeFile(out + '/' + view + '-' + name + '.png', Buffer.from(png.split(',')[1], 'base64'));
			console.log(view, name);
		};
		const tones = list('SKIN_TONES', phone ? ['medium', 'deep'] : ['light', 'medium', 'deep']);
		const lights = list('SKIN_LIGHTS', phone ? ['day'] : ['day', 'indoor']);
		for (const tone of tones) for (const lighting of lights) {
			const first = tone === tones[0] && lighting === lights[0];
			const tag = tone + '-' + lighting;
			report.push({ view, ...(await page.evaluate(o => skinReview.setup(o), { tone, outfit: 'tee', lighting })) });
			if (SHOTS.includes('fists')) {
				const row = await page.evaluate(() => skinReview.fist(false));
				assert.equal(row.failed, 0); report.push({ view, tag, shot: 'fists', ...row });
				await save(tag + '-fists');
				await save(tag + '-fists-back', await page.evaluate(() => skinReview.closeup('R', [0.35, 0.9, 0.55], 0.26)));
				await save(tag + '-fists-front', await page.evaluate(() => skinReview.closeup('L', [0.1, 0.25, 1], 0.24)));
			}
			const rifles = SHOTS.includes('aurora') ? ['aurora-trail-rifle'] : [];
			if (SHOTS.includes('others') && (first || process.env.SKIN_FULL === '1')) rifles.push('mossback-scout-rifle', 'warden-spark-carbine', 'reedline-hunting-bow');
			for (const id of rifles) {
				const row = await page.evaluate(id => skinReview.weapon(id, 'carry'), id);
				assert.equal(row.failed, 0); report.push({ view, tag, shot: id, armTris: row.armTris, calls: row.calls });
				const short = id.split('-')[0];
				await save(tag + '-' + short);
				await save(tag + '-' + short + '-grip', await page.evaluate(() => skinReview.closeup('R', [0.9, 0.15, 0.5], 0.28)));
				if (id !== 'reedline-hunting-bow') await save(tag + '-' + short + '-support', await page.evaluate(() => skinReview.closeup('L', [-0.25, -0.9, -0.25], 0.28)));
			}
			if (SHOTS.includes('forearm')) {
				await page.evaluate(() => skinReview.weapon('aurora-trail-rifle', 'carry'));
				await save(tag + '-forearm', await page.evaluate(() => skinReview.closeup('R', [0.6, 0.7, 0.45], 0.36, 'wrist')));
				await save(tag + '-forearm-under', await page.evaluate(() => skinReview.closeup('L', [-0.3, -0.85, 0.2], 0.36, 'wrist')));
			}
			if (SHOTS.includes('npc')) {
				for (const shot of ['face', 'close', 'hands']) {
					const row = await page.evaluate(([tone, shot]) => skinReview.person(tone, shot), [tone, shot]);
					assert.equal(row.failed, 0);
					await save(tag + '-npc-' + shot);
				}
			}
		}
		report.push({ view, programs: await page.evaluate(() => skinReview.programs()) });
		await page.close();
	}
	assert.deepEqual(errors, []);
	await fs.writeFile(out + '/report.json', JSON.stringify({ report, errors }, null, 2)); console.log(JSON.stringify({ states: report.length, errors }));
} finally { await browser?.close(); server.close(); }
