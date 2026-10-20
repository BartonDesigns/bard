// The performance readout: what a frame costs on this device, read on the device itself. The
// headless checks draw with a software GPU, so how long a real phone takes to draw the world is
// only known from the phone; this puts it on screen, small, in a corner, to read or screenshot.
// Turned on with ?perf in the address (it stays on for this device; ?perf=0 turns it off) or
// Crysis.perf(true). It shows:
//   the frames: per second, the average and the slowest in the last second (ms)
//   what the graphics hold (MB, world/gpumeter.js) and the script heap where the browser says
//   the draws: calls and triangles over all of a frame's passes (the sea's mirror included)
//   the governor's tier and the drawing scale
//   and, when a load went without a goodbye (loading-screen.js's black box), where it stopped
const KEY = 'l99-perf';

// the switch from the address, kept on the device
export function perfWanted(search = '', storage = null) {
	const q = new URLSearchParams(search);
	if (q.has('perf')) {
		const on = q.get('perf') !== '0';
		try { storage?.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
		return on;
	}
	try { return storage?.getItem(KEY) === '1'; } catch { return false; }
}

// a second of frame times (ms) as the readout gives them
export function frameStats(times) {
	if (!times.length) return { fps: 0, avg: 0, worst: 0 };
	const sum = times.reduce((a, b) => a + b, 0);
	return { fps: Math.round(times.length * 1000 / sum), avg: Math.round(sum / times.length * 10) / 10, worst: Math.round(Math.max(...times)) };
}

// where the last lost load stopped, in a line: "Shaping the landscape at 41 s, 380 MB"
export function lostLine(lost) {
	const L = lost?.at?.(-1);
	if (!L) return '';
	const s = L.stages?.at(-1) || [], n = L.now || [];
	const t = Math.max(s[0] || 0, n[0] || 0), gpu = n[1] ?? s[2];
	return `last load lost: "${s[1] || '?'}" at ${Math.round(t)} s` + (gpu != null ? `, ${gpu} MB` : '') + (L.hidden ? ' (in background)' : '');
}

export function createPerfMeter({ mount, renderer, governor, storage = null, search = '' }) {
	let on = false, el = null, times = [], prev = 0, acc = { calls: 0, tris: 0 }, shown = { calls: 0, tris: 0 }, frames = 0, nextT = 0, plainRender = null;
	// every render of a frame counted (three's own count is the last render's only)
	function count(on) {
		if (on && !plainRender) {
			plainRender = renderer.render;
			const draw = plainRender;
			renderer.render = (...a) => { const r = draw(...a); acc.calls += renderer.info.render.calls; acc.tris += renderer.info.render.triangles; return r; };
		} else if (!on && plainRender) { renderer.render = plainRender; plainRender = null; }
	}
	function show(v) {
		on = !!v;
		try { storage?.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
		count(on);
		if (on && !el) {
			el = document.createElement('div');
			el.className = 'l99-perf';
			el.setAttribute('aria-hidden', 'true');
			el.style.cssText = 'position:absolute;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));z-index:40;pointer-events:none;padding:6px 8px;border-radius:8px;background:rgba(10,10,10,.72);border:1px solid rgba(255,255,255,.12);color:#fff;font:600 11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;letter-spacing:.01em';
			mount.appendChild(el);
		}
		if (el) el.hidden = !on;
		times = []; nextT = 0; prev = 0;
		return on;
	}
	show(perfWanted(search, storage));
	return {
		show,
		on: () => on,
		// one drawn frame, at now (ms): timed from the one before, unclamped (the game's own step
		// is capped at a quarter second)
		frame(now) {
			if (!on) { prev = 0; return; }
			const ms = prev ? now - prev : 0;
			prev = now;
			if (ms <= 0) return;
			times.push(ms); frames++;
			if (now < nextT) return;
			shown = { calls: Math.round(acc.calls / Math.max(1, frames)), tris: Math.round(acc.tris / Math.max(1, frames)) };
			acc = { calls: 0, tris: 0 }; frames = 0;
			nextT = now + 1000;
			const f = frameStats(times); times = [];
			const g = governor?.info?.() || {}, heap = globalThis.performance?.memory?.usedJSHeapSize;
			const lost = lostLine(window.L99Loading?.trail?.()?.lost);
			el.textContent = `${f.fps} fps  ${f.avg} ms  worst ${f.worst} ms\n`
				+ `gpu ${g.gpuMB ?? '?'} MB` + (heap ? `  heap ${Math.round(heap / 1048576)} MB` : '') + '\n'
				+ `${shown.calls} calls  ${(shown.tris / 1000).toFixed(0)}k tris\n`
				+ `${g.tier || '?'} (${g.mode || '?'})  scale ${renderer.getPixelRatio().toFixed(2)}`
				+ (lost ? '\n' + lost : '');
			el.style.color = f.avg > 33 ? '#f59e0b' : '#fff';
		},
	};
}
