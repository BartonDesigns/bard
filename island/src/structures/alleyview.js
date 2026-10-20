// The alleys as you find them. In the surveyed regions they are planned a few blocks at a
// time round you (structures/alleys.js, from the region's own buildings and streets) and
// handed to the real city as a road source, so the road map paints them with the streets
// and the cars and walkers know them; a grown town's came with it (structures/town.js). On
// the procedural grid (no road map there) they are laid here as asphalt strips. All of them
// get their dumpsters against the back walls and a steel back door to each building.

import * as THREE from 'three';
import { planAlleys, ALLEY_W } from './alleys.js';
import { grid as gridAlleys } from './lots.js';
import { srgbToLinear as lin } from '../world/srgb.js';

const C = 250;
function coloured(parts) {
	let n = 0;
	const gs = parts.map(([g, c]) => { const q = g.toNonIndexed(); n += q.attributes.position.count; return [q, lin(c)]; });
	const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
	let k = 0;
	for (const [g, c] of gs) { const m = g.attributes.position.count; pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); for (let i = 0; i < m; i++) col.set(c, (k + i) * 3); k += m; }
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
	return out;
}
const B = (w, h, d, x, y, z, rx = 0) => new THREE.BoxGeometry(w, h, d).rotateX(rx).translate(x, y + h / 2, z);

