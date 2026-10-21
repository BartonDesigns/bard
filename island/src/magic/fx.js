// What magic looks and sounds like: glowing motes drawn as points from two fixed pools, and hard
// strokes of light (sparks stretched along their flight, segments for lightning, a bolt's spear, a
// beam's core) from a third (nothing is made while you cast, no lights are added), and a short
// voice for each school, made on the
// world's sound bus (world/soundbus.js). The aether in the world (magic/aether.js) and the spells
// (magic/caster.js, each spell's own look in magic/looks.js) all draw through this.
//
// A point has a shape (SHAPE: a soft orb, a four-pointed star, a ring, a shard, a flame, a streak,
// a rune circle, a smoke puff, a pair of eyes, a cross, a hexagon, a leaf), turned by its own
// angle and spin. The glow pool adds light; the ink pool lays dark smoke over the scene (shadow,
// blight, a storm's clouds), which an additive glow alone cannot. Decals lay the same shapes flat on
// the ground (a sigil, a ripple, a shockwave, frost). A point that would fill much of
// the screen dims (and smoke right at the eye is not drawn), so a spell at your feet never washes
// out the view.

import * as THREE from 'three';
import { soundBus } from '../world/soundbus.js';
import { CHARGE } from './beam.js';

// colours (linear-ish, for the additive glow) by school, and the two strands
export const GLOW = {
	light: [1.0, 0.82, 0.42], dark: [0.55, 0.32, 1.0],
	radiance: [1.0, 0.78, 0.35], restoration: [0.45, 1.0, 0.62], warding: [0.55, 0.85, 1.0], dawn: [1.0, 0.9, 0.62],
	shadow: [0.6, 0.38, 1.0], void: [0.42, 0.34, 1.0], blight: [0.62, 0.95, 0.22], umbral: [0.78, 0.48, 1.0],
	storm: [0.5, 0.88, 1.0], chrono: [0.9, 0.82, 1.0], primal: [1.0, 0.5, 0.22], frost: [0.6, 0.9, 1.0],
};
export const SHAPE = { orb: 0, star: 1, ring: 2, shard: 3, flame: 4, streak: 5, rune: 6, smoke: 7, eyes: 8, cross: 9, hex: 10, leaf: 11 };

// the shapes, in the point's own frame (q: -1..1, y up), turned by its angle
const SPARK = { shape: 20 }, SEG = { shape: 21 };
const FRAG = `
varying vec4 vC; varying vec2 vK; varying float vF;
float sh(vec2 q, float k) {
	float r = length(q);
	if (k < 0.5) { float a = max(0.0, 1.0 - r); return a * a * a * 0.8 + smoothstep(0.34, 0.14, r) * 0.9; }
	if (k < 1.5) { float d = min(abs(q.x), abs(q.y)); float arms = max(0.0, 1.0 - r) * smoothstep(0.12, 0.0, d) * 1.3; float c = max(0.0, 1.0 - r * 2.2); return arms + c * c * 1.5; }
	if (k < 2.5) return smoothstep(0.07, 0.0, abs(r - 0.82)) * 1.4 + smoothstep(0.3, 0.0, abs(r - 0.78)) * 0.2;
	if (k < 3.5) { float m = abs(q.x) * 2.6 + abs(q.y); return smoothstep(1.0, 0.82, m) * (0.55 + 0.45 * smoothstep(0.75, 0.95, m)) + smoothstep(0.35, 0.0, m) * 0.6; }
	if (k < 4.5) { float t = q.y * 0.5 + 0.5; float w = 0.62 * pow(max(0.0, 1.0 - t), 0.8) * smoothstep(0.0, 0.35, t + 0.1); float a = smoothstep(0.08, 0.0, abs(q.x) - w); return a * (0.5 + 0.8 * (1.0 - t)) * (1.0 - smoothstep(0.75, 1.0, -q.y)); }
	if (k < 5.5) return smoothstep(0.09, 0.0, abs(q.x)) * max(0.0, 1.0 - q.y * q.y) * 1.3;
	if (k < 6.5) { float ring = smoothstep(0.1, 0.0, abs(r - 0.82)); float an = atan(q.y, q.x); float tick = smoothstep(0.86, 0.98, cos(an * 6.0)) * smoothstep(0.12, 0.0, abs(r - 0.6)); float inner = smoothstep(0.06, 0.0, abs(r - 0.42)) * 0.7; return (ring + tick + inner) * 1.1; }
	if (k < 7.5) { float a = max(0.0, 1.0 - r); return a * a * (0.75 + 0.25 * sin(q.x * 7.0 + q.y * 5.0)); }
	if (k < 8.5) { vec2 e = vec2(abs(q.x) - 0.42, q.y * 1.6); return smoothstep(0.32, 0.12, length(e)); }
	if (k < 9.5) { float d = min(abs(q.x), abs(q.y)); return smoothstep(0.26, 0.14, d) * smoothstep(0.95, 0.75, max(abs(q.x), abs(q.y))) + max(0.0, 1.0 - r * 1.8) * 0.4; }
	if (k < 10.5) { vec2 a = abs(q); float h = max(a.x * 0.866 + a.y * 0.5, a.y); return smoothstep(0.12, 0.0, abs(h - 0.78)) * 1.2 + smoothstep(0.78, 0.2, h) * 0.12; }
	vec2 e = vec2(q.x / 0.38, q.y); float l = length(e); return smoothstep(1.0, 0.85, l) * (0.6 + 0.4 * smoothstep(0.12, 0.0, abs(q.x))) ;
}
void main() {
	vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y;
	float c = cos(vK.y), s = sin(vK.y); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
	if (dot(p, p) > 1.0) discard;
	float a = sh(q, vK.x);
	if (a < 0.003) discard;
#ifdef INK
	gl_FragColor = vec4(vC.rgb, min(1.0, a) * vC.a * vF);
#else
	float hot = vK.x < 1.5 ? max(0.0, 1.0 - length(q) * 2.6) : 0.0;
	gl_FragColor = vec4((vC.rgb * a + vec3(hot * hot * 0.55)) * vC.a * vF, 1.0);
#endif
}`;
const VERT = 'attribute float size; attribute vec4 color; attribute vec2 kind; varying vec4 vC; varying vec2 vK; varying float vF; uniform float scale; void main(){ vC = color; vK = kind; vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = max(0.1, -mv.z); float px = size * scale / d; vF = 1.0 - 0.8 * smoothstep(60.0, 200.0, px); \n#ifdef INK\n vF *= smoothstep(0.7, 2.2, d); \n#else\n vF *= 0.25 + 0.75 * smoothstep(0.4, 2.5, d); \n#endif\n gl_PointSize = min(150.0, px); gl_Position = size > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0); }';

