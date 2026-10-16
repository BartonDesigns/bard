// The phone audit's budgets (docs/phone-audit-2026-10-15.md): the skin's noise on a phone (a
// small 3D texture, fewer octaves, none on the lowest tiers), the hands refined only where it
// shows on a phone, the broken walls' vertex caps and coarser trace, the rebuild site's LOD
// distances, the storefronts' and the staff spots' shares by tier. Each is checked to leave a
// desktop on the high tier exactly as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { skinMaterial, skinVariant, skinDetail, skinNoiseData, SKIN_NOISE_N } from '../src/people/skin.js';
import { refineHandSurface, handRefine } from '../src/people/hand-surface.js';
import { wallQuality, buildWithin } from '../src/structures/walls/index.js';
import { createWallMesher, DETAIL } from '../src/structures/walls/mesh.js';
import { layersFor, studsFor } from '../src/structures/walls/assembly.js';
import { createPiece, strike } from '../src/structures/walls/cells.js';
import { rebuildLodScale } from '../src/structures/rebuild.js';
import { frontShare } from '../src/economy/storefront.js';
import { TIERS, setTier, peopleCap } from '../src/world/governor.js';
import { CAR_ATLAS, carFaces } from '../src/signage/cars.js';
import { createAtlas } from '../src/signage/atlas.js';
import { refineCloth } from '../src/people/garment.js';

const TIER_NAMES = TIERS.map((t) => t.name);

