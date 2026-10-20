// The insides of the services, laid out for the interiors (interiors/plan.js planShell builds
// them; services/fitout.js furnishes their rooms; services/kit.js draws the things in them).
// In the plan's frame: x across the front, the front at +z, y up from the ground floor.
//
//   planHospital   the emergency department on the ground floor: the walk-in doors into
//                  the waiting room and its triage desk, the ambulance doors into triage,
//                  the treatment bays behind, the operating theatre, the pharmacy and the
//                  stair at the back; the wards and the nurses' hub upstairs
//   planPolice     the lobby and front desk, the squad room and the chief's office behind,
//                  the holding cells, the evidence room and the locker room at the back, the
//                  garage for the cruisers down one side (the sally port)
//   planFire       the apparatus bay across most of the front, its big doors; the watch
//                  room, the kitchen and day room and the stair down the side; upstairs
//                  the bunk room with the pole down through its floor, the gym, the showers
//                  and the lockers
//   planArmory     a reserve armory: the war room, the comms room and the guard post at the
//                  front, the supply depot and the barracks behind
//
// The military's own buildings (src/military/, the security work) take the war room, the
// depot and the barracks one at a time: buildWarRoom(frame), buildDepot(frame) and
// buildBarracks(frame), frame = { W, D, door? } (inside size, metres), each returning a plan
// for interiors.addSite (see serviceSite in services/index.js for the site around a plan).

import { planShell, ST } from '../interiors/plan.js';
import { clamp } from '../noise.js';

const PT = ST.part;
// the looks of the rooms: floors and wall paint (interiors/build.js reads rm.floor, rm.paint)
const CLINIC = { floor: 'tile', paint: [0.9, 0.93, 0.92] };
const CLINIC_MINT = { floor: 'tile', paint: [0.78, 0.88, 0.85] };
const CIVIC = { floor: 'tile', paint: [0.86, 0.87, 0.86] };
const BAY = { floor: 'concrete', paint: [0.82, 0.8, 0.76] };
const DRAB = { floor: 'concrete', paint: [0.66, 0.66, 0.58] };
const QUARTERS = { floor: 'carpet', paint: [0.8, 0.79, 0.74] };

// a big room split into a grid of rooms no larger than maxW by maxD, wide openings between
// neighbours so all of it stays one walk (a big block's wards and bays, a long depot)
function cells(K, k, type, x0, z0, x1, z1, maxW, maxD, extra) {
	const nx = Math.max(1, Math.ceil((x1 - x0) / maxW - 0.15)), nz = Math.max(1, Math.ceil((z1 - z0) / maxD - 0.15)), w = (x1 - x0) / nx, d = (z1 - z0) / nz;
	for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) K.room(k, type, x0 + i * w + (i ? PT / 2 : 0), z0 + j * d + (j ? PT / 2 : 0), x0 + (i + 1) * w - (i < nx - 1 ? PT / 2 : 0), z0 + (j + 1) * d - (j < nz - 1 ? PT / 2 : 0), extra);
	for (let i = 1; i < nx; i++) { const wl = K.wall(k, 'z', x0 + i * w, z0, z1); for (let j = 0; j < nz; j++) K.wide(wl, z0 + (j + 0.5) * d - 1.1, z0 + (j + 0.5) * d + 1.1, 2.4); }
	for (let j = 1; j < nz; j++) { const wl = K.wall(k, 'x', z0 + j * d, x0, x1); for (let i = 0; i < nx; i++) K.wide(wl, x0 + (i + 0.5) * w - 1.1, x0 + (i + 0.5) * w + 1.1, 2.4); }
}

// windows along a side of level k, every step metres, the doors already cut left alone
function glaze(K, k, side, step, w, y0, y1) {
	const len = side === 'z+' || side === 'z-' ? K.hw : K.hd;
	const n = Math.max(1, Math.floor((2 * len - 1.6) / step));
	for (let i = 0; i < n; i++) K.window(side, k, -len + 0.8 + (i + 0.5) * (2 * len - 1.6) / n, w, y0, y1);
}

