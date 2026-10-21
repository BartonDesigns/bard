// Review page for the families at home (people/home-life.js): production houses.js houses
// with their rooms and furniture, and family-life.js's households living in them at an hour,
// seen from a room's corner. Bundle with esbuild and drive with home-life-browser.cjs.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createHouses } from '../src/bay/houses.js';
import { planHouse, houseFloor, mainOf, HT } from '../src/bay/houseplan.js';
import { detailClock } from '../src/world/lodfade.js';
import { createFamilyLife } from '../src/people/family-life.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d1e0);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
scene.add(new THREE.HemisphereLight(0xffffff, 0x666050, 2.0));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.2); sun.position.set(30, 60, 40); scene.add(sun); scene.add(sun.target);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 2000);
const bay = { heightAt: () => 2 };

// [name, x, z, w, d, wallH, kind (0 none, 1 garage left, 2 right)]
const CASES = [['tract', 1000, 0, 16, 13, 5.75, 1], ['ranch', 2000, 0, 17, 11, 3.0, 1], ['small', 3000, 0, 9, 9, 3.0, 0], ['split', 4000, 0, 15, 12, 5.75, 2]];
const HOUSES = CASES.map(([name, x, z, w, d, wallH, kind]) => { const b = { x, z, w, d, a: 0.12, wallH, roofH: 2, kind, door: 0.5, hip: 1, name, look: { wall: [0.82, 0.76, 0.66], roof: [0.3, 0.3, 0.32] } }; b.grp = [b]; return b; });
let current = [];
const city = { houseLook: (b) => b.look, setNearBand: () => {}, procHomes: () => [], procBiz: () => [], setNear(grp, c) { grp.near = c; } };
const real = { loaded: () => true, near: (kind) => (kind === 'boxes' ? current : []) };
const houses = createHouses(scene, bay, real, city, { isPhone: false });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x6f7a5c }));
ground.rotation.x = -Math.PI / 2; ground.position.y = 1.95; scene.add(ground);

