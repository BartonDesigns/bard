// Skin under review: the player's real MakeHuman body in a chosen skin tone and outfit, the
// production first-person weapon view and fists rebuilt for it, lit as the game lights them
// (AgX, the sky's sun and hemisphere by day, or the dimmed sun of an interior), with close-ups
// of each hand, the bare forearm, and a person's face and hands at conversation distance.
// Bundled by tools/skin-browser.mjs; not part of the shipped app.
import * as T from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { createViewmodel } from '../src/crysis/viewmodel.js';
import { kitLight } from '../src/crysis/held-items.js';
import { createFistView } from '../src/combat/melee-view.js';
import { applyInk, flashAtlas } from '../src/tattoo/skinink.js';
import { handAttributes } from '../src/people/hand-surface.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = T.AgXToneMapping; renderer.toneMappingExposure = 1.15;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#8fa3b4');
const sun = new T.DirectionalLight(0xfff0dc, 3.4); sun.position.set(3, 7, -4);
const hemi = new T.HemisphereLight(0xbfd8ff, 0x5a5230, 1.15); scene.add(sun, sun.target, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), .04); pm.dispose(); kitLight(env.texture, .7);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x6b6450, roughness: .9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new T.PerspectiveCamera(52, innerWidth / innerHeight, .01, 100);
scene.add(camera);
const assets = await loadPeopleAssets();
const phoneTier = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
let indoor = false;
const world = { sky: { sun, hemi }, houses: { inside: () => indoor } }, state = { pos: new T.Vector3(), vel: new T.Vector3(), yaw: 0, pitch: 0, grounded: true };
let time = 0, P = null, M = null, me = null, vm = null, fists = null, held = null, npc = null;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

