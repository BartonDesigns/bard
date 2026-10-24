// Crysis people: real human bodies. The CC0 MakeHuman base mesh from the caves build
// (19k vertices, 64-bone skeleton with fingers), shaped per person by its morph targets:
// ancestry (African, Asian, European, blended), sex, age, muscle and weight; heights from
// real population ranges; a face of their own from the MakeHuman face targets (face.js).
// Skin from the painted skin maps, tinted to the person and lit as skin (skin.js); eyes with
// a cornea and an iris, lashes and brows (face.js); hair grown on their own skull in their
// own cut (hair.js); and clothes cut from the body's own cloth cage so they follow the
// body, dressed for who the person is, where and what they are doing (wardrobe.js) and
// painted by one shader (garment.js): a cloth mesh, an accessories mesh, skin, eyes, hair.

import * as THREE from 'three';
import { dressArmorEffects, clearArmorEffects, armorEffectsLOD } from './relic-armor-effects.js';
import { shedImage } from '../world/cpucopy.js';
import { applyInk, inkFor, flashAtlas } from '../tattoo/skinink.js';
import { dressFor, hairFor, fromFlat, climate } from './wardrobe.js';
import { hatRim } from './garment-hats.js';
import { neckDrop } from './garment-shape.js';
import { garmentMaterial, paint, landmarks, partOf, regions, clothGeometrySteps, accessoryGeometry, accessoryMaterial, offsets } from './garment.js';
import { loadFaces, faceDNA, shapeFace, skinAttribute, tidyEyes, faceDetail, detailMaterial, eyeGeometry, eyeMaterial, irisOf } from './face.js';
import { skinMaterial } from './skin.js';
import { buildHair, hairMaterial, cutOf, skullOf, scalpMask } from './hair.js';
import { FLUFFY, buildFluff, fluffMaterial } from './hair-fluff.js';
import { fadePerson } from './fade.js';
import { STYLES, styleFor, beardFor, styleNow, loadStyle, hairGeometry, kitMaterial, stubbleMask, SHELLS } from './hairkit.js';
import { hairCapsules, poseCapsules } from './hair-collide.js';
import { hairMotion } from './hair-motion.js';
import {clothCapsules,poseCloth,calibrateCloth} from './cloth-collide.js';
import { fitBags, torsoSurface, attachBag, BAG_KINDS } from './bags.js';
import { tierNow } from '../world/governor.js';
import { shapeBuild } from './build.js';
import { loadKitModels } from './kit-models.js';
import { GFX_PHONE } from '../world/device.js';
import { boundBody, cullPosed } from './body-bounds.js';
import { runAll } from '../world/buildslice.js';
import { mulberry32 as rng } from '../noise.js';

const TEX = (f) => new URL(`../../textures/${f}`, import.meta.url).href;
const RIG_URL = new URL('../assets/people/rig150.json', import.meta.url).href;
const BASE_FILE = 'human-base-dd84ad3d07.json.gz';
const SKINS = {
	young_caucasian_female: 'human-young_caucasian_female-dd2fc42c44.webp', young_caucasian_male: 'human-young_caucasian_male-e1639aeae1.webp',
	old_caucasian_female: 'human-old_caucasian_female-5c8b8cd784.webp', old_caucasian_male: 'human-old_caucasian_male-4126648f8f.webp',
	young_african_female: 'human-young_african_female-2c0f99940e.webp', young_african_male: 'human-young_african_male-8b9e87bf3a.webp',
};

// a phone keeps the skins at half size (a quarter of the memory; a face is small on its screen)
const PHONE = GFX_PHONE;
function halve(im) {
	if (!im || im.width <= 512) return im;
	const cv = document.createElement('canvas');
	cv.width = im.width >> 1; cv.height = im.height >> 1;
	cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
	return cv;
}
const decode = (s, Type) => { const a = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new Type(a.buffer); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export { rng };

// ---------- assets, loaded once ----------
let assets = null, loaded = null;
// the assets if they are in already (no waiting)
export const peopleAssetsNow = () => loaded;
export function loadPeopleAssets() {
	if (assets) return assets;
	assets = (async () => {
		const gz = await fetch(TEX(BASE_FILE));
		if (!gz.ok) throw Error('human base mesh ' + gz.status);
		const text = await new Response(gz.body.pipeThrough(new DecompressionStream('gzip'))).text();
		const D = JSON.parse(text);
		const faces = loadFaces().catch(() => null);
		// (the soldiers' head kit as real models; without them it is built in code)
		const kit = loadKitModels(PHONE).catch((e) => { console.warn('[people] kit models', e); return null; });
		const rig = await (await fetch(RIG_URL)).json();
		// the full 64-bone rig: extra joints and their skin influences patched over the 18-bone base
		const raw = Uint8Array.from(atob(rig.patch), (c) => c.charCodeAt(0)), view = new DataView(raw.buffer);
		const ids = decode(D.indices, Uint8Array), weights = new Uint8Array(decode(D.weights, Uint16Array).buffer);
		for (let k = 0; k < raw.length; k += 14) { const v = view.getUint16(k, true); ids.set(raw.subarray(k + 2, k + 6), v * 4); weights.set(raw.subarray(k + 6, k + 14), v * 8); }
		const A = {
			D, bones: rig.bones, unit: D.unit, base: decode(D.position, Int16Array), uv: decode(D.uv, Uint16Array), ids, weights: new Uint16Array(weights.buffer),
			body: decode(D.body, Uint16Array), cage: decode(D.cage, Uint16Array), targets: {}, tex: {},
		};
		for (const [n, s] of Object.entries(D.targets)) A.targets[n] = decode(s, Int16Array);
		const loader = new THREE.TextureLoader();
		// (a skin is only ever drawn by the graphics card, tattoos and all (tattoo/skinink.js is in the
		// shader): a phone lets the page's copy go once the card has it, world/cpucopy.js)
		const picture = (f) => new Promise((ok, no) => loader.load(TEX(f), (t) => ok(PHONE ? halve(t.image) : t.image), undefined, no));
		const load = (f, srgb) => new Promise((ok, no) => loader.load(TEX(f), (t) => { t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; if (PHONE) t.image = halve(t.image); ok(shedImage(t, () => picture(f), { on: PHONE })); }, undefined, no));
		await Promise.all(Object.entries(SKINS).map(async ([k, f]) => { A.tex[k] = await load(f, true); }));
		A.fabric = fabricTextures();
		A.faces = await faces;
		tidyEyes(A, A.faces);
		A.kit = await kit;
		loaded = A;
		return A;
	})();
	return assets;
}

// small tiling cloth maps: a knit, a twill, a canvas weave (normal + roughness)
function fabricTextures() {
	const make = (kind) => {
		const S = 128, n = new Uint8Array(S * S * 4), h = new Float32Array(S * S);
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
			let v;
			if (kind === 'twill') v = 0.5 + 0.5 * Math.sin((x + y) * Math.PI / 2) * (0.7 + 0.3 * Math.sin(y * 0.8));
			else if (kind === 'knit') v = 0.5 + 0.5 * Math.abs(Math.sin(x * Math.PI / 4)) * Math.sin(y * Math.PI / 3 + (Math.floor(x / 4) % 2) * 1.5);
			else v = 0.5 + 0.25 * (Math.sin(x * Math.PI / 2) + Math.sin(y * Math.PI / 2));
			h[y * S + x] = v + (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.08;
		}
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
			const dx = h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S], dy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
			n.set([128 - dx * 60, 128 - dy * 60, 255, 255], (y * S + x) * 4);
		}
		const t = new THREE.DataTexture(n, S, S); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
		return t;
	};
	return { twill: make('twill'), knit: make('knit'), canvas: make('canvas') };
}

