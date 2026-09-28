// The rest of the midway, seen and heard rather than ridden: the chair swings flying out
// round their tower, the Tilt-A-Whirl's tubs spinning on their hilly floor, the log flume
// climbing and splashing down, the Haunted Castle, the Cave Train's mountain, the bowling
// alley, the palms and the tables of the food court.

import * as THREE from 'three';
import { DECK, merger, instancer, bulbs, paint, signBoard, sweep, rng } from './kit.js';


// ---------- the chair swings ----------
export function createSwings({ group, isPhone, at: [U, V] }) {
	const root = new THREE.Group();
	root.position.set(U, 0, V);
	group.add(root);
	const Mg = merger(), lights = bulbs();
	Mg.cyl(0.6, 0.9, 11, 'white', 0, DECK + 5.5, 0, 12).cyl(4.5, 4.8, 0.4, 'concrete', 0, DECK + 0.2, 0, 24);
	Mg.done(root, { shadow: !isPhone });
	const top = new THREE.Group();
	top.position.y = DECK + 10.5;
	root.add(top);
	const T = merger();
	T.geo(new THREE.ConeGeometry(6.4, 2.2, 24, 1, true), 'red', 0, 1.1, 0).cyl(6.4, 6.4, 0.7, 'yellow', 0, -0.2, 0, 24);
	for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; lights.add(Math.sin(a) * 6.45, -0.2, Math.cos(a) * 6.45); }
	T.done(top, { shadow: !isPhone });
	lights.done(top, 0.8);
	const N = 24, chairs = [];
	for (let i = 0; i < N; i++) {
		const c = new THREE.Group(), C = merger();
		C.rod([-0.25, 0, 0], [-0.25, -5, 0], 0.012, 'chrome').rod([0.25, 0, 0], [0.25, -5, 0], 0.012, 'chrome');
		C.box(0.5, 0.06, 0.5, i % 2 ? 'blue' : 'yellow', 0, -5.1, 0).box(0.5, 0.5, 0.05, i % 2 ? 'blue' : 'yellow', 0, -4.85, -0.25);
		C.done(c, { shadow: false });
		top.add(c);
		chairs.push(c);
	}
	const S = { w: 0, ang: 0, t: Math.random() * 60 };
	return {
		root,
		update(dt) {
			S.t += dt;
			const run = S.t % 90 < 65;
			S.w += ((run ? 1.25 : 0) - S.w) * Math.min(1, dt * 0.25);
			S.ang += S.w * dt;
			top.rotation.y = S.ang;
			top.rotation.z = Math.sin(S.ang * 0.35) * 0.08 * (S.w / 1.25);
			// out on their chains as it gathers speed
			const R0 = 6.0, out = Math.atan(S.w * S.w * (R0 + 2) / 9.81);
			top.position.y = DECK + 10.5 + (S.w / 1.25) * 1.2;
			for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, c = chairs[i]; c.position.set(Math.sin(a) * R0, -0.3, Math.cos(a) * R0); c.rotation.set(0, a + Math.PI / 2, 0); c.rotateZ(-out); }
		},
		riders: {
			count: N,
			at(i, m) {
				if (i % 3 === 2) return null;
				const c = chairs[i];
				c.updateWorldMatrix(true, false);
				m.copy(c.matrixWorld);
				m.premultiply(new THREE.Matrix4().copy(group.matrixWorld).invert());
				return m.multiply(new THREE.Matrix4().makeTranslation(0, -5.55, 0.05)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
			},
			sit: 0.45, pose: 'lap',
		},
		round: [[U, V, 4.9]],
	};
}

