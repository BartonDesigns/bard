// Crysis fish: every species is grown from its genome. The body is lofted from a
// profile (deep-bodied tangs, slim jacks, needle-snouted butterflyfish), fins and
// tail are cut to the genome's shape, and the pattern (bands, stripes, spots,
// saddles, eyespots, masks, counter-shading) is painted in the shader from the body's
// own coordinates. Each species is one instanced draw. Behaviour follows the niche:
// planktivores hang in clouds over the coral heads, grazers work the bottom in small
// groups, butterflyfish pair up round the heads, bait balls wheel in open water,
// predators patrol and everything small gives them room, rays glide over the sand.

import * as THREE from 'three';

const hsl = (a) => new THREE.Color().setHSL(a[0], a[1], a[2]);
const PAT = { plain: 0, bands: 1, stripes: 2, spots: 3, gradient: 4, saddle: 5, eyespot: 6, mask: 7 };

// ---------- the body ----------
function bodyGeometry(g) {
	const P = [], U = [], V = [], T = [], F = [], I = [];
	const push = (x, y, z, u, v, tail, fin) => { P.push(x, y, z); U.push(u); V.push(v); T.push(tail); F.push(fin); return P.length / 3 - 1; };
	const ray = g.niche === 'ray';
	const SIDES = ray ? 10 : 8, RINGS = 12, L0 = -0.5, L1 = ray ? 0.2 : 0.3;
	// height and width along the body (t from nose 0 to tail root 1)
	const hAt = (t) => {
		const nose = Math.pow(Math.min(1, t / (0.18 + g.snout * 0.2)), 0.55 + g.snout * 0.6);
		const tail = 1 - Math.pow(Math.max(0, (t - 0.55) / 0.45), 1.4) * 0.82;
		return g.depthR * 0.5 * nose * tail;
	};
	const wAt = (t) => ray ? (0.62 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.02) : hAt(t) * g.widthR * 1.4 + 0.004;
	const rings = [];
	for (let k = 0; k <= RINGS; k++) {
		const t = k / RINGS, z = L0 + t * (L1 - L0), h = Math.max(0.004, hAt(t)), w = wAt(t);
		const row = [];
		for (let s = 0; s < SIDES; s++) {
			const a = s / SIDES * Math.PI * 2, cy = Math.cos(a), cx = Math.sin(a);
			const y = ray ? cy * 0.05 * (1 - Math.abs(cx)) + cy * 0.015 : cy * h;
			row.push(push(cx * w, y, z, t * 0.8, ray ? cy : cy, Math.pow(t, 2) * 0.6, ray ? Math.abs(cx) : 0));
		}
		rings.push(row);
	}
	const tip = push(0, 0, L0 - 0.01, 0, 0, 0, 0);
	for (let s = 0; s < SIDES; s++) I.push(tip, rings[0][(s + 1) % SIDES], rings[0][s]);
	for (let k = 0; k < RINGS; k++) for (let s = 0; s < SIDES; s++) {
		const a = rings[k][s], b = rings[k][(s + 1) % SIDES], c = rings[k + 1][s], d = rings[k + 1][(s + 1) % SIDES];
		I.push(a, b, c, b, d, c);
	}
	const endRing = rings[RINGS], endC = push(0, 0, L1, 0.8, 0, 0.6, 0);
	for (let s = 0; s < SIDES; s++) I.push(endRing[s], endRing[(s + 1) % SIDES], endC);
	// a fin as a strip between two edges; fins sway with the tail and take the accent
	const fin = (pts) => {                      // pts: [[x,y,z,u,v,tail], ...] outline, fanned from the first
		const b = P.length / 3;
		for (const p of pts) push(p[0], p[1], p[2], p[3], p[4], p[5], 1);
		for (let i = 1; i < pts.length - 1; i++) I.push(b, b + i, b + i + 1);
	};
	if (!ray) {
		// dorsal: rises from the back between a third and the tail root
		const dH = g.dorsal * g.depthR * 0.45;
		const d0 = 0.28, d1 = 0.85, steps = 6;
		for (let i = 0; i < steps; i++) {
			const ta = d0 + (d1 - d0) * i / steps, tb = d0 + (d1 - d0) * (i + 1) / steps;
			const za = L0 + ta * (L1 - L0), zb = L0 + tb * (L1 - L0);
			const ha = hAt(ta), hb = hAt(tb), fa = dH * Math.sin(Math.PI * (i / steps) * 0.9 + 0.2), fb = dH * Math.sin(Math.PI * ((i + 1) / steps) * 0.9 + 0.2);
			fin([[0, ha * 0.95, za, ta * 0.8, 1, ta * ta * 0.6], [0, ha + fa, za + 0.02, ta * 0.8, 1.3, ta * ta * 0.6 + 0.1], [0, hb + fb, zb + 0.02, tb * 0.8, 1.3, tb * tb * 0.6 + 0.1], [0, hb * 0.95, zb, tb * 0.8, 1, tb * tb * 0.6]]);
		}
		// anal fin
		const aH = dH * 0.6;
		fin([[0, -hAt(0.6) * 0.95, L0 + 0.6 * (L1 - L0), 0.5, -1, 0.3], [0, -hAt(0.7) - aH, L0 + 0.72 * (L1 - L0), 0.58, -1.3, 0.4], [0, -hAt(0.85) * 0.95, L0 + 0.85 * (L1 - L0), 0.68, -1, 0.5]]);
		// pectorals, a little behind the gills, one each side
		for (const sd of [-1, 1]) {
			const t = 0.3, z = L0 + t * (L1 - L0), w = wAt(t) * sd, y = -hAt(t) * 0.25;
			fin([[w, y, z, 0.24, 0, 0.05], [w + sd * 0.1, y - 0.03, z + 0.12, 0.3, 0, 0.15], [w + sd * 0.05, y + 0.02, z + 0.14, 0.3, 0, 0.15]]);
		}
	}
	// the tail, shaped by the genome
	const ts = g.tailSize * (ray ? 0.25 : 1), zt = L1, th = hAt(1) * 0.9;
	const tailSway = 1;
	if (g.tail === 'fork') fin([[0, 0, zt - 0.02, 0.8, 0, 0.6], [0, th + 0.22 * ts * g.depthR * 1.6, zt + 0.24 * ts, 1, 0.8, tailSway], [0, 0.03, zt + 0.1 * ts, 1, 0, tailSway], [0, -th - 0.22 * ts * g.depthR * 1.6, zt + 0.24 * ts, 1, -0.8, tailSway]]);
	else if (g.tail === 'lunate') fin([[0, 0, zt - 0.02, 0.8, 0, 0.6], [0, th + 0.26 * ts * g.depthR * 1.5, zt + 0.2 * ts, 1, 0.8, tailSway], [0, 0.05, zt + 0.12 * ts, 1, 0.1, tailSway], [0, -0.05, zt + 0.12 * ts, 1, -0.1, tailSway], [0, -th - 0.26 * ts * g.depthR * 1.5, zt + 0.2 * ts, 1, -0.8, tailSway]]);
	else if (g.tail === 'whip') fin([[0, 0.01, zt, 0.8, 0, 0.5], [0, 0, zt + 0.9, 1, 0, tailSway], [0, -0.01, zt, 0.8, 0, 0.5]]);
	else {
		// round or square: a fan
		const pts = [[0, 0, zt - 0.02, 0.8, 0, 0.6]], n = 6, spread = g.depthR * 0.5 * ts;
		for (let i = 0; i <= n; i++) { const a = (i / n - 0.5) * 2, round = g.tail === 'round' ? Math.cos(a * 1.2) : 1; pts.push([0, a * (th + spread), zt + 0.18 * ts * round, 1, a * 0.8, tailSway]); }
		fin(pts);
	}
	const geo = new THREE.InstancedBufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	geo.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1));
	geo.setAttribute('aV', new THREE.Float32BufferAttribute(V, 1));
	geo.setAttribute('aTail', new THREE.Float32BufferAttribute(T, 1));
	geo.setAttribute('aFin', new THREE.Float32BufferAttribute(F, 1));
	geo.setIndex(I);
	geo.computeVertexNormals();
	return geo;
}