const said = [];
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, flying: false };
const W = {
	body: { key: 'home-review' }, sky: { state: { hours: 19 } }, houses,
	island: { heightAt: () => 2, drawnAt: () => 2, half: 1e6, extraFloor: (x, z, y) => houses.floor(x, z, y) },
	player: { state: P, floorAt: (x, z, y) => Math.max(2, houses.floor(x, z, y)), pushOut: (q) => { const f = q.y - 1.68; houses.push(q, f); } },
};
const families = createFamilyLife({ scene, world: () => W, camera, isPhone: !!window.PHONE, say: (p, line) => said.push({ who: Math.floor(p.P.dna.age), text: line.text }) });
let time = 0;
function frame(dt = 1 / 30) { time += dt; P.pos.copy(camera.position); houses.update(camera, dt, 0); families.update(dt, time, true); }
function settleHouse() {
	for (let i = 0; i < 600 && current.some((b) => !houses.houses.get(b.grp)); i++) houses.update(camera, 0.016, 0);
	detailClock.value = 1e6;
}
function roomBox(plan, r) {
	let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
	for (const c of r.cells) { const i = c % plan.nx, j = Math.floor(c / plan.nx); x0 = Math.min(x0, plan.X[i]); x1 = Math.max(x1, plan.X[i + 1]); z0 = Math.min(z0, plan.Z[j]); z1 = Math.max(z1, plan.Z[j + 1]); }
	return { x0, x1, z0, z1 };
}
// a house at an hour, seen from the corner of one of its rooms; waits for its people
async function inside(n, types, hours, corner = 0) {
	const b = HOUSES[n];
	current = [b]; ground.position.set(b.x, 1.95, b.z);
	W.sky.state.hours = hours;
	const plan = planHouse(b.grp), M = mainOf(b.grp), f = houseFloor(b.grp, bay.heightAt);
	const room = types.map((t) => plan.rooms.find((r) => r.type === t && r.cells.length)).find(Boolean) || plan.rooms.find((r) => r.cells.length);
	const q = roomBox(plan, room), y = f + (room.level ? HT.floor1 : 0) + 1.6;
	const Wd = (lx, lz) => [M.x + plan.ca * lx - plan.sa * lz, M.z + plan.sa * lx + plan.ca * lz];
	const C = [[q.x0 + 0.35, q.z1 - 0.35, q.x1 - 0.2, q.z0 + 0.2], [q.x1 - 0.35, q.z0 + 0.35, q.x0 + 0.2, q.z1 - 0.2], [q.x0 + 0.35, q.z0 + 0.35, q.x1 - 0.2, q.z1 - 0.2]][corner % 3];
	const [cx, cz] = Wd(C[0], C[1]), [tx, tz] = Wd(C[2], C[3]);
	camera.position.set(cx, y, cz); camera.lookAt(tx, y - 0.6, tz);
	camera.fov = 75; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
	settleHouse();
	for (let i = 0; i < 1200 && !families.homes.info().ready; i++) { frame(); await new Promise((r) => setTimeout(r, 50)); }
	for (let i = 0; i < 600; i++) { frame(); if (i % 10 === 0) await new Promise((r) => setTimeout(r, 5)); if (i > 60 && !families.homes.info().queued && families.homes.info().houses.some((H) => H.shown)) break; }
	for (let i = 0; i < 60; i++) frame();
	renderer.render(scene, camera);
	return { house: b.name, room: room.type, level: room.level, hours, ...families.homes.info() };
}
async function scatter(why = 'window', seconds = 2.5) {
	const n = families.homes.scatter(why);
	for (let i = 0; i < seconds * 30; i++) frame();
	renderer.render(scene, camera);
	return { n, said: said.slice(-6), ...families.homes.info() };
}
// close on someone: beside them, at their head's height and a little above
function near(i = 0, dist = 1.6, up = 0.7, side = 1) {
	const A = families.actors().filter((a) => a.active)[i];
	if (!A) return null;
	const p = A.lying ? A.P.root.position : A.M.S.pos, yaw = A.lying ? A.lying.yaw : A.M.S.heading;
	const hx = A.lying ? p.x - Math.sin(yaw) * 0.9 : p.x, hz = A.lying ? p.z - Math.cos(yaw) * 0.9 : p.z, hy = A.lying ? p.y : p.y + 1.1;
	camera.position.set(hx + Math.cos(yaw) * dist * side + Math.sin(yaw) * 0.6, hy + up, hz - Math.sin(yaw) * dist * side + Math.cos(yaw) * 0.6);
	camera.lookAt(hx, hy, hz);
	for (let k = 0; k < 4; k++) frame();
	renderer.render(scene, camera);
	return { age: Math.floor(A.P.dna.age), act: A.q?.act };
}
function look(dx, dy, dz) { const t = new THREE.Vector3(); camera.getWorldDirection(t); camera.position.add(new THREE.Vector3(dx, dy, dz)); camera.lookAt(camera.position.clone().add(t)); renderer.render(scene, camera); }
// where each of them stands: the room under them, and whether a body's width (0.25 m round) is
// clear of its walls ('wall': poking through one; 'out': out of the house)
function placed() {
	const H = [...houses.houses.values()].filter((h) => h?.plan?.rooms && h.root);
	return families.actors().filter((a) => a.active && !a.lying).map((a) => {
		const p = a.M.S.pos, h = H.sort((u, v) => Math.hypot(u.cx - p.x, u.cz - p.z) - Math.hypot(v.cx - p.x, v.cz - p.z))[0];
		const y = h.root.rotation.y, c = Math.cos(y), s = Math.sin(y), dx = p.x - h.cx, dz = p.z - h.cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
		const lev = p.y - h.floorY > 1.5 ? 1 : 0, at = (x, z) => { const k = h.plan.cellAt(x, z); return k < 0 ? -1 : h.plan.labels?.[lev]?.[k] ?? -1; };
		const r = at(lx, lz), clear = [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]].every(([u, v]) => at(lx + u, lz + v) === r);
		return { age: Math.floor(a.P.dna.age), act: a.scared ? 'scared' : a.shaken > 0 ? 'shaken' : a.q?.act, room: r < 0 ? 'out' : clear ? h.plan.rooms[r]?.type : 'wall' };
	});
}
window.homeReview = { inside, scatter, look, near, placed, families: () => families, said, HOUSES, renderer, frame, actors: () => families.actors().map((a) => ({ age: Math.floor(a.P.dna.age), x: +a.M.S.pos.x.toFixed(2), y: +(a.lying ? a.P.root.position.y : a.M.S.pos.y).toFixed(2), z: +a.M.S.pos.z.toFixed(2), act: a.q?.act, lying: !!a.lying, vis: a.P.root.visible, fade: +a.fade.toFixed(2) })) };
window.HOME_READY = true;
