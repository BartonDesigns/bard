// The crew's vehicles, in proportion: an American conventional cab (a long hood between broad
// fenders, a chrome grille and bumper, a split windscreen, west coast mirrors, a stack behind
// the cab, steps over the fuel tank, amber marker lamps along the roof and a beacon bar) on
// chassis rails, for the tri-axle dump truck (a steel body with ribbed sides and its tailgate,
// a lift axle up, heaped with what was cleared), the mixer (a drum on its pedestals, tilted up
// to the hopper and chute at the back, a ladder up to them, a water tank behind the cab) and the
// boom truck (a knuckle crane folded behind the cab, a timber deck with its rack, what it
// brings by the stage); the glazier's high roof van with glass on its A-frame; the all-terrain
// crane's carrier on four axles, its outriggers out on their pads. Tyres with shoulders and
// sidewalls on dished rims with their nuts, twins at the back; every truck of a crew in its
// company's colours with the name on the doors. Each kind is built once per company and
// load, near and far (fewer sides, the small things left off), and kept: every site shares them.
// Local frame: +z ahead, the ground at y 0, the middle of the wheelbase near the origin.

import * as THREE from 'three';
import { parts, COLORS as C, COMPANIES, rect } from './crewkit.js';

// what the site needs to know of each kind: its length and width, where its wheels touch (for
// the ground under it), its axles, where the beacons are (for their glow), whether it backs in
export const TRUCKS = {
	dump: { L: 9.7, W: 2.55, front: 4.9, rear: -4.8, axles: [3.4, -2.35, -3.7], r: 0.52, beacons: [[-0.45, 3.2, 1.55], [0.45, 3.2, 1.55]], backs: true },
	mixer: { L: 11.0, W: 2.55, front: 4.95, rear: -6.0, axles: [3.4, -1.25, -2.6, -3.95], r: 0.52, beacons: [[-0.45, 3.2, 1.55], [0.45, 3.2, 1.55]], backs: true },
	flat: { L: 10.4, W: 2.55, front: 4.9, rear: -5.5, axles: [3.4, -3.0, -4.35], r: 0.52, beacons: [[-0.45, 3.2, 1.55], [0.45, 3.2, 1.55]], backs: false },
	van: { L: 5.95, W: 2.02, front: 2.98, rear: -2.97, axles: [1.9, -1.75], r: 0.37, beacons: [[0, 2.78, 1.2]], backs: false },
	carrier: { L: 12.6, W: 2.75, front: 6.2, rear: -6.4, axles: [3.95, 2.3, -2.35, -4.0], r: 0.62, beacons: [[0.85, 3.12, 4.3], [-0.9, 1.88, -5.6]], backs: false, slew: [0, 1.75, -1.0] },
};

// ---------- wheels ----------
// a wheel on local x, its middle at (x, r, z): the tyre a lathe with shoulders and sidewalls,
// the rim dished to its hub, the nuts round it; twin: two tyres side by side, the outer dished
function wheel(V, x, z, r, w, side, twin = false, rimC = C.rim, up = 0) {
	const cy = r + up;
	V.spin(cy, z, 1);
	const tyre = (xc, inner) => {
		V.m('rubber');
		const pts = inner ? [[0.7, -0.5], [0.97, -0.45], [1, 0], [0.97, 0.45], [0.7, 0.5]] : [[0.62, -0.5], [0.85, -0.52], [0.97, -0.43], [1, -0.28], [1, 0.28], [0.97, 0.43], [0.85, 0.52], [0.62, 0.5]];
		// (a multiple of four sides, so a corner of the tread is the point on the ground)
		V.lathe(pts.map(([a, b]) => [a * r, b * w]), xc, cy, z, 'x', C.tyre, inner || V.far ? 12 : 20, true);
	};
	const xo = x + side * (twin ? w * 0.55 : 0), xi = x - side * w * 0.55;
	tyre(xo, false);
	if (twin) tyre(xi, true);
	// the rim: its barrel, the dish out to the hub, the hub's cap and the nuts round it
	V.m('paint', 0.45);
	const face = xo + side * w * 0.36;
	if (!V.far) V.cyl(xo, cy, z, r * 0.6, w * 0.8, 'x', rimC, 14, r * 0.6, true);
	const dish = [[r * 0.6, 0], [r * 0.42, -0.05], [r * 0.24, -0.06], [r * 0.18, 0.02], [r * 0.12, 0.07], [0, 0.07]];
	V.lathe(dish.map(([a, b]) => [a, b * side]), face, cy, z, 'x', rimC, 14);
	if (!V.far) {
		V.m('steel', 0.5);
		for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; V.mid(face - side * 0.02, cy + Math.cos(a) * r * 0.3, z + Math.sin(a) * r * 0.3, 0.05, 0.035, 0.035, C.steel); }
	}
	V.spin(null);
}
function axleSet(V, axles, track, r, w, twinFrom = 1, rimC = C.rim, lift = -1) {
	axles.forEach((z, i) => {
		const up = i === lift ? 0.22 : 0;
		for (const s of [-1, 1]) wheel(V, s * (track / 2), z, r, w, s, i >= twinFrom, rimC, up);
		// (the axle and its hub between the wheels; the springs above)
		V.m('worn', 0.8);
		V.cyl(0, r + up, z, 0.09, track - 0.3, 'x', C.dark, 8);
		if (!V.far) for (const s of [-1, 1]) V.mid(s * 0.5, r + up + 0.24, z, 0.1, 0.09, 1.2, C.dark);
	});
}

