// Where the builders of another world lived (planet/alien.js raised their monuments): a
// cluster of dwellings round each complex, domes grown or cast in the civilisation's own
// body colour, a doorway with a ring of light round it facing the complex. Inside, as you
// come near: a floor inlaid with a ring of light, a pool of glow in the middle with a shard
// turning over it, sleeping pods along the wall, a curved bench, a pedestal console, ribs
// of light up into the dome. Strange, but you can walk in, sit, and walk out again.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CIVS } from '../planet/aliencivs.js';

const TAU = Math.PI * 2;

// where they stand (before anything grows): a few round each complex; returns the circles
// to keep plants off
export function planDwellings(island, plan) {
	const H = (x, z) => island.heightAt(x, z), out = [];
	let s = (island.seed ^ 0xd3e11) >>> 0;
	const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
	for (const S of plan.sites) {
		if (S.type !== 'complex' && S.type !== 'landmark') continue;
		const n = S.type === 'complex' ? 4 : 2;
		for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
			const a = rnd() * TAU, d = S.r + 16 + rnd() * 16, x = S.x + Math.sin(a) * d, z = S.z + Math.cos(a) * d, R = 4 + rnd() * 1.5;
			let lo = 1e9, hi = -1e9;
			for (let k = 0; k < 10; k++) { const b = k / 10 * TAU, h = H(x + Math.sin(b) * R, z + Math.cos(b) * R); lo = Math.min(lo, h); hi = Math.max(hi, h); }
			if (hi - lo > 0.8 || lo < 3 || island.inWater?.(x, z) || island.maskAt?.(x, z, 0) > 0.35) continue;
			if (plan.sites.some((q) => Math.hypot(q.x - x, q.z - z) < (q.clearR || q.r + 6) + R) || out.some((q) => Math.hypot(q.x - x, q.z - z) < q.R + R + 3)) continue;
			out.push({ x, z, R, y: hi + 0.15, lo, face: Math.atan2(S.x - x, S.z - z), civ: plan.civ, site: S.id });
			i++;
		}
	}
	plan.dwellings = out;
	return out.map((q) => ({ x: q.x, z: q.z, r: q.R + 3 }));
}

