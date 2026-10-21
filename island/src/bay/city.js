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
import { commercialStack } from '../interiors/workplace-plan.js';
import { SCOPE_ROOM } from '../interiors/scope-room.js';
import { toWorld } from './geo.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hardwood, conifer, shrub, fern, palm, swayMaterial } from '../world/vegetation.js';
import { addLodFade, NONE_IN, NONE_OUT, detailClock, updateDetailClock } from '../world/lodfade.js';
import * as TX from '../world/textures.js';
import { STYLE, fromGrid, eraFor } from './styles.js';
import { houseFloor, wallTop, mainOf, isHome, garageOf } from './houseplan.js';
import { usePhoto } from '../world/photomats.js';
import { GREENS, REAL_TALL } from './realcity.js';
import { WALL_GLSL, weatherRoofs } from './weathering.js';
import { inCampus } from './discovery.js';
import { inBoardwalk } from './boardwalk.js';
import { inRiverWater, riverTreesNear, carveVersion, carveNear } from './carve.js';
import { inWater, waterTreesNear, waterVersion } from './watercarve.js';
import { inClearing, clearingVersion } from '../sportsfields.js';
import { onLandmark } from './footprints.js';
import { roofGeometry, roofDetail, ROOF } from './roofs.js';
import { houseEra, exteriorLook, seedAt } from './decor.js';
import { createProps, rooftopUnit, rooftopUnitFar } from './lotkit.js';
import { inCoastField, coastVersion } from './coastside.js';
import { makeClearance } from './clearance.js';
import { createEconomyLayer } from '../economy/layer.js';
import { settleLots } from '../structures/lots.js';        // structures: settled lots
import { streetTrees, treeColour, autumnNow } from './streettrees.js';       // streets by era: their trees
import { NIGHT_U, NIGHT_I, nightSeed, housePlan, packHouse } from './nightplan.js';      // the households' own lights after dark
import { addNightField } from '../world/nightfield.js';
import { qualityNow } from '../world/governor.js';
import { roadDelta, gradeVersion } from './berms.js';         // the roads' grading: trees beside a road stand on its banks and cuts
import { WALL_CUTS, CUT_PARS, CUT_TEST } from '../structures/walls/cuts.js';
import { GFX_PHONE } from '../world/device.js';
import { orderByReach } from '../world/shadowreach.js';      // the sun's shadows from what can reach them
import { orderBySector, sectorOf, chunkStore, chunkedMesh } from '../world/instancechunks.js';      // drawn a sector at a time, what is out of view left out
import { cityBlocks } from './city-blocks.js';
import { cityGrounds, cityDecorate, cityApart } from './city-dressing.js';
import { plantingBed, BED_LEN } from './lantana.js';

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

// how far off a building's windows start to clear onto the rooms built behind them, and where
// they are all clear (metres): clear across the street and beyond (a firefight from one shop
// into the one opposite: Josh 2026-10-21), easing in only at the edge of interiors/index.js's
// build reach, so the glass is never seen to change as you walk
const DOOR_CLEAR = GFX_PHONE ? '44.0, 56.0' : '70.0, 86.0';
// the glass of a tower, an office or a shop front with no rooms built behind it: up close a room
// seen through each pane (its floor, walls and lit ceiling, carried in perspective as you move:
// interior mapping), flat painted glass only far off (Josh 2026-10-21: "that's what windows
// should look like from far away")
const ROOM_FAR = GFX_PHONE ? '70.0, 105.0' : '120.0, 170.0';

