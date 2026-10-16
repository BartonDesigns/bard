// What magic looks and sounds like: glowing motes drawn as points from two fixed pools (nothing
// is made while you cast, no lights are added), and a short voice for each school, made on the
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

// colours (linear-ish, for the additive glow) by school, and the two strands
export const GLOW = {
	light: [1.0, 0.82, 0.42], dark: [0.55, 0.32, 1.0],
	radiance: [1.0, 0.78, 0.35], restoration: [0.45, 1.0, 0.62], warding: [0.55, 0.85, 1.0], dawn: [1.0, 0.9, 0.62],
	shadow: [0.6, 0.38, 1.0], void: [0.42, 0.34, 1.0], blight: [0.62, 0.95, 0.22], umbral: [0.78, 0.48, 1.0],
	storm: [0.5, 0.88, 1.0], chrono: [0.9, 0.82, 1.0], primal: [1.0, 0.5, 0.22], frost: [0.6, 0.9, 1.0],
};
export const SHAPE = { orb: 0, star: 1, ring: 2, shard: 3, flame: 4, streak: 5, rune: 6, smoke: 7, eyes: 8, cross: 9, hex: 10, leaf: 11 };

// the shapes, in the point's own frame (q: -1..1, y up), turned by its angle
const FRAG = `
varying vec4 vC; varying vec2 vK; varying float vF;
float sh(vec2 q, float k) {
	float r = length(q);
	if (k < 0.5) { float a = max(0.0, 1.0 - r * r); return a * a; }
	if (k < 1.5) { float d = min(abs(q.x), abs(q.y)); float arms = max(0.0, 1.0 - r) * smoothstep(0.22, 0.0, d); float c = max(0.0, 1.0 - r * 2.2); return arms + c * c * 1.5; }
	if (k < 2.5) return smoothstep(0.16, 0.0, abs(r - 0.78)) * 1.2;
	if (k < 3.5) { float m = abs(q.x) * 2.6 + abs(q.y); return smoothstep(1.0, 0.82, m) * (0.55 + 0.45 * smoothstep(0.75, 0.95, m)) + smoothstep(0.35, 0.0, m) * 0.6; }
	if (k < 4.5) { float t = q.y * 0.5 + 0.5; float w = 0.62 * pow(max(0.0, 1.0 - t), 0.8) * smoothstep(0.0, 0.35, t + 0.1); float a = smoothstep(0.08, 0.0, abs(q.x) - w); return a * (0.5 + 0.8 * (1.0 - t)) * (1.0 - smoothstep(0.75, 1.0, -q.y)); }
	if (k < 5.5) return smoothstep(0.16, 0.0, abs(q.x)) * max(0.0, 1.0 - q.y * q.y);
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
const VERT = 'attribute float size; attribute vec4 color; attribute vec2 kind; varying vec4 vC; varying vec2 vK; varying float vF; uniform float scale; void main(){ vC = color; vK = kind; vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = max(0.1, -mv.z); float px = size * scale / d; vF = 1.0 - 0.75 * smoothstep(90.0, 300.0, px); \n#ifdef INK\n vF *= smoothstep(0.7, 2.2, d); \n#endif\n gl_PointSize = min(180.0, px); gl_Position = size > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0); }';

// (the decals: the same shapes laid flat on the ground, a sigil, a ripple, a shockwave, frost)
const DECAL_VERT = 'attribute vec4 iColor; attribute vec2 iKind; varying vec4 vC; varying vec2 vK; varying float vF; varying vec2 vUv; void main(){ vC = iColor; vK = iKind; vF = 1.0; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }';
const DECAL_FRAG = FRAG.replace('vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y;', 'vec2 p = vUv * 2.0 - 1.0;').replace('varying float vF;', 'varying float vF; varying vec2 vUv;');
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
// Gargantua: a sphere of black, its accretion disc tipped a little toward you, and the light of the
// far side of the disc bent round the sphere into a halo that always faces the eye. One group, made
// once and shown only while the spell lasts; a(1) is its strength, 0 gone.
const DISC_VERT = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DISC_FRAG = `uniform float uT; uniform float uA; uniform float uIn; uniform float uOut; varying vec2 vP;
	void main(){
		float r = length(vP), a = atan(vP.y, vP.x), u = (r - uIn) / (uOut - uIn);
		float streak = 0.6 + 0.4 * sin(a * 7.0 + r * 3.0 - uT * 2.2) * sin(a * 3.0 - r * 1.7 + uT * 1.3);
		float hot = exp(-u * 4.0), edge = smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.75, 1.0, u));
		vec3 c = mix(vec3(1.0, 0.52, 0.18), vec3(1.0, 0.95, 0.85), hot);
		gl_FragColor = vec4(c * (0.5 + 1.8 * hot) * streak * edge * uA, 1.0);
	}`;
const HALO_FRAG = `uniform float uA; uniform float uIn; uniform float uOut; varying vec2 vP;
	void main(){
		float u = (length(vP) - uIn) / (uOut - uIn);
		float ring = exp(-u * 9.0) + 0.35 * exp(-u * 2.5);
		vec3 c = mix(vec3(1.0, 0.6, 0.25), vec3(1.0, 0.97, 0.9), exp(-u * 6.0));
		gl_FragColor = vec4(c * ring * smoothstep(0.0, 0.02, u) * uA, 1.0);
	}`;
function blackHole(scene) {
	const group = new THREE.Group();
	group.name = 'magic-gargantua'; group.visible = false;
	const ringMat = (frag, rIn, rOut) => new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uIn: { value: rIn }, uOut: { value: rOut } }, vertexShader: DISC_VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
	const core = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
	const disc = new THREE.Mesh(new THREE.RingGeometry(1.2, 3.2, 128, 1), ringMat(DISC_FRAG, 1.2, 3.2));
	disc.rotation.x = -Math.PI / 2 + 0.16;
	const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.9, 128, 1), ringMat(HALO_FRAG, 1.0, 1.9));
	core.renderOrder = 2; disc.renderOrder = halo.renderOrder = 3;
	group.add(core, disc, halo);
	scene.add(group);
	const H = { a: 0, want: 0, seen: 0, t: 0 }, eye = new THREE.Vector3();
	return {
		group,
		// shown at p, radius r (m), strength a, the halo turned to face e (the eye)
		set(p, r, a, e) { group.position.set(p.x, p.y, p.z); group.scale.setScalar(Math.max(0.01, r)); H.want = a; H.seen = 0; if (e) eye.set(e.x, e.y, e.z); },
		step(dt) {
			H.t += dt; H.seen += dt;
			if (H.seen > 0.35) H.want = 0;
			H.a += (H.want - H.a) * Math.min(1, dt * 6);
			if (H.want === 0 && H.a < 0.01) H.a = 0;
			group.visible = H.a > 0;
			if (!group.visible) return;
			halo.lookAt(eye);
			core.scale.setScalar(Math.max(0.01, H.a));
			for (const m of [disc.material, halo.material]) { m.uniforms.uA.value = H.a; m.uniforms.uT.value = H.t; }
		},
		clear() { H.a = H.want = 0; group.visible = false; },
		dispose() { scene.remove(group); for (const m of [core, disc, halo]) { m.geometry.dispose(); m.material.dispose(); } },
	};
}

export function createMagicFx(scene, { isPhone = false, onEmit = null } = {}) {
	const glow = pool(scene, isPhone ? 1400 : 3200, false, 4), ink = pool(scene, isPhone ? 300 : 700, true, 3), flat = decals(scene, isPhone ? 24 : 48);
	const gargantua = blackHole(scene);
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
	// a shape laid flat on the ground at p, its radius from r0 to r1 over its life (o: { shape, rot, spin })
	function decal(p, r0, r1, life, c, a = 1, o = null) { flat.add(p, r0, r1, life, c, a, o); if (onEmit) onEmit(c, o, true); }
	// a puff of n points out from a place, at speed v
	function burst(at, c, n = 12, v = 3, life = 0.6, s = 0.18, up = 0.5, o = null) {
		for (let k = 0; k < n; k++) {
			const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.6, sp = v * (0.4 + Math.random() * 0.8);
			emit(at.x, at.y, at.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp, life * (0.6 + Math.random() * 0.6), s, s * 0.2, c, 1, 0, 2, o);
		}
	}
	// a ring of points on the ground spreading to r
	function ring(at, r, c, n = 40, life = 0.7, s = 0.3, o = null) {
		for (let k = 0; k < n; k++) {
			const a = k / n * 6.283, v = r / life;
			emit(at.x, at.y + 0.15, at.z, Math.cos(a) * v, 0.2, Math.sin(a) * v, life, s, s * 0.4, c, 0.9, 0, 0.6, o);
		}
	}
	// a line of points from a to b (a beam's sheath, a bolt of lightning), jagged if j > 0
	function line(a, b, c, step = 0.6, life = 0.12, s = 0.22, j = 0, o = null) {
		const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz), n = Math.max(2, Math.min(160, Math.ceil(L / step)));
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
	function update(dt, xrayOn = false) {
		step(glow, dt); step(ink, dt); flat.step(dt); gargantua.step(dt);
		if (xrayOn && !xray.parent) scene.add(xray);
		xray.visible = xrayOn;
	}
	function resize(h, fov) { glow.mat.uniforms.scale.value = ink.mat.uniforms.scale.value = xray.material.uniforms.scale.value = h / 2 / Math.tan((fov * Math.PI) / 360); }
	function clear() { for (const p of glow.P) p.life = 0; for (const p of ink.P) p.life = 0; flat.clear(); gargantua.clear(); }
	function dispose() { for (const L of [glow, ink]) { scene.remove(L.pts); L.g.dispose(); L.mat.dispose(); } scene.remove(xray); xray.material.dispose(); scene.remove(flat.mesh); flat.geo.dispose(); flat.mat.dispose(); gargantua.dispose(); }
	// (the black hole, kept alive by calling this each step: where, radius, strength, the eye)
	const hole = (p, r, a = 1, e = null) => gargantua.set(p, r, a, e);
	return { emit, burst, ring, line, bolt, pillar, circle, spiral, decal, hole, update, resize, clear, dispose, points: glow.pts, ink: ink.pts };
}

// ---------- the voices ----------
// a short sound for a school's casting, a hit, gathering fabric, a fizzle; quiet, synthesised
const VOICE = {
	radiance: { f: 880, f2: 1320, type: 'triangle' }, restoration: { f: 660, f2: 990, type: 'sine' }, warding: { f: 520, f2: 780, type: 'sine' }, dawn: { f: 990, f2: 1480, type: 'sine' },
	shadow: { f: 220, f2: 140, type: 'sawtooth' }, void: { f: 160, f2: 60, type: 'sawtooth' }, blight: { f: 190, f2: 240, type: 'square' }, umbral: { f: 260, f2: 130, type: 'triangle' },
	storm: { f: 120, f2: 2400, type: 'sawtooth' }, chrono: { f: 740, f2: 370, type: 'sine' }, primal: { f: 300, f2: 180, type: 'square' },
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
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'gather' ? 0.7 : 0.45));
		o.connect(f); o2.connect(f); f.connect(g); g.connect(bus.out);
		o.start(t); o2.start(t); o.stop(t + 0.8); o2.stop(t + 0.8);
		o.onended = () => { o.disconnect(); o2.disconnect(); f.disconnect(); g.disconnect(); };
	} catch { /* no sound here */ }
}
