// Shaders built a few at a time. Building hundreds at once (a world's worth on load, or a
// district streaming in) can keep Safari's translation to Metal busy long enough that macOS
// resets the graphics ("context lost"), so they are built a handful a frame instead.
//
//   const warm = createShaderWarm(renderer, scene, camera);
//   await warm.all();   // on load, behind the loading card
//   warm.tick(dt);      // every frame: two new materials at most, from what has streamed in

import * as THREE from 'three';

export function createShaderWarm(renderer, scene, camera) {
	const done = new WeakSet(), batch = new THREE.Group(), last = [];
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
	// everything there is now, n materials a frame
	async function all(n = 6) {
		const list = pending();
		while (list.length) {
			if (renderer.getContext().isContextLost()) return;
			step(list, n);
			await new Promise((ok) => setTimeout(ok, 0));
		}
	}
	// in play: looked for twice a second, two a frame
	let queue = [], t = 0;
	function tick(dt) {
		if (renderer.getContext().isContextLost()) return;
		t += dt;
		if (!queue.length && t > 0.5) { t = 0; queue = pending(); }
		if (queue.length) step(queue, 2);
	}
	return { all, tick, recent: () => last.slice() };
}