// ---------- the American conventional cab ----------
// the front axle at z 3.4; the bumper's face at 4.9; the cab from 2.55 back to 0.75
function conventional(V, co) {
	const paint = co.paint, trim = co.trim;
	const hw = 1.15;
	// (the chassis rails and the gear under the cab)
	V.m('worn', 0.85);
	for (const s of [-1, 1]) V.mid(s * 0.43, 1.0, 0.0, 0.1, 0.3, 9.2, C.dark);
	V.mid(0, 0.62, 2.6, 0.7, 0.45, 2.2, C.dark);
	// the bumper: chrome, with its tow hooks
	V.m('chrome');
	V.rbox(0, 0.72, 4.72, 2.48, 0.36, 0.3, C.chrome, 0.06);
	if (!V.far) { V.m('worn'); for (const s of [-1, 1]) V.mid(s * 0.55, 0.62, 4.9, 0.08, 0.14, 0.1, C.dark); }
	// the hood: a side profile between the fenders, falling to the grille
	V.m('paint');
	V.ext([[4.52, 0.95], [4.57, 1.86], [4.52, 1.98], [4.4, 2.07], [4.1, 2.14], [3.3, 2.21], [2.55, 2.27], [2.55, 0.95]], -0.6, 0.6, paint, 0.06);
	if (!V.far) { V.m('paint'); V.rbox(0, 2.2, 3.4, 0.5, 0.06, 1.7, paint, 0.03, 0, 0.04, 0); }
	// the fenders: broad wings over the front wheels, cut round them
	const arc = [];
	for (let k = 0; k <= 12; k++) { const a = Math.PI - 0.45 - k / 12 * (Math.PI - 0.9); arc.push([3.4 + Math.cos(a) * 0.7, 0.52 + Math.sin(a) * 0.7]); }
	const fender = [[2.55, 0.82], [arc[0][0], 0.82], ...arc, [4.5, 0.82], [4.52, 1.3], [4.45, 1.5], [4.25, 1.64], [3.9, 1.71], [3.4, 1.73], [2.95, 1.68], [2.7, 1.55], [2.55, 1.38]];
	for (const s of [-1, 1]) V.ext(fender, s > 0 ? 0.6 : -1.24, s > 0 ? 1.24 : -0.6, paint, 0.03);
	// (the wheel wells dark behind the tyres)
	V.m('plastic');
	for (const s of [-1, 1]) V.mid(s * 0.92, 1.05, 3.4, 0.5, 0.2, 1.3, C.dark);
	// the grille: a chrome surround, black behind its bars
	V.m('chrome');
	V.rbox(0, 1.5, 4.63, 1.12, 1.12, 0.08, C.chrome, 0.04);
	V.m('plastic');
	V.mid(0, 1.5, 4.672, 0.96, 0.96, 0.02, C.black);
	if (!V.far) { V.m('chrome'); for (let k = -4; k <= 4; k++) V.mid(k * 0.1, 1.5, 4.685, 0.025, 0.94, 0.02, C.chrome); }
	// head lamps on the fenders, the turn lamps outboard of them
	V.m('lamp');
	for (const s of [-1, 1]) { V.rbox(s * 0.9, 1.36, 4.55, 0.42, 0.2, 0.06, C.lamp, 0.03); V.mid(s * 1.17, 1.36, 4.54, 0.12, 0.14, 0.05, C.amber); }
	// the cab: the lower body, then the glasshouse as a profile, its glass set in
	V.m('paint');
	V.rbox(0, 1.72, 1.65, hw * 2, 1.05, 1.8, paint, 0.07);
	V.ext([[2.56, 2.24], [2.36, 3.0], [2.2, 3.06], [0.86, 3.08], [0.74, 3.0], [0.74, 2.24]], -hw + 0.04, hw - 0.04, paint, 0.03);
	// (the cowl and the windscreen's foot)
	V.mid(0, 2.27, 2.6, 1.2, 0.06, 0.16, C.black);
	V.m('glass');
	const ws = Math.atan2(0.2, 0.76);
	for (const s of [-1, 1]) V.mid(s * 0.54, 2.641, 2.5, 1.0, 0.74, 0.02, C.glass, 0, -ws, 0);
	for (const s of [-1, 1]) { V.mid(s * (hw - 0.005), 2.62, 1.75, 0.02, 0.62, 1.05, C.glass); V.mid(s * (hw - 0.005), 2.62, 1.0, 0.02, 0.62, 0.3, C.glass); }
	V.mid(0, 2.62, 0.695, 1.3, 0.5, 0.02, C.glass);
	V.m('paint');
	V.mid(0, 2.641, 2.5, 0.08, 0.76, 0.03, paint, 0, -ws, 0);
	// the doors: their seams, handles, steps, the name on them
	V.m('plastic');
	for (const s of [-1, 1]) {
		V.mid(s * (hw + 0.006), 1.95, 2.42, 0.012, 1.6, 0.02, C.black);
		V.mid(s * (hw + 0.006), 1.95, 1.2, 0.012, 1.6, 0.02, C.black);
		V.mid(s * (hw + 0.006), 1.21, 1.81, 0.012, 0.02, 1.24, C.black);
	}
	V.m('chrome');
	for (const s of [-1, 1]) V.mid(s * (hw + 0.02), 2.12, 1.38, 0.03, 0.04, 0.2, C.chrome);
	V.m('decal');
	for (const s of [-1, 1]) V.decal(s * (hw + 0.012), 1.68, 1.8, 1.05, 0.66, rect('door' + co.i), paint, s * Math.PI / 2);
	// the fuel tank (left) and the battery box (right) with the steps on them
	V.m('alu');
	V.cyl(1.02, 0.8, 1.45, 0.32, 1.3, 'z', C.alu, 16);
	V.mid(-1.0, 0.8, 1.45, 0.5, 0.55, 1.2, C.alu);
	if (!V.far) { V.m('worn'); for (const z of [1.0, 1.9]) V.mid(1.02, 0.8, z, 0.68, 0.68, 0.05, C.dark); }
	V.m('alu', 0.7);
	for (const s of [-1, 1]) { V.mid(s * 1.2, 0.48, 2.2, 0.3, 0.06, 0.55, C.alu); V.mid(s * 1.33, 1.14, 2.2, 0.06, 0.06, 0.5, C.alu); }
	// west coast mirrors on their arms, the convex ones below
	if (!V.far) {
		V.m('chrome');
		for (const s of [-1, 1]) { V.tube([s * hw, 2.95, 2.3], [s * (hw + 0.32), 2.95, 2.36], 0.016, C.chrome); V.tube([s * hw, 2.2, 2.4], [s * (hw + 0.32), 2.25, 2.36], 0.016, C.chrome); V.tube([s * (hw + 0.32), 2.25, 2.36], [s * (hw + 0.32), 2.95, 2.36], 0.016, C.chrome); }
		V.m('plastic');
		for (const s of [-1, 1]) { V.rbox(s * (hw + 0.38), 2.62, 2.36, 0.07, 0.52, 0.22, C.black, 0.02); V.rbox(s * (hw + 0.38), 2.18, 2.38, 0.09, 0.16, 0.16, C.black, 0.04); }
	} else { V.m('plastic'); for (const s of [-1, 1]) V.mid(s * (hw + 0.38), 2.55, 2.36, 0.08, 0.6, 0.22, C.black); }
	// the sun visor, the roof's marker lamps, the beacon bar, the horns
	V.m('paint'); V.mid(0, 3.03, 2.42, 2.0, 0.05, 0.3, paint, 0, 0.12, 0);
	V.m('lamp'); if (!V.far) for (let k = -2; k <= 2; k++) V.mid(k * 0.2, 3.1, 2.25, 0.08, 0.05, 0.05, C.amber);
	V.m('plastic'); V.mid(0, 3.13, 1.55, 1.3, 0.07, 0.24, C.black);
	V.m('beacon'); for (const s of [-1, 1]) V.cyl(s * 0.45, 3.22, 1.55, 0.1, 0.13, 'y', C.amber, 10, 0.08);
	V.mid(0, 3.2, 1.55, 0.5, 0.07, 0.16, C.amber);
	if (!V.far) { V.m('chrome'); for (const s of [-1, 1]) V.cyl(s * 0.8, 3.15, 1.6, 0.05, 0.45, 'z', C.chrome, 8, 0.07); }
	// the stack behind the cab (right), the air cleaner (left)
	V.m('chrome');
	V.cyl(1.0, 2.4, 0.55, 0.09, 2.6, 'y', C.chrome, 10);
	V.cyl(1.0, 3.76, 0.6, 0.09, 0.2, 'y', C.chrome, 10, 0.06);
	if (!V.far) { V.m('steel'); V.cyl(1.0, 2.2, 0.55, 0.12, 1.1, 'y', C.silver, 10); }
	V.m('paint', 0.5); V.cyl(-1.02, 2.3, 0.58, 0.24, 0.9, 'y', trim, 12);
	// (the cab's back wall, so nothing shows through behind it)
	V.m('paint'); V.mid(0, 1.95, 0.74, hw * 2 - 0.04, 1.5, 0.04, paint);
}
// the back end of a truck: the lamps, the underride bar in its reflective tape, the plate,
// the mud flaps behind the last axle
function backEnd(V, z, flapZ, w = 2.44) {
	V.m('worn', 0.8);
	V.mid(0, 0.98, z + 0.06, w, 0.14, 0.12, C.dark);
	V.mid(0, 0.55, z + 0.08, w - 0.2, 0.14, 0.1, C.dark);
	for (const s of [-1, 1]) V.mid(s * 0.5, 0.76, z + 0.12, 0.08, 0.36, 0.08, C.dark);
	V.m('reflect');
	for (let k = 0; k < 8; k++) V.mid(-w / 2 + 0.2 + k * (w - 0.4) / 7.5, 0.55, z + 0.025, (w - 0.4) / 8, 0.1, 0.01, k % 2 ? C.white : C.red);
	V.m('tail');
	for (const s of [-1, 1]) { V.rbox(s * (w / 2 - 0.25), 0.98, z, 0.24, 0.12, 0.04, C.tail, 0.02); V.rbox(s * (w / 2 - 0.5), 0.98, z, 0.1, 0.1, 0.04, C.lamp, 0.02); }
	if (!V.far) { V.m('decal'); V.decal(0, 0.8, z - 0.03, 0.3, 0.15, rect('plate'), C.white, Math.PI); }
	V.m('rubber');
	for (const s of [-1, 1]) V.mid(s * 1.0, 0.55, flapZ, 0.62, 0.62, 0.02, C.black);
}

