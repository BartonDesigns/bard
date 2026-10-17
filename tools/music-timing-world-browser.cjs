// The full game: faceplate + island world, auto music on, then with the faceplate's sequencer
// running. Fails on any page or console error, or on an auto music note off the sequencer's
// steps while it runs. Usage: node tools/music-timing-world-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
	const p = new URL(req.url, 'http://local').pathname, f = path.resolve(root, '.' + (p === '/' ? '/index.html' : p));
	try { res.setHeader('Content-Type', f.endsWith('.js') || f.endsWith('.mjs') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream'); res.end(fs.readFileSync(f)); } catch { res.statusCode = 404; res.end(); }
});
const HOOKS = `(() => {
	const real = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime').get;
	window.__real = (c) => real.call(c);
	window.__notes = [];
	const pm = MessagePort.prototype.postMessage;
	MessagePort.prototype.postMessage = function (m, ...rest) {
		if (m && m.cmd === 'noteOn' && typeof ctx !== 'undefined' && ctx) { const now = real.call(ctx); window.__notes.push({ id: m.id, at: (typeof m.at === 'number' && m.at > now) ? m.at : now }); }
		return pm.call(this, m, ...rest);
	};
})();`;
(async () => {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
	const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
	page.setDefaultTimeout(300000);
	const errors = [];
	page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
	page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { errors.push('console: ' + m.text().slice(0, 400)); console.log('CONSOLE', m.text().slice(0, 400)); } });
	await page.addInitScript(HOOKS);
	await page.goto('http://127.0.0.1:' + server.address().port + '/?offline&safe', { waitUntil: 'domcontentloaded' });
	await page.waitForFunction(() => typeof initAudio === 'function' && window.L99IslandDoor);
	await page.evaluate(async () => { initAudio(); await ctx.resume(); const a = await L99IslandDoor.engine(); await a.open({ seed: 1337, biome: 'TROPICAL', earth: false }); });
	const enter = page.getByRole('button', { name: 'Enter world', exact: true });
	if (await enter.isVisible().catch(() => false)) await enter.click();
	console.log('world open');
	const r = await page.evaluate(async () => {
		const out = {};
		Crysis.music.auto(true, true);
		await new Promise((r) => setTimeout(r, 4000));
		out.own = { notes: window.__notes.filter((n) => /^auto:/.test(n.id)).length, state: Crysis.music.state() };
		// the faceplate's pattern running: the score plays on its steps
		const steps = [], prev = window._lgStepTick;
		window._lgStepTick = function () { steps.push(window._seqAt); return prev && prev.apply(this, arguments); };
		beatLoopOn = true; startSequencer();
		await new Promise((r) => setTimeout(r, 1000));
		window.__notes.length = 0;
		await new Promise((r) => setTimeout(r, 6000));
		const auto = window.__notes.filter((n) => /^auto:/.test(n.id)).map((n) => n.at);
		const off = auto.map((t) => steps.reduce((b, s) => Math.abs(s - t) < Math.abs(b) ? s - t : b, 9));
		stopSequencer(); beatLoopOn = false; window._lgStepTick = prev;
		out.locked = { notes: auto.length, onAStep: off.filter((o) => Math.abs(o) < 0.0005).length, worstMs: Math.max(0, ...off.map((o) => Math.abs(o) * 1000)), lead: L99Clock.lead() };
		await new Promise((r) => setTimeout(r, 2000));
		Crysis.music.auto(false, true);
		return out;
	});
	console.log(JSON.stringify({ own: { notes: r.own.notes, playing: r.own.state.playing, bpm: r.own.state.bpm }, locked: r.locked }));
	if (!r.locked.notes || r.locked.onAStep !== r.locked.notes) errors.push('auto music off the sequencer\'s steps');
	console.log(errors.length ? 'FAIL ' + errors.join('; ') : 'PASS no errors, every auto music note on a step');
	await browser.close(); server.close();
	process.exitCode = errors.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
