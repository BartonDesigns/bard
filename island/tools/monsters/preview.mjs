// Creature preview: one model from tools/monsters/out (or the game's assets) under the game's
// own light, posed or at rest, shot from the sheet's angles (orthographic, for comparing with
// the painting) or in perspective. Driven by monsters/browser.cjs through window.MP.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCreatureMotion } from '../../src/creatures/motion.js';
import { facetLook } from '../../src/creatures/facets.js';
import { crystalLegs } from '../../src/creatures/crystal-legs.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1200), H = +(q.get('h') || 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8a8a8a);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
sun.position.set(3, 6, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 5, bottom: -1, near: 0.5, far: 20 });
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc8d6ff, 0x3a3226, 0.9));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x5c5a55, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let model = null, motion = null, meta = null;
async function load(url, metaUrl) {
	if (model) scene.remove(model);
	const g = await loader.loadAsync(url);
	model = g.scene;
	model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
	scene.add(model);
	meta = metaUrl ? await (await fetch(metaUrl)).json() : g.scene.userData.creature || null;
	if (meta?.joints?.head) meta.headY = (meta.joints.head[0][1] + meta.joints.head[1][1]) / 2;
	motion = meta ? createCreatureMotion(model, meta) : null;
	const box = new THREE.Box3().setFromObject(model);
	return { size: box.getSize(new THREE.Vector3()).toArray(), tris: count(model) };
}
function count(o) {
	let t = 0;
	o.traverse((m) => { if (m.isMesh) t += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
	return t;
}
function pose(name, t) {
	if (motion) motion.pose(name, t);
	model?.updateMatrixWorld(true);
}
// view: front | side | back | three | low ; ortho: half-height in metres (null = perspective)
function shot(view, h, ortho, fov = 30, bg = 0x8a8a8a, floor = true, span = h) {
	scene.background = new THREE.Color(bg);
	ground.visible = floor;
	const cy = h * 0.5;
	const D = { front: [0, cy, 10], side: [-10, cy, 0], back: [0, cy, -10], three: [-6, cy + 1, 8], low: [-3, 0.6, 6], top: [0, 10, 0.01], face: [-3, cy, 8], ffront: [0, cy, 8], fside: [-8, cy, 0.5], rside: [10, cy, 0] }[view];
	const isFace = view === 'face' || view === 'ffront' || view === 'fside';
	if (isFace) { h *= 0.4; span = h; }
	const look = isFace ? meta?.headY ?? cy * 1.75 : cy;
	let cam;
	if (ortho) {
		const a = W / H;
		cam = new THREE.OrthographicCamera(-ortho * a, ortho * a, ortho, -ortho, 0.1, 50);
	} else {
		cam = new THREE.PerspectiveCamera(fov, W / H, 0.05, 100);
		const d = span / Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 0.62;
		const v = new THREE.Vector3(...D).sub(new THREE.Vector3(0, cy, 0)).normalize().multiplyScalar(d);
		D[0] = v.x; D[1] = look + v.y; D[2] = v.z;
	}
	cam.position.set(...D);
	cam.lookAt(0, view === 'top' ? 0 : look, 0);
	renderer.render(scene, cam);
	return renderer.domElement.toDataURL('image/png');
}
// plain clay in place of the paint, to judge the shape alone
function clay(both = false) {
	model?.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xb0a898, roughness: 0.7, side: both ? THREE.DoubleSide : THREE.FrontSide }); });
}
// the vertices a pose moves furthest, with their bones (to find bad skin weights)
function stretch(name, t) {
	const out = [];
	model.traverse((o) => {
		if (!o.isSkinnedMesh) return;
		const pos = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
		pose('rest', 0);
		const a = [], v = new THREE.Vector3();
		for (let i = 0; i < pos.count; i++) a.push(o.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).clone());
		pose(name, t);
		for (let i = 0; i < pos.count; i++) {
			const d = o.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).distanceTo(a[i]);
			out.push([d, i, a[i].toArray().map((x) => +x.toFixed(2)), [0, 1, 2, 3].map((k) => o.skeleton.bones[si.getComponent(i, k)].name + ':' + sw.getComponent(i, k).toFixed(2))]);
		}
	});
	out.sort((x, y) => y[0] - x[0]);
	return out.filter((x) => !/foot/.test(x[3][0])).slice(0, 10);
}
// a dressed look (the Facet Wraith's shards, the Shard Mite's legs), run steps frames at a
// strike time (-1: none)
function look(name, steps = 0, strike = -1) {
	if (!model) return;
	if (name === 'legs') { crystalLegs({ root: model, meta }); return; }
	if (name !== 'facets') return;
	const f = facetLook({ root: model, meta });
	for (let i = 0; i < steps; i++) f.update(0.05, { strike, alert: true });
}
window.MP = { load, pose, shot, clay, stretch, scene, THREE, look };
window.MP_READY = true;
