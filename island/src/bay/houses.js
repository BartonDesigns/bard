// Real houses up close. Within a few dozen metres of you, each house in the mapped
// suburbs (San Ramon, Danville, the Tri-Valley) stops being a painted block and is built
// for real from its footprint (houseplan.js): stucco walls with thickness, windows with
// frames, sills and glass, a front door and garage doors that open (E), a stoop, gutters
// and downspouts, and inside, every room of the plan, with its floor, walls, ceiling,
// stairs, doors and furniture. The far block dissolves into the near house over a band
// of distance (the same screen-noise hand-over the trees use), so nothing pops. The
// walls, doors, railings, stairs and furniture are solid; the floors and stairs carry you.

import * as THREE from 'three';
import { planHouse, houseFloor, mainOf, houseSeed, HT, TW } from './houseplan.js';
import { houseEra, exteriorLook, householdDecor } from './decor.js';
import { Builder, houseMaterials, drawItem, lin, FLAT } from './housekit.js';
import { drawAny, hasKit } from '../interiors/kit.js';
import '../interiors/estab-kit.js';
import { profileOf } from '../economy/frontage.js';
// a business's fit-out for the house's plan (houseplan.js): its trade's fit, and whether it has a shopfront
const estabOf = (E) => { const p = profileOf(E.type); return p.fit ? { fit: p.fit, glass: p.style === 'glass', type: E.type, id: E.id } : null; };
import { occasions, today } from '../calendar.js';
import { houseLights } from './seasons.js';            // the holidays' strings, the same houses as from afar (holidaylights.js)
import { carGeometry, carMaterial } from './cars.js';
import { anchorBuilding, buildingBand, updateDetailClock } from '../world/lodfade.js';
import { lightInterior, releaseInterior, configureLighting, lightingClock } from '../interiors/lighting.js';

// the rooms that sometimes have a raised (tray) ceiling
const RAISE = new Set(['living', 'family', 'dining', 'master']);
import { inCampus } from './discovery.js';

const CAR_PAINT = [[0.92, 0.92, 0.9], [0.08, 0.08, 0.09], [0.45, 0.46, 0.48], [0.7, 0.71, 0.72], [0.2, 0.28, 0.45], [0.55, 0.1, 0.1]];

