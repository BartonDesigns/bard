// The cars' lights after dark: every car in the traffic shows its headlights to whoever is in
// front of it and its tail lights behind (brighter as it brakes or waits at a corner, its brake
// lights on); the nearest few, and yours, throw their low beams on the road ahead, a pool that
// starts a few metres out, is brightest ten or so metres on and spreads and fades by thirty;
// your own lamps also light the walls and trees ahead (world/nightfield.js, through the
// evening's list); a car whose door is open (someone getting in or out, you) has its dome
// light on, a warm glow in the cabin and a little light on the ground by the door.
//
// Two draws (the lamps as points that know which way their car faces, the beams as quads),
// refilled each frame from the traffic's own list, no allocation: the cars move.

import * as THREE from 'three';
import { SPEC } from './cars.js';
import { qualityNow } from '../world/governor.js';

const P_ATTRS = ['position', 'aCol', 'aDir'], Q_ATTRS = ['position', 'aUV', 'aCol'], NONE = [];
const HALOGEN = [1, 0.86, 0.66], XENON = [0.86, 0.92, 1], TAIL = [1, 0.04, 0.02], DOME = [1, 0.84, 0.6];

// The brake lights' state: on while the car slows hard or stands (a red light, a corner), easing
// in and out. prev: its speed a moment ago, v: now, k: the lamp's level; returns the new level.
export function brakeLevel(prev, v, dt, k) {
	const braking = v < 0.4 || (prev - v) / Math.max(dt, 1e-3) > 0.7 ? 1 : 0;
	return k + (braking - k) * Math.min(1, dt * 8);
}
// The low beam on the road at x metres ahead and y across, as a share of its brightest
export function beamAt(x, y) {
	if (x < 0) return 0;
	const w = 1.1 + 0.3 * x, a = Math.min(1, Math.max(0, (x - 1.5) / 5));
	return a * a * (3 - 2 * a) * Math.exp(-2 * (y / w) * (y / w)) / (1 + (x / 13) * (x / 13));
}

const POINT_VS = /* glsl */`
	attribute vec3 aCol; attribute vec3 aDir;
	uniform float uScale, uK;
	varying vec3 vCol;
	void main() {
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		float d = -mv.z;
		// a headlight (aDir.z 1) to whoever is in front of the car, a tail light (0) behind,
		// a dome light (2) all round
		vec3 to = normalize(cameraPosition - position);
		float f = dot(to.xz, aDir.xy);
		float face = aDir.z > 1.5 ? 1.0 : aDir.z > 0.5 ? smoothstep(-0.1, 0.6, f) : smoothstep(0.1, -0.5, f);
		float px = (aDir.z > 0.5 && aDir.z < 1.5 ? 0.45 : 0.28) * uScale / max(d, 0.1);
		float a = uK * face * (1.0 - smoothstep(260.0, 380.0, d));
		vCol = aCol * a * clamp(px / 1.5, 0.35, 1.0);
		gl_PointSize = max(1.5, px * (1.0 + 0.6 * face));
		gl_Position = a > 0.002 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
	}`;
