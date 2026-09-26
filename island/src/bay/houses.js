// Real houses up close. Within a few dozen metres of you, each house in the mapped
// suburbs (San Ramon, Danville, the Tri-Valley) stops being a painted block and is built
// for real from its footprint (houseplan.js): stucco walls with thickness, windows with
// frames, sills and glass, a front door and garage doors that open (E), a stoop, gutters
// and downspouts, and inside, every room of the plan, with its floor, walls, ceiling,
// stairs, doors and furniture. The far block dissolves into the near house over a band
// of distance (the same screen-noise hand-over the trees use), so nothing pops. The
// walls, doors, railings, stairs and furniture are solid; the floors and stairs carry you.

import * as THREE from 'three';
import { planHouse, houseFloor, mainOf, HT, TW } from './houseplan.js';
import { Builder, houseMaterials, drawItem, lin } from './housekit.js';
import { carGeometry, carMaterial } from './cars.js';
import { NONE_IN } from '../world/lodfade.js';

const FLOOR = { living: 'wood', dining: 'wood', family: 'wood', office: 'wood', entry: 'tile', hall: 'wood', loft: 'carpet', kitchen: 'tile', bath: 'tile', mbath: 'tile', powder: 'tile', laundry: 'tile', bed: 'carpet', master: 'carpet', closet: 'carpet', garage: 'concrete' };
const PAINTS = [[0.93, 0.91, 0.86], [0.9, 0.88, 0.82], [0.87, 0.85, 0.79], [0.94, 0.93, 0.9], [0.86, 0.84, 0.8]];
const KIDS = [[0.74, 0.84, 0.9], [0.8, 0.88, 0.76], [0.93, 0.82, 0.84], [0.84, 0.8, 0.9], [0.95, 0.9, 0.72]];
const CAR_PAINT = [[0.92, 0.92, 0.9], [0.08, 0.08, 0.09], [0.45, 0.46, 0.48], [0.7, 0.71, 0.72], [0.2, 0.28, 0.45], [0.55, 0.1, 0.1]];