// ---------------------------------------------------------------------------------
export function planHospital({ W, D }) {
	const hw = W / 2 - ST.ext, ambX = hw * 0.58, doorX = -hw * 0.45;
	const P = planShell({
		W, D, use: 'site', style: 'modern', door: { x: doorX, w: 2.0, h: 2.6 }, levels: [{ y: 0, h: 4.2 }, { y: 4.6, h: 3.6 }], top: 8.6,
		doors: [{ side: 'z+', u: ambX, w: 3.2, h: 2.9 }],
		layout: (K) => {
			const { hw, hd } = K;
			const zf = hd - clamp(D * 0.34, 6, 9), zb = -hd + clamp(D * 0.32, 5.6, 8), xs = clamp(hw * 0.12, 0, 4);
			// the ground floor: waiting and triage at the front, the bays, the back rooms
			K.room(0, 'erWaiting', -hw, zf + PT / 2, xs - PT / 2, hd, CLINIC);
			K.room(0, 'triage', xs + PT / 2, zf + PT / 2, hw, hd, CLINIC_MINT);
			K.door(K.wall(0, 'z', xs, zf, hd), zf + (hd - zf) * 0.35, 1.2);
			const wf = K.wall(0, 'x', zf, -hw, hw);
			K.wide(wf, (-hw + xs) / 2 - 1.2, (-hw + xs) / 2 + 1.2, 2.6);
			K.wide(wf, (xs + hw) / 2 - 1.5, (xs + hw) / 2 + 1.5, 2.6);
			cells(K, 0, 'erBays', -hw, zb + PT / 2, hw, zf - PT / 2, 16, 11, CLINIC_MINT);
			const x1 = -hw + 2 * hw * 0.42, x2 = x1 + 2 * hw * 0.27;
			cells(K, 0, 'theatre', -hw, -hd, x1 - PT / 2, zb - PT / 2, 12, 10, { floor: 'tile', paint: [0.7, 0.84, 0.82] });
			K.room(0, 'pharmacy', x1 + PT / 2, -hd, x2 - PT / 2, zb - PT / 2, CLINIC);
			K.room(0, 'hall', x2 + PT / 2, -hd, hw, zb - PT / 2, { stairs: true, ...CLINIC });
			const wb = K.wall(0, 'x', zb, -hw, hw);
			K.wide(wb, (-hw + x1) / 2 - 0.9, (-hw + x1) / 2 + 0.9, 2.4);
			K.door(wb, (x1 + x2) / 2, 1.2);
			if (hw - 1.6 - (x2 + 0.3) > 1) K.wide(wb, x2 + 0.3, hw - 1.6, 2.4);
			K.wall(0, 'z', x1, -hd, zb); K.wall(0, 'z', x2, -hd, zb);
			// the stair along the side wall, up from the back toward the bays
			K.flight(0, hw - 1.35, hw - 0.06, -hd + 0.25, zb - 0.45, null, -1);
			// upstairs: the front ward, the nurses' hub the stair arrives in, the back ward
			const xw = hw - clamp(2 * hw * 0.3, 5, 9);
			cells(K, 1, 'ward', -hw, zb + PT / 2, xw - PT / 2, hd, 14, 10, CLINIC);
			K.room(1, 'nurseHub', xw + PT / 2, zb + PT / 2, hw, hd, CLINIC_MINT);
			cells(K, 1, 'ward', -hw, -hd, x2 - PT / 2, zb - PT / 2, 14, 10, CLINIC);
			K.room(1, 'hall', x2 + PT / 2, -hd, hw, zb - PT / 2, { stairs: true, ...CLINIC });
			const wb1 = K.wall(1, 'x', zb, -hw, hw);
			K.wide(wb1, hw - 1.4, hw - 0.1, 2.4);
			K.door(wb1, (-hw + x2) / 2, 1.4);
			K.wide(K.wall(1, 'z', xw, zb, hd), zb + 1.2, Math.min(hd - 0.8, zb + 4), 2.4);
			K.door(K.wall(1, 'z', x2, -hd, zb), (-hd + zb) / 2, 1.2);
			K.rail(1, hw - 1.42, -hd + 0.25, hw - 1.35, zb - 0.45);
			// the windows: tall on the ground floor's front, the wards' all round
			glaze(K, 0, 'z+', 3.2, 1.8, 1.0, 2.7);
			for (const s of ['x-', 'x+']) glaze(K, 0, s, 3.4, 1.4, 1.0, 2.6);
			for (const s of ['z+', 'z-', 'x-', 'x+']) glaze(K, 1, s, 2.6, 1.5, 0.9, 2.5);
		},
	});
	P.service = 'hospital'; P.amb = { x: ambX, w: 3.2 };
	return P;
}