// ---------- who someone is ----------
// (black hair is darker than it looks: a little of the light it catches is its own colour)
const HAIR_COLOURS = [[0.035, 0.026, 0.02], [0.07, 0.048, 0.032], [0.25, 0.16, 0.09], [0.4, 0.28, 0.16], [0.6, 0.45, 0.26], [0.75, 0.62, 0.42], [0.35, 0.12, 0.06], [0.72, 0.72, 0.7], [0.9, 0.9, 0.88]];
// clothes: what people in the Bay Area actually wear (lots of navy, grey, black, denim, earth tones, the odd bright)
const CLOTH = {
	top: [[0.08, 0.1, 0.18], [0.35, 0.36, 0.38], [0.06, 0.06, 0.07], [0.93, 0.92, 0.9], [0.55, 0.6, 0.66], [0.3, 0.36, 0.24], [0.62, 0.48, 0.34], [0.5, 0.12, 0.12], [0.12, 0.3, 0.5], [0.9, 0.7, 0.3], [0.85, 0.5, 0.55], [0.2, 0.45, 0.42], [0.7, 0.72, 0.74]],
	jacket: [[0.08, 0.09, 0.12], [0.3, 0.26, 0.2], [0.18, 0.22, 0.16], [0.55, 0.45, 0.32], [0.12, 0.18, 0.3], [0.45, 0.46, 0.48], [0.62, 0.2, 0.12]],
	bottom: [[0.12, 0.18, 0.3], [0.2, 0.28, 0.42], [0.06, 0.06, 0.07], [0.35, 0.33, 0.3], [0.58, 0.5, 0.38], [0.3, 0.3, 0.32], [0.16, 0.2, 0.14], [0.5, 0.56, 0.66]],
	shoes: [[0.06, 0.05, 0.05], [0.9, 0.9, 0.88], [0.3, 0.2, 0.13], [0.45, 0.45, 0.46], [0.15, 0.2, 0.35]],
};

const KID_TOPS = [[0.9, 0.25, 0.2], [0.2, 0.55, 0.9], [0.95, 0.75, 0.2], [0.35, 0.7, 0.35], [0.85, 0.45, 0.7], [0.55, 0.35, 0.8], [0.95, 0.95, 0.95], [0.2, 0.7, 0.75]];
const KID_SHOES = [[0.9, 0.9, 0.88], [0.9, 0.3, 0.3], [0.2, 0.4, 0.8], [0.95, 0.6, 0.8], [0.1, 0.1, 0.1]];

// the hair someone is born with, by their ancestry
const naturalHair = (anc, r) => anc[0] + anc[1] > 0.6 ? HAIR_COLOURS[r() < 0.8 ? 0 : 1] : HAIR_COLOURS[Math.floor(r() * 7)];
// (the draws the old grey pick for the over-sixties made are still made, so the rest of the
// person stays as they were)
function bornHair(age, anc, r, seed) {
	if (age <= 62) return naturalHair(anc, r);
	if (r() < 0.6) r();
	return naturalHair(anc, rng(seed ^ 0xc01));
}
// how grey their hair has gone (0..1: the share of grey hairs): none before the mid
// thirties; a few at the temples from then into the forties; salt and pepper through the
// fifties; mostly grey by the early sixties; all grey from seventy or so, whitening. Each
// person a few years early or late (lag: years later still, as brows go grey after the head)
const GREYING = [[35, 0], [45, 0.07], [52, 0.22], [60, 0.6], [66, 0.85], [72, 1]];
export function greyOf(d, lag = 0) {
	if (d.child || d.age < 33) return 0;
	const a = d.age + (d.greyShift || 0) - lag;
	for (let i = 1; i < GREYING.length; i++) if (a < GREYING[i][0]) { const [a0, g0] = GREYING[i - 1], [a1, g1] = GREYING[i]; return Math.max(0, g0 + (a - a0) / (a1 - a0) * (g1 - g0)); }
	return 1;
}
// the hair's colour as seen from afar: its own, greyed as far as it has gone
export function hairTone(d) {
	const g = greyOf(d), grey = HAIR_COLOURS[7];
	return d.hairColour.map((c, i) => c + (grey[i] - c) * g * g);
}

