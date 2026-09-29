// Rock in the open country, as it breaks out of the Bay Area's hills: rounded boulders
// half sunk in the grass, bedded sandstone and shale outcrops stepping out of a slope in
// tilted slabs, blocky chert and greenstone, and the stones scattered below them. Each
// is carved from an icosphere by noise (with strata where the rock is bedded), coloured
// darker toward the soil and in its hollows, and drawn with rockMaterial(): grain and pits
// in world space, pale lichen and orange crusts on the tops, moss on the damp north faces.
// The instance colour is the region's rock (the naturalist's geology: realcity.js ROCKS).

import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, makeNoise } from '../noise.js';

// the regions' rock colours and forms: [lat, lon, radius m, colour, form]
// form: round (granite, sandstone domes), bedded (sandstone, shale), blocky (chert, greenstone)
export const GEOLOGY = [
	[37.8255, -122.4990, 2600, 0x8e3c2c, 'blocky'],     // Marin Headlands: red ribbon chert
	[37.7920, -122.4570, 900, 0x3a5a4a, 'round'],       // the Presidio's serpentinite
	[37.4735, -122.2835, 1300, 0x40584a, 'round'],      // Edgewood serpentine
	[37.8450, -121.9400, 2400, 0xc8a068, 'bedded'],     // Mt Diablo's Rock City: honey sandstone
	[37.8816, -121.9142, 3500, 0x7a6e5c, 'blocky'],     // Diablo's summit: greenstone and chert
	[37.5550, -122.5080, 2800, 0xc4b69c, 'round'],      // Montara Mountain: speckled granite
	[37.3400, -122.4000, 16000, 0xc8b89a, 'bedded'],    // the Purisima mudstone down the San Mateo coast
	[37.8980, -122.6950, 2500, 0x9a8a70, 'bedded'],     // Duxbury: Monterey shale
	[37.9290, -122.5780, 3200, 0x6e6a5c, 'blocky'],     // Mt Tam: greenstone and serpentine
	[37.5128, -121.8804, 4000, 0x9a8a6e, 'bedded'],     // Mission Peak: sandstone and landslide blocks
	[37.5065, -121.8255, 3000, 0x5e6a58, 'round'],      // Sunol's Little Yosemite: greenstone boulders
	[37.8110, -122.0390, 3000, 0xb09a78, 'bedded'],     // Las Trampas' Rocky Ridge: fossil sandstone
	[37.2300, -122.0960, 3000, 0xb8a482, 'round'],      // Castle Rock: tafoni sandstone
];

function colourAO(g, base) {
	// darker toward the foot and in the hollows (below the mean radius)
	const P = g.attributes.position, col = new Float32Array(P.count * 3);
	let mr = 0;
	for (let i = 0; i < P.count; i++) mr += Math.hypot(P.getX(i), P.getY(i) * 1.4, P.getZ(i));
	mr /= P.count;
	for (let i = 0; i < P.count; i++) {
		const y = P.getY(i), rr = Math.hypot(P.getX(i), y * 1.4, P.getZ(i));
		const k = (0.55 + 0.45 * Math.min(1, Math.max(0, (y + 0.35) / 0.9))) * (0.8 + 0.2 * Math.min(1.2, rr / mr));
		col[i * 3] = base * k; col[i * 3 + 1] = base * k; col[i * 3 + 2] = base * k;
	}
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	return g;
}
function finish(g) {
	g.deleteAttribute('normal'); g.deleteAttribute('uv');
	const m = mergeVertices(g, 1e-4);
	m.computeVertexNormals();
	colourAO(m, 1);
	m.computeBoundingSphere(); m.computeBoundingBox();
	return m;
}
// a boulder: a lumpy rounded mass, flattened a little, its foot below y = 0
export function boulder(seed, form = 'round') {
	const g = new THREE.IcosahedronGeometry(1, 3), P = g.attributes.position, nz = makeNoise(seed), r = mulberry32(seed);
	const sx = 0.9 + r() * 0.5, sz = 0.8 + r() * 0.4, sy = form === 'blocky' ? 0.75 + r() * 0.3 : 0.55 + r() * 0.25, tilt = (r() - 0.5) * 0.5;
	for (let i = 0; i < P.count; i++) {
		let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
		let k = 0.78 + nz.fbm(x * 1.4 + 3, z * 1.4 + y * 1.1, 4) * 0.45;
		if (form === 'blocky') {
			// facets: pull the surface toward a few flat planes (joints)
			const m = Math.max(Math.abs(x), Math.abs(y) * 1.1, Math.abs(z));
			k *= 0.55 + 0.45 / Math.max(0.6, m * 1.25);
			x *= 1.05; z *= 1.05;
		}
		if (form === 'bedded') {
			const ly = y + x * tilt, st = Math.round(ly * 3.2) / 3.2;
			y = y + (st - ly) * 0.5;
			k *= 1 - 0.07 * Math.abs(Math.sin(ly * 10));
		}
		// tafoni and pits on the sandstone
		if (form !== 'blocky') k -= Math.max(0, nz.fbm(x * 3.5 - 9, y * 3.5 + z * 2, 2) - 0.62) * 0.9;
		P.setXYZ(i, x * k * sx, y * k * sy + 0.1, z * k * sz);
	}
	return finish(g);
}
// an outcrop: tilted slabs of bedded rock stepping out of the slope, the up-dip edge
// sticking out of the ground like a row of teeth (the hogbacks of Diablo and Mission Peak)
export function outcrop(seed, form = 'bedded') {
	const r = mulberry32(seed), parts = [];
	const n = form === 'round' ? 3 : 4 + Math.floor(r() * 3), dip = 0.35 + r() * 0.35;
	for (let i = 0; i < n; i++) {
		const g = boulder(seed * 13 + i, form === 'round' ? 'round' : form);
		const s = form === 'round' ? 0.7 + r() * 0.6 : 0.6 + r() * 0.5;
		const m = new THREE.Matrix4().compose(
			new THREE.Vector3((i - n / 2) * 0.9 * s + (r() - 0.5) * 0.4, (form === 'round' ? 0 : -0.15) + r() * 0.2, (r() - 0.5) * 0.9),
			new THREE.Quaternion().setFromEuler(new THREE.Euler(form === 'round' ? (r() - 0.5) * 0.3 : dip + (r() - 0.5) * 0.15, r() * 0.4, (r() - 0.5) * 0.2)),
			new THREE.Vector3(s * (form === 'round' ? 1 : 1.2), s * (form === 'round' ? 0.9 : 1.3), s * (form === 'round' ? 1 : 0.7)));
		g.applyMatrix4(m);
		parts.push(g);
	}
	const g = mergeGeometries(parts, false);
	g.computeBoundingSphere(); g.computeBoundingBox();
	return g;
}
// a stone: a small worn cobble or angular chip
export function stone(seed) {
	const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position, nz = makeNoise(seed);
	for (let i = 0; i < P.count; i++) {
		const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.75 + nz.fbm(x * 1.7 + 2, z * 1.7 - y, 2) * 0.5;
		P.setXYZ(i, x * k * 1.2, y * k * 0.6, z * k);
	}
	return finish(g);
}

