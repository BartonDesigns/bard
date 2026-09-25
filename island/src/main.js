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
import { createLitter } from './world/litter.js';
import { createVillage } from './world/village.js';
import { createDistant } from './world/distant.js';
import { createPlayer } from './player.js';
import { createMusic } from './music.js';
import { createFauna } from './fauna.js';
import { createBoat } from './boat.js';
import { createWhale } from './whale.js';
import { createShells } from './shells.js';
import { createUnderwater } from './underwater.js';
import { createSealife } from './sealife.js';
import { createMagma } from './magma.js';
import { createCaverns } from './caverns.js';
import { createReef } from './reef.js';
import { buildEcology, describe } from './crysis/ecology.js';
import { createFish } from './crysis/fish.js';
import { createInverts } from './crysis/inverts.js';
import { buildLandEcology, describeLand } from './crysis/land.js';
import { createLandFauna } from './crysis/landfauna.js';
import { createBayArea, bayUniforms } from './bay/terrain.js';
import { createGoldenGate } from './bay/bridge.js';
import { createLabels } from './bay/labels.js';
import { createCity } from './bay/city.js';
import { createStreetLife } from './bay/streetlife.js';
import { createCitySound } from './bay/citysound.js';
import { createRealCity, REAL_U } from './bay/realcity.js';
import { createDiablo } from './bay/diablo.js';

// the hills by the calendar: green from the winter rains into spring, gold by summer
REAL_U.uSeason.value = [0, 0, 0, 0.05, 0.3, 0.6, 0.85, 1, 1, 1, 0.85, 0.35][new Date().getMonth()];
import { toGrid as gridTo, fromGrid as gridFrom, BLOCKS as gridBlocks } from './bay/styles.js';
import { createLandmarks } from './bay/landmarks.js';
import { createRoads } from './bay/roads.js';
import { toWorld } from './bay/geo.js';
import { createGuide } from './guide/guide.js';
import { createPeople } from './people/people.js';
import { waveHeight } from './world/ocean.js';

const REALM = 'island';

// Under water, light is absorbed red first, then green: near things keep their colour,
// far things go blue-green. The fog chunk does this per channel when the fog density is
// negative (the flag costs nothing: the density is squared). Above water it is unchanged.
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogD2 = fogDensity * fogDensity * vFogDepth * vFogDepth;
		vec3 fogFactor3 = fogDensity < 0.0 ? 1.0 - exp(-fogD2 * vec3(2.6, 1.0, 0.7)) : vec3(1.0 - exp(-fogD2));
	#else
		vec3 fogFactor3 = vec3(smoothstep(fogNear, fogFar, vFogDepth));
	#endif
	gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor3);
