// Bakes assets/people/faces.json for the people (src/people/body.js): the MakeHuman face
// shape targets (nose, jaw, chin, cheekbones, brow, lips, eyes, ears, head shape; CC0, from
// the MakeHuman repository on GitHub) for the hm08 base mesh the game uses, only the vertices
// that move, quantised; the skin's per-vertex shading (ambient occlusion, thinness for light
// through ears and nostrils, the oily T-zone, the flush of cheeks, nose and ears); the eyelash
// strips; and the brow's vertices.
//
//   node tools/bake-people-faces.mjs [cacheDir]
//
// The targets and base.obj are downloaded once into cacheDir (default /tmp/mh-cache).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = process.argv[2] || '/tmp/mh-cache';
const SRC = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/';
const BASE = path.join(ROOT, '../textures/human-base-dd84ad3d07.json.gz');
const OUT = path.join(ROOT, 'assets/people/faces.json');

// the face's axes: [name, low targets, high targets] (a side's pair is one axis)
const LR = (n) => ['l-' + n, 'r-' + n];
const AXES = [
	['nose-width', ['nose/nose-scale-horiz-decr'], ['nose/nose-scale-horiz-incr']],
	['nose-length', ['nose/nose-scale-vert-decr'], ['nose/nose-scale-vert-incr']],
	['nose-depth', ['nose/nose-scale-depth-decr'], ['nose/nose-scale-depth-incr']],
	['nose-hump', ['nose/nose-hump-decr'], ['nose/nose-hump-incr']],
	['nose-tip', ['nose/nose-point-width-decr'], ['nose/nose-point-width-incr']],
	['nostrils', ['nose/nose-nostrils-width-decr'], ['nose/nose-nostrils-width-incr']],
	['nose-curve', ['nose/nose-curve-concave'], ['nose/nose-curve-convex']],
	['nose-height', ['nose/nose-trans-down'], ['nose/nose-trans-up']],
	['nose-volume', ['nose/nose-volume-decr'], ['nose/nose-volume-incr']],
	['nose-flare', ['nose/nose-flaring-decr'], ['nose/nose-flaring-incr']],
	['nose-point', ['nose/nose-point-down'], ['nose/nose-point-up']],
	['chin-out', ['chin/chin-prominent-decr'], ['chin/chin-prominent-incr']],
	['chin-width', ['chin/chin-width-decr'], ['chin/chin-width-incr']],
	['chin-height', ['chin/chin-height-decr'], ['chin/chin-height-incr']],
	['jaw', ['chin/chin-bones-decr'], ['chin/chin-bones-incr']],
	['jaw-out', ['chin/chin-prognathism-decr'], ['chin/chin-prognathism-incr']],
	['chin-cleft', null, ['chin/chin-cleft-incr']],
	['cheekbones', LR('cheek-bones-decr').map((n) => 'cheek/' + n), LR('cheek-bones-incr').map((n) => 'cheek/' + n)],
	['cheeks', LR('cheek-volume-decr').map((n) => 'cheek/' + n), LR('cheek-volume-incr').map((n) => 'cheek/' + n)],
	['cheek-inner', LR('cheek-inner-decr').map((n) => 'cheek/' + n), LR('cheek-inner-incr').map((n) => 'cheek/' + n)],
	['forehead', ['forehead/forehead-trans-backward'], ['forehead/forehead-trans-forward']],
	['forehead-height', ['forehead/forehead-scale-vert-decr'], ['forehead/forehead-scale-vert-incr']],
	['temples', ['forehead/forehead-temple-decr'], ['forehead/forehead-temple-incr']],
	['brow-ridge', ['eyebrows/eyebrows-trans-backward'], ['eyebrows/eyebrows-trans-forward']],
	['brow-angle', ['eyebrows/eyebrows-angle-down'], ['eyebrows/eyebrows-angle-up']],
	['mouth-width', ['mouth/mouth-scale-horiz-decr'], ['mouth/mouth-scale-horiz-incr']],
	['mouth-height', ['mouth/mouth-scale-vert-decr'], ['mouth/mouth-scale-vert-incr']],
	['lower-lip', ['mouth/mouth-lowerlip-volume-decr'], ['mouth/mouth-lowerlip-volume-incr']],
	['upper-lip', ['mouth/mouth-upperlip-volume-decr'], ['mouth/mouth-upperlip-volume-incr']],
	['cupids-bow', ['mouth/mouth-cupidsbow-decr'], ['mouth/mouth-cupidsbow-incr']],
	['mouth-corners', ['mouth/mouth-angles-down'], ['mouth/mouth-angles-up']],
	['mouth-out', ['mouth/mouth-trans-backward'], ['mouth/mouth-trans-forward']],
	['philtrum', ['mouth/mouth-philtrum-volume-decr'], ['mouth/mouth-philtrum-volume-incr']],
	['eye-size', LR('eye-scale-decr').map((n) => 'eyes/' + n), LR('eye-scale-incr').map((n) => 'eyes/' + n)],
	['eye-spacing', LR('eye-trans-in').map((n) => 'eyes/' + n), LR('eye-trans-out').map((n) => 'eyes/' + n)],
	['eye-height', LR('eye-trans-down').map((n) => 'eyes/' + n), LR('eye-trans-up').map((n) => 'eyes/' + n)],
	['eye-tilt', LR('eye-eyefold-angle-down').map((n) => 'eyes/' + n), LR('eye-eyefold-angle-up').map((n) => 'eyes/' + n)],
	['eye-open', LR('eye-height2-decr').map((n) => 'eyes/' + n), LR('eye-height2-incr').map((n) => 'eyes/' + n)],
	['eye-bags', LR('eye-bag-decr').map((n) => 'eyes/' + n), LR('eye-bag-incr').map((n) => 'eyes/' + n)],
	['eye-fold', LR('eye-eyefold-concave').map((n) => 'eyes/' + n), LR('eye-eyefold-convex').map((n) => 'eyes/' + n)],
	['ear-size', LR('ear-scale-decr').map((n) => 'ears/' + n), LR('ear-scale-incr').map((n) => 'ears/' + n)],
	['ear-out', LR('ear-wing-decr').map((n) => 'ears/' + n), LR('ear-wing-incr').map((n) => 'ears/' + n)],
	['ear-lobe', LR('ear-lobe-decr').map((n) => 'ears/' + n), LR('ear-lobe-incr').map((n) => 'ears/' + n)],
	['head-fat', ['head/head-fat-decr'], ['head/head-fat-incr']],
	['head-oval', null, ['head/head-oval']],
	['head-round', null, ['head/head-round']],
	['head-square', null, ['head/head-square']],
	['head-triangle', null, ['head/head-triangular']],
	['head-heart', null, ['head/head-invertedtriangular']],
	['head-diamond', null, ['head/head-diamond']],
	['neck-width', ['neck/neck-scale-horiz-decr'], ['neck/neck-scale-horiz-incr']],
];
// vertices that move less than this (metres, before the body's height scaling) are dropped
const MIN = 0.0004;

