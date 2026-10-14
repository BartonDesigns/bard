// The military's materials and a small geometry builder. One program per material, shared by
// every base and vehicle: painted armour (panel seams, rivets, chipped edges, mud low down,
// a camouflage pattern laid in the vehicle's own metres), the aircraft's low-visibility grey,
// dark gunmetal, rubber and track, glass, concrete weathered as the town's walls are
// (bay/weathering.js), corrugated metal, asphalt with its markings painted in the shader, the
// chain-link fence (cut out, so it is one strip), and lamps that light at night.
//
//   const B = builder(); B.box('concrete', w, h, d, x, y, z, yaw, colour); ... B.meshes(kit)
// gathers everything by material into one merged geometry each: a base is a handful of draws.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { weatherStucco } from '../bay/weathering.js';
import { usePhoto } from '../world/photomats.js';

const NOISE = /* glsl */`
float mh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float mn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(mh(i), mh(i + vec3(1, 0, 0)), f.x), mix(mh(i + vec3(0, 1, 0)), mh(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(mh(i + vec3(0, 0, 1)), mh(i + vec3(1, 0, 1)), f.x), mix(mh(i + vec3(0, 1, 1)), mh(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
// a thin line at each whole unit of x, faded out where it would be finer than a pixel
float mline(float x, float w){ float fw = max(fwidth(x), 1e-4), d = abs(fract(x + 0.5) - 0.5); return (1.0 - smoothstep(w, w + fw * 1.5, d)) * (1.0 - smoothstep(0.15, 0.5, fw)); }
`;

