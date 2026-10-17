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

const W = +(new URLSearchParams(location.search).get('w') || 1600), H = +(new URLSearchParams(location.search).get('h') || 800);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new T.Scene(); scene.background = new T.Color('#7d8a92');
const sun = new T.DirectionalLight(0xffe7cf, 2.4); sun.position.set(3, 7, -5);
const fill = new T.DirectionalLight(0xcfe0ff, 0.7); fill.position.set(-4, 3, -2);
scene.add(sun, fill, new T.HemisphereLight(0xd9e8ff, 0x4d4838, 1.1));
const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04); pm.dispose(); kitLight(env.texture, 0.7);
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
const built = new Map();
// a person: a set of gear worn (name in SETS) or a side's kit (side:seed), at x
function person(key, seed = 4217, female = false) {
	const id = `${key}:${seed}:${female}`;
	if (built.has(id)) return built.get(id);
	const d = personDNA(seed, { age: 32 });
	d.sex = female ? 0.1 : 0.9; d.male = !female;
	const [side, s2] = key.split('/');
	if (SIDES[side]) { d.style = { ...d.style, ...outfitFor(SIDES[side], +s2 || seed), gen: d.style.gen }; d.styleSig = null; }
	else d.style = dressInGear(d.style, SETS[key]);
	const P = buildPerson(assets, d), M = createMotion(P, () => 0);
	M.place(0, 0, 0, Math.PI);
	// (no reflections on people, as in the game, so steel looks as it will there)
	scene.add(P.root);
	const b = { P, M };
	built.set(id, b);
	return b;
}
// stand these in a row (keys, each [key, seed, female]), facing the camera, and settle them
function lineup(list, gap = 0.95) {
	for (const b of built.values()) b.P.root.visible = false;
	const out = [];
	list.forEach(([key, seed, female], i) => {
		const b = person(key, seed, female), x = (i - (list.length - 1) / 2) * gap;
		b.P.root.visible = true; b.M.place(x, 0, 0, Math.PI); b.M.setPose('rest');
		out.push(b);
	});
	for (let f = 0; f < 60; f++) { time += 1 / 60; for (const b of out) b.M.update(1 / 60, time, null); }
	for (const b of out) b.P.lod?.(2);
	return out.map((b) => ({ acc: b.P.outfit?.acc?.map((q) => q.kind), accTris: b.P.acc ? b.P.acc.geometry.attributes.position.count / 3 : 0 }));
}
function cam(x, y, z, tx, ty, tz, fov = 30) {
	camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
	camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true);
	renderer.render(scene, camera);
	return renderer.domElement.toDataURL('image/png');
}
window.AP = { lineup, cam, person, SETS, failed: () => renderer.info.programs.filter((p) => p.diagnostics?.runnable === false).length };
window.AP_READY = true;
