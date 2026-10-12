// The real vehicle models (assets/vehicles, see CREDITS.md), loaded only when a car of
// that kind first comes close, decoded off the main thread (meshopt in workers, the WebP
// textures by the browser), and taken apart into what the game can draw many of at once:
// the body, one merged geometry per material, and a left and a right wheel on their hubs.
// The paint takes each car's own colour (a painted texture keeps its trim and lamps: the
// paint is marked in its alpha); the glass is see-through; the lamps light at night.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyEnv, withCarSky, carGlassMaterial } from '../bay/cars.js';
import { unfight, layerOffset } from './layers.js';

// which kinds have a model, and its files (near, and for the middle distance)
export const MODEL_KINDS = { sports: ['sports.glb', 'sports-mid.glb'], crossover: ['crossover.glb', 'crossover-mid.glb'], delivery: ['delivery.glb', 'delivery-mid.glb'], bus: ['bus.glb', 'bus.glb'] };
// the models with layers laid on their own panels or faces given twice (vehicles/layers.js):
// the crossover's (7 dm2 of them) and the bus's chrome (13 m2, nearly all twice over)
const LAYERED = { crossover: true, bus: true };
const url = (f) => new URL(`../assets/vehicles/${f}`, import.meta.url).href;
// a phone keeps the models' textures at half size (a quarter of the memory)
const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
function halve(t) {
	const im = t?.image;
	if (!PHONE || !im || im.width <= 512) return;
	const cv = document.createElement('canvas');
	cv.width = im.width >> 1; cv.height = im.height >> 1;
	cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
	im.close?.();
	t.image = cv; t.needsUpdate = true;
}

let loader = null;
function gltf() {
	if (loader) return loader;
	MeshoptDecoder.useWorkers?.(2);
	loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	return loader;
}

// shared materials, one set for every model
const night = { value: 0 };
export const modelNight = night;
function paintMaterial(map) {
	const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, map: map || null });
	// the live sky in the paint (bay/cars.js); with a texture, its alpha says where the paint
	// is: only there does the car's colour go
	m.onBeforeCompile = (sh) => {
		withCarSky(sh);
		if (map) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'float paintK = 1.0;\n#ifdef USE_MAP\nvec4 txc = texture2D(map, vMapUv); diffuseColor.rgb *= txc.rgb; paintK = txc.a;\n#endif')
			.replace('#include <color_fragment>', '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\ndiffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, paintK);\n#endif');
	};
	m.customProgramCacheKey = () => map ? 'vpaintmask2' : 'vpaint2';
	return m;
}
const glassMat = () => carGlassMaterial();
function lampMaterial() {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNight = night;
		sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * uNight * 2.2;');
	};
	m.customProgramCacheKey = () => 'vlamp';
	return m;
}

// kind -> { near, mid } kits, or pending promises
const kits = {};
export function modelKit(kind, lod) {
	const K = kits[kind];
	return K && K[lod] && K[lod].ready ? K[lod] : null;
}
// ask for a kind (the near model first, then the middle-distance one)
export function wantModel(kind, lod = 'near') {
	const files = MODEL_KINDS[kind];
	if (!files) return null;
	const K = kits[kind] || (kits[kind] = {});
	if (!K[lod]) {
		K[lod] = { ready: false };
		gltf().loadAsync(url(files[lod === 'near' ? 0 : 1])).then((g) => { Object.assign(K[lod], takeApart(g.scene, lod, LAYERED[kind]), { ready: true }); }).catch((e) => { K[lod].failed = true; console.warn('[vehicles] model', kind, e); });
	}
	return K[lod].ready ? K[lod] : null;
}
export function modelsReady() { return Object.entries(kits).map(([k, K]) => k + ':' + Object.keys(K).filter((l) => K[l].ready).join('/')).join(' '); }

