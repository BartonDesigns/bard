// Faith, the old white fishing boat: the village's boat on the island, and the very same
// boat hauled up on the gravel at the Bay Area Discovery Museum for children to climb.
// Built like one: a hull lofted through stations from a broad transom to a raked bow, a V
// bottom that flattens aft, the sheer sweeping up to a high bow and stepping down aft of the
// deckhouse; a dark boot stripe, round portholes, her name in black on the bow, a red anchor
// on the stem head. A raised foredeck and a low aft deck; the deckhouse with dark-framed
// windows and doors; on its roof the flying bridge behind a curved white screen with the life
// ring on it. Tall steel-pipe railings hung with dark wire netting all round, so nobody falls
// off; a ladder up from the aft deck; two masts dressed overall with signal-flag bunting.
// Bow toward -z, the stern at +z (as boat.js sails it), the waterline at y = 0. About 10 m.
//
// buildFaith({ glass, beached }): afloat she has red antifouling below the stripe; beached
// (the museum's) she is white to the gravel, with a gangway up her side and pilings beside
// it. Either way userData.walk has her floors and walls, in her own frame, for walking aboard.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const L0 = -5.5, L1 = 4.4;                 // stem head, transom
const NS = 44, NC = 12;                     // stations along, points round each half-section
const RAKE = 1.5;                           // how far the forefoot sits aft of the stem head
const T_STEP = 0.71;                        // where the sheer and the deck step down aft
const DF = 1.3, DA = 0.8, UP = 3.4;         // foredeck, aft deck, flying bridge
const CAB = { x: 1.2, z0: -1.9, z1: 1.5, top: 3.3 };
const GROUND = -0.6;                        // beached: the gravel, in her frame
const zAt = (t) => L0 + (L1 - L0) * t;
const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// the hull at station t (0 bow .. 1 stern): half-beam at the sheer and chine, keel depth,
// sheer height, deadrise
function station(t) {
	const bowK = Math.pow(Math.min(1, t / 0.5), 0.55);                                 // the fine entry
	const beam = 1.85 * bowK * (1 - Math.pow(Math.max(0, t - 0.8) / 0.2, 2) * 0.1);
	const chine = beam * (0.72 + 0.12 * t);
	const keel = -0.85 + 0.4 * Math.pow(1 - t, 2.5);                                  // the forefoot rises
	const sheer = 1.55 + 0.95 * Math.pow(1 - t, 2.4) - 0.4 * smooth(T_STEP, T_STEP + 0.04, t);
	const dead = 0.38 * (1 - t) + 0.12;
	return { beam, chine, keel, sheer, dead, z: zAt(t) };
}
const rake = (t, h) => RAKE * Math.pow(1 - Math.max(0, Math.min(1, h)), 1.4) * Math.pow(Math.max(0, 1 - t / 0.4), 1.5);
// a half-section's points [x, y, z] from the keel up to the sheer (x >= 0), with extra points
// either side of the boot stripe's edges so the paint lines come out crisp
const CUTS = [-0.05, -0.04, 0.17, 0.18];
function section(t) {
	const S = station(t), raw = [], pts = [];
	for (let i = 0; i <= NC; i++) {
		const u = i / NC;
		let x, y;
		if (u < 0.4) { x = S.chine * u / 0.4; y = S.keel + S.dead * x; }
		else { const k = (u - 0.4) / 0.6, e = Math.sin(k * Math.PI / 2), y0 = S.keel + S.dead * S.chine; x = S.chine + (S.beam - S.chine) * e; y = y0 + (S.sheer - y0) * k; }
		raw.push([x, y]);
	}
	for (let i = 0; i < raw.length; i++) {
		pts.push(raw[i]);
		if (i + 1 < raw.length) for (const c of CUTS) if (raw[i][1] < c && raw[i + 1][1] >= c) { const k = (c - raw[i][1]) / (raw[i + 1][1] - raw[i][1]); pts.push([raw[i][0] + (raw[i + 1][0] - raw[i][0]) * k, c]); }
	}
	for (const p of pts) p.push(S.z + rake(t, (p[1] - S.keel) / (S.sheer - S.keel)));
	return { pts, S };
}
// a point on the starboard topsides at station t and height y: [x, z]
function hullAt(t, y) {
	const { pts } = section(t);
	if (y <= pts[0][1]) return [pts[0][0], pts[0][2]];
	for (let i = 1; i < pts.length; i++) if (pts[i][1] >= y) { const a = pts[i - 1], b = pts[i], k = (y - a[1]) / Math.max(1e-6, b[1] - a[1]); return [a[0] + (b[0] - a[0]) * k, a[2] + (b[2] - a[2]) * k]; }
	const p = pts[pts.length - 1];
	return [p[0], p[2]];
}
// the outward normal of the starboard topsides there
function hullNormal(t, y) {
	const [xa, za] = hullAt(t - 0.01, y), [xb, zb] = hullAt(t + 0.01, y), [xc, zc] = hullAt(t, y - 0.05), [xd, zd] = hullAt(t, y + 0.05);
	const along = new THREE.Vector3(xb - xa, 0, zb - za), up = new THREE.Vector3(xd - xc, 0.1, zd - zc), n = new THREE.Vector3().crossVectors(up, along).normalize();
	return n.x < 0 ? n.negate() : n;
}

