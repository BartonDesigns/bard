// The cities standing up out of their street grids, each built the way it really is:
// San Francisco's attached, pastel Victorians and Edwardians with their bay windows;
// the Sunset's rows of white stucco; the older towns (Oakland, Berkeley, Marin, the
// Peninsula) with detached wood houses under dark pitched roofs; the valley suburbs
// (San Ramon, Danville, Dublin...) with stucco houses under clay-tile hip roofs along
// curving streets; business parks of low office blocks in parking lots; and downtown
// towers in blue, green and bronze glass, white concrete and granite. Around you every
// lot is filled; the downtown towers are kept for tens of kilometres so the skylines
// rise on the horizon. At night the windows light up.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hardwood, shrub, swayMaterial } from '../world/vegetation.js';
import { addLodFade, NONE_IN } from '../world/lodfade.js';
import * as TX from '../world/textures.js';
import { STYLE, BLOCKS, toGrid, fromGrid, ERA, eraFor, sfDistrict } from './styles.js';
import { houseFloor, wallTop, mainOf, isHome } from './houseplan.js';

const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// a kind's fraction carries a detail for the facade shader: where the front door is on a
// house (1.0-1.4), which side the garage is on a row house (0, 0.1, 0.2)
const KIND = { row: 0, house: 1, tower: 2, office: 3, paved: 4, industry: 5, retail: 6, plain: 7, garage: 8, shop: 9, bay: 10, houseGarageL: 11, houseGarageR: 12, pool: 13 };
// a house's front door, from 0 (left) to 1 (right); a bare 1.0 is a wing with no door
const doorKind = (base, door) => base + 0.01 + door * 0.38;

const PAL = {
	sf: [[0.96, 0.9, 0.74], [0.98, 0.86, 0.5], [0.72, 0.86, 0.72], [0.66, 0.8, 0.92], [0.95, 0.7, 0.6], [0.97, 0.96, 0.92], [0.74, 0.74, 0.72], [0.82, 0.72, 0.88], [0.6, 0.72, 0.56], [0.94, 0.8, 0.5], [0.5, 0.62, 0.76], [0.8, 0.5, 0.44], [0.97, 0.96, 0.92], [0.92, 0.9, 0.84], [0.45, 0.55, 0.5], [0.9, 0.62, 0.7]],
	sunset: [[0.95, 0.94, 0.9], [0.93, 0.9, 0.82], [0.88, 0.9, 0.86], [0.9, 0.86, 0.78], [0.82, 0.86, 0.9], [0.94, 0.88, 0.8], [0.86, 0.84, 0.8], [0.9, 0.8, 0.78]],
	older: [[0.93, 0.92, 0.88], [0.86, 0.82, 0.7], [0.62, 0.66, 0.55], [0.55, 0.62, 0.68], [0.5, 0.38, 0.28], [0.9, 0.82, 0.55], [0.66, 0.64, 0.6], [0.35, 0.42, 0.34], [0.6, 0.32, 0.26], [0.8, 0.74, 0.62]],
	olderRoof: [[0.3, 0.3, 0.31], [0.38, 0.34, 0.3], [0.25, 0.24, 0.25], [0.45, 0.4, 0.36]],
	suburb: [[0.91, 0.86, 0.77], [0.85, 0.78, 0.65], [0.94, 0.91, 0.85], [0.79, 0.76, 0.68], [0.8, 0.73, 0.6], [0.72, 0.7, 0.6], [0.89, 0.83, 0.72], [0.84, 0.76, 0.64], [0.94, 0.93, 0.88], [0.84, 0.71, 0.6], [0.7, 0.72, 0.7]],
	tile: [[0.62, 0.32, 0.22], [0.7, 0.4, 0.27], [0.55, 0.3, 0.24], [0.66, 0.46, 0.34], [0.42, 0.4, 0.38], [0.5, 0.46, 0.42], [0.35, 0.33, 0.32]],
	tower: [[0.45, 0.58, 0.7], [0.48, 0.62, 0.6], [0.55, 0.45, 0.35], [0.88, 0.86, 0.82], [0.78, 0.68, 0.62], [0.3, 0.32, 0.35], [0.8, 0.74, 0.62], [0.62, 0.7, 0.78]],
	office: [[0.86, 0.84, 0.8], [0.75, 0.72, 0.66], [0.62, 0.68, 0.72], [0.9, 0.88, 0.82], [0.7, 0.62, 0.52]],
	// suburban tracts by the decade they went up
	ranch: [[0.93, 0.92, 0.86], [0.86, 0.84, 0.66], [0.72, 0.8, 0.74], [0.7, 0.78, 0.84], [0.82, 0.74, 0.62], [0.64, 0.6, 0.52], [0.9, 0.86, 0.78], [0.76, 0.62, 0.52]],
	ranchRoof: [[0.3, 0.3, 0.31], [0.4, 0.37, 0.34], [0.5, 0.46, 0.42], [0.26, 0.25, 0.26]],
	seventies: [[0.55, 0.44, 0.32], [0.72, 0.64, 0.5], [0.5, 0.52, 0.4], [0.66, 0.5, 0.36], [0.82, 0.76, 0.64], [0.6, 0.56, 0.5]],
	shake: [[0.42, 0.38, 0.32], [0.36, 0.33, 0.3], [0.48, 0.43, 0.36]],
	eichler: [[0.35, 0.3, 0.26], [0.5, 0.55, 0.55], [0.3, 0.45, 0.48], [0.8, 0.64, 0.3], [0.9, 0.9, 0.86], [0.42, 0.42, 0.44]],
	flat: [[0.75, 0.74, 0.72], [0.55, 0.55, 0.55]],
	// San Francisco's districts
	chinatown: [[0.78, 0.2, 0.16], [0.2, 0.45, 0.3], [0.93, 0.86, 0.7], [0.85, 0.7, 0.3], [0.9, 0.9, 0.86], [0.6, 0.18, 0.14]],
	northbeach: [[0.93, 0.86, 0.68], [0.86, 0.66, 0.44], [0.8, 0.52, 0.38], [0.95, 0.92, 0.84], [0.78, 0.72, 0.6]],
	nobhill: [[0.9, 0.87, 0.8], [0.82, 0.76, 0.66], [0.7, 0.46, 0.36], [0.95, 0.93, 0.88], [0.62, 0.6, 0.58]],
	mission: [[0.93, 0.66, 0.36], [0.36, 0.62, 0.62], [0.84, 0.42, 0.52], [0.94, 0.84, 0.46], [0.46, 0.56, 0.78], [0.66, 0.78, 0.5], [0.95, 0.94, 0.9], [0.95, 0.94, 0.9], [0.9, 0.88, 0.82], [0.8, 0.46, 0.36]],
	pale: [[0.96, 0.95, 0.92], [0.88, 0.88, 0.86], [0.92, 0.89, 0.82], [0.8, 0.82, 0.84], [0.94, 0.92, 0.88]],
	industry: [[0.8, 0.8, 0.78], [0.7, 0.72, 0.74], [0.78, 0.74, 0.66], [0.62, 0.64, 0.66], [0.85, 0.83, 0.78], [0.66, 0.36, 0.3]],
	retail: [[0.86, 0.8, 0.7], [0.78, 0.72, 0.62], [0.9, 0.88, 0.84], [0.7, 0.66, 0.6], [0.6, 0.5, 0.42]],
	crown: [[0.2, 0.28, 0.12], [0.32, 0.4, 0.18], [0.18, 0.26, 0.14], [0.14, 0.22, 0.12], [0.38, 0.46, 0.22], [0.35, 0.22, 0.24], [0.26, 0.34, 0.16]],
};
const pick = (list, r) => list[Math.floor(r * 9973) % list.length];
// smooth value noise, 0..1
const vnoise = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
	const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
	return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
};
const jit = (c, r) => [c[0] * (0.95 + r * 0.1), c[1] * (0.95 + ((r * 7.3) % 1) * 0.1), c[2] * (0.95 + ((r * 3.1) % 1) * 0.1)];

