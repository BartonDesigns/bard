// Every building can be broken. A blast, a car or a truck driven into a wall, a heavy round:
// each opens a hole in the wall it struck (bigger with the force, at the height it struck),
// throws chunks of it out as rigid bodies and dust after them, and takes from the building's
// strength; weakened enough, the upper storeys come down on a slant (a partial collapse) or
// the whole of it down to stubs over a mound of rubble, the falling part tumbling in great
// slabs in a cloud of dust. What happened is kept (structures/store.js) and stays until the
// crews have rebuilt it (structures/rebuild.js).
//
// A damaged building near you is drawn as its shell (structures/shell.js): the far box that
// stood for it (city.js's instanced blocks) is set aside while it is, and its walls, its holes
// and its rubble are solid to walk on and among (floor(), push()); further off it stands as
// its block, scorched. The buildings the other builders had made whole near you (the rooms of
// interiors/, a house of houses.js, a shop of commercial.js) give way to the shell.

import * as THREE from 'three';
import { bid, frameOf, FACES, onFace, uOn, faceLen, hash } from './ids.js';
import { buildShell, facadeOf, shellMaterial, fireSpots } from './shell.js';
import { srgbToLinear as lin } from '../world/srgb.js';

const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
const core = [0.4, 0.39, 0.37];

