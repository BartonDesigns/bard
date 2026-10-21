// Building a world, moved out of main.js's createIslandWorld: its ground and water, the plans for
// its fields, colonies and towns, everything that lives on it and the floors they share, a stage at
// a time under the loading screen.
// The rest of what it uses from main.js's createIslandWorld comes from iw at the top, once per
// call; none of it changes after the world is set up. A name not yet there needs a getter in
// main.js's iw (island/tools/split-contexts.test.mjs checks).
// What changes as the game runs it reaches through iw: arrival, drive, running, visible, world. It
// sets world.

import { createSoulWell } from './planet/soul-well.js';
import { createBiomes } from './planet/biomes.js';
import { planetProfile } from './planet/profile.js';
import * as THREE from 'three';
import { generateIsland } from './world/islandgen.js';
import { makeHeightTexture, makeMaskTexture, createTerrain } from './world/terrain.js';
import { createOcean } from './world/ocean.js';
import { createSky } from './world/sky.js';
import { createWeather } from './world/weather.js';
import { createSunRays } from './world/sunrays.js';
import { createSpray } from './world/spray.js';
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
import { planDeep, createDeep } from './planet/deep.js';
import { planCaves, makeField } from './planet/cavenet.js';
import { createReef } from './reef.js';
import { buildEcology } from './crysis/ecology.js';
import { createFish } from './crysis/fish.js';
import { createInverts } from './crysis/inverts.js';
import { buildLandEcology } from './crysis/land.js';
import { createLandFauna } from './crysis/landfauna.js';
import { bayUniforms, createBayArea } from './bay/terrain.js';
import { createGoldenGate } from './bay/bridge.js';
import { createLabels } from './bay/labels.js';
import { createCity } from './bay/city.js';
import { createHouses } from './bay/houses.js';
import { createStreetLife } from './bay/streetlife.js';
import { createFreeways } from './bay/freeways.js';
import { createStreets } from './bay/streets.js';
import { createLake } from './bay/lake.js';
import { createEarthWater } from './bay/earthwater.js';
import { createWater } from './bay/water.js';
import { planWaters } from './planet/waters.js';
import { createTidepools } from './bay/tidepools.js';
import { createSaltPonds } from './bay/saltponds.js';
import { createBeaches } from './bay/beaches.js';
import { createParkKit } from './bay/parkkit.js';
import { createDiscovery } from './bay/discovery.js';
import { qualityNow } from './world/governor.js';
import { createBoardwalk } from './bay/boardwalk.js';
import { createTowers } from './bay/towers.js';
import { createForestFloor } from './bay/forestfloor.js';
import { createCommercial } from './bay/commercial.js';
import { createInteriors } from './interiors/index.js';
import { createStructures } from './structures/index.js';
import { createServices } from './services/index.js';
import { createContact } from './bay/contact.js';
import { createCottageInteriors } from './interiors/cottage.js';
import { planDwellings, createDwellings } from './interiors/alien.js';
import { createWildlife } from './bay/wildlife.js';
import { planIslandFields, createSportsFields } from './sportsfields.js';
import { createBerms } from './bay/berms.js';
import { createCitySound } from './bay/citysound.js';
import { createNatureSound } from './bay/naturesound.js';
import { createRealCity } from './bay/realcity.js';
import { createCivilization } from './crysis/civ.js';
import { createDiablo } from './bay/diablo.js';
import { createEdgelands } from './bay/edgelands.js';
import { createVehicles } from './vehicles/index.js';
import { createLandmarks } from './bay/landmarks.js';
import { createSanMateoBridge } from './bay/sanmateo.js';
import { createRoads, ROUTES } from './bay/roads.js';
import { toWorld } from './bay/geo.js';
import { createGlobe, BAY_WILD_KM } from './earth/globe.js';
import { toLL as globeLL, F as globeF, bayKm } from './earth/globeframe.js';
import { addLife } from './people/people.js';
import { createDailyLife } from './economy/daily-life.js';
import { waterContact } from './world/water-contact.js';
import { createMushrooms } from './planet/mushrooms.js';
import { createVolcano } from './planet/volcano.js';
import { planAlien, createAlien } from './planet/alien.js';
import { planColony } from './planet/colony/plan.js';
import { createColony } from './planet/colony/colony.js';
import { planArch } from './planet/arch/plan.js';
import { createArch } from './planet/arch/arch.js';
import { planRealm, planDungeons } from './planet/medieval/plan.js';
import { createMedieval } from './planet/medieval/realm.js';
import { createOrbitalFlight } from './space/flight.js';
import { worldBody, sameBody } from './space/body.js';
import { createKinetic } from './music/kinetic.js';
import { createSignage } from './signage/index.js';
import { createFloaters } from './planet/floaters.js';
import { createBeyond } from './planet/beyond.js';
import { createPlumes, ambientPlumes } from './world/plumes.js';
import { createPowerlines } from './world/powerlines.js';
import { createContrails } from './world/contrails.js';
import { createFlush } from './world/flush.js';
import { createFarForest } from './world/farforest.js';

