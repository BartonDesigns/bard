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
	// The gate. A material drawn for the first time builds its shaders right there, inside the
	// frame, and a city coming into view brings a hundred or so at once: a phone stops for
	// seconds (and can be closed for it). So in the frame's own render of the scene a draw of a
	// material with no shaders yet goes ahead only while that frame's budget of such draws
	// lasts (the time they took, at least one a frame); the rest are left out of that frame and
	// built in the background (renderer.compileAsync, a few things a frame), to be drawn a frame
	// or two later. Nothing is drawn differently once in, and nothing that has its shaders waits.
	// The sun's shadow pass inside that render goes through the same gate (its depth materials).
	// (the renderer's properties are read each time, never kept: three makes a new set when the
	// graphics come back from a loss, and the old one would say every material still had its
	// shaders, or that none of the new ones ever got them)
	const props = () => renderer.properties, held = new Set();
	let building = new WeakSet(), firstDraw = new WeakSet();
	let gateOn = false, inMain = false, spent = 0, passed = 0, frameN = 0, budgetMs = 24, built = 0, skipped = 0, compiling = 0;
	const isNew = (m) => !props().get(m).programs || building.has(m) || firstDraw.has(m);
	function gate({ budget = 24 } = {}) {
		budgetMs = budget;
		if (gateOn) return;
		gateOn = true;
		const render = renderer.render, rbd = renderer.renderBufferDirect;
		// (only the frame's own render: any other drawn from inside it, the environment's maps
		// made on first use for one, is never held back, or what it makes would stay wrong)
		renderer.render = function (sc, cam) {
			const was = inMain;
			if (sc !== scene || renderer.getRenderTarget() !== null) {
				inMain = false;
				try { return render.apply(this, arguments); } finally { inMain = was; }
			}
			inMain = true; spent = 0; passed = 0; frameN++;
			try { return render.apply(this, arguments); } finally { inMain = was; }
		};
		renderer.renderBufferDirect = function (cam, sc, geometry, material, object, group) {
			if (!inMain || !material || !isNew(material)) return rbd.call(this, cam, sc, geometry, material, object, group);
			if (building.has(material) || (passed > 0 && spent >= budgetMs)) {
				skipped++;
				// (its own material built off the frame; a shadow's depth material waits its turn)
				if (sc && !building.has(material) && !firstDraw.has(material) && held.size < 400) held.add(object);
				return undefined;
			}
			const t0 = performance.now();
			try { return rbd.call(this, cam, sc, geometry, material, object, group); } finally { spent += performance.now() - t0; passed++; built++; firstDraw.delete(material); }
		};
	}
	// a few of the held-back things' materials built a frame, in the background
	const heldBatch = new THREE.Group();
	function buildHeld(n = 2) {
		if (!held.size || compiling > 2 || renderer.getContext().isContextLost()) return;
		const take = [], mats2 = [];
		for (const o of held) {
			held.delete(o);
			if (!o.material || !o.parent) continue;
			const ms = mats(o).filter((m) => m && !props().get(m).programs);
			if (!ms.length) continue;
			take.push(o); mats2.push(...ms);
			if (take.length >= n) break;
		}
		if (!take.length) return;
		heldBatch.children = take;
		let job;
		try { job = renderer.compileAsync ? renderer.compileAsync(heldBatch, camera, scene) : (renderer.compile(heldBatch, camera, scene), Promise.resolve()); }
		catch { job = Promise.resolve(); }
		finally { heldBatch.children = []; }
		// (left out while the graphics build them; then the first draw can still wait on them, where
		// the graphics cannot say when they are done, so it counts against the frame's budget)
		for (const m of mats2) building.add(m);
		compiling++;
		// (a lost context may never answer: let go after a few seconds, drawn as before)
		const gen = epoch, B = building, F = firstDraw;
		Promise.race([Promise.resolve(job), new Promise((ok) => setTimeout(ok, 4000))]).catch(() => {}).finally(() => { if (gen === epoch) compiling--; for (const m of mats2) { B.delete(m); F.add(m); } });
	}
	function reset() { epoch++; run++; cancelWork?.(); cancelWork = null; queue = []; work = null; done = new WeakMap(); last.length = 0; t = 0; compiled = 0; held.clear(); building = new WeakSet(); firstDraw = new WeakSet(); compiling = 0; }
	return { all, textures, tick, prepare, reset, gate, buildHeld, recent: () => last.slice(), info: () => ({ pending: queue.length, busy: !!work, compiled, gate: gateOn ? { held: held.size, built, skipped, frames: frameN, budgetMs } : null }) };
}
