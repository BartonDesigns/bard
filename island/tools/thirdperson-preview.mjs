// Third-person clothing and holds review: real bodies dressed by the production wardrobe and
// combat outfits, each armed one holding its item through the production hand (held-items.js).
// Bundle with esbuild and drive window.TP from thirdperson-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { createHand, kitLight } from '../src/crysis/held-items.js';
import { outfitFor } from '../src/combat/outfits.js';
import { ACTIONS } from '../src/people/actions.js';

const W = +(new URLSearchParams(location.search).get('w') || 900), H = +(new URLSearchParams(location.search).get('h') || 900);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = false;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#7d8a92');
const sun = new T.DirectionalLight(0xffe7cf, 2.4); sun.position.set(3, 7, -5);
const fill = new T.DirectionalLight(0xcfe0ff, 0.7); fill.position.set(-4, 3, -2);
const hemi = new T.HemisphereLight(0xd9e8ff, 0x4d4838, 1.1); scene.add(sun, fill, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), .04); scene.environment = env.texture; pm.dispose(); kitLight(env.texture, .7);
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x59625c, roughness: .9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new T.PerspectiveCamera(34, W / H, .01, 100);
const assets = await loadPeopleAssets();
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

// the cast: civilians in the four common tops, a police officer, a soldier, a gang member,
// and the avatar (a rifle, then the bow)
const jeans = { kind: 'jeans', col: '#2b3d63', pat: 'denim', legs: 'long', fit: 'straight' };
const shoes = { kind: 'sneaker', col: '#f3f2ee', sole: '#f3f2ee' };
const CAST = {
	tee: { seed: 4217, male: true, outfit: { top: { kind: 'tee', col: '#b0432f', pat: 'plain', fit: 'regular', sleeves: 'short' }, outer: null, bottom: jeans, shoes } },
	hoodie: { seed: 1278, male: true, outfit: { top: { kind: 'hoodie', col: '#405b54', pat: 'plain', fit: 'oversized', sleeves: 'long', fab: 'fleece' }, outer: null, bottom: { kind: 'joggers', col: '#2a2b30', pat: 'track', acc: '#2a2b30', legs: 'long', fit: 'regular', cuff: true }, shoes } },
	shirt: { seed: 9172, male: false, outfit: { top: { kind: 'shirt', col: '#a9cdee', pat: 'oxford', fit: 'regular', sleeves: 'long' }, outer: null, bottom: { kind: 'chinos', col: '#a89a74', pat: 'plain', legs: 'long', fit: 'straight' }, shoes: { kind: 'loafer', col: '#4e3226', sole: '#2a1a12' } } },
	jacket: { seed: 3311, male: true, outfit: { top: { kind: 'tee', col: '#ede4d0', pat: 'plain', fit: 'regular', sleeves: 'short' }, outer: { kind: 'jacket', col: '#3c4a2c', pat: 'plain', fit: 'regular', sleeves: 'long', open: true }, bottom: jeans, shoes: { kind: 'boot', col: '#4e3226', sole: '#1b1b1d' } } },
	worker: { seed: 5150, male: true, outfit: { top: { kind: 'shirt', col: '#5d6b7a', pat: 'chambray', fit: 'regular', sleeves: 'rolled' }, outer: { kind: 'pufferVest', col: '#d7f22a', acc: '#c9ccd0', pat: 'hivis', fit: 'regular', sleeves: 'none', open: false, fab: 'nylon' }, bottom: { kind: 'cargo', col: '#36383c', pat: 'cargo', legs: 'long', fit: 'regular' }, shoes: { kind: 'boot', col: '#4e3226', sole: '#1b1b1d' } } },
	police: { seed: 2024, male: true, side: { fid: 'police', kind: 'police', colors: ['#1c2540', '#d9c46a'] }, gun: 'mossback-scout-rifle' },
	soldier: { seed: 77, male: true, side: { fid: 'guard', kind: 'military', colors: ['#4a5236', '#c9c2a2'] }, gun: 'warden-spark-carbine' },
	gang: { seed: 31337, male: true, side: { fid: 'glasshouse', kind: 'gang', colors: ['#2fb5a8', '#eef3f2'] }, gun: 'warden-spark-carbine' },
	avatar: { seed: 7919, male: true, gun: 'aurora-trail-rifle' },
};
const built = {};
function person(name) {
	if (built[name]) return built[name];
	const c = CAST[name], d = personDNA(c.seed, { age: c.age || 34 });
	d.sex = c.male ? 0.9 : 0.1; d.male = !!c.male;
	if (c.outfit || c.side) {
		const o = c.outfit ? { ...c.outfit, acc: [] } : outfitFor(c.side, c.seed);
		d.style = { ...d.style, ...o, gen: o.gen || d.style.gen }; d.styleSig = null;
	}
	const P = buildPerson(assets, d), M = createMotion(P, () => 0);
	M.place(0, 0, 0, Math.PI);
	P.root.traverse((o) => { for (const m of [o.material].flat().filter(Boolean)) if ('envMap' in m) { m.envMap = env.texture; m.envMapIntensity = .6; } });
	scene.add(P.root); P.root.visible = false;
	const hand = c.gun ? createHand(scene, { lod: name === 'avatar' ? 'high' : 'low' }) : null;
	if (hand) hand.set(c.gun, 3, 1);
	return (built[name] = { P, M, hand, gun: c.gun });
}
let active = null;
// show one of the cast: aim (bool), pitch, gun (an id, or null to put it away), bow draw, walking
function show(name, { aim = false, pitch = 0, gun, draw = 0, walk = 0, frames = 90, pose = null } = {}) {
	for (const b of Object.values(built)) { b.P.root.visible = false; b.hand?.hide(); }
	const b = person(name);
	active = b;
	b.P.root.visible = true;
	if (gun !== undefined && b.hand) { b.gun = gun; b.hand.set(gun, 3, 1); }
	b.M.setPose(pose || 'rest');
	if (b.hand) { b.hand.aim(aim); b.hand.aimPitch(pitch); b.hand.bow?.({ draw, loaded: true, nock: 1 }); }
	b.M.trigger?.('R', aim ? 1 : 0);
	b.M.want.speed = walk;
	for (let i = 0; i < frames; i++) {
		time += 1 / 60;
		b.M.update(1 / 60, time, null);
		if (walk) { b.M.S.pos.set(0, 0, 0); }
		if (b.hand && b.gun) b.hand.follow(b.P, Math.PI, true, b.M, time, 1 / 60); else b.hand?.hide();
	}
	b.P.lod?.(2);
	return { info: b.hand && b.gun ? b.hand.info(b.P, Math.PI) : null, height: b.P.height, clothVerts: b.P.cloth?.geometry.attributes.position.count, clothTris: b.P.cloth ? b.P.cloth.geometry.index.count / 3 : 0, accTris: b.P.acc ? b.P.acc.geometry.attributes.position.count / 3 : 0, skinTris: b.P.skin.geometry.index.count / 3, outfit: b.P.outfit };
}
// the camera: from (x, y, z) at (tx, ty, tz), in metres off the person's feet; the person faces -z
function cam(x, y, z, tx, ty, tz, fov = 34) {
	camera.fov = fov; camera.updateProjectionMatrix();
	camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
window.TP = { show, cam, person, CAST, ACTIONS, T, scene, renderer, camera, get active() { return active; }, failed: () => renderer.info.programs.filter((p) => p.diagnostics?.runnable === false).length, info: () => renderer.info.render };
window.TP_READY = true;