// ---------- the tri-axle dump truck ----------
function dumpTruck(V, co, full) {
	conventional(V, co);
	const T = TRUCKS.dump;
	axleSet(V, [T.axles[0], -1.0, T.axles[1], T.axles[2]], 2.0, 0.52, 0.32, 2, C.rim, 1);
	// the hoist ram, in front of the body
	V.m('chrome'); V.cyl(0, 1.9, 0.6, 0.13, 1.5, 'y', C.chrome, 10);
	V.m('worn'); V.cyl(0, 1.25, 0.6, 0.18, 0.3, 'y', C.dark, 10);
	// the body: a steel tub, the sides ribbed and flaring, the cab guard, the tailgate
	const z0 = 0.45, z1 = -4.65, y0 = 1.42, hs = 1.42, bw = 2.46, mz = (z0 + z1) / 2, L = z0 - z1;
	V.m('worn', 0.95);
	V.mid(0, 1.25, mz, 1.0, 0.18, L, C.dark);
	V.m('paintWorn', 0.9);
	V.mid(0, y0 + 0.04, mz, bw, 0.08, L, co.body);
	for (const s of [-1, 1]) {
		V.mid(s * bw / 2, y0 + hs / 2, mz, 0.06, hs, L, co.body, 0, 0, s * 0.04);
		V.mid(s * (bw / 2 + 0.05), y0 + hs, mz, 0.14, 0.12, L + 0.06, co.body);
		for (let k = 0; k < 6; k++) V.mid(s * (bw / 2 + 0.05), y0 + hs * 0.48, z0 - 0.35 - k * (L - 0.6) / 5, 0.08, hs * 0.9, 0.1, co.body, 0, 0, s * 0.04);
		V.mid(s * (bw / 2 + 0.04), y0 + 0.08, mz, 0.12, 0.16, L, co.body);
	}
	V.mid(0, y0 + hs / 2 + 0.05, z0, bw, hs + 0.1, 0.08, co.body);
	V.mid(0, 3.2, z0 + 0.3, bw, 0.06, 0.74, co.body, 0, -0.06, 0);
	for (const s of [-1, 1]) V.mid(s * (bw / 2 - 0.03), 3.02, z0 + 0.12, 0.06, 0.4, 0.36, co.body);
	V.m('paintWorn'); for (const s of [-1, 1]) V.mid(s * 1.05, 1.18, -3.02, 0.62, 0.04, 2.4, C.dark);
	V.m('paintWorn', 0.9);
	V.mid(0, y0 + hs / 2, z1, bw + 0.02, hs, 0.1, co.body);
	V.m('worn'); V.mid(0, y0 + hs + 0.1, z1 - 0.06, bw + 0.2, 0.12, 0.12, C.dark);
	for (const s of [-1, 1]) V.mid(s * (bw / 2 + 0.09), y0 + hs * 0.5, z1 - 0.02, 0.1, hs + 0.2, 0.14, C.dark);
	// (the name down the side of the body)
	V.m('decal', 0.8);
	for (const s of [-1, 1]) V.decal(s * (bw / 2 + 0.105), y0 + hs * 0.62, mz + 0.2, 2.8, 0.62, rect('side' + co.i), co.body, s * Math.PI / 2);
	V.m('decal'); V.decal(0, y0 + hs * 0.55, z1 - 0.06, 1.0, 0.36, rect('reverse'), co.body, Math.PI);
	backEnd(V, z1 - 0.14, -4.25);
	// what was cleared, heaped up over the sides
	if (full) {
		V.m('rubble');
		V.heap(0, y0 + hs - 0.25, mz - 0.1, bw - 0.1, L - 0.2, 0.75, [C.rubble, C.concrete, [0.48, 0.45, 0.42], [0.62, 0.58, 0.52], [0.4, 0.37, 0.33]], 7, 12);
		if (!V.far) for (let k = 0; k < 9; k++) { const s = 0.28 + (k % 3) * 0.14; V.mid(((k * 37) % 9 - 4) * 0.2, y0 + hs + 0.15 + (k % 3) * 0.08, z1 + 0.6 + k * 0.45, s, s * 0.6, s * 1.2, k % 2 ? C.concrete : [0.5, 0.47, 0.44], k * 0.7, k * 0.3, k * 0.2); }
		if (!V.far) { V.m('worn'); for (let k = 0; k < 4; k++) V.bar([-0.6 + k * 0.4, y0 + hs + 0.2, mz - 1 + k * 0.3], [-0.3 + k * 0.35, y0 + hs + 0.7, mz + 0.4 - k * 0.2], 0.012, C.rust); }
	}
}

