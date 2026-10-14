// A service's building as the street sees it, before you are near enough for its rooms to be
// built (interiors/): the same outside walls, windows and floors the rooms will have (the
// plan's levels built bare, interiors/build.js), so nothing jumps when the rooms take over;
// and what stays whether or not they are built: the plinth and the steps, the roof and its
// plant, the upper storeys of a taller block, the signs, the hospital's ambulance canopy, the
// fire station's bay doors and the police garage's door, which open as something comes.
// One builder, merged by material, per building.

import * as THREE from 'three';
import { Builder, houseMaterials, lin } from '../bay/housekit.js';
import { prepare, buildLevel } from '../interiors/build.js';
import { PLANS } from './interiors.js';
import { signOf } from './names.js';

let MATS = null;
// the materials the shells share (the houses' own, seen out to well over a kilometre)
export const shellMats = () => MATS || (MATS = houseMaterials([-2, -1, 1400, 1500]));
export const LOOK = {
	hospital: { wall: [0.9, 0.9, 0.87], trim: [0.2, 0.42, 0.68], sign: '#1d5fa8', ink: '#ffffff' },
	police: { wall: [0.74, 0.69, 0.6], trim: [0.12, 0.18, 0.3], sign: '#14223a', ink: '#f2f2ea' },
	fire: { wall: [0.58, 0.22, 0.17], trim: [0.92, 0.91, 0.86], sign: '#f2efe6', ink: '#8e1a12' },
	armory: { wall: [0.56, 0.56, 0.48], trim: [0.3, 0.32, 0.26], sign: '#2f3527', ink: '#e8e6d8' },
};

// the plan a building's shell and rooms both come from (W, D: the outside walls' size)
export const planOf = (kind, W, D) => PLANS[kind]({ W, D });

function signTexture(text, sub, look, w, h) {
	const cv = document.createElement('canvas'), S = 128;
	cv.width = Math.max(256, Math.min(2048, Math.round(w / h * S))); cv.height = S;
	const g = cv.getContext('2d');
	g.fillStyle = look.sign; g.fillRect(0, 0, cv.width, S);
	g.fillStyle = look.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
	let fs = sub ? 54 : 70;
	g.font = `700 ${fs}px Arial, Helvetica, sans-serif`;
	while (g.measureText(text).width > cv.width * 0.92 && fs > 18) { fs -= 2; g.font = `700 ${fs}px Arial, Helvetica, sans-serif`; }
	g.fillText(text, cv.width / 2, sub ? S * 0.38 : S / 2);
	if (sub) { g.font = `600 30px Arial, Helvetica, sans-serif`; g.fillText(sub, cv.width / 2, S * 0.78); }
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
function signMesh(text, sub, look, w, h) {
	const map = signTexture(text, sub, look, w, h);
	const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.15, roughness: 0.5 }));
	m.userData.sign = true;
	return m;
}
// a sectional door, seen from the street: panels and a row of windows (w wide, h high)
function doorGeometry(w, h, col, M) {
	const b = new Builder(), c = lin(col), dark = lin([0.08, 0.09, 0.1]);
	const rows = Math.max(4, Math.round(h / 0.55));
	for (let i = 0; i < rows; i++) {
		const y0 = i * h / rows, y1 = y0 + h / rows - 0.02;
		if (i === rows - 2) { for (let x = -w / 2 + 0.1; x < w / 2 - 0.3; x += 0.62) { b.box('trim', x, y0, -0.03, x + 0.06, y1, 0.03, c); b.box('glass', x + 0.06, y0 + 0.05, -0.01, x + 0.58, y1 - 0.05, 0.01, lin([0.9, 0.9, 0.9])); } b.box('trim', w / 2 - 0.3, y0, -0.03, w / 2, y1, 0.03, c); }
		else b.box('trim', -w / 2, y0, -0.03, w / 2, y1, 0.03, c);
		b.box('matte', -w / 2, y1, -0.02, w / 2, y1 + 0.02, 0.02, dark);
	}
	const g = b.meshes(M);
	const grp = new THREE.Group();
	for (const m of g) grp.add(m);
	return grp;
}

