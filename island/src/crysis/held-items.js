// The gear catalogue's items as crafted models (gameplay/arms.js ids), for the hand: yours (in
// view, or on your body in third person), your friends', and the gear screen's turning preview.
// Turned and extruded profiles with bevels, smooth normals, and a few shared materials whose
// textures (wood grain, leather, brushed metal, canvas) are drawn once on small canvases.
//
// Quality shows on every item: its trim metal goes from dark steel (Common) through bronze,
// silver and gold to a glowing gold (Legendary); from level 4 a polished inlay band appears, from
// level 7 a glowing core, and Legendary gear sheds a few motes of light. The fictional rifles are
// stylised trail tools: no real make, no working parts, nothing to build from.
//
// Each model: grip at the origin, up is +y, the long axis along +y for staffs and bows.
// lod 'low' (friends, phones) drops the small parts and halves the segments.

import * as THREE from 'three';
import { TIERS } from '../gameplay/gear-levels.js';

// an icon for each item, for lists and slots
export const ITEM_ICONS = {
	'aurora-trail-rifle': '🎯', 'mossback-scout-rifle': '🌲', 'warden-spark-carbine': '🛡️', 'reedline-hunting-bow': '🏹',
	'hunting-net': '🥅', 'trail-scent-kit': '🌿', 'door-brace': '🚪', 'lantern-alarm': '🔔', 'field-medkit': '🩹',
	'camp-lantern': '🏮', 'repair-roll': '🧰', 'station-signal-flare': '🎆',
};
export const iconOf = (id) => ITEM_ICONS[id] || '📦';

// ---------- textures, drawn once ----------
const tex = {};
function canvasTex(key, size, draw, repeat = [1, 1]) {
	if (tex[key]) return tex[key];
	const c = document.createElement('canvas'); c.width = c.height = size;
	const g = c.getContext('2d');
	draw(g, size);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
	return (tex[key] = t);
}
// a small seeded random, so every texture is the same each visit
function rnd(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }
const wood = () => canvasTex('wood', 256, (g, n) => {
	const r = rnd(7);
	g.fillStyle = '#8a5a32'; g.fillRect(0, 0, n, n);
	for (let k = 0; k < 90; k++) {
		const x = r() * n, w = 1 + r() * 3, a = 0.08 + r() * 0.22;
		g.strokeStyle = r() < 0.5 ? `rgba(60,32,14,${a})` : `rgba(190,130,80,${a})`; g.lineWidth = w;
		g.beginPath(); g.moveTo(x, 0);
		for (let y = 0; y <= n; y += 16) g.lineTo(x + Math.sin(y * 0.03 + k) * 4 + (r() - 0.5) * 2, y);
		g.stroke();
	}
});
const leather = () => canvasTex('leather', 128, (g, n) => {
	const r = rnd(11);
	g.fillStyle = '#4a2c1c'; g.fillRect(0, 0, n, n);
	for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,10,5' : '120,80,55'},${0.05 + r() * 0.1})`; g.fillRect(r() * n, r() * n, 2, 2); }
	// a wrap's diagonal bands and stitches
	g.strokeStyle = 'rgba(15,8,4,.55)'; g.lineWidth = 3;
	for (let k = -n; k < n * 2; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + n, n); g.stroke(); }
	g.strokeStyle = 'rgba(230,205,160,.7)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
	for (let k = -n + 8; k < n * 2; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + n, n); g.stroke(); }
}, [2, 2]);
const brushed = () => canvasTex('brushed', 128, (g, n) => {
	const r = rnd(3);
	g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, n, n);
	for (let k = 0; k < 400; k++) { const y = r() * n; g.strokeStyle = `rgba(${r() < 0.5 ? '60,64,70' : '235,238,242'},${0.06 + r() * 0.12})`; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(0, y); g.lineTo(n, y + (r() - 0.5) * 2); g.stroke(); }
});
const canvasCloth = () => canvasTex('canvas', 128, (g, n) => {
	g.fillStyle = '#5d6b46'; g.fillRect(0, 0, n, n);
	for (let k = 0; k < n; k += 3) { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(k, 0, 1, n); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, k, n, 1); }
	g.strokeStyle = 'rgba(235,225,190,.65)'; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.strokeRect(5, 5, n - 10, n - 10);
});
const mesh = () => canvasTex('mesh', 128, (g, n) => {
	g.clearRect(0, 0, n, n); g.strokeStyle = 'rgba(225,215,190,1)'; g.lineWidth = 2;
	for (let k = 0; k <= n; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); }
}, [3, 3]);
const mote = () => canvasTex('mote', 32, (g, n) => {
	const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
	r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = r; g.fillRect(0, 0, n, n);
});