// facades by kind: SF bay windows and cornices, house windows, curtain wall, ribbon glazing
// a house built for real close by (houses.js) takes over from its block: aNear holds the
// house's centre and a flag, and the block gives up its pixels as the house takes them
function buildingMaterial(shared, night, nearBand) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightC = night;
		sh.uniforms.uNearBand = nearBand;
		sh.vertexShader = 'attribute float aKind; attribute vec3 aNear; uniform vec2 uNearBand; varying float vNearK; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS; varying vec3 vLP; varying vec3 vLN; varying vec2 vIP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vNearK = aNear.z > 0.5 ? 1.0 - smoothstep(uNearBand.x, uNearBand.y, length(aNear.xy - cameraPosition.xz)) : 0.0;
			vKind = aKind;
			vLY = transformed.y * length(instanceMatrix[1].xyz);
			vCW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
			vCS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
			vLP = transformed; vLN = objectNormal; vIP = instanceMatrix[3].xz;`);
		sh.fragmentShader = 'uniform float uNightC; varying float vNearK; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS; varying vec3 vLP; varying vec3 vLN; varying vec2 vIP;\nvec3 winGlow = vec3(0.0); float glassK = 0.0;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' + sh.fragmentShader
			.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
			if (vNearK > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < vNearK) discard;`)
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float roof = step(0.7, vCN.y);
				vec2 t = normalize(vec2(-vCN.z, vCN.x) + 1e-5);
				float u = dot(vCW.xz, t), v = vCW.y;
				float win = 0.0; vec2 cell = vec2(0.0);
				vec3 glass = vec3(0.2, 0.24, 0.28);
				// the street front (local +z), metres across it from the left edge and up from the ground
				float front = step(0.5, vLN.z) * (1.0 - roof);
				float fx = (vLP.x + 0.5) * vCS.x, gy = vLY - 1.2;
				float ih = bh(floor(vIP * 0.5) + 0.17);
				float shopGlow = 0.0;
				// a house with its garage built in (11 left, 12 right) is a house with garage doors
				float K = vKind, garSide = 0.0;
				if (K > 10.5 && K < 12.5) { garSide = K < 11.5 ? -1.0 : 1.0; K -= K < 11.5 ? 10.0 : 11.0; }
				if (K > 12.5) {
					// a pool: water in a white coping
					float top = step(0.7, vCN.y);
					vec2 pl = vLP.xz * vCS.xz;
					float inner = top * step(abs(pl.x), vCS.x * 0.5 - 0.35) * step(abs(pl.y), vCS.z * 0.5 - 0.35);
					float rip = 0.5 + 0.5 * sin(dot(vCW.xz, vec2(3.1, 2.3)) + sin(vCW.x * 1.7) * 2.0);
					diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.05, 0.36, 0.5), vec3(0.14, 0.55, 0.66), rip), inner);
					glassK = inner;
				} else if (K > 7.5) {
					// the shopping streets: flats above, a shopfront and sign below; garages; bay windows
					if (K > 9.5) {
						// a bay window: glazed all round, a panel between floors
						cell = vec2(u / 1.15, vLY / 3.3); vec2 f = fract(cell);
						win = step(0.12, f.x) * step(f.x, 0.88) * step(0.22, f.y) * step(f.y, 0.82);
						glass = vec3(0.24, 0.27, 0.3);
					} else if (K > 8.5) {
						// flats over a shop: sash windows above, the shopfront and its sign below
						cell = vec2((front > 0.5 ? fx : u) / 2.54, gy / 3.3); vec2 f = fract(cell);
						win = step(0.3, f.x) * step(f.x, 0.7) * step(0.25, f.y) * step(f.y, 0.8) * step(4.4, gy);
						float sf = front * step(gy, 4.2);
						float glassF = sf * step(0.45, gy) * step(gy, 3.3) * step(0.1, fract(fx / 2.6)) * step(abs(fx - vCS.x * 0.5), vCS.x * 0.5 - 0.25);
						float signB = sf * step(3.45, gy) * step(gy, 4.15) * step(0.3, fx) * step(fx, vCS.x - 0.3);
						vec3 scol = ih > 0.8 ? vec3(0.62, 0.1, 0.08) : ih > 0.6 ? vec3(0.08, 0.2, 0.14) : ih > 0.4 ? vec3(0.1, 0.12, 0.2) : ih > 0.2 ? vec3(0.9, 0.86, 0.72) : vec3(0.12, 0.12, 0.12);
						diffuseColor.rgb = mix(diffuseColor.rgb, scol, signB);
						// lettering on the sign
						float letters = signB * step(0.55, bh(floor(vec2(fx / 0.34, 1.0)) + ih)) * step(abs(gy - 3.8), 0.16) * step(abs(fx - vCS.x * 0.5), vCS.x * 0.3);
						diffuseColor.rgb = mix(diffuseColor.rgb, ih > 0.2 && ih < 0.4 ? vec3(0.1) : vec3(0.95, 0.9, 0.75), letters);
						diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, sf * step(gy, 0.45));
						glass = mix(glass, vec3(0.34, 0.33, 0.3), glassF);
						win = max(win, glassF); glassK = glassF * 0.7;
						shopGlow = glassF;
					} else {
						// a garage: sectional doors, one per bay, with their panel lines
						float bays = clamp(floor(vCS.x / 2.9), 1.0, 3.0), bw = vCS.x / bays;
						float bx = fract(fx / bw) * bw;
						float doorG = front * step(0.3, bx) * step(bx, bw - 0.3) * step(gy, 2.2);
						vec3 dc = ih > 0.6 ? vec3(0.92, 0.91, 0.87) : ih > 0.3 ? diffuseColor.rgb * 1.08 : vec3(0.55, 0.42, 0.3);
						dc *= 0.9 + 0.1 * step(0.08, fract(gy / 0.54));
						diffuseColor.rgb = mix(diffuseColor.rgb, dc, doorG);
						diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.5, front * step(gy, 2.3) * step(2.2, gy) * step(0.3, bx) * step(bx, bw - 0.3));
					}
				} else if (K < 0.5) {
					// San Francisco: tall sash windows in threes, white trim, a cornice at the top;
					// often a garage door and the front door and stairs at street level
					cell = vec2((front > 0.5 ? fx : u) / 2.54, gy / 3.3); vec2 f = fract(cell);
					float garage = step(0.05, vKind);
					float ground = front * step(gy, 3.0);
					win = step(0.3, f.x) * step(f.x, 0.7) * step(0.25, f.y) * step(f.y, 0.8) * (1.0 - ground * garage);
					float trim = (1.0 - roof) * (1.0 - win) * (step(f.x, 0.3) * step(0.14, f.x) + step(0.7, f.x) * step(f.x, 0.86)) * step(0.15, f.y) * step(f.y, 0.87) * (1.0 - ground * garage);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.95, 0.92), trim * 0.8);
					// the garage door on one side, the front door up a few steps on the other
					float left = step(vKind, 0.15);
					float gx0 = left > 0.5 ? 0.5 : vCS.x - 3.1;
					float gdoor = ground * garage * step(gx0, fx) * step(fx, gx0 + 2.6) * step(gy, 2.3);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.8) * (0.9 + 0.1 * step(0.1, fract(gy / 0.46))), gdoor);
					float dx0 = left > 0.5 ? vCS.x - 1.6 : 0.6;
					float fdoor = ground * garage * step(dx0, fx) * step(fx, dx0 + 1.0) * step(0.9, gy) * step(gy, 3.0);
					diffuseColor.rgb = mix(diffuseColor.rgb, ih > 0.5 ? vec3(0.35, 0.2, 0.12) : vec3(0.14, 0.18, 0.24), fdoor);
					float steps = ground * garage * step(dx0 - 0.2, fx) * step(fx, dx0 + 1.2) * step(gy, 0.9);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.69, 0.66) * (0.85 + 0.15 * step(0.5, fract(gy / 0.3))), steps);
					glass = vec3(0.24, 0.27, 0.3);
				} else if (K < 1.5) {
					// houses: windows with white frames a floor, the front door on the street side
					cell = vec2((front > 0.5 ? fx : u) / 3.4, gy / 2.9); vec2 f = fract(cell);
					float wOn = step(0.3, bh(floor(cell) + floor(vIP) + 1.3));
					float frame = step(0.26, f.x) * step(f.x, 0.74) * step(0.26, f.y) * step(f.y, 0.82) * wOn;
					win = step(0.3, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.78) * wOn;
					float hasDoor = step(0.005, fract(K - 1.0));
					float doorX = 1.25 + clamp((fract(K - 1.0) - 0.01) / 0.38, 0.0, 1.0) * (vCS.x - 2.5);
					float door = hasDoor * front * step(abs(fx - doorX), 0.5) * step(gy, 2.1);
					float doorF = hasDoor * front * step(abs(fx - doorX), 0.62) * step(gy, 2.22);
					win *= 1.0 - hasDoor * front * step(abs(fx - doorX), 1.3) * step(gy, 2.4);
					frame *= 1.0 - hasDoor * front * step(abs(fx - doorX), 1.3) * step(gy, 2.4);
					// a built-in garage: two sectional doors at one end of the front
					float gx0 = garSide < 0.0 ? 0.35 : vCS.x - 5.75;
					float gzone = step(0.5, abs(garSide)) * front * step(gx0 - 0.3, fx) * step(fx, gx0 + 5.7) * step(gy, 2.6);
					win *= 1.0 - gzone; frame *= 1.0 - gzone;
					float gb = fract((fx - gx0) / 2.7) * 2.7;
					float gdoor = gzone * step(0.12, gb) * step(gb, 2.58) * step(gy, 2.15);
					vec3 gdc = ih > 0.5 ? vec3(0.92, 0.91, 0.87) : diffuseColor.rgb * 1.06;
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.94, 0.9), max(frame * (1.0 - win), doorF * (1.0 - door)));
					vec3 dcol = ih > 0.75 ? vec3(0.45, 0.1, 0.08) : ih > 0.5 ? vec3(0.1, 0.16, 0.26) : ih > 0.25 ? vec3(0.38, 0.24, 0.14) : vec3(0.9, 0.9, 0.86);
					diffuseColor.rgb = mix(diffuseColor.rgb, dcol, door);
					diffuseColor.rgb = mix(diffuseColor.rgb, gdc * (0.9 + 0.1 * step(0.08, fract(gy / 0.54))), gdoor);
					// a darker skirt of foundation at the ground
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, (1.0 - roof) * step(gy, 0.3));
					glass = vec3(0.18, 0.2, 0.22);
				} else if (vKind < 2.5) {
					// towers: curtain wall with mullions and spandrels
					cell = vec2(u / 1.6, v / 3.9); vec2 f = fract(cell);
					win = step(0.07, f.x) * step(f.y, 0.78);
					glass = mix(diffuseColor.rgb * 0.55, vec3(0.5, 0.6, 0.7), 0.35) * (0.85 + 0.25 * bh(floor(cell / 3.0)));
					glassK = win;
				} else if (vKind > 3.5 && vKind < 4.5) {
					// parking: asphalt striped into bays
					float bay = step(0.93, fract(u / 2.7)) * step(0.3, fract(dot(vCW.xz, vec2(-t.y, t.x)) / 11.0));
					diffuseColor.rgb = mix(vec3(0.22, 0.22, 0.23), vec3(0.85), bay * roof);
				} else if (vKind > 4.5 && vKind < 5.5) {
					// warehouses: ribbed metal walls, a row of loading-dock doors
					diffuseColor.rgb *= 0.9 + 0.1 * step(0.5, fract(u / 0.6)) * (1.0 - roof) + 0.1 * roof;
					float dock = step(0.55, fract(u / 5.0)) * step(fract(u / 5.0), 0.95) * step(vLY, 5.4) * (1.0 - roof);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.22, 0.24), dock);
					float band = step(abs(vLY - vCS.y + 1.2), 0.5) * (1.0 - roof);
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7, band);
				} else if (vKind > 5.5 && vKind < 6.5) {
					// shops: a glass shopfront, a sign band above it
					float front = (1.0 - roof) * step(1.5, vLY) * step(vLY, 4.8) * step(0.08, fract(u / 4.0));
					float sign = (1.0 - roof) * step(5.4, vLY) * step(vLY, 6.8);
					float sh = bh(vec2(floor(u / 18.0), 7.0));
					vec3 scol = sh > 0.66 ? vec3(0.75, 0.16, 0.12) : sh > 0.33 ? vec3(0.12, 0.3, 0.6) : vec3(0.92, 0.9, 0.86);
					diffuseColor.rgb = mix(diffuseColor.rgb, scol, sign * 0.9);
					cell = vec2(u / 4.0, 0.0); win = front; glass = vec3(0.3, 0.38, 0.44); glassK = front * 0.6;
				} else if (vKind > 6.5) {
					// plain: fields, plazas, yards
					win = 0.0;
				} else {
					// offices: ribbon windows along each floor
					cell = vec2(u / 3.0, v / 4.1); vec2 f = fract(cell);
					win = step(0.35, f.y) * step(f.y, 0.85) * step(0.04, fract(u / 1.5));
					glass = vec3(0.28, 0.36, 0.42);
					glassK = win * 0.7;
				}
				win *= (1.0 - roof) * step(0.8, vLY);
				diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
				diffuseColor.rgb *= mix(1.0, 0.8, roof);
				float lit = max(step(vKind > 1.5 ? 0.62 : 0.66, bh(floor(cell) + floor(vCW.xz * 0.013))), shopGlow * step(0.25, ih));
				winGlow = mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.86, 0.66), step(1.5, vKind) * 0.6) * win * lit * uNightC * (0.6 + 0.4 * bh(floor(cell) + 3.3)) * 1.1;
			}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, glassK);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winGlow;');
	};
	m.customProgramCacheKey = () => 'baybuilding5';
	return m;
}

