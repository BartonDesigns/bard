// The creatures' bodies: one model per kind (assets/creatures, made by tools/monsters), loaded
// the first time one is wanted, decoded off the main thread (meshopt in workers, WebP by the
// browser), and cloned for each one in the world (they share the mesh and its paint; each has
// its own bones). A phone keeps the paint at half size (a quarter of the memory).
//
// A body comes with its motion (creatures/motion.js) and its hit zones: a capsule along each
// bone, as thick as the bone's own flesh, named the way combat/health.js weighs a blow (the
// head, the torso, a limb). The things it holds (a spade, a lantern) are not part of it.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GFX_PHONE } from '../world/device.js';
import { createCreatureMotion } from './motion.js';
import { ragdollPieces } from './rig.js';

const url = (id) => new URL(`../assets/creatures/${id}.glb`, import.meta.url).href;

let loader = null;
function gltf() {
	if (loader) return loader;
	MeshoptDecoder.useWorkers?.(2);
	loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	return loader;
}
function halve(t) {
	const im = t?.image;
	if (!GFX_PHONE || !im || im.width <= 512) return;
	const cv = document.createElement('canvas');
	cv.width = im.width >> 1; cv.height = im.height >> 1;
	cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
	im.close?.();
	t.image = cv; t.needsUpdate = true;
}

const cache = new Map();
// the model of a kind, once: { scene, meta }
export function loadCreature(id) {
	if (!cache.has(id)) {
		cache.set(id, gltf().loadAsync(url(id)).then((g) => {
			const meta = g.scene.userData.creature || g.userData?.creature;
			if (!meta) throw new Error(`creature ${id}: no meta in the model`);
			g.scene.traverse((o) => {
				if (!o.isMesh) return;
				o.castShadow = true; o.receiveShadow = true;
				// (the bones move it: its bounds are the rig's, kept by hand below)
				o.frustumCulled = false;
				const m = o.material;
				for (const k of ['map', 'normalMap', 'emissiveMap']) halve(m[k]);
				// (a phone draws no bumps on them: the paint carries the detail)
				if (GFX_PHONE && m.normalMap) { m.normalMap = null; m.needsUpdate = true; }
			});
			return { scene: g.scene, meta };
		}).catch((e) => { cache.delete(id); throw e; }));
	}
	return cache.get(id);
}

// (the Lampeater's glowing abdomen is its weak point; its wings are the big mass to hit)
// (a rider's parts are weighed as the beast's: the goblin on the Hound Rider's back)
const PART = (n) => { const name = n.replace(/^rider_/, ''); return /^(head|neck|ear)/.test(name) ? 'head' : /^abdomen/.test(name) ? 'weak' : /^(hips|spine|chest|robe|cloak|wing|mane|seat)/.test(name) ? 'torso' : 'limb'; };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// one body of a kind: { root, motion, meta, shapes(out), height, vary(), rig() }; weak: the
// bones of its weak point (catalog.js weak), hit zones of part 'vital'
export async function makeCreature(id, { weak = null } = {}) {
	const { scene, meta: meta0 } = await loadCreature(id);
	// (its own copy: one model can serve two kinds, each with its own timing)
	const meta = { ...meta0 };
	const root = cloneSkinned(scene);
	root.name = `creature-${id}`;
	const motion = createCreatureMotion(root, meta);
	// each bone's far end in its own frame, from the rig's joints at rest
	root.updateMatrixWorld(true);
	let skel = null;
	root.traverse((o) => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
	const props = new Set(meta.props || []);
	const zones = [];
	const san = (n) => n.replace(/[\s.[\]:/]/g, '');
	for (const name of meta.bones) {
		if (props.has(name)) continue;
		const b = skel?.bones.find((q) => q.name === san(name) || q.name === name);
		const j = meta.joints?.[name];
		if (!b || !j) continue;
		const tail = b.worldToLocal(new THREE.Vector3(...j[1]).applyMatrix4(root.matrixWorld));
		zones.push({ b, tail, r: Math.max(0.04, (meta.radii?.[name] || 0.08) * 0.9), part: weak?.bones?.includes(name) ? 'vital' : PART(name), name });
	}
	// the hit zones where the bones are now: capsules in world space, reused
	const shapes = zones.map((z) => ({ type: 'capsule', a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 }, r: z.r, part: z.part, bone: z.name }));
	function hitShapes() {
		for (let i = 0; i < zones.length; i++) {
			const z = zones[i], s = shapes[i];
			z.b.getWorldPosition(_a);
			_b.copy(z.tail).applyMatrix4(z.b.matrixWorld);
			s.a.x = _a.x; s.a.y = _a.y; s.a.z = _a.z;
			s.b.x = _b.x; s.b.y = _b.y; s.b.z = _b.z;
		}
		return shapes;
	}
	// each one its own paint (sharing the kind's textures), so it can be tinted on its own; and
	// how it sits in the light round it (lit()): how high off the ground the earth's shade on it
	// reaches, in the model's metres, and how dark at the feet, the sky's light round its edges,
	// the sun's or the moon's behind it (a flyer is up in the air: no ground shade on it)
	const tint = { value: new THREE.Vector3(0, 1, 1) };
	const H0 = meta.height || 2;
	const air = { value: new THREE.Vector4(Math.min(1.2, Math.max(0.3, H0 * 0.28)), meta.rig === 'flyer' ? 0 : 0.42, 0.5, 0.85) };
	root.traverse((o) => {
		if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => tintable(m, tint, air)) : tintable(o.material, tint, air);
	});
	const bonesBy = new Map((skel?.bones || []).map((b) => [b.name, b]));
	const bone = (n) => bonesBy.get(san(n)) || bonesBy.get(n);
	// no two of a kind alike: a size up to a tenth either way, a little stockier or leaner,
	// longer or shorter in the body, its head, ears and tail a touch different, and its hide's
	// colour turned a little round the wheel, richer or paler, darker or lighter. hue: how far
	// the colour may wander (0 keeps it: a person's skin); sat and val: its colour's strength and
	// lightness, times (the Moon's hounds bleached white: catalog.js moon). And who it is, drawn
	// afresh (creatures/motion.js character(): its stance, its arms, its head, its stride, out of
	// step with the rest of its mob); tame: a person still (the Moonturned before the change)
	function vary(rnd = Math.random, { hue = 1, sat = 1, val = 1, tame = false } = {}) {
		motion?.character(rnd, { tame });
		const r2 = () => (rnd() + rnd()) - 1; // -1..1, most near the middle
		const k = 1 + r2() * 0.1;
		root.scale.set(k * (1 + r2() * 0.06), k * (1 + r2() * 0.035), k * (1 + r2() * 0.05));
		const head = bone('head'), tail = bone('tail1'), ek = 1 + r2() * 0.14;
		head?.scale.setScalar(1 + r2() * 0.08);
		tail?.scale.setScalar(1 + r2() * 0.12);
		for (const n of ['ear_L', 'ear_R']) bone(n)?.scale.setScalar(ek);
		tint.value.set(r2() * 0.24 * hue, (1 + r2() * 0.2 * Math.max(0.4, hue)) * sat, (1 + r2() * 0.12) * val);
		return k;
	}
	// its body as solid pieces for going limp (creatures/rig.js picks them; people/ragdoll.js
	// drops them): the same one object each time, refreshed to the body's size now, so the
	// ragdoll it is in can be found again by it (rag.ragdoll while it lies there)
	const metaName = new Map(zones.map((z) => [z.b.name, z.name]));
	const parentOf = (n) => { const b = bone(n); return b?.parent?.isBone ? metaName.get(b.parent.name) || null : null; };
	const rag = { rig: true, root, pieces: [], mass: 0, height: meta.height || 2, ragdoll: false, rested: false, at: null };
	function rig() {
		const sc = root.scale.x || 1;
		const R2 = ragdollPieces(meta, parentOf, { scale: sc, max: GFX_PHONE ? 14 : 22 });
		const zone = new Map(zones.map((z) => [z.name, z]));
		rag.pieces = R2.pieces.map((p) => { const z = zone.get(p.n); return z ? { ...p, b: z.b, tail: z.tail } : null; }).filter(Boolean);
		rag.mass = R2.mass; rag.height = (meta.height || 2) * sc;
		return rag;
	}
	const c = { id, root, motion, meta, shapes: hitShapes, height: meta.height || 2, vary, rig, rag, air };
	return c;
}

