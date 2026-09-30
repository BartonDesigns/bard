// Hair and beards from real assets: hairstyles, beards and moustaches made for the MakeHuman
// base mesh (CC0 and CC-BY, assets/people/CREDITS.md), baked by tools/bake-people-hair.mjs.
// Each vertex of a style is tied to three of the body's own vertices and an offset, as
// MakeHuman's proxies are, so the hair sits on each head as its shape has it, and rides the
// bones those vertices ride (the head, and the neck and shoulders for long hair). A style
// is fetched when someone first wears it (the procedural hair of hair.js stands in till it
// comes). Short beards, goatees and chinstraps are grown here from the skin itself: shells
// over the jaw, the chin and the lip, strands cut from them in the shader; a shadow of
// stubble is painted on the skin (skin.js). The hair is one mesh a head, drawn by one
// shader with the style's texture: grey strands and alpha, tinted by the person's own
// colour, darker at the root, lit with the two highlights hair has (Kajiya-Kay, along the
// strands), edges softened by alpha to coverage. A beard is one more, drawn blended after
// the face, so its soft edges stay soft.

import * as THREE from 'three';

const DIR = new URL('../assets/people/hair/', import.meta.url).href;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- the styles ----------
// how each grows: straight, wavy, curly or coily (for how much it shines)
export const STYLES = {
	short01: 'straight', short02: 'straight', short03: 'straight', short04: 'straight', grump: 'wavy', afro01: 'coily', puffs: 'coily',
	bob01: 'straight', bob02: 'straight', shortdaisy: 'straight', curlybob: 'curly', wavybob: 'curly', katherine: 'straight', tousled: 'wavy',
	long01: 'straight', hazel: 'straight', daisy: 'straight', adrienne: 'straight', hippy: 'straight', island: 'wavy', keylth: 'straight',
	ponytail01: 'straight', braid01: 'straight', updo50s: 'wavy', braidbun: 'straight',
};
// the cuts (hair.js CUTS, chosen by wardrobe.js) as the styles that make them: [id, weight,
// how far it stands off the head (1 as made), clipped to a fade]
const FOR_CUT = {
	crop: [['short02', 2, 0.8], ['short04', 1.5, 0.85], ['short01', 1, 0.75]],
	short: [['short02', 2], ['short01', 1.5], ['short04', 1.5], ['short03', 0.6]],
	textured: [['short01', 2, 1, 0.6], ['grump', 1, 0.8, 0.6], ['short04', 1, 1.05, 0.6]],
	fade: [['short04', 1.5, 0.75, 1], ['short02', 1, 0.7, 1], ['short03', 1, 0.75, 1]],
	quiff: [['short01', 2, 1.1, 0.8], ['short04', 1, 1.15, 0.8]],
	curls: [['grump', 1.5], ['curlybob', 1, 0.8], ['afro01', 1, 0.55]],
	coils: [['afro01', 3, 0.45, 0.5]],
	afro: [['afro01', 3, 1.35], ['puffs', 1]],
	bun: [['updo50s', 1.5], ['braidbun', 1], ['ponytail01', 0.4]],
	pony: [['ponytail01', 3], ['braid01', 1]],
	bob: [['bob01', 1.5], ['bob02', 1], ['shortdaisy', 1.5]],
	lob: [['katherine', 1.2], ['shortdaisy', 1], ['tousled', 0.8], ['bob01', 0.5]],
	long: [['long01', 1.5], ['hazel', 1.2], ['daisy', 1], ['adrienne', 1], ['hippy', 0.8], ['keylth', 0.6]],
	waves: [['island', 1.5], ['tousled', 1.2]],
	pixie: [['short03', 2], ['bob02', 0.3, 0.8]],
	fringe: [['bob02', 1.5], ['katherine', 1.2]],
	slick: [['short02', 1, 0.8], ['short03', 1]],
	thinning: [['short02', 1, 0.7], ['short04', 1, 0.7]],
};
// for men: the longer cuts in the styles that suit them
const MAN = { long: [['keylth', 1.5], ['long01', 0.6], ['tousled', 1]], lob: [['tousled', 1.5], ['grump', 1]], waves: [['tousled', 1.5], ['grump', 0.5]], bun: [['keylth', 1]], curls: [['grump', 2], ['afro01', 1, 0.55]] };
// curly and coily hair in the cuts that suit it
const CURLY = { long: [['island', 1], ['tousled', 1]], bob: [['curlybob', 1.5], ['wavybob', 1]], lob: [['curlybob', 1], ['tousled', 1]], pony: [['puffs', 1], ['ponytail01', 1]], bun: [['puffs', 1.2], ['braidbun', 1], ['updo50s', 0.6]] };

const pickW = (r, L) => { let x = r() * L.reduce((a, b) => a + b[1], 0); for (const e of L) { if ((x -= e[1]) < 0) return e; } return L[0]; };
// the style for a person's cut (null: the cut is grown procedurally, as locs and braids are)
export function styleFor(d, H, cutName, r) {
	// (a style asked for by name)
	if (H.style) return STYLES[H.style] ? { id: H.style, vol: H.vol ?? 1, fade: H.fadeK || 0, thin: H.thin || 0 } : null;
	const coily = /^(coils|afro)$/.test(cutName) || (d.ancestry?.[0] || 0) > 0.55;
	let L = FOR_CUT[cutName];
	if (!L) return null;
	if (d.male && MAN[cutName]) L = MAN[cutName];
	else if (coily && !d.male && CURLY[cutName]) L = CURLY[cutName];
	const e = pickW(r, L);
	return { id: e[0], vol: (e[2] ?? 1) * (d.child ? 0.9 : 1), fade: e[3] || 0, thin: H.thin || 0 };
}

