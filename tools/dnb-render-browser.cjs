// DNB production renders: the faceplate (index.html?offline&safe) in headless Chromium, the DNB
// face selected, its master output tapped and written to WAV so a change to the kit, the
// patterns or the auto music composer can be heard and measured (RMS, crest, band energy).
//
//   node tools/dnb-render-browser.cjs --out DIR [--tag before] [--bars 8] [scenario,...]
//
// Scenarios:
//   beat:<PATTERN NAME>   the faceplate's own sequencer on one of the DNB beat patterns
//   score                 the auto music composer (island/src/music/score.js) writing DNB bars,
//                         played through playLead/playDrum as automusic.js does in the world
//   hits                  every drum of the DNB kit once, a beat apart (peak and centroid per hit)
// (Software audio in a headless browser: the sound is the engine's, the timing the scheduler's.)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const outDir = path.resolve(opt('out', path.join(root, 'tmp-dnb-renders')));
const tag = opt('tag', 'render');
const bars = +opt('bars', 8);
const scoreBars = +opt('score-bars', 32);
const scenarios = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
if (!scenarios.length) scenarios.push('beat:JUMP UP', 'score');
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://local');
	const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
	try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); } catch { res.writeHead(404).end(); }
});

// ---- the page side: a tap on the master, and a driver for the composer
const PAGE = {
	// records the master output (what the speakers get) into Int16 stereo
	tap: `(() => {
		if (window.__tap) return true;
		const c = ctx, out = window._masterClip;
		if (!out) return false;
		const sp = c.createScriptProcessor(4096, 2, 2), sink = c.createGain(); sink.gain.value = 0;
		const chunks = []; let on = false;
		sp.onaudioprocess = (e) => { if (!on) return; const L = e.inputBuffer.getChannelData(0), R = e.inputBuffer.getChannelData(1); chunks.push([Float32Array.from(L), Float32Array.from(R)]); };
		out.connect(sp); sp.connect(sink); sink.connect(c.destination);
		window.__tap = { start() { chunks.length = 0; on = true; }, stop() { on = false; },
			take() { const n = chunks.reduce((s, ch) => s + ch[0].length, 0), buf = new Int16Array(n * 2); let i = 0;
				for (const [L, R] of chunks) for (let k = 0; k < L.length; k++) { buf[i++] = Math.max(-32768, Math.min(32767, Math.round(L[k] * 32767))); buf[i++] = Math.max(-32768, Math.min(32767, Math.round(R[k] * 32767))); }
				chunks.length = 0; let s = ''; const u8 = new Uint8Array(buf.buffer); for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); return { b64: btoa(s), rate: c.sampleRate }; } };
		return true;
	})()`,
	// the composer driven as automusic.js drives it: a bar written ahead, each step stamped on the
	// audio clock (L99Clock.at) and played through playLead / playDrum on the faceplate's leads
	score: `async (nBars) => {
		const mod = await import('/island/src/music/score.js');
		const ctxm = await import('/island/src/music/context.js');
		const composer = mod.createComposer(174);
		const g = { place: 'city', move: 'run', night: 0, rain: 0, storm: false, planet: 'EARTH', volcano: 'quiet', trip: 0, game: false, regional: null };
		const M = ctxm.adapt(g);
		const pcs = mod.pitchSet(window.autoSynth?.state?.()?.intervals || [0, 2, 3, 5, 7, 8, 10, 12]);
		// the kits' balances as automusic.js has them (the caves' behind the leads; drum and bass in front)
		const face = currentFace, KIT = { kick: 0.32, snare: 0.3, clap: 0.3, hitom: 0.35, lotom: 0.35, cymbal: 0.22, openhat: 0.4, ride: 0.45, hihat: 0.6, shaker: 0.65, rim: 0.55, cowbell: 0.35, perc: 0.45, jump: 0.4 };
		const DNB_KIT = { kick: 0.95, snare: 0.9, clap: 0.6, hitom: 0.6, lotom: 0.6, cymbal: 0.5, openhat: 0.5, ride: 0.5, hihat: 0.55, shaker: 0.5, rim: 0.5, cowbell: 0.8, perc: 0.7, jump: 0.7 };
		const LEAD = { mel: 1, pad: 2, bass: 2, counter: 3, arp: 3 };
		const level = 0.7, stepS = 60 / bpm / 4;
		let serial = 0; const live = new Map(); const log = [];
		const noteOn = (t, role, semi, durSteps, vel) => {
			let v = vel * 1.35 * level; if (v < 0.035) return;
			let deg = Math.round(semi), bank = 1; const lead = LEAD[role];
			if (lead === 2) { bank = 2; while (deg > 12) deg -= 12; } else if (lead === 3) { bank = 2; while (deg < 0) deg += 12; while (deg > 26) deg -= 12; deg += 13; }
			const id = 'auto:render:' + role + ':' + (++serial);
			L99Clock.at(t, () => { window._spAuto = true; window._autoVelFloor = 0.02; try { playLead(id, deg, bank, true, Math.max(0.03, Math.min(0.8, v))); } finally { window._spAuto = false; window._autoVelFloor = undefined; } });
			const off = t + Math.max(0.06, durSteps * stepS * 0.95);
			live.set(id, off);
		};
		const drum = (t, name, vel, genre) => {
			const v = vel * ((genre === 'dnb' ? DNB_KIT : KIT)[name] ?? 0.7) * level; if (v < 0.03) return;
			L99Clock.at(t, () => { const ac = window._autoComp || (window._autoComp = {}); ac._selfDrum = true; window._spAuto = true; window._autoVelFloor = 0.04; try { playDrum(name, Math.max(0.04, Math.min(0.85, v))); } catch (_) {} finally { ac._selfDrum = false; window._spAuto = false; window._autoVelFloor = undefined; } });
		};
		const t0 = ctx.currentTime + 0.3;
		let bar = 0, events = [];
		const barAt = () => t0 + bar * 16 * stepS;
		const writeBar = () => { const out = composer.bar(M, pcs, face, null); const at = barAt(); log.push({ bar, section: out.info.section, genre: out.info.genre || '', drums: out.drums.length, notes: out.events.length });
			for (const e of out.events) events.push({ t: at + e.s * stepS, kind: 'note', e }); for (const d of out.drums) events.push({ t: at + d.s * stepS, kind: 'drum', d, genre: out.info.genre }); events.sort((a, b) => a.t - b.t); bar++; };
		writeBar();
		await new Promise((done) => { const timer = setInterval(() => {
			const now = ctx.currentTime;
			while (bar < nBars && barAt() < now + 0.6) writeBar();
			while (events.length && events[0].t < now + 0.3) { const x = events.shift(); if (x.kind === 'note') noteOn(x.t, x.e.role, x.e.semi, x.e.dur, x.e.vel); else drum(x.t, x.d.name, x.d.vel, x.genre); }
			for (const [id, off] of live) if (off < now + 0.3) { live.delete(id); L99Clock.at(off, () => { try { stopLead(id); } catch (_) {} }); }
			if (bar >= nBars && !events.length && !live.size && barAt() < now) { clearInterval(timer); done(); }
		}, 40); });
		await new Promise((r) => setTimeout(r, 900));
		return log;
	}`,
};

