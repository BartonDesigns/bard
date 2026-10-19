// The building crews close up, before and after: the instanced figure (structures/crewfolk.js)
// and the real people who take over from it near you (structures/crewpeople.js), in each of
// the work's poses. Bundle with esbuild and drive window.CP from crew-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets } from '../src/people/body.js';
import { kitLight } from '../src/crysis/held-items.js';
import { createCrew } from '../src/structures/crewfolk.js';
import { createCrewPeople } from '../src/structures/crewpeople.js';
import * as KL from '../src/people/kit-light.js';

const W = +(new URLSearchParams(location.search).get('w') || 1600), H = +(new URLSearchParams(location.search).get('h') || 800);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#9fbfdc');
const sun = new T.DirectionalLight(0xfff0dc, 3.0); sun.position.set(-4, 7, -6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -2, near: 0.5, far: 30 });
const hemi = new T.HemisphereLight(0xbcd4ec, 0x5b5440, 1.25);
scene.add(sun, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04); pm.dispose(); kitLight(env.texture, 0.7);
KL.kitDaylight?.(renderer, { sun, hemi }, 1);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new T.PerspectiveCamera(30, W / H, 0.05, 200);
await loadPeopleAssets();
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

const crew = createCrew(scene, 16);
const folk = createCrewPeople(scene, {});
const SITE = { company: 'Bayline Builders' };
// a row of workers in these poses, gap apart, facing the camera (yaw: +z toward -z camera is PI)
let row = [];
function show(poses, gap = 1.6, mode = 'people', t0 = 0.3) {
	row = poses.map((p, i) => ({ pose: p, x: (i - (poses.length - 1) / 2) * gap, key: mode + ':' + p + ':' + i, look: 3 + i * 5 }));
	// (baked: the far figures made of a real body, crewbake.js; all their poses made first)
	if (mode === 'baked') { let k = 0; while (crew.bakes().left && !crew.bakes().dead && k++ < 2000) step(1 / 30, 'baked', t0); }
	crew.mesh.visible = mode === 'figures' || mode === 'baked';
	folk.group.visible = mode === 'people';
	// (settle: build the bodies, fade them in, let the springs come to rest)
	const steps = mode === 'people' ? 260 : 2;
	for (let f = 0; f < steps; f++) step(1 / 30, mode, t0);
	return folk.info();
}
function step(dt, mode, t0) {
	time += dt;
	crew.begin(); folk.begin(camera.position.clone().set(0, 1.6, -9));
	for (const w of row) {
		const t = t0 + (w.pose === 'walk' || w.pose === 'carry' || w.pose === 'shoulder' || w.pose === 'pane' ? time / 1.45 : 0);
		if (mode === 'people') folk.offer(w.key, w.x, 0, 0, Math.PI, w.pose, t, w.look, SITE, w.pose);
		else if (mode === 'baked' || !crew.bakes().made.length) crew.set(w.x, 0, 0, Math.PI, w.pose, t, w.look, t);
	}
	crew.end(); folk.end(dt);
	// (a walker walks on the spot: its place held, the stride from the clock)
	for (const b of folk.bodies.values()) { const w = row.find((r) => r.key === b.key); if (w && /walk|carry|shoulder|pane/.test(w.pose)) { b.M.S.pos.x = w.x; b.M.S.pos.z = 0; } }
}
// one pose at progress u (hammer 0..1, shovel 0..1...): held there for a frame
function at(t) { for (let f = 0; f < 12; f++) { time += 1 / 30; crew.begin(); folk.begin(new T.Vector3(0, 1.6, -9)); for (const w of row) folk.offer(w.key, w.x, 0, 0, Math.PI, w.pose, t, w.look, SITE, w.pose); crew.end(); folk.end(1 / 30); } }
function cam(x, y, z, tx, ty, tz, fov = 30) {
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
// one pose at progress t for the far figures
function atBaked(t) { crew.begin(); folk.begin(new T.Vector3(0, 1.6, -9)); for (const w of row) crew.set(w.x, 0, 0, Math.PI, w.pose, t, w.look, t); crew.end(); folk.end(1 / 30); }
window.CP = { show, at, atBaked, cam, step, folk, crew, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }) };
window.CP_READY = true;
