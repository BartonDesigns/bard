// The Giant Dipper (1924, Arthur Looff's wooden coaster by Frank Prior and Frederick Church):
// white-painted timber lattice at the east end of the Boardwalk, red trains, a half-mile
// double out and back. Out of the station into the pitch-dark tunnel, round onto the
// seven-storey lift hill with the chain clacking under you, a turn at the top, the 65-foot
// plunge into the first fan turn, then the camelbacks out and back twice and the brakes.
// The train runs on its own physics: gravity down the grades, the rolling friction of the
// wheels on the wood and the wind against the riders, the chain on the lift, tyres in the
// station and the brakes at the end; the track is banked for the speed it is taken at.

import * as THREE from 'three';
import { DECK, merger, instancer, bulbs, paint, signBoard, sweep } from './kit.js';

const G = 9.81, MU = 0.012, DRAG = 0.00055;
const CAR_L = 2.9, CAR_GAP = 3.1, CARS = 4, CHAIN = 2.9;

// the layout, point by point: [u, v, height above the midway, section]
// (sections: tyres in the station, the tunnel, the chain lift, free running, the brakes)
const PTS = [
	[212, -38, 0.3, 'station'], [212, -52, 0.3, 'tyres'], [212, -64, 0.2, 'tunnel'], [212, -84, -0.3, 'tunnel'], [212.5, -104, -0.3, 'tunnel'], [215, -122, 0.4, 'tyres'],
	[224, -140, 1.2, 'tyres'], [238, -150, 1.8, 'lift'], [252, -150, 3.2, 'lift'], [262, -150, 7.2, 'lift'], [282, -150, 16.3, 'lift'], [294, -150, 21.4, 'lift'], [302, -150, 22.4, 'free'],
	[313, -147, 22.5, 'free'], [320, -140, 22.1, 'free'], [323.5, -130, 20.6, 'free'],
	[324, -121, 16.8, 'free'], [324, -112, 10.8, 'free'], [324, -103, 5.4, 'free'], [324, -94, 2.2, 'free'], [324, -85, 1.2, 'free'], [324, -76, 2.0, 'free'], [324, -67, 4.6, 'free'], [323, -57, 8.2, 'free'],
	[318, -45, 9.8, 'free'], [307, -39, 9.9, 'free'], [298, -47, 9.0, 'free'],
	[297, -58, 6.6, 'free'], [297, -67, 3.6, 'free'], [297, -76, 2.4, 'free'], [297, -85, 3.8, 'free'], [297, -95, 6.4, 'free'], [297, -105, 5.6, 'free'], [297, -114, 4.8, 'free'], [296, -123, 6.0, 'free'],
	[293, -132, 7.2, 'free'], [284, -138, 7.2, 'free'], [275, -132, 6.8, 'free'],
	[272, -122, 5.4, 'free'], [272, -113, 3.2, 'free'], [272, -104, 2.4, 'free'], [272, -95, 3.4, 'free'], [272, -86, 5.0, 'free'], [272, -77, 4.4, 'free'], [272, -68, 3.2, 'free'], [272, -59, 3.8, 'free'],
	[270, -48, 4.6, 'free'], [262, -38, 4.6, 'free'], [251, -44, 4.2, 'free'],
	[248, -54, 3.2, 'free'], [248, -62, 2.2, 'free'], [248, -70, 3.1, 'free'], [248, -78, 2.0, 'free'], [248, -86, 2.9, 'free'], [248, -94, 1.8, 'free'], [248, -102, 2.1, 'free'],
	[246, -110, 2.2, 'brake'], [238, -121, 2.1, 'brake'], [229, -114, 1.8, 'brake'], [228, -96, 1.2, 'brake'], [228, -66, 0.8, 'brake'], [228, -40, 0.5, 'brake'],
	[226, -26, 0.4, 'station'], [219, -20, 0.3, 'station'], [213, -26, 0.3, 'station'],
];