// hip and gable roofs: a unit block with a ridge; scaled per house
function roofGeometry(hip) {
	const r = hip ? 0.28 : 0.0;
	const P = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5 + r, 1, 0, 0.5 - r, 1, 0];
	const I = [0, 4, 5, 0, 5, 1, 2, 5, 4, 2, 4, 3, 1, 5, 2, 3, 4, 0];
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setIndex(I);
	const n = g.toNonIndexed();
	n.computeVertexNormals();
	return n;
}

export function createCity(shared, scene, bay, real = null) {
	const group = new THREE.Group();
	group.name = 'bay-city';
	scene.add(group);
	const night = { value: 0 };
	const nearBand = { value: new THREE.Vector2(36, 46) };
	const mat = buildingMaterial(shared, night, nearBand);
	const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
	const CAP = 32000;
	const boxGeo = () => { const g = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); return g; };
	const mk = (geo, material, cap, kinds) => {
		if (kinds) { geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)); geo.setAttribute('aNear', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)); }
		const im = new THREE.InstancedMesh(geo, material, cap);
		im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
		im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
		group.add(im);
		return im;
	};
	const near = mk(boxGeo(), mat, CAP, true);
	const hipG = roofGeometry(true), gableG = roofGeometry(false);
	const hips = mk(hipG, roofMat, CAP, false), gables = mk(gableG, roofMat, CAP, false);
	// trees. Up close and in the middle distance, the island's own leaf-card trees in the
	// Bay Area's street species: London plane and sycamore (round), coast live oak (low
	// and spreading), redwood and cypress (columnar), and yard shrubs. Far off, where a
	// crown is a few pixels, a smooth lumpy mass stands in.
	const TCAP = 24000;
	const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 7).translate(0, 0.5, 0);
	const crownGeo = (() => {
		let g = new THREE.IcosahedronGeometry(1, 3);
		g.deleteAttribute('normal'); g.deleteAttribute('uv');
		g = mergeVertices(g);
		const p = g.attributes.position;
		for (let i = 0; i < p.count; i++) { const k = 0.88 + 0.12 * Math.sin(p.getX(i) * 5.1 + p.getZ(i) * 3.7 + p.getY(i) * 2.3) * Math.sin(p.getY(i) * 4.3 - p.getX(i) * 2.9); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
		g.computeVertexNormals();
		return g;
	})();
	const coneGeo = (() => { let g = new THREE.ConeGeometry(1, 1, 14, 3).translate(0, 0.5, 0); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); g.computeVertexNormals(); return g; })();
	const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
	const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 });
	const trunks = mk(trunkGeo, trunkMat, TCAP, false);
	trunks.instanceColor = null;
	const crowns = mk(crownGeo, leafMat, TCAP, false), cones = mk(coneGeo, leafMat, TCAP, false);
	const leafTex = TX.leafCluster();
	const barkT = TX.woodBark(); barkT.repeat.set(2, 3);
	const SPECIES = [
		{ height: 11, crown: 'round', bark: [1.12, 1.08, 1.0], leaf: [1.1, 1.05, 0.85] },      // plane, sycamore, elm
		{ height: 9, crown: 'umbrella', bark: [0.75, 0.72, 0.7], leaf: [0.78, 0.86, 0.72] },  // coast live oak
		{ height: 16, crown: 'columnar', bark: [0.95, 0.66, 0.52], leaf: [0.55, 0.72, 0.6] }, // redwood, cypress
	];
	const LEAF_REF = [0.25, 0.35, 0.15];
	// the detail levels and where they hand over (metres): each dissolves into the next
	// across a band rather than popping; the far masses dissolve out at the edge
	const LOD = { near: [NONE_IN[0], NONE_IN[1], 130, 150], mid: [130, 150, 415, 440], far: [415, 440, 1020, 1180], shrub: [NONE_IN[0], NONE_IN[1], 215, 255] };
	const MARGIN = 45;                                        // the trees are re-placed every 40 m of travel
	addLodFade(leafMat, 'uniform', LOD.far); addLodFade(trunkMat, 'uniform', LOD.far);
	const tierMesh = (parts, cap, shadow, band) => {
		// each tier its own materials, so each can carry its own band
		const mats = [swayMaterial({ map: barkT, roughness: 0.95 }, shared, 1), swayMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8)];
		for (const M of mats) addLodFade(M.material, 'uniform', band);
		return parts.map((geo, n) => {
			const S = mats[n];
			const im = new THREE.InstancedMesh(geo, S.material, cap);
			im.count = 0; im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true;
			if (S.depth) im.customDepthMaterial = S.depth;
			if (n === 1) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
			group.add(im);
			return im;
		});
	};
	// the leaf texture's average colour (where it is solid), in linear light
	const texAvg = (() => {
		const img = leafTex.image, cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
		const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
		const d = g.getImageData(0, 0, 64, 64).data, a = [0, 0, 0]; let n = 0;
		const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
		for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 115) { a[0] += lin(d[i]); a[1] += lin(d[i + 1]); a[2] += lin(d[i + 2]); n++; }
		return a.map((v) => v / Math.max(1, n));
	})();
	const treeTiers = SPECIES.map((g, k) => {
		const nearT = hardwood(9101 + k * 17, false, false, g), midT = hardwood(9101 + k * 17, false, true, g);
		// what a far mass must match: the crown's size and place, and its average colour
		// (the leaf texture times the leaves' own colours)
		const leafGeo = midT.parts[1], bb = new THREE.Box3().setFromBufferAttribute(leafGeo.attributes.position), cA = leafGeo.attributes.color, avg = [0, 0, 0];
		for (let i = 0; i < cA.count; i++) { avg[0] += cA.getX(i); avg[1] += cA.getY(i); avg[2] += cA.getZ(i); }
		const far = {
			col: avg.map((v, c) => v / cA.count * texAvg[c]),
			cy: (bb.min.y + bb.max.y) / 2 / midT.height, ry: (bb.max.y - bb.min.y) / 2 / midT.height,
			rx: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 / midT.height * 0.82, base: bb.min.y / midT.height,
		};
		return { near: tierMesh(nearT.parts, 1500, true, LOD.near), mid: tierMesh(midT.parts, 6000, true, LOD.mid), H: nearT.height, Hm: midT.height, far };
	});
	const shrubT = shrub(9301), shrubs = tierMesh(shrubT.parts, 3000, true, LOD.shrub);

	// one lot's building (and roof) in grid space: centre (gx, gz), size along grid x/z.
	// opt.face turns the box so its front (local +z) faces a street: 's' +gz, 'n' -gz,
	// 'e' +gx, 'w' -gx; opt.lift raises it off the ground (awnings, porch roofs)
	function lot(list, a, style, gx, gz, w, d, h, kind, col, roof, flat, opt) {
		const [x, z] = fromGrid(gx, gz, a, style);
		const g = bay.heightAt(x, z);
		if (g < 0.8) return;
		// the local heading of the (possibly warped) grid
		const [x2, z2] = fromGrid(gx + 5, gz, a, style);
		let ang = Math.atan2(z2 - z, x2 - x);
		const face = opt?.face;
		if (face === 'n') ang += Math.PI;
		else if (face === 'e' || face === 'w') { ang += face === 'e' ? -Math.PI / 2 : Math.PI / 2; const t = w; w = d; d = t; }
		if (opt?.lift) list.push({ x, y: g + opt.lift, z, w, d, h, a: ang, col, kind, roof: null });
		else list.push(flat ? { x, y: g - 0.9, z, w, d, h: 0.98, a: ang, col, kind, roof: null } : { x, y: g - 1.2, z, w, d, h: h + 1.2, a: ang, col, kind, roof });
	}

	function fillBlocks(cx, cz, R, list, minH = 0) {
		// the (angle, style) grids present round here
		const grids = new Map();
		for (let dz = -R; dz <= R; dz += R / 4) for (let dx = -R; dx <= R; dx += R / 4) {
			const u = bay.urbanAt(cx + dx, cz + dz);
			if (u.u > 0.05) grids.set(Math.round(u.a / (Math.PI / 2) * 255) + ':' + u.s, [Math.round(u.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2, u.s]);
		}
		for (const [a, style] of grids.values()) {
			const [BX, BZ, ST] = BLOCKS[style];
			const [gcx, gcz] = toGrid(cx, cz, a, style);
			const i0 = Math.floor((gcx - R) / BX), i1 = Math.floor((gcx + R) / BX), j0 = Math.floor((gcz - R) / BZ), j1 = Math.floor((gcz + R) / BZ);
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const [wx, wz] = fromGrid((i + 0.5) * BX, (j + 0.5) * BZ, a, style);
				if (Math.hypot(wx - cx, wz - cz) > R) continue;
				const U = bay.urbanAt(wx, wz);
				if (U.u < 0.15 || U.s !== style || Math.abs(U.a - a) > 0.01) continue;
				if (real?.inside(wx, wz)) continue;                                              // mapped for real
				const parkBlock = hash(i * 3 + 7, j * 5 + 1) > 0.975 && U.d < 0.2;              // a park or a playground
				const ground = bay.heightAt(wx, wz);
				if (ground < 0.8) continue;
				const X0 = i * BX + ST + 2.5, Z0 = j * BZ + ST + 2.5, IX = BX - ST - 5, IZ = BZ - ST - 5;   // the block inside its pavements
				const r0 = hash(i * 17 + 3, j * 29 + 1);
				if (parkBlock) {
					if (minH > 0) continue;
					lot(list, a, style, X0 + IX / 2, Z0 + IZ / 2, IX * 0.96, IZ * 0.96, 0, KIND.plain, [0.28, 0.42, 0.18], null, 0.9);
					const T = list.trees || (list.trees = []);
					for (let k = 0; k < 10; k++) { const [x, z] = fromGrid(X0 + IX * hash(k, i), Z0 + IZ * hash(j, k), a, style), g = bay.heightAt(x, z); if (g > 0.8) T.push({ x, y: g - 0.3, z, h: 8 + hash(k, k) * 8, cone: hash(k, 3) > 0.8, col: [0.2, 0.3, 0.13] }); }
					continue;
				}
				if (U.d > 0.22) {
					// downtown: towers on bigger lots, some with a setback crown
					const L = 26;
					for (let k = 0; k * L < IX; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						let h = 12 + Math.pow(r, 2.4) * U.d * U.d * 300 + U.d * 40;
						if (h < minH) continue;
						const col = jit(pick(PAL.tower, hash(i * 7 + k, j * 3 + side)), r);
						const gx = X0 + k * L + L / 2, gz = side ? Z0 + IZ - L * 0.55 : Z0 + L * 0.55;
						lot(list, a, style, gx, gz, L * 0.9, L * 1.05, h, KIND.tower, col, null);
						if (h > 90 && r > 0.4) lot(list, a, style, gx, gz, L * 0.62, L * 0.7, h + 8 + r * 20, KIND.tower, col, null);
					}
					continue;
				}
				if (minH > 0) continue;
				const trees = list.trees || (list.trees = []);
				// a tree in grid space: height, round or conical, crown colour
				const tree = (gx, gz, h, cone, r) => { const [x, z] = fromGrid(gx, gz, a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.3, z, h, cone, col: cone ? jit([0.13, 0.21, 0.11], r) : jit(pick(PAL.crown, r), r) }); };
				// paved ground: parking lots, yards, plazas
				const pave = (gx, gz, w, d, kind = KIND.paved, col = [0.25, 0.25, 0.26]) => lot(list, a, style, gx, gz, w, d, 0.25 - 1.2 + 1.35, kind, col, null, 0.9);
				// close in, each house gets its porch, walk, shrubs and back fences
				const detail = Math.hypot(wx - cx, wz - cz) < 480;
				// the back fences of a lot from x0 to x1: its left side line (the neighbour has the
				// right), and the back line on one side of the block; at(m) is depth into the block
				const fences = (x0, x1, at, m0, m1, side, r) => {
					if (m1 - m0 < 2) return;
					const fc = jit([0.46, 0.38, 0.3], r);
					lot(list, a, style, x0, at((m0 + m1) / 2), 0.12, m1 - m0, 1.8, KIND.plain, fc, null);
					if (!side) lot(list, a, style, (x0 + x1) / 2, at(m1), x1 - x0, 0.12, 1.8, KIND.plain, fc, null);
				};
				// foundation shrubs across a house front, leaving the door clear
				const shrubs = (hx, gz, w, dx, r) => {
					for (let n = 0; n < 4; n++) {
						const sx = hx + (n / 3 - 0.5) * (w - 1.5);
						if (Math.abs(sx - dx) < 1.4 || hash(n * 7 + r * 100, i + j) < 0.3) continue;
						const [x, z] = fromGrid(sx, gz, a, style), g = bay.heightAt(x, z);
						if (g > 0.8) trees.push({ x, y: g - 0.1, z, h: 1.1 + hash(n, r * 50) * 0.9, shrub: true, col: jit(pick(PAL.crown, hash(n, r)), r) });
					}
				};
				const arterial = (style === STYLE.suburb || style === STYLE.older) && (((i % 7) + 7) % 7 === 0);
				const civic = hash(i * 11 + 5, j * 13 + 7);
				if ((style === STYLE.suburb || style === STYLE.older) && civic < 0.035) {
					// a school: low classroom wings, a field and a car park
					lot(list, a, style, X0 + IX * 0.3, Z0 + IZ * 0.3, IX * 0.45, 14, 4.5, KIND.office, [0.86, 0.8, 0.68], { hip: false, h: 1.5, col: [0.5, 0.47, 0.44] });
					lot(list, a, style, X0 + IX * 0.3, Z0 + IZ * 0.62, IX * 0.35, 12, 4.5, KIND.office, [0.86, 0.8, 0.68], { hip: false, h: 1.5, col: [0.5, 0.47, 0.44] });
					pave(X0 + IX * 0.76, Z0 + IZ * 0.5, IX * 0.4, IZ * 0.8, KIND.plain, [0.3, 0.44, 0.2]);
					continue;
				}
				if (arterial) {
					// a commercial strip on the arterial: shops at the back, parking in front, a pad or two
					const r = hash(i * 17 + 1, j * 19 + 3);
					pave(X0 + IX * 0.5, Z0 + IZ * 0.36, IX * 0.95, IZ * 0.62);
					lot(list, a, style, X0 + IX * 0.5, Z0 + IZ * 0.84, IX * (0.7 + r * 0.2), 22, 7.4 + r * 2, KIND.retail, jit(pick(PAL.retail, r), r), null);
					if (r > 0.4) lot(list, a, style, X0 + IX * 0.18, Z0 + IZ * 0.18, 18, 14, 6.5, KIND.retail, jit(pick(PAL.retail, r * 3.7), r), null);
					for (let k = 0; k < 5; k++) tree(X0 + IX * (0.1 + k * 0.2), Z0 + 3, 7, false, hash(i + k, j));
					continue;
				}
				if (style === STYLE.sf || style === STYLE.sunset) {
					const dist = style === STYLE.sunset ? 'sunset' : sfDistrict(wx, wz);
					const wide = dist === 'nobhill' || dist === 'pacheights';
					const L = wide ? 15.24 : 7.62, deep = style === STYLE.sf ? (wide ? 24 : 19) : 21;
					const pal = { chinatown: PAL.chinatown, northbeach: PAL.northbeach, nobhill: PAL.nobhill, mission: PAL.mission, pacheights: PAL.pale, marina: PAL.sf, victorian: PAL.sf, sunset: PAL.sunset }[dist] || PAL.sf;
					// the shopping streets: every few streets a commercial corridor (Valencia, 24th,
					// Clement, Irving...), shops on the ground floor, flats above, awnings out front
					const share = { chinatown: 0.85, northbeach: 0.6, mission: 0.3, sunset: 0.14 }[dist] ?? 0.2;
					const comm = (jj) => hash(jj * 7 + 13, Math.round(a * 1000) + style * 5) < share;
					const nK = Math.ceil((IX - 0.1) / L);
					for (let k = 0; k * L < IX - 0.1; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						if (r < 0.03) continue;
						let h = { chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, mission: 8.5 + Math.floor(r * 3) * 2.8, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8 + (r > 0.93 ? 6 : 0);
						const col = jit(pick(pal, hash(i + k * 13, j * 7 + side)), r);
						let roof = null;
						if (dist === 'victorian' && r > 0.3) roof = { hip: false, rot: true, h: 3.4, col: [0.3, 0.3, 0.32] };                      // the gable faces the street
						else if (dist === 'marina' && r > 0.55) roof = { hip: true, h: 2, col: pick(PAL.tile, r) };
						else if (dist === 'pacheights' && r > 0.5) roof = { hip: true, h: 4, col: [0.3, 0.32, 0.35] };
						else if (dist === 'chinatown' && r > 0.78) roof = { hip: true, h: 2.6, col: r > 0.9 ? [0.18, 0.42, 0.3] : [0.62, 0.16, 0.12] };
						const gz = side ? Z0 + IZ - deep / 2 : Z0 + deep / 2, face = side ? 's' : 'n', front = side ? Z0 + IZ : Z0;
						const out = (m) => side ? front + m : front - m;
						const corner = (k === 0 || k === nK - 1) && r > 0.55;
						const shop = comm(side ? j + 1 : j) || corner;
						// a garage under the house (the Sunset nearly always, older SF often), left or right
						const r2 = hash(i * 37 + k * 11 + side, j * 43 + k);
						const garageP = { sunset: 0.85, nobhill: 0.08, chinatown: 0.04, northbeach: 0.15, pacheights: 0.4 }[dist] ?? 0.55;
						const kind = shop ? KIND.shop : KIND.row + (r2 < garageP ? (r2 < garageP / 2 ? 0.1 : 0.2) : 0);
						lot(list, a, style, X0 + k * L + L / 2, gz, L + 0.02, deep, h, kind, col, roof, false, { face });
						// bay windows stacked up the front, from the first floor up
						if (style === STYLE.sf && r > 0.35 && dist !== 'nobhill' && dist !== 'chinatown' && h > 7) lot(list, a, style, X0 + k * L + L / 2, out(0.5), Math.min(3.6, L * 0.47), 1.4, h - 4.4, KIND.bay, col.map((c) => Math.min(1, c * 1.05)), null, false, { face, lift: 3.4 });
						// an awning over the shopfront
						if (shop && hash(k * 5 + side, i * 3 + j) < 0.75) {
							const aw = hash(i + k, j * 9 + side);
							const ac = aw < 0.25 ? [0.55, 0.12, 0.1] : aw < 0.45 ? [0.1, 0.3, 0.2] : aw < 0.6 ? [0.12, 0.18, 0.36] : aw < 0.75 ? [0.2, 0.2, 0.2] : aw < 0.88 ? [0.86, 0.6, 0.18] : [0.9, 0.88, 0.82];
							lot(list, a, style, X0 + k * L + L / 2, out(0.8), L * 0.86, 1.6, 0.18, KIND.plain, ac, null, false, { face, lift: 3.0 });
						}
						// a street tree now and then (more in the Sunset and the Mission)
						if (hash(k * 3 + side, i * 5 + j) < (dist === 'sunset' || dist === 'mission' ? 0.2 : 0.1)) tree(X0 + k * L + L / 2, side ? Z0 + IZ + 2.0 : Z0 - 2.0, 6 + r * 3, false, r);
					}
					// the short ends of the block are built up too, houses facing the cross streets
					for (let k = 0; deep + (k + 1) * L < IZ - deep + 0.1; k++) for (const side of [0, 1]) {
						const r = hash(i * 71 + k * 5 + side, j * 23 + k + 9);
						const h = { chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8;
						const col = jit(pick(pal, hash(i * 3 + k * 11, j * 5 + side)), r);
						const r2 = hash(i * 29 + k * 13 + side, j * 31 + k);
						lot(list, a, style, side ? X0 + IX - deep / 2 : X0 + deep / 2, Z0 + deep + k * L + L / 2, deep, L + 0.02, h, r2 < 0.2 ? KIND.shop : KIND.row + (r2 < 0.55 ? 0.1 : 0), col, null, false, { face: side ? 'e' : 'w' });
					}
				} else if (style === STYLE.older) {
					// older towns: detached wood houses with deep front porches, a driveway down
					// the side to a garage out back, leafy yards
					const L = 12;
					for (let k = 0; k * L < IX - 2; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						if (r < 0.08) continue;
						const w = 7.6 + r * 2, d = 10 + ((r * 7.7) % 1) * 4, h = r > 0.55 ? 6.4 : 3.6;
						const col = jit(pick(PAL.older, hash(i + k * 13, j * 7 + side)), r);
						const rc = pick(PAL.olderRoof, hash(i * 3 + k, j + side * 5));
						const fz = side ? Z0 + IZ : Z0, inw = side ? -1 : 1, face = side ? 's' : 'n', at = (m) => fz + inw * m;
						const lotX = X0 + k * L, gs = r > 0.5 ? 1 : -1;
						const cx = lotX + L / 2 - gs * (L - w - 3) / 2;             // the house to one side, the driveway down the other
						const hf = 6;                                                 // house front, back from the pavement
						const door = 0.25 + ((r * 3.3) % 1) * 0.5;
						lot(list, a, style, cx, at(hf + d / 2), w, d, h, doorKind(KIND.house, door), col, { hip: r > 0.8, rot: r < 0.3, h: Math.min(w, d) * 0.42, col: rc }, false, { face });
						const dx = cx + (side ? 1 : -1) * (door - 0.5) * (w - 2.5);
						if (detail) {
							// the porch: a roof on posts across much of the front, steps to a path
							const pw = w * (0.5 + r * 0.3);
							lot(list, a, style, dx, at(hf - 1.2), pw, 2.6, 0.25, KIND.plain, rc, null, false, { face, lift: 2.7 });
							for (const e of [-1, 1]) lot(list, a, style, dx + e * (pw / 2 - 0.2), at(hf - 2.3), 0.22, 0.22, 2.7, KIND.plain, [0.9, 0.89, 0.85], null, false, { face });
							pave(dx, at(hf / 2 - 1), 1.2, hf - 2.2, KIND.plain, [0.68, 0.66, 0.62]);
							// the driveway to a small garage at the back of the lot
							const gx = lotX + L / 2 + gs * (L / 2 - 1.9);
							pave(gx, at(12), 2.8, 24, KIND.plain, [0.56, 0.55, 0.52]);
							if (r > 0.3) lot(list, a, style, gx - gs * 0.6, at(hf + d + 6), 3.6, 6, 2.8, KIND.garage, jit(col, r * 3.1 % 1), { hip: false, h: 1.3, col: rc }, false, { face });
							fences(lotX, lotX + L, at, hf + d * 0.6, IZ / 2, side, r);
							shrubs(cx, at(hf - 0.8), w, dx, r);
						}
						// old neighbourhoods are leafy: street trees and big backyard trees
						if (k % 2 === 0) tree(X0 + k * L + L / 2, side ? Z0 + IZ + 1.9 : Z0 - 1.9, 9 + r * 6, false, r);
						if (r > 0.4) tree(X0 + k * L + L / 2 + 3, side ? Z0 + IZ - 30 : Z0 + 30, 10 + r * 8, r > 0.85, r * 1.7 % 1);
					}
				} else if (style === STYLE.suburb) {
					// the tract: one builder, one decade, one look
					const ti = Math.floor(((i * BX) + 1e6) / 520), tj = Math.floor(((j * BZ) + 1e6) / 400);
					const tr = hash(ti * 7 + 3, tj * 13 + 5), era = eraFor(wx, wz, tr);
					const wallsAll = [PAL.ranch, PAL.seventies, PAL.suburb, PAL.eichler][era], roofsAll = [PAL.ranchRoof, PAL.shake, PAL.tile, PAL.flat][era];
					const walls = [0, 1, 2, 3].map((n) => pick(wallsAll, hash(ti + n * 17, tj + n * 31)));
					const roofs = [0, 1].map((n) => pick(roofsAll, hash(ti * 3 + n, tj * 5 + n)));
					const modern = era === ERA.modern;
					const L = modern ? 16 : era === ERA.eichler ? 19 : 20;
					const setback = modern ? 6 : 8, SY = 1.5;                      // front and side setbacks
					const treeK = [0.9, 0.7, 0.3, 0.9][era], treeH = [11, 9, 5, 10][era];
					for (let k = 0; k * L < IX - 4; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						if (r < 0.04) continue;
						const fz = side ? Z0 + IZ : Z0, inw = side ? -1 : 1, face = side ? 's' : 'n', at = (m) => fz + inw * m;
						const two = modern ? r > 0.12 : era === ERA.seventies ? r > 0.5 : era === ERA.ranch ? r > 0.9 : false;
						const h = two ? 6.4 : 3.3;
						const col = jit(walls[Math.floor(r * 4)], r), rc = roofs[r > 0.8 ? 1 : 0];
						const lotX = X0 + k * L, gs = r > 0.5 ? 1 : -1;
						const gw = modern && r > 0.7 ? 8.8 : 6.2;
						const avail = L - 2 * SY;
						// new tracts: a two-storey house across the lot with the garage stepped out in
						// front; older tracts: a long low house with the garage at one end
						const w = modern ? avail - ((r * 2.9) % 1) * 1.5 : avail - gw - ((r * 2.9) % 1) * 1.8;
						const d = modern ? 12 + ((r * 5.3) % 1) * 3 : 10 + ((r * 5.3) % 1) * 3;
						const hf = modern ? setback + 3 : setback + 1.5;              // house front
						const hx = modern ? lotX + L / 2 : lotX + SY + (gs > 0 ? w / 2 : gw + w / 2);
						const gx = gs > 0 ? lotX + L - SY - gw / 2 : lotX + SY + gw / 2;
						const roofH = era === ERA.eichler ? 0.9 : Math.min(w, d) * (modern ? 0.3 : era === ERA.ranch ? 0.2 : 0.26);
						const door = modern ? (gs > 0 ? 0.28 : 0.72) : 0.35 + ((r * 3.3) % 1) * 0.3;
						lot(list, a, style, hx, at(hf + d / 2), w, d, h, doorKind(KIND.house, door), col, { hip: modern || (era === ERA.ranch && r > 0.4), h: roofH, col: rc }, false, { face });
						// the garage, its doors to the street
						lot(list, a, style, gx, at(setback + 3.5), gw, 7, 3.1, KIND.garage, col, { hip: modern, h: era === ERA.eichler ? 0.5 : 1.6, col: rc }, false, { face });
						// the driveway
						pave(gx, at(setback / 2), gw - 0.6, setback, KIND.plain, [0.62, 0.61, 0.58]);
						const dx = hx + (side ? 1 : -1) * (door - 0.5) * (w - 2.5);
						if (detail) {
							// the front walk, a porch over the door, shrubs along the front, fences round the back
							pave(dx, at(hf / 2), 1.1, hf, KIND.plain, [0.7, 0.69, 0.65]);
							if (era !== ERA.eichler) {
								lot(list, a, style, dx, at(hf - 0.8), 2.6, 1.8, 0.22, KIND.plain, rc, null, false, { face, lift: 2.6 });
								if (modern || r > 0.5) for (const e of [-1, 1]) lot(list, a, style, dx + e * 1.15, at(hf - 1.55), 0.2, 0.2, 2.6, KIND.plain, [0.92, 0.91, 0.88], null, false, { face });
							}
							fences(lotX, lotX + L, at, hf + d * 0.55, IZ / 2, side, r);
							shrubs(hx, at(hf - 0.9), w, dx, r);
						}
						// yard trees: a front tree and one out back, bigger in older tracts
						if (hash(k + 1, side + i * 3) < treeK * 0.6) tree(hx - gs * (w * 0.3), at(2.5), treeH * (0.7 + r * 0.6), false, r * 3.1 % 1);
						if (hash(k + 5, side + j * 7) < treeK) tree(hx + (r - 0.5) * 6, at(hf + d + 7), treeH * (0.8 + r * 0.7), r > 0.82, r * 5.7 % 1);
					}
				} else if (style === STYLE.industry) {
					// warehouses and plants in concrete yards, trailers at the docks
					const n = r0 > 0.6 ? 2 : r0 > 0.25 ? 1 : 3;
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.96, IZ * 0.96, KIND.plain, [0.48, 0.47, 0.45]);
					for (let k = 0; k < n; k++) {
						const r = hash(i * 31 + k, j * 11 + k);
						const w = IX * (n === 1 ? 0.7 : n === 2 ? 0.42 : 0.28), d = IZ * (0.35 + r * 0.3), h = 8 + r * 6;
						const gx = X0 + IX * (n === 1 ? 0.5 : (k + 0.5) / n), gz = Z0 + IZ * 0.45;
						lot(list, a, style, gx, gz, w, d, h, KIND.industry, jit(pick(PAL.industry, r), r), null);
						for (let t = 0; t < 4; t++) if (hash(k * 5 + t, i + j) > 0.4) lot(list, a, style, gx - w * 0.4 + t * w * 0.25, gz + d / 2 + 9, 2.6, 13, 4, KIND.plain, [0.9, 0.9, 0.88], null);
					}
				} else if (style === STYLE.retail) {
					// a mall or big-box centre: the anchor at the back, parking all round
					const r = r0;
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.97, IZ * 0.97);
					lot(list, a, style, X0 + IX / 2, Z0 + IZ * 0.72, IX * (0.55 + r * 0.3), IZ * 0.36, 9 + r * 5, KIND.retail, jit(pick(PAL.retail, r), r), null);
					if (r > 0.3) lot(list, a, style, X0 + IX * 0.2, Z0 + IZ * 0.18, 26, 18, 7, KIND.retail, jit(pick(PAL.retail, r * 2.3), r), null);
					for (let k = 0; k < 6; k++) tree(X0 + IX * (0.1 + k * 0.16), Z0 + IZ * 0.45, 6, false, hash(k, i + j));
				} else {
					// business park and campus: office blocks in parking and lawns
					const n = r0 > 0.5 ? 2 : 1;
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.95, IZ * 0.95);
					for (let k = 0; k < n; k++) {
						const r = hash(i * 31 + k, j * 11 + k);
						const w = n === 2 ? IX * 0.36 : IX * 0.55, d = IZ * (0.45 + r * 0.15), h = 12 + Math.floor(r * 4) * 4.1;
						lot(list, a, style, X0 + IX * (n === 2 ? 0.27 + k * 0.46 : 0.5), Z0 + IZ * 0.5, w, d, h, KIND.office, jit(pick(PAL.office, r), r), null);
					}
					for (let k = 0; k < 8; k++) tree(X0 + IX * (0.06 + k * 0.125), Z0 + 4, 8, k % 3 === 0, hash(k, i * 3 + j));
				}
			}
		}
	}

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
	let slotOf = new Map();
	function upload(list, body, roofs) {
		let n = 0, nh = 0, ng = 0;
		const kinds = body.geometry.attributes.aKind, nearA = body.geometry.attributes.aNear;
		if (roofs) slotOf = new Map();
		for (const o of list) {
			if (n >= body.instanceMatrix.count) break;
			q.setFromAxisAngle(Y, -o.a); sc.set(o.w, o.h, o.d); p.set(o.x, o.y, o.z);
			body.setMatrixAt(n, m4.compose(p, q, sc)); body.setColorAt(n, col.setRGB(o.col[0], o.col[1], o.col[2])); kinds.array[n] = o.kind;
			const nc = o.src?.grp?.near;
			nearA.array[n * 3] = nc ? nc[0] : 0; nearA.array[n * 3 + 1] = nc ? nc[1] : 0; nearA.array[n * 3 + 2] = nc ? 1 : 0;
			if (roofs && o.src?.grp) { let l = slotOf.get(o.src.grp); if (!l) slotOf.set(o.src.grp, l = []); l.push(n); }
			n++;
			if (o.roof && roofs) {
				const im = o.roof.hip ? roofs[0] : roofs[1], k = o.roof.hip ? nh++ : ng++;
				if (k >= im.instanceMatrix.count) continue;
				p.set(o.x, o.y + o.h, o.z);
				if (o.roof.rot) { q.setFromAxisAngle(Y, -o.a + Math.PI / 2); sc.set(o.d + 0.8, o.roof.h, o.w + 0.8); } else sc.set(o.w + 0.8, o.roof.h, o.d + 0.8);
				im.setMatrixAt(k, m4.compose(p, q, sc)); im.setColorAt(k, col.setRGB(o.roof.col[0], o.roof.col[1], o.roof.col[2]));
			}
		}
		body.count = n; kinds.needsUpdate = true; nearA.needsUpdate = true;
		for (const im of [body, ...(roofs || [])]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
		if (roofs) { roofs[0].count = Math.min(nh, roofs[0].instanceMatrix.count); roofs[1].count = Math.min(ng, roofs[1].instanceMatrix.count); }
		if (roofs) treeList = list.trees || [];
	}

	// the trees by distance from you, re-sorted as you walk: leaf-card trees close by,
	// simpler leaf-card trees further out, smooth masses far away
	let treeList = [], treeX = 1e9, treeZ = 1e9;
	function placeTrees(x, z) {
		treeX = x; treeZ = z;
		const cn = new Map(), next = (im) => { const c = cn.get(im) || 0; if (c >= im.instanceMatrix.count) return -1; cn.set(im, c + 1); return c; };
		for (const t of treeList) {
			const d = Math.hypot(t.x - x, t.z - z);
			const yaw = hash(t.x * 3.1, t.z * 1.7) * 6.283;
			q.setFromAxisAngle(Y, yaw);
			const tint = [0, 1, 2].map((c) => Math.min(1.35, Math.max(0.65, t.col[c] / LEAF_REF[c])));
			if (t.shrub) {
				if (d > LOD.shrub[3] + MARGIN) continue;
				const k = next(shrubs[0]); if (k < 0) continue; next(shrubs[1]);
				const s2 = t.h / 1.3;
				m4.compose(p.set(t.x, t.y, t.z), q, sc.set(s2, s2 * 0.9, s2));
				shrubs[0].setMatrixAt(k, m4); shrubs[1].setMatrixAt(k, m4); shrubs[1].setColorAt(k, col.setRGB(tint[0], tint[1], tint[2]));
				continue;
			}
			const sp = t.sp ?? (t.cone ? 2 : hash(t.x * 0.7, t.z * 1.3) < 0.3 ? 1 : 0), T = treeTiers[sp];
			// a tree in a hand-over band sits in both tiers; the shader shares its pixels out
			for (const [tier, H, lo, hi] of [[T.near, T.H, -1, LOD.near[3] + MARGIN], [T.mid, T.Hm, LOD.mid[0] - MARGIN, LOD.mid[3] + MARGIN]]) {
				if (d < lo || d > hi) continue;
				const k = next(tier[0]);
				if (k < 0) continue;
				next(tier[1]);
				const s2 = t.h / H;
				m4.compose(p.set(t.x, t.y + 0.2, t.z), q, sc.set(s2, s2, s2));
				tier[0].setMatrixAt(k, m4); tier[1].setMatrixAt(k, m4); tier[1].setColorAt(k, col.setRGB(tint[0], tint[1], tint[2]));
			}
			if (d < LOD.far[0] - MARGIN) continue;
			// far: a trunk and one mass the size, shape and average colour of the real crown
			const nt = next(trunks); if (nt < 0) continue;
			const F = T.far, h = t.h;
			q.identity();
			trunks.setMatrixAt(nt, m4.compose(p.set(t.x, t.y, t.z), q, sc.set(h * 0.05 + 0.15, Math.max(h * 0.2, F.base * h + 0.5), h * 0.05 + 0.15)));
			const k = next(crowns); if (k < 0) continue;
			q.setFromAxisAngle(Y, yaw);
			crowns.setMatrixAt(k, m4.compose(p.set(t.x, t.y + 0.2 + F.cy * h, t.z), q, sc.set(F.rx * h, F.ry * h, F.rx * h)));
			crowns.setColorAt(k, col.setRGB(F.col[0] * tint[0], F.col[1] * tint[1], F.col[2] * tint[2]));
		}
		const all = [trunks, crowns, cones, ...shrubs, ...treeTiers.flatMap((T) => [...T.near, ...T.mid])];
		for (const im of all) { im.count = cn.get(im) || 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
	}

	// the skylines, found once: every downtown's tall buildings, kept for far views
	const skyline = [];
	const skyMesh = mk(boxGeo(), mat, 6000, true);
	function findSkylines() {
		const seen = new Set();
		for (let z = -100000; z < 100000; z += 1000) for (let x = -20000; x < 120000; x += 1000) {
			const U = bay.urbanAt(x, z);
			if (U.d < 0.22) continue;
			const key = Math.floor(x / 3000) + ',' + Math.floor(z / 3000);
			if (seen.has(key)) continue;
			seen.add(key);
			fillBlocks(Math.floor(x / 3000) * 3000 + 1500, Math.floor(z / 3000) * 3000 + 1500, 2200, skyline, 38);
		}
		upload(skyline, skyMesh, null);
	}

	// ---------- landmarks ----------
	const white = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 });
	const glassM = new THREE.MeshStandardMaterial({ color: 0xb8c4cc, roughness: 0.25, metalness: 0.5 });
	const redwhite = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.6, metalness: 0.2 });
	const steelGrey = new THREE.MeshStandardMaterial({ color: 0x8e9498, roughness: 0.5, metalness: 0.4 });
	function landmarks() {
		const at = (lat, lon) => { const w = toWorld(lat, lon); return { ...w, g: Math.max(0, bay.heightAt(w.x, w.z)) }; };
		// Salesforce Tower: 326 m, a rounded square shaft tapering to a lattice crown
		{ const w = at(37.78975, -122.39687); const shaft = new THREE.CylinderGeometry(20, 27, 300, 4, 8).rotateY(Math.PI / 4).translate(0, 150, 0); const crown = new THREE.CylinderGeometry(15, 20, 26, 4, 1, true).rotateY(Math.PI / 4).translate(0, 313, 0);
			const m = new THREE.Mesh(mergeGeometries([shaft, crown]), glassM); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
		// Transamerica Pyramid: 260 m, a four-sided spire
		{ const w = at(37.79519, -122.40279); const g = new THREE.ConeGeometry(38, 260, 4, 1).rotateY(Math.PI / 4).translate(0, 130, 0);
			const m = new THREE.Mesh(g, white); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
		// Coit Tower: a 64 m fluted column on Telegraph Hill
		{ const w = at(37.80239, -122.40582); const g = new THREE.CylinderGeometry(5.5, 6, 64, 16).translate(0, 32, 0);
			const m = new THREE.Mesh(g, white); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
		// Sutro Tower: a 298 m three-legged mast on its hill, red and white
		{ const w = at(37.75523, -122.45278); const parts = [];
			for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const leg = new THREE.CylinderGeometry(1.2, 2.2, 230, 6); const pos = new THREE.Vector3(Math.cos(a) * 18, 115, Math.sin(a) * 18); leg.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.sin(a) * -0.07, 0, Math.cos(a) * 0.07))); leg.translate(pos.x * 0.6, pos.y, pos.z * 0.6); parts.push(leg); }
			for (const y of [120, 180]) parts.push(new THREE.CylinderGeometry(34, 34, 3, 3).translate(0, y, 0));
			parts.push(new THREE.CylinderGeometry(1.5, 2, 70, 6).translate(0, 263, 0));
			const m = new THREE.Mesh(mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g)), redwhite); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
	}

	// ---------- the Bay Bridge ----------
	function bayBridge() {
		const parts = [], sas = [];
		const boxAt = (a, b, width, depth, list) => {
			const d = new THREE.Vector3().subVectors(b, a), L = d.length();
			const g = new THREE.BoxGeometry(width, depth, L);
			const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
			g.applyMatrix4(m); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
			list.push(g);
		};
		const P = (lat, lon, y) => { const w = toWorld(lat, lon); return new THREE.Vector3(w.x, y, w.z); };
		// the west span: two suspension bridges end to end, from Rincon Hill to Yerba Buena Island
		const A = P(37.78796, -122.39035, 58), Bm = P(37.79967, -122.37735, 62), C = P(37.8103, -122.3655, 58);
		const towers = [0.16, 0.36, 0.64, 0.84];
		for (const [s, e] of [[A, Bm], [Bm, C]]) boxAt(s, e, 20, 3, parts);
		// deck approach down onto Rincon Hill
		boxAt(P(37.78572, -122.39292, 30), A, 20, 3, parts);
		const dir = new THREE.Vector3().subVectors(C, A), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
		for (const t of towers) {
			const base = A.clone().lerp(C, t);
			for (const sd of [-1, 1]) { const f = base.clone().addScaledVector(side, sd * 11); boxAt(new THREE.Vector3(f.x, -5, f.z), new THREE.Vector3(f.x, 160, f.z), 6, 8, parts); }
			for (const y of [75, 115, 155]) boxAt(base.clone().addScaledVector(side, -11).setY(y), base.clone().addScaledVector(side, 11).setY(y), 4, 4, parts);
		}
		// the centre anchorage
		boxAt(new THREE.Vector3(Bm.x, -5, Bm.z), new THREE.Vector3(Bm.x, 75, Bm.z), 30, 40, parts);
		// cables: tower tops sagging to near the deck between each pair
		const cableSeg = (p0, p1, sag) => { const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16; const v = p0.clone().lerp(p1, u); v.y -= sag * 4 * u * (1 - u); pts.push(v); } for (let k = 0; k < 16; k++) boxAt(pts[k], pts[k + 1], 0.9, 0.9, parts); };
		const knots = [0, ...towers, 1];
		for (const sd of [-1, 1]) for (let k = 0; k < knots.length - 1; k++) {
			const a0 = A.clone().lerp(C, knots[k]).addScaledVector(side, sd * 11), a1 = A.clone().lerp(C, knots[k + 1]).addScaledVector(side, sd * 11);
			a0.y = knots[k] === 0 || knots[k] === 1 || Math.abs(knots[k] - 0.5) < 0.2 && false ? 62 : 158; a1.y = knots[k + 1] === 0 || knots[k + 1] === 1 ? 62 : 158;
			if ((knots[k] === 0.36 && knots[k + 1] === 0.64)) { const mid = A.clone().lerp(C, 0.5).addScaledVector(side, sd * 11).setY(70); cableSeg(a0, mid, 6); cableSeg(mid, a1, 6); continue; }
			cableSeg(a0, a1, knots[k] === 0 || knots[k + 1] === 1 ? 20 : 88);
		}
		// the east span: the white self-anchored tower off Yerba Buena, then the skyway to Oakland
		const D = P(37.8140, -122.3585, 50), E = P(37.8176, -122.3490, 45), F = P(37.8252, -122.3170, 22), G = P(37.8262, -122.2985, 8);
		for (const [s, e] of [[C, D], [D, E], [E, F], [F, G]]) { const l = s.clone(), r = e.clone(); for (const sd of [-1, 1]) boxAt(l.clone().addScaledVector(side, sd * 12), r.clone().addScaledVector(side, sd * 12), 22, 3, parts); }
		const T = D.clone().lerp(E, 0.35);
		boxAt(new THREE.Vector3(T.x, 0, T.z), new THREE.Vector3(T.x, 160, T.z), 8, 8, sas);
		for (let k = 0; k <= 10; k++) { const u = k / 10; const q2 = D.clone().lerp(E, u); boxAt(new THREE.Vector3(T.x, 150, T.z), q2.clone().setY(q2.y + 2), 0.6, 0.6, sas); }
		// skyway piers
		for (let k = 0; k <= 14; k++) { const q2 = E.clone().lerp(F, k / 14); boxAt(new THREE.Vector3(q2.x, -5, q2.z), q2.clone(), 7, 4, parts); }
		const m1 = new THREE.Mesh(mergeGeometries(parts), steelGrey), m2 = new THREE.Mesh(mergeGeometries(sas), white);
		for (const m of [m1, m2]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
	}

	// the real city's buildings, pools and yard trees round (cx, cz)
	// San Ramon's roofs from the air: mostly grey and charcoal concrete tile and composition
	// shingle, some brown, a share of terracotta
	// a house's colours, from where it stands
	function houseLook(b) {
		const r = hash(Math.round(b.x / 9) * 3.7, Math.round(b.z / 9) * 1.9);
		const r2 = hash(Math.round(b.x / 9) * 5.3 + 1, Math.round(b.z / 9) * 2.3 + 7);
		return { r, r2, wall: jit(pick(r < 0.5 ? PAL.suburb : r < 0.75 ? PAL.ranch : PAL.seventies, r2), r), roof: pick(REAL_ROOF, hash(Math.round(b.x / 9) + 11, Math.round(b.z / 9) + 5)), garage: hash(Math.round(b.x / 9) * 7.7, 3) > 0.5 ? [0.93, 0.92, 0.88] : null };
	}
	// a house built for real (at c) or given back (null): its blocks hand over, or come back
	function setNear(grp, c) {
		grp.near = c;
		const l = slotOf.get(grp), nearA = near.geometry.attributes.aNear;
		if (!l) return;
		for (const n of l) { nearA.array[n * 3] = c ? c[0] : 0; nearA.array[n * 3 + 1] = c ? c[1] : 0; nearA.array[n * 3 + 2] = c ? 1 : 0; }
		nearA.needsUpdate = true;
	}
	const REAL_ROOF = [[0.3, 0.31, 0.33], [0.24, 0.25, 0.27], [0.36, 0.36, 0.37], [0.4, 0.39, 0.38], [0.33, 0.3, 0.28], [0.42, 0.33, 0.27], [0.5, 0.3, 0.22], [0.46, 0.27, 0.2], [0.28, 0.29, 0.32], [0.38, 0.35, 0.33]];
	function realBuildings(cx, cz, R, list) {
		if (!real?.loaded()) return;
		const trees = list.trees || (list.trees = []);
		const floors = new Map();
		for (const b of real.near('boxes', cx, cz, R)) {
			const dx = b.x - cx, dz = b.z - cz;
			if (dx * dx + dz * dz > R * R) continue;
			const g = bay.heightAt(b.x, b.z);
			if (g < 0.5) continue;
			// on a slope the walls go down to the lowest corner
			const ca = Math.cos(b.a), sa = Math.sin(b.a);
			let gmin = g;
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) gmin = Math.min(gmin, bay.heightAt(b.x + ca * sx * b.w / 2 - sa * sz * b.d / 2, b.z + sa * sx * b.w / 2 + ca * sz * b.d / 2));
			let y = Math.min(g - 1.2, gmin - 0.3), top = g + b.wallH;
			// a house stands on one floor, level through all its blocks (as houses.js builds it)
			const home = b.grp && isHome(b) && mainOf(b.grp);
			if (home) {
				let f = floors.get(b.grp);
				if (f === undefined) floors.set(b.grp, f = houseFloor(b.grp, bay.heightAt));
				top = f + wallTop(b); y = Math.min(y, f - 0.3);
			}
			// one colour per house (its wings and garage share it)
			const look = houseLook(home || b);
			let col = look.wall;
			let kind, roof = null;
			const rc = look.roof, r = look.r, r2 = look.r2;
			if (b.kind === 0 || b.kind === 8) kind = doorKind(KIND.house, b.door);
			else if (b.kind === 1) kind = doorKind(KIND.houseGarageL, b.door);
			else if (b.kind === 2) kind = doorKind(KIND.houseGarageR, b.door);
			else if (b.kind === 3) kind = KIND.garage;
			else if (b.kind === 4 || b.kind === 10) kind = KIND.house;
			else if (b.kind === 5) { kind = KIND.office; col = jit(pick(PAL.office, r2), r); }
			else if (b.kind === 6) { kind = KIND.retail; col = jit(pick(PAL.retail, r2), r); }
			else if (b.kind === 7) { kind = KIND.office; col = jit([0.86, 0.8, 0.68], r); }
			else { kind = KIND.industry; col = jit(pick(PAL.industry, r2), r); }
			if (b.roofH > 0.1) roof = { hip: !!b.hip, h: b.roofH, col: rc };
			list.push({ x: b.x, y, z: b.z, w: b.w, d: b.d, h: top - y, a: b.a, col, kind, roof, src: b });
		}
		for (const p of real.near('pools', cx, cz, Math.min(R, 900))) {
			const g = bay.heightAt(p.x, p.z);
			if (g > 0.5) list.push({ x: p.x, y: g - 0.9, z: p.z, w: p.w, d: p.d, h: 0.99, a: p.a, col: [0.9, 0.89, 0.85], kind: KIND.pool, roof: null });
		}
		wildLand(cx, cz, Math.min(R, 1100), trees);
		for (const t of real.near('trees', cx, cz, Math.min(R, 1400))) {
			const g = bay.heightAt(t.x, t.z), r = hash(t.x * 2.1, t.z * 1.3);
			if (g > 0.5) trees.push({ x: t.x, y: g - 0.3, z: t.z, h: t.h, cone: !!t.cone, col: t.cone ? jit([0.13, 0.21, 0.11], r) : jit(pick(PAL.crown, r), r) });
		}
	}

	// the wild land round the towns and up Mt Diablo, grown from the ground itself:
	// oak woodland on the cool north slopes and down the canyons (live oak, bay, buckeye),
	// chaparral on the hot south-facing ridges, gray and Coulter pines scattered high,
	// open grassland with the odd blue oak on the gentle slopes
	function wildLand(cx, cz, R, trees) {
		if (!real?.landAt) return;
		const C = 13, H = (x, z) => bay.heightAt(x, z);
		for (let gz = Math.floor((cz - R) / C); gz <= Math.floor((cz + R) / C); gz++) for (let gx = Math.floor((cx - R) / C); gx <= Math.floor((cx + R) / C); gx++) {
			const r = hash(gx * 1.7 + 11, gz * 2.3 + 5);
			if (r > 0.62) continue;                                                  // most cells are open ground
			const x = (gx + hash(gx, gz * 3) * 1.6 - 0.3) * C, z = (gz + hash(gx * 5, gz) * 1.6 - 0.3) * C;
			if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > R * R || !real.inside(x, z)) continue;
			const L = real.landAt(x, z);
			if (!L || (L.lu !== 0 && L.lu !== 11 && L.lu !== 12) || L.road > 0.2 || L.roof > 0.2) continue;
			const h = H(x, z);
			if (h < 3) continue;
			const e = 18, hxp = H(x + e, z), hxm = H(x - e, z), hzp = H(x, z + e), hzm = H(x, z - e);
			const slope = Math.hypot(hxp - hxm, hzp - hzm) / (2 * e);
			if (slope > 1.1) continue;                                                 // bare rock
			const north = Math.max(-1, Math.min(1, (hzp - hzm) / (2 * e) * 4));      // ground rising southward faces north
			const gully = Math.max(0, Math.min(1, (hxp + hxm + hzp + hzm - 4 * h) / 6));
			const high = Math.min(1, Math.max(0, (h - 350) / 600));
			// groves: woodland gathers in patches rather than evenly
			const grove = vnoise(x / 140, z / 140) * 0.7 + vnoise(x / 45 + 9, z / 45 + 3) * 0.3;
			const wood = Math.min(1, Math.max(0, (0.08 + north * 0.55 + gully * 0.7 + slope * 0.2 - high * 0.15) * (0.25 + grove * 1.5)));
			const chap = Math.min(1, Math.max(0, -north * 0.5 + slope * 0.9 + high * 0.6 - 0.35 - gully * 0.5));
			const r2 = hash(gx * 3.1 + 7, gz * 1.3 + 3), g = h - 0.3;
			const tint = (base) => jit(base, r2);
			if (r2 < wood * 0.8) trees.push({ x, y: g, z, h: 6 + r2 * 9 + gully * 5, sp: r2 < wood * 0.35 ? 0 : 1, col: tint(r2 < 0.3 ? [0.16, 0.24, 0.1] : [0.22, 0.28, 0.13]) });
			else if (r2 < wood * 0.8 + chap * 0.75) trees.push({ x, y: g, z, h: 1.4 + r2 * 1.8, shrub: true, col: tint([0.2, 0.25, 0.13]) });
			else if (r2 > 0.965 - high * 0.05) trees.push({ x, y: g, z, h: 11 + r2 * 9, cone: true, sp: 2, col: tint([0.3, 0.36, 0.26]) });   // gray pine
			else if (r2 > 0.92 && slope < 0.35) trees.push({ x, y: g, z, h: 7 + r2 * 5, sp: 1, col: tint([0.3, 0.33, 0.2]) });          // blue oak in the grass
		}
	}

	let lastX = 1e9, lastZ = 1e9, started = false, realSeen = false, realV = 0;
	function update(cam, nightK) {
		if (!bay.loaded()) return;
		night.value = nightK;
		if (!started) { started = true; findSkylines(); landmarks(); bayBridge(); }
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y > 4000;
		near.visible = hips.visible = gables.visible = trunks.visible = crowns.visible = cones.visible = !high;
		for (const im of [...shrubs, ...treeTiers.flatMap((T) => [...T.near, ...T.mid])]) im.visible = !high;
		if (!realSeen && real?.loaded()) { realSeen = true; lastX = 1e9; }                   // the real city arrived: rebuild
		if (real?.version && real.version() !== realV) { realV = real.version(); lastX = 1e9; }   // a generated town came or went
		if (Math.hypot(x - lastX, z - lastZ) < 300) { if (!high && Math.hypot(x - treeX, z - treeZ) > 40) placeTrees(x, z); return; }                 // (MARGIN covers these 40 m)
		lastX = x; lastZ = z;
		const list = [];
		fillBlocks(x, z, 1200, list);
		realBuildings(x, z, 2000, list);
		// if there is more than fits, keep the nearest
		const d2 = (o) => (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z);
		if (list.length > CAP) { const t = list.trees; list.sort((m, n) => d2(m) - d2(n)); list.length = CAP; list.trees = t; }
		if (list.trees && list.trees.length > TCAP) list.trees.sort((m, n) => d2(m) - d2(n));
		upload(list, near, [hips, gables]);
		placeTrees(x, z);
	}
	return { update, group, fill: fillBlocks, houseLook, setNear, setNearBand: (a, b) => nearBand.value.set(a, b) };
}
