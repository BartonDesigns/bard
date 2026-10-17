// Armour and combat gear on real bodies: each set worn over a person's own clothes
// (people/armor-looks.js), and the reworked militia and soldiers (combat/outfits.js), in a
// line-up and close up. Bundle with esbuild and drive window.AP from armor-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { kitLight } from '../src/crysis/held-items.js';
import { outfitFor } from '../src/combat/outfits.js';
import { dressInGear } from '../src/people/armor-looks.js';
import * as KL from '../src/people/kit-light.js';

const W = +(new URLSearchParams(location.search).get('w') || 1600), H = +(new URLSearchParams(location.search).get('h') || 800);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#7d8a92');
const sun = new T.DirectionalLight(0xffe7cf, 2.4); sun.position.set(3, 7, -5);
const fill = new T.DirectionalLight(0xcfe0ff, 0.7); fill.position.set(-4, 3, -2);
const hemi = new T.HemisphereLight(0xd9e8ff, 0x4d4838, 1.1);
scene.add(sun, fill, hemi);
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04); pm.dispose(); kitLight(env.texture, 0.7);
// the lighting: 'inspect', even studio light; 'world', the island's daylight as the game sets
// it (a warm low sun, a blue sky light, no fill); the sky in people's kit as the game gives it
// (people/kit-light.js; absent in older builds)
let mode0 = 'inspect';
function light(mode = 'inspect') {
	mode0 = mode;
	if (mode === 'world') {
		scene.background = new T.Color('#9fbfdc'); sun.color.set(0xfff0dc); sun.intensity = 3.0; sun.position.set(-4, 6, -6); fill.intensity = 0;
		hemi.color.set(0xbcd4ec); hemi.groundColor.set(0x5b5440); hemi.intensity = 1.25;
	} else {
		scene.background = new T.Color('#7d8a92'); sun.color.set(0xffe7cf); sun.intensity = 2.4; sun.position.set(3, 7, -5); fill.intensity = 0.7;
		hemi.color.set(0xd9e8ff); hemi.groundColor.set(0x4d4838); hemi.intensity = 1.1;
	}
	KL.kitDaylight?.(renderer, { sun, hemi }, 1);
	clay(mode === 'clay');
}
// 'clay': everyone in one plain grey, so the forms are judged without their materials
const CLAY = new T.MeshStandardMaterial({ color: 0xa9a7a3, roughness: 0.62, metalness: 0 });
function clay(on) {
	for (const b of built.values()) b.P.root.traverse((m) => {
		if (!m.isMesh) return;
		if (on && m.material !== CLAY) { m.userData.mat = m.material; m.material = CLAY; }
		else if (!on && m.userData.mat) { m.material = m.userData.mat; m.userData.mat = null; }
	});
}
const built = new Map();
light();
const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x59625c, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new T.PerspectiveCamera(30, W / H, 0.01, 100);
const assets = await loadPeopleAssets();
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });

const SETS = {
	knight: { head: 'great-helm', body: 'plate-cuirass', legs: 'plate-greaves', hands: 'plate-gauntlets', feet: 'sabatons' },
	sergeant: { head: 'kettle-helm', body: 'mail-hauberk', legs: 'mail-chausses', hands: 'leather-bracers', feet: 'riding-boots' },
	squire: { body: 'gambeson', legs: 'rangers-trousers', hands: 'fieldcraft-gloves', feet: 'riding-boots' },
	operator: { head: 'ballistic-helmet', body: 'plate-carrier', legs: 'combat-trousers', hands: 'tactical-gloves', feet: 'combat-boots' },
	rigged: { head: 'ops-cap', body: 'chest-rig', legs: 'combat-trousers', hands: 'tactical-gloves', feet: 'combat-boots' },
	mage: { head: 'wayfarers-hood', body: 'aetherweave-coat', legs: 'aetherweave-trousers', hands: 'spellbinder-gloves', feet: 'duskwalker-boots' },
	ranger: { head: 'stargazer-circlet', body: 'rangers-jacket', legs: 'rangers-trousers', hands: 'fieldcraft-gloves', feet: 'trailstrider-boots' },
};
const SIDES = { militia: { fid: 'ridgeback', kind: 'militia', colors: ['#5b6a3a', '#c9b98a'] }, soldier: { fid: 'guard', kind: 'military', colors: ['#4a5236', '#c9c2a2'] } };
// a person: a set of gear worn (name in SETS) or a side's kit (side:seed), at x
function person(key, seed = 4217, female = false) {
	const id = `${key}:${seed}:${female}`;
	if (built.has(id)) return built.get(id);
	const d = personDNA(seed, { age: 32 });
	d.sex = female ? 0.1 : 0.9; d.male = !female;
	const [side, s2] = key.split('/');
	if (SIDES[side]) { d.style = { ...d.style, ...outfitFor(SIDES[side], +s2 || seed), gen: d.style.gen }; d.styleSig = null; }
	else d.style = dressInGear(d.style, SETS[key]);
	const t0 = Date.now(), P = buildPerson(assets, d), M = createMotion(P, () => 0);
	// (what it cost to build: the time, and the kit's triangles)
	(window.AP_LOAD ||= {})[id] = { ms: Date.now() - t0, accTris: P.acc ? P.acc.geometry.attributes.position.count / 3 : 0 };
	M.place(0, 0, 0, Math.PI);
	scene.add(P.root);
	const b = { P, M };
	built.set(id, b);
	return b;
}
// stand these in a row (keys, each [key, seed, female]), facing the camera, and settle them in
// a pose: idle, walk (in place, mid-stride), crouch, aim (both arms up and forward), raise (arms up)
function lineup(list, gap = 0.95, pose = 'idle') {
	for (const b of built.values()) b.P.root.visible = false;
	const out = [];
	list.forEach(([key, seed, female], i) => {
		const b = person(key, seed, female), x = (i - (list.length - 1) / 2) * gap;
		b.P.root.visible = true; b.M.place(x, 0, 0, Math.PI); b.M.setPose(pose === 'aim' ? 'drive' : 'rest');
		b.M.act(pose === 'crouch' ? 'crouch' : pose === 'raise' ? 'cheer' : null, pose === 'crouch' ? 0.6 : pose === 'raise' ? 0.5 : undefined);
		b.M.want.speed = pose === 'walk' ? 1.3 : 0;
		out.push({ ...b, x });
	});
	const frames = pose === 'walk' ? 46 : 60;
	for (let f = 0; f < frames; f++) {
		time += 1 / 60;
		for (const b of out) { b.M.update(1 / 60, time, null); if (pose === 'walk') { b.M.S.pos.x = b.x; b.M.S.pos.z = 0; } }
	}
	for (const b of out) b.P.lod?.(2);
	clay(mode0 === 'clay');
	return out.map((b) => ({ acc: b.P.outfit?.acc?.map((q) => q.kind), accTris: b.P.acc ? b.P.acc.geometry.attributes.position.count / 3 : 0 }));
}
function cam(x, y, z, tx, ty, tz, fov = 30) {
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
window.AP = { lineup, cam, person, light, SETS, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }), failed: () => renderer.info.programs.filter((p) => p.diagnostics?.runnable === false).length };
window.AP_READY = true;
