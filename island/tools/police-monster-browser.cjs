// The law before a monster, in the real game: enters the world (as combat-game-browser.cjs does),
// posts two officers at a scene (searching, not alert, as a cruiser's crew after a call) and puts
// a Moonturned near them. While it is still a villager to look at they leave it be; once a round
// turns it, the officers go for the beast (combat/ai-squads.js chooseTarget) and it is hit by
// them. Fails on any page error, crash or second page load.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/police-monster-browser.cjs
// (LOAD_ONLY=1: the world reached and the scene set, nothing more: a headless desktop frame takes
// half a minute, so the fight itself is for the phone profiles)
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
	// the page can be mid-frame for a while here (frames run long under SwiftShader), so a
	// pointer tap that cannot settle falls back to clicking the button from inside the page
	try {
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 20000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 20000 });
	} catch (e) {
		console.log('pointer enter timed out, clicking in page');
		await page.evaluate(() => document.querySelector('#bard-loading .bl-enter')?.click());
	}
	await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player, null, { timeout: 120000 });
	await wait(4000);
	console.log('in world');
	await page.evaluate(() => { const C = Crysis.combat; C.ambient(false); C.arm(); C.heal(); });
	const keep = setInterval(() => page.evaluate(() => Crysis.combat.heal()).catch(() => {}), 400);
	const R = { profile };
	// two officers posted at a scene 18 m ahead, searching round it (a cruiser's crew after a
	// call), and the Moonturned 12 m past them
	R.police = await page.evaluate(() => Crysis.combat.spawn('police', 2, { d: 18, alert: false }));
	await page.waitForFunction(() => [...Crysis.combat.layer.map.values()].filter((T) => T.faction === 'police' && T.ref?.body).length >= 2, null, { timeout: 180000 });
	await page.evaluate(() => {
		for (const T of Crysis.combat.layer.map.values()) if (T.faction === 'police' && T.ref) { const h = T.ref, x = h.pos.x, z = h.pos.z; h.alert = 0; h.target = null; h.post = { kind: 'scene', x, z, r: 80, loop: [[x - 6, z - 6], [x + 6, z - 6], [x + 6, z + 6], [x - 6, z + 6]] }; }
	});
	R.creature = await page.evaluate(() => Crysis.combat.creature('moonturned', 1, 30));
	await page.waitForFunction(() => [...Crysis.combat.layer.map.values()].some((T) => T.faction === 'nightborn' && T.ref?.cr), null, { timeout: 180000 });
	const look = () => page.evaluate(() => {
		const all = [...Crysis.combat.layer.map.values()];
		const M = all.find((T) => T.faction === 'nightborn' && T.ref?.cr), cops = all.filter((T) => T.faction === 'police' && T.ref);
		return { beast: M && { id: M.id, turn: +M.ref.turn.toFixed(2), human: M.ref.turn < 0, turning: !!M.ref.beast, hp: Math.round(M.ref.H.hp), dead: !!M.ref.dead }, cops: cops.map((T) => ({ id: T.id, alert: T.ref.alert, target: T.ref.target?.id || null, los: !!T.ref.los, d: +Math.hypot(T.ref.pos.x - (M?.ref.pos.x ?? 0), T.ref.pos.z - (M?.ref.pos.z ?? 0)).toFixed(1), dead: !!T.ref.dead })) };
	});
	const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
	// a villager, to look at: the officers leave them be
	await frames(3);
	R.before = await look();
	console.log('before', JSON.stringify(R.before));
	// a round turns them (combat/ai-squads.js hit: a hurt Moonturned changes), and then the law goes for the beast
	await page.evaluate((id) => { Crysis.combat.aimAt(id); }, R.before.beast?.id);
	await frames(2);
	R.shot = await page.evaluate(() => Crysis.combat.shoot(5));
	console.log('shot', JSON.stringify(R.shot));
	R.turned = null; R.engaged = null; R.timeline = [];
	const tW = Date.now();
	while (!process.env.LOAD_ONLY && Date.now() - tW < 900000) {
		await frames(3);
		const q = await look();
		R.timeline.push({ t: Math.round((Date.now() - tW) / 1000), turn: q.beast?.turn, hp: q.beast?.hp, targets: q.cops.map((c) => c.target), alert: q.cops.map((c) => c.alert) });
		if (!R.turned && q.beast && !q.beast.turning) { R.turned = q; console.log('turned', JSON.stringify(q)); }
		if (R.turned && q.cops.some((c) => c.target === q.beast.id) && q.beast.hp < R.turned.beast.hp) { R.engaged = q; console.log('engaged', JSON.stringify(q)); break; }
		if (q.beast?.dead || q.cops.every((c) => c.dead)) break;
	}
	clearInterval(keep);
	await shot('police-monster');
	R.loads = loads; R.notes = notes.slice(0, 8);
	if (R.before.beast?.human && R.before.cops.some((c) => c.target === R.before.beast?.id)) problems.push('the officers went for a villager who had not turned');
	if (process.env.LOAD_ONLY) { /* (the world reached, the scene set: enough) */ }
	else if (!R.turned) problems.push('the Moonturned never turned');
	else if (!R.engaged) problems.push('the officers never shot the beast: ' + JSON.stringify(R.timeline.slice(-4)));
	console.log('RESULT', JSON.stringify({ ...R, timeline: R.timeline.length }, null, 1));
	await browser.close(); server.close();
	if (problems.length) { console.log('FAIL', problems.join('; ')); process.exit(1); }
	console.log('PASS');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
