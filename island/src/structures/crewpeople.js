// The crew close up: the workers nearest you are real people (people/body.js, the MakeHuman
// bodies everyone in the city has), each the same person every time you come back to their
// site. Dressed for the work: a hi-vis vest over a work shirt, work trousers, boots, a hard hat
// in the colour the far figure wears, gloves on some; the tool of the task in their hands (a
// hammer, a shovel, a block held in front, a bar on the shoulder, a pane carried upright), and
// the task itself played by the body (people/actions.js crew*): bent to the hammering,
// shovelling, guiding a load in with an arm up, holding the mixer's chute, down on one knee
// laying blocks, walking to and from the trucks. They take over from the instanced figure
// (crewfolk.js) as you come near, fading in where it stands, and hand back to it as you go.
//
// You can walk up to any of them and talk (people.js addTalkers, the guide's conversation):
// they stop, turn to you, and are who they are (persona.js): a name, a trade on this crew and
// the company on the trucks' doors. Walk away and they go back to it.

import * as THREE from 'three';
import { loadPeopleAssets, peopleAssetsNow, buildPerson, personDNA, rng, freeBody } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { addTalkers } from '../people/people.js';
import { fadePerson } from '../people/fade.js';
import { handFrame } from '../crysis/held-items.js';

// how the instanced figure is coloured (crewfolk.js set(): a look number h): the vest h % 3 ===
// 1 orange, else yellow; the hat by (h * 3 + 1) % 4
export const HATS = ['#f1f1ec', '#f9cc14', '#f97316', '#2a62cc'];
export const VESTS = ['#d8f03a', '#ff6a10'];
export const SHIRTS = ['#1f2a44', '#3b3f45', '#5a5e63', '#2d3a2a', '#6b5a44', '#e6e4de', '#7a2a22', '#2a3d57'];
export const TROUSERS = [['#2a2f38', 'cargo'], ['#3f3a30', 'cargo'], ['#1f2433', 'plain'], ['#5b5141', 'cargo'], ['#2c3e5c', 'denim']];
const pick = (r, a) => a[Math.floor(r() * a.length)];
// the trade each part of the work is
export const TRADES = { hammer: 'a carpenter', lay: 'a mason', shovel: 'a labourer', carry: 'a labourer', shoulder: 'an ironworker', pane: 'a glazier', guide: 'a rigger who signals the crane', pour: 'a concrete finisher', glazier: 'a glazier', talk: 'the site foreman', idle: 'a labourer', walk: 'a labourer' };

// what a worker wears: the instanced figure's vest and hat colours, the rest their own
export function workerStyle(look, r) {
	const h = Math.abs(Math.floor(look));
	// (the shirt and trousers by the look too, so the far figure (crewbake.js) wears the same)
	const shirt = SHIRTS[(h * 7 + 3) % SHIRTS.length], [tc, tp] = TROUSERS[(h * 5 + 1) % TROUSERS.length], k = r();
	const top = k < 0.5 ? { kind: 'tee', col: shirt, pat: 'plain', fit: 'regular', sleeves: 'short' }
		: k < 0.8 ? { kind: 'henley', col: shirt, pat: 'plain', fit: 'regular', sleeves: 'long' }
			: { kind: 'flannel', col: shirt, acc: '#16171a', acc2: '#d9d3c4', pat: 'plaid', fit: 'regular', sleeves: 'long', collar: true };
	const acc = [{ kind: 'hardhat', col: HATS[(h * 3 + 1) % 4], acc: '#2b2b2d' }];
	if (r() < 0.55) acc.push({ kind: 'gloves', col: '#b89a5e', acc: '#7a6440' });
	return {
		gen: 'x', top,
		outer: { kind: 'vest', col: VESTS[h % 3 === 1 ? 1 : 0], acc: '#b9bec4', pat: 'hivis', fit: 'regular', sleeves: 'none', open: r() < 0.3, fab: 'nylon' },
		bottom: { kind: tp === 'denim' ? 'jeans' : 'trousers', col: tc, pat: tp, legs: 'long', fit: 'straight' },
		shoes: { kind: 'boot', col: pick(r, ['#5a4026', '#3a2a1c', '#1c1c1e', '#7a5a34']), sole: '#1a1612' },
		acc,
	};
}

