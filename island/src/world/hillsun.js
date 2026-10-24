// The sun behind the hills. The sun's shadow map covers a hundred metres or so round you,
// so nothing farther off ever shaded anything: at sunset the whole San Ramon valley stayed
// lit by a sun that had long gone behind the ridge west of it, and Mt Diablo was lit gold
// from its foot to its summit, where in Josh's photo (2026-10-24, from the hills over San
// Ramon) only its upper slopes still have the sun, rose and salmon, over foothills already
// in cool blue-grey shade.
//
// Here the land casts its own shadow. A grid of the ground's heights round you (48 km a
// side) is swept along the sun's bearing, from the sun's side, into the height the light
// comes down to over each point and how far off the ground that casts it lies (past the
// grid's sunward edge a march carries on over the land and sea, the Earth's curve taken
// in). Every lit material takes the sun only above that height: three's light chunk, put in
// before anything is compiled, as world/airfog.js puts in the haze, so it is the same in
// every shader from the first frame and is never switched (switching rebuilds every shader,
// which is what crashes phones). As the sun goes down the shade fills the valleys and climbs
// the hills, and the last light is on the summits; where the shade's edge falls it is as
// soft as the sun's disc makes it at that distance. Between sweeps the shader carries each
// edge on by the distance to what casts it, so it climbs smoothly as the sun sinks.
// The work is done only while the sun is low (under ~30 degrees) and spread over frames.

import * as THREE from 'three';

export const HILL_N = 256;              // texels a side
export const HILL_SIZE = 48000;         // metres a side
const CELL = HILL_SIZE / HILL_N;
// the march past the grid's sunward edge: how far, in how many steps (each a little longer)
const REACH = 90000, STEPS = 44;
const GROW = Math.pow(REACH / CELL, 1 / (STEPS - 1));
// the Earth's radius as the light sees it (refraction bends it round a little: a sixth more)
export const R_LIGHT = 6371000 * 7 / 6;
// the sun's half width (radians): the shade's edge is that soft at the distance of what casts it
const SUN_R = 0.0047;
// (on below about 25 degrees of sun, gone by 34)
const ON_LO = 0.42, ON_HI = 0.56;

const data = new Uint16Array(HILL_N * HILL_N * 2);
const tex = new THREE.DataTexture(data, HILL_N, HILL_N, THREE.RGFormat, THREE.HalfFloatType);
tex.minFilter = tex.magFilter = THREE.LinearFilter;
tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
tex.generateMipmaps = false;
tex.needsUpdate = true;

// The uniforms are plain {x, y, z, w} objects, shared by reference by every material (three
// copies a material's uniforms from its ShaderLib entry, and copies only its own vector types,
// so plain objects are kept). The map is copied too: a copy shares its pixels and its texture
// on the graphics card with this one (three keeps one per source), so each new sweep is sent
// once, here (renderer.initTexture), and every copy draws it.
export const HILL_SUN = {
	map: tex,
	// x, z of the grid's north-west corner; 1 / its size; how much it is on (0..1)
	rect: { x: 0, y: 0, z: 1 / HILL_SIZE, w: 0 },
	// the tangent of the sun's height as swept and now; the shade's edge (m); the lift (m) that
	// keeps level ground lit while the sun is up, whatever the grid's coarseness
	tan: { x: 0, y: 0, z: 4, w: 8 },
};

// how much of the sun reaches a point (world space): 1 lit, 0 in the shade of the land. For a
// shader of its own (a ShaderMaterial: bay/city.js's far trees) with hillSunUniforms()
export const HILL_SUN_GLSL = /* glsl */`
uniform sampler2D hillSunMap;
uniform vec4 hillSunRect;
uniform vec4 hillSunTan;
float hillSunAt( const in vec3 wp ) {
	if ( hillSunRect.w <= 0.0 ) return 1.0;
	vec2 uv = ( wp.xz - hillSunRect.xy ) * hillSunRect.z;
	vec2 e = min( uv, 1.0 - uv );
	float edge = smoothstep( 0.0, 0.1, min( e.x, e.y ) );
	if ( edge <= 0.0 ) return 1.0;
	vec2 st = texture2D( hillSunMap, uv ).rg;
	float s = st.x - st.y * ( hillSunTan.y - hillSunTan.x );
	float soft = hillSunTan.z + st.y * ${SUN_R};
	return 1.0 - hillSunRect.w * edge * ( 1.0 - smoothstep( s - soft, s + soft, wp.y + hillSunTan.w ) );
}
`;
export const hillSunUniforms = () => ({ hillSunMap: { value: tex }, hillSunRect: { value: HILL_SUN.rect }, hillSunTan: { value: HILL_SUN.tan } });
// (in the light chunk a point comes in view space: the view's rotation undone, the camera's
// position added, it is in the world's)
const PARS = HILL_SUN_GLSL + /* glsl */`
float hillSun( const in vec3 viewPos ) {
	return hillSunRect.w <= 0.0 ? 1.0 : hillSunAt( cameraPosition + ( vec4( viewPos, 0.0 ) * viewMatrix ).xyz );
}
`;
const HOOK = 'getDirectionalLightInfo( directionalLight, directLight );';