const POINT_FS = /* glsl */`
	uniform float uExpo;
	varying vec3 vCol;
	void main() {
		vec2 q = gl_PointCoord - 0.5;
		float r2 = dot(q, q) * 4.0;
		if (r2 > 1.0) discard;
		float a = exp(-r2 * 10.0) * 1.4 + exp(-r2 * 2.2) * 0.16;
		gl_FragColor = vec4(vCol * a * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;
// the beams: x ahead (m), y across (m); shape 0 a low beam, 1 the dome light's spill
const BEAM_VS = /* glsl */`
	attribute vec2 aUV; attribute vec3 aCol;
	varying vec2 vUV; varying vec3 vCol;
	void main() { vUV = aUV; vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FS = /* glsl */`
	uniform float uK, uExpo;
	varying vec2 vUV; varying vec3 vCol;
	void main() {
		float x = vUV.x, y = vUV.y, e;
		if (x > -50.0) {
			float w = 1.1 + 0.3 * x, a = smoothstep(1.5, 6.5, x);
			e = a * exp(-2.0 * (y / w) * (y / w)) / (1.0 + (x / 13.0) * (x / 13.0)) * (1.0 - smoothstep(26.0, 34.0, x));
		} else { float r = length(vec2(x + 100.0, y)); e = pow(1.0 + 6.25 * r * r, -1.5) * (1.0 - smoothstep(0.7, 1.0, r)); }
		if (e < 0.003) discard;
		gl_FragColor = vec4(vCol * e * uK * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;

export function createCarLights(scene, { isPhone = false, ground = () => 0, world = () => null } = {}) {
	const CAP_P = isPhone ? 300 : 1000, CAP_Q = isPhone ? 4 : 10, NEAR = isPhone ? 2 : 7, R = isPhone ? 160 : 320;
	const pPos = new Float32Array(CAP_P * 3), pCol = new Float32Array(CAP_P * 3), pDir = new Float32Array(CAP_P * 3);
	const pGeo = new THREE.BufferGeometry();
	pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
	pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
	pGeo.setAttribute('aDir', new THREE.BufferAttribute(pDir, 3).setUsage(THREE.DynamicDrawUsage));
	pGeo.setDrawRange(0, 0);
	const U = { uScale: { value: 400 }, uK: { value: 0 }, uExpo: { value: 1 } };
	const pMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
	const points = new THREE.Points(pGeo, pMat);
	points.frustumCulled = false; points.visible = false; points.name = 'car-lights'; points.renderOrder = 6;
	const qPos = new Float32Array(CAP_Q * 12), qUV = new Float32Array(CAP_Q * 8), qCol = new Float32Array(CAP_Q * 12), qIdx = new Uint16Array(CAP_Q * 6);
	for (let i = 0; i < CAP_Q; i++) qIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
	const qGeo = new THREE.BufferGeometry();
	qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3).setUsage(THREE.DynamicDrawUsage));
	qGeo.setAttribute('aUV', new THREE.BufferAttribute(qUV, 2).setUsage(THREE.DynamicDrawUsage));
	qGeo.setAttribute('aCol', new THREE.BufferAttribute(qCol, 3).setUsage(THREE.DynamicDrawUsage));
	qGeo.setIndex(new THREE.BufferAttribute(qIdx, 1));
	qGeo.setDrawRange(0, 0);
	const qMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -7 });
	const beams = new THREE.Mesh(qGeo, qMat);
	beams.frustumCulled = false; beams.visible = false; beams.name = 'car-beams'; beams.renderOrder = 3;
	scene.add(beams, points);
	const tmpV = new THREE.Vector2();
	points.onBeforeRender = (r, sc, cam) => { U.uScale.value = r.getSize(tmpV).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)); U.uExpo.value = r.toneMappingExposure * 0.85; };

	let np = 0, nq = 0;
	// (your car: where its lamps are, for the evening's list: x, y, z, dx, dz, on)
	const head = { x: 0, y: 0, z: 0, dx: 0, dz: 1, on: 0 };
	const nearD = new Float32Array(NEAR), nearC = new Array(NEAR).fill(null);
	let wasDriving = false, domeT = 0;
	function lamp(x, y, z, c, k, dx, dz, kind) {
		if (np >= CAP_P) return;
		pPos[np * 3] = x; pPos[np * 3 + 1] = y; pPos[np * 3 + 2] = z;
		pCol[np * 3] = c[0] * k; pCol[np * 3 + 1] = c[1] * k; pCol[np * 3 + 2] = c[2] * k;
		pDir[np * 3] = dx; pDir[np * 3 + 1] = dz; pDir[np * 3 + 2] = kind;
		np++;
	}
	// a car's four lamps: at (x, y, z), heading (sx, cz), its kind, how hard it brakes
	function car(x, y, z, sx, cz, kind, brake, warm) {
		const S = SPEC[kind] || SPEC.sedan, hw = S.W / 2 - 0.25, fl = S.L / 2 - 0.08, hy = y + Math.min(0.75, 0.45 + S.H * 0.18);
		const c = warm ? HALOGEN : XENON;
		for (let s = -1; s <= 1; s += 2) {
			lamp(x + sx * fl + cz * hw * s, hy, z + cz * fl - sx * hw * s, c, 3.2, sx, cz, 1);
			lamp(x - sx * fl + cz * (hw + 0.05) * s, hy + 0.12, z - cz * fl - sx * (hw + 0.05) * s, TAIL, 1.4 + 3 * brake, sx, cz, 0);
		}
	}
	// a low beam on the road ahead of a car at (x, y, z) facing (sx, cz)
	function beam(x, y, z, sx, cz, kind, warm, k) {
		if (nq >= CAP_Q) return;
		const S = SPEC[kind] || SPEC.sedan, f = S.L / 2, L = 34, W = 11;
		const g0 = ground(x + sx * (f + 2), z + cz * (f + 2)), g1 = ground(x + sx * (f + L), z + cz * (f + L));
		const ax = x + sx * f, az = z + cz * f, bx = x + sx * (f + L), bz = z + cz * (f + L), o = nq * 12;
		// (across: square to the heading)
		const tx = cz * W, tz = -sx * W;
		qPos.set([ax - tx, g0 + 0.06, az - tz, ax + tx, g0 + 0.06, az + tz, bx + tx, g1 + 0.06, bz + tz, bx - tx, g1 + 0.06, bz - tz], o);
		qUV.set([0, -W, 0, W, L, W, L, -W], nq * 8);
		const c = warm ? HALOGEN : XENON, kk = 0.07 * k;
		for (let j = 0; j < 4; j++) { qCol[o + j * 3] = c[0] * kk; qCol[o + j * 3 + 1] = c[1] * kk; qCol[o + j * 3 + 2] = c[2] * kk; }
		nq++;
	}
	// the dome light: a glow in the cabin, a little light on the ground by the door
	function dome(x, z, yaw, k) {
		const y = ground(x, z), sx = Math.sin(yaw), cz = Math.cos(yaw);
		lamp(x, y + 1.15, z, DOME, 1.6 * k, sx, cz, 2);
		if (nq >= CAP_Q) return;
		const dx = x + cz * 1.4, dz = z - sx * 1.4, r = 2.6, o = nq * 12, g = ground(dx, dz) + 0.05;
		qPos.set([dx - r, g, dz - r, dx + r, g, dz - r, dx + r, g, dz + r, dx - r, g, dz + r], o);
		qUV.set([-101, -1, -99, -1, -99, 1, -101, 1], nq * 8);
		const kk = 0.05 * k;
		for (let j = 0; j < 4; j++) { qCol[o + j * 3] = DOME[0] * kk; qCol[o + j * 3 + 1] = DOME[1] * kk; qCol[o + j * 3 + 2] = DOME[2] * kk; }
		nq++;
	}
	const warmOf = (id) => { let h = 0; const s = String(id || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h & 7) < 5; };
	function update(dt, cam, night) {
		const k = Math.max(0, Math.min(1, (night - 0.1) / 0.25));
		U.uK.value = k;
		const show = k > 0.01 && cam.position.y < 2000;
		points.visible = beams.visible = show;
		head.on = 0;
		if (!show) return;
		const W = world(), S = W?.street, V = W?.vehicles;
		np = 0; nq = 0;
		const cx = cam.position.x, cz = cam.position.z;
		// the traffic: every car's lamps; the nearest few's beams
		for (let i = 0; i < NEAR; i++) { nearD[i] = 1e9; nearC[i] = null; }
		if (S?.cars && S.group?.visible !== false) for (const c of S.cars) {
			if (c.px === undefined) continue;
			const d = Math.abs(c.px - cx) + Math.abs(c.pz - cz);
			if (d > R) continue;
			c.brk = brakeLevel(c.lv ?? c.v, c.v, dt, c.brk ?? 0); c.lv = c.v;
			if (c.warm === undefined) c.warm = warmOf(c.id);
			const sx = Math.sin(c.yaw), sz = Math.cos(c.yaw);
			car(c.px, c.py ?? ground(c.px, c.pz), c.pz, sx, sz, c.kind, c.brk, c.warm);
			// (the nearest few that are ahead of you or crossing: their beams)
			let w = -1;
			for (let j = 0; j < NEAR; j++) if (d < nearD[j] && (w < 0 || nearD[j] > nearD[w])) w = j;
			if (w >= 0) { nearD[w] = d; nearC[w] = c; }
		}
		// (a lighter tier keeps fewer beams: world/governor.js)
		const nb = Math.max(1, Math.round(NEAR * (qualityNow()?.far ?? 1)));
		for (let j = 0, b = 0; j < NEAR && b < nb; j++) { const c = nearC[j]; if (c) { b++; beam(c.px, c.py ?? 0, c.pz, Math.sin(c.yaw), Math.cos(c.yaw), c.kind, c.warm, 1); } }
		// your car: its lamps, its beam (and to the evening's list); its dome light a while after you get out
		const m = V?.mine?.car;
		if (m) {
			const sx = Math.sin(m.yaw), sz = Math.cos(m.yaw);
			if (V.mine.driving) {
				car(m.x, m.y, m.z, sx, sz, m.kind, 0, true);
				beam(m.x, m.y, m.z, sx, sz, m.kind, true, 1.3);
				const S2 = SPEC[m.kind] || SPEC.sedan;
				head.x = m.x + sx * S2.L / 2; head.y = m.y + 0.7; head.z = m.z + sz * S2.L / 2; head.dx = sx; head.dz = sz; head.on = k;
			}
			if (wasDriving && !V.mine.driving) domeT = 12;
			wasDriving = !!V.mine.driving;
			if (domeT > 0) { domeT -= dt; dome(m.x, m.z, m.yaw, Math.min(1, domeT / 2)); }
		}
		// the owners getting into and out of their cars (vehicles/life.js)
		for (const E of V?.life?.episodes || NONE) {
			const t = E.t || 0, car0 = E.car;
			if (!car0) continue;
			const dk = E.phase === 'get-in' ? Math.min(1, t * 2) : E.phase === 'pull-out' ? Math.max(0, 1 - t / 2.5) : E.phase === 'park' ? Math.min(1, t * 2) : E.phase === 'walk-in' ? Math.max(0, 1 - t / 8) : 0;
			if (dk > 0.01) dome(E.phase === 'pull-out' ? E.pos[0] : car0.x, E.phase === 'pull-out' ? E.pos[1] : car0.z, E.phase === 'pull-out' ? E.yaw : car0.yaw, dk);
		}
		pGeo.setDrawRange(0, np);
		for (const key of P_ATTRS) { const A = pGeo.attributes[key]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, np) * 3); A.needsUpdate = true; }
		qGeo.setDrawRange(0, nq * 6);
		for (const key of Q_ATTRS) { const A = qGeo.attributes[key]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, nq) * 4 * A.itemSize); A.needsUpdate = true; }
	}
	function dispose() { scene.remove(beams, points); pGeo.dispose(); qGeo.dispose(); pMat.dispose(); qMat.dispose(); }
	const info = () => ({ lamps: np, beams: nq, headlight: +head.on.toFixed(2) });
	return { update, info, dispose, head, points, beams };
}