export function createHouses(scene, bay, real, city, { isPhone = false, night = { value: 0 } } = {}) {
	// the hand-over band: the near house fills in as the far block thins out
	// (a narrow band: anything parked inside it stays half dissolved, so keep it to a couple of metres)
	const band = buildingBand(isPhone);
	const BUILD_R = band[3] + 10, DROP_R = BUILD_R + 25, MAX = isPhone ? 6 : 12;
	const M = houseMaterials(band, undefined, 'building');
	city?.setNearBand?.(band[2], band[3]);
	const group = new THREE.Group();
	group.name = 'houses';
	scene.add(group);
	const houses = new Map();       // a house's block list (grp) -> the built house, or null if it has no plan
	// (the rooms' light is the shared interior lighting's: interiors/lighting.js)
	configureLighting({ isPhone });
	const carMats = new Map();

	// ---------------------------------------------------------------------------
	// building one house

	// a generator: it yields between steps, so a house is built over a few frames
	function* build(grp) {
		const plan = planHouse(grp, grp.estab ? { estab: estabOf(grp.estab) } : {});
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
		// when it was built and who lives there (decor.js): the outside its era's (the city's
		// colours for it where the city gave them, so the far block hands over to the same
		// house), the inside the household's
		const seed = houseSeed(Mb), given = Mb.look || city?.houseLook?.(Mb);
		const era = houseEra(Mb.x, Mb.z, { era: given?.era }), ext = exteriorLook(era, seed), dec = householdDecor(era, seed);
		const look = { ...ext, ...(given || {}) };
		if (!look.garage) look.garage = ext.garage;
		const WALL = lin(look.wall), WHITE = lin([0.94, 0.93, 0.9]), TRIM = lin(dec.trim), TK = dec.trimKey;
		const XT = lin(look.trim || ext.trim), FRAME = lin(look.frame || look.trim || ext.trim), EXT = look.siding != null ? 'siding' + look.siding : 'stucco';
		const FOAM = lin(look.wall.map((c) => Math.min(1, c * 1.08 + 0.03)));
		// the surrounds of the windows and doors outside: foam on stucco, boards on wood, none
		const SK = look.surround === 'stucco' ? 'stucco' : look.surround === 'none' ? null : 'trim', SC = SK === 'stucco' ? FOAM : XT;
		const lv = (L) => (L ? HT.floor1 : 0);
		// which rooms have a light on after dark
		const lit = plan.rooms.map((r) => rnd() < (r.type === 'garage' || r.type === 'closet' ? 0.08 : r.level ? 0.45 : 0.6));
		// each room's walls (paint, paper, panelling), and in some one wall picked out: the
		// longest, fewest-opened one it has
		const fin = plan.rooms.map((r) => { const f = dec.wall(r.type, r.id); return { key: f.key, col: lin(f.col) }; });
		const acc = plan.rooms.map((r) => { const f = dec.accent(r.type, r.id); return f && { key: f.key, col: lin(f.col) }; });
		const accW = plan.rooms.map(() => null), accS = plan.rooms.map(() => -1e9);
		for (const w of plan.walls) for (const rm of w.kind === 'ext' ? [w.room] : [w.ra, w.rb]) {
			if (!(rm >= 0) || !acc[rm]) continue;
			const sc = w.e - w.s - w.open.length * 1.5;
			if (sc > accS[rm]) { accS[rm] = sc; accW[rm] = w; }
		}
		const finOf = (room, w) => (acc[room] && accW[room] === w ? acc[room] : fin[room]);
		const paint = fin.map((f) => f.col);
		const wallKey = (room, w) => { const k = finOf(room, w).key; return !lit[room] ? k : k === 'paint' ? 'paintLit' : k.startsWith('paper') ? 'paperLit' + k.slice(5) : k; };
		const root = new THREE.Group();
		root.position.set(Mb.x, floorY, Mb.z);
		root.rotation.y = -Mb.a;

		// ---- walls, cut round their openings
		let step = 0;
		const wallInfo = [];
		for (const w of plan.walls) {
			if (++step % 14 === 0) yield;
			const L = w.level, y0w = w.kind === 'ext' && L === 0 ? base : w.yb, y1w = w.yt;
			let a0, a1;
			if (w.kind === 'ext') { a0 = w.inSide > 0 ? w.pos : w.pos - TW.ext; a1 = w.inSide > 0 ? w.pos + TW.ext : w.pos; }
			else { a0 = w.pos - TW.part / 2; a1 = w.pos + TW.part / 2; }
			// which face shows what: the + side and the - side across the wall
			const plusRoom = w.kind === 'ext' ? (w.inSide > 0 ? w.room : -1) : w.rb, minusRoom = w.kind === 'ext' ? (w.inSide < 0 ? w.room : -1) : w.ra;
			const across = w.axis === 'x' ? [4, 5] : [0, 1];
			const keyF = (f) => (f === across[0] ? (plusRoom >= 0 ? wallKey(plusRoom, w) : EXT) : f === across[1] ? (minusRoom >= 0 ? wallKey(minusRoom, w) : EXT) : f === 3 ? null : 'paint');
			const colF = (f) => (f === across[0] ? (plusRoom >= 0 ? finOf(plusRoom, w).col : WALL) : f === across[1] ? (minusRoom >= 0 ? finOf(minusRoom, w).col : WALL) : WHITE);
			const cuts = [w.s, w.e];
			for (const o of w.open) cuts.push(Math.max(w.s, Math.min(w.e, o.s0)), Math.max(w.s, Math.min(w.e, o.s1)));
			cuts.sort((p, q) => p - q);
			const mk = g.mark(), pcs = [];          // structures/walls: what this wall drew and where it stops you
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
				pcs.push({ u0, u1, y0, y1, col: col[col.length - 1] });
				// baseboards along the floor, on the room sides (tall in the old houses, a
				// picture rail up the wall in some)
				for (const [room, face, sgn] of [[plusRoom, a1, 1], [minusRoom, a0, -1]]) {
					if (room < 0 || plan.rooms[room].type === 'garage') continue;
					const f1 = face + sgn * 0.013, y = lv(L), yr = y + 2.12;
					const band = (b0, b1, t) => { const f2 = face + sgn * t; if (w.axis === 'x') g.box(TK, u0, b0, Math.min(face, f2), u1, b1, Math.max(face, f2), TRIM); else g.box(TK, Math.min(face, f2), b0, u0, Math.max(face, f2), b1, u1, TRIM); };
					if (y0 <= y + 0.01) band(y, y + dec.base, f1 - face);
					if (dec.rail && y0 < yr && y1 > yr + 0.05) band(yr, yr + 0.045, sgn * 0.022);
				}
			}
			{
				// (structures/walls: the wall as it was drawn, to be broken through later)
				const trim = (room) => (room >= 0 && plan.rooms[room].type !== 'garage' ? { key: TK, col: TRIM, y: lv(L), h: dec.base, t: 0.013 } : null);
				wallInfo.push({ w, axis: w.axis, a0, a1, s: w.s, e: w.e, y1: y1w, floor: lv(L), ext: w.kind === 'ext', inside: w.kind === 'ext' ? w.inSide : -1, rooms: [minusRoom, plusRoom], verts: g.since(mk), pieces: pcs.map((p) => ({ ...p, keys: [keyF(across[1]), keyF(across[0])], cols: [colF(across[1]), colF(across[0])], trims: [trim(minusRoom), trim(plusRoom)] })) });
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
				wbox(w, 'trim', o.s0, o.s1, o.y0, o.y0 + fw, f0, f1, FRAME);
				wbox(w, 'trim', o.s0, o.s1, o.y1 - fw, o.y1, f0, f1, FRAME);
				wbox(w, 'trim', o.s0, o.s0 + fw, o.y0, o.y1, f0, f1, FRAME);
				wbox(w, 'trim', o.s1 - fw, o.s1, o.y0, o.y1, f0, f1, FRAME);
				const wide = o.s1 - o.s0 > 1.1 && o.type === 'window';
				if (wide) wbox(w, 'trim', (o.s0 + o.s1) / 2 - 0.025, (o.s0 + o.s1) / 2 + 0.025, o.y0, o.y1, f0 - sgn * 0.01, f1 + sgn * 0.01, FRAME);
				if (o.type === 'window' && o.y1 - o.y0 > 1.2 && !wide) wbox(w, 'trim', o.s0, o.s1, (o.y0 + o.y1) / 2 - 0.02, (o.y0 + o.y1) / 2 + 0.02, f0, f1, FRAME);
				const gz = out + sgn * 0.065, g0 = o.type === 'slider' ? (o.s0 + o.s1) / 2 : o.s0 + fw;
				wbox(w, o.frosted ? 'frost' : 'glass', g0, o.s1 - fw, o.y0 + fw, o.y1 - fw, gz - 0.003, gz + 0.003, WHITE);
				// divided lites: the old houses' muntins, the tracts' grids
				if (look.grilles && o.type === 'window' && !o.frosted) {
					const W = o.s1 - o.s0, n = Math.max(2, Math.round(W / 0.4)), y0 = o.y0 + fw, y1 = o.y1 - fw, ym = (o.y0 + o.y1) / 2;
					for (let k = 1; k < n; k++) { const u = o.s0 + W * k / n; if (!wide || Math.abs(u - (o.s0 + o.s1) / 2) > 0.05) wbox(w, 'trim', u - 0.012, u + 0.012, y0, y1, gz - 0.012, gz + 0.012, FRAME); }
					for (const t of o.y1 - o.y0 > 1.2 ? [0.25, 0.75] : [0.5]) { const yy = o.y0 + (o.y1 - o.y0) * t; if (Math.abs(yy - ym) > 0.05 || o.y1 - o.y0 <= 1.2) wbox(w, 'trim', o.s0 + fw, o.s1 - fw, yy - 0.012, yy + 0.012, gz - 0.012, gz + 0.012, FRAME); }
				}
				const c0 = o.type === 'slider' ? (o.s0 + o.s1) / 2 : o.s0;
				col.push(w.axis === 'x' ? [c0, Math.min(a0, a1), o.s1, Math.max(a0, a1), o.y0, o.y1] : [Math.min(a0, a1), c0, Math.max(a0, a1), o.s1, o.y0, o.y1]);
				if (o.type === 'window') {
					// outside: a sill and a surround (foam on stucco, boards on wood siding); inside: a stool
					if (SK) {
						const ck = SK === 'trim' ? 0.035 : 0;
						wbox(w, SK, o.s0 - 0.12, o.s1 + 0.12, o.y0 - 0.07, o.y0, out, out - sgn * 0.06, SC);
						wbox(w, SK, o.s0 - 0.1 - ck, o.s1 + 0.1 + ck, o.y1, o.y1 + 0.1 + ck, out, out - sgn * 0.025, SC);
						wbox(w, SK, o.s0 - 0.1 - ck, o.s0, o.y0, o.y1, out, out - sgn * 0.025, SC);
						wbox(w, SK, o.s1, o.s1 + 0.1 + ck, o.y0, o.y1, out, out - sgn * 0.025, SC);
					}
					wbox(w, TK, o.s0 - 0.04, o.s1 + 0.04, o.y0 - 0.02, o.y0 + 0.01, f1, inn + sgn * 0.04, TRIM);
					// blinds, some partly drawn
					if (!o.shop && rnd() < 0.55) {
						const k = 0.15 + rnd() * 0.75, bz = inn - sgn * 0.02;
						wbox(w, 'blinds', o.s0 + 0.02, o.s1 - 0.02, o.y1 - (o.y1 - o.y0) * k, o.y1 - 0.02, bz - 0.004, bz + 0.004, WHITE);
					}
				}
				// curtains in the living rooms and bedrooms
				const room = plan.rooms[w.room];
				if (room && !o.shop && !room.biz && ['living', 'master', 'family', 'dining', 'bed'].includes(room.type) && rnd() < 0.5) {
					const cc = lin(dec.curtains[Math.floor(rnd() * dec.curtains.length)]), cz0 = inn + sgn * 0.05, cz1 = inn + sgn * 0.13, top = Math.min(o.y1 + 0.2, lv(w.level) + (w.level ? HT.ceil1 - HT.floor1 : HT.ceil0) - 0.05);
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
							if (SK) {
								wbox(w, SK, o.s0 - 0.14, o.s0, 0, o.y1 + 0.14, face, face + s2 * 0.03, SC);
								wbox(w, SK, o.s1, o.s1 + 0.14, 0, o.y1 + 0.14, face, face + s2 * 0.03, SC);
								wbox(w, SK, o.s0 - 0.14, o.s1 + 0.14, o.y1, o.y1 + 0.14, face, face + s2 * 0.03, SC);
							}
							wbox(w, 'metal', o.s1 + 0.3, o.s1 + 0.46, 1.75, 2.05, face, face + s2 * 0.16, lin([0.12, 0.11, 0.1]));
							wbox(w, 'lamp', o.s1 + 0.32, o.s1 + 0.44, 1.8, 2.0, face + s2 * 0.02, face + s2 * 0.14, lin([0.98, 0.9, 0.7]));
							wbox(w, 'matte', o.s0 - 0.45, o.s0 - 0.2, 1.5, 1.62, face, face + s2 * 0.02, lin([0.12, 0.12, 0.12]));
						}
						continue;
					}
					if (plan.rooms[room].type === 'garage' && o.type !== 'door') continue;
					const f1 = face + s2 * 0.015;
					wbox(w, TK, o.s0 - cw, o.s0, lv(w.level), o.y1 + cw, face, f1, TRIM);
					wbox(w, TK, o.s1, o.s1 + cw, lv(w.level), o.y1 + cw, face, f1, TRIM);
					wbox(w, TK, o.s0 - cw, o.s1 + cw, o.y1, o.y1 + cw, face, f1, TRIM);
				}
				if (o.type === 'door' || o.type === 'front') doors.push(swingDoor(w, o, a0, a1));
				return;
			}
			if (o.type === 'garage') {
				if (SK) {
					wbox(w, SK, o.s0 - 0.15, o.s0, 0, o.y1 + 0.15, out, out - sgn * 0.035, SC);
					wbox(w, SK, o.s1, o.s1 + 0.15, 0, o.y1 + 0.15, out, out - sgn * 0.035, SC);
					wbox(w, SK, o.s0 - 0.15, o.s1 + 0.15, o.y1, o.y1 + 0.15, out, out - sgn * 0.035, SC);
				}
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
			// the era's doors: its front door and colour, the household's inside
			const dc = lin(front ? look.door || ext.door : dec.door.col);
			b.box('door' + (front ? look.doorStyle ?? ext.doorStyle : dec.door.slot), 0, 0, -t / 2, width - 0.04, h, t / 2, dc);
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
			b.box('garage' + (look.garageStyle ?? ext.garageStyle), -width / 2, -h, -0.03, width / 2, 0, 0.0, lin(look.garage));
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
			b.box('trim', 0, 0, -0.02, 0.05, h, 0.02, FRAME); b.box('trim', width - 0.05, 0, -0.02, width, h, 0.02, FRAME);
			b.box('trim', 0, 0, -0.02, width, 0.06, 0.02, FRAME); b.box('trim', 0, h - 0.05, -0.02, width, h, 0.02, FRAME);
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
		// (the well upstairs: over the flight, and on to the front wall where the entry below rises two storeys)
		const inWell = (c) => { if (!st) return false; const [x, z] = cxz(c); return x > st.x0 && x < st.x1 && z > st.zt && z < (st.zw ?? st.zb); };
		// the floors, room by room (decor.js), and the wood of the stairs
		const FT = { wood: lin(dec.wood) }, floorOf = rooms.map((rm) => { const f = dec.floor(rm.type, rm.level); return { key: f.key, col: lin(f.col) }; });
		const upOver = (c) => plan.onLevel(c, 1);
		for (const L of [0, 1]) {
			const lab = labels[L], y = lv(L), yc = L ? HT.ceil1 : HT.ceil0;
			for (const r of cellRects(L, (c) => (lab[c] >= 0 && !(L === 1 && inWell(c)) ? lab[c] : null))) {
				const f = floorOf[r.k];
				g.quad(f.key, [r.x0, y, r.z0], [r.x1, y, r.z0], [r.x1, y, r.z1], [r.x0, y, r.z1], [0, 1, 0], f.col, [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]);
			}
			// raised (tray) ceilings in some living rooms, family rooms, dining rooms and main
			// bedrooms with nothing over them: a soffit round the edge at the usual height, and the
			// middle stepped up into the roof space, its step lit like a cove
			const raised = new Map();
			for (const rm of rooms) {
				if (rm.level !== L || !RAISE.has(rm.type) || dec.era === 'prewar' || dec.era === 'ranch' || (rm.id * 7 + Math.floor(Math.abs(X[0]) * 13 + Math.abs(Z[0]) * 7)) % 10 >= 5) continue;
				let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1, n = 0, clear = true;
				for (let c = 0; c < nx * nz; c++) if (lab[c] === rm.id) { const i = c % nx, j = Math.floor(c / nx); i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); n++; if ((L === 0 && upOver(c)) || inWell(c)) clear = false; }
				if (!clear || !n || n !== (i1 - i0 + 1) * (j1 - j0 + 1)) continue;
				const x0 = X[i0], x1 = X[i1 + 1], z0 = Z[j0], z1 = Z[j1 + 1];
				if ((x1 - x0) * (z1 - z0) < 11 || Math.min(x1 - x0, z1 - z0) < 2.8) continue;
				raised.set(rm.id, { x0, x1, z0, z1 });
				(plan.trays || (plan.trays = [])).push({ level: L, type: rm.type, x0, x1, z0, z1 });
			}
			for (const [id, q] of raised) {
				const e = Math.min(0.55, (q.x1 - q.x0) * 0.18, (q.z1 - q.z0) * 0.18), top = yc + 0.45, lk = lit[id] ? 'ceilingLit' : 'ceiling', C = lin([0.95, 0.95, 0.93]);
				const flat = (x0, z0, x1, z1, y) => g.quad(lk, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], C, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
				flat(q.x0, q.z0, q.x1, q.z0 + e, yc); flat(q.x0, q.z1 - e, q.x1, q.z1, yc); flat(q.x0, q.z0 + e, q.x0 + e, q.z1 - e, yc); flat(q.x1 - e, q.z0 + e, q.x1, q.z1 - e, yc);
				flat(q.x0 + e, q.z0 + e, q.x1 - e, q.z1 - e, top);
				const X0 = q.x0 + e, X1 = q.x1 - e, Z0 = q.z0 + e, Z1 = q.z1 - e, uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
				g.quad('ceilingLit', [X0, yc, Z0], [X1, yc, Z0], [X1, top, Z0], [X0, top, Z0], [0, 0, 1], C, uv);
				g.quad('ceilingLit', [X0, yc, Z1], [X1, yc, Z1], [X1, top, Z1], [X0, top, Z1], [0, 0, -1], C, uv);
				g.quad('ceilingLit', [X0, yc, Z0], [X0, yc, Z1], [X0, top, Z1], [X0, top, Z0], [1, 0, 0], C, uv);
				g.quad('ceilingLit', [X1, yc, Z0], [X1, yc, Z1], [X1, top, Z1], [X1, top, Z0], [-1, 0, 0], C, uv);
			}
			for (const r of cellRects(L, (c) => (lab[c] >= 0 && !raised.has(lab[c]) && !(L === 0 && inWell(c) && upOver(c)) ? (lit[lab[c]] ? 2 : 1) : null))) g.quad(r.k === 2 ? 'ceilingLit' : 'ceiling', [r.x0, yc, r.z0], [r.x1, yc, r.z0], [r.x1, yc, r.z1], [r.x0, yc, r.z1], [0, -1, 0], lin([0.95, 0.95, 0.93]), [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]);
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
			const zw = st.zw ?? st.zb;
			sl(st.x0, zw, st.x1, zw, [0, 0, -1]); sl(st.x0, st.zt, st.x1, st.zt, [0, 0, 1]);
			sl(st.x0, st.zt, st.x0, zw, [1, 0, 0]); sl(st.x1, st.zt, st.x1, zw, [-1, 0, 0]);
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
			if (sameRoom(1, (st.x0 + st.x1) / 2, (st.zw ?? st.zb) + 0.3, (st.x0 + st.x1) / 2, st.zt - 0.3)) railing(st.x0, (st.zw ?? st.zb) + 0.02, st.x1, (st.zw ?? st.zb) + 0.02, 'x');
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
		// Halloween: jack-o'-lanterns on the stoop, faces to the street
		const OCC = occasions();
		if (OCC.halloween && rnd() < 0.7) {
			for (let k = 0, n = 1 + Math.floor(rnd() * 3); k < n; k++) {
				const px = D0.x + (k % 2 ? 0.72 : -0.72) - (k > 1 ? 0.3 : 0), pz = D0.z + 0.45 + (k > 1 ? 0.45 : 0), rr = 0.15 + rnd() * 0.08;
				g.sphere('matte', px, rr * 0.85, pz, rr, rr * 0.82, rr, lin([0.86, 0.38, 0.06]), 12);
				g.cyl('matte', px, rr * 1.6, pz, 0.018, 0.06, lin([0.25, 0.3, 0.12]), 6);
				const fz = pz + rr * 0.97, glow = lin([1.0, 0.62, 0.15]);
				for (const ex of [-1, 1]) g.box('bulb', px + ex * rr * 0.36 - 0.03, rr * 1.0, fz - 0.01, px + ex * rr * 0.36 + 0.03, rr * 1.12, fz + 0.012, glow);
				g.box('bulb', px - rr * 0.45, rr * 0.55, fz - 0.03, px + rr * 0.45, rr * 0.66, fz + 0.005, glow);
			}
		}
		if (plan.garage) {
			const G = plan.garage;
			g.box('concrete', G.x0, base, G.front, G.x1, 0, G.front + 0.6, lin([0.66, 0.65, 0.62]));
			stoop.push([G.x0, G.front, G.x1, G.front + 0.6, 0]);
		}

		// through the holidays most houses string lights along their eaves: all colours, warm
		// white or cool white (the same houses and the same strings holidaylights.js shows from afar)
		const lightsK = houseLights(seed, today());
		const eaveLights = lightsK === 1 ? [[1, 0.12, 0.1], [0.1, 0.9, 0.2], [0.15, 0.35, 1], [1, 0.7, 0.1]] : lightsK === 2 ? [[1, 0.78, 0.45]] : lightsK === 3 ? [[0.75, 0.85, 1]] : null;
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
				bx('trim', e0, e1, o0, o1, y - 0.2, y + 0.02, XT);
				bx('trim', e0, e1, q0, q1, y - 0.16, y - 0.01, XT);
				// the soffit under the overhang
				bx(SK === 'stucco' ? 'stucco' : 'trim', s0, s1, pos, o0, y - 0.03, y - 0.01, SK === 'stucco' ? FOAM : XT);
				if (eaveLights) for (let u = e0 + 0.15, n = 0; u < e1 - 0.1; u += 0.32, n++) bx('bulb', u - 0.03, u + 0.03, o1 + sgn * 0.01, o1 + sgn * 0.05, y - 0.27, y - 0.21, lin(eaveLights[n % eaveLights.length]));
				const dp = s0 + 0.12;
				if (ax === 'z') g.box('trim', dp, base + 0.2, Math.min(pos + sgn * 0.02, pos + sgn * 0.1), dp + 0.07, y - 0.12, Math.max(pos + sgn * 0.02, pos + sgn * 0.1), XT);
			}
		}

		yield;
		// furniture: shaded at the foot, each a shade of its own, a soft shadow under it
		g.ao = true;
		for (const it of plan.items) {
			if (++step % 12 === 0) yield;
			if (it.type === 'closet') it.wallCol = paint[it.room];
			if (it.type === 'car') continue;
			// the household's kitchen and its era's lights
			if (it.type === 'counter' || it.type === 'island' || it.type === 'fridge') it.dec = dec;
			if (it.type === 'ceilingLight') { it.kind = dec.fixture(plan.rooms[it.room]?.type || '', it.kind); it.fan = dec.fanWood; }
			g.mul = 0.94 + ((it.v * 7.31) % 1) * 0.12;
			if (hasKit(it.type)) drawAny(g, { ...it, ceil: it.level ? HT.ceil1 - HT.floor1 : HT.ceil0 }, rnd); else drawItem(g, it, rnd, HT);
			g.mul = 1;
			if (!FLAT.has(it.type)) g.under(it);
			// Bathroom clutter is authored dressing, not a collision wall. Keep the
			// vanity/towel/floor pass visible while preserving the usable path and
			// interaction clearance in small bathrooms.
			const solid = !['rug', 'bathMat', 'art', 'ceilingLight', 'toys', 'bathroomCounterClutter', 'bathroomTowel', 'bathroomFloorClutter'].includes(it.type) && it.box;
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
		grp.nearBorn=updateDetailClock();anchorBuilding(root, Mb.x, Mb.z,0,grp.nearBorn);
		root.updateMatrixWorld(true);
		group.add(root);
		// its rooms lit by their own lamps and ceiling lights, the sky through its windows
		const levels = [[0, HT.ceil0]];
		if (plan.rooms.some((r) => r.level)) levels.push([HT.floor1, HT.ceil1]);
		let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
		for (const r of plan.rects) { bx0 = Math.min(bx0, r.x0); bz0 = Math.min(bz0, r.z0); bx1 = Math.max(bx1, r.x1); bz1 = Math.max(bz1, r.z1); }
		lightInterior(root, {
			id: 'house:' + Math.round(Mb.x) + ':' + Math.round(Mb.z), occluders: col, levels, bounds: [bx0, bz0, bx1, bz1], home: true,
			rooms: plan.rooms.length, roomOf: (x, y, z) => { const c = plan.cellAt(x, z); return c < 0 ? -1 : plan.labels?.[y > HT.floor1 - 0.2 ? 1 : 0]?.[c] ?? -1; },
			litOf: (id) => !!lit[id], dust: (x, y, z, id) => plan.rooms[id]?.type === 'garage', exclude: ['stucco', 'siding'],
			// (to bed between half past ten and one, by the house: then one lamp stays on)
			bed: 22.5 + (((Math.imul(Math.round(Mb.x * 2) | 0, 73856093) ^ Math.imul(Math.round(Mb.z * 2) | 0, 19349663)) >>> 0) % 1000) / 1000 * 2.5,
		});
		// the footprint at each level, for the floors that carry you
		const lights = plan.rooms.filter((r) => r.cells.length && lit[r.id] && r.type !== 'closet').map((r) => [r.cx, (r.level ? HT.ceil1 : HT.ceil0) - 0.45, r.cz]);
		return { grp, plan, root, floorY, base, col, doors, stoop, lights, M: Mb, ca, sa, cx: Mb.x, cz: Mb.z, walls: { list: wallInfo, era, siding: look.siding == null ? 'stucco' : ['lap', 'batten', 'shingle', 'brick'][look.siding] || 'lap', mats: M }, r: Math.hypot(...plan.rects.reduce((m, q) => [Math.max(m[0], Math.abs(q.x0), Math.abs(q.x1)), Math.max(m[1], Math.abs(q.z0), Math.abs(q.z1))], [0, 0])) + 3 };
	}

	function dispose(h) {
		releaseInterior(h.root);
		group.remove(h.root);
		h.root.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
	}

	// ---------------------------------------------------------------------------
	// streaming: build the nearest, one a frame; let the far ones go

	let scanX = 1e9, scanZ = 1e9, cands = [], buildMs = 0, job = null;
	const BUDGET = isPhone ? 3 : 4;
	function update(cam, dt, nightK = 0) {
		updateDetailClock();night.value = nightK;
		lightingClock(nightK);
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y - (bay.heightAt(x, z) || 0) > 120;
		group.visible = !high;
		if (high) { for (const [grp,h] of houses) if(h && grp.near) city?.setNear?.(grp,null); return; }
		for (const [grp,h] of houses) if(h && !grp.near) city?.setNear?.(grp,[h.cx,h.cz]);
		if (!real?.loaded() && !city?.procHomes) return;
		// what is near, every few metres
		if (Math.hypot(x - scanX, z - scanZ) > 6) {
			scanX = x; scanZ = z;
			const seen = new Set();
			cands = [];
			for (const b of real?.loaded() ? real.near('boxes', x, z, BUILD_R + 25) : []) {
				if (!b.grp || b.grp.biz || b.grp.shut || seen.has(b.grp) || inCampus(b.x, b.z)) continue;      // (not a house boarded up or burnt out)
				seen.add(b.grp);
				const Mb = mainOf(b.grp);
				if (!Mb) continue;
				const d = Math.hypot(Mb.x - x, Mb.z - z);
				if (d < BUILD_R) cands.push([d, b.grp]);
			}
			// ...and the gridded towns' houses (city.js gives them the same shape)
			for (const grp of city?.procHomes?.(x, z, BUILD_R) || []) if (!grp.wrecked) cands.push([Math.hypot(grp[0].x - x, grp[0].z - z), grp]);
			cands.sort((p, q) => p[0] - q[0]);
			cands.length = Math.min(cands.length, MAX);
		}
		for (const [grp, h] of houses) {
			const Mb = mainOf(grp), d = Math.hypot(Mb.x - x, Mb.z - z);
			if (d > DROP_R || grp.wrecked || (!cands.some((c) => c[1] === grp) && houses.size > MAX)) {          // (wrecked: structures/ draws its shell)
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
		// (the glow of a lit room seen from outside; inside, the rooms' own light is baked in)
		M.setNight(nightK, !!(nightK > 0.05 && inside(cam.position)));
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
			} else if (p.onLevel(c, 1) && y > HT.floor1 - 0.6 && !(st && lx > st.x0 && lx < st.x1 && lz >= st.zb && lz < (st.zw ?? st.zb))) f = HT.floor1;
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
	return { update, floor: floorAt, push, doorNear, inside, group, M, count: () => houses.size, houses, buildMs: () => buildMs, busy: () => !!job };
}

