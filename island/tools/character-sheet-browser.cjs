// The Character view and gear magic in the running island (Chromium, software WebGL): a save with
// garments worn at several levels and tiers, a bow in hand and some fabric; then Shift+I opens the
// Character view, a worn garment opens its item view, fabric is infused, altered spells are
// cast, and nothing throws. Screenshots go to CHAR_OUT (default /tmp/bard-character).
// Run from the repo root: node island/tools/character-sheet-browser.cjs
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
	const root = path.resolve(__dirname, '../..'), out = process.env.CHAR_OUT || '/tmp/bard-character', report = { errors: [] };
	await fs.mkdir(out, { recursive: true });
	const { attunement } = await import(path.join(root, 'island/src/gameplay/gear-magic.js'));
	const { useFor } = await import(path.join(root, 'island/src/magic/skills.js'));
	// an instance attuned to the school asked for
	const pick = (i, school, l, t) => { for (let n = 0; n < 5000; n++) { const u = `${i.slice(0, 4)}${n.toString(36)}v`; if (attunement({ u, i }) === school) return { u, i, l, t, x: 0 }; } throw Error(i); };
	const inst = [pick('stargazer-circlet', 'radiance', 16, 3), pick('aetherweave-coat', 'umbral', 20, 4), pick('spellbinder-gloves', 'storm', 11, 2), pick('trailstrider-boots', 'dawn', 6, 1), pick('reedline-hunting-bow', 'primal', 18, 3), pick('rangers-jacket', 'warding', 3, 0), pick('mossback-scout-rifle', 'shadow', 9, 1)];
	const [circlet, coat, gloves, boots, bow] = inst;
	const inventory = { version: 2, ownerId: 'player', revision: 1, credits: 4200, heat: 0, items: {}, instances: Object.fromEntries(inst.map((x) => [x.u, x])), hand: bow.u, equipped: { hand: bow.i }, worn: { head: circlet.u, body: coat.u, hands: gloves.u, feet: boots.u }, journal: [], updatedAt: 1 };
	const magic = { v: 1, known: ['sunspark', 'shadowbolt', 'mend', 'lumen', 'shade', 'chain-lightning', 'thunderclap', 'swiftstride', 'dawnsight', 'nightsight'], binds: ['sunspark', 'shadowbolt', 'mend', 'shade', 'chain-lightning'], fabric: { light: 140, dark: 90 }, affinity: { light: 180, dark: 120 }, mana: 200, level: 14, xp: 20, perks: ['searing-light'], use: { resilience: useFor(40), marksman: useFor(30), athletics: useFor(25), radiance: useFor(45), umbral: useFor(30), storm: useFor(20), chrono: useFor(10) } };

	const server = http.createServer(async (req, res) => {
		try {
			const u = new URL(req.url, 'http://local'), f = path.resolve(root, '.' + decodeURIComponent(u.pathname));
			if (!f.startsWith(root + path.sep)) throw Error('path');
			const ext = path.extname(f);
			res.setHeader('Content-Type', { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' }[ext] || 'application/octet-stream');
			res.end(await fs.readFile(f));
		} catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const base = `http://127.0.0.1:${server.address().port}`;
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
	try {
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		await ctx.addInitScript(([a, m]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('crysis-arms-v1', a); localStorage.setItem('l99-magic', m); sessionStorage.setItem('seeded', '1'); } }, [JSON.stringify(inventory), JSON.stringify(magic)]);
		const page = await ctx.newPage();
		page.setDefaultTimeout(600000);
		page.on('pageerror', (e) => report.errors.push(e.message));
		page.on('console', (m) => { if (/shader failed|Shader Error|program not valid/.test(m.text())) report.errors.push(m.text()); });
		await page.goto(`${base}/island/dev.html`);
		await page.waitForFunction(() => !!window.Crysis?.magic && !!window.L99Island?.world?.()?.player, null, { timeout: 900000, polling: 2000 });
		// (the loading screen waits for you, and holds the keys until then)
		await page.getByRole('button', { name: 'Enter world', exact: true }).click({ timeout: 900000 });
		await page.waitForFunction(() => !window.L99Loading?.active?.(), null, { timeout: 300000, polling: 1000 });
		await page.waitForTimeout(4000);
		// the numbers, as the game has them
		report.info = await page.evaluate(() => { const m = Crysis.magic; m.restat(); return { info: m.info(), sheet: m.stats() }; });
		const S = report.info.sheet;
		assert.ok(S.life > 100, 'Vigour lifts your life');
		assert.ok(S.attrs.vigour.from.some((f) => f.label === 'Aetherweave Coat'));
		assert.equal(S.schools.find((q) => q.id === 'umbral').free, 3, 'the Legendary coat\'s mastery');
		assert.ok(S.magic.length >= 10, 'awakenings across the gear');
		console.log('PASS stats', JSON.stringify({ life: S.life, mana: S.mana, harm: S.harmTaken, attrs: Object.fromEntries(Object.entries(S.attrs).map(([k, v]) => [k, v.total])) }));
		// the Character view, by its key (Shift+I)
		await page.keyboard.press('Shift+KeyI');
		await page.getByText('Spellcraft, as it stands now').waitFor();
		await page.waitForTimeout(1500);
		await page.screenshot({ path: path.join(out, 'laptop-character.png'), timeout: 300000 });
		const sheet = page.locator('[role="dialog"][aria-label="Gear"]');
		await sheet.evaluate((e) => { e.scrollTop = e.scrollHeight; });
		await page.waitForTimeout(800);
		await page.screenshot({ path: path.join(out, 'laptop-character-lower.png'), timeout: 300000 });
		console.log('PASS character view');
		// a worn garment's own view: attunement, attributes, magic, Take off and Infuse
		await sheet.evaluate((e) => { e.scrollTop = 0; });
		await sheet.getByRole('button', { name: /Legendary Aetherweave Coat/ }).first().click();
		await page.getByText('Attuned to Umbral').first().waitFor();
		await page.waitForTimeout(800);
		await page.screenshot({ path: path.join(out, 'laptop-item-coat.png'), timeout: 300000 });
		await sheet.getByRole('button', { name: 'Back', exact: true }).click();
		await page.keyboard.press('Shift+KeyI');
		await page.getByText('Spellcraft, as it stands now').waitFor();
		await sheet.getByRole('button', { name: /Fine Trailstrider Boots/ }).first().click();
		await page.getByText('Attuned to Dawn').first().waitFor();
		const before = await page.evaluate(() => Crysis.magic.state.fabric.light);
		await page.getByRole('button', { name: /Weave light aether fabric/ }).click();
		await page.waitForTimeout(600);
		report.infuse = await page.evaluate(() => ({ light: Crysis.magic.state.fabric.light }));
		assert.equal(report.infuse.light, before - 10, 'ten threads woven in');
		await page.screenshot({ path: path.join(out, 'laptop-item-boots.png'), timeout: 300000 });
		console.log('PASS item view and infuse');
		// (Shift+I from an item opens the Character view; again closes the sheet)
		await page.keyboard.press('Shift+KeyI'); await page.keyboard.press('Shift+KeyI');
		// altered spells in the world: three sparks (the radiance circlet), two shades (the coat)
		report.cast = await page.evaluate(() => {
			const m = Crysis.magic; m.state.mana = 999; m.state.cds = {};
			const a = m.cast('sunspark'), bolts = m.info().bolts; m.state.cds = {};
			const b = m.cast('shade'), shades = m.info().shades;
			return { a, bolts, b, shades };
		});
		assert.deepEqual(report.cast, { a: true, bolts: 3, b: true, shades: 2 });
		console.log('PASS altered spells', JSON.stringify(report.cast));
		await page.waitForTimeout(1500);
		assert.deepEqual(report.errors, []);
		// a phone's width
		await page.setViewportSize({ width: 390, height: 844 });
		await page.keyboard.press('Shift+KeyI');
		await page.getByText('Spellcraft, as it stands now').waitFor();
		await page.waitForTimeout(1500);
		await page.screenshot({ path: path.join(out, 'phone-character.png'), timeout: 300000 });
		assert.ok(await sheet.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'no sideways scroll on a phone');
		console.log('PASS phone width');
		assert.deepEqual(report.errors, []);
		report.passed = true;
	} finally {
		await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
		await browser.close(); server.close();
	}
})().catch((e) => { console.error(e); process.exitCode = 1; });
