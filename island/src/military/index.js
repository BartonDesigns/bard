// The military: bases sited across the Earth (the Bay's own few, and a seeded grid over the
// whole globe, each placed where the ground agrees: military/rules.js), built when you come
// near (military/base-model.js), garrisoned while you are close (soldiers at the gate, up the
// watchtowers, walking a patrol inside the fence, at the armoury, on the flight line, and at a
// checkpoint on the road outside), with their tanks, armoured trucks, jeeps, helicopters and
// jets parked where you can take them (military/drive-mil.js flies and drives them through
// drive.js's controls). Far bases are only a little state: their name, place and how many of
// each vehicle they have; the dispatch (military/dispatch.js) and the police (police.js) work
// from that.
//
// The world sees a base through island.extraFloor and extraPush (main.js): its pad, banks,
// roofs and watchtower platforms to stand on; its buildings, fence and parked vehicles solid.
// Interiors: each barracks, headquarters and armoury leaves a frame (origin, yaw, width,
// depth, floor height) for the builder that furnishes it; setInteriors({ barracks, warRoom,
// depot }) registers them (services/interiors.js once it is merged).

import * as THREE from 'three';
import { BAY_SITES, globeSites, baseLayout, chooseSite, interiorFrames, garrisonPlan, toLocal, toWorld, padAt, hash2 } from './rules.js';
import { militaryKit } from './kit.js';
import { buildBase } from './base-model.js';
import { vehicleGeometry, SCHEMES, DIMS } from './models.js';
import { toLL, toXZ, F as FRAME } from '../earth/globeframe.js';
import { createMilDrive } from './drive-mil.js';
import { createDispatch } from './dispatch.js';
import { createPolice } from './police.js';

