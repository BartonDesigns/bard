// What makes a street feel lived in, placed on the same grids as the buildings and the
// painted streets: cars parked along the kerbs (sedans, hatchbacks, SUVs, pickups, vans,
// in the colours people actually buy), traffic driving the lanes, stopping and turning
// at the corners, headlights and tail lights at night; street lights, traffic signals at
// the busier crossings, fire hydrants, benches and bus shelters downtown, bins, and
// parking meters in the city. Built around you as you move, a few hundred metres out.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BLOCKS, toGrid, fromGrid, STYLE } from './styles.js';

const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// car paint by what sells: white, black, grey, silver, then blue, red, a little of the rest
const PAINT = [[0.92, 0.92, 0.91], [0.92, 0.92, 0.91], [0.05, 0.05, 0.06], [0.05, 0.05, 0.06], [0.35, 0.36, 0.38], [0.35, 0.36, 0.38], [0.66, 0.67, 0.69], [0.66, 0.67, 0.69], [0.1, 0.2, 0.45], [0.55, 0.06, 0.06], [0.2, 0.3, 0.26], [0.45, 0.38, 0.3], [0.8, 0.8, 0.82], [0.25, 0.08, 0.1]];

// a car from its side profile, extruded to its width; parts coded for the shader
// (0 paint, 1 glass, 2 tyres and trim, 3 lights)
function carGeometry(kind) {
	const prof = {
		sedan: [[-2.35, 0.3], [-2.35, 0.75], [-2.0, 0.85], [-1.2, 0.9], [-0.8, 1.38], [0.7, 1.42], [1.35, 0.95], [2.3, 0.85], [2.38, 0.55], [2.35, 0.3]],
		hatch: [[-1.95, 0.3], [-1.98, 0.8], [-1.8, 1.35], [0.3, 1.45], [1.05, 0.95], [1.95, 0.82], [2.0, 0.55], [1.97, 0.3]],
		suv: [[-2.35, 0.4], [-2.38, 1.05], [-2.2, 1.7], [0.9, 1.75], [1.5, 1.1], [2.3, 1.0], [2.38, 0.65], [2.35, 0.4]],
		pickup: [[-2.7, 0.45], [-2.72, 1.05], [-0.6, 1.05], [-0.55, 1.78], [0.9, 1.78], [1.35, 1.12], [2.65, 1.02], [2.72, 0.65], [2.7, 0.45]],
		van: [[-2.45, 0.4], [-2.48, 2.0], [1.3, 2.02], [1.95, 1.2], [2.4, 1.02], [2.45, 0.55], [2.45, 0.4]],
	}[kind];
	const W = kind === 'hatch' ? 1.75 : kind === 'sedan' ? 1.82 : 1.95;
	const shape = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
	const body = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, steps: 1 });
	body.translate(0, 0, -W / 2);
	// profile x is along the car; the car faces +z in the world, so turn it
	body.rotateY(-Math.PI / 2);
	body.deleteAttribute('uv');
	// the glass: everything above the belt line
	const belt = kind === 'van' ? 1.25 : kind === 'suv' ? 1.12 : kind === 'pickup' ? 1.1 : 0.95;
	const P = body.attributes.position, part = new Float32Array(P.count);
	for (let i = 0; i < P.count; i++) {
		const y = P.getY(i), z = P.getZ(i), len = kind === 'pickup' ? 2.7 : kind === 'hatch' ? 1.95 : 2.4;
		part[i] = y > belt + 0.05 ? 1 : Math.abs(z) > len - 0.12 && y > 0.6 && y < belt - 0.02 && Math.abs(P.getX(i)) > W * 0.28 ? 3 : 0;
	}
	body.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
	const parts = [body.toNonIndexed()];
	const wheelZ = kind === 'hatch' ? [1.25, -1.25] : kind === 'pickup' ? [1.75, -1.75] : [1.45, -1.45];
	for (const z of wheelZ) for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) {
		const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14).rotateZ(Math.PI / 2).translate(x, 0.34, z).toNonIndexed();
		w.deleteAttribute('uv');
		w.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(w.attributes.position.count).fill(2), 1));
		parts.push(w);
	}
	const g = mergeGeometries(parts);
	g.computeVertexNormals();
	return g;
}

