// What lies on the ground: pebbles along paths and the shore, fallen leaves
// under the trees, shells and coral bits at the tide line. Each kind is one
// instanced draw that wraps around the player like the grass, finds its
// ground and its slope on the GPU, and only shows where it belongs. Lit and
// shadowed like everything else, so it sits in the dirt instead of on it.

import * as THREE from 'three';
import { HEIGHT_GLSL, NOISE_GLSL, OCC_GLSL } from './terrain.js';
import { mulberry32, makeNoise } from '../noise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function pebbleGeometry(seed) {
	const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position, nz = makeNoise(seed);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const k = 0.8 + nz.fbm(x * 1.6 + 2, z * 1.6 - y, 2) * 0.4;
		p.setXYZ(i, x * k * 1.2, Math.max(-0.3, y) * k * 0.7, z * k);
	}
	// shared corners, smooth normals: a worn stone, not a cut gem
	const m = mergeVertices(g.deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
	m.computeVertexNormals();
	return m;
}
function leafGeometry() {
	// a leaf lying on the ground, curled up at the edges
	const g = new THREE.BufferGeometry(), P = [], N = [], UV = [], I = [];
	const cols = 3, rows = 2;
	for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
		const u = i / cols, v = j / rows, x = (u - 0.5), z = (v - 0.5) * 0.55;
		P.push(x, 0.03 + Math.pow(Math.abs(v - 0.5) * 2, 2) * 0.12 + Math.sin(u * 3.14) * 0.03, z);
		N.push(0, 1, 0); UV.push(u, v);
	}
	for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
		const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
		I.push(a, c, b, b, c, d);
	}
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	g.setIndex(I);
	return g;
}
function shellGeometry() {
	// a ribbed cockle: half a squashed sphere with ridges
	const g = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
		const rib = 1 + 0.06 * Math.cos(a * 9);
		p.setXYZ(i, x * rib, y * 0.45, z * rib * 0.85);
	}
	g.computeVertexNormals();
	return g;
}
function leafTexture() {
	const S = 128, c = document.createElement('canvas');
	c.width = c.height = S;
	const g = c.getContext('2d'), r = mulberry32(17);
	g.translate(S / 2, S / 2);
	g.beginPath();
	g.moveTo(-S * 0.48, 0);
	g.bezierCurveTo(-S * 0.2, -S * 0.42, S * 0.25, -S * 0.36, S * 0.48, 0);
	g.bezierCurveTo(S * 0.25, S * 0.36, -S * 0.2, S * 0.42, -S * 0.48, 0);
	g.closePath();
	g.fillStyle = '#d8d2c0'; g.fill();
	g.save(); g.clip();
	for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${90 + r() * 60},${70 + r() * 40},${40 + r() * 30},0.18)`; g.beginPath(); g.arc((r() - 0.5) * S, (r() - 0.5) * S, 2 + r() * 9, 0, 7); g.fill(); }
	g.strokeStyle = 'rgba(80,60,40,0.55)'; g.lineWidth = 2;
	g.beginPath(); g.moveTo(-S * 0.5, 0); g.lineTo(S * 0.48, 0); g.stroke();
	g.lineWidth = 1;
	for (let x = -S * 0.35; x < S * 0.4; x += 11) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, -S * 0.26); g.moveTo(x, 0); g.lineTo(x + 14, S * 0.26); g.stroke(); }
	g.restore();
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

// kind.place is GLSL that sets `float s` (size in metres, 0 hides) and `vec3 tint`
// from: mk (masks), h (height), slope, rr (two randoms), w (ground xz)
function field(island, shared, { geo, count, span, seed, place, map, rough = 0.9, lie = 1.0, sink = 0.0, name, material175 }) {
	const ig = new THREE.InstancedBufferGeometry().copy(geo);
	ig.instanceCount = count;
	const off = new Float32Array(count * 2), rnd = new Float32Array(count * 2), r = mulberry32(seed);
	for (let i = 0; i < count; i++) { off[i * 2] = r() * span; off[i * 2 + 1] = r() * span; rnd[i * 2] = r(); rnd[i * 2 + 1] = r(); }
	ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
	ig.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 2));
	ig.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
	const uniforms = {
		uMasks: { value: shared.maskTex }, uHeight: { value: shared.heightTex },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCam: { value: new THREE.Vector2() }, uSpan: { value: span },
		uOcc: shared.uOcc, uOccO: shared.uOccO,
	};
	const mat = new THREE.MeshStandardMaterial({ roughness: rough, metalness: 0, map: map || null, alphaTest: map ? 0.5 : 0, alphaToCoverage: !!map, side: map ? THREE.DoubleSide : THREE.FrontSide });
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uniforms);
		sh.vertexShader = `
			${HEIGHT_GLSL}
			${NOISE_GLSL}
			${OCC_GLSL}
			uniform sampler2D uMasks; uniform vec2 uCam; uniform float uSpan;
			attribute vec2 aOff; attribute vec2 aRand;
			varying vec3 vLTint;
			float lS; mat3 lR; vec3 lBase;
			` + sh.vertexShader
			.replace('#include <beginnormal_vertex>', `
				vec2 o = uCam - uSpan * 0.5;
				vec2 w = o + mod(aOff - o, uSpan);
				vec4 mk = texture2D(uMasks, (w + uHalf) / (uHalf * 2.0));
				float h = heightAt(w) + moundAt(w);
				float e = 0.6;
				vec3 tn = normalize(vec3(heightAt(w - vec2(e, 0.0)) - heightAt(w + vec2(e, 0.0)), 2.0 * e, heightAt(w - vec2(0.0, e)) - heightAt(w + vec2(0.0, e))));
				float slope = 1.0 - tn.y;
				vec2 rr = aRand;
				float s = 0.0; vec3 tint = vec3(1.0);
				${place}
				s *= 1.0 - smoothstep(0.75, 1.0, length(w - uCam) / (uSpan * 0.5));
				lS = s;
				vLTint = tint * tint;
				// lie along the ground (lie = 1) or stand upright (lie = 0), random heading
				vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), tn, ${lie.toFixed(2)}));
				float a = rr.y * 6.2831;
				vec3 fx = normalize(cross(up, vec3(sin(a), 0.0, cos(a))));
				vec3 fz = cross(fx, up);
				lR = mat3(fx, up, fz);
				lBase = vec3(w.x, h - ${sink.toFixed(3)} * s, w.y);
				vec3 objectNormal = lR * normal;`)
			.replace('#include <begin_vertex>', 'vec3 transformed = lBase + lR * (position * s);')
			.replace('#include <project_vertex>', `#include <project_vertex>
				if (lS < 0.005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`);
		sh.fragmentShader = 'varying vec3 vLTint;\n' + sh.fragmentShader
			.replace('#include <normal_fragment_begin>', map ? '#include <normal_fragment_begin>\n\tnormal = normalize(vNormal);' : '#include <normal_fragment_begin>')
			.replace('#include <color_fragment>', '#include <color_fragment>\n\t\t\tdiffuseColor.rgb *= vLTint;');
	};
	mat.customProgramCacheKey = () => 'island-litter-' + name;
	const mesh = new THREE.Mesh(ig, mat);
	mesh.frustumCulled = false;
	mesh.receiveShadow = true;
	mesh.name = 'litter-' + name;
	mesh.userData.material175 = material175;
	mesh.userData.update = (cam) => uniforms.uCam.value.set(cam.position.x, cam.position.z);
	return mesh;
}

export function createLitter(island, shared, scene, scale = 1) {
	const seed = island.seed;
	const kinds = [
		field(island, shared, {
			name: 'pebbles', geo: pebbleGeometry(seed + 5), count: Math.round(2600 * scale), span: 34, seed: seed + 1, rough: 0.8, lie: 0.8, sink: 0.25, material175: 'stone',
			place: `
				// gravel lines the path edges, stones gather at the top of the beach and on bare slopes
				float edge = smoothstep(0.1, 0.4, mk.r) * (1.0 - smoothstep(0.75, 1.0, mk.r));
				float beach = smoothstep(0.5, 0.9, h) * (1.0 - smoothstep(1.6, 2.4, h)) * step(0.72, vn(w * 0.09));
				float scree = smoothstep(0.3, 0.5, slope) * step(0.9, h);
				float meadow = step(0.965, rr.x) * step(1.5, h);
				float want = max(max(edge * 0.55, beach), max(scree, meadow));
				s = step(1.0 - want * 0.7, rr.x) * (0.03 + pow(fract(rr.x * 13.7), 3.0) * 0.16);
				float g = 0.3 + 0.16 * fract(rr.y * 7.3);
				tint = vec3(g * 1.04, g, g * 0.92) + vec3(0.1, 0.05, 0.0) * step(0.55, fract(rr.x * 3.1));
				tint *= mix(1.0, 1.3, beach);`,
		}),
		field(island, shared, {
			name: 'leaves', geo: leafGeometry(), map: leafTexture(), count: Math.round(3000 * scale), span: 28, seed: seed + 2, rough: 0.85, lie: 1.0, material175: 'soft',
			place: `
				// fallen leaves thicken where the woods are wild, thin out on paths and lawns
				float wood = smoothstep(0.35, 0.8, mk.a) * smoothstep(3.5, 6.0, h);
				float want = wood * (1.0 - smoothstep(0.2, 0.6, mk.r)) * (1.0 - mk.g) * (0.55 + 0.45 * vn(w * 0.2));
				s = step(1.0 - want, rr.x) * (0.1 + fract(rr.x * 9.1) * 0.14);
				float age = fract(rr.y * 5.7);
				tint = mix(vec3(0.62, 0.48, 0.28), vec3(0.78, 0.62, 0.30), age);
				tint = mix(tint, vec3(0.45, 0.52, 0.26), step(0.8, age));`,
		}),
		field(island, shared, {
			name: 'shells', geo: shellGeometry(), count: Math.round(800 * scale), span: 36, seed: seed + 3, rough: 0.55, lie: 0.9, sink: 0.1, material175: 'stone',
			place: `
				// the strand line: shells and coral bits where the waves leave them
				float strand = smoothstep(0.15, 0.4, h) * (1.0 - smoothstep(0.9, 1.4, h)) * (1.0 - mk.g);
				s = step(1.0 - strand * 0.55, rr.x) * (0.018 + fract(rr.x * 17.3) * 0.03);
				float k = fract(rr.y * 3.3);
				tint = k < 0.5 ? vec3(0.96, 0.92, 0.86) : k < 0.8 ? vec3(0.95, 0.80, 0.74) : vec3(0.85, 0.82, 0.78);`,
		}),
	];
	for (const k of kinds) scene.add(k);
	return {
		meshes: kinds,
		update(cam) { for (const k of kinds) k.userData.update(cam); },
	};
}
