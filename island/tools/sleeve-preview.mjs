// First-person sleeves and garments under review: the player's real MakeHuman body dressed in
// a chosen outfit, the production weapon viewmodel and close-combat fists rebuilt for it, and
// fixed carry, aim, reload, guard, strike and block states to capture.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { createViewmodel } from '../src/crysis/viewmodel.js';
import { kitLight } from '../src/crysis/held-items.js';
import { createFistView } from '../src/combat/melee-view.js';
import { MOVES } from '../src/combat/melee-rules.js';
import { outfitFor } from '../src/combat/outfits.js';
import { dressInGear } from '../src/people/armor-looks.js';
import * as KL from '../src/people/kit-light.js';
import { applyInk, flashAtlas } from '../src/tattoo/skinink.js';

const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#596973');
const sun = new T.DirectionalLight(0xffe3c6, 2.6); sun.position.set(3, 7, -4);
const hemi = new T.HemisphereLight(0xd9e8ff, 0x4d4838, 1.3); scene.add(sun, hemi);
// (the kit's reflections only: the game's world and its first-person layer have no scene environment)
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), .04); pm.dispose(); kitLight(env.texture, .7);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x535d58, roughness: .9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new T.PerspectiveCamera(52, innerWidth / innerHeight, .01, 100);
scene.add(camera);
const assets = await loadPeopleAssets();
const phoneTier = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const world = { sky: { sun, hemi } }, state = { pos: new T.Vector3(), vel: new T.Vector3(), yaw: 0, pitch: 0, grounded: true };
let time = 0, P = null, M = null, me = null, vm = null, fists = null, held = null;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

// the outfits under review: what people wear in the street and in the fights
export const OUTFITS = {
	// the hero's own top (people/hero.js): a fitted charcoal longsleeve, its sleeves pushed up
	hero: { top: { kind: 'longsleeve', col: '#36383c', pat: 'plain', fit: 'fitted', sleeves: 'rolled', push: true, tuck: true, shoulderEase: 0.6 }, outer: null },
	tee: { top: { kind: 'tee', col: '#3d4f63', acc: '#e9e4d6', pat: 'plain', fit: 'regular', sleeves: 'short' }, outer: null, ink: true },
	hoodie: { top: { kind: 'hoodie', col: '#7d8086', acc: '#2b2d31', pat: 'plain', fit: 'oversized', sleeves: 'long' }, outer: null },
	police: (() => { const o = outfitFor({ kind: 'police' }, 11); o.top = { ...o.top, col: '#1c2540', sleeves: 'long' }; return o; })(),
	military: (() => { const o = outfitFor({ kind: 'military' }, 5); o.top = { ...o.top, sleeves: 'elbow', roll: true }; o.outer = null; if (!o.acc.some(q => q.kind === 'gloves')) o.acc.push({ kind: 'gloves', col: '#2a2b2e' }); return o; })(),
	layered: { top: { kind: 'flannel', col: '#7a2a2a', acc: '#1b1b1d', acc2: '#ede4d0', pat: 'plaid', fit: 'regular', sleeves: 'long', collar: true }, outer: { kind: 'denim', col: '#4a6189', pat: 'denim', fit: 'regular', sleeves: 'long', open: true } },
	shell: { top: { kind: 'hoodie', col: '#36383c', acc: '#1b1b1d', pat: 'plain', fit: 'regular', sleeves: 'long' }, outer: { kind: 'shell', col: '#2a7d7f', acc: '#1b1b1d', pat: 'block', fit: 'oversized', sleeves: 'long', open: false, fab: 'nylon' } },
	swat: outfitFor({ fid: 'swat', kind: 'police' }, 4),
	// plate armour: the steel gauntlet's back and cuff, lit by the sky as the game lights it
	knight: dressInGear({ top: null, outer: null, acc: [] }, { body: 'plate-cuirass', hands: 'plate-gauntlets' }),
};

