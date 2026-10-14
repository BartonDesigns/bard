// Review page for carried things: the shared bags near and far, the favour props, people
// wearing and carrying them in a walk, and the lost dog in each mood. Bundle with esbuild
// and drive with props-browser.cjs.
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../src/people/body.js';
import { createMotion } from '../src/people/motion.js';
import { bagGeometry } from '../src/people/bags.js';
import { kitMaterial } from '../src/people/propkit.js';
import { favourProp } from '../src/people/favour-props.js';
import { createDog, BREEDS } from '../src/people/dog.js';
import { renderDogSounds } from '../src/people/dog-voice.js';

const W = innerWidth, H = innerHeight;
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
// the labels, written over the picture when it is taken
const labels = { list: [], set innerHTML(v) { this.list = []; } };
const scene = new T.Scene(); scene.background = new T.Color('#55626a');
const sun = new T.DirectionalLight(0xfff0dc, 2.4); sun.position.set(3, 6, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
const hemi = new T.HemisphereLight(0xdbe8ff, 0x51493c, 1.1); scene.add(sun, hemi);
const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x6b6f66, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new T.PerspectiveCamera(30, 1, 0.01, 200);
let time = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => time * 1000 });
const group = new T.Group(); scene.add(group);
function clear() { group.clear(); labels.innerHTML = ''; }
function label(text, x, y) { labels.list.push([text, x, y]); }
// the picture and its labels, as a PNG data URL
function snap() {
	const c = document.createElement('canvas'); c.width = W; c.height = H;
	const g = c.getContext('2d'); g.drawImage(renderer.domElement, 0, 0);
	g.font = '600 13px sans-serif'; g.fillStyle = '#f4f4f0'; g.shadowColor = '#000'; g.shadowBlur = 3;
	for (const [t, x, y] of labels.list) g.fillText(t, x, y + 12);
	return c.toDataURL('image/png');
}
// a grid of cells, each its own camera on its own thing
function grid(cells, cols) {
	const rows = Math.ceil(cells.length / cols), cw = Math.floor(W / cols), ch = Math.floor(H / rows);
	renderer.setScissorTest(true);
	cells.forEach((c, i) => {
		const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
		renderer.setViewport(x, H - y - ch, cw, ch); renderer.setScissor(x, H - y - ch, cw, ch);
		camera.aspect = cw / ch; camera.fov = c.fov || 30; camera.position.copy(c.eye); camera.lookAt(c.at); camera.updateProjectionMatrix();
		for (const o of group.children) o.visible = !c.only || c.only.includes(o);
		renderer.render(scene, camera);
		label(c.label, x + 8, y + 6);
	});
	renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
	for (const o of group.children) o.visible = true;
}
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

