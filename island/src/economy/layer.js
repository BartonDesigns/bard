// The economy in the city (bay/city.js calls it each time the buildings round you are rebuilt):
// every building, gridded, mapped or grown, is read as the economy sees it, the town planned
// (establishments.js), and each business shown: its name on a board (one shared atlas, one
// instanced draw for every sign), its awning in its colours (the city's own boxes), the things
// it puts out front (bay/lotkit.js props), a shopfront where a row house took a shop. Then
// anyone can ask what is where: near(x, z, r) gives the name, kind and door of each.
//
// Phones get a smaller atlas (64 boards) and see the boards out to 320 m; the rest 128 and
// 650 m. No material per building: one for the boards, the rest is the city's.

import * as THREE from 'three';
import { planTown, planTownSteps, localeAt, USE_OF_KIND, hashAt } from './establishments.js';
import { coastScan, coastClass, COAST_RINGS, profileOf, hoursOf, frontSpec, fasciaOf, gapRoom, postsFor, stateAt } from './frontage.js';
import { createStorefronts } from './storefront.js';
import { setRequestSource } from './requests.js';
import { payroll } from './payroll.js';
import { drawTradeBoard, artRevision } from '../signage/art.js';
import { createRoadsAt, roadsAtOnce, DRIVE_CLS, BUSY_CLS } from './roadsat.js';

const CW = 256, CH = 64;                 // a board in the atlas, pixels
const FONTS = {
	serif: 'Georgia, "Times New Roman", serif',
	sans: '"Helvetica Neue", Arial, sans-serif',
	script: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
	slab: 'Rockwell, "Roboto Slab", "Courier New", serif',
	narrow: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
};

// a '#rrggbb' colour to linear rgb (the shopfront frames and fascias take the board's)
function hexLin(h) {
	const n = parseInt(String(h || '#888888').slice(1), 16), c = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
	return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}
// a board drawn into its cell: the shape in the business's colours, its name fitted across, the
// small line under it
function drawBoard(g, x0, y0, E, phone = false) {
	g.clearRect(x0, y0, 256, 64);
	if (drawTradeBoard(g, x0 + 3, y0 + 3, CW - 6, CH - 6, E, { phone })) return;
	const { shape, font, bg, fg } = E.sign, m = 3, w = CW - 2 * m, h = CH - 2 * m, x = x0 + m, y = y0 + m;
	g.save();
	g.clearRect(x0, y0, CW, CH);
	g.beginPath();
	if (shape === 'oval') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
	else if (shape === 'pill') g.roundRect(x, y, w, h, h / 2);
	else if (shape === 'arch') { g.moveTo(x, y + h); g.lineTo(x, y + h * 0.45); g.quadraticCurveTo(x + w / 2, y - h * 0.35, x + w, y + h * 0.45); g.lineTo(x + w, y + h); g.closePath(); }
	else if (shape === 'banner') { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 12, y + h / 2); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.lineTo(x + 12, y + h / 2); g.closePath(); }
	else g.roundRect(x, y, w, h, shape === 'neon' ? 8 : 3);
	g.fillStyle = bg; g.fill();
	// wood grain on a plank, a keyline inside the edge on the rest
	if (shape === 'plank') { g.save(); g.clip(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x, y + k * h / 5 + Math.sin(k * 2.3) * 2); g.bezierCurveTo(x + w * 0.3, y + k * h / 5 - 3, x + w * 0.7, y + k * h / 5 + 3, x + w, y + k * h / 5); g.stroke(); } g.restore(); }
	g.lineWidth = shape === 'block' ? 0 : 2; g.strokeStyle = fg;
	if (g.lineWidth) { g.save(); g.translate(x + w / 2, y + h / 2); g.scale((w - 8) / w, (h - 8) / h); g.translate(-(x + w / 2), -(y + h / 2)); g.stroke(); g.restore(); }
	// the name, as big as fits; the small line under it
	const tag = E.tag ? String(E.tag).toUpperCase() : '', weight = font === 'serif' || font === 'script' ? '' : 'bold ';
	let px = tag ? 30 : 36;
	const room = (shape === 'oval' || shape === 'arch' ? w * 0.78 : w - 22);
	g.font = `${weight}${px}px ${FONTS[font] || FONTS.sans}`;
	const tw = g.measureText(E.name).width;
	if (tw > room) px = Math.max(12, Math.floor(px * room / tw));
	g.font = `${weight}${px}px ${FONTS[font] || FONTS.sans}`;
	g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
	if (shape === 'neon') { g.shadowColor = fg; g.shadowBlur = 8; }
	g.fillText(E.name, x + w / 2, y + h / 2 - (tag ? 7 : 0) + (shape === 'arch' ? 4 : 0));
	g.shadowBlur = 0;
	if (tag) {
		g.font = `bold 10px ${FONTS.sans}`;
		const t2 = g.measureText(tag).width, sc = Math.min(1, room / Math.max(1, t2));
		g.save(); g.translate(x + w / 2, y + h / 2 + 15); g.scale(sc, 1); g.globalAlpha = 0.85; g.fillText(tag, 0, 0); g.restore();
	}
	g.restore();
}

