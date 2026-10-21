// Decals on the cars: plates in the region's manner (a dealer's frame on some), bumper
// stickers, a parking permit or the region's windscreen sticker, the odd rear-window sticker,
// the brands' stickers (the illustrated marks of the shops and labels, signage/art.js) on the
// boot or tailgate, the street's sticker slaps (graffiti.js) on the back glass, and the
// services' liveries, the police cruisers' doors and roof numbers. Nothing is
// remodelled: each mark is a flat piece laid on the body where the body actually is, found
// once per kind by sampling the lofted body (bay/cars.js) so a plate sits on the curved tail
// and a word on the swell of the door. Plates are retroreflective, like the real ones, and
// light up in your headlights.
//
// The fleets (vehicles/fleet.js) ask for a decal set when they are made; each frame they
// pass each near car through, and the set writes its decals beside it with no allocation.
// The responders' bodies carry their own markings (services/vehicle-model.js).

import * as THREE from 'three';
import { carGeometry, SPEC, specOf } from '../bay/cars.js';
import { createAtlas } from './atlas.js';
import { createBatch } from './batch.js';
import { signMaterial, currentSignMaterial } from './materials.js';
import { LAYER } from './layers.js';
import { hash32, rng, pick } from './rand.js';
import { carDecalSet, POOLS, BACK } from './placement.js';
import { systemFor } from './systems.js';
import { artReady } from './art.js';
import { denied } from '../economy/establishments.js';
import { GFX_PHONE } from '../world/device.js';

const PHONE = GFX_PHONE;

