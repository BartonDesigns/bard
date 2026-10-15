// Street trees by era (streetera.js). The mapped streets' own row of trees (the bake set one
// every 11 to 19 m behind each residential sidewalk, all alike) is planted again as its
// neighbourhood would have it: London planes and ginkgos in tree wells with iron grates down
// an old core's brick sidewalks, big sycamores, planes, elms and oaks over the streetcar
// suburbs, a mix of middling trees and the odd palm in the postwar tracts, tidy young pears
// and crape myrtles in the newer ones, and saplings on stakes in a string-straight row in
// the newest. They join the city's trees (city.js), whose tiers draw them, and keep off the
// carriageways, drives, corners and sight lines like every other tree (clearance.js); only a
// tree in a well may stand in the sidewalk. Their stakes, grates and the leaves they drop in
// autumn are drawn here, instanced, round you.

import * as THREE from 'three';
import { eraMap, treeRow, treeFor } from './streetera.js';
import { today } from '../calendar.js';
import { leafDrift, autumnK, crownColour } from './seasons.js';
import { qualityNow } from '../world/governor.js';

const BUILT = new Set([1, 2, 6, 7, 13]);           // land use where a street has its trees: homes, parks, schools, shops, the core
const hash = (x, z) => { let h = Math.imul(Math.floor(x * 10) | 0, 374761393) ^ Math.imul(Math.floor(z * 10) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// The street trees round (cx, cz) within R, in place of the bake's: trees is the city's list
// (city.js update), returned with the bake's street rows taken out and the era's put in.
// ground(x, z): the ground's height; cap: the most to plant (the nearest kept)
export function streetTrees(real, trees, cx, cz, R, ground, cap = 9000) {
	const E = eraMap(real);
	if (!E) return trees;
	// the walked streets near, in a grid of 32 m cells, for telling the bake's street rows
	const C = 32, cells = new Map(), key = (i, j) => i * 65536 + j;
	const roads = real.near('roads', cx, cz, R + 60).filter((r) => r.drive && r.walked && !r.bridge && !r.link && !r.hand);
	for (const r of roads) {
		const p = r.pts, m = r.w / 2 + 4.5;
		for (let k = 0; k + 3 < p.length; k += 2) {
			for (let i = Math.floor((Math.min(p[k], p[k + 2]) - m) / C); i <= Math.floor((Math.max(p[k], p[k + 2]) + m) / C); i++) for (let j = Math.floor((Math.min(p[k + 1], p[k + 3]) - m) / C); j <= Math.floor((Math.max(p[k + 1], p[k + 3]) + m) / C); j++) {
				let c = cells.get(key(i, j));
				if (!c) cells.set(key(i, j), c = []);
				c.push(r, k);
			}
		}
	}
	// the bake's street trees stood 3 m outside the carriageway: those go
	const baked = (t) => {
		const c = cells.get(key(Math.floor(t.x / C), Math.floor(t.z / C)));
		if (!c) return false;
		for (let n = 0; n < c.length; n += 2) {
			const r = c[n], p = r.pts, k = c[n + 1], ax = p[k], az = p[k + 1], dx = p[k + 2] - ax, dz = p[k + 3] - az, l2 = dx * dx + dz * dz || 1;
			const u = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / l2)), d = Math.hypot(t.x - ax - dx * u, t.z - az - dz * u);
			if (Math.abs(d - (r.w / 2 + 3)) < 0.9) return true;
		}
		return false;
	};
	const R2 = R * R;
	const out = trees.filter((t) => t.src !== 'real' || t.cone || (t.x - cx) ** 2 + (t.z - cz) ** 2 > R2 || !baked(t));
	// and the era's own rows, both sides of each street
	const mine = [];
	for (const r of roads) {
		const p = r.pts, hw = r.w / 2, era = E.ofRoad(r);
		let L = 0;
		const cum = [0];
		for (let k = 0; k + 3 < p.length; k += 2) { L += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); cum.push(L); }
		if (L < 12) continue;
		for (const side of [-1, 1]) {
			let h = (Math.imul(Math.round(p[0] * 2) + side * 7919, 2654435761) ^ Math.imul(Math.round(p[1] * 2), 40503)) >>> 0;
			const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; h ^= h >>> 13; return h / 4294967296; };
			let seg = 0;
			for (const s of treeRow(era.key, L, rnd)) {
				while (seg + 2 < cum.length && cum[seg + 1] < s) seg++;
				const ax = p[seg * 2], az = p[seg * 2 + 1], sl = cum[seg + 1] - cum[seg] || 1, tx = (p[seg * 2 + 2] - ax) / sl, tz = (p[seg * 2 + 3] - az) / sl;
				// the era where this one stands (a long street runs through more than one)
				const here = E.at(ax + tx * (s - cum[seg]), az + tz * (s - cum[seg]));
				const T = treeFor(here.key, rnd(), rnd(), rnd(), Math.max(0, Math.min(1, 1 - (ax - 22000) / 36000)));
				const off = T.well ? hw + 0.85 : hw + 3.0;
				const x = ax + tx * (s - cum[seg]) - tz * off * side, z = az + tz * (s - cum[seg]) + tx * off * side;
				if ((x - cx) ** 2 + (z - cz) ** 2 > R2) continue;
				const Lu = real.landAt(x, z);
				if (!Lu || !BUILT.has(Lu.lu) || Lu.roof > 0.45) continue;
				const g = ground(x, z);
				if (!(g > 0.5)) continue;
				const j = hash(x, z);
				mine.push({ src: 'street', x, y: g - 0.3, z, h: T.h * (0.9 + j * 0.2), sp: T.sp, cone: false, col: T.col, fall: T.fall, nx: T.nx, stake: T.stake, well: T.well, era: here.idx, kind: T.species });
			}
		}
	}
	if (mine.length > cap) { mine.sort((a, b) => (a.x - cx) ** 2 + (a.z - cz) ** 2 - ((b.x - cx) ** 2 + (b.z - cz) ** 2)); mine.length = cap; }
	for (const t of mine) out.push(t);
	return out;
}

