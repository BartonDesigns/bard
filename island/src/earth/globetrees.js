// The globe's trees and bushes, out where the Bay's own woods (bay/city.js) don't reach: grown
// where the ground is painted wooded (the same tree cover and the same patches as the terrain's
// colours, globeterrain.js), of the kinds the place has. The kinds come from the atlas's list
// of the region's plants, read for their form (pines, firs and spruces are conifers; palms
// are palms; sage, scrub and heath are bushes; oaks, maples, beeches and the rest broadleaf),
// the first named the most common; and the warmth of the place and the height up the
// mountain lean it cold (conifers) or dry (bushes).
//
// Two tiers: whole trees within 380 m, their simpler selves out to 2.4 km, dissolving into each
// other (world/lodfade.js). The trees stand on a grid of the latitude and longitude, so the
// same tree is in the same place whatever the frame (globeframe.js); they are laid out a slice
// at a time as you move, and simply shifted when the frame does.

import * as THREE from 'three';
import { hardwood, conifer, shrub, swayMaterial, Builder, tube, strip, V } from '../world/vegetation.js';
import * as TX from '../world/textures.js';
import { addLodFade } from '../world/lodfade.js';
import { mulberry32 } from '../noise.js';
import { F, toXZ, RAD, EARTH_R, lonRaw } from './globeframe.js';
import { vn3, S0 } from './globeheight.js';
import { today } from '../calendar.js';

const FORMS = ['broad', 'conifer', 'palm', 'bush'];
const WORDS = [
	[/pine|fir\b|spruce|cedar|larch|hemlock|juniper|cypress|redwood|sequoia|yew|conifer|taiga|tamarack/i, 'conifer'],
	[/palm|coconut|date\b/i, 'palm'],
	[/sage|brush|scrub|shrub|heath|gorse|broom|maquis|garrigue|creosote|mesquite|saxaul|tamarisk|bush|thorn|fynbos|chaparral|cactus|agave|succulent|grass|moss|lichen|saxifrage|poppy|sedge|crowberry|cloudberry|dwarf|tundra|arctic|angelica|fireweed/i, 'bush'],
];
const formOf = (w) => (WORDS.find(([re]) => re.test(w)) || [null, 'broad'])[1];

// a palm: a leaning ringed trunk under a crown of long drooping fronds
function palmTree(seed) {
	const r = mulberry32(seed), trunk = new Builder(), b = new Builder();
	const H = 9 + r() * 6, la = r() * 6.28, lean = 0.6 + r() * 1.2, path = [], radii = [];
	for (let k = 0; k <= 6; k++) { const t = k / 6; path.push(V(Math.cos(la) * lean * t * t, H * t - (k === 0 ? 0.3 : 0), Math.sin(la) * lean * t * t)); radii.push(0.24 - 0.08 * t + 0.1 * Math.exp(-t * 12)); }
	tube(trunk, path, radii, 6, new THREE.Color(0.6, 0.53, 0.43), (t) => t * t * 0.3);
	const top = path[6];
	for (let f = 0; f < 11; f++) {
		const a = f * 2.39996 + r() * 0.3, L = 3.2 + r() * 1.4, elev = 0.7 - (f % 3) * 0.35, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 6; k++) { const t = k / 6, d = L * t; pts.push(top.clone().add(dir.clone().multiplyScalar(Math.cos(elev) * d)).add(V(0, Math.sin(elev) * d - 0.7 * d * d / L, 0))); widths.push(0.1 + 0.7 * Math.sin(Math.min(1, t * 1.1) * Math.PI) * Math.min(1, t * 3)); }
		strip(b, pts, widths, 0.1, { r: 0.18, g: 0.3, b: 0.1 }, { r: 0.3, g: 0.4, b: 0.14 }, 0.5, 1.2, 0.8);
	}
	return { parts: [trunk.geometry(), b.geometry()], height: H + 1 };
}

