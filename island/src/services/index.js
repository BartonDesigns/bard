// The town's services: its hospitals, police and fire stations and armories, wherever there
// is a town (the Bay's mapped and gridded towns, a town grown on the globe).
//
//   siting     services/siting.js picks the buildings, the same every visit; a chosen block
//              is taken over (its block no longer a shop or office), its shell stands
//              (services/shell.js) and its rooms are built by the interiors as you come near
//              (interiors.addSite, the plans in services/interiors.js, furnished by fitout.js)
//   staff      who is on: a roster by the hour (day and night shifts) over the posts the
//              fit-out made, walked by the workplace routines (people/workplace-*.js)
//   patients   the hurt round you (a fight, a car, a fall) are fetched by ambulance or walk
//              in, are treated over time and sent home billed (services/patients.js); you are
//              brought round there when knocked out, and mended at the desk for credits
//   units      ambulances and fire engines drive the streets with their sirens
//              (services/responders.js, routes.js, sound.js); an engine and its crew answer a
//              fire from the nearest station (combat/combat.js asks dispatchFire)
//   caches     the depots' stores are the game's own items (services/depots.js), taken or
//              brought through the inventory (crysis/arms-runtime.js apply)
//
// Hooks for the other modules (set on services.hooks): charge(who, credits, record) -> paid,
// the wallet a patient's bill goes through (the morality ledger's); onLoot(depot, itemId,
// witnessed), what taking from a guarded cache costs you (the heat).

import * as THREE from 'three';
import { KINDS, SERVICES, anchorsNear, fits, siteFor } from './siting.js';
import { serviceName, staffName } from './names.js';
import { buildShell, setDoor, LOOK, planOf, shellMats } from './shell.js';
import { createWard, playerCare } from './patients.js';
import { roadGraph, findRoute } from './routes.js';
import { createResponder, stepResponder, park } from './responders.js';
import { createSiren, radioBurst, monitorBeep } from './sound.js';
import { mapTable, dutyScreen, roomSign } from './screens.js';
import { createDepot, takeFrom, bringTo, restock, stockList } from './depots.js';
import { mintUid } from '../gameplay/gear-levels.js';
import { ARMS_CATALOG } from '../gameplay/arms.js';
import { BLOCKS, toGrid, fromGrid } from '../bay/styles.js';
import './fitout.js';
import './roles.js';

const DECIDE_R = 1700, SCAN_R = 2600;
const TITLES = { hospital: 'Hospital', police: 'Police station', fire: 'Fire station', armory: 'Armory' };
const SIGNS = { erWaiting: 'WAITING', triage: 'TRIAGE', erBays: 'EMERGENCY', theatre: 'THEATRE', pharmacy: 'PHARMACY', ward: 'WARD', nurseHub: 'NURSES', frontDesk: 'FRONT DESK', bullpen: 'SQUAD ROOM', cells: 'HOLDING', evidence: 'EVIDENCE', lockerRoom: 'LOCKERS', apparatus: 'APPARATUS BAY', dayRoom: 'DAY ROOM', bunkRoom: 'QUARTERS', gym: 'GYM', warRoom: 'OPERATIONS', commsRoom: 'COMMUNICATIONS', depot: 'SUPPLY DEPOT', barracks: 'BARRACKS', messHall: 'MESS' };
const CARE_ROOMS = new Set(['erWaiting', 'triage', 'erBays']);
const RADIO_ROOMS = new Set(['commsRoom', 'warRoom', 'watchRoom', 'frontDesk', 'bullpen', 'guardPost']);
const BEEP_ROOMS = new Set(['erBays', 'ward', 'theatre', 'triage']);
const hashS = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// who is on, by role, at an hour (day 7 to 19, night after)
function duty(F, hours) {
	const day = hours >= 7 && hours < 19, meal = (hours >= 6.5 && hours < 8) || (hours >= 11.5 && hours < 13.5) || (hours >= 17.5 && hours < 19.5);
	if (F.kind === 'hospital') return { doctor: day ? 3 : 1, nurse: day ? 5 : 3, receptionist: 1, pharmacist: 1, paramedic: F.units.some((V) => V.state === 'parked') ? 1 : 0, surgeon: F.ward.list().some((q) => q.state === 'treating' && q.severity > 0.6) ? 1 : 0, visitor: day ? 3 : 1 };
	if (F.kind === 'police') return { 'desk officer': 1, officer: day ? 5 : 2, chief: day ? 1 : 0, detective: day ? 1 : 0, 'evidence clerk': day ? 1 : 0, visitor: day ? 2 : 1, detainee: F.detainees };
	if (F.kind === 'fire') return { firefighter: Math.max(0, 5 - F.units.filter((V) => V.state !== 'parked').length * 3), dispatcher: 1 };
	return { 'duty officer': 1, 'radio operator': day ? 3 : 2, officer: day ? 3 : 1, guard: 1, quartermaster: day ? 1 : 0, soldier: day ? 4 : 6, cook: meal ? 1 : 0 };
}
// the posts filled now: the roster's counts over the posts of the level, the patients in the
// beds as many as the ward has (treating in the emergency bays, recovering on the wards)
function rosterFor(F) {
	return (hours, seats, level) => {
		const want = duty(F, hours), night = hours < 7 || hours >= 22, out = [];
		if (F.kind === 'hospital') want.patient = F.ward.count(level === 0 ? 'treating' : 'recovering') + (level === 0 ? F.ward.count('waiting') > 0 ? 1 : 0 : 0);
		const byRole = new Map();
		for (const s of seats) { if (!s.work || s.work.routineOnly) continue; const r = s.work.role; if (!byRole.has(r)) byRole.set(r, []); byRole.get(r).push(s); }
		for (const [role, n] of Object.entries(want)) {
			const list = (byRole.get(role) || []).slice();
			// (by night the crews are in their bunks; by day at the table, the gym, the gear)
			if (role === 'firefighter' || role === 'soldier') list.sort((a, b) => (/bunk/.test(b.work.group) === night ? 1 : 0) - (/bunk/.test(a.work.group) === night ? 1 : 0));
			// (a patient is seen by whoever works their bay: those bays first)
			if (role === 'nurse' || role === 'doctor') list.sort((a, b) => (/bed/.test(b.work.group) ? 1 : 0) - (/bed/.test(a.work.group) ? 1 : 0));
			out.push(...list.slice(0, Math.max(0, n)));
		}
		return out;
	};
}

