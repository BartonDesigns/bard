// The road crew for a reported pothole (potholes.js, the pothole favour in people/errands.js):
// a while after the report a city truck pulls up in the lane short of the hole, its arrow
// board flashing, cones set out in a taper and round the hole, and two or three in hi-vis
// cut it square, rake hot asphalt in and tamp it down. When they are done the hole is a
// patch of fresh black asphalt from then on, and they pack up and go. Nobody watching: the
// work is done all the same, a little later.

import * as THREE from 'three';
import { soundBus } from '../world/soundbus.js';

const ARRIVE = 20, WORK = 45, LEAVE = 14, UNSEEN = 70;          // seconds
const lin = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
// a box into a list of parts, vertex coloured, turned by yaw about the origin's foot
function box(P, x, y, z, w, h, d, c, yaw = 0) {
	const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
	g.translate(0, h / 2, 0); g.translate(x, y, z); if (yaw) g.rotateY(yaw);
	const n = g.attributes.position.count, a = new Float32Array(n * 3), L = lin(c);
	for (let i = 0; i < n; i++) a.set(L, i * 3);
	g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv');
	P.push(g);
}
function merge(P) {
	let n = 0;
	for (const g of P) n += g.attributes.position.count;
	const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
	let k = 0;
	for (const g of P) { pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); col.set(g.attributes.color.array, k * 3); k += g.attributes.position.count; g.dispose(); }
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
	out.computeBoundingSphere();
	return out;
}
const CITY = [0.95, 0.95, 0.93], ORANGE = [0.98, 0.45, 0.06], DARK = [0.07, 0.07, 0.08], GLASS = [0.15, 0.2, 0.25], STEEL = [0.5, 0.52, 0.54], YELLOW = [0.95, 0.78, 0.1], SKIN = [0.7, 0.53, 0.4], DENIM = [0.18, 0.22, 0.32], LIME = [0.75, 0.95, 0.15];
// the city's patch truck, its nose along +z: a white cab, the hot box behind with its chute,
// the arrow board folded up over the back
const truckGeo = (() => {
	const P = [];
	box(P, 0, 0.5, 2.3, 2.2, 1.9, 1.9, CITY); box(P, 0, 1.4, 3.26, 2.0, 0.65, 0.04, GLASS);
	box(P, 0, 0.5, -1.0, 2.3, 0.3, 5.0, [0.3, 0.3, 0.32]);
	box(P, 0, 0.8, -0.7, 2.2, 1.3, 2.6, [0.35, 0.33, 0.3]); box(P, 0, 2.1, -0.7, 2.25, 0.08, 2.65, STEEL);          // the hot box
	box(P, 0.9, 0.6, -2.3, 0.4, 0.5, 0.8, STEEL);
	box(P, 0, 1.4, -3.3, 2.0, 1.2, 0.12, DARK);                       // the arrow board
	for (const v of [2.3, -0.4, -2.4]) for (const u of [-1.05, 1.05]) box(P, u, 0, v, 0.32, 0.92, 0.92, DARK);
	box(P, 0, 2.42, 2.2, 1.2, 0.12, 0.3, ORANGE); box(P, -1.16, 0.95, 0.4, 0.02, 0.18, 3.2, ORANGE);
	return merge(P);
})();
const coneGeo = (() => { const P = []; box(P, 0, 0, 0, 0.36, 0.04, 0.36, DARK); box(P, 0, 0.04, 0, 0.24, 0.62, 0.24, ORANGE); box(P, 0, 0.34, 0, 0.26, 0.09, 0.26, CITY); return merge(P); })();
const workerGeo = (() => { const P = []; box(P, -0.11, 0, 0, 0.17, 0.85, 0.2, DENIM); box(P, 0.11, 0, 0, 0.17, 0.85, 0.2, DENIM); box(P, 0, 0.85, 0, 0.5, 0.62, 0.28, LIME); box(P, 0, 1.12, 0, 0.52, 0.05, 0.3, [0.9, 0.9, 0.85]); box(P, -0.32, 0.9, 0, 0.13, 0.56, 0.15, LIME); box(P, 0.32, 0.9, 0, 0.13, 0.56, 0.15, LIME); box(P, 0, 1.48, 0, 0.22, 0.25, 0.24, SKIN); box(P, 0, 1.7, 0, 0.3, 0.1, 0.32, YELLOW); box(P, 0.35, 0.3, 0.25, 0.04, 1.3, 0.04, [0.45, 0.32, 0.2]); box(P, 0.35, 0.2, 0.25, 0.3, 0.05, 0.2, STEEL); return merge(P); })();
const tarGeo = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 14); g.translate(0, 0.5, 0); return g; })();

