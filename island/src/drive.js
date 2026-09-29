// Drive: snap onto the road you are on and let it carry you. The pace is automatic (a
// residential street at about 25 mph, a collector faster, a freeway at 65, a trail or
// fire road at a hiking or biking pace); you only choose where to go at the next
// junction: ← left, → right, ↑ straight on, ↓ turn round now. Works on the real streets,
// country roads and trails (San Ramon, Mt Diablo, Mt Tam, Mission Peak) and on the town
// street grids everywhere else. V or the road button to start and stop.
//
// You drive a real car. Beside a parked car, V takes it (whoever's it is, for now); else
// your own, where you left it, or a new one (the car button picks the kind). By default you
// drive it yourself (vehicles/physics.js: Rapier's ray-cast vehicle, each kind with its
// own weight, power, springs and grip): ↑/W to go, ↓/S to brake and reverse, ←→/AD to
// steer, Space for the handbrake, C to look from behind. M (or the assist button) hands
// the wheel back to the road: snapped to it, choosing only the turns, as before. Stop, and
// the car stays where you left it.

import * as THREE from 'three';
import { BLOCKS, toGrid, fromGrid } from './bay/styles.js';
import { specOf, seatsOf } from './bay/cars.js';
import { loadRapier, createCarPhysics } from './vehicles/physics.js';

const SPEED = { motorway: 29, trunk: 24, primary: 20, secondary: 17, tertiary: 15, residential: 11, unclassified: 12, living_street: 7, service: 6, unknown: 8, track: 5, path: 3, footway: 2.4, cycleway: 5, steps: 1.4, pedestrian: 2.4, grid: 11 };
const TRAIL = new Set(['track', 'path', 'footway', 'cycleway', 'steps', 'pedestrian']);
const ONE_WAY = (r) => !!(r.divided || r.link || r.cls === 'motorway');

function lengthOf(p) { let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return L; }
// position and unit direction at distance s along a polyline [x, z, x, z, ...]
function at(p, s) {
	let acc = 0;
	for (let i = 2; i < p.length; i += 2) {
		const dx = p[i] - p[i - 2], dz = p[i + 1] - p[i - 1], L = Math.hypot(dx, dz);
		if (acc + L >= s || i === p.length - 2) {
			const t = L ? Math.min(1, Math.max(0, (s - acc) / L)) : 0;
			return [p[i - 2] + dx * t, p[i - 1] + dz * t, L ? dx / L : 1, L ? dz / L : 0];
		}
		acc += L;
	}
	return [p[0], p[1], 1, 0];
}
function nearestOn(p, x, z) {
	let best = 0, bd = 1e9, acc = 0;
	for (let i = 2; i < p.length; i += 2) {
		const ax = p[i - 2], az = p[i - 1], dx = p[i] - ax, dz = p[i + 1] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
		if (d < bd) { bd = d; best = acc + t * Math.sqrt(l2); }
		acc += Math.sqrt(l2);
	}
	return [best, bd];
}

