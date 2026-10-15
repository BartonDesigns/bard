// Holiday lights (seasons.js lightsUp: the day after Thanksgiving to Twelfth Night): strings
// of bulbs along the eaves of most houses (all colours, warm white, or cool white icicles
// hanging from the gutter), and warm white wound up the trunks and through the crowns of the
// downtown street trees. Lit after dark only, twinkling gently. One draw: every bulb is a
// point (its own colour and phase) in one buffer, filled when the city round you is rebuilt
// and left alone in between; the twinkle is the shader's. Up close a house's own model
// (houses.js) carries its lights, so the points on its block fade out there.

import * as THREE from 'three';
import { today } from '../calendar.js';
import { lightsUp, houseLights, lightsK } from './seasons.js';
import { mainOf, houseSeed } from './houseplan.js';
import { qualityNow, onQuality } from '../world/governor.js';

const HOUSE = new Set([0, 1, 10, 11, 12]);           // city.js KIND: row, house, bay-windowed, houses with garages
const MULTI = [[1, 0.12, 0.1], [0.1, 0.9, 0.2], [0.15, 0.35, 1], [1, 0.7, 0.1]], WARM = [1, 0.78, 0.45], COOL = [0.75, 0.85, 1];
const hash = (x, z) => { let h = Math.imul(Math.floor(x * 7) | 0, 374761393) ^ Math.imul(Math.floor(z * 7) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const VERT = /* glsl */`
	attribute vec3 aCol; attribute vec2 aPh;
	uniform float uTime, uScale, uOn, uNear0, uNear1;
	varying vec3 vCol; varying float vA;
	void main(){
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		gl_Position = projectionMatrix * mv;
		float d = -mv.z;
		// a bulb's glow is a few centimetres; never less than about a pixel and a half far off
		gl_PointSize = max(1.6, 0.13 * uScale / d);
		// twinkle: each its own slow breath; the multicoloured strings now and then a chase
		float tw = 0.72 + 0.28 * sin(uTime * (1.3 + aPh.x * 1.7) + aPh.x * 40.0);
		float multi = step(0.5, aPh.y) * (1.0 - step(1.5, aPh.y));
		tw *= mix(1.0, 0.6 + 0.4 * step(0.4, fract(uTime * 0.5 + aPh.x * 2.0)), multi * 0.7);
		// (a house's own bulbs take over close by: its points fade out across the hand-over)
		float nearK = aPh.y < 3.5 ? smoothstep(uNear0, uNear1, d) : 1.0;
		vCol = aCol * tw; vA = uOn * nearK * (1.0 - smoothstep(380.0, 520.0, d));
	}`;
const FRAG = /* glsl */`
	varying vec3 vCol; varying float vA;
	void main(){
		vec2 q = gl_PointCoord - 0.5;
		float r = length(q) * 2.0;
		float a = (1.0 - smoothstep(0.35, 1.0, r)) * vA;
		if (a < 0.02) discard;
		gl_FragColor = vec4(vCol * (1.6 + 2.0 * (1.0 - smoothstep(0.0, 0.4, r))) * a, a);
	}`;

export function createHolidayLights(scene, city, { isPhone = false } = {}) {
	const CAP = isPhone ? 14000 : 52000, R0 = isPhone ? 170 : 300, STEP = isPhone ? 0.55 : 0.38;
	const pos = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3), ph = new Float32Array(CAP * 2);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
	geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 2));
	geo.setDrawRange(0, 0);
	const U = { uTime: { value: 0 }, uScale: { value: 400 }, uOn: { value: 0 }, uNear0: { value: 36 }, uNear1: { value: 46 } };
	const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
	const pts = new THREE.Points(geo, mat);
	pts.frustumCulled = false; pts.visible = false; pts.name = 'holiday-lights';
	scene.add(pts);
	const tmpV = new THREE.Vector2();
	pts.onBeforeRender = (r, sc, cam) => { U.uScale.value = r.getSize(tmpV).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)); };
	onQuality(() => { seen = null; });
	let n = 0, seen = null, atX = 1e9, atZ = 1e9, up = false, upAt = -1e9;
	const add = (x, y, z, c, p0, kind) => { if (n >= CAP) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; col[n * 3] = c[0]; col[n * 3 + 1] = c[1]; col[n * 3 + 2] = c[2]; ph[n * 2] = p0; ph[n * 2 + 1] = kind; n++; };
	// one house's eaves: along the long sides (all round a hipped roof), a bulb every STEP
	function eaves(o, scheme, d) {
		const ca = Math.cos(o.a || 0), sa = Math.sin(o.a || 0), y = o.y + o.h - 0.12, out = (o.roof ? 0.42 : 0.08);
		const hw = o.w / 2 + out, hd = o.d / 2 + out;
		const sides = o.roof && !o.roof.hip ? [[-hw, hd, hw, hd], [hw, -hd, -hw, -hd]] : [[-hw, hd, hw, hd], [hw, hd, hw, -hd], [hw, -hd, -hw, -hd], [-hw, -hd, -hw, hd]];
		// (a far house has its strings thinned: a bulb every other step past 160 m)
		const step = STEP * (d > 160 ? 2 : 1);
		let k = 0;
		for (const [ax, az, bx, bz] of sides) {
			const L = Math.hypot(bx - ax, bz - az);
			for (let s = step * 0.5; s < L; s += step, k++) {
				const lx = ax + (bx - ax) * s / L, lz = az + (bz - az) * s / L, wx = o.x + ca * lx - sa * lz, wz = o.z + sa * lx + ca * lz;
				const c = scheme === 1 ? MULTI[k % 4] : scheme === 2 ? WARM : COOL;
				add(wx, y, wz, c, hash(wx, wz), scheme === 1 ? 1 : 0);
				// icicles: a short drop of bulbs under the gutter, longer and shorter
				if (scheme === 3 && d < 160) { const drop = 1 + Math.floor(hash(wz, wx) * 3); for (let m = 1; m <= drop; m++) add(wx, y - m * 0.13, wz, COOL, hash(wx + m, wz), 0); }
			}
		}
	}
	// a downtown tree: warm white spiralled up the trunk, then scattered through the crown
	function tree(t) {
		const H = t.h, top = H * 0.42, crownY = H * 0.68, cr = H * 0.3 * (t.nx || 1), rot = hash(t.x, t.z) * 6.283;
		for (let s = 0; s < 1; s += 0.035) { const a = rot + s * 6.283 * 5, y = 0.6 + s * (top - 0.6), r = 0.24 - s * 0.08; add(t.x + Math.cos(a) * r, t.y + 0.3 + y, t.z + Math.sin(a) * r, WARM, hash(t.x + s, t.z), 4); }
		const m = isPhone ? 40 : 90;
		for (let k = 0; k < m; k++) {
			const a = rot + k * 2.39996, v = (k + 0.5) / m * 2 - 1, rr = Math.sqrt(1 - v * v) * cr * (0.75 + 0.25 * hash(k, t.x));
			add(t.x + Math.cos(a) * rr, t.y + 0.3 + crownY + v * H * 0.24, t.z + Math.sin(a) * rr, WARM, hash(t.z + k, t.x), 4);
		}
	}
	function build(x, z) {
		atX = x; atZ = z; n = 0;
		// (nearer on a lower quality tier: world/governor.js)
		const R = R0 * qualityNow().far;
		const d0 = today();
		for (const o of city.nearList?.() || []) {
			if (!HOUSE.has(Math.floor(o.kind)) || o.h < 2) continue;
			const d = Math.hypot(o.x - x, o.z - z);
			if (d > R) continue;
			const b = o.src, M = b?.grp ? mainOf(b.grp) || b : b;
			const scheme = houseLights(M ? houseSeed(M) : houseSeed(o), d0);
			if (scheme) eaves(o, scheme, d);
		}
		for (const t of city.treesAt?.(x, z, R) || []) if (t.src === 'street' && (t.well || t.era === 0)) tree(t);
		geo.setDrawRange(0, n);
		for (const a of ['position', 'aCol', 'aPh']) { const A = geo.attributes[a]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, n) * A.itemSize); A.needsUpdate = true; }
	}
	function update(dt, cam, night) {
		U.uTime.value += dt;
		const k = lightsK(night);
		// (the date is looked at now and then: the lights go up and come down on their days)
		if (U.uTime.value - upAt > 20) { upAt = U.uTime.value; const was = up; up = lightsUp(today()); if (up !== was) seen = null; }
		const show = up && k > 0.01 && cam.position.y < 2500;
		pts.visible = show;
		U.uOn.value = k;
		if (!show) return;
		const list = city.nearList?.();
		if (list !== seen || Math.hypot(cam.position.x - atX, cam.position.z - atZ) > R0 * 0.35) { seen = list; build(cam.position.x, cam.position.z); }
	}
	return { update, points: pts, info: () => ({ up, bulbs: n, on: +U.uOn.value.toFixed(2) }), rebuild: () => { seen = null; } };
}
