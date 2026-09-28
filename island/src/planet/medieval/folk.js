// The realm's people: real bodies (people/body.js) in the clothes of the place. Over the
// body's own tunic, hose and shoes each is dressed as they work: a long gown for most
// women, a tunic skirted to the thigh and belted for the men, a mantle across the back, a
// linen coif or a felt cap; the smith and the baker in aprons; the guards in mail with the
// realm's arms on their tabards, kettle helmets and spears. The skirts are rigid shells
// hung from the hips (people/motion.js swings the legs inside them).
//
// Built only as you come near a place, one body at a time.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../../people/body.js';
import { createMotion } from '../../people/motion.js';

const DYES = { russet: [0.48, 0.23, 0.13], madder: [0.58, 0.15, 0.12], woad: [0.2, 0.28, 0.48], undyed: [0.72, 0.66, 0.54], brown: [0.38, 0.28, 0.19], green: [0.28, 0.38, 0.2], ochre: [0.68, 0.52, 0.24], grey: [0.44, 0.44, 0.42], black: [0.12, 0.11, 0.1], linen: [0.88, 0.85, 0.78], plum: [0.36, 0.16, 0.28] };
const WORK = ['russet', 'undyed', 'brown', 'green', 'ochre', 'grey', 'woad'];
const FINE = ['madder', 'woad', 'plum', 'green', 'black'];

