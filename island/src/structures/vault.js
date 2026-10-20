// Vaulting: through a window (open, broken, or crashed through as you go) and over a low wall,
// a garden wall, a rail, a planter. Jump facing one close by (or sprint into a low one) and you
// go over it the way a body does: a step in, both hands planted on the sill or the coping (you
// see them, set where they land while you pass over them), the hop across with the head down
// under a window's head, and the landing on the far side, a dip at the knees and up again,
// carrying on at the pace you came in. The camera rolls a touch into it and looks down at the
// hands at the plant.
//
// player.js asks: s.tryVault() when you jump (true if a vault began instead), s.move(dt) each
// frame (true while a vault carries you).

import * as THREE from 'three';
import { frameOf } from './ids.js';
import { lerp } from '../noise.js';

const EYE = 1.68;
const ease = (t) => t * t * (3 - 2 * t);

// a hand flat on a top, fingers over its edge (+z) and the forearm back toward you (-z); the
// climbs use the same (parkour.js)
export function handGeometry() {
	const parts = [new THREE.BoxGeometry(0.09, 0.03, 0.1).translate(0, 0.015, 0)];
	for (let i = 0; i < 4; i++) parts.push(new THREE.BoxGeometry(0.018, 0.022, 0.075).translate(-0.033 + i * 0.022, 0.012, 0.085));
	parts.push(new THREE.BoxGeometry(0.022, 0.024, 0.06).rotateY(0.6).translate(0.058, 0.012, 0.02));
	parts.push(new THREE.BoxGeometry(0.075, 0.07, 0.24).translate(0, 0.04, -0.15));
	let n = 0; for (const g of parts) n += g.toNonIndexed().attributes.position.count;
	const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
	let k = 0;
	for (const g0 of parts) { const g = g0.toNonIndexed(); pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); k += g.attributes.position.count; }
	const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
	return out;
}