let installed = false;
// before any material is compiled (main.js): the function in every lit shader, applied to the
// directional light (the sun: the only one in the world's scene), and the uniforms in every
// built-in material that has lights and in UniformsLib.lights for those made from it
export function installHillSun() {
	if (installed) return true;
	const chunk = THREE.ShaderChunk.lights_fragment_begin;
	if (chunk.indexOf(HOOK) < 0) { console.warn('[hillsun] three\'s light chunk has changed; the hills cast no shade'); return false; }
	installed = true;
	THREE.ShaderChunk.lights_pars_begin += PARS;
	THREE.ShaderChunk.lights_fragment_begin = chunk.replace(HOOK, HOOK + '\n\t\tdirectLight.color *= hillSun( geometryPosition );');
	const add = (u) => Object.assign(u, hillSunUniforms());
	add(THREE.UniformsLib.lights);
	for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && 'directionalLights' in u) add(u); }
	return true;
}

// ---------- the sweep ----------
// H: the ground's heights (row j runs along z, south from the north-west corner; texel centres),
// dx, dz: the bearing toward the sun (unit), tanE: the tangent of its height; edgeS/edgeT: over
// each texel of the sunward edge (the first column or row swept), the light's height and the
// distance to what casts it, from the march past the grid. Out: S, the height the light comes
// down to over each texel, and T, how far off (m) the ground that casts it is (0: nothing
// nearer than the next texel sunward). The curve of the Earth goes in exactly along each
// shadow: a caster t metres off sits t^2/2R lower.
export function sweepHills(H, N, cell, dx, dz, tanE, edgeS, edgeT, S, T) {
	const xMajor = Math.abs(dx) >= Math.abs(dz);
	const a = xMajor ? dx : dz, b = xMajor ? dz : dx;
	const r = b / Math.abs(a), d = cell / Math.abs(a), up = a < 0 ? -1 : 1;
	const fall = d * tanE + d * d / (2 * R_LIGHT), bend = d / R_LIGHT;
	const at = xMajor ? (m, n) => n * N + m : (m, n) => m * N + n;
	const m0 = up < 0 ? 0 : N - 1;
	for (let n = 0; n < N; n++) { const k = at(m0, n); S[k] = edgeS[n]; T[k] = edgeT[n]; }
	for (let u = 1; u < N; u++) {
		const m = up < 0 ? u : N - 1 - u, mu = m + up;
		for (let n = 0; n < N; n++) {
			let f = n + r;
			f = f < 0 ? 0 : f > N - 1 ? N - 1 : f;
			const n0 = Math.min(N - 2, Math.floor(f)), w = f - n0;
			const k0 = at(mu, n0), k1 = at(mu, n0 + 1);
			// upstream, the higher of the ground there and what already shades it, as seen from here
			const s0 = S[k0] - T[k0] * bend, s1 = S[k1] - T[k1] * bend;
			const g0 = H[k0] >= s0, g1 = H[k1] >= s1;
			const e0 = g0 ? H[k0] : s0, e1 = g1 ? H[k1] : s1;
			const t0 = g0 ? 0 : T[k0], t1 = g1 ? 0 : T[k1];
			const k = at(m, n);
			S[k] = e0 + (e1 - e0) * w - fall;
			T[k] = t0 + (t1 - t0) * w + d;
		}
	}
}

// the march from a point past the grid toward the sun: the light's height over it, and how far
// off what casts it is. hs: the heights along the march (STEPS of them, at marchAt(k))
export const marchAt = (k) => CELL * Math.pow(GROW, k);
export function marchHills(hs, tanE) {
	let s = -1e9, t = 0;
	for (let k = 0; k < hs.length; k++) {
		const tk = marchAt(k), v = hs[k] - tk * tanE - tk * tk / (2 * R_LIGHT);
		if (v > s) { s = v; t = tk; }
	}
	return [s, t];
}

// a float's bits (as a Uint32Array reads them) to a half float's, rounded: three's own
// conversion took 2 ms a sweep on a laptop, too much for a phone (no tiny values or
// infinities come here: metres of height and distance)
export function half(x) {
	const sign = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112;
	if (e <= 0) return sign;
	if (e >= 31) return sign | 0x7bff;
	return sign | Math.min(0x7bff, ((e << 10) | ((x >>> 13) & 0x3ff)) + ((x >>> 12) & 1));
}