// (the decals: the same shapes laid flat on the ground, a sigil, a ripple, a shockwave, frost)
const DECAL_VERT = 'attribute vec4 iColor; attribute vec2 iKind; varying vec4 vC; varying vec2 vK; varying float vF; varying vec2 vUv; void main(){ vC = iColor; vK = iKind; vF = 1.0; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }';
const DECAL_FRAG = FRAG.replace('vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y;', 'vec2 p = vUv * 2.0 - 1.0;').replace('varying float vF;', 'varying float vF; varying vec2 vUv;');
// (the streaks: hard strokes of light, each a quad from a tail to a head turned to face you, a
// white-hot core and a sharp edge; a spark is stretched along its own flight, a segment stays put
// (lightning, a beam's core, a bolt's tracer). Where the points are glow, these are force.)
const STREAK_VERT = `attribute vec3 aA; attribute vec3 aB; attribute vec2 aK; attribute vec2 aW; attribute vec4 aC;
varying vec4 vC; varying vec2 vK; varying float vF;
void main() {
	vec4 a = modelViewMatrix * vec4(aA, 1.0), b = modelViewMatrix * vec4(aB, 1.0);
	vec3 d = b.xyz - a.xyz; float L = length(d);
	vec3 dir = L > 1e-4 ? d / L : vec3(0.0, 1.0, 0.0);
	vec3 p = mix(a.xyz, b.xyz, aK.x);
	vec3 sd = cross(dir, normalize(p + vec3(0.0, 0.0, -1e-3)));
	sd = length(sd) < 1e-3 ? vec3(1.0, 0.0, 0.0) : normalize(sd);
	float w = aW.x * mix(1.0, 0.15 + 0.85 * aK.x, aW.y);
	p += dir * (aK.x * 2.0 - 1.0) * aW.x * 0.6 + sd * aK.y * w;
	vF = 0.3 + 0.7 * smoothstep(0.4, 2.5, -p.z);
	vC = aC; vK = aK;
	gl_Position = aW.x > 0.0 ? projectionMatrix * vec4(p, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const STREAK_FRAG = `varying vec4 vC; varying vec2 vK; varying float vF;