export function createVault(ctx) {
	const { scene, camera, sounds } = ctx;
	// the hands at the plant: palms and fingers, set on the sill
	const handGeo = handGeometry();
	const handMat = new THREE.MeshStandardMaterial({ color: 0xb08068, roughness: 0.7 });
	const hands = [0, 1].map(() => { const m = new THREE.Mesh(handGeo, handMat); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
	let V = null, cool = 0;

	// what is in front of you to go over, within reach: { kind, ex, ez (the entry edge where
	// you meet it), nx, nz (back toward you), depth, sill (world y of its top), head (a
	// window's head, world y), pane, plan }
	function ahead(s, reachMax = 1.35) {
		const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), foot = s.pos.y - EYE;
		let best = null;
		const consider = (c) => { if (!best || c.d < best.d) best = c; };
		// windows: the buildings built inside (interiors/), their outside walls' openings
		const I = ctx.interiors();
		if (I?.live) for (const B of I.live.values()) {
			if (!B.ready || !B.P || B.site) continue;
			const o = B.o;
			if (Math.abs(o.x - s.pos.x) > o.w + 6 || Math.abs(o.z - s.pos.z) > o.d + 6) continue;
			const F = frameOf(o), [px, pz] = F.l(s.pos.x, s.pos.z), c = F.c, sn = F.s, lfx = c * fx + sn * fz, lfz = -sn * fx + c * fz;
			for (const w of B.P.walls) {
				if (w.kind !== 'ext' || !B.levels[w.k]) continue;
				for (const op of w.open) {
					if (op.type !== 'window' && op.type !== 'store') continue;
					const sill = B.P.f0 + op.y0, head = B.P.f0 + op.y1;
					if (sill - foot < 0.3 || sill - foot > 1.4 || head - foot < 1.15 || op.s1 - op.s0 < 0.55) continue;
					// (along the wall's axis: x for an 'x' wall, z for a 'z' wall; across it the other)
					const along = w.axis === 'x' ? px : pz, across = (w.axis === 'x' ? pz : px) - w.pos, dir = w.axis === 'x' ? lfz : lfx;
					if (along < op.s0 + 0.15 || along > op.s1 - 0.15) continue;
					const side = Math.sign(across) || 1, d = Math.abs(across) - w.t / 2;
					if (d < 0.05 || d > reachMax || -dir * side < 0.55) continue;
					const [ex, ez] = F.w(w.axis === 'x' ? along : w.pos + side * w.t / 2, w.axis === 'x' ? w.pos + side * w.t / 2 : along);
					const [nx, nz] = F.dir(w.axis === 'x' ? 0 : side, w.axis === 'x' ? side : 0);
					const pane = ctx.glass()?.panes().find((p) => p.plan?.op === op) || null;
					consider({ kind: 'window', d, ex, ez, nx, nz, depth: w.t, sill, head, pane, B });
				}
			}
		}
		// the houses built near you (bay/houses.js): their windows, the frame open once the glass is
		// out (or crashed through as you go)
		for (const [, h] of ctx.world?.()?.houses?.houses || []) {
			if (!h?.plan || Math.abs(h.cx - s.pos.x) > h.r + 6 || Math.abs(h.cz - s.pos.z) > h.r + 6) continue;
			const dx = s.pos.x - h.cx, dz = s.pos.z - h.cz, px = h.ca * dx + h.sa * dz, pz = -h.sa * dx + h.ca * dz, lfx = h.ca * fx + h.sa * fz, lfz = -h.sa * fx + h.ca * fz;
			for (const w of h.plan.walls) {
				if (w.kind !== 'ext') continue;
				const mid = w.pos + w.inSide * 0.08, t = 0.16;
				for (const op of w.open) {
					if (op.type !== 'window' && op.type !== 'slider') continue;
					const sill = h.floorY + op.y0, head = h.floorY + op.y1;
					if (sill - foot < 0.3 || sill - foot > 1.4 || head - foot < 1.15 || op.s1 - op.s0 < 0.55) continue;
					const along = w.axis === 'x' ? px : pz, across = (w.axis === 'x' ? pz : px) - mid, dir = w.axis === 'x' ? lfz : lfx;
					if (along < op.s0 + 0.15 || along > op.s1 - 0.15) continue;
					const side = Math.sign(across) || 1, d = Math.abs(across) - t / 2;
					if (d < 0.05 || d > reachMax || -dir * side < 0.55) continue;
					const ex0 = w.axis === 'x' ? along : mid + side * t / 2, ez0 = w.axis === 'x' ? mid + side * t / 2 : along;
					const nx0 = w.axis === 'x' ? 0 : side, nz0 = w.axis === 'x' ? side : 0;
					const pane = ctx.glass()?.panes().find((p) => p.plan?.op === op) || null;
					consider({ kind: 'window', d, ex: h.cx + h.ca * ex0 - h.sa * ez0, ez: h.cz + h.sa * ex0 + h.ca * ez0, nx: h.ca * nx0 - h.sa * nz0, nz: h.sa * nx0 + h.ca * nz0, depth: t, sill, head, pane, house: h });
				}
			}
		}
		// low walls, rails, planters: the city's thin low lots (city.js), and the walls left of a
		// wrecked building
		const city = ctx.city();
		for (const o of city?.lotsNear?.(s.pos.x, s.pos.z, 3) || []) {
			const top = o.y + o.h, rise = top - foot;
			if (rise < 0.45 || rise > 1.3 || Math.min(o.w, o.d) > 1.8 || o.wrecked) continue;
			const F = frameOf(o), [px, pz] = F.l(s.pos.x, s.pos.z), c = F.c, sn = F.s, lfx = c * fx + sn * fz, lfz = -sn * fx + c * fz;
			// (the face you are coming at: across the thin way)
			const thinX = o.w < o.d, across = thinX ? px : pz, along = thinX ? pz : px, half = (thinX ? o.w : o.d) / 2, len = (thinX ? o.d : o.w) / 2, dir = thinX ? lfx : lfz;
			if (Math.abs(along) > len - 0.1) continue;
			const side = Math.sign(across) || 1, d = Math.abs(across) - half;
			if (d < 0 || d > reachMax || -dir * side < 0.6) continue;
			const [ex, ez] = F.w(thinX ? side * half : along, thinX ? along : side * half), [nx, nz] = F.dir(thinX ? side : 0, thinX ? 0 : side);
			consider({ kind: 'wall', d, ex, ez, nx, nz, depth: half * 2, sill: top, head: Infinity });
		}
		return best;
	}
	// begin one, if there is something to go over: how ('key', 'button', 'auto')
	function tryStart(s, how = 'key') {
		if (V || cool > 0 || s.flying || s.swimming || !s.grounded) return false;
		const A = ahead(s, how === 'auto' ? 0.9 : 1.35);
		if (!A) return false;
		if (how === 'auto' && A.kind === 'window' && !(A.pane == null || A.pane.gone)) return false;
		// a whole pane in the way: through it, shoulder first
		if (A.kind === 'window' && A.pane && !A.pane.gone) ctx.glass()?.shatter(A.pane, [-A.nx * 3, 0.4, -A.nz * 3]);
		const sp = Math.hypot(s.vel.x, s.vel.z);
		const far = { x: A.ex - A.nx * (A.depth + 0.75), z: A.ez - A.nz * (A.depth + 0.75) };
		const land = ctx.floorAt(far.x, far.z, A.sill + 0.4);
		// (nowhere to land: a drop on the far side more than a storey, or a wall in the way)
		if (!Number.isFinite(land) || land < A.sill - 3.2 || land > A.sill + 0.2) return false;
		const dur = A.kind === 'window' ? 0.78 : sp > 7 ? 0.52 : 0.62;
		V = { A, t: 0, dur, p0: { x: s.pos.x, y: s.pos.y, z: s.pos.z }, far, land, sp: Math.max(3.5, Math.min(sp, 7)), pitch0: s.pitch, side: Math.random() < 0.5 ? -1 : 1, planted: false, landed: false };
		const fx = -A.nx, fz = -A.nz, rx = -fz, rz = fx;
		hands.forEach((h, i) => {
			const k = i ? 0.24 : -0.24;
			h.position.set(A.ex + rx * k - A.nx * 0.05, A.sill + 0.005, A.ez + rz * k - A.nz * 0.05);
			h.rotation.set(0, Math.atan2(fx, fz) + (i ? -0.25 : 0.25), 0);
			h.scale.setScalar(0.001); h.visible = true;
		});
		return true;
	}
	// a frame of it: where you are and how you look
	function step(s, dt) {
		if (!V) { cool = Math.max(0, cool - dt); return false; }
		V.t += dt / V.dur;
		const t = Math.min(1, V.t), A = V.A;
		const plantAt = { x: A.ex + A.nx * 0.36, z: A.ez + A.nz * 0.36 }, over = { x: A.ex - A.nx * (A.depth + 0.32), z: A.ez - A.nz * (A.depth + 0.32) };
		const foot0 = V.p0.y - EYE, crest = Math.min(A.sill + 1.05, A.head - 0.14), mid = lerp(crest, V.land + EYE - 0.1, 0.5), dip = V.land + EYE - 0.24;
		let x, z, eye;
		if (t < 0.3) {
			// the step in, rising onto the hands
			const k = ease(t / 0.3);
			x = lerp(V.p0.x, plantAt.x, k); z = lerp(V.p0.z, plantAt.z, k);
			eye = lerp(foot0 + EYE, Math.max(foot0 + EYE - 0.18, crest - 0.12), k);
		} else if (t < 0.7) {
			// over, the head kept under a window's head
			const k = (t - 0.3) / 0.4, e = ease(k);
			x = lerp(plantAt.x, over.x, e); z = lerp(plantAt.z, over.z, e);
			eye = k < 0.5 ? lerp(crest - 0.12, crest, ease(k * 2)) : lerp(crest, mid, ease((k - 0.5) * 2));
			if (!V.planted) { V.planted = true; sounds.plant({ x: A.ex, y: A.sill, z: A.ez }); }
		} else {
			// down into the knees, and up
			const k = (t - 0.7) / 0.3;
			x = lerp(over.x, V.far.x, ease(k)); z = lerp(over.z, V.far.z, ease(k));
			eye = k < 0.4 ? lerp(mid, dip, ease(k / 0.4)) : lerp(dip, V.land + EYE, ease((k - 0.4) / 0.6));
			if (!V.landed && k > 0.3) { V.landed = true; sounds.land({ x, y: V.land, z }, Math.min(1.5, Math.max(0.4, crest - V.land - EYE + 1))); }
		}
		s.pos.set(x, eye, z);
		// the look: down at the hands as they plant, a roll into the hop, back level on the far side
		const look = t < 0.45 ? -0.22 * Math.sin(Math.min(1, t / 0.45) * Math.PI * 0.5) : -0.22 * (1 - ease(Math.min(1, (t - 0.45) / 0.4)));
		const roll = Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.055 * V.side;
		camera.position.copy(s.pos);
		camera.rotation.set(Math.max(-1.35, s.pitch + look), s.yaw, roll, 'YXZ');
		// the hands: there from the reach to the push off
		const hk = t < 0.18 ? 0 : t < 0.26 ? (t - 0.18) / 0.08 : t < 0.58 ? 1 : t < 0.66 ? 1 - (t - 0.58) / 0.08 : 0;
		for (const h of hands) { h.scale.setScalar(Math.max(0.001, hk)); h.visible = hk > 0.01; }
		if (t >= 1) {
			// carrying on at the pace you came in
			const fx = -A.nx, fz = -A.nz;
			s.vel.set(fx * V.sp, 0, fz * V.sp);
			s.pos.y = V.land + EYE; s.grounded = true;
			ctx.player()?.pushOut?.(s.pos);
			for (const h of hands) h.visible = false;
			last = { kind: A.kind, at: [+V.far.x.toFixed(1), +V.far.z.toFixed(1)], through: A.kind === 'window' };
			V = null; cool = 0.35;
		}
		return true;
	}
	let last = null;
	// sprinting into a low wall goes over it without a jump
	function update(s) {
		if (V || !s || s.flying || s.swimming || !s.grounded || cool > 0 || s.locked) return;
		if (Math.hypot(s.vel.x, s.vel.z) < 7.2) return;
		tryStart(s, 'auto');
	}
	return { tryStart, step, update, ahead, active: () => !!V, info: () => ({ active: !!V, kind: V?.A.kind || null, last }) };
}