// the track sampled every half metre: position, heading frame, bank, section
export function buildTrack() {
	const N = PTS.length;
	const ctrl = PTS.map(([u, v, h]) => new THREE.Vector3(u, DECK + 0.9 + h, v));
	const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
	// dense samples by the curve's own parameter, then evened out by length
	const M = N * 60, raw = [], rawT = [];
	for (let i = 0; i <= M; i++) { const t = i / M; raw.push(curve.getPoint(t)); rawT.push(t); }
	const acc = [0];
	for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + raw[i].distanceTo(raw[i - 1]));
	const L = acc[M], STEP = 0.5, n = Math.round(L / STEP), step = L / n;
	const S = [];
	let j = 0;
	for (let k = 0; k < n; k++) {
		const s = k * step;
		while (acc[j + 1] < s) j++;
		const f = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
		const p = raw[j].clone().lerp(raw[j + 1], f), t = rawT[j] + (rawT[j + 1] - rawT[j]) * f;
		S.push({ s, p, sect: PTS[Math.floor(t * N) % N][3] });
	}
	// tangents, headings and the grade
	for (let k = 0; k < n; k++) {
		const a = S[(k - 1 + n) % n].p, b = S[(k + 1) % n].p;
		S[k].t = b.clone().sub(a).normalize();
		S[k].psi = Math.atan2(S[k].t.x, S[k].t.z);
	}
	const T = { S, L, n, step, curve };
	// how fast each part is taken (a run with no banking yet), then the bank for that speed
	const prof = simulate(T);
	const raw2 = new Float32Array(n);
	for (let k = 0; k < n; k++) {
		let dpsi = S[(k + 2) % n].psi - S[(k - 2 + n) % n].psi;
		dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
		const kap = dpsi / (4 * step), v = Math.max(prof[k], 3);
		raw2[k] = Math.max(-0.95, Math.min(0.95, -Math.atan(v * v * kap / G) * 0.85));
		S[k].kap = kap;
	}
	for (let k = 0; k < n; k++) {
		let a = 0, w = 0;
		for (let d = -10; d <= 10; d++) { const q = 1 - Math.abs(d) / 11; a += raw2[(k + d + n) % n] * q; w += q; }
		S[k].bank = a / w;
		S[k].vd = prof[k];
	}
	// the frame: n up through the car's floor, b to the rider's left (b, n, t turn the right way round)
	const up = new THREE.Vector3();
	for (const F of S) {
		F.b = new THREE.Vector3().crossVectors(up.set(0, 1, 0), F.t).normalize();          // the rider's left, level
		F.n = new THREE.Vector3().crossVectors(F.t, F.b).normalize();                       // up, square to the track
		F.b.applyAxisAngle(F.t, F.bank); F.n.applyAxisAngle(F.t, F.bank);
	}
	// where each section starts and ends
	T.range = {};
	for (let k = 0; k < n; k++) { const R = T.range[S[k].sect] || (T.range[S[k].sect] = []); R.push(k); }
	T.stationS = 0;
	return T;
}

