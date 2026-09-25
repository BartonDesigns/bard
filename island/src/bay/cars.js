// Cars with real proportions and smooth bodies. Each body is lofted: a cross-section
// (a rounded sill, a side that bulges slightly, the shoulder, the glass leaning in to
// the roof) swept along the car's length, its height following the hood, windshield,
// roof, rear glass and deck, its width rounding off in plan at the nose and tail. The
// shader paints glass, lamps, grille, lower trim and the wheel arches from where each
// point sits on the body; the paint is a clear coat that reflects the sky.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// L length, W width, H height, belt (base of the glass), ws (windshield foot, from the
// centre toward the front), rf/rr (roof front and rear), rb (rear glass foot), wz (axle),
// nose (how far the hood drops to the nose), bed (a pickup's load bed behind the cab)
const SPEC = {
	sedan: { L: 4.75, W: 1.84, H: 1.45, belt: 0.93, ws: 0.95, rf: 0.1, rr: -0.95, rb: -1.55, wz: 1.42, nose: 0.2, clad: 0.14 },
	hatch: { L: 4.1, W: 1.77, H: 1.47, belt: 0.92, ws: 0.95, rf: 0.2, rr: -1.5, rb: -1.98, wz: 1.28, nose: 0.2, clad: 0.14 },
	suv: { L: 4.7, W: 1.9, H: 1.72, belt: 1.08, ws: 1.1, rf: 0.45, rr: -2.1, rb: -2.3, wz: 1.42, nose: 0.14, clad: 0.26 },
	pickup: { L: 5.6, W: 2.0, H: 1.88, belt: 1.12, ws: 1.25, rf: 0.6, rr: -0.5, rb: -0.62, wz: 1.8, nose: 0.1, clad: 0.24, bed: -0.72 },
	van: { L: 5.1, W: 1.97, H: 1.78, belt: 1.02, ws: 1.7, rf: 0.95, rr: -2.35, rb: -2.5, wz: 1.52, nose: 0.2, clad: 0.18 },
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function carGeometry(kind) {
	const S = SPEC[kind], L2 = S.L / 2, NS = 48;
	const bottom = (s) => 0.3 + 0.1 * sm(L2 - 0.55, L2, Math.abs(s));
	// the belt line: the hood falls to the nose, the deck is level
	const belt = (s) => S.belt - (s > S.ws ? S.nose * Math.pow(sm(S.ws, L2, s), 1.3) : 0) - (s < S.rb ? 0.04 * sm(S.rb, -L2, s) : 0);
	// the roof line: up the windshield, across the roof, down the rear glass
	const top = (s) => {
		const b = belt(s);
		if (S.bed !== undefined && s < S.bed) return b;                                      // a pickup's bed is open
		if (s > S.rf) return b + (S.H - b) * sm(S.ws, S.rf, s);
		if (s < S.rr) return b + (S.H - b) * sm(S.rb, S.rr, s);
		return S.H + 0.02 * Math.sin((s - S.rr) / (S.rf - S.rr) * Math.PI);
	};
	// half width in plan, rounded off at the nose and tail
	const halfW = (s) => { const u = Math.abs(s) / L2; return S.W / 2 * Math.pow(Math.max(0, 1 - Math.pow(u, s > 0 ? 5 : 6)), 1 / 5) * (1 - 0.02 * Math.max(0, s / L2)); };
	const P = [], E = [], G = [];
	const ring = [];
	for (let k = 0; k <= NS; k++) {
		const u = -1 + 2 * k / NS, s = L2 * Math.sin(u * Math.PI / 2);
		const b0 = bottom(s), bl = belt(s), tp = top(s), wb = halfW(s);
		const g = Math.min(1, Math.max(0, (tp - bl - 0.02) / (S.H - S.belt)));
		const glassHere = g > 0.3 ? 1 : 0, roofHere = tp > S.H - 0.05 ? 1 : 0;
		const bed = S.bed !== undefined && s < S.bed ? 1 : 0;
		// the half section, from under the car round the side to the centre of the top
		const deck = [[wb * 0.9, bl + 0.02], [wb * 0.78, bl + 0.035], [wb * 0.6, bl + 0.045], [wb * 0.34, bl + 0.05], [0, bl + 0.05]];
		const wg = wb * 0.86, wr = wb * 0.72;
		const house = [[wg, bl + 0.03], [wg * 0.93 + wr * 0.07, bl + (tp - bl) * 0.55], [wr, tp - 0.05], [wr * 0.78, tp], [0, tp + 0.02]];
		const half = [[0, b0], [wb * 0.7, b0], [wb * 0.95, b0 + 0.06], [wb, b0 + 0.22], [wb * 1.01, (b0 + bl) / 2], [wb * 0.985, bl - 0.1], [wb * 0.94, bl]];
		for (let n = 0; n < 5; n++) half.push([deck[n][0] + (house[n][0] - deck[n][0]) * g, deck[n][1] + (house[n][1] - deck[n][1]) * g]);
		// part per point: 0 paint, 1 glass, 4 the bed
		const part = half.map((_, n) => n < 7 ? 0 : bed && n > 7 ? 4 : n <= 9 ? glassHere : glassHere && !roofHere ? 1 : 0);
		const full = [...half.map((p, n) => [p[0], p[1], part[n]]), ...half.slice(1, -1).reverse().map((p, n, arr) => [-p[0], p[1], part[half.length - 2 - n]])];
		const start = P.length / 3;
		for (const [x, y, pt] of full) {
			P.push(x, y, s);
			E.push(s / L2, (y - b0) / Math.max(0.1, bl - b0), wb > 0.01 ? Math.abs(x) / wb : 0, pt);
		}
		ring.push({ start, n: full.length });
	}
	const idx = [];
	for (let k = 0; k < NS; k++) {
		const a = ring[k], b = ring[k + 1], n = a.n;
		for (let i = 0; i < n; i++) {
			const i2 = (i + 1) % n;
			idx.push(a.start + i, a.start + i2, b.start + i, a.start + i2, b.start + i2, b.start + i);
		}
	}
	const body = new THREE.BufferGeometry();
	body.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	body.setAttribute('aE', new THREE.Float32BufferAttribute(E, 4));
	body.setIndex(idx);
	body.computeVertexNormals();
	const parts = [body.toNonIndexed()];
	// wheels: a tyre with a rounded shoulder and an alloy rim set into it
	for (const z of [S.wz, -S.wz]) for (const sx of [-1, 1]) {
		const x = sx * (S.W / 2 - 0.105);
		const tyre = new THREE.CylinderGeometry(0.34, 0.34, 0.23, 20, 1, false).rotateZ(Math.PI / 2).translate(x, 0.34, z);
		const rim = new THREE.CylinderGeometry(0.21, 0.23, 0.03, 18).rotateZ(Math.PI / 2).translate(x + sx * 0.108, 0.34, z);
		for (const [w, pt] of [[tyre, 2], [rim, 5]]) {
			const g = w.toNonIndexed(); g.deleteAttribute('uv');
			const e = new Float32Array(g.attributes.position.count * 4);
			for (let i = 0; i < g.attributes.position.count; i++) e[i * 4 + 3] = pt;
			g.setAttribute('aE', new THREE.BufferAttribute(e, 4));
			parts.push(g);
		}
	}
	const g = mergeGeometries(parts);
	// the axle's distance from the centre, for the wheel arches in the shader
	g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(S.wz), 1));
	g.computeBoundingSphere();
	return g;
}