export function createDrive({ world, camera, mount, isPhone, hint, strike = null }) {
	const D = { active: false, edge: null, s: 0, dir: 1, v: 0, queue: 'straight', yaw: 0, y: null, plan: null, look: 0, lookT: 0, lastYaw: undefined, mode: 'free', kind: 'sedan', color: new THREE.Color(0.1, 0.2, 0.45), car: null, chase: false, pedals: {} };
	const KINDS = ['sedan', 'hatch', 'crossover', 'suv', 'pickup', 'van', 'sports', 'delivery', 'truck', 'bus'];
	const CREDITS = 'Vehicle models (CC BY 4.0): "Car Concept" by Eric Chadwick / Darmstadt Graphics Group; "Red Car" by Camay; "European Delivery Van" by Evan Hiltz; "Generic Town Bus" by own.guest. Physics: Rapier. Details: assets/vehicles/CREDITS.md';

	// ---------- the road network ----------
	// an edge: { pts, L, cls, name, w, oneway, real?, grid? }
	const realEdge = (r) => ({ pts: r.pts, L: r.len || (r.len = lengthOf(r.pts)), cls: r.cls, name: r.name, w: r.w, oneway: ONE_WAY(r), real: r });
	function gridEdge(G, i, j, axis, sgn) {
		// from the crossing (i, j) one block along grid x or z
		const [BX, BZ, ST] = BLOCKS[G.style];
		const gx0 = i * BX + ST / 2, gz0 = j * BZ + ST / 2, pts = [];
		for (let k = 0; k <= 8; k++) {
			const t = k / 8 * sgn;
			const [x, z] = fromGrid(gx0 + (axis === 'x' ? t * BX : 0), gz0 + (axis === 'z' ? t * BZ : 0), G.a, G.style);
			pts.push(x, z);
		}
		const e = { pts, cls: 'grid', name: '', w: ST, oneway: false, grid: { ...G, i, j, axis, sgn, ni: i + (axis === 'x' ? sgn : 0), nj: j + (axis === 'z' ? sgn : 0) } };
		e.L = lengthOf(pts);
		return e;
	}
	const urbanOK = (G, x, z) => { const U = world().bayArea?.urbanAt(x, z); return U && U.u > 0.2 && U.s === G.style && Math.abs(U.a - G.a) < 0.02 && !world().real?.inside(x, z); };

	// where the road goes on from its end: every other road that meets it there
	function options(e, dir, deep = false) {
		const end = dir > 0 ? at(e.pts, e.L) : at(e.pts, 0);
		const [ex, ez] = end, out = [];
		if (e.real) {
			for (const r of world().real.near('roads', ex, ez, 30)) {
				if (r === e.real || r.pts.length < 4) continue;
				const n = r.pts.length;
				const d0 = Math.hypot(r.pts[0] - ex, r.pts[1] - ez), d1 = Math.hypot(r.pts[n - 2] - ex, r.pts[n - 1] - ez);
				if (Math.min(d0, d1) > 2.5) continue;
				const q = realEdge(r), fwd = d0 <= d1;
				if (q.oneway && !fwd) continue;                                            // not the wrong way up a one-way
				out.push({ e: q, dir: fwd ? 1 : -1 });
			}
		} else if (e.grid) {
			const G = e.grid, i = dir > 0 ? G.ni : G.i, j = dir > 0 ? G.nj : G.j;
			for (const [axis, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
				const q = gridEdge(G, i, j, axis, sgn), [mx, mz] = at(q.pts, q.L / 2);
				// not straight back the way we came
				if (dir > 0 && axis === G.axis && sgn === -G.sgn) continue;
				if (dir < 0 && axis === G.axis && sgn === G.sgn) continue;
				if (urbanOK(G, mx, mz)) out.push({ e: q, dir: 1 });
			}
		}
		// each option's heading as it leaves the junction
		const heading = (o) => { const p = at(o.e.pts, o.dir > 0 ? Math.min(12, o.e.L) : Math.max(0, o.e.L - 12)), q = at(o.e.pts, o.dir > 0 ? 0 : o.e.L); const dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1; o.dx = dx / l; o.dz = dz / l; };
		for (const o of out) heading(o);
		if (!deep) {
			// a junction is often a knot of short links: look through a short link to the roads
			// beyond it, so "right" means the road you actually turn onto
			const more = [];
			for (const o of out) {
				if (o.e.L > 35) { more.push(o); continue; }
				const beyond = options(o.e, o.dir, true).filter((b) => b.e.real !== e.real);
				if (!beyond.length) { more.push(o); continue; }
				for (const b of beyond) more.push({ e: o.e, dir: o.dir, then: b, dx: b.dx, dz: b.dz });
			}
			return more;
		}
		return out;
	}
	function choose(opts, hx, hz, want, cls, name) {
		if (!opts.length) return null;
		// the signed turn: negative to the left, positive to the right (x east, z south)
		for (const o of opts) o.turn = Math.atan2(hx * o.dz - hz * o.dx, hx * o.dx + hz * o.dz);
		// keep to roads (or to trails), to the same road by name, and out of service lanes
		// (judged by the road beyond a short link, not the link itself)
		const family = (o) => { const f = o.then ? o.then.e : o.e; return (TRAIL.has(f.cls) !== TRAIL.has(cls) ? 0.6 : 0) + (f.cls === 'service' && cls !== 'service' ? 0.8 : 0) - (name && f.name === name ? 0.4 : 0); };
		// a left or right is the option nearest a square turn that way
		if (want === 'left') { const l = opts.filter((o) => o.turn < -0.35).sort((a, b) => Math.abs(a.turn + Math.PI / 2) + family(a) - Math.abs(b.turn + Math.PI / 2) - family(b)); if (l.length) return l[0]; }
		if (want === 'right') { const r = opts.filter((o) => o.turn > 0.35).sort((a, b) => Math.abs(a.turn - Math.PI / 2) + family(a) - Math.abs(b.turn - Math.PI / 2) - family(b)); if (r.length) return r[0]; }
		return opts.slice().sort((a, b) => Math.abs(a.turn) + family(a) - Math.abs(b.turn) - family(b))[0];
	}

	// ---------- getting on ----------
	function snap() {
		const W = world(), P = W.player.state, x = P.pos.x, z = P.pos.z;
		const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
		let best = null;
		// the mapped roads, and the roads added by hand beyond the maps (the Golden Gate's deck,
		// the Presidio Parkway): inside a mapped region anything within 90 m, outside it only a
		// road you are right by
		const inside = W.real?.loaded() && W.real.inside(x, z);
		if (W.real?.loaded()) for (const r of W.real.near('roads', x, z, 90)) {
			if (r.pts.length < 4 || (!inside && !r.drive)) continue;
			const e = realEdge(r), [s, d] = nearestOn(e.pts, x, z);
			if (d < (inside ? 90 : 40) && (!best || d < best.d)) best = { e, s, d };
		}
		if (!best && !inside) {
			const U = W.bayArea?.urbanAt(x, z);
			if (U && U.u > 0.2) {
				const G = { a: Math.round(U.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2, style: U.s }, [BX, BZ, ST] = BLOCKS[U.s];
				const [gx, gz] = toGrid(x, z, G.a, G.style);
				const i = Math.round((gx - ST / 2) / BX), j = Math.round((gz - ST / 2) / BZ);
				const dxl = Math.abs(gx - (i * BX + ST / 2)), dzl = Math.abs(gz - (j * BZ + ST / 2));
				const e = dxl < dzl ? gridEdge(G, i, Math.floor((gz - ST / 2) / BZ), 'z', 1) : gridEdge(G, Math.floor((gx - ST / 2) / BX), j, 'x', 1);
				const [s, d] = nearestOn(e.pts, x, z);
				best = { e, s, d };
			}
		}
		if (!best) return false;
		D.edge = best.e; D.s = best.s;
		const [, , dx, dz] = at(best.e.pts, best.s);
		D.dir = best.e.oneway || dx * fx + dz * fz >= 0 ? 1 : -1;
		D.yaw = Math.atan2(-dx * D.dir, -dz * D.dir);
		D.v = 0; D.queue = 'straight'; D.y = null;
		return true;
	}

	// ---------- the controls ----------
	const btn = (label, title, style) => {
		const b = document.createElement('button');
		b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
		b.style.cssText = 'position:absolute;min-width:44px;min-height:44px;padding:6px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(8,20,26,.55);color:#eafaf6;font:600 16px system-ui;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;cursor:pointer;' + style;
		for (const ev of ['pointerdown', 'touchstart', 'keydown']) b.addEventListener(ev, (e) => e.stopPropagation());
		b.addEventListener('click', () => b.blur());
		mount.appendChild(b);
		return b;
	};
	const toggleBtn = btn('', 'Drive the road (V)', 'right:calc(12px + env(safe-area-inset-right));top:calc(168px + env(safe-area-inset-top));width:44px;display:flex;align-items:center;justify-content:center;');
	// a line icon: a road running away to the horizon
	toggleBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 3 5 21M15 3l4 18"/><path d="M12 4v2.5M12 10v3M12 17v3.5"/></svg>';
	// the car's own controls: which car, drive it yourself or let the road take you, credits
	const kindBtn = btn('Sedan', 'Which car (N)', 'right:calc(12px + env(safe-area-inset-right));top:calc(220px + env(safe-area-inset-top));display:none;font-size:13px;');
	const modeBtn = btn('Assist', 'Let the road steer (M)', 'right:calc(12px + env(safe-area-inset-right));top:calc(272px + env(safe-area-inset-top));display:none;font-size:13px;');
	const credBtn = btn('ⓘ', 'Vehicle credits', 'right:calc(12px + env(safe-area-inset-right));top:calc(324px + env(safe-area-inset-top));display:none;width:44px;font-size:14px;');
	kindBtn.addEventListener('click', (e) => { e.stopPropagation(); nextKind(); });
	modeBtn.addEventListener('click', (e) => { e.stopPropagation(); setMode(D.mode === 'free' ? 'assist' : 'free'); });
	credBtn.addEventListener('click', (e) => { e.stopPropagation(); hint(CREDITS, 9000); });
	const pad = document.createElement('div');
	pad.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom));width:170px;height:120px;display:none;';
	mount.appendChild(pad);
	const arrows = {};
	for (const [k, label, css] of [['left', '◀', 'left:0;top:38px;'], ['straight', '▲', 'left:63px;top:0;'], ['right', '▶', 'right:0;top:38px;'], ['back', '▼', 'left:63px;top:76px;']]) {
		const b = btn(label, { left: 'Turn left next', right: 'Turn right next', straight: 'Straight on', back: 'Turn round' }[k], css + 'width:44px;');
		pad.appendChild(b);
		b.addEventListener('click', (e) => { e.stopPropagation(); input(k); });
		// (held down, for driving yourself)
		b.addEventListener('pointerdown', () => { D.pedals[k] = true; });
		for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { D.pedals[k] = false; });
		arrows[k] = b;
	}
	const hud = document.createElement('div');
	hud.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));padding:6px 12px;border-radius:10px;background:rgba(8,20,26,.55);color:#eafaf6;font:13px system-ui;pointer-events:none;display:none;white-space:nowrap;';
	mount.appendChild(hud);

	function input(k) {
		if (!D.active || D.mode === 'free') return;
		if (k === 'back') {
			if (D.edge.oneway) { hint('One way: no turning round here.', 1800); return; }
			D.dir = -D.dir; D.v *= 0.3; return;
		}
		D.queue = k;
	}
	// ---------- getting in and out ----------
	const PAINTS = [[0.92, 0.92, 0.91], [0.05, 0.05, 0.06], [0.35, 0.36, 0.38], [0.66, 0.67, 0.69], [0.1, 0.2, 0.45], [0.55, 0.06, 0.06], [0.2, 0.3, 0.26]];
	const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), E = new THREE.Euler();
	function start() {
		const W = world();
		if (!W || D.active) return;
		const P = W.player.state, Vh = W.vehicles;
		if (W.boat?.boarded?.()) return;
		// which car: the parked one beside you, yours where you left it, or a new one
		const near = Vh?.carToEnter(P.pos.x, P.pos.z), mine = Vh?.mine.car;
		D.from = null;
		if (near) { D.kind = near.kind; D.color.setRGB(...(near.col || [0.5, 0.5, 0.5])); D.from = { x: near.x, z: near.z, yaw: near.yaw }; if (near.id !== 'mine') W.street?.take(near.x, near.z); }
		else if (mine && Math.hypot(mine.x - P.pos.x, mine.z - P.pos.z) < 40) { D.kind = mine.kind; D.color.copy(mine.color); D.from = { x: mine.x, z: mine.z, yaw: mine.yaw }; }
		else { D.color.setRGB(...PAINTS[Math.floor(Math.random() * PAINTS.length)]); D.from = { x: P.pos.x - Math.cos(P.yaw) * 2.2, z: P.pos.z + Math.sin(P.yaw) * 2.2, yaw: P.yaw + Math.PI }; }
		if (D.mode === 'assist' && !snap()) { hint('No road or trail here to follow: driving it yourself.', 2600); D.mode = 'free'; }
		D.active = true; P.locked = true; P.flying = false; P.vel.set(0, 0, 0); D.look = 0; D.lastYaw = undefined; D.y = null;
		pad.style.display = isPhone ? 'block' : 'none'; hud.style.display = 'block';
		for (const b of [kindBtn, modeBtn, credBtn]) b.style.display = 'flex';
		toggleBtn.style.background = '#01a982';
		labels();
		if (D.mode === 'free') startPhysics();
		hint(D.mode === 'free' ? (isPhone ? 'Driving: ▲ go, ▼ brake and reverse, ◀ ▶ steer. Assist lets the road steer. The road button stops.' : 'Driving: W/↑ go, S/↓ brake and reverse, A/D steer, Space handbrake, C view from behind, M road assist. V to stop.') : (isPhone ? 'Driving: ◀ ▶ pick the next turn, ▲ straight on, ▼ turn round. The road button stops.' : 'Driving: ← → pick the next turn, ↑ straight on, ↓ turn round, Shift to hurry. V to stop.'), 4500);
	}
	function startPhysics() {
		const W = world(), f = D.from;
		D.loading = true;
		loadRapier().then((R) => {
			D.loading = false;
			if (!D.active || D.mode !== 'free' || world() !== W) return;
			D.car?.dispose();
			D.car = createCarPhysics(R, D.kind, f, physicsEnv(W));
		}).catch((e) => { D.loading = false; console.warn('[drive] physics', e); hint('The driving engine did not load: the road will steer.', 3000); setMode('assist'); });
	}
	// the world as the physics sees it
	function physicsEnv(W) {
		const I = W.island;
		return {
			floorAt: (x, z, y) => Math.max(I.heightAt(x, z), I.extraFloor ? I.extraFloor(x, z, y) : -1e9),
			boxes: (x, z, r) => (W.real?.loaded?.() ? W.real.near('boxes', x, z, r) : []).filter((b) => b.w > 1 && b.d > 1).map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, a: b.a, h: b.wallH + 2, y: I.heightAt(b.x, b.z) - 1 })),
			cars: (x, z, r) => (W.vehicles ? W.vehicles.carsNear(x, z, r).filter((c) => c.id !== 'mine') : []).map((c) => ({ id: c.id || c.kind + c.x.toFixed(1) + c.z.toFixed(1), kind: c.kind, x: c.x, y: c.y, z: c.z, yaw: c.yaw })),
			push: I.extraPush ? (p, footY) => I.extraPush(p, footY) : null,
		};
	}
	function setMode(m) {
		if (!D.active) { D.mode = m; return; }
		const W = world(), mine = W?.vehicles?.mine.car;
		if (m === 'assist') {
			if (mine) { W.player.state.pos.set(mine.x, W.player.state.pos.y, mine.z); }
			if (!snap()) { hint('No road here for the assist to follow.', 2200); return; }
			D.car?.dispose(); D.car = null; D.mode = 'assist'; D.y = null;
		} else {
			D.mode = 'free';
			D.from = mine ? { x: mine.x, z: mine.z, yaw: mine.yaw } : { x: W.player.state.pos.x, z: W.player.state.pos.z, yaw: D.yaw + Math.PI };
			startPhysics();
		}
		labels();
	}
	function nextKind() {
		const W = world(), mine = W?.vehicles?.mine.car;
		if (D.car && Math.abs(D.car.pose().speed) > 1.5) { hint('Stop first to change cars.', 1500); return; }
		D.kind = KINDS[(KINDS.indexOf(D.kind) + 1) % KINDS.length];
		if (mine) { D.from = { x: mine.x, z: mine.z, yaw: mine.yaw }; W.vehicles.setMine(D.kind, D.color, mine.matrix, { driving: D.active }); }
		if (D.active && D.mode === 'free') startPhysics();
		labels();
	}
	function labels() {
		kindBtn.textContent = D.kind[0].toUpperCase() + D.kind.slice(1) + ' ▸';
		modeBtn.textContent = D.mode === 'free' ? 'Assist' : 'Drive';
		modeBtn.title = D.mode === 'free' ? 'Let the road steer (M)' : 'Drive it yourself (M)';
	}
	function stop() {
		if (!D.active) return;
		const W = world(), P = W?.player.state, Vh = W?.vehicles, mine = Vh?.mine.car;
		D.active = false;
		D.car?.dispose(); D.car = null;
		// out of the driver's door; the car stays where it is
		if (P && mine) {
			Vh.setMine(mine.kind, mine.color, mine.matrix, { driving: false });
			const S = specOf(mine.kind), s = seatsOf(mine.kind).seats[0];
			V3.set(S.W / 2 + 0.7, 0, s[2] - 0.2).applyMatrix4(mine.matrix);
			const g = W.island.heightAt(V3.x, V3.z);
			P.pos.set(V3.x, Math.max(g, W.island.extraFloor ? W.island.extraFloor(V3.x, V3.z, mine.y + 0.5) : -1e9) + 1.68, V3.z);
			camera.position.copy(P.pos);
		}
		if (P) { P.locked = false; P.vel.set(0, 0, 0); }
		pad.style.display = 'none'; hud.style.display = 'none';
		for (const b of [kindBtn, modeBtn, credBtn]) b.style.display = 'none';
		toggleBtn.style.background = 'rgba(8,20,26,.55)';
	}
	toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); D.active ? stop() : start(); });
	const held = new Set();
	window.addEventListener('keydown', (e) => {
		if (!mount.isConnected || mount.style.display === 'none' || e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
		const k = e.key.toLowerCase();
		if (k === 'v' && !e.repeat) { D.active ? stop() : start(); e.preventDefault(); return; }
		if (!D.active) return;
		held.add(k);
		if (!e.repeat && k === 'm') { setMode(D.mode === 'free' ? 'assist' : 'free'); e.preventDefault(); return; }
		if (!e.repeat && k === 'n') { nextKind(); e.preventDefault(); return; }
		if (!e.repeat && k === 'c') { D.chase = !D.chase; e.preventDefault(); return; }
		if (D.mode === 'free') { if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); return; }
		const m = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'straight', w: 'straight', arrowdown: 'back', s: 'back' }[k];
		if (m && !e.repeat) { input(m); e.preventDefault(); }
	});
	window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

	// ---------- moving ----------
	const fmtSpeed = (v) => Math.round(v * 2.237) + ' mph';
	function update(dt) {
		if (!D.active) return false;
		const W = world();
		if (!W) { stop(); return false; }
		if (D.mode === 'free') return drive(dt, W);
		const P = W.player.state, e = D.edge;
		const boost = held.has('shift') ? 2 : 1;
		const toEnd = D.dir > 0 ? e.L - D.s : D.s;
		// slow for a turn you have asked for, and for the end of the road
		let target = (SPEED[e.cls] || 10) * boost;
		if (D.queue !== 'straight' && toEnd < 30) target = Math.min(target, 4 + toEnd * 0.3);
		D.v += (target - D.v) * Math.min(1, dt * (target > D.v ? 0.8 : 2.5));
		D.s += D.dir * D.v * dt;
		// off the end: on into the chosen road
		let guard = 0;
		while ((D.s > D.edge.L || D.s < 0) && guard++ < 4) {
			const E = D.edge, over = D.s > E.L ? D.s - E.L : -D.s;
			const [, , hx0, hz0] = at(E.pts, D.dir > 0 ? E.L : 0), hx = hx0 * D.dir, hz = hz0 * D.dir;
			// through a short link, straight on to the road chosen beyond it
			const pick = D.plan && D.plan.e ? D.plan : choose(options(E, D.dir), hx, hz, D.queue, E.cls, E.name);
			D.plan = null;
			if (!pick) {
				// a dead end: turn round (a one-way that just ends lets you off)
				if (E.oneway) { stop(); hint('The road ends here.', 2000); return false; }
				D.dir = -D.dir; D.s = D.dir > 0 ? over : E.L - over; D.v *= 0.3;
				hint('Dead end: turning round.', 1500);
				break;
			}
			D.edge = pick.e; D.dir = pick.dir; D.s = pick.dir > 0 ? over : pick.e.L - over;
			D.plan = pick.then || null;
			D.queue = 'straight';
		}
		const E = D.edge;
		const [x0, z0, dx, dz] = at(E.pts, Math.min(E.L, Math.max(0, D.s)));
		// keep right on a two-way road; ride the middle of a trail or a one-way
		const trail = TRAIL.has(E.cls);
		const off = trail || E.oneway || E.w < 7 ? 0 : E.w * 0.22;
		const hx = dx * D.dir, hz = dz * D.dir;
		const [x, z] = onBridge(x0 - hz * off, z0 + hx * off);
		// the road under you: its own smoothed profile (graded like a real road, never steeper
		// than 25%, level across), bridges included
		const road = profileAt(E, D.s);
		// (never under the ground where the profile cuts through a hump more than a metre)
		const floorY = Math.max(road, W.island.heightAt(x, z) - 1.0, W.island.extraFloor ? W.island.extraFloor(x, z, Math.max(D.y ?? road, road + 1.5) - 1) : -1e9);
		const eye = trail ? 1.65 : 1.45;                                      // a driver's eye, a walker's on a trail
		D.y = D.y === null ? floorY + eye : D.y + (floorY + eye - D.y) * Math.min(1, dt * 8);
		// face along the road, turning smoothly, and tilt with its grade
		const want = Math.atan2(-hx, -hz);
		let dyaw = want - D.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
		D.yaw += dyaw * Math.min(1, dt * 4);
		const grade = Math.max(-0.25, Math.min(0.25, (profileAt(E, D.s + D.dir * 8) - road) / 8));
		// free look: turn your head while the road carries you on (drag or mouse as ever);
		// after a few seconds without looking about, your gaze drifts back to the road
		if (D.lastYaw !== undefined) { const dl = Math.atan2(Math.sin(P.yaw - D.lastYaw), Math.cos(P.yaw - D.lastYaw)); if (Math.abs(dl) > 1e-4) { D.look += dl; D.lookT = performance.now(); } }
		if (performance.now() - (D.lookT || 0) > 5000) D.look *= 1 - Math.min(1, dt * 1.2);
		D.look = Math.atan2(Math.sin(D.look), Math.cos(D.look));
		P.pos.set(x, D.y, z); P.yaw = D.yaw + D.look; D.lastYaw = P.yaw;
		camera.position.copy(P.pos);
		camera.rotation.set(P.pitch + Math.atan(grade) * 0.5, P.yaw, 0, 'YXZ');
		// the car round you: its driver's eye where yours is, on the road's own grade
		if (!trail && W.vehicles) {
			const S = specOf(D.kind), eye = seatsOf(D.kind).eye, cy = D.yaw + Math.PI, fx = Math.sin(cy), fz = Math.cos(cy);
			const ox = x - fx * eye[2] - Math.cos(cy) * eye[0], oz = z - fz * eye[2] + Math.sin(cy) * eye[0];
			D.spin = ((D.spin || 0) + D.v * dt / S.wr) % (Math.PI * 2);
			M4.compose(V3.set(ox, floorY, oz), Q.setFromEuler(E.set(-Math.atan(grade), cy, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
			W.vehicles.setMine(D.kind, D.color, M4, { driving: true, spin: D.spin, steer: 0 });
			// (the eye sits at the driver's seat)
			D.y += (floorY + eye[1] - D.y) * Math.min(1, dt * 4);
		}
		const arrow = { straight: '↑ straight on', left: '← left next', right: '→ right next' }[D.queue];
		hud.textContent = `${trail ? '🥾' : '🚗'} ${E.name || (E.cls === 'grid' ? 'Street' : E.cls.replace('_', ' '))} · ${arrow} · ${fmtSpeed(D.v)}`;
		for (const [k, b] of Object.entries(arrows)) b.style.background = k === D.queue ? '#01a982' : 'rgba(8,20,26,.55)';
		return true;
	}
	// ---------- driving it yourself ----------
	const CAMQ = new THREE.Quaternion(), LOOKQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
	function drive(dt, W) {
		const P = W.player.state, C = D.car;
		const k = (a, b) => held.has(a) || held.has(b);
		if (!C) {
			hud.textContent = D.loading ? 'Starting the engine…' : '';
			camera.position.copy(P.pos); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
			return true;
		}
		const T = D.pedals;
		C.ctl.throttle = k('arrowup', 'w') || T.straight ? (held.has('shift') ? 1 : 0.85) : 0;
		C.ctl.brake = k('arrowdown', 's') || T.back ? 1 : 0;
		C.ctl.steer = (k('arrowleft', 'a') || T.left ? 1 : 0) - (k('arrowright', 'd') || T.right ? 1 : 0);
		C.ctl.hand = held.has(' ') ? 1 : 0;
		C.step(dt);
		const o = C.pose();
		Q.set(o.q[0], o.q[1], o.q[2], o.q[3]);
		M4.compose(V3.set(o.p[0], o.p[1], o.p[2]), Q, new THREE.Vector3(1, 1, 1));
		M4.multiply(new THREE.Matrix4().makeTranslation(0, o.down, 0));
		const w = o.wheels;
		W.vehicles.setMine(D.kind, D.color, M4, { driving: true, spin: w[0].spin, steer: w[0].steer });
		// anyone in the way is struck (vehicles/impact.js); the car gives up what it hands them
		if (strike) {
			const lv = C.body.linvel(), el = M4.elements;
			const n = strike({ kind: D.kind, x: el[12], y: el[13], z: el[14], yaw: Math.atan2(el[8], el[10]), vx: lv.x, vz: lv.z, mass: C.feel.mass });
			if (n) { const k = C.feel.mass / (C.feel.mass + 75 * n); C.body.setLinvel({ x: lv.x * k, y: lv.y, z: lv.z * k }, true); }
		}
		// upside down, or fallen through: back on its wheels
		const up = V3.set(0, 1, 0).applyQuaternion(Q).y;
		if (up < 0.2 && Math.abs(o.speed) < 1) { D.flipT = (D.flipT || 0) + dt; if (D.flipT > 2) { const e = M4.elements; C.reset(e[12], e[14], Math.atan2(e[8], e[10])); D.flipT = 0; } } else D.flipT = 0;
		// free look, drifting back to the road ahead
		if (D.lastYaw !== undefined) { const dl = Math.atan2(Math.sin(P.yaw - D.lastYaw), Math.cos(P.yaw - D.lastYaw)); if (Math.abs(dl) > 1e-4) { D.look += dl; D.lookT = performance.now(); } }
		if (performance.now() - (D.lookT || 0) > 5000) D.look *= 1 - Math.min(1, dt * 1.2);
		D.look = Math.atan2(Math.sin(D.look), Math.cos(D.look));
		const e = M4.elements, carYaw = Math.atan2(e[8], e[10]);
		if (D.chase) {
			// from behind and above, looking over the car
			const S = specOf(D.kind), back = S.L / 2 + 4 + S.H, fx = Math.sin(carYaw + D.look), fz = Math.cos(carYaw + D.look);
			const want = new THREE.Vector3(e[12] - fx * back, e[13] + S.H + 1.6, e[14] - fz * back);
			const g = W.island.heightAt(want.x, want.z) + 1;
			if (want.y < g) want.y = g;
			camera.position.lerp(want, D.chaseOn ? Math.min(1, dt * 5) : 1); D.chaseOn = true;
			camera.lookAt(e[12], e[13] + S.H * 0.7, e[14]);
			P.pos.copy(camera.position);
		} else {
			D.chaseOn = false;
			// at the wheel: the driver's eye, turning with the car (and your head on top)
			const eye = seatsOf(D.kind).eye;
			camera.position.set(eye[0], eye[1], eye[2]).applyMatrix4(M4);
			CAMQ.copy(Q).multiply(LOOKQ.setFromAxisAngle(UP, Math.PI + D.look));
			E.set(P.pitch, 0, 0, 'YXZ');
			camera.quaternion.copy(CAMQ).multiply(new THREE.Quaternion().setFromEuler(E));
			P.pos.copy(camera.position);
		}
		P.yaw = carYaw + Math.PI + D.look; D.lastYaw = P.yaw;
		hud.textContent = `${D.kind[0].toUpperCase() + D.kind.slice(1)} · ${fmtSpeed(Math.abs(o.speed))}${o.speed < -0.3 ? ' R' : ''}${D.chase ? ' · behind' : ''}`;
		for (const [kk, b] of Object.entries(arrows)) b.style.background = T[kk] ? '#01a982' : 'rgba(8,20,26,.55)';
		return true;
	}
	// a road's height along it: the ground on its centre line every 5 m, smoothed over about
	// 40 m (cut through the bumps, filled over the dips), then limited to a 25% grade both
	// ways; kept on the road once worked out
	const STEP = 5, MAXG = 0.25;
	// the mapped line of the Golden Gate runs a little off the modelled deck: on the bridge,
	// ride the deck (in its lanes, keeping right of the median)
	function onBridge(x, z) {
		const B = world()?.bridge;
		if (!B) return [x, z];
		const dx = x - B.centre.x, dz = z - B.centre.z, s = dx * B.axis.x + dz * B.axis.y, t = dx * -B.axis.y + dz * B.axis.x;
		if (Math.abs(s) > B.length / 2 + 40 || Math.abs(t) > 45) return [x, z];
		const t2 = Math.sign(t || 1) * Math.min(Math.max(Math.abs(t), 2.5), 9);
		return [B.centre.x + B.axis.x * s - B.axis.y * t2, B.centre.z + B.axis.y * s + B.axis.x * t2];
	}
	function profileAt(E, s) {
		if (!E.prof) {
			const n = Math.max(2, Math.ceil(E.L / STEP) + 1), h = new Float32Array(n);
			// (on a bridge or an overpass the road is its deck: the Golden Gate's, a freeway's)
			const W = world(), deck = new Float32Array(n).fill(-1e9);
			for (let i = 0; i < n; i++) {
				const [px, pz] = at(E.pts, Math.min(E.L, i * STEP)), [qx, qz] = onBridge(px, pz);
				h[i] = W.island.heightAt(qx, qz);
				deck[i] = Math.max(W.bridge ? W.bridge.deckFloor(qx, qz, 1e4) : -1e9, W.freeways ? W.freeways.floor(qx, qz, 1e4) : -1e9);
			}
			for (let pass = 0; pass < 3; pass++) {
				const c = h.slice();
				for (let i = 0; i < n; i++) { let a = 0, k = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { a += c[j]; k++; } h[i] = a / k; }
			}
			for (let i = 0; i < n; i++) if (deck[i] > -1e8) h[i] = deck[i] - 0.6 + 0.6;
			for (let i = 1; i < n; i++) h[i] = Math.max(h[i - 1] - MAXG * STEP, Math.min(h[i - 1] + MAXG * STEP, h[i]));
			for (let i = n - 2; i >= 0; i--) h[i] = Math.max(h[i + 1] - MAXG * STEP, Math.min(h[i + 1] + MAXG * STEP, h[i]));
			E.prof = h;
		}
		const h = E.prof, f = Math.max(0, Math.min(h.length - 1, s / STEP)), i = Math.min(h.length - 2, Math.floor(f)), t = f - i;
		return h[i] * (1 - t) + h[i + 1] * t;
	}
	// for tests: the choices at the end of the road you are on
	const debugOptions = () => { const E = D.edge, [, , hx, hz] = at(E.pts, D.dir > 0 ? E.L : 0); return options(E, D.dir).map((o) => ({ name: o.e.name || o.e.cls, then: o.then ? (o.then.e.name || o.then.e.cls) : '', L: Math.round(o.e.L), turn: +(Math.atan2(hx * D.dir * o.dz - hz * D.dir * o.dx, hx * D.dir * o.dx + hz * D.dir * o.dz) * 57.3).toFixed(0) })); };
	return { update, start, stop, debugOptions, active: () => D.active, state: D, setMode, nextKind, setKind: (k) => { D.kind = k; labels(); }, physics: () => D.car };
}