async function get(rel) {
	const f = path.join(CACHE, rel.replace(/\//g, '_'));
	if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
	const r = await fetch(SRC + rel);
	if (!r.ok) throw Error(rel + ' ' + r.status);
	const t = await r.text();
	fs.mkdirSync(CACHE, { recursive: true });
	fs.writeFileSync(f, t);
	return t;
}
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

const D = JSON.parse(zlib.gunzipSync(fs.readFileSync(BASE)));
const NV = D.position.length ? dec(D.position, Int16Array).length / 3 : 0;
const P = Float32Array.from(dec(D.position, Int16Array), (x) => x * D.unit);

// ---------- the targets ----------
// (a target's units are the obj's decimetres; the game's base is a tenth of that, in metres)
async function target(list) {
	const d = new Float32Array(NV * 3);
	for (const rel of list) {
		for (const line of (await get('targets/' + rel + '.target')).split('\n')) {
			if (!/^\d/.test(line)) continue;
			const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
			d[i * 3] += x * 0.1; d[i * 3 + 1] += y * 0.1; d[i * 3 + 2] += z * 0.1;
		}
	}
	const ids = [];
	let mx = 0;
	for (let i = 0; i < NV; i++) { const m = Math.hypot(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]); if (m >= MIN) { ids.push(i); mx = Math.max(mx, Math.abs(d[i * 3]), Math.abs(d[i * 3 + 1]), Math.abs(d[i * 3 + 2])); } }
	const s = mx / 127;
	// indices as gaps (one byte each; 255 means "add 255 and read on"), deltas as bytes
	const gaps = [];
	let last = -1;
	for (const i of ids) { let g = i - last - 1; while (g >= 255) { gaps.push(255); g -= 255; } gaps.push(g); last = i; }
	const q = new Int8Array(ids.length * 3);
	ids.forEach((i, k) => { for (let c = 0; c < 3; c++) q[k * 3 + c] = Math.round(d[i * 3 + c] / s); });
	return { n: ids.length, s: +s.toPrecision(5), i: b64(Uint8Array.from(gaps)), d: b64(q) };
}

// ---------- the mesh, for the skin's shading ----------
const objText = await get('3dobjs/base.obj');
const groups = {}, vt = [];
{
	let g = '';
	for (const l of objText.split('\n')) {
		if (l.startsWith('g ')) g = l.slice(2).trim();
		else if (l.startsWith('vt ')) { const [, u, v] = l.split(/\s+/); vt.push([+u, +v]); }
		else if (l.startsWith('f ')) (groups[g] = groups[g] || []).push(l.slice(2).trim().split(/\s+/).map((t) => t.split('/').map((x) => +x - 1)));
	}
}
const tris = [];
const addFaces = (faces) => { for (const f of faces) for (let k = 1; k + 1 < f.length; k++) tris.push(f[0][0], f[k][0], f[k + 1][0]); };
addFaces(groups.body);
const bodyTris = tris.length / 3;
for (const g of ['helper-l-eye', 'helper-r-eye', 'helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue']) addFaces(groups[g]);

// vertex normals (the body's own triangles)
const N = new Float32Array(NV * 3), used = new Uint8Array(NV);
for (let t = 0; t < bodyTris; t++) {
	const [a, b, c] = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
	const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
	const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
	const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
	for (const v of [a, b, c]) { N[v * 3] += nx; N[v * 3 + 1] += ny; N[v * 3 + 2] += nz; used[v] = 1; }
}
for (let v = 0; v < NV; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; }

// a uniform grid over the triangles, for rays
const CELL = 0.015;
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let v = 0; v < NV; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], P[v * 3 + c]); hi[c] = Math.max(hi[c], P[v * 3 + c]); }
lo = lo.map((x) => x - 0.01); hi = hi.map((x) => x + 0.01);
const G = hi.map((h, c) => Math.ceil((h - lo[c]) / CELL));
const grid = new Map();
for (let t = 0; t < tris.length / 3; t++) {
	const mn = [1e9, 1e9, 1e9], mxv = [-1e9, -1e9, -1e9];
	for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) { const x = P[tris[t * 3 + k] * 3 + c]; mn[c] = Math.min(mn[c], x); mxv[c] = Math.max(mxv[c], x); }
	const a = mn.map((x, c) => Math.floor((x - lo[c]) / CELL)), b = mxv.map((x, c) => Math.floor((x - lo[c]) / CELL));
	for (let i = a[0]; i <= b[0]; i++) for (let j = a[1]; j <= b[1]; j++) for (let k = a[2]; k <= b[2]; k++) { const key = (i * G[1] + j) * G[2] + k; let L = grid.get(key); if (!L) grid.set(key, L = []); L.push(t); }
}
// the nearest hit along a ray within maxT (Moller-Trumbore), skipping triangles on the vertex
function cast(ox, oy, oz, dx, dy, dz, maxT, self) {
	let best = maxT;
	const seen = new Set();
	const steps = Math.ceil(maxT / (CELL * 0.5));
	for (let s = 0; s <= steps; s++) {
		const t0 = s * CELL * 0.5;
		if (t0 > best) break;
		const x = ox + dx * t0, y = oy + dy * t0, z = oz + dz * t0;
		const key = (Math.floor((x - lo[0]) / CELL) * G[1] + Math.floor((y - lo[1]) / CELL)) * G[2] + Math.floor((z - lo[2]) / CELL);
		const L = grid.get(key);
		if (!L) continue;
		for (const t of L) {
			if (seen.has(t)) continue;
			seen.add(t);
			const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
			if (a === self || b === self || c === self) continue;
			const e1x = P[b * 3] - P[a * 3], e1y = P[b * 3 + 1] - P[a * 3 + 1], e1z = P[b * 3 + 2] - P[a * 3 + 2];
			const e2x = P[c * 3] - P[a * 3], e2y = P[c * 3 + 1] - P[a * 3 + 1], e2z = P[c * 3 + 2] - P[a * 3 + 2];
			const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
			const det = e1x * px + e1y * py + e1z * pz;
			if (Math.abs(det) < 1e-12) continue;
			const inv = 1 / det, tx = ox - P[a * 3], ty = oy - P[a * 3 + 1], tz = oz - P[a * 3 + 2];
			const u = (tx * px + ty * py + tz * pz) * inv;
			if (u < 0 || u > 1) continue;
			const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
			const v = (dx * qx + dy * qy + dz * qz) * inv;
			if (v < 0 || u + v > 1) continue;
			const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
			if (tt > 1e-5 && tt < best) best = tt;
		}
	}
	return best;
}
// directions about a normal: a cosine-weighted hemisphere (or a narrow cone)
function dirs(n, count, cone, seed) {
	const out = [];
	let s = seed;
	const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
	const tx = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
	const tl = Math.hypot(...tx); tx[0] /= tl; tx[1] /= tl; tx[2] /= tl;
	const ty = [n[1] * tx[2] - n[2] * tx[1], n[2] * tx[0] - n[0] * tx[2], n[0] * tx[1] - n[1] * tx[0]];
	for (let k = 0; k < count; k++) {
		const u1 = (k + r()) / count, u2 = r();
		const rr = cone ? Math.sqrt(u1) * cone : Math.sqrt(u1), ph = u2 * Math.PI * 2;
		const a = rr * Math.cos(ph), b = rr * Math.sin(ph), c = Math.sqrt(Math.max(0, 1 - a * a - b * b));
		out.push([tx[0] * a + ty[0] * b + n[0] * c, tx[1] * a + ty[1] * b + n[1] * c, tx[2] * a + ty[2] * b + n[2] * c]);
	}
	return out;
}

