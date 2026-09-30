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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hardwood, conifer, shrub, fern, swayMaterial } from '../world/vegetation.js';
import { addLodFade, NONE_IN } from '../world/lodfade.js';
import * as TX from '../world/textures.js';
import { STYLE, BLOCKS, toGrid, fromGrid, ERA, eraFor, sfDistrict } from './styles.js';
import { houseFloor, wallTop, mainOf, isHome } from './houseplan.js';
import { usePhoto } from '../world/photomats.js';
import { GREENS } from './realcity.js';
import { WALL_GLSL, weatherRoofs } from './weathering.js';
import { inCampus } from './discovery.js';
import { inBoardwalk } from './boardwalk.js';
import { inRiverWater, riverTreesNear, carveVersion, carveNear } from './carve.js';
import { inWater, waterTreesNear, waterVersion } from './watercarve.js';
import { inClearing, clearingVersion } from '../sportsfields.js';
import { roofGeometry, roofDetail, ROOF } from './roofs.js';
import { createProps } from './lotkit.js';
import { inCoastField, coastVersion } from './coastside.js';

const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// a kind's fraction carries a detail for the facade shader: where the front door is on a
// house (1.0-1.4), which side the garage is on a row house (0, 0.1, 0.2)
// (14 garden apartments, 15 a court: .0 tennis, .5 pickleball; 16 a parapet with its coping)
const KIND = { row: 0, house: 1, tower: 2, office: 3, paved: 4, industry: 5, retail: 6, plain: 7, garage: 8, shop: 9, bay: 10, houseGarageL: 11, houseGarageR: 12, pool: 13, apt: 14, court: 15, parapet: 16 };
// a building's condition rides on its age (aAge = age + 2 x condition): 1 boarded up and
// empty, 2 burnt out, 3 run down. It comes from how old and neglected the place is, never
// from who lives there
const COND = { ok: 0, boarded: 1, burnt: 2, rundown: 3 };
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
const fract = (v) => v - Math.floor(v);
// a house repainted since: any decade's colours
const REMODEL = [...PAL.suburb, ...PAL.ranch, ...PAL.seventies];
// the cars in the drives; the faded ones left to sit; umbrella and cabana canvas
const CARS = [[0.92, 0.92, 0.9], [0.08, 0.08, 0.09], [0.45, 0.46, 0.48], [0.7, 0.71, 0.72], [0.2, 0.28, 0.45], [0.55, 0.1, 0.1], [0.3, 0.32, 0.3], [0.6, 0.55, 0.45], [0.85, 0.85, 0.83]];
const FADED = [[0.55, 0.45, 0.38], [0.5, 0.52, 0.5], [0.62, 0.58, 0.5], [0.42, 0.36, 0.3]];
const CANVAS = [[0.9, 0.88, 0.82], [0.2, 0.36, 0.55], [0.75, 0.3, 0.2], [0.25, 0.45, 0.35], [0.85, 0.7, 0.35]];
// back fences: [colour, height, thickness]: cedar, weathered boards, white vinyl, a block wall, chain link, dark stain
const FENCES = [[0.46, 0.38, 0.3, 1.8, 0.1], [0.55, 0.52, 0.47, 1.8, 0.1], [0.92, 0.92, 0.9, 1.8, 0.1], [0.7, 0.64, 0.55, 1.9, 0.2], [0.5, 0.51, 0.52, 1.5, 0.04], [0.36, 0.3, 0.24, 1.6, 0.1], [0.46, 0.38, 0.3, 1.8, 0.1]];
// a face's turn, and its local x and front (+z) as grid directions
const FACE_A = { s: 0, n: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };
const LX = { s: [1, 0], n: [-1, 0], e: [0, -1], w: [0, 1] }, NZ = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
// how a place has held up: rare, and only where the buildings are old and the neighbourhood
// has let things go (a slow, kilometre-scale neglect field), with base the chance for the
// kind of place. Age and neglect only: never who lives there
function condFor(o, base) {
	if (!o) return COND.ok;
	const nb = vnoise(o.x / 420 + 17.3, o.z / 420 - 5.1);
	const k = Math.min(1, Math.max(0, (o.age - 0.5) / 0.4));
	const p = base * k * k * (0.2 + 1.8 * nb * nb);
	const q = hash(o.x * 0.91 + 3.3, o.z * 0.77 - 1.1);
	if (q >= p) return COND.ok;
	const u = q / p;
	return u < 0.5 ? COND.rundown : u < 0.85 ? COND.boarded : COND.burnt;
}
function setCond(o, c) { if (o && c) o.cond = c; }

// facades by kind: SF bay windows and cornices, house windows, curtain wall, ribbon glazing
// a house built for real close by (houses.js) takes over from its block: aNear holds the
// house's centre and a flag, and the block gives up its pixels as the house takes them
// a town that arrives (a generated one grown, or dropped for another) rises out of the
// ground in a ring spreading from where you stand, instead of appearing all at once:
// uRise = (centre x, z, the ring's radius, on)
const RISE_GLSL = `
	if (uRise.w > 0.5) {
		vec2 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
		float rk = smoothstep(0.0, 1.0, clamp((uRise.z - length(ip - uRise.xy)) / 160.0, 0.0, 1.0));
		transformed.y -= (1.0 - rk) * 34.0 / max(1e-3, length(instanceMatrix[1].xyz));
	}`;
function withRise(m, rise, key) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev?.call(m, sh, r);
		sh.uniforms.uRise = rise;
		sh.vertexShader = 'uniform vec4 uRise;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + RISE_GLSL);
	};
	const k0 = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (k0 ? k0() : '') + key;
	return m;
}
// the life on a tree's bark, by species, aspect and the fog: the bark broken into plates by
// fissures running up the trunk (deep on the oaks, fibrous on the redwoods, the plane's
// smooth and mottled), moss thick on the north side and low down where the damp stays, pale
// crusts of lichen, and all of it heavier in the fog belt near the sea.
// kind: 0 plane/sycamore, 1 coast live oak, 2 redwood/cypress, 3 shrub stems
const BARK_GLSL = /* glsl */`
float bkH(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bkN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bkH(i), bkH(i + vec2(1, 0)), f.x), mix(bkH(i + vec2(0, 1)), bkH(i + vec2(1, 1)), f.x), f.y); }`;
function mossify(m, kind) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev.call(m, sh, r);
		sh.vertexShader = 'varying vec3 vBarkW; varying float vBarkY;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			{
				vec4 bw = vec4(transformed, 1.0);
				#ifdef USE_INSTANCING
				bw = instanceMatrix * bw;
				#endif
				bw = modelMatrix * bw; vBarkW = bw.xyz; vBarkY = position.y;
			}`);
		sh.fragmentShader = 'varying vec3 vBarkW; varying float vBarkY;\n' + BARK_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 wn = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
				float north = clamp(-wn.z * 0.8 + 0.2, 0.0, 1.0);                    // (world -z is north)
				float fog = 1.0 - smoothstep(22000.0, 58000.0, vBarkW.x);
				vec2 bp = vec2((vBarkW.x + vBarkW.z) * ${[3.5, 5.0, 7.0, 6.0][kind].toFixed(1)}, vBarkW.y * ${[1.4, 1.1, 0.35, 1.2][kind].toFixed(2)});
				// fissures: the contour lines of a noise stretched up the trunk
				float fz = bkN(bp) * 0.7 + bkN(bp * 2.3 + 5.0) * 0.3;
				float fiss = 1.0 - smoothstep(0.03, ${[0.06, 0.13, 0.11, 0.08][kind].toFixed(2)}, abs(fz - 0.5));
				diffuseColor.rgb *= 1.0 - fiss * ${[0.25, 0.6, 0.55, 0.4][kind].toFixed(2)};
				${kind === 0 ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.35, 1.3, 1.15), smoothstep(0.55, 0.7, bkN(bp * 0.6 + 3.0)) * 0.7);   // the plane\'s mottle' : ''}
				// moss: north side, low down, in the damp
				float patchy = smoothstep(0.35, 0.7, bkN(vBarkW.xz * 2.1 + vBarkW.y * 0.8) * 0.6 + bkN(bp * 1.7) * 0.4);
				float moss = ${[0.5, 1.0, 0.25, 0.4][kind].toFixed(2)} * north * (1.0 - smoothstep(0.4, 3.2 + fog * 3.0, vBarkY)) * (0.35 + 0.65 * fog) * patchy;
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.11, 0.018) * (0.75 + 0.5 * bkN(bp * 3.0)), clamp(moss * 1.4, 0.0, 0.92));
				// lichen: pale grey-green crusts, on the oaks most
				float lich = smoothstep(0.72, 0.8, bkN(bp * 2.6 + 11.0)) * ${[0.35, 0.8, 0.15, 0.3][kind].toFixed(2)} * (0.3 + 0.7 * fog);
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.33, 0.26), lich * 0.8);
			}`);
	};
	const pk = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (pk ? pk() : '') + '|bark' + kind;
}
// lace lichen: in the fog belt the coast live oaks hang with pale grey-green strands
// among their leaves, thickest low in the crown
function lichenLeaves(m) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev.call(m, sh, r);
		sh.vertexShader = 'varying vec3 vLichW; varying float vLichY;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			{
				vec4 bw = vec4(transformed, 1.0);
				#ifdef USE_INSTANCING
				bw = instanceMatrix * bw;
				#endif
				bw = modelMatrix * bw; vLichW = bw.xyz; vLichY = position.y;
			}`);
		sh.fragmentShader = 'varying vec3 vLichW; varying float vLichY;\n' + BARK_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float fog = 1.0 - smoothstep(22000.0, 50000.0, vLichW.x);
				float strands = smoothstep(0.55, 0.75, bkN(vec2((vLichW.x + vLichW.z) * 9.0, vLichW.y * 1.2))) * smoothstep(0.5, 0.62, bkN(vLichW.xz * 0.9));
				float low = 1.0 - smoothstep(0.35, 0.75, vLichY / 9.0);
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.38, 0.28), strands * low * fog * 0.85);
			}`);
	};
	const pk = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (pk ? pk() : '') + '|lichleaf';
}

