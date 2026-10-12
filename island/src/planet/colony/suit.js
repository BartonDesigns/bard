// A colonist's space gear, fitted to their own body (people/body.js): every piece is hung on
// the bone it moves with, sized from the body's landmarks (its chest, waist and hips, the
// skull, the joints), so it walks, turns and hops with them. Three ways to be dressed:
//
//   eva    out on the regolith: the suit's soft goods in beta cloth (the body's own garment,
//          painted, dusty at the legs), a hard upper torso, bellows at the knees and elbows,
//          gloves and boots, the chest control box with its lights, mission and role patches,
//          a slim life-support pack, hoses, a tether; the comms cap under the helmet (no hair
//          shows), and the helmet with its gold sun visor half raised (the face shows
//          through the clear glass under it), lamps and hard shell
//   fresh  just in through the airlock: the helmet carried, the cap off, the suit's top
//          peeled down and tied at the waist over the cooling undergarment
//   under  at work or at ease: the cooling undergarment or coverall in their trade's
//          colour, a name tape on the chest, the role patch on the arm
//
// Shared shapes and materials for everyone (made on first use); per body only the fitted
// shells (torso, cap) and the lettering.

import * as THREE from 'three';
import { paint } from '../../people/garment.js';
import { signMesh } from './signs.js';

const UP = new THREE.Vector3(0, 1, 0);
let K = null;
function kit(env) {
	if (K) return K;
	const hard = new THREE.MeshStandardMaterial({ color: 0xe9e8e3, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
	K = {
		hard, soft: new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.8 }),
		dark: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.55, metalness: 0.2 }),
		glove: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.7 }),
		glass: new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.18, depthWrite: false, envMap: env || null }),
		visor: new THREE.MeshStandardMaterial({ color: 0xd6a945, roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.7, depthWrite: false, envMap: env || null, envMapIntensity: 1.4, side: THREE.DoubleSide }),
		capTop: new THREE.MeshStandardMaterial({ color: 0xece8dc, roughness: 0.9, side: THREE.DoubleSide }),
		capBand: new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.85, side: THREE.DoubleSide }),
		lamp: new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
		leds: [0x40ff70, 0xffb030, 0x40c0ff, 0xff4030].map((c) => new THREE.MeshBasicMaterial({ color: c })),
		accent: new Map(),
		ball: new THREE.SphereGeometry(1, 24, 16),
		visorG: new THREE.SphereGeometry(1, 20, 10, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.16, Math.PI * 0.28),
		shellG: new THREE.SphereGeometry(1, 18, 12, Math.PI * 1.12, Math.PI * 0.76, 0, Math.PI * 0.64),
		ringG: new THREE.TorusGeometry(1, 0.14, 8, 22).rotateX(Math.PI / 2),
		box: new THREE.BoxGeometry(1, 1, 1),
		cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
	};
	return K;
}
// the role's colour as a material (shared per colour)
const accent = (col) => { if (!K.accent.has(col)) K.accent.set(col, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); return K.accent.get(col); };

// the garment paints for each state: suit white and beta cloth, or the undergarment
export function suitPaint(col, state) {
	const lcvg = { kind: 'suit', col, acc: '#d8d8d4', pat: 'plain', fit: 'fitted', sleeves: 'long', fab: 'lcvg' };
	const beta = { kind: 'suit', col: '#e4e2db', acc: col, pat: 'plain', fit: 'regular', sleeves: 'long', fab: 'beta' };
	const legs = { kind: 'suit', col: '#cfc9bd', acc: col, pat: 'plain', legs: 'long', fit: 'regular', fab: 'beta' };
	const top = state === 'eva' ? beta : lcvg;
	const bottom = state === 'under' ? { ...lcvg, legs: 'long', fab: 'knit' } : legs;
	return { gen: 'alien', top, outer: null, bottom, shoes: { kind: 'boot', col: state === 'under' ? '#3a3d42' : '#d4d2cc', sole: '#1b1b1d' }, acc: [] };
}

