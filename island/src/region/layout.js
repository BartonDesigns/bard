// How a place is laid out: where its houses stand and which way they face, its lanes and
// its square, the fields round it, the things by the houses. Each kit names a layout; each
// layout is the way such places really grow: a harbour row along the shore, a street with
// houses down both sides, houses stepped along the contours of a slope, a plaza with its
// church, a tight cluster of courtyards and lanes, the ring of a herders' camp with every
// door to the south, round houses about the cattle kraal, stilt houses along the river with
// the canoes at the landing, rows of houses down lanes among the rice, the souk's covered
// streets, a dense grid of city blocks, farmsteads strung along a road across the valley.
//
// plan(kit, opts) -> { lots, paths, plazas, fields, r }: lots are { type, x, z, rot, w, d,
// role } in metres about the centre (+x east, +z south), turned so the lot's front (-z
// local) faces rot; paths are polylines with a width; fields rectangles with a crop and the
// way their rows run. H(x, z) is the ground (relative), wet(x, z) true over water.
// Dense places (the souk, the city) are laid out a block at a time (blockLots).

export const SIZES = {
	log: [7, 6], arctic: [7.5, 5.5], station: [14, 7], shed: [4, 3.2], sauna: [4, 3.5], barn: [12, 9], chalet: [9.5, 8], haybarn: [6, 5],
	stonehouse: [8, 7], adobethatch: [6.5, 5], cottage: [8, 6], halftimber: [8.5, 7], farmhouse: [10, 9], cube: [6, 5.5], stonetile: [8, 7],
	adobe: [7.5, 6.5], courtyard: [14, 14], townhouse: [9, 9], pueblo: [12, 10], homestead: [14, 12], rondavel: [5.5, 5.5], tinroof: [7, 5],
	granary: [3.2, 3.2], mudhouse: [10, 10], stilt: [7, 5.5], hut: [5, 4], tarp: [5, 4], longhouse: [50, 10], fale: [9, 7], tincottage: [6, 5],
	easthouse: [10, 7], neonblock: [16, 14], shophouse: [6, 13], flatbrick: [8, 8], mudtile: [7, 5], ger: [6.5, 6.5], 'ger-large': [8.5, 8.5],
	silo: [5, 5], tank: [3.4, 3.4], store: [12, 9], school: [20, 7], hall: [18, 10], teahouse: [10, 8], mosque: [24, 22], 'mosque-small': [14, 13],
	mudmosque: [28, 22], mandir: [12, 16], templehall: [24, 18], pagoda: [10, 10], gompa: [24, 18], chorten: [5, 5], chapel: [11, 7],
	'chapel-white': [15, 7], 'church-red': [16, 9], 'church-wood': [17, 9], 'church-stone': [23, 9], 'church-steeple': [17, 9], 'church-white': [17, 9],
	'church-small': [12, 7], belltower: [17, 10], mission: [22, 10], banyan: [10, 10], well: [2.4, 2.4], wat: [18, 26],
};
export const BLOCK = (kit) => (kit.build.layout === 'souk' ? 46 : 52);
const sizeOf = (t, r) => { const s = SIZES[t] || [3, 3]; const k = 0.9 + r() * 0.25; return [s[0] * k, s[1] * k]; };
const wpick = (r, L) => { let x = r() * L.reduce((a, b) => a + b[1], 0); for (const [k, w] of L) { if ((x -= w) < 0) return k; } return L[0][0]; };
const ang = (x, z) => Math.atan2(x, z);

// does a new footprint (with a margin) overlap any lot already placed?
function clear(lots, x, z, w, d, m = 2) {
	const R = Math.hypot(w, d) / 2 + m;
	for (const L of lots) { const R2 = Math.hypot(L.w, L.d) / 2; if (Math.hypot(L.x - x, L.z - z) < R + R2 - m * 0.6) return false; }
	return true;
}
// the downhill direction and steepness at a point
function slopeAt(H, x, z, e = 6) { const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e); return { gx, gz, s: Math.hypot(gx, gz) }; }
// toward the water, if there is water within reach (a shore or a river bank): the bearing
function waterSide(wet, R) {
	let best = null, bd = 1e9;
	for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; for (let d = 20; d <= R; d += 20) if (wet(Math.sin(a) * d, Math.cos(a) * d)) { if (d < bd) { bd = d; best = a; } break; } }
	return best === null ? null : { a: best, d: bd };
}