// painted armour and airframes: seams on a grid in the object's own frame, rivet rows along
// them, edge wear, grime and mud from below; camo (k) blotches in three tones of the paint
function armour(camo, night) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: camo ? 0.78 : 0.55, metalness: camo ? 0.15 : 0.3, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNight = night;
		sh.vertexShader = 'varying vec3 vMl; varying vec3 vMn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMl = position; vMn = normal;');
		sh.fragmentShader = 'varying vec3 vMl; varying vec3 vMn; uniform float uNight;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 p = vMl, n = normalize(vMn);
				vec3 c = diffuseColor.rgb;
				${camo ? `float b1 = mn(p * 0.9 + vec3(3.1, 0.0, 1.7)) * 0.75 + mn(p * 2.7) * 0.25;
				float b2 = mn(p.zyx * 1.1 + 7.3) * 0.75 + mn(p * 3.1 + 2.0) * 0.25;
				c = mix(c, c * vec3(0.62, 0.66, 0.55), smoothstep(0.54, 0.58, b1));
				c = mix(c, c * vec3(1.18, 1.12, 0.95), smoothstep(0.6, 0.64, b2));` : ''}
				// panel seams and rivets
				vec3 q = p * vec3(1.1, 1.4, 0.85);
				float ax = abs(n.x) > 0.6 ? 0.0 : 1.0, az = abs(n.z) > 0.6 ? 0.0 : 1.0, ay = abs(n.y) > 0.6 ? 0.0 : 1.0;
				float seam = max(max(mline(q.x, 0.012) * ax, mline(q.z, 0.012) * az), mline(q.y, 0.016) * ay * 0.7);
				c *= 1.0 - seam * 0.35;
				float rv = (1.0 - smoothstep(0.035, 0.05, length(fract(q.xz * 6.0) - 0.5))) * max(mline(q.x, 0.03) * ax, mline(q.z, 0.03) * az);
				c *= 1.0 + rv * 0.18;
				// wear: chips to bare metal, grime streaks, mud and dust from the ground up
				float chip = smoothstep(0.78, 0.82, mn(p * 9.0) * 0.6 + mn(p * 31.0) * 0.4);
				c = mix(c, vec3(0.32, 0.31, 0.3), chip * 0.5);
				float streak = smoothstep(0.5, 0.8, mn(vec3(p.x * 4.0, p.y * 0.4, p.z * 4.0)));
				c *= 1.0 - streak * 0.12 * (1.0 - abs(n.y));
				float mud = (1.0 - smoothstep(0.2, 1.3, p.y + (mn(p * 2.0) - 0.5) * 0.5));
				c = mix(c, vec3(0.32, 0.27, 0.2), mud * ${camo ? '0.55' : '0.0'});
				c = mix(c, c * 1.1 + 0.03, max(n.y, 0.0) * 0.15);
				diffuseColor.rgb = c;
			}`);
	};
	m.customProgramCacheKey = () => (camo ? 'mil-armour-camo-2' : 'mil-armour-air-2');
	return m;
}

// asphalt with its markings: the runway's centreline, threshold bars, touchdown and aiming
// marks and edge lines, the taxiways' yellow line; tyre rubber at the touchdown zones. The
// geometry's uv is metres along (u) and across (v) from the strip's middle; uv1.x its length,
// uv1.y its width, uv1 sign: runway (+) or taxiway (-)
function asphalt() {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.vertexShader = 'attribute vec3 strip; varying vec3 vSt; varying vec2 vSu; varying vec3 vSw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSt = strip; vSu = uv; vSw = (modelMatrix * vec4(position, 1.0)).xyz;');
		sh.fragmentShader = 'varying vec3 vSt; varying vec2 vSu; varying vec3 vSw;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec2 w = vSw.xz;
				float n = mn(vec3(w * 0.35, 0.0)) * 0.5 + mn(vec3(w * 2.3, 1.0)) * 0.3 + mn(vec3(w * 11.0, 2.0)) * 0.2;
				vec3 c = diffuseColor.rgb * (0.82 + 0.3 * n);
				float L = vSt.x, H = vSt.y, kind = vSt.z, u = vSu.x, v = vSu.y, au = abs(u), av = abs(v);
				if (kind < -0.5) {
					// the ground between: dry grass and bare earth, mown in broad passes
					float g = mn(vec3(w * 0.08, 7.0)) * 0.5 + mn(vec3(w * 0.6, 8.0)) * 0.3 + mn(vec3(w * 3.0, 9.0)) * 0.2;
					vec3 grass = mix(vec3(0.42, 0.4, 0.22), vec3(0.58, 0.52, 0.32), g);
					grass = mix(grass, vec3(0.47, 0.4, 0.3), smoothstep(0.62, 0.8, mn(vec3(w * 0.05, 10.0))) * 0.7);
					grass *= 0.94 + 0.06 * step(0.5, fract(dot(w, vec2(0.7, 0.7)) / 6.0));
					diffuseColor.rgb = grass * (0.9 + 0.2 * mn(vec3(w * 9.0, 11.0)));
				} else {
				// patches and sealed cracks, broken up so they never run on for ever
				float crack = (1.0 - smoothstep(0.0, 0.006, abs(mn(vec3(w * 0.33, 4.0)) - 0.5))) * smoothstep(0.55, 0.75, mn(vec3(w * 0.09, 6.0)));
				c *= 1.0 - crack * 0.3;
				c = mix(c, c * 0.88, smoothstep(0.6, 0.7, mn(vec3(floor(w / 3.0), 5.0))) * 0.6);
				float paint = 0.0; vec3 pc = vec3(0.93, 0.93, 0.9);
				if (kind > 1.5) {
					// the runway: edge lines, the dashed centreline, threshold bars at each end, the
					// aiming point blocks and touchdown pairs; rubber in the touchdown zones
					float end = L * 0.5 - au;
					paint = max(paint, step(H * 0.5 - 1.2, av) * step(av, H * 0.5 - 0.3));
					paint = max(paint, step(av, 0.45) * step(0.45, fract(u / 50.0)) * step(end, L * 0.5 - 60.0) * step(60.0, end));
					paint = max(paint, step(6.0, end) * step(end, 36.0) * step(fract(v / 3.2), 0.6) * step(av, H * 0.5 - 2.5));
					paint = max(paint, step(300.0, end) * step(end, 345.0) * step(4.0, av) * step(av, 9.5));
					for (int k = 0; k < 3; k++) { float s = 150.0 + float(k) * 150.0; paint = max(paint, step(s, end) * step(end, s + 22.0) * step(3.0, av) * step(av, 5.0) * step(k == 0 ? 0.0 : 0.5, 1.0)); }
					float rubber = smoothstep(60.0, 120.0, end) * (1.0 - smoothstep(300.0, 650.0, end)) * (1.0 - smoothstep(2.0, 9.0, av));
					c *= 1.0 - rubber * (0.35 + 0.3 * mn(vec3(u * 0.8, v * 6.0, 3.0)));
				} else if (kind > 0.5) {
					// a taxiway: the yellow centreline, and its edges
					pc = vec3(0.86, 0.68, 0.16);
					paint = max(step(av, 0.2), step(H * 0.5 - 0.6, av) * step(av, H * 0.5 - 0.3));
				} else if (kind > 0.05) {
					// an apron or a helipad: parking lines; the pad's circle and H
					pc = vec3(0.86, 0.68, 0.16);
					paint = step(0.97, fract(u / 25.0)) * step(av, H * 0.5 - 3.0);
					if (kind < 0.2) { float r = length(vec2(u, v)); pc = vec3(0.93); paint = max(step(abs(r - 9.5), 0.35), (step(au, 3.4) * step(av, 4.6) * (step(2.4, au) + step(av, 0.45)))); }
				}
				paint *= 0.85 + 0.15 * smoothstep(0.3, 0.7, mn(vec3(w * 3.0, 5.0)));
				diffuseColor.rgb = mix(c, pc * (0.8 + 0.2 * n), clamp(paint, 0.0, 1.0));
				}
			}`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.9;');
	};
	m.customProgramCacheKey = () => 'mil-asphalt-3';
	return m;
}