// fit the gear to a body P (its landmarks P.cut, its skull P.skull); c: { name, role, col }
export function fitSuit(P, c, env) {
	const k = kit(env), cut = P.cut, sk = P.skull, map = P.map, heads = P.rest.heads;
	const bone = (n) => P.bones[map[n]] || P.bones[map.root];
	const H = (n) => heads[map[n]] || heads[map.root];
	const parts = { eva: [], fresh: [], under: [], helmet: null, cap: [] };
	// a mesh on a bone, at a point given in the body's rest frame
	const on = (n, mesh, x, y, z) => { const h = H(n); mesh.position.set(x - h.x, y - h.y, z - h.z); bone(n).add(mesh); return mesh; };
	const mk = (g, m, sx, sy, sz) => { const o = new THREE.Mesh(g, m); o.scale.set(sx, sy ?? sx, sz ?? sx); o.castShadow = true; return o; };
	const zc = (cut.frontZ + cut.backZ) / 2, hz = (cut.frontZ - cut.backZ) / 2 + 0.035, hx = Math.max(cut.shoulderX * 0.92, cut.waistX + 0.05);
	const tb = map.spine02 !== undefined ? 'spine02' : 'spine01';
	// the hard upper torso: a fitted shell from the waist to the neck ring
	{
		const prof = [[0.88, cut.waist + 0.02], [1.0, (cut.waist + cut.chest) / 2], [1.04, cut.chest], [0.98, cut.shoulder - 0.02], [0.62, cut.neck + 0.01], [0.5, cut.neck + 0.03]];
		const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 22);
		g.scale(hx, 1, hz);
		const m = new THREE.Mesh(g, k.hard); m.castShadow = true;
		parts.eva.push(on(tb, m, 0, 0, zc));
		parts.hutG = g;
	}
	// the chest control box and its lights; the pack; the hoses between them; a tether
	const cy = cut.chest - 0.05;
	parts.eva.push(on(tb, mk(k.box, k.dark, 0.21, 0.12, 0.08), 0, cy, cut.frontZ + 0.075));
	k.leds.forEach((m, i) => parts.eva.push(on(tb, mk(k.box, m, 0.022, 0.016, 0.01), -0.06 + i * 0.04, cy + 0.03, cut.frontZ + 0.117)));
	parts.eva.push(on(tb, mk(k.box, k.hard, 0.34, 0.5, 0.12), 0, cut.chest + 0.02, cut.backZ - 0.1));
	parts.eva.push(on(tb, mk(k.box, accent(c.col), 0.3, 0.05, 0.125), 0, cut.chest + 0.2, cut.backZ - 0.1));
	for (const sx of [-1, 1]) {
		const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.15, cut.chest - 0.12, cut.backZ - 0.06), new THREE.Vector3(sx * (hx + 0.04), cut.chest - 0.14, zc), new THREE.Vector3(sx * 0.1, cy - 0.02, cut.frontZ + 0.06)]);
		const g = new THREE.TubeGeometry(curve, 10, 0.014, 6);
		const h = H(tb); g.translate(-h.x, -h.y, -h.z);
		const m = new THREE.Mesh(g, sx < 0 ? k.dark : accent(c.col)); bone(tb).add(m); parts.eva.push(m);
		(parts.own ||= []).push(g);
	}
	parts.eva.push(on('root', mk(k.ringG, accent(c.col), 0.05, 0.05, 0.05), cut.hipX + 0.03, cut.hip, (cut.hipZ[0] + cut.hipZ[1]) / 2));
	// bellows at the knees and elbows, gloves, boots
	const along = (n, rings, r, step, dir = 0) => {
		const b = map[n]; if (b === undefined) return;
		const d = P.rest.dirs[b], q = new THREE.Quaternion().setFromUnitVectors(UP, d);
		for (let i = 0; i < rings; i++) {
			const o = mk(k.ringG, k.soft, r, r * 1.2, r); o.quaternion.copy(q);
			o.position.copy(d).multiplyScalar((i - (rings - 1) / 2) * step + dir);
			bone(n).add(o); (n.includes('arm') ? parts.eva : parts.legs ||= []).push(o);
		}
	};
	for (const s of ['L', 'R']) {
		along('lowerleg01.' + s, 3, 0.066, 0.035);
		along('lowerarm01.' + s, 3, 0.052, 0.03);
		const w = map['wrist.' + s];
		if (w !== undefined) {
			const d = P.rest.dirs[w], q = new THREE.Quaternion().setFromUnitVectors(UP, d);
			const gl = mk(k.ball, k.glove, 0.045, 0.07, 0.032); gl.quaternion.copy(q); gl.position.copy(d).multiplyScalar(0.06); bone('wrist.' + s).add(gl); parts.eva.push(gl);
			const cf = mk(k.ringG, accent(c.col), 0.045, 0.06, 0.045); cf.quaternion.copy(q); bone('wrist.' + s).add(cf); parts.eva.push(cf);
		}
		const f = H('foot.' + s);
		const boot = on('foot.' + s, mk(k.box, k.hard, 0.12, 0.11, 0.29), f.x, f.y - 0.045, f.z + 0.065);
		const sole = on('foot.' + s, mk(k.box, k.dark, 0.125, 0.025, 0.3), f.x, f.y - 0.105, f.z + 0.065);
		const cuff = on('foot.' + s, mk(k.cyl, k.hard, 0.068, 0.12, 0.068), f.x, f.y + 0.03, f.z);
		(parts.legs ||= []).push(boot, sole, cuff);
	}
	// the suit's top peeled down and tied at the waist (just in from the airlock)
	{
		const g = new THREE.TorusGeometry(1, 0.09, 8, 22).rotateX(Math.PI / 2); g.scale(cut.waistX + 0.03, 0.5, hz + 0.005);
		const m = new THREE.Mesh(g, k.soft); parts.fresh.push(on('root', m, 0, cut.waist - 0.04, zc)); (parts.own ||= []).push(g);
	}
	// the comms cap, fitted to the skull: a pale crown, dark sides, ear cups
	const hb = H('head');
	{
		const crown = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), band = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.13);
		for (const g of [crown, band]) {
			const p = g.attributes.position, v = new THREE.Vector3();
			for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const r = sk.radius(v) + 0.008; p.setXYZ(i, sk.c.x + v.x * r - hb.x, sk.c.y + v.y * r - hb.y, sk.c.z + v.z * r - hb.z); }
			g.computeVertexNormals(); (parts.own ||= []).push(g);
		}
		const a = new THREE.Mesh(crown, k.capTop), b = new THREE.Mesh(band, k.capBand);
		bone('head').add(a, b); parts.cap.push(a, b);
		for (const L of P.lobes || []) if (L) { const e = mk(k.cyl, k.capBand, 0.032, 0.02, 0.032); e.rotation.z = Math.PI / 2; e.position.set(L.x + Math.sign(L.x) * 0.012 - hb.x, L.y + 0.03 - hb.y, L.z - hb.z); bone('head').add(e); parts.cap.push(e); }
	}
	// the helmet: clear bubble, gold visor, hard shell, lamps, neck ring
	{
		let rMax = 0;
		for (const d of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7]]) rMax = Math.max(rMax, sk.radius(new THREE.Vector3(...d).normalize()));
		const R = rMax + 0.06, G = new THREE.Group();
		G.add(mk(k.ball, k.glass, R), mk(k.visorG, k.visor, R + 0.006), mk(k.shellG, k.hard, R + 0.01));
		for (const sx of [-1, 1]) { const l = mk(k.box, k.lamp, 0.03, 0.025, 0.02); l.position.set(sx * R * 0.82, R * 0.42, R * 0.4); const h = mk(k.box, k.hard, 0.05, 0.045, 0.06); h.position.set(sx * R * 0.84, R * 0.42, R * 0.33); G.add(h, l); }
		const ring = mk(k.ringG, k.hard, R * 0.72, R * 0.7, R * 0.72); ring.position.set(0, -R * 0.78, -0.01); G.add(ring);
		G.userData.head = new THREE.Vector3(sk.c.x - hb.x, sk.c.y + 0.012 - hb.y, sk.c.z + 0.01 - hb.z);
		G.userData.R = R;
		for (const m of G.children) m.renderOrder = 4;
		parts.helmet = G;
		bone('head').add(G);
	}
	// lettering: the name tape and the patches
	{
		const first = c.name.split(' ')[0].toUpperCase(), last = c.name.split(' ').slice(1).join(' ').toUpperCase();
		const tape = (bn, y, z, w) => { const h = H(bn), m = signMesh([{ kind: 'sign', text: `${first[0]}. ${last}`, x: -0.07 - h.x, y: y - h.y, z: z - h.z, yaw: 0, w, h: w * 0.25 }]); bone(bn).add(m); return m; };
		parts.eva.push(tape(tb, cy + 0.11, cut.frontZ + 0.07, 0.13));
		const u = tape(tb, cut.chest + 0.03, cut.frontZ + 0.016, 0.11); parts.under.push(u); parts.fresh.push(u);
		for (const [s, kind, text] of [['L', 'patch', 'TRANQUILITY|LUNAR CREW'], ['R', 'patch', c.role.toUpperCase()]]) {
			const b = map['upperarm01.' + s]; if (b === undefined) continue;
			const h = heads[b], sx = s === 'L' ? 1 : -1, x = h.x + sx * 0.062, y = h.y - 0.1;
			const m = signMesh([{ kind, text, x: x - h.x, y: y - h.y, z: 0.0, yaw: sx * Math.PI / 2, w: 0.075, h: 0.075 }]);
			bone('upperarm01.' + s).add(m); parts.eva.push(m);
			if (s === 'R') { const m2 = signMesh([{ kind, text, x: x - sx * 0.022 - h.x, y: y - h.y, z: 0.0, yaw: sx * Math.PI / 2, w: 0.06, h: 0.06 }]); bone('upperarm01.' + s).add(m2); parts.under.push(m2); parts.fresh.push(m2); }
		}
	}
	return parts;
}

