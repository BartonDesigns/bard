// City-wide catastrophes, engine-wide and rare. The director keeps the game's own clock (the
// sky's hours unwrapped, kept in this browser), works out the region you are in (the people's
// regions: people/moral-regions.js through people/npc-quests.js) and what its land allows,
// and asks cataclysm/schedule.js each few seconds whether one is due there: the same world
// seed gives the same catastrophes on the same game days for everyone. When one comes:
//
//   quake      cataclysm/quake.js: the shaking, the buildings broken through structures/, the
//              glass, the car alarms, the cracks in the street, the aftershocks
//   wildfire   cataclysm/wildfire.js: a front running through the dry country, smoke, embers,
//              houses catching, engines to the line
//   eruption   cataclysm/eruption.js: a magma world's great eruption, the ash and the tremors
//
// and, whatever it is: the crews held off (structures.cataclysm(true)) for as long as it lasts
// and a recovery after, then let back all at once; the services and the military sent and the
// people sheltering (cataclysm/response.js); things for you to do (cataclysm/quests.js); the
// alert and the news on screen (cataclysm/hud.js); the sky tinted by smoke or ash; the view
// shaken. Everything scales down on a phone.
//
// For the other modules (HOOKS.cataclysm): on(fn) hears { type: 'start' | 'phase' | 'over' |
// 'recovered', kind, region: { id, name }, severity 0..1, magnitude (a quake's), x, z, r (the
// reach in metres), phase, at (game hours) }; state() is the same for what is happening now,
// or null; active() and recovering() say whether one is under way. The economy can close
// shops, raise prices or pay out insurance from these. The console: Crysis.cataclysm().

import * as THREE from 'three';
import { envOf, due, upcoming, phaseOf, headline, quakeRadius, RECOVERY_H, DAY, NAMES, hashOf } from './schedule.js';
import { createFx } from './fx.js';
import { createCataclysmSound } from './sound.js';
import { createAlertHud } from './hud.js';
import { createResponse } from './response.js';
import { createQuests } from './quests.js';
import { createQuake } from './quake.js';
import { createWildfire } from './wildfire.js';
import { createEruption } from './eruption.js';
import { today } from '../calendar.js';

const KEY = 'l99.cataclysm.v1';
const SMOKE = new THREE.Color(0.56, 0.34, 0.2), ASH = new THREE.Color(0.34, 0.32, 0.31), DUST = new THREE.Color(0.62, 0.56, 0.48), SUNSET = new THREE.Color(1, 0.42, 0.16);
const _c = new THREE.Color(), _w = { x: 0, z: 0 };

