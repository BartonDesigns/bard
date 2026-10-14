// Renders short WAV samples of the world's engines, thrusters and rain (audio/engines.js,
// thrusters.js, environment.js), offline in Chromium (OfflineAudioContext, stepped a frame at a
// time), through the world's own bus and compressor (world/soundbus.js), for the ear.
// Run with: OUT=/some/dir node island/tools/engine-sound-samples.cjs [name ...]
// Names: car-rev truck-pull jet-pass rotor-pass tank-pass traffic flight-boost space-cabin rain-car-roof rain-leaves
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.md': 'text/plain' };
const OUT = process.env.OUT || path.join(os.tmpdir(), 'l99-sound');
const ALL = ['car-rev', 'truck-pull', 'jet-pass', 'rotor-pass', 'tank-pass', 'traffic', 'flight-boost', 'space-cabin', 'rain-car-roof', 'rain-leaves'];

// in the page: one scene rendered, returned as a 16-bit stereo WAV in base64
async function render(name) {
	const E = await import('/island/src/audio/engines.js');
	const { createThrusters } = await import('/island/src/audio/thrusters.js');
	const { createEnvironment } = await import('/island/src/audio/environment.js');
	const secs = { 'car-rev': 9, 'truck-pull': 9, 'jet-pass': 14, 'rotor-pass': 12, 'tank-pass': 10, traffic: 12, 'flight-boost': 10, 'space-cabin': 10, 'rain-car-roof': 6, 'rain-leaves': 6 }[name];
	const sr = 44100, ctx = new OfflineAudioContext(2, sr * secs, sr);
	Object.defineProperty(ctx, 'state', { get: () => 'running' });
	const master = ctx.createGain(); master.connect(ctx.destination);
	window._masterClip = master;
	let now = 0;
	E.useClock(() => now);
	const cam = { position: { x: 0, y: 1.7, z: 0 }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };
	const place = (x, y, z) => { cam.position.x = x; cam.position.y = y; cam.position.z = z; };
	const stops = [];
	let step;
	if (name === 'car-rev' || name === 'truck-pull') {
		// idle, flat out through the gears, then off the throttle; heard from just behind
		const truck = name === 'truck-pull', car = E.carEngine(truck ? 'truck' : 'sports'), top = truck ? 26 : 80, pull = truck ? 2.2 : 7.5;
		let v = 0, x = 0;
		// (facing along the road: the right hand is +z)
		cam.matrixWorld.elements[0] = 0; cam.matrixWorld.elements[2] = 1;
		stops.push(car);
		step = (t, dt) => {
			const thr = t > 1 && t < 7 ? 1 : 0;
			v = Math.max(0, v + (thr ? pull * Math.max(0, 1 - v / top) : -1.2) * dt); x += v * dt;
			place(x - 7, 1.7, 0);
			car.drive({ speed: v, throttle: thr, where: { x, y: 0.6, z: 0 } });
		};
	} else if (name === 'jet-pass' || name === 'rotor-pass' || name === 'tank-pass') {
		const kind = name.split('-')[0] === 'rotor' ? 'heli' : name.split('-')[0];
		const e = E.engineVoice(kind, 2), sp = { jet: 150, heli: 50, tank: 12 }[kind], x0 = { jet: -1100, heli: -300, tank: -60 }[kind], y = { jet: 80, heli: 40, tank: 1.5 }[kind], z = { jet: 60, heli: 30, tank: 12 }[kind];
		stops.push(e);
		step = (t) => { place(0, 1.7, 0); e.set({ rpm: 1, throttle: kind === 'tank' ? 0.8 : 0.9, speed: sp, ab: kind === 'jet' ? 1 : 0, where: { x: x0 + sp * t, y, z, fx: 1, fz: 0 } }); };
	} else if (name === 'traffic') {
		const T = E.createTraffic(), cars = Array.from({ length: 6 }, (_, i) => ({ kind: ['sedan', 'bus', 'pickup', 'hatch', 'delivery', 'suv'][i], px: (i % 2 ? 1 : -1) * (40 + i * 35), py: 0.5, pz: i % 2 ? -4 : 4, vx: (i % 2 ? -1 : 1) * (10 + i), vz: 0, v: 10 + i }));
		stops.push({ stop: () => T.stop() });
		step = (t, dt) => { place(0, 1.7, 0); for (const c of cars) c.px += c.vx * dt; T.update(dt, cars, cam, { on: 1 }); };
	} else if (name === 'flight-boost' || name === 'space-cabin') {
		// flying faster, the booster stepped up three times; or out in space, a warp in the middle
		const th = createThrusters(), space = name === 'space-cabin';
		const P = { flying: true, locked: false, boost: 1, vel: { v: 0, length() { return this.v; } } };
		const orbit = space ? { info: () => ({ gear: 1000, warping: now > 4 && now < 7, warpTime: Math.max(0, now - 4) }), space: () => true, blend: () => 1 } : null;
		step = (t, dt) => {
			if (!space) { P.boost = t > 6 ? 9 : t > 4 ? 6 : t > 2 ? 3 : 1; P.vel.v += (16 * P.boost - P.vel.v) * Math.min(1, dt * 1.5); }
			else P.vel.v += ((t > 4 && t < 7 ? 3e6 : 2e4) - P.vel.v) * Math.min(1, dt);
			th.update(dt, P, orbit, {});
		};
		stops.push({ stop: () => { P.flying = false; } });
	} else {
		const env = createEnvironment(), roof = name === 'rain-car-roof';
		step = (t, dt) => env.update(dt, { cam, sense: { surface: roof ? 'road' : 'grass', place: { kind: 'wild' } }, rain: 1, hours: 12, cabin: roof, speed: 0, alt: 1.7 });
	}
	const dt = 1 / 60;
	step(0, dt); E.enginesFrame(dt, cam, {});
	for (let i = 1; i * dt < secs - 0.05; i++) {
		const t = i * dt;
		ctx.suspend(t).then(() => { now = t; step(t, dt); E.enginesFrame(dt, cam, {}); ctx.resume(); });
	}
	const buf = await ctx.startRendering();
	for (const s of stops) s.stop();
	E.useClock(null);
	// 16-bit stereo WAV, peak noted
	const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, out = new DataView(new ArrayBuffer(44 + n * 4));
	const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
	str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
	out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
	let peak = 0;
	for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
	let bin = '';
	const bytes = new Uint8Array(out.buffer);
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
	return { wav: btoa(bin), peak, secs };
}

(async () => {
	const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((q, r) => {
		const f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
		if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
		try { r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); } catch { r.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox'] });
	try {
		const page = await browser.newPage();
		const errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(`http://127.0.0.1:${server.address().port}/README.md`);
		for (const name of names) {
			const r = await page.evaluate(render, name);
			const file = path.join(OUT, `${name}.wav`);
			fs.writeFileSync(file, Buffer.from(r.wav, 'base64'));
			console.log(`${file}  ${r.secs} s  peak ${r.peak.toFixed(3)}`);
		}
		if (errors.length) console.log('errors', errors);
	} finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