function buildingMaterial(shared, night, nearBand) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightC = night;
		sh.uniforms.uNearBand = nearBand;
		sh.vertexShader = 'attribute float aKind; attribute float aAge; varying float vAge; attribute vec3 aNear; uniform vec2 uNearBand; varying float vNearK; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS; varying vec3 vLP; varying vec3 vLN; varying vec2 vIP; varying vec3 vDoor; varying float vDoorTop;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vNearK = aNear.z > 0.5 && aNear.z < 1.5 ? 1.0 - smoothstep(uNearBand.x, uNearBand.y, length(aNear.xy - cameraPosition.xz)) : 0.0;
			// (a building with its rooms built inside: its front door cut out, aNear = door x, sill y, 2 + width)
			vDoor = aNear.z > 1.5 ? vec3(aNear.xy, aNear.z - 2.0) : vec3(0.0);
			// (and how high its rooms go: 2 + width + 4 x whole metres; its windows open only below that)
			vDoorTop = aNear.z > 1.5 ? floor(vDoor.z / 4.0) : 0.0; vDoor.z -= vDoorTop * 4.0;
			vKind = aKind; vAge = aAge;
			vLY = transformed.y * length(instanceMatrix[1].xyz);
			vCW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
			vCS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
			vLP = transformed; vLN = objectNormal; vIP = instanceMatrix[3].xz;`);
		sh.fragmentShader = 'varying float vAge;\n' + WALL_GLSL + 'uniform float uNightC; varying float vNearK; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS; varying vec3 vLP; varying vec3 vLN; varying vec2 vIP; varying vec3 vDoor; varying float vDoorTop;\nvec3 winGlow = vec3(0.0); float glassK = 0.0;\nfloat bh(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }   // (wrapped first: sin() of a world-sized number is noise on a GPU)\n' + sh.fragmentShader
			.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
			if (vNearK > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < vNearK) discard;
			if (vDoor.z > 0.0 && vLN.z > 0.5 && abs(vLP.x * vCS.x - vDoor.x) < vDoor.z * 0.5 && vLY > vDoor.y && vLY < vDoor.y + 2.3) discard;`)
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float roof = step(0.7, vCN.y);
				float cond = floor(vAge * 0.5 + 0.001), age = vAge - cond * 2.0;
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
				if (K > 15.5) {
					// a parapet: the wall's own colour, a pale coping along its top
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.77, 0.74), roof);
				} else if (K > 14.5) {
					// a court: the playing surface and its lines (tennis, or pickleball), a green surround
					vec2 cp = vLP.xz * vCS.xz;
					float pb = step(0.25, fract(K));
					vec2 hc = pb > 0.5 ? vec2(3.05, 6.7) : vec2(5.49, 11.89);
					float inC = step(abs(cp.x), hc.x) * step(abs(cp.y), hc.y);
					vec3 sc = mix(vec3(0.22, 0.42, 0.3), pb > 0.5 ? vec3(0.2, 0.36, 0.62) : vec3(0.26, 0.38, 0.56), inC);
					float lw = 0.05, ln = 0.0;
					ln = max(ln, step(abs(abs(cp.x) - hc.x), lw) * step(abs(cp.y), hc.y + lw));
					ln = max(ln, step(abs(abs(cp.y) - hc.y), lw) * step(abs(cp.x), hc.x + lw));
					if (pb > 0.5) ln = max(ln, max(step(abs(abs(cp.y) - 2.13), lw) * step(abs(cp.x), hc.x), step(abs(cp.x), lw) * step(2.13, abs(cp.y)) * step(abs(cp.y), hc.y)));
					else {
						ln = max(ln, step(abs(abs(cp.x) - 4.11), lw) * step(abs(cp.y), hc.y));
						ln = max(ln, step(abs(abs(cp.y) - 6.4), lw) * step(abs(cp.x), 4.11));
						ln = max(ln, step(abs(cp.x), lw) * step(abs(cp.y), 6.4));
					}
					float fwc = length(fwidth(cp));
					diffuseColor.rgb = mix(diffuseColor.rgb, mix(sc, vec3(0.95), ln * (1.0 - smoothstep(0.05, 0.25, fwc))), roof);
				} else if (K > 13.5) {
					// garden apartments: 2.8 m floors, each unit a window pair and a slider onto its
					// balcony, a pale band at each floor, open breezeways to the stairs now and then
					cell = vec2((front > 0.5 ? fx : u) / 3.6, gy / 2.8); vec2 f = fract(cell);
					float slider = front * step(0.5, fract(cell.x * 0.5 + 0.25));
					win = step(0.2, f.x) * step(f.x, 0.8) * step(mix(0.32, 0.04, slider), f.y) * step(f.y, 0.8);
					float frame = step(0.17, f.x) * step(f.x, 0.83) * step(mix(0.28, 0.02, slider), f.y) * step(f.y, 0.84);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.88), frame * (1.0 - win) * (1.0 - roof));
					float band = step(fract(gy / 2.8 + 0.01), 0.05) * step(1.0, gy) * (1.0 - roof);
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + 0.04, band);
					float bw = fract((front > 0.5 ? fx : u) / 25.2);
					float breeze = step(0.46, bw) * step(bw, 0.54) * step(gy, vCS.y - 2.4) * front;
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.35, breeze);
					win *= 1.0 - breeze;
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, (1.0 - roof) * step(gy, 0.3));
					glass = vec3(0.17, 0.2, 0.23);
				} else if (K > 12.5) {
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
						dc *= (0.9 + 0.1 * step(0.08, fract(gy / 0.54))) * (1.0 - 0.12 * step(0.93, fract((bx - 0.3) / 0.62)));
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
					float gpan = 1.0 - 0.12 * step(0.93, fract((gb - 0.12) / 0.615));
					vec3 gdc = ih > 0.5 ? vec3(0.92, 0.91, 0.87) : diffuseColor.rgb * 1.06;
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.94, 0.9), max(frame * (1.0 - win), doorF * (1.0 - door)));
					// a sill under each window (its shadow below it), a head over it; shutters on
					// some houses, divided lights on some
					float wz = wOn * (1.0 - gzone) * (1.0 - hasDoor * front * step(abs(fx - doorX), 1.3) * step(gy, 2.4)) * (1.0 - roof);
					float sill = wz * step(0.21, f.x) * step(f.x, 0.79) * step(0.215, f.y) * step(f.y, 0.26);
					float sillSh = wz * step(0.23, f.x) * step(f.x, 0.77) * step(0.185, f.y) * step(f.y, 0.215);
					float head = wz * step(0.23, f.x) * step(f.x, 0.77) * step(0.82, f.y) * step(f.y, 0.865);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.96, 0.93), max(sill, head));
					diffuseColor.rgb *= 1.0 - sillSh * 0.35;
					float hs = bh(floor(vIP * 0.5) + 2.7);
					if (hs > 0.68) {
						float sh = wz * step(0.13, f.x) * step(f.x, 0.25) * step(0.3, f.y) * step(f.y, 0.79) + wz * step(0.75, f.x) * step(f.x, 0.87) * step(0.3, f.y) * step(f.y, 0.79);
						vec3 shc = hs > 0.9 ? vec3(0.08, 0.1, 0.09) : hs > 0.82 ? vec3(0.1, 0.2, 0.14) : hs > 0.75 ? vec3(0.1, 0.14, 0.24) : vec3(0.35, 0.1, 0.08);
						diffuseColor.rgb = mix(diffuseColor.rgb, shc * (0.85 + 0.15 * step(0.4, fract(gy * 12.0))), sh);
					}
					if (hs < 0.35) win *= 1.0 - (step(abs(f.x - 0.5), 0.008) + step(abs(f.y - 0.54), 0.008)) * 0.9;
					vec3 dcol = ih > 0.75 ? vec3(0.45, 0.1, 0.08) : ih > 0.5 ? vec3(0.1, 0.16, 0.26) : ih > 0.25 ? vec3(0.38, 0.24, 0.14) : vec3(0.9, 0.9, 0.86);
					diffuseColor.rgb = mix(diffuseColor.rgb, dcol, door);
					diffuseColor.rgb = mix(diffuseColor.rgb, gdc * gpan * (0.9 + 0.1 * step(0.08, fract(gy / 0.54))), gdoor);
					// a row of lites across the top of some garage doors
					float glite = gdoor * step(0.6, ih) * step(1.68, gy) * step(gy, 1.98) * step(0.15, fract((gb - 0.12) / 0.615)) * step(fract((gb - 0.12) / 0.615), 0.85);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.14, 0.16), glite);
					// a darker skirt of foundation at the ground
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, (1.0 - roof) * step(gy, 0.3));
					glass = vec3(0.18, 0.2, 0.22);
				} else if (vKind < 2.5) {
					// towers: curtain wall with mullions and spandrels
					cell = vec2(u / 1.6, v / 3.9); vec2 f = fract(cell);
					win = step(0.07, f.x) * step(f.y, 0.78);
					glass = mix(diffuseColor.rgb * 0.55, vec3(0.5, 0.6, 0.7), 0.35) * (0.85 + 0.25 * bh(floor(cell / 3.0)));
					glassK = win;
					// at the street: a tall glazed lobby in wide bays above a dark stone plinth
					if (vLY < 6.2) {
						cell = vec2(u / 3.2, 0.0);
						win = step(0.06, fract(cell.x)) * step(2.1, vLY) * step(vLY, 5.6);
						glass = vec3(0.14, 0.16, 0.18); glassK = win * 0.8;
						diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.78, step(5.6, vLY));
					}
					// on about half the tall ones, a penthouse: the top level's ceilings twice as high,
					// glazed floor to ceiling in wide bays between pale mullions
					if (vCS.y > 30.0 && ih > 0.45 && vLY > vCS.y - 7.4 && roof < 0.5) {
						float pf = fract(u / 2.4);
						win = step(0.05, pf) * step(vCS.y - 7.0, vLY) * step(vLY, vCS.y - 0.9);
						glass = vec3(0.3, 0.36, 0.42); glassK = win;
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.9, 0.88), 1.0 - win);
					}
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.26, 0.25), step(vLY, 2.0) * (1.0 - roof));
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
					// a dark stone plinth at the ground
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.29, 0.28), step(vLY, 1.9) * (1.0 - roof));
				}
				// a building with its rooms built: its front windows (and a bay's) are holes onto them
				if (vDoor.z > 0.0 && win > 0.5 && vLY < vDoorTop && (K < 0.5 || K > 8.5) && K < 10.5 && (front > 0.5 || K > 9.5)) discard;
				// the condition of the place: boarded up (plywood over the openings), burnt out
				// (the openings black, soot up the wall above them), run down (grimy glass, a
				// pane or two broken)
				vec2 cf = fract(cell), ci = floor(cell);
				if (cond > 0.5 && roof < 0.5) {
					if (cond < 1.5) {
						float ply = 0.62 + 0.25 * bh(ci + 4.4);
						vec3 pc = vec3(0.66, 0.54, 0.38) * ply * (0.92 + 0.08 * step(0.5, fract(vCW.y * 3.0 + bh(ci) * 3.0)));
						diffuseColor.rgb = mix(diffuseColor.rgb, pc, win);
						win = 0.0; glassK = 0.0;
					} else if (cond < 2.5) {
						float sn = wxN(vec2(u * 0.7, vLY * 0.45));
						float plume = smoothstep(0.75, 1.0, cf.y) * (1.0 - smoothstep(0.1, 0.5, abs(cf.x - 0.5) - (cf.y - 0.75) * 0.6)) * step(0.35, bh(ci + 1.9));
						float soot = clamp((vLY / max(vCS.y, 1.0)) * 1.3 - 0.35 + (sn - 0.5) * 1.2, 0.0, 1.0) * 0.8;
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.03, 0.028), max(soot, plume * 0.9));
						glass = vec3(0.015); glassK = 0.0;
					} else {
						glass = mix(glass, vec3(0.34, 0.33, 0.3), 0.45);
						glass = mix(glass, vec3(0.01), step(0.88, bh(ci + 6.2)));
					}
				}
				if (cond > 1.5 && cond < 2.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03), roof);
				// the flat roofs: white membrane in seamed strips, grey gravel, or dark torch-down
				if (roof > 0.5 && (K < 0.5 || (K > 2.5 && K < 3.5) || (K > 4.5 && K < 6.5) || (K > 8.5 && K < 9.5) || (K > 13.5 && K < 14.5))) {
					float rk = bh(floor(vIP * 0.5) + 8.8), pxR = length(fwidth(vCW.xz));
					vec3 rc = rk < 0.45 ? vec3(0.8, 0.8, 0.78) * (1.0 - 0.1 * step(0.97, fract(dot(vCW.xz, t) / 3.05)) * (1.0 - smoothstep(0.05, 0.3, pxR)))
						: rk < 0.8 ? vec3(0.46, 0.45, 0.42) * (0.85 + 0.3 * bh(floor(vCW.xz * 12.0)) * (1.0 - smoothstep(0.03, 0.12, pxR)))
						: vec3(0.16, 0.16, 0.17) * (0.9 + 0.2 * step(0.5, fract(dot(vCW.xz, t) / 0.9)) * (1.0 - smoothstep(0.03, 0.12, pxR)));
					diffuseColor.rgb = rc * 1.25;
				}
				// far off, where a window is smaller than a pixel or two, it is only its average
				// (as a mipmap would be): no crawling speckle on distant facades at night
				float aaW = smoothstep(0.75, 0.3, length(fwidth(cell)));
				win = mix(0.24, win, aaW);
				win *= (1.0 - roof) * step(0.8, vLY);
				// the weather's years on it (weathering.js): streaks, splash-back, bleaching, damp;
				// its roof dusty and streaked (not on the pools, the paving or the plazas)
				if (K < 6.5 && (K < 3.5 || K > 4.5)) {
					float pxW = length(fwidth(vCW));
					if (roof < 0.5) {
						float edgeW = abs(vLN.z) > 0.5 ? (0.5 - abs(vLP.x)) * vCS.x : (0.5 - abs(vLP.z)) * vCS.z;
						float concW = K > 1.5 && K < 3.5 ? 0.6 : K > 4.5 && K < 5.5 ? 0.3 : K > 5.5 ? 0.35 : 0.1;
						diffuseColor.rgb = wallAge(diffuseColor.rgb, vCW, vCN, vLY, vCS.y, edgeW, age, pxW, concW);
					} else diffuseColor.rgb = roofAge(diffuseColor.rgb, vCW, vCN, age);
				} else if (K > 7.5 && K < 12.5) {
					float pxW = length(fwidth(vCW));
					if (roof < 0.5) diffuseColor.rgb = wallAge(diffuseColor.rgb, vCW, vCN, vLY, vCS.y, abs(vLN.z) > 0.5 ? (0.5 - abs(vLP.x)) * vCS.x : (0.5 - abs(vLP.z)) * vCS.z, age, pxW, 0.05);
					else diffuseColor.rgb = roofAge(diffuseColor.rgb, vCW, vCN, age);
				}
				diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
				diffuseColor.rgb *= mix(1.0, 0.8, roof);
				// contact shade: the wall darkens where it meets the ground (the sky it sees is
				// half hidden there), so the building sits in the ground instead of on it
				diffuseColor.rgb *= mix(1.0, mix(0.58, 1.0, smoothstep(0.9, 3.4, vLY)), (1.0 - roof) * step(vKind, 6.5));
				float lit = max(mix(0.3, step(vKind > 1.5 ? 0.5 : 0.58, bh(floor(cell) + floor(vCW.xz * 0.013))), aaW), shopGlow * step(0.25, ih)) * step(cond, 0.5);
				// each lit window its own: warm lamps or cool office tubes, brighter up by the
				// ceiling light, some with the blinds half down (close up; far off, the average)
				vec2 fc = fract(cell), cid = floor(cell);
				vec3 tint = mix(mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.86, 0.66), step(1.5, vKind) * 0.6), vec3(0.78, 0.88, 1.0), step(0.72, bh(cid + 7.1)) * step(1.5, vKind));
				float inner = mix(1.0, (0.55 + 0.6 * fc.y) * mix(1.0, step(fc.y, 0.3 + 0.6 * bh(cid + 5.7)), step(0.65, bh(cid + 2.2))), aaW);
				winGlow = tint * win * lit * inner * uNightC * (0.45 + 0.55 * bh(cid + 3.3)) * 1.1;
				// after dark the walls are not black: the city's own glow on them, and the warm
				// spill of the streetlights up the lowest floors
				winGlow += diffuseColor.rgb * (1.0 - win) * (1.0 - roof) * uNightC * (0.14 * vec3(0.8, 0.85, 1.0) + 0.3 * vec3(1.0, 0.78, 0.5) * (1.0 - smoothstep(2.5, 16.0, vLY)));
				// the dark windows are not holes: the night sky and the lit city in the glass
				winGlow += vec3(0.05, 0.065, 0.09) * win * (1.0 - lit) * uNightC * (0.6 + 0.8 * bh(cid + 9.1));
			}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, glassK);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winGlow;');
	};
	m.customProgramCacheKey = () => 'baybuilding14';
	return m;
}