// ---------- the mixer ----------
// the drum on its own (it turns): a lathe along its tilted axis, banded in the company's colours
export const DRUM = { o: [0, 2.35, 0.15], tilt: Math.atan2(0.82, -4.85) };
function mixerTruck(V, co) {
	conventional(V, co);
	const T = TRUCKS.mixer;
	axleSet(V, T.axles, 2.0, 0.52, 0.32, 1);
	V.m('worn', 0.9);
	// the subframe, the front pedestal with its gearbox, the rear pedestal and its rollers
	V.mid(0, 1.25, -2.2, 1.0, 0.16, 6.2, C.dark);
	V.mid(0, 1.6, 0.35, 0.9, 1.0, 0.5, C.dark);
	for (const s of [-1, 1]) { V.bar([s * 0.5, 1.3, -3.4], [s * 0.72, 2.75, -3.75], 0.07, C.dark); V.bar([s * 0.5, 1.3, -4.1], [s * 0.72, 2.75, -3.75], 0.07, C.dark); V.cyl(s * 0.7, 2.78, -3.75, 0.12, 0.14, 'x', C.dark, 10); }
	// the water tank behind the cab
	V.m('paint'); V.cyl(-0.92, 1.95, 0.42, 0.28, 1.3, 'y', C.white, 14);
	V.m('chrome'); for (const y of [1.45, 2.45]) V.cyl(-0.92, y, 0.42, 0.29, 0.04, 'y', C.chrome, 14);
	// the hopper, the chute, the folded extensions, the ladder and its platform
	V.m('worn', 0.85);
	V.lathe([[0.3, 0], [0.42, 0.22], [0.66, 0.58], [0.69, 0.64]], 0, 3.15, -4.72, 'y', C.dark, 12);
	V.mid(0, 2.9, -4.72, 0.55, 0.5, 0.4, C.dark);
	for (const s of [-1, 1]) V.bar([s * 0.45, 1.3, -4.6], [s * 0.42, 3.3, -4.7], 0.05, C.dark);
	V.mid(0, 2.35, -5.45, 0.55, 0.12, 1.1, co.body, 0, 0.45, 0);
	for (const s of [-1, 1]) V.mid(s * 0.29, 2.43, -5.45, 0.04, 0.18, 1.1, co.body, 0, 0.45, 0);
	V.mid(1.1, 1.45, -4.5, 0.12, 0.5, 1.4, C.dark);
	V.mid(1.1, 1.45, -5.2, 0.12, 0.5, 1.2, C.dark, 0, -0.2, 0);
	V.m('galv');
	for (const s of [-1, 1]) V.tube([s * 0.25 - 0.8, 0.5, -5.3], [s * 0.25 - 0.8, 3.0, -5.05], 0.02, C.galv);
	if (!V.far) for (let y = 0.7; y < 3.0; y += 0.3) V.tube([-1.05, y, -5.3 + (y - 0.5) * 0.1], [-0.55, y, -5.3 + (y - 0.5) * 0.1], 0.015, C.galv);
	V.mid(-0.55, 3.0, -4.95, 0.9, 0.04, 0.6, C.galv);
	if (!V.far) { V.tube([-0.95, 3.0, -5.2], [-0.95, 3.9, -5.2], 0.015, C.galv); V.tube([-0.95, 3.9, -5.2], [-0.35, 3.9, -5.2], 0.015, C.galv); }
	// (the fenders over the tandem)
	V.m('paintWorn');
	for (const s of [-1, 1]) V.mid(s * 1.05, 1.18, -3.27, 0.62, 0.04, 2.4, C.dark);
	backEnd(V, -5.4, -4.45, 2.2);
}
function drum(V, co) {
	const far = V.far;
	// (a profile along the axis: the front cap, the belly, the long cone up to the opening)
	const pr = [[0, -0.08], [0.5, 0], [0.92, 0.35], [1.12, 0.8], [1.18, 1.3], [1.18, 1.9], [1.14, 2.5], [1.02, 3.0], [0.86, 3.5], [0.68, 4.0], [0.52, 4.5], [0.46, 4.85], [0.4, 4.86]];
	const g = new THREE.LatheGeometry(pr.map(([r, h]) => new THREE.Vector2(r, h)), far ? 12 : 28);
	// (turned to lie along its axis, from the front pedestal up toward the hopper)
	g.rotateX(Math.PI / 2 - DRUM.tilt);
	g.translate(...DRUM.o);
	const ax = new THREE.Vector3(0, Math.sin(DRUM.tilt), Math.cos(DRUM.tilt));
	V.m('paint', 0.55);
	V.spin(DRUM.o[1], DRUM.o[2], 2, DRUM.tilt);
	// the company's colours in a spiral band round it
	V.geo(g, co.paint, (x, y, z) => {
		const q = new THREE.Vector3(x - DRUM.o[0], y - DRUM.o[1], z - DRUM.o[2]), s = q.dot(ax);
		q.addScaledVector(ax, -s);
		const a = Math.atan2(q.x, q.y) / (Math.PI * 2);
		return ((a + s / 1.7) % 1 + 1) % 1 < 0.3 ? co.trim : null;
	});
	// the roller track near the back, the blades' lip at the opening
	V.m('steel', 0.6);
	const ring = (s, r, w) => { const c = new THREE.CylinderGeometry(r, r, w, far ? 12 : 28, 1, true); c.rotateX(Math.PI / 2 - DRUM.tilt); c.translate(DRUM.o[0] + ax.x * s, DRUM.o[1] + ax.y * s, DRUM.o[2] + ax.z * s); V.geo(c, C.steel); };
	ring(3.95, 0.82, 0.12); ring(4.84, 0.47, 0.1);
	V.spin(null);
}