// beards: who has one, and which. Only grown men; more of them in the middle years, longer
// and greyer with age; how thick a beard grows varies between people, so the full ones are a
// little rarer where it tends to grow sparse. [kind, weight]; imported ones by their id
const BEARDS = {
	young: [['none', 5], ['stubble', 4], ['short', 1.6], ['goatee', 0.8], ['moustache', 0.3], ['circle', 0.6], ['chinstrap', 0.4], ['full', 0.5], ['scruffy', 0.2]],
	mid: [['none', 4.5], ['stubble', 2.5], ['short', 2], ['full', 1.2], ['goatee', 0.8], ['circle', 0.8], ['moustache', 0.6], ['scruffy', 0.4], ['viking', 0.2]],
	old: [['none', 5.5], ['stubble', 1], ['short', 1.4], ['full', 1.2], ['moustache', 1.2], ['circle', 0.5], ['scruffy', 0.4], ['viking', 0.3]],
};
export const SHELLS = { short: { len: 0.004, layers: 3 }, full: { len: 0.008, layers: 4 }, goatee: { len: 0.006, layers: 3 }, circle: { len: 0.005, layers: 3 }, chinstrap: { len: 0.004, layers: 3 } };
export function beardFor(d, H, r) {
	if (H.beard !== undefined) return H.beard ? { kind: H.beard, stubble: H.beard === 'stubble' ? 0.7 : 0.35, asset: !SHELLS[H.beard] && H.beard !== 'stubble' } : null;
	if (!d.male || d.child || d.age < 18) return null;
	const L = BEARDS[d.age < 30 ? 'young' : d.age < 55 ? 'mid' : 'old'];
	const sparse = (d.ancestry?.[1] || 0) > 0.6 ? 0.6 : 1;
	const e = pickW(r, L.map(([k, w]) => [k, /^(full|scruffy|viking|short)$/.test(k) ? w * sparse : w]));
	if (e[0] === 'none') return null;
	// a shadow of stubble under every beard, a heavier one on its own
	return { kind: e[0], stubble: e[0] === 'stubble' ? 0.5 + r() * 0.4 : 0.35, asset: !SHELLS[e[0]] && e[0] !== 'stubble' };
}

// ---------- loading ----------
const cache = new Map();
export const styleNow = (id) => cache.get(id)?.data || null;
export function loadStyle(id) {
	let c = cache.get(id);
	if (c) return c.promise;
	c = { data: null };
	c.promise = (async () => {
		const res = await fetch(DIR + id + '.bin.gz');
		if (!res.ok) throw Error('hair ' + id + ' ' + res.status);
		const buf = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
		if (id === 'shells') { c.data = parseShells(buf); return c.data; }
		const tex = await new THREE.TextureLoader().loadAsync(DIR + id + '.webp');
		tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
		tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
		c.data = parse(buf, tex);
		return c.data;
	})();
	c.promise.catch(() => {});
	cache.set(id, c);
	return c.promise;
}
// the thinned lower face: its vertices (the base mesh's), their texture coordinates, triangles
function parseShells(buf) {
	const hl = new DataView(buf).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
	const o = 4 + hl;
	return { nv: h.nv, vid: new Uint16Array(buf, o, h.nv), uvid: new Uint16Array(buf, o + h.nv * 2, h.nv), idx: new Uint16Array(buf, o + h.nv * 4, h.nt * 3) };
}
function parse(buf, tex) {
	const hl = new DataView(buf).getUint32(0, true);
	const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
	let o = 4 + hl;
	const take = (T, n) => { const a = new T(buf, o, n); o += n * T.BYTES_PER_ELEMENT; return a; };
	const nv = h.nv, nt = h.nt;
	return { ...h, tex, wts: take(Float32Array, nv * 3), refs: take(Uint16Array, nv * 3), off: take(Int16Array, nv * 3), uv: take(Uint16Array, nv * 2), tn: take(Int8Array, nv * 8), root: take(Uint8Array, nv + ((4 - nv % 4) % 4)), idx: take(Uint16Array, nt * 3) };
}

// ---------- fitting to a person ----------
// the bones hair may ride: the root, the spine, the neck, the head, the collarbones (the
// arms' pull on the shoulders is left out, so long hair does not swing with them)
const RIDE = new Set(['root', 'spine04', 'spine02', 'spine01', 'neck01', 'head', 'clavicle.L', 'clavicle.R']);
const MORPHS = [['eye-left-closure', 'eye-right-closure'], ['mouth-open'], ['mouth-corner-puller'], ['eyebrows-left-up', 'eyebrows-right-up']];