export function createServices({ scene, world, camera, people = () => null, isPhone = false, mount = null, button = null, hint = () => {}, arms = null, combat = () => null }) {
	const facilities = new Map();     // anchor key -> facility, or null where nothing fits
	const empty = new Map();          // anchor key -> the map's version when nothing fitted
	const hooks = { charge: null, onLoot: null };
	const calls = [];                 // waiting for an ambulance: { x, z, who, name, minor, severity, cause, p, t }
	const handled = new WeakSet();
	const queue = [];
	let scanT = 0, decideT = 0, bgSeq = 0, clock = 0;
	const stats = { decided: 0, sited: 0, decideMs: 0, maxDecideMs: 0, frameMs: 0, admitted: 0, discharged: 0, billed: 0, dispatched: 0, revived: 0, treated: 0 };
	const W = () => world();
	const mapVersion = () => `${W()?.real?.version?.() ?? 0}:${W()?.real?.genVersion?.() ?? 0}`;
	const stale = (A) => !facilities.has(A.key) || (empty.has(A.key) && empty.get(A.key) !== mapVersion());
	const ground = (x, z) => W()?.island?.heightAt?.(x, z) ?? 0;
	const raw = (x, z) => W()?.bayArea?.heightAt?.(x, z) ?? ground(x, z);
	// the road a unit drives on: the ground, or a service's floor and aprons where it stands on them
	function roadY(x, z) {
		let y = ground(x, z);
		for (const F of list()) {
			if (!F.shell || Math.abs(F.x - x) > F.W + 12 || Math.abs(F.z - z) > F.D + 12) continue;
			const [lx, lz] = frameOf(F).l(x, z);
			for (const p of F.shell.pads) if (lx > p[0] && lx < p[2] && lz > p[1] && lz < p[3]) y = Math.max(y, F.f0 + p[4]);
		}
		return y;
	}
	const frameOf = (F) => { const ca = Math.cos(F.a), sa = Math.sin(F.a); return { ca, sa, w: (lx, lz) => [F.x + ca * lx - sa * lz, F.z + sa * lx + ca * lz], l: (x, z) => { const dx = x - F.x, dz = z - F.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; } }; };

	// ---------- the buildings round an anchor, as siting.js reads them ----------
	function buildingsNear(kind, A) {
		const w = W(), R = SERVICES[kind].reach, out = [];
		for (const b of w.real?.loaded?.() ? w.real.near('boxes', A.x, A.z, R) : []) out.push({ x: b.x, z: b.z, w: b.w, d: b.d, a: b.a || 0, h: (b.wallH || 0) + (b.roofH || 0) * 0.5, kind: b.kind, grid: false, ref: b });
		const U = w.bayArea?.urbanAt?.(A.x, A.z);
		if (w.city?.fill && U && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => (w.bayArea.urbanAt(A.x + u * R * 0.5, A.z + v * R * 0.5)?.u || 0) > 0.1)) {
			const list = [];
			try { w.city.fill(A.x, A.z, R, list); } catch { /* a town not there */ }
			for (const o of list) if (o.w && o.d && o.h > 0.5) out.push({ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a || 0, h: o.h, kind: o.kind, grid: true, ref: o });
		}
		return out;
	}
	const riseOf = (b) => { const ca = Math.cos(b.a), sa = Math.sin(b.a); let lo = 1e9, hi = -1e9; for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) { const h = raw(b.x + ca * u * b.w / 2 - sa * v * b.d / 2, b.z + sa * u * b.w / 2 + ca * v * b.d / 2); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
	function decide(A) {
		const t0 = performance.now();
		const list = buildingsNear(A.kind, A).filter((b) => fits(A.kind, { ...b, rise: 0 }));
		for (const b of list) b.rise = riseOf(b);
		const b = siteFor(A.kind, A, list);
		facilities.set(A.key, b ? makeFacility(A, b) : null);
		// (nothing yet: asked again once more of the map has come in)
		if (b) empty.delete(A.key); else empty.set(A.key, mapVersion());
		const ms = performance.now() - t0;
		stats.decided++; stats.decideMs = ms; stats.maxDecideMs = Math.max(stats.maxDecideMs, ms);
	}

	// ---------- one service ----------
	function makeFacility(A, b) {
		const kind = A.kind, Wd = b.w + 0.16, Dd = b.d + 0.16;
		const F = { key: A.key, kind, name: serviceName(kind, b.x, b.z), x: b.x, z: b.z, a: b.a, W: Wd, D: Dd, src: b.grid ? 'grid' : 'real', anchor: A, seed: hashS(A.key), shell: null, props: null, units: [], live: false, detainees: hashS(A.key) % 3, debt: 0, depots: new Map() };
		// the floor clear of the ground under all of it; the block's own top
		let lo = 1e9, hi = -1e9;
		const fr = frameOf(F);
		for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const [x, z] = fr.w(-Wd / 2 + Wd * i / 4, -Dd / 2 + Dd * j / 4), h = raw(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
		F.f0 = hi + 0.12; F.groundMin = lo;
		const [sx, sz] = fr.w(0, Dd / 2 + 2);
		F.street = Math.min(F.f0, raw(sx, sz));
		F.blockTop = b.grid ? (b.ref.y ?? lo) + b.ref.h : lo + b.h + 0.4;
		F.plan = planOf(kind, Wd, Dd);
		// the block is the service's now: no longer a shop or an office (commercial.js, the interiors)
		if (!b.grid && b.ref) b.ref.grp = Object.assign([b.ref], { service: kind });
		if (kind === 'hospital') {
			const beds = Math.max(4, Math.min(24, Math.round(Wd * Dd / 45)));
			F.ward = createWard({ id: A.key, beds, charge: bill, onEvent: wardEvent });
		}
		F.site = { key: 'svc:' + A.key, o: { x: F.x, z: F.z, a: F.a, w: Wd, d: Dd, f0: F.f0, street: F.f0, col: LOOK[kind].wall }, ready: () => true, hours: [-1, 25], plan: () => { const P = planOf(kind, Wd, Dd); P.hours = [-1, 25]; P.zone = 'office'; P.roster = rosterFor(F); P.service = kind; return P; } };
		W().interiors?.addSite(F.site);
		stats.sited++;
		return F;
	}
	// a bill: through the wallet hook when the other modules give one, else the patient's own
	// purse (most pay; the rest owe it)
	function bill(who, credits, rec) {
		if (hooks.charge) { try { return !!hooks.charge(who, credits, rec); } catch { return false; } }
		return hashS(who) % 10 < 8;
	}
	function wardEvent(e) {
		if (e.type === 'admitted') stats.admitted++;
		else if (e.type === 'discharged') stats.discharged++;
		else if (e.type === 'billed' && e.amount) stats.billed += e.amount;
		else if (e.type === 'treated') stats.treated++;
	}
	const list = () => [...facilities.values()].filter(Boolean);
	const nearest = (kind, x, z, max = Infinity, ok = () => true) => { let best = null, bd = max; for (const F of list()) { if (F.kind !== kind || !ok(F)) continue; const d = Math.hypot(F.x - x, F.z - z); if (d < bd) { bd = d; best = F; } } return best; };

	// ---------- the streets, for the units' routes ----------
	function gridRoads(x, z, r) {
		const w = W(), U = w.bayArea?.urbanAt?.(x, z), out = [];
		if (!U || U.u < 0.15 || w.real?.inside?.(x, z)) return out;
		const a = Math.round(U.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2, [BX, BZ, ST] = BLOCKS[U.s];
		const [gx, gz] = toGrid(x, z, a, U.s);
		const i0 = Math.floor((gx - r) / BX), i1 = Math.ceil((gx + r) / BX), j0 = Math.floor((gz - r) / BZ), j1 = Math.ceil((gz + r) / BZ);
		for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const [di, dj] of [[1, 0], [0, 1]]) {
			const pts = [];
			for (let k = 0; k <= 4; k++) { const [px, pz] = fromGrid(i * BX + ST / 2 + di * BX * k / 4, j * BZ + ST / 2 + dj * BZ * k / 4, a, U.s); pts.push(px, pz); }
			out.push({ pts, cls: 'grid' });
		}
		return out;
	}
	function routeBetween(a, b) {
		const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, r = Math.min(2600, Math.hypot(a.x - b.x, a.z - b.z) / 2 + 300), w = W();
		const roads = [...(w.real?.loaded?.() ? w.real.near('roads', cx, cz, r) : []).filter((q) => q.drive !== false), ...gridRoads(cx, cz, r)];
		const G = roadGraph(roads, 2.5), path = G.size ? findRoute(G, a, b, { reach: 160 }) : null;
		return path && path.length ? [{ x: a.x, z: a.z }, ...path, { x: b.x, z: b.z }] : [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
	}

	// ---------- the units ----------
	function unitHomes(F) {
		const fr = frameOf(F), P = F.plan, yaw = -F.a, out = [];
		if (F.kind === 'hospital' && P.amb) for (const s of [-1, 1]) { const [x, z] = fr.w(P.amb.x + s * 1.7, F.D / 2 + 4.3); out.push({ kind: 'ambulance', home: { x, z, y: Math.max(F.f0, ground(x, z)), yaw } }); }
		if (F.kind === 'fire') for (const b of (P.bays || []).slice(0, 2)) { const [x, z] = fr.w(b.x, F.D / 2 - 5.6); out.push({ kind: 'engine', home: { x, z, y: F.f0, yaw } }); }
		return out;
	}
	function ensureUnits(F, near) {
		if (near && !F.units.length) for (const u of unitHomes(F)) F.units.push(createResponder(u.kind, u.home, scene));
		else if (!near && F.units.length && F.units.every((V) => V.state === 'parked')) { for (const V of F.units) { V.sound?.stop(); V.dispose(); } F.units = []; }
	}
	// send a free ambulance from the nearest hospital to a call
	function sendAmbulance(call) {
		const F = nearest('hospital', call.x, call.z, 3200, (H) => (ensureUnits(H, true), H.units.some((V) => V.state === 'parked')));
		if (!F) return false;
		const V = F.units.find((q) => q.state === 'parked');
		V.task = { type: 'pickup', call, F };
		V.drive(routeBetween(V, call), true);
		stats.dispatched++;
		return true;
	}
	// an engine and its crew to a fire (combat/combat.js): crew(x, z) puts them down there
	function dispatchFire(fire, crew) {
		const F = nearest('fire', fire.x, fire.z, 3200, (S) => (ensureUnits(S, true), S.units.some((V) => V.state === 'parked')));
		if (!F) return false;
		const V = F.units.find((q) => q.state === 'parked'), path = routeBetween(V, fire);
		// (stop short of the flames)
		let cut = path.length - 1;
		while (cut > 1 && Math.hypot(path[cut].x - fire.x, path[cut].z - fire.z) < 16) cut--;
		V.task = { type: 'fire', fire, crew, F, t: 0 };
		V.drive(path.slice(0, cut + 1), true);
		stats.dispatched++;
		return true;
	}
	function unitArrived(V) {
		const T = V.task;
		if (!T) return;
		if (T.type === 'pickup') { V.state = 'onScene'; V.waited = 0; }
		else if (T.type === 'transport') {
			const c = T.call;
			T.F.ward.admit({ who: c.who, name: c.name, minor: c.minor, severity: c.severity, cause: c.cause, by: 'ambulance' });
			V.task = null; park(V, V.home);
		} else if (T.type === 'fire') {
			V.state = 'onScene'; V.waited = 0;
			const fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);
			try { T.crew(V.x + fx * 3, V.z + fz * 3); } catch { /* the fight is not running */ }
		} else if (T.type === 'return') { V.task = null; park(V, V.home); }
	}
	function goHome(V, siren = false, task = { type: 'return' }) {
		V.task = { ...task, F: V.task?.F };
		V.drive(routeBetween(V, V.home), siren);
	}
	function stepUnits(dt, blockers) {
		const cam = camera.position, yaw = W()?.player?.state?.yaw ?? 0;
		for (const F of list()) for (const V of F.units) {
			if (stepResponder(V, dt, roadY, blockers)) unitArrived(V);
			if (V.state === 'onScene') {
				V.waited += dt; V.lights(true, dt);
				const T = V.task;
				if (T?.type === 'pickup' && V.waited > 7) {
					// the patient on the stretcher and in: the hurt person is taken from the street
					const c = T.call;
					if (c.p) { c.p.leaving = true; c.p.leaveT = 1.5; combat()?.tend?.(c.p); }
					goHome(V, c.severity > 0.45, { type: 'transport', call: c });
				} else if (T?.type === 'fire' && (V.waited > 160 || (V.waited > 20 && Math.floor(V.waited * 2) % 4 === 0 && !(combat()?.info?.().fires || []).some((f) => f.id === T.fire.id)))) goHome(V, false);
			}
			// the siren, where you can hear it
			const d = Math.hypot(V.x - cam.x, V.z - cam.z);
			if (V.siren && d < 800) {
				if (!V.sound) V.sound = createSiren(V.kind);
				V.sound.start();
				V.sound.set(0.3 / (1 + d / 28), ((V.x - cam.x) * Math.cos(yaw) - (V.z - cam.z) * Math.sin(yaw)) / Math.max(1, d));
			} else if (V.sound) { V.sound.stop(); V.sound = null; }
		}
	}

	// ---------- the hurt round you ----------
	function callFor(p, severity, cause) {
		if (!p || handled.has(p)) return null;
		handled.add(p);
		const q = p.M?.S?.pos;
		if (!q) return null;
		const minor = !!(p.P?.dna?.child || p.P?.dna?.minor);
		return { x: q.x, z: q.z, who: 'npc:' + ((p.P?.dna?.seed ?? 0) >>> 0), name: p.persona?.name || (minor ? 'A child' : 'A passer-by'), minor, severity: Math.max(0.05, Math.min(1, severity)), cause, p, t: clock };
	}
	// a hurt person: walked in when it is mild and a hospital is near, else an ambulance
	function care(c) {
		if (!c) return;
		const H = nearest('hospital', c.x, c.z, 3200);
		if (!H) return;
		if (c.severity < 0.35 && !c.minor && Math.hypot(H.x - c.x, H.z - c.z) < 450) {
			if (c.p) { c.p.leaving = true; c.p.leaveT = 4; }
			H.ward.admit({ who: c.who, name: c.name, minor: c.minor, severity: c.severity, cause: c.cause, by: 'walk-in' });
			return;
		}
		if (!sendAmbulance(c)) calls.push(c);
	}
	function lookForHurt() {
		const C = combat(), cam = camera.position;
		if (!C?.woundedNear) return;
		for (const w of C.woundedNear(cam.x, cam.z, 160) || []) if (w.hp / w.max < 0.65) care(callFor(w.p, 1 - w.hp / w.max, 'injury'));
	}
	// the town's own: a fall, a sprain, an illness walked in; a call the ambulance goes out to
	function background(dt) {
		const cam = camera.position;
		for (const F of list()) {
			if (F.kind !== 'hospital' || Math.hypot(F.x - cam.x, F.z - cam.z) > 1600) continue;
			F.bgT = (F.bgT ?? 40 + (F.seed % 60)) - dt;
			if (F.bgT > 0) continue;
			F.bgT = 110 + ((F.seed + bgSeq * 37) % 160);
			const n = ++bgSeq, u = ((F.seed >>> 3) + n * 2654435761) >>> 0, minor = u % 7 === 0, sev = 0.1 + (u % 100) / 100 * 0.5;
			const cause = ['a fall', 'a sprained ankle', 'a fever', 'a kitchen burn', 'a cycling crash', 'chest pain'][u % 6];
			if (u % 10 < 7) F.ward.admit({ who: `town:${F.key}:${n}`, name: minor ? 'A child' : 'A resident', minor, severity: sev, cause, by: 'walk-in' });
			else {
				// out along a street a few hundred metres off, and back with them
				const a = (u % 628) / 100, r = 300 + (u % 500), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
				const c = { x, z, who: `town:${F.key}:${n}`, name: 'A resident', minor, severity: Math.min(1, sev + 0.3), cause, t: clock };
				if (!sendAmbulance(c)) calls.push(c);
			}
		}
	}
	// a person struck by a car (vehicles/impact.js through main.js)
	function injury(p, cause = 'a road crash', severity = 0.6) { care(callFor(p, severity, cause)); }

	// ---------- you ----------
	// knocked out: brought round at the nearest hospital, for what it costs (owed if you cannot)
	function revive(pos) {
		const H = nearest('hospital', pos.x, pos.z, 3200);
		if (!H) return null;
		const fr = frameOf(H), P = H.plan, ax = P.amb ? P.amb.x - 3.2 : 0, [x, z] = fr.w(ax, H.D / 2 + 3), credits = arms?.info?.().credits ?? 0;
		const q = playerCare({ down: true, missing: 1, credits }), paid = q.price ? !!arms?.spendCredits?.(q.price, { kind: 'hospital' }) : true;
		H.debt += (paid ? 0 : q.price) + (q.owed || 0);
		stats.revived++;
		hint(`You were brought to ${H.name} and treated${q.price ? ` (${q.price} credits${q.owed ? `, ${q.owed} owed` : ''})` : ''}.`, 6000);
		return { x, y: ground(x, z) + 1.7, z, yaw: H.a, k: 1, hospital: H.name };
	}
	function treatMe(H) {
		const C = combat();
		if (!C) return false;
		const max = C.info?.().me?.max || 100, missing = (C.hurt0?.() || 0) / max, credits = arms?.info?.().credits ?? 0;
		const q = playerCare({ missing, credits });
		if (!q.ok) { hint(q.why, 3000); return false; }
		const paid = q.price ? !!arms?.spendCredits?.(q.price, { kind: 'hospital' }) : true;
		H.debt += (paid ? 0 : q.price) + (q.owed || 0);
		C.heal?.();
		hint(`Treated at ${H.name}${q.price ? ` for ${q.price} credits` : ''}${q.owed ? ` (${q.owed} owed)` : ''}.`, 4000);
		return true;
	}
	function buyMedkit(H) {
		const price = ARMS_CATALOG['field-medkit']?.basePrice ?? 58, n = (arms?.info?.().items?.length || 0) + Date.now() % 100000;
		const out = arms?.apply?.({ id: `pharmacy:${H.key}:${n}:${Math.random().toString(36).slice(2, 7)}`, kind: 'trade', peer: `pharmacy:${H.key}`.slice(0, 40), give: { credits: price, items: [] }, get: { credits: 0, items: [{ u: mintUid(`${H.key}:medkit:${n}`, Date.now() % 997), i: 'field-medkit', l: 1, t: 0, x: 0 }] } });
		hint(out?.ok ? `Bought a field medkit at the ${H.name} pharmacy (${price} credits).` : out?.message || 'The pharmacy could not sell you that.', 3500);
		return !!out?.ok;
	}

	// ---------- the caches ----------
	const STORE = 'bard:service-depots';
	const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } })();
	function depotFor(F, rm) {
		const id = `${F.key}:${rm.id}`;
		let D = F.depots.get(id);
		if (!D) {
			D = createDepot(id, rm.cache, { guarded: true });
			const s = saved[id];
			if (s?.stock) { D.stock = { ...D.stock, ...s.stock }; D.seq = s.seq || 0; }
			F.depots.set(id, D);
		}
		return D;
	}
	function keep(D) { saved[D.id] = { stock: D.stock, seq: D.seq }; try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* private mode: kept for this visit */ } }
	function take(F, D, itemId) {
		const r = takeFrom(D, itemId, Date.now().toString(36));
		if (!r.ok) { hint(r.why, 2500); return false; }
		const out = arms?.apply?.(r.tx);
		if (!out?.ok) { hint(out?.message || 'You could not take that.', 2500); return false; }
		F.depots.set(D.id, r.next); keep(r.next);
		const witnessed = here()?.F === F && (people()?.pool || []).some((p) => p.active && p.workSpot?.work && Math.hypot(p.M.S.pos.x - camera.position.x, p.M.S.pos.z - camera.position.z) < 14);
		try { hooks.onLoot?.(r.next, itemId, witnessed); } catch { /* the heat is another module's */ }
		if (witnessed && !hooks.onLoot) { const C = combat(); if (C?.wanted) C.wanted(Math.min(5, (C.wanted() || 0) + 1)); }
		hint(`Took ${ARMS_CATALOG[itemId]?.name || itemId}${witnessed ? '. They saw you.' : '.'}`, 2500);
		return true;
	}
	function bring(F, D, itemId) {
		const inst = Object.values(arms?.state?.()?.instances || {}).filter((x) => x.i === itemId).sort((a, b) => a.l - b.l || a.t - b.t)[0];
		if (!inst) { hint('You have none of those to bring.', 2500); return false; }
		const r = bringTo(D, inst, Date.now().toString(36));
		if (!r.ok) { hint(r.why, 2500); return false; }
		const out = arms?.apply?.(r.tx);
		if (!out?.ok) { hint(out?.message || 'The quartermaster would not take it.', 2500); return false; }
		F.depots.set(D.id, r.next); keep(r.next);
		hint(`Resupplied the cache with ${ARMS_CATALOG[itemId]?.name || itemId} (+${r.pay} credits).`, 3000);
		return true;
	}

	// ---------- where you are ----------
	function here() {
		const I = W()?.interiors, h = I?.inside?.(camera.position);
		if (!h?.B?.site) return null;
		const F = list().find((q) => q.site === h.B.site);
		if (!F) return null;
		const fr = frameOf(F), [lx, lz] = fr.l(camera.position.x, camera.position.z);
		const rm = h.B.P.rooms.find((r) => r.k === h.level && lx > r.x0 - 0.05 && lx < r.x1 + 0.05 && lz > r.z0 - 0.05 && lz < r.z1 + 0.05) || null;
		return { F, B: h.B, rm, level: h.level };
	}

	// ---------- the prompt and the cache's panel ----------
	let btn = null, panel = null, promptFor = null;
	if (mount && button) {
		btn = button('🏥', 'Service', 'display:none;', 'prompt 63');
		mount.appendChild(btn);
		for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (e) => e.stopPropagation());
		btn.addEventListener('click', (e) => { e.stopPropagation(); promptFor?.(); });
	}
	function showPanel(F, D, shop = false) {
		closePanel();
		if (!mount) return;
		panel = document.createElement('div');
		panel.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 32px));max-height:70%;overflow:auto;padding:14px;border-radius:14px;background:rgba(8,20,26,.92);color:#eafaf6;font:13px system-ui;z-index:40;border:1px solid rgba(255,255,255,.2)';
		for (const ev of ['pointerdown', 'touchstart', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());
		const render = () => {
			const Dn = F.depots.get(D.id), own = {};
			for (const x of Object.values(arms?.state?.()?.instances || {})) own[x.i] = (own[x.i] || 0) + 1;
			panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>${F.name}: ${{ weapons: 'weapons cache', supply: 'supply cache', medical: 'medical stores', police: 'evidence and armory', fire: 'station stores' }[Dn.kind] || 'cache'}</b><button data-x style="min-width:44px;min-height:36px">✕</button></div>`
				+ (shop ? `<div style="display:flex;gap:6px;align-items:center;padding:6px 0"><span style="flex:1">Field medkit, over the counter</span><button data-buy style="min-height:36px">Buy (${ARMS_CATALOG['field-medkit']?.basePrice ?? 58} cr)</button></div>` : '')
				+ stockList(Dn).map((r) => `<div style="display:flex;gap:6px;align-items:center;padding:4px 0;border-top:1px solid rgba(255,255,255,.08)"><span style="flex:1">${r.name} <span style="opacity:.6">${r.n}/${r.cap}</span></span><button data-t="${r.itemId}" style="min-height:36px" ${r.n ? '' : 'disabled'}>Take</button><button data-b="${r.itemId}" style="min-height:36px" ${own[r.itemId] ? '' : 'disabled'}>Bring (+${r.pay})</button></div>`).join('')
				+ '<div style="opacity:.65;margin-top:8px">Taking from a guarded cache is looting: anyone on duty here will see it.</div>';
			panel.querySelector('[data-x]').onclick = closePanel;
			const buy = panel.querySelector('[data-buy]');
			if (buy) buy.onclick = () => { buyMedkit(F); render(); };
			for (const b of panel.querySelectorAll('[data-t]')) b.onclick = () => { take(F, F.depots.get(D.id), b.dataset.t); render(); };
			for (const b of panel.querySelectorAll('[data-b]')) b.onclick = () => { bring(F, F.depots.get(D.id), b.dataset.b); render(); };
		};
		render();
		mount.appendChild(panel);
	}
	function closePanel() { panel?.remove(); panel = null; }
	function prompt(H) {
		if (!btn) return;
		const rm = H?.rm, F = H?.F;
		let label = null, act = null;
		if (F?.kind === 'hospital' && rm && CARE_ROOMS.has(rm.type) && (combat()?.hurt0?.() || 0) > 1) {
			const C = combat(), q = playerCare({ missing: C.hurt0() / (C.info?.().me?.max || 100), credits: arms?.info?.().credits ?? 0 });
			label = `🏥 Get treated · ${q.price} cr`; act = () => treatMe(F);
		} else if (rm?.cache) {
			const D = depotFor(F, rm), shop = F.kind === 'hospital' && rm.type === 'pharmacy';
			label = shop ? '💊 Pharmacy' : '📦 Supply cache'; act = () => showPanel(F, D, shop);
		}
		if (label) { btn.textContent = label; btn.title = label; btn.style.display = ''; promptFor = act; }
		else { btn.style.display = 'none'; promptFor = null; if (panel) closePanel(); }
	}

	// ---------- the rooms' live things: the map table, the screens, the signs ----------
	function liveB(F) { for (const B of W()?.interiors?.live?.values?.() || []) if (B.site === F.site && B.ready) return B; return null; }
	function buildProps(F, B) {
		const g = new THREE.Group(), fr = frameOf(F), items = [];
		g.position.set(F.x, F.f0, F.z); g.rotation.y = -F.a;
		for (const rm of B.P.rooms) {
			const L = B.P.levels[rm.k];
			if (rm.mapTable) {
				const T = mapTable({ ...rm.mapTable, y: L.y + rm.mapTable.y }, fr);
				const lots = (W().city?.lotsNear?.(F.x, F.z, 400) || []).filter((o) => o.h > 1.5);
				const roads = [...(W().real?.loaded?.() ? W().real.near('roads', F.x, F.z, 420) : []), ...gridRoads(F.x, F.z, 420)];
				T.drawBase(roads, lots, F);
				g.add(T.mesh); items.push({ type: 'map', T, rm });
			}
			for (const s of (rm.screens || []).slice(0, 4)) { const S = dutyScreen({ ...s, y0: L.y + s.y0 }); g.add(S.mesh); items.push({ type: 'screen', S, rm }); }
			const label = SIGNS[rm.type];
			if (label && rm.x1 - rm.x0 > 2.4 && rm.z1 - rm.z0 > 2.4) {
				const w = Math.min(2.6, rm.x1 - rm.x0 - 1), s = roomSign(label, w, 0.32, F.kind === 'fire' ? '#9b1d14' : F.kind === 'armory' ? '#3d4630' : F.kind === 'police' ? '#1b2a48' : '#1d5fa8');
				const back = s.mesh.clone();
				back.rotation.y = Math.PI;
				const grp = new THREE.Group();
				grp.add(s.mesh, back);
				grp.position.set((rm.x0 + rm.x1) / 2, L.y + L.h - 0.45, Math.min(rm.z1 - 0.6, (rm.z0 + rm.z1) / 2 + (rm.z1 - rm.z0) * 0.3));
				g.add(grp); items.push({ type: 'sign', s });
			}
		}
		scene.add(g);
		return { g, items, t: 0, dispose: () => { scene.remove(g); for (const it of items) (it.T || it.S || it.s).dispose(); } };
	}
	function marksFor(F) {
		const cam = camera.position, out = [{ x: cam.x, z: cam.z, kind: 'you' }];
		for (const G of list()) if (Math.hypot(G.x - F.x, G.z - F.z) < 700) out.push({ x: G.x, z: G.z, kind: G.kind });
		for (const G of list()) for (const V of G.units) out.push({ x: V.x, z: V.z, kind: 'unit' });
		for (const c of calls) out.push({ x: c.x, z: c.z, kind: 'call' });
		for (const G of list()) for (const V of G.units) if (V.task?.type === 'fire') out.push({ x: V.task.fire.x, z: V.task.fire.z, kind: 'fireCall' });
		return out;
	}
	function boardRows(F) {
		const rows = [], near = list().filter((G) => Math.hypot(G.x - F.x, G.z - F.z) < 3000);
		for (const G of near) for (const [i, V] of G.units.entries()) rows.push({ text: `${G.kind === 'fire' ? 'ENGINE' : 'MEDIC'} ${(G.seed % 90) + 10}-${i + 1}`, state: { parked: 'AVAILABLE', driving: V.task?.type === 'return' ? 'RETURNING' : 'EN ROUTE', onScene: 'ON SCENE', arrived: 'ARRIVED' }[V.state] || V.state.toUpperCase(), alert: V.siren });
		for (const c of calls.slice(0, 3)) rows.push({ text: `CALL: ${c.cause}`, state: 'WAITING', alert: true });
		const H = near.find((G) => G.kind === 'hospital');
		if (H) rows.push({ text: `${H.name}: ${H.ward.count('treating')} treating, ${H.ward.count('recovering')} recovering`, state: `${H.ward.beds} BEDS` });
		if (!rows.length) rows.push({ text: 'ALL QUIET', state: 'GREEN' });
		return rows;
	}

	// ---------- each frame ----------
	let radioT = 3, beepT = 1, hurtT = 0, callT = 0;
	function update(dt, hours = 12, nightK = 0) {
		const t0 = performance.now(), w = W();
		if (!w?.bayArea?.loaded?.()) return;
		clock += dt;
		const cam = camera.position, high = cam.y - raw(cam.x, cam.z) > 300;
		// which buildings, as you travel
		scanT -= dt;
		if (scanT <= 0) {
			scanT = 2.5;
			queue.length = 0;
			for (const kind of KINDS) for (const A of anchorsNear(kind, cam.x, cam.z, SCAN_R)) if (stale(A) && Math.hypot(A.x - cam.x, A.z - cam.z) < DECIDE_R) queue.push(A);
			queue.sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z));
		}
		// (one cell decided at a time, a few a second by the clock: a slow frame does not hold them up)
		if (queue.length && t0 >= decideT && !high) { decide(queue.shift()); decideT = performance.now() + 400; }
		const blockers = [{ x: cam.x, z: cam.z, child: false }];
		for (const p of people()?.pool || []) if (p.active && p.M?.S?.pos) blockers.push({ x: p.M.S.pos.x, z: p.M.S.pos.z, child: !!(p.P?.dna?.child || p.P?.dna?.minor) });
		let built = false;
		for (const F of list()) {
			const d = Math.hypot(F.x - cam.x, F.z - cam.z) - Math.max(F.W, F.D) / 2;
			const shellR = isPhone ? 500 : 900;
			if (!F.shell && d < shellR && !built) { F.shell = buildShell(F); scene.add(F.shell.root); built = true; }
			else if (F.shell && d > shellR + 250) { scene.remove(F.shell.root); F.shell.dispose(); F.shell = null; }
			ensureUnits(F, d < 1300);
			F.live = !!F.site.live;
			if (F.shell) {
				F.shell.levels.visible = !F.live;
				F.shell.root.visible = !high;
				F.shell.setNight(nightK);
				const fr = frameOf(F);
				for (const D of F.shell.doors) {
					const [dx, dz] = fr.w(D.x, D.z);
					const near = Math.hypot(dx - cam.x, dz - cam.z) < 7 || F.units.some((V) => V.state !== 'parked' && Math.hypot(V.x - dx, V.z - dz) < 16);
					const k = D.open + Math.sign((near ? 1 : 0) - D.open) * Math.min(Math.abs((near ? 1 : 0) - D.open), dt * 0.9);
					if (k !== D.open) setDoor(D, k);
				}
			}
			// the rooms' live things, while you are in or by them
			const B = F.live && d < 60 ? liveB(F) : null;
			if (B && !F.props) F.props = buildProps(F, B);
			else if (!B && F.props) { F.props.dispose(); F.props = null; }
			if (F.props) {
				F.props.t -= dt;
				if (F.props.t <= 0) {
					F.props.t = 0.35;
					for (const it of F.props.items) {
						if (it.type === 'map') it.T.draw(marksFor(F), clock);
						else if (it.type === 'screen') it.S.draw(`${F.name.toUpperCase()}: DUTY BOARD`, boardRows(F), Date.now() / 1000);
					}
				}
			}
			if (F.ward) { const on = duty(F, hours); F.ward.tick(dt, { doctors: on.doctor, nurses: on.nurse }); }
			for (const [id, D] of F.depots) F.depots.set(id, restock(D, dt));
		}
		shellMats().setNight?.(nightK);
		stepUnits(dt, blockers);
		// the calls left waiting for an ambulance
		callT -= dt;
		if (calls.length && callT <= 0) { callT = 3; for (let i = calls.length - 1; i >= 0; i--) if (sendAmbulance(calls[i]) || clock - calls[i].t > 600) calls.splice(i, 1); }
		hurtT -= dt;
		if (hurtT <= 0) { hurtT = 1.5; lookForHurt(); }
		background(dt);
		// where you are: the prompt, and the rooms' sounds
		const H = here();
		prompt(H);
		if (H?.rm) {
			radioT -= dt; beepT -= dt;
			if (RADIO_ROOMS.has(H.rm.type) && radioT <= 0) { radioT = 4 + Math.random() * 7; radioBurst(0.05, Math.random() - 0.5); }
			if (BEEP_ROOMS.has(H.rm.type) && beepT <= 0 && (H.F.ward?.count() || 0) > 0) { beepT = 1.05; monitorBeep(0.02, 0); }
		}
		stats.frameMs = performance.now() - t0;
	}

	// ---------- solid: the shells until their rooms are built, the canopies, the units ----------
	function push(pos, footY) {
		for (const F of list()) {
			if (!F.shell || Math.hypot(F.x - pos.x, F.z - pos.z) > Math.max(F.W, F.D) + 12) continue;
			const fr = frameOf(F), q = fr.l(pos.x, pos.z), fy = footY - F.f0;
			for (const c of F.shell.col) {
				if ((c === F.shell.col[0] && F.live) || fy + 1.7 < c[4] || fy > c[5]) continue;
				if (pushBox(q, c)) { const [x, z] = fr.w(q[0], q[1]); pos.x = x; pos.z = z; }
			}
		}
		for (const F of list()) for (const V of F.units) {
			if (Math.hypot(V.x - pos.x, V.z - pos.z) > 7 || footY > V.y + 2.6) continue;
			const ca = Math.cos(-V.yaw), sa = Math.sin(-V.yaw), dx = pos.x - V.x, dz = pos.z - V.z, q = [ca * dx + sa * dz, -sa * dx + ca * dz], hw = V.kind === 'engine' ? 1.35 : 1.1, hl = V.kind === 'engine' ? 4.7 : 3.2;
			if (pushBox(q, [-hw, -hl, hw, hl + 1.4])) { pos.x = V.x + ca * q[0] - sa * q[1]; pos.z = V.z + sa * q[0] + ca * q[1]; }
		}
	}
	function pushBox(q, b) {
		const R = 0.3, qx = Math.max(b[0], Math.min(b[2], q[0])), qz = Math.max(b[1], Math.min(b[3], q[1])), dx = q[0] - qx, dz = q[1] - qz, d2 = dx * dx + dz * dz;
		if (d2 >= R * R) return false;
		if (d2 < 1e-8) { const pen = [q[0] - b[0], b[2] - q[0], q[1] - b[1], b[3] - q[1]], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) q[0] = b[0] - R; else if (k === 1) q[0] = b[2] + R; else if (k === 2) q[1] = b[1] - R; else q[1] = b[3] + R; }
		else { const d = Math.sqrt(d2); q[0] = qx + dx / d * R; q[1] = qz + dz / d * R; }
		return true;
	}
	// the steps up to the doors
	function floor(x, z, y) {
		let best = -1e9;
		for (const F of list()) {
			if (!F.shell || Math.hypot(F.x - x, F.z - z) > Math.max(F.W, F.D) + 10) continue;
			const [lx, lz] = frameOf(F).l(x, z), fy = y - F.f0;
			for (const s of F.shell.steps) if (lx > s[0] && lx < s[2] && lz > s[1] && lz < s[3] && fy > s[4] - 0.7) best = Math.max(best, F.f0 + s[4]);
			for (const p of F.shell.pads) if (p !== F.shell.pads[0] && lx > p[0] && lx < p[2] && lz > p[1] && lz < p[3] && fy > p[4] - 0.7) best = Math.max(best, F.f0 + p[4]);
		}
		return best;
	}

	// ---------- for the console, the guide and the tests ----------
	function onDutyNames(F, hours) {
		const out = [];
		for (const [role, n] of Object.entries(duty(F, hours))) {
			if (role === 'visitor' || role === 'detainee' || role === 'patient') continue;
			const shift = hours >= 7 && hours < 19 ? 0 : 1;
			for (let i = 0; i < n; i++) out.push({ role, name: staffName(F.seed + hashS(role) % 997 * 13 + shift * 101 + i) });
		}
		return out;
	}
	function info() {
		const cam = camera.position, hours = W()?.sky?.state?.hours ?? 12;
		return {
			near: list().map((F) => ({
				kind: F.kind, title: TITLES[F.kind], name: F.name, d: Math.round(Math.hypot(F.x - cam.x, F.z - cam.z)), x: Math.round(F.x), z: Math.round(F.z), size: [+F.W.toFixed(1), +F.D.toFixed(1)], src: F.src, shell: !!F.shell, live: F.live,
				onDuty: onDutyNames(F, hours), units: F.units.map((V) => ({ kind: V.kind, state: V.state, siren: V.siren, task: V.task?.type || null })),
				...(F.ward ? { beds: F.ward.beds, patients: F.ward.list().map((q) => ({ name: q.name, state: q.state, minor: q.minor, cause: q.cause, care: Math.round(q.care), need: Math.round(q.need), by: q.by })), ledger: { ...F.ward.ledger } } : {}),
				debt: F.debt, caches: [...F.depots.values()].map((D) => ({ kind: D.kind, stock: stockList(D).map((r) => `${r.itemId} ${r.n}/${r.cap}`) })),
			})).sort((a, b) => a.d - b.d),
			calls: calls.map((c) => ({ cause: c.cause, minor: c.minor, x: Math.round(c.x), z: Math.round(c.z) })),
			here: (() => { const H = here(); return H ? { name: H.F.name, room: H.rm?.type || null, level: H.level } : null; })(),
			stats: { ...stats, facilities: list().length, decidedNone: [...facilities.values()].filter((v) => !v).length, pending: queue.length },
		};
	}
	// to the nearest of a kind: before its door, or (room given, and its rooms built) into that room
	function go(kind = 'hospital', room = null) {
		const P = W()?.player?.state;
		if (!P) return 'No world.';
		const cam = camera.position;
		if (!KINDS.includes(kind)) return `Kinds: ${KINDS.join(', ')}.`;
		// (decide every cell round here now, if it has not been)
		for (const A of anchorsNear(kind, cam.x, cam.z, SCAN_R)) if (stale(A)) decide(A);
		const F = nearest(kind, cam.x, cam.z);
		if (!F) return `No ${TITLES[kind].toLowerCase()} within reach here.`;
		if (room && F.live) {
			const I = W().interiors, idx = [...I.live.values()].filter((B) => B.ready && B.use === 'site' && B.P.rooms.some((q) => q.type === room)).findIndex((B) => B.site === F.site);
			const r = idx >= 0 ? I.goTo(P, 'site', idx, room) : null;
			if (r) return { ...r, name: F.name };
		}
		const fr = frameOf(F), dx = F.plan.door.x, [x, z] = fr.w(dx, F.D / 2 + 6), [tx, tz] = fr.w(dx, 0);
		P.flying = false; P.vel?.set(0, 0, 0);
		P.pos.set(x, Math.max(ground(x, z), F.street) + 1.7, z);
		P.yaw = Math.atan2(-(tx - x), -(tz - z)); P.pitch = 0;
		return { kind, name: F.name, d: 0, room: room && !F.live ? 'its rooms are being built: ask again in a moment' : null };
	}
	// equipment sources for the gear screen (crysis/arms-runtime.js): police caches, pharmacies
	function sites() {
		const out = [];
		for (const F of list()) {
			if (F.kind === 'police') out.push({ id: `svc-${F.key}`, name: `${F.name} recovery cache`, kind: 'police', x: F.x, z: F.z, actions: ['secure'], source: 'services' });
			if (F.kind === 'hospital') out.push({ id: `svc-${F.key}`, name: `${F.name} pharmacy`, kind: 'supermarket', x: F.x, z: F.z, stock: ['field-medkit'], actions: ['purchase'], source: 'services' });
		}
		return out;
	}
	// tests and the console: a call, now, near you (an ambulance comes)
	function testCall(severity = 0.6, minor = false) {
		const cam = camera.position, c = { x: cam.x + 30, z: cam.z + 30, who: `test:${clock.toFixed(1)}`, name: minor ? 'A child' : 'A passer-by', minor, severity, cause: 'a test call', t: clock };
		return sendAmbulance(c) ? 'An ambulance is on its way.' : (calls.push(c), 'No ambulance free: the call waits.');
	}
	function dispose() {
		closePanel(); btn?.remove();
		for (const F of list()) { if (F.shell) { scene.remove(F.shell.root); F.shell.dispose(); } F.props?.dispose(); for (const V of F.units) { V.sound?.stop(); V.dispose(); } }
		facilities.clear();
	}
	// (every cell round you decided now: the console and the tests)
	const decideNear = () => { const cam = camera.position; for (const kind of KINDS) for (const A of anchorsNear(kind, cam.x, cam.z, SCAN_R)) if (stale(A)) decide(A); return list().length; };
	return { update, push, floor, info, go, decideNear, sites, revive, dispatchFire, injury, testCall, dispose, hooks, list, here: () => here(), admit: (kind, p) => nearest('hospital', camera.position.x, camera.position.z)?.ward.admit(p) };
}

// a site for interiors.addSite round a plan of this module's (for another module's own
// buildings: the military's war room, depot or barracks). o: { x, z, a, w, d, f0, street?, col? }
// (staffed by the armory's roster unless given one: roster(hours, seats, level) -> seats)
export function serviceSite(key, plan, o, roster = rosterFor({ kind: 'armory', units: [] })) {
	return { key, o: { street: o.f0, col: [0.56, 0.56, 0.48], ...o }, ready: () => true, hours: [-1, 25], plan: () => { const P = plan({ W: o.w, D: o.d }); P.hours = [-1, 25]; P.zone = 'office'; P.roster = roster; return P; } };
}
