// The Lumen Leviathan's body (creatures/leviathan.js) laid along an S and shot from a few sides,
// at each turn of its fight. Bundle with esbuild and open in headless Chromium: window.SHOTS holds
// the frames as data URLs once window.DONE is set (tools/monsters/leviathan-shots.cjs).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { leviathanBody } from '../../src/creatures/leviathan.js';

const W = 1200, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x26222e);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const sun = new THREE.DirectionalLight(0xfff2e0, 2.4); sun.position.set(10, 20, 14); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc8d6ff, 0x3a3226, 0.9));

const N = 16, radii = [];
for (let i = 0; i < N; i++) radii.push(0.6 + 1.7 * Math.sin(Math.PI * (i + 1) / (N + 1)) * (i < 3 ? 1.15 : 1));
const L = leviathanBody({ n: N, radii });
scene.add(L.group);
// an S through the air, head at the left, rearing
const pts = radii.map((_, i) => new THREE.Vector3(-14 + i * 2.1, 5 + Math.sin(i * 0.55) * 1.2 + (i < 3 ? (3 - i) * 0.9 : 0), Math.sin(i * 0.6) * 3.5));
const shots = [];
const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 400);
function shoot(phase, jaw, from, at) {
	L.update(pts, 3.1, { jaw, phase, glow: 1, cracked: phase === 1 ? 1 : 0 });
	cam.position.set(...from); cam.lookAt(...at);
	renderer.render(scene, cam);
	shots.push(renderer.domElement.toDataURL('image/jpeg', 0.9));
}
shoot(0, 0.1, [-4, 9, 34], [-2, 5, 0]);
shoot(0, 0.9, [-24, 9, 9], [-13, 7, 0]);
shoot(1, 0.3, [-22, 10, 12], [-12, 6, 0]);
shoot(2, 0.6, [-22, 4, 10], [-11, 5, 0]);
shoot(0, 0.2, [-13, 26, 2], [-4, 4, 0]);
window.SHOTS = shots;
window.DONE = true;
