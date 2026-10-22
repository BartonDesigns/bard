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
			for (const o of take) for (const m of mats(o)) if (m && versions.has(m)) nowBuilt(m, o);
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
	// (three makes new properties when the graphics come back after a loss: read live, never kept)
	const P = () => renderer.properties, held = new Set();
	let building = new WeakSet(), firstDraw = new WeakSet();
	let onHold = null;   // (a debug trace of each held-back draw: Crysis.shaders / the harness)
	let gateOn = false, inMain = false, spent = 0, passed = 0, frameN = 0, budgetMs = 24, built = 0, skipped = 0, compiling = 0, passedAlike = 0, missedAlike = 0, bigBuilt = 0;
	const isNew = (m) => !P().get(m).programs || building.has(m) || firstDraw.has(m);
	// The shape of a material's shaders. Materials made alike (a clone, the same kit in another
	// colour, a sector's copy of a shared material) all use one program from three's cache, so once
	// one of a shape is built the rest cost nothing and must not be held back for a frame (holes in
	// the picture, the black blinks on a turn). The shape stands in for three's own program key,
	// which needs the frame's light state: the material's type, its shader sources and defines,
	// which pictures it reads and its flags, plus what the object adds (instancing, skinning,
	// morphs, vertex colours). A shape wrongly thought built is only built in the frame, as before.
	const SRC = new Map(), shapes = new WeakMap();
	let shapesBuilt = new Set();
	const srcId = (s) => { let id = SRC.get(s); if (id === undefined) { id = SRC.size; SRC.set(s, id); } return id; };
	function shape(m, o) {
		let s = shapes.get(m);
		if (!s || s.v !== m.version) {
			const parts = [m.type, m.precision || ''];
			if (m.isShaderMaterial || m.isRawShaderMaterial) parts.push(srcId(m.vertexShader || ''), srcId(m.fragmentShader || ''));
			else if (m.customProgramCacheKey && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) parts.push(srcId(m.customProgramCacheKey()));
			if (m.defines) parts.push(JSON.stringify(m.defines));
			for (const k in m) { const v = m[k]; if (v?.isTexture) parts.push(k, v.channel || 0, v.colorSpace || '', v.mapping || 0, v.isVideoTexture ? 'v' : ''); }
			parts.push(m.vertexColors ? 'vc' : '', m.flatShading ? 'fs' : '', m.side, m.alphaTest > 0 ? 'at' : '', m.alphaHash ? 'ah' : '', m.alphaToCoverage ? 'a2c' : '', m.fog === false ? 'nf' : '', m.transparent ? 't' : '', m.premultipliedAlpha ? 'pa' : '', m.dithering ? 'd' : '', m.sizeAttenuation === false ? 'ns' : '', m.transmission ? 'tr' : '', m.clearcoat ? 'cc' : '', m.sheen ? 'sh' : '', m.iridescence ? 'ir' : '', m.anisotropy ? 'an' : '', m.wireframe ? 'wf' : '', m.lights === false ? 'nl' : '', m.clipping ? 'cl' : '', m.toneMapped === false ? 'nt' : '', m.envMap ? 'em' : '', m.gradientMap ? 'gm' : '');
			s = { v: m.version, k: parts.join('|') };
			shapes.set(m, s);
		}
		let k = s.k;
		if (o) {
			if (o.isInstancedMesh) k += o.instanceColor ? '#ic' : '#i';
			if (o.isBatchedMesh) k += '#b';
			if (o.isSkinnedMesh) k += '#s';
			const g = o.geometry;
			if (g?.attributes) {
				const a = g.attributes, ma = g.morphAttributes, mt = ma && (ma.position || ma.normal || ma.color);
				if (mt) k += '#m' + mt.length + (ma.position ? 'p' : '') + (ma.normal ? 'n' : '') + (ma.color ? 'c' : '');
				if (a.color?.itemSize === 4) k += '#va';
				k += (a.uv1 ? '#u1' : '') + (a.uv2 ? '#u2' : '') + (a.uv3 ? '#u3' : '') + (a.tangent ? '#tg' : '');
			}
		}
		return k;
	}
	// (a material of a shape not seen built this epoch: its shaders are, or may be, still to build)
	const alike = (m, o) => shapesBuilt.has(shape(m, o));
	const nowBuilt = (m, o) => { shapesBuilt.add(shape(m, o)); };
	// (a picture the material reads that has not been handed to the GPU yet: its first draw sends
	// it, a big one takes a good part of a frame)
	function unsent(m) {
		const pr = P();
		for (const k in m) { const t = m[k]; if (t?.isTexture && !t.isRenderTargetTexture && pr.get(t).__webglTexture === undefined) return true; }
		if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k]?.value; if (v?.isTexture && !v.isRenderTargetTexture && pr.get(v).__webglTexture === undefined) return true; }
		return false;
	}
	// A thing left out of a frame leaves a hole where it should be. Something small (a lamp, a
	// person) is not missed for a frame or two; the ground, the sea, a building beside you is a
	// black blink across the screen. So what would fill a good part of the view is never held
	// back: its angular size, the radius of its bounding sphere over its distance, past bigAt
	// (what is never culled, the sky for one, counts as big).
	const _c = new THREE.Vector3(), _s = new THREE.Sphere(), _s2 = new THREE.Sphere(), _m = new THREE.Matrix4();
	let bigAt = 0.35;
	function big(o, geometry) {
		let s = o.boundingSphere || geometry?.boundingSphere;
		if (!s && geometry?.attributes?.position && !geometry.attributes.position.isInterleavedBufferAttribute) { try { geometry.computeBoundingSphere(); s = geometry.boundingSphere; } catch { s = null; } }
		if (!s) return o.frustumCulled === false;   // (its size unknown: the sky, never culled, is big)
		if (o.isInstancedMesh && !o.boundingSphere) {
			// (the instances' spread, not the one shape's: as far round you as the set reaches)
			if (!o.count) return false;
			_s.makeEmpty();
			for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _m); _s2.copy(s).applyMatrix4(_m); _s.union(_s2); }
			s = _s;
		}
		_c.copy(s.center).applyMatrix4(o.matrixWorld);
		const e = o.matrixWorld.elements, k = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
		return s.radius * k > bigAt * _c.distanceTo(camera.position);
	}
	function gate({ budget = 24, bigAt: bigAtIn = 0.35 } = {}) {
		budgetMs = budget; bigAt = bigAtIn;
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
			const fresh = !building.has(material) && !firstDraw.has(material), over = passed > 0 && spent >= budgetMs;
			// (made like one already built: three finds its program in the cache, so it is drawn now,
			// unless the frame is spent and it brings a picture still to send)
			if (fresh && alike(material, object) && !(over && unsent(material))) {
				const n0 = renderer.info.programs.length, t0 = performance.now();
				try { return rbd.call(this, cam, sc, geometry, material, object, group); } finally { spent += performance.now() - t0; passedAlike++; if (renderer.info.programs.length !== n0) missedAlike++; }
			}
			if (over && !big(object, geometry) || (building.has(material) && !big(object, geometry))) {
				skipped++;
				onHold?.(object, material, building.has(material) ? 'building' : firstDraw.has(material) ? 'firstDraw' : 'new', frameN);
				// (its own material built off the frame; a shadow's depth material waits its turn)
				if (sc && fresh && held.size < 400) held.add(object);
				return undefined;
			}
			const t0 = performance.now();
			try { return rbd.call(this, cam, sc, geometry, material, object, group); } finally { spent += performance.now() - t0; passed++; built++; if (fresh || firstDraw.has(material)) nowBuilt(material, object); firstDraw.delete(material); if (building.has(material)) bigBuilt++; }
		};
	}
	// a few of the held-back things' materials built a frame, in the background
	const heldBatch = new THREE.Group();
	function buildHeld(n = 2) {
		if (!held.size || compiling > 2 || renderer.getContext().isContextLost()) return;
		const take = [], mats2 = [], pairs = [];
		for (const o of held) {
			held.delete(o);
			if (!o.material || !o.parent) continue;
			const ms = mats(o).filter((m) => m && !P().get(m).programs && !alike(m, o));
			if (!ms.length) continue;
			take.push(o); mats2.push(...ms); for (const m of ms) pairs.push([m, o]);
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
		Promise.race([Promise.resolve(job), new Promise((ok) => setTimeout(ok, 4000))]).catch(() => {}).finally(() => { if (gen === epoch) { compiling--; for (const [m, o] of pairs) nowBuilt(m, o); } for (const m of mats2) { B.delete(m); F.add(m); } });
	}
	function reset() { epoch++; run++; cancelWork?.(); cancelWork = null; queue = []; work = null; done = new WeakMap(); last.length = 0; t = 0; compiled = 0; held.clear(); building = new WeakSet(); firstDraw = new WeakSet(); shapesBuilt = new Set(); compiling = 0; }
	return { all, textures, tick, prepare, reset, gate, buildHeld, trace: (f) => { onHold = f; }, recent: () => last.slice(), info: () => ({ pending: queue.length, busy: !!work, compiled, gate: gateOn ? { held: held.size, built, skipped, frames: frameN, budgetMs, alike: passedAlike, alikeMissed: missedAlike, shapes: shapesBuilt.size, bigAt, bigBuilt } : null }) };
}