void main() {
	float x = abs(vK.y), u = vK.x;
	float body = 1.0 - smoothstep(0.45, 1.0, x);
	float core = 1.0 - smoothstep(0.0, 0.32, x);
	float ends = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.9, u);
	float a = body * ends;
	if (a < 0.003) discard;
	gl_FragColor = vec4((vC.rgb * body * 1.15 + vec3(core * core * 0.85)) * ends * vC.a * vF, 1.0);
}`;
function streaks(scene, n) {
	const g = new THREE.BufferGeometry(), V = n * 4;
	const A = new Float32Array(V * 3), B = new Float32Array(V * 3), K = new Float32Array(V * 2), W = new Float32Array(V * 2), C = new Float32Array(V * 4), idx = new Uint32Array(n * 6);
	for (let i = 0; i < n; i++) {
		const v = i * 4;
		K.set([0, -1, 0, 1, 1, -1, 1, 1], v * 2);
		idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
	}
	const dyn = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
	// (three wants a position; the shader draws from aA and aB, so it is only there to be had)
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V * 3), 3));
	g.setAttribute('aA', dyn(A, 3)); g.setAttribute('aB', dyn(B, 3)); g.setAttribute('aK', new THREE.BufferAttribute(K, 2)); g.setAttribute('aW', dyn(W, 2)); g.setAttribute('aC', dyn(C, 4));
	g.setIndex(new THREE.BufferAttribute(idx, 1));
	const mat = new THREE.ShaderMaterial({ vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
	const mesh = new THREE.Mesh(g, mat);
	mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.name = 'magic-streaks';
	scene.add(mesh);
	const P = [];
	for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, seg: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, bx: 0, by: 0, bz: 0, g: 0, drag: 0, len: 0, w0: 0, w1: 0, r: 1, gC: 1, b: 1, a: 1, tail: 1 });
	let next = 0, was = 0;
	function take() { const p = P[next]; next = (next + 1) % n; return p; }
	function put(i, ax, ay, az, bx, by, bz, w, tail, r, gC, b, a) {
		for (let k = 0; k < 4; k++) {
			const v = i * 4 + k;
			A[v * 3] = ax; A[v * 3 + 1] = ay; A[v * 3 + 2] = az; B[v * 3] = bx; B[v * 3 + 1] = by; B[v * 3 + 2] = bz;
			W[v * 2] = w; W[v * 2 + 1] = tail; C[v * 4] = r; C[v * 4 + 1] = gC; C[v * 4 + 2] = b; C[v * 4 + 3] = a;
		}
	}
	function step(dt) {
		let live = 0;
		for (let i = 0; i < n; i++) {
			const p = P[i];
			if (p.life <= 0) { if (W[i * 8] !== 0) { put(i, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); live++; } continue; }
			live++;
			p.life -= dt;
			const u = 1 - Math.max(0, p.life) / p.max, w = p.life > 0 ? p.w0 + (p.w1 - p.w0) * u : 0, al = p.a * (1 - u * u);
			if (p.seg) { put(i, p.x, p.y, p.z, p.bx, p.by, p.bz, w, p.tail, p.r, p.gC, p.b, al); continue; }
			const k = Math.exp(-p.drag * dt);
			p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			// (the tail: where it was len seconds ago, never shorter than its own width)
			const sp = Math.hypot(p.vx, p.vy, p.vz), L = Math.max(w * 1.5, sp * p.len), q = sp > 1e-4 ? L / sp : 0;
			put(i, p.x - p.vx * q, p.y - p.vy * q, p.z - p.vz * q, p.x, p.y, p.z, w, p.tail, p.r, p.gC, p.b, al);
		}
		if (live || was) { const at = g.attributes; at.aA.needsUpdate = at.aB.needsUpdate = at.aW.needsUpdate = at.aC.needsUpdate = true; }
		was = live;
	}
	function clear() { for (const p of P) p.life = 0; }
	function dispose() { scene.remove(mesh); g.dispose(); mat.dispose(); }
	return { take, step, clear, dispose, mesh };
}

function decals(scene, n) {
	const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const iColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage), iKind = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage);
	geo.setAttribute('iColor', iColor); geo.setAttribute('iKind', iKind);
	const mat = new THREE.ShaderMaterial({ vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
	const mesh = new THREE.InstancedMesh(geo, mat, n);
	mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.name = 'magic-decals';
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), sc = new THREE.Vector3();
	m.makeScale(0, 0, 0);
	for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m);
	scene.add(mesh);
	const D = [];
	for (let i = 0; i < n; i++) D.push({ life: 0, max: 1, x: 0, y: 0, z: 0, r0: 1, r1: 1, c: [1, 1, 1], a: 1, k: 0, rot: 0, spin: 0 });
	let next = 0, live = 0;
	return {
		mesh, geo, mat,
		add(p, r0, r1, life, c, a, o) { const d = D[next]; next = (next + 1) % n; d.life = d.max = life; d.x = p.x; d.y = p.y + 0.06; d.z = p.z; d.r0 = r0; d.r1 = r1; d.c = c; d.a = a; d.k = o?.shape || 0; d.rot = o?.rot ?? Math.random() * 6.283; d.spin = o?.spin || 0; },
		step(dt) {
			let alive = 0;
			for (let i = 0; i < n; i++) {
				const d = D[i];
				if (d.life <= 0) { if (d.max) { d.max = 0; m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); alive++; } continue; }
				alive++;
				d.life -= dt; d.rot += d.spin * dt;
				const u = 1 - Math.max(0, d.life) / d.max, r = d.r0 + (d.r1 - d.r0) * (1 - (1 - u) * (1 - u));
				m.compose(at.set(d.x, d.y, d.z), q.setFromAxisAngle(up, 0), sc.set(r * 2, 1, r * 2)); mesh.setMatrixAt(i, m);
				iColor.setXYZW(i, d.c[0], d.c[1], d.c[2], d.a * (1 - u * u) * Math.min(1, u * 10 + 0.3)); iKind.setXY(i, d.k, d.rot);
			}
			if (alive || live) { mesh.instanceMatrix.needsUpdate = iColor.needsUpdate = iKind.needsUpdate = true; }
			live = alive;
		},
		clear() { for (const d of D) d.life = 0; },
	};
}

function pool(scene, n, ink, order) {
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n), kind = new Float32Array(n * 2);
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('kind', new THREE.BufferAttribute(kind, 2).setUsage(THREE.DynamicDrawUsage));
	const mat = new THREE.ShaderMaterial({
		uniforms: { scale: { value: 600 } }, vertexShader: VERT, fragmentShader: FRAG, defines: ink ? { INK: 1 } : {},
		transparent: true, depthWrite: false, blending: ink ? THREE.NormalBlending : THREE.AdditiveBlending,
	});
	const pts = new THREE.Points(g, mat);
	pts.frustumCulled = false; pts.renderOrder = order; pts.name = ink ? 'magic-ink' : 'magic-fx';
	scene.add(pts);
	const P = [];
	for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0.1, s1: 0.1, r: 1, gC: 1, b: 1, a: 1, k: 0, rot: 0, spin: 0 });
	return { g, mat, pts, pos, col, size, kind, P, n, next: 0, live: 0 };
}

// (onEmit: told of every point made, for the tests)
// Gargantua: a sphere of black, and over it, turned to the eye, one face of light painted after
// Interstellar's: a hair of white fire on the shadow's edge (the photon ring), the accretion disc
// seen edge-on as a blazing band through its heart that flares and dims outward, brighter on the
// side coming toward you, its near rim dipping across the shadow's lower half; the far side of the
// disc bent up over the top of the shadow into a broad halo, and a thinner one bent under; two
// white-hot points where the disc meets the ring; a warm ember haze and faint rays round it all.
// One group, made once and shown only while the spell lasts; a(1) is its strength, 0 gone.
// (all of it stops at the horizon: nothing of it below uCut, the eye's height, is drawn, so it
// stands behind the horizon and rises over it)
// The face is set a little in front of the sphere, toward the eye, and scaled to the sphere's
// silhouette there (wider than its radius once it is near: the rim is where the eye's sight
// grazes the sphere), so the painted ring hugs the black edge at every size, and the near rim of
// the disc crosses in front of the shadow.
const DISC_VERT = 'varying vec2 vP; varying float vY; void main(){ vP = position.xy; vY = (modelMatrix * vec4(position, 1.0)).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const CUT = 'uniform float uCut; varying float vY;';
const CORE_FRAG = `${CUT} void main(){ if (vY < uCut) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;
const FACE_W = 10, FACE_H = 5.6;
const FACE_FRAG = `${CUT} uniform float uT; uniform float uA; varying vec2 vP;
	void main(){
		if (vY < uCut) discard;
		vec2 p = vP; float r = length(p), x = p.x, y = p.y, ax = abs(x);
		// (the face's own edges, never seen: all of it fades out before them)
		float edge = (1.0 - smoothstep(4.0, 5.0, ax)) * (1.0 - smoothstep(2.0, 2.8, abs(y)));
		// the photon ring: a hair of white fire on the shadow's edge, a little orange heat outside it
		float ring = exp(-pow((r - 1.012) / 0.012, 2.0)) * 1.5, heat = exp(-pow((r - 1.035) / 0.05, 2.0)) * 0.35;
		// the disc, edge-on: a thin blazing band through the heart, its near rim dipping across the
		// shadow's lower half, flaring and dimming as it goes out, white-hot only along its core; the
		// side turning toward you (left) is the brighter (Doppler); it churns
		float yb = -0.3 * sqrt(max(0.0, 1.0 - x * x / 1.5));
		float thick = 0.07 + 0.1 * max(0.0, ax - 1.0), dy = y - yb;
		float band = exp(-pow(dy / thick, 2.0)), core = exp(-pow(dy / (thick * 0.3), 2.0));
		float reach = (1.0 - smoothstep(3.4, 4.6, ax)) / (1.0 + pow(max(0.0, ax - 1.0) * 0.5, 2.2));
		float dopp = 0.6 + 0.6 * smoothstep(1.6, -1.6, x);
		float churn = 0.78 + 0.22 * sin(x * 5.0 - uT * 3.2) * sin(x * 11.0 + y * 40.0 + uT * 1.7);
		float disc = band * reach * dopp * churn * 1.3, discHot = core * reach * dopp * 0.9;
		// the far side of the disc, bent up over the top into a broad halo hugging the shadow, and a
		// thinner arc bent under
		float up = smoothstep(-0.25, 0.45, y / max(r, 1e-4));
		float halo = exp(-pow((r - 1.1) / 0.25, 2.0)) * up * (0.92 + 0.08 * sin(atan(y, x) * 6.0 - uT * 0.8)) * 0.7;
		float under = exp(-pow((r - 1.05) / 0.1, 2.0)) * smoothstep(0.15, -0.6, y / max(r, 1e-4)) * 0.45;
		// the white-hot points where the disc meets the ring
		vec2 dl = p - vec2(-1.06, -0.06), dr = p - vec2(1.06, -0.06);
		float spots = exp(-dot(dl, dl) / 0.008) * 1.2 + exp(-dot(dr, dr) / 0.005) * 0.6;
		// the warm haze round it all, and faint rays thrown out across the sky
		float glow = 0.18 / pow(1.0 + (r - 1.0) * 2.4, 2.0) + 0.04 / (1.0 + r * 0.6);
		float an = atan(y, x);
		float rays = 0.09 * pow(0.5 + 0.5 * sin(an * 13.0 + sin(an * 3.0 + uT * 0.3) * 2.0), 8.0) * exp(-(r - 1.0) * 0.5) * smoothstep(1.0, 1.25, r);
		vec3 ember = vec3(1.0, 0.32, 0.06), orange = vec3(1.0, 0.56, 0.18), hot = vec3(1.0, 0.94, 0.82);
		float hin = exp(-max(0.0, r - 1.0) * 9.0);
		vec3 lit = hot * (ring + spots) + orange * heat + mix(orange, hot, hin) * halo + mix(ember, orange, 0.5) * under + ember * (glow + rays);
		vec3 discC = orange * disc + hot * discHot;
		// (over the shadow itself only the disc's near rim is drawn: the rest is the sphere's black)
		float inside = 1.0 - smoothstep(0.975, 1.0, r);
		vec3 c = mix(lit + discC, discC, inside);
		gl_FragColor = vec4(c * uA * edge, 1.0);
	}`;
function blackHole(scene) {
	const group = new THREE.Group();
	group.name = 'magic-gargantua'; group.visible = false;
	const cut = { value: -1e9 };
	const core = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.ShaderMaterial({ uniforms: { uCut: cut }, vertexShader: DISC_VERT, fragmentShader: CORE_FRAG }));
	const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, FACE_H), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCut: cut }, vertexShader: DISC_VERT, fragmentShader: FACE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
	core.renderOrder = 2; face.renderOrder = 3;
	group.add(core, face);
	scene.add(group);
	// (the sky going out: a dark dome round the eye, deepening as the hole fills more of the view, so
	// at its greatest the whole sky is gone, behind you too; what is near still stands in front of it)
	const veil = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a0302, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }));
	veil.name = 'magic-gargantua-veil'; veil.renderOrder = 1; veil.visible = false; veil.frustumCulled = false;
	scene.add(veil);
	const H = { a: 0, want: 0, seen: 0, t: 0, cover: 0 }, eye = new THREE.Vector3(), to = new THREE.Vector3(), lens = { p: group.position, r: 1, k: 0, cut: 0 };
	return {
		group,
		// shown at p, radius r (m), strength a, the face turned to e (the eye)
		set(p, r, a, e) {
			group.position.set(p.x, p.y, p.z); group.scale.setScalar(Math.max(0.01, r)); H.want = a; H.seen = 0;
			if (e) { eye.set(e.x, e.y, e.z); cut.value = e.y; }
			// (how much of the sky it takes, and so how far the day goes out: from when it spans ~6°
			// across (the sky dusks round it, so its light shows) to when it would span 70°, by when
			// the sky is all but gone)
			const ang = Math.asin(Math.min(1, r / Math.max(r, group.position.distanceTo(eye))));
			H.cover = Math.max(0, Math.min(1, (ang - 0.05) / 0.55));
		},
		step(dt) {
			H.t += dt; H.seen += dt;
			// (left unset for a second it goes out: a long frame must not blink it away)
			if (H.seen > 1.0) H.want = 0;
			H.a += (H.want - H.a) * Math.min(1, dt * 6);
			if (H.want === 0 && H.a < 0.01) H.a = 0;
			group.visible = H.a > 0;
			veil.visible = group.visible && H.cover > 0;
			if (veil.visible) { veil.position.copy(eye); veil.material.opacity = 0.94 * H.a * Math.pow(H.cover, 0.7); }
			if (!group.visible) return;
			const R = group.scale.x;
			core.scale.setScalar(Math.max(0.01, H.a));
			// (the face a little in front of the sphere, scaled to the sphere's silhouette on that plane)
			to.copy(eye).sub(group.position);
			const d = Math.max(to.length(), R * 1.12), ahead = Math.min(R * 1.02, d * 0.5), sil = (d - ahead) * R / Math.sqrt(d * d - R * R);
			face.position.copy(to).normalize().multiplyScalar(ahead / R);
			face.scale.setScalar(sil / R * Math.max(0.01, H.a));
			group.updateMatrixWorld(true);
			face.lookAt(eye);
			// (the light round its rim bent, above the horizon: magic/lens.js)
			lens.r = R * Math.max(0.01, H.a); lens.k = H.a; lens.cut = cut.value;
			face.material.uniforms.uA.value = H.a; face.material.uniforms.uT.value = H.t;
		},
		// (how dark it has made the world: 0 to 1, for the sun and the sky's light on the ground)
		darkness: () => (group.visible ? H.a * H.cover : 0),
		lens: () => (group.visible ? lens : null),
		clear() { H.a = H.want = 0; group.visible = veil.visible = false; },
		dispose() { scene.remove(group); scene.remove(veil); for (const m of [core, face, veil]) { m.geometry.dispose(); m.material.dispose(); } },
	};
}