// ---------- clothes over the body ----------
function measure(P) {
	// the body's girth at the hips and waist, the skull's box, from the skin itself
	const g = P.skin.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
	const head = P.map.head, H = (n) => P.rest.heads[P.map[n]];
	const hipY = H('upperleg01.L').y, waistY = H('spine04').y + 0.02;
	// (the arms hang beside the hips: they are left out of the girth)
	const armB = new Set(P.bones.map((bn, i) => (/^(upperarm|lowerarm|wrist|metacarpal|finger|shoulder|clavicle)/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
	const onArm = (i) => { let w = 0; for (let q = 0; q < 4; q++) if (armB.has(si.getComponent(i, q))) w += sw.getComponent(i, q); return w > 0.3; };
	const at = (y0, band) => { let hx = 0, z0 = 1e9, z1 = -1e9; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (Math.abs(y - y0) > band || onArm(i)) continue; hx = Math.max(hx, Math.abs(pos.getX(i))); z0 = Math.min(z0, pos.getZ(i)); z1 = Math.max(z1, pos.getZ(i)); } return { hx, zc: (z0 + z1) / 2, hz: (z1 - z0) / 2 }; };
	const hip = at(hipY - 0.04, 0.03), waist = at(waistY, 0.03), chest = at(H('spine01').y, 0.03);
	const sk = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
	for (let i = 0; i < pos.count; i++) {
		let w = 0;
		for (let q = 0; q < 4; q++) if (si.getComponent(i, q) === head) w += sw.getComponent(i, q);
		if (w < 0.85) continue;
		const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
		sk.x0 = Math.min(sk.x0, x); sk.x1 = Math.max(sk.x1, x); sk.y0 = Math.min(sk.y0, y); sk.y1 = Math.max(sk.y1, y); sk.z0 = Math.min(sk.z0, z); sk.z1 = Math.max(sk.z1, z);
	}
	return { hipY, waistY, hip, waist, chest, skull: sk, kneeY: H('lowerleg01.L').y, ankleY: H('foot.L').y, neckY: H('neck01').y, shoulderX: Math.abs(H('upperarm01.L').x) };
}
const cloth = (A, c, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...c, THREE.SRGBColorSpace), roughness: o.rough ?? 0.95, metalness: o.metal ?? 0, side: THREE.DoubleSide, normalMap: A.fabric[o.weave || 'canvas'], normalScale: new THREE.Vector2(0.4, 0.4), map: o.map || null });
// a rigid shell round the body: a lathe from `top` down, radii (in girths) at heights below it
function shell(bone, P, m, prof, mat, phi0 = 0, phiL = Math.PI * 2, zc = 0, sx = 1, sz = 1) {
	const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
	const g = new THREE.LatheGeometry(pts, 18, phi0, phiL);
	const mesh = new THREE.Mesh(g, mat);
	mesh.scale.set(sx, 1, sz);
	const b = P.map[bone], h = P.rest.heads[b];
	mesh.position.set(-h.x, -h.y, zc - h.z);
	mesh.castShadow = true;
	P.bones[b].add(mesh);
	return mesh;
}
export function dress(A, P, g, arms) {
	const m = measure(P), out = [];
	const hx = Math.max(m.hip.hx, m.waist.hx) + 0.012, hz = Math.max(m.hip.hz, m.waist.hz) + 0.02, zc = m.hip.zc;
	// the long skirt of a gown, or a tunic's to the thigh
	if (g.skirt) {
		const hem = g.skirt === 'gown' ? m.ankleY + 0.035 : m.kneeY + 0.14;
		const flare = g.skirt === 'gown' ? 1.62 : 1.3;
		out.push(shell('root', P, m, [[0.93, m.waistY], [1.02, m.hipY + 0.02], [1.14, m.hipY - 0.12], [(1.14 + flare) / 2, (m.hipY - 0.12 + hem) / 2], [flare, hem], [flare - 0.04, hem - 0.01]].reverse(), cloth(A, g.skirtC || g.body), 0, Math.PI * 2, zc, hx, hz));
	}
	// a belt
	if (g.belt) out.push(shell('root', P, m, [[1.0, m.waistY - 0.03], [1.0, m.waistY + 0.02]], cloth(A, [0.2, 0.13, 0.08], { rough: 0.6 }), 0, Math.PI * 2, m.waist.zc, m.waist.hx + 0.015, m.waist.hz + 0.02));
	// a mantle across the back, from the shoulders
	if (g.mantle) {
		const top = m.neckY - 0.04, bot = g.mantle === 'long' ? m.kneeY : m.hipY - 0.05;
		out.push(shell('spine01', P, m, [[0.55, top + 0.03], [1.0, top - 0.04], [1.08, (top + bot) / 2], [1.25, bot]].reverse(), cloth(A, g.mantleC, { weave: 'twill' }), Math.PI - 1.35, 2.7, m.chest.zc - 0.01, m.shoulderX + 0.07, m.chest.hz + 0.06));
	}
	// an apron, front of the hips
	if (g.apron) {
		const w = m.waist.hx * 1.5, top = m.waistY + (g.apron === 'bib' ? 0.28 : 0), bot = m.kneeY - 0.05;
		const geo = new THREE.PlaneGeometry(w, top - bot, 1, 4);
		const pa = geo.attributes.position;
		for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, Math.max(0, -y) * 0.12 + Math.abs(pa.getX(i)) * -0.15); }
		geo.computeVertexNormals();
		const ap = new THREE.Mesh(geo, cloth(A, g.apronC, { rough: 0.8 }));
		const b = P.map.root, h = P.rest.heads[b];
		ap.position.set(-h.x, (top + bot) / 2 - h.y, m.hip.zc + m.hip.hz + 0.035 - h.z);
		P.bones[b].add(ap);
		out.push(ap);
	}
	// a tabard with the arms, over the mail
	if (g.tabard) {
		for (const s of [1, -1]) {
			const top = m.neckY - 0.06, bot = m.hipY - 0.2, w = m.shoulderX * 1.35;
			const geo = new THREE.PlaneGeometry(w, top - bot, 1, 3);
			const ta = new THREE.Mesh(geo, s > 0 ? new THREE.MeshStandardMaterial({ map: arms, roughness: 0.9, side: THREE.DoubleSide }) : cloth(A, g.tabardC));
			const b = P.map.spine01, h = P.rest.heads[b];
			ta.position.set(-h.x, (top + bot) / 2 - h.y, m.chest.zc + s * (m.chest.hz + 0.05) - h.z);
			if (s < 0) ta.rotation.y = Math.PI;
			P.bones[b].add(ta);
			out.push(ta);
		}
	}
	// on the head: a coif, a felt cap, a kettle helmet
	if (g.hat) {
		const sk = m.skull, cx = (sk.x0 + sk.x1) / 2, cz = (sk.z0 + sk.z1) / 2 - 0.005, rx = (sk.x1 - sk.x0) / 2 + 0.018, rz = (sk.z1 - sk.z0) / 2 + 0.02, top = sk.y1 + 0.015;
		const hb = P.map.head, h = P.rest.heads[hb];
		const prof = [];
		const deep = g.hat === 'coif' ? 0.13 : g.hat === 'helm' ? 0.1 : 0.075;
		for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.001, Math.cos(a)), top - deep + Math.sin(a) * deep)); }
		const geo = new THREE.LatheGeometry(prof.reverse(), 18);
		const mat = g.hat === 'helm' ? new THREE.MeshStandardMaterial({ color: 0x8a8c90, metalness: 0.75, roughness: 0.38 }) : cloth(A, g.hatC, { weave: 'knit' });
		const cap = new THREE.Mesh(geo, mat);
		cap.scale.set(rx, 1, rz);
		cap.position.set(cx - h.x, -h.y, cz - h.z);
		P.bones[hb].add(cap);
		out.push(cap);
		if (g.hat === 'helm') {
			const brim = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(1.55, top - deep - 0.02), new THREE.Vector2(1.0, top - deep + 0.012)], 18), mat);
			brim.scale.set(rx, 1, rz);
			brim.position.copy(cap.position);
			P.bones[hb].add(brim);
			out.push(brim);
		}
		// (the hair under a cap is tucked away)
		if (P.hair && g.hat !== 'cap') P.hair.visible = false;
	}
	// mail on the body: the shirt turned to iron rings
	if (g.mail && P.meshes[1]) {
		P.meshes[1].material = new THREE.MeshStandardMaterial({ color: 0x6d7074, metalness: 0.7, roughness: 0.42, normalMap: A.fabric.knit, normalScale: new THREE.Vector2(1.2, 1.2), side: THREE.DoubleSide });
	}
	return out;
}