// the shared look: one vertex-painted material for nearly all of her, the netting, the
// lettering, the bunting's lines (made once, both boats use them)
let shared = null;
function looks() {
	if (shared) return shared;
	const net = document.createElement('canvas'); net.width = net.height = 64;
	{
		const g = net.getContext('2d');
		g.strokeStyle = 'rgba(38,42,46,1)'; g.lineWidth = 6; g.lineCap = 'round';
		g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
		g.beginPath(); g.moveTo(-32, 0); g.lineTo(0, 32); g.lineTo(-32, 64); g.moveTo(96, 0); g.lineTo(64, 32); g.lineTo(96, 64); g.stroke();
	}
	const netTex = new THREE.CanvasTexture(net); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.anisotropy = 4; netTex.colorSpace = THREE.SRGBColorSpace;
	// her name: the bow's on the top half, the transom's (with her port) below
	const nc = document.createElement('canvas'); nc.width = 512; nc.height = 256;
	{
		const g = nc.getContext('2d');
		g.fillStyle = '#16181a'; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.font = 'bold 88px Georgia, "Times New Roman", serif'; g.fillText('FAITH', 256, 68);
		g.font = 'bold 72px Georgia, "Times New Roman", serif'; g.fillText('FAITH', 256, 160);
		g.font = 'bold 34px Georgia, "Times New Roman", serif'; g.fillText('SAUSALITO', 256, 222);
	}
	const nameTex = new THREE.CanvasTexture(nc); nameTex.colorSpace = THREE.SRGBColorSpace; nameTex.anisotropy = 4;
	shared = {
		paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }),
		net: new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.04, depthWrite: false, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.3 }),
		netDepth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: netTex, alphaTest: 0.5 }),
		name: new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, alphaTest: 0.3, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
		line: new THREE.LineBasicMaterial({ color: 0x3a3a3a }),
	};
	return shared;
}

// signal-flag colours
const FLAG = [0xd42a20, 0xf2c200, 0x1f4fbf, 0xf4f4f0, 0x16181a, 0x2f9a48].map((c) => new THREE.Color(c));