// ---------------------------------------------------------------------------------
export function planPolice({ W, D }) {
	const hw = W / 2 - ST.ext, gw = clamp(W * 0.36, 6.5, 9.5), xg = hw - gw;
	const P = planShell({
		W, D, use: 'site', style: 'modern', door: { x: (-hw + xg) / 2 - 0.6, w: 1.8, h: 2.5 }, levels: [{ y: 0, h: 3.8 }], top: 4.4,
		doors: [{ side: 'z+', u: hw - gw / 2, w: gw - 1.4, h: 3.2 }],
		layout: (K) => {
			const { hw, hd } = K;
			const zf = hd - clamp(D * 0.3, 4.5, 6.5), zc = -hd + clamp(D * 0.34, 4.2, 6.5), span = xg + hw;
			const xo = -hw + clamp(span * 0.3, 3.2, 5), xe = -hw + span * 0.45, xl = -hw + span * 0.72;
			K.room(0, 'frontDesk', -hw, zf + PT / 2, xg - PT / 2, hd, CIVIC);
			K.room(0, 'chiefOffice', -hw, zc + PT / 2, xo - PT / 2, zf - PT / 2, { floor: 'carpet', paint: [0.76, 0.78, 0.8] });
			cells(K, 0, 'bullpen', xo + PT / 2, zc + PT / 2, xg - PT / 2, zf - PT / 2, 15, 11, { floor: 'carpet', paint: [0.82, 0.84, 0.85] });
			K.room(0, 'cells', -hw, -hd, xe - PT / 2, zc - PT / 2, { floor: 'concrete', paint: [0.74, 0.76, 0.74] });
			K.room(0, 'evidence', xe + PT / 2, -hd, xl - PT / 2, zc - PT / 2, { floor: 'concrete', paint: [0.8, 0.8, 0.78] });
			K.room(0, 'lockerRoom', xl + PT / 2, -hd, xg - PT / 2, zc - PT / 2, CIVIC);
			K.room(0, 'sallyport', xg + PT / 2, -hd, hw, hd, BAY);
			const wzf = K.wall(0, 'x', zf, -hw, xg);
			K.door(wzf, Math.min(xg - 1, (xo + xg) / 2 + 1.2), 1.1);
			K.door(K.wall(0, 'z', xo, zc, zf), (zc + zf) / 2, 0.95);
			const wzc = K.wall(0, 'x', zc, -hw, xg);
			K.door(wzc, (-hw + xe) / 2, 1.2); K.door(wzc, (xe + xl) / 2, 1.0); K.door(wzc, (xl + xg) / 2, 1.0);
			K.wall(0, 'z', xe, -hd, zc); K.wall(0, 'z', xl, -hd, zc);
			const wg = K.wall(0, 'z', xg, -hd, hd);
			K.door(wg, (zc + zf) / 2, 1.2); K.door(wg, (-hd + zc) / 2, 1.0);
			glaze(K, 0, 'z+', 2.8, 1.6, 1.0, 2.5);
			glaze(K, 0, 'x-', 3.0, 1.2, 1.4, 2.4);
		},
	});
	P.service = 'police'; P.garage = null; P.bay = { x0: xg + 0.6, x1: hw - 0.6 };
	return P;
}