const ROOM_GLSL = `
float roomK = 0.0, roomL = 1.0;
// the ray from the eye carried on through the pane at p (metres across the room and up from its
// floor) into a box dim (wide, high, deep), lit where it lands; V the view ray, A along the wall,
// N out of it
vec3 roomBehind(vec3 V, vec3 A, vec3 N, vec2 p, vec3 dim, vec2 id) {
	vec3 d = vec3(dot(V, A), V.y, max(0.05, -dot(V, N)));
	float tx = d.x > 0.0 ? (dim.x - p.x) / max(d.x, 1e-4) : p.x / max(-d.x, 1e-4);
	float ty = d.y > 0.0 ? (dim.y - p.y) / max(d.y, 1e-4) : p.y / max(-d.y, 1e-4);
	float tz = dim.z / d.z, tm = min(tz, min(tx, ty));
	vec3 h = vec3(p, 0.0) + d * tm;
	float r = bh(id + 0.31), r2 = bh(id + 5.17);
	vec3 wall = r < 0.5 ? vec3(0.84, 0.82, 0.78) : r < 0.8 ? vec3(0.7, 0.72, 0.74) : vec3(0.62, 0.55, 0.47);
	vec3 c; float L = 1.0;
	if (tz <= tx && tz <= ty) {
		// the back wall: a dark run of desks or a counter along it, a door in some
		c = wall * mix(1.0, 0.45, step(h.y, 0.78) * step(0.3, r2));
		c = mix(c, vec3(0.3, 0.27, 0.24), step(abs(h.x - dim.x * (0.25 + 0.5 * r2)), 0.45) * step(h.y, 2.1) * step(0.55, r));
	} else if (tx <= ty) {
		c = wall * 0.74;
	} else if (d.y < 0.0) {
		// the floor: carpet or stone, a desk's shadow on it
		c = (r2 < 0.6 ? vec3(0.3, 0.31, 0.33) : vec3(0.62, 0.6, 0.56)) * (0.85 + 0.15 * step(0.5, fract(h.x / 1.8 + h.z / 2.6)));
	} else {
		// the ceiling: tiles, a light panel every few of them
		vec2 q = fract(vec2(h.x, h.z) / 2.4);
		float pnl = step(0.3, q.x) * step(q.x, 0.7) * step(0.3, q.y) * step(q.y, 0.7);
		c = mix(vec3(0.86, 0.86, 0.84), vec3(1.0, 0.98, 0.94) * 1.9, pnl);
		L = 1.0 + 0.9 * pnl;
	}
	// darker the deeper in (the light comes from the glass), and darker than the street outside
	// by day, all but the ceiling's lights
	float k = 1.0 - 0.5 * h.z / dim.z;
	roomL = L * k;
	return c * k * 0.6;
}
`;
export function buildingMaterial(shared, night, nearBand) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightC = night;
		sh.uniforms.uNL = NIGHT_U.uNL;
		sh.uniforms.uNearBand = nearBand;sh.uniforms.uDetailNow=detailClock;
		sh.uniforms.uScopeA = SCOPE_ROOM.a; sh.uniforms.uScopeB = SCOPE_ROOM.b; sh.uniforms.uScopeK = SCOPE_ROOM.k;
		sh.uniforms.uCutN = WALL_CUTS.n; sh.uniforms.uCutA = WALL_CUTS.a; sh.uniforms.uCutB = WALL_CUTS.b;          // structures/walls: the face cut round a broken wall
		sh.vertexShader = 'attribute float aKind; attribute float aAge; varying float vAge; attribute vec4 aNL; varying vec4 vNL; attribute vec3 aNear; attribute float aDetailBirth; uniform float uDetailNow; uniform vec2 uNearBand; varying float vNearK; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS; varying vec3 vLP; varying vec3 vLN; varying vec2 vIP; varying vec3 vDoor; varying float vDoorTop; varying float vDoorK;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vNearK = (aNear.z < 0.0 || (aNear.z > 0.5 && aNear.z < 1.5)) ? 1.0 - smoothstep(uNearBand.x, uNearBand.y, max(0.0,length(aNear.xy - cameraPosition.xz) - (aNear.z < 0.0 ? -aNear.z-1.0 : 0.0))) : 0.0;
			vNearK *= smoothstep(0.0,.5,max(0.0,uDetailNow-aDetailBirth));
			// (a building with its rooms built inside: its front door cut out, aNear = door x, sill y, 2 + width)
			vDoor = aNear.z > 1.5 ? vec3(aNear.xy, aNear.z - 2.0) : vec3(0.0);
			// (and how high its rooms go: 2 + width + 4 x whole metres; its windows open only below that)
			vDoorTop = aNear.z > 1.5 ? floor(vDoor.z / 4.0) : 0.0; vDoor.z -= vDoorTop * 4.0;
			// (its windows clear over half a second from when its rooms were built: aDetailBirth)
			vDoorK = aNear.z > 1.5 ? smoothstep(0.0, 0.6, max(0.0, uDetailNow - aDetailBirth)) : 0.0;
			vKind = aKind; vAge = aAge; vNL = aNL;
			vLY = transformed.y * length(instanceMatrix[1].xyz);
			vCW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
			vCS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
			vLP = transformed; vLN = objectNormal; vIP = instanceMatrix[3].xz;`);
		sh.fragmentShader = 'varying float vAge;\n' + CUT_PARS + WALL_GLSL + 'uniform float uNightC; uniform vec2 uNL; uniform vec4 uScopeA; uniform vec4 uScopeB; uniform float uScopeK; varying vec4 vNL; varying float vNearK; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS; varying vec3 vLP; varying vec3 vLN; varying vec2 vIP; varying vec3 vDoor; varying float vDoorTop; varying float vDoorK;\nvec3 winGlow = vec3(0.0); float glassK = 0.0;\nfloat bh(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }   // (wrapped first: sin() of a world-sized number is noise on a GPU)\n' + ROOM_GLSL + sh.fragmentShader
			.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
			if (vNearK > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < vNearK) discard;
			if (vDoor.z > 0.0 && vLN.z > 0.5 && abs(vLP.x * vCS.x - vDoor.x) < vDoor.z * 0.5 && vLY > vDoor.y && vLY < vDoor.y + 2.3) discard;${CUT_TEST}`)
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float roof = step(0.7, vCN.y);
				float cond = floor(vAge * 0.5 + 0.001), age = vAge - cond * 2.0;
				vec2 t = normalize(vec2(-vCN.z, vCN.x) + 1e-5);
				float u = dot(vCW.xz, t), v = vCW.y;
				float win = 0.0; vec2 cell = vec2(0.0);
				vec3 glass = vec3(0.2, 0.24, 0.28);
				// (the rooms seen through the glass: near, on the walls of towers, offices and shops)
				vec3 rV = normalize(vCW - cameraPosition), rA = vec3(t.x, 0.0, t.y);
				roomK = (1.0 - step(0.7, vCN.y)) * step(1.5, vKind) * step(vKind, 6.5) * (1.0 - smoothstep(${ROOM_FAR}, length(vCW.xz - cameraPosition.xz)));
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
					// (up close, a room three bays wide behind the glass, floor to ceiling)
					if (roomK > 0.0) glass = mix(glass, roomBehind(rV, rA, vCN, vec2(fract(u / 4.8) * 4.8, f.y * 3.9), vec3(4.8, 3.04, 7.0), floor(vec2(u / 4.8, v / 3.9)) + floor(vIP)), roomK);
					// at the street: a tall glazed lobby in wide bays above a dark stone plinth
					if (vLY < 6.2) {
						cell = vec2(u / 3.2, 0.0);
						win = step(0.06, fract(cell.x)) * step(2.1, vLY) * step(vLY, 5.6);
						glass = vec3(0.14, 0.16, 0.18); glassK = win * 0.8;
						if (roomK > 0.0) glass = mix(glass, roomBehind(rV, rA, vCN, vec2(fract(u / 9.6) * 9.6, vLY - 1.2), vec3(9.6, 4.4, 12.0), vec2(floor(u / 9.6), 0.5) + floor(vIP)) * vec3(1.0, 0.97, 0.92), roomK);
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
					if (roomK > 0.0) glass = mix(glass, roomBehind(rV, rA, vCN, vec2(fract(u / 8.0) * 8.0, vLY - 1.2), vec3(8.0, 3.8, 9.0), vec2(floor(u / 8.0), 1.5) + floor(vIP)), roomK);
				} else if (vKind > 6.5) {
					// plain: fields, plazas, yards
					win = 0.0;
				} else {
					// offices: ribbon windows along each floor
					cell = vec2(u / 3.0, v / 4.1); vec2 f = fract(cell);
					win = step(0.35, f.y) * step(f.y, 0.85) * step(0.04, fract(u / 1.5));
					glass = vec3(0.28, 0.36, 0.42);
					glassK = win * 0.7;
					if (roomK > 0.0) glass = mix(glass, roomBehind(rV, rA, vCN, vec2(fract(u / 6.0) * 6.0, (f.y - 0.08) * 4.1), vec3(6.0, 3.2, 7.0), floor(vec2(u / 6.0, v / 4.1)) + floor(vIP)), roomK);
					// a dark stone plinth at the ground
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.29, 0.28), step(vLY, 1.9) * (1.0 - roof));
				}
				// a building with its rooms built: its front windows (and a bay's) open onto them, the
				// glass clearing as you come (all of it painted at the far edge of the band, all of it
				// clear at the near), so the rooms are never seen to appear: they come through the glass
				// (a tower: the one you are at, its curtain wall open all round onto the lobby and the
				// floor over it that towers.js builds; the flat painted glass only for the far ones)
				float towerK = step(1.5, K) * step(K, 2.5);
				if (vDoor.z > 0.0 && win > 0.5 && vLY < vDoorTop && (K < 0.5 || K > 8.5 || towerK > 0.5) && K < 10.5 && (front > 0.5 || K > 9.5 || towerK > 0.5)) {
					float openK = vDoorK * (1.0 - smoothstep(${DOOR_CLEAR}, length(vCW.xz - cameraPosition.xz)));
					if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < openK) discard;
				}
				// the room seen through a scope, however far: only its own windows, on the face looked at
				if (uScopeA.z > 0.5 && win > 0.5 && roof < 0.5 && distance(vIP, uScopeA.xy) < 0.6) {
					float sf = uScopeA.w;
					vec2 fn = sf < 1.5 ? vec2(0.0, 1.0 - 2.0 * sf) : vec2(5.0 - 2.0 * sf, 0.0);
					float su = sf < 1.5 ? vLP.x * vCS.x : vLP.z * vCS.z;
					if (dot(vLN.xz, fn) > 0.5 && su > uScopeB.x && su < uScopeB.y && vLY > uScopeB.z && vLY < uScopeB.w && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < uScopeK) discard;
				}
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
				// how many rooms are lit by the hour (uNL.x the late hour): offices and towers emptying
				// through the evening to a few cleaners' and late workers' floors, homes going to bed
				float occ = vKind > 1.5 && vKind < 3.5 ? mix(0.5, 0.12, smoothstep(19.0, 23.5, uNL.x)) : mix(0.42, 0.3, smoothstep(21.0, 24.0, uNL.x)) * (1.0 - 0.65 * smoothstep(24.0, 26.5, uNL.x));
				// (offices and towers light by the floor and the zone, whole runs of a floor at once, most
				// windows in a lit run lit; so far off a tower is a dark mass with lit bands and patches,
				// not an even grey: the run's own on or off holds when its windows are a pixel)
				float offK = step(1.5, vKind) * step(vKind, 3.5);
				float zone = step(1.0 - min(1.0, occ / 0.78), bh(vec2(floor(u / 12.0), floor(vLY / 7.8)) + floor(vCW.xz * 0.013) + 0.5));
				float nearLit = mix(step(1.0 - occ, bh(floor(cell) + floor(vCW.xz * 0.013))), zone * step(0.22, bh(floor(cell) + 1.7)), offK);
				float lit = max(mix(mix(occ, zone, offK), nearLit, aaW), shopGlow * step(0.25, ih)) * step(cond, 0.5);
				// each lit window its own: warm lamps or cool office tubes, brighter up by the
				// ceiling light, some with the blinds half down (close up; far off, the average)
				vec2 fc = fract(cell), cid = floor(cell);
				vec3 tint = mix(mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.86, 0.66), step(1.5, vKind) * 0.6), vec3(0.78, 0.88, 1.0), step(0.72, bh(cid + 7.1)) * step(1.5, vKind));
				float inner = mix(1.0, (0.55 + 0.6 * fc.y) * mix(1.0, step(fc.y, 0.3 + 0.6 * bh(cid + 5.7)), step(0.65, bh(cid + 2.2))), aaW);
				winGlow = tint * win * lit * inner * uNightC * (0.45 + 0.55 * bh(cid + 3.3)) * 1.1;
				winGlow *= mix(1.0, roomL, roomK);
				// a tower's lobby is lit all night, warm, its tall glass bright at the street
				if (vKind > 1.5 && vKind < 2.5 && vLY < 6.2 && roof < 0.5) winGlow = vec3(1.0, 0.8, 0.56) * win * uNightC * 1.25 * step(cond, 0.5) * mix(1.0, roomL * 0.45, roomK);
				// a lit crown on some of the tall towers (one in five over 110 m): uplights at the foot of
				// the top floors washing up the facade, each its own scallop, brightest low, all night
				if (vKind > 1.5 && vKind < 2.5 && vCS.y > 110.0 && roof < 0.5 && bh(floor(vIP * 0.37) + 3.1) < 0.2) {
					float band = clamp(vCS.y * 0.08, 9.0, 22.0), y0 = vCS.y - band, cy = vLY - y0;
					float hue = bh(floor(vIP * 0.37) + 8.3);
					vec3 cc = hue < 0.55 ? vec3(1.0, 0.86, 0.68) : hue < 0.85 ? vec3(0.78, 0.86, 1.0) : vec3(0.55, 0.75, 1.0);
					float scal = 0.55 + 0.45 * pow(abs(cos(3.14159 * u / 4.0)), 2.0);
					float e = step(0.0, cy) * smoothstep(0.0, 1.2, cy) * mix(1.0, 0.35, cy / band) * scal;
					winGlow += cc * e * uNightC * (diffuseColor.rgb * 1.6 + 0.06) * step(cond, 0.5);
				}
				// a parking garage (mapped: kind 3.3): its open decks every 3 m, the ribbon of each
				// opening dark, and by night a stripe of light under each deck's ceiling, all night
				if (vKind > 3.2 && vKind < 3.4 && roof < 0.5) {
					float dk = fract(vLY / 3.0), open = step(0.32, dk) * step(dk, 0.86) * step(1.2, vLY) * step(vLY, vCS.y - 1.0);
					diffuseColor.rgb = mix(vec3(0.56, 0.55, 0.52) * (0.9 + 0.2 * bh(floor(vIP * 0.5))), vec3(0.05), open);
					glassK = 0.0;
					vec3 gc = ih < 0.6 ? vec3(0.86, 0.92, 1.0) : vec3(1.0, 0.62, 0.3);
					winGlow = gc * open * smoothstep(0.55, 0.84, dk) * uNightC * 0.75 * step(cond, 0.5) * (0.85 + 0.3 * bh(vec2(floor(u / 6.0), floor(vLY / 3.0))));
				}
				// after dark a wall has only the light that reaches it: the moon and the sky (the
				// lights' own business), the street lamps' spill on the shop fronts at the sidewalk,
				// and its household's own lamps (nightplan.js): the porch light by the front door
				// and the light over the garage, each pooled on the wall round it
				float shopFront = front * (1.0 - roof) * (step(K, 0.5) * step(0.05, vKind) + step(5.5, K) * step(K, 6.5) + step(8.5, K) * step(K, 9.5));
				winGlow += diffuseColor.rgb * (1.0 - win) * shopFront * uNightC * 0.05 * vec3(1.0, 0.8, 0.55) * (1.0 - smoothstep(2.5, 6.0, vLY));
				if ((vNL.x > 0.5 || vNL.z > 0.5) && roof < 0.5 && front > 0.5) {
					float onK = fract(vNL.y), up = smoothstep(onK, onK + 0.12, uNL.y);
					float lpx = fwidth(fx) + fwidth(gy);
					// the porch light: a lantern over a row house's door up its steps, a sconce by a house's
					if (vNL.x > 0.5) {
						float pIdx = floor(vNL.y);
						vec3 pc = pIdx < 0.5 ? vec3(1.0, 0.62, 0.3) : pIdx < 1.5 ? vec3(1.0, 0.74, 0.46) : vec3(0.86, 0.88, 0.9);
						float lv = up * (vNL.x > 30.5 ? 1.0 : 1.0 - smoothstep(vNL.x, vNL.x + 0.08, uNL.x));
						vec2 lp = K < 0.5 ? vec2((step(vKind, 0.15) > 0.5 ? vCS.x - 1.6 : 0.6) + 0.5, 3.25) : vec2(1.25 + clamp((fract(K) - 0.01) / 0.38, 0.0, 1.0) * (vCS.x - 2.5) + vNL.w * 0.78, 1.95);
						vec2 dq = vec2(fx, gy) - lp;
						float r2 = dot(dq, dq);
						float E = ${NIGHT_I.porch.toFixed(2)} / (r2 + 0.3) * mix(1.0, 0.55, step(0.0, dq.y));
						// the lamp itself, a warm point (far off, a pixel's worth of it)
						float core = (1.0 - smoothstep(0.07, 0.07 + lpx, sqrt(r2))) * 14.0 + (1.0 - smoothstep(0.0, lpx * 1.5 + 0.07, sqrt(r2))) * 4.0 * smoothstep(0.08, 0.5, lpx);
						winGlow += pc * lv * (diffuseColor.rgb * E * 0.3183 + core);
					}
					// the light over the garage doors
					if (vNL.z > 0.5) {
						float lv = up * (vNL.z > 30.5 ? 1.0 : 1.0 - smoothstep(vNL.z, vNL.z + 0.08, uNL.x));
						float gcx = K > 7.5 && K < 8.5 ? vCS.x * 0.5 : (garSide < 0.0 ? 0.35 : vCS.x - 5.75) + 2.85;
						vec2 dq = vec2(fx - gcx, gy - 2.5);
						float r2 = dot(dq, dq);
						float E = ${NIGHT_I.garage.toFixed(2)} / (r2 + 0.4) * mix(1.0, 0.4, step(0.0, dq.y));
						float core = (1.0 - smoothstep(0.08, 0.08 + lpx, sqrt(r2))) * 10.0;
						winGlow += vec3(1.0, 0.8, 0.58) * lv * (diffuseColor.rgb * E * 0.3183 + core);
					}
				}
				// the dark windows are not holes: the night sky and the lit city in the glass
				// (faint: dark glass at night shows a little of the city's glow, not a lit grey; a curtain
				// wall of it at the old 0.05 to 0.13 read as a glowing tower)
				winGlow += vec3(0.012, 0.016, 0.024) * win * (1.0 - lit) * uNightC * (0.6 + 0.8 * bh(cid + 9.1));
			}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, glassK);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winGlow;');
	};
	m.customProgramCacheKey = () => 'baybuilding18';
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
	uniform float uScale; varying float vSp; varying vec3 vTint; varying float vD; varying float vFill;
	#include <fog_pars_vertex>
	void main(){
		// (the species plus 10: one of the wild land's near scatter (city.js wildLand), gone by 790 m
		// of you; plus 20: one of its far scatter's, grown past there so the woods keep their cover)
		float code = floor(aSp / 10.0 + 0.01), fill = step(0.5, code) * step(code, 1.5), dH = length((modelMatrix * vec4(position, 1.0)).xz - cameraPosition.xz);
		float gone = smoothstep(650.0, 790.0, dH);
		vFill = fill * gone;
		float size = aSize * (1.0 + 0.45 * gone * step(1.5, code));
		vec4 mvPosition = modelViewMatrix * vec4(position + vec3(0.0, size * 0.5, 0.0), 1.0);
		gl_Position = fill * step(0.999, gone) > 0.5 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * mvPosition;
		gl_PointSize = size * uScale / -mvPosition.z;
		vSp = aSp - 10.0 * code; vTint = aTint; vD = length(mvPosition.xyz);
		#include <fog_vertex>
	}`;
const IMPOSTOR_FRAG = /* glsl */`
	uniform sampler2D uAtlas; uniform vec3 uSunC, uAmb, uSunD; uniform vec4 uBand;
	varying float vSp; varying vec3 vTint; varying float vD; varying float vFill;
	#include <fog_pars_fragment>
	void main(){
		vec2 uv = vec2((gl_PointCoord.x + floor(vSp + 0.5)) / 4.0, 1.0 - gl_PointCoord.y);
		vec4 t = texture2D(uAtlas, uv);
		// dissolve in and out across the hand-over bands, as the other tiers do
		float fade = smoothstep(uBand.x, uBand.y, vD) * (1.0 - smoothstep(uBand.z, uBand.w, vD)) * (1.0 - vFill);
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
const PHONE = GFX_PHONE;       // west of here the sea is the Pacific

export function createCity(shared, scene, bay, real = null) {
	// The city's shared state for the modules its biggest parts moved to (city-blocks.js,
	// city-dressing.js). Each getter and setter reaches the binding of that name here.
	const cc = {
		get bay() { return bay; }, get BRICK() { return BRICK; }, get CANVAS() { return CANVAS; },
		get CARS() { return CARS; }, get COND() { return COND; }, get condFor() { return condFor; },
		get doorKind() { return doorKind; }, get FACE_A() { return FACE_A; }, get FADED() { return FADED; },
		get FENCES() { return FENCES; }, get FLAT() { return FLAT; }, get fract() { return fract; },
		get hash() { return hash; }, get HOUSE() { return HOUSE; }, get jit() { return jit; },
		get KIND() { return KIND; }, get kit2() { return kit2; }, get kitPut() { return kitPut; },
		get lot() { return lot; }, get LX() { return LX; }, get NZ() { return NZ; },
		get OCEAN_X() { return OCEAN_X; }, get PAL() { return PAL; }, get pick() { return pick; },
		get real() { return real; }, get REMODEL() { return REMODEL; }, get ROOF_R() { return ROOF_R; },
		get roofAt() { return roofAt; }, get ROOFED() { return ROOFED; }, get setCond() { return setCond; },
	};
	const group = new THREE.Group();
	group.name = 'bay-city';
	scene.add(group);
	const night = { value: 0 };
	const nearBand = { value: new THREE.Vector2(36, 46) };
	const rise = { value: new THREE.Vector4(0, 0, 0, 0) };
	let riseT0 = -1;
	// (the street lamps near you light the walls by them: world/nightfield.js, the city's own list)
	const mat = addNightField(withRise(buildingMaterial(shared, night, nearBand), rise, 'rise1'), { field: 'SF' });
	const roofMat = withRise(roofDetail(weatherRoofs(new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }))), rise, 'roofrise1');
	const CAP = 32000;
	// (the buildings, their roofs and the skylines are drawn in chunks of CH, a sector at a time
	// round where they were laid out, each left out when it is out of the view or the sun's box:
	// world/instancechunks.js. The meshes written to hold the slots, and are never drawn)
	const CH = 2048, STORE = chunkStore(CAP, CH);
	const boxGeo = () => { const g = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); return g; };
	const mk = (geo, material, cap, kinds) => {
		if (kinds) { geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)); geo.setAttribute('aAge', new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(0.4), 1)); geo.setAttribute('aNear', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));geo.setAttribute('aDetailBirth',new THREE.InstancedBufferAttribute(new Float32Array(cap),1)); geo.setAttribute('aNL', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4)); }
		const im = new THREE.InstancedMesh(geo, material, cap);
		im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
		im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
		group.add(im);
		return im;
	};
	const near = mk(boxGeo(), mat, STORE, true);
	const hipG = roofGeometry(true), gableG = roofGeometry(false);
	for (const g of [hipG, gableG]) { g.setAttribute('aRoof', new THREE.InstancedBufferAttribute(new Float32Array(STORE * 4), 4)); g.setAttribute('aWall', new THREE.InstancedBufferAttribute(new Float32Array(STORE * 3), 3)); }
	const hips = mk(hipG, roofMat, STORE, false), gables = mk(gableG, roofMat, STORE, false);
	// (each chunk also draws in the sun's shadow pass only the bands of distance its box can reach:
	// the whole city went into it, kilometres of it clipped away each frame, world/shadowreach.js)
	const chunked = new Map();
	const chunk = (im, ch, name, gaps = false) => { im.visible = false; im.name = name + '-store'; chunked.set(im, chunkedMesh(im, ch, { parent: group, name, gaps })); };
	chunk(near, CH, 'city-near'); chunk(hips, CH, 'city-hips'); chunk(gables, CH, 'city-gables');
	// (how far a town rising out of the ground has its buildings sunk: RISE_GLSL)
	const SUNK = 36;
	// (an instance's half-size: the corner of its lot, and a roof's overhang and gutter past it)
	const lotHalf = (o) => Math.hypot(o.w || 0, o.d || 0) / 2 + 2;
	// the props of the lived-in streets and on the roofs (lotkit.js)
	const kit2 = createProps(group, (m) => withRise(m, rise, 'kitrise'), PHONE);
	// the cars in the drives and carports and out front of the garages, as kit entries: the
	// street draws them as real cars (streetlife.js), v counting each new set
	let drives = { list: [], v: 0 };
	// the businesses: their boards, awnings and what they put out front (economy/layer.js)
	const economy = createEconomyLayer({ group, wrap: (m) => withRise(m, rise, 'signrise'), isPhone: PHONE, bay, real, KIND });
	// what is on and about the buildings up close: the air conditioners on the flat roofs of
	// the shops, offices and warehouses; a glass sunroom off the back of some houses, a
	// clothesline in some back yards (see decorate)
	// where the rooftop units' near version dissolves into the far one (m: a fan's shroud is under
	// a pixel high past it)
	const AC_LOD = PHONE ? [180, 230] : [260, 310], AC_CAP = 12000, AC_NEAR = PHONE ? 1500 : 3000;
	const kit = (() => {
		const colored = (geo, c) => { const g = geo.toNonIndexed(), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
		const B = (w, h, d, x, y, z, c) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
		const C = (r, h, x, y, z, c, seg = PHONE ? 6 : 14) => colored(new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z), c);
		// a packaged rooftop unit on its curb, its hidden faces left out (lotkit.js), and as it is
		// seen far off, its fans flat discs: the far one holds every unit and dissolves in across
		// AC_LOD, the near one a copy of those within reach of you, dissolving out across it
		// (a phone's fans are six-sided: 583 units on the roofs near the Wharf were 159k triangles,
		// and 3,800 round Noe Valley were 553k)
		const ac = rooftopUnitFar(), acNear = rooftopUnit(PHONE ? 6 : 14);
		// the sunroom: white frames, glass between (two meshes)
		const fr = [0.95, 0.95, 0.93], bars = [];
		for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) bars.push(B(0.02, 1, 0.02, x, 0, -0.5, fr));
		for (const z of [-0.25, 0, 0.25]) for (const x of [-0.5, 0.5]) bars.push(B(0.02, 1, 0.02, x, 0, z, fr));
		for (const y of [0, 0.33, 1]) { bars.push(B(1.02, 0.03, 0.02, 0, y, -0.5, fr)); bars.push(B(0.02, 0.03, 1.0, -0.5, y, 0, fr)); bars.push(B(0.02, 0.03, 1.0, 0.5, y, 0, fr)); }
		bars.push(B(1.06, 0.03, 1.06, 0, 1.0, 0, fr), B(1.04, 0.33, 0.01, 0, 0, -0.5, [0.85, 0.84, 0.8]));
		const sunF = mergeVertices(mergeGeometries(bars));          // (indexed: a corner lit once, not once a triangle)
		const sunG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
		// a clothesline: two T-posts, three lines between, and the washing pegged out
		const post = [0.55, 0.56, 0.57], line = [0.9, 0.9, 0.88], parts = [];
		for (const x of [-2.4, 2.4]) { parts.push(C(0.04, 1.9, x, 0, 0, post, 6), B(0.05, 0.05, 1.0, x, 1.85, 0, post)); }
		for (const z of [-0.4, 0, 0.4]) parts.push(B(4.8, 0.012, 0.012, 0, 1.87, z, line));
		const wash = [[0.9, 0.9, 0.88], [0.3, 0.45, 0.7], [0.85, 0.35, 0.3], [0.95, 0.85, 0.45], [0.5, 0.65, 0.5], [0.95, 0.7, 0.75], [0.25, 0.25, 0.3]];
		for (let k = 0; k < 9; k++) { const w = 0.35 + (k * 37 % 5) * 0.1, h = 0.35 + (k * 53 % 4) * 0.12; parts.push(B(w, h, 0.01, -2 + (k % 3) * 1.5 + (k * 29 % 7) * 0.08, 1.86 - h, [-0.4, 0, 0.4][Math.floor(k / 3)], wash[k % wash.length])); }
		const lineG = mergeVertices(mergeGeometries(parts));
		const M = (o) => withRise(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), rise, 'kitrise');
		// (on a phone the roof and yard kit throws no shadow: every unit was drawn again in the
		// shadow pass, out to the edge of the city, for shadows a few pixels across)
		const mkK = (geo, material, cap) => { const im = new THREE.InstancedMesh(geo, material, cap); im.count = 0; im.frustumCulled = false; im.castShadow = !PHONE; im.receiveShadow = true; group.add(im); return im; };
		const glassM = withRise(new THREE.MeshStandardMaterial({ color: 0xa9c4cf, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.35, depthWrite: false }), rise, 'kitrise');
		const acM = M({ roughness: 0.55, metalness: 0.35 }), acNearM = M({ roughness: 0.55, metalness: 0.35 });
		addLodFade(acM, 'uniform', [AC_LOD[0], AC_LOD[1], NONE_OUT[0], NONE_OUT[1]]); addLodFade(acNearM, 'uniform', [NONE_IN[0], NONE_IN[1], AC_LOD[0], AC_LOD[1]]);
		const acFar = mkK(ac, acM, chunkStore(AC_CAP, 512)), acNearI = mkK(acNear, acNearM, chunkStore(AC_NEAR, 256));
		// (the far units throw no shadow: every one the sun's box can reach is in the near copy;
		// and the near copy is the far one's, so what the far one shows, a unit taken down with
		// its roof included, it shows: structures/damage.js edits only the far)
		acFar.castShadow = false; acNearI.userData.copyOf = acFar;
		// (both drawn in chunks a sector at a time, as the buildings are, out of view left out: the far
		// set holds every unit out to 700 m all round you, world/instancechunks.js. Its store stays
		// under the 20000 instances damage.js takes for the buildings' own)
		chunk(acFar, 512, 'city-ac', true); chunk(acNearI, 256, 'city-ac-near', true);
		// (how far a unit reaches from its foot, at its own size: its chunk's bounds)
		let acR = 0;
		for (const g of [ac, acNear]) { const P = g.attributes.position.array; for (let i = 0; i < P.length; i += 3) acR = Math.max(acR, Math.hypot(P[i], P[i + 2]), P[i + 1]); }
		return {
			ac: acFar, acNear: acNearI, acR,
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
		{ height: 14, lean: 0.3, frondTint: [0.95, 1, 0.9], fronds: 18, nuts: false, palm: true },   // the streets' fan and date palms (streettrees.js)
	];
	// each kind's builder (a palm's has no middle detail of its own: its far one stands in)
	const makeOf = (g) => (g.palm ? (seed, far, mid, gg) => palm(seed, far || mid, gg) : g.conifer ? conifer : hardwood);
	const palmT = { bark: (() => { const t = TX.palmBark(); t.repeat.set(1, 7); return t; })(), frond: TX.palmFrond() };
	const LEAF_REF = [0.25, 0.35, 0.15];
	// the detail levels and where they hand over (metres): each dissolves into the next
	// across a band rather than popping; the far masses dissolve out at the edge
	// (pushed well out, so the hand-overs happen where a tree is small on screen, and the far
	// masses carry the woodland out to where the ground's own painted woods take over)
	// (a phone keeps the leafy middle tier nearer: the far masses take over sooner, and cheaply)
	const LOD = PHONE ? { near: [NONE_IN[0], NONE_IN[1], 150, 175], mid: [150, 175, 430, 470], far: [430, 470, 2000, 2400], shrub: [NONE_IN[0], NONE_IN[1], 260, 300] }
		: { near: [NONE_IN[0], NONE_IN[1], 185, 215], mid: [185, 215, 560, 610], far: [560, 610, 2400, 2800], shrub: [NONE_IN[0], NONE_IN[1], 360, 410] };
	const MARGIN = 45;                                        // the trees are re-placed every 40 m of travel
	const tierMesh = (parts, cap, shadow, band, kind = 3, isPalm = false) => {
		// each tier its own materials, so each can carry its own band
		const mats = isPalm ? [swayMaterial({ map: palmT.bark, roughness: 0.9 }, shared, 1), swayMaterial({ map: palmT.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }, shared, 1)]
			: [swayMaterial({ map: barkT, roughness: 0.95 }, shared, 1), swayMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8)];
		for (const M of mats) addLodFade(M.material, 'uniform', band);
		// photographed bark (with its relief) once it loads; lichen on the oaks' trunks
		if (!isPalm) usePhoto(mats[0].material, [['bark', [2, 3], { mean: 0.8, contrast: 1.2, normal: 3 }, 0.9]]);
		if (!isPalm) mossify(mats[0].material, kind);
		if (kind === 1) lichenLeaves(mats[1].material);
		// lit from below by the yards' and parks' uplights after dark, close by (world/nightfield.js)
		if (band === LOD.near) mats.forEach((S, n) => addNightField(S.material, { wrap: n === 1 ? 0.5 : 0 }));
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
		const make = makeOf(g);
		const nearT = make(9101 + k * 17, false, false, g), midT = make(9101 + k * 17, false, true, g);
		const leafGeo = midT.parts[1];
		// (the impostor's square spans the tree's height or its width, whichever is more)
		const bbAll = new THREE.Box3().setFromBufferAttribute(leafGeo.attributes.position).union(new THREE.Box3().setFromBufferAttribute(midT.parts[0].attributes.position));
		const sizeK = Math.max(bbAll.max.y - Math.max(0, bbAll.min.y), bbAll.max.x - bbAll.min.x, bbAll.max.z - bbAll.min.z) / 0.98 / midT.height;
		return { sizeK, near: tierMesh(nearT.parts, g.palm ? 900 : 2600, true, LOD.near, k, !!g.palm), mid: tierMesh(midT.parts, g.palm ? 3000 : 12000, false, LOD.mid, k, !!g.palm), H: nearT.height, Hm: midT.height };
	});
	const shrubT = shrub(9301), shrubs = tierMesh(shrubT.parts, PHONE ? 5000 : 9000, true, LOD.shrub);
	// the planters' lantana and flax lily (lantana.js): each bed in four levels, the plants in
	// their vertex colours and the foliage's mass in the shrubs' own leaf cards (the same shader)
	const BED = plantingBed(7311);
	// (past about 120 m a bed is a few pixels across: its plainest level, a third of the far one's
	// triangles, takes over there, dissolving in as the rooftop units' far set does; hundreds of far
	// beds were drawn all round you out to 300 m)
	const BED_LOD = PHONE ? { detail: [NONE_IN[0], NONE_IN[1], 5, 7], mid: [5, 7, 40, 48], far: [40, 48, 110, 130], distant: [110, 130, 260, 300] }
		: { detail: [NONE_IN[0], NONE_IN[1], 7, 10], mid: [7, 10, 60, 70], far: [60, 70, 150, 175], distant: [150, 175, 360, 410] };
	const bedTier = (T, band, cap, shadow) => {
		const body = swayMaterial({ side: THREE.DoubleSide, roughness: 0.75 }, shared, 0.7), leaves = swayMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8);
		for (const S of [body, leaves]) addLodFade(S.material, 'uniform', band);
		return [[T.body, body], [T.cards, leaves]].map(([geo, S], n) => {
			const im = new THREE.InstancedMesh(geo, S.material, cap);
			im.count = 0; im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true;
			if (S.depth) im.customDepthMaterial = S.depth;
			if (n === 1) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); }
			group.add(im);
			return im;
		});
	};
	const beds = { detail: bedTier(BED.detail, BED_LOD.detail, 64, !PHONE), mid: bedTier(BED.mid, BED_LOD.mid, PHONE ? 400 : 700, !PHONE), far: bedTier(BED.far, BED_LOD.far, chunkStore(PHONE ? 800 : 1400, 128), false), distant: bedTier(BED.distant, BED_LOD.distant, chunkStore(PHONE ? 2000 : 3500, 128), false), litter: [] };
	// (the far and farthest beds, out to 300 m all round you, drawn in chunks by the sector their
	// planter stands in, as the buildings are: world/instancechunks.js)
	beds.far.forEach((im, k) => chunk(im, 128, 'city-beds-far' + k)); beds.distant.forEach((im, k) => chunk(im, 128, 'city-beds-distant' + k));
	const bedChunks = [...beds.far, ...beds.distant].map((im) => chunked.get(im));
	beds.litter = [(() => { const S = swayMaterial({ side: THREE.DoubleSide, roughness: 0.75 }, shared, 0.7); addLodFade(S.material, 'uniform', BED_LOD.detail); const im = new THREE.InstancedMesh(BED.litter, S.material, 32); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; group.add(im); return im; })()];
	const bedMeshes = [...beds.detail, ...beds.mid, ...beds.litter];
	// sword ferns on the shady forest floor (under the redwoods, on the north slopes, in the draws)
	const fernT = fern(9331, { tint: [0.85, 1.05, 0.8], size: 1.1 }), ferns = [(() => { const S = swayMaterial({ side: THREE.DoubleSide, roughness: 0.8, near: { r: 1.6, cap: 1.2 } }, shared, 0.6); addLodFade(S.material, 'uniform', LOD.shrub); const im = new THREE.InstancedMesh(fernT.parts[0], S.material, PHONE ? 3000 : 7000); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((PHONE ? 3000 : 7000) * 3), 3); group.add(im); return im; })()];
	// the far tier: one point per tree, drawn as its species' impostor
	const atlasCv = document.createElement('canvas');
	atlasCv.width = IMP * 4; atlasCv.height = IMP;
	SPECIES.forEach((g, k) => atlasCv.getContext('2d').drawImage(treeImpostor(makeOf(g)(9101 + k * 17, false, true, g).parts, texAvg), k * IMP, 0));
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
		// (not on a landmark's ground: it is built there, to walk into)
		if (onLandmark(X, Z, Math.max(w, d) / 2)) return;
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
	function grounds(list, trees, x, z, w, d, a, g, y0, kind, seed) { return cityGrounds(cc, list, trees, x, z, w, d, a, g, y0, kind, seed); }

	function fillBlocks(...args) { return cityBlocks(cc, ...args); }

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
	// the pitched roofs as floors, for someone up on one (climbed from the wall: parkour.js), and
	// the buildings' tops as ceilings for someone inside one (no climbing out through the roof)
	function roofFloor(x, z, y) {
		let best = -1e9;
		for (const o of lotsNear(x, z, 1)) {
			if (!o.roof || o.wrecked) continue;
			const ov = o.roof.ov ?? 0.4, c = Math.cos(o.a), sn = Math.sin(o.a), dx = x - o.x, dz = z - o.z, lx = c * dx + sn * dz, lz = -sn * dx + c * dz;
			if (Math.abs(lx) > o.w / 2 + ov || Math.abs(lz) > o.d / 2 + ov) continue;
			const r = roofAt(o, lx, lz);
			if (y > r - 0.6) best = Math.max(best, r);
		}
		return best;
	}
	function ceiling(x, z, y) {
		let best = Infinity;
		for (const o of lotsNear(x, z, 1)) {
			if (o.wrecked || o.h < 2.2) continue;
			const c = Math.cos(o.a), sn = Math.sin(o.a), dx = x - o.x, dz = z - o.z, lx = c * dx + sn * dz, lz = -sn * dx + c * dz;
			if (Math.abs(lx) > o.w / 2 || Math.abs(lz) > o.d / 2) continue;
			if (y > o.y - 0.6 && y < o.y + o.h - 0.4) best = Math.min(best, o.y + o.h);
		}
		return best;
	}
	function decorate(list, cx, cz, R) { return cityDecorate(cc, list, cx, cz, R); }
	const ROOF_R = PHONE ? 200 : 380;
	function kitPut(put, k, e) { if (kit2.has(k)) (put.props[k] || (put.props[k] = [])).push(e); }
	function uploadKit(put) {
		const [acs, suns, lines] = put || [[], [], []];
		// (the units a sector at a time round where the city was laid out, the first AC_CAP of them)
		acAt = lastAt;
		const U = acs.slice(0, AC_CAP).map(([x, y, z, a, s]) => ({ x, y, z, a, s })), O = orderBySector(U, acAt[0], acAt[1], (u) => u.s * kit.acR), C = chunked.get(kit.ac);
		C.begin(acAt[0], acAt[1]);
		for (let i = 0; i < U.length; i++) {
			const { x, y, z, a, s } = U[i], k = C.put(O.sec[i], O.band[i], x, z, s * kit.acR + 0.5, y - SUNK, y + s * kit.acR + 0.5);
			if (k >= 0) { q.setFromAxisAngle(Y, -a); kit.ac.setMatrixAt(k, m4.compose(p.set(x, y, z), q, sc.set(s, s, s))); }
		}
		kit.ac.instanceMatrix.needsUpdate = true;
		C.end();
		let n = 0;
		for (const [x, y, z, a, w, h, d] of suns) { if (n >= kit.sunF.instanceMatrix.count) break; q.setFromAxisAngle(Y, -a); m4.compose(p.set(x, y, z), q, sc.set(w, h, d)); kit.sunF.setMatrixAt(n, m4); m4.compose(p.set(x, y + 0.33 * h, z), q, sc.set(w - 0.16, h * 0.67 - 0.14, d - 0.16)); kit.sunG.setMatrixAt(n++, m4); }      // (the glass well inside its bars, or the two flicker from afar)
		kit.sunF.count = kit.sunG.count = n; n = 0;
		for (const [x, y, z, a, s] of lines) { if (n >= kit.line.instanceMatrix.count) break; q.setFromAxisAngle(Y, -a); kit.line.setMatrixAt(n++, m4.compose(p.set(x, y, z), q, sc.set(s, s, s))); }
		kit.line.count = n;
		for (const im of [kit.sunF, kit.sunG, kit.line]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
		placeAC(acX, acZ);
	}
	// the rooftop units near you, copied from the far set every 40 m you go and whenever the far
	// set changes (a new one laid out, a unit taken down or put back)
	let acX = 1e9, acZ = 1e9, acV = -1, acAt = [0, 0];
	// (written into the near copy's chunks by the sector each stands in round where the far set was laid
	// out, acAt, in the far set's own order)
	function placeAC(x, z) {
		acX = x; acZ = z; acV = kit.ac.instanceMatrix.version;
		const A = kit.ac.instanceMatrix.array, n = kit.ac.count, R2 = (AC_LOD[1] + 45) ** 2, C = chunked.get(kit.acNear), B = kit.acNear.instanceMatrix.array;
		C.begin(acAt[0], acAt[1]);
		for (let i = 0; i < n; i++) {
			const e = i * 16, ux = A[e + 12], uz = A[e + 14];
			// (not one taken down with its roof, nor a gap between the far set's chunks: nothing to draw)
			if ((ux - x) ** 2 + (uz - z) ** 2 > R2 || (!A[e] && !A[e + 1] && !A[e + 2])) continue;
			const s = Math.hypot(A[e], A[e + 1], A[e + 2]), k = C.put(sectorOf(ux, uz, acAt[0], acAt[1], s * kit.acR), 0, ux, uz, s * kit.acR + 0.5, A[e + 13] - SUNK, A[e + 13] + s * kit.acR + 0.5);
			if (k < 0) break;
			for (let j = 0; j < 16; j++) B[k * 16 + j] = A[e + j];
		}
		kit.acNear.instanceMatrix.needsUpdate = true;
		C.end();
	}
	// Neighbouring buildings from the map often overlap by a metre or so (their outlines
	// are fitted as boxes). Where they do, their fronts run a few centimetres apart through
	// each other and flicker at any distance. The smaller one is drawn trimmed back off the
	// larger, along whichever of its own sides overlaps least, leaving a hairline gap.
	// Parts of one building (a house's wings and garage) are meant to overlap and stay.
	// Only the drawn box changes (o.fit); the lot keeps its own place and size.
	function apart(...args) { return cityApart(cc, ...args); }
	const NL0 = [0, 0, 0, 0];
	// (O: each item's sector and band, as orderBySector put the list in order round cx, cz; each
	// building and roof goes to the slot its chunk gives it, o.slot and o.roofSlot)
	function upload(list, body, roofs, O, cx, cz) {
		let placed = 0;
		const C = chunked.get(body), CR = roofs ? roofs.map((im) => chunked.get(im)) : [];
		for (const c of [C, ...CR]) c.begin(cx, cz);
		const births=body.geometry.attributes.aDetailBirth;
		const kinds = body.geometry.attributes.aKind, nearA = body.geometry.attributes.aNear, ages = body.geometry.attributes.aAge, nlA = body.geometry.attributes.aNL;
		if (roofs) slotOf = new Map();
		for (let i = 0; i < list.length; i++) {
			const o = list[i];
			// (drawn at its fitted size where it overlapped a neighbour: apart() below)
			const F = o.fit, ox = F ? F[0] : o.x, oz = F ? F[1] : o.z, ow = F ? F[2] : o.w, od = F ? F[3] : o.d;
			const n = C.put(O.sec[i], O.band[i], ox, oz, Math.hypot(ow, od) / 2 + 0.5, o.y - SUNK, o.y + o.h + 0.5);
			if (n < 0) { if (roofs) o.slot = o.roofSlot = undefined; continue; }
			placed++;
			q.setFromAxisAngle(Y, -o.a); sc.set(ow, o.h, od); p.set(ox, o.y, oz);
			body.setMatrixAt(n, m4.compose(p, q, sc)); body.setColorAt(n, col.setRGB(o.col[0], o.col[1], o.col[2], THREE.SRGBColorSpace)); kinds.array[n] = o.kind; ages.array[n] = (o.age ?? 0.4) + 2 * (o.cond || 0);
			// its household's lights after dark (nightplan.js): the porch light, the garage's
			if (nlA) { const hk = Math.floor(o.kind), on = hk === KIND.house || hk === KIND.row || hk === KIND.houseGarageL || hk === KIND.houseGarageR || hk === KIND.garage, pk = on ? packHouse(housePlan(o, nightSeed(o.x, o.z))) : null; nlA.array.set(pk || NL0, n * 4); }
			const nc = o.src?.grp?.near, dr = roofs && !nc ? doors.get(lotKey(o)) : null;
			births.array[n] = nc ? o.src.grp.nearBorn || 0 : dr ? dr.born ?? 0 : 0;
			nearA.array[n * 3] = nc ? nc[0] : dr ? dr[0] : 0; nearA.array[n * 3 + 1] = nc ? nc[1] : dr ? dr[1] : 0; nearA.array[n * 3 + 2] = nc ? (o.src.grp.detailRadius ? -1-o.src.grp.detailRadius : 1) : dr ? 2 + dr[2] : 0;
			if (roofs && o.src?.grp) { let l = slotOf.get(o.src.grp); if (!l) slotOf.set(o.src.grp, l = []); l.push(n); }
			if (roofs) { o.slot = n; o.roofSlot = undefined; }
			if (o.roof && roofs) {
				const im = o.roof.hip ? roofs[0] : roofs[1], ov = o.ovFit ?? o.roof.ov ?? 0.4, R = o.roof;
				// (its disc: the overhang each side, and the gutters and trim the shader sets out past it)
				const k = (o.roof.hip ? CR[0] : CR[1]).put(O.sec[i], O.band[i], ox, oz, Math.hypot(ow + 2 * ov, od + 2 * ov) / 2 + 2 * ov + 1, o.y + o.h - SUNK - 1, o.y + o.h + R.h + 2);
				if (k < 0) continue;
				o.roofSlot = k;
				p.set(ox, o.y + o.h, oz);
				if (R.rot) { q.setFromAxisAngle(Y, -o.a + Math.PI / 2); sc.set(od + 2 * ov, R.h, ow + 2 * ov); } else sc.set(ow + 2 * ov, R.h, od + 2 * ov);
				im.setMatrixAt(k, m4.compose(p, q, sc)); im.setColorAt(k, col.setRGB(R.col[0], R.col[1], R.col[2], THREE.SRGBColorSpace));
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
		if (nlA) nlA.needsUpdate = true;
		births.needsUpdate=true;body.count = placed; kinds.needsUpdate = true; nearA.needsUpdate = true; ages.needsUpdate = true;
		for (const im of [body, ...(roofs || [])]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
		if (roofs) for (const im of roofs) { im.geometry.attributes.aRoof.needsUpdate = true; im.geometry.attributes.aWall.needsUpdate = true; }
		// (the chunks' bounds and counts, and their views of the store sent up again)
		for (const c of [C, ...CR]) c.end();
		if (roofs) { treeList = list.trees || []; bedList = plantedBeds(list); bedX = bedFarX = 1e9; }
	}
	// the planted planters' beds (city-dressing.js marks them), laid out from the planters as they
	// finally stand: a bed per 1.4 m or so along each, and spent florets on the pavement in front
	function plantedBeds(list) {
		const out = [];
		for (const o of list) {
			if (!o.planted) continue;
			// (the list is in order a sector at a time round where it was laid out: the beds follow it)
			const sec = sectorOf(o.x, o.z, lastAt[0], lastAt[1], lotHalf(o));
			const n = Math.max(1, Math.round((o.w - 0.16) / BED_LEN)), L = (o.w - 0.16) / n, ca = Math.cos(o.a), sa = Math.sin(o.a);
			for (let k = 0; k < n; k++) {
				const u = (k - (n - 1) / 2) * L, x = o.x + ca * u, z = o.z + sa * u;
				// (each one of four ways round: turned or not, mirrored or not)
				out.push({ x, y: o.y + o.h, z, a: o.a, sx: L / BED_LEN, bed: Math.floor(hash(x * 1.7, z * 2.3) * 4), sec });
				const f = o.d / 2 + 0.36;
				out.push({ x: x - sa * f, y: o.planted.kerb, z: z + ca * f, a: o.a, sx: L / BED_LEN, bed: Math.floor(hash(x, z) * 4), litter: true });
			}
		}
		return out;
	}
	// the planters' beds, by distance: their close level reaches only a few metres, so they are
	// re-placed every couple of metres you move (a few hundred beds, quickly done)
	let bedList = [], bedX = 1e9, bedZ = 1e9, bedFarX = 1e9, bedFarZ = 1e9;
	function placeBeds(x, z) {
		const far = Math.hypot(x - bedFarX, z - bedFarZ) > 20;
		bedX = x; bedZ = z;
		if (far) { bedFarX = x; bedFarZ = z; }
		const cn = new Map(), next = (im) => { const c = cn.get(im) || 0; if (c >= im.instanceMatrix.count) return -1; cn.set(im, c + 1); return c; };
		const put = (T) => { const k = next(T[0]); if (k < 0) return; next(T[1]); T[0].setMatrixAt(k, m4); T[1].setMatrixAt(k, m4); };
		// (a chunked level: the plants and their cards in the same slot, the bed's sector its planter's)
		const putC = (T, t) => { const a = [t.sec, 0, t.x, t.z, 1.6, t.y - 1, t.y + 1.3], k = chunked.get(T[0]).put(...a); if (k < 0) return; chunked.get(T[1]).put(...a); T[0].setMatrixAt(k, m4); T[1].setMatrixAt(k, m4); };
		if (far) for (const c of bedChunks) c.begin(x, z);
		for (const t of bedList) {
			const d = Math.hypot(t.x - x, t.z - z);
			if (d > BED_LOD.distant[3] + 25) continue;
			const turn = t.bed & 1, mirror = t.bed & 2 ? -1 : 1;
			q.setFromAxisAngle(Y, -t.a + (turn ? Math.PI : 0));
			m4.compose(p.set(t.x, t.y, t.z), q, sc.set(t.sx * mirror, 1, 1));          // (on its planter, as built: not on the road's grading)
			if (t.litter) { if (d < BED_LOD.detail[3] + 3) { const k = next(beds.litter[0]); if (k >= 0) beds.litter[0].setMatrixAt(k, m4); } continue; }
			if (d < BED_LOD.detail[3] + 3) put(beds.detail);
			if (d > BED_LOD.mid[0] - 3 && d < BED_LOD.mid[3] + 3) put(beds.mid);
			if (far && d > BED_LOD.far[0] - 25 && d < BED_LOD.far[3] + 25) putC(beds.far, t);
			if (far && d > BED_LOD.distant[0] - 25) putC(beds.distant, t);
		}
		for (const im of bedMeshes) { im.count = cn.get(im) || 0; im.instanceMatrix.needsUpdate = true; }
		if (far) { for (const im of [...beds.far, ...beds.distant]) im.instanceMatrix.needsUpdate = true; for (const c of bedChunks) c.end(); }
	}

	// the trees by distance from you, re-sorted as you walk: leaf-card trees close by,
	// simpler leaf-card trees further out, smooth masses far away
	let treeList = [], treeX = 1e9, treeZ = 1e9, treeGV = -1;
	function placeTrees(x, z) {
		treeX = x; treeZ = z; treeGV = gradeVersion();
		const cn = new Map(), next = (im) => { const c = cn.get(im) || 0; if (c >= im.instanceMatrix.count) return -1; cn.set(im, c + 1); return c; };
		let nf = 0;
		const aut = autumnNow();          // the deciduous street trees' autumn (streettrees.js)
		for (const t of treeList) {
			const d = Math.hypot(t.x - x, t.z - z);
			const yaw = hash(t.x * 3.1, t.z * 1.7) * 6.283;
			q.setFromAxisAngle(Y, yaw);
			const tc = t.fall ? treeColour(t, aut) : t.col, lo = t.fall ? 0.35 : 0.65, hi = t.fall ? 2.6 : 1.35;
			const tint = [0, 1, 2].map((c) => Math.min(hi, Math.max(lo, tc[c] / LEAF_REF[c])));
			// (the ground as drawn: the roads' banks and cuts near you, berms.js, lift or lower the
			// trees beside them, else a tree on a cut road's verge hangs in the air)
			const gy = d < 300 ? t.y + roadDelta(t.x, t.z) : t.y;
			if (t.fern) {
				if (d > LOD.shrub[3] + MARGIN) continue;
				const k = next(ferns[0]); if (k < 0) continue;
				const s2 = t.h / fernT.height;
				m4.compose(p.set(t.x, gy, t.z), q, sc.set(s2, s2, s2));
				ferns[0].setMatrixAt(k, m4); ferns[0].setColorAt(k, col.setRGB(tint[0], tint[1], tint[2]));
				continue;
			}
			if (t.shrub) {
				if (d > LOD.shrub[3] + MARGIN) continue;
				const k = next(shrubs[0]); if (k < 0) continue; next(shrubs[1]);
				const s2 = t.h / 1.3;
				m4.compose(p.set(t.x, gy, t.z), q, sc.set(s2, s2 * 0.9, s2));
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
				const s2 = t.h / H, sw = s2 * (t.nx || 1);
				m4.compose(p.set(t.x, gy + 0.2, t.z), q, sc.set(sw, s2, sw));
				tier[0].setMatrixAt(k, m4); tier[1].setMatrixAt(k, m4); tier[1].setColorAt(k, col.setRGB(tint[0], tint[1], tint[2]));
			}
			if (d < LOD.far[0] - MARGIN) continue;
			// far: one point, drawn as its species' picture, tinted like the tree
			if (nf >= TCAP) continue;
			fp.pos[nf * 3] = t.x; fp.pos[nf * 3 + 1] = gy + 0.2; fp.pos[nf * 3 + 2] = t.z;
			fp.size[nf] = t.h * T.sizeK; fp.sp[nf] = sp + (t.fill ? 10 : t.wild ? 20 : 0);
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
	const SKY = 6000, SKY_CH = 1024, skyMesh = mk(boxGeo(), mat, chunkStore(SKY, SKY_CH), true);
	chunk(skyMesh, SKY_CH, 'city-skyline', true);
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
		// ...and the mapped cities' real towers, loaded or not
		for (let k = 0; k < REAL_TALL.length; k += 6) {
			const [x, z, w, d, a, h] = REAL_TALL.slice(k, k + 6), g = bay.heightAt(x, z);
			if (g < 0.5 || onLandmark(x, z, Math.max(w, d) / 2)) continue;
			skyline.push({ x, y: g - 1.2, z, w, d, h: h + 1.2, a, col: jit(pick(PAL.tower, hash(x, z)), hash(z, x)), kind: KIND.tower, roof: null });
		}
		skylineBeside(lastList);
	}
	// A tower near enough to be built is drawn by the near buildings; its far copy in the
	// skyline would stand in the same place a few centimetres off and flicker through it
	// (and cover its doorway and its rooms), so the skyline leaves those out.
	let lastList = [], skySig = 0, skyN = -1, lastAt = [0, 0];
	function skylineBeside(list) {
		lastList = list;
		const G = new Map(), cell = 30, key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
		for (const o of list) if (o.h > 12 && o.w) (G.get(key(o.x, o.z)) || G.set(key(o.x, o.z), []).get(key(o.x, o.z))).push(o);
		const drawn = (t) => {
			for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const o of G.get(key(t.x + i * cell, t.z + j * cell)) || []) {
				const ca = Math.cos(o.a || 0), sa = Math.sin(o.a || 0), dx = t.x - o.x, dz = t.z - o.z;
				if (Math.abs(ca * dx + sa * dz) < o.w / 2 && Math.abs(-sa * dx + ca * dz) < o.d / 2) return true;
			}
			return false;
		};
		const keep = G.size ? skyline.filter((t) => !drawn(t)) : skyline;
		// (only sent to the graphics card again when the set changed: six thousand towers)
		let sig = keep.length;
		for (let k = 0; k < keep.length; k++) sig = (sig * 31 + Math.round(keep[k].x * 7 + keep[k].z * 13)) | 0;
		if (sig === skySig && skyN === skyline.length) return;
		skySig = sig; skyN = skyline.length;
		keep.noGrounds = true;
		// (more than it holds: the nearest round where the city was last laid out; then a sector at
		// a time round there, nearest first in each, the skyline's own order kept)
		const sky = keep === skyline ? skyline.slice() : keep;
		if (sky.length > SKY) { orderByReach(sky, lastAt[0], lastAt[1], lotHalf); sky.length = SKY; }
		upload(sky, skyMesh, null, orderBySector(sky, lastAt[0], lastAt[1], lotHalf), lastAt[0], lastAt[1]);
	}

	// ---------- landmarks ----------
	const white = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 });
	const glassM = new THREE.MeshStandardMaterial({ color: 0xb8c4cc, roughness: 0.25, metalness: 0.5 });
	const redwhite = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.6, metalness: 0.2 });
	const steelGrey = new THREE.MeshStandardMaterial({ color: 0x8e9498, roughness: 0.5, metalness: 0.4 });
	// (lit at night by their floodlights: floodlights.js, world/nightfield.js's landmark list)
	for (const m of [white, glassM, redwhite, steelGrey]) addNightField(m, { field: 'LF' });
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
	// a house's colours, from where it stands: its era's (decor.js; houses.js builds the near
	// house from the same look), the tracts' roofs as they are from the air
	function houseLook(b) {
		const r = hash(Math.round(b.x / 9) * 3.7, Math.round(b.z / 9) * 1.9);
		const r2 = hash(Math.round(b.x / 9) * 5.3 + 1, Math.round(b.z / 9) * 2.3 + 7);
		const era = houseEra(b.x, b.z, { era: b.look?.era }), L = exteriorLook(era, seedAt(b.x, b.z));
		if (era === 'tract') { L.roof = pick(REAL_ROOF, hash(Math.round(b.x / 9) + 11, Math.round(b.z / 9) + 5)); L.roofT = L.roof[0] > L.roof[2] * 1.4 ? ROOF.barrel : r2 < 0.6 ? ROOF.flatTile : ROOF.shingle; }
		return { r, r2, ...L };
	}
	// a house built for real (at c) or given back (null): its blocks hand over, or come back
	function setNear(grp, c) {
		updateDetailClock();grp.near = c;
		const l = slotOf.get(grp), nearA = near.geometry.attributes.aNear;
		if (!l) return;
		for (const n of l) { near.geometry.attributes.aDetailBirth.array[n]=grp.nearBorn || 0; nearA.array[n * 3] = c ? c[0] : 0; nearA.array[n * 3 + 1] = c ? c[1] : 0; nearA.array[n * 3 + 2] = c ? (grp.detailRadius ? -1-grp.detailRadius : 1) : 0; }
		near.geometry.attributes.aDetailBirth.needsUpdate=true;nearA.needsUpdate = true;
	}
	// ---------- the gridded towns' buildings, for walking into (interiors/, houses.js, commercial.js) ----------
	// a lot's own key (the grid puts it in the same place every time the list is rebuilt)
	const lotKey = (o) => Math.round(o.x * 4) + ':' + Math.round(o.z * 4);
	// buildings with their rooms built inside keep their block, its front door cut out:
	// key -> [door x across the front from the centre, sill above the block's foot, width]
	const doors = new Map();
	// (a building with its rooms built for real near you shows them through its own windows:
	// the economy's painted shopfront on it goes, economy/storefront.js)
	economy.setBuilt((o) => !!o.wrecked || !!o.src?.grp?.near || doors.has(lotKey(o)));
	function setDoor(o, v) {
		const k = lotKey(o);
		// (when its rooms were built: its glass clears from then, not all at once)
		if (v) { const was = doors.get(k); v.born = was?.born ?? updateDetailClock(); doors.set(k, v); } else doors.delete(k);
		// (the list is rebuilt as you travel: the lot as it stands in the current one)
		const cur = lotsNear(o.x, o.z, 0.5).find((q) => lotKey(q) === k);
		if (!cur || cur.slot === undefined || cur.src?.grp?.near) return;
		const nearA = near.geometry.attributes.aNear, n = cur.slot;
		nearA.array[n * 3] = v ? v[0] : 0; nearA.array[n * 3 + 1] = v ? v[1] : 0; nearA.array[n * 3 + 2] = v ? 2 + v[2] : 0;
		const births = near.geometry.attributes.aDetailBirth;
		births.array[n] = v ? v.born : 0;
		nearA.needsUpdate = true; births.needsUpdate = true;
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
			const house = Math.floor(o.kind) === KIND.house && o.kind > 1.005 && o.roof, biz = !commercialStack(o.kind === KIND.office ? 5 : o.kind === KIND.retail ? 6 : 0,o.w,o.d,o.h-1.2) && (o.kind === KIND.retail || (o.kind === KIND.office && o.h <= 20)) && o.w * o.d > 60 && o.w * o.d < 6000 && Math.min(o.w, o.d) > 6;
			if (!house && !biz) continue;
			// (a house boarded up or burnt out stays shut: no rooms built in it)
			if (house && (o.cond === COND.boarded || o.cond === COND.burnt)) continue;
			const key = lotKey(o);
			let grp = procGrp.get(key);
			if (!grp) {
				if (house) {
					const door = Math.min(1, Math.max(0, ((o.kind - 1) - 0.01) / 0.38));
					grp = [{ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, wallH: o.h - 1.2, roofH: o.roof.h, kind: 0, door, hip: o.roof.hip ? 1 : 0, look: { wall: o.col, roof: o.roof.col, garage: null, era: o.era } }];
					const [gi, gj] = [Math.floor(o.x / 24), Math.floor(o.z / 24)];
					let hasG = false;
					for (let j = gj - 1; j <= gj + 1 && grp.length < 4; j++) for (let i = gi - 1; i <= gi + 1 && grp.length < 4; i++) for (const g of gar.get(i + ',' + j) || []) {
						if (g.src || !touch(o, g) || grp.some((q) => q.lot === g)) continue;
						if (g.kind === KIND.garage) { if (hasG) continue; hasG = true; grp.push({ x: g.x, z: g.z, w: g.w, d: g.d, a: g.a, wallH: 3.0, roofH: Math.min(1.6, g.roof?.h || 1.2), kind: 3, door: 0.5, hip: g.roof?.hip ? 1 : 0, lot: g }); } else grp.push({ x: g.x, z: g.z, w: g.w, d: g.d, a: g.a, wallH: g.h - 1.2, roofH: g.roof?.h || 1.2, kind: 4, door: 0.5, hip: g.roof?.hip ? 1 : 0, lot: g, look: { wall: g.col, roof: g.roof?.col || o.roof.col, garage: null } });
					}
				} else {
					const b = { x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, wallH: o.h - 1.2, look: {wall:o.col}, roofH: 0, kind: o.kind === KIND.retail ? 6 : 5, door: 0.5, hip: 0 };
					grp = [b]; b.grp = grp; grp.biz = true;
				}
				procGrp.set(key, grp);
			}
			grp.stamp = procStamp;
			if (!grp.biz) {
				const floor=houseFloor(grp,bay.heightAt), member=grp[0];
				o.h=floor+wallTop(member)-o.y;
				for(const m of grp) if(m.lot) for(const g of gar.get(cellK(m.x,m.z))||[]) if(Math.abs(g.x-m.x)<.05&&Math.abs(g.z-m.z)<.05) {g.h=floor+wallTop(m)-g.y;g.col=grp[0].look.wall;if(g.roof) g.roof.col=grp[0].look.roof;}
			}
			o.src = grp.biz ? grp[0] : { grp };
			// (its garage hands over with it)
			for (const m of grp) if (m.lot) for (const g of gar.get(cellK(m.x, m.z)) || []) if (Math.abs(g.x - m.x) < 0.05 && Math.abs(g.z - m.z) < 0.05) g.src = { grp };
		}
		// (forget the ones long behind you)
		if (procGrp.size > 3000) for (const [k, g] of procGrp) if (!g.near && procStamp - g.stamp > 3) procGrp.delete(k);
	}
	const procNear = (x, z, r, biz) => { const out = []; for (const g of procGrp.values()) if (g.stamp === procStamp && !!g.biz === biz && Math.hypot(g[0].x - x, g[0].z - z) < r) out.push(g); return out; };
	// every building round a point, from the last list (for walls to walk into)
	// (40 m cells, a row of them to each z: every wall push asks, once a body, every frame, so the
	// cells go by number, not by a string made each time; and a cell keeps the half of its widest,
	// so one too far for any of its own to reach is passed by whole)
	let lotGrid = new Map();
	function indexLots(list) {
		const G = new Map();
		for (const o of list) {
			if (o.h < 0.9 || o.kind === KIND.pool || !o.w) continue;
			const i = Math.floor(o.x / 40), j = Math.floor(o.z / 40), row = G.get(j) || G.set(j, new Map()).get(j);
			const cell = row.get(i) || row.set(i, { lots: [], half: 0 }).get(i), h = Math.max(o.w, o.d) / 2;
			cell.lots.push(o);
			if (h > cell.half) cell.half = h;
		}
		lotGrid = G;
	}
	function lotsNear(x, z, r) {
		const out = [], i0 = Math.floor((x - r - 60) / 40), i1 = Math.floor((x + r + 60) / 40);
		for (let j = Math.floor((z - r - 60) / 40); j <= Math.floor((z + r + 60) / 40); j++) {
			const row = lotGrid.get(j);
			if (!row) continue;
			const gz = Math.max(0, j * 40 - z, z - (j + 1) * 40);
			for (let i = i0; i <= i1; i++) {
				const cell = row.get(i);
				if (!cell) continue;
				// (how near the cell's square comes, a millimetre kept for the rounding at its edges)
				const gx = Math.max(0, i * 40 - x, x - (i + 1) * 40), reach = r + cell.half + 1e-3;
				if (gx * gx + gz * gz > reach * reach) continue;
				for (const o of cell.lots) {
					// (off by more than its reach along either axis: out, without the square root)
					const lim = r + Math.max(o.w, o.d) / 2, dx = o.x - x, dz = o.z - z;
					if (dx > lim + 1e-6 || -dx > lim + 1e-6 || dz > lim + 1e-6 || -dz > lim + 1e-6) continue;
					if (Math.hypot(dx, dz) < lim) out.push(o);
				}
			}
		}
		return out;
	}
	// a mapped pool only where one would be dug: a level yard below the hills, on land people
	// live on (not a park, a school, a golf course or a nature reserve); worked out once
	const POOL_LAND = new Set([0, 1, 11, 13]);
	const HOME_LAND = new Set([1, 13]);
	function poolOK(p) {
		if (p.ok !== undefined) return p.ok;
		const ca = Math.cos(p.a), sa = Math.sin(p.a);
		let lo = 1e9, hi = -1e9;
		for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
			const lx = u * (p.w / 2 + 1), lz = v * (p.d / 2 + 1), h = bay.heightAt(p.x + ca * lx - sa * lz, p.z + sa * lx + ca * lz);
			lo = Math.min(lo, h); hi = Math.max(hi, h);
		}
		const L = real.landAt?.(p.x, p.z);
		const ok = hi < 300 && hi - lo < 1.2 && (!L || POOL_LAND.has(L.lu));
		// (kept once the land map is in to say what the land is)
		if (L) p.ok = ok;
		return ok;
	}
	const REAL_ROOF = [[0.3, 0.31, 0.33], [0.24, 0.25, 0.27], [0.36, 0.36, 0.37], [0.4, 0.39, 0.38], [0.33, 0.3, 0.28], [0.42, 0.33, 0.27], [0.5, 0.3, 0.22], [0.46, 0.27, 0.2], [0.28, 0.29, 0.32], [0.38, 0.35, 0.33]];
	// the life round a mapped (or grown) house, kept to its own footprint's frame: a car or two
	// on the drive in front of the garage, the bins, the AC unit down the side, now and then
	// a hoop, an RV or a boat, a shed out back where the land map shows open yard
	const YARD_R = PHONE ? 220 : 420;
	function realYard(list, b, look, g, cnd) {
		const P = list.props || (list.props = {}), ca = Math.cos(b.a), sa = Math.sin(b.a), W = (lx, lz) => [b.x + ca * lx - sa * lz, b.z + sa * lx + ca * lz];
		const put = (k, lx, lz, yaw, sc, c, lift = 0, tilt = 0) => { if (!kit2.has(k)) return; const [x, z] = W(lx, lz), gy = bay.heightAt(x, z); if (Math.abs(gy - g) > 2.5) return; const e = [x, gy + lift, z, b.a + yaw, ...(typeof sc === 'number' ? [sc, sc, sc] : sc), tilt]; if (c) e.push(...c); (P[k] || (P[k] = [])).push(e); };
		const hr = (n) => hash(b.x * 0.71 + n * 5.3, b.z * 1.13 - n * 2.1);
		const open = (lx, lz) => { const [x, z] = W(lx, lz), L = real.landAt?.(x, z); return !L || (L.roof < 0.1 && L.road < 0.1); };
		// where the garage is, as the house is built (houseplan.js: built in at one end of the
		// front, or a wing), and which way its drive runs out to the street (realcity.js: the
		// mapped one, or the one made for it); the cars stand on the drive before the doors
		const gar = b.grp ? garageOf(b.grp) : null, D = gar?.doors || [];
		let gx = null, gz = null, ux = -sa, uz = ca;
		if (D.length) {
			gx = (D[0].x0 + D[D.length - 1].x1) / 2; gz = gar.front;
			const [dx, dz] = W(gx, gz);
			let bd = 4.5;
			for (const q of real.near('paths', dx, dz, 20)) {
				if (q.w < 2.2) continue;
				for (const [ax, az, bx, bz] of [[q.ax, q.az, q.bx, q.bz], [q.bx, q.bz, q.ax, q.az]]) {
					const d = Math.hypot(ax - dx, az - dz), L = Math.hypot(bx - ax, bz - az) || 1, vx = (bx - ax) / L, vz = (bz - az) / L;
					if (d < bd && vx * -sa + vz * ca > 0.3) { bd = d; ux = vx; uz = vz; }
				}
			}
		}
		const turn = Math.atan2(-ux, uz) - b.a;
		// (a car's place: before door k, its middle s metres down the drive, in the house's frame)
		const onDrive = (k, s) => { const [dx, dz] = W((D[k].x0 + D[k].x1) / 2, gz), px = dx + ux * s - b.x, pz = dz + uz * s - b.z; return [ca * px + sa * pz, -sa * px + ca * pz]; };
		if (gx !== null && !cnd) {
			const c0 = onDrive(0, 3.2), c1 = D.length > 1 && onDrive(1, 3.2);
			if (hr(1) < 0.55 && open(...c0)) put('car', ...c0, turn, 1, pick(CARS, hr(2)));
			if (c1 && hr(1) < 0.2 && open(...c1)) put('car', ...c1, turn, 1, pick(CARS, hr(3)));
			if (hr(4) < 0.35) put('bins', gx + Math.sign(gx || 1) * 3.4, gz + 1.2, 0, 1);
			if (hr(5) < 0.06) put('hoop', gx + 2.2, gz + 0.2, 0, 1);
			if (hr(6) < 0.035 && open(gx + Math.sign(gx || 1) * 4.2, gz + 4.5)) put(hr(7) < 0.55 ? 'rv' : 'boat', gx + Math.sign(gx || 1) * 4.2, gz + 4.5, 0, 1);
		}
		if (hr(8) < 0.6) { const s = hr(9) < 0.5 ? -1 : 1; if (open(s * (b.w / 2 + 0.7), 0)) put('cond', s * (b.w / 2 + 0.7), -b.d * 0.1, 0, 1); }
		if (hr(10) < 0.16) { const s = hr(11) < 0.5 ? -1 : 1, lx = s * (b.w / 2 - 2), lz = -b.d / 2 - 9; if (open(lx, lz) && open(lx + 2, lz - 2) && open(lx - 2, lz + 2)) { const [x, z] = W(lx, lz), gy = bay.heightAt(x, z); if (Math.abs(gy - g) < 1.5) list.push({ x, y: gy - 1.2, z, w: 2.8, d: 2.4, h: 3.5, a: b.a + Math.PI, col: hr(12) < 0.5 ? [0.6, 0.55, 0.45] : look.wall, kind: KIND.garage, roof: { hip: false, rot: true, h: 0.9, col: look.roof, t: hr(12) < 0.3 ? ROOF.metal : ROOF.shingle, ov: 0.2, trim: 3 }, age: 0.5 }); } }
		if (cnd) { if (hr(13) < 0.45 && gx !== null) put('car', ...onDrive(0, 3.4), turn + (hr(14) - 0.5) * 0.5, [1, 0.94, 1], pick(FADED, hr(15)), -0.09, 0.03); }
	}
	// the generated blocks stop where a mapped region starts: what stands on its side of the
	// seam is its own (a block half over the line keeps only its lots on this side)
	function clipMapped(list) {
		if (!real?.loaded()) return;
		const out = (o) => !real.inside(o.x, o.z);
		let n = 0;
		for (const o of list) if (out(o)) list[n++] = o;
		list.length = n;
		if (list.trees) list.trees = list.trees.filter(out);
		for (const k in list.props || {}) list.props[k] = list.props[k].filter((e) => !real.inside(e[0], e[2]));
	}
	function* realBuildings(cx, cz, R, list, wild = true) {
		if (!real?.loaded()) return;
		let n = 0;
		const trees = list.trees || (list.trees = []);
		const floors = new Map();
		for (const b of real.near('boxes', cx, cz, R)) {
			if ((++n & 511) === 0) yield;
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
			else if (b.kind === 12) { kind = KIND.office + 0.3; col = jit([0.6, 0.59, 0.56], r); }        // a parking garage: open concrete decks (ribbon openings, lit at night: the building shader)
			else { kind = KIND.industry; col = jit(pick(PAL.industry, r2), r); }
			// (a tall block mapped as a garage or a shed is an office block: glazed, not a blank wall)
			if ((kind === KIND.garage || kind === KIND.plain) && top - y > 9) { kind = KIND.office; col = jit(pick(PAL.office, r2), r); }
			if (b.roofH > 0.1) { roof = { hip: !!b.hip, h: b.roofH, col: rc }; if (home && look.roofT !== undefined) { roof.t = look.roofT; roof.trim = look.roofTrim; } }
			if (b.kind >= 5) b.look = { wall: col, roof: rc };
			const ro = { x: b.x, y, z: b.z, w: b.w, d: b.d, h: top - y, a: b.a, col, kind, roof, src: b, age: ageFor(STYLE.suburb, kind, b.x, b.z) };
			list.push(ro);
			// a grown town's houses and blocks weather and fall into neglect like the gridded
			// ones (the surveyed ones are left as they are)
			if (b.gen && kind !== KIND.garage) setCond(ro, condFor(ro, isHome(b) ? 0.05 : 0.02));
			if (b.grp && (ro.cond === COND.boarded || ro.cond === COND.burnt)) b.grp.shut = true;
			// (the radio huts and ranger posts high on the wild ridges are nobody's home: no yard)
			if (home === b && (b.x - cx) ** 2 + (b.z - cz) ** 2 < YARD_R * YARD_R && !(g > 600 && !HOME_LAND.has(real.landAt?.(b.x, b.z)?.lu))) realYard(list, b, look, g, ro.cond);
			if (b.kind >= 5 && b.kind !== 10) grounds(list, trees, b.x, b.z, b.w, b.d, b.a, g, y, kind, b.x * 0.37 + b.z * 0.11);
		}
		for (const p of real.near('pools', cx, cz, Math.min(R, 900))) {
			const g = bay.heightAt(p.x, p.z);
			if (g > 0.5 && poolOK(p)) list.push({ x: p.x, y: g - 0.9, z: p.z, w: p.w, d: p.d, h: 0.99, a: p.a, col: [0.9, 0.89, 0.85], kind: KIND.pool, roof: null });
		}
		yield;
		// (out on the globe the wild land and its creeks are the globe's own: globetrees.js)
		if (wild) {
			wildLand(cx, cz, 1100, trees);
			yield;
			wildLand(cx, cz, 2700, trees, true, 1100);        // beyond: a coarser, cheaper scatter for the far masses
			yield;
			// the willows, sycamores and redwoods along the San Lorenzo (sanlorenzo.js)
			for (const t of riverTreesNear(cx, cz, 2700)) trees.push(t);
			// ...and along every other creek and river's wild banks (water.js)
			for (const t of waterTreesNear(cx, cz, 2700)) trees.push(t);
		}
		for (const t of real.near('trees', cx, cz, 2700)) {
			if ((++n & 2047) === 0) yield;
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
	// (the far scatter's cells are two of the near's to a side, and in the near scatter the corner
	// cell of every two by two is the far scatter's own: across the hand-over a tree stays where it
	// is, it never jumps to another spot as you move)
	const WILD_C = 13, WILD_FAR_C = 26;
	function wildLand(cx, cz, R, trees, far = false, rIn = 0) {
		if (!real?.landAt) return;
		const C = far ? WILD_FAR_C : WILD_C;
		// (a few cells over the edge: a tree can stand off its cell's own square)
		for (let gz = Math.floor((cz - R) / C) - 3; gz <= Math.floor((cz + R) / C) + 3; gz++) for (let gx = Math.floor((cx - R) / C) - 3; gx <= Math.floor((cx + R) / C) + 3; gx++) {
			const rep = far || (!(gx & 1) && !(gz & 1)), n0 = trees.length;
			if (rep && !far) wildCell(gx >> 1, gz >> 1, WILD_FAR_C, false, cx, cz, R, rIn, trees);
			else wildCell(gx, gz, C, far, cx, cz, R, rIn, trees);
			// (the near scatter's own: its trees fade out well inside its reach, by your distance
			// as you go, so none is ever seen to come or go when the scatter is laid out again;
			// only the far scatter's carry on past them, IMPOSTOR_VERT)
			for (let k = n0; k < trees.length; k++) { if (rep && trees[k].x === wildAt[0] && trees[k].z === wildAt[1]) trees[k].wild = true; else if (!far) trees[k].fill = true; }
		}
	}
	const wildAt = [0, 0];
	// one cell of the wild land's scatter
	function wildCell(gx, gz, C, far, cx, cz, R, rIn, trees) {
		const H = (x, z) => bay.heightAt(x, z);
		const r = hash(gx * 1.7 + 11, gz * 2.3 + 5);
		if (r > 0.62) return;                                                  // most cells are open ground
		const x = (gx + hash(gx, gz * 3) * 1.6 - 0.3) * C, z = (gz + hash(gx * 5, gz) * 1.6 - 0.3) * C;
		wildAt[0] = x; wildAt[1] = z;
		const dd = (x - cx) * (x - cx) + (z - cz) * (z - cz);
		if (dd > R * R || dd < rIn * rIn) return;
		// open country: the mapped wild land, or anywhere beyond the maps the towns don't reach
		const inR = real.inside(x, z);
		if (inR) {
			const L = real.landAt(x, z);
			if (!L || (L.lu !== 0 && L.lu !== 11 && L.lu !== 12) || L.road > 0.2 || L.roof > 0.2) return;
		} else if (bay.urbanAt(x, z).u > 0.06) return;
		const h = H(x, z);
		if (h < 3) return;
		const e = 18, hxp = H(x + e, z), hxm = H(x - e, z), hzp = H(x, z + e), hzm = H(x, z - e);
		const slope = Math.hypot(hxp - hxm, hzp - hzm) / (2 * e);
		if (slope > 1.1) return;                                                 // bare rock
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
		if (planted && r2 < 0.42) { trees.push(r2 < 0.24 ? { x, y: g, z, h: 16 + r2 * 40, cone: true, sp: 2, col: tint([0.1, 0.17, 0.08]) } : { x, y: g, z, h: 12 + r2 * 14, sp: 0, col: tint([0.2, 0.28, 0.12]) }); return; }      // (Monterey cypress and pine; eucalyptus)
		const windswept = !planted && fog > 0.5 && (H(x - 900, z) < -2 || H(x - 2200, z) < -2 || H(x, z + 1500) < -2 && x < 12000);
		const draw = windswept ? (H(x + 60, z) + H(x - 60, z) + H(x, z + 60) + H(x, z - 60) - 4 * h) / 4 : 0;
		if (windswept && (draw < 7 || r2 > wood * 0.3) && r2 < wood * 0.8) { if (!far && r2 < 0.5) trees.push({ x, y: g, z, h: 0.9 + r2 * 1.2, shrub: true, col: tint([0.28, 0.33, 0.2]) }); return; }
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

	let lastX = 1e9, lastZ = 1e9, started = false, realSeen = false, realV = 0, genV = 0, clearV = -1, coastV = 0, carveV = -1, waterV = -1;
	// a town grown by civgen.js near a point (anywhere on Earth)
	const grownNear = (x, z) => !!real?.R?.regions?.some((G) => G.gen && x > G.bounds[0] - 2000 && z > G.bounds[1] - 2000 && x < G.bounds[2] + 2000 && z < G.bounds[3] + 2000);
	function update(cam, nightK) {
		// past the Bay only the grown towns are raised here (their streets, houses and businesses,
		// as civ.js grows them anywhere on Earth); the Bay's grid, woods and skylines stay home
		const globe = !bay.loaded();
		if (globe && !grownNear(cam.position.x, cam.position.z)) return;
		night.value = nightK;
		economy.setNight(nightK);
		// the landmark towers' glass: lit floors behind it after dark, not a black slab
		glassM.emissive.setRGB(0.9, 0.78, 0.6).multiplyScalar(0.22 * nightK);
		if (!started && !globe) { started = true; findSkylines(); landmarks(); bayBridge(); }
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y > 4000;
		for (const im of [near, hips, gables]) chunked.get(im).root.visible = !high;
		farPts.visible = !high;
		for (const im of [...shrubs, ...ferns, ...bedMeshes, ...treeTiers.flatMap((T) => [...T.near, ...T.mid])]) im.visible = !high;
		for (const c of bedChunks) c.root.visible = !high;
		if (!realSeen && real?.loaded()) { realSeen = true; lastX = 1e9; }                   // the real city arrived: rebuild
		if (clearingVersion() !== clearV) { clearV = clearingVersion(); lastX = 1e9; }          // a ball field laid out nearby: its trees go
		if (coastVersion() !== coastV) { coastV = coastVersion(); lastX = 1e9; }                // the coast's farms and links laid out: theirs go
		if (carveVersion() !== carveV) { carveV = carveVersion(); if (carveNear(x, z, 3000)) lastX = 1e9; }     // a river carved nearby: the ground under the trees moved
		if (waterVersion() !== waterV) { waterV = waterVersion(); lastX = 1e9; }                  // trees stood up along the creeks near you
		if (real?.version && real.version() !== realV) { realV = real.version(); lastX = 1e9; }          // a mapped region came or went near you
		// a grown town arrived or went: it rises, and its towers join the skylines
		if (real?.genVersion && real.genVersion() !== genV) { genV = real.genVersion(); lastX = 1e9; if (!globe) { skyline.length = 0; findSkylines(); } if (realSeen) { riseT0 = performance.now(); rise.value.set(x, z, 0, 1); } }
		if (riseT0 >= 0) {
			// the ring runs out at 700 m a second; no shadows from the buildings still underground
			const front = (performance.now() - riseT0) / 1000 * 700;
			rise.value.z = front;
			const on = front < 2600;
			if (!on) { riseT0 = -1; rise.value.w = 0; }
			for (const im of [near, hips, gables]) chunked.get(im).setShadow(!on);
		}
		// (the near rooftop units kept up as you go, a rebuild under way or not: 45 m past their band)
		if (Math.hypot(x - acX, z - acZ) > 40 || kit.ac.instanceMatrix.version !== acV) placeAC(x, z);
		// the buildings round you again every 300 m, a few milliseconds a frame (the ones standing
		// stay drawn till the new set is ready): done in one go it held a phone's frame for the
		// best part of a second each time; the first set, and one far from where you are now (a
		// teleport, a fast flight), is done at once
		if (!rebuild && Math.hypot(x - lastX, z - lastZ) >= 300) { lastX = x; lastZ = z; rebuild = rebuildAt(x, z, globe); }
		if (rebuild) {
			const t0 = performance.now(), budget = !builtOnce || Math.hypot(x - rebuild.x, z - rebuild.z) > 900 ? Infinity : SLICE;
			while (rebuild && performance.now() - t0 < budget) if (rebuild.gen.next().done) { rebuild = null; builtOnce = true; }
			return;
		}
		if (!high && (Math.hypot(x - treeX, z - treeZ) > 40 || gradeVersion() !== treeGV)) { placeTrees(x, z); bedFarX = 1e9; }                 // (MARGIN covers these 40 m)
		if (!high && Math.hypot(x - bedX, z - bedZ) > 2) placeBeds(x, z);
	}
	// one rebuild of the buildings, trees and kit round (x, z), in steps
	const SLICE = PHONE ? 4 : 6;
	let rebuild = null, builtOnce = false;
	const rebuildAt = (x, z, globe) => ({ x, z, gen: rebuildSteps(x, z, globe) });
	// a list's filter a slice at a time
	function* keepSteps(arr, ok) {
		const out = [];
		for (let i = 0; i < arr.length; i++) { if ((i & 2047) === 2047) yield; if (ok(arr[i])) out.push(arr[i]); }
		return out;
	}
	function* rebuildSteps(x, z, globe) {
		const list = [];
		if (!globe) fillBlocks(x, z, 1200, list);
		clipMapped(list);
		yield;
		yield* realBuildings(x, z, 2000, list, !globe);
		yield;
		settleLots(list, x, z);          // structures: no lot through another, a freeway or a landmark; alleys planned
		yield;
		decorate(list, x, z, 700);
		yield;
		// the streets' own trees by their era, in place of the map's plain rows (streettrees.js);
		// nearer and fewer on a lower quality tier (world/governor.js)
		if (list.trees && real?.loaded()) { const far = qualityNow().far; list.trees = streetTrees(real, list.trees, x, z, (PHONE ? 650 : 1000) * far, (tx, tz) => bay.heightAt(tx, tz), Math.round((PHONE ? 3500 : 9000) * far)); }
		// no tree grows out of a street or a roof (the mapped trees and yard trees are placed
		// from points and lots; the land map knows where the pavement and the roofs are)
		if (list.trees && real?.loaded()) list.trees = list.trees.filter((t) => { if (t.shrub || t.fern || t.h < 3) return true; const L = real.landAt(t.x, t.z); return !L || ((t.well || L.road < 0.6) && L.roof < 0.7); });
		yield;
		// ...nor on a carriageway, a sidewalk, a trail or a drive, nor in a junction's sight
		// triangle, within reach (bay/clearance.js): the land map is too coarse for a trunk
		if (list.trees && real?.loaded()) { const K = makeClearance(real, x, z, 1300); yield; list.trees = yield* keepSteps(list.trees, (t) => t.fern || K.clear(t.x, t.z, t.shrub ? 0.3 : 0.5, !!t.well)); }
		yield;
		// ...nor on a ball field (sportsfields.js)
		if (list.trees) list.trees = list.trees.filter((t) => !inClearing(t.x, t.z, t.shrub || t.fern ? 0 : 2) && !onLandmark(t.x, t.z, 2) && !inCoastField(t.x, t.z) && !inBoardwalk(t.x, t.z) && !inRiverWater(t.x, t.z) && !inWater(t.x, t.z));
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
			yield;
			if (list.trees && G.size) list.trees = yield* keepSteps(list.trees, (t) => !inside(t));
		}
		yield;
		// which buildings are businesses, and their signs and things out front (economy/layer.js)
		yield* economy.applySteps(list, x, z);
		// if there is more than fits, keep the nearest
		const d2 = (o) => (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z);
		if (list.length > CAP) { const t = list.trees, k = list.kit, pr = list.props; list.sort((m, n) => d2(m) - d2(n)); list.length = CAP; list.trees = t; list.kit = k; list.props = pr; }
		if (list.trees && list.trees.length > TCAP) list.trees.sort((m, n) => d2(m) - d2(n));
		yield;
		procGroups(list, x, z);
		// (a phone sorts out the nearer buildings only: the pass costs it a frame or two)
		apart(list, x, z, PHONE ? 650 : 1e9);
		yield;
		// (then in place: the buildings, their kit a frame on, the trees a frame after; written a
		// sector at a time round here, nearest first by bands in each, for the chunks and the
		// shadow pass)
		lastAt = [x, z];
		upload(list, near, [hips, gables], orderBySector(list, x, z, lotHalf), x, z);
		skylineBeside(list);
		indexLots(list);
		// the tall ones, for going inside (bay/towers.js)
		tallList = list.filter((o) => !o.roof && commercialStack(o.src?.kind ?? (o.kind === KIND.tower ? 11 : o.kind === KIND.office ? 5 : o.kind === KIND.retail ? 6 : 0),o.w,o.d,o.h-1.2));
		yield;
		if (acX > 1e8) { acX = x; acZ = z; }          // (the first set: its near units round where it was laid out)
		uploadKit(list.kit);
		kit2.upload(list.props);
		drives = { list: list.props?.car || [], v: drives.v + 1 };
		yield;
		placeTrees(x, z);
	}
	return { roofFloor, ceiling, skyline: () => skyline, driveCars: () => drives, economy, economyInfo: (x, z, r) => economy.info(x, z, r, lastList), nearList: () => lastList, lotsNear, lotKey, setDoor, procHomes: (x, z, r) => procNear(x, z, r, false).filter((g) => !inClearing(g[0].x, g[0].z, 0)), procBiz: (x, z, r) => procNear(x, z, r, true).map((g) => g[0]), KIND, towersNear: (x, z, r) => tallList.filter((o) => Math.hypot(o.x - x, o.z - z) < r + Math.max(o.w, o.d) / 2), kitCounts: () => ({ ac: kit.ac.count, sunrooms: kit.sunF.count, lines: kit.line.count }), update, group, fill: fillBlocks, houseLook, setNear, setNearBand: (a, b) => nearBand.value.set(a, b), bedsNear: (x, z, r) => bedList.filter((t) => !t.litter && Math.hypot(t.x - x, t.z - z) < r), treesAt: (x, z, r) => treeList.filter((t) => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r), treesNear: (x, z, r) => treeList.filter((t) => Math.hypot(t.x - x, t.z - z) < r).map((t) => ({ h: +t.h.toFixed(1), cone: !!t.cone, sp: t.sp, shrub: !!t.shrub, fern: !!t.fern, src: t.src || '' })) };
}
