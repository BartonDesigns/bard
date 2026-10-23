// Review page for the walk-in shops' fit-outs (bay/commercial.js, bay/storefit.js,
// interiors/goods.js): the production builder, the house kit's materials, the light bake, seen
// from inside the door at an hour. Bundle with esbuild and drive with store-preview-browser.cjs.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCommercial } from '../src/bay/commercial.js';
import { venueOf } from '../src/economy/venue.js';
import { houseMaterials } from '../src/bay/housekit.js';
import { detailClock, buildingBand } from '../src/world/lodfade.js';
import { lightingClock, lightingInfo } from '../src/interiors/lighting.js';

const phone = !!window.PHONE;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = !phone;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d1e0);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
const hemi = new THREE.HemisphereLight(0xdfeaf5, 0x5e5848, 1.4); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6); sun.position.set(30, 60, 40); scene.add(sun); scene.add(sun.target);
const camera = new THREE.PerspectiveCamera(phone ? 72 : 64, innerWidth / innerHeight, 0.05, 2000);
const bay = { heightAt: () => 2 };
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = 1.98; scene.add(ground);

// [name, store or economy type, w, d, sign bg, sign fg]
const CASES = [
	['fuel', 'fuel', 15, 10, '#c8102e', '#ffffff'], ['corner', 'corner', 16, 12, '#1d6f42', '#ffd60a'],
	['grocer', 'grocer', 22, 18, '#2a9d3f', '#ffffff'], ['hardware', 'hardware', 20, 16, '#e05a00', '#ffffff'], ['pharmacy', 'pharmacy', 16, 14, '#c8102e', '#ffffff'],
	['liquor', 'liquor', 14, 12, '#3a0ca3', '#ffd60a'], ['books', 'bookshop', 12, 14, '#5b1a18', '#f4f1de'], ['clothes', 'boutique', 13, 14, '#111111', '#ffffff'],
	['pet', 'pet', 14, 13, '#1d6fd1', '#ffffff'], ['tech', 'phonefix', 10, 10, '#06a77d', '#ffffff'], ['florist', 'florist', 10, 10, '#7b2cbf', '#ffffff'],
	['salon', 'salon', 10, 12, '#ef476f', '#ffffff'], ['laundry', 'laundromat', 12, 14, '#118ab2', '#ffffff'], ['gym', 'gym', 18, 16, '#111111', '#ffd60a'],
	['clinic', 'vet', 12, 12, '#2a9d8f', '#ffffff'], ['variety', 'gift', 14, 12, '#f77f00', '#ffffff'],
];
const SHOPS = CASES.map(([name, t, w, d, bg, fg], i) => {
	const b = { x: 1000 + i * 200, z: 0, w, d, a: 0, wallH: 4.8, roofH: 0, kind: 6, door: 0.5, look: { wall: [0.86, 0.84, 0.8] }, name };
	// (somewhere the economy would put a shop: economy/venue.js)
	while (venueOf(b) !== 'shop') b.x += 7;
	if (t === 'fuel' || t === 'corner') b.store = t;
	b.biz = { type: t, name: name + ' review', sign: { bg, fg } };
	b.grp = [b]; b.grp.biz = true;
	return b;
});
let current = [];
const city = { procBiz: () => current, setNear(grp, c) { grp.near = c; } };
const M = houseMaterials(buildingBand(phone), 0, 'building');
const commercial = createCommercial(scene, bay, null, city, { isPhone: phone, houseMats: M });
window.commercial = commercial;

let hours = 13, night = 0;
function settle() {
	for (let i = 0; i < 900 && !commercial.list().some((q) => q.name === current[0].biz.name); i++) commercial.update(camera, 0.016, hours, night);
	detailClock.value = 1e6;
}
// a shop at an hour, from just inside its door (or a spot given in its own frame: x, z, yaw)
async function show(name, h = 13, view = null) {
	const b = SHOPS.find((q) => q.name === name);
	current = [b]; hours = h; night = h > 19.5 || h < 6 ? 1 : 0;
	lightingClock(night, hours); M.setNight(night, true);
	hemi.intensity = night ? 0.08 : 1.4; sun.intensity = night ? 0 : 2.6; scene.background.set(night ? 0x0b1020 : 0xb8d1e0);
	camera.position.set(b.x, 3.6, b.z + 30);
	settle();
	const L = commercial.list().find((q) => q.name === b.biz.name);
	const [lx, lz, yaw] = view || [L.doorX - 0.6, L.hd - 1.2, 0.18];
	camera.position.set(b.x + lx, L.y + 1.62, b.z + lz);
	camera.rotation.set(-0.12, yaw, 0, 'YXZ');
	// the bake: a slice a drawn frame (a long one here: the picture waits on it)
	const t0 = performance.now();
	window.L99Lighting?.budget(120);
	// (drawn small while it bakes: a software GL queues every frame's work until the picture is read)
	const tiny = new THREE.WebGLRenderTarget(8, 8);
	for (let i = 0; i < 2000; i++) {
		commercial.update(camera, 0.05, hours, night);
		renderer.setRenderTarget(tiny); renderer.render(scene, camera); renderer.setRenderTarget(null);
		const I = lightingInfo();
		if (!I.queued && I.list.every((q) => q.state !== 'queued' && q.state !== 'baking')) break;
		if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
	}
	for (let i = 0; i < 3; i++) { commercial.update(camera, 0.05, hours, night); renderer.setRenderTarget(tiny); renderer.render(scene, camera); renderer.setRenderTarget(null); }
	tiny.dispose();
	renderer.render(scene, camera);
	return { name, ms: Math.round(performance.now() - t0), list: L, light: lightingInfo().list, draws: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs.length };
}
window.storeReview = { show, names: CASES.map((c) => c[0]), camera, renderer, scene };
window.STORE_READY = true;