export function createAlleyView(ctx) {
	const { scene, isPhone, ground } = ctx;
	const R = isPhone ? 220 : 380, BIN_CAP = isPhone ? 160 : 420, DOOR_CAP = isPhone ? 260 : 700;
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 });
	// a commercial dumpster: the steel bin on its casters, two lids, the fork pockets
	const binGeo = coloured([
		[B(1.85, 1.0, 1.1, 0, 0.14, 0), [1, 1, 1]], [B(1.9, 0.06, 0.62, -0.0, 1.13, -0.27, 0.12), [0.08, 0.08, 0.09]], [B(1.9, 0.06, 0.62, 0, 1.15, 0.29, -0.12), [0.08, 0.08, 0.09]],
		[B(1.95, 0.12, 0.12, 0, 0.75, 0.58), [0.8, 0.8, 0.8]], [B(0.3, 0.16, 1.2, -0.62, 0.55, 0), [0.25, 0.25, 0.25]], [B(0.3, 0.16, 1.2, 0.62, 0.55, 0), [0.25, 0.25, 0.25]],
		...[[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]].map(([x, z]) => [B(0.12, 0.14, 0.12, x, 0, z), [0.05, 0.05, 0.05]]),
	]);
	// a back door: the steel leaf in its frame, a step, the lamp over it
	const doorGeo = coloured([
		[B(1.16, 2.24, 0.06, 0, 0, 0.02), [0.32, 0.33, 0.34]], [B(0.98, 2.1, 0.05, 0, 0.02, 0.05), [0.42, 0.43, 0.45]], [B(0.08, 0.04, 0.06, 0.38, 1.0, 0.09), [0.15, 0.15, 0.15]],
		[B(1.3, 0.16, 0.5, 0, -0.04, 0.27), [0.55, 0.54, 0.52]], [B(0.24, 0.16, 0.2, 0, 2.45, 0.12), [0.2, 0.2, 0.2]], [B(0.16, 0.06, 0.12, 0, 2.4, 0.14), [1.0, 0.92, 0.7]],
	]);
	const bins = new THREE.InstancedMesh(binGeo, mat, BIN_CAP), doors = new THREE.InstancedMesh(doorGeo, mat, DOOR_CAP);
	bins.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BIN_CAP * 3), 3);
	for (const m of [bins, doors]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); }
	const stripMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
	const strips = new THREE.Mesh(new THREE.BufferGeometry(), stripMat);
	strips.receiveShadow = true; strips.frustumCulled = false;
	scene.add(strips);

	// ---------- the surveyed regions' alleys, a cell at a time ----------
	const cache = new Map();
	let busy = false, rv = -1, queue = [], lastPaint = 0, fresh = false;
	const key = (i, j) => i * 92821 + j;
	const source = {
		near(kind, x, z, rad, out) {
			if (kind !== 'roads' || busy) return;
			for (let j = Math.floor((z - rad) / C); j <= Math.floor((z + rad) / C); j++) for (let i = Math.floor((x - rad) / C); i <= Math.floor((x + rad) / C); i++) for (const r of cache.get(key(i, j)) || []) out.push(r);
		},
		version: () => 0,
	};
	function plan(i, j) {
		const real = ctx.real();
		busy = true;
		try {
			const cx = (i + 0.5) * C, cz = (j + 0.5) * C;
			// (only where a surveyed region holds it: a grown town planned its own)
			const G = real.R.regions.find((g) => !g.gen && cx > g.bounds[0] && cz > g.bounds[1] && cx < g.bounds[2] && cz < g.bounds[3]);
			if (!G) return [];
			const boxes = real.near('boxes', cx, cz, C * 0.75), roads = real.near('roads', cx, cz, C * 0.75 + 60);
			return planAlleys(boxes, roads, { seed: key(i, j) }).filter((r) => { const mx = (r.pts[0] + r.pts[2]) / 2, mz = (r.pts[1] + r.pts[3]) / 2; return Math.floor(mx / C) === i && Math.floor(mz / C) === j; });
		} catch (e) { console.warn('alleys', e); return []; } finally { busy = false; }
	}
	let registered = null;
	function stream(x, z) {
		const real = ctx.real();
		if (!real?.addSource) return;
		if (registered !== real) { real.addSource(source); registered = real; }
		if (real.version?.() !== rv) { rv = real.version?.(); cache.clear(); queue = []; }
		const reach = isPhone ? 2 : 3, ci = Math.floor(x / C), cj = Math.floor(z / C);
		if (!queue.length) for (let j = cj - reach; j <= cj + reach; j++) for (let i = ci - reach; i <= ci + reach; i++) if (!cache.has(key(i, j))) queue.push([i, j, Math.hypot(i - ci, j - cj)]);
		queue.sort((p, q) => p[2] - q[2]);
		const t0 = performance.now();
		while (queue.length && performance.now() - t0 < (isPhone ? 2.5 : 4)) {
			const [i, j] = queue.shift();
			if (cache.has(key(i, j))) continue;
			const got = plan(i, j);
			cache.set(key(i, j), got);
			if (got.length) fresh = true;
		}
		// (the road map painted again once new ones are in, not more than every few seconds)
		if (fresh && performance.now() - lastPaint > 3000) { fresh = false; lastPaint = performance.now(); real.R?.repaint?.(); }
	}

	// ---------- the bins, the doors, the grid's strips ----------
	const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0), CO = new THREE.Color();
	let px = 1e9, pz = 1e9, gv = -1, cv = -1;
	function place(x, z) {
		px = x; pz = z; gv = gridAlleys.version; cv = cache.size;
		const real = ctx.real(), list = [];
		const seen = new Set();
		for (const r of real?.loaded?.() ? real.near('roads', x, z, R) : []) if (r.alley && !seen.has(r)) { seen.add(r); list.push(r); }
		const grid = gridAlleys.alleys.filter((r) => Math.abs(r.pts[0] - x) < R && Math.abs(r.pts[1] - z) < R);
		let nb = 0, nd = 0;
		for (const r of [...list, ...grid]) {
			for (const [bx, bz, yaw, v] of r.alley.bins) {
				if (nb >= BIN_CAP) break;
				QT.setFromAxisAngle(UP, yaw + Math.PI / 2);
				bins.setMatrixAt(nb, M4.compose(P3.set(bx, ground(bx, bz) + 0.02, bz), QT, S3));
				bins.setColorAt(nb, v ? CO.setRGB(0.12, 0.22, 0.42) : CO.setRGB(0.13, 0.3, 0.17));
				nb++;
			}
			for (const [dx, dz, yaw] of r.alley.doors) {
				if (nd >= DOOR_CAP) break;
				QT.setFromAxisAngle(UP, yaw);
				doors.setMatrixAt(nd++, M4.compose(P3.set(dx, ground(dx, dz), dz), QT, S3));
			}
		}
		bins.count = nb; doors.count = nd;
		bins.instanceMatrix.needsUpdate = true; doors.instanceMatrix.needsUpdate = true; if (bins.instanceColor) bins.instanceColor.needsUpdate = true;
		// the grid's alleys: asphalt laid on the ground, a little worn down the middle
		const P = [], N = [], Cc = [];
		for (const r of grid) {
			const [x0, z0, x1, z1] = r.pts, L = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / L, tz = (z1 - z0) / L, nx = -tz, nz = tx, hw = ALLEY_W / 2;
			const n = Math.max(1, Math.ceil(L / 3));
			for (let k = 0; k < n; k++) {
				const a = k / n, b = (k + 1) / n;
				const pts = [[a, -hw], [b, -hw], [b, hw], [a, hw]].map(([t, s]) => { const x2 = x0 + (x1 - x0) * t + nx * s, z2 = z0 + (z1 - z0) * t + nz * s; return [x2, ground(x2, z2) + 0.1, z2]; });
				for (const i of [0, 3, 2, 0, 2, 1]) { P.push(...pts[i]); N.push(0, 1, 0); const wear = 0.17 + ((k * 7 + i) % 3) * 0.008; Cc.push(wear, wear, wear * 1.04); }
			}
		}
		strips.geometry.dispose();
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
		strips.geometry = g;
	}
	function update(cam) {
		const x = cam.position.x, z = cam.position.z;
		if (cam.position.y - ground(x, z) > 400) { bins.visible = doors.visible = strips.visible = false; return; }
		bins.visible = doors.visible = strips.visible = true;
		stream(x, z);
		if (Math.hypot(x - px, z - pz) > 45 || gridAlleys.version !== gv || cache.size !== cv) place(x, z);
	}
	return { update, source, info: () => ({ cells: cache.size, regionAlleys: [...cache.values()].reduce((s, l) => s + l.length, 0), gridAlleys: gridAlleys.alleys.length, bins: bins.count, doors: doors.count }) };
}
