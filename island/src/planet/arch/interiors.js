// The grand interiors walked: each building's floors (rooms.js) are walls and floors from the
// start (cheap: boxes and rectangles in each volume's frame), but built (furnish.js) only as
// you come to them, a floor or two either side of you, and let go as you leave. Floors are
// walked as the decks are (extraFloor / extraPush), lifts carry you between them, and each
// room tells its name as you come into it.

import * as THREE from 'three';
import { buildVolume } from './furnish.js';
import { interiorMaterial, paneGlass } from './mats.js';

const TAU = Math.PI * 2;
const inRect = (f, x, z) => {
	let dx = x - f.x, dz = z - f.z;
	if (f.yaw) { const c = Math.cos(f.yaw), s = Math.sin(f.yaw); [dx, dz] = [dx * c - dz * s, dx * s + dz * c]; }
	return Math.abs(dx) <= f.hw && Math.abs(dz) <= f.hd;
};
const inPiece = (f, x, z) => {
	if (f.ring) {
		const r = Math.hypot(x, z);
		if (r < f.r0 || r > f.r1) return false;
		return ((Math.atan2(x, z) - f.a0) % TAU + TAU) % TAU <= f.span;
	}
	if (f.r != null) return Math.hypot(x - f.x, z - f.z) <= f.r;
	return inRect(f, x, z);
};

// the walls a volume pushes you off: its wall pieces and rails as boxes in its frame
function prep(V) {
	const box = [];
	for (const W of V.L.walls) box.push({ x: W.x, z: W.z, hw: W.len / 2, hd: W.t / 2 + 0.02, c: Math.cos(W.yaw), s: Math.sin(W.yaw), y0: W.y0, y1: W.y1 });
	for (const R of V.L.rails) {
		const dx = R.bx - R.ax, dz = R.bz - R.az, len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx), y2 = R.y2 ?? R.y;
		if (len < 0.05) continue;
		box.push({ x: (R.ax + R.bx) / 2, z: (R.az + R.bz) / 2, hw: len / 2, hd: 0.08, c: Math.cos(yaw), s: Math.sin(yaw), y0: Math.min(R.y, y2), y1: Math.max(R.y, y2) + 1.1 });
	}
	V.box = box;
	V.reach = V.round ? V.r + 1 : Math.hypot(V.w, V.d) / 2 + 1;
	for (const D of V.L.doors) V.reach = Math.max(V.reach, Math.hypot(D.x, D.z) + (D.porch || 0) + 1);
}
const inShape = (V, x, z) => (V.round ? x * x + z * z <= V.r * V.r : Math.abs(x) <= V.w / 2 && Math.abs(z) <= V.d / 2);

// push a point (in a frame) out of a box; true if it moved
function outOf(b, P) {
	const dx = P.x - b.x, dz = P.z - b.z, u = dx * b.c - dz * b.s, v = dx * b.s + dz * b.c, pad = 0.35;
	if (Math.abs(u) >= b.hw + pad || Math.abs(v) >= b.hd + pad) return false;
	const pen = [b.hw + pad - u, u + b.hw + pad, b.hd + pad - v, v + b.hd + pad], k = pen.indexOf(Math.min(...pen));
	let nu = u, nv = v;
	if (k === 0) nu = b.hw + pad; else if (k === 1) nu = -b.hw - pad; else if (k === 2) nv = b.hd + pad; else nv = -b.hd - pad;
	P.x = b.x + nu * b.c + nv * b.s; P.z = b.z - nu * b.s + nv * b.c;
	return true;
}