// ---------- who lives here ----------
export function outfitFor(kind, r, d, fields) {
	const P = (a) => a[Math.floor(r() * a.length)];
	const o = d.outfit;
	o.sleeves = 'long'; o.legs = 'long'; o.jacket = null; o.fabricTop = 'canvas'; o.shoes = [0.2, 0.14, 0.09];
	const g = { belt: true };
	const body = DYES[P(kind === 'fine' ? FINE : WORK)];
	if (kind === 'guard') {
		o.top = [0.4, 0.4, 0.42]; o.bottom = DYES.brown; o.shoes = [0.12, 0.1, 0.08];
		Object.assign(g, { mail: true, tabard: true, tabardC: fields.field, hat: 'helm', skirt: 'tunic', skirtC: [0.36, 0.36, 0.38] });
	} else if (kind === 'smith') {
		o.top = DYES.undyed; o.bottom = DYES.brown;
		Object.assign(g, { skirt: 'tunic', skirtC: DYES.brown, apron: 'bib', apronC: [0.3, 0.2, 0.12] });
	} else if (kind === 'priest') {
		o.top = DYES.black; o.bottom = DYES.black;
		Object.assign(g, { skirt: 'gown', skirtC: DYES.black, belt: true, mantle: 'long', mantleC: [0.9, 0.88, 0.82] });
	} else if (kind === 'child') {
		o.top = body; o.bottom = DYES[P(WORK)];
		if (!d.male) Object.assign(g, { skirt: 'gown', skirtC: body }); else Object.assign(g, { skirt: 'tunic', skirtC: body });
		if (r() < 0.4) Object.assign(g, { hat: 'cap', hatC: DYES[P(WORK)] });
	} else if (!d.male) {
		o.top = body; o.bottom = body;
		Object.assign(g, { skirt: 'gown', skirtC: body, hat: r() < 0.7 ? 'coif' : null, hatC: DYES.linen });
		if (kind === 'baker') Object.assign(g, { apron: 'waist', apronC: DYES.linen, hat: 'coif' });
		if (kind === 'fine' || r() < 0.35) Object.assign(g, { mantle: kind === 'fine' ? 'long' : 'short', mantleC: DYES[P(kind === 'fine' ? FINE : WORK)].map((v) => v * 0.8) });
	} else {
		o.top = body; o.bottom = DYES[P(['brown', 'grey', 'russet', 'green', 'black'])];
		Object.assign(g, { skirt: 'tunic', skirtC: body.map((v) => v * 0.92) });
		if (kind === 'fine' || r() < 0.3) Object.assign(g, { mantle: 'short', mantleC: DYES[P(FINE)] });
		if (r() < 0.45) Object.assign(g, { hat: 'cap', hatC: DYES[P(['brown', 'green', 'russet', 'black', 'woad'])] });
	}
	return g;
}

