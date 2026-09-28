// The volcano, alive. On a volcanic world the great cone has a lava lake churning in its
// crater; old lava tubes run down its flanks, their roofs fallen in here and there so the
// melt shows through, breaking out lower down as open channels; spouts at the rim and on
// the slopes dribble lava that runs downhill, cooling from yellow to red to black crust.
//
// And it erupts like Old Faithful: every fifteen to twenty minutes, the wait set by the
// last eruption (a strong one is followed by a longer wait), so the next is always known.
// A few seconds of rumbling, then for a minute a fountain of lava stands over the crater,
// bombs rain on the flanks, an ash column climbs and spreads, and lava pours over the rim
// and runs down the cone. Then it crusts over, cools and dims for a couple of minutes.

import * as THREE from 'three';
import { mulberry32, makeNoise } from '../noise.js';
import { glow } from '../world/textures.js';
import { bombGeometry } from '../arenas.js';

const RUMBLE = 8, ERUPT = 60, COOL = 120;
const FLOWS = 12;

// The terrain paints the cone's ground with lava (world/terrain.js, plLava) from two
// uniforms: uErupt (centre x, centre z, reach, k), its front 1.15·k·reach from the centre,
// and uEruptT, seconds since the eruption began. Made here or there, whichever is first.
export function eruptUniforms(shared) {
	shared.uErupt ||= { value: new THREE.Vector4(0, 0, 0, 0) };
	shared.uEruptT ||= { value: 0 };
	return { uErupt: shared.uErupt, uEruptT: shared.uEruptT };
}

// ---------- shared GLSL ----------
const NOISE = /* glsl */`
float vh1(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 vh2(vec2 p){ p = mod(p, 289.0); return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vn1(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(vh1(i), vh1(i + vec2(1, 0)), f.x), mix(vh1(i + vec2(0, 1)), vh1(i + vec2(1, 1)), f.x), f.y); }
float vfb(vec2 p){ return vn1(p) * 0.5 + vn1(p * 2.03 + 3.1) * 0.3 + vn1(p * 4.1 - 1.7) * 0.2; }
float seams(vec2 p){ return 1.0 - smoothstep(0.0, 0.03, abs(vfb(p) - 0.5)); }
// crust plates: how near the edge of its plate a point is (x) and the plate's own number (y)
vec2 plates(vec2 p, float t){
	vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(float(x), float(y)), o = vh2(i + g);
		o = 0.5 + 0.38 * sin(t + 6.2831 * o);
		vec2 r = g + o - f; float d = dot(r, r);
		if (d < d1) { d2 = d1; d1 = d; id = vh1(i + g); } else if (d < d2) d2 = d;
	}
	return vec2(sqrt(d2) - sqrt(d1), id);
}
// black crust through dull red and orange to yellow-white
vec3 lavaCol(float h){
	vec3 c = mix(vec3(0.0), vec3(0.32, 0.02, 0.0), smoothstep(0.0, 0.3, h));
	c = mix(c, vec3(0.95, 0.2, 0.02), smoothstep(0.25, 0.6, h));
	c = mix(c, vec3(1.0, 0.58, 0.1), smoothstep(0.55, 0.85, h));
	return mix(c, vec3(1.0, 0.88, 0.5), smoothstep(0.88, 1.0, h));
}`;
// every surface here is drawn a little toward the eye (along the line of sight, so it does
// not move on screen), so it stays over the ground when the terrain far off is coarser
const PULL = '{ float pl = length(mvPosition.xyz); mvPosition.xyz *= max(0.0, 1.0 - min(pl * 0.012 + 0.12, 14.0) / max(pl, 0.5)); }';
const LIT = 'uniform vec3 uAmb, uSunC, uSunD;\nvec3 lit(vec3 c){ return c * (uAmb * 1.6 + uSunC * max(uSunD.y, 0.0) * 0.5); }';
const litU = (shared) => ({ uAmb: shared.uAmbient, uSunC: shared.uSunColor, uSunD: shared.uSunDir });

// basalt that glows from inside along its cracks: aHeat says how hot each part is, and an
// eruption heats everything within reach of its flows
function rockMat(shared) {
	const m = new THREE.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.92, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, { uTime: shared.uTime, uErupt: shared.uErupt });
		sh.vertexShader = 'attribute float aHeat; varying float vHeat; varying vec3 vM;\n' + sh.vertexShader
			.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
				vHeat = aHeat;
				{ vec4 q = vec4(transformed, 1.0);
				#ifdef USE_INSTANCING
				q = instanceMatrix * q;
				#endif
				vM = (modelMatrix * q).xyz; }`)
			.replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
				#ifdef USE_INSTANCING
				mvPosition = instanceMatrix * mvPosition;
				#endif
				mvPosition = modelViewMatrix * mvPosition;
				${PULL}
				gl_Position = projectionMatrix * mvPosition;`);
		sh.fragmentShader = 'vec3 glowV = vec3(0.0);\nvarying float vHeat; varying vec3 vM; uniform float uTime; uniform vec4 uErupt;\n' + NOISE + '\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				diffuseColor.rgb *= 0.6 + 0.65 * vfb(vM.xz * 1.3 + vM.y * 0.9);
				diffuseColor.rgb *= 1.0 - 0.3 * step(0.84, vh1(floor(vM.xz * 7.0 + vM.y * 5.0)));   // vesicles
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.07, 0.04), smoothstep(0.6, 0.85, vfb(vM.xz * 0.3 + 4.0)) * 0.5);   // oxide stains`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				{
					float s = seams(vM.xz * 1.6 + vM.y * 1.1) + seams(vM.yz * 1.9 + vM.x * 0.7) * 0.6;
					float pulse = 0.78 + 0.22 * sin(uTime * 1.3 + vfb(vM.xz * 0.5) * 9.0);
					float fr = uErupt.z * uErupt.w * 1.15, e = step(0.001, uErupt.w) * (1.0 - smoothstep(fr * 0.85, fr * 1.05, distance(vM.xz, uErupt.xy)));
					float h = vHeat * vHeat;
					glowV = vec3(1.0, 0.3, 0.03) * s * (h + e * 0.9) * pulse + vec3(0.6, 0.12, 0.01) * h * 0.45 * pulse;
				}`)
			.replace('#include <fog_fragment>', `#include <fog_fragment>
				gl_FragColor.rgb += glowV * exp(-length(vM - cameraPosition) * 0.002);`);
	};
	m.customProgramCacheKey = () => 'volcano-rock';
	return m;
}

// molten rock running along a ribbon (uv.x across, uv.y metres downstream): crust plates
// riding on a bright current, the middle faster and hotter than the banks. With FRONT it is
// an eruption's flow: it shows only as far as its front has run, crusting over behind it.
function lavaMat(shared, front) {
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFront: { value: 0 }, uCool: { value: 0 }, uFade: { value: 1 }, uOn: { value: new Array(FLOWS).fill(0) } }]);
	Object.assign(uniforms, { uTime: shared.uTime }, litU(shared));
	return new THREE.ShaderMaterial({
		uniforms, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
		defines: front ? { FRONT: 1, NFLOW: FLOWS } : {},
		vertexShader: `attribute float aHeat, aSpd, aWid; varying vec2 vU; varying float vHeat, vSpd, vWid;
			#ifdef FRONT
			attribute float aRate, aFlow; uniform float uFront, uOn[NFLOW]; varying float vFront;
			#endif
			#include <fog_pars_vertex>
			void main(){
				vU = uv; vHeat = aHeat; vSpd = aSpd; vWid = aWid;
				#ifdef FRONT
				vFront = uFront * aRate * uOn[int(aFlow + 0.5)];
				#endif
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				${PULL}
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: `uniform float uTime, uCool, uFade; varying vec2 vU; varying float vHeat, vSpd, vWid;
			#ifdef FRONT
			varying float vFront;
			#endif
			${NOISE}
			${LIT}
			#include <fog_pars_fragment>
			void main(){
				float x = vU.x, centre = 1.0 - abs(x - 0.5) * 2.0;
				float wob = (vn1(vec2(vU.y * 0.15, 3.0)) - 0.5) * 0.25;
				float edge = smoothstep(0.0, 0.2, x + wob) * smoothstep(1.0, 0.8, x + wob);
				float heat = vHeat, alpha = edge;
				#ifdef FRONT
				// the front: a rounded nose, the freshest lava hottest, crusting as it ages
				float nose = vFront - (1.0 - centre * centre) * vWid * 0.6;
				alpha *= 1.0 - smoothstep(nose - 2.0, nose, vU.y);
				float age = (vFront - vU.y) / 6.0;
				heat *= (1.0 - smoothstep(10.0, 70.0, age) * 0.5) * (1.0 - uCool * 0.85) + smoothstep(8.0, 0.0, vFront - vU.y) * 0.35;
				alpha *= uFade;
				#endif
				if (alpha < 0.01) discard;
				// the middle runs faster than the banks
				float t = uTime * vSpd * (0.45 + 0.8 * centre);
				vec2 q = vec2(x * vWid * 0.4, vU.y * 0.4 - t * 0.4);
				vec2 pl = plates(q, uTime * 0.25 + vU.y * 0.02);
				float crack = 1.0 - smoothstep(0.0, 0.05 + 0.09 * centre * heat, pl.x);
				float molten = smoothstep(0.6, 1.0, centre) * heat * (0.45 + 0.4 * step(0.72, pl.y));
				// drips and surges running down the stream
				float surge = pow(max(0.0, sin(vU.y * 0.5 - uTime * vSpd * 1.6 + pl.y * 2.0)), 6.0) * heat;
				float g = clamp(max(crack * heat, molten) + surge * 0.35 + (vfb(q * 2.0) - 0.5) * 0.25 * heat, 0.0, 1.0);
				vec3 crust = lit(vec3(0.06, 0.05, 0.045) * (0.7 + 0.6 * vfb(q * 3.0)));
				vec3 col = crust * (1.0 - g) + lavaCol(g) * 1.25;
				gl_FragColor = vec4(col, alpha);
				vec3 hotC = gl_FragColor.rgb;
				#include <fog_fragment>
				gl_FragColor.rgb = mix(gl_FragColor.rgb, hotC, g * 0.6);
			}`,
	});
}