export function createEconomyLayer({ group, wrap = (m) => m, isPhone = false, bay, real = null, KIND }) {
	const COLS = isPhone ? 4 : 8, ROWS = 16, CELLS = COLS * ROWS, SIGN_R = isPhone ? 320 : 650, CAP = CELLS * 2, FRONT_R = isPhone ? 200 : 380;
	// the shopfronts, fascias, awnings and the pavement's things (storefront.js)
	const SF = createStorefronts({ group, wrap, isPhone });
	const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	if (cv) { cv.width = COLS * CW; cv.height = ROWS * CH; }
	const g = cv?.getContext('2d');
	const tex = cv ? new THREE.CanvasTexture(cv) : null;
	if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; }
	// the boards: one quad each, its cell of the atlas per instance; lit after dark while the
	// business is open (and the bars' and the all-night places' signs), dark after hours
	const night = { value: 0 };
	const mat = wrap(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
	{
		const prev = mat.onBeforeCompile;
		mat.onBeforeCompile = (sh, r) => {
			prev?.call(mat, sh, r);
			sh.uniforms.uSignNight = night;
			sh.vertexShader = 'attribute vec4 aCell;\nattribute float aLit;\nvarying float vLit;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvLit = aLit;\n#ifdef USE_MAP\nvMapUv = aCell.xy + uv * aCell.zw;\n#endif');
			sh.fragmentShader = 'uniform float uSignNight;\nvarying float vLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uSignNight * vLit;');
		};
		const pk = mat.customProgramCacheKey?.bind(mat);
		mat.customProgramCacheKey = () => (pk ? pk() : '') + '|signs2';
	}
	const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
	const cellA = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
	geo.setAttribute('aCell', cellA);
	// (each board's sign lit or not by its business's hours: stateAt, a few times a game hour)
	const litA = new THREE.InstancedBufferAttribute(new Float32Array(CAP).fill(1), 1);
	geo.setAttribute('aLit', litA);
	const signE = [];
	const signState = {};
	const signs = new THREE.InstancedMesh(geo, mat, CAP);
	signs.count = 0; signs.frustumCulled = false; signs.castShadow = false; signs.receiveShadow = true; signs.visible = false;
	signs.name = 'economy-signs';
	group.add(signs);

	// the atlas's cells: name -> cell, kept across rebuilds so a board already drawn stays
	let artRev = artRevision();
	const cellOf = new Map(), free = [...Array(CELLS).keys()];
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

	// what a building is to the economy, worked out once per building where it costs (the roads)
	const cache = new Map();
	let locate = null, plan = [], here = 'us-ca', stamp = 0, homes = [];
	const H = (x, z) => bay.heightAt(x, z);
	// by the sea or a bay (frontage.js coastScan): rings of samples out to 1.6 km; the class is
	// 3 on the waterfront (water within 200 m), 2 by the harbour (480 m), 1 near the coast (the
	// town reaches it), 0 inland. (Out on the globe the sea stands at about nought, where the
	// Bay's is carved below it; a globe town's coast is often only a metre or two down, so the
	// sea there is anything under half a metre.)
	// (kept by 40 m cell: the buildings of a block share their scan, and it is made once)
	// The globe's own word for the sea where it gives one (setSea, earth/globe.js through main.js):
	// sea.at(x, z) true on the water, false on land (low land is not sea), null where the ground
	// is not the globe's (the Bay's survey); sea.coast(x, z) its land mask there, 0 at the
	// coastline rising to about 0.5 well inland, or null. The globe places its coast from cells a
	// tenth of a degree across and its relief stands a low coastal plain up as a bluff (Eureka's
	// waterfront, a metre above Humboldt Bay, is 200 m up, the sea half a kilometre to two off),
	// so on its ground the distances are read GLOBE_K times as generously, and a place its mask
	// puts at the coast (under COAST_MASK) is by the water however high the relief has it.
	const GLOBE_K = 2.5, COAST_MASK = 0.2, GLOBE_RINGS = COAST_RINGS.map((r) => r * GLOBE_K);
	const coastCells = new Map();
	let seaTest = null;
	function coastAt(x, z) {
		const i = Math.floor(x / 40), j = Math.floor(z / 40), key = i * 100003 + j;
		let C = coastCells.get(key);
		if (!C) {
			const sea = bay.loaded?.() === false ? 0.5 : -0.6, cx = (i + 0.5) * 40, cz = (j + 0.5) * 40;
			const mask = seaTest?.coast?.(cx, cz), globe = mask != null && Number.isFinite(mask);
			const Hs = seaTest?.at ? (px, pz) => { const w = seaTest.at(px, pz); return w === true ? -10 : w === false && H(px, pz) < sea ? 1 : H(px, pz); } : H;
			const S = globe ? coastScan(Hs, cx, cz, sea, GLOBE_RINGS, mask < COAST_MASK ? Infinity : 30) : coastScan(Hs, cx, cz, sea);
			C = { cls: coastClass(S, globe ? GLOBE_K : 1), dir: Number.isFinite(S.dist) ? [S.dx, S.dz] : null, dist: S.dist };
			if (coastCells.size > 40000) coastCells.clear();
			coastCells.set(key, C);
		}
		return C;
	}
	// the mapped streets near a point: the busiest it faces, whether two meet by it, a freeway near
	// (roadsat.js: sorted once per cell round a point, the same answer as walking every street)
	const cellRoads = real?.nearOwn && real?.roadVersion ? createRoadsAt(real) : null;
	function roadsAt(x, z) {
		if (!real?.near) return { busy: 0, corner: false, highway: false };
		return cellRoads ? cellRoads(x, z) : roadsAtOnce(real, x, z);
	}
	// the side of a mapped shop or office that faces the street (0 +z, 1 -z, 2 +x, 3 -x)
	function frontOf(o) {
		if (!real?.near) return 0;
		const ca = Math.cos(o.a), sa = Math.sin(o.a);
		let best = 0, bd = 1e9;
		for (const [k, lx, lz] of [[0, 0, o.d / 2 + 9], [1, 0, -o.d / 2 - 9], [2, o.w / 2 + 9, 0], [3, -o.w / 2 - 9, 0]]) {
			const x = o.x + ca * lx - sa * lz, z = o.z + sa * lx + ca * lz;
			for (const r of real.near('roads', x, z, 30)) {
				if (!DRIVE_CLS.has(r.cls)) continue;
				const pts = r.pts;
				for (let i = 0; i + 3 < pts.length; i += 2) {
					const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az, l2 = dx * dx + dz * dz || 1;
					const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t) - (k === 0 ? 2 : 0);
					if (d < bd) { bd = d; best = k; }
				}
			}
		}
		return best;
	}
	// a gridded building's use from its kind
	function gridUse(o) {
		const f = Math.floor(o.kind + 1e-6);
		if (f === KIND.row) return 'row';
		if ((f === KIND.house && o.kind > 1.005) || f === KIND.houseGarageL || f === KIND.houseGarageR) return 'house';
		if (f === KIND.shop) return 'shop';
		if (f === KIND.retail) return 'retail';
		if (f === KIND.office) return o.roof ? 'civic' : o.h > 30 ? 'tower' : 'office';
		if (f === KIND.tower) return 'tower';
		if (f === KIND.industry) return 'industry';
		if (f === KIND.apt) return 'apt';
		return null;
	}
	// one building of the list -> the economy's view of it (or null)
	function describe(o) {
		const b = o.src && 'kind' in o.src ? o.src : null;
		const use = b ? USE_OF_KIND[b.kind] : gridUse(o);
		if (!use || o.h < 2.5 || !o.w) return null;
		const key = Math.round(o.x * 2) + ':' + Math.round(o.z * 2);
		let c = b?.econ || cache.get(key);
		if (!c) {
			const U = bay.urbanAt ? bay.urbanAt(o.x, o.z) : { u: 0.5, d: 0 };
			const R = b && !b.gen ? roadsAt(o.x, o.z) : { busy: 0, corner: false, highway: false };
			let street = 0;
			if (b?.gen) { const core = b.core ?? 1, cls = b.street; street = Math.max(BUSY_CLS[cls] || 0, core < 0.4 ? 2 : core < 0.6 || b.artery ? 1 : 0); }
			else if (b) { street = Math.max(R.busy, R.corner ? 1 : 0); const L = real?.landAt?.(o.x, o.z); if (L && L.lu === 7) street = 2; }
			else street = o.street ?? 0;
			// open country: few buildings about; the woods: wild land by it, or up in the hills
			// open country and the woods' edge: for a gridded house from how built-up the town is
			// there; for a mapped or grown one from how many neighbours it has (apply, below) and
			// the wild land round it
			let rural, wild, wildN = 0;
			if (use === 'house') {
				if (b && real?.landAt) { for (const [dx, dz] of [[60, 0], [-60, 0], [0, 60], [0, -60], [42, 42], [-42, 42], [42, -42], [-42, -42]]) { const L = real.landAt(o.x + dx, o.z + dz); if (L && (L.lu === 0 || L.lu === 12)) wildN++; } }
				else { rural = U.u < 0.35; wild = rural && H(o.x, o.z) > 140; }
			} else { rural = false; wild = false; }
			const C = coastAt(o.x, o.z);
			c = { street, coast: C.cls >= 2, shore: C.cls, seaDir: C.dir, rural, wild, wildN, highway: R.highway, down: U.d || (b?.site === 'downtown' ? 0.4 : 0) };
			if (b) b.econ = c; else { cache.set(key, c); if (cache.size > 60000) cache.clear(); }
		}
		let front = o.front ?? 1, face = front < 0 ? 1 : 0;
		// (a mapped shop's front is the side toward its street; a grown town's already face theirs)
		if (b && !b.gen && use !== 'house') { if (b.econFace === undefined) b.econFace = frontOf(o); face = b.econFace; }
		return { x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, h: o.h, use, ...c, sign: b?.sign || null, face, o };
	}

	// ---------- the plan, made visible ----------
	// where a face is: its middle, outward normal, the run along it, how far in the middle is
	function faceOf(o, face) {
		const ca = Math.cos(o.a), sa = Math.sin(o.a), F = o.fit, w = F ? F[2] : o.w, d = F ? F[3] : o.d, x = F ? F[0] : o.x, z = F ? F[1] : o.z;
		const [lx, lz, half, run] = face === 0 ? [0, 1, d / 2, w] : face === 1 ? [0, -1, d / 2, w] : face === 2 ? [1, 0, w / 2, d] : [-1, 0, w / 2, d];
		const nx = ca * lx - sa * lz, nz = sa * lx + ca * lz;
		return { cx: x + nx * half, cz: z + nz * half, nx, nz, tx: nz, tz: -nx, run, half, yaw: Math.atan2(nx, nz) };
	}
	// the turn of a city box laid along a face (its local +z out from the face)
	const faceA = (o, face) => o.a + [0, Math.PI, -Math.PI / 2, Math.PI / 2][face];
	// apply(list, cx, cz): the buildings round you made businesses, all at once; applySteps the
	// same a slice at a time (the city's rebuild, bay/city.js: yield between slices), the
	// businesses standing as they were till the last slice puts the new ones in place together
	function apply(list, cx, cz) {
		const it = applySteps(list, cx, cz);
		for (let r = it.next(); !r.done; r = it.next());
		return plan;
	}
	function* applySteps(list, cx, cz) {
		stamp++;
		const ll = locate?.(cx, cz);
		const loc = ll ? localeAt(ll.lat, ll.lon) : 'us-ca';
		const seen = new Set(), descs = [];
		let n = 0;
		for (const o of list) {
			if ((++n & 1023) === 0) yield;
			const D = describe(o);
			if (!D) continue;
			const k = Math.round(o.x) + ',' + Math.round(o.z);
			if (seen.has(k)) continue;              // (a tower's setback crown is the same building)
			seen.add(k);
			descs.push(D);
		}
		// a mapped or grown house with few neighbours stands in open country (an estate, a farm, a
		// cabin); with wild land round it too, at the edge of the woods
		{
			const G = new Map(), C = 40, key = (i, j) => i * 73856093 ^ j * 19349663;
			for (const D of descs) if (D.use === 'house') { const k = key(Math.floor(D.x / C), Math.floor(D.z / C)); (G.get(k) || G.set(k, []).get(k)).push(D); }
			for (const D of descs) {
				if (D.use !== 'house' || D.rural !== undefined) continue;
				let n = -1;
				for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) for (const Q of G.get(key(Math.floor(D.x / C) + i, Math.floor(D.z / C) + j)) || []) if ((Q.x - D.x) ** 2 + (Q.z - D.z) ** 2 < 6400) n++;
				// (a grown town's lots are a planned suburb's, sparse at its edge; the mapped estates are sparser)
				D.rural = n < (D.o.src?.gen ? 5 : 8); D.wild = D.rural && (D.wildN >= 3 || H(D.x, D.z) > 160);
				// (kept once its neighbours are surely all in the list)
				const c = D.o.src?.econ;
				if (c && Math.hypot(D.x - cx, D.z - cz) < 1500) { c.rural = D.rural; c.wild = D.wild; }
			}
		}
		yield;
		const next = yield* planTownSteps(descs, { locale: loc });
		// (from here on in one go)
		here = loc;
		for (const o of list) { if (o.biz) o.biz = null; if (o.src?.biz) o.src.biz = null; }
		plan = next;
		// the homes, for the requests' customers (a door in front of each, the nearer ones)
		const isBiz = new Set(plan.map((E) => E.i));
		homes = descs.filter((D, i) => D.use === 'house' && !isBiz.has(i) && Math.hypot(D.x - cx, D.z - cz) < 1200).map((D) => { const F = faceOf(D.o, 0); return { x: F.cx + F.nx * 2, z: F.cz + F.nz * 2 }; });
		const props = list.props || (list.props = {});
		const put = (k, e) => (props[k] || (props[k] = [])).push(e);
		const boards = [], fronts = [];
		for (const E of plan) {
			const D = descs[E.i], o = D.o;
			o.biz = E;
			if (o.src && 'kind' in o.src) o.src.biz = E;
			// (a house's rooms are fitted out for its business when it is built near you: bay/houses.js)
			const grp = o.src?.grp;
			if (grp && D.use === 'house') grp.estab = E;
			E.id = 'biz:' + Math.round(E.x) + ':' + Math.round(E.z);
			// a row house that took a shop has a shopfront and sign band now
			if (D.use === 'row') o.kind = KIND.shop;
			const F = faceOf(o, D.face);
			const g = Math.max(H(F.cx + F.nx * 1.5, F.cz + F.nz * 1.5), o.y + (o.src ? 0.3 : 1.2));
			const top = o.y + o.h, bd = Math.hypot(o.x - cx, o.z - cz);
			E.door = [F.cx + F.nx * 1.4, F.cz + F.nz * 1.4];
			E.ground = g;
			// (the face it fronts the street with, for the glass's decals: signage/)
			E.front = { x: F.cx, z: F.cz, nx: F.nx, nz: F.nz, run: F.run, g, height: Math.max(0, top - g), door: 0, face: D.face };
			const P = (along, out) => [F.cx + F.tx * along + F.nx * out, F.cz + F.tz * along + F.nz * out];
			// the awning, in its colours: the one it had made over, or a new one over the shopfront
			if (E.awning && (D.use === 'shop' || D.use === 'row' || D.use === 'apt' || (D.use === 'retail' && F.run < 60))) {
				if (o.awn) o.awn.col = E.awning;
				else if (bd < 700) { const [ax, az] = P(0, 0.8); list.push({ x: ax, y: g + 2.95, z: az, w: Math.min(F.run * 0.86, 14), d: 1.6, h: 0.18, a: faceA(o, D.face), col: E.awning, kind: KIND.plain, roof: null }); }
			}
			// what it puts out front (close in only: they are small), then its front
			E.spots = {};
			if (bd < (isPhone ? 260 : 450)) frontProps(E, D, F, P, put, list, g);
			const R = dress(E, D, F, P, g, top, bd, boards, put);
			if (R) fronts.push(R);
		}
		cityBoards = boards; cityFronts = fronts;
		refresh();
	}
	// how a business shows itself (economy/frontage.js): its shopfront's glazing, fascia and
	// board, a house's shop window under an awning, the pavement's things kept to the room
	// there is before the kerb, its staff's spots out front, and the anchors other systems
	// may dress (a vinyl on the door, the hours by it: environmental graphics)
	function dress(E, D, F, P, g, top, bd, boards, put) {
		const o = D.o, prof = profileOf(E.type);
		E.hours = hoursOf(E);
		E.door = [F.cx + F.nx * 1.4, F.cz + F.nz * 1.4];
		E.ground = g;
		E.face = { x: F.cx, z: F.cz, nx: F.nx, nz: F.nz, run: F.run };
		const near = bd < FRONT_R, side = hashAt(E.x, E.z, 41) < 0.5 ? -1 : 1;
		const spec = near ? frontSpec(D.use, F.run, top - g, prof.style) : null;
		const wall = (y, w, h) => boards.push({ E, x: F.cx + F.nx * 0.075, y, z: F.cz + F.nz * 0.075, yaw: F.yaw, w, h, d: bd });
		const boxes = [], items = [], anchors = [];
		let awning = null;
		const bg = hexLin(E.sign.bg), fa = fasciaOf(spec);
		let doorX = 0;
		if (spec) doorX = spec.kind === 'bays' || spec.kind === 'office' ? 0 : D.use === 'row' || D.use === 'shop' ? -side * Math.min(1.2, spec.w * 0.12) : side * Math.max(0, spec.w / 2 - 0.75);
		if (spec && spec.kind !== 'bays' && spec.kind !== 'office') { const [dx, dz] = P(doorX, 1.4); E.door = [dx, dz]; }
		// the board(s): on the fascia over a shopfront, high on a big box or an office, on a post
		// in a front garden, on a monument at an office's door
		if (bd < SIGN_R) {
			if (fa && (D.use === 'house' || D.use === 'apt' || D.use === 'row' || D.use === 'shop' || D.use === 'industry')) {
				wall(g + fa.y, fa.w, fa.h);
				// (the fascia itself, in the board's colour a shade darker, a little wider than the board)
				boxes.push([F.cx, g + fa.y, F.cz, fa.w + 0.34, fa.h + 0.2, 0.07, [bg[0] * 0.7, bg[1] * 0.7, bg[2] * 0.7]]);
				anchors.push({ kind: 'fascia', x: F.cx + F.nx * 0.08, y: g + fa.y, z: F.cz + F.nz * 0.08, nx: F.nx, nz: F.nz, w: fa.w, h: fa.h, surface: 'board' });
			}
			else if (D.use === 'shop' || D.use === 'row') { const w = Math.min(F.run - 0.8, 3.2); wall(g + 3.8, w, w / 4); }
			else if (D.use === 'apt') { const w = Math.min(F.run * 0.5, 3.6); wall(g + 3.4, w, w / 4); }
			else if (D.use === 'retail') { const h = Math.max(1.1, Math.min(2.6, F.run / 9)); wall(Math.min(top - h / 2 - 0.3, g + 4.9), h * 4, h); }
			else if (D.use === 'office' || D.use === 'tower' || D.use === 'industry') { const h = Math.max(0.9, Math.min(D.use === 'tower' ? 5 : 2.2, F.run / 9)); wall(top - h / 2 - (D.use === 'tower' ? 2.5 : 0.6), h * 4, h); }
			if (D.use === 'house' && (!spec || spec.kind === 'office') && put) {
				// a sign on a post by the front walk; the board hangs from its arm
				const [sx, sz] = P(-F.run * 0.32, Math.min(5.5, 2.5 + o.d * 0.15)), sy = H(sx, sz);
				put('postsign', [sx, sy, sz, -F.yaw, 1, 1, 1, 0]);
				boards.push({ E, x: sx + F.tx * 0.88, y: sy + 1.42, z: sz + F.tz * 0.88, yaw: F.yaw, w: 1.6, h: 0.4, d: bd });
			}
			if (E.props.includes('monument') && put) {
				const [mx, mz] = P(F.run * 0.18, 6), my = H(mx, mz);
				put('monument', [mx, my, mz, -F.yaw, 1, 1, 1, 0]);
				boards.push({ E, x: mx + F.nx * 0.17, y: my + 1.0, z: mz + F.nz * 0.17, yaw: F.yaw, w: 2.8, h: 0.7, d: bd });
			}
		}
		if (!near) { E.posts = []; E.anchors = anchors; return null; }
		// the room out front, from the facade to the kerb less the pavement's walking width
		const room = gapRoom(gapAt(F), D.use);
		const at = (along, out, k, turn = 0, col = null) => { const [x, z] = P(along, out); items.push({ k, x, y: H(x, z), z, yaw: F.yaw + turn, col }); return [x, z]; };
		const tint = E.awning || [0.85, 0.85, 0.85];
		if (spec) {
			anchors.push({ kind: 'window', x: F.cx + F.nx * 0.06, y: g + (spec.y0 + spec.y1) / 2, z: F.cz + F.nz * 0.06, nx: F.nx, nz: F.nz, w: spec.w, h: spec.y1 - spec.y0, surface: 'glass' });
			if (spec.kind !== 'bays' && spec.kind !== 'office') {
				const [dx, dz] = P(doorX, 0.06);
				anchors.push({ kind: 'door', x: dx, y: g + 1.05, z: dz, nx: F.nx, nz: F.nz, w: 0.92, h: 2.05, surface: 'glass' });
				const [hx, hz] = P(doorX + (doorX > 0 ? -0.62 : 0.62), 0.06);
				anchors.push({ kind: 'hours', x: hx, y: g + 1.45, z: hz, nx: F.nx, nz: F.nz, w: 0.3, h: 0.4, surface: 'glass' });
			}
			// a house's shop window under its own awning (striped or plain)
			if (D.use === 'house' && E.awning && spec.kind === 'glass') awning = { x: F.cx + F.nx * 0.07, y: g + spec.y1 + 0.04, z: F.cz + F.nz * 0.07, w: spec.w + 0.4, drop: 1, depth: Math.min(1.25, room + 0.2), col: E.awning, stripe: hashAt(E.x, E.z, 43) < 0.55 };
		}
		// the pavement's things: the A-frame by the door, tables and chairs where there is room
		// (and the umbrellas over them), planters either side, a bike rack, a parking sign by a
		// converted house's drive, pallets by a workshop's doors
		const glassy = spec && spec.kind !== 'office';
		if (glassy && (E.props.includes('aboard') || (prof.style === 'glass' && hashAt(E.x, E.z, 44) < 0.45))) {
			const [ax, az] = at(side * Math.min(F.run * 0.36, 2.6) * (doorX ? -1 : 1), Math.min(1.1, room * 0.5 + 0.3), 'aboard', 0.35);
			anchors.push({ kind: 'aboard', x: ax, y: H(ax, az) + 0.6, z: az, nx: F.nx, nz: F.nz, w: 0.5, h: 0.7, surface: 'chalkboard' });
		}
		if (glassy && prof.seat && room >= 1.5) {
			const n = Math.min(prof.seat * 2, Math.floor((spec.w + 1) / 1.8)), out = Math.min(room - 0.65, room > 3.4 ? 2.4 : 1.4);
			const chairs = [tint[0] * 0.7 + 0.2, tint[1] * 0.7 + 0.2, tint[2] * 0.7 + 0.2];
			let made = 0;
			for (let k = 0; k < n + 2 && made < n; k++) {
				const along = (k - (n + 1) / 2) * 1.8;
				if (Math.abs(along - doorX) < 1.1 || Math.abs(along) > F.run / 2 + 0.4) continue;
				const [tx, tz] = at(along, out, 'bistro', Math.PI / 2, chairs);
				if (!made) E.spots.table = [tx, tz];
				made++;
				if (E.props.includes('umbrella') && room >= 2.4 && made % 2 === 1) at(along, out, 'umbrella', 0, tint);
			}
		}
		if (glassy && spec.kind === 'glass' && (E.setting === 'downtown' || E.setting === 'main' || E.setting === 'harbour') && hashAt(E.x, E.z, 45) < 0.45 && room >= 0.8 && spec.w + 2 < F.run + 0.2) for (const s2 of [-1, 1]) at(s2 * (spec.w / 2 + 0.55), 0.35, 'planter', 0, [0.9, 0.9, 0.9]);
		if (glassy && (E.type === 'cafe' || E.type === 'bakery' || E.type === 'bike' || E.type === 'surf') && room >= 2.2 && hashAt(E.x, E.z, 46) < 0.6) at(-side * Math.min(F.run / 2 - 0.4, spec.w / 2 + 1.0), room - 0.4, 'bikerack', Math.PI / 2);
		if (spec && D.use === 'house' && (D.street || 0) >= 1) at(-side * (F.run / 2 + 0.6), Math.min(room, 4.2), 'psign', -0.4);
		if (spec && spec.kind === 'bays') at(side * (spec.w / 2 + 1.1), 0.8, 'pallets', 0.2);
		// the staff out front while it is open: a server by the tables, the mechanic at the car,
		// the fisher at the boat, a shopkeeper at the door
		E.posts = postsFor(E).map((q) => {
			let x, z;
			if (q.x === 'car' && E.spots.car) [x, z] = [E.spots.car[0] + F.nx * 1.0 + F.tx * 1.1, E.spots.car[1] + F.nz * 1.0 + F.tz * 1.1];
			else if (q.x === 'boat' && E.spots.boat) [x, z] = [E.spots.boat[0] + F.nx * 1.2, E.spots.boat[1] + F.nz * 1.2];
			else if (q.role === 'server' && E.spots.table) [x, z] = [E.spots.table[0] + F.tx * 0.9, E.spots.table[1] + F.tz * 0.9];
			else if (typeof q.x === 'number') [x, z] = P(q.x * Math.min(F.run / 2, 3.2) * side, Math.min(q.out, room));
			else return null;
			return { id: E.id, x, z, y: H(x, z), heading: F.yaw + q.yaw, pose: q.pose, sit: q.sit || 0, role: q.role, brk: !!q.break };
		}).filter(Boolean);
		E.anchors = anchors;
		const R = { E, o, x: F.cx, y: g, z: F.cz, nx: F.nx, nz: F.nz, yaw: F.yaw, spec, display: prof.d, depth: Math.max(2.4, Math.min(7, F.half * 2 * 0.62)), seed: hashAt(E.x, E.z, 71), frame: frameOf(bg, E), doorX, shutters: stateAt(E, 3, 3, ST).shutters, boxes, awning, items, room };
		return R;
	}
	const ST = {};
	// the frame of a shopfront: the board's colour, darkened toward bronze (a light board gets a dark frame)
	function frameOf(bg, E) {
		const l = bg[0] * 0.3 + bg[1] * 0.55 + bg[2] * 0.15;
		if (l > 0.55) return hashAt(E.x, E.z, 47) < 0.5 ? [0.06, 0.06, 0.065] : [0.12, 0.09, 0.06];
		return [bg[0] * 0.85 + 0.02, bg[1] * 0.85 + 0.02, bg[2] * 0.85 + 0.02];
	}
	// the gap from a facade's middle out to the nearest kerb in front of it (the mapped and grown
	// towns' streets; NaN where the streets are the grid's: frontage.js takes a usual gap)
	function gapAt(F) {
		if (!real?.near) return NaN;
		let best = NaN;
		for (const r of real.near('roads', F.cx + F.nx * 6, F.cz + F.nz * 6, 30)) {
			if (!DRIVE_CLS.has(r.cls)) continue;
			const pts = r.pts, hw = (r.w || 7) / 2;
			for (let i = 0; i + 3 < pts.length; i += 2) {
				const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((F.cx - ax) * dx + (F.cz - az) * dz) / l2)), qx = ax + dx * t - F.cx, qz = az + dz * t - F.cz;
				const along = qx * F.nx + qz * F.nz;
				if (along <= 0.5) continue;
				const gap = Math.hypot(qx, qz) - hw;
				if (!(gap >= best)) best = Math.max(0.3, gap);
			}
		}
		return best;
	}
	// the props of a business, by kind, at its front (the boards, tables and umbrellas are the
	// storefronts' own now: storefront.js)
	function frontProps(E, D, F, P, put, list, g) {
		const yaw = -F.yaw, side = hashAt(E.x, E.z, 41) < 0.5 ? -1 : 1, tint = E.awning || [1, 1, 1];
		const at = (along, out, k, turn = 0, sc = 1, col = null, lift = 0) => { const [x, z] = P(along, out); const y = lift ? g + lift : H(x, z); const e = [x, y, z, yaw + turn, sc, sc, sc, 0]; if (col) e.push(col[0], col[1], col[2]); put(k, e); return [x, z]; };
		for (const k of E.props) {
			if (k === 'bench') at(-side * Math.min(F.run * 0.3, 3), 1.0, 'bench', Math.PI);
			else if (k === 'crates') at(side * Math.min(F.run * 0.3, 2.4) + 0.8, 0.9, 'crates', 0, 1, [0.85, 0.3, 0.15]);
			else if (k === 'kegs') at(-side * Math.min(F.run * 0.4, 3), 0.8, 'kegs');
			else if (k === 'antlers') at(0, 0.08, 'antlers', 0, 1, null, 2.75);
			else if (k === 'gearrack') at(side * Math.min(F.run * 0.36, 3.2), 0.6, 'gearrack');
			else if (k === 'nets') at(-side * (F.run / 2 + 1.8), -F.half * 0.3, 'nets', Math.PI / 2);
			else if (k === 'outrigger') E.spots.boat = at(side * (F.run / 2 + 2.6), -F.half * 0.2, 'outrigger', 0, 1, tint);
			else if (k === 'surfrack') at(-side * Math.min(F.run * 0.36, 3), 0.7, 'surfrack');
			else if (k === 'boat') E.spots.boat = at(side * (F.run / 2 + 4), 2, 'boat');
			else if (k === 'car') E.spots.car = at(-side * Math.min(F.run * 0.3, 4), 4, 'car', Math.PI / 2, 1, [0.6, 0.6, 0.62]);
			else if (k === 'menuboard') {
				// the drive-through: a lane round the side, the menu board beside it, the window
				const [lx, lz] = P(side * (F.run / 2 + 2.2), -F.half);
				list.push({ x: lx, y: H(lx, lz) - 0.95, z: lz, w: 3.4, d: F.half * 2 + 6, h: 0.99, a: faceA(D.o, D.face), col: [0.2, 0.2, 0.21], kind: KIND.plain, roof: null });
				at(side * (F.run / 2 + 4.6), -F.half * 0.6, 'menuboard', side * Math.PI / 2, 1, tint);
			}
		}
	}
	// the boards: the nearest get cells (the farther are tiny, and wait for one)
	function uploadBoards(boards) {
		if (!g) return;
		boards.sort((a, b) => a.d - b.d);
		const want = new Map();
		for (const B of boards) { const k = B.E.name + '|' + B.E.tag; if (!want.has(k) && want.size < CELLS) want.set(k, B.E); }
		// cells no longer wanted go back; the newly wanted are drawn
		for (const [k, c] of cellOf) if (!want.has(k)) { cellOf.delete(k); free.push(c); }
		let drew = 0;
		for (const [k, E] of want) {
			if (cellOf.has(k) || !free.length) continue;
			const c = free.pop();
			cellOf.set(k, c);
			drawBoard(g, (c % COLS) * CW, Math.floor(c / COLS) * CH, E, isPhone);
			drew++;
		}
		if (drew) tex.needsUpdate = true;
		let n = 0;
		const A = cellA.array, iu = 1.5 / (COLS * CW), iv = 1.5 / (ROWS * CH);
		for (const B of boards) {
			if (n >= CAP) break;
			const c = cellOf.get(B.E.name + '|' + B.E.tag);
			if (c === undefined) continue;
			q.setFromAxisAngle(Y, B.yaw);
			signs.setMatrixAt(n, m4.compose(p.set(B.x, B.y, B.z), q, s.set(B.w, B.h, 1)));
			const col = c % COLS, row = Math.floor(c / COLS);
			signE[n] = B.E;
			A[n * 4] = col / COLS + iu; A[n * 4 + 1] = 1 - (row + 1) / ROWS + iv; A[n * 4 + 2] = 1 / COLS - 2 * iu; A[n * 4 + 3] = 1 / ROWS - 2 * iv;
			n++;
		}
		signs.count = n; signs.visible = n > 0;
		signs.instanceMatrix.needsUpdate = true; cellA.needsUpdate = true;
		signE.length = n; litT = -1;
	}

	// ---------- the regional kit's towns (region/settle.js) ----------
	// Japan's lanes, the European villages and the rest the regional kit builds: their built
	// cells' lots read as the economy's buildings and planned like any town, their businesses
	// shown with boards, fronts and the pavement's things (no city list there: their own)
	const RTYPE = { shophouse: ['shop', 6.2, 0], neonblock: ['shop', 9, 0], store: ['retail', 4, 0], townhouse: ['row', 6.4, 0.1], teahouse: ['shop', 3.2, 0.3], easthouse: ['house', 2.9, 0.45], cottage: ['house', 2.8, 0.2], halftimber: ['house', 5.9, 0.3], stonehouse: ['house', 3, 0.2], stonetile: ['house', 3, 0.2], chalet: ['house', 3, 0.3], farmhouse: ['house', 3.2, 0.2], adobe: ['house', 3, 0.1], cube: ['house', 3, 0.1], flatbrick: ['house', 3.2, 0.1], tinroof: ['house', 2.8, 0.2], log: ['house', 2.6, 0.3], courtyard: ['house', 3.4, 0.1] };
	let regional = null, rKey = '', rT = 0, rplan = [], regionBoards = [], regionFronts = [];
	function applyRegional(cx, cz) {
		const S = regional?.();
		if (!S?.sites) { if (rplan.length) { rplan = []; regionBoards = []; regionFronts = []; refresh(); } return; }
		const R = isPhone ? 520 : 800, descs = [];
		let sig = 0;
		for (const s of S.sites.values()) {
			const P0 = s.planned;
			if (!P0 || s.kind === 'real' || s.kind === 'lore' || !s.cells || Math.hypot(s.x - cx, s.z - cz) > (P0.reach || 400) + R) continue;
			for (const C of s.cells.values()) {
				const lots = P0.dense ? P0.cellCache?.get(C.i + ',' + C.j) : P0.byCell?.get(C.i + ',' + C.j);
				if (!lots) continue;
				sig = (sig * 31 + C.i * 7 + C.j + 1) | 0;
				for (const L of lots) {
					if (L.role !== 'house') continue;
					const x = s.x + L.x, z = s.z + L.z;
					if (Math.hypot(x - cx, z - cz) > R) continue;
					const T = RTYPE[L.type] || ['house', 3, 0.2];
					// (the lot's front faces rot: the economy's face 0 is local +z, so turned by -rot)
					const core = Math.hypot(L.x, L.z) / Math.max(90, P0.R || P0.reach || 200);
					const o = { x, z, w: L.w, d: L.d, a: -L.rot, y: H(x, z) - 0.3 + T[2], h: T[1] + 0.3, regional: true, kind: -1 };
					const C2 = coastAt(x, z);
					descs.push({ x, z, w: L.w, d: L.d, a: o.a, h: T[1], use: T[0], street: P0.dense ? (core < 0.5 ? 2 : 1) : core < 0.3 ? 2 : core < 0.55 ? 1 : 0, coast: C2.cls >= 2, shore: C2.cls, rural: !P0.dense && (P0.lots?.length || 0) < 14, wild: false, down: P0.dense ? Math.max(0, 0.45 - core * 0.4) : 0, face: 0, o, sign: null });
				}
			}
		}
		const key = sig + ':' + descs.length + ':' + Math.round(cx / 60) + ':' + Math.round(cz / 60);
		if (key === rKey) return;
		rKey = key;
		const ll = locate?.(cx, cz), loc = ll ? localeAt(ll.lat, ll.lon) : here;
		rplan = descs.length ? planTown(descs, { locale: loc }) : [];
		const boards = [], fronts = [];
		for (const E of rplan) {
			const D = descs[E.i], o = D.o;
			E.id = 'biz:' + Math.round(E.x) + ':' + Math.round(E.z);
			E.spots = {};
			const F = faceOf(o, 0), P = (along, out) => [F.cx + F.tx * along + F.nx * out, F.cz + F.tz * along + F.nz * out];
			const g = o.y + 0.3, bd = Math.hypot(o.x - cx, o.z - cz);
			const Rr = dress(E, D, F, P, g, o.y + o.h, bd, boards, null);
			if (Rr) fronts.push(Rr);
		}
		regionBoards = boards; regionFronts = fronts;
		refresh();
	}
	// the boards and fronts of both, nearest first
	let cityBoards = [], cityFronts = [], builtFn = null;
	function refresh() {
		uploadBoards(regionBoards.length ? cityBoards.concat(regionBoards) : cityBoards);
		const all = regionFronts.length ? cityFronts.concat(regionFronts) : cityFronts;
		SF.set(all, builtFn);
	}
	// every frame (main.js): the fronts' hours, lit and shutters (once a game minute inside),
	// the regional towns looked over every two seconds
	function tick(cam, hours, nightK, dt = 0.016, dow = new Date().getDay()) {
		clock += dt; lastHours = hours;
		if (artRev !== artRevision()) {
			artRev = artRevision(); cellOf.clear(); free.length = 0;
			for (let i = 0; i < CELLS; i++) free.push(i);
			uploadBoards(regionBoards.length ? cityBoards.concat(regionBoards) : cityBoards);
		}
		night.value = 0.55 * nightK;
		if (regional && clock - rT > 2) { rT = clock; applyRegional(cam.x, cam.z); }
		// the signs by their hours, every couple of seconds after dark
		if (nightK > 0.05 && (clock - litT > 2 || litT < 0)) {
			litT = clock;
			const L = litA.array;
			let changed = false;
			for (let i = 0; i < signE.length; i++) {
				const E = signE[i];
				if (!E) continue;
				if (!E.hours) E.hours = hoursOf(E);
				const v = stateAt(E, hours, dow, signState).sign >= 1 ? 1 : 0.04;
				if (L[i] !== v) { L[i] = v; changed = true; }
			}
			if (changed) litA.needsUpdate = true;
		}
		SF.tick(hours, dow, nightK, clock);
	}
	let clock = 0, litT = -1;

	// ---------- asking ----------
	const everyone = () => (rplan.length ? plan.concat(rplan) : plan);
	const view = (E) => ({ id: E.id, name: E.name, type: E.type, label: E.label, setting: E.setting, use: E.use, x: Math.round(E.x * 10) / 10, z: Math.round(E.z * 10) / 10, door: E.door.map((v) => Math.round(v * 10) / 10), venue: E.venue, service: E.service, locale: E.locale, hours: E.hours, open: !!stateAt(E, lastHours, 3, ST).open });
	let lastHours = 12;
	function near(x, z, r = 300) {
		const out = [];
		for (const E of everyone()) { const d = Math.hypot(E.x - x, E.z - z); if (d < r) out.push([d, E]); }
		return out.sort((a, b) => a[0] - b[0]).map(([, E]) => view(E));
	}
	function byId(id) { const E = everyone().find((q2) => q2.id === id); return E ? view(E) : null; }
	// the raw establishments near a point (for the people's daily life: their posts, doors, hours)
	function raw(x, z, r = 120, out = []) {
		out.length = 0;
		for (const E of plan) if (Math.abs(E.x - x) < r && Math.abs(E.z - z) < r) out.push(E);
		for (const E of rplan) if (Math.abs(E.x - x) < r && Math.abs(E.z - z) < r) out.push(E);
		return out;
	}
	// the anchors a business offers other systems' dressing (environmental graphics: the door's
	// vinyl, the hours by it, the fascia, the A-frame's face, the window): world position, the
	// way the surface faces, its size and what it is
	function anchors(x, z, r = 60) {
		const out = [];
		for (const E of everyone()) {
			if (!E.anchors?.length || Math.hypot(E.x - x, E.z - z) > r) continue;
			for (const A of E.anchors) out.push({ ...A, id: E.id, type: E.type, name: E.name, open: E.hours });
		}
		return out;
	}
	function info(x, z, r = 600, list = null) {
		let n = 0, biz = 0;
		const types = {};
		if (list) {
			const seen = new Set();
			for (const o of list) { if (Math.hypot(o.x - x, o.z - z) > r) continue; const D = describe(o); if (!D || D.use === 'civic' || D.use === 'school') { if (D) n++; continue; } const k = Math.round(o.x) + ',' + Math.round(o.z); if (seen.has(k)) continue; seen.add(k); n++; if (o.biz) biz++; }
		}
		for (const E of everyone()) if (Math.hypot(E.x - x, E.z - z) < r) types[E.type] = (types[E.type] || 0) + 1;
		const harbour = everyone().filter((E) => Math.hypot(E.x - x, E.z - z) < r && (E.type === 'outfitter' || E.type === 'bait' || E.type === 'fishmarket' || E.type === 'boatyard' || E.type === 'seafood')).length;
		return { locale: here, total: plan.length, regional: rplan.length, near: biz, buildings: n, share: n ? Math.round(biz / n * 1000) / 1000 : 0, harbour, types, signs: signs.count, atlas: `${cellOf.size}/${CELLS}`, fronts: SF.info(), sample: near(x, z, r).slice(0, 8).map((E) => `${E.name} (${E.label})`), stamp };
	}
	// the requests take their places from here; payroll its employers (the business whose
	// building a workplace stands in)
	setRequestSource({ near, homes: (x, z, r) => homes.filter((h) => Math.hypot(h.x - x, h.z - z) < r) });
	payroll.setResolver((x, z) => {
		let best = null, bd = 1e9;
		for (const E of everyone()) { const ca = Math.cos(E.a), sa = Math.sin(E.a), dx = x - E.x, dz = z - E.z, lx = Math.abs(ca * dx + sa * dz) - E.w / 2, lz = Math.abs(-sa * dx + ca * dz) - E.d / 2, d = Math.max(lx, lz); if (d < bd) { bd = d; best = E; } }
		return best && bd < 3 ? view(best) : null;
	});
	return {
		apply, applySteps, near, byId, info, raw, anchors, tick,
		// every business planned, the regional towns' too (signage/ lays their glass decals)
		plan: () => everyone(),
		setNight: (k) => { night.value = 0.55 * k; },
		setLocator: (fn) => { locate = fn; },
		// built(o): a building has its rooms built near you (its painted shopfront then goes)
		setBuilt: (fn) => { builtFn = fn; },
		// the regional kit's settlements (region/settle.js createSettlements), when there are any
		setRegional: (fn) => { regional = fn; rKey = ''; },
		// the globe's own sea test ({ at, coast }, or a plain at(x, z)); the buildings' coast found again
		setSea: (S) => { seaTest = typeof S === 'function' ? { at: S } : S || null; coastCells.clear(); cache.clear(); },
		hours: (h) => { lastHours = h; },
		list: () => everyone().map(view), mesh: signs, texture: tex, storefronts: SF,
	};
}