export function createMagicFx(scene, { isPhone = false, onEmit = null } = {}) {
	const glow = pool(scene, isPhone ? 1400 : 3200, false, 4), ink = pool(scene, isPhone ? 300 : 700, true, 3), flat = decals(scene, isPhone ? 24 : 48);
	const gargantua = blackHole(scene);
	const streak = streaks(scene, isPhone ? 500 : 1600);
	// what is seen through walls (the sight spells): the glow, drawn over everything
	const xray = new THREE.Points(glow.g, glow.mat.clone());
	xray.material.depthTest = false; xray.frustumCulled = false; xray.renderOrder = 5; xray.visible = false;
	// one point: where, its velocity, its life (s), its size from s0 to s1 (m), colour, alpha,
	// gravity (m/s²), drag, and o: { shape, rot, spin, ink } (no o: a soft orb of light)
	function emit(x, y, z, vx, vy, vz, life, s0, s1, c, a = 1, grav = 0, drag = 1, o = null) {
		const L = o?.ink ? ink : glow, p = L.P[L.next]; L.next = (L.next + 1) % L.n;
		if (onEmit) onEmit(c, o);
		p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.r = c[0]; p.gC = c[1]; p.b = c[2]; p.a = a; p.g = grav; p.drag = drag;
		p.k = o?.shape || 0; p.rot = o?.rot ?? (o?.spin ? Math.random() * 6.283 : 0); p.spin = o?.spin ? o.spin * (Math.random() < 0.5 ? -1 : 1) : 0;
		return p;
	}
	// a spark: a hard stroke flying from x,y,z, stretched behind it over len seconds of its flight,
	// w wide (m) tapering to a needle at the tail
	function spark(x, y, z, vx, vy, vz, life, len, w, c, a = 1, grav = 0, drag = 1) {
		if (onEmit) onEmit(c, SPARK);
		const p = streak.take();
		p.seg = false; p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.g = grav; p.drag = drag; p.len = len; p.w0 = w; p.w1 = w * 0.4; p.r = c[0]; p.gC = c[1]; p.b = c[2]; p.a = a; p.tail = 1;
		return p;
	}
	// a segment: a hard stroke of light from a to b, held for its life (w: its width, m; taper 1: a
	// needle, thinning to a point at a)
	function seg(a, b, c, w, life, al = 1, taper = 0) {
		if (onEmit) onEmit(c, SEG);
		const p = streak.take();
		p.seg = true; p.life = p.max = life; p.x = a.x; p.y = a.y; p.z = a.z; p.bx = b.x; p.by = b.y; p.bz = b.z; p.w0 = w; p.w1 = w * 0.6; p.r = c[0]; p.gC = c[1]; p.b = c[2]; p.a = al; p.tail = taper;
		return p;
	}
	// a shape laid flat on the ground at p, its radius from r0 to r1 over its life (o: { shape, rot, spin })
	function decal(p, r0, r1, life, c, a = 1, o = null) { flat.add(p, r0, r1, life, c, a, o); if (onEmit) onEmit(c, o, true); }
	// a puff of n points out from a place, at speed v
	function burst(at, c, n = 12, v = 3, life = 0.6, s = 0.18, up = 0.5, o = null) {
		for (let k = 0; k < n; k++) {
			const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.6, sp = v * (0.4 + Math.random() * 0.8);
			emit(at.x, at.y, at.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp, life * (0.6 + Math.random() * 0.6), s, s * 0.2, c, 1, 0, 2, o);
		}
		// (and hard sparks flung out ahead of it, faster than the glow and falling)
		if (!o?.ink) for (let k = Math.ceil(n * 0.6); k > 0; k--) {
			const a = Math.random() * 6.283, e = (Math.random() - 0.2) * 1.4, sp = v * (1.2 + Math.random() * 1.4);
			spark(at.x, at.y, at.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp, life * (0.35 + Math.random() * 0.35), 0.045, Math.max(0.025, s * 0.3), c, 1, 6, 3);
		}
	}
	// a ring of points on the ground spreading to r
	function ring(at, r, c, n = 40, life = 0.7, s = 0.3, o = null) {
		for (let k = 0; k < n; k++) {
			const a = k / n * 6.283, v = r / life;
			emit(at.x, at.y + 0.15, at.z, Math.cos(a) * v, 0.2, Math.sin(a) * v, life, s, s * 0.4, c, 0.9, 0, 0.6, o);
			// (a shockwave's front: hard dashes racing out)
			if (!o?.ink && k % 2 === 0) spark(at.x, at.y + 0.2, at.z, Math.cos(a) * v * 1.25, 0.1, Math.sin(a) * v * 1.25, life * 0.8, 0.07, Math.max(0.04, s * 0.35), c, 1, 0, 1.2);
		}
	}
	// a line of points from a to b (a beam's sheath, a bolt of lightning), jagged if j > 0
	function line(a, b, c, step = 0.6, life = 0.12, s = 0.22, j = 0, o = null) {
		const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
		// (the stroke itself: one hard segment, or a jagged run of them)
		if (!o?.ink) {
			const m = j > 0 ? Math.max(2, Math.min(12, Math.ceil(L / 1.2))) : 1;
			let px = a.x, py = a.y, pz = a.z;
			for (let k = 1; k <= m; k++) {
				const u = k / m, w = k === m ? 0 : j * Math.sin(u * Math.PI);
				const q = { x: a.x + dx * u + (Math.random() - 0.5) * w, y: a.y + dy * u + (Math.random() - 0.5) * w, z: a.z + dz * u + (Math.random() - 0.5) * w };
				seg({ x: px, y: py, z: pz }, q, c, s * 0.42, life * 1.1);
				px = q.x; py = q.y; pz = q.z;
			}
		}
		// (its glow: sparser points along it)
		const n = Math.max(2, Math.min(160, Math.ceil(L / (o?.ink ? step : step * 2))));
		for (let k = 0; k <= n; k++) {
			const u = k / n, w = j * Math.sin(u * Math.PI);
			emit(a.x + dx * u + (Math.random() - 0.5) * w, a.y + dy * u + (Math.random() - 0.5) * w, a.z + dz * u + (Math.random() - 0.5) * w, 0, 0, 0, life * (0.7 + Math.random() * 0.6), s, s * 0.5, c, 1, 0, 0, o);
		}
	}
	// lightning: a jagged path from a to b in kinks, with a branch or two
	function bolt(a, b, c, life = 0.2, s = 0.18, kinks = 8, jag = 1.2, branches = 2, o = null) {
		let px = a.x, py = a.y, pz = a.z;
		const pts = [];
		for (let k = 1; k <= kinks; k++) {
			const u = k / kinks, w = k === kinks ? 0 : jag;
			const x = a.x + (b.x - a.x) * u + (Math.random() - 0.5) * w, y = a.y + (b.y - a.y) * u + (Math.random() - 0.5) * w, z = a.z + (b.z - a.z) * u + (Math.random() - 0.5) * w;
			line({ x: px, y: py, z: pz }, { x, y, z }, c, s * 1.6, life, s, 0, o);
			pts.push({ x, y, z }); px = x; py = y; pz = z;
		}
		for (let n = 0; n < branches && pts.length > 2; n++) {
			const q = pts[1 + Math.floor(Math.random() * (pts.length - 2))], L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * 0.25;
			line(q, { x: q.x + (Math.random() - 0.5) * L, y: q.y - Math.random() * L * 0.6, z: q.z + (Math.random() - 0.5) * L }, c, s * 1.6, life * 0.8, s * 0.7, jag * 0.4, o);
		}
	}
	// a column of light falling or rising at a place
	function pillar(at, h, c, n = 50, life = 0.8, s = 0.5, up = true, o = null) {
		for (let k = 0; k < n; k++) {
			const a = Math.random() * 6.283, r = Math.random() * 0.8;
			emit(at.x + Math.cos(a) * r, at.y + (up ? 0 : h) + Math.random() * 0.5, at.z + Math.sin(a) * r, 0, (up ? 1 : -1) * h / life * (0.6 + Math.random() * 0.6), 0, life, s, s * 0.3, c, 1, 0, 0, o);
			if (!o?.ink && k % 2 === 0) spark(at.x + Math.cos(a) * r * 0.7, at.y + (up ? 0 : h), at.z + Math.sin(a) * r * 0.7, 0, (up ? 1 : -1) * h / life * (0.9 + Math.random() * 0.5), 0, life * 0.8, 0.09, Math.max(0.05, s * 0.3), c, 1, 0, 0);
		}
	}
	// points standing still on a circle of radius r (a ground sigil's rim), turned by phase
	function circle(at, r, c, n = 24, life = 0.3, s = 0.25, phase = 0, o = null, y = 0.1) {
		for (let k = 0; k < n; k++) { const a = phase + k / n * 6.283; emit(at.x + Math.cos(a) * r, at.y + y, at.z + Math.sin(a) * r, 0, 0, 0, life, s, s, c, 1, 0, 0, o); }
	}
	// a swirl: n points on a spiral round at, drawn in (in) or flung out
	function spiral(at, r, c, n = 24, life = 0.6, s = 0.22, arms = 3, inward = true, o = null) {
		for (let k = 0; k < n; k++) {
			const u = Math.random(), a = (k % arms) / arms * 6.283 + u * 4, rr = r * (inward ? 1 - u * 0.2 : 0.2 + u * 0.2);
			const x = at.x + Math.cos(a) * rr, z = at.z + Math.sin(a) * rr, tx = -Math.sin(a), tz = Math.cos(a), v = r / life * 1.4;
			const rad = inward ? -1 : 1;
			emit(x, at.y + (Math.random() - 0.5) * 0.4, z, (tx * 0.9 + Math.cos(a) * rad * 0.7) * v, 0, (tz * 0.9 + Math.sin(a) * rad * 0.7) * v, life, s, s * 0.3, c, 1, 0, 1.2, o);
			if (!o?.ink && k % 3 === 0) spark(x, at.y, z, (tx * 0.9 + Math.cos(a) * rad * 0.7) * v, 0, (tz * 0.9 + Math.sin(a) * rad * 0.7) * v, life * 0.7, 0.06, Math.max(0.035, s * 0.25), c, 1, 0, 1.2);
		}
	}
	function step(L, dt) {
		let live = 0;
		for (let i = 0; i < L.n; i++) {
			const p = L.P[i];
			if (p.life <= 0) { if (L.size[i] !== 0) { L.size[i] = 0; live++; } continue; }
			live++;
			p.life -= dt;
			const k = Math.exp(-p.drag * dt);
			p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
			const u = 1 - Math.max(0, p.life) / p.max;
			L.pos[i * 3] = p.x; L.pos[i * 3 + 1] = p.y; L.pos[i * 3 + 2] = p.z;
			L.size[i] = p.life > 0 ? p.s0 + (p.s1 - p.s0) * u : 0;
			L.col[i * 4] = p.r; L.col[i * 4 + 1] = p.gC; L.col[i * 4 + 2] = p.b; L.col[i * 4 + 3] = p.a * (1 - u * u) * Math.min(1, u * 12 + 0.25);
			L.kind[i * 2] = p.k; L.kind[i * 2 + 1] = p.rot;
		}
		// (nothing alive, nothing to send)
		if (live || L.live) { const A = L.g.attributes; A.position.needsUpdate = A.color.needsUpdate = A.size.needsUpdate = A.kind.needsUpdate = true; }
		L.live = live;
	}
	// (the black hole bending the light round its rim this frame, for magic/lens.js)
	const bent = [];
	function lenses() { bent.length = 0; const g = gargantua.lens(); if (g) bent.push(g); return bent; }
	// (Gargantua's ending on the whole frame, from T s, its life: from three quarters in the colours
	// invert, then drain to grey, then go black; two seconds of black, then the world bursts back)
	const G = { t: -1, T: 10, inv: 0, grey: 0, black: 0, burst: 0 };
	const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
	function gradeFrom(T) { G.t = 0; G.T = T; }
	function stepGrade(dt) {
		if (G.t < 0) return;
		const x = (G.t += dt), T = G.T, a = T * 0.75, b = a + T * 0.1, c = b + T * 0.1, d = c + 0.3, e = d + 2, f = e + 1.4;
		G.inv = ramp(x, a, b) * (1 - ramp(x, d, d + 0.01));
		G.grey = ramp(x, b, c) * (1 - ramp(x, e, e + 0.01));
		G.black = ramp(x, c, d) * (1 - ramp(x, e, e + 0.06));
		G.burst = x >= e ? Math.pow(1 - ramp(x, e, f), 2) : 0;
		if (x > f) { G.t = -1; G.inv = G.grey = G.black = G.burst = 0; }
	}
	const grade = () => (G.t >= 0 ? G : null);
	function update(dt, xrayOn = false) {
		step(glow, dt); step(ink, dt); streak.step(dt); flat.step(dt); gargantua.step(dt); stepGrade(dt);
		if (xrayOn && !xray.parent) scene.add(xray);
		xray.visible = xrayOn;
	}
	function resize(h, fov) { glow.mat.uniforms.scale.value = ink.mat.uniforms.scale.value = xray.material.uniforms.scale.value = h / 2 / Math.tan((fov * Math.PI) / 360); }
	function clear() { for (const p of glow.P) p.life = 0; for (const p of ink.P) p.life = 0; streak.clear(); flat.clear(); gargantua.clear(); G.t = -1; G.inv = G.grey = G.black = G.burst = 0; }
	function dispose() { for (const L of [glow, ink]) { scene.remove(L.pts); L.g.dispose(); L.mat.dispose(); } scene.remove(xray); xray.material.dispose(); scene.remove(flat.mesh); flat.geo.dispose(); flat.mat.dispose(); streak.dispose(); gargantua.dispose(); }
	// (the black hole, kept alive by calling this each step: where, radius, strength, the eye)
	const hole = (p, r, a = 1, e = null) => gargantua.set(p, r, a, e);
	// (a hit's weight: a white-hot core and its colour flaring out where it lands, k 0 to 1 by how
	// hard; the hardest of a frame is kept for the view's own kick and flash, taken by takeFlash)
	let felt = null;
	const WHITE = [1, 0.97, 0.9], RING = { shape: SHAPE.ring };
	function flash(p, c, k = 0.5) {
		k = Math.max(0.05, Math.min(1, k));
		emit(p.x, p.y, p.z, 0, 0, 0, 0.07, 0.5 + 1.4 * k, 0.9 + 2 * k, WHITE, 0.9);
		emit(p.x, p.y, p.z, 0, 0, 0, 0.18, 1 + 2.5 * k, 2 + 5 * k, c, 0.55);
		// (a starburst of hard rays, and a ring of force snapping out)
		for (let n = 4 + Math.round(6 * k); n > 0; n--) {
			const a = Math.random() * 6.283, e = (Math.random() - 0.4) * 1.5, sp = 18 + 26 * k * Math.random();
			spark(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp, 0.09 + 0.08 * k, 0.03, 0.05 + 0.07 * k, n % 2 ? WHITE : c, 1, 0, 6);
		}
		emit(p.x, p.y, p.z, 0, 0, 0, 0.16 + 0.1 * k, 0.4, 1.6 + 3.5 * k, c, 0.9, 0, 0, RING);
		if (!felt || k > felt.k) felt = { x: p.x, y: p.y, z: p.z, c, k };
	}
	const takeFlash = () => { const f = felt; felt = null; return f; };
	const darkness = () => gargantua.darkness();
	return { emit, spark, seg, burst, darkness, ring, line, bolt, pillar, circle, spiral, decal, hole, lenses, grade, gradeFrom, flash, takeFlash, update, resize, clear, dispose, points: glow.pts, ink: ink.pts };
}

