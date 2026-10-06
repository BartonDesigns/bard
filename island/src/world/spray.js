// Water thrown into the air: the lawn sprinklers (world/sprinklers.js) and the spray and
// mist at the foot of falling water (world/falls.js), drawn the one way.
//
// Each drop is a short streak, the path it covers in the blink of an exposure, turned
// along its velocity. Its flight is worked out in the vertex shader from its own seed
// and the time: launched from the head at 6-10 m/s, carried on a ballistic arc under
// gravity, slowed by the air's drag (the fine drops most, so they hang and drift) and
// pushed on the wind toward the wind's own speed, until it meets the ground. A pop-up
// head throws a fan through its arc from the ribs of its nozzle, in jets with gaps
// between; a rotor throws one stream that steps round its arc, ratchet by ratchet, and
// breaks into drops as it flies. At a fall the water pours over the lip and is thrown
// back out from the foot in all directions.
//
// The light in a drop: lit from behind (the sun beyond the spray) it scatters forward
// and glitters; at 40-42 degrees from the point opposite the sun each drop shows the
// rainbow's colour for its angle (world/rainbow.js), red outside, violet in, so a spray
// with the sun at your back carries a bow resolved drop by drop. A soft mist hangs
// round the plume (the finest drops), lifting and greying what is behind it, with its
// own faint bow. The grass under a sprinkler goes dark and glossy as it wets, and dries
// over a couple of hours.
//
// Cheap: one draw for every drop, one for the mist, one for the wet grass; a fixed pool
// of emitter slots, their state in a few uniforms. Only what is near is animated: the
// sprinklers within 60 m throw drops, those beyond only a faint mist out to 140 m.

import * as THREE from 'three';
import { loadBowTexture } from './rainbow.js';
import { soundBus, noise } from './soundbus.js';
import { createSprinklers } from './sprinklers.js';
import { createFalls } from './falls.js';

// a head's kind, as the yards give it: a fan (spray, strip, bubbler) or a rotor's stream;
// its arc start, arc, radius, speed and elevation are its own (world/sprinklers.js)
const KIND = { 1: 1, 2: 2, spray: 1, strip: 1, bubbler: 1, rotor: 2 };
const SLOTS = 16;               // the shader's emitter slots (sprinklers first, then falls)
const DECALS = 12;

