// Crysis land animals, grown from the land ecology's genomes and kept as small pools
// around the player: butterflies that go from flower to flower and settle with their
// wings slowly opening and closing, songbirds that hop about on the ground and fly up
// into the crowns when you come near, a flock of lorikeets crossing the island, sandpipers
// running the swash line, ghost crabs on the beach (more at night) that bolt and vanish
// into their burrows, lizards basking on rocks that dart off. One instanced draw per
// species; wings and legs move in the vertex shader.

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// a small geometry builder with per-vertex colour and the two animation channels:
// aWing (-1..1: which side, 0 for the body) and aLeg (legs and tails that wiggle)
class Body {
	constructor() { this.p = []; this.c = []; this.w = []; this.l = []; this.i = []; }
	v(p, c, w = 0, l = 0) { this.p.push(p.x, p.y, p.z); this.c.push(c[0], c[1], c[2]); this.w.push(w); this.l.push(l); return this.p.length / 3 - 1; }
	tri(a, b, c) { this.i.push(a, b, c); }
	quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
	ellipsoid(c, rx, ry, rz, col, w = 0, l = 0, rows = 5, cols = 8) {
		const ids = [];
		for (let j = 0; j <= rows; j++) {
			const ph = j / rows * Math.PI, row = [];
			for (let i = 0; i <= cols; i++) { const th = i / cols * Math.PI * 2; row.push(this.v(V(c.x + Math.sin(ph) * Math.cos(th) * rx, c.y + Math.cos(ph) * ry, c.z + Math.sin(ph) * Math.sin(th) * rz), col, w, l)); }
			ids.push(row);
		}
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { this.tri(ids[j][i], ids[j + 1][i], ids[j][i + 1]); this.tri(ids[j][i + 1], ids[j + 1][i], ids[j + 1][i + 1]); }
	}
	stick(a, b, r, col, l = 0) {
		const d = b.clone().sub(a).normalize(), s = Math.abs(d.y) > 0.9 ? V(1, 0, 0) : d.clone().cross(V(0, 1, 0)).normalize(), u = s.clone().cross(d);
		const ring = (c) => [0, 1, 2].map((k) => { const t = k / 3 * Math.PI * 2; return this.v(c.clone().add(s.clone().multiplyScalar(Math.cos(t) * r)).add(u.clone().multiplyScalar(Math.sin(t) * r)), col, 0, l); });
		const A = ring(a), B = ring(b);
		for (let k = 0; k < 3; k++) this.quad(A[k], A[(k + 1) % 3], B[(k + 1) % 3], B[k]);
	}
	geometry() {
		const g = new THREE.InstancedBufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
		g.setAttribute('aWing', new THREE.Float32BufferAttribute(this.w, 1));
		g.setAttribute('aLeg', new THREE.Float32BufferAttribute(this.l, 1));
		g.setIndex(this.i);
		g.computeVertexNormals();
		return g;
	}
}

