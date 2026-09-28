// Crysis people: real human bodies. The CC0 MakeHuman base mesh from the caves build
// (19k vertices, 64-bone skeleton with fingers), shaped per person by its morph targets:
// ancestry (African, Asian, European, blended), sex, age, muscle and weight; heights from
// real population ranges. Skin from the painted skin maps, tinted to the person; eyes
// that move; fitted hair; and clothes cut from the body's own cloth cage so they follow the
// body, dressed for who the person is, where and what they are doing (wardrobe.js) and
// painted by one shader (garment.js): a cloth mesh, an accessories mesh, skin, eyes, hair.

import * as THREE from 'three';
import { dressFor, hairFor, fromFlat, climate } from './wardrobe.js';
import { garmentMaterial, paint, landmarks, partOf, regions, clothGeometry, accessoryGeometry, accessoryMaterial } from './garment.js';

const TEX = (f) => new URL(`../../textures/${f}`, import.meta.url).href;
const RIG_URL = new URL('../assets/people/rig150.json', import.meta.url).href;
const BASE_FILE = 'human-base-dd84ad3d07.json.gz';
const SKINS = {
	young_caucasian_female: 'human-young_caucasian_female-dd2fc42c44.webp', young_caucasian_male: 'human-young_caucasian_male-e1639aeae1.webp',
	old_caucasian_female: 'human-old_caucasian_female-5c8b8cd784.webp', old_caucasian_male: 'human-old_caucasian_male-4126648f8f.webp',
	young_african_female: 'human-young_african_female-2c0f99940e.webp', young_african_male: 'human-young_african_male-8b9e87bf3a.webp',
};
const HAIR = { short01: 'human-hair-short01-a0ac470402.webp', short02: 'human-hair-short02-880498da47.webp', ponytail01: 'human-hair-ponytail01-0958cf0101.webp' };