// ---------- the tools, in the hand's own frame (held-items.js handFrame: x along the fingers,
// y across the palm toward the thumb, z out of the palm) ----------
function toolGeometries() {
	const parts = (list) => {
		const P = [], N = [], C = [];
		for (const [g, col] of list) {
			const q = g.index ? g.toNonIndexed() : g;
			q.computeVertexNormals();
			const c = new THREE.Color(col).convertSRGBToLinear(), p = q.attributes.position.array, n = q.attributes.normal.array;
			for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); }
			for (let i = 0; i < p.length / 3; i++) C.push(c.r, c.g, c.b);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		g.computeBoundingSphere();
		return g;
	};
	const cyl = (r0, r1, a, b, seg = 8) => { const L = b - a, g = new THREE.CylinderGeometry(r1, r0, L, seg); g.translate(0, a + L / 2, 0); return g; };
	const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
	// a framing hammer: its hickory handle through the fist, the steel head at the thumb's end,
	// the face to the fingers' side, the claw behind
	const hammer = parts([
		[cyl(0.016, 0.014, -0.08, 0.27), '#9a6a3c'],
		[box(0.04, 0.032, 0.032, 0.018, 0.285, 0), '#3a3c40'],
		[cyl(0.016, 0.016, 0, 0.03, 10).rotateZ(-Math.PI / 2).translate(0.038, 0.285, 0), '#55585d'],
		[box(0.07, 0.018, 0.022, -0.045, 0.29, 0).rotateZ(0), '#3a3c40'],
	]);
	// a shovel (in its own frame: the shaft down -y from the top hand at the origin, the blade's
	// face toward +z): the D grip above the top hand, the shaft, the socket and the blade
	const shovel = parts([
		[box(0.11, 0.012, 0.012, 0, 0.12, 0), '#202022'],
		[cyl(0.008, 0.008, 0.06, 0.12).translate(0.05, 0, 0), '#202022'],
		[cyl(0.008, 0.008, 0.06, 0.12).translate(-0.05, 0, 0), '#202022'],
		[cyl(0.017, 0.018, -1.0, 0.06), '#a87a48'],
		[cyl(0.022, 0.03, -1.12, -0.98), '#4a4c50'],
		[box(0.25, 0.3, 0.02, 0, -0.15, 0).rotateX(0.18).translate(0, -1.1, 0.012), '#5b6066'],
	]);
	// a concrete block, held in front in both hands (in the body's frame: x across, z ahead)
	const block = parts([[box(0.39, 0.19, 0.19, 0, 0, 0), '#b9b6ae']]);
	// a bundle of reinforcing bar on the shoulder (along z)
	const bar = parts([[cyl(0.012, 0.012, -1.6, 1.6, 5).rotateX(Math.PI / 2).translate(0.012, 0, 0), '#6b3b22'], [cyl(0.012, 0.012, -1.6, 1.6, 5).rotateX(Math.PI / 2).translate(-0.012, 0.004, 0), '#71402a'], [cyl(0.012, 0.012, -1.6, 1.6, 5).rotateX(Math.PI / 2).translate(0, 0.022, 0), '#6b3b22']]);
	// a pane of glass upright (in the body's frame: thin across, tall, long ahead)
	const pane = new THREE.BoxGeometry(0.012, 1.0, 0.85);
	return { hammer, shovel, block, bar, pane };
}
let TOOLS = null, toolMat = null, glassMat = null;
const TOOL_OF = { hammer: 'hammer', glazier: 'hammer', shovel: 'shovel', carry: 'block', lay: 'block', shoulder: 'bar', pane: 'pane' };
const ACT_OF = { carry: 'crewCarry', shoulder: 'crewShoulder', pane: 'crewPane', hammer: 'crewHammer', shovel: 'crewShovel', guide: 'crewGuide', pour: 'crewPour', lay: 'crewLay' };
// a hammer's stroke, as the far figure's (crewfolk.js fStroke): up slowly, down fast
const stroke = (t) => { const f = t - Math.floor(t); return f < 0.72 ? THREE.MathUtils.smoothstep(f, 0, 0.72) : 1 - THREE.MathUtils.smoothstep(f, 0.72, 0.8); };
const fract = (x) => x - Math.floor(x);