export function personDNA(seed, opts = {}) {
	const r = rng(seed ^ 0x5eed1e);
	// the Bay Area: roughly a third Asian, a third European, Hispanic and African American,
	// many of mixed heritage; the base mesh's three ancestry targets blend to cover it
	const roll = r();
	let anc = roll < 0.34 ? [0.05, 0.85, 0.1] : roll < 0.62 ? [0.02, 0.06, 0.92] : roll < 0.82 ? [0.18, 0.2, 0.62] : roll < 0.92 ? [0.85, 0.02, 0.13] : [r(), r(), r()];
	anc = anc.map((v) => v * (0.8 + r() * 0.4)); const s = anc.reduce((a, b) => a + b, 0); anc = anc.map((v) => v / s);
	// (a place elsewhere in the world gives its own mix: region/cultures.js; the draws above are still made)
	if (opts.ancestry) anc = opts.ancestry.slice();
	const sex = r() < 0.5 ? 0.08 + r() * 0.12 : 0.8 + r() * 0.15;
	const male = sex > 0.5;
	let age = opts.age ?? (18 + Math.pow(r(), 1.3) * 64);
	const height = (male ? 1.755 : 1.625) + (r() + r() + r() - 1.5) * 0.085 - (age > 65 ? 0.03 : 0) - anc[1] * 0.04;
	const d = {
		seed, sex, male, ancestry: anc, age, height, muscle: r() * 0.6 * (male ? 1 : 0.65), weight: Math.pow(r(), 2.2) * 0.5,
		tone: 0.9 + r() * 0.14, warmth: r(),
		hair: age > 70 && male && r() < 0.35 ? null : male ? (r() < 0.6 ? 'short02' : 'short01') : (r() < 0.55 ? 'ponytail01' : r() < 0.6 ? 'short01' : 'short02'),
		// (the colour they were born with; the grey comes with the years, greyOf)
		hairColour: bornHair(age, anc, r, seed),
		outfit: pickOutfit(r, male, age, opts),
		gait: { stride: 0.95 + r() * 0.12, bounce: 0.8 + r() * 0.5, armSwing: 0.7 + r() * 0.6, posture: (r() - 0.5) * 0.08 + (age > 65 ? 0.08 : 0), pace: 1.18 + r() * 0.3 - (age > 65 ? 0.3 : 0) },
		// temperament: how outgoing (bigger, more frequent gestures, head up, arms swinging),
		// how sure of themselves (chest up or a slump), and their usual mood
		temper: { outgoing: r(), confident: r(), warmth: r(), fidget: r() },
	};
	// when their hair goes grey: some a few years early, some late
	d.greyShift = (rng(seed ^ 0x9e7)() - 0.5) * 8;
	// the years put a little on most people (a stream of its own, so nothing else about them changes)
	const rb = rng(seed ^ 0xb01d);
	if (age > 40) d.weight = Math.min(0.7, d.weight + Math.min(1, (age - 40) / 50) * 0.14 * rb());
	// a build of their own (people/build.js): the frame under the base mesh's targets, a
	// slightly smaller head, shoulders carried wider and a waist drawn in on the fit and the
	// young, longer legs on some; it softens with the years and the weight
	const fitK = Math.max(0, 1 - Math.max(0, age - 45) / 40) * (1 - d.weight);
	d.build = male ? { shoulders: 0.004 + rb() * 0.009 * fitK, waist: (0.02 + rb() * 0.05) * fitK, head: -0.015 - rb() * 0.02, legs: rb() * 0.02, arms: [rb() * 0.06 * fitK, rb() * 0.04 * fitK] }
		: { shoulders: rb() * 0.004, waist: (0.04 + rb() * 0.05) * (0.5 + 0.5 * fitK), head: -0.015 - rb() * 0.02, legs: 0.01 + rb() * 0.02 };
	// children: the base mesh's child shape, at a child's height (about 0.95 m at three,
	// 1.4 m at eleven), slight, quick on their feet, in bright play clothes
	if (age < 16) {
		d.child = true;
		d.height = 0.78 + age * 0.056 + (r() - 0.5) * 0.06;
		d.muscle = 0; d.weight *= 0.35; d.build = null;
		d.hair = male ? (r() < 0.5 ? 'short01' : 'short02') : (r() < 0.7 ? 'ponytail01' : 'short01');
		d.hairColour = anc[0] + anc[1] > 0.6 ? HAIR_COLOURS[0] : HAIR_COLOURS[1 + Math.floor(r() * 5)];
		const o = d.outfit;
		o.jacket = null; o.sleeves = r() < 0.6 ? 'short' : 'long';
		o.top = KID_TOPS[Math.floor(r() * KID_TOPS.length)];
		o.legs = !male && r() < 0.25 ? 'skirt' : r() < 0.4 ? 'shorts' : 'long';
		o.shoes = KID_SHOES[Math.floor(r() * KID_SHOES.length)];
		d.gait = { stride: 0.9 + r() * 0.1, bounce: 1.2 + r() * 0.5, armSwing: 1 + r() * 0.5, posture: -0.02, pace: 1.0 + r() * 0.35 };
		d.temper.outgoing = 0.5 + r() * 0.5;
	}
	// what they are wearing today: by generation, place, weather and what they are doing
	// (wardrobe.js), from their own seed so it is the same every time; the flat description
	// above is kept for the places that still dress people by hand (if one changes it, the
	// body is dressed from that instead)
	const x = opts.ctx || {};
	const cl = x.cold === undefined ? climate({ hours: x.hours, place: x.place, rain: x.rain, month: x.month }) : { cold: x.cold, wet: !!x.wet };
	const rs = rng(seed ^ 0x57a1e);
	d.style = opts.style || dressFor(rs, d, { place: x.place, activity: opts.jogger ? 'jog' : x.activity, cold: cl.cold, wet: cl.wet, night: x.night ?? (x.hours !== undefined && (x.hours >= 20 || x.hours < 4)) });
	d.style.printKind = Math.floor(rs() * 9);
	d.style.hair = hairFor(rs, d, d.style);
	d.styleSig = JSON.stringify(d.outfit);
	if (opts.skin) d.skinOverride = opts.skin;
	// the face: its features and the colour of the eyes (a stream of its own, so the rest of
	// the person stays as they were)
	const rf = rng(seed ^ 0xfa1ce);
	d.face = faceDNA(rf, d);
	d.iris = irisOf(d, rf);
	return d;
}
// the outfit a body is dressed in: its style, unless its flat description was changed by hand
export function outfitOf(d) {
	if (d.style && (!d.styleSig || JSON.stringify(d.outfit) === d.styleSig)) return d.style;
	const o = fromFlat(d.outfit);
	o.hair = d.style?.hair || null;
	return o;
}
function pickOutfit(r, male, age, opts) {
	const P = (list) => list[Math.floor(r() * list.length)];
	const o = {
		top: P(CLOTH.top), bottom: P(CLOTH.bottom), shoes: P(CLOTH.shoes),
		sleeves: r() < 0.55 ? 'short' : 'long', jacket: r() < 0.35 ? P(CLOTH.jacket) : null,
		legs: 'long', fabricTop: r() < 0.5 ? 'knit' : 'canvas',
	};
	if (!male && r() < 0.28) o.legs = 'skirt';
	else if (r() < 0.2 && age < 60) o.legs = 'shorts';
	if (opts.jogger) { o.sleeves = 'short'; o.legs = 'shorts'; o.jacket = null; o.shoes = r() < 0.5 ? CLOTH.shoes[1] : [0.2, 0.5, 0.9]; o.top = P([[0.9, 0.3, 0.2], [0.2, 0.5, 0.9], [0.1, 0.1, 0.1], [0.95, 0.95, 0.95], [0.6, 0.85, 0.3]]); }
	if (o.jacket) o.sleeves = 'long';
	return o;
}