const BAGS = [
	['backpack', 0, '#2f4f6f', '#c8553d', 'backpack'], ['backpack', 1, '#262a2e', '#262a2e', 'slim backpack'], ['tote', 0, '#e8dcc0', '#d0592f', 'canvas tote'], ['tote', 1, '#2c2c2c', '#e8c547', 'tote, striped'],
	['paper', 0, '#b08a5e', '#b08a5e', 'paper bag, bread'], ['paper', 1, '#f0ece2', '#f0ece2', 'paper bag, groceries'], ['paper', 2, '#4d6b58', '#4d6b58', 'gift bag'], ['plastic', 0, '#f4f4f0', '#f4f4f0', 'plastic carrier'],
	['handbag', 0, '#5a3a26', '#5a3a26', 'handbag'], ['pouch', 0, '#1d1d1f', '#1d1d1f', 'crossbody pouch'],
];
// every bag, near version (big) and far version (small, beside it)
function bagSheet() {
	clear();
	const cells = [], out = {};
	BAGS.forEach(([kind, v, a, b, name], i) => {
		const near = bagGeometry(kind, v, true), far = bagGeometry(kind, v, false), m = kitMaterial(a, b);
		const x = i * 3, hang = kind === 'backpack' ? 0 : kind === 'pouch' ? 0.16 : 0.58;
		const n = new T.Mesh(near, m), f = new T.Mesh(far, m);
		n.position.set(x, hang, 0); f.position.set(x + 0.7, hang, 0); n.castShadow = f.castShadow = true;
		if (kind === 'backpack') { n.rotation.y = f.rotation.y = Math.PI; }
		group.add(n, f);
		out[name] = { near: tris(near), far: tris(far) };
		const c = new T.Vector3(x + 0.18, kind === 'backpack' ? 0.24 : 0.24, 0);
		cells.push({ eye: c.clone().add(new T.Vector3(0.35, 0.45, 1.9)), at: c, label: `${name}: ${tris(near)} / ${tris(far)} tris`, only: [n, f] });
	});
	grid(cells, 4);
	return out;
}
// close-ups of the near versions from three sides
function bagCloseups(kinds) {
	clear();
	const cells = [];
	kinds.forEach((i) => {
		const [kind, v, a, b, name] = BAGS[i], m = new T.Mesh(bagGeometry(kind, v, true), kitMaterial(a, b));
		const x = i * 3, hang = kind === 'backpack' ? 0 : kind === 'pouch' ? 0.16 : 0.58;
		m.position.set(x, hang, 0); if (kind === 'backpack') m.rotation.y = Math.PI; m.castShadow = true; group.add(m);
		const c = new T.Vector3(x, kind === 'backpack' ? 0.24 : kind === 'pouch' ? 0.1 : 0.26, 0);
		for (const [dx, dy, dz, side] of [[0.25, 0.25, 0.85, 'front'], [0.9, 0.4, 0.1, 'side'], [-0.4, 0.7, -0.6, 'above, behind']]) cells.push({ eye: c.clone().add(new T.Vector3(dx, dy, dz)), at: c, label: `${name}: ${side}`, only: [m], fov: 34 });
	});
	grid(cells, 3);
}
function favourSheet() {
	clear();
	const cells = [], out = {};
	['keys', 'phone', 'wallet', 'glasses', 'earbud', 'ticket', 'scarf', 'bag'].forEach((s, i) => {
		const f = favourProp(s), m = new T.Mesh(f.geo, f.mat);
		m.position.set(i * 2, f.lift, 0); m.rotation.y = 0.5; m.castShadow = true; group.add(m);
		out[s] = tris(f.geo);
		const size = { keys: 0.12, phone: 0.2, wallet: 0.16, glasses: 0.16, earbud: 0.05, ticket: 0.18, scarf: 0.6, bag: 0.5 }[s];
		const c = new T.Vector3(i * 2, s === 'bag' ? 0.15 : 0.005, 0);
		cells.push({ eye: c.clone().add(new T.Vector3(size * 0.9, size * 1.3, size * 1.5)), at: c, label: `${s}: ${tris(f.geo)} tris`, only: [m] });
	});
	grid(cells, 4);
	return out;
}
// people carrying them, mid-stride
let assets = null;
async function people() {
	clear();
	assets = assets || await loadPeopleAssets();
	const outfits = [
		[1201, 24, [{ kind: 'backpack', col: '#2f4f6f', acc: '#c8553d' }]],
		[5577, 35, [{ kind: 'backpack', col: '#262a2e', acc: '#262a2e', slim: true }, { kind: 'shopper', paper: true, fill: 0, col: '#b08a5e' }]],
		[808, 41, [{ kind: 'tote', col: '#e8dcc0', acc: '#d0592f' }]],
		[3030, 52, [{ kind: 'handbag', col: '#5a3a26' }, { kind: 'crossbody', col: '#1d1d1f' }]],
		[4242, 29, [{ kind: 'shopper', paper: false, col: '#f4f4f0' }]],
		[919, 11, [{ kind: 'backpack', col: '#2354c7', acc: '#1b1b1d' }]],
	];
	const bodies = [], info = [];
	outfits.forEach(([seed, age, acc], i) => {
		const d = personDNA(seed, { age });
		d.style = { ...d.style, acc: [...(d.style.acc || []).filter((q) => !/backpack|tote|crossbody|shopper|handbag/.test(q.kind)), ...acc] };
		d.styleSig = JSON.stringify(d.outfit);
		const P = buildPerson(assets, d), M = createMotion(P, () => 0);
		M.place(i * 3, 0, 0, 0); M.want.speed = 1.35; M.want.heading = 0;
		P.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
		group.add(P.root); bodies.push({ P, M, x: i * 3 });
		info.push({ seed, bags: P.bags.map((b) => b.fit.bag.kind), accTris: P.acc ? P.acc.geometry.attributes.position.count / 3 : 0 });
	});
	for (let k = 0; k < 150; k++) { time += 1 / 60; for (const b of bodies) b.M.update(1 / 60, time, null); }
	group.updateMatrixWorld(true);
	const cells = [];
	for (const [i, b] of bodies.entries()) {
		const p = b.P.root.position, h = b.P.height;
		const c = new T.Vector3(p.x, h * 0.62, p.z);
		cells.push({ eye: c.clone().add(new T.Vector3(1.6, 0.25, -2.4)), at: c, label: `${info[i].bags.join(' + ')}: behind`, only: [b.P.root], fov: 32 });
		cells.push({ eye: c.clone().add(new T.Vector3(-1.9, 0.2, 2.2)), at: c, label: 'front', only: [b.P.root], fov: 32 });
	}
	grid(cells, 4);
	return info;
}
// a close look at the straps on the shoulder
function strapCloseup() {
	const b = group.children[0];
	const cells = [];
	const p = b.position, c = new T.Vector3(p.x, 1.32, p.z - 0.02);
	cells.push({ eye: c.clone().add(new T.Vector3(0.7, 0.35, 0.2)), at: c, label: 'strap over the shoulder', only: [b], fov: 30 });
	cells.push({ eye: c.clone().add(new T.Vector3(-0.15, 0.1, 0.9)), at: c, label: 'straps in front', only: [b], fov: 30 });
	cells.push({ eye: c.clone().add(new T.Vector3(0.5, 0.15, -0.8)), at: c.clone().setY(1.15), label: 'pack from behind', only: [b], fov: 34 });
	cells.push({ eye: c.clone().add(new T.Vector3(1.0, -0.2, 0.0)), at: c.clone().setY(1.1), label: 'side', only: [b], fov: 34 });
	clear(); group.add(b);
	grid(cells, 2);
}

