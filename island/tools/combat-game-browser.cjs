// The lock-on and hit zones in the real game: enters the world from the front page (as a player
// does), arms a rifle and puts a squad ahead, then: ` locks on and the view tracks the chest;
// a nudge of the aim holds on the body; a round to the head drops them; rounds to a leg slow then
// cripple; each hit plays a reaction. On a phone profile, a tap on a person locks on. Fails on any
// page error, crash or second page load.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/combat-game-browser.cjs
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
	// face the first (as aimAt does) and keep the player alive through it
	const keep = setInterval(() => page.evaluate(() => Crysis.combat.heal()).catch(() => {}), 400);
	await page.evaluate((id) => Crysis.combat.aimAt(id), ids[0]);
	await wait(300);
	if (profile === 'desktop') {
		await page.keyboard.press('Backquote');
	} else {
		// a tap on their chest, on the screen. Headless, a phone this size draws a frame in seconds,
		// so they can run on a long way between the look and the tap landing: if the real tap
		// misses, the same tap is sent from the page itself in one go (the logic, not the timing)
		const spot = (id) => page.evaluate((id) => {
			const T = Crysis.combat.layer.get(id), c = window.L99Island.camera(), q = T.aim?.() || T.bound;
			c.updateMatrixWorld(); const v = c.position.clone().set(q.x, q.y, q.z).project(c);
			const r = document.querySelector('canvas').getBoundingClientRect();
			return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
		}, id);
		const at = await spot(ids[0]);
		R.tapAt = at;
		R.tapEl = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && `${e.tagName}.${e.className} ${e.clientWidth}x${e.clientHeight}`; }, at);
		await page.touchscreen.tap(at.x, at.y);
		await wait(800);
		R.taps = [await page.evaluate(() => Crysis.combat.focus.info().tap)];
		if (R.taps[0] !== 'locked') {
			R.taps.push(await page.evaluate((id) => {
				const T = Crysis.combat.layer.get(id), c = window.L99Island.camera(), q = T.aim?.() || T.bound, cv = document.querySelector('canvas');
				c.updateMatrixWorld(); const v = c.position.clone().set(q.x, q.y, q.z).project(c), r = cv.getBoundingClientRect();
				const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height;
				const ev = (t) => new PointerEvent(t, { pointerType: 'touch', pointerId: 77, clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true });
				cv.dispatchEvent(ev('pointerdown')); cv.dispatchEvent(ev('pointerup'));
				return Crysis.combat.focus.info().tap + ' (in-page)';
			}, ids[0]));
		}
	}
	await wait(1500);
	R.lock = await page.evaluate(() => { const i = Crysis.combat.focus.info(); return { target: i.target?.id || i.id || null, cameraAssist: i.cameraAssist, tracking: Crysis.combat.focus.tracking?.(), tap: i.tap }; });
	// how close the view sits to their chest, after they have moved for a while
	const err = () => page.evaluate((id) => {
		const T = Crysis.combat.layer.get(id), c = window.L99Island.camera(), q = T.aim?.() || T.bound;
		const d = c.getWorldDirection(c.position.clone()), to = c.position.clone().set(q.x, q.y, q.z).sub(c.position);
		const dist = to.length(); to.normalize();
		return { deg: +(Math.acos(Math.min(1, d.dot(to))) * 180 / Math.PI).toFixed(2), dist: +dist.toFixed(1) };
	}, ids[0]);
	R.trackErr = await err();
	await shot('locked');
	// fine-tune: nudge the aim up toward the head; it holds there
	const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
	await frames(3);
	R.before = await page.evaluate(() => Crysis.combat.focus.info().offset);
	await page.evaluate(() => { const p = window.L99Island.world().player.state; p.pitch += 0.015; });
	await frames(4);
	R.nudged = await page.evaluate(() => Crysis.combat.focus.info().offset);
	// release
	if (profile === 'desktop') await page.keyboard.press('Backquote'); else await page.evaluate(() => Crysis.combat.focus.lockOn?.() ?? Crysis.combat.focus.toggle?.());
	await wait(300);
	R.released = await page.evaluate(() => !Crysis.combat.focus.info().cameraAssist);
	if (profile === 'desktop') {
		// the sights: a quick right click (a trackpad's two-finger click) puts them up and they stay
		// up with the button let go; the next right click takes them down (held works as ever)
		const click = (button, hold) => page.evaluate(async ({ button, hold }) => {
			const c = window.L99Island.renderer().domElement;
			Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => c });
			const ev = (t) => new PointerEvent(t, { button, buttons: t === 'pointerdown' ? (button === 2 ? 2 : 1) : 0, pointerType: 'mouse', bubbles: true, cancelable: true });
			c.dispatchEvent(ev('pointerdown')); await new Promise((r) => setTimeout(r, hold)); c.dispatchEvent(ev('pointerup'));
		}, { button, hold });
		const ads = () => page.evaluate(() => Crysis.viewmodel({}).ads);
		await click(2, 120); await frames(6); R.scopeUp = await ads();
		await wait(1500); await frames(3); R.scopeStays = await ads();
		await click(2, 120); await frames(8); R.scopeDown = await ads();
		await click(2, 900); R.scopeHeld = await ads(); await frames(6); R.scopeAfterHold = await ads();
	}
	// rounds to a zone: the view laid on the zone's middle, a shot from the eye
	const fire = (id, part, dmg, side) => page.evaluate(({ id, part, dmg, side }) => {
		const T = Crysis.combat.layer.get(id); if (!T) return null;
		const s = T.shapes().filter((q) => q.part === part && (!side || q.side === side))[0]; if (!s) return { none: part };
		const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2, z: (s.a.z + s.b.z) / 2 };
		const c = window.L99Island.camera(), p = window.L99Island.world().player.state;
		const dx = m.x - c.position.x, dy = m.y - c.position.y, dz = m.z - c.position.z;
		p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
		c.rotation.set(p.pitch, p.yaw, 0, 'YXZ'); c.updateMatrixWorld();
		const r = Crysis.combat.shoot(dmg), h = T.ref;
		if (r?.res) r.res.downed = h.H?.state === 'down';
		return { ...r, react: h.react ? { name: h.body?.M?.S?.act?.name } : null, crippled: h.W?.crippled || null, legs: h.W && { L: +h.W.legs.L.toFixed(2), R: +h.W.legs.R.toFixed(2) }, hp: Math.round(h.H?.hp ?? -1), dead: !!h.dead, clutch: !!h.body?.M?.S?.clutch };
	}, { id, part, dmg, side });
	R.shoulder = await fire(ids[1], 'shoulder', 8, 'R');
	await wait(350); await shot('shoulder-hit');
	await wait(1500);
	R.leg = [];
	for (let i = 0; i < 6; i++) { const r = await fire(ids[1], 'leg', 14, 'L'); R.leg.push(r); if (r?.crippled || r?.dead) break; await wait(900); }
	await wait(1200); await shot('crippled');
	R.head = await fire(ids[0], 'head', 30);
	await wait(800); await shot('headshot');
	clearInterval(keep);
	R.gl = await page.evaluate(() => { const gl = window.L99Island.renderer().getContext(); return { lost: gl.isContextLost() }; });
	// a while longer in the world
	await wait(profile === 'desktop' ? 5000 : 20000);
	R.loads = loads; R.notes = notes.slice(0, 8);
	console.log('RESULT', JSON.stringify(R, null, 1));
	const ok = (c, m) => { if (!c) problems.push(m); };
	ok(R.lock.cameraAssist, 'the lock-on did not take the view');
	ok(R.trackErr.deg < 3, 'the view is off their chest by ' + R.trackErr.deg + ' degrees');
	ok(R.released, 'the lock did not let go');
	if (profile === 'desktop') ok(R.scopeUp > 0.5 && R.scopeStays > 0.5 && R.scopeDown < 0.5 && R.scopeAfterHold < 0.5, 'a quick right click did not keep the sights up (or the next did not take them down)');
	ok(R.head?.part === 'head' && (R.head.res?.killed || R.head.dead || R.head.hp <= 0), 'a round to the head did not drop them');
	ok(R.leg.some((r) => r?.crippled), 'rounds to the leg did not cripple');
	ok(['shoulder', 'arm'].includes(R.shoulder?.part) && R.shoulder.react?.name?.startsWith('hurt-'), 'the shoulder hit did not react');
	ok(R.nudged && R.before && R.nudged.pitch - R.before.pitch > 0.01, 'the nudge up did not hold on the body');
	console.log(problems.length ? 'FAIL ' + problems.join(' | ') : 'PASS');
	await browser.close(); server.close();
	process.exitCode = problems.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
