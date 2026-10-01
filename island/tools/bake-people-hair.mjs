// Bakes assets/people/hair/ for the people (src/people/hairkit.js): hair and beards made for
// the MakeHuman hm08 base mesh (the one the game uses), each vertex tied to three of the
// body's vertices and an offset, as MakeHuman's own proxies (.mhclo) are, so they follow
// every head. Per style: a small gzipped binary (the ties, the texture coordinates, which
// way the strands run, how near the root, the triangles) and one texture, grey and alpha,
// so the person's own colour tints it. The sources and their licences are listed below and
// in assets/people/CREDITS.md; only CC0 and CC-BY assets are used.
//
//   node tools/bake-people-hair.mjs [sourceDir]
//
// sourceDir (default /tmp/claude-0/hair/src) holds the assets, from the MakeHuman system
// assets (CC0) and the MakeHuman community's hair and beard packs, as checked out from
// public mirrors on GitHub (see CREDITS.md).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = process.argv[2] || '/tmp/claude-0/hair/src';
const BASE = path.join(ROOT, '../textures/human-base-dd84ad3d07.json.gz');
const OUT = path.join(ROOT, 'assets/people/hair');

const SYS = 'mpfb_backup/scripts/addons/mpfb/data/hair/';
const ELV = 'Synthetic_Face_Generator/Hair2/hair02_ccby/hair/';
const CLO = 'mpfb_backup/scripts/addons/mpfb/data/clothes/';
const MAD = 'Madhatters-Table-Top-RPG-Mini-Maker/src/assets/clothes/';
const MH = 'MakeHuman team (Data Collection AB, Joel Palmius, Jonas Hauquier)';
const node = (n) => 'http://www.makehumancommunity.org/node/' + n;
// [id, folder, mhclo, texture, author, licence, source] (the last three for CREDITS.md)
const LIST = [
	['afro01', SYS + 'afro01', 'afro01.mhclo', 'afro_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['bob01', SYS + 'bob01', 'bob01.mhclo', 'bob01_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['bob02', SYS + 'bob02', 'bob02.mhclo', 'bob02_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['braid01', SYS + 'braid01', 'braid01.mhclo', 'braid01_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['long01', SYS + 'long01', 'long01.mhclo', 'long01_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['ponytail01', SYS + 'ponytail01', 'ponytail01.mhclo', 'ponytail01_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['short01', SYS + 'short01', 'short01.mhclo', 'short01_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['short02', SYS + 'short02', 'short02.mhclo', 'short02_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['short03', SYS + 'short03', 'short03.mhclo', 'short03_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['short04', SYS + 'short04', 'short04.mhclo', 'short04_diffuse.png', MH, 'CC0', 'MakeHuman system assets'],
	['updo50s', ELV + 'elvs_50s_updo', 'elvs_50s_updo.mhclo', 'elv_50supdo1_diffuse.png', 'Elvaerwyn', 'CC-BY', node(2001)],
	['adrienne', ELV + 'elvs_adrienne_hair', 'elvs_adrienne_hair.mhclo', 'elvs_adrienne_hair1_diffuse.png', 'Elvaerwyn', 'CC-BY', node(1862)],
	['braidbun', ELV + 'elvs_braid_bun', 'elvs_braid_bun.mhclo', 'elvs_braid_bun_q1_diffuse.png', 'Elvaerwyn', 'CC-BY', node(2177)],
	['daisy', ELV + 'elvs_daisy_hair', 'elvs_daisy_hair.mhclo', 'elvs_daisyhair1_diffuse.png', 'Elvaerwyn', 'CC-BY', node(1859)],
	['grump', ELV + 'elvs_grump_hair', 'elvs_grump_hair.mhclo', 'elvs_grumphair_diffuse.png', 'Elvaerwyn', 'CC-BY', node(2796)],
	['hazel', ELV + 'elvs_hazel_hair', 'elvs_hazel_hair.mhclo', 'elvs_hazel_hair_diffuse.png', 'Elvaerwyn', 'CC-BY', node(2816)],
	['curlybob', ELV + 'elvs_inverted_curly_bob', 'elvs_inverted_curly_bob.mhclo', 'elvs_inverted_curlybob1_diffuse.png', 'Elvaerwyn', 'CC-BY', node(2683)],
	['island', ELV + 'elvs_island_princess_hair', 'elvs_island_princess_hair.mhclo', 'hairtex1.png', 'Elvaerwyn', 'CC-BY', node(1811)],
	['katherine', ELV + 'elvs_katherine_hair', 'elvs_katherine_hair.mhclo', 'erbehairtex1.png', 'Elvaerwyn', 'CC-BY', node(1863)],
	['keylth', ELV + 'elvs_keylth_hair', 'elvs_keylth_hair.mhclo', 'keylthtex1.png', 'Elvaerwyn', 'CC-BY', node(2173)],
	['hippy', ELV + 'elvs_lady_hippy_hair', 'elvs_lady_hippy_hair.mhclo', 'hairtex1.png', 'Elvaerwyn', 'CC-BY', node(1812)],
	['puffs', ELV + 'elvs_micky_afro', 'elvs_micky_afro.mhclo', 'elvs_mickey_afro_diffuse.png', 'Elvaerwyn', 'CC-BY', node(2817)],
	['shortdaisy', ELV + 'elvs_short_daisy_hair', 'elvs_short_daisy_hair.mhclo', 'daisyhair1.png', 'Elvaerwyn', 'CC-BY', node(1860)],
	['tousled', ELV + 'elvs_that_80s_babe_hair', 'elvs_that_80s_babe_hair.mhclo', '80shairtex8.png', 'Elvaerwyn', 'CC-BY', node(2174)],
	['wavybob', ELV + 'elvs_wavy_bob', 'elvs_wavy_bob.mhclo', 'black.png', 'Elvaerwyn', 'CC-BY', node(1551)],
	// beards and moustaches
	['viking', CLO + 'rehmanpolanski_beard_viking', 'rehmanpolanski_beard_viking.mhclo', 'BeardViking.png', 'Rehman Polanski', 'CC0', 'MakeHuman community assets'],
	['moustache', CLO + 'rehmanpolanski_moustache_viking', 'rehmanpolanski_moustache_viking.mhclo', 'MoustacheViking.png', 'Rehman Polanski', 'CC0', 'MakeHuman community assets'],
	['scruffy', MAD + 'elvs_scruffy_beard1', 'elvs_scruffy_beard1.mhclo', 'elvs_beard1_longscruffy3_diffuse.png', 'Elvaerwyn', 'CC-BY', 'MakeHuman community assets'],
];
const BEARDS = new Set(['viking', 'moustache', 'scruffy']);
const TEX = 512;
// the most triangles a style keeps (the heavier ones are thinned, their cards' outlines kept)
const MAXT = 5000;

// ---------- the base mesh ----------
const D = JSON.parse(zlib.gunzipSync(fs.readFileSync(BASE)).toString());
const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const P16 = b64(D.position, Int16Array), NB = P16.length / 3;
const base = Float32Array.from(P16, (x) => x * D.unit);
const avg = (ids) => { const c = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) c[k] += base[i * 3 + k] / ids.length; return c; };
const eyeL = avg(D.eyes.L), eyeR = avg(D.eyes.R), eyeY = (eyeL[1] + eyeR[1]) / 2;
// the head's surface: the body's vertices above the chin
const bodyF = b64(D.body, Uint16Array), head = new Set();
for (let i = 0; i < bodyF.length; i += 2) { const v = bodyF[i]; if (base[v * 3 + 1] > eyeY - 0.16) head.add(v); }
const headV = [...head];
let hc = [0, 0, 0];
{
	let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
	for (const v of headV) if (base[v * 3 + 1] > eyeY + 0.03) { x0 = Math.min(x0, base[v * 3]); x1 = Math.max(x1, base[v * 3]); z0 = Math.min(z0, base[v * 3 + 2]); z1 = Math.max(z1, base[v * 3 + 2]); }
	hc = [(x0 + x1) / 2, eyeY + 0.012, (z0 + z1) / 2];
}
// coarse grids over the head's surface, for the nearest point: all of it (for a beard, the
// face), and the scalp alone (for hair: long hair by the neck is far from its roots)
const G = 0.02;
const gridOf = (vs) => { const g = new Map(); for (const v of vs) { const k = [0, 1, 2].map((a) => Math.floor(base[v * 3 + a] / G)).join(); if (!g.has(k)) g.set(k, []); g.get(k).push(v); } return g; };
const eyeZ = (avg(D.eyes.L)[2] + avg(D.eyes.R)[2]) / 2;
const faceGrid = gridOf(headV), scalpGrid = gridOf(headV.filter((v) => base[v * 3 + 1] > eyeY - 0.03 && !(base[v * 3 + 2] > eyeZ - 0.03 && base[v * 3 + 1] < eyeY + 0.055)));
function nearest(grid, q) {
	let best = 1e9;
	for (let r = 1; r <= 4 && best > (r - 1) * G; r++) {
		const c = q.map((x) => Math.floor(x / G));
		for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
			const L = grid.get([c[0] + i, c[1] + j, c[2] + k].join());
			if (L) for (const v of L) best = Math.min(best, Math.hypot(q[0] - base[v * 3], q[1] - base[v * 3 + 1], q[2] - base[v * 3 + 2]));
		}
	}
	return best;
}

// ---------- the asset files ----------
function readMhclo(file) {
	const L = fs.readFileSync(file, 'utf8').split(/\r?\n/);
	const scale = [null, null, null], ties = [];
	let inVerts = false, objFile = null;
	for (const line of L) {
		const w = line.trim().split(/\s+/);
		if (!w[0] || w[0].startsWith('#')) continue;
		if (/^[xyz]_scale$/.test(w[0])) { scale['xyz'.indexOf(w[0][0])] = [+w[1], +w[2], +w[3]]; continue; }
		// (older files give a box's two sides instead: the same scale, as MakeHuman reads it)
		if (/^(l_)?shear_[xyz]$/.test(w[0])) { const a = 'xyz'.indexOf(w[0].slice(-1)); if (!scale[a]) scale[a] = [+w[1], +w[2], Math.abs(+w[4] - +w[3])]; continue; }
		if (w[0] === 'obj_file') objFile = w[1];
		if (w[0] === 'verts') { inVerts = true; continue; }
		if (inVerts) {
			// (plain keywords may follow the ties; another section ends them)
			if (!/^-?\d/.test(w[0])) { if (/^(delete_verts|vertex_groups|weights)$/.test(w[0])) inVerts = false; continue; }
			if (w.length === 1) ties.push([+w[0], +w[0], +w[0], 1, 0, 0, 0, 0, 0]);
			else if (w.length >= 9) ties.push(w.slice(0, 9).map(Number));
		}
	}
	return { scale, ties, objFile };
}
function readObj(file) {
	const V = [], VT = [], F = [];
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const w = line.trim().split(/\s+/);
		if (w[0] === 'v') V.push(w.slice(1, 4).map(Number));
		else if (w[0] === 'vt') VT.push([+w[1], +w[2]]);
		else if (w[0] === 'f') F.push(w.slice(1).map((s) => { const [a, b] = s.split('/'); return [+a - 1, b ? +b - 1 : -1]; }));
	}
	return { V, VT, F };
}

// the texture: grey (the strands' light and shade, the colour taken out, and the light
// painted into it: the game lights the hair itself) and alpha; only where the mesh uses it
// (nothing else in the file, no stray marks), the grey spread into the clear parts so no
// fringe shows as it shrinks
async function texture(file, id, UV, tris) {
	const S = TEX, n = S * S;
	const data = await sharp(file, { unlimited: true }).ensureAlpha().resize(S, S, { kernel: 'lanczos3' }).raw().toBuffer();
	// where the triangles fall on it, a few pixels wider
	const used = new Uint8Array(n);
	for (const t of tris) {
		const P = t.map((i) => [UV[i][0] * S, (1 - UV[i][1]) * S]);
		const x0 = Math.max(0, Math.floor(Math.min(...P.map((q) => q[0])) - 3)), x1 = Math.min(S - 1, Math.ceil(Math.max(...P.map((q) => q[0])) + 3));
		const y0 = Math.max(0, Math.floor(Math.min(...P.map((q) => q[1])) - 3)), y1 = Math.min(S - 1, Math.ceil(Math.max(...P.map((q) => q[1])) + 3));
		const [a, b, c] = P, area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
		for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
			if (Math.abs(area) < 1e-6) { used[y * S + x] = 1; continue; }
			const px = x + 0.5, py = y + 0.5;
			const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area, w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area, w2 = 1 - w0 - w1;
			// (a margin of about three pixels round each)
			const m = 3 / Math.max(1, Math.sqrt(Math.abs(area)));
			if (w0 > -m && w1 > -m && w2 > -m) used[y * S + x] = 1;
		}
	}
	const lum = new Float32Array(n), wa = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
		lum[i] = 0.2126 * r * r + 0.7152 * g * g + 0.0722 * b * b;
		wa[i] = used[i] ? data[i * 4 + 3] / 255 : 0;
	}
	// the broad light and shade (an alpha-weighted blur), to take out
	const blur = (src, R) => {
		const out = new Float32Array(n), tmp = new Float32Array(n);
		for (let y = 0; y < S; y++) { let s = 0; for (let x = -R; x <= R; x++) s += src[y * S + Math.min(S - 1, Math.max(0, x))]; for (let x = 0; x < S; x++) { tmp[y * S + x] = s; s += src[y * S + Math.min(S - 1, x + R + 1)] - src[y * S + Math.max(0, x - R)]; } }
		for (let x = 0; x < S; x++) { let s = 0; for (let y = -R; y <= R; y++) s += tmp[Math.min(S - 1, Math.max(0, y)) * S + x]; for (let y = 0; y < S; y++) { out[y * S + x] = s; s += tmp[Math.min(S - 1, y + R + 1) * S + x] - tmp[Math.max(0, y - R) * S + x]; } }
		return out;
	};
	const la = lum.map((l, i) => l * wa[i]), bl = blur(la, 10), bw = blur(wa, 10);
	const vals = [];
	for (let i = 0; i < n; i += 5) if (wa[i] > 0.5) vals.push(lum[i]);
	vals.sort((a, b) => a - b);
	const med = vals[vals.length >> 1] || 0.2;
	const out = Buffer.alloc(n * 4);
	for (let i = 0; i < n; i++) {
		const a = Math.round(wa[i] * 255), broad = bw[i] > 1e-3 ? bl[i] / bw[i] : med;
		// the strands against their surroundings, and a little of the broad shade; 0.5 is
		// the hair's own colour
		const g = a < 8 ? 0.5 : Math.min(1, 0.5 * Math.pow(lum[i] / Math.max(1e-4, broad), 0.45) * Math.pow(broad / med, 0.12));
		out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = Math.round(g * 255); out[i * 4 + 3] = a;
	}
	const img = sharp(out, { raw: { width: S, height: S, channels: 4 } });
	await img.clone().webp({ quality: 78, alphaQuality: 85, effort: 6 }).toFile(path.join(OUT, id + '.webp'));
	// which way the strands run in the texture: across them the shade changes most
	let gx = 0, gy = 0;
	for (let y = 1; y < S; y++) for (let x = 1; x < S; x++) {
		const i = (y * S + x) * 4;
		if (out[i + 3] < 128) continue;
		gx += Math.abs(out[i] - out[i - 4]); gy += Math.abs(out[i] - out[i - S * 4]);
	}
	return { along: gx > gy * 1.12 ? 1 : gy > gx * 1.12 ? 0 : -1, gx, gy, bytes: fs.statSync(path.join(OUT, id + '.webp')).size };
}

