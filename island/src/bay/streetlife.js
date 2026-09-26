// What makes a street feel lived in, placed on the same grids as the buildings and the
// painted streets: cars parked along the kerbs (sedans, hatchbacks, SUVs, pickups, vans,
// in the colours people actually buy), traffic driving the lanes, stopping and turning
// at the corners, headlights and tail lights at night; street lights, traffic signals at
// the busier crossings, fire hydrants, benches and bus shelters downtown, bins, and
// parking meters in the city. Built around you as you move, a few hundred metres out.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BLOCKS, toGrid, fromGrid, STYLE } from './styles.js';
import { carGeometry, carMaterial } from './cars.js';

const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// car paint by what sells: white, black, grey, silver, then blue, red, a little of the rest
const PAINT = [[0.92, 0.92, 0.91], [0.92, 0.92, 0.91], [0.05, 0.05, 0.06], [0.05, 0.05, 0.06], [0.35, 0.36, 0.38], [0.35, 0.36, 0.38], [0.66, 0.67, 0.69], [0.66, 0.67, 0.69], [0.1, 0.2, 0.45], [0.55, 0.06, 0.06], [0.2, 0.3, 0.26], [0.45, 0.38, 0.3], [0.8, 0.8, 0.82], [0.25, 0.08, 0.1]];

