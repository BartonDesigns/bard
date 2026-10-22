// The people at work in the office seen down a scope, however far: a few at their desks in the
// room behind the window under the reticle (interiors/index.js scopeSeats), typing, reading, on
// the phone, there while the scope is on it and gone a little after. Real bodies (family-life.js
// makes them), so a shot through the window finds them as it would anyone (combat's people).
//
import { fadePerson } from './fade.js';
import { freeBody } from './social-actors.js';
import { scopeView } from '../crysis/scope-view.js';

const hash = (s, i) => { let h = (0x811c9dc5 ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619) >>> 0; return h; };

export function createScopeWorkers({ world, camera, isPhone = false, hours, ready, spawn, releaseBody = () => {} }) {
	const W = () => world();
	const CAP = isPhone ? 3 : 6, KEEP = 4;
	let cur = null, pickT = 0, offT = 0, seen = false;
	const actors = [], queue = [];

	// who sits where: the desks first, the busier the hour the more of them taken
	function staff(S) {
		const sits = S.seats.filter((q) => q.sit), pool = sits.length ? sits : S.seats;
		const order = pool.map((q, i) => ({ q, r: hash(S.key, i), desk: q.table ? 0 : 1 })).sort((a, b) => a.desk - b.desk || a.r - b.r);
		const n = Math.max(1, Math.min(CAP, pool.length, Math.round(pool.length * Math.max(S.k, 0.15) * 0.75)));
		return order.slice(0, n).map((x) => ({ seat: x.q, seed: x.r }));
	}
	function make(job) {
		const { seat: s, seed } = job;
		const a = spawn({ seed, age: 23 + (seed % 38), place: 'office', home: true });
		if (!a) return null;
		a.scopeWork = true; a.fade = 0; a.seat = s;
		a.M.setGround(() => s.y);
		a.M.place(s.x, s.y, s.z, s.heading);
		if (s.sit) a.M.sit(s.h || 0.46, true); else a.M.stand();
		// (at a desk: most at the keyboard, some reading; off one: on the phone)
		a.M.setPose(s.table ? (seed % 4 === 0 ? 'read' : 'type') : s.sit ? 'phone' : 'rest');
		a.M.S.talk = 0;
		actors.push(a);
		return a;
	}
	function leaveAll() { for (const a of actors) a.leaving = true; queue.length = 0; cur = null; }
	function drop(a) { a.active = false; releaseBody(a.P); freeBody(a.P); }

	function update(dt, t) {
		if ((pickT -= dt) < 0) {
			pickT = 0.5;
			const S = W()?.interiors?.scopeSeats?.(hours()) || null;
			seen = !!S;
			if (S) { offT = 0; if (S.key !== cur?.key) { leaveAll(); cur = { key: S.key }; queue.push(...staff(S)); } }
		}
		// (the scope off the room a while: they go)
		if (!seen && cur && (offT += dt) > KEEP) leaveAll();
		// one body a frame (each takes a few milliseconds to make)
		if (queue.length && ready()) make(queue.shift());
		const cam = camera.position, mag = scopeView.active && scopeView.aiming > 0.5 ? Math.max(1, scopeView.zoom * scopeView.mag) : 1;
		for (let i = actors.length - 1; i >= 0; i--) {
			const a = actors[i];
			if (a.leaving) {
				a.fade = Math.max(0, a.fade - dt / 1.2);
				fadePerson(a.P, a.fade);
				if (a.fade <= 0) { drop(a); actors.splice(i, 1); continue; }
			}
			if (!a.active) { actors.splice(i, 1); continue; }
			if (a.P.ragdoll) continue;
			const M = a.M, S = M.S;
			// (a fight near them: combat/civilians.js has their steering)
			if (a.override && a.override(a, dt, cam)) M.stand();
			else M.want.speed = 0;
			M.update(dt, t, cam);
			if (!a.leaving) { a.fade = Math.min(1, a.fade + dt * 1.5); fadePerson(a.P, a.fade); }
			// (their detail as they are seen: through the glass of the scope, near)
			a.P.lod?.(Math.hypot(S.pos.x - cam.x, S.pos.z - cam.z) / mag);
		}
	}
	function clear() { for (const a of actors) drop(a); actors.length = 0; queue.length = 0; cur = null; }
	return { update, clear, actors: () => actors, info: () => ({ room: cur?.key || null, people: actors.length, queued: queue.length }) };
}