// landmarks: the eyes' centres, the mouth (where mouth-open moves most), the nose tip
const cen = (ids) => { const c = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) c[k] += P[i * 3 + k] / ids.length; return c; };
const eyeL = cen(D.eyes.L), eyeR = cen(D.eyes.R), eyeY = (eyeL[1] + eyeR[1]) / 2, eyeX = Math.abs(eyeL[0] - eyeR[0]) / 2;
const mo = dec(D.targets['mouth-open'], Int16Array);
let mouthY = 0, mw = 0;
for (let v = 0; v < NV; v++) { const m = Math.hypot(mo[v * 3], mo[v * 3 + 1], mo[v * 3 + 2]); if (m > 150 && used[v]) { mouthY += P[v * 3 + 1] * m; mw += m; } }
mouthY /= mw;
let noseZ = -1e9, noseY = 0;
for (let v = 0; v < NV; v++) if (used[v] && Math.abs(P[v * 3]) < 0.004 && P[v * 3 + 1] < eyeY && P[v * 3 + 1] > mouthY && P[v * 3 + 2] > noseZ) { noseZ = P[v * 3 + 2]; noseY = P[v * 3 + 1]; }
const headW = new Float32Array(NV);
{
	const ids = dec(D.indices, Uint8Array), w = dec(D.weights, Uint16Array), hb = D.bones.findIndex((b) => b.name === 'head');
	for (let v = 0; v < NV; v++) { let s = 0, h = 0; for (let q = 0; q < 4; q++) { s += w[v * 4 + q]; if (ids[v * 4 + q] === hb) h += w[v * 4 + q]; } headW[v] = s ? h / s : 0; }
}
console.log('landmarks', { eyeY: eyeY.toFixed(3), eyeX: eyeX.toFixed(3), mouthY: mouthY.toFixed(3), noseY: noseY.toFixed(3), noseZ: noseZ.toFixed(3) });

