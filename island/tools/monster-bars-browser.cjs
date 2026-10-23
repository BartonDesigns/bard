// Tougher monsters with health bars, in the real game: enters the world (as police-monster-
// browser.cjs does), puts a Spore Hexer, two Drain Skulkers and a Signplate Brute ahead and holds
// them still, locks on to the Hexer and hits it, and reads what shows: the target frame at the top
// (name, life with points, mana for the Hexer, Elite for the Brute: combat/target-frame.js) and a
// bar over each monster (combat/nameplates.js), the targeted one wide with its name. Then a Skulker
// is brought down (its bar drains and goes), and the Hexer let go throws a curse, which spends
// its mana. Fails on any page error, crash or second page load.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/monster-bars-browser.cjs
// (LOAD_ONLY=1: the world reached, the monsters there and the frame read; no fight)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/monster-bars', profile = process.env.PROFILE || 'desktop';
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ktx2': 'image/ktx2' };
const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://local');
	const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
	if (!file.startsWith(root)) return res.writeHead(403).end();
	fs.readFile(file, (err, buf) => { if (err) return res.writeHead(404).end(); res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(buf); });
});
const PROFILES = {
	desktop: { viewport: { width: 1280, height: 720 } },
	iphone: (({ defaultBrowserType, ...d }) => d)(devices['iPhone 14']),
	pixel: (({ defaultBrowserType, ...d }) => d)(devices['Pixel 7']),
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
	const ctx = await browser.newContext(PROFILES[profile]);
	const page = await ctx.newPage();
	const problems = [], notes = [];
	let loads = 0;
	page.on('pageerror', (e) => { problems.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
	page.on('crash', () => { problems.push('page crashed'); console.log('CRASH'); });
	page.on('framenavigated', (f) => { if (f === page.mainFrame()) { loads++; if (loads > 1) { problems.push('page reloaded'); console.log('RELOAD', f.url()); } } });
	page.on('console', (m) => { if (m.type() === 'error' && !/texture|GL_INVALID_OPERATION|WebGL: too many errors|Failed to load resource/i.test(m.text())) notes.push(m.text().slice(0, 300)); });
	const shot = async (name) => { try { await page.screenshot({ path: `${out}/${profile}-${name}.png`, timeout: 480000 }); console.log('shot', name); } catch (e) { console.log('no shot', name, e.message.split('\n')[0]); } };
	const t0 = Date.now();
	await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
	await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
	await page.evaluate(() => window.L99IslandDoor.open());
	await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 900000 });
	console.log('enter world shown after', ((Date.now() - t0) / 1000).toFixed(0), 's');
	try {
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 20000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 20000 });
	} catch (e) {
		console.log('pointer enter timed out, clicking in page');
		await page.evaluate(() => document.querySelector('#bard-loading .bl-enter')?.click());
	}
	await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player, null, { timeout: 300000 });
	await wait(4000);
	console.log('in world after', ((Date.now() - t0) / 1000).toFixed(0), 's');
	await page.evaluate(() => { const C = Crysis.combat; C.ambient(false); C.arm(); C.heal(); });
	const keep = setInterval(() => page.evaluate(() => Crysis.combat.heal()).catch(() => {}), 400);
	const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
	const R = { profile };
	// the monsters, ahead, held where they stand (a hold that only the test lifts)
	await page.evaluate(() => { const C = Crysis.combat; C.creature('spore-hexer', 1, 12); C.creature('drain-skulker', 2, 17); C.creature('signplate-brute', 1, 22); });
	await page.waitForFunction(() => {
		const cr = [...Crysis.combat.layer.map.values()].filter((T) => T.ref?.cr);
		for (const T of cr) T.hex = { hold: 1e6, fear: 0, slowK: 1, slowT: 0, dot: 0, dotT: 0 };
		return cr.length >= 4;
	}, null, { timeout: 300000, polling: 500 });
	const ids = await page.evaluate(() => {
		const cr = [...Crysis.combat.layer.map.values()].filter((T) => T.ref?.cr);
		const of = (sp) => cr.filter((T) => T.ref.Sp.name === sp).map((T) => T.id);
		return { hexer: of('Spore Hexer')[0], skulkers: of('Drain Skulker'), brute: of('Signplate Brute')[0], hp: Object.fromEntries(cr.map((T) => [T.ref.Sp.name, Math.round(T.ref.H.max)])) };
	});
	R.ids = ids; console.log('monsters', JSON.stringify(ids));
	// (stood in a spread before you, in view on a phone's narrow screen too: the Hexer ahead, the
	// Skulkers either side behind it, the Brute further off to the right)
	await page.evaluate((ids) => {
		const C = Crysis.combat, e = C.eye(), yaw = L99Island.world().player.state.yaw;
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
		const put = (id, d, s) => { const h = C.layer.get(id)?.ref; if (!h) return; const x = e.x + fx * d + rx * s, z = e.z + fz * d + rz * s; h.pos.set(x, C.ground(x, z, e.y), z); h.yaw = Math.atan2(-fx, -fz); h.cr.root.position.copy(h.pos); h.cr.root.rotation.set(0, h.yaw, 0); };
		put(ids.hexer, 11, 0); put(ids.skulkers[0], 16, -3.5); put(ids.skulkers[1], 16, 3.5); put(ids.brute, 21, 5);
	}, ids);
	await frames(3);
	const read = () => page.evaluate(() => ({ frame: Crysis.combat.frame.info(), plates: Crysis.combat.plates.info(), focus: Crysis.combat.focus.info() }));
	// locked on to the Hexer, and hit twice
	await page.evaluate((id) => { Crysis.combat.aimAt(id); }, ids.hexer);
	await frames(2);
	R.lock = await page.evaluate(() => Crysis.combat.focus.lockOn());
	await frames(3);
	R.hits = [];
	for (let i = 0; i < 2; i++) { await page.evaluate((id) => Crysis.combat.aimAt(id), ids.hexer); R.hits.push(await page.evaluate(() => Crysis.combat.shoot(15))); await frames(1); }
	await frames(2);
	R.locked = await read();
	console.log('locked', JSON.stringify(R.locked));
	await shot('locked-hexer');
	const F = R.locked.frame;
	if (!F.shown) problems.push('no target frame for the locked Hexer');
	else {
		if (F.name !== 'Spore Hexer') problems.push('frame names ' + F.name);
		if (!(F.life > 0 && F.life < 1)) problems.push('frame life ' + F.life);
		if (!/^\d+ \/ 210$/.test(F.lifeText || '')) problems.push('frame life text ' + F.lifeText);
		if (F.mana == null || !/\/ 120$/.test(F.manaText || '')) problems.push('no mana on the Hexer: ' + F.manaText);
		if (F.reaction !== 'hostile') problems.push('Hexer not hostile on the frame');
	}
	const P = R.locked.plates;
	if (P.shown < 3) problems.push(`only ${P.shown} bars over the monsters`);
	if (!P.plates.some((q) => q.wide && q.name === 'Spore Hexer')) problems.push('the Hexer\'s bar is not the wide targeted one');
	if (!P.plates.some((q) => q.elite)) problems.push('the Brute\'s bar is not edged as an elite');
	if (process.env.LOAD_ONLY) { /* (enough) */ } else {
		// the Brute: Elite on the frame (Next round the view until it is the one)
		await page.evaluate((id) => { Crysis.combat.focus.clear(); Crysis.combat.aimAt(id); }, ids.brute);
		await frames(2);
		await page.evaluate(() => Crysis.combat.focus.lockOn());
		for (let i = 0; i < 5 && (await read()).focus.id !== ids.brute; i++) { await page.evaluate(() => Crysis.combat.focus.cycle()); await frames(1); }
		await frames(3);
		R.brute = (await read()).frame;
		console.log('brute', JSON.stringify(R.brute));
		if (R.brute.rank !== 'Elite') problems.push('the Brute is not Elite on the frame: ' + R.brute.rank);
		if (R.brute.armour == null) problems.push('no armour line for the Brute');
		await shot('locked-brute');
		// a Skulker brought down: its bar drains and goes
		const sk = ids.skulkers[0];
		await page.evaluate((id) => { Crysis.combat.focus.clear(); Crysis.combat.aimAt(id); }, sk);
		await frames(2);
		await page.evaluate(() => Crysis.combat.focus.lockOn());
		for (let i = 0; i < 5 && (await read()).focus.id !== sk; i++) { await page.evaluate(() => Crysis.combat.focus.cycle()); await frames(1); }
		R.skulker = [];
		for (let i = 0; i < 12; i++) {
			await page.evaluate((id) => Crysis.combat.aimAt(id), sk);
			const r = await page.evaluate(() => Crysis.combat.shoot(30));
			R.skulker.push(r?.res?.dealt ?? null);
			await frames(1);
			if (r?.res?.killed) { R.skulkerShots = i + 1; break; }
		}
		console.log('skulker down after', R.skulkerShots, 'shots', JSON.stringify(R.skulker));
		if (!R.skulkerShots || R.skulkerShots < 3) problems.push(`a Skulker went down in ${R.skulkerShots} shots of 30`);
		R.fallen = await read();
		await frames(30);
		R.after = await read();
		if (R.after.plates.plates.some((q) => q.id === sk)) problems.push('the fallen Skulker\'s bar is still up');
		// the Hexer let go, ready to throw: a curse spends its mana
		await page.evaluate((id) => { const h = Crysis.combat.layer.get(id)?.ref; if (h) { h.T.hex = null; h.fireT = 0; h.alert = 1; } }, ids.hexer);
		const tM = Date.now();
		R.mana = null;
		while (Date.now() - tM < 600000) {
			await frames(4);
			const m = await page.evaluate((id) => { const h = Crysis.combat.layer.get(id)?.ref; return h ? { mana: Math.round(h.mana), max: h.manaMax, throwing: !!h.throwing, d: Math.round(Math.hypot(h.pos.x - Crysis.combat.eye().x, h.pos.z - Crysis.combat.eye().z)) } : null; }, ids.hexer);
			if (m && m.mana < m.max - 5) { R.mana = m; break; }
			if (!m) break;
		}
		console.log('hexer mana', JSON.stringify(R.mana));
		if (!R.mana) problems.push('the Hexer never spent mana on a throw');
	}
	clearInterval(keep);
	R.loads = loads; R.notes = notes.slice(0, 8);
	console.log('RESULT', JSON.stringify(R, null, 1).slice(0, 4000));
	await browser.close(); server.close();
	if (problems.length) { console.log('FAIL', problems.join('; ')); process.exit(1); }
	console.log('PASS');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