// F: { kind, x, z, a, W, D, f0, groundMin, blockTop, street }
export function buildShell(F) {
	const M = shellMats(), look = LOOK[F.kind] || LOOK.armory;
	const P = planOf(F.kind, F.W, F.D), C = prepare(P, { outside: look.wall, litShare: 0.8 });
	const root = new THREE.Group(), levels = new THREE.Group(), fixed = new THREE.Group();
	root.name = 'service:' + F.kind;
	root.position.set(F.x, F.f0, F.z); root.rotation.y = -F.a;
	root.add(levels, fixed);
	const night = { value: 0 };
	for (let k = 0; k < P.levels.length; k++) {
		const gen = buildLevel(P, M, C, k, false, night);
		let r = gen.next();
		while (!r.done) r = gen.next();
		levels.add(r.value.root);
	}
	const g = new Builder(), hw = F.W / 2, hd = F.D / 2, top = P.top, wallC = lin(look.wall), trimC = lin(look.trim), conc = lin([0.62, 0.61, 0.58]);
	const col = [[-hw, -hd, hw, hd, -5, 60]];
	// the plinth down to the lowest ground, and the steps up to the doors where the floor stands high
	const low = Math.min(-0.3, F.groundMin - F.f0 - 0.4);
	g.box('concrete', -hw - 0.05, low, -hd - 0.05, hw + 0.05, -0.01, hd + 0.05, conc);
	const rise = F.f0 - F.street, steps = [];
	if (rise > 0.18) for (const d of [P.door, ...(P.amb ? [{ x: P.amb.x, w: P.amb.w }] : [])]) {
		// (a ramp, not steps, for the ambulance doors and the bays)
		const n = Math.min(14, Math.ceil(rise / 0.17)), dw = d.w + 0.6;
		for (let i = 0; i < n; i++) { const y = rise * (n - i) / (n + 1) - rise, z0 = hd + i * 0.3; g.box('concrete', d.x - dw / 2, low, z0, d.x + dw / 2, y, z0 + 0.3, conc); steps.push([d.x - dw / 2, z0, d.x + dw / 2, z0 + 0.3, y]); }
	}
	// a taller block than the plan: its upper storeys, solid, glazed in bands
	const H = Math.max(top, F.blockTop - F.f0);
	if (H > top + 0.4) {
		const t = 0.2;
		for (const [x0, z0, x1, z1] of [[-hw, hd - t, hw, hd], [-hw, -hd, hw, -hd + t], [-hw, -hd, -hw + t, hd], [hw - t, -hd, hw, hd]]) g.box('stucco', x0, top, z0, x1, H, z1, wallC);
		g.box('ceiling', -hw + t, top + 0.02, -hd + t, hw - t, top + 0.05, hd - t, lin([0.3, 0.3, 0.3]));
		for (let y = top + 1.0; y < H - 1.2; y += 3.3) {
			for (const s of [-1, 1]) { g.box('glass', -hw + 0.6, y, s * (hd + 0.005) - 0.004, hw - 0.6, y + 1.5, s * (hd + 0.005) + 0.004, lin([0.4, 0.45, 0.5])); g.box('matte', -hw + 0.6, y, s * (hd - 0.22) - 0.01, hw - 0.6, y + 1.5, s * (hd - 0.22) + 0.01, lin([0.12, 0.13, 0.14])); }
			for (const s of [-1, 1]) { g.box('glass', s * (hw + 0.005) - 0.004, y, -hd + 0.6, s * (hw + 0.005) + 0.004, y + 1.5, hd - 0.6, lin([0.4, 0.45, 0.5])); g.box('matte', s * (hw - 0.22) - 0.01, y, -hd + 0.6, s * (hw - 0.22) + 0.01, y + 1.5, hd - 0.6, lin([0.12, 0.13, 0.14])); }
		}
	}
	// the roof: its slab, a parapet with a coping in the trim colour, the plant on it
	g.box('concrete', -hw, H, -hd, hw, H + 0.25, hd, lin([0.45, 0.45, 0.44]));
	for (const [x0, z0, x1, z1] of [[-hw, hd - 0.2, hw, hd], [-hw, -hd, hw, -hd + 0.2], [-hw, -hd, -hw + 0.2, hd], [hw - 0.2, -hd, hw, hd]]) { g.box('stucco', x0, H, z0, x1, H + 0.85, z1, wallC); g.box('trim', x0 - 0.03, H + 0.85, z0 - 0.03, x1 + 0.03, H + 0.95, z1 + 0.03, trimC); }
	const units = Math.max(1, Math.min(4, Math.floor(F.W / 9)));
	for (let i = 0; i < units; i++) { const x = -hw + (i + 0.5) * F.W / units, z = -hd * 0.3; g.box('metal', x - 1, H + 0.25, z - 0.7, x + 1, H + 1.5, z + 0.7, lin([0.66, 0.67, 0.68])); g.cyl('metal', x, H + 1.5, z, 0.45, 0.06, lin([0.3, 0.3, 0.32]), 12); }
	// a band of the trim colour over the ground floor, and its storeys' sills
	g.box('trim', -hw - 0.04, P.levels[0].h + 0.1, hd, hw + 0.04, P.levels[0].h + 0.4, hd + 0.06, trimC);
	const doors = [], signs = [], pads = [[-hw, -hd, hw, hd, 0]];
	if (F.kind === 'hospital' && P.amb) {
		// the ambulance canopy over the bay: a deck on four posts, lit underneath
		const cx = P.amb.x, cw = Math.min(9, hw - cx + 4), z1 = hd + 7.5, ch = 4.4;
		g.box('concrete', cx - cw / 2, ch, hd, cx + cw / 2, ch + 0.45, z1, lin([0.85, 0.85, 0.83]));
		g.box('trim', cx - cw / 2 - 0.02, ch + 0.1, z1 - 0.02, cx + cw / 2 + 0.02, ch + 0.45, z1 + 0.02, trimC);
		for (const sx of [-1, 1]) { const x = cx + sx * (cw / 2 - 0.3); g.box('metal', x - 0.15, low, z1 - 0.45, x + 0.15, ch, z1 - 0.15, lin([0.82, 0.82, 0.8])); col.push([x - 0.2, z1 - 0.5, x + 0.2, z1 - 0.1, -5, ch]); }
		for (let z = hd + 1.2; z < z1 - 0.5; z += 2) g.box('lamp', cx - 1.2, ch - 0.02, z - 0.1, cx + 1.2, ch, z + 0.1, lin([1, 0.97, 0.9]));
		// the bay's floor, level with the doors, painted where the ambulances stand
		g.box('concrete', cx - cw / 2, low, hd, cx + cw / 2, 0.0, z1, lin([0.5, 0.5, 0.5]));
		pads.push([cx - cw / 2, hd, cx + cw / 2, z1, 0]);
		for (let i = -1; i <= 1; i += 2) g.box('gloss', cx + i * 1.6 - 0.06, 0.0, hd + 0.5, cx + i * 1.6 + 0.06, 0.004, z1 - 0.3, lin([0.9, 0.85, 0.2]));
		const em = signMesh('EMERGENCY', null, { sign: '#b4161b', ink: '#ffffff' }, Math.min(cw - 0.6, 6), 0.42);
		em.position.set(cx, ch + 0.27, z1 + 0.03); fixed.add(em); signs.push(em);
		const sliding = doorGeometry(P.amb.w, 2.85, [0.75, 0.78, 0.8], M);
		sliding.position.set(cx, 0, hd - 0.06); fixed.add(sliding);
		doors.push({ mesh: sliding, x: cx, z: hd, h: 2.85, open: 0, target: 0, kind: 'slide' });
		F.bayAt = { x: cx, z: hd + 4.2, yaw: Math.PI };
	}
	if (F.kind === 'fire') for (const b of P.bays || []) {
		const d = doorGeometry(b.w, 4.2, [0.62, 0.1, 0.07], M);
		d.position.set(b.x, 0, hd - 0.08); fixed.add(d);
		doors.push({ mesh: d, x: b.x, z: hd, h: 4.2, open: 0, target: 0, kind: 'roll' });
		// the apron in front of each door
		g.box('concrete', b.x - b.w / 2 - 0.3, low, hd, b.x + b.w / 2 + 0.3, 0.0, hd + 8, lin([0.58, 0.58, 0.56]));
		pads.push([b.x - b.w / 2 - 0.3, hd, b.x + b.w / 2 + 0.3, hd + 8, 0]);
	}
	if (F.kind === 'police' && P.bay) {
		const w = P.bay.x1 - P.bay.x0 - 0.2, x = (P.bay.x0 + P.bay.x1) / 2, d = doorGeometry(w, 3.2, [0.55, 0.57, 0.6], M);
		d.position.set(x, 0, hd - 0.08); fixed.add(d);
		doors.push({ mesh: d, x, z: hd, h: 3.2, open: 0, target: 0, kind: 'roll' });
	}
	if (F.kind === 'armory') {
		const d = doorGeometry(3.2, 3.2, [0.35, 0.37, 0.3], M);
		d.position.set(-F.W / 4, 0, -hd + 0.08); d.rotation.y = Math.PI; fixed.add(d);
		doors.push({ mesh: d, x: -F.W / 4, z: -hd, h: 3.2, open: 0, target: 0, kind: 'roll' });
	}
	// the name over the door, and up on the parapet where it can be seen down the street
	const S = signOf(F.kind, F.x, F.z), sw = Math.min(F.W * 0.55, 11);
	const main = signMesh(S.top, S.sub, look, sw, sw / 7.5);
	main.position.set(F.kind === 'fire' ? (P.door.x + -hw) / 2 : P.door.x, P.levels[0].h + 0.25 + sw / 15, hd + 0.08);
	if (F.kind === 'fire') main.position.x = Math.max(-hw + sw / 2, Math.min(hw - sw / 2, 0));
	if (F.kind === 'hospital') main.position.x = Math.max(-hw + sw / 2, Math.min(hw - sw / 2, P.door.x));
	fixed.add(main); signs.push(main);
	if (F.kind === 'hospital') {
		const h = signMesh('H', null, { sign: '#1d5fa8', ink: '#ffffff' }, 1.6, 1.6);
		h.position.set(hw - 1.4, H + 1.9, hd + 0.05); fixed.add(h); signs.push(h);
		g.box('metal', hw - 1.45, H + 0.95, hd - 0.05, hw - 1.35, H + 1.1, hd + 0.04, lin([0.5, 0.5, 0.5]));
	}
	for (const m of g.meshes(M)) fixed.add(m);
	return {
		root, levels, fixed, doors, signs, col, steps, pads, P, H,
		setNight(k) { for (const s of signs) s.material.emissiveIntensity = 0.15 + k * 0.9; },
		dispose() {
			root.traverse((q) => { if (q.isMesh) { q.geometry.dispose(); if (q.userData.sign) { q.material.map?.dispose(); q.material.dispose(); } } });
		},
	};
}
// a door's opening: rolled up into the head, or slid aside
export function setDoor(D, k) {
	D.open = k;
	if (D.kind === 'roll') { D.mesh.scale.y = Math.max(0.04, 1 - k); D.mesh.position.y = D.h * k; }
	else { D.mesh.scale.x = Math.max(0.04, 1 - k); }
}
