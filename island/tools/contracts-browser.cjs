const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..'), out = process.env.CONTRACTS_OUT || '/tmp/bard-contracts-results';
(async () => {
	await fs.mkdir(out, { recursive: true });
	const server = http.createServer(async (req, res) => {
		try {
			const u = new URL(req.url, 'http://local');
			if (u.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/island/dist/review.js"></script>'); return; }
			if (u.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
			const f = u.pathname === '/island/dist/review.js' ? process.env.LOOT_BUNDLE : path.resolve(root, '.' + u.pathname);
			if (f !== process.env.LOOT_BUNDLE && !f.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
			res.setHeader('Content-Type', /\.m?js$/.test(f) ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream'); res.end(await fs.readFile(f));
		} catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const report = { states: [], errors: [], method: 'Production combat, role AI, mission state, caches, recovery, Web Audio and saved inventory; controlled flat world, desktop and touch emulation.' };
	try {
		for (const phone of [false, true]) {
			const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: phone, isMobile: phone });
			const p = await context.newPage(); p.on('pageerror', (e) => report.errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
			await p.goto(`http://127.0.0.1:${server.address().port}/`); await p.waitForFunction(() => window.review); await p.keyboard.press('Shift');
			await p.evaluate(() => review.setupContracts());
			const panel = p.locator('[data-field-contract]'), loot = p.locator('[data-field-recovery]');
			for (let n = 0; n < 3; n++) {
				await panel.getByRole('button', { name: /Field contracts/ }).click(); await panel.getByRole('button', { name: 'Accept contract', exact: true }).click();
				let s = await p.evaluate(() => review.contractState()); assert.equal(s.mission.stage, 'travel'); assert.equal(s.completed, n);
				const credits = s.inventory.credits, expected = s.mission.def.credits;
				await p.evaluate(() => { review.contractMove(); review.step(260); });
				for (let wave = 0; wave < (n === 0 ? 0 : n === 1 ? 1 : 2); wave++) {
					await p.evaluate(() => review.resume(false));
					await p.waitForFunction(() => { const s = review.contractState(); return !s.pending && s.enemies.length === 2; }, null, { timeout: 45000 });
					await p.evaluate(() => review.pause());
					s = await p.evaluate(() => review.contractState()); assert.equal(s.mission.stage, 'secure'); assert.equal(s.loot.drops.some((d) => d.id.endsWith('c')), false);
					const roles = await p.evaluate(() => review.contractState().enemies.map((e) => { const h = review.combat.layer.get(e.id).ref; return { role: e.role, tactic: h.role, speed: h.B.speed, burst: h.B.burst, range: h.B.range, loadout: h.loadout, visibleWeapon: h.body.hand.model.userData.id, armour: h.H.armourMax }; }));
					for (const r of roles) { assert.ok(r.role); assert.equal(r.loadout.i, r.visibleWeapon); }
					report.states.push({ phone, contract: n, wave, roles });
					// The second contract proves surrender clears an objective without executions.
					await p.evaluate((spare) => review.resolveGuards(spare), n === 1);
					await p.evaluate(() => review.step(330));
				}
				s = await p.evaluate(() => review.contractState()); assert.equal(s.mission.stage, 'recover'); assert.equal(s.unlocked, true);
				await p.evaluate(() => { review.contractMove(); review.step(90); }); await loot.waitFor({ state: 'visible' });
				await p.screenshot({ path: path.join(out, `${phone ? 'phone' : 'desktop'}-cache-${n}.png`) });
				if (phone) await loot.getByRole('button', { name: 'Take & equip', exact: true }).tap(); else await p.keyboard.press('Shift+e');
				s = await p.evaluate(() => review.contractState()); assert.equal(s.mission.stage, 'return'); assert.ok(s.loot.pickup > 0);
				await p.evaluate(() => review.step(12)); await p.screenshot({ path: path.join(out, `${phone ? 'phone' : 'desktop'}-pickup-${n}.png`) });
				if (n === 0) {
					const owned = Object.keys(s.inventory.instances).length;
					await panel.getByRole('button', { name: 'Abandon', exact: true }).click();
					assert.equal((await p.evaluate(() => review.contractState())).inventory.credits, credits);
					await p.reload(); await p.waitForFunction(() => window.review); await p.keyboard.press('Shift'); await p.evaluate(() => review.setupContracts());
					await panel.getByRole('button', { name: /Field contracts/ }).click(); await panel.getByRole('button', { name: 'Accept contract', exact: true }).click();
					await p.evaluate(() => { review.contractMove(); review.step(2); });
					const retry = await p.evaluate(() => review.contractState()); assert.equal(retry.mission.stage, 'return'); assert.equal(Object.keys(retry.inventory.instances).length, owned); assert.equal(retry.loot.count, 0);
				}
				await p.evaluate(() => { review.step(30); review.contractMove('rally', 0); review.step(2); });
				s = await p.evaluate(() => review.contractState()); assert.equal(s.mission, null); assert.equal(s.completed, n + 1); assert.equal(s.inventory.credits, credits + expected);
				await p.evaluate(() => review.step(60)); assert.equal((await p.evaluate(() => review.contractState())).inventory.credits, credits + expected);
				const render = await p.evaluate(() => review.state()); assert.equal(render.shaderOK, true); assert.equal(render.glError, 0);
				report.states.push({ phone, completed: n + 1, reward: expected, audio: s.audio, render: render.render });
			}
			// Reload preserves progression and all acquired weapons.
			const before = await p.evaluate(() => review.contractState());
			await p.reload(); await p.waitForFunction(() => window.review); await p.evaluate(() => review.setupContracts());
			const after = await p.evaluate(() => review.contractState()); assert.equal(after.completed, 3); assert.deepEqual(after.inventory.instances, before.inventory.instances);
			assert.ok(before.audio.played >= 8, 'layered audio must execute');
			await context.close(); console.log('PASS', phone ? 'touch' : 'desktop', 'three complete contracts, role loadouts, surrender, waves, cache/pickup animation, payment and persistence');
		}
		assert.deepEqual(report.errors, []); report.passed = true;
	} finally { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
