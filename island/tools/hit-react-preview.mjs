// Hit zones and hit reactions under review: real fighters (people/body.js, a rifle in their hands
// through crysis/held-items.js, dressed as a squad would dress them) in a row, each struck in one
// zone (combat/wounds.js) and caught mid-reaction; the zones themselves (combat/hitzones.js) drawn
// over a body. Bundle with esbuild and drive window.HR from hit-react-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { kitLight } from '../src/crysis/held-items.js';
import { npcHand } from '../src/combat/weapon-view.js';
import { outfitFor } from '../src/combat/outfits.js';
import { FACTIONS } from '../src/combat/factions.js';
import { bodyShapes } from '../src/combat/hitzones.js';
import { createWounds, react, pace } from '../src/combat/wounds.js';
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
const ground = () => 0;
const fid = 'ashfang', F = FACTIONS[fid] || {};
const pool = {};
function fighter(i, armed) {
	const key = i + (armed ? 'a' : 'u');
	if (pool[key]) return pool[key];
	const seed = 1000 + i * 7919;
	const d = personDNA(seed, { age: 24 + (i % 20), style: outfitFor({ fid, kind: F.kind, colors: F.colors, masked: false }, seed) });
	const P = buildPerson(A, d); scene.add(P.root);
	P.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	const M = createMotion(P, ground);
	const hand = armed ? npcHand(scene, F.gun || 'aurora-trail-rifle', 3, 1) : null;
	return (pool[key] = { P, M, hand, W: createWounds() });
}
const zoneLines = new T.Group(); scene.add(zoneLines);
const COL = { head: 0xff3b30, neck: 0xff9500, chest: 0xffcc00, gut: 0x34c759, shoulder: 0x5ac8fa, arm: 0x007aff, leg: 0xaf52de };
function drawZones(P) {
	zoneLines.clear();
	for (const s of bodyShapes(P) || []) {
		const a = new T.Vector3(s.a.x, s.a.y, s.a.z), b = new T.Vector3(s.b.x, s.b.y, s.b.z), L = a.distanceTo(b);
		const g = new T.CapsuleGeometry(s.r, Math.max(0.001, L), 4, 10);
		const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: COL[s.part] || 0xffffff, wireframe: true, transparent: true, opacity: 0.55, depthTest: false }));
		m.position.copy(a).lerp(b, 0.5);
		if (L > 1e-4) m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
		m.renderOrder = 10; zoneLines.add(m);
	}
}
let row = [];
// a row of fighters, each hit in its zone [part, side] (null: unhurt), facing the camera (-z)
function show(hits, { gap = 1.5, armed = true, at = 0.3, zones = -1, seed = 1 } = {}) {
	let r = seed;
	const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
	for (const q of Object.values(pool)) { q.P.root.visible = false; q.hand?.hide(); }
	row = hits.map((hit, i) => ({ hit, x: (i - (hits.length - 1) / 2) * gap, f: fighter(i, armed) }));
	for (const w of row) {
		const { P, M } = w.f;
		P.root.visible = true; M.act(null); M.S.clutch = null; M.S.limp.side = 0; M.S.limp.k = 0; w.f.W = createWounds();
		M.place(w.x, 0, 0, Math.PI);
	}
	for (let f = 0; f < 60; f++) step(1 / 30);
	const out = [];
	for (const w of row) {
		if (!w.hit) { out.push(null); continue; }
		const [part, side, k = 0.3, legs] = w.hit;
		const { P, M } = w.f;
		if (legs) { w.f.W.legs.L = legs; }
		// the zone's own shape, struck in its middle from the camera side
		P.root.updateMatrixWorld(true);
		const shapes = bodyShapes(P), s = shapes.find((q) => q.part === part && (!side || q.side === side)) || shapes[0];
		const atp = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2, z: (s.a.z + s.b.z) / 2 - s.r };
		const blow = { part, side: s.side, shape: s, at: atp, dir: { x: 0, y: 0, z: 1 } };
		const R = react(w.f.W, M, P, blow, { dealt: k * 100 }, { max: 100, armed: !!w.f.hand, rand });
		M.jolt(0, 1, 1.2, (rand() - 0.5) * 0.5, 0.04);
		w.R = R; out.push(R && { name: R.name, dur: +R.dur.toFixed(2), crippled: R.crippled, clutch: !!M.S.clutch });
	}
	const n = Math.round(at / (1 / 30));
	for (let f = 0; f < n; f++) step(1 / 30);
	if (zones >= 0 && row[zones]) drawZones(row[zones].f.P); else zoneLines.clear();
	return out;
}
function step(dt) {
	time += dt;
	for (const w of row) {
		const { P, M, hand } = w.f, pc = pace(w.f.W);
		M.S.limp.side = pc.side === 'L' ? 1 : pc.side === 'R' ? -1 : 0; M.S.limp.k = pc.limp;
		if (w.f.W.crippled) M.act(`hurt-crippled${w.f.W.crippled}${hand ? '+' : ''}`, 0);
		M.want.speed = w.walk || 0; M.want.heading = Math.PI;
		M.update(dt, time, null);
		if (w.walk) { M.S.pos.z = 0; }
		if (hand) hand.follow(P, M.S.heading, true, M, time, dt);
		else if (M.S.clutch) { P.root.updateMatrixWorld(true); applyClutch(P, M, dt); }
	}
}
// a limping walk on the spot: legs wound k on a side
function limp(side, k, steps = 50) {
	for (const w of row) { w.f.W.legs[side] = k; w.walk = 1.3; }
	for (let f = 0; f < steps; f++) step(1 / 30);
}
function cam(x, y, z, tx, ty, tz, fov = 30) {
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
window.HR = { show, step, limp, cam, row: () => row, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
window.HR_READY = true;