// a creature's paint with a colour turn of its own: the hide's colour (only the painted map, not
// its glow) turned round the hue wheel by x radians, its saturation times y, its value times z.
// And lit as a thing standing in the world is, not a picture laid over it (Josh 2026-10-24: "they
// just look stamped on"): the sky shut out round its feet, darker toward the ground (air.x the
// height that reaches, in the model's metres, air.y how dark), the undersides (chin, armpits,
// belly) in their own shade, the sky's light wrapping its edges (air.z) and the sun or the moon
// behind it lighting a rim (air.w), only where that light reaches it (its shadow kept). The same
// program for every creature (one cache key): only the numbers are each its own
function tintable(m0, tint, air) {
	const m = m0.clone();
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uVary = tint;
		sh.uniforms.uCrAir = air;
		sh.vertexShader = 'varying float vCrY;\n' + sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
	vCrY = transformed.y;`);
		sh.fragmentShader = 'uniform vec3 uVary;\nuniform vec4 uCrAir;\nvarying float vCrY;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
	{
		vec3 c = diffuseColor.rgb;
		float yy = dot(c, vec3(0.299, 0.587, 0.114));
		float ii = dot(c, vec3(0.596, -0.274, -0.322)), qq = dot(c, vec3(0.211, -0.523, 0.312));
		float ch = cos(uVary.x), sh = sin(uVary.x);
		float i2 = (ii * ch - qq * sh) * uVary.y, q2 = (ii * sh + qq * ch) * uVary.y;
		diffuseColor.rgb = max(vec3(yy + 0.956 * i2 + 0.621 * q2, yy - 0.272 * i2 - 0.647 * q2, yy - 1.106 * i2 + 1.703 * q2) * uVary.z, 0.0);
	}`).replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
	#if NUM_DIR_LIGHTS > 0
		vec3 crSunC = directLight.color, crSunL = directLight.direction;
	#endif`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{
		float crG = smoothstep(0.0, uCrAir.x, vCrY);
		vec3 crN = inverseTransformDirection(normal, viewMatrix);
		reflectedLight.indirectDiffuse *= mix(1.0 - uCrAir.y, 1.0, crG) * mix(0.7, 1.0, crN.y * 0.5 + 0.5);
		reflectedLight.directDiffuse *= mix(1.0 - uCrAir.y * 0.4, 1.0, crG);
		float crF = pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0);
		#if NUM_HEMI_LIGHTS > 0
			reflectedLight.indirectDiffuse += diffuseColor.rgb * crF * hemisphereLights[0].skyColor * uCrAir.z * mix(0.35, 1.0, crG) * saturate(crN.y * 0.6 + 0.6);
		#endif
		#if NUM_DIR_LIGHTS > 0
			float crB = saturate(-dot(crSunL, geometryViewDir));
			reflectedLight.directDiffuse += diffuseColor.rgb * crSunC * crF * crB * crB * saturate(dot(normal, crSunL) + 0.6) * uCrAir.w;
		#endif
	}`);
	};
	m.customProgramCacheKey = () => 'creature-vary-lit';
	return m;
}