// one lap: the speed at every sample, for banking and for trying the layout out
export function simulate(T, opts = {}) {
	const { S, n, step } = T;
	const v = new Float32Array(n);
	let s = 0, sp = 0, t = 0, k0 = 0, minFree = 1e9;
	const dt = 1 / 60;
	while (s < T.L - 1 && t < 400) {
		const k = Math.min(n - 1, Math.floor(s / step));
		sp = accel(S, k, sp, dt, opts.mu ?? MU, opts.drag ?? DRAG);
		if (S[k].sect === 'free' && sp < minFree) minFree = sp;
		for (let q = k0; q <= k; q++) v[q] = sp;
		k0 = k + 1;
		s += sp * dt; t += dt;
	}
	v.lapTime = t; v.minFree = minFree;
	return v;
}
// the speed a moment later, from where the train is on the track
function accel(S, k, v, dt, mu, drag) {
	const F = S[k], sect = F.sect;
	if (sect === 'lift') return Math.max(v - 0.5 * dt, CHAIN);                 // the chain holds it at its pace (or it runs on over)
	if (sect === 'station') return v + (Math.min(1.4, v) - v) * Math.min(1, dt * 1.5) + (v < 1.4 ? 0.8 * dt : 0);
	const grav = -G * F.t.y;
	let a = grav - mu * G - drag * v * v;
	if (sect === 'tyres' || sect === 'tunnel') { if (v < 3.2) a = Math.max(a, 1.2); if (v > 5) a = Math.min(a, -1.5); }
	if (sect === 'brake') { if (v > 3.5) a = -4.5; else if (v < 2.2) a = Math.max(a, 0.8); }
	return Math.max(0.3, v + a * dt);
}
// ---------- the ride ----------
const STATION_S = 6;              // where the front of the train stops in the station
const V3 = () => new THREE.Vector3();

