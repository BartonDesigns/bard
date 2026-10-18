// The forest past the trees' draw distance. Real crowns stop about 800 m out (palms 600 m),
// so from a beach the far side of the island used to stand bare. Here every tree the
// scatter placed (vegetation.js cells) also stands as an impostor: one quad turned to the
// camera, with a lumpy crown cut out of it in the shader, lit as a ball of leaves (sunny
// top, shaded underside, its own lumps catching the light), leaf-tinted and snowed on as the
// real crowns are.
//
//  - Across the real trees' last band (farR * 0.84 to farR) each pixel belongs to one or the
//    other, by the same screen noise as world/lodfade.js: the crowns dissolve into their
//    impostors, never both, never a pop.
//  - Far off they thin out: past `thin` metres only a share falling as 1/d is kept, each one
//    grown so the canopy keeps its cover (the forest on a far ridge is a texture, not trees).
//  - Nothing is streamed: one static instanced draw per species, filled once. Inside the
//    real trees' reach the vertex shader folds each quad to a point.
//
//   createFarForest(vegetation, island, shared, scene, { isPhone })   { group, update(), info(), dispose() }

import * as THREE from 'three';
import { PLANET_GLSL, planetUniforms } from './terrain.js';

// what the leaf texture (textures.js leafCluster / palmFrond) does to a crown's vertex colour
// on average, so the impostor matches the crowns it takes over from
const TEX_AVG = { leaf: [0.47, 0.6, 0.41], frond: [0.6, 0.76, 0.42] };

function crownStats(geo) {
	geo.computeBoundingBox();
	const c = geo.attributes.color, n = c ? c.count : 0, a = [0, 0, 0];
	for (let i = 0; i < n; i++) { a[0] += c.getX(i); a[1] += c.getY(i); a[2] += c.getZ(i); }
	return { box: geo.boundingBox, col: n ? a.map((v) => v / n) : [0.1, 0.18, 0.06] };
}

