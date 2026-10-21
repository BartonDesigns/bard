// One frame of the island, moved out of main.js's createIslandWorld: the input, the player, the
// sky, the weather and the sea, every system's update in its order, then the picture.
// The rest of what it uses from main.js's createIslandWorld comes from iw at the top, once per
// call; none of it changes after the world is set up. A name not yet there needs a getter in
// main.js's iw (island/tools/split-contexts.test.mjs checks).
// What changes as the game runs it reaches through iw: arrival, building, drive, farNight,
// frameAvg, indoorK, last, lost, projectMarks, projectRefresh, projectSnapshot, time, visible,
// world. It sets frameAvg, indoorK, last, projectRefresh, projectSnapshot, time.

import * as THREE from 'three';
import { qualityNow } from './world/governor.js';
import { kitDaylight } from './people/kit-light.js';
import { worldAir } from './world/soundbus.js';
import { today } from './calendar.js';
import { toLL as globeLL } from './earth/globeframe.js';
import { waterContact } from './world/water-contact.js';
import { AIR } from './world/airfog.js';

// on a phone the sea's mirror (a second drawing of the world, with its own shaders) waits this
// long after the loading card clears, so its first frame is not the same as everything else's
const MIRROR_EASE = 1500;
let shownAt = 0;
const caveFog = new THREE.Color();
// where the town's own light is read round you (island-frame's city light): here and 250 m out
const CITY_AT = [[0, 0], [250, 0], [-250, 0], [0, 250], [0, -250]];

