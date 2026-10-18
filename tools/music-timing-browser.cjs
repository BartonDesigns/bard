// Music timing on the faceplate (index.html?offline&safe), headless Chromium: the sequencer's
// steps, the arpeggiator, HARD-quantized drum pads, loop recording, the playhead, page stalls
// and a held audio context (a call). Prints one JSON line per scenario and fails when one is
// off the beat. Usage: node tools/music-timing-browser.cjs [scenario,...]
// (Software audio in a headless browser: the timings are the scheduler's, not a device's.)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const only = (process.argv[2] || '').split(',').filter(Boolean);
const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://local');
	const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
	try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); } catch { res.writeHead(404).end(); }
});

// installed before the page's scripts: records every scheduled start and every worklet noteOn
const HOOKS = `(() => {
	const real = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime').get;
	window.__real = (c) => real.call(c);
	window.__starts = []; window.__notes = [];
	const st = AudioScheduledSourceNode.prototype.start;
	AudioScheduledSourceNode.prototype.start = function (when, ...rest) {
		const now = real.call(this.context);
		window.__starts.push({ perf: performance.now(), when: (typeof when === 'number' && when > 0) ? Math.max(when, now) : now, now, kind: this.constructor.name });
		return st.call(this, when, ...rest);
	};
	const pm = MessagePort.prototype.postMessage;
	MessagePort.prototype.postMessage = function (m, ...rest) {
		if (m && m.cmd === 'noteOn' && window.ctx) { const now = real.call(window.ctx); window.__notes.push({ id: m.id, at: (typeof m.at === 'number' && m.at > now) ? m.at : now, now }); }
		if (m && m.cmd === 'noteOff' && window.ctx) { const now = real.call(window.ctx); (window.__offs || (window.__offs = [])).push({ id: m.id, at: (typeof m.at === 'number' && m.at > now) ? m.at : now, now }); }
		return pm.call(this, m, ...rest);
	};
	window.__busy = (on) => { clearInterval(window.__busyT); if (on) window.__busyT = setInterval(() => { const e = performance.now() + 45; while (performance.now() < e); }, 60); };
})();`;

const stats = (a) => { if (!a.length) return { n: 0 }; const s = a.map(Math.abs).sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: a.length, median: +(q(0.5) * 1000).toFixed(2), p95: +(q(0.95) * 1000).toFixed(2), max: +(s[s.length - 1] * 1000).toFixed(2) }; };

