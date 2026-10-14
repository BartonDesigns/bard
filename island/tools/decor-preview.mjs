// Review page for the house and office looks: production houses.js and towers.js meshes,
// one house at a time at its own place, seen inside from a room's corner and outside from
// the street. Bundle with esbuild and drive with decor-browser.cjs.
import * as THREE from 'three';
import { createHouses } from '../src/bay/houses.js';
import { createTowers } from '../src/bay/towers.js';
import { planHouse, houseFloor, wallTop, mainOf, HT } from '../src/bay/houseplan.js';
import { planWorkplace } from '../src/interiors/workplace-plan.js';
import { detailClock } from '../src/world/lodfade.js';
import { roofGeometry, roofDetail } from '../src/bay/roofs.js';
import { weatherRoofs } from '../src/bay/weathering.js';
import { toWorld } from '../src/bay/geo.js';
import * as decor from '../src/bay/decor.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d1e0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x666050, 2.4));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6); sun.position.set(30, 60, 40); scene.add(sun); scene.add(sun.target);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 2000);
const bay = { heightAt: () => 2 };

// the houses: [name, lat, lon, w, d, wallH, kind (0 none, 1 garage left, 2 right), era]
const CASES = [
	['prewar', 37.8405, -122.2525, 11, 14, 3.0, 0, 'prewar'],
	['ranch', 37.3702, -122.0311, 17, 11, 3.0, 1, 'ranch'],
	['split', 37.7712, -121.9702, 15, 12, 5.75, 2, 'split'],
	['tract', 37.7651, -121.9211, 16, 13, 5.75, 1, 'tract'],
	['modern', 37.7102, -121.8712, 16, 13, 5.75, 2, 'modern'],
	['victorian', 37.7652, -122.2402, 10, 15, 5.75, 0, 'prewar'],
];
let current = [];
const houseOf = (c) => {
	const [name, lat, lon, w, d, wallH, kind, era] = c, p = toWorld(lat, lon);
	const b = { x: p.x, z: p.z, w, d, a: 0.12, wallH, roofH: wallH > 4 ? 2.2 : 1.7, kind, door: 0.5, hip: 1, name };
	b.look = decor.exteriorLook ? decor.exteriorLook(decor.ERA_KEYS ? era : 0, decor.seedAt(b.x, b.z)) : { wall: [0.82, 0.76, 0.66], roof: [0.3, 0.3, 0.32] };
	b.grp = [b];
	return b;
};
const HOUSES = CASES.map(houseOf);
const city = { houseLook: (b) => b.look, setNearBand: () => {}, procHomes: () => [], procBiz: () => [], setNear(grp, c) { grp.near = c; } };
const real = { loaded: () => true, near: (kind) => (kind === 'boxes' ? current : []) };
const houses = createHouses(scene, bay, real, city, { isPhone: false });

// a roof on each (city.js draws the roofs; the same geometry and shader here)
const roofMat = roofDetail(weatherRoofs(new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide })));
const rg = roofGeometry(true);
rg.setAttribute('aRoof', new THREE.InstancedBufferAttribute(new Float32Array(HOUSES.length * 4), 4));
rg.setAttribute('aWall', new THREE.InstancedBufferAttribute(new Float32Array(HOUSES.length * 3), 3));
const roofs = new THREE.InstancedMesh(rg, roofMat, HOUSES.length);
roofs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(HOUSES.length * 3), 3);
roofs.frustumCulled = false;
HOUSES.forEach((b, i) => {
	const top = houseFloor(b.grp, bay.heightAt) + wallTop(b), ov = 0.45;
	roofs.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(b.x, top, b.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.a), new THREE.Vector3(b.w + 2 * ov, b.roofH, b.d + 2 * ov)));
	roofs.setColorAt(i, new THREE.Color().setRGB(...b.look.roof, THREE.SRGBColorSpace));
	rg.attributes.aRoof.array.set([b.look.roofT ?? 0, ov, b.look.roofTrim ?? 0, 0], i * 4);
	rg.attributes.aWall.array.set(b.look.wall, i * 3);
});
scene.add(roofs);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x6f7a5c }));
ground.rotation.x = -Math.PI / 2; ground.position.y = 1.95; scene.add(ground);