// ---------- building one ----------
// bodies built and not yet let go, across every system that makes them (the governor's report)
let live = 0;
export const bodyCount = () => live;
// and each of them, held weakly (one dropped without freeBody is let go with it), for whatever
// draws something under every body: the soft shade at their feet (world/footshade.js)
export const liveBodies = new Set();
export function buildPerson(A, d) { return runAll(buildPersonSteps(A, d)); }
// bodies built a few steps a frame, one at a time: queue(buildPersonSteps(...)) answers with the
// body when its last step has run; pump() runs the steps, ms a frame, from the owner's update
export function bodySlicer(ms = 6) {
	const jobs = [];
	return {
		queue: (gen) => new Promise((res, rej) => jobs.push({ gen, res, rej })),
		pump() {
			const b = jobs[0];
			if (!b) return;
			const t0 = performance.now();
			try { do { const r = b.gen.next(); if (r.done) { jobs.shift(); b.res(r.value); return; } } while (performance.now() - t0 < ms); }
			catch (e) { jobs.shift(); b.rej(e); }
		},
		busy: () => jobs.length > 0,
	};
}
// the same in steps (a generator: its yields are where a frame may end), so the crowd's bodies
// can be built a few steps a frame instead of one person in one long frame (people.js). A body
// built this way is not in the scene until it returns.
export function* buildPersonSteps(A, d) {
	const t0 = performance.now();
	live++;
	const { D, targets, unit } = A;
	// the shape: ancestry x sex x age, then muscle and weight
	const p = Float32Array.from(A.base, (x) => x * unit);
	// (a teen is part way from the child shape to the young one: d.growth, teens.js)
	const grown = d.growth ?? (d.age < 16 ? 0 : 1);
	const ageW = [['young', grown * (1 - clamp((d.age - 25) / 60))], ['old', grown * clamp((d.age - 25) / 60)], ['child', 1 - grown]];
	for (let a = 0; a < 3; a++) for (const [sx, w] of [['female', 1 - d.sex], ['male', d.sex]]) for (const [ag, wa] of ageW) {
		if (!wa) continue;
		const t = targets[['african', 'asian', 'caucasian'][a] + '-' + sx + '-' + ag], k = d.ancestry[a] * w * wa * unit;
		for (let i = 0; i < p.length; i++) p[i] += t[i] * k;
	}
	// (lean: leaner than the average body, the weight target taken away rather than added;
	// people/hero.js)
	for (const [sx, w] of [['female', 1 - d.sex], ['male', d.sex]]) for (const [n, amt] of [['maxmuscle-averageweight', d.muscle], ['averagemuscle-maxweight', d.weight - (d.lean || 0)]]) {
		const t = targets['universal-' + sx + '-young-' + n];
		for (let i = 0; i < p.length; i++) p[i] += t[i] * amt * w * unit;
	}
	// a build of its own (the hero's V: people/build.js)
	shapeBuild(p, A, d.build);
	// the face's own features
	shapeFace(A.faces, p, d.face);
	let min = Infinity, top = -Infinity;
	for (let i = 1; i < p.length; i += 3) { min = Math.min(min, p[i]); top = Math.max(top, p[i]); }
	const S = d.height / (top - min);
	for (let i = 0; i < p.length; i += 3) { p[i] *= S; p[i + 1] = (p[i + 1] - min) * S; p[i + 2] *= S; }

	// the skeleton at this body's joints
	const at = (ids) => { const v = new THREE.Vector3(); for (const id of ids) v.add(new THREE.Vector3(p[id * 3], p[id * 3 + 1], p[id * 3 + 2])); return v.multiplyScalar(1 / ids.length); };
	const heads = A.bones.map((b) => at(b.ids)), tails = A.bones.map((b) => b.tail ? at(b.tail) : null);
	const bones = A.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	A.bones.forEach((b, i) => { bones[i].position.copy(heads[i]); if (b.parent >= 0) { bones[i].position.sub(heads[b.parent]); bones[b.parent].add(bones[i]); } else body.add(bones[i]); });
	body.updateMatrixWorld(true);
	const skeleton = new THREE.Skeleton(bones);
	const map = Object.fromEntries(bones.map((b, i) => [b.name, i]));
	const rest = { heads, tails, dirs: heads.map((h, i) => tails[i] ? tails[i].clone().sub(h).normalize() : new THREE.Vector3(0, 1, 0)) };
	const cut = landmarks(A, p, heads, map, d.height);
	yield;
	// the ear lobes, for earrings: the lowest point of each ear
	const lobes = [null, null];
	{
		const hb = map.head, ey = (at(D.eyes.L).y + at(D.eyes.R).y) / 2, n = A.ids.length / 4, hv = [];
		let mx = 0;
		for (let v = 0; v < n; v++) {
			const y = p[v * 3 + 1];
			if (y < ey - 0.07 || y > ey + 0.03) continue;
			let sw = 0, hw = 0;
			for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; sw += w; if (A.ids[v * 4 + q] === hb) hw += w; }
			if (!sw || hw / sw < 0.6) continue;
			hv.push(v); mx = Math.max(mx, Math.abs(p[v * 3]));
		}
		for (const v of hv) {
			const x = p[v * 3], y = p[v * 3 + 1], k = x > 0 ? 0 : 1;
			if (Math.abs(x) > mx - 0.018 && (!lobes[k] || y < lobes[k].y)) lobes[k] = new THREE.Vector3(x, y, p[v * 3 + 2]);
		}
	}

	// eyes: little spheres with an iris, in the sockets, parented to the head
	const headI = map.head, headBone = bones[headI];
	const eyes = [], eyeAt = [];
	for (const side of ['L', 'R']) {
		const c = at(D.eyes[side]);
		let r = 0; for (const id of D.eyes[side]) r += Math.hypot(p[id * 3] - c.x, p[id * 3 + 1] - c.y, p[id * 3 + 2] - c.z); r /= D.eyes[side].length;
		const eye = new THREE.Mesh(eyeGeometry(), eyeMaterial(d.iris ?? 0));
		eye.scale.setScalar(Math.max(0.0105, r * 0.95));
		eye.position.copy(c).sub(heads[headI]);
		headBone.add(eye); eyes.push(eye); eyeAt.push(c);
	}
	const P = { root, body, bones, skeleton, map, rest, meshes: [], skin: null, cloth: null, acc: null, eyes, eyeAt, hair: null, detail: null, dna: d, height: d.height, legLength: heads[map['upperleg01.L']].y - heads[map['foot.L']].y, cut, lobes };
	// (culled by a sphere round its bones as posed, not its rest shape: body-bounds.js)
	boundBody(P);
	// skin: the painted maps tinted to the person (or a far world's skin)
	const skinKey = (d.ancestry[0] > 0.5 ? 'young_african' : d.age > 58 ? 'old_caucasian' : 'young_caucasian') + '_' + (d.male ? 'male' : 'female');
	const melanin = d.ancestry[0] * 0.55 + d.ancestry[1] * 0.12;
	const tint = new THREE.Color().setRGB(d.tone * (1 - melanin * (skinKey.startsWith('young_african') ? 0.1 : 0.55)), d.tone * (0.96 - melanin * (skinKey.startsWith('young_african') ? 0.1 : 0.62) + d.warmth * 0.02 + d.ancestry[1] * 0.02), d.tone * (0.9 - melanin * (skinKey.startsWith('young_african') ? 0.12 : 0.7) - d.ancestry[1] * 0.04));
	const skinMat = skinMaterial(A.tex[skinKey], tint, d.age);
	if (d.skinOverride) { skinMat.color.set(d.skinOverride.col); if (d.skinOverride.glow) { skinMat.emissive.set(d.skinOverride.col); skinMat.emissiveIntensity = d.skinOverride.glow; skinMat.userData.skin.value.set(0, 0.6, 0.5, 0); } }
	// one in a hundred has vitiligo (from a hash of the seed, so no one else's looks change)
	const vh = Math.imul((d.seed ?? 0) ^ 0x9e3779b9, 2654435761) >>> 0;
	if (!d.skinOverride && vh % 100 === 0) skinMat.userData.vit.value.set(1, (vh >>> 8) % 97, (vh >>> 12) % 89, (vh >>> 16) % 83);
	// (freckles for those made with them: people/hero.js)
	if (d.freckles) skinMat.userData.vit.value.set(2, (eyeAt[0].y + eyeAt[1].y) / 2, (vh >>> 12) % 89, (vh >>> 16) % 83);
	P.skinMat = skinMat;
	P._p = p;
	// their tattoos, as their life gave them (tattoo/lore.js): on the shared flash sheet
	if (!d.skinOverride) { const ink = inkFor(d); if (ink.length) applyInk(skinMat, P, ink, flashAtlas().tex); }
	P._S = S;
	P.redress = (o) => dress(A, P, o);
	P.redressSteps = (o) => dressSteps(A, P, o);
	yield* dressSteps(A, P, outfitOf(d));
	// lashes, brows, the wet line: one small mesh, closing and lifting with the face
	const brow = browOf(d), dg = A.faces && faceDetail(A, A.faces, P, p, S, rng(d.seed ^ 0xb50e), null, brow.grey);
	if (dg) {
		const dm = new THREE.SkinnedMesh(dg, detailMaterial(brow.col, brow.greyCol));
		// (how full the tone under the brow's hairs, each their own; or as set, d.brows.fill)
		dm.material.userData.U.uFill.value = d.brows?.fill ?? 1.6 + ((d.seed * 0.618034) % 1) * 0.4;
		cullPosed(P, dm); dm.renderOrder = 1;
		body.add(dm); dm.bind(skeleton, new THREE.Matrix4());
		dm.morphTargetInfluences = P.skin.morphTargetInfluences;
		P.detail = dm;
	}
	P.lod = (dist) => {
		armorEffectsLOD(P,dist);
		const near = dist < 28; if (P.eyes[0].visible !== near) for (const e of P.eyes) e.visible = near; if (P.detail) P.detail.visible = dist < 14; if (P.acc) P.acc.visible = dist < 90 || P.accKeep; for (const b of P.bags || []) b.lod(dist);
		// fluffy hair: all its tufts near, the locks' cores and inner layer further, the cores far off
		const hl = P.hair?.geometry.userData.lod;
		if (hl) { const k = PHONE ? 0.6 : 1, n = hl[dist < 6 * k ? 2 : dist < 16 * k ? 1 : 0]; if (P.hair.geometry.drawRange.count !== n) P.hair.geometry.setDrawRange(0, n); }
		// the sleeves' pose folds and hang (garment-shape.js): near people only, fading out by
		// 22 m, nearer still on a phone or when the governor has stepped quality down
		const U = P.clothMat?.userData.U;
		if (U) { const far = PHONE || tierNow() >= 2 ? 10 : 22; U.uPoseK.value.x = clamp((far - dist) / 6); }
	};
	P.buildMs = performance.now() - t0;
	liveBodies.add(new WeakRef(P));
	return P;
}