// buildings: from rooms.js (towerPlan / housePlan), each with .hull (meshes hidden while you are
// inside: a spire's floor plates would cut through its rooms)
export function createInteriors(scene, shared, buildings, opts = {}) {
	const isPhone = !!opts.isPhone;
	const group = new THREE.Group();
	group.name = 'arch:interiors';
	scene.add(group);
	const U = { uTime: shared.uTime, uBrass: { value: new THREE.Color(1.0, 0.74, 0.44) } };
	const mat = interiorMaterial(U, { env: opts.env }), glass = paneGlass({ env: opts.env });
	for (const B of buildings) {
		for (const V of B.vols) prep(V);
		if (B.lift) B.cab = { y: B.lift.stops[0], tgt: null, wait: 0, dir: 1, mesh: null };
	}
	const P = { x: 0, z: 0 };
	let here = null, lastRoom = null, hintT = 0, builds = 0;

	// ---------- walking ----------
	const near = (B, x, z, y) => Math.hypot(x - B.x, z - B.z) < B.reach + 3 && y > B.y0 - 3 && y < B.y1 + 3;
	function floor(x, z, y) {
		let best = -Infinity;
		for (const B of buildings) {
			if (!near(B, x, z, y)) continue;
			for (const V of B.vols) {
				const fy = V.F.y;
				if (y < fy - 1.4 || y > fy + V.h + 1.5) continue;
				const [lx, lz] = V.F.l(x, z);
				if (Math.hypot(lx, lz) > V.reach) continue;
				const ry = y - fy, D = V.dyn;
				if (inShape(V, lx, lz) && !V.L.holes.some((h) => inRect(h, lx, lz)) && !(D && D.cuts.some((c) => inPiece(c, lx, lz)))) best = Math.max(best, fy);
				for (const f of V.L.floors) if (ry > f.y - 1.4 && fy + f.y > best && inPiece(f, lx, lz)) best = fy + f.y;
				if (D) for (const f of D.lows) if (ry > f.y - 1.4 && fy + f.y > best && inPiece(f, lx, lz)) best = fy + f.y;
				for (const S of V.L.ramps) {
					const dx = S.bx - S.ax, dz = S.bz - S.az, l2 = dx * dx + dz * dz, t = ((lx - S.ax) * dx + (lz - S.az) * dz) / l2;
					if (t < -0.02 || t > 1.02) continue;
					const tt = Math.max(0, Math.min(1, t)), qx = S.ax + dx * tt, qz = S.az + dz * tt;
					if (Math.hypot(lx - qx, lz - qz) > S.hw) continue;
					const top = S.ya + (S.yb - S.ya) * tt;
					if (ry > top - 1.4 && fy + top > best) best = fy + top;
				}
				// the lift's cab
				if (V.lift && B.cab && Math.abs(lx - V.lift.x) < V.lift.s && Math.abs(lz - V.lift.z) < V.lift.s && y > B.cab.y - 1.4 && B.cab.y > best) best = B.cab.y;
			}
		}
		return best;
	}
	function push(p, footY) {
		for (const B of buildings) {
			if (!near(B, p.x, p.z, footY)) continue;
			for (const V of B.vols) {
				const fy = V.F.y, ry = footY - fy;
				if (ry < -1.2 || ry > V.h - 0.3) continue;
				const [lx, lz] = V.F.l(p.x, p.z);
				if (Math.hypot(lx, lz) > V.reach + 0.5) continue;
				P.x = lx; P.z = lz;
				let moved = false;
				for (const b of V.box) if (ry < b.y1 - 0.3 && ry > b.y0 - 1.6 && outOf(b, P)) moved = true;
				if (V.dyn) for (const b of V.dyn.box) if (ry < b.y1 - 0.3 && ry > b.y0 - 1.6 && outOf(b, P)) moved = true;
				// the lift's gate, shut while the cab is away from this floor
				if (V.lift && B.cab && Math.abs(B.cab.y - fy) > 0.25 && V.L.lift && ry < 2.6) {
					const { x, z, s } = V.lift, { ox, oz } = V.L.lift;
					if (outOf({ x: x + ox * (s + 0.1), z: z + oz * (s + 0.1), hw: ox ? 0.1 : s + 0.15, hd: oz ? 0.1 : s + 0.15, c: 1, s: 0 }, P)) moved = true;
				}
				if (moved) { const [wx, wz] = V.F.p(P.x, P.z); p.x = wx; p.z = wz; }
			}
		}
	}

	// ---------- building and letting go ----------
	function build(V) {
		const r = buildVolume(V, isPhone);
		const g = new THREE.Group();
		g.position.set(V.F.x, V.F.y, V.F.z);
		g.rotation.y = V.F.yaw;
		g.name = 'arch:in:' + V.B.name + ':' + V.i;
		const m = new THREE.Mesh(r.solid, mat);
		m.name = 'arch:in:solid';
		g.add(m);
		if (r.glass) { const gm = new THREE.Mesh(r.glass, glass); gm.renderOrder = 6; gm.name = 'arch:in:glass'; g.add(gm); }
		for (const I of r.inst) {
			I.geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(I.lit, 3));
			const im = new THREE.InstancedMesh(I.geo, mat, I.n);
			im.instanceMatrix.array.set(I.mats);
			im.instanceMatrix.needsUpdate = true;
			im.computeBoundingSphere();
			g.add(im);
		}
		group.add(g);
		V.dyn = { cuts: r.cuts, lows: r.lows, box: r.solids.map((b) => ({ x: b.x, z: b.z, hw: b.hw, hd: b.hd, c: Math.cos(b.yaw), s: Math.sin(b.yaw), y0: b.y0, y1: b.y1 })) };
		V.built = g;
		builds++;
	}
	function unbuild(V) {
		V.built.traverse((o) => o.geometry?.dispose());
		group.remove(V.built);
		V.built = null;
		V.dyn = null;
	}
	// the lift's cab: a glass drum in brass with a ring of light
	function cabMesh(B) {
		const V = B.vols[0], s = V.lift.s, parts = [];
		const ring = new THREE.TorusGeometry(s * 0.95, 0.05, 6, 28).rotateX(Math.PI / 2);
		parts.push(new THREE.CylinderGeometry(s * 0.98, s * 0.98, 0.18, 24).translate(0, -0.09, 0), ring.clone().translate(0, 2.9, 0), ring.translate(0, 0.05, 0), new THREE.CylinderGeometry(s * 0.98, s * 0.98, 0.1, 24).translate(0, 3.0, 0));
		const g = new THREE.Group();
		for (const [k, p] of parts.entries()) {
			const n = p.attributes.position.count;
			const c = k === 1 ? [1.0, 0.5, 0.75] : [1.0, 0.74, 0.44], col = new Float32Array(n * 3);
			for (let i = 0; i < n; i++) col.set(c, i * 3);
			p.setAttribute('color', new THREE.BufferAttribute(col, 3));
			p.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(k === 1 ? 6 : 3), 1));
			p.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.3), 3));
			g.add(new THREE.Mesh(p, mat));
		}
		const pane = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.97, s * 0.97, 2.8, 24, 1, true).translate(0, 1.45, 0), glass);
		pane.renderOrder = 6;
		g.add(pane);
		const [wx, wz] = V.F.p(V.lift.x, V.lift.z);
		g.position.set(wx, B.cab.y, wz);
		g.rotation.y = V.F.yaw;
		group.add(g);
		return g;
	}
	function lift(B, dt, foot, pin) {
		const C = B.cab, st = B.lift.stops, V0 = B.vols[0], { x, z, s } = V0.lift;
		const [lx, lz] = V0.F.l(pin.x, pin.z), inShaft = Math.abs(lx - x) < s && Math.abs(lz - z) < s, onCab = inShaft && Math.abs(foot - C.y) < 0.8;
		if (C.tgt == null) {
			C.wait += dt;
			let k = 0;
			for (let i = 1; i < st.length; i++) if (Math.abs(st[i] - C.y) < Math.abs(st[k] - C.y)) k = i;
			if (onCab && C.wait > 1.8 && st.length > 1) {
				if (k === st.length - 1) C.dir = -1; else if (k === 0) C.dir = 1;
				C.tgt = st[k + C.dir];
			} else if (!onCab && Math.hypot(lx - x, lz - z) < 7) {
				// called to the floor you wait on
				for (const y of st) if (foot > y - 0.5 && foot < y + 3 && Math.abs(C.y - y) > 0.2) { C.tgt = y; break; }
			}
		} else {
			// (easing off from one floor and into the next)
			const d = C.tgt - C.y, sp = Math.min(5, 1.2 + Math.abs(d) * 0.8, 1.7 + Math.abs(C.y - (C.from ?? C.y)) * 0.8), step = Math.min(Math.abs(d), sp * dt, 1.0);
			C.y += Math.sign(d) * step;
			if (Math.abs(C.tgt - C.y) < 0.01) { C.y = C.tgt; C.tgt = null; C.wait = 0; C.from = C.y; }
		}
		if (C.mesh) C.mesh.position.y = C.y;
	}

	function update(dt, camera) {
		const pl = opts.player?.(), pos = pl?.pos || camera.position, foot = pos.y - 1.68;
		here = null;
		let todo = null;
		for (const B of buildings) {
			const d = Math.hypot(pos.x - B.x, pos.z - B.z) - B.reach, close = d < 14 && foot > B.y0 - 8 && foot < B.y1 + 6;
			let any = false;
			for (const V of B.vols) {
				const up = V.F.y - foot, down = foot - (V.F.y + V.h);
				const want = close && up < (isPhone ? 7 : 13) && down < (isPhone ? 4 : 9);
				const keep = d < 24 && up < (isPhone ? 10 : 18) && down < (isPhone ? 7 : 14);
				if (want && !V.built && !todo) todo = V;
				else if (V.built && !keep) unbuild(V);
				if (V.built) any = true;
				if (!here && foot > V.F.y - 0.6 && foot < V.F.y + V.h) {
					const [lx, lz] = V.F.l(pos.x, pos.z);
					if (inShape(V, lx, lz)) here = { B, V, lx, lz };
				}
			}
			if (B.cab) {
				if (any && !B.cab.mesh) B.cab.mesh = cabMesh(B);
				else if (!any && B.cab.mesh) { B.cab.mesh.traverse((o) => o.geometry?.dispose()); group.remove(B.cab.mesh); B.cab.mesh = null; }
				if (close) lift(B, dt, foot, pos);
			}
			const inside = here?.B === B;
			if (B.hull) for (const m of B.hull) m.visible = !inside;
		}
		// (one floor built a frame: the hitch spread out)
		if (todo) build(todo);
		// the room you are in, named as you come into it
		hintT -= dt;
		const R = here && room(here);
		if (R && R !== lastRoom && opts.hint) {
			if (hintT < 0 || R.seen === undefined) opts.hint(`${opts.settlement} · ${R.name}\n${here.B.name}`, 4500);
			R.seen = true; hintT = 1.5;
		}
		lastRoom = R || (here ? lastRoom : null);
	}
	function room({ V, lx, lz }) {
		if (V.round) {
			const a = Math.atan2(lx, lz);
			return V.rooms.find((R) => ((a - R.a0) % TAU + TAU) % TAU < ((R.a1 - R.a0) % TAU + TAU) % TAU || R.a1 - R.a0 >= TAU - 1e-6) || V.rooms[0];
		}
		return V.rooms.find((R) => lx < R.x1 + 0.3) || V.rooms[V.rooms.length - 1];
	}

	// stand in building b, floor l, looking down the room (view: 'gallery' up on its gallery)
	function inside(b, l = 0, view = '') {
		const B = buildings[((b | 0) % buildings.length + buildings.length) % buildings.length];
		const V = B.vols[Math.max(0, Math.min(B.vols.length - 1, l | 0))], R = V.rooms[/^r\d/.test(view) ? Math.min(V.rooms.length - 1, +view[1]) : 0];
		let at, to, y = 0;
		if (view === 'gallery' && V.mezz?.floors?.length) {
			const f = V.mezz.floors[0];
			y = V.mezz.y;
			at = f.ring ? [Math.sin(f.a0 + 0.6) * (f.r1 - 1.2), Math.cos(f.a0 + 0.6) * (f.r1 - 1.2)] : [f.x - f.hw + 1.2, f.z];
			to = [0, 0];
		} else if (V.round) {
			const a = (R.a0 + R.a1) / 2 + (V.rooms.length > 1 ? 0 : 0.6);
			at = [Math.sin(a) * (V.r - 1.6), Math.cos(a) * (V.r - 1.6)];
			to = [Math.sin(a + Math.PI * 0.75) * V.r * 0.6, Math.cos(a + Math.PI * 0.75) * V.r * 0.6];
		} else {
			const zc = (R.z0 + R.z1) / 2;
			at = [R.x0 + 1.0, zc + (R.z1 - R.z0) * 0.22];
			to = [R.x1, zc - (R.z1 - R.z0) * 0.1];
			if (R.kind === 'living') { at = [0, R.z0 + 1.2]; to = [0, R.z1]; }
		}
		const [wx, wz] = V.F.p(at[0], at[1]), [tx, tz] = V.F.p(to[0], to[1]);
		if (!V.built) build(V);
		return { x: wx, y: V.F.y + y, z: wz, yaw: Math.atan2(-(tx - wx), -(tz - wz)), name: `${opts.settlement} · ${R.name}`, building: B.name, kind: R.kind, h: +V.h.toFixed(1), level: V.i, levels: B.vols.length };
	}
	const indoors = () => !!here;
	function dispose() {
		for (const B of buildings) {
			for (const V of B.vols) if (V.built) unbuild(V);
			if (B.cab?.mesh) { B.cab.mesh.traverse((o) => o.geometry?.dispose()); group.remove(B.cab.mesh); }
			if (B.hull) for (const m of B.hull) m.visible = true;
		}
		mat.dispose(); glass.dispose();
		scene.remove(group);
	}
	const info = () => {
		let tris = 0, built = 0;
		for (const B of buildings) for (const V of B.vols) if (V.built) { built++; V.built.traverse((o) => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3 * (o.isInstancedMesh ? o.count : 1); }); }
		return {
			buildings: buildings.map((B) => ({ name: B.name, kind: B.kind, floors: B.vols.length, rooms: B.vols.flatMap((V) => V.rooms.map((R) => `${R.kind}:${R.name}`)).length })),
			built, builds, tris: Math.round(tris), here: here ? { building: here.B.name, floor: here.V.i, room: room(here).name } : null,
		};
	};
	const plan = (b) => buildings[b] && buildings[b].vols.map((V) => ({ y: +V.F.y.toFixed(1), h: +V.h.toFixed(1), rooms: V.rooms.map((R) => `${R.kind}:${R.name}`), mezz: !!V.mezz, theme: V.theme.name }));
	return { floor, push, update, dispose, inside, indoors, info, plan, buildings };
}
