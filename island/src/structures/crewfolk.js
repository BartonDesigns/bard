// The crew: every worker on every site in one instanced draw (and one for its shadow), posed in
// the vertex shader. A figure with a proper silhouette: hips and a tapered torso, a hi-vis vest
// over the shirt with its reflective bands and braces, a neck and head, a hard hat with its brim
// and peak, upper arms and forearms with gloved hands, thighs and shins in work trousers, boots.
// Each vertex knows its bone and what it is (skin, hat, vest, band, shirt, trousers, boots,
// gloves, a tool); each worker carries only a few numbers: where and which way, the task, how
// far through it, the tool and their looks (skin, hat, vest, shirt, build). The shader turns
// the hips, knees, spine, neck, shoulders and elbows for the task: walking, carrying a block in
// front or a bar on the shoulder, hammering, shovelling, guiding a load in with an arm up,
// holding the mixer's chute, laying blocks on one knee, talking with their hands. The tools
// (hammer, shovel, block, bar) are in the mesh and shown only in the hands of whoever is using
// them. A walker's step follows the ground they cover, so feet do not slide.

import * as THREE from 'three';
import { kitShared } from './crewkit.js';

export const POSES = { talk: 0, walk: 1, carry: 2, shoulder: 3, hammer: 4, shovel: 5, guide: 6, pour: 7, lay: 8, idle: 9, pane: 10 };
export const TOOLS = { none: 0, hammer: 1, shovel: 2, block: 3, bar: 4, pane: 5 };
// the tool each task wants
export const toolOf = (pose) => (pose === 'hammer' ? 1 : pose === 'shovel' ? 2 : pose === 'carry' || pose === 'lay' ? 3 : pose === 'shoulder' ? 4 : pose === 'pane' ? 5 : 0);