function butterflyGeo(g) {
	const b = new Body(), W = g.wing, E = g.edge;
	b.ellipsoid(V(0, 0, 0), 0.06, 0.06, 0.45, [0.08, 0.07, 0.06], 0, 0, 3, 5);
	for (const sd of [-1, 1]) {
		// forewing and hindwing: a fan from the body to an outline, pale inside, edged
		const fw = [[0, -0.25], [0.9, -0.55], [1.1, -0.2], [0.95, 0.05], [0, 0.05]];
		const hw = [[0, 0.02], [0.75, 0.15], [0.65, 0.5], [0.25, 0.55], [0, 0.3]];
		for (const shape of [fw, hw]) {
			const c = b.v(V(0, 0, shape === fw ? -0.1 : 0.15), W, sd);
			const ids = shape.map(([x, z], k) => b.v(V(sd * x, 0, z), k === 0 || k === shape.length - 1 ? W : E, sd));
			for (let k = 0; k < ids.length - 1; k++) b.tri(c, ids[k], ids[k + 1]);
		}
		// an eyespot on the hindwing
		const sp = b.v(V(sd * 0.45, 0.005, 0.32), E, sd);
		const ring = [0, 1, 2, 3, 4, 5].map((k) => b.v(V(sd * (0.45 + Math.cos(k / 6 * 6.28) * 0.09), 0.005, 0.32 + Math.sin(k / 6 * 6.28) * 0.09), E, sd));
		for (let k = 0; k < 6; k++) b.tri(sp, ring[k], ring[(k + 1) % 6]);
	}
	return b.geometry();
}
function birdGeo(g) {
	const b = new Body(), B = g.body, Hd = g.head, dark = B.map((c) => c * 0.6);
	b.ellipsoid(V(0, 0, 0.05), 0.32, 0.3, 0.55, B);
	b.ellipsoid(V(0, 0.22, -0.45), 0.2, 0.2, 0.2, Hd);
	// beak
	const bt = b.v(V(0, 0.2, -0.85), [0.9, 0.7, 0.3]), b1 = b.v(V(-0.05, 0.24, -0.62), [0.8, 0.6, 0.25]), b2 = b.v(V(0.05, 0.24, -0.62), [0.8, 0.6, 0.25]), b3 = b.v(V(0, 0.15, -0.62), [0.8, 0.6, 0.25]);
	b.tri(bt, b1, b2); b.tri(bt, b2, b3); b.tri(bt, b3, b1);
	// eyes
	for (const sd of [-1, 1]) b.ellipsoid(V(sd * 0.15, 0.28, -0.55), 0.035, 0.035, 0.035, [0.02, 0.02, 0.02], 0, 0, 2, 4);
	// tail
	const t0 = b.v(V(-0.12, 0.05, 0.5), dark), t1 = b.v(V(0.12, 0.05, 0.5), dark), t2 = b.v(V(0.2, 0.12, 1.1), dark, 0, 1), t3 = b.v(V(-0.2, 0.12, 1.1), dark, 0, 1);
	b.quad(t0, t1, t2, t3);
	// wings: folded along the body at rest, spread and beating in flight (aWing)
	for (const sd of [-1, 1]) {
		const r0 = b.v(V(sd * 0.25, 0.15, -0.2), dark, sd), r1 = b.v(V(sd * 0.25, 0.15, 0.35), dark, sd), tip = b.v(V(sd * 1.1, 0.15, 0.2), dark.map((c) => c * 0.8), sd), mid = b.v(V(sd * 0.9, 0.15, -0.15), dark, sd);
		b.tri(r0, mid, tip); b.tri(r0, tip, r1);
	}
	// legs
	for (const sd of [-1, 1]) b.stick(V(sd * 0.1, -0.2, 0.05), V(sd * 0.1, -0.5, 0.0), 0.02, [0.3, 0.25, 0.2], 1);
	return b.geometry();
}
function crabGeo(g) {
	const b = new Body(), C = g.colour, D = C.map((c) => c * 0.8);
	b.ellipsoid(V(0, 0.25, 0), 0.6, 0.25, 0.5, C);
	for (const sd of [-1, 1]) {
		for (let k = 0; k < 4; k++) {
			const z = -0.3 + k * 0.2, knee = V(sd * 0.95, 0.5, z * 1.3), foot = V(sd * 1.3, 0, z * 1.6);
			b.stick(V(sd * 0.45, 0.25, z), knee, 0.05, D, 1); b.stick(knee, foot, 0.04, D, 1);
		}
		// claws and stalked eyes
		b.ellipsoid(V(sd * 0.45, 0.3, -0.7), 0.18, 0.14, 0.22, D, 0, 1, 3, 5);
		b.stick(V(sd * 0.2, 0.4, -0.35), V(sd * 0.25, 0.75, -0.4), 0.03, D);
		b.ellipsoid(V(sd * 0.25, 0.78, -0.4), 0.07, 0.09, 0.07, [0.05, 0.05, 0.05], 0, 0, 2, 4);
	}
	return b.geometry();
}
function lizardGeo(g) {
	const b = new Body(), C = g.colour, S = g.stripe ? [Math.min(1, C[0] * 1.8), Math.min(1, C[1] * 1.6), Math.min(1, C[2] * 1.2)] : C;
	b.ellipsoid(V(0, 0.08, -0.55), 0.1, 0.08, 0.15, C, 0, 0, 3, 6);                     // head
	b.ellipsoid(V(0, 0.09, -0.15), 0.13, 0.08, 0.32, C, 0, 0.3, 3, 6);                   // body
	b.ellipsoid(V(0, 0.12, -0.15), 0.04, 0.02, 0.3, S, 0, 0.3, 2, 4);                    // back stripe
	// tail: tapering, it swings most
	let prev = V(0, 0.08, 0.15);
	for (let k = 1; k <= 5; k++) { const p = V(0, 0.05, 0.15 + k * 0.17); b.stick(prev, p, 0.06 * (1 - k / 6) + 0.01, C, k / 5 + 0.3); prev = p; }
	for (const sd of [-1, 1]) for (const z of [-0.35, 0.05]) { const knee = V(sd * 0.22, 0.12, z - 0.05), foot = V(sd * 0.3, 0, z - 0.12); b.stick(V(sd * 0.08, 0.08, z), knee, 0.025, C, 1); b.stick(knee, foot, 0.02, C, 1); }
	return b.geometry();
}

