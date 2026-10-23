// The families at home. Walk up to a house (bay/houses.js builds it, rooms and furniture and
// all) and its household is in it, living the hour their day has them at (schedules.js): at
// breakfast, at work and school (the house empty), a grown-up working from home at a desk, the
// cook at the stove, dinner round the table, the evening on the sofa in front of the TV, the
// teens up in their rooms on their phones, a story on the edge of a little one's bed, and at
// night everyone asleep in their beds under the covers. Where each of them is comes from
// home-routine.js; this gives them bodies (the real ones, family-life.js's), moves them
// between their places as the hour turns, lights the TV, and keeps them alive to the world:
//   - come in on them and the nearest awake grown-up says so;
//   - a fight that comes in on them (through a window, through the wall, gunfire or a brawl
//     in the room) and they scatter: up from the table or out of bed, a line for the moment
//     ("I'm just having dinner!"), a run to the far side of the house, a crouch, and then
//     standing about shaken until they settle back into their evening.
//
// The city's homes the same (interiors/: San Francisco's row houses, the flats over its shops,
// each flat of an apartment block its own household), and the flat over a business in a
// house (bay/houses.js) whose ground floor is the business's.
//
// Only the house you are in or at (two on a computer) has its people shown; the household is
// whole there, never thinned. On a phone, of the city's, only the building you are in or
// right beside. Hooks for the rest of the game (the cooking thread's kitchen,
// the fridge, the homeowner walking in): homeAt(pos), whoIsHome(house) (bodies drawn there),
// homeNow(house, hour) (home by their day, drawn or not), householdOf(house),
// occupants(), and on(fn) for what happens ('scatter', 'greet').

import * as THREE from 'three';
import { spotsOf, arrange, lineFor, doingAt } from './home-routine.js';
import { makeHousehold, KINDS } from './households.js';
import { cultureOf } from '../region/cultures.js';
import { planDay } from './schedules.js';
import { fadePerson } from './fade.js';
import { freeBody } from './social-actors.js';