export function createDwellings(scene, plan, { isPhone = false } = {}) {
	const list = plan?.dwellings || [];
	const group = new THREE.Group();
	group.name = 'alien-dwellings';
	scene.add(group);
	if (!list.length) return { update() {}, floor: () => -Infinity, push() {}, group, list, info: () => ({ dwellings: 0 }) };
	const C = CIVS[plan.civ] || CIVS.grown, body = C.mats?.body?.color || [0.7, 0.7, 0.75], trim = C.mats?.trim?.color || [0.3, 0.3, 0.35], glowC = C.glow || [0.6, 0.8, 1];
	const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...body), roughness: C.mats?.body?.rough ?? 0.4, metalness: C.mats?.body?.metal ?? 0.2, side: THREE.DoubleSide });
	const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...trim), roughness: 0.3, metalness: 0.4 });
	const glow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color().setRGB(...glowC), emissiveIntensity: 1.6, roughness: 0.4 });
	const DOOR = 0.62;           // the doorway's half angle (radians of the wall), a little over a metre and a half
	// the shells, all of them, merged: a wall band with the doorway left out, the dome over it
	{
		const S = [], G = [];
		for (const q of list) {
			const wall = new THREE.LatheGeometry([new THREE.Vector2(q.R + 0.25, -1.5), new THREE.Vector2(q.R, 0), new THREE.Vector2(q.R - 0.05, 2.5)], 24, q.face + DOOR / q.R * 1.2, TAU - 2 * DOOR / q.R * 1.2);
			const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2((q.R - 0.05) * Math.cos(t) + 0.001, 2.5 + (q.R * 0.7) * Math.sin(t))); }
			const dome = new THREE.LatheGeometry(pts, 24);
			const lintel = new THREE.BoxGeometry(2 * DOOR * 1.2 + 0.3, 2.5 - 2.25, 0.35).translate(0, 2.25 + 0.125, q.R - 0.05);
			const m = new THREE.Matrix4().makeRotationY(q.face).setPosition(q.x, q.y, q.z), mDome = new THREE.Matrix4().makeTranslation(q.x, q.y, q.z), mRot = new THREE.Matrix4().makeRotationY(0).setPosition(q.x, q.y, q.z);
			S.push(wall.applyMatrix4(mRot), dome.applyMatrix4(mDome), lintel.applyMatrix4(m));
			G.push(new THREE.TorusGeometry(1.25, 0.08, 6, 20, Math.PI).translate(0, 1.05, 0).scale(1, 1.1, 1).translate(0, 0, q.R + 0.05).applyMatrix4(m));
		}
		const clean = (l) => l.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (a !== 'position' && a !== 'normal') n.deleteAttribute(a); return n; });
		const shell = new THREE.Mesh(mergeGeometries(clean(S)), skin), rings = new THREE.Mesh(mergeGeometries(clean(G)), glow);
		shell.castShadow = shell.receiveShadow = true;
		group.add(shell, rings);
	}
	// the wall's opening: bearing (from the dwelling's centre, 0 along +z) of its middle
	const inGap = (q, x, z) => { const b = Math.atan2(x - q.x, z - q.z) - q.face; return Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) < DOOR / q.R * 1.2; };
	// ---------- inside, near you ----------
	const live = new Map(), R0 = isPhone ? 30 : 45;
	function build(q) {
		const parts = { skin: [], dark: [], glow: [] }, solids = [], seats = [];
		const put = (k, g, x, y, z, ry = 0) => parts[k].push(g.rotateY(ry).translate(x, y, z));
		const r = q.R;
		// the floor and its ring of light, the pool in the middle and the shard over it
		put('dark', new THREE.CylinderGeometry(r - 0.02, r - 0.02, 0.2, 32), 0, -0.1, 0);
		put('glow', new THREE.TorusGeometry(r * 0.72, 0.05, 4, 40).rotateX(Math.PI / 2), 0, 0.02, 0);
		put('glow', new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24), 0, 0.03, 0);
		put('skin', new THREE.TorusGeometry(0.95, 0.14, 8, 24).rotateX(Math.PI / 2), 0, 0.12, 0);
		put('glow', new THREE.OctahedronGeometry(0.35).scale(0.6, 1.6, 0.6), 0, 1.7, 0);
		solids.push({ x: 0, z: 0, r: 1.1 });
		// ribs of light up the wall into the dome
		for (let i = 0; i < 8; i++) { const a = q.face + Math.PI / 8 + i / 8 * TAU; if (Math.abs(Math.atan2(Math.sin(a - q.face), Math.cos(a - q.face))) < 0.5) continue; put('glow', new THREE.BoxGeometry(0.06, 2.3, 0.06), Math.sin(a) * (r - 0.12), 1.2, Math.cos(a) * (r - 0.12)); }
		// sleeping pods, a curved bench, the console, round the wall away from the door
		for (const [off, kind] of [[Math.PI * 0.62, 'pod'], [-Math.PI * 0.62, 'pod'], [Math.PI, 'bench'], [Math.PI * 0.32, 'console']]) {
			const a = q.face + off, x = Math.sin(a) * (r - 1.1), z = Math.cos(a) * (r - 1.1);
			if (kind === 'pod') { put('skin', new THREE.SphereGeometry(0.55, 14, 10).scale(1, 0.55, 2.1), x, 0.5, z, a + Math.PI / 2); put('glow', new THREE.SphereGeometry(0.42, 12, 8).scale(1, 0.25, 1.8), x, 0.72, z, a + Math.PI / 2); solids.push({ x, z, r: 0.75 }); seats.push([x, z, a + Math.PI, 0.55]); }
			else if (kind === 'bench') { put('dark', new THREE.TorusGeometry(r - 1.0, 0.25, 6, 16, 1.4).rotateX(Math.PI / 2).rotateY(-0.7).scale(1, 1.6, 1), 0, 0.42, 0, a - Math.PI / 2); for (const d of [-0.5, 0, 0.5]) seats.push([Math.sin(a + d) * (r - 1.0), Math.cos(a + d) * (r - 1.0), a + d + Math.PI, 0.45]); solids.push({ x, z, r: 0.5 }); }
			else { put('dark', new THREE.CylinderGeometry(0.25, 0.45, 1.0, 6), x, 0.5, z); put('glow', new THREE.BoxGeometry(0.7, 0.04, 0.45).rotateX(-0.5), x, 1.05, z, a); solids.push({ x, z, r: 0.5 }); }
		}
		const g = new THREE.Group();
		for (const k of Object.keys(parts)) if (parts[k].length) { const m = new THREE.Mesh(mergeGeometries(parts[k].map((p) => { const n = p.index ? p.toNonIndexed() : p; n.deleteAttribute('uv'); return n; })), { skin, dark, glow }[k]); m.receiveShadow = true; g.add(m); }
		g.position.set(q.x, q.y, q.z);
		group.add(g);
		const light = new THREE.PointLight(new THREE.Color().setRGB(...glowC), 0, r * 2.2, 1.5);
		light.position.set(q.x, q.y + 2.2, q.z);
		group.add(light);
		return { g, light, solids, seats };
	}
	let t = 0;
	function update(dt, cam) {
		glow.emissiveIntensity = 1.4 + Math.sin(performance.now() * 0.0012) * 0.3;
		for (const [q, D] of live) { D.g.children.forEach((m) => { if (m.material === glow) m.rotation.y += dt * 0.2; }); D.light.intensity = Math.hypot(q.x - cam.x, q.z - cam.z) < q.R + 2 ? 3 : 0; }
		t -= dt;
		if (t > 0) return;
		t = 0.5;
		const near = list.filter((q) => Math.hypot(q.x - cam.x, q.z - cam.z) < R0).sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z)).slice(0, isPhone ? 2 : 4);
		for (const [q, D] of live) if (!near.includes(q)) { group.remove(D.g, D.light); D.g.traverse((m) => m.geometry?.dispose()); D.light.dispose(); live.delete(q); }
		for (const q of near) if (!live.has(q)) { live.set(q, build(q)); break; }
	}
	// the floor inside, the wall and what stands on the floor
	function floor(x, z, y) {
		for (const q of list) if (Math.hypot(x - q.x, z - q.z) < q.R && y > q.y - 1.2) return q.y;
		return -Infinity;
	}
	function push(p, footY) {
		for (const q of list) {
			const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
			if (d > q.R + 1 || footY > q.y + 4 || footY < q.lo - 2) continue;
			// the wall: out, or in, whichever side you are on, but not through the doorway
			if (Math.abs(d - q.R) < 0.4 && !inGap(q, p.x, p.z)) { const m = d < q.R ? q.R - 0.4 : q.R + 0.4, k = m / (d || 1); p.x = q.x + dx * k; p.z = q.z + dz * k; }
			const D = live.get(q);
			if (!D) continue;
			for (const s of D.solids) { const ex = p.x - q.x - s.x, ez = p.z - q.z - s.z, e = Math.hypot(ex, ez), m = s.r + 0.3; if (e < m && e > 1e-4) { p.x = q.x + s.x + ex / e * m; p.z = q.z + s.z + ez / e * m; } }
		}
	}
	return { update, floor, push, group, list, live, info: () => ({ dwellings: list.length, live: live.size }) };
}