function animalMaterial(shared, flap, key) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uFlap = { value: flap };
		sh.vertexShader = 'attribute float aWing, aLeg, aAmp, aPh; uniform float uTime, uFlap;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			if (aWing != 0.0) {
				// wings hinge on the body: aAmp is how hard they beat (0 folded or still)
				float ang = aAmp * (0.55 + 0.75 * sin(uTime * uFlap + aPh)) + (1.0 - min(aAmp, 1.0)) * 0.25;
				float r = abs(transformed.x);
				transformed.y += r * sin(ang);
				transformed.x = sign(transformed.x) * r * cos(ang);
			}
			// legs and tails: a quick scurry when running, a slow sway when not
			transformed.x += aLeg * sin(uTime * (4.0 + aAmp * 22.0) + aPh + transformed.z * 6.0) * (0.02 + aAmp * 0.05);`);
	};
	m.customProgramCacheKey = () => 'animal' + key;
	return m;
}

export function createLandFauna(land, island, shared, scene, camera, vegetation) {
	const group = new THREE.Group();
	group.name = 'crysis-land-fauna';
	scene.add(group);
	const H = (x, z) => island.heightAt(x, z);
	const rnd = Math.random;
	const pools = [];

	// ---------- where things are, from the vegetation index ----------
	const CELL = 64;
	const near = (keys, x, z, R) => {
		const out = [], ci = Math.floor(x / CELL), cj = Math.floor(z / CELL), cr = Math.ceil(R / CELL);
		for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
			const c = vegetation.cells.get(i + ',' + j);
			if (!c) continue;
			for (const k of keys) for (const it of c.items[k] || []) if (Math.hypot(it.x - x, it.z - z) < R) out.push({ it, k });
		}
		return out;
	};
	const treeKeys = vegetation.species.filter((s) => s.tree).map((s) => s.key);
	const treeTop = (o) => { const sp = vegetation.species.find((s) => s.key === o.k); return (sp.variants[o.it.v]?.height || 10) * o.it.scale * 0.8; };
	const flowerKeys = ['hibiscus', 'bougainvillea', ...land.flowers.map((f) => f.key)];

	// a pool: n instances of one genome, each an agent with its own little state
	const pool = (geo, mat, n, scale, spawn, think, opts = {}) => {
		const im = new THREE.InstancedMesh(geo, mat, n);
		const amp = new Float32Array(n), ph = new Float32Array(n);
		for (let i = 0; i < n; i++) ph[i] = rnd() * 6.28;
		geo.setAttribute('aAmp', new THREE.InstancedBufferAttribute(amp, 1));
		geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
		im.frustumCulled = false;
		im.castShadow = !!opts.shadow;
		im.userData.material175 = 'wood';
		group.add(im);
		const agents = [];
		for (let i = 0; i < n; i++) agents.push({ p: V(0, -999, 0), v: V(0, 0, 0), yaw: 0, pitch: 0, state: 'gone', t: 0, amp: 0, s: scale * (0.85 + rnd() * 0.3), goal: V(0, 0, 0) });
		const P = { im, agents, amp, spawn, think, R: opts.R || 40, when: opts.when || (() => 1) };
		pools.push(P);
		return P;
	};

	// ---------- butterflies ----------
	for (const g of land.butterflies) {
		pool(butterflyGeo(g), animalMaterial(shared, g.flap, 'fly'), g.n, g.size, (a, cam) => {
			const fl = near(flowerKeys, cam.x, cam.z, 38);
			const f = fl.length ? fl[(rnd() * fl.length) | 0].it : { x: cam.x + (rnd() - 0.5) * 60, z: cam.z + (rnd() - 0.5) * 60 };
			a.p.set(f.x + (rnd() - 0.5) * 6, 0, f.z + (rnd() - 0.5) * 6); a.p.y = Math.max(0.3, H(a.p.x, a.p.z)) + 0.6 + rnd();
			a.state = 'fly'; a.t = 2 + rnd() * 4; a.goal.copy(a.p);
			return H(a.p.x, a.p.z) > 0.8;
		}, (a, dt, t, cam) => {
			a.t -= dt;
			if (a.state === 'rest') {
				a.amp = 0.35 + 0.35 * Math.max(0, Math.sin(t * 0.8 + a.p.x));      // slowly opening and closing
				a.v.set(0, 0, 0);
				if (a.t <= 0 || a.p.distanceTo(cam) < 1.8) { a.state = 'fly'; a.t = 3 + rnd() * 5; }
				return;
			}
			if (a.t <= 0 || a.p.distanceTo(a.goal) < 0.3) {
				// pick a flower to visit, or settle on the one it is at
				if (a.p.distanceTo(a.goal) < 0.4 && rnd() < 0.5) { a.state = 'rest'; a.t = 2 + rnd() * 6; a.p.copy(a.goal); return; }
				const fl = near(flowerKeys, a.p.x, a.p.z, 14);
				if (fl.length) { const f = fl[(rnd() * fl.length) | 0].it; a.goal.set(f.x + (rnd() - 0.5) * 0.8, H(f.x, f.z) + 0.35 + rnd() * 0.5, f.z + (rnd() - 0.5) * 0.8); }
				else a.goal.set(a.p.x + (rnd() - 0.5) * 8, H(a.p.x, a.p.z) + 0.5 + rnd() * 1.5, a.p.z + (rnd() - 0.5) * 8);
				a.t = 3 + rnd() * 5;
			}
			// the erratic flight: a pull to the goal plus a wandering jink
			const d = a.goal.clone().sub(a.p), L = d.length();
			a.v.addScaledVector(d.normalize(), dt * 2.5);
			a.v.x += Math.sin(t * 3.1 + a.p.z * 3) * dt * 3; a.v.y += Math.sin(t * 4.7 + a.p.x * 2) * dt * 3; a.v.z += Math.cos(t * 2.9 + a.p.y * 4) * dt * 3;
			a.v.multiplyScalar(Math.exp(-dt * 1.8));
			const glideNow = g.glide && Math.sin(t * 0.9 + a.p.x) > 0.3;
			a.amp = glideNow ? 0.15 : 1.1;
			a.p.addScaledVector(a.v, dt);
			const gy = H(a.p.x, a.p.z);
			if (a.p.y < gy + 0.15) a.p.y = gy + 0.15;
			if (L < 0.05) a.v.multiplyScalar(0.5);
		}, { R: 45, when: (night) => 1 - night });
	}

	// ---------- birds ----------
	for (const g of land.birds) {
		const flap = g.kind === 'parrot' ? 16 : g.kind === 'shorebird' ? 18 : 22;
		if (g.kind === 'parrot') {
			// the flock: one leader wanders between distant crowns, the rest keep station
			const leader = { p: V(0, 30, 0), goal: V(0, 30, 0), t: 0 };
			pool(birdGeo(g), animalMaterial(shared, flap, 'bird'), g.n, g.size, (a, cam) => {
				a.off = V((rnd() - 0.5) * 10, (rnd() - 0.5) * 3, (rnd() - 0.5) * 10);
				if (leader.t <= 0) { leader.p.set(cam.x + (rnd() - 0.5) * 200, 30, cam.z + (rnd() - 0.5) * 200); leader.t = 0.01; }
				a.p.copy(leader.p).add(a.off); a.state = 'fly'; return true;
			}, (a, dt, t, cam, i) => {
				if (i === 0) {
					leader.t -= dt;
					if (leader.t <= 0 || leader.p.distanceTo(leader.goal) < 5) {
						const tr = near(treeKeys, cam.x, cam.z, 180);
						const o = tr.length ? tr[(rnd() * tr.length) | 0] : null;
						leader.goal.set(o ? o.it.x : cam.x + (rnd() - 0.5) * 200, 0, o ? o.it.z : cam.z + (rnd() - 0.5) * 200);
						leader.goal.y = Math.max(8, H(leader.goal.x, leader.goal.z)) + 14 + rnd() * 10;
						leader.t = 12 + rnd() * 10;
					}
					const d = leader.goal.clone().sub(leader.p).setLength(9 * dt);
					leader.p.add(d);
				}
				const target = leader.p.clone().add(a.off).add(V(Math.sin(t * 1.3 + i) * 1.5, Math.sin(t * 2.1 + i * 2) * 0.8, Math.cos(t * 1.1 + i) * 1.5));
				a.v.lerp(target.sub(a.p).multiplyScalar(1.6), Math.min(1, dt * 2));
				a.p.addScaledVector(a.v, dt);
				a.amp = 1.1;
			}, { R: 400 });
			continue;
		}
		const shore = g.kind === 'shorebird';
		pool(birdGeo(g), animalMaterial(shared, flap, 'bird'), g.n, g.size, (a, cam) => {
			// songbirds near trees, sandpipers on the wet sand at the water's edge
			for (let k = 0; k < 20; k++) {
				const x = cam.x + (rnd() - 0.5) * 70, z = cam.z + (rnd() - 0.5) * 70, h = H(x, z);
				if (shore ? h > 0.05 && h < 0.6 : h > 2 && near(treeKeys, x, z, 12).length) { a.p.set(x, h, z); a.state = 'ground'; a.t = rnd() * 2; a.yaw = rnd() * 6.28; return true; }
			}
			return false;
		}, (a, dt, t, cam) => {
			a.t -= dt;
			const dc = Math.hypot(a.p.x - cam.x, a.p.z - cam.z);
			if (a.state === 'ground') {
				a.amp = 0;
				const gy = H(a.p.x, a.p.z);
				if (dc < (shore ? 6 : 4)) {
					if (shore && rnd() < 0.7) { a.state = 'run'; a.t = 1.2 + rnd(); a.yaw = Math.atan2(a.p.x - cam.x, a.p.z - cam.z) + (rnd() - 0.5) * 1.2; }
					else {
						// up and away: to a crown for songbirds, along the shore for sandpipers
						a.state = 'fly'; a.t = 3 + rnd() * 2;
						const tr = shore ? [] : near(treeKeys, a.p.x, a.p.z, 30);
						if (tr.length) { const o = tr[(rnd() * tr.length) | 0]; a.goal.set(o.it.x + (rnd() - 0.5) * 2, o.it.y + treeTop(o), o.it.z + (rnd() - 0.5) * 2); }
						else a.goal.set(a.p.x + (a.p.x - cam.x) * 3, gy + 4, a.p.z + (a.p.z - cam.z) * 3);
					}
				} else if (a.t <= 0) {
					// a hop, a peck, a look round
					if (rnd() < 0.6) { a.state = 'hop'; a.t = 0.25; a.yaw += (rnd() - 0.5) * 2; } else a.t = 0.4 + rnd() * 1.5;
				}
				a.p.y = gy; a.pitch = Math.max(0, Math.sin(t * 7 + a.p.x * 3)) * 0.4 * (shore ? 1 : 0.6);
			} else if (a.state === 'hop' || a.state === 'run') {
				const sp = a.state === 'run' ? 2.6 : 1.4;
				a.p.x += Math.sin(a.yaw) * sp * dt; a.p.z += Math.cos(a.yaw) * sp * dt;
				const gy = H(a.p.x, a.p.z);
				a.p.y = gy + (a.state === 'hop' ? Math.sin(Math.max(0, a.t) / 0.25 * Math.PI) * 0.08 : 0);
				a.amp = 0; a.pitch = 0;
				if (shore && gy > 0.8) a.yaw += Math.PI;                              // back toward the water
				if (a.t <= 0) { a.state = 'ground'; a.t = 0.5 + rnd() * 1.5; }
			} else if (a.state === 'fly' || a.state === 'perch') {
				if (a.state === 'fly') {
					const d = a.goal.clone().sub(a.p);
					if (d.length() < 0.3 || a.t <= 0) { a.state = 'perch'; a.t = 5 + rnd() * 10; }
					a.v.lerp(d.setLength(Math.min(7, d.length() * 2 + 1)), Math.min(1, dt * 3));
					a.p.addScaledVector(a.v, dt);
					a.yaw = Math.atan2(a.v.x, a.v.z); a.amp = 1.2;
				} else {
					a.amp = 0;
					// back down to feed once you have gone
					if (a.t <= 0 && dc > 8) { const x = a.p.x + (rnd() - 0.5) * 10, z = a.p.z + (rnd() - 0.5) * 10; a.goal.set(x, H(x, z), z); a.state = 'fly'; a.t = 3; }
				}
				// landed on the ground again
				if (a.state === 'fly' && a.goal.y - H(a.goal.x, a.goal.z) < 0.2 && a.p.distanceTo(a.goal) < 0.4) { a.state = 'ground'; a.t = 1; }
			}
		}, { R: 45, when: (night) => 1 - night * 0.95 });
	}

	// ---------- ghost crabs ----------
	{
		const g = land.crabs;
		pool(crabGeo(g), animalMaterial(shared, 1, 'crab'), g.n, g.size, (a, cam) => {
			for (let k = 0; k < 20; k++) {
				const x = cam.x + (rnd() - 0.5) * 60, z = cam.z + (rnd() - 0.5) * 60, h = H(x, z);
				if (h > 0.35 && h < 2.2 && Math.hypot(x - cam.x, z - cam.z) > 6) { a.p.set(x, h, z); a.state = 'idle'; a.t = rnd() * 3; a.yaw = rnd() * 6.28; return true; }
			}
			return false;
		}, (a, dt, t, cam) => {
			a.t -= dt;
			const dc = Math.hypot(a.p.x - cam.x, a.p.z - cam.z);
			if (a.state === 'burrow') { a.p.y -= dt * 0.3; a.amp = 1; if (a.t <= 0) a.state = 'gone'; return; }
			if (dc < 5 && a.state !== 'bolt') { a.state = 'bolt'; a.t = 1 + rnd() * 1.2; a.yaw = Math.atan2(a.p.x - cam.x, a.p.z - cam.z) + (rnd() - 0.5); }
			if (a.state === 'bolt' || a.state === 'scuttle') {
				// crabs run sideways: the body faces across the direction of travel
				const sp = a.state === 'bolt' ? 3.2 : 0.8;
				a.p.x += Math.sin(a.yaw) * sp * dt; a.p.z += Math.cos(a.yaw) * sp * dt;
				a.amp = a.state === 'bolt' ? 1 : 0.5;
				if (a.t <= 0) { if (a.state === 'bolt') { a.state = 'burrow'; a.t = 0.8; } else { a.state = 'idle'; a.t = 1 + rnd() * 3; } }
			} else {
				a.amp = 0;
				if (a.t <= 0) { a.state = 'scuttle'; a.t = 0.4 + rnd() * 0.8; a.yaw += (rnd() - 0.5) * 3; }
			}
			const h = H(a.p.x, a.p.z);
			if (h < 0.1 || h > 3) a.yaw += Math.PI * dt * 4;
			a.p.y = h;
			a.face = a.yaw + Math.PI / 2;
		}, { R: 40, when: (night) => 0.45 + night * 0.55 });
	}

	// ---------- lizards on warm rock ----------
	{
		const g = land.lizards;
		pool(lizardGeo(g), animalMaterial(shared, 1, 'lizard'), g.n, g.size, (a, cam) => {
			const rocks = near(['boulder', 'tiderock'], cam.x, cam.z, 45).filter((o) => Math.hypot(o.it.x - cam.x, o.it.z - cam.z) > 6);
			if (rocks.length) {
				const o = rocks[(rnd() * rocks.length) | 0].it, a2 = rnd() * 6.28, d = o.scale * 0.4;
				a.p.set(o.x + Math.cos(a2) * d, o.y + o.scale * (o.k === 'tiderock' ? 0.9 : 0.75) + 0.3, o.z + Math.sin(a2) * d);
			} else {
				const x = cam.x + (rnd() - 0.5) * 50, z = cam.z + (rnd() - 0.5) * 50, h = H(x, z);
				if (h < 1.5) return false;
				a.p.set(x, h, z);
			}
			a.state = 'bask'; a.t = 3 + rnd() * 8; a.yaw = rnd() * 6.28;
			return true;
		}, (a, dt, t, cam) => {
			a.t -= dt;
			const dc = Math.hypot(a.p.x - cam.x, a.p.z - cam.z);
			if (a.state === 'bask') {
				a.amp = 0;
				// a push-up now and then, the throat pulsing
				a.pitch = Math.max(0, Math.sin(t * 5 + a.p.x)) * (Math.sin(t * 0.3 + a.p.z) > 0.8 ? 0.2 : 0);
				if (dc < 3.5 || a.t <= 0) { a.state = 'dart'; a.t = 0.5 + rnd() * 0.6; a.yaw = dc < 3.5 ? Math.atan2(a.p.x - cam.x, a.p.z - cam.z) : a.yaw + (rnd() - 0.5) * 2; }
			} else {
				a.p.x += Math.sin(a.yaw) * 3 * dt; a.p.z += Math.cos(a.yaw) * 3 * dt;
				a.amp = 1; a.pitch = 0;
				const h = H(a.p.x, a.p.z); if (a.p.y < h || a.p.y - h > 3) a.p.y = h;
				if (a.t <= 0) { a.state = 'bask'; a.t = 4 + rnd() * 8; if (dc < 6) a.state = 'gone'; }
			}
		}, { R: 45, when: (night) => 1 - night });
	}

	// ---------- the loop ----------
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
	function update(dt, t, night, cam, enabled = true) {
		group.visible = enabled;
		if (!enabled) return;
		dt = Math.min(dt, 0.05);
		for (const P of pools) {
			const want = P.when(night);
			for (let i = 0; i < P.agents.length; i++) {
				const a = P.agents[i];
				const active = i < Math.round(P.agents.length * want);
				// agents live near you: gone or far, they come back somewhere nearby
				if (a.state === 'gone' || a.p.distanceTo(cam) > P.R * 1.4 || !active) {
					if (!active || !P.spawn(a, cam)) { a.p.y = -999; a.state = 'gone'; P.im.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
				}
				P.think(a, dt, t, cam, i);
				const yaw = a.face ?? (a.state === 'fly' || a.v.lengthSq() > 0.01 && a.state !== 'bolt' && a.state !== 'dart' && a.state !== 'run' && a.state !== 'hop' ? Math.atan2(a.v.x, a.v.z) : a.yaw);
				e.set(-a.pitch || 0, yaw + Math.PI, 0);
				q.setFromEuler(e);
				sc.setScalar(a.s);
				P.im.setMatrixAt(i, m4.compose(a.p, q, sc));
				P.amp[i] = a.amp;
			}
			P.im.instanceMatrix.needsUpdate = true;
			P.im.geometry.attributes.aAmp.needsUpdate = true;
		}
	}
	return { update, group, pools };
}