// ---- analysis: RMS, crest, spectral bands (a plain radix-2 FFT, 4096-point Hann windows)
function fft(re, im) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
	for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
		for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
function analyse(pcm, rate) {
	const n = pcm.length / 2, mono = new Float32Array(n);
	let sq = 0, peak = 0;
	for (let i = 0; i < n; i++) { const v = (pcm[2 * i] + pcm[2 * i + 1]) / 65534; mono[i] = v; sq += v * v; peak = Math.max(peak, Math.abs(v)); }
	const rms = Math.sqrt(sq / n);
	const N = 4096, bands = { sub: [20, 80], bass: [80, 250], lowmid: [250, 1000], mid: [1000, 4000], high: [4000, 16000] }, sum = {}; for (const k in bands) sum[k] = 0;
	const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
	let frames = 0;
	for (let s = 0; s + N <= n; s += N) { const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = mono[s + i] * win[i]; fft(re, im); frames++;
		for (let b = 1; b < N / 2; b++) { const f = b * rate / N, p = re[b] * re[b] + im[b] * im[b]; for (const k in bands) if (f >= bands[k][0] && f < bands[k][1]) sum[k] += p; } }
	const total = Object.values(sum).reduce((a, b) => a + b, 0) || 1;
	const dB = (x) => +(20 * Math.log10(Math.max(1e-9, x))).toFixed(1);
	// loudness over time: 100 ms RMS blocks; how much of the time is near the peak (the drop fills)
	const blk = Math.round(rate * 0.1), blocks = []; for (let s = 0; s + blk <= n; s += blk) { let q = 0; for (let i = s; i < s + blk; i++) q += mono[i] * mono[i]; blocks.push(Math.sqrt(q / blk)); }
	const loud = blocks.filter((b) => b > rms * 0.8).length / Math.max(1, blocks.length);
	return { seconds: +(n / rate).toFixed(1), rmsDb: dB(rms), peakDb: dB(peak), crestDb: dB(peak / Math.max(1e-9, rms)), loudShare: +loud.toFixed(2), bands: Object.fromEntries(Object.keys(bands).map((k) => [k, +(100 * sum[k] / total).toFixed(1)])), frames };
}
function wav(pcm, rate, file) {
	const h = Buffer.alloc(44), bytes = pcm.length * 2;
	h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(bytes, 40);
	fs.writeFileSync(file, Buffer.concat([h, Buffer.from(pcm.buffer, pcm.byteOffset, bytes)]));
}