// ---------- the Tilt-A-Whirl ----------
export function createTilt({ group, isPhone, at: [U, V] }) {
	const root = new THREE.Group();
	root.position.set(U, 0, V);
	group.add(root);
	const Mg = merger();
	Mg.cyl(10.2, 10.4, 0.6, 'darksteel', 0, DECK + 0.3, 0, 32);
	for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; Mg.box(0.06, 1.0, 0.06, 'chrome', Math.sin(a) * 11.2, DECK + 0.5, Math.cos(a) * 11.2); }
	Mg.done(root, { shadow: !isPhone });
	const plat = new THREE.Group();
	plat.position.y = DECK + 0.65;
	root.add(plat);
	const P = merger();
	P.cyl(9.6, 9.6, 0.15, 'plank', 0, 0, 0, 32);
	P.done(plat, { shadow: false });
	const cars = [];
	const COL = ['red', 'blue', 'yellow', 'green', 'orange', 'purple', 'teal'];
	for (let i = 0; i < 7; i++) {
		const g = new THREE.Group(), C = merger();
		C.geo(new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI, 0, Math.PI / 2), COL[i], 0, 0.2, 0, 0, Math.PI / 2);
		C.cyl(1.55, 1.55, 0.5, COL[i], 0, 0.25, 0, 20).box(2.4, 0.4, 0.8, 'seat', 0, 0.6, -0.6);
		C.done(g, { shadow: !isPhone });
		plat.add(g);
		cars.push({ g, a: i / 7 * Math.PI * 2, spin: 0, sv: 0 });
	}
	const S = { ang: 0, t: Math.random() * 80 };
	return {
		root,
		update(dt) {
			S.t += dt;
			const w = S.t % 80 < 55 ? 0.7 : 0;
			S.ang += w * dt;
			for (const c of cars) {
				// over the humps: each tub whirls one way and then the other
				const a = c.a + S.ang, hill = Math.sin(a * 3);
				c.sv += (hill * 3.2 * w - c.sv * 0.6) * dt;
				c.spin += c.sv * dt;
				c.g.position.set(Math.sin(a) * 6.5, 0.2 + hill * 0.35, Math.cos(a) * 6.5);
				c.g.rotation.set(Math.cos(a * 3) * 0.08, c.spin, 0);
			}
		},
		round: [[U, V, 11.2]],
	};
}

// ---------- the log flume: a trough on stilts round a loop, a lift, the big splash ----------
export function createFlume({ group, isPhone, sound }) {
	const root = new THREE.Group();
	group.add(root);
	const P = [[150, -150, 1.2], [182, -152, 1.2], [194, -140, 1.5], [192, -122, 4], [192, -104, 12.5], [190, -92, 13], [178, -86, 12.6], [162, -90, 12.2], [152, -102, 11.8], [150, -118, 11.3], [158, -130, 10.5], [170, -128, 10], [176, -116, 9.6], [172, -104, 9.2], [160, -104, 8.8], [156, -114, 5], [156, -122, 1.6], [150, -134, 1.2]];
	const curve = new THREE.CatmullRomCurve3(P.map(([u, v, h]) => new THREE.Vector3(u, DECK + h, v)), true, 'centripetal');
	const L = curve.getLength(), n = Math.ceil(L / 1.5);
	const F = [];
	const up = new THREE.Vector3(0, 1, 0);
	for (let i = 0; i <= n; i++) {
		const t = i / n, p = curve.getPointAt(t % 1), tg = curve.getTangentAt(t % 1);
		const b = new THREE.Vector3().crossVectors(up, tg).normalize(), nn = new THREE.Vector3().crossVectors(tg, b).normalize();
		F.push({ p, t: tg, b, n: nn });
	}
	const Mg = merger();
	Mg.mat(sweep(F, [[-1.2, 1.0], [-1.2, 0], [1.2, 0], [1.2, 1.0]]), 'darkwood', new THREE.Matrix4());
	const wm = new THREE.MeshStandardMaterial({ color: 0x2f7d8e, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
	const water = new THREE.Mesh(sweep(F, [[-1.1, 0.45], [1.1, 0.45]]), wm);
	root.add(water);
	const posts = instancer(new THREE.BoxGeometry(0.25, 1, 0.25), paint('darkwood'));
	for (let i = 0; i < F.length; i += 3) { const q = F[i].p, h = q.y - DECK; if (h > 1) for (const s of [-1, 1]) posts.at(q.x + F[i].b.x * s, DECK + h / 2, q.z + F[i].b.z * s, 1, h, 1); }
	// the splash pool at the foot of the drop, the mill-house at the top
	Mg.box(10, 1.2, 14, 'concrete', 156, DECK + 0.6, -124);
	Mg.box(8, 6, 7, 'wood', 186, DECK + 16, -96).geo(new THREE.ConeGeometry(6.2, 3, 4), 'darkwood', 186, DECK + 20.5, -96, 0, Math.PI / 4);
	Mg.done(root, { shadow: !isPhone });
	posts.done(root);
	const sign = signBoard('LOGGER\'S REVENGE', 8, 1.2, { bg: '#4a3526', fg: '#f4e2b8', border: '#c9a449', glow: 0.25 });
	sign.position.set(186, DECK + 17.5, -92.4);
	root.add(sign);
	const logs = [];
	for (let i = 0; i < 6; i++) {
		const g = new THREE.Group(), C = merger();
		C.cyl(0.7, 0.7, 3.4, 'wood', 0, 0.55, 0, 10, Math.PI / 2).box(0.9, 0.4, 2.2, 'darkwood', 0, 1.0, 0);
		C.done(g, { shadow: false });
		root.add(g);
		logs.push({ g, s: i / 6 * L });
	}
	const spray = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 0.3 }));
	spray.position.set(156, DECK + 1.5, -121);
	root.add(spray);
	let splash = 0;
	return {
		root,
		update(dt, t, info) {
			for (const lg of logs) {
				const u = (lg.s % L) / L, tg = curve.getTangentAt(u);
				// the lift pulls at a walk; down the chute it runs
				const sp = tg.y > 0.15 ? 1.6 : tg.y < -0.2 ? 9 : 2.6;
				const before = lg.s;
				lg.s += sp * dt;
				const p = curve.getPointAt((lg.s % L) / L);
				lg.g.position.set(p.x, p.y + 0.05, p.z);
				lg.g.lookAt(p.x + tg.x, p.y + tg.y, p.z + tg.z);
				// landing in the pool
				if (tg.y < -0.2 && curve.getTangentAt(((lg.s + 3) % L) / L).y > -0.1 && Math.floor(before / L * 40) !== Math.floor(lg.s / L * 40)) { splash = 1; if (info.near < 150) for (let k = 0; k < 5; k++) sound.click(0.25 * (1 - info.near / 150), 500 + k * 400, 0.6, 0.5, k * 0.04); }
			}
			splash = Math.max(0, splash - dt * 0.8);
			spray.scale.set(2 + splash * 3, 0.5 + splash * 4, 2 + splash * 3);
			spray.material.opacity = splash * 0.55;
		},
		solid: [[146, -156, 198, -84]],
	};
}