// a deciduous street tree's crown this day (autumn: city.js placeTrees asks)
const tmpC = [0, 0, 0];
export function treeColour(t, k) { return t.fall ? crownColour(t.col, t.fall, k, tmpC) : t.col; }
export const autumnNow = () => autumnK(today());

// ---------- the things at their feet: stakes, grates, fallen leaves ----------
export function createStreetDecor(scene, city, { isPhone = false } = {}) {
	const group = new THREE.Group();
	group.name = 'street-tree-decor';
	scene.add(group);
	const R = isPhone ? 140 : 240, CAP = isPhone ? 600 : 1500, LCAP = isPhone ? 500 : 1400;
	// a young tree's two stakes and the rubber ties to it
	const stakeGeo = (() => {
		const parts = [];
		for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.05, 2.1, 0.05); g.translate(s * 0.32, 1.05 - 0.15, 0); parts.push(g); }
		for (const y of [1.15, 1.7]) { const g = new THREE.BoxGeometry(0.66, 0.03, 0.025); g.translate(0, y, 0); parts.push(g); }
		const out = new THREE.BufferGeometry(), P = [], N = [];
		for (const g of parts) { const q = g.toNonIndexed(); P.push(...q.attributes.position.array); N.push(...q.attributes.normal.array); }
		out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
		return out;
	})();
	const stakes = new THREE.InstancedMesh(stakeGeo, new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.9 }), CAP);
	// an iron tree grate in the brick, its slots in rings
	const grateTex = (() => {
		const cv = document.createElement('canvas'); cv.width = cv.height = 128;
		const g = cv.getContext('2d');
		g.fillStyle = '#2a2826'; g.fillRect(0, 0, 128, 128);
		g.strokeStyle = '#0c0b0a'; g.lineWidth = 3;
		for (let r = 20; r < 62; r += 9) for (let a = 0; a < 24; a++) { const a0 = a / 24 * Math.PI * 2 + r * 0.05, a1 = a0 + 0.17; g.beginPath(); g.arc(64, 64, r, a0, a1); g.stroke(); }
		g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(64, 64, 14, 0, Math.PI * 2); g.fill();
		g.strokeStyle = '#4a4542'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
		const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
	})();
	const grates = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: grateTex, roughness: 0.55, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), CAP);
	// fallen leaves under the deciduous ones in autumn: a drift drawn on a card, laid flat
	const leafTex = (() => {
		const cv = document.createElement('canvas'); cv.width = cv.height = 256;
		const g = cv.getContext('2d');
		let s = 11;
		const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
		const cols = ['#b5651d', '#d4a017', '#8b4513', '#c8782a', '#9c3b16', '#e0b040', '#7a5a2a'];
		for (let n = 0; n < 900; n++) {
			const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.7) * 120, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
			g.save(); g.translate(x, y); g.rotate(rnd() * 6.28); g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.globalAlpha = 0.75 + rnd() * 0.25;
			g.beginPath(); g.ellipse(0, 0, 3 + rnd() * 3, 1.6 + rnd() * 1.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
		}
		const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
	})();
	const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
	const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), leafMat, LCAP);
	for (const im of [stakes, grates, leaves]) { im.count = 0; im.frustumCulled = false; im.receiveShadow = true; group.add(im); }
	stakes.castShadow = true;
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
	let seen = null, atX = 1e9, atZ = 1e9, drift = 0;
	function build(x, z) {
		atX = x; atZ = z;
		drift = leafDrift(today());
		leafMat.opacity = Math.min(1, drift * 1.2);
		let ns = 0, ng = 0, nl = 0;
		const Rq = R * qualityNow().far;          // (nearer on a lower quality tier: world/governor.js)
		for (const t of city.treesAt(x, z, Rq)) {
			if (t.src !== 'street' || (t.x - x) ** 2 + (t.z - z) ** 2 > Rq * Rq) continue;
			const yaw = hash(t.x * 1.3, t.z * 0.7) * 6.283;
			if (t.stake && ns < CAP) { m4.compose(p.set(t.x, t.y + 0.3, t.z), q.setFromAxisAngle(Y, yaw), sc.set(1, 1, 1)); stakes.setMatrixAt(ns++, m4); }
			if (t.well && ng < CAP) { m4.compose(p.set(t.x, t.y + 0.33, t.z), q.setFromAxisAngle(Y, yaw - yaw % (Math.PI / 2)), sc.set(1, 1, 1)); grates.setMatrixAt(ng++, m4); }
			if (t.fall && drift > 0.02 && nl < LCAP) {
				// a drift round the trunk, out to most of the crown, and one blown off to the side
				const rr = Math.max(2, t.h * 0.32 * (t.nx || 1));
				m4.compose(p.set(t.x, t.y + 0.34, t.z), q.setFromAxisAngle(Y, yaw), sc.set(rr * 2, 1, rr * 2)); leaves.setMatrixAt(nl++, m4);
				if (nl < LCAP) { const a = yaw * 3.1, o = rr * 0.9; m4.compose(p.set(t.x + Math.cos(a) * o, t.y + 0.345, t.z + Math.sin(a) * o), q.setFromAxisAngle(Y, a), sc.set(rr * 1.2, 1, rr * 1.2)); leaves.setMatrixAt(nl++, m4); }
			}
		}
		stakes.count = ns; grates.count = ng; leaves.count = nl;
		for (const im of [stakes, grates, leaves]) { im.instanceMatrix.needsUpdate = true; im.visible = im.count > 0; }
	}
	function update(cam) {
		const x = cam.position.x, z = cam.position.z, list = city.nearList?.();
		if (cam.position.y > 3000) { group.visible = false; return; }
		group.visible = true;
		// the city rebuilt its trees, or you have come a way since
		if (list !== seen || Math.hypot(x - atX, z - atZ) > R * 0.4) { seen = list; build(x, z); }
	}
	return { update, group, info: () => ({ stakes: stakes.count, grates: grates.count, leaves: leaves.count, drift: +drift.toFixed(2) }) };
}