export function createStreetLife(shared, scene, bay, groundAt, real = null) {
	const group = new THREE.Group();
	group.name = 'street-life';
	scene.add(group);
	const night = { value: 0 };
	const carMat = carMaterial(night);
	const KINDS = ['sedan', 'sedan', 'sedan', 'hatch', 'suv', 'suv', 'suv', 'pickup', 'van'];
	const kinds = ['sedan', 'hatch', 'suv', 'pickup', 'van'];
	const mk = (geo, mat, cap, colors = true) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; if (colors) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); group.add(im); return im; };
	const parked = Object.fromEntries(kinds.map((k) => [k, mk(carGeometry(k), carMat, 1200)]));
	const moving = Object.fromEntries(kinds.map((k) => [k, mk(carGeometry(k), carMat, 60)]));

	// street furniture
	const metal = new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.5, metalness: 0.6 });
	const lampGeo = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.11, 8.5, 6).translate(0, 4.25, 0), new THREE.BoxGeometry(0.12, 0.12, 1.8).translate(0, 8.4, 0.85), new THREE.BoxGeometry(0.35, 0.14, 0.6).translate(0, 8.33, 1.7)]);
	const lamps = mk(lampGeo, metal, 900, false);
	const signalGeo = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.12, 5.5, 6).translate(0, 2.75, 0), new THREE.BoxGeometry(0.1, 0.1, 5).translate(0, 5.4, 2.5), new THREE.BoxGeometry(0.35, 1.0, 0.3).translate(0, 4.9, 3.4)]);
	const signals = mk(signalGeo, new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.6, metalness: 0.4 }), 300, false);
	const hydrantGeo = mergeGeometries([new THREE.CylinderGeometry(0.13, 0.15, 0.65, 8).translate(0, 0.33, 0), new THREE.SphereGeometry(0.14, 8, 6).translate(0, 0.66, 0), new THREE.CylinderGeometry(0.05, 0.05, 0.36, 6).rotateZ(Math.PI / 2).translate(0, 0.45, 0)]);
	const hydrants = mk(hydrantGeo, new THREE.MeshStandardMaterial({ color: 0xc8b020, roughness: 0.5 }), 400, false);
	const benchGeo = mergeGeometries([new THREE.BoxGeometry(1.8, 0.06, 0.45).translate(0, 0.45, 0), new THREE.BoxGeometry(1.8, 0.4, 0.05).translate(0, 0.7, -0.2), new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(-0.8, 0.22, 0), new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(0.8, 0.22, 0)]);
	const benches = mk(benchGeo, new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.8 }), 300, false);
	const shelterGeo = mergeGeometries([new THREE.BoxGeometry(3.6, 0.08, 1.5).translate(0, 2.5, 0), new THREE.BoxGeometry(3.6, 2.4, 0.04).translate(0, 1.25, -0.7), new THREE.BoxGeometry(0.04, 2.4, 1.4).translate(-1.78, 1.25, 0), new THREE.BoxGeometry(1.2, 1.8, 0.06).translate(1.1, 1.2, -0.66)]);
	const shelters = mk(shelterGeo, new THREE.MeshStandardMaterial({ color: 0x9aa4ac, roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.75 }), 80, false);
	const binGeo = new THREE.CylinderGeometry(0.3, 0.27, 0.95, 10).translate(0, 0.48, 0);
	const bins = mk(binGeo, new THREE.MeshStandardMaterial({ color: 0x2c4a36, roughness: 0.6 }), 400, false);
	const meterGeo = mergeGeometries([new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5).translate(0, 0.55, 0), new THREE.BoxGeometry(0.2, 0.3, 0.14).translate(0, 1.25, 0)]);
	const meters = mk(meterGeo, metal, 800, false);
	// the lamp heads glow at night; signals show their colour
	const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
	const lampLightGeo = new THREE.BufferGeometry(); lampLightGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(900 * 3), 3));
	const lampLights = new THREE.Points(lampLightGeo, new THREE.PointsMaterial({ color: 0xffc070, size: 3.2, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
	lampLights.frustumCulled = false; group.add(lampLights);
	const sigGeo = new THREE.BufferGeometry(); sigGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(300 * 3), 3)); sigGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(300 * 3), 3));
	const sigLights = new THREE.Points(sigGeo, new THREE.PointsMaterial({ size: 0.9, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
	sigLights.frustumCulled = false; group.add(sigLights);

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
	const eul = new THREE.Euler(0, 0, 0, 'YXZ');
	const put = (im, k, x, y, z, yaw, s = 1, pitch = 0) => { eul.set(pitch, yaw, 0); q.setFromEuler(eul); sc.setScalar(s); p.set(x, y, z); im.setMatrixAt(k, m4.compose(p, q, sc)); };
	// a car sits on the slope: the ground under its front and back wheels sets its pitch and height
	const putCar = (im, k, x, z, yaw) => {
		const fx = Math.sin(yaw) * 1.4, fz = Math.cos(yaw) * 1.4, gf = groundAt(x + fx, z + fz), gb = groundAt(x - fx, z - fz);
		put(im, k, x, (gf + gb) / 2, z, yaw, 1, -Math.atan2(gf - gb, 2.8));
	};

	// ---------- building the street furniture round a point ----------
	let lastX = 1e9, lastZ = 1e9, realV = 0;
	const signalList = [], lanes = [];
	// a lane is a polyline with its running length; cars ride it by distance
	function laneOf(pts, half, style, oneway) {
		const cum = [0];
		for (let i = 2; i < pts.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
		return { pts, cum, L: cum[cum.length - 1] || 1, half, style, oneway, x0: pts[0], z0: pts[1], x1: pts[pts.length - 2], z1: pts[pts.length - 1] };
	}
	function laneAt(l, s) {
		// position and direction at distance s along the lane
		let i = 1;
		while (i < l.cum.length - 1 && l.cum[i] < s) i++;
		const t = (s - l.cum[i - 1]) / ((l.cum[i] - l.cum[i - 1]) || 1);
		const ax = l.pts[i * 2 - 2], az = l.pts[i * 2 - 1], bx = l.pts[i * 2], bz = l.pts[i * 2 + 1], L = Math.hypot(bx - ax, bz - az) || 1;
		return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / L, (bz - az) / L];
	}
	// the real streets: cars at the kerbs clear of the driveways, street lights, hydrants,
	// signals where the collectors cross, and lanes for the traffic
	const RANK = { motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2, residential: 1, unclassified: 1, living_street: 1 };
	function realStreets(cx, cz, R, n, lampPos, setNl, getNl) {
		const roads = real.near('roads', cx, cz, R).filter((r) => r.drive && r.cls !== 'service');
		const drives = real.near('paths', cx, cz, R + 40);
		const clearOfDrive = (x, z) => { for (const d of drives) if (Math.abs(d.bx - x) < 9 && Math.abs(d.bz - z) < 9 && Math.hypot(d.bx - x, d.bz - z) < 6.5 + d.w / 2) return false; return true; };
		const ends = new Map();
		for (const r of roads) {
			const p = r.pts, hw = r.w / 2, rank = RANK[r.cls] || 0;
			for (const k of [0, p.length - 2]) { const key = Math.round(p[k] / 2) + ',' + Math.round(p[k + 1] / 2); const e = ends.get(key) || { x: p[k], z: p[k + 1], n: 0, rank: 0, hw: 0 }; e.n++; e.rank = Math.max(e.rank, rank); e.hw = Math.max(e.hw, hw); ends.set(key, e); }
			lanes.push(laneOf(Array.from(p), hw, r.cls === 'residential' || r.cls === 'living_street' || r.cls === 'unclassified' ? STYLE.suburb : STYLE.office, r.divided || r.cls === 'motorway' || r.link));
			// walk the street every 2.2 m, both sides
			let run = 0;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
				if (L < 0.5) continue;
				const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx, yaw = Math.atan2(dx, dz);
				for (let s = 0; s < L; s += 2.2, run += 2.2) {
					const x = ax + dx * s, z = az + dz * s;
					if (Math.hypot(x - cx, z - cz) > R) continue;
					const k = Math.floor(run / 2.2), side = k % 2 ? 1 : -1;
					// parked cars on the residential streets, clear of driveways and corners
					if (rank <= 1 && !r.divided && k % 3 === 0 && run > 12) for (const sd of [-1, 1]) {
						const h1 = hash(x * 3.1 + sd, z * 1.7);
						if (h1 > 0.22) continue;
						const px = x + nx * (hw - 1.15) * sd, pz = z + nz * (hw - 1.15) * sd;
						if (!clearOfDrive(px, pz)) continue;
						const land = real.landAt?.(px, pz);
						if (!land || land.lu === 0 || land.lu === 11 || land.lu === 12) continue;       // no parking out in the wild
						const kind = KINDS[Math.floor(hash(h1 * 1000, k) * KINDS.length)], im = parked[kind], c = n(im);
						if (c < 0) continue;
						putCar(im, c, px, pz, yaw + (sd > 0 ? Math.PI : 0) + (h1 - 0.1) * 0.3);
						const pc = PAINT[Math.floor(hash(k, h1 * 777) * PAINT.length)];
						im.setColorAt(c, col.setRGB(pc[0], pc[1], pc[2]));
					}
					// the kerb furniture
					const kx = x + nx * (hw + 0.45) * side, kz = z + nz * (hw + 0.45) * side, kg = groundAt(kx, kz);
					if (k % 19 === 9 && rank >= 1 && !r.bridge) { const c = n(lamps); if (c >= 0) { put(lamps, c, kx, kg, kz, Math.atan2(-side * nx, -side * nz)); const nl = getNl(); if (nl < 900) { lampPos.set([x + nx * (hw - 1.2) * side, kg + 8.2, z + nz * (hw - 1.2) * side], nl * 3); setNl(nl + 1); } } }
					if (k % 47 === 20 && rank >= 1) { const c = n(hydrants); if (c >= 0) put(hydrants, c, kx, kg, kz, yaw); }
					if (rank >= 2 && k % 97 === 50) { const c = n(benches); if (c >= 0) put(benches, c, x + nx * (hw + 1.4) * side, kg, z + nz * (hw + 1.4) * side, Math.atan2(-side * nx, -side * nz)); }
				}
			}
		}
		// signals where the collectors cross
		for (const e of ends.values()) {
			if (e.n < 3 || e.rank < 2 || Math.hypot(e.x - cx, e.z - cz) > R) continue;
			for (const [ox, oz] of [[1, 1], [-1, -1]]) {
				const d = e.hw + 2.2, x = e.x + ox * d * 0.707, z = e.z + oz * d * 0.707, g = groundAt(x, z), c = n(signals);
				if (c < 0) continue;
				const yaw = Math.atan2(e.x - x, e.z - z) - Math.PI / 4;
				put(signals, c, x, g, z, yaw);
				signalList.push({ x: x + Math.sin(yaw) * 3.4, y: g + 5.1, z: z + Math.cos(yaw) * 3.4, ph: hash(e.x, e.z) * 60 });
			}
		}
	}
	function build(cx, cz) {
		const R = 380;
		const counts = new Map(), n = (im) => { const c = counts.get(im) || 0; counts.set(im, c + 1); return c < im.instanceMatrix.count ? c : -1; };
		const lampPos = lampLightGeo.attributes.position.array; let nl = 0;
		signalList.length = 0; lanes.length = 0;
		const grids = new Map();
		for (let dz = -R; dz <= R; dz += R / 4) for (let dx = -R; dx <= R; dx += R / 4) { const u = bay.urbanAt(cx + dx, cz + dz); if (u.u > 0.15) grids.set(Math.round(u.a * 1000) + ':' + u.s, [u.a, u.s]); }
		for (const [a, style] of grids.values()) {
			const [BX, BZ, ST] = BLOCKS[style];
			const [gcx, gcz] = toGrid(cx, cz, a, style);
			const i0 = Math.floor((gcx - R) / BX), i1 = Math.floor((gcx + R) / BX), j0 = Math.floor((gcz - R) / BZ), j1 = Math.floor((gcz + R) / BZ);
			const W = (gx, gz) => fromGrid(gx, gz, a, style);
			const head = (gx, gz, dgx, dgz) => { const [x0, z0] = W(gx, gz), [x1, z1] = W(gx + dgx, gz + dgz); return Math.atan2(x1 - x0, z1 - z0); };
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const [wx, wz] = W((i + 0.5) * BX, (j + 0.5) * BZ);
				if (Math.hypot(wx - cx, wz - cz) > R) continue;
				const U = bay.urbanAt(wx, wz);
				if (U.u < 0.3 || U.s !== style || Math.abs(U.a - a) > 0.01) continue;
				if (real?.inside(wx, wz)) continue;                                              // the real streets are furnished below
				const city = style === STYLE.sf || style === STYLE.sunset || U.d > 0.15, busy = city || style === STYLE.retail || style === STYLE.office;
				// the two streets on this block's low edges: along grid x at gz = j*BZ + ST/2, along grid z at gx = i*BX + ST/2
				for (const along of [0, 1]) {
					const L = along ? BZ : BX;
					const base = along ? [i * BX, j * BZ] : [i * BX, j * BZ];
					for (let s = ST; s < L; s += 2.2) {
						const t = s;
						// positions across the street: parking lanes, kerb furniture
						const at = (off) => along ? [base[0] + off, base[1] + t] : [base[0] + t, base[1] + off];
						const yaw = along ? head(base[0] + ST / 2, base[1] + t, 0, 1) : head(base[0] + t, base[1] + ST / 2, 1, 0);
						const r = hash(i * 131 + (along ? 7 : 3), j * 71 + Math.floor(t));
						const k = Math.floor(t / 2.2);
						// parked cars: both kerbs, not near the corners, fewer in the suburbs (driveways)
						if (style !== STYLE.industry && t > ST + 6 && t < L - 6 && k % 3 === 0) for (const side of [0, 1]) {
							const rr = hash(i * 13 + k * 7 + side, j * 29 + (along ? 3 : 1));
							if (rr > (city ? 0.82 : style === STYLE.suburb ? 0.3 : 0.55)) continue;
							const [gx, gz] = at(side ? ST - 1.25 : 1.25), [x, z] = W(gx, gz), g = groundAt(x, z);
							if (g < 0.5) continue;
							const kind = KINDS[Math.floor(hash(rr * 1000, k) * KINDS.length)], im = parked[kind], c = n(im);
							if (c < 0) continue;
							put(im, c, x, g, z, yaw + (side ? Math.PI : 0) + (rr - 0.5) * 0.04);
							const pc = PAINT[Math.floor(hash(k, rr * 777) * PAINT.length)];
							im.setColorAt(c, col.setRGB(pc[0], pc[1], pc[2]));
						}
						// the kerb furniture on the block's side of the street
						const [kx, kz] = W(...at(ST + 0.45)), kg = groundAt(kx, kz);
						if (kg < 0.5) continue;
						if (k % 13 === 6) { const c = n(lamps); if (c >= 0) { put(lamps, c, kx, kg, kz, yaw + (along ? -Math.PI / 2 : Math.PI / 2)); if (nl < 900) { const [lx, lz] = W(...at(ST - 1.2)); lampPos.set([lx, kg + 8.2, lz], nl * 3); nl++; } } }
						if (k % 37 === 18) { const c = n(hydrants); if (c >= 0) put(hydrants, c, kx, kg, kz, yaw); }
						if (city && k % 5 === 2 && t > ST + 4 && t < L - 4) { const c = n(meters); if (c >= 0) put(meters, c, kx, kg, kz, yaw); }
						if (busy && k % 29 === 14) { const c = n(bins); if (c >= 0) put(bins, c, kx, kg, kz, yaw); }
						if (busy && k % 41 === 20 && r < 0.5) { const [bx, bz] = W(...at(ST + 1.6)); const c = n(benches); if (c >= 0) put(benches, c, bx, kg, bz, yaw + (along ? -Math.PI / 2 : Math.PI / 2)); }
						if (busy && k % 53 === 26 && r < 0.35) { const [bx, bz] = W(...at(ST + 1.4)); const c = n(shelters); if (c >= 0) put(shelters, c, bx, kg, bz, yaw + (along ? -Math.PI / 2 : Math.PI / 2)); }
					}
					// the traffic lanes on this street, for moving cars
					const [x0, z0] = W(...(along ? [i * BX + ST / 2, j * BZ] : [i * BX, j * BZ + ST / 2])), [x1, z1] = W(...(along ? [i * BX + ST / 2, (j + 1) * BZ] : [(i + 1) * BX, j * BZ + ST / 2]));
					lanes.push(laneOf([x0, z0, x1, z1], ST / 2, style, false));
				}
				// signals at the busy corners
				if (busy && hash(i * 3, j * 5) < 0.4) {
					for (const [ox, oz, yw] of [[ST + 0.4, ST + 0.4, 0], [-0.4, -0.4, Math.PI]]) {
						const [x, z] = W(i * BX + ox, j * BZ + oz), g = groundAt(x, z), c = n(signals);
						if (c < 0 || g < 0.5) continue;
						const yaw = head(i * BX + ST / 2, j * BZ + ST / 2, 1, 0) + yw;
						put(signals, c, x, g, z, yaw);
						signalList.push({ x: x + Math.sin(yaw) * 3.4, y: g + 5.1, z: z + Math.cos(yaw) * 3.4, ph: hash(i, j) * 60 });
					}
				}
			}
		}
		if (real?.loaded()) realStreets(cx, cz, R, n, lampPos, (v) => { nl = v; }, () => nl);
		for (const im of [...Object.values(parked), lamps, signals, hydrants, benches, shelters, bins, meters]) {
			im.count = Math.min(counts.get(im) || 0, im.instanceMatrix.count);
			im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
			im.computeBoundingSphere();
		}
		lampLightGeo.setDrawRange(0, nl); lampLightGeo.attributes.position.needsUpdate = true;
		sigGeo.setDrawRange(0, Math.min(300, signalList.length));
		signalList.slice(0, 300).forEach((s, k) => sigGeo.attributes.position.array.set([s.x, s.y, s.z], k * 3));
		sigGeo.attributes.position.needsUpdate = true;
		// traffic: cars on the nearest lanes
		cars.length = 0;
		const near = lanes.map((l) => ({ l, d: Math.hypot((l.x0 + l.x1) / 2 - cx, (l.z0 + l.z1) / 2 - cz) })).sort((a, b) => a.d - b.d).slice(0, 90);
		for (const { l } of near) {
			const nC = l.style === STYLE.sf || l.style === STYLE.retail ? 2 : Math.max(1, Math.min(4, Math.round(l.L / 160)));
			for (let k = 0; k < nC; k++) {
				const r = Math.random();
				if (r > (l.style === STYLE.suburb ? 0.45 : 0.75)) continue;
				cars.push({ l, u: Math.random(), dir: l.oneway || Math.random() < 0.5 ? 1 : -1, v: 0, vmax: (l.style === STYLE.suburb ? 8 : 12) + Math.random() * 5, kind: kinds[Math.floor(Math.random() * kinds.length)], col: PAINT[Math.floor(Math.random() * PAINT.length)], wait: 0, lane: l.oneway ? (Math.random() < 0.5 ? -0.5 : 0.5) : 0 });
			}
		}
	}
	const cars = [];

	function update(dt, t, cam, nightK) {
		if (!bay.loaded()) return;
		night.value = nightK;
		carMat.envMapIntensity = 0.9 * (1 - nightK * 0.9);
		const high = cam.position.y - groundAt(cam.position.x, cam.position.z) > 450;
		group.visible = !high;
		if (high) return;
		const x = cam.position.x, z = cam.position.z;
		if (real?.version && real.version() !== realV) { realV = real.version(); lastX = 1e9; }   // a generated town came or went
		if (Math.hypot(x - lastX, z - lastZ) > 120) { lastX = x; lastZ = z; build(x, z); }
		lampLights.material.opacity = nightK;
		// signals cycle green, amber, red
		const sc2 = sigGeo.attributes.color.array;
		signalList.slice(0, 300).forEach((s, k) => { const c = ((t + s.ph) % 60) / 60; const [r, g, b] = c < 0.45 ? [0.1, 1, 0.4] : c < 0.52 ? [1, 0.7, 0.05] : [1, 0.08, 0.05]; sc2.set([r, g, b], k * 3); });
		sigGeo.attributes.color.needsUpdate = true;
		// traffic: along the lane, easing to a stop near the far end, then a new lane
		const counts = Object.fromEntries(kinds.map((k) => [k, 0]));
		for (const c of cars) {
			const l = c.l, L = l.L;
			const toEnd = c.dir > 0 ? (1 - c.u) * L : c.u * L;
			const target = toEnd < 12 ? Math.max(0, (toEnd - 3) * 0.8) : c.vmax;
			c.v += (target - c.v) * Math.min(1, dt * 1.2);
			if (toEnd < 3.5) {
				c.wait += dt;
				// a one-way carriageway starts again at its beginning; a street turns round
				if (c.wait > 1.5 + Math.random()) { c.wait = 0; if (l.oneway) c.u = 0.02; else { c.dir = -c.dir; c.u = c.dir > 0 ? 0.02 : 0.98; } }
			}
			c.u = Math.min(1, Math.max(0, c.u + c.dir * c.v * dt / L));
			const [lx, lz, dx, dz] = laneAt(l, c.u * L);
			const off = l.oneway ? c.lane * l.half : (c.dir > 0 ? -1 : 1) * Math.min(1.8, l.half * 0.4);
			const px = lx + dz * off, pz = lz - dx * off;
			c.px = px; c.pz = pz; c.vx = dx * c.dir * c.v; c.vz = dz * c.dir * c.v;      // for the street sound
			const im = moving[c.kind], k = counts[c.kind]++;
			if (k >= im.instanceMatrix.count) continue;
			putCar(im, k, px, pz, Math.atan2(dx * c.dir, dz * c.dir));
			im.setColorAt(k, col.setRGB(c.col[0], c.col[1], c.col[2]));
		}
		for (const k of kinds) { const im = moving[k]; im.count = counts[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
	}
	return { update, group, cars };
}