// ---------- the pools, drawn into the cars' own atlas ----------
const DEALERS = ['Crestline Auto Plaza', 'Mission Hill Motors', 'Bayview Auto Group', 'Sunset Coast Motors', 'Ridgeway Motor Co.', 'Harborline Autos', 'Valley Oak Motors', 'Northshore Auto'].filter((n) => !denied(n));
const STATE = { 'us-ca': ['California', '#b8222a', '#1c2f6b', null], 'us-tx': ['Texas', '#1c2f6b', '#111111', '#d8e4f4'], us: ['America', '#1c2f6b', '#1c2f6b', null], mx: ['MÉXICO', '#1c7a3c', '#111111', '#e8f4e8'], latam: ['', '#1c2f6b', '#111111', null], br: ['BRASIL', '#1c2f6b', '#111111', null], au: ['', '#1c2f6b', '#111111', null] };
const JP_TOP = ['品川 300', '横浜 330', '練馬 500', '湘南 300', '多摩 501'], KANA = ['さ', 'わ', 'な', 'ほ', 'り', 'ね'];
const CC = { de: 'D', fr: 'F', es: 'E', it: 'I', pt: 'P', nordic: 'S', uk: 'UK', intl: 'EU' };
function plateFace(locale, i) {
	const r = rng(hash32(locale, i, 'plate')), L = () => String.fromCharCode(65 + Math.floor(r() * 26)).replace(/[IOQ]/, 'X'), D = () => String(Math.floor(r() * 10));
	const sys = systemFor(locale);
	if (sys.plate === 'jp') return { k: 'plate', style: 'jp', top: pick(r, JP_TOP), kana: pick(r, KANA), text: `${D()}${D()}-${D()}${D()}` };
	if (sys.plate === 'eu') return { k: 'plate', style: 'eu', cc: CC[locale] || 'EU', text: locale === 'de' ? `${L()}${L()} ${L()}${L()} ${D()}${D()}${D()}` : locale === 'fr' || locale === 'it' || locale === 'es' ? `${L()}${L()}-${D()}${D()}${D()}-${L()}${L()}` : `${L()}${L()}${L()} ${D()}${D()}${D()}` };
	if (sys.plate === 'uk') return { k: 'plate', style: 'uk', cc: 'UK', text: `${L()}${L()}${D()}${D()} ${L()}${L()}${L()}`, rear: i % 2 === 0 };
	const [state, ink2, ink, band] = STATE[locale] || STATE.us;
	const text = locale === 'us-ca' ? `${1 + Math.floor(r() * 9)}${L()}${L()}${L()}${D()}${D()}${D()}` : `${L()}${L()}${L()}-${D()}${D()}${D()}${r() < 0.5 ? D() : ''}`;
	return { k: 'plate', style: 'us', state, ink, ink2, band: band || '', text, dealer: r() < 0.4 ? pick(r, DEALERS) : '' };
}
const LIVERY_FACES = {
	police: { k: 'livery', svc: 'police', word: 'POLICE', sub: 'HARBOUR' },
	roof: { k: 'livery', svc: 'roof', word: '12' },
	military: { k: 'livery', svc: 'military', word: 'MERIDIAN GUARD' },
	// the vans: the tactical team's in charcoal with reflective white, a patrol van's with gold
	swat: { k: 'livery', svc: 'swat', word: 'POLICE', sub: 'TACTICAL UNIT' },
	van: { k: 'livery', svc: 'van', word: 'POLICE', sub: 'HARBOUR' },
	vanRoof: { k: 'livery', svc: 'roof', word: '41' },
};
// the military's stencils (militaryStencils below): the side's word and mark, the bumper codes
// (the unit, then the company and the vehicle's number), NO STEP; light on the green and the
// sand, dark on the air units' grey
const MIL_CODES = ['HQ-11', 'A-12', 'A-14', 'B-21', 'B-23', 'C-31', 'C-32', 'D-41'];
const STENCILS = {
	guardWord: { k: 'livery', svc: 'stencil', word: 'MERIDIAN GUARD' }, ironWord: { k: 'livery', svc: 'stencil', word: 'IRONVALE LEGION' },
	guardMark: { k: 'livery', svc: 'stencil', mark: 'guard' }, ironMark: { k: 'livery', svc: 'stencil', mark: 'ironvale' },
	guardWordDark: { k: 'livery', svc: 'stencil', word: 'MERIDIAN GUARD', ink: '#24272a' }, guardMarkDark: { k: 'livery', svc: 'stencil', mark: 'guard', ink: '#24272a' },
	policeWord: { k: 'livery', svc: 'stencil', word: 'HARBOUR POLICE', ink: '#f4f4f0' }, policeCode: { k: 'livery', svc: 'stencil', word: 'AIR 1', ink: '#f4f4f0' },
	nostep: { k: 'livery', svc: 'stencil', word: 'NO STEP', small: true }, unit: { k: 'livery', svc: 'stencil', word: '4 MG' }, unitIron: { k: 'livery', svc: 'stencil', word: '9 IVL' },
	...Object.fromEntries(MIL_CODES.map((c, i) => ['code' + i, { k: 'livery', svc: 'stencil', word: c }])),
};
// the brands whose marks go on bumper stickers (a phone loads four of their sheets, a computer
// eight): what people put on a car, a record shop, an outfitter, a roaster, a bike shop
const STICKER_BRANDS = PHONE ? ['brands-music', 'brands-outdoor', 'brands-coffee', 'brands-transport'] : ['brands-music', 'brands-outdoor', 'brands-coffee', 'brands-transport', 'brands-retro', 'brands-apparel', 'brands-beverages', 'brands-books'];
const STICKER_FIELDS = ['#fbfaf6', '#fbfaf6', '#f3ead2', '#e6eaee', null];
const logoFace = (i) => ({ k: 'bbrand', family: STICKER_BRANDS[i % STICKER_BRANDS.length], trade: (Math.floor(i / STICKER_BRANDS.length) * 3 + i) % 8, field: STICKER_FIELDS[(i * 7 + 3) % STICKER_FIELDS.length] });
let ATLAS = null, ATLAS_LOCALE = null;
const CELLS = new Map();
// the sheet's size: the pools pack into a little over half a phone's 1024 square (54%), so a
// phone's sheet is 1024 x 640, which they fill without a repack in every locale (a third less
// memory on the graphics and in the canvas; tools/phone-audit.test.mjs)
export const CAR_ATLAS = { phone: { size: 1024, height: 768, scale: 0.6 }, desktop: { size: 2048, height: 1024, scale: 1 } };
function carAtlas() {
	if (!ATLAS) ATLAS = createAtlas({ ...CAR_ATLAS[PHONE ? 'phone' : 'desktop'], name: 'car-decals' });
	return ATLAS;
}
// (re)draw the pools for a locale: plates, bumper stickers, window stickers, permits, liveries
export function setCarLocale(locale = 'us-ca') {
	const A = carAtlas();
	if (ATLAS_LOCALE === locale && CELLS.size) return;
	ATLAS_LOCALE = locale;
	const want = carFaces(locale);
	A.reset();
	A.sync(want);
	CELLS.clear();
	for (const k of want.keys()) CELLS.set(k, A.get(k));
	marksN = marksReady();
}
// the faces a locale's pools want in the sheet: key -> { face, w, h }
export function carFaces(locale = 'us-ca') {
	const sys = systemFor(locale), want = new Map();
	const pw = sys.plate === 'eu' || sys.plate === 'uk' ? 0.52 : 0.31, ph = sys.plate === 'eu' || sys.plate === 'uk' ? 0.115 : 0.155;
	for (let i = 0; i < POOLS.plate; i++) want.set('plate' + i, { face: plateFace(locale, i), w: pw * 0.6, h: ph * 0.6 });
	for (let i = 0; i < POOLS.bumper; i++) want.set('bumper' + i, { face: { k: 'bumper', seed: i + 1 }, w: 0.28, h: 0.075 });
	for (let i = 0; i < POOLS.window; i++) want.set('window' + i, { face: { k: 'wsticker', seed: i + 1 }, w: 0.24, h: 0.08 });
	for (let i = 0; i < POOLS.logo; i++) want.set('logo' + i, { face: logoFace(i), w: 0.17, h: 0.13 });
	for (let i = 0; i < POOLS.slap; i++) want.set('slap' + i, { face: { k: 'sticker', seed: 401 + i * 37 }, w: 0.1, h: 0.1 });
	for (let i = 0; i < POOLS.permit; i++) want.set('permit' + i, { face: { k: 'cpermit', seed: i + 1, year: 2026, style: locale === 'de' ? 'de' : sys.id === 'jp' ? 'jp' : 'us' }, w: 0.08, h: 0.08 });
	for (const [k, f] of Object.entries(LIVERY_FACES)) want.set('liv:' + k, { face: f, w: k === 'roof' || k === 'vanRoof' ? 0.6 : 2.4, h: k === 'roof' || k === 'vanRoof' ? 0.6 : 0.5 });
	for (const [k, f] of Object.entries(STENCILS)) want.set('mil:' + k, { face: f, w: f.mark ? 0.5 : f.word?.length > 8 ? 2.4 : 0.8, h: f.mark ? 0.5 : f.word?.length > 8 ? 0.32 : 0.18 });
	return want;
}
const cellOf = (k) => CELLS.get(k) || null;
// the brands' marks are drawn in type until their sheets are in: as each comes (looked for
// once a second), the sheet is drawn again with them
// (the cells come out where they were: the same faces packed in the same order)
let marksN = 0, marksT = 0;
const marksReady = () => STICKER_BRANDS.reduce((a, f) => a + (artReady(f, PHONE) ? 1 : 0), artReady('modern', PHONE) ? 1 : 0);
function marksIn() {
	const now = typeof performance !== 'undefined' ? performance.now() : 0;
	if (!ATLAS_LOCALE || marksN > STICKER_BRANDS.length || now - marksT < 1000) return;
	marksT = now;
	if (marksReady() === marksN) return;
	const l = ATLAS_LOCALE; ATLAS_LOCALE = null; setCarLocale(l);
}

