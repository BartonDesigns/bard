// Creature ragdoll preview: one creature (the game's own body, creatures/models.js) under the
// game's light, standing, then struck and going limp (people/ragdoll.js over its rig,
// creatures/rig.js), the fall shot at moments along it. Driven by monsters/ragdoll-browser.cjs
// through window.RP. The world under it is flat ground at y 0.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeCreature } from '../../src/creatures/models.js';
import { createRagdolls } from '../../src/people/ragdoll.js';

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
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 8, bottom: -1, near: 0.5, far: 30 });
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc8d6ff, 0x3a3226, 0.9));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x5c5a55, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// the world the ragdoll reads: flat ground, no buildings, no cars
const world = () => ({ island: { heightAt: () => 0 }, real: null, vehicles: null, player: { state: { pos: { x: 0, y: 0, z: 30 } } } });
const ragdolls = createRagdolls({ world, isPhone: q.get('phone') === '1' });
let c = null;
async function load(id, { pose = 'rest', t = 0 } = {}) {
	if (c) scene.remove(c.root);
	c = await makeCreature(id);
	c.size = c.vary(() => 0.5);
	c.root.position.set(0, 0, 0); c.root.rotation.set(0, 0, 0);
	scene.add(c.root);
	c.motion.pose(pose, t);
	await ragdolls.ready();
	return { height: c.height, pieces: c.rig().pieces.map((p) => p.n), mass: Math.round(c.rag.mass) };
}
// struck: how = { from: 'front'|'left'|'behind', speed, mass, limp }; then step(dt) to run it on
function strike({ from = 'left', speed = 4, mass = 60, limp = 1, lift = 0.08 } = {}) {
	const dir = from === 'front' ? new THREE.Vector3(0, 0.1, -1) : from === 'behind' ? new THREE.Vector3(0, 0.1, 1) : new THREE.Vector3(-1, 0.1, 0);
	const chest = c.shapes().find((s) => s.bone === 'chest') || c.shapes()[0];
	const point = new THREE.Vector3((chest.a.x + chest.b.x) / 2, (chest.a.y + chest.b.y) / 2, (chest.a.z + chest.b.z) / 2);
	if (limp >= 1) c.motion.die();
	return ragdolls.hit(c.rig(), { vel: dir.normalize().multiplyScalar(speed), mass, point, lift, limp });
}
function step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) ragdolls.update(dt); return info(); }
// handed back to its motion from where it lies (the knockdown's getting up)
function rise(dt = 1 / 60, n = 60) {
	if (c.rag.ragdoll) {
		const at = c.rag.at;
		c.motion.blendFrom(0.8);
		ragdolls.release(c.rag);
		if (at) { c.root.position.set(at.x, 0, at.z); c.root.rotation.set(0, at.yaw, 0); }
	}
	for (let i = 0; i < n; i++) c.motion.update(dt, { speed: 0 });
	return info();
}
function info() {
	const S = c.shapes();
	const top = Math.max(...S.map((s) => Math.max(s.a.y, s.b.y))), low = Math.min(...S.map((s) => Math.min(s.a.y, s.b.y)));
	const far = Math.max(...S.map((s) => Math.hypot(s.a.x, s.a.z, s.b.x, s.b.z)));
	return { top: +top.toFixed(2), low: +low.toFixed(2), spread: +far.toFixed(2), rag: ragdolls.info(), at: c.rag.at };
}
// view: three | side | front | top, framed round the body where it is
function shot(view = 'three', span = null) {
	c.root.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(c.root), ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
	const h = span || Math.max(sz.x, sz.y, sz.z, 0.8) * 1.15;
	const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 200);
	const d = h / Math.tan(THREE.MathUtils.degToRad(32) / 2) * 0.62;
	const D = { three: [-0.6, 0.45, 0.75], side: [-1, 0.12, 0], front: [0, 0.12, 1], top: [0.01, 1, 0.01] }[view];
	cam.position.set(ctr.x + D[0] * d, ctr.y + D[1] * d, ctr.z + D[2] * d);
	cam.lookAt(ctr);
	renderer.render(scene, cam);
	return renderer.domElement.toDataURL('image/png');
}
window.RP = { load, strike, step, rise, shot, info, scene, THREE };
window.RP_READY = true;