const VERT = /* glsl */`
	uniform vec4 uFF;         // x, y: the real trees' last band; z: thin out past; w: crown bottom (share of height)
	uniform float uFFTilt;
	varying vec3 vFQ;         // across (-1..1), up (0..1), the plant's seed
	varying vec4 vFM;         // its width and height (m), distance, crown bottom
	varying vec3 vFSide, vFUp;
	varying float vSnowK, vBioA;
`;
const PROJECT = /* glsl */`
	vec3 fC = instanceMatrix[3].xyz;
	float fW = instanceMatrix[0].x, fH = instanceMatrix[1].y, fS = instanceMatrix[2].z - 1.0;
	vec3 toC = cameraPosition - fC;
	float fD = length(toC.xz);
	// far off, a share falling as 1/d is kept, each grown so the cover stays
	float keep = clamp(uFF.z / max(fD, 1.0), 0.12, 1.0);
	float alive = step(fract(fS * 7.31 + 0.13), keep) * step(uFF.x - 8.0, fD);
	// (and a little fuller far off, where a crown is a few pixels: the stands close into a canopy)
	float grow = min(1.9, inversesqrt(keep)) * (1.0 + 0.3 * smoothstep(900.0, 2600.0, fD));
	fW *= grow; fH *= grow;
	vec3 dir = normalize(toC);
	vec3 side = normalize(vec3(toC.z, 0.0, -toC.x) + vec3(1e-5, 0.0, 0.0));
	// stood upright, leant back toward the camera when seen from above (about the crown's middle)
	vec3 upv = normalize(mix(vec3(0.0, 1.0, 0.0), cross(dir, side), uFFTilt * smoothstep(0.15, 0.8, dir.y)));
	float mid = mix(uFF.w, 1.0, 0.5);
	vec3 wp = fC + vec3(0.0, fH * mid, 0.0) + (side * position.x * fW + upv * (position.y - mid) * fH) * alive;
	vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
	gl_Position = projectionMatrix * mvPosition;
	vFQ = vec3(position.x * 2.0, position.y, fS);
	vFM = vec4(fW, fH, fD, uFF.w);
	vFSide = normalize((viewMatrix * vec4(side, 0.0)).xyz);
	vFUp = normalize((viewMatrix * vec4(upv, 0.0)).xyz);
	plBegin(fC.xz);
	vBioA = gBioA;
	vSnowK = plSnow(fC.y + fH * 0.7, fract(fS * 3.7));
`;
const FRAG_HEAD = /* glsl */`
	uniform vec4 uFF;
	uniform vec4 uLeafT, uLeafT2;
	uniform float uFFPalm;
	varying vec3 vFQ;
	varying vec4 vFM;
	varying vec3 vFSide, vFUp;
	varying float vSnowK, vBioA;
	float ffIgn(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
	float ffH(float s, float k) { return fract(sin(s * 91.7 + k * 17.3) * 43758.5453); }
	vec3 gFN = vec3(0.0, 0.0, 1.0);
	float gFAO = 1.0;
`;
// the crown's shape (in metres on the quad): lumps of leaves round a body, or a palm's tuft
const SHAPE = /* glsl */`
	{
		// the real crowns' share of this pixel (they keep it while hL < their share)
		if (ffIgn(gl_FragCoord.xy) < 1.0 - smoothstep(uFF.x, uFF.y, vFM.z)) discard;
		float W = vFM.x, H = vFM.y, lo = vFM.w, s = vFQ.z;
		vec2 p = vec2(vFQ.x * 0.5 * W, vFQ.y * H);
		float rx = W * 0.5, ry = (1.0 - lo) * H * 0.5;
		vec2 c0 = vec2(0.0, lo * H + ry);
		float best = 1e9;
		vec2 bq = vec2(0.0);
		if (uFFPalm > 0.5) {
			// a palm's crown: fronds out from the top, drooping at their tips
			vec2 q = (p - vec2(0.0, H - ry * 0.7)) / vec2(rx, ry * 1.3);
			float a = atan(q.y, q.x), r = length(q);
			float fr = 0.5 + 0.5 * cos(a * 4.0 + s * 31.0);
			float reach = mix(0.35, 1.0, pow(fr, 2.5)) * (q.y < 0.0 ? 0.8 : 0.55);
			best = r / reach;
			bq = q * 0.8;
		} else {
			// the body and four lumps on it (from the seed), each a ball of leaves
			for (int i = 0; i < 5; i++) {
				float fi = float(i);
				vec2 off = i == 0 ? vec2(0.0) : vec2((ffH(s, fi) - 0.5) * 1.1 * rx, (ffH(s, fi + 7.0) - 0.4) * 0.9 * ry);
				float rad = i == 0 ? 0.86 : mix(0.48, 0.68, ffH(s, fi + 3.0));
				vec2 q = (p - c0 - off) / (vec2(rx, ry) * rad);
				float d = dot(q, q);
				// a broken, leafy edge
				d += 0.11 * sin(atan(q.y, q.x) * 7.0 + s * 40.0 + fi * 2.1) * smoothstep(0.5, 1.0, d);
				if (d < best) { best = d; bq = q; }
			}
		}
		if (best > 1.0) discard;
		vec2 nq = bq * 0.9;
		gFN = normalize(vec3(nq, sqrt(max(0.05, 1.0 - dot(nq, nq)))));
		// darker low in the crown and on its rim, where the leaves are behind others
		gFAO = mix(0.66, 1.0, smoothstep(lo, 1.0, vFQ.y)) * mix(1.0, 0.75, smoothstep(0.55, 1.0, best));
	}
`;