// ---------- the dog ----------
let dogs = [];
function dogMoods() {
	clear(); dogs.forEach((d) => d.dispose()); dogs = [];
	const moods = [['sad', 'lost: head low, ears back, tail tucked'], ['alert', 'alert: ears up'], ['calm', 'calm, following'], ['happy', 'happy: tail going'], ['jump', 'jumping up'], ['sit', 'sitting'], ['lie', 'lying down'], ['run', 'bounding run']];
	const cells = [];
	BREEDS.forEach((breed, bi) => {
		moods.forEach(([mood, text], mi) => {
			if (bi > 0 && !['sad', 'happy', 'run', 'sit'].includes(mood)) return;
			const dog = createDog({ seed: 11 + bi, breed: breed.id });
			const x = bi * 6 + mi * 0.0, z = mi * 4;
			dog.place(x, 0, z, Math.PI / 2 + 0.35);
			dog.pose(mood);
			for (let k = 0; k < 40; k++) { time += 1 / 30; dog.animate(1 / 30); }
			dog.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
			group.add(dog.root); dogs.push(dog);
			const s = dog.size, c = new T.Vector3(x, s * 0.6, z);
			cells.push({ eye: c.clone().add(new T.Vector3(s * 1.1, s * 0.6, s * 3.4)), at: c, label: `${breed.name}: ${text}`, only: [dog.root], fov: 34 });
		});
	});
	group.updateMatrixWorld(true);
	grid(cells, 4);
	return { count: cells.length, tris: Object.fromEntries(BREEDS.map((b) => [b.id, createDog({ seed: 1, breed: b.id }).tris])) };
}
// each breed as built, before anything moves it, side on and from the front
function dogRest() {
	clear(); dogs.forEach((d) => d.dispose()); dogs = [];
	const cells = [];
	BREEDS.forEach((breed, bi) => {
		const dog = createDog({ seed: 4 + bi * 3, breed: breed.id });
		dog.place(bi * 4, 0, 0, Math.PI / 2); dog.root.updateMatrixWorld(true);
		group.add(dog.root); dogs.push(dog);
		const s = dog.size, c = new T.Vector3(bi * 4, s * 0.6, 0);
		cells.push({ eye: c.clone().add(new T.Vector3(0, s * 0.1, s * 4.4)), at: c, label: `${breed.name}: as built, side`, only: [dog.root], fov: 34 });
		cells.push({ eye: c.clone().add(new T.Vector3(s * 3.2, s * 0.6, s * 0.6)), at: c, label: 'front', only: [dog.root], fov: 34 });
	});
	grid(cells, 4);
}
// the reunion, frame by frame: the dog bounds to its owner and jumps up
let reunion = null;
async function reunionStart() {
	clear();
	assets = assets || await loadPeopleAssets();
	const d = personDNA(2718, { age: 33 }), P = buildPerson(assets, d), M = createMotion(P, () => 0);
	M.place(0, 0, 0, Math.PI / 2); P.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	const dog = createDog({ seed: 3, breed: 'lab' });
	dog.place(-6.4, 0, 0.4, Math.PI / 2);
	group.add(P.root, dog.root);
	reunion = { P, M, dog, t: 0 };
	return true;
}
function reunionFrame(dt = 1 / 15, steps = 3) {
	const R = reunion;
	for (let k = 0; k < steps; k++) {
		const h = dt / steps; time += h; R.t += h;
		R.dog.update(h, { mode: 'reunion', owner: { x: R.P.root.position.x, z: R.P.root.position.z }, ground: () => 0 });
		R.M.update(h, time, null);
	}
	group.updateMatrixWorld(true);
	const c = new T.Vector3(-2.8, 0.7, 0);
	camera.position.set(-2.8, 1.6, 7.4); camera.aspect = W / H; camera.fov = 42; camera.lookAt(c); camera.updateProjectionMatrix();
	labels.innerHTML = ''; label(`reunion t=${R.t.toFixed(2)}s: ${R.dog.mood()}`, 10, 8);
	renderer.render(scene, camera);
	return { t: R.t, mood: R.dog.mood() };
}
async function sounds() {
	return renderDogSounds();
}
window.propsReview = { dogRest, snap, bagSheet, bagCloseups, favourSheet, people, strapCloseup, dogMoods, reunionStart, reunionFrame, sounds, renderer, scene };
window.PROPS_READY = true;
