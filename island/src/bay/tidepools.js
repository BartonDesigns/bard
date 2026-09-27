// Tide pools on the Pacific shore: the Fitzgerald Marine Reserve at Moss Beach, the reef
// under Pillar Point, and Duxbury Reef off Bolinas. Each is a shelf of tilted mudstone and
// sandstone just above the sea, worn into long ribs along the strata and cut by surge
// channels, the bluffs behind it (the real ground, bay/terrain.js). Water stands in the
// hollows: pools lined with pink coralline algae and sea lettuce, holding green anemones,
// purple urchins in their pits and ochre and purple sea stars; black mussel beds and
// gooseneck barnacles along the seaward edge where the swell breaks, bull kelp floating
// beyond, and at Fitzgerald harbor seals hauled out on the outer rocks.
// Each is built when you come near, and you can walk out on the rock (floor()).

import * as THREE from 'three';
import { harborSeal } from '../world/creatures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toWorld } from './geo.js';

const SITES = [
	{ name: 'Fitzgerald Marine Reserve', lat: 37.5212, lon: -122.5183, R: 260, strike: 2.45, long: 1, wide: 0.6, seals: 6 },
	{ name: 'Pillar Point reef', lat: 37.4922, lon: -122.4992, R: 240, strike: 2.1, long: 1, wide: 0.55, seals: 0 },
	{ name: 'Pescadero Point', lat: 37.2560, lon: -122.4150, R: 200, strike: 2.0, long: 1, wide: 0.6, seals: 2 },
	{ name: 'Bean Hollow tide pools', lat: 37.2300, lon: -122.4120, R: 200, strike: 2.2, long: 1, wide: 0.55, seals: 0 },
	{ name: 'Pigeon Point tide pools', lat: 37.1812, lon: -122.3955, R: 180, strike: 1.9, long: 1, wide: 0.6, seals: 2 },
	{ name: 'Duxbury Reef', lat: 37.8915, lon: -122.6990, R: 420, strike: 2.25, long: 1, wide: 0.42, seals: 3 },
].map((s) => ({ ...s, ...toWorld(s.lat, s.lon) }));
export const TIDEPOOLS = SITES;

const TOP = 0.55;
const hh = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
// (the lattice's hash in integers: sin() of the large arguments far out in the world is slow)
const ih = (i, j) => {
	let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
	return (ih(i, j) * (1 - a) + ih(i + 1, j) * a) * (1 - b) + (ih(i, j + 1) * (1 - a) + ih(i + 1, j + 1) * a) * b;
};
const fbm = (x, z) => vn(x, z) * 0.5 + vn(x * 2.1 + 5, z * 2.1 + 3) * 0.3 + vn(x * 4.3 - 7, z * 4.3 + 1) * 0.2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The reef is a run of ribs, each one the worn edge of a bed of mudstone, lying side by side
// along the strike. Across a rib, trough to trough: the trough's floor, the long bedding plane
// rising gently to the crest, then the scarp, where the beds' broken ends step down in two or
// three ledges to the next trough. Each point of the section: [how far across the rib (of its
// width), how high (of its relief), how much a pool in the trough deepens it, is it a scarp face].
const PROF = [
	[0.00, 0.00, 1, 0], [0.07, 0.03, 0.9, 0], [0.14, 0.12, 0.35, 0], [0.36, 0.52, 0, 0],
	[0.58, 1.00, 0, 0], [0.61, 0.96, 0, 0], [0.64, 0.70, 0, 1], [0.67, 0.67, 0, 0],
	[0.70, 0.42, 0, 1], [0.74, 0.39, 0, 0], [0.77, 0.16, 0.2, 1], [0.86, 0.06, 0.6, 0], [0.93, 0.02, 0.9, 0],
];
const NP = PROF.length, EDGE_L = 10, EDGE_R = 2;      // (the trough's sides: the scarp's foot, the bedding plane's)
// a pool in trough t (the one at the start of rib t), along the strike at u: how much of one
const poolK = (u, t) => smooth(0.5, 0.66, vn(u / 8 + t * 13.7, t * 3.1 + 0.5));
// surge channels cut across the strata
const chanK = (u, v) => smooth(0.8, 0.9, vn(u / 14 + 3.1, v / 60)) * smooth(0.5, 0.7, fbm(u / 30, v / 30));