// ---------------------------------------------------------------------------------
export function planFire({ W, D }) {
	const hw = W / 2 - ST.ext, sw = clamp(W * 0.3, 5.5, 8), xb = hw - sw, nb = clamp(Math.floor((xb + hw) / 4.4), 1, 4), bayW = (xb + hw) / nb;
	const bays = [...Array(nb)].map((_, i) => -hw + (i + 0.5) * bayW);
	const P = planShell({
		W, D, use: 'site', style: 'modern', door: { x: (xb + hw) / 2, w: 1.1, h: 2.4 }, levels: [{ y: 0, h: 4.8 }, { y: 5.2, h: 3.2 }], top: 8.8,
		doors: bays.map((u) => ({ side: 'z+', u, w: Math.min(3.8, bayW - 0.7), h: 4.2 })),
		layout: (K) => {
			const { hw, hd } = K;
			const zf = hd - clamp(D * 0.28, 4, 6), zk = -hd + clamp(D * 0.4, 5.5, 8);
			K.room(0, 'apparatus', -hw, -hd, xb - PT / 2, hd, BAY);
			K.room(0, 'watchRoom', xb + PT / 2, zf + PT / 2, hw, hd, CIVIC);
			K.room(0, 'dayRoom', xb + PT / 2, zk + PT / 2, hw, zf - PT / 2, { floor: 'wood', paint: [0.86, 0.8, 0.68] });
			K.room(0, 'hall', xb + PT / 2, -hd, hw, zk - PT / 2, { stairs: true, ...CIVIC });
			const wx = K.wall(0, 'z', xb, -hd, hd);
			K.door(wx, (zf + hd) / 2, 1.0); K.wide(wx, zk + 0.6, Math.min(zf - 0.6, zk + 2.4), 2.4); K.door(wx, (-hd + zk) / 2, 1.2);
			K.door(K.wall(0, 'x', zf, xb, hw), xb + 1.1, 0.95);
			K.door(K.wall(0, 'x', zk, xb, hw), xb + 1.2, 1.0);
			K.flight(0, hw - 1.3, hw - 0.06, -hd + 0.25, zk - 0.45, null, -1);
			// upstairs
			const zg = clamp(0, -hd + 4, hd - 5), xg = -hw + (xb + hw) * 0.4;
			cells(K, 1, 'bunkRoom', -hw, zg + PT / 2, xb - PT / 2, hd, 16, 11, QUARTERS);
			K.room(1, 'showers', -hw, -hd, xg - PT / 2, zg - PT / 2, { floor: 'tile', paint: [0.86, 0.9, 0.9] });
			K.room(1, 'gym', xg + PT / 2, -hd, xb - PT / 2, zg - PT / 2, { floor: 'carpet', paint: [0.7, 0.74, 0.78] });
			K.room(1, 'hall', xb + PT / 2, -hd, hw, zk - PT / 2, { stairs: true, ...CIVIC });
			K.room(1, 'lockerRoom', xb + PT / 2, zk + PT / 2, hw, hd, CIVIC);
			const w1 = K.wall(1, 'z', xb, -hd, hd);
			K.door(w1, (zk + hd) / 2, 1.0); K.door(w1, (-hd + Math.min(zk, zg)) / 2, 1.0);
			const wz = K.wall(1, 'x', zg, -hw, xb);
			K.door(wz, (-hw + xg) / 2, 0.95); K.door(wz, (xg + xb) / 2, 1.0);
			K.wall(1, 'z', xg, -hd, zg);
			K.wide(K.wall(1, 'x', zk, xb, hw), hw - 1.4, hw - 0.1, 2.4);
			K.rail(1, hw - 1.37, -hd + 0.25, hw - 1.3, zk - 0.45);
			// the pole: its hole through the bunk room's floor, a rail round three sides of it
			const px = xb - 1.3, pz = zg + (hd - zg) * 0.35;
			K.hole(1, px - 0.7, pz - 0.7, px + 0.7, pz + 0.7);
			K.rail(1, px - 0.7, pz - 0.75, px + 0.7, pz - 0.7); K.rail(1, px - 0.7, pz + 0.7, px + 0.7, pz + 0.75); K.rail(1, px + 0.7, pz - 0.75, px + 0.75, pz + 0.75);
			K.P.pole = { x: px, z: pz };
			glaze(K, 0, 'x+', 3.0, 1.2, 1.0, 2.4);
			for (const s of ['z+', 'x-', 'x+', 'z-']) glaze(K, 1, s, 2.6, 1.3, 0.9, 2.3);
		},
	});
	P.service = 'fire'; P.bays = bays.map((x) => ({ x, w: Math.min(3.8, bayW - 0.7) }));
	return P;
}