function settle() {
	for (let i = 0; i < 600 && current.some((b) => !houses.houses.get(b.grp)); i++) houses.update(camera, 0.016, 0);
	houses.update(camera, 0.016, 0);
	detailClock.value = 1e6;
}
// a room's bounds from its cells
function roomBox(plan, r) {
	let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
	for (const c of r.cells) { const i = c % plan.nx, j = Math.floor(c / plan.nx); x0 = Math.min(x0, plan.X[i]); x1 = Math.max(x1, plan.X[i + 1]); z0 = Math.min(z0, plan.Z[j]); z1 = Math.max(z1, plan.Z[j + 1]); }
	return { x0, x1, z0, z1 };
}
function goHouse(n) {
	const b = HOUSES[n];
	current = [b];
	ground.position.set(b.x, 1.95, b.z);
	camera.position.set(b.x, 3.5, b.z + 6); camera.lookAt(b.x, 3, b.z);
	settle();
	return b;
}
function stats() {
	let draws = 0;
	const mats = new Set();
	houses.group.traverse((o) => { if (o.isMesh && o.visible) { draws++; mats.add(o.material); } });
	const names = [];
	if (window.DECOR_NAMES) houses.group.traverse((o) => { if (o.isMesh && /./.test(o.name) && o.geometry.attributes.color) { const c = o.geometry.attributes.color, u = o.geometry.attributes.uv; names.push([o.name, c.count, Array.from(c.array.slice(0, 4)).map((v) => +v.toFixed(3)), +u.array[1].toFixed(1)]); } });
	return { draws, materials: mats.size, programs: renderer.info.programs.length, failed: renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).length, ...(names.length ? { names } : {}) };
}
// inside: the room of one of the given types, from its corner toward the far one
function inside(n, types) {
	const b = goHouse(n), plan = planHouse(b.grp), M = mainOf(b.grp), f = houseFloor(b.grp, bay.heightAt);
	const room = types.map((t) => plan.rooms.find((r) => r.type === t && r.cells.length)).find(Boolean) || plan.rooms.find((r) => r.cells.length);
	const q = roomBox(plan, room), y = f + (room.level ? HT.floor1 : 0) + 1.55;
	const W = (lx, lz) => [M.x + plan.ca * lx - plan.sa * lz, M.z + plan.sa * lx + plan.ca * lz];
	const [cx, cz] = W(q.x0 + 0.35, q.z1 - 0.35), [tx, tz] = W(q.x1 - 0.2, q.z0 + (q.z1 - q.z0) * 0.2);
	camera.position.set(cx, y, cz); camera.lookAt(tx, y - 0.45, tz);
	camera.fov = 70; camera.updateProjectionMatrix();
	houses.update(camera, 0.016, 0);
	detailClock.value = 1e6;
	renderer.render(scene, camera);
	return { house: b.name, room: room.type, level: room.level, ...stats() };
}
function outside(n) {
	const b = goHouse(n), M = mainOf(b.grp), plan = planHouse(b.grp);
	const W = (lx, lz) => [M.x + plan.ca * lx - plan.sa * lz, M.z + plan.sa * lx + plan.ca * lz];
	const [cx, cz] = W(-3, b.d / 2 + 13), [tx, tz] = W(0, 0);
	camera.position.set(cx, 3.4, cz); camera.lookAt(tx, 4, tz);
	camera.fov = 52; camera.updateProjectionMatrix();
	houses.update(camera, 0.016, 0);
	detailClock.value = 1e6;
	renderer.render(scene, camera);
	return { house: b.name, ...stats() };
}

// the offices: towers.js at three lots, a floor of each
const p = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
let lot = null;
const tcity = { towersNear: (x, z) => (lot && Math.hypot(x - lot.x, z - lot.z) < 200 ? [lot] : []), setDoor: () => {} };
const T = createTowers(scene, bay, tcity, { isPhone: false, mount: document.body, player: () => p });
const LOTS = [{ x: 9000, z: 9000, y: -1.2, h: 276, w: 42, d: 38, a: 0, kind: 2, src: { kind: 11 } }, { x: 12000, z: 9000, y: -1.2, h: 120, w: 36, d: 34, a: 0, kind: 2, src: { kind: 11 } }, { x: 15000, z: 9000, y: -1.2, h: 80, w: 48, d: 30, a: 0, kind: 2, src: { kind: 11 } }];
function office(k, index) {
	current = [];
	houses.update(camera, 0.016, 0);
	lot = LOTS[k];
	const o = lot, plan = planWorkplace(o, 2.25), L = plan.levels[Math.min(index, plan.levels.length - 2)];
	p.pos.set(o.x, L.y + 1.7, o.z + plan.coreZ + 1.2);
	camera.position.copy(p.pos); camera.lookAt(o.x, L.y + 1.7, o.z + 10);
	T.update(1, camera, 13, 0); T.update(1, camera, 13, 0);
	camera.fov = 70; camera.updateProjectionMatrix();
	camera.position.set(o.x - 8, L.y + 1.72, o.z + 13); camera.lookAt(o.x - 3, L.y + 1.5, o.z - 10);
	renderer.render(scene, camera);
	let draws = 0;
	const mats = new Set();
	for (const c of T.group.children) if (Math.abs(c.position.y - L.y) < 0.5) c.traverse((q) => { if (q.isMesh && q.visible) { draws++; mats.add(q.material); } });
	return { lot: k, level: L.n, program: L.program, draws, materials: mats.size };
}
window.decorReview = { inside, outside, office, HOUSES, renderer };
window.DECOR_READY = true;