// ---------- the boom truck ----------
function flatTruck(V, co, load) {
	conventional(V, co);
	const T = TRUCKS.flat;
	axleSet(V, T.axles, 2.0, 0.52, 0.32, 1);
	// the knuckle crane behind the cab, folded down
	V.m('paint', 0.5);
	V.mid(0, 1.3, 0.35, 0.9, 0.3, 0.7, co.body);
	V.cyl(0, 2.0, 0.35, 0.28, 1.3, 'y', co.body, 12);
	V.mid(0, 2.75, 0.35, 0.5, 0.4, 0.6, co.body);
	V.mid(0, 2.85, -0.9, 0.36, 0.36, 2.4, co.body, 0, 0.18, 0);
	V.mid(0, 2.35, -1.6, 0.3, 0.3, 2.0, co.body, 0, -0.2, 0);
	V.m('chrome'); V.cyl(0, 2.4, 0.0, 0.07, 1.0, 'z', C.chrome, 8);
	V.m('worn'); for (const s of [-1, 1]) { V.mid(s * 0.85, 1.0, 0.35, 0.75, 0.16, 0.24, C.dark); V.mid(s * 1.14, 0.75, 0.35, 0.14, 0.6, 0.14, C.dark); }
	// the deck: timber between steel rails, stake pockets, the headache rack at the front
	const z0 = -0.15, z1 = -5.45, mz = (z0 + z1) / 2, L = z0 - z1;
	V.m('worn', 0.9); V.mid(0, 1.2, mz, 1.0, 0.2, L, C.dark);
	V.m('wood', 0.7); V.mid(0, 1.38, mz, 2.4, 0.08, L, C.wood);
	if (!V.far) { V.m('wood', 0.9); for (let k = 0; k < 11; k++) V.mid(-1.15 + k * 0.23, 1.423, mz, 0.01, 0.005, L, [0.4, 0.3, 0.2]); }
	V.m('paintWorn', 0.8);
	for (const s of [-1, 1]) { V.mid(s * 1.24, 1.33, mz, 0.08, 0.2, L, co.body); if (!V.far) for (let k = 0; k < 7; k++) V.mid(s * 1.27, 1.3, z0 - 0.3 - k * (L - 0.6) / 6, 0.05, 0.12, 0.08, C.dark); }
	V.mid(0, 1.36, z0 + 0.04, 2.48, 0.1, 0.1, co.body);
	V.m('galv');
	for (const s of [-1, 1]) V.mid(s * 1.18, 1.95, z0 + 0.05, 0.08, 1.1, 0.08, C.galv);
	V.mid(0, 2.5, z0 + 0.05, 2.44, 0.08, 0.08, C.galv);
	if (!V.far) for (let k = -3; k <= 3; k++) V.mid(k * 0.32, 1.95, z0 + 0.05, 0.03, 1.08, 0.03, C.galv);
	V.m('decal', 0.6); for (const s of [-1, 1]) V.decal(s * 1.285, 1.33, mz, 2.2, 0.18, rect('chevron'), co.body, s * Math.PI / 2);
	backEnd(V, z1 - 0.06, -4.95);
	// what it brings
	const top = 1.42;
	if (load === 'blocks') for (let k = 0; k < 3; k++) blocksPallet(V, 0, top, -1.1 - k * 1.45, 0);
	else if (load === 'glass') glassFrame(V, 0, top, -2.6, 0, 3.8);
	else if (load === 'bars') {
		V.m('wood'); for (const z of [-1.0, -2.8, -4.6]) V.mid(0, top + 0.05, z, 2.1, 0.1, 0.12, C.wood);
		for (let b = 0; b < 3; b++) barsBundle(V, -0.7 + b * 0.7, top + 0.1, -2.8, 0, 5.2);
		if (!V.far) { V.m('plastic'); for (const z of [-1.4, -4.1]) V.mid(0, top + 0.42, z, 2.5, 0.02, 0.05, [0.95, 0.6, 0.05]); }
	} else { V.m('wood'); for (const z of [-1.2, -3.0, -4.8]) V.mid(0, top + 0.05, z, 2.1, 0.1, 0.12, C.wood); }
}

