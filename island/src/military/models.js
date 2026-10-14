// The military's vehicles, modelled in proportion and all original: a main battle tank (a
// sloped glacis, side skirts over seven road wheels a side, a wedge turret with its mantlet,
// a long gun with a fume extractor, the commander's cupola, smoke dischargers and a stowage
// basket), a six-wheeled armoured truck with a small weapon station, an open utility jeep with
// a roll frame, a canvas-topped cargo truck, a single-seat jet (delta wing, twin canted fins,
// side intakes, bubble canopy, gear that folds away) and a utility helicopter (rotor and tail
// rotor that turn, stub wings with pods, skids). Each is
// built in its parts, +z forward, y up, its origin on the ground at its middle: the parts that
// move (turret, gun, rotors, gear) have their own pivots; `whole` is everything in its rest
// pose, merged by material, for the parked ones drawn many at once.

import * as THREE from 'three';
import { builder } from './kit.js';

const PI = Math.PI, H = PI / 2;
// sizes, for the physics and the parking (L long, W wide, H high, wr wheel radius)
export const DIMS = Object.freeze({
	tank: { L: 7.9, W: 3.6, H: 2.55, wr: 0.42, clear: 0.45, wz: 2.6, mass: 42000 },
	apc: { L: 7.2, W: 2.75, H: 2.7, wr: 0.6, clear: 0.5, wz: 2.4, mass: 16000 },
	jeep: { L: 4.6, W: 2.05, H: 1.95, wr: 0.43, clear: 0.42, wz: 1.45, mass: 2600 },
	truck: { L: 8.2, W: 2.5, H: 3.3, wr: 0.55, clear: 0.45, wz: 2.7, mass: 9000 },
	jet: { L: 15.6, W: 10.2, H: 4.6, wr: 0.36, clear: 1.2, wz: 4.5, mass: 13000 },
	heli: { L: 16.5, W: 3.2, H: 4.4, wr: 0.2, clear: 0.3, wz: 1.5, mass: 6500 },
});
// the colours a side paints them
export const SCHEMES = Object.freeze({ woodland: '#5b6346', desert: '#b6a47c', invader: '#6f7064', grey: '#8c939b', police: '#141a2c' });

const OLIVE = '#ffffff', DARK = '#3a3d40', TYRE = '#1d1e1f', STEEL = '#6f7378';

// road wheels and a stadium-shaped track belt along one side
function trackSide(B, s, L, wr, y0, w) {
	const x = s * (DIMS.tank.W / 2 - w / 2 - 0.02), n = 7, span = L - 1.5;
	for (let i = 0; i < n; i++) B.cyl('dark', wr, wr, w * 0.7, x, y0 + wr, -span / 2 + i * span / (n - 1), 14, STEEL, 0, H);
	B.cyl('dark', 0.36, 0.36, w * 0.7, x, y0 + 0.62, L / 2 - 0.55, 12, DARK, 0, H);
	B.cyl('dark', 0.34, 0.34, w * 0.7, x, y0 + 0.58, -L / 2 + 0.5, 12, DARK, 0, H);
	for (let i = 0; i < 4; i++) B.cyl('dark', 0.1, 0.1, w * 0.5, x, y0 + 1.05, -span / 2 + 0.6 + i * (span - 1.2) / 3, 8, DARK, 0, H);
	// the belt: a flat run below, one above, curving round the sprocket and idler
	const r = 0.48, pts = [];
	for (let i = 0; i <= 10; i++) { const a = -H + (i / 10) * PI; pts.push([L / 2 - 0.55 + Math.cos(a) * r, y0 + 0.55 + Math.sin(a) * r]); }
	for (let i = 0; i <= 10; i++) { const a = H + (i / 10) * PI; pts.push([-L / 2 + 0.5 + Math.cos(a) * r, y0 + 0.55 + Math.sin(a) * r]); }
	const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
	const hole = new THREE.Path(pts.map(([a, b]) => new THREE.Vector2(a * 0.985, y0 + 0.55 + (b - y0 - 0.55) * 0.82)));
	sh.holes.push(hole);
	const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -w / 2);
	B.add('rubber', g, x, 0, 0, -H, TYRE);
}