// ---------- the voices ----------
// a short sound for a school's casting, a hit, gathering fabric, a fizzle; quiet, synthesised
const VOICE = {
	radiance: { f: 880, f2: 1320, type: 'triangle' }, restoration: { f: 660, f2: 990, type: 'sine' }, warding: { f: 520, f2: 780, type: 'sine' }, dawn: { f: 990, f2: 1480, type: 'sine' },
	shadow: { f: 220, f2: 140, type: 'sawtooth' }, void: { f: 160, f2: 60, type: 'sawtooth' }, blight: { f: 190, f2: 240, type: 'square' }, umbral: { f: 260, f2: 130, type: 'triangle' },
	storm: { f: 120, f2: 2400, type: 'sawtooth' }, chrono: { f: 740, f2: 370, type: 'sine' }, primal: { f: 300, f2: 180, type: 'square' },
	// (the skills of the body, and a level gained: magic/skills-ui.js)
	marksman: { f: 440, f2: 660, type: 'triangle' }, athletics: { f: 587, f2: 880, type: 'sine' }, resilience: { f: 330, f2: 495, type: 'triangle' }, level: { f: 523, f2: 1047, type: 'sine' },
};
export function magicSound(kind, gain = 0.12) {
	try {
		const bus = soundBus(); if (!bus) return;
		const C = bus.ctx, t = C.currentTime, o = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), f = C.createBiquadFilter();
		const V = VOICE[kind] || (kind === 'gather' ? { f: 1175, f2: 1568, type: 'sine' } : kind === 'fizzle' ? { f: 300, f2: 200, type: 'triangle' } : VOICE.radiance);
		o.type = V.type; o2.type = 'sine';
		o.frequency.setValueAtTime(V.f, t); o.frequency.exponentialRampToValueAtTime(V.f2, t + 0.25);
		o2.frequency.setValueAtTime(V.f * 1.5, t); o2.frequency.exponentialRampToValueAtTime(V.f2 * 1.5, t + 0.3);
		f.type = 'lowpass'; f.frequency.value = kind === 'storm' ? 5000 : 2600;
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'gather' ? 0.7 : kind === 'level' ? 1.4 : 0.45));
		o.connect(f); o2.connect(f); f.connect(g); g.connect(bus.out);
		o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
		o.onended = () => { o.disconnect(); o2.disconnect(); f.disconnect(); g.disconnect(); };
	} catch { /* no sound here */ }
}