export function createDipper({ group, sound, isPhone }) {
	const T = buildTrack();
	const { S, n, step, L } = T;
	const root = new THREE.Group();
	root.name = 'giant-dipper';
	group.add(root);
	const at = (s) => S[((Math.floor(s / step) % n) + n) % n];
	// the frame at any distance along, eased between the samples
	function frameAt(s, out) {
		const f = s / step, k = Math.floor(f), u = f - k;
		const A = S[((k % n) + n) % n], B = S[(((k + 1) % n) + n) % n];
		out.p.copy(A.p).lerp(B.p, u); out.t.copy(A.t).lerp(B.t, u).normalize(); out.n.copy(A.n).lerp(B.n, u).normalize();
		out.b.crossVectors(out.n, out.t).normalize();
		return out;
	}

	// ---------- the structure: white timber bents under the track, braced every way ----------
	// (in three pieces, built on the frames after the rest of the ride)
	const up = new THREE.Vector3(0, 1, 0), lights = bulbs();
	function buildBents() {
		const timber = instancer(new THREE.BoxGeometry(1, 1, 1), paint('white'), { shadow: !isPhone });
		const ties = instancer(new THREE.BoxGeometry(2.2, 0.12, 0.2), paint('darkwood'));
		const hb = V3();
		let prev = null;
		for (let k = 0; k < n; k += 5) {
			const F = S[k];
			const top = F.p.y - 0.42, hgt = top - DECK;
			if (F.sect === 'tunnel' || F.sect === 'station' || hgt < 0.5) { prev = null; continue; }
			hb.crossVectors(F.t, up).normalize();
			const wTop = 0.95, wBot = 0.95 + Math.min(2.2, hgt * 0.09);
			const post = (sg, y) => { const w = wBot + (wTop - wBot) * ((y - DECK) / hgt); return [F.p.x + hb.x * w * sg, y, F.p.z + hb.z * w * sg]; };
			timber.beam(post(-1, DECK), post(-1, top), 0.22).beam(post(1, DECK), post(1, top), 0.22);
			// ledgers every 2.2 m, crossed between
			const lv = [DECK + 0.3];
			for (let y = DECK + 2.4; y < top - 0.6; y += 2.2) lv.push(y);
			lv.push(top);
			for (let i = 0; i < lv.length; i++) {
				timber.beam(post(-1, lv[i]), post(1, lv[i]), 0.12, 0.2);
				if (i) timber.beam(post(-1, lv[i - 1]), post(1, lv[i]), 0.08, 0.14).beam(post(1, lv[i - 1]), post(-1, lv[i]), 0.08, 0.14);
			}
			// stringers along to the bent before, and a diagonal in every other bay
			if (prev && prev.k === k - 5) {
				for (let i = 0; i < lv.length; i++) for (const sg of [-1, 1]) { const q = prev.post(sg, Math.min(lv[i], prev.top)); timber.beam(q, post(sg, Math.min(lv[i], prev.top)), 0.1, 0.16); }
				if ((k / 5) % 2 === 0) for (const sg of [-1, 1]) for (let i = 1; i < lv.length; i++) if (lv[i] <= prev.top) timber.beam(prev.post(sg, lv[i - 1]), post(sg, lv[i]), 0.07, 0.12);
			}
			prev = { k, post, top };
	}
	// the ties
	for (let k = 0; k < n; k++) {
		const F = S[k];
		const m = new THREE.Matrix4().makeBasis(F.b, F.n, F.t).setPosition(F.p.x - F.n.x * 0.3, F.p.y - F.n.y * 0.3, F.p.z - F.n.z * 0.3);
		ties.add(m);
	}
	timber.done(root); ties.done(root);
	}
	// the rails with their steel caps, the catwalk with its handrail, and the bulbs
	function buildRails() {
		const Mg = merger();
		const loop = [...S, S[0]];
		for (const x of [-0.55, 0.55]) {
			Mg.mat(sweep(loop, [[x - 0.09, -0.24], [x + 0.09, -0.24], [x + 0.09, -0.02], [x - 0.09, -0.02]], true), 'plank', new THREE.Matrix4());
			Mg.mat(sweep(loop, [[x - 0.05, -0.02], [x + 0.05, -0.02], [x + 0.05, 0.02], [x - 0.05, 0.02]], true), 'steel', new THREE.Matrix4());
	}
	// (the catwalk and handrail along the outside, but not in the tunnel or the station)
	const runs = [];
	let run = null;
	for (let k = 0; k < n; k++) { const ok = S[k].sect !== 'tunnel' && S[k].sect !== 'station'; if (ok) { if (!run) runs.push(run = []); run.push(S[k]); } else run = null; }
	const posts = instancer(new THREE.BoxGeometry(0.07, 1.0, 0.07), paint('white'));
	const lights = bulbs();
	for (const R of runs) {
		if (R.length < 4) continue;
		Mg.mat(sweep(R, [[-1.75, -0.36], [-0.95, -0.36], [-0.95, -0.3], [-1.75, -0.3]], true), 'plank', new THREE.Matrix4());
		Mg.mat(sweep(R, [[-1.8, 0.62], [-1.74, 0.62], [-1.74, 0.68], [-1.8, 0.68]], true), 'white', new THREE.Matrix4());
		for (let i = 0; i < R.length; i += 5) { const F = R[i]; const m = new THREE.Matrix4().makeBasis(F.b, F.n, F.t).setPosition(F.p.x - F.b.x * 1.77 + F.n.x * 0.15, F.p.y - F.b.y * 1.77 + F.n.y * 0.15, F.p.z - F.b.z * 1.77 + F.n.z * 0.15); posts.add(m); }
		// the bulbs along both edges of the track
		for (let i = 0; i < R.length; i += 3) { const F = R[i]; for (const sg of [-1.02, 1.02]) lights.add(F.p.x + F.b.x * sg + F.n.x * 0.05, F.p.y + F.b.y * sg + F.n.y * 0.05, F.p.z + F.b.z * sg + F.n.z * 0.05); }
	}
	Mg.done(root, { shadow: !isPhone });
	posts.done(root);
	}
	function buildStation() {
		const Mg = merger();
		// the tunnel: a dark wooden shed the track dives into out of the station
		{
			const R = S.filter((F) => F.sect === 'tunnel');
			const tm = paint('tunnel').clone(); tm.side = THREE.DoubleSide;
			Mg.mat(sweep(R, [[-2.0, -1.0], [-2.0, 2.9], [2.0, 2.9], [2.0, -1.0]]), 'tunnelIn', new THREE.Matrix4());
			Mg.mat(sweep(R, [[-2.15, -1.0], [-2.15, 3.05], [2.15, 3.05], [2.15, -1.0]]), 'darkred', new THREE.Matrix4());
			root.userData.tunnelMat = tm;
	}
	// the station: platforms both sides under a long gabled roof, the sign on its gable
	{
		const u0 = 205, u1 = 219, v0 = -54, v1 = -16, y = DECK + 1.2;
		Mg.box(3.6, 1.2, v1 - v0, 'concrete', 209.1, DECK + 0.6, (v0 + v1) / 2).box(3.6, 1.2, v1 - v0, 'concrete', 214.9, DECK + 0.6, (v0 + v1) / 2);
		for (let v = v0; v <= v1; v += 4.75) for (const u of [u0 + 0.3, u1 - 0.3]) Mg.box(0.25, 4.4, 0.25, 'white', u, y + 2.2, v);
		const ridge = y + 5.2, eave = y + 3.6, hw = (u1 - u0) / 2 + 0.6, span = Math.hypot(hw, ridge - eave);
		for (const sg of [-1, 1]) Mg.box(span, 0.12, v1 - v0 + 1.2, 'darkred', 212 + sg * hw / 2, (ridge + eave) / 2, (v0 + v1) / 2, 0, 0, sg * -Math.atan2(ridge - eave, hw));
		// the gable end: a white board with the name
		const gable = new THREE.Shape([new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(0, ridge - eave)]);
		Mg.geo(new THREE.ShapeGeometry(gable), 'trim', 212, eave, v1 + 0.62);
		Mg.box(u1 - u0 + 1.2, 0.5, 0.2, 'white', 212, eave - 0.2, v1 + 0.55);
		// railings along the platforms' back edges, the queue's switchbacks in front
		for (const u of [u0 + 0.1, u1 - 0.1]) Mg.box(0.06, 0.06, v1 - v0, 'chrome', u, y + 1.0, (v0 + v1) / 2);
		for (let i = 0; i < 4; i++) Mg.box(14, 0.06, 0.06, 'chrome', 212, DECK + 1.0, v1 + 2 + i * 1.3);
		for (let i = 0; i <= 7; i++) for (let j = 0; j < 4; j++) Mg.box(0.06, 1.0, 0.06, 'chrome', 205 + i * 2, DECK + 0.5, v1 + 2 + j * 1.3);
		// the stairs up from the queue
		for (let i = 0; i < 6; i++) Mg.box(2.4, 0.2, 0.3, 'concrete', 212, DECK + 0.1 + i * 0.2, v1 + 0.9 - i * 0.3);
		const sign = signBoard('GIANT DIPPER', 9, 1.6, { bg: '#b3202a', fg: '#fff6dc', border: '#f2c230', glow: 0.25 });
		sign.position.set(212, eave + 1.0, v1 + 0.75);
		root.add(sign);
		for (let i = 0; i <= 18; i++) lights.add(212 - hw + i * hw / 9, eave + (i <= 9 ? i : 18 - i) / 9 * (ridge - eave) + 0.1, v1 + 0.8);
	}
	// the big sign over the fan turn, lit in bulbs, seen from the whole beach
	{
		const sign = signBoard('GIANT DIPPER', 16, 2.8, { w: 1024, h: 180, bg: '#fff6dc', fg: '#b3202a', border: '#b3202a', font: 'bold 150px Georgia, serif', glow: 0.3 });
		sign.position.set(311, DECK + 20.6, -41.5);
		root.add(sign);
		for (const u of [304, 311, 318]) Mg.box(0.3, 7.2, 0.3, 'white', u, DECK + 15.6, -41.8);
		for (let i = 0; i <= 32; i++) { lights.add(303 + i * 0.5, DECK + 22.1, -41.3); lights.add(303 + i * 0.5, DECK + 19.1, -41.3); }
	}
	const paints = { tunnelIn: root.userData.tunnelMat };
	Mg.done(root, { shadow: !isPhone, paints });
	lights.done(root, 0.9);
	}

	// ---------- the train: four red cars, two benches of two in each ----------
	const carGroup = (lead) => {
		const g = new THREE.Group(), C = merger();
		C.box(1.05, 0.2, CAR_L - 0.2, 'darksteel', 0, 0.12, 0);
		for (const x of [-0.55, 0.55]) for (const z of [-1.0, 1.0]) C.cyl(0.13, 0.13, 0.12, 'black', x, 0.02, z, 10, 0, 0, Math.PI / 2);
		C.box(1.3, 0.08, CAR_L, 'darkred', 0, 0.3, 0);
		for (const x of [-0.64, 0.64]) {
			C.box(0.08, 0.5, CAR_L, 'red', x, 0.58, 0);
			C.box(0.1, 0.05, CAR_L + 0.02, 'gold', x, 0.84, 0);
			C.box(0.1, 0.035, CAR_L * 0.9, 'gold', x, 0.47, 0);
		}
		// the nose: rounded, higher on the lead car, with the gold trim
		const nose = new THREE.CylinderGeometry(0.68, 0.68, 0.52, 16, 1, false, -Math.PI / 2, Math.PI);
		nose.scale(1, 1, lead ? 0.55 : 0.4);
		C.geo(nose, 'red', 0, 0.57, CAR_L / 2 - 0.05);
		if (lead) C.geo(new THREE.TorusGeometry(0.68, 0.035, 5, 16, Math.PI).scale(1, lead ? 0.55 : 0.4, 1), 'gold', 0, 0.84, CAR_L / 2 - 0.05, -Math.PI / 2, Math.PI);
		C.box(1.3, 0.5, 0.08, 'red', 0, 0.58, -CAR_L / 2 + 0.04);
		for (const z of [0.55, -0.75]) {
			C.box(1.14, 0.12, 0.46, 'seat', 0, 0.46, z);
			C.box(1.14, 0.62, 0.1, 'seat', 0, 0.75, z - 0.3);
			// the lap bar: padded, across both riders
			C.rod([-0.5, 0.8, z + 0.42], [0.5, 0.8, z + 0.42], 0.045, 'black', 8);
			C.rod([-0.5, 0.8, z + 0.42], [-0.5, 0.32, z + 0.3], 0.025, 'chrome');
			C.rod([0.5, 0.8, z + 0.42], [0.5, 0.32, z + 0.3], 0.025, 'chrome');
		}
		// the grab bar on the back of the front bench
		C.rod([-0.45, 1.08, 0.23], [0.45, 1.08, 0.23], 0.025, 'chrome');
		C.done(g, { shadow: !isPhone });
		if (lead) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), bulbMat()); h.position.set(0, 0.72, CAR_L / 2 + 0.33); g.add(h); }
		return g;
	};
	const cars = [];
	for (let i = 0; i < CARS; i++) { const c = carGroup(i === 0); root.add(c); cars.push(c); }

	// ---------- the running ----------
	const R = { state: 'load', s: STATION_S, v: 0, timer: 8, rider: false, done: false, lap: 0, screamed: -1, clackAcc: 0, jointAcc: 0, g: 1, gl: 0 };
	const fr = { p: V3(), t: V3(), n: V3(), b: V3() }, fc = { p: V3(), t: V3(), n: V3(), b: V3() };
	function place() {
		for (let i = 0; i < CARS; i++) {
			frameAt(R.s - CAR_L / 2 - i * CAR_GAP, fr);
			cars[i].matrixAutoUpdate = false;
			cars[i].matrix.makeBasis(fr.b, fr.n, fr.t).setPosition(fr.p);
			cars[i].matrixWorldNeedsUpdate = true;
		}
	}
	function stepSim(dt) {
		if (R.state === 'load') {
			R.timer -= dt; R.v = 0;
			if (R.timer <= 0) { R.state = 'run'; R.lap++; R.screamed = -1; }
			return;
		}
		// the grade under the middle of the train, the section under its front
		const kc = ((Math.floor((R.s - CARS * CAR_GAP / 2) / step) % n) + n) % n;
		const kf = ((Math.floor(R.s / step) % n) + n) % n;
		const sect = S[kf].sect === 'lift' || S[kc].sect === 'lift' ? 'lift' : S[kc].sect;
		const F = { ...S[kc], sect };
		let v = accel([F], 0, R.v, dt, MU, DRAG);
		// home: ease into the station and stop at the mark
		const home = L + STATION_S - R.s;
		if (R.s > L * 0.8 && home < 14) v = Math.min(v, Math.max(0.25, home * 0.35));
		const dv = v - R.v;
		R.v = v;
		R.s += v * dt;
		R.along = dv / dt;
		if (R.s >= L + STATION_S - 0.02) { R.s = STATION_S; R.v = 0; R.state = 'load'; R.timer = R.rider ? 0 : 14 + Math.random() * 8; if (R.rider) R.done = true; }
		R.sect = sect;
	}

	// ---------- sounds: at the train, fading with distance (or all round you, aboard) ----------
	const wind = sound.loop('bandpass', 600, 0.6), rumble = sound.loop('lowpass', 120, 0.8), motor = sound.loop('lowpass', 90, 1.2);
	function audio(dt, dist, aboard) {
		const near = aboard ? 1 : Math.max(0, 1 - dist / 260) ** 2;
		const v = R.v;
		if (near <= 0.001) { wind.set(0); rumble.set(0); motor.set(0); return; }
		wind.set(aboard ? Math.min(0.5, (v / 20) ** 2 * 0.55) : 0, 300 + v * 70);
		rumble.set(near * Math.min(0.55, v / 18 * 0.5) * (aboard ? 1 : 0.8), 70 + v * 9);
		const lifting = R.state === 'run' && R.sect === 'lift';
		motor.set(lifting ? near * 0.12 : 0, 80);
		// the chain dogs, clack-clack up the lift; the rail joints under the wheels
		R.clackAcc += v * dt; R.jointAcc += v * dt;
		if (lifting && R.clackAcc > 0.3) { R.clackAcc = 0; sound.click(0.3 * near, 2100 + Math.random() * 300, 5, 0.04); sound.click(0.18 * near, 900, 3, 0.05, 0.03); }
		if (!lifting && R.jointAcc > 1.4 && v > 1) { R.jointAcc = 0; sound.click(Math.min(0.2, v / 25 * 0.2) * near, 500 + v * 20, 1.5, 0.06); }
		// screams: down the big drop, and now and then over a hill
		const F = at(R.s - 4);
		if (R.state === 'run' && F.sect === 'free' && F.t.y < -0.33 && v > 5 && R.screamed !== Math.floor(R.s / 40)) {
			R.screamed = Math.floor(R.s / 40);
			const big = R.s < L * 0.45, k = big ? 5 : 2;
			for (let i = 0; i < k; i++) setTimeout(() => sound.scream((big ? 0.16 : 0.1) * near * (0.6 + Math.random() * 0.6), 520 + Math.random() * 520, 1.2 + Math.random() * 1.2), i * 140 + Math.random() * 200);
		}
	}

	// ---------- the rider's seat: front bench, on the left ----------
	const seat = new THREE.Matrix4(), eye = V3(), camQ = new THREE.Quaternion(), tgtQ = new THREE.Quaternion(), shake = V3();
	let camInit = false;
	function pose(dt, t, out) {
		stepSim(dt);
		place();
		if (R.done) return false;
		frameAt(R.s - CAR_L / 2, fc);
		seat.makeBasis(fc.b, fc.n, fc.t);
		// the look: along the car, with the car's own lean; turned to face forward (-z is ahead)
		tgtQ.setFromRotationMatrix(seat).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI));
		if (!camInit) { camQ.copy(tgtQ); camInit = true; }
		camQ.slerp(tgtQ, Math.min(1, dt * 9));
		// the g the rider feels, and a shake with speed and on the hard pull-outs
		const k = Math.floor(R.s / step);
		const th = (q) => Math.asin(S[((q % n) + n) % n].t.y);
		const kv = (th(k + 2) - th(k - 2)) / (4 * step);
		R.g = Math.cos(th(k)) + R.v * R.v * kv / G;
		const sh = Math.min(0.03, R.v * 0.0012 + Math.max(0, R.g - 1.4) * 0.012);
		shake.set((Math.sin(t * 37.1) + Math.sin(t * 53.7)) * sh, (Math.sin(t * 41.3) + Math.sin(t * 29.9)) * sh, 0);
		// (the body sinks into the seat under g, floats up off it on a hill)
		R.gl += ((R.g - 1) - R.gl) * Math.min(1, dt * 6);
		eye.set(-0.28, 1.28 - Math.max(-0.08, Math.min(0.06, R.gl * 0.05)), 0.45).applyMatrix4(seat.setPosition(fc.p));
		out.pos.copy(eye).add(shake.applyQuaternion(camQ));
		out.quat.copy(camQ);
		out.fov = 78 + Math.min(6, R.v * 0.25);
		audio(dt, 0, true);
		return true;
	}
	function status() {
		const mph = Math.round(R.v * 2.237);
		if (R.state === 'load') return 'Lap bar down. Keep your hands inside the car.';
		if (R.sect === 'tunnel') return 'The tunnel';
		if (R.sect === 'lift') return `The lift hill · ${Math.round((at(R.s).p.y - DECK) * 3.28)} ft`;
		return `${mph} mph · ${R.g.toFixed(1)} g`;
	}
	// the other riders: every seat but yours, while the train is full of people
	const SEATS = [];
	for (let i = 0; i < CARS; i++) for (const z of [0.55, -0.75]) for (const x of [-0.28, 0.28]) SEATS.push({ car: i, x, z });
	const seatM = new THREE.Matrix4(), off = new THREE.Matrix4();
	const riders = {
		count: SEATS.length,
		// the seat's frame in the park's frame (the rider sits on its cushion, facing forward)
		at(i, m) {
			const Sd = SEATS[i];
			if (R.rider && i === 0) return null;
			seatM.copy(cars[Sd.car].matrix).multiply(off.makeTranslation(Sd.x, 0.3, Sd.z - 0.08));
			return m.copy(seatM);
		},
		sit: 0.2, pose: 'lap',
		where: () => cars[0].matrix.elements.slice(12, 15),
	};
	return {
		id: 'dipper', name: 'Giant Dipper', icon: 'coaster', root,
		blurb: 'The 1924 wooden coaster: the tunnel, the lift hill, a 65-foot drop',
		board: { u: 212, v: -12, r: 4.5 }, exit: { u: 209, v: -9, yaw: Math.PI },
		// the timber, the rails and the station, a piece a frame after the rest
		later: [buildBents, buildRails, buildStation],
		// the footprint walked round (the queue's gate is the way in)
		solid: [[192, -160, 336, -24], [203, -24, 221, -15]],
		update(dt, t, info) { if (!R.rider) { stepSim(dt); place(); } else place(); if (!R.rider) audio(dt, info.dist(cars[0].matrix.elements[12], cars[0].matrix.elements[14]), false); },
		begin() {
			// wait for the train home, then board; the next dispatch is yours
			R.rider = true; R.done = false; camInit = false;
			if (R.state === 'load') R.timer = 5;
			else { R.s = STATION_S; R.v = 0; R.state = 'load'; R.timer = 5; }
			place();
			return true;
		},
		pose, status, riders,
		end() { R.rider = false; R.done = false; wind.set(0); motor.set(0); rumble.set(0); },
		state: R,
		dispose() { wind.stop(); rumble.stop(); motor.stop(); root.traverse((o) => o.geometry?.dispose()); },
		track: T,
	};
}
function bulbMat() { return new THREE.MeshBasicMaterial({ color: 0xfff4d8, toneMapped: false }); }