#endif
`;

// Muffle the whole Bard under water: a low-pass between the faceplate's master output
// and the speakers, eased in as you go under and out as you surface.
const muffle = { lp: null, ctx: null, k: 0 };
function underwaterAudio(target, dt) {
	const out = window._masterClip, ctx = out && out.context;
	if (!ctx || ctx.state !== 'running') return;
	if (!muffle.lp || muffle.ctx !== ctx) {
		try {
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.9;
			out.disconnect(ctx.destination);
			out.connect(lp); lp.connect(ctx.destination);
			muffle.lp = lp; muffle.ctx = ctx;
		} catch (e) { return; }
	}
	const k = muffle.k += (target - muffle.k) * Math.min(1, dt * 3);
	muffle.lp.frequency.setTargetAtTime(20000 * Math.pow(420 / 20000, k), ctx.currentTime, 0.05);
	muffle.lp.Q.setTargetAtTime(0.9 + k * 2.5, ctx.currentTime, 0.05);
}
const isPhone = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function css(el, s) { el.style.cssText = s; return el; }
function button(label, title, style) {
	const b = document.createElement('button');
	b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
	// hand focus back after a click, so Space and the play keys keep driving the game
	b.addEventListener('click', () => b.blur());
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
	const fly = button('✈', 'Fly (F)', 'right:calc(12px + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));width:44px;font-size:18px;');
	const down = button('⇣', 'Descend', 'right:calc(18px + env(safe-area-inset-right));bottom:calc(98px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;font-size:22px;display:none;');
	const shell = button('🐚', 'Pick up the shell (E)', 'left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));display:none;');
	const toss = button('Throw', 'Throw it (T)', 'left:calc(50% - 96px);bottom:calc(84px + env(safe-area-inset-bottom));display:none;');
	const place = button('Put down', 'Put it down (E)', 'left:calc(50% + 12px);bottom:calc(84px + env(safe-area-inset-bottom));display:none;');
	const act = button('', '', 'right:calc(90px + env(safe-area-inset-right));bottom:calc(36px + env(safe-area-inset-bottom));display:none;');
	const launch = button('⇪ To the ship', 'Take off and return to your ship', 'left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top));display:none;');
	const veil = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 30%,rgba(40,140,150,.10),rgba(2,30,40,.55));');
	const hint = css(document.createElement('div'), 'position:absolute;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:rgba(8,20,26,.5);color:#eafaf6;font:13px system-ui;pointer-events:none;transition:opacity .6s;text-align:center;max-width:80vw;');
	const loading = css(document.createElement('div'), 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#10333a,#050b10);color:#d9f4ee;font:15px system-ui;letter-spacing:.04em;');
	loading.textContent = 'Raising the island…';
	const panel = css(document.createElement('div'), 'position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(116px + env(safe-area-inset-top));width:min(300px,78vw);padding:14px;border-radius:14px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;display:none;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);');
	mount.append(canvas, veil, joy, back, gear, fly, jump, down, act, shell, toss, place, launch, hint, panel, loading);
	document.body.appendChild(mount);
	return { mount, canvas, joy, knob, back, jump, gear, fly, down, act, shell, toss, place, launch, veil, hint, loading, panel };
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
	// MSAA on phones too: Apple's tile GPUs resolve it almost for free, and it is what
	// lets leaves and grass edges fade (alpha to coverage) instead of stair-stepping
	const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance' });
	// AgX: a film-like curve that rolls highlights off gently and keeps greens from going
	// neon; ACES crushed the shade and pushed saturation, which read as harsh
	renderer.toneMapping = THREE.AgXToneMapping;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	const maxRatio = Math.min(window.devicePixelRatio || 1, isPhone ? 2 : 1.75);
	let pixelRatio = isPhone ? Math.min(maxRatio, 1.5) : maxRatio;
	renderer.setPixelRatio(pixelRatio);
	const camera = new THREE.PerspectiveCamera(70, 1, 0.25, 16000);
	const scene = new THREE.Scene();

	const shared = {
		uTime: { value: 0 }, uWind: { value: 0.5 }, uGust: { value: 0 }, uWindT: { value: 0 }, uWindDir: { value: new THREE.Vector2(0.93, 0.35) }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uPulse: { value: 0 },
		uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uSunColor: { value: new THREE.Color(1, 0.95, 0.86) },
		uSkyZen: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color(0.3, 0.35, 0.4) },
		uWave: { value: 1 }, uUnder: { value: 0 }, startHours: 10.5,
	};
	// ground occupancy around the player (filled by vegetation, read by terrain and grass)
	// r: bare, shaded earth (trees, palms, rocks); g: a soil mound that grass hugs (every plant)
	shared.occ = new THREE.DataTexture(new Uint8Array(256 * 256 * 2), 256, 256, THREE.RGFormat, THREE.UnsignedByteType);
	shared.occ.magFilter = shared.occ.minFilter = THREE.LinearFilter;
	shared.occ.needsUpdate = true;
	shared.uOcc = { value: shared.occ };
	shared.uOccO = { value: new THREE.Vector3(0, 0, 160) };
	// footprints: a 64 m patch of soft ground round the player that each step presses into
	const PR = 512, PSPAN = 32, prints = new Uint8Array(PR * PR);
	shared.prints = new THREE.DataTexture(prints, PR, PR, THREE.RedFormat, THREE.UnsignedByteType);
	shared.prints.magFilter = shared.prints.minFilter = THREE.LinearFilter;
	shared.prints.needsUpdate = true;
	shared.uPrints = { value: shared.prints };
	shared.uPrintsO = { value: new THREE.Vector3(-1e5, -1e5, PSPAN) };
	const step = { dist: 0, side: 1, x: 0, z: 0, init: false, stamps: 0, calls: 0, why: '' };
	shared.printStep = step;
	function stampPrints(P) {
		const O = shared.uPrintsO.value, px = PR / PSPAN;
		step.calls++;
		if (!step.init || Math.abs(P.pos.x - (O.x + PSPAN / 2)) > 8 || Math.abs(P.pos.z - (O.y + PSPAN / 2)) > 8) {
			// recentre on the player, carrying the prints already made across
			const nx = Math.round((P.pos.x - PSPAN / 2) / (PSPAN / PR)) * (PSPAN / PR), nz = Math.round((P.pos.z - PSPAN / 2) / (PSPAN / PR)) * (PSPAN / PR);
			const di = Math.round((nx - O.x) * px), dj = Math.round((nz - O.y) * px), old = prints.slice();
			prints.fill(0);
			if (step.init) for (let j = 0; j < PR; j++) for (let i = 0; i < PR; i++) {
				const si = i + di, sj = j + dj;
				if (si >= 0 && sj >= 0 && si < PR && sj < PR) prints[j * PR + i] = old[sj * PR + si];
			}
			O.set(nx, nz, PSPAN); step.init = true; step.x = P.pos.x; step.z = P.pos.z;
			shared.prints.needsUpdate = true;
		}
		const d = Math.min(1.5, Math.hypot(P.pos.x - step.x, P.pos.z - step.z));
		step.x = P.pos.x; step.z = P.pos.z;
		if (!P.grounded || P.swimming || P.locked) { step.why = 'air'; return; }
		step.dist += d;
		if (step.dist < 0.72) return;
		step.dist = 0; step.side = -step.side; step.stamps++;
		const hx = -Math.sin(P.yaw), hz = -Math.cos(P.yaw), sx = -hz * step.side * 0.14, sz = hx * step.side * 0.14;
		const cx = (P.pos.x + sx - O.x) * px, cz = (P.pos.z + sz - O.y) * px;
		// an oval heel-to-toe along the heading
		for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
			const x = Math.round(cx + i), z = Math.round(cz + j);
			if (x < 0 || z < 0 || x >= PR || z >= PR) continue;
			const wx = i / px, wz = j / px, a = wx * hx + wz * hz, b = wx * -hz + wz * hx;
			const e = (a / 0.15) * (a / 0.15) + (b / 0.065) * (b / 0.065);
			if (e >= 1) continue;
			const v = Math.round(255 * Math.pow(1 - e, 0.6)), k = z * PR + x;
			if (v > prints[k]) prints[k] = v;
		}
		shared.prints.needsUpdate = true;
	}

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
	// the Guide: talk, ask, be taken places (a model on this device, or the built-in guide)
	const guide = createGuide(dom.mount, { world: () => world, camera, shared, hint });
	// people: real bodies about the village and the city streets
	const people = createPeople(scene, () => world);

	async function build(params) {
		const seed = (params.seed >>> 0) || 1337;
		// Earth: the island in the Gulf of the Farallones with the real Bay Area round it.
		// Other worlds flight lands on are their own islands, alone in their seas.
		const earth = params.earth !== false;
		if (world && state.seed === seed && state.earth === earth) return world;
		if (world) teardown();
		dom.loading.style.display = 'flex';
		await new Promise((r) => requestAnimationFrame(r));
		const island = generateIsland({ seed, biome: params.biome, resolution: isPhone ? 640 : 768 });
		shared.heightTex = makeHeightTexture(island);
		shared.maskTex = makeMaskTexture(island);
		const sky = createSky(scene, shared, renderer);
		const terrain = createTerrain(island, shared);
		// the real Bay Area round the island: its heights are shared with the sea
		shared.bayU = bayUniforms();
		const ocean = createOcean(island, shared);
		// turf underfoot plus a longer-reaching layer
		const grass = createGrass(island, shared, isPhone ? 10500 : 18000, isPhone ? 64 : 84, { width: 0.5, seed: 99 });
		const turf = createGrass(island, shared, isPhone ? 11000 : 18000, 20, { width: 0.34, height: 0.8, seed: 7 });
		scene.add(terrain, ocean, grass, turf);
		const litter = createLitter(island, shared, scene, isPhone ? 0.6 : 1);
		// Crysis: the land's plants and animals, grown from the seed
		const land = buildLandEcology(island.seed);
		const vegetation = createVegetation(island, shared, scene, land);
		const village = createVillage(island, shared, scene);
		vegetation.addContacts(village.footprints);
		const distant = createDistant(island, shared, scene);
		const fauna = createFauna(island, shared, scene);
		const landFauna = createLandFauna(land, island, shared, scene, camera, vegetation);
		const player = createPlayer(island, village, vegetation, camera, dom, shared);
		player.state.active = true;
		const boat = createBoat(island, village, player, camera, shared, scene);
		const whale = createWhale(island, shared, scene);
		const shells = createShells(island, shared, camera, scene, player, dom, hint);
		const magma = createMagma(island, shared, scene, camera);
		const caverns = createCaverns(island, shared, scene, camera, magma.tube);
		const underwater = createUnderwater(island, shared, scene, camera, player, [...magma.tube, ...caverns.tunnels.flat(), ...caverns.arches.flat()]);
		// Crysis: the sea's food web and species, grown from the seed
		const eco = buildEcology(island.seed, { volcanism: 0.8 });
		const reef = createReef(island, shared, scene, [...magma.tube, ...caverns.tunnels.flat(), ...caverns.arches.flat()], eco);
		const sealife = createSealife(island, shared, scene, camera, reef.bommies);
		const fish = createFish(eco, island, shared, scene, camera, reef.bommies);
		const inverts = createInverts(eco, island, shared, scene, camera, reef.bommies);
		const pick = [...vegetation.pickables, ...village.pickables];
		const music = createMusic(shared, scene, camera, dom.canvas, () => pick, () => running && visible);
		music.register();
		world = { island, sky, terrain, ocean, grass, turf, litter, vegetation, village, distant, fauna, player, music, boat, whale, shells, underwater, sealife, magma, caverns, reef, eco, fish, inverts, land, landFauna, bayArea: null, bridge: null, labels: null };
		state.seed = seed;
		state.earth = earth;
		// warm every shader once, behind the loading card, so turning your head never stalls
		player.update(0, 0);
		sky.update(0, camera.position);
		vegetation.stream(camera, true);
		for (const o of [terrain, ocean, grass, turf]) o.userData.update?.(camera);
		litter.update(camera);
		renderer.compile(scene, camera);
		// the Bay Area streams in behind the island (on Earth); once its heights are here, one height
		// for everything: the island's own map on the island, the real land beyond it
		if (earth) {
			const bayArea = createBayArea(shared, scene, island, shared.bayU);
			world.bayArea = bayArea;
			world.labels = createLabels(dom.mount, bayArea, null);
			world.real = createRealCity(renderer);
			world.city = createCity(shared, scene, bayArea, world.real);
			world.street = createStreetLife(shared, scene, bayArea, (x, z) => island.heightAt(x, z), world.real);
			world.citySound = createCitySound(bayArea, (x, z) => island.heightAt(x, z));
			const own = island.heightAt;
			island.heightAt = (x, z) => (Math.max(Math.abs(x), Math.abs(z)) < island.half - 20 || !bayArea.loaded()) ? own(x, z) : bayArea.heightAt(x, z);
			bayArea.ready.then(() => {
				if (world !== w0) return;
				const bridge = createGoldenGate(shared, scene, bayArea.heightAt);
				world.bridge = bridge;
				world.landmarks = createLandmarks(scene, bayArea);
				world.roads = createRoads(shared, scene, bayArea);
				world.diablo = createDiablo(scene, bayArea);
				world.labels = createLabels(dom.mount, bayArea, bridge);
				// walk and drive across the deck; climb about Mt Diablo's rocks, not through them
				const diablo = world.diablo;
				island.extraFloor = (x, z, y) => Math.max(bridge.deckFloor(x, z, y), diablo.floor(x, z, y));
				island.extraPush = (p, footY) => diablo.push(p, footY);
				renderer.compile(scene, camera);
			});
			const w0 = world;
		}
		dom.loading.style.display = 'none';
		buildPanel();
		return world;
	}

	function teardown() {
		if (!world) return;
		world.player.dispose();
		world.shells?.dispose();
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
		slider(p, 'Season', 0, 1, 0.01, () => REAL_U.uSeason.value, (v) => { REAL_U.uSeason.value = v; }, (v) => v < 0.2 ? 'spring green' : v < 0.55 ? 'late spring' : v < 0.85 ? 'early summer' : 'summer gold');
		const q = css(document.createElement('div'), 'display:flex;gap:6px;margin-top:6px;');
		for (const mode of ['auto', 'high', 'low']) {
			const b = css(document.createElement('button'), 'flex:1;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (quality === mode ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
			b.textContent = mode.toUpperCase();
			b.onclick = () => { quality = mode; applyQuality(true); buildPanel(); };
			q.appendChild(b);
		}
		p.appendChild(q);
		// the map data's credit (OpenStreetMap's licence asks for it where the data is shown)
		const credit = css(document.createElement('div'), 'margin-top:8px;font:11px system-ui;opacity:.6;line-height:1.35;');
		credit.textContent = 'Terrain: USGS 3DEP, NOAA via AWS Terrain Tiles. Streets and buildings: Overture Maps Foundation, © OpenStreetMap contributors (ODbL), Microsoft and Google footprints.';
		p.appendChild(credit);
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
		stepWind(dt, shared);
		const W = world;
		W.player.update(dt, time);
		stampPrints(W.player.state);
		W.boat.update(dt, time);
		const sk = W.sky.update(dt, camera.position);
		W.music.update(dt);
		W.whale.update(dt, time, shared.uBass.value, camera.position);
		// below the surface: the sea closes in, blue-green and dim
		const surf = waveHeight(W.island, camera.position.x, camera.position.z, time, shared.uWave.value);
		const under = camera.position.y < surf - 0.05;
		// seen from below the sea is a ceiling: it must not hide what glows beneath it
		W.ocean.material.depthWrite = !under;
		// ...and it is drawn before everything under it, so glows and embers show through
		W.ocean.renderOrder = under ? -5 : 1;
		W.underwater.update(dt, time, under, surf);
		W.magma.update(dt, time, under, surf);
		W.caverns.update(dt, time, under);
		// the reef and its fish only run when you are in or over the bay
		const bay = W.island.village.bay;
		const inBay = !!bay && Math.hypot(camera.position.x - bay.x, camera.position.z - bay.z) < bay.r * 1.6 && camera.position.y < 40;
		W.sealife.update(dt, time, inBay);
		W.reef.update(inBay, camera.position);
		W.fish.update(dt, time, inBay);
		W.inverts.update(dt, time, inBay);
		shared.uUnder.value = under ? 1 : 0;
		if (under) {
			const depthK = Math.min(1, Math.max(0, (surf - camera.position.y) / 14));
			// daylight fades fast with depth: down in the crater the lava is the light
			const dim = 1 - depthK * 0.82;
			W.sky.hemi.intensity *= dim; W.sky.sun.intensity *= dim * dim;
			shared.uAmbient.value.multiplyScalar(dim);
			scene.fog.color.setRGB(0.03 - depthK * 0.025, 0.2 - depthK * 0.15, 0.25 - depthK * 0.16).multiplyScalar(0.25 + 0.75 * sk.dayK);
			scene.fog.density = -(0.035 + depthK * 0.02);   // negative: per-channel absorption
		} else {
			// out in the Bay Area the air opens up: tens of kilometres of view, layered haze
			const dI = Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z));
			const openK = W.bayArea?.loaded() ? THREE.MathUtils.smoothstep(dI, 2500, 9000) : 0;
			scene.fog.density = THREE.MathUtils.lerp(0.00026, 0.000024 + Math.max(0, 0.00001 * (1 - camera.position.y / 600)), openK);
			const far = THREE.MathUtils.lerp(16000, 110000, openK), nearP = openK > 0.5 ? THREE.MathUtils.clamp((camera.position.y - Math.max(0, W.island.heightAt(camera.position.x, camera.position.z))) * 0.01, 0.25, 2) : 0.25;
			if (Math.abs(camera.far - far) > far * 0.02 || Math.abs(camera.near - nearP) > 0.05) { camera.far = far; camera.near = nearP; camera.updateProjectionMatrix(); }
		}
		// the cities' glow washes out the faint stars
		if (W.bayArea?.loaded()) {
			let glow = 0;
			for (const [dx, dz] of [[0, 0], [6000, 0], [-6000, 0], [0, 6000], [0, -6000], [15000, 0], [-15000, 0], [0, 15000], [0, -15000]]) glow += W.bayArea.urbanAt(camera.position.x + dx, camera.position.z + dz).u;
			shared.uSkyGlow.value += (Math.min(1, glow / 4) - shared.uSkyGlow.value) * Math.min(1, dt);
		}
		if (under !== frame.under) { frame.under = under; dom.veil.style.opacity = under ? '1' : '0'; }
		if (under || muffle.k > 0.01) underwaterAudio(under ? Math.min(1, 0.75 + (surf - camera.position.y) * 0.03) : 0, dt);
		const sh = W.shells.update(dt, time);
		const show = (el, on) => { const d = on ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d; };
		show(dom.shell, sh === 'near' && !W.boat.boarded()); show(dom.toss, sh === 'held'); show(dom.place, sh === 'held');
		actions();
		for (const o of [W.terrain, W.ocean, W.grass, W.turf]) o.userData.update(camera);
		W.litter.update(camera);
		W.vegetation.stream(camera, false);
		W.village.update(time, sk.night);
		W.distant.update(time, sk.night);
		W.fauna.update(time, sk.night, camera.position);
		W.landFauna.update(dt, time, sk.night, camera.position, camera.position.y > -0.5);
		W.bayArea?.update(camera, sk.night);
		W.bridge?.update(time, sk.night);
		W.real?.update(camera);
		W.diablo?.update(dt, time, camera, sk.night);
		W.city?.update(camera, sk.night);
		W.street?.update(dt, time, camera, sk.night);
		W.roads?.update(time, sk.night);
		guide.update(dt);
		people.update(dt, time, camera.position, sk.night, camera.position.y > -0.5);
		people.demo(dt, time, camera.position);
		W.citySound?.update(dt, camera, { night: sk.night, cars: W.street?.cars, people: people.pool, steps: people.steps, player: W.player.state, under, islandHalf: W.island.half });
		W.labels?.update(dt, time, camera.position, Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z)) < W.island.half);
		renderer.render(scene, camera);
		// hold 60 fps on phones by trading resolution, smoothly
		frameAvg += (dt * 1000 - frameAvg) * 0.05;
		if (quality === 'auto' && (frame.n = (frame.n || 0) + 1) % 45 === 0) {
			if (frameAvg > 19 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.1); renderer.setPixelRatio(pixelRatio); resize(); }
			else if (frameAvg < 14.5 && pixelRatio < maxRatio) { pixelRatio = Math.min(maxRatio, pixelRatio + 0.05); renderer.setPixelRatio(pixelRatio); resize(); }
		}
	}

	// the context button: board or leave the boat; the jump button dives in the sea
	let actState = '';
	function actions() {
		const W = world, B = W.boat, P = W.player.state;
		const want = B.boarded() ? 'leave' : B.near() ? 'board' : '';
		if (want !== actState) {
			actState = want;
			dom.act.style.display = want ? 'block' : 'none';
			dom.act.textContent = want === 'board' ? '⛵ Board' : '⛵ Leave boat';
			dom.act.title = want === 'board' ? 'Take the boat out' : 'Step off the boat';
			dom.act.setAttribute('aria-label', dom.act.title);
			if (want === 'board') hint(isPhone ? 'Board the boat: left thumb is the throttle and rudder.' : 'Board the boat: W/S throttle, A/D steer.', 3000);
		}
		const j = B.boarded() ? '' : P.flying ? '⇡' : P.swimming ? (P.diving ? '⇡' : '⤓') : '⤒';
		if (dom.jump.textContent !== j) {
			dom.jump.textContent = j;
			dom.jump.style.display = j ? 'block' : 'none';
			const t = P.flying ? 'Climb' : P.diving ? 'Swim up' : P.swimming ? 'Dive' : 'Jump';
			dom.jump.title = t; dom.jump.setAttribute('aria-label', t);
		}
		const dd = P.flying ? 'block' : 'none';
		if (dom.down.style.display !== dd) dom.down.style.display = dd;
		const fb = P.flying ? '#01a982' : 'rgba(8,20,26,.55)';
		if (dom.fly.style.background !== fb) dom.fly.style.background = fb;
		const L = origin && !window.L99Journey170?.busy?.() ? 'block' : 'none';
		if (dom.launch.style.display !== L) dom.launch.style.display = L;
	}
	let origin = null;   // the planet flight landed us from, if any
	// Earth, where it sits in the Sol system: flight puts the ship in orbit round it
	const EARTH_ORIGIN = { id: 'earth', seed: 1337, type: 'TERRAN', name: 'Earth', earth: true, colorA: [0.2, 0.45, 0.85], colorB: [0.25, 0.65, 0.4] };

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
		if (muffle.lp) { muffle.k = 0; muffle.lp.frequency.value = 20000; muffle.lp.Q.value = 0.9; }
		dom.mount.style.display = 'none';
		world?.player.clearInput();
		window.L99TouchMusic175?.cancel?.();
		window.L99Keyboard149?.sync?.();
	}

	dom.back.onclick = (e) => { e.stopPropagation(); api.close(); };
	function toggleFly() {
		const P = world?.player.state;
		if (!P || world.boat.boarded()) return;
		P.flying = !P.flying; P.vel.y = 0;
		hint(P.flying ? (isPhone ? 'Flying: steer with the left thumb, look with the right. ⇡ ⇣ to climb and sink.' : 'Flying: WASD moves where you look, Space climbs, C sinks, Shift is fast. F to land.') : 'Landing.', 3500);
	}
	dom.fly.addEventListener('click', (e) => { e.stopPropagation(); toggleFly(); });
	dom.shell.addEventListener('click', (e) => { e.stopPropagation(); world?.shells.pick(); });
	dom.toss.addEventListener('click', (e) => { e.stopPropagation(); world?.shells.throwIt(); });
	dom.place.addEventListener('click', (e) => { e.stopPropagation(); world?.shells.putDown(); });
	const hold = (el, key) => {
		el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (world?.player.state.flying) world.player.state[key] = true; });
		for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { if (world) world.player.state[key] = false; });
	};
	hold(dom.jump, 'flyUp'); hold(dom.down, 'flyDown');
	dom.jump.addEventListener('pointerdown', (e) => {
		e.stopPropagation();
		const P = world?.player.state;
		if (P?.flying) return;
		if (P?.diving) { P.vel.y = 2.4; P.diving = P.pos.y < (P.surface ?? 0) - 0.4; return; }
		world?.player.jump();
	});
	dom.act.addEventListener('click', (e) => {
		e.stopPropagation();
		const B = world?.boat;
		if (!B) return;
		if (B.boarded()) B.leave(); else if (B.near()) B.board();
	});
	// back to the ship: the island hands the view to space flight above the same planet
	dom.launch.addEventListener('click', async (e) => {
		e.stopPropagation();
		const J = window.L99Journey170;
		if (!origin || !J || J.busy()) return;
		if (world?.boat.boarded()) world.boat.leave();
		dom.launch.disabled = true;
		try {
			const ok = await J.request(REALM, 'flight', { kind: 'atmosphere', planet: origin, altitude: 420, piloting: true, yaw: world.player.state.yaw, pitch: 0.25, velocity: [0, 0, 0], fov: 72 });
			if (!ok) hint('The ship is not ready yet. Try again in a moment.');
		} finally { dom.launch.disabled = false; }
	});
	dom.gear.onclick = (e) => { e.stopPropagation(); dom.panel.style.display = dom.panel.style.display === 'block' ? 'none' : 'block'; };
	for (const el of [dom.back, dom.jump, dom.gear, dom.panel, dom.act, dom.launch, dom.fly, dom.down, dom.shell, dom.toss, dom.place]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());

	const api = {
		T: THREE, REALM,
		async open(params = {}) {
			// on Earth the ship waits in orbit: ⇪ always has somewhere to go
			origin = params.origin || (params.earth !== false ? EARTH_ORIGIN : null);
			show();
			await build(params);
			api.link();
			hint(isPhone ? 'Left thumb to walk, right thumb to look. ✈ to fly, ☀ for the sky.' : 'WASD to walk, drag to look, Space to jump, F to fly. ☀ for the sky.');
			return true;
		},
		close() {
			hide();
			window.L99IslandDoor?.closed?.();
		},
		active: () => visible && running,
		world: () => world,
		guide, people,
		renderer: () => renderer, camera: () => camera, scene: () => scene, dom, shared,
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
			origin = planet.origin || null;
			if (planet.earth) origin = EARTH_ORIGIN;
			await build({ seed: (planet.seed >>> 0) || hashString(String(planet.id || 'island')), biome: planet.type || 'tropical', earth: planet.earth === true });
			check?.();
			for (let i = 0; i < 6; i++) { world.player.update(0.016, time); world.sky.update(0.016, camera.position); world.vegetation.stream(camera, true); renderer.render(scene, camera); await new Promise((r) => requestAnimationFrame(r)); check?.(); }
		},
		align: async (packet) => { world.player.state.pitch = Math.max(-0.4, Math.min(0.3, packet.pitch || 0)); world.player.update(0, time); },
		pose: () => ({ yaw: world?.player.state.yaw || 0, pitch: world?.player.state.pitch || 0, velocity: [0, 0, 0], fov: camera.fov }),
		render: () => renderer.render(scene, camera),
		resize,
		activate: () => show(),
		park: () => hide(),
		arrived: () => hint(state.earth ? 'Earth. An island off the Golden Gate: fly or sail east to reach San Francisco.' + (origin ? ' ⇪ returns you to your ship.' : '') : origin ? 'You come down on a tropical shore. ⇪ returns you to your ship.' : 'You come down on a tropical shore.', 6000),
	});
	};
	api.link();
	return api;
}

// Wind that behaves like wind: gusts come at random, each with its own strength, rise,
// hold and fall; between them the air eddies on a few slow incommensurate beats. The
// Wind slider sets how often gusts come and how hard: at nothing the grass barely
// stirs and gusts are rare; turned up, they come harder and more often. The field's
// clock (uWindT) runs at the wind's speed, so a lull slows everything, a gust hurries
// it, and the direction veers slowly.
const wind = { gusts: [], next: 3, veer: 0.36, t: 0 };
function stepWind(dt, shared) {
	dt = Math.min(dt, 0.1);
	const W = shared.uWind.value;
	wind.t += dt;
	wind.next -= dt;
	if (wind.next <= 0) {
		// mean wait between gusts: ~25 s when calm, ~2.5 s at full wind
		const rate = 0.02 + Math.pow(Math.min(1.5, W), 1.4) * 0.35;
		wind.next = -Math.log(1 - Math.random()) / rate;
		const k = Math.random();
		wind.gusts.push({ age: 0, peak: (0.25 + k * k * 0.75) * (0.15 + W * 0.9), rise: 0.6 + Math.random() * 1.6, hold: 0.5 + Math.random() * 3.5, fall: 1.5 + Math.random() * 4 });
	}
	let g = 0;
	for (let i = wind.gusts.length - 1; i >= 0; i--) {
		const q = wind.gusts[i];
		q.age += dt;
		const a = q.age;
		const env = a < q.rise ? Math.sin(a / q.rise * Math.PI / 2) : a < q.rise + q.hold ? 1 - 0.15 * Math.sin((a - q.rise) * 3.1) : Math.max(0, 1 - (a - q.rise - q.hold) / q.fall);
		if (a > q.rise + q.hold + q.fall) { wind.gusts.splice(i, 1); continue; }
		g = Math.max(g, q.peak * env);
	}
	// eddies between gusts, a little livelier as the wind rises
	const t = wind.t, eddy = (Math.sin(t * 0.31) * Math.sin(t * 0.137 + 1.7) + Math.sin(t * 0.53 + 0.4) * 0.5) * 0.5 + 0.5;
	g += eddy * W * 0.12;
	shared.uGust.value += (g - shared.uGust.value) * Math.min(1, dt * 3);
	// the field moves at the wind's own speed
	shared.uWindT.value += dt * (0.15 + W * 0.7 + shared.uGust.value * 1.2);
	wind.veer += (Math.sin(t * 0.021) * 0.25 + Math.sin(t * 0.0057 + 2) * 0.3 - (wind.veer - 0.36)) * dt * 0.02;
	shared.uWindDir.value.set(Math.cos(wind.veer), Math.sin(wind.veer));
}

function hashString(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// one world per page
export function island() {
	if (!window.L99Island) window.L99Island = createIslandWorld();
	return window.L99Island;
}
if (typeof window !== 'undefined') {
	window.L99IslandModule = { island };
	// Crysis: the engine's name. L99Island stays the faceplate contract; this is the
	// handle for the generated world (Crysis.ecology() prints this place's food web)
	window.Crysis = {
		version: 1,
		world: () => window.L99Island?.world?.(),
		// your home on Earth: stored only in this browser, never published
		guide: () => window.L99Island?.guide,
		people: () => window.L99Island?.people,
		grid: { toGrid: gridTo, fromGrid: gridFrom, BLOCKS: gridBlocks },
		// the hills' season: 0 spring green .. 1 summer gold
		season: (v) => { if (v !== undefined) REAL_U.uSeason.value = Math.max(0, Math.min(1, +v)); return REAL_U.uSeason.value; },
		setHome: (lat, lon, name = 'Home') => { localStorage.setItem('crysis-home', JSON.stringify({ lat: +lat, lon: +lon, name })); return 'Home set. Crysis.goHome() takes you there.'; },
		clearHome: () => { localStorage.removeItem('crysis-home'); return 'Home cleared.'; },
		goHome: () => {
			let h = null; try { h = JSON.parse(localStorage.getItem('crysis-home') || 'null'); } catch (e) { /* no home stored */ }
			const w = window.L99Island?.world?.();
			if (!h || !w?.bayArea?.loaded()) return h ? 'The Bay Area is still loading.' : 'Set it first: Crysis.setHome(lat, lon)';
			const p = toWorld(h.lat, h.lon), P = w.player.state;
			P.flying = true; P.diving = false; P.pos.set(p.x - 40, w.island.heightAt(p.x, p.z) + 60, p.z + 40); P.yaw = Math.atan2(-40, 40); P.pitch = -0.5;
			return 'Home.';
		},
		ecology: () => { const w = window.L99Island?.world?.(); return w?.eco ? describeLand(w.land) + '\n\n' + describe(w.eco) : 'no world open'; },
	};
}