// ---------- the skin: ao, thin, oil, flush ----------
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const skin = new Uint8Array(NV * 4);
const t0 = Date.now();
const AO_RAYS = 40, AO_D = 0.1;
const ao = new Float32Array(NV).fill(1), thin = new Float32Array(NV);
for (let v = 0; v < NV; v++) {
	if (!used[v]) continue;
	const n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
	const ox = P[v * 3] + n[0] * 0.0008, oy = P[v * 3 + 1] + n[1] * 0.0008, oz = P[v * 3 + 2] + n[2] * 0.0008;
	let occ = 0;
	for (const d of dirs(n, AO_RAYS, 0, v * 7 + 1)) { const t = cast(ox, oy, oz, d[0], d[1], d[2], AO_D, v); if (t < AO_D) occ += Math.pow(1 - t / AO_D, 0.7); }
	ao[v] = 1 - occ / AO_RAYS;
	// how much flesh lies behind: rays into the body
	const m = [-n[0], -n[1], -n[2]];
	let th = 0;
	const inside = dirs(m, 6, 0.4, v * 13 + 5);
	for (const d of inside) th += cast(P[v * 3] - n[0] * 0.0003, P[v * 3 + 1] - n[1] * 0.0003, P[v * 3 + 2] - n[2] * 0.0003, d[0], d[1], d[2], 0.05, v);
	thin[v] = 1 - sm(0.006, 0.028, th / inside.length);
}
// one pass of smoothing over the triangles' neighbours
{
	const acc = new Float32Array(NV), cnt = new Float32Array(NV);
	for (let t = 0; t < bodyTris; t++) for (let k = 0; k < 3; k++) { const v = tris[t * 3 + k]; for (let j = 0; j < 3; j++) { acc[v] += ao[tris[t * 3 + j]]; cnt[v]++; } }
	for (let v = 0; v < NV; v++) if (cnt[v]) ao[v] = acc[v] / cnt[v];
}
console.log('ao + thickness', ((Date.now() - t0) / 1000).toFixed(1) + 's');
for (let v = 0; v < NV; v++) {
	const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], ax = Math.abs(x), h = headW[v];
	const front = sm(0.1, 0.5, N[v * 3 + 2]);
	// the T-zone: the forehead's middle, down the nose, the chin; the lips a little
	const fore = sm(eyeY + 0.012, eyeY + 0.03, y) * (1 - sm(eyeY + 0.07, eyeY + 0.1, y)) * (1 - sm(0.025, 0.05, ax));
	const nose = sm(mouthY + 0.008, mouthY + 0.02, y) * (1 - sm(eyeY - 0.005, eyeY + 0.012, y)) * (1 - sm(0.012, 0.022, ax));
	const chin = sm(mouthY - 0.055, mouthY - 0.035, y) * (1 - sm(mouthY - 0.022, mouthY - 0.012, y)) * (1 - sm(0.012, 0.025, ax));
	const lips = (1 - sm(0.006, 0.014, Math.abs(y - mouthY))) * (1 - sm(0.018, 0.026, ax)) * sm(noseZ - 0.03, noseZ - 0.018, z);
	const oil = Math.max(fore, nose, chin * 0.8, lips * 0.7) * front * h;
	// the flush: cheeks, the tip of the nose, the ears, the lips
	const cheek = Math.exp(-(((ax - eyeX - 0.004) / 0.02) ** 2 + ((y - eyeY + 0.035) / 0.018) ** 2)) * front;
	const tip = Math.exp(-((x / 0.012) ** 2 + ((y - noseY) / 0.012) ** 2)) * sm(noseZ - 0.02, noseZ - 0.005, z);
	const ear = sm(0.06, 0.07, ax) * sm(eyeY - 0.045, eyeY - 0.03, y) * (1 - sm(eyeY + 0.03, eyeY + 0.045, y)) * h;
	const flush = Math.min(1, Math.max(cheek * 0.8, tip * 0.7, ear * 0.9, lips * 0.6)) * h;
	skin.set([Math.round(Math.max(0, Math.min(1, ao[v])) * 255), Math.round(thin[v] * 255), Math.round(oil * 255), Math.round(flush * 255)], v * 4);
}

