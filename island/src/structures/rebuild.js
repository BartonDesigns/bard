// The crews. Not long after a building is damaged (a third of an hour of game time) a crew
// arrives: trucks pulled up at the kerb, cones and fencing round the work, hard hats and
// hi-vis. They clear the rubble, put up scaffolding as high as the work, and build it back
// storey by storey (structures/shell.js draws the stages), then strike the scaffolding and
// glaze it: two to five game hours by how bad it was, a tower crane over the big ones. A
// broken window alone gets a glazier's van and an hour's work. While a citywide catastrophe
// is under way (cataclysm(true)) nobody comes: the work waits, and resumes once it is over.

import * as THREE from 'three';
import { bid, frameOf, onFace, faceLen, FACES, hash } from './ids.js';

const lin = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
// a box into a list of parts (vertex coloured), turned by yaw about its middle's foot
function box(P, x, y, z, w, h, d, c, yaw = 0, tilt = 0) {
	const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
	if (tilt) g.rotateZ(tilt);
	g.translate(0, h / 2, 0);
	if (yaw) g.rotateY(yaw);
	g.translate(x, y, z);
	const n = g.attributes.position.count, a = new Float32Array(n * 3), L = lin(c);
	for (let i = 0; i < n; i++) a.set(L, i * 3);
	g.setAttribute('color', new THREE.BufferAttribute(a, 3));
	g.deleteAttribute('uv');
	P.push(g);
}
function merge(P) {
	let n = 0;
	for (const g of P) n += g.attributes.position.count;
	const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
	let k = 0;
	for (const g of P) { pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); col.set(g.attributes.color.array, k * 3); k += g.attributes.position.count; g.dispose(); }
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
	out.computeBoundingSphere();
	return out;
}
const STEEL = [0.62, 0.64, 0.66], WOOD = [0.62, 0.5, 0.34], NET = [0.12, 0.32, 0.18], CONE = [0.95, 0.42, 0.08], WHITE = [0.92, 0.92, 0.9], DARK = [0.08, 0.08, 0.09], YELLOW = [0.95, 0.76, 0.1], ORANGE = [0.98, 0.5, 0.08], SKIN = [0.72, 0.55, 0.42], DENIM = [0.18, 0.22, 0.32];

// a truck (a flatbed with its cab), a van, a worker: parts at the origin facing +z
function truck(P, x, y0, z, yaw, c) {
	const cy = Math.cos(yaw), sy = Math.sin(yaw), at = (u, v) => [x + u * cy + v * sy, z - u * sy + v * cy];
	const B = (u, y, v, w, h, d, cl) => { const [px, pz] = at(u, v); box(P, px, y0 + y, pz, w, h, d, cl, yaw); };
	B(0, 0.55, 2.6, 2.3, 1.9, 1.9, c); B(0, 1.2, 3.4, 2.1, 0.7, 0.1, [0.15, 0.2, 0.25]); B(0, 0.55, -1.2, 2.4, 0.35, 5.6, [0.3, 0.3, 0.32]);
	B(0, 0.9, -1.2, 2.4, 0.5, 0.08, YELLOW); B(0, 0.9, -1.2, 0.08, 0.5, 5.6, [0.3, 0.3, 0.32]);
	for (const v of [2.6, -0.4, -2.6]) for (const u of [-1.05, 1.05]) B(u, 0, v, 0.35, 0.95, 0.95, DARK);
	B(0, 2.45, 2.6, 1.2, 0.12, 0.3, ORANGE);
}
function van(P, x, y0, z, yaw) {
	const cy = Math.cos(yaw), sy = Math.sin(yaw), at = (u, v) => [x + u * cy + v * sy, z - u * sy + v * cy];
	const B = (u, y, v, w, h, d, cl) => { const [px, pz] = at(u, v); box(P, px, y0 + y, pz, w, h, d, cl, yaw); };
	B(0, 0.45, 0, 2.0, 2.0, 5.2, WHITE); B(0, 1.5, 2.55, 1.8, 0.65, 0.1, [0.15, 0.2, 0.25]);
	// the glass rack on its side, panes on it
	B(1.08, 1.0, -0.6, 0.12, 1.5, 3.0, STEEL); B(1.2, 1.0, -0.6, 0.04, 1.4, 2.8, [0.6, 0.78, 0.82]);
	for (const v of [1.7, -1.7]) for (const u of [-0.9, 0.9]) B(u, 0, v, 0.3, 0.75, 0.75, DARK);
}
const workerGeo = (() => { const P = []; box(P, -0.12, 0, 0, 0.17, 0.85, 0.2, DENIM); box(P, 0.12, 0, 0, 0.17, 0.85, 0.2, DENIM); box(P, 0, 0.85, 0, 0.5, 0.62, 0.28, ORANGE); box(P, 0, 1.12, 0, 0.52, 0.06, 0.3, [0.85, 0.88, 0.85]); box(P, -0.33, 0.9, 0, 0.13, 0.56, 0.15, ORANGE); box(P, 0.33, 0.9, 0, 0.13, 0.56, 0.15, ORANGE); box(P, 0, 1.5, 0, 0.22, 0.25, 0.24, SKIN); box(P, 0, 1.72, 0, 0.3, 0.1, 0.32, YELLOW); return merge(P); })();