// ---------- where on the body: sampled from the loft ----------
const PROF = new Map();
export function bodyProfile(kind) {
	if (PROF.has(kind)) return PROF.get(kind);
	const S = specOf(kind), L2 = S.L / 2, step = 0.05;
	const NZ = Math.ceil(S.L / step) + 1, NY = Math.ceil((S.H + 0.3) / step) + 1, NX = Math.ceil(S.W / 2 / step) + 1;
	const half = new Float32Array(NZ * NY).fill(-1), rear = new Float32Array(NY * NX).fill(1e3), front = new Float32Array(NY * NX).fill(-1e3);
	let geo = null;
	try { geo = carGeometry(SPEC[kind] ? kind : 'sedan', 40, 14, { wheels: false }); } catch { geo = null; }
	if (geo) {
		const p = geo.attributes.position, idx = geo.index;
		const n = idx ? idx.count : p.count, v = (k) => (idx ? idx.getX(k) : k);
		const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), Q = new THREE.Vector3();
		for (let t = 0; t + 2 < n; t += 3) {
			A.fromBufferAttribute(p, v(t)); B.fromBufferAttribute(p, v(t + 1)); C.fromBufferAttribute(p, v(t + 2));
			const big = Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)), m = Math.min(12, Math.max(1, Math.ceil(big / 0.04)));
			for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
				const a = i / m, b = j / m;
				Q.set(0, 0, 0).addScaledVector(A, 1 - a - b).addScaledVector(B, a).addScaledVector(C, b);
				const zi = Math.round((Q.z + L2) / step), yi = Math.round(Q.y / step), xi = Math.round(Math.abs(Q.x) / step);
				if (zi >= 0 && zi < NZ && yi >= 0 && yi < NY) half[zi * NY + yi] = Math.max(half[zi * NY + yi], Math.abs(Q.x));
				if (yi >= 0 && yi < NY && xi < NX) { const k = yi * NX + xi; rear[k] = Math.min(rear[k], Q.z); front[k] = Math.max(front[k], Q.z); }
			}
		}
		geo.dispose();
	}
	const P = {
		S,
		halfW: (z, y) => { const zi = Math.max(0, Math.min(NZ - 1, Math.round((z + L2) / step))), yi = Math.max(0, Math.min(NY - 1, Math.round(y / step))); const h = half[zi * NY + yi]; return h > 0 ? h : S.W / 2; },
		rearZ: (x, y) => { const yi = Math.max(0, Math.min(NY - 1, Math.round(y / step))), xi = Math.min(NX - 1, Math.round(Math.abs(x) / step)); const z = rear[yi * NX + xi]; return z < 100 ? z : -L2; },
		frontZ: (x, y) => { const yi = Math.max(0, Math.min(NY - 1, Math.round(y / step))), xi = Math.min(NX - 1, Math.round(Math.abs(x) / step)); const z = front[yi * NX + xi]; return z > -100 ? z : L2; },
	};
	PROF.set(kind, P);
	return P;
}
// the decal slots of a kind, as local matrices (size and the layer's lift folded in)
const SLOTS = new Map();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function local(px, py, pz, nx, ny, nz, tx, ty, tz, w, h, lift) {
	_z.set(nx, ny, nz).normalize(); _x.set(tx, ty, tz); _x.addScaledVector(_z, -_x.dot(_z)).normalize(); _y.crossVectors(_z, _x);
	return new THREE.Matrix4().makeBasis(_x.multiplyScalar(w), _y.multiplyScalar(h), _z.clone()).setPosition(px + nx * lift, py + ny * lift, pz + nz * lift);
}
function slotsOf(kind, sysPlate) {
	const key = kind + sysPlate;
	if (SLOTS.has(key)) return SLOTS.get(key);
	const P = bodyProfile(kind), S = P.S, st = { sedan: 0, hatch: 0, sports: 0, crossover: 1, suv: 1, pickup: 1 }[kind] ?? 2;
	const wide = sysPlate === 'eu' || sysPlate === 'uk', pw = wide ? 0.52 : 0.31, ph = wide ? 0.115 : 0.155;
	const yR = S.belt * (st < 1.5 ? 0.5 : 0.38), yF = S.belt * 0.27;
	const zr = Math.min(P.rearZ(0, yR), P.rearZ(pw / 2, yR)) - 0.006, zf = Math.max(P.frontZ(0, yF), P.frontZ(pw / 2, yF)) + 0.006;
	// the rear's slope at a height (for stickers on the glass)
	const rearN = (x, y) => { const d = P.rearZ(x, y + 0.05) - P.rearZ(x, y - 0.05); const l = Math.hypot(d, 0.1); return [d / l, -0.1 / l]; };
	const frontN = (x, y) => { const d = P.frontZ(x, y + 0.05) - P.frontZ(x, y - 0.05); const l = Math.hypot(d, 0.1); return [-d / l, 0.1 / l]; };
	const out = {
		rearPlate: local(0, yR, zr, 0, 0, -1, -1, 0, 0, pw, ph, 0.002),
		frontPlate: local(0, yF, zf, 0, 0, 1, 1, 0, 0, pw, ph, 0.002),
		bumper: [-0.42, 0.42, 0].map((x, i) => { const y = Math.max(0.22, yR - ph / 2 - 0.08 - (i === 2 ? 0.0 : 0)), xx = i === 2 ? 0.44 : x, yy = i === 2 ? yR + ph / 2 + 0.07 : y; return local(xx, yy, Math.min(P.rearZ(xx, yy), P.rearZ(xx - 0.14, yy), P.rearZ(xx + 0.14, yy)) - 0.006, 0, 0, -1, -1, 0, 0, 0.28, 0.075, 0.003); }),
		window: (() => { const y = Math.min(S.H - 0.12, S.belt + 0.1), x = -0.32, [ny, nz] = rearN(x, y); return local(x, y, P.rearZ(x, y) - 0.008, 0, ny, nz, -1, 0, 0, 0.24, 0.08, 0.003); })(),
		// the brand's sticker across from the third strip, over the plate; the slap up in a top
		// corner of the back glass, where people put the round ones
		logo: (() => { const x = -0.44, y = yR + ph / 2 + 0.1; return local(x, y, Math.min(P.rearZ(x, y), P.rearZ(x - 0.09, y), P.rearZ(x + 0.09, y)) - 0.006, 0, 0, -1, -1, 0, 0, 0.17, 0.13, 0.003); })(),
		slap: (() => { const y = Math.max(S.belt + 0.16, S.H - 0.2), x = Math.min(0.5, S.W * 0.26), [ny, nz] = rearN(x, y); return local(x, y, P.rearZ(x, y) - 0.008, 0, ny, nz, -1, 0, 0, 0.1, 0.1, 0.003); })(),
		permit: (() => { const jp = sysPlate === 'jp', y = jp ? S.H - 0.1 : S.belt + 0.07, x = jp ? 0 : -0.48, [ny, nz] = frontN(x, y); return local(x, y, P.frontZ(x, y) + 0.008, 0, ny, nz, 1, 0, 0, 0.08, 0.08, 0.003); })(),
	};
	// the police cruiser's doors (white panels standing proud: military/police.js), its roof
	// number and the word on the boot
	const sideX = Math.max(P.halfW(-0.18, 0.78), S.W / 2 + 0.015) + 0.007;
	out.police = [
		local(sideX, 0.8, -0.18, 1, 0, 0, 0, 0, -1, 1.7, 0.36, 0.002),
		local(-sideX, 0.8, -0.18, -1, 0, 0, 0, 0, 1, 1.7, 0.36, 0.002),
		local(0, S.H + 0.012, -0.72, 0, 1, 0, 1, 0, 0, 0.5, 0.5, 0.002),
	];
	// a van's sides (the word on the panel below the windows, behind the front doors), its rear
	// doors and its roof number
	if (st === 2) {
		const yS = Math.min(S.belt - 0.26, 0.74), zS = -S.L * 0.09, xS = Math.max(P.halfW(zS, yS), S.W / 2) + 0.006, yRr = S.belt * 0.92, zRr = Math.min(P.rearZ(0, yRr), P.rearZ(0.5, yRr)) - 0.006;
		out.van = [
			local(xS, yS, zS, 1, 0, 0, 0, 0, -1, Math.min(2.4, S.L * 0.47), 0.44, 0.002),
			local(-xS, yS, zS, -1, 0, 0, 0, 0, 1, Math.min(2.4, S.L * 0.47), 0.44, 0.002),
			local(0, S.H + 0.012, -S.L * 0.18, 0, 1, 0, 1, 0, 0, 0.6, 0.6, 0.002),
			local(0, yRr, zRr, 0, 0, -1, -1, 0, 0, 1.3, 0.27, 0.002),
		];
	}
	SLOTS.set(key, out);
	return out;
}