// one geometry per material for the body; the wheels on their own
function takeApart(scene, lod, layered) {
	scene.updateMatrixWorld(true);
	const body = new Map(), wheels = { L: new Map(), R: new Map(), RL: new Map(), RR: new Map() }, hubs = [];
	let tris = 0;
	scene.traverse((o) => {
		if (!o.isMesh) return;
		let wheel = null;
		for (let p = o; p; p = p.parent) if (/^wheel(FL|FR|RL|RR)$/.test(p.name)) { wheel = p; break; }
		const g = o.geometry.clone();
		// (only the attributes the materials use, so that the parts merge)
		for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a);
		// (the quantized attributes as plain floats, so they can be moved and merged)
		for (const [name, a] of Object.entries(g.attributes)) {
			if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
			const f = new Float32Array(a.count * a.itemSize);
			for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
			g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
		}
		if (g.attributes.color && g.attributes.color.itemSize === 4) { const c = g.attributes.color, f = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { f[i * 3] = c.getX(i); f[i * 3 + 1] = c.getY(i); f[i * 3 + 2] = c.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(f, 3)); }
		if (!g.attributes.normal) g.computeVertexNormals();
		tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
		const mat = o.material;
		if (wheel && lod === 'near') {
			const side = /L$/.test(wheel.name) ? 'L' : 'R', front = /^wheelF/.test(wheel.name);
			if (!hubs.some((h) => h.name === wheel.name)) hubs.push({ name: wheel.name, p: wheel.getWorldPosition(new THREE.Vector3()) });
			// in the wheel's own frame, its hub at the origin
			// (by the hub's place only: the node's own scale is the mesh's quantization)
			const hub = wheel.getWorldPosition(new THREE.Vector3());
			g.applyMatrix4(new THREE.Matrix4().makeTranslation(-hub.x, -hub.y, -hub.z).multiply(o.matrixWorld));
			// (the back wheels their own: the sports car's are bigger and narrower, and the front ones
			// put on its back hubs stood well out of the arches)
			add(wheels[(front ? '' : 'R') + side], mat, g);
		} else {
			g.applyMatrix4(o.matrixWorld);
			add(body, mat, g);
		}
	});
	const parts = [...body.entries()].map(([m, gs]) => part(m, gs, layered));
	const wparts = {};
	for (const [k, w] of Object.entries(wheels)) wparts[k] = [...w.entries()].map(([m, gs]) => part(m, gs));
	const box = new THREE.Box3();
	for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
	hubs.sort((a, b) => ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].indexOf(a.name) - ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].indexOf(b.name));
	return { parts, wheels: wparts, hubs: hubs.map((h) => h.p.toArray()), box, tris: Math.round(tris) };
}
const add = (map, mat, g) => { const k = mat.name + '|' + (g.attributes.color ? 'c' : '') + (g.attributes.uv ? 'u' : ''); let e = map.get(k); if (!e) map.set(k, e = { mat, gs: [] }); e.gs.push(g); };
function part(key, e, layered = false) {
	const gs = e.gs;
	const geo = gs.length > 1 ? mergeGeometries(gs) || gs[0] : gs[0];
	if (layered) unfight(geo);
	const n = e.mat.name;
	for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) halve(e.mat[k]);
	const role = n === 'paint' ? 'paint' : n === 'glass' ? 'glass' : n === 'lamp' ? 'lamp' : 'solid';
	let mat;
	if (role === 'paint') mat = paintMaterial(e.mat.map);
	else if (role === 'glass') mat = glassMat();
	else if (role === 'lamp') mat = lampMaterial();
	else { mat = e.mat; mat.envMap = skyEnv(); mat.envMapIntensity = 0.6; if (geo.attributes.color) mat.vertexColors = true; }
	// (the trim over the paint, the chrome over that, the lamps and the glass on top: where one
	// material's faces lie on another's, the upper drawn a hair nearer)
	layerOffset(mat, role, n);
	geo.computeBoundingSphere();
	return { geo, mat, role };
}
