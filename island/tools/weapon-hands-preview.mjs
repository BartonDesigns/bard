// First-person weapon hands under review: the production viewmodel and fists on the real
// MakeHuman body, plus a measurement of every finger's skin against the weapon's own mesh.
// Bundled by tools/weapon-hands-browser.mjs; not part of the shipped app.
import './weapon-hand-preview.mjs';
import * as T from 'three';
import { createFistView } from '../src/combat/melee-view.js';
import { HOLDS, GRIPS, holdFrame } from '../src/crysis/held-items.js';
import * as FP from '../src/crysis/finger-pose.js';
import { MOVES } from '../src/combat/melee-rules.js';
const w = window.weaponReview, fists = createFistView({ camera: w.camera, isPhone: w.phoneTier });
w.scene.add(w.camera);
const fist = { on: false, item: null, move: null, anim: null, m: null, mt: 0, charging: false, charge: 0, block: false, take: false, cuffed: false, dodge: 0, dodgeSide: 0, rock: 0, step: 0, pace: 0 };

// ---------- the weapon's triangles near the hands, in the view's frame ----------
const CELL = 0.008, REACH = 0.03;
function weaponGrid(model, box) {
	model.updateMatrixWorld(true);
	const tris = [], grid = new Map(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), lo = box.min, hi = box.max;
	model.traverse((o) => {
		if (!o.isMesh || !o.visible || o.name === 'glass' || o.isPoints) return;
		const g = o.geometry, p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count;
		for (let i = 0; i < n; i += 3) {
			const i0 = ix ? ix.getX(i) : i, i1 = ix ? ix.getX(i + 1) : i + 1, i2 = ix ? ix.getX(i + 2) : i + 2;
			a.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(p, i2).applyMatrix4(o.matrixWorld);
			const x0 = Math.min(a.x, b.x, c.x) - REACH, x1 = Math.max(a.x, b.x, c.x) + REACH, y0 = Math.min(a.y, b.y, c.y) - REACH, y1 = Math.max(a.y, b.y, c.y) + REACH, z0 = Math.min(a.z, b.z, c.z) - REACH, z1 = Math.max(a.z, b.z, c.z) + REACH;
			if (x1 < lo.x || x0 > hi.x || y1 < lo.y || y0 > hi.y || z1 < lo.z || z0 > hi.z) continue;
			const t = tris.length / 9; tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
			for (let X = Math.floor(Math.max(x0, lo.x) / CELL); X <= Math.floor(Math.min(x1, hi.x) / CELL); X++)
				for (let Y = Math.floor(Math.max(y0, lo.y) / CELL); Y <= Math.floor(Math.min(y1, hi.y) / CELL); Y++)
					for (let Z = Math.floor(Math.max(z0, lo.z) / CELL); Z <= Math.floor(Math.min(z1, hi.z) / CELL); Z++) {
						const k = X + ',' + Y + ',' + Z; let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(t);
					}
		}
	});
	return { tris, grid };
}
// the signed distance from p to the nearest triangle (negative inside the surface), or REACH
const tri = new T.Triangle(), cp = new T.Vector3(), nn = new T.Vector3();
function signed(W, p) {
	const list = W.grid.get(Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL) + ',' + Math.floor(p.z / CELL));
	if (!list) return REACH;
	let best = REACH, sign = 1;
	for (const t of list) {
		const o = t * 9, q = W.tris;
		tri.a.set(q[o], q[o + 1], q[o + 2]); tri.b.set(q[o + 3], q[o + 4], q[o + 5]); tri.c.set(q[o + 6], q[o + 7], q[o + 8]);
		tri.closestPointToPoint(p, cp);
		const d = cp.distanceTo(p);
		if (d < best) { best = d; tri.getNormal(nn); sign = nn.dot(cp.sub(p).negate()) < 0 ? -1 : 1; }
	}
	return best * sign;
}
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'];
// every skin vertex of each finger (and the palm) against the weapon: the deepest it sinks in
// (negative, millimetres) or the nearest it comes (the gap), per finger and per hand
function fingerContact() {
	const S = w.vm.state, model = S.model;
	if (!model) return null;
	let skin = w.vm.armsSkin;
	model.parent.parent.traverse((o) => { if (!w.vm.armsSkin && o.isSkinnedMesh && o.material !== model.getObjectByName('body').material && o.visible && (!skin || o.geometry.index.count > skin.geometry.index.count)) skin = o; });
	if (!skin) return null;
	const g = skin.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = w.P.bones.map((b) => b.name), v = new T.Vector3();
	const verts = [], box = new T.Box3();
	for (let i = 0; i < g.attributes.position.count; i++) {
		let best = 0; for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
		const name = names[si.getComponent(i, best)], m = /^(finger(\d)-(\d)|metacarpal\d|wrist)\.(L|R)$/.exec(name);
		if (!m) continue;
		skin.getVertexPosition(i, v);
		if (!Number.isFinite(v.x) || v.lengthSq() < 1e-8) continue;
		verts.push({ side: m[4], part: m[2] ? FINGERS[+m[2] - 1] : 'palm', joint: m[3] ? +m[3] : 0, p: v.clone() });
		box.expandByPoint(v);
	}
	box.expandByScalar(REACH);
	const W = weaponGrid(model, box), out = { L: {}, R: {} };
	for (const x of verts) {
		const d = signed(W, x.p), r = out[x.side][x.part] ||= { min: REACH, tip: REACH, n: 0, inside: 0 };
		r.min = Math.min(r.min, d); r.n++; if (d < -0.0005) r.inside++;
		if (x.joint === 3 || x.part === 'palm') r.tip = Math.min(r.tip, Math.abs(d));
	}
	for (const s of ['L', 'R']) for (const k in out[s]) { const r = out[s][k]; out[s][k] = { minMm: +(r.min * 1000).toFixed(1), padMm: +(r.tip * 1000).toFixed(1), inside: r.inside, n: r.n }; }
	return out;
}

