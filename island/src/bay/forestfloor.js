// The floor of the wild woods close by: fallen logs and old stumps among the trees city.js
// grows (wildLand), and the light blue-grey haze that hangs between the trunks of a tall
// forest. Great redwood and Douglas-fir logs lie mossy side up in the fog belt (Muir Woods,
// the canyons of Mt Tam, the Santa Cruz Mountains), with the stumps of the old logging
// among them; under the inland oaks there are only fallen limbs. They lie where city.js puts
// no tree, from the same hash and the same reckoning of woodland (north faces, draws,
// groves), so they lie among the trunks and never through one. The ground under them is
// terrain.js's (the duff).

import * as THREE from 'three';
import { GREENS } from './realcity.js';
import { toWorld } from './geo.js';
import { createWildGround } from '../nature/wildground.js';
import { rotWood } from './weathering.js';

// city.js's own hash and value noise, so the woods here are its woods
const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
	const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
	return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
};
const C = 13, R = 240, MAXL = 420, MAXS = 160, MAXN = 160;

// a log: along y from -0.5 (the foot) to 0.5 (the broken top), radius 1 at the foot; the
// moss and ferny green along its top (+x, turned up when it is laid), bark in ridges, the
// pale broken wood at its ends. A conifer's keeps its root wad, a fan of torn roots and
// soil standing on edge; an oak limb is crooked, with the stubs of its side branches.
function logGeometry(conifer) {
	const seg = 14, rings = 9, pos = [], col = [], idx = [];
	const bark = conifer ? [0.3, 0.16, 0.09] : [0.3, 0.25, 0.19], wood = [0.5, 0.36, 0.24], moss = conifer ? [0.12, 0.2, 0.04] : [0.2, 0.22, 0.1];
	const bend = conifer ? 0 : 0.35;
	for (let j = 0; j <= rings; j++) {
		const t = j / rings, y = t - 0.5;
		const taper = 1 - t * (conifer ? 0.35 : 0.45);
		// the foot flares into the roots
		const flare = conifer ? 1 + 0.55 * Math.pow(Math.max(0, 1 - t * 7), 2) : 1;
		for (let i = 0; i <= seg; i++) {
			const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
			// bark in deep vertical ridges (fibrous on a redwood), less on the underside
			const ridge = 1 + (conifer ? 0.07 : 0.04) * Math.sin(a * 11 + Math.sin(t * 9) * 0.6) * Math.sin(a * 5.3 + 1.7);
			// the broken top: jagged, splintered
			const brk = j === rings ? 0.02 * Math.sin(a * 7) + (hash(i, 91) - 0.5) * 0.03 : 0;
			const r = taper * flare * ridge;
			const off = bend * Math.sin(t * Math.PI) * 0.5;
			pos.push(ca * r, y + brk, sa * r + off);
			const up = Math.max(0, Math.min(1, (ca - 0.05) * 2.2 + (hash(i * 3.7, j * 9.1) - 0.5) * 0.9));
			const c = bark.map((v, k) => v + (moss[k] - v) * up * (conifer ? 1 : 0.6));
			const jj = 0.82 + hash(i + j * 31, 7) * 0.3;
			col.push(c[0] * jj, c[1] * jj, c[2] * jj);
		}
	}
	for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
	// the end faces: pale wood, a darker heart
	for (const [j, sgn] of [[0, -1], [rings, 1]]) {
		const o = pos.length / 3, t = j / rings, taper = (1 - t * (conifer ? 0.35 : 0.45)) * (conifer && j === 0 ? 1.55 : 1) * 0.94;
		pos.push(0, t - 0.5, bend * Math.sin(t * Math.PI) * 0.5); col.push(wood[0] * 0.6, wood[1] * 0.6, wood[2] * 0.6);
		for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(Math.cos(a) * taper, t - 0.5 + sgn * 0.004, Math.sin(a) * taper + bend * Math.sin(t * Math.PI) * 0.5); col.push(...wood); }
		for (let i = 0; i < seg; i++) if (sgn > 0) idx.push(o, o + 1 + i, o + 2 + i); else idx.push(o, o + 2 + i, o + 1 + i);
	}
	// the root wad: torn roots fanning out of the foot, clotted with soil
	if (conifer) for (let i = 0; i < 12; i++) {
		const a = i / 12 * Math.PI * 2 + hash(i, 3) * 0.4, L = 1.4 + hash(i, 5) * 1.1, o = pos.length / 3;
		const ca = Math.cos(a), sa = Math.sin(a), w = 0.16;
		for (const [rr, yy, ww] of [[1.2, -0.49, w], [L, -0.5 - 0.004 * hash(i, 9), w * 0.4]]) {
			pos.push(ca * rr - sa * ww, yy, sa * rr + ca * ww, ca * rr + sa * ww, yy, sa * rr - ca * ww);
			col.push(0.26, 0.18, 0.12, 0.24, 0.17, 0.11);
		}
		idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3, o, o + 1, o + 2, o + 1, o + 3, o + 2);
	}
	// branch stubs sticking out of the sides and top
	for (let i = 0; i < (conifer ? 5 : 4); i++) {
		const t = 0.25 + hash(i, conifer ? 11 : 13) * 0.65, a = (hash(i, 17) - 0.5) * 2.4, o = pos.length / 3;
		const r0 = (1 - t * 0.4) * 0.95, L = conifer ? 0.5 : 0.9, ca = Math.cos(a), sa = Math.sin(a), y = t - 0.5, w = conifer ? 0.12 : 0.2;
		pos.push(ca * r0, y - w * 0.02, sa * r0 - w, ca * r0, y + w * 0.02, sa * r0 + w, ca * (r0 + L), y + 0.004, sa * (r0 + L));
		col.push(...bark, ...bark, 0.42, 0.33, 0.24);
		idx.push(o, o + 1, o + 2, o, o + 2, o + 1);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}
