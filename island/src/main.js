// Island engine, stage 1. Loaded by the Bard faceplate on demand; runs as a
// third world beside the caves and space flight, sharing the faceplate's
// music, keyboard, play surfaces and Journey transfers.

import { createBiomes } from './planet/biomes.js';
import { scrollable } from './ui/scroll.js';
import { planetProfile } from './planet/profile.js';
import * as THREE from 'three';
import { generateIsland } from './world/islandgen.js';
import { createTerrain, makeHeightTexture, makeMaskTexture } from './world/terrain.js';
import { createOcean } from './world/ocean.js';
import { createSky } from './world/sky.js';
import { createWeather } from './world/weather.js';
import { createSunRays } from './world/sunrays.js';
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
import { createUnderworld } from './planet/underworld.js';
import { planCaves, makeField } from './planet/cavenet.js';
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
import { createHouses } from './bay/houses.js';
import { createStreetLife } from './bay/streetlife.js';
import { bindCarSky } from './bay/cars.js';
import { createFreeways } from './bay/freeways.js';
import { createLake } from './bay/lake.js';
import { createEarthWater } from './bay/earthwater.js';
import { createWater } from './bay/water.js';
import { planWaters } from './planet/waters.js';
import { createTidepools } from './bay/tidepools.js';
import { createBeaches } from './bay/beaches.js';
import { createParkKit } from './bay/parkkit.js';
import { createDiscovery } from './bay/discovery.js';
import { createBoardwalk } from './bay/boardwalk.js';
import { createTowers } from './bay/towers.js';
import { createForestFloor } from './bay/forestfloor.js';
import { createCommercial } from './bay/commercial.js';
import { createInteriors } from './interiors/index.js';
import { createCottageInteriors } from './interiors/cottage.js';
import { planDwellings, createDwellings } from './interiors/alien.js';
import { createWildlife } from './bay/wildlife.js';
import { createFishing } from './fishing.js';
import { createArcade } from './arcade.js';
import { planIslandFields, createSportsFields } from './sportsfields.js';
import { createBerms } from './bay/berms.js';
import { createCitySound } from './bay/citysound.js';
import { createNatureSound } from './bay/naturesound.js';
import { worldLevel } from './world/soundbus.js';
import { createRealCity, REAL_U } from './bay/realcity.js';
import { createCivilization } from './crysis/civ.js';
import { createDiablo } from './bay/diablo.js';
import { createEdgelands } from './bay/edgelands.js';
import { createDrive } from './drive.js';
import { createVehicles } from './vehicles/index.js';
import { createAutoMusic } from './music/automusic.js';
import { today, onMonth, monthPicked, pickMonth } from './calendar.js';
import { createTattooStudio } from './tattoo/studio.js';

// the hills by the calendar: green from the winter rains into spring, gold by summer
// (the naturalist's curve: inland gold by late May; the foggy coast lags into July)
// (and the month picked in the Sky & World panel, when one is)
function applySeason(d) {
	const m = d.getMonth();
	REAL_U.uSeason.value = [0, 0, 0, 0.1, 0.45, 0.8, 1, 1, 1, 1, 0.8, 0.4][m];
	REAL_U.uSeasonLag.value = [0, 0, 0, 0, 0.2, 0.25, 0.2, 0.05, 0, 0, 0, 0][m];
	// the wildflower peak: late March and April
	REAL_U.uBloom.value = [0, 0.3, 0.8, 1, 0.45, 0, 0, 0, 0, 0, 0, 0][m];
	// dead leaves in the gutters
	REAL_U.uLeafFall.value = [0.5, 0.2, 0, 0, 0, 0, 0, 0.05, 0.2, 0.6, 1, 0.8][m];
}
applySeason(today());
onMonth(applySeason);
import { toGrid as gridTo, fromGrid as gridFrom, BLOCKS as gridBlocks } from './bay/styles.js';
import { createLandmarks } from './bay/landmarks.js';
import { createRoads, ROUTES } from './bay/roads.js';
import { toWorld } from './bay/geo.js';
import { createDirector } from './earth/director.js';
// the rest of the Earth, one engine with the Bay (earth/globe.js); its frame's latitude and longitude
import { createGlobe, BAY_WILD_KM } from './earth/globe.js';
import { toLL as globeLL, bayKm, F as globeF } from './earth/globeframe.js';
import { createGuide } from './guide/guide.js';
import { storagePanel } from './storage.js';
import { createSurprises } from './surprises.js';
import { createPeople } from './people/people.js';
import { createGhost } from './people/ghost.js';
import { createRagdolls } from './people/ragdoll.js';
import { createImpacts } from './vehicles/impact.js';
import { createCarjack } from './vehicles/carjack.js';
import { createAvatar } from './people/avatar.js';
import { createSelf } from './people/self.js';
import * as CREATURES from './world/creatures.js';
import { waveHeight } from './world/ocean.js';
import { createMushrooms } from './planet/mushrooms.js';
import { createVolcano } from './planet/volcano.js';
import { planAlien, createAlien } from './planet/alien.js';
import { planRealm, planDungeons } from './planet/medieval/plan.js';
import { createMedieval } from './planet/medieval/realm.js';
import { createShare } from './share.js';
import { createWorldAudio } from './audio/audio.js';