// ---------- loads, shared with the site's props ----------
// blocks (concrete masonry units) on a pallet, strapped, the wrap over the top
export function blocksPallet(V, x, y, z, ry = 0) {
	pallet(V, x, y, z, ry);
	V.m('concrete', 0.3);
	V.mid(x, y + 0.14 + 0.44, z, 1.04, 0.88, 0.98, C.block, ry);
	if (!V.far) {
		// (the courses and the joints, a shade darker)
		const c = Math.cos(ry), s = Math.sin(ry);
		for (let k = 1; k < 4; k++) V.mid(x, y + 0.14 + k * 0.22, z, 1.05, 0.012, 0.99, [0.52, 0.51, 0.49], ry);
		for (const o of [-0.26, 0, 0.26]) V.mid(x + c * o, y + 0.58, z - s * o, 0.012, 0.88, 0.99, [0.52, 0.51, 0.49], ry);
		V.m('plastic'); for (const o of [-0.3, 0.3]) V.mid(x + s * o, y + 0.58, z + c * o, 1.07, 0.9, 0.02, [0.12, 0.12, 0.13], ry);
	}
	V.m('plastic'); V.mid(x, y + 1.03, z, 1.06, 0.03, 1.0, [0.86, 0.88, 0.9], ry);
}
// a pallet: three runners, the deck boards
export function pallet(V, x, y, z, ry = 0) {
	V.m('wood', 0.6);
	const c = Math.cos(ry), s = Math.sin(ry);
	if (V.far) { V.mid(x, y + 0.07, z, 1.2, 0.14, 1.0, C.wood, ry); return; }
	for (const o of [-0.45, 0, 0.45]) V.mid(x + s * o, y + 0.05, z + c * o, 1.2, 0.1, 0.1, [0.58, 0.45, 0.3], ry);
	for (let k = 0; k < 7; k++) { const o = -0.53 + k * 0.177; V.mid(x + c * o, y + 0.12, z - s * o, 0.13, 0.03, 1.0, C.wood, ry); }
}
// a bundle of reinforcing bars, banded
export function barsBundle(V, x, y, z, ry, len) {
	V.m('worn', 0.95);
	const c = Math.cos(ry), s = Math.sin(ry);
	if (V.far) { V.mid(x, y + 0.11, z, 0.36, 0.22, len, C.rust, ry); return; }
	for (let k = 0; k < 9; k++) { const ox = ((k % 3) - 1) * 0.11, oy = Math.floor(k / 3) * 0.08; V.cyl(x + c * ox, y + 0.05 + oy, z - s * ox, 0.025, len - (k % 2) * 0.2, 'z', k % 2 ? C.rust : [0.36, 0.2, 0.12], 5); }
	V.m('worn'); for (const o of [-len * 0.3, len * 0.3]) V.mid(x + s * o, y + 0.13, z + c * o, 0.38, 0.28, 0.03, C.dark, ry);
}
// the glazier's A-frame with its panes leaning on both sides
export function glassFrame(V, x, y, z, ry, len) {
	V.m('paint', 0.5);
	const c = Math.cos(ry), s = Math.sin(ry), P = (u, v) => [x + c * u + s * v, z - s * u + c * v];
	V.mid(x, y + 0.06, z, 1.3, 0.12, len, [0.2, 0.36, 0.62], ry);
	for (const v of [-len / 2 + 0.2, 0, len / 2 - 0.2]) { const [px, pz] = P(0, v); V.mid(px, y + 0.9, pz, 0.08, 1.6, 0.08, [0.2, 0.36, 0.62], ry); for (const sd of [-1, 1]) { const [qx, qz] = P(sd * 0.28, v); V.mid(qx, y + 0.85, qz, 0.06, 1.6, 0.06, [0.2, 0.36, 0.62], ry, 0, sd * 0.18); } }
	V.m('rubber'); for (const sd of [-1, 1]) { const [px, pz] = P(sd * 0.42, 0); V.mid(px, y + 0.15, pz, 0.18, 0.06, len - 0.1, C.black, ry); }
	V.m('pane');
	for (const sd of [-1, 1]) for (let k = 0; k < (V.far ? 1 : 4); k++) {
		const [px, pz] = P(sd * (0.34 + k * 0.035), 0);
		V.mid(px, y + 1.0, pz, 0.012, 1.7, len - 0.3 - k * 0.15, [0.62, 0.74, 0.72], ry, 0, sd * 0.18);
	}
}