const decode = (s, Type) => { const a = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new Type(a.buffer); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- assets, loaded once ----------
let assets = null;
export function loadPeopleAssets() {
	if (assets) return assets;
	assets = (async () => {
		const gz = await fetch(TEX(BASE_FILE));
		if (!gz.ok) throw Error('human base mesh ' + gz.status);
		const text = await new Response(gz.body.pipeThrough(new DecompressionStream('gzip'))).text();
		const D = JSON.parse(text);
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
		const load = (f, srgb) => new Promise((ok, no) => loader.load(TEX(f), (t) => { t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; ok(t); }, undefined, no));
		await Promise.all([...Object.entries(SKINS).map(async ([k, f]) => { A.tex[k] = await load(f, true); }), ...Object.entries(HAIR).map(async ([k, f]) => { A.tex['hair_' + k] = await load(f, true); })]);
		A.fabric = fabricTextures();
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
const HAIR_COLOURS = [[0.07, 0.05, 0.04], [0.12, 0.08, 0.05], [0.25, 0.16, 0.09], [0.4, 0.28, 0.16], [0.6, 0.45, 0.26], [0.75, 0.62, 0.42], [0.35, 0.12, 0.06], [0.72, 0.72, 0.7], [0.9, 0.9, 0.88]];
// clothes: what people in the Bay Area actually wear (lots of navy, grey, black, denim, earth tones, the odd bright)
const CLOTH = {
	top: [[0.08, 0.1, 0.18], [0.35, 0.36, 0.38], [0.06, 0.06, 0.07], [0.93, 0.92, 0.9], [0.55, 0.6, 0.66], [0.3, 0.36, 0.24], [0.62, 0.48, 0.34], [0.5, 0.12, 0.12], [0.12, 0.3, 0.5], [0.9, 0.7, 0.3], [0.85, 0.5, 0.55], [0.2, 0.45, 0.42], [0.7, 0.72, 0.74]],
	jacket: [[0.08, 0.09, 0.12], [0.3, 0.26, 0.2], [0.18, 0.22, 0.16], [0.55, 0.45, 0.32], [0.12, 0.18, 0.3], [0.45, 0.46, 0.48], [0.62, 0.2, 0.12]],
	bottom: [[0.12, 0.18, 0.3], [0.2, 0.28, 0.42], [0.06, 0.06, 0.07], [0.35, 0.33, 0.3], [0.58, 0.5, 0.38], [0.3, 0.3, 0.32], [0.16, 0.2, 0.14], [0.5, 0.56, 0.66]],
	shoes: [[0.06, 0.05, 0.05], [0.9, 0.9, 0.88], [0.3, 0.2, 0.13], [0.45, 0.45, 0.46], [0.15, 0.2, 0.35]],
};

const KID_TOPS = [[0.9, 0.25, 0.2], [0.2, 0.55, 0.9], [0.95, 0.75, 0.2], [0.35, 0.7, 0.35], [0.85, 0.45, 0.7], [0.55, 0.35, 0.8], [0.95, 0.95, 0.95], [0.2, 0.7, 0.75]];
const KID_SHOES = [[0.9, 0.9, 0.88], [0.9, 0.3, 0.3], [0.2, 0.4, 0.8], [0.95, 0.6, 0.8], [0.1, 0.1, 0.1]];

export function personDNA(seed, opts = {}) {
	const r = rng(seed ^ 0x5eed1e);
	// the Bay Area: roughly a third Asian, a third European, Hispanic and African American,
	// many of mixed heritage; the base mesh's three ancestry targets blend to cover it
	const roll = r();
	let anc = roll < 0.34 ? [0.05, 0.85, 0.1] : roll < 0.62 ? [0.02, 0.06, 0.92] : roll < 0.82 ? [0.18, 0.2, 0.62] : roll < 0.92 ? [0.85, 0.02, 0.13] : [r(), r(), r()];
	anc = anc.map((v) => v * (0.8 + r() * 0.4)); const s = anc.reduce((a, b) => a + b, 0); anc = anc.map((v) => v / s);
	const sex = r() < 0.5 ? 0.08 + r() * 0.12 : 0.8 + r() * 0.15;
	const male = sex > 0.5;
	let age = opts.age ?? (18 + Math.pow(r(), 1.3) * 64);
	const height = (male ? 1.755 : 1.625) + (r() + r() + r() - 1.5) * 0.085 - (age > 65 ? 0.03 : 0) - anc[1] * 0.04;
	const d = {
		seed, sex, male, ancestry: anc, age, height, muscle: r() * 0.5 * (male ? 1 : 0.6), weight: Math.pow(r(), 1.6) * 0.7,
		tone: 0.9 + r() * 0.14, warmth: r(),
		hair: age > 70 && male && r() < 0.35 ? null : male ? (r() < 0.6 ? 'short02' : 'short01') : (r() < 0.55 ? 'ponytail01' : r() < 0.6 ? 'short01' : 'short02'),
		hairColour: age > 62 ? (r() < 0.6 ? HAIR_COLOURS[7 + (r() < 0.5 ? 1 : 0)] : HAIR_COLOURS[2]) : anc[0] + anc[1] > 0.6 ? HAIR_COLOURS[r() < 0.8 ? 0 : 1] : HAIR_COLOURS[Math.floor(r() * 7)],
		outfit: pickOutfit(r, male, age, opts),
		gait: { stride: 0.95 + r() * 0.12, bounce: 0.8 + r() * 0.5, armSwing: 0.7 + r() * 0.6, posture: (r() - 0.5) * 0.08 + (age > 65 ? 0.08 : 0), pace: 1.18 + r() * 0.3 - (age > 65 ? 0.3 : 0) },
		// temperament: how outgoing (bigger, more frequent gestures, head up, arms swinging),
		// how sure of themselves (chest up or a slump), and their usual mood
		temper: { outgoing: r(), confident: r(), warmth: r(), fidget: r() },
	};
	// children: the base mesh's child shape, at a child's height (about 0.95 m at three,
	// 1.4 m at eleven), slight, quick on their feet, in bright play clothes
	if (age < 16) {
		d.child = true;
		d.height = 0.78 + age * 0.056 + (r() - 0.5) * 0.06;
		d.muscle = 0; d.weight *= 0.35;
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
	d.style = opts.style || dressFor(rs, d, { place: x.place, activity: opts.jogger ? 'jog' : x.activity, cold: cl.cold, wet: cl.wet });
	d.style.printKind = Math.floor(rs() * 9);
	d.style.hair = hairFor(rs, d, d.style);
	d.styleSig = JSON.stringify(d.outfit);
	if (opts.skin) d.skinOverride = opts.skin;
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
export function buildPerson(A, d) {
	const t0 = performance.now();
	const { D, targets, unit } = A;
	// the shape: ancestry x sex x age, then muscle and weight
	const p = Float32Array.from(A.base, (x) => x * unit);
	const ageW = [['young', d.age < 16 ? 0 : 1 - clamp((d.age - 25) / 60)], ['old', d.age < 16 ? 0 : clamp((d.age - 25) / 60)], ['child', d.age < 16 ? 1 : 0]];
	for (let a = 0; a < 3; a++) for (const [sx, w] of [['female', 1 - d.sex], ['male', d.sex]]) for (const [ag, wa] of ageW) {
		if (!wa) continue;
		const t = targets[['african', 'asian', 'caucasian'][a] + '-' + sx + '-' + ag], k = d.ancestry[a] * w * wa * unit;
		for (let i = 0; i < p.length; i++) p[i] += t[i] * k;
	}
	for (const [sx, w] of [['female', 1 - d.sex], ['male', d.sex]]) for (const [n, amt] of [['maxmuscle-averageweight', d.muscle], ['averagemuscle-maxweight', d.weight]]) {
		const t = targets['universal-' + sx + '-young-' + n];
		for (let i = 0; i < p.length; i++) p[i] += t[i] * amt * w * unit;
	}
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

	// eyes: little spheres with an iris, in the sockets, parented to the head
	const headI = map.head, headBone = bones[headI];
	const eyes = [], eyeAt = [];
	for (const side of ['L', 'R']) {
		const c = at(D.eyes[side]);
		let r = 0; for (const id of D.eyes[side]) r += Math.hypot(p[id * 3] - c.x, p[id * 3 + 1] - c.y, p[id * 3 + 2] - c.z); r /= D.eyes[side].length;
		const eye = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.0105, r * 0.95), 16, 12), eyeMaterial(d));
		eye.position.copy(c).sub(heads[headI]);
		headBone.add(eye); eyes.push(eye); eyeAt.push(c);
	}
	const P = { root, body, bones, skeleton, map, rest, meshes: [], skin: null, cloth: null, acc: null, eyes, hair: null, dna: d, height: d.height, legLength: heads[map['upperleg01.L']].y - heads[map['foot.L']].y, cut };
	// skin: the painted maps tinted to the person (or a far world's skin)
	const skinKey = (d.ancestry[0] > 0.5 ? 'young_african' : d.age > 58 ? 'old_caucasian' : 'young_caucasian') + '_' + (d.male ? 'male' : 'female');
	const melanin = d.ancestry[0] * 0.55 + d.ancestry[1] * 0.12;
	const tint = new THREE.Color().setRGB(d.tone * (1 - melanin * (skinKey.startsWith('young_african') ? 0.1 : 0.55)), d.tone * (0.96 - melanin * (skinKey.startsWith('young_african') ? 0.1 : 0.62) + d.warmth * 0.02 + d.ancestry[1] * 0.02), d.tone * (0.9 - melanin * (skinKey.startsWith('young_african') ? 0.12 : 0.7) - d.ancestry[1] * 0.04));
	const skinMat = new THREE.MeshPhysicalMaterial({ map: A.tex[skinKey], color: tint, roughness: 0.55, metalness: 0, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.9, 0.5, 0.4) });
	if (d.skinOverride) { skinMat.color.set(d.skinOverride.col); if (d.skinOverride.glow) { skinMat.emissive.set(d.skinOverride.col); skinMat.emissiveIntensity = d.skinOverride.glow; } }
	// a little light scattering under the skin: warm the terminator; and a close crop of hair
	// painted on the scalp (a buzz cut, or what shows under a cap)
	const scalpU = { value: new THREE.Vector4(0, 0, 0, 0) };
	skinMat.userData.scalp = scalpU;
	skinMat.onBeforeCompile = (sh) => {
		sh.uniforms.uScalp = scalpU;
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float scalp;\nvarying float vScalp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvScalp = scalp;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uScalp;\nvarying float vScalp;')
			.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uScalp.rgb * (0.8 + 0.4 * fract(sin(dot(floor(vUv * 900.0), vec2(12.9898, 78.233))) * 43758.5453)), smoothstep(0.2, 0.8, vScalp) * uScalp.w);')
			.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse += reflectedLight.directDiffuse * vec3(0.16, 0.03, 0.0);');
	};
	P.skinMat = skinMat;
	P._p = p;
	P._S = S;
	P.redress = (o) => dress(A, P, o);
	dress(A, P, outfitOf(d));
	P.lod = (dist) => { const near = dist < 28; if (P.eyes[0].visible !== near) for (const e of P.eyes) e.visible = near; if (P.acc) P.acc.visible = dist < 90; };
	P.buildMs = performance.now() - t0;
	return P;
}

// dress (or re-dress) a body: its skin where the clothes leave it bare, the cloth, the
// small things, the hair
function dress(A, P, o) {
	const d = P.dna, p = P._p, cut = P.cut, { bones, map, skeleton, rest, body } = P;
	for (const m of [P.skin, P.cloth, P.acc]) if (m) { m.geometry.dispose(); m.removeFromParent(); }
	if (P.hair) { P.hair.geometry.dispose(); P.hair.material.dispose(); P.hair.removeFromParent(); P.hair = null; }
	P.outfit = o;
	const R = regions(o, cut);
	const part = partOf(A);
	const kinds = (tri) => { const k = { arm: 0, fore: 0, hand: 0, thigh: 0, shin: 0, foot: 0 }; for (const v of tri) { const q = part[v]; if (q === 1) k.arm++; else if (q === 2) k.fore++; else if (q === 3) k.hand++; else if (q === 4) k.thigh++; else if (q === 5) k.shin++; else if (q === 6) k.foot++; } return k; };
	// (the skin hidden under the cloth is left out, a little in from the garment's edge, so
	// nothing pokes through)
	const covered = (c, tri) => { const k = kinds(tri); return R.top(c, tri, k, 0.035) || R.outer(c, tri, k, 0.035) || R.bottom(c, tri, k, 0.035) || R.shoes(c, tri, k, 0.02); };
	const add = (geo, mat, shadow = true) => { const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true; body.add(m); m.bind(skeleton, new THREE.Matrix4()); return m; };
	const bodyGeo = geometry(A, p, A.body, (c, tri) => !covered(c, tri));
	faceMorphs(A, bodyGeo, P._S);
	// the scalp: where cropped hair is painted
	const src = bodyGeo.userData.src, sc = new Float32Array(src.length), eyeY = P.eyes[0].position.y + rest.heads[map.head].y, hb = map.head;
	for (let i = 0; i < src.length; i++) {
		const v = src[i]; let sum = 0, hw = 0;
		for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; sum += w; if (A.ids[v * 4 + q] === hb) hw += w; }
		const y = p[v * 3 + 1], z = p[v * 3 + 2], front = z > cut.skull.z1 - 0.05;
		sc[i] = sum && hw / sum > 0.7 ? clamp((y - eyeY - (front ? 0.055 : -0.03)) / 0.02) * (front || y > eyeY - 0.06 ? 1 : 0) : 0;
	}
	bodyGeo.setAttribute('scalp', new THREE.BufferAttribute(sc, 1));
	P.skin = add(bodyGeo, P.skinMat);
	// hair, fitted to this skull: its colour (or a dye), fuller for some, cropped or up
	const H = o.hair || {};
	const hat = (o.acc || []).find((q) => /^(cap|beanie|bucket|sunhat|helmet|hood|hazhood|visor)$/.test(q.kind));
	const hairCol = H.dyed ? new THREE.Color(H.dyed).multiplyScalar(1.25) : new THREE.Color(...d.hairColour).multiplyScalar(2.2);
	const covers = hat && hat.kind !== 'visor';
	const showHair = d.hair && !H.buzz && !H.scarf && !(covers && (d.hair !== 'ponytail01' || /^(helmet|hood|hazhood)$/.test(hat.kind)));
	P.skinMat.userData.scalp.value.set(hairCol.r * 0.45, hairCol.g * 0.45, hairCol.b * 0.45, d.hair && (H.buzz || covers) && !H.scarf ? 0.9 : 0);
	if (showHair) {
		const headI = map.head;
		const hair = fitHair(A, p, d.hair, rest.heads[headI]);
		hair.material = new THREE.MeshStandardMaterial({ map: A.tex['hair_' + d.hair], color: hairCol, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6 });
		hair.castShadow = true;
		if (H.volume > 1) { const sk = cut.skull, c = new THREE.Vector3((sk.x0 + sk.x1) / 2, (sk.y0 + sk.y1) / 2, (sk.z0 + sk.z1) / 2).sub(rest.heads[headI]); hair.scale.set(H.volume, 1 + (H.volume - 1) * 0.6, H.volume); hair.position.copy(c).multiplyScalar(1 - H.volume); hair.position.y = c.y * (1 - hair.scale.y); }
		// (under a cap only the ponytail shows)
		if (covers) hair.scale.multiplyScalar(0.96);
		bones[headI].add(hair);
		P.hair = hair;
	}
	// the clothes: one mesh, painted by garment
	const clothGeo = clothGeometry(A, p, o, cut, R);
	if (!P.clothMat) P.clothMat = garmentMaterial(A, o, cut, o.top?.number || 0);
	else paint(P.clothMat, o);
	const sleeveEnd = { none: cut.shoulder, cap: cut.shoulder - 0.07, short: cut.elbow + 0.1, elbow: cut.elbow, long: cut.wrist }[o.top?.sleeves || 'short'] ?? cut.elbow;
	P.clothMat.userData.U.uHem.value.set(R.topHem, sleeveEnd, cut.waist + 0.02, R.legEnd);
	P.cloth = clothGeo.index.count ? add(clothGeo, P.clothMat) : null;
	if (!P.cloth) clothGeo.dispose();
	// caps, glasses, headphones, bags: one more mesh
	const accGeo = accessoryGeometry(A, { bones, map, heads: rest.heads, eyes: P.eyes.map((e) => e.position.clone().add(rest.heads[map.head])), rest }, o, cut, '#' + new THREE.Color(hairCol).multiplyScalar(0.55).getHexString());
	P.acc = accGeo ? add(accGeo, accessoryMaterial(), true) : null;
	P.meshes = [P.skin, P.cloth, P.acc].filter(Boolean);
	return P;
}