// what a style has the same on everyone, worked out once: its normals, strand directions,
// texture coordinates and root shade, and the bones it rides (each tie's own, by how much
// the tie counts), and for a beard how it moves with the mouth (for the base mesh's size)
function fixed(A, St, kind) {
	if (St.fix) return St.fix;
	const { nv, refs, wts, uv, tn, root } = St, ride = A.ride, head = A.bones.findIndex((b) => b.name === 'head');
	const N = new Float32Array(nv * 3), T = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), K = new Float32Array(nv * 3), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
	const bi = new Int32Array(13), bw = new Float32Array(13);
	const eyeB = [...A.D.eyes.L, ...A.D.eyes.R].reduce((a, i) => a + A.base[i * 3 + 1] * A.unit, 0) / (A.D.eyes.L.length + A.D.eyes.R.length);
	for (let v = 0; v < nv; v++) {
		let n = 0;
		for (let k = 0; k < 3; k++) {
			const r = refs[v * 3 + k], w = Math.abs(wts[v * 3 + k]);
			let s = 0; for (let q = 0; q < 4; q++) s += A.weights[r * 4 + q];
			for (let q = 0; q < 4; q++) {
				const b = A.ids[r * 4 + q], x = A.weights[r * 4 + q] / (s || 1) * w;
				if (!(x > 0) || !ride[b]) continue;
				let j = 0; while (j < n && bi[j] !== b) j++;
				if (j === n) { bi[n] = b; bw[n++] = 0; }
				bw[j] += x;
			}
		}
		// (down to the jaw it rides the head alone, so side locks turn with the face and never
		// into it; below, more and more the neck and shoulders)
		let yb = 0;
		for (let k = 0; k < 3; k++) yb += wts[v * 3 + k] * A.base[refs[v * 3 + k] * 3 + 1] * A.unit;
		const hk = sm(eyeB - 0.17, eyeB - 0.1, yb);
		let tot = 0; for (let j = 0; j < n; j++) tot += bw[j];
		for (let j = 0; j < n; j++) bw[j] *= (1 - hk) / (tot || 1);
		let hj = 0; while (hj < n && bi[hj] !== head) hj++;
		if (hj === n) { bi[n] = head; bw[n++] = 0; }
		bw[hj] += hk + (tot ? 0 : 1 - hk);
		// the four that count most
		let tw = 0;
		for (let q = 0; q < 4; q++) {
			let best = -1; for (let j = 0; j < n; j++) if (bw[j] > 0 && (best < 0 || bw[j] > bw[best])) best = j;
			if (best < 0) break;
			SI[v * 4 + q] = bi[best]; SW[v * 4 + q] = bw[best]; tw += bw[best]; bw[best] = 0;
		}
		if (!tw) { SI[v * 4] = head; SW[v * 4] = 1; } else for (let q = 0; q < 4; q++) SW[v * 4 + q] /= tw;
		for (let c = 0; c < 3; c++) { N[v * 3 + c] = tn[v * 8 + 4 + c] / 127; T[v * 3 + c] = tn[v * 8 + c] / 127; }
		UV[v * 2] = uv[v * 2] / 65535; UV[v * 2 + 1] = uv[v * 2 + 1] / 65535;
		K[v * 3] = root[v] / 255; K[v * 3 + 1] = kind; K[v * 3 + 2] = 1;
	}
	// a beard opens and smiles with the mouth
	let M = null;
	if (kind === 1) M = MORPHS.map((names) => {
		const d = new Float32Array(nv * 3);
		for (const nm of names) {
			const t = A.targets[nm]; if (!t) continue;
			for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) { const r = refs[v * 3 + k], w = wts[v * 3 + k] * A.unit; d[v * 3] += t[r * 3] * w; d[v * 3 + 1] += t[r * 3 + 1] * w; d[v * 3 + 2] += t[r * 3 + 2] * w; }
		}
		return d;
	});
	// the style's pieces (its cards, each a run of joined triangles), so a piece is moved
	// off the face all one way
	const up = new Int32Array(nv).map((x, i) => i), find = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
	for (let i = 0; i < St.idx.length; i += 3) { const a = find(St.idx[i]); up[find(St.idx[i + 1])] = a; up[find(St.idx[i + 2])] = a; }
	const piece = new Int32Array(nv);
	for (let v = 0; v < nv; v++) piece[v] = find(v);
	St.fix = { N, T, UV, K, SI, SW, M, I: St.idx, piece };
	return St.fix;
}