// a beam's voice: a whine rising as it gathers (CHARGE), then a roar, rushing air and a low hum,
// for as long as it pours. returns { stop() } (it dies away), or null where there is no sound
const noises = new WeakMap();
function noiseOf(C) {
	let b = noises.get(C);
	if (!b) { b = C.createBuffer(1, C.sampleRate, C.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noises.set(C, b); }
	return b;
}
// Gargantua's voice: a rumble under everything, a low drone with the air roaring over it, rising
// as it grows over T seconds, and swallowed with a drop as it closes. returns { stop() }, or null
export function holeVoice(T = 10) {
	try {
		const bus = soundBus(); if (!bus) return null;
		const C = bus.ctx, t = C.currentTime, full = t + T * 0.85;
		const hum = C.createOscillator(), hum2 = C.createOscillator(), lp = C.createBiquadFilter(), n = C.createBufferSource(), bp = C.createBiquadFilter(), out = C.createGain();
		hum.type = 'sawtooth'; hum.frequency.setValueAtTime(44, t); hum.frequency.exponentialRampToValueAtTime(30, full);
		hum2.type = 'sine'; hum2.frequency.setValueAtTime(33, t); hum2.frequency.exponentialRampToValueAtTime(22, full);
		lp.type = 'lowpass'; lp.frequency.setValueAtTime(90, t); lp.frequency.exponentialRampToValueAtTime(420, full); lp.Q.value = 2;
		n.buffer = noiseOf(C); n.loop = true;
		bp.type = 'bandpass'; bp.frequency.setValueAtTime(70, t); bp.frequency.exponentialRampToValueAtTime(240, full); bp.Q.value = 0.5;
		hum.connect(lp); hum2.connect(lp); lp.connect(out); n.connect(bp); bp.connect(out); out.connect(bus.out);
		out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.05, t + 0.6); out.gain.exponentialRampToValueAtTime(0.26, full);
		hum.start(t); hum2.start(t); n.start(t);
		let done = false;
		return {
			stop() {
				if (done) return;
				done = true;
				const s = C.currentTime;
				out.gain.cancelScheduledValues(s); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), s); out.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
				lp.frequency.cancelScheduledValues(s); lp.frequency.setValueAtTime(Math.max(30, lp.frequency.value), s); lp.frequency.exponentialRampToValueAtTime(30, s + 0.4);
				hum.stop(s + 0.55); hum2.stop(s + 0.55); n.stop(s + 0.55);
				hum.onended = () => { hum.disconnect(); hum2.disconnect(); lp.disconnect(); n.disconnect(); bp.disconnect(); out.disconnect(); };
			},
		};
	} catch { return null; }
}