export function islandFrame(iw, now) {
	const { _voidFog, actions, applyQuality, arcade, autoMusic, bridgeSound, camera, carjack, chatter,
		combat, communityProjects, crosswalks, dogWalkers, dom, earthDirector, encounterPacing, errands,
		explore, families, fares, fishing, followFarGround, followGround, frame, gear, ghost, glare, GLOW_AT,
		governor, guide, hint, HOOKS, inkBtn, isPhone, livingWorld, magic, muffle, multiplayer, npcQuests,
		people, picnic, ragdolls, recovery, renderer, scene, seaDepth, seaLifeVisibility, seaMirror,
		shaderWarm, share, shared, social, soul, stampPrints, stepWind, striker, strikeRipples, studio,
		sunGlare, surfaceOpen, surprises, tick, underwaterAudio, updateFlightControls, watchDoor, watchTalk,
		watchTeleport, waypoint, worldAudio, you } = iw;
	const elapsed = Math.min(.25, Math.max(.001, (now - iw.last) / 1000));
	const dt = Math.min(0.05, elapsed);
	const projectDelta = elapsed;
	iw.last = now;
	if (iw.building || !iw.visible || !iw.world || document.hidden || iw.lost || recovery.blocked()) { communityProjects.reset(); iw.world?.kinetic?.silence(); iw.world?.globe?.regional?.pause(); return; }
	if (window.L99Loading.active() && !iw.arrival) { communityProjects.reset(); shownAt = 0; return; }
	if (!shownAt) shownAt = now;
	// on a phone the world holds still while someone thinks of a reply: the model and
	// the world share the GPU and the page's memory
	if (isPhone && guide.llm?.busy?.()) { communityProjects.reset(); return; }
	iw.time += dt;
	shared.uTime.value = iw.time;
	stepWind(dt, shared);
	const W = iw.world;
	W.player.state.inputBlocked = window.L99Loading.active() || arcade.active() || studio.active() || gear.busy() || dom.mount.classList.contains('l99-tools-open') || !!dom.mount.querySelector('[role="dialog"]:not([style*="display: none"]) input:focus');
	if (W.player.state.inputBlocked) W.player.clearInput();
	W.arms?.update(dt, camera.position);
	W.music.update(dt);
	W.orbit?.before();
	// Keep the flight controls alive while the orbital pass owns the render loop.
	// This makes the same ×1/×3/×6/×9 booster available in space as on the surface.
	updateFlightControls(W);
	if (!window.L99Loading.active()) explore.steer(dt);
	// driving a road carries you; otherwise you walk, swim or fly
	// (a minigame has the screen and the camera while it runs)
	if (window.L99Loading.active()) { W.player.clearInput(); iw.drive.stop(); }
	else if (arcade.active()) iw.drive.stop();
	else if (W.boardwalk?.ride(dt, iw.time)) iw.drive.stop();
	else if (studio.active()) { /* in the chair: the studio holds the camera */ }
	else if (!carjack.update(dt, iw.time) && !iw.drive.update(dt)) W.player.update(dt, iw.time);
	W.orbit?.after(dt);
	W.orbit?.updateHud();
	worldAir(1 - (W.orbit?.blend() || 0));
	if (W.orbit?.space()) {
		communityProjects.reset();
		social.update(0, iw.time, false); waypoint.update(0, iw.time, false);
		W.labels?.hide();
		W.globe?.regional?.pause();
		W.kinetic?.silence();
		worldAudio.space(dt);
		// The retained ground stops streaming and drawing; only the orbital pass runs.
		// The same input state and faceplate analyser continue on every frame.
		dom.veil.style.opacity = '0'; glare.style.opacity = '0';
		// (charting a new place on the way down: its ground comes in while the orbit is still drawn)
		if (W.orbit.streams?.()) followFarGround(W, dt, iw.farNight);
		actions();
		explore.shoot(dt);
		W.orbit.render(iw.time);
		return;
	}
	you.update(dt, iw.time);
	// a director's camera (trailer/): posed after the player moves, before anything reads it
	HOOKS.cine?.(camera, dt, iw.time);
	explore.shoot(dt);
	W.fields?.update(dt, camera);
	arcade.update(dt, iw.time, !W.boat?.boarded?.() && !W.boardwalk?.riding());
	stampPrints(W.player.state);
	W.boat.update(dt, iw.time);
	const sk = W.sky.update(dt, camera.position);
	W.boardwalk?.update(dt, iw.time, camera, sk.night, W.sky.state.hours);
	// the weather: frames running slow shed rain streaks; indoors the rain stays out
	W.weather.state.sheltered = !!W.houses?.inside(camera.position) || (W.underworld?.inside() || 0) > 0.4;
	const wx = W.weather.update(dt, W.sky, camera, (x, z) => W.island.heightAt(x, z), { slow: iw.frameAvg > 26 });
	W.ocean.userData.tick?.(dt, W, camera, wx?.rainHere || 0);   // what touches the sea, the rain on it (world/ocean.js)
	surprises.update(dt, sk, wx);
	W.whale.update(dt, iw.time, shared.uBass.value, camera.position);
	// below the surface: the sea closes in, blue-green and dim
	const contact = waterContact(W.island, camera.position, W.player.floorAt(camera.position.x, camera.position.z, camera.position.y - 1.68), iw.time, shared.uWave.value);
	const surf = contact.surface ?? 0;
	// (the Deep lies far under the sea's level, but it is dry rock)
	const under = contact.under && !W.deep?.active();
	// seen from below the sea is a ceiling: it must not hide what glows beneath it
	W.ocean.material.depthWrite = !under;
	// ...and it is drawn before everything under it, so glows and embers show through
	W.ocean.renderOrder = under ? -5 : 1;
	W.underwater.update(dt, iw.time, under, surf);
	// (a phone draws the crater's boulders and kelp only from in or at the water: through the
	// surface from the shore they cost the GPU far more than they show)
	if (isPhone && W.underwater.group) W.underwater.group.visible = under || camera.position.y < surf + 4;
	W.magma.update(dt, iw.time, under, contact.sea ?? 0);
	W.volcano?.update(dt, iw.time);
	W.alien?.update(dt, iw.time);
	W.beyond?.update(dt, iw.time);
	W.floaters?.update(sk.night);
	W.colony?.update(dt, iw.time);
	W.arch?.update(dt, iw.time);
	W.dwellings?.update(dt, camera.position);
	W.medieval?.update(dt, iw.time, sk);
	W.caverns.update(dt, iw.time, under);
	soul.update();
	W.underworld?.update(dt, iw.time);
	W.soulWell?.update(dt, iw.time);
	W.deep?.update(dt, iw.time);
	// the reef and its fish only run when you are in or over the bay
	// (on a governed tier, from up on the shore only once you are down at the water: the reef
	// and its life drawn through the surface from the spawn's hill were millions of triangles)
	seaLifeVisibility(W, dt, iw.time, under);
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
		// (the Moon's ground runs to its horizon in clear vacuum)
		if (W.island.far) scene.fog.density = 0.000006;
		const far = (W.island.far ? 40000 : THREE.MathUtils.lerp(16000, 110000, openK)) * qualityNow().far, nearP = openK > 0.5 ? THREE.MathUtils.clamp((camera.position.y - Math.max(0, W.island.heightAt(camera.position.x, camera.position.z))) * 0.01, 0.25, 2) : 0.25;
		if (Math.abs(camera.far - far) > far * 0.02 || Math.abs(camera.near - nearP) > 0.05) { camera.far = far; camera.near = nearP; camera.updateProjectionMatrix(); }
	}
	// down in a planet's caves the daylight is gone: the glow, the lamps and the lava light it
	const caveK = W.underworld?.inside?.() || 0;
	const open = surfaceOpen(W);
	if (caveK > 0) {
		const dim = 1 - caveK * 0.96;
		W.sky.hemi.intensity *= dim; W.sky.sun.intensity *= dim * dim;
		shared.uAmbient.value.multiplyScalar(dim);
		const cg = W.underworld.fog?.() || [0.02, 0.022, 0.026];
		scene.fog.color.lerp(caveFog.setRGB(cg[0], cg[1], cg[2]), caveK);
		scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, 0.012, caveK);
	}
	// the air's shape (world/airfog.js): thick low down, lit toward the sun, whole by the far
	// plane; none of it under water, in a cave or where there is no air
	const airK = under || W.island.far || shared.planet?.airless ? 0 : 1 - caveK;
	AIR.air.z = airK; AIR.air.w = airK > 0 ? camera.far * 0.98 : 0;
	AIR.sun.w *= airK;
	// Gargantua swallowing the sky (magic/fx.js): the daylight on the ground goes with it
	const voidK = magic.darkness?.() || 0;
	if (voidK > 0) {
		const dim = 1 - voidK * 0.88;
		W.sky.hemi.intensity *= dim; W.sky.sun.intensity *= dim * dim;
		shared.uAmbient.value.multiplyScalar(dim);
		scene.fog.color.lerp(_voidFog, voidK * 0.9);
	}
	// the cities' glow washes out the faint stars
	if (W.bayArea?.loaded()) {
		let glow = 0;
		let gx = 0, gz = 0;
		for (const [dx, dz] of GLOW_AT) { const u = W.bayArea.urbanAt(camera.position.x + dx, camera.position.z + dz).u; glow += u; gx += dx * u; gz += dz * u; }
		shared.uSkyGlow.value += (Math.min(1, glow / 4) - shared.uSkyGlow.value) * Math.min(1, dt);
		// (and which way the glow lies: the sky over the cities brightest toward them)
		W.sky.glowToward(gx, gz, dt);
	}
	// and the town's own light by night in the shade (sky.js): how built up it is just round you
	{
		const U = shared.uCityLight || (shared.uCityLight = { value: 0 });
		let u = 0;
		if (W.bayArea?.loaded() && !W.island.far) for (const [dx, dz] of CITY_AT) u += W.bayArea.urbanAt(camera.position.x + dx, camera.position.z + dz).u;
		U.value += (THREE.MathUtils.smoothstep(u / CITY_AT.length, 0.04, 0.3) - U.value) * Math.min(1, dt * 0.5);
	}
	if (under !== frame.under) { frame.under = under; dom.veil.style.opacity = under ? '1' : '0'; }
	const dazed = W.shrooms?.muffle() || 0;
	if (under || dazed > 0 || muffle.k > 0.01) underwaterAudio(under ? Math.min(1, 0.75 + (surf - camera.position.y) * 0.03) : dazed, dt);
	const sh = W.shells.update(dt, iw.time);
	const show = (el, on) => { const d = on ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d; };
	show(dom.shell, sh === 'near' && !W.boat.boarded()); show(dom.toss, sh === 'held'); show(dom.place, sh === 'held');
	actions();
	followGround(W, dt, open);
	followFarGround(W, dt, sk.night);
	W.vegetation.stream(camera, false);
	W.vegetation.react(dt, camera.position);
	if (W.kineticEpoch !== W.globe?.frame?.epoch) { W.kinetic.clear(); W.kineticEpoch = W.globe?.frame?.epoch; }
	W.kinetic.update(dt, { listener: camera.position });
	W.village.update(iw.time, sk.night);
	W.cottages?.update(camera.position, dt);
	// the old far islands and hill town belong to other worlds; on Earth the real coast is there
	W.distant.group.visible = !W.bayArea;
	if (!W.bayArea) W.distant.update(iw.time, sk.night);
	W.plumes.update(dt, camera, W.sky);
	W.powerlines?.update(camera, dt);
	W.contrails?.update(dt, camera);
	W.flush?.update(dt, camera);
	W.fauna.update(iw.time, sk.night, camera.position);
	W.landFauna.update(dt, iw.time, sk.night, camera.position, camera.position.y > -0.5);
	W.bridge?.update(iw.time, sk.night);
	W.sanMateo?.update(camera, sk.night);
	W.civ?.update(camera);
	if (W.civ) { const ll = globeLL(camera.position.x, camera.position.z); earthDirector.update(ll.lat, ll.lon, dt); }
	W.real?.update(camera);
	W.diablo?.update(dt, iw.time, camera, sk.night);
	W.landmarks?.update?.(dt, camera);
	W.city?.update(camera, sk.night);
	// the businesses' fronts by the hour, and the regional kit's towns planned too (economy/layer.js)
	W.city?.economy?.tick(camera.position, W.sky.state.hours, sk.night, dt);
	W.forestFloor?.update(camera);
	W.edge?.update(dt, iw.time, camera, sk.night);
	W.houses?.update(camera, dt, sk.night);
	if (W.commercial) {
		W.commercial.update(camera, dt, W.sky.state.hours, sk.night);
		W.towers?.update(dt, camera, W.sky.state.hours, sk.night);
		W.interiors?.update(camera, dt, W.sky.state.hours, sk.night);
		W.structures?.update(dt, sk.night, W.sky.state.hours);
		W.services?.update(dt, W.sky.state.hours, sk.night);
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
	// indoors by day the eye opens up to the light from the windows (by night, not at all:
	// the rooms are as dark as their lamps leave them)
	iw.indoorK += ((W.houses?.inside(camera.position) || W.interiors?.inside(camera.position) ? 1 : 0) - iw.indoorK) * Math.min(1, dt * 1.2);
	renderer.toneMappingExposure *= (1 + iw.indoorK * 0.55 * sk.dayK) * magic.exposure();
	watchDoor(dt);
	striker.update(dt, scene, !W.player.state.flying && !arcade.active() && dom.mount.style.display !== 'none');
	strikeRipples.update(dt);
	sunGlare(dt);
	watchTeleport();
	share.update(dt);
	multiplayer.update(dt, iw.time);
	HOOKS.chat?.update(dt);
	gear.update(dt);
	// (the skills and magic menu open: the fight holds its breath)
	if (!window.L99Loading.active()) { if (!magic.menuOpen()) combat.update(dt); magic.update(dt); }
	// (your guild's townsfolk out at your side, or home: guild/companions.js)
	if (!window.L99Loading.active() && !magic.menuOpen()) HOOKS.guild?.update(dt);
	HOOKS.military?.update(dt, sk.night);
	HOOKS.cataclysm?.update(dt, sk);
	if (!window.L99Loading.active()) HOOKS.law?.update(dt);
	// where you are, kept every few seconds so a reload carries on from here
	if (iw.visible && !window.L99Loading.active() && !arcade.active() && !W.orbit?.active()) share.keep();
	W.street?.update(dt, iw.time, camera, sk.night);
	W.contact?.update(camera, dt);
	W.vehicles?.update(dt, iw.time);
	ragdolls.update(dt);
	W.berms?.update(camera);
	W.freeways?.update(camera);
	W.signage?.update(dt, camera, sk.night, iw.drive.active());
	bridgeSound.update(dt);
	W.streets?.update(dt, sk.night, W.sky.state.hours);
	crosswalks.update(dt);
	W.lake?.update(dt, iw.time, camera, sk.night);
	W.water?.update(dt, iw.time, camera, sk.night);
	W.spray?.update(dt, camera);
	W.saltPonds?.update(dt, iw.time, camera);
	if (W.tidepools) {
		W.tidepools.update(dt, iw.time, camera);
		// arriving on a reef: what to look for
		const tp = camera.position.y < 60 ? W.tidepools.siteAt(camera.position.x, camera.position.z) : null;
		if (tp && tp !== W.tpSeen) hint(`${tp.name}\nLow tide: look in the pools for ochre sea stars, green anemones and purple urchins${tp.seals ? '. Harbor seals haul out on the outer rocks.' : '.'}`, 7000);
		if (tp) W.tpSeen = tp;
	}
	W.wildlife?.update(dt, iw.time, camera, W.sky.state.hours);
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
		W.beaches.update(dt, iw.time, camera, sk.night);
		const bc = camera.position.y < 150 ? W.beaches.beachAt(camera.position.x, camera.position.z) : null;
		if (bc && bc !== W.beachSeen && !W.tidepools?.siteAt(camera.position.x, camera.position.z)) hint(`${bc.name}${bc.quiet ? '\nA quiet stretch: few people, the sound of the surf.' : bc.big ? '\nMavericks breaks half a mile out, in winter the biggest waves on the coast.' : bc.surf ? '\nSurf zone between the checkered flags.' : bc.tents ? '\nCampsites along the back of the beach.' : ''}`, 6000);
		if (bc) W.beachSeen = bc;
	}
	if (arcade.active()) fishing.drop();
	fishing.update(dt, iw.time, !arcade.active() && !W.player.state.flying && !iw.drive.active() && !W.boat.boarded() && camera.position.y > -0.3);
	W.roads?.update(iw.time, sk.night);
	shaderWarm.tick(dt, { frameMs: iw.frameAvg });
	shaderWarm.buildHeld();
	guide.update(dt);
	watchTalk(dt);
	people.update(dt, iw.time, camera.position, sk.night, camera.position.y > -0.5);
	dogWalkers.update(dt, camera);
	chatter.update(dt, camera.position.y > -0.5 && !arcade.active() && !W.orbit?.active() && !window.L99Loading.active());
	encounterPacing.tick(dt);
	errands.update(dt);
	npcQuests.update(dt);
	livingWorld.update(dt);
	communityProjects.update(projectDelta);
	iw.projectRefresh-=projectDelta; if(iw.projectRefresh<=0){iw.projectRefresh=1;iw.projectSnapshot=communityProjects.snapshot();} iw.projectMarks.update(projectDelta);
	fares.update(dt);
	families.update(dt, iw.time, camera.position.y > -0.5);
	social.update(dt, iw.time, camera.position.y > -0.5 && !W.orbit?.active());
	waypoint.update(dt, iw.time, !W.orbit?.active() && !arcade.active());
	people.demo(dt, iw.time, camera.position);
	ghost.update(dt, iw.time, camera, sk.night);
	picnic.update(dt, iw.time, iw.visible);
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
	if (!explore.on()) W.labels?.update(camera.position, Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z)) < W.island.half);
	// a mushroom eaten: sizes swell and shrink (the field of view, from where it stood), and
	// the frame is drawn through its effect; sober, it draws nothing and the frame is as ever
	W.shrooms?.update(dt, iw.time);
	// (and the player's own: wider in a sprint or a slide, player.js)
	const fovK = arcade.active() ? 1 : (W.shrooms?.fov() ?? 1) * (W.player.state.fovK || 1);
	if (fovK !== 1 && !tick.fov0) tick.fov0 = camera.fov;
	if (tick.fov0) { camera.fov = tick.fov0 * fovK; camera.updateProjectionMatrix(); if (fovK === 1) tick.fov0 = 0; }
	W.rays?.update(dt, camera, { W, wx, caveK, under, hours: W.sky.state.hours, frameMs: iw.frameAvg });
	// (behind the arrival card nothing is drawn until the place is in: the time goes to loading it)
	// (on the lighter tiers the shadows are drawn every other frame: world/governor.js)
	const shadowEvery = qualityNow().shadowEvery;
	renderer.shadowMap.autoUpdate = shadowEvery <= 1;
	if (shadowEvery > 1 && (tick.shadowN = (tick.shadowN || 0) + 1) % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
	// (the sky in what people wear, as strong as the day, dim indoors and underground)
	kitDaylight(renderer, W.sky, (W.houses?.inside?.(camera.position) || W.interiors?.inside?.(camera.position) ? 0.35 : 1) * (1 - caveK * 0.8) * (under ? 0.4 : 1));
	// the sea's mirror, before the frame that reads it (only what stands over the water: world/seamirror.js)
	// (not on a world with no sea, nor down a cave or indoors, where the water is out of sight)
	// (while the skills menu covers the frame nothing is drawn, so neither are they; left as they
	// are rather than reset, so closing the menu does not warm their shaders again)
	HOOKS.lightPad?.update(now, camera);
	const covered = magic.covering(), seaOn = !iw.arrival?.blind && !(isPhone && now - shownAt < MIRROR_EASE) && W.island.hasOcean !== false && W.ocean.visible && caveK < 0.5 && iw.indoorK < 0.5;
	if (covered) { /* the menu over it all */ } else if (seaOn) {
		seaMirror.render(scene, camera, [W.terrain, W.vegetation?.group, W.farForest?.group, W.village?.group, W.distant?.group, W.bayArea?.group, W.bridge?.group, W.sanMateo?.group, W.city?.group], under || shared.uUnder.value);
		seaDepth.render(scene, camera, under || shared.uUnder.value);
	} else { seaMirror.reset(); seaDepth.reset(); }
	if (iw.arrival?.blind || covered || W.beyond?.render()) { /* hidden (the skills menu over it all), or drawn through the horizon */ } else if (!W.shrooms?.render(renderer, scene, camera)) { renderer.render(scene, camera); magic.post?.(renderer); W.rays?.post(); W.arch?.post?.(); gear.post(renderer); }
	W.orbit?.render(iw.time);
	// the governor: a tier down when the frames or the memory say so, back up after a long easy
	// run (world/governor.js)
	iw.frameAvg += (elapsed * 1000 - iw.frameAvg) * 0.05;
	HOOKS.perf?.frame(now);
	// (on a phone stepped down to the lighter tiers the local voice model, 100 MB, is let go too)
	if (governor.update(elapsed, iw.frameAvg)) { applyQuality(); if (isPhone && qualityNow().fx === 'low') guide.voice.unload?.(); }
}
