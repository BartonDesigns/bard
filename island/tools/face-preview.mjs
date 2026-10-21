// Teen faces, hoodies and hair up close, as the beach recording saw them (a phone held 30 cm to
// a metre from a teen's face): real bodies (people/body.js) made teens (people/teens.js) in the
// hoodies they wear, standing in daylight. Bundle with esbuild and drive window.FP from
// face-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { makeTeen } from '../src/people/teens.js';
import { createMotion } from '../src/people/motion.js';
import { kitLight } from '../src/crysis/held-items.js';

const W = +(new URLSearchParams(location.search).get('w') || 900), H = +(new URLSearchParams(location.search).get('h') || 900);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#a9c4dc');
// (a late-afternoon beach: the sun low over the shoulder, a bright sky)
// (?light=back: as the beach was in the recording, the sun high behind them, the world's own
// sky and ground (world/sky.js: a dark olive ground colour under a pale sky))
const BACK = new URLSearchParams(location.search).get('light') === 'back';
const sun = new T.DirectionalLight(0xfff0dc, BACK ? 3.4 : 3.0); sun.position.set(...(BACK ? [2, 7, 6] : [-3, 5, -6])); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 0.5, far: 30 });
const hemi = BACK ? new T.HemisphereLight(0xc8d6e6, new T.Color().setRGB(0.46, 0.36, 0.18), 1.15) : new T.HemisphereLight(0xc8dcf0, 0x8a7a60, 1.2);
scene.add(sun, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04); pm.dispose(); kitLight(env.texture, 0.7);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0xcdbb98, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new T.PerspectiveCamera(50, W / H, 0.02, 200);
const A = await loadPeopleAssets();
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

// the cast: a boy in a two-colour hoodie (navy, white sleeves), a boy in a white hoodie with
// green, a girl in a plain hoodie (long hair)
const jeans = { kind: 'jeans', col: '#2b3d63', pat: 'denim', legs: 'long', fit: 'baggy' };
const shoes = { kind: 'sneaker', col: '#f3f2ee', sole: '#f3f2ee' };
const CAST = [
	{ seed: 1411, male: true, age: 15, top: { kind: 'hoodie', col: '#1c2540', acc: '#eeeeea', acc2: '#eeeeea', pat: 'block', fit: 'oversized', sleeves: 'long' } },
	{ seed: 2718, male: true, age: 16, top: { kind: 'hoodie', col: '#2f7a4c', acc: '#eeeeea', acc2: '#eeeeea', pat: 'block', fit: 'oversized', sleeves: 'long' } },
	{ seed: 3141, male: false, age: 14, top: { kind: 'hoodie', col: '#eeeae2', acc: '#c93a4a', acc2: '#eeeeea', pat: 'plain', fit: 'oversized', sleeves: 'long' } },
];
const folk = [];
for (let i = 0; i < CAST.length; i++) {
	const c = CAST[i];
	let d = null;
	for (let k = 0; k < 64; k++) { d = personDNA(c.seed + k * 7919, { age: 18 }); if (d.male === c.male) break; }
	d = makeTeen(d, c.age, { cold: 0.4 });
	d.style.top = c.top; d.style.outer = null; d.style.acc = []; d.carry = null; d.style.bottom = jeans; d.style.shoes = shoes;
	d.styleSig = JSON.stringify(d.outfit);
	const P = buildPerson(A, d), M = createMotion(P, () => 0);
	M.place((i - 1) * 1.2, 0, 0, Math.PI);
	scene.add(P.root);
	folk.push({ P, M });
}
function step(n = 30, dt = 1 / 30) {
	for (let f = 0; f < n; f++) { time += dt; for (const { P, M } of folk) { M.update(dt, time, camera.position); P.lod?.(camera.position.distanceTo(P.root.position)); } }
}
const headOf = (i) => { const P = folk[i].P; P.root.updateMatrixWorld(true); return new T.Vector3().setFromMatrixPosition(P.bones[P.map.head].matrixWorld); };
// a look at person i's head from d metres (dir: front 0, three-quarter 1, side 2, back 3), at
// height dy above the head bone, looking at it plus ty
function shot(i, d, dir = 0, dy = 0.05, ty = 0.05, fov = 50) {
	const h = headOf(i), a = [0, 0.6, 1.4, Math.PI][dir];
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(h.x + Math.sin(a) * d, h.y + dy, h.z - Math.cos(a) * d);
	camera.lookAt(h.x, h.y + ty, h.z); camera.updateMatrixWorld(true);
	step(2);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
window.FP = { step, shot, folk, headOf, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length }) };
window.FP_READY = true;