// ---------- a fleet's decal set ----------
const FAR = PHONE ? 30 : 55, LIV_FAR = PHONE ? 70 : 120;
export function createFleetDecals(group, { isPhone = PHONE } = {}) {
	const A = carAtlas();
	if (!CELLS.size) setCarLocale(ATLAS_LOCALE || 'us-ca');
	const cap = isPhone ? 260 : 700;
	const plates = createBatch(group, 'retro', LAYER.poster, A.tex, cap, { phone: isPhone, name: 'plates' });
	const vinyl = createBatch(group, 'vinyl', LAYER.sticker, A.tex, cap, { phone: isPhone, name: 'car-vinyl' });
	const glass = createBatch(group, 'glass', LAYER.sticker, A.tex, Math.floor(cap / 3), { phone: isPhone, name: 'car-glass' });
	const _o = new THREE.Matrix4();
	const sysNow = () => systemFor(ATLAS_LOCALE || 'us-ca');
	function begin() { plates.clear(); vinyl.clear(); glass.clear(); marksIn(); }
	function emit(B, M, L, cell, back, seed) { if (!cell) return; _o.multiplyMatrices(M, L); B.putMatrix(_o.elements, cell, back, seed, 0, 0); }
	// one car: its kind, its world matrix, distance squared from the eye; o.seed (anything
	// stable: an id), o.livery ('police'), o.parked (seed from where it stands)
	function add(kind, M, d2, o = {}) {
		if (d2 > LIV_FAR * LIV_FAR) return;
		const sys = sysNow(), sl = slotsOf(kind, sys.plate);
		const e = M.elements;
		const seed = o.seed !== undefined ? hash32(String(o.seed)) : o.seedAt ? hash32(Math.round(o.seedAt[0] * 2), Math.round(o.seedAt[1] * 2)) : hash32(Math.round(e[12] * 2), Math.round(e[14] * 2));
		const D = carDecalSet(seed, { sys, livery: o.livery || null, phone: isPhone });
		if (o.livery === 'police') {
			const c = cellOf('liv:police');
			emit(vinyl, M, sl.police[0], c, BACK.none, 0.1); emit(vinyl, M, sl.police[1], c, BACK.none, 0.2);
			emit(vinyl, M, sl.police[2], cellOf('liv:roof'), BACK.none, 0.3);
		} else if ((o.livery === 'swat' || o.livery === 'van') && sl.van) {
			// (the lettering is reflective sheeting: it lights up in your headlights at night)
			const c = cellOf('liv:' + o.livery);
			emit(plates, M, sl.van[0], c, BACK.none, 0.1); emit(plates, M, sl.van[1], c, BACK.none, 0.2);
			emit(vinyl, M, sl.van[2], cellOf('liv:vanRoof'), BACK.none, 0.3);
			emit(plates, M, sl.van[3], c, BACK.none, 0.4);
		}
		if (d2 > FAR * FAR) return;
		const pc = cellOf('plate' + D.plate);
		emit(plates, M, sl.rearPlate, pc, BACK.blank, (seed & 1023) / 1024);
		if (D.front) emit(plates, M, sl.frontPlate, pc, BACK.blank, (seed & 511) / 512);
		if (o.livery) return;
		D.bumper.forEach((b, i) => emit(vinyl, M, sl.bumper[i], cellOf('bumper' + b), BACK.none, i * 0.3));
		if (D.window >= 0) emit(glass, M, sl.window, cellOf('window' + D.window), BACK.mirrored, 0.5);
		if (D.logo >= 0) emit(vinyl, M, sl.logo, cellOf('logo' + D.logo), BACK.none, 0.9);
		if (D.slap >= 0) emit(glass, M, sl.slap, cellOf('slap' + D.slap), BACK.mirrored, 0.6);
		if (D.permit >= 0) emit(glass, M, sl.permit, cellOf('permit' + D.permit), BACK.mirrored, 0.7);
	}
	function end() { plates.commit(); vinyl.commit(); glass.commit(); }
	function dispose() { plates.dispose(); vinyl.dispose(); glass.dispose(); }
	return { begin, add, end, dispose, stats: () => ({ plates: plates.n, vinyl: vinyl.n, glass: glass.n }) };
}

