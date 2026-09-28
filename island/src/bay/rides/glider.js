// The Sky Glider: a chairlift the length of the Boardwalk, over the edge of the beach from
// one station to the other. Two-seat chairs on a loop of cable round a bullwheel at each
// end, over steel towers, sagging between them; the chair dips to the platform to be
// boarded, swings a little as it lifts off, and carries you along over the promenade with
// the midway on one side and the surf on the other.

import * as THREE from 'three';
import { DECK, merger, bulbs, paint } from './kit.js';

const SPEED = 2.0, SPACING = 14, WHEEL = 1.6, DROP = 2.6;
const COLS = ['blue', 'yellow', 'red', 'green'];

export function createGlider({ group, sound, isPhone, from: [X0, VL], to: [X1] }) {
	const root = new THREE.Group();
	root.name = 'sky-glider';
	group.add(root);
	const lineV = [VL + WHEEL, VL - WHEEL];                 // out along the sea side, back along the midway side
	const LEN = X1 - X0;
	const TOWERS = [];
	for (let x = X0 + 22; x < X1 - 15; x += 38) TOWERS.push(x);
	// the cable's height along the line: low at the stations, over each tower, sagging between
	function cableY(x) {
		const toS = Math.min(x - X0, X1 - x);
		const rise = Math.min(1, Math.max(0, toS / 22));
		const eased = rise * rise * (3 - 2 * rise);
		let sag = 0;
		for (let i = 0; i < TOWERS.length - 1; i++) if (x > TOWERS[i] && x < TOWERS[i + 1]) { const t = (x - TOWERS[i]) / (TOWERS[i + 1] - TOWERS[i]); sag = Math.sin(t * Math.PI) * 0.9; }
		return DECK + 3.3 + eased * (7.2 - sag);
	}
	const LOOP = 2 * LEN + 2 * Math.PI * WHEEL;
	// a point on the loop: position, heading and which way round
	function at(p, out) {
		p = ((p % LOOP) + LOOP) % LOOP;
		if (p < LEN) { const x = X0 + p; out.x = x; out.v = lineV[0]; out.h = Math.PI / 2; }
		else if (p < LEN + Math.PI * WHEEL) { const a = (p - LEN) / WHEEL; out.x = X1 + Math.sin(a) * WHEEL; out.v = VL + Math.cos(a) * WHEEL; out.h = Math.PI / 2 - a; }
		else if (p < 2 * LEN + Math.PI * WHEEL) { const x = X1 - (p - LEN - Math.PI * WHEEL); out.x = x; out.v = lineV[1]; out.h = -Math.PI / 2; }
		else { const a = (p - 2 * LEN - Math.PI * WHEEL) / WHEEL; out.x = X0 - Math.sin(a) * WHEEL; out.v = VL - Math.cos(a) * WHEEL; out.h = -Math.PI / 2 - a; }
		out.y = cableY(Math.max(X0, Math.min(X1, out.x)));
		return out;
	}
	// ---------- towers, stations, cable ----------
	const Mg = merger(), lights = bulbs();
	for (const x of TOWERS) {
		const top = cableY(x) + 0.35;
		Mg.box(0.5, top - DECK + 0.4, 0.5, 'steel', x, (DECK - 0.4 + top) / 2, VL);
		Mg.box(0.3, 0.3, WHEEL * 2 + 1.2, 'steel', x, top, VL);
		for (const v of lineV) { Mg.box(1.4, 0.18, 0.18, 'darksteel', x, top - 0.25, v); lights.add(x, top + 0.25, v); }
		Mg.box(1.4, 0.3, 1.4, 'concrete', x, DECK - 0.25, VL);
	}
	for (const [x, sg] of [[X0, -1], [X1, 1]]) {
		// the station: the bullwheel under its roof, the loading platform
		const y = DECK + 3.3;
		Mg.cyl(WHEEL, WHEEL, 0.2, 'darksteel', x, y + 0.1, VL, 24);
		Mg.cyl(0.25, 0.25, 1.2, 'steel', x, y + 0.7, VL, 10);
		for (const du of [-3, 3]) for (const dv of [-3.2, 3.2]) Mg.box(0.3, 5.2, 0.3, 'white', x + sg * 1 + du, DECK + 2.6, VL + dv);
		Mg.box(8.6, 0.3, 7.6, 'red', x + sg * 1, DECK + 5.3, VL);
		Mg.geo(new THREE.ConeGeometry(6.2, 1.6, 4, 1), 'white', x + sg * 1, DECK + 6.25, VL, 0, Math.PI / 4);
		Mg.box(7, 0.3, 2.4, 'plank', x - sg * 1.5, DECK + 0.15, VL + WHEEL);
		Mg.box(7, 0.3, 2.4, 'plank', x - sg * 1.5, DECK + 0.15, VL - WHEEL);
		for (let i = 0; i <= 16; i++) lights.add(x + sg * 1 - 4.3 + i * 8.6 / 16, DECK + 5.05, VL + 3.85);
	}
	Mg.done(root, { shadow: !isPhone });
	// the cable: two lines of rope, sagging, and the bullwheels' ends
	{
		const pts = [], o = {};
		for (let p = 0; p <= LOOP; p += 1.5) { at(p, o); pts.push(new THREE.Vector3(o.x, o.y + 0.02, o.v)); }
		const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), pts.length, 0.03, 4, true), paint('darksteel'));
		root.add(rope);
	}
	const lit = lights.done(root, 0.8);
	// ---------- the chairs ----------
	const n = Math.floor(LOOP / SPACING);
	const chairs = [];
	const chairGeo = (c) => {
		const g = new THREE.Group(), C = merger();
		C.rod([0, 0, 0], [0, -DROP + 0.9, 0], 0.035, 'steel');
		C.rod([0, -DROP + 0.9, 0], [-0.55, -DROP + 0.55, -0.1], 0.03, 'steel').rod([0, -DROP + 0.9, 0], [0.55, -DROP + 0.55, -0.1], 0.03, 'steel');
		C.box(1.25, 0.08, 0.5, c, 0, -DROP, 0.05).box(1.25, 0.55, 0.07, c, 0, -DROP + 0.3, -0.22);
		C.rod([-0.62, -DROP + 0.55, -0.1], [-0.62, -DROP, -0.1], 0.025, 'steel').rod([0.62, -DROP + 0.55, -0.1], [0.62, -DROP, -0.1], 0.025, 'steel');
		// the safety bar across the front and the footrest
		C.rod([-0.6, -DROP + 0.3, 0.4], [0.6, -DROP + 0.3, 0.4], 0.02, 'chrome').rod([-0.6, -DROP + 0.3, 0.4], [-0.62, -DROP + 0.5, -0.05], 0.02, 'chrome').rod([0.6, -DROP + 0.3, 0.4], [0.62, -DROP + 0.5, -0.05], 0.02, 'chrome');
		C.rod([-0.4, -DROP - 0.4, 0.45], [0.4, -DROP - 0.4, 0.45], 0.02, 'chrome');
		C.box(0.2, 0.2, 0.3, 'darksteel', 0, 0.05, 0);
		C.done(g, { shadow: false });
		return g;
	};
	for (let i = 0; i < n; i++) { const g = chairGeo(COLS[i % COLS.length]); root.add(g); chairs.push({ g, sw: 0, sv: 0, prevY: 0 }); }
	const S = { p: 0, rider: -1, done: false, stop: 0 };
	const o = {};
	function place(dt) {
		for (let i = 0; i < n; i++) {
			const C = chairs[i];
			at(S.p + i * (LOOP / n), o);
			// it swings as the rope's slope changes under it
			const dy = (o.y - C.prevY) / Math.max(dt, 1e-3); C.prevY = o.y;
			C.sv += (-C.sw * 3.2 - C.sv * 0.8 - (dy - (C.dy0 || 0)) * 0.6) * dt; C.dy0 = dy;
			C.sw = Math.max(-0.25, Math.min(0.25, C.sw + C.sv * dt));
			C.g.position.set(o.x, o.y, o.v);
			C.g.rotation.set(C.sw, o.h, 0, 'YXZ');
		}
	}
	// ---------- riding: board at the west station, off at the east ----------
	const eye = new THREE.Vector3(), cq = new THREE.Quaternion(), tq = new THREE.Quaternion(), m4 = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
	let camInit = false;
	function begin() {
		// the next chair round the west bullwheel onto the outbound line is yours
		let best = 0, bd = 1e9;
		for (let i = 0; i < n; i++) { const p = ((S.p + i * (LOOP / n)) % LOOP + LOOP) % LOOP; const d = (LOOP - p) % LOOP; if (d < bd) { bd = d; best = i; } }
		S.rider = best; S.done = false; camInit = false;
		// (the lift is started so the chair is at the platform)
		S.p = -best * (LOOP / n) + 0.2;
		return true;
	}
	function pose(dt, t, out) {
		S.p += SPEED * dt; place(dt);
		const C = chairs[S.rider];
		const pp = ((S.p + S.rider * (LOOP / n)) % LOOP + LOOP) % LOOP;
		if (pp > LEN - 0.5) S.done = true;
		m4.compose(C.g.position, new THREE.Quaternion().setFromEuler(C.g.rotation), new THREE.Vector3(1, 1, 1));
		eye.set(-0.3, -DROP + 0.82, 0.02).applyMatrix4(m4);
		out.pos.copy(eye);
		tq.setFromEuler(C.g.rotation).multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI - 0.35)).multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.18));
		if (!camInit) { cq.copy(tq); camInit = true; }
		cq.slerp(tq, Math.min(1, dt * 5));
		out.quat.copy(cq);
		out.fov = 70;
		// the rattle over each tower's sheaves
		for (const x of TOWERS) if (Math.abs(C.g.position.x - x) < SPEED * dt) for (let k = 0; k < 4; k++) sound.click(0.12, 700, 3, 0.05, k * 0.09);
		return !S.done;
	}
	const riders = {
		count: n * 2,
		at(i, m) {
			const k = Math.floor(i / 2);
			if (k === S.rider && i % 2 === 0) return null;
			if ((k * 5 + i) % 3 === 0) return null;
			const C = chairs[k];
			m.compose(C.g.position, new THREE.Quaternion().setFromEuler(C.g.rotation), new THREE.Vector3(1, 1, 1));
			return m.multiply(m4.makeTranslation(i % 2 ? 0.3 : -0.3, -DROP - 0.46, 0.05));
		},
		sit: 0.5, pose: 'lap',
	};
	return {
		id: 'glider', name: 'Sky Glider', icon: 'glider', root,
		blurb: 'A chairlift the length of the Boardwalk, over the edge of the beach',
		board: { u: X0 - 2, v: VL + WHEEL + 2.4, r: 3 }, exit: { u: X1 - 3, v: VL + WHEEL + 3, yaw: Math.PI },
		lights: lit,
		solid: [],
		update(dt) { if (S.rider < 0) { S.p += SPEED * dt; place(dt); } },
		begin, pose, riders,
		status() { const C = chairs[S.rider]; return C ? `${Math.round((C.g.position.y - DROP - DECK) * 3.28)} ft over the promenade` : ''; },
		end() { S.rider = -1; S.done = false; },
		dispose() { root.traverse((q) => q.geometry?.dispose()); },
	};
}
