// Fares (the numbers and words in fares-core.js): while you drive, now and then someone on the
// pavement up ahead hails you. Pull up beside them and stop, and they get in; the pin shows
// where they are going. Stop near it and they pay: the fare by the distance, a tip for a quick
// and smooth ride. Their own voice in the car, a word if you drive like a maniac.
import * as THREE from 'three';
import { quote, settle, step, line } from './fares-core.js';

const STORE = 'crysis-fares-v1';
const BOARD = 7, ARRIVE = 16, SLOW = 2.5;
const _f = new THREE.Vector3();

export function createFares({ camera, world, people, chatter, persona, drive, arms, hint, isPhone }) {
	let F = null, cool = 45, look = 0, n = 0, last = null, hitCool = 0, fastT = 0, fastCool = 0;
	let tally = { rides: 0, earned: 0, five: 0 };
	try { tally = { ...tally, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { /* private mode */ }
	const save = () => { try { localStorage.setItem(STORE, JSON.stringify(tally)); } catch { /* private mode */ } };
	const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

	function groundAt(x, z) {
		const W = world(), h = W?.island?.heightAt?.(x, z);
		if (!Number.isFinite(h) || h < 0.6) return null;
		const L = W.real?.landAt?.(x, z);
		if (L && L.roof > 0.5) return null;
		return h;
	}
	function placeName(x, z, y) { try { return world()?.labels?.where?.(x, z, y, false)?.name || ''; } catch { return ''; } }
	// somewhere to go: a kerb a few hundred metres to a kilometre or so off, on dry land
	// (a kerb if the streets are mapped there; else dry ground, nearer in where the land is small)
	function destination(from) {
		for (let k = 0; k < 60; k++) {
			const near = k >= 30, a = Math.random() * Math.PI * 2, d = near ? 150 + Math.random() * 300 : 350 + Math.random() * 950;
			let x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
			const sw = people.sidewalk?.(x, z);
			if (sw) { x = sw[0]; z = sw[1]; } else if (!near) continue;
			const y = groundAt(x, z);
			if (y === null) continue;
			return { x, y, z, metres: Math.hypot(x - from.x, z - from.z) * 1.25 };
		}
		return null;
	}

	// ---------- the person hailing, held at the kerb ----------
	function hold(p) {
		p.held = true;
		const mine = (q, dt, cam) => {
			const S = q.M.S, car = drive.carAt() || cam;
			q.M.want.speed = 0;
			q.M.want.heading = Math.atan2(car.x - S.pos.x, car.z - S.pos.z);
			if (!S.remark) S.look.target = camera.position;
			q.waveT = (q.waveT || 0) - dt;
			if (q.waveT < 0) { q.waveT = 2.6; q.M.gesture('wave'); }
			return true;
		};
		p.override = mine; p.heldBy = mine;
	}
	function release(p) {
		if (!p) return;
		if (p.override === p.heldBy) p.override = null;
		p.held = false; p.heldBy = null; p.reserved = false;
	}

	// the passenger in the car: their own voice, from the car (the body waits, unseen)
	function rider(p, at) {
		return { active: true, P: { dna: p.P.dna, height: p.P.height, root: { visible: true } }, M: { S: { pos: new THREE.Vector3(at.x, at.y + 1.1, at.z), look: { target: null }, feel: {}, remark: null }, gesture() {} } };
	}
	const speak = (who, kind, extra = {}) => chatter.say(who, { text: line(kind, { n: n++, ...extra }), gesture: kind === 'hail' ? 'wave' : null, feel: {} }, null);

	function hail(car) {
		const f = camera.getWorldDirection(_f);
		const list = people.pool.filter((q) => {
			if (!q.active || q.leaving || q.P.dna.child || q.P.dna.minor || q.engaged || q.override || q.held || q.demo !== undefined) return false;
			if (q.route?.kind === 'seat' || q.workSpot) return false;
			const dx = q.M.S.pos.x - car.x, dz = q.M.S.pos.z - car.z, d = Math.hypot(dx, dz);
			return d > 30 && d < 140 && (dx * f.x + dz * f.z) / d > 0.6;
		});
		if (!list.length) return false;
		const p = list[Math.floor(Math.random() * list.length)];
		const who = persona(p);
		F = { stage: 'hailing', p, name: who.first, t: 0, from: { x: p.M.S.pos.x, z: p.M.S.pos.z } };
		hold(p);
		speak(p, 'hail');
		if (!tally.rides) hint(`${who.first} is hailing you. Pull up beside them and stop to pick them up.`, 5000);
		return true;
	}

	function board(car) {
		const p = F.p, dest = destination(car);
		if (!dest) { go('leave'); return; }
		const r = step(F, 'board');
		const place = placeName(dest.x, dest.z, dest.y), here = placeName(car.x, car.z, car.y);
		F = { ...r.F, p, dest, place: place && place !== here ? place : '', fare: quote(dest.metres), t: 0, hits: 0, scares: 0, chat: false, near: false, rider: rider(p, car) };
		// the body waits, unseen and kept, until they get out
		p.reserved = true; p.active = false; p.P.root.visible = false;
		speak(F.rider, 'board', { place: F.place });
		hint(`${F.name}: ${F.place || 'the pin'} · ${(dest.metres / 1000).toFixed(1)} km · fare ${F.fare} credits`, 4000);
	}
	// out at the kerb, where the car stopped
	function alight(car) {
		const p = F.p;
		const sw = people.sidewalk?.(car.x + 3, car.z) || [car.x + 2.5, car.z];
		const y = groundAt(sw[0], sw[1]) ?? car.y;
		p.M.place(sw[0], y, sw[1], Math.random() * 6.28);
		p.active = true; p.P.root.visible = true; p.fade = 1; p.leaving = false; p.reserved = false;
		// (out of the car: their own day again, still kept about while they say goodbye)
		if (p.override === p.heldBy) p.override = null;
		return p;
	}

	function go(ev, car) {
		const r = step(F, ev);
		if (!r.out) return;
		const o = r.out, p = F.p;
		if (o.done) {
			const S = settle({ metres: F.dest.metres, seconds: F.t, hits: F.hits, scares: F.scares });
			const body = alight(car);
			speak(body, 'thanks', { stars: S.stars });
			const paid = arms()?.apply?.({ id: `fare:${F.name}:${Date.now()}`, kind: 'trade', peer: 'fare', give: { credits: 0, items: [] }, get: { credits: S.total, items: [] } });
			tally.rides++; tally.earned += S.total; if (S.stars === 5) tally.five++; save();
			last = S;
			hint(`${paid?.ok === false ? 'Fare' : `+${S.total} credits`} (fare ${S.fare}${S.tip ? `, tip ${S.tip}` : ''}) · ${'★'.repeat(S.stars)}${'☆'.repeat(5 - S.stars)}${tally.rides === 1 ? ' · your first fare' : tally.rides % 10 === 0 ? ` · ${tally.rides} fares` : ''}`, 5000);
			endWith(body, 6);
			return;
		}
		if (o.lapsed) {
			if (F.stage === 'riding' || F.p.reserved) { const body = alight(car || drive.carAt() || camera.position); if (o.say) speak(body, 'out'); endWith(body, 4); }
			else endWith(p, 0);
		}
	}
	let releaseAt = [], clock = 0;
	function endWith(p, after) { releaseAt.push([p, clock + after]); F = null; cool = isPhone ? 70 : 45; }

	function update(dt) {
		clock += dt; cool = Math.max(0, cool - dt); hitCool = Math.max(0, hitCool - dt); fastCool = Math.max(0, fastCool - dt);
		if (releaseAt.length) releaseAt = releaseAt.filter(([p, t]) => { if (clock < t) return true; release(p); return false; });
		const car = drive.carAt();
		if (!car) { if (F) go('leave', null); return; }
		if (!F) {
			look -= dt;
			if (cool > 0 || look > 0) return;
			look = 2.5;
			if (Math.random() < 0.35) hail(car);
			return;
		}
		F.t += dt;
		if (F.stage === 'hailing') {
			const p = F.p;
			if (!p.active || p.override !== p.heldBy || flat(car, p.M.S.pos) > 320 || F.t > 120) { go('leave', car); return; }
			if (flat(car, p.M.S.pos) < BOARD && car.speed < SLOW) board(car);
			return;
		}
		// riding: their voice moves with the car; how you drive is noticed
		F.rider.M.S.pos.set(car.x, car.y + 1.1, car.z);
		const dv = (F.lastSpeed ?? car.speed) - car.speed;
		F.lastSpeed = car.speed;
		// (a jolt: losing speed far faster than any brake does)
		if (dv / Math.max(dt, 1e-3) > 25 && dv > 1.5 && hitCool <= 0) { F.hits++; hitCool = 2; speak(F.rider, 'hit'); }
		if (car.speed > 24) { fastT += dt; if (fastT > 3 && fastCool <= 0) { F.scares++; fastCool = 25; speak(F.rider, 'fast'); } } else fastT = 0;
		const d = flat(car, F.dest);
		if (!F.chat && F.t > 30 && d > 250) { F.chat = true; speak(F.rider, 'chat'); }
		if (!F.near && d < 90) { F.near = true; speak(F.rider, 'near'); }
		if (d < ARRIVE && car.speed < SLOW) go('arrive', car);
		if (F && F.t > 600) go('leave', car);
	}

	function mark() {
		if (!F) return null;
		if (F.stage === 'hailing') { const q = F.p.M.S.pos; return { x: q.x, y: q.y, z: q.z, radius: 3, title: `Pick up ${F.name}`, detail: 'pull up beside them and stop' }; }
		const q = F.dest;
		return { x: q.x, y: q.y, z: q.z, radius: ARRIVE, title: `Drive ${F.name} to ${F.place || 'the pin'}`, detail: `fare ${F.fare} credits` };
	}
	function dispose() { if (F) { if (F.p.reserved) { F.p.reserved = false; } release(F.p); F = null; } for (const [p] of releaseAt) release(p); releaseAt = []; }
	function info() { const c = drive.carAt(); return { car: c && { x: Math.round(c.x), z: Math.round(c.z), speed: +c.speed.toFixed(1) }, fare: F && { stage: F.stage, name: F.name, place: F.place, fare: F.fare, t: Math.round(F.t), hits: F.hits || 0, metres: F.dest && Math.round(F.dest.metres) }, last, cool: Math.round(cool), ...tally }; }
	// (console and tests: someone ahead hails now)
	function hailNow() { const car = drive.carAt(); if (!car) return 'drive first'; if (F) return 'already on a fare'; return hail(car) ? `${F.name} is hailing` : 'nobody ahead on the pavement'; }
	return { update, mark, info, dispose, hailNow, active: () => !!F };
}
