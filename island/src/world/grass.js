// A carpet of grass tufts that travels with the player: one draw call, the
// field wraps around the camera, each tuft finds its ground on the GPU and
// grows only where the meadow mask allows. Wind waves roll through it and the
// music's highs make it shimmer.

import * as THREE from 'three';
import { HEIGHT_GLSL, NOISE_GLSL } from './terrain.js';
import { grassStrip } from './textures.js';
import { mulberry32 } from '../noise.js';

export function createGrass(island, shared, count = 20000, span = 84) {
	const blade = new THREE.BufferGeometry();
	// two crossed quads, base at y=0
	const P = [], UV = [], T = [];
	for (const a of [0, Math.PI / 2]) {
		const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, base = P.length / 3;
		P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
		UV.push(0, 0, 1, 0, 1, 1, 0, 1);
		T.push(0, 0, 1, 1);
		void base;
	}
	blade.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	blade.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	blade.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
	blade.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
	const geo = new THREE.InstancedBufferGeometry().copy(blade);
	geo.instanceCount = count;
	const off = new Float32Array(count * 2), rnd = new Float32Array(count), r = mulberry32(99);
	const side = Math.ceil(Math.sqrt(count)), step = span / side;
	for (let i = 0; i < count; i++) {
		off[i * 2] = ((i % side) + r()) * step;
		off[i * 2 + 1] = (Math.floor(i / side) + r()) * step;
		rnd[i] = r();
	}
	geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
	geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 1));

	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
		uMasks: { value: null }, uHeight: { value: null }, uMap: { value: grassStrip() },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCam: { value: new THREE.Vector2() }, uSpan: { value: span },
	}]);
	uniforms.uHeight.value = shared.heightTex;
	uniforms.uMasks.value = shared.maskTex;
	Object.assign(uniforms, { uTime: shared.uTime, uWind: shared.uWind, uHigh: shared.uHigh, uBass: shared.uBass,
		uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uAmbient: shared.uAmbient });

	const mat = new THREE.ShaderMaterial({
		uniforms, fog: true, side: THREE.DoubleSide, transparent: false, alphaTest: 0.5,
		vertexShader: /* glsl */`
			${HEIGHT_GLSL}
			${NOISE_GLSL}
			uniform sampler2D uMasks; uniform vec2 uCam; uniform float uSpan, uTime, uWind, uHigh, uBass;
			attribute vec2 aOff; attribute float aRand; attribute float aTip;
			varying vec2 vUv; varying float vShade; varying float vTip; varying vec3 vW;
			#include <fog_pars_vertex>
			void main(){
				// wrap the tuft into the square centred on the camera
				vec2 o = uCam - uSpan * 0.5;
				vec2 w = o + mod(aOff - o, uSpan);
				float g = texture2D(uMasks, (w + uHalf) / (uHalf * 2.0)).a;
				float path = texture2D(uMasks, (w + uHalf) / (uHalf * 2.0)).r;
				float h = heightAt(w);
				float dCam = length(w - uCam) / (uSpan * 0.5);
				float grow = smoothstep(0.08, 0.35, g + aRand * 0.25) * (1.0 - smoothstep(0.1, 0.5, path)) * smoothstep(1.4, 2.6, h);
				grow *= 1.0 - smoothstep(0.75, 1.0, dCam);
				float tall = (0.45 + aRand * 0.55 + vn(w * 0.07) * 0.6) * grow;
				float ang = aRand * 6.2831;
				vec3 p = position;
				p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz * (0.8 + aRand * 0.6);
				p.y *= tall;
				// wind: a travelling wave plus the music's low end
				float wave = vn(w * 0.08 + vec2(uTime * 0.35, uTime * 0.12));
				float bend = aTip * (0.18 + uWind * 0.35 + uBass * 0.5) * (0.4 + wave);
				p.x += bend * 0.9 + sin(uTime * 2.3 + aRand * 20.0) * 0.05 * aTip;
				p.z += bend * 0.35;
				vec3 world = vec3(w.x, h, w.y) + p;
				vW = world; vUv = uv; vTip = aTip;
				vShade = 0.72 + 0.4 * vn(w * 0.9) + aRand * 0.15;
				vec4 mvPosition = viewMatrix * vec4(world, 1.0);
				gl_Position = projectionMatrix * mvPosition;
				if (tall < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
				#include <fog_vertex>
			}`,
		fragmentShader: /* glsl */`
			uniform sampler2D uMap; uniform vec3 uSunDir, uSunColor, uAmbient; uniform float uHigh, uTime;
			varying vec2 vUv; varying float vShade; varying float vTip; varying vec3 vW;
			#include <fog_pars_fragment>
			void main(){
				vec4 t = texture2D(uMap, vUv);
				if (t.a < 0.5) discard;
				vec3 base = vec3(0.26, 0.40, 0.12) * vShade;
				base = mix(base, vec3(0.60, 0.58, 0.28), smoothstep(0.85, 1.15, vShade) * 0.5);
				vec3 c = t.rgb * base * base;   // texture is already linear; the tint is authored in display space
				float sun = max(0.0, uSunDir.y);
				vec3 lit = c * (uAmbient * (0.6 + 0.6 * vTip) + uSunColor * sun * (0.55 + 0.6 * vTip));
				// translucency: blades glow when the sun is behind them
				lit += c * uSunColor * pow(max(0.0, dot(normalize(vW - cameraPosition), uSunDir)), 4.0) * 0.6 * vTip;
				lit *= 1.0 + uHigh * 0.35 * vTip * (0.5 + 0.5 * sin(uTime * 6.0 + vW.x * 0.7 + vW.z * 0.5));
				gl_FragColor = vec4(lit, 1.0);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
				#include <fog_fragment>
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.name = 'grass';
	mesh.userData.update = (cam) => uniforms.uCam.value.set(cam.position.x, cam.position.z);
	return mesh;
}
