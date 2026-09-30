// The wild ground at your feet, out in the Bay Area's open country: what the hills are
// really covered in between the trees city.js stands (wildLand) and under them.
//   the grass in bunches: wild oats and brome, gold from May, green after the first rains;
//     cropped short in the grazed patches; star-thistle and fennel along the trails
//   the brush by habitat: chamise, manzanita and toyon on the hot chaparral ridges; coyote
//     brush and sage in the coastal scrub (clipped low on the sea bluffs); poison oak and
//     toyon at the oak woodland's edge, turning red in late summer; sword ferns, huckleberry
//     and redwood sorrel in the redwood shade
//   rock: outcrops of the region's own rock stepping out of the steep slopes, boulders
//     under them, stones scattered on the ridges and along the trail tread
//   litter: oak leaves, acorns and sticks under the oaks; needle duff, cones and twigs
//     under the redwoods
// All of it from a 16 m cell index round you, each cell worked out once (a few a frame,
// nearest first) from the same reckoning of the land as city.js's woods, drawn instanced:
// dense close by, thinning with distance, dissolving out at each layer's reach.

import * as THREE from 'three';
import { swayMaterial } from '../world/vegetation.js';
import { addLodFade } from '../world/lodfade.js';
import { GREENS, REAL_U } from '../bay/realcity.js';
import { inWater } from '../bay/watercarve.js';
import { inRiverWater } from '../bay/carve.js';
import { toWorld } from '../bay/geo.js';
import { mulberry32 } from '../noise.js';
import * as PL from './plants.js';
import { GEOLOGY, boulder, outcrop, stone, rockMaterial } from './rocks.js';

// city.js's own hash and value noise, so the land is reckoned as its woods are
const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
	const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
	return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = 16;
const GEO = GEOLOGY.map(([lat, lon, r, c, form]) => ({ ...toWorld(lat, lon), r, col: new THREE.Color(c), form }));
const TRAILISH = /path|track|footway|bridleway/;

// ---------- what grows where: the land as city.js reckons it (wildLand), plus the brush ----------
// habitat(bay, real, ground)(x, z): null where it is town, road, roof, a planted park or the
// shore; otherwise the slope, aspect, draw, height, how wooded, redwood, chaparral, coastal
// scrub and open grass (0..1 each), and the region's rock
export function habitat(bay, real, H) {
	return function landAt(x, z) {
		const h = H(x, z);
		if (h < 2.5) return null;
		if (real?.inside(x, z)) {
			const L = real.landAt(x, z);
			if (!L || (L.lu !== 0 && L.lu !== 11 && L.lu !== 12) || L.road > 0.35 || L.roof > 0.2) return null;
		} else if (bay.urbanAt(x, z).u > 0.06) return null;
		if (GREENS.some((G) => Math.abs(x - G.x) < G.rx && Math.abs(z - G.z) < G.rz)) return null;
		const e = 18, hxp = H(x + e, z), hxm = H(x - e, z), hzp = H(x, z + e), hzm = H(x, z - e);
		const slope = Math.hypot(hxp - hxm, hzp - hzm) / (2 * e);
		const north = Math.max(-1, Math.min(1, (hzp - hzm) / (2 * e) * 4));
		const gully = Math.max(0, Math.min(1, (hxp + hxm + hzp + hzm - 4 * h) / 6));
		const high = Math.min(1, Math.max(0, (h - 350) / 600));
		const grove = vnoise(x / 140, z / 140) * 0.7 + vnoise(x / 45 + 9, z / 45 + 3) * 0.3;
		const wood = Math.min(1, Math.max(0, (0.08 + north * 0.55 + gully * 0.7 + slope * 0.2 - high * 0.15) * (0.25 + grove * 1.5)));
		const chap = Math.min(1, Math.max(0, -north * 0.5 + slope * 0.9 + high * 0.6 - 0.35 - gully * 0.5));
		const fq = Math.min(1, Math.max(0, (x - 22000) / 36000)), fog = 1 - fq * fq * (3 - 2 * fq);
		const windswept = fog > 0.5 && (H(x - 900, z) < -2 || H(x - 2200, z) < -2 || (x < 12000 && H(x, z + 1500) < -2));
		const redwood = !windswept && fog > 0.6 && high < 0.5 && (gully > 0.1 || north > 0.1 || slope < 0.3) ? wood : 0;
		// coastal scrub where the fog reaches the brushy slopes; chaparral inland
		const scrub = windswept ? 0.35 + chap * 0.6 + wood * 0.4 : fog > 0.5 ? chap : 0;
		const chaparral = fog > 0.5 ? chap * 0.3 : chap;
		// the open grass: whatever is not wood or brush
		const open = Math.max(0, 1 - wood * 1.2 - Math.max(scrub, chaparral) * 0.8);
		let rock = null, rd = 1e9;
		for (const g of GEO) { const d = Math.hypot(x - g.x, z - g.z) / g.r; if (d < 1 && d < rd) { rd = d; rock = g; } }
		return { h, slope, north, gully, high, wood: windswept ? wood * 0.3 : wood, fog, windswept, redwood, scrub, chaparral, open, rock, rockK: rock ? 1 - rd : 0 };
	};
}

