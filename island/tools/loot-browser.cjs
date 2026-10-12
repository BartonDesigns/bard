const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..'), out = process.env.LOOT_OUT || '/tmp/bard-loot-results';
(async () => {
	await fs.mkdir(out, { recursive: true });
	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url, 'http://localhost');
			if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/island/dist/loot-review.js"></script>'); return; }
			if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
			const file = url.pathname === '/island/dist/loot-review.js' ? process.env.LOOT_BUNDLE : path.resolve(root, '.' + url.pathname);
			if (file !== process.env.LOOT_BUNDLE && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
			res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
			res.end(await fs.readFile(file));
		} catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const report = { method: 'Production combat, squad death, Rapier ragdoll, recovery UI and inventory in Chromium software WebGL; flat fixture terrain. Touch emulation, not physical-device performance.', states: [], errors: [] };
	try {
		for (const phone of [false, true]) {
			const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: phone, isMobile: phone });
			const p = await context.newPage(); p.on('pageerror', (e) => report.errors.push(e.message));
			p.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
			await p.goto(`http://127.0.0.1:${server.address().port}/`);
			await p.waitForFunction(() => window.review, { timeout: 45000 });
			const killed = await p.evaluate(() => review.fallen());
			assert.equal(killed.result.killed, true); assert.equal(killed.loot.count, 1);
			assert.equal(killed.loot.drops[0].weapon.l, killed.expected.l); assert.equal(killed.loot.drops[0].weapon.t, killed.expected.t);
			assert.equal(killed.ragdoll.err, null);
			assert.ok(killed.ragdoll.head?.[1] < 1, 'the defeated soldier must actually fall');
			const panel = p.locator('[data-field-recovery]'); await panel.waitFor({ state: 'visible' });
			await p.screenshot({ path: path.join(out, phone ? 'phone-recovery.png' : 'desktop-recovery.png') });
			let s = await p.evaluate(() => review.state()); assert.equal(s.shaderOK, true); assert.equal(s.glError, 0);
			const bounds = await panel.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= (phone ? 390 : 1280));
			await p.evaluate(() => review.busy(true)); assert.equal(await panel.isVisible(), false);
			await p.keyboard.press('e'); s = await p.evaluate(() => review.state()); assert.equal(s.loot.count, 1);
			await p.evaluate(() => { review.busy(false); review.move(10); }); assert.equal(await panel.isVisible(), false);
			await p.evaluate(() => { review.move(-10); review.lookAway(); }); assert.equal(await panel.isVisible(), false);
			await p.evaluate(() => review.lookAway()); assert.equal(await panel.isVisible(), true);
			await p.evaluate(() => { review.arms.lockTrades(['pending']); review.frame(); }); assert.equal(await panel.isVisible(), false);
			await p.evaluate(() => { review.arms.lockTrades([]); review.frame(); });
			if (phone) await panel.getByRole('button', { name: 'Take', exact: true }).tap(); else await p.keyboard.press('e');
			s = await p.evaluate(() => review.state()); assert.equal(s.loot.count, 0); assert.equal(s.held, null); assert.equal(Object.keys(s.inventory.instances).length, 2);
			const saved = s.inventory.instances;
			const originalUid = killed.loot.drops[0].weapon.u;
			await p.evaluate((uid) => review.arms.hold(uid), originalUid);
			await p.reload(); await p.waitForFunction(() => window.review);
			s = await p.evaluate(() => review.state()); assert.deepEqual(s.inventory.instances, saved);
			assert.equal(s.held.u, originalUid);
			const second = await p.evaluate(() => review.fallen('dunecutters'));
			await panel.waitFor({ state: 'visible' });
			const beforeInteraction = (await p.evaluate(() => review.state())).laterInteractions;
			if (phone) await panel.getByRole('button', { name: 'Take & equip', exact: true }).tap(); else await p.keyboard.press('Shift+e');
			s = await p.evaluate(() => review.state()); assert.equal(s.held.i, 'warden-spark-carbine'); assert.equal(s.held.t, second.expected.t); assert.equal(s.loot.count, 0);
			assert.equal(Object.keys(s.inventory.instances).length, 4); assert.equal(s.laterInteractions, beforeInteraction);
			await p.keyboard.press('e'); assert.equal(Object.keys((await p.evaluate(() => review.state())).inventory.instances).length, 4);
			report.states.push({ phone, killed, second, final: s, bounds });
			await context.close(); console.log('PASS', phone ? 'touch' : 'desktop', 'death, recovery, take, equip, persistence, range, facing, busy, trade locks, duplicate input');
		}
		assert.deepEqual(report.errors, []); report.passed = true;
	} finally { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
