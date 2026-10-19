import { bindLookDrag } from '../combat/look-drag.js';
// What you hold, seen through your own eyes: the item and your own forearms and hands, drawn
// after the world in a layer of their own (a narrower lens, a near plane a centimetre out, the
// depth cleared, so they never sink into a wall).
//
// The item is placed in view by a few layers of motion: the hip or the sights, a breath, the
// bob of your steps (in time with your footfalls), a lag behind your turns, a dip when you land,
// lowered while you sprint, and lowered out and raised in when you change what you hold. Your
// hands are then put on it: your own body (people/avatar.js) is posed in its carry
// (people/actions.js), each hand is read off it with the arm above it, and that arm is moved
// so the hand lands on the item's grip (crysis/held-items.js HOLDS). The arms and hands
// are drawn as one skinned mesh with the skin's own material, and your clothes' sleeves (and
// gloves, if you wear them) over them as one more (people/sleeve.js), folding as the arms move.
//
// Aiming: hold the right mouse button, or tap the sight button on a touch screen. The sight
// comes to the eye and the world's lens narrows (camera.zoom).
//
// ---------- the API, for the combat systems ----------
// Crysis.weapon (ui/gear.js `weapon`) drives whatever you hold, in first or third person:
//   fire()         -> true if it went off: the recoil (kick, rise, a side drift by the item's
//                     pattern), the muzzle flash and its light, the vent sparks, the glow's surge
//                     and the sound. False if not ready (changing, reloading, sprinting, faster
//                     than the item's rate). Ammunition, hits and damage are the caller's.
//   reload(done)   -> true if begun: the support hand takes the cell out (its own mesh) and seats
//                     a fresh one over WEAPONS[id].reload seconds, with sounds; done() at the end.
//   aim(on)        -> to the sights (the right mouse button and the touch button do the same).
//   equip(id)      -> hold an item you own (an item id or an instance uid); holster() puts it
//                     away. Either way the old one lowers out and the new one rises in.
//   muzzle()       -> { position, direction, aim: { origin, direction } } in the world: where a
//                     tracer starts as you see it, and the ray from the eye for hits.
//   data(id)       -> crysis/held-items.js WEAPONS: rate (shots a second), mag (cell count),
//                     reload (seconds), recoil { kick, rise, side[], recover }, flash ('flash' or
//                     'pulse'), sounds { fire, dry, out, in, ready, equip, holster, aim }: cue
//                     names for crysis/weapon-sound.js playCue(name, { distance }).
//   state()        -> { held, third, reloading, aiming, ready }
// Friends: createHand(...).fire(distance) and .reload(done, distance) (crysis/held-items.js)
// play the same on a friend's body (net/remotes.js holds one per friend), with the 'reload'
// action (people/actions.js) moving their support hand.
//
// Lit as the world is: the sun and the sky's light turned into the view's frame, the world's
// reflections faded with the daylight, and a soft fill so nothing goes black at night.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CELL_HOLD, CHARGE_HOLD, GRIPS, cellPath, handFrame, itemModel, kitLight, kitPulse, kitPulseNow, kitTick, reloadTilt, spinMotes, triangles, weaponOf } from './held-items.js';
import { blendPose, contactField, fingerQuats, fingerRig, itemParts, limitPose, solveHand, squeeze } from './finger-pose.js';
import { qualityNow } from '../world/governor.js';
import { createFlash, createSparks } from './weapon-fx.js';
import { playCue } from './weapon-sound.js';
import { createScopeOptics } from './scope-optics.js';
import { refineHandSurface, closeHandMaterial, handRefine } from '../people/hand-surface.js';
import { dressArms } from '../people/sleeve.js';
import { clamp } from '../noise.js';

const ARM_BONES = /^(lowerarm0[12]|wrist|finger\d-\d|metacarpal\d)\.(L|R)$/;
const ease = (x) => x * x * (3 - 2 * x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// a critically damped spring
// (z below 1 lets it overshoot a little: the weight of a held thing catching up with a turn)
class Spring { constructor(w = 12, z = 1) { this.v = 0; this.dv = 0; this.w = w; this.z = z; } to(x, dt) { const w = this.w, a = -w * w * (this.v - x) - 2 * this.z * w * this.dv; this.dv += a * dt; this.v += this.dv * dt; return this.v; } }

// where each kind of thing sits in view: position (camera space, metres), then yaw, pitch, roll
const VIEW = {
	// (wR, wL: how far each wrist is bent back and toward the little finger, in degrees, at
	// ease: the forearm is turned toward that, then toward the elbow points eR, eL, aR, aL)
	long: { p: [0.135, -0.265, -0.34], r: [0.085, 0.03, -0.06], eR: [0.3, -0.55, 0.05], eL: [-0.12, -0.5, -0.12], aR: [0.2, -0.4, 0.08], aL: [-0.14, -0.38, -0.05], wR: [12, 18], wL: [24, 8] },
	bow: { p: [-.11, -.18, -.90], r: [0, 0, .16], eR: [.38, -.32, .05], aR: [.48, -.19, -.12], eL: [-.35, -.4, .05], aL: [-.34, -.28, .08] },
	one: { p: [0.17, -0.2, -0.38], r: [-0.25, 0.0, 0.0], eR: [0.3, -0.5, -0.05] },
	shaft: { p: [0.17, -0.22, -0.38], r: [-0.15, -0.65, 0.0], eR: [0.3, -0.5, 0.0] },
	lantern: { p: [0.15, -0.1, -0.4], r: [-0.3, 0.0, 0.0], eR: [0.28, -0.45, -0.1] },
};
const GUN_VIEW = {
	'aurora-trail-rifle': { ...VIEW.long, p: [.18, -.245, -.45], r: [.20, .035, -.055] },
	'mossback-scout-rifle': { ...VIEW.long, p: [.17, -.235, -.46], r: [.18, .025, -.045] },
	'warden-spark-carbine': { ...VIEW.long, p: [.18, -.23, -.43], r: [.23, .03, -.07] },
};
const viewOf = (id, H) => H.kind === 'long' ? (GUN_VIEW[id] || VIEW.long) : H.kind === 'bow' ? VIEW.bow : /lantern/.test(id) ? VIEW.lantern : H.R?.t?.y > 0.9 ? VIEW.shaft : VIEW.one;
// the item's x (forward) to the view's -z, its y up, its z to the right
const BASE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));
// the charging stroke after a fresh cell (reload progress): reach the knob, draw it back, let go
const CHARGE = { reach: 0.8, grab: 0.86, back: 0.905, release: 0.925, travel: 0.034 };
const chargeTravel = (u) => u < CHARGE.grab ? 0 : u < CHARGE.back ? CHARGE.travel * ease((u - CHARGE.grab) / (CHARGE.back - CHARGE.grab)) : u < CHARGE.release ? CHARGE.travel : CHARGE.travel * Math.max(0, 1 - (u - CHARGE.release) / 0.012);