// dress a fitted body for a state; carry the helmet in the right hand when just in
export function wear(P, G, c, state) {
	const eva = state === 'eva', fresh = state === 'fresh';
	for (const m of G.eva) m.visible = eva;
	for (const m of G.legs || []) m.visible = eva || fresh;
	for (const m of G.fresh) m.visible = fresh;
	for (const m of G.under) m.visible = !eva;
	for (const m of G.cap) m.visible = eva;
	const H = G.helmet;
	if (eva) { P.bones[P.map.head].add(H); H.position.copy(H.userData.head); H.rotation.set(0, 0, 0); H.visible = true; }
	else if (fresh) { const w = P.bones[P.map['wrist.R']] || P.bones[P.map.head]; w.add(H); H.position.set(-0.02, -0.08 - H.userData.R, 0.04); H.rotation.set(0, Math.PI / 2, 0.25); H.visible = true; }
	else H.visible = false;
	paint(P.clothMat, suitPaint(c.col, state));
}
// the hair never shows under the cap (the hair kit can arrive late, so this is kept up)
export function keepHair(P, state) { const show = state !== 'eva'; for (const m of [P.hair]) if (m && m.visible !== show) m.visible = show; }
export function dropSuit(G) {
	for (const k of ['eva', 'legs', 'fresh', 'under', 'cap']) for (const m of G[k] || []) m.removeFromParent();
	G.helmet?.removeFromParent();
	for (const g of G.own || []) g.dispose();
	G.hutG?.dispose();
	for (const k of ['eva', 'under']) for (const m of G[k] || []) if (m.name === 'colony:signs') m.geometry.dispose();
}