// the face, to keep hair off it: in 4 mm steps of height (from under the chin to the brows),
// how far to either side this body's skin reaches in front of the ears, and how far forward
// it comes at each distance out from the middle, or further out
const FG = 0.004, FNY = 48, FNX = 30;
function faceFront(P, p) {
	if (P.faceFront && P.faceFront.p === p) return P.faceFront;
	const K = P.skull, y0 = K.eyeY - 0.19, W = new Float32Array(FNY), Z = new Float32Array(FNY * FNX).fill(-9);
	for (let v = 0; v < p.length / 3; v++) {
		const x = Math.abs(p[v * 3] - K.c.x), z = p[v * 3 + 2], yi = Math.floor((p[v * 3 + 1] - y0) / FG), xi = Math.floor(x / FG);
		if (yi < 0 || yi >= FNY || xi >= FNX || z < K.eyeZ - 0.12) continue;
		if (z > K.eyeZ - 0.07) W[yi] = Math.max(W[yi], x);
		Z[yi * FNX + xi] = Math.max(Z[yi * FNX + xi], z);
	}
	for (let yi = 0; yi < FNY; yi++) for (let xi = FNX - 2; xi >= 0; xi--) Z[yi * FNX + xi] = Math.max(Z[yi * FNX + xi], Z[yi * FNX + xi + 1]);
	P.faceFront = { p, W, Z, y0 };
	return P.faceFront;
}
// where a hair vertex (V[o..o+2]) is against the face below the eyes, into out: how much
// it is to be moved off it (all of it beside the face, less and less below the chin and up
// to the eyes, none behind the ears), how far out the face's side is there, and how far it
// is in front of the cheek's edge
function offFace(FF, K, V, o, out) {
	const y = V[o + 1], yi = Math.floor((y - FF.y0) / FG), w = yi >= 0 && yi < FNY ? FF.W[yi] : 0;
	out[0] = w ? sm(FF.y0, K.eyeY - 0.12, y) * (1 - sm(K.eyeY - 0.035, K.eyeY - 0.01, y)) * sm(K.eyeZ - 0.085, K.eyeZ - 0.065, V[o + 2]) : 0;
	out[1] = w + 0.004;
	out[2] = out[0] > 0 ? Math.max(0, V[o + 2] - FF.Z[yi * FNX + Math.min(FNX - 1, Math.floor(w / FG))] - 0.006) : 0;
}

// a style tied onto this body (p: its vertices; vol scales how far the hair stands off the
// head): the ties' own vertices, and the offset, scaled as the body is
function styleChunk(A, P, p, St, kind, vol, fadeY = -99) {
	const { nv, refs, wts, off, den, sref } = St, F = fixed(A, St, kind);
	const sc = [0, 1, 2].map((a) => { const [i, j] = sref[a]; return (i === j ? P._S : Math.abs(p[i * 3 + a] - p[j * 3 + a]) / den[a]) * vol / 40000; });
	const V = new Float32Array(nv * 3), K = P.skull, d = new THREE.Vector3(), FF = kind === 0 && faceFront(P, p);
	for (let v = 0; v < nv; v++) {
		let x = 0, y = 0, z = 0;
		for (let k = 0; k < 3; k++) { const r = refs[v * 3 + k] * 3, w = wts[v * 3 + k]; x += w * p[r]; y += w * p[r + 1]; z += w * p[r + 2]; }
		// (down a fade the hair lies closer, thinning into the painted crop)
		const k = fadeY > -9 ? 0.35 + 0.65 * sm(fadeY - 0.035, fadeY + 0.02, y) : 1;
		V[v * 3] = x + off[v * 3] * sc[0] * k; V[v * 3 + 1] = y + off[v * 3 + 1] * sc[1] * k; V[v * 3 + 2] = z + off[v * 3 + 2] * sc[2] * k;
		// never inside the head: out to its surface (this head's own, all round) and a little
		// more; hair on the brow sits in front of the skin
		if (kind === 0 && V[v * 3 + 1] > K.eyeY - 0.11) {
			d.set(V[v * 3] - K.c.x, V[v * 3 + 1] - K.c.y, V[v * 3 + 2] - K.c.z);
			const r = d.length(), R = K.radius(d.multiplyScalar(1 / (r || 1))) + 0.0035;
			if (r < R) { V[v * 3] = K.c.x + d.x * R; V[v * 3 + 1] = K.c.y + d.y * R; V[v * 3 + 2] = K.c.z + d.z * R; }
		}
	}
	if (FF) {
		// the face kept clear from the front and from either side: each piece of the style (a
		// card) moved as one, out to the side most of it is on (the locks kept in their order
		// in a band beside the cheeks) and back behind the cheek's edge, as far as its part
		// furthest over the face needs, so the cards bend aside whole and never tear or fold;
		// a piece that spans the face goes strand by strand. A fringe is cut at the brows in
		// the shader
		const piece = F.piece, M = new Map(), at = [0, 0, 0], W = new Float32Array(nv * 3), band = 0.015;
		for (let v = 0; v < nv; v++) {
			offFace(FF, K, V, v * 3, at); W.set(at, v * 3);
			const x = V[v * 3] - K.c.x, e = M.get(piece[v]) || [0, 1, -1, 0, 0];
			e[0] += x; e[1] = Math.min(e[1], x); e[2] = Math.max(e[2], x);
			M.set(piece[v], e);
		}
		const sideOf = (v, e) => Math.sign(e[1] < -0.03 && e[2] > 0.03 ? V[v * 3] - K.c.x : e[0]) || 1;
		const out = (v, e) => { const u = (V[v * 3] - K.c.x) * sideOf(v, e), edge = W[v * 3 + 1]; return u < edge + band ? edge + Math.max(0, u) * band / (edge + band) - u : 0; };
		for (let v = 0; v < nv; v++) if (W[v * 3] > 0) { const e = M.get(piece[v]); e[3] = Math.max(e[3], out(v, e)); e[4] = Math.max(e[4], W[v * 3 + 2]); }
		for (let v = 0; v < nv; v++) {
			const k = W[v * 3];
			if (!(k > 0)) continue;
			const e = M.get(piece[v]), wide = e[1] < -0.03 && e[2] > 0.03;
			V[v * 3] += sideOf(v, e) * (wide ? out(v, e) : e[3]) * k;
			V[v * 3 + 2] -= (wide ? W[v * 3 + 2] : e[4]) * k;
		}
	}
	return { ...F, n: nv, V, M: F.M && F.M.map((d) => d.map((x) => x * P._S)) };
}

