// Isolated production materials: architecture bloom restoration and every procedural car.
import * as T from 'three';
import { createBloom } from '../src/planet/arch/bloom.js';
import { carGeometry, carMaterial, carGlassMaterial, KINDS } from '../src/bay/cars.js';
import { createGlobeTrees } from '../src/earth/globetrees.js';

const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(960, 600); renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#243748');
scene.add(new T.HemisphereLight(0xd7e8ff, 0x514432, 2.4));
const sun = new T.DirectionalLight(0xffe3c2, 3.2); sun.position.set(6, 12, 8); scene.add(sun);
const camera = new T.PerspectiveCamera(34, 960 / 600, .1, 200);
camera.position.set(31, 31, 39); camera.lookAt(0, 0, 0);
const floor = new T.Mesh(new T.PlaneGeometry(55, 32), new T.MeshStandardMaterial({ color: 0x46525b, roughness: .85 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; scene.add(floor);
for (let i = 0; i < KINDS.length; i++) {
	const kind = KINDS[i], mat = carMaterial({ value: .2 }); mat.color.setHSL(i / KINDS.length, .5, .48);
	const mesh = new T.Mesh(carGeometry(kind, 48, 20, { cabin: true, glass: true }), [mat, carGlassMaterial()]);
	mesh.position.set((i % 5 - 2) * 8, 0, (Math.floor(i / 5) - .5) * 11); mesh.rotation.y = .35;
	scene.add(mesh);
}
const bloom = createBloom(renderer), gl = renderer.getContext();
function pixels() {
	const p = new Uint8Array(960 * 600 * 4); gl.readPixels(0, 0, 960, 600, gl.RGBA, gl.UNSIGNED_BYTE, p);
	let sum = 0, lit = 0;
	for (let i = 0; i < p.length; i += 4) { const l = p[i] + p[i + 1] + p[i + 2]; sum += l; if (l > 20) lit++; }
	return { mean: sum / (960 * 600 * 3), lit };
}
function checks() {
	const frames = [];
	for (const k of [0, .1, .75, 1, 0, .75, 0]) {
		renderer.render(scene, camera); const before = pixels(); bloom.post(k); const after = pixels();
		frames.push({ k, before, after, restored: renderer.getRenderTarget() === null && renderer.autoClear, error: gl.getError() });
	}
	renderer.setSize(640, 400); renderer.render(scene, camera); bloom.post(.75);
	const resize = gl.getError(); renderer.setSize(960, 600); renderer.render(scene, camera);
	let ground = 890, level = 900;
	const trees = createGlobeTrees({ scene: new T.Scene(), shared: {}, isPhone: true,
		data: { cellAt: () => ({ TREES: 1, RAIN: 1000, E: 900 }), smoothAt: () => ({ TEMP: 20, TREES: 1, RAIN: 1000 }) },
		heightAt: () => ground, waterLevel: () => level, allowed: (x, z) => Math.hypot(x, z) < 250 });
	const vegetation = ['fir', 'spruce'];
	trees.update(camera, vegetation, true, 0); trees.settle(); const submerged = trees.count();
	ground = 901; trees.update(camera, vegetation, true, 1); trees.settle(); const bank = trees.count();
	level = null; trees.update(camera, vegetation, true, 2); trees.settle(); const dry = trees.count();
	return { frames, resize, vegetation: { submerged, bank, dry }, failed: renderer.info.programs.filter(p => p.diagnostics?.runnable === false).length, lost: gl.isContextLost() };
}
renderer.render(scene, camera);
window.worldReview = { checks, png: () => renderer.domElement.toDataURL('image/png') };
window.WORLD_REVIEW_READY = true;