export function createWildGround(scene, bay, { shared, real, isPhone = false, ground = null, globe = null } = {}) {
	const H = ground || ((x, z) => bay.heightAt(x, z));
	const K = isPhone ? 0.45 : 1;                                      // density
	const RK = isPhone ? 0.7 : 1;                                      // reach
	const group = new THREE.Group();
	group.name = 'wild-ground';
	scene.add(group);

	const landAt = habitat(bay, real, H);

	// ---------- the layers ----------
	const fogU = { value: 0 };
	const atlas = PL.leafAtlas();
	const leafM = swayMaterial({ map: atlas, alphaTest: 0.32, side: THREE.DoubleSide, roughness: 0.85 }, shared, 0.7);
	// (a fern at your feet shrinks away rather than filling the view)
	const fernM = swayMaterial({ map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.8, near: { r: 1.6, cap: 1.1 } }, shared, 0.9);
	const woodM = swayMaterial({ roughness: 0.92 }, shared, 0.6);
	const bladeM = swayMaterial({ side: THREE.DoubleSide, roughness: 0.9 }, shared, 1.4);
	const rockM = rockMaterial(fogU);
	const litterM = new THREE.MeshStandardMaterial({ map: litterAtlas(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true });
	const stickM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
	const layers = [];
	// one instanced mesh set per layer: parts, variants, how far it reaches, how many at most
	function layer(key, variants, mats, R, cap, { shadow = false, woodR = 0 } = {}) {
		R *= RK;
		const L = { key, R, meshes: [], n: variants.length };
		variants.forEach((v, vi) => {
			const parts = v.parts || [v];
			parts.forEach((geo, pi) => {
				const m = mats[pi].material || mats[pi];
				const im = new THREE.InstancedMesh(geo, m, Math.ceil(cap / variants.length));
				im.count = 0; im.frustumCulled = false; im.visible = false;
				im.castShadow = shadow && pi === parts.length - 1; im.receiveShadow = true;
				if (mats[pi].depth) im.customDepthMaterial = mats[pi].depth;
				im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.ceil(cap / variants.length) * 3), 3);
				im.userData.material175 = key === 'rock' || key === 'outcrop' || key === 'stone' ? 'stone' : 'soft';
				im.name = 'wild-' + key;
				group.add(im);
				// a woody part (the stems inside a shrub) only needs drawing close by
				L.meshes.push({ im, vi, cap: im.instanceMatrix.count, R: pi === 0 && parts.length > 1 && woodR ? woodR * RK : R });
			});
		});
		layers.push(L);
		return L;
	}
	// each material dissolves its layer out over the last fifth of its reach (by the camera,
	// in the shader); a separate copy per reach
	const faded = new Map();
	const fadeOf = (M, R) => {
		const k = M.uuid + R;
		if (!faded.has(k)) {
			const m = M.clone();
			m.onBeforeCompile = M.onBeforeCompile; m.customProgramCacheKey = M.customProgramCacheKey;
			const S = { material: m, depth: null };
			addLodFade(m, 'uniform', [-2, -1, R * 0.72, R]);
			faded.set(k, S);
		}
		return faded.get(k);
	};
	const sw = (S, R) => ({ material: fadeOf(S.material, R).material, depth: S.depth });
	const mk = (key, variants, mats, R, cap, o) => layer(key, variants, mats.map((M) => M.isMaterial ? fadeOf(M, R * RK).material : sw(M, R * RK)), R, cap, o);

	// (the shapes are made a few a frame, so no one frame stalls)
	const shrubMats = [woodM, leafM];
	let Lrt, Lbar, Lb, Lo, Ls, Lw, Lcb, Lch, Lmz, Lty, Lpo, Lsg, Lhk, Lfn, Lso, Lrk, Lout, Lst, Llf, Lsk, Lcn;
	const outs = [];
	const steps = [
		() => {
			Lb = mk('bunch', [PL.tuft(11, 'bunch'), PL.tuft(12, 'bunch')], [bladeM], 42, 3200 * K);
			Lo = mk('oat', [PL.tuft(13, 'oat'), PL.tuft(14, 'oat')], [bladeM], 38, 1800 * K);
			Ls = mk('short', [PL.tuft(15, 'short')], [bladeM], 26, 2400 * K);
			Lw = mk('weed', [PL.weed(21, 'thistle'), PL.weed(22, 'fennel'), PL.weed(23, 'mustard')], [bladeM], 45, 500 * K);
		},
		() => {
			Lcb = mk('coyote', [PL.coyoteBrush(31), PL.coyoteBrush(32), PL.coyoteBrush(33, true)], shrubMats, 150, 900 * K, { shadow: true, woodR: 20 });
		},
		() => {
			Lch = mk('chamise', [PL.chamise(41), PL.chamise(42)], shrubMats, 140, 1300 * K, { shadow: true, woodR: 12 });
			Lmz = mk('manzanita', [PL.manzanita(51), PL.manzanita(52)], shrubMats, 150, 500 * K, { shadow: true, woodR: 60 });
		},
		() => {
			Lty = mk('toyon', [PL.toyon(61), PL.toyon(62, true)], shrubMats, 160, 400 * K, { shadow: true, woodR: 25 });
			Lpo = mk('poisonoak', [PL.poisonOak(71), PL.poisonOak(72)], shrubMats, 110, 700 * K, { shadow: true, woodR: 20 });
			Lsg = mk('sage', [PL.sage(81), PL.sage(82)], shrubMats, 120, 500 * K, { shadow: true, woodR: 15 });
		},
		() => {
			Lhk = mk('huckle', [PL.huckleberry(91)], shrubMats, 90, 400 * K, { shadow: true, woodR: 20 });
			Lfn = mk('fern', [PL.swordFern(101), PL.swordFern(102)], [fernM], 60, 1800 * K);
		},
		() => {
			Lso = mk('sorrel', [PL.sorrel(111)], [leafM], 40, 600 * K);
		},
		() => {
			Lrk = mk('rock', [boulder(201, 'round'), boulder(202, 'bedded'), boulder(203, 'blocky')], [rockM], 200, 900 * K, { shadow: true });
		},
		() => { outs.push(outcrop(301, 'bedded')); },
		() => { outs.push(outcrop(302, 'blocky')); },
		() => {
			Lout = mk('outcrop', [...outs, outcrop(303, 'round')], [rockM], 320, 240 * K, { shadow: true });
		},
		() => {
			Lst = mk('stone', [stone(401), stone(402)], [rockM], 40, 2000 * K);
			Llf = mk('leaves', [leafLitter(0), leafLitter(1), leafLitter(2)], [litterM], 26, 4500 * K);
			Lsk = mk('sticks', [sticks(501), sticks(502)], [stickM], 30, 700 * K);
			Lcn = mk('cones', [cone(601), acorns(602)], [stickM], 18, 1400 * K);
			Lrt = mk('roots', [roots(701), roots(702)], [stickM], 40, 500 * K);
			Lbar = mk('bars', [waterBar(false), waterBar(true)], [stickM], 60, 80 * K, { shadow: true });
		},
	];
	const FORM = { round: 0, bedded: 1, blocky: 2 };

	// ---------- a cell's contents, worked out once ----------
	// each layer's items as flat runs of [x, y, z, yaw, sx, sy, r, g, b, variant, nx, nz]
	// (nx, nz: the ground's slope, for what lies on it rather than standing up)
	const cells = new Map();
	const ITEM = 12;
	function makeCell(ci, cj) {
		const out = {}, x0 = ci * C, z0 = cj * C, cx = x0 + C / 2, cz = z0 + C / 2;
		// out on the rest of the globe (earth/globe.js), past the Bay's own wild land: the
		// region's climate decides the ground instead (globeCell below)
		const G = globe?.(), ll = G?.toLL ? G.toLL(cx, cz) : null;
		const away = ll && Math.hypot((ll.lat - 37.6) * 111, (ll.lon + 122.1) * 88) > 190;
		const E = away ? { rock: null } : landAt(cx, cz);
		if (!E) return out;
		const r = mulberry32((ci * 73856093) ^ (cj * 19349663) ^ 0x5bd1e995);
		const season = REAL_U.uSeason.value, month = new Date().getMonth() + 1;
		const fall = month >= 8 && month <= 11, winter = month === 12 || month <= 2;
		// the trails through the cell: keep the tread clear, and lay its stones and roots
		const trails = real ? real.near('roads', cx, cz, C).filter((q) => q && q.pts && TRAILISH.test(q.cls || '')) : [];
		// (how far out of the tread a point is; tA is left holding the trail's heading there)
		let tA = 0, tW = 2, tCls = '';
		const trailD = (x, z) => {
			let best = 1e9, w = 2;
			for (const q of trails) {
				const p = q.pts;
				for (let i = 0; i + 3 < p.length; i += 2) {
					const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / l2));
					const d = Math.hypot(x - p[i] - dx * t, z - p[i + 1] - dz * t);
					if (d < best) { best = d; w = q.w || 2; tA = Math.atan2(dx, dz); tCls = q.cls; }
				}
			}
			tW = w;
			return best - w / 2;
		};
		const put = (L, x, z, yaw, sx, sy, col, v, sink = 0.05, lie = false) => {
			const a = out[L.key] || (out[L.key] = []), h = H(x, z);
			let nx = 0, nz = 0;
			if (lie) { const e = 0.6, gx = H(x - e, z) - H(x + e, z), gz = H(x, z - e) - H(x, z + e), l = Math.hypot(gx, 2 * e, gz); nx = gx / l; nz = gz / l; }
			a.push(x, h - sink, z, yaw, sx, sy, col[0], col[1], col[2], v, nx, nz);
		};
		const wet = (x, z) => inWater(x, z) || inRiverWater(x, z);
		// n tries across the cell, each kept by want(x, z) (0..1)
		const scatter = (n, want, fn) => {
			for (let i = 0; i < n; i++) {
				const x = x0 + r() * C, z = z0 + r() * C;
				if (r() > want(x, z)) continue;
				fn(x, z);
			}
		};
		// patchiness: plants grow in drifts and clumps, not evenly
		const drift = (x, z, s, o = 0) => vnoise(x / s + o, z / s - o * 1.7);
		const J = (base, k = 0.12) => base.map((c) => c * (1 - k + r() * 2 * k));

		if (away) { globeCell(G, ll, cx, cz, put, scatter, drift, J, r, season); return out; }
		// the grass: bunches in the open, sparse under the oaks, none under the redwoods
		// (city.js stands redwoods wherever the fog belt is even a little wooded: no grass there)
		const grassK = (E.open + E.wood * 0.12 + E.chaparral * 0.15) * (1 - Math.min(1, E.redwood * 2.5));
		if (grassK > 0.02) {
			const gold = [0.52 + season * 0.12, 0.38 + season * 0.02, 0.14], green = [0.26, 0.44, 0.1];
			const tone = (x, z) => { const dry = Math.min(1, Math.max(0, season * 1.25 - 0.1 + (drift(x, z, 40, 3) - 0.5) * 0.5 - E.fog * 0.25 * (1 - season))); return green.map((g, k) => (g + (gold[k] - g) * dry) * 1.7); };
			scatter(Math.round(190 * K * grassK), (x, z) => (0.35 + 0.9 * drift(x, z, 9, 1)) * (trailD(x, z) > 0.3 ? 1 : 0), (x, z) => {
				const grazed = drift(x, z, 60, 7) > 0.62, s = 0.8 + r() * 0.6;
				const L = grazed ? Ls : r() < 0.35 + season * 0.25 ? Lo : Lb;
				put(L, x, z, r() * 6.28, s, s * (0.8 + r() * 0.5) * (E.windswept ? 0.7 : 1), J(tone(x, z), 0.1), Math.floor(r() * L.n));
			});
			// the weeds of the trodden edges: along the trails, and here and there
			scatter(Math.round((trails.length ? 14 : 2) * K * grassK), (x, z) => { const d = trailD(x, z); return d > 0.4 && d < 5 ? 1 : trails.length ? 0.05 : 0.5; }, (x, z) => {
				const v = E.fog > 0.5 && r() < 0.5 ? 1 : season < 0.4 ? 2 : 0;
				const s = 0.8 + r() * 0.4;
				put(Lw, x, z, r() * 6.28, s, s, season > 0.7 && v !== 0 ? [0.85, 0.72, 0.55] : [1, 1, 1], v, 0.02);
			});
		}
		// the brush
		const avoidT = (x, z, w) => trailD(x, z) > w;
		// chaparral: chamise thickets, manzanita, the odd toyon, black sage on the edges
		if (E.chaparral > 0.08) {
			const summerRust = season > 0.6 ? [1.25, 0.95, 0.75] : [1, 1, 1];
			scatter(Math.round(26 * K * E.chaparral), (x, z) => (0.4 + drift(x, z, 25, 5)) * (avoidT(x, z, 1.2) ? 1 : 0), (x, z) => {
				const q = r(), s = 0.8 + r() * 0.5;
				if (q < 0.6) put(Lch, x, z, r() * 6.28, s, s, J(summerRust.map((c) => c * 0.95)), Math.floor(r() * 2), 0.1);
				else if (q < 0.82) put(Lmz, x, z, r() * 6.28, s, s, J([1, 1, 1]), Math.floor(r() * 2), 0.1);
				else if (q < 0.9) put(Lty, x, z, r() * 6.28, s * 0.8, s * 0.8, J([1, 1, 1]), winter ? 1 : 0, 0.1);
				else put(Lsg, x, z, r() * 6.28, s, s, J([0.9, 0.9, 0.9]), Math.floor(r() * 2), 0.08);
			});
		}
		// coastal scrub: coyote brush mounds, sage, poison oak in the draws
		if (E.scrub > 0.08) {
			scatter(Math.round(22 * K * E.scrub), (x, z) => (0.3 + drift(x, z, 20, 9)) * (avoidT(x, z, 1.0) ? 1 : 0), (x, z) => {
				const q = r(), s = 0.8 + r() * 0.6;
				if (q < 0.62) put(Lcb, x, z, E.windswept ? 0.3 + (r() - 0.5) * 0.4 : r() * 6.28, s, s * (E.windswept ? 0.7 : 1), J([1, 1, 1]), E.windswept ? 2 : Math.floor(r() * 2), 0.1);
				else if (q < 0.85) put(Lsg, x, z, r() * 6.28, s, s, J([1, 1, 1]), Math.floor(r() * 2), 0.08);
				else put(Lpo, x, z, r() * 6.28, s, s, J(fall ? [2.1, 0.75, 0.5] : [1, 1, 1], 0.15), Math.floor(r() * 2), 0.05);
			});
		}
		// the open grass's own brush: coyote brush in loose drifts, thicker in the draws
		if (E.open > 0.3) {
			const bk = Math.max(0, drift(cx, cz, 70, 13) - 0.45) * (1 + E.gully * 2 + Math.max(0, E.north));
			scatter(Math.round(10 * K * bk), (x, z) => (drift(x, z, 12, 2) > 0.45 && avoidT(x, z, 1.5) ? 1 : 0), (x, z) => {
				const s = 0.7 + r() * 0.7;
				put(Lcb, x, z, r() * 6.28, s, s, J([0.95, 0.95, 0.9]), Math.floor(r() * 2), 0.1);
			});
		}
		// the oak woodland's understory: poison oak and toyon at its edges and in its gaps,
		// snowberry and huckleberry in the shade (the redwoods have their own below)
		if (E.wood > 0.12 && E.redwood < 0.3) {
			const edge = Math.min(1, E.wood * (1.4 - E.wood) * 2.2);
			scatter(Math.round(9 * K * edge + 2), (x, z) => (0.3 + drift(x, z, 15, 4)) * (avoidT(x, z, 0.8) ? 1 : 0), (x, z) => {
				const q = r(), s = 0.8 + r() * 0.5;
				if (q < 0.55) put(Lpo, x, z, r() * 6.28, s, s, J(fall ? [2.2, 0.7, 0.45] : [1, 1, 1], 0.15), Math.floor(r() * 2), 0.05);
				else if (q < 0.8) put(Lty, x, z, r() * 6.28, s, s, J([1, 1, 1]), winter ? 1 : 0, 0.1);
				else put(Lhk, x, z, r() * 6.28, s, s, J([1.3, 1.25, 1.1]), 0, 0.05);
			});
		}
		// the redwood floor: sword ferns everywhere in the shade, sorrel carpets, huckleberry
		// in the light gaps; no grass
		if (E.redwood > 0.12) {
			scatter(Math.round(34 * K * Math.min(1, E.redwood * 2)), (x, z) => (0.25 + drift(x, z, 10, 6)) * (avoidT(x, z, 0.5) ? 1 : 0), (x, z) => {
				const s = 0.75 + r() * 0.6;
				put(Lfn, x, z, r() * 6.28, s, s, J([1, 1, 1], 0.15), Math.floor(r() * 2), 0.03);
			});
			scatter(Math.round(8 * K * E.redwood), (x, z) => (drift(x, z, 8, 11) > 0.5 && avoidT(x, z, 0.3) ? 1 : 0), (x, z) => {
				const s = 0.8 + r() * 0.8;
				put(Lso, x, z, r() * 6.28, s, 1, J([1, 1, 1]), 0, 0.02, true);
			});
			scatter(Math.round(3 * K * E.redwood), (x, z) => (avoidT(x, z, 1) ? 1 : 0), (x, z) => {
				const s = 0.8 + r() * 0.6;
				put(Lhk, x, z, r() * 6.28, s, s, J([1, 1, 1]), 0, 0.05);
			});
		}
		// rock: outcrops where it is steep or on the crest, boulders below them, stones about
		{
			const rk = E.rock, form = rk ? rk.form : E.high > 0.3 ? 'blocky' : 'bedded';
			const col = rk ? [rk.col.r, rk.col.g, rk.col.b].map((c) => c * (0.8 + 0.4 * (rk ? E.rockK : 0)) + 0.1) : [0.42, 0.38, 0.32];
			const rockW = Math.max(0, E.slope - 0.28) * 2.2 + E.high * 0.4 + E.chaparral * 0.5 + (rk ? E.rockK * 0.6 : 0) - E.redwood * 0.5;
			const hog = drift(cx, cz, 90, 21);
			if (rockW > 0.2 && hog > 0.52 && r() < rockW * 0.8) {
				const x = x0 + 3 + r() * (C - 6), z = z0 + 3 + r() * (C - 6);
				if (avoidT(x, z, 4) && !wet(x, z)) {
					const s = 1.6 + r() * 2.2 * Math.min(1.5, rockW);
					// the strike of the beds runs one way over a whole hillside
					put(Lout, x, z, drift(cx, cz, 400, 3) * 6.28 + (r() - 0.5) * 0.3, s, s * (0.8 + r() * 0.4), J(col, 0.1), FORM[form], s * 0.45);
				}
			}
			scatter(Math.round(6 * K * Math.min(2, rockW + (hog > 0.52 ? 0.3 : 0))), (x, z) => (avoidT(x, z, 1.5) && !wet(x, z) ? 0.6 : 0), (x, z) => {
				const s = 0.25 + Math.pow(r(), 2.5) * 1.6;
				put(Lrk, x, z, r() * 6.28, s, s * (0.8 + r() * 0.4), J(col, 0.12), FORM[form], s * 0.35);
			});
			scatter(Math.round(18 * K * Math.min(1.5, rockW + 0.15)), () => 0.8, (x, z) => {
				const s = 0.05 + Math.pow(r(), 3) * 0.22;
				put(Lst, x, z, r() * 6.28, s, s, J(col, 0.15), Math.floor(r() * 2), s * 0.3, true);
			});
		}
		// the tread: stones worked out of the trail, roots across it under the trees
		if (trails.length) {
			const col = E.rock ? [E.rock.col.r, E.rock.col.g, E.rock.col.b].map((c) => c * 0.9 + 0.08) : [0.45, 0.4, 0.34];
			scatter(Math.round(40 * K), (x, z) => (trailD(x, z) < 0.2 ? 1 : 0), (x, z) => {
				const s = 0.04 + Math.pow(r(), 2.5) * (E.slope > 0.25 ? 0.35 : 0.15);
				put(Lst, x, z, r() * 6.28, s, s * 0.8, J(col.map((c) => c * 0.72), 0.18), Math.floor(r() * 2), s * 0.62, true);
			});
			// the tread's edge is never a clean line: duff and leaves drift over it, grass and
			// pebbles creep in (the ground's painted ribbon stops hard; this breaks it up)
			scatter(Math.round(36 * K), (x, z) => { const d = trailD(x, z); return d > -0.45 && d < 0.6 ? 1 : 0; }, (x, z) => {
				const q = r();
				if (E.wood > 0.25 || E.redwood > 0.1) put(Llf, x, z, r() * 6.28, 0.4 + r() * 0.4, 1, E.redwood > 0.3 ? J([0.3, 0.2, 0.14], 0.2) : J([0.4, 0.33, 0.24], 0.2), E.redwood > 0.3 ? 2 : Math.floor(r() * 2), 0, true);
				else if (q < 0.6) put(Ls, x, z, r() * 6.28, 0.7 + r() * 0.5, 0.7 + r() * 0.5, J([0.8, 0.62, 0.3], 0.15), 0, 0.03);
				else put(Lst, x, z, r() * 6.28, 0.04 + r() * 0.06, 0.05, J(col.map((c) => c * 0.8), 0.15), Math.floor(r() * 2), 0.02, true);
			});
			// roots worn bare across the tread under the trees
			if (E.wood > 0.3) scatter(Math.round(10 * K * E.wood), (x, z) => (trailD(x, z) < 0.3 ? 1 : 0), (x, z) => {
				put(Lrt, x, z, tA + (r() - 0.5) * 0.9, 0.8 + r() * 0.5, 0.8 + r() * 0.4, J([1, 1, 1], 0.15), Math.floor(r() * 2), 0.0, true);
			});
			// water bars: a log or a row of stones set slantwise across a steep footpath
			if (E.slope > 0.14) scatter(2, (x, z) => (trailD(x, z) < -0.2 && !/track/.test(tCls) && drift(x, z, 22, 5) > 0.55 ? 1 : 0), (x, z) => {
				const s = Math.max(0.8, tW / 2 + 0.4);
				put(Lbar, x, z, tA + 0.5, s, 1, J([1, 1, 1], 0.1), E.wood > 0.3 ? 0 : 1, 0.05, true);
			});
		}
		// litter under the trees: oak leaves and acorns, or the redwoods' needle duff and cones
		if (E.wood > 0.2 || E.redwood > 0.1) {
			const rw = E.redwood > 0.3;
			scatter(Math.round(70 * K * Math.min(1, E.wood + 0.2) * (rw ? 0.5 : 1)), (x, z) => (trailD(x, z) > -0.3 ? 0.5 + drift(x, z, 5, 3) : 0.15), (x, z) => {
				const s = rw ? 0.5 + r() * 0.5 : 0.45 + r() * 0.45;
				// (dull and a little darker than the ground: dead leaves are brown-grey, not orange)
				const t = rw ? J([0.3, 0.2, 0.14], 0.2) : fall || season > 0.6 ? J([0.42, 0.34, 0.24], 0.2) : J([0.34, 0.3, 0.22], 0.2);
				put(Llf, x, z, r() * 6.28, s, s, t, rw ? 2 : Math.floor(r() * 2), 0, true);
			});
			scatter(Math.round(5 * K), () => 0.8, (x, z) => { const s = 0.7 + r() * 0.9; put(Lsk, x, z, r() * 6.28, s, s, [0.9, 0.85, 0.8], Math.floor(r() * 2), 0.02, true); });
			scatter(Math.round(14 * K), () => 0.8, (x, z) => { put(Lcn, x, z, r() * 6.28, 1, 1, [1, 1, 1], rw ? 0 : 1, 0.01, true); });
		}
		// the season it was worked out in, to redo it when the season turns
		out.season = season;
		return out;
	}

	// ---------- the rest of the world ----------
	// The ground cover by climate, from the globe's cell (mean temperature, rain, tree cover,
	// karst) and the air's temperature at this height: tundra and alpine turf with cushion
	// plants and scree; sagebrush steppe; creosote desert; prairie of tall grass and forbs;
	// the floor of a broadleaf or conifer forest (ferns, laurel and rhododendron, blueberry,
	// leaf or needle litter); the dense ferny floor of the humid subtropics; limestone
	// breaking out where the land is karst.
	function globeCell(G, ll, cx, cz, put, scatter, drift, J, r, season) {
		const c = G.data.cellAt(ll.lat, ll.lon), h = H(cx, cz);
		if (h < 1) return;
		const e = 8, slope = Math.hypot(H(cx + e, cz) - H(cx - e, cz), H(cx, cz + e) - H(cx, cz - e)) / (2 * e);
		const air = c.TEMP - 6.5 * Math.max(0, h - 800) / 1000, rain = c.RAIN, trees = c.TREES;
		// the dry season: the hemisphere's late summer browns the grass where it rains little
		const nh = ll.lat > 0 ? season : 1 - season, tropic = Math.abs(ll.lat) < 23;
		const dry = Math.min(1, Math.max(0, (700 - rain) / 450)) * (tropic ? 0.6 : nh);
		const green = [0.26, 0.44, 0.1], straw = [0.58, 0.44, 0.2];
		const tone = (k = 0) => J(green.map((g, i) => (g + (straw[i] - g) * Math.min(1, dry + k)) * 1.7), 0.1);
		const cold = sm(1, -3, air), arid = sm(420, 180, rain), hot = sm(14, 20, air), forest = sm(0.3, 0.55, trees) * (1 - arid);
		const karst = c.KARST || 0;
		const rockC = karst > 0.3 ? [0.62, 0.6, 0.55] : arid > 0.5 ? [0.56, 0.42, 0.32] : [0.46, 0.44, 0.41];
		// rock: scree and outcrops with height and steepness, limestone towers' foot in karst
		const rockW = Math.max(0, slope - 0.25) * 2.2 + cold * 0.8 + arid * 0.3 + karst * 0.8;
		if (rockW > 0.2 && drift(cx, cz, 90, 21) > 0.5 && r() < rockW * 0.7) {
			const x = cx + (r() - 0.5) * 10, z = cz + (r() - 0.5) * 10, s2 = 1.6 + r() * 2.2 * Math.min(1.5, rockW);
			put(Lout, x, z, drift(cx, cz, 400, 3) * 6.28, s2, s2 * (0.8 + r() * 0.4), J(rockC, 0.1), karst > 0.3 || cold > 0.5 ? 1 : 0, s2 * 0.45);
		}
		scatter(Math.round(6 * K * Math.min(2, rockW)), () => 0.6, (x, z) => { const s2 = 0.25 + Math.pow(r(), 2.5) * 1.6; put(Lrk, x, z, r() * 6.28, s2, s2 * (0.8 + r() * 0.4), J(rockC, 0.12), cold > 0.5 ? 2 : karst > 0.3 ? 1 : 0, s2 * 0.35); });
		scatter(Math.round(18 * K * Math.min(1.5, rockW + 0.15)), () => 0.8, (x, z) => { const s2 = 0.05 + Math.pow(r(), 3) * 0.22; put(Lst, x, z, r() * 6.28, s2, s2, J(rockC, 0.15), Math.floor(r() * 2), s2 * 0.3, true); });
		// (above the snowline the terrain lies white: rock and scree only, no turf on the snow)
		if (air < -4.5) return;
		if (cold > 0.5) {
			// alpine turf and tundra: short grass in patches, cushions of moss campion and saxifrage
			scatter(Math.round(90 * K * (1 - cold * 0.5)), (x, z) => 0.3 + drift(x, z, 8, 1) * 0.7, (x, z) => put(Ls, x, z, r() * 6.28, 0.8 + r() * 0.5, 0.7 + r() * 0.4, tone(0.3), 0, 0.03));
			scatter(Math.round(8 * K), () => 0.7, (x, z) => put(Lso, x, z, r() * 6.28, 0.5 + r() * 0.4, 1, J([0.9, 0.95, 0.7], 0.15), 0, 0.02, true));
			return;
		}
		if (arid > 0.4) {
			if (hot > 0.5) {
				// hot desert: creosote and bursage spaced evenly apart on bare ground
				scatter(Math.round(7 * K), () => 0.9, (x, z) => { const s2 = 0.8 + r() * 0.6; put(Lcb, x, z, r() * 6.28, s2, s2 * 1.1, J([0.75, 0.72, 0.4], 0.1), Math.floor(r() * 2), 0.1); });
				scatter(Math.round(10 * K), () => 0.5, (x, z) => put(Ls, x, z, r() * 6.28, 0.7, 0.6, tone(0.6), 0, 0.03));
			} else {
				// sagebrush steppe: silver-grey sage to the horizon, bunchgrass between
				scatter(Math.round(34 * K * arid), (x, z) => 0.5 + drift(x, z, 14, 4) * 0.5, (x, z) => { const s2 = 0.7 + r() * 0.7; put(Lsg, x, z, r() * 6.28, s2, s2, J([0.95, 0.95, 0.85], 0.1), Math.floor(r() * 2), 0.08); });
				scatter(Math.round(50 * K), () => 0.6, (x, z) => { const s2 = 0.6 + r() * 0.5; put(Lb, x, z, r() * 6.28, s2, s2, tone(0.4), Math.floor(r() * 2), 0.03); });
			}
			return;
		}
		if (forest > 0.3) {
			const conif = air < 7 ? 1 : 0, humid = hot * sm(900, 1500, rain);
			// the forest floor: ferns and shrubs in the shade, litter everywhere, little grass
			scatter(Math.round((14 + humid * 22) * K * forest), (x, z) => 0.3 + drift(x, z, 10, 6), (x, z) => { const s2 = 0.7 + r() * 0.6; put(Lfn, x, z, r() * 6.28, s2, s2, J(conif ? [1.1, 1.05, 0.9] : [1.25, 1.2, 1], 0.12), Math.floor(r() * 2), 0.03); });
			scatter(Math.round(6 * K * forest), (x, z) => 0.3 + drift(x, z, 18, 2), (x, z) => { const s2 = 0.8 + r() * 0.6; put(Lhk, x, z, r() * 6.28, s2, s2, J(conif ? [1, 1, 1] : [0.8, 0.9, 0.8], 0.1), 0, 0.05); });
			if (!conif) scatter(Math.round(3 * K * forest), () => 0.6, (x, z) => { const s2 = 0.7 + r() * 0.4; put(Lty, x, z, r() * 6.28, s2, s2, J([0.9, 1, 0.9], 0.1), 0, 0.1); });
			scatter(Math.round(70 * K * forest), () => 0.6 + drift(cx, cz, 5, 3) * 0.4, (x, z) => { const s2 = 0.5 + r() * 0.5; put(Llf, x, z, r() * 6.28, s2, s2, conif ? J([0.3, 0.22, 0.15], 0.2) : J([0.45, 0.33, 0.2], 0.2), conif ? 2 : Math.floor(r() * 2), 0, true); });
			scatter(Math.round(5 * K), () => 0.8, (x, z) => { const s2 = 0.7 + r() * 0.9; put(Lsk, x, z, r() * 6.28, s2, s2, [0.9, 0.85, 0.8], Math.floor(r() * 2), 0.02, true); });
			scatter(Math.round(20 * K * (1 - forest)), () => 0.5, (x, z) => put(Ls, x, z, r() * 6.28, 0.8, 0.8, tone(0), 0, 0.03));
			return;
		}
		// open country: meadow, pasture or prairie; tall where it rains enough, forbs through it
		const tall = sm(350, 800, rain);
		scatter(Math.round((140 + tall * 200) * K), (x, z) => 0.45 + 0.7 * drift(x, z, 9, 1), (x, z) => {
			const s2 = (1 + r() * 0.6) * (1 + tall * 0.4), L = r() < tall * 0.6 ? Lo : Lb;
			put(L, x, z, r() * 6.28, s2, s2 * (0.8 + tall * 0.9), tone(0.1 * (1 - tall)), Math.floor(r() * L.n), 0.03);
		});
		scatter(Math.round(8 * K), () => 0.5, (x, z) => put(Lw, x, z, r() * 6.28, 0.8 + r() * 0.4, 0.8 + r() * 0.4, [1, 1, 1], r() < 0.5 ? 0 : 2, 0.02));
		// hedges and scrub: a few shrubs, more where it is wetter (the Azores' hedgerows, gorse)
		scatter(Math.round(3 * K * (0.5 + trees)), (x, z) => (drift(x, z, 30, 7) > 0.5 ? 1 : 0), (x, z) => { const s2 = 0.8 + r() * 0.6; put(Lcb, x, z, r() * 6.28, s2, s2, J([1, 1, 1], 0.1), Math.floor(r() * 2), 0.1); });
	}

	// ---------- streaming ----------
	let MAXR = 0;
	const queue = [];
	let at = null, dirty = true, levelsN = -1, seasonAt = -1, epochSeen;
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3();
	function wanted(cx, cz) {
		// the cells round you, nearest first
		queue.length = 0;
		const R = Math.ceil(MAXR / C) + 1, ci = Math.floor(cx / C), cj = Math.floor(cz / C);
		for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
			const d = Math.hypot((i + 0.5) * C - cx, (j + 0.5) * C - cz);
			if (d > MAXR + C) continue;
			if (!cells.has(i + ',' + j)) queue.push([d, i, j]);
		}
		queue.sort((a, b) => a[0] - b[0]);
	}
	// the cells round you in order of distance (so a layer that runs out of room keeps the
	// nearest): [di, dj, distance], out to the farthest reach
	let rings = null;
	function fill(cx, cz) {
		const ci = Math.floor(cx / C), cj = Math.floor(cz / C);
		if (!rings) {
			rings = [];
			const rc = Math.ceil(MAXR / C) + 1;
			for (let j = -rc; j <= rc; j++) for (let i = -rc; i <= rc; i++) rings.push([i, j, Math.max(0, Math.hypot(i, j) - 1.5) * C]);
			rings.sort((a, b) => a[2] - b[2]);
		}
		for (const L of layers) {
			const counts = L.meshes.map(() => 0), R = L.R;
			for (const [di, dj, dmin] of rings) {
				if (dmin > R) break;
				const c = cells.get((ci + di) + ',' + (cj + dj)), a = c && c[L.key];
				if (!a) continue;
				for (let k = 0; k < a.length; k += ITEM) {
					const d = Math.hypot(a[k] - cx, a[k + 2] - cz);
					if (d > R) continue;
					const v = a[k + 9];
					q.setFromAxisAngle(UP, a[k + 3]);
					// lying things take the slope of the ground
					if (a[k + 10] || a[k + 11]) { const nx = a[k + 10], nz = a[k + 11]; q.premultiply(qt.setFromUnitVectors(UP, nrm.set(nx, Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)), nz))); }
					m4.compose(p.set(a[k], a[k + 1], a[k + 2]), q, s.set(a[k + 4], a[k + 5], a[k + 4]));
					col.setRGB(a[k + 6], a[k + 7], a[k + 8]);
					for (let mi = 0; mi < L.meshes.length; mi++) {
						const M = L.meshes[mi], n = counts[mi];
						if (M.vi !== v || d > M.R || n >= M.cap) continue;
						m4.toArray(M.im.instanceMatrix.array, n * 16);
						col.toArray(M.im.instanceColor.array, n * 3);
						counts[mi] = n + 1;
					}
				}
			}
			L.meshes.forEach((M, mi) => {
				const im = M.im, n = counts[mi];
				im.count = n; im.visible = n > 0;
				if (!n) return;
				for (const A of [im.instanceMatrix, im.instanceColor]) { A.clearUpdateRanges(); A.addUpdateRange(0, n * A.itemSize); A.needsUpdate = true; }
			});
		}
	}
	let counted = 0;
	function update(camera) {
		const x = camera.position.x, z = camera.position.z;
		// (the Bay's wild land when it is here; otherwise the globe's, once its data is in)
		const G = globe?.(), on = (bay.loaded() || !!G?.data?.win?.ready) && Math.max(Math.abs(x), Math.abs(z)) > 1500 && camera.position.y - H(x, z) < 400;
		group.visible = on;
		if (!on) return;
		if (steps.length) { steps.shift()(); if (!steps.length) MAXR = Math.max(...layers.map((L) => L.R)); return; }
		fogU.value = 1 - sm(22000, 58000, x);
		// finer heights arrived (the ground moved) or the season turned: work it all out again
		const nl = bay.levels.filter(Boolean).length;
		if (nl !== levelsN || Math.abs(REAL_U.uSeason.value - seasonAt) > 0.08) { levelsN = nl; seasonAt = REAL_U.uSeason.value; cells.clear(); at = null; }
		// the globe's frame moved (earth/globeframe.js): every cell's place with it
		const ep = globe?.()?.frame?.epoch;
		if (ep !== undefined && ep !== epochSeen) { epochSeen = ep; cells.clear(); at = null; }
		if (cells.size > 9000) cells.clear();
		if (!at || Math.hypot(x - at.x, z - at.z) > 8) { wanted(x, z); dirty = true; at = { x, z }; }
		// a few cells a frame, nearest first, within a small budget
		const t0 = performance.now();
		let made = 0;
		// (the cells right round you come first and a little faster)
		while (queue.length && performance.now() - t0 < (isPhone ? 3 : queue[0][0] < 60 ? 9 : 5)) {
			const [, i, j] = queue.shift(), k = i + ',' + j;
			if (!cells.has(k)) { cells.set(k, makeCell(i, j)); made++; }
		}
		counted += made;
		// refill as you walk, or as the near cells come in (not every frame while far ones do)
		if (dirty || (made && (counted > 40 || !queue.length))) { fill(x, z); dirty = false; counted = 0; }
	}
	// work out every cell within r at once (for a test, or a teleport)
	function flush(camera, r = 80) {
		const x = camera.position.x, z = camera.position.z;
		while (steps.length) steps.shift()();
		MAXR = Math.max(...layers.map((L) => L.R));
		wanted(x, z);
		while (queue.length && queue[0][0] < r) { const [, i, j] = queue.shift(); cells.set(i + ',' + j, makeCell(i, j)); }
		at = { x, z }; fill(x, z);
	}
	function info() {
		const o = { cells: cells.size, queue: queue.length };
		for (const L of layers) o[L.key] = L.meshes.reduce((n, M) => n + M.im.count, 0);
		return o;
	}
	return { update, group, info, landAt, flush };
}

