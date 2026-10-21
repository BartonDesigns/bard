// Spells by where they land, in the real game: enters the world (as combat-game-browser.cjs does),
// puts a squad ahead, then casts a bolt at one fighter's head and another's leg with the view laid
// on each zone; every blow the spells deal is logged with its part. Passes when the head bolt
// lands as 'head' and deals more than the leg bolt, which lands as 'leg'. Fails on any page
// error, crash or second page load.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/spell-zones-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/combat-game', profile = process.env.PROFILE || 'desktop';
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
	const shot = async (name) => { try { await page.screenshot({ path: `${out}/${profile}-${name}.png`, timeout: 240000 }); console.log('shot', name); } catch (e) { console.log('no shot', name, e.message.split('\n')[0]); } };
	const t0 = Date.now();
	await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
	await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
	await page.evaluate(() => window.L99IslandDoor.open());
	await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 600000 });
	console.log('enter world shown after', ((Date.now() - t0) / 1000).toFixed(0), 's');
	if (profile === 'desktop') await page.click('#bard-loading .bl-enter'); else await page.tap('#bard-loading .bl-enter');
	await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player, null, { timeout: 120000 });
	await wait(4000);
	console.log('in world');
	// a rifle in hand and a squad ahead
	await page.evaluate(() => { const C = Crysis.combat; C.ambient(false); C.arm(); C.heal(); });
	await wait(1500);
	const sq = await page.evaluate(() => Crysis.combat.spawn('ashfang', 2, { d: 14 }));
	await page.waitForFunction(() => Crysis.combat.targets().filter((t) => t.kind === 'hostile').length >= 2 && [...Crysis.combat.layer.map.values()].some((T) => T.ref?.body), null, { timeout: 120000 });
	await wait(2500);
	const R = { profile, squad: sq };
	const ids = await page.evaluate(() => [...Crysis.combat.layer.map.values()].filter((T) => T.kind === 'hostile' && T.ref?.body).map((T) => T.id));
	console.log('targets', ids);
	const keep = setInterval(() => page.evaluate(() => Crysis.combat.heal()).catch(() => {}), 400);
	// every blow a spell deals, with where it landed
	await page.evaluate(() => {
		const C = Crysis.combat, d0 = C.deal;
		window._spellBlows = [];
		C.deal = (T, blow, mine) => { const r = d0(T, blow, mine); if (blow.spell) window._spellBlows.push({ id: T.id, part: blow.part, amount: +blow.amount.toFixed(1), dealt: +(r?.dealt || 0).toFixed(1) }); return r; };
		Crysis.magic.test(true);
	});
	const castAt = async (id, part, spell) => {
		const n0 = await page.evaluate(({ id, part, spell }) => {
			const T = Crysis.combat.layer.get(id); if (!T) return -1;
			const s = T.shapes().filter((q) => q.part === part)[0]; if (!s) return -2;
			const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2, z: (s.a.z + s.b.z) / 2 };
			const c = window.L99Island.camera(), p = window.L99Island.world().player.state;
			const dx = m.x - c.position.x, dy = m.y - c.position.y, dz = m.z - c.position.z;
			p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
			c.rotation.set(p.pitch, p.yaw, 0, 'YXZ'); c.updateMatrixWorld();
			const n = window._spellBlows.length;
			window._cast = Crysis.magic.cast(spell, { tap: true });
			return n;
		}, { id, part, spell });
		if (n0 < 0) return { none: part, why: n0 };
		const t = Date.now();
		while (Date.now() - t < 600000) {
			const got = await page.evaluate((n0) => ({ cast: window._cast, blows: window._spellBlows.slice(n0) }), n0);
			if (got.blows.length) return got;
			await wait(1000);
		}
		return { timeout: part };
	};
	R.head = await castAt(ids[0], 'head', 'shadowbolt');
	console.log('head', JSON.stringify(R.head));
	await wait(1500);
	R.leg = await castAt(ids[1], 'leg', 'shadowbolt');
	console.log('leg', JSON.stringify(R.leg));
	clearInterval(keep);
	await wait(3000);
	R.loads = loads;
	const h = R.head?.blows?.[0], l = R.leg?.blows?.[0];
	if (!h || h.part !== 'head') problems.push('head bolt landed as ' + (h?.part || 'nothing'));
	if (!l || l.part !== 'leg') problems.push('leg bolt landed as ' + (l?.part || 'nothing'));
	if (h && l && !(h.dealt > l.dealt)) problems.push(`head ${h.dealt} not above leg ${l.dealt}`);
	console.log('RESULT', JSON.stringify(R, null, 1));
	await browser.close(); server.close();
	if (problems.length) { console.log('FAIL', problems.join('; ')); process.exit(1); }
	console.log('PASS');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