export function plan(kit, { r, H, wet, size = 0, centre = true, spread = null }) {
	const B = kit.build, lots = [], paths = [], plazas = [], fields = [];
	const [n0, n1] = B.count, n = Math.round(n0 + (n1 - n0) * Math.min(1, size / 2 + r() * 0.5)), R = spread || B.spread * (0.8 + size * 0.25);
	const put = (type, x, z, rot, role = 'house') => {
		const [w, d] = sizeOf(type, r);
		if (wet(x, z) || !clear(lots, x, z, w, d, role === 'prop' ? 0.8 : 2.2)) return null;
		if (slopeAt(H, x, z).s > (role === 'prop' ? 0.45 : 0.32)) return null;
		const L = { type, x, z, rot, w, d, role };
		lots.push(L);
		return L;
	};
	const house = () => wpick(r, B.houses);
	const props = (k) => { for (let i = 0; i < k; i++) { const L = lots[Math.floor(r() * lots.length)]; if (!L || L.role !== 'house') continue; const a = r() * Math.PI * 2, d = Math.hypot(L.w, L.d) / 2 + 2 + r() * 3; put(wpick(r, B.props), L.x + Math.sin(a) * d, L.z + Math.cos(a) * d, L.rot + (r() - 0.5) * 0.6, 'prop'); } };
	const W = kit.build.layout;
	let ax = r() * Math.PI;                 // the place's own bearing
	const water = waterSide(wet, R * 1.4);

	if (W === 'harbour' || W === 'shore' || W === 'river') {
		// houses in rows along the water, facing it; the centre a little back from the shore
		const toward = water ? water.a : ax, along = toward + Math.PI / 2, back = water ? Math.max(25, water.d - 30) : 0;
		const ux = Math.sin(along), uz = Math.cos(along), vx = Math.sin(toward), vz = Math.cos(toward);
		const rows = W === 'river' ? 2 : 3;
		for (let row = 0; row < rows && lots.length < n; row++) for (let i = -n; i <= n && lots.length < n; i++) {
			const t = i * (13 + r() * 6), s = back - row * (22 + r() * 6) - 6 + (r() - 0.5) * 6;
			put(house(), ux * t + vx * s, uz * t + vz * s, toward + (r() - 0.5) * 0.25);
		}
		paths.push({ pts: [[-ux * R + vx * back, -uz * R + vz * back], [ux * R + vx * back, uz * R + vz * back]], w: 3.5 });
		if (centre) put(B.centre[0], -vx * 30 + ux * 10, -vz * 30 + uz * 10, toward, 'centre');
		// the boats and the racks at the water
		const nb = 3 + Math.floor(r() * 5);
		for (let i = 0; i < nb; i++) { const t = (r() - 0.5) * R, s = back + 12 + r() * 8; put(W === 'river' ? 'canoe' : r() < 0.5 ? 'skiff' : wpick(r, B.props), ux * t + vx * s, uz * t + vz * s, along + (r() - 0.5) * 0.4, 'prop'); }
		if (W === 'river' && water) put('landing', vx * (water.d - 4), vz * (water.d - 4), along, 'prop');
	} else if (W === 'street' || W === 'lanes') {
		// a street through the middle (it bends a little), houses down both sides
		const k = W === 'lanes' ? 3 : 1, pts = [];
		for (let li = 0; li < k; li++) {
			const off = (li - (k - 1) / 2) * 34, bend = (r() - 0.5) * 0.3, L0 = [];
			for (let s = -R; s <= R; s += 20) { const a = ax + bend * s / R, px = Math.sin(a) * s + Math.cos(ax) * off, pz = Math.cos(a) * s - Math.sin(ax) * off; L0.push([px, pz]); }
			paths.push({ pts: L0, w: W === 'lanes' ? 3 : 5 }); pts.push(L0);
		}
		if (centre) put(B.centre[Math.floor(r() * B.centre.length)], Math.cos(ax) * 18, -Math.sin(ax) * 18, ax + Math.PI / 2, 'centre');
		for (let tries = 0; lots.length < n && tries < n * 8; tries++) {
			const L0 = pts[Math.floor(r() * pts.length)], i = 1 + Math.floor(r() * (L0.length - 2)), [px, pz] = L0[i], [qx, qz] = L0[i + 1];
			const a = Math.atan2(qx - px, qz - pz), side = r() < 0.5 ? -1 : 1, off = 9 + r() * 4;
			const x = px + Math.cos(a) * off * side, z = pz - Math.sin(a) * off * side;
			put(house(), x, z, a + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
		}
		if (W === 'lanes') for (let i = 0; i < 6; i++) { const L0 = pts[i % pts.length], q = L0[Math.floor(r() * L0.length)]; put(wpick(r, B.props), q[0] + 3, q[1] + 3, ax, 'prop'); }
	} else if (W === 'slope' || W === 'hill') {
		// houses along the contours, facing down the hill (or, on a hilltop, out from the top)
		const top = W === 'hill';
		if (centre) put(B.centre[0], 0, 0, ax, 'centre');
		for (let tries = 0; lots.length < n && tries < n * 10; tries++) {
			const a = r() * Math.PI * 2, d = 18 + Math.sqrt(r()) * R * (top ? 0.7 : 1), x = Math.sin(a) * d, z = Math.cos(a) * d;
			const S = slopeAt(H, x, z), face = top ? ang(x, z) : S.s > 0.03 ? Math.atan2(-S.gx, -S.gz) : ax;
			put(house(), x, z, face + (r() - 0.5) * 0.3);
		}
		for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + ax; paths.push({ pts: [[0, 0], [Math.sin(a) * R * 0.5, Math.cos(a) * R * 0.5], [Math.sin(a + 0.4) * R, Math.cos(a + 0.4) * R]], w: 2.5 }); }
	} else if (W === 'plaza') {
		// a square with its church on one side; houses round it and down the streets off it
		const s = 26 + size * 8;
		plazas.push({ x: 0, z: 0, w: s, d: s, rot: ax });
		if (centre) put(B.centre[0], Math.sin(ax) * (s / 2 + 8), Math.cos(ax) * (s / 2 + 8), ax + Math.PI, 'centre');
		for (let tries = 0; lots.length < n && tries < n * 10; tries++) {
			const gx = Math.round((r() - 0.5) * 2 * R / 14), gz = Math.round((r() - 0.5) * 2 * R / 14);
			if (Math.abs(gx) < 2 && Math.abs(gz) < 2) continue;
			const x = gx * 14, z = gz * 14, cs = Math.cos(ax), sn = Math.sin(ax);
			put(house(), x * cs + z * sn, -x * sn + z * cs, ax + (Math.abs(gx) > Math.abs(gz) ? (gx > 0 ? -1 : 1) * Math.PI / 2 : gz > 0 ? Math.PI : 0));
		}
		for (let i = 0; i < 4; i++) { const a = ax + i * Math.PI / 2; paths.push({ pts: [[Math.sin(a) * s / 2, Math.cos(a) * s / 2], [Math.sin(a) * R, Math.cos(a) * R]], w: 4 }); }
	} else if (W === 'compact') {
		// a close cluster: houses wall to wall along crooked lanes, a well or a mosque in a small square
		plazas.push({ x: 0, z: 0, w: 22, d: 22, rot: ax });
		if (centre) put(B.centre[Math.floor(r() * B.centre.length)], Math.sin(ax) * 20, Math.cos(ax) * 20, ax + Math.PI, 'centre');
		const heads = [];
		for (let i = 0; i < 5; i++) heads.push({ x: 0, z: 0, a: ax + i * 1.26 + (r() - 0.5) * 0.4, pts: [[0, 0]] });
		for (let step = 0; step < 14; step++) for (const h of heads) {
			h.a += (r() - 0.5) * 0.5; h.x += Math.sin(h.a) * 12; h.z += Math.cos(h.a) * 12; h.pts.push([h.x, h.z]);
			for (const side of [-1, 1]) if (lots.length < n) { const x = h.x + Math.cos(h.a) * 8 * side, z = h.z - Math.sin(h.a) * 8 * side; put(house(), x, z, h.a + (side > 0 ? -Math.PI / 2 : Math.PI / 2)); }
		}
		for (const h of heads) paths.push({ pts: h.pts, w: 3 });
	} else if (W === 'camp') {
		// gers in a loose line or arc, each door to the south; the pens and the horse line by them
		ax = 0;
		for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * (14 + r() * 8); put(i === 0 && centre ? B.centre[0] : house(), t, (r() - 0.5) * 10 + Math.abs(t) * 0.25, (r() - 0.5) * 0.15, i === 0 ? 'centre' : 'house'); }
		put('pen', (r() - 0.5) * 30, 35, 0, 'prop'); put('hitch', (r() - 0.5) * 20, 16, Math.PI / 2, 'prop');
		if (r() < 0.6) put('ovoo', (r() - 0.5) * 80, -60 - r() * 40, 0, 'prop');
	} else if (W === 'kraal') {
		// round houses about the kraal, where the cattle are kept at night
		put('kraal', 0, 0, 0, 'prop');
		if (centre) put(B.centre[Math.floor(r() * B.centre.length)], Math.sin(ax) * (R * 0.8), Math.cos(ax) * (R * 0.8), ax + Math.PI, 'centre');
		for (let i = 0; i < n * 3 && lots.length < n + 2; i++) { const a = r() * Math.PI * 2, d = 18 + r() * R * 0.6; put(house(), Math.sin(a) * d, Math.cos(a) * d, a + Math.PI); }
		for (let i = 0; i < 3; i++) { const a = ax + i * 2.1; paths.push({ pts: [[0, 0], [Math.sin(a) * R, Math.cos(a) * R]], w: 2.5 }); }
	} else if (W === 'farms') {
		// a road across the valley, farmsteads along it with their barns and silos, fields between
		const L0 = [];
		for (let s = -R; s <= R; s += 40) L0.push([Math.sin(ax) * s, Math.cos(ax) * s]);
		paths.push({ pts: L0, w: 6 });
		if (centre) put(B.centre[Math.floor(r() * B.centre.length)], Math.cos(ax) * 16, -Math.sin(ax) * 16, ax + Math.PI / 2, 'centre');
		for (let k = 0; k < n; k++) {
			const s = (r() - 0.5) * 2 * R, side = r() < 0.5 ? -1 : 1, off = 35 + r() * 30;
			const x = Math.sin(ax) * s + Math.cos(ax) * off * side, z = Math.cos(ax) * s - Math.sin(ax) * off * side, face = ax + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
			const h = put(B.houses[0][0], x, z, face);
			if (!h) continue;
			put(wpick(r, B.houses.slice(1)), x + Math.cos(face) * 22, z - Math.sin(face) * 22, face, 'house');
			fields.push({ x: x + Math.cos(face) * 0 + Math.sin(face) * -70, z: z + Math.cos(face) * -70, w: 90, d: 90, rot: face, crop: k % 3 });
		}
	} else if (W === 'souk' || W === 'blocks') {
		// the dense quarters are laid out a block at a time (blockLots)
		return { lots, paths, plazas, fields, dense: true, ax, R };
	} else {
		for (let i = 0; i < n * 4 && lots.length < n; i++) { const a = r() * Math.PI * 2, d = 10 + r() * R; put(house(), Math.sin(a) * d, Math.cos(a) * d, a + Math.PI); }
	}
	props(Math.round(n * 0.8));
	// the fields round the place
	const F = B.fields;
	if (F && W !== 'farms') {
		const nf = F === 'oasis' ? 4 : 6 + Math.floor(r() * 6);
		for (let i = 0; i < nf; i++) {
			const a = r() * Math.PI * 2, d = R * (0.9 + r() * 0.8), x = Math.sin(a) * d, z = Math.cos(a) * d;
			if (wet(x, z)) continue;
			const S = slopeAt(H, x, z);
			const terrace = F === 'terrace' || F === 'paddy';
			if (!terrace && S.s > 0.2) continue;
			fields.push({ x, z, w: 40 + r() * 50, d: 30 + r() * 40, rot: terrace && S.s > 0.03 ? Math.atan2(S.gx, S.gz) : a, crop: Math.floor(r() * 3), kind: F });
		}
	}
	return { lots, paths, plazas, fields, ax, R };
}

