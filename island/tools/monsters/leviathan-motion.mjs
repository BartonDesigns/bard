// The Lumen Leviathan's crawl, run by its own boss code (combat/bosses.js) on a flat floor in the
// dark with no environment map, as in the Deep. Bundle with esbuild and open in headless Chromium
// (the same runner as leviathan-preview.mjs): window.SHOTS holds a filmstrip of frames a quarter
// of a second apart, and window.TRACE the head's speed each tick, to see the bursts and holds.
import * as THREE from 'three';
import { createBoss } from '../../src/combat/bosses.js';

const W = 1200, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0a14);
scene.add(new THREE.HemisphereLight(0x8a7ad8, 0x16121e, 0.8));
const key = new THREE.DirectionalLight(0xd8ccff, 1.6); key.position.set(-8, 20, 12); scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x2a2436, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
scene.add(new THREE.GridHelper(120, 60, 0x3a3450, 0x231f30));

const noop = () => {};
const fx = new Proxy({}, { get: () => noop });
const player = new THREE.Vector3(0, 1.6, 26);
const ctx = {
	ground: () => 0, eye: () => player, me: () => ({ grounded: true }), fx, layer: { add: noop, remove: noop },
	hurtPlayer: noop, projectile: noop, spawnSquad: noop, shake: noop,
};
const B = createBoss(ctx, 'leviathan', { x: 0, y: 0, z: 0 });
scene.add(B.group);
// (no attacks: just its crawl)
B.mc.tick = () => [];
const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 400);
const VIEW = /view=top/.test(location.search) ? 'top' : 'high';
const shots = [], trace = [];
let last = B.focus().clone();
const dt = 1 / 30;
for (let f = 0; f <= 30 * 6; f++) {
	B.update(dt);
	const h = B.focus();
	trace.push(+(h.distanceTo(last) / dt).toFixed(1));
	last = h.clone();
	if (f >= 30 && f % 8 === 0 && shots.length < 12) {
		if (VIEW === 'top') { cam.position.set(0, 46, 0.01); cam.lookAt(0, 0, 0); }
		else { cam.position.set(h.x + 9, 7, h.z + 15); cam.lookAt(h.x, 2.5, h.z - 3); }
		renderer.render(scene, cam);
		shots.push(renderer.domElement.toDataURL('image/jpeg', 0.85));
	}
}
window.TRACE = trace;
window.SHOTS = shots;
window.DONE = true;
