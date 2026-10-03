// Shaders built a few at a time. Building hundreds at once (a world's worth on load, or a
// district streaming in) can keep Safari's translation to Metal busy long enough that macOS
// resets the graphics ("context lost"), so they are built a handful a frame instead.
//
//   const warm = createShaderWarm(renderer, scene, camera);
//   await warm.all();   // on load, behind the loading card
//   warm.tick(dt);      // every frame: two new materials at most, from what has streamed in

import * as THREE from 'three';

export function createShaderWarm(renderer, scene, camera) {
	let done = new WeakSet(), epoch = 0;
	const batch = new THREE.Group(), last = [];
	let queue = [], t = 0;
	const mats = (o) => (Array.isArray(o.material) ? o.material : [o.material]);
	// the drawable objects with a material not built yet
	function pending() {
		const out = [];
		scene.traverse((o) => {
			if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
			if (mats(o).some((m) => m && !done.has(m))) out.push(o);
		});
		return out;
	}
	// build up to n new materials now (lit as the scene is)
	function step(list, n) {
		const take = [], fresh = new Set();
		while (list.length && fresh.size < n) {
			const o = list.pop();
			for (const m of mats(o)) if (m && !done.has(m)) fresh.add(m);
			take.push(o);
		}
		if (!take.length) return;
		// (borrowed into a batch without moving them: compile only walks the children)
		batch.children = take;
		try { renderer.compile(batch, camera, scene); } catch (e) { console.warn('[shaders]', e); } finally { batch.children = []; }
		for (const m of fresh) done.add(m);
		// the last few built (what was being built if the graphics are lost: see main.js)
		for (const m of fresh) { last.push(`${m.type}${m.name ? ' ' + m.name : ''}${m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? ' ' + String(m.customProgramCacheKey()).slice(0, 40) : ''} / ${take.find((o) => mats(o).includes(m))?.parent?.name || ''}`); if (last.length > 24) last.shift(); }
	}
	// everything there is now, n materials a frame; for at most budget ms (the rest is built in
	// play, by tick); progress(0..1) as it goes
	async function all({ n = 6, budget = Infinity, progress = null } = {}) {
		const generation = epoch;
		const list = pending(), total = list.length || 1, t0 = performance.now();
		while (list.length) {
			if (generation !== epoch) return;
			if (renderer.getContext().isContextLost()) return;
			if (performance.now() - t0 > budget) { queue = list; return; }
			step(list, n);
			progress?.(1 - list.length / total);
			await new Promise((ok) => setTimeout(ok, 0));
		}
		if (generation === epoch) progress?.(1);
	}
	// in play: looked for twice a second, two a frame
	function tick(dt) {
		if (renderer.getContext().isContextLost()) return;
		t += dt;
		if (!queue.length && t > 0.5) { t = 0; queue = pending(); }
		if (queue.length) step(queue, 2);
	}
	function reset() { epoch++; queue = []; done = new WeakSet(); last.length = 0; t = 0; }
	return { all, tick, reset, recent: () => last.slice() };
}