// ---------------------------------------------------------------------------------
export function planArmory({ W, D }) {
	const P = planShell({
		W, D, use: 'site', style: 'modern', door: { x: 0, w: 1.4, h: 2.4 }, levels: [{ y: 0, h: 4.2 }], top: 5.0,
		doors: [{ side: 'z-', u: -W / 4, w: 3.2, h: 3.2 }],
		layout: (K) => {
			const { hw, hd } = K;
			const zf = hd - clamp(D * 0.45, 6.5, 11), hl = clamp(W * 0.1, 1.6, 3);
			K.room(0, 'commsRoom', -hw, zf + PT / 2, -hl - PT / 2, hd, { floor: 'tile', paint: [0.62, 0.66, 0.64] });
			K.room(0, 'guardPost', -hl + PT / 2, zf + PT / 2, hl - PT / 2, hd, DRAB);
			K.room(0, 'warRoom', hl + PT / 2, zf + PT / 2, hw, hd, { floor: 'carpet', paint: [0.42, 0.46, 0.48] });
			cells(K, 0, 'depot', -hw, -hd, hl - PT / 2, zf - PT / 2, 22, 16, DRAB);
			cells(K, 0, 'barracks', hl + PT / 2, -hd, hw, zf - PT / 2, 16, 11, QUARTERS);
			K.door(K.wall(0, 'z', -hl, zf, hd), (zf + hd) / 2, 1.0);
			K.door(K.wall(0, 'z', hl, zf, hd), (zf + hd) / 2, 1.0);
			K.door(K.wall(0, 'x', zf, -hw, hw), 0, Math.min(1.2, 2 * hl - 0.4));
			K.door(K.wall(0, 'z', hl, -hd, zf), (-hd + zf) / 2, 1.2);
			glaze(K, 0, 'z+', 3.0, 1.2, 1.3, 2.4);
			for (const s of ['x-', 'x+']) glaze(K, 0, s, 3.4, 1.0, 1.6, 2.4);
		},
	});
	P.service = 'armory';
	return P;
}

// ---------------------------------------------------------------------------------
// one room-kind at a time, for the military's own buildings (src/military/). A frame is
// { W, D, door? } or the military's own { width, depth, height, ... } (services/index.js
// militaryInteriors() places and builds one from its origin and yaw)
const sizeOf = (f = {}) => ({ W: f.W ?? f.width ?? 20, D: f.D ?? f.depth ?? 16, door: f.door || null });