// ---------- buildings at the back of the midway ----------
export function buildBackRow({ group, isPhone }) {
	const Mg = merger(), out = { solid: [], signs: [] };
	// the Haunted Castle: grey stone walls, round towers with their cone roofs
	{
		const u0 = -44, u1 = -8, v0 = -168, v1 = -128;
		Mg.box(u1 - u0, 9, v1 - v0, 'darksteel', (u0 + u1) / 2, DECK + 4.5, (v0 + v1) / 2);
		for (let u = u0; u <= u1; u += 2.4) Mg.box(1.2, 1.1, 0.8, 'darksteel', u, DECK + 9.5, v1 - 0.4);
		for (const u of [u0, u1]) { Mg.cyl(3, 3, 13, 'steel', u, DECK + 6.5, v1, 16); Mg.geo(new THREE.ConeGeometry(3.6, 5, 16), 'purple', u, DECK + 15.5, v1); }
		Mg.geo(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 16, 1, false, 0, Math.PI), 'black', (u0 + u1) / 2, DECK + 3, v1 + 0.3, Math.PI / 2, 0, 0).box(4.8, 3, 0.6, 'black', (u0 + u1) / 2, DECK + 1.5, v1 + 0.3);
		const s = signBoard('HAUNTED CASTLE', 12, 1.6, { bg: '#2a1a3a', fg: '#c8f080', border: '#6a3c9a', glow: 0.35 });
		s.position.set((u0 + u1) / 2, DECK + 7, v1 + 0.35);
		group.add(s); out.signs.push(s);
		out.solid.push([u0 - 3, v0, u1 + 3, v1 + 3]);
	}
	// the Cave Train's mountain: rocky, a tunnel mouth, pines on its shoulders
	{
		const cu = 28, cv = -150;
		const rock = new THREE.IcosahedronGeometry(1, 3);
		const pa = rock.attributes.position, r = rng(11);
		for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = 0.85 + r() * 0.3; pa.setXYZ(i, x * k, Math.max(-0.05, y) * k, z * k); }
		rock.computeVertexNormals();
		rock.scale(22, 11, 13);
		Mg.geo(rock, 'rock', cu, DECK - 0.3, cv);
		Mg.box(5, 4, 3, 'black', cu, DECK + 2, cv + 12.2);
		const s = signBoard('CAVE TRAIN', 8, 1.3, { bg: '#4a3526', fg: '#ffe9a0', border: '#c9a449', glow: 0.3 });
		s.position.set(cu, DECK + 5, cv + 13.9);
		group.add(s); out.signs.push(s);
		out.solid.push([cu - 21, cv - 13, cu + 21, cv + 12.5]);
	}
	// the bowling alley and arcade: a long streamline block with its sign on the roof
	{
		const u0 = 68, u1 = 132, v0 = -172, v1 = -138;
		Mg.box(u1 - u0, 7.5, v1 - v0, 'cream', (u0 + u1) / 2, DECK + 3.75, (v0 + v1) / 2);
		Mg.box(u1 - u0 + 0.4, 0.8, 0.4, 'teal', (u0 + u1) / 2, DECK + 7.2, v1 + 0.2).box(u1 - u0 - 4, 2.6, 0.2, 'glass', (u0 + u1) / 2, DECK + 1.6, v1 + 0.12);
		const s = signBoard('BOARDWALK BOWL', 14, 2, { bg: '#1e8c8c', fg: '#ffffff', border: '#f2c230', glow: 0.35 });
		s.position.set((u0 + u1) / 2, DECK + 9.3, v1 - 1);
		group.add(s); out.signs.push(s);
		Mg.box(0.3, 2.4, 0.3, 'white', (u0 + u1) / 2 - 5, DECK + 8, v1 - 1.2).box(0.3, 2.4, 0.3, 'white', (u0 + u1) / 2 + 5, DECK + 8, v1 - 1.2);
		out.solid.push([u0, v0, u1, v1]);
	}
	// the food court: tables under umbrellas, a stand along each side
	const tables = instancer(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 12), paint('white'));
	const legs = instancer(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), paint('darksteel'));
	const umbs = instancer(new THREE.ConeGeometry(1.4, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
	const r = rng(3), UC = [0xd8262e, 0x2a64c8, 0xf2c230, 0x2e9b57];
	const seats = [];
	for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
		const u = 96 + i * 5.2, v = -112 + j * 5.5 + (i % 2) * 1.2;
		tables.at(u, DECK + 0.76, v); legs.at(u, DECK + 0.38, v); umbs.at(u, DECK + 2.5, v, 1, 1, 1, 0, new THREE.Color(UC[Math.floor(r() * UC.length)]));
		Mg.cyl(0.03, 0.03, 2.4, 'white', u, DECK + 1.2, v, 5);
		for (const a of [0, Math.PI]) { Mg.box(0.42, 0.06, 0.42, 'red', u + Math.sin(a) * 0.9, DECK + 0.45, v + Math.cos(a) * 0.9); seats.push({ u: u + Math.sin(a) * 0.9, v: v + Math.cos(a) * 0.9, heading: a + Math.PI }); }
	}
	tables.done(group); legs.done(group); umbs.done(group);
	out.seats = seats;
	// palms: the tall Washingtonias along the back and round the plazas
	const trunkG = new THREE.CylinderGeometry(0.2, 0.32, 1, 7, 6);
	const trunks = instancer(trunkG, new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 0.95 }));
	const frondG = palmCrown();
	const crowns = instancer(frondG, new THREE.MeshStandardMaterial({ color: 0x4d6b2e, roughness: 0.8, side: THREE.DoubleSide }));
	const palms = [[-150, -80], [-144, -110], [-120, -80], [-60, -80], [-20, -60], [-52, -100], [60, -100], [92, -125], [135, -125], [140, -92], [200, -170], [-240, -90], [-200, -95], [-170, -120], [-100, -120], [-80, -160], [2, -90], [-260, -150], [-220, -150], [240, -172], [290, -172], [330, -172]];
	for (const [u, v] of palms) { const h = 11 + r() * 7; trunks.at(u, DECK + h / 2, v, 1, h, 1); crowns.at(u, DECK + h, v, 1, 1, 1, r() * 6); out.solid.push([u - 0.4, v - 0.4, u + 0.4, v + 0.4]); }
	trunks.done(group); crowns.done(group);
	Mg.done(group, { shadow: !isPhone, paints: { rock: new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 1, flatShading: true }) } });
	return out;
}
function palmCrown() {
	const parts = [];
	for (let i = 0; i < 14; i++) {
		const a = i / 14 * Math.PI * 2, droop = 0.35 + (i % 3) * 0.25;
		const g = new THREE.PlaneGeometry(0.7, 3.4, 1, 4);
		const p = g.attributes.position;
		for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 1.7; p.setXYZ(k, p.getX(k) * (1 - y / 4), 0, y); p.setY(k, -y * y * droop * 0.18); }
		g.rotateY(a);
		parts.push(g);
	}
	const out = new THREE.BufferGeometry();
	const pos = [], idx = [];
	let off = 0;
	for (const g of parts) { const p = g.attributes.position.array; pos.push(...p); for (const i of g.index.array) idx.push(i + off); off += p.length / 3; }
	out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	out.setIndex(idx);
	out.computeVertexNormals();
	return out;
}