// ---------- the skin ----------
function skinMaterial(g, shared) {
	const m = new THREE.MeshStandardMaterial({ roughness: g.niche === 'bait' ? 0.25 : 0.45, metalness: g.shimmer * 0.6, side: THREE.DoubleSide });
	const uni = {
		uTime: shared.uTime, uBass: shared.uBass,
		uBase: { value: hsl(g.base) }, uAccent: { value: hsl(g.accent) }, uBelly: { value: hsl(g.belly) },
		uPat: { value: PAT[g.pattern] }, uFreq: { value: g.patternFreq }, uRay: { value: g.niche === 'ray' ? 1 : 0 }, uWave: { value: g.niche === 'ray' ? 3 : 10 + 6 / Math.max(0.3, g.len * 4) },
	};
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uni);
		sh.vertexShader = 'attribute float aU, aV, aTail, aFin, aPhase; uniform float uTime, uRay, uWave; varying float vU, vV, vFin;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vU = aU; vV = aV; vFin = aFin;
			if (uRay > 0.5) {
				// rays fly: the wings rise and fall in a wave running back
				transformed.y += sin(uTime * uWave + aPhase - position.z * 3.0) * 0.12 * aFin * aFin;
				transformed.x += sin(uTime * 4.0 + aPhase - position.z * 5.0) * 0.05 * aTail * aTail;
			} else {
				// the swim: a wave down the body, biggest at the tail
				transformed.x += sin(uTime * uWave + aPhase - position.z * 6.0) * 0.07 * aTail * aTail;
			}`);
		sh.fragmentShader = 'uniform vec3 uBase, uAccent, uBelly; uniform float uPat, uFreq; varying float vU, vV, vFin;\nfloat fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				// counter-shaded: dark back, pale belly
				vec3 c = mix(uBelly, uBase, smoothstep(-0.7, 0.2, vV));
				c *= 0.85 + 0.25 * smoothstep(0.0, 1.0, vV);
				float p = 0.0;
				if (uPat < 0.5) p = 0.0;
				else if (uPat < 1.5) p = step(0.62, fract(vU * uFreq)) * step(0.12, vU);                         // bands
				else if (uPat < 2.5) p = step(0.6, fract(vV * uFreq * 0.7 + 0.3));                               // stripes
				else if (uPat < 3.5) { vec2 q = vec2(vU * uFreq * 2.2, vV * uFreq); vec2 f = fract(q) - 0.5; p = step(length(f), 0.22) * step(0.4, fh(floor(q))); }   // spots
				else if (uPat < 4.5) p = smoothstep(0.1, 0.9, vU) * 0.8;                                         // gradient
				else if (uPat < 5.5) p = step(0.35, vV) * step(fract(vU * 2.4 + 0.2), 0.45);                     // saddles
				else if (uPat < 6.5) { float d = length(vec2((vU - 0.62) * 3.0, vV - 0.35)); p = smoothstep(0.26, 0.2, d) - smoothstep(0.14, 0.1, d) * 0.9; p = max(p, 0.0) + smoothstep(0.1, 0.06, d); }   // eyespot
				else p = step(0.07, vU) * step(vU, 0.16);                                                         // mask
				c = mix(c, uAccent, clamp(p, 0.0, 1.0));
				// fins: the accent, paler at the edge
				c = mix(c, mix(uAccent, uBase, 0.4) * 1.15, vFin * 0.85);
				// the eye
				float eye = smoothstep(0.035, 0.02, length(vec2((vU - 0.07) * 1.2, vV - 0.28)));
				c = mix(c, vec3(0.02), eye * (1.0 - vFin));
				diffuseColor.rgb *= c;
			}`);
	};
	m.customProgramCacheKey = () => 'crysisfish' + g.niche;
	return m;
}

