// Your guild in the real game: enters the world from the front page (as a player does), founds
// a guild, brings three townsfolk into it, waits for them at your back, puts raiders ahead and
// watches them fight beside you (their spells counted as they are drawn), levels one up, then
// opens the guild panel on its tabs. Fails on any page error, crash or second page load.
//   PROFILE=desktop|iphone|pixel OUT=dir node tools/guild-game-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/guild-game', profile = process.env.PROFILE || 'iphone';
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
	page.on('console', (m) => { if (m.type() === 'error' && !/texture|GL_INVALID_OPERATION|WebGL: too many errors|Failed to load resource|rooms|workers\.dev|ERR_/i.test(m.text())) notes.push(m.text().slice(0, 300)); });
	const shot = async (name) => { try { await page.screenshot({ path: `${out}/${profile}-${name}.png`, timeout: 600000 }); console.log('shot', name); } catch (e) { console.log('no shot', name, e.message.split('\n')[0]); } };
	const R = { profile };
	try {
		const t0 = Date.now();
		await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
		await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
		await page.evaluate(() => window.L99IslandDoor.open());
		await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 900000 });
		console.log('enter world shown after', ((Date.now() - t0) / 1000).toFixed(0), 's');
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 600000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 600000 });
		await page.waitForFunction(() => window.Crysis?.guild && window.L99Island?.world?.()?.player, null, { timeout: 300000 });
		await wait(4000);
		console.log('in world');
		await page.evaluate(() => { const C = Crysis.combat; C.ambient(false); C.clear(); C.heal(); });
		const keep = setInterval(() => page.evaluate(() => Crysis.combat.heal()).catch(() => {}), 1500);
		// a guild, and three of the townsfolk in it
		R.found = await page.evaluate(async () => { const g = await Crysis.guild.found({ name: 'The Bay Bards', tag: 'BB' }); return { name: g.name, tag: g.tag }; });
		R.near = await page.evaluate(() => Crysis.guild.candidates().map((c) => c.name));
		// (someone near asked, with the dice loaded: the yes and what follows it are what is checked)
		R.asked = await page.evaluate(() => { const c = Crysis.guild.candidates()[0]; if (!c) return null; const r0 = Math.random; Math.random = () => 0; try { const r = Crysis.guild.ask(c.p); return { ok: r.ok, text: r.text, gone: c.p.leaving === true }; } finally { Math.random = r0; } });
		R.ids = await page.evaluate(() => [Crysis.guild.test.add({ name: 'Ana Ruiz', job: 'a geology professor', seed: 4242 }), Crysis.guild.test.add({ name: 'Sam Okafor', job: 'a paramedic', seed: 777 }), Crysis.guild.test.add({ name: 'Lee Park', job: 'a carpenter', seed: 9001 })]);
		R.max = await page.evaluate(() => Crysis.guild.companions.max);
		await page.waitForFunction((n) => Crysis.guild.info().out.length >= n, Math.min(2, R.max), { timeout: 900000, polling: 2000 });
		await wait(3000);
		R.out = await page.evaluate(() => Crysis.guild.info().out);
		console.log('out', JSON.stringify(R.out));
		await shot('following');
		// raiders ahead: who fights whom, and their spells as they go
		await page.evaluate(() => { window.__casts = []; const H = Crysis.combat.hooks, f = H.remoteSpell; H.remoteSpell = (a, b, p, who) => { if (String(who).startsWith('guild:')) window.__casts.push(who); return f?.(a, b, p, who); }; });
		R.fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / 3).toFixed(1)); }; requestAnimationFrame(f); }));
		console.log('fps', R.fps);
		R.squad = await page.evaluate(() => Crysis.combat.spawn('ashfang', 2, { d: 22, alert: true }));
		const tFight = Date.now();
		let fight = null;
		while (Date.now() - tFight < (process.env.WATCH_MS ? +process.env.WATCH_MS : 600000)) {
			await wait(5000);
			fight = await page.evaluate(() => ({ foes: Crysis.combat.info?.().squads?.squads?.filter((s) => s.faction === 'ashfang').map((s) => ({ n: s.n, targets: s.targets })), allies: Crysis.combat.squads.allies().map((h) => ({ name: h.ally.name, target: h.target?.faction || h.target?.name || null, los: h.los, hp: Math.round(h.H.hp) })), foeHp: Crysis.combat.squads.list.filter((h) => h.fid === 'ashfang' && !h.dead).map((h) => Math.round(h.H.hp)), casts: window.__casts.length, npcs: Crysis.guild.info().guild.npcs.map((m) => ({ name: m.name, level: m.level, xp: m.xp, kills: m.kills })) }));
			console.log('fight', JSON.stringify(fight));
			if (fight.allies.some((a) => a.target)) R.engaged = true;
			if (R.engaged && !R.fightShot) { R.fightShot = true; await shot('fighting'); }
			if (!fight.foes?.length || fight.foes.every((f) => f.n === 0)) break;
		}
		R.fight = fight;
		// (headless frames are far too slow to see a fight through, so it runs on without drawing:
		// the game's own combat and guild steps, a twentieth of a second at a time)
		R.stepped = [];
		for (let k = 0; k < 12; k++) {
			const s = await page.evaluate(() => {
				for (let t = 0; t < 10; t += 0.05) { Crysis.combat.update(0.05); Crysis.guild.update(0.05); Crysis.combat.heal(); }
				return { foeHp: Crysis.combat.squads.list.filter((h) => h.fid === 'ashfang' && !h.dead).map((h) => Math.round(h.H.hp)), allies: Crysis.combat.squads.allies().map((h) => ({ name: h.ally.name, hp: Math.round(h.H.hp), target: !!h.target })), casts: window.__casts.length, npcs: Crysis.guild.info().guild.npcs.map((m) => ({ name: m.name, level: m.level, xp: m.xp, kills: m.kills })) };
			});
			console.log('stepped', JSON.stringify(s));
			R.stepped.push(s);
			if (!s.foeHp.length) break;
		}
		R.casts = await page.evaluate(() => window.__casts.length);
		// a level or two, and the spells that come with it
		R.levelled = await page.evaluate((id) => Crysis.guild.test.xp(id, 2000), R.ids[2]);
		await page.evaluate(() => Crysis.guild.open('folk'));
		await wait(2500);
		await shot('panel-townsfolk');
		await page.evaluate(() => document.querySelectorAll('.gld-tab')[0].click());
		await wait(2000);
		await shot('panel-guild');
		await page.evaluate(() => document.querySelectorAll('.gld-tab')[3].click());
		await wait(2000);
		await shot('panel-alliances');
		R.panel = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.gld-tab')].map((b) => b.textContent), card: (() => { const r = document.querySelector('.gld-card').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(), win: [innerWidth, innerHeight] }));
		R.menu = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent).filter((t) => t.startsWith('⚑')));
		clearInterval(keep);
		R.info = await page.evaluate(() => Crysis.guild.info());
	} catch (e) { problems.push('check: ' + e.message.split('\n')[0]); }
	R.problems = problems; R.notes = notes.slice(0, 12);
	fs.writeFileSync(`${out}/${profile}-result.json`, JSON.stringify(R, null, 2));
	console.log(JSON.stringify(R, null, 2));
	await browser.close(); server.close();
	process.exit(problems.length ? 1 : 0);
})();