(async () => {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
	const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
	const errors = [];
	page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
	page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
	await page.addInitScript(HOOKS);
	await page.goto('http://127.0.0.1:' + server.address().port + '/index.html?offline&safe');
	await page.waitForFunction(() => typeof initAudio === 'function' && typeof startSequencer === 'function', null, { timeout: 120000 });
	await page.evaluate(async () => {
		initAudio(); window.ctx = ctx; await ctx.resume();
		bpm = 120; if (typeof updateBPM === 'function') updateBPM(); swingAmount = 0;
		await new Promise((r) => setTimeout(r, 1500));
	});
	const wait = (ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
	const failed = [];
	const run = async (name, fn, ok) => { if (only.length && !only.includes(name)) return; const r = await fn(); const pass = ok(r); if (!pass) failed.push(name); console.log((pass ? 'ok   ' : 'FAIL ') + JSON.stringify({ scenario: name, ...r })); };
	// sequencer step onsets: drum hits fitted to a 125 ms grid
	const gridErr = (times, step) => { if (times.length < 3) return []; const t0 = times[0]; return times.map((t) => { const k = Math.round((t - t0) / step); return t - t0 - k * step; }); };
	const cluster = (list) => { const out = []; for (const t of list.sort((a, b) => a - b)) if (!out.length || t - out[out.length - 1] > 0.004) out.push(t); return out; };

	await run('sequencer', async () => {
		const r = await page.evaluate(async () => {
			beatLoopOn = true; currentBeat = 0; window.__starts.length = 0; window.__busy(true); startSequencer();
			await new Promise((r) => setTimeout(r, 5000));
			window.__busy(false); stopSequencer(); beatLoopOn = false;
			return { starts: window.__starts.filter((s) => s.kind === 'AudioBufferSourceNode' || s.kind === 'OscillatorNode').map((s) => s.when), lead: L99Clock.lead() };
		});
		const on = cluster(r.starts);
		const e = gridErr(on.filter((_, i) => i > 2), 0.125);
		// steps the sequencer re-anchored: an onset off the grid by more than 20 ms
		return { onsets: on.length, err: stats(e), offGrid: e.filter((x) => Math.abs(x) > 0.02).length, lead: r.lead };
	}, (r) => r.err.p95 < 5 && r.offGrid === 0);

	await run('arp', async () => {
		const r = await page.evaluate(async () => {
			window.__notes.length = 0; midiArpMode = 'up'; window.__busy(true);
			arpNoteOn(0, 'hold:a', 1, false); arpNoteOn(2, 'hold:b', 1, false);
			await new Promise((r) => setTimeout(r, 4000));
			window.__busy(false); const upAt = window.__real(ctx); arpNoteOff('hold:a'); arpNoteOff('hold:b'); midiArpMode = 'off';
			const offs = (window.__offs || []).filter((o) => /^arp:/.test(o.id));
			// (notes sent ahead for after the keys came up are called off: not counted)
			const notes = window.__notes.filter((n) => /^arp:/.test(n.id) && n.at < upAt);
			// a release scheduled before (or at) its own onset
			const early = notes.filter((n) => { const o = offs.find((x) => x.id === n.id); return o && o.at <= n.at + 0.001; }).length;
			return { at: notes.map((n) => n.at), early };
		});
		const iv = r.at.slice(1).map((t, i) => t - r.at[i] - 0.125);
		return { notes: r.at.length, intervalErr: stats(iv.slice(2)), releaseBeforeOnset: r.early };
	}, (r) => r.intervalErr.p95 < 2 && r.releaseBeforeOnset === 0);

	// the sequencer's own step times, read inside its tick
	const STEPS = `window.__steps = []; window.__prevLg = window._lgStepTick; window._lgStepTick = function () { window.__steps.push({ step: currentStep, at: window._seqAt }); return window.__prevLg && window.__prevLg.apply(this, arguments); };`;
	const UNSTEPS = `window._lgStepTick = window.__prevLg;`;
	const offsets = (times, steps) => times.map((t) => { let best = null; for (const s of steps) if (!best || Math.abs(s.at - t) < Math.abs(best.at - t)) best = s; return t - best.at; });

	await run('arp-vs-seq', async () => {
		const r = await page.evaluate(async ([S, U]) => {
			eval(S); beatLoopOn = false; window.__notes.length = 0; startSequencer();
			await new Promise((r) => setTimeout(r, 700 + Math.random() * 125));
			midiArpMode = 'up'; arpNoteOn(4, 'hold:c', 1, false);
			await new Promise((r) => setTimeout(r, 3000));
			arpNoteOff('hold:c'); midiArpMode = 'off'; stopSequencer(); eval(U);
			return { steps: window.__steps, arp: window.__notes.filter((n) => /^arp:/.test(n.id)).map((n) => n.at) };
		}, [STEPS, UNSTEPS]);
		return { arpNotes: r.arp.length, offsetFromSeqGrid: stats(offsets(r.arp, r.steps)) };
	}, (r) => r.offsetFromSeqGrid.p95 < 2);

	for (const lead of [0.08, 0.15]) await run('hard-drum@' + lead, async () => {
		const r = await page.evaluate(async ([S, U, lead]) => {
			window._worldAudioLead = lead;
			eval(S); beatLoopOn = false; loopRecording = true; startSequencer();
			await new Promise((r) => setTimeout(r, 800));
			const ts = ctx.getOutputTimestamp();
			const lag = ts.performanceTime > 0 ? window.__real(ctx) - ts.contextTime - (performance.now() - ts.performanceTime) / 1000 : 0;
			const hits = [];
			for (let i = 0; i < 14; i++) {
				const last = window.__steps[window.__steps.length - 1];
				const target = last.at + 0.125 * 2 + (Math.random() - 0.5) * 0.03;
				while (window.__real(ctx) - lag < target) await new Promise((r) => setTimeout(r, 1));
				let want = null; for (const s of window.__steps) if (!want || Math.abs(s.at - target) < Math.abs(want.at - target)) want = s;
				const mark = window.__starts.length;
				let rec = null;
				withDrumQuantize(() => playDrum('rim'), (st) => { rec = st; });
				await new Promise((r) => setTimeout(r, 260));
				const st = window.__starts.slice(mark).map((x) => x.when).sort((a, b) => a - b)[0];
				hits.push({ late: st - want.at, rec, want: want.step });
				await new Promise((r) => setTimeout(r, Math.random() * 100));
			}
			stopSequencer(); loopRecording = false; eval(U); window._worldAudioLead = undefined;
			if (typeof clearSequence === 'function') try { clearSequence(); } catch (e) {}
			return { hits, lag };
		}, [STEPS, UNSTEPS, lead]);
		const late = r.hits.map((h) => h.late).sort((a, b) => a - b);
		return { lagMs: +(r.lag * 1000).toFixed(1), soundVsIntendedStepMs: { median: +(late[late.length >> 1] * 1000).toFixed(1), min: +(late[0] * 1000).toFixed(1), max: +(late[late.length - 1] * 1000).toFixed(1) }, recordedRightStep: r.hits.filter((h) => h.rec === h.want).length + '/' + r.hits.length };
	}, (r) => r.recordedRightStep.split('/')[0] === r.recordedRightStep.split('/')[1] && r.soundVsIntendedStepMs.max < r.lagMs + 45);

	await run('stalls', async () => {
		const r = await page.evaluate(async ([S, U]) => {
			eval(S); beatLoopOn = true; currentBeat = 0; window.__starts.length = 0; startSequencer();
			const T = setInterval(() => { const e = performance.now() + 190; while (performance.now() < e); }, 1400);
			await new Promise((r) => setTimeout(r, 9000));
			clearInterval(T); stopSequencer(); beatLoopOn = false; eval(U);
			// a re-anchor: a step whose time is not one sixteenth after the one before
			let shifts = 0; const st = window.__steps;
			const where = [];
			for (let i = 1; i < st.length; i++) if (Math.abs(st[i].at - st[i - 1].at - 0.125) > 0.003) { shifts++; where.push(i); }
			return { steps: st.length, shifts, where, lead: L99Clock.lead() };
		}, [STEPS, UNSTEPS]);
		return r;
	}, (r) => r.shifts <= 1);

	// the page frozen 0.6 s and 1.2 s while a hi-hat plays every sixteenth: every step heard, on time
	for (const mode of ['beat', 'timer']) await run('freeze-' + mode, async () => {
		const r = await page.evaluate(async (mode) => {
			window._BEAT_CLOCK = mode === 'beat' ? undefined : false;
			beatLoopOn = false; recordedDrumSteps = { hihat: new Array(LOOP_STEPS).fill(1) };
			const covered = [];
			window.L99Beat233?.onCovered((m) => covered.push(m.at));
			window.__starts.length = 0;
			await new Promise((r) => setTimeout(r, 300));
			const from = window.__real(ctx);
			startSequencer();
			await new Promise((r) => setTimeout(r, 1500));
			const beat = !!window._seqBeat;
			const block = (ms) => { const e = performance.now() + ms; while (performance.now() < e); };
			block(600);
			await new Promise((r) => setTimeout(r, 1000));
			block(1200);
			await new Promise((r) => setTimeout(r, 1000));
			stopSequencer(); recordedDrumSteps = {}; window._BEAT_CLOCK = undefined; window.L99Beat233?.onCovered(null);
			await new Promise((r) => setTimeout(r, 300));
			return { beat, main: window.__starts.filter((x) => (x.kind === 'AudioBufferSourceNode' || x.kind === 'OscillatorNode') && x.when >= from).map((x) => x.when), covered };
		}, mode);
		const all = [...cluster(r.main), ...r.covered].sort((a, b) => a - b);
		if (process.env.DUMP) console.log(JSON.stringify({ main: cluster(r.main).map((t) => +t.toFixed(3)), covered: r.covered.map((t) => +t.toFixed(3)) }));
		const t0 = all[0], end = all[all.length - 1], slots = Math.round((end - t0) / 0.125) + 1;
		let missing = 0, doubled = 0; const off = [];
		for (let i = 0; i < slots; i++) {
			const at = t0 + i * 0.125, near = all.filter((t) => Math.abs(t - at) < 0.03);
			// (the kit's own humanizing moves a hit up to 10 ms: a cluster, not two hits)
			if (!near.length) missing++; else { if (near.length > 1) doubled++; off.push(near[0] - at); }
		}
		const shifted = all.filter((t) => { const k = Math.round((t - t0) / 0.125); return Math.abs(t - t0 - k * 0.125) > 0.012; }).length;
		return { beatClock: r.beat, steps: slots, missing, doubled, offGrid: shifted, coveredByAudioThread: r.covered.length };
	}, mode === 'beat' ? (r) => r.beatClock && r.missing === 0 && r.doubled === 0 && r.offGrid === 0 : () => true);

	// starting, stopping, a new face and a new loop length while playing: the page keeps every
	// step itself (nothing left to the audio thread while it is not held up), on the grid
	await run('switches', async () => {
		const r = await page.evaluate(async () => {
			const covered0 = window.L99Beat233 ? L99Beat233.covered() : 0;
			beatLoopOn = true;
			for (let i = 0; i < 3; i++) { startSequencer(); await new Promise((r) => setTimeout(r, 400)); stopSequencer(); await new Promise((r) => setTimeout(r, 100)); }
			startSequencer();
			await new Promise((r) => setTimeout(r, 600));
			document.querySelector('.tab-btn[data-face="HYPHY"]')?.click();
			await new Promise((r) => setTimeout(r, 1200));
			const face = currentFace, kit = window.L99Beat233?.kitKey();
			document.querySelector('.tab-btn[data-face="BARD"]')?.click();
			await new Promise((r) => setTimeout(r, 800));
			stopSequencer(); beatLoopOn = false;
			return { beat: !!window.L99Beat233?.ready(ctx), face, kit, coveredWhileCalm: (window.L99Beat233 ? L99Beat233.covered() : 0) - covered0 };
		});
		return r;
	}, (r) => r.beat && r.coveredWhileCalm === 0 && /^HYPHY:/.test(r.kit || ''));

	await run('dots', async () => {
		const r = await page.evaluate(async ([S, U]) => {
			eval(S); beatLoopOn = true; startSequencer();
			await new Promise((r) => setTimeout(r, 600));
			const out = [], dots = [...document.querySelectorAll('.step-dot')];
			const mo = new MutationObserver((list) => {
				const ts = ctx.getOutputTimestamp();
				const heard = window.__real(ctx) - (window.__real(ctx) - ts.contextTime - (performance.now() - ts.performanceTime) / 1000);
				for (const m of list) {
					const i = dots.indexOf(m.target);
					if (i < 0 || !m.target.classList.contains('active') || (m.oldValue || '').includes('active')) continue;
					// the dot's first step (a dot covers LOOP_STEPS / 16 of them), nearest in time
					let st = null; for (const x of window.__steps) if (x.step === Math.round(i * LOOP_STEPS / 16) && (!st || Math.abs(heard - x.at) < Math.abs(heard - st.at))) st = x;
					if (st) out.push(heard - st.at);
				}
			});
			dots.forEach((d) => mo.observe(d, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
			await new Promise((r) => setTimeout(r, 2500));
			mo.disconnect(); stopSequencer(); beatLoopOn = false; eval(U);
			return { off: out };
		}, [STEPS, UNSTEPS]);
		const o = r.off.sort((a, b) => a - b);
		return { lights: o.length, dotVsHeardMs: { median: +(o[o.length >> 1] * 1000).toFixed(1), min: +(o[0] * 1000).toFixed(1), max: +(o[o.length - 1] * 1000).toFixed(1) } };
	}, (r) => Math.abs(r.dotVsHeardMs.median) < 20);

	await run('suspend', async () => {
		const r = await page.evaluate(async () => {
			beatLoopOn = true; startSequencer();
			await new Promise((r) => setTimeout(r, 1000));
			await ctx.suspend();
			const at = window.__real(ctx), p0 = performance.now();
			window.__starts.length = 0;
			await new Promise((r) => setTimeout(r, 3000));
			const p1 = performance.now();
			await ctx.resume();
			await new Promise((r) => setTimeout(r, 600));
			stopSequencer(); beatLoopOn = false;
			// sounds queued while suspended, all due within a moment of the resume
			const burst = window.__starts.filter((s) => s.perf > p0 && s.perf < p1).length;
			return { queuedWhileSuspended: burst, total: window.__starts.length };
		});
		return r;
	}, (r) => r.queuedWhileSuspended === 0);

	await run('record', async () => {
		const r = await page.evaluate(async () => {
			const steps = [];
			const prev = window._lgStepTick;
			window._lgStepTick = function () { steps.push({ step: currentStep, at: window._seqAt }); return prev && prev.apply(this, arguments); };
			beatLoopOn = true; startSequencer();
			await new Promise((r) => setTimeout(r, 1000));
			const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
			const lag = ts && ts.performanceTime > 0 ? window.__real(ctx) - ts.contextTime - (performance.now() - ts.performanceTime) / 1000 : 0;
			const res = [];
			for (let i = 0; i < 20; i++) {
				// a hit on a step as it is heard, give or take a human 15 ms
				const last = steps[steps.length - 1];
				const target = last.at + 0.125 * 2 + (Math.random() - 0.5) * 0.03;
				while (window.__real(ctx) - lag < target) await new Promise((r) => setTimeout(r, 1));
				const got = quantizedRecordStep();
				let best = null; for (const s of steps) if (!best || Math.abs(s.at - target) < Math.abs(best.at - target)) best = s;
				res.push({ want: best.step, got });
				await new Promise((r) => setTimeout(r, 40 + Math.random() * 100));
			}
			stopSequencer(); beatLoopOn = false; window._lgStepTick = prev;
			return { res, lag };
		});
		const right = r.res.filter((x) => x.want === x.got).length;
		const late = r.res.filter((x) => (x.got - x.want + 32) % 32 === 1).length;
		return { lagMs: +(r.lag * 1000).toFixed(1), rightStep: right + '/' + r.res.length, oneStepLate: late };
	}, (r) => r.oneStepLate === 0 && r.rightStep.split('/')[0] === r.rightStep.split('/')[1]);

	console.log(JSON.stringify({ errors }));
	await browser.close(); server.close();
	if (errors.length) failed.push('page errors');
	console.log(failed.length ? 'FAIL ' + failed.join(', ') : 'PASS every scenario on the beat');
	process.exitCode = failed.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
