// A small stage for the walls you break through (structures/walls/), without the whole world: three
// houses built for real by bay/houses.js (a tract house in stucco, a prewar house with plaster and
// lath, a new one with a brick front) and, by interiors/, a shop of the old kind (brick) and a
// warehouse (concrete with its bars), the buildings' structures (createStructures) round them as
// the world has them. destruction-rig.cjs bundles this, opens it and drives it; window.rig is the
// handle (step, shot, blow, fire, the systems).

import * as THREE from 'three';
import { createHouses } from '../src/bay/houses.js';
import { createInteriors } from '../src/interiors/index.js';
import { createStructures } from '../src/structures/index.js';
import { STYLE } from '../src/bay/styles.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d1e0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6458, 1.6));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
sun.position.set(40, 70, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 });
scene.add(sun);
const room = new THREE.PointLight(0xfff0d8, 0, 9, 1.4);
scene.add(room);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.03, 600);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x6f7a58, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const H = () => 0;
const bay = { heightAt: H, loaded: () => true, urbanAt: () => ({ s: STYLE.suburb }) };
const mk = (x, z, w, d, era, siding = null, wall = [0.86, 0.8, 0.68]) => { const b = { x, z, w, d, a: 0, wallH: 5.75, roofH: 1.6, kind: 0, door: 0.5, hip: 1, look: { wall, roof: [0.3, 0.3, 0.31], era, ...(siding != null ? { siding } : {}) } }; b.grp = [b]; return b; };
const homes = [mk(0, 0, 14, 11, 'tract'), mk(30, 0, 13, 11, 'prewar', null, [0.9, 0.86, 0.72]), mk(60, 0, 14, 11, 'modern', 3, [0.8, 0.5, 0.4])];
const KIND = { shop: 6, industry: 9, garage: 13, retail: 14, office: 11, tower: 15, apt: 8, bay: 17, house: 1, pool: 30 };
const lots = [
	{ x: 0, z: -40, w: 10, d: 16, h: 8.4, a: 0, y: -1.2, kind: KIND.shop, col: [0.7, 0.45, 0.36] },
	{ x: 30, z: -42, w: 18, d: 20, h: 8.2, a: 0, y: -1.2, kind: KIND.industry, col: [0.7, 0.7, 0.68] },
];
const city = {
	KIND, houseLook: (b) => b.look, setNearBand() {}, setNear(grp, c) { grp.near = c; }, procHomes: () => [], procBiz: () => [],
	lotsNear: (x, z, r) => lots.filter((o) => Math.hypot(o.x - x, o.z - z) < r + Math.max(o.w, o.d)), lotKey: (o) => Math.round(o.x) + ':' + Math.round(o.z), setDoor() {}, towersNear: () => [], nearList: () => lots,
};
const real = { loaded: () => true, near: (kind) => (kind === 'boxes' ? homes : []) };
const houses = createHouses(scene, bay, real, city, { isPhone: false });
const interiors = createInteriors(scene, bay, city, { isPhone: false, mats: houses.M });
interiors.budget(60);
const P = { pos: new THREE.Vector3(0, 1.68, 20), vel: new THREE.Vector3(), yaw: 0, pitch: 0 };
const shared = { uSunDir: { value: sun.position.clone().normalize() }, uSunColor: { value: new THREE.Color(1, 1, 1) }, uAmbient: { value: new THREE.Color(0.5, 0.52, 0.55) } };
const world = {
	city, houses, interiors, island: { heightAt: H },
	player: { state: P, floorAt: (x, z, y) => Math.max(houses.floor(x, z, y), interiors.floor(x, z, y), 0) },
};
const S = createStructures({ scene, camera, world: () => world, isPhone: false, shared });

function step(n = 1, dt = 1 / 30) {
	for (let i = 0; i < n; i++) {
		houses.update(camera, dt, 0);
		interiors.update(camera, dt, 12, 0);
		S.update(dt, 0, 12);
	}
}
function shot(from, to, fov = 55) {
	camera.position.set(from.x, from.y, from.z); camera.up.set(0, 1, 0); camera.lookAt(to.x, to.y, to.z);
	camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/jpeg', 0.9);
}
// a round as combat's landShot has it for walls and glass: on through one pane or one wall, weaker
function fire(from, to, dmg = 58) {
	const o = new THREE.Vector3(from.x, from.y, from.z), d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
	let h = S.ray(o, d, 80), out = null;
	if (!h || h.none) return null;
	const p = o.clone().addScaledVector(d, h.t);
	const r = S.hit(p, d, h, dmg, 'ballistic');
	out = { t: +h.t.toFixed(2), wall: !!h.wall, glass: !!h.glass, through: r?.through ? +r.dmg.toFixed(1) : 0 };
	if (r?.through) {
		const q = p.clone().addScaledVector(d, 0.05), h2 = S.ray(q, d, 60);
		if (h2 && !h2.none) { S.hit(q.clone().addScaledVector(d, h2.t), d, h2, r.dmg, 'ballistic'); out.next = { t: +h2.t.toFixed(2), wall: !!h2.wall }; }
	}
	step(2);
	return out;
}
function blow(eye, dir, move) { const r = S.blow(eye, dir, (move.reach || 1.45) + 0.35, move); step(2); return r; }

camera.position.set(0, 1.7, 22); camera.lookAt(0, 1.5, 0);
// (from between them all, so each is near enough to be built)
camera.position.set(30, 1.7, -8);
for (let i = 0; i < 400 && (houses.count() < 3 || houses.busy() || interiors.info().live < lots.length); i++) step(1, 0.05);
step(10);
window.rig = { THREE, renderer, scene, camera, room, sun, houses, interiors, S, P, homes, lots, step, shot, fire, blow, world };
window.RIG_READY = true;
