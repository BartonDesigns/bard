// Warm visible content in small, non-overlapping batches. Hidden underground,
// orbital, and off-world scenes must not spend GPU memory during surface loading.
import * as THREE from 'three';

export function createShaderWarm(renderer, scene, camera) {
	let done = new WeakMap(), epoch = 0, run = 0, work = null, cancelWork = null, queue = [], t = 0, compiled = 0;
	const batch = new THREE.Group(), last = [], frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
	function view() { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
	function inView(o) { return o.frustumCulled === false || (o.isSprite ? frustum.intersectsSprite(o) : !o.geometry || frustum.intersectsObject(o)); }
	const mats = (o) => Array.isArray(o.material) ? o.material : [o.material];
	const fresh = (m) => m && m.visible !== false && done.get(m) !== m.version;
	function visible(o) { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; } return false; }
	function pending() {
		scene.updateMatrixWorld(); view();
		const out = [], seen = new Set();
		scene.traverseVisible((o) => {
			if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
			if (!inView(o)) return;
			const next = mats(o).filter((m) => fresh(m) && !seen.has(m));
			if (next.length) { out.push(o); for (const m of next) seen.add(m); }
		});
		return out;
	}
	function step(list, n) {
		if (work) return work;
		view();
		const take = [], versions = new Map(), generation = epoch;
		while (list.length && versions.size < n) {
			const o = list.pop();
			if (!visible(o) || !inView(o)) continue;
			const next = mats(o).filter(fresh);
			if (!next.length) continue;
			for (const m of next) versions.set(m, m.version);
			take.push(o);
		}
		if (!take.length) return Promise.resolve();
		batch.children = take;
		let result;
		try { result = renderer.compileAsync ? renderer.compileAsync(batch, camera, scene) : renderer.compile(batch, camera, scene); }
		catch (e) { result = Promise.reject(e); }
		finally { batch.children = []; }
		// A lost context may never complete its compiler query. Reset must release
		// loading/teardown immediately, without waiting for that driver's promise.
		const cancelled = new Promise(resolve => { cancelWork = resolve; });
		const job = Promise.race([result, cancelled]).then(() => {
			if (generation !== epoch || renderer.getContext().isContextLost()) return;
			for (const [m, version] of versions) {
				done.set(m, version); compiled++;
				last.push(`${m.type}${m.name ? ' ' + m.name : ''}`); if (last.length > 24) last.shift();
			}
		}).catch((e) => { if (generation === epoch && !renderer.getContext().isContextLost()) console.warn('[shaders]', e); })
			.finally(() => { if (work === job) { work = null; cancelWork = null; } });
		work = job; return job;
	}
	async function all({ n = 3, budget = 2500, progress = null } = {}) {
		const generation = epoch, own = ++run, t0 = performance.now();
		if (work) await work;
		if (generation !== epoch || own !== run) return;
		const list = pending(), total = list.length || 1;
		queue = [];
		while (list.length) {
			if (generation !== epoch || own !== run || renderer.getContext().isContextLost()) return;
			if (performance.now() - t0 > budget) { queue = list; return; }
			await step(list, n);
			progress?.(1 - list.length / total);
			await new Promise((ok) => setTimeout(ok, 0));
		}
		if (generation === epoch && own === run) progress?.(1);
	}
	function tick(dt, { frameMs = 16 } = {}) {
		if (renderer.getContext().isContextLost() || work || frameMs > 22) return;
		t += dt;
		if (!queue.length && t > .5) { t = 0; queue = pending(); }
		if (queue.length) step(queue, 1);
	}
	// Optional render passes can defer drawing until their currently visible
	// materials are ready. Unlike compile(scene), this never warms hidden branches.
	function prepare({ n = 2 } = {}) {
		if (renderer.getContext().isContextLost() || work) return false;
		const list = pending();
		if (!list.length) return true;
		step(list, n);
		return false;
	}
	// the pictures the visible materials read, handed to the GPU one at a time with a breath
	// between, so the first frame does not upload them all at once (phones die of that burst)
	const sent = new WeakMap();
	function texturesOf(m, out) {
		for (const k in m) { const t = m[k]; if (t?.isTexture) out.add(t); }
		if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k]?.value; if (v?.isTexture) out.add(v); else if (Array.isArray(v)) for (const t of v) if (t?.isTexture) out.add(t); }
	}
	async function textures({ budget = 2500 } = {}) {
		const generation = epoch, t0 = performance.now(), all = new Set();
		scene.updateMatrixWorld(); view();
		scene.traverseVisible((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material && inView(o)) for (const m of mats(o)) if (m) texturesOf(m, all); });
		let n = 0;
		for (const t of all) {
			if (generation !== epoch || renderer.getContext().isContextLost() || performance.now() - t0 > budget) break;
			if (t.isRenderTargetTexture || t.version === 0 || sent.get(t) === t.version) continue;
			renderer.initTexture(t);
			sent.set(t, t.version); n++;
			await new Promise((ok) => setTimeout(ok, 0));
		}
		return n;
	}
	function reset() { epoch++; run++; cancelWork?.(); cancelWork = null; queue = []; work = null; done = new WeakMap(); last.length = 0; t = 0; compiled = 0; }
	return { all, textures, tick, prepare, reset, recent: () => last.slice(), info: () => ({ pending: queue.length, busy: !!work, compiled }) };
}