// dress (or re-dress) a body: its skin where the clothes leave it bare, the cloth, the
// small things, the hair
function dress(A, P, o) { return runAll(dressSteps(A, P, o)); }
// the same in steps (people.js runs them a few a frame). Re-dressing a body already dressed, what
// it wears stays on, and the new clothes and hair are kept hidden, until the last step has them
// all ready: no one stands bare for the frames in between.
function* dressSteps(A, P, o) {
	const d = P.dna, p = P._p, cut = P.cut, { bones, map, skeleton, rest, body } = P;
	// (P.skin and the rest point at the old pieces until each new one is made, in the same step,
	// so the motion and the fade never find a body without a skin between frames)
	const swap = !!P.skin, old = swap ? [P.skin, P.cloth, P.acc, P.hair, P.beard].filter(Boolean) : [], oldHair = swap ? [P.hair, P.beard] : [], oldBags = swap ? P.bags || [] : [];
	if (!swap) { for (const m of [P.skin, P.cloth, P.acc]) if (m) { m.geometry.dispose(); m.removeFromParent(); } for (const b of P.bags || []) b.remove(); }
	P.bags = [];
	P.outfit = o;
	const R = regions(o, cut);
	const part = partOf(A);
	const kinds = (tri) => { const k = { arm: 0, fore: 0, hand: 0, thigh: 0, shin: 0, foot: 0 }; for (const v of tri) { const q = part[v]; if (q === 1) k.arm++; else if (q === 2) k.fore++; else if (q === 3) k.hand++; else if (q === 4) k.thigh++; else if (q === 5) k.shin++; else if (q === 6) k.foot++; } return k; };
	// (the skin hidden under the cloth is left out, a little in from the garment's edge, so
	// nothing pokes through)
	const covered = (c, tri) => { const k = kinds(tri); return R.top(c, tri, k, 0.035) || R.outer(c, tri, k, 0.035) || R.bottom(c, tri, k, 0.035) || R.shoes(c, tri, k, 0.02); };
	const add = (geo, mat, shadow = true) => { const m = cullPosed(P, new THREE.SkinnedMesh(geo, mat)); m.castShadow = shadow; m.receiveShadow = true; body.add(m); m.bind(skeleton, new THREE.Matrix4()); if (swap) m.visible = false; return m; };
	const bodyGeo = yield* geometrySteps(A, p, A.body, (c, tri) => !covered(c, tri));
	faceMorphs(A, bodyGeo, P._S);
	bodyGeo.setAttribute('skinx', skinAttribute(A.faces, bodyGeo.userData.src));
	// the scalp: where close-cropped hair is painted (hair.js), to the cut's own hairline
	const H = o.hair || {}, cutName = H.cut || cutOf(d.hair);
	P.skull = P.skull || skullOf(A, p, P);
	const sc = scalpMask(A, P, p, P.skull, bodyGeo.userData.src, cutName, { recede: H.recede, thin: H.thin });
	bodyGeo.setAttribute('scalp', new THREE.BufferAttribute(sc, 1));
	bodyGeo.userData.scalp0 = sc.slice();
	P.skin = add(bodyGeo, P.skinMat);
	if (P.detail) P.detail.morphTargetInfluences = P.skin.morphTargetInfluences;
	yield;
	// hair and a beard (hairkit.js: real styles, fetched when first worn; hair.js grows the
	// locs, braids and cornrows, and stands in while a style is on its way)
	const hat = (o.acc || []).find((q) => /^(cap|trucker|peaked|beret|beanie|bucket|sunhat|fedora|trilby|helmet|hardhat|hood|hazhood|visor)$/.test(q.kind));
	const cols = hairColours(d, H);
	const covers = hat && hat.kind !== 'visor';
	const showHair = d.hair && !H.buzz && !H.scarf && !(covers && /^(helmet|hardhat|hood|hazhood)$/.test(hat.kind));
	// the scalp under it, painted: a close crop, or the shade between the strands
	// (under fluffy hair, the roots' own shade, nearly solid: a gap between its tufts is hair in
	// shadow, not skin)
	const fluffy = showHair && !H.style && FLUFFY.has(cutName);
	const paintCol = cols.hair.clone().multiplyScalar(fluffy ? 0.55 : H.dyed ? 0.5 : 0.9);
	P.skinMat.userData.scalp.value.set(paintCol.r, paintCol.g, paintCol.b, !d.hair || H.scarf ? 0 : H.buzz || covers ? 0.9 : H.thin ? 0.35 : fluffy ? 0.92 : 0.75);
	const beard = hat?.kind === 'hazhood' ? null : beardFor(d, H, rng(d.seed ^ 0xbea4d));
	P.skinMat.userData.beard.value.set(cols.stubble.r, cols.stubble.g, cols.stubble.b, beard ? beard.stubble : 0);
	bodyGeo.setAttribute('beard', new THREE.BufferAttribute(stubbleMask(A, bodyGeo.userData.src), 1));
	P.hairWant = { style: showHair && (H.style || !FLUFFY.has(cutName)) ? styleFor(d, H, cutName, rng(d.seed ^ 0x57e1e)) : null, beard: beard && beard.kind !== 'stubble' ? beard : null, cut: showHair ? cutName : null, hat, covers, cols, H };
	if (swap) P.hair = P.beard = null;          // (the old hair stays on, in old, till the end; hairUp would take it off)
	hairUp(A, P);
	if (swap) for (const m of [P.hair, P.beard]) if (m) m.visible = false;
	yield;
	// the clothes: one mesh, painted by garment
	const clothGeo = yield* clothGeometrySteps(A, p, o, cut, R);
	// Held items use the dressed torso's actual rest bounds, not bare-skin allowances.
	const cp = clothGeo.attributes.position, cs = clothGeo.attributes.slot;
	const envelope = { front: cut.frontZ, back: cut.backZ, width: Math.max(cut.waistX, cut.shoulderX * .92) };
	for (let i=0;i<cp.count;i++) if (cs.getX(i)<2 && cp.getY(i)>cut.waist-.06 && cp.getY(i)<cut.shoulder) {
		envelope.front=Math.max(envelope.front,cp.getZ(i));envelope.back=Math.min(envelope.back,cp.getZ(i));
		envelope.width=Math.max(envelope.width,Math.abs(cp.getX(i)));
	}
	P.heldTorso = envelope;
	if (!P.clothMat) { P.clothMat = garmentMaterial(A, o, cut, o.top?.number || 0); if (PHONE) P.clothMat.userData.U.uPoseK.value.x = 0; }
	else paint(P.clothMat, o);
	const sleeveEnd = { none: cut.shoulder, cap: cut.shoulder - 0.07, short: cut.elbow + 0.1, elbow: cut.elbow, rolled: cut.elbow - 0.07, long: cut.wrist }[o.top?.sleeves || 'short'] ?? cut.elbow;
	P.clothMat.userData.U.uHem.value.set(R.topHem, sleeveEnd, cut.waist + 0.02, R.legEnd);
	// the necklines, cut smooth (the cage's triangles would leave them ragged)
	P.clothMat.userData.U.uNeck.value.set(cut.neck - 0.005, cut.neck - 0.005, neckDrop(o.top), neckDrop(o.outer));
	P.clothMat.userData.U.uEdge.value.set(R.outHem, cut.shoulderX, o.outer?.sleeves === 'none' ? 1 : 0, o.outer ? 1 : 0);
	P.cloth = clothGeo.index.count ? add(clothGeo, P.clothMat) : null;
	if (!P.cloth) clothGeo.dispose();
	else { const cloth=P.cloth,caps=clothCapsules(P); calibrateCloth(clothGeo,caps); cloth.userData.capsules=caps; cloth.onBeforeRender=()=>poseCloth(P,caps,P.clothMat.userData.U,cloth); }
	yield;
	// the bags they carry: where each goes on this body, the straps laid over the clothes (bags.js)
	const carried = (o.acc || []).filter((q) => BAG_KINDS.has(q.kind));
	const surf = carried.some((q) => q.kind === 'backpack' || q.kind === 'crossbody' || q.kind === 'guitar') ? torsoSurface(A, p, clothGeo, bones, part, cut) : null;
	const fits = carried.length ? fitBags({ acc: carried }, cut, surf, P.heldTorso) : [];
	// caps, glasses, headphones, straps: one more mesh
	const accGeo = accessoryGeometry(A, { bones, map, heads: rest.heads, eyes: P.eyes.map((e) => e.position.clone().add(rest.heads[map.head])), rest, lobes: P.lobes, p, bags: fits, cloth: clothGeo, part, lo: PHONE }, o, cut, '#' + cols.hair.clone().multiplyScalar(1.1).getHexString());
	P.acc = accGeo ? add(accGeo, accessoryMaterial(), true) : null;
	// (boots built over the feet are among the small things, and are the feet: kept at any distance)
	P.accKeep = !!o.shoes?.built;
	// and the bags themselves, shared by everyone who carries one
	P.bags = fits.map((f) => attachBag(P, f, PHONE));
	P.meshes = [P.skin, P.cloth, P.acc].filter(Boolean);
	dressArmorEffects(P,o.relics || []);
	if (swap) {
		// the old clothes off, the new on, in the same frame
		for (const m of old) { m.removeFromParent(); m.geometry.dispose(); }
		for (const m of oldHair) if (m?.material?.userData?.U) m.material.dispose();
		for (const b of oldBags) b.remove();
		for (const m of [P.skin, P.cloth, P.acc, P.hair, P.beard]) if (m) m.visible = true;
		if (P.fadeK !== undefined) { const k = P.fadeK; P.fadeK = -1; fadePerson(P, k); }
	}
	return P;
}