// ---------- baking one ----------
// (the header padded with spaces to a whole number of words)
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4, 32)]);
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

async function bake([id, dir, clo, tex]) {
	const folder = path.join(SRC, dir);
	const M = readMhclo(path.join(folder, clo));
	const objName = fs.existsSync(path.join(folder, M.objFile || '')) ? M.objFile : fs.readdirSync(folder).find((f) => f.endsWith('.obj'));
	const O = readObj(path.join(folder, objName));
	if (O.V.length !== M.ties.length) console.warn(id, 'obj has', O.V.length, 'vertices, mhclo', M.ties.length);
	// the proxy's vertices on the base mesh (metres; the base mesh is the obj's decimetres / 10)
	const nvo = Math.min(O.V.length, M.ties.length);
	const den = M.scale.map((s, a) => s ? s[2] * 0.1 : 1);
	const sref = M.scale.map((s) => s ? [s[0], s[1]] : [0, 0]);
	const sc = sref.map(([a, b], ax) => M.scale[ax] ? Math.abs(base[a * 3 + ax] - base[b * 3 + ax]) / den[ax] : 1);
	const pos = [];
	for (let i = 0; i < nvo; i++) {
		const t = M.ties[i], q = [0, 0, 0];
		for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) q[a] += t[3 + k] * base[t[k] * 3 + a];
		for (let a = 0; a < 3; a++) q[a] += t[6 + a] * 0.1 * sc[a];
		pos.push(q);
	}
	// split by texture coordinate: one vertex per (vertex, uv) pair
	const key = new Map();
	let vs = [], tris = [];
	for (const f of O.F) {
		const ids = f.map(([v, t]) => {
			if (v >= nvo) return -1;
			const k = v * 1e6 + (t < 0 ? 999999 : t);
			let q = key.get(k);
			if (q === undefined) { q = vs.length; key.set(k, q); vs.push([v, t]); }
			return q;
		});
		if (ids.includes(-1)) continue;
		for (let j = 1; j + 1 < ids.length; j++) tris.push([ids[0], ids[j], ids[j + 1]]);
	}
	let P = vs.map(([v]) => pos[v]), UV = vs.map(([, t]) => t < 0 ? [0.5, 0.5] : O.VT[t]);
	const tris0 = tris.length;
	if (tris.length > MAXT) {
		await MeshoptSimplifier.ready;
		const [ind] = MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(tris.flat()), Float32Array.from(P.flat()), 3, Float32Array.from(UV.flat()), 2, [0.3, 0.3], null, MAXT * 3, 0.03, ['LockBorder']);
		const map = new Map(), keep = [];
		tris = [];
		for (let i = 0; i < ind.length; i += 3) tris.push([0, 1, 2].map((k) => { const v = ind[i + k]; if (!map.has(v)) { map.set(v, keep.length); keep.push(v); } return map.get(v); }));
		vs = keep.map((v) => vs[v]); P = keep.map((v) => P[v]); UV = keep.map((v) => UV[v]);
	}
	const nv = vs.length, nt = tris.length;
	const T = await texture(path.join(folder, tex), id, UV, tris);
	// how near the root: the distance from the scalp (or the face, for a beard)
	const dist = P.map((q) => nearest(BEARDS.has(id) ? faceGrid : scalpGrid, q));
	// per triangle: its normal, and the direction the strands run
	const Nv = P.map(() => [0, 0, 0]), Tv = P.map(() => [0, 0, 0]);
	for (const [a, b, c] of tris) {
		const e1 = sub(P[b], P[a]), e2 = sub(P[c], P[a]);
		const n = cross(e1, e2);
		for (const i of [a, b, c]) for (let k = 0; k < 3; k++) Nv[i][k] += n[k];
		let t;
		const du1 = UV[b][0] - UV[a][0], dv1 = UV[b][1] - UV[a][1], du2 = UV[c][0] - UV[a][0], dv2 = UV[c][1] - UV[a][1];
		const det = du1 * dv2 - du2 * dv1;
		if (T.along >= 0 && Math.abs(det) > 1e-12) {
			// dP/dv (strands along the texture's v) or dP/du
			t = T.along === 1 ? e1.map((x, k) => (-du2 * x + du1 * e2[k]) / det) : e1.map((x, k) => (dv2 * x - dv1 * e2[k]) / det);
		} else {
			// no clear grain: down the head, away from the scalp
			const m = [(P[a][0] + P[b][0] + P[c][0]) / 3 - hc[0], (P[a][1] + P[b][1] + P[c][1]) / 3 - hc[1], (P[a][2] + P[b][2] + P[c][2]) / 3 - hc[2]];
			const nn = norm(n), g = [m[0] * 0.3, m[1] * 0.3 - 1, m[2] * 0.3];
			t = sub(g, nn.map((x) => x * dot(g, nn)));
		}
		t = norm(t);
		// pointing from the root to the tip
		const dd = dist[b] - dist[a], ee = dist[c] - dist[a];
		const grad = [e1[0] * dd + e2[0] * ee, e1[1] * dd + e2[1] * ee, e1[2] * dd + e2[2] * ee];
		const ref = Math.hypot(...grad) > 1e-7 ? grad : [0, -1, 0];
		if (dot(t, ref) < 0) t = t.map((x) => -x);
		const w = Math.hypot(...n);
		for (const i of [a, b, c]) for (let k = 0; k < 3; k++) Tv[i][k] += t[k] * w;
	}
	// the normal for lighting: the card's, turned outward, bent towards the head's round
	const nrm = P.map((q, i) => {
		const r = norm(sub(q, hc));
		let n = norm(Nv[i]);
		if (dot(n, r) < 0) n = n.map((x) => -x);
		return norm(n.map((x, k) => x * 0.5 + r[k] * 0.8));
	});
	// ---- write ----
	const beard = BEARDS.has(id);
	const tie = vs.map(([v]) => M.ties[v]);
	const hdr = Buffer.from(JSON.stringify({ id, nv, nt, den, sref, grain: T.along }));
	const H = pad4(hdr), len = Buffer.alloc(4); len.writeUInt32LE(H.length);
	const refs = new Uint16Array(nv * 3), wts = new Float32Array(nv * 3), off = new Int16Array(nv * 3), uv = new Uint16Array(nv * 2), tn = new Int8Array(nv * 8), rt = new Uint8Array(nv + ((4 - nv % 4) % 4)), idx = new Uint16Array(nt * 3 + (nt * 3) % 2);
	const q16 = (x, s) => Math.max(-32767, Math.min(32767, Math.round(x * s)));
	let maxOff = 0;
	for (let i = 0; i < nv; i++) {
		const t = tie[i];
		for (let k = 0; k < 3; k++) { refs[i * 3 + k] = t[k]; wts[i * 3 + k] = t[3 + k]; off[i * 3 + k] = q16(t[6 + k] * 0.1, 40000); maxOff = Math.max(maxOff, Math.abs(t[6 + k] * 0.1)); }
		uv[i * 2] = Math.round(Math.max(0, Math.min(1, UV[i][0] - Math.floor(UV[i][0] === 1 ? 0 : UV[i][0]))) * 65535);
		uv[i * 2 + 1] = Math.round(Math.max(0, Math.min(1, 1 - (UV[i][1] - Math.floor(UV[i][1] === 1 ? 0 : UV[i][1])))) * 65535);
		const tt = norm(Tv[i]);
		for (let k = 0; k < 3; k++) { tn[i * 8 + k] = Math.round(tt[k] * 127); tn[i * 8 + 4 + k] = Math.round(nrm[i][k] * 127); }
		// 255 at the root, 0 from a few centimetres out
		rt[i] = Math.round(255 * (1 - Math.min(1, Math.max(0, (dist[i] - (beard ? 0.002 : 0.004)) / (beard ? 0.02 : 0.035)))));
	}
	tris.forEach((t, i) => idx.set(t, i * 3));
	const bin = Buffer.concat([len, H, ...[wts, refs, off, uv, tn, rt, idx].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength))]);
	const gz = zlib.gzipSync(bin, { level: 9 });
	fs.writeFileSync(path.join(OUT, id + '.bin.gz'), gz);
	console.log(id.padEnd(11), 'verts', String(nv).padStart(6), 'tris', String(nt).padStart(6), tris0 > nt ? '(of ' + tris0 + ')' : '', 'geo', (gz.length / 1024).toFixed(0).padStart(4) + 'k', 'tex', (T.bytes / 1024).toFixed(0).padStart(4) + 'k', 'grain', T.along, 'maxOff', maxOff.toFixed(3));
	return gz.length + T.bytes;
}

