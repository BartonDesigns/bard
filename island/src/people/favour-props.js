// The small things a favour is about, as they lie on the ground: keys on a split ring with a
// leather fob, a phone face down with its camera showing, a stitched leather wallet with
// cards at its edge, a pair of glasses folded, an earbud, a ticket with its stub, a knitted
// scarf, a handbag. Each is made once (propkit.js) and shared; y = 0 is the ground.

import * as THREE from 'three';
import { FAB, kit, rbox, reshape, outline, ribbon, cord, kitMaterial, M4 } from './propkit.js';
import { bagGeometry, HANDBAG } from './bags.js';

const V = THREE.Vector3;
const SILVER = 0xc3c7cc, BRASS = 0xc9a65a;
// a flat shape in x, z (a THREE.Shape drawn in x, y), extruded up by h with a soft edge
function slab(shape, h, bevel = 0.0004) {
	const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.0001, h - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
	g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0);
	return g;
}
// a key: a head with a hole, a blade with its cuts
function keyShape(round) {
	const s = new THREE.Shape();
	if (round) s.absarc(0, 0, 0.012, 0, Math.PI * 2, false);
	else { s.moveTo(-0.011, -0.01); s.lineTo(0.011, -0.01); s.quadraticCurveTo(0.014, 0, 0.011, 0.012); s.lineTo(-0.011, 0.012); s.quadraticCurveTo(-0.014, 0, -0.011, -0.01); }
	const hole = new THREE.Path(); hole.absarc(0, round ? 0.004 : 0.005, 0.0028, 0, Math.PI * 2, true); s.holes.push(hole);
	const blade = new THREE.Shape();
	const cuts = [0, 0.002, 0.0008, 0.0026, 0.001, 0.0022, 0];
	blade.moveTo(-0.0035, -0.008);
	blade.lineTo(-0.0035, -0.045);
	blade.lineTo(0.001, -0.047);
	for (let i = 0; i < cuts.length; i++) blade.lineTo(0.0035 + cuts[i], -0.042 + i * 0.005);
	blade.lineTo(0.0035, -0.008);
	blade.lineTo(-0.0035, -0.008);
	return [s, blade];
}
function keys() {
	const K = kit();
	K.add(new THREE.TorusGeometry(0.014, 0.0013, 6, 28), { col: SILVER, gloss: 2, at: M4(0, 0.0014, 0, Math.PI / 2, 0, 0) });
	// two keys hung on the ring, fanned out
	for (const [round, col, a] of [[true, BRASS, 0.5], [false, SILVER, -0.25]]) {
		// (the hole on the ring, the blade pointing away from it)
		const at = M4(Math.sin(a) * 0.013, 0.0004, Math.cos(a) * 0.013, 0, a, 0).multiply(M4(0, 0, 0.004));
		for (const s of keyShape(round)) K.add(slab(s, 0.0018), { col, gloss: 2, at: at.clone() });
	}
	// the fob: a stitched leather tab on its own little ring
	const tab = new THREE.Shape(); tab.moveTo(-0.009, 0); tab.lineTo(0.009, 0); tab.lineTo(0.009, -0.04); tab.quadraticCurveTo(0, -0.05, -0.009, -0.04); tab.lineTo(-0.009, 0);
	const fa = -2.1, fob = M4(Math.sin(fa) * 0.016, 0, Math.cos(fa) * 0.016, 0, fa, 0);
	K.add(new THREE.TorusGeometry(0.005, 0.001, 5, 14), { col: SILVER, gloss: 2, at: fob.clone().multiply(M4(0, 0.0012, 0.004, Math.PI / 2, 0, 0)) });
	K.add(slab(tab, 0.0032, 0.0008), { col: 0x8a5233, fab: FAB.leather, gloss: 0.35, at: fob.clone().multiply(M4(0, 0, 0.008)) });
	K.add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.004, 10), { col: BRASS, gloss: 2, at: fob.clone().multiply(M4(0, 0.002, 0.013)) });
	return K.done();
}
// a phone face down: rounded slab, its camera module and lenses, the buttons on its side
function phone() {
	const K = kit(), w = 0.072, h = 0.0078, l = 0.148;
	K.add(rbox(w, h, l, 0.0036, 2), { col: 0x3b3f46, gloss: 0.7, at: M4(0, h / 2, 0) });
	// a glass back, inset a hair
	const back = new THREE.Shape(); { const r = 0.008, x = w / 2 - 0.0012, z = l / 2 - 0.0012; back.moveTo(-x + r, -z); back.lineTo(x - r, -z); back.quadraticCurveTo(x, -z, x, -z + r); back.lineTo(x, z - r); back.quadraticCurveTo(x, z, x - r, z); back.lineTo(-x + r, z); back.quadraticCurveTo(-x, z, -x, z - r); back.lineTo(-x, -z + r); back.quadraticCurveTo(-x, -z, -x + r, -z); }
	K.add(new THREE.ShapeGeometry(back, 6), { col: 0x4a5059, gloss: 1, at: M4(0, h + 0.0002, 0, -Math.PI / 2, 0, 0) });
	// the screen underneath, black glass
	K.add(new THREE.ShapeGeometry(back, 6), { col: 0x050607, gloss: 1, at: M4(0, -0.0002, 0, Math.PI / 2, 0, 0) });
	// the camera module, raised, with two lenses and a flash
	const cx = -w / 2 + 0.019, cz = -l / 2 + 0.019;
	K.add(rbox(0.031, 0.0018, 0.031, 0.007, 2), { col: 0x555b63, gloss: 1, at: M4(cx, h + 0.0009, cz) });
	for (const [dx, dz] of [[-0.0072, -0.0072], [0.0072, 0.0072]]) {
		K.add(new THREE.CylinderGeometry(0.0058, 0.006, 0.0018, 18), { col: SILVER, gloss: 2, at: M4(cx + dx, h + 0.0026, cz + dz) });
		K.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0004, 18), { col: 0x07080b, gloss: 1, at: M4(cx + dx, h + 0.0036, cz + dz) });
		K.add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0003, 10), { col: 0x1b2a44, gloss: 1, at: M4(cx + dx, h + 0.0039, cz + dz) });
	}
	K.add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0004, 10), { col: 0xe8dfc8, gloss: 1, at: M4(cx + 0.0075, h + 0.002, cz - 0.0075) });
	// the side buttons
	for (const [z, len] of [[-0.03, 0.022], [0.005, 0.012], [0.022, 0.012]]) K.add(rbox(0.0012, 0.003, len, 0.0005, 1), { col: 0x5a5f66, gloss: 2, at: M4((z < 0 ? 1 : -1) * (w / 2 + 0.0004), h / 2, z) });
	return K.done();
}
// a bifold leather wallet: thicker at the fold, stitched round, cards at the open edge
function wallet() {
	const K = kit(), w = 0.112, h = 0.017, l = 0.092;
	K.add(reshape(rbox(w, h, l, 0.006, 2), (x, y, z) => [x, (y + h / 2) * (1.15 - 0.3 * (x / w + 0.5)), z]), { col: 0x4a2e1e, fab: FAB.leather, gloss: 0.35, shade: (x, y) => (Math.abs(y - h * 0.55) < 0.0012 && x > -w * 0.4 ? 0.6 : 1) });
	const top = (x) => h * (1.15 - 0.3 * (x / w + 0.5));
	const stitch = outline(w / 2 - 0.006, l / 2 - 0.006, 0.004, 48).map((o) => new V(o.x, top(o.x) + 0.0003, o.z));
	K.add(cord(stitch, 0.0006, { seg: 96, radial: 3, closed: true, shade: (t) => (Math.floor(t * 96) % 2 ? 1 : 0.4) }), { col: 0xc8a882, gloss: 0.2 });
	// the cards showing at the open side, and a note
	for (const [y, col, dz] of [[0.004, 0x2c5aa0, -0.004], [0.007, 0xe9e6dd, 0.003], [0.01, 0x1f7a5a, -0.002]]) K.add(new THREE.BoxGeometry(0.004, 0.0009, 0.08), { col, gloss: 0.5, at: M4(w / 2 - 0.0005, y, dz) });
	K.add(new THREE.BoxGeometry(0.003, 0.0006, 0.07), { col: 0x9fb08c, fab: FAB.paper, at: M4(w / 2 - 0.0002, 0.0125, 0.004) });
	return K.done();
}
// glasses folded and lying flat: two rims, the bridge, lenses, the arms folded behind
function glasses() {
	const K = kit(), w = 0.025, d = 0.0185, col = 0x1b1b1d;
	for (const s of [-1, 1]) {
		const cx = s * 0.031, rim = [];
		for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); rim.push(new V(cx + Math.sign(c) * Math.pow(Math.abs(c), 0.6) * w, 0.004, Math.sign(sn) * Math.pow(Math.abs(sn), 0.6) * d * (sn < 0 ? 0.9 : 1))); }
		K.add(cord(rim, 0.0021, { seg: 40, radial: 5, closed: true }), { col, gloss: 0.6 });
		const lens = new THREE.Shape(rim.map((p) => new THREE.Vector2(p.x, -p.z)));
		K.add(new THREE.ShapeGeometry(lens), { col: 0xb9c7cf, gloss: 1, at: M4(0, 0.004, 0, -Math.PI / 2, 0, 0) });
		// the arm, hinged at the outer corner, folded back across behind the frame
		const hx = s * (0.031 + w + 0.002);
		K.add(cord([new V(hx, 0.004, -d * 0.55), new V(hx - s * 0.006, 0.006 + (s > 0 ? 0.003 : 0), -d * 0.95), new V(-s * 0.02, 0.006 + (s > 0 ? 0.003 : 0), -d * 1.05), new V(-s * 0.05, 0.004 + (s > 0 ? 0.003 : 0), -d * 0.9), new V(-s * 0.06, 0.0025, -d * 0.6)], 0.0016, { seg: 20, radial: 4 }), { col, gloss: 0.6 });
		K.add(rbox(0.004, 0.003, 0.006, 0.001, 1), { col: SILVER, gloss: 2, at: M4(hx, 0.004, -d * 0.6) });
	}
	K.add(cord([new V(-0.031 + w * 0.92, 0.004, d * 0.35), new V(0, 0.0045, d * 0.55), new V(0.031 - w * 0.92, 0.004, d * 0.35)], 0.0018, { seg: 8, radial: 4 }), { col, gloss: 0.6 });
	return K.done();
}
// an earbud: a rounded head, its stem, the soft tip, the little grille
function earbud() {
	const K = kit();
	K.add(new THREE.SphereGeometry(0.009, 14, 10), { col: 0xf3f3f1, gloss: 0.8, at: M4(0, 0.008, 0, 0, 0, 0, [1, 0.85, 1.1]) });
	K.add(new THREE.CapsuleGeometry(0.0032, 0.026, 4, 10), { col: 0xf3f3f1, gloss: 0.8, at: M4(0.012, 0.0034, -0.012, Math.PI / 2, 0, 0.9) });
	K.add(new THREE.SphereGeometry(0.0055, 10, 8), { col: 0xb7bbbf, at: M4(-0.006, 0.009, 0.005, 0, 0, 0, [1, 0.8, 1]) });
	K.add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.0004, 10), { col: 0x2a2c30, gloss: 0.3, at: M4(0.002, 0.0151, -0.002) });
	return K.done();
}
// a ticket: a gently curled card, a coloured band, the perforation before its stub, an
// abstract pattern of bars (no words)
function ticket() {
	const K = kit(), w = 0.15, l = 0.06, bow = (x) => 0.0035 * Math.sin((x / w + 0.5) * Math.PI);
	K.add(reshape(new THREE.BoxGeometry(w, 0.0007, l, 20, 1, 2), (x, y, z) => [x, y + 0.0004 + bow(x), z]), { col: 0xf1ead2, fab: FAB.paper, shade: (x) => (Math.abs(x - 0.042) < 0.0008 ? 0.6 : 1) });
	K.add(reshape(new THREE.PlaneGeometry(0.1, 0.016, 10, 1), (x, y) => [x - 0.02, 0.0009 + bow(x - 0.02), -y + 0.014]), { col: 0xc0463a, fab: FAB.paper });
	for (let i = 0; i < 14; i++) { const x = 0.05 + i * 0.0016 + (i % 3) * 0.0004; K.add(new THREE.PlaneGeometry(0.0007 + (i % 2) * 0.0005, 0.03).rotateX(-Math.PI / 2), { col: 0x23252a, at: M4(x, 0.0009 + bow(x), -0.004) }); }
	for (let i = 0; i < 9; i++) K.add(new THREE.CircleGeometry(0.0007, 6).rotateX(-Math.PI / 2), { col: 0x8c8676, at: M4(0.042, 0.0009 + bow(0.042), -l / 2 + 0.006 + i * 0.006) });
	return K.done();
}
// a knitted scarf lying in a loose S, its ends fringed
function scarf() {
	const K = kit(), pts = [new V(-0.27, 0.007, -0.05), new V(-0.15, 0.007, 0.05), new V(0, 0.007, -0.03), new V(0.13, 0.007, 0.04), new V(0.26, 0.007, -0.02)];
	K.add(ribbon(pts, new V(0, 1, 0), 0.15, 0.012, { seg: 40, prof: 10, round: 0.5 }), { col: 0xa8323a, fab: FAB.knit, shade: (x, y, z) => 0.85 + 0.15 * Math.abs(Math.sin(x * 22 + z * 4)) });
	// the fringe: tassels at each end, across the width
	const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
	for (const end of [0, 1]) {
		const p = curve.getPointAt(end), t = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1), b = new V(-t.z, 0, t.x).normalize();
		for (let i = 0; i < 9; i++) { const q = p.clone().addScaledVector(b, (i / 8 - 0.5) * 0.14); K.add(cord([q, q.clone().addScaledVector(t, 0.02).add(new V(0, -0.002, (i % 2) * 0.004)), q.clone().addScaledVector(t, 0.045).setY(0.002)], 0.0018, { seg: 4, radial: 3 }), { col: 0x96283a, fab: FAB.knit }); }
	}
	return K.done();
}

const made = new Map();
const BUILD = { keys, phone, wallet, glasses, earbud, ticket, scarf };
// { geo, mat, lift } for a favour's thing; lift raises a hanging bag to stand on the ground
export function favourProp(shape) {
	if (shape === 'bag') return { geo: bagGeometry('handbag', 0, true), mat: kitMaterial('#5a3a26', '#5a3a26'), lift: 0.12 + HANDBAG.H };
	const k = BUILD[shape] ? shape : 'keys';
	if (!made.has(k)) made.set(k, BUILD[k]());
	return { geo: made.get(k), mat: kitMaterial('#ffffff', '#ffffff'), lift: 0 };
}