function tank(B, part = 'all') {
	const D = DIMS.tank, L = 7.3, y0 = 0.08;
	if (part === 'all' || part === 'hull') {
		// the hull: a side profile (z forward, y up) pressed out to the hull's width
		const hw = 2.4;
		B.extrude('camo', [[-3.65, 0.55], [3.0, 0.55], [3.85, 1.0], [2.55, 1.62], [-3.55, 1.68], [-3.75, 1.3]], hw, 0, 0, 0, -H, OLIVE);
		// fenders over the tracks, skirts down their sides
		for (const s of [-1, 1]) {
			B.cbox('camo', 0.66, 0.06, L + 0.5, s * (D.W / 2 - 0.33), 1.62, 0.05, 0, OLIVE);
			B.cbox('camo', 0.05, 0.62, L - 0.6, s * (D.W / 2 - 0.02), 1.3, 0.15, 0, OLIVE);
			for (let i = 0; i < 6; i++) B.cbox('camo', 0.03, 0.58, 0.04, s * (D.W / 2 + 0.01), 1.3, -2.9 + i * 1.18, 0, '#d6d6d0');
			trackSide(B, s, L, D.wr, y0, 0.62);
			// stowage bins on the fenders, a tow cable
			B.box('camo', 0.5, 0.36, 1.1, s * (D.W / 2 - 0.36), 1.65, -2.3, 0, '#e6e6e0');
			B.cyl('dark', 0.03, 0.03, 3.2, s * 1.0, 1.7, -1.0, 6, DARK, H);
		}
		// engine deck grilles, exhausts, tow hooks, headlights
		for (let i = 0; i < 4; i++) B.cbox('dark', 1.9, 0.04, 0.12, 0, 1.7, -2.2 - i * 0.28, 0, DARK);
		for (const s of [-1, 1]) {
			B.cbox('dark', 0.5, 0.25, 0.08, s * 0.8, 1.2, -3.7, 0, DARK);
			B.cyl('dark', 0.06, 0.06, 0.25, s * 0.85, 0.8, 3.75, 6, DARK, H);
			B.cbox('lamp', 0.18, 0.12, 0.08, s * 1.0, 1.32, 3.25, 0, '#fff3d0');
			B.cbox('dark', 0.24, 0.18, 0.12, s * 1.0, 1.32, 3.18, 0, DARK);
		}
		// the driver's hatch and periscopes on the glacis
		B.cyl('camo', 0.38, 0.38, 0.08, -0.55, 1.66, 2.35, 14, OLIVE);
		for (let i = -1; i <= 1; i++) B.cbox('glass', 0.16, 0.06, 0.04, -0.55 + i * 0.2, 1.7, 2.68, 0);
	}
	if (part === 'all' || part === 'turret') {
		// the turret: a wedge plan pressed up, its cheeks sloped, the bustle long behind
		const ty = part === 'all' ? 1.66 : 0, tz = part === 'all' ? -0.25 : 0;
		const plan = [[0, 2.55], [1.05, 1.65], [1.62, 0.9], [1.62, -1.3], [1.35, -2.6], [-1.35, -2.6], [-1.62, -1.3], [-1.62, 0.9], [-1.05, 1.65]];
		const sh = new THREE.Shape(plan.map(([x, z]) => new THREE.Vector2(x, z)));
		const g = new THREE.ExtrudeGeometry(sh, { depth: 0.82, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
		g.rotateX(H); g.translate(0, 0.82, 0);
		B.add('camo', g, 0, ty, tz, 0, OLIVE);
		// the mantlet, cupola, gunner's sight, hatches, smoke dischargers, basket, aerials
		B.cbox('camo', 1.0, 0.62, 0.5, 0, ty + 0.42, tz + 2.45, 0, OLIVE);
		B.cyl('camo', 0.42, 0.46, 0.32, 0.72, ty + 1.02, tz - 0.4, 14, OLIVE);
		B.cyl('glass', 0.43, 0.43, 0.06, 0.72, ty + 1.05, tz - 0.4, 14);
		B.cyl('dark', 0.03, 0.03, 0.9, 0.72, ty + 1.28, tz - 0.05, 6, DARK, H);
		B.cbox('camo', 0.5, 0.38, 0.6, -0.8, ty + 1.0, tz + 0.7, 0, OLIVE);
		B.cbox('glass', 0.38, 0.22, 0.04, -0.8, ty + 1.05, tz + 1.01, 0);
		B.cyl('camo', 0.36, 0.36, 0.06, -0.55, ty + 0.86, tz - 0.6, 14, OLIVE);
		for (const s of [-1, 1]) for (let i = 0; i < 4; i++) B.cyl('dark', 0.055, 0.055, 0.3, s * (1.55 + 0.02 * i), ty + 0.6 + (i % 2) * 0.13, tz + 0.95 - Math.floor(i / 2) * 0.14, 8, DARK, -0.9, s * 0.25);
		B.box('canvas', 2.6, 0.45, 0.8, 0, ty + 0.3, tz - 3.0, 0, '#8d8460');
		B.box('dark', 2.7, 0.04, 0.9, 0, ty + 0.25, tz - 3.0, 0, DARK);
		for (const s of [-1, 1]) B.cyl('dark', 0.012, 0.012, 2.6, s * 1.1, ty + 2.1, tz - 2.3, 4, DARK);
	}
	if (part === 'all' || part === 'gun') {
		// the gun: barrel, fume extractor, muzzle (its pivot at the trunnions)
		const gy = part === 'all' ? 1.66 + 0.42 : 0, gz = part === 'all' ? -0.25 + 2.55 : 0;
		B.cyl('camo', 0.12, 0.14, 2.4, 0, gy, gz + 1.4, 14, OLIVE, H);
		B.cyl('camo', 0.18, 0.18, 0.75, 0, gy, gz + 2.6, 14, OLIVE, H);
		B.cyl('camo', 0.1, 0.11, 2.3, 0, gy, gz + 4.1, 14, OLIVE, H);
		B.cyl('dark', 0.13, 0.13, 0.22, 0, gy, gz + 5.25, 14, DARK, H);
		B.cyl('dark', 0.04, 0.04, 0.55, 0.32, gy + 0.05, gz + 0.5, 6, DARK, H);
	}
}

// six big wheels with hubs
function wheels(B, D, zs, w = 0.42) {
	for (const z of zs) for (const s of [-1, 1]) {
		const x = s * (D.W / 2 - w / 2);
		B.cyl('rubber', D.wr, D.wr, w, x, D.wr, z, 18, TYRE, 0, H);
		B.cyl('dark', D.wr * 0.55, D.wr * 0.55, w + 0.02, x, D.wr, z, 10, STEEL, 0, H);
		B.cyl('dark', D.wr * 0.2, D.wr * 0.2, w + 0.08, x, D.wr, z, 8, DARK, 0, H);
	}
}
function apc(B) {
	const D = DIMS.apc;
	// an armoured hull: the nose sloped, the sides angled in at the top, a flat roof
	B.extrude('camo', [[-3.55, 0.7], [2.9, 0.7], [3.6, 1.25], [2.7, 2.05], [-3.55, 2.15]], D.W - 0.1, 0, 0, 0, -H, OLIVE, 0.04);
	B.extrude('camo', [[-3.4, 2.1], [2.4, 2.1], [2.2, 2.45], [-3.3, 2.45]], D.W - 0.55, 0, 0, 0, -H, OLIVE);
	wheels(B, D, [2.4, 0.6, -2.3]);
	for (const s of [-1, 1]) {
		// wheel arches, vision blocks, a side door, steps
		for (const z of [2.4, 0.6, -2.3]) B.cbox('camo', 0.1, 0.16, 1.5, s * (D.W / 2 - 0.02), 1.32, z, 0, OLIVE);
		for (let i = 0; i < 3; i++) B.cbox('glass', 0.04, 0.2, 0.32, s * (D.W / 2 - 0.12), 1.75, 1.5 - i * 1.3, 0);
		B.cbox('camo', 0.05, 0.95, 1.1, s * (D.W / 2 - 0.02), 1.45, -0.7, 0, '#e2e2dc');
		B.cbox('dark', 0.25, 0.04, 0.5, s * (D.W / 2 - 0.05), 0.72, -0.7, 0, DARK);
		B.cbox('lamp', 0.16, 0.1, 0.06, s * 0.95, 1.25, 3.4, 0, '#fff3d0');
	}
	B.cbox('glass', 1.5, 0.3, 0.05, 0, 1.75, 2.95, 0.48);
	// a small weapon station on the roof, a spare wheel, the rear ramp, aerials
	B.cyl('camo', 0.5, 0.55, 0.3, 0.3, 2.6, -0.3, 14, OLIVE);
	B.cbox('camo', 0.5, 0.35, 0.7, 0.3, 2.9, -0.2, 0, OLIVE);
	B.cyl('dark', 0.05, 0.05, 1.3, 0.3, 2.9, 0.6, 8, DARK, H);
	B.cyl('rubber', D.wr * 0.9, D.wr * 0.9, 0.35, -0.6, 2.62, -2.6, 16, TYRE, 0);
	B.cbox('camo', D.W - 0.6, 1.2, 0.08, 0, 1.35, -3.58, 0, '#e4e4de');
	for (const s of [-1, 1]) B.cyl('dark', 0.012, 0.012, 2.2, s * 1.0, 3.5, -3.0, 4, DARK);
}
function jeep(B) {
	const D = DIMS.jeep;
	// the tub, the bonnet sloping to a flat grille, flared wings over the wheels
	B.extrude('camo', [[-2.25, 0.62], [2.2, 0.62], [2.3, 1.05], [2.15, 1.18], [0.75, 1.24], [0.6, 1.28], [-2.25, 1.32]], D.W - 0.18, 0, 0, 0, -H, OLIVE, 0.04);
	for (const s of [-1, 1]) for (const z of [D.wz, -D.wz]) B.cbox('camo', 0.32, 0.08, 1.1, s * (D.W / 2 - 0.12), 1.12, z, 0, OLIVE);
	wheels(B, D, [D.wz, -D.wz], 0.3);
	// the windscreen frame and its glass, the roll frame, seats, a spare wheel, an aerial
	B.cbox('dark', D.W - 0.3, 0.05, 0.05, 0, 1.75, 0.6, 0, DARK, -0.15);
	for (const s of [-1, 1]) B.cbox('dark', 0.05, 0.5, 0.05, s * (D.W / 2 - 0.18), 1.5, 0.66, 0, DARK, -0.15);
	B.cbox('glass', D.W - 0.42, 0.42, 0.02, 0, 1.5, 0.64, 0, undefined, -0.15);
	for (const s of [-1, 1]) {
		B.cyl('dark', 0.04, 0.04, 0.85, s * (D.W / 2 - 0.2), 1.72, -0.55, 6, DARK);
		B.cyl('dark', 0.04, 0.04, 0.85, s * (D.W / 2 - 0.2), 1.72, -1.6, 6, DARK);
		B.cyl('dark', 0.04, 0.04, 1.05, s * (D.W / 2 - 0.2), 2.13, -1.07, 6, DARK, H);
		B.box('canvas', 0.5, 0.12, 0.5, s * 0.42, 1.3, -0.1, 0, '#4a4a40');
		B.box('canvas', 0.5, 0.55, 0.1, s * 0.42, 1.38, -0.38, 0, '#4a4a40');
		B.cbox('lamp', 0.14, 0.14, 0.05, s * 0.72, 1.05, 2.31, 0, '#fff3d0');
	}
	B.cyl('dark', 0.04, 0.04, D.W - 0.4, 0, 2.15, -0.55, 6, DARK, 0, H);
	B.cyl('dark', 0.04, 0.04, D.W - 0.4, 0, 2.15, -1.6, 6, DARK, 0, H);
	B.cyl('rubber', D.wr, D.wr, 0.28, 0, 1.15, -2.38, 16, TYRE, H);
	B.cyl('dark', 0.012, 0.012, 2.4, 0.8, 2.4, -2.0, 4, DARK);
	for (let i = 0; i < 6; i++) B.cbox('dark', 0.05, 0.3, 0.02, -0.25 + i * 0.1, 0.85, 2.32, 0, DARK);
}
function truck(B) {
	const D = DIMS.truck;
	// the cab, its bonnet, the bed with a canvas cover on hoops
	B.extrude('camo', [[1.8, 0.75], [4.05, 0.75], [4.1, 1.55], [3.25, 1.75], [3.0, 2.85], [1.8, 2.9]], D.W - 0.1, 0, 0, 0, -H, OLIVE, 0.04);
	B.cbox('glass', D.W - 0.4, 0.62, 0.04, 0, 2.38, 3.1, 0, undefined, 0.2);
	for (const s of [-1, 1]) B.cbox('glass', 0.04, 0.55, 0.8, s * (D.W / 2 - 0.04), 2.4, 2.35, 0);
	B.box('camo', D.W, 0.12, 5.6, 0, 1.05, -1.1, 0, OLIVE);
	for (const s of [-1, 1]) B.box('camo', 0.06, 0.6, 5.6, s * (D.W / 2 - 0.03), 1.17, -1.1, 0, OLIVE);
	const cover = new THREE.CylinderGeometry(D.W / 2, D.W / 2, 5.5, 16, 1, false, -H, PI); cover.rotateX(-H).scale(1, 0.45, 1);
	B.add('canvas', cover, 0, 2.72, -1.1, 0, '#6e6a4c');
	B.box('canvas', D.W, 1.55, 5.5, 0, 1.17, -1.1, 0, '#6e6a4c');
	wheels(B, D, [3.0, -1.4, -2.8], 0.4);
	for (const s of [-1, 1]) { B.cbox('lamp', 0.16, 0.12, 0.05, s * 0.85, 1.25, 4.1, 0, '#fff3d0'); B.cyl('dark', 0.07, 0.07, 1.4, s * (D.W / 2 + 0.06), 2.3, 1.95, 8, DARK); }
}

function jet(B, part = 'all') {
	if (part === 'all' || part === 'body') {
		// the fuselage: a lathe from the needle nose to the nozzle, flattened a touch
		const prof = [[0, 7.8], [0.18, 7.2], [0.45, 6.0], [0.7, 4.6], [0.85, 3.2], [0.95, 1.0], [0.92, -2.5], [0.82, -5.5], [0.66, -7.2], [0.6, -7.6], [0.45, -7.7]];
		const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20); g.rotateX(H); g.scale(1.05, 0.88, 1);
		B.add('air', g, 0, 2.1, 0, 0, '#ffffff');
		// the canopy, the intakes, the spine
		const can = new THREE.SphereGeometry(1, 16, 10, 0, PI * 2, 0, H); can.scale(0.55, 0.62, 1.9);
		B.add('glass', can, 0, 2.62, 3.6, 0);
		B.cbox('dark', 0.58, 0.06, 0.25, 0, 2.62, 1.75, 0, DARK);
		for (const s of [-1, 1]) {
			B.extrude('air', [[2.6, -0.45], [-2.5, -0.45], [-2.5, 0.42], [2.2, 0.42], [2.9, 0.1]], 0.62, s * 1.0, 1.95, 0, -H, '#f0f0f0');
			B.cbox('dark', 0.5, 0.75, 0.05, s * 1.0, 1.95, 2.86, 0, '#202224');
		}
		B.extrude('air', [[3.0, 0], [-5.5, 0], [-6.5, 0.15], [3.0, 0.35]], 0.7, 0, 2.6, 0, -H, '#ffffff');
		// the wing: a cropped delta, thin, laid flat; the tailplanes; two fins canted out
		const wing = [[0, 2.6], [5.1, -2.8], [5.1, -3.9], [0, -4.3], [-5.1, -3.9], [-5.1, -2.8]];
		const wg = new THREE.ExtrudeGeometry(new THREE.Shape(wing.map(([x, z]) => new THREE.Vector2(x, z))), { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 1 });
		wg.rotateX(H);
		B.add('air', wg, 0, 1.9, 0, 0, '#ffffff');
		const tp = [[0, -5.4], [2.9, -7.2], [2.9, -7.9], [0, -7.8], [-2.9, -7.9], [-2.9, -7.2]];
		const tg = new THREE.ExtrudeGeometry(new THREE.Shape(tp.map(([x, z]) => new THREE.Vector2(x, z))), { depth: 0.12, bevelEnabled: false });
		tg.rotateX(H);
		B.add('air', tg, 0, 1.95, 0, 0, '#ffffff');
		for (const s of [-1, 1]) {
			const fin = [[-4.6, 0], [-7.4, 0], [-7.9, 2.5], [-6.6, 2.5]];
			const fg = new THREE.ExtrudeGeometry(new THREE.Shape(fin.map(([z, y]) => new THREE.Vector2(z, y))), { depth: 0.12, bevelEnabled: false });
			fg.translate(0, 0, -0.06); fg.rotateY(-H);
			B.add('air', fg, s * 0.75, 2.55, 0, 0, '#ffffff', 0, -s * 0.38);
			// missiles on the wingtips, a pylon tank under each wing
			B.cyl('air', 0.09, 0.09, 2.9, s * 5.2, 1.95, -2.2, 10, '#e9e9e4', H);
			B.cyl('air', 0.012, 0.09, 0.3, s * 5.2, 1.95, -0.6, 10, '#e9e9e4', H);
			B.cyl('air', 0.24, 0.24, 2.8, s * 2.6, 1.45, -1.0, 12, '#dadad6', H);
		}
		// the nozzle, its glow inside
		B.cyl('dark', 0.62, 0.55, 0.9, 0, 2.1, -7.9, 18, '#4a4c50', H);
		B.cyl('lamp', 0.45, 0.45, 0.05, 0, 2.1, -8.2, 14, '#ff9a50', H);
		B.cbox('lamp', 0.08, 0.08, 0.08, 5.15, 1.98, -3.4, 0, '#ff3030');
		B.cbox('lamp', 0.08, 0.08, 0.08, -5.15, 1.98, -3.4, 0, '#30ff60');
	}
	if (part === 'all' || part === 'gear') {
		// the gear: a nose leg and two main legs, their wheels
		for (const [x, z, h] of [[0, 4.5, 1.6], [1.4, -1.1, 1.5], [-1.4, -1.1, 1.5]]) {
			B.cyl('dark', 0.07, 0.07, h, x, h / 2 + 0.3, z, 8, STEEL);
			B.cyl('rubber', 0.36, 0.36, 0.25, x, 0.36, z, 14, TYRE, 0, H);
			B.cbox('dark', 0.05, 0.6, 0.9, x + (x ? Math.sign(x) * 0.22 : 0.2), 1.3, z, 0, '#9a9ea3');
		}
	}
}
function heli(B, part = 'all') {
	if (part === 'all' || part === 'body') {
		// the cabin pod, the boom tapering to the fin, the engines on top
		const prof = [[0, 2.9], [0.6, 2.75], [1.1, 2.2], [1.35, 1.2], [1.4, -0.6], [1.25, -1.8], [0.8, -2.6], [0.45, -3.2]];
		const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18); g.rotateX(H); g.scale(1.0, 0.95, 1);
		B.add('air', g, 0, 1.75, 0, 0, '#ffffff');
		const glass = new THREE.SphereGeometry(1, 16, 10, H - 1.1, 2.2, 0.35, 1.4); glass.scale(1.22, 1.15, 1.6);
		B.add('glass', glass, 0, 1.85, 1.45, 0);
		B.cyl('air', 0.42, 0.18, 6.6, 0, 2.05, -5.6, 12, '#ffffff', H);
		B.extrude('air', [[-8.0, 0], [-9.0, 0.2], [-9.2, 2.1], [-8.5, 2.1], [-7.8, 0.6]], 0.14, 0, 1.95, 0, -H, '#ffffff');
		const st = [[0, -7.4], [1.3, -7.7], [1.3, -8.1], [-1.3, -8.1], [-1.3, -7.7]];
		const sg = new THREE.ExtrudeGeometry(new THREE.Shape(st.map(([x, z]) => new THREE.Vector2(x, z))), { depth: 0.08, bevelEnabled: false }); sg.rotateX(H);
		B.add('air', sg, 0, 2.05, 0, 0, '#ffffff');
		B.cbox('air', 1.5, 0.75, 3.2, 0, 3.15, -0.4, 0, '#f2f2f2');
		for (const s of [-1, 1]) {
			B.cyl('dark', 0.32, 0.32, 0.35, s * 0.55, 3.15, -2.1, 12, DARK, H);
			// skids, stub wings, rocket pods, steps
			B.cyl('dark', 0.06, 0.06, 4.4, s * 1.25, 0.12, 0.2, 8, DARK, H);
			B.cyl('dark', 0.05, 0.05, 1.2, s * 1.05, 0.62, 1.3, 6, DARK, 0, s * 0.35);
			B.cyl('dark', 0.05, 0.05, 1.2, s * 1.05, 0.62, -0.9, 6, DARK, 0, s * 0.35);
			B.cbox('air', 1.4, 0.1, 0.8, s * 1.9, 1.6, -0.2, 0, '#f2f2f2');
			B.cyl('dark', 0.22, 0.22, 1.5, s * 2.3, 1.38, -0.15, 12, '#4a4c46', H);
			B.cbox('glass', 0.05, 0.55, 1.1, s * 1.3, 1.85, 0.1, 0);
		}
		// the chin gun, the beacon
		B.cyl('dark', 0.25, 0.25, 0.3, 0, 0.75, 2.2, 12, DARK);
		B.cyl('dark', 0.04, 0.04, 1.1, 0, 0.7, 2.75, 6, DARK, H);
		B.cbox('lamp', 0.12, 0.08, 0.12, 0, 3.6, -1.8, 0, '#ff3030');
	}
	if (part === 'all' || part === 'rotor') {
		const y = part === 'all' ? 3.85 : 0;
		B.cyl('dark', 0.35, 0.3, 0.4, 0, y, part === 'all' ? -0.2 : 0, 12, DARK);
		for (let i = 0; i < 4; i++) { const a = i * H; B.cbox('dark', 0.42, 0.06, 7.4, Math.sin(a) * 3.8, y + 0.15, (part === 'all' ? -0.2 : 0) + Math.cos(a) * 3.8, a, '#2b2d30'); }
	}
	if (part === 'all' || part === 'tail') {
		const at = part === 'all' ? [0.2, 3.2, -8.9] : [0, 0, 0];
		B.cyl('dark', 0.12, 0.12, 0.2, at[0], at[1], at[2], 8, DARK, 0, H);
		for (let i = 0; i < 2; i++) B.cbox('dark', 0.04, 1.5, 0.18, at[0] + 0.08, at[1], at[2], 0, '#2b2d30', i * H);
	}
}
const BUILD = { tank, apc, jeep, truck, jet, heli };
const cache = new Map();
// a kind's geometries: whole (rest pose, by material) and its moving parts with their pivots
export function vehicleGeometry(kind) {
	if (cache.has(kind)) return cache.get(kind);
	const make = (part) => { const B = builder(); BUILD[kind](B, part); return B.geometries(); };
	const out = { kind, whole: make('all'), parts: {}, pivots: {} };
	if (kind === 'tank') { out.parts = { hull: make('hull'), turret: make('turret'), gun: make('gun') }; out.pivots = { turret: [0, 1.66, -0.25], gun: [0, 0.42, 2.55] }; }
	else if (kind === 'jet') { out.parts = { body: make('body'), gear: make('gear') }; }
	else if (kind === 'heli') { out.parts = { body: make('body'), rotor: make('rotor'), tail: make('tail') }; out.pivots = { rotor: [0, 3.85, -0.2], tail: [0.2, 3.2, -8.9] }; }
	else out.parts = { body: out.whole };
	cache.set(kind, out);
	return out;
}
// a vehicle as a little hierarchy of meshes (the one you drive, the convoy's): root > turret >
// gun, root > rotor, root > tail, root > gear
export function vehicleMesh(kind, kit, colour = SCHEMES.woodland) {
	const G = vehicleGeometry(kind), root = new THREE.Group();
	root.name = 'mil-' + kind;
	const tint = new THREE.Color(colour);
	const mats = {};
	const matFor = (m) => {
		if (m !== 'camo' && m !== 'air') return kit[m];
		// (the paint, in this vehicle's colour: a clone of the shared program)
		if (!mats[m]) { mats[m] = kit[m].clone(); mats[m].color.copy(tint); mats[m].customProgramCacheKey = kit[m].customProgramCacheKey; mats[m].onBeforeCompile = kit[m].onBeforeCompile; }
		return mats[m];
	};
	const meshes = (geos, parent) => { for (const [m, g] of Object.entries(geos)) { const me = new THREE.Mesh(g, matFor(m)); me.castShadow = m !== 'lamp'; me.receiveShadow = true; parent.add(me); } };
	const pivot = (name) => { const g = new THREE.Group(); g.name = name; const p = G.pivots[name] || [0, 0, 0]; g.position.set(p[0], p[1], p[2]); return g; };
	if (kind === 'tank') {
		meshes(G.parts.hull, root);
		const tur = pivot('turret'), gun = pivot('gun');
		meshes(G.parts.turret, tur); meshes(G.parts.gun, gun);
		tur.add(gun); root.add(tur);
		root.userData = { turret: tur, gun };
	} else if (kind === 'heli') {
		meshes(G.parts.body, root);
		const rot = pivot('rotor'), tail = pivot('tail');
		meshes(G.parts.rotor, rot); meshes(G.parts.tail, tail);
		root.add(rot, tail);
		root.userData = { rotor: rot, tail };
	} else if (kind === 'jet') {
		meshes(G.parts.body, root);
		const gear = new THREE.Group(); gear.name = 'gear';
		meshes(G.parts.gear, gear); root.add(gear);
		root.userData = { gear };
	} else meshes(G.parts.body, root);
	root.userData.kind = kind;
	root.userData.dispose = () => { for (const m of Object.values(mats)) m.dispose(); };
	return root;
}
