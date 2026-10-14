// The services in the real game: enters the world, goes to a town, lets its hospital, police
// and fire stations and armory be sited, walks into each, and saves pictures of their rooms
// drawn from inside the page (a page screenshot times out on a software renderer).
//   GOTO=37.7799,-121.978 node island/tools/services-browser.cjs [outdir]
// Needs a built island/dist/island.js. Prints Crysis.services() and the errors seen.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const OUT = process.argv[2] || '/tmp/services-shots';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
// [file, kind, room or null (outside), look]
const SHOTS = (process.env.SHOTS || 'hospital:erBays,hospital:triage,hospital:theatre,hospital:ward,police:frontDesk,police:cells,police:sallyport,fire:apparatus,fire:dayRoom,armory:warRoom,armory:depot,armory:barracks,hospital:,fire:,police:').split(',').map((s) => s.split(':'));

// a few frames drawn with the camera where the player now stands (a software renderer is slow)
async function settle(page, frames = 4) {
	const f0 = await page.evaluate(() => window.L99Island.renderer().info.render.frame);
	for (let i = 0; i < 400; i++) {
		await page.waitForTimeout(1000);
		const s = await page.evaluate(() => { const I = window.L99Island, c = I.camera().position, p = window.Crysis.world().player.state.pos; return { f: I.renderer().info.render.frame, d: Math.hypot(c.x - p.x, c.z - p.z) }; });
		if (s.f >= f0 + frames && s.d < 1.2) return s;
	}
	return null;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((q, r) => {
		const f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
		if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
		try { r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); } catch { r.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [], log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
	try {
		const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
		page.on('pageerror', (e) => errors.push('page: ' + e.message));
		page.on('console', (m) => { if (m.type() === 'error' || /shader|WebGL/i.test(m.text())) errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html`);
		for (let i = 0; i < 240; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => !!window.Crysis?.world?.()?.player).catch(() => false)) break; }
		for (let i = 0; i < 240; i++) {
			const entered = await page.evaluate(() => { if (!window.L99Loading?.active()) return true; const b = [...document.querySelectorAll('button')].find((x) => !x.hidden && /^Enter world$/.test(x.textContent.trim())); b?.click(); return false; }).catch(() => false);
			if (entered) break;
			await page.waitForTimeout(1000);
		}
		log('entered');
		const [lat, lon] = (process.env.GOTO || '37.7799,-121.978').split(',').map(Number);
		await page.evaluate(([a, b]) => window.Crysis.goTo(a, b, 2), [lat, lon]);
		await page.evaluate(() => { const w = window.Crysis.world(); w.sky.state.hours = +(window.SVC_HOURS || 11); w.interiors?.budget?.(600); });
		// the town streams in, and its services are sited
		for (let i = 0; i < +(process.env.SETTLE || 120); i++) {
			await page.waitForTimeout(1000);
			const s = await page.evaluate(() => { const S = window.Crysis.services(); return typeof S === 'string' ? S : { n: S.near.length, kinds: S.near.map((q) => q.kind + '@' + q.d).join(' '), pending: S.stats.pending, decided: S.stats.decided }; }).catch((e) => String(e));
			if (i % 10 === 0) log('settle', JSON.stringify(s));
			if (s && s.n >= 2 && i > 20) break;
		}
		log('decided', await page.evaluate(() => window.Crysis.world().services.decideNear()), JSON.stringify(await page.evaluate(() => window.Crysis.services().near.map((q) => [q.kind, q.d, q.src, q.size]))));
		const report = { at: [lat, lon], shots: [], services: null, flow: null };
		for (const [kind, room] of SHOTS) {
			const r0 = await page.evaluate(([k]) => window.Crysis.serviceGo(k), [kind]);
			log('go', kind, JSON.stringify(r0));
			if (typeof r0 === 'string') continue;
			// wait for its rooms to be built
			let live = false;
			for (let i = 0; i < 420 && !live; i++) { await page.waitForTimeout(1000); live = await page.evaluate(([k]) => window.Crysis.services().near.find((q) => q.kind === k)?.live, [kind]); }
			let r1 = r0;
			if (room) r1 = await page.evaluate(([k, rm]) => window.Crysis.serviceGo(k, rm), [kind, room]);
			await settle(page);
			const shot = await page.evaluate(() => { const I = window.L99Island, r = I.renderer(); r.render(I.scene(), I.camera()); return r.domElement.toDataURL('image/png'); });
			const file = path.join(OUT, `${kind}-${room || 'outside'}.png`);
			fs.writeFileSync(file, Buffer.from(shot.split(',')[1], 'base64'));
			const here = await page.evaluate(() => window.Crysis.services().here);
			report.shots.push({ kind, room, live, file, go: r1, here });
			log('shot', file, live, JSON.stringify(here));
		}
		// the flow: a call, an ambulance out; a fire, an engine out
		report.flow = await page.evaluate(async () => {
			const out = { call: window.Crysis.serviceCall(0.7, false) };
			await new Promise((r) => setTimeout(r, 15000));
			const S = window.Crysis.services();
			out.units = S.near.flatMap((q) => q.units.map((u) => q.kind + ':' + u.kind + ':' + u.state + ':' + (u.task || '')));
			out.stats = S.stats;
			out.hospital = S.near.find((q) => q.kind === 'hospital');
			return out;
		});
		report.services = await page.evaluate(() => window.Crysis.services());
		report.interiors = await page.evaluate(() => { const i = window.Crysis.interiors(); return typeof i === 'string' ? i : { live: i.live, maxSlice: i.maxSlice, lastMs: i.lastMs, list: i.list.map((b) => b.use + ':' + b.rooms.slice(0, 60)) }; });
		report.errors = errors;
		fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
		log('report', JSON.stringify({ flow: { call: report.flow.call, units: report.flow.units, stats: report.flow.stats }, errors: errors.slice(0, 12) }, null, 1));
	} finally { await browser.close(); server.close(); }
	if (errors.some((e) => /page:|shader/i.test(e))) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
