// The services' rooms furnished (interiors/furnish.js ROOM_FIT): each room's things against
// its walls and out in it, clear of its doors and stairs, and its posts: the seats and places
// to stand that the people who work there are given (people/workplace-life.js), each with
// its role and the group it works in (a doctor and the patient in the same bay, the officers
// round the squad room's desks). A post marked trip is somewhere a worker walks to between
// spells at their own (a nurse's round of the beds, an officer's coffee), never cast into.
// The caches (services/depots.js) are marked on their rooms (rm.cache) for the runtime.

import { ROOM_FIT } from '../interiors/furnish.js';
import './kit.js';

const LABEL = { hospital: 'Hospital', police: 'Police station', fire: 'Fire station', armory: 'Armory' };

// a point in an item's own frame, in the room's (the turn the builder gives it)
function local(it, lx, lz) {
	switch (it.rot) {
		case 1: return [it.x + lz, it.z - lx];
		case 2: return [it.x - lx, it.z - lz];
		case 3: return [it.x - lz, it.z + lx];
		default: return [it.x + lx, it.z + lz];
	}
}
const FACE = [[0, 1], [1, 0], [0, -1], [-1, 0]];
// only the front of a counter stops you (the staff's side behind it is walked on)
function trim(it, fd) {
	const b = it.box.slice();
	if (it.rot === 0) b[1] = b[3] - fd; else if (it.rot === 2) b[3] = b[1] + fd; else if (it.rot === 1) b[0] = b[2] - fd; else b[2] = b[0] + fd;
	it.box = b;
}
// a post: role, its group (who works with whom), sitting or standing, a trip spot or not
function poster(K) {
	const kind = K.P.service || 'service', program = LABEL[kind] || kind, tag = `${kind}:${K.rm.k}:${K.rm.id}`;
	return (x, z, fx, fz, role, group, o = {}) => {
		const work = { role, group: `${tag}:${group}`, side: o.side || 0, floor: K.rm.k, program };
		if (o.trip) work.routineOnly = true;
		K.seats.push({ x, z, y: K.y0, fx, fz, sit: !!o.sit, h: o.sit ? o.h ?? 0.47 : 0, room: K.rm.id, work });
	};
}
// ceiling lights in a grid, and the room's lamp after dark
function grid(K, kind = 'tube', step = 3) {
	const { rm, items, lights, y0, L } = K;
	for (let x = rm.x0 + step / 2; x < rm.x1 - 0.5; x += step) for (let z = rm.z0 + step / 2; z < rm.z1 - 0.5; z += step) items.push({ type: 'ceilingLight', kind, level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: K.rnd(), ceil: L.h });
	lights.push([K.cx, y0 + L.h - 0.5, K.cz, rm.id]);
}
// the long walls (the room's longer pair of sides), walled and not the street front
const longSide = (K) => (s) => s.walled && (K.bw >= K.bd ? s.axis === 'x' : s.axis === 'z');
// something soft dropped in without asking (curtains, lines on the floor)
function soft(K, type, x, z, w, d, h, rot, extra = {}) { K.items.push({ type, room: K.rm.id, level: 0, y: K.y0, x, z, rot, w, d, h, v: K.rnd(), ceil: K.L.h, ...extra }); }
// keep a strip clear (a bay for an engine, a corridor in front of the cells)
const keep = (K, x0, z0, x1, z1) => K.placed.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);

// a hospital bed in a bay: the bed's head to the wall, curtains either side, the monitor; the
// patient sitting up in it, the doctor or nurse at its side (same group)
function bedBay(K, post, it, i, { trip = false } = {}) {
	const W2 = it.w / 2, D2 = it.d / 2, [fx, fz] = FACE[it.rot];
	for (const s of [-1, 1]) { const [x, z] = local(it, s * (W2 + 0.75), -D2 + 1.05), r = it.rot % 2 ? 0 : 1; soft(K, 'curtain', x, z, 2.1, 0.05, 2.3, r); }
	const [mx, mz] = local(it, -W2 - 0.35, -D2 + 0.35);
	K.items.push({ type: 'vitalsMonitor', room: K.rm.id, level: 0, y: K.y0, x: mx, z: mz, rot: it.rot, w: 0.4, d: 0.3, h: 1.55, v: K.rnd(), box: [mx - 0.2, mz - 0.2, mx + 0.2, mz + 0.2] });
	const [px, pz] = local(it, 0, -0.15);
	post(px, pz, fx, fz, 'patient', 'bed' + i, { sit: true, h: 0.66 });
	const [sx, sz] = local(it, W2 + 0.45, 0.1), [ax, az] = [-FACE[(it.rot + 1) % 4][0], -FACE[(it.rot + 1) % 4][1]];
	post(sx, sz, ax, az, trip ? 'patient check' : 'nurse', 'bed' + i, { trip, side: 1 });
	if (trip) { const [dx, dz] = local(it, W2 + 0.45, 0.8); post(dx, dz, ax, az, 'ward round', 'bed' + i, { trip: true, side: 1 }); }
}
function beds(K, post, n, opt = {}) {
	const out = [];
	for (let i = 0; i < n; i++) {
		const it = K.against('hospitalBed', 1.0, 2.1, 0.92, { clear: 1.3, side: longSide(K), extra: opt.extra });
		if (!it) break;
		// (room beside it for the curtains and someone at its side)
		const b = it.box, pad = 0.85;
		K.placed.push([b[0] - (it.rot % 2 ? 0 : pad), b[1] - (it.rot % 2 ? pad : 0), b[2] + (it.rot % 2 ? 0 : pad), b[3] + (it.rot % 2 ? pad : 0)]);
		bedBay(K, post, it, i, opt);
		out.push(it);
	}
	return out;
}

