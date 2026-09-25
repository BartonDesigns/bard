// A carpet of grass tufts that travels with the player: one draw call per
// layer, the field wraps around the camera, each tuft finds its ground on the
// GPU and grows only where the meadow mask allows. It is lit like the ground
// (sun, sky, and the shadows of trees and houses), so it sits in the world
// instead of glowing over it. Wind waves roll through it and the music's
// highs make it shimmer.
//
// Two layers: a dense short one right around the feet and a sparser, longer
// reaching one, so the ground close by reads as turf, not as a few cards.

import * as THREE from 'three';
import { HEIGHT_GLSL, NOISE_GLSL, OCC_GLSL } from './terrain.js';
import { grassStrip } from './textures.js';
import { mulberry32 } from '../noise.js';

let stripTex = null;

export function createGrass(island, shared, count = 20000, span = 84, opts = {}) {
	const width = opts.width ?? 0.42, heightK = opts.height ?? 1, seed = opts.seed ?? 99;
	const blade = new THREE.BufferGeometry();
	// three quads at 60 degrees, base at y=0: a tuft looks full from any direction,
	// never like a flat comb
	const P = [], UV = [], T = [];
	for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) {
		const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
		P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
		UV.push(0, 0, 1, 0, 1, 1, 0, 1);
		T.push(0, 0, 1, 1);
	}
	blade.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	blade.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	blade.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
	blade.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
	blade.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
	const geo = new THREE.InstancedBufferGeometry().copy(blade);
	geo.instanceCount = count;
	const off = new Float32Array(count * 2), rnd = new Float32Array(count * 2), r = mulberry32(seed);
	const side = Math.ceil(Math.sqrt(count)), step = span / side;
	for (let i = 0; i < count; i++) {
		off[i * 2] = ((i % side) + r()) * step;
		off[i * 2 + 1] = (Math.floor(i / side) + r()) * step;
		rnd[i * 2] = r(); rnd[i * 2 + 1] = r();
	}
	geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
	geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 2));
	geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);

	const uniforms = {
		uMasks: { value: shared.maskTex }, uHeight: { value: shared.heightTex }, uMap: { value: stripTex || (stripTex = grassStrip()) },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCam: { value: new THREE.Vector2() }, uSpan: { value: span }, uWidth: { value: width }, uTallK: { value: heightK },
		uTime: shared.uTime, uWind: shared.uWind, uGust: shared.uGust, uWindT: shared.uWindT, uWindDir: shared.uWindDir, uHigh: shared.uHigh, uBass: shared.uBass,
		uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uOcc: shared.uOcc, uOccO: shared.uOccO,
	};

	const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, alphaToCoverage: true });
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uniforms);
		sh.vertexShader = `
			${HEIGHT_GLSL}
			${NOISE_GLSL}
			${OCC_GLSL}
			uniform sampler2D uMasks; uniform vec2 uCam; uniform float uSpan, uWidth, uTallK, uTime, uWind, uHigh, uBass, uGust, uWindT; uniform vec2 uWindDir;
			attribute vec2 aOff; attribute vec2 aRand; attribute float aTip;
			varying vec2 vGUv; varying vec3 vTint; varying float vTip; varying vec3 vGW; varying float vTall228; varying float vGust;
			float gTall;
			` + sh.vertexShader
			.replace('#include <beginnormal_vertex>', `
				// wrap the tuft into the square centred on the camera
				vec2 o = uCam - uSpan * 0.5;
				vec2 w = o + mod(aOff - o, uSpan);
				vec4 mk = texture2D(uMasks, (w + uHalf) / (uHalf * 2.0));
				float h = heightAt(w);
				float dCam = length(w - uCam) / (uSpan * 0.5);
				// Natural grass varies slowly over the ground, not tuft by tuft. Density,
				// height and colour are smooth fields; each tuft only nudges them a little.
				vec2 oc = occAt(w);
				float occ = oc.r, hug = oc.g * (1.0 - oc.r);
				h += moundAt(w);
				float canopy = smoothstep(0.35, 0.8, mk.a);
				float n1g = fbm3(w * 0.06);
				float meadow = smoothstep(0.3, 0.8, smoothstep(1.4 + n1g * 0.5, 2.3 + n1g * 0.6, h)) * smoothstep(1.3, 2.0, h);
				float density = meadow * (1.0 - smoothstep(0.2, 0.5, mk.r)) * (1.0 - canopy * 0.65) * (1.0 - occ * 0.85);
				density *= 0.85 + 0.15 * vn(w * 0.4 + 5.0);
				// around shrubs, bananas and flowers the grass crowds in and grows up the stems
				density = min(1.0, density + hug * 0.6 * meadow);
				// a tuft exists where its random falls under the local density: thinning is
				// even and gradual, so edges feather out instead of breaking into bald spots
				float grow = step(aRand.y, density) * (1.0 - smoothstep(0.7, 1.0, dCam));
				// height: a gentle field, longer drifts in hollows, cropped in the village,
				// shorter at stems and right under your eye
				// the land decides: tall bunch grass where the ecology says meadow and damp,
				// short turf on ridges, paths and round the houses
				float tallMap = mk.b;
				float tall = mix(0.24, 0.4, vn(w * 0.13 + 2.0)) + tallMap * (0.55 + 0.35 * vn(w * 0.4 + 7.0));
				tall *= 0.9 + 0.2 * aRand.x;
				tall *= 1.0 - occ * 0.6;
				tall *= 1.0 + hug * 0.9;
				tall *= mix(1.0, 0.5, mk.g) * uTallK * grow;
				gTall = tall;
				float ang = aRand.y * 6.2831;
				vGUv = uv; vTip = aTip;
				// colour: broad drifts of green and sun-dried straw, barely any tuft speckle
				float hue = vn(w * 0.035 + 3.0), dry = smoothstep(0.58, 0.82, vn(w * 0.02 - 7.0)) * (1.0 - mk.a * 0.8);
				vec3 g1 = vec3(0.34, 0.50, 0.12), g2 = vec3(0.42, 0.55, 0.14);
				vec3 tint = mix(g1, g2, hue);
				// fresh green where it is damp and deep, straw-gold on the dry open slopes
				float damp = smoothstep(0.3, 0.8, tallMap);
				tint = mix(tint, vec3(0.28, 0.5, 0.14), damp * 0.35);
				tint = mix(tint, vec3(0.62, 0.56, 0.28), max(dry * 0.45, (1.0 - damp) * smoothstep(0.55, 0.75, vn(w * 0.012 + 9.0)) * 0.4));
				tint *= 0.97 + 0.06 * aRand.x;
				vTall228 = tallMap;
				tint *= 1.0 - occ * 0.25;
				vTint = tint * tint;   // authored in display space
				vec3 objectNormal = vec3(0.0, 1.0, 0.0);`)
			.replace('#include <begin_vertex>', `
				vec3 p = position;
				p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz * uWidth * (0.9 + aRand.x * 0.2);
				p.y *= tall;
				// wind: a slow swell advected by the wind's own clock (so lulls slow it and
				// gusts hurry it), plus the music's low end; stiffer when short
				vec2 wd = normalize(uWindDir);
				float wave = vn(w * 0.08 - wd * uWindT * 1.4 + vec2(0.0, uWindT * 0.3));
				// lean the blade over (rotate, keeping its length) rather than dragging the tip
				// sideways: long grass bows, it never smears into a streak
				// gusts: bands of wind rolling across the meadow, broken up so they read as
				// cat's-paws, stronger with the wind setting and the music's highs
				// cat's-paws: irregular patches of stronger air of every size, carried along
				// the wind; how hard they press follows the gust now blowing (random in time)
				vec2 gp = w - wd * uWindT * 9.0;
				float patchA = smoothstep(0.42, 0.85, vn(gp * 0.018 + 3.1));
				float patchB = smoothstep(0.5, 0.9, vn(gp * 0.047 - 7.3 + vec2(uWindT * 0.4, 0.0)));
				float gust = max(patchA, patchB * 0.7) * (uGust * 1.6 + uHigh * 0.25);
				vGust = gust;
				float lean = clamp((0.015 + uWind * 0.24 + uBass * 0.25) * (0.3 + wave) + gust * 0.55 + sin(uTime * (1.6 + aRand.y * 1.8) + aRand.x * 20.0) * (0.004 + uWind * 0.02 + uGust * 0.04), -0.1, 0.85);
				lean *= mix(1.0, 0.6, smoothstep(0.4, 1.0, tall));
				float ly = p.y;
				p.x += sin(lean) * ly * 0.93 * wd.x + sin(lean) * ly * 0.35 * -wd.y;
				p.z += sin(lean) * ly * 0.93 * wd.y + sin(lean) * ly * 0.35 * wd.x;
				p.y = cos(lean) * ly;
				// you part the grass: blades near your feet bend away from you
				vec2 away = w - uCam; float ad = length(away);
				float push = (1.0 - smoothstep(0.25, 1.1, ad)) * aTip;
				p.xz += away / max(ad, 0.05) * push * ly * 0.8;
				p.y -= push * ly * 0.45;
				// the tuft's foot sits a little in the soil, so there is no hard base line
				vec3 transformed = vec3(w.x, h - 0.05 - 0.04 * aRand.x, w.y) + p;
				vGW = transformed;`)
			.replace('#include <project_vertex>', `#include <project_vertex>
				if (gTall < 0.04) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`);
		// both faces of a blade are lit as the meadow is (up), never as their dark underside
		sh.fragmentShader = `
			uniform sampler2D uMap; uniform vec3 uSunDir, uSunColor; uniform float uHigh, uTime;
			varying vec2 vGUv; varying vec3 vTint; varying float vTip; varying vec3 vGW; varying float vTall228; varying float vGust;
			` + sh.fragmentShader
			.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\t\t\t\tnormal = normalize(vNormal);')
			.replace('#include <map_fragment>', `
				// the strip gives only the blade shapes; colour comes from the tuft, so
				// filtered edges never bleed dark
				vec4 gt = texture2D(uMap, vGUv);
				// soft coverage: MSAA turns the edge into a fade, and the blades never thin to nothing
				// fine blades fall below a pixel with distance: widen their coverage as the
				// texture minifies, so the meadow keeps its fill instead of thinning out
				float mip = max(0.0, log2(max(fwidth(vGUv.x) * 512.0, 1e-3)));
				float thr = max(0.04, 0.3 - mip * 0.09);
				float cov = clamp((gt.a - thr) / max(fwidth(gt.a) * 1.2, 1e-3) + 0.5, 0.0, 1.0);
				if (cov < 0.02) discard;
				diffuseColor.a = cov;
				// darker at the root where blades crowd and shade each other, paler at the tips
				float rootK = smoothstep(0.0, 0.6, vGUv.y);
				// each blade keeps its own tone, so the fine blades read one by one
				diffuseColor.rgb = vTint * mix(0.62, 1.08, rootK) * (0.62 + 0.55 * gt.g);
				// a gust flips the blades to show their paler undersides
				diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + vec3(0.03, 0.03, 0.0), vGust * 0.5 * vTip);
				// tall grass goes to seed: pale straw tips
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.58, 0.36) * vec3(0.62, 0.58, 0.36), smoothstep(0.7, 1.0, vGUv.y) * smoothstep(0.3, 0.8, vTall228) * 0.7);`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				// blades glow when the sun is behind them; the highs make the field shimmer
				float back = pow(max(0.0, dot(normalize(vGW - cameraPosition), uSunDir)), 4.0) * max(0.0, uSunDir.y + 0.1);
				totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * 0.45 * vTip;
				// sheen: blades are glossy along their length; looking toward the sun the field
				// silvers, the tips lighting up yellow-green where light comes through
				vec3 Vg = normalize(cameraPosition - vGW);
				float toward = pow(max(0.0, dot(-Vg, uSunDir) * 0.5 + 0.5), 6.0) * smoothstep(0.0, 0.2, uSunDir.y);
				totalEmissiveRadiance += (vec3(0.75, 0.8, 0.7) * 0.1 + vec3(0.4, 0.5, 0.1) * 0.25 * vTip * vTip) * toward * uSunColor;
				totalEmissiveRadiance += diffuseColor.rgb * uHigh * 0.3 * vTip * (0.5 + 0.5 * sin(uTime * 6.0 + vGW.x * 0.7 + vGW.z * 0.5));`);
	};
	mat.customProgramCacheKey = () => 'island-grass';
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.receiveShadow = true;
	mesh.name = 'grass';
	mesh.userData.update = (cam) => uniforms.uCam.value.set(cam.position.x, cam.position.z);
	return mesh;
}