// ---------- the eyelashes: the base mesh's own lash strips (they close with the lids) ----------
// triangles as (vertex, along the lid 0..1, out from the lid 0..1 (+1 on the upper lid)),
// both in 1/32767
const lash = [];
for (const [g, upper, eye] of [['helper-l-eyelashes-2', 1, eyeL], ['helper-r-eyelashes-2', 1, eyeR], ['helper-l-eyelashes-1', 0, eyeL], ['helper-r-eyelashes-1', 0, eyeR]]) {
	const vs = [...new Set(groups[g].flat().map((c) => c[0]))];
	const r = (v) => Math.hypot(P[v * 3] - eye[0], P[v * 3 + 1] - eye[1], P[v * 3 + 2] - eye[2]);
	let r0 = 1e9, r1 = -1e9, x0 = 1e9, x1 = -1e9;
	for (const v of vs) { r0 = Math.min(r0, r(v)); r1 = Math.max(r1, r(v)); x0 = Math.min(x0, P[v * 3]); x1 = Math.max(x1, P[v * 3]); }
	for (const f of groups[g]) for (let k = 1; k + 1 < f.length; k++) for (const c of [f[0], f[k], f[k + 1]]) {
		const v = c[0];
		lash.push(v, Math.round((P[v * 3] - x0) / (x1 - x0) * 32767), Math.round(((r(v) - r0) / (r1 - r0) + upper) * 32767));
	}
}
// the brows: points along each brow's arch on the skin (the vertex under it, and how far
// along from the inner end, in 1/65535)
const brow = [];
for (const eye of [eyeL, eyeR]) {
	const sx = Math.sign(eye[0]);
	for (let k = 0; k < 14; k++) {
		const t = k / 13, ax = eyeX - 0.013 + t * 0.037, ay = eyeY + 0.0125 + 0.0065 * Math.sin(Math.PI * Math.min(1, t / 0.7) * 0.5) * (t < 0.7 ? 1 : 1 - (t - 0.7) * 1.4);
		let best = -1, bd = 1e9;
		for (let v = 0; v < NV; v++) {
			if (!used[v] || headW[v] < 0.8 || N[v * 3 + 2] < 0.15 || Math.sign(P[v * 3]) !== sx) continue;
			const dd = Math.hypot(Math.abs(P[v * 3]) - ax, P[v * 3 + 1] - ay) - P[v * 3 + 2] * 0.02;
			if (P[v * 3 + 2] > eye[2] - 0.005 && dd < bd) { bd = dd; best = v; }
		}
		brow.push(best, Math.round(t * 65535));
	}
}

const out = { license: 'CC0', source: 'MakeHuman hm08 targets, https://github.com/makehumancommunity/makehuman', vertices: NV, axes: [], skin: b64(skin), lash: b64(Uint16Array.from(lash)), brow: b64(Uint16Array.from(brow)) };
let total = 0;
for (const [name, a, b] of AXES) {
	const ax = { n: name, lo: a ? await target(a) : null, hi: await target(b) };
	total += (ax.lo?.n || 0) + ax.hi.n;
	out.axes.push(ax);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('axes', out.axes.length, 'moving vertices', total, 'bytes', fs.statSync(OUT).size, 'gzip', zlib.gzipSync(fs.readFileSync(OUT)).length);
