// Island engine, stage 1. Loaded by the Bard faceplate on demand; runs as a
// third world beside the caves and space flight, sharing the faceplate's
// music, keyboard, play surfaces and Journey transfers.

import * as THREE from 'three';
import { generateIsland } from './world/islandgen.js';
import { createTerrain, makeHeightTexture, makeMaskTexture } from './world/terrain.js';
import { createOcean } from './world/ocean.js';
import { createSky } from './world/sky.js';
import { createVegetation } from './world/vegetation.js';
import { createGrass } from './world/grass.js';
import { createVillage } from './world/village.js';
import { createDistant } from './world/distant.js';
import { createPlayer } from './player.js';
import { createMusic } from './music.js';
import { createFauna } from './fauna.js';

const REALM = 'island';
const isPhone = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function css(el, s) { el.style.cssText = s; return el; }
function button(label, title, style) {
	const b = document.createElement('button');
	b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
	css(b, 'position:absolute;min-width:44px;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(8,20,26,.55);color:#eafaf6;font:600 13px system-ui;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;cursor:pointer;' + style);
	return b;
}

function buildDom() {
	const mount = css(document.createElement('div'), 'position:fixed;inset:0;z-index:40;display:none;background:#000;overflow:hidden;touch-action:none;');
	mount.id = 'l99-island-mount';
	const canvas = css(document.createElement('canvas'), 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;');
	const joy = css(document.createElement('div'), 'position:absolute;width:110px;height:110px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06);display:none;pointer-events:none;');
	const knob = css(document.createElement('div'), 'position:absolute;left:33px;top:33px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.45);');
	joy.appendChild(knob);
	const back = button('◀ Bard', 'Back to the Bard faceplate', 'left:calc(12px + env(safe-area-inset-left));top:calc(12px + env(safe-area-inset-top));');
	const jump = button('⤒', 'Jump', 'right:calc(18px + env(safe-area-inset-right));bottom:calc(28px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;font-size:22px;');
	const gear = button('☀', 'Sky and world settings', 'right:calc(12px + env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top));');
	const hint = css(document.createElement('div'), 'position:absolute;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:rgba(8,20,26,.5);color:#eafaf6;font:13px system-ui;pointer-events:none;transition:opacity .6s;text-align:center;max-width:80vw;');
	const loading = css(document.createElement('div'), 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#10333a,#050b10);color:#d9f4ee;font:15px system-ui;letter-spacing:.04em;');
	loading.textContent = 'Raising the island…';
	const panel = css(document.createElement('div'), 'position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));width:min(300px,78vw);padding:14px;border-radius:14px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;display:none;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);');
	mount.append(canvas, joy, back, gear, jump, hint, panel, loading);
	document.body.appendChild(mount);
	return { mount, canvas, joy, knob, back, jump, gear, hint, loading, panel };
}

function slider(panel, label, min, max, step, get, set, fmt) {
	const row = css(document.createElement('label'), 'display:block;margin:6px 0 10px;');
	const top = css(document.createElement('div'), 'display:flex;justify-content:space-between;margin-bottom:4px;opacity:.9');
	const name = document.createElement('span'); name.textContent = label;
	const val = document.createElement('span');
	const input = document.createElement('input');
	input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = get();
	css(input, 'width:100%;accent-color:#01a982;');
	const show = () => { val.textContent = fmt ? fmt(+input.value) : input.value; };
	input.addEventListener('input', () => { set(+input.value); show(); });
	show();
	top.append(name, val); row.append(top, input); panel.appendChild(row);
	return { input, refresh: () => { input.value = get(); show(); } };
}

export function createIslandWorld() {
	const dom = buildDom();
	const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: !isPhone, powerPreference: 'high-performance' });
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	const maxRatio = Math.min(window.devicePixelRatio || 1, isPhone ? 2 : 1.75);
	let pixelRatio = isPhone ? Math.min(maxRatio, 1.5) : maxRatio;
	renderer.setPixelRatio(pixelRatio);
	const camera = new THREE.PerspectiveCamera(70, 1, 0.25, 16000);
	const scene = new THREE.Scene();

	const shared = {
		uTime: { value: 0 }, uWind: { value: 0.5 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uPulse: { value: 0 },
		uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uSunColor: { value: new THREE.Color(1, 0.95, 0.86) },
		uSkyZen: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color(0.3, 0.35, 0.4) },
		uWave: { value: 1 }, startHours: 10.5,
	};

	let world = null, running = false, visible = false, last = 0, time = 0, frameAvg = 16, quality = 'auto';
	let panelClock = null;
	setInterval(() => { if (panelClock && dom.panel.style.display === 'block') panelClock.refresh(); }, 1000);
	const state = { seed: null };

	function hint(text, ms = 4000) {
		dom.hint.textContent = text;
		dom.hint.style.opacity = '1';
		clearTimeout(hint.t);
		hint.t = setTimeout(() => { dom.hint.style.opacity = '0'; }, ms);
	}

	async function build(params) {
		const seed = (params.seed >>> 0) || 1337;
		if (world && state.seed === seed) return world;
		if (world) teardown();
		dom.loading.style.display = 'flex';
		await new Promise((r) => requestAnimationFrame(r));
		const island = generateIsland({ seed, biome: params.biome, resolution: isPhone ? 640 : 768 });
		shared.heightTex = makeHeightTexture(island);
		shared.maskTex = makeMaskTexture(island);
		const sky = createSky(scene, shared, renderer);
		const terrain = createTerrain(island, shared);
		const ocean = createOcean(island, shared);
		const grass = createGrass(island, shared, isPhone ? 14000 : 22000, isPhone ? 64 : 84);
		scene.add(terrain, ocean, grass);
		const vegetation = createVegetation(island, shared, scene);
		const village = createVillage(island, shared, scene);
		const distant = createDistant(island, shared, scene);
		const fauna = createFauna(island, shared, scene);
		const player = createPlayer(island, village, vegetation, camera, dom, shared);
		player.state.active = true;
		const pick = [...vegetation.pickables, ...village.pickables];
		const music = createMusic(shared, scene, camera, dom.canvas, () => pick, () => running && visible);
		music.register();
		world = { island, sky, terrain, ocean, grass, vegetation, village, distant, fauna, player, music };
		state.seed = seed;
		// warm every shader once, behind the loading card, so turning your head never stalls
		player.update(0, 0);
		sky.update(0, camera.position);
		vegetation.stream(camera, true);
		for (const o of [terrain, ocean, grass]) o.userData.update?.(camera);
		renderer.compile(scene, camera);
		dom.loading.style.display = 'none';
		buildPanel();
		return world;
	}

	function teardown() {
		if (!world) return;
		world.player.dispose();
		scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
		while (scene.children.length) scene.remove(scene.children[0]);
		world = null;
	}

	function buildPanel() {
		const p = dom.panel;
		p.replaceChildren();
		const title = css(document.createElement('div'), 'font-weight:700;letter-spacing:.06em;margin-bottom:8px;');
		title.textContent = 'SKY & WORLD';
		p.appendChild(title);
		const S = world.sky.state;
		const fmtH = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
		const t = slider(p, 'Time of day', 0, 23.99, 0.05, () => S.hours, (v) => { S.hours = v; }, fmtH);
		slider(p, 'Time speed', 0, 4, 0.1, () => S.speed, (v) => { S.speed = v; }, (v) => v === 0 ? 'paused' : v.toFixed(1) + '×');
		slider(p, 'Cloud cover', 0, 1, 0.01, () => world.sky.uniforms.uCloud.value, (v) => { world.sky.uniforms.uCloud.value = v; }, (v) => Math.round(v * 100) + '%');
		slider(p, 'Waves', 0, 2, 0.05, () => shared.uWave.value, (v) => { shared.uWave.value = v; world.ocean.userData.uniforms.uWave.value = v; }, (v) => v.toFixed(2));
		slider(p, 'Wind', 0, 1.5, 0.05, () => shared.uWind.value, (v) => { shared.uWind.value = v; }, (v) => v.toFixed(2));
		const q = css(document.createElement('div'), 'display:flex;gap:6px;margin-top:6px;');
		for (const mode of ['auto', 'high', 'low']) {
			const b = css(document.createElement('button'), 'flex:1;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (quality === mode ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
			b.textContent = mode.toUpperCase();
			b.onclick = () => { quality = mode; applyQuality(true); buildPanel(); };
			q.appendChild(b);
		}
		p.appendChild(q);
		const TM = window.L99TouchMusic175;
		if (TM) {
			const b = css(document.createElement('button'), 'margin-top:10px;width:100%;min-height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (TM.enabled ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
			b.textContent = TM.enabled ? 'PLAY SURFACES: ON' : 'PLAY SURFACES: OFF';
			b.onclick = () => { TM.set(!TM.enabled); buildPanel(); };
			p.appendChild(b);
		}
		panelClock = t;
	}

	function applyQuality(force) {
		const target = quality === 'high' ? maxRatio : quality === 'low' ? Math.min(1, maxRatio) * 0.75 : pixelRatio;
		if (quality !== 'auto' || force) pixelRatio = target;
		renderer.setPixelRatio(pixelRatio);
		renderer.shadowMap.enabled = !(quality === 'low');
		resize();
	}

	function resize() {
		const w = dom.mount.clientWidth || innerWidth, h = dom.mount.clientHeight || innerHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / Math.max(1, h);
		camera.updateProjectionMatrix();
	}
	addEventListener('resize', () => { if (visible) resize(); });

	function frame(now) {
		if (!running) return;
		requestAnimationFrame(frame);
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
		last = now;
		if (!visible || !world || document.hidden) return;
		time += dt;
		shared.uTime.value = time;
		const W = world;
		W.player.update(dt, time);
		const sk = W.sky.update(dt, camera.position);
		W.music.update(dt);
		for (const o of [W.terrain, W.ocean, W.grass]) o.userData.update(camera);
		W.vegetation.stream(camera, false);
		W.village.update(time, sk.night);
		W.distant.update(time, sk.night);
		W.fauna.update(time, sk.night, camera.position);
		renderer.render(scene, camera);
		// hold 60 fps on phones by trading resolution, smoothly
		frameAvg += (dt * 1000 - frameAvg) * 0.05;
		if (quality === 'auto' && (frame.n = (frame.n || 0) + 1) % 45 === 0) {
			if (frameAvg > 19 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.1); renderer.setPixelRatio(pixelRatio); resize(); }
			else if (frameAvg < 14.5 && pixelRatio < maxRatio) { pixelRatio = Math.min(maxRatio, pixelRatio + 0.05); renderer.setPixelRatio(pixelRatio); resize(); }
		}
	}

	function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
	function show() {
		visible = true;
		dom.mount.style.display = 'block';
		resize();
		start();
		window.L99Keyboard149?.sync?.();
	}
	function hide() {
		visible = false;
		dom.mount.style.display = 'none';
		world?.player.clearInput();
		window.L99TouchMusic175?.cancel?.();
		window.L99Keyboard149?.sync?.();
	}

	dom.back.onclick = (e) => { e.stopPropagation(); api.close(); };
	dom.jump.addEventListener('pointerdown', (e) => { e.stopPropagation(); world?.player.jump(); });
	dom.gear.onclick = (e) => { e.stopPropagation(); dom.panel.style.display = dom.panel.style.display === 'block' ? 'none' : 'block'; };
	for (const el of [dom.back, dom.jump, dom.gear, dom.panel]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());

	const api = {
		T: THREE, REALM,
		async open(params = {}) {
			show();
			await build(params);
			api.link();
			hint(isPhone ? 'Left thumb to walk, right thumb to look. Tap ☀ for the sky.' : 'WASD to walk, drag to look, Space to jump. ☀ for the sky.');
			return true;
		},
		close() {
			hide();
			window.L99IslandDoor?.closed?.();
		},
		active: () => visible && running,
		world: () => world,
		renderer: () => renderer, camera: () => camera, scene: () => scene, dom,
	};

	// Journey: space flight can land here; the island is one of the resident engines.
	// Linked once the faceplate's world core (Journey, play surfaces) is present.
	let linked = false;
	api.link = () => {
		if (world) world.music.register();
		if (linked || !window.L99Journey170) return;
		linked = true;
		window.L99Journey170.register(REALM, {
		T: THREE,
		renderer: () => renderer,
		element: () => dom.mount,
		active: () => visible,
		boot: async () => { start(); },
		prepare: async (packet, check) => {
			const planet = packet.planet || {};
			await build({ seed: (planet.seed >>> 0) || hashString(String(planet.id || 'island')), biome: planet.type || 'tropical' });
			check?.();
			for (let i = 0; i < 6; i++) { world.player.update(0.016, time); world.sky.update(0.016, camera.position); world.vegetation.stream(camera, true); renderer.render(scene, camera); await new Promise((r) => requestAnimationFrame(r)); check?.(); }
		},
		align: async (packet) => { world.player.state.pitch = Math.max(-0.4, Math.min(0.3, packet.pitch || 0)); world.player.update(0, time); },
		pose: () => ({ yaw: world?.player.state.yaw || 0, pitch: world?.player.state.pitch || 0, velocity: [0, 0, 0], fov: camera.fov }),
		render: () => renderer.render(scene, camera),
		resize,
		activate: () => show(),
		park: () => hide(),
		arrived: () => hint('You come down on a tropical shore.'),
	});
	};
	api.link();
	return api;
}

function hashString(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// one world per page
export function island() {
	if (!window.L99Island) window.L99Island = createIslandWorld();
	return window.L99Island;
}
if (typeof window !== 'undefined') {
	window.L99IslandModule = { island };
}
