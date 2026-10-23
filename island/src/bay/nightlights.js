// The evening's lights outside, engine-wide: porch lights and the lights over the garages,
// path lights down the front walks, the cheap solar stakes along the beds, uplights under the
// front yards' and the parks' trees (the trunk and the canopy lit from below, not the whole
// tree), and the uplights washing the fronts of the civic buildings, the offices, towers,
// some shops and the nicer houses. Who has what, and when it is on, is nightplan.js: the same
// household the same every visit, on at dusk by its own photocell or timer, off at its own
// hour, the solar ones fading through the night, the motion lights waking as you pass.
//
// Cheap by design. Three draws: every lamp a point (its glow, never smaller than a pixel and
// a half, so a street of porch lights far off is a string of small points), every pool of
// light a quad (the ground under a lamp, the cone up a wall from an uplight; additive, drawn
// once and switched in the shader by the hour), all filled when the city round you is rebuilt
// and left alone in between. Close by, the nearest few lamps also light the trees and the
// houses' walls they fall on (world/nightfield.js). The far houses' own porch and garage
// lights are drawn by the city's shader from the same plan (city.js). No allocation a frame.

import * as THREE from 'three';
import { NIGHT_U, NIGHT_I, COLOURS, K, nightSeed, roll, housePlan, buildingPlan, doorAcross, lateHour, lampLevel, solarLevel, motionLevel, ALL_NIGHT } from './nightplan.js';
import { NF, NF_N, FIELDS, SF_N } from '../world/nightfield.js';
import { qualityNow, onQuality } from '../world/governor.js';
import { LAMP, LAMP_KINDS } from './streetlamps.js';
import { LOTS } from './siteplan.js';
import { CANOPY, CANOPY_LIGHTS } from './forecourts.js';

const HOUSE = new Set([K.row, K.house, K.bay, K.houseGarageL, K.houseGarageR]);
const MOTION = 8;
const WARM = [1, 0.8, 0.56], COOL = [0.82, 0.88, 1], SOLAR = COLOURS[3], SODIUM_PACK = [1, 0.5, 0.16];

// the shared switch: a lamp's level by its schedule (x kind: 0 a lamp, 1 solar, 2 motion;
// y the night it comes on at; z its late hour off; w the solar charge or the motion slot)
const LEVEL = /* glsl */`
	uniform vec2 uNL;
	uniform float uMotion[${MOTION}];
	float lev(vec4 s) {
		if (s.x < 0.5) {
			float up = smoothstep(s.y, s.y + 0.12, uNL.y);
			return up * (s.z > 30.5 ? 1.0 : 1.0 - smoothstep(s.z, s.z + 0.08, uNL.x));
		}
		if (s.x < 1.5) {
			float up = smoothstep(0.45, 0.65, uNL.y), t = max(0.0, uNL.x - 19.0), life = 2.5 + s.w * 9.0;
			return up * (0.35 + 0.65 * s.w) * pow(max(0.0, 1.0 - t / life), 0.7);
		}
		int k = int(s.w + 0.5);
		float m = 0.0;
		for (int i = 0; i < ${MOTION}; i++) if (i == k) m = uMotion[i];
		return m;
	}`;

const POINT_VS = /* glsl */`
	attribute vec3 aCol; attribute vec2 aSize; attribute vec4 aSched;
	uniform float uScale, uFar;
	varying vec3 vCol;
	${LEVEL}
	void main() {
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		float d = -mv.z, L = lev(aSched);
		// (a lamp's glow far off: never less than a pixel and a half; a canopy's soft light
		// only once the lamp no longer lights the tree itself, close by)
		float near = aSize.y > 0.0 ? smoothstep(aSize.y, aSize.y * 1.6, d) : 1.0;
		float px = aSize.x * uScale / max(d, 0.1);
		float a = L * near * (1.0 - smoothstep(uFar * 0.7, uFar, d));
		vCol = aCol * a * clamp(px / 1.5, 0.3, 1.0);
		gl_PointSize = max(1.5, px);
		gl_Position = a > 0.002 && d > 0.05 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
	}`;