export function beamVoice(kind) {
	try {
		const bus = soundBus(); if (!bus) return null;
		const C = bus.ctx, t = C.currentTime, V = VOICE[kind] || VOICE.radiance, go = t + CHARGE;
		const w = C.createOscillator(), wg = C.createGain();
		w.type = 'sine';
		w.frequency.setValueAtTime(V.f * 0.35, t); w.frequency.exponentialRampToValueAtTime(V.f * 1.6, go);
		wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.06, go - 0.03); wg.gain.exponentialRampToValueAtTime(0.0001, go + 0.08);
		w.connect(wg); wg.connect(bus.out); w.start(t); w.stop(go + 0.1);
		w.onended = () => { w.disconnect(); wg.disconnect(); };
		const n = C.createBufferSource(), bp = C.createBiquadFilter(), hum = C.createOscillator(), lp = C.createBiquadFilter(), out = C.createGain();
		n.buffer = noiseOf(C); n.loop = true;
		bp.type = 'bandpass'; bp.frequency.value = Math.max(300, Math.min(1400, V.f)); bp.Q.value = 0.7;
		hum.type = 'sawtooth'; hum.frequency.value = Math.max(40, Math.min(110, V.f / 4));
		lp.type = 'lowpass'; lp.frequency.value = 650;
		n.connect(bp); bp.connect(out); hum.connect(lp); lp.connect(out); out.connect(bus.out);
		// (silent while it gathers; a crack as it lets go, settling to a roar)
		out.gain.setValueAtTime(0.0001, t); out.gain.setValueAtTime(0.0001, go);
		out.gain.exponentialRampToValueAtTime(0.22, go + 0.03); out.gain.exponentialRampToValueAtTime(0.11, go + 0.45);
		n.start(t); hum.start(t);
		let done = false;
		return {
			stop() {
				if (done) return;
				done = true;
				const s = C.currentTime;
				out.gain.cancelScheduledValues(s); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), s); out.gain.exponentialRampToValueAtTime(0.0001, s + 0.25);
				n.stop(s + 0.3); hum.stop(s + 0.3);
				hum.onended = () => { n.disconnect(); bp.disconnect(); hum.disconnect(); lp.disconnect(); out.disconnect(); };
			},
		};
	} catch { return null; }
}