export function createViewmodel({ camera, avatar, mount, canvas = null, isPhone = false }) {
	const scene = new THREE.Scene();
	const cam = new THREE.PerspectiveCamera(52, 1, 0.01, 6);
	const sun = new THREE.DirectionalLight(0xffffff, 2), hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.8), fill = new THREE.DirectionalLight(0xdfe8ff, 0.4);
	fill.position.set(-0.6, 0.5, 0.8);
	// the light of a shot, dark between them
	const shotLight = new THREE.PointLight(0xffc890, 0, 2.5, 2);
	scene.add(sun, sun.target, hemi, fill, shotLight);
	const rig = new THREE.Group();
	scene.add(rig);
	let env = null, envTried = false, optics = null, opticsWorld = null;
	let bowState = { draw: 0, loaded: true, nock: 1 };

	// ---------- the item ----------
	const flash = createFlash(scene), sparks = createSparks(scene);
	const kick = { z: new Spring(10), p: new Spring(10), y: new Spring(10), r: new Spring(10) };
	const S = { shots: 0, lastShot: -9, reload: null, key: '', want: '', id: null, model: null, equip: 0, ads: 0, aimHeld: false, aimTap: false, last: null, land: new Spring(14), lagX: new Spring(9, 0.72), lagY: new Spring(9, 0.72), lagR: new Spring(8, 0.62), trig: 0, shotT: -9, clock: 0, sprint: 0, air: 0, zoom: 1, shown: false, calls: 0, item: null };
	function swapIn(item) {
		optics?.reset();
		if (S.model) { S.model.userData.bow?.dispose(); rig.remove(S.model); }
		S.model = item ? itemModel(item.i, { level: item.l, tier: item.t, lod: 'high', optics: true, view: true }) : null;
		const was = S.id;
		S.id = item?.i || null; S.key = S.want; S.item = item; S.reload = null; S.trig = 0;
		if (S.model) { S.model.matrixAutoUpdate = false; S.model.userData.bow?.set(bowState); rig.add(S.model); }
		const W = weaponOf(S.id) || weaponOf(was);
		if (W && S.id !== was) playCue(S.id ? W.sounds.equip : W.sounds.holster);
	}

	// ---------- your forearms and hands ----------
	let arms = null;
	function buildArms(me) {
		const P = me.P, src = P.skin;
		if (!src?.geometry?.index || !src.geometry.attributes.skinIndex) return null;
		const g0 = src.geometry, si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight, idx = g0.index.array;
		const names = P.bones.map((b) => b.name);
		const keep = names.map((n) => ARM_BONES.test(n));
		const top = (v) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = sw.getComponent(v, k); if (x > w) { w = x; b = si.getComponent(v, k); } } return b; };
		const tri = [];
		for (let i = 0; i < idx.length; i += 3) {
			const a = top(idx[i]), b = top(idx[i + 1]), c = top(idx[i + 2]);
			if (keep[a] && keep[b] && keep[c]) tri.push(idx[i], idx[i + 1], idx[i + 2]);
		}
		if (!tri.length) return null;
		// (the lowest quality tiers keep the body's own hand surface: a quarter of the triangles; a
		// phone refines the fingers alone)
		const R = handRefine(P, { phone: isPhone, ratio: qualityNow().ratio });
		const g = refineHandSurface(g0, tri, R.passes, R.only);
		const bones = P.bones.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; return b; });
		const skel = new THREE.Skeleton(bones, P.skeleton.boneInverses);
		const skin = new THREE.SkinnedMesh(g, closeHandMaterial(P));
		skin.bindMode = 'detached';
		skin.bind(skel, new THREE.Matrix4());
		skin.frustumCulled = false;
		// the sleeves, cuffs and gloves of what you wear, cut to your forearms (people/sleeve.js),
		// the skin they hide left out of the hands' mesh
		const garment = dressArms(P, skin, { isPhone });
		const group = new THREE.Group();
		group.add(skin);
		if (garment) group.add(garment.mesh);
		scene.add(group);
		const side = names.map((n) => (n.endsWith('.L') ? 'L' : 'R')), fore = names.map((n) => !/^(wrist|finger|metacarpal)/.test(n));
		return { me, group, skin, garment, bones, side, fore, tris: g.index.count / 3 + (garment?.tris || 0) };
	}

	// ---------- input: aim ----------
	const longHeld = () => ['long', 'bow'].includes(S.model?.userData.hold?.kind);
	addEventListener('pointerdown', (e) => { if (e.button === 2 && e.target === canvas && longHeld() && S.shown && (!canvas.requestPointerLock || document.pointerLockElement === canvas)) { S.aimHeld = true; e.preventDefault(); } });
	addEventListener('pointerup', (e) => { if (e.button === 2) S.aimHeld = false; });
	addEventListener('contextmenu', (e) => { if (e.target === canvas && longHeld() && S.shown) e.preventDefault(); });
	addEventListener('blur', () => { S.aimHeld = S.aimTap = false; });
	document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) S.aimHeld = false; });
	let aimBtn = null;
	if (mount && (isPhone || matchMedia?.('(pointer: coarse)')?.matches)) {
		aimBtn = document.createElement('button');
		aimBtn.type = 'button'; aimBtn.setAttribute('aria-label', 'Aim');
		aimBtn.title = 'Tap to toggle sights; drag to aim'; aimBtn.setAttribute('aria-pressed', 'false');
		aimBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
		aimBtn.style.cssText = 'position:absolute;right:calc(18px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 96px + env(safe-area-inset-bottom));width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,16,20,.45);color:#eafaf6;display:none;align-items:center;justify-content:center;z-index:6;flex-direction:column;gap:2px;touch-action:none;';
		for (const ev of ['pointerdown', 'touchstart']) aimBtn.addEventListener(ev, (e) => e.stopPropagation());
		bindLookDrag(aimBtn, mount, { start: () => { if (!S.shown || mount.inert) return false; S.aimTap = !S.aimTap; aimBtn.setAttribute('aria-pressed', String(S.aimTap)); aimBtn.style.background = S.aimTap ? 'rgba(60,140,120,.6)' : 'rgba(10,16,20,.45)'; } });
		mount.appendChild(aimBtn);
	}

	// ---------- each frame ----------
	const Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
	const camInv = new THREE.Quaternion(), hf = new THREE.Matrix4(), X = { L: new THREE.Matrix4(), R: new THREE.Matrix4() }, ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
	const bp = new THREE.Vector3(), bq = new THREE.Quaternion(), bp2 = new THREE.Vector3(), bq2 = new THREE.Quaternion(), bs = new THREE.Vector3();
	// a frame part way from A to B
	function blend(out, A, B, k) { A.decompose(bp, bq, bs); B.decompose(bp2, bq2, bs); return out.compose(bp.lerp(bp2, k), bq.slerp(bq2, k), ONE); }
	const targets = { L: null, R: null };
	const handAt = new THREE.Matrix4(), tmp = new THREE.Matrix4(), tmp2 = new THREE.Matrix4(), F = { L: null, R: null };
	const hipQ = new THREE.Quaternion(), rotQ = new THREE.Quaternion(), pos = new THREE.Vector3(), wantV = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), lastSeen = { yaw: 0, pitch: 0, grounded: true, vy: 0, set: false };

	// ---------- your fingers on it (crysis/finger-pose.js, held-items.js GRIPS) ----------
	// Each hand's fingers are posed apart from your body's: solved on the item's own surface when
	// it comes to hand (kept per item), blended by what you are doing, written into the bones.
	const hands = { L: null, R: null }, solved = new Map();
	let poses = null, posesFor = null;
	function fingerHands(me) {
		for (const side of ['L', 'R']) {
			const rig = fingerRig(me.P, side);
			hands[side] = rig && { rig, pose: new Float32Array(20), quats: Array.from({ length: 15 }, () => new THREE.Quaternion()), local: new THREE.Matrix4(), on: false };
		}
	}
	const box = (m, size) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3().setFromMatrixPosition(m), new THREE.Vector3(size, size, size));
	// every pose this item's hands take, solved once for this body and item (and kept)
	function solveFingers() {
		const id = S.id, plan = GRIPS[id], H = S.model?.userData.hold;
		if (!plan || !H || !hands.R || !hands.L) return null;
		const key = `${id}:${S.item?.t || 0}:${S.item?.l || 1}`;
		if (solved.has(key)) return solved.get(key);
		const t0 = performance.now(), out = { L: {}, R: {}, ms: 0 }, model = S.model;
		if (H.kind === 'long') {
			const body = itemParts(model, ['body', 'charger', 'cell']);
			const fR = contactField(body, box(H.R.m, 0.24)), fL = contactField(body, box(H.L.m, 0.26));
			const ready = solveHand(hands.R.rig, fR, H.R.m, plan.R.ready);
			out.R.ready = ready; out.R.trigger = solveHand(hands.R.rig, fR, ready.frame, plan.R.trigger, { fit: false }); out.R.frame = ready.frame;
			out.L.fore = solveHand(hands.L.rig, fL, H.L.m, plan.L.fore); out.L.frame = out.L.fore.frame;
			const cell = model.getObjectByName('cell');
			if (cell) out.L.cell = solveHand(hands.L.rig, contactField([[cell, new THREE.Matrix4()]], box(CELL_HOLD, 0.2)), CELL_HOLD, plan.L.cell);
			const knob = model.getObjectByName('charger');
			if (knob) {
				// the knob's frame in item space, and the hand's frame back in the knob's
				const home = new THREE.Matrix4().makeTranslation(...knob.userData.home), at = home.clone().multiply(CHARGE_HOLD);
				const specs = plan.L.charge.map((sp) => sp.target ? { ...sp, target: sp.target.clone().applyMatrix4(home) } : sp);
				const c = solveHand(hands.L.rig, contactField(body, box(at, 0.2)), at, specs);
				c.frame.premultiply(home.invert()); out.L.charge = c;
			}
			out.L.open = solveHand(hands.L.rig, null, H.L.m, plan.L.open, { fit: false });
		} else if (H.kind === 'bow') {
			const body = itemParts(model, ['body']);
			out.L.riser = solveHand(hands.L.rig, contactField(body, box(H.L.m, 0.24)), H.L.m, plan.L.riser, { firm: true }); out.L.frame = out.L.riser.frame;
			// the draw hand on the string as main had it (the fingers closed round it the way the
			// body's own curl closed them), its thumb now flexed toward the palm, never back
			out.R.draw = solveHand(hands.R.rig, null, new THREE.Matrix4(), plan.R.draw, { fit: false });
		}
		out.ms = +(performance.now() - t0).toFixed(1);
		solved.set(key, out);
		return out;
	}
	// the support hand through a reload (u, its progress over WEAPONS[id].reload, into out, which
	// holds the hand on the guard): off the guard to the cell (.08 to .2), on it as it comes out
	// (the out cue at .22) and away to a pouch out of view while it is gone (.42 to .62), up with
	// a fresh one, seated with a push of the palm (the in cue at .8), up to the charging knob,
	// drawn back and let go (the ready cue), and back onto the guard by the end
	const pouch = new THREE.Vector3(-0.03, -0.44, -0.13), gone0 = new THREE.Vector3(), gone1 = new THREE.Vector3(), cellAt = new THREE.Vector3(), fore0 = new THREE.Matrix4();
	function supportPath(u, out, cell, knob) {
		fore0.copy(out);
		const C = poses.L.cell?.frame || CELL_HOLD;
		if (cell && u > 0.08 && u < CHARGE.grab) {
			if (cell.visible) { cell.updateMatrix(); tmp.multiplyMatrices(S.model.matrix, cell.matrix).multiply(C); }
			else {
				// out of view: down past the hip to a pouch and back with the fresh one
				const home = cell.userData.home, k = (u - 0.42) / 0.2;
				cellPath(0.4199, gone0); cellPath(0.6201, gone1);
				if (k < 0.5) cellAt.copy(gone0).lerp(pouch, ease(k * 2)); else cellAt.copy(pouch).lerp(gone1, ease(k * 2 - 1));
				tmp.multiplyMatrices(S.model.matrix, tmp2.makeTranslation(home[0] + cellAt.x, home[1] + cellAt.y, home[2] + cellAt.z)).multiply(C);
			}
			// the seat: the palm pushes up into the well as the cell clicks home
			const seat = u > 0.77 && u < 0.83 ? Math.sin(Math.PI * (u - 0.77) / 0.06) : 0;
			if (seat) tmp.multiply(tmp2.makeTranslation(0, 0, 0.007 * seat));
			blend(out, fore0, tmp, ease(clamp((u - 0.08) / 0.12, 0, 1)));
		}
		if (u >= CHARGE.reach) {
			const C2 = poses.L.charge?.frame;
			if (knob && C2) {
				knob.updateMatrix(); tmp.multiplyMatrices(S.model.matrix, knob.matrix).multiply(C2);
				if (u < CHARGE.grab) blend(out, out, tmp, ease((u - CHARGE.reach) / (CHARGE.grab - CHARGE.reach)));
				else if (u < 0.93) out.copy(tmp);
				else blend(out, tmp, fore0, ease((u - 0.93) / 0.07));
			} else blend(out, out, fore0, ease((u - CHARGE.reach) / 0.14));
		}
		return out;
	}
	// the fingers now: each hand's pose for what you are doing, eased toward it, with the small
	// things on top (the trigger's break, the hand easing and closing again after a shot, the
	// squeeze as it kicks), then written into the finger bones below the wrist
	const want = { L: new Float32Array(20), R: new Float32Array(20) };
	function phase(out, list, u) {
		// list: [u, pose, u, pose ...]: eased from each pose to the next between their marks
		if (u <= list[0]) return out.set(list[1]);
		for (let i = 0; i < list.length - 2; i += 2) if (u < list[i + 2]) return blendPose(out, list[i + 1], list[i + 3], ease((u - list[i]) / (list[i + 2] - list[i])));
		return out.set(list[list.length - 1]);
	}
	// the support hand's fingers through a reload: [progress, pose ...] (made once per item)
	const reloadSeq = (L) => L.seq ||= [0.06, L.fore.params, 0.14, L.open.params, 0.2, L.cell.params, 0.77, L.cell.params, 0.81, blendPose(new Float32Array(20), L.cell.params, L.open.params, 0.55), CHARGE.grab, (L.charge || L.fore).params, 0.93, (L.charge || L.fore).params, 0.965, L.open.params, 1, L.fore.params];
	function fingersNow(dt, time, H, u, gather, sp) {
		const R = poses.R, L = poses.L, since = time - S.shotT;
		if (H.kind === 'long') {
			// the index on the trigger at the sights or just after a shot; straight along the frame
			// otherwise (carried, sprinting, reloading, changing)
			const on = (S.ads > 0.6 || since < 0.55) && !S.reload && S.sprint < 0.3 && S.equip > 0.95 && gather < 0.05 ? 1 : 0;
			S.trig += (on - S.trig) * Math.min(1, dt * (on ? 16 : 7));
			blendPose(want.R, R.ready.params, R.trigger.params, ease(S.trig));
			// the break: the finger draws through the trigger and lets it out
			if (since < 0.1) { const k = Math.sin(Math.PI * since / 0.1); want.R[5] += 0.05 * k; want.R[6] += 0.16 * k; want.R[7] += 0.06 * k; }
			// the kick tightens the hand, then a beat later it eases and closes again on the grip
			squeeze(want.R, 0.045 * Math.exp(-Math.max(0, since) * 14), 2, 4);
			if (since > 0.12 && since < 0.46) { const k = Math.sin(Math.PI * (since - 0.12) / 0.34); squeeze(want.R, -0.07 * k, 2, 4); want.R[1] -= 0.05 * k; want.R[2] -= 0.06 * k; }
			if (S.reload && L.cell) {
				phase(want.L, reloadSeq(L), u);
				// the pull: the pinch tightens as it draws the knob back
				if (u > CHARGE.grab && u < CHARGE.release) squeeze(want.L, 0.06, 1, 2);
			} else want.L.set(L.fore.params);
		} else if (H.kind === 'bow') {
			want.L.set(L.riser.params); want.R.set(R.draw.params);
		}
		// a breath of tension through the hands, and the gather's open hand
		const breathe = Math.sin(time * 1.35) * 0.012;
		squeeze(want.R, breathe, 2, 4); squeeze(want.L, breathe * 0.7, 1, 4);
		if (gather > 0) blendPose(want.L, want.L, L.open?.params || want.L, gather);
		// (whatever the layers add, no joint goes past its range)
		limitPose(want.R); limitPose(want.L);
		void sp;
		for (const side of ['L', 'R']) {
			const h = hands[side];
			if (!h || !X[side]) continue;
			// (fingers are quick)
			const k = Math.min(1, dt * 22);
			if (!h.on) { h.pose.set(want[side]); h.on = true; }
			else for (let i = 0; i < 20; i++) h.pose[i] += (want[side][i] - h.pose[i]) * k;
			fingerQuats(h.rig, h.pose, h.quats);
			for (let f = 0; f < 5; f++) for (let j = 0; j < 3; j++) {
				const J = h.rig.chains[f][j];
				arms.bones[J.i].matrixWorld.multiplyMatrices(arms.bones[J.parent].matrixWorld, h.local.compose(J.off, h.quats[f * 3 + j], ONE));
			}
		}
	}
	// held: { i, l, t } or null; P: the player's state; on: first person and free to hold things
	function update(dt, held, P, on, W, time) {
		S.pickup = Math.max(0, (S.pickup || 0) - dt);
		const want = held && on ? `${held.i}:${held.l}:${held.t}` : '';
		S.want = want; S.opticsTime = time;
		// changing what you hold: the old one lowered out, the new one raised in
		if (S.key !== want) {
			S.equip = Math.max(0, S.equip - dt / 0.22);
			if (S.equip === 0 || !S.model) swapIn(want ? held : null);
		} else if (S.model) S.equip = Math.min(1, S.equip + dt / 0.38);
		S.shown = !!S.model && on;
		if (aimBtn) { const d = S.shown && longHeld() ? 'flex' : 'none'; if (aimBtn.style.display !== d) aimBtn.style.display = d; if (d === 'none') S.aimTap = false; aimBtn.setAttribute('aria-pressed', String(S.aimTap)); aimBtn.style.background = S.aimTap ? 'rgba(60,140,120,.6)' : 'rgba(10,16,20,.45)'; }
		if (!S.shown) { optics?.reset(); setZoom(1); S.ads = 0; return; }
		// (another hero chosen, or built again in new gear: gloves, sleeves of mail; your arms made
		// again from them, people/avatar.js setHero and dress)
		if (arms && avatar?.me && arms.me !== avatar.me) { arms.group.removeFromParent(); arms.skin.geometry.dispose(); arms.skin.material.dispose(); arms.garment?.dispose?.(); arms = null; }
		if (!arms && avatar?.me) arms = buildArms(avatar.me);
		else if (!arms && avatar && !S.asked) { S.asked = true; avatar.ready?.(); }
		const H = S.model.userData.hold, id = S.id;
		S.model.userData.bow?.step(dt);

		// the motion of you: how fast, turning, in the air, sprinting
		const speed = Math.hypot(P.vel.x, P.vel.z), G = P.gait || { phase: 0, count: 0 };
		const sprint = P.run && speed > 4.2 && P.grounded;
		S.sprint += ((sprint ? 1 : 0) - S.sprint) * Math.min(1, dt * 7);
		const aim = (S.aimHeld || S.aimTap) && ['long', 'bow'].includes(H.kind) && !S.reload && !S.pickup && S.sprint < 0.3 && S.equip > 0.9;
		S.ads += ((aim ? 1 : 0) - S.ads) * Math.min(1, dt * 9);
		const a = ease(clamp(S.ads, 0, 1)), still = 1 - a * 0.88;
		if (!lastSeen.set) { lastSeen.yaw = P.yaw; lastSeen.pitch = P.pitch; lastSeen.grounded = P.grounded; lastSeen.vy = 0; lastSeen.set = true; }
		const L = lastSeen;
		const dyaw = wrap(P.yaw - L.yaw), dpitch = P.pitch - L.pitch;
		const lx = S.lagX.to(clamp(dyaw / Math.max(dt, 1e-3) * 0.01, -0.05, 0.05), dt), ly = S.lagY.to(clamp(-dpitch / Math.max(dt, 1e-3) * 0.008, -0.04, 0.04), dt), lr = S.lagR.to(clamp(dyaw / Math.max(dt, 1e-3) * 0.03, -0.12, 0.12), dt);
		// landing: a dip that springs back; in the air the arms rise a touch
		if (P.grounded && !L.grounded) S.land.dv -= clamp(-L.vy * 0.05, 0.1, 0.6);
		S.air += ((P.grounded || P.swimming ? 0 : 1) - S.air) * Math.min(1, dt * 5);
		const land = S.land.to(0, dt);
		L.yaw = P.yaw; L.pitch = P.pitch; L.grounded = P.grounded; L.vy = P.vel.y; S.clock = time;
		// the steps: a figure of eight, a step each footfall
		const step = (G.count + G.phase) * Math.PI, bobK = clamp(speed / 4, 0, 1.6) * (P.grounded ? 1 : 0.2);
		const bx = Math.sin(step) * 0.007 * bobK, by = -Math.abs(Math.cos(step)) * 0.006 * bobK + 0.003 * bobK;
		const breath = Math.sin(time * 1.35) * 0.0016;

		// the hip and the sights
		const vw = viewOf(id, H);
		cam.aspect = camera.aspect;
		// (narrow screens: a wider lens so it stays in view)
		cam.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) / Math.max(0.3, cam.aspect))), 50, 78) * (1 - a * 0.12);
		const halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect;
		const px = Math.min(Math.abs(vw.p[0]), Math.abs(vw.p[2]) * halfW * 0.62) * Math.sign(vw.p[0]);
		const hip = V.set(px, vw.p[1], vw.p[2]);
		Q.copy(BASE);
		Q2.setFromEuler(E.set(vw.r[1], vw.r[0], vw.r[2], 'YXZ'));
		hipQ.multiplyQuaternions(Q2, Q);
		pos.copy(hip);
		let rot = rotQ.copy(hipQ);
		if (H.sight && a > 0) {
			const [sx, sy, relief] = H.sight;
			const adsPos = V2.set(0, -sy, -relief + sx);
			pos.lerp(adsPos, a);
			rot.slerp(BASE, a);
		}
		if (H.kind === 'bow' && a > 0) { pos.lerp(V2.set(.10, -.14, -.90), a); rot.slerp(BASE, a); }
		// sprinting: lowered and turned across; changing, or climbing (parkour.js): lowered out of view
		const sp = ease(S.sprint) * (1 - a), eq = Math.max(1 - ease(S.equip), ease(clamp(P.climbK || 0, 0, 1)));
		pos.x += -0.04 * sp + bx * still + lx * still; pos.y += -0.05 * sp - 0.28 * eq + (by + breath) * still + land * 0.6 + ly * still + S.air * 0.012;
		pos.z += 0.03 * sp;
		// A short gather gesture lowers the held item and frees the support hand.
		const gather = Math.sin(Math.PI * Math.min(1, (S.pickup || 0) / .48));
		pos.y -= .04 * gather; pos.z += .04 * gather;
		// used: the recoil's kick back, rise and drift, each settling on its spring
		const kz = kick.z.to(0, dt), kp = kick.p.to(0, dt), ky = kick.y.to(0, dt), kr = kick.r.to(0, dt);
		// reloading: tipped toward the support hand while the cell comes out and goes back in
		const ru = S.reload ? Math.min(1, S.reload.t / S.reload.T) : 0, tilt = S.reload ? ease(clamp(reloadTilt(ru), 0, 1)) : 0;
		pos.z += kz; pos.y += -0.02 * tilt + kp * 0.08; pos.x += -0.03 * tilt;
		// its weight: a slow wander of the muzzle, a long rifle's most, held far tighter at the sights
		const heavy = (H.kind === 'long' ? 1 : 0.7) * (1 - a * 0.7) * (1 - sp * 0.5);
		const swX = (Math.sin(time * 0.57) + 0.45 * Math.sin(time * 1.31 + 1.3)) * 0.0024 * heavy, swY = (Math.sin(time * 0.79 + 0.7) + 0.35 * Math.sin(time * 1.83)) * 0.0018 * heavy;
		Q2.setFromEuler(E.set(-0.35 * sp - 0.9 * eq + breath * 2 + land * 1.5 + ly * 1.2 + kp + 0.22 * tilt + swY, 0.55 * sp + lx * 2.2 + ky + swX, 0.35 * sp + lr * still + bx * 1.5 + kr - 0.55 * tilt + swX * 0.6, 'YXZ'));
		rot = Q2.multiply(rot);
		S.model.matrix.compose(pos, rot, ONE);
		const cell = S.model.getObjectByName('cell'), knob = S.model.getObjectByName('charger');
		if (knob) { const home = knob.userData.home; knob.position.set(home[0] - chargeTravel(ru) * (S.reload ? 1 : 0), home[1], home[2]); }
		if (S.reload) {
			const R2 = S.reload;
			R2.t += dt;
			const at = cellPath(ru, V2);
			if (cell) { cell.visible = !!at; if (at) cell.position.fromArray(cell.userData.home ||= cell.position.toArray()).add(at); }
			const Wr = weaponOf(id);
			if (!R2.out && ru > 0.22) { R2.out = true; playCue(Wr.sounds.out); }
			if (!R2.in && ru > 0.8) { R2.in = true; playCue(Wr.sounds.in); }
			// (with a charging knob, ready sounds as it is let go)
			if (!R2.ready && (ru >= 1 || (knob && ru > CHARGE.release))) { R2.ready = true; playCue(Wr.sounds.ready); }
			if (ru >= 1) { S.reload = null; R2.done?.(); }
		}
		// the flash, its light, the vent sparks, the glow's surge, all fading
		flash.update(dt); sparks.update(dt);
		shotLight.intensity *= Math.exp(-dt * 30);
		if (kitPulseNow() > 0) kitPulse(kitPulseNow() - dt * 6);
		S.model.matrixWorldNeedsUpdate = true;
		spinMotes(S.model, time); kitTick(time);
		setZoom(1 + ((H.zoom || (H.kind === 'bow' ? 1.18 : 1)) - 1) * a);

		// your hands on it
		if (arms) {
			const me = arms.me;
			const Mo = me.M, name = Mo.S.act.name;
			const carry = H.kind === 'long';
			if (carry && (!name || name === 'carry')) { if (name !== 'carry') Mo.act('carry', 0); }
			else if (!carry && name === 'carry') Mo.act(null);
			Mo.grip('R', H.R ? (H.kind === 'bow' ? .68 : 1) : 0); Mo.grip('L', H.L ? 1 - gather * .65 : 0);
			if (!me.P.root.visible) Mo.update(dt, time, null);
			me.P.root.updateMatrixWorld(true);
			if (!hands.R && !hands.L) fingerHands(me);
			if (posesFor !== S.model) { posesFor = S.model; poses = solveFingers(); }
			for (const side of ['L', 'R']) {
				const G2 = H[side];
				if (!G2 || !handFrame(me.P, side, hf)) { X[side] = null; continue; }
				handAt.multiplyMatrices(S.model.matrix, side === 'R' && H.kind === 'bow' ? S.model.userData.bow.right : poses?.[side]?.frame || G2.m);
				if (side === 'L' && gather > 0) { handAt.elements[12] += .04 * gather; handAt.elements[13] += .18 * gather; handAt.elements[14] -= .22 * gather; }
				if (side === 'L' && S.reload && H.kind === 'long') supportPath(ru, handAt, cell, knob);
				(targets[side] ||= new THREE.Matrix4()).copy(handAt);
				(X[side] ||= new THREE.Matrix4()).multiplyMatrices(handAt, tmp.copy(hf).invert());
				// the forearm swung about the wrist to run back toward where the elbow would be
				const e = vw['e' + side], ae = vw['a' + side] || e;
				const wr = V.setFromMatrixPosition(me.P.bones[me.P.map['wrist.' + side]].matrixWorld).applyMatrix4(X[side]);
				const el = V2.setFromMatrixPosition(me.P.bones[me.P.map['lowerarm01.' + side]].matrixWorld).applyMatrix4(X[side]);
				const now = el.sub(wr).normalize(), want = wantV.set(e[0] + (ae[0] - e[0]) * a, e[1] + (ae[1] - e[1]) * a, e[2] + (ae[2] - e[2]) * a).sub(wr).normalize();
				// an easy wrist: the forearm runs back from the hand's own axis, bent a little, and
				// the elbow point only steers it (so a hand on a cell or a knob keeps its wrist)
				const ws = vw['w' + side];
				if (ws) {
					const ax = V3.setFromMatrixColumn(handAt, 0), ease_ = Math.tan(THREE.MathUtils.degToRad(ws[0])), dev = Math.tan(THREE.MathUtils.degToRad(ws[1]));
					ax.addScaledVector(V4.setFromMatrixColumn(handAt, 2), ease_).addScaledVector(V4.setFromMatrixColumn(handAt, 1), dev).normalize().negate();
					want.lerp(ax, 0.72).normalize();
				}
				Q.setFromUnitVectors(now, want);
				(F[side] ||= new THREE.Matrix4()).makeTranslation(wr.x, wr.y, wr.z).multiply(tmp.makeRotationFromQuaternion(Q)).multiply(tmp2.makeTranslation(-wr.x, -wr.y, -wr.z)).multiply(X[side]);
			}
			for (let i = 0; i < arms.bones.length; i++) {
				const sd = arms.side[i], x = arms.fore[i] ? F[sd] : X[sd];
				arms.bones[i].matrixWorld.copy(X[sd] ? tmp.multiplyMatrices(x, me.P.bones[i].matrixWorld) : ZERO);
			}
			if (poses) fingersNow(dt, time, H, ru, gather, sp);
			// the folds follow the arms (down: the world's, in the view's frame)
			arms.garment?.pose(dt, a, null, V.set(0, -1, 0).applyQuaternion(Q.copy(camera.quaternion).invert()));
			arms.group.visible = true;
		}
		lightUp(W);
	}
	function setZoom(z) {
		if (Math.abs(z - S.zoom) < 1e-4) return;
		S.zoom = z; camera.zoom = z; camera.updateProjectionMatrix();
	}
	// the world's light, turned into the view's frame
	function lightUp(W) {
		camInv.copy(camera.quaternion).invert();
		const ws = W?.sky?.sun, wh = W?.sky?.hemi;
		let day = 0.5;
		if (ws) {
			sun.color.copy(ws.color); sun.intensity = ws.visible === false ? 0 : ws.intensity;
			sun.position.copy(ws.position).sub(ws.target.position).normalize().applyQuaternion(camInv);
			if (W.houses?.inside?.(camera.position) || W.interiors?.inside?.(camera.position)) sun.intensity *= 0.2;
		}
		if (wh) { hemi.color.copy(wh.color); hemi.groundColor.copy(wh.groundColor); hemi.intensity = wh.intensity; hemi.position.set(0, 1, 0).applyQuaternion(camInv); }
		day = clamp((sun.intensity * 0.3 + hemi.intensity * 0.6) / 1.6, 0, 1);
		fill.intensity = 0.25 + (1 - day) * 0.55;
		kitLight(env, 0.12 + day * 0.75);
	}
	// drawn over the frame: the depth cleared, the item and hands in their own lens
	function render(renderer, worldScene = null) {
		if (!S.shown || !S.model) return;
		if (!env && !envTried) {
			envTried = true;
			try { const pm = new THREE.PMREMGenerator(renderer); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch { env = null; }
		}
		if (worldScene && opticsWorld !== worldScene) {
			optics?.dispose(); opticsWorld = worldScene;
			optics = createScopeOptics({ renderer, scene: worldScene, camera, phone: isPhone });
		}
		optics?.update({ item: S.model, aiming: S.ads, active: S.shown, time: S.opticsTime });
		cam.updateProjectionMatrix();
		const auto = renderer.autoClear;
		renderer.autoClear = false;
		renderer.clearDepth();
		renderer.render(scene, cam);
		renderer.autoClear = auto;
		// (the renderer counts each render on its own)
		S.calls = renderer.info.render.calls;
	}
	// numbers for checks: where the muzzle points, where each palm is against its grip
	function info() {
		if (!S.model) return { held: null };
		const H = S.model.userData.hold, m = S.model.matrix;
		const fwd = new THREE.Vector3(1, 0, 0).transformDirection(m), up = new THREE.Vector3(0, 1, 0).transformDirection(m);
		const out = { held: S.id, variant: S.model.userData.variant, ads: +S.ads.toFixed(2), equip: +S.equip.toFixed(2), zoom: +S.zoom.toFixed(2), fov: +cam.fov.toFixed(1), muzzleDotForward: +fwd.dot(new THREE.Vector3(0, 0, -1)).toFixed(3), upDotUp: +up.dot(new THREE.Vector3(0, 1, 0)).toFixed(3), sight: H.sight ? new THREE.Vector3(H.sight[0], H.sight[1], 0).applyMatrix4(m).toArray().map((x) => +x.toFixed(3)) : null, grip: new THREE.Vector3().setFromMatrixPosition(m).toArray().map((x) => +x.toFixed(3)), tris: triangles(S.model), armTris: arms?.tris || 0, calls: S.calls, arms: !!arms };
		if (arms) for (const side of ['L', 'R']) {
			const G = H[side];
			if (!G || !handFrame(arms.me.P, side, hf, (i) => arms.bones[i].matrixWorld)) continue;
			const want = new THREE.Matrix4().multiplyMatrices(m, side === 'R' && H.kind === 'bow' ? S.model.userData.bow.right : G.m);
			const p = new THREE.Vector3().setFromMatrixPosition(hf), q = new THREE.Vector3().setFromMatrixPosition(want);
			out['palm' + side + 'mm'] = +(p.distanceTo(q) * 1000).toFixed(1);
			if (targets[side]) out['contact' + side + 'mm'] = +(p.distanceTo(q.setFromMatrixPosition(targets[side])) * 1000).toFixed(1);
		}
		if (arms) for (const side of ['L', 'R']) {
			// the wrist: how far the hand is bent back (+) or forward from the forearm, and toward
			// the thumb (+) or the little finger, in degrees
			if (!X[side] || !handFrame(arms.me.P, side, hf, (i) => arms.bones[i].matrixWorld)) continue;
			const P2 = arms.me.P, w = new THREE.Vector3().setFromMatrixPosition(arms.bones[P2.map['wrist.' + side]].matrixWorld), e = new THREE.Vector3().setFromMatrixPosition(arms.bones[P2.map['lowerarm01.' + side]].matrixWorld);
			const f = w.sub(e).normalize(), fa = f.dot(new THREE.Vector3().setFromMatrixColumn(hf, 0)), ft = f.dot(new THREE.Vector3().setFromMatrixColumn(hf, 1)), fn = f.dot(new THREE.Vector3().setFromMatrixColumn(hf, 2));
			out['wrist' + side] = { backDeg: Math.round(THREE.MathUtils.radToDeg(Math.atan2(fn, fa))), thumbDeg: Math.round(THREE.MathUtils.radToDeg(Math.atan2(-ft, fa))) };
		}
		if (poses) {
			out.fingerSolveMs = poses.ms;
			for (const side of ['L', 'R']) { const p = poses[side], first = p && (p.ready || p.fore || p.riser || p.hook); if (first) { out['fingers' + side + 'mm'] = first.clearanceMm; out['palmShift' + side + 'mm'] = +(first.shift * 1000).toFixed(1); } }
			if (poses.R.trigger) out.triggerFingerMm = poses.R.trigger.clearanceMm[1];
			out.reachMissMm = Object.fromEntries(Object.entries({ ...poses.R, ...Object.fromEntries(Object.entries(poses.L).map(([k, v]) => ['L' + k, v])) }).filter(([, v]) => v?.missMm).map(([k, v]) => [k, v.missMm]));
		}
		if (S.model.userData.bow) out.bow = S.model.userData.bow.info();
		out.optics = optics?.diagnostics() || null;
		return out;
	}
	// ---------- use ----------
	const punch = (sp, peak) => { sp.dv += peak * sp.w * Math.E; };
	function fire() {
		const W = weaponOf(S.id), now = performance.now() / 1000;
		if (!S.shown || !W || S.equip < 0.95 || S.reload || S.pickup > 0 || S.sprint > 0.5 || now - S.lastShot < 0.95 / W.rate) return false;
		S.lastShot = now; S.shots++; S.shotT = S.clock;
		S.model.userData.bow?.fire();
		const r = W.recoil, side = r.side[S.shots % r.side.length], hold = 1 - S.ads * 0.45;
		for (const k of Object.values(kick)) k.w = r.recover;
		punch(kick.z, r.kick * hold); punch(kick.p, r.rise * hold); punch(kick.y, side * 2); punch(kick.r, side * 3);
		const m = S.model.matrix, mz = V.set(W.muzzle[0], W.muzzle[1], 0).applyMatrix4(m);
		if (W.flash) {
			flash.sprite.position.copy(mz).add(V2.set(0, 0, -0.03));
			flash.fire(W.flash, W.tint, W.size * (1 - S.ads * 0.4));
			shotLight.color.set(W.tint); shotLight.position.copy(mz); shotLight.intensity = W.flash === 'pulse' ? 1.6 : 3;
			kitPulse(W.flash === 'pulse' ? 1 : 0.5);
		}
		if (W.vent) sparks.emit(V.set(...W.vent).applyMatrix4(m), V2.set(0.6, 0.5, 0.25), W.flash === 'pulse' ? 5 : 8, W.flash === 'pulse' ? W.tint : 0xffc070);
		playCue(W.sounds.fire);
		return true;
	}
	function reload(done = null) {
		const W = weaponOf(S.id);
		if (!S.shown || !W || S.reload || S.pickup > 0 || S.equip < 0.95) return false;
		S.reload = { t: 0, T: W.reload, done };
		S.aimTap = false;
		return true;
	}
	// where a shot leaves from and goes, in the world: the muzzle as you see it on screen (at its
	// depth through the world's lens), heading for what the centre of the view is on
	function muzzle(range = 60) {
		const W = weaponOf(S.id);
		if (!S.model || !W) return null;
		const p = (S.model.userData.bow?.tip.clone() || new THREE.Vector3(W.muzzle[0], W.muzzle[1], 0)).applyMatrix4(S.model.matrix), d = p.length();
		const ndc = p.clone().project(cam);
		const position = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(d).add(camera.position);
		const aim = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
		const direction = aim.clone().multiplyScalar(range).add(camera.position).sub(position).normalize();
		return { position, direction, aim: { origin: camera.position.clone(), direction: aim } };
	}
	function bow(next) { bowState = { ...bowState, ...next }; S.model?.userData.bow?.set(bowState); }
	function cancel() {
		S.reload = null; bowState.draw = 0; S.model?.userData.bow?.cancel();
		const cell = S.model?.getObjectByName('cell');
		if (cell) { cell.visible = true; if (cell.userData.home) cell.position.fromArray(cell.userData.home); }
	}
	const aimOverride = (on) => { if (!!on !== S.aimTap && weaponOf(S.id)) playCue(weaponOf(S.id).sounds.aim); S.aimTap = !!on; };
	// (for tuning tools: solve the fingers again after a grip changes)
	const refingers = () => { solved.clear(); posesFor = null; };
	return { update, render, info, fire, reload, cancel, bow, muzzle, refingers, get armsSkin() { return arms?.skin || null; }, pickup: () => { cancel(); S.pickup = .48; S.aimTap = false; }, aim: aimOverride, state: S, get shown() { return S.shown; }, get reloading() { return !!S.reload; }, get aiming() { return S.ads > 0.5; } };
}