export function createCataclysm({ scene, camera, mount, world, shared = {}, renderer = null, isPhone = false, people = null, hooks = {}, hint = () => {}, persona = null }) {
	const W = () => world();
	// ---------- what is kept ----------
	let S = { t: 0, seen: [], lastAt: -1e9 };
	try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') S = { t: +o.t || 0, seen: Array.isArray(o.seen) ? o.seen.slice(-60) : [], lastAt: Number.isFinite(o.lastAt) ? o.lastAt : -1e9 }; } catch { /* private mode: a clock for this visit */ }
	let saveT = 0, lastH = null;
	const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* full or blocked */ } };
	function tick(hours, dt) {
		if (Number.isFinite(hours)) { if (lastH !== null) { let d = hours - lastH; if (d < -12) d += 24; if (d > 0 && d < 6) S.t += d; } lastH = hours; }
		if ((saveT -= dt) <= 0) { saveT = 10; save(); }
	}

	// ---------- the parts ----------
	const ground = (x, z) => W()?.island?.heightAt?.(x, z) ?? 0;
	// (marks lie on what is walked: the graded roads and sidewalks over the terrain)
	const surface = (x, z) => { const w = W(), h = ground(x, z), f = w?.player?.floorAt?.(x, z, h + 3); return Number.isFinite(f) ? Math.max(h, f) : h; };
	const fx = createFx(scene, { isPhone, ground: surface });
	const sound = createCataclysmSound(camera, { isPhone });
	const hud = createAlertHud(mount, { isPhone });
	let A = null, R = null, env = envOf({}), region = { id: 'here', name: '' }, lastW = null, checkT = 2, rate = 1, shakeT = 0, newsQ = [], recoveredT = 0;
	const listeners = [];
	const place = () => A?.place || region.name || '';
	const cause = () => (A ? { quake: 'the earthquake', wildfire: 'the wildfire', eruption: 'the eruption' }[A.ev.kind] : 'the disaster');
	const news = (line) => hud.news(line);
	const say = (p, text, gesture = 'nod', feel = {}) => { try { if (p?.active) hooks.chatter?.say?.(p, { text, gesture, feel }, null); } catch { /* no voices */ } };
	let wild = null;
	const response = createResponse({ scene, world, hooks, people, isPhone, camera, persona, cause, threat: (x, z) => (A?.ev.kind === 'wildfire' ? wild.threat(x, z) : null), hose: (cx, cz, tx, tz) => wild?.hose(cx, cz, tx, tz) });
	const quests = createQuests({
		hooks, world, camera, isPhone, hud, response, say, cause,
		front: () => wild?.front(),
		spray: (from, to) => fx.spray(from.x, from.y - 0.45, from.z, to.x, to.y, to.z, 3),
		// (lifting the rubble: broken pieces heaved aside, the dust)
		heave: (at) => { const D = hooks.structures?.debris, g = ground(at.x, at.z); if (!D) return; const a = Math.random() * 6.28; D.chunk(at.x + Math.cos(a) * 0.5, g + 0.6, at.z + Math.sin(a) * 0.5, Math.cos(a) * 2.5, 2.5, Math.sin(a) * 2.5, [0.4, 0.25, 0.35], [0.42, 0.4, 0.38]); D.puff(at.x, g + 0.4, at.z, isPhone ? 3 : 6, 0.8, 0.6); },
		onDone: () => { if (A) A.helped = (A.helped || 0) + 1; },
	});
	const parts = { world, hooks, isPhone, fx, sound, response, quests, camera, people, news, place, shared, dry: () => env.dry };
	const quake = createQuake(parts);
	wild = createWildfire(parts);
	const erupt = createEruption(parts);
	const runner = (k) => (k === 'quake' ? quake : k === 'wildfire' ? wild : erupt);

	// ---------- where you are ----------
	function regionNow() {
		const r = hooks.npcQuests?.regionNow?.(true);
		if (r?.id && r.id !== 'here') return { id: r.id, name: r.name || r.id };
		const key = hooks.combat?.worldKey?.() || 'here';
		return { id: `world:${key}`, name: hooks.combat?.placeName?.() || shared.planet?.name || '' };
	}
	function envNow() {
		const w = W(), bay = region.id.startsWith('bay.'), earth = !!w?.bayArea || bay;
		let wild01 = 0.5;
		if (earth) { const me = camera.position; let s = 0; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; s += wild.fuelAt(me.x + Math.cos(a) * 400, me.z + Math.sin(a) * 400); } wild01 = s / 8; }
		return envOf({ earth, bay, planet: earth ? '' : shared.planet?.type || '', month: today().getMonth() + 1, wild: wild01 });
	}
	const seedNow = () => (shared.planet?.seed ?? W()?.seed ?? 1337) >>> 0;

	// ---------- telling the others ----------
	function state() {
		if (!A) return null;
		const ev = A.ev;
		return { kind: ev.kind, region: { ...A.region }, severity: ev.severity, magnitude: ev.magnitude ?? null, x: Math.round(A.at.x), z: Math.round(A.at.z), r: A.r, phase: A.phase, at: +S.t.toFixed(2), id: ev.id };
	}
	function emit(type, extra = {}) {
		const e = { type, ...(state() || (R ? { kind: R.ev.kind, region: { ...R.region }, severity: R.ev.severity, magnitude: R.ev.magnitude ?? null, x: Math.round(R.at.x), z: Math.round(R.at.z), r: R.r, phase: 'recovery', at: +S.t.toFixed(2), id: R.ev.id } : {})), ...extra };
		for (const f of listeners.slice()) { try { f(e); } catch { /* a listener gone */ } }
	}

	// ---------- the course of one ----------
	const GUIDE = {
		quake: { shaking: 'Drop, cover and hold on. Stay away from glass and walls.', aftermath: (s) => `Stay clear of damaged buildings. Shelter at ${s}.` },
		wildfire: { burning: (s) => `Leave now: move away from the fire and the smoke. Shelter at ${s}.`, aftermath: 'The fire is held. Stay out of the burn area: hot spots remain.' },
		eruption: { ash: (s) => `Ash is falling. Cover your mouth and nose; shelter at ${s}.`, aftermath: 'The ash is thinning. Stay indoors where you can.' },
	};
	const guide = (k, ph) => { const g = GUIDE[k]?.[ph]; return typeof g === 'function' ? g(response.shelter()?.name || 'open ground') : g || ''; };
	function begin(ev, opts = {}) {
		if (A) finish(true);
		if (R) recover(true);
		region = regionNow();
		const me = camera.position;
		let at = null;
		if (ev.kind === 'quake') { at = opts.at || { x: me.x + Math.cos(ev.bearing) * ev.distance, z: me.z + Math.sin(ev.bearing) * ev.distance }; quake.start(ev, at); }
		else if (ev.kind === 'wildfire') {
			at = wild.start(ev);
			if (!at) {
				// (nothing to burn round here: a brush fire that was out before it began)
				markSeen(ev);
				if (opts.console) hint('No dry country near enough here for a wildfire. Try the hills.', 4000);
				return 'nothing to burn near here';
			}
		} else at = erupt.start(ev);
		A = { ev, at, t: 0, phase: '', region: { ...region }, place: region.name, r: ev.kind === 'quake' ? quakeRadius(ev.magnitude) : ev.kind === 'wildfire' ? 600 : 9000, helped: 0, newsAt: 0 };
		markSeen(ev);
		hooks.structures?.cataclysm?.(true);
		response.start({ x: at.x, z: at.z, kind: ev.kind });
		hud.show(headline(ev, region.name), '');
		hud.setPhase(NAMES[ev.kind].toUpperCase());
		sound.alert();
		newsQ = newsFor(ev);
		emit('start');
		return state();
	}
	function markSeen(ev) { if (!S.seen.includes(ev.id)) S.seen.push(ev.id); S.seen = S.seen.slice(-60); S.lastAt = S.t; save(); }
	// the news as it comes in, by seconds since it began
	function newsFor(ev) {
		const P = region.name || 'the area', sh = () => response.shelter()?.name || 'open ground';
		if (ev.kind === 'quake') return [
			[8, () => `Seismologists put it at magnitude ${ev.magnitude.toFixed(1)}, centred close to ${P}.`],
			[24, () => `Hospitals near ${P} are on emergency footing. Ambulances are out.`],
			[40, () => `A relief station is open at ${sh()}: water, first aid, cots.`],
			[70, () => 'Police ask people to stay off the roads and leave them to the emergency crews.'],
			[110, () => 'Gas and power crews are shutting off damaged lines across the area.'],
			[170, () => 'The Meridian Guard is helping with search and rescue.'],
		];
		if (ev.kind === 'wildfire') return [
			[6, () => `A fast-moving wildfire is burning in the dry hills near ${P}.`],
			[30, () => `Evacuation orders for the neighbourhoods downwind. Shelter is open at ${sh()}.`],
			[60, () => 'Air quality is very unhealthy downwind. Stay indoors if you can.'],
			[110, () => 'Engine companies from across the region are on the fire line.'],
			[200, () => 'The wind is expected to ease tonight, giving crews a chance.'],
		];
		return [
			[5, () => 'The volcano has erupted. Ash is falling across the region.'],
			[40, () => 'Lightning is striking inside the ash cloud. Keep away from high ground.'],
			[100, () => 'Ash on roofs can be heavy: do not climb up to clear it.'],
		];
	}
	function onPhase(ph) {
		A.phase = ph;
		const k = A.ev.kind;
		if (ph === 'over') return;
		response.setPhase(ph);
		hud.setPhase(ph === 'shaking' ? 'SHAKING' : ph === 'burning' ? 'SPREADING' : ph === 'ash' ? 'ASHFALL' : 'AFTERMATH');
		hud.say(guide(k, ph));
		if (ph === 'aftermath' || ph === 'burning' || ph === 'ash') response.sendUnits(A.at, A.ev.severity);
		if (ph === 'aftermath' && k === 'eruption') erupt.settle();
		emit('phase');
	}
	// the emergency over: the recovery begins (the crews still held off until it ends)
	function finish(quiet = false) {
		if (!A) return;
		const ev = A.ev, left = quests.clear();
		runner(ev.kind).stop();
		response.end();
		R = { ev, at: A.at, r: A.r, region: { ...A.region }, until: S.t + RECOVERY_H * (0.6 + ev.severity * 0.8), helped: A.helped };
		A = null;
		if (!quiet) {
			hud.setPhase('RECOVERY');
			hud.say(left ? 'The all-clear. Crews and the Guard are taking over the rescue.' : 'The all-clear. Repair crews are on their way to the damage.');
			news(R.helped ? `People in ${R.region.name || 'the area'} are talking about the stranger who helped (${R.helped}).` : `${NAMES[ev.kind]} recovery under way in ${R.region.name || 'the area'}.`);
		}
		emit('over');
	}
	// the recovery over: the crews come, all of them at once
	function recover(quiet = false) {
		if (!R) return;
		hooks.structures?.cataclysm?.(false);
		response.strike();
		const was = R;
		emit('recovered');
		R = null;
		if (!quiet) { hud.setPhase('REBUILDING'); hud.say('Repair crews are moving in across the damage.'); recoveredT = 10; }
		else { hud.hide(); fx.clearMarks(); }
		return was;
	}
	// a new world: whatever was happening ends where it is
	function reset() {
		if (A) { runner(A.ev.kind).stop(); response.end(); quests.clear(); A = null; }
		if (R) { response.strike(); R = null; }
		fx.clear(); sound.stop(); hud.hide();
	}

	// ---------- each frame ----------
	const LIGHT = { color: new THREE.Color(1, 1, 1), day: 1 };
	function update(dt, sk = null) {
		const w = W();
		if (!w) return;
		if (w !== lastW) { if (lastW) reset(); lastW = w; checkT = 4; }
		tick(w.sky?.state?.hours, dt);
		// is one due here?
		if ((checkT -= dt) <= 0) {
			checkT = 3;
			region = regionNow();
			if (!A && !R && !window.L99Loading?.active?.()) {
				env = envNow();
				const ev = due(seedNow(), region.id, S.t, env, { seen: S.seen, lastAt: S.lastAt, rate });
				if (ev) begin(ev);
			}
		}
		fx.begin();
		let shakeK = 0, smoke = 0, ash = 0, dust = 0, flash = 0;
		if (A) {
			A.t += dt;
			const ph = phaseOf(A.ev, A.t, A.ev.kind === 'wildfire' ? wild.heldAt() : null);
			if (ph !== A.phase) onPhase(ph);
			const k = runner(A.ev.kind).update(dt);
			if (A.ev.kind === 'quake') { shakeK = k; dust = Math.max(0, 0.3 - Math.max(0, A.t - 40) / 300) * Math.min(1, A.t / 6); }
			if (A.ev.kind === 'eruption') { shakeK = k; ash = erupt.ash(); flash = erupt.flash(); }
			if (A.ev.kind === 'wildfire') smoke = wild.smokeHere();
			while (newsQ.length && A.t >= newsQ[0][0]) news(newsQ.shift()[1]());
			response.update(dt);
			quests.update(dt);
			if (A.phase === 'over') finish();
		}
		if (R && S.t >= R.until) recover();
		if (recoveredT > 0 && (recoveredT -= dt) <= 0 && !A && !R) { hud.hide(); fx.clearMarks(); }
		hud.update(dt);
		sound.update();
		// the view shaken: a sway and a roll of the ground under you, a jolt through it
		if (shakeK > 0.01 && !w.player?.state?.flying) {
			shakeT += dt;
			const a = shakeK * (isPhone ? 0.024 : 0.03);
			const roll = Math.sin(shakeT * 2.1) * 0.6 + Math.sin(shakeT * 3.4 + 0.7) * 0.4, jolt = Math.sin(shakeT * 13.3) * 0.55 + Math.sin(shakeT * 21.1 + 1.9) * 0.45;
			camera.rotation.x += a * (jolt * 0.55 + roll * 0.25);
			camera.rotation.z += a * roll * 0.7;
			camera.rotation.y += a * Math.sin(shakeT * 16.7 + 2.3) * 0.3;
			// (the trees thrash)
			if (shared.uGust) shared.uGust.value = Math.max(shared.uGust.value, shakeK * 1.6);
		}
		// the sky: smoke (brown-orange, the sun a red disc), ash (grey-brown, dim), dust
		const tint = Math.max(smoke, ash, dust);
		if (tint > 0.01 && scene.fog && scene.fog.density > 0 && w.sky) {
			const col = smoke >= ash && smoke >= dust ? SMOKE : ash >= dust ? ASH : DUST;
			const lum = 0.15 + 0.85 * (sk?.dayK ?? 1);
			scene.fog.color.lerp(_c.copy(col).multiplyScalar(lum), tint * 0.75);
			scene.fog.density *= 1 + tint * (smoke > 0 ? 5 : ash > 0 ? 7 : 2.5);
			shared.uSkyHor?.value.lerp(_c.copy(col).multiplyScalar(lum * 1.1), tint * 0.8);
			shared.uSkyZen?.value.lerp(_c.copy(col).multiplyScalar(lum * 0.55), tint * 0.65);
			if (smoke > 0) { w.sky.sun.color.lerp(SUNSET, tint * 0.85); shared.uSunColor?.value.lerp(SUNSET, tint * 0.85); }
			w.sky.sun.intensity *= 1 - tint * (ash > 0 ? 0.7 : 0.5);
			w.sky.hemi.intensity *= 1 - tint * 0.3;
		}
		if (flash > 0 && w.sky) w.sky.hemi.intensity += flash * 2.2;
		LIGHT.color.copy(w.sky?.hemi?.color || _c.set(1, 1, 1)); LIGHT.day = sk?.dayK ?? 1;
		const d = shared.uWindDir?.value, ws = 1 + (shared.uWind?.value ?? 0.5) * 4;
		_w.x = (d ? d.x : 0.9) * ws; _w.z = (d ? d.y : 0.3) * ws;
		fx.end(dt, camera, renderer, LIGHT, _w);
	}

	// ---------- the console ----------
	function trigger(kind, o = {}) {
		region = regionNow();
		if (kind === 'eruption' && !W()?.volcano && !String(shared.planet?.type || '').match(/MAGMA|VOLCANIC/i) && !o.force) return 'Eruptions are for magma worlds (or Crysis.cataclysm.eruption({ force: true })).';
		const sev = Math.max(0, Math.min(1, o.severity ?? (kind === 'quake' ? ((o.magnitude ?? 6.8) - 5.4) / 2.2 : 0.6)));
		const ev = { id: `${kind}:console:${Date.now().toString(36)}`, kind, region: region.id, day: Math.floor(S.t / DAY), start: S.t, severity: +sev.toFixed(2), bearing: o.bearing ?? Math.random() * 6.28, distance: o.distance ?? (kind === 'quake' ? 90 : 300), seed: hashOf('console', Date.now()) };
		if (kind === 'quake') ev.magnitude = Math.round((o.magnitude ?? (5.4 + sev * 2.2)) * 10) / 10;
		return begin(ev, { console: true, at: o.at });
	}
	function info() {
		const k = A?.ev.kind;
		return {
			active: state(), t: A ? +A.t.toFixed(1) : null,
			detail: k ? runner(k).info() : null,
			response: response.info(), quests: quests.info(),
			recovery: R ? { kind: R.ev.kind, left: +(R.until - S.t).toFixed(2), region: R.region.name } : null,
			crews: hooks.structures?.cataclysm?.() ?? null,
			clock: +S.t.toFixed(2), day: Math.floor(S.t / DAY), region: { ...region }, env: { ...env }, rate,
			next: upcoming(seedNow(), region.id, S.t, 400, env, rate)[0] || null,
			hud: hud.text(), fx: fx.counts(),
		};
	}
	const api = Object.assign(() => info(), {
		// Crysis.cataclysm.quake(6.9) near you now (or { at: { x, z } }); .wildfire(0.7); .eruption()
		quake: (mag = 6.8, o = {}) => trigger('quake', { ...o, magnitude: +mag }),
		wildfire: (sev = 0.65, o = {}) => trigger('wildfire', { ...o, severity: +sev }),
		eruption: (o = {}) => trigger('eruption', typeof o === 'object' ? o : { severity: +o }),
		// .end() calls the all-clear (recovery begins); .recover() lets the crews in now; .clear() all of it
		end: () => { if (!A) return 'nothing under way'; finish(); return info().recovery; },
		recover: () => (R ? (recover(), 'crews released') : 'no recovery under way'),
		clear: () => { reset(); return 'cleared'; },
		// the coming ones in this region (n days), and a rate for testing (1 as made)
		upcoming: (days = 365) => upcoming(seedNow(), region.id, S.t, days, env, rate),
		rate: (k) => { if (k !== undefined) rate = Math.max(0, +k || 0); return rate; },
		// run the one under way on by seconds
		skip: (s = 30) => { if (!A) return null; A.t += +s; const run = runner(A.ev.kind), r = run.state(); if (r) r.t += +s; run.advance?.(+s); return +A.t.toFixed(1); },
		state, on: (f) => subscribe(f),
	});
	function subscribe(f) { if (typeof f !== 'function') return () => {}; listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; }
	return {
		update, info, state, api, mark: () => quests.mark(),
		on: subscribe,
		active: () => !!A, recovering: () => !!R,
		trigger, reset,
		dispose() { reset(); fx.dispose(); hud.dispose(); },
	};
}
