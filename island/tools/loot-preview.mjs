// Production combat + AI death + ragdoll + recovery + saved inventory, in a flat test arena.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCombat } from '../src/combat/combat.js';
import { createArmsRuntime } from '../src/crysis/arms-runtime.js';
import { createRagdolls } from '../src/people/ragdoll.js';
import { kitLight } from '../src/crysis/held-items.js';

document.body.style.cssText = 'margin:0;overflow:hidden;background:#243036';
const mount = document.createElement('div'); mount.style.cssText = 'position:relative;width:100vw;height:100vh'; document.body.append(mount);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = T.ACESFilmicToneMapping; mount.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#687983');
const sun = new T.DirectionalLight(0xffe3c6, 2.6); sun.position.set(3, 7, -4);
scene.add(sun, new T.HemisphereLight(0xd9e8ff, 0x4d4838, 1.3));
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), .04); scene.environment = env.texture; pm.dispose(); kitLight(env.texture, .7);
const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x535d58, roughness: .9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
scene.add(new T.GridHelper(200, 200, 0x687769, 0x586658));
const camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, .01, 200);
const pos = new T.Vector3(0, 1.68, 0), player = { state: { pos, grounded: true, yaw: 0, pitch: 0 } };
const world = { island: { heightAt: () => 0 }, player, seed: 123 };
const isPhone = matchMedia('(pointer: coarse)').matches;
const arms = createArmsRuntime({ storageKey: 'recovery-browser-review', world: () => world });
const ragdolls = createRagdolls({ world: () => world, isPhone }); await ragdolls.ready();
const messages = []; let busy = false;
const combat = createCombat({ scene, camera, mount, world: () => world, people: () => ({ pool: [] }), ragdolls, arms, gear: () => null, hint: (s) => messages.push(s), isPhone, busy: () => busy });
combat.ambient(false);
let laterInteractions = 0;
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'e') laterInteractions++; });
function frame(dt = 1 / 60, render = true) { camera.position.copy(pos); camera.updateMatrixWorld(true); combat.update(dt); ragdolls.update(dt); scene.updateMatrixWorld(true); if (render) renderer.render(scene, camera); }
camera.position.copy(pos); camera.lookAt(0, .8, -3); frame();
let timer = setInterval(() => frame(), 16);
async function fallen(fid = 'ashfang') {
	const before = new Set(combat.targets().map((t) => t.id));
	await combat.spawn(fid, 1, { d: 4 });
	clearInterval(timer); timer = null;
	const target = [...combat.layer.map.values()].find((t) => t.kind === 'hostile' && !before.has(t.id));
	const h = target.ref;
	// Pose the real soldier before applying the fatal production hit.
	h.body?.M.update(1 / 60, 1, null); h.body?.P.root.updateMatrixWorld(true);
	const expected = { ...h.loadout };
	const result = target.onHit({ amount: 10000, type: 'ballistic', part: 'torso', dir: { x: 1, y: 0, z: 0 } });
	await Promise.resolve(); // The production ragdoll starts after its ready promise resolves.
	pos.set(h.pos.x, 1.68, h.pos.z + 2.3); camera.position.copy(pos); camera.lookAt(h.pos.x, .25, h.pos.z);
	for (let i = 0; i < 150; i++) frame(1 / 60, false);
	frame();
	return { expected, result, loot: combat.recovery.info(), dead: h.dead, ragdoll: ragdolls.info() };
}
window.review = {
	fallen, frame, combat, arms,
	state: () => ({ inventory: arms.state(), held: arms.held(), loot: combat.recovery.info(), messages, laterInteractions, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, shaderOK: renderer.info.programs.every((p) => p.diagnostics?.runnable !== false), glError: renderer.getContext().getError() }),
	busy(on) { busy = on; frame(); },
	move(dx = 0, dy = 0, dz = 0) { pos.add(new T.Vector3(dx, dy, dz)); frame(); },
	lookAway() { camera.rotation.y += Math.PI; frame(); },
	resume() { if (!timer) timer = setInterval(() => frame(), 16); },
};