// a slot is five vec4s:
//  0: origin xyz, kind (0 off, 1 spray head, 2 rotor, 3 fall)
//  1: start azimuth (a fall: its width), arc, launch speed, elevation
//  2: ground level, radius, share of drops drawn, light (1 sunlit; < 0 a cave)
//  3: rotor: period, phase; a fall: its lip xyz; w: a fall's share of pouring drops
//  4: running (0..1), mist (0..1)
const DROP_VERT = /* glsl */`
attribute vec4 aSeed; attribute float aSlot;
uniform vec4 uE[${SLOTS * 5}];
uniform float uTime, uWind, uGust, uPx, uRow;
uniform vec2 uWindDir; uniform vec3 uSunDir, uSunC, uAmb; uniform sampler2D uBow;
varying vec3 vCol; varying float vX;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
	int i = int(aSlot + 0.5) * 5;
	vec4 e0 = uE[i], e1 = uE[i + 1], e2 = uE[i + 2], e3 = uE[i + 3], e4 = uE[i + 4];
	vX = position.x; vCol = vec3(0.0);
	gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
	if (e0.w < 0.5 || aSeed.w > e2.z) return;
	float n = floor(aSeed.y * 9973.0) + aSlot * 17.0;
	float r1 = h1(n), r2 = h1(n + 1.3), r3 = h1(n + 2.7);
	// drag: the fine drops slow sooner and drift more
	float k = mix(0.22, 1.4, aSeed.z * aSeed.z);
	vec3 o = e0.xyz; float sp, el, az = 0.0;
	bool pour = false;
	if (e0.w < 1.5) { sp = e1.z * mix(0.4, 1.0, sqrt(r1)); el = e1.w + (r2 - 0.5) * 0.2; }
	else if (e0.w < 2.5) { bool jet = r1 < 0.72; sp = e1.z * (jet ? mix(0.9, 1.0, r2) : mix(0.3, 0.85, r2)); el = e1.w + (r3 - 0.5) * (jet ? 0.04 : 0.25); }
	else if (aSeed.z < e3.w) {
		// pouring over the lip: across its width, falling free
		pour = true;
		vec2 d = o.xz - e3.xz; float dl = length(d); d = dl > 0.1 ? d / dl : vec2(1.0, 0.0);
		o = e3.xyz + vec3(-d.y, 0.0, d.x) * e1.x * (r1 - 0.5) + vec3(d.x, 0.0, d.y) * r3 * 0.3;
		az = atan(d.y, d.x) + (r2 - 0.5) * 0.6; sp = 0.4 + r2 * 0.9; el = -0.3; k = 0.12;
	} else {
		// thrown back out of the foot
		float a = r3 * 6.2832, rr = e2.y * 0.45 * sqrt(r1);
		o += vec3(cos(a) * rr, 0.0, sin(a) * rr);
		sp = e1.z * mix(0.25, 1.0, r2 * r2); el = mix(0.35, 1.35, h1(n + 4.1)); az = a + (h1(n + 5.3) - 0.5);
	}
	// the flight: drag toward the wind's speed and the drop's own falling speed
	vec2 wv = uWindDir * (0.4 + uWind * 3.0 + uGust * 2.5);
	vec3 Vt = vec3(wv.x, -9.81 / k, wv.y);
	float vy = sp * sin(el), h = max(0.0, o.y - e2.x);
	float T = (vy + sqrt(vy * vy + 19.62 * h)) / 9.81;
	for (int j = 0; j < 3; j++) {
		float ex = exp(-k * T);
		float f = h + Vt.y * T + (vy - Vt.y) * (1.0 - ex) / k, df = Vt.y + (vy - Vt.y) * ex;
		T = max(0.05, T - f / min(df, -0.01));
	}
	float age = fract(uTime / T + aSeed.x * 7.31) * T;
	if (e0.w < 1.5) {
		// the ribs of the nozzle: jets, with gaps between
		float jets = max(3.0, floor(e1.y * 6.0));
		az = e1.x + e1.y * (floor(h1(n + 3.3) * jets) + 0.5 + (h1(n + 6.1) - 0.5) * 0.2) / jets;
	} else if (e0.w < 2.5) {
		// a rotor: where it pointed when this drop left it, stepping round and swinging back
		float ph = fract((uTime - age) / e3.x + e3.y), s;
		if (e1.y > 6.2) s = floor(ph * 48.0) / 48.0;
		else if (ph < 0.9) { s = ph / 0.9 * 30.0; s = (floor(s) + smoothstep(0.75, 1.0, fract(s))) / 30.0; }
		else s = 1.0 - (ph - 0.9) / 0.1;
		az = e1.x + e1.y * s + (h1(n + 6.1) - 0.5) * 0.03;
	}
	vec3 v0 = vec3(cos(az) * cos(el), sin(el), sin(az) * cos(el)) * sp;
	float ex = exp(-k * age);
	vec3 p = o + Vt * age + (v0 - Vt) * (1.0 - ex) / k;
	vec3 v = Vt + (v0 - Vt) * ex;
	// the stream breaking up, and the fine drops tumbling in the air
	vec3 jit = vec3(h1(n + 7.0), h1(n + 8.0), h1(n + 9.0)) - 0.5;
	float brk = age / T;
	p += jit * (pour ? 0.25 : 0.7) * age * brk;
	v += vec3(sin(uTime * 9.0 + n), sin(uTime * 7.3 + n * 1.3), cos(uTime * 8.1 + n * 0.7)) * (0.2 + 1.4 * aSeed.z) * brk;
	// the streak: its path through the exposure, a quad turned to face you
	vec3 toC = cameraPosition - p; float dist = length(toC);
	vec3 dir = normalize(v), side = normalize(cross(toC, dir));
	float small = aSeed.z, px = uPx * dist * 0.6, wid = max(0.0008, px);
	vec3 w = p - dir * (length(v) * mix(0.012, 0.005, small) + wid) * position.y + side * position.x * wid;
	gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
	// the light: forward scatter (backlit glitter), the bow's colour by angle, the sky's fill
	vec3 vd = -toC / dist;
	float c = dot(vd, uSunDir);
	float hg = 0.12 * (1.0 - 0.49) / pow(1.49 - 1.4 * c, 1.5);
	float ang = degrees(acos(clamp(-c, -1.0, 1.0)));
	vec3 bow = texture2D(uBow, vec2(clamp((42.0 + (ang - 42.0) * 0.55 - 25.0) / 35.0, 0.0, 1.0), uRow)).rgb * smoothstep(30.0, 38.0, ang);
	float glint = step(0.93, h1(n * 1.7 + floor(uTime * 14.0 + aSeed.y * 5.0)));
	float sun = max(e2.w, 0.0);
	vCol = uSunC * sun * (bow * bow * 1.0 + vec3(0.025 + hg * (0.12 + 1.6 * glint))) + uAmb * 0.18 + vec3(0.03, 0.04, 0.05) * max(-e2.w, 0.0);
	// (far, a drop is less than a pixel: its light spread thin)
	vCol *= e4.x * clamp(0.0016 / wid, 0.2, 1.0) * mix(1.0, 0.35, small) * mix(1.0, 0.4, brk) * smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.92, 1.0, brk)) * smoothstep(0.3, 1.2, dist);
}`;
const DROP_FRAG = /* glsl */`
varying vec3 vCol; varying float vX;
void main(){
	gl_FragColor = vec4(vCol * (1.0 - vX * vX), 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

const MIST_VERT = /* glsl */`
attribute vec4 aSeed; attribute float aSlot;
uniform vec4 uE[${SLOTS * 5}];
uniform float uTime, uWind, uGust;
uniform vec2 uWindDir;
varying vec2 vQ; varying vec3 vW; varying float vA, vL;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
	int i = int(aSlot + 0.5) * 5;
	vec4 e0 = uE[i], e1 = uE[i + 1], e2 = uE[i + 2], e4 = uE[i + 4];
	gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vQ = position.xy; vW = vec3(0.0); vL = e2.w;
	if (e0.w < 0.5 || e4.y < 0.01) return;
	bool fall = e0.w > 2.5;
	float L = fall ? mix(3.0, 6.0, aSeed.y) : mix(4.0, 7.0, aSeed.y);
	float t = uTime / L + aSeed.x * 5.3, a = fract(t), cyc = floor(t);
	float r1 = h1(cyc * 1.37 + aSeed.z * 91.0), r2 = h1(cyc * 2.11 + aSeed.z * 53.0), r3 = h1(cyc * 0.73 + aSeed.z * 17.0);
	vec2 wv = uWindDir * (0.3 + uWind * 1.5 + uGust);
	vec3 c; float size;
	if (fall) {
		float R = e2.y, ra = r1 * 6.2832, rr = R * 0.5 * sqrt(r2);
		c = e0.xyz + vec3(cos(ra) * rr, R * 0.15 + a * L * mix(0.25, 0.7, r3) * min(R, 4.0) * 0.3, sin(ra) * rr);
		size = R * mix(0.5, 1.5, a);
	} else {
		float az = e1.x + e1.y * r1, rr = e2.y * mix(0.15, 1.0, r2);
		c = e0.xyz + vec3(cos(az) * rr, 0.25 + 1.6 * r2 * (1.0 - r2) * e2.y * 0.25 + r3 * 0.4 + a * 0.3, sin(az) * rr);
		size = mix(0.9, 2.0, r3) * (0.7 + 0.5 * a);
	}
	c.xz += wv * a * L * 0.6;
	vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
	vW = c + (right * position.x + up * position.y) * size * 0.5;
	float dist = length(c - cameraPosition);
	vA = sin(3.1416 * a) * e4.y * e4.x * (fall ? 0.18 : 0.08) * smoothstep(0.6, 3.0, dist);
	gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`;
const MIST_FRAG = /* glsl */`
uniform sampler2D uPuff, uBow; uniform vec3 uSunDir, uSunC, uAmb; uniform float uRow;
varying vec2 vQ; varying vec3 vW; varying float vA, vL;
void main(){
	float m = texture2D(uPuff, vQ * 0.5 + 0.5).a * smoothstep(1.0, 0.3, length(vQ));
	float a = vA * m;
	if (a < 0.002) discard;
	vec3 vd = normalize(vW - cameraPosition);
	float c = dot(vd, uSunDir);
	float hg = 0.12 * (1.0 - 0.36) / pow(1.36 - 1.2 * c, 1.5);
	float ang = degrees(acos(clamp(-c, -1.0, 1.0)));
	vec3 bow = texture2D(uBow, vec2(clamp((42.0 + (ang - 42.0) * 0.6 - 25.0) / 35.0, 0.0, 1.0), uRow)).rgb * smoothstep(30.0, 38.0, ang);
	float sun = max(vL, 0.0);
	vec3 col = uSunC * sun * (0.12 + hg * 0.7 + bow * bow * 2.0) + uAmb * 0.7 + vec3(0.05, 0.06, 0.07) * max(-vL, 0.0);
	gl_FragColor = vec4(col, a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

// the wet grass: darker (the light in it multiplied down) and glossy (the sun's glints added)
const WET_VERT = /* glsl */`
attribute vec3 aP;
uniform vec4 uD[${DECALS}];
varying vec3 vP; varying float vK; varying vec3 vW;
void main(){
	vec4 d = uD[int(aP.z + 0.5)];
	vP = vec3(aP.xy, d.y); vK = d.x; vW = position;
	gl_Position = d.x < 0.005 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;
const WET_FRAG = /* glsl */`
uniform sampler2D uPuff; uniform vec3 uSunDir, uSunC, uSkyHor;
varying vec3 vP; varying float vK; varying vec3 vW;
float h2(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
	float r = length(vP.xy) / vP.z;
	float n = texture2D(uPuff, vP.xy * 0.09 + 0.5).a;
	float wet = vK * (1.0 - smoothstep(0.7, 1.05, r + (n - 0.5) * 0.35)) * mix(0.55, 1.0, n);
	if (wet < 0.005) discard;
	vec3 vd = normalize(cameraPosition - vW);
	float fr = pow(1.0 - max(vd.y, 0.0), 4.0);
	// glints: the odd wet blade turned just so to the sun
	vec2 cell = floor(vP.xy * 22.0);
	vec3 nb = normalize(vec3(h2(cell) - 0.5, 1.2, h2(cell + 7.0) - 0.5));
	float g = pow(max(dot(reflect(-vd, nb), uSunDir), 0.0), 60.0) * step(0.8, h2(cell + 3.0));
	vec3 add = (uSunC * (g * 2.0 + fr * 0.08) + uSkyHor * fr * 0.12) * wet;
	gl_FragColor = vec4(add, 1.0 - 0.42 * wet);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

// a soft blotchy puff, for the mist and the wet ground's patchiness
function puffTexture() {
	const S = 64, c = document.createElement('canvas');
	c.width = c.height = S;
	const g = c.getContext('2d');
	let s = 7;
	const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
	for (let i = 0; i < 40; i++) {
		const x = S / 2 + (r() - 0.5) * S * 0.55, y = S / 2 + (r() - 0.5) * S * 0.55, rad = S * (0.08 + r() * 0.2);
		const gr = g.createRadialGradient(x, y, 0, x, y, rad);
		gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr; g.fillRect(0, 0, S, S);
	}
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	return t;
}

export function createSpray(scene, shared, { isPhone = false, world } = {}) {
	const NS = isPhone ? 5 : 10, NF = isPhone ? 2 : 4, ND = isPhone ? 6 : DECALS;
	const DS = isPhone ? 450 : 1300, DF = isPhone ? 900 : 2200, MS = isPhone ? 12 : 22, MF = isPhone ? 18 : 36;
	const group = new THREE.Group();
	group.name = 'spray';
	scene.add(group);
	const bow = world()?.weather?.uniforms?.uBow?.value || loadBowTexture();
	const puff = puffTexture();
	const E = [...Array(SLOTS * 5)].map(() => new THREE.Vector4());
	const U = {
		uE: { value: E }, uTime: shared.uTime, uWind: shared.uWind, uGust: shared.uGust, uWindDir: shared.uWindDir,
		uSunDir: shared.uSunDir, uSunC: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uSkyHor: shared.uSkyHor,
		uBow: { value: bow }, uPuff: { value: puff }, uPx: { value: 0.001 }, uRow: { value: 0.625 },
	};

	// instances: a block per slot; aSeed.w is a drop's place in its block (the share drawn)
	function instanced(sizes, w, h) {
		const g = new THREE.InstancedBufferGeometry();
		const q = new THREE.PlaneGeometry(w, h).translate(0, h === 1 ? 0.5 : 0, 0);
		g.index = q.index; g.setAttribute('position', q.attributes.position);
		const N = sizes.reduce((a, b) => a + b, 0), seed = new Float32Array(N * 4), slot = new Float32Array(N);
		let o = 0;
		sizes.forEach((n, s) => { for (let k = 0; k < n; k++, o++) { seed.set([Math.random(), Math.random(), Math.random(), k / n], o * 4); slot[o] = s; } });
		g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
		g.setAttribute('aSlot', new THREE.InstancedBufferAttribute(slot, 1));
		g.instanceCount = N;
		return g;
	}
	const blocks = (a, b) => [...Array(SLOTS)].map((_, s) => (s < NS ? a : s >= SLOTS - NF ? b : 0));
	const drops = new THREE.Mesh(instanced(blocks(DS, DF), 2, 1), new THREE.ShaderMaterial({
		uniforms: U, vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	}));
	const mist = new THREE.Mesh(instanced(blocks(MS, MF), 2, 2), new THREE.ShaderMaterial({
		uniforms: U, vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false,
	}));
	drops.frustumCulled = mist.frustumCulled = false;
	drops.renderOrder = 6; mist.renderOrder = 7;
	group.add(drops, mist);

	// the wet patches: a fan of ground draped under each, rebuilt as a slot takes a new head
	const RINGS = 7, SEGS = 20, PER = (RINGS + 1) * (SEGS + 1);
	const wetPos = new Float32Array(ND * PER * 3), wetP = new Float32Array(ND * PER * 3), wetIdx = [];
	for (let d = 0; d < ND; d++) for (let a = 0; a < RINGS; a++) for (let b = 0; b < SEGS; b++) {
		const o = d * PER, p = o + a * (SEGS + 1) + b, q = p + SEGS + 1;
		wetIdx.push(p, q, p + 1, p + 1, q, q + 1);
	}
	const wg = new THREE.BufferGeometry();
	wg.setAttribute('position', new THREE.BufferAttribute(wetPos, 3));
	wg.setAttribute('aP', new THREE.BufferAttribute(wetP, 3));
	wg.setIndex(wetIdx);
	const D = [...Array(DECALS)].map(() => new THREE.Vector4());
	const wet = new THREE.Mesh(wg, new THREE.ShaderMaterial({
		uniforms: { uD: { value: D }, uPuff: U.uPuff, uSunDir: U.uSunDir, uSunC: U.uSunC, uSkyHor: U.uSkyHor },
		vertexShader: WET_VERT, fragmentShader: WET_FRAG, transparent: true, depthWrite: false,
		blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor, blendEquation: THREE.AddEquation,
		polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
	}));
	wet.frustumCulled = false;
	wet.renderOrder = 1;
	group.add(wet);
	const wetOf = new Array(ND).fill(null);
	function drape(d, h) {
		const W = world(), I = W?.island, gr = I ? (I.drawnAt || I.heightAt) : () => h.y;
		const full = h.arc > 6.2, a0 = full ? 0 : h.a0 - 0.12, arc = full ? Math.PI * 2 : h.arc + 0.24, R = h.R * 1.1;
		for (let a = 0; a <= RINGS; a++) for (let b = 0; b <= SEGS; b++) {
			const rr = 0.2 + (R - 0.2) * a / RINGS, t = a0 + arc * b / SEGS, x = h.x + Math.cos(t) * rr, z = h.z + Math.sin(t) * rr, k = (d * PER + a * (SEGS + 1) + b) * 3;
			wetPos[k] = x; wetPos[k + 1] = gr(x, z) + 0.04; wetPos[k + 2] = z;
			wetP[k] = x - h.x; wetP[k + 1] = z - h.z; wetP[k + 2] = d;
		}
		wg.attributes.position.needsUpdate = wg.attributes.aP.needsUpdate = true;
	}

	const sprinklers = createSprinklers({ world, isPhone });
	const falls = createFalls({ world });
	let force = false, q = 1, fallList = [], fallT = 0, last = [];
	const fallAt = { x: 1e9, z: 1e9 };

	// ---- the hiss of the spray and the rush of falling water, quiet, from what is near
	let snd = null;
	function stop() {
		if (snd) for (const g of [snd.hiss, snd.rush]) { g.src.stop(); g.disconnect(); }
		snd = null;
	}
	function sound(hiss, rush) {
		const bus = soundBus();
		if (!bus) return;
		if (!snd || snd.ctx !== bus.ctx) {
			const ctx = bus.ctx, mk = (colour, type, f, qv) => {
				const s = ctx.createBufferSource(); s.buffer = noise(ctx, colour); s.loop = true;
				const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = qv;
				const g = ctx.createGain(); g.gain.value = 0;
				s.connect(fl).connect(g).connect(bus.out); s.start();
				g.src = s;
				return g;
			};
			stop();
			snd = { ctx, hiss: mk('white', 'highpass', 4200, 0.6), rush: mk('pink', 'lowpass', 1400, 0.5) };
		}
		snd.hiss.gain.setTargetAtTime(Math.min(0.02, hiss), snd.ctx.currentTime, 0.4);
		snd.rush.gain.setTargetAtTime(Math.min(0.06, rush), snd.ctx.currentTime, 0.6);
	}

	const sunC = new THREE.Color();
	function update(dt, camera) {
		const W = world();
		if (!W) return;
		const cam = camera.position, hours = W.sky?.state?.hours ?? 12;
		U.uPx.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(200, innerHeight * (window.devicePixelRatio || 1)) * 1.3;
		const sy = shared.uSunDir.value.y;
		sunC.copy(shared.uSunColor.value).multiplyScalar(THREE.MathUtils.smoothstep(sy, -0.04, 0.1) * 2.2);
		U.uSunC.value.copy(sunC);
		U.uAmb.value.copy(shared.uAmbient.value);
		for (const v of E) v.set(0, 0, 0, 0);
		const high = cam.y - (W.island?.heightAt?.(cam.x, cam.z) ?? 0) > 150;
		let hiss = 0, rush = 0;

		// the sprinklers in reach, nearest first; the drops near, mist only further
		const rain = (shared.uWet?.value || 0) > 0.3;
		const list = high ? [] : sprinklers.heads(camera, hours, dt, force, rain, W.sky?.state?.sun?.rise ?? 6);
		for (const h of list) { h.k += ((h.on ? 1 : 0) - h.k) * Math.min(1, dt * 1.5); h.d = Math.hypot(h.x - cam.x, h.z - cam.z, h.y - cam.y); }
		last = list;
		const run = list.filter((h) => h.k > 0.01 && h.d < 140).sort((a, b) => a.d - b.d);
		for (let s = 0; s < NS && s < run.length; s++) {
			const h = run[s], b = s * 5, nearK = 1 - THREE.MathUtils.smoothstep(h.d, 48, 62);
			E[b].set(h.x, h.y, h.z, KIND[h.kind] ?? 1);
			// (a head that does not say its throw gets one for its radius)
			const el = h.el ?? 0.45, sp = h.sp ?? Math.min(11, Math.max(5.5, Math.sqrt(h.R * 9.81 / Math.sin(2 * el)) * 1.12));
			E[b + 1].set(h.a0, h.arc, sp, el);
			E[b + 2].set(h.y - 0.1, h.R, nearK * q, 1);
			E[b + 3].set(h.period || 30, h.ph || 0, 0, 0);
			E[b + 4].set(h.k, (1 - THREE.MathUtils.smoothstep(h.d, 100, 140)) * (h.kind === 2 ? 0.8 : 1), 0, 0);
			hiss += h.k * 0.02 / (1 + (h.d / 6) ** 2);
		}
		// the wet grass, nearest first
		const wetList = list.filter((h) => h.wet > 0.02 && h.d < 80).sort((a, b) => a.d - b.d).slice(0, ND);
		for (let d = 0; d < ND; d++) {
			const h = wetList.includes(wetOf[d]) ? wetOf[d] : null;
			if (!h) wetOf[d] = null;
		}
		for (const h of wetList) {
			if (wetOf.includes(h)) continue;
			const d = wetOf.indexOf(null);
			wetOf[d] = h; drape(d, h);
		}
		// (and the blade grass over it, where there is any: world/grass.js)
		const WS = shared.uWetS?.value || [];
		WS.forEach((v, k) => {
			const h = wetList[k];
			if (!h) return v.set(0, 0, 1, 0);
			const ac = h.a0 + h.arc / 2, off = h.arc > 6.2 ? 0 : h.R * 0.45;
			v.set(h.x + Math.cos(ac) * off, h.z + Math.sin(ac) * off, h.arc > 6.2 ? h.R : h.R * 0.75, h.wet * (1 - THREE.MathUtils.smoothstep(h.d, 50, 70)));
		});
		for (let d = 0; d < DECALS; d++) { const h = wetOf[d]; D[d].set(h ? h.wet * (1 - THREE.MathUtils.smoothstep(h.d, 60, 80)) : 0, h ? h.R * 1.05 : 1, 0, 0); }

		// the falls in reach, sized by their drop and their width
		fallT -= dt;
		if (fallT < 0 || Math.hypot(cam.x - fallAt.x, cam.z - fallAt.z) > 40) {
			fallT = 1.5; fallAt.x = cam.x; fallAt.z = cam.z;
			fallList = high ? [] : falls.near(cam.x, cam.z, 260);
		}
		const fl = fallList.map((f) => ({ f, d: Math.hypot(f.x - cam.x, f.z - cam.z, f.y - cam.y) })).sort((a, b) => a.d - b.d);
		for (let s = 0; s < NF && s < fl.length; s++) {
			const { f, d } = fl[s], b = (SLOTS - NF + s) * 5;
			const R = THREE.MathUtils.clamp(0.6 + f.drop * 0.35 + f.w * 0.15, 0.8, 8);
			const hard = Math.hypot(f.x - f.lx, f.z - f.lz) < f.drop * 1.5;
			E[b].set(f.x, f.y + 0.05, f.z, 3);
			E[b + 1].set(Math.max(0.4, f.w * (f.cave ? 1 : 0.8)), 0, THREE.MathUtils.clamp(Math.sqrt(19.6 * f.drop) * 0.4, 1.5, 7), 0.8);
			E[b + 2].set(f.y, R, (1 - THREE.MathUtils.smoothstep(d, 70, 100)) * q, f.cave ? -1 : 1);
			E[b + 3].set(f.lx, f.ly, f.lz, f.cave || hard ? 0.4 : 0);
			E[b + 4].set(1, 1 - THREE.MathUtils.smoothstep(d, 180, 260), 0, 0);
			rush += 0.05 * Math.min(1, R / 4) / (1 + (d / 12) ** 2);
		}
		sound(hiss, rush);
	}

	function dispose() {
		scene.remove(group);
		for (const m of [drops, mist, wet]) { m.geometry.dispose(); m.material.dispose(); }
		puff.dispose();
		stop();
	}
	return {
		group, update, dispose,
		// the quality switch: half the drops on low
		quality: (mode) => { q = mode === 'low' ? 0.5 : 1; },
		// every head on, whatever the hour (for a look at them)
		force: (on = true) => { force = !!on; },
		// the heads in reach just now
		heads: () => last,
		info: () => ({ yards: sprinklers.count(), falls: fallList.length, caveFalls: falls.caves().length }),
		falls: (x, z, r = 2000) => falls.near(x, z, r),
	};
}
