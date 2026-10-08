// What you hold, seen through your own eyes: the item and your own forearms and hands, drawn
// after the world in a layer of their own (a narrower lens, a near plane a centimetre out, the
// depth cleared, so they never sink into a wall).
//
// The item is placed in view by a few layers of motion: the hip or the sights, a breath, the
// bob of your steps (in time with your footfalls), a lag behind your turns, a dip when you land,
// lowered while you sprint, and lowered out and raised in when you change what you hold. Your
// hands are then put on it: your own body (people/avatar.js) is posed in its carry
// (people/actions.js), each hand is read off it with the arm above it, and that arm is moved
// so the hand lands on the item's grip (crysis/held-items.js HOLDS). Only the forearms and hands
// are drawn, as one skinned mesh with the skin's own material, and a sleeve over each forearm.
//
// Aiming: hold the right mouse button, or tap the sight button on a touch screen. The sight
// comes to the eye and the world's lens narrows (camera.zoom).
//
// Lit as the world is: the sun and the sky's light turned into the view's frame, the world's
// reflections faded with the daylight, and a soft fill so nothing goes black at night.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { handFrame, itemModel, kitLight, kitMaterial, kitTick, spinMotes, triangles } from './held-items.js';

const ARM_BONES = /^(lowerarm0[12]|wrist|finger\d-\d|metacarpal\d)\.(L|R)$/;
const SLEEVE_BONES = /^lowerarm0[12]\.(L|R)$/;
const ease = (x) => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// a critically damped spring
class Spring { constructor(w = 12) { this.v = 0; this.dv = 0; this.w = w; } to(x, dt) { const w = this.w, a = -w * w * (this.v - x) - 2 * w * this.dv; this.dv += a * dt; this.v += this.dv * dt; return this.v; } }

// where each kind of thing sits in view: position (camera space, metres), then yaw, pitch, roll
const VIEW = {
	long: { p: [0.135, -0.265, -0.34], r: [0.085, 0.03, -0.06], eR: [0.3, -0.55, 0.05], eL: [-0.12, -0.5, -0.12], aR: [0.2, -0.4, 0.08], aL: [-0.14, -0.38, -0.05] },
	bow: { p: [-0.14, -0.1, -0.45], r: [0.0, 0.0, 0.32], eL: [-0.35, -0.4, -0.05] },
	one: { p: [0.17, -0.2, -0.38], r: [-0.25, 0.0, 0.0], eR: [0.3, -0.5, -0.05] },
	shaft: { p: [0.17, -0.22, -0.38], r: [-0.15, -0.65, 0.0], eR: [0.3, -0.5, 0.0] },
	lantern: { p: [0.15, -0.1, -0.4], r: [-0.3, 0.0, 0.0], eR: [0.28, -0.45, -0.1] },
};
const viewOf = (id, H) => H.kind === 'long' ? VIEW.long : H.kind === 'bow' ? VIEW.bow : /lantern/.test(id) ? VIEW.lantern : H.R?.t?.y > 0.9 ? VIEW.shaft : VIEW.one;
// the item's x (forward) to the view's -z, its y up, its z to the right
const BASE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));

