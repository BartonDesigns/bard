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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toWorld } from './geo.js';

const SITES = [
	{ name: 'Fitzgerald Marine Reserve', lat: 37.5212, lon: -122.5183, R: 260, strike: 2.45, long: 1, wide: 0.6, seals: 6 },
	{ name: 'Pillar Point reef', lat: 37.4922, lon: -122.4992, R: 240, strike: 2.1, long: 1, wide: 0.55, seals: 0 },
	{ name: 'Duxbury Reef', lat: 37.8915, lon: -122.6990, R: 420, strike: 2.25, long: 1, wide: 0.42, seals: 3 },
].map((s) => ({ ...s, ...toWorld(s.lat, s.lon) }));
export const TIDEPOOLS = SITES;

const TOP = 0.55, POOL = 0.32;
const hh = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
	return (hh(i, j) * (1 - a) + hh(i + 1, j) * a) * (1 - b) + (hh(i, j + 1) * (1 - a) + hh(i + 1, j + 1) * a) * b;
};
const fbm = (x, z) => vn(x, z) * 0.5 + vn(x * 2.1 + 5, z * 2.1 + 3) * 0.3 + vn(x * 4.3 - 7, z * 4.3 + 1) * 0.2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the shelf's height at (x, z) (and how much of it is pool, how far out it is), from the
// ground: where the real ground is near sea level the rock stands up out of it
function shelfAt(S, g, x, z) {
	const dx = x - S.x, dz = z - S.z;
	if (Math.hypot(dx, dz) > S.R) return null;
	const ca = Math.cos(S.strike), sa = Math.sin(S.strike);
	const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
	// the reef's own ragged outline: long along the strata, narrow across them
	const d = Math.hypot(along / (S.R * S.long), across / (S.R * S.wide)) / (0.72 + 0.5 * fbm(x / 60 + 2, z / 60 - 5));
	if (d > 1) return null;
	// the strata: ribs a few metres apart, bent by the noise, their edges sharp on one side
	const w = across / 3.2 + fbm(x / 22, z / 22) * 3.2, rib = w - Math.floor(w);
	const ribs = (rib < 0.72 ? rib / 0.72 : (1 - rib) / 0.28) * 0.34;
	// surge channels across the strata, and the pools
	const chan = smooth(0.8, 0.9, vn(along / 7 + 3.1, across / 60)) * smooth(0.5, 0.7, fbm(along / 30, across / 30));
	const pool = smooth(0.52, 0.66, fbm(x / 9 + 11, z / 9 - 4));
	// out from the shore the rock goes down into the sea; inland it is under the beach
	const out = smooth(-0.5, -5.5 - fbm(x / 40, z / 40) * 4, g);
	let h = TOP + ribs - pool * 0.55 - chan * 1.3 + (fbm(x / 3, z / 3) - 0.5) * 0.22 + (hh(Math.floor(x / 1.3), Math.floor(z / 1.3)) - 0.5) * 0.12;
	h = h * (1 - out) + (g + 0.3) * out;
	// and it fades into the ground round the edge of the site
	const edge = smooth(0.8, 1, d);
	h = h * (1 - edge) + (g - 0.6) * edge;
	return { h, pool: pool * (1 - out) * (1 - edge), out, chan, rib: ribs };
}