// a command post: the guard post inside the door, the war room and its comms room behind
export function buildWarRoom(frame) {
	const { W, D, door } = sizeOf(frame);
	const P = planShell({
		W, D, use: 'site', style: 'modern', door: door || { x: 0, w: 1.4, h: 2.4 }, levels: [{ y: 0, h: 3.8 }], top: 4.6,
		layout: (K) => {
			const { hw, hd } = K, zf = hd - clamp(D * 0.24, 3, 4.5), xc = hw - clamp(2 * hw * 0.32, 3.5, 7);
			K.room(0, 'guardPost', -hw, zf + PT / 2, hw, hd, DRAB);
			K.room(0, 'warRoom', -hw, -hd, xc - PT / 2, zf - PT / 2, { floor: 'carpet', paint: [0.42, 0.46, 0.48] });
			K.room(0, 'commsRoom', xc + PT / 2, -hd, hw, zf - PT / 2, { floor: 'tile', paint: [0.62, 0.66, 0.64] });
			const wf = K.wall(0, 'x', zf, -hw, hw);
			K.door(wf, (-hw + xc) / 2, 1.4); K.door(wf, (xc + hw) / 2, 1.0);
			K.door(K.wall(0, 'z', xc, -hd, zf), (-hd + zf) / 2, 1.0);
			for (const s of ['x-', 'x+']) glaze(K, 0, s, 3.4, 1.0, 1.6, 2.4);
		},
	});
	P.service = 'armory';
	return P;
}
// a supply depot: one hall of racks, the quartermaster's cage by the door, a gate at the back
export function buildDepot(frame) {
	const { W, D, door } = sizeOf(frame);
	const P = planShell({
		W, D, use: 'site', style: 'plain', door: door || { x: -W / 4, w: 1.2, h: 2.4 }, levels: [{ y: 0, h: 5.2 }], top: 5.8,
		doors: [{ side: 'z-', u: 0, w: Math.min(4, W * 0.3), h: 4 }],
		layout: (K) => {
			const { hw, hd } = K, zq = hd - clamp(D * 0.25, 3.2, 5), xq = -hw + clamp(W * 0.3, 3.5, 6);
			K.room(0, 'guardPost', -hw, zq + PT / 2, xq - PT / 2, hd, DRAB);
			K.room(0, 'depot', -hw, -hd, hw, zq - PT / 2, DRAB);
			K.room(0, 'depot', xq + PT / 2, zq + PT / 2, hw, hd, DRAB);
			K.wide(K.wall(0, 'x', zq, -hw, xq), -hw + 0.6, xq - 0.6, 2.4);
			K.wide(K.wall(0, 'z', xq, zq, hd), zq + 0.6, hd - 0.6, 3);
			K.wide(K.wall(0, 'x', zq, xq, hw), xq + 0.6, hw - 0.6, 3.2);
			glaze(K, 0, 'x-', 6, 1.2, 3.6, 4.6); glaze(K, 0, 'x+', 6, 1.2, 3.6, 4.6);
		},
	});
	P.service = 'armory';
	return P;
}
// quarters: the mess hall at the front, the bunk room, the gym, showers and lockers behind
export function buildBarracks(frame) {
	const { W, D, door } = sizeOf(frame);
	const P = planShell({
		W, D, use: 'site', style: 'modern', door: door || { x: 0, w: 1.4, h: 2.4 }, levels: [{ y: 0, h: 3.4 }], top: 4.2,
		layout: (K) => {
			const { hw, hd } = K, zm = hd - clamp(D * 0.3, 4.5, 8), zb = -hd + clamp(D * 0.28, 4, 6.5);
			const x1 = -hw + 2 * hw * 0.38, x2 = x1 + 2 * hw * 0.28;
			K.room(0, 'messHall', -hw, zm + PT / 2, hw, hd, { floor: 'tile', paint: [0.8, 0.78, 0.7] });
			K.room(0, 'barracks', -hw, zb + PT / 2, hw, zm - PT / 2, QUARTERS);
			K.room(0, 'gym', -hw, -hd, x1 - PT / 2, zb - PT / 2, { floor: 'carpet', paint: [0.7, 0.72, 0.7] });
			K.room(0, 'showers', x1 + PT / 2, -hd, x2 - PT / 2, zb - PT / 2, { floor: 'tile', paint: [0.86, 0.9, 0.9] });
			K.room(0, 'lockerRoom', x2 + PT / 2, -hd, hw, zb - PT / 2, DRAB);
			K.wide(K.wall(0, 'x', zm, -hw, hw), -1.2, 1.2, 2.4);
			const wb = K.wall(0, 'x', zb, -hw, hw);
			K.door(wb, (-hw + x1) / 2, 1.0); K.door(wb, (x1 + x2) / 2, 0.95); K.door(wb, (x2 + hw) / 2, 1.0);
			K.wall(0, 'z', x1, -hd, zb); K.wall(0, 'z', x2, -hd, zb);
			for (const s of ['z+', 'x-', 'x+']) glaze(K, 0, s, 3.0, 1.2, 1.0, 2.3);
		},
	});
	P.service = 'armory';
	return P;
}

export const PLANS = { hospital: planHospital, police: planPolice, fire: planFire, armory: planArmory };