const SITE_R = 9000, BUILD_R = 5200, DROP_R = 7000, GARRISON_R = 320;
const UNITS = (L) => { const u = { tank: 0, apc: 0, jeep: 0, truck: 0, heli: 0, jet: 0 }; for (const p of L.parked) u[p.kind]++; return u; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();

export function createMilitary({ scene, camera, mount, world, combat, isPhone = false, hint = () => {} }) {
	const kit = militaryKit();
	const group = new THREE.Group(); group.name = 'military';
	const sites = new Map();
	const interiors = { barracks: null, warRoom: null, depot: null };
	let scanT = 0, epoch = -1, lastW = null;
	const W = () => world();
	const P = () => W()?.player?.state || null;
	// the vehicles you drive and fly (drive.js boards them through board())
	const milDrive = createMilDrive({ world, camera, combat, kit, group, hint, isPhone, mount });

	// ---------- finding the bases ----------
	function scan() {
		const p = P();
		if (!p || !W()?.bayArea) return;
		const ll = toLL(p.pos.x, p.pos.z);
		const cands = [...BAY_SITES.map((s) => ({ ...s, seed: Math.floor(hash2(s.lat * 1e3, s.lon * 1e3, 9) * 1e9), scheme: 'woodland' })), ...globeSites(ll.lat, ll.lon, 1.2).map((s) => ({ ...s, scheme: hash2(s.lat * 100, s.lon * 100, 3) < 0.3 && Math.abs(s.lat) < 40 ? 'desert' : 'woodland' }))];
		for (const c of cands) {
			if (sites.has(c.id)) continue;
			const L = baseLayout(c.kind, c.seed, c.short);
			sites.set(c.id, { ...c, layout: L, status: 'pending', units: UNITS(L), losses: 0, busyUntil: 0, taken: new Set(), built: null, posts: null, hostile: 0, inside: 0, warned: 0, armouryT: 0 });
		}
		// (where each is now, in the frame as it stands)
		for (const S of sites.values()) { const q = toXZ(S.sitedLat ?? S.lat, S.sitedLon ?? S.lon); S.cx = q.x; S.cz = q.z; if (S.status === 'sited') { S.x = q.x; S.z = q.z; } }
	}
	// the ground as the siting sees it
	function sampler() {
		const w = W(), I = w.island, bay = w.bayArea;
		const towns = bay?.towns || [];
		return {
			height: (x, z) => I.heightAt(x, z),
			water: (x, z) => I.waterAt?.(x, z) != null,
			urban: (x, z) => {
				const u = bay?.urbanAt?.(x, z)?.u || 0;
				for (const t of towns) if (Math.hypot(t.x - x, t.z - z) < t.r * 1.3 + 300) return 1;
				if (w.globe?.regional?.settlements?.blocked?.(x, z, 40)) return 1;
				return u;
			},
			built: (x, z, r) => (w.real?.loaded?.() ? w.real.near('boxes', x, z, r).length : 0),
			road: (x, z) => {
				let best = Infinity;
				if (!w.real?.loaded?.()) return best;
				for (const r of w.real.near('roads', x, z, 2500)) {
					if (!/motorway|trunk|primary/.test(r.cls)) continue;
					for (let i = 0; i < r.pts.length; i += 6) best = Math.min(best, Math.hypot(r.pts[i] - x, r.pts[i + 1] - z));
				}
				return best;
			},
		};
	}
	function site(S) {
		const L = S.layout, best = chooseSite(sampler(), { x: S.cx, z: S.cz, yaw: S.yaw || 0 }, L.W, L.D, { tries: 16 });
		if (!best) { S.status = 'failed'; return; }
		const ll = toLL(best.x, best.z);
		Object.assign(S, { status: 'sited', x: best.x, z: best.z, yaw: best.yaw, floor: best.floor, score: best.score, sitedLat: ll.lat, sitedLon: ll.lon });
		S.checkpoint = checkpointFor(S);
	}
	// a checkpoint on the road outside the gate (the nearest road a few hundred metres out), or
	// on the approach straight out from the gate
	function checkpointFor(S) {
		const w = W(), [gx, gz] = toWorld(S, S.layout.gate.x, S.layout.gate.z + 4);
		let best = null, bd = 900;
		if (w.real?.loaded?.()) for (const r of w.real.near('roads', gx, gz, 900)) for (let i = 0; i < r.pts.length; i += 2) {
			const d = Math.hypot(r.pts[i] - gx, r.pts[i + 1] - gz);
			if (d > 220 && d < bd) { bd = d; best = { x: r.pts[i], z: r.pts[i + 1] }; }
		}
		if (!best) { const [x, z] = toWorld(S, S.layout.gate.x, S.layout.gate.z + 340); best = { x, z }; }
		const yaw = Math.atan2(best.x - gx, best.z - gz);
		return { kind: 'checkpoint', x: best.x, z: best.z, yaw, r: 45, n: 2 };
	}

	// ---------- building and dropping ----------
	function build(S) {
		const ground = (x, z) => W().island.heightAt(x, z);
		const out = buildBase(S, kit, ground, { phone: isPhone });
		out.group.position.y = 0;
		group.add(out.group);
		S.built = { ...out, interiors: [] };
		// the checkpoint's barrier, sandbags and a shelter
		S.built.cp = checkpointProps(S);
		group.add(S.built.cp);
		// the interiors, where a builder is registered
		for (const f of frameList(S)) furnish(S, f);
		parkedDirty = true;
	}
	function drop(S) {
		if (!S.built) return;
		releaseGarrison(S);
		for (const I of S.built.interiors) I.group?.removeFromParent();
		S.built.group.removeFromParent(); S.built.cp.removeFromParent();
		for (const m of S.built.group.children) m.geometry.dispose();
		for (const m of S.built.cp.children) m.geometry?.dispose();
		S.built = null; parkedDirty = true;
	}
	function checkpointProps(S) {
		const C = S.checkpoint, g = new THREE.Group(), y = W().island.heightAt(C.x, C.z);
		g.position.set(C.x, y, C.z); g.rotation.y = C.yaw;
		const bag = new THREE.BoxGeometry(2.8, 0.32, 0.6), mat = kit.canvas;
		const bags = new THREE.InstancedMesh(bag, mat, 12);
		let i = 0;
		for (const s of [-1, 1]) for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { _m.compose(_p.set(s * (5.5 + j * 2.8), 0.16 + k * 0.32, 0), _q.identity(), _s.set(1, 1, 1)); bags.setMatrixAt(i, _m); bags.setColorAt(i++, _c.set('#a39470')); }
		bags.castShadow = bags.receiveShadow = true; g.add(bags);
		const boom = new THREE.Mesh(new THREE.BoxGeometry(7, 0.14, 0.14), kit.paint); boom.position.set(0, 1.05, -0.6); g.add(boom);
		boom.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(boom.geometry.attributes.position.count).fill(0).flatMap((_, k) => (Math.floor((boom.geometry.attributes.position.getX(k) + 3.5) / 0.875) % 2 ? [0.9, 0.9, 0.88] : [0.72, 0.14, 0.11])), 3));
		const hut = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 2.4), kit.concrete); hut.position.set(-7.5, 1.25, 3); hut.castShadow = true; g.add(hut);
		hut.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(hut.geometry.attributes.position.count * 3).fill(0.72), 3));
		return g;
	}
	// interior frames in the world: { builder, origin: { x, y, z }, yaw, width, depth, height, floors, floorHeight, base }
	function frameList(S) {
		return interiorFrames(S.layout).map((f) => { const [x, z] = toWorld(S, f.x, f.z); return { builder: f.builder, type: f.type, origin: { x, y: padAt(S, f.x, f.z), z }, yaw: S.yaw + f.yaw, width: f.w, depth: f.d, height: f.h, floors: f.floors, floorHeight: f.floorH, base: S.name }; });
	}
	function furnish(S, f) {
		const fn = interiors[f.builder];
		if (!fn || S.built.interiors.some((I) => I.frame.origin.x === f.origin.x && I.frame.origin.z === f.origin.z)) return;
		try {
			const r = fn(f);
			const I = r?.isObject3D ? { group: r } : (r || {});
			I.frame = f;
			if (I.group && !I.group.parent) group.add(I.group);
			S.built.interiors.push(I);
		} catch (e) { console.warn('[military] interior', f.builder, e); }
	}

	// ---------- the garrison ----------
	// each post a squad, made when you come within sight of it (a long airfield's far towers
	// only as you near them) and let go when you leave; a soldier down stays down, and the base
	// is restocked slowly
	function garrison(S, dt) {
		const sq = combat?.squads, p = P();
		if (!sq || !p) return;
		if (!S.posts) {
			const plan = garrisonPlan(S.layout, { phone: isPhone, budget: Math.max(2, 12 - S.losses), alert: S.hostile > 0 });
			S.posts = [...plan.map((g) => ({ post: postWorld(S, g.post, true), n: g.n })), { post: postWorld(S, S.checkpoint, false), n: isPhone ? 1 : 2 }];
		}
		S.garT = (S.garT || 0) - dt;
		if (S.garT > 0) return;
		S.garT = 1.5;
		S.restock = (S.restock || 0) + 1.5;
		if (S.restock > 180 && S.losses > 0) { S.losses--; S.restock = 0; }
		for (const e of S.posts) {
			if (e.squad) {
				for (const h of e.squad.members) if (h.dead && !h.counted) { h.counted = true; e.lost = (e.lost || 0) + 1; S.losses++; S.hostile = Math.max(S.hostile, 120); }
				if (!e.squad.members.length) e.squad = null;
			}
			const d = Math.hypot(e.post.x - p.pos.x, e.post.z - p.pos.z), n = e.n - Math.min(e.n, Math.floor((e.lost || 0) / 2));
			if (!e.squad && !e.pending && d < 250 && n > 0 && !p.flying) {
				e.pending = true;
				sq.squad('guard', e.post.x, e.post.z, n, { post: e.post, y: e.post.y + 0.6, spread: 2, tag: S.id }).then((s) => { e.pending = false; e.squad = s; });
			}
		}
	}
	function postWorld(S, post, local = true) {
		if (!local) return { ...post, y: W().island.heightAt(post.x, post.z) };
		const [x, z] = toWorld(S, post.x, post.z), y = padAt(S, post.x, post.z) + (post.y || 0);
		return { ...post, x, z, y, yaw: (post.yaw || 0) + S.yaw, loop: post.loop?.map(([lx, lz]) => toWorld(S, lx, lz)) };
	}
	function releaseGarrison(S) {
		for (const e of S.posts || []) { for (const h of [...(e.squad?.members || [])]) if (!h.dead) combat.squads.release(h); e.squad = null; }
		S.posts = null;
	}
	const manned = (S) => (S.posts || []).reduce((a, e) => a + (e.squad ? e.squad.members.filter((h) => !h.dead).length : 0), 0);
	// the posts the stationed sides may stand at (combat's spawn rule), near you
	function posts() {
		const out = [], p = P();
		if (!p) return out;
		for (const S of sites.values()) {
			if (S.status !== 'sited' || Math.hypot(S.x - p.pos.x, S.z - p.pos.z) > 3000) continue;
			out.push({ x: S.x, z: S.z, r: Math.hypot(S.layout.W, S.layout.D) / 2 + 30, fid: 'guard' });
			out.push({ x: S.checkpoint.x, z: S.checkpoint.z, r: 60, fid: 'guard' });
		}
		for (const d of deployments) out.push({ x: d.x, z: d.z, r: d.r || 120, fid: 'guard' });
		return out;
	}
	const deployments = [];

	// ---------- you, at a base ----------
	// inside a base's fence: a warning, then the guards will fire on you if you stay
	function inside(S, x, z, pad = 0) { const [lx, lz] = toLocal(S, x, z); return Math.abs(lx) < S.layout.W / 2 + pad && Math.abs(lz) < S.layout.D / 2 + pad; }
	function watch(S, dt) {
		const p = P(), inF = inside(S, p.pos.x, p.pos.z);
		S.hostile = Math.max(0, S.hostile - dt);
		if (inF) {
			S.inside += dt;
			if (!S.warned) { S.warned = 1; hint(`${S.name}: restricted military area. Leave now, or the guards will open fire.`, 5000, 2); }
			if (S.inside > 14 && !S.hostile) { S.hostile = 90; combat?.squads?.hear?.(p.pos.x, p.pos.z, 400); hint(`${S.name}: the guards are coming for you.`, 3000, 2); }
		} else { S.inside = Math.max(0, S.inside - dt * 0.5); if (S.inside === 0) S.warned = 0; }
	}
	// a soldier's view of you: hostile while their base is
	function trespass(h) { const S = sites.get(h.squad?.tag || h.squad?.base); return !!S && S.hostile > 0; }
	// the armoury's rack: L to take a carbine (the guards will not like it)
	let armouryAt = null;
	function armoury(S) {
		const p = P(), b = S.layout.buildings.find((q) => q.type === 'armoury');
		const [x, z] = toWorld(S, b.x, b.z + b.d / 2 + 1.5);
		const near = Math.hypot(p.pos.x - x, p.pos.z - z) < 3.2;
		if (near && armouryAt !== S) { armouryAt = S; hint(`${S.name} armoury · L to take a carbine from the rack`, 3500, 1); }
		else if (!near && armouryAt === S) armouryAt = null;
	}
	addEventListener('keydown', (e) => {
		if ((e.key !== 'l' && e.key !== 'L') || e.repeat || !armouryAt || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
		takeFromArmoury(armouryAt);
	});
	function takeFromArmoury(S) {
		if (S.armouryT > 0) { hint('The rack is empty for now.', 2000, 1); return false; }
		S.armouryT = 600;
		combat?.arm?.('warden-spark-carbine', 6, 2);
		combat?.ammo?.(96);
		S.hostile = Math.max(S.hostile, 120);
		hint('You take a carbine and a few magazines from the rack. The guards saw you.', 3500, 2);
		return true;
	}

	// ---------- the parked vehicles: instanced, one draw per kind and material ----------
	const sets = new Map();
	let parkedDirty = true;
	const loose = [];                               // vehicles you left somewhere: { kind, x, y, z, yaw, scheme }
	function setFor(kind, mat, geo, cap) {
		const k = kind + '|' + mat;
		let S = sets.get(k);
		if (!S) {
			const material = kit[mat];
			const im = new THREE.InstancedMesh(geo, material, cap);
			im.count = 0; im.castShadow = mat !== 'lamp' && !isPhone; im.receiveShadow = true; im.frustumCulled = false; im.name = 'mil-parked-' + k;
			if (mat === 'camo' || mat === 'air') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
			group.add(im);
			S = { im, n: 0, cap, paint: mat === 'camo' || mat === 'air' };
			sets.set(k, S);
		}
		return S;
	}
	// every parked vehicle now: the bases' slots not taken, and the ones left about
	function parkedList() {
		const out = [];
		for (const S of sites.values()) {
			if (!S.built) continue;
			S.layout.parked.forEach((v, i) => {
				if (S.taken.has(i)) return;
				const [x, z] = toWorld(S, v.x, v.z);
				out.push({ kind: v.kind, x, z, y: padAt(S, v.x, v.z) + (v.kind === 'heli' ? 0.2 : 0.02), yaw: S.yaw + v.yaw, scheme: v.kind === 'jet' || v.kind === 'heli' ? 'grey' : S.scheme, base: S, slot: i });
			});
		}
		for (const v of loose) out.push(v);
		return out;
	}
	let parked = [];
	function drawParked() {
		parked = parkedList();
		for (const S of sets.values()) S.n = 0;
		const count = {};
		for (const v of parked) count[v.kind] = (count[v.kind] || 0) + 1;
		for (const v of parked) {
			const G = vehicleGeometry(v.kind);
			_m.compose(_p.set(v.x, v.y, v.z), _q.setFromAxisAngle(_y, v.yaw), _s.set(1, 1, 1));
			for (const [mat, geo] of Object.entries(G.whole)) {
				const S = setFor(v.kind, mat, geo, Math.max(16, (count[v.kind] || 1) * 2));
				if (S.n >= S.cap) continue;
				S.im.setMatrixAt(S.n, _m);
				if (S.paint) S.im.setColorAt(S.n, _c.set(SCHEMES[v.scheme] || SCHEMES.woodland));
				S.n++;
			}
		}
		for (const S of sets.values()) { S.im.count = S.n; S.im.instanceMatrix.needsUpdate = true; if (S.im.instanceColor) S.im.instanceColor.needsUpdate = true; S.im.visible = S.n > 0; }
		parkedDirty = false;
	}
	// the parked vehicle beside you, to get into (drive.js asks first)
	function vehicleToEnter(x, z) {
		let best = null, bd = 3.5;
		for (const v of parked) {
			const D = DIMS[v.kind], s = Math.sin(v.yaw), c = Math.cos(v.yaw), dx = x - v.x, dz = z - v.z;
			const a = dx * s + dz * c, b = dx * c - dz * s;
			const d = Math.hypot(Math.max(0, Math.abs(a) - D.L / 2), Math.max(0, Math.abs(b) - D.W / 2));
			if (d < bd) { bd = d; best = v; }
		}
		return best;
	}
	// taken: off its slot (or off the ground where it was left)
	function take(v) {
		if (v.base) { v.base.taken.add(v.slot); if (v.base.hostile <= 0 && combat?.wantedLevel?.() === 0) { const S = v.base; S.hostile = 60; hint(`${S.name}: someone is taking a ${v.kind === 'heli' ? 'helicopter' : v.kind}! Stop them!`, 3000, 2); } }
		else { const i = loose.indexOf(v); if (i >= 0) loose.splice(i, 1); }
		parkedDirty = true;
	}
	// left: where it stands now
	function leave(kind, x, y, z, yaw, scheme) { loose.push({ kind, x, y, z, yaw, scheme }); if (loose.length > 12) loose.shift(); parkedDirty = true; }

	// ---------- the world's floors and walls ----------
	function floor(x, z, y) {
		let best = -1e9;
		for (const S of sites.values()) {
			if (S.status !== 'sited' || Math.abs(x - S.x) > S.layout.W + 60 || Math.abs(z - S.z) > S.layout.W + 60) continue;
			const [lx, lz] = toLocal(S, x, z), L = S.layout, pad = padAt(S, lx, lz);
			const ox = Math.max(0, Math.abs(lx) - L.W / 2 - 4), oz = Math.max(0, Math.abs(lz) - L.D / 2 - 4), out = Math.hypot(ox, oz);
			if (out > 40 || y < pad - out / 3 - 4) continue;
			best = Math.max(best, pad - out / 3 + (out > 0 ? 0 : 0.1));
			if (out > 0) continue;
			for (const b of L.buildings) {
				const hx = b.w / 2 + (b.type === 'tower' ? 0.4 : 0.15), hz = b.d / 2 + (b.type === 'tower' ? 0.4 : 0.15);
				if (Math.abs(lx - b.x) > hx || Math.abs(lz - b.z) > hz) continue;
				const top = b.type === 'tower' ? b.h + 0.25 : b.type === 'helipad' ? 0.2 : b.type === 'hangar' || b.type === 'motorpool' || b.type === 'runway' || b.type === 'taxiway' || b.type === 'apron' || b.type === 'gate' ? 0 : b.type === 'control' ? b.h - 0.45 : b.h + 0.12;
				if (y >= pad + top - 0.5) best = Math.max(best, pad + top);
			}
		}
		// on a parked vehicle's top, for someone already up there
		for (const v of parked) {
			const D = DIMS[v.kind];
			if (Math.abs(x - v.x) > D.L || Math.abs(z - v.z) > D.L) continue;
			const s = Math.sin(v.yaw), c = Math.cos(v.yaw), dx = x - v.x, dz = z - v.z, a = dx * s + dz * c, b = dx * c - dz * s;
			const top = v.y + (v.kind === 'jet' ? 2.9 : v.kind === 'heli' ? 3.4 : D.H * 0.82);
			if (Math.abs(a) < D.L * 0.4 && Math.abs(b) < D.W * 0.32 && y >= top - 0.3) best = Math.max(best, top);
		}
		return best;
	}
	// out of the buildings, the fence and the parked vehicles (p: the eye; footY: the feet)
	function pushOut(p, footY) {
		for (const S of sites.values()) {
			if (!S.built || Math.abs(p.x - S.x) > S.layout.W / 2 + 40 || Math.abs(p.z - S.z) > S.layout.W / 2 + 40) continue;
			const L = S.layout;
			let [lx, lz] = toLocal(S, p.x, p.z);
			const pad = padAt(S, lx, lz);
			let moved = false;
			const box = (cx, cz, hw, hd, top) => {
				if (footY > pad + top - 0.3) return;
				const r = 0.32, dx = lx - cx, dz = lz - cz;
				if (Math.abs(dx) > hw + r || Math.abs(dz) > hd + r) return;
				const px = hw + r - Math.abs(dx), pz = hd + r - Math.abs(dz);
				if (px < pz) lx = cx + Math.sign(dx || 1) * (hw + r); else lz = cz + Math.sign(dz || 1) * (hd + r);
				moved = true;
			};
			for (const b of L.buildings) {
				const solid = ['barracks', 'hq', 'armoury', 'guardhouse', 'control', 'fuel'].includes(b.type);
				const I = solid && S.built.interiors.find((q) => q.frame.type === b.type && Math.abs(toLocal(S, q.frame.origin.x, q.frame.origin.z)[0] - b.x) < 1);
				if (I?.push) continue;
				if (solid) box(b.x, b.z, b.w / 2, b.d / 2, b.type === 'control' ? b.h : b.h + 0.6);
				else if (b.type === 'hangar') { const s = Math.cos(b.yaw || 0); box(b.x - b.w / 2, b.z, 0.6, b.d / 2, b.h * 0.5); box(b.x + b.w / 2, b.z, 0.6, b.d / 2, b.h * 0.5); box(b.x, b.z + s * b.d / 2, b.w / 2, 0.3, b.h); }
				else if (b.type === 'motorpool') box(b.x, b.z - b.d / 2, b.w / 2, 0.2, b.h);
				else if (b.type === 'tower') for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(b.x + sx * (b.w / 2 - 0.2), b.z + sz * (b.w / 2 - 0.2), 0.15, 0.15, b.h);
			}
			// the fence, but for its gate
			const fw = L.W / 2, fd = L.D / 2, g = L.fence.gate;
			if (Math.abs(lz - fd) < 0.5 && Math.abs(lx - g.x) > g.w / 2 && Math.abs(lx) < fw) { lz = fd + Math.sign(lz - fd || 1) * 0.5; moved = true; }
			if (Math.abs(lz + fd) < 0.5 && Math.abs(lx) < fw) { lz = -fd + Math.sign(lz + fd || 1) * 0.5; moved = true; }
			if (Math.abs(Math.abs(lx) - fw) < 0.5 && Math.abs(lz) < fd) { const s = Math.sign(lx); lx = s * fw + Math.sign(lx - s * fw || 1) * 0.5; moved = true; }
			for (const I of S.built.interiors) I.push?.(p, footY);
			if (moved) { const [x, z] = toWorld(S, lx, lz); p.x = x; p.z = z; }
		}
		for (const I of police?.stationsPush?.() || []) I(p, footY);
		for (const v of parked) {
			const D = DIMS[v.kind];
			if (Math.abs(p.x - v.x) > D.L || Math.abs(p.z - v.z) > D.L || footY > v.y + D.H * 0.8 - 0.3) continue;
			const s = Math.sin(v.yaw), c = Math.cos(v.yaw), dx = p.x - v.x, dz = p.z - v.z;
			let a = dx * s + dz * c, b = dx * c - dz * s;
			const hl = (v.kind === 'jet' ? D.L * 0.42 : D.L / 2) + 0.3, hw = (v.kind === 'jet' ? 1.2 : v.kind === 'heli' ? 1.5 : D.W / 2) + 0.3;
			if (Math.abs(a) > hl || Math.abs(b) > hw) continue;
			if (hl - Math.abs(a) < hw - Math.abs(b)) a = Math.sign(a || 1) * hl; else b = Math.sign(b || 1) * hw;
			p.x = v.x + a * s + b * c; p.z = v.z + a * c - b * s;
		}
	}
	// the police and the dispatch (they answer combat's hooks: the wanted level, trouble reported)
	const api = { deployments, basesState: () => [...sites.values()].filter((S) => S.status === 'sited') };
	const police = createPolice({ world, combat, group, hint, isPhone, night: kit.night, backup: (e) => dispatch.event(e) });
	api.police = police;
	const dispatch = createDispatch({ world, combat, military: api, kit, group, hint, isPhone });
	if (combat?.hooks) { combat.hooks.event = (e) => dispatch.event(e); combat.hooks.police = (stars, R, have) => police.respond(stars, R, have); }

	// ---------- each frame ----------
	function update(dt, night = 0) {
		const w = W(), p = P();
		if (!w || !p) return;
		if (w !== lastW) { reset(); lastW = w; }
		if (!w.bayArea) return;
		if (group.parent !== scene) scene.add(group);
		kit.night.value = night;
		if (FRAME.epoch !== epoch) { epoch = FRAME.epoch; for (const S of sites.values()) if (S.built) drop(S); scanT = 0; }
		scanT -= dt;
		if (scanT <= 0) { scanT = 2; scan(); }
		let sitedOne = false;
		for (const S of sites.values()) {
			const d = Math.hypot((S.status === 'sited' ? S.x : S.cx) - p.pos.x, (S.status === 'sited' ? S.z : S.cz) - p.pos.z);
			if (S.status === 'pending' && d < SITE_R && !sitedOne && w.bayArea.loaded?.()) { site(S); sitedOne = true; }
			if (S.status !== 'sited') continue;
			if (S.built) S.built.group.position.set(S.x, 0, S.z);
			if (!S.built && d < BUILD_R) build(S);
			else if (S.built && d > DROP_R) drop(S);
			if (!S.built) continue;
			S.armouryT = Math.max(0, S.armouryT - dt);
			const near = inside(S, p.pos.x, p.pos.z, GARRISON_R) || Math.hypot(S.checkpoint.x - p.pos.x, S.checkpoint.z - p.pos.z) < 300;
			if (near) garrison(S, dt);
			else if (S.posts && !inside(S, p.pos.x, p.pos.z, GARRISON_R + 150)) releaseGarrison(S);
			watch(S, dt);
			if (inside(S, p.pos.x, p.pos.z, 2)) armoury(S);
		}
		if (parkedDirty) drawParked();
		police.update(dt);
		dispatch.update(dt);
	}
	function reset() {
		for (const S of sites.values()) drop(S);
		sites.clear(); loose.length = 0; parked = []; deployments.length = 0;
		police.clear(); dispatch.clear();
		for (const S of sets.values()) { S.im.count = 0; }
		parkedDirty = true; epoch = -1;
	}

	// ---------- for the console ----------
	function info() {
		const p = P(), list = [...sites.values()].filter((S) => S.status !== 'failed').map((S) => ({ name: S.name, kind: S.kind, status: S.status, km: p ? +(Math.hypot((S.x ?? S.cx) - p.pos.x, (S.z ?? S.cz) - p.pos.z) / 1000).toFixed(1) : null, built: !!S.built, garrison: manned(S), losses: S.losses, hostile: S.hostile > 0, units: S.units, parked: S.built ? S.layout.parked.length - S.taken.size : 0 })).sort((a, b) => a.km - b.km);
		return { bases: list.slice(0, 12), patrols: dispatch.info(), police: police.info(), failed: [...sites.values()].filter((S) => S.status === 'failed').length, parked: parked.length, draws: [...sets.values()].filter((S) => S.n).length + list.filter((b) => b.built).length * 9 };
	}
	// go to a base (by name, a part of its name, or the nearest): you arrive outside its gate
	function goTo(name) {
		const p = P();
		if (!p) return 'no world';
		scan();
		const list = [...sites.values()].filter((S) => S.status !== 'failed');
		const S = name ? list.find((q) => q.name.toLowerCase().includes(String(name).toLowerCase())) : list.sort((a, b) => Math.hypot(a.cx - p.pos.x, a.cz - p.pos.z) - Math.hypot(b.cx - p.pos.x, b.cz - p.pos.z))[0];
		if (!S) return `No base called ${name}. Crysis.military() lists the ones near you.`;
		if (S.status === 'pending') { if (!W().bayArea.loaded?.()) return 'The ground is still loading.'; site(S); }
		if (S.status !== 'sited') return `${S.name}: no ground here fit for it.`;
		const [x, z] = toWorld(S, S.layout.gate.x + 6, S.layout.gate.z + 26), y = Math.max(W().island.heightAt(x, z), floor(x, z, 1e4));
		p.flying = false; p.pos.set(x, y + 1.68, z); p.vel?.set?.(0, 0, 0);
		p.yaw = S.yaw; p.pitch = -0.05;
		return `${S.name} (${S.kind === 'airbase' ? 'air station' : 'garrison'}), at the gate.`;
	}

	return {
		group, update, reset, info, goTo, floor, push: pushOut, posts, trespass, vehicleToEnter, take, leave, kit,
		board: (v, io) => milDrive.board(v, io),
		sites, parked: () => parked, deployments, frames: (name) => { const S = [...sites.values()].find((q) => q.name === name || q.id === name); return S && S.status === 'sited' ? frameList(S) : []; },
		setInteriors(m = {}) { for (const k of Object.keys(interiors)) { const f = m[k] || m['build' + k[0].toUpperCase() + k.slice(1)]; if (typeof f === 'function') interiors[k] = f; } for (const S of sites.values()) if (S.built) for (const f of frameList(S)) furnish(S, f); return Object.keys(interiors).filter((k) => interiors[k]); },
		takeFromArmoury, police, dispatch,
		// trouble now: Crysis.military.api.invade(), .alert('boss' | 'gang' | 'riot') at you
		invade: (at) => dispatch.invade(at),
		alert: (kind = 'gang', severity = 2) => { const p = P(); return p ? dispatch.event({ kind, x: p.pos.x + 30, z: p.pos.z + 30, severity }) && dispatch.info() : null; },
		setStations: (fn) => police.setStations(fn),
		basesState: () => [...sites.values()].filter((S) => S.status === 'sited').map((S) => S),
	};
}