export function createRoadCrew({ scene, potholes, ground, camera, isPhone = false, hint = () => {} }) {
	const group = new THREE.Group();
	group.name = 'road-crew';
	scene.add(group);
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.06 });
	const tarMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.45 });
	const lampMat = new THREE.MeshBasicMaterial({ color: 0xffa020, toneMapped: false });
	const sites = new Map();       // id -> { h, t0, root, workers, arrow, tar, phase }
	let clock = 0, bump = 0, buf = null, bufCtx = null;
	const TINT = new THREE.Color(1, 0.62, 0.12);
	let started = false;
	const later = new Map();
	// a hole is reported: the crew is on its way (h: the hole, with its way along the street)
	function dispatch(h) {
		if (!h || sites.has(h.id)) return false;
		sites.set(h.id, { h, t0: clock, root: null, workers: [], phase: 'coming' });
		return true;
	}
	function build(S) {
		const h = S.h, root = new THREE.Group(), yaw = Math.atan2(h.tx, h.tz);
		// (which way the traffic comes in this lane: driving on the right, a lane right of the
		// centre line runs along the street's own way)
		const back = h.o > 0 ? 1 : -1, fx = h.tx * back, fz = h.tz * back, nx = -h.tz, nz = h.tx;
		const at = (a, b) => { const x = h.x - fx * a + nx * b, z = h.z - fz * a + nz * b; return [x, ground(x, z), z]; };
		// the truck short of the hole, facing on along the lane, its board to the traffic
		{ const [x, y, z] = at(7, 0); const m = new THREE.Mesh(truckGeo, mat); m.position.set(x, y, z); m.rotation.y = yaw + (back > 0 ? 0 : Math.PI); m.castShadow = true; root.add(m); }
		// the arrow board's lamps
		const arrow = new THREE.Group();
		{ const [x, y, z] = at(10.35, 0); arrow.position.set(x, y + 1.4, z); arrow.rotation.y = yaw + (back > 0 ? Math.PI : 0); for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), lampMat); b.position.set(-0.75 + k * 0.25, 0.65 - Math.abs(k - 3) * 0.12, 0); arrow.add(b); } root.add(arrow); }
		// the cones: a taper in from behind the truck, and a ring round the hole
		const cones = new THREE.InstancedMesh(coneGeo, mat, 14);
		let nc = 0;
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
		for (let k = 0; k < 5; k++) { const [x, y, z] = at(13 + k * 4, 1.4 - k * 0.32); cones.setMatrixAt(nc++, m4.compose(p.set(x, y, z), q.setFromAxisAngle(Y, k), one)); }
		for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, [x, y, z] = at(Math.cos(a) * 1.9, Math.sin(a) * 1.6); cones.setMatrixAt(nc++, m4.compose(p.set(x, y, z), q.setFromAxisAngle(Y, a), one)); }
		cones.count = nc; cones.castShadow = true; root.add(cones);
		// the hot asphalt raked into it, growing as they work
		const tar = new THREE.Mesh(tarGeo, tarMat);
		{ const [x, y, z] = at(0, 0); tar.position.set(x, y - 0.03, z); tar.scale.set(h.r + 0.25, 0.001, h.r + 0.25); root.add(tar); }
		// the crew
		const n = isPhone ? 2 : 3;
		for (let k = 0; k < n; k++) {
			const w = new THREE.Mesh(workerGeo, mat), a = k * 2.2 + 0.4, [x, y, z] = at(Math.cos(a) * 1.1, Math.sin(a) * 1.0);
			w.position.set(x, y, z); w.rotation.y = Math.atan2(h.x - x, h.z - z); w.castShadow = true;
			S.workers.push({ m: w, y, ph: k * 1.7, base: w.rotation.y });
			root.add(w);
		}
		group.add(root);
		S.root = root; S.arrow = arrow; S.tar = tar; S.cones = cones;
	}
	function drop(S) {
		if (!S.root) return;
		S.root.traverse((o) => { if (o.geometry && o.geometry !== truckGeo && o.geometry !== coneGeo && o.geometry !== workerGeo && o.geometry !== tarGeo) o.geometry.dispose(); });
		S.cones?.dispose();
		S.root.removeFromParent(); S.root = null; S.workers.length = 0;
	}
	// the tamper's thud
	function thud(gain) {
		const B = soundBus();
		if (!B) return;
		if (!buf || bufCtx !== B.ctx) {
			const sr = B.ctx.sampleRate, len = Math.floor(sr * 0.18);
			buf = B.ctx.createBuffer(1, len, sr); bufCtx = B.ctx;
			const d = buf.getChannelData(0); let lp = 0;
			for (let i = 0; i < len; i++) { const t = i / sr; lp += (Math.random() * 2 - 1 - lp) * 0.2; d[i] = (Math.sin(t * 2 * Math.PI * 70) * 0.8 + lp) * Math.exp(-t * 30); }
		}
		const src = B.ctx.createBufferSource(), g = B.ctx.createGain();
		src.buffer = buf; g.gain.value = gain; src.connect(g).connect(B.out); src.start();
	}
	function update(dt, night = 0) {
		clock += dt;
		// reports from an earlier visit: filled while you were away, or soon
		if (!started) { started = true; for (const [id, at] of potholes.reported()) later.set(id, clock + Math.max(0, UNSEEN - (Date.now() - at) / 1000)); }
		for (const [id, t] of later) if (clock > t) { later.delete(id); if (!sites.has(id)) potholes.fix(id); }
		const cx = camera.position.x, cz = camera.position.z;
		lampMat.color.setScalar(0.4 + 1.4 * Math.max(night, 0.3)).multiply(TINT);
		for (const [id, S] of sites) {
			const t = clock - S.t0, d = Math.hypot(S.h.x - cx, S.h.z - cz), seen = d < (isPhone ? 260 : 420);
			if (t > ARRIVE && t < ARRIVE + WORK + LEAVE && seen && !S.root) build(S);
			if (S.root && !seen) drop(S);
			if (S.phase === 'coming' && t > ARRIVE) { S.phase = 'working'; if (seen && d < 200) hint('The road crew is here for the pothole.', 3000); }
			if (S.phase === 'working' && t > ARRIVE + WORK) { S.phase = 'leaving'; potholes.fix(id); }
			if (!seen && S.phase !== 'leaving' && t > UNSEEN) { S.phase = 'leaving'; potholes.fix(id); }
			if (S.root) {
				const wk = Math.min(1, Math.max(0, (t - ARRIVE) / WORK));
				S.tar.scale.y = 0.001 + 0.05 * Math.min(1, wk * 2) * (S.phase === 'leaving' ? 0 : 1);
				S.arrow.visible = Math.sin(clock * 6) > -0.2;
				for (const w of S.workers) {
					// raking and tamping: a bob and a turn, faster while they tamp
					const r = S.phase === 'working' ? Math.sin(clock * (wk > 0.6 ? 7 : 3) + w.ph) : 0;
					w.m.position.y = w.y + Math.max(0, r) * 0.05; w.m.rotation.y = w.base + r * 0.25;
				}
				if (S.phase === 'working' && wk > 0.6 && d < 60 && (bump -= dt) < 0) { bump = 0.42; thud(0.18 * (1 - d / 60)); }
			}
			if (t > ARRIVE + WORK + LEAVE) { drop(S); sites.delete(id); }
		}
	}
	function info() { return [...sites.values()].map((S) => ({ id: S.h.id, phase: S.phase, t: Math.round(clock - S.t0), built: !!S.root })); }
	// for the console and the screenshots: the crew straight to work on a hole (skip: seconds already passed)
	function now(h, skip = ARRIVE + 5) { dispatch(h); const S = sites.get(h.id); if (S) S.t0 = clock - skip; return !!S; }
	return { dispatch, update, info, now, group };
}