// the lower face, thinned, for the beards grown from the skin (hairkit.js): the base mesh's
// own vertices over the cheeks, the lips, the chin and under it, far fewer triangles
async function shells() {
	const uvOf = new Map(), tri = [];
	const inFace = (v) => { const X = base[v * 3], Y = base[v * 3 + 1] - eyeY, Z = base[v * 3 + 2] - eyeZ; return Y < 0.025 && Y > -0.19 && Z > -0.105 && Math.abs(X) < 0.09; };
	for (let i = 0; i < bodyF.length; i += 6) {
		const t = [bodyF[i], bodyF[i + 2], bodyF[i + 4]];
		if (!t.every(inFace)) continue;
		t.forEach((v, k) => { if (!uvOf.has(v)) uvOf.set(v, bodyF[i + k * 2 + 1]); });
		tri.push(t);
	}
	const ids = [...uvOf.keys()], local = new Map(ids.map((v, i) => [v, i]));
	await MeshoptSimplifier.ready;
	const [ind] = MeshoptSimplifier.simplify(Uint32Array.from(tri.flat().map((v) => local.get(v))), Float32Array.from(ids.flatMap((v) => [base[v * 3], base[v * 3 + 1], base[v * 3 + 2]])), 3, 2600 * 3, 0.005, ['LockBorder']);
	const keep = [...new Set(ind)], at = new Map(keep.map((v, i) => [v, i]));
	const vid = Uint16Array.from(keep.map((i) => ids[i])), uvid = Uint16Array.from(keep.map((i) => uvOf.get(ids[i]))), idx = Uint16Array.from([...ind].map((i) => at.get(i)));
	const nv = vid.length, nt = idx.length / 3;
	const H = pad4(Buffer.from(JSON.stringify({ nv, nt }))), len = Buffer.alloc(4);
	len.writeUInt32LE(H.length);
	fs.writeFileSync(path.join(OUT, 'shells.bin.gz'), zlib.gzipSync(Buffer.concat([len, H, Buffer.from(vid.buffer), Buffer.from(uvid.buffer), Buffer.from(idx.buffer)]), { level: 9 }));
	console.log('shells', 'tris', nt, 'of', tri.length, 'verts', nv);
}

fs.mkdirSync(OUT, { recursive: true });
await shells();
let total = 0;
for (const e of LIST) total += await bake(e);
console.log('total', (total / 1048576).toFixed(2), 'MB');