export function createRebuild(ctx) {
	const { scene, isPhone, store, sounds } = ctx;
	const SITE_R = isPhone ? 200 : 360;
	const group = new THREE.Group();
	group.name = 'structures-crews';
	scene.add(group);
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.08 });
	let cataclysm = false, tickAt = -1e9;
	const sites = new Map();          // id -> { rec, root, scaffold, crane, jib, workers, stage, key }
	// how far along a rebuild is (0..1), or null before the crew has started
	const progress = (rec) => (rec?.r0 == null ? null : Math.min(1, Math.max(0, (store.now() - rec.r0) / (rec.rd || 3))));
	const needs = (rec) => !!rec && ((rec.m && rec.m.length) || rec.c > 0 || (rec.g && rec.g.length));
	const glassOnly = (rec) => !((rec.m && rec.m.length) || rec.c > 0);
	function schedule(dtH) {
		const now = store.now();
		store.each((id, rec) => {
			if (!needs(rec)) { store.drop(id); return; }
			if (cataclysm) {
				// (nobody comes; work under way holds where it is)
				if (rec.r0 != null) { rec.r0 += dtH; store.touch(); }
				return;
			}
			if (rec.r0 == null) {
				const wait = glassOnly(rec) ? 0.2 : 0.35;
				if (now - (rec.t0 ?? now) >= wait) {
					rec.r0 = now;
					const sev = Math.min(1, (1 - (rec.hp ?? 1)) * 1.3 + (rec.c || 0) * 0.8 + (rec.m?.length || 0) * 0.04);
					rec.rd = glassOnly(rec) ? 0.6 + hash(rec.x, rec.z) * 0.6 : 2 + 3 * sev;
					store.put(id, rec);
				}
				return;
			}
			if (progress(rec) >= 1) { store.drop(id); ctx.repaired?.(id, rec); }
		});
	}
	// ---------- a site near you ----------
	function lotFor(id, rec) {
		const city = ctx.city();
		const near = city?.lotsNear?.(rec.x, rec.z, 2) || [];
		return near.find((o) => bid(o) === id) || null;
	}
	function build(id, rec, o) {
		const P = [], F = frameOf(o), H = o.h - 1.2, gl = glassOnly(rec);
		const front = ctx.frontOf?.(o) ?? 0;
		const [fx, fz] = onFace(o, front, 0), [nx, nz] = FACES[front], [wnx, wnz] = F.dir(nx, nz);
		const L = faceLen(o, front), yawF = Math.atan2(wnx, wnz);
		const at = (lx, lz) => { const [x, z] = F.w(lx, lz); return [x, ctx.ground(x, z), z]; };
		// the trucks at the kerb, side on to the front
		const kx = fx + nx * (gl ? 5 : 7), kz = fz + nz * (gl ? 5 : 7);
		for (let i = 0; i < (gl ? 1 : H > 14 ? 2 : 1); i++) {
			const u = (i - 0.5) * 9 * (gl ? 0 : 1), [lx, lz] = [kx + nz * u, kz - nx * u], [x, y, z] = at(lx, lz);
			if (gl) van(P, x, y, z, yawF + Math.PI / 2); else truck(P, x, y, z, yawF + Math.PI / 2, i ? WHITE : [0.95, 0.55, 0.12]);
		}
		// the cones and the fence round the work
		for (let i = 0; i < 6; i++) { const u = -L / 2 - 1 + i * (L + 2) / 5, [lx, lz] = [fx + nx * 2.8 + nz * u, fz + nz * 2.8 - nx * u], [x, y, z] = at(lx, lz); box(P, x, y, z, 0.32, 0.7, 0.32, CONE); box(P, x, y + 0.42, z, 0.24, 0.1, 0.24, WHITE); }
		if (!gl) for (let i = 0; i < Math.ceil((L + 4) / 2.4); i++) { const u = -L / 2 - 2 + (i + 0.5) * 2.4, [lx, lz] = [fx + nx * 2 + nz * u, fz + nz * 2 - nx * u], [x, y, z] = at(lx, lz); box(P, x, y, z, 2.3, 1.9, 0.04, [0.55, 0.57, 0.58], yawF); box(P, x, y, z, 0.06, 2.0, 0.3, DARK, yawF); }
		const root = new THREE.Mesh(merge(P), mat);
		root.castShadow = true; root.receiveShadow = true;
		group.add(root);
		const S = { id, rec, o, root, scaffold: null, crane: null, jib: null, workers: [], key: '', t: Math.random() * 10, beat: 0 };
		// the crew: walking their beats along the front, or at work at the wall
		const n = gl ? 2 : Math.min(isPhone ? 4 : 6, 3 + Math.floor(H / 12));
		for (let i = 0; i < n; i++) {
			const w = new THREE.Mesh(workerGeo, mat);
			w.castShadow = true;
			const u0 = (hash(i, rec.s || 1) - 0.5) * L * 0.8, beat = 1 + hash(rec.s || 1, i) * 4, work = i % 3 === 0;
			S.workers.push({ mesh: w, u0, beat, work, phase: hash(i * 7, 3) * 6 });
			group.add(w);
		}
		// a tower crane over the big ones
		if (!gl && (H > 14 || o.w * o.d > 600)) {
			const cP = [], h = H + 14, [lx, lz] = [fx + nx * 9 - nz * (L / 2 + 2), fz + nz * 9 + nx * (L / 2 + 2)], [x, y, z] = at(lx, lz);
			box(cP, 0, 0, 0, 3.4, 0.8, 3.4, [0.5, 0.5, 0.5]);
			for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) box(cP, a, 0.8, b, 0.18, h, 0.18, YELLOW);
			for (let k = 2; k < h; k += 2.2) { box(cP, 0, k, -0.8, 1.6, 0.1, 0.1, YELLOW); box(cP, 0, k, 0.8, 1.6, 0.1, 0.1, YELLOW); box(cP, -0.8, k, 0, 0.1, 0.1, 1.6, YELLOW); box(cP, 0.8, k, 0, 0.1, 0.1, 1.6, YELLOW); }
			const crane = new THREE.Mesh(merge(cP), mat);
			crane.position.set(x, y, z);
			const jP = [], R = Math.max(18, Math.hypot(o.w, o.d) * 0.8);
			box(jP, 0, 0, R / 2 - 1, 1.2, 1.2, R, YELLOW); box(jP, 0, 0, -5, 1.2, 1.0, 10, YELLOW); box(jP, 0, -1.6, -8.5, 2.2, 2.2, 2.6, [0.55, 0.55, 0.55]);
			box(jP, 0, 1.2, 0, 0.3, 3.5, 0.3, YELLOW); box(jP, 0, -2.2, 1.6, 1.8, 2.2, 2.2, [0.9, 0.9, 0.88]);
			box(jP, 0, -16, R * 0.6, 0.05, 16, 0.05, DARK); box(jP, 0, -16.6, R * 0.6, 0.5, 0.6, 0.5, ORANGE);
			const jib = new THREE.Mesh(merge(jP), mat);
			jib.position.y = h + 0.8;
			crane.add(jib);
			crane.castShadow = true; jib.castShadow = true;
			group.add(crane);
			S.crane = crane; S.jib = jib;
		}
		return S;
	}
	// the scaffolding as high as the work, struck at the end
	function scaffold(S, p) {
		const o = S.o, H = o.h - 1.2, st = 3.2;
		// (put up while the rubble goes, as high as the building; struck once it is glazed)
		const up = p === null || p < 0.12 || p > 0.9 ? 0 : Math.min(H + 1.2, st * 1.5 + (H + 1.2) * Math.min(1, (p - 0.12) / 0.25));
		const key = up.toFixed(0);
		if (key === S.key) return;
		S.key = key;
		if (S.scaffold) { group.remove(S.scaffold); S.scaffold.geometry.dispose(); S.scaffold = null; }
		if (up <= 0 || glassOnly(S.rec)) return;
		const P = [], F = frameOf(o), foot = o.y + 1.2;
		for (let f = 0; f < 4; f++) {
			const L = faceLen(o, f), [nx, nz] = FACES[f], [wnx, wnz] = F.dir(nx, nz), yaw = Math.atan2(wnx, wnz);
			for (let u = -L / 2 - 0.6; u <= L / 2 + 0.7; u += 2.1) for (const off of [0.6, 1.6]) {
				const [lx, lz] = onFace(o, f, u), [x, z] = F.w(lx + nx * off, lz + nz * off);
				box(P, x, foot - 0.3, z, 0.06, up + 0.3, 0.06, STEEL);
			}
			for (let y = 2; y <= up; y += 2) {
				const [lx, lz] = onFace(o, f, 0);
				for (const off of [0.6, 1.6]) { const [x, z] = F.w(lx + nx * off, lz + nz * off); box(P, x, foot + y, z, L + 1.4, 0.06, 0.06, STEEL, yaw); }
				const [x, z] = F.w(lx + nx * 1.1, lz + nz * 1.1);
				if ((y / 2) % 2 === 0) box(P, x, foot + y - 0.05, z, L + 1.2, 0.05, 0.95, WOOD, yaw);
				// (the netting on the street side)
				if (f === (ctx.frontOf?.(o) ?? 0)) { const [x2, z2] = F.w(lx + nx * 1.75, lz + nz * 1.75); box(P, x2, foot + y - 2, z2, L + 1.4, 1.9, 0.02, NET, yaw); }
			}
		}
		S.scaffold = new THREE.Mesh(merge(P), mat);
		S.scaffold.castShadow = true;
		group.add(S.scaffold);
	}
	function drop(S) {
		for (const m of [S.root, S.scaffold, S.crane]) if (m) { group.remove(m); if (m !== S.crane) m.geometry.dispose(); else { m.geometry.dispose(); S.jib.geometry.dispose(); } }
		for (const w of S.workers) group.remove(w.mesh);
		sites.delete(S.id);
	}
	function update(cam, dt) {
		// (twice a second by the clock on the wall, however slowly the frames come)
		if (performance.now() - tickAt > 500 || store.now() - (lastNow ?? 0) > 0.05) { tickAt = performance.now(); const now = store.now(); schedule(Math.max(0, now - (lastNow ?? now))); lastNow = now; }
		const x = cam.position.x, z = cam.position.z;
		const live = new Set();
		if (!cataclysm) store.each((id, rec) => {
			if (rec.r0 == null || Math.hypot(rec.x - x, rec.z - z) > SITE_R) return;
			const o = lotFor(id, rec);
			if (!o) return;
			live.add(id);
			let S = sites.get(id);
			if (!S || S.o !== o) { if (S) drop(S); S = build(id, rec, o); sites.set(id, S); sounds.beep({ x: rec.x, y: o.y + 2, z: rec.z }); }
			S.rec = rec;
			const p = progress(rec);
			scaffold(S, p);
			// the crew at it
			S.t += dt;
			const F = frameOf(o), front = ctx.frontOf?.(o) ?? 0, [nx, nz] = FACES[front], foot = o.y + 1.2;
			for (const w of S.workers) {
				const k = S.t / w.beat + w.phase, u = w.work ? w.u0 : w.u0 + Math.sin(k) * Math.min(6, faceLen(o, front) * 0.35);
				const off = w.work ? 1.1 : 2.4 + Math.cos(k * 0.7) * 0.6;
				const [lx, lz] = onFace(o, front, u), [wx, wz] = F.w(lx + nx * off, lz + nz * off);
				const climb = w.work && p > 0.15 && p < 0.9 && !glassOnly(rec) ? Math.min(o.h - 1.2, Math.floor((Math.max(0, p - 0.3) / 0.55) * (o.h - 1.2) / 2) * 2) : 0;
				w.mesh.position.set(wx, (climb ? foot + climb : ctx.ground(wx, wz)) + (w.work ? Math.abs(Math.sin(S.t * 6 + w.phase)) * 0.04 : Math.abs(Math.sin(k * 6)) * 0.03), wz);
				// (facing the wall at work; walking, the way they are going along it)
				const [dx, dz] = w.work ? F.dir(-nx, -nz) : F.dir(nz * Math.sign(Math.cos(k)), -nx * Math.sign(Math.cos(k)));
				w.mesh.rotation.y = Math.atan2(dx, dz);
			}
			if (S.jib) S.jib.rotation.y = Math.sin(S.t * 0.07 + (rec.s || 0)) * 1.4;
			// the sounds of the work
			S.beat -= dt;
			if (S.beat <= 0 && p > 0.05 && p < 0.97) { S.beat = 0.35 + Math.random() * 1.1; const w = S.workers[Math.floor(Math.random() * S.workers.length)]; if (w) (Math.random() < 0.08 ? sounds.grind : sounds.hammer)(w.mesh.position); }
		});
		for (const S of [...sites.values()]) if (!live.has(S.id)) drop(S);
	}
	let lastNow = null;
	function setCataclysm(on) {
		on = !!on;
		if (on === cataclysm) return cataclysm;
		cataclysm = on;
		if (!on) {
			// (over: those waiting are seen to a little after, the work under way picks up again)
			const now = store.now();
			store.records((rec) => { if (rec.r0 == null) rec.t0 = Math.max(rec.t0 ?? now, now); else rec.r0 += 0.25; });
			store.touch();
		}
		return cataclysm;
	}
	function info() {
		const out = [];
		store.each((id, rec) => { if (rec.r0 != null) out.push({ id, x: rec.x, z: rec.z, progress: +progress(rec).toFixed(3), hours: +(rec.rd || 0).toFixed(2), left: +((1 - progress(rec)) * (rec.rd || 0)).toFixed(2), glass: glassOnly(rec), crane: !!sites.get(id)?.crane, here: sites.has(id) }); });
		return out;
	}
	return { group, update, progress, cataclysm: (on) => (on === undefined ? cataclysm : setCataclysm(on)), info, sites };
}