// ---------- the beard's zones on the face ----------
// per vertex of the head's skin (the base mesh, by where it sits against the eyes): the
// full beard (cheeks below the cheekbone, the jaw, the chin, under it to the throat, the
// upper lip, the sideburns), the chin, the jawline; the lips and the nose
// left bare
function zones(A) {
	if (A.beardZones) return A.beardZones;
	const n = A.base.length / 3, u = A.unit, D = A.D;
	const avg = (ids, a) => ids.reduce((s, i) => s + A.base[i * 3 + a] * u, 0) / ids.length;
	const ey = (avg(D.eyes.L, 1) + avg(D.eyes.R, 1)) / 2, ez = (avg(D.eyes.L, 2) + avg(D.eyes.R, 2)) / 2;
	const full = new Float32Array(n), chin = new Float32Array(n), jaw = new Float32Array(n), x = new Float32Array(n), y = new Float32Array(n);
	const used = new Uint8Array(n);
	for (let i = 0; i < A.body.length; i += 2) used[A.body[i]] = 1;
	for (let v = 0; v < n; v++) {
		if (!used[v]) continue;
		x[v] = A.base[v * 3] * u; y[v] = A.base[v * 3 + 1] * u - ey;
		const X = Math.abs(x[v]), Y = A.base[v * 3 + 1] * u - ey, Z = A.base[v * 3 + 2] * u - ez;
		if (Y > 0.02 || Y < -0.19 || Z < -0.1) continue;
		// the lips (an oval round the mouth) and the mouth's inside
		const lip = Math.hypot(X / 0.027, (Y + 0.0645) / 0.0105);
		const bare = sm(0.9, 1.2, lip) * sm(-0.03, -0.015, Z - (X < 0.035 ? 0.0 : -0.06));
		// the cheek's line, from the sideburn down to the mouth's corner
		// (low at the front, by the mouth, rising back towards the ear)
		const cheek = -0.05 + clamp((0.015 - Z) / 0.08) * 0.036;
		let f = (1 - sm(cheek - 0.006, cheek + 0.004, Y)) * bare;
		// the sideburns, in front of the ear
		if (X > 0.058 && Z > -0.095 && Z < -0.05 && Y < 0.012) f = Math.max(f, (1 - sm(0.0, 0.012, Y)) * sm(0.058, 0.064, X));
		// not behind the jaw, down to the throat
		f *= sm(-0.085, -0.07, Z + (Y < -0.095 ? 0.025 : 0)) * sm(-0.14, -0.115, Y);
		full[v] = f;
		// the chin, below the lower lip, and the corners of the mouth down to it
		chin[v] = (1 - sm(0.02, 0.028, X)) * (1 - sm(-0.078, -0.074, Y)) * sm(-0.125, -0.115, Y) * bare * sm(-0.02, 0, Z);
		// the jawline: along the jaw's edge (where the face turns under), to the sideburns
		const jl = X < 0.055 ? -0.112 + X / 0.055 * 0.025 : -0.087 + (X - 0.055) / 0.015 * 0.06;
		jaw[v] = f * (1 - sm(0.006, 0.012, Math.abs(Y - jl)));
	}
	A.beardZones = { full, chin, jaw, x, y };
	return A.beardZones;
}
// the stubble's shadow on the skin: per vertex of a piece of skin (src: its base vertices)
export function stubbleMask(A, src) {
	const Z = zones(A), out = new Float32Array(src.length);
	for (let i = 0; i < src.length; i++) out[i] = Z.full[src[i]];
	return out;
}
// how much of each zone a beard covers
function beardDensity(Z, kind, v) {
	if (kind === 'goatee') return Z.chin[v];
	if (kind === 'circle') return Math.max(Z.chin[v], Z.full[v] * (1 - sm(0.03, 0.036, Math.abs(Z.x[v]))) * (1 - sm(-0.07, -0.06, Z.y[v])));
	if (kind === 'chinstrap') return Z.jaw[v];
	return Z.full[v];
}