export function createTidepools(scene, bay, shared, { isPhone = false } = {}) {
	const root = new THREE.Group();
	root.name = 'tidepools';
	const CELL = isPhone ? 2.6 : 1.6;            // (the rock's grid)
	scene.add(root);
	const built = new Map();
	const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, flatShading: true });
	const poolM = new THREE.MeshStandardMaterial({ color: 0x163a3c, roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false });
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
	const sealG = (() => {
		const body = new THREE.SphereGeometry(1, 14, 10).scale(0.42, 0.3, 0.95);
		const head = new THREE.SphereGeometry(0.2, 10, 8).scale(1, 0.9, 1.2).translate(0, 0.2, 0.95);
		const flip = new THREE.ConeGeometry(0.22, 0.45, 5).rotateX(-Math.PI / 2).scale(1.4, 0.3, 1).translate(0, -0.05, -1.05);
		return mergeGeometries([body, head, flip].map((g) => g.toNonIndexed()));
	})();
	const creatureM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
	const kelpM = new THREE.MeshStandardMaterial({ color: 0x6b4a1c, roughness: 0.6, side: THREE.DoubleSide });
	const sealM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

	function build(S) {
		const B = { S, group: new THREE.Group(), seals: [] };
		root.add(B.group);
		const n = Math.ceil(S.R * 2 / CELL) + 1, x0 = S.x - S.R, z0 = S.z - S.R;
		const H = new Float32Array(n * n), G = new Float32Array(n * n), info = new Array(n * n);
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const x = x0 + i * CELL, z = z0 + j * CELL, g = bay.heightAt(x, z), sh = shelfAt(S, g, x, z), k = j * n + i;
			G[k] = g; info[k] = sh;
			// (under the ground, the rock is not drawn: the beach and the bluffs are the ground's)
			H[k] = sh && sh.h > g - 0.05 ? sh.h : NaN;
		}
		B.H = H; B.n = n; B.x0 = x0; B.z0 = z0;
		// the rock: every cell whose corners all show
		const P = [], C = [], I = [], W = [], WI = [], idx = new Int32Array(n * n).fill(-1), widx = new Int32Array(n * n).fill(-1);
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const k = j * n + i;
			if (H[k] !== H[k]) continue;
			const x = x0 + i * CELL, z = z0 + j * CELL, sh = info[k], h = H[k];
			idx[k] = P.length / 3;
			P.push(x, h, z);
			// dry grey-brown on the tops, dark and wet low down, sea lettuce and pink
			// coralline in the pools, black mussel beds out on the edge
			const n1 = fbm(x / 5, z / 5), wet = 1 - smooth(TOP - 0.1, TOP + 0.3, h);
			// (picked in sRGB, stored linear)
			let r = 0.5 + n1 * 0.14, gg = 0.45 + n1 * 0.12, b = 0.38 + n1 * 0.1;
			r *= 1 - wet * 0.55; gg *= 1 - wet * 0.52; b *= 1 - wet * 0.48;
			const lettuce = smooth(0.4, 0.7, fbm(x / 4 + 9, z / 4)) * smooth(0.5, 0.1, h) * (1 - sh.out);
			r += (0.24 - r) * lettuce; gg += (0.42 - gg) * lettuce; b += (0.14 - b) * lettuce;
			const pink = sh.pool * smooth(0.45, 0.7, fbm(x / 2.5, z / 2.5 + 7));
			r += (0.72 - r) * pink; gg += (0.47 - gg) * pink; b += (0.52 - b) * pink;
			const mussel = smooth(0.15, 0.5, sh.out) * (1 - smooth(0.6, 0.95, sh.out)) * smooth(0.35, 0.6, n1 + 0.2);
			r += (0.08 - r) * mussel; gg += (0.09 - gg) * mussel; b += (0.12 - b) * mussel;
			C.push(r ** 2.2, gg ** 2.2, b ** 2.2);
			// the pool water over the hollows (not over the open sea)
			if (h < POOL && sh.out < 0.35 && h > -0.4) { widx[k] = W.length / 3; W.push(x, POOL, z); }
		}
		for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
			const a = idx[j * n + i], b = idx[j * n + i + 1], c = idx[(j + 1) * n + i], d = idx[(j + 1) * n + i + 1];
			if (a >= 0 && b >= 0 && c >= 0 && d >= 0) I.push(a, c, b, b, c, d);
		}
		// pool water needs a vertex at every corner: the neighbours of a pool cell join it at the same level
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const k = j * n + i;
			if (widx[k] >= 0 || H[k] !== H[k]) continue;
			let near = false;
			for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) { const kk = (j + dj) * n + i + di; if (kk >= 0 && kk < n * n && widx[kk] >= 0 && W[widx[kk] * 3 + 1] === POOL) { near = true; break; } }
			if (near && info[k].out < 0.35) { widx[k] = -2 - W.length / 3; W.push(x0 + i * CELL, POOL, z0 + j * CELL); }
		}
		const wi = (k) => (widx[k] >= 0 ? widx[k] : widx[k] <= -2 ? -2 - widx[k] : -1);
		for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
			const a = wi(j * n + i), b = wi(j * n + i + 1), c = wi((j + 1) * n + i), d = wi((j + 1) * n + i + 1);
			if (a >= 0 && b >= 0 && c >= 0 && d >= 0 && (widx[j * n + i] >= 0 || widx[j * n + i + 1] >= 0 || widx[(j + 1) * n + i] >= 0 || widx[(j + 1) * n + i + 1] >= 0)) WI.push(a, c, b, b, c, d);
		}
		const rg = new THREE.BufferGeometry();
		rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		rg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		rg.setIndex(I); rg.computeVertexNormals();
		const rock = new THREE.Mesh(rg, rockM);
		rock.receiveShadow = true; rock.castShadow = !isPhone;
		B.group.add(rock);
		if (WI.length) {
			const wg = new THREE.BufferGeometry();
			wg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
			wg.setIndex(WI); wg.computeVertexNormals();
			const water = new THREE.Mesh(wg, poolM);
			water.renderOrder = 2;
			B.group.add(water);
		}

		// the life in and round the pools
		const K = isPhone ? 0.5 : 1, lists = { star: [], urchin: [], anemone: [], mussel: [], kelp: [] };
		let seed = 1;
		const rnd = () => hh(seed++ * 0.731 + S.x * 0.001, S.z * 0.001 + seed * 0.119);
		for (let t = 0; t < 26000 * K && (lists.star.length < 90 * K || lists.anemone.length < 160 * K || lists.urchin.length < 120 * K || lists.mussel.length < 700 * K); t++) {
			const i = Math.floor(rnd() * (n - 2)) + 1, j = Math.floor(rnd() * (n - 2)) + 1, k = j * n + i, h = H[k];
			if (h !== h) continue;
			const sh = info[k], x = x0 + (i + rnd() - 0.5) * CELL, z = z0 + (j + rnd() - 0.5) * CELL;
			if (sh.pool > 0.4 && h < POOL) {
				const r = rnd();
				if (r < 0.4 && lists.anemone.length < 160 * K) lists.anemone.push([x, h, z, 0.05 + rnd() * 0.05, rnd()]);
				else if (r < 0.75 && lists.urchin.length < 120 * K) lists.urchin.push([x, h, z, 0.05 + rnd() * 0.03, rnd()]);
				else if (lists.star.length < 90 * K) lists.star.push([x, h + 0.02, z, 0.1 + rnd() * 0.08, rnd()]);
			} else if (sh.out > 0.12 && sh.out < 0.8 && h > -0.6 && lists.mussel.length < 700 * K) {
				// mussels in beds, a few sea stars feeding on them
				for (let c = 0; c < 8; c++) lists.mussel.push([x + (rnd() - 0.5) * 1.4, h + 0.02, z + (rnd() - 0.5) * 1.4, 0.04 + rnd() * 0.02, rnd()]);
				if (rnd() < 0.08 && lists.star.length < 90 * K) lists.star.push([x, h + 0.06, z, 0.12 + rnd() * 0.08, rnd()]);
			}
		}
		// bull kelp beyond the edge, where the ground is a few metres down
		for (let t = 0; t < 4000 && lists.kelp.length < 50 * K; t++) {
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
		B.kelp = place(kelpG, kelpM, lists.kelp, (k, c) => c.setRGB(0.9 + k * 0.2, 0.9, 0.8), true);
		B.kelpL = lists.kelp;
		// harbor seals, hauled out on the outer rocks
		for (let t = 0; t < 6000 && B.seals.length < S.seals; t++) {
			const i = Math.floor(rnd() * (n - 2)) + 1, j = Math.floor(rnd() * (n - 2)) + 1, k = j * n + i, h = H[k];
			if (h !== h || info[k].out < 0.05 || info[k].out > 0.5 || h < 0.1) continue;
			const seal = new THREE.Mesh(sealG, sealM.clone());
			const tone = rnd();
			seal.material.color.setRGB(0.32 + tone * 0.35, 0.3 + tone * 0.32, 0.28 + tone * 0.28);
			seal.position.set(x0 + i * CELL, h + 0.22, z0 + j * CELL); seal.rotation.y = rnd() * 6.28;
			seal.castShadow = !isPhone;
			seal.userData.ph = rnd() * 10;
			B.group.add(seal); B.seals.push(seal);
		}
		built.set(S, B);
		return B;
	}
	function drop(S) {
		const B = built.get(S);
		B.group.traverse((o) => { if (o.geometry && o.geometry !== starG && o.geometry !== urchinG && o.geometry !== anemoneG && o.geometry !== musselG && o.geometry !== kelpG && o.geometry !== sealG) o.geometry.dispose(); });
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

	// the rock under you, to walk out over the reef (y: your feet less a margin)
	function floor(x, z, y) {
		for (const B of built.values()) {
			const fi = (x - B.x0) / CELL, fj = (z - B.z0) / CELL;
			if (fi < 0 || fj < 0 || fi >= B.n - 1 || fj >= B.n - 1) continue;
			const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, H = B.H, n = B.n;
			const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
			if (a !== a || b !== b || c !== c || d !== d) continue;
			const h = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
			if (y > h - 1.2 && h > -0.2) return h;
		}
		return -1e9;
	}
	// which reef you are on, for the hint
	const siteAt = (x, z) => SITES.find((S) => Math.hypot(x - S.x, z - S.z) < S.R * 0.8) || null;
	return { group: root, update, floor, siteAt };
}