// the lots of one block of a dense quarter (bx, bz: the block's grid index), in the
// settlement's metres: houses along all four sides facing out to the streets, the centre's
// buildings in the middle blocks, souk lanes along the main streets
export function blockLots(kit, S, bx, bz, rnd) {
	const B = kit.build, souk = B.layout === 'souk', P = souk ? 46 : 52, street = souk ? 5 : 9;
	const cs = Math.cos(S.ax), sn = Math.sin(S.ax), out = [];
	const cxl = bx * P, czl = bz * P, inner = P - street;
	const r = rnd((bx * 73856093) ^ (bz * 19349663) ^ S.seed);
	const toS = (x, z) => [x * cs + z * sn, -x * sn + z * cs];
	if (Math.hypot(cxl, czl) > S.R + P) return out;
	const add = (type, lx, lz, rot, role, w, d) => { const [x, z] = toS(cxl + lx, czl + lz); out.push({ type, x, z, rot: rot + S.ax, w, d, role }); };
	// the middle: the great mosque and the tea house, or the temple and its pagoda, in a square
	if (bx === 0 && bz === 0) { add(B.centre[0], 0, 0, Math.PI, 'centre', ...(SIZES[B.centre[0]] || [20, 20])); if (B.centre[1]) add(B.centre[1], inner / 2 - 6, -inner / 2 + 6, 0, 'centre', ...(SIZES[B.centre[1]] || [10, 10])); return out; }
	// the souk's covered street runs out along the main axis
	if (souk && bx === 0 && Math.abs(bz) <= 3) { add('souk', 0, 0, Math.PI / 2, 'souk', inner, 9); return out; }
	if (souk && (bx === 1 || bx === -1) && bz === 0) { add('souk', 0, 0, 0, 'souk', inner, 9); return out; }
	// a small square now and then, with a fountain or a well
	if (r() < 0.06) { add(souk ? 'fountain' : 'stall', 0, 0, 0, 'prop', 4, 4); return out; }
	const ty = () => wpick(r, B.houses);
	for (let side = 0; side < 4; side++) {
		const rot = [Math.PI, 0, Math.PI / 2, -Math.PI / 2][side];
		let t = -inner / 2;
		while (t < inner / 2 - 4) {
			const type = ty(), [w0, d0] = SIZES[type] || [8, 8], w = Math.min(w0 * (0.85 + r() * 0.3), inner / 2 - t), d = Math.min(d0, inner / 2 - 1);
			if (w < 4) break;
			const along = t + w / 2, depth = inner / 2 - d / 2;
			const [lx, lz] = side === 0 ? [along, -depth] : side === 1 ? [-along, depth] : side === 2 ? [depth, along] : [-depth, -along];
			// (the corners: only the first two sides fill them)
			if (side < 2 || Math.abs(along) < inner / 2 - d0) add(type, lx, lz, rot, 'house', w, d);
			t += w + (souk ? 0 : r() * 2);
		}
	}
	if (!souk && r() < 0.5) add('lanternstring', 0, -inner / 2 - street / 2, 0, 'prop', inner, 1);
	if (!souk && r() < 0.4) add('stall', -inner / 2 + 3, -inner / 2 - 2.5, Math.PI, 'prop', 3, 2);
	return out;
}