// ---------- the figure ----------
// bones: 0 hips, 1 torso, 2 head, 3 left upper arm, 4 left forearm, 5 right upper arm, 6 right
// forearm, 7 left thigh, 8 left shin, 9 right thigh, 10 right shin. The figure faces +z; its
// left is +x. Slots: 0 skin, 1 hat, 2 vest, 3 band, 4 shirt, 5 trousers, 6 boots, 7 gloves,
// 8 wood, 9 steel, 10 block
function figure() {
	const pos = [], nor = [], bone = [], slot = [], tool = [];
	const put = (g, b, s, t = 0) => {
		const q = g.index ? g.toNonIndexed() : g;
		const p = q.attributes.position.array, n = q.attributes.normal.array;
		for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
		for (let i = 0; i < p.length / 3; i++) { bone.push(b); slot.push(s); tool.push(t); }
	};
	const T = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
	const limb = (r0, r1, a, b, seg = 7) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false); g.translate(0, L / 2, 0); const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); g.translate(a[0], a[1], a[2]); return g; };
	const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 8, hs = 6) => T(new THREE.SphereGeometry(r, ws, hs), x, y, z, 0, 0, 0, sx, sy, sz);
	// the hips, the trousers' seat
	put(T(new THREE.SphereGeometry(0.17, 10, 6), 0, 0.95, 0, 0, 0, 0, 1.05, 0.62, 0.72), 0, 5);
	// the torso: a lathe narrowing to the waist, broad at the chest, made elliptical
	const prof = [[0.0, 0.98], [0.15, 1.0], [0.155, 1.1], [0.175, 1.26], [0.18, 1.36], [0.16, 1.43], [0.08, 1.48], [0.0, 1.49]];
	put(T(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 10), 0, 0, 0, 0, 0, 0, 1.12, 1, 0.68), 1, 4);
	// the vest over it, its bands and braces
	const vest = [[0.162, 1.02], [0.168, 1.1], [0.188, 1.26], [0.193, 1.36], [0.175, 1.42], [0.12, 1.455]];
	put(T(new THREE.LatheGeometry(vest.map(([r, y]) => new THREE.Vector2(r, y)), 10), 0, 0, 0, 0, 0, 0, 1.12, 1, 0.7), 1, 2);
	for (const [y0, y1] of [[1.09, 1.125], [1.17, 1.205]]) put(T(new THREE.LatheGeometry([new THREE.Vector2(0.176, y0), new THREE.Vector2(0.18, y1)], 10), 0, 0, 0, 0, 0, 0, 1.13, 1, 0.71), 1, 3);
	for (const sx of [-1, 1]) { put(T(new THREE.BoxGeometry(0.035, 0.3, 0.012), sx * 0.08, 1.31, 0.135, -0.08), 1, 3); put(T(new THREE.BoxGeometry(0.035, 0.3, 0.012), sx * 0.08, 1.31, -0.135, 0.08), 1, 3); }
	// the neck and head, the ears, the nose; the hard hat: its shell, brim and peak, the ridge
	put(limb(0.05, 0.047, [0, 1.45, 0], [0, 1.56, 0.005], 7), 2, 0);
	put(ball(0.1, 0, 1.635, 0.01, 0.92, 1.12, 1.02, 10, 8), 2, 0);
	put(T(new THREE.BoxGeometry(0.03, 0.045, 0.04), 0, 1.62, 0.108, -0.2), 2, 0);
	for (const sx of [-1, 1]) put(ball(0.022, sx * 0.093, 1.63, 0.0, 0.5, 1, 0.8, 5, 4), 2, 0);
	put(T(new THREE.SphereGeometry(0.128, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.7, 0.005, 0, 0, 0, 0.92, 0.85, 1.06), 2, 1);
	put(T(new THREE.CylinderGeometry(0.138, 0.14, 0.012, 12), 0, 1.703, 0.012, 0, 0, 0, 0.95, 1, 1.08), 2, 1);
	put(T(new THREE.BoxGeometry(0.17, 0.012, 0.07), 0, 1.703, 0.16, 0.12), 2, 1);
	put(T(new THREE.BoxGeometry(0.03, 0.03, 0.22), 0, 1.81, 0.0), 2, 1);
	// arms: shoulders, upper arms in the shirt, forearms, gloved hands
	for (const sx of [-1, 1]) {
		const L = sx > 0, ub = L ? 3 : 5, fb = L ? 4 : 6, sh = [sx * 0.205, 1.41, 0];
		put(ball(0.065, sx * 0.2, 1.4, 0, 1, 1, 1, 7, 5), ub, 4);
		put(limb(0.058, 0.048, sh, [sx * 0.215, 1.12, 0]), ub, 4);
		put(limb(0.046, 0.037, [sx * 0.215, 1.12, 0], [sx * 0.22, 0.87, 0.01]), fb, 7 - 3 * (0) - 0 === 7 ? 4 : 4);
		put(T(new THREE.BoxGeometry(0.075, 0.15, 0.045), sx * 0.222, 0.8, 0.015), fb, 7);
		put(T(new THREE.BoxGeometry(0.03, 0.06, 0.03), sx * 0.2, 0.84, 0.045), fb, 7);
	}
	// legs: thighs and shins in the trousers, the boots with their soles
	for (const sx of [-1, 1]) {
		const L = sx > 0, tb = L ? 7 : 9, sb = L ? 8 : 10;
		put(limb(0.088, 0.066, [sx * 0.095, 0.95, 0], [sx * 0.098, 0.5, 0.01]), tb, 5);
		put(ball(0.066, sx * 0.098, 0.5, 0.012, 1, 1, 1, 7, 5), sb, 5);
		put(limb(0.062, 0.048, [sx * 0.098, 0.5, 0.012], [sx * 0.1, 0.11, -0.01]), sb, 5);
		put(T(new THREE.BoxGeometry(0.11, 0.11, 0.28), sx * 0.1, 0.065, 0.045), sb, 6);
		put(T(new THREE.BoxGeometry(0.115, 0.025, 0.29), sx * 0.1, 0.012, 0.045), sb, 6);
	}
	// the tools: a hammer and a shovel in the right hand, a block held in front, a bar on the shoulder
	const rh = [-0.222, 0.8, 0.03];
	put(T(new THREE.BoxGeometry(0.03, 0.03, 0.34), rh[0], rh[1], rh[2] + 0.13), 6, 8, 1);
	put(T(new THREE.BoxGeometry(0.035, 0.13, 0.04), rh[0], rh[1] + 0.03, rh[2] + 0.3), 6, 9, 1);
	{
		// (held at the top in the right hand: the shaft runs down and back as the arm hangs, so that
		// with the forearm brought up to the work it runs down ahead to the ground)
		const d = new THREE.Vector3(0.12, -0.89, -0.45).normalize(), L = 1.15, top = new THREE.Vector3(rh[0], rh[1] + 0.04, rh[2]);
		const g = new THREE.CylinderGeometry(0.017, 0.017, L, 6); g.translate(0, -L / 2, 0);
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
		g.applyQuaternion(q); g.translate(top.x, top.y, top.z);
		put(g, 6, 8, 2);
		const b = new THREE.BoxGeometry(0.24, 0.3, 0.025); b.translate(0, -0.15, 0.02); b.applyQuaternion(q);
		const end = top.clone().addScaledVector(d, L);
		b.translate(end.x, end.y, end.z);
		put(b, 6, 9, 2);
		put(T(new THREE.BoxGeometry(0.12, 0.03, 0.03), top.x, top.y + 0.02, top.z), 6, 9, 2);
	}
	put(T(new THREE.BoxGeometry(0.39, 0.19, 0.19), 0, 1.1, 0.33), 1, 10, 3);
	put(T(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), -0.17, 1.5, 0.25, Math.PI / 2), 1, 10, 4);
	// (a pane of glass carried upright at the right side, a hand under it and one steadying it)
	put(T(new THREE.BoxGeometry(0.012, 1.15, 0.95), -0.33, 0.95, 0.12), 1, 11, 5);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('aBone', new THREE.Float32BufferAttribute(bone, 1));
	g.setAttribute('aSlot', new THREE.Float32BufferAttribute(slot, 1));
	g.setAttribute('aTool', new THREE.Float32BufferAttribute(tool, 1));
	g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
	g.computeBoundingSphere();
	return g;
}