// the cast, by place: each a role in the realm, and where they stand or go
export function castOf(realm) {
	const T = realm.town, C = realm.castle, list = [];
	const at = (p, dx = 0, dz = 0) => ({ x: p.x + dx, z: p.z + dz });
	const stalls = realm.stalls;
	const faceTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
	// the town
	if (stalls[0]?.keeper) list.push({ id: 'baker', name: 'Mary', title: 'the baker', kind: 'baker', sex: 'f', age: 38, area: 'town', role: 'keep', at: stalls[0].keeper, face: stalls[0].yaw });
	if (stalls[1]?.keeper) list.push({ id: 'trader1', name: 'Walter', title: 'a cheesemonger', kind: 'work', sex: 'm', age: 50, area: 'town', role: 'keep', at: stalls[2]?.keeper || stalls[1].keeper, face: (stalls[2] || stalls[1]).yaw });
	if (stalls[3]?.keeper) list.push({ id: 'trader2', name: 'Agnes', title: 'a potter', kind: 'work', sex: 'f', age: 44, area: 'town', role: 'keep', at: stalls[3].keeper, face: stalls[3].yaw });
	list.push({ id: 'mother', name: 'Alys', title: 'a weaver', kind: 'work', sex: 'f', age: 31, area: 'town', role: 'stand', at: at(T, 3.2, 1.5), face: faceTo(at(T, 3.2, 1.5), T) });
	if (realm.smithy?.anvil) list.push({ id: 'smith', name: 'Godric', title: 'the blacksmith', kind: 'smith', sex: 'm', age: 42, muscle: 0.9, area: 'town', role: 'smith', at: { x: realm.smithy.anvil[0], z: realm.smithy.anvil[2] }, face: realm.smithy.yaw + Math.PI });
	if (realm.innDoor) list.push({ id: 'innkeeper', name: 'Bess', title: 'keeper of the inn', kind: 'work', sex: 'f', age: 47, area: 'town', role: 'stand', at: { x: realm.innDoor[0], z: realm.innDoor[2] }, face: realm.inn.yaw });
	if (realm.chapel?.door) list.push({ id: 'widow', name: 'Edith', title: 'a widow', kind: 'fine', sex: 'f', age: 66, area: 'town', role: 'stand', at: { x: realm.chapel.door[0], z: realm.chapel.door[2] }, face: realm.chapel.yaw + 0.6 });
	if (realm.chapel?.door) list.push({ id: 'priest', name: 'Father Anselm', title: 'the priest', kind: 'priest', sex: 'm', age: 58, area: 'town', role: 'stand', at: { x: realm.chapel.door[0] + Math.sin(realm.chapel.yaw + 1.6) * 1.6, z: realm.chapel.door[2] + Math.cos(realm.chapel.yaw + 1.6) * 1.6 }, face: realm.chapel.yaw });
	list.push({ id: 'walker1', name: 'Hal', title: 'a carter', kind: 'work', sex: 'm', age: 34, area: 'town', role: 'walk', at: at(T, -5, 4) });
	list.push({ id: 'walker2', name: 'Joan', title: 'a spinster', kind: 'work', sex: 'f', age: 25, area: 'town', role: 'walk', at: at(T, 6, -5) });
	list.push({ id: 'kid1', name: 'Kit', title: 'a child', kind: 'child', sex: 'm', age: 8, area: 'town', role: 'play', at: at(T, -3, -6) });
	list.push({ id: 'kid2', name: 'Nell', title: 'a child', kind: 'child', sex: 'f', age: 7, area: 'town', role: 'play', at: at(T, -4, -4) });
	// the castle
	const g = C.gate, out = (d, s) => ({ x: g.x + Math.sin(g.yaw) * d + Math.cos(g.yaw) * s, z: g.z + Math.cos(g.yaw) * d - Math.sin(g.yaw) * s });
	list.push({ id: 'guard1', name: 'Piers', title: 'a man-at-arms', kind: 'guard', sex: 'm', age: 28, area: 'castle', role: 'guard', at: out(5.2, 2.6), face: g.yaw });
	list.push({ id: 'guard2', name: 'Ralf', title: 'a man-at-arms', kind: 'guard', sex: 'm', age: 35, area: 'castle', role: 'guard', at: out(5.2, -2.6), face: g.yaw });
	list.push({ id: 'captain', name: 'Sir Roland', title: 'captain of the guard', kind: 'guard', sex: 'm', age: 45, area: 'castle', role: 'stand', at: out(-7, 1.5), face: g.yaw });
	if (C.hall) { const K = C.keep; list.push({ id: 'steward', name: 'Master Osbert', title: `steward to ${realm.lord}`, kind: 'fine', sex: 'm', age: 55, area: 'castle', role: 'stand', at: { x: K.x + Math.sin(K.yaw) * 1.5 + Math.cos(K.yaw) * 2.2, z: K.z + Math.cos(K.yaw) * 1.5 - Math.sin(K.yaw) * 2.2 }, face: K.yaw + Math.PI / 2 }); }
	list.push({ id: 'guard3', name: 'Tom', title: 'a man-at-arms', kind: 'guard', sex: 'm', age: 22, area: 'castle', role: 'walk', at: out(-12, -4) });
	// the mills, the fields
	if (realm.windmill?.door) list.push({ id: 'miller', name: 'Hugh', title: 'the miller', kind: 'work', sex: 'm', age: 52, area: 'windmill', role: 'stand', at: realm.windmill.door, face: realm.windmill.yaw });
	const fields = realm.fields.filter((f) => f.crop !== 'pasture').slice(0, 2);
	fields.forEach((f, i) => list.push({ id: 'farmer' + i, name: i ? 'Cuthbert' : 'Wilfred', title: 'a farmer', kind: 'work', sex: 'm', age: 40 + i * 12, area: 'field' + i, role: 'farm', at: { x: f.x, z: f.z }, field: f }));
	return list;
}