const REALM = 'island';
// where the sky's glow is sampled: the cities round you wash out the faint stars
const GLOW_AT = [[0, 0], [6000, 0], [-6000, 0], [0, 6000], [0, -6000], [15000, 0], [-15000, 0], [0, 15000], [0, -15000]];

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
		} catch { return; }
	}
	const k = muffle.k += (target - muffle.k) * Math.min(1, dt * 3);
	muffle.lp.frequency.setTargetAtTime(20000 * Math.pow(420 / 20000, k), ctx.currentTime, 0.05);
	muffle.lp.Q.setTargetAtTime(0.9 + k * 2.5, ctx.currentTime, 0.05);
}
// things made inside the engine that the Crysis console handle reaches
const HOOKS = {};
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
	const boost = button('×3', 'Fly three times faster (B)', 'right:calc(12px + env(safe-area-inset-right));top:calc(272px + env(safe-area-inset-top));width:44px;font-size:13px;display:none;');
	const down = button('⇣', 'Descend', 'right:calc(18px + env(safe-area-inset-right));bottom:calc(98px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;font-size:22px;display:none;');
	const shell = button('🐚', 'Pick up the shell (E)', 'left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));display:none;');
	const toss = button('Throw', 'Throw it (T)', 'left:calc(50% - 96px);bottom:calc(84px + env(safe-area-inset-bottom));display:none;');
	const place = button('Put down', 'Put it down (E)', 'left:calc(50% + 12px);bottom:calc(84px + env(safe-area-inset-bottom));display:none;');
	const act = button('', '', 'right:calc(90px + env(safe-area-inset-right));bottom:calc(36px + env(safe-area-inset-bottom));display:none;');
	// under the road button: a line rocket, back to the ship
	const launch = button('', 'Take off and return to your ship', 'right:calc(12px + env(safe-area-inset-right));top:calc(220px + env(safe-area-inset-top));width:44px;padding:6px 10px;align-items:center;justify-content:center;display:none;');
	launch.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c3 2.4 4.5 6 4.5 10.5l-1.5 3.5h-6L7.5 13C7.5 8.5 9 4.9 12 2.5z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7.8 12.5 5 15.5V19l4-2.5M16.2 12.5 19 15.5V19l-4-2.5M10.5 19.5 12 22l1.5-2.5"/></svg>';
	const veil = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 30%,rgba(40,140,150,.10),rgba(2,30,40,.55));');
	const hint = css(document.createElement('div'), 'position:absolute;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:rgba(8,20,26,.5);color:#eafaf6;font:13px system-ui;pointer-events:none;transition:opacity .6s;text-align:center;max-width:80vw;white-space:pre-line;');
	const loading = css(document.createElement('div'), 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#10333a,#050b10);color:#d9f4ee;font:15px system-ui;letter-spacing:.04em;');
	loading.textContent = 'Raising the island…';
	const panel = css(document.createElement('div'), 'position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(116px + env(safe-area-inset-top));width:min(300px,78vw);padding:14px;border-radius:14px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;display:none;max-height:calc(100dvh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);');
	mount.append(canvas, veil, joy, back, gear, fly, boost, jump, down, act, shell, toss, place, launch, hint, panel, loading);
	document.body.appendChild(mount);
	return { mount, canvas, joy, knob, back, jump, gear, fly, boost, down, act, shell, toss, place, launch, veil, hint, loading, panel };
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
	// declared here, made once the hint and camera exist (see below)
	let drive = { update: () => false, stop() {}, active: () => false };
	// MSAA on phones too: Apple's tile GPUs resolve it almost for free, and it is what
	// lets leaves and grass edges fade (alpha to coverage) instead of stair-stepping
	const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance' });
	// three numbers a program's textures across both its stages and warns past the one stage's
	// limit (16 on Macs and phones), every draw; the units themselves go up to the combined limit
	// (32 there), and each stage keeps inside its 16 (the smoke's samplers check)
	{ const gl = renderer.getContext(); renderer.capabilities.maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS); }
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
		uTime: { value: 0 }, uWet: { value: 0 }, uWind: { value: 0.5 }, uGust: { value: 0 }, uWindT: { value: 0 }, uWindDir: { value: new THREE.Vector2(0.93, 0.35) }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uPulse: { value: 0 },
		uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uSunColor: { value: new THREE.Color(1, 0.95, 0.86) },
		uSkyZen: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color(0.3, 0.35, 0.4) },
		uWave: { value: 1 }, uUnder: { value: 0 }, startHours: 10.5,
	};
	// (the cars' paint and glass reflect this sky)
	bindCarSky(shared);
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

	// (a hint with priority holds the line for its time: a place name passing by can't
	// clear a found verse)
	function hint(text, ms = 4000, pri = 0) {
		const now = performance.now();
		if (pri < (hint.pri || 0) && now < (hint.until || 0)) return;
		hint.pri = pri; hint.until = now + ms;
		dom.hint.textContent = text;
		dom.hint.style.opacity = '1';
		clearTimeout(hint.t);
		hint.t = setTimeout(() => { dom.hint.style.opacity = '0'; }, ms);
	}
	// the Guide: talk, ask, be taken places (a model on this device, or the built-in guide)
	// people is filled in just below; the guide reaches it through this api object
	const guideApi = { world: () => world, camera, shared, hint, people: null };
	const guide = createGuide(dom.mount, guideApi);
	// the city director (earth/): what should be in the towns and cities you come to, the same
	// for every player (the discovery server's brief, else the Earth atlas's); the Guide's
	// model is passed only for the dev flag in earth/config.js
	const earthDirector = HOOKS.earth = createDirector({ llm: guide.llm, toLatLon: globeLL });
	// secrets and surprises: the Bard's lost verses, fireworks, the foghorns, the calendar
	const surprises = createSurprises({ scene, camera, getWorld: () => world, hint: (t, ms) => hint(t, ms, 1), say: (t, w) => guide.say(t, w), isPhone });
	guideApi.secret = (t) => surprises.secret(t);
	HOOKS.surprises = surprises;
	// fishing, wherever there is water
	const fishing = createFishing({ scene, camera, getWorld: () => world, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount });
	HOOKS.fishing = fishing;
	// the minigames (games/*.js): a games button, and a Play button at their venues
	const arcade = createArcade({ scene, camera, mount: dom.mount, getWorld: () => world, hint: (t, ms) => hint(t, ms, 1), isPhone, teleportTo: (name, lat, lon) => teleport([name, lat, lon, world?.player.state.yaw || 0]) });
	HOOKS.arcade = arcade;
	// drive the roads, streets and trails: snap on, choose the turns
	drive = createDrive({ world: () => world, camera, mount: dom.mount, isPhone, hint, strike: (car) => HOOKS.impacts?.strike(car) || 0 });
	HOOKS.drive = drive;
	// anyone struck down or thrown: limp, weighed bodies (people/ragdoll.js)
	const ragdolls = createRagdolls({ world: () => world, isPhone });
	HOOKS.ragdolls = ragdolls;
	HOOKS.impacts = createImpacts({ people: () => people, ragdolls });
	// taking a car off its driver (E beside one in the traffic): you, shown, haul them out
	const avatar = createAvatar({ scene, world: () => world });
	const carjack = createCarjack({ world: () => world, camera, drive, ragdolls, avatar, hint: (t, ms) => hint(t, ms, 1) });
	HOOKS.carjack = carjack;
	// you, seen (P), knocked down by the traffic, and a shove (X) (people/self.js)
	// the tattoo studio (in a parlour, or Crysis.tattoo()): your own designs, worn from then on
	const studio = createTattooStudio({ mount: dom.mount, avatar, player: () => world.player, setCine: (fn) => { HOOKS.cine = fn; }, hint: (t, ms) => hint(t, ms, 1), isPhone });
	const inkBtn = button('🖋 Tattoo studio', 'Tattoo studio (T)', 'left:50%;transform:translateX(-50%);bottom:calc(200px + env(safe-area-inset-bottom));display:none;');
	dom.mount.appendChild(inkBtn);
	inkBtn.addEventListener('click', (e) => { e.stopPropagation(); studio.start(); });
	HOOKS.tattoo = () => studio.start();
	HOOKS.tattooInfo = () => studio.info();
	for (const ev of ['pointerdown', 'touchstart']) inkBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if ((e.key === 't' || e.key === 'T') && !e.repeat && world?.bizSeen?.type === 'tattoo' && !studio.active() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); studio.start(); } });
	const you = createSelf({ world: () => world, camera, avatar, ragdolls, people: () => people, busy: () => carjack.active() || drive.active(), hint: (t, ms) => hint(t, ms, 1) });
	HOOKS.self = you;
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || window._KEYS_PLAY_ON || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
		if (e.key === 'p' || e.key === 'P') { you.toggle(); e.preventDefault(); } else if (e.key === 'x' || e.key === 'X') { you.shove(); e.preventDefault(); }
	});
	addEventListener('keydown', (e) => { if ((e.key === 'e' || e.key === 'E') && !e.repeat && document.activeElement?.tagName !== 'INPUT' && carjack.candidate()) { carjack.begin(); e.preventDefault(); } });
	// auto music: a generative score on the faceplate's own instruments (music/automusic.js)
	const autoMusic = createAutoMusic({ world: () => world, camera, shared, drive, arcade, mount: dom.mount, active: () => running && visible });
	HOOKS.autoMusic = autoMusic;
	// people: real bodies about the village and the city streets
	const people = createPeople(scene, () => world, camera);
	guideApi.people = people;
	// the world's audio: footsteps, the room's sound, the places' ambience (audio/*.js)
	const worldAudio = createWorldAudio({ getWorld: () => world, camera, people, busy: () => arcade.active() || drive.active() || !!world?.boat?.boarded?.() || !!world?.boardwalk?.riding?.(), planet: () => shared.planet });
	HOOKS.audio = worldAudio;
	// and, very rarely, in the woods after dark, someone who is not one of them
	const ghost = createGhost(scene, { world: () => world, mount: dom.mount, canvas: dom.canvas, hush: (k) => world?.natureSound?.hush?.(k) });
	HOOKS.ghost = (at) => ghost.summon(camera, at);
	HOOKS.ghostInfo = () => ghost.inspect();
	// the sculpted animals in a row in front of you (a look at them: Crysis.creatures())
	HOOKS.creatures = () => {
		const P = world.player.state, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
		const list = [CREATURES.harborSeal(0.3), CREATURES.harborSeal(0.8), CREATURES.seaLion(0.5), CREATURES.elephantSeal(true), CREATURES.deer(), CREATURES.waterfowl('mallard'), CREATURES.waterfowl('goose'), CREATURES.bird('gull'), CREATURES.bird('pelican'), CREATURES.bird('vulture'), CREATURES.bird('hawk')];
		const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6 }), g = new THREE.Group();
		list.forEach((geo, i) => { const m = new THREE.Mesh(geo, mat), off = (i - (list.length - 1) / 2) * 2.4, x = P.pos.x + fx * 7 + rx * off, z = P.pos.z + fz * 7 + rz * off; m.position.set(x, world.island.heightAt(x, z) + (i >= 7 ? 1.2 : 0), z); m.rotation.y = P.yaw + Math.PI / 2 + 0.5; m.castShadow = true; g.add(m); });
		scene.add(g);
		return list.length;
	};
	// walk up to someone and talk: a button with their name, or Enter
	const talkBtn = button('💬 Talk', 'Talk (Enter)', 'left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));display:none;');
	dom.mount.appendChild(talkBtn);
	let talkTarget = null, talkT = 0;
	const talkNow = () => { if (talkTarget) guide.talkTo(talkTarget); };
	talkBtn.addEventListener('click', (e) => { e.stopPropagation(); talkNow(); });
	for (const ev of ['pointerdown', 'touchstart']) talkBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if (e.key === 'Enter' && talkTarget && document.activeElement?.tagName !== 'INPUT' && dom.mount.style.display !== 'none') { e.preventDefault(); talkNow(); } });
	// teleport while flying: a line pin button under the boost, and a list of places to land
	const PLACES_TP = [
		['Golden Gate Bridge, Vista Point', 37.8326, -122.4814, 2.6], ['Downtown San Francisco', 37.7936, -122.3965, 0.9], ['Twin Peaks', 37.7544, -122.4477, 0.2],
		['San Ramon', 37.7700, -121.9380, 0], ['Lake Annabel, Bishop Ranch', 37.7646, -121.9660, -2.2], ['Mt Diablo summit', 37.8816, -121.9142, 0.8], ['Rock City, Mt Diablo', 37.8452, -121.9400, -1.3],
		['Mt Tamalpais, East Peak', 37.9293, -122.5780, 2.2], ['Mission Peak', 37.5125, -121.8806, 1.5], ['Berkeley Hills', 37.8812, -122.2425, 1.9],
		['Tide pools, Moss Beach', 37.5214, -122.5166, 1.75], ['Devil\'s Slide, Highway 1', 37.5738, -122.5148, 3.1], ['Half Moon Bay, Highway 1', 37.4640, -122.4330, 0], ['Duxbury Reef, Bolinas', 37.8936, -122.6972, 2.3],
		['Bay Area Discovery Museum, Fort Baker', 37.8345, -122.4782, 3.3], ['Pacifica Pier', 37.6336, -122.4935, 1.8], ['San Ramon Central Park', 37.7643, -121.9528, 0.5], ['Apple Park, Cupertino', 37.3310, -122.0040, 0.6], ['Downtown San Jose', 37.3330, -121.8890, 0], ['Pescadero State Beach, Highway 1', 37.2680, -122.4105, 1.7], ['Pigeon Point Light Station', 37.1845, -122.3925, 2.3], ['Santa Cruz Beach Boardwalk', 36.96317, -122.01846, -1.29], ['Santa Cruz Municipal Wharf', 36.96263, -122.02233, -2.97], ['San Lorenzo River, the Riverwalk', 36.97440, -122.02088, 3.14],
		['Lake Chabot', 37.72148, -122.10911, -1.28], ['Crystal Springs Reservoir', 37.52951, -122.3625, 2.31], ['Lexington Reservoir', 37.2003, -121.98768, 2.09], ['San Lorenzo River, Ben Lomond', 37.08781, -122.08775, -1.57],
		['The island village', null, null, 0], ['A town beyond the map', 'town', null, 0],
	];
	const tpBtn = button('', 'Teleport to a place', 'right:calc(12px + env(safe-area-inset-right));top:calc(324px + env(safe-area-inset-top));width:44px;padding:6px 10px;align-items:center;justify-content:center;display:none;');
	tpBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
	dom.mount.appendChild(tpBtn);
	const tpMenu = css(document.createElement('div'), 'position:absolute;right:calc(64px + env(safe-area-inset-right));top:calc(116px + env(safe-area-inset-top));max-height:calc(100dvh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:none;flex-direction:column;gap:4px;padding:8px;border-radius:12px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:5;');
	dom.mount.appendChild(scrollable(tpMenu));
	for (const el of [tpBtn, tpMenu]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());
	// travelling: the view fades to dark with the place's name, you are moved behind it, and
	// it only lifts once the new place is built and the frames are running smoothly again
	const travelVeil = css(document.createElement('div'), 'position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;transition:opacity .22s ease;background:radial-gradient(ellipse at 50% 45%,rgba(8,22,28,.92),rgba(2,8,12,.98));display:flex;align-items:center;justify-content:center;color:#eafaf6;font:600 15px system-ui;letter-spacing:.06em;text-align:center;padding:24px;');
	dom.mount.appendChild(travelVeil);
	let travelling = false;
	function travel(label, move) {
		if (travelling) return;
		travelling = true;
		travelVeil.textContent = label || '';
		travelVeil.style.opacity = '1';
		setTimeout(() => {
			try { move(); } catch (err) { console.error('[travel]', err); }
			const t0 = performance.now();
			let last = t0, calm = 0;
			const watch = (now) => {
				calm = now - last < 70 ? calm + 1 : 0;
				last = now;
				// a dozen smooth frames in a row (or eight seconds, whatever happens)
				if ((calm >= 12 && now - t0 > 600) || now - t0 > 8000) { travelVeil.style.opacity = '0'; travelling = false; return; }
				requestAnimationFrame(watch);
			};
			requestAnimationFrame(watch);
		}, 240);
	}
	function teleport(pl) { tpMenu.style.display = 'none'; travel(pl[0], () => teleportNow(pl)); }
	function teleportNow([name, lat, lon, yaw]) {
		fishing.drop();
		const W = world, P = W?.player.state;
		if (!P) return;
		let x, z;
		if (lat === null) {
			// the village: in among the houses, walked inland until on dry ground (not under the pier)
			const v = W.island.village, sd = v.seaDir || { x: 0, z: 0 };
			x = v.x; z = v.z;
			for (let k = 0; k < 40 && W.island.heightAt(x, z) < 1.2; k++) { x -= sd.x * 3; z -= sd.z * 3; }
		}
		else if (lat === 'town') {
			const towns = (W.bayArea?.towns || []).filter((t) => W.bayArea.heightAt(t.x, t.z) > 5 && !W.real?.inside(t.x, t.z));
			const t = towns[Math.floor(Math.random() * towns.length)];
			if (!t) return;
			x = t.x; z = t.z; name = t.name;
		} else { const p = toWorld(lat, lon); x = p.x; z = p.z; }
		drive.stop();
		// land on the ground, facing the view
		P.flying = false; P.boost = false; P.diving = false; P.vel.set(0, 0, 0);
		P.pos.set(x, W.island.heightAt(x, z) + 1.7, z);
		P.yaw = yaw; P.pitch = 0.02;
		camera.position.copy(P.pos);
		tpMenu.style.display = 'none';
		hint(name, 2500);
	}
	// globe: anywhere on Earth by latitude and longitude, arriving in the air above it (Crysis.goTo,
	// a landing from orbit with a place, a shared link far off)
	HOOKS.goTo = (lat, lon, agl = 700) => {
		const W = world, P = W?.player.state;
		if (!W?.globe || !P || !Number.isFinite(+lat) || !Number.isFinite(+lon)) return 'Earth only: Crysis.goTo(lat, lon).';
		drive.stop();
		if (W.boat?.boarded?.()) W.boat.leave();
		const p = W.globe.place(+lat, +lon);
		P.flying = true; P.diving = false; P.vel.set(0, 0, 0); P.pitch = -0.25;
		P.pos.set(p.x, 3000, p.z); camera.position.copy(P.pos);
		p.ready.then(() => { if (world === W) { const g = W.island.heightAt(p.x, p.z); P.pos.y = (Number.isFinite(g) ? Math.max(0, g) : 0) + agl; camera.position.copy(P.pos); } });
		return `To ${(+lat).toFixed(3)}, ${(+lon).toFixed(3)}.`;
	};
	const tpPlaces = [];
	for (const pl of PLACES_TP) {
		const b = css(document.createElement('button'), 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;');
		b.textContent = pl[0];
		b.onclick = (e) => { e.stopPropagation(); teleport(pl); };
		tpMenu.appendChild(b);
		tpPlaces.push(b);
	}
	// share where you are, and homes to come back to (share.js): at the top of the menu
	const openTp = () => { share.refresh(); for (const b of tpPlaces) b.style.display = world?.bayArea ? '' : 'none'; tpMenu.style.display = 'flex'; };
	const share = createShare({ world: () => world, state, shared, camera, scene, hint, mount: dom.mount, menu: tpMenu, places: PLACES_TP, origin: () => origin, visible: () => visible, enter: (p) => api.open(p), beforeMove: () => { fishing.drop(); drive.stop(); tpMenu.style.display = 'none'; }, openMenu: openTp, closeMenu: () => { tpMenu.style.display = 'none'; } });
	HOOKS.share = share;
	tpBtn.addEventListener('click', (e) => { e.stopPropagation(); if (tpMenu.style.display === 'none') openTp(); else tpMenu.style.display = 'none'; });
	function watchTeleport() {
		// (shown on every world, walking too: sharing and homes live in the menu)
		const P = world?.player.state, on = !!P && !arcade.active();
		const d = on ? 'flex' : 'none';
		if (tpBtn.style.display !== d) tpBtn.style.display = d;
		if (!on && tpMenu.style.display !== 'none') tpMenu.style.display = 'none';
	}
	// doors within reach: a button, or E
	const doorBtn = button('🚪 Open', 'Open the door (E)', 'left:50%;transform:translateX(-50%);bottom:calc(200px + env(safe-area-inset-bottom));display:none;');
	dom.mount.appendChild(doorBtn);
	let doorHere = null, doorT = 0, indoorK = 0;
	const useDoor = () => { if (doorHere) { doorHere.toggle(); doorT = 1; } };
	doorBtn.addEventListener('click', (e) => { e.stopPropagation(); useDoor(); });
	for (const ev of ['pointerdown', 'touchstart']) doorBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if ((e.key === 'e' || e.key === 'E') && doorHere && document.activeElement?.tagName !== 'INPUT' && dom.mount.style.display !== 'none') { e.preventDefault(); useDoor(); } });
	function watchDoor(dt) {
		doorT += dt;
		if (doorT < 0.15) return;
		doorT = 0;
		const P = world?.player.state;
		doorHere = P && !P.flying && world.houses ? world.houses.doorNear(camera) || world.interiors?.doorNear(camera) : null;
		doorBtn.style.display = doorHere ? '' : 'none';
		if (doorHere) {
			const what = doorHere.kind === 'garage' ? 'garage door' : doorHere.kind === 'slider' ? 'slider' : 'door';
			doorBtn.textContent = `🚪 ${doorHere.open ? 'Close' : 'Open'} ${what}${isPhone ? '' : ' (E)'}`;
		}
	}
	function watchTalk(dt) {
		talkT += dt;
		if (talkT < 0.25) return;
		talkT = 0;
		const P = world?.player.state, cur = guide.partner();
		// walked away from someone you were talking with: the conversation ends
		if (cur && P && cur.p.M.S.pos.distanceTo(camera.position) > 7) { guide.endTalk(); hint(`${cur.persona.first} goes back to what they were doing.`, 2500); }
		talkTarget = P && !P.flying && !cur ? people.facing(camera.position, P.yaw) : null;
		talkBtn.style.display = talkTarget ? '' : 'none';
		if (talkTarget) talkBtn.textContent = isPhone ? '💬 Talk' : '💬 Talk (Enter)';
	}

	async function build(params) {
		const seed = (params.seed >>> 0) || 1337;
		// Earth: the island in the Gulf of the Farallones with the real Bay Area round it.
		// Other worlds flight lands on are their own islands, alone in their seas.
		const earth = params.earth !== false;
		if (world && state.seed === seed && state.earth === earth && state.biome === params.biome) return world;
		if (world) teardown();
		dom.loading.style.display = 'flex';
		await new Promise((r) => requestAnimationFrame(r));
		// what kind of world: its ground, air, plants and underground (Earth's island is tropical)
		const profile = planetProfile(earth ? 'TROPICAL' : params.biome, seed);
		shared.planet = profile;
		const island = generateIsland({ seed, biome: params.biome, resolution: isPhone ? 640 : 768, profile });
		island.profileHaze = profile.air?.haze || 1;
		// the ball fields above the village (or the world's own arena): the ground levelled under them before anything is made of it
		const fieldPlan = planIslandFields(island, earth ? null : profile);
		// a realm of castles and towns, where this world keeps one: sited now, the land shaped round it
		const realmPlan = earth ? null : planRealm(island, profile, { fields: fieldPlan.clear, isPhone });
		// the planet's second biome and its cold side, baked where the ground, plants and water can read it
		island.biomes = createBiomes(island, profile);
		// its streams and lakes (or ice, or lava), carved before its plants, caves and ruins are planned
		const waterPlan = earth ? null : await planWaters(island, profile, { clear: [...fieldPlan.clear, ...(realmPlan?.clear || [])], realm: realmPlan });
		if (waterPlan) island.inWater = waterPlan.inWater;
		(shared.uBiome ||= { value: null }).value = island.biomes.tex;
		shared.biHalf = island.half;
		shared.heightTex = makeHeightTexture(island);
		shared.maskTex = makeMaskTexture(island);
		const sky = createSky(scene, shared, renderer);
		try { if (localStorage.getItem('l99-conlines')) sky.lines(true); } catch { /* private mode */ }
		// weather: showers, cirrus, the rainbow's rain, lightning, all on the one wind
		const weather = createWeather(scene, shared, { isPhone });
		sky.attach(weather);
		const terrain = createTerrain(island, shared);
		// the real Bay Area round the island: its heights are shared with the sea
		shared.bayU = bayUniforms();
		const ocean = createOcean(island, shared);
		// turf underfoot plus a longer-reaching layer
		// the reaching layer: out to about 55 m (40 on phones) before it melts into the ground
		const grass = createGrass(island, shared, isPhone ? 15000 : 30000, isPhone ? 90 : 124, { width: 0.5, seed: 99 });
		const turf = createGrass(island, shared, isPhone ? 11000 : 18000, 20, { width: 0.34, height: 0.8, seed: 7 });
		scene.add(terrain, ocean, grass, turf);
		const litter = createLitter(island, shared, scene, isPhone ? 0.6 : 1);
		// Crysis: the land's plants and animals, grown from the seed
		const land = buildLandEcology(island.seed, { crowns: { boreal: ['columnar'], ash: ['columnar'], barren: ['columnar'], desert: ['umbrella', 'round'] }[profile.flora] });
		// a planet's caves are planned first, so nothing grows in their mouths
		const cavePlan = earth ? null : planCaves(island, profile);
		// ...and the realm's dungeons dug down to meet them
		if (realmPlan) planDungeons(realmPlan, island, cavePlan, makeField);
		// the works of whoever built here before: sited now, so nothing grows on them
		const alienPlan = earth || realmPlan?.noAliens ? null : planAlien(island, profile, { holes: cavePlan?.holes, fields: [...fieldPlan.clear, ...(realmPlan?.clear || [])], isPhone });
		// (and the dwellings of whoever built them: interiors/alien.js)
		if (alienPlan) alienPlan.clear.push(...planDwellings(island, alienPlan));
		island.noPlant = [...(cavePlan?.holes || []), ...fieldPlan.clear, ...(alienPlan?.clear || []), ...(realmPlan?.clear || [])];
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
		// the reef's corals and the sea's creatures ring too (tagged by what they are made of)
		for (const g of [reef.group, sealife.group]) g?.traverse((o) => { if (o.isInstancedMesh && o.userData.material175) pick.push(o); });
		const music = createMusic(shared, scene, camera, dom.canvas, () => pick, () => running && visible);
		music.register();
		world = { island, sky, weather, terrain, ocean, grass, turf, litter, vegetation, village, distant, fauna, player, music, boat, whale, shells, underwater, sealife, magma, caverns, reef, eco, fish, inverts, land, landFauna, bayArea: null, bridge: null, labels: null };
		// the fishing cottages' rooms, furnished as you come near (interiors/cottage.js)
		world.cottages = createCottageInteriors(scene, village.footprints, { isPhone });
		// sunbeams through the trees in mist (world/sunrays.js)
		world.rays = createSunRays(scene, shared, renderer, { isPhone, sun: sky.sun, air: sky.uniforms.uAir });
		world.rays.quality(quality);
		if (waterPlan) {
			world.water = createWater(scene, shared, { isPhone, mode: 'island', island, heightAt: (x, z) => island.heightAt(x, z), sources: [waterPlan.source], look: waterPlan.look, roads: waterPlan.roads });
			island.waterAt = (x, z) => world?.water?.waterAt(x, z) ?? null;
		}
		// another world's underground: cave mouths on the hills, tunnels, ruins, a village by lamplight
		if (!earth) {
			world.underworld = createUnderworld(island, shared, scene, camera, profile, { isPhone, hint: (t, ms) => hint(t, ms, 1), player: () => world?.player.state, mount: dom.mount, plan: cavePlan });
			island.underFloor = world.underworld.floor;
			island.underPush = world.underworld.push;
			pick.push(...world.underworld.pickables);
		}
		// the mushrooms this world grows, and what they do to you
		world.shrooms = createMushrooms(island, shared, scene, camera, profile, { isPhone, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount, canvas: dom.canvas, player: () => world?.player.state, spots: () => world?.underworld?.spots || [], renderer, vegetation });
		// a volcanic world's mountain: lava tubes, spouts, the crater's lake, and its eruptions
		if (!earth && (profile.relief === 'volcano' || island.peak?.volcanic)) {
			world.volcano = createVolcano(island, shared, scene, camera, profile, { isPhone, renderer });
			island.extraFloor = world.volcano.floor;
			island.extraPush = world.volcano.push;
		}
		// the ball fields: the island's, and the Bay's as you come near them (their fences are walked into)
		world.fields = createSportsFields({ scene, getWorld: () => world, isPhone, plan: fieldPlan });
		{ const own = island.extraPush, fp = world.fields.push; island.extraPush = own ? (p, footY) => { own(p, footY); fp(p, footY); } : fp; }
		{ const of = island.extraFloor, ff = world.fields.floor; island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), ff(x, z, y)) : ff; }
		// the alien works: their platforms, causeways and halls are walked on, their walls walked into
		if (alienPlan) {
			const al = world.alien = createAlien(island, shared, scene, camera, profile, alienPlan, { isPhone, renderer, hint: (t, ms) => hint(t, ms, 1), player: () => world?.player.state });
			const of = island.extraFloor, op = island.extraPush;
			island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), al.floor(x, z, y)) : al.floor;
			island.extraPush = op ? (p, footY) => { op(p, footY); al.push(p, footY); } : al.push;
			const dw = world.dwellings = createDwellings(scene, alienPlan, { isPhone });
			const of2 = island.extraFloor, op2 = island.extraPush;
			island.extraFloor = (x, z, y) => Math.max(of2(x, z, y), dw.floor(x, z, y));
			island.extraPush = (p, footY) => { op2(p, footY); dw.push(p, footY); };
		}
		// the realm: its castle, town and fields walked on and into; its dungeons reached before the caves
		if (realmPlan) {
			const md = world.medieval = createMedieval(realmPlan, { island, shared, scene, camera, profile, isPhone, renderer, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount, player: () => world?.player.state, underworld: world.underworld });
			const of = island.extraFloor, op = island.extraPush;
			island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), md.floor(x, z, y)) : md.floor;
			island.extraPush = op ? (p, footY) => { op(p, footY); md.push(p, footY); } : md.push;
			island.underFloor = md.underFloor(island.underFloor);
			island.underPush = md.underPush(island.underPush);
		}
		// (the bridges where the realm's roads cross the streams are floors)
		if (waterPlan?.source.decks.length) { const of = island.extraFloor, wf = world.water.floor; island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), wf(x, z, y)) : wf; }
		state.seed = seed;
		state.earth = earth;
		state.biome = params.biome;
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
			// globe: the Earth past the survey, and the engine's relief on the Bay's own ground (earth/globe.js)
			world.globe = createGlobe({ scene, shared, bay: bayArea, island, camera, world: () => world, director: earthDirector, hint: (t, ms) => hint(t, ms, 1), isPhone, busy: () => drive.active() || !!world?.boat?.boarded?.() });
			// globe: the Bay's woods and wild things are California's; far off (or once the frame floats)
			// they give way to the globe's own (their view of the Bay says it is not loaded there)
			const bayNear = Object.create(bayArea, { loaded: { value: () => bayArea.loaded() && globeF.bay && (() => { const ll = globeLL(camera.position.x, camera.position.z); return bayKm(ll.lat, ll.lon) < BAY_WILD_KM; })() } });
			world.labels = createLabels(dom.mount, bayArea, null);
			world.real = createRealCity(renderer);
			// Crysis: the towns beyond the survey, grown street by street as you near them
			world.civ = createCivilization({ real: world.real, bay: bayArea, water: () => world?.water?.gen, brief: (t) => earthDirector.townBrief(t) });
			world.city = createCity(shared, scene, bayNear, world.real);
			// the forest floor: fallen logs and stumps under the trees, the haze among the redwoods
			world.forestFloor = createForestFloor(scene, bayNear, world.city, world.real, { shared, isPhone, ground: (x, z) => island.heightAt(x, z), globe: () => world?.globe });
			// the real houses close by, built whole with their rooms
			world.houses = createHouses(scene, bayArea, world.real, world.city, { isPhone });
			// ...and the shops, cafés, restaurants, offices and places to play, walked into
			world.commercial = createCommercial(scene, bayArea, world.real, world.city, { isPhone });
			// inside the towers: the lobby, the elevators, every floor, the roof
			world.towers = createTowers(scene, bayArea, world.city, { isPhone, mount: dom.mount, hint: (t, ms) => hint(t, ms, 1), player: () => world?.player.state });
			// ...and every other building: solid, and built inside as you come to it (interiors/)
			world.interiors = createInteriors(scene, bayArea, world.city, { isPhone, mats: world.houses.M, towers: world.towers });
			{ const cv = world.commercial.venue, I = world.interiors; world.commercial.venue = (c, h) => cv(c, h) || I.venue(c, h); }
			// (the doors walkers may use: the shops' and cafés' too, through the interiors' list)
			world.interiors.addDoors(world.commercial);
			world.street = createStreetLife(shared, scene, bayArea, (x, z) => island.heightAt(x, z), world.real);
			// the cars' people, their owners, and the cars as solid things (vehicles/)
			world.vehicles = createVehicles({ scene, world: () => world, camera, isPhone, people: () => people });
			// the freeways' barriers, sound walls and overpasses (their decks are floors)
			world.freeways = createFreeways(scene, bayArea, world.real, { isPhone });
			// Lake Annabel at Bishop Ranch: water, wildlife, and fishing
			world.lake = createLake(scene, bayArea, shared, { isPhone, real: world.real, ponds: false });
			// every other river, creek, lake and reservoir (bay/water.js)
			world.water = createEarthWater(scene, bayArea, shared, { isPhone, real: world.real, ground: (x, z) => island.heightAt(x, z), riverLevel: (x, z) => world?.boardwalk?.waterAt(x, z) ?? null, riverSettled: () => world?.boardwalk?.river?.settled?.() ?? !world?.boardwalk, extra: [world.lake.source] });
			bayArea.waterName = (x, z) => world?.water?.nameAt(x, z) ?? null;
			// tide pools on the Pacific shore: Fitzgerald, Pillar Point, Duxbury Reef
			world.tidepools = createTidepools(scene, bayArea, shared, { isPhone });
			// the beaches down Highway 1: lots, restrooms, camps and fires, surf, the lighthouse
			world.beaches = createBeaches(scene, bayArea, world.real, shared, { isPhone });
			// the parks furnished as their agencies furnish them: signs, kiosks, tables, playgrounds, courts
			world.parks = createParkKit(scene, bayArea, world.real, { isPhone, lake: world.lake });
			// the Bay Area Discovery Museum at Fort Baker: the barracks, the exhibits, Lookout Cove
			world.discovery = createDiscovery(scene, bayArea, world.real, { isPhone });
			// the Santa Cruz Beach Boardwalk: the Casino, the midway and its rides, the Giant Dipper
			world.boardwalk = createBoardwalk(scene, bayArea, shared, { isPhone, mount: dom.mount, hint: (t, ms, pri = 1) => hint(t, ms, pri), camera, player: () => world?.player.state });
			// the Bay Area's wild animals by habitat, month and hour, and the field journal
			world.wildlife = createWildlife(scene, bayNear, { isPhone, real: world.real, globe: () => world?.globe, hint: (t, ms, pri = 1) => hint(t, ms, pri), say: (t, w) => guide?.say?.(t, w) });
			world.citySound = createCitySound(bayArea, (x, z) => island.heightAt(x, z));
			world.natureSound = createNatureSound(bayNear, (x, z) => bayArea.heightAt(x, z));
			// the in-between places: dirt tracks, the industrial fringe, town's ragged edge, the odd camp
			world.edge = createEdgelands(scene, { bay: bayNear, real: world.real, city: world.city, world: () => world, shared, isPhone });
			// roads graded like real ones, with berms: the ground walked and driven on is the
			// ground as drawn
			world.berms = createBerms(world.real, (x, z) => bayArea.heightAt(x, z));
			const own = island.heightAt, berms = world.berms;
			island.heightAt = (x, z) => (Math.max(Math.abs(x), Math.abs(z)) < island.half - 20 || !bayArea.loaded()) ? own(x, z) : berms.apply(x, z, bayArea.heightAt(x, z));
			// (the ground as the GPU draws it, where people stand: bay/terrain.js)
			island.drawnAt = (x, z) => (Math.max(Math.abs(x), Math.abs(z)) < island.half - 20 || !bayArea.loaded()) ? own(x, z) : bayArea.drawnAt(x, z, island.heightAt);
			// (the San Lorenzo's water, to swim or wade: bay/sanlorenzo.js)
			island.waterAt = (x, z) => world?.boardwalk?.waterAt(x, z) ?? world?.water?.waterAt(x, z) ?? null;
			bayArea.ready.then(() => {
				if (world !== w0) return;
				const bridge = createGoldenGate(shared, scene, bayArea.heightAt);
				world.bridge = bridge;
				// the bridge's deck and the Presidio Parkway up to it, to drive (drive.js follows them)
				{
					const pts = [], B = bridge, half = B.length / 2;
					for (let t = -half; t <= half + 0.1; t += 20) pts.push(B.centre.x + B.axis.x * t, B.centre.z + B.axis.y * t);
					const south = pts.slice(0, 2), route = ROUTES['US-101 Presidio'].map(([a, b]) => toWorld(a, b));
					const pp = [...south];
					for (const q of route) pp.push(q.x, q.z);
					world.real?.addRoads?.([
						{ cls: 'motorway', name: 'US-101 · Golden Gate Bridge', w: 18, pts: new Float32Array(pts), bridge: true, end0: false, end1: false, link: false, divided: true },
						{ cls: 'motorway', name: 'US-101 · Presidio Parkway', w: 18, pts: new Float32Array(pp), bridge: false, end0: false, end1: false, link: false, divided: true },
					]);
				}
				world.landmarks = createLandmarks(scene, bayArea);
				world.roads = createRoads(shared, scene, bayArea);
				world.diablo = createDiablo(scene, bayArea);
				// the Summit Building's rooms, built inside its stone as you come near
				world.interiors?.addSite(world.diablo.site);
				// ...and the landmarks' (bay/landmarks.js): their halls, their doors for the townsfolk; the
				// city's own towers keep their lobbies where a landmark tower stands on one
				for (const S of [...world.landmarks.sites, ...(world.boardwalk.sites || [])]) world.interiors?.addSite(S);
				world.interiors?.addDoors(world.landmarks);
				bayArea.coast?.sites?.each((S) => world.interiors?.addSite(S));
				world.landmarks.yieldTo((x, z) => (world.city?.towersNear?.(x, z, 20) || []).length > 0);
				world.labels = createLabels(dom.mount, bayArea, bridge);
				// walk and drive across the deck; climb about Mt Diablo's rocks, not through them
				// ...and in and out of the houses, up their stairs
				const diablo = world.diablo, houses = world.houses, fwy = world.freeways, pools = world.tidepools;
				island.extraFloor = (x, z, y) => Math.max(bridge.deckFloor(x, z, y), diablo.floor(x, z, y), houses.floor(x, z, y), fwy.floor(x, z, y), pools.floor(x, z, y), world.landmarks.floor(x, z, y), world.beaches.floor(x, z, y), world.commercial.floor(x, z, y), world.discovery.floor(x, z, y), world.towers.floor(x, z, y), world.boardwalk.floor(x, z, y), world.lake?.floor?.(x, z, y) ?? -1e9, world.parks?.floor?.(x, z, y) ?? -1e9);
				island.extraPush = (p, footY) => { diablo.push(p, footY); houses.push(p, footY); world.commercial.push(p, footY); world.discovery.push(p, footY); world.towers.push(p, footY); world.boardwalk.push(p, footY); world.landmarks.push(p, footY); bayArea.coast?.push?.(p, footY); world.lake?.push(p, footY, world.player.state.flying); world.fields.push(p, footY); world.beaches.push?.(p, footY); world.parks?.push?.(p, footY); };
				{ const of = island.extraFloor, op = island.extraPush, E = world.edge; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), E.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); E.push(p, footY); }; }
				{ const of = island.extraFloor, op = island.extraPush, I = world.interiors; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), I.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); I.push(p, footY); }; }
				{ const of = island.extraFloor, op = island.extraPush, V = world.vehicles; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), V.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); V.push(p, footY); }; }
				// the wild rocks to stand on and go round, the brush to push through (nature/wildground.js)
				{ const of = island.extraFloor, G = world.forestFloor?.wild; if (G) { island.extraFloor = (x, z, y) => Math.max(of(x, z, y), G.rockTop(x, z)); island.dragAt = (x, z) => G.dragAt(x, z); } }
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
		world.globe?.dispose();         // globe: the frame back to the Bay's, its hooks off
		drive.stop();
		world.player.dispose();
		world.shells?.dispose();
		world.shrooms?.dispose();
		world.underworld?.dispose();
		world.volcano?.dispose();
		world.alien?.dispose();
		world.medieval?.dispose();
		world.boardwalk?.destroy();
		world.rays?.dispose();
		scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
		while (scene.children.length) scene.remove(scene.children[0]);
		world = null;
		islandReach.band = undefined;
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
		// the weather: follow the clock, or hold it; moving a slider holds that one thing
		const WX = world.weather;
		const wrow = css(document.createElement('div'), 'display:flex;gap:4px;margin:4px 0 8px;');
		for (const mode of ['auto', 'clear', 'fair', 'showers', 'storm']) {
			const b = css(document.createElement('button'), 'flex:1;min-height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (WX.state.mode === mode ? '#01a982' : 'transparent') + ';color:#fff;font:11px system-ui;padding:0 2px;');
			b.textContent = mode[0].toUpperCase() + mode.slice(1);
			b.onclick = () => { WX.set(mode); buildPanel(); };
			wrow.appendChild(b);
		}
		const wl = css(document.createElement('div'), 'opacity:.9;margin-top:4px;'); wl.textContent = 'Weather';
		p.append(wl, wrow);
		slider(p, 'Rain', 0, 1, 0.01, () => WX.state.pin.rain ?? WX.state.rainHere, (v) => { WX.pin('rain', v); }, (v) => v < 0.02 ? 'dry' : v < 0.3 ? 'drizzle' : v < 0.7 ? 'shower' : 'downpour');
		slider(p, 'Cloud cover', 0, 1, 0.01, () => world.sky.uniforms.uCloud.value, (v) => { WX.pin('cover', v); world.sky.uniforms.uCloud.value = v; }, (v) => Math.round(v * 100) + '%');
		slider(p, 'Waves', 0, 2, 0.05, () => shared.uWave.value, (v) => { shared.uWave.value = v; world.ocean.userData.uniforms.uWave.value = v; }, (v) => v.toFixed(2));
		// the world's sounds (nature, the city, footsteps, the wolves) under the music: world/soundbus.js
		slider(p, 'World sounds', 0, 1.5, 0.05, () => worldLevel(), (v) => worldLevel(v), (v) => Math.round(v * 100) + '%');
		slider(p, 'Wind', 0, 1.5, 0.05, () => shared.uWind.value, (v) => { WX.pin('wind', v); shared.uWind.value = v; }, (v) => v.toFixed(2));
		// the month the world keeps: today's, or one picked (the hills, the flowers, the leaves, the
		// snow, the sun's path, the birds, the fish, what people wear); remembered
		const ml = css(document.createElement('div'), 'opacity:.9;margin-top:8px;'); ml.textContent = 'Month';
		const sel = css(document.createElement('select'), 'width:100%;min-height:36px;margin-top:4px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:#1a1a1a;color:#fff;padding:0 10px;font:inherit;');
		sel.setAttribute('aria-label', 'Month');
		['Live (today)', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].forEach((t, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = t; sel.appendChild(o); });
		sel.value = String(monthPicked());
		sel.onchange = () => pickMonth(+sel.value);
		p.append(ml, sel);
		// the constellations' lines drawn faintly among the stars (the real sky has none; off by default)
		const conB = css(document.createElement('button'), 'margin-top:8px;width:100%;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (world.sky.lines() ? '#01a982' : 'transparent') + ';color:#fff;font:600 13px system-ui;cursor:pointer;');
		conB.textContent = world.sky.lines() ? 'CONSTELLATION LINES: ON' : 'CONSTELLATION LINES: OFF';
		conB.onclick = () => { const on = !world.sky.lines(); world.sky.lines(on); try { localStorage.setItem('l99-conlines', on ? '1' : ''); } catch { /* private mode */ } buildPanel(); };
		p.appendChild(conB);
		const q = css(document.createElement('div'), 'display:flex;gap:6px;margin-top:6px;');
		for (const mode of ['auto', 'high', 'low']) {
			const b = css(document.createElement('button'), 'flex:1;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (quality === mode ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
			b.textContent = mode.toUpperCase();
			b.onclick = () => { quality = mode; applyQuality(true); buildPanel(); };
			q.appendChild(b);
		}
		p.appendChild(q);
		// the credits the data and the assets ask for where they are shown (OpenStreetMap, CC BY)
		const credit = css(document.createElement('div'), 'margin-top:8px;font:11px system-ui;opacity:.6;line-height:1.35;');
		credit.textContent = 'Terrain: USGS 3DEP, NOAA via AWS Terrain Tiles. Streets, buildings and land use (San Francisco, the East Bay, the Peninsula, Marin and the South Bay): Overture Maps Foundation (CC BY 4.0), © OpenStreetMap contributors (ODbL), Microsoft and Google building footprints. Hair and beards: the MakeHuman team, culturalibre and Rehman Polanski (CC0); Elvaerwyn (CC BY 4.0), via the MakeHuman community.';
		p.appendChild(credit);
		// what the site keeps on this device, by kind, each removable
		storagePanel(p, { activeModel: () => (guide.llm.kind() === 'webllm' ? guide.llm.model() : ''), onModelRemoved: () => guide.llm.useNone() });
		const TM = window.L99TouchMusic175;
		if (TM) {
			const b = css(document.createElement('button'), 'margin-top:10px;width:100%;min-height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (TM.enabled ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
			b.textContent = TM.enabled ? 'PLAY SURFACES: ON' : 'PLAY SURFACES: OFF';
			b.onclick = () => { TM.set(!TM.enabled); buildPanel(); };
			p.appendChild(b);
		}
		autoMusic.panel(p);
		panelClock = t;
	}

	function applyQuality(force) {
		const target = quality === 'high' ? maxRatio : quality === 'low' ? Math.min(1, maxRatio) * 0.75 : pixelRatio;
		if (quality !== 'auto' || force) pixelRatio = target;
		renderer.setPixelRatio(pixelRatio);
		renderer.shadowMap.enabled = !(quality === 'low');
		// (the clouds in the water: the plain sky there on low)
		shared.cloudReflect = quality !== 'low';
		world?.rays?.quality(quality);
		resize();
	}

	function resize() {
		const w = dom.mount.clientWidth || innerWidth, h = dom.mount.clientHeight || innerHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / Math.max(1, h);
		camera.updateProjectionMatrix();
	}
	addEventListener('resize', () => { if (visible) resize(); });

	// looking into a low sun the eye (and a windscreen) floods with warm light: a glare
	// over everything round where the sun is, unless the land stands between
	const glare = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen;');
	dom.mount.insertBefore(glare, dom.veil);
	let glareK = 0;
	const gv = new THREE.Vector3(), gf = new THREE.Vector3();
	function sunGlare(dt) {
		const W = world, sd = shared.uSunDir.value;
		let want = 0, sx = 50, sy = 50;
		if (W && sd.y > -0.02 && sd.y < 0.45 && !W.houses?.inside(camera.position) && camera.position.y > -0.5) {
			camera.getWorldDirection(gf);
			const facing = gf.dot(sd);
			if (facing > 0.35) {
				gv.copy(camera.position).addScaledVector(sd, 1000).project(camera);
				sx = (gv.x * 0.5 + 0.5) * 100; sy = (-gv.y * 0.5 + 0.5) * 100;
				// hills or mountains in the way?
				let seen = 1;
				for (const t of [80, 200, 500, 1200, 3000, 7000]) { const x = camera.position.x + sd.x * t, z = camera.position.z + sd.z * t; if (W.island.heightAt(x, z) > camera.position.y + sd.y * t + 3) { seen = 0; break; } }
				want = seen * THREE.MathUtils.smoothstep(facing, 0.35, 0.95) * (1 - THREE.MathUtils.smoothstep(sd.y, 0.12, 0.45)) * (1 - (W.weather?.state?.cover ?? 0) * 0.5);
			}
		}
		glareK += (want - glareK) * Math.min(1, dt * 3);
		if (glareK < 0.01) { if (glare.style.opacity !== '0') glare.style.opacity = '0'; return; }
		glare.style.opacity = glareK.toFixed(3);
		// the bloom round the sun, a wide warm wash, and a ghost or two across the frame
		const gx = 100 - sx, gy = 100 - sy;
		glare.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,236,190,.85) 0, rgba(255,200,110,.45) 6%, rgba(255,170,70,.18) 22%, rgba(255,150,60,0) 55%), radial-gradient(circle at ${(sx + gx) / 2}% ${(sy + gy) / 2}%, rgba(255,210,140,.10) 0, rgba(255,210,140,0) 4%), radial-gradient(circle at ${gx}% ${gy}%, rgba(170,255,210,.10) 0, rgba(170,255,210,.05) 2.5%, rgba(170,255,210,0) 5%)`;
	}
	// Out over the Bay Area the island's close-up layers have nothing to show, yet each would
	// still cost its full vertex work every frame: the grass, turf, pebbles and island ground
	// are carpets centred on the camera, whose heights and masks clamp to open sea past the
	// island's edge, and the village, caves and kelp are below a pixel kilometres off. Each is
	// left out once the camera is past its reach. (Only meshes are switched: taking a light
	// out of the scene would recompile every lit shader, and the village boat may be out
	// sailing with you.)
	function islandReach(W) {
		const off = Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z)) - W.island.half;
		// the carpets reach under 100 m; the ground's grid 2.2 km each way (3.1 to its corners)
		const band = off < 150 ? 0 : off < 3300 ? 1 : off < 6000 ? 2 : 3;
		if (band === islandReach.band) return;
		islandReach.band = band;
		for (const o of [W.grass, W.turf, ...W.litter.meshes]) o.visible = band < 1;
		W.terrain.visible = band < 2;
		if (W.underwater.group) W.underwater.group.visible = band < 3;
		for (const o of W.caverns.group.children) if (!o.isLight) o.visible = band < 3;
		for (const o of W.village.group.children) if (o !== W.village.boat) o.visible = band < 3;
	}
	// one part of the world failing must not stop the rest: the frame goes on, and each
	// distinct error is reported once
	const seenErr = new Set();
	function frame(now) {
		if (!running) return;
		requestAnimationFrame(frame);
		try { tick(now); } catch (err) {
			const key = String(err?.message || err);
			if (!seenErr.has(key)) { seenErr.add(key); console.error('[frame]', err); }
			try { renderer.render(scene, camera); } catch { /* nothing more to do this frame */ }
		}
	}
	// the right-hand column: whichever of its buttons are showing sit one under another with
	// no gaps (fly, drive, the ship, ×3, places, games come and go with what you are doing)
	let stackT = 0;
	function stackSidebar() {
		const now = performance.now();
		if (now < stackT) return;
		stackT = now + 250;
		const col = [...dom.mount.children].filter((e) => e.tagName === 'BUTTON' && !e.hidden && e.style.right.startsWith('calc(12px') && e.style.position === 'absolute' && /^calc\(\d+px/.test(e.style.top));
		for (const e of col) if (!e.dataset.slot) e.dataset.slot = parseInt(e.style.top.slice(5), 10);
		let i = 0;
		for (const e of col.sort((a, b) => a.dataset.slot - b.dataset.slot)) {
			if (e.style.display === 'none' || getComputedStyle(e).display === 'none') continue;
			const top = `calc(${12 + i * 52}px + env(safe-area-inset-top))`;
			if (e.style.top !== top) e.style.top = top;
			i++;
		}
	}
	function tick(now) {
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
		last = now;
		if (!visible || !world || document.hidden) return;
		// on a phone the world holds still while someone thinks of a reply: the model and
		// the world share the GPU and the page's memory
		if (isPhone && guide.llm?.busy?.()) return;
		time += dt;
		shared.uTime.value = time;
		stepWind(dt, shared);
		const W = world;
		// driving a road carries you; otherwise you walk, swim or fly
		// (a minigame has the screen and the camera while it runs)
		if (arcade.active()) drive.stop();
		else if (W.boardwalk?.ride(dt, time)) drive.stop();
		else if (studio.active()) { /* in the chair: the studio holds the camera */ }
		else if (!carjack.update(dt, time) && !drive.update(dt)) W.player.update(dt, time);
		you.update(dt, time);
		// a director's camera (trailer/): posed after the player moves, before anything reads it
		HOOKS.cine?.(camera, dt, time);
		W.fields?.update(dt, camera);
		arcade.update(dt, time, !W.boat?.boarded?.() && !W.boardwalk?.riding());
		stampPrints(W.player.state);
		W.boat.update(dt, time);
		const sk = W.sky.update(dt, camera.position);
		W.boardwalk?.update(dt, time, camera, sk.night, W.sky.state.hours);
		// the weather: frames running slow shed rain streaks; indoors the rain stays out
		W.weather.state.sheltered = !!W.houses?.inside(camera.position) || (W.underworld?.inside() || 0) > 0.4;
		const wx = W.weather.update(dt, W.sky, camera, (x, z) => W.island.heightAt(x, z), { slow: frameAvg > 26 });
		surprises.update(dt, sk, wx);
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
		W.volcano?.update(dt, time);
		W.alien?.update(dt, time);
		W.dwellings?.update(dt, camera.position);
		W.medieval?.update(dt, time, sk);
		W.caverns.update(dt, time, under);
		W.underworld?.update(dt, time);
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
			// on Earth the coast is always in view from the island: only a light sea haze close in
			const openK = W.bayArea?.loaded() ? Math.max(0.9, THREE.MathUtils.smoothstep(dI, 2500, 9000)) : 0;
			scene.fog.density = THREE.MathUtils.lerp(0.00026, 0.000024 + Math.max(0, 0.00001 * (1 - camera.position.y / 600)), openK);
			// rain closes the distance in; the coast south of Half Moon Bay is kept crystal
			// clear, the air over the bluffs washed clean by the wind off the sea
			const lat = 37.76 - camera.position.z / 110996, lon = camera.position.x / (111320 * Math.cos(37.76 * Math.PI / 180)) - 122.57;
			const clearK = THREE.MathUtils.smoothstep(lat, 37.5, 37.44) * THREE.MathUtils.smoothstep(lat, 37.02, 37.1) * THREE.MathUtils.smoothstep(lon, -122.2, -122.3);
			scene.fog.density *= (1 + (wx.rainHere * 12 + wx.gloom * 1.5) * (1 - clearK * 0.8)) * (1 - clearK * 0.55);
			// another world's air: dust, ash, spores, mist
			scene.fog.density *= W.island.profileHaze || 1;
			const far = THREE.MathUtils.lerp(16000, 110000, openK), nearP = openK > 0.5 ? THREE.MathUtils.clamp((camera.position.y - Math.max(0, W.island.heightAt(camera.position.x, camera.position.z))) * 0.01, 0.25, 2) : 0.25;
			if (Math.abs(camera.far - far) > far * 0.02 || Math.abs(camera.near - nearP) > 0.05) { camera.far = far; camera.near = nearP; camera.updateProjectionMatrix(); }
		}
		// down in a planet's caves the daylight is gone: the glow, the lamps and the lava light it
		const caveK = W.underworld?.inside?.() || 0;
		// deep down the surface overhead is never seen: stop drawing it
		const open = caveK < 0.9;
		if (W.underworld) for (const o of [W.terrain, W.ocean, W.grass, W.turf, W.vegetation.group, W.distant?.group, W.alien?.group]) { const v = open && (o !== W.ocean || seaLook.on); if (o && o.visible !== v) o.visible = v; }
		if (caveK > 0) {
			const dim = 1 - caveK * 0.96;
			W.sky.hemi.intensity *= dim; W.sky.sun.intensity *= dim * dim;
			shared.uAmbient.value.multiplyScalar(dim);
			const cg = W.underworld.fog?.() || [0.02, 0.022, 0.026];
			scene.fog.color.lerp(new THREE.Color(cg[0], cg[1], cg[2]), caveK);
			scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, 0.012, caveK);
		}
		// the cities' glow washes out the faint stars
		if (W.bayArea?.loaded()) {
			let glow = 0;
			for (const [dx, dz] of GLOW_AT) glow += W.bayArea.urbanAt(camera.position.x + dx, camera.position.z + dz).u;
			shared.uSkyGlow.value += (Math.min(1, glow / 4) - shared.uSkyGlow.value) * Math.min(1, dt);
		}
		if (under !== frame.under) { frame.under = under; dom.veil.style.opacity = under ? '1' : '0'; }
		const dazed = W.shrooms?.muffle() || 0;
		if (under || dazed > 0 || muffle.k > 0.01) underwaterAudio(under ? Math.min(1, 0.75 + (surf - camera.position.y) * 0.03) : dazed, dt);
		const sh = W.shells.update(dt, time);
		const show = (el, on) => { const d = on ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d; };
		show(dom.shell, sh === 'near' && !W.boat.boarded()); show(dom.toss, sh === 'held'); show(dom.place, sh === 'held');
		actions();
		for (const o of [W.terrain, W.ocean, W.grass, W.turf]) o.userData.update(camera);
		seaView(W, camera, dt, open);
		W.litter.update(camera);
		islandReach(W);
		W.vegetation.stream(camera, false);
		W.village.update(time, sk.night);
		W.cottages?.update(camera.position, dt);
		// the old far islands and hill town belong to other worlds; on Earth the real coast is there
		W.distant.group.visible = !W.bayArea;
		if (!W.bayArea) W.distant.update(time, sk.night);
		W.fauna.update(time, sk.night, camera.position);
		W.landFauna.update(dt, time, sk.night, camera.position, camera.position.y > -0.5);
		W.bayArea?.update(camera, sk.night);
		W.globe?.update(dt, camera, sk.night);          // globe: the Earth past the Bay (may move the frame, and you with it)
		W.bridge?.update(time, sk.night);
		W.civ?.update(camera);
		if (W.civ) { const ll = globeLL(camera.position.x, camera.position.z); earthDirector.update(ll.lat, ll.lon, dt); }
		W.real?.update(camera);
		W.diablo?.update(dt, time, camera, sk.night);
		W.landmarks?.update?.(dt, camera);
		W.city?.update(camera, sk.night);
		W.forestFloor?.update(camera);
		W.edge?.update(dt, time, camera, sk.night);
		W.houses?.update(camera, dt, sk.night);
		if (W.commercial) {
			W.commercial.update(camera, dt, W.sky.state.hours, sk.night);
			W.towers?.update(dt, camera, W.sky.state.hours, sk.night);
			W.interiors?.update(camera, dt, W.sky.state.hours, sk.night);
			// stepping into a place: what it is, and how busy at this hour
			const inB = W.commercial.inside(camera.position);
			if (inB && inB !== W.bizSeen) {
				const NAME = { cafe: 'Café', restaurant: 'Restaurant', shop: 'Shop', tattoo: 'Tattoo parlor · T to design your own', office: 'Office lobby', arcade: 'Arcade', bowling: 'Bowling alley', cinema: 'Cinema' };
				const n = (inB.spots || []).filter((q) => q.taken).length;
				hint(`${NAME[inB.type]}${n < 1 ? ' · quiet at this hour' : n > inB.seats.length * 0.35 ? ' · busy' : ''}`, 3000);
			}
			W.bizSeen = inB;
			inkBtn.style.display = inB?.type === 'tattoo' && !studio.active() ? '' : 'none';
		}
		// indoors by day the eye opens up to the light from the windows
		indoorK += ((W.houses?.inside(camera.position) || W.interiors?.inside(camera.position) ? 1 : 0) - indoorK) * Math.min(1, dt * 1.2);
		renderer.toneMappingExposure *= 1 + indoorK * (0.15 + 0.4 * sk.dayK);
		watchDoor(dt);
		sunGlare(dt);
		watchTeleport();
		share.update(dt);
		stackSidebar();
		// where you are, kept every few seconds so a reload carries on from here
		if (visible && !arcade.active()) share.keep();
		W.street?.update(dt, time, camera, sk.night);
		W.vehicles?.update(dt, time);
		ragdolls.update(dt);
		W.berms?.update(camera);
		W.freeways?.update(camera);
		W.lake?.update(dt, time, camera, sk.night);
		W.water?.update(dt, time, camera, sk.night);
		if (W.tidepools) {
			W.tidepools.update(dt, time, camera);
			// arriving on a reef: what to look for
			const tp = camera.position.y < 60 ? W.tidepools.siteAt(camera.position.x, camera.position.z) : null;
			if (tp && tp !== W.tpSeen) hint(`${tp.name}\nLow tide: look in the pools for ochre sea stars, green anemones and purple urchins${tp.seals ? '. Harbor seals haul out on the outer rocks.' : '.'}`, 7000);
			if (tp) W.tpSeen = tp;
		}
		W.wildlife?.update(dt, time, camera, W.sky.state.hours);
		if (W.parks) {
			W.parks.update(dt, camera);
			const pk = camera.position.y - W.island.heightAt(camera.position.x, camera.position.z) < 80 ? W.parks.parkAt(camera.position.x, camera.position.z) : null;
			if (pk && pk !== W.parkSeen) hint(`${pk.name}\n${pk.note}`, 8000, 1);
			if (pk) W.parkSeen = pk;
		}
		if (W.discovery) {
			W.discovery.update(dt, camera);
			const at = W.discovery.where(camera.position);
			if (at && at !== 'campus' && at !== W.museumSeen) {
				const open = W.discovery.busy(W.sky.state.hours, new Date().getDay()) > 0;
				hint({
					main: 'Bay Area Discovery Museum\nTot Wetlands, the Art Studio and Discovery Hall\'s climbing tower',
					cafe: 'The museum café\nCoffee for the grown-ups, snacks for the small ones',
					cove: 'Lookout Cove\nA little Golden Gate, a shipwreck, a fishing boat and tide pools to climb about',
				}[at] + (open ? '' : '\nClosed now: open Tuesday to Sunday, 9 to 5'), 7000, 1);
			}
			if (at) W.museumSeen = at;
		}
		if (W.beaches) {
			W.beaches.update(dt, time, camera, sk.night);
			const bc = camera.position.y < 150 ? W.beaches.beachAt(camera.position.x, camera.position.z) : null;
			if (bc && bc !== W.beachSeen && !W.tidepools?.siteAt(camera.position.x, camera.position.z)) hint(`${bc.name}${bc.quiet ? '\nA quiet stretch: few people, the sound of the surf.' : bc.big ? '\nMavericks breaks half a mile out, in winter the biggest waves on the coast.' : bc.surf ? '\nSurf zone between the checkered flags.' : bc.tents ? '\nCampsites along the back of the beach.' : ''}`, 6000);
			if (bc) W.beachSeen = bc;
		}
		if (arcade.active()) fishing.drop();
		fishing.update(dt, time, !arcade.active() && !W.player.state.flying && !drive.active() && !W.boat.boarded() && camera.position.y > -0.3);
		W.roads?.update(time, sk.night);
		guide.update(dt);
		watchTalk(dt);
		people.update(dt, time, camera.position, sk.night, camera.position.y > -0.5);
		people.demo(dt, time, camera.position);
		ghost.update(dt, time, camera, sk.night);
		W.citySound?.update(dt, camera, { night: sk.night, cars: W.street?.cars, people: people.pool, steps: people.steps, player: W.player.state, under, islandHalf: W.island.half, indoors: !!W.weather.state.sheltered, rain: wx.rainHere || 0, hours: W.sky.state.hours });
		// (your footsteps keep the music's time: player.js)
		if (!W.player.state.beat) W.player.state.beat = () => autoMusic.clock();
		worldAudio.update(dt, { under, night: sk.night, hours: W.sky.state.hours, rain: wx.rainHere || 0 });
		if (W.natureSound && W.bayArea?.loaded()) {
			const cx = camera.position.x, cz = camera.position.z, U = W.bayArea.urbanAt(cx, cz);
			let pond = 1e9;
			if (W.lake) for (const r of [20, 60, 110]) { for (let k = 0; k < 8 && pond > 1e8; k++) { const a = k / 8 * Math.PI * 2; if ((W.lake.waterAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r) ?? W.water?.waterAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r)) != null) pond = r; } if (pond < 1e8) break; }
			// (anyone about within 150 m: out alone long enough, the wolves)
			let company = 0;
			for (const q of people.pool) if (q.active && Math.hypot(q.M.S.pos.x - cx, q.M.S.pos.z - cz) < 150) company++;
			W.natureSound.update(dt, camera, { company, wind: shared.uWind?.value, gust: shared.uGust?.value, night: sk.night, hours: W.sky.state.hours, month: today().getMonth() + 1, fog: wx.gloom || 0, under, islandHalf: W.island.half, pond, indoors: !!W.weather.state.sheltered, rain: wx.rainHere || 0, town: U ? Math.max(0, (U.u - 0.1) / 0.5) : 0 });
		}
		W.labels?.update(dt, time, camera.position, Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z)) < W.island.half);
		// a mushroom eaten: sizes swell and shrink (the field of view, from where it stood), and
		// the frame is drawn through its effect; sober, it draws nothing and the frame is as ever
		W.shrooms?.update(dt, time);
		const fovK = arcade.active() ? 1 : W.shrooms?.fov() ?? 1;
		if (fovK !== 1 && !tick.fov0) tick.fov0 = camera.fov;
		if (tick.fov0) { camera.fov = tick.fov0 * fovK; camera.updateProjectionMatrix(); if (fovK === 1) tick.fov0 = 0; }
		W.rays?.update(dt, camera, { W, wx, caveK, under, hours: W.sky.state.hours, frameMs: frameAvg });
		if (!W.shrooms?.render(renderer, scene, camera)) { renderer.render(scene, camera); W.rays?.post(); }
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
		// the ×3 boost shows while flying, lit when on
		const bd = W.player.state.flying ? '' : 'none', bb = W.player.state.boost ? '#01a982' : 'rgba(8,20,26,.55)';
		if (dom.boost.style.display !== bd) dom.boost.style.display = bd;
		if (dom.boost.style.background !== bb) dom.boost.style.background = bb;
		if (!W.player.state.flying) W.player.state.boost = false;
		const L = origin && !window.L99Journey170?.busy?.() ? 'flex' : 'none';
		if (dom.launch.style.display !== L) dom.launch.style.display = L;
	}
	let origin = null;   // the planet flight landed us from, if any
	let launchedAt = null;   // globe: where on Earth you launched from, when far from the Bay
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
		hint(P.flying ? (isPhone ? 'Flying: steer with the left thumb, look with the right. ⇡ ⇣ to climb and sink.' : 'Flying: WASD moves where you look, Space climbs, C sinks, Shift is fast, B for ×3. F to land.') : 'Landing.', 3500);
	}
	dom.fly.addEventListener('click', (e) => { e.stopPropagation(); toggleFly(); });
	dom.boost.addEventListener('click', (e) => { e.stopPropagation(); const P = world?.player.state; if (P?.flying) { P.boost = !P.boost; hint(P.boost ? 'Flying ×3.' : 'Normal speed.', 1500); } });
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
		// the ship and this world never both fill the phone's memory: keep your place, let the
		// world go behind the veil, then fly (landing builds it again; a failed launch rebuilds here)
		const yaw = world.player.state.yaw;
		// globe: launching far from the Bay, the ship brings you back down there
		{ const ll = globeLL(camera.position.x, camera.position.z); launchedAt = world.globe && bayKm(ll.lat, ll.lon) > BAY_WILD_KM ? ll : null; }
		share.keep(true);
		travelVeil.textContent = 'Launching…';
		travelVeil.style.opacity = '1';
		await new Promise((r) => setTimeout(r, 260));
		teardown();
		try {
			const ok = await J.request(REALM, 'flight', { kind: 'atmosphere', planet: origin, altitude: 420, piloting: true, yaw, pitch: 0.25, velocity: [0, 0, 0], fov: 72 });
			if (!ok) throw new Error('the ship is not ready');
		} catch (err) {
			// no launch: back to exactly where you were
			console.warn('[launch]', err);
			hint('The ship is not ready yet. Try again in a moment.');
			const c = share.resumeCode();
			await (c ? share.openAt(c, { resume: true }) : api.open(origin?.earth ? { seed: 1337, earth: true } : { seed: origin.seed, biome: origin.type, earth: false, origin }));
		} finally { dom.launch.disabled = false; travelVeil.style.opacity = '0'; }
	});
	dom.gear.onclick = (e) => { e.stopPropagation(); dom.panel.style.display = dom.panel.style.display === 'block' ? 'none' : 'block'; };
	for (const el of [dom.back, dom.jump, dom.gear, dom.panel, dom.act, dom.launch, dom.fly, dom.boost, dom.down, dom.shell, dom.toss, dom.place]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());

	const worldOf = (planet) => ({ seed: (planet.seed >>> 0) || hashString(String(planet.id || 'island')), biome: planet.type || 'tropical', earth: planet.earth === true });
	const api = {
		T: THREE, REALM,
		async open(params = {}) {
			// on Earth the ship waits in orbit: ⇪ always has somewhere to go
			origin = params.origin || (params.earth !== false ? EARTH_ORIGIN : null);
			show();
			await build(params);
			if (params.earth !== false && params.at) HOOKS.goTo(params.at.lat, params.at.lon);      // globe: straight to a place
			api.link();
			hint(isPhone ? 'Left thumb to walk, right thumb to look. ✈ to fly, ☀ for the sky.' : 'WASD to walk, drag to look, Space to jump, F to fly. ☀ for the sky.');
			return true;
		},
		close() {
			hide();
			window.L99IslandDoor?.closed?.();
		},
		active: () => visible && running,
		// walking or riding a road hands-free: the keyboard plays music meanwhile
		autoWalk: () => visible && running && !!drive.auto?.(),
		world: () => world,
		// open straight at a shared spot (?at=... from index.html); a bad link opens as usual
		openAt: (code) => share.openAt(code),
		// back to the last place you were (after a crash or a reload); false if there is none
		resume: () => { const c = share.resumeCode(); return c ? share.openAt(c, { resume: true }) : false; },
		// flight's landing builds the world here first, out of sight, so Journey's own clock
		// only covers the hand-over (a slow phone building the Bay Area outran it, and the
		// failed passage left you on the old flight surface)
		warm: async (planet = {}) => { await build(worldOf(planet)); return true; },
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
			await build(worldOf(planet));
			// globe: a landing that names a place on Earth comes down there; one back from a launch far
			// off comes down where it left
			if (planet.earth) { const at = planet.at || launchedAt; launchedAt = null; if (at && Number.isFinite(at.lat)) HOOKS.goTo(at.lat, at.lon, 900); }
			check?.();
			for (let i = 0; i < 6; i++) { world.player.update(0.016, time); world.sky.update(0.016, camera.position); world.vegetation.stream(camera, true); renderer.render(scene, camera); await new Promise((r) => requestAnimationFrame(r)); check?.(); }
		},
		align: async (packet) => { world.player.state.pitch = Math.max(-0.4, Math.min(0.3, packet.pitch || 0)); world.player.update(0, time); },
		pose: () => ({ yaw: world?.player.state.yaw || 0, pitch: world?.player.state.pitch || 0, velocity: [0, 0, 0], fov: camera.fov }),
		render: () => renderer.render(scene, camera),
		resize,
		activate: () => show(),
		park: () => hide(),
		arrived: () => hint(state.earth ? 'Earth. An island off the Golden Gate: fly or sail east to reach San Francisco.' + (origin ? ' ⇪ returns you to your ship.' : '') : (() => { const P = shared.planet, what = P && P.type !== 'TROPICAL' ? `You come down on a ${P.name}. Its caves go deep: look for the dark mouths in the hills.` : 'You come down on a tropical shore.'; return what + (origin ? ' ⇪ returns you to your ship.' : ''); })(), 6000),
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

// the sea is only drawn where some of it is within reach: far inland (the Diablo foothills,
// the Sierra) a look round every couple of seconds, out to 40 km on sixteen bearings, finds
// none, and the ocean under the whole map stops being drawn (its waves, its shading)
const seaLook = { t: 0, on: true };
function seaView(W, camera, dt, open) {
	if (!W.bayArea?.loaded() || !open) return;
	seaLook.t -= dt;
	if (seaLook.t > 0) return;
	seaLook.t = 2;
	const x = camera.position.x, z = camera.position.z;
	let sea = W.island.heightAt(x, z) < 2;
	for (let k = 0; k < 16 && !sea; k++) {
		const a = k / 16 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
		for (const r of [300, 800, 1600, 3000, 5500, 9000, 14000, 20000, 28000, 40000]) if (W.island.heightAt(x + c * r, z + sn * r) < -1.5) { sea = true; break; }
	}
	seaLook.on = sea;
	if (W.ocean.visible !== sea) W.ocean.visible = sea;
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
		// the child in the woods (people/ghost.js): very rare; this calls her now
		ghost: (at) => HOOKS.ghost?.(at),
		ghostInfo: () => HOOKS.ghostInfo?.(),
		// the mushrooms (planet/mushrooms.js): Crysis.trip('psilocybe'), or from a moment in
		// (seconds in): Crysis.trip('amanita', 90); Crysis.tripInfo() tells where it is
		trip: (kind, at) => window.L99Island?.world?.()?.shrooms?.eat(kind, at != null ? { at: +at } : undefined),
		tripInfo: () => window.L99Island?.world?.()?.shrooms?.state(),
		creatures: () => HOOKS.creatures?.(),
		// the buildings built inside round you (interiors/): Crysis.interiors() tells how they stand,
		// Crysis.interiorGo('row') takes you to the front door of one ('shop', 'apt', 'warehouse'...)
		interiors: () => window.L99Island?.world?.()?.interiors?.info() ?? 'none here',
		interiorGo: (use, i = 0, room = null) => { const w = window.L99Island?.world?.(); return w?.interiors?.goTo(w.player.state, use, i, room) ?? 'none here'; },
		// the caves of another world: Crysis.caves() lists the mouths, Crysis.cave(i) takes you into one
		caves: () => window.L99Island?.world?.()?.underworld?.entrances || [],
		cave: (i = 0) => window.L99Island?.world?.()?.underworld?.go(i),
		// the alien works (planet/alien.js): Crysis.alien() lists the sites, Crysis.alienGo(i) takes you to look at one
		alien: () => window.L99Island?.world?.()?.alien?.sites || [],
		alienGo: (i = 0) => window.L99Island?.world?.()?.alien?.go(i) || 'no alien works on this world',
		// a realm of castles (planet/medieval/): Crysis.medieval() tells of it, Crysis.medieval('castle')
		// goes to look (castle, realm, gate, keep, wall, town, square, chapel, windmill, bridge, barrow…);
		// Crysis.quests() lists its quests; Crysis.dungeon(i) goes down into one ('stair', 'last' or
		// 'breach', where it meets the caves, as a second argument)
		medieval: (where) => { const m = window.L99Island?.world?.()?.medieval; return !m ? 'no realm on this world' : where ? m.go(where) : m.info(); },
		quests: () => window.L99Island?.world?.()?.medieval?.quests.info() || 'no realm on this world',
		dungeon: (i = 0, where) => window.L99Island?.world?.()?.medieval?.dungeonGo(i, where) || 'no realm on this world',
		// a volcanic world's eruptions (planet/volcano.js): Crysis.erupt() starts one now (or
		// from a moment in: Crysis.erupt(30)),
		// Crysis.volcano() tells where the cycle is ({ phase, next: seconds to the next, k })
		erupt: (at) => window.L99Island?.world?.()?.volcano?.erupt(at) || 'no volcano on this world',
		volcano: () => window.L99Island?.world?.()?.volcano?.state() || null,
		// sunbeams in the mist (world/sunrays.js): Crysis.rays() tells how they stand; 'on', 'off',
		// 'force' (whatever the hour and the trees), a strength (1 is as made), or { burst: false }
		rays: (v) => window.L99Island?.world?.()?.rays?.control(v) ?? 'no world yet',
		grid: { toGrid: gridTo, fromGrid: gridFrom, BLOCKS: gridBlocks },
		// knock someone over: Crysis.ragdoll(P, { vel, mass, point, lift }); Crysis.ragdolls() tells how many
		ragdoll: (P, how) => HOOKS.ragdolls?.hit(P, how),
		ragdolls: () => HOOKS.ragdolls?.info(),
		// take the car beside you off its driver (as E does); Crysis.jackable() tells if there is one
		jack: () => HOOKS.carjack?.begin(),
		jackable: () => !!HOOKS.carjack?.candidate(),
		// see yourself (as P does), shove (as X does)
		thirdPerson: () => HOOKS.self?.toggle(),
		shove: () => HOOKS.self?.shove(),
		// (tests: run the fallen on by n steps of 1/60 s)
		ragdollStep: (n = 1) => { for (let i = 0; i < n; i++) HOOKS.ragdolls?.update(1 / 60); return HOOKS.ragdolls?.info(); },
		// drive the roads: Crysis.drive.start(), .stop(), .state
		drive: { start: () => HOOKS.drive?.start(), stop: () => HOOKS.drive?.stop(), update: (dt) => HOOKS.drive?.update(dt), options: () => HOOKS.drive?.debugOptions(), physics: () => HOOKS.drive?.physics?.(), get state() { return HOOKS.drive?.state; } },
		// the hills' season: 0 spring green .. 1 summer gold
		season: (v) => { if (v !== undefined) REAL_U.uSeason.value = Math.max(0, Math.min(1, +v)); return REAL_U.uSeason.value; },
		// the month the world keeps: 0 today's, 1..12 that month
		month: (m) => { if (m !== undefined) pickMonth(m); return monthPicked(); },
		// the tattoo studio, wherever you are
		tattoo: () => { HOOKS.tattoo?.(); return 'Tattoo studio'; },
		tattooInfo: () => HOOKS.tattooInfo?.(),
		bloom: (v) => { if (v !== undefined) REAL_U.uBloom.value = Math.max(0, Math.min(1, +v)); return REAL_U.uBloom.value; },
		// share where you are: Crysis.share() (a link and a line of text), Crysis.share({ silent: true, from: 'Sam' })
		share: (opts) => HOOKS.share?.share(opts),
		openAt: (code) => HOOKS.share?.openAt(code),
		// homes kept in this browser: Crysis.homes.list(), .add(name), .go(i or id), .rename(id, name), .remove(id)
		homes: { list: () => HOOKS.share?.homes(), add: (name) => HOOKS.share?.addHome(name), go: (i) => HOOKS.share?.goHome(i), rename: (id, n) => HOOKS.share?.renameHome(id, n), remove: (id) => HOOKS.share?.removeHome(id), here: () => HOOKS.share?.building(window.L99Island?.world?.()?.player.state.pos, true) },
		// (a home set by lat/lon here still works: it joins the homes list)
		setHome: (lat, lon, name = 'Home') => { localStorage.setItem('crysis-home', JSON.stringify({ lat: +lat, lon: +lon, name })); HOOKS.share?.refresh(); return 'Home set. Crysis.goHome() takes you there.'; },
		clearHome: () => { localStorage.removeItem('crysis-home'); HOOKS.share?.refresh(); return 'Home cleared.'; },
		goHome: (i = 0) => {
			if (HOOKS.share?.homes().length) { HOOKS.share.goHome(i); return 'Home.'; }
			let h = null; try { h = JSON.parse(localStorage.getItem('crysis-home') || 'null'); } catch { /* no home stored */ }
			const w = window.L99Island?.world?.();
			if (!h || !w?.bayArea?.loaded()) return h ? 'The Bay Area is still loading.' : 'Set it first: Crysis.setHome(lat, lon)';
			const p = toWorld(h.lat, h.lon), P = w.player.state;
			P.flying = true; P.diving = false; P.pos.set(p.x - 40, w.island.heightAt(p.x, p.z) + 60, p.z + 40); P.yaw = Math.atan2(-40, 40); P.pitch = -0.5;
			return 'Home.';
		},
		// a secret or two: Crysis.fireworks(), Crysis.verses()
		fireworks: () => { HOOKS.surprises?.fireworks(); return '✦'; },
		verses: () => HOOKS.surprises?.verses(),
		get surprises() { return HOOKS.surprises; },
		get fishing() { return HOOKS.fishing; },
		// the Santa Cruz Beach Boardwalk: Crysis.boardwalk() tells how it stands, Crysis.ride('dipper')
		// (or 'wheel', 'bumper', 'carousel', 'glider', 'drop') takes you aboard
		boardwalk: () => window.L99Island?.world?.()?.boardwalk?.info() ?? 'No Boardwalk on this world.',
		ride: (name = 'dipper') => window.L99Island?.world?.()?.boardwalk?.rideNow(name) ?? 'No Boardwalk on this world.',
		// the minigames: Crysis.arcade.start('bowling'), .stop(), .games()
		get arcade() { return HOOKS.arcade; },
		// auto music: Crysis.music.auto(true), .state(), .log(true), .level(0.5), .queue('chorus')
		music: { auto: (on) => HOOKS.autoMusic?.auto(on), state: () => HOOKS.autoMusic?.state(), log: (on) => HOOKS.autoMusic?.log(on), level: (v) => HOOKS.autoMusic?.level(v), queue: (to, now) => HOOKS.autoMusic?.queue(to, now) },
		surprisesDbg: () => { const S = HOOKS.surprises; return S ? { busy: S.fw.busy(), n: S.fw.count(), ...S.fw.dbg() } : 'none'; },
		// the world's audio: Crysis.audio() (surface, room, beds, levels), .set({ amb, feet, steps }), .record(s)
		audio: Object.assign(() => HOOKS.audio?.debug(), { set: (v) => HOOKS.audio?.set(v), record: (s) => HOOKS.audio?.record(s), tick: (dt, o) => HOOKS.audio?.tick(dt, o) }),
		// the trailer's camera: Crysis.cine((camera, dt, time) => { ... }) poses it every frame; Crysis.cine() lets go
		cine: (fn) => { HOOKS.cine = typeof fn === 'function' ? fn : null; return !!HOOKS.cine; },
		// the Earth atlas and the city director (earth/): Crysis.atlas(lat, lon) tells what a place
		// is like (here, with no arguments); Crysis.brief('Lisbon') gives a city's brief (a promise);
		// Crysis.earth() how the director stands. The people can read chatter from earth/hub.js.
		atlas: (lat, lon) => { if (lat == null) { const p = window.L99Island?.world?.()?.player?.state?.pos; const ll = p ? globeLL(p.x, p.z) : { lat: 37.77, lon: -122.42 }; lat = ll.lat; lon = ll.lon; } return HOOKS.earth?.describe(+lat, +lon); },
		brief: (name) => HOOKS.earth?.briefFor(name),
		earth: () => HOOKS.earth?.info(),
		// the globe (earth/globe.js): Crysis.globe() where you are on it and how it streams;
		// Crysis.goTo(lat, lon) flies you there, anywhere on Earth
		globe: () => window.L99Island?.world?.()?.globe?.info() ?? 'Earth only.',
		goTo: (lat, lon, agl) => HOOKS.goTo?.(lat, lon, agl) ?? 'Earth only.',
		ecology: () => { const w = window.L99Island?.world?.(); return w?.eco ? describeLand(w.land) + '\n\n' + describe(w.eco) : 'no world open'; },
	};
}