// the hair's colours: its own (or a dye, the roots showing), and the beard's, which is the
// hair's natural colour, greying sooner (grey and white hair are never paper-white: some
// pigment is left, and it shades itself)
function hairColours(d, H) {
	// (the lightest blond is toned down whole, not clipped, so it stays blond, not grey)
	const g = greyOf(d), top = Math.max(...d.hairColour), natural = new THREE.Color(...d.hairColour.map((c) => c * Math.min(1, 0.5 / top)));
	// the grey hairs: grey, towards white in the eighties
	const grey = GREY.clone().lerp(WHITE, clamp((g - 0.85) / 0.15));
	const hair = H.dyed ? new THREE.Color(H.dyed) : natural.clone();
	const root = (H.dyed && !H.fresh ? natural.clone().lerp(grey, g * 0.8) : hair).clone().multiplyScalar(0.6), tip = hair.clone().multiplyScalar(H.dyed ? 0.95 : 1.0);
	// the beard greys a little ahead of the head, at the chin first
	const beard = natural.clone().multiplyScalar(0.85), beardSalt = Math.min(1, g * 1.2);
	return { natural, hair, root, tip, grey, beard, salt: H.dyed ? 0 : g, beardSalt, stubble: beard.clone().lerp(grey, beardSalt * 0.7).multiplyScalar(0.55) };
}