// a small preprocessor: the lines a set of defines keeps (#ifdef, #ifndef, #if defined(...) || ...,
// #else, #endif; any other #if is taken as true)
function active(src, defines) {
	const out = [], stack = [];
	const on = () => stack.every((s) => s.on);
	for (const line of src.split('\n')) {
		const t = line.trim();
		let m;
		if ((m = t.match(/^#ifdef\s+(\w+)/))) { stack.push({ on: defines.has(m[1]), was: false }); continue; }
		if ((m = t.match(/^#ifndef\s+(\w+)/))) { stack.push({ on: !defines.has(m[1]), was: false }); continue; }
		if (t.startsWith('#if ')) {
			const terms = [...t.matchAll(/defined\(\s*(\w+)\s*\)/g)].map((q) => q[1]);
			stack.push({ on: /^#if\s+defined/.test(t) && /\|\|/.test(t) ? terms.some((d) => defines.has(d)) : /^#if\s+defined/.test(t) ? terms.every((d) => defines.has(d)) : true });
			continue;
		}
		if (t.startsWith('#else')) { const s = stack[stack.length - 1]; s.on = !s.on; continue; }
		if (t.startsWith('#endif')) { stack.pop(); continue; }
		if (on()) out.push(line);
	}
	return out.join('\n');
}
// the value-noise lookups a skin program makes per pixel (call sites, not the definition)
function lookups(closeup, phone) {
	const m = skinMaterial(null, new T.Color(0.8, 0.6, 0.5), 40, { closeup });
	const L = T.ShaderLib.physical, sh = { vertexShader: L.vertexShader, fragmentShader: L.fragmentShader, uniforms: {} };
	// (the variant is chosen by the device: compile both by hand from the same source)
	m.onBeforeCompile(sh);
	const V = skinVariant({ closeup, phone });
	const body = sh.fragmentShader.replace(/^(#define \w+\n)+/, '');
	const code = active(body, new Set(V.defines));
	// (the vitiligo's two, for the one person in a hundred who has it, left out of the count)
	const counted = code.split('\n').filter((l) => !/uVit/.test(l)).join('\n');
	return { n: (counted.match(/\bsn3\s*\(/g) || []).length - (counted.match(/float\s+sn3\s*\(/g) || []).length, code };
}

test('skin: a desktop on the high tier draws what it did; phones fetch their noise from a texture, and fewer of it', () => {
	assert.deepEqual(skinDetail('high', false), { detail: 1, far: 8, octaves: 1 });
	assert.ok(!skinVariant({ phone: false }).defines.includes('SKIN_PHONE') && !skinVariant({ closeup: true, phone: false }).defines.includes('SKIN_PHONE'));
	assert.ok(skinVariant({ phone: true }).defines.includes('SKIN_PHONE') && skinVariant({ closeup: true, phone: true }).defines.includes('SKIN_PHONE'));
	const dHero = lookups(true, false), dCrowd = lookups(false, false), pHero = lookups(true, true), pCrowd = lookups(false, true);
	assert.equal(dCrowd.n, 7, 'the crowd on a desktop: as it was');
	assert.equal(dHero.n, 18, 'your hands on a desktop: as they were');
	assert.ok(pHero.n <= 6, 'your hands on a phone: ' + pHero.n);
	assert.ok(pCrowd.n <= 2, 'the crowd on a phone: ' + pCrowd.n);
	// (a phone's lookups are a texture fetch, a desktop's the hash)
	assert.ok(/texture\(\s*uSkinN/.test(pHero.code) && !/sh3\(i \+ vec3\(1, 1, 1\)\)/.test(pHero.code));
	assert.ok(!/uSkinN/.test(dHero.code));
});

test('skin: the lower tiers draw less of it, a phone\'s minimal tier no pores at all', () => {
	for (const phone of [false, true]) {
		const d = TIER_NAMES.map((t) => skinDetail(t, phone));
		for (let i = 1; i < d.length; i++) { assert.ok(d[i].far <= d[i - 1].far); assert.ok(d[i].detail < d[i - 1].detail); assert.ok(d[i].octaves <= d[i - 1].octaves); }
		assert.equal(d[0].octaves, 1); assert.equal(d[3].octaves, 0);
	}
	assert.equal(skinDetail('minimal', true).far, 0);
	// the noise texture: 64 to a side, one byte each, spread over the whole range
	const N = skinNoiseData();
	assert.equal(N.length, SKIN_NOISE_N ** 3);
	let sum = 0, lo = 255, hi = 0;
	for (const v of N) { sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
	assert.ok(Math.abs(sum / N.length - 127.5) < 3 && lo === 0 && hi === 255);
});

// a flat grid of n x n quads in xy, each split in two, with the left half "the hand"
function grid(n) {
	const pos = [], nor = [], si = [], sw = [], ix = [];
	for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) { pos.push(x, y, 0); nor.push(0, 0, 1); si.push(0, 0, 0, 0); sw.push(1, 0, 0, 0); }
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = y * (n + 1) + x, b = a + 1, c = a + n + 1, d = c + 1; ix.push(a, b, d, a, d, c); }
	const g = new T.BufferGeometry();
	g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
	g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
	g.setIndex(ix);
	return { g, ix, isHand: (v) => (v % (n + 1)) < n / 2 };
}
function edgeUse(ix) {
	const m = new Map();
	for (let i = 0; i < ix.length; i += 3) for (let e = 0; e < 3; e++) { const a = ix[i + e], b = ix[i + (e + 1) % 3], k = a < b ? a + ':' + b : b + ':' + a; m.set(k, (m.get(k) || 0) + 1); }
	return m;
}
test('hands: a phone refines the fingers alone, with no cracks where they meet the hand', () => {
	const n = 8, { g, ix, isHand } = grid(n);
	const full = refineHandSurface(g, ix, 1), part = refineHandSurface(g, ix, 1, isHand), none = refineHandSurface(g, ix, 0);
	const tris = (q) => q.index.count / 3;
	assert.equal(tris(full), tris(none) * 4);
	assert.ok(tris(part) > tris(none) && tris(part) < tris(full) * 0.75, `${tris(none)} < ${tris(part)} < ${tris(full)}`);
	// every edge inside the square is shared by two triangles (a T-junction would leave one), the
	// border's by one, and the area is the same
	const P = part.attributes.position, onBorder = (v) => { const x = P.getX(v), y = P.getY(v); return x < 1e-6 || y < 1e-6 || x > n - 1e-6 || y > n - 1e-6; };
	for (const [k, c] of edgeUse(part.index.array)) {
		const [a, b] = k.split(':').map(Number), border = onBorder(a) && onBorder(b) && (Math.abs(P.getX(a) - P.getX(b)) < 1e-6 || Math.abs(P.getY(a) - P.getY(b)) < 1e-6);
		assert.equal(c, border ? 1 : 2, 'edge ' + k);
	}
	let area = 0;
	const I = part.index.array;
	for (let i = 0; i < I.length; i += 3) { const ax = P.getX(I[i]), ay = P.getY(I[i]), bx = P.getX(I[i + 1]), by = P.getY(I[i + 1]), cx = P.getX(I[i + 2]), cy = P.getY(I[i + 2]); area += ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2; }
	assert.ok(Math.abs(area - n * n) < 1e-6, 'area ' + area + ' (every triangle wound as before)');
	// who gets which: the desktop all of it, a phone the fingers, the lowest tiers none
	const body = { skin: { geometry: g }, bones: [{ name: 'finger2-1.R' }] };
	assert.deepEqual(handRefine(body, { phone: false, ratio: 1 }), { passes: 1, only: null });
	assert.equal(handRefine(body, { phone: true, ratio: 0.85 }).passes, 1);
	assert.equal(typeof handRefine(body, { phone: true, ratio: 0.85 }).only, 'function');
	assert.equal(handRefine(body, { phone: true, ratio: 0.7 }).passes, 0);
});

test('walls: a desktop on the high tier as before; phones and the lower tiers capped and coarser', () => {
	const hi = wallQuality(false, 'high');
	assert.equal(hi.cs, 0.09); assert.equal(hi.lvl, 0); assert.equal(hi.maxVerts, Infinity); assert.equal(hi.budget, Infinity);
	let prev = hi;
	for (const t of ['medium', 'low', 'minimal']) { const q = wallQuality(false, t); assert.ok(q.lvl >= prev.lvl && q.maxVerts <= prev.maxVerts && q.budget <= prev.budget && q.cs >= prev.cs, t); prev = q; }
	const ph = wallQuality(true, 'medium');
	assert.ok(ph.lvl >= 1 && Number.isFinite(ph.maxVerts) && Number.isFinite(ph.budget) && ph.cs >= 0.15);
	// stepping down a level at a time past the cap, and the coarsest at once past the budget
	const fake = (counts) => (o) => [{ geometry: { attributes: { position: { count: counts[DETAIL.indexOf(o)] } }, dispose() {} } }];
	assert.equal(buildWithin(fake([30000, 12000, 5000]), { lvl: 0, maxVerts: 8000, budget: 60000 }, 0).lvl, 2);
	assert.equal(buildWithin(fake([30000, 7000, 5000]), { lvl: 0, maxVerts: 8000, budget: 60000 }, 0).lvl, 1);
	assert.equal(buildWithin(fake([30000, 7000, 5000]), { lvl: 0, maxVerts: 8000, budget: 60000 }, 60000).lvl, 2);
	assert.equal(buildWithin(fake([300000, 7000, 5000]), hi, 1e9).lvl, 0, 'no cap on the high tier');
	// the real wall: each level fewer vertices than the one before
	const M = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? new T.MeshStandardMaterial({ vertexColors: true }) : undefined) });
	const mesher = createWallMesher({ atlas: new T.Texture(), lath: new T.Texture() });
	for (const asm of ['stuccoTract', 'stuccoPrewar']) {
		const stack = layersFor(asm, 1, 1.16, -1), cav = stack.layers.find((l) => l.m === 'cavity');
		const pc = { u0: 0, u1: 3, y0: 0, y1: 2.6, keys: ['paint', 'stucco'], cols: [[0.9, 0.9, 0.9], [0.8, 0.7, 0.6]], trims: [null, null], studs: cav ? studsFor(0, 3, 0, cav.spacing) : [], top: true, floor: 0 };
		const P = createPiece({ u0: 0, u1: 3, y0: 0, y1: 2.6, studs: pc.studs, cs: 0.1, stack });
		for (let i = 0; i < 40; i++) strike(P, { u: 0.3 + (i * 0.618 % 1) * 2.4, v: 0.3 + (i * 0.382 % 1) * 2, side: i % 2, kind: 'ball', energy: 58 });
		strike(P, { u: 1.5, v: 1.2, side: 0, kind: 'blast', energy: 1200, r: 0.5 });
		const Wl = { axis: 'x', a0: 1, a1: 1.16, s: 0, e: 3, y1: 2.6, floor: 0, stack, pieces: [pc], cells: [P], seed: 7, wired: true, wet: false, capCol: [1, 1, 1] };
		const v = DETAIL.map((o) => mesher.build(Wl, M, o).reduce((s, m) => s + m.geometry.attributes.position.count, 0));
		const v0 = mesher.build(Wl, M).reduce((s, m) => s + m.geometry.attributes.position.count, 0);
		assert.equal(v[0], v0, 'the first level is the build as it was');
		assert.ok(v[1] < v[0] * 0.6 && v[2] < v[1], `${asm}: ${v.join(' > ')}`);
	}
});

test('rebuild site, storefronts and staff: nearer and fewer down the tiers, as made on a desktop\'s high tier', () => {
	assert.equal(rebuildLodScale(false, 1), 1);
	assert.ok(rebuildLodScale(true, 1) < 1);
	const fars = TIERS.map((t) => t.far);
	for (let i = 1; i < fars.length; i++) assert.ok(rebuildLodScale(true, fars[i]) < rebuildLodScale(true, fars[i - 1]));
	assert.equal(frontShare(TIERS[0]), 1); assert.equal(frontShare(TIERS[1]), 1);
	assert.ok(frontShare(TIERS[2]) < 1 && frontShare(TIERS[3]) < frontShare(TIERS[2]) && frontShare(TIERS[3]) > 0.4);
	setTier(0); assert.equal(peopleCap(8, 1), 8);
	setTier(3); assert.ok(peopleCap(8, 1) < 8 && peopleCap(3, 1) >= 1);
	setTier(0);
});

test('the cars\' decal sheet: a phone\'s is a third smaller, and every locale\'s pools still fit it whole', () => {
	assert.deepEqual(CAR_ATLAS.desktop, { size: 2048, height: 1024, scale: 1 });
	assert.ok(CAR_ATLAS.phone.size * CAR_ATLAS.phone.height < 1024 * 1024);
	for (const locale of ['us-ca', 'us-tx', 'mx', 'de', 'fr', 'uk', 'jp', 'au']) {
		const want = carFaces(locale), A = createAtlas(CAR_ATLAS.phone);
		A.sync(want);
		const i = A.info();
		assert.equal(i.repacks, 0, locale + ' packed without a repack');
		assert.equal(i.faces, want.size, locale + ' every face in');
	}
});

test('clothes: the curved split of the upper garments on a desktop\'s high and medium tiers only', () => {
	assert.equal(refineCloth(false, 0), true);
	assert.equal(refineCloth(false, 1), true);
	assert.equal(refineCloth(false, 2), false);
	assert.equal(refineCloth(true, 0), false);
});
