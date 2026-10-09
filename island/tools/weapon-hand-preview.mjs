// Real MakeHuman skeleton and production first/third-person held-item paths.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { createViewmodel } from '../src/crysis/viewmodel.js';
import { createHand, weaponOf, kitLight } from '../src/crysis/held-items.js';
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(960, 600); renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#596973');
const sun = new T.DirectionalLight(0xffe3c6, 2.6); sun.position.set(3, 7, -4);
const hemi = new T.HemisphereLight(0xd9e8ff, 0x4d4838, 1.3); scene.add(sun, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), .04); scene.environment = env.texture; pm.dispose(); kitLight(env.texture, .7);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x535d58, roughness: .9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new T.PerspectiveCamera(52, 1.6, .01, 100);
const assets = await loadPeopleAssets(), dna = personDNA(9172, { age: 37 });
const P = buildPerson(assets, dna), M = createMotion(P, () => 0); M.place(0, 0, 0, Math.PI); scene.add(P.root);
P.root.traverse(o => { for (const m of [o.material].flat().filter(Boolean)) if ('envMap' in m) { m.envMap = env.texture; m.envMapIntensity = .65; } });
const me = { P, M }, vm = createViewmodel({ camera, avatar: { me }, mount: document.body, canvas: renderer.domElement }), hand = createHand(scene);
const state = { pos: new T.Vector3(), vel: new T.Vector3(), yaw: 0, pitch: 0, grounded: true }, world = { sky: { sun, hemi } };
let time = 0, held = null, third = false;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });
function frame(dt = 1 / 60, render = true) {
	time += dt; P.root.visible = third;
	if (third) { M.update(dt, time, null); hand.follow(P, Math.PI, true, M, time, dt); }
	else hand.hide();
	vm.update(dt, held, state, !third, world, time);
	if (render) { renderer.render(scene, camera); if (!third) vm.render(renderer); }
}
function select(id, mode) {
	held = { i: id, l: 1, t: 0 }; third = mode === 'third'; hand.set(id); vm.aim(false); hand.aim?.(false);
	M.act(null); camera.zoom = 1;
	if (third) { camera.position.set(1.6, 1.5, -2.6); camera.lookAt(0, 1.15, 0); }
	else { camera.position.set(0, 1.68, 0); camera.rotation.set(0, 0, 0); }
	camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
	for (let i = 0; i < 80; i++) frame(1 / 60, false); frame();
}
function aim(on, pitch = 0) { state.pitch = pitch; if (third) { hand.aim?.(on); hand.aimPitch?.(pitch); } else vm.aim(on); }
function sizes() {
	const results = [], holder = createHand(new T.Scene());
	for (const height of [1.5, 1.75, 2]) {
		const d = personDNA(1701, { age: 35 }); d.height = height;
		const body = buildPerson(assets, d), motion = createMotion(body, () => 0); motion.place(0, 0, 0, Math.PI);
		for (const id of ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine', 'reedline-hunting-bow']) for (const pitch of [-.45, 0, .45]) {
			holder.set(id); holder.aim(true); holder.aimPitch(pitch);
			for (let i = 0; i < 90; i++) { motion.update(1 / 60, time, null); holder.follow(body, Math.PI, true, motion, time, 1 / 60); }
			results.push({ height, pitch, ...holder.info(body, Math.PI) });
		}
	}
	holder.dispose(); return results;
}
window.weaponReview = { select, frame, aim, fire: () => third ? hand.fire(null) : vm.fire(), reload: () => third ? hand.reload(null, null) : vm.reload(),
	sizes,
	info: () => third ? hand.info(P, Math.PI) : vm.info(), weapon: id => weaponOf(id),
	reloading: () => third ? hand.reloading : vm.reloading, png: () => renderer.domElement.toDataURL('image/png'),
	failed: () => renderer.info.programs.filter(p => p.diagnostics?.runnable === false).length,
	third, vm, hand, P, M };
window.WEAPON_HAND_READY = true;