export function createTidepools(scene, bay, shared, { isPhone = false } = {}) {
	const root = new THREE.Group();
	root.name = 'tidepools';
	const DU = isPhone ? 3 : 1.8;                 // (the rock's rows, along the strike)
	scene.add(root);
	const built = new Map();
	// the rock is faceted: every facet catches the light on its own, as broken shale does
	const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, flatShading: true });
	const poolM = new THREE.MeshStandardMaterial({ color: 0x1c4446, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.58, depthWrite: false });
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();

	// the creatures, each one geometry drawn many times
	const starG = (() => {
		const sh = new THREE.Shape();
		for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.28 : 1; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
		const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
		g.rotateX(-Math.PI / 2); g.computeVertexNormals();
		return g;
	})();
	const urchinG = (() => {
		const g = new THREE.IcosahedronGeometry(1, 2), P = g.attributes.position;
		for (let i = 0; i < P.count; i++) { const k = 1 + (hh(i, 3) > 0.5 ? 0.55 : 0.1); P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * 0.7, P.getZ(i) * k); }
		g.computeVertexNormals();
		return g;
	})();
	const anemoneG = (() => {
		const col2 = new THREE.CylinderGeometry(0.8, 1, 0.8, 12, 1).translate(0, 0.4, 0);
		const disc = new THREE.CylinderGeometry(1.25, 0.8, 0.25, 16, 1).translate(0, 0.9, 0);
		const parts = [col2, disc];
		for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; parts.push(new THREE.ConeGeometry(0.12, 0.55, 4).rotateZ(-0.9).rotateY(-a).translate(Math.cos(a) * 1.05, 1.1, Math.sin(a) * 1.05)); }
		return mergeGeometries(parts.map((g) => g.toNonIndexed()));
	})();
	const musselG = new THREE.SphereGeometry(1, 6, 4).scale(1, 0.45, 0.5);
	const kelpG = (() => {
		const bulb = new THREE.SphereGeometry(0.16, 8, 6);
		const parts = [bulb];
		for (let i = 0; i < 6; i++) parts.push(new THREE.PlaneGeometry(0.16, 2.2).translate(0, 0, 1.1).rotateX(Math.PI / 2).rotateY(i / 6 * Math.PI * 2 + 0.3));
		return mergeGeometries(parts.map((g) => g.toNonIndexed()));
	})();
	// a tuft of surfgrass: long bright ribbons from one holdfast, arching over
	const tuftG = (() => {
		const parts = [];
		for (let i = 0; i < 9; i++) {
			const g = new THREE.PlaneGeometry(0.035, 0.7, 1, 4).translate(0, 0.35, 0), P = g.attributes.position, lean = 0.5 + hh(i, 1.3) * 0.6;
			for (let k = 0; k < P.count; k++) { const y = P.getY(k); P.setXYZ(k, P.getX(k), y * (1 - lean * 0.3 * y), -lean * y * y * 0.9); }
			parts.push(g.scale(1, 0.7 + hh(i, 2.1) * 0.6, 1).rotateY(i / 9 * Math.PI * 2 + hh(i, 4.7)));
		}
		const g = mergeGeometries(parts.map((x) => x.toNonIndexed()));
		g.computeVertexNormals();
		return g;
	})();
	// harbor seals, sculpted (world/creatures.js): a few coats, dark to pale
	const sealGs = [0.15, 0.5, 0.85].map((t) => harborSeal(t).scale(0.82, 0.82, 0.82));
	const creatureM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
	const kelpM = new THREE.MeshStandardMaterial({ color: 0x6b4a1c, roughness: 0.6, side: THREE.DoubleSide });
	const grassM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, side: THREE.DoubleSide });
	const sealM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38, metalness: 0.05 });
	const shared0 = [starG, urchinG, anemoneG, musselG, kelpG, tuftG, ...sealGs];

	function build(S) {
		const B = { S, group: new THREE.Group(), seals: [] };
		root.add(B.group);
		// the reef's own frame: u along the strike, v across it
		const ca = Math.cos(S.strike), sa = Math.sin(S.strike), U = S.R * S.long, VX = S.R * S.wide * 1.25;
		const toX = (u, v) => S.x + u * ca - v * sa, toZ = (u, v) => S.z + u * sa + v * ca;
		// the ribs, side by side across the reef: each its own width, relief and height
		const W0 = Math.max(3.6, S.R / 60) * (isPhone ? 1.5 : 1), ribs = [];
		for (let v = -VX - 14, k = 0; v < VX + 14; k++) {
			const w = W0 * (0.65 + 0.7 * hh(k, S.x * 0.01));
			ribs.push({ v0: v, w, A: 0.4 + 0.65 * hh(k * 1.7, 3.3 + S.z * 0.01), base: (hh(k * 2.3, 9.1) - 0.5) * 0.3 });
			v += w;
		}
		const NR = Math.floor(2 * U / DU) + 1, NC = ribs.length * NP, N = NR * NC;
		const V = new Float32Array(N), H = new Float32Array(N).fill(NaN), OUT = new Float32Array(N), EDGE = new Float32Array(N), idx = new Int32Array(N).fill(-1);
		const P = [], C = [], I = [];
		for (let r = 0; r < NR; r++) {
			// the strata bend a little along the strike, all together
			const u = -U + r * DU, bend = (fbm(u / 90 + 4.2, 1.7) - 0.5) * 12 + (vn(u / 30, 6.1) - 0.5) * 0.8;
			for (let k = 0; k < ribs.length; k++) {
				const R = ribs[k], A = R.A * (0.2 + 0.8 * smooth(0.2, 0.6, vn(u / 24 + k * 7.1, k * 1.9)));
				for (let c = 0; c < NP; c++) {
					const [f, y, pw, face] = PROF[c], t = f < 0.5 ? k : k + 1, K = r * NC + k * NP + c;
					const v = R.v0 + f * R.w - bend, x = toX(u, v), z = toZ(u, v);
					V[K] = v;
					// the reef's ragged outline: long along the strata, narrow across them
					const d = Math.hypot(u / (S.R * S.long), v / (S.R * S.wide)) / (0.72 + 0.5 * fbm(x / 60 + 2, z / 60 - 5));
					if (d > 1) continue;
					const g = bay.heightAt(x, z), pk = poolK(u, t), D = pk * (0.22 + 0.3 * hh(t, 4.4));
					let h = TOP + R.base + y * A - D * pw - chanK(u, v) * 1.2 + (fbm(x / 2.2, z / 2.2) - 0.5) * 0.14 * (1 - pw * 0.7);
					// out from the shore the ribs step down into the sea; inland they go under the beach
					const out = smooth(-0.5, -5.5 - fbm(x / 40, z / 40) * 4, g);
					h = h * (1 - out) + (g + 0.25 + y * A * 0.7) * out;
					// and they fade into the ground round the edge of the site
					const edge = smooth(0.8, 1, d);
					h = h * (1 - edge) + (g - 0.6) * edge;
					// (under the ground the rock is still drawn, just below it, so its edge is
					// wherever the two surfaces cross)
					H[K] = h > g - 0.05 ? h : g - 0.25; OUT[K] = out; EDGE[K] = edge;
					idx[K] = P.length / 3;
					P.push(x, H[K], z);
					// the beds: bands a hand or two thick through each rib, each bed its own shade
					const n1 = fbm(x / 5, z / 5), bed = Math.floor((h - TOP - R.base) / 0.17 + hh(k, 7.7) * 4), tone = 0.8 + 0.36 * hh(bed * 1.3 + k * 0.7, 2.9);
					let cr = (0.42 + n1 * 0.08) * tone, cg = (0.385 + n1 * 0.07) * tone, cb = (0.34 + n1 * 0.06) * tone;
					// the scarps' broken faces, out of the sun and running with water
					if (face) { cr *= 0.7; cg *= 0.7; cb *= 0.73; }
					// barnacle-grey on the high dry tops
					const high = smooth(TOP + 0.3, TOP + 0.75, h) * smooth(0.35, 0.6, fbm(x / 1.4, z / 1.4) + 0.12);
					cr += (0.66 - cr) * high; cg += (0.65 - cg) * high; cb += (0.62 - cb) * high;
					// dark and wet low down
					const wet = 1 - smooth(TOP - 0.05, TOP + 0.35, h);
					cr *= 1 - wet * 0.48; cg *= 1 - wet * 0.45; cb *= 1 - wet * 0.4;
					// green algae and sea lettuce over the low rock, olive rockweed a little higher
					const green = smooth(TOP + 0.2, TOP - 0.1, h) * smooth(0.5, 0.7, fbm(x / 4 + 9, z / 4)) * (1 - out * 0.5);
					cr += (0.17 - cr) * green; cg += (0.4 - cg) * green; cb += (0.11 - cb) * green;
					const weed = smooth(0.4, 0.62, fbm(x / 6 - 3, z / 6 + 5)) * smooth(TOP + 0.55, TOP + 0.1, h) * (1 - green);
					cr += (0.33 - cr) * weed; cg += (0.29 - cg) * weed; cb += (0.11 - cb) * weed;
					// pink coralline lining the pools
					const pink = pw * pk * smooth(0.35, 0.65, fbm(x / 2.5, z / 2.5 + 7)) * (1 - out);
					cr += (0.64 - cr) * pink; cg += (0.4 - cg) * pink; cb += (0.47 - cb) * pink;
					// black mussel beds out on the seaward edge
					const mussel = smooth(0.15, 0.5, out) * (1 - smooth(0.6, 0.95, out)) * smooth(0.35, 0.6, n1 + 0.2);
					cr += (0.07 - cr) * mussel; cg += (0.08 - cg) * mussel; cb += (0.1 - cb) * mussel;
					C.push(cr ** 2.2, cg ** 2.2, cb ** 2.2);
				}
			}
		}
		for (let r = 0; r < NR - 1; r++) for (let c = 0; c < NC - 1; c++) {
			const K = r * NC + c, a = idx[K], b = idx[K + 1], cc = idx[K + NC], d = idx[K + NC + 1];
			if (a >= 0 && b >= 0 && cc >= 0 && d >= 0) I.push(a, b, cc, b, d, cc);
		}
		Object.assign(B, { V, H, NR, NC, U, ca, sa });
		const rg = new THREE.BufferGeometry();
		rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		rg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		rg.setIndex(I); rg.computeVertexNormals();
		const rock = new THREE.Mesh(rg, rockM);
		rock.receiveShadow = true; rock.castShadow = !isPhone;
		B.group.add(rock);

		// the pools: still water lying in the troughs, level from end to end of each pool. Each
		// sheet spans the trough from the scarp's foot to the bedding plane's, and the rock
		// rising on both sides cuts its true edge.
		const WP = [], WI = [], pools = [];
		const live = (r, t) => {
			const K = r * NC + t * NP, L = K - NP + EDGE_L, R = K + EDGE_R;
			if (!(H[K] === H[K] && H[L] === H[L] && H[R] === H[R])) return null;
			const u = -U + r * DU;
			if (OUT[K] > 0.05 || EDGE[K] > 0.01 || poolK(u, t) < 0.35 || chanK(u, V[K]) > 0.03) return null;
			const lv = Math.min(TOP + ribs[t].base - 0.07, H[L] - 0.04, H[R] - 0.04);
			return H[K] < lv - 0.03 ? lv : null;
		};
		for (let t = 1; t < ribs.length; t++) {
			let run = [];
			for (let r = 0; r <= NR; r++) {
				const lv = r < NR ? live(r, t) : null;
				if (lv !== null) { run.push([r, lv]); continue; }
				if (run.length >= 2) {
					const level = Math.min(...run.map((x) => x[1])), r0 = Math.max(0, run[0][0] - 1), r1 = Math.min(NR - 1, run[run.length - 1][0] + 1);
					// (a row beyond each end, where the rock has risen above the water, closes it)
					let first = true;
					for (let rr = r0; rr <= r1; rr++) {
						const K = rr * NC + t * NP, L = K - NP + EDGE_L, R = K + EDGE_R;
						if (!(H[L] === H[L] && H[R] === H[R])) { first = true; continue; }
						const u = -U + rr * DU, n = WP.length / 3;
						WP.push(toX(u, V[L]), level, toZ(u, V[L]), toX(u, V[R]), level, toZ(u, V[R]));
						if (!first) WI.push(n - 2, n - 1, n, n - 1, n + 1, n);
						first = false;
					}
					for (const [rr] of run) pools.push([rr, t]);
				}
				run = [];
			}
		}
		if (WI.length) {
			const wg = new THREE.BufferGeometry();
			wg.setAttribute('position', new THREE.Float32BufferAttribute(WP, 3));
			wg.setIndex(WI); wg.computeVertexNormals();
			const water = new THREE.Mesh(wg, poolM);
			water.renderOrder = 2;
			B.group.add(water);
		}

		// the life in and round the pools
		const K0 = isPhone ? 0.5 : 1, lists = { star: [], urchin: [], anemone: [], mussel: [], kelp: [], tuft: [] };
		let seed = 1;
		const rnd = () => hh(seed++ * 0.731 + S.x * 0.001, S.z * 0.001 + seed * 0.119);
		// a point on the rock between two rows and two columns of it
		const spotAt = (r, c, a, b) => {
			if (r < 0 || c < 0 || r >= NR - 1 || c >= NC - 1) return null;
			const k00 = r * NC + c, k01 = k00 + 1, k10 = k00 + NC, k11 = k10 + 1;
			const h = (H[k00] * (1 - a) + H[k01] * a) * (1 - b) + (H[k10] * (1 - a) + H[k11] * a) * b;
			if (h !== h) return null;
			const u = -U + (r + b) * DU, v = (V[k00] * (1 - a) + V[k01] * a) * (1 - b) + (V[k10] * (1 - a) + V[k11] * a) * b;
			return [toX(u, v), h, toZ(u, v)];
		};
		// in the pools: anemones and urchins on the floor and up the sides, sea stars among them
		for (let tries = 0; pools.length && tries < 3000 * K0 && (lists.anemone.length < 160 * K0 || lists.urchin.length < 120 * K0 || lists.star.length < 50 * K0); tries++) {
			const [r, t] = pools[Math.floor(rnd() * pools.length)], c = t * NP + [-3, -2, -1, 0, 1][Math.floor(rnd() * 5)];
			const at = spotAt(r, c, rnd(), rnd());
			if (!at) continue;
			const k = rnd();
			if (k < 0.4 && lists.anemone.length < 160 * K0) lists.anemone.push([...at, 0.05 + rnd() * 0.05, rnd()]);
			else if (k < 0.75 && lists.urchin.length < 120 * K0) lists.urchin.push([...at, 0.05 + rnd() * 0.03, rnd()]);
			else if (lists.star.length < 50 * K0) { at[1] += 0.02; lists.star.push([...at, 0.1 + rnd() * 0.08, rnd()]); }
		}
		// out on the seaward rock: mussel beds, sea stars feeding on them; surfgrass low down
		for (let tries = 0; tries < 26000 * K0 && (lists.mussel.length < 700 * K0 || lists.tuft.length < 420 * K0); tries++) {
			const r = Math.floor(rnd() * (NR - 1)), c = Math.floor(rnd() * (NC - 1)), K = r * NC + c, h = H[K];
			if (h !== h) continue;
			const out = OUT[K], at = spotAt(r, c, rnd(), rnd());
			if (!at) continue;
			if (out > 0.12 && out < 0.8 && h > -0.6 && (c % NP) >= 3 && (c % NP) <= 9 && lists.mussel.length < 700 * K0) {
				for (let m = 0; m < 8; m++) { const a2 = spotAt(r, c, rnd(), rnd()); if (a2) { a2[1] += 0.02; lists.mussel.push([...a2, 0.04 + rnd() * 0.02, rnd()]); } }
				if (rnd() < 0.08 && lists.star.length < 90 * K0) { at[1] += 0.06; lists.star.push([...at, 0.12 + rnd() * 0.08, rnd()]); }
			} else if (h > -0.35 && h < TOP + 0.15 && EDGE[K] < 0.5 && lists.tuft.length < 420 * K0 && fbm(at[0] / 5 + 2, at[2] / 5) > 0.45) {
				for (let m = 0; m < 3; m++) { const a2 = spotAt(r, c, rnd(), rnd()); if (a2) lists.tuft.push([...a2, 0.7 + rnd() * 0.6, rnd()]); }
			}
		}
		// bull kelp beyond the edge, where the ground is a few metres down
		for (let t = 0; t < 4000 && lists.kelp.length < 50 * K0; t++) {
			const a = rnd() * Math.PI * 2, r = S.R * (0.3 + rnd() * 0.75), x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r, g = bay.heightAt(x, z);
			if (g < -3 && g > -14) lists.kelp.push([x, 0.02, z, 1, rnd()]);
		}
		const place = (geo, mat, L, colour, flat) => {
			if (!L.length) return null;
			const M = new THREE.InstancedMesh(geo, mat, L.length);
			L.forEach(([x, y, z, sc, k], i) => {
				e.set(flat ? 0 : (k - 0.5) * 0.4, k * 6.283, flat ? 0 : (hh(k, 2) - 0.5) * 0.4);
				M.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromEuler(e), s.set(sc, sc, sc)));
				M.setColorAt(i, colour(k, col));
			});
			M.castShadow = false; M.receiveShadow = true;
			B.group.add(M);
			return M;
		};
		// ochre sea stars come purple or orange; anemones green; urchins purple
		place(starG, creatureM, lists.star, (k, c) => (k < 0.55 ? c.setRGB(0.42, 0.1, 0.3) : c.setRGB(0.85, 0.36, 0.08)));
		place(urchinG, creatureM, lists.urchin, (k, c) => c.setRGB(0.3 + k * 0.1, 0.08, 0.32));
		place(anemoneG, creatureM, lists.anemone, (k, c) => c.setRGB(0.25 + k * 0.1, 0.62 + k * 0.1, 0.42));
		place(musselG, creatureM, lists.mussel, (k, c) => c.setRGB(0.04 + k * 0.03, 0.05 + k * 0.03, 0.08 + k * 0.04));
		// surfgrass emerald, a few tufts of olive feather boa among it
		place(tuftG, grassM, lists.tuft, (k, c) => (k < 0.8 ? c.setRGB(0.06 + k * 0.05, 0.36 + k * 0.12, 0.08) : c.setRGB(0.26, 0.24, 0.07)));
		B.kelp = place(kelpG, kelpM, lists.kelp, (k, c) => c.setRGB(0.9 + k * 0.2, 0.9, 0.8), true);
		B.kelpL = lists.kelp;
		// harbor seals, hauled out on the crests of the outer rocks
		for (let t = 0; t < 6000 && B.seals.length < S.seals; t++) {
			const r = Math.floor(rnd() * (NR - 1)), k = Math.floor(rnd() * ribs.length), K = r * NC + k * NP + 4, h = H[K];
			if (h !== h || OUT[K] < 0.05 || OUT[K] > 0.5 || h < 0.1) continue;
			const u = -U + r * DU, seal = new THREE.Mesh(sealGs[Math.floor(rnd() * sealGs.length)], sealM);
			seal.position.set(toX(u, V[K]), h + 0.02, toZ(u, V[K])); seal.rotation.y = S.strike + (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.6;
			seal.castShadow = !isPhone;
			seal.userData.ph = rnd() * 10;
			B.group.add(seal); B.seals.push(seal);
		}
		built.set(S, B);
		return B;
	}
	function drop(S) {
		const B = built.get(S);
		B.group.traverse((o) => { if (o.geometry && !shared0.includes(o.geometry)) o.geometry.dispose(); });
		root.remove(B.group);
		built.delete(S);
	}

	let tBuild = 0;
	function update(dt, t, camera) {
		const cx = camera.position.x, cz = camera.position.z;
		tBuild -= dt;
		for (const S of SITES) {
			const d = Math.hypot(cx - S.x, cz - S.z);
			if (!built.has(S) && d < S.R + 2200 && camera.position.y < 2500 && tBuild <= 0) { build(S); tBuild = 1; }
			else if (built.has(S) && d > S.R + 3200) drop(S);
		}
		for (const B of built.values()) {
			// the seals lift their heads now and then; the kelp rides the swell
			for (const sl of B.seals) { const u = sl.userData.ph + t * 0.4; sl.rotation.x = -Math.max(0, Math.sin(u)) * 0.25; sl.scale.y = 1 + Math.sin(t * 1.3 + u) * 0.03; }
			if (B.kelp) {
				B.kelpL.forEach(([x, , z, sc, k], i) => {
					e.set(Math.sin(t * 0.7 + k * 9) * 0.08, k * 6.283 + Math.sin(t * 0.3 + k * 4) * 0.2, 0);
					B.kelp.setMatrixAt(i, m4.compose(p.set(x + Math.sin(t * 0.5 + k * 7) * 0.4, 0.03 + Math.sin(t * 0.9 + x * 0.05) * 0.12, z), q.setFromEuler(e), s.set(sc, sc, sc)));
				});
				B.kelp.instanceMatrix.needsUpdate = true;
			}
		}
	}

	// the rock's height across one row at v (NaN off the rock)
	function rowH(B, r, v) {
		const { V, H, NC } = B, K0 = r * NC;
		if (v < V[K0] || v > V[K0 + NC - 1]) return NaN;
		let lo = 0, hi = NC - 1;
		while (hi - lo > 1) { const m = (lo + hi) >> 1; if (V[K0 + m] <= v) lo = m; else hi = m; }
		const a = V[K0 + lo], b = V[K0 + hi], w = b > a ? (v - a) / (b - a) : 0;
		return H[K0 + lo] * (1 - w) + H[K0 + hi] * w;
	}
	// the rock under you, to walk out over the reef (y: your feet less a margin)
	function floor(x, z, y) {
		for (const B of built.values()) {
			const dx = x - B.S.x, dz = z - B.S.z, u = dx * B.ca + dz * B.sa, v = -dx * B.sa + dz * B.ca, fr = (u + B.U) / DU;
			if (fr < 0 || fr >= B.NR - 1) continue;
			const r = Math.floor(fr), b = fr - r, h0 = rowH(B, r, v), h1 = rowH(B, r + 1, v);
			if (h0 !== h0 || h1 !== h1) continue;
			const h = h0 * (1 - b) + h1 * b;
			if (y > h - 1.2 && h > -0.2) return h;
		}
		return -1e9;
	}
	// which reef you are on, for the hint
	const siteAt = (x, z) => SITES.find((S) => Math.hypot(x - S.x, z - S.z) < S.R * 0.8) || null;
	return { group: root, update, floor, siteAt };
}