export function createDamage(ctx) {
	const { scene, isPhone, store, sounds, debris } = ctx;
	const PROXY_R = isPhone ? 170 : 300, MAX_PROXY = isPhone ? 6 : 14;
	const group = new THREE.Group();
	group.name = 'structures-damage';
	scene.add(group);
	// (one material for every shell: its colours are in the vertices, its windows drawn by it)
	const mat = shellMaterial();
	const shells = new Map();          // id -> { o, mesh, solid, rubble, key, rec }
	let lastList = null, meshes = null, roofIdx = null;
	const hidden = new Map();          // lot -> { slot, m, roof: [im, k, m], age }

	// ---------- the records ----------
	function record(o) {
		const id = bid(o);
		return store.get(id) || { x: +o.x.toFixed(1), z: +o.z.toFixed(1), w: +o.w.toFixed(1), d: +o.d.toFixed(1), h: +o.h.toFixed(1), a: +o.a.toFixed(3), y: +o.y.toFixed(2), s: Math.floor(hash(o.x, o.z) * 9973), m: [], c: 0, hp: 1, g: [] };
	}
	const wrecked = (rec) => !!rec && ((rec.m && rec.m.length) || rec.c > 0);
	// a point on a lot's walls: its face, how far along, how high above the foot
	function onWall(o, p) {
		const F = frameOf(o), [lx, lz] = F.l(p.x, p.z);
		const f = Math.abs(lx) / (o.w / 2) > Math.abs(lz) / (o.d / 2) ? (lx > 0 ? 2 : 3) : lz > 0 ? 0 : 1;
		const L = faceLen(o, f), u = Math.max(-L / 2 + 0.3, Math.min(L / 2 - 0.3, uOn(f, lx, lz)));
		return { f, u, y: Math.max(0.2, Math.min(o.h - 1.4, p.y - (o.y + 1.2))) };
	}
	// how strong a building is against a force (a timber house least, a tower most)
	const toughness = (o) => { const F = facadeOf(o); return F.house ? 0.75 : F.curtain ? 1.8 : F.shop ? 1 : 1.25; };

	// a hole in o's wall at world point p, radius r; the push the chunks are thrown with
	function hole(o, p, r, push, cause = 'blast') {
		if (!o || r < 0.25) return null;
		const id = bid(o), rec = record(o), w = onWall(o, p), H = o.h - 1.2;
		rec.m = rec.m || [];
		if (rec.m.length >= 14) { const k = rec.m.reduce((b, q, i) => (q[3] < rec.m[b][3] ? i : b), 0); rec.m.splice(k, 1); }
		rec.m.push([w.f, +w.u.toFixed(2), +w.y.toFixed(2), +r.toFixed(2)]);
		// strength lost: the hole's share of the walls, against the building's toughness
		const wallArea = 2 * (o.w + o.d) * Math.max(3, H);
		rec.hp = Math.max(0, (rec.hp ?? 1) - Math.PI * r * r / wallArea * 9 / toughness(o) - (cause === 'blast' ? 0.04 : 0.02));
		rec.t0 = store.now(); rec.r0 = null; rec.cause = cause;
		// weakened enough: it comes down (a tower only loses its top)
		const before = rec.c || 0;
		if (rec.hp < 0.14 && H < 45) rec.c = 0.93;
		else if (rec.hp < 0.42 && before < 0.35) rec.c = Math.max(before, H > 45 ? 0.22 : 0.38 + hash(o.x, o.z + 3) * 0.2);
		store.put(id, rec);
		// the chunks and the dust
		const F = frameOf(o), [lx, lz] = onFace(o, w.f, w.u), [nx, nz] = FACES[w.f], [wx, wz] = F.w(lx, lz), [wnx, wnz] = F.dir(nx, nz);
		const y = o.y + 1.2 + w.y, col = lin(o.col || [0.7, 0.68, 0.64]);
		const n = Math.min(isPhone ? 10 : 24, Math.round(4 + r * r * 9));
		const out = cause === 'impact' ? -1 : 1;
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2, rr = Math.random() * r, tx = -wnz, tz = wnx;
			const s = 0.12 + Math.pow(Math.random(), 1.7) * Math.min(0.9, 0.25 + r * 0.3);
			const sp = (cause === 'impact' ? 3 : 4 + r * 2) * (0.4 + Math.random());
			const px = push ? push[0] : 0, pz = push ? push[2] : 0;
			debris.chunk(wx + tx * Math.cos(a) * rr + wnx * 0.3 * out, y + Math.sin(a) * rr, wz + tz * Math.cos(a) * rr + wnz * 0.3 * out,
				wnx * sp * out + px * 0.4 + tx * (Math.random() - 0.5) * 3, 1 + Math.random() * 3, wnz * sp * out + pz * 0.4 + tz * (Math.random() - 0.5) * 3,
				[s * (0.8 + Math.random() * 0.6), s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6)], Math.random() < 0.6 ? col : core);
		}
		debris.puff(wx + wnx * 0.6, y, wz + wnz * 0.6, Math.round(6 + r * 8), r, 0.6 + r * 0.4, 0.72, { life: 8 + r * 5 });
		if (r > 1.2) debris.haze(wx + wnx * 1.2, y, wz + wnz * 1.2, r, 12 + r * 6);
		sounds.crumble({ x: wx, y, z: wz }, r);
		if ((rec.c || 0) > before) fall(o, rec, before);
		broke(o, id, rec);
		return rec;
	}
	// the part that comes down: great slabs from the storeys lost, tumbling into the dust
	function fall(o, rec, before) {
		const H = o.h - 1.2, F = frameOf(o), foot = o.y + 1.2, lost = H * (rec.c - before);
		const y0 = foot + H * (1 - rec.c), col = lin(o.col || [0.7, 0.68, 0.64]);
		// (the way it fell: the low side of the slant)
		const fa = ((rec.s || 0) % 628) / 100, [fdx, fdz] = F.dir(-Math.cos(fa), -Math.sin(fa));
		const n = Math.min(isPhone ? 6 : 14, 3 + Math.round(lost / 3));
		for (let i = 0; i < n; i++) {
			const lx = (Math.random() - 0.5) * o.w * 0.8, lz = (Math.random() - 0.5) * o.d * 0.8, [x, z] = F.w(lx, lz);
			const s = Math.min(6, Math.max(1.4, Math.min(o.w, o.d) * (0.25 + Math.random() * 0.25)));
			debris.chunk(x, y0 + Math.random() * lost * 0.7 + s / 2, z, fdx * 2 + (Math.random() - 0.5) * 2, -1 - Math.random() * 2, fdz * 2 + (Math.random() - 0.5) * 2, [s, s * (0.25 + Math.random() * 0.3), s * (0.6 + Math.random() * 0.5)], Math.random() < 0.5 ? col : [0.42, 0.41, 0.39]);
		}
		// (and chunks of every size between: grit to blocks a metre across)
		for (let i = 0; i < (isPhone ? 10 : 26); i++) {
			const [x, z] = F.w((Math.random() - 0.5) * o.w, (Math.random() - 0.5) * o.d), q = Math.pow(Math.random(), 2.2), s = 0.12 + q * 1.1;
			debris.chunk(x, y0 + Math.random() * lost, z, (Math.random() - 0.5) * 6 + fdx * 3, Math.random() * 2, (Math.random() - 0.5) * 6 + fdz * 3, [s * (0.7 + Math.random() * 0.6), s * (0.4 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6)], Math.random() < 0.6 ? col : core);
		}
		// the dust: a cloud up off it, a wall of it rolling out along the street (furthest the way
		// it fell), and a haze over the heap that hangs on a minute and more
		const k = Math.min(3.2, 1 + Math.sqrt(o.w * o.d) / 12), R = Math.max(o.w, o.d);
		debris.puff(o.x, foot + 1, o.z, isPhone ? 40 : 100, R * 0.55, k, 0.72, { life: 18 + lost * 0.4 });
		debris.puff(o.x + fdx * R * 0.25, foot + 0.4, o.z + fdz * R * 0.25, isPhone ? 30 : 80, R * 0.5, k * 1.1, 0.68, { roll: 4 + Math.sqrt(lost) * 1.3, life: 30 + lost * 0.6 });
		debris.haze(o.x, foot + 1.5, o.z, R * 0.5, 60 + lost * 2);
		sounds.collapse({ x: o.x, y: foot, z: o.z }, Math.min(2, lost / 10));
		ctx.shake?.(Math.min(0.8, 0.15 + lost / 40));
	}
	// a building broken: the shell stands in for it now, the builders let it go
	function broke(o, id, rec) {
		o.wrecked = wrecked(rec);
		if (o.wrecked) {
			if (o.src?.grp) { o.src.grp.shut = true; o.src.grp.wrecked = true; }
			ctx.release?.(o);
		}
		ctx.damaged?.(id, rec);
		const S = shells.get(id);
		if (S) { S.key = ''; }
		lastList = null;          // (the far blocks and the shells looked at again)
	}

	// ---------- the far blocks set aside ----------
	function cityMeshes(city) {
		if (meshes?.city === city) return meshes;
		const kids = city.group?.children?.filter((m) => m.isInstancedMesh) || [];
		const near = kids.find((m) => m.geometry.attributes.aKind && m.geometry.attributes.aNear && m.instanceMatrix.count >= 20000) || null;
		const roofs = kids.filter((m) => m.geometry.attributes.aRoof);
		return (meshes = { city, near, hips: roofs[0] || null, gables: roofs[1] || null });
	}
	function roofOf(list, M) {
		if (roofIdx?.list === list) return roofIdx.map;
		const map = new Map();
		// (each roof's own slot, as the city wrote it: bay/city.js upload, a sector at a time)
		for (const o of list) { if (o.slot === undefined || o.roofSlot === undefined || !o.roof) continue; map.set(o, o.roof.hip ? [M.hips, o.roofSlot] : [M.gables, o.roofSlot]); }
		roofIdx = { list, map };
		return map;
	}
	function setAside(o, M, list, far) {
		const was = hidden.get(o);
		// (set aside for a hole, then brought down: its roof's things go now)
		if (was) { if (!was.extra && !was.far && M.near && store.get(bid(o))?.c > 0) was.extra = offTheRoof(o, M); return; }
		if (o.slot === undefined || !M.near) return;
		const e = { slot: o.slot, m: new THREE.Matrix4(), roof: null, age: null };
		const rec = store.get(bid(o));
		const ages = M.near.geometry.attributes.aAge;
		if (far) {
			// (far off: the block stands, scorched; collapsed, only a stump of it)
			e.age = ages.array[o.slot];
			ages.array[o.slot] = (o.age ?? 0.4) + 4;
			ages.needsUpdate = true;
			if (rec?.c > 0.5) { M.near.getMatrixAt(o.slot, e.m); const m2 = e.m.clone(), el = m2.elements; el[4] *= 0.15; el[5] *= 0.15; el[6] *= 0.15; M.near.setMatrixAt(o.slot, m2); M.near.instanceMatrix.needsUpdate = true; e.squashed = true; }
		} else {
			M.near.getMatrixAt(o.slot, e.m);
			M.near.setMatrixAt(o.slot, HIDE);
			M.near.instanceMatrix.needsUpdate = true;
			e.hid = true;
		}
		const r = roofOf(list, M).get(o);
		if (r && r[0] && (!far || rec?.c > 0)) { const m = new THREE.Matrix4(); r[0].getMatrixAt(r[1], m); r[0].setMatrixAt(r[1], HIDE); r[0].instanceMatrix.needsUpdate = true; e.roof = [r[0], r[1], m]; }
		// (come down: what stood on its roof goes with it, the parapets and the units on it)
		if (rec?.c > 0 && (!far || e.squashed)) e.extra = offTheRoof(o, M);
		e.far = far;
		hidden.set(o, e);
	}
	function offTheRoof(o, M) {
		const out = [], F = frameOf(o), y0 = o.y + 1.2 + 2, R = Math.max(o.w, o.d) / 2 + 1, T4 = new THREE.Matrix4();
		const inside = (x, z) => { const [lx, lz] = F.l(x, z); return Math.abs(lx) < o.w / 2 + 0.5 && Math.abs(lz) < o.d / 2 + 0.5; };
		for (const q of ctx.city()?.lotsNear?.(o.x, o.z, R) || []) {
			if (q === o || q.slot === undefined || Math.floor(q.kind) !== 16 || q.y < y0 - 1.2 || !inside(q.x, q.z)) continue;
			M.near.getMatrixAt(q.slot, T4); out.push([M.near, q.slot, T4.clone()]); M.near.setMatrixAt(q.slot, HIDE);
		}
		M.city.group?.traverse((im) => {
			// (a near copy of another mesh's instances, city.js's rooftop units: it follows the one copied)
			if (!im.isInstancedMesh || im === M.near || im === M.hips || im === M.gables || im.count > 20000 || im.userData.copyOf) return;
			for (let i = 0; i < im.count; i++) {
				im.getMatrixAt(i, T4);
				const el = T4.elements;
				if (el[13] > y0 && Math.abs(el[12] - o.x) < R && Math.abs(el[14] - o.z) < R && inside(el[12], el[14])) { out.push([im, i, T4.clone()]); im.setMatrixAt(i, HIDE); }
			}
		});
		for (const [im] of out) im.instanceMatrix.needsUpdate = true;
		return out;
	}
	function putBack(o, M) {
		const e = hidden.get(o);
		if (!e) return;
		hidden.delete(o);
		if (!M.near) return;
		if (e.hid || e.squashed) { M.near.setMatrixAt(e.slot, e.m); M.near.instanceMatrix.needsUpdate = true; }
		if (e.age !== null) { M.near.geometry.attributes.aAge.array[e.slot] = e.age; M.near.geometry.attributes.aAge.needsUpdate = true; }
		if (e.roof) { e.roof[0].setMatrixAt(e.roof[1], e.roof[2]); e.roof[0].instanceMatrix.needsUpdate = true; }
		for (const [im, i, m] of e.extra || []) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; }
	}

	// ---------- the shells near you ----------
	const progress = (rec) => ctx.progress?.(rec) ?? null;
	function update(cam) {
		const city = ctx.city();
		if (!city?.nearList) return;
		const list = city.nearList(), M = cityMeshes(city);
		const x = cam.position.x, z = cam.position.z;
		if (list !== lastList) {
			if (lastList !== null && list !== hiddenList) hidden.clear();          // (a new list: the old slots are gone with it)
			hiddenList = list;
			lastList = list;
			// the damaged among the lots now, their flags put back on (the lots are new each rebuild)
			want.clear();
			for (const o of list) {
				if (o.slot === undefined || !(o.h > 2.4)) continue;
				const rec = store.get(bid(o));
				o.wrecked = wrecked(rec);
				if (!o.wrecked) { if (hidden.has(o)) putBack(o, M); continue; }
				if (o.src?.grp) { o.src.grp.shut = true; o.src.grp.wrecked = true; }
				want.set(bid(o), o);
			}
		}
		// near ones as shells, far ones as their scorched blocks; checked as you move
		let n = 0, built = 0;
		const near = [...want.values()].map((o) => [Math.hypot(o.x - x, o.z - z) - Math.max(o.w, o.d) / 2, o]).sort((p, q) => p[0] - q[0]);
		const keep = new Set();
		for (const [d, o] of near) {
			const id = bid(o), rec = store.get(id);
			if (!rec || !wrecked(rec)) { putBack(o, M); continue; }
			const asShell = d < PROXY_R && n < MAX_PROXY;
			const e = hidden.get(o);
			if (asShell) {
				n++;
				keep.add(id);
				if (e && e.far) putBack(o, M);
				setAside(o, M, list, false);
				const p = progress(rec), key = JSON.stringify([rec.m, rec.c, p === null ? -1 : Math.round(p * 24)]);
				let S = shells.get(id);
				// (one shell rebuilt a frame as the work goes on; a fresh wreck at once)
				if (!S || ((S.key !== key || S.o !== o) && (built < 1 || S.fresh !== rec.t0))) {
					built++;
					if (S) { group.remove(S.mesh); S.mesh.geometry.dispose(); }
					const B = buildShell(o, rec, p, { lite: isPhone });
					const mesh = new THREE.Mesh(B.geo, mat);
					mesh.position.set(o.x, o.y + 1.2, o.z); mesh.rotation.y = -o.a;
					mesh.castShadow = true; mesh.receiveShadow = true;
					group.add(mesh);
					S = { o, mesh, solid: B.solid, rubble: B.rubble, key, rec, verts: B.verts, fresh: rec.t0, fire: null };
					shells.set(id, S);
					ctx.release?.(o);
				}
				fires(S, o, rec, p);
			} else {
				if (e && !e.far) putBack(o, M);
				setAside(o, M, list, true);
			}
		}
		for (const [id, S] of shells) if (!keep.has(id)) { group.remove(S.mesh); S.mesh.geometry.dispose(); shells.delete(id); debris.burn(id, null); }
	}
	// a fresh wreck burns a while (an hour and a half of game time), until the crew is at it
	function fires(S, o, rec, p) {
		const lit = store.now() - (rec.t0 ?? -9) < 1.5 && (p === null || p < 0.08);
		const key = lit ? JSON.stringify([rec.m, rec.c]) : '';
		if (S.fire === key) return;
		S.fire = key;
		if (!lit) { debris.burn(bid(o), null); return; }
		const F = frameOf(o), foot = o.y + 1.2;
		debris.burn(bid(o), fireSpots(o, rec).map(([lx, y, lz, k]) => { const [wx, wz] = F.w(lx, lz); return { x: wx, y: foot + y, z: wz, k }; }));
	}
	let hiddenList = null;
	const want = new Map();

	// ---------- you among them ----------
	function floor(x, z, y) {
		let best = -1e9;
		for (const S of shells.values()) {
			const o = S.o;
			if (Math.abs(x - o.x) > o.w + 16 || Math.abs(z - o.z) > o.d + 16) continue;
			const [lx, lz] = frameOf(o).l(x, z), h = S.rubble(lx, lz);
			if (h > 0.02 && y > o.y + 1.2 + h - 1.2) best = Math.max(best, o.y + 1.2 + h);
		}
		return best;
	}
	const RAD = 0.32;
	function push(p, footY) {
		for (const S of shells.values()) {
			const o = S.o;
			if (Math.abs(p.x - o.x) > o.w + 2 || Math.abs(p.z - o.z) > o.d + 2) continue;
			const F = frameOf(o), q = F.l(p.x, p.z), fy = footY - (o.y + 1.2);
			let moved = false;
			for (const b of S.solid) {
				if (fy + 0.35 > b[5] || fy + 1.7 < b[4]) continue;
				const qx = Math.max(b[0], Math.min(b[2], q[0])), qz = Math.max(b[1], Math.min(b[3], q[1])), dx = q[0] - qx, dz = q[1] - qz, d2 = dx * dx + dz * dz;
				if (d2 >= RAD * RAD) continue;
				if (d2 < 1e-8) { const pen = [q[0] - b[0], b[2] - q[0], q[1] - b[1], b[3] - q[1]], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) q[0] = b[0] - RAD; else if (k === 1) q[0] = b[2] + RAD; else if (k === 2) q[1] = b[1] - RAD; else q[1] = b[3] + RAD; }
				else { const d = Math.sqrt(d2); q[0] = qx + dx / d * RAD; q[1] = qz + dz / d * RAD; }
				moved = true;
			}
			if (moved) { const [wx, wz] = F.w(q[0], q[1]); p.x = wx; p.z = wz; }
		}
	}
	// the walls a car meets in place of a wrecked building's box (world boxes, as drive.js has them)
	function carBoxes(o) {
		const S = shells.get(bid(o));
		if (!S) return [];
		const F = frameOf(o), foot = o.y + 1.2;
		return S.solid.map((b) => { const [x, z] = F.w((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); return { x, z, w: b[2] - b[0], d: b[3] - b[1], a: o.a, h: b[5] - b[4], y: foot + b[4] }; });
	}
	// where a ray meets a shell's wall (rough: its standing boxes), for shots
	function info() {
		const out = [];
		for (const [id, S] of shells) out.push({ id, x: +S.o.x.toFixed(1), z: +S.o.z.toFixed(1), holes: S.rec.m?.length || 0, collapse: S.rec.c || 0, hp: +(S.rec.hp ?? 1).toFixed(2), verts: S.verts });
		return { shells: out, far: [...hidden.values()].filter((e) => e.far).length };
	}
	function repaired(id) {
		const S = shells.get(id);
		if (S) { group.remove(S.mesh); S.mesh.geometry.dispose(); shells.delete(id); }
		debris.burn(id, null);
		lastList = null;
	}
	// brought down by force (a demolition): c of its height lost
	function bringDown(o, c = 0.93) {
		const id = bid(o), rec = record(o), before = rec.c || 0;
		if (before >= c) return rec;
		rec.c = c; rec.hp = Math.min(rec.hp ?? 1, c > 0.8 ? 0.1 : 0.35); rec.t0 = store.now(); rec.r0 = null;
		store.put(id, rec);
		fall(o, rec, before);
		broke(o, id, rec);
		return rec;
	}
	return { group, record, hole, bringDown, onWall, toughness, update, floor, push, carBoxes, info, repaired, shells, wrecked, isWrecked: (o) => wrecked(store.get(bid(o))) };
}