export async function islandBuild(iw, params) {
	const { actions, arms, arriving, buildPanel, button, camera, dom, earthDirector, fishing, fitShadow,
		GFX, guide, hint, HOOKS, isPhone, KICK, people, picnic, renderer, scene, seaDepth, seaLifeVisibility,
		seaLook, shaderWarm, share, shared, social, soul, state, teardown, travel, underwaterAudio,
		updateFlightControls, voyage, worldAudio, yieldBuild } = iw;
	const seed = (params.seed >>> 0) || 1337;
	// Earth: the island in the Gulf of the Farallones with the real Bay Area round it.
	// Other worlds flight lands on are their own islands, alone in their seas.
	const earth = params.earth !== false;
	const body = worldBody(params);
	if (iw.world && sameBody(state.body, body)) return iw.world;
	if (iw.world) teardown();
	shared.uUnder.value = 0;
	seaLook.t = 0; seaLook.on = true;
	underwaterAudio(0, 1);
	camera.near = .25; camera.far = 16000; camera.updateProjectionMatrix();
	window.L99Loading.stage('Shaping the landscape');
	await new Promise((r) => requestAnimationFrame(r));
	// what kind of world: its ground, air, plants and underground (Earth's island is tropical)
	const profile = planetProfile(earth ? 'TROPICAL' : params.biome, seed);
	shared.planet = profile;
	const island = generateIsland({ seed, biome: params.biome, resolution: GFX ? 640 : 768, profile, land: earth ? 'island' : null });
	await yieldBuild('Planning the landscape');
	island.profileHaze = profile.air?.haze || 1;
	// the ball fields above the village (or the world's own arena): the ground levelled under them before anything is made of it
	const fieldPlan = planIslandFields(island, earth ? null : profile);
	// an off-world colony (the Moon's, a volcanic or toxic world's): its ground levelled and its roads worn in now
	const colonyPlan = earth ? null : planColony(island, profile, { avoid: fieldPlan.clear, isPhone: GFX });
	if (colonyPlan) fieldPlan.clear.push(...colonyPlan.clear);
	// a realm of castles and towns, where this world keeps one: sited now, the land shaped round it
	const realmPlan = earth ? null : planRealm(island, profile, { fields: fieldPlan.clear, isPhone: GFX });
	// a cliff settlement (planet/arch/): its houses seated on the cliff tops and its paths worn in now
	const archPlan = earth ? null : planArch(island, profile, { avoid: [...fieldPlan.clear, ...(realmPlan?.clear || [])], roads: realmPlan?.roads, isPhone: GFX });
	if (archPlan) fieldPlan.clear.push(...archPlan.clear);
	// the planet's second biome and its cold side, baked where the ground, plants and water can read it
	island.biomes = createBiomes(island, profile);
	// its streams and lakes (or ice, or lava), carved before its plants, caves and ruins are planned
	const waterPlan = earth || profile.airless ? null : await planWaters(island, profile, { clear: [...fieldPlan.clear, ...(realmPlan?.clear || [])], realm: realmPlan });
	if (waterPlan) island.inWater = waterPlan.inWater;
	(shared.uBiome ||= { value: null }).value = island.biomes.tex;
	shared.biHalf = island.half;
	shared.heightTex = makeHeightTexture(island);
	shared.maskTex = makeMaskTexture(island);
	await yieldBuild('Preparing the surroundings');
	const sky = createSky(scene, shared, renderer, { isPhone: GFX, earth, latitude: () => earth && iw.world?.globe ? globeLL(camera.position.x, camera.position.z).lat : 37.8 });
	try { if (localStorage.getItem('l99-conlines')) sky.lines(true); } catch { /* private mode */ }
	// weather: showers, cirrus, the rainbow's rain, lightning, all on the one wind
	const weather = createWeather(scene, shared, { isPhone: GFX, airless: !!profile.airless });
	sky.attach(weather);
	const terrain = createTerrain(island, shared);
	// the real Bay Area round the island: its heights are shared with the sea
	shared.bayU = bayUniforms();
	const ocean = createOcean(island, shared);
	// turf underfoot plus a longer-reaching layer
	// the reaching layer: out to about 55 m (40 on phones) before it melts into the ground
	const grass = createGrass(island, shared, GFX ? 15000 : 30000, GFX ? 90 : 124, { width: 0.5, seed: 99 });
	const turf = createGrass(island, shared, GFX ? 11000 : 18000, 20, { width: 0.34, height: 0.8, seed: 7 });
	scene.add(terrain, ocean, grass, turf);
	// An airless world (the Moon) is bare regolith: its sea, village, grass, plants and animals
	// are still made (the frame loop expects them) but held in a hidden group, out of reach.
	// (a world with no village, the hostile ones, holds just the village there)
	const bare = profile.airless || profile.noVillage ? new THREE.Group() : null;
	const stash = (make, always) => {
		if (!bare || !profile.airless && !always) return make();
		const had = new Set(scene.children), made = make();
		for (const o of [...scene.children]) if (!had.has(o) && o !== bare) bare.add(o);
		return made;
	};
	if (bare) { bare.visible = false; scene.add(bare); if (profile.airless) bare.add(ocean, grass, turf); }
	const litter = stash(() => createLitter(island, shared, scene, GFX ? 0.6 : 1));
	// Crysis: the land's plants and animals, grown from the seed
	const land = buildLandEcology(island.seed, { crowns: { boreal: ['columnar'], ash: ['columnar'], barren: ['columnar'], desert: ['umbrella', 'round'] }[profile.flora] });
	// a planet's caves are planned first, so nothing grows in their mouths
	const cavePlan = planCaves(island, profile);
	// ...and the realm's dungeons dug down to meet them
	if (realmPlan) planDungeons(realmPlan, island, cavePlan, makeField);
	// the Deep Gate (planet/deep.js): a carved hall at the end of a passage dug on toward the
	// summit, a sealed shaft with no bottom in its floor
	const deepPlan = cavePlan ? planDeep(island, cavePlan, makeField) : null;
	// the works of whoever built here before: sited now, so nothing grows on them
	const alienPlan = earth || realmPlan?.noAliens || profile.airless ? null : planAlien(island, profile, { holes: cavePlan?.holes, fields: [...fieldPlan.clear, ...(realmPlan?.clear || [])], isPhone: GFX });
	// (and the dwellings of whoever built them: interiors/alien.js)
	if (alienPlan) alienPlan.clear.push(...planDwellings(island, alienPlan));
	island.noPlant = [...(cavePlan?.holes || []), ...fieldPlan.clear, ...(alienPlan?.clear || []), ...(realmPlan?.clear || [])];
	const vegetation = createVegetation(island, shared, scene, land);
	const village = stash(() => createVillage(island, shared, scene, { profile, isPhone: GFX, camera }), true);
	if (bare) { village.footprints.length = 0; village.pickables.length = 0; }
	vegetation.addContacts(village.footprints);
	const distant = stash(() => createDistant(island, shared, scene));
	// columns of smoke and steam seen from afar: fires, wrecks, chimneys, stacks (world/plumes.js)
	const plumes = createPlumes(scene, shared, { isPhone: GFX });
	ambientPlumes(plumes, { island, profile, earth, realm: realmPlan });
	// pylons and their wires over the land (world/powerlines.js): on Earth once the Bay's ground is in
	const powerlines = createPowerlines(scene, { isPhone: GFX });
	if (!earth) powerlines.plan({ island, profile });
	// airliners far overhead and their contrails, on Earth (world/contrails.js)
	const contrails = createContrails(scene, shared, sky, { isPhone: GFX });
	contrails.enabled = earth && !island.far;
	// birds flushed out of the trees by gunfire and blasts (world/flush.js; combat calls noise())
	const flush = createFlush(scene, shared, { isPhone: GFX, vegetation, heightAt: (x, z) => { const b = iw.world?.bayArea; return b?.loaded?.() ? b.heightAt(x, z) : island.heightAt(x, z); } });
	// the island's trees past their draw distance, as impostors (world/farforest.js)
	const farForest = createFarForest(vegetation, island, shared, scene, { isPhone: GFX });
	const fauna = stash(() => createFauna(island, shared, scene));
	const landFauna = stash(() => createLandFauna(land, island, shared, scene, camera, vegetation));
	await yieldBuild('Preparing the shoreline');
	const player = createPlayer(island, village, vegetation, camera, dom, shared);
	player.state.active = true;
	player.parkour.attach(scene);
	// the ground kicked up underfoot (player.js onKick: a sprinting footfall, a slide, a hard
	// landing): dust off dirt, sand and dry ground, a spray off shallow water, flecks of snow;
	// nothing off a floor, a road or stone
	player.state.onKick = (kind, k) => {
		const fx = HOOKS.combat?.fx, surf = worldAudio.surface?.(), P = player.state;
		if (!fx || !KICK[surf] || P.flying || P.swimming || (surf === 'grass' && kind === 'step')) return;
		const [r, g, b] = KICK[surf], y = P.pos.y - 1.6, n = kind === 'land' ? 3 + Math.round(k * 5) : kind === 'slide' ? 2 : 1;
		for (let i = 0; i < n; i++) fx.dust({ x: P.pos.x + (Math.random() - 0.5) * 0.5, y, z: P.pos.z + (Math.random() - 0.5) * 0.5 }, 1, r, g, b, (kind === 'land' ? 0.5 : 0.35) * (0.6 + k * 0.6), kind === 'slide' ? 0.5 : 0.3);
	};
	// arriving at a kept or shared spot: start there, so what streams in first is that place
	const sp = params.spot;
	if (sp && Number.isFinite(sp.x) && Number.isFinite(sp.z)) {
		const P = player.state;
		P.pos.set(sp.x, Number.isFinite(sp.y) ? sp.y : island.heightAt(sp.x, sp.z) + 60, sp.z);
		P.yaw = sp.yaw || 0; P.pitch = sp.pitch || 0; P.flying = true;
		camera.position.copy(P.pos);
	}
	const boat = stash(() => createBoat(island, village, player, camera, shared, scene));
	const whale = stash(() => createWhale(island, shared, scene));
	const shells = stash(() => createShells(island, shared, camera, scene, player, dom, hint));
	if (profile.airless) shells.update = () => {};
	if (bare) boat.near = () => false;
	const magma = createMagma(island, shared, scene, camera);
	const caverns = stash(() => createCaverns(island, shared, scene, camera, magma.tube || []));
	const underwater = stash(() => createUnderwater(island, shared, scene, camera, player, [...(magma.tube || []), ...caverns.tunnels.flat(), ...caverns.arches.flat()]));
	// Crysis: the sea's food web and species, grown from the seed
	const eco = buildEcology(island.seed, { volcanism: 0.8 });
	const reef = stash(() => createReef(island, shared, scene, [...(magma.tube || []), ...caverns.tunnels.flat(), ...caverns.arches.flat()], eco));
	const sealife = stash(() => createSealife(island, shared, scene, camera, reef.bommies));
	const fish = stash(() => createFish(eco, island, shared, scene, camera, reef.bommies));
	const inverts = stash(() => createInverts(eco, island, shared, scene, camera, reef.bommies));
	const pick = [...vegetation.pickables, ...village.pickables];
	// the reef's corals and the sea's creatures ring too (tagged by what they are made of)
	for (const g of [reef.group, sealife.group]) g?.traverse((o) => { if (o.isInstancedMesh && o.userData.material175) pick.push(o); });
	const music = createMusic(shared, scene, camera, dom.canvas, () => pick.concat(iw.world?.underworld?.pickables || []), () => iw.running && iw.visible);
	music.register();
	iw.world = { island, sky, weather, terrain, ocean, grass, turf, litter, vegetation, village, distant, plumes, powerlines, contrails, flush, farForest, fauna, player, music, boat, whale, shells, underwater, sealife, magma, caverns, reef, eco, fish, inverts, land, landFauna, arms, bayArea: null, bridge: null, labels: null };
	// what stands in the sea, for its depth pass: the pier and the boats, the rocks, the reef
	seaDepth.mark(village?.group); seaDepth.mark(reef?.group);
	seaDepth.mark(vegetation?.group, (o) => o.userData.material175 === 'stone');
	await yieldBuild('Preparing places to explore');
	// Equipment sources are data-facing first.  Generated shops are added as they stream
	// in; the small island board keeps the conversational loop playable before Earth has
	// finished loading.  These records do not imply a shared backend or real-world site
	// layout.  The authoritative multiplayer inventory remains a separate dependency.
	iw.world.worldSites = () => {
		const anchor = iw.world.village?.footprints?.find((f) => !f.fence && !f.pier) || iw.world.island.spawn || { x: 0, z: 0 };
		const out = [
			{ id: 'island-ranger-camp', name: 'Island ranger camp', kind: 'outfitter', x: anchor.x + 12, z: anchor.z + 8, actions: ['purchase', 'hunt'], virtual: true },
			{ id: 'island-supermarket', name: 'Village supermarket', kind: 'supermarket', x: anchor.x + 28, z: anchor.z + 12, actions: ['purchase'], virtual: true },
			{ id: 'island-home-supply', name: 'Village home-supply store', kind: 'home-supply', x: anchor.x - 26, z: anchor.z + 10, actions: ['purchase'], virtual: true },
			{ id: 'island-community-market', name: 'Community player exchange', kind: 'player-vendor', x: anchor.x - 18, z: anchor.z - 12, actions: ['purchase'], virtual: true },
			{ id: 'island-trader', name: 'Travelling NPC trader', kind: 'npc-vendor', x: anchor.x + 4, z: anchor.z - 20, actions: ['purchase', 'hunt'], virtual: true },
			{ id: 'island-police-cache', name: 'Civic police-station recovery cache', kind: 'police', x: anchor.x - 92, z: anchor.z - 82, actions: ['secure'], virtual: true },
		];
		for (const S of iw.world.services?.sites?.() || []) out.push(S);
		const businesses = iw.world.city?.economy?.near(camera.position.x, camera.position.z, 700) || [];
		const equipment = new Set(['outfitter', 'huntpost', 'general', 'hardware', 'grocer']);
		for (const E of businesses) if (equipment.has(E.type)) {
			const x = E.door?.[0] ?? E.x, z = E.door?.[1] ?? E.z;
			out.push({ id: E.id, economyId: E.id, name: E.name, kind: ['outfitter', 'huntpost'].includes(E.type) ? 'outfitter' : 'supermarket', x, z,
				y: iw.world.island.heightAt(x, z), actions: ['purchase'], source: 'economy',
				...(E.type === 'hardware' ? { stock: ['repair-roll', 'camp-lantern', 'home-supply-kit'] } : {}) });
		}
		for (const B of iw.world.commercial?.list?.() || []) {
			if (B.type !== 'shop') continue;
			// A named business owns its own counter; do not add a second generic store
			// over it with a separate stock lot or let its neighbours sell its goods.
			const E = businesses.find(e => Math.hypot(e.x - B.x, e.z - B.z) < 5);
			if (E) continue;
			const id = `shop-${Math.round(B.x)}-${Math.round(B.z)}`;
			out.push({ id, name: 'Neighbourhood supermarket', kind: 'supermarket', x: B.x, z: B.z, y: B.y, w: B.w, d: B.d, actions: ['purchase'], source: 'generated-commercial' });
		}
		return out;
	};
	player.state.onBoost = speed => { hint(`Flying ×${speed}.`, 1500); actions(); updateFlightControls(iw.world); };
	// the fishing cottages' rooms, furnished as you come near (interiors/cottage.js)
	iw.world.cottages = createCottageInteriors(scene, village.footprints, { isPhone: GFX });
	// sunbeams through the trees in mist (world/sunrays.js)
	iw.world.rays = createSunRays(scene, shared, renderer, { isPhone: GFX, sun: sky.sun, air: sky.uniforms.uAir });
	iw.world.rays.quality(qualityNow().fx);
	fitShadow();
	// sprinklers on the lawns, spray and mist where water falls (world/spray.js)
	iw.world.spray = createSpray(scene, shared, { isPhone: GFX, world: () => iw.world });
	iw.world.spray.quality(qualityNow().fx);
	if (waterPlan) {
		iw.world.water = createWater(scene, shared, { isPhone: GFX, mode: 'island', island, heightAt: (x, z) => island.heightAt(x, z), sources: [waterPlan.source], look: waterPlan.look, roads: waterPlan.roads });
		const water = iw.world.water;
		island.waterAt = (x, z) => water.waterAt(x, z);
	}
	// Every generated surface, including Earth's island, owns its underground in this scene.
	{
		iw.world.underworld = createUnderworld(island, shared, scene, camera, profile, { isPhone: GFX, hint: (t, ms) => hint(t, ms, 1), player: () => iw.world?.player.state, mount: dom.mount, plan: cavePlan, dinosaurs: !earth, bodyKey: body.key });
		island.underFloor = iw.world.underworld.floor;
		island.underPush = iw.world.underworld.push;
		island.underClear = iw.world.underworld.clearBody;
	}
	// the mushrooms this world grows, and what they do to you
	iw.world.soulWell = createSoulWell({ world: iw.world, profile, scene, camera, mount: dom.mount, shared, soul, hint: (t, ms) => hint(t, ms, 1), blocked: () => iw.drive.active() || !iw.visible || window.L99Loading.active() || !!iw.world.beyond?.active?.() });
	iw.world.shrooms = createMushrooms(island, shared, scene, camera, profile, { isPhone, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount, canvas: dom.canvas, player: () => iw.world?.player.state, spots: () => iw.world?.underworld?.spots || [], renderer, vegetation });
	// a volcanic world's mountain: lava tubes, spouts, the crater's lake, and its eruptions
	if (!earth && (profile.relief === 'volcano' || island.peak?.volcanic)) {
		iw.world.volcano = createVolcano(island, shared, scene, camera, profile, { isPhone: GFX, renderer });
		island.extraFloor = iw.world.volcano.floor;
		island.extraPush = iw.world.volcano.push;
	}
	// the ball fields: the island's, and the Bay's as you come near them (their fences are walked into)
	iw.world.fields = createSportsFields({ scene, getWorld: () => iw.world, isPhone: GFX, plan: fieldPlan });
	{ const own = island.extraPush, fp = iw.world.fields.push; island.extraPush = own ? (p, footY) => { own(p, footY); fp(p, footY); } : fp; }
	{ const of = island.extraFloor, ff = iw.world.fields.floor; island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), ff(x, z, y)) : ff; }
	// the alien works: their platforms, causeways and halls are walked on, their walls walked into
	if (alienPlan) {
		const al = iw.world.alien = createAlien(island, shared, scene, camera, profile, alienPlan, { isPhone: GFX, renderer, hint: (t, ms) => hint(t, ms, 1), player: () => iw.world?.player.state });
		const of = island.extraFloor, op = island.extraPush;
		island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), al.floor(x, z, y)) : al.floor;
		island.extraPush = op ? (p, footY) => { op(p, footY); al.push(p, footY); } : al.push;
		const dw = iw.world.dwellings = createDwellings(scene, alienPlan, { isPhone: GFX });
		const of2 = island.extraFloor, op2 = island.extraPush;
		island.extraFloor = (x, z, y) => Math.max(of2(x, z, y), dw.floor(x, z, y));
		island.extraPush = (p, footY) => { op2(p, footY); dw.push(p, footY); };
	}
	// a mystical world's terraces hung in the air, walked on
	if (island.floaters) { const fl = iw.world.floaters = createFloaters(island, scene, profile), of = island.extraFloor; island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), fl.floor(x, z, y)) : fl.floor; }
	// the world by the dark star: its Event Ring's sphere is a way beyond (planet/beyond.js)
	if (profile.type === 'SINGULARITY' && alienPlan?.sites[0]?.kind === 'landmark') iw.world.beyond = createBeyond({ renderer, scene, camera, island, shared, site: alienPlan.sites[0], player, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount, isPhone });
	if (colonyPlan) {
		const cl = iw.world.colony = createColony(island, shared, scene, camera, profile, colonyPlan, { isPhone: GFX, renderer, hint: (t, ms) => hint(t, ms, 1), player: () => iw.world?.player.state, mount: dom.mount, isTouch: matchMedia('(pointer: coarse)').matches, arms, social: () => social, world: () => iw.world });
		const of = island.extraFloor, op = island.extraPush;
		island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), cl.floor(x, z, y)) : cl.floor;
		island.extraPush = op ? (p, footY) => { op(p, footY); cl.push(p, footY); } : cl.push;
	}
	// the cliff settlement: its decks, terraces, bridges and roofs walked on, its walls walked into
	if (archPlan) {
		const ar = iw.world.arch = createArch(island, shared, scene, camera, profile, archPlan, { isPhone: GFX, renderer, hint: (t, ms) => hint(t, ms, 1), player: () => iw.world?.player.state });
		const of = island.extraFloor, op = island.extraPush;
		island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), ar.floor(x, z, y)) : ar.floor;
		island.extraPush = op ? (p, footY) => { op(p, footY); ar.push(p, footY); } : ar.push;
	}
	// the realm: its castle, town and fields walked on and into; its dungeons reached before the caves
	if (realmPlan) {
		const md = iw.world.medieval = createMedieval(realmPlan, { island, shared, scene, camera, profile, isPhone, renderer, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount, player: () => iw.world?.player.state, underworld: iw.world.underworld });
		const of = island.extraFloor, op = island.extraPush;
		island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), md.floor(x, z, y)) : md.floor;
		island.extraPush = op ? (p, footY) => { op(p, footY); md.push(p, footY); } : md.push;
		island.underFloor = md.underFloor(island.underFloor);
		island.underPush = md.underPush(island.underPush);
	}
	// (the bridges where the realm's roads cross the streams are floors)
	if (waterPlan?.source.decks.length) { const of = island.extraFloor, wf = iw.world.water.floor; island.extraFloor = of ? (x, z, y) => Math.max(of(x, z, y), wf(x, z, y)) : wf; }
	// the Deep: walked in its own frame, ahead of the caves and dungeons while you are down there
	if (deepPlan && iw.world.underworld?.lighting) {
		const dp = iw.world.deep = createDeep(island, shared, scene, camera, profile, { plan: deepPlan, underworld: iw.world.underworld, isPhone: GFX, hint: (t, ms) => hint(t, ms, 1), player: () => iw.world?.player.state, mount: dom.mount, bodyKey: body.key });
		if (dp) {
			const uf = island.underFloor, up = island.underPush;
			island.underFloor = (x, z, y) => (dp.active() ? dp.floor(x, z, y) : dp.gateFloor(x, z, y) ?? uf?.(x, z, y) ?? null);
			island.underPush = (p, footY) => { if (dp.active()) dp.push(p, footY); else { up?.(p, footY); dp.gatePush(p, footY); } };
		} else iw.world.deep = null;
	}
	iw.world.kinetic = createKinetic({ scene });
	iw.world.kineticEpoch = iw.world.globe?.frame?.epoch;
	state.body = iw.world.body = body;
	state.seed = seed;
	state.earth = earth;
	state.biome = params.biome;
	iw.world.orbit = createOrbitalFlight({ renderer, camera, dom, world: iw.world, earth, seed, profile, shared,
		location: () => earth ? globeLL(camera.position.x, camera.position.z) : { lat: 0, lon: 0 },
		sun: () => shared.uSunDir.value, departed: () => share.keep(true, true), hint, voyage,
		// coming down from orbit somewhere new: the globe's frame moves there and its ground streams in
		chart: (lat, lon) => {
			const W = iw.world;
			if (!W?.globe) return null;
			W.labels?.hide(); W.kinetic?.clear(); fishing.drop(); iw.drive.stop();
			if (W.boat?.boarded?.()) W.boat.leave();
			return W.globe.place(lat, lon);
		},
		// straight back to where the climb began, behind the travel veil
		goHome: (at, name) => travel(name, () => HOOKS.goTo(at.lat, at.lon, 900)),
	});
	// Establish real visibility before warming: the first surface frame must not
	// upload every underwater/cave material simply because no update ran yet.
	player.update(0, 0);
	sky.update(0, camera.position);
	const contact = waterContact(island, camera.position, player.floorAt(camera.position.x, camera.position.z, camera.position.y - 1.68), 0, shared.uWave.value);
	const under = contact.under && !iw.world.deep?.active();
	underwater.update(0, 0, under, contact.surface ?? 0); caverns.update(0, 0, under);
	seaLifeVisibility(iw.world, 0, 0, under); iw.world.underworld?.update(0, 0); iw.world.deep?.update(0, 0);
	vegetation.stream(camera, true);
	for (const o of [terrain, ocean, grass, turf]) o.userData.update?.(camera);
	litter.update(camera);
	// (shown as soon as the first few seconds of it are done; the rest is built in play)
	window.L99Loading.stage('Lighting the world');
	HOOKS.lightPad?.update(performance.now(), camera, true);
	await shaderWarm.all({ budget: 2500, progress: (k) => { if (iw.arrival) arriving(k * 0.3); } });
	window.L99Loading.stage('Preparing the surroundings');
	// the Bay Area streams in behind the island (on Earth); once its heights are here, one height
	// for everything: the island's own map on the island, the real land beyond it
	if (earth) {
		const bayArea = createBayArea(shared, scene, island, shared.bayU);
		iw.world.bayArea = bayArea;
		// globe: the Earth past the survey, and the engine's relief on the Bay's own ground (earth/globe.js)
		iw.world.globe = createGlobe({ scene, shared, bay: bayArea, island, camera, world: () => iw.world, director: earthDirector, hint: (t, ms) => hint(t, ms, 1), isPhone: GFX, busy: () => iw.drive.active() || !!iw.world?.boat?.boarded?.() || !!iw.world?.orbit?.active() });
		// globe: the Bay's woods and wild things are California's; far off (or once the frame floats)
		// they give way to the globe's own (their view of the Bay says it is not loaded there)
		const bayNear = Object.create(bayArea, { loaded: { value: () => bayArea.loaded() && globeF.bay && (() => { const ll = globeLL(camera.position.x, camera.position.z); return bayKm(ll.lat, ll.lon) < BAY_WILD_KM; })() } });
		iw.world.labels = createLabels(dom.mount, bayArea, null);
		iw.world.real = createRealCity(renderer, { isPhone: GFX });
		// Crysis: the towns beyond the survey, grown street by street as you near them
		iw.world.civ = createCivilization({ real: iw.world.real, bay: bayArea, water: () => iw.world?.water?.gen, brief: (t) => earthDirector.townBrief(t) });
		iw.world.city = createCity(shared, scene, bayNear, iw.world.real);
		// (the businesses take their food and words from where on Earth they are)
		iw.world.city.economy.setLocator((x, z) => globeLL(x, z));
		iw.world.city.economy.setRegional(() => iw.world?.globe?.regional?.settlements);
		iw.world.city.economy.setSea({ at: (x, z) => iw.world?.globe?.seaAt(x, z) ?? null, coast: (x, z) => iw.world?.globe?.coastMask(x, z) ?? null });
		// the working day: staff out front of the open businesses, people in and out of their doors (people/people.js)
		{ const daily = createDailyLife(iw.world.city.economy, { isPhone: GFX }); addLife((x, z, h, now) => daily.at(x, z, h, now, new Date().getDay())); }
		// the forest floor: fallen logs and stumps under the trees, the haze among the redwoods
		iw.world.forestFloor = createForestFloor(scene, bayNear, iw.world.city, iw.world.real, { shared, isPhone: GFX, ground: (x, z) => island.heightAt(x, z), globe: () => iw.world?.globe });
		// the real houses close by, built whole with their rooms
		iw.world.houses = createHouses(scene, bayArea, iw.world.real, iw.world.city, { isPhone: GFX });
		// ...and the shops, cafés, restaurants, offices and places to play, walked into
		iw.world.commercial = createCommercial(scene, bayArea, iw.world.real, iw.world.city, { isPhone: GFX });
		// inside the towers: the lobby, the elevators, every floor, the roof
		iw.world.towers = createTowers(scene, bayArea, iw.world.city, { isPhone: GFX, mount: dom.mount, hint: (t, ms) => hint(t, ms, 1), player: () => iw.world?.player.state });
		// ...and every other building: solid, and built inside as you come to it (interiors/)
		iw.world.interiors = createInteriors(scene, bayArea, iw.world.city, { isPhone: GFX, mats: iw.world.houses.M, towers: iw.world.towers, warm: (o) => (renderer.compileAsync ? renderer.compileAsync(o, camera, scene) : null) });
		{ const cv = iw.world.commercial.venue, I = iw.world.interiors; iw.world.commercial.venue = (c, h) => cv(c, h) || I.venue(c, h); }
		// (the doors walkers may use: the shops' and cafés' too, through the interiors' list)
		iw.world.interiors.addDoors(iw.world.commercial);
		// the buildings as things: glass that breaks, windows and walls to vault, walls that break,
		// buildings that fall and the crews that rebuild them (structures/)
		iw.world.structures = HOOKS.structures = createStructures({ scene, camera, world: () => iw.world, isPhone: GFX, shared, car: () => {
			const C = iw.drive.active() ? iw.drive.physics() : null;
			if (!C) return null;
			const t = C.body.translation(), v = C.body.linvel(), r = C.body.rotation();
			return { x: t.x, y: t.y - 0.5, z: t.z, vx: v.x, vz: v.z, yaw: 2 * Math.atan2(r.y, r.w), mass: C.feel.mass, L: C.spec.L, W: C.spec.W };
		} });
		// the towns' hospitals, police and fire stations and armories (services/): built inside
		// like the rest, staffed by the hour, their ambulances and engines out on the streets
		iw.world.services = createServices({ scene, world: () => iw.world, camera, people: () => people, isPhone: GFX, mount: dom.mount, button, hint: (t, ms) => hint(t, ms, 1), arms, combat: () => HOOKS.combat });
		// a patient's bill out of their own money (people/npc-money.js; short of it, they owe it), and
		// the bases' barracks, war rooms and depots furnished by the services, the police cruisers
		// leaving from their stations (military/)
		iw.world.services.hooks.charge = (who, credits) => { const M = HOOKS.npcMoney; if (!M || !(M.balance(who) >= credits)) return false; M.spend(who, credits, 'hospital', 'hospital'); return true; };
		HOOKS.military?.setInteriors(iw.world.services.militaryInteriors());
		HOOKS.military?.setStations((x, z) => iw.world?.services?.stationAt(x, z));
		iw.world.street = createStreetLife(shared, scene, bayArea, (x, z) => island.heightAt(x, z), iw.world.real, iw.world.city);
		// the streets by era and season: potholes and their crews, the trees' stakes and leaves, holiday lights, sprinklers (bay/streets.js)
		iw.world.streets = createStreets({ scene, camera, world: () => iw.world, drive: iw.drive, isPhone: GFX, hint: (t, ms) => hint(t, ms, 1) });
		// the soft shade where buildings, trees and cars meet the ground (bay/contact.js)
		iw.world.contact = createContact(scene, { ground: (x, z) => island.heightAt(x, z), city: iw.world.city, street: iw.world.street, isPhone: GFX });
		// the cars' people, their owners, and the cars as solid things (vehicles/)
		iw.world.vehicles = createVehicles({ scene, world: () => iw.world, camera, isPhone: GFX, people: () => people });
		iw.world.military = HOOKS.military;
		// the freeways' barriers, sound walls and overpasses (their decks are floors)
		iw.world.freeways = createFreeways(scene, bayArea, iw.world.real, { isPhone: GFX, roadAt: (r, x, z) => iw.world.berms?.along(r, x, z) });
		// the signs, decals, stickers, posters, tags and grime of the streets, shops and cars (signage/)
		iw.world.signage = HOOKS.signage = createSignage({ scene, world: () => iw.world, isPhone: GFX, locate: (x, z) => globeLL(x, z), morality: () => HOOKS.npcQuests?.where?.() });
		// Lake Annabel at Bishop Ranch: water, wildlife, and fishing
		iw.world.lake = createLake(scene, bayArea, shared, { isPhone: GFX, real: iw.world.real, ponds: false });
		// every other river, creek, lake and reservoir (bay/water.js)
		iw.world.water = createEarthWater(scene, bayArea, shared, { isPhone: GFX, real: iw.world.real, ground: (x, z) => island.heightAt(x, z), riverLevel: (x, z) => iw.world?.boardwalk?.waterAt(x, z) ?? null, riverSettled: () => iw.world?.boardwalk?.river?.settled?.() ?? !iw.world?.boardwalk, extra: [iw.world.lake.source] });
		bayArea.waterName = (x, z) => iw.world?.water?.nameAt(x, z) ?? null;
		// tide pools on the Pacific shore: Fitzgerald, Pillar Point, Duxbury Reef
		iw.world.tidepools = createTidepools(scene, bayArea, shared, { isPhone: GFX });
		// the South Bay's salt ponds, levees and marsh, round the Dumbarton Bridge
		iw.world.saltPonds = createSaltPonds(scene, bayArea, shared, { isPhone: GFX });
		// the beaches down Highway 1: lots, restrooms, camps and fires, surf, the lighthouse
		iw.world.beaches = createBeaches(scene, bayArea, iw.world.real, shared, { isPhone: GFX });
		// the parks furnished as their agencies furnish them: signs, kiosks, tables, playgrounds, courts
		iw.world.parks = createParkKit(scene, bayArea, iw.world.real, { isPhone: GFX, lake: iw.world.lake });
		// the Bay Area Discovery Museum at Fort Baker: the barracks, the exhibits, Lookout Cove
		iw.world.discovery = createDiscovery(scene, bayArea, iw.world.real, { isPhone: GFX });
		// the Santa Cruz Beach Boardwalk: the Casino, the midway and its rides, the Giant Dipper
		iw.world.boardwalk = createBoardwalk(scene, bayArea, shared, { isPhone, mount: dom.mount, hint: (t, ms, pri = 1) => hint(t, ms, pri), camera, player: () => iw.world?.player.state });
		// the Bay Area's wild animals by habitat, month and hour, and the field journal
		iw.world.wildlife = createWildlife(scene, bayNear, { isPhone: GFX, real: iw.world.real, globe: () => iw.world?.globe, hint: (t, ms, pri = 1) => hint(t, ms, pri), say: (t, w) => guide?.say?.(t, w) });
		iw.world.citySound = createCitySound(bayArea, (x, z) => island.heightAt(x, z));
		iw.world.natureSound = createNatureSound(bayNear, (x, z) => bayArea.heightAt(x, z));
		// the in-between places: dirt tracks, the industrial fringe, town's ragged edge, the odd camp
		iw.world.edge = createEdgelands(scene, { bay: bayNear, real: iw.world.real, city: iw.world.city, world: () => iw.world, shared, isPhone: GFX });
		// roads graded like real ones, with berms: the ground walked and driven on is the
		// ground as drawn
		iw.world.berms = createBerms(iw.world.real, (x, z) => bayArea.heightAt(x, z), (x, z) => bayArea.fixedAt(x, z), { ready: () => bayArea.loaded() });
		const own = island.heightAt, berms = iw.world.berms;
		island.heightAt = (x, z) => (Math.max(Math.abs(x), Math.abs(z)) < island.half - 20 || !bayArea.loaded()) ? own(x, z) : berms.apply(x, z, bayArea.heightAt(x, z));
		// (the ground as the GPU draws it, where people stand: bay/terrain.js)
		island.drawnAt = (x, z) => (Math.max(Math.abs(x), Math.abs(z)) < island.half - 20 || !bayArea.loaded()) ? own(x, z) : bayArea.drawnAt(x, z, island.heightAt);
		// (the San Lorenzo's water, to swim or wade: bay/sanlorenzo.js)
		const waterWorld = iw.world;
		island.waterAt = (x, z) => waterWorld.boardwalk?.waterAt(x, z) ?? waterWorld.water?.waterAt(x, z) ?? waterWorld.globe?.waterAt(x, z) ?? null;
		bayArea.ready.then(() => {
			if (iw.world !== w0) return;
			iw.world.powerlines?.plan({ earth: true, island, heightAt: (x, z) => bayArea.heightAt(x, z) });
			const bridge = createGoldenGate(shared, scene, bayArea.heightAt);
			iw.world.bridge = bridge;
			seaDepth.mark(bridge.group);   // its piers in the strait
			// the bridge's deck and the Presidio Parkway up to it, to drive (drive.js follows them)
			{
				const pts = [], B = bridge, half = B.length / 2;
				for (let t = -half; t <= half + 0.1; t += 20) pts.push(B.centre.x + B.axis.x * t, B.centre.z + B.axis.y * t);
				const south = pts.slice(0, 2), route = ROUTES['US-101 Presidio'].map(([a, b]) => toWorld(a, b));
				const pp = [...south];
				for (const q of route) pp.push(q.x, q.z);
				iw.world.real?.addRoads?.([
					{ cls: 'motorway', name: 'US-101 · Golden Gate Bridge', w: 18, pts: new Float32Array(pts), bridge: true, end0: false, end1: false, link: false, divided: true },
					{ cls: 'motorway', name: 'US-101 · Presidio Parkway', w: 18, pts: new Float32Array(pp), bridge: false, end0: false, end1: false, link: false, divided: true },
				]);
			}
			iw.world.landmarks = createLandmarks(scene, bayArea);
			// the San Mateo Bridge: its trestles and high-rise, to walk and drive across (bay/sanmateo.js)
			iw.world.sanMateo = createSanMateoBridge(scene, bayArea, { isPhone });
			seaDepth.mark(iw.world.sanMateo.substructure);
			iw.world.roads = createRoads(shared, scene, bayArea);
			iw.world.diablo = createDiablo(scene, bayArea);
			// the Summit Building's rooms, built inside its stone as you come near
			iw.world.interiors?.addSite(iw.world.diablo.site);
			// ...and the landmarks' (bay/landmarks.js): their halls, their doors for the townsfolk; the
			// city's own towers keep their lobbies where a landmark tower stands on one
			for (const S of [...iw.world.landmarks.sites, ...(iw.world.boardwalk.sites || [])]) iw.world.interiors?.addSite(S);
			iw.world.interiors?.addDoors(iw.world.landmarks);
			bayArea.coast?.sites?.each((S) => iw.world.interiors?.addSite(S));
			iw.world.landmarks.yieldTo((x, z) => (iw.world.city?.towersNear?.(x, z, 20) || []).length > 0);
			iw.world.labels.setBridge(bridge);
			// walk and drive across the deck; climb about Mt Diablo's rocks, not through them
			// ...and in and out of the houses, up their stairs
			const diablo = iw.world.diablo, houses = iw.world.houses, fwy = iw.world.freeways, pools = iw.world.tidepools;
			island.extraFloor = (x, z, y) => Math.max(bridge.deckFloor(x, z, y), iw.world.sanMateo.floor(x, z, y), diablo.floor(x, z, y), houses.floor(x, z, y), fwy.floor(x, z, y), pools.floor(x, z, y), iw.world.landmarks.floor(x, z, y), iw.world.beaches.floor(x, z, y), iw.world.commercial.floor(x, z, y), iw.world.discovery.floor(x, z, y), iw.world.towers.floor(x, z, y), iw.world.boardwalk.floor(x, z, y), iw.world.lake?.floor?.(x, z, y) ?? -1e9, iw.world.parks?.floor?.(x, z, y) ?? -1e9);
			island.extraPush = (p, footY) => { diablo.push(p, footY); houses.push(p, footY); iw.world.commercial.push(p, footY); iw.world.discovery.push(p, footY); iw.world.towers.push(p, footY); iw.world.boardwalk.push(p, footY); iw.world.landmarks.push(p, footY); bayArea.coast?.push?.(p, footY); iw.world.lake?.push(p, footY, iw.world.player.state.flying); iw.world.fields.push(p, footY); iw.world.beaches.push?.(p, footY); iw.world.parks?.push?.(p, footY); picnic.push(p, footY); };
			{ const of = island.extraFloor, P = iw.world.saltPonds; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), P.floor(x, z, y)); }
			{ const of = island.extraFloor, op = island.extraPush, E = iw.world.edge; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), E.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); E.push(p, footY); }; }
			{ const of = island.extraFloor, op = island.extraPush, I = iw.world.interiors; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), I.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); I.push(p, footY); }; }
			{ const of = island.extraFloor, op = island.extraPush, S = iw.world.structures; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), S.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); S.push(p, footY); }; }          // structures: rubble and broken walls
			{ const of = island.extraFloor, op = island.extraPush, S = iw.world.services; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), S.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); S.push(p, footY); }; }
			{ const of = island.extraFloor, op = island.extraPush, V = iw.world.vehicles; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), V.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); V.push(p, footY); }; }
			// the military bases' pads, banks, roofs and towers to stand on; their walls, fence and vehicles solid
			{ const of = island.extraFloor, op = island.extraPush, M = HOOKS.military; island.extraFloor = (x, z, y) => Math.max(of(x, z, y), M.floor(x, z, y)); island.extraPush = (p, footY) => { op(p, footY); M.push(p, footY); }; }
			// the houses' pitched roofs for you to stand on (climbed onto from outside: parkour.js; yours
			// alone, player.js, so nothing else falls or spawns onto them); the ceilings over you indoors,
			// which no jump or climb goes up through
			island.roofFloor = (x, z, y) => iw.world.city.roofFloor(x, z, y);
			island.ceilingAt = (x, z, y) => Math.min(houses.ceiling(x, z, y), iw.world.interiors?.ceiling?.(x, z, y) ?? Infinity, iw.world.city.ceiling(x, z, y));
			// the wild rocks to stand on and go round, the brush to push through (nature/wildground.js)
			{ const of = island.extraFloor, G = iw.world.forestFloor?.wild; if (G) { island.extraFloor = (x, z, y) => Math.max(of(x, z, y), G.rockTop(x, z)); island.dragAt = (x, z) => G.dragAt(x, z); } }
			// New district materials are warmed by the bounded frame queue.
		});
		const w0 = iw.world;
	}
	{ const previousPush = island.extraPush; island.extraPush = (p, footY) => { previousPush?.(p, footY); picnic.push(p, footY); }; }
	window.L99Loading.stage('Settling your arrival');
	// what was built after the first warm (the Bay, its towns), and the pictures the first frame
	// will draw, handed over now in small steps: Enter then only shows them (a phone given all of
	// it in the first frame after Enter closed the page)
	HOOKS.lightPad?.update(performance.now(), camera, true);
	await shaderWarm.all({ budget: 2500 });
	await shaderWarm.textures({ budget: 2500 });
	buildPanel();
	return iw.world;
}