// a skinned piece of the body from a face list: [vertex, uv] pairs, three per triangle
function geometry(A, p, faces, select) {
	const V = [], T = [], SI = [], SW = [], I = [], key = new Map(), src = [];
	const c = [0, 0, 0];
	for (let i = 0; i < faces.length; i += 6) {
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

// the hair proxy: each vertex hangs off three body vertices plus a scaled offset
function fitHair(A, p, name, headCenter) {
	const a = A.D.hairMeshes[name];
	const ids = decode(a.ids, Uint16Array), w = decode(a.weights, Float32Array), off = decode(a.offsets, Float32Array), uv = decode(a.uv, Uint16Array), faces = decode(a.faces, Uint16Array);
	const scale = ['x', 'y', 'z'].map((axis, j) => { const [a0, b, n] = a.scales[axis]; return Math.abs(p[a0 * 3 + j] - p[b * 3 + j]) / n; });
	const pos = [];
	for (let i = 0; i < ids.length; i += 3) for (let c = 0; c < 3; c++) { let x = off[i + c] * scale[c]; for (let j = 0; j < 3; j++) x += p[ids[i + j] * 3 + c] * w[i + j]; pos.push(x - headCenter.getComponent(c)); }
	const V = [], T = [], I = [], key = new Map();
	for (let i = 0; i < faces.length; i += 2) {
		const id = faces[i], u = faces[i + 1], k0 = id + ':' + u;
		let k = key.get(k0);
		if (k === undefined) { k = V.length / 3; key.set(k0, k); V.push(pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2]); T.push(uv[u * 2] / 65535, 1 - uv[u * 2 + 1] / 65535); }
		I.push(k);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
	g.setIndex(I); g.computeVertexNormals();
	return new THREE.Mesh(g);
}

let irisCache = null;
function eyeMaterial(d) {
	if (!irisCache) irisCache = new Map();
	const key = d.ancestry[2] > 0.7 ? Math.floor(d.seed % 4) : 0;
	if (!irisCache.has(key)) {
		const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
		g.fillStyle = '#f2eee8'; g.fillRect(0, 0, 128, 128);
		const col = ['#3b2414', '#4a6a8a', '#5b6b3a', '#6b4a24'][key];
		// the iris faces +z: on a sphere's default UV the front sits at u = 0.25, v = 0.5
		const cx = 32, cy = 64;
		// the iris spans about 60 degrees of the eyeball: 21 px of u (360 deg), 43 px of v (180 deg)
		g.save(); g.translate(cx, cy); g.scale(1, 2);
		const grd = g.createRadialGradient(0, 0, 1, 0, 0, 11); grd.addColorStop(0, '#040404'); grd.addColorStop(0.36, '#040404'); grd.addColorStop(0.42, col); grd.addColorStop(0.9, col); grd.addColorStop(1, '#1c1814');
		g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
		// fibres radiating from the pupil
		g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.6;
		for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5); g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); g.stroke(); }
		g.restore();
		// a faint pink at the corners of the white
		g.fillStyle = 'rgba(210,120,110,0.25)'; g.fillRect(0, 44, 8, 40); g.fillRect(56, 44, 8, 40);
		const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
		irisCache.set(key, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }));
	}
	return irisCache.get(key);
}