const Q = Math.PI / 2;
const hash = (a, b = 0) => { let h = Math.imul(Math.floor(a) | 0, 374761393) ^ Math.imul(Math.floor(b) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// a point of an item's frame (x across, z out of its front) in the house's frame
function itemPoint(it, px, pz) { const a = (it.rot || 0) * Q, c = Math.cos(a), s = Math.sin(a); return [it.x + px * c + pz * s, it.z - px * s + pz * c]; }
const GREET = {
	night: ['Uh... it is the middle of the night. Why are you in our house?', 'Honey? There is someone in the hall.', 'Can I help you? At this hour?'],
	eat: ['Oh! Um... we were just sitting down to eat. Are you hungry?', 'Hi? This is a family dinner.', 'Do we know you?'],
	tv: ['Shh, it is the good part.', 'Hi? We are kind of in the middle of something.', 'Are you a friend of the kids?'],
	cook: ['Hello? Mind the stove, it is hot.', 'If you are here about dinner, it is not ready yet.'],
	any: ['Uh... hi? Can we help you?', 'Did you knock?', 'The door was locked, was it not?', 'Hello? Who let you in?'],
};
// the duvet over someone asleep, and a throw on the sofa: one shape (a metre each way, its
// top a soft hump over the body, low at the edges and the ends), scaled to the bed
const LUMP = (() => {
	const g = new THREE.BoxGeometry(1, 1, 1, 10, 1, 14).translate(0, 0.5, 0), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		if (p.getY(i) < 0.5) continue;
		const fx = Math.max(0, 1 - Math.abs(2 * p.getX(i)) ** 3), fz = Math.max(0, 1 - Math.abs(2 * p.getZ(i)) ** 6);
		p.setY(i, 0.12 + 0.88 * fx * fz);
	}
	g.computeVertexNormals();
	g.userData.shared = true;
	return g;
})();
// lying in bed, the head raised a little on the pillow
const TILT = 0.14;
const COVERS = [0xe9e4da, 0xb9c6d6, 0x7d8fa6, 0xd9c2a8, 0x9aa88f, 0xc9b3c9, 0x5d6b7a, 0xefe9f2];
// what a TV shows, seen from across the room: a picture's light, changing
const TV_HUES = [[0.35, 0.5, 0.75], [0.8, 0.65, 0.45], [0.25, 0.45, 0.3], [0.7, 0.75, 0.85], [0.55, 0.3, 0.35], [0.9, 0.9, 0.95], [0.2, 0.25, 0.45]];

export function createHomeLife({ world, camera, parent, isPhone = false, areaAt, day, hours, ready, spawn, cap, releaseBody = () => {}, say = () => {}, foodFor = null }) {
	const W = () => world();
	const root = new THREE.Group(); root.name = 'home-life';
	parent.add(root);
	const homes = new Map();                    // home (a house of bay/houses.js, or a dwelling below) -> H
	const households = new Map();               // house key -> household (kept while near)
	const listeners = new Set();
	const queue = [];                           // bodies to make, one a frame
	const R = isPhone ? 16 : 34, HOUSES = isPhone ? 1 : 2;
	let pickT = 0, planT = 0, lastDay = -1, wallsOff = null, wallsOf = null, dead = false;
	const frustum = new THREE.Frustum(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
	const emit = (e) => { for (const f of listeners) { try { f(e); } catch (err) { console.warn('home-life listener', err); } } };

	// ---------- a house's household ----------
	// (a home out in the country goes by its own name, wherever the globe's frame lies: region/settle.js)
	const keyOf = (h) => h.key || h.grp?.homeId || `${Math.round(h.cx)}:${Math.round(h.cz)}`;
	function householdOf(h) {
		const key = keyOf(h);
		let hh = households.get(key);
		if (hh) return hh;
		// the neighbourhood's own (family-life.js) where it already has one for this door (a
		// house's; the flats stacked over one another have none of their own there)
		const a = areaAt?.(h.cx, h.cz);
		hh = h.key ? null : a?.households.find((q) => !q.unhoused && q.home && Math.abs(q.home.x - h.cx) < 1.5 && Math.abs(q.home.z - h.cz) < 1.5) || null;
		if (!hh) {
			// else one that fits the house: a small place for a couple or one person, a big one
			// for a family (the beds are counted, not the people culled)
			const beds = (h.plan.items || []).filter((it) => it.type === 'bed').length;
			const weights = beds <= 1 ? { couple: 18, single: 16, 'older-couple': 9, 'elder-alone': 3, 'single-parent': 3 } : beds === 2 ? { ...KINDS, multigenerational: 2, roommates: 4 } : KINDS;
			// (out in the country: the same family each time, and the place's own people)
			const tag = h.key || h.grp?.homeId, C = h.grp?.region ? cultureOf(h.grp.region) : null;
			let seed = h.grp?.homeId ? 0x6f3e : (Math.imul(Math.round(h.cx * 2) | 0, 73856093) ^ Math.imul(Math.round(h.cz * 2) | 0, 19349663) ^ 0x6f3e) >>> 0;
			if (tag) for (let i = 0; i < tag.length; i++) seed = Math.imul(seed ^ tag.charCodeAt(i), 16777619) >>> 0;
			hh = makeHousehold(seed, { x: h.cx, z: h.cz, kind: h.kind || 'house' }, { id: `home-${key}`, weights, ...(C ? { mix: [[C.ancestry, 1]] } : {}) });
			if (a) { foodFor?.(hh, a.place); a.households.push(hh); }
		}
		households.set(key, hh);
		if (households.size > 48) households.delete(households.keys().next().value);
		return hh;
	}

	// ---------- the house's frame in the world ----------
	const yawOf = (H) => H.h.root.rotation.y;
	function toWorld(H, lx, lz) { const h = H.h, c = Math.cos(yawOf(H)), s = Math.sin(yawOf(H)); return [(h.ox ?? h.cx) + lx * c + lz * s, (h.oz ?? h.cz) - lx * s + lz * c]; }
	// its broken windows, and whether a wall's root is its
	const panesOf = (h) => (h.panes ? h.panes() : h.openedPanes?.size || 0);
	const owns = (h, root) => (h.owns ? h.owns(root) : root === h.root);
	const floorOf = (H, spot) => H.h.floorY + (spot?.y || 0);

	function occupy(h) {
		const anchor = new THREE.Group();
		anchor.position.copy(h.root.position); anchor.quaternion.copy(h.root.quaternion);
		root.add(anchor);
		const hh = householdOf(h);
		const H = { h, key: keyOf(h), hh, spots: spotsOf(h.plan), plans: null, planDay: -1, actors: new Map(), prev: new Map(), anchor, tvs: new Map(), panes: panesOf(h), said: 0, greeted: false, inside: false, cover: COVERS[Math.floor(hash(h.cx, h.cz) * COVERS.length)] };
		H.coverMat = new THREE.MeshStandardMaterial({ color: H.cover, roughness: 0.92 });
		homes.set(h, H);
		watchWalls();
		return H;
	}
	function vacate(H) {
		for (const a of H.actors.values()) drop(a);
		H.actors.clear();
		for (let i = queue.length - 1; i >= 0; i--) if (queue[i].H === H) queue.splice(i, 1);
		H.anchor.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material !== H.coverMat) o.material.dispose(); });
		H.coverMat.dispose();
		H.anchor.removeFromParent();
		homes.delete(H.h);
		if (H.h.B) H.h.B.lived = [...homes.keys()].some((q) => q.B === H.h.B);
	}
	function drop(a) {
		a.active = false;
		a.P.stay = null;
		if (a.member) a.member.atHome = false;
		unlie(a, false);
		releaseBody(a.P);
		freeBody(a.P);
	}

	// ---------- which houses have their people shown ----------
	function choose() {
		const w = W(), H = w?.houses?.houses, I = w?.interiors, cam = camera.position;
		if (!H && !I?.live) { for (const x of [...homes.values()]) vacate(x); return; }
		const ins = H ? w.houses.inside?.(cam) || null : null, inside = ins?.h || null;
		const L = [], isIn = new Set();
		if (H) for (const h of H.values()) {
			if (!h?.plan?.rooms || !h.root || !Number.isFinite(h.floorY)) continue;
			// (a business's house: its people only in the flat over it, where it has one)
			const d0 = h.plan.estab ? over(h) : h;
			if (!d0) continue;
			const d = Math.hypot(h.cx - cam.x, h.cz - cam.z), here = h === inside && (d0 === h || ins.level > 0);
			if (here) isIn.add(d0);
			if (here || d < R + (homes.has(d0) ? 8 : 0)) L.push([here ? -1 : d, d0]);
		}
		// the city's (interiors/): each flat on its own; on a phone only the building you are in
		// or right beside
		const at = I?.live ? I.inside?.(cam) || null : null;
		if (I?.live) for (const B of I.live.values()) {
			if (!B.ready || !B.P || !B.root || !LIVED.has(B.use)) continue;
			for (const u of dwellingsOf(B)) {
				if (!u.ready()) continue;
				const [lx, lz] = toLocal(u, cam.x, cam.z), dx = Math.max(u.x0 - lx, 0, lx - u.x1), dz = Math.max(u.z0 - lz, 0, lz - u.z1);
				const dy = Math.abs(cam.y - 1.6 - u.floorY - u.y), flat = Math.hypot(dx, dz), inB = at?.B === B;
				const here = inB && u.levels.has(at.level) && (u.whole || u.rooms.some((r) => r.k === at.level && lx > r.x0 - 0.2 && lx < r.x1 + 0.2 && lz > r.z0 - 0.2 && lz < r.z1 + 0.2));
				if (isPhone && !inB && (flat > 4 || dy > 2.5)) continue;
				const d = flat + dy * 2;
				if (here) isIn.add(u);
				if (here || d < R + (homes.has(u) ? 8 : 0)) L.push([here ? -1 : inB ? d * 0.5 : d, u]);
			}
		}
		L.sort((p, q) => p[0] - q[0]);
		const want = new Set(L.slice(0, HOUSES).map((q) => q[1]));
		// (and the home seen down a scope, however far: its household in the room looked into,
		// one home more while the scope is on it: interiors/index.js scopeRoom)
		const S = I?.scopeRoom?.();
		if (S && LIVED.has(S.B.use)) for (const u of dwellingsOf(S.B)) if (u.levels.has(S.k) && (u.whole || !S.room || u.rooms.includes(S.room)) && u.ready()) { want.add(u); break; }
		for (const x of [...homes.values()]) if (!want.has(x.h) || !alive(x.h)) vacate(x);
		for (const h of want) if (!homes.has(h)) occupy(h);
		for (const x of homes.values()) { x.inside = isIn.has(x.h); if (x.h.B) x.h.B.lived = true; }
	}
	function alive(h) {
		if (h.alive) return h.alive();
		const H = W()?.houses?.houses;
		return !!H && H.get(h.grp) === h;
	}
	// a house's frame, back from the world's
	function toLocal(h, x, z) { const y = h.root.rotation.y, c = Math.cos(y), s = Math.sin(y), dx = x - (h.ox ?? h.cx), dz = z - (h.oz ?? h.cz); return [dx * c - dz * s, dx * s + dz * c]; }

	// ---------- the homes that are not a whole house ----------
	// the flat over a business (its ground floor the business's, bay/houseplan.js): the rooms
	// upstairs, a household of their own (none over a bed and breakfast: those are its guests')
	const uppers = new WeakMap();
	function over(h) {
		if (h.plan.estab?.fit === 'bnb') return null;
		let u = uppers.get(h);
		if (u !== undefined) return u;
		const ids = new Set(h.plan.rooms.filter((r) => (r.level || 0) > 0 && !r.biz).map((r) => r.id));
		const plan = { ...h.plan, estab: null, rooms: h.plan.rooms.map((r) => (ids.has(r.id) ? r : { id: r.id, type: r.type, skip: true })), items: (h.plan.items || []).filter((it) => ids.has(it.room)) };
		u = plan.items.some((it) => it.type === 'bed') ? {
			house: h, root: h.root, floorY: h.floorY, cx: h.cx, cz: h.cz, r: h.r, plan, kind: 'flat', key: `over:${Math.round(h.cx)}:${Math.round(h.cz)}`,
			panes: () => h.openedPanes?.size || 0, owns: (root) => root === h.root, alive: () => W()?.houses?.houses?.get(h.grp) === h,
		} : null;
		uppers.set(h, u);
		return u;
	}
	// the city's buildings (interiors/plan.js): a row house all one home (its ground floor the
	// shop's, in a shop), an apartment block a home to each flat. Each ready once its rooms are
	// furnished and built; its plan the rooms and furniture of that home alone.
	const LIVED = new Set(['row', 'shop', 'apt']);
	const RES = new Set(['living', 'kitchen', 'dining', 'family', 'bed', 'master', 'bath', 'powder', 'den', 'office', 'laundry']);
	const dwellings = new WeakMap();
	function dwellingsOf(B) {
		let out = dwellings.get(B);
		if (out) return out;
		const P = B.P, units = P.rooms.some((r) => r.unit), groups = new Map();
		for (const r of P.rooms) {
			const u = units ? r.unit : RES.has(r.type) && !(B.use === 'shop' && r.k === 0) ? 0 : undefined;
			if (u === undefined) continue;
			(groups.get(u) || groups.set(u, []).get(u)).push(r);
		}
		out = [];
		for (const [id, rooms] of groups) {
			const x0 = Math.min(...rooms.map((r) => r.x0)), x1 = Math.max(...rooms.map((r) => r.x1)), z0 = Math.min(...rooms.map((r) => r.z0)), z1 = Math.max(...rooms.map((r) => r.z1));
			const levels = new Set(rooms.map((r) => r.k)), k0 = Math.min(...levels), ids = new Set(rooms.map((r) => r.id));
			const u = {
				B, rooms, levels, whole: !units, x0, x1, z0, z1, y: P.levels[k0].y, kind: units ? 'flat' : 'row', key: `${B.key}:${id}`,
				root: B.root, floorY: P.f0, ox: B.root.position.x, oz: B.root.position.z, r: Math.hypot(x1 - x0, z1 - z0) / 2, plan: null, none: false,
				ready() {
					if (u.plan) return true;
					if (u.none || !rooms.every((r) => r.furnished) || ![...levels].every((k) => B.levels?.[k]?.full)) return false;
					const plan = { rooms: P.rooms.map((r) => (ids.has(r.id) ? { id: r.id, type: r.type, level: r.k, y: P.levels[r.k].y, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 } : { id: r.id, type: r.type, skip: true })), items: P.items.filter((it) => ids.has(it.room)) };
					// (somewhere to sleep: a bed, or a sofa long enough in a studio)
					if (!spotsOf(plan).some((s) => s.lie)) { u.none = true; return false; }
					u.plan = plan;
					return true;
				},
				panes: () => { let n = 0; for (const k of levels) n += B.levels?.[k]?.opened?.size || 0; return n; },
				owns: (root) => [...levels].some((k) => B.levels?.[k]?.root === root),
				alive: () => B.ready && W()?.interiors?.live?.get(B.key) === B,
			};
			// (its middle, in the world)
			const c = Math.cos(B.root.rotation.y), s = Math.sin(B.root.rotation.y), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
			u.cx = u.ox + mx * c + mz * s; u.cz = u.oz - mx * s + mz * c;
			out.push(u);
		}
		dwellings.set(B, out);
		return out;
	}
	// the city home a place is in (interiors/), if any
	function dwellingAt(B, level, pos) {
		if (!LIVED.has(B?.use) || !B.P) return null;
		for (const u of dwellingsOf(B)) {
			if (!u.levels.has(level)) continue;
			const [lx, lz] = toLocal(u, pos.x, pos.z);
			if (u.whole || u.rooms.some((r) => r.k === level && lx > r.x0 - 0.2 && lx < r.x1 + 0.2 && lz > r.z0 - 0.2 && lz < r.z1 + 0.2)) return u;
		}
		return null;
	}

	// ---------- who is where, now ----------
	function sunset() { const s = W()?.sky?.state?.sun?.set; return Number.isFinite(s) ? s : 19.5; }
	function replan(H, hour, budget) {
		const d = day();
		if (H.planDay !== d) { H.plans = planDay(H.hh, d); H.planDay = d; }
		const A = arrange(H.hh, H.plans, H.spots, hour, { day: d, sunset: sunset(), prev: H.prev, max: budget, taken: claimed?.h === H.h ? [claimed.id] : null });
		H.prev = new Map(A.map((q) => [q.member.id, { act: q.act, spot: q.spot.id }]));
		const keep = new Set();
		for (const q of A) {
			keep.add(q.member.id);
			const a = H.actors.get(q.member.id);
			if (!a) { if (!queue.some((x) => x.H === H && x.q.member === q.member)) queue.push({ H, q }); continue; }
			if (a.scared || a.shaken > 0) { a.next = q; continue; }
			if (!a.q || a.q.spot !== q.spot || a.q.act !== q.act) move(a, q);
			else if (q.pose && !a.lying) a.M.setPose(q.pose);
		}
		for (const [id, a] of H.actors) if (!keep.has(id) && !a.scared && !(a.shaken > 0)) leave(a);
		// the TV on where someone is watching it (or they are in the room with it, of an evening)
		const on = new Set(A.filter((q) => q.act === 'tv' || (q.act === 'eat' && q.spot.tv)).map((q) => q.spot.room));
		for (const it of H.h.plan.items || []) if (it.type === 'tvConsole') tv(H, it, on.has(it.room));
		return A.length;
	}
	function tv(H, it, on) {
		let S = H.tvs.get(it);
		if (!on) { if (S) S.mesh.visible = false; return; }
		if (!S) {
			const tw = Math.min(1.45, it.w - 0.2), th = tw * 0.56;
			const mat = new THREE.MeshBasicMaterial({ color: 0x8090b0 });
			const mesh = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.97, th * 0.95), mat);
			const g = new THREE.Group(); g.position.set(it.x, it.y || 0, it.z); g.rotation.y = (it.rot || 0) * Q;
			mesh.position.set(0, it.h + 0.08 + th / 2, -0.015);
			g.add(mesh); H.anchor.add(g);
			S = { mesh, mat, t: 0, from: new THREE.Color(0x8090b0), to: new THREE.Color(0x8090b0), k: 1, dur: 1 };
			H.tvs.set(it, S);
		}
		S.mesh.visible = true;
	}

	// ---------- bodies ----------
	function make(H, q) {
		const m = q.member;
		const a = spawn({ seed: m.seed, age: m.age, male: m.male, ancestry: m.ancestry, member: m, place: 'suburb', home: true, school: false });
		if (!a) return null;
		a.homeLife = true; a.H = H; a.fade = 0; a.member = m;
		// (kept to the room they are in, whatever moves them: a run from a fight, the fight's own panic)
		a.P.stay = (pos) => stay(a, pos);
		a.P.home = { household: H.hh, member: m, area: null };
		m.atHome = true;
		H.actors.set(m.id, a);
		settle(a, q, true);
		return a;
	}
	function leave(a) { a.leaving = true; a.walk = null; }
	// in place: in bed, in a seat, standing at the stove
	function settle(a, q, now = false) {
		const H = a.H, s = q.spot, y = floorOf(H, s);
		unlie(a, false);
		a.q = q; a.walk = null; a.swap = null; a.next = null; a.room = null; a.stayAt = null;
		a.asleep = q.act === 'sleep';
		a.M.setGround(() => y);
		const [x, z] = toWorld(H, s.x, s.z), heading = s.heading + yawOf(H);
		if (s.lie) { lie(a, s, q); return; }
		a.M.place(x, y, z, heading);
		if (s.sit) { a.M.sit(s.sit, now); } else a.M.stand();
		a.M.setPose(q.pose || 'rest');
		a.M.S.talk = 0;
		a.look = lookFor(a, q);
	}
	// lying down: the body laid on its back along the bed, head on the pillow, the covers over it
	function lie(a, s, q) {
		const H = a.H, P = a.P, L = s.lie, len = Math.max(0.9, (P.height || 1.7) - 0.12) * Math.cos(TILT);
		const hx = s.x + Math.sin(s.heading) * len, hz = s.z + Math.cos(s.heading) * len;
		const [x, z] = toWorld(H, hx, hz), yaw = s.heading + yawOf(H), y = floorOf(H, s);
		a.M.place(x, y, z, yaw); a.M.stand(); a.M.setPose('rest'); a.M.S.talk = 0;
		// (straight out of a chair: legs down at once, not still folded up under the covers)
		a.M.S.sitK.v = 0; a.M.S.sitK.dv = 0; a.M.S.floorPose = null;
		const cam = camera.position;
		for (let k = 0; k < 12; k++) a.M.update(1 / 20, 0, cam);
		// (the back sunk a little into the mattress, out of sight under the covers)
		a.lying = { s, y: y + L.top - 0.02, yaw, x, z };
		place(a);
		// the covers
		const it = s.item, lump = s.kind === 'couch' ? { cx: 0.12, cz: 0.06, len: it.w - 0.8, x: true } : { cx: L.lump[0], cz: (L.lump[1] + L.lump[2]) / 2, len: L.lump[2] - L.lump[1], x: false };
		const g = new THREE.Group(); g.position.set(it.x, it.y || 0, it.z); g.rotation.y = (it.rot || 0) * Q;
		const mesh = new THREE.Mesh(LUMP, H.coverMat);
		const k = Math.min(1, (P.height || 1.7) / 1.7), thick = 0.22 + 0.14 * k;
		mesh.scale.set(L.wide, thick, lump.len);
		if (lump.x) mesh.rotation.y = Q;
		mesh.position.set(lump.cx, L.top - 0.03, lump.cz);
		mesh.castShadow = true; mesh.receiveShadow = true;
		g.add(mesh); H.anchor.add(g);
		a.cover = g;
		a.look = null;
	}
	function place(a) {
		const L = a.lying, P = a.P;
		P.root.position.set(L.x, L.y, L.z);
		P.root.rotation.set(-Q + TILT, L.yaw, 0, 'YXZ');
		P.root.updateMatrixWorld(true);
	}
	// up out of bed (or off the sofa): standing beside it
	function unlie(a, wake = true) {
		if (a.cover) { a.cover.removeFromParent(); a.cover = null; }
		if (!a.lying) return;
		const s = a.lying.s, it = s.item, H = a.H;
		a.lying = null; a.asleep = false;
		if (!wake) return;
		const [lx, lz] = s.kind === 'couch' ? itemPoint(it, 0, it.d / 2 + 0.45) : itemPoint(it, (s.side ? -1 : 1) * (it.w / 2 + 0.4), 0);
		const [x, z] = toWorld(H, lx, lz);
		a.M.place(x, floorOf(H, s), z, s.heading + yawOf(H) + Q);
		a.M.stand(); a.M.setPose('rest');
	}
	// who or what they look at: the TV, the others at the table, whoever they are talking to
	function lookFor(a, q) {
		const H = a.H, s = q.spot;
		if (q.act === 'tv' || (q.act === 'eat' && s.tv)) {
			const it = (H.h.plan.items || []).find((i) => i.type === 'tvConsole' && i.room === s.room);
			if (it) { const [x, z] = toWorld(H, it.x, it.z); return new THREE.Vector3(x, floorOf(H, s) + it.h + 0.5, z); }
		}
		return null;
	}
	// a new place: walked to across the room, else (out of sight) simply there
	function move(a, q) {
		const H = a.H, from = a.q?.spot, to = q.spot;
		if (a.lying || !from || from.room !== to.room || from.level !== to.level || !seen(a)) {
			if (seen(a) && !a.lying) { a.swap = { q, t: 0 }; return; }
			unlie(a, false); settle(a, q, true); return;
		}
		const [x, z] = toWorld(H, to.x, to.z);
		a.M.stand(); a.M.setPose('rest');
		a.walk = { x, z, q, t: 0 };
	}
	function seen(a) {
		const p = a.lying ? a.P.root.position : a.M.S.pos, cam = camera.position;
		if (Math.hypot(p.x - cam.x, p.z - cam.z) > 22) return false;
		return frustum.containsPoint(_v.set(p.x, p.y + 1, p.z));
	}

	// ---------- the room they are in ----------
	// a body's width clear of the room's walls at a place in the house's frame: the cells of a
	// planned house (bay/houseplan.js), the rectangle of a city one's (interiors/plan.js)
	const BODY = 0.28;
	function within(H, rid, lx, lz) {
		const plan = H.h.plan, r = plan.rooms[rid];
		if (!r) return false;
		if (r.cells && plan.cellAt) {
			const lab = plan.labels?.[r.level || 0], at = (x, z) => { const c = plan.cellAt(x, z); return c >= 0 && lab?.[c] === rid; };
			return at(lx, lz) && at(lx + BODY, lz) && at(lx - BODY, lz) && at(lx, lz + BODY) && at(lx, lz - BODY);
		}
		return lx > r.x0 + BODY && lx < r.x1 - BODY && lz > r.z0 + BODY && lz < r.z1 - BODY;
	}
	function toHouse(H, x, z) { const y = yawOf(H), c = Math.cos(y), s = Math.sin(y), dx = x - (H.h.ox ?? H.h.cx), dz = z - (H.h.oz ?? H.h.cz); return [dx * c - dz * s, dx * s + dz * c]; }
	// each step they take: kept in their room, sliding along a wall they run into, never through it
	function stay(a, pos) {
		const H = a.H, rid = a.room ?? a.q?.spot?.room;
		const last = a.stayAt || (a.stayAt = { x: pos.x, z: pos.z });
		if (rid == null || !H || homes.get(H.h) !== H) { last.x = pos.x; last.z = pos.z; return; }
		const ok = (x, z) => within(H, rid, ...toHouse(H, x, z));
		// (somewhere it can't be already, a seat by the wall: out of it, but no further in)
		if (ok(pos.x, pos.z) || !ok(last.x, last.z)) { last.x = pos.x; last.z = pos.z; return; }
		if (ok(pos.x, last.z)) pos.z = last.z;
		else if (ok(last.x, pos.z)) pos.x = last.x;
		else { pos.x = last.x; pos.z = last.z; }
		last.x = pos.x; last.z = pos.z;
	}
	// the far side of their room from what came in: of its spots, the furthest away (the k-th
	// of them, so a family is not all on one spot)
	function refuge(a, from, k = 0) {
		const H = a.H, rid = a.q?.spot?.room, L = [];
		for (const s of H.spots) {
			if (s.room !== rid) continue;
			const [x, z] = toWorld(H, s.x, s.z), d = Math.hypot(x - from.x, z - from.z);
			if (!L.some((q) => Math.hypot(q.x - x, q.z - z) < 0.6)) L.push({ x, z, d });
		}
		L.sort((p, q) => q.d - p.d);
		const far = L.filter((q) => q.d > L[0]?.d - 2.5);
		return far.length ? far[k % far.length] : null;
	}

	// ---------- a fight coming in ----------
	// what broke the house: its windows (structures/glass.js keeps them on the house) and its
	// walls (structures/walls/ tells everyone who listens)
	function watchWalls() {
		const walls = W()?.structures?.walls;
		if (!walls?.on || wallsOf === walls) return;
		wallsOff?.();
		wallsOf = walls;
		wallsOff = walls.on((e) => {
			if (e.type !== 'change' || !(e.holes?.length || e.breach?.length)) return;
			for (const H of homes.values()) if (owns(H.h, e.root)) scatter(H, 'wall');
		});
	}
	function source(H) {
		const cam = camera.position;
		return Math.hypot(cam.x - H.h.cx, cam.z - H.h.cz) < H.h.r + 12 ? { x: cam.x, z: cam.z } : { x: H.h.cx, z: H.h.cz };
	}
	function scatter(H, why, from = source(H)) {
		let k = 0;
		for (const a of H.actors.values()) if (a.active && !a.scared && !a.leaving) startle(a, why, from, k++);
		if (k) emit({ type: 'scatter', house: H.h, household: H.hh, why, at: from });
	}
	function startle(a, why, from, k = 0, theirs = false) {
		const H = a.H, act = a.q?.act;
		a.room = a.q?.spot?.room ?? a.room;
		unlie(a, true);
		a.stayAt = { x: a.M.S.pos.x, z: a.M.S.pos.z };
		a.walk = null; a.swap = null;
		a.M.stand();
		a.scared = { t: 0, run: 3.5 + hash(a.P.dna.seed, 7) * 3, cower: 2 + hash(a.P.dna.seed, 9) * 3, from, why, theirs, act, wait: k * 0.55 + hash(a.P.dna.seed, 3) * 0.3, to: refuge(a, from, k) };
		if (!theirs) { a.engaged = false; a.override = flee; }
		a.M.feel('surprise', 1);
	}
	// running from it, then down low a moment
	function flee(a, dt) {
		const S = a.scared;
		if (!S) { a.override = null; return false; }
		const M = a.M, at = M.S.pos;
		if (S.t < S.run) {
			// to the far side of the room, and down there once at it
			if (S.to) {
				const dx = S.to.x - at.x, dz = S.to.z - at.z, d = Math.hypot(dx, dz);
				if (d < 0.5) { S.t = S.run; return true; }
				M.want.heading = Math.atan2(dx, dz);
				M.want.speed = Math.min(a.P.dna.child ? 2.2 : 3.2, 0.6 + d * 2); M.want.run = d > 1.5 ? 1 : 0;
				M.S.look.target = null;
				return true;
			}
			let ax = at.x - S.from.x, az = at.z - S.from.z;
			const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
			const side = (hash(a.P.dna.seed, 11) - 0.5) * 0.9;
			M.want.heading = Math.atan2(ax + az * side, az - ax * side);
			M.want.speed = a.P.dna.child ? 2.2 : 3.2; M.want.run = 1;
			M.S.look.target = null;
			return true;
		}
		if (S.t < S.run + S.cower) { M.want.speed = 0; M.want.run = 0; M.act('crouch', 0); return true; }
		M.act(null);
		return false;
	}
	function speak(a, line, n) {
		if (!line) return;
		a.M.gesture(a.P.dna.child ? 'cheer' : 'shrug', 0.8);
		say(a, { text: line, feel: { surprise: 1 } });
		a.H.said = n + 1;
	}
	// the fight's own panic (combat/civilians.js takes their steering when shots or blows land
	// near): they wake, they run, and one or two of them say so
	function fear(a, dt) {
		const S = a.scared;
		S.t += dt;
		if (S.wait !== null && S.t > S.wait) {
			const H = a.H;
			if (H.said < 2) speak(a, lineFor({ why: S.why, act: S.act, meal: a.q?.meal, hour: hours(), age: a.P.dna.age, seed: a.P.dna.seed ^ H.h.cx * 7, n: H.said }), H.said);
			S.wait = null;
		}
		const done = S.theirs ? !a.override : S.t > S.run + S.cower;
		if (!done) return;
		if (!S.theirs && a.override === flee) a.override = null;
		a.scared = null; a.M.act(null);
		// standing about shaken a while, someone calling it in
		a.shaken = 25 + hash(a.P.dna.seed, 5) * 20;
		const caller = !a.P.dna.child && ![...a.H.actors.values()].some((b) => b !== a && b.calling);
		a.calling = caller;
		a.M.setPose(caller ? 'phone' : 'crossed');
		if (caller) setTimeout(() => { if (a.active && a.calling) say(a, { text: lineFor({ after: true, seed: a.P.dna.seed ^ Math.floor(performance.now()) }) }); }, 1800);
	}

	// ---------- each frame ----------
	function update(dt, t, enabled = true) {
		if (dead) return;
		if (!enabled || !(W()?.houses || W()?.interiors)) { if (homes.size) clear(); return; }
		const cam = camera.position;
		camera.updateMatrixWorld?.();
		_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(_m);
		if ((pickT -= dt) < 0) { pickT = 0.5; choose(); }
		const hour = hours(), d = day();
		if (d !== lastDay) { lastDay = d; planT = 0; }
		// (the bodies' kit only loads once there is a house to fill)
		if ((planT -= dt) < 0 && homes.size && ready()) {
			planT = 1;
			let budget = cap();
			for (const H of [...homes.values()].sort((p, q) => (q.inside ? 1 : 0) - (p.inside ? 1 : 0))) budget -= replan(H, hour, Math.max(0, budget));
		}
		// one body a frame (each takes a few milliseconds to make)
		if (queue.length && ready()) {
			const { H, q } = queue.shift();
			if (homes.get(H.h) === H && !H.actors.has(q.member.id)) make(H, q);
		}
		for (const H of homes.values()) {
			// a window broken in, since the last look
			const n = panesOf(H.h);
			if (n > H.panes) scatter(H, 'window');
			H.panes = n;
			// the TV's picture
			for (const S of H.tvs.values()) {
				if (!S.mesh.visible) continue;
				S.t += dt;
				if (S.t > S.dur) { S.t = 0; S.dur = 0.4 + Math.random() * 2.6; S.from.copy(S.mat.color); const c = TV_HUES[Math.floor(Math.random() * TV_HUES.length)], b = 0.55 + Math.random() * 0.6; S.to.setRGB(c[0] * b, c[1] * b, c[2] * b); }
				S.mat.color.copy(S.from).lerp(S.to, Math.min(1, S.t / 0.25));
			}
			// you, come in on them
			if (H.inside && !H.greeted) greet(H);
			if (!H.inside && Math.hypot(cam.x - H.h.cx, cam.z - H.h.cz) > H.h.r + 6) H.greeted = false;
			for (const [id, a] of H.actors) {
				if (!a.active) { H.actors.delete(id); continue; }
				step(a, dt, t, cam);
				if (!a.active) H.actors.delete(id);
			}
		}
	}
	function step(a, dt, t, cam) {
		// out of the door (to work, to school) or off to bed in another room: faded out
		if (a.leaving || a.swap) {
			a.fade = Math.max(0, a.fade - dt / (a.swap ? 0.8 : 1.5));
			fadePerson(a.P, a.fade);
			if (a.fade <= 0) {
				if (a.leaving) { drop(a); return; }
				const q = a.swap.q; a.swap = null; settle(a, q, true);
			}
			if (a.lying) return;
		}
		if (a.P.ragdoll) return;
		// a fight near them: combat/civilians.js has their steering
		if (a.override && a.override !== flee && !a.scared) startle(a, Math.hypot(cam.x - a.M.S.pos.x, cam.z - a.M.S.pos.z) < 6 ? 'fight' : 'shots', { x: cam.x, z: cam.z }, 0, true);
		if (a.scared) fear(a, dt);
		else if (a.shaken > 0) {
			a.shaken -= dt;
			if (a.shaken <= 0) { a.calling = false; a.M.setPose('rest'); const q = a.next || a.q; a.q = null; if (q) move(a, q); }
		}
		if (a.lying) {
			place(a);
			if (!a.leaving && !a.swap) { a.fade = Math.min(1, a.fade + dt * 1.5); fadePerson(a.P, a.fade); }
			a.P.lod?.(Math.hypot(a.lying.x - cam.x, a.lying.z - cam.z));
			return;
		}
		const M = a.M, S = M.S;
		if (a.override && a.override(a, dt, cam)) M.stand();
		else if (a.walk) {
			const w = a.walk, dx = w.x - S.pos.x, dz = w.z - S.pos.z, d = Math.hypot(dx, dz);
			w.t += dt;
			if (d < 0.35 || w.t > 10) settle(a, w.q, false);
			else { M.want.heading = Math.atan2(dx, dz); M.want.speed = Math.min(1.15, d * 1.6); }
		} else {
			M.want.speed = 0;
			// at the table or in a pair: now one talks, now the other; in front of the TV, eyes on it
			const act = a.q?.act;
			if (act === 'eat' || act === 'chat' || act === 'snack' || a.shaken > 0) S.talk = Math.sin(t * 0.7 + a.P.dna.seed) > 0.45 ? 1 : 0;
			if (a.look) S.look.target = a.look;
			else if (act === 'chat' || act === 'eat') S.look.target = mate(a);
		}
		M.update(dt, t, cam);
		if (!a.leaving && !a.swap) { a.fade = Math.min(1, a.fade + dt * 1.5); fadePerson(a.P, a.fade); }
		a.P.lod?.(Math.hypot(S.pos.x - cam.x, S.pos.z - cam.z));
	}
	// the nearest of the house doing the same: who they talk to
	function mate(a) {
		let best = null, bd = 3;
		for (const b of a.H.actors.values()) {
			if (b === a || b.lying || b.q?.act !== a.q?.act) continue;
			const d = b.M.S.pos.distanceTo(a.M.S.pos);
			if (d < bd) { bd = d; best = b; }
		}
		return best ? _head(best) : null;
	}
	const _head = (b) => (b._head ||= new THREE.Vector3()).set(b.M.S.pos.x, b.M.S.pos.y + (b.P.height || 1.7) * 0.92, b.M.S.pos.z);
	// you walk in: the nearest awake grown-up who can see you says so (once a visit)
	function greet(H) {
		const cam = camera.position;
		let best = null, bd = 7;
		for (const a of H.actors.values()) {
			if (!a.active || a.lying || a.scared || a.leaving || a.P.dna.child || a.fade < 0.8) continue;
			const d = Math.hypot(a.M.S.pos.x - cam.x, a.M.S.pos.z - cam.z);
			if (d < bd && Math.abs(a.M.S.pos.y + 1.5 - cam.y) < 2) { bd = d; best = a; }
		}
		if (!best) return;
		H.greeted = true;
		const h = hours(), act = best.q?.act, night = h >= 23 || h < 5.5;
		const L = night ? GREET.night : GREET[act] || GREET.any;
		say(best, { text: L[Math.floor(hash(best.P.dna.seed, Math.floor(h)) * L.length)], gesture: 'shrug' });
		emit({ type: 'greet', house: H.h, household: H.hh, by: best });
	}
	function clear() {
		for (const H of [...homes.values()]) vacate(H);
		if (W()?.interiors?.live) for (const B of W().interiors.live.values()) B.lived = false;
		queue.length = 0;
	}
	function dispose() { clear(); wallsOff?.(); wallsOff = null; dead = true; root.removeFromParent(); }

	// ---------- for the rest of the game ----------
	const actors = () => { const out = []; for (const H of homes.values()) for (const a of H.actors.values()) if (a.active) out.push(a); return out; };
	function homeAt(pos) {
		// (a house itself as well as a place)
		if (pos?.plan?.rooms) return { house: pos, level: 0, household: householdOf(pos), home: homeNow(pos) };
		if (!Number.isFinite(pos?.x)) return null;
		const ins = W()?.houses?.inside?.(pos);
		if (!ins) {
			// a home in the city's (interiors/): the row house, the flat (once its rooms are
			// furnished and it has somewhere to sleep)
			const I = W()?.interiors?.inside?.(pos), u = I ? dwellingAt(I.B, I.level, pos) : null;
			return u?.ready() ? { house: u, level: I.level, household: householdOf(u), home: homes.has(u) ? whoIsHome(u) : null, building: I.B } : null;
		}
		// (upstairs over a business: the flat's household)
		const u = ins.h.plan?.estab && ins.level > 0 ? over(ins.h) : null, h = u || ins.h;
		return { house: h, level: ins.level, household: householdOf(h), home: homes.has(h) ? whoIsHome(h) : null };
	}
	// the spots of a home its household has (sat or lying in, or on the way there), and the one
	// kept for you while you are in it (gameplay/rest.js): they keep clear of it
	let claimed = null;
	function inUse(h) {
		const H = homes.get(h), out = new Set();
		if (H) for (const a of H.actors.values()) if (a.active) for (const q of [a.q, a.walk?.q, a.swap?.q, a.next]) if (q?.spot) out.add(q.spot.id);
		return out;
	}
	function claim(h, id) { claimed = h && id != null ? { h, id } : null; planT = 0; }
	function whoIsHome(h) {
		const H = homes.get(h);
		if (!H) return [];
		return [...H.actors.values()].filter((a) => a.active && !a.leaving).map((a) => ({ id: a.q?.member.id, member: a.q?.member, act: a.q?.act, room: a.q?.spot.roomType, asleep: !!a.asleep, actor: a }));
	}
	// who of a house's household is home at an hour by their day (bodies drawn or not): members
	// with what they are doing there
	function homeNow(h, hour = hours()) {
		const hh = h?.plan?.rooms ? householdOf(h) : null;
		if (!hh) return [];
		const plans = planDay(hh, day());
		return hh.members.filter((m) => !m.away).map((m) => ({ member: m, ...doingAt(hh, plans, m, hour, { day: day(), sunset: sunset() }) })).filter((q) => q.act);
	}
	function info() {
		return {
			houses: [...homes.values()].map((H) => ({ at: H.key, kind: H.hh.kind, members: H.hh.members.length, inside: H.inside, spots: H.spots.length, shown: H.actors.size, tv: [...H.tvs.values()].some((S) => S.mesh.visible), doing: [...H.actors.values()].map((a) => `${Math.floor(a.P.dna.age)}:${a.scared ? 'scared' : a.shaken > 0 ? 'shaken' : a.q?.act}@${a.q?.spot.kind}`) })),
			queued: queue.length, ready: !!(homes.size && ready()), cap: cap(),
		};
	}
	return {
		update, clear, dispose, actors, info, homeAt, whoIsHome, homeNow, householdOf, inUse, claim, group: root,
		occupants: () => [...homes.values()].flatMap((H) => whoIsHome(H.h).map((q) => ({ ...q, house: H.h }))),
		on: (f) => { listeners.add(f); return () => listeners.delete(f); },
		// (for a look: a fight crashes into the house you are at)
		scatter: (why = 'window') => { const H = [...homes.values()].sort((p, q) => (q.inside ? 1 : 0) - (p.inside ? 1 : 0))[0]; if (!H) return 0; scatter(H, why); return H.actors.size; },
	};
}