const FITS = {
	// ---------- the hospital ----------
	erWaiting(K) {
		const post = poster(K);
		let n = 0;
		for (let k = 0; k < 4; k++) {
			const it = K.against('waitingChairs', Math.min(3.5, Math.max(K.bw, K.bd) - 2.5), 0.62, 0.9, { clear: 1.0, score: (s) => (s.ext ? 0.5 : 1) });
			if (!it) break;
			const m = Math.max(1, Math.round(it.w / 0.58));
			for (let j = 0; j < m; j += 2) { const [x, z] = local(it, -it.w / 2 + (j + 0.5) * it.w / m, 0.05); post(x, z, FACE[it.rot][0], FACE[it.rot][1], 'visitor', 'wait' + n++, { sit: true, h: 0.46 }); }
		}
		K.against('vending', 0.9, 0.8, 1.85, { corner: true, clear: 0.9 });
		K.against('waterCooler', 0.35, 0.35, 1.4, { corner: true, clear: 0.5 });
		K.against('wallScreen', 1.4, 0.08, 2.7, { clear: 0, side: (s) => !s.ext, extra: { y0: 1.9, sh: 0.8 } });
		K.against('wheelchair', 0.65, 0.8, 0.95, { corner: true, clear: 0.3 });
		for (let k = 0; k < 2; k++) K.against('plant', 0.5, 0.5, 1.3, { corner: true, clear: 0 });
		grid(K, 'flush', 3);
	},
	triage(K) {
		const post = poster(K);
		const desk = K.against('triageDesk', Math.min(3.4, Math.max(K.bw, K.bd) - 3), 1.6, 1.1, { clear: 1.3, side: (s) => !s.ext });
		if (desk) {
			trim(desk, 0.75);
			const [x, z] = local(desk, -0.6, -0.35), [x2, z2] = local(desk, 0.7, -0.35), [fx, fz] = FACE[desk.rot];
			post(x, z, fx, fz, 'receptionist', 'desk', { sit: true });
			post(x2, z2, fx, fz, 'nurse', 'desk', { sit: true, side: 1 });
		}
		// a resus bed by the ambulance doors, stretchers waiting, the paramedics' place
		beds(K, post, 1);
		for (let k = 0; k < 2; k++) { const s = K.against('stretcher', 0.7, 2.0, 0.86, { clear: 0.8 }); if (s && k === 0) { const [x, z] = local(s, 0.75, 0.4); post(x, z, -FACE[(s.rot + 1) % 4][0], -FACE[(s.rot + 1) % 4][1], 'paramedic', 'stretcher'); } }
		K.against('medCabinet', 0.9, 0.42, 1.9, { clear: 0.8 });
		grid(K, 'tube', 2.8);
	},
	erBays(K) {
		const post = poster(K), n = Math.max(2, Math.min(12, Math.floor((K.bw + K.bd) * 2 / 2.8)));
		beds(K, post, n);
		// the nurses' station out in the middle, facing the doors from triage
		if (K.bw > 9 && K.bd > 5.4) {
			const st = K.standing('nurseStation', K.cx, K.cz, Math.min(4.2, K.bw - 6), 1.6, 1.12, 0, 0.7);
			if (st) {
				st.box = [st.x - st.w / 2, st.z + 0.05, st.x + st.w / 2, st.z + 0.85];
				for (const [lx, r, g] of [[-st.w / 4, 'nurse', 'station'], [st.w / 4, 'doctor', 'station']]) post(st.x + lx, st.z - 0.2, 0, 1, r, g, { sit: true, side: r === 'doctor' ? 1 : 0 });
				post(st.x, st.z + 1.4, 0, -1, 'doctor', 'rounds', { trip: false });
			}
		}
		K.against('medCabinet', 0.9, 0.42, 1.9, { clear: 0.8 });
		K.against('stretcher', 0.7, 2.0, 0.86, { corner: true, clear: 0.6 });
		grid(K, 'tube', 2.8);
	},
	theatre(K) {
		const post = poster(K);
		const t = K.standing('opTable', K.cx, K.cz, 0.62, 2.0, 0.95, K.bw > K.bd ? 1 : 0, 1.1);
		if (t) {
			soft(K, 'surgicalLight', t.x, t.z, 0.4, 0.4, 0.2, 0);
			const [ax, az] = local(t, 0, -1.35), [sx, sz] = local(t, 0.85, 0.2), [nx, nz] = local(t, -0.85, 0.2), side = FACE[(t.rot + 1) % 4];
			K.items.push({ type: 'anesthesiaCart', room: K.rm.id, level: 0, y: K.y0, x: ax, z: az, rot: (t.rot + 0) % 4, w: 0.7, d: 0.6, h: 1.4, v: K.rnd(), box: [ax - 0.35, az - 0.35, ax + 0.35, az + 0.35] });
			post(sx, sz, -side[0], -side[1], 'surgeon', 'op', {});
			post(nx, nz, side[0], side[1], 'nurse', 'op', { side: 1 });
			const [ix, iz] = local(t, 1.35, 0.6);
			K.items.push({ type: 'instrumentTable', room: K.rm.id, level: 0, y: K.y0, x: ix, z: iz, rot: t.rot, w: 1.0, d: 0.5, h: 0.92, v: K.rnd(), box: [ix - 0.4, iz - 0.4, ix + 0.4, iz + 0.4] });
		}
		K.against('scrubSink', 1.6, 0.6, 1.1, { clear: 0.9 });
		K.against('medCabinet', 0.9, 0.42, 1.9, { clear: 0.8 });
		K.against('medCabinet', 0.9, 0.42, 1.9, { clear: 0.8 });
		grid(K, 'tube', 2.4);
	},
	pharmacy(K) {
		const post = poster(K);
		const cw = Math.min(2.6, Math.max(K.bw, K.bd) - 2.4);
		const c = K.against('pharmacyCounter', cw, 1.5, 1.05, { clear: 1.2, side: (s) => s.open.some((o) => o.type === 'door') }) || K.against('pharmacyCounter', cw, 1.5, 1.05, { clear: 1.2 });
		if (c) { trim(c, 0.72); const [x, z] = local(c, 0, -0.35); post(x, z, FACE[c.rot][0], FACE[c.rot][1], 'pharmacist', 'counter'); }
		for (let k = 0; k < 6; k++) { const s = K.against('pharmacyShelf', 1.8, 0.45, 2.1, { clear: 0.9 }); if (s && k < 2) { const [x, z] = local(s, 0, 0.8); post(x, z, -FACE[s.rot][0], -FACE[s.rot][1], 'stock check', 'shelf' + k, { trip: true }); } }
		K.rm.cache = 'medical';
		grid(K, 'tube', 2.6);
	},
	ward(K) {
		const post = poster(K), n = Math.max(2, Math.min(14, Math.floor((K.bw + K.bd) * 2 / 2.9)));
		const list = beds(K, post, n, { trip: true });
		// a chair for a visitor at every other bed
		list.forEach((it, i) => { if (i % 2) return; const [x, z] = local(it, -it.w / 2 - 0.6, 0.5); post(x, z, FACE[(it.rot + 1) % 4][0], FACE[(it.rot + 1) % 4][1], 'visitor', 'bed' + i, { sit: true, h: 0.46, side: 1 }); K.items.push({ type: 'briefingChair', room: K.rm.id, level: 0, y: K.y0, x, z, rot: (it.rot + 1) % 4, w: 0.55, d: 0.55, h: 0.9, v: K.rnd() }); });
		K.against('medCabinet', 0.9, 0.42, 1.9, { clear: 0.8 });
		K.against('wheelchair', 0.65, 0.8, 0.95, { corner: true, clear: 0.3 });
		grid(K, 'flush', 3);
	},
	nurseHub(K) {
		const post = poster(K);
		const st = K.against('nurseStation', Math.min(3.6, Math.max(K.bw, K.bd) - 2.5), 1.7, 1.12, { clear: 1.4, side: (s) => !s.ext });
		if (st) { trim(st, 0.8); for (const [lx, r] of [[-st.w / 4, 'nurse'], [st.w / 4, 'doctor']]) { const [x, z] = local(st, lx, -0.3); post(x, z, FACE[st.rot][0], FACE[st.rot][1], r, 'hub', { sit: true, side: r === 'doctor' ? 1 : 0 }); } }
		K.against('medCabinet', 0.9, 0.42, 1.9, { clear: 0.8 });
		K.against('vending', 0.9, 0.8, 1.85, { corner: true, clear: 0.9 });
		K.against('waterCooler', 0.35, 0.35, 1.4, { corner: true, clear: 0.5 });
		K.against('stretcher', 0.7, 2.0, 0.86, { clear: 0.6 });
		grid(K, 'flush', 3);
	},

	// ---------- the police station ----------
	frontDesk(K) {
		const post = poster(K);
		const desk = K.against('frontDesk', Math.min(4.2, K.bw - 2.6), 1.7, 1.16, { clear: 1.6, side: (s) => s.axis === 'x' && s.n > 0 });
		if (desk) { trim(desk, 0.8); const [x, z] = local(desk, 0, -0.4); post(x, z, FACE[desk.rot][0], FACE[desk.rot][1], 'desk officer', 'desk', { sit: true }); const [vx, vz] = local(desk, 0, 1.25); post(vx, vz, -FACE[desk.rot][0], -FACE[desk.rot][1], 'visitor', 'desk', { side: 1 }); }
		for (let k = 0; k < 2; k++) { const b = K.against('waitingChairs', 2.4, 0.62, 0.9, { clear: 0.9 }); if (b) { const [x, z] = local(b, 0, 0.05); post(x, z, FACE[b.rot][0], FACE[b.rot][1], 'visitor', 'bench' + k, { sit: true, h: 0.46 }); } }
		K.against('wallScreen', 1.6, 0.08, 2.6, { clear: 0, side: (s) => !s.ext, extra: { y0: 1.7, sh: 0.9 } });
		K.against('waterCooler', 0.35, 0.35, 1.4, { corner: true, clear: 0.5 });
		K.against('plant', 0.5, 0.5, 1.3, { corner: true, clear: 0 });
		grid(K, 'flush', 3);
	},
	bullpen(K) {
		const post = poster(K);
		let n = 0;
		for (let x = K.rm.x0 + 1.2; x < K.rm.x1 - 0.9 && n < 12; x += 1.9) for (let z = K.rm.z1 - 1.2; z > K.rm.z0 + 1.2 && n < 12; z -= 2.3) {
			const it = K.standing('officeDesk', x, z, 1.4, 0.75, 0.76, 0, 0.35);
			if (it) post(x, z - 0.7, 0, 1, 'officer', 'desk' + Math.floor(n++ / 2), { sit: true, side: n % 2 });
		}
		K.against('whiteboard', Math.min(2.6, K.bw - 2), 0.06, 2.1, { clear: 0, side: (s) => !s.ext });
		for (let k = 0; k < 3; k++) K.against('filingCabinet', 0.5, 0.62, 1.3, { clear: 0.7 });
		const cf = K.against('counter', 1.6, 0.62, 0.92, { clear: 0.9, extra: { uppers: 0 } });
		if (cf) { const [x, z] = local(cf, 0, 0.75); post(x, z, -FACE[cf.rot][0], -FACE[cf.rot][1], 'coffee', 'coffee', { trip: true }); }
		K.against('wallScreen', 1.6, 0.08, 2.6, { clear: 0, side: (s) => !s.ext, extra: { y0: 1.7, sh: 0.9 } });
		grid(K, 'tube', 2.8);
	},
	chiefOffice(K) {
		const post = poster(K);
		const dk = K.against('desk', 1.5, 0.75, 0.76, { clear: 1.2, score: (s) => (s.ext ? 0 : 1) });
		if (dk) { const [x, z] = local(dk, 0, 0.6); post(x, z, -FACE[dk.rot][0], -FACE[dk.rot][1], 'chief', 'office', { sit: true }); }
		K.against('bookcase', 0.9, 0.34, 1.9, { clear: 0.7 });
		K.against('filingCabinet', 0.5, 0.62, 1.3, { clear: 0.7 });
		const ac = K.against('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 });
		if (ac) post(ac.x, ac.z, FACE[ac.rot][0], FACE[ac.rot][1], 'detective', 'office', { sit: true, h: 0.44, side: 1 });
		K.against('plant', 0.45, 0.45, 1.2, { corner: true, clear: 0 });
		K.art(1); K.light('flush');
	},
	cells(K) {
		const post = poster(K), { rm } = K, depth = Math.min(2.9, K.bd - 1.9), cw = 2.4, n = Math.max(1, Math.floor((K.bw - 0.4) / cw));
		for (let i = 0; i < n; i++) {
			const x0 = rm.x0 + 0.2 + i * cw, cx = x0 + cw / 2, zf = rm.z0 + depth;
			K.items.push({ type: 'cellFit', room: rm.id, level: 0, y: K.y0, x: cx, z: rm.z0 + depth / 2, rot: 0, w: cw - 0.3, d: depth - 0.1, h: 1, v: K.rnd() });
			K.items.push({ type: 'cellBars', room: rm.id, level: 0, y: K.y0, x: cx, z: zf, rot: 0, w: cw, d: 0.1, h: 2.6, v: K.rnd(), box: [x0, zf - 0.06, x0 + cw, zf + 0.06] });
			if (i < n - 1) K.items.push({ type: 'cellWall', room: rm.id, level: 0, y: K.y0, x: x0 + cw, z: rm.z0 + depth / 2, rot: 0, w: 0.12, d: depth, h: 2.6, v: 0.3, box: [x0 + cw - 0.06, rm.z0, x0 + cw + 0.06, zf] });
			if (i % 2 === 0) post(cx - 0.6, rm.z0 + 0.9, 0, 1, 'detainee', 'cell' + i, { sit: true, h: 0.5 });
			if (i === 0) post(cx, zf + 0.7, 0, -1, 'cell check', 'cells', { trip: true });
		}
		keep(K, rm.x0, rm.z0, rm.x1, rm.z0 + depth + 0.1);
		K.against('bench', 1.6, 0.5, 0.45, { clear: 0.8, side: (s) => s.axis === 'x' && s.n < 0 });
		grid(K, 'tube', 2.6);
	},
	evidence(K) {
		const post = poster(K), { rm } = K;
		for (let x = rm.x0 + 1.1; x < rm.x1 - 0.8; x += 1.7) K.standing('evidenceShelf', x, (rm.z0 + rm.z1) / 2 - 0.4, 0.6, Math.min(3.6, K.bd - 3), 2.2, 1, 0.5);
		K.against('gunRack', 1.4, 0.36, 1.8, { clear: 0.8 });
		const dk = K.against('desk', 1.2, 0.6, 0.76, { clear: 1.0 });
		if (dk) { const [x, z] = local(dk, 0, 0.55); post(x, z, -FACE[dk.rot][0], -FACE[dk.rot][1], 'evidence clerk', 'log', { sit: true }); const [tx, tz] = local(dk, 0.9, 0.9); post(tx, tz, -FACE[dk.rot][0], -FACE[dk.rot][1], 'evidence log', 'log', { trip: true, side: 1 }); }
		K.rm.cache = 'police';
		grid(K, 'tube', 2.6);
	},
	lockerRoom(K) {
		const post = poster(K), kind = K.P.service;
		for (let k = 0; k < 5; k++) K.against('lockers', Math.min(3.2, Math.max(K.bw, K.bd) - 1.6), 0.5, 1.9, { clear: 1.0, side: (s) => !s.ext || k > 2 });
		const b = K.standing('bench', K.cx, K.cz, Math.min(2.4, Math.max(K.bw, K.bd) - 3), 0.4, 0.45, K.bw >= K.bd ? 0 : 1, 0.5);
		if (b) post(b.x, b.z, FACE[b.rot][0], FACE[b.rot][1], kind === 'fire' ? 'firefighter' : kind === 'police' ? 'officer' : 'soldier', 'lockers', { sit: true, h: 0.45 });
		for (let k = 0; k < 2; k++) K.against('showerStall', 1.0, 1.0, 2.1, { corner: true, clear: 0.6 });
		grid(K, 'tube', 2.6);
	},
	sallyport(K) {
		const { rm, P } = K, bay = P.bay || { x0: rm.x0 + 0.5, x1: rm.x1 - 0.5 }, n = Math.max(1, Math.min(3, Math.floor((bay.x1 - bay.x0) / 2.9)));
		for (let i = 0; i < n; i++) {
			const x = bay.x0 + (i + 0.5) * (bay.x1 - bay.x0) / n, z = rm.z1 - 3.2;
			if (z - 2.4 < rm.z0) break;
			K.items.push({ type: 'car', kind: 'sedan', paint: i % 2 ? [0.06, 0.07, 0.1] : [0.92, 0.92, 0.9], x, z, y: K.y0, rot: 0, w: 1.85, d: 4.6, h: 1.45, v: K.rnd(), box: [x - 0.95, z - 2.35, x + 0.95, z + 2.35] });
			K.items.push({ type: 'lightBar', x, z: z - 0.2, y: K.y0 + 1.42, rot: 0, w: 1.2, d: 0.25, h: 0.13, v: K.rnd(), room: rm.id, level: 0 });
			keep(K, x - 1.2, z - 2.6, x + 1.2, rm.z1);
		}
		K.against('workbench', 1.5, 0.6, 0.92, { clear: 0.6 });
		K.against('bins', 1.4, 0.7, 1.1, { clear: 0.4 });
		K.against('shelves', 1.8, 0.5, 1.9, { clear: 0.5 });
		grid(K, 'tube', 3.4);
	},

	// ---------- the fire station ----------
	apparatus(K) {
		const post = poster(K), { rm, P } = K;
		// the engines' lanes kept clear, the doors to the back of the bay; lines on the floor
		const z0 = rm.z0 + Math.min(2.4, Math.max(0.6, K.bd - 12));
		for (const b of P.bays || []) { keep(K, b.x - 1.45, z0, b.x + 1.45, rm.z1); soft(K, 'laneLines', b.x, (z0 + rm.z1) / 2, 2.9, rm.z1 - z0, 0.01, 0); }
		if (P.pole) K.items.push({ type: 'firePole', room: rm.id, level: 0, y: K.y0, x: P.pole.x, z: P.pole.z, rot: 0, w: 0.12, d: 0.12, h: P.levels[1].y + P.levels[1].h, v: K.rnd(), box: [P.pole.x - 0.05, P.pole.z - 0.05, P.pole.x + 0.05, P.pole.z + 0.05] });
		if (P.pole) keep(K, P.pole.x - 0.9, P.pole.z - 0.9, P.pole.x + 0.9, P.pole.z + 0.9);
		let g = 0;
		for (let k = 0; k < 4; k++) { const it = K.against('gearRack', 2.4, 0.6, 2.1, { clear: 0.9, side: (s) => s.axis === 'z' || s.n > 0 }); if (it) { const [x, z] = local(it, 0, 0.75); post(x, z, -FACE[it.rot][0], -FACE[it.rot][1], g++ ? 'gear check' : 'firefighter', 'gear' + k, { trip: g > 1 }); } }
		K.against('hoseRack', 1.6, 0.42, 1.8, { clear: 0.8 });
		K.against('toolWall', 2.4, 0.16, 2.3, { clear: 0.6 });
		K.against('workbench', 1.5, 0.6, 0.92, { clear: 0.6 });
		K.against('fuelDrums', 1.3, 1.1, 1.0, { corner: true, clear: 0.4 });
		K.rm.cache = 'fire';
		grid(K, 'tube', 3.6);
	},
	watchRoom(K) {
		const post = poster(K);
		const d = K.against('commsDesk', Math.min(2.4, Math.max(K.bw, K.bd) - 1.4), 0.8, 0.95, { clear: 1.1, side: (s) => !s.ext || s.axis === 'z' });
		if (d) { const [x, z] = local(d, 0, 0.75); post(x, z, -FACE[d.rot][0], -FACE[d.rot][1], 'dispatcher', 'watch', { sit: true }); }
		K.against('wallScreen', 1.4, 0.08, 2.4, { clear: 0, side: (s) => !s.ext, extra: { y0: 1.5, sh: 0.9 } });
		K.against('filingCabinet', 0.5, 0.62, 1.3, { clear: 0.7 });
		K.against('radioRack', 0.6, 0.6, 2.0, { corner: true, clear: 0.6 });
		grid(K, 'flush', 2.6);
	},
	dayRoom(K) {
		const post = poster(K);
		const ct = K.against('counter', Math.min(3.6, Math.max(K.bw, K.bd) - 2), 0.63, 0.92, { clear: 1.0, noWindow: true, extra: { uppers: 1 } });
		if (ct) { ct.sink = ct.c - ct.w * 0.25; ct.range = ct.c + ct.w * 0.25; const [x, z] = local(ct, 0, 0.7); post(x, z, -FACE[ct.rot][0], -FACE[ct.rot][1], 'kitchen', 'kitchen', { trip: true }); }
		K.against('fridge', 0.9, 0.75, 1.8, { corner: true, clear: 0.9 });
		const tb = K.standing('diningTable', K.cx, K.cz + 0.4, Math.min(2.4, K.bw - 2.4), 0.95, 0.76, K.bw >= K.bd ? 0 : 1, 0.6, { chairs: 6 });
		if (tb) {
			const before = K.seats.length;
			K.chairs(tb);
			// (the chairs round the table are the crew's)
			for (let i = before; i < K.seats.length; i++) K.seats[i].work = { role: 'firefighter', group: `fire:${K.rm.k}:${K.rm.id}:table`, side: i % 2, floor: K.rm.k, program: 'Fire station' };
		}
		const so = K.against('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.3 });
		if (so) { post(so.x, so.z, FACE[so.rot][0], FACE[so.rot][1], 'firefighter', 'sofa', { sit: true, h: 0.44 }); K.inFront(so, 'tvConsole', 1.5, 0.45, 0.55, 2.0); }
		grid(K, 'pendant', 2.8);
	},
	bunkRoom(K) {
		const post = poster(K);
		let n = 0;
		for (let k = 0; k < 10; k++) {
			const b = K.against('bed', 1.0, 2.05, 0.6, { clear: 0.8, extra: { single: true } });
			if (!b) break;
			K.placed.push([b.box[0] - 0.5, b.box[1] - 0.5, b.box[2] + 0.5, b.box[3] + 0.5]);
			if (n++ % 2 === 0) { const [x, z] = local(b, 0, 0.2); post(x, z, FACE[b.rot][0], FACE[b.rot][1], 'firefighter', 'bunk' + k, { sit: true, h: 0.52 }); }
			const [fx, fz] = local(b, 0, b.d / 2 + 0.3);
			K.standing('footLocker', fx, fz, 0.8, 0.42, 0.42, b.rot, 0);
		}
		grid(K, 'flush', 3);
	},
	gym(K) {
		const post = poster(K), kind = K.P.service, who = kind === 'fire' ? 'firefighter' : kind === 'police' ? 'officer' : 'soldier';
		const wb = K.standing('weightBench', K.cx - K.bw * 0.2, K.cz, 1.2, 1.4, 1.25, 0, 0.6);
		if (wb) post(wb.x, wb.z + 0.9, 0, -1, 'workout', 'gym', { trip: true });
		const tr = K.against('treadmill', 0.8, 1.9, 1.4, { clear: 1.0 });
		if (tr) post(tr.x, tr.z, FACE[tr.rot][0], FACE[tr.rot][1], who, 'gym', { side: 1 });
		K.against('treadmill', 0.8, 1.9, 1.4, { clear: 1.0 });
		K.against('dumbbellRack', 1.6, 0.5, 0.9, { clear: 1.0 });
		K.against('rug', Math.min(3, K.bw - 2), Math.min(2, K.bd - 2), 0.01, { clear: 0, centre: true });
		grid(K, 'tube', 2.8);
	},
	showers(K) {
		for (let k = 0; k < 4; k++) K.against('showerStall', 1.0, 1.0, 2.1, { clear: 0.7, side: (s) => s.walled });
		for (let k = 0; k < 2; k++) K.against('toilet', 0.45, 0.72, 0.78, { clear: 0.6 });
		K.against('vanity', 1.6, 0.56, 0.86, { clear: 0.7, noWindow: true });
		K.against('bench', 1.4, 0.4, 0.45, { clear: 0.6 });
		grid(K, 'bar', 2.4);
	},

	// ---------- the armory ----------
	warRoom(K) {
		const post = poster(K);
		const tw = Math.min(4.2, K.bw - 3.4), td = Math.min(2.6, K.bd - 3.4);
		if (tw > 1.6 && td > 1.2) {
			const t = K.standing('mapTable', K.cx, K.cz, tw, td, 0.98, 0, 1.0);
			if (t) {
				K.rm.mapTable = { x: t.x, z: t.z, w: tw, d: td, y: 0.95 };
				post(t.x, t.z - td / 2 - 0.55, 0, 1, 'duty officer', 'map', {});
				post(t.x - tw / 4, t.z + td / 2 + 0.55, 0, -1, 'officer', 'map', { side: 1 });
				post(t.x + tw / 4, t.z + td / 2 + 0.55, 0, -1, 'map review', 'map', { trip: true, side: 1 });
				post(t.x - tw / 2 - 0.55, t.z, 1, 0, 'officer', 'map', { side: 1 });
			}
		}
		const screens = [];
		for (let k = 0; k < 4; k++) { const s = K.against('wallScreen', 2.0, 0.08, 2.35, { clear: 0, side: (q) => !q.ext || k > 1, extra: { y0: 1.2, sh: 1.15 } }); if (s) screens.push({ x: s.x, z: s.z, rot: s.rot, w: 2.0, y0: 1.2, h: 1.15 }); }
		K.rm.screens = screens;
		const d = K.against('commsDesk', 2.2, 0.8, 0.95, { clear: 1.1 });
		if (d) { const [x, z] = local(d, 0, 0.75); post(x, z, -FACE[d.rot][0], -FACE[d.rot][1], 'radio operator', 'radio', { sit: true }); }
		// the briefing chairs in rows facing a screen, the podium beside it
		const s0 = screens[0];
		if (s0) {
			const [fx, fz] = FACE[s0.rot];
			for (let r = 0; r < 2; r++) for (let c = -1; c <= 1; c++) {
				const x = s0.x + fx * (3.2 + r * 1.0) + fz * c * 0.75, z = s0.z + fz * (3.2 + r * 1.0) - fx * c * 0.75;
				const ch = K.standing('briefingChair', x, z, 0.55, 0.55, 0.9, (s0.rot + 2) % 4, 0.1);
				if (ch && r === 0) post(x, z, -fx, -fz, 'officer', 'brief', { sit: true, h: 0.47 });
			}
			K.standing('podium', s0.x + fx * 1.0 + fz * 1.4, s0.z + fz * 1.0 - fx * 1.4, 0.6, 0.5, 1.15, (s0.rot + 2) % 4, 0.2);
		}
		grid(K, 'flush', 2.6);
	},
	commsRoom(K) {
		const post = poster(K);
		for (let k = 0; k < 3; k++) { const d = K.against('commsDesk', 2.2, 0.8, 0.95, { clear: 1.1 }); if (d) { const [x, z] = local(d, 0, 0.75); post(x, z, -FACE[d.rot][0], -FACE[d.rot][1], 'radio operator', 'desk' + k, { sit: true, side: k % 2 }); } }
		for (let k = 0; k < 3; k++) { const r = K.against('radioRack', 0.6, 0.6, 2.0, { clear: 0.8 }); if (r && k === 0) { const [x, z] = local(r, 0, 0.8); post(x, z, -FACE[r.rot][0], -FACE[r.rot][1], 'comms check', 'rack', { trip: true }); } }
		const s = K.against('wallScreen', 1.8, 0.08, 2.4, { clear: 0, side: (q) => !q.ext, extra: { y0: 1.4, sh: 1.0 } });
		K.rm.screens = s ? [{ x: s.x, z: s.z, rot: s.rot, w: 1.8, y0: 1.4, h: 1.0 }] : [];
		K.rm.radios = true;
		grid(K, 'flush', 2.6);
	},
	guardPost(K) {
		const post = poster(K);
		const d = K.against('guardDesk', Math.min(2.2, Math.max(K.bw, K.bd) - 1.2), 1.4, 1.14, { clear: 1.2, side: (s) => !s.ext });
		if (d) { trim(d, 0.4); const [x, z] = local(d, 0, -0.25); post(x, z, FACE[d.rot][0], FACE[d.rot][1], 'guard', 'post', { sit: true }); }
		K.against('weaponRack', 1.8, 0.7, 1.8, { clear: 0.7 });
		K.against('lockers', 1.6, 0.5, 1.9, { clear: 0.8 });
		grid(K, 'flush', 2.4);
	},
	depot(K) {
		const post = poster(K), { rm } = K, long = K.bw >= K.bd;
		// racks in rows down the hall, the crates, the drums and the medical stores along the walls
		for (let u = (long ? rm.x0 : rm.z0) + 2.4; u < (long ? rm.x1 : rm.z1) - 2; u += 3.4) K.standing('rack', long ? u : K.cx, long ? K.cz : u, 1.1, Math.min(10, (long ? K.bd : K.bw) - 4.4), Math.min(3.8, K.L.h - 0.4), long ? 0 : 1, 0.15);
		for (let k = 0; k < 3; k++) K.against('ammoCrates', 1.4, 0.8, 1.3, { clear: 0.8 });
		for (let k = 0; k < 2; k++) K.against('supplyCrates', 1.3, 1.0, 1.6, { clear: 0.8 });
		K.against('weaponRack', 2.0, 0.7, 1.8, { clear: 0.9 });
		for (let k = 0; k < 2; k++) K.against('fuelDrums', 1.3, 1.1, 1.0, { corner: true, clear: 0.4 });
		K.against('medCrates', 0.9, 0.55, 0.85, { clear: 0.6 });
		const dk = K.against('officeDesk', 1.4, 0.75, 0.76, { clear: 1.0, corner: true });
		if (dk) { const [x, z] = local(dk, 0, -0.7); post(x, z, FACE[dk.rot][0], FACE[dk.rot][1], 'quartermaster', 'desk', { sit: true }); }
		const r0 = K.items.find((q) => q.room === rm.id && q.type === 'rack');
		if (r0) post(r0.x + (long ? 0.9 : 0), r0.z + (long ? 0 : 0.9), long ? -1 : 0, long ? 0 : -1, 'inventory', 'racks', { trip: true });
		K.rm.cache = K.P.service === 'armory' ? 'weapons' : 'supply';
		grid(K, 'tube', 3.6);
	},
	barracks(K) {
		const post = poster(K);
		let n = 0;
		for (let k = 0; k < 12; k++) {
			const b = K.against('bunkBed', 1.0, 2.0, 1.75, { clear: 0.9 });
			if (!b) break;
			K.placed.push([b.box[0] - 0.45, b.box[1] - 0.45, b.box[2] + 0.45, b.box[3] + 0.45]);
			const [fx, fz] = local(b, 0, b.d / 2 + 0.3);
			K.standing('footLocker', fx, fz, 0.8, 0.42, 0.42, b.rot, 0);
			if (n++ % 2 === 0) { const [x, z] = local(b, 0, 0.25); post(x, z, FACE[b.rot][0], FACE[b.rot][1], 'soldier', 'bunk' + k, { sit: true, h: 0.5 }); }
		}
		K.against('lockers', 2.4, 0.5, 1.9, { clear: 1.0 });
		grid(K, 'flush', 3);
	},
	messHall(K) {
		const post = poster(K), { rm } = K;
		const c = K.against('shopCounter', Math.min(5, K.bw - 3), 0.8, 1.0, { clear: 1.6, extra: { kind: 'cafe' }, side: (s) => !s.ext });
		if (c) { const [x, z] = local(c, 0, -0.55); post(x, z, FACE[c.rot][0], FACE[c.rot][1], 'cook', 'line'); }
		let t = 0;
		for (let x = rm.x0 + 2; x < rm.x1 - 1.5 && t < 8; x += 3.0) for (let z = rm.z0 + 2; z < rm.z1 - 2.5 && t < 8; z += 2.6) {
			const tb = K.standing('messTable', x, z, 2.4, 0.8, 0.76, 1, 0.5, { chairs: 6 });
			if (!tb) continue;
			const before = K.seats.length;
			K.chairs(tb);
			for (let i = before; i < K.seats.length; i++) if ((i - before) % 2 === 0) K.seats[i].work = { role: 'soldier', group: `mess:${K.rm.id}:${t}`, side: i % 2, floor: K.rm.k, program: 'Armory' };
			t++;
		}
		grid(K, 'tube', 3);
	},
};
// the fire station's and the barracks' quarters share the hospital's and the station's rooms
Object.assign(ROOM_FIT, FITS);
export const SERVICE_ROOMS = Object.keys(FITS);