export function createFarForest(vegetation, island, shared, scene, { isPhone = false } = {}) {
	const group = new THREE.Group();
	group.name = 'farforest';
	const meshes = [];
	const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
	const tilt = { value: 0.85 };
	const sp0 = vegetation?.species || [];
	const thin = isPhone ? 950 : 1600;
	let total = 0;
	for (const sp of sp0) {
		if (!sp.far || !(sp.tree || sp.key === 'palm')) continue;
		const items = [];
		for (const c of vegetation.cells.values()) { const L = c.items[sp.key]; if (L) for (const it of L) items.push(it); }
		if (!items.length) continue;
		// each variant's crown: its box (the quad's size) and colour
		const vs = sp.far.map((v) => {
			const crown = crownStats(v.parts[v.parts.length - 1]), trunk = v.parts[0].boundingBox || (v.parts[0].computeBoundingBox(), v.parts[0].boundingBox);
			const b = crown.box, top = Math.max(b.max.y, trunk.max.y);
			const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.92;
			const T = TEX_AVG[sp.mats[1]] || TEX_AVG.leaf;
			return { w, h: top, lo: Math.max(0.05, Math.min(0.8, b.min.y / Math.max(top, 0.1))), col: crown.col.map((x, k) => x * T[k]) };
		});
		const lo = vs.reduce((a, v) => a + v.lo, 0) / vs.length;
		const R = sp.farR || 800;
		const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
		const uFF = { value: new THREE.Vector4(R * 0.84, R, thin, lo) }, uPalm = { value: sp.key === 'palm' ? 1 : 0 };
		mat.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, planetUniforms(shared));
			sh.uniforms.uFF = uFF; sh.uniforms.uFFTilt = tilt; sh.uniforms.uFFPalm = uPalm;
			sh.uniforms.uLeafT = shared.uLeafT || { value: new THREE.Vector4(1, 1, 1, 0) };
			sh.uniforms.uLeafT2 = shared.uLeafT2 || { value: new THREE.Vector4(1, 1, 1, 0) };
			sh.vertexShader = PLANET_GLSL + VERT + sh.vertexShader.replace('#include <project_vertex>', PROJECT);
			sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + SHAPE)
				.replace('#include <color_fragment>', `#include <color_fragment>
	diffuseColor.rgb *= gFAO;
	vec4 lt = mix(uLeafT, uLeafT2, vBioA);
	if (lt.a > 0.0) {
		float green = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 25.0, 0.0, 1.0);
		diffuseColor.rgb = mix(diffuseColor.rgb, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * lt.rgb, green * lt.a);
	}`)
				.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
	normal = normalize(vFSide * gFN.x + vFUp * gFN.y + cross(vFSide, vFUp) * gFN.z);
	if (vSnowK > 0.01) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), vSnowK * smoothstep(-0.1, 0.5, gFN.y) * 0.9);`);
		};
		mat.customProgramCacheKey = () => 'farforest3';
		const im = new THREE.InstancedMesh(quad, mat, items.length);
		const m4 = new THREE.Matrix4(), col = new THREE.Color();
		items.forEach((it, i) => {
			const v = vs[it.v % vs.length];
			// (the seed rides in the z scale: the quad is flat, so it scales nothing)
			m4.makeScale(v.w * it.scale, v.h * it.scale, 1 + ((i * 0.618034) % 1));
			m4.setPosition(it.x, it.y, it.z);
			im.setMatrixAt(i, m4);
			col.setRGB(v.col[0] * it.tint, v.col[1] * it.tint, v.col[2] * it.tint);
			im.setColorAt(i, col);
		});
		im.frustumCulled = false;
		im.castShadow = false; im.receiveShadow = false;
		im.name = 'farforest-' + sp.key;
		im.userData.material175 = 'wood';
		group.add(im);
		meshes.push({ im, mat, key: sp.key, n: items.length });
		total += items.length;
	}
	scene.add(group);
	const info = () => ({ trees: total, species: meshes.map((m) => m.key + ':' + m.n), visible: group.visible });
	function dispose() {
		scene.remove(group);
		for (const m of meshes) { m.im.dispose(); m.mat.dispose(); }
		quad.dispose();
	}
	return { group, info, dispose, update() {} };
}