// ---------- the poses, in the vertex shader ----------
const POSE_GLSL = /* glsl */`
attribute float aBone; attribute float aSlot; attribute float aTool;
attribute vec4 iPose; attribute vec4 iLook;
uniform vec3 uSkin[5]; uniform vec3 uHat[4]; uniform vec3 uVest[2]; uniform vec3 uShirt[4];
varying float vBand;
mat3 fRx(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 fRy(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 fRz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// a cycle's shape: up slowly, down fast (a hammer's stroke)
float fStroke(float t) { float f = fract(t); return f < 0.72 ? smoothstep(0.0, 0.72, f) : 1.0 - smoothstep(0.72, 0.8, f); }
`;
// (fills the joint angles from iPose: x the task, y how far through it, z a second clock)
const POSE_BODY = /* glsl */`
	float fP = floor(iPose.x + 0.5), fT = iPose.y, fT2 = iPose.z;
	float bob = 0.0, crouch = 0.0, spB = 0.04, spY = 0.0, spR = 0.0, hdP = 0.0, hdY = 0.0;
	float shL = 0.0, abL = 0.08, elL = 0.18, shR = 0.0, abR = 0.08, elR = 0.18;
	float hpL = 0.0, knL = 0.03, hpR = 0.0, knR = 0.03;
	float w = fT * 6.2832;
	if (fP == 1.0 || fP == 2.0 || fP == 3.0 || fP == 10.0) {
		// a walk: the legs from the ground covered, the arms against them
		hpL = 0.42 * sin(w); hpR = -hpL;
		knL = 0.08 + 0.75 * max(0.0, sin(w - 1.9)); knR = 0.08 + 0.75 * max(0.0, sin(w + 1.24));
		bob = 0.03 * abs(cos(w)) - 0.015; spB = 0.07;
		shL = -0.38 * sin(w); shR = 0.38 * sin(w); elL = 0.3 + 0.12 * sin(w); elR = 0.3 - 0.12 * sin(w);
		hdY = 0.08 * sin(fT2 * 0.4);
		if (fP == 2.0) { shL = shR = 0.58; elL = elR = 1.05; abL = abR = -0.12; spB = -0.04; }
		if (fP == 3.0) { shR = 1.05; abR = 0.55; elR = 2.45; spR = -0.06; }
		if (fP == 10.0) { shR = 0.15; abR = 0.32; elR = 0.35; shL = 0.85; abL = -0.55; elL = 0.7; spR = 0.05; }
	}
	else if (fP == 4.0) {
		// hammering: bent to the work, the right arm drawn up slowly and struck down
		float s = fStroke(fT * 1.4);
		spB = 0.32; hdP = 0.35; hpL = 0.38; hpR = 0.05; knL = 0.45; knR = 0.22; crouch = 0.06;
		shR = 0.55 + 1.35 * s; abR = 0.18; elR = 0.35 + 1.1 * s;
		shL = 0.7; elL = 0.95; abL = -0.05;
	}
	else if (fP == 5.0) {
		// shovelling: down into it, up, a turn and a throw, back
		float f = fract(fT * 0.42), dig = smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.35, 0.55, f)), thr = smoothstep(0.45, 0.65, f) * (1.0 - smoothstep(0.75, 1.0, f));
		spB = 0.18 + 0.5 * dig + 0.1 * thr; spY = -0.55 * thr; crouch = 0.1 * dig;
		hpL = 0.25 + 0.4 * dig; hpR = -0.05 + 0.2 * dig; knL = 0.3 + 0.5 * dig; knR = 0.15 + 0.4 * dig;
		shR = 0.45 + 0.25 * dig + 0.5 * thr; elR = 0.7 - 0.2 * dig; abR = 0.1;
		shL = 0.9 + 0.2 * dig + 0.3 * thr; elL = 0.35; abL = -0.32;
		hdP = 0.3 * dig;
	}
	else if (fP == 6.0) {
		// guiding a load in: the left arm up and signalling, the right low toward it, looking up
		spB = -0.06; hdP = -0.45 + 0.08 * sin(fT2 * 0.9); hdY = 0.15 * sin(fT2 * 0.5);
		shL = 2.5 + 0.25 * sin(fT * 6.2832); abL = 0.35; elL = 0.35 + 0.35 * max(0.0, sin(fT * 6.2832));
		shR = 0.75; abR = 0.25; elR = 0.25; hpL = 0.1; hpR = -0.08;
	}
	else if (fP == 7.0) {
		// holding the mixer's chute, leaning to it
		spB = 0.22 + 0.04 * sin(fT2 * 0.7); spY = 0.15 * sin(fT2 * 0.35); hdP = 0.35;
		shL = shR = 0.95; elL = elR = 0.55; abL = abR = -0.06; hpL = 0.3; knL = 0.25; hpR = -0.1;
	}
	else if (fP == 8.0) {
		// laying blocks, down on one knee, a block set and the next taken up
		float f = fract(fT * 0.3);
		crouch = 0.42; hpL = 1.35; knL = 1.9; hpR = 0.25; knR = 1.95;
		spB = 0.45 + 0.15 * sin(f * 6.2832); hdP = 0.3;
		shL = shR = 0.8 + 0.3 * sin(f * 6.2832); elL = elR = 0.55; abL = abR = -0.08;
	}
	else {
		// talking, or standing by: weight from foot to foot, the hands at it now and then
		float g = smoothstep(0.3, 0.6, sin(fT2 * 0.45));
		hpL = 0.04 * sin(fT2 * 0.3); hpR = -hpL; hdY = 0.35 * sin(fT2 * 0.23); hdP = 0.05;
		shR = 0.15 + g * (0.6 + 0.25 * sin(fT2 * 2.3)); elR = 0.4 + g * (0.9 + 0.3 * sin(fT2 * 3.1));
		shL = 0.05 + 0.1 * g; elL = 0.3 + 0.2 * g;
		if (fP == 9.0) { abL = abR = 0.55; elL = elR = 1.75; shL = shR = -0.25; }
	}
	float b = floor(aBone + 0.5);
	vec3 fp = position, fn = normal;
	// (a tool not in use folds away to nothing)
	float tl = floor(aTool + 0.5);
	if (tl > 0.5 && abs(tl - floor(iPose.w + 0.5)) > 0.5) fp = vec3(0.0, 1.0, 0.0);
	mat3 R = mat3(1.0);
	vec3 J;
	if (b >= 7.0) {
		bool L = b < 8.5;
		float hp = L ? hpL : hpR, kn = L ? knL : knR;
		vec3 hip = vec3(L ? 0.095 : -0.095, 0.95, 0.0), knee = vec3(L ? 0.098 : -0.098, 0.5, 0.012);
		if (b == 8.0 || b == 10.0) { mat3 K = fRx(kn); fp = knee + K * (fp - knee); fn = K * fn; }
		mat3 H = fRx(-hp); fp = hip + H * (fp - hip); fn = H * fn;
	} else if (b >= 1.0) {
		if (b >= 3.0) {
			bool L = b < 4.5;
			vec3 sh = vec3(L ? 0.205 : -0.205, 1.41, 0.0), el = vec3(L ? 0.215 : -0.215, 1.12, 0.0);
			if (b == 4.0 || b == 6.0) { mat3 E = fRx(-(L ? elL : elR)); fp = el + E * (fp - el); fn = E * fn; }
			mat3 S = fRx(-(L ? shL : shR)) * fRz(L ? abL : -abR); fp = sh + S * (fp - sh); fn = S * fn;
		}
		if (b == 2.0) { vec3 nk = vec3(0.0, 1.47, 0.0); mat3 N = fRy(hdY) * fRx(hdP); fp = nk + N * (fp - nk); fn = N * fn; }
		vec3 sp = vec3(0.0, 0.98, 0.0); mat3 Sp = fRy(spY) * fRx(spB) * fRz(spR); fp = sp + Sp * (fp - sp); fn = Sp * fn;
	}
	fp.y += bob - crouch;
	fp *= vec3(iLook.w, iLook.w, iLook.w);
`;
const FOLK_COLOR = /* glsl */`
	float sl = floor(aSlot + 0.5);
	vec3 fc = vec3(0.2);
	if (sl == 0.0) fc = uSkin[int(iLook.x)];
	else if (sl == 1.0) fc = uHat[int(iLook.y)];
	else if (sl == 2.0) fc = uVest[int(iLook.z)];
	else if (sl == 3.0) fc = vec3(0.62, 0.64, 0.66);
	else if (sl == 4.0) fc = uShirt[int(mod(iLook.x + iLook.y, 4.0))];
	else if (sl == 5.0) fc = mix(vec3(0.05, 0.06, 0.09), vec3(0.17, 0.15, 0.12), step(2.5, iLook.x));
	else if (sl == 6.0) fc = vec3(0.12, 0.075, 0.04);
	else if (sl == 7.0) fc = vec3(0.32, 0.25, 0.12);
	else if (sl == 8.0) fc = vec3(0.45, 0.3, 0.16);
	else if (sl == 9.0) fc = vec3(0.3, 0.31, 0.33);
	else if (sl == 11.0) fc = vec3(0.55, 0.68, 0.66);
	else fc = vec3(0.55, 0.54, 0.51);
	vColor = vec4(fc, 1.0);
	vBand = sl == 3.0 ? 1.0 : 0.0;
`;
const lin3 = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const FOLK_U = {
	uSkin: { value: [[0.87, 0.67, 0.53], [0.68, 0.48, 0.34], [0.46, 0.31, 0.21], [0.78, 0.58, 0.42], [0.3, 0.2, 0.14]].map(lin3) },
	uHat: { value: [[0.95, 0.95, 0.92], [0.98, 0.8, 0.08], [0.98, 0.45, 0.06], [0.16, 0.38, 0.8]].map(lin3) },
	uVest: { value: [[0.82, 0.95, 0.1], [0.99, 0.42, 0.05]].map(lin3) },
	uShirt: { value: [[0.2, 0.24, 0.32], [0.55, 0.55, 0.52], [0.16, 0.18, 0.18], [0.35, 0.28, 0.2]].map(lin3) },
};
function folkMaterial() {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, FOLK_U, { uNight: kitShared.uNight });
		sh.vertexShader = POSE_GLSL + sh.vertexShader
			.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + POSE_BODY + '\tobjectNormal = fn;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = fp;')
			.replace('#include <color_vertex>', '#include <color_vertex>\n' + FOLK_COLOR);
		sh.fragmentShader = 'uniform float uNight; varying float vBand;\n' + sh.fragmentShader
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix(0.8, 0.45, vBand);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * vBand * pow(saturate(dot(normal, normalize(vViewPosition))), 1.5) * (0.06 + uNight * 1.2);');
	};
	m.customProgramCacheKey = () => 'crew-folk-1';
	const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
	d.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, FOLK_U);
		sh.vertexShader = POSE_GLSL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvec3 normal = vec3(0.0, 1.0, 0.0);\n' + POSE_BODY + '\ttransformed = fp;');
	};
	d.customProgramCacheKey = () => 'crew-folk-depth-1';
	return { m, d };
}