// The far trees as impostors: each species' own middle-distance tree, its leaf cards and
// trunk projected side-on onto a small canvas (their colours, back to front, a leafy
// fringe), once. Far off a tree is a single point drawn as that picture: no triangles.
const IMP = 128;
function treeImpostor(parts, texAvg) {
	const cv = document.createElement('canvas');
	cv.width = cv.height = IMP;
	const g = cv.getContext('2d');
	const [trunkG, crownG] = parts;
	const bb = new THREE.Box3().setFromBufferAttribute(crownG.attributes.position).union(new THREE.Box3().setFromBufferAttribute(trunkG.attributes.position));
	const H = bb.max.y - Math.max(0, bb.min.y), W = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
	const k = IMP / Math.max(H, W) * 0.98, px = (x) => IMP / 2 + x * k, py = (y) => IMP - 1 - y * k;
	const toS = (v) => Math.round(Math.min(255, Math.pow(Math.max(0, v), 1 / 2.2) * 255));
	const draw = (geo, colour, alpha) => {
		const P = geo.attributes.position, C = geo.attributes.color, I = geo.index.array, tris = [];
		for (let i = 0; i < I.length; i += 3) { let z = 0; for (let j = 0; j < 3; j++) z += P.getZ(I[i + j]); tris.push([i, z]); }
		tris.sort((a, b) => a[1] - b[1]);                     // back to front (the camera looks along -z)
		for (const [i] of tris) {
			const a = I[i], b = I[i + 1], c = I[i + 2], col = colour(C, a);
			g.fillStyle = `rgba(${toS(col[0])},${toS(col[1])},${toS(col[2])},${alpha})`;
			g.beginPath(); g.moveTo(px(P.getX(a)), py(P.getY(a))); g.lineTo(px(P.getX(b)), py(P.getY(b))); g.lineTo(px(P.getX(c)), py(P.getY(c))); g.closePath(); g.fill();
		}
	};
	draw(trunkG, () => [0.12, 0.09, 0.07], 1);
	draw(crownG, (C, a) => [C.getX(a) * texAvg[0], C.getY(a) * texAvg[1], C.getZ(a) * texAvg[2]], 0.7);
	// a leafy fringe: the crown's edge nibbled away in small bites
	g.globalCompositeOperation = 'destination-out';
	let s = 7;
	const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	for (let n = 0; n < 700; n++) { const x = rnd() * IMP, y = rnd() * IMP * 0.8; g.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.35})`; g.beginPath(); g.arc(x, y, 0.6 + rnd() * 1.4, 0, 6.283); g.fill(); }
	return cv;
}
const IMPOSTOR_VERT = /* glsl */`
	attribute float aSize; attribute float aSp; attribute vec3 aTint;
	uniform float uScale; varying float vSp; varying vec3 vTint; varying float vD;
	#include <fog_pars_vertex>
	void main(){
		vec4 mvPosition = modelViewMatrix * vec4(position + vec3(0.0, aSize * 0.5, 0.0), 1.0);
		gl_Position = projectionMatrix * mvPosition;
		gl_PointSize = aSize * uScale / -mvPosition.z;
		vSp = aSp; vTint = aTint; vD = length(mvPosition.xyz);
		#include <fog_vertex>
	}`;
const IMPOSTOR_FRAG = /* glsl */`
	uniform sampler2D uAtlas; uniform vec3 uSunC, uAmb, uSunD; uniform vec4 uBand;
	varying float vSp; varying vec3 vTint; varying float vD;
	#include <fog_pars_fragment>
	void main(){
		vec2 uv = vec2((gl_PointCoord.x + floor(vSp + 0.5)) / 3.0, 1.0 - gl_PointCoord.y);
		vec4 t = texture2D(uAtlas, uv);
		// dissolve in and out across the hand-over bands, as the other tiers do
		float fade = smoothstep(uBand.x, uBand.y, vD) * (1.0 - smoothstep(uBand.z, uBand.w, vD));
		float h = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
		if (t.a < 0.45 || fade < h) discard;
		// lit from above: the sun on the upper crown, the sky everywhere
		vec3 light = uAmb * 1.6 + uSunC * smoothstep(-0.05, 0.3, uSunD.y) * (0.45 + 0.55 * (1.0 - gl_PointCoord.y)) * 0.95;
		gl_FragColor = vec4(t.rgb * vTint * light * vec3(0.8, 0.78, 0.8), 1.0);      // (matched to the leafy tier beside it)
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
		#include <fog_fragment>
	}`;

const OCEAN_X = toWorld(37.76, -122.49).x;
const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));       // west of here the sea is the Pacific

export function createCity(shared, scene, bay, real = null) {
	const group = new THREE.Group();
	group.name = 'bay-city';
	scene.add(group);
	const night = { value: 0 };
	const nearBand = { value: new THREE.Vector2(36, 46) };
	const rise = { value: new THREE.Vector4(0, 0, 0, 0) };
	let riseT0 = -1;
	const mat = withRise(buildingMaterial(shared, night, nearBand), rise, 'rise1');
	const roofMat = withRise(roofDetail(weatherRoofs(new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }))), rise, 'roofrise1');
	const CAP = 32000;
	const boxGeo = () => { const g = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); return g; };
	const mk = (geo, material, cap, kinds) => {
		if (kinds) { geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)); geo.setAttribute('aAge', new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(0.4), 1)); geo.setAttribute('aNear', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)); }
		const im = new THREE.InstancedMesh(geo, material, cap);
		im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
		im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
		group.add(im);
		return im;
	};
	const near = mk(boxGeo(), mat, CAP, true);
	const hipG = roofGeometry(true), gableG = roofGeometry(false);
	for (const g of [hipG, gableG]) { g.setAttribute('aRoof', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4)); g.setAttribute('aWall', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3)); }
	const hips = mk(hipG, roofMat, CAP, false), gables = mk(gableG, roofMat, CAP, false);
	// the props of the lived-in streets and on the roofs (lotkit.js)
	const kit2 = createProps(group, (m) => withRise(m, rise, 'kitrise'), PHONE);
	// what is on and about the buildings up close: the air conditioners on the flat roofs of
	// the shops, offices and warehouses; a glass sunroom off the back of some houses, a
	// clothesline in some back yards (see decorate)
	const kit = (() => {
		const colored = (geo, c) => { const g = geo.toNonIndexed(), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
		const B = (w, h, d, x, y, z, c) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
		const C = (r, h, x, y, z, c, seg = 14) => colored(new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z), c);
		const body = [0.8, 0.81, 0.8], dark = [0.16, 0.17, 0.18], grille = [0.42, 0.43, 0.44];
		// a packaged rooftop unit on its curb: the cabinet, two fans in their shrouds on top,
		// the louvred coil down one side
		const ac = mergeGeometries([
			B(1.25, 0.18, 2.1, 0, 0, 0, [0.46, 0.46, 0.45]), B(1.1, 1.0, 1.95, 0, 0.18, 0, body),
			C(0.34, 0.12, 0, 1.18, -0.45, grille), C(0.3, 0.02, 0, 1.3, -0.45, dark), C(0.34, 0.12, 0, 1.18, 0.45, grille), C(0.3, 0.02, 0, 1.3, 0.45, dark),
			B(0.03, 0.62, 1.5, 0.56, 0.4, 0, grille), B(0.4, 0.3, 0.3, 0, 0.18, 1.1, body),
		]);
		// the sunroom: white frames, glass between (two meshes)
		const fr = [0.95, 0.95, 0.93], bars = [];
		for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) bars.push(B(0.02, 1, 0.02, x, 0, -0.5, fr));
		for (const z of [-0.25, 0, 0.25]) for (const x of [-0.5, 0.5]) bars.push(B(0.02, 1, 0.02, x, 0, z, fr));
		for (const y of [0, 0.33, 1]) { bars.push(B(1.02, 0.03, 0.02, 0, y, -0.5, fr)); bars.push(B(0.02, 0.03, 1.0, -0.5, y, 0, fr)); bars.push(B(0.02, 0.03, 1.0, 0.5, y, 0, fr)); }
		bars.push(B(1.06, 0.03, 1.06, 0, 1.0, 0, fr), B(1.04, 0.33, 0.01, 0, 0, -0.5, [0.85, 0.84, 0.8]));
		const sunF = mergeGeometries(bars);
		const sunG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
		// a clothesline: two T-posts, three lines between, and the washing pegged out
		const post = [0.55, 0.56, 0.57], line = [0.9, 0.9, 0.88], parts = [];
		for (const x of [-2.4, 2.4]) { parts.push(C(0.04, 1.9, x, 0, 0, post, 6), B(0.05, 0.05, 1.0, x, 1.85, 0, post)); }
		for (const z of [-0.4, 0, 0.4]) parts.push(B(4.8, 0.012, 0.012, 0, 1.87, z, line));
		const wash = [[0.9, 0.9, 0.88], [0.3, 0.45, 0.7], [0.85, 0.35, 0.3], [0.95, 0.85, 0.45], [0.5, 0.65, 0.5], [0.95, 0.7, 0.75], [0.25, 0.25, 0.3]];
		for (let k = 0; k < 9; k++) { const w = 0.35 + (k * 37 % 5) * 0.1, h = 0.35 + (k * 53 % 4) * 0.12; parts.push(B(w, h, 0.01, -2 + (k % 3) * 1.5 + (k * 29 % 7) * 0.08, 1.86 - h, [-0.4, 0, 0.4][Math.floor(k / 3)], wash[k % wash.length])); }
		const lineG = mergeGeometries(parts);
		const M = (o) => withRise(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), rise, 'kitrise');
		const mkK = (geo, material, cap) => { const im = new THREE.InstancedMesh(geo, material, cap); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; group.add(im); return im; };
		const glassM = withRise(new THREE.MeshStandardMaterial({ color: 0xa9c4cf, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.35, depthWrite: false }), rise, 'kitrise');
		return {
			ac: mkK(ac, M({ roughness: 0.55, metalness: 0.35 }), 12000),
			sunF: mkK(sunF, M({ roughness: 0.5 }), 3000), sunG: mkK(sunG, glassM, 3000),
			line: mkK(lineG, M({ roughness: 0.9, side: THREE.DoubleSide }), 3000),
		};
	})();
	// trees. Up close and in the middle distance, the island's own leaf-card trees in the
	// Bay Area's street species: London plane and sycamore (round), coast live oak (low
	// and spreading), redwood and cypress (columnar), and yard shrubs. Far off, where a
	// crown is a few pixels, a smooth lumpy mass stands in.
	const TCAP = PHONE ? 26000 : 40000;
	const leafTex = TX.leafCluster();
	const barkT = TX.woodBark(); barkT.repeat.set(2, 3);
	const SPECIES = [
		{ height: 11, crown: 'round', bark: [1.12, 1.08, 1.0], leaf: [1.1, 1.05, 0.85] },      // plane, sycamore, elm
		{ height: 9, crown: 'oak', bark: [0.75, 0.72, 0.7], leaf: [0.6, 0.72, 0.58] },  // coast live oak: a dark, dense dome
		{ height: 36, crown: 'columnar', bark: [1.05, 0.62, 0.45], leaf: [0.55, 0.72, 0.6], conifer: true }, // redwood, Douglas-fir, cypress, pine
	];
	const LEAF_REF = [0.25, 0.35, 0.15];
	// the detail levels and where they hand over (metres): each dissolves into the next
	// across a band rather than popping; the far masses dissolve out at the edge
	// (pushed well out, so the hand-overs happen where a tree is small on screen, and the far
	// masses carry the woodland out to where the ground's own painted woods take over)
	// (a phone keeps the leafy middle tier nearer: the far masses take over sooner, and cheaply)
	const LOD = PHONE ? { near: [NONE_IN[0], NONE_IN[1], 150, 175], mid: [150, 175, 430, 470], far: [430, 470, 2000, 2400], shrub: [NONE_IN[0], NONE_IN[1], 260, 300] }
		: { near: [NONE_IN[0], NONE_IN[1], 185, 215], mid: [185, 215, 560, 610], far: [560, 610, 2400, 2800], shrub: [NONE_IN[0], NONE_IN[1], 360, 410] };
	const MARGIN = 45;                                        // the trees are re-placed every 40 m of travel
	const tierMesh = (parts, cap, shadow, band, kind = 3) => {
		// each tier its own materials, so each can carry its own band
		const mats = [swayMaterial({ map: barkT, roughness: 0.95 }, shared, 1), swayMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8)];
		for (const M of mats) addLodFade(M.material, 'uniform', band);
		// photographed bark (with its relief) once it loads; lichen on the oaks' trunks
		usePhoto(mats[0].material, [['bark', [2, 3], { mean: 0.8, contrast: 1.2, normal: 3 }, 0.9]]);
		mossify(mats[0].material, kind);
		if (kind === 1) lichenLeaves(mats[1].material);
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
		const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 64, 64);
		const d = g.getImageData(0, 0, 64, 64).data, a = [0, 0, 0]; let n = 0;
		const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
		for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 115) { a[0] += lin(d[i]); a[1] += lin(d[i + 1]); a[2] += lin(d[i + 2]); n++; }
		return a.map((v) => v / Math.max(1, n));
	})();
	const treeTiers = SPECIES.map((g, k) => {
		const make = g.conifer ? conifer : hardwood;
		const nearT = make(9101 + k * 17, false, false, g), midT = make(9101 + k * 17, false, true, g);
		const leafGeo = midT.parts[1];
		// (the impostor's square spans the tree's height or its width, whichever is more)
		const bbAll = new THREE.Box3().setFromBufferAttribute(leafGeo.attributes.position).union(new THREE.Box3().setFromBufferAttribute(midT.parts[0].attributes.position));
		const sizeK = Math.max(bbAll.max.y - Math.max(0, bbAll.min.y), bbAll.max.x - bbAll.min.x, bbAll.max.z - bbAll.min.z) / 0.98 / midT.height;
		return { sizeK, near: tierMesh(nearT.parts, 2600, true, LOD.near, k), mid: tierMesh(midT.parts, 12000, false, LOD.mid, k), H: nearT.height, Hm: midT.height };
	});
	const shrubT = shrub(9301), shrubs = tierMesh(shrubT.parts, PHONE ? 5000 : 9000, true, LOD.shrub);
	// sword ferns on the shady forest floor (under the redwoods, on the north slopes, in the draws)
	const fernT = fern(9331, { tint: [0.85, 1.05, 0.8], size: 1.1 }), ferns = [(() => { const S = swayMaterial({ side: THREE.DoubleSide, roughness: 0.8, near: { r: 1.6, cap: 1.2 } }, shared, 0.6); addLodFade(S.material, 'uniform', LOD.shrub); const im = new THREE.InstancedMesh(fernT.parts[0], S.material, PHONE ? 3000 : 7000); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((PHONE ? 3000 : 7000) * 3), 3); group.add(im); return im; })()];
	// the far tier: one point per tree, drawn as its species' impostor
	const atlasCv = document.createElement('canvas');
	atlasCv.width = IMP * 3; atlasCv.height = IMP;
	SPECIES.forEach((g, k) => atlasCv.getContext('2d').drawImage(treeImpostor((g.conifer ? conifer : hardwood)(9101 + k * 17, false, true, g).parts, texAvg), k * IMP, 0));
	const atlas = new THREE.CanvasTexture(atlasCv);
	atlas.colorSpace = THREE.SRGBColorSpace; atlas.generateMipmaps = true; atlas.minFilter = THREE.LinearMipmapLinearFilter;
	const fp = { pos: new Float32Array(TCAP * 3), size: new Float32Array(TCAP), sp: new Float32Array(TCAP), tint: new Float32Array(TCAP * 3) };
	const farGeo = new THREE.BufferGeometry();
	farGeo.setAttribute('position', new THREE.BufferAttribute(fp.pos, 3));
	farGeo.setAttribute('aSize', new THREE.BufferAttribute(fp.size, 1));
	farGeo.setAttribute('aSp', new THREE.BufferAttribute(fp.sp, 1));
	farGeo.setAttribute('aTint', new THREE.BufferAttribute(fp.tint, 3));
	farGeo.setDrawRange(0, 0);
	const farMat = new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: atlas }, uScale: { value: 400 }, uSunC: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uSunD: { value: new THREE.Vector3() }, uBand: { value: new THREE.Vector4(...LOD.far) } }]),
		vertexShader: IMPOSTOR_VERT, fragmentShader: IMPOSTOR_FRAG, fog: true,
	});
	farMat.uniforms.uAtlas.value = atlas;
	const farPts = new THREE.Points(farGeo, farMat);
	farPts.frustumCulled = false;
	farPts.onBeforeRender = (r, sc2, cam) => {
		// point size in pixels for a tree a metre tall at a metre away
		farMat.uniforms.uScale.value = r.getSize(tmpV2).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
		farMat.uniforms.uSunC.value.copy(shared.uSunColor.value); farMat.uniforms.uAmb.value.copy(shared.uAmbient.value); farMat.uniforms.uSunD.value.copy(shared.uSunDir.value);
	};
	const tmpV2 = new THREE.Vector2();
	group.add(farPts);

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
		// (a house not quite square to its street: turned about its lot, with its garage and drive)
		let X = x, Z = z;
		if (opt?.rot && opt.pw) { const c = Math.cos(opt.rot), s2 = Math.sin(opt.rot), dx = x - opt.pw[0], dz = z - opt.pw[1]; X = opt.pw[0] + c * dx - s2 * dz; Z = opt.pw[1] + s2 * dx + c * dz; ang += opt.rot; }
		if (face === 'n') ang += Math.PI;
		else if (face === 'e' || face === 'w') { ang += face === 'e' ? -Math.PI / 2 : Math.PI / 2; const t = w; w = d; d = t; }
		const o = opt?.lift ? { x: X, y: g + opt.lift, z: Z, w, d, h, a: ang, col, kind, roof: null } : flat ? { x: X, y: g - 0.9, z: Z, w, d, h: 0.98, a: ang, col, kind, roof: null } : { x: X, y: g - 1.2, z: Z, w, d, h: h + 1.2, a: ang, col, kind, roof };
		o.age = ageFor(style, kind, x, z);
		list.push(o);
		if (!flat && !opt?.lift && !list.noGrounds && (kind === KIND.office || kind === KIND.retail || kind === KIND.industry)) grounds(list, list.trees || (list.trees = []), x, z, w, d, ang, g, g - 1.2, kind, gx * 0.31 + gz * 0.17);
		return o;
	}
	// how weathered a building is (weathering.js): how old its kind and district tend to be
	// (the Victorians and the warehouses old, the towers and the new subdivisions young), its
	// own roll, and the neighbourhood's
	function ageFor(style, kind, x, z) {
		let a = kind === KIND.tower ? 0.15 : kind === KIND.office ? 0.25 : kind === KIND.industry ? 0.75 : [0.62, 0.5, 0.58, 0.3, 0.25, 0.72, 0.35][style] ?? 0.4;
		if (style === STYLE.suburb && kind !== KIND.retail) a = [0.45, 0.4, 0.12, 0.42][eraFor(x, z, hash(x * 0.13, z * 0.17))] ?? a;
		return Math.min(1, Math.max(0, a + (hash(x * 0.37, z * 0.53) - 0.5) * 0.35 + (vnoise(x / 900, z / 900) - 0.5) * 0.3));
	}
	// what grounds a building that isn't a house: a paved apron round it with a kerb, a
	// dark stone plinth (in the shader), planters at the entrance with shrubs, and trees
	// along its sides (more round a tower, fewer round a shed). The same for the mapped,
	// the generated and the gridded buildings, so none stands bare on a lawn.
	function grounds(list, trees, x, z, w, d, a, g, y0, kind, seed) {
		const big = kind === KIND.tower, pad = big ? 5 : kind === KIND.office ? 3.2 : 2;
		const ca = Math.cos(a), sa = Math.sin(a);
		const P = (lx, lz) => [x + ca * lx - sa * lz, z + sa * lx + ca * lz];
		const h1 = hash(seed, 3.7), h2 = hash(seed + 1.3, 9.1);
		// the apron, a hand's breadth above the ground, and its kerb
		list.push({ x, y: y0, z, w: w + 2 * pad, d: d + 2 * pad, h: g + 0.13 + h1 * 0.05 - y0, a, col: jit([0.66, 0.64, 0.6], h1), kind: KIND.plain, roof: null });
		list.push({ x, y: y0, z, w: w + 2 * pad + 0.5, d: d + 2 * pad + 0.5, h: g + 0.1 - y0, a, col: [0.5, 0.49, 0.47], kind: KIND.plain, roof: null });
		if (kind === KIND.industry) return;
		// planters either side of the entrance (the +d face), shrubs in them
		for (const s of [-1, 1]) {
			const [px, pz] = P(s * Math.min(w / 2 - 1.5, 4 + w * 0.15), d / 2 + pad * 0.55);
			list.push({ x: px, y: g - 0.2, z: pz, w: big ? 4.2 : 2.8, d: 1.3, h: 0.75, a, col: jit([0.55, 0.52, 0.48], h2), kind: KIND.plain, roof: null });
			for (const o of [-0.8, 0, 0.8]) { const [sx, sz] = P(s * Math.min(w / 2 - 1.5, 4 + w * 0.15) + o * (big ? 1.4 : 0.9), d / 2 + pad * 0.55); trees.push({ x: sx, y: g + 0.5, z: sz, h: 0.9 + hash(sx, sz) * 0.5, shrub: true, col: jit(pick(PAL.crown, hash(sz, sx)), h1) }); }
		}
		// trees along the sides, at the apron's edge
		const every = big ? 9 : 12, sides = big ? [[w, d, 1], [w, d, -1], [d, w, 2], [d, w, -2]] : kind === KIND.office ? [[w, d, 1], [w, d, -1]] : [[w, d, 1]];
		for (const [len, dep, sd] of sides) for (let t = -len / 2 + 3; t <= len / 2 - 3; t += every) {
			if (Math.abs(sd) === 1 && sd > 0 && Math.abs(t) < Math.min(w / 2 - 1.5, 4 + w * 0.15) + 3) continue;     // the entrance kept clear
			const off = dep / 2 + pad - 1.2, [tx, tz] = Math.abs(sd) === 1 ? P(t, Math.sign(sd) * off) : P(Math.sign(sd) * off, t);
			const r = hash(tx * 0.7, tz * 1.3);
			trees.push({ x: tx, y: g - 0.3, z: tz, h: 7 + r * 4, cone: false, col: jit(pick(PAL.crown, r), r) });
		}
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
				// not in a lake, a reservoir or a creek (bay/water.js)
				if ([[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].some(([u, v]) => { const [x, z] = fromGrid((i + u) * BX, (j + v) * BZ, a, style); return inWater(x, z); })) continue;
				// not on the ocean beach: low ground with the Pacific a block away is sand and dune
				// (the bay shore keeps its waterfront)
				if (ground < 5 && wx < OCEAN_X && Math.min(bay.heightAt(wx - 120, wz), bay.heightAt(wx + 120, wz), bay.heightAt(wx, wz - 120), bay.heightAt(wx, wz + 120)) < 0.2) continue;
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
					// the block paved between the towers: plazas and service yards, not lawn
					lot(list, a, style, X0 + IX / 2, Z0 + IZ / 2, IX, IZ, 0.4, KIND.paved, jit([0.47, 0.46, 0.44], hash(i * 5 + 1, j * 7 + 2)), null, 0.9);
					// street trees in grates along the block's pavements
					if (!list.noGrounds) {
						const TT = list.trees || (list.trees = []);
						for (let t = 5; t < IX - 3; t += 10) for (const e of [1.6, IZ - 1.6]) { const [x, z] = fromGrid(X0 + t, Z0 + e, a, style), g = bay.heightAt(x, z), rr = hash(x, z); if (g > 0.8) TT.push({ x, y: g - 0.3, z, h: 7 + rr * 3, cone: false, col: jit(pick(PAL.crown, rr), rr) }); }
					}
					for (let k = 0; k * L < IX; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						// (steeply down from the core: a few towers at the centre, mid-rise round them)
						let h = 10 + Math.pow(r, 3) * U.d * U.d * U.d * 300 + U.d * U.d * 48;
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
				const pave = (gx, gz, w, d, kind = KIND.paved, col = [0.25, 0.25, 0.26], O = null) => lot(list, a, style, gx, gz, w, d, 0.25 - 1.2 + 1.35, kind, col, null, 0.9, O?.rot ? { rot: O.rot, pw: O.pw } : null);
				// close in, each house gets its porch, walk, shrubs and back fences
				const detail = Math.hypot(wx - cx, wz - cz) < 480;
				// the back fences of a lot from x0 to x1: its left side line (the neighbour has the
				// right), and the back line on one side of the block; at(m) is depth into the block
				// (of all kinds: cedar, weathered grey boards, white vinyl, a block wall, chain link, dark stain)
				const fences = (x0, x1, at, m0, m1, side, r) => {
					if (m1 - m0 < 2) return;
					const F = FENCES[Math.floor(hash(r * 97.1, i + j * 3) * FENCES.length)];
					const fc = jit(F, r), th = F[4];
					lot(list, a, style, x0, at((m0 + m1) / 2), th, m1 - m0, F[3], KIND.plain, fc, null);
					if (!side) lot(list, a, style, (x0 + x1) / 2, at(m1), x1 - x0, th, F[3], KIND.plain, fc, null);
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
				// ---------- the lived-in blocks (older towns and suburbs) ----------
				const props = list.props || (list.props = {});
				let bAngV = null;
				const bAng = () => { if (bAngV === null) { const [x1, z1] = fromGrid(X0, Z0 + IZ / 2, a, style), [x2, z2] = fromGrid(X0 + 10, Z0 + IZ / 2, a, style); bAngV = Math.atan2(z2 - z1, x2 - x1); } return bAngV; };
				// one of the props (lotkit.js) at a grid point, turned to face a street (+ yaw)
				const prop = (k, gx, gz, face, yaw = 0, sc = 1, c = null, lift = 0, tilt = 0) => {
					if (!detail || !kit2.has(k)) return;
					const [x, z] = fromGrid(gx, gz, a, style), g = bay.heightAt(x, z);
					if (g < 0.8) return;
					const e = [x, g + lift, z, bAng() + FACE_A[face] + yaw, ...(typeof sc === 'number' ? [sc, sc, sc] : sc), tilt];
					if (c) e.push(c[0], c[1], c[2]);
					(props[k] || (props[k] = [])).push(e);
				};
				// a run of fence panels (props) from one grid point to another
				const fenceRun = (k, x0, z0, x1, z1, sy = 1) => {
					const L2 = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L2 / 2.4)), f = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 's' : 'e';
					for (let m = 0; m < n; m++) prop(k, x0 + (x1 - x0) * (m + 0.5) / n, z0 + (z1 - z0) * (m + 0.5) / n, f, 0, [L2 / n / 2.4, sy, 1]);
				};
				const weeds = (x0, x1, z0, z1, n, seed) => { if (!detail) return; for (let m = 0; m < n; m++) { const [x, z] = fromGrid(x0 + hash(m, seed * 3 + i) * (x1 - x0), z0 + hash(seed + m * 7, j) * (z1 - z0), a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.2, z, h: 0.8 + hash(m * 3, seed) * 1.4, shrub: true, col: jit([0.32, 0.34, 0.17], hash(m, seed)) }); } };
				const lawn = (gx, gz, w, d, c, face) => lot(list, a, style, gx, gz, w, d, 0.34, KIND.plain, c, null, false, { face, lift: -0.3 });
				const rolls = (k, side) => (n) => hash(k * 7.7 + n * 3.1 + side * 1.3, i * 13 + j * 7 + n * 0.7);
				// out front and out back: the walk, the porch, the fences, the cars and bins, the AC
				// unit; a pool on its deck, a shed, a cottage, raised beds; and on the run-down
				// ones, dead lawn, weeds and a car left to sit
				const yard = (c) => {
					const { lotX, Lw, side, face, at, r, k, x: hx, w, d, hf, setback, gx, gw, gs, dw, dx0, pad, big, cnd, col, rc, door, O, SY } = c, R2 = rolls(k + 50, side);
					const dx = hx + (side ? 1 : -1) * (door - 0.5) * (w - 2.5);
					const back = hf + d, room = IZ / 2 - back;
					let pool = false;
					if (detail) {
						pave(dx, at(hf / 2), 1.1, hf, KIND.plain, [0.7, 0.69, 0.65], O);
						if (c.porch) {
							lot(list, a, style, dx, at(hf - 0.8), 2.6, 1.8, 0.22, KIND.plain, rc, null, false, { ...O, lift: 2.6 });
							if (c.modern || r > 0.5) for (const e of [-1, 1]) lot(list, a, style, dx + e * 1.15, at(hf - 1.55), 0.2, 0.2, 2.6, KIND.plain, [0.92, 0.91, 0.88], null, false, O);
						}
						fences(lotX, lotX + Lw, at, hf + d * 0.55, IZ / 2, side, r);
						if (!cnd) shrubs(hx, at(hf - 0.9), w, dx, r);
						if (gw > 0) {
							if (!cnd && R2(1) < 0.55) prop('car', gx - gs * gw / 4, at(setback * 0.45), face, (R2(2) - 0.5) * 0.08, 1, pick(CARS, R2(3)));
							if (!cnd && R2(1) < 0.2 && gw > 5) prop('car', gx + gs * gw / 4, at(setback * 0.4), face, (R2(4) - 0.5) * 0.1, 1, pick(CARS, R2(5)));
							if (pad && R2(6) < 0.4) prop(R2(7) < 0.55 ? 'rv' : 'boat', dx0 - gs * (dw / 2 - 1.35), at(4.4), face);
							if (!cnd && R2(9) < 0.07) prop('hoop', gx + gs * (gw / 2 - 0.3), at(setback + 0.15), face);
						}
						if (!cnd && R2(8) < 0.35) prop('bins', (gw > 0 ? dx0 + gs * (dw / 2 + 1.1) : lotX + 1.6), at(0.7), face);
						if (R2(10) < 0.6) prop('cond', hx - gs * (w / 2 + 0.7), at(hf + d * 0.6), face);
						if (room > 11 && R2(11) < (big ? 0.85 : c.pools)) {
							pool = true;
							const pl = big ? 12 : 8.5, pwd = big ? 5.5 : 4.2, pz = back + 3.2 + pwd / 2, px = hx + (R2(12) - 0.5) * Math.max(0, w - pl) * 0.8;
							lot(list, a, style, px, at(pz), pl + 2.8, pwd + 2.8, 0.36, KIND.plain, jit([0.8, 0.77, 0.7], R2(12)), null, false, { face, lift: -0.3 });
							const PL = lot(list, a, style, px, at(pz), pl, pwd, 0, KIND.pool, [0.9, 0.89, 0.85], null, 0.9, { face });
							if (PL) PL.dec = true;
							if (big) { prop('cabana', px + (pl / 2 + 3.2) * (R2(13) < 0.5 ? 1 : -1), at(pz), face); for (let n = 0; n < 3; n++) prop('lounger', px - pl / 2 + 2 + n * 1.3, at(pz + pwd / 2 + 1.5), face, Math.PI); }
							else if (R2(13) < 0.6) prop('lounger', px - pl / 4, at(pz + pwd / 2 + 1.4), face, Math.PI);
						}
						if (room > 9 && R2(14) < (big ? 0.6 : 0.2)) lot(list, a, style, gs > 0 ? lotX + 2.2 : lotX + Lw - 2.2, at(IZ / 2 - 2.6), 2.8, 2.4, 2.3, KIND.garage, R2(15) < 0.5 ? [0.6, 0.55, 0.45] : jit(col, R2(15)), { hip: false, rot: true, h: 0.9, col: rc, t: R2(15) < 0.3 ? ROOF.metal : ROOF.shingle, ov: 0.2, trim: 3 }, false, { face });
						if (room > 15 && R2(16) < (big ? 0.5 : c.adu)) setCond(lot(list, a, style, gs > 0 ? lotX + Lw - SY - 3.4 : lotX + SY + 3.4, at(IZ / 2 - 4.3), 6.2, 6.4, 3.2, doorKind(KIND.house, 0.5), jit(col, R2(17)), { hip: R2(17) < 0.5, h: 1.6, col: rc, t: ROOF.shingle, ov: 0.4 }, false, { face: face === 's' ? 'n' : 's' }), cnd);
						if (room > 8 && R2(18) < 0.09) for (let n = 0; n < 2; n++) prop('bed', hx + (n - 0.5) * 2.4, at(IZ / 2 - 2.2), face);
						if (cnd) {
							lawn(lotX + Lw / 2, at(hf / 2), Lw - 1, hf - 0.6, jit([0.46, 0.41, 0.27], r), face);
							weeds(lotX + 1, lotX + Lw - 1, at(0.8), at(hf - 0.8), 10, k * 7 + side);
							if (R2(19) < 0.45) prop('car', gw > 0 ? gx : hx, at(setback * 0.5), face, (R2(20) - 0.5) * 0.5, [1, 0.94, 1], pick(FADED, R2(21)), -0.09, 0.03);
						}
					}
					// yard trees: a front tree and one or two out back, bigger in the older places
					if (hash(k + 1, side + i * 3) < c.treeK * 0.6) tree(hx - gs * (w * 0.3), at(2.5), c.treeH * (0.7 + r * 0.6), false, r * 3.1 % 1);
					if (hash(k + 5, side + j * 7) < c.treeK) tree(hx + (r - 0.5) * 6, at(pool ? IZ / 2 - 3 : back + 7), c.treeH * (0.8 + r * 0.7), r > 0.82, r * 5.7 % 1);
					if (big) for (let n = 0; n < 3; n++) tree(lotX + 3 + hash(n, k + i) * (Lw - 6), at(IZ / 2 - 2 - hash(k, n + j) * 4), c.treeH * 1.1, n === 2, hash(n * 5, k));
				};
				// a suburban house: the tract's, or an estate on a double lot, or a skinny infill
				const suburbHome = (c, T) => {
					const { lotX, Lw, face, at, r, rw, k, side } = c, { era, modern, eich, big, thin } = T, R = rolls(k, side);
					const remodel = R(3) < 0.14, rr = R(0);
					const col = jit(remodel ? pick(REMODEL, rw * 7.3 % 1) : T.walls[Math.floor(r * 4)], r);
					const rc = jit(rr < 0.1 || (remodel && rr < 0.5) ? pick(T.roofsAll, rr * 10 % 1) : T.roofs[r > 0.8 ? 1 : 0], rr).map((v) => v * (0.9 + ((rr * 13.7) % 1) * 0.16));
					const rt = remodel && rr < 0.3 ? ROOF.shingle : T.roofT;
					const across = modern || thin;
					const setback = (modern ? 6 : 8) + (R(1) - 0.5) * (modern ? 1.5 : 3.2) + (big ? 5 : 0), SY = 1.1 + R(2) * 1.8;
					const two = big || thin || (modern ? r > 0.12 : era === ERA.seventies ? r > 0.5 : era === ERA.ranch ? r > 0.9 : false);
					const h = two ? 6.4 : 3.3, gs = r > 0.5 ? 1 : -1;
					const gw = big ? 9.4 : thin ? 3.6 : modern && r > 0.7 ? 8.8 : 6.2;
					const avail = Lw - 2 * SY;
					const w = big ? Math.min(avail - gw - 3, 15 + r * 9) : across ? avail - ((r * 2.9) % 1) * 1.5 : avail - gw - ((r * 2.9) % 1) * 1.8;
					if (w < 5) return;
					const d = big ? 14 + r * 5 : modern ? 12 + ((r * 5.3) % 1) * 3 : 10 + ((r * 5.3) % 1) * 3;
					const hf = across ? setback + 3 : setback + 1.5;
					const hx = across ? lotX + Lw / 2 : big ? lotX + Lw / 2 - gs * (gw + 1) / 2 : lotX + SY + (gs > 0 ? w / 2 : gw + w / 2);
					const gx = big ? hx + gs * (w / 2 + 0.5 + gw / 2) : gs > 0 ? lotX + Lw - SY - gw / 2 : lotX + SY + gw / 2;
					const roofH = eich ? 0.9 : Math.min(w, d) * (modern ? 0.3 : era === ERA.ranch ? 0.2 : 0.26) * (big ? 1.15 : 1);
					const door = modern ? (gs > 0 ? 0.28 : 0.72) : 0.35 + ((r * 3.3) % 1) * 0.3;
					const ov = eich ? 0.95 : era === ERA.ranch ? 0.65 : 0.45;
					const roof = { hip: modern || big || (era === ERA.ranch && r > 0.4), h: roofH, col: rc, t: rt, ov };
					// not every house square to its street (the older tracts least of all)
					const rot = R(4) < (modern ? 0.12 : 0.4) ? (R(5) - 0.5) * (modern ? 0.05 : 0.1) : 0;
					const O = { face, rot, pw: rot ? fromGrid(lotX + Lw / 2, at(hf + d / 2), a, style) : null };
					// a second storey popped up over part of an old one-storey house
					const pop = !two && w > 11 && R(6) < 0.1, w1 = pop ? w * 0.56 : w;
					const H = lot(list, a, style, pop ? hx - gs * (w - w1) / 2 : hx, at(hf + d / 2), w1, d, h, doorKind(KIND.house, pop ? Math.min(0.75, Math.max(0.25, door)) : door), col, roof, false, O);
					if (!H) return;
					const cnd = condFor(H, T.neglectK);
					setCond(H, cnd);
					if (pop) setCond(lot(list, a, style, hx + gs * w1 / 2, at(hf + d / 2 + 0.6), w - w1, d - 1.2, 6.4, KIND.house, col, { ...roof, hip: true, h: Math.min(w - w1, d) * 0.28 }, false, O), cnd);
					// an addition out the back
					if (R(7) < 0.13 && !eich) setCond(lot(list, a, style, hx + (R(2) - 0.5) * w * 0.4, at(hf + d + 2.2), Math.min(w * 0.5, 7), 4.6, 3.1, KIND.house, remodel ? col : jit(col, R(7) * 7 % 1), { hip: false, rot: true, h: 1.3, col: rc, t: R(7) < 0.05 ? ROOF.metal : rt, ov: 0.35 }, false, O), cnd);
					// the garage, its doors to the street (or made into a room, the drive still to it)
					const conv = !big && !modern && R(8) < 0.06;
					setCond(lot(list, a, style, gx, at(setback + 3.5), gw, 7, 3.1, conv ? KIND.house : KIND.garage, col, { hip: modern || big, h: eich ? 0.5 : 1.6, col: rc, t: rt, ov }, false, O), cnd);
					// the driveway: one car wide, two, or three with a pad to the side for the RV
					const pad = !thin && R(9) < 0.3 ? 2.8 : 0, dw = gw - 0.6 + pad, dx0 = gx - gs * pad / 2;
					pave(dx0, at(setback / 2), dw, setback, KIND.plain, jit([0.62, 0.61, 0.58], R(9)), O);
					yard({ ...c, x: hx, w, d, hf, setback, gx, gw, gs, dw, dx0, pad, big, cnd, col, rc, door, O, SY, porch: !eich, modern, pools: modern ? 0.28 : 0.2, adu: 0.06, treeK: T.treeK, treeH: T.treeH });
				};
				// an older town's house: wood, a deep porch, the drive down the side to a garage out back
				const olderHome = (c, T) => {
					const { lotX, Lw, face, at, r, k, side } = c, { big, thin } = T, R = rolls(k, side);
					const w = big ? Math.min(Lw - 6, 12 + r * 5) : thin ? Lw - 1.6 : Math.min(Lw - 3.6, 7.6 * Lw / 12 + r * 2), d = big ? 14 + r * 4 : 10 + ((r * 7.7) % 1) * 4;
					const h = big || thin || r > 0.55 ? 6.4 : 3.6;
					const col = jit(pick(PAL.older, hash(i + k * 13, j * 7 + side)), r);
					const rc = pick(PAL.olderRoof, hash(i * 3 + k, j + side * 5));
					const gs = r > 0.5 ? 1 : -1;
					const cx = thin ? lotX + Lw / 2 : lotX + Lw / 2 - gs * (Lw - w - 3) / 2;
					const hf = 6 + (R(1) - 0.5) * 3 + (big ? 3 : 0);
					const door = 0.25 + ((r * 3.3) % 1) * 0.5;
					const rot = R(4) < 0.45 ? (R(5) - 0.5) * 0.12 : 0;
					const O = { face, rot, pw: rot ? fromGrid(cx, at(hf + d / 2), a, style) : null };
					const H = lot(list, a, style, cx, at(hf + d / 2), w, d, h, doorKind(KIND.house, door), col, { hip: big || r > 0.8, rot: r < 0.3 && !big, h: Math.min(w, d) * (0.42 + (R(6) - 0.5) * 0.2), col: rc, t: T.roofT, ov: 0.45 }, false, O);
					if (!H) return;
					const cnd = condFor(H, T.neglectK);
					setCond(H, cnd);
					if (R(7) < 0.15) setCond(lot(list, a, style, cx + (R(2) - 0.5) * w * 0.3, at(hf + d + 2), Math.min(w * 0.6, 6), 4.2, 3.2, KIND.house, jit(col, R(7) * 5 % 1), { hip: false, rot: true, h: 1.2, col: rc, t: R(7) < 0.06 ? ROOF.metal : T.roofT, ov: 0.3 }, false, O), cnd);
					const dx = cx + (side ? 1 : -1) * (door - 0.5) * (w - 2.5);
					const gx = lotX + Lw / 2 + gs * (Lw / 2 - 1.9);
					if (detail) {
						// the porch: a roof on posts across much of the front, a rail between, steps
						const pw = w * (0.5 + r * 0.3);
						lot(list, a, style, dx, at(hf - 1.2), pw, 2.6, 0.25, KIND.plain, rc, null, false, { ...O, lift: 2.7 });
						for (const e of [-1, 1]) lot(list, a, style, dx + e * (pw / 2 - 0.2), at(hf - 2.3), 0.22, 0.22, 2.7, KIND.plain, [0.9, 0.89, 0.85], null, false, O);
						if (R(10) < 0.6) for (const e of [-1, 1]) lot(list, a, style, dx + e * (pw / 4 + 0.35), at(hf - 2.3), pw / 2 - 1.3, 0.08, 0.95, KIND.plain, [0.9, 0.89, 0.85], null, false, O);
						// the front fence: pickets, a low chain link, or nothing
						if (R(11) < 0.25) for (const [f0, f1] of thin ? [[lotX + 0.3, lotX + Lw - 0.3]] : [[lotX + 0.3, gx - 1.6], [gx + 1.6, lotX + Lw - 0.3]]) if (f1 - f0 > 1) fenceRun('picket', f0, at(0.5), f1, at(0.5));
						else if (R(11) < 0.33) lot(list, a, style, lotX + Lw / 2, at(0.5), Lw - 3.4, 0.05, 1.1, KIND.plain, [0.55, 0.56, 0.57], null, false, { face });
						if (!thin) {
							pave(gx, at(12), 2.8, 24, KIND.plain, [0.56, 0.55, 0.52]);
							if (r > 0.3) setCond(lot(list, a, style, gx - gs * 0.6, at(hf + d + 6), 3.6, 6, 2.8, R(12) < 0.1 ? doorKind(KIND.house, 0.5) : KIND.garage, jit(col, r * 3.1 % 1), { hip: false, h: 1.3, col: rc, t: T.roofT, ov: 0.3 }, false, { face }), cnd);
							if (!cnd && R(13) < 0.45) prop('car', gx, at(hf + 1 + R(14) * 4), face, (R(14) - 0.5) * 0.05, 1, pick(CARS, R(15)));
							if (!cnd && R(13) > 0.97) prop(R(15) < 0.5 ? 'rv' : 'boat', gx, at(hf + 6), face);
						}
					}
					yard({ ...c, x: cx, w, d, hf, setback: hf, gx, gw: 0, gs, dw: 0, dx0: gx, pad: 0, big, cnd, col, rc, door, O, SY: 1, porch: false, modern: false, pools: 0.06, adu: 0.13, treeK: 1, treeH: 12 });
					if (k % 2 === 0) tree(lotX + Lw / 2, side ? Z0 + IZ + 1.9 : Z0 - 1.9, 9 + r * 6, false, r);
				};
				const home = (c, T) => (T.sub ? suburbHome(c, T) : olderHome(c, T));
				// an empty lot: dirt or dry grass, weeds, a sign up now and then
				const vacant = (c) => {
					const { lotX, Lw, face, at, r, k, side } = c;
					lawn(lotX + Lw / 2, at(IZ / 4), Lw - 0.6, IZ / 2 - 1, r * 7.1 % 1 < 0.5 ? jit([0.5, 0.42, 0.32], r) : jit([0.47, 0.44, 0.27], r), face);
					if (hash(r * 31, 7) < 0.55) prop('sign', lotX + Lw * 0.3, at(1.6), face);
					weeds(lotX + 1, lotX + Lw - 1, at(1), at(IZ / 2 - 2), 14, k * 5 + side);
					if (r * 3.3 % 1 < 0.5) tree(lotX + Lw * 0.6, at(IZ / 3), 8 + r * 5, false, r);
				};
				// balconies across a front, one to each unit above the ground floor (the facade's
				// sliders are on the odd bays); lift = floor height; the flats' own storey
				const balconies = (gxC, gzC, W, D, face, floors, storey, c, first = 1, pitch = 7.2, off = 1.5) => {
					if (!detail) return;
					const [ux, uz] = LX[face], [nx, nz] = NZ[face], ew = face === 's' || face === 'n';
					for (let f = first; f < floors; f++) for (let m = 0; (m + 0.5) * pitch + off * 3.6 - 1.8 <= W - 1.6; m++) {
						const fxc = m * pitch + off * 3.6;
						const bw = fract(fxc / 25.2);
						if (pitch > 7 && bw > 0.44 && bw < 0.56) continue;
						const bx = gxC + ux * (fxc - W / 2) + nx * (D / 2 + 0.7), bz = gzC + uz * (fxc - W / 2) + nz * (D / 2 + 0.7);
						lot(list, a, style, bx, bz, ew ? 3.0 : 1.4, ew ? 1.4 : 3.0, 1.05, KIND.plain, c, null, false, { face, lift: f * storey - 0.12 });
					}
				};
				// a small apartment building on a lot and a half (the older towns' fourplexes)
				const fourplex = (c, wc) => {
					const { lotX, Lw, face, at, r, side } = c, fl = r < 0.6 ? 2 : 3, W = Lw - 5, D = 16 + r * 5;
					const col = jit(wc, r), o = lot(list, a, style, lotX + 1.5 + W / 2, at(5 + D / 2), W, D, fl * 2.8 + 0.4, KIND.apt, col, r < 0.5 ? { hip: true, h: 1.6, col: pick(PAL.olderRoof, r * 3.3 % 1), t: ROOF.shingle, ov: 0.5 } : null, false, { face });
					setCond(o, condFor(o, 0.06));
					balconies(lotX + 1.5 + W / 2, at(5 + D / 2), W, D, face, fl, 2.8, col.map((v) => Math.min(1, v * 1.06)));
					if (detail) { pave(lotX + Lw - 1.8, at(IZ / 4), 2.8, IZ / 2 - 2, KIND.plain, [0.55, 0.54, 0.52]); pave(lotX + Lw / 2, at(IZ / 2 - 5), Lw - 1, 8, KIND.paved); prop('bins', lotX + Lw - 1.5, at(0.8), face); }
					fences(lotX, lotX + Lw, at, 5 + D, IZ / 2, side, r);
					tree(lotX + 2, at(2.5), 9 + r * 4, false, r * 1.7 % 1);
				};
				// garden apartments round a courtyard: blocks along the streets, a third wing across
				// the end, and in the middle the pool with its deck, spa, loungers, umbrellas, a
				// cabana and the grill, the clubhouse beside it; parking under carports; a gated
				// drive in, the mailbox kiosk by it; lawns, shrubs and trees
				const complex = () => {
					const q = (n) => hash(i * 5.3 + n * 1.7, j * 7.1 + n * 2.9);
					const floors = q(0) < 0.55 ? 2 : 3, bh = floors * 2.8 + 0.4;
					const col = jit(pick(PAL.suburb, q(1)), q(0)), rcol = pick(PAL.tile, q(2) * 0.99);
					const roof = { hip: true, h: 2.2, col: rcol, t: rcol[0] > rcol[2] * 1.4 ? ROOF.barrel : ROOF.flatTile, ov: 0.7, trim: q(3) < 0.5 ? 0 : 3 };
					const e = 4.5, bd = 13, entry = 18, fw = IX - 2 * e - entry;
					const balc = col.map((v) => Math.min(1, v * 1.06));
					const bldg = (gx, gz, w, d, face) => {
						const o = lot(list, a, style, gx, gz, w, d, bh, KIND.apt, col, roof, false, { face });
						setCond(o, condFor(o, 0.02));
						const ew = face === 's' || face === 'n';
						balconies(gx, gz, ew ? w : d, ew ? d : w, face, floors, 2.8, balc);
						if (detail) { const [nx, nz] = NZ[face], [ux, uz] = LX[face], W = ew ? w : d, D = ew ? d : w; for (let m = 0; m < W / 4; m++) { const [x, z] = fromGrid(gx + ux * (m * 4 + 2 - W / 2) + nx * (D / 2 + 1.2), gz + uz * (m * 4 + 2 - W / 2) + nz * (D / 2 + 1.2), a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.1, z, h: 1.0 + hash(m, gx) * 0.8, shrub: true, col: jit(pick(PAL.crown, hash(m, gz)), q(4)) }); } }
					};
					bldg(X0 + e + fw / 2, Z0 + e + bd / 2, fw, bd, 'n');
					bldg(X0 + e + fw / 2, Z0 + IZ - e - bd / 2, fw, bd, 's');
					const m0 = Z0 + e + bd + 3, m1 = Z0 + IZ - e - bd - 3, mz = (m0 + m1) / 2, band = m1 - m0;
					const west = band > 20;
					if (west) bldg(X0 + e + bd / 2, mz, bd, band - 1, 'e');
					const cx0 = X0 + e + (west ? bd + 3 : 2), cx1 = X0 + IX * 0.6, ccx = (cx0 + cx1) / 2;
					// the courtyard lawn, the deck, the pool and spa
					lawn((cx0 + cx1) / 2, mz, cx1 - cx0, band, jit([0.3, 0.46, 0.2], q(5)), 's');
					const pl = Math.min(15, (cx1 - cx0) * 0.4), pw2 = Math.min(7, band * 0.35), dk = [Math.min(cx1 - cx0 - 14, pl + 12), Math.min(band - 2, pw2 + 8)];
					lot(list, a, style, ccx, mz, dk[0], dk[1], 0.38, KIND.plain, jit([0.82, 0.78, 0.7], q(6)), null, false, { face: 's', lift: -0.3 });
					const PL = lot(list, a, style, ccx - 1, mz, pl, pw2, 0, KIND.pool, [0.9, 0.89, 0.85], null, 0.9, { face: 's' });
					if (PL) PL.dec = true;
					lot(list, a, style, ccx + pl / 2 + 2.2, mz - pw2 / 2 + 1.3, 2.6, 2.6, 0, KIND.pool, [0.86, 0.84, 0.8], null, 0.9, { face: 's' });
					if (detail) {
						for (const s2 of [-1, 1]) for (let n = 0; n < Math.floor(pl / 1.6); n++) {
							const lx = ccx - 1 - pl / 2 + 0.8 + n * 1.6;
							if (n % 3 === 2) prop('umbrella', lx, mz + s2 * (pw2 / 2 + 2.0), 's', 0, 1, pick(CANVAS, q(7 + n)));
							else prop('lounger', lx, mz + s2 * (pw2 / 2 + 1.9), s2 > 0 ? 'n' : 's');
						}
						prop('cabana', ccx - dk[0] / 2 + 2.2, mz, 'e', 0, 1, pick(CANVAS, q(8)));
						prop('bbq', ccx + dk[0] / 2 - 1.6, mz + dk[1] / 2 - 1.2, 'n');
						for (const s2 of [-1, 1]) prop('table', ccx + dk[0] / 2 - 3.5, mz + s2 * 2.2, 's');
						// the pool fence round the deck
						const fx0 = ccx - dk[0] / 2, fx1 = ccx + dk[0] / 2, fz0 = mz - dk[1] / 2, fz1 = mz + dk[1] / 2;
						fenceRun('iron', fx0, fz0, fx1, fz0); fenceRun('iron', fx0, fz1, fx1 - 2, fz1); fenceRun('iron', fx0, fz0, fx0, fz1); fenceRun('iron', fx1, fz0, fx1, fz1);
						for (const [tx, tz] of [[cx0 + 2, m0 + 2], [cx0 + 2, m1 - 2], [cx1 - 2, m0 + 2], [cx1 - 2, m1 - 2]]) tree(tx, tz, 7 + q(9) * 4, false, q(9));
					}
					// the clubhouse, facing the pool
					lot(list, a, style, cx1 + 7, mz, 11, Math.min(band - 4, 12), 4.2, KIND.office, jit(col, q(10)), { ...roof, h: 2.4 }, false, { face: 'w' });
					// the parking: carports down both sides of the lane, cars under most
					const px0 = cx1 + 14, px1 = X0 + IX - e;
					pave((px0 + px1) / 2, mz, px1 - px0, band + 4, KIND.paved);
					pave(X0 + IX - e - entry / 2, (Z0 + m0) / 2, entry - 5, m0 - Z0, KIND.plain, [0.3, 0.3, 0.31]);
					pave(X0 + IX - e - entry / 2, (m1 + Z0 + IZ) / 2, entry - 5, Z0 + IZ - m1, KIND.plain, [0.3, 0.3, 0.31]);
					if (detail) for (let x = px0 + 1.6; x < px1 - 1.5; x += 3.0) for (const [z, f] of [[m0 + 1.2, 'n'], [m1 - 1.2, 's']]) {
						prop('carport', x, z + (f === 'n' ? 1.8 : -1.8), f, 0, [1, 1, 1], [0.8, 0.79, 0.76]);
						if (hash(x, z + i) < 0.7) prop('car', x, z + (f === 'n' ? 1.8 : -1.8), f, 0, 1, pick(CARS, hash(z, x + j)));
					}
					// the gate across the drive in, the mailbox kiosk inside it
					prop('gate', X0 + IX - e - entry / 2, Z0 + 3, 's');
					prop('mailbox', X0 + IX - e - entry + 0.6, m0 - 1.2, 'e');
					for (let t = 5; t < IX - 3; t += 11) for (const ez of [1.6, IZ - 1.6]) tree(X0 + t, Z0 + ez, 8 + hash(t, ez) * 3, false, hash(t * 3, ez + i));
				};
				// townhouses in rows of four to six, garages under, little patios out back
				const townhouses = (side, at, face, wc, rcol) => {
					const len = IX - 4, uw = 6.4 + hash(i * 3, j * 5 + side) * 1.4, d = 12, fl = hash(i * 7 + side, j * 3) < 0.5 ? 2 : 3;
					const h = fl * 3.0 + 0.6, sb = 4 + hash(i, j * 9 + side) * 2;
					const tones = [wc, jit(wc, 0.9).map((v) => v * 0.9), [0.9, 0.88, 0.82]];
					let x = 2;
					for (let g = 0; x < len - uw * 3; g++) {
						const n = Math.min(Math.floor((len - x) / uw), 4 + Math.floor(hash(g * 3 + i, j + side) * 3));
						for (let u = 0; u < n; u++) {
							const gxC = X0 + x + uw * (u + 0.5), rU = hash(g * 11 + u, i * 7 + j + side);
							const o = lot(list, a, style, gxC, at(sb + d / 2 + (u % 2) * 0.6), uw + 0.02, d, h + (u % 3 === 1 ? 0.6 : 0), KIND.row + (u % 2 ? 0.1 : 0.2), jit(tones[(u + g) % 3], rU), { hip: false, rot: true, h: 2.2, col: rcol, t: ROOF.shingle, ov: 0.3 }, false, { face });
							setCond(o, condFor(o, 0.02));
							if (!detail) continue;
							pave(gxC, at(sb / 2), uw * 0.5, sb, KIND.plain, [0.64, 0.63, 0.6]);
							lawn(gxC, at(sb + d + 2.4), uw - 0.4, 4.4, [0.7, 0.68, 0.63], face);
							lot(list, a, style, gxC - uw / 2, at(sb + d + 2.4), 0.1, 4.6, 1.6, KIND.plain, [0.5, 0.42, 0.33], null, false, { face });
							lot(list, a, style, gxC, at(sb + d + 4.7), uw, 0.1, 1.6, KIND.plain, [0.5, 0.42, 0.33], null, false, { face });
							if (rU < 0.4) prop('table', gxC, at(sb + d + 2.3), face);
							if (rU > 0.7) prop('bins', gxC + uw * 0.3, at(0.7), face);
						}
						x += uw * n + 5 + hash(g, i + j) * 4;
					}
					for (let t = 4; t < IX - 3; t += 12) tree(X0 + t, at(-1.8), 7 + hash(t, side) * 3, false, hash(t, i + side));
				};
				// the neighbourhood's own: tennis and pickleball courts, a dog park, a community
				// garden, a pocket park
				const amenities = (side, at, face) => {
					const len = IX - 4, dep = IZ / 2 - 3, pa = hash(i * 13 + side, j * 17);
					const kinds = pa < 0.3 ? ['tennis', 'dog'] : pa < 0.55 ? ['pickle', 'garden', 'park'] : pa < 0.8 ? ['park', 'tennis'] : ['garden', 'dog', 'pickle'];
					const each = len / kinds.length;
					kinds.forEach((kd, n) => {
						const cx = X0 + 2 + each * (n + 0.5), cz = at(dep / 2 + 1.5);
						lawn(cx, cz, each - 1, dep, jit([0.3, 0.44, 0.2], pa + n * 0.1), face);
						if (kd === 'tennis' && each > 37.5 && dep > 19) {
							lot(list, a, style, cx, cz, 36.6, 18.3, 0, KIND.court, [0.3, 0.4, 0.3], null, 0.9, { face: 'e' });
							prop('net', cx, cz, 'e', 0, [11.9, 1, 1]);
							fenceRun('iron', cx - 18.3, cz - 9.15, cx + 18.3, cz - 9.15, 2); fenceRun('iron', cx - 18.3, cz + 9.15, cx + 18.3, cz + 9.15, 2);
							fenceRun('iron', cx - 18.3, cz - 9.15, cx - 18.3, cz + 9.15, 2); fenceRun('iron', cx + 18.3, cz - 9.15, cx + 18.3, cz + 9.15, 2);
						} else if (kd === 'pickle' || kd === 'tennis') {
							const nc = Math.max(1, Math.min(4, Math.floor((each - 2) / 10)));
							for (let m = 0; m < nc; m++) {
								const px = cx + (m - (nc - 1) / 2) * 10;
								lot(list, a, style, px, cz, 9.6, Math.min(18, dep - 1), 0, KIND.court + 0.5, [0.3, 0.4, 0.3], null, 0.9, { face: 's' });
								prop('net', px, cz, 's', 0, [6.6, 0.85, 1]);
							}
							fenceRun('iron', cx - each / 2 + 0.6, cz - dep / 2 + 0.5, cx + each / 2 - 0.6, cz - dep / 2 + 0.5, 1.6); fenceRun('iron', cx - each / 2 + 0.6, cz + dep / 2 - 0.5, cx + each / 2 - 0.6, cz + dep / 2 - 0.5, 1.6);
						} else if (kd === 'dog') {
							lawn(cx, cz, each - 3, dep - 2, jit([0.44, 0.42, 0.26], pa), face);
							fenceRun('iron', cx - each / 2 + 1.5, cz - dep / 2 + 1, cx + each / 2 - 1.5, cz - dep / 2 + 1, 0.8); fenceRun('iron', cx - each / 2 + 1.5, cz + dep / 2 - 1, cx + each / 2 - 1.5, cz + dep / 2 - 1, 0.8);
							fenceRun('iron', cx - each / 2 + 1.5, cz - dep / 2 + 1, cx - each / 2 + 1.5, cz + dep / 2 - 1, 0.8); fenceRun('iron', cx + each / 2 - 1.5, cz - dep / 2 + 1, cx + each / 2 - 1.5, cz + dep / 2 - 1, 0.8);
							for (let m = 0; m < 3; m++) prop('bench', cx - each / 4 + m * each / 4, cz + dep / 2 - 3, face);
							prop('cabana', cx + each / 4, cz, face, 0, 1, [0.55, 0.6, 0.62]);
							for (let m = 0; m < 3; m++) tree(cx + (hash(m, n + i) - 0.5) * (each - 8), cz + (hash(n, m + j) - 0.5) * (dep - 6), 8 + hash(m, n) * 5, false, hash(m * 3, n));
						} else if (kd === 'garden') {
							for (let bx = cx - each / 2 + 3; bx < cx + each / 2 - 3; bx += 2.2) for (let bz = cz - dep / 2 + 3; bz < cz + dep / 2 - 5; bz += 3.4) prop('bed', bx, bz, 's', 0, 1, jit([1, 1, 1], hash(bx, bz)));
							lot(list, a, style, cx + each / 2 - 3, cz + dep / 2 - 3, 3, 3, 2.4, KIND.garage, [0.5, 0.42, 0.3], { hip: false, h: 1, col: [0.35, 0.33, 0.3], t: ROOF.metal, ov: 0.2 }, false, { face });
							fenceRun('picket', cx - each / 2 + 1, cz - dep / 2 + 1, cx + each / 2 - 1, cz - dep / 2 + 1);
						} else {
							pave(cx, cz, 2, dep - 2, KIND.plain, [0.72, 0.7, 0.64]);
							for (let m = 0; m < 3; m++) prop('bench', cx + 2, cz + (m - 1) * 6, 'e');
							prop('table', cx - 5, cz + 3, 's'); prop('table', cx - 6, cz - 5, 's');
							for (let m = 0; m < 6; m++) tree(cx + (hash(m, n * 3 + i) - 0.5) * (each - 6), cz + (hash(n * 5, m + j) - 0.5) * (dep - 4), 8 + hash(m, n) * 6, m === 5, hash(m * 7, n));
						}
					});
				};
				// shops below, flats above with their balconies, built out to the pavement; parking behind
				const mixedUse = () => {
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.95, IZ * 0.4);
					for (const side of [0, 1]) {
						const face = side ? 's' : 'n', at = (m) => (side ? Z0 + IZ - m : Z0 + m);
						for (let x = 1, k = 0; x < IX - 8; k++) {
							const rr = hash(i * 31 + k * 5 + side, j * 29 + k), w = Math.min(IX - 1 - x, 10 + rr * 16), D = 16 + rr * 4, fl = 3 + Math.floor(rr * 2.2);
							const col = jit(pick(rr < 0.5 ? PAL.retail : PAL.sunset, rr * 7.7 % 1), rr), h = fl * 3.3 + 0.9;
							const o = lot(list, a, style, X0 + x + w / 2, at(0.6 + D / 2), w, D, h, KIND.shop, col, null, false, { face });
							setCond(o, condFor(o, 0.02));
							if (rr > 0.35) balconies(X0 + x + w / 2, at(0.6 + D / 2), w, D, face, fl, 3.3, [0.25, 0.25, 0.27], 2, 5.08, 0.85);
							if (detail && hash(k, side + i) < 0.7) { const aw = hash(i + k, j * 9 + side); lot(list, a, style, X0 + x + w / 2, at(-0.2), w * 0.86, 1.6, 0.18, KIND.plain, aw < 0.3 ? [0.55, 0.12, 0.1] : aw < 0.6 ? [0.1, 0.3, 0.2] : [0.2, 0.2, 0.2], null, false, { face, lift: 3.0 }); }
							x += w + (rr > 0.8 ? 4 : 0.02);
						}
						for (let t = 5; t < IX - 3; t += 10) tree(X0 + t, side ? Z0 + IZ + 1.6 : Z0 - 1.6, 7, false, hash(t, side + i));
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
					// a commercial strip on the arterial: shops at the back, parking in front, a pad or
					// two; or (more toward the centres) a street of shops with flats over them
					const r = hash(i * 17 + 1, j * 19 + 3);
					if (hash(i * 23 + 5, j * 7 + 1) < 0.3 + U.d * 2) { mixedUse(); continue; }
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
					for (const side of [0, 1]) for (let k = 0, skip = -1; k * L < IX - 0.1; k++) {
						if (k === skip) continue;
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						// an empty lot now and then, fenced; now and then a double lot with a bigger
						// block of flats on it
						if (r < 0.03) {
							const gz = side ? Z0 + IZ - deep / 2 : Z0 + deep / 2;
							lot(list, a, style, X0 + k * L + L / 2, gz, L - 0.3, deep - 0.6, 0.34, KIND.plain, jit([0.46, 0.42, 0.34], r), null, false, { lift: -0.3 });
							lot(list, a, style, X0 + k * L + L / 2, side ? Z0 + IZ - 0.4 : Z0 + 0.4, L - 0.2, 0.05, 1.9, KIND.plain, [0.5, 0.51, 0.52], null, false, { face: side ? 's' : 'n' });
							continue;
						}
						const dbl = k * L + 2 * L < IX - 0.1 && hash(i * 57 + k * 3 + side, j * 11 + k) < 0.07 && dist !== 'chinatown';
						if (dbl) skip = k + 1;
						const Lk = dbl ? 2 * L : L;
						let h = ({ chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, mission: 8.5 + Math.floor(r * 3) * 2.8, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8 + (r > 0.93 ? 6 : 0)) + (dbl ? 3.3 + Math.floor(r * 2) * 3.3 : 0);
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
						const so = lot(list, a, style, X0 + k * L + Lk / 2, gz, Lk + 0.02, deep, h, kind, col, roof, false, { face });
						if (dist !== 'nobhill' && dist !== 'pacheights') setCond(so, condFor(so, 0.02));
						// bay windows stacked up the front, from the first floor up
						if (style === STYLE.sf && r > 0.35 && dist !== 'nobhill' && dist !== 'chinatown' && h > 7) lot(list, a, style, X0 + k * L + Lk / 2, out(0.5), Math.min(3.6, L * 0.47), 1.4, h - 4.4, KIND.bay, col.map((c) => Math.min(1, c * 1.05)), null, false, { face, lift: 3.4 });
						// an awning over the shopfront
						if (shop && hash(k * 5 + side, i * 3 + j) < 0.75) {
							const aw = hash(i + k, j * 9 + side);
							const ac = aw < 0.25 ? [0.55, 0.12, 0.1] : aw < 0.45 ? [0.1, 0.3, 0.2] : aw < 0.6 ? [0.12, 0.18, 0.36] : aw < 0.75 ? [0.2, 0.2, 0.2] : aw < 0.88 ? [0.86, 0.6, 0.18] : [0.9, 0.88, 0.82];
							lot(list, a, style, X0 + k * L + Lk / 2, out(0.8), Lk * 0.86, 1.6, 0.18, KIND.plain, ac, null, false, { face, lift: 3.0 });
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
				} else if (style === STYLE.older || style === STYLE.suburb) {
					const sub = style === STYLE.suburb;
					// the tract (suburbs): one builder, one decade, one look; then fifty years of owners
					const ti = Math.floor(((i * BX) + 1e6) / 520), tj = Math.floor(((j * BZ) + 1e6) / 400);
					const tr = hash(ti * 7 + 3, tj * 13 + 5), era = sub ? eraFor(wx, wz, tr) : ERA.ranch;
					const wallsAll = sub ? [PAL.ranch, PAL.seventies, PAL.suburb, PAL.eichler][era] : PAL.older, roofsAll = sub ? [PAL.ranchRoof, PAL.shake, PAL.tile, PAL.flat][era] : PAL.olderRoof;
					const walls = [0, 1, 2, 3].map((n) => pick(wallsAll, hash(ti + n * 17, tj + n * 31)));
					const roofs = [0, 1].map((n) => pick(roofsAll, hash(ti * 3 + n, tj * 5 + n)));
					const modern = sub && era === ERA.modern, eich = sub && era === ERA.eichler;
					const L = !sub ? 12 : modern ? 16 : eich ? 19 : 20;
					const treeK = sub ? [0.9, 0.7, 0.3, 0.9][era] : 1, treeH = sub ? [11, 9, 5, 10][era] : 12;
					const roofT = !sub ? (hash(ti, tj * 3) < 0.15 ? ROOF.metal : ROOF.shingle) : modern ? (roofs[0][0] > roofs[0][2] * 1.4 ? ROOF.barrel : ROOF.flatTile) : eich ? ROOF.gravel : era === ERA.seventies ? ROOF.shake : ROOF.shingle;
					// (more let go out at the ragged edge of town, where it thins into the open land)
				const neglectK = (sub ? 0.04 : 0.11) * (U.u < 0.45 ? 2.2 : 1);
					// a block of garden apartments round a pool now and then (more toward the town centres)
					const br = hash(i * 41 + 7, j * 43 + 11);
					if (br < (sub ? 0.035 : 0.025) + U.d * 0.5 && IX > 80 && IZ > 55) { complex(); continue; }
					for (const side of [0, 1]) {
						const fz = side ? Z0 + IZ : Z0, inw = side ? -1 : 1, face = side ? 's' : 'n', at = (m) => fz + inw * m;
						// a row of townhouses along one side, or the neighbourhood's courts, dog park and garden
						const sr = hash(i * 47 + side * 5, j * 53 + 3);
						if (sr < (sub ? 0.045 : 0.03)) { townhouses(side, at, face, pick(wallsAll, sr * 13.1), roofs[0]); continue; }
						if (sr < (sub ? 0.065 : 0.045)) { amenities(side, at, face); continue; }
						const len = IX - (sub ? 4 : 2);
						for (let x = 0, k = 0; x < len - 6; k++) {
							const r = hash(i * 131 + k * 7 + side, j * 17 + k), rw = hash(i * 71 + k * 13 + side * 3, j * 37 + k * 5);
							// lots of their own widths: most near the tract's, now and then a double or a
							// triple lot with an estate on it, a skinny infill, an empty one
							let Lw = L * (0.86 + rw * 0.3), kind = 'house';
							if (rw < 0.05 && x + L * 2.4 < len) { Lw = L * (rw < 0.016 ? 3 : 2) * (0.95 + r * 0.1); kind = 'estate'; }
							else if (rw > 0.955) { Lw = L * (sub ? 0.62 : 0.7); kind = 'narrow'; }
							else if (r < (sub ? 0.03 : 0.05)) kind = 'vacant';
							else if (!sub && rw > 0.9 && x + L * 1.8 < len) { Lw = L * 1.7; kind = 'plex'; }
							if (len - (x + Lw) < L * 0.55) Lw = len - x;              // (the last takes what is left)
							const lotX = X0 + x;
							x += Lw;
							if (Lw < 6.5) break;
							const corner = k === 0 || x >= len - 0.1;
							const ctx = { lotX, Lw, side, face, at, r, rw, k, corner };
							if (kind === 'vacant') { vacant(ctx); continue; }
							if (kind === 'plex') { fourplex(ctx, pick(wallsAll, r * 5.1)); continue; }
							home(ctx, { sub, era, modern, eich, big: kind === 'estate', thin: kind === 'narrow', L, walls, wallsAll, roofs, roofsAll, roofT, neglectK, treeK, treeH });
						}
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
	let slotOf = new Map(), tallList = [];
	// the kit on and about the buildings within R of (cx, cz): rooftop units on the flat roofs
	// (more on a big store, a few on an office, the odd one on a shed), ducts running from
	// the biggest; a sunroom off the back (local -z) of about one house in twelve, a
	// clothesline in the back yard of about one in eight
	const FLAT = new Set([KIND.office, KIND.retail, KIND.industry, KIND.shop, KIND.tower, KIND.row, KIND.apt]);
	const ROOFED = new Set([KIND.house, KIND.houseGarageL, KIND.houseGarageR, KIND.apt]);
	const BRICK = [[0.5, 0.24, 0.18], [0.56, 0.3, 0.22], [0.44, 0.22, 0.17], [0.6, 0.36, 0.28]];
	// the height of a building's pitched roof over its own local point (lx, lz), and the slope
	// across the ridge: along the ridge ua, across it uc (sign: which side)
	function roofAt(o, lx, lz) {
		const R = o.roof, ov = R.ov ?? 0.4, rot = !!R.rot;
		const LA = (rot ? o.d : o.w) / 2 + ov, LC = (rot ? o.w : o.d) / 2 + ov;
		const ua = rot ? lz : lx, uc = rot ? lx : lz;
		let y = 1 - Math.abs(uc) / LC;
		if (R.hip) y = Math.min(y, (0.5 - Math.abs(ua) / (2 * LA)) / 0.28);
		return o.y + o.h + R.h * Math.max(0, y);
	}
	const HOUSE = new Set([KIND.house, KIND.houseGarageL, KIND.houseGarageR]);
	function decorate(list, cx, cz, R) {
		const put = [[], [], []], n0 = list.length;
		put.props = list.props || (list.props = {});
		for (let i = 0; i < n0; i++) {
			const o = list[i];
			if (Math.abs(o.x - cx) > R || Math.abs(o.z - cz) > R || (o.h < 3 && o.kind !== KIND.pool)) continue;
			const ca = Math.cos(o.a), sa = Math.sin(o.a), W = (lx, lz) => [o.x + ca * lx - sa * lz, o.z + sa * lx + ca * lz];
			const r = hash(o.x * 0.73 + 3.1, o.z * 0.61 - 1.7), area = o.w * o.d, top = o.y + o.h;
			if (!o.roof && FLAT.has(o.kind) && area > 110 && o.src?.kind !== 12 && Math.min(o.w, o.d) > 7 && o.h < 70 && !o.src?.grp) {
				// a parapet round the flat roof, capped with its coping
				const ph = 0.7 + r * 0.5, pc = o.col.map((v) => v * 0.97);
				for (const [lx, lz, w2, d2] of [[0, o.d / 2 - 0.13, o.w, 0.26], [0, -o.d / 2 + 0.13, o.w, 0.26], [o.w / 2 - 0.13, 0, 0.26, o.d - 0.5], [-o.w / 2 + 0.13, 0, 0.26, o.d - 0.5]]) { const [x, z] = W(lx, lz); list.push({ x, y: top - 0.05, z, w: w2, d: d2, h: ph + 0.05, a: o.a, col: pc, kind: KIND.parapet, roof: null, age: o.age }); }
			}
			if (!o.roof && FLAT.has(o.kind) && area > 110 && o.src?.kind !== 12 && Math.min(o.w, o.d) > 7) {
				const n = Math.max(1, Math.min(area > 4000 ? 18 : o.kind === KIND.retail || o.kind === KIND.shop ? 10 : 6, Math.round(area / (o.kind === KIND.industry ? 700 : 280) * (0.6 + r * 0.8))));
				const along = o.w > o.d, L = along ? o.w : o.d, S = along ? o.d : o.w, big = area > 1500 ? 1.6 : area > 600 ? 1.25 : 1;
				for (let k = 0; k < n; k++) {
					const u = ((k + 0.5) / n - 0.5) * (L - 5) + (hash(o.x * 0.9 + k * 7, o.z * 1.1) - 0.5) * 2, v = (hash(o.z * 0.8 + k * 5, o.x * 1.2) - 0.5) * (S - 5);
					const [x, z] = along ? W(u, v) : W(v, u);
					put[0].push([x, top, z, o.a + (along ? 0 : Math.PI / 2) + (hash(o.x * 2 + k * 13, o.z * 2) < 0.2 ? Math.PI / 2 : 0), big * (0.9 + hash(o.x + k * 11, o.z - k * 3) * 0.3)]);
				}
				// the ducts: a run from the units along the roof and down into it
				if (area > 800) {
					const [x, z] = along ? W(0, S * 0.18) : W(S * 0.18, 0);
					list.push({ x, y: top - 0.05, z, w: along ? L * 0.6 : 0.7, d: along ? 0.7 : L * 0.6, h: 0.75, a: o.a, col: [0.72, 0.73, 0.74], kind: KIND.plain, roof: null });
				}
			}
			// on the pitched roofs close by: a chimney (brick on the old houses, stucco on the
			// tile ones) or a metal flue, the plumbing vents and box vents, now and then a
			// skylight, a solar array on the sunny side, a dish; dormers on some old ones; the
			// downspouts down the corners
			const dd = (o.x - cx) * (o.x - cx) + (o.z - cz) * (o.z - cz);
			if (o.roof && ROOFED.has(Math.floor(o.kind)) && area > 30 && dd < ROOF_R * ROOF_R && o.roof.h > 0.4) {
				const R = o.roof, ov = R.ov ?? 0.4, rot = !!R.rot, t = R.t ?? 0;
				const LA = (rot ? o.d : o.w) / 2, LC = (rot ? o.w : o.d) / 2;
				const P2 = (ua, uc) => (rot ? W(uc, ua) : W(ua, uc)), Lp = (ua, uc) => (rot ? [uc, ua] : [ua, uc]);
				const slope = Math.atan2(R.h, LC + ov), yawR = rot ? o.a - Math.PI / 2 : o.a;
				const hr = (n) => hash(o.x * 1.37 + n * 7.1, o.z * 0.91 - n * 3.3);
				const burnt = o.cond === COND.burnt;
				if (hr(1) < (t === ROOF.shingle || t === ROOF.shake ? 0.5 : 0.28) && LA > 3) {
					const ua = (hr(2) < 0.5 ? -1 : 1) * (LA - 1.1), uc = (hr(3) - 0.5) * 1.2, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc);
					const base = roofAt(o, lx, lz) - 0.4, H = o.y + o.h + R.h + 0.8 - base;
					const brick = t === ROOF.shingle || t === ROOF.shake || hr(4) < 0.3;
					kitPut(put, 'chimney', [x, base, z, o.a, 0.75, H, 1.15, 0, ...(brick ? pick(BRICK, hr(5)) : o.col)]);
				} else if (hr(1) < 0.75 && !burnt) {
					const ua = (hr(2) - 0.5) * LA, uc = -(0.3 + hr(3) * 0.4) * LC, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc);
					kitPut(put, 'flue', [x, roofAt(o, lx, lz) - 0.1, z, 0, 1, 0.9 + hr(4) * 0.5, 1, 0]);
				}
				if (dd < 260 * 260 && !burnt) {
					for (let n = 0, m = 1 + Math.floor(hr(6) * 3); n < m; n++) { const ua = (hr(7 + n) - 0.5) * LA * 1.4, uc = -(0.2 + hr(9 + n) * 0.5) * LC, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'pipe', [x, roofAt(o, lx, lz) - 0.05, z, 0, 1, 1, 1, 0]); }
					for (let n = 0, m = Math.floor(hr(12) * 3); n < m; n++) { const ua = (n - (m - 1) / 2) * 1.6, uc = -(0.12 + hr(13) * 0.15) * LC, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'boxvent', [x, roofAt(o, lx, lz) - 0.05, z, yawR, 1, 1, 1, -slope]); }
				}
				if (!burnt && hr(14) < 0.12 && LC > 3) { const ua = (hr(15) - 0.5) * LA, uc = -LC * 0.45, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'skylight', [x, roofAt(o, lx, lz), z, yawR, 1, 1, 1, -slope]); }
				// solar on the slope that faces most nearly south (world +z)
				const sd = rot ? Math.sin(o.a) : Math.cos(o.a), s = sd >= 0 ? 1 : -1;
				if (!burnt && !o.cond && hr(16) < (t === ROOF.barrel || t === ROOF.flatTile ? 0.3 : 0.18) && LA > 4 && LC > 3 && Math.abs(sd) > 0.3) {
					const run = (LC + ov) / Math.cos(slope), rows = Math.max(1, Math.min(3, Math.floor((run - 1.2) / 1.72))), cols = Math.max(2, Math.floor((LA * 2 - (R.hip ? LC : 0) * 1.2 - 1.5) / 1.03));
					const uc = s * (LC + ov) * 0.5, ua = (hr(17) - 0.5) * 0.8, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc);
					kitPut(put, 'solar', [x, roofAt(o, lx, lz) + 0.1, z, yawR, cols * 1.03, 0.05, rows * 1.72, s * slope]);
				}
				if (!burnt && hr(18) < 0.07) { const ua = (hr(19) < 0.5 ? -1 : 1) * (LA - 0.8), uc = -(LC * 0.6), [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'dish', [x, roofAt(o, lx, lz) - 0.05, z, o.a + hr(20) * 2, 1, 1, 1, 0]); }
				// dormers across the front of a steep old roof
				if (!rot && !R.hip && Math.floor(o.kind) === KIND.house && R.h / (LC + ov) > 0.62 && hr(21) < 0.3 && LA > 3.5) {
					for (let n = 0, m = LA > 6 ? 2 : 1; n < m; n++) {
						const ua = m === 1 ? 0 : (n ? 1 : -1) * LA * 0.45, uc = LC * 0.25, [x, z] = W(ua, uc), y = roofAt(o, ua, uc + 1) - 0.15;
						kitPut(put, 'dormer', [x, y, z, o.a, 1, 1, 1, 0, ...o.col]);
						kitPut(put, 'dormerRoof', [x, y, z, o.a, 1, 1, 1, 0, ...R.col]);
					}
				}
				// the downspouts, at the corners under the eaves
				if (dd < 220 * 220 && Math.floor(o.kind) !== KIND.office) {
					const sp = R.trim === 3 ? o.col : [0.92, 0.91, 0.88];
					const eaves = rot ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
					for (const [ex, ez] of eaves) { const lx = ex ? ex * (o.w / 2 + 0.06) : (hr(22) < 0.5 ? -1 : 1) * (o.w / 2 - 0.15), lz = ez ? ez * (o.d / 2 + 0.06) : (hr(23) < 0.5 ? -1 : 1) * (o.d / 2 - 0.15), [x, z] = W(lx, lz); kitPut(put, 'spout', [x, o.y + 1.0, z, o.a, 1, o.h - 1.05, 1, 0, ...sp]); }
				}
			}
			// round a big pool (a complex's, a club's): loungers down its sides, umbrellas between
			if (o.kind === KIND.pool && area > 60 && !o.dec) {
				const along = o.w > o.d, L = along ? o.w : o.d, S = along ? o.d : o.w;
				for (const sd2 of [-1, 1]) for (let n = 0; n < Math.floor(L / 1.7); n++) {
					const u = -L / 2 + 0.85 + n * 1.7, v = sd2 * (S / 2 + 1.7), [x, z] = along ? W(u, v) : W(v, u), g = bay.heightAt(x, z);
					if (n % 3 === 2) kitPut(put, 'umbrella', [x, g, z, o.a, 1, 1, 1, 0, ...pick(CANVAS, hash(x, z))]);
					else kitPut(put, 'lounger', [x, g, z, o.a + (along ? 0 : Math.PI / 2) + (sd2 > 0 ? Math.PI : 0), 1, 1, 1, 0]);
				}
			}
			if (o.roof && HOUSE.has(o.kind) && area > 55 && o.w > 6.5) {
				const [bx, bz] = W(0, -o.d / 2 - 7), g = bay.heightAt(bx, bz), g0 = bay.heightAt(o.x, o.z);
				if (r < 0.085 && Math.abs(g - g0) < 1.5) {
					const w = Math.min(4.8, o.w * 0.45), d = 3.2, [x, z] = W((hash(o.x * 1.3, o.z * 0.9) < 0.5 ? -1 : 1) * (o.w / 2 - w / 2 - 0.6), -o.d / 2 - d / 2 + 0.05);
					put[1].push([x, g0 + 0.25, z, o.a, w, 2.6, d]);
				} else if (r > 0.3 && r < 0.43 && Math.abs(g - g0) < 1.2 && g > 0.8) put[2].push([bx, g, bz, o.a + (hash(o.z * 1.1, o.x * 0.7) - 0.5) * 0.5, 1]);
			}
		}
		list.kit = put;
	}
	const ROOF_R = PHONE ? 200 : 380;
	function kitPut(put, k, e) { if (kit2.has(k)) (put.props[k] || (put.props[k] = [])).push(e); }
	function uploadKit(put) {
		const [acs, suns, lines] = put || [[], [], []];
		let n = 0;
		for (const [x, y, z, a, s] of acs) { if (n >= kit.ac.instanceMatrix.count) break; q.setFromAxisAngle(Y, -a); kit.ac.setMatrixAt(n++, m4.compose(p.set(x, y, z), q, sc.set(s, s, s))); }
		kit.ac.count = n; n = 0;
		for (const [x, y, z, a, w, h, d] of suns) { if (n >= kit.sunF.instanceMatrix.count) break; q.setFromAxisAngle(Y, -a); m4.compose(p.set(x, y, z), q, sc.set(w, h, d)); kit.sunF.setMatrixAt(n, m4); m4.compose(p.set(x, y + 0.33 * h, z), q, sc.set(w - 0.04, h * 0.67 - 0.02, d - 0.04)); kit.sunG.setMatrixAt(n++, m4); }
		kit.sunF.count = kit.sunG.count = n; n = 0;
		for (const [x, y, z, a, s] of lines) { if (n >= kit.line.instanceMatrix.count) break; q.setFromAxisAngle(Y, -a); kit.line.setMatrixAt(n++, m4.compose(p.set(x, y, z), q, sc.set(s, s, s))); }
		kit.line.count = n;
		for (const im of [kit.ac, kit.sunF, kit.sunG, kit.line]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
	}
	function upload(list, body, roofs) {
		let n = 0, nh = 0, ng = 0;
		const kinds = body.geometry.attributes.aKind, nearA = body.geometry.attributes.aNear, ages = body.geometry.attributes.aAge;
		if (roofs) slotOf = new Map();
		for (const o of list) {
			if (n >= body.instanceMatrix.count) break;
			q.setFromAxisAngle(Y, -o.a); sc.set(o.w, o.h, o.d); p.set(o.x, o.y, o.z);
			body.setMatrixAt(n, m4.compose(p, q, sc)); body.setColorAt(n, col.setRGB(o.col[0], o.col[1], o.col[2])); kinds.array[n] = o.kind; ages.array[n] = (o.age ?? 0.4) + 2 * (o.cond || 0);
			const nc = o.src?.grp?.near, dr = roofs && !nc ? doors.get(lotKey(o)) : null;
			nearA.array[n * 3] = nc ? nc[0] : dr ? dr[0] : 0; nearA.array[n * 3 + 1] = nc ? nc[1] : dr ? dr[1] : 0; nearA.array[n * 3 + 2] = nc ? 1 : dr ? 2 + dr[2] : 0;
			if (roofs && o.src?.grp) { let l = slotOf.get(o.src.grp); if (!l) slotOf.set(o.src.grp, l = []); l.push(n); }
			if (roofs) o.slot = n;
			n++;
			if (o.roof && roofs) {
				const im = o.roof.hip ? roofs[0] : roofs[1], k = o.roof.hip ? nh++ : ng++;
				if (k >= im.instanceMatrix.count) continue;
				p.set(o.x, o.y + o.h, o.z);
				const ov = o.roof.ov ?? 0.4, R = o.roof;
				if (R.rot) { q.setFromAxisAngle(Y, -o.a + Math.PI / 2); sc.set(o.d + 2 * ov, R.h, o.w + 2 * ov); } else sc.set(o.w + 2 * ov, R.h, o.d + 2 * ov);
				im.setMatrixAt(k, m4.compose(p, q, sc)); im.setColorAt(k, col.setRGB(R.col[0], R.col[1], R.col[2]));
				// its covering (by colour where the lot didn't say: the reds are clay tile), trim,
				// and condition (a run-down house's roof patched and sagging, a burnt one holed)
				const rh = hash(o.x * 0.61 + 7.7, o.z * 0.83 - 2.9);
				const t = R.t ?? (R.col[0] > R.col[2] * 1.45 && R.col[0] > 0.38 ? ROOF.barrel : rh < 0.72 ? ROOF.shingle : rh < 0.9 ? ROOF.flatTile : ROOF.metal);
				const trim = R.trim ?? (rh * 7.3 % 1 < 0.45 ? 0 : rh * 7.3 % 1 < 0.6 ? 1 : rh * 7.3 % 1 < 0.75 ? 2 : rh * 7.3 % 1 < 0.95 ? 3 : 4);
				const rc2 = o.cond === COND.burnt ? 2 : o.cond === COND.boarded ? (rh < 0.5 ? 3 : 1) : o.cond === COND.rundown ? (rh < 0.3 ? 3 : 1) : 0;
				const ra = im.geometry.attributes.aRoof, wa = im.geometry.attributes.aWall;
				ra.array[k * 4] = t; ra.array[k * 4 + 1] = ov; ra.array[k * 4 + 2] = trim; ra.array[k * 4 + 3] = rc2;
				wa.array[k * 3] = o.col[0]; wa.array[k * 3 + 1] = o.col[1]; wa.array[k * 3 + 2] = o.col[2];
			}
		}
		body.count = n; kinds.needsUpdate = true; nearA.needsUpdate = true; ages.needsUpdate = true;
		for (const im of [body, ...(roofs || [])]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
		if (roofs) { roofs[0].count = Math.min(nh, roofs[0].instanceMatrix.count); roofs[1].count = Math.min(ng, roofs[1].instanceMatrix.count); for (const im of roofs) { im.geometry.attributes.aRoof.needsUpdate = true; im.geometry.attributes.aWall.needsUpdate = true; } }
		if (roofs) treeList = list.trees || [];
	}

	// the trees by distance from you, re-sorted as you walk: leaf-card trees close by,
	// simpler leaf-card trees further out, smooth masses far away
	let treeList = [], treeX = 1e9, treeZ = 1e9;
	function placeTrees(x, z) {
		treeX = x; treeZ = z;
		const cn = new Map(), next = (im) => { const c = cn.get(im) || 0; if (c >= im.instanceMatrix.count) return -1; cn.set(im, c + 1); return c; };
		let nf = 0;
		for (const t of treeList) {
			const d = Math.hypot(t.x - x, t.z - z);
			const yaw = hash(t.x * 3.1, t.z * 1.7) * 6.283;
			q.setFromAxisAngle(Y, yaw);
			const tint = [0, 1, 2].map((c) => Math.min(1.35, Math.max(0.65, t.col[c] / LEAF_REF[c])));
			if (t.fern) {
				if (d > LOD.shrub[3] + MARGIN) continue;
				const k = next(ferns[0]); if (k < 0) continue;
				const s2 = t.h / fernT.height;
				m4.compose(p.set(t.x, t.y, t.z), q, sc.set(s2, s2, s2));
				ferns[0].setMatrixAt(k, m4); ferns[0].setColorAt(k, col.setRGB(tint[0], tint[1], tint[2]));
				continue;
			}
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
			// far: one point, drawn as its species' picture, tinted like the tree
			if (nf >= TCAP) continue;
			fp.pos[nf * 3] = t.x; fp.pos[nf * 3 + 1] = t.y + 0.2; fp.pos[nf * 3 + 2] = t.z;
			fp.size[nf] = t.h * T.sizeK; fp.sp[nf] = sp;
			fp.tint[nf * 3] = tint[0]; fp.tint[nf * 3 + 1] = tint[1]; fp.tint[nf * 3 + 2] = tint[2];
			nf++;
		}
		farGeo.setDrawRange(0, nf);
		for (const a of ['position', 'aSize', 'aSp', 'aTint']) farGeo.attributes[a].needsUpdate = true;
		const all = [...shrubs, ...ferns, ...treeTiers.flatMap((T) => [...T.near, ...T.mid])];
		for (const im of all) { im.count = cn.get(im) || 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
	}

	// the skylines, found once: every downtown's tall buildings, kept for far views
	const skyline = [];
	skyline.noGrounds = true;          // (far off: the towers alone)
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
	// ---------- the gridded towns' buildings, for walking into (interiors/, houses.js, commercial.js) ----------
	// a lot's own key (the grid puts it in the same place every time the list is rebuilt)
	const lotKey = (o) => Math.round(o.x * 4) + ':' + Math.round(o.z * 4);
	// buildings with their rooms built inside keep their block, its front door cut out:
	// key -> [door x across the front from the centre, sill above the block's foot, width]
	const doors = new Map();
	function setDoor(o, v) {
		const k = lotKey(o);
		if (v) doors.set(k, v); else doors.delete(k);
		// (the list is rebuilt as you travel: the lot as it stands in the current one)
		const cur = lotsNear(o.x, o.z, 0.5).find((q) => lotKey(q) === k);
		if (!cur || cur.slot === undefined || cur.src?.grp?.near) return;
		const nearA = near.geometry.attributes.aNear, n = cur.slot;
		nearA.array[n * 3] = v ? v[0] : 0; nearA.array[n * 3 + 1] = v ? v[1] : 0; nearA.array[n * 3 + 2] = v ? 2 + v[2] : 0;
		nearA.needsUpdate = true;
	}
	// the gridded houses (and a garage built onto one), and the shops and offices, given the
	// shape of the mapped ones so houses.js and commercial.js build them the same way; kept
	// by key, so one is the same house every time the list is rebuilt
	const procGrp = new Map();
	let procStamp = 0;
	function procGroups(list, cx, cz) {
		procStamp++;
		const R2 = 260 * 260, gar = new Map(), cellK = (x, z) => Math.floor(x / 24) + ',' + Math.floor(z / 24);
		// (the garages, and the wings: a pop-up storey, an addition, a garage made a room)
		for (const o of list) if (!o.src && (o.kind === KIND.garage || o.kind === KIND.house) && o.roof && (o.x - cx) ** 2 + (o.z - cz) ** 2 < R2) { const k = cellK(o.x, o.z); (gar.get(k) || gar.set(k, []).get(k)).push(o); }
		const touch = (c, b) => { const ca = Math.cos(c.a), sa = Math.sin(c.a), dx = b.x - c.x, dz = b.z - c.z; return Math.abs(c.a - b.a) < 1e-3 && Math.abs(ca * dx + sa * dz) <= (c.w + b.w) / 2 + 0.4 && Math.abs(-sa * dx + ca * dz) <= (c.d + b.d) / 2 + 0.4; };
		for (const o of list) {
			if (o.src || (o.x - cx) ** 2 + (o.z - cz) ** 2 > R2) continue;
			const house = Math.floor(o.kind) === KIND.house && o.kind > 1.005 && o.roof, biz = (o.kind === KIND.retail || (o.kind === KIND.office && o.h <= 20)) && o.w * o.d > 60 && o.w * o.d < 6000 && Math.min(o.w, o.d) > 6;
			if (!house && !biz) continue;
			// (a house boarded up or burnt out stays shut: no rooms built in it)
			if (house && (o.cond === COND.boarded || o.cond === COND.burnt)) continue;
			const key = lotKey(o);
			let grp = procGrp.get(key);
			if (!grp) {
				if (house) {
					const door = Math.min(1, Math.max(0, ((o.kind - 1) - 0.01) / 0.38));
					grp = [{ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, wallH: o.h - 1.2, roofH: o.roof.h, kind: 0, door, hip: o.roof.hip ? 1 : 0, look: { wall: o.col, roof: o.roof.col, garage: null } }];
					const [gi, gj] = [Math.floor(o.x / 24), Math.floor(o.z / 24)];
					let hasG = false;
					for (let j = gj - 1; j <= gj + 1 && grp.length < 4; j++) for (let i = gi - 1; i <= gi + 1 && grp.length < 4; i++) for (const g of gar.get(i + ',' + j) || []) {
						if (g.src || !touch(o, g) || grp.some((q) => q.lot === g)) continue;
						if (g.kind === KIND.garage) { if (hasG) continue; hasG = true; grp.push({ x: g.x, z: g.z, w: g.w, d: g.d, a: g.a, wallH: 3.0, roofH: Math.min(1.6, g.roof?.h || 1.2), kind: 3, door: 0.5, hip: g.roof?.hip ? 1 : 0, lot: g }); } else grp.push({ x: g.x, z: g.z, w: g.w, d: g.d, a: g.a, wallH: g.h - 1.2, roofH: g.roof?.h || 1.2, kind: 4, door: 0.5, hip: g.roof?.hip ? 1 : 0, lot: g, look: { wall: g.col, roof: g.roof?.col || o.roof.col, garage: null } });
					}
				} else {
					const b = { x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, wallH: o.h - 1.2, roofH: 0, kind: o.kind === KIND.retail ? 6 : 5, door: 0.5, hip: 0 };
					grp = [b]; b.grp = grp; grp.biz = true;
				}
				procGrp.set(key, grp);
			}
			grp.stamp = procStamp;
			o.src = grp.biz ? grp[0] : { grp };
			// (its garage hands over with it)
			for (const m of grp) if (m.lot) for (const g of gar.get(cellK(m.x, m.z)) || []) if (Math.abs(g.x - m.x) < 0.05 && Math.abs(g.z - m.z) < 0.05) g.src = { grp };
		}
		// (forget the ones long behind you)
		if (procGrp.size > 3000) for (const [k, g] of procGrp) if (!g.near && procStamp - g.stamp > 3) procGrp.delete(k);
	}
	const procNear = (x, z, r, biz) => { const out = []; for (const g of procGrp.values()) if (g.stamp === procStamp && !!g.biz === biz && Math.hypot(g[0].x - x, g[0].z - z) < r) out.push(g); return out; };
	// every building round a point, from the last list (for walls to walk into)
	let lotGrid = new Map();
	function indexLots(list) {
		const G = new Map();
		for (const o of list) {
			if (o.h < 0.9 || o.kind === KIND.pool || !o.w) continue;
			const k = Math.floor(o.x / 40) + ',' + Math.floor(o.z / 40);
			(G.get(k) || G.set(k, []).get(k)).push(o);
		}
		lotGrid = G;
	}
	function lotsNear(x, z, r) {
		const out = [];
		for (let j = Math.floor((z - r - 60) / 40); j <= Math.floor((z + r + 60) / 40); j++) for (let i = Math.floor((x - r - 60) / 40); i <= Math.floor((x + r + 60) / 40); i++) {
			for (const o of lotGrid.get(i + ',' + j) || []) if (Math.hypot(o.x - x, o.z - z) < r + Math.max(o.w, o.d) / 2) out.push(o);
		}
		return out;
	}
	const REAL_ROOF = [[0.3, 0.31, 0.33], [0.24, 0.25, 0.27], [0.36, 0.36, 0.37], [0.4, 0.39, 0.38], [0.33, 0.3, 0.28], [0.42, 0.33, 0.27], [0.5, 0.3, 0.22], [0.46, 0.27, 0.2], [0.28, 0.29, 0.32], [0.38, 0.35, 0.33]];
	function realBuildings(cx, cz, R, list) {
		if (!real?.loaded()) return;
		const trees = list.trees || (list.trees = []);
		const floors = new Map();
		for (const b of real.near('boxes', cx, cz, R)) {
			const dx = b.x - cx, dz = b.z - cz;
			if (dx * dx + dz * dz > R * R) continue;
			// the Discovery Museum's barracks are built by bay/discovery.js
			if (inCampus(b.x, b.z)) continue;
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
			if (b.kind === 0) kind = doorKind(KIND.house, b.door);
			else if (b.kind === 8) kind = KIND.apt;
			else if (b.kind === 1) kind = doorKind(KIND.houseGarageL, b.door);
			else if (b.kind === 2) kind = doorKind(KIND.houseGarageR, b.door);
			else if (b.kind === 3) kind = KIND.garage;
			else if (b.kind === 4 || b.kind === 10) kind = KIND.house;
			else if (b.kind === 5) { kind = KIND.office; col = jit(pick(PAL.office, r2), r); }
			else if (b.kind === 6) { kind = KIND.retail; col = jit(pick(PAL.retail, r2), r); }
			else if (b.kind === 7) { kind = KIND.office; col = jit([0.86, 0.8, 0.68], r); }
			else if (b.kind === 11) { kind = KIND.tower; col = jit(pick(PAL.tower, r2), r); }
			else if (b.kind === 12) { kind = KIND.office; col = jit([0.6, 0.59, 0.56], r); }        // a parking garage: open concrete decks (ribbon openings)
			else { kind = KIND.industry; col = jit(pick(PAL.industry, r2), r); }
			// (a tall block mapped as a garage or a shed is an office block: glazed, not a blank wall)
			if ((kind === KIND.garage || kind === KIND.plain) && top - y > 9) { kind = KIND.office; col = jit(pick(PAL.office, r2), r); }
			if (b.roofH > 0.1) roof = { hip: !!b.hip, h: b.roofH, col: rc };
			list.push({ x: b.x, y, z: b.z, w: b.w, d: b.d, h: top - y, a: b.a, col, kind, roof, src: b, age: ageFor(STYLE.suburb, kind, b.x, b.z) });
			if (b.kind >= 5 && b.kind !== 10) grounds(list, trees, b.x, b.z, b.w, b.d, b.a, g, y, kind, b.x * 0.37 + b.z * 0.11);
		}
		for (const p of real.near('pools', cx, cz, Math.min(R, 900))) {
			const g = bay.heightAt(p.x, p.z);
			if (g > 0.5) list.push({ x: p.x, y: g - 0.9, z: p.z, w: p.w, d: p.d, h: 0.99, a: p.a, col: [0.9, 0.89, 0.85], kind: KIND.pool, roof: null });
		}
		wildLand(cx, cz, 1100, trees);
		wildLand(cx, cz, 2700, trees, 22, 1100);          // beyond: a coarser, cheaper scatter for the far masses
		// the willows, sycamores and redwoods along the San Lorenzo (sanlorenzo.js)
		for (const t of riverTreesNear(cx, cz, 2700)) trees.push(t);
		// ...and along every other creek and river's wild banks (water.js)
		for (const t of waterTreesNear(cx, cz, 2700)) trees.push(t);
		for (const t of real.near('trees', cx, cz, 2700)) {
			const g = bay.heightAt(t.x, t.z), r = hash(t.x * 2.1, t.z * 1.3);
			// (the open parkland on the wind-scoured bluffs by the ocean has no trees but in the draws)
			if (t.x < 58000 && (bay.heightAt(t.x - 900, t.z) < -2 || bay.heightAt(t.x - 2200, t.z) < -2 || (t.x < 12000 && bay.heightAt(t.x, t.z + 1500) < -2))) { const L = real.landAt(t.x, t.z); if (L && L.lu !== 1 && L.lu !== 7 && L.lu !== 13) { const gl = (bay.heightAt(t.x + 60, t.z) + bay.heightAt(t.x - 60, t.z) + bay.heightAt(t.x, t.z + 60) + bay.heightAt(t.x, t.z - 60) - 4 * g) / 4; if (gl < 7 || r > 0.35) continue; } }       // (only a few, in a deep draw well below its sides)
			// in the fog belt the wild and park woods are redwood forest (Muir Woods, the canyons of
			// Mt Tam and the Santa Cruz Mountains): the mapped trees there stand as redwoods
			const fq2 = Math.min(1, Math.max(0, (t.x - 22000) / 36000));
			if (g > 0.5 && g < 320 && 1 - fq2 * fq2 * (3 - 2 * fq2) > 0.6 && r < 0.75) { const L = real.landAt(t.x, t.z); if (L && (L.lu === 0 || L.lu === 2 || L.lu === 12)) { trees.push({ x: t.x, y: g - 0.3, z: t.z, h: 28 + r * 30, cone: true, sp: 2, col: jit([0.12, 0.19, 0.09], r) }); continue; } }
			if (g > 0.5) trees.push({ src: 'real', x: t.x, y: g - 0.3, z: t.z, h: t.h, cone: !!t.cone, col: t.cone ? jit([0.13, 0.21, 0.11], r) : t.flower ? jit([0.62, 0.2, 0.34], r) : jit(pick(PAL.crown, r), r) });   // (crape myrtles in bloom)
		}
	}

	// the wild land round the towns and up Mt Diablo, grown from the ground itself:
	// oak woodland on the cool north slopes and down the canyons (live oak, bay, buckeye),
	// chaparral on the hot south-facing ridges, gray and Coulter pines scattered high,
	// open grassland with the odd blue oak on the gentle slopes
	// how much brush a spot of open grassland carries: drifts on a 60 m and a 20 m scale,
	// more on north faces and in gullies
	const brushK = (x, z, north, gully) => Math.max(0, vnoise(x / 60 + 31, z / 60 - 7) * 0.7 + vnoise(x / 20 - 5, z / 20 + 11) * 0.3 - 0.35) * (0.8 + Math.max(0, north) * 0.6 + gully * 0.8);
	function wildLand(cx, cz, R, trees, C = 13, rIn = 0) {
		if (!real?.landAt) return;
		const H = (x, z) => bay.heightAt(x, z), far = rIn > 0;
		for (let gz = Math.floor((cz - R) / C); gz <= Math.floor((cz + R) / C); gz++) for (let gx = Math.floor((cx - R) / C); gx <= Math.floor((cx + R) / C); gx++) {
			const r = hash(gx * 1.7 + 11, gz * 2.3 + 5);
			if (r > 0.62) continue;                                                  // most cells are open ground
			const x = (gx + hash(gx, gz * 3) * 1.6 - 0.3) * C, z = (gz + hash(gx * 5, gz) * 1.6 - 0.3) * C;
			const dd = (x - cx) * (x - cx) + (z - cz) * (z - cz);
			if (dd > R * R || dd < rIn * rIn) continue;
			// open country: the mapped wild land, or anywhere beyond the maps the towns don't reach
			const inR = real.inside(x, z);
			if (inR) {
				const L = real.landAt(x, z);
				if (!L || (L.lu !== 0 && L.lu !== 11 && L.lu !== 12) || L.road > 0.2 || L.roof > 0.2) continue;
			} else if (bay.urbanAt(x, z).u > 0.06) continue;
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
			// the fog belt near the sea (as the ground's colours have it, terrain.js): redwoods down
			// the canyons and on the shady slopes, in rings round where an old one stood, Douglas-fir
			// up on the ridges, and coastal scrub, not chaparral; the blue oak and gray pine are
			// inland trees and stay out of it
			const fq = Math.min(1, Math.max(0, (x - 22000) / 36000)), fog = 1 - fq * fq * (3 - 2 * fq);
			// the bluffs and headlands right on the open ocean are wind-scoured: coastal scrub and
			// grass, with trees only down in the sheltered draws (the Marin Headlands, Devil's Slide)
			// (a watered city park is planted: Golden Gate Park's groves of cypress, pine and eucalyptus)
			const planted = GREENS.some((G) => Math.abs(x - G.x) < G.rx && Math.abs(z - G.z) < G.rz);
			if (planted && r2 < 0.42) { trees.push(r2 < 0.24 ? { x, y: g, z, h: 16 + r2 * 40, cone: true, sp: 2, col: tint([0.1, 0.17, 0.08]) } : { x, y: g, z, h: 12 + r2 * 14, sp: 0, col: tint([0.2, 0.28, 0.12]) }); continue; }      // (Monterey cypress and pine; eucalyptus)
			const windswept = !planted && fog > 0.5 && (H(x - 900, z) < -2 || H(x - 2200, z) < -2 || H(x, z + 1500) < -2 && x < 12000);
			const draw = windswept ? (H(x + 60, z) + H(x - 60, z) + H(x, z + 60) + H(x, z - 60) - 4 * h) / 4 : 0;
			if (windswept && (draw < 7 || r2 > wood * 0.3) && r2 < wood * 0.8) { if (!far && r2 < 0.5) trees.push({ x, y: g, z, h: 0.9 + r2 * 1.2, shrub: true, col: tint([0.28, 0.33, 0.2]) }); continue; }
			if (r2 < wood * 0.8 && fog > 0.6 && (gully > 0.1 || north > 0.1 || slope < 0.3) && high < 0.5) {
				const rh = 32 + r2 * 34 + gully * 10;
				trees.push({ x, y: g, z, h: rh, cone: true, sp: 2, col: tint([0.12, 0.19, 0.09]) });
				if (!far) for (let k = 0; k < 7; k++) { const a = hash(gx * 7 + k, gz * 3) * 6.283, rr = 2 + hash(gx + k * 3, gz * 5) * 9, qx = x + Math.cos(a) * rr, qz = z + Math.sin(a) * rr; trees.push({ x: qx, y: H(qx, qz) - 0.05, z: qz, h: 0.7 + hash(gx * k, gz + k) * 0.6, fern: true, col: tint([0.18, 0.3, 0.1]) }); }
				if (!far) for (let k = 0, n = 2 + Math.floor(hash(gx * 2.3, gz * 5.9) * 4); k < n; k++) { const a = k / n * 6.283 + r2 * 3, rr = 4 + hash(gx + k, gz - k) * 3, qx = x + Math.cos(a) * rr, qz = z + Math.sin(a) * rr; trees.push({ x: qx, y: H(qx, qz) - 0.3, z: qz, h: rh * (0.6 + hash(gx * k, gz) * 0.3), cone: true, sp: 2, col: tint([0.12, 0.2, 0.09]) }); }
			} else if (r2 < wood * 0.8 && fog > 0.6 && north < 0.1 && slope < 0.6) trees.push({ x, y: g, z, h: 22 + r2 * 18, cone: true, sp: 2, col: tint([0.15, 0.22, 0.12]) });      // Douglas-fir
			else if (r2 < wood * 0.8 && !far && fog > 0.3 && north > 0.3) { trees.push({ x, y: g, z, h: 6 + r2 * 9 + gully * 5, sp: 1, col: tint([0.16, 0.24, 0.1]) }); for (let k = 0; k < 4; k++) { const a = hash(gx * 5 + k, gz) * 6.283, rr = 3 + hash(gx, gz * 7 + k) * 6, qx = x + Math.cos(a) * rr, qz = z + Math.sin(a) * rr; trees.push({ x: qx, y: H(qx, qz) - 0.05, z: qz, h: 0.6 + hash(gx + k, gz) * 0.5, fern: true, col: tint([0.2, 0.3, 0.12]) }); } }
			else if (r2 < wood * 0.8) trees.push({ x, y: g, z, h: 6 + r2 * 9 + gully * 5, sp: r2 < wood * 0.35 ? 0 : 1, col: tint(r2 < 0.3 ? [0.16, 0.24, 0.1] : [0.22, 0.28, 0.13]) });
			else if (r2 < wood * 0.8 + chap * 0.75) { if (!far) trees.push({ x, y: g, z, h: 1.4 + r2 * 1.8, shrub: true, col: tint(fog > 0.5 ? [0.28, 0.33, 0.2] : [0.2, 0.25, 0.13]) }); }
			else if (fog < 0.4 && r2 > 0.965 - high * 0.05) trees.push({ x, y: g, z, h: 11 + r2 * 9, cone: true, sp: 2, col: tint([0.3, 0.36, 0.26]) });   // gray pine
			else if (fog < 0.4 && r2 > 0.92 && slope < 0.35) trees.push({ x, y: g, z, h: 7 + r2 * 5, sp: 1, col: tint([0.3, 0.33, 0.2]) });          // blue oak in the grass
			// the open grassland's own brush: coyote brush and sage in loose drifts, thicker on the
			// shady side and in the draws, a few poison-oak thickets gone red in the dry season
			// (drawn on their own, in clumps of two to four)
			if (!far && slope < 0.8 && hash(gx * 9.7 + 1, gz * 4.1 + 2) < brushK(x, z, north, gully) * 1.1) {
				const kind = hash(gx * 5.3, gz * 2.9), c = kind < 0.55 ? [0.2, 0.27, 0.12] : kind < 0.85 ? [0.36, 0.4, 0.3] : [0.42, 0.22, 0.1];
				for (let k = 0, n = 2 + Math.floor(hash(gx * 1.3, gz * 8.1) * 3); k < n; k++) {
					const bx = x + (hash(gx * 3 + k, gz) - 0.5) * 9, bz = z + (hash(gx, gz * 3 + k) - 0.5) * 9;
					if (inR) { const L2 = real.landAt(bx, bz); if (L2 && (L2.roof > 0.1 || L2.road > 0.2)) continue; }      // (not in a building or on a street)
					trees.push({ x: bx, y: H(bx, bz) - 0.3, z: bz, h: 0.7 + hash(gx + k, gz * 7.1) * 1.2, shrub: true, col: tint(c) });
				}
			}
		}
	}

	let lastX = 1e9, lastZ = 1e9, started = false, realSeen = false, realV = 0, clearV = -1, coastV = 0, carveV = -1, waterV = -1;
	function update(cam, nightK) {
		if (!bay.loaded()) return;
		night.value = nightK;
		// the landmark towers' glass: lit floors behind it after dark, not a black slab
		glassM.emissive.setRGB(0.9, 0.78, 0.6).multiplyScalar(0.22 * nightK);
		if (!started) { started = true; findSkylines(); landmarks(); bayBridge(); }
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y > 4000;
		near.visible = hips.visible = gables.visible = farPts.visible = !high;
		for (const im of [...shrubs, ...ferns, ...treeTiers.flatMap((T) => [...T.near, ...T.mid])]) im.visible = !high;
		if (!realSeen && real?.loaded()) { realSeen = true; lastX = 1e9; }                   // the real city arrived: rebuild
		if (clearingVersion() !== clearV) { clearV = clearingVersion(); lastX = 1e9; }          // a ball field laid out nearby: its trees go
		if (coastVersion() !== coastV) { coastV = coastVersion(); lastX = 1e9; }                // the coast's farms and links laid out: theirs go
		if (carveVersion() !== carveV) { carveV = carveVersion(); if (carveNear(x, z, 3000)) lastX = 1e9; }     // a river carved nearby: the ground under the trees moved
		if (waterVersion() !== waterV) { waterV = waterVersion(); lastX = 1e9; }                  // trees stood up along the creeks near you
		if (real?.version && real.version() !== realV) { realV = real.version(); lastX = 1e9; skyline.length = 0; findSkylines(); if (realSeen) { riseT0 = performance.now(); rise.value.set(x, z, 0, 1); } }   // a generated town came or went: it rises
		if (riseT0 >= 0) {
			// the ring runs out at 700 m a second; no shadows from the buildings still underground
			const front = (performance.now() - riseT0) / 1000 * 700;
			rise.value.z = front;
			const on = front < 2600;
			if (!on) { riseT0 = -1; rise.value.w = 0; }
			near.castShadow = hips.castShadow = gables.castShadow = !on;
		}
		if (Math.hypot(x - lastX, z - lastZ) < 300) { if (!high && Math.hypot(x - treeX, z - treeZ) > 40) placeTrees(x, z); return; }                 // (MARGIN covers these 40 m)
		lastX = x; lastZ = z;
		const list = [];
		fillBlocks(x, z, 1200, list);
		realBuildings(x, z, 2000, list);
		decorate(list, x, z, 700);
		// no tree grows out of a street or a roof (the mapped trees and yard trees are placed
		// from points and lots; the land map knows where the pavement and the roofs are)
		if (list.trees && real?.loaded()) list.trees = list.trees.filter((t) => { if (t.shrub || t.fern || t.h < 3) return true; const L = real.landAt(t.x, t.z); return !L || (L.road < 0.6 && L.roof < 0.7); });
		// ...nor on a ball field (sportsfields.js)
		if (list.trees) list.trees = list.trees.filter((t) => !inClearing(t.x, t.z, t.shrub || t.fern ? 0 : 2) && !inCoastField(t.x, t.z) && !inBoardwalk(t.x, t.z) && !inRiverWater(t.x, t.z) && !inWater(t.x, t.z));
		// ...nor inside a building (every one can be walked into now): a coarse grid of them
		{
			const G = new Map(), cellOf = (x, z) => Math.floor(x / 60) + ',' + Math.floor(z / 60);
			for (const o of list) if (o.h > 3 && o.w && o.d) { const k = cellOf(o.x, o.z); (G.get(k) || G.set(k, []).get(k)).push(o); }
			const inside = (t) => {
				const cx = Math.floor(t.x / 60), cz = Math.floor(t.z / 60);
				for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const o of G.get((cx + i) + ',' + (cz + j)) || []) {
					const ca = Math.cos(o.a || 0), sa = Math.sin(o.a || 0), dx = t.x - o.x, dz = t.z - o.z;
					if (Math.abs(ca * dx + sa * dz) < o.w / 2 + 1 && Math.abs(-sa * dx + ca * dz) < o.d / 2 + 1) return true;
				}
				return false;
			};
			if (list.trees && G.size) list.trees = list.trees.filter((t) => !inside(t));
		}
		// if there is more than fits, keep the nearest
		const d2 = (o) => (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z);
		if (list.length > CAP) { const t = list.trees, k = list.kit, pr = list.props; list.sort((m, n) => d2(m) - d2(n)); list.length = CAP; list.trees = t; list.kit = k; list.props = pr; }
		if (list.trees && list.trees.length > TCAP) list.trees.sort((m, n) => d2(m) - d2(n));
		procGroups(list, x, z);
		upload(list, near, [hips, gables]);
		indexLots(list);
		uploadKit(list.kit);
		kit2.upload(list.props);
		// the tall ones, for going inside (bay/towers.js)
		tallList = list.filter((o) => (o.kind === KIND.tower || (o.kind === KIND.office && o.h > 20)) && !o.roof && o.src?.kind !== 12 && !o.src?.grp?.biz && Math.min(o.w, o.d) > 12);
		placeTrees(x, z);
	}
	return { lotsNear, lotKey, setDoor, procHomes: (x, z, r) => procNear(x, z, r, false), procBiz: (x, z, r) => procNear(x, z, r, true).map((g) => g[0]), KIND, towersNear: (x, z, r) => tallList.filter((o) => Math.hypot(o.x - x, o.z - z) < r + Math.max(o.w, o.d) / 2), kitCounts: () => ({ ac: kit.ac.count, sunrooms: kit.sunF.count, lines: kit.line.count }), update, group, fill: fillBlocks, houseLook, setNear, setNearBand: (a, b) => nearBand.value.set(a, b), treesNear: (x, z, r) => treeList.filter((t) => Math.hypot(t.x - x, t.z - z) < r).map((t) => ({ h: +t.h.toFixed(1), cone: !!t.cone, sp: t.sp, shrub: !!t.shrub, fern: !!t.fern, src: t.src || '' })) };
}
