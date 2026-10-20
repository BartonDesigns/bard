// Fighters on the move under review: real fighters (people/body.js, a rifle in their hands through
// crysis/held-items.js, dressed as a squad would dress them) running upright and crouched
// (people/motion.js want.low), and going over a fence and up onto a ledge (combat/npc-climb.js,
// on the player's own parkour.js), each caught at a moment of it. Bundle with esbuild and drive
// window.MV from npc-move-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { kitLight } from '../src/crysis/held-items.js';
import { npcHand } from '../src/combat/weapon-view.js';
import { outfitFor } from '../src/combat/outfits.js';
import { FACTIONS } from '../src/combat/factions.js';
import { createClimber, climbBody } from '../src/combat/npc-climb.js';
import { applyClutch } from '../src/crysis/held-items.js';
import * as KL from '../src/people/kit-light.js';

const W = +(new URLSearchParams(location.search).get('w') || 1600), H = +(new URLSearchParams(location.search).get('h') || 800);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#9fbfdc');
const sun = new T.DirectionalLight(0xfff0dc, 3.0); sun.position.set(-4, 7, -6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 6, bottom: -2, near: 0.5, far: 30 });
const hemi = new T.HemisphereLight(0xbcd4ec, 0x5b5440, 1.25);
scene.add(sun, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04); pm.dispose(); kitLight(env.texture, 0.7);
KL.kitDaylight?.(renderer, { sun, hemi }, 1);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new T.PerspectiveCamera(30, W / H, 0.05, 200);
const A = await loadPeopleAssets();
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });
const fid = 'ashfang', F = FACTIONS[fid] || {};
const pool = {};
function fighter(i, armed) {
	const key = i + (armed ? 'a' : 'u');
	if (pool[key]) return pool[key];
	const seed = 1000 + i * 7919;
	const d = personDNA(seed, { age: 24 + (i % 20), style: outfitFor({ fid, kind: F.kind, colors: F.colors, masked: false }, seed) });
	const P = buildPerson(A, d); scene.add(P.root);
	P.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	const q = {};
	const M = createMotion(P, (x, z) => q.climbY ?? floorAt(x, z, 0));
	const hand = armed ? npcHand(scene, F.gun || 'aurora-trail-rifle', 3, 1) : null;
	return (pool[key] = Object.assign(q, { P, M, hand }));
}
// lanes along x, each with a fence (1 m) and a ledge (1.2 m) ahead of it down -z
const EYE = 1.68, BOX = [];
const fence = (x, z, top) => BOX.push([x - 0.9, z - 0.04, x + 0.9, z + 0.04, top, false]);
const ledge = (x, z, top) => BOX.push([x - 0.9, z - 2.2, x + 0.9, z, top, true]);
function floorAt(x, z, y) { let g = 0; for (const b of BOX) if (b[5] && x > b[0] && x < b[2] && z > b[1] && z < b[3] && y > b[4] - 1.4) g = Math.max(g, b[4]); return g; }
function pushOut(p) {
	const footY = p.y - EYE;
	for (const b of BOX) {
		if (footY > b[4] - 0.25) continue;
		const qx = Math.max(b[0], Math.min(b[2], p.x)), qz = Math.max(b[1], Math.min(b[3], p.z)), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
		if (d2 >= 0.09) continue;
		if (d2 < 1e-8) { p.z = b[3] + 0.3; continue; }
		const d = Math.sqrt(d2); p.x = qx + dx / d * 0.3; p.z = qz + dz / d * 0.3;
	}
}
const climber = createClimber({ floorAt, pushOut });
const props = new T.Group(); scene.add(props);
function drawBoxes() {
	props.clear();
	for (const b of BOX) {
		const m = new T.Mesh(new T.BoxGeometry(b[2] - b[0], b[4], b[3] - b[1]), new T.MeshStandardMaterial({ color: b[5] ? 0x9a8f80 : 0x7a5a3a, roughness: 0.9 }));
		m.position.set((b[0] + b[2]) / 2, b[4] / 2, (b[1] + b[3]) / 2); m.castShadow = m.receiveShadow = true; props.add(m);
	}
}
let row = [];
// a row running at (low, speed, run) each, on the spot, caught after a while
function run(list, { gap = 1.4, armed = true, steps = 40 } = {}) {
	for (const q of Object.values(pool)) { q.P.root.visible = false; q.hand?.hide(); }
	BOX.length = 0; drawBoxes();
	row = list.map((o, i) => ({ o, x: (i - (list.length - 1) / 2) * gap, f: fighter(i, armed) }));
	for (const w of row) { const { P, M } = w.f; P.root.visible = true; w.f.climbY = null; M.act(null); M.S.clutch = null; M.place(w.x, 0, 0, Math.PI); }
	for (let f = 0; f < steps; f++) {
		time += 1 / 30;
		for (const w of row) {
			const { P, M, hand } = w.f;
			M.want.speed = w.o.speed; M.want.run = w.o.run; M.want.low = w.o.low; M.want.heading = Math.PI;
			M.update(1 / 30, time, null); M.S.pos.z = 0;
			if (hand) hand.follow(P, M.S.heading, true, M, time, 1 / 30);
		}
	}
	return row.map((w) => ({ low: +w.f.M.S.low.v.toFixed(2) }));
}
// a row each running at what is ahead of it (kind: fence or ledge), caught at climb time t (0..1)
function vault(list, { gap = 2.2, armed = true } = {}) {
	for (const q of Object.values(pool)) { q.P.root.visible = false; q.hand?.hide(); }
	BOX.length = 0;
	row = list.map(([kind, t], i) => ({ kind, t, x: (i - (list.length - 1) / 2) * gap, f: fighter(i, armed), C: null, done: false }));
	for (const w of row) { if (w.kind === 'ledge') ledge(w.x, -3, 1.2); else fence(w.x, -3, 1.0); }
	drawBoxes();
	for (const w of row) { const { P, M } = w.f; P.root.visible = true; w.f.climbY = null; M.act(null); M.S.clutch = null; M.place(w.x, 0, 0, Math.PI); }
	const out = [];
	for (let f = 0; f < 150 && row.some((w) => !w.done); f++) {
		time += 1 / 60;
		for (const w of row) {
			if (w.done) continue;
			const { P, M, hand } = w.f, S = M.S;
			if (!w.C) {
				M.want.speed = 4.2; M.want.run = 1; M.want.low = 0; M.want.heading = Math.PI;
				w.C = climber.look(S.pos.x, S.pos.z, S.pos.y, 0, -1, S.speed.v);
				if (w.C && w.C.t >= w.t) w.done = true;
			}
			if (w.C) {
				const at = climber.step(w.C, 1 / 60);
				w.f.climbY = at.feet;
				climbBody(M, w.C, at, !!hand);
				if (w.C.t >= w.t) w.done = true;
			}
			M.update(1 / 60, time, null);
			P.root.updateMatrixWorld(true);
			if (hand) hand.follow(P, S.heading, true, M, time, 1 / 60);
			else if (S.clutch) applyClutch(P, M, 1 / 60);
		}
	}
	const fy = (P, n) => { const e = P.bones[P.map[n]].matrixWorld.elements; return +e[13].toFixed(2); };
	for (const w of row) out.push({ kind: w.kind, climb: w.C?.kind || null, t: w.C ? +w.C.t.toFixed(2) : null, z: +w.f.M.S.pos.z.toFixed(2), y: +w.f.M.S.pos.y.toFixed(2), act: w.f.M.S.act.name, feet: [fy(w.f.P, 'foot.L'), fy(w.f.P, 'foot.R')], hips: fy(w.f.P, 'root'), clutch: !!w.f.M.S.clutch });
	return out;
}
function cam(x, y, z, tx, ty, tz, fov = 30) {
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
window.MV = { run, vault, cam };
window.MV_READY = true;