(async () => {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
	const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
	const errors = [];
	page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
	page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
	await page.goto('http://127.0.0.1:' + server.address().port + '/index.html?offline&safe');
	await page.waitForFunction(() => typeof initAudio === 'function' && typeof startSequencer === 'function', null, { timeout: 120000 });
	await page.click('.tab-btn[data-face="DNB"]');
	const setup = await page.evaluate(async () => {
		initAudio(); window.ctx = ctx; await ctx.resume();
		bpm = 174; if (typeof updateBPM === 'function') updateBPM(); swingAmount = 0;
		const types = FACEPLATES[currentFace].types.slice();
		const pick = (names, fallback) => { for (const n of names) { const i = types.indexOf(n); if (i >= 0) return i; } return fallback; };
		// the render's leads: a hoover on Lead 1, a reese on Lead 2 (the bass), a glide on Lead 3
		currentType = pick(['HOOVER', 'NEURO-FORM'], 0); currentType2 = pick(['REESE', 'PHASE-REESE'], 1); window._LEAD3_TYPE = pick(['GLIDE', 'LIQUID'], 0);
		await new Promise((r) => setTimeout(r, 1200));
		return { face: currentFace, bpm, types, lead1: types[currentType], lead2: types[currentType2], lead3: types[window._LEAD3_TYPE], patterns: (BEAT_PATTERNS[currentFace] || []).map((p) => p.name) };
	});
	console.log('setup ' + JSON.stringify(setup));
	if (!await page.evaluate(PAGE.tap)) throw new Error('no master output to tap');
	const results = {};
	for (const sc of scenarios) {
		const name = sc.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
		let log = null;
		if (sc.startsWith('beat:')) {
			const pat = sc.slice(5);
			const idx = setup.patterns.indexOf(pat);
			if (idx < 0) { console.log('skip ' + sc + ': no such DNB pattern'); continue; }
			const seconds = bars * 4 * 60 / setup.bpm;
			await page.evaluate(async ({ idx, seconds }) => {
				beatLoopOn = true; currentBeat = idx; window.__tap.start(); startSequencer();
				await new Promise((r) => setTimeout(r, seconds * 1000 + 400));
				stopSequencer(); beatLoopOn = false; await new Promise((r) => setTimeout(r, 600)); window.__tap.stop();
			}, { idx, seconds });
		} else if (sc === 'score') {
			await page.evaluate(() => window.__tap.start());
			log = await page.evaluate(`(${PAGE.score})(${scoreBars})`);
			await page.evaluate(() => window.__tap.stop());
		} else if (sc === 'hits') {
			log = await page.evaluate(async () => {
				const names = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'rim', 'lotom', 'hitom', 'cymbal', 'ride', 'shaker', 'cowbell', 'perc', 'jump'];
				window.__tap.start();
				for (const n of names) { playDrum(n, 0.9); await new Promise((r) => setTimeout(r, 700)); }
				await new Promise((r) => setTimeout(r, 2000)); window.__tap.stop();
				return names.map((n, i) => ({ name: n, at: i * 0.7 }));
			});
		} else { console.log('skip ' + sc); continue; }
		const { b64, rate } = await page.evaluate(() => window.__tap.take());
		const buf = Buffer.from(b64, 'base64'), pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
		const file = path.join(outDir, tag + '-' + name + '.wav');
		wav(pcm, rate, file);
		const a = analyse(pcm, rate);
		results[sc] = { ...a, file, log };
		if (sc === 'hits') {
			// each hit's peak and its spectral centroid (where its energy sits), from its own window
			const n = pcm.length / 2;
			for (const h of log) {
				const s0 = Math.floor(h.at * rate), s1 = Math.min(n, s0 + Math.floor((h.name === 'jump' ? 2.4 : 0.65) * rate));
				let peak = 0, sq = 0; const N = 4096, re = new Float32Array(N), im = new Float32Array(N);
				for (let i = s0; i < s1; i++) { const v = (pcm[2 * i] + pcm[2 * i + 1]) / 65534; peak = Math.max(peak, Math.abs(v)); sq += v * v; }
				let cw = 0, ct = 0;
				for (let s = s0; s + N <= s1; s += N / 2) { for (let i = 0; i < N; i++) { re[i] = (pcm[2 * (s + i)] + pcm[2 * (s + i) + 1]) / 65534; im[i] = 0; } fft(re, im); for (let b = 1; b < N / 2; b++) { const p = re[b] * re[b] + im[b] * im[b]; cw += p * b * rate / N; ct += p; } }
				h.peakDb = +(20 * Math.log10(Math.max(1e-9, peak))).toFixed(1); h.rmsDb = +(20 * Math.log10(Math.max(1e-9, Math.sqrt(sq / (s1 - s0))))).toFixed(1); h.centroidHz = Math.round(cw / Math.max(1e-9, ct));
			}
			console.log('     ' + log.map((h) => h.name + ' ' + h.peakDb + '/' + h.rmsDb + 'dB@' + h.centroidHz).join('  '));
		}
		console.log('ok   ' + JSON.stringify({ scenario: sc, ...a, file: path.relative(root, file) }));
		if (log) console.log('     sections: ' + log.map((l) => l.section + (l.genre ? '/' + l.genre : '')).filter((s, i, arr) => s !== arr[i - 1]).join(' > '));
	}
	fs.writeFileSync(path.join(outDir, tag + '-summary.json'), JSON.stringify({ setup, results, errors }, null, '\t'));
	if (errors.length) console.log('page errors: ' + errors.length + '\n  ' + errors.slice(0, 6).join('\n  '));
	await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