function fists_(mode, me) {
	fist.on = mode !== 'off'; fist.block = mode === 'block'; fist.item = null;
	for (let i = 0; i < 40; i++) fists.update(1 / 60, 1 + i / 60, fist, me || { P: w.P, M: w.M });
}
// an animator's look at one hand: the viewmodel's own scene from a camera beside it
// (side: 'R' or 'L'; from: a direction in the view's frame to look from; dist: metres)
const inspectCam = new T.PerspectiveCamera(32, 1, 0.005, 5), at = new T.Vector3();
function closeup(side = 'R', from = [1, 0.3, 0.4], dist = 0.32) {
	const S = w.vm.state, model = S.model, scene = model.parent.parent;
	let skin = w.vm.armsSkin;
	scene.traverse((o) => { if (!w.vm.armsSkin && o.isSkinnedMesh && o.material !== model.getObjectByName('body').material && (!skin || o.geometry.index.count > skin.geometry.index.count)) skin = o; });
	const bone = skin.skeleton.bones[w.P.map['finger3-1.' + side]];
	at.setFromMatrixPosition(bone.matrixWorld);
	const size = new T.Vector2(); w.renderer.getSize(size);
	inspectCam.aspect = size.x / size.y; inspectCam.position.copy(at).add(new T.Vector3(...from).normalize().multiplyScalar(dist)); inspectCam.lookAt(at); inspectCam.updateProjectionMatrix(); inspectCam.updateMatrixWorld(true);
	// (sleeves and garments hidden: the close-up is of the hand on the item)
	const hidden = [];
	scene.traverse((o) => { if (o.isMesh && o !== skin && o.visible) { let p = o; while (p && p !== model) p = p.parent; if (!p) { o.visible = false; hidden.push(o); } } });
	const bg = w.scene.background; w.renderer.setClearColor(0x6b7a83, 1); w.renderer.clear(); w.renderer.render(scene, inspectCam); w.scene.background = bg;
	for (const o of hidden) o.visible = true;
	return w.renderer.domElement.toDataURL('image/png');
}
// where the joints are in the item's own space (millimetres), for tuning grips
function joints(side = 'R') {
	const S = w.vm.state, model = S.model, scene = model.parent.parent, inv = model.matrix.clone().invert();
	let skin = w.vm.armsSkin;
	scene.traverse((o) => { if (!w.vm.armsSkin && o.isSkinnedMesh && o.material !== model.getObjectByName('body').material && (!skin || o.geometry.index.count > skin.geometry.index.count)) skin = o; });
	const out = {}, v = new T.Vector3();
	for (const n of ['wrist', 'finger1-1', 'finger1-3', 'finger2-1', 'finger2-3', 'finger3-1', 'finger3-3', 'finger4-1', 'finger5-1', 'finger5-3']) {
		v.setFromMatrixPosition(skin.skeleton.bones[w.P.map[n + '.' + side]].matrixWorld).applyMatrix4(inv);
		out[n] = v.toArray().map((x) => Math.round(x * 1000));
	}
	return out;
}
// close combat: the fists holding an item at guard or mid-swing, a picture of the view and close-
// ups of the right hand (garments hidden), and the hand's skin measured against the item
function melee(item, phase = 'guard', from = [[0.6, 0.3, 0.7], [-0.5, -0.6, 0.5]], dist = 0.3) {
	const me = { P: w.P, M: w.M };
	fist.on = true; fist.block = false; fist.item = item; fist.move = null; fist.anim = null; fist.m = null; fist.mt = 0;
	for (let i = 0; i < 60; i++) fists.update(1 / 60, 1 + i / 60, fist, me);
	if (phase === 'swing' && item) { const m = MOVES[item]; fist.move = item; fist.anim = m.anim; fist.m = m; fist.mt = m.wind + m.active * 0.5; for (let i = 0; i < 40; i++) fists.update(1 / 60, 2 + i / 60, fist, me); }
	const hand = fists.root.getObjectByName('anatomical-hand-R'), grp = hand?.parent;
	const shots = {};
	w.scene.updateMatrixWorld(true); w.renderer.setClearColor(0x6b7a83, 1);
	w.renderer.render(w.scene, w.camera); shots.view = w.renderer.domElement.toDataURL('image/png');
	if (!hand) return { shots };
	const bone = hand.skeleton.bones[w.P.map['finger3-1.R']], at = new T.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(grp.matrixWorld);
	const hidden = [];
	fists.root.traverse((o) => { if (o.isMesh && o.visible && o !== hand && o.parent !== grp && !(o.parent?.parent === grp)) { o.visible = false; hidden.push(o); } });
	grp.traverse((o) => { if (o.isMesh && o.visible && o !== hand && o.name.startsWith('sleeve')) { o.visible = false; hidden.push(o); } });
	const hiddenWorld = []; w.scene.traverse((o) => { if (o.isMesh && o.visible && !fists.root.getObjectById(o.id)) { o.visible = false; hiddenWorld.push(o); } });
	from.forEach((f, k) => {
		const cam = new T.PerspectiveCamera(34, w.camera.aspect, 0.005, 5);
		cam.position.copy(at).add(new T.Vector3(...f).normalize().multiplyScalar(dist).applyQuaternion(w.camera.getWorldQuaternion(new T.Quaternion())));
		cam.lookAt(at); cam.updateMatrixWorld(true);
		w.renderer.render(w.scene, cam); shots['c' + k] = w.renderer.domElement.toDataURL('image/png');
	});
	for (const o of [...hidden, ...hiddenWorld]) o.visible = true;
	const A = fists.anatomical?.('R')?.info;
	return { shots, clearanceMm: A?.clearanceMm || null, params: A?.params ? Array.from(A.params).map((x) => +x.toFixed(2)) : null };
}
window.weaponHands = { melee, FP, HOLDS, GRIPS, holdFrame, joints, closeup, fingerContact, fists: fists_, fistView: fists };
window.WEAPON_HANDS_READY = true;