// skin tones across the game's DNA (people/body.js personDNA): the ancestry blend and tone
export const TONES = {
	light: { ancestry: [0.02, 0.06, 0.92], tone: 1.0, warmth: 0.4 },
	medium: { ancestry: [0.05, 0.85, 0.1], tone: 0.97, warmth: 0.6 },
	tan: { ancestry: [0.18, 0.2, 0.62], tone: 0.94, warmth: 0.7 },
	deep: { ancestry: [0.85, 0.02, 0.13], tone: 0.95, warmth: 0.5 },
};
const OUTFITS = {
	tee: { top: { kind: 'tee', col: '#3d4f63', acc: '#e9e4d6', pat: 'plain', fit: 'regular', sleeves: 'short' }, outer: null, ink: true },
	hoodie: { top: { kind: 'hoodie', col: '#7d8086', acc: '#2b2d31', pat: 'plain', fit: 'oversized', sleeves: 'long' }, outer: null },
};
function dnaFor(tone, seed = 9172, male = true) {
	const t = TONES[tone];
	const d = personDNA(seed, { age: 37, ancestry: t.ancestry });
	d.tone = t.tone; d.warmth = t.warmth;
	if (male !== d.male) { d.male = male; d.sex = male ? 0.9 : 0.1; }
	return d;
}
// the light: 'day' (the sky's noon) or 'indoor' (an interior: the sun a fifth through the
// windows, a dimmer and warmer sky)
function light(kind) {
	indoor = kind === 'indoor';
	if (indoor) { sun.color.set(0xffe2c0); sun.intensity = 3.4; hemi.color.set(0xd8cbb8); hemi.groundColor.set(0x4a3a2a); hemi.intensity = 0.55; scene.background.set('#4a4440'); }
	else { sun.color.set(0xfff0dc); sun.intensity = 3.4; hemi.color.set(0xbfd8ff); hemi.groundColor.setRGB(0.46, 0.36, 0.18); hemi.intensity = 1.15; scene.background.set('#8fa3b4'); }
	return kind;
}
function setup({ tone = 'medium', outfit = 'tee', lighting = 'day' } = {}) {
	if (P) scene.remove(P.root);
	fists?.dispose();
	light(lighting);
	const want = OUTFITS[outfit], d = dnaFor(tone);
	d.style = { ...d.style, ...want, acc: [] }; d.styleSig = null;
	P = buildPerson(assets, d); M = createMotion(P, () => 0); M.place(0, 0, 0, Math.PI); scene.add(P.root); P.root.visible = false;
	if (want.ink) {
		const F = flashAtlas();
		applyInk(P.skinMat, P, [{ slot: 'forearm.R', angle: 0.4, along: 0.55, size: 0.085, tile: F.tiles[3], fade: 0.9 }, { slot: 'forearm.L', angle: -0.6, along: 0.45, size: 0.075, tile: F.tiles[6], fade: 0.8 }], F.tex);
	}
	me = { P, M };
	vm = createViewmodel({ camera, avatar: { me }, mount: null, canvas: renderer.domElement, isPhone: phoneTier, fingers: 'now', shaders: 'now' });
	fists = createFistView({ camera, isPhone: phoneTier });
	held = null;
	return { tone, outfit, lighting, skin: P.skinMat.color.getHexString() };
}
function frame(dt = 1 / 60, render = true) {
	time += dt;
	vm.update(dt, held, state, true, world, time);
	if (render) { scene.updateMatrixWorld(true); renderer.render(scene, camera); vm.render(renderer, scene); }
}
function reset() {
	if (npc) npc.root.visible = false;
	floor.visible = true;
	camera.zoom = 1; camera.near = 0.01; camera.position.set(0, 1.68, 0); camera.rotation.set(0, 0, 0); camera.fov = 52; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
let mode = null;
function weapon(id, stage = 'carry') {
	reset(); fists.hide(); vm.cancel?.(); vm.aim(false); mode = 'weapon';
	held = { i: id, l: 1, t: 0 }; M.act(null);
	for (let i = 0; i < 90; i++) frame(1 / 60, false);
	if (stage === 'aim') { vm.aim(true); for (let i = 0; i < 80; i++) frame(1 / 60, false); }
	frame();
	return { ...vm.info(), failed: failed() };
}
const fistState = { on: true, item: null, move: null, anim: null, m: null, mt: 0, charging: false, charge: 0, block: false, take: false, cuffed: false, dodge: 0, dodgeSide: 0, rock: 0, step: 0, pace: 0 };
function fist(block = false) {
	reset(); held = null; vm.cancel?.(); mode = 'fist';
	for (let i = 0; i < 4; i++) frame(1 / 60, false);
	camera.near = 0.25; camera.updateProjectionMatrix();
	const s = fistState; s.block = block; s.move = s.anim = s.m = null; s.mt = 0;
	for (let i = 0; i < 100; i++) { time += 1 / 60; fists.update(1 / 60, time, s, me); }
	scene.updateMatrixWorld(true); renderer.render(scene, camera);
	let tris = 0; fists.root.traverse(o => { if (o.visible && o.geometry?.index) tris += o.geometry.index.count / 3; });
	return { calls: renderer.info.render.calls, tris, failed: failed() };
}
// the hand's skin mesh now on screen, and where a bone of it is in the world
function handMesh(side) {
	if (mode === 'fist') return fists.root.getObjectByName('anatomical-hand-' + side);
	let skin = null;
	vm.state.model?.parent?.parent?.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'garment-arms' && o.material !== vm.state.model.getObjectByName('body')?.material && (!skin || o.geometry.index.count > skin.geometry.index.count)) skin = o; });
	return skin;
}
const inspect = new T.PerspectiveCamera(30, 1, 0.005, 5), at = new T.Vector3(), tmp = new T.Vector3();
// a close look at one hand: from a direction in the view's frame, dist metres off, aimed at a
// bone (finger3-1 by default: the middle knuckle; 'wrist' or 'lowerarm02' for the forearm)
function closeup(side = 'R', from = [1, 0.3, 0.4], dist = 0.3, bone = 'finger3-1') {
	const mesh = handMesh(side);
	if (!mesh) return null;
	mesh.updateMatrixWorld(true);
	at.setFromMatrixPosition(mesh.skeleton.bones[P.map[bone + '.' + side]].matrixWorld).applyMatrix4(mesh.matrixWorld);
	const size = new T.Vector2(); renderer.getSize(size);
	const dir = tmp.set(...from).normalize();
	if (mode === 'fist') dir.transformDirection(camera.matrixWorld);
	inspect.aspect = size.x / size.y; inspect.position.copy(at).addScaledVector(dir, dist); inspect.up.set(0, 1, 0); if (mode === 'fist') inspect.up.set(0, 1, 0).transformDirection(camera.matrixWorld);
	inspect.lookAt(at); inspect.updateProjectionMatrix(); inspect.updateMatrixWorld(true);
	const sc = mode === 'fist' ? scene : mesh.parent.parent;
	if (mode !== 'fist') renderer.setClearColor(indoor ? 0x4a4440 : 0x8fa3b4, 1);
	renderer.clear(); renderer.render(sc, inspect);
	return renderer.domElement.toDataURL('image/png');
}
// a person met in the street: face and hands at conversation distance
function person(tone = 'medium', shot = 'face', male = true) {
	reset(); fists.hide(); held = null; frame(1 / 60, false); mode = 'npc';
	const key = tone + male;
	if (!npc || npc.key !== key) {
		if (npc) scene.remove(npc.root);
		const d = dnaFor(tone, 5150 + Object.keys(TONES).indexOf(tone), male);
		d.style = { ...d.style, ...OUTFITS.tee, acc: [] }; d.styleSig = null;
		const B = buildPerson(assets, d), Mo = createMotion(B, () => 0);
		Mo.place(0, 0, 0, 0); scene.add(B.root);
		for (let i = 0; i < 30; i++) Mo.update(1 / 60, 40 + i / 60, null);
		npc = { key, B, Mo, root: B.root };
	}
	npc.root.visible = true;
	// (the same moment of their idle every time, so captures match)
	const was0 = time; time = 50; npc.Mo.update(1 / 60, time, null); time = was0; npc.B.lod?.(1.2);
	scene.updateMatrixWorld(true);
	const B = npc.B, head = new T.Vector3().setFromMatrixPosition(B.bones[B.map.head].matrixWorld), hand = new T.Vector3().setFromMatrixPosition(B.bones[B.map['finger3-1.R']].matrixWorld);
	// (a narrower lens at conversation distance, the sun over the viewer's shoulder)
	camera.fov = 30;
	if (shot === 'face') { camera.position.set(head.x + 0.3, head.y + 0.04, head.z + 1.1); camera.lookAt(head.x, head.y + 0.05, head.z); }
	else if (shot === 'close') { camera.position.set(head.x + 0.18, head.y + 0.03, head.z + 0.55); camera.lookAt(head.x, head.y + 0.03, head.z); }
	else { camera.position.set(hand.x + 0.05, hand.y + 0.12, hand.z + 0.6); camera.lookAt(hand); }
	camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
	const was = sun.position.clone(); sun.position.set(3, 6, 6);
	scene.updateMatrixWorld(true); renderer.render(scene, camera);
	sun.position.copy(was);
	return { failed: failed() };
}
// shows one of the hands' shader values as colour (a GLSL vec3 expression over the shader's
// own names, say 'vec3(vHandA.x)' or 'vec3(skinCav)'), or null for the skin again
function debug(expr) {
	const mats = new Set();
	for (const root of [vm.state.model?.parent?.parent, fists.root]) root?.traverse((o) => { if (o.material?.userData?.hand) mats.add(o.material); });
	for (const m of mats) {
		m.userData.compile ||= m.onBeforeCompile; m.userData.key ||= m.customProgramCacheKey;
		const base = m.userData.compile, key = m.userData.key;
		m.onBeforeCompile = expr ? (sh) => { base(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor = vec4(' + expr + ', 1.0);'); } : base;
		m.customProgramCacheKey = () => key() + (expr || '');
		m.needsUpdate = true;
	}
	return mats.size;
}
// what the skin costs: its programs so far, and the hands' map (its time to lay, its bytes)
function cost() {
	const skin = renderer.info.programs.map((p) => /crysis-skin[\w-]*/.exec(p.cacheKey)?.[0]).filter(Boolean);
	const out = { programs: renderer.info.programs.length, skin };
	const mesh = handMesh('R');
	if (mesh) {
		const g = mesh.geometry, t0 = Date.now();
		handAttributes(P, g);
		out.mapMs = Date.now() - t0;
		out.verts = g.attributes.position.count; out.tris = g.index.count / 3;
		out.mapBytes = ['handA', 'handB', 'handC'].reduce((s, k) => s + g.attributes[k].array.byteLength, 0);
	}
	return out;
}
const failed = () => renderer.info.programs.filter(p => p.diagnostics?.runnable === false).length;
const programs = () => renderer.info.programs.map(p => p.name + ':' + p.cacheKey.slice(0, 40));
window.skinReview = { setup, weapon, fist, closeup, person, light, frame, debug, cost, png: () => renderer.domElement.toDataURL('image/png'), failed, programs, get P() { return P; }, get vm() { return vm; }, get fists() { return fists; }, phoneTier, renderer, scene, camera, tones: Object.keys(TONES) };
window.SKIN_READY = true;