// a sky to reflect: blue overhead, a bright hazy horizon, the dark street below
function skyEnv() {
	const W = 64, H = 32, d = new Uint8Array(W * H * 4);
	for (let y = 0; y < H; y++) {
		const v = 1 - y / (H - 1), el = (v - 0.5) * Math.PI;                       // +pi/2 straight up
		let c;
		if (el > 0) { const t = Math.pow(1 - el / (Math.PI / 2), 3); c = [110 + 120 * t, 150 + 90 * t, 205 + 40 * t]; }
		else { const t = Math.min(1, -el * 5); c = [200 - 150 * t, 200 - 150 * t, 196 - 144 * t]; }
		for (let x = 0; x < W; x++) d.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
	}
	const t = new THREE.DataTexture(d, W, H);
	t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
	return t;
}

export function carMaterial(night) {
	const m = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06, envMap: skyEnv(), envMapIntensity: 0.9, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightS = night;
		sh.vertexShader = 'attribute vec4 aE; attribute float aW; varying vec4 vE; varying vec3 vLP; varying float vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvE = aE; vLP = position; vW = aW;');
		sh.fragmentShader = 'uniform float uNightS; varying vec4 vE; varying vec3 vLP; varying float vW;\nvec3 carGlow = vec3(0.0); float carRough = -1.0; float carCoat = 1.0;\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				{
					float e = vE.x, yN = vE.y, xN = vE.z, part = vE.w;
					if (!gl_FrontFacing) { diffuseColor.rgb = vec3(0.015); carRough = 1.0; carCoat = 0.0; }             // inside the wheel wells
					else if (part > 4.5) { diffuseColor.rgb = vec3(0.55, 0.56, 0.58); carRough = 0.3; carCoat = 0.0; }                       // alloy rims
					else if (part > 3.5) { diffuseColor.rgb = vec3(0.05); carRough = 0.8; carCoat = 0.0; }                             // the bed
					else if (part > 1.5) { diffuseColor.rgb = vec3(0.025); carRough = 0.85; carCoat = 0.0; }                           // tyres
					else if (part > 0.5) { diffuseColor.rgb = vec3(0.02, 0.025, 0.03); carRough = 0.04; }                             // glass
					else {
						// lower trim and sills in black plastic
						float clad = step(yN, 0.16);
						// the wheel arches: cut out of the body, so the tyre shows through with the
						// dark well behind it
						float ad = length(vec2(abs(vLP.z) - vW, vLP.y - 0.34));
						if (step(0.7, xN) * step(ad, 0.43) > 0.5) discard;
						float arch = step(0.7, xN) * step(ad, 0.47);
						// the grille and the lamps at the nose, tail lamps at the back
						float nose = step(0.955, e), tail = step(e, -0.955);
						float head = nose * step(0.62, yN) * step(yN, 0.9) * step(0.5, xN);
						float grille = nose * step(0.3, yN) * step(yN, 0.62) * step(xN, 0.6);
						float tl = tail * step(0.6, yN) * step(yN, 0.92) * step(0.45, xN);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04), max(clad, grille * 0.9));
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03), arch);                          // the arch lip
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.86, 0.84), head);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.03, 0.03), tl);
						if (clad + arch > 0.5) { carRough = 0.7; carCoat = 0.0; }
						if (head + tl > 0.5) carRough = 0.1;
						carGlow = (head * vec3(1.0, 0.93, 0.8) * 2.5 + tl * vec3(1.0, 0.05, 0.02) * 1.8) * uNightS;
					}
				}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (carRough >= 0.0) roughnessFactor = carRough;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += carGlow;')
			.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= carCoat;');
	};
	m.customProgramCacheKey = () => 'baycar2';
	return m;
}