const HF = new THREE.Matrix4(), HF2 = new THREE.Matrix4(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), AX = new THREE.Vector3(), AY = new THREE.Vector3(), AZ = new THREE.Vector3(), Q1 = new THREE.Quaternion(), E1 = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
// where a tool is, as a world matrix, on a posed body (P its body, S its motion's state, u how
// far through the task): false if the hands are not to be found
export function toolMatrix(P, S, kind, u, out) {
	if (kind === 'hammer') {
		if (!handFrame(P, 'R', HF)) return false;
		out.copy(HF);
	} else if (kind === 'shovel') {
		// from the top (right) hand down toward where the blade is in the stroke: in the ground
		// ahead, lifted, swung up and over to the right for the throw, back
		if (!handFrame(P, 'R', HF)) return false;
		V1.setFromMatrixPosition(HF);
		const fx = Math.sin(S.heading), fz = Math.cos(S.heading), lx = Math.cos(S.heading), lz = -Math.sin(S.heading);
		const k = u < 0.25 ? 0 : u < 0.5 ? (u - 0.25) / 0.25 : u < 0.72 ? 1 + (u - 0.5) / 0.22 : 2 - (u - 0.72) / 0.28 * 2;
		const ahead = 0.95 - Math.max(0, k - 1) * 0.3, side = 0.18 - Math.max(0, k - 1) * 0.6, up = 0.03 + Math.min(1, k) * 0.32 + Math.max(0, k - 1) * 0.45;
		V2.set(S.pos.x + fx * ahead + lx * side, S.pos.y + up, S.pos.z + fz * ahead + lz * side);
		AY.subVectors(V1, V2).normalize();
		AX.set(lx, 0, lz); AX.addScaledVector(AY, -AX.dot(AY)).normalize();
		AZ.crossVectors(AX, AY);
		out.makeBasis(AX, AY, AZ).setPosition(V1);
	} else if (kind === 'block') {
		// between the two palms, square to the body
		if (!handFrame(P, 'R', HF) || !handFrame(P, 'L', HF2)) return false;
		V1.setFromMatrixPosition(HF).add(V2.setFromMatrixPosition(HF2)).multiplyScalar(0.5);
		V1.y += 0.05;
		out.compose(V1, Q1.setFromEuler(E1.set(0, S.heading, 0, 'YXZ')), S1);
	} else if (kind === 'bar') {
		// on the right shoulder, along the way they face, the front end a little down
		const i = P.map['shoulder01.R'] ?? P.map['clavicle.R'];
		P.bones[i].getWorldPosition(V1);
		V1.y += 0.075; V1.x -= Math.cos(S.heading) * 0.02; V1.z += Math.sin(S.heading) * 0.02;
		out.compose(V1, Q1.setFromEuler(E1.set(0.06, S.heading, 0, 'YXZ')), S1);
	} else if (kind === 'pane') {
		// upright at the right side, its foot just above the right hand
		if (!handFrame(P, 'R', HF)) return false;
		V1.setFromMatrixPosition(HF);
		V1.y += 0.45; V1.x += Math.cos(S.heading) * 0.04; V1.z -= Math.sin(S.heading) * 0.04;
		out.compose(V1, Q1.setFromEuler(E1.set(0, S.heading, 0, 'YXZ')), S1);
	} else return false;
	return true;
}
// the tools' shared geometry (made once)
export const toolGeometry = (kind) => (TOOLS ||= toolGeometries())[kind];
export { TOOL_OF, ACT_OF, stroke };