export function createViewmodel({ camera, avatar, mount, canvas = null, isPhone = false }) {
	const scene = new THREE.Scene();
	const cam = new THREE.PerspectiveCamera(52, 1, 0.01, 6);
	const sun = new THREE.DirectionalLight(0xffffff, 2), hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.8), fill = new THREE.DirectionalLight(0xdfe8ff, 0.4);
	fill.position.set(-0.6, 0.5, 0.8);
	scene.add(sun, sun.target, hemi, fill);
	const rig = new THREE.Group();
	scene.add(rig);
	let env = null, envTried = false;

	// ---------- the item ----------
	const S = { key: '', want: '', id: null, model: null, equip: 0, ads: 0, aimHeld: false, aimTap: false, last: null, land: new Spring(14), lagX: new Spring(9), lagY: new Spring(9), lagR: new Spring(9), sprint: 0, air: 0, zoom: 1, shown: false, calls: 0, item: null };
	function swapIn(item) {
		if (S.model) rig.remove(S.model);
		S.model = item ? itemModel(item.i, { level: item.l, tier: item.t, lod: isPhone ? 'low' : 'high' }) : null;
		S.id = item?.i || null; S.key = S.want; S.item = item;
		if (S.model) { S.model.matrixAutoUpdate = false; rig.add(S.model); }
	}

	// ---------- your forearms and hands ----------
	let arms = null;
	function buildArms(me) {
		const P = me.P, src = P.skin;
		if (!src?.geometry?.index || !src.geometry.attributes.skinIndex) return null;
		const g0 = src.geometry, si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight, idx = g0.index.array;
		const names = P.bones.map((b) => b.name);
		const keep = names.map((n) => ARM_BONES.test(n)), sleeveBone = names.map((n) => SLEEVE_BONES.test(n));
		const top = (v) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = sw.getComponent(v, k); if (x > w) { w = x; b = si.getComponent(v, k); } } return b; };
		const tri = [], sl = [];
		for (let i = 0; i < idx.length; i += 3) {
			const a = top(idx[i]), b = top(idx[i + 1]), c = top(idx[i + 2]);
			if (keep[a] && keep[b] && keep[c]) tri.push(idx[i], idx[i + 1], idx[i + 2]);
			if (sleeveBone[a] && sleeveBone[b] && sleeveBone[c]) sl.push(idx[i], idx[i + 1], idx[i + 2]);
		}
		if (!tri.length) return null;
		const g = new THREE.BufferGeometry();
		for (const [k, v] of Object.entries(g0.attributes)) g.setAttribute(k, v);
		g.setIndex(tri);
		const bones = P.bones.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; return b; });
		const skel = new THREE.Skeleton(bones, P.skeleton.boneInverses);
		const skin = new THREE.SkinnedMesh(g, P.skinMat);
		skin.bindMode = 'detached';
		skin.bind(skel, new THREE.Matrix4());
		skin.frustumCulled = false;
		// the sleeve: the forearm's skin pushed out a few millimetres, cut short of the wrist,
		// in the kit's woven cloth
		let sleeve = null;
		if (sl.length) {
			const pos = g0.attributes.position, nor = g0.attributes.normal, used = [...new Set(sl)], map = new Map();
			const wristOf = { L: P.map['wrist.L'], R: P.map['wrist.R'] }, elbowOf = { L: P.map['lowerarm01.L'], R: P.map['lowerarm01.R'] };
			const hp = (i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(P.skeleton.boneInverses[i]).invert());
			const W = { L: hp(wristOf.L), R: hp(wristOf.R) }, E = { L: hp(elbowOf.L), R: hp(elbowOf.R) };
			const p = [], n = [], s4 = [], w4 = [], col = [], surf = [], uv = [];
			const c = new THREE.Color(0x3b4436);
			for (const v of used) {
				const x = new THREE.Vector3().fromBufferAttribute(pos, v), side = x.x > 0 ? 'L' : 'R', d = W[side].clone().sub(E[side]);
				const u = clamp(x.clone().sub(E[side]).dot(d) / d.lengthSq(), 0, 1);
				if (u > 0.82) continue;
				const nn = new THREE.Vector3().fromBufferAttribute(nor, v);
				x.addScaledVector(nn, 0.004 + 0.003 * (1 - u));
				map.set(v, p.length / 3);
				p.push(x.x, x.y, x.z); n.push(nn.x, nn.y, nn.z);
				for (let k = 0; k < 4; k++) { s4.push(si.getComponent(v, k)); w4.push(sw.getComponent(v, k)); }
				col.push(c.r, c.g, c.b); surf.push(0.9, 0, 5 + 0.1, 0); uv.push(x.x * 28, x.y * 28 + x.z * 28);
			}
			const ix = [];
			for (let i = 0; i < sl.length; i += 3) if (map.has(sl[i]) && map.has(sl[i + 1]) && map.has(sl[i + 2])) ix.push(map.get(sl[i]), map.get(sl[i + 1]), map.get(sl[i + 2]));
			if (ix.length) {
				const sg = new THREE.BufferGeometry();
				sg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
				sg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(s4, 4)); sg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w4, 4));
				sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sg.setAttribute('surf', new THREE.Float32BufferAttribute(surf, 4)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
				sg.setIndex(ix);
				sleeve = new THREE.SkinnedMesh(sg, kitMaterial());
				sleeve.bindMode = 'detached'; sleeve.bind(skel, new THREE.Matrix4()); sleeve.frustumCulled = false;
			}
		}
		const group = new THREE.Group();
		group.add(skin);
		if (sleeve && !isPhone) group.add(sleeve);
		scene.add(group);
		const side = names.map((n) => (n.endsWith('.L') ? 'L' : 'R')), fore = names.map((n) => !/^(wrist|finger|metacarpal)/.test(n));
		return { me, group, skin, sleeve, bones, side, fore, tris: tri.length / 3 };
	}

	// ---------- input: aim ----------
	const longHeld = () => S.model?.userData.hold?.kind === 'long';
	addEventListener('pointerdown', (e) => { if (e.button === 2 && e.target === canvas && longHeld()) { S.aimHeld = true; e.preventDefault(); } });
	addEventListener('pointerup', (e) => { if (e.button === 2) S.aimHeld = false; });
	addEventListener('contextmenu', (e) => { if (e.target === canvas && longHeld() && S.shown) e.preventDefault(); });
	addEventListener('blur', () => { S.aimHeld = false; });
	let aimBtn = null;
	if (mount && (isPhone || matchMedia?.('(pointer: coarse)')?.matches)) {
		aimBtn = document.createElement('button');
		aimBtn.type = 'button'; aimBtn.setAttribute('aria-label', 'Aim');
		aimBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
		aimBtn.style.cssText = 'position:absolute;right:calc(18px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 96px + env(safe-area-inset-bottom));width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,16,20,.45);color:#eafaf6;display:none;align-items:center;justify-content:center;z-index:6;touch-action:manipulation;';
		for (const ev of ['pointerdown', 'touchstart']) aimBtn.addEventListener(ev, (e) => e.stopPropagation());
		aimBtn.addEventListener('click', (e) => { e.stopPropagation(); S.aimTap = !S.aimTap; aimBtn.style.background = S.aimTap ? 'rgba(60,140,120,.6)' : 'rgba(10,16,20,.45)'; });
		mount.appendChild(aimBtn);
	}

	// ---------- each frame ----------
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
	const camInv = new THREE.Quaternion(), hf = new THREE.Matrix4(), X = { L: new THREE.Matrix4(), R: new THREE.Matrix4() }, ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
	const handAt = new THREE.Matrix4(), tmp = new THREE.Matrix4(), tmp2 = new THREE.Matrix4(), F = { L: null, R: null };
	// held: { i, l, t } or null; P: the player's state; on: first person and free to hold things
	function update(dt, held, P, on, W, time) {
		const want = held && on ? `${held.i}:${held.l}:${held.t}` : '';
		S.want = want;
		// changing what you hold: the old one lowered out, the new one raised in
		if (S.key !== want) {
			S.equip = Math.max(0, S.equip - dt / 0.22);
			if (S.equip === 0 || !S.model) swapIn(want ? held : null);
		} else if (S.model) S.equip = Math.min(1, S.equip + dt / 0.38);
		S.shown = !!S.model && on;
		if (aimBtn) { const d = S.shown && longHeld() ? 'flex' : 'none'; if (aimBtn.style.display !== d) aimBtn.style.display = d; if (d === 'none') S.aimTap = false; }
		if (!S.shown) { setZoom(1); S.ads = 0; return; }
		if (!arms && avatar?.me) arms = buildArms(avatar.me);
		else if (!arms && avatar && !S.asked) { S.asked = true; avatar.ready?.(); }
		const H = S.model.userData.hold, id = S.id;

		// the motion of you: how fast, turning, in the air, sprinting
		const speed = Math.hypot(P.vel.x, P.vel.z), G = P.gait || { phase: 0, count: 0 };
		const sprint = P.run && speed > 4.2 && P.grounded;
		S.sprint += ((sprint ? 1 : 0) - S.sprint) * Math.min(1, dt * 7);
		const aim = (S.aimHeld || S.aimTap) && H.kind === 'long' && S.sprint < 0.3 && S.equip > 0.9;
		S.ads += ((aim ? 1 : 0) - S.ads) * Math.min(1, dt * 9);
		const a = ease(clamp(S.ads, 0, 1)), still = 1 - a * 0.88;
		const L = S.last || { yaw: P.yaw, pitch: P.pitch, grounded: P.grounded, vy: 0 };
		const dyaw = wrap(P.yaw - L.yaw), dpitch = P.pitch - L.pitch;
		const lx = S.lagX.to(clamp(dyaw / Math.max(dt, 1e-3) * 0.01, -0.05, 0.05), dt), ly = S.lagY.to(clamp(-dpitch / Math.max(dt, 1e-3) * 0.008, -0.04, 0.04), dt), lr = S.lagR.to(clamp(dyaw / Math.max(dt, 1e-3) * 0.03, -0.12, 0.12), dt);
		// landing: a dip that springs back; in the air the arms rise a touch
		if (P.grounded && !L.grounded) S.land.dv -= clamp(-L.vy * 0.05, 0.1, 0.6);
		S.air += ((P.grounded || P.swimming ? 0 : 1) - S.air) * Math.min(1, dt * 5);
		const land = S.land.to(0, dt);
		S.last = { yaw: P.yaw, pitch: P.pitch, grounded: P.grounded, vy: P.vel.y };
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
		const px = Math.min(vw.p[0], Math.abs(vw.p[2]) * halfW * 0.62) * Math.sign(vw.p[0]);
		const hip = V.set(px, vw.p[1], vw.p[2]);
		Q.copy(BASE);
		Q2.setFromEuler(E.set(vw.r[1], vw.r[0], vw.r[2], 'YXZ'));
		const hipQ = new THREE.Quaternion().multiplyQuaternions(Q2, Q);
		let pos = hip.clone(), rot = hipQ;
		if (H.sight && a > 0) {
			const [sx, sy, relief] = H.sight;
			const adsPos = V2.set(0, -sy, -relief + sx);
			pos.lerp(adsPos, a);
			rot = hipQ.clone().slerp(BASE, a);
		}
		// sprinting: lowered and turned across; changing: lowered out of view
		const sp = ease(S.sprint) * (1 - a), eq = 1 - ease(S.equip);
		pos.x += -0.04 * sp + bx * still + lx * still; pos.y += -0.05 * sp - 0.28 * eq + (by + breath) * still + land * 0.6 + ly * still + S.air * 0.012;
		pos.z += 0.03 * sp;
		Q2.setFromEuler(E.set(-0.35 * sp - 0.9 * eq + breath * 2 + land * 1.5 + ly * 1.2, 0.55 * sp + lx * 2.2, 0.35 * sp + lr * still + bx * 1.5, 'YXZ'));
		rot = Q2.multiply(rot);
		S.model.matrix.compose(pos, rot, ONE);
		S.model.matrixWorldNeedsUpdate = true;
		spinMotes(S.model, time); kitTick(time);
		setZoom(1 + ((H.zoom || 1) - 1) * a);

		// your hands on it
		if (arms) {
			const me = arms.me;
			const Mo = me.M, name = Mo.S.act.name;
			const carry = H.kind === 'long';
			if (carry && (!name || name === 'carry')) { if (name !== 'carry') Mo.act('carry', 0); }
			else if (!carry && name === 'carry') Mo.act(null);
			Mo.grip('R', H.R ? 1 : 0); Mo.grip('L', H.L ? 1 : 0);
			if (!me.P.root.visible) Mo.update(dt, time, null);
			me.P.root.updateMatrixWorld(true);
			for (const side of ['L', 'R']) {
				const G2 = H[side];
				if (!G2 || !handFrame(me.P, side, hf)) { X[side] = null; continue; }
				handAt.multiplyMatrices(S.model.matrix, G2.m);
				(X[side] ||= new THREE.Matrix4()).multiplyMatrices(handAt, tmp.copy(hf).invert());
				// the forearm swung about the wrist to run back toward where the elbow would be
				const e = vw['e' + side], ae = vw['a' + side] || e;
				const wr = V.setFromMatrixPosition(me.P.bones[me.P.map['wrist.' + side]].matrixWorld).applyMatrix4(X[side]);
				const el = V2.setFromMatrixPosition(me.P.bones[me.P.map['lowerarm01.' + side]].matrixWorld).applyMatrix4(X[side]);
				const now = el.sub(wr).normalize(), want = new THREE.Vector3(e[0] + (ae[0] - e[0]) * a, e[1] + (ae[1] - e[1]) * a, e[2] + (ae[2] - e[2]) * a).sub(wr).normalize();
				Q.setFromUnitVectors(now, want);
				(F[side] ||= new THREE.Matrix4()).makeTranslation(wr.x, wr.y, wr.z).multiply(tmp.makeRotationFromQuaternion(Q)).multiply(tmp2.makeTranslation(-wr.x, -wr.y, -wr.z)).multiply(X[side]);
			}
			for (let i = 0; i < arms.bones.length; i++) {
				const sd = arms.side[i], x = arms.fore[i] ? F[sd] : X[sd];
				arms.bones[i].matrixWorld.copy(X[sd] ? tmp.multiplyMatrices(x, me.P.bones[i].matrixWorld) : ZERO);
			}
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
	function render(renderer) {
		if (!S.shown || !S.model) return;
		if (!env && !envTried) {
			envTried = true;
			try { const pm = new THREE.PMREMGenerator(renderer); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch { env = null; }
		}
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
		const out = { held: S.id, ads: +S.ads.toFixed(2), equip: +S.equip.toFixed(2), zoom: +S.zoom.toFixed(2), fov: +cam.fov.toFixed(1), muzzleDotForward: +fwd.dot(new THREE.Vector3(0, 0, -1)).toFixed(3), upDotUp: +up.dot(new THREE.Vector3(0, 1, 0)).toFixed(3), sight: H.sight ? new THREE.Vector3(H.sight[0], H.sight[1], 0).applyMatrix4(m).toArray().map((x) => +x.toFixed(3)) : null, grip: new THREE.Vector3().setFromMatrixPosition(m).toArray().map((x) => +x.toFixed(3)), tris: triangles(S.model), armTris: arms?.tris || 0, calls: S.calls, arms: !!arms };
		if (arms) for (const side of ['L', 'R']) {
			const G = H[side];
			if (!G || !handFrame(arms.me.P, side, hf, (i) => arms.bones[i].matrixWorld)) continue;
			const want = new THREE.Matrix4().multiplyMatrices(m, G.m);
			const p = new THREE.Vector3().setFromMatrixPosition(hf), q = new THREE.Vector3().setFromMatrixPosition(want);
			out['palm' + side + 'mm'] = +(p.distanceTo(q) * 1000).toFixed(1);
		}
		return out;
	}
	const aimOverride = (on) => { S.aimTap = !!on; };
	return { update, render, info, aim: aimOverride, state: S, get shown() { return S.shown; } };
}