// shells over the skin where the beard grows: each a copy of the lower face a little further
// out (the base mesh's own vertices, thinned: tools/bake-people-hair.mjs), the strands cut
// from it in the shader
function shellChunk(A, P, p, kind, rnd) {
	const Z = zones(A), sh = SHELLS[kind], { nv, vid, uvid, idx } = styleNow('shells'), uvs = A.uv;
	const dens = new Float32Array(nv), nrm = new Float32Array(nv * 3);
	for (let v = 0; v < nv; v++) dens[v] = beardDensity(Z, kind, vid[v]);
	// the triangles with any beard on them; the normals from all
	const tri = [];
	for (let i = 0; i < idx.length; i += 3) {
		const a = idx[i], b = idx[i + 1], c = idx[i + 2], pa = vid[a] * 3, pb = vid[b] * 3, pc = vid[c] * 3;
		const ux = p[pb] - p[pa], uy = p[pb + 1] - p[pa + 1], uz = p[pb + 2] - p[pa + 2], wx = p[pc] - p[pa], wy = p[pc + 1] - p[pa + 1], wz = p[pc + 2] - p[pa + 2];
		const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
		for (const v of [a, b, c]) { nrm[v * 3] += nx; nrm[v * 3 + 1] += ny; nrm[v * 3 + 2] += nz; }
		if (Math.max(dens[a], dens[b], dens[c]) > 0.05) tri.push(a, b, c);
	}
	if (!tri.length) return null;
	const used = [...new Set(tri)], at = new Map(used.map((v, i) => [v, i])), n = used.length;
	const L = sh.layers, grow = sh.len * (0.8 + rnd() * 0.4), seed = rnd() * 50, rideHead = A.bones.findIndex((b) => b.name === 'head');
	const V = new Float32Array(n * L * 3), N = new Float32Array(n * L * 3), T = new Float32Array(n * L * 3), UV = new Float32Array(n * L * 2), K = new Float32Array(n * L * 3), SI = new Uint16Array(n * L * 4), SW = new Float32Array(n * L * 4);
	const M = [0, 1, 2, 3].map(() => new Float32Array(n * L * 3)), I = [];
	for (let l = 0; l < L; l++) {
		// (the first on the skin, just clear of it where the thinned face cuts a corner)
		const k = l / (L - 1), lift = 0.0012 + grow * k;
		for (let j = 0; j < n; j++) {
			const u = used[j], v = vid[u], o = l * n + j;
			let nx = nrm[u * 3], ny = nrm[u * 3 + 1], nz = nrm[u * 3 + 2];
			const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
			// beard hair lies down the face and a little out
			let tx = nx * ny, ty = ny * ny - 1, tz = nz * ny;
			const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
			V[o * 3] = p[v * 3] + (nx + tx * 0.5) * lift; V[o * 3 + 1] = p[v * 3 + 1] + (ny + ty * 0.5) * lift; V[o * 3 + 2] = p[v * 3 + 2] + (nz + tz * 0.5) * lift;
			N.set([nx, ny, nz], o * 3); T.set([tx, ty, tz], o * 3);
			UV[o * 2] = uvs[uvid[u] * 2] / 65535 + seed; UV[o * 2 + 1] = 1 - uvs[uvid[u] * 2 + 1] / 65535;
			K[o * 3] = 1 - k; K[o * 3 + 1] = 2 + l / L; K[o * 3 + 2] = dens[u];
			let s = 0; for (let q = 0; q < 4; q++) s += A.weights[v * 4 + q];
			for (let q = 0; q < 4; q++) { const bi = A.ids[v * 4 + q]; SI[o * 4 + q] = A.ride[bi] ? bi : rideHead; SW[o * 4 + q] = A.weights[v * 4 + q] / (s || 1); }
			for (let m = 0; m < 4; m++) for (const nm of MORPHS[m]) { const tg = A.targets[nm]; if (tg) for (let c = 0; c < 3; c++) M[m][o * 3 + c] += tg[v * 3 + c] * A.unit * P._S; }
		}
		for (const u of tri) I.push(l * n + at.get(u));
	}
	return { n: n * L, V, N, T, UV, K, SI, SW, I, M };
}

// a person's hair, or their beard, as one geometry (in the body's rest frame, skinned to it)
export function hairGeometry(A, P, p, style, beard, rnd) {
	if (!A.ride) A.ride = A.bones.map((b) => RIDE.has(b.name));
	const parts = [];
	if (style) parts.push(styleChunk(A, P, p, styleNow(style.id), 0, style.vol, style.fadeY));
	if (beard?.asset) parts.push(styleChunk(A, P, p, styleNow(beard.kind), 1, 1));
	else if (beard && SHELLS[beard.kind]) parts.push(shellChunk(A, P, p, beard.kind, rnd));
	const C = parts.filter(Boolean);
	if (!C.length) return null;
	const n = C.reduce((a, c) => a + c.n, 0), ni = C.reduce((a, c) => a + c.I.length, 0), morph = C.some((c) => c.M);
	const V = new Float32Array(n * 3), N = new Float32Array(n * 3), T = new Float32Array(n * 3), UV = new Float32Array(n * 2), K = new Float32Array(n * 3), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
	const I = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), M = morph ? [0, 1, 2, 3].map(() => new Float32Array(n * 3)) : null;
	let o = 0, oi = 0;
	for (const c of C) {
		V.set(c.V, o * 3); N.set(c.N, o * 3); T.set(c.T, o * 3); UV.set(c.UV, o * 2); K.set(c.K, o * 3); SI.set(c.SI, o * 4); SW.set(c.SW, o * 4);
		if (M && c.M) for (let m = 0; m < 4; m++) M[m].set(c.M[m], o * 3);
		for (let i = 0; i < c.I.length; i++) I[oi + i] = c.I[i] + o;
		o += c.n; oi += c.I.length;
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(V, 3));
	g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
	g.setAttribute('hairT', new THREE.BufferAttribute(T, 3));
	g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
	g.setAttribute('hairK', new THREE.BufferAttribute(K, 3));
	g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
	g.setIndex(new THREE.BufferAttribute(I, 1));
	if (M) { g.morphTargetsRelative = true; g.morphAttributes.position = M.map((m) => new THREE.BufferAttribute(m, 3)); }
	g.computeBoundingSphere();
	return g;
}