// ---------- materials, made once ----------
const mats = {};
const M = (key, make) => mats[key] || (mats[key] = make());
const std = (o) => new THREE.MeshStandardMaterial(o);
const MAT = {
	wood: () => M('wood', () => std({ map: wood(), roughness: 0.62, metalness: 0 })),
	darkWood: () => M('darkWood', () => std({ map: wood(), color: 0x6a5040, roughness: 0.55 })),
	leather: () => M('leather', () => std({ map: leather(), roughness: 0.8 })),
	steel: () => M('steel', () => std({ map: brushed(), color: 0xa4abb2, roughness: 0.36, metalness: 0.6 })),
	dark: () => M('dark', () => std({ map: brushed(), color: 0x4a5058, roughness: 0.42, metalness: 0.5 })),
	cloth: () => M('cloth', () => std({ map: canvasCloth(), roughness: 0.9 })),
	white: () => M('white', () => std({ color: 0xf1efe8, roughness: 0.7 })),
	rubber: () => M('rubber', () => std({ color: 0x1d1f22, roughness: 0.9 })),
	glass: () => M('glass', () => std({ color: 0xfff3d6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false })),
	string: () => M('string', () => std({ color: 0xece4cf, roughness: 0.9 })),
	net: () => M('net', () => std({ map: mesh(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })),
	paint: (hex) => M('paint' + hex, () => std({ color: hex, roughness: 0.42, metalness: 0.1 })),
	glow: (hex, k) => M(`glow${hex}:${k}`, () => std({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.3 })),
};
// the trim metal, by tier and how polished the level makes it
const TRIM = [0x5f666e, 0xb07a45, 0xc9d6e6, 0xe2b84c, 0xf4c35a];
function trim(t, l) {
	const band = l >= 7 ? 2 : l >= 4 ? 1 : 0;
	return M(`trim${t}:${band}`, () => std({ map: brushed(), color: TRIM[t], metalness: 0.62 + band * 0.1, roughness: 0.46 - band * 0.14 - t * 0.04, emissive: t === 4 ? 0x6b3a00 : 0x000000, emissiveIntensity: t === 4 ? 0.35 : 0 }));
}
const tierHex = (t) => new THREE.Color(TIERS[t].color).getHex();
// the glowing core: from level 7, brighter with tier
const core = (t, l, base = null) => MAT.glow(base ?? tierHex(t), l >= 7 ? 1.2 + t * 0.5 : 0.25 + t * 0.12);

// ---------- shapes ----------
const P = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));
function lathe(pts, mat, seg) { const g = new THREE.LatheGeometry(P(pts), seg); g.computeVertexNormals(); return new THREE.Mesh(g, mat); }
function rounded(w, h, r) {
	const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
	s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
	return s;
}
function extrude(shape, depth, mat, bevel = 0.006, seg = 3) {
	const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: seg * 3 });
	g.translate(0, 0, -depth / 2); g.computeVertexNormals();
	return new THREE.Mesh(g, mat);
}
const cyl = (r1, r2, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
const ring = (r, tube, mat, seg, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, Math.max(5, seg >> 1), seg * 2, arc), mat);
const ball = (r, mat, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1)), mat);
const at = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