// ---------- the people in the world ----------
export function createFolk({ realm, scene, camera, ground, isPhone, arms }) {
	const cast = castOf(realm);
	const areas = {};
	for (const c of cast) (areas[c.area] ||= { list: [], x: 0, z: 0, n: 0 }).list.push(c);
	for (const a of Object.values(areas)) { for (const c of a.list) { a.x += c.at.x; a.z += c.at.z; } a.x /= a.list.length; a.z /= a.list.length; }
	const group = new THREE.Group();
	group.name = 'medieval-folk';
	scene.add(group);
	let A = null, busy = false;
	const folk = [];
	const byId = {};
	const rnd = (() => { let s = (realm.seed ^ 0xf01c) >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
	const limit = isPhone ? 9 : 16;
	// one area at a time, one body at a time
	async function grow(area) {
		busy = true;
		try {
			A = A || await loadPeopleAssets();
			for (const c of area.list) {
				if (c.built || folk.length >= limit + 4) continue;
				c.built = true;
				const seed = (realm.seed ^ (c.id.split('').reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261))) >>> 0;
				const d = personDNA(seed, { age: c.age });
				const male = c.sex === 'm';
				d.male = male; d.sex = male ? 0.85 : 0.12;
				if (c.muscle) d.muscle = c.muscle;
				if (!d.child) d.hair = male ? (d.age > 60 && rnd() < 0.4 ? null : rnd() < 0.5 ? 'short01' : 'short02') : 'ponytail01';
				const g = outfitFor(c.kind === 'child' ? 'child' : c.kind, rnd, d, realm.arms);
				const P = buildPerson(A, d);
				dress(A, P, g, arms);
				const y = ground(c.at.x, c.at.z, null);
				const Mo = createMotion(P, (x, z) => ground(x, z, P.root.position.y));
				Mo.place(c.at.x, y, c.at.z, c.face ?? rnd() * Math.PI * 2);
				if (c.role === 'guard') Mo.setPose('behind');
				else if (c.role === 'keep') Mo.setPose(rnd() < 0.5 ? 'rest' : 'crossed');
				else if (c.role === 'stand') Mo.setPose(c.id === 'steward' || c.id === 'priest' ? 'behind' : 'rest');
				const p = { c, P, M: Mo, t: rnd() * 4, target: null, idle: 0, home: { ...c.at }, id: c.id, name: c.name, title: c.title };
				group.add(P.root);
				// a guard's spear stands by his hand
				if (c.kind === 'guard' && c.role !== 'walk') {
					const sp = spear();
					p.spear = sp;
					group.add(sp);
				}
				folk.push(p);
				byId[c.id] = p;
				await new Promise((ok) => setTimeout(ok, 25));
			}
		} catch (e) { console.warn('[medieval] folk', e); }
		busy = false;
	}
	function spear() {
		const g = new THREE.Group();
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.8 }));
		shaft.position.y = 1.15;
		const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x9a9ca0, metalness: 0.8, roughness: 0.3 }));
		head.position.y = 2.45;
		shaft.castShadow = true;
		g.add(shaft, head);
		return g;
	}
	const look = new THREE.Vector3();
	// someone asked to follow (a child led home) or to stand elsewhere
	const extra = [];
	function update(dt, t, player, night) {
		const cam = camera.position;
		for (const a of Object.values(areas)) {
			a.d = Math.hypot(a.x - cam.x, a.z - cam.z);
			if (!busy && a.d < 150 && a.list.some((c) => !c.built)) grow(a);
		}
		look.copy(cam);
		for (const p of folk) {
			const M = p.M, S = M.S.pos, a = areas[p.c.area];
			const on = a.d < 190 && !p.away;
			p.P.root.visible = on;
			if (p.spear) p.spear.visible = on;
			if (!on) continue;
			p.t -= dt;
			const pd = Math.hypot(cam.x - S.x, cam.z - S.z);
			M.S.look.target = pd < 6 && player ? look : null;
			const R = p.c.role;
			if (p.lead) {
				// following someone: keep a step behind them
				const L = p.lead(), dx = L.x - S.x, dz = L.z - S.z, dd = Math.hypot(dx, dz);
				M.want.heading = Math.atan2(dx, dz);
				M.want.speed = dd > 1.8 ? Math.min(2.4, (dd - 1.4) * 1.2) : 0;
				M.want.run = dd > 5 ? 1 : 0;
				if (dd > 14) M.place(L.x - dx / dd * 1.5, ground(L.x - dx / dd * 1.5, L.z - dz / dd * 1.5, L.y), L.z - dz / dd * 1.5, M.want.heading);
			} else if (R === 'walk' || R === 'play' || R === 'farm') {
				if (p.idle > 0) { p.idle -= dt; M.want.speed = 0; }
				else {
					if (!p.target) {
						const h = p.home, rr = R === 'play' ? 7 : R === 'farm' ? 10 : 16;
						if (R === 'farm' && p.c.field) { const f = p.c.field, u = (rnd() - 0.5) * f.w * 0.8, v = (rnd() - 0.5) * f.d * 0.8; p.target = { x: f.x + u * Math.cos(f.yaw) + v * Math.sin(f.yaw), z: f.z - u * Math.sin(f.yaw) + v * Math.cos(f.yaw) }; }
						else p.target = { x: h.x + (rnd() - 0.5) * rr * 2, z: h.z + (rnd() - 0.5) * rr * 2 };
					}
					const dx = p.target.x - S.x, dz = p.target.z - S.z, dd = Math.hypot(dx, dz);
					M.want.heading = Math.atan2(dx, dz);
					M.want.speed = dd < 0.5 ? 0 : (R === 'play' ? 1.8 : R === 'farm' ? 0.8 : 1.1) * Math.min(1, dd);
					M.want.run = R === 'play' && rnd() < 0.01 ? 1 : M.want.run * 0.99;
					if (pd < 1.4) M.want.heading += 0.8;
					if (dd < 0.6 || p.t < -20) { p.target = null; p.t = 0; p.idle = R === 'play' ? rnd() * 2 : 2 + rnd() * 6; if (R === 'farm') M.gesture('think'); }
				}
			} else if (R === 'smith') {
				M.want.speed = 0;
				// the hammer falls: a strike every second or so
				if (p.t < 0) { p.t = 0.9 + rnd() * 0.5; M.gesture(pd < 8 && rnd() < 0.2 ? 'wave' : 'emphatic'); }
			} else if (R === 'keep' || R === 'stand' || R === 'guard') {
				M.want.speed = 0;
				if (pd < 6 && p.t < 0 && R !== 'guard') { p.t = 4 + rnd() * 5; M.gesture(['explain', 'nod', 'open', 'wave'][Math.floor(rnd() * 4)]); M.want.heading = Math.atan2(cam.x - S.x, cam.z - S.z); }
				else if (p.t < 0) { p.t = 6 + rnd() * 8; M.want.heading = (p.c.face ?? M.want.heading) + (rnd() - 0.5) * 0.6; if (R !== 'guard' && rnd() < 0.3) M.gesture('think'); }
			}
			if (p.talking) { M.want.speed = 0; M.want.heading = Math.atan2(cam.x - S.x, cam.z - S.z); M.S.talk = p.talking > 0 ? 1 : 0; p.talking = Math.max(0, p.talking - dt); }
			M.update(dt, t, cam);
			if (p.spear) { const h = M.S.heading; p.spear.position.set(S.x + Math.cos(h) * 0.34 + Math.sin(h) * 0.12, S.y, S.z - Math.sin(h) * 0.34 + Math.cos(h) * 0.12); }
		}
		for (const x of extra) x(dt, t, night);
	}
	// the one nearest a point, within reach, who can be spoken to
	function facing(pos, yaw, reach = 3.4) {
		let best = null, bd = reach;
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
		for (const p of folk) {
			if (!p.P.root.visible) continue;
			const S = p.M.S.pos, dx = S.x - pos.x, dz = S.z - pos.z, d = Math.hypot(dx, dz);
			if (d > bd || Math.abs(S.y - (pos.y - 1.6)) > 2.5) continue;
			if ((dx * fx + dz * fz) / (d || 1) < 0.2 && d > 1.3) continue;
			best = p; bd = d;
		}
		return best;
	}
	function dispose() {
		scene.remove(group);
		group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map && m.map !== arms) m.map.dispose?.(); m.dispose(); }); });
		folk.length = 0;
	}
	return { update, facing, dispose, folk, byId, cast, group, extra, areas, grow: (id) => { const c = cast.find((q) => q.id === id); const a = c && areas[c.area]; if (a && !busy) grow(a); } };
}

// a single person made on demand (the child lost in the caves): lit as the caves are
export async function makeOne(realm, seed, opts, arms) {
	const A = await loadPeopleAssets();
	const d = personDNA(seed, { age: opts.age });
	d.male = opts.sex === 'm'; d.sex = d.male ? 0.85 : 0.12;
	const r = (() => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
	const g = outfitFor(opts.kind || 'child', r, d, realm.arms);
	const P = buildPerson(A, d);
	dress(A, P, g, arms);
	return P;
}
