// A mob of one kind in a row, as the game makes them (creatures/models.js makeCreature, each one
// varied: its size, colour and who it is, creatures/motion.js character()), under the game's
// own light (sun or moon, sky, air fog), standing, menacing, marching or striking. For checking
// that no two stand or go alike and that they sit in the light. Driven by monsters/mob-browser.cjs
// through window.MOB.
import * as THREE from 'three';
import { installAirFog } from '../../src/world/airfog.js';
import { makeCreature } from '../../src/creatures/models.js';
import { hollowKing } from '../../src/creatures/hollow-king.js';
import { crystalLegs } from '../../src/creatures/crystal-legs.js';
import { facetLook } from '../../src/creatures/facets.js';
import { createContactShadows, standOf, footShade } from '../../src/creatures/contact.js';

installAirFog();
const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1200), H = +(q.get('h') || 700);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const sun = new THREE.DirectionalLight(0xfff0dc, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.intensity = 0.78;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.9);
scene.add(hemi);
scene.fog = new THREE.FogExp2(0xa9c4dc, 0.004);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x4f5a34, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// their shade on the ground, as combat/ai-squads.js contactOf lays it (?contact=0: none)
const shade = createContactShadows({ isPhone: false });
scene.add(shade.mesh);
const FLAT = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 };
const _p = new THREE.Vector3();
function contacts() {
	shade.begin();
	if (q.get('contact') !== '0') for (const c of mob) {
		const St = c.stand || (c.stand = standOf(c.meta)), sc = c.root.scale, B = St.body, r = c.root;
		const yaw = r.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
		c.root.updateMatrixWorld(true);
		if (St.flyer) { shade.put(r.position.x, r.position.z, FLAT, B.rx * sc.x, B.rz * sc.z, yaw, 0.26); continue; }
		shade.put(r.position.x + fx * B.cz * sc.z, r.position.z + fz * B.cz * sc.z, FLAT, B.rx * sc.x, B.rz * sc.z, yaw, 0.3);
		for (const f of St.feet) {
			const p = c.motion.at(f.bone, _p);
			if (!p) continue;
			const k = footShade(p.y - f.y0 * sc.y, St.hipH * sc.y);
			shade.put(p.x + fx * f.fz * sc.z, p.z + fz * f.fz * sc.z, FLAT, f.r * sc.x, f.r * 1.35 * sc.z, yaw, 0.42 * k);
		}
	}
	shade.end();
}

// light: day (sun high behind the camera's shoulder), dusk (low sun ahead: backlit), night (the moon)
function light(kind = 'day') {
	if (kind === 'night') {
		sun.color.setRGB(0.45, 0.55, 0.8); sun.intensity = 0.36; sun.position.set(-8, 14, -10);
		hemi.color.setRGB(0.03, 0.05, 0.1); hemi.groundColor.setRGB(0.05, 0.04, 0.02); hemi.intensity = 0.25;
		scene.background = new THREE.Color(0x05080f); scene.fog.color.setRGB(0.02, 0.03, 0.06); renderer.toneMappingExposure = 1.6;
		ground.material.color.setHex(0x2a3020);
	} else if (kind === 'dusk') {
		sun.color.setRGB(1, 0.6, 0.3); sun.intensity = 2.2; sun.position.set(-4, 3, -16);
		hemi.color.setRGB(0.55, 0.5, 0.6); hemi.groundColor.setRGB(0.3, 0.22, 0.12); hemi.intensity = 0.6;
		scene.background = new THREE.Color(0xd08a5a); scene.fog.color.setRGB(0.75, 0.55, 0.45); renderer.toneMappingExposure = 1.2;
		ground.material.color.setHex(0x4f5a34);
	} else {
		sun.color.setRGB(1, 0.9, 0.74); sun.intensity = 3; sun.position.set(9, 16, 12);
		hemi.color.setHex(0xbfd8ff); hemi.groundColor.setRGB(0.46, 0.36, 0.18); hemi.intensity = 0.9;
		scene.background = new THREE.Color(0x9fc0e0); scene.fog.color.setHex(0xa9c4dc); renderer.toneMappingExposure = 1.15;
		ground.material.color.setHex(0x4f5a34);
	}
	sun.target.position.set(0, 0, 0);
}

let mob = [];
// n of kind id in a row, gap m apart (seed: each one's draw, the same every run)
async function load(id, n = 5, { gap = null, seed = 1 } = {}) {
	for (const c of mob) scene.remove(c.root);
	mob = [];
	let s = seed >>> 0;
	const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
	for (let i = 0; i < n; i++) {
		const c = await makeCreature(id === 'facet-wraith' ? 'moonturned' : id);
		// (dressed as the game dresses them: combat/ai-squads.js creatureBody)
		if (id === 'hollow-king') hollowKing(c);
		if (id === 'shard-mite') crystalLegs(c);
		if (id === 'facet-wraith') c.facets = facetLook(c);
		c.vary(rnd, { tame: id === 'moonturned' });
		scene.add(c.root);
		mob.push(c);
	}
	const h = mob[0].meta.height || 2, g = gap ?? Math.max(1.1, h * 0.75);
	mob.forEach((c, i) => { c.root.position.set((i - (n - 1) / 2) * g, 0, 0); c.root.rotation.set(0, 0, 0); });
	return { height: h, rig: mob[0].meta.rig, n };
}
// run them all t seconds in steps of dt, with what the fight would hand them (speed, menace, side...)
function step(t, dt = 1 / 30, opts = {}) {
	for (let k = 0; k < t / dt; k++) for (const c of mob) {
		const pk = opts.pace ? c.motion.pace() : 1;
		c.motion.update(dt, { ...opts, speed: (opts.speed || 0) * pk });
		if (opts.move) c.root.position.z += (opts.speed || 0) * pk * dt;
	}
	return mob.map((c) => +c.motion.state.phase.toFixed(2));
}
function strike(kind) { for (const c of mob) c.motion.strike(undefined, kind); }
function beat(kind) { for (const c of mob) c.motion.beat(kind); }
// one fixed pose on every one (motion.pose)
function pose(name, t = 0, kind = null) { for (const c of mob) { c.motion.pose(name, t, { kind }); c.root.updateMatrixWorld(true); } }
// view: front | three | side | low, framing the row
function shot(view = 'three') {
	const n = mob.length, h = mob[0]?.meta.height || 2;
	const span = Math.max(h * 1.2, (mob.at(-1)?.root.position.x || 0) * 2 + h);
	const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 400);
	const t15 = Math.tan(THREE.MathUtils.degToRad(15));
	const d = Math.max(span * 1.1 / (2 * t15 * (W / H)), h * 1.3 / (2 * t15));
	const cz = mob.reduce((a, c) => a + c.root.position.z, 0) / Math.max(1, n);
	const dir = { front: [0, 0.18, 1], three: [-0.5, 0.25, 0.85], side: [-1, 0.15, 0.05], low: [-0.3, 0.05, 1] }[view];
	const v = new THREE.Vector3(...dir).normalize().multiplyScalar(d);
	cam.position.set(v.x, h * 0.5 + v.y, cz + v.z);
	cam.lookAt(0, h * 0.45, cz);
	sun.target.position.set(0, 0, cz);
	contacts();
	renderer.render(scene, cam);
	return renderer.domElement.toDataURL('image/png');
}
window.MOB = { load, step, strike, beat, pose, shot, light, scene, THREE, mob: () => mob };
window.MOB_READY = true;