// ---------- the crew ----------
// begin(); set(x, y, z, yaw, pose, t, look, t2) for each worker this frame; end(). pose a POSES
// name, t how far through the task (for a walker: the ground covered over the stride), look a
// number for their looks, t2 their own clock
export function createCrew(scene, cap) {
	const geo = figure();
	const pose = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), look = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
	pose.setUsage(THREE.DynamicDrawUsage); look.setUsage(THREE.DynamicDrawUsage);
	geo.setAttribute('iPose', pose); geo.setAttribute('iLook', look);
	const { m, d } = folkMaterial();
	const mesh = new THREE.InstancedMesh(geo, m, cap);
	mesh.customDepthMaterial = d;
	mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
	mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	mesh.name = 'structures-crew';
	scene.add(mesh);
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
	let n = 0;
	function begin() { n = 0; }
	function set(x, y, z, yaw, poseName, t, lk = n, t2 = t) {
		if (n >= cap) return -1;
		const i = n++;
		M.compose(P3.set(x, y, z), Q.setFromAxisAngle(Y, yaw), S1);
		mesh.setMatrixAt(i, M);
		const p = POSES[poseName] ?? 0, h = Math.abs(Math.floor(lk));
		pose.setXYZW(i, p, t, t2, toolOf(poseName));
		look.setXYZW(i, h % 5, (h * 3 + 1) % 4, h % 3 === 1 ? 1 : 0, 0.95 + ((h * 7) % 11) / 100);
		return i;
	}
	function end() {
		mesh.count = n;
		mesh.instanceMatrix.needsUpdate = true; pose.needsUpdate = true; look.needsUpdate = true;
	}
	return { begin, set, end, count: () => n, cap, mesh, verts: geo.attributes.position.count };
}