export function createGlobeTrees({ scene, shared, data, heightAt, isPhone, allowed }) {
	const group = new THREE.Group();
	group.name = 'globe trees';
	scene.add(group);
	const leafTex = TX.leafCluster(), barkT = TX.woodBark(); barkT.repeat.set(2, 3);
	const NEAR = isPhone ? 260 : 380, FAR = isPhone ? 1300 : 2400;
	const BAND = { near: [-2, -1, NEAR - 40, NEAR], far: [NEAR - 40, NEAR, FAR - 300, FAR] };
	const CAP = isPhone ? { near: 1500, far: 5000 } : { near: 3500, far: 14000 };
	const G = {
		broad: { height: 12, crown: 'round', bark: [1.05, 1, 0.95], leaf: [1, 1.05, 0.85] },
		// (naturalist: grey-brown bark, a spruce's or fir's; the red bark is the coast redwood's alone)
		conifer: { height: 22, crown: 'columnar', bark: [0.82, 0.74, 0.68], leaf: [0.6, 0.78, 0.62], conifer: true },
	};
	const geo = {
		broad: { near: hardwood(7101, false, true, G.broad), far: hardwood(7101, true, false, G.broad) },
		conifer: { near: conifer(7117, false, true, G.conifer), far: conifer(7117, true, false, G.conifer) },
		palm: { near: palmTree(7131), far: palmTree(7131) },
		bush: { near: shrub(7151), far: shrub(7151) },
	};
	function tier(parts, cap, band, shadow) {
		const mats = [swayMaterial({ map: barkT, roughness: 0.95 }, shared, 1), swayMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8)];
		for (const M of mats) addLodFade(M.material, 'uniform', band);
		return parts.map((g, n) => {
			const im = new THREE.InstancedMesh(g, mats[n].material, cap);
			im.count = 0; im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true;
			if (mats[n].depth) im.customDepthMaterial = mats[n].depth;
			if (n === 1) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
			group.add(im);
			return im;
		});
	}
	const T = {};
	for (const f of FORMS) T[f] = { near: tier(geo[f].near.parts, CAP.near, BAND.near, !isPhone), far: tier(geo[f].far.parts, CAP.far, BAND.far, false), H: geo[f].near.height };

	// ---------- where and what ----------
	let mix = { broad: 1, conifer: 0, palm: 0, bush: 0 }, mixAt = null;
	// the region's plants as a mix of forms (atlas: the first named the most)
	function setRegion(veg) {
		const m = { broad: 0.05, conifer: 0, palm: 0, bush: 0 };
		(veg || []).forEach((w, i) => { m[formOf(w)] += 1 / (i + 1.5); });
		const t = Object.values(m).reduce((a, b) => a + b, 0);
		for (const k in m) m[k] /= t;
		// the tundra: dwarf plants only, no cold lean to conifers
		m.treeless = m.conifer + m.palm < 0.01 && m.bush > 0.8;
		mix = m;
	}
	const hash = (a, b, s) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ s; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 8) / 16777216; };
	const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	const clamp01 = (x) => Math.min(1, Math.max(0, x));
	// the terrain's own wooded mask at a point (see globeterrain.js's colours)
	function woodAt(lat, lon, h, slope, cell) {
		const cp = Math.cos(lat * RAD), p = [EARTH_R * cp * Math.cos(lon * RAD), EARTH_R * cp * Math.sin(lon * RAD), EARTH_R * Math.sin(lat * RAD)];
		const m2 = 4 / S0, m4 = 16 / S0, m6 = 64 / S0;
		const pB = vn3(p[0] * m2, p[1] * m2, p[2] * m2, 11), pM = vn3(p[0] * m4, p[1] * m4, p[2] * m4, 23), pS = vn3(p[0] * m6, p[1] * m6, p[2] * m6, 37);
		// (the cells read between, their edges wandering, as the terrain reads them)
		const c = data.smoothAt(lat, lon, (pB - 0.5) * 0.8, (pM - 0.5) * 0.15);
		const air = c.TEMP - 6.5 * Math.max(0, h - 400 - 0.5 * cell.E) / 1000;       // (as the terrain's, globeterrain.js)
		// thinner where the land is farmed (its slope as the terrain has it, 1 - the normal's up)
		const s1 = 1 - 1 / Math.hypot(1, slope);
		const farmable = Math.max(sst(380, 560, c.RAIN) * sst(3, 9, c.TEMP) * (1 - (1 - sst(650, 850, c.RAIN)) * Math.max(sst(0.3, 0.45, c.TREES), sst(12, 15, c.TEMP) * sst(250, 450, h))), sst(150, 260, c.RAIN) * (1 - sst(300, 600, h)) * sst(12, 16, c.TEMP) * 0.75) * (1 - sst(0.004, 0.012, s1)) * (1 - sst(1200, 2200, h));
		return { k: sst(0.44, 0.56, c.TREES + (pM - 0.5) * 0.7 + (pS - 0.5) * 0.35 - farmable * 0.12) * sst(-4.5, -2, air) * (1 - sst(0.55, 0.85, s1)), air };
	}
	// one grid of the latitude and longitude: rows `step` metres apart, each row's cells as wide
	function* lay(cx, cz, R, step, out, tierName) {
		const ll = { lat: F.lat - (cz - F.fz) / F.kz, lon: lonRaw(cx) };
		const dLat = step / 110996, r0 = Math.floor((ll.lat - R / 110996) / dLat), r1 = Math.ceil((ll.lat + R / 110996) / dLat);
		let n = 0;
		for (let row = r0; row <= r1; row++) {
			const lat = (row + 0.5) * dLat, kx = 111320 * Math.cos(lat * RAD), dLon = step / kx;
			const half = Math.sqrt(Math.max(0, R * R - ((lat - ll.lat) * 110996) ** 2)) / kx;
			for (let col = Math.floor((ll.lon - half) / dLon); col <= Math.ceil((ll.lon + half) / dLon); col++) {
				const r = hash(row, col, 91);
				if (r > 0.55) continue;
				const la = lat + (hash(row, col, 3) - 0.5) * dLat * 0.9, lo = (col + 0.5 + (hash(row, col, 5) - 0.5) * 0.9) * dLon;
				const p = toXZ(la, lo);
				const d2 = (p.x - cx) ** 2 + (p.z - cz) ** 2;
				if (d2 > R * R || (tierName === 'far' && d2 < (NEAR - 60) ** 2)) continue;
				if (!allowed(p.x, p.z)) continue;
				const cell = data.cellAt(la, lo);
				if (cell.TREES < 0.05 && cell.RAIN < 150) continue;
				const h = heightAt(p.x, p.z);
				if (h < 1) continue;
				const e = step * 0.5, slope = Math.hypot(heightAt(p.x + e, p.z) - h, heightAt(p.x, p.z + e) - h) / e;
				const W = woodAt(la, lo, h, slope, cell);
				// wooded ground: trees; open ground: a few bushes and the odd tree
				const open = r > W.k * 0.55;
				if (open && r > 0.05 + (1 - cell.TREES) * 0.02) continue;
				// (naturalist: out on open prairie and steppe the odd tree stands by water, a
				// cottonwood or willow along a creek, not scattered over the grass)
				if (open && cell.TREES < 0.25 && (cell.RV || 0) < 0.2 && hash(row, col, 41) > 0.2) continue;
				// the form: the region's mix, leaned cold by the air up here and dry by little rain
				const cold = sst(5, -3, W.air), dry = sst(500, 200, cell.RAIN);
				let q = hash(row, col, 17), form = 'broad';
				const wC = mix.treeless ? 0 : mix.conifer + cold * 0.8, wP = mix.palm * sst(15, 21, W.air), wB = mix.bush + dry * 0.6 + (open ? 0.5 : 0), wBr = mix.treeless ? 0 : mix.broad * (1 - cold * 0.7);
				const tot = wC + wP + wB + wBr;
				q *= tot;
				if ((q -= wC) < 0) form = 'conifer'; else if ((q -= wP) < 0) form = 'palm'; else if ((q -= wB) < 0) form = 'bush'; else form = 'broad';
				// (naturalist: a lone tree on dry open ground is a juniper or a pinyon, not an oak)
				if (open && dry > 0.5 && form === 'broad' && !mix.treeless) form = 'conifer';
				const s = form === 'bush' ? 0.8 + hash(row, col, 23) * 0.9 : (0.65 + hash(row, col, 29) * 0.6) * (1 - sst(-1, -4, W.air) * 0.4) * (open && dry > 0.5 ? 0.3 : 1);
				out.push({ x: p.x, y: h - 0.2, z: p.z, s, a: hash(row, col, 31) * 6.283, form, t: hash(row, col, 37), la });
				if (++n % 60 === 0) yield;
			}
		}
	}

	// ---------- laying out as you move ----------
	let job = null, at = null, placed = { near: [], far: [] }, epoch = -1;
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
	// autumn: how far into its colour a broadleaf wood is this month (0..1), past 35 degrees; the
	// colour comes first in the far north, peaks mid-October at 45 (mid-April in the south)
	const AUTUMN = [[1.7, 0.95, 0.3], [1.9, 0.75, 0.25], [2.1, 0.5, 0.28]];       // yellow, orange, red (times the green leaf)
	function autumnK(la) {
		const a = Math.abs(la);
		if (a < 35) return 0;
		const d = today(), m = (d.getMonth() + (d.getDate() - 1) / 30 + (la < 0 ? 6 : 0)) % 12;
		const peak = 9.5 - (a - 45) * 0.05;
		return clamp01(1 - Math.abs(m - peak) / 1.4) * sst(35, 40, a);
	}
	function commit(name, list) {
		const cnt = {};
		for (const f of FORMS) cnt[f] = 0;
		for (const it of list) {
			const M = T[it.form][name], k = cnt[it.form];
			if (k >= M[0].instanceMatrix.count) continue;
			q.setFromAxisAngle(UP, it.a); sc.setScalar(it.s); pos.set(it.x, it.y, it.z);
			m4.compose(pos, q, sc);
			for (const im of M) im.setMatrixAt(k, m4);
			const tone = 0.8 + it.t * 0.4;
			col.setRGB(tone * (0.95 + it.t * 0.1), tone, tone * (0.9 + (1 - it.t) * 0.15));
			if (it.form === 'broad' && it.la !== undefined) {
				// each tree turns in its own time, yellow the most, then orange, then red
				const k = clamp01(autumnK(it.la) * 1.3 - it.t * 0.45);
				if (k > 0) { const A = AUTUMN[it.t < 0.5 ? 0 : it.t < 0.8 ? 1 : 2]; col.setRGB(col.r + (A[0] * tone - col.r) * k, col.g + (A[1] * tone - col.g) * k, col.b + (A[2] * tone - col.b) * k); }
			}
			M[1].setColorAt(k, col);
			cnt[it.form]++;
		}
		for (const f of FORMS) for (const im of T[f][name]) { im.count = Math.min(cnt[f], im.instanceMatrix.count); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
	}
	function* build(cx, cz) {
		const near = [], far = [];
		yield* lay(cx, cz, NEAR, isPhone ? 14 : 10, near, 'near');
		commit('near', near); placed.near = near;
		yield* lay(cx, cz, FAR, isPhone ? 40 : 28, far, 'far');
		commit('far', far); placed.far = far;
	}
	let winV = -1, monthAt = -1;
	function update(cam, veg, on, version) {
		group.visible = on;
		if (!on) return;
		if (version !== winV) { winV = version; at = null; job = null; }
		if (veg !== mixAt) { mixAt = veg; setRegion(veg); at = null; }
		const mo = today().getMonth();
		if (mo !== monthAt) { monthAt = mo; at = null; }
		const x = cam.position.x, z = cam.position.z;
		if (epoch !== F.epoch) { epoch = F.epoch; at = null; job = null; }
		if (!job && (!at || Math.hypot(x - at[0], z - at[1]) > 120)) { at = [x, z]; job = build(x, z); }
		if (job) {
			const t0 = performance.now();
			while (performance.now() - t0 < (isPhone ? 2 : 3.5)) if (job.next().done) { job = null; break; }
		}
	}
	// the frame moved by (dx, dz): the trees with it
	function shift(dx, dz) {
		for (const name of ['near', 'far']) { for (const it of placed[name]) { it.x += dx; it.z += dz; } commit(name, placed[name]); }
		if (at && !job) { at[0] += dx; at[1] += dz; } else at = null;
		job = null; epoch = F.epoch;
	}
	function settle() { while (job && !job.next().done); job = null; }
	const count = () => FORMS.reduce((a, f) => a + T[f].near[0].count + T[f].far[0].count, 0);
	return { group, update, shift, settle, count, mix: () => mix };
}
