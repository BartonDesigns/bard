// Sprinklers on the front lawns, early on a morning in the dry months (seasons.js): an impact
// head in the grass between the house and the sidewalk, its jet thrown in an arc and swept
// slowly across the lawn, tick-tick-tick, then ratcheting back; the grass and the edge of
// the sidewalk it reaches darkening wet while it runs and drying over the next couple of
// hours. Each house that waters has its own run (its start and length from its own roll).
// The heads and their wet patches are laid out when the city round you is rebuilt; after
// that the GPU does it all from the hour and the clock (the droplets' flight, the sweep, the
// wetting), and only the nearest running head is listened to.

import * as THREE from 'three';
import { soundBus } from '../world/soundbus.js';
import { sprinklerRun, sprinkling, dryMonth } from './seasons.js';
import { today } from '../calendar.js';
import { qualityNow } from '../world/governor.js';

const HOUSE = new Set([0, 1, 10, 11, 12]);
const hash = (x, z) => { let h = Math.imul(Math.floor(x * 5) | 0, 374761393) ^ Math.imul(Math.floor(z * 5) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// the droplets: each particle's emission time worked back from its age, the head's aim at
// that moment, and a ballistic flight from the nozzle
const DROP_VERT = /* glsl */`
	attribute vec3 aHead; attribute vec4 aRun; attribute float aI;
	uniform float uTime, uHours, uDry, uScale, uP;
	varying float vA;
	const float LIFE = 1.25, PERIOD = 26.0;
	float aimAt(float t, float aim, float seed){
		// forward slowly over 22 s, back quickly over 4
		float u = fract(t / PERIOD + seed);
		float s = u < 0.846 ? u / 0.846 : 1.0 - (u - 0.846) / 0.154;
		return aim + (s - 0.5) * 2.6;
	}
	void main(){
		float on = uDry * step(aRun.y, uHours) * step(uHours, aRun.y + aRun.z);
		float k = fract(aI * 0.6180339 + aRun.w);
		float age = fract(uTime / LIFE + aI / uP + aRun.w * 7.0) * LIFE;
		float th = aimAt(uTime - age, aRun.x, aRun.w);
		float v = 8.2 * (0.82 + 0.28 * k), el = 0.42 + (k - 0.5) * 0.12;
		vec3 dir = vec3(sin(th), 0.0, cos(th));
		vec3 p = aHead + vec3(0.0, 0.12, 0.0) + dir * v * cos(el) * age + vec3(0.0, v * sin(el) * age - 4.9 * age * age, 0.0);
		// (fallen to the grass: gone)
		float alive = step(aHead.y - 0.05, p.y) * on;
		vec4 mv = modelViewMatrix * vec4(p, 1.0);
		gl_Position = projectionMatrix * mv;
		gl_PointSize = alive > 0.5 ? max(1.2, (0.035 + 0.05 * age) * uScale / -mv.z) : 0.0;
		vA = alive * (0.65 - age * 0.35) * (1.0 - smoothstep(60.0, 110.0, -mv.z));
	}`;
const DROP_FRAG = /* glsl */`
	varying float vA;
	void main(){
		float r = length(gl_PointCoord - 0.5) * 2.0;
		float a = (1.0 - smoothstep(0.3, 1.0, r)) * vA;
		if (a < 0.02) discard;
		gl_FragColor = vec4(vec3(0.86, 0.9, 0.95), a);
	}`;
// the wet patch: a half disc on the lawn side of the head, darkening what is under it
const WET_VERT = /* glsl */`
	attribute vec4 aRun;
	varying vec2 vL; varying vec4 vRun;
	void main(){
		vL = position.xz; vRun = aRun;
		gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
	}`;
const WET_FRAG = /* glsl */`
	uniform float uHours, uDry;
	varying vec2 vL; varying vec4 vRun;
	void main(){
		float h = uHours, s = vRun.y, e = vRun.y + vRun.z;
		float wet = h < s ? 0.0 : h < e ? min(1.0, (h - s) / 0.15) : max(0.0, 1.0 - (h - e) / 2.0);
		wet *= uDry;
		// round, soft at its reach, the sidewalk side of the head only lightly
		float r = length(vL), side = smoothstep(-0.25, 0.25, vL.y);
		float m = (1.0 - smoothstep(0.75, 1.0, r)) * mix(0.25, 1.0, side) * wet;
		if (m < 0.01) discard;
		gl_FragColor = vec4(vec3(1.0 - 0.38 * m), 1.0);
	}`;

export function createSprinklers(scene, city, real, { isPhone = false, ground } = {}) {
	const HEADS = isPhone ? 24 : 64, P = isPhone ? 36 : 90, R = isPhone ? 55 : 95;
	const head = new Float32Array(HEADS * P * 3), run = new Float32Array(HEADS * P * 4), idx = new Float32Array(HEADS * P);
	for (let h = 0; h < HEADS; h++) for (let i = 0; i < P; i++) idx[h * P + i] = i;
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HEADS * P * 3), 3));
	geo.setAttribute('aHead', new THREE.BufferAttribute(head, 3));
	geo.setAttribute('aRun', new THREE.BufferAttribute(run, 4));
	geo.setAttribute('aI', new THREE.BufferAttribute(idx, 1));
	geo.setDrawRange(0, 0);
	const U = { uTime: { value: 0 }, uHours: { value: 12 }, uDry: { value: 0 }, uScale: { value: 400 }, uP: { value: P } };
	const drops = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, transparent: true, depthWrite: false }));
	drops.frustumCulled = false; drops.name = 'sprinkler-drops';
	const tmpV = new THREE.Vector2();
	drops.onBeforeRender = (r, sc, cam) => { U.uScale.value = r.getSize(tmpV).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)); };
	scene.add(drops);
	// the wet patches, and the heads themselves (a black cap in the grass)
	const wetGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
	wetGeo.setAttribute('aRun', new THREE.InstancedBufferAttribute(new Float32Array(HEADS * 4), 4));
	const wet = new THREE.InstancedMesh(wetGeo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: WET_VERT, fragmentShader: WET_FRAG, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), HEADS);
	const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8).translate(0, 0.08, 0), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }), HEADS);
	for (const im of [wet, caps]) { im.count = 0; im.frustumCulled = false; scene.add(im); }
	wet.renderOrder = 2;
	const heads = [];          // [{ x, y, z, aim, r }]
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
	let seen = null, atX = 1e9, atZ = 1e9;
	// a head in the front lawn: between the house and its sidewalk, clear of the drive
	function headFor(o) {
		const sw = real?.sidewalk?.(o.x, o.z);
		if (!sw) return null;
		const dx = o.x - sw[0], dz = o.z - sw[1], d = Math.hypot(dx, dz);
		if (d < 6 || d > 26) return null;
		const ux = dx / d, uz = dz / d, j = hash(o.x, o.z), lat = (j - 0.5) * 4;
		const x = sw[0] + ux * 2.4 - uz * lat, z = sw[1] + uz * 2.4 + ux * lat;
		for (const q2 of real.near?.('paths', x, z, 10) || []) {
			const ax = q2.ax, az = q2.az, bx = q2.bx - ax, bz = q2.bz - az, l2 = bx * bx + bz * bz || 1, t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / l2));
			if (Math.hypot(x - ax - bx * t, z - az - bz * t) < q2.w / 2 + 1) return null;
		}
		const L = real.landAt?.(x, z);
		if (L && (L.lu !== 1 || L.roof > 0.3)) return null;
		const g = ground(x, z);
		return { x, y: g, z, aim: Math.atan2(ux, uz), r: hash(o.z, o.x) };
	}
	function build(x, z) {
		atX = x; atZ = z; heads.length = 0;
		const list = city.nearList?.() || [];
		const cand = [];
		for (const o of list) if (HOUSE.has(Math.floor(o.kind)) && o.roof && Math.hypot(o.x - x, o.z - z) < R && hash(o.x * 0.7, o.z * 1.3) < 0.55) cand.push(o);
		cand.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
		const done = new Set();
		for (const o of cand) {
			if (heads.length >= Math.ceil(HEADS * qualityNow().people)) break;          // (fewer on a lower quality tier)
			const k = Math.round(o.x / 6) + ':' + Math.round(o.z / 6);
			if (done.has(k)) continue;
			done.add(k);
			const H = headFor(o);
			if (H) heads.push(H);
		}
		const wa = wetGeo.attributes.aRun;
		for (let h = 0; h < heads.length; h++) {
			const H = heads[h], R0 = sprinklerRun(H.r);
			H.s = R0.start; H.e = R0.start + R0.len;
			for (let i = 0; i < P; i++) { const n = h * P + i; head[n * 3] = H.x; head[n * 3 + 1] = H.y; head[n * 3 + 2] = H.z; run[n * 4] = H.aim; run[n * 4 + 1] = R0.start; run[n * 4 + 2] = R0.len; run[n * 4 + 3] = H.r; }
			wa.array.set([H.aim, R0.start, R0.len, H.r], h * 4);
			m4.compose(p.set(H.x, H.y + 0.04, H.z), q.setFromAxisAngle(Y, H.aim), sc.set(5.6, 1, 5.6)); wet.setMatrixAt(h, m4);
			m4.compose(p.set(H.x, H.y - 0.05, H.z), q.identity(), sc.set(1, 1, 1)); caps.setMatrixAt(h, m4);
		}
		geo.setDrawRange(0, heads.length * P);
		for (const a of ['aHead', 'aRun']) geo.attributes[a].needsUpdate = true;
		wa.needsUpdate = true;
		wet.count = caps.count = heads.length;
		wet.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;
	}
	// ---------- tick-tick: a loop of the impact head's ticks and its ratchet back ----------
	let snd = null, sndCtx = null, month = -1, monthAt = -1e9;
	function loopBuffer(ctx) {
		const sr = ctx.sampleRate, len = Math.floor(sr * 13), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
		const tick = (t0, g) => { const i0 = Math.floor(t0 * sr); for (let i = 0; i < sr * 0.03 && i0 + i < len; i++) { const t = i / sr; d[i0 + i] += (Math.sin(t * 2 * Math.PI * 3100) * 0.6 + (Math.random() * 2 - 1) * 0.5) * Math.exp(-t * 260) * g; } };
		for (let t = 0.05; t < 11; t += 0.19 + Math.random() * 0.02) tick(t, 0.7);
		for (let t = 11.1; t < 12.6; t += 0.045) tick(t, 0.35);
		// the hiss of the jet under it all
		let lp = 0;
		for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.5; d[i] += lp * 0.05; }
		return b;
	}
	function sound(cam, any) {
		let best = -1, bd = 24;
		const hr = U.uHours.value;
		if (any) for (let h = 0; h < heads.length; h++) { const H = heads[h]; if (hr < H.s || hr >= H.e) continue; const d = Math.hypot(H.x - cam.position.x, H.z - cam.position.z); if (d < bd) { bd = d; best = h; } }
		const B = soundBus();
		if (best < 0 || !B) {
			// (faded out, then let go)
			if (snd && !snd.off) { snd.g.gain.setTargetAtTime(0, snd.ctx.currentTime, 0.3); snd.off = snd.ctx.currentTime + 1.5; }
			else if (snd && snd.ctx.currentTime > snd.off) { snd.src.stop(); snd = null; }
			return;
		}
		if (!snd || snd.ctx !== B.ctx) {
			if (!sndCtx || sndCtx.ctx !== B.ctx) sndCtx = { ctx: B.ctx, buf: loopBuffer(B.ctx) };
			const src = B.ctx.createBufferSource(), g = B.ctx.createGain();
			src.buffer = sndCtx.buf; src.loop = true; g.gain.value = 0;
			src.connect(g).connect(B.out); src.start();
			snd = { src, g, ctx: B.ctx, off: 0 };
		}
		snd.off = 0;
		snd.g.gain.setTargetAtTime(0.32 * Math.max(0, 1 - bd / 24), snd.ctx.currentTime, 0.2);
	}
	function update(dt, cam, hours) {
		U.uTime.value += dt; U.uHours.value = hours;
		if (U.uTime.value - monthAt > 15) { monthAt = U.uTime.value; month = today().getMonth(); }
		const dry = dryMonth(month) ? 1 : 0;
		U.uDry.value = dry;
		// (out of season, or past the morning's drying, nothing to draw)
		const show = dry && hours > 4.8 && hours < 11 && cam.position.y < 1500;
		drops.visible = wet.visible = show;
		caps.visible = cam.position.y < 1500;
		if (show) {
			const list = city.nearList?.();
			if (list !== seen || Math.hypot(cam.position.x - atX, cam.position.z - atZ) > R * 0.45) { seen = list; build(cam.position.x, cam.position.z); }
		}
		sound(cam, show && hours < 8);
	}
	const running = () => heads.filter((H) => sprinkling(H.r, U.uHours.value, month).on).length;
	return { update, info: () => ({ heads: heads.length, running: running(), dry: !!U.uDry.value }), heads: () => heads.map((H) => ({ x: +H.x.toFixed(1), z: +H.z.toFixed(1), start: +sprinklerRun(H.r).start.toFixed(2) })) };
}