export function createHouses(scene, bay, real, city, { isPhone = false, night = { value: 0 } } = {}) {
	// the hand-over band: the near house fills in as the far block thins out
	const band = isPhone ? [NONE_IN[0], NONE_IN[1], 24, 32] : [NONE_IN[0], NONE_IN[1], 36, 46];
	const BUILD_R = band[3] + 10, DROP_R = BUILD_R + 25, MAX = isPhone ? 6 : 12;
	const M = houseMaterials(band);
	city?.setNearBand?.(band[2], band[3]);
	const group = new THREE.Group();
	group.name = 'houses';
	scene.add(group);
	const houses = new Map();       // a house's block list (grp) -> the built house, or null if it has no plan
	// after dark, real lamps in the lit rooms nearest you (a fixed few, so no shader rebuilds)
	const lamps = [...Array(isPhone ? 2 : 4)].map(() => { const l = new THREE.PointLight(0xffc88a, 0, 7.5, 1.6); scene.add(l); return l; });
	const carMats = new Map();

	// ---------------------------------------------------------------------------
	// building one house

	// a generator: it yields between steps, so a house is built over a few frames
	function* build(grp) {
		const plan = planHouse(grp);
		if (!plan) return null;
		yield;
		const H = bay.heightAt;
		const Mb = plan.M, ca = plan.ca, sa = plan.sa;
		const floorY = houseFloor(grp, H);
		const toW = (lx, lz) => [Mb.x + ca * lx - sa * lz, Mb.z + sa * lx + ca * lz];
		const gl = (lx, lz) => { const [x, z] = toW(lx, lz); return H(x, z) - floorY; };
		let base = 0;
		for (const r of plan.rects) for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]) base = Math.min(base, gl(x, z));
		base -= 0.3;
		const rnd = plan.rnd;
		const g = new Builder();
		const col = [];                 // colliders: [x0, z0, x1, z1, y0, y1] in the house frame
		const doors = [];
		const look = city?.houseLook?.(Mb) || { wall: [0.88, 0.84, 0.76], roof: [0.3, 0.3, 0.32] };
		const WALL = lin(look.wall), WHITE = lin([0.94, 0.93, 0.9]), TRIM = lin(rnd() < 0.8 ? [0.95, 0.94, 0.91] : [0.42, 0.36, 0.3]);
		const FOAM = lin(look.wall.map((c) => Math.min(1, c * 1.08 + 0.03)));
		const paint = plan.rooms.map((r) => lin(r.type === 'garage' ? [0.82, 0.8, 0.76] : r.type === 'bed' && rnd() < 0.6 ? KIDS[Math.floor(rnd() * KIDS.length)] : PAINTS[Math.floor(rnd() * PAINTS.length)]));
		const lv = (L) => (L ? HT.floor1 : 0);
		// which rooms have a light on after dark
		const lit = plan.rooms.map((r) => rnd() < (r.type === 'garage' || r.type === 'closet' ? 0.08 : r.level ? 0.45 : 0.6));
		const wallKey = (room) => (lit[room] ? 'paintLit' : 'paint');
		const root = new THREE.Group();
		root.position.set(Mb.x, floorY, Mb.z);
		root.rotation.y = -Mb.a;

		// ---- walls, cut round their openings
		let step = 0;
		for (const w of plan.walls) {
			if (++step % 14 === 0) yield;
			const L = w.level, y0w = w.kind === 'ext' && L === 0 ? base : w.yb, y1w = w.yt;
			let a0, a1;
			if (w.kind === 'ext') { a0 = w.inSide > 0 ? w.pos : w.pos - TW.ext; a1 = w.inSide > 0 ? w.pos + TW.ext : w.pos; }
			else { a0 = w.pos - TW.part / 2; a1 = w.pos + TW.part / 2; }
			// which face shows what: the + side and the - side across the wall
			const plusRoom = w.kind === 'ext' ? (w.inSide > 0 ? w.room : -1) : w.rb, minusRoom = w.kind === 'ext' ? (w.inSide < 0 ? w.room : -1) : w.ra;
			const across = w.axis === 'x' ? [4, 5] : [0, 1];
			const keyF = (f) => (f === across[0] ? (plusRoom >= 0 ? wallKey(plusRoom) : 'stucco') : f === across[1] ? (minusRoom >= 0 ? wallKey(minusRoom) : 'stucco') : f === 3 ? null : 'paint');
			const colF = (f) => (f === across[0] ? (plusRoom >= 0 ? paint[plusRoom] : WALL) : f === across[1] ? (minusRoom >= 0 ? paint[minusRoom] : WALL) : WHITE);
			const cuts = [w.s, w.e];
			for (const o of w.open) cuts.push(Math.max(w.s, Math.min(w.e, o.s0)), Math.max(w.s, Math.min(w.e, o.s1)));
			cuts.sort((p, q) => p - q);
			for (let i = 0; i < cuts.length - 1; i++) {
				const u0 = cuts[i], u1 = cuts[i + 1];
				if (u1 - u0 < 0.004) continue;
				const um = (u0 + u1) / 2, gaps = w.open.filter((o) => o.s0 < um && o.s1 > um).map((o) => [o.y0, o.y1]).sort((p, q) => p[0] - q[0]);
				let y = y0w;
				for (const [gy0, gy1] of [...gaps, [y1w, y1w]]) {
					if (gy0 > y + 0.004) piece(u0, u1, y, Math.min(gy0, y1w));
					y = Math.max(y, gy1);
				}
			}
			function piece(u0, u1, y0, y1) {
				if (w.axis === 'x') g.box(keyF, u0, y0, a0, u1, y1, a1, colF); else g.box(keyF, a0, y0, u0, a1, y1, u1, colF);
				col.push(w.axis === 'x' ? [u0, a0, u1, a1, y0, y1] : [a0, u0, a1, u1, y0, y1]);
				// baseboards along the floor, on the room sides
				if (y0 <= lv(L) + 0.01) for (const [room, face, sgn] of [[plusRoom, a1, 1], [minusRoom, a0, -1]]) {
					if (room < 0 || plan.rooms[room].type === 'garage') continue;
					const f1 = face + sgn * 0.013, y = lv(L);
					if (w.axis === 'x') g.box('trim', u0, y, Math.min(face, f1), u1, y + 0.09, Math.max(face, f1), TRIM);
					else g.box('trim', Math.min(face, f1), y, u0, Math.max(face, f1), y + 0.09, u1, TRIM);
				}
			}
			// the openings' dressing
			for (const o of w.open) dress(w, o, a0, a1, plusRoom, minusRoom);
			// a band of bare concrete at the foot of the outside walls
			if (w.kind === 'ext' && L === 0) {
				const out = w.inSide > 0 ? a0 : a1, f1 = out - w.inSide * 0.012;
				let s = w.s;
				for (const o of [...w.open.filter((q) => q.y0 < 0.05).sort((p, q) => p.s0 - q.s0), { s0: w.e, s1: w.e }]) {
					if (o.s0 > s + 0.01) {
						if (w.axis === 'x') g.box('concrete', s, base, Math.min(out, f1), o.s0, 0.12, Math.max(out, f1), lin([0.62, 0.61, 0.58]));
						else g.box('concrete', Math.min(out, f1), base, s, Math.max(out, f1), 0.12, o.s0, lin([0.62, 0.61, 0.58]));
					}
					s = Math.max(s, o.s1);
				}
			}
		}

		// a box in a wall's frame: u along it, a across it (house coordinates)
		function wbox(w, key, u0, u1, y0, y1, c0, c1, colr) {
			if (w.axis === 'x') g.box(key, u0, y0, Math.min(c0, c1), u1, y1, Math.max(c0, c1), colr);
			else g.box(key, Math.min(c0, c1), y0, u0, Math.max(c0, c1), y1, u1, colr);
		}
		function dress(w, o, a0, a1, plusRoom, minusRoom) {
			const ext = w.kind === 'ext', out = ext ? (w.inSide > 0 ? a0 : a1) : a0, inn = ext ? (w.inSide > 0 ? a1 : a0) : a1, sgn = ext ? w.inSide : 1;
			if (o.type === 'window' || o.type === 'slider') {
				// the frame, set back from the outside face, and the glass in it
				const f0 = out + sgn * 0.03, f1 = out + sgn * 0.1, fw = 0.05;
				wbox(w, 'trim', o.s0, o.s1, o.y0, o.y0 + fw, f0, f1, TRIM);
				wbox(w, 'trim', o.s0, o.s1, o.y1 - fw, o.y1, f0, f1, TRIM);
				wbox(w, 'trim', o.s0, o.s0 + fw, o.y0, o.y1, f0, f1, TRIM);
				wbox(w, 'trim', o.s1 - fw, o.s1, o.y0, o.y1, f0, f1, TRIM);
				const wide = o.s1 - o.s0 > 1.1 && o.type === 'window';
				if (wide) wbox(w, 'trim', (o.s0 + o.s1) / 2 - 0.025, (o.s0 + o.s1) / 2 + 0.025, o.y0, o.y1, f0 - sgn * 0.01, f1 + sgn * 0.01, TRIM);
				if (o.type === 'window' && o.y1 - o.y0 > 1.2 && !wide) wbox(w, 'trim', o.s0, o.s1, (o.y0 + o.y1) / 2 - 0.02, (o.y0 + o.y1) / 2 + 0.02, f0, f1, TRIM);
				const gz = out + sgn * 0.065, g0 = o.type === 'slider' ? (o.s0 + o.s1) / 2 : o.s0 + fw;
				wbox(w, o.frosted ? 'frost' : 'glass', g0, o.s1 - fw, o.y0 + fw, o.y1 - fw, gz - 0.003, gz + 0.003, WHITE);
				const c0 = o.type === 'slider' ? (o.s0 + o.s1) / 2 : o.s0;
				col.push(w.axis === 'x' ? [c0, Math.min(a0, a1), o.s1, Math.max(a0, a1), o.y0, o.y1] : [Math.min(a0, a1), c0, Math.max(a0, a1), o.s1, o.y0, o.y1]);
				if (o.type === 'window') {
					// outside: a sill and a foam surround; inside: a stool
					wbox(w, 'stucco', o.s0 - 0.12, o.s1 + 0.12, o.y0 - 0.07, o.y0, out, out - sgn * 0.06, FOAM);
					wbox(w, 'stucco', o.s0 - 0.1, o.s1 + 0.1, o.y1, o.y1 + 0.1, out, out - sgn * 0.025, FOAM);
					wbox(w, 'stucco', o.s0 - 0.1, o.s0, o.y0, o.y1, out, out - sgn * 0.025, FOAM);
					wbox(w, 'stucco', o.s1, o.s1 + 0.1, o.y0, o.y1, out, out - sgn * 0.025, FOAM);
					wbox(w, 'trim', o.s0 - 0.04, o.s1 + 0.04, o.y0 - 0.02, o.y0 + 0.01, f1, inn + sgn * 0.04, TRIM);
					// blinds, some partly drawn
					if (rnd() < 0.55) {
						const k = 0.15 + rnd() * 0.75, bz = inn - sgn * 0.02;
						wbox(w, 'blinds', o.s0 + 0.02, o.s1 - 0.02, o.y1 - (o.y1 - o.y0) * k, o.y1 - 0.02, bz - 0.004, bz + 0.004, WHITE);
					}
				}
				// curtains in the living rooms and bedrooms
				const room = plan.rooms[w.room];
				if (room && ['living', 'master', 'family', 'dining', 'bed'].includes(room.type) && rnd() < 0.5) {
					const cc = lin([[0.85, 0.82, 0.74], [0.6, 0.62, 0.64], [0.45, 0.3, 0.25], [0.8, 0.8, 0.78]][Math.floor(rnd() * 4)]), cz0 = inn + sgn * 0.05, cz1 = inn + sgn * 0.13, top = Math.min(o.y1 + 0.2, lv(w.level) + (w.level ? HT.ceil1 - HT.floor1 : HT.ceil0) - 0.05);
					wbox(w, 'fabric', o.s0 - 0.35, o.s0 + 0.05, lv(w.level) + 0.02, top, cz0, cz1, cc);
					wbox(w, 'fabric', o.s1 - 0.05, o.s1 + 0.35, lv(w.level) + 0.02, top, cz0, cz1, cc);
					wbox(w, 'metal', o.s0 - 0.4, o.s1 + 0.4, top + 0.02, top + 0.045, cz0 + sgn * 0.03, cz0 + sgn * 0.055, lin([0.2, 0.2, 0.2]));
				}
				if (o.type === 'slider') doors.push(slidingDoor(w, o, gz, sgn));
				return;
			}
			if (o.type === 'wide' || o.type === 'door' || o.type === 'front') {
				// casings on the room sides
				const cw = 0.07;
				for (const [face, s2, room] of [[a1, 1, plusRoom], [a0, -1, minusRoom]]) {
					if (room < 0) {
						// outside the front door: a foam surround and a light
						if (o.type === 'front') {
							wbox(w, 'stucco', o.s0 - 0.14, o.s0, 0, o.y1 + 0.14, face, face + s2 * 0.03, FOAM);
							wbox(w, 'stucco', o.s1, o.s1 + 0.14, 0, o.y1 + 0.14, face, face + s2 * 0.03, FOAM);
							wbox(w, 'stucco', o.s0 - 0.14, o.s1 + 0.14, o.y1, o.y1 + 0.14, face, face + s2 * 0.03, FOAM);
							wbox(w, 'metal', o.s1 + 0.3, o.s1 + 0.46, 1.75, 2.05, face, face + s2 * 0.16, lin([0.12, 0.11, 0.1]));
							wbox(w, 'lamp', o.s1 + 0.32, o.s1 + 0.44, 1.8, 2.0, face + s2 * 0.02, face + s2 * 0.14, lin([0.98, 0.9, 0.7]));
							wbox(w, 'matte', o.s0 - 0.45, o.s0 - 0.2, 1.5, 1.62, face, face + s2 * 0.02, lin([0.12, 0.12, 0.12]));
						}
						continue;
					}
					if (plan.rooms[room].type === 'garage' && o.type !== 'door') continue;
					const f1 = face + s2 * 0.015;
					wbox(w, 'trim', o.s0 - cw, o.s0, lv(w.level), o.y1 + cw, face, f1, TRIM);
					wbox(w, 'trim', o.s1, o.s1 + cw, lv(w.level), o.y1 + cw, face, f1, TRIM);
					wbox(w, 'trim', o.s0 - cw, o.s1 + cw, o.y1, o.y1 + cw, face, f1, TRIM);
				}
				if (o.type === 'door' || o.type === 'front') doors.push(swingDoor(w, o, a0, a1));
				return;
			}
			if (o.type === 'garage') {
				wbox(w, 'stucco', o.s0 - 0.15, o.s0, 0, o.y1 + 0.15, out, out - sgn * 0.035, FOAM);
				wbox(w, 'stucco', o.s1, o.s1 + 0.15, 0, o.y1 + 0.15, out, out - sgn * 0.035, FOAM);
				wbox(w, 'stucco', o.s0 - 0.15, o.s1 + 0.15, o.y1, o.y1 + 0.15, out, out - sgn * 0.035, FOAM);
				doors.push(garageDoor(w, o, out, sgn));
			}
		}

		// a hinged door: a pivot at the hinge, turned so the leaf runs along +x from it and
		// swings open toward -z (or +z, with sign)
		function swingDoor(w, o, a0, a1) {
			const cn = o.conn, front = o.type === 'front';
			const width = o.s1 - o.s0, h = front ? 2.08 : HT.door - 0.01, t = front ? 0.045 : 0.035;
			// hinge end and the side it opens to
			const hingeAtS0 = front ? (plan.stairs && plan.stairs.x0 > o.s1 ? false : true) : (cn?.hinge ?? -1) < 0;
			let swing = front ? -1 : Math.sign(cn?.swing || 1);        // front doors open inward (toward -z)
			if (!front && cn) {
				// swing into the room the door serves: cn.a, on side cn.swing of the run
				swing = cn.swing;
			}
			const mid = (a0 + a1) / 2;
			const hp = hingeAtS0 ? o.s0 + 0.02 : o.s1 - 0.02, along = hingeAtS0 ? 1 : -1;
			const pivot = new THREE.Group();
			const hx = w.axis === 'x' ? hp : mid, hz = w.axis === 'x' ? mid : hp;
			pivot.position.set(hx, lv(w.level), hz);
			// local x along the wall from the hinge
			const ax = w.axis === 'x' ? [along, 0] : [0, along];
			const phi = Math.atan2(-ax[1], ax[0]);
			pivot.rotation.y = phi;
			// local -z points to: (-sin phi, -cos phi)
			const mz = [-Math.sin(phi), -Math.cos(phi)], sideDir = w.axis === 'x' ? [0, swing] : [swing, 0];
			const sign = mz[0] * sideDir[0] + mz[1] * sideDir[1] > 0 ? 1 : -1;
			const b = new Builder();
			const dc = front ? lin(pick3(rnd, [[0.42, 0.12, 0.1], [0.12, 0.18, 0.28], [0.36, 0.24, 0.15], [0.16, 0.22, 0.18], [0.9, 0.9, 0.86]])) : WHITE;
			b.box(front ? 'door6' : 'door6', 0, 0, -t / 2, width - 0.04, h, t / 2, dc);
			// the knob, both sides
			for (const sz of [-1, 1]) b.cyl('door6', width - 0.12, 0.98, sz * t / 2, 0.028, sz * 0.06, lin([0.72, 0.62, 0.4]), 8, 'z');
			for (const m of b.meshes(M)) pivot.add(m);
			root.add(pivot);
			const open0 = front ? 0 : ['bath', 'mbath', 'powder', 'closet', 'laundry'].includes(plan.rooms[cn?.a]?.type) && rnd() < 0.5 ? 0.12 : rnd() < 0.15 ? 0 : 0.75 + rnd() * 0.2;
			const D = { kind: front ? 'front' : 'door', pivot, sign, open: open0, target: open0, maxA: Math.PI * 0.5, level: w.level,
				at: [w.axis === 'x' ? (o.s0 + o.s1) / 2 : mid, lv(w.level) + 1, w.axis === 'x' ? mid : (o.s0 + o.s1) / 2],
				box: w.axis === 'x' ? [o.s0, Math.min(a0, a1) - 0.02, o.s1, Math.max(a0, a1) + 0.02] : [Math.min(a0, a1) - 0.02, o.s0, Math.max(a0, a1) + 0.02, o.s1] };
			D.apply = () => { pivot.rotation.y = phi + D.sign * D.open * D.maxA; };
			D.apply();
			return D;
		}
		// a sectional garage door: up and back under the ceiling
		function garageDoor(w, o, out, sgn) {
			const width = o.s1 - o.s0, h = o.y1;
			const pivot = new THREE.Group(), zIn = out + sgn * 0.06;
			const cx = (o.s0 + o.s1) / 2;
			pivot.position.set(w.axis === 'x' ? cx : zIn, h, w.axis === 'x' ? zIn : cx);
			// local frame: x along the door, -y down the leaf, +z out of the house
			const phi = w.axis === 'x' ? (sgn < 0 ? 0 : Math.PI) : (sgn < 0 ? Math.PI / 2 : -Math.PI / 2);
			pivot.rotation.y = phi;
			const leaf = new THREE.Group();
			pivot.add(leaf);
			const b = new Builder();
			b.box('garage', -width / 2, -h, -0.03, width / 2, 0, 0.0, lin(look.garage || [0.93, 0.92, 0.88]));
			for (const m of b.meshes(M)) leaf.add(m);
			root.add(pivot);
			const D = { kind: 'garage', pivot, leaf, open: 0, target: 0, level: 0, h,
				at: [w.axis === 'x' ? cx : out, 1.1, w.axis === 'x' ? out : cx],
				box: w.axis === 'x' ? [o.s0, Math.min(out, zIn) - 0.05, o.s1, Math.max(out, zIn) + 0.05] : [Math.min(out, zIn) - 0.05, o.s0, Math.max(out, zIn) + 0.05, o.s1] };
			// it rolls up and back: the top edge runs in under the ceiling as the leaf tips flat
			D.apply = () => { const f = D.open; leaf.position.set(0, 0, -f * h); leaf.rotation.x = -f * Math.PI / 2; };
			D.apply();
			return D;
		}
		// the slider to the back yard: one fixed panel, one that slides behind it
		function slidingDoor(w, o, gz, sgn) {
			const width = (o.s1 - o.s0) / 2 + 0.03, h = o.y1 - o.y0;
			const pivot = new THREE.Group();
			pivot.position.set(w.axis === 'x' ? o.s0 : gz + sgn * 0.035, o.y0, w.axis === 'x' ? gz + sgn * 0.035 : o.s0);
			if (w.axis !== 'x') pivot.rotation.y = -Math.PI / 2;
			const b = new Builder();
			b.box('trim', 0, 0, -0.02, 0.05, h, 0.02, TRIM); b.box('trim', width - 0.05, 0, -0.02, width, h, 0.02, TRIM);
			b.box('trim', 0, 0, -0.02, width, 0.06, 0.02, TRIM); b.box('trim', 0, h - 0.05, -0.02, width, h, 0.02, TRIM);
			b.box('glass', 0.05, 0.06, -0.003, width - 0.05, h - 0.05, 0.003, WHITE);
			b.box('metal', 0.07, 0.9, 0.02, 0.09, 1.2, 0.05, lin([0.3, 0.3, 0.3]));
			for (const m of b.meshes(M)) pivot.add(m);
			root.add(pivot);
			const D = { kind: 'slider', pivot, open: 0, target: 0, level: w.level, x0: pivot.position.clone(), dir: w.axis === 'x' ? [1, 0] : [0, 1], width,
				at: [w.axis === 'x' ? o.s0 + width / 2 : gz, lv(w.level) + 1, w.axis === 'x' ? gz : o.s0 + width / 2],
				box: w.axis === 'x' ? [o.s0, gz - 0.12, o.s0 + width, gz + 0.12] : [gz - 0.12, o.s0, gz + 0.12, o.s0 + width] };
			D.apply = () => { const d = D.open * (width - 0.1); pivot.position.set(D.x0.x + D.dir[0] * d, D.x0.y, D.x0.z + D.dir[1] * d); };
			D.apply();
			return D;
		}

		yield;
		// floors and ceilings, open over the stairwell
		const { X, Z, nx, nz, labels, rooms } = plan;
		const cellRects = (L, keyOf) => {
			// greedy: runs along x, then stacked where they match
			const out = [], open = new Map();
			for (let j = 0; j < nz; j++) {
				const runs = [];
				for (let i = 0; i < nx;) {
					const k = keyOf(i + j * nx);
					if (k === null) { i++; continue; }
					let e = i;
					while (e + 1 < nx && keyOf(e + 1 + j * nx) === k) e++;
					runs.push([i, e, k]); i = e + 1;
				}
				const next = new Map();
				for (const [i0, i1, k] of runs) {
					const id = i0 + ':' + i1 + ':' + k, r = open.get(id);
					if (r) { r[3] = j; next.set(id, r); } else { const n = [i0, i1, j, j, k]; out.push(n); next.set(id, n); }
				}
				open.clear(); for (const [k, v] of next) open.set(k, v);
			}
			return out.map(([i0, i1, j0, j1, k]) => ({ x0: X[i0], x1: X[i1 + 1], z0: Z[j0], z1: Z[j1 + 1], k }));
		};
		const cxz = (c) => [(X[c % nx] + X[c % nx + 1]) / 2, (Z[Math.floor(c / nx)] + Z[Math.floor(c / nx) + 1]) / 2];
		const st = plan.stairs;
		const inWell = (c) => { if (!st) return false; const [x, z] = cxz(c); return x > st.x0 && x < st.x1 && z > st.zt && z < st.zb; };
		const FT = { wood: lin(pick3(rnd, [[0.78, 0.6, 0.42], [0.5, 0.36, 0.25], [0.66, 0.6, 0.55], [0.85, 0.72, 0.55]])), tile: lin(pick3(rnd, [[0.9, 0.86, 0.78], [0.75, 0.73, 0.7], [0.86, 0.8, 0.7]])), carpet: lin(pick3(rnd, [[0.78, 0.74, 0.66], [0.62, 0.62, 0.6], [0.7, 0.66, 0.6]])), concrete: lin([0.72, 0.71, 0.68]) };
		const upOver = (c) => plan.onLevel(c, 1);
		for (const L of [0, 1]) {
			const lab = labels[L], y = lv(L), yc = L ? HT.ceil1 : HT.ceil0;
			for (const r of cellRects(L, (c) => (lab[c] >= 0 && !(L === 1 && inWell(c)) ? lab[c] : null))) {
				const room = rooms[r.k], fk = L === 1 && room.type === 'hall' ? 'carpet' : FLOOR[room.type] || 'wood';
				g.quad(fk, [r.x0, y, r.z0], [r.x1, y, r.z0], [r.x1, y, r.z1], [r.x0, y, r.z1], [0, 1, 0], FT[fk], [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]);
			}
			for (const r of cellRects(L, (c) => (lab[c] >= 0 && !(L === 0 && inWell(c) && upOver(c)) ? (lit[lab[c]] ? 2 : 1) : null))) g.quad(r.k === 2 ? 'ceilingLit' : 'ceiling', [r.x0, yc, r.z0], [r.x1, yc, r.z0], [r.x1, yc, r.z1], [r.x0, yc, r.z1], [0, -1, 0], lin([0.95, 0.95, 0.93]), [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]);
		}
		// stairs: treads, risers, a closed side; the rail on the open side; the well's edges
		if (st) {
			const R = st.R, T = st.T, n = st.n;
			for (let k = 0; k < n - 1; k++) {
				const z1 = st.zb - k * T, z0 = z1 - T, y = (k + 1) * R;
				g.box((f) => (f === 2 ? 'wood' : f === 4 ? 'trim' : f === 3 ? null : 'paint'), st.x0, 0, z0, st.x1, y, z1, (f) => (f === 2 ? FT.wood : f === 4 ? WHITE : paint[labels[0][plan.cellAt((st.x0 + st.x1) / 2, (z0 + z1) / 2)]] || WHITE));
				g.box('wood', st.x0, y - 0.03, z1 - 0.02, st.x1, y, z1 + 0.02, FT.wood);
			}
			// the edges of the well between the ceiling and the floor above
			const sl = (x0, z0, x1, z1, n2) => g.quad('paint', [x0, HT.ceil0, z0], [x1, HT.ceil0, z1], [x1, HT.floor1, z1], [x0, HT.floor1, z0], n2, WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
			sl(st.x0, st.zb, st.x1, st.zb, [0, 0, -1]); sl(st.x0, st.zt, st.x1, st.zt, [0, 0, 1]);
			sl(st.x0, st.zt, st.x0, st.zb, [1, 0, 0]); sl(st.x1, st.zt, st.x1, st.zb, [-1, 0, 0]);
			// rails where the stair's side or the well's edge is open to the room
			const railCol = lin([0.3, 0.22, 0.16]);
			const sameRoom = (L, x, z, xr, zr) => { const a = plan.cellAt(x, z), b = plan.cellAt(xr, zr); return a >= 0 && b >= 0 && labels[L][a] >= 0 && labels[L][a] === labels[L][b]; };
			for (const [xs, dx] of [[st.x0, -1], [st.x1, 1]]) {
				const zm = (st.zb + st.zt) / 2, xr = xs + dx * 0.02;
				// the stair's own side, down in the entry
				if (sameRoom(0, xs + dx * 0.3, zm, (st.x0 + st.x1) / 2, zm)) {
					for (let k = 0; k < n - 1; k++) {
						const zc = st.zb - (k + 0.5) * T, y = (k + 1) * R;
						g.box('trim', xr - 0.018, y, zc - 0.018, xr + 0.018, y + 0.86, zc + 0.018, WHITE);
					}
					g.box('grain', xr - 0.05, 0, st.zb - 0.1, xr + 0.05, 1.05, st.zb, railCol);
					g.beam('grain', [xr, R + 0.88, st.zb - 0.05], [xr, HT.floor1 + 0.88, st.zt], 0.06, 0.06, railCol);
					col.push([Math.min(xs, xr) - 0.04, st.zt, Math.max(xs, xr) + 0.04, st.zb, 0, HT.floor1 + 1]);
				}
				// upstairs, along the well
				if (sameRoom(1, xs + dx * 0.3, zm, xs + dx * 0.3, st.zt - 0.3)) railing(xr, st.zt, xr, st.zb, 'z');
			}
			if (sameRoom(1, (st.x0 + st.x1) / 2, st.zb + 0.3, (st.x0 + st.x1) / 2, st.zt - 0.3)) railing(st.x0, st.zb + 0.02, st.x1, st.zb + 0.02, 'x');
			function railing(x0, z0, x1, z1, axis) {
				const L = axis === 'x' ? x1 - x0 : z1 - z0, y = HT.floor1;
				for (let u = 0.06; u < L; u += 0.12) { const x = axis === 'x' ? x0 + u : x0, z = axis === 'x' ? z0 : z0 + u; g.box('trim', x - 0.018, y, z - 0.018, x + 0.018, y + 0.9, z + 0.018, WHITE); }
				if (axis === 'x') g.box('grain', x0, y + 0.9, z0 - 0.035, x1, y + 0.96, z0 + 0.035, railCol); else g.box('grain', x0 - 0.035, y + 0.9, z0, x0 + 0.035, y + 0.96, z1, railCol);
				col.push(axis === 'x' ? [x0, z0 - 0.05, x1, z0 + 0.05, y, y + 1] : [x0 - 0.05, z0, x0 + 0.05, z1, y, y + 1]);
			}
		}

		yield;
		// the stoop and its steps at the front door, an apron at the garage
		const D0 = plan.door;
		const stoop = [];
		{
			const gz = gl(D0.x, D0.z + 1.4), drop = -gz;
			const x0 = D0.x - 0.95, x1 = D0.x + 0.95;
			g.box('concrete', x0, base, D0.z, x1, 0, D0.z + 1.3, lin([0.7, 0.69, 0.66]));
			stoop.push([x0, D0.z, x1, D0.z + 1.3, 0]);
			const ns = Math.min(14, Math.max(0, Math.ceil(drop / 0.18 - 0.4)));
			for (let k = 1; k <= ns; k++) {
				const y = -drop * k / (ns + 1), z0 = D0.z + 1.3 + (k - 1) * 0.3;
				g.box('concrete', x0 + 0.1, base, z0, x1 - 0.1, y, z0 + 0.3, lin([0.68, 0.67, 0.64]));
				stoop.push([x0 + 0.1, z0, x1 - 0.1, z0 + 0.3, y]);
			}
		}
		if (plan.garage) {
			const G = plan.garage;
			g.box('concrete', G.x0, base, G.front, G.x1, 0, G.front + 0.6, lin([0.66, 0.65, 0.62]));
			stoop.push([G.x0, G.front, G.x1, G.front + 0.6, 0]);
		}

		// gutters and fascia along the eaves that face the outside, a downspout at a corner
		for (const r of plan.rects) {
			const y = r.top;
			const sides = [['z', r.z1, r.x0, r.x1, 1], ['z', r.z0, r.x0, r.x1, -1]];
			if (r.b.hip) sides.push(['x', r.x1, r.z0, r.z1, 1], ['x', r.x0, r.z0, r.z1, -1]);
			for (const [ax, pos, s0, s1, sgn] of sides) {
				const mid = (s0 + s1) / 2, probe = pos + sgn * 0.3;
				const cover = plan.rects.find((q) => q !== r && q.top >= y - 0.05 && (ax === 'z' ? mid > q.x0 && mid < q.x1 && probe > q.z0 && probe < q.z1 : probe > q.x0 && probe < q.x1 && mid > q.z0 && mid < q.z1));
				if (cover) continue;
				const e0 = s0 - 0.4, e1 = s1 + 0.4, o0 = pos + sgn * 0.38, o1 = pos + sgn * 0.42, q0 = pos + sgn * 0.42, q1 = pos + sgn * 0.55;
				const bx = (k, a, b, c, d, y0, y1, cc) => (ax === 'z' ? g.box(k, a, y0, Math.min(c, d), b, y1, Math.max(c, d), cc) : g.box(k, Math.min(c, d), y0, a, Math.max(c, d), y1, b, cc));
				bx('trim', e0, e1, o0, o1, y - 0.2, y + 0.02, TRIM);
				bx('trim', e0, e1, q0, q1, y - 0.16, y - 0.01, TRIM);
				// the soffit under the overhang
				bx('stucco', s0, s1, pos, o0, y - 0.03, y - 0.01, FOAM);
				const dp = s0 + 0.12;
				if (ax === 'z') g.box('trim', dp, base + 0.2, Math.min(pos + sgn * 0.02, pos + sgn * 0.1), dp + 0.07, y - 0.12, Math.max(pos + sgn * 0.02, pos + sgn * 0.1), TRIM);
			}
		}

		yield;
		// furniture
		for (const it of plan.items) {
			if (++step % 12 === 0) yield;
			if (it.type === 'closet') it.wallCol = paint[it.room];
			if (it.type === 'car') continue;
			drawItem(g, it, rnd, HT);
			const solid = !['rug', 'bathMat', 'art', 'ceilingLight', 'toys'].includes(it.type) && it.box;
			if (solid) col.push([it.box[0], it.box[1], it.box[2], it.box[3], it.y, it.y + Math.max(it.h, 0.3)]);
		}
		yield;
		for (const m of g.meshes(M)) root.add(m);
		// a car in the garage
		for (const it of plan.items) {
			if (it.type !== 'car') continue;
			const c = CAR_PAINT[Math.floor(it.v * CAR_PAINT.length)];
			let cm = carMats.get(c);
			if (!cm) { cm = carMaterial(night); cm.color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); carMats.set(c, cm); }
			const car = new THREE.Mesh(carGeometry(it.v < 0.5 ? 'suv' : 'sedan'), cm);
			car.position.set(it.x, 0, it.z); car.castShadow = true;
			root.add(car);
			col.push([it.x - 0.95, it.z - 2.35, it.x + 0.95, it.z + 2.35, 0, 1.4]);
		}
		for (const D of doors) if (D.pivot.parent !== root) root.add(D.pivot);
		root.updateMatrixWorld(true);
		group.add(root);
		// the footprint at each level, for the floors that carry you
		const lights = plan.rooms.filter((r) => r.cells.length && lit[r.id] && r.type !== 'closet').map((r) => [r.cx, (r.level ? HT.ceil1 : HT.ceil0) - 0.45, r.cz]);
		return { grp, plan, root, floorY, base, col, doors, stoop, lights, M: Mb, ca, sa, cx: Mb.x, cz: Mb.z, r: Math.hypot(...plan.rects.reduce((m, q) => [Math.max(m[0], Math.abs(q.x0), Math.abs(q.x1)), Math.max(m[1], Math.abs(q.z0), Math.abs(q.z1))], [0, 0])) + 3 };
	}

	function dispose(h) {
		group.remove(h.root);
		h.root.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
	}

	// ---------------------------------------------------------------------------
	// streaming: build the nearest, one a frame; let the far ones go

	let scanX = 1e9, scanZ = 1e9, cands = [], buildMs = 0, job = null;
	const BUDGET = isPhone ? 3 : 4;
	function update(cam, dt, nightK = 0) {
		night.value = nightK;
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y - (bay.heightAt(x, z) || 0) > 120;
		group.visible = !high;
		if (!real?.loaded() || high) return;
		// what is near, every few metres
		if (Math.hypot(x - scanX, z - scanZ) > 6) {
			scanX = x; scanZ = z;
			const seen = new Set();
			cands = [];
			for (const b of real.near('boxes', x, z, BUILD_R + 25)) {
				if (!b.grp || seen.has(b.grp)) continue;
				seen.add(b.grp);
				const Mb = mainOf(b.grp);
				if (!Mb) continue;
				const d = Math.hypot(Mb.x - x, Mb.z - z);
				if (d < BUILD_R) cands.push([d, b.grp]);
			}
			cands.sort((p, q) => p[0] - q[0]);
			cands.length = Math.min(cands.length, MAX);
		}
		for (const [grp, h] of houses) {
			const Mb = mainOf(grp), d = Math.hypot(Mb.x - x, Mb.z - z);
			if (d > DROP_R || (!cands.some((c) => c[1] === grp) && houses.size > MAX)) {
				if (h) { dispose(h); city?.setNear?.(grp, null); }
				houses.delete(grp);
			}
		}
		// one house at a time, a few milliseconds a frame
		if (job && !cands.some((c) => c[1] === job.grp)) job = null;
		if (!job) for (const [, grp] of cands) if (!houses.has(grp)) { job = { grp, gen: build(grp), ms: 0 }; break; }
		const t0 = performance.now();
		while (job && performance.now() - t0 < BUDGET) {
			let r;
			const t1 = performance.now();
			try { r = job.gen.next(); } catch (e) { console.warn('house', e); r = { done: true, value: null }; }
			job.ms += performance.now() - t1;
			if (!r.done) continue;
			const h = r.value;
			houses.set(job.grp, h);
			if (h) city?.setNear?.(job.grp, [h.cx, h.cz]);
			buildMs = job.ms;
			job = null;
		}
		// the lamps go to the lit rooms nearest you
		// (only in the house you are in: without shadows their light would pass through walls)
		const here = nightK > 0.05 ? inside(cam.position) : null;
		M.setNight(nightK, !!here);
		if (here) {
			const spots = [];
			for (const h of [here.h]) {
				for (const s2 of h.lights) { const [wx, wz] = toWorld(h, s2[0], s2[2]); spots.push([Math.hypot(wx - x, wz - z) + Math.abs(h.floorY + s2[1] - cam.position.y) * 2, wx, h.floorY + s2[1], wz]); }
			}
			spots.sort((p, q) => p[0] - q[0]);
			lamps.forEach((l, i) => { const s2 = spots[i]; l.intensity = s2 ? nightK * 5 : 0; if (s2) l.position.set(s2[1], s2[2], s2[3]); });
		} else for (const l of lamps) l.intensity = 0;
		// the doors swing
		for (const h of houses.values()) {
			if (!h) continue;
			for (const D of h.doors) if (Math.abs(D.open - D.target) > 1e-3) { D.open += Math.sign(D.target - D.open) * Math.min(Math.abs(D.target - D.open), dt * (D.kind === 'garage' ? 0.45 : 1.6)); D.apply(); }
		}
	}

	// ---------------------------------------------------------------------------
	// you in the house: floors, walls, doors

	const local = (h, x, z) => { const dx = x - h.cx, dz = z - h.cz; return [h.ca * dx + h.sa * dz, -h.sa * dx + h.ca * dz]; };
	const toWorld = (h, lx, lz) => [h.cx + h.ca * lx - h.sa * lz, h.cz + h.sa * lx + h.ca * lz];
	function floorAt(x, z, footY) {
		let best = -1e9;
		for (const h of houses.values()) {
			if (!h) continue;
			const [lx, lz] = local(h, x, z);
			if (Math.abs(lx) > h.r || Math.abs(lz) > h.r) continue;
			const y = footY - h.floorY, p = h.plan;
			for (const s of h.stoop) if (lx > s[0] && lx < s[2] && lz > s[1] && lz < s[3] && y > s[4] - 0.7) best = Math.max(best, h.floorY + s[4]);
			const c = p.cellAt(lx, lz);
			if (c < 0 || p.occ[c] < 0) continue;
			let f = 0;
			const st = p.stairs;
			if (st && lx > st.x0 && lx < st.x1 && lz < st.zb && lz > st.zt) {
				const k = Math.floor((st.zb - lz) / st.T);
				const sy = Math.min(HT.floor1, (k + 1) * st.R);
				if (y > sy - 0.75) f = sy;
			} else if (p.onLevel(c, 1) && y > HT.floor1 - 0.6) f = HT.floor1;
			best = Math.max(best, h.floorY + f);
		}
		return best;
	}
	function push(pos, footY) {
		const R = 0.3;
		for (const h of houses.values()) {
			if (!h) continue;
			let [lx, lz] = local(h, pos.x, pos.z);
			if (Math.abs(lx) > h.r + 1 || Math.abs(lz) > h.r + 1) continue;
			const y0 = footY - h.floorY + 0.25, y1 = footY - h.floorY + 1.7;
			let moved = false;
			const one = (b) => {
				if (y1 < b[4] || y0 > b[5]) return;
				const qx = Math.max(b[0], Math.min(b[2], lx)), qz = Math.max(b[1], Math.min(b[3], lz));
				let dx = lx - qx, dz = lz - qz;
				const d2 = dx * dx + dz * dz;
				if (d2 >= R * R) return;
				if (d2 < 1e-8) {
					// inside it: out the nearest side
					const pen = [lx - b[0], b[2] - lx, lz - b[1], b[3] - lz], m = Math.min(...pen), k = pen.indexOf(m);
					if (k === 0) lx = b[0] - R; else if (k === 1) lx = b[2] + R; else if (k === 2) lz = b[1] - R; else lz = b[3] + R;
				} else { const d = Math.sqrt(d2); lx = qx + dx / d * R; lz = qz + dz / d * R; }
				moved = true;
			};
			for (const b of h.col) one(b);
			for (const D of h.doors) if (D.open < 0.15 || (D.kind === 'garage' && D.open < 0.8) || (D.kind === 'slider' && D.open < 0.6)) one([...D.box, D.level ? HT.floor1 : 0, (D.level ? HT.floor1 : 0) + 2.1]);
			// the stairs are solid below their treads
			const st = h.plan.stairs;
			if (st) {
				const k = Math.floor((st.zb - Math.min(st.zb, Math.max(st.zt, lz))) / st.T), sy = Math.min(HT.floor1, (k + 1) * st.R);
				const fy = footY - h.floorY;
				if (fy < sy - 0.75 && fy > -0.5) one([st.x0, st.zt, st.x1, st.zb, 0, sy]);
			}
			if (moved) { const [x, z] = toWorld(h, lx, lz); pos.x = x; pos.z = z; }
		}
	}
	// the door in front of you, within reach
	function doorNear(cam) {
		let best = null;
		const fx = -Math.sin(cam.rotation.y), fz = -Math.cos(cam.rotation.y);
		for (const h of houses.values()) {
			if (!h) continue;
			for (const D of h.doors) {
				const [wx, wz] = toWorld(h, D.at[0], D.at[2]), wy = h.floorY + D.at[1];
				const dx = wx - cam.position.x, dz = wz - cam.position.z, dy = wy - cam.position.y, d = Math.hypot(dx, dz);
				if (d > (D.kind === 'garage' ? 3.2 : 1.9) || Math.abs(dy) > 1.6) continue;
				const facing = (dx * fx + dz * fz) / Math.max(d, 1e-3);
				if (d > 0.6 && facing < 0.35) continue;
				const score = d - facing;
				if (!best || score < best.score) best = { D, score, h };
			}
		}
		return best && { kind: best.D.kind, open: best.D.target > 0.5, toggle: () => { best.D.target = best.D.target > 0.5 ? 0 : 1; } };
	}
	// inside a house (for sound and light later): which house, which level
	function inside(pos) {
		for (const h of houses.values()) {
			if (!h) continue;
			const [lx, lz] = local(h, pos.x, pos.z), c = h.plan.cellAt(lx, lz);
			if (c >= 0 && h.plan.occ[c] >= 0 && pos.y - h.floorY < HT.ceil1 + 1) return { h, level: pos.y - h.floorY > HT.floor1 + 0.5 ? 1 : 0 };
		}
		return null;
	}
	return { update, floor: floorAt, push, doorNear, inside, group, count: () => houses.size, houses, buildMs: () => buildMs, busy: () => !!job };
}

function pick3(rnd, l) { return l[Math.floor(rnd() * l.length)]; }