// ---------- the glazier's van ----------
function vanBody(V, co) {
	const T = TRUCKS.van, hw = 1.0;
	// (its side: the arches cut round the wheels)
	const t0 = Math.asin(0.05 / 0.52), arc = (z0) => { const a = []; for (let k = 0; k <= 10; k++) { const t = Math.PI - t0 - k / 10 * (Math.PI - 2 * t0); a.push([z0 + Math.cos(t) * 0.52, 0.37 + Math.sin(t) * 0.52]); } return a; };
	V.m('paint');
	V.ext([[-2.97, 0.42], ...arc(-1.75), ...arc(1.9), [2.9, 0.42], [2.98, 0.75], [2.94, 1.0], [2.55, 1.15], [2.0, 1.28], [1.15, 2.38], [0.85, 2.62], [-2.85, 2.66], [-2.97, 2.55]], -hw + 0.05, hw - 0.05, C.white, 0.05);
	// (the arches' wells dark behind the tyres)
	V.m('plastic'); for (const z of T.axles) V.mid(0, 0.7, z, 1.9, 0.5, 1.0, C.black);
	// glass: the windscreen, the cab's side windows
	V.m('glass');
	const ws = Math.atan2(0.85, 1.1) + 0.0;
	V.mid(0, 1.87, 1.625, 1.84, 1.3, 0.02, C.glass, 0, -ws, 0);
	for (const s of [-1, 1]) V.mid(s * (hw + 0.008), 1.7, 1.05, 0.02, 0.62, 0.9, C.glass);
	// bumpers, grille, lamps
	V.m('plastic');
	V.rbox(0, 0.55, 2.92, 2.04, 0.3, 0.2, C.black, 0.06); V.rbox(0, 0.55, -2.95, 2.04, 0.26, 0.16, C.black, 0.06);
	V.mid(0, 0.92, 2.97, 1.1, 0.3, 0.03, C.black);
	V.m('lamp'); for (const s of [-1, 1]) V.rbox(s * 0.72, 0.98, 2.88, 0.36, 0.16, 0.12, C.lamp, 0.04);
	V.m('tail'); for (const s of [-1, 1]) V.rbox(s * 0.93, 1.1, -2.98, 0.1, 0.5, 0.04, C.tail, 0.02);
	// the seams: front doors, the sliding door, the back doors; handles; mirrors
	V.m('plastic');
	for (const s of [-1, 1]) { for (const z of [1.55, 0.55, -0.85]) V.mid(s * (hw + 0.009), 1.45, z, 0.01, 1.85, 0.015, C.dark); V.mid(s * (hw + 0.009), 2.35, -0.15, 0.01, 0.02, 1.4, C.dark); }
	V.mid(0, 1.5, -3.025, 0.012, 2.0, 0.01, C.dark);
	if (!V.far) for (const s of [-1, 1]) { V.rbox(s * (hw + 0.24), 1.85, 1.45, 0.06, 0.34, 0.2, C.black, 0.03); V.tube([s * hw, 1.62, 1.5], [s * (hw + 0.22), 1.72, 1.45], 0.02, C.black); }
	V.m('decal'); for (const s of [-1, 1]) V.decal(s * (hw + 0.004), 1.6, -1.6, 2.4, 0.53, rect('side' + co.i), C.white, s * Math.PI / 2);
	V.decal(0, 1.9, -3.026, 1.3, 0.29, rect('side' + co.i), C.white, Math.PI);
	// the company stripe low along the sides
	V.m('paint'); for (const s of [-1, 1]) V.mid(s * (hw + 0.005), 0.9, -0.3, 0.01, 0.14, 4.6, co.paint);
	V.m('beacon'); V.cyl(0, 2.72, 1.2, 0.1, 0.12, 'y', C.amber, 10, 0.08);
	V.m('plastic'); V.mid(0, 2.66, 1.2, 0.5, 0.04, 0.2, C.black);
	// the glass rack on the kerb side (right): its frame leaning out, the panes on it
	V.m('galv');
	for (let z = -2.3; z <= 0.11; z += 0.8) V.tube([-hw - 0.2, 0.62, z], [-hw - 0.04, 2.5, z], 0.025, C.galv);
	V.tube([-hw - 0.24, 0.66, -2.45], [-hw - 0.24, 0.66, 0.2], 0.035, C.galv);
	V.tube([-hw - 0.06, 2.45, -2.45], [-hw - 0.06, 2.45, 0.2], 0.025, C.galv);
	V.m('rubber'); V.mid(-hw - 0.3, 0.7, -1.12, 0.12, 0.06, 2.6, C.black);
	V.m('pane');
	for (let k = 0; k < (V.far ? 1 : 3); k++) V.mid(-hw - 0.17 + k * 0.025, 1.55, -1.12 + k * 0.1, 0.012, 1.68, 2.3 - k * 0.3, [0.62, 0.74, 0.72], 0, 0, 0.084);
	axleSet(V, T.axles, 1.72, 0.37, 0.24, 9, C.silver);
}