function dress(name) {
	const want = OUTFITS[name];
	if (P) scene.remove(P.root);
	fists?.dispose();
	const d = personDNA(9172, { age: 37 });
	d.style = { ...d.style, ...want, acc: want.acc || [] }; d.styleSig = null;
	P = buildPerson(assets, d); M = createMotion(P, () => 0); M.place(0, 0, 0, Math.PI); scene.add(P.root); P.root.visible = false;
	P.root.traverse(o => { for (const m of [o.material].flat().filter(Boolean)) if ('envMap' in m) { m.envMap = env.texture; m.envMapIntensity = .65; } });
	if (want.ink) {
		const F = flashAtlas();
		applyInk(P.skinMat, P, [{ slot: 'forearm.R', angle: 0.4, along: 0.55, size: 0.085, tile: F.tiles[3], fade: 0.9 }, { slot: 'forearm.L', angle: -0.6, along: 0.45, size: 0.075, tile: F.tiles[6], fade: 0.8 }], F.tex);
	}
	me = { P, M };
	vm = createViewmodel({ camera, avatar: { me }, mount: null, canvas: renderer.domElement, isPhone: phoneTier, fingers: 'now', shaders: 'now' });
	fists = createFistView({ camera, isPhone: phoneTier });
	held = null;
	return { outfit: P.outfit.top?.kind, outer: P.outfit.outer?.kind || null };
}
function frame(dt = 1 / 60, render = true) {
	time += dt;
	vm.update(dt, held, state, true, world, time);
	KL.kitDaylight?.(renderer, world.sky, 1);
	if (render) { scene.updateMatrixWorld(true); renderer.render(scene, camera); vm.render(renderer, scene); }
}
function reset() {
	camera.zoom = 1; camera.near = 0.01; camera.position.set(0, 1.68, 0); camera.rotation.set(0, 0, 0); camera.fov = 52; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
// a weapon at carry, aim or reload
function weapon(id, stage) {
	reset(); fists.hide(); vm.cancel?.(); vm.aim(false);
	held = { i: id, l: 1, t: 0 }; M.act(null);
	for (let i = 0; i < 90; i++) frame(1 / 60, false);
	if (stage === 'aim') { vm.aim(true); for (let i = 0; i < 80; i++) frame(1 / 60, false); }
	if (stage === 'reload') { vm.reload(); for (let i = 0; i < 42; i++) frame(1 / 60, false); }
	frame();
	return { ...vm.info(), failed: failed() };
}
const fistState = { on: true, item: null, move: null, anim: null, m: null, mt: 0, charging: false, charge: 0, block: false, take: false, cuffed: false, dodge: 0, dodgeSide: 0, rock: 0, step: 0, pace: 0 };
// the fists at guard, a straight right at full reach, or the block
function fist(mode) {
	reset(); held = null; vm.cancel?.();
	for (let i = 0; i < 4; i++) frame(1 / 60, false);
	// (the game's own near plane, which the fists must stay clear of)
	camera.near = 0.25; camera.updateProjectionMatrix();
	const s = fistState, mv = mode === 'strike' ? MOVES.cross : mode === 'jab' ? MOVES.jab : null;
	s.block = mode === 'block'; s.move = mv ? mv.anim : null; s.anim = s.move; s.m = mv; s.mt = mv ? mv.wind + mv.active * .85 : 0;
	for (let i = 0; i < 100; i++) { time += 1 / 60; fists.update(1 / 60, time, s, me); }
	KL.kitDaylight?.(renderer, world.sky, 1);
	scene.updateMatrixWorld(true); renderer.render(scene, camera);
	let tris = 0, garment = 0; fists.root.traverse(o => { if (o.visible && o.geometry?.index) { tris += o.geometry.index.count / 3; if (o.name === 'garment-arms') garment += o.geometry.index.count / 3; } });
	return { calls: renderer.info.render.calls, tris, garment, failed: failed() };
}
const failed = () => renderer.info.programs.filter(p => p.diagnostics?.runnable === false).length;
window.sleeveReview = { dress, weapon, fist, frame, png: () => renderer.domElement.toDataURL('image/png'), failed, outfits: Object.keys(OUTFITS), camera, get vm() { return vm; }, get fists() { return fists; }, get P() { return P; }, phoneTier, renderer };
window.SLEEVE_READY = true;