// ---------- litter ----------
// a small atlas of what falls: 0 coast live oak leaf (holly-like, curled), 1 bay/maple
// leaf, 2 redwood sprig and needles
let litterTex = null;
function litterAtlas() {
	if (litterTex) return litterTex;
	const S = 128, c = document.createElement('canvas');
	c.width = S * 4; c.height = S;
	const g = c.getContext('2d'), r = mulberry32(77);
	const at = (i, f) => { g.save(); g.translate(i * S, 0); f(); g.restore(); };
	// oak leaves: small, oval, a few overlapping
	at(0, () => {
		for (let k = 0; k < 9; k++) {
			const x = 20 + r() * 88, y = 20 + r() * 88, a = r() * 6.28, l = 170 + r() * 70;
			g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${l},${l * 0.95 | 0},${l * 0.85 | 0})`;
			g.beginPath(); g.ellipse(0, 0, 18, 11, 0, 0, 7); g.fill();
			g.strokeStyle = 'rgba(90,70,50,0.6)'; g.beginPath(); g.moveTo(-17, 0); g.lineTo(17, 0); g.stroke(); g.restore();
		}
	});
	// bay laurel and maple: long lance leaves and broad lobed ones
	at(1, () => {
		for (let k = 0; k < 6; k++) {
			const x = 20 + r() * 88, y = 20 + r() * 88, a = r() * 6.28, l = 160 + r() * 80;
			g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${l},${l * 0.93 | 0},${l * 0.8 | 0})`;
			g.beginPath(); g.moveTo(-30, 0); g.quadraticCurveTo(0, -12, 30, 0); g.quadraticCurveTo(0, 12, -30, 0); g.fill(); g.restore();
		}
	});
	// redwood needles and twigs: a loose scatter, no pattern
	at(2, () => {
		for (let k = 0; k < 140; k++) { const x = 6 + r() * (S - 12), y = 6 + r() * (S - 12), a = r() * 6.28, l = 120 + r() * 90, L = 4 + r() * 7; g.strokeStyle = `rgb(${l},${l * 0.78 | 0},${l * 0.62 | 0})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
	});
	litterTex = new THREE.CanvasTexture(c);
	litterTex.colorSpace = THREE.SRGBColorSpace;
	litterTex.anisotropy = 4;
	return litterTex;
}
// a patch of litter a metre across, lying on the ground with a slight crumple
function leafLitter(cell) {
	const g = new THREE.PlaneGeometry(1, 1, 3, 3);
	g.rotateX(-Math.PI / 2);
	const P = g.attributes.position, U = g.attributes.uv, col = new Float32Array(P.count * 3);
	for (let i = 0; i < P.count; i++) {
		const x = P.getX(i), z = P.getZ(i);
		P.setY(i, 0.012 + 0.02 * Math.sin(x * 9 + z * 5) + 0.01 * Math.cos(z * 13));
		U.setX(i, (cell + 0.02 + U.getX(i) * 0.96) / 4);
		col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1;
	}
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	g.computeVertexNormals();
	return g;
}
// fallen sticks: a crooked twig with a side branch or two, lying flat
function sticks(seed) {
	const r = mulberry32(seed), parts = [];
	for (let k = 0; k < 3; k++) {
		const L = 0.4 + r() * 0.7, a = r() * 6.28, x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5;
		const g = new THREE.CylinderGeometry(0.008 + r() * 0.01, 0.012 + r() * 0.012, L, 4, 2);
		g.rotateZ(Math.PI / 2 + (r() - 0.5) * 0.1); g.rotateY(a); g.translate(x, 0.012, z);
		parts.push(g);
	}
	const g = new THREE.BufferGeometry(), pos = [], nor = [], idx = [];
	let o = 0;
	for (const q of parts) {
		const P = q.attributes.position, N = q.attributes.normal, I = q.index;
		for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
		for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + o);
		o += P.count;
	}
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(pos.map((_, i) => [0.36, 0.28, 0.2][i % 3]), 3));
	g.setIndex(idx);
	return g;
}
// a redwood cone (small, the size of an olive) or Douglas-fir cone, several together
function cone(seed) {
	const r = mulberry32(seed), g = new THREE.BufferGeometry(), pos = [], nor = [], colA = [], idx = [];
	for (let k = 0; k < 4; k++) {
		const e = new THREE.IcosahedronGeometry(1, 1), P = e.attributes.position, x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2, big = r() < 0.4;
		const sx = big ? 0.035 : 0.014, sy = big ? 0.03 : 0.014, sz = big ? 0.07 : 0.02, o = pos.length / 3;
		for (let i = 0; i < P.count; i++) { pos.push(P.getX(i) * sx + x, P.getY(i) * sy + sy * 0.7, P.getZ(i) * sz + z); nor.push(P.getX(i), P.getY(i), P.getZ(i)); colA.push(0.4, 0.26, 0.16); }
		for (let i = 0; i < P.count; i++) idx.push(o + i);
	}
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
	g.setIndex(idx);
	return g;
}
// acorns: a scatter of little brown-green nuts, some with their caps
function acorns(seed) {
	const r = mulberry32(seed), g = new THREE.BufferGeometry(), pos = [], nor = [], colA = [], idx = [];
	for (let k = 0; k < 6; k++) {
		const e = new THREE.IcosahedronGeometry(1, 1), P = e.attributes.position, x = (r() - 0.5) * 1.4, z = (r() - 0.5) * 1.4, o = pos.length / 3, ripe = r();
		const c = ripe < 0.5 ? [0.42, 0.3, 0.14] : [0.36, 0.34, 0.16];
		for (let i = 0; i < P.count; i++) { pos.push(P.getX(i) * 0.011 + x, P.getY(i) * 0.011 + 0.01, P.getZ(i) * 0.02 + z); nor.push(P.getX(i), P.getY(i), P.getZ(i)); colA.push(...c); }
		for (let i = 0; i < P.count; i++) idx.push(o + i);
	}
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
	g.setIndex(idx);
	return g;
}
// roots across a trail: two or three sinuous tubes along x, half sunk, worn smooth and pale
// on top where boots have scuffed them
function roots(seed) {
	const r = mulberry32(seed), pos = [], nor = [], colA = [], idx = [];
	for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
		const rad = 0.03 + r() * 0.04, z0 = (r() - 0.5) * 0.8, L = 1.2 + r() * 1.2, n = 10, seg = 6, o = pos.length / 3;
		for (let i = 0; i <= n; i++) {
			const t = i / n, x = (t - 0.5) * L, z = z0 + Math.sin(t * 5 + k) * 0.12, rr = rad * (1 - Math.abs(t - 0.4) * 0.6);
			for (let j = 0; j <= seg; j++) {
				const a = j / seg * Math.PI * 2, cy = Math.cos(a), sz = Math.sin(a);
				pos.push(x, cy * rr - rad * 0.45, z + sz * rr); nor.push(0, cy, sz);
				const top = Math.max(0, cy);
				colA.push(0.3 + top * 0.22, 0.24 + top * 0.18, 0.18 + top * 0.14);
			}
		}
		for (let i = 0; i < n; i++) for (let j = 0; j < seg; j++) { const a = o + i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
	g.setIndex(idx);
	return g;
}
// a water bar, along x and about 2 m long: a peeled log half sunk in the tread, or a row
// of flat stones set on edge
function waterBar(stones) {
	if (stones) {
		const parts = [];
		for (let i = 0; i < 6; i++) { const g = new THREE.BoxGeometry(0.32, 0.22, 0.12); g.rotateY((i % 2 - 0.5) * 0.3); g.translate(-0.9 + i * 0.36, 0.02, (i % 3 - 1) * 0.03); parts.push(g.toNonIndexed()); }
		const g = mergeBoxes(parts, [0.46, 0.43, 0.38]);
		return g;
	}
	const g = new THREE.CylinderGeometry(0.11, 0.13, 2.2, 8, 1);
	g.rotateZ(Math.PI / 2); g.translate(0, 0.02, 0);
	const P = g.attributes.position, col = new Float32Array(P.count * 3);
	for (let i = 0; i < P.count; i++) { const top = P.getY(i) > 0.08; col[i * 3] = top ? 0.5 : 0.32; col[i * 3 + 1] = top ? 0.44 : 0.25; col[i * 3 + 2] = top ? 0.36 : 0.18; }
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	g.deleteAttribute('uv');
	return g;
}
function mergeBoxes(parts, c) {
	const pos = [], nor = [];
	for (const q of parts) { pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(pos.map((_, i) => c[i % 3] * (0.85 + ((i * 7919) % 13) / 60)), 3));
	return g;
}
