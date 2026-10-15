// First-person weapon hands, every weapon at carry, aim, fire and mid-reload on a desktop and a
// phone viewport: a capture of each, the palm contact the viewmodel reports, and every finger's
// skin measured against the weapon's mesh (tools/weapon-hands-preview.mjs).
//   cd island && node_modules/.bin/esbuild tools/weapon-hands-preview.mjs --bundle --format=esm --outfile=dist/weapon-hands-preview.js
//   OUT=/some/dir node tools/weapon-hands-browser.mjs
// PHONE=0 or DESKTOP=0 skips a viewport; ONLY=id,id limits the weapons; SIZES=1 adds the
// body-size and pitch sweep; STRICT=1 fails on penetration or floating past the limits.
/* global window, weaponReview, weaponHands */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import http from 'node:http';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'), chromium = pw.chromium || pw.default.chromium;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = process.env.OUT || root + '/docs/verification/weapon-hands';
await fs.mkdir(out, { recursive: true });
const server = http.createServer(async (req, res) => { try { const name = new URL(req.url, 'http://local').pathname; res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name === '/' ? 'text/html' : 'application/octet-stream'); res.end(name === '/' ? '<html></html>' : await fs.readFile(root + name)); } catch { res.statusCode = 404; res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const WEAPONS = (process.env.ONLY || 'aurora-trail-rifle,mossback-scout-rifle,warden-spark-carbine,reedline-hunting-bow').split(',');
const STAGES = (process.env.STAGES || 'carry,aim,fire,reload,charge').split(',');
const settle = +(process.env.SETTLE || 2500);
const report = [], errors = [];
let browser;
try {
	browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	for (const phone of [false, true]) {
		if ((phone && process.env.PHONE === '0') || (!phone && process.env.DESKTOP === '0')) continue;
		const page = await browser.newPage({ viewport: phone ? { width: 844, height: 390 } : { width: 1100, height: 700 }, ...(phone ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', isMobile: true, hasTouch: true } : {}) });
		page.setDefaultTimeout(600000);
		page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
		await page.goto('http://127.0.0.1:' + server.address().port + '/');
		await page.setContent('<script type="module" src="/island/dist/' + (process.env.BUNDLE || 'weapon-hands-preview.js') + '"></script>');
		await page.waitForFunction(() => window.WEAPON_HANDS_READY, {}, { timeout: 600000 });
		const tag = phone ? 'phone' : 'desktop';
		for (const id of WEAPONS) {
			await page.evaluate((id) => weaponReview.select(id, 'first'), id);
			for (const stage of STAGES) {
				const row = await page.evaluate(([id, stage]) => {
					const w = weaponReview, bow = id === 'reedline-hunting-bow', R = w.weapon(id)?.reload || 1;
					let accepted = null;
					w.cancel(); if (bow) w.bow({ draw: 0, loaded: true, nock: 1 });
					w.select(id, 'first');
					if (stage === 'aim') { w.aim(true); if (bow) w.bow({ draw: 1, loaded: true, nock: 1 }); for (let i = 0; i < 90; i++) w.frame(1 / 60, false); }
					if (stage === 'fire') { w.aim(true); if (bow) w.bow({ draw: 1, loaded: true, nock: 1 }); for (let i = 0; i < 90; i++) w.frame(1 / 60, false); accepted = w.fire(); for (let i = 0; i < 3; i++) w.frame(1 / 60, false); }
					// mid-reload: the support hand on the cell as it comes out (a third of the way); the
					// charge: the fresh cell seated and the charging stroke (nine tenths)
					if (stage === 'reload' || stage === 'charge') {
						const u = stage === 'reload' ? 0.32 : 0.9;
						if (bow) w.bow({ draw: 0, loaded: false, nock: 0 });
						accepted = w.reload();
						const n = Math.round(u * R * 60);
						for (let i = 0; i < n; i++) { if (bow) w.bow({ draw: 0, loaded: false, nock: i / (R * 60) }); w.frame(1 / 60, false); }
					}
					w.frame();
					return { id, stage, accepted, reloading: w.reloading(), ...w.info(), fingers: weaponHands.fingerContact(), failed: w.failed() };
				}, [id, stage]);
				await page.waitForTimeout(settle);
				const png = await page.evaluate(() => weaponReview.png());
				await fs.writeFile(`${out}/${tag}-${id}-${stage}.png`, Buffer.from(png.split(',')[1], 'base64'));
				if (process.env.CLOSEUPS !== '0') for (const [name, side, from] of [['grip', 'R', [0.9, 0.15, 0.5]], ['grip-left', 'R', [-0.6, 0.35, 0.6]], ['grip-under', 'R', [0.2, -1, 0.35]], ['support', 'L', [-0.25, -0.9, -0.25]], ['support-right', 'L', [0.75, -0.25, -0.3]]]) {
					const shot = await page.evaluate(([side, from]) => weaponHands.closeup(side, from), [side, from]);
					await fs.writeFile(`${out}/${tag}-${id}-${stage}-${name}.png`, Buffer.from(shot.split(',')[1], 'base64'));
				}
				delete row.optics;
				report.push({ tag, ...row });
				const f = row.fingers || {};
				const brief = (s) => f[s] ? Object.entries(f[s]).map(([k, v]) => `${k[0]}${k === 'little' ? 'l' : ''}:${v.minMm}`).join(' ') : '-';
				console.log(tag, id, stage, 'palm', row.contactLmm, row.contactRmm, 'R[', brief('R'), '] L[', brief('L'), ']');
			}
		}
		// close combat: each thing picked up at the guard and mid-swing, and the bare fist
		if (process.env.MELEE !== '0') for (const item of ['knife', 'machete', 'bat', 'pipe', 'bottle', null]) for (const phase of item ? ['guard', 'swing'] : ['guard']) {
			const r = await page.evaluate(([item, phase]) => weaponHands.melee(item, phase), [item, phase]);
			await page.waitForTimeout(settle);
			for (const [k, v] of Object.entries(r.shots)) await fs.writeFile(`${out}/${tag}-melee-${item || 'fist'}-${phase}-${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
			report.push({ tag, melee: item || 'fist', phase, clearanceMm: r.clearanceMm, params: r.params });
			console.log(tag, 'melee', item || 'fist', phase, JSON.stringify(r.clearanceMm), JSON.stringify(r.params?.slice(0, 4)));
		}
		if (process.env.SIZES === '1' && !phone) report.push({ tag, sizes: await page.evaluate(() => weaponReview.sizes?.() || null) });
		await page.close();
	}
	await fs.writeFile(out + '/report.json', JSON.stringify({ report, errors }, null, 1));
	for (const row of report) {
		if (row.failed != null) assert.equal(row.failed, 0, JSON.stringify(row));
		if (process.env.STRICT === '1' && row.fingers) for (const s of ['L', 'R']) for (const [k, v] of Object.entries(row.fingers[s] || {})) assert.ok(v.minMm > -3, `${row.tag} ${row.id} ${row.stage} ${s} ${k} ${v.minMm}`);
	}
	assert.deepEqual(errors, []);
	console.log(JSON.stringify({ states: report.length, errors }));
} finally { await browser?.close(); server.close(); }