const GREY = new THREE.Color(0.42, 0.42, 0.4), WHITE = new THREE.Color(0.55, 0.55, 0.53);
// how much hair shines by how it grows
const SHINE = { straight: 1, wavy: 0.8, curly: 0.55, coily: 0.35 };

// (re)grow the hair and beard P wants: the real style if it is in, else the procedural cut
// while it comes (then again when it has)
function hairUp(A, P) {
	const t0 = performance.now(), W = P.hairWant, d = P.dna, p = P._p, { bones, map, skeleton, body } = P;
	// (a material someone else put on it, such as a ghost's, is theirs to keep)
	for (const k of ['hair', 'beard']) if (P[k]) { P[k].geometry.dispose(); if (P[k].material.userData.U) P[k].material.dispose(); P[k].removeFromParent(); P[k] = null; }
	const { cols, H, hat, covers } = W;
	const need = [W.style?.id, W.beard && (SHELLS[W.beard.kind] ? 'shells' : W.beard.kind)].filter(Boolean);
	const ready = need.every((id) => styleNow(id));
	// (when it comes: shown or hidden as the stand-in was, faded as the rest of them is)
	if (!ready) Promise.all(need.map(loadStyle)).then(() => {
		if (P.hairWant !== W) return;
		const vis = P.hair ? P.hair.visible : true;
		hairUp(A, P);
		if (P.hair) P.hair.visible = vis;
		if (P.fadeK !== undefined) { const k = P.fadeK; P.fadeK = -1; fadePerson(P, k); }
	}).catch(() => {});
	const capY = covers ? P.skull.eyeY + hatRim(hat.kind).clip : 99;
	const skinned = (g, m) => { const s = cullPosed(P, new THREE.SkinnedMesh(g, m)); s.castShadow = true; body.add(s); s.bind(skeleton, new THREE.Matrix4()); if (g.morphAttributes.position) s.morphTargetInfluences = P.skin.morphTargetInfluences; return s; };
	const tune = (m) => {
		const U = m.userData.U;
		U.uRoot.value.copy(cols.root); U.uTip.value.copy(cols.tip); U.uBeard.value.set(cols.beard.r, cols.beard.g, cols.beard.b, 1);
		U.uGrey.value.copy(cols.grey);
		U.uSalt.value.set(cols.salt, cols.beardSalt, styleNow(W.style?.id)?.grain === 0 ? 0 : 1, 0);
		U.uHC.value.copy(P.skull.c); U.uFace.value.set(P.skull.eyeY, P.skull.eyeZ);
		const [l0, l1] = P.lobes;
		if (l0 && l1) U.uEar.value.set((Math.abs(l0.x - P.skull.c.x) + Math.abs(l1.x - P.skull.c.x)) / 2, (l0.y + l1.y) / 2, (l0.z + l1.z) / 2, 1);
		U.uSpec.value.set(SHINE[STYLES[W.style?.id]] ?? 1, 0.2);
		U.uClip.value.set(capY, W.style?.fade ? W.style.fadeY : -99, W.style?.thin || 0, 0);
		return m;
	};
	const has = (id) => !id || styleNow(id);
	if (W.style?.fade) W.style.fadeY = P.skull.eyeY + 0.062 - (1 - W.style.fade) * 0.04;
	// the hair: the real style, or the procedural cut while it comes
	if (W.style && has(W.style.id)) {
		P.hair = skinned(hairGeometry(A, P, p, W.style, null, null), tune(kitMaterial(styleNow(W.style.id).tex)));
		// (a long groom parts its layers over the scalp, which the paint fills: it keeps all of it)
		coverScalp(P, styleNow(W.style.id).groom ? null : P.hair.geometry);
		// it falls over the collar and the shoulders, not through them (hair-collide.js)
		const o = P.outfit || {}, off = offsets(o), caps = hairCapsules(P, o, Math.max(off.top, off.outer));
		const hair = P.hair;
		const animate = hairMotion(P, hair, hair.material.userData.U);
		hair.onBeforeRender = () => { animate(); poseCapsules(P, caps, hair.material.userData.U, hair); };
	}
	else if (W.cut && FLUFFY.has(W.cut)) {
		// fluffy hair (hair-fluff.js): tufts in locks, brushed the cut's way, skinned to the head
		// and, as long hair falls, the neck and the back
		coverScalp(P, null);
		const g = buildFluff(A, P, p, W.cut, { skull: P.skull, rnd: rng(d.seed ^ 0x4a17), capY: covers ? hatRim(hat.kind).clip : undefined, recede: H.recede || 0, thin: H.thin || 0, partSide: H.part, volume: H.volume ?? H.vol, brush: H.brush, clothOff: Math.max(offsets(P.outfit || {}).top, offsets(P.outfit || {}).outer) });
		const root = cols.root.clone().lerp(cols.grey, cols.salt * cols.salt * 0.9), tip = cols.tip.clone().lerp(cols.grey, cols.salt * cols.salt * 0.9);
		const hair = skinned(g, fluffMaterial(root, tip));
		P.hair = hair;
		// it falls over the collar and the shoulders, not through them, as the head turns (hair-collide.js)
		const o = P.outfit || {}, off = offsets(o), caps = hairCapsules(P, o, Math.max(off.top, off.outer));
		hair.material.userData.U.uCapY.value = P.cut.neck + 0.02;
		const animate = hairMotion(P, hair, hair.material.userData.U);
		hair.onBeforeRender = () => { animate(); poseCapsules(P, caps, hair.material.userData.U, hair); };
	}
	else if (W.cut) {
		coverScalp(P, null);
		const g = buildHair(A, P, p, W.cut, { skull: P.skull, rnd: rng(d.seed ^ 0x4a17), capY: covers ? hatRim(hat.kind).clip : undefined, recede: H.recede || 0, thin: H.thin || 0, partSide: H.part });
		// (grey coming in evenly, root to tip)
		// (greying all over, as there are no single hairs to grey)
		const root = cols.root.clone().lerp(cols.grey, cols.salt * cols.salt * 0.9), tip = cols.tip.clone().lerp(cols.grey, cols.salt * cols.salt * 0.9);
		const hair = new THREE.Mesh(g, hairMaterial(root, tip));
		hair.castShadow = true;
		bones[map.head].add(hair);
		P.hair = hair;
		const animate = hairMotion(P, hair, hair.material.userData.U);
		hair.onBeforeRender = () => animate();
	}
	// the beard: drawn after the face, blended
	const bid = W.beard && (SHELLS[W.beard.kind] ? 'shells' : W.beard.kind);
	if (bid && has(bid)) {
		const g = hairGeometry(A, P, p, null, W.beard, rng(d.seed ^ 0xbead));
		if (g) { P.beard = skinned(g, tune(kitMaterial(SHELLS[W.beard.kind] ? null : styleNow(bid).tex, true))); P.beard.castShadow = false; P.beard.renderOrder = 2; }
	}
	for (const m of [P.hair, P.beard]) if (m && P.relit) P.relit(m);
	P.hairMs = performance.now() - t0;
}