export function createCrewPeople(parent, { isPhone = false } = {}) {
	const group = new THREE.Group();
	group.name = 'structures-crew-people';
	parent.add(group);
	// a few at a time, the nearest; a phone fewer and nearer (each body is a few MB on the GPU)
	const LIMIT = isPhone ? 3 : 7, NEAR = isPhone ? 30 : 42, FAR = NEAR + 12, FADE_IN = 0.6, FADE_OUT = 0.35;
	let A = peopleAssetsNow(), failed = false, buildT = 0, frame = 0, time = 0;
	const asks = new Map();               // key -> this frame's ask
	const bodies = new Map();             // key -> { P, M, key, fade, leaving, tool, ... }
	const cam = new THREE.Vector3();
	const stopTalk = addTalkers(() => { const out = []; for (const b of bodies.values()) if (b.active && b.fade > 0.6) out.push(b); return out; });

	// begin(camera position): a frame's asks start
	function begin(c) { cam.copy(c); frame++; }
	// a worker where the site has them this frame: true if a real body stands there (the
	// instanced figure is then left out)
	function offer(key, x, y, z, yaw, pose, t, look, S, role) {
		const d = Math.hypot(x - cam.x, z - cam.z, (y - cam.y) * 0.5);
		if (d > FAR && !bodies.has(key)) return false;
		let q = asks.get(key);
		if (!q) { q = { key, x, y, z, yaw, pose, t, look, d, site: S, role, frame, vx: 0, vz: 0 }; asks.set(key, q); }
		else {
			// (how fast the place moves: a walker's body follows it at its pace)
			const dt = Math.max(1e-3, q.dtF || 1 / 60);
			if (q.frame === frame - 1) { q.vx += ((x - q.x) / dt - q.vx) * 0.3; q.vz += ((z - q.z) / dt - q.vz) * 0.3; } else { q.vx = q.vz = 0; }
			q.x = x; q.y = y; q.z = z; q.yaw = yaw; q.pose = pose; q.t = t; q.look = look; q.d = d; q.site = S; q.role = role; q.frame = frame;
		}
		const b = bodies.get(key);
		return !!b && !b.leaving && b.fade >= 1;
	}

	function build(q) {
		const seed = (Math.imul(hashKey(q.key), 2654435761) ^ 0x5bd1e995) >>> 0, r = rng(seed ^ 0xc4e3);
		const male = r() < 0.86, age = 20 + Math.pow(r(), 1.3) * 42;
		let d = null;
		for (let k = 0; k < 48; k++) {
			const s = (seed + Math.imul(k, 0x9e3779b9)) >>> 0;
			d = personDNA(s, { age, style: workerStyle(q.look, rng(s ^ 0x77)) });
			if (d.male === male) break;
		}
		// (a working build: a little more muscle, the walk a little heavier)
		d.muscle = Math.min(1, d.muscle + 0.25);
		const P = buildPerson(A, d);
		const company = q.site?.company || 'the crew';
		P.job = `${TRADES[q.role] || 'a labourer'} with ${company}, on the rebuild here`;
		P.errand = q.role === 'talk' ? 'keeping an eye on the rebuild' : 'at work on the rebuild';
		const b = { P, M: null, key: q.key, fade: 0, leaving: false, active: true, gy: q.y, tool: null, toolKind: null, pose: null, gT: 2 + r() * 3, talkT: r() * 10, engaged: false, speakUntil: 0, placed: false };
		b.M = createMotion(P, () => b.gy);
		b.M.S.hand = 'R';
		b.M.place(q.x, q.y, q.z, q.yaw);
		fadePerson(P, 0);
		group.add(P.root);
		bodies.set(q.key, b);
	}
	function drop(b) {
		if (b.tool) { b.tool.removeFromParent(); b.tool = null; }
		freeBody(b.P);
		b.active = false;
		bodies.delete(b.key);
	}
	// the tool for the task, in the hand or on the shoulder
	function toolFor(b, kind) {
		if (b.toolKind === kind) return b.tool;
		if (b.tool) { b.tool.removeFromParent(); b.tool = null; }
		b.toolKind = kind;
		if (!kind) return null;
		toolMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
		glassMat ||= new THREE.MeshStandardMaterial({ color: 0x9cc4c0, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false });
		const m = new THREE.Mesh(toolGeometry(kind), kind === 'pane' ? glassMat : toolMat);
		m.matrixAutoUpdate = false; m.castShadow = kind !== 'pane'; m.frustumCulled = false;
		group.add(m);
		b.tool = m;
		return m;
	}
	function placeTool(b, kind, u) {
		const m = toolFor(b, kind);
		if (!m) return;
		m.visible = b.P.root.visible && !(kind === 'block' && b.pose === 'lay' && u > 0.55);
		if (!m.visible) return;
		b.P.root.updateMatrixWorld(true);
		m.visible = toolMatrix(b.P, b.M.S, kind, u, m.matrix);
		m.matrixWorldNeedsUpdate = true;
	}

	// end(dt): the bodies handed to the nearest, moved to where the site has them, posed
	function end(dt) {
		time += dt;
		for (const q of asks.values()) q.dtF = dt;
		// (asks not renewed this frame are gone: the site out of reach, the work done)
		for (const [k, q] of asks) if (q.frame !== frame) asks.delete(k);
		if (!A && !failed && asks.size && [...asks.values()].some((q) => q.d < NEAR)) loadPeopleAssets().then((a) => { A = a; }).catch((e) => { failed = true; console.warn('[crew people]', e); });
		// who should have a body: the nearest within reach (and anyone you are talking with)
		const want = [...asks.values()].filter((q) => q.d < (bodies.has(q.key) ? FAR : NEAR)).sort((a, b) => a.d - b.d).slice(0, LIMIT);
		const keep = new Set(want.map((q) => q.key));
		for (const b of bodies.values()) if (b.engaged && asks.has(b.key)) keep.add(b.key);
		for (const b of bodies.values()) if (!keep.has(b.key) && !b.leaving) b.leaving = true;
		// one built at a time, a few times a second at most, so nothing stutters
		buildT -= dt;
		const live = [...bodies.values()].filter((b) => !b.leaving).length;
		if (A && buildT <= 0 && live < LIMIT) {
			const q = want.find((w) => !bodies.has(w.key));
			if (q) { try { build(q); } catch (e) { failed = true; console.warn('[crew people]', e); } buildT = 0.35; }
		}
		for (const b of [...bodies.values()]) {
			const q = asks.get(b.key);
			if (b.leaving) {
				b.fade = Math.max(0, b.fade - dt / FADE_OUT);
				fadePerson(b.P, b.fade);
				if (b.fade <= 0 || !q) { drop(b); continue; }
			} else {
				b.fade = Math.min(1, b.fade + dt / FADE_IN);
				fadePerson(b.P, b.fade);
			}
			if (q) drive(b, q, dt);
		}
	}

	function drive(b, q, dt) {
		const M = b.M, S = M.S, P = b.P;
		b.gy = q.y;
		const dx = q.x - S.pos.x, dz = q.z - S.pos.z, dd = Math.hypot(dx, dz), sp = Math.hypot(q.vx, q.vz);
		const camD = Math.hypot(cam.x - S.pos.x, cam.z - S.pos.z);
		if (b.engaged) {
			// talking with you: stop, face you, speak while there is speech, the tool lowered
			M.want.speed = 0;
			M.want.heading = Math.atan2(cam.x - S.pos.x, cam.z - S.pos.z);
			S.look.target = cam;
			const speaking = performance.now() < (b.speakUntil || 0);
			S.talk = speaking ? 1 : 0;
			M.act(null); M.setPose(speaking ? 'rest' : 'listen');
			b.pose = 'listen';
			if (b.toolKind === 'hammer' || b.toolKind === 'shovel') placeTool(b, b.toolKind, 0); else toolFor(b, null);
			M.update(dt, time, cam);
			P.lod?.(camD);
			return;
		}
		// far from its place (a jump in the site's plan, a new body): there at once, out of sight
		if (dd > 4 || (dd > 1.2 && b.fade < 0.2)) { M.place(q.x, q.y, q.z, q.yaw); }
		else if (dd > 0.3 || sp > 0.2) {
			// following its place: toward a point a little ahead of it, at its pace and a little more
			// to close the gap
			const ax = q.x + q.vx * 0.35 - S.pos.x, az = q.z + q.vz * 0.35 - S.pos.z;
			M.want.heading = Math.atan2(ax, az);
			M.want.speed = Math.min(2.2, sp + dd * 1.6);
		} else { M.want.speed = 0; M.want.heading = q.yaw; }
		const pose = q.pose;
		if (pose !== b.pose) { b.pose = pose; if (!ACT_OF[pose]) M.act(null); M.ungesture?.('explain'); }
		const A2 = ACT_OF[pose];
		let u = 0;
		if (pose === 'hammer') u = stroke(q.t * 1.4);
		else if (pose === 'shovel') u = fract(q.t * 0.42);
		else if (pose === 'guide') u = fract(q.t);
		else if (pose === 'lay') u = fract(q.t * 0.3);
		if (A2) M.act(A2, u);
		M.setPose(pose === 'idle' ? (P.dna.seed % 2 ? 'hip' : 'rest') : 'rest');
		// talking among themselves: the mouth by turns, a gesture now and then; a glance at you
		if (pose === 'talk') {
			b.talkT += dt;
			const turn = Math.sin(b.talkT * 0.33 + (P.dna.seed % 7)) > 0;
			S.talk = turn && Math.sin(b.talkT * 1.1) > -0.3 ? 1 : 0;
			b.gT -= dt;
			if (b.gT < 0) { b.gT = 2.5 + Math.random() * 4; if (Math.random() < 0.6) M.gesture((turn ? ['explain', 'point', 'open', 'shrug'] : ['nod', 'laugh', 'nod'])[Math.floor(Math.random() * (turn ? 4 : 3))]); }
		} else S.talk = 0;
		S.look.target = camD < 6 && (pose === 'talk' || pose === 'idle' || pose === 'walk') ? cam : null;
		M.update(dt, time, cam);
		P.lod?.(camD);
		placeTool(b, TOOL_OF[pose] || null, u);
	}

	function dispose() {
		stopTalk();
		for (const b of [...bodies.values()]) drop(b);
		group.removeFromParent();
	}
	const info = () => [...bodies.values()].map((b) => ({ key: b.key, fade: +b.fade.toFixed(2), leaving: b.leaving, pose: b.pose, tool: b.toolKind, engaged: !!b.engaged, job: b.P.job, x: +b.M.S.pos.x.toFixed(1), z: +b.M.S.pos.z.toFixed(1) }));
	return { group, begin, offer, end, dispose, info, bodies, limit: LIMIT, near: NEAR };
}
function hashKey(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