// ---------- the items ----------
function lantern(o, alarm) {
	const { t, l, seg, hi } = o, g = new THREE.Group(), tm = trim(t, l);
	// hangs from its bail: everything below the grip
	g.add(at(ring(0.045, 0.004, tm, seg, Math.PI), 0, -0.035, 0));
	g.add(lathe([[0, -0.06], [0.03, -0.062], [0.05, -0.07], [0.056, -0.082], [0.02, -0.086], [0, -0.087]], tm, seg));
	g.add(lathe([[0.001, -0.088], [0.042, -0.094], [0.052, -0.13], [0.05, -0.17], [0.04, -0.2], [0.001, -0.206]], MAT.glass(), seg));
	g.add(at(ball(0.012, core(t, l, alarm ? 0xff7a3a : 0xffc56a), Math.max(6, seg >> 1)), 0, -0.15, 0));
	g.add(at(cyl(0.003, 0.003, 0.05, MAT.dark(), 6), 0, -0.125, 0));
	const bars = hi ? 6 : 3;
	for (let k = 0; k < bars; k++) { const a = k / bars * Math.PI * 2; g.add(at(cyl(0.0035, 0.0035, 0.13, tm, 6), Math.cos(a) * 0.058, -0.148, Math.sin(a) * 0.058)); }
	g.add(at(ring(0.058, 0.004, tm, seg), 0, -0.118, 0, Math.PI / 2), at(ring(0.056, 0.004, tm, seg), 0, -0.19, 0, Math.PI / 2));
	g.add(lathe([[0.001, -0.205], [0.06, -0.207], [0.066, -0.218], [0.06, -0.226], [0.001, -0.228]], alarm ? MAT.paint(0x8e2a24) : MAT.dark(), seg));
	if (alarm) g.add(lathe([[0.001, -0.045], [0.012, -0.046], [0.02, -0.052], [0.026, -0.064], [0.027, -0.068], [0.001, -0.068]], trim(Math.max(t, 1), l), seg));
	if (l >= 4) g.add(at(ring(0.06, 0.003, core(t, l), seg), 0, -0.21, 0, Math.PI / 2));
	return g;
}
function medkit(o) {
	const { t, l, seg, hi } = o, g = new THREE.Group(), tm = trim(t, l);
	g.add(at(extrude(rounded(0.24, 0.16, 0.03), 0.07, MAT.cloth(), 0.01), 0, -0.12, 0));
	// the cross on its face, a zip seam round it, latches and a handle
	const cross = new THREE.Shape(); const a = 0.016, b = 0.048;
	cross.moveTo(-a, -b); cross.lineTo(a, -b); cross.lineTo(a, -a); cross.lineTo(b, -a); cross.lineTo(b, a); cross.lineTo(a, a); cross.lineTo(a, b); cross.lineTo(-a, b); cross.lineTo(-a, a); cross.lineTo(-b, a); cross.lineTo(-b, -a); cross.lineTo(-a, -a); cross.lineTo(-a, -b);
	g.add(at(extrude(cross, 0.004, MAT.white(), 0.002, 1), 0, -0.12, 0.047));
	g.add(at(cyl(0.004, 0.004, 0.25, tm, 6), 0, -0.04, 0, 0, 0, Math.PI / 2));
	for (const x of [-0.08, 0.08]) { g.add(at(extrude(rounded(0.03, 0.022, 0.006), 0.012, tm, 0.002, 2), x, -0.045, 0.04)); if (hi) g.add(at(cyl(0.003, 0.003, 0.014, MAT.dark(), 6), x, -0.045, 0.048, Math.PI / 2)); }
	g.add(at(ring(0.04, 0.007, MAT.leather(), seg, Math.PI), 0, -0.035, 0));
	for (const x of [-0.04, 0.04]) g.add(at(extrude(rounded(0.016, 0.02, 0.004), 0.012, tm, 0.002, 1), x, -0.038, 0));
	if (l >= 4) g.add(at(extrude(rounded(0.2, 0.008, 0.003), 0.004, core(t, l), 0, 1), 0, -0.19, 0.046));
	return g;
}
function toolRoll(o) {
	const { t, l, seg, hi } = o, g = new THREE.Group(), tm = trim(t, l);
	// a canvas roll lying across the hand, tools standing out of its open end, a strap and buckle
	const roll = at(lathe([[0.001, -0.15], [0.05, -0.15], [0.055, -0.14], [0.055, 0.12], [0.05, 0.13], [0.001, 0.13]], MAT.cloth(), seg), 0, -0.07, 0, 0, 0, Math.PI / 2);
	g.add(roll);
	for (const x of [-0.08, 0.06]) g.add(at(ring(0.057, 0.006, MAT.leather(), seg), x, -0.07, 0, 0, Math.PI / 2));
	g.add(at(extrude(rounded(0.022, 0.02, 0.004), 0.008, tm, 0.002, 1), 0.06, -0.07, 0.06));
	const tools = hi ? 4 : 2;
	for (let k = 0; k < tools; k++) {
		const y = -0.07 + (k - (tools - 1) / 2) * 0.025, handle = k % 2 ? MAT.darkWood() : MAT.wood();
		g.add(at(cyl(0.008, 0.009, 0.06, handle, Math.max(6, seg >> 1)), 0.165, y, 0.01 * (k % 2), 0, 0, Math.PI / 2));
		g.add(at(cyl(0.0035, 0.004, 0.035, tm, 6), 0.21, y, 0.01 * (k % 2), 0, 0, Math.PI / 2));
	}
	if (l >= 4) g.add(at(ring(0.056, 0.003, core(t, l), seg), -0.13, -0.07, 0, 0, Math.PI / 2));
	return g;
}
// a recurve bow, held at its grip, limbs up and down
function bow(o) {
	const { t, l, seg, hi } = o, g = new THREE.Group(), tm = trim(t, l);
	const pts = [[0, 0.62, -0.04], [0, 0.52, 0.02], [0, 0.34, 0.05], [0, 0.12, 0.03], [0, 0, 0]];
	for (const sy of [1, -1]) {
		const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y * sy, z)));
		const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, hi ? 28 : 12, 0.012, Math.max(5, seg >> 1)), MAT.wood());
		limb.scale.set(1.6, 1, 1);
		g.add(limb, at(ball(0.011, tm, 8), 0, 0.62 * sy, -0.04));
	}
	g.add(at(cyl(0.022, 0.022, 0.14, MAT.leather(), seg), 0, 0, 0.002));
	for (const y of [-0.075, 0.075]) g.add(at(cyl(0.024, 0.024, 0.01, tm, seg), 0, y, 0.002));
	g.add(at(cyl(0.0018, 0.0018, 1.24, MAT.string(), 4), 0, 0, -0.045));
	if (l >= 4) for (const y of [-0.3, 0.3]) g.add(at(ball(0.008, core(t, l), 6), 0.02, y, 0.04));
	return g;
}
// a stylised trail rifle (or the guard carbine): a shaped stock, a smooth body, a banded tube,
// a sling; carried upright by its grip
function rifle(o, look) {
	const { t, l, seg, hi } = o, g = new THREE.Group(), tm = trim(t, l);
	const s = new THREE.Shape();
	// the stock and grip in profile (x along the item, y up), the grip at the origin
	s.moveTo(-0.05, -0.02); s.quadraticCurveTo(-0.03, -0.1, -0.02, -0.12); s.lineTo(0.03, -0.12); s.quadraticCurveTo(0.02, -0.06, 0.04, -0.02);
	s.lineTo(0.06, 0.0); s.lineTo(0.06, 0.04); s.lineTo(-0.12, 0.04); s.quadraticCurveTo(-0.3, 0.03, -0.36, 0.05); s.lineTo(-0.37, -0.06); s.quadraticCurveTo(-0.24, -0.06, -0.05, -0.02);
	const stock = extrude(s, 0.03, look.stock(), 0.006, hi ? 3 : 1);
	const body = at(extrude(rounded(0.24, 0.05, 0.018), 0.036, look.body(), 0.004, hi ? 2 : 1), 0.17, 0.035, 0);
	const tube = at(lathe([[0.001, 0], [0.016, 0], [0.016, 0.02], [0.013, 0.03], [0.013, look.len], [0.016, look.len + 0.01], [0.016, look.len + 0.03], [0.001, look.len + 0.03]], MAT.dark(), seg), 0.28, 0.04, 0, 0, 0, -Math.PI / 2);
	g.add(stock, body, tube);
	for (const x of [0.33, 0.33 + look.len * 0.55]) g.add(at(ring(0.016, 0.004, tm, seg), x, 0.04, 0, 0, Math.PI / 2));
	g.add(at(cyl(0.011, 0.011, 0.07, MAT.dark(), seg), 0.15, 0.078, 0, 0, 0, Math.PI / 2));
	if (hi) for (const x of [0.12, 0.18]) g.add(at(cyl(0.006, 0.006, 0.014, tm, 8), x, 0.064, 0));
	g.add(at(extrude(rounded(0.1, 0.012, 0.005), 0.038, tm, 0.002, 1), 0.17, 0.005, 0));
	// the glowing core: a stylised crystal in the body
	g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), core(t, l, look.core)), 0.21, 0.035, 0.021));
	const sling = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, 0.0, 0.02), new THREE.Vector3(-0.05, -0.13, 0.025), new THREE.Vector3(0.3, -0.06, 0.02), new THREE.Vector3(0.45, 0.02, 0.02)]);
	g.add(new THREE.Mesh(new THREE.TubeGeometry(sling, hi ? 20 : 8, 0.006, 4), MAT.leather()));
	if (l >= 4) g.add(at(extrude(rounded(0.2, 0.006, 0.002), 0.031, core(t, l), 0, 1), -0.2, 0.02, 0));
	// upright, the tube up and a little forward
	g.rotation.z = Math.PI / 2 - 0.12;
	const w = new THREE.Group(); w.add(g); return w;
}
const RIFLES = {
	'aurora-trail-rifle': { stock: MAT.wood, body: MAT.steel, len: 0.42, core: 0x38d6b0 },
	'mossback-scout-rifle': { stock: MAT.darkWood, body: () => MAT.paint(0x56613c), len: 0.34, core: 0xa6e07a },
	'warden-spark-carbine': { stock: () => MAT.paint(0x2f3a48), body: MAT.dark, len: 0.24, core: 0xffb347 },
};
function net(o) {
	const { t, l, seg } = o, g = new THREE.Group(), tm = trim(t, l);
	g.add(lathe([[0.001, -0.05], [0.014, -0.05], [0.016, -0.03], [0.014, 0.38], [0.01, 0.4], [0.001, 0.4]], MAT.wood(), Math.max(6, seg >> 1)));
	g.add(at(cyl(0.018, 0.018, 0.12, MAT.leather(), seg), 0, 0.02, 0));
	g.add(at(ring(0.17, 0.007, tm, seg), 0, 0.57, 0, Math.PI / 2 - 0.25));
	const bag = lathe([[0.17, 0], [0.15, -0.06], [0.1, -0.12], [0.03, -0.15], [0.001, -0.155]], MAT.net(), seg);
	g.add(at(bag, 0, 0.57, 0, -0.25));
	if (l >= 4) g.add(at(ring(0.02, 0.004, core(t, l), seg), 0, 0.4, 0, Math.PI / 2));
	return g;
}
function scentKit(o) {
	const { t, l, seg } = o, g = new THREE.Group(), tm = trim(t, l);
	const pouch = lathe([[0.001, -0.17], [0.04, -0.165], [0.055, -0.13], [0.05, -0.07], [0.035, -0.04], [0.03, -0.03], [0.001, -0.03]], MAT.leather(), seg);
	pouch.scale.set(1, 1, 0.7);
	g.add(pouch, at(ring(0.031, 0.004, MAT.string(), seg), 0, -0.045, 0, Math.PI / 2));
	g.add(at(cyl(0.004, 0.004, 0.03, MAT.string(), 4), 0, -0.02, 0));
	g.add(at(cyl(0.013, 0.013, 0.05, MAT.glass(), seg), 0.06, -0.08, 0), at(cyl(0.011, 0.011, 0.03, core(t, l, 0x9be06a), Math.max(6, seg >> 1)), 0.06, -0.09, 0), at(cyl(0.014, 0.014, 0.012, tm, seg), 0.06, -0.05, 0));
	return g;
}
function brace(o) {
	const { t, l, seg, hi } = o, g = new THREE.Group(), tm = trim(t, l);
	g.add(at(extrude(rounded(0.07, 0.8, 0.012), 0.032, MAT.wood(), 0.005, hi ? 2 : 1), 0, 0.05, 0));
	g.add(at(extrude(rounded(0.085, 0.07, 0.01), 0.045, tm, 0.003, 1), 0, 0.44, 0), at(extrude(rounded(0.085, 0.06, 0.01), 0.045, tm, 0.003, 1), 0, -0.34, 0));
	g.add(at(lathe([[0.001, 0], [0.012, 0], [0.012, 0.06], [0.02, 0.065], [0.02, 0.075], [0.001, 0.075]], MAT.steel(), seg), 0, -0.44, 0, Math.PI));
	g.add(at(cyl(0.03, 0.034, 0.02, MAT.rubber(), seg), 0, -0.52, 0));
	g.add(at(cyl(0.039, 0.039, 0.1, MAT.leather(), seg), 0, 0, 0));
	if (l >= 4) g.add(at(extrude(rounded(0.012, 0.5, 0.004), 0.034, core(t, l), 0, 1), 0.03, 0.05, 0));
	return g;
}
function flare(o) {
	const { t, l, seg } = o, g = new THREE.Group(), tm = trim(t, l);
	g.add(lathe([[0.001, -0.08], [0.02, -0.08], [0.022, -0.075], [0.022, 0.1], [0.02, 0.105], [0.001, 0.105]], MAT.paint(0xc8372a), seg));
	g.add(at(cyl(0.0225, 0.0225, 0.04, MAT.white(), seg), 0, 0.02, 0));
	g.add(at(lathe([[0.001, 0.1], [0.024, 0.1], [0.024, 0.13], [0.018, 0.14], [0.001, 0.142]], tm, seg), 0, 0, 0));
	g.add(at(ball(0.012, core(t, l, 0xffa64d), Math.max(6, seg >> 1)), 0, 0.145, 0));
	g.add(at(cyl(0.026, 0.026, 0.01, tm, seg), 0, -0.06, 0));
	return g;
}
const BUILD = {
	'camp-lantern': (o) => lantern(o, false), 'lantern-alarm': (o) => lantern(o, true), 'field-medkit': medkit, 'repair-roll': toolRoll,
	'reedline-hunting-bow': bow, 'hunting-net': net, 'trail-scent-kit': scentKit, 'door-brace': brace, 'station-signal-flare': flare,
	'aurora-trail-rifle': (o) => rifle(o, RIFLES['aurora-trail-rifle']), 'mossback-scout-rifle': (o) => rifle(o, RIFLES['mossback-scout-rifle']), 'warden-spark-carbine': (o) => rifle(o, RIFLES['warden-spark-carbine']),
};
// how each sits in the hand (third person: below the wrist, tilted) and in view (first person)
const LONG = new Set(['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine', 'reedline-hunting-bow', 'hunting-net', 'door-brace']);
const FIT = { drop: 0.07, long: { tilt: 0.35 }, hang: { tilt: 0 } };
const VIEW = { long: [0.3, -0.34, -0.66, 0.2, -0.45, 0.7, 0.5], hang: [0.25, -0.2, -0.5, 0.1, -0.5, 0.05, 1] };