// a stump: flared to its roots, the cut top grey with weather and dark with rot; old
// redwood stumps keep the springboard notches the fallers cut
function stumpGeometry() {
	const g = new THREE.CylinderGeometry(0.82, 1.15, 1, 16, 3);
	const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3);
	for (let i = 0; i < P.count; i++) {
		const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), top = N.getY(i) > 0.9 && y > 0.49;
		if (!top) {
			// buttresses at the foot, fissured bark
			const k = 1 + (y < 0 ? 0.25 * Math.pow(Math.abs(Math.sin(a * 3 + 0.5)), 3) * (-y * 2) : 0) + 0.04 * Math.sin(a * 13);
			P.setX(i, x * k); P.setZ(i, z * k);
		} else P.setY(i, y - 0.06 * Math.max(0, Math.sin(a * 2)) + (hash(i, 5) - 0.5) * 0.03);
		const j = 0.85 + hash(i, 3) * 0.3, rr = Math.hypot(x, z);
		const c = top ? (rr < 0.35 ? [0.16, 0.11, 0.08] : [0.36, 0.31, 0.25]) : y < 0 ? [0.22, 0.14, 0.08] : [0.3, 0.18, 0.11];
		col.set(c.map((v) => v * j), i * 3);
	}
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	g.computeVertexNormals();
	return g;
}
// a snag: a dead tree still standing, from 0 to 1 up y, radius 1 at its foot, the top
// snapped off in splinters, a few dead limbs; bark sloughed off to grey wood. Charred
// ones (the 2020 fire in Big Basin) are black to well up the trunk.
function snagGeometry() {
	const seg = 10, rings = 8, pos = [], col = [], idx = [];
	for (let j = 0; j <= rings; j++) {
		const t = j / rings;
		for (let i = 0; i <= seg; i++) {
			const a = i / seg * Math.PI * 2, r = (1 - t * 0.62) * (1 + 0.35 * Math.pow(Math.max(0, 1 - t * 6), 2)) * (1 + 0.05 * Math.sin(a * 9));
			const y = j === rings ? t - 0.06 * hash(i, 41) - 0.04 * Math.abs(Math.sin(a * 2)) : t;
			pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
			// silver-grey weathered wood, patches of bark left low down (a burnt one is
			// blackened by its instance tint)
			const barkLeft = t < 0.4 && hash(i * 3, j) > 0.4;
			const c = barkLeft ? [0.3, 0.22, 0.16] : [0.55, 0.52, 0.48];
			const jj = 0.85 + hash(i + j * 17, 3) * 0.25;
			col.push(c[0] * jj, c[1] * jj, c[2] * jj);
		}
	}
	for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
	// dead limbs, broken short, angled up (thin in the x/z scale, so kept few)
	for (let i = 0; i < 4; i++) {
		const t = 0.45 + i * 0.12, a = hash(i, 23) * 6.28, o = pos.length / 3, r0 = 1 - t * 0.62, L = 1.8 + hash(i, 29) * 1.6;
		const ca = Math.cos(a), sa = Math.sin(a), w = 0.22;
		pos.push(ca * r0 - sa * w, t, sa * r0 + ca * w, ca * r0 + sa * w, t, sa * r0 - ca * w, ca * (r0 + L), t + 0.05 + hash(i, 31) * 0.05, sa * (r0 + L));
		col.push(0.5, 0.48, 0.44, 0.5, 0.48, 0.44, 0.58, 0.56, 0.52);
		idx.push(o, o + 1, o + 2, o, o + 2, o + 1);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}
// where the 2020 CZU fire burned: Big Basin, the upper Waddell and Scott creek canyons
const BURN = { ...toWorld(37.165, -122.245), r: 9500 };

export function createForestFloor(scene, bay, city, real, opts = {}) {
	// the ground cover, brush, rock and litter of the open country (nature/wildground.js)
	const wild = opts.shared ? createWildGround(scene, bay, { shared: opts.shared, real, isPhone: opts.isPhone, ground: opts.ground, globe: opts.globe }) : null;
	// (rotting as it lies: weathering.js)
	const mat = rotWood(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
	const logs = new THREE.InstancedMesh(logGeometry(true), mat, MAXL), limbs = new THREE.InstancedMesh(logGeometry(false), mat, MAXL), stumps = new THREE.InstancedMesh(stumpGeometry(), mat, MAXS), snags = new THREE.InstancedMesh(snagGeometry(), mat, MAXN);
	const all = [logs, limbs, stumps, snags];
	for (const m of all) { m.count = 0; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.userData.material175 = 'wood'; scene.add(m); }
	logs.name = 'forest-logs'; limbs.name = 'forest-limbs'; stumps.name = 'forest-stumps'; snags.name = 'forest-snags';

	const H = (x, z) => bay.heightAt(x, z);
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
	const dir = new THREE.Vector3(), side = new THREE.Vector3(), upP = new THREE.Vector3(), zA = new THREE.Vector3(), col = new THREE.Color();

	// the woodland at a point as city.js reckons it (wildLand), or null where it grows no tree
	function woodAt(x, z) {
		const h = H(x, z);
		if (h < 3) return null;
		if (real?.inside(x, z)) {
			const L = real.landAt(x, z);
			if (!L || (L.lu !== 0 && L.lu !== 11 && L.lu !== 12) || L.road > 0.2 || L.roof > 0.2) return null;
		} else if (bay.urbanAt(x, z).u > 0.06) return null;
		const e = 18, hxp = H(x + e, z), hxm = H(x - e, z), hzp = H(x, z + e), hzm = H(x, z - e);
		const slope = Math.hypot(hxp - hxm, hzp - hzm) / (2 * e);
		if (slope > 1.1) return null;
		const north = Math.max(-1, Math.min(1, (hzp - hzm) / (2 * e) * 4));
		const gully = Math.max(0, Math.min(1, (hxp + hxm + hzp + hzm - 4 * h) / 6));
		const high = Math.min(1, Math.max(0, (h - 350) / 600));
		const grove = vnoise(x / 140, z / 140) * 0.7 + vnoise(x / 45 + 9, z / 45 + 3) * 0.3;
		const wood = Math.min(1, Math.max(0, (0.08 + north * 0.55 + gully * 0.7 + slope * 0.2 - high * 0.15) * (0.25 + grove * 1.5)));
		const fq = Math.min(1, Math.max(0, (x - 22000) / 36000)), fog = 1 - fq * fq * (3 - 2 * fq);
		// (the planted city parks are kept; the wind-scoured bluffs by the sea have no wood)
		if (GREENS.some((G) => Math.abs(x - G.x) < G.rx && Math.abs(z - G.z) < G.rz)) return null;
		if (fog > 0.5 && (H(x - 900, z) < -2 || H(x - 2200, z) < -2 || (x < 12000 && H(x, z + 1500) < -2))) return null;
		return { h, wood, fog, high, slope, north, gully };
	}
	// the trunks city.js stands in a cell of its near scatter: [x, z, radius to keep clear],
	// the redwoods with the ring of younger ones round where an old one stood
	const cells = new Map();
	function trunks(gx, gz) {
		const key = gx * 100003 + gz;
		if (cells.has(key)) return cells.get(key);
		let t = null;
		if (hash(gx * 1.7 + 11, gz * 2.3 + 5) <= 0.62) {
			const x = (gx + hash(gx, gz * 3) * 1.6 - 0.3) * C, z = (gz + hash(gx * 5, gz) * 1.6 - 0.3) * C;
			const W = woodAt(x, z), r2 = hash(gx * 3.1 + 7, gz * 1.3 + 3);
			if (W && r2 < W.wood * 0.8) {
				t = [[x, z, 1.8]];
				if (W.fog > 0.6 && (W.gully > 0.1 || W.north > 0.1 || W.slope < 0.3) && W.high < 0.5) {
					for (let k = 0, n = 2 + Math.floor(hash(gx * 2.3, gz * 5.9) * 4); k < n; k++) { const a = k / n * 6.283 + r2 * 3, rr = 4 + hash(gx + k, gz - k) * 3; t.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr, 1.4]); }
				}
			}
		}
		cells.set(key, t);
		return t;
	}
	// is a log from a to b of radius rad clear of every trunk?
	function clear(ax, az, bx, bz, rad) {
		const pad = 10, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
		for (let gz = Math.floor((Math.min(az, bz) - pad) / C); gz <= Math.floor((Math.max(az, bz) + pad) / C); gz++) for (let gx = Math.floor((Math.min(ax, bx) - pad) / C); gx <= Math.floor((Math.max(ax, bx) + pad) / C); gx++) {
			const t = trunks(gx, gz);
			if (t) for (const [tx, tz, tr] of t) {
				const u = Math.max(0, Math.min(1, ((tx - ax) * dx + (tz - az) * dz) / L2));
				if (Math.hypot(ax + dx * u - tx, az + dz * u - tz) < rad + tr) return false;
			}
		}
		return true;
	}

	function rebuild(cx, cz) {
		let nl = 0, ns = 0, nb = 0, nn = 0;
		if (cells.size > 60000) cells.clear();
		for (let gz = Math.floor((cz - R) / C); gz <= Math.floor((cz + R) / C); gz++) for (let gx = Math.floor((cx - R) / C); gx <= Math.floor((cx + R) / C); gx++) {
			// only where city.js stands no tree (its own roll: most cells are open ground)
			if (hash(gx * 1.7 + 11, gz * 2.3 + 5) <= 0.62) continue;
			const k = hash(gx * 4.3 + 17, gz * 3.7 - 9);
			if (k > 0.3) continue;
			const x = (gx + 0.2 + hash(gx * 9 + 1, gz * 2) * 0.6) * C, z = (gz + 0.2 + hash(gx * 2, gz * 9 + 1) * 0.6) * C;
			if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > R * R) continue;
			const W = woodAt(x, z);
			if (!W || W.wood < 0.3 || W.slope > 0.8) continue;
			const conifer = W.fog > 0.6 && W.high < 0.5, r2 = hash(gx * 5.3, gz * 7.1 + 2);
			const burnt = Math.hypot(x - BURN.x, z - BURN.z) < BURN.r;
			if (k > 0.27) {
				// a snag: a dead tree still standing, white-grey, or black from the fire
				if (W.wood < 0.35 || nn >= MAXN) continue;
				const rad = conifer ? 0.5 + r2 * 0.8 : 0.22 + r2 * 0.2, hgt = conifer ? 14 + r2 * 22 : 5 + r2 * 7;
				if (!clear(x, z, x, z, rad * 1.3)) continue;
				Q.setFromAxisAngle(UP, r2 * 6.283);
				M.compose(P.set(x, W.h - 0.3, z), Q, S.set(rad, hgt, rad));
				snags.setMatrixAt(nn, M);
				const j = 0.85 + r2 * 0.3;
				snags.setColorAt(nn++, burnt ? col.setRGB(0.16, 0.14, 0.13) : conifer ? col.setRGB(j * 0.85, j * 0.78, j * 0.72) : col.setRGB(j, j, j));
				continue;
			}
			if (k < 0.2 * W.wood && (conifer ? nl : nb) < MAXL) {
				// a fallen tree, half sunk in the duff: a great conifer in the fog belt, a limb
				// under the oaks
				// (the longest that lies clear of the standing trunks, at one of three angles)
				const rad = conifer ? 0.35 + r2 * r2 * 0.9 : 0.12 + r2 * 0.18;
				let len = 0, yaw = 0;
				for (let t = 0; t < 6 && !len; t++) {
					const l = (conifer ? 7 + r2 * 20 : 2.5 + r2 * 5) * [1, 0.6, 0.35][t >> 1], a = hash(gx * 2.9 + t, gz * 1.9 + 4) * Math.PI;
					if (clear(x - Math.cos(a) * l / 2, z - Math.sin(a) * l / 2, x + Math.cos(a) * l / 2, z + Math.sin(a) * l / 2, rad)) { len = l; yaw = a; }
				}
				if (!len) continue;
				const ux = Math.cos(yaw) * len / 2, uz = Math.sin(yaw) * len / 2;
				const y0 = H(x - ux, z - uz) + rad * 0.55, y1 = H(x + ux, z + uz) + rad * 0.55;
				dir.set(ux * 2, y1 - y0, uz * 2).normalize();
				side.crossVectors(dir, UP).normalize();
				upP.crossVectors(side, dir);
				zA.crossVectors(upP, dir);
				M.makeBasis(upP.multiplyScalar(rad), dir.multiplyScalar(len), zA.multiplyScalar(rad));
				M.setPosition(x, (y0 + y1) / 2, z);
				const j = (0.8 + hash(gx, gz * 3.3) * 0.35) * (burnt ? 0.4 : 1);
				if (conifer) { logs.setMatrixAt(nl, M); logs.setColorAt(nl++, col.setRGB(j, j * 0.95, j * 0.9)); }
				else { limbs.setMatrixAt(nb, M); limbs.setColorAt(nb++, col.setRGB(j * 0.92, j * 0.95, j)); }
			} else if (k < 0.26 * W.wood && conifer && ns < MAXS) {
				// an old stump from the logging, taller than a man on the biggest
				const rad = 0.5 + r2 * 1.1, hgt = 0.6 + hash(gx * 1.3, gz * 4.1) * 2.2;
				if (!clear(x, z, x, z, rad * 1.15)) continue;
				Q.setFromAxisAngle(UP, r2 * 6.283);
				M.compose(P.set(x, W.h + hgt / 2 - 0.2, z), Q, S.set(rad, hgt, rad));
				stumps.setMatrixAt(ns, M);
				const j = 0.8 + r2 * 0.35;
				stumps.setColorAt(ns++, burnt ? col.setRGB(0.3, 0.27, 0.25) : col.setRGB(j, j, j));
			}
		}
		logs.count = nl; stumps.count = ns; limbs.count = nb; snags.count = nn;
		for (const m of all) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
	}

	// the haze among the trunks: how many tall trees stand round you, eased
	let at = null, levelsN = -1, hazeT = 0, haze = 0, lastT = 0, lastProbe = 0;
	const BLUE = new THREE.Color(0.78, 0.86, 1.0), tmp = new THREE.Color();
	const lum = (c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

	function update(camera) {
		wild?.update(camera);
		if (!bay.loaded()) { for (const m of all) m.visible = false; return; }
		const x = camera.position.x, z = camera.position.z, agl = camera.position.y - H(x, z);
		const now = performance.now() / 1000, dt = Math.min(0.2, now - lastT);
		lastT = now;
		// the logs round you, laid again as you move on (or as finer heights arrive)
		for (const m of all) m.visible = agl < 600;
		if (agl < 600) {
			const n = bay.levels.filter(Boolean).length;
			if (n !== levelsN) cells.clear();
			if (!at || n !== levelsN || Math.hypot(x - at.x, z - at.z) > 50) { at = { x, z }; levelsN = n; rebuild(x, z); }
		}
		// a light blue-grey haze where tall conifers close round you on the ground (the fog is
		// set afresh each frame before this: here it only thickens)
		if (now - lastProbe > 0.25) {
			lastProbe = now;
			const tall = agl < 60 && city?.treesNear ? city.treesNear(x, z, 40).filter((t) => t.cone && t.h > 20).length : 0;
			hazeT = Math.min(1, tall / 10);
		}
		haze += (hazeT - haze) * Math.min(1, dt * 1.5);
		const fog = scene.fog;
		if (haze > 0.01 && fog && fog.density > 0) {
			fog.density = Math.max(fog.density, 0.0028 * haze);
			tmp.copy(BLUE).multiplyScalar(lum(fog.color) / lum(BLUE));
			fog.color.lerp(tmp, 0.5 * haze);
		}
	}

	return { update, logs, stumps, limbs, snags, wild };
}
