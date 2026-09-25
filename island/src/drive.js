// Drive: snap onto the road you are on and let it carry you. The pace is automatic (a
// residential street at about 25 mph, a collector faster, a freeway at 65, a trail or
// fire road at a hiking or biking pace); you only choose where to go at the next
// junction: ← left, → right, ↑ straight on, ↓ turn round now. Works on the real streets,
// country roads and trails (San Ramon, Mt Diablo, Mt Tam, Mission Peak) and on the town
// street grids everywhere else. V or the 🚗 button to start and stop.

import { BLOCKS, toGrid, fromGrid } from './bay/styles.js';

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

export function createDrive({ world, camera, mount, isPhone, hint }) {
	const D = { active: false, edge: null, s: 0, dir: 1, v: 0, queue: 'straight', yaw: 0, y: null, plan: null };

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
		if (W.real?.loaded() && W.real.inside(x, z)) {
			for (const r of W.real.near('roads', x, z, 90)) {
				if (r.pts.length < 4) continue;
				const e = realEdge(r), [s, d] = nearestOn(e.pts, x, z);
				if (d < 90 && (!best || d < best.d)) best = { e, s, d };
			}
		} else {
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
	const toggleBtn = btn('🚗', 'Drive the road (V)', 'right:calc(12px + env(safe-area-inset-right));top:calc(168px + env(safe-area-inset-top));width:44px;');
	const pad = document.createElement('div');
	pad.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom));width:170px;height:120px;display:none;';
	mount.appendChild(pad);
	const arrows = {};
	for (const [k, label, css] of [['left', '◀', 'left:0;top:38px;'], ['straight', '▲', 'left:63px;top:0;'], ['right', '▶', 'right:0;top:38px;'], ['back', '▼', 'left:63px;top:76px;']]) {
		const b = btn(label, { left: 'Turn left next', right: 'Turn right next', straight: 'Straight on', back: 'Turn round' }[k], css + 'width:44px;');
		pad.appendChild(b);
		b.addEventListener('click', (e) => { e.stopPropagation(); input(k); });
		arrows[k] = b;
	}
	const hud = document.createElement('div');
	hud.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));padding:6px 12px;border-radius:10px;background:rgba(8,20,26,.55);color:#eafaf6;font:13px system-ui;pointer-events:none;display:none;white-space:nowrap;';
	mount.appendChild(hud);

	function input(k) {
		if (!D.active) return;
		if (k === 'back') {
			if (D.edge.oneway) { hint('One way: no turning round here.', 1800); return; }
			D.dir = -D.dir; D.v *= 0.3; return;
		}
		D.queue = k;
	}
	function start() {
		const W = world();
		if (!W || D.active) return;
		const P = W.player.state;
		if (W.boat?.boarded?.()) return;
		if (!snap()) { hint('No road or trail here to follow. Walk or fly to one, then press 🚗.', 3000); return; }
		D.active = true; P.locked = true; P.flying = false; P.vel.set(0, 0, 0);
		pad.style.display = isPhone ? 'block' : 'none'; hud.style.display = 'block';
		toggleBtn.style.background = '#01a982';
		hint(isPhone ? 'Driving: ◀ ▶ pick the next turn, ▲ straight on, ▼ turn round. 🚗 to stop.' : 'Driving: ← → pick the next turn, ↑ straight on, ↓ turn round, Shift to hurry. V to stop.', 4500);
	}
	function stop() {
		if (!D.active) return;
		const P = world()?.player.state;
		D.active = false;
		if (P) { P.locked = false; P.vel.set(0, 0, 0); }
		pad.style.display = 'none'; hud.style.display = 'none';
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
		const x = x0 - hz * off, z = z0 + hx * off;
		// the ground under you, bridges included
		const floorY = Math.max(W.island.heightAt(x, z), W.island.extraFloor ? W.island.extraFloor(x, z, (D.y ?? W.island.heightAt(x, z)) - 1) : -1e9);
		const eye = trail ? 1.65 : 1.45;                                      // a driver's eye, a walker's on a trail
		D.y = D.y === null ? floorY + eye : D.y + (floorY + eye - D.y) * Math.min(1, dt * 8);
		// face along the road, turning smoothly, and tilt with its grade
		const want = Math.atan2(-hx, -hz);
		let dyaw = want - D.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
		D.yaw += dyaw * Math.min(1, dt * 4);
		const ahead = at(E.pts, Math.min(E.L, Math.max(0, D.s + D.dir * 8)));
		const grade = (W.island.heightAt(ahead[0], ahead[1]) - W.island.heightAt(x0, z0)) / 8;
		P.pos.set(x, D.y, z); P.yaw = D.yaw;
		camera.position.copy(P.pos);
		camera.rotation.set(P.pitch + Math.atan(grade) * 0.5, D.yaw, 0, 'YXZ');
		const arrow = { straight: '↑ straight on', left: '← left next', right: '→ right next' }[D.queue];
		hud.textContent = `${trail ? '🥾' : '🚗'} ${E.name || (E.cls === 'grid' ? 'Street' : E.cls.replace('_', ' '))} · ${arrow} · ${fmtSpeed(D.v)}`;
		for (const [k, b] of Object.entries(arrows)) b.style.background = k === D.queue ? '#01a982' : 'rgba(8,20,26,.55)';
		return true;
	}
	// for tests: the choices at the end of the road you are on
	const debugOptions = () => { const E = D.edge, [, , hx, hz] = at(E.pts, D.dir > 0 ? E.L : 0); return options(E, D.dir).map((o) => ({ name: o.e.name || o.e.cls, then: o.then ? (o.then.e.name || o.then.e.cls) : '', L: Math.round(o.e.L), turn: +(Math.atan2(hx * D.dir * o.dz - hz * D.dir * o.dx, hx * D.dir * o.dx + hz * D.dir * o.dz) * 57.3).toFixed(0) })); };
	return { update, start, stop, debugOptions, active: () => D.active, state: D };
}
