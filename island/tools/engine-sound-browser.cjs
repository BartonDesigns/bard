// The world's engines, thrusters and beds in the running game: enters the world, stands, drives a
// car (W held), flies with the booster stepped up, takes a military vehicle if a base is near,
// and counts the audio nodes made and let go over time (every create* and disconnect counted),
// with Crysis.audio()'s engines, environment and thrusters. Passes when nothing threw, the
// engines' voices stayed within budget and their nodes all went once they stopped.
// Run with: node island/tools/engine-sound-browser.cjs [query]   (PHONE=1 as a phone)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gz': 'application/gzip' };
const query = process.argv[2] || '';

// in the page, before anything: count the nodes every context makes and every one let go
function count() {
	const made = {}, gone = new WeakSet();
	let lost = 0;
	const P = (window.BaseAudioContext || window.AudioContext).prototype;
	for (const k of Object.getOwnPropertyNames(P)) {
		if (!/^create(?!Buffer$|PeriodicWave$)/.test(k) || typeof P[k] !== 'function') continue;
		const f = P[k];
		P[k] = function (...a) { const n = f.apply(this, a); made[k] = (made[k] || 0) + 1; return n; };
	}
	const d = AudioNode.prototype.disconnect;
	AudioNode.prototype.disconnect = function (...a) { if (!a.length && !gone.has(this)) { gone.add(this); lost++; } return d.apply(this, a); };
	window.NODES = () => ({ made: Object.values(made).reduce((a, b) => a + b, 0), disconnected: lost, byKind: { ...made } });
}

(async () => {
	const server = http.createServer((q, r) => {
		const f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
		if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
		try { r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); } catch { r.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	const report = { samples: [], errors: [], checks: {} };
	try {
		const page = await browser.newPage(process.env.PHONE ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true } : { viewport: { width: 640, height: 480 } });
		await page.addInitScript(count);
		page.on('pageerror', (e) => report.errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text().slice(0, 300)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html${query}`);
		for (let i = 0; i < 180; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => !!window.Crysis?.world?.()?.player).catch(() => false)) break; }
		for (let i = 0; i < 240; i++) {
			const box = await page.evaluate(() => { if (!window.L99Loading?.active()) return 'in'; const b = [...document.querySelectorAll('button')].find((x) => !x.hidden && /^Enter world$/.test(x.textContent.trim())); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(() => null);
			if (box === 'in') break;
			if (box) await page.mouse.click(box.x, box.y);
			await page.waitForTimeout(1000);
		}
		// a key: the island's own context wakes on the first key or touch
		await page.keyboard.press('Shift');
		const sample = async (phase) => {
			const s = await page.evaluate(() => { const a = window.Crysis.audio(); return { nodes: window.NODES(), engines: a?.engines && { live: a.engines.live, awake: a.engines.awake, voices: a.engines.voices, traffic: a.engines.traffic, budget: a.engines.budget, list: a.engines.list.slice(0, 6) }, env: a?.environment, thrusters: a?.thrusters, place: a?.place?.kind, surface: a?.surface }; }).catch((e) => ({ error: String(e) }));
			s.phase = phase; s.t = report.samples.length;
			report.samples.push(s);
			console.log(phase, JSON.stringify({ made: s.nodes?.made, disconnected: s.nodes?.disconnected, live: s.engines?.live, awake: s.engines?.awake, voices: s.engines?.voices, traffic: s.engines?.traffic, thrust: s.thrusters?.thrust, beds: s.env?.beds, list: s.engines?.list?.map((v) => `${v.kind}:${v.awake ? 'on' : 'off'}:${v.gear ?? ''}:${v.rpm ?? v.spool ?? ''}`) }));
		};
		const settle = +(process.env.SETTLE || 20000);
		await page.waitForTimeout(settle);
		// the frame rate (a software renderer can be very slow): every wait below is stretched to suit
		report.fps = await page.evaluate(() => new Promise((done) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else done(n / 3); }; requestAnimationFrame(f); }));
		const K = Math.max(1, Math.min(8, 20 / Math.max(0.5, report.fps)));
		const wait = (ms) => page.waitForTimeout(ms * K);
		console.log('fps', report.fps.toFixed(1), 'waits x', K.toFixed(1));
		for (let i = 0; i < 3; i++) { await sample('standing'); await wait(4000); }
		// driving: your own car, W held
		await page.evaluate(() => window.Crysis.drive.start());
		await wait(6000);
		await page.keyboard.down('w');
		for (let i = 0; i < 4; i++) { await wait(2500); await sample('driving'); }
		await page.keyboard.up('w');
		await wait(2000); await sample('coasting');
		await page.evaluate(() => window.Crysis.drive.stop());
		await wait(3000); await sample('out of the car');
		// flying, the booster stepped up
		await page.keyboard.press('f');
		await page.keyboard.down('w');
		for (let i = 0; i < 3; i++) { await page.keyboard.press('b'); await wait(2500); await sample('flying'); }
		await page.keyboard.up('w');
		await page.keyboard.press('f');
		await wait(5000); await sample('landed');
		// a military vehicle, if a base is near enough to take one
		const base = await page.evaluate(() => window.Crysis.base()).catch(() => null);
		report.base = base;
		if (base && / at the gate/.test(base)) {
			await wait(12000);
			const v = await page.evaluate(() => { const M = window.Crysis.military.api, P = window.Crysis.world().player.state; const list = M.parked(); const near = list.filter((q) => q.kind === 'jet' || q.kind === 'heli' || q.kind === 'tank').sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; if (!near) return null; P.pos.set(near.x + 3, near.y + 1.7, near.z + 3); return near.kind; }).catch(() => null);
			report.military = v;
			if (v) {
				await wait(1500);
				await page.evaluate(() => window.Crysis.drive.start());
				await wait(3000);
				await page.keyboard.down(v === 'heli' ? 'ArrowUp' : 'w');
				for (let i = 0; i < 3; i++) { await wait(2500); await sample('military ' + v); }
				await page.keyboard.up(v === 'heli' ? 'ArrowUp' : 'w');
				await page.evaluate(() => window.Crysis.drive.stop()).catch(() => {});
				await wait(3000); await sample('out of it');
			}
		}
		for (let i = 0; i < 3; i++) { await wait(4000); await sample('standing again'); }
		// checks: nothing threw; the voices kept to the budget; the engines' nodes went with them
		const S = report.samples.filter((s) => s.engines);
		report.checks.noErrors = report.errors.filter((e) => !/favicon|404|net::ERR/.test(e)).length === 0;
		report.checks.withinBudget = S.every((s) => s.engines.awake <= s.engines.budget.engines && s.engines.traffic <= s.engines.budget.traffic);
		report.checks.drove = S.some((s) => s.phase === 'driving' && s.engines.list.some((v) => v.prio === 3 && v.awake && v.rpm > 0));
		report.checks.flew = S.some((s) => s.phase === 'flying' && s.thrusters?.on);
		const end = S[S.length - 1], start = S[0];
		report.checks.enginesReleased = end.engines.voices === 0 || end.engines.list.every((v) => v.prio < 3);
		// (made minus let go, standing at the start and again at the end: a leak would climb)
		report.checks.liveNodes = { start: start.nodes.made - start.nodes.disconnected, end: end.nodes.made - end.nodes.disconnected };
	} finally { await browser.close(); server.close(); }
	const out = process.env.OUT_JSON;
	if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
	console.log('checks', JSON.stringify(report.checks), 'base', report.base, 'military', report.military);
	if (report.errors.length) console.log('errors', report.errors.slice(0, 12));
})().catch((e) => { console.error(e); process.exitCode = 1; });
