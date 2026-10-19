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
const PART = (name) => (/^(head|neck|ear)/.test(name) ? 'head' : /^abdomen/.test(name) ? 'weak' : /^(hips|spine|chest|robe|cloak|wing)/.test(name) ? 'torso' : 'limb');
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// one body of a kind: { root, motion, meta, shapes(out), height }
export async function makeCreature(id) {
	const { scene, meta } = await loadCreature(id);
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
		zones.push({ b, tail, r: Math.max(0.04, (meta.radii?.[name] || 0.08) * 0.9), part: PART(name), name });
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
	return { id, root, motion, meta, shapes: hitShapes, height: meta.height || 2 };
}