export function buildFaith({ glass, beached = false } = {}) {
	const M = looks(), boat = new THREE.Group();
	const paint = [], glassG = [], netG = [], nameG = [], lineP = [];
	const v3 = (x, y, z) => new THREE.Vector3(x, y, z), q = new THREE.Quaternion(), Y = v3(0, 1, 0);
	const C = {
		white: 0xf3f1ea, house: 0xdedcd5, stripe: 0x1e2226, bottom: beached ? 0xf0eee6 : 0x8a2a20, cap: 0x2c2e30, deck: 0xb5b2a8,
		frame: 0x2a2e33, pipe: 0x8d9397, red: 0xc8261c, wood: 0x8a6a48, piling: 0x6e5a44, door: 0x2d3d4f,
	};
	// put a piece in the painted mesh, coloured flat or by a function of its position
	const col = new THREE.Color();
	function put(geo, c) {
		const g = geo.index ? geo.toNonIndexed() : geo;
		g.deleteAttribute('uv');
		if (!g.attributes.normal) g.computeVertexNormals();
		const p = g.attributes.position, a = new Float32Array(p.count * 3);
		if (typeof c !== 'function') col.set(c);
		for (let i = 0; i < p.count; i++) { if (typeof c === 'function') col.set(c(p.getX(i), p.getY(i), p.getZ(i))); a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
		g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
		paint.push(g);
	}
	const box = (w, h, d, x, y, z, c) => put(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
	const pipe = (a, b, r, c, seg = 6) => {
		const d = b.clone().sub(a), len = d.length();
		if (len < 1e-4) return;
		const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
		g.applyQuaternion(q.setFromUnitVectors(Y, d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
		put(g, c);
	};
	// a strip between two runs of points, as a plain array of triangles (u along, v up, in metres)
	function strip(bot, top, cell = 1) {
		const P = [], U = [];
		let s = 0;
		for (let i = 0; i + 1 < bot.length; i++) {
			const ds = bot[i].distanceTo(bot[i + 1]), h0 = bot[i].distanceTo(top[i]), h1 = bot[i + 1].distanceTo(top[i + 1]);
			const a = bot[i], b = bot[i + 1], c = top[i], d = top[i + 1];
			P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, c.x, c.y, c.z, b.x, b.y, b.z, d.x, d.y, d.z);
			U.push(s / cell, 0, (s + ds) / cell, 0, s / cell, h0 / cell, s / cell, h0 / cell, (s + ds) / cell, 0, (s + ds) / cell, h1 / cell);
			s += ds;
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
		g.computeVertexNormals();
		return g;
	}

	// ---- the hull shell, both sides, painted by height ----
	const hullCol = (x, y) => (y < -0.045 ? C.bottom : y < 0.175 ? C.stripe : C.white);
	for (const side of [1, -1]) {
		const P = [], I = [];
		let n = 0;
		for (let s = 0; s <= NS; s++) {
			const { pts } = section(s / NS);
			n = pts.length;
			for (const [x, y, z] of pts) P.push(x * side, y, z);
		}
		for (let s = 0; s < NS; s++) for (let i = 0; i + 1 < n; i++) {
			const a = s * n + i, b = a + 1, c = a + n, d = c + 1;
			if (side > 0) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
		put(g, hullCol);
	}
	// the transom, closed flat, the stripe across it
	{
		const { pts } = section(1), sh = new THREE.Shape();
		sh.moveTo(0, pts[0][1]);
		for (const [x, y] of pts) sh.lineTo(x, y);
		for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(-pts[i][0], pts[i][1]);
		put(new THREE.ShapeGeometry(sh).translate(0, 0, L1), (x, y) => (y < -0.045 ? C.bottom : C.white));
		const w = hullAt(1, 0.07)[0] * 2;
		box(w, 0.22, 0.03, 0, 0.07, L1 + 0.01, C.stripe);
	}
	// the cap rail along the sheer, dark, both sides and round the transom
	for (const side of [1, -1]) {
		let prev = null;
		for (let s = 0; s <= NS; s++) { const p = section(s / NS).pts.at(-1), v = v3(p[0] * side, p[1] + 0.03, p[2]); if (prev) pipe(prev, v, 0.06, C.cap); prev = v; }
	}
	{ const x = station(1).beam, y = station(1).sheer + 0.03; pipe(v3(-x, y, L1), v3(x, y, L1), 0.06, C.cap); }

	// ---- the decks: the raised foredeck (the deckhouse stands on it), the low aft deck ----
	const deckEdge = (t, y) => { const [x, z] = hullAt(t, y); return [Math.max(0, x - 0.05), z]; };
	function deck(t0, t1, y, n) {
		const P = [];
		for (let k = 0; k < n; k++) {
			const [xa, za] = deckEdge(t0 + (t1 - t0) * k / n, y), [xb, zb] = deckEdge(t0 + (t1 - t0) * (k + 1) / n, y);
			P.push(-xa, y, za, xa, y, za, -xb, y, zb, -xb, y, zb, xa, y, za, xb, y, zb);
		}
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
		put(g, C.deck);
	}
	deck(0, T_STEP, DF, 30);
	deck(T_STEP, 1, DA, 12);
	{ const [x, z] = deckEdge(T_STEP, DF); box(x * 2, DF - DA, 0.05, 0, (DF + DA) / 2, z, C.house); }

	// ---- the portholes, the name on the bow, the name on the transom ----
	for (const side of [1, -1]) for (const [t, y] of [[0.27, 1.12], [0.33, 1.06], [0.47, 0.92], [0.55, 0.9], [0.63, 0.88], [0.82, 0.55], [0.9, 0.55]]) {
		const [x, z] = hullAt(t, y), n = hullNormal(t, y); n.x *= side;
		const o = v3(x * side, y, z).addScaledVector(n, 0.012);
		q.setFromUnitVectors(v3(0, 0, 1), n);
		put(new THREE.CircleGeometry(0.115, 14).applyQuaternion(q).translate(o.x, o.y, o.z), 0x15191d);
		put(new THREE.RingGeometry(0.115, 0.15, 14).applyQuaternion(q).translate(o.x + n.x * 0.006, o.y, o.z + n.z * 0.006), 0x6b7075);
	}
	{
		const yc = station(0.19).sheer - 0.5, h = 0.34, nt = 10;
		for (const side of [1, -1]) {
			const P = [], U = [];
			for (let k = 0; k < nt; k++) {
				// read aft to fore on starboard, fore to aft on port: left to right from outside
				const t0 = 0.13 + 0.12 * k / nt, t1 = 0.13 + 0.12 * (k + 1) / nt;
				const u0 = side > 0 ? 1 - k / nt : k / nt, u1 = side > 0 ? 1 - (k + 1) / nt : (k + 1) / nt;
				const c = [[t0, yc - h / 2, u0, 0.5], [t1, yc - h / 2, u1, 0.5], [t0, yc + h / 2, u0, 1], [t1, yc + h / 2, u1, 1]].map(([t, y, u, v]) => { const [x, z] = hullAt(t, y); return [(x + 0.02) * side, y, z, u, v]; });
				for (const i of side > 0 ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 2, 1, 3]) { P.push(c[i][0], c[i][1], c[i][2]); U.push(c[i][3], c[i][4]); }
			}
			const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
			nameG.push(g);
		}
		const tg = new THREE.PlaneGeometry(1.6, 0.8), uv = tg.attributes.uv;
		for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5);
		nameG.push(tg.translate(0, 0.7, L1 + 0.025).toNonIndexed());
	}

	// ---- the deckhouse ----
	const { x: CX, z0: CZ0, z1: CZ1, top: CT } = CAB, CH = CT - DF, cw = 0.08;
	box(CX * 2, CH, cw, 0, DF + CH / 2, CZ0, C.house);                                      // front
	for (const sx of [-1, 1]) box(cw, CH, CZ1 - CZ0, sx * CX, DF + CH / 2, (CZ0 + CZ1) / 2, C.house);
	// the aft wall, with the door open onto the aft deck
	box(CX + 0.2, CH, cw, (-CX + 0.2) / 2, DF + CH / 2, CZ1, C.house);
	box(CX - 0.95, CH, cw, (CX + 0.95) / 2, DF + CH / 2, CZ1, C.house);
	box(0.75, CH - 1.95, cw, 0.575, DF + 1.95 + (CH - 1.95) / 2, CZ1, C.house);
	// a window in a dark frame: glass set just proud of the wall, frame bars round it
	function windowAt(cx, cy, cz, w, h, nx, nz) {
		const g = new THREE.PlaneGeometry(w, h); g.rotateY(Math.atan2(nx, nz)); g.translate(cx + nx * 0.045, cy, cz + nz * 0.045);
		glassG.push(g.toNonIndexed());
		const fx = Math.abs(nz) > 0.5 ? 1 : 0, fz = 1 - fx, t = 0.06, o = 0.06;
		box(fx * (w + t) + fz * 0.03, t, fz * (w + t) + fx * 0.03, cx + nx * o, cy + h / 2, cz + nz * o, C.frame);
		box(fx * (w + t) + fz * 0.03, t, fz * (w + t) + fx * 0.03, cx + nx * o, cy - h / 2, cz + nz * o, C.frame);
		for (const e of [-1, 1]) box(fx * t + fz * 0.03, h, fz * t + fx * 0.03, cx + nx * o + fx * e * w / 2, cy, cz + nz * o + fz * e * w / 2, C.frame);
	}
	const wy = DF + 1.3;
	for (const x of [-0.78, 0, 0.78]) windowAt(x, wy, CZ0, 0.66, 0.62, 0, -1);
	for (const z of [-1.45, -0.6, 0.25]) for (const sx of [-1, 1]) windowAt(sx * CX, wy, z, 0.72, 0.62, sx, 0);
	windowAt(-CX, wy, 1.0, 0.5, 0.62, -1, 0);
	// a door on the starboard side
	box(0.03, 1.85, 0.62, CX + 0.045, DF + 0.95, 1.05, C.door);
	windowAt(CX, DF + 1.45, 1.05, 0.34, 0.4, 1, 0);
	// the roof, a little overhang, the flying bridge on it
	box(CX * 2 + 0.24, 0.1, CZ1 - CZ0 + 0.2, 0, CT + 0.05, (CZ0 + CZ1) / 2, C.house);
	box(CX * 2 + 0.26, 0.04, CZ1 - CZ0 + 0.22, 0, CT, (CZ0 + CZ1) / 2, C.frame);
	box(0.7, 0.06, 0.45, -0.8, UP - 0.03, CZ1 + 0.22, C.house);                            // the ladder's head
	// the curved white screen at the bridge's front: bowed forward, sweeping down along the sides
	{
		const sx = CX + 0.1, n = 16, bot = [], top = [], zA = -0.25, zF = CZ0 - 0.05, run = [];
		const sweep = (s) => 0.32 + 0.88 * (0.5 - 0.5 * Math.cos(Math.PI * s));
		for (let k = 0; k <= n; k++) { const s = k / n; run.push([-sx, zA + (zF - zA) * s, sweep(s)]); }
		for (let k = 1; k < n; k++) { const x = -sx + 2 * sx * k / n; run.push([x, zF - 0.14 * (1 - (x / sx) ** 2), 1.2]); }
		for (let k = 0; k <= n; k++) { const s = k / n; run.push([sx, zF + (zA - zF) * s, sweep(1 - s)]); }
		for (const [x, z, h] of run) { bot.push(v3(x, UP, z)); top.push(v3(x, UP + h, z)); }
		put(strip(bot, top), C.white);
		for (let i = 0; i + 1 < top.length; i++) pipe(top[i], top[i + 1], 0.045, C.white);
		// the life ring on it, red and white in quarters
		const ring = new THREE.TorusGeometry(0.27, 0.07, 8, 24).translate(0, UP + 0.62, CZ0 - 0.27);
		put(ring, (x, y) => (Math.floor((Math.atan2(y - UP - 0.62, x) / Math.PI + 1) * 4 + 0.5) % 2 ? 0xf4f4f0 : 0xe2451e));
	}

	// ---- railings: steel pipe, posts every metre or so, dark netting hung between ----
	function rail(bot, h, { net = true, every = 1.15 } = {}) {
		const top = bot.map((p) => p.clone().setY(p.y + h));
		for (let i = 0; i + 1 < top.length; i++) pipe(top[i], top[i + 1], 0.035, C.pipe);
		let acc = every;
		for (let i = 0; i < bot.length; i++) {
			if (i > 0) acc += bot[i].distanceTo(bot[i - 1]);
			if (acc >= every || i === bot.length - 1) { pipe(bot[i], top[i], 0.03, C.pipe); acc = 0; }
		}
		if (net) netG.push(strip(bot, top.map((p) => p.clone().setY(p.y - 0.04)), 0.12));
	}
	const sheerAt = (t, side, inset = 0.05) => { const p = section(t).pts.at(-1); return v3((p[0] - inset) * side, p[1] + 0.06, p[2]); };
	// the foredeck: round the bow from one side of the deckhouse to the other
	{
		const run = [];
		for (let k = 0; k <= 18; k++) run.push(sheerAt(T_STEP - 0.02 - (T_STEP - 0.05) * k / 18, -1));
		for (let k = 0; k <= 18; k++) run.push(sheerAt(0.03 + (T_STEP - 0.05) * k / 18, 1));
		rail(run, 1.0);
	}
	// the aft deck: round the stern, a gap on starboard for the gangway when she is ashore
	{
		const run = [], tg = beached ? 0.86 : T_STEP + 0.06;
		for (let k = 0; k <= 8; k++) run.push(sheerAt(tg + (1 - tg) * k / 8, 1, 0.08));
		const b = station(1).beam - 0.08;
		for (let k = 1; k < 6; k++) run.push(v3(b - 2 * b * k / 6, station(1).sheer + 0.06, L1 - 0.05));
		for (let k = 0; k <= 8; k++) run.push(sheerAt(1 - (1 - T_STEP - 0.06) * k / 8, -1, 0.08));
		rail(run, 0.85);
	}
	// the flying bridge: aft of the screen, open at the ladder's head
	{
		const sx = CX + 0.08, zs = -0.3, ze = CZ1 + 0.06;
		rail([v3(-sx, UP, zs), v3(-sx, UP, ze)], 1.0);
		rail([v3(-0.42, UP, ze), v3(sx, UP, ze), v3(sx, UP, zs)], 1.0);
	}
	// the ladder up from the aft deck: two stringers, treads
	{
		const zTop = CZ1 + 0.42, zBot = zTop + 0.19 * 8;
		for (const x of [-1.12, -0.48]) { pipe(v3(x, DA, zBot), v3(x, UP, zTop), 0.04, C.pipe); pipe(v3(x, DA + 0.9, zBot), v3(x, UP + 0.9, zTop), 0.03, C.pipe); pipe(v3(x, DA, zBot), v3(x, DA + 0.9, zBot), 0.03, C.pipe); }
		for (let k = 1; k < 8; k++) box(0.62, 0.05, 0.2, -0.8, DA + 0.325 * k - 0.025, zTop + 0.19 * (7.5 - k), C.deck);
	}

	// ---- the anchor on the stem head, red ----
	{
		const sp = section(0).pts.at(-1), y0 = sp[1], z0 = sp[2];
		// the bow fitting: a plate along the stem head, a cheek either side
		const plate = new THREE.BoxGeometry(0.22, 0.1, 1.0).rotateX(-0.22).translate(0, y0 + 0.12, z0 + 0.2); put(plate, C.red);
		for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.03, 0.34, 0.7).rotateX(-0.22).translate(sx * 0.1, y0 + 0.28, z0 + 0.05), C.red);
		// the anchor: shank down the plate, the crown and flukes forward over the bow, the stock aft
		const a = v3(0, y0 + 0.62, z0 + 0.55), b = v3(0, y0 + 0.3, z0 - 0.42);
		pipe(a, b, 0.045, C.red, 8);
		const crown = new THREE.TorusGeometry(0.3, 0.045, 6, 12, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2).rotateX(-0.3).translate(b.x, b.y + 0.06, b.z + 0.02);
		put(crown, C.red);
		for (const e of [-1, 1]) put(new THREE.ConeGeometry(0.1, 0.26, 4).rotateX(e * 0.5).translate(0, b.y + 0.12, b.z + e * 0.3), C.red);
		pipe(v3(-0.32, a.y + 0.02, a.z), v3(0.32, a.y + 0.02, a.z), 0.035, C.red, 6);
	}

	// ---- the masts, a yard, the bunting ----
	const m1 = v3(0, UP, 0.9), m1top = v3(0, 10.2, 0.9), m2 = v3(0, DA, 3.85), m2top = v3(0, 7.6, 3.85);
	pipe(m1, m1top, 0.075, 0xe9e8e4, 10); pipe(m2, m2top, 0.065, 0xe9e8e4, 10);
	put(new THREE.SphereGeometry(0.1, 8, 6).translate(m1top.x, m1top.y, m1top.z), 0xe9e8e4);
	put(new THREE.SphereGeometry(0.09, 8, 6).translate(m2top.x, m2top.y, m2top.z), 0xe9e8e4);
	const yardY = 8.7;
	pipe(v3(-1.5, yardY, 0.9), v3(1.5, yardY, 0.9), 0.045, 0xe9e8e4, 8);
	put(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10).translate(0, 4.7, 0.9), 0xffffff);         // a masthead light
	let fi = 0;
	function bunting(a, b, sag = 0.05) {
		const n = Math.max(4, Math.round(a.distanceTo(b) / 0.55)), pts = [];
		for (let k = 0; k <= n; k++) { const s = k / n; pts.push(a.clone().lerp(b, s).add(v3(0, -sag * a.distanceTo(b) * 4 * s * (1 - s), 0))); }
		for (let k = 0; k < n; k++) lineP.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
		for (let k = 1; k < n; k++) {
			// a flag hanging under the line: two colours side by side, or a pennant
			const p = pts[k], dir = pts[k + 1].clone().sub(pts[k - 1]).setY(0).normalize(), w = 0.17, h = 0.36;
			const c1 = FLAG[fi % FLAG.length], c2 = FLAG[(fi * 3 + 2) % FLAG.length], pen = fi % 4 === 3;
			fi++;
			const L = p.clone().addScaledVector(dir, -w), R = p.clone().addScaledVector(dir, w), mid = p.clone();
			const Lb = L.clone().setY(L.y - h), Rb = R.clone().setY(R.y - h), Mb = mid.clone().setY(mid.y - h);
			const P = pen ? [L, R, mid.clone().setY(mid.y - h * 1.3)] : [L, mid, Lb, Lb, mid, Mb, mid, R, Mb, Mb, R, Rb];
			const g = new THREE.BufferGeometry().setFromPoints(P); g.computeVertexNormals();
			const cc = [], half = P.length / 2;
			P.forEach((v, i) => { const c = pen || i < half ? c1 : c2; cc.push(c.r, c.g, c.b); });
			g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
			paint.push(g);
		}
	}
	const stemHead = section(0).pts.at(-1);
	bunting(m1top, v3(0, stemHead[1] + 0.7, stemHead[2] + 0.5));
	bunting(m1top, m2top, 0.03);
	bunting(m2top, v3(0, station(1).sheer + 0.9, L1 - 0.05));
	for (const sx of [-1, 1]) bunting(v3(sx * 1.5, yardY, 0.9), sheerAt(0.22, sx).setY(sheerAt(0.22, sx).y + 1.0), 0.04);

	// ---- ashore: the gangway up her starboard side, the pilings by it ----
	const walk = { floors: [], walls: [] };
	const GW = { x0: 2.0, x1: 2.9, top: station(0.8).sheer, z: 3.0, steps: 9 };
	if (beached) {
		const rise = (GW.top - GROUND) / GW.steps, run = 0.42, zl = 1.6;
		// the landing over the bulwark
		box(GW.x1 - 1.45, 0.1, GW.z - zl, (GW.x1 + 1.45) / 2, GW.top - 0.05, (GW.z + zl) / 2, C.wood);
		for (const [x, z] of [[GW.x1 - 0.06, zl + 0.06], [GW.x1 - 0.06, GW.z - 0.06]]) box(0.1, GW.top - GROUND, 0.1, x, (GW.top + GROUND) / 2, z, C.wood);
		walk.floors.push({ x0: 1.3, x1: GW.x1, z0: zl, z1: GW.z, y: GW.top });
		for (let k = 1; k < GW.steps; k++) {
			const y = GW.top - rise * k, z1 = zl - run * (k - 1), z0 = z1 - run;
			box(GW.x1 - GW.x0, y - GROUND, run, (GW.x0 + GW.x1) / 2, (y + GROUND) / 2, (z0 + z1) / 2, k % 2 ? C.wood : 0x80634a);
			walk.floors.push({ x0: GW.x0, x1: GW.x1, z0, z1, y });
		}
		// a handrail on the outside, down to the gravel
		const zb = zl - run * (GW.steps - 1);
		const hr = [v3(GW.x1 + 0.05, GROUND + 0.2, zb), v3(GW.x1 + 0.05, GW.top, zl), v3(GW.x1 + 0.05, GW.top, GW.z)];
		rail(hr, 0.95, { net: false, every: 1.0 });
		walk.walls.push({ x0: GW.x1, x1: GW.x1 + 0.12, z0: zb, z1: GW.z, y0: GROUND, y1: GW.top + 1 });
		// weathered pilings, a rope between the near ones
		const pil = [[3.5, 3.4, 2.2], [3.5, 0.6, 1.8], [3.5, -2.0, 2.0], [1.3, L1 + 1.6, 1.6], [-1.1, L1 + 1.9, 2.1], [-3.0, -3.2, 1.5]];
		for (const [x, z, h] of pil) {
			put(new THREE.CylinderGeometry(0.17, 0.2, h, 10).translate(x, GROUND + h / 2, z), C.piling);
			put(new THREE.CylinderGeometry(0.175, 0.175, 0.12, 10).translate(x, GROUND + h - 0.25, z), 0x4a3c2e);
			walk.walls.push({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0: GROUND - 1, y1: GROUND + h });
		}
		for (let i = 0; i < 2; i++) { const a = pil[i], b = pil[i + 1]; bunting(v3(a[0], GROUND + a[2] - 0.3, a[1]), v3(b[0], GROUND + b[2] - 0.3, b[1]), 0.06); }
	}

	// ---- where you can stand, and what stops you, in her frame ----
	{
		const bands = (t0, t1, n, y, lo) => {
			for (let k = 0; k < n; k++) {
				const ta = t0 + (t1 - t0) * k / n, tb = t0 + (t1 - t0) * (k + 1) / n, [xa, za] = deckEdge(ta, y), [xb, zb] = deckEdge(tb, y);
				const hw = Math.min(xa, xb) - 0.12, beam = Math.max(station(ta).beam, station(tb).beam), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
				if (hw > 0.15) walk.floors.push({ x0: -hw, x1: hw, z0, z1, y });
				walk.walls.push({ x0: -beam, x1: beam, z0, z1, y0: -3, y1: y - 0.3 });
				const gap = beached && lo && z1 > 1.6 && z0 < GW.z - 0.1;
				for (const sx of gap ? [-1] : [-1, 1]) walk.walls.push({ x0: sx > 0 ? hw + 0.12 : -hw - 0.42, x1: sx > 0 ? hw + 0.42 : -hw - 0.12, z0, z1, y0: y, y1: y + 1.6 });
			}
		};
		bands(0.02, T_STEP, 16, DF, false);
		bands(T_STEP, 1, 6, DA, true);
		const [, zs] = deckEdge(0.02, DF);
		walk.walls.push({ x0: -1, x1: 1, z0: zs - 0.5, z1: zs + 0.05, y0: DF, y1: DF + 1.6 });
		walk.walls.push({ x0: -2, x1: 2, z0: L1 - 0.12, z1: L1 + 0.3, y0: DA - 0.5, y1: DA + 1.4 });
		// the deckhouse's walls, the aft door between x 0.2 and 0.95
		const wy0 = DF, wy1 = CT;
		walk.walls.push({ x0: -CX - 0.05, x1: CX + 0.05, z0: CZ0 - 0.05, z1: CZ0 + 0.05, y0: wy0, y1: wy1 });
		for (const sx of [-1, 1]) walk.walls.push({ x0: sx * CX - 0.05, x1: sx * CX + 0.05, z0: CZ0, z1: CZ1, y0: wy0, y1: wy1 });
		walk.walls.push({ x0: -CX, x1: 0.2, z0: CZ1 - 0.05, z1: CZ1 + 0.05, y0: wy0 - 0.5, y1: wy1 });
		walk.walls.push({ x0: 0.95, x1: CX, z0: CZ1 - 0.05, z1: CZ1 + 0.05, y0: wy0 - 0.5, y1: wy1 });
		// the flying bridge, its ladder, the screen and rails round it, the main mast
		walk.floors.push({ x0: -CX - 0.1, x1: CX + 0.1, z0: CZ0 - 0.1, z1: CZ1 + 0.06, y: UP });
		walk.floors.push({ x0: -1.15, x1: -0.45, z0: CZ1, z1: CZ1 + 0.45, y: UP });
		const zTop = CZ1 + 0.42;
		for (let k = 1; k < 8; k++) walk.floors.push({ x0: -1.15, x1: -0.45, z0: zTop + 0.19 * (7 - k), z1: zTop + 0.19 * (8 - k), y: DA + 0.325 * k });
		for (const sx of [-1, 1]) walk.walls.push({ x0: sx > 0 ? CX + 0.05 : -CX - 0.4, x1: sx > 0 ? CX + 0.4 : -CX - 0.05, z0: CZ0 - 0.3, z1: CZ1 + 0.4, y0: UP, y1: UP + 1.4 });
		walk.walls.push({ x0: -CX - 0.4, x1: CX + 0.4, z0: CZ0 - 0.5, z1: CZ0 - 0.05, y0: UP, y1: UP + 1.4 });
		walk.walls.push({ x0: -0.42, x1: CX + 0.4, z0: CZ1 + 0.06, z1: CZ1 + 0.4, y0: UP, y1: UP + 1.4 });
		walk.walls.push({ x0: -0.1, x1: 0.1, z0: m1.z - 0.1, z1: m1.z + 0.1, y0: UP, y1: m1top.y });
		walk.walls.push({ x0: -0.1, x1: 0.1, z0: m2.z - 0.1, z1: m2.z + 0.1, y0: DA, y1: m2top.y });
	}

	// ---- into a handful of meshes ----
	const add = (geos, mat) => { if (!geos.length) return null; const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; m.receiveShadow = true; boat.add(m); return m; };
	add(paint, M.paint);
	add(glassG.map((g) => { g.deleteAttribute('uv'); return g; }), glass || new THREE.MeshStandardMaterial({ color: 0x3a4a58, roughness: 0.1, metalness: 0.5 }));
	const netMesh = add(netG, M.net);
	if (netMesh) { netMesh.customDepthMaterial = M.netDepth; netMesh.renderOrder = 1; }
	const nameMesh = add(nameG, M.name);
	if (nameMesh) nameMesh.castShadow = false;
	const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lineP, 3));
	boat.add(new THREE.LineSegments(lg, M.line));
	boat.userData.walk = walk;
	boat.userData.ground = GROUND;
	return boat;
}
