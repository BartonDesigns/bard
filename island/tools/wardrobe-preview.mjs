// A lineup of the people the wardrobe dresses (people/wardrobe.js), as they stand in the game:
// real bodies (people/body.js) made by personDNA for a place and an hour, in a row in daylight,
// for looking at the clothes and the hats. Bundle with esbuild and drive window.WP from
// wardrobe-browser.cjs. ?set= picks the cast: day (SF street, 13:00), night (SF, 22:00),
// office, beach, suburb, kids, hats (one of each kind of headwear), or a list of seeds.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { kitLight } from '../src/crysis/held-items.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1400), H = +(Q.get('h') || 900), SET = Q.get('set') || 'day', N = +(Q.get('n') || 8);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#a9c4dc');
const sun = new T.DirectionalLight(0xfff0dc, 3.0); sun.position.set(-3, 5, -6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 3, bottom: -1, near: 0.5, far: 30 });
const hemi = new T.HemisphereLight(0xc8dcf0, 0x8a7a60, 1.2);
scene.add(sun, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04); pm.dispose(); kitLight(env.texture, 0.7);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new T.PerspectiveCamera(50, W / H, 0.02, 200);
const A = await loadPeopleAssets();
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

const CTX = {
	day: { place: 'sf', hours: 13, cold: 0.3 }, cool: { place: 'sf', hours: 17, cold: 0.55 }, night: { place: 'sf', hours: 22, cold: 0.45 }, office: { place: 'office', hours: 11, cold: 0.3 },
	beach: { place: 'beach', hours: 14, cold: 0.15 }, suburb: { place: 'suburb', hours: 15, cold: 0.3 }, kids: { place: 'suburb', hours: 15, cold: 0.3 }, hats: { place: 'sf', hours: 13, cold: 0.3 }, pieces: { place: 'sf', hours: 13, cold: 0.3 },
};
const hatOf = (d) => (d.style.acc || []).find((q) => /^(cap|beanie|bucket|sunhat|visor|hood)$/.test(q.kind));
function cast() {
	if (/^\d/.test(SET)) return SET.split(',').map((s) => personDNA(+s, { ctx: CTX.day }));
	const ctx = CTX[SET] || CTX.day, out = [];
	if (SET === 'hats') {
		const want = ['cap', 'cap', 'beanie', 'beanie', 'bucket', 'bucket', 'sunhat', 'visor'];
		for (let s = 100; s < 60000 && want.length; s += 7) {
			const d = personDNA(s, { ctx: s % 3 ? ctx : CTX.beach }), h = hatOf(d);
			if (!h || d.child) continue;
			const k = want.indexOf(h.kind); if (k < 0) continue;
			want.splice(k, 1); out.push(d);
		}
		return out;
	}
	if (SET === 'pieces') {
		const want = ['sweatervest', 'sweatervest', 'sweatervest', 'tank', 'tank', 'fedora', 'trilby', 'fedora'];
		for (let s = 100; s < 200000 && want.length; s += 7) {
			const d = personDNA(s, { ctx: s % 2 ? CTX.day : CTX.night });
			if (d.child) continue;
			const has = (k) => d.style.outer?.kind === k || d.style.top?.kind === k || (d.style.acc || []).some((q) => q.kind === k);
			const k = want.findIndex(has); if (k < 0) continue;
			want.splice(k, 1); out.push(d);
		}
		return out;
	}
	for (let s = 100; out.length < N; s += 7) {
		const d = personDNA(s, SET === 'kids' ? { age: 5 + (s % 9), ctx } : { ctx });
		if (SET !== 'kids' && d.child) continue;
		out.push(d);
	}
	return out;
}
const folk = [];
const people = cast();
for (let i = 0; i < people.length; i++) {
	const d = people[i];
	const P = buildPerson(A, d), M = createMotion(P, () => 0);
	M.place((i - (people.length - 1) / 2) * 0.85, 0, 0, Math.PI);
	scene.add(P.root);
	folk.push({ P, M, d });
}
function step(n = 30, dt = 1 / 30) {
	for (let f = 0; f < n; f++) { time += dt; for (const { P, M } of folk) { M.update(dt, time, camera.position); P.lod?.(camera.position.distanceTo(P.root.position)); } }
}
const headOf = (i) => { const P = folk[i].P; P.root.updateMatrixWorld(true); return new T.Vector3().setFromMatrixPosition(P.bones[P.map.head].matrixWorld); };
// the whole row from the front or the back (dir 0 front, 3 back), or a look at person i's head
// from d metres (dir: front 0, three-quarter 1, side 2, back 3)
function row(dir = 0, y = 0.95, dist = 0, fov = 30) {
	const wide = people.length * 0.85 + 0.6, dz = dist || (wide / 2) / Math.tan(fov / 2 * Math.PI / 180) * (H / W) * 1.15 + 1.0;
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(0, y, dir === 3 ? dz : -dz); camera.lookAt(0, y, 0); camera.updateMatrixWorld(true);
	step(2); renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
function shot(i, d, dir = 0, dy = 0.05, ty = 0.05, fov = 50) {
	const h = headOf(i), a = [0, 0.6, 1.4, Math.PI][dir];
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(h.x + Math.sin(a) * d, h.y + dy, h.z - Math.cos(a) * d);
	camera.lookAt(h.x, h.y + ty, h.z); camera.updateMatrixWorld(true);
	step(2); renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
const describe = () => people.map((d) => ({ seed: d.seed, age: Math.round(d.age), male: d.male, gen: d.style.gen, look: d.style.look, top: d.style.top?.kind, outer: d.style.outer?.kind, bottom: d.style.bottom?.kind, shoes: d.style.shoes?.kind, hat: hatOf(d)?.kind, acc: (d.style.acc || []).map((q) => q.kind).join('+'), hair: d.style.hair?.cut }));
window.WP = { step, row, shot, folk, headOf, describe, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length }) };
window.WP_READY = true;