// Legendary: a few motes of light drifting round the item
function motes(t, n = 14) {
	const pos = new Float32Array(n * 3), r = rnd(5);
	for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2, y = (r() - 0.5) * 0.3, d = 0.06 + r() * 0.08; pos.set([Math.cos(a) * d, y, Math.sin(a) * d], k * 3); }
	const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	const m = M('motes' + t, () => new THREE.PointsMaterial({ map: mote(), color: TIERS[t].color, size: 0.03, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
	const p = new THREE.Points(g, m); p.name = 'motes';
	return p;
}

const cache = new Map();
// a fresh copy (sharing geometry and materials) of an item at a level and tier, or null
export function itemModel(id, { level = 1, tier = 0, lod = 'high' } = {}) {
	const make = BUILD[id];
	if (!make) return null;
	const t = Math.max(0, Math.min(4, tier | 0)), l = Math.max(1, Math.min(10, level | 0)), band = l >= 7 ? 2 : l >= 4 ? 1 : 0;
	const key = `${id}:${t}:${band}:${lod}`;
	if (!cache.has(key)) {
		const hi = lod !== 'low', g = make({ t, l: band === 2 ? 7 : band === 1 ? 4 : 1, seg: hi ? 14 : 7, hi });
		if (t === 4 && hi) g.add(motes(t));
		g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
		cache.set(key, g);
	}
	const m = cache.get(key).clone();
	m.name = 'held:' + id;
	m.userData = { id, long: LONG.has(id), tier: t, level: l };
	return m;
}
// triangles in a model, for budgets
export function triangles(o) { let n = 0; o.traverse((x) => { if (x.isMesh) n += (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3; }); return Math.round(n); }

const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
// what one body holds: at its right hand, the hand closed round it. lod: 'high' or 'low'
export function createHand(scene, { lod = 'high' } = {}) {
	let key = '', model = null, gripped = null;
	function set(id, level = 1, tier = 0) {
		const k = id ? `${id}:${level}:${tier}` : '';
		if (k === key) return;
		if (model) model.parent?.remove(model);
		key = k; model = id ? itemModel(id, { level, tier, lod }) : null;
		if (model) scene.add(model);
		if (!model && gripped) { gripped.grip?.('R', 0); gripped = null; }
	}
	const spin = (time) => { const m = model?.getObjectByName('motes'); if (m) { m.rotation.y = time * 0.8; m.position.y = Math.sin(time * 1.3) * 0.02; } };
	// P: a people/body.js person, M its motion (people/motion.js), heading: which way it faces
	function follow(P, heading, visible = true, Mo = null, time = 0) {
		if (Mo && Mo !== gripped) { gripped?.grip?.('R', 0); gripped = Mo; }
		gripped?.grip?.('R', model && visible ? 1 : 0);
		if (!model) return;
		if (model.parent !== scene) scene.add(model);
		const i = P?.map?.['wrist.R'];
		model.visible = visible && i != null && P.root.visible;
		if (!model.visible) return;
		P.bones[i].getWorldPosition(tmp);
		model.position.copy(tmp).addScaledVector(up, -FIT.drop);
		const f = model.userData.long ? FIT.long : FIT.hang;
		model.rotation.set(f.tilt, heading, 0, 'YXZ');
		model.scale.setScalar(1);
		spin(time);
	}
	// in first person: low on the right of the view
	function view(camera, visible = true, time = 0) {
		if (gripped) { gripped.grip?.('R', 0); gripped = null; }
		if (!model) return;
		if (model.parent !== scene) scene.add(model);
		model.visible = visible;
		if (!visible) return;
		const [x, y, z, rx, ry, rz, s] = model.userData.long ? VIEW.long : VIEW.hang;
		model.position.set(x, y + Math.sin(time * 1.7) * 0.004, z).applyQuaternion(camera.quaternion).add(camera.position);
		model.quaternion.copy(camera.quaternion);
		model.rotateY(ry); model.rotateX(rx); model.rotateZ(rz);
		model.scale.setScalar(s);
		spin(time);
	}
	function dispose() { set(null); }
	return { set, follow, view, dispose, get model() { return model; } };
}