function carMaterial(night) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightS = night;
		sh.vertexShader = 'attribute float aPart; varying float vPart; varying float vFront;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = aPart; vFront = position.z;');
		sh.fragmentShader = 'uniform float uNightS; varying float vPart; varying float vFront;\nvec3 carGlow = vec3(0.0); float carRough = -1.0;\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				if (vPart > 0.5 && vPart < 1.5) { diffuseColor.rgb = vec3(0.04, 0.05, 0.06); carRough = 0.05; }
				else if (vPart > 1.5 && vPart < 2.5) { diffuseColor.rgb = vec3(0.03); carRough = 0.9; }
				else if (vPart > 2.5) { bool front = vFront > 0.0; diffuseColor.rgb = front ? vec3(0.9, 0.9, 0.85) : vec3(0.6, 0.04, 0.03); carGlow = (front ? vec3(1.0, 0.92, 0.75) * 2.5 : vec3(1.0, 0.05, 0.02) * 1.6) * uNightS; }`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (carRough >= 0.0) roughnessFactor = carRough;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += carGlow;');
	};
	m.customProgramCacheKey = () => 'baycar';
	return m;
}

export function createStreetLife(shared, scene, bay, groundAt) {
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
	const put = (im, k, x, y, z, yaw, s = 1) => { q.setFromAxisAngle(Y, yaw); sc.setScalar(s); p.set(x, y, z); im.setMatrixAt(k, m4.compose(p, q, sc)); };

	// ---------- building the street furniture round a point ----------
	let lastX = 1e9, lastZ = 1e9;
	const signalList = [], lanes = [];
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
					lanes.push({ x0, z0, x1, z1, half: ST / 2, style });
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
			const nC = l.style === STYLE.sf || l.style === STYLE.retail ? 2 : 1;
			for (let k = 0; k < nC; k++) {
				const r = Math.random();
				if (r > 0.75) continue;
				cars.push({ l, u: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, v: 0, vmax: 8 + Math.random() * 5, kind: kinds[Math.floor(Math.random() * kinds.length)], col: PAINT[Math.floor(Math.random() * PAINT.length)], wait: 0 });
			}
		}
	}
	const cars = [];

	function update(dt, t, cam, nightK) {
		if (!bay.loaded()) return;
		night.value = nightK;
		const high = cam.position.y - groundAt(cam.position.x, cam.position.z) > 450;
		group.visible = !high;
		if (high) return;
		const x = cam.position.x, z = cam.position.z;
		if (Math.hypot(x - lastX, z - lastZ) > 120) { lastX = x; lastZ = z; build(x, z); }
		lampLights.material.opacity = nightK;
		// signals cycle green, amber, red
		const sc2 = sigGeo.attributes.color.array;
		signalList.slice(0, 300).forEach((s, k) => { const c = ((t + s.ph) % 60) / 60; const [r, g, b] = c < 0.45 ? [0.1, 1, 0.4] : c < 0.52 ? [1, 0.7, 0.05] : [1, 0.08, 0.05]; sc2.set([r, g, b], k * 3); });
		sigGeo.attributes.color.needsUpdate = true;
		// traffic: along the lane, easing to a stop near the far end, then a new lane
		const counts = Object.fromEntries(kinds.map((k) => [k, 0]));
		for (const c of cars) {
			const l = c.l, L = Math.hypot(l.x1 - l.x0, l.z1 - l.z0) || 1;
			const toEnd = c.dir > 0 ? (1 - c.u) * L : c.u * L;
			const target = toEnd < 12 ? Math.max(0, (toEnd - 3) * 0.8) : c.vmax;
			c.v += (target - c.v) * Math.min(1, dt * 1.2);
			if (toEnd < 3.5) { c.wait += dt; if (c.wait > 1.5 + Math.random()) { c.wait = 0; c.dir = -c.dir; c.u = c.dir > 0 ? 0.02 : 0.98; } }
			c.u = Math.min(1, Math.max(0, c.u + c.dir * c.v * dt / L));
			const dx = (l.x1 - l.x0) / L, dz = (l.z1 - l.z0) / L, off = c.dir > 0 ? -1.8 : 1.8;
			const px = l.x0 + (l.x1 - l.x0) * c.u + dz * off, pz = l.z0 + (l.z1 - l.z0) * c.u - dx * off;
			c.px = px; c.pz = pz; c.vx = dx * c.dir * c.v; c.vz = dz * c.dir * c.v;      // for the street sound
			const im = moving[c.kind], k = counts[c.kind]++;
			if (k >= im.instanceMatrix.count) continue;
			put(im, k, px, groundAt(px, pz), pz, Math.atan2(dx * c.dir, dz * c.dir));
			im.setColorAt(k, col.setRGB(c.col[0], c.col[1], c.col[2]));
		}
		for (const k of kinds) { const im = moving[k]; im.count = counts[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
	}
	return { update, group, cars };
}
