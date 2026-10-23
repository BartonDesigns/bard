// A creature knocked down and killed, in the real game: enters the world (as
// combat-game-browser.cjs does), puts a Ridge Hound ahead, hits it with a blast that takes
// half its life (combat/ai-squads.js knockDown: it goes limp, people/ragdoll.js, and gets up
// again), then kills it, and watches its head drop with the ragdoll instead of the stiff fold.
// Fails on any page error, crash or second page load, on a hound that never went down or never
// got up, or on a dead one whose body did not fall.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/creature-ragdoll-browser.cjs
// (FRAMES=n: how many frames to give each stage; a headless desktop frame takes half a minute)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/creature-ragdoll', profile = process.env.PROFILE || 'desktop';
const FRAMES = +(process.env.FRAMES || (profile === 'desktop' ? 14 : 40));
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
	const shot = async (name) => { try { await page.evaluate(() => window.__hound && Crysis.combat.aimAt(window.__hound.id)); await page.screenshot({ path: `${out}/${profile}-${name}.png`, timeout: 240000 }); console.log('shot', name); } catch (e) { console.log('no shot', name, e.message.split('\n')[0]); } };
	const t0 = Date.now();
	await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
	await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
	await page.evaluate(() => window.L99IslandDoor.open());
	await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 600000 });
	console.log('enter world shown after', ((Date.now() - t0) / 1000).toFixed(0), 's');
	try {
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 20000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 20000 });
	} catch (e) {
		console.log('pointer enter timed out, clicking in page');
		await page.evaluate(() => document.querySelector('#bard-loading .bl-enter')?.click());
	}
	await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player, null, { timeout: 120000 });
	await wait(4000);
	console.log('in world after', ((Date.now() - t0) / 1000).toFixed(0), 's');
	await page.evaluate(() => { const C = Crysis.combat; C.ambient(false); C.arm(); C.heal(); });
	const keep = setInterval(() => page.evaluate(() => Crysis.combat.heal()).catch(() => {}), 400);
	const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
	const R = { profile, frames: FRAMES };
	R.squad = await page.evaluate(() => Crysis.combat.creature('ridge-hound', 1, 12));
	await page.waitForFunction(() => [...Crysis.combat.layer.map.values()].some((T) => T.faction === 'nightborn' && T.ref?.cr), null, { timeout: 180000 });
	// the hound: its life, its head's height (its head hit zone's top end), whether it is down
	const look = () => page.evaluate(() => {
		const T = [...Crysis.combat.layer.map.values()].find((q) => q.faction === 'nightborn' && q.ref?.cr) || window.__hound;
		if (!T) return null;
		window.__hound = T;
		const h = T.ref, head = h.cr.shapes().find((s) => s.bone === 'head'), hips = h.cr.shapes().find((s) => s.bone === 'hips');
		const rag = Crysis.ragdolls();
		return { id: T.id, hp: Math.round(h.H.hp), dead: !!h.dead, down: !!h.down, downT: +(h.downT || 0).toFixed(1), pos: [h.pos.x, h.pos.y, h.pos.z].map((v) => +v.toFixed(2)), yaw: +h.yaw.toFixed(2), head: head && +(head.a.y - h.pos.y).toFixed(2), hips: hips && +(hips.a.y - h.pos.y).toFixed(2), limp: !!h.cr.rag?.ragdoll, rested: !!h.cr.rag?.rested, rag: { live: rag?.live, rigs: rag?.rigs, pieces: rag?.pieces, err: rag?.err, ready: rag?.ready } };
	});
	// a blow on it: from 3 m to its left, along +x, where its chest is
	const blow = (amount, type) => page.evaluate(([amount, type]) => {
		const T = window.__hound, h = T.ref, chest = h.cr.shapes().find((s) => s.bone === 'chest');
		const at = chest ? { x: (chest.a.x + chest.b.x) / 2, y: (chest.a.y + chest.b.y) / 2, z: (chest.a.z + chest.b.z) / 2 } : { x: h.pos.x, y: h.pos.y + 0.6, z: h.pos.z };
		return T.onHit({ amount, type, part: 'torso', src: { x: at.x - 3, y: at.y, z: at.z }, at, dir: { x: 1, y: 0, z: 0 } });
	}, [amount, type]);
	await frames(3);
	R.before = await look();
	console.log('before', JSON.stringify(R.before));
	// 1. knocked down by a blast that takes half its life, and up again
	R.knock = await blow(55, 'blast');
	await frames(1);
	R.down = await look();
	console.log('down', JSON.stringify(R.down));
	R.rise = null;
	for (let i = 0; i < FRAMES * 2 && !R.rise; i++) {
		await frames(2);
		const q = await look();
		if (i % 5 === 0) console.log('  ', i, JSON.stringify({ down: q.down, limp: q.limp, rested: q.rested, head: q.head, hips: q.hips, rag: q.rag }));
		if (!q.down) R.rise = q;
	}
	console.log('rise', JSON.stringify(R.rise));
	await shot('after-knockdown');
	// 2. killed: it goes limp and its head drops
	R.kill = await blow(2000, 'ballistic');
	await frames(1);
	R.dead0 = await look();
	console.log('dead0', JSON.stringify(R.dead0));
	await frames(FRAMES);
	R.dead1 = await look();
	console.log('dead1', JSON.stringify(R.dead1));
	await shot('dead');
	clearInterval(keep);
	R.loads = loads; R.notes = notes.slice(0, 8);
	if (!R.before) problems.push('no hound');
	else {
		if (!R.down?.down) problems.push('the blast did not knock the hound down: ' + JSON.stringify(R.down));
		else if (!R.down.limp) problems.push('down but not limp: ' + JSON.stringify(R.down));
		if (!R.rise) problems.push('the hound never got up');
		else if (R.rise.dead) problems.push('the hound died of the knockdown');
		if (!R.dead1?.dead) problems.push('the hound did not die: ' + JSON.stringify(R.dead1));
		else {
			if (!R.dead0.limp) problems.push('dead but not limp: ' + JSON.stringify(R.dead0));
			if (!(R.dead1.head < R.before.head - 0.25)) problems.push(`the dead hound's head did not drop: ${R.before.head} -> ${R.dead1.head}`);
			if (R.dead1.rag?.err) problems.push('ragdoll error: ' + R.dead1.rag.err);
		}
	}
	console.log('RESULT', JSON.stringify(R, null, 1));
	await browser.close(); server.close();
	if (problems.length) { console.log('FAIL', problems.join('; ')); process.exit(1); }
	console.log('PASS');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