// the lava lake in the crater: plates of crust wheeling slowly round the vent, splitting and
// rafting apart, fountaining where the melt breaks through
function lakeMat(shared, C, R) {
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uC: { value: new THREE.Vector2(C.x, C.z) }, uR: { value: R }, uHeat: { value: 0 } }]);
	Object.assign(uniforms, { uTime: shared.uTime }, litU(shared));
	return new THREE.ShaderMaterial({
		uniforms, fog: true,
		vertexShader: `varying vec3 vW;
			#include <fog_pars_vertex>
			void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;
			#include <fog_vertex>
			}`,
		fragmentShader: `uniform vec2 uC; uniform float uR, uTime, uHeat; varying vec3 vW;
			${NOISE}
			${LIT}
			#include <fog_pars_fragment>
			void main(){
				vec2 p = vW.xz - uC; float r = length(p);
				// the lake turns slowly and wells up from the middle
				float a = uTime * 0.012 * (1.0 + 30.0 / (r + 20.0)), c = cos(a), s = sin(a);
				vec2 q = mat2(c, s, -s, c) * p;
				q *= 1.0 - 0.1 * sin(uTime * 0.05 + r * 0.02);
				vec2 pl = plates(q * 0.09, uTime * 0.08);
				vec2 pl2 = plates(q * 0.3 + 11.0, uTime * 0.15);
				float churn = 0.5 + 0.5 * sin(uTime * 0.4 + pl.y * 40.0);
				float heat = 0.55 + 0.45 * uHeat;
				float crack = 1.0 - smoothstep(0.0, 0.06 + 0.14 * heat, pl.x);
				float fine = (1.0 - smoothstep(0.0, 0.05, pl2.x)) * 0.5;
				// some plates founder and the melt wells up where they were
				float open = smoothstep(0.82 - uHeat * 0.4, 0.95 - uHeat * 0.3, pl.y * 0.7 + churn * 0.3);
				float g = clamp(max(crack, fine * heat) * heat + open + (vfb(q * 0.2 - uTime * 0.03) - 0.5) * 0.3, 0.0, 1.0);
				g = max(g, uHeat * 0.75 * smoothstep(0.3, 0.9, vfb(q * 0.05 + uTime * 0.1)));
				vec3 crust = lit(vec3(0.05, 0.04, 0.035) * (0.7 + 0.6 * vfb(q * 0.8)));
				gl_FragColor = vec4(crust * (1.0 - g) + lavaCol(g) * 1.25, 1.0);
				vec3 hotC = gl_FragColor.rgb;
				#include <fog_fragment>
				gl_FragColor.rgb = mix(gl_FragColor.rgb, hotC, g * 0.7);
			}`,
	});
}