// grain, pits, lichen, moss: all in world space, so no two rocks carry the same marks
const RN = `
float rkh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rkn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(rkh(i), rkh(i + vec3(1,0,0)), f.x), mix(rkh(i + vec3(0,1,0)), rkh(i + vec3(1,1,0)), f.x), f.y),
		mix(mix(rkh(i + vec3(0,0,1)), rkh(i + vec3(1,0,1)), f.x), mix(rkh(i + vec3(0,1,1)), rkh(i + vec3(1,1,1)), f.x), f.y), f.z); }
float rkf(vec3 p){ return rkn(p) * 0.5 + rkn(p * 2.03 + 3.1) * 0.3 + rkn(p * 4.1 - 1.7) * 0.2; }
`;
export function rockMaterial(fogBelt) {
	// fogBelt: { value } 0 inland .. 1 in the fog, where moss and lichen are thick
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uFogBelt = fogBelt;
		sh.vertexShader = 'varying vec3 vRkW; varying vec3 vRkN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			{ vec4 rw = vec4(transformed, 1.0);
			#ifdef USE_INSTANCING
			rw = instanceMatrix * rw;
			#endif
			vRkW = (modelMatrix * rw).xyz;
			vec3 rn = objectNormal;
			#ifdef USE_INSTANCING
			rn = mat3(instanceMatrix) * rn;
			#endif
			vRkN = normalize(mat3(modelMatrix) * rn); }`);
		sh.fragmentShader = 'varying vec3 vRkW; varying vec3 vRkN; uniform float uFogBelt; float rkRough = 0.92;\n' + RN + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 q = vRkW;
				float g1 = rkf(q * 1.3), g2 = rkn(q * 7.0), up = vRkN.y;
				diffuseColor.rgb *= 0.62 + 0.55 * g1;
				diffuseColor.rgb *= 1.0 - 0.35 * smoothstep(0.62, 0.8, g2);
				// crustose lichen: pale grey-green rosettes on the tops, bright orange where birds perch
				float lich = smoothstep(0.58, 0.66, rkf(q * 2.3 + 11.0)) * smoothstep(-0.2, 0.5, up);
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.64, 0.55), lich * (0.35 + 0.35 * uFogBelt));
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.42, 0.08), smoothstep(0.74, 0.8, rkf(q * 3.1 - 4.0)) * smoothstep(0.3, 0.8, up) * 0.7);
				// moss: on the north-facing, shaded sides in the damp
				float north = clamp(-vRkN.z, 0.0, 1.0);
				float moss = smoothstep(0.35, 0.7, north * 0.8 + rkf(q * 0.9 + 5.0) * 0.5 - 0.1) * uFogBelt;
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.16, 0.04), moss * 0.8);
				// dark and damp where it meets the soil
				rkRough = mix(0.92, 0.75, moss);
			}`)
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rkRough;')
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
			{
				float hR = rkf(vRkW * 3.0) * 0.04 + rkn(vRkW * 11.0) * 0.012;
				vec3 sp = -vViewPosition, dx = dFdx(sp), dy = dFdy(sp);
				vec3 R1 = cross(dy, normal), R2 = cross(normal, dx);
				float det = dot(dx, R1) * faceDirection;
				vec2 dH = vec2(dFdx(hR), dFdy(hR));
				normal = normalize(abs(det) * normal - sign(det) * (dH.x * R1 + dH.y * R2));
			}`);
	};
	m.customProgramCacheKey = () => 'nature-rock';
	return m;
}
