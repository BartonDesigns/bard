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
import { planTown, localeAt, USE_OF_KIND, hashAt } from './establishments.js';
import { setRequestSource } from './requests.js';
import { payroll } from './payroll.js';

const CW = 256, CH = 64;                 // a board in the atlas, pixels
const FONTS = {
	serif: 'Georgia, "Times New Roman", serif',
	sans: '"Helvetica Neue", Arial, sans-serif',
	script: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
	slab: 'Rockwell, "Roboto Slab", "Courier New", serif',
	narrow: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
};
const DRIVE_CLS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
const BUSY_CLS = { trunk: 2, primary: 2, secondary: 2, tertiary: 1 };

// a board drawn into its cell: the shape in the business's colours, its name fitted across, the
// small line under it
function drawBoard(g, x0, y0, E) {
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
	const COLS = isPhone ? 4 : 8, ROWS = 16, CELLS = COLS * ROWS, SIGN_R = isPhone ? 320 : 650, CAP = CELLS * 2;
	const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	if (cv) { cv.width = COLS * CW; cv.height = ROWS * CH; }
	const g = cv?.getContext('2d');
	const tex = cv ? new THREE.CanvasTexture(cv) : null;
	if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; }
	// the boards: one quad each, its cell of the atlas per instance; lit a little after dark
	const night = { value: 0 };
	const mat = wrap(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
	{
		const prev = mat.onBeforeCompile;
		mat.onBeforeCompile = (sh, r) => {
			prev?.call(mat, sh, r);
			sh.uniforms.uSignNight = night;
			sh.vertexShader = 'attribute vec4 aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aCell.xy + uv * aCell.zw;\n#endif');
			sh.fragmentShader = 'uniform float uSignNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uSignNight;');
		};
		const pk = mat.customProgramCacheKey?.bind(mat);
		mat.customProgramCacheKey = () => (pk ? pk() : '') + '|signs1';
	}
	const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
	const cellA = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
	geo.setAttribute('aCell', cellA);
	const signs = new THREE.InstancedMesh(geo, mat, CAP);
	signs.count = 0; signs.frustumCulled = false; signs.castShadow = false; signs.receiveShadow = true; signs.visible = false;
	signs.name = 'economy-signs';
	group.add(signs);

	// the atlas's cells: name -> cell, kept across rebuilds so a board already drawn stays
	const cellOf = new Map(), free = [...Array(CELLS).keys()];
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

	// what a building is to the economy, worked out once per building where it costs (the roads)
	const cache = new Map();
	let locate = null, plan = [], here = 'us-ca', stamp = 0, homes = [];
	const H = (x, z) => bay.heightAt(x, z);
	// by the sea or a bay: low ground with water close by on some side
	function coastAt(x, z) {
		const g0 = H(x, z);
		if (g0 > 20) return false;
		for (const k of [170, 380]) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) if (H(x + dx * k, z + dz * k) < -0.6) return true;
		return false;
	}
	// the mapped streets near a point: the busiest it faces, whether two meet by it, a freeway near
	function roadsAt(x, z) {
		if (!real?.near) return { busy: 0, corner: false, highway: false };
		let busy = 0, highway = false;
		const close = new Set();
		for (const r of real.near('roads', x, z, 230)) {
			const pts = r.pts;
			if (!pts) continue;
			let best = 1e9;
			for (let i = 0; i + 3 < pts.length; i += 2) {
				const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
				best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
			}
			if (r.cls === 'motorway' && best < 230) highway = true;
			if (best < 40 && BUSY_CLS[r.cls]) busy = Math.max(busy, BUSY_CLS[r.cls]);
			if (best < 26 && DRIVE_CLS.has(r.cls)) close.add(r.name || r);
		}
		return { busy, corner: close.size >= 2, highway };
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
			c = { street, coast: coastAt(o.x, o.z), rural, wild, wildN, highway: R.highway, down: U.d || (b?.site === 'downtown' ? 0.4 : 0) };
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
	function apply(list, cx, cz) {
		stamp++;
		const ll = locate?.(cx, cz);
		here = ll ? localeAt(ll.lat, ll.lon) : 'us-ca';
		const seen = new Set(), descs = [];
		for (const o of list) {
			if (o.biz) o.biz = null;
			if (o.src?.biz) o.src.biz = null;
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
				D.rural = n < 6; D.wild = D.rural && (D.wildN >= 3 || H(D.x, D.z) > 160);
				// (kept once its neighbours are surely all in the list)
				const c = D.o.src?.econ;
				if (c && Math.hypot(D.x - cx, D.z - cz) < 1500) { c.rural = D.rural; c.wild = D.wild; }
			}
		}
		plan = planTown(descs, { locale: here });
		// the homes, for the requests' customers (a door in front of each, the nearer ones)
		const isBiz = new Set(plan.map((E) => E.i));
		homes = descs.filter((D, i) => D.use === 'house' && !isBiz.has(i) && Math.hypot(D.x - cx, D.z - cz) < 1200).map((D) => { const F = faceOf(D.o, 0); return { x: F.cx + F.nx * 2, z: F.cz + F.nz * 2 }; });
		const props = list.props || (list.props = {});
		const put = (k, e) => (props[k] || (props[k] = [])).push(e);
		const boards = [];
		for (const E of plan) {
			const D = descs[E.i], o = D.o;
			o.biz = E;
			if (o.src && 'kind' in o.src) o.src.biz = E;
			E.id = 'biz:' + Math.round(E.x) + ':' + Math.round(E.z);
			// a row house that took a shop has a shopfront and sign band now
			if (D.use === 'row') o.kind = KIND.shop;
			const F = faceOf(o, D.face);
			const g = Math.max(H(F.cx + F.nx * 1.5, F.cz + F.nz * 1.5), o.y + (o.src ? 0.3 : 1.2));
			const top = o.y + o.h;
			E.door = [F.cx + F.nx * 1.4, F.cz + F.nz * 1.4];
			E.ground = g;
			const P = (along, out) => [F.cx + F.tx * along + F.nx * out, F.cz + F.tz * along + F.nz * out];
			const close = Math.hypot(o.x - cx, o.z - cz) < 700;
			// the awning, in its colours: the one it had made over, or a new one over the shopfront
			if (E.awning && (D.use === 'shop' || D.use === 'row' || D.use === 'apt' || (D.use === 'retail' && F.run < 60))) {
				if (o.awn) o.awn.col = E.awning;
				else if (close) { const [ax, az] = P(0, 0.8); list.push({ x: ax, y: g + 2.95, z: az, w: Math.min(F.run * 0.86, 14), d: 1.6, h: 0.18, a: faceA(o, D.face), col: E.awning, kind: KIND.plain, roof: null }); }
			}
			// the board(s): over a shopfront, high on a big box or an office, on a post in a front
			// garden, on a monument at an office's door
			const bd = Math.hypot(o.x - cx, o.z - cz);
			if (bd < SIGN_R) {
				const wall = (y, w, h) => boards.push({ E, x: F.cx + F.nx * 0.07, y, z: F.cz + F.nz * 0.07, yaw: F.yaw, w, h, d: bd });
				// (the shopfront's sign band, 3.45 to 4.15 m up in the city's shader)
				if (D.use === 'shop' || D.use === 'row') { const w = Math.min(F.run - 0.8, 3.2); wall(g + 3.8, w, w / 4); }
				else if (D.use === 'apt') { const w = Math.min(F.run * 0.5, 3.6); wall(g + 3.4, w, w / 4); }
				else if (D.use === 'retail') { const h = Math.max(1.1, Math.min(2.6, F.run / 9)); wall(Math.min(top - h / 2 - 0.3, g + 4.9), h * 4, h); }
				else if (D.use === 'office' || D.use === 'tower' || D.use === 'industry') { const h = Math.max(0.9, Math.min(D.use === 'tower' ? 5 : 2.2, F.run / 9)); wall(top - h / 2 - (D.use === 'tower' ? 2.5 : 0.6), h * 4, h); }
				if (D.use === 'house') {
					// a sign on a post by the front walk; the board hangs from its arm
					const [sx, sz] = P(-F.run * 0.32, Math.min(5.5, 2.5 + o.d * 0.15)), sy = H(sx, sz);
					put('postsign', [sx, sy, sz, -F.yaw, 1, 1, 1, 0]);
					boards.push({ E, x: sx + F.tx * 0.88, y: sy + 1.42, z: sz + F.tz * 0.88, yaw: F.yaw, w: 1.6, h: 0.4, d: bd });
				}
				if (E.props.includes('monument')) {
					const [mx, mz] = P(F.run * 0.18, 6), my = H(mx, mz);
					put('monument', [mx, my, mz, -F.yaw, 1, 1, 1, 0]);
					boards.push({ E, x: mx + F.nx * 0.17, y: my + 1.0, z: mz + F.nz * 0.17, yaw: F.yaw, w: 2.8, h: 0.7, d: bd });
				}
			}
			// what it puts out front (close in only: they are small)
			if (bd < (isPhone ? 260 : 450)) frontProps(E, D, F, P, put, list, g);
		}
		uploadBoards(boards);
		return plan;
	}
	// the props of a business, by kind, at its front
	function frontProps(E, D, F, P, put, list, g) {
		const yaw = -F.yaw, side = hashAt(E.x, E.z, 41) < 0.5 ? -1 : 1, tint = E.awning || [1, 1, 1];
		const at = (along, out, k, turn = 0, sc = 1, col = null, lift = 0) => { const [x, z] = P(along, out); const y = lift ? g + lift : H(x, z); const e = [x, y, z, yaw + turn, sc, sc, sc, 0]; if (col) e.push(col[0], col[1], col[2]); put(k, e); };
		let tables = 0;
		for (const k of E.props) {
			if (k === 'table') { at((tables % 2 ? 1 : -1) * Math.min(F.run * 0.28, 3.5), 2.4 + Math.floor(tables / 2) * 2, 'table'); tables++; }
			else if (k === 'umbrella') at(side * Math.min(F.run * 0.28, 3.5), 2.4, 'umbrella', 0, 1, tint);
			else if (k === 'aboard') at(side * Math.min(F.run * 0.35, 2.6), 1.3, 'aboard', 0.3);
			else if (k === 'bench') at(-side * Math.min(F.run * 0.3, 3), 1.0, 'bench', Math.PI);
			else if (k === 'crates') at(side * Math.min(F.run * 0.3, 2.4) + (tables ? 0.8 : 0), 0.9, 'crates', 0, 1, [0.85, 0.3, 0.15]);
			else if (k === 'kegs') at(-side * Math.min(F.run * 0.4, 3), 0.8, 'kegs');
			else if (k === 'antlers') at(0, 0.08, 'antlers', 0, 1, null, 2.75);
			else if (k === 'gearrack') at(side * Math.min(F.run * 0.36, 3.2), 0.6, 'gearrack');
			else if (k === 'nets') at(-side * (F.run / 2 + 1.8), -F.half * 0.3, 'nets', Math.PI / 2);
			else if (k === 'outrigger') at(side * (F.run / 2 + 2.6), -F.half * 0.2, 'outrigger', 0, 1, tint);
			else if (k === 'surfrack') at(-side * Math.min(F.run * 0.36, 3), 0.7, 'surfrack');
			else if (k === 'boat') at(side * (F.run / 2 + 4), 2, 'boat');
			else if (k === 'car') at(-side * Math.min(F.run * 0.3, 4), 4, 'car', Math.PI / 2, 1, [0.6, 0.6, 0.62]);
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
			drawBoard(g, (c % COLS) * CW, Math.floor(c / COLS) * CH, E);
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
			A[n * 4] = col / COLS + iu; A[n * 4 + 1] = 1 - (row + 1) / ROWS + iv; A[n * 4 + 2] = 1 / COLS - 2 * iu; A[n * 4 + 3] = 1 / ROWS - 2 * iv;
			n++;
		}
		signs.count = n; signs.visible = n > 0;
		signs.instanceMatrix.needsUpdate = true; cellA.needsUpdate = true;
	}

	// ---------- asking ----------
	const view = (E) => ({ id: E.id, name: E.name, type: E.type, label: E.label, setting: E.setting, use: E.use, x: Math.round(E.x * 10) / 10, z: Math.round(E.z * 10) / 10, door: E.door.map((v) => Math.round(v * 10) / 10), venue: E.venue, service: E.service, locale: E.locale });
	function near(x, z, r = 300) {
		const out = [];
		for (const E of plan) { const d = Math.hypot(E.x - x, E.z - z); if (d < r) out.push([d, E]); }
		return out.sort((a, b) => a[0] - b[0]).map(([, E]) => view(E));
	}
	function byId(id) { const E = plan.find((q2) => q2.id === id); return E ? view(E) : null; }
	function info(x, z, r = 600, list = null) {
		let n = 0, biz = 0;
		const types = {};
		if (list) {
			const seen = new Set();
			for (const o of list) { if (Math.hypot(o.x - x, o.z - z) > r) continue; const D = describe(o); if (!D || D.use === 'civic' || D.use === 'school') { if (D) n++; continue; } const k = Math.round(o.x) + ',' + Math.round(o.z); if (seen.has(k)) continue; seen.add(k); n++; if (o.biz) biz++; }
		}
		for (const E of plan) if (Math.hypot(E.x - x, E.z - z) < r) types[E.type] = (types[E.type] || 0) + 1;
		return { locale: here, total: plan.length, near: biz, buildings: n, share: n ? Math.round(biz / n * 1000) / 1000 : 0, types, signs: signs.count, atlas: `${cellOf.size}/${CELLS}`, sample: near(x, z, r).slice(0, 8).map((E) => `${E.name} (${E.label})`), stamp };
	}
	// the requests take their places from here; payroll its employers (the business whose
	// building a workplace stands in)
	setRequestSource({ near, homes: (x, z, r) => homes.filter((h) => Math.hypot(h.x - x, h.z - z) < r) });
	payroll.setResolver((x, z) => {
		let best = null, bd = 1e9;
		for (const E of plan) { const ca = Math.cos(E.a), sa = Math.sin(E.a), dx = x - E.x, dz = z - E.z, lx = Math.abs(ca * dx + sa * dz) - E.w / 2, lz = Math.abs(-sa * dx + ca * dz) - E.d / 2, d = Math.max(lx, lz); if (d < bd) { bd = d; best = E; } }
		return best && bd < 3 ? view(best) : null;
	});
	return { apply, near, byId, info, setNight: (k) => { night.value = 0.55 * k; }, setLocator: (fn) => { locate = fn; }, list: () => plan.map(view), mesh: signs, texture: tex };
}