// camera-facing quads, one draw call for many: puffs of smoke, glows, heat shimmer
function billboards(shared, max, frag, blending, extra = {}) {
	const base = new THREE.PlaneGeometry(1, 1);
	const g = new THREE.InstancedBufferGeometry();
	g.index = base.index;
	g.setAttribute('position', base.attributes.position);
	g.setAttribute('uv', base.attributes.uv);
	const pos = new Float32Array(max * 3), size = new Float32Array(max * 2), col = new Float32Array(max * 4), rot = new Float32Array(max);
	const attr = (n, a, k) => { const b = new THREE.InstancedBufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, b); return b; };
	const A = { pos: attr('iPos', pos, 3), size: attr('iSize', size, 2), col: attr('iCol', col, 4), rot: attr('iRot', rot, 1) };
	g.instanceCount = max;
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFlick: { value: extra.flick ? 1 : 0 } }]);
	Object.assign(uniforms, { uTime: shared.uTime, uMap: { value: extra.map || null } }, litU(shared));
	const mat = new THREE.ShaderMaterial({
		uniforms, fog: !!extra.fog, transparent: true, depthWrite: false, blending,
		vertexShader: `attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iCol; attribute float iRot; uniform float uTime, uFlick;
			varying vec2 vU; varying vec4 vC; varying float vR;
			#include <fog_pars_vertex>
			void main(){
				vU = uv; vC = iCol; vR = iRot;
				float r = iRot * (1.0 - uFlick);
				vC.a *= mix(1.0, 0.78 + 0.22 * sin(uTime * 1.4 + iRot * 7.0) * sin(uTime * 0.53 + iRot * 3.0), uFlick);
				vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0);
				${PULL}
				mvPosition.xy += mat2(cos(r), sin(r), -sin(r), cos(r)) * (position.xy * iSize);
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: `uniform sampler2D uMap; uniform float uTime; varying vec2 vU; varying vec4 vC; varying float vR;
			${NOISE}
			${LIT}
			#include <fog_pars_fragment>
			void main(){ ${frag} }`,
	});
	const mesh = new THREE.Mesh(g, mat);
	mesh.frustumCulled = false;
	return { mesh, pos, size, col, rot, max, dirty() { for (const k in A) A[k].needsUpdate = true; } };
}

// a soft billowing puff for smoke and ash
function puffTex(seed) {
	const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
	const g = c.getContext('2d'), rr = mulberry32(seed);
	for (let i = 0; i < 30; i++) {
		const x = S / 2 + (rr() - 0.5) * S * 0.42, y = S / 2 + (rr() - 0.5) * S * 0.42, rad = S * (0.1 + rr() * 0.2);
		const gr = g.createRadialGradient(x, y, 0, x, y, rad);
		gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr; g.fillRect(0, 0, S, S);
	}
	return new THREE.CanvasTexture(c);
}

// a ribbon laid over the ground along a path; each point may carry its own width (w),
// height (y), heat and speed. uv.y is metres downstream.
function ribbonGeo(island, paths, across, lift) {
	const P = [], U = [], He = [], Sp = [], Wi = [], Ra = [], Fl = [], D = [], I = [];
	for (const path of paths) {
		const pts = path.pts, base = P.length / 3;
		let along = 0;
		for (let k = 0; k < pts.length; k++) {
			const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
			const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
			if (k) along += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
			const w = pts[k].w;
			for (let j = 0; j < across; j++) {
				const s = j / (across - 1) - 0.5, x = pts[k].x + nx * w * s, z = pts[k].z + nz * w * s;
				const g = island.heightAt(x, z);
				// a spilling lip is held up in the air; otherwise the ground, never under it
				const y = pts[k].y != null ? Math.max(g, pts[k].y - Math.abs(s) * 0.4) : g;
				P.push(x, y + lift, z);
				U.push(j / (across - 1), along);
				He.push(pts[k].heat ?? 1); Sp.push(path.spd || 1); Wi.push(w);
				Ra.push(path.rate || 1); Fl.push(path.flow || 0); D.push(along);
			}
		}
		for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j < across - 1; j++) {
			const a = base + k * across + j, b = a + 1, c = a + across, d = c + 1;
			I.push(a, c, b, b, c, d);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
	g.setAttribute('aHeat', new THREE.Float32BufferAttribute(He, 1));
	g.setAttribute('aSpd', new THREE.Float32BufferAttribute(Sp, 1));
	g.setAttribute('aWid', new THREE.Float32BufferAttribute(Wi, 1));
	g.setAttribute('aRate', new THREE.Float32BufferAttribute(Ra, 1));
	g.setAttribute('aFlow', new THREE.Float32BufferAttribute(Fl, 1));
	g.setIndex(I);
	g.computeBoundingSphere();
	return g;
}

export function createVolcano(island, shared, scene, camera, profile, opts = {}) {
	const none = { update() {}, state: () => ({ phase: 'none', next: Infinity, k: 0 }), erupt: () => 'no volcano on this world', floor: () => -Infinity, push() {}, dispose() {} };
	if (!island.peak || !(profile?.relief === 'volcano' || island.peak.volcanic)) return none;
	const isPhone = !!opts.isPhone;
	const H = (x, z) => island.heightAt(x, z);
	const r = mulberry32(island.seed ^ 0x7a1ca0);
	const nz = makeNoise(island.seed + 1709);
	const U = eruptUniforms(shared);
	const group = new THREE.Group(), near = new THREE.Group();
	group.name = 'volcano';
	group.add(near);
	scene.add(group);
	const cx = island.peak.x, cz = island.peak.z;

	// ---------- the shape of the mountain, as the land made it ----------
	// the rim: along each bearing, the highest ground within reach of the summit
	const RIMS = 48, rim = [];
	for (let i = 0; i < RIMS; i++) {
		const a = i / RIMS * Math.PI * 2;
		let best = -1e9, br = 20;
		for (let d = 6; d < 260; d += 2) { const h = H(cx + Math.cos(a) * d, cz + Math.sin(a) * d); if (h > best) { best = h; br = d; } }
		rim.push({ a, r: br, h: best });
	}
	const rimR = rim.map((q) => q.r).sort((a, b) => a - b)[RIMS >> 1];
	const rimLow = Math.min(...rim.map((q) => q.h)), rimMean = rim.reduce((s, q) => s + q.h, 0) / RIMS;
	const rimAt = (a) => rim[((Math.round(a / (Math.PI * 2) * RIMS) % RIMS) + RIMS) % RIMS];
	let floorH = 1e9;
	for (let x = -rimR; x <= rimR; x += 3) for (let z = -rimR; z <= rimR; z += 3) if (x * x + z * z < rimR * rimR * 0.8) floorH = Math.min(floorH, H(cx + x, cz + z));
	const lakeY = floorH + Math.max(2.5, (rimLow - floorH) * 0.42);
	const ventY = Math.max(lakeY, H(cx, cz)) + 0.5;
	// how far the cone reaches: where the ground round it has fallen to a third of the rim
	let coneR = rimR + 60;
	for (let d = rimR; d < 700; d += 10) {
		let s = 0;
		for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; s += H(cx + Math.cos(a) * d, cz + Math.sin(a) * d); }
		coneR = d;
		if (s / 16 < rimMean * 0.33) break;
	}
	const vent = new THREE.Vector3(cx, ventY, cz);

	// downhill from (x, z): a path that runs down the fall line, wandering a little
	function downhill(x, z, step, maxLen, wander, minH, seed) {
		const pts = [];
		let a = null, stuck = 0;
		for (let d = 0; d <= maxLen; d += step) {
			const y = H(x, z);
			pts.push({ x, z, y: null, g: y, d });
			if (y < minH) break;
			const e = 2, gx = H(x + e, z) - H(x - e, z), gz = H(x, z + e) - H(x, z - e);
			const da = Math.atan2(-gz, -gx);
			if (a == null) a = da;
			else a += Math.atan2(Math.sin(da - a), Math.cos(da - a)) * 0.4;
			a += (nz.vnoise(d * 0.04, seed) - 0.5) * wander;
			const nx = x + Math.cos(a) * step, nzz = z + Math.sin(a) * step;
			if (H(nx, nzz) > y + 0.3) { if (++stuck > 3) break; } else stuck = 0;
			x = nx; z = nzz;
		}
		return pts;
	}

	const rock = rockMat(shared);
	const segs = [];          // everything that pushes you out: {ax, az, bx, bz, hw, kind, flow, d}
	const roofs = [];         // tube roofs you can walk over: {ax, az, bx, bz, hw, y0, rise}
	const halos = [], shimmers = [], wisps = [], drips = [], sparks = [], holes = [];

	// ---------- the lava lake ----------
	const lakeGeo = new THREE.CircleGeometry(rimR * 1.1, 72).rotateX(-Math.PI / 2);
	const lake = new THREE.Mesh(lakeGeo, lakeMat(shared, vent, rimR));
	lake.position.set(cx, lakeY, cz);
	group.add(lake);
	halos.push({ x: cx, y: lakeY + 6, z: cz, s: rimR * 2.2, k: 0.5, big: true });
	for (let i = 0; i < 10; i++) {
		const a = r() * 6.283, d = Math.sqrt(r()) * rimR * 0.6, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
		if (H(x, z) < lakeY) { wisps.push({ x, y: lakeY, z, k: 1.4, big: 1 }); sparks.push({ x, y: lakeY, z, rate: 3, spread: 3 }); }
	}
	sparks.push({ x: cx, y: ventY, z: cz, rate: 8, spread: 4 });

	// ---------- lava tubes down the flanks ----------
	// partly collapsed: an arched rock roof over the stream, skylights where it has fallen
	// in, whole breaks lower down, and near the foot of the cone an open channel between levees
	const TUBES = isPhone ? 4 : 6, SIDES = isPhone ? 8 : 12;
	const tubeP = [], tubeH = [], tubeI = [];
	const tubeStreams = [], rubble = [];
	for (let t = 0; t < TUBES; t++) {
		const a0 = t / TUBES * Math.PI * 2 + r() * 0.7, d0 = rimR + 18 + r() * 45;
		const pts = downhill(cx + Math.cos(a0) * d0, cz + Math.sin(a0) * d0, 2.5, 200 + r() * 140, 0.5, 5, t * 7.3 + 1);
		if (pts.length < 24) continue;
		const n = pts.length, R = 2.2 + r() * 1.3, openFrom = Math.floor(n * (0.66 + r() * 0.12));
		// where the roof has gone: skylights (just the crown) and breaks (the whole arch)
		const hole = new Array(n).fill(0);
		for (let k = 8 + Math.floor(r() * 8); k < openFrom - 3; k += 9 + Math.floor(r() * 12)) {
			const brk = r() < 0.3, len = brk ? 4 + Math.floor(r() * 4) : 1 + Math.floor(r() * 2);
			for (let j = 0; j < len && k + j < openFrom; j++) hole[k + j] = brk ? 2 : 1;
		}
		for (let k = openFrom; k < n; k++) hole[k] = 3;
		// the floor line, smoothed so the arch does not step
		const ys = pts.map((p) => p.g);
		for (let pass = 0; pass < 3; pass++) for (let k = 1; k < n - 1; k++) ys[k] = (ys[k - 1] + ys[k] * 2 + ys[k + 1]) / 4;
		const rows = [];
		for (let k = 0; k < n; k++) {
			const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
			const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nzv = dx / l;
			// it comes up out of the slope at its head
			const rise = Math.min(1, k / 6), rk = R * (0.85 + 0.3 * nz.vnoise(k * 0.3, t * 3.1)) * (0.4 + 0.6 * rise);
			const row = [];
			for (let s = 0; s <= SIDES; s++) {
				const th = Math.PI * s / SIDES, sn = Math.sin(th);
				const bump = 0.85 + 0.3 * nz.fbm(k * 0.4 + s * 0.3, s * 0.21 + t * 5, 3);
				const lat = Math.cos(th) * rk * 1.15 * bump;
				const x = pts[k].x + nx * lat, z = pts[k].z + nzv * lat;
				const y = H(x, z) * (1 - sn) + (ys[k] + rk * 0.75 * bump) * sn - 0.5 - (1 - rise) * R * 0.6;
				tubeP.push(x, y, z);
				// the lower walls lit by the stream; the edges of holes glow
				const nearHole = hole[k] || hole[Math.max(0, k - 1)] || hole[Math.min(n - 1, k + 1)];
				tubeH.push(Math.max(0, 1 - sn * 1.3) * 0.6 + (nearHole ? 0.55 * sn : 0));
				row.push(tubeP.length / 3 - 1);
			}
			rows.push(row);
		}
		for (let k = 0; k < n - 1; k++) {
			const h = Math.max(hole[k], hole[k + 1]);
			if (h === 2) continue;
			for (let s = 0; s < SIDES; s++) {
				const f = (s + 0.5) / SIDES;
				if (h === 1 && f > 0.3 && f < 0.7) continue;
				if (h === 3 && f > 0.2 && f < 0.8) continue;
				const A = rows[k][s], B = rows[k][s + 1], C = rows[k + 1][s], D = rows[k + 1][s + 1];
				tubeI.push(A, B, C, B, D, C);
			}
		}
		// the stream along its floor, spreading in a fan where it leaves the channel
		const stream = pts.map((p, k) => ({ x: p.x, z: p.z, w: R * 1.5 * (k > n - 6 ? 1 + (k - n + 6) * 0.35 : 1), heat: k >= openFrom ? 1 - (k - openFrom) / (n - openFrom) * 0.55 : 1 }));
		tubeStreams.push({ pts: stream, spd: 0.7 });
		// what pushes you out, and the roofs you can walk over
		for (let k = 0; k < n - 1; k++) {
			const s = { ax: pts[k].x, az: pts[k].z, bx: pts[k + 1].x, bz: pts[k + 1].z, hw: R * 1.1, kind: 'tube' };
			if (hole[k] || hole[k + 1]) segs.push(s); else roofs.push({ ...s, hw: R * 1.12, y0: ys[k] - 0.5, rise: R * 0.75 });
		}
		// at each hole: glow, heat shimmer, steam, drips off the broken edge, rubble in the melt
		for (let k = 1; k < n; k++) {
			if (!hole[k] || hole[k - 1] === hole[k]) continue;
			const p = pts[k], y = ys[k];
			holes.push({ x: p.x, y, z: p.z, kind: ['', 'skylight', 'break', 'channel'][hole[k]] });
			if (hole[k] === 3) { halos.push({ x: p.x, y: y + 2, z: p.z, s: 14, k: 0.45 }); continue; }
			halos.push({ x: p.x, y: y + 1.5, z: p.z, s: 10, k: 0.55 });
			shimmers.push({ x: p.x, y: y + R * 0.8 + 2.5, z: p.z, w: R * 2.4, h: 6 });
			wisps.push({ x: p.x, y: y + R * 0.7, z: p.z, k: 0.5, big: 0 });
			drips.push({ x: p.x, y: y + R * 0.65, z: p.z, rate: 1.2, spread: R * 0.8, ground: y + 0.2 });
			sparks.push({ x: p.x, y: y + 0.4, z: p.z, rate: 0.6, spread: R * 0.6 });
			if (hole[k] === 2) for (let j = 0; j < 7; j++) rubble.push({ x: p.x + (r() - 0.5) * R * 3, z: p.z + (r() - 0.5) * R * 3, s: 0.4 + r() * 1.1, heat: 1 });
		}
		// blocks along the levees of the open channel
		for (let k = openFrom; k < n; k += 2) {
			const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
			for (const sd of [-1, 1]) {
				const off = R * (1.2 + r() * 0.5) * sd;
				rubble.push({ x: pts[k].x - (b.z - a.z) / l * off, z: pts[k].z + (b.x - a.x) / l * off, s: 0.3 + r() * 0.8, heat: 0.6 });
			}
		}
	}
	if (tubeI.length) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(tubeP, 3));
		g.setAttribute('aHeat', new THREE.Float32BufferAttribute(tubeH, 1));
		g.setIndex(tubeI);
		g.computeVertexNormals();
		const m = new THREE.Mesh(g, rock);
		m.userData.material175 = 'stone';
		group.add(m);
	}

	// ---------- spouts: little chimneys of spatter at the rim and on the slopes ----------
	// lava wells up in each and spills over the lip, dribbling down the mountain
	const spouts = [], rivulets = [];
	const RIM_S = isPhone ? 5 : 8, SIDE_S = isPhone ? 5 : 9;
	for (let i = 0; i < RIM_S + SIDE_S; i++) {
		const onRim = i < RIM_S;
		const a = onRim ? i / RIM_S * Math.PI * 2 + r() * 0.5 : r() * Math.PI * 2;
		const q = rimAt(a), d = onRim ? q.r + 1 : rimR + 30 + r() * (coneR * 0.65 - rimR - 30);
		const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, g = H(x, z);
		const h = 2.2 + r() * (onRim ? 3.5 : 2.5), w = 1.2 + r() * 1.2;
		spouts.push({ x, z, y: g, h, w, a });
		const lip = g + h * 0.92;
		// inward spouts spill down the crater wall into the lake, the rest down the flank
		const inward = onRim && i % 2 === 0;
		const sx = x + Math.cos(a) * (inward ? -w : w) * 1.2, sz = z + Math.sin(a) * (inward ? -w : w) * 1.2;
		const path = downhill(sx, sz, 2, inward ? 140 : 50 + r() * 110, 0.7, inward ? lakeY - 1 : 6, i * 13.7 + 5);
		const len = path[path.length - 1].d || 1;
		const pts = [{ x, z, y: lip, w: 0.5, heat: 1 }, ...path.map((p) => ({ x: p.x, z: p.z, w: (0.7 + r() * 0.2) * (1 + p.d / len * 0.6) * (inward ? 1.4 : 1), heat: 1 - Math.pow(p.d / len, 0.8) * 0.95 }))];
		rivulets.push({ pts, spd: 1.8 });
		halos.push({ x, y: lip + 1, z, s: 7, k: 0.6 });
		wisps.push({ x, y: lip + 0.5, z, k: 0.8, big: 0 });
		drips.push({ x, y: lip, z, rate: 3, spread: w * 0.5, ground: -1e9 });
		sparks.push({ x, y: lip, z, rate: 1.5, spread: 0.5 });
		if (!isPhone) shimmers.push({ x, y: lip + 3, z, w: 5, h: 7 });
		for (let k = 1; k < pts.length - 1; k++) if (pts[k].heat > 0.2) segs.push({ ax: pts[k].x, az: pts[k].z, bx: pts[k + 1].x, bz: pts[k + 1].z, hw: pts[k].w * 0.6 + 0.2, kind: 'rivulet' });
		for (let j = 0; j < 5; j++) { const b = r() * 6.283, dd = w * (1.2 + r() * 1.5); rubble.push({ x: x + Math.cos(b) * dd, z: z + Math.sin(b) * dd, s: 0.25 + r() * 0.6, heat: 0.4 }); }
	}
	// the chimneys: open at the top, hot at the lip
	const spoutGeo = (() => {
		const g = new THREE.CylinderGeometry(0.28, 1, 1, 11, 6, true), p = g.attributes.position, c = [];
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.75 + nz.fbm(x * 2 + 4, z * 2 + y * 3, 3) * 0.55;
			p.setXYZ(i, x * k, y + 0.5, z * k);
			c.push(Math.pow(Math.max(0, y + 0.5), 3) * 1.1 + (y < -0.4 ? 0.3 : 0));
		}
		g.setAttribute('aHeat', new THREE.Float32BufferAttribute(c, 1));
		g.computeVertexNormals();
		return g;
	})();
	const spoutIM = new THREE.InstancedMesh(spoutGeo, rock, spouts.length);
	const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
	spouts.forEach((o, i) => { e4.set((r() - 0.5) * 0.2, r() * 6.28, (r() - 0.5) * 0.2); q4.setFromEuler(e4); s4.set(o.w, o.h, o.w); p4.set(o.x, o.y - 0.4, o.z); spoutIM.setMatrixAt(i, m4.compose(p4, q4, s4)); });
	spoutIM.userData.material175 = 'stone';
	group.add(spoutIM);

	// rubble: broken crust round the spouts, in the breaks and along the channels; and
	// spatter blocks on the crater rim
	for (let i = 0; i < (isPhone ? 30 : 70); i++) {
		const q = rim[Math.floor(r() * RIMS)], d = q.r + (r() - 0.5) * 16;
		rubble.push({ x: cx + Math.cos(q.a) * d, z: cz + Math.sin(q.a) * d, s: 0.4 + Math.pow(r(), 2) * 2.2, heat: 0.25 });
	}
	const blockGeo = (() => {
		const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, c = [];
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.7 + nz.fbm(x * 1.8 - 2, z * 1.8 + y, 3) * 0.6;
			p.setXYZ(i, x * k * 1.2, y * k * 0.7, z * k);
			c.push(Math.max(0, -y * 1.3 - 0.1));
		}
		g.setAttribute('aHeat', new THREE.Float32BufferAttribute(c, 1));
		g.computeVertexNormals();
		return g;
	})();
	const rubbleList = rubble.slice(0, isPhone ? 160 : 420);
	const rubbleIM = new THREE.InstancedMesh(blockGeo, rock, rubbleList.length);
	rubbleList.forEach((o, i) => { e4.set(r() * 1.2, r() * 6.28, r() * 1.2); q4.setFromEuler(e4); s4.set(o.s * (0.8 + r() * 0.5), o.s * (0.6 + r() * 0.6), o.s); p4.set(o.x, H(o.x, o.z) + o.s * 0.15, o.z); rubbleIM.setMatrixAt(i, m4.compose(p4, q4, s4)); });
	near.add(rubbleIM);

	// the streams in the tubes and the rivulets from the spouts: one draw call
	const streamMesh = new THREE.Mesh(ribbonGeo(island, [...tubeStreams, ...rivulets], isPhone ? 3 : 4, 0.18), lavaMat(shared, false));
	streamMesh.renderOrder = 2;
	group.add(streamMesh);

	// ---------- the eruption's flows: over the rim and down the cone ----------
	const flowPaths = [];
	for (let i = 0; i < (isPhone ? 8 : FLOWS); i++) {
		const a = i / FLOWS * Math.PI * 2 + (r() - 0.5) * 0.4, q = rimAt(a);
		const path = downhill(cx + Math.cos(a) * (q.r + 5), cz + Math.sin(a) * (q.r + 5), 4, 460, 0.35, 4, i * 3.3 + 50);
		const len = path[path.length - 1].d || 1, w0 = 6 + r() * 6;
		// from the lip of the crater down the outer wall to where it leaves the rim
		const lip = [];
		for (let d = q.r - 10; d < q.r + 5; d += 3) lip.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, w: w0 * 0.7 });
		const pts = [...lip, ...path.map((p) => ({ x: p.x, z: p.z, w: w0 * (1 + p.d / len * 0.9) * (0.8 + 0.4 * nz.vnoise(p.d * 0.03, i * 2.1)) }))];
		flowPaths.push({ pts, spd: 1.2, rate: 0.75 + r() * 0.5, flow: i });
		let along = 0;
		for (let k = 0; k < pts.length - 1; k++) {
			along += k ? Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z) : 0;
			segs.push({ ax: pts[k].x, az: pts[k].z, bx: pts[k + 1].x, bz: pts[k + 1].z, hw: pts[k].w * 0.45, kind: 'flow', flow: i, d: along, rate: flowPaths[i].rate });
		}
	}
	const flowMat = lavaMat(shared, true);
	const flowMesh = new THREE.Mesh(ribbonGeo(island, flowPaths, isPhone ? 5 : 7, 0.3), flowMat);
	flowMesh.renderOrder = 3;
	flowMesh.visible = false;
	group.add(flowMesh);

	// ---------- the cone's skin of magma in an eruption ----------
	// a sheet draped over the whole cone: black crust split by bright rivers of melt running
	// down it, out as far as the terrain's lava front, then crusting over and fading
	const skin = (() => {
		const RINGS = isPhone ? 36 : 60, SEGS = isPhone ? 96 : 168, r0 = rimR * 0.7, r1 = coneR * 1.25;
		const P = [], A = [], I = [];
		for (let i = 0; i <= RINGS; i++) {
			const d = r0 + (r1 - r0) * Math.pow(i / RINGS, 1.3);
			for (let j = 0; j <= SEGS; j++) {
				const a = j / SEGS * Math.PI * 2, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, g = H(x, z);
				P.push(x, g + 0.35, z);
				// none in the lake or the sea
				A.push((d > rimR * 1.1 || g > lakeY + 0.6) && g > 1.2 ? 1 : 0);
			}
		}
		for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEGS; j++) {
			const a = i * (SEGS + 1) + j, b = a + 1, c = a + SEGS + 1, e = c + 1;
			I.push(a, c, b, b, c, e);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('aOk', new THREE.Float32BufferAttribute(A, 1));
		g.setIndex(I);
		g.computeBoundingSphere();
		const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uC: { value: new THREE.Vector2(cx, cz) }, uFront: { value: 0 }, uCool: { value: 0 }, uFade: { value: 1 } }]);
		Object.assign(uniforms, { uTime: shared.uTime, uEruptT: U.uEruptT }, litU(shared));
		const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
			uniforms, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
			vertexShader: `attribute float aOk; varying vec3 vW; varying float vOk;
				#include <fog_pars_vertex>
				void main(){ vOk = aOk; vW = position; vec4 mvPosition = viewMatrix * vec4(position, 1.0);
				${PULL}
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
				}`,
			fragmentShader: `uniform vec2 uC; uniform float uFront, uCool, uFade, uTime, uEruptT; varying vec3 vW; varying float vOk;
				${NOISE}
				${LIT}
				#include <fog_pars_fragment>
				void main(){
					vec2 p = vW.xz - uC; float r = length(p), ang = atan(p.y, p.x);
					// tongues of lava, the front ragged
					float tongue = vfb(vec2(ang * 6.0, 1.7)) * 0.7 + vfb(p * 0.03) * 0.3;
					float edge = uFront - r - tongue * 60.0;
					float a = smoothstep(0.0, 10.0, edge) * smoothstep(0.3, 0.9, vOk) * uFade;
					if (a < 0.01) discard;
					// running downhill: coordinates that stream outward from the crater
					vec2 q = p * 0.2 - p / max(r, 1.0) * uEruptT * 0.8;
					float river = smoothstep(0.52, 0.75, vfb(vec2(ang * 9.0 + vn1(vec2(r * 0.02, 0.0)) * 1.5, r * 0.004 - uEruptT * 0.01)));
					vec2 pl = plates(q, uTime * 0.2), pl2 = plates(q * 2.3 + 7.0, uTime * 0.3);
					float crack = max(1.0 - smoothstep(0.0, 0.05, pl.x + (vn1(q * 3.0) - 0.5) * 0.06), (1.0 - smoothstep(0.0, 0.04, pl2.x)) * 0.45);
					float heat = (1.0 - uCool * 0.9) * (0.55 + 0.45 * smoothstep(0.0, 60.0, uFront - r));
					// the front and the fresh rivers hottest
					float g = max(crack * (0.55 + 0.4 * river), river * (0.6 + 0.4 * vfb(q * 0.5))) * heat;
					g += smoothstep(25.0, 0.0, edge) * 0.35 * (1.0 - uCool);
					g = clamp(g + (vfb(q * 1.3) - 0.5) * 0.2 * heat, 0.0, 1.0);
					vec3 crust = lit(vec3(0.07, 0.055, 0.05) * (0.6 + 0.7 * vfb(q * 2.0)));
					gl_FragColor = vec4(crust * (1.0 - g) + lavaCol(g) * 1.3, min(1.0, a * 1.2));
					vec3 hotC = gl_FragColor.rgb;
					#include <fog_fragment>
					gl_FragColor.rgb = mix(gl_FragColor.rgb, hotC, g * 0.6);
				}`,
		}));
		m.renderOrder = 1;
		m.visible = false;
		m.frustumCulled = false;
		return m;
	})();
	group.add(skin);

	// ---------- the glows, the heat shimmer, the smoke ----------
	const glowTex = glow();
	const haloB = billboards(shared, halos.length + 6, 'vec4 t = texture2D(uMap, vU); gl_FragColor = vec4(vC.rgb * t.a * vC.a, 1.0);', THREE.AdditiveBlending, { map: glowTex, flick: true });
	halos.forEach((h, i) => { haloB.pos.set([h.x, h.y, h.z], i * 3); haloB.size.set([h.s, h.s * (h.big ? 0.5 : 0.7)], i * 2); haloB.col.set([1, 0.3, 0.05, h.k], i * 4); haloB.rot[i] = r() * 6.28; });
	// the sky over the crater lit from below in an eruption (the last six)
	const skyGlow0 = halos.length;
	for (let i = 0; i < 6; i++) haloB.rot[skyGlow0 + i] = r() * 6.28;
	haloB.dirty();
	haloB.mesh.renderOrder = 9;
	group.add(haloB.mesh);

	let shimB = null;
	if (shimmers.length) {
		// heat shimmer: faint wavering streaks of bright air over the hottest places
		shimB = billboards(shared, shimmers.length, `
			float t = uTime;
			float wv = sin(vU.y * 22.0 - t * 7.0 + vR * 5.0 + sin(vU.x * 9.0 + t * 2.0) * 1.5) * 0.5 + 0.5;
			float n = vn1(vec2(vU.x * 7.0 + sin(vU.y * 6.0 - t * 3.0) * 0.6, vU.y * 3.0 - t * 1.8 + vR));
			float a = smoothstep(0.55, 0.95, n) * wv * sin(vU.x * 3.1416) * sin(vU.y * 3.1416) * vC.a;
			gl_FragColor = vec4(vec3(1.0, 0.72, 0.45) * a * 0.22, 1.0);`, THREE.AdditiveBlending);
		shimmers.forEach((h, i) => { shimB.pos.set([h.x, h.y, h.z], i * 3); shimB.size.set([h.w, h.h], i * 2); shimB.col.set([1, 1, 1, 1], i * 4); shimB.rot[i] = r() * 6; });
		shimB.dirty();
		shimB.mesh.material.uniforms.uFlick.value = 1;   // stays upright
		shimB.mesh.renderOrder = 8;
		near.add(shimB.mesh);
	}

	// smoke: steam from the vents, and in an eruption the ash column. Each puff is lit
	// orange from below by the fire (the fourth colour channel of iCol is its opacity)
	const PUFFS = isPhone ? 110 : 260;
	const smokeB = billboards(shared, PUFFS, `
		vec4 t = texture2D(uMap, vU);
		float a = t.a * vC.a;
		if (a < 0.004) discard;
		// vC.rgb: x the fire under it, y how pale (steam) it is
		vec3 ash = mix(vec3(0.16, 0.15, 0.14), vec3(0.78, 0.76, 0.74), vC.g);
		vec3 c = lit(ash) + vec3(1.0, 0.35, 0.06) * vC.r * (0.5 + 0.5 * t.a);
		gl_FragColor = vec4(c, a);
		#include <fog_fragment>`, THREE.NormalBlending, { map: puffTex(island.seed), fog: true });
	smokeB.mesh.renderOrder = 7;
	group.add(smokeB.mesh);
	const puff = { x: new Float32Array(PUFFS), y: new Float32Array(PUFFS), z: new Float32Array(PUFFS), vx: new Float32Array(PUFFS), vy: new Float32Array(PUFFS), vz: new Float32Array(PUFFS), age: new Float32Array(PUFFS).fill(1e9), life: new Float32Array(PUFFS).fill(1), s0: new Float32Array(PUFFS), s1: new Float32Array(PUFFS), pale: new Float32Array(PUFFS), fire: new Float32Array(PUFFS), op: new Float32Array(PUFFS), spin: new Float32Array(PUFFS) };
	let puffHead = 0;
	function addPuff(x, y, z, vx, vy, vz, life, s0, s1, pale, fire, op) {
		const i = puffHead; puffHead = (puffHead + 1) % PUFFS;
		puff.x[i] = x; puff.y[i] = y; puff.z[i] = z; puff.vx[i] = vx; puff.vy[i] = vy; puff.vz[i] = vz;
		puff.age[i] = 0; puff.life[i] = life; puff.s0[i] = s0; puff.s1[i] = s1; puff.pale[i] = pale; puff.fire[i] = fire; puff.op[i] = op;
		puff.spin[i] = (Math.random() - 0.5) * 0.3; smokeB.rot[i] = Math.random() * 6.28;
	}

	// ---------- sparks, drips and the fountain's spray: one cloud of points ----------
	// kinds: 0 an ember rising, 1 a drop of lava falling, 2 the fountain's spray
	const PN = isPhone ? 1600 : 5000;
	const pP = new Float32Array(PN * 3).fill(-1e5), pV = new Float32Array(PN * 3), pLife = new Float32Array(PN).fill(1), pAge = new Float32Array(PN).fill(1e9), pMax = new Float32Array(PN).fill(1), pKind = new Float32Array(PN), pGround = new Float32Array(PN);
	const pGeo = new THREE.BufferGeometry();
	pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3).setUsage(THREE.DynamicDrawUsage));
	pGeo.setAttribute('aLife', new THREE.BufferAttribute(pLife, 1).setUsage(THREE.DynamicDrawUsage));
	pGeo.setAttribute('aKind', new THREE.BufferAttribute(pKind, 1).setUsage(THREE.DynamicDrawUsage));
	const pMat = new THREE.ShaderMaterial({
		uniforms: { uMap: { value: glowTex }, uScale: { value: 800 } },
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
		vertexShader: `attribute float aLife, aKind; varying float vL, vK; uniform float uScale;
			void main(){ vL = aLife; vK = aKind; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			${PULL}
			gl_Position = projectionMatrix * mvPosition;
			float s = aKind < 0.5 ? 0.14 : (aKind < 1.5 ? 0.32 : 1.6);
			gl_PointSize = clamp(s * (1.0 - aLife * 0.4) * uScale / max(0.5, -mvPosition.z), aKind > 1.5 ? 2.0 : 1.2, 48.0); }`,
		fragmentShader: `uniform sampler2D uMap; varying float vL, vK;
			void main(){ vec4 t = texture2D(uMap, gl_PointCoord);
				vec3 hot = vK > 1.5 ? vec3(1.0, 0.8, 0.4) : vec3(1.0, 0.62, 0.18);
				vec3 c = mix(hot, vec3(0.8, 0.12, 0.01), smoothstep(0.1, 0.8, vL));
				gl_FragColor = vec4(c * 1.6 * t.a * (1.0 - smoothstep(0.75, 1.0, vL)), 1.0); }`,
	});
	const points = new THREE.Points(pGeo, pMat);
	points.frustumCulled = false;
	points.renderOrder = 10;
	group.add(points);
	let pHead = 0;
	function addP(kind, x, y, z, vx, vy, vz, life, ground) {
		const i = pHead; pHead = (pHead + 1) % PN;
		pP[i * 3] = x; pP[i * 3 + 1] = y; pP[i * 3 + 2] = z; pV[i * 3] = vx; pV[i * 3 + 1] = vy; pV[i * 3 + 2] = vz;
		pAge[i] = 0; pMax[i] = life; pKind[i] = kind; pGround[i] = ground;
	}

	// ---------- the fountain: blobs of lava thrown up in arcs, bombs out onto the flanks ----------
	const BN = isPhone ? 140 : 380;
	// (clots of lava, lumpy and crusted: not balls)
	const blobs = new THREE.InstancedMesh(bombGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, vertexColors: true }), BN);
	blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	blobs.setColorAt(0, new THREE.Color());
	blobs.frustumCulled = false;
	blobs.count = 0;
	group.add(blobs);
	const bl = [];
	for (let i = 0; i < BN; i++) bl.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), s: 1, age: 1e9, bomb: false, spin: new THREE.Vector3() });
	let blHead = 0;
	// a share of the bombs can be asked for: aims.target() gives somewhere to throw one (or
	// null), aims.landed() hears where it came down (sportsfields.js: the magma arena's balls)
	const aims = { target: null, landed: null };
	// the bright column itself, crossed sheets of spray standing over the vent
	const jetMat = new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uK: { value: 0 } },
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
		vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime, uK; varying vec2 vU;
			${NOISE}
			void main(){
				float n = vfb(vec2(vU.x * 5.0, vU.y * 4.0 - uTime * 2.4));
				float core = 1.0 - smoothstep(0.0, 0.5, abs(vU.x - 0.5) * 2.0 * (0.5 + vU.y * 0.9));
				float a = core * smoothstep(1.0, 0.25, vU.y) * smoothstep(0.3, 0.7, n + (1.0 - vU.y) * 0.35) * uK;
				vec3 c = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.3, 0.03), smoothstep(0.0, 0.7, vU.y));
				gl_FragColor = vec4(c * a * 1.6, 1.0);
			}`,
	});
	const jet = new THREE.Group();
	for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), jetMat); m.rotation.y = i * Math.PI / 3; jet.add(m); }
	jet.position.copy(vent);
	jet.visible = false;
	group.add(jet);

	// bombs that land leave a splash of lava on the ground, cooling where it fell
	const SPL = isPhone ? 40 : 100;
	const splGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
	const splBorn = new THREE.InstancedBufferAttribute(new Float32Array(SPL).fill(-1e9), 1);
	splBorn.setUsage(THREE.DynamicDrawUsage);
	splGeo.setAttribute('iBorn', splBorn);
	const splU = { uClock: { value: 0 }, uTime: shared.uTime, ...litU(shared) };
	const splats = new THREE.InstancedMesh(splGeo, new THREE.ShaderMaterial({
		uniforms: splU, transparent: true, depthWrite: false,
		vertexShader: `attribute float iBorn; uniform float uClock; varying vec2 vU; varying float vH;
			void main(){ vU = position.xz; vH = exp(-(uClock - iBorn) / 18.0) * step(iBorn, uClock);
			vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
			${PULL}
			gl_Position = projectionMatrix * mvPosition; }`,
		fragmentShader: `uniform float uTime; varying vec2 vU; varying float vH;
			${NOISE}
			${LIT}
			void main(){
				float r = length(vU) + (vn1(vU * 3.0) - 0.5) * 0.5;
				float a = (1.0 - smoothstep(0.6, 0.95, r)) * smoothstep(0.0, 0.08, vH);
				if (a < 0.01) discard;
				float g = clamp(vH * (1.2 - r) * (0.6 + 0.6 * seams(vU * 2.0 + 5.0)), 0.0, 1.0);
				gl_FragColor = vec4(lit(vec3(0.05, 0.04, 0.035)) * (1.0 - g) + lavaCol(g) * 1.2, a);
			}`,
	}), SPL);
	splats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	splats.frustumCulled = false;
	for (let i = 0; i < SPL; i++) splats.setMatrixAt(i, m4.makeScale(0, 0, 0));
	splats.renderOrder = 4;
	group.add(splats);
	let splHead = 0;
	function splash(x, z, size, clock) {
		const i = splHead; splHead = (splHead + 1) % SPL;
		const n = island.normalAt(x, z);
		q4.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n.x, n.y, n.z));
		const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
		s4.set(size * (0.8 + Math.random() * 0.5), 1, size);
		splats.setMatrixAt(i, m4.compose(p4.set(x, H(x, z) + 0.15, z), q4.multiply(spin), s4));
		splats.instanceMatrix.needsUpdate = true;
		splBorn.array[i] = clock; splBorn.needsUpdate = true;
	}

	// ---------- light ----------
	// the lake lights the crater; an eruption lights the whole island
	const light = new THREE.PointLight(0xff6a22, 0, 2600, 1);
	light.position.set(cx, ventY + 25, cz);
	group.add(light);
	let hemi = null;
	scene.traverse((o) => { if (o.isHemisphereLight) hemi = o; });
	const fire = new THREE.Color(1.0, 0.42, 0.14);

	// ---------- sound: the low rumble, the bubbling lake, the roar ----------
	const snd = { c: null, bus: null, rum: null, roar: null, nextBub: 0, srcs: [] };
	function audio() {
		const b = window._masterClip || window.leadBus227, c = b?.context;
		if (!c || c.state !== 'running') return null;
		if (snd.c === c) return snd;
		try {
			snd.c = c;
			snd.bus = c.createGain(); snd.bus.gain.value = 0.8; snd.bus.connect(b);
			const loop = (brown) => {
				const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = buf.getChannelData(0);
				let last = 0;
				for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = brown ? last * 0.985 + w * 0.015 : w; d[i] = brown ? last * 6 : w * 0.5; }
				const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); snd.srcs.push(s); return s;
			};
			const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90;
			snd.rum = c.createGain(); snd.rum.gain.value = 0;
			loop(true).connect(lp).connect(snd.rum).connect(snd.bus);
			const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.5;
			const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1200;
			snd.roar = c.createGain(); snd.roar.gain.value = 0;
			loop(false).connect(bp).connect(lp2).connect(snd.roar).connect(snd.bus);
		} catch { snd.c = null; return null; }
		return snd;
	}
	// a single bubble bursting, or a bomb landing (low)
	function blip(level, low) {
		const c = snd.c, t0 = c.currentTime;
		const o = c.createOscillator(), g = c.createGain();
		const f = low ? 38 + Math.random() * 20 : 70 + Math.random() * 160;
		o.frequency.setValueAtTime(f, t0);
		o.frequency.exponentialRampToValueAtTime(low ? f * 0.6 : f * 1.9, t0 + (low ? 0.5 : 0.09));
		g.gain.setValueAtTime(0, t0);
		g.gain.linearRampToValueAtTime(level, t0 + 0.006);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + (low ? 0.7 : 0.14));
		o.connect(g).connect(snd.bus);
		o.start(t0); o.stop(t0 + (low ? 0.8 : 0.2));
	}

	// ---------- pushing you out of the lava ----------
	const CELL = 16, grid = new Map();
	const key = (i, j) => i * 73856 + j;
	for (const s of [...segs, ...roofs.map((q) => ({ ...q, roof: true }))]) {
		const x0 = Math.floor((Math.min(s.ax, s.bx) - s.hw) / CELL), x1 = Math.floor((Math.max(s.ax, s.bx) + s.hw) / CELL);
		const z0 = Math.floor((Math.min(s.az, s.bz) - s.hw) / CELL), z1 = Math.floor((Math.max(s.az, s.bz) + s.hw) / CELL);
		for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
	}
	// nearest point on a segment: distance, and the side you are on
	const onSeg = (s, x, z) => {
		const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
		const px = s.ax + dx * t, pz = s.az + dz * t;
		return { d: Math.hypot(x - px, z - pz), px, pz, t };
	};
	let flowFront = 0, flowLive = false;
	const flowOn = new Array(FLOWS).fill(0);
	// a tube's roof, where you walk over it
	function floor(x, z, y) {
		let best = -Infinity;
		for (const s of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || []) {
			if (!s.roof) continue;
			const o = onSeg(s, x, z);
			if (o.d >= s.hw) continue;
			const top = s.y0 + s.rise * Math.sqrt(1 - (o.d / s.hw) ** 2);
			if (y > top - 1.4 && top > best) best = top;
		}
		return best;
	}
	function push(p, footY) {
		const g = H(p.x, p.z);
		if (footY > Math.max(g, floor(p.x, p.z, footY)) + 1.5) return;
		// the lake: out and up the crater wall
		const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
		if (d < rimR * 1.1 && g < lakeY + 0.5) {
			const ux = d > 0.1 ? dx / d : 1, uz = d > 0.1 ? dz / d : 0;
			for (let rr = d; rr < rimR * 1.6; rr += 0.5) if (H(cx + ux * rr, cz + uz * rr) > lakeY + 0.8) { p.x = cx + ux * rr; p.z = cz + uz * rr; break; }
			return;
		}
		for (const s of grid.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL))) || []) {
			if (s.roof) continue;
			if (s.kind === 'flow' && !(flowLive && flowOn[s.flow] && s.d < flowFront * s.rate)) continue;
			const o = onSeg(s, p.x, p.z);
			if (o.d >= s.hw + 0.3) continue;
			let nx = p.x - o.px, nzz = p.z - o.pz;
			const l = Math.hypot(nx, nzz);
			if (l < 1e-3) { nx = -(s.bz - s.az); nzz = s.bx - s.ax; } else { nx /= l; nzz /= l; }
			const nl = Math.hypot(nx, nzz) || 1;
			p.x = o.px + nx / nl * (s.hw + 0.35); p.z = o.pz + nzz / nl * (s.hw + 0.35);
		}
	}

	// ---------- the cadence ----------
	// Old Faithful: a strong eruption is followed by a long wait, a weak one by a short one,
	// so once one has gone the next is known: 15 minutes after a feeble one, 20 after the
	// strongest. The strengths themselves come in two kinds, weak and strong.
	const rc = mulberry32(island.seed ^ 0x0f417f);
	const draw = () => (rc() < 0.33 ? rc() * 0.35 : 0.6 + rc() * 0.4);
	let clock = 0, count = 0, cur = -1e9, vigor = draw(), nextVigor = vigor;
	let next = (4 + rc() * 5) * 60;   // the first a few minutes after you land
	const interval = (v) => (15 + 5 * v) * 60;
	function begin() {
		cur = next; vigor = nextVigor; count++;
		skinFront = 0;
		next = cur + interval(vigor);
		nextVigor = draw();
		// which of the flow paths this one pours down
		const rf = mulberry32(island.seed + count * 977);
		let on = 0;
		for (let i = 0; i < FLOWS; i++) { flowOn[i] = rf() < 0.35 + vigor * 0.45 ? 1 : 0; on += flowOn[i]; }
		if (on < 3) for (let i = 0; i < 3; i++) flowOn[Math.floor(rf() * FLOWS)] = 1;
		flowMat.uniforms.uOn.value = flowOn.slice();
	}
	function phase() {
		const s = clock - cur;
		if (s >= 0 && s < ERUPT) return 'erupting';
		if (next - clock <= RUMBLE) return 'rumble';
		if (s >= 0 && s < ERUPT + COOL) return 'cooling';
		return 'quiet';
	}
	// heat: how hot the cone is (0..1), rising through the eruption and cooling after it
	function heatAt(s) {
		if (s < 0) return 0;
		if (s < ERUPT) return THREE.MathUtils.smoothstep(s, 0, 12);
		return Math.exp(-(s - ERUPT) / 35) * (1 - THREE.MathUtils.smoothstep(s, ERUPT + COOL - 30, ERUPT + COOL));
	}
	// the fountain: up in a few seconds, surging, dying away at the end of the minute
	function fountainAt(s) {
		if (s < 0 || s > ERUPT) return 0;
		const surge = 0.5 + 0.5 * Math.sin(s * 0.9) * Math.sin(s * 0.37 + 1);
		return THREE.MathUtils.smoothstep(s, 0, 3) * (1 - THREE.MathUtils.smoothstep(s, ERUPT - 8, ERUPT)) * (0.75 + 0.25 * surge);
	}

	const tmpC = new THREE.Color();
	const emit = { spark: 0, drip: 0, wisp: 0, spray: 0, blob: 0, ash: 0 };
	let lastK = 0, skinFront = 0;
	function update(dt, t) {
		dt = Math.min(dt, 0.05);
		clock += dt;
		if (clock >= next) begin();
		const s = clock - cur, ph = phase();
		const k = heatAt(s), f = fountainAt(s);
		const rumble = ph === 'rumble' ? 1 - (next - clock) / RUMBLE : 0;
		const cam = camera.position, dist = Math.hypot(cam.x - cx, cam.z - cz), distK = 1 / (1 + dist / 400);
		const night = 1 - THREE.MathUtils.smoothstep(shared.uSunDir.value.y, -0.05, 0.25);
		near.visible = dist < (isPhone ? 700 : 1100);
		lastK = k;

		// the terrain's lava (world/terrain.js): its front reaches 1.15·w·z from the crater, so
		// z is the whole cone and w the share of it covered: spreading down through the
		// eruption, drawing back up as it cools
		const spread = rimR + (coneR - rimR) * THREE.MathUtils.smoothstep(s, 0, ERUPT);
		const front = s < 0 ? 0 : s < ERUPT ? spread * THREE.MathUtils.smoothstep(s, 0, 4) : coneR * Math.pow(k, 0.6);
		U.uErupt.value.set(cx, cz, coneR, front / (1.15 * coneR));
		U.uEruptT.value = Math.max(0, s);
		flowLive = s >= 0 && s < ERUPT + COOL;
		flowMesh.visible = flowLive;
		if (flowLive) {
			flowFront = s < ERUPT ? s * 6.5 : ERUPT * 6.5 + 40 * (1 - Math.exp(-(s - ERUPT) / 30));
			flowMat.uniforms.uFront.value = flowFront;
			flowMat.uniforms.uCool.value = THREE.MathUtils.smoothstep(s, ERUPT - 10, ERUPT + COOL * 0.8);
			flowMat.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(s, ERUPT + COOL - 25, ERUPT + COOL);
		}
		skin.visible = flowLive;
		if (flowLive) {
			const su = skin.material.uniforms;
			// it stays where it ran to, crusting over
			skinFront = Math.max(skinFront, s < ERUPT ? front : coneR);
			su.uFront.value = skinFront;
			su.uCool.value = flowMat.uniforms.uCool.value;
			su.uFade.value = flowMat.uniforms.uFade.value;
		}
		lake.material.uniforms.uHeat.value = Math.max(k, rumble * 0.4);
		lake.position.y = lakeY + k * 3 + rumble * 0.6 + Math.sin(t * 0.8) * 0.15;

		// light: the lake's glow, the eruption's blaze
		const blaze = Math.max(f, k * 0.55);
		light.intensity = (30 + 70 * night) + blaze * (900 + 900 * vigor) * (0.6 + 0.4 * night);
		light.distance = 300 + blaze * 2300;
		light.position.y = ventY + 25 + f * 80;
		if (hemi && blaze > 0.01) {
			const e = blaze * (0.35 + 0.65 * THREE.MathUtils.clamp(1 - dist / 2200, 0.25, 1));
			hemi.color.lerp(fire, e * (0.25 + 0.4 * night));
			hemi.groundColor.lerp(fire, e * (0.3 + 0.4 * night));
			hemi.intensity += e * (0.15 + 0.45 * night);
			shared.uAmbient.value.lerp(tmpC.copy(fire).multiplyScalar(0.3), e * (0.15 + 0.35 * night));
		}
		// the halos: steady glows, and over the crater a glow on the underside of the plume
		for (let i = 0; i < 6; i++) {
			const j = skyGlow0 + i, hgt = 30 + i * 90 * (0.6 + 0.4 * vigor), sz = 160 + i * 110;
			haloB.pos.set([cx, ventY + hgt, cz], j * 3); haloB.size.set([sz, sz * 0.7], j * 2);
			haloB.col.set([1, 0.32, 0.06, blaze * (0.18 + 0.4 * night) * (1 - i * 0.1)], j * 4);
		}
		haloB.col[3] = 0.5 + 0.5 * Math.max(k, rumble * 0.3);
		haloB.dirty();

		// the fountain
		const hF = (130 + 130 * vigor) * f;
		jet.visible = f > 0.01;
		if (jet.visible) { jet.scale.set(26 + 20 * vigor, Math.max(1, hF * 0.9), 26 + 20 * vigor); jetMat.uniforms.uK.value = f; }
		if (f > 0.01) {
			emit.blob += dt * f * (isPhone ? 30 : 80);
			while (emit.blob >= 1) {
				emit.blob -= 1;
				const b = bl[blHead]; blHead = (blHead + 1) % BN;
				const bomb = Math.random() < 0.18;
				const a = Math.random() * 6.283, vy = Math.sqrt(2 * 9.8 * Math.max(10, hF)) * (bomb ? 0.45 + Math.random() * 0.35 : 0.55 + Math.random() * 0.5);
				const vh = bomb ? 18 + Math.random() * 30 : Math.random() * (6 + hF * 0.06);
				b.p.set(cx + (Math.random() - 0.5) * 8, ventY + 2, cz + (Math.random() - 0.5) * 8);
				b.v.set(Math.cos(a) * vh, vy, Math.sin(a) * vh);
				b.s = bomb ? 1.8 + Math.random() * 2.2 : 0.8 + Math.random() * 1.8;
				b.age = 0; b.bomb = bomb;
				b.spin.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
				const tg = bomb && aims.target ? aims.target() : null;
				b.aim = !!tg;
				if (tg) {
					// thrown to land there: its time aloft by the distance, the air's drag (below) allowed for
					const dx = tg.x - b.p.x, dz = tg.z - b.p.z, T = Math.min(16, Math.max(5, Math.hypot(dx, dz) / 55)), e = (1 - Math.exp(-0.03 * T)) / 0.03;
					b.v.set(dx / e, (H(tg.x, tg.z) - b.p.y + 9.8 * T / 0.03) / e - 9.8 / 0.03, dz / e);
					b.s = tg.size || b.s;
				}
			}
			emit.spray += dt * f * (isPhone ? 260 : 900);
			while (emit.spray >= 1) {
				emit.spray -= 1;
				const a = Math.random() * 6.283, vh = Math.random() * (5 + hF * 0.08);
				addP(2, cx + (Math.random() - 0.5) * 10, ventY + 2, cz + (Math.random() - 0.5) * 10, Math.cos(a) * vh, Math.sqrt(2 * 9.8 * Math.max(10, hF)) * (0.4 + Math.random() * 0.7), Math.sin(a) * vh, 14, lakeY);
			}
		}
		// blobs in flight
		let nb = 0;
		for (let i = 0; i < BN; i++) {
			const b = bl[i];
			if (b.age > 30) continue;
			b.age += dt;
			b.v.y -= 9.8 * dt;
			b.v.multiplyScalar(1 - dt * 0.03);
			b.p.addScaledVector(b.v, dt);
			const g = Math.max(H(b.p.x, b.p.z), Math.hypot(b.p.x - cx, b.p.z - cz) < rimR * 1.1 ? lakeY : -1e9);
			if (b.v.y < 0 && b.p.y < g + 0.5) {
				b.age = 1e9;
				if (b.aim) { b.aim = false; aims.landed?.(b.p.x, g, b.p.z); }
				if (b.bomb && g > lakeY + 1) {
					splash(b.p.x, b.p.z, b.s * 2.2, clock);
					for (let j = 0; j < 10; j++) addP(0, b.p.x, g + 0.5, b.p.z, (Math.random() - 0.5) * 8, 3 + Math.random() * 7, (Math.random() - 0.5) * 8, 1 + Math.random(), -1e9);
					const bd = Math.hypot(cam.x - b.p.x, cam.z - b.p.z);
					if (bd < 400 && snd.c) blip(0.25 * (1 - bd / 400), true);
				}
				continue;
			}
			const cool = Math.min(1, b.age / (b.bomb ? 12 : 6));
			e4.set(b.spin.x * b.age, b.spin.y * b.age, b.spin.z * b.age); q4.setFromEuler(e4);
			blobs.setMatrixAt(nb, m4.compose(b.p, q4, s4.setScalar(b.s)));
			blobs.setColorAt(nb, tmpC.setRGB(1.0, 0.75 - cool * 0.55, 0.35 - cool * 0.33));
			nb++;
		}
		blobs.count = nb;
		if (nb) { blobs.instanceMatrix.needsUpdate = true; blobs.instanceColor.needsUpdate = true; }
		splU.uClock.value = clock;

		// sparks, drips, steam: only the ones near you, the lake always
		const nearAny = dist < 1400;
		if (nearAny) {
			for (const e of sparks) {
				const d = Math.hypot(cam.x - e.x, cam.z - e.z);
				if (d > 320) continue;
				emit.spark += dt * e.rate * (1 + k * 3);
				while (emit.spark >= 1) {
					emit.spark -= 1;
					addP(0, e.x + (Math.random() - 0.5) * e.spread, e.y + 0.3, e.z + (Math.random() - 0.5) * e.spread, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 4, (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2.5, -1e9);
				}
			}
			for (const e of drips) {
				const d = Math.hypot(cam.x - e.x, cam.z - e.z);
				if (d > 220) continue;
				emit.drip += dt * e.rate * (1 + k * 2);
				while (emit.drip >= 1) {
					emit.drip -= 1;
					const a = Math.random() * 6.283;
					addP(1, e.x + Math.cos(a) * e.spread, e.y, e.z + Math.sin(a) * e.spread, Math.cos(a) * 0.6, 0.4 + Math.random() * 0.8, Math.sin(a) * 0.6, 4, e.ground);
				}
			}
			emit.wisp += dt * (isPhone ? 2 : 5) * (1 + k * 2);
			while (emit.wisp >= 1 && wisps.length) {
				emit.wisp -= 1;
				const w = wisps[Math.floor(Math.random() * wisps.length)];
				if (Math.hypot(cam.x - w.x, cam.z - w.z) > (w.big ? 1400 : 380)) continue;
				const sz = w.big ? 10 + Math.random() * 10 : 2 + Math.random() * 3;
				addPuff(w.x + (Math.random() - 0.5) * 2, w.y + 0.5, w.z + (Math.random() - 0.5) * 2, 0, (w.big ? 3 : 1.2) + Math.random(), 0, 5 + Math.random() * 5, sz, sz * 4, 0.6 + Math.random() * 0.3, w.big ? 0.25 : 0.1, 0.35 * w.k);
			}
		}
		// the ash column
		if (s >= 0 && s < ERUPT + 10) {
			emit.ash += dt * (isPhone ? 0.8 : 1.8) * Math.max(f, 0.3);
			while (emit.ash >= 1) {
				emit.ash -= 1;
				const a = Math.random() * 6.283, sz = 40 + Math.random() * 30;
				addPuff(cx + Math.cos(a) * 12, ventY + 20 + Math.random() * 30, cz + Math.sin(a) * 12, Math.cos(a) * 2, 45 + 25 * vigor + Math.random() * 15, Math.sin(a) * 2, 55 + Math.random() * 20, sz, sz * (4 + 2 * vigor), Math.random() < 0.3 ? 0.7 : 0.15, 1, 0.85);
			}
		}
		const wind = shared.uWindDir.value, wv = 3 + shared.uWind.value * 6;
		for (let i = 0; i < PUFFS; i++) {
			const a = puff.age[i] += dt, L = puff.life[i];
			if (a >= L) { if (a - dt < L) { smokeB.col[i * 4 + 3] = 0; smokeB.size[i * 2] = smokeB.size[i * 2 + 1] = 0; } continue; }
			const u = a / L, hi = Math.max(0, puff.y[i] - ventY);
			// rising, slowed by the air; the top spreads out and drifts downwind
			puff.vy[i] *= 1 - dt * 0.05;
			puff.x[i] += (puff.vx[i] + wind.x * wv * (0.3 + hi * 0.004)) * dt;
			puff.y[i] += puff.vy[i] * dt;
			puff.z[i] += (puff.vz[i] + wind.y * wv * (0.3 + hi * 0.004)) * dt;
			const sz = puff.s0[i] + (puff.s1[i] - puff.s0[i]) * Math.sqrt(u);
			smokeB.pos[i * 3] = puff.x[i]; smokeB.pos[i * 3 + 1] = puff.y[i]; smokeB.pos[i * 3 + 2] = puff.z[i];
			smokeB.size[i * 2] = smokeB.size[i * 2 + 1] = sz;
			smokeB.rot[i] += puff.spin[i] * dt;
			// the fire under the column lights its base, most at night
			const fireK = puff.fire[i] * Math.max(0, 1 - hi / (250 + 250 * f)) * (0.3 + 0.7 * night) * Math.max(f, k * 0.5, puff.fire[i] < 0.5 ? 0.6 : 0);
			smokeB.col[i * 4] = fireK; smokeB.col[i * 4 + 1] = puff.pale[i];
			smokeB.col[i * 4 + 3] = puff.op[i] * Math.min(1, u * 8) * (1 - u) * (1 - u * 0.3);
		}
		smokeB.dirty();

		// the points
		const pScale = (opts.renderer ? opts.renderer.domElement.height : window.innerHeight) / (2 * Math.tan(camera.fov * Math.PI / 360));
		pMat.uniforms.uScale.value = pScale;
		for (let i = 0; i < PN; i++) {
			if (pAge[i] >= pMax[i]) continue;
			const a = pAge[i] += dt, j = i * 3;
			const kind = pKind[i];
			if (kind === 0) { pV[j + 1] += dt * 0.6; pV[j] *= 1 - dt * 0.8; pV[j + 2] *= 1 - dt * 0.8; } else pV[j + 1] -= 9.8 * dt;
			pP[j] += pV[j] * dt; pP[j + 1] += pV[j + 1] * dt; pP[j + 2] += pV[j + 2] * dt;
			if (kind > 0 && pV[j + 1] < 0 && (pP[j + 1] < pGround[i] || pP[j + 1] < H(pP[j], pP[j + 2]))) pAge[i] = pMax[i];
			pLife[i] = Math.min(1, a / pMax[i]);
			if (pAge[i] >= pMax[i]) { pP[j + 1] = -1e5; pLife[i] = 1; }
		}
		pGeo.attributes.position.needsUpdate = true;
		pGeo.attributes.aLife.needsUpdate = true;
		pGeo.attributes.aKind.needsUpdate = true;

		// the ground shakes: building before, hard at the start, rolling through it
		const shake = (ph === 'rumble' ? rumble * 0.7 : 0) + (s >= 0 && s < ERUPT ? (s < 6 ? 1 - s / 8 : 0.3 * f) : 0);
		if (shake > 0.01) {
			const amp = shake * Math.pow(THREE.MathUtils.clamp(1 - dist / 2600, 0, 1), 2) * (0.6 + 0.4 * vigor);
			const w1 = Math.sin(t * 37) * Math.sin(t * 13.1), w2 = Math.sin(t * 29 + 1.3) * Math.sin(t * 9.7), w3 = Math.sin(t * 41 + 2.1);
			camera.position.x += w1 * amp * 0.12; camera.position.y += w2 * amp * 0.15; camera.position.z += w3 * amp * 0.1;
			camera.rotation.x += w2 * amp * 0.006; camera.rotation.z += w1 * amp * 0.004;
		}

		// sound
		const au = audio();
		if (au) {
			const now = au.c.currentTime;
			const lakeD = Math.hypot(cam.x - cx, cam.z - cz, cam.y - lakeY);
			const hum = Math.max(0, 1 - lakeD / 260) * 0.05;
			au.rum.gain.setTargetAtTime(hum + (rumble * 0.4 + f * 0.45 + k * 0.1) * Math.max(distK, 0.15), now, 0.3);
			au.roar.gain.setTargetAtTime(f * 0.28 * Math.max(distK, 0.08), now, 0.4);
			if (clock > snd.nextBub) {
				let sd = lakeD;
				for (const sp of spouts) sd = Math.min(sd, Math.hypot(cam.x - sp.x, cam.z - sp.z) * 2);
				const lv = Math.max(0, 1 - sd / 200) * 0.06 * (1 + k);
				if (lv > 0.002) blip(lv, false);
				snd.nextBub = clock + 0.06 + Math.random() * (0.4 - k * 0.3);
			}
		}
	}

	function state() {
		const s = clock - cur;
		return { phase: phase(), next: Math.max(0, next - clock), k: lastK, fountain: fountainAt(s), vigor, count, since: s };
	}
	// now (after the rumble), or from a moment in: erupt(30) is half way through
	function erupt(at) {
		if (at != null) { next = clock - Math.max(0, +at); return `erupting, ${Math.max(0, +at)} s in`; }
		if (phase() === 'erupting') return 'already erupting';
		next = clock + RUMBLE;
		return `rumbling: it erupts in ${RUMBLE} s`;
	}
	function dispose() {
		U.uErupt.value.set(0, 0, 0, 0);
		U.uEruptT.value = 0;
		try { for (const x of snd.srcs) x.stop(); snd.bus?.disconnect(); } catch { /* already gone */ }
		snd.c = null;
		scene.remove(group);
		group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
		glowTex.dispose();
		smokeB.mesh.material.uniforms.uMap.value.dispose();
	}
	return { update, state, erupt, floor, push, dispose, group, skin, vent, rimR, coneR, lakeY, spots: { spouts, holes }, uniforms: U, aims };
}