// a skinned piece of the body from a face list: [vertex, uv] pairs, three per triangle
function* geometrySteps(A, p, faces, select) {
	const V = [], T = [], SI = [], SW = [], I = [], key = new Map(), src = [];
	const c = [0, 0, 0];
	for (let i = 0; i < faces.length; i += 6) {
		if (i && (i % 24576) === 0) yield;
		const tri = [faces[i], faces[i + 2], faces[i + 4]];
		for (let ax = 0; ax < 3; ax++) c[ax] = (p[tri[0] * 3 + ax] + p[tri[1] * 3 + ax] + p[tri[2] * 3 + ax]) / 3;
		if (select && !select(c, tri)) continue;
		for (let j = 0; j < 6; j += 2) {
			const id = faces[i + j], u = faces[i + j + 1], k0 = id * 65536 + u;
			let k = key.get(k0);
			if (k === undefined) {
				k = V.length / 3; key.set(k0, k); src.push(id);
				V.push(p[id * 3], p[id * 3 + 1], p[id * 3 + 2]);
				T.push(A.uv[u * 2] / 65535, 1 - A.uv[u * 2 + 1] / 65535);
				let sum = 0; for (let q = 0; q < 4; q++) sum += A.weights[id * 4 + q];
				for (let q = 0; q < 4; q++) { SI.push(A.ids[id * 4 + q]); SW.push(A.weights[id * 4 + q] / (sum || 1)); }
			}
			I.push(k);
		}
	}
	yield;
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
	g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
	g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
	g.setIndex(I);
	g.computeVertexNormals();
	// smooth normals across UV seams: average by source vertex
	const n = g.attributes.normal, acc = new Map();
	for (let i = 0; i < src.length; i++) { const a = acc.get(src[i]) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(src[i], a); }
	for (let i = 0; i < src.length; i++) { const a = acc.get(src[i]), l = Math.hypot(...a) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
	g.userData.src = src;
	g.computeBoundingSphere();
	return g;
}

// blink, smile, talk, raise the brows
function faceMorphs(A, g, S) {
	g.morphTargetsRelative = true;
	g.morphAttributes.position = [];
	const src = g.userData.src;
	for (const list of [['eye-left-closure', 'eye-right-closure'], ['mouth-open'], ['mouth-corner-puller'], ['eyebrows-left-up', 'eyebrows-right-up']]) {
		const delta = new Float32Array(src.length * 3);
		for (let i = 0; i < src.length; i++) for (const n of list) { const t = A.targets[n]; if (t) for (let c = 0; c < 3; c++) delta[i * 3 + c] += t[src[i] * 3 + c] * A.unit * S; }
		g.morphAttributes.position.push(new THREE.Float32BufferAttribute(delta, 3));
	}
}

// brows: the hair's natural colour (a dye leaves them be), a shade darker; going grey hair
// by hair on the head's own curve, some years behind it
// The crop painted on the scalp (hair.js scalpMask) runs down to the lowest a hair may root, the
// sideburns and the temples included; a style's own hairline is mostly higher. Under a style, keep
// the paint to where its hair lies over the scalp (fading out a centimetre or two from the
// nearest strand, as a hairline thins), never a band of paint where it leaves the skin bare, by
// the eyes and over the temples; a cut grown from the mask itself (hair: null) keeps it all.
function coverScalp(P, hair) {
	const sk = P.skin?.geometry, at = sk?.attributes.scalp, s0 = sk?.userData.scalp0;
	if (!at || !s0) return;
	if (!hair) { at.array.set(s0); at.needsUpdate = true; return; }
	const hp = hair.attributes.position, cell = 0.02, grid = new Map(), pos = sk.attributes.position;
	const key = (a, b, c) => a + ',' + b + ',' + c;
	for (let i = 0; i < hp.count; i++) {
		const k = key(Math.floor(hp.getX(i) / cell), Math.floor(hp.getY(i) / cell), Math.floor(hp.getZ(i) / cell));
		let L = grid.get(k);
		if (!L) grid.set(k, L = []);
		L.push(i);
	}
	for (let i = 0; i < at.count; i++) {
		if (!(s0[i] > 0)) { at.array[i] = s0[i]; continue; }
		const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
		let best = Infinity;
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
			const L = grid.get(key(gx + a, gy + b, gz + c));
			if (L) for (const j of L) { const d = (hp.getX(j) - x) ** 2 + (hp.getY(j) - y) ** 2 + (hp.getZ(j) - z) ** 2; if (d < best) best = d; }
		}
		const t = Math.min(1, Math.max(0, (Math.sqrt(best) - 0.01) / 0.01));
		at.array[i] = s0[i] * (1 - t * t * (3 - 2 * t));
	}
	at.needsUpdate = true;
}

function browOf(d) {
	// (a shade darker than fair hair; dark hair's brows lifted a little off black, which only
	// reads as a stroke; or as set, d.browTone)
	const top = Math.max(...d.hairColour), tone = d.browTone ?? 0.85 + 1.15 * (1 - clamp((top - 0.06) / 0.24));
	const col = new THREE.Color(...d.hairColour.map((c) => c * Math.min(1, 0.5 / top) * tone));
	// (and never quite black: the darkest a deep brown-black)
	const lum = Math.max(col.r, col.g, col.b);
	if (lum < 0.07) col.multiplyScalar(0.07 / Math.max(lum, 1e-4));
	const g = greyOf(d, 12);
	return { col, grey: g, greyCol: GREY.clone().lerp(WHITE, clamp((g - 0.85) / 0.15)) };
}

// a body let go for good: its own geometry, materials and skeleton (the shared assets stay)
export function freeBody(P) {
	clearArmorEffects(P);
	if (!P.freed) { P.freed = true; live = Math.max(0, live - 1); }
	// Eyes and accessories share materials; textures and eye geometry belong to assets.
	P.hairWant = null; // invalidate deferred hair-kit completion for this released body
	const sharedGeo = new Set((P.eyes || []).map(e => e.geometry));
	const geometry = new Set(); P.root.traverse(o => { if (o.geometry && !sharedGeo.has(o.geometry)) geometry.add(o.geometry); });
	for (const g of geometry) g.dispose();
	const materials = new Set([P.skinMat, P.clothMat, P.cloth?.material, P.hair?.material, P.beard?.material, P.detail?.material].filter(Boolean));
	for (const m of materials) m.dispose();
	P.skeleton?.dispose(); P.root.removeFromParent();
}