// ---------- the all-terrain crane's carrier ----------
function carrierBody(V, co) {
	const T = TRUCKS.carrier, paint = co.crane;
	V.m('worn', 0.85);
	V.mid(0, 1.0, 0, 1.3, 0.5, 11.4, C.dark);
	// the deck: boxy, the ends sloped, the slewing ring on it
	V.m('paint', 0.45);
	V.ext([[6.1, 0.95], [6.2, 1.35], [5.6, 1.7], [-5.8, 1.7], [-6.35, 1.35], [-6.3, 0.95]], -1.37, 1.37, paint, 0.04);
	V.m('worn'); V.cyl(0, 1.78, -1.0, 1.15, 0.16, 'y', C.dark, 24);
	// (the boom rest over the front)
	V.m('paint'); V.mid(0, 2.2, 5.0, 0.9, 0.9, 0.3, paint);
	// the cab: low, on the left, glass all round its front
	V.rbox(0.82, 2.3, 4.85, 1.0, 1.3, 1.6, paint, 0.08);
	V.m('glass');
	V.mid(0.82, 2.45, 5.66, 0.86, 0.9, 0.02, C.glass, 0, -0.12, 0);
	V.mid(1.33, 2.45, 4.85, 0.02, 0.85, 1.35, C.glass);
	V.mid(0.31, 2.45, 4.85, 0.02, 0.85, 1.35, C.glass);
	V.m('lamp'); for (const s of [-1, 1]) V.rbox(s * 1.05, 1.35, 6.18, 0.36, 0.16, 0.06, C.lamp, 0.03);
	V.m('beacon'); V.cyl(0.85, 3.04, 4.3, 0.1, 0.13, 'y', C.amber, 10, 0.08); V.cyl(-0.9, 1.8, -5.6, 0.1, 0.13, 'y', C.amber, 10, 0.08);
	// the engine's hood at the back, its grille; the stack
	V.m('paint'); V.rbox(-0.55, 2.0, -4.6, 1.5, 0.8, 2.6, paint, 0.06);
	V.m('plastic'); V.mid(-1.31, 2.0, -4.6, 0.02, 0.5, 1.6, C.black);
	V.m('chrome'); V.cyl(-1.0, 2.7, -3.4, 0.08, 1.0, 'y', C.chrome, 8);
	// the outriggers: the beams out, the jacks down to their pads
	V.m('paint', 0.6);
	for (const z of [5.35, -5.55]) for (const s of [-1, 1]) {
		V.mid(s * 1.1, 1.15, z, 0.9, 0.5, 0.5, paint);
		V.mid(s * 2.15, 1.15, z, 1.9, 0.36, 0.36, C.yellow);
		V.m('chrome'); V.cyl(s * 3.0, 0.55, z, 0.08, 0.98, 'y', C.chrome, 10);
		V.m('paint', 0.6); V.cyl(s * 3.0, 1.15, z, 0.16, 0.7, 'y', paint, 10);
		V.m('worn', 0.9); V.cyl(s * 3.0, 0.0, z, 0.32, 0.12, 'y', C.dark, 14);
		V.m('reflect'); for (let k = 0; k < 4; k++) V.mid(s * (1.5 + k * 0.42), 1.15, z + 0.185, 0.21, 0.24, 0.005, k % 2 ? C.white : C.red);
		V.m('paint', 0.6);
	}
	V.m('decal'); for (const s of [-1, 1]) V.decal(s * 1.375, 1.35, 0.5, 4.0, 0.5, rect('side' + co.i), paint, s * Math.PI / 2);
	backEnd(V, -6.32, -5.0, 2.6);
	// (four axles, the wheels up off the ground: it stands on its outriggers)
	axleSet(V, T.axles, 2.15, 0.62, 0.55, 9, C.silver);
}

// ---------- built once per kind, company and load; near and far ----------
const cache = new Map();
export function truckGeo(kind, coIndex, load = '', far = false) {
	const key = kind + ':' + coIndex + ':' + load + ':' + (far ? 'f' : 'n');
	let g = cache.get(key);
	if (g) return g;
	const co = { ...COMPANIES[coIndex % COMPANIES.length], i: coIndex % COMPANIES.length };
	const K = parts({ far }), V = K.at(0, 0, 0);
	if (kind === 'dump') dumpTruck(V, co, load !== 'empty');
	else if (kind === 'mixer') { mixerTruck(V, co); drum(V, co); }
	else if (kind === 'flat') flatTruck(V, co, load || 'none');
	else if (kind === 'van') vanBody(V, co);
	else if (kind === 'carrier') carrierBody(V, co);
	g = K.merge();
	g.userData.shared = true;
	cache.set(key, g);
	return g;
}
export const truckCacheSize = () => cache.size;
