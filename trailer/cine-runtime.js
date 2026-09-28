// Injected before the page loads (Playwright addInitScript). Gives the capture tool a
// virtual clock so the engine can be stepped frame-exactly, whatever the GPU speed:
//
//   __cine.begin()      freeze real time; from now on requestAnimationFrame waits for step()
//   __cine.step(dt)     advance the clock by dt seconds and run the engine's frame once
//   __cine.end()        hand the page back to real time
//   __cine.grab(type,q) the canvas as a data URL, read in the same task as the render
//
// Until begin() everything runs in real time (loading, streaming, awaits on rAF).
// Within a step, performance.now() creeps forward 1 µs per call, so the engine's
// "work for N ms a frame" loops still end; the drift is deterministic and tiny.
(() => {
	const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window);
	const realDateNow = Date.now.bind(Date);
	const C = { on: false, v: 0, calls: 0, queue: [], id: 1e6, epoch: 0, frames: 0, noRender: false };
	// a seeded Math.random: the same shot renders the same way on every run (resumes match)
	let seed = 0x9e3779b9;
	C.seed = (n) => { seed = (n >>> 0) || 1; };
	Math.random = () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	performance.now = () => (C.on ? C.v + ++C.calls * 0.001 : realNow());
	Date.now = () => (C.on ? C.epoch + C.v : realDateNow());
	window.requestAnimationFrame = (cb) => {
		if (!C.on) return realRaf(cb);
		C.queue.push(cb);
		return ++C.id;
	};
	C.begin = () => {
		if (C.on) return;
		C.v = realNow(); C.epoch = realDateNow() - C.v; C.on = true;
	};
	C.end = () => {
		if (!C.on) return;
		C.on = false;
		const q = C.queue; C.queue = [];
		for (const cb of q) realRaf(cb);
	};
	C.step = (dt) => {
		C.v += dt * 1000; C.calls = 0;
		const q = C.queue; C.queue = [];
		const t = C.v;
		for (const cb of q) { try { cb(t); } catch (e) { console.error('[cine]', e); } }
		C.frames++;
		return q.length;
	};
	C.grab = (type = 'image/png', q = 0.95) => {
		const cv = window.L99Island?.renderer?.().domElement || document.querySelector('canvas');
		return cv ? cv.toDataURL(type, q) : null;
	};
	C.real = realNow;
	window.__cine = C;
})();