// ---------- schools ----------
export function createFish(eco, island, shared, scene, camera, bommies = []) {
	const bay = island.village.bay;
	const group = new THREE.Group();
	group.name = 'crysis-fish';
	scene.add(group);
	if (!bay) return { update() {}, group, count: 0 };
	const H = (x, z) => island.heightAt(x, z);
	const rnd = ((s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(island.seed ^ 0xf15b);
	const randomBommie = () => bommies[Math.floor(Math.random() * bommies.length)];
	const inBay = (rr) => { const a = Math.random() * 6.283, t = rr * Math.sqrt(Math.random()); return { x: bay.x + Math.cos(a) * t * bay.r, z: bay.z + Math.sin(a) * t * bay.r }; };

	const schools = [], boids = [], meshes = [];
	for (const g of eco.fish) {
		const nSchools = { planktivore: 4, grazer: 4, butterfly: 6, bait: 2, predator: 1, ray: 2 }[g.niche] || 1;
		const n = nSchools * Math.max(1, g.school);
		const geo = bodyGeometry(g);
		const phase = new Float32Array(n);
		const im = new THREE.InstancedMesh(geo, skinMaterial(g, shared), n);
		im.frustumCulled = false;
		const tone = new THREE.Color();
		let k = 0;
		for (let sI = 0; sI < nSchools; sI++) {
			const school = { g, goal: new THREE.Vector3(), timer: 0, center: new THREE.Vector3(), vel: new THREE.Vector3(), n: 0 };
			pickGoal(school, true);
			schools.push(school);
			for (let i = 0; i < g.school; i++, k++) {
				const p = school.goal.clone().add(new THREE.Vector3((rnd() - 0.5) * 4, (rnd() - 0.5) * 2, (rnd() - 0.5) * 4));
				boids.push({ p, v: new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5), school, im, i: k, size: g.len * (0.8 + rnd() * 0.4) });
				phase[k] = rnd() * 6.28;
				im.setColorAt(k, tone.setScalar(0.88 + rnd() * 0.24));
			}
		}
		geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
		im.userData.material175 = 'crystal';
		group.add(im);
		meshes.push(im);
	}

	// where each kind goes next
	function pickGoal(s, first) {
		const g = s.g;
		if ((g.home === 'heads' || g.home === 'bottom') && bommies.length) {
			// hop to a nearby head (the first time, any head)
			let best = randomBommie();
			if (!first) { let bd = 1e9; for (let j = 0; j < 6; j++) { const b = randomBommie(), d = Math.hypot(b.x - s.center.x, b.z - s.center.z); if (d < bd && d > 2) { bd = d; best = b; } } }
			const y = g.home === 'heads' ? Math.min(-1.5, best.h + 2 + Math.random() * 1.8) : Math.min(-1.4, best.h + 0.6 + Math.random() * 0.8);
			s.goal.set(best.x + (Math.random() - 0.5) * 4, y, best.z + (Math.random() - 0.5) * 4);
		} else {
			const q = inBay(g.home === 'open' ? 0.8 : 1.05), fl = H(q.x, q.z);
			const y = g.home === 'glide' ? fl + 0.7 : g.home === 'patrol' ? Math.min(-2, fl + 1.5 + Math.random() * 3) : Math.min(-1.8, fl + 2 + Math.random() * Math.max(0.5, -fl - 4));
			s.goal.set(q.x, y, q.z);
		}
		s.timer = (g.home === 'patrol' || g.home === 'glide' ? 14 : 7) + Math.random() * 10;
	}

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), dir = new THREE.Vector3(), acc = new THREE.Vector3();
	const look = new THREE.Matrix4();
	const predators = schools.filter((s) => s.g.niche === 'predator');
	let lastBass = 0;
	function update(dt, t, active) {
		group.visible = active;
		if (!active) return;
		dt = Math.min(dt, 0.05);
		const bass = shared.uBass.value, beat = bass > 0.55 && lastBass <= 0.55;
		lastBass = bass;
		for (const s of schools) { s.timer -= dt; if (s.timer <= 0) pickGoal(s, false); s.center.set(0, 0, 0); s.vel.set(0, 0, 0); s.n = 0; }
		for (const b of boids) { b.school.center.add(b.p); b.school.vel.add(b.v); b.school.n++; }
		for (const s of schools) { s.center.divideScalar(s.n); s.vel.divideScalar(s.n); }
		const cam = camera.position;
		for (let i = 0; i < boids.length; i++) {
			const b = boids[i], s = b.school, g = s.g;
			acc.set(0, 0, 0);
			const solo = g.school <= 1;
			if (!solo) {
				// cohesion (tighter on the beat), alignment
				acc.addScaledVector(dir.copy(s.center).sub(b.p), beat ? 1.8 : g.niche === 'bait' ? 0.6 : 0.35);
				acc.addScaledVector(dir.copy(s.vel).sub(b.v), 0.9);
			}
			acc.addScaledVector(dir.copy(s.goal).sub(solo ? b.p : s.center).setLength(1), solo ? 1.2 : 0.9);
			// separation from a few neighbours
			if (!solo) for (let j = 1; j <= 3; j++) {
				const o = boids[(i + j * 7) % boids.length];
				if (o.school !== s) continue;
				dir.copy(b.p).sub(o.p); const d = dir.length(), min = b.size * 3;
				if (d < min && d > 1e-3) acc.addScaledVector(dir, (min - d) * 8 / d);
			}
			// give the swimmer, and the hunters, room
			let fleeing = false;
			dir.copy(b.p).sub(cam); const dc = dir.length();
			if (g.shy > 0 && dc < g.shy) { acc.addScaledVector(dir, (g.shy - dc) * 5 / Math.max(dc, 0.3)); fleeing = true; }
			if (g.niche !== 'predator' && g.niche !== 'ray') for (const pr of predators) {
				dir.copy(b.p).sub(pr.center); const d = dir.length();
				if (d < 5) { acc.addScaledVector(dir, (5 - d) * 4 / Math.max(d, 0.3)); fleeing = true; }
			}
			// stay in the water, off the floor
			const fl = H(b.p.x, b.p.z), floorGap = g.niche === 'ray' ? 0.35 : 0.5;
			if (b.p.y < fl + floorGap) acc.y += (fl + floorGap - b.p.y) * 6;
			if (b.p.y > -1.3) acc.y -= (b.p.y + 1.3) * 6;
			b.v.addScaledVector(acc, dt);
			const sp = b.v.length(), max = (fleeing ? 3 : 1) * g.speed * (solo ? 0.9 : 1.2), min = g.speed * 0.25;
			if (sp > max) b.v.multiplyScalar(max / sp); else if (sp < min) b.v.multiplyScalar(min / Math.max(sp, 1e-3));
			b.p.addScaledVector(b.v, dt);
			// face along the motion (nose is -z); rays stay level
			if (g.niche === 'ray') dir.copy(b.v).setY(b.v.y * 0.2); else dir.copy(b.v);
			look.lookAt(b.p, dir.add(b.p), up);
			q.setFromRotationMatrix(look);
			sc.setScalar(b.size);
			b.im.setMatrixAt(b.i, m4.compose(b.p, q, sc));
		}
		for (const im of meshes) im.instanceMatrix.needsUpdate = true;
	}
	return { update, group, count: boids.length };
}
