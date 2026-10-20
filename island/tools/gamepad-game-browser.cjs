// A game controller in the real game: enters the world from the front page (A presses Enter
// world), then a pretend Xbox pad walks forward on the left stick, turns on the right, jumps
// on A, opens the controller menu on Start and the skills menu from it, backs out with B, takes
// a rifle and fires it on RT, puts the sights up on LT. Fails on any page error, crash or
// second page load.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/gamepad-game-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/gamepad-game', profile = process.env.PROFILE || 'iphone';
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.svg': 'image/svg+xml', '.css': 'text/css', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
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
	// the pad, there from the first moment, as one already awake when the page opens
	await ctx.addInitScript(() => {
		window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard', buttons: [...Array(18)].map(() => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], timestamp: 0 };
		navigator.getGamepads = () => [window.__pad];
		window.__set = (i, on) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; };
	});
	const page = await ctx.newPage();
	const problems = [];
	let loads = 0;
	page.on('pageerror', (e) => { problems.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
	page.on('crash', () => { problems.push('page crashed'); console.log('CRASH'); });
	page.on('framenavigated', (f) => { if (f === page.mainFrame()) { loads++; if (loads > 1) { problems.push('page reloaded'); console.log('RELOAD', f.url()); } } });
	const shot = async (name) => { try { await page.screenshot({ path: `${out}/${profile}-${name}.png`, timeout: 300000 }); console.log('shot', name); } catch (e) { console.log('no shot', name, e.message.split('\n')[0]); } };
	// (frames are slow and bursty headless: a press is held for a few of them)
	const frames = (n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
	const press = async (i, n = 3) => { await page.evaluate((b) => __set(b, true), i); await frames(n); await page.evaluate((b) => __set(b, false), i); await frames(n); };
	const info = () => page.evaluate(() => Crysis.gamepad?.info?.());
	const t0 = Date.now();
	await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
	await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
	await page.evaluate(() => window.L99IslandDoor.open());
	await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 900000 });
	console.log('enter world shown after', ((Date.now() - t0) / 1000).toFixed(0), 's');
	await page.waitForFunction(() => window.Crysis?.gamepad, null, { timeout: 120000 });
	// A on Enter world (the ring is on it: the only button on the loading screen)
	const ring = await page.evaluate(async () => { for (let i = 0; i < 40 && !Crysis.gamepad.info().focus; i++) await new Promise((r) => requestAnimationFrame(r)); return Crysis.gamepad.info(); });
	console.log('loading screen:', JSON.stringify(ring));
	await press(0);
	try { await page.waitForFunction(() => window.L99Island?.world?.()?.player?.state?.active, null, { timeout: 120000 }); console.log('A entered the world'); }
	catch { console.log('A did not enter; tapping'); if (profile === 'desktop') await page.click('#bard-loading .bl-enter'); else await page.tap('#bard-loading .bl-enter'); await page.waitForFunction(() => window.L99Island?.world?.()?.player?.state?.active, null, { timeout: 120000 }); problems.push('A did not press Enter world: ' + JSON.stringify(ring)); }
	await wait(4000);
	await frames(4);
	const R = { profile };
	R.mode = (await info()).mode;
	// the left stick, forward: you walk
	const p0 = await page.evaluate(() => { const p = Crysis.world().player.state.pos; return { x: p.x, z: p.z, yaw: Crysis.world().player.state.yaw }; });
	await page.evaluate(() => { __pad.axes = [0, -1, 0.9, 0]; });
	await frames(12);
	await page.evaluate(() => { __pad.axes = [0, 0, 0, 0]; });
	await frames(2);
	const p1 = await page.evaluate(() => { const p = Crysis.world().player.state.pos; return { x: p.x, z: p.z, yaw: Crysis.world().player.state.yaw }; });
	R.walked = +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2); R.turned = +(p0.yaw - p1.yaw).toFixed(3);
	console.log('walked', R.walked, 'm, turned', R.turned);
	// Start: the controller menu; A: its first tile, the skills menu; B: out of it again
	await press(9);
	R.menu = (await info()).menu;
	await frames(3);
	await shot('menu');
	await press(0, 4);
	await page.waitForFunction(() => !!document.querySelector('[aria-label="Skills and magic"][data-pad="keys"]')?.checkVisibility?.(), null, { timeout: 60000 }).catch(() => {});
	R.skills = await page.evaluate(() => !!document.querySelector('[aria-label="Skills and magic"][data-pad="keys"]')?.checkVisibility?.());
	await press(15, 4);
	await shot('skills');
	await press(1, 4);
	await frames(4);
	R.skillsClosed = await page.evaluate(() => !document.querySelector('[aria-label="Skills and magic"]')?.checkVisibility?.());
	R.backToGame = (await info()).mode;
	// a rifle: RT fires, LT puts the sights up
	await page.evaluate(() => { const C = Crysis.combat; C.ambient(false); C.arm(); C.heal(); });
	await wait(2500); await frames(6);
	const shots0 = await page.evaluate(() => Crysis.combat.info().weapon?.shots ?? 0);
	await page.evaluate(() => __set(7, true)); await frames(8); await page.evaluate(() => __set(7, false)); await frames(3);
	R.fired = (await page.evaluate(() => Crysis.combat.info().weapon?.shots ?? 0)) - shots0;
	await page.evaluate(() => __set(6, true)); await frames(14);
	R.aiming = await page.evaluate(() => Crysis.gear()?.viewmodel?.aimTap ?? Crysis.gear()?.viewmodel?.aiming ?? null);
	await shot('aiming');
	await page.evaluate(() => __set(6, false)); await frames(3);
	R.problems = problems;
	console.log(JSON.stringify(R));
	fs.writeFileSync(`${out}/${profile}-result.json`, JSON.stringify(R, null, 1));
	try {
		assert.equal(R.mode, 'game');
		assert.ok(R.walked > 0.5, 'walked on the stick');
		assert.ok(R.turned > 0.02, 'turned on the right stick');
		assert.equal(R.menu, true, 'Start opened the menu');
		assert.equal(R.skills, true, 'the tile opened skills');
		assert.equal(R.skillsClosed, true, 'B closed skills');
		assert.ok(R.fired > 0, 'RT fired');
		assert.deepEqual(problems, []);
		console.log('PASS', profile);
	} finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; server.close(); });