// ---------- the shader ----------
// alpha to coverage wants multisampling: without it (a canvas or target with none), the
// strands are cut clean at half their alpha instead. A beard is drawn blended, after the
// face, so its fine hairs and its soft edges stay soft either way
let msaa = true;
const HEAD = /* glsl */`
uniform vec3 uRoot;
uniform vec3 uTip;
uniform vec3 uGrey;
uniform vec4 uBeard;
uniform vec4 uClip;
uniform vec4 uSalt;
uniform vec3 uHC;
uniform vec2 uFace;
uniform vec2 uSpec;
float hairSpec = 1.0;
varying vec3 vHT;
varying vec3 vHK;
varying vec3 vRest;
float hh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float kk(vec3 T, vec3 H, float e) { float th = dot(T, H); return pow(sqrt(max(0.0, 1.0 - th * th)), e); }
`;
const LIGHT = /* glsl */`
void RE_Direct_Hair( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	// diffuse: soft, lit round the strands; specular: two lobes along them, the second in
	// the hair's own colour and shifted towards the root
	float nl = dot( geometryNormal, directLight.direction );
	vec3 irr = directLight.color * saturate( nl * 0.55 + 0.45 );
	reflectedLight.directDiffuse += irr * BRDF_Lambert( material.diffuseColor );
	vec3 T = normalize( vHT ), H = normalize( directLight.direction + geometryViewDir );
	// (softer and broader far off, where a tight highlight would only shimmer)
	float far = smoothstep( 2.0, 10.0, length( vViewPosition ) );
	float s1 = kk( normalize( T + geometryNormal * 0.12 ), H, mix( 140.0, 36.0, far ) ) * ( 1.0 - far * 0.5 ), s2 = kk( normalize( T - geometryNormal * 0.15 ), H, mix( 24.0, 10.0, far ) ) * ( 1.0 - far * 0.4 );
	float ao = 0.55 + 0.45 * ( 1.0 - vHK.x );
	float vis = saturate( nl + 0.35 ) * ao;
	reflectedLight.directSpecular += directLight.color * vis * hairSpec * ( s1 * 0.05 + s2 * 0.12 * material.diffuseColor * 2.5 );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Hair
`;
const FRAG = /* glsl */`
{
	float kind = vHK.y, a, g;
	vec4 t = texture2D(map, vMapUv);
	// (the strands' own cells: long along them, so what varies by strand varies by hair)
	vec2 cell = floor(vMapUv * (uSalt.z > 0.5 ? vec2(420.0, 18.0) : vec2(18.0, 420.0)));
	if (kind < 1.5) {
		a = t.a; g = t.r;
		// (mipmaps thin the alpha out far off: give it back)
		vec2 dx = dFdx(vMapUv * 512.0), dy = dFdy(vMapUv * 512.0);
		a *= 1.0 + max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy)))) * 0.22;
	} else {
		// a shell of a beard grown from the skin. The first lies on the skin: the shade of
		// the roots, smooth and nearly solid, so between the hairs is beard, not bare skin.
		// The rest: fine hairs running down the face, each its own length, fewer and finer
		// further out; a step or two off, just how much they cover, so the beard reads as
		// one soft mass. Everything thins out, softly, towards the beard's edge
		float l = fract(kind), dn = smoothstep(0.03, 0.8, vHK.z);
		if (l < 0.01) { a = dn * 0.92; g = 0.36; }
		else {
			vec2 q = vMapUv * vec2(420.0, 70.0);
			float col = floor(q.x), jx = hh(vec2(col, 1.3)), off = hh(vec2(col, 7.7)) * 7.0;
			float sq = q.y + off, seg = fract(sq), h1 = hh(vec2(col, floor(sq) + 0.5)), h2 = hh(vec2(floor(sq), col + 0.5));
			// (each clump off the grid a little, and leaning its own way)
			float fx = fract(q.x) - 0.5 - (h1 - 0.5) * 0.5 - (seg - 0.5) * (h2 - 0.5) * 0.7;
			float w = fwidth(q.x), wd = (0.24 + 0.16 * h2) * (1.0 - l * 0.35) * (1.0 - seg * 0.5);
			float across = 1.0 - smoothstep(wd - w, wd + w, abs(fx));
			float along = smoothstep(0.0, 0.1, seg) * (1.0 - smoothstep(0.55 + 0.35 * jx, 0.7 + 0.3 * jx, seg));
			float cover = dn * (1.0 - l * 0.4);
			a = across * along * smoothstep(0.0, 0.35, cover - hh(vec2(col, floor(sq))) * 0.5);
			a = mix(a, cover * 0.8, smoothstep(0.2, 0.6, w));
			// (the hairs of a clump: fine lines along it)
			float fine = 0.85 + 0.15 * sin(fx * 40.0 + jx * 6.0);
			g = (0.38 + 0.14 * hh(vec2(col, floor(sq) + 3.1))) * mix(fine, 1.0, smoothstep(0.2, 0.6, w));
		}
	}
	vec3 col;
	if (kind < 0.5) {
		col = mix(uTip, uRoot, smoothstep(0.6, 1.0, vHK.x));
		// salt and pepper: hairs gone grey among the rest, the temples well ahead of the
		// crown while there are few
		if (uSalt.x > 0.0) col = mix(col, uGrey * (0.85 + g * 0.3), step(hh(cell), clamp(uSalt.x * (0.5 + 1.2 * smoothstep(0.45, 0.85, abs(normalize(vRest - uHC).x))) + uSalt.x * uSalt.x * 0.5, 0.0, 1.0)) * 0.9);
		// cut away under a cap; tapered into the painted crop down a fade, each strand
		// ending at its own height; thin at the crown
		a *= 1.0 - smoothstep(uClip.x - 0.005, uClip.x + 0.004, vRest.y);
		if (uClip.y > -9.0) { vec2 hd = normalize((vRest - uHC).xz); float e = hh(cell + 11.0) * 0.7 + 0.15; a *= mix(1.0, smoothstep(e - 0.3, e + 0.3, smoothstep(uClip.y - 0.05, uClip.y + 0.02, vRest.y)), smoothstep(0.85, 0.6, hd.y)); }
		// the face kept clear: nothing between the brows and the chin in front of the cheeks
		// (a fringe stops at the brows; side locks end, strand by strand, beside the face)
		{
			vec3 fq = vRest - vec3(uHC.x, uFace.x, uFace.y);
			float hw = mix(0.028, 0.062, smoothstep(-0.13, -0.02, fq.y));
			float cl = (1.0 - smoothstep(hw - 0.012, hw, abs(fq.x))) * smoothstep(0.022, 0.014, fq.y) * smoothstep(-0.15, -0.13, fq.y) * smoothstep(-0.045, -0.025, fq.z);
			// (each strand cut clean, at its own place: never a veil of half-there hair)
			float e = hh(cell + 23.0) * 0.6 + 0.2;
			a *= smoothstep(e - 0.03, e + 0.03, 1.0 - cl);
		}
		if (uClip.z > 0.0) a *= 1.0 - uClip.z * 0.85 * smoothstep(0.8, 0.95, dot(normalize(vRest - uHC), normalize(vec3(0.1, 0.9, -0.45)))) * step(0.35, hh(floor(vMapUv * 200.0)));
	} else {
		col = uBeard.rgb * mix(1.0, 0.65, vHK.x);
		// (the chin first; hair by hair close to, the mix of them on the roots' shade and
		// further off)
		if (uSalt.y > 0.0) {
			float s = clamp(uSalt.y * (0.85 + 0.4 * smoothstep(-0.02, -0.06, vRest.y - uHC.y)), 0.0, 1.0);
			float far = kind > 1.5 ? max(step(fract(kind), 0.01), smoothstep(0.2, 0.6, fwidth(vMapUv.x * 420.0))) : 0.0;
			col = mix(col, uGrey, mix(step(hh(floor(vMapUv * vec2(420.0, 70.0)) + 5.0), s), s, far));
		}
	}
	diffuseColor.rgb = col * g * 2.0;
	diffuseColor.a *= a;
	// (the shine: less on curly and coily hair, and between the strands)
	hairSpec = (kind < 0.5 ? uSpec.x : uSpec.y) * (0.4 + 0.6 * g);
}`;
let blank = null;
// hair (tex: the style's texture) or a beard (beard: true; its texture, or none for one
// grown from the skin)
export function kitMaterial(tex, beard = false) {
	if (!tex && !blank) { blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blank.needsUpdate = true; }
	tex = tex || blank;
	const m = beard
		? new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, transparent: true, depthWrite: false })
		: new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, alphaTest: 0.4, alphaToCoverage: true });
	const U = {
		uRoot: { value: new THREE.Color() }, uTip: { value: new THREE.Color() }, uGrey: { value: new THREE.Color() }, uBeard: { value: new THREE.Vector4(0, 0, 0, 1) },
		uClip: { value: new THREE.Vector4(99, -99, 0, 0) }, uSpec: { value: new THREE.Vector2(1, 0.5) }, uSalt: { value: new THREE.Vector4(0, 0, 0, 0) }, uHC: { value: new THREE.Vector3() }, uFace: { value: new THREE.Vector2() },
	};
	m.userData.U = U;
	m.onBeforeCompile = (sh, r) => {
		const rt = r.getRenderTarget(), ms = rt ? rt.samples > 0 : r.getContext().getContextAttributes().antialias;
		if (!ms && msaa) msaa = false;
		if (!msaa && m.alphaToCoverage) m.alphaToCoverage = false;
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 hairT;\nattribute vec3 hairK;\nvarying vec3 vHT;\nvarying vec3 vHK;\nvarying vec3 vRest;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vHK = hairK;')
			.replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\nvec3 hT = hairT;\n#ifdef USE_SKINNING\nhT = (skinMatrix * vec4(hT, 0.0)).xyz;\n#endif\nvHT = normalize(normalMatrix * hT);');
		sh.fragmentShader = (msaa || beard ? '' : '#undef ALPHA_TO_COVERAGE\n') + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAD)
			.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + LIGHT)
			.replace('#include <map_fragment>', FRAG)
			.replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectSpecular *= 0.2 * hairSpec * (1.0 - vHK.x * 0.6);\nreflectedLight.indirectDiffuse *= 1.0 - vHK.x * 0.35;');
	};
	m.customProgramCacheKey = () => 'crysis-hairkit-6' + (beard ? '-b' : msaa ? '' : '-c');
	return m;
}