// ---------- the military's stencils, as meshes riding on the body ----------
// kind: military/models.js's (tank, apc, jeep, truck, heli); side 'guard' or 'ironvale'; n the
// vehicle's place in its column (its number); grey for an air unit's paint (dark ink); parked:
// one set for every vehicle of a kind in a motor pool (the unit's codes, no number). Each mark is
// laid where a ray from outside meets the vehicle's own body, a little proud of it, in flat
// paint. Built once per kind and variant; each vehicle gets its own meshes over the geometry.
// Returns [] where the body cannot be had (node, no geometry).
const STENCIL_SETS = new Map();
const MIL_SPOTS = {
	// [what, from (side +x/-x, front +z, rear -z), y, along (z on a side, x at an end), w, h]
	tank: [['mark', 'side', 1.05, -2.1, 0.5, 0.5], ['word', 'side', 1.05, 0.6, 1.9, 0.26], ['unit', 'front', 1.08, -0.95, 0.62, 0.15], ['code', 'front', 1.08, 0.95, 0.62, 0.15], ['unit', 'rear', 1.25, -0.95, 0.62, 0.15], ['code', 'rear', 1.25, 0.95, 0.62, 0.15]],
	apc: [['word', 'side', 1.75, -0.7, 2.4, 0.3], ['mark', 'side', 1.75, 1.75, 0.5, 0.5], ['unit', 'front', 0.95, -0.75, 0.6, 0.15], ['code', 'front', 0.95, 0.75, 0.6, 0.15], ['unit', 'rear', 1.35, -0.75, 0.6, 0.15], ['code', 'rear', 1.35, 0.75, 0.6, 0.15], ['nostep', 'side', 2.35, -2.2, 0.36, 0.09]],
	jeep: [['mark', 'side', 1.0, 0.25, 0.38, 0.38], ['unit', 'front', 0.75, -0.55, 0.44, 0.11], ['code', 'front', 0.75, 0.55, 0.44, 0.11], ['code', 'rear', 0.85, 0.5, 0.44, 0.11]],
	truck: [['mark', 'side', 1.55, 2.85, 0.42, 0.42], ['word', 'side', 2.2, -1.6, 2.6, 0.32], ['unit', 'front', 0.75, -0.7, 0.55, 0.13], ['code', 'front', 0.75, 0.7, 0.55, 0.13], ['code', 'rear', 1.3, 0.75, 0.55, 0.13]],
	heli: [['word', 'side', 2.05, -4.6, 2.2, 0.28], ['mark', 'side', 1.55, 0.6, 0.6, 0.6], ['code', 'side', 2.05, -6.6, 0.7, 0.16]],
};
export function militaryStencils(kind, { side = 'guard', n = 0, grey = false, parked = false, police = false } = {}) {
	const key = [kind, police ? 'police' : side, parked ? 'p' : n % MIL_CODES.length, grey ? 'g' : ''].join(':');
	if (!STENCIL_SETS.has(key)) {
		let meshes = [];
		try { meshes = buildStencils(kind, police ? 'police' : side, n, grey, parked); } catch { meshes = []; }
		STENCIL_SETS.set(key, meshes);
	}
	return STENCIL_SETS.get(key).map((m) => { const c = new THREE.Mesh(m.geometry, currentSignMaterial(m.material)); c.renderOrder = m.renderOrder; c.name = m.name; c.geometry.userData.shared = true; return c; });
}
// (the vehicles' geometry is military/models.js's own, handed in by military/index.js)
let milGeo = null;
export function setStencilBody(fn) { milGeo = fn; }
// a military vehicle's model (military/models.js vehicleMesh, a LOD) with its stencils on its near level
export function stencilVehicle(root, kind, opts = {}) {
	const near = root?.levels?.[0]?.object;
	if (near) for (const m of militaryStencils(kind, opts)) near.add(m);
	return root;
}
function buildStencils(kind, side, n, grey, parked) {
	const spots = MIL_SPOTS[kind];
	const G = spots && milGeo ? milGeo(kind) : null;
	const body = G?.parts?.hull || G?.parts?.body;
	if (!body || typeof document === 'undefined') return [];
	const A = carAtlas();
	if (!CELLS.size) setCarLocale(ATLAS_LOCALE || 'us-ca');
	const iron = side === 'ironvale', mesh = new THREE.Mesh(body), rc = new THREE.Raycaster(), O = new THREE.Vector3(), D = new THREE.Vector3();
	const cellFor = (what, i) => side === 'police' ? (what === 'word' ? cellOf('mil:policeWord') : what === 'code' ? cellOf('mil:policeCode') : null) : cellOf('mil:' + (what === 'word' ? (iron ? 'ironWord' : grey ? 'guardWordDark' : 'guardWord') : what === 'mark' ? (iron ? 'ironMark' : grey ? 'guardMarkDark' : 'guardMark') : what === 'unit' ? (iron ? 'unitIron' : 'unit') : what === 'nostep' ? 'nostep' : (parked ? (iron ? 'unitIron' : 'unit') : 'code' + ((n + i) % MIL_CODES.length))));
	const list = [];
	spots.forEach(([what, from, y, along, w, h], i) => {
		const sides = from === 'side' ? [1, -1] : [from === 'front' ? 1 : -1];
		for (const s of sides) {
			if (from === 'side') { O.set(s * 8, y, along); D.set(-s, 0, 0); } else { O.set(along, y, s * 14); D.set(0, 0, -s); }
			rc.set(O, D); rc.far = 20;
			const hit = rc.intersectObject(mesh, false)[0];
			if (!hit) continue;
			// (laid on the face it met, turned so the words read the right way from outside)
			const N = hit.face ? hit.face.normal.clone() : D.clone().negate();
			if (N.dot(D) > 0) N.negate();
			if (Math.abs(N.y) > 0.75) continue;
			const T = from === 'side' ? new THREE.Vector3(0, 0, -s) : new THREE.Vector3(-s, 0, 0);
			const c = cellFor(what, i);
			if (c) list.push({ c, L: local(hit.point.x, hit.point.y, hit.point.z, N.x, N.y, N.z, T.x, T.y, T.z, w, h, 0.006) });
		}
	});
	if (!list.length) return [];
	const n4 = list.length, pos = new Float32Array(n4 * 12), nor = new Float32Array(n4 * 12), uv = new Float32Array(n4 * 8), cell = new Float32Array(n4 * 16), fx = new Float32Array(n4 * 16), idx = [];
	const V = new THREE.Vector3(), Nn = new THREE.Vector3();
	list.forEach((q, i) => {
		[[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]].forEach(([x, y, u, v], k) => {
			V.set(x, y, 0).applyMatrix4(q.L); Nn.set(0, 0, 1).transformDirection(q.L);
			pos.set([V.x, V.y, V.z], (i * 4 + k) * 3); nor.set([Nn.x, Nn.y, Nn.z], (i * 4 + k) * 3); uv.set([u, v], (i * 4 + k) * 2);
			// (a little worn: sprayed paint on a working vehicle)
			cell.set(q.c, (i * 4 + k) * 4); fx.set([BACK.none, i * 0.17, 0.25, 0], (i * 4 + k) * 4);
		});
		idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
	});
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	g.setAttribute('aCell', new THREE.BufferAttribute(cell, 4)); g.setAttribute('aFx', new THREE.BufferAttribute(fx, 4)); g.setIndex(idx);
	g.computeBoundingSphere();
	const m = new THREE.Mesh(g, signMaterial('paint', LAYER.paint, A.tex, { phone: PHONE }));
	m.renderOrder = m.material.userData.renderOrder; m.name = 'stencils-' + kind;
	return [m];
}