const POINT_FS = /* glsl */`
	uniform float uExpo;
	varying vec3 vCol;
	void main() {
		vec2 q = gl_PointCoord - 0.5;
		float r2 = dot(q, q) * 4.0;
		if (r2 > 1.0) discard;
		float a = exp(-r2 * 9.0) * 1.3 + exp(-r2 * 2.5) * 0.18;
		gl_FragColor = vec4(vCol * a * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;
// the pools: x across and y up (metres) from the lamp's foot on a wall, or the radius 0..1 on
// the ground; shape 0 the ground under a lamp, 1 the cone up a wall from an uplight
const POOL_VS = /* glsl */`
	attribute vec2 aUV; attribute vec3 aCol; attribute vec4 aSched; attribute float aShape;
	uniform float uFar;
	varying vec2 vUV; varying vec3 vCol; varying float vShape;
	${LEVEL}
	void main() {
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		float d = -mv.z, L = lev(aSched);
		float a = L * (1.0 - smoothstep(uFar * (aShape > 0.5 ? 0.7 : 0.25), uFar * (aShape > 0.5 ? 1.0 : 0.4), d));
		vUV = aUV; vCol = aCol * a; vShape = aShape;
		gl_Position = a > 0.002 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
	}`;
const POOL_FS = /* glsl */`
	uniform float uExpo;
	varying vec2 vUV; varying vec3 vCol; varying float vShape;
	void main() {
		float e;
		if (vShape < 0.5) {
			// a lamp's light on the ground: brightest under it, falling off as the cosine and
			// the distance do, to nothing at the quad's edge
			float r = length(vUV);
			e = pow(1.0 + 6.25 * r * r, -1.5) * (1.0 - smoothstep(0.7, 1.0, r));
		} else {
			// an uplight's cone up a wall: from a hot spot just above the lamp, widening as it
			// climbs, fading with height
			float y = max(vUV.y, 0.0), w = 0.3 + y * 0.3, H = vShape - 1.0;
			float lat = exp(-vUV.x * vUV.x / (w * w) * 1.6) * 0.6 / (w + 0.3);
			e = lat * (1.0 - exp(-y * 1.5)) / (1.0 + y * y * 0.025) * (1.0 - smoothstep(H * 0.6, H, y));
		}
		if (e < 0.002) discard;
		gl_FragColor = vec4(vCol * e * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;

export function createNightLights(scene, city, { isPhone = false, ground = () => 0, world = () => null } = {}) {
	const CAP_P = isPhone ? 5000 : 16000, CAP_Q = isPhone ? 2500 : 9000, CAP_F = isPhone ? 200 : 600, CAP_S = 1200;
	const R0 = isPhone ? 220 : 420;
	// ---- the points
	const pPos = new Float32Array(CAP_P * 3), pCol = new Float32Array(CAP_P * 3), pSize = new Float32Array(CAP_P * 2), pSch = new Float32Array(CAP_P * 4);
	const pGeo = new THREE.BufferGeometry();
	pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
	pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3));
	pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 2));
	pGeo.setAttribute('aSched', new THREE.BufferAttribute(pSch, 4));
	pGeo.setDrawRange(0, 0);
	const motionU = { value: new Float32Array(MOTION) };
	const U = { uNL: NIGHT_U.uNL, uMotion: motionU, uScale: { value: 400 }, uFar: { value: R0 }, uExpo: { value: 1 } };
	const pMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
	const points = new THREE.Points(pGeo, pMat);
	points.frustumCulled = false; points.visible = false; points.name = 'night-lights'; points.renderOrder = 6;
	// ---- the pools
	const qPos = new Float32Array(CAP_Q * 12), qUV = new Float32Array(CAP_Q * 8), qCol = new Float32Array(CAP_Q * 12), qSch = new Float32Array(CAP_Q * 16), qShape = new Float32Array(CAP_Q * 4);
	const qIdx = new Uint32Array(CAP_Q * 6);
	for (let i = 0; i < CAP_Q; i++) qIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
	const qGeo = new THREE.BufferGeometry();
	qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3));
	qGeo.setAttribute('aUV', new THREE.BufferAttribute(qUV, 2));
	qGeo.setAttribute('aCol', new THREE.BufferAttribute(qCol, 3));
	qGeo.setAttribute('aSched', new THREE.BufferAttribute(qSch, 4));
	qGeo.setAttribute('aShape', new THREE.BufferAttribute(qShape, 1));
	qGeo.setIndex(new THREE.BufferAttribute(qIdx, 1));
	qGeo.setDrawRange(0, 0);
	const qMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: POOL_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
	const pools = new THREE.Mesh(qGeo, qMat);
	pools.frustumCulled = false; pools.visible = false; pools.name = 'night-pools'; pools.renderOrder = 3;
	scene.add(pools, points);
	const tmpV = new THREE.Vector2();
	points.onBeforeRender = (r, sc, cam) => { U.uScale.value = r.getSize(tmpV).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)); U.uExpo.value = r.toneMappingExposure * 0.85; };
	// ---- the lamps near enough to light the trees and walls (world/nightfield.js)
	// [x, y, z, reach, r, g, b, cosOuter, dx, dy, dz, cosInner, kind, onK, off, charge/slot]
	const F = new Float32Array(CAP_F * 16);
	const motionAt = new Float32Array(MOTION * 3), motionSince = new Float32Array(MOTION).fill(1e9);

	let np = 0, nq = 0, nf = 0, nm = 0, seen = null, atX = 1e9, atZ = 1e9, R = R0, stats = { houses: 0, washed: 0, trees: 0, civic: 0, murals: 0, lobbies: 0 };
	const offQuality = onQuality(() => { seen = null; });
	const sched = (A, i, kind, onK, off, w) => { A[i] = kind; A[i + 1] = onK; A[i + 2] = off; A[i + 3] = w; };
	function point(x, y, z, c, k, size, kind, onK, off, w, fadeNear = 0) {
		if (np >= CAP_P) return;
		pPos[np * 3] = x; pPos[np * 3 + 1] = y; pPos[np * 3 + 2] = z;
		pCol[np * 3] = c[0] * k; pCol[np * 3 + 1] = c[1] * k; pCol[np * 3 + 2] = c[2] * k;
		pSize[np * 2] = size; pSize[np * 2 + 1] = fadeNear;
		sched(pSch, np * 4, kind, onK, off, w);
		np++;
	}
	// a quad from its centre and two half-axes, its corners' (u, v)
	function quad(cx, cy, cz, ax, ay, az, bx, by, bz, u0, v0, u1, v1, c, k, shape, kind, onK, off, w) {
		if (nq >= CAP_Q) return;
		const P = qPos, o = nq * 12;
		P[o] = cx - ax - bx; P[o + 1] = cy - ay - by; P[o + 2] = cz - az - bz;
		P[o + 3] = cx + ax - bx; P[o + 4] = cy + ay - by; P[o + 5] = cz + az - bz;
		P[o + 6] = cx + ax + bx; P[o + 7] = cy + ay + by; P[o + 8] = cz + az + bz;
		P[o + 9] = cx - ax + bx; P[o + 10] = cy - ay + by; P[o + 11] = cz - az + bz;
		qUV.set([u0, v0, u1, v0, u1, v1, u0, v1], nq * 8);
		for (let j = 0; j < 4; j++) { qCol[o + j * 3] = c[0] * k; qCol[o + j * 3 + 1] = c[1] * k; qCol[o + j * 3 + 2] = c[2] * k; sched(qSch, nq * 16 + j * 4, kind, onK, off, w); qShape[nq * 4 + j] = shape; }
		nq++;
	}
	// a lamp's light on the ground: centred at (x, z), r across, from a lamp h above it
	function groundPool(x, z, r, h, I, c, kind, onK, off, w) {
		const y = ground(x, z) + 0.05;
		// (the light on the ground: I over h squared, times about a quarter for what pavement and
		// lawn give back, over pi)
		quad(x, y, z, r, 0, 0, 0, 0, r, -1, -1, 1, 1, c, I / (h * h) * 0.08, 0, kind, onK, off, w);
	}
	// an uplight's cone up a wall: its foot at (x, z) on the face, the face's outward normal
	// (nx, nz), H high
	function wash(x, z, nx, nz, y0, H, I, c, onK, off) {
		const tx = -nz, tz = nx, W = 0.3 + H * 0.3 + 0.6;
		const lift = 0.06;
		quad(x + nx * lift, y0 + H / 2, z + nz * lift, tx * W, 0, tz * W, 0, H / 2, 0, -W, 0, W, H, c, I * 0.06, 1 + H, 0, onK, off, 0);
	}
	// a lamp's cone down a wall from above (a gooseneck over a mural): its top at (x, top, z)
	function downWash(x, z, nx, nz, top, H, I, c, onK, off) {
		const tx = -nz, tz = nx, W = 0.3 + H * 0.3 + 0.6, lift = 0.07;
		quad(x + nx * lift, top - H / 2, z + nz * lift, tx * W, 0, tz * W, 0, H / 2, 0, -W, H, W, 0, c, I * 0.06, 1 + H, 0, onK, off, 0);
	}
	function field(x, y, z, reach, c, I, cosO, dx, dy, dz, cosI, kind, onK, off, w) {
		if (nf >= CAP_F) return;
		F.set([x, y, z, reach, c[0] * I, c[1] * I, c[2] * I, cosO, dx, dy, dz, cosI, kind, onK, off, w], nf * 16);
		nf++;
	}
	// ---- one household
	function house(o, d, trees) {
		const P = housePlan(o, nightSeed(o.x, o.z));
		if (!P.porch && !P.path && !P.solar && !P.garage && !P.motion && !P.tree && !P.wash) return;
		stats.houses++;
		const Fz = o.fit, ox = Fz ? Fz[0] : o.x, oz = Fz ? Fz[1] : o.z, w = Fz ? Fz[2] : o.w, dd = Fz ? Fz[3] : o.d;
		const ca = Math.cos(o.a), sa = Math.sin(o.a), nx = -sa, nz = ca;
		const W = (lx, lz) => { tw[0] = ox + ca * lx - sa * lz; tw[1] = oz + sa * lx + ca * lz; return tw; };
		const floor = o.y + 1.2, base = Math.floor(o.kind);
		const across = doorAcross({ kind: o.kind, w });
		const near = d < 150;
		// the porch light: by the door (over it, up a row house's steps), its pool on the step
		if (P.porch && (base === K.row ? o.kind > 0.05 : across != null)) {
			const left = o.kind <= 0.15;
			const lx = base === K.row ? (left ? w / 2 - 1.1 : -w / 2 + 1.1) : across - w / 2 + P.side * 0.78;
			const ly = base === K.row ? floor + 3.25 : floor + 1.95;
			const c = COLOURS[P.porchCol];
			W(lx, dd / 2 + 0.14);
			point(tw[0], ly, tw[1], c, 2.4, 0.32, 0, P.onK, P.porch, 0);
			field(tw[0], ly, tw[1], 9, c, NIGHT_I.porch, -2, 0, 0, 0, 0, 0, P.onK, P.porch, 0);
			if (near && base !== K.row) { W(across - w / 2, dd / 2 + 1.1); if (!onRoad(tw[0], tw[1])) groundPool(tw[0], tw[1], 4.2, 1.9, NIGHT_I.porch, c, 0, P.onK, P.porch, 0); }
		}
		if (across == null) return;
		const dx = across - w / 2;
		// path lights down the walk, side to side
		if (P.path && near) {
			const L = o.src ? 4 : 6.5;
			for (let i = 0; i < P.path; i++) {
				const z = dd / 2 + 1.6 + (L - 1.6) * (P.path > 1 ? i / (P.path - 1) : 0), s = i % 2 ? 1 : -1;
				W(dx + s * 0.85, z);
				if (onRoad(tw[0], tw[1])) break;
				const g = ground(tw[0], tw[1]);
				point(tw[0], g + 0.45, tw[1], WARM, 1.2, 0.12, 0, P.onK, P.pathOff, 0);
				groundPool(tw[0], tw[1], 1.4, 0.5, NIGHT_I.path, WARM, 0, P.onK, P.pathOff, 0);
			}
		}
		// solar stakes along the bed in front of the house, the side away from the drive
		if (P.solar && near) {
			const side = across < w / 2 ? 1 : -1, from = dx + side * 1.2, to = side > 0 ? w / 2 - 0.5 : -w / 2 + 0.5;
			const n = Math.min(P.solar, Math.max(1, Math.floor(Math.abs(to - from) / 1.2) + 1));
			for (let i = 0; i < n; i++) {
				W(from + (to - from) * (n > 1 ? i / (n - 1) : 0.5), dd / 2 + 0.9 + (i % 2) * 0.15);
				if (onRoad(tw[0], tw[1])) continue;
				const g = ground(tw[0], tw[1]);
				point(tw[0], g + 0.32, tw[1], SOLAR, 0.9, 0.07, 1, 0, 0, P.charge);
				groundPool(tw[0], tw[1], 0.5, 0.3, NIGHT_I.solar, SOLAR, 1, 0, 0, P.charge);
			}
		}
		// the light over the garage doors (or a motion light there)
		if ((P.garage || P.motion) && (base === K.houseGarageL || base === K.houseGarageR || base === K.garage)) {
			const gcx = base === K.garage ? 0 : (base === K.houseGarageL ? 0.35 : w - 5.75) + 2.85 - w / 2;
			W(gcx, dd / 2 + 0.16);
			const lx = tw[0], lz = tw[1], ly = floor + 2.5;
			let kind = 0, slot = 0;
			// (a motion light: only the nearest few can wake, the slots the shader reads)
			if (P.motion && nm < MOTION && d < 70) { kind = 2; slot = nm; motionAt[nm * 3] = lx; motionAt[nm * 3 + 1] = ly; motionAt[nm * 3 + 2] = lz; motionSince[nm] = 1e9; nm++; }
			if (kind || P.garage) {
				const c = kind ? COOL : WARM, off = P.garage || ALL_NIGHT;
				point(lx, ly, lz, c, 2.6, 0.3, kind, P.onK, off, slot);
				field(lx, ly, lz, 12, c, NIGHT_I.garage, -2, 0, 0, 0, 0, kind, P.onK, off, slot);
				if (near) { W(gcx, dd / 2 + 2.8); groundPool(tw[0], tw[1], 5.5, 2.6, NIGHT_I.garage, c, kind, P.onK, off, slot); }
			}
		}
		// the front yard's tree lit from below: the lamp a little out from the trunk, aimed up it
		if (P.tree && trees) {
			W(0, dd / 2 + 4);
			const t = nearestTree(trees, tw[0], tw[1], 9);
			if (t) {
				const tx = t.x + nx * 1.2, tz = t.z + nz * 1.2, g = ground(tx, tz);
				treeLight(t, tx, g, tz, P.onK, P.tree);
			}
		}
		// the front wall washed by uplights at its corners (and the middle, on a wide one)
		if (P.wash) {
			const H = Math.min(o.h - 1.2, 8);
			for (let i = 0; i < P.wash; i++) {
				const lx = P.wash === 3 && i === 2 ? (dx < 0 ? w / 4 : -w / 4) : (i ? 1 : -1) * (w / 2 - 1.0);
				if (Math.abs(lx - dx) < 1.4) continue;
				W(lx, dd / 2);
				const g = ground(tw[0], tw[1]);
				wash(tw[0], tw[1], nx, nz, g, H, NIGHT_I.wash * 0.8, WARM, P.onK, P.washOff);
				W(lx, dd / 2 + 0.5);
				point(tw[0], g + 0.08, tw[1], WARM, 1.1, 0.12, 0, P.onK, P.washOff, 0);
			}
		}
	}
	const tw = [0, 0];
	// (the first few trees lit, for looking round: spots())
	const treeSpots = new Float32Array(8 * 4);
	function treeLight(t, x, y, z, onK, off) {
		if (stats.trees < 8) treeSpots.set([t.x, t.y, t.z, t.h || 8], stats.trees * 4);
		stats.trees++;
		const H = t.h || 8, top = t.y + H * 0.45;
		let dx = t.x - x, dy = top - y, dz = t.z - z;
		const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
		point(x, y + 0.08, z, WARM, 1.6, 0.14, 0, onK, off, 0);
		groundPool(x, z, 0.9, 0.35, NIGHT_I.tree * 0.01, WARM, 0, onK, off, 0);
		field(x, y + 0.1, z, Math.max(12, H * 1.4), WARM, NIGHT_I.tree, Math.cos(0.85), dx, dy, dz, Math.cos(0.4), 0, onK, off, 0);
		// far off, the canopy's soft light where the lamp no longer lights the tree itself
		point(t.x, t.y + H * 0.45, t.z, WARM, 0.06, H * 0.5, 0, onK, off, 0, 55);
	}
	function nearestTree(trees, x, z, r) {
		let best = null, bd = r * r;
		const gi = Math.floor(x / 16), gj = Math.floor(z / 16);
		for (let j = gj - 1; j <= gj + 1; j++) for (let i = gi - 1; i <= gi + 1; i++) {
			const l = trees.get(i * 73856093 ^ j * 19349663);
			if (!l) continue;
			for (const t of l) { const q = (t.x - x) ** 2 + (t.z - z) ** 2; if (q < bd && !t.used) { bd = q; best = t; } }
		}
		if (best) best.used = true;
		return best;
	}
	// ---- a building that is not a house: its front washed by uplights from the ground
	function building(o, P, civic) {
		const Fz = o.fit, ox = Fz ? Fz[0] : o.x, oz = Fz ? Fz[1] : o.z, w = Fz ? Fz[2] : (o.W || o.w), dd = Fz ? Fz[3] : (o.D || o.d);
		const ca = Math.cos(o.a || 0), sa = Math.sin(o.a || 0);
		const H = Math.min(Math.max(3, (o.h || 8) - (civic ? 0 : 1.2)), civic ? 16 : 14);
		const c = P.washCol ? COOL : WARM;
		stats.washed++;
		// the faces: the front (local +z), and round a tower all four
		const faces = P.sides === 4 ? 4 : 1;
		for (let f = 0; f < faces; f++) {
			const lw = f % 2 ? dd : w, ld = f % 2 ? w : dd;
			const fa = f * Math.PI / 2, fc = Math.cos(fa), fs = Math.sin(fa);
			// the face's frame: across it (tx, tz) and out of it (nx, nz), in the world
			const lnx = -fs, lnz = fc;
			const nx = ca * lnx - sa * lnz, nz = sa * lnx + ca * lnz;
			const tx = -nz, tz = nx;
			const cx = ox + nx * ld / 2, cz = oz + nz * ld / 2;
			const n = Math.max(1, Math.floor((lw - 1.5) / P.wash));
			for (let i = 0; i < n; i++) {
				const u = (i + 0.5) / n * lw - lw / 2;
				const x = cx + tx * u, z = cz + tz * u, g = ground(x, z);
				wash(x, z, nx, nz, g, H, NIGHT_I.wash, c, P.onK, P.washOff);
				point(x + nx * 0.6, g + 0.1, z + nz * 0.6, c, 1.2, 0.16, 0, P.onK, P.washOff, 0);
			}
		}
	}
	function lobby(o) {
		const ca = Math.cos(o.a || 0), sa = Math.sin(o.a || 0), w = o.w, dd = o.d;
		for (let f = 0; f < 4; f++) {
			const lnx = f === 1 ? 1 : f === 3 ? -1 : 0, lnz = f === 0 ? 1 : f === 2 ? -1 : 0, half = lnx ? w / 2 : dd / 2, span = lnx ? dd : w;
			const x = o.x + ca * lnx * (half + 2.2) - sa * lnz * (half + 2.2), z = o.z + sa * lnx * (half + 2.2) + ca * lnz * (half + 2.2);
			if (onRoad(x, z)) continue;
			const r = Math.min(9, Math.max(4.5, span * 0.3));
			groundPool(x, z, r, 2.6, 4, WARM, 0, 0.2, ALL_NIGHT, 0);
			stats.lobbies++;
		}
	}
	// a gas station's canopy lights over its pumps, and the lamps over a food mart's or a corner
	// store's front (bay/siteplan.js, forecourts.js): on from early dusk, all night
	function site(S) {
		const ca = Math.cos(S.a), sa = Math.sin(S.a), Wp = (lx, lz) => [S.x + ca * lx - sa * lz, S.z + sa * lx + ca * lz];
		if (S.kind === 'fuel') {
			let top = -1e9;
			for (const [lx, lz] of [[CANOPY.x0, CANOPY.z0], [CANOPY.x1, CANOPY.z0], [CANOPY.x0, CANOPY.z1], [CANOPY.x1, CANOPY.z1], [0, 9]]) { const [x, z] = Wp(lx, lz); top = Math.max(top, ground(x, z)); }
			const y = top + CANOPY.under - 0.05;
			for (const lx of CANOPY_LIGHTS.x) for (const lz of CANOPY_LIGHTS.z) {
				const [x, z] = Wp(lx, lz);
				groundPool(x, z, 5.6, CANOPY.under, 46, COOL, 0, 0.12, ALL_NIGHT, 0);
				point(x, y, z, COOL, 1.6, 0.5, 0, 0.12, ALL_NIGHT, 0);
			}
			for (const lx of [-8, 8]) { const [x, z] = Wp(lx, 9); field(x, y, z, 16, COOL, 40, Math.cos(1.25), 0, -1, 0, Math.cos(0.7), 0, 0.12, ALL_NIGHT, 0); }
			// (the mart's windows on its walk, the price sign on its planter)
			const st = LOTS.fuel.store, [mx, mz] = Wp(st.x * S.side, st.z + st.d / 2 + 2);
			groundPool(mx, mz, 7, 3, 7, COOL, 0, 0.12, ALL_NIGHT, 0);
			const [px, pz] = Wp(19.3 * S.side, 16.6);
			groundPool(px, pz, 3.2, 3.5, 6, [1, 0.55, 0.4], 0, 0.12, ALL_NIGHT, 0);
		} else {
			const st = LOTS.corner.store, front = st.z + st.d / 2;
			for (const dx of [-5, 5]) {
				const [x, z] = Wp((st.x + dx) * S.side, front + 0.4), [gx, gz] = Wp((st.x + dx) * S.side, front + 3), y = ground(x, z) + 3.5;
				groundPool(gx, gz, 6, 3.5, 9, WARM, 0, 0.12, ALL_NIGHT, 0);
				point(x, y, z, WARM, 1.4, 0.3, 0, 0.12, ALL_NIGHT, 0);
				field(x, y, z, 12, WARM, 10, Math.cos(1.2), -sa * 0.8, -0.6, ca * 0.8, Math.cos(0.6), 0, 0.12, ALL_NIGHT, 0);
			}
		}
	}
	// the streets round you, by 20 m cells: no path light or solar stake out in the road
	let roadCells = new Map();
	function onRoad(x, z) {
		const l = roadCells.get(Math.floor(x / 20) * 73856093 ^ Math.floor(z / 20) * 19349663);
		if (!l) return false;
		for (let i = 0; i < l.length; i += 5) {
			const ax = l[i], az = l[i + 1], dx = l[i + 2] - ax, dz = l[i + 3] - az, l2 = dx * dx + dz * dz || 1;
			const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
			if (Math.hypot(x - ax - dx * t, z - az - dz * t) < l[i + 4]) return true;
		}
		return false;
	}
	function roadsNear(cx, cz, r) {
		roadCells = new Map();
		for (const q of world()?.real?.near?.('roads', cx, cz, r) || []) {
			const p = q.pts, half = (q.w || 6) / 2 + 1.2;
			if (!p || q.bridge) continue;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const x0 = Math.min(p[i], p[i + 2]) - half, x1 = Math.max(p[i], p[i + 2]) + half, z0 = Math.min(p[i + 1], p[i + 3]) - half, z1 = Math.max(p[i + 1], p[i + 3]) + half;
				for (let gx = Math.floor(x0 / 20); gx <= Math.floor(x1 / 20); gx++) for (let gz = Math.floor(z0 / 20); gz <= Math.floor(z1 / 20); gz++) {
					const k = gx * 73856093 ^ gz * 19349663;
					let l = roadCells.get(k); if (!l) roadCells.set(k, l = []);
					l.push(p[i], p[i + 1], p[i + 2], p[i + 3], half);
				}
			}
		}
	}
	function build(cx, cz) {
		atX = cx; atZ = cz; np = 0; nq = 0; nf = 0; nm = 0;
		stats = { houses: 0, washed: 0, trees: 0, civic: 0, murals: 0, lobbies: 0 };
		R = R0 * (qualityNow()?.far ?? 1);
		roadsNear(cx, cz, 160);
		// the trees round you, by 16 m cells (for the front yards' and the parks' uplights)
		const trees = new Map();
		for (const t of city.treesAt?.(cx, cz, R * 0.5) || []) {
			if (t.shrub || t.fern || t.h < 3) continue;
			t.used = false;
			const k = Math.floor(t.x / 16) * 73856093 ^ Math.floor(t.z / 16) * 19349663;
			let l = trees.get(k); if (!l) trees.set(k, l = []); l.push(t);
		}
		const list = city.nearList?.() || [];
		for (const o of list) {
			const d = Math.hypot(o.x - cx, o.z - cz);
			if (d > R) continue;
			const base = Math.floor(o.kind);
			if (HOUSE.has(base) || base === K.garage) { house(o, d, d < R * 0.5 ? trees : null); continue; }
			if (o.h < 4) continue;
			// a tower's lobby, lit all night (city.js), spills its light on the sidewalk in front of each face
			if (base === K.tower && o.h > 20 && d < R * 0.7) lobby(o);
			const P = buildingPlan(o, nightSeed(o.x, o.z));
			if (P.wash) building(o, P, false);
		}
		// the civic buildings: the stations, hospitals and armories (services/), lit all night
		for (const S of world()?.services?.list?.() || []) {
			const d = Math.hypot(S.x - cx, S.z - cz);
			if (d > R) continue;
			const P = buildingPlan({ kind: K.office, w: S.W, d: S.D, h: 9 }, nightSeed(S.x, S.z), true);
			building({ x: S.x, z: S.z, a: S.a, W: S.W, D: S.D, h: (S.blockTop && S.f0 ? S.blockTop - S.f0 : 9) }, P, true);
			stats.civic++;
		}
		// the gas stations and the corner stores
		for (const S of world()?.real?.sites?.(cx, cz, R) || []) site(S);
		// a few of the downtown street trees and the parks' trees lit from below too
		for (const l of trees.values()) for (const t of l) {
			if (t.used || Math.hypot(t.x - cx, t.z - cz) > R * 0.5) continue;
			const r = roll(nightSeed(t.x, t.z), 50);
			if (!((t.src === 'street' && t.well && r < 0.22) || (t.src === 'real' && r < 0.05))) continue;
			const a = r * 40, x = t.x + Math.cos(a) * 1.1, z = t.z + Math.sin(a) * 1.1;
			treeLight(t, x, ground(x, z), z, 0.3, t.src === 'street' ? 25 + r * 8 : 23.5);
		}
		// the murals and the big graffiti pieces: a gooseneck lamp over a mural, a sodium wall pack
		// over a piece on a warehouse wall, each washing its picture from above
		for (const m of world()?.signage?.murals?.() || []) {
			if (Math.hypot(m.x - cx, m.z - cz) > R * 0.6) continue;
			const g = m.base ?? ground(m.x, m.z), top = g + m.hy + m.h / 2 + 0.55, c = m.mural ? WARM : SODIUM_PACK;
			const n = m.mural && m.w > 6 ? 2 : 1;
			for (let i = 0; i < n; i++) {
				const u = n > 1 ? (i ? 0.25 : -0.25) * m.w : 0, x = m.x - m.nz * u, z = m.z + m.nx * u;
				downWash(x, z, m.nx, m.nz, top, m.h + 1.2, NIGHT_I.wash * (m.mural ? 0.9 : 0.7), c, 0.25, ALL_NIGHT);
				point(x + m.nx * 0.45, top + 0.05, z + m.nz * 0.45, c, 1.3, 0.14, 0, 0.25, ALL_NIGHT, 0);
				stats.murals++;
			}
		}
		pGeo.setDrawRange(0, np);
		for (const k of ['position', 'aCol', 'aSize', 'aSched']) { const A = pGeo.attributes[k]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, np) * A.itemSize); A.needsUpdate = true; }
		qGeo.setDrawRange(0, nq * 6);
		for (const k of ['position', 'aUV', 'aCol', 'aSched', 'aShape']) { const A = qGeo.attributes[k]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, nq * 4) * A.itemSize); A.needsUpdate = true; }
		lastPick = -1;
	}
	// ---- the nearest lamps to the field, a few times a second (no allocation)
	let lastPick = -1, clock = 0, hoursNow = 12, nightNow = 0;
	const level = (o) => {
		const kind = F[o + 12];
		if (kind === 0) return lampLevel(F[o + 13], F[o + 14], hoursNow, nightNow);
		if (kind === 1) return solarLevel(F[o + 15], hoursNow, nightNow);
		return motionU.value[F[o + 15] | 0];
	};
	const chosen = new Int32Array(NF_N), score = new Float32Array(CAP_F), sScore = new Float32Array(CAP_S);
	// (and the street lamps near you: streetlife.js and streetlamps.js, the same strength as their pools)
	function pick(cam) {
		const P = NF.uNFP.value, C = NF.uNFC.value, D = NF.uNFD.value;
		const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, FAR = isPhone ? 50 : 80;
		for (let i = 0; i < nf; i++) {
			const o = i * 16, dd = Math.hypot(F[o] - cx, F[o + 1] - cy, F[o + 2] - cz);
			score[i] = dd < FAR && level(o) > 0.01 ? dd : 1e9;
		}
		const SL = world()?.street?.lamps?.(), ns = SL && SL.on > 0.01 ? Math.min(SL.n, CAP_S) : 0, SP = SL?.pos;
		for (let i = 0; i < ns; i++) { const dd = Math.hypot(SP[i * 3] - cx, SP[i * 3 + 1] - cy, SP[i * 3 + 2] - cz); sScore[i] = dd < FAR ? dd : 1e9; }
		// (your headlights, while you drive, keep the first place: written every frame in update())
		const h0 = head && head.on > 0.01 ? 1 : 0;
		let n = h0;
		for (; n < NF_N; n++) {
			let best = -1, bd = 1e8, street = false;
			for (let i = 0; i < nf; i++) if (score[i] < bd) { bd = score[i]; best = i; }
			for (let i = 0; i < ns; i++) if (sScore[i] < bd) { bd = sScore[i]; best = i; street = true; }
			if (best < 0) break;
			if (street) {
				sScore[best] = 1e9; chosen[n] = -1 - best;
				const L = LAMP[LAMP_KINDS[SL.kind[best]]] || LAMP.cobra, k = L.I * SL.on * (1 - smooth(FAR * 0.7, FAR, bd)), o = best * 3;
				P[n * 4] = SP[o]; P[n * 4 + 1] = SP[o + 1]; P[n * 4 + 2] = SP[o + 2]; P[n * 4 + 3] = L.h * 3.4;
				C[n * 4] = SL.col[o] * k; C[n * 4 + 1] = SL.col[o + 1] * k; C[n * 4 + 2] = SL.col[o + 2] * k;
				// (a cobra or LED head throws down and out, nothing up; an acorn all round)
				C[n * 4 + 3] = L.k === 2 ? -2 : 0.02;
				D[n * 4] = 0; D[n * 4 + 1] = -1; D[n * 4 + 2] = 0; D[n * 4 + 3] = 0.55;
				continue;
			}
			score[best] = 1e9; chosen[n] = best;
			const o = best * 16, fade = level(o) * (1 - smooth(FAR * 0.7, FAR, bd));
			P[n * 4] = F[o]; P[n * 4 + 1] = F[o + 1]; P[n * 4 + 2] = F[o + 2]; P[n * 4 + 3] = F[o + 3];
			C[n * 4] = F[o + 4] * fade; C[n * 4 + 1] = F[o + 5] * fade; C[n * 4 + 2] = F[o + 6] * fade; C[n * 4 + 3] = F[o + 7];
			D[n * 4] = F[o + 8]; D[n * 4 + 1] = F[o + 9]; D[n * 4 + 2] = F[o + 10]; D[n * 4 + 3] = F[o + 11];
		}
		NF.uNFn.value = n;
		// the city's own buildings take the street lamps alone (their porch lights are their own)
		const SFd = FIELDS.SF, SPp = SFd.P.value, SPc = SFd.C.value, SPd = SFd.D.value;
		for (let i = 0; i < ns; i++) { const dd = Math.hypot(SP[i * 3] - cx, SP[i * 3 + 1] - cy, SP[i * 3 + 2] - cz); sScore[i] = dd < FAR ? dd : 1e9; }
		let m = h0;
		for (; m < SF_N; m++) {
			let best = -1, bd = 1e8;
			for (let i = 0; i < ns; i++) if (sScore[i] < bd) { bd = sScore[i]; best = i; }
			if (best < 0) break;
			sScore[best] = 1e9;
			const L = LAMP[LAMP_KINDS[SL.kind[best]]] || LAMP.cobra, k = L.I * SL.on * (1 - smooth(FAR * 0.7, FAR, bd)), o = best * 3;
			SPp[m * 4] = SP[o]; SPp[m * 4 + 1] = SP[o + 1]; SPp[m * 4 + 2] = SP[o + 2]; SPp[m * 4 + 3] = L.h * 3.4;
			SPc[m * 4] = SL.col[o] * k; SPc[m * 4 + 1] = SL.col[o + 1] * k; SPc[m * 4 + 2] = SL.col[o + 2] * k; SPc[m * 4 + 3] = L.k === 2 ? -2 : 0.02;
			SPd[m * 4] = 0; SPd[m * 4 + 1] = -1; SPd[m * 4 + 2] = 0; SPd[m * 4 + 3] = 0.55;
		}
		SFd.n.value = m;
	}
	const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	function update(dt, cam, night, hours) {
		clock += dt; hoursNow = hours; nightNow = night;
		const u = NIGHT_U.uNL.value;
		u.x = lateHour(hours); u.y = night;
		const show = night > 0.1 && cam.position.y < 3000;
		points.visible = pools.visible = show;
		if (!show) { NF.uNFn.value = 0; FIELDS.SF.n.value = 0; return; }
		const list = city.nearList?.();
		if (list !== seen || Math.hypot(cam.position.x - atX, cam.position.z - atZ) > R * 0.3) { seen = list; build(cam.position.x, cam.position.z); }
		// the motion lights: awake while you are within a few metres, a while after
		const mu = motionU.value;
		for (let i = 0; i < nm; i++) {
			const d = Math.hypot(motionAt[i * 3] - cam.position.x, motionAt[i * 3 + 1] - cam.position.y, motionAt[i * 3 + 2] - cam.position.z);
			motionSince[i] = d < 7.5 ? 0 : motionSince[i] + dt;
			mu[i] = motionLevel(motionSince[i], night);
		}
		if (clock - lastPick > 0.2 || lastPick < 0) { lastPick = clock; pick(cam); }
		if (head && head.on > 0.01) { headTo(NF.uNFP.value, NF.uNFC.value, NF.uNFD.value); headTo(FIELDS.SF.P.value, FIELDS.SF.C.value, FIELDS.SF.D.value); if (!NF.uNFn.value) NF.uNFn.value = 1; if (!FIELDS.SF.n.value) FIELDS.SF.n.value = 1; }
		else if (headWas) lastPick = -1;
		headWas = !!(head && head.on > 0.01);
	}
	// your car's low beams as the first light of a list: a spot ahead, a little down, 45 m
	let head = null, headWas = false;
	function headTo(P, C, D) {
		const I = 110 * head.on, l = Math.hypot(head.dx, 0.1, head.dz) || 1;
		P[0] = head.x; P[1] = head.y; P[2] = head.z; P[3] = 45;
		C[0] = I; C[1] = I * 0.88; C[2] = I * 0.72; C[3] = Math.cos(0.5);
		D[0] = head.dx / l; D[1] = -0.1 / l; D[2] = head.dz / l; D[3] = Math.cos(0.2);
	}
	function info() {
		return { points: np, pools: nq, field: nf, lit: NF.uNFn.value, motion: nm, reach: Math.round(R), ...stats, hour: +lateHour(hoursNow).toFixed(2), night: +nightNow.toFixed(2) };
	}
	// where the first lit trees are (the capture scripts look at one)
	const spots = () => Array.from({ length: Math.min(8, stats.trees) }, (_, i) => Array.from(treeSpots.subarray(i * 4, i * 4 + 4)));
	// let it all go (the streets' dispose, when the world closes)
	function dispose() {
		offQuality();
		scene.remove(pools, points);
		pGeo.dispose(); qGeo.dispose(); pMat.dispose(); qMat.dispose();
		NF.uNFn.value = 0; FIELDS.SF.n.value = 0;
		np = nq = nf = nm = 0;
	}
	return { update, info, spots, points, pools, dispose, rebuild: () => { seen = null; }, setHead: (h) => { head = h; } };
}