// corrugated sheet: ridges along the geometry's v (the sheet's run), light through the ridges
function corrugated() {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.22, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.vertexShader = 'varying vec3 vCw; varying vec3 vCn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCw = position; vCn = normal;');
		sh.fragmentShader = 'varying vec3 vCw; varying vec3 vCn;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{ vec3 n = normalize(vCn); float t = abs(n.x) > 0.5 ? vCw.z : vCw.x;
			  float r = sin(t * 41.9); diffuseColor.rgb *= 0.86 + 0.14 * r;
			  float rust = smoothstep(0.62, 0.75, mn(vCw * 1.3) * 0.7 + mn(vCw * 7.0) * 0.3) * (1.0 - smoothstep(0.0, 3.0, vCw.y) * 0.5);
			  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.24, 0.12), rust * 0.45);
			  diffuseColor.rgb *= 0.9 + 0.1 * mn(vec3(vCw.xz * 0.2, vCw.y));
			}`);
	};
	m.customProgramCacheKey = () => 'mil-corrugated-1';
	return m;
}
// chain-link: a diamond mesh cut out of a strip, posts and wire drawn as geometry
function chainlink() {
	const S = 64, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	let tex = null;
	if (cv) {
		cv.width = cv.height = S;
		const g = cv.getContext('2d');
		g.clearRect(0, 0, S, S); g.strokeStyle = 'rgba(190,195,198,1)'; g.lineWidth = 3;
		g.beginPath(); g.moveTo(0, 0); g.lineTo(S, S); g.moveTo(S, 0); g.lineTo(0, S); g.moveTo(-S / 2, S / 2); g.lineTo(S / 2, -S / 2); g.moveTo(S / 2, S + S / 2); g.lineTo(S + S / 2, S / 2); g.stroke();
		tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10); tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
	}
	return new THREE.MeshStandardMaterial({ color: 0xc9ccce, map: tex, alphaMap: tex, alphaTest: 0.35, transparent: false, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
}
// lamps: lit only at night (window cabs, floodlights, runway edge lights, beacons)
function lamps(night) {
	const m = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNight = night;
		sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (0.15 + uNight * 3.2);');
	};
	m.customProgramCacheKey = () => 'mil-lamp-1';
	return m;
}

let K = null;
// the shared kit (made once)
export function militaryKit() {
	if (K) return K;
	const night = { value: 0 };
	const concrete = weatherStucco(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, vertexColors: true }));
	usePhoto(concrete, [['plaster', 3, { mean: 0.72, contrast: 0.6 }, 0.5]]);
	K = {
		night,
		camo: armour(true, night), air: armour(false, night),
		dark: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, vertexColors: true }),
		rubber: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true }),
		glass: new THREE.MeshStandardMaterial({ color: 0x1d2a30, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.2 }),
		concrete, asphalt: asphalt(), metal: Object.assign(corrugated(), { side: THREE.DoubleSide }), fence: chainlink(), lamp: lamps(night),
		paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, vertexColors: true }),
		canvas: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true, side: THREE.DoubleSide }),
	};
	for (const m of Object.values(K)) if (m?.isMaterial) m.userData.shared = true;
	return K;
}

// ---------- the builder ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
export function builder() {
	const by = new Map();
	// add a geometry under a material name, placed (x, y, z, yaw, pitch, roll, scale) and tinted
	function add(mat, g, x = 0, y = 0, z = 0, yaw = 0, col = '#ffffff', pitch = 0, roll = 0, strip = null) {
		let geo = g.index ? g.toNonIndexed() : g;
		if (geo === g) geo = g.clone();
		for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a);
		if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
		geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), _s.set(1, 1, 1)));
		// (walls and roofs: uv in metres on the face's own plane, for the photographic detail)
		if (!strip) {
			const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
			for (let i = 0; i < P.count; i++) { const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)); U.setXY(i, ny > 0.7 ? P.getX(i) : nx > nz ? P.getZ(i) : P.getX(i), ny > 0.7 ? P.getZ(i) : P.getY(i)); }
		}
		const n = geo.attributes.position.count, cs = new Float32Array(n * 3), st = new Float32Array(n * 3);
		_c.set(col);
		for (let i = 0; i < n; i++) { cs[i * 3] = _c.r; cs[i * 3 + 1] = _c.g; cs[i * 3 + 2] = _c.b; if (strip) { st[i * 3] = strip[0]; st[i * 3 + 1] = strip[1]; st[i * 3 + 2] = strip[2]; } }
		geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
		geo.setAttribute('strip', new THREE.BufferAttribute(st, 3));
		if (!by.has(mat)) by.set(mat, []);
		by.get(mat).push(geo);
		return geo;
	}
	const api = {
		add,
		box: (mat, w, h, d, x, y, z, yaw = 0, col, pitch = 0, roll = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, yaw, col, pitch, roll),
		// a box whose centre is at y (not its foot)
		cbox: (mat, w, h, d, x, y, z, yaw = 0, col, pitch = 0, roll = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, yaw, col, pitch, roll),
		cyl: (mat, r0, r1, h, x, y, z, seg = 12, col, pitch = 0, roll = 0, yaw = 0) => add(mat, new THREE.CylinderGeometry(r0, r1, h, seg), x, y, z, yaw, col, pitch, roll),
		// a flat strip on the ground with uv in metres from its middle (asphalt markings)
		strip: (mat, L, H, x, y, z, yaw, col, kind) => { const g = new THREE.PlaneGeometry(L, H, Math.max(1, Math.ceil(L / 40)), 1).rotateX(-Math.PI / 2); const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i)); return add(mat, g, x, y, z, yaw, col, 0, 0, [L, H, kind]); },
		// an extruded profile (x, y points), d deep along z
		extrude: (mat, pts, d, x, y, z, yaw = 0, col, bevel = 0) => { const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, -d / 2); return add(mat, g, x, y, z, yaw, col); },
		lathe: (mat, pts, seg, x, y, z, col, pitch = 0, yaw = 0, roll = 0) => add(mat, new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), x, y, z, yaw, col, pitch, roll),
		has: (mat) => by.has(mat),
		// one merged geometry per material
		geometries() {
			const out = {};
			for (const [mat, gs] of by) { const g = gs.length > 1 ? mergeGeometries(gs) : gs[0]; g.computeBoundingSphere(); g.computeBoundingBox(); out[mat] = g; for (const q of gs) if (q !== g) q.dispose(); }
			by.clear();
			return out;
		},
		// meshes in a group, one per material
		meshes(kit, group = new THREE.Group(), shadows = true) {
			for (const [mat, g] of Object.entries(api.geometries())) {
				const m = new THREE.Mesh(g, kit[mat]);
				m.castShadow = shadows && mat !== 'asphalt' && mat !== 'lamp'; m.receiveShadow = true; m.name = 'mil-' + mat;
				group.add(m);
			}
			return group;
		},
	};
	return api;
}