// ---------- the grid round you ----------
// heightAt(x, z): the ground as walked. renderer: to send each sweep to the graphics card.
// scene: the world's (only its renders take the hills' shade: the held weapon's scene and the
// portraits are lit by lights of their own, in frames of their own)
export function createHillSun({ heightAt, renderer, scene = null, isPhone = false }) {
	const N = HILL_N, NN = N * N;
	const budget = isPhone ? 2.5 : 4;          // ms a frame for the heights
	// the heights in use and the ones coming in, the sweep's results (as sent), and the edge
	let H = new Float32Array(NN), Hn = new Float32Array(NN);
	const S = new Float32Array(NN), T = new Float32Array(NN), edgeS = new Float32Array(N), edgeT = new Float32Array(N);
	const SU = new Uint32Array(S.buffer), TU = new Uint32Array(T.buffer);
	// the heights along each edge texel's march (N x STEPS), for the bearing they were taken on
	let EH = new Float32Array(N * STEPS), EHn = new Float32Array(N * STEPS);
	let grid = null, next = null, job = null, refillT = 0;
	let edgeFor = null;                        // { grid, xMajor, up, dx, dz } the edge heights are for
	let swept = null, sweptAt = -1e9, clock = 0, on = 0, shown = 0;
	const sweptDir = new THREE.Vector3();
	const ground = (x, z) => { const h = heightAt(x, z); return Number.isFinite(h) ? Math.max(h, 0) : 0; };
	const edgeTexel = (g, xMajor, up, n) => {
		// (the sunward column or row's n-th texel centre)
		const m = up < 0 ? 0 : N - 1;
		const i = xMajor ? m : n, j = xMajor ? n : m;
		return [g.x0 + (i + 0.5) * CELL, g.z0 + (j + 0.5) * CELL];
	};
	// a generator: the heights of a new grid (or the edge's marches), a slice a frame
	function* fill(g, dir) {
		let t0 = performance.now();
		if (!dir) {
			for (let j = 0; j < N; j++) {
				const z = g.z0 + (j + 0.5) * CELL;
				for (let i = 0; i < N; i++) Hn[j * N + i] = ground(g.x0 + (i + 0.5) * CELL, z);
				if (performance.now() - t0 > budget) { yield; t0 = performance.now(); }
			}
			const t = H; H = Hn; Hn = t;
			grid = g; edgeFor = null;
			return;
		}
		for (let n = 0; n < N; n++) {
			const [x, z] = edgeTexel(g, dir.xMajor, dir.up, n);
			for (let k = 0; k < STEPS; k++) { const tk = marchAt(k); EHn[n * STEPS + k] = ground(x + dir.dx * tk, z + dir.dz * tk); }
			if (performance.now() - t0 > budget) { yield; t0 = performance.now(); }
		}
		const t = EH; EH = EHn; EHn = t;
		edgeFor = { grid: g, ...dir };
	}
	function send() {
		for (let k = 0; k < NN; k++) { data[k * 2] = half(SU[k]); data[k * 2 + 1] = half(TU[k]); }
		tex.needsUpdate = true;
		try { renderer?.initTexture?.(tex); } catch { /* sent on its first draw instead */ }
	}
	function sweep(dx, dz, tanE) {
		const hs = new Float32Array(STEPS);
		for (let n = 0; n < N; n++) {
			for (let k = 0; k < STEPS; k++) hs[k] = EH[n * STEPS + k];
			const [s, t] = marchHills(hs, tanE);
			edgeS[n] = s; edgeT[n] = t;
		}
		sweepHills(H, N, CELL, dx, dz, tanE, edgeS, edgeT, S, T);
		send();
		swept = grid;
	}
	// each frame, after the sky: where you are, the light's direction (unit, toward it) and
	// whether it is the sun (not the moon)
	function update(dt, cam, dir, isSun) {
		clock += dt;
		const elev = dir.y, horiz = Math.hypot(dir.x, dir.z);
		const want = isSun && horiz > 1e-3 ? 1 - THREE.MathUtils.smoothstep(elev, ON_LO, ON_HI) : 0;
		if (want <= 0 && on <= 0) { shown = HILL_SUN.rect.w = 0; return; }
		const cx = cam.x, cz = cam.z;
		// a new grid when you have gone a good way from the middle of this one, or now and then
		// (the ground round you finishes loading after you arrive)
		refillT += dt;
		const far = !grid || Math.max(Math.abs(cx - (grid.x0 + HILL_SIZE / 2)), Math.abs(cz - (grid.z0 + HILL_SIZE / 2))) > HILL_SIZE * 0.17;
		if (!job && want > 0 && (far || refillT > 40)) {
			refillT = 0;
			const snap = CELL * 8;
			next = { x0: Math.round(cx / snap) * snap - HILL_SIZE / 2, z0: Math.round(cz / snap) * snap - HILL_SIZE / 2 };
			job = fill(next, null);
		}
		// the grid last swept (the one drawn) no longer round you, a jump across the map: no shade
		// until the new one is in
		const lost = !swept || Math.max(Math.abs(cx - (swept.x0 + HILL_SIZE / 2)), Math.abs(cz - (swept.z0 + HILL_SIZE / 2))) > HILL_SIZE * 0.36;
		// the march's heights along the bearing toward the sun, again when it has swung a degree
		const dx = dir.x / horiz, dz = dir.z / horiz, xMajor = Math.abs(dx) >= Math.abs(dz), up = (xMajor ? dx : dz) < 0 ? -1 : 1;
		if (!job && grid && want > 0 && (!edgeFor || edgeFor.grid !== grid || edgeFor.xMajor !== xMajor || edgeFor.up !== up || edgeFor.dx * dx + edgeFor.dz * dz < 0.99985)) job = fill(grid, { xMajor, up, dx, dz });
		if (job && job.next().done) job = null;
		const tanE = elev / Math.max(horiz, 1e-4);
		const ready = grid && edgeFor && edgeFor.grid === grid;
		// a sweep when there is a new grid or edge, or the sun has moved on: a half degree or so
		// across, or as much in height as the shader can carry on smoothly (every few seconds)
		if (ready && (swept !== grid || sweptDir.x * dx + sweptDir.z * dz < 0.99996 || Math.abs(tanE - HILL_SUN.tan.x) > 0.006 || clock - sweptAt > 3)) {
			sweep(edgeFor.dx, edgeFor.dz, tanE);
			sweptDir.set(dx, 0, dz); sweptAt = clock;
			HILL_SUN.tan.x = tanE;
			HILL_SUN.rect.x = grid.x0; HILL_SUN.rect.y = grid.z0;
		}
		HILL_SUN.tan.y = tanE;
		// eased in and out (a second); the last sweep is drawn while a new grid comes in
		const target = lost ? 0 : want;
		on = target > on ? Math.min(target, on + dt) : Math.max(target, on - dt);
		shown = lost ? 0 : on;
		HILL_SUN.rect.w = scene ? 0 : shown;
	}
	// the same on the CPU: how much of the sun reaches a point (x, y, z), 1 lit, 0 in the hills' shade
	function at(x, y, z) {
		const w = shown;
		if (w <= 0 || !swept) return 1;
		const u = (x - HILL_SUN.rect.x) / CELL - 0.5, v = (z - HILL_SUN.rect.y) / CELL - 0.5;
		const eu = Math.min(u + 0.5, N - 0.5 - u) / N, ev = Math.min(v + 0.5, N - 0.5 - v) / N;
		const edge = THREE.MathUtils.smoothstep(Math.min(eu, ev), 0, 0.1);
		if (edge <= 0) return 1;
		const i = Math.min(N - 2, Math.max(0, Math.floor(u))), j = Math.min(N - 2, Math.max(0, Math.floor(v)));
		const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j)), k = j * N + i;
		const bl = (A) => (A[k] * (1 - fu) + A[k + 1] * fu) * (1 - fv) + (A[k + N] * (1 - fu) + A[k + N + 1] * fu) * fv;
		const t = bl(T), s = bl(S) - t * (HILL_SUN.tan.y - HILL_SUN.tan.x), soft = HILL_SUN.tan.z + t * SUN_R;
		return 1 - w * edge * (1 - THREE.MathUtils.smoothstep(y + HILL_SUN.tan.w, s - soft, s + soft));
	}
	const before = scene?.onBeforeRender, after = scene?.onAfterRender;
	if (scene) {
		scene.onBeforeRender = function (...a) { HILL_SUN.rect.w = shown; return before.apply(this, a); };
		scene.onAfterRender = function (...a) { HILL_SUN.rect.w = 0; return after.apply(this, a); };
	}
	const info = () => ({ on: +shown.toFixed(3), grid: grid && [Math.round(grid.x0), Math.round(grid.z0)], busy: !!job, tanSwept: +HILL_SUN.tan.x.toFixed(4), tanNow: +HILL_SUN.tan.y.toFixed(4), sweptAgo: +(clock - sweptAt).toFixed(1) });
	function dispose() {
		job = null; grid = swept = null; shown = HILL_SUN.rect.w = 0;
		if (scene) { scene.onBeforeRender = before; scene.onAfterRender = after; }
	}
	return { update, at, info, dispose, params: HILL_SUN };
}
