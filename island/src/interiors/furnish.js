// Furniture for the planned rooms (plan.js): each room's things against its walls, clear of
// its doorways, windows and stairs, by what the room is and where the building stands (a
// Victorian parlour has its fireplace and a piano; a Sunset flat, lighter wood and fewer
// things). Items are drawn by housekit.js (the houses' furniture) or kit.js (the rest).
// Seats are kept for the people who live and work there (people/people.js).

import { ST } from './plan.js';

const WALL_T = { ext: ST.ext, part: ST.part };

// the room's four sides, with the openings in the walls along them
function sidesOf(P, rm) {
	const out = [];
	for (const [axis, pos, n, s, e] of [['x', rm.z0, 1, rm.x0, rm.x1], ['x', rm.z1, -1, rm.x0, rm.x1], ['z', rm.x0, 1, rm.z0, rm.z1], ['z', rm.x1, -1, rm.z0, rm.z1]]) {
		const walls = P.walls.filter((w) => w.k === rm.k && w.axis === axis && Math.abs(w.pos - pos) < WALL_T[w.kind === 'ext' ? 'ext' : 'part'] / 2 + 0.14 && w.s < e - 0.2 && w.e > s + 0.2);
		const open = walls.flatMap((w) => w.open);
		out.push({ axis, pos, n, s, e, walled: walls.length > 0, ext: walls.some((w) => w.kind === 'ext' && !w.party), open });
	}
	return out;
}

// (one level at a time, as it is built: a tall block's floors are furnished when you climb to them)
export function furnish(P, only = -1) {
	const rnd = P.rnd, items = P.items, seats = P.seats, lights = P.lights || (P.lights = []);
	const victorian = P.style === 'victorian' || P.style === 'edwardian';
	for (const rm of P.rooms) {
		if (rm.furnished || (only >= 0 && rm.k !== only)) continue;
		rm.furnished = true;
		const L = P.levels[rm.k], y0 = L.y, sides = sidesOf(P, rm), placed = [];
		const bw = rm.x1 - rm.x0, bd = rm.z1 - rm.z0, cx = (rm.x0 + rm.x1) / 2, cz = (rm.z0 + rm.z1) / 2;
		const hit = (b) => placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
		const inside = (b) => b[0] >= rm.x0 - 0.01 && b[2] <= rm.x1 + 0.01 && b[1] >= rm.z0 - 0.01 && b[3] <= rm.z1 + 0.01;
		// keep clear: the doorways and the way through them, the stairs and their holes
		for (const sd of sides) for (const o of sd.open) {
			if (o.type === 'window' || o.type === 'store') continue;
			const d = o.type === 'bay' ? 0.5 : 1.05, a = o.s0 - 0.12, b = o.s1 + 0.12, f0 = sd.pos, f1 = sd.pos + sd.n * d;
			placed.push(sd.axis === 'x' ? [a, Math.min(f0, f1), b, Math.max(f0, f1)] : [Math.min(f0, f1), a, Math.max(f0, f1), b]);
		}
		for (const f of P.flights) if (f.k === rm.k) placed.push([f.x0 - 0.05, Math.min(f.zb, f.zt) - (f.dir > 0 ? 1 : 0), f.x1 + 0.05, Math.max(f.zb, f.zt) + (f.dir < 0 ? 1 : 0)]);
		for (const h of L.holes) placed.push([h[0] - 0.4, h[1] - 0.4, h[2] + 0.4, h[3] + 0.4]);
		const light = (kind = 'flush') => { items.push({ type: 'ceilingLight', kind, level: 0, y: y0, x: cx, z: cz, rot: 0, w: 0.35, d: 0.35, h: 0, v: rnd(), ceil: L.h }); lights.push([cx, y0 + L.h - 0.5, cz, rm.id]); };
		if (rm.type === 'sealed') continue;
		if (rm.stairs || rm.type === 'corridor') {
			light(rm.type === 'corridor' ? 'flush' : 'pendant');
			if (rm.type === 'corridor' && bd > 5) { items.push({ type: 'rug', x: cx, z: cz, y: y0, rot: 1, w: bd - 1.2, d: 0.8, h: 0.01, v: rnd() }); for (let z = rm.z0 + 3; z < rm.z1 - 2; z += 6) { items.push({ type: 'ceilingLight', kind: 'flush', level: 0, y: y0, x: cx, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h }); } }
			continue;
		}
		// against a wall: w wide, d deep, h high; its front faces into the room
		const against = (type, w, d, h, opt = {}) => {
			const cands = [];
			for (const sd of sides) {
				if (!sd.walled || (opt.side && !opt.side(sd))) continue;
				const len = sd.e - sd.s;
				if (len < w + 0.1) continue;
				const block = sd.open.filter((o) => o.type !== 'window' || h > o.y0 - y0 - 0.05 || opt.noWindow).map((o) => [o.s0 - 0.08, o.s1 + 0.08]);
				const steps = Math.max(1, Math.floor((len - w - 0.3) / 0.25));
				for (let k = 0; k <= steps; k++) {
					const t = k / steps, c = sd.s + 0.12 + w / 2 + t * Math.max(0, len - w - 0.24);
					if (block.some(([a, b]) => c + w / 2 > a && c - w / 2 < b)) continue;
					const f0 = sd.pos, f1 = sd.pos + sd.n * d;
					const box = sd.axis === 'x' ? [c - w / 2, Math.min(f0, f1), c + w / 2, Math.max(f0, f1)] : [Math.min(f0, f1), c - w / 2, Math.max(f0, f1), c + w / 2];
					if (!inside(box) || hit(box)) continue;
					const cl = opt.clear ?? 0.6, g0 = sd.pos + sd.n * d, g1 = sd.pos + sd.n * (d + cl);
					const front = sd.axis === 'x' ? [c - w / 2, Math.min(g0, g1), c + w / 2, Math.max(g0, g1)] : [Math.min(g0, g1), c - w / 2, Math.max(g0, g1), c + w / 2];
					if (cl > 0 && (!inside(front) || hit(front))) continue;
					let score = opt.score ? opt.score(sd, c, t) : 0;
					score += opt.centre ? -Math.abs(t - 0.5) * 2 : 0;
					score += opt.corner ? Math.abs(t - 0.5) * 2 : 0;
					score += opt.long ? len * 0.3 : 0;
					score += rnd() * 0.3;
					cands.push({ score, sd, c, box });
				}
			}
			if (!cands.length) return null;
			cands.sort((a, b) => b.score - a.score);
			const { sd, c, box } = cands[0];
			placed.push(box);
			const rot = sd.axis === 'x' ? (sd.n > 0 ? 0 : 2) : (sd.n > 0 ? 1 : 3);
			const it = { type, room: rm.id, level: 0, y: y0, x: (box[0] + box[2]) / 2, z: (box[1] + box[3]) / 2, rot, w, d, h, side: sd, c, box, v: rnd(), ceil: L.h, ...(opt.extra || {}) };
			items.push(it);
			return it;
		};
		const standing = (type, x, z, w, d, h, rot = 0, pad = 0, extra = {}) => {
			const hw = rot % 2 ? d / 2 : w / 2, hd = rot % 2 ? w / 2 : d / 2;
			const box = [x - hw - pad, z - hd - pad, x + hw + pad, z + hd + pad];
			if (!inside(box) || hit(box)) return null;
			placed.push(box);
			const it = { type, room: rm.id, level: 0, y: y0, x, z, rot, w, d, h, box: [x - hw, z - hd, x + hw, z + hd], v: rnd(), ceil: L.h, ...extra };
			items.push(it);
			return it;
		};
		const inFront = (base, type, w, d, h, gap) => {
			const sd = base.side, off = base.d + gap + d / 2, out = sd.pos + sd.n * off;
			return standing(type, sd.axis === 'x' ? base.c : out, sd.axis === 'x' ? out : base.c, w, d, h, base.rot);
		};
		// the sitter's place on a seat facing the way the item faces
		const faceOf = (rot) => [[0, 1], [1, 0], [0, -1], [-1, 0]][rot];
		const sitOn = (it, n, h = 0.44, depth = 0.1) => {
			const [fx, fz] = faceOf(it.rot), ax = [fz, -fx];
			for (let i = 0; i < n; i++) { const u = (n === 1 ? 0 : (i / (n - 1) - 0.5) * it.w * 0.62); seats.push({ x: it.x + ax[0] * u + fx * depth, z: it.z + ax[1] * u + fz * depth, y: y0, fx, fz, sit: true, h, room: rm.id }); }
		};
		const stand = (x, z, fx, fz) => seats.push({ x, z, y: y0, fx, fz, sit: false, h: 0, room: rm.id });
		const art = (n) => { for (let k = 0; k < n; k++) against('art', 0.5 + rnd() * 0.6, 0.03, 0.01, { clear: 0, side: (s) => !s.ext || rnd() < 0.4 }); };
		const clutter = (n) => { for (let k = 0; k < n; k++) against(rnd() < 0.5 ? 'boxes' : 'plant', 0.45, 0.4, 0.5 + rnd() * 0.4, { corner: true, clear: 0 }); };
		// the seats round a table, where its drawing puts its chairs (housekit.js, kit.js)
		function chairs(tb) {
			const n = tb.chairs || 4, W2 = tb.w / 2, D2 = tb.d / 2, spots = [];
			if (tb.type === 'cafeTable') spots.push([0, D2 + 0.25, -1], [0, -D2 - 0.25, 1]);
			else { const per = Math.ceil(n / 2); for (let i = 0; i < per; i++) { const x = -W2 + tb.w * (i + 0.5) / per; spots.push([x, D2 + 0.14, -1]); if (i < n - per) spots.push([x, -D2 - 0.14, 1]); } }
			const R = (x, z) => [[x, z], [z, -x], [-x, -z], [-z, x]][tb.rot];
			for (const [lx, lz, f] of spots) { const [dx, dz] = R(lx, lz), [fx, fz] = R(0, f); seats.push({ x: tb.x + dx, z: tb.z + dz, y: y0, fx, fz, sit: true, h: 0.47, room: rm.id, table: true }); }
		}
		// a shop on the street, by its trade
		function shopFit(r) {
			const kind = r.shopType || 'cafe', front = sides.find((s) => s.axis === 'x' && s.n < 0), backS = sides.find((s) => s.axis === 'x' && s.n > 0);
			const counter = against('shopCounter', Math.min(3.2, bw - 1.2), 0.7, 1.0, { side: (s) => s === backS || (s.axis === 'z' && s.walled), clear: 1.0, extra: { kind } });
			if (counter) { const [fx, fz] = faceOf(counter.rot); stand(counter.x - fx * 0.55, counter.z - fz * 0.55, fx, fz); }
			if (kind === 'cafe' || kind === 'restaurant' || kind === 'bar') {
				if (kind === 'cafe') against('displayCase', 1.4, 0.6, 1.1, { clear: 0.8 });
				// (a big room's tables further apart, and not more than a busy floor's worth)
				const step = (kind === 'restaurant' ? 2.2 : 1.8) * (bw * bd > 200 ? 1.5 : 1);
				let nT = 0;
				for (let z = r.z1 - 1.6; z > r.z0 + 2.4 && nT < 40; z -= step) for (let x = r.x0 + 1.1; x < r.x1 - 0.9 && nT < 40; x += step, nT++) {
					const tb = standing(kind === 'cafe' ? 'cafeTable' : 'diningTable', x, z, kind === 'restaurant' ? 0.9 : 0.6, kind === 'restaurant' ? 0.9 : 0.6, 0.75, 0, 0.55, { chairs: 2 });
					if (tb) chairs(tb);
				}
			} else if (kind === 'fish' || kind === 'candy') {
				// a fish market's iced cases, a sweet shop's glass ones, along the walls and down the middle
				for (let k = 0; k < 6; k++) against(kind === 'fish' ? 'fishCase' : 'displayCase', 1.8, 0.85, 1.0, { clear: 1.0 });
				for (let x = r.x0 + 2.2; x < r.x1 - 1.8; x += 2.6) standing(kind === 'fish' ? 'fishCase' : 'shopShelf', x, (r.z0 + r.z1) / 2, 0.9, Math.min(3, bd - 5), 1.0, 0, 0.8);
				for (let k = 0; k < 3; k++) stand(r.x0 + 1 + rnd() * (bw - 2), r.z0 + 2 + rnd() * (bd - 4), rnd() - 0.5, rnd() - 0.5);
			} else if (kind === 'grocer' || kind === 'books' || kind === 'boutique' || kind === 'hardware' || kind === 'gift' || kind === 'bait') {
				const tall = kind === 'books' ? 'bookcase' : 'shopShelf';
				if (kind === 'bait') against('fishCase', 1.6, 0.8, 1.0, { clear: 1.0, extra: { live: true } });
				for (const s of sides) if (s.walled && s !== front && s.axis === 'z') for (let k = 0; k < 4; k++) against(tall, 1.2, 0.45, kind === 'books' ? 2.0 : 1.8, { side: (q) => q === s, clear: 0.9 });
				for (let x = r.x0 + 2; x < r.x1 - 1.6; x += 2.2) standing(kind === 'grocer' ? 'produce' : kind === 'books' || kind === 'gift' ? 'bookTable' : 'shopShelf', x, (r.z0 + r.z1) / 2 + 0.5, 0.9, Math.min(4, bd - 5), 1.2, 0, 0.7);
				if (kind === 'gift') { against('postcards', 0.5, 0.5, 1.6, { corner: true, clear: 0.6 }); against('postcards', 0.5, 0.5, 1.6, { corner: true, clear: 0.6 }); }
				if (kind === 'books') { const ac = against('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 }); if (ac) sitOn(ac, 1); }
				for (let k = 0; k < 3; k++) stand(r.x0 + 1 + rnd() * (bw - 2), r.z0 + 2 + rnd() * (bd - 4), rnd() - 0.5, rnd() - 0.5);
			} else if (kind === 'laundromat') {
				for (const s of sides) if (s.walled && s !== front) for (let k = 0; k < 8; k++) against(k % 2 ? 'dryer' : 'washer', 0.7, 0.72, 0.95, { side: (q) => q === s, clear: 1.0 });
				const be = standing('bench', (r.x0 + r.x1) / 2, r.z1 - 1.8, 1.6, 0.5, 0.45, 2, 0.3);
				if (be) sitOn(be, 2, 0.45, 0.05);
			} else if (kind === 'florist') {
				for (let k = 0; k < 7; k++) against('flowers', 0.6, 0.5, 0.9, { clear: 0.7 });
				for (let x = r.x0 + 1.5; x < r.x1 - 1; x += 1.6) standing('flowers', x, (r.z0 + r.z1) / 2, 0.8, 0.8, 0.9, 0, 0.6);
			}
			against('plant', 0.45, 0.45, 1.2, { corner: true, clear: 0 });
			for (let x = r.x0 + 1.5; x < r.x1 - 1; x += 2.8) for (let z = r.z0 + 1.5; z < r.z1 - 1; z += 3) items.push({ type: 'ceilingLight', kind: kind === 'cafe' || kind === 'bar' ? 'pendant' : 'flush', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 0.5, cz, rm.id]);
		}
		// the big halls: a region near the door fitted out, the rest left open
		function bigFit(r) {
			const u = r.type, x0 = Math.max(r.x0 + 1, P.door.x - 18), x1 = Math.min(r.x1 - 1, P.door.x + 18), z1 = r.z1 - 3, z0 = Math.max(r.z0 + 1, z1 - 30);
			if (u === 'warehouse') {
				for (let x = x0 + 1; x < x1 - 1; x += 3.4) standing('rack', x, (z0 + z1) / 2 - 1, 1.1, Math.min(14, z1 - z0 - 3), Math.min(5.5, L.h - 0.5), 0, 0.1);
				for (let k = 0; k < 6; k++) standing('crates', x0 + rnd() * (x1 - x0), z1 - 1 - rnd() * 2, 1.2, 1.0, 0.6 + rnd() * 1.2, 0, 0.3);
				standing('forklift', (x0 + x1) / 2 + 1.7, z1 - 2.2, 1.2, 2.4, 2.1, 0, 0.3);
				stand((x0 + x1) / 2, z1 - 1, 0, -1);
			} else if (u === 'store') {
				for (let x = x0 + 1.5; x < x1 - 1; x += 2.6) standing('shopShelf', x, (z0 + z1) / 2 - 1, 0.9, Math.min(12, z1 - z0 - 4), 1.8, 0, 0.1);
				for (let k = 0; k < 3; k++) { const it = standing('shopCounter', P.door.x - 4 + k * 3, z1 - 1, 1.6, 0.7, 1.0, 2, 0.4, { kind: 'grocer' }); if (it) stand(it.x, it.z - 0.8, 0, 1); }
				for (let k = 0; k < 4; k++) stand(x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), rnd() - 0.5, rnd() - 0.5);
			} else if (u === 'parking' || u === 'garage2') {
				for (let x = x0 + 1.4; x < x1 - 1.2; x += 2.7) for (const z of [z0 + 3, z1 - 3]) if (rnd() < 0.7) { const it = standing('car', x, z, 1.85, 4.6, 1.45, 0, 0.3); if (it) it.box = [x - 0.95, z - 2.3, x + 0.95, z + 2.3]; }
			} else if (u === 'shed') {
				against('workbench', 1.4, 0.6, 0.92, { clear: 0.6 }); against('shelves', 1.6, 0.5, 1.9, { clear: 0.5 }); against('bikes', 1.6, 0.5, 1.0, { clear: 0.4 }); clutter(3);
			} else {
				for (let x = x0 + 1; x < x1 - 1.6; x += 1.8) for (let z = z1 - 2; z > z0 + 1; z -= 2.6) { const it = standing('officeDesk', x, z, 1.5, 0.75, 0.76, 0, 0.45); if (it) seats.push({ x: x, z: z - 0.7, y: y0, fx: 0, fz: 1, sit: true, h: 0.47, room: rm.id, table: true }); }
			}
			for (let x = r.x0 + 3; x < r.x1 - 2; x += 6) for (let z = r.z0 + 3; z < r.z1 - 2; z += 6) items.push({ type: 'ceilingLight', kind: 'tube', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 0.5, cz, rm.id]);
		}
		const t = rm.type;
		if (t === 'living') {
			if (victorian && !rm.flat) {
				// the parlour: the fireplace on the party wall, the sofa facing it, a piano
				const fp = against('fireplace', 1.5, 0.45, 1.3, { clear: 1.4, centre: true, side: (s) => s.axis === 'z' || !s.ext, extra: { mirror: rnd() < 0.7 } });
				if (fp) {
					const so = inFront(fp, 'sofa', Math.min(2.1, Math.max(1.6, (fp.side.axis === 'x' ? bw : bd) - 1.2)), 0.92, 0.85, 1.9);
					if (so) { so.rot = (fp.rot + 2) % 4; sitOn(so, 3); inFront(fp, 'rug', 2.2, 1.6, 0.01, 0.2); inFront(fp, 'coffeeTable', 1.0, 0.55, 0.42, 0.85); }
				}
				if (!fp) { const so = against('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.3 }); if (so) { sitOn(so, 3); inFront(so, 'rug', 2.3, 1.6, 0.01, -0.35); inFront(so, 'coffeeTable', 1.1, 0.6, 0.42, 0.45); } }
				if (rnd() < 0.45) against('piano', 1.5, 0.6, 1.25, { clear: 0.8 });
			} else {
				const tv = against('tvConsole', 1.6, 0.45, 0.55, { long: true, clear: 2.0, score: (s) => (s.ext ? -1 : 1) });
				const so = tv ? inFront(tv, 'sofa', Math.min(2.2, Math.max(1.6, Math.min(bw, bd) - 1.2)), 0.92, 0.85, 1.9) : against('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.2 });
				if (so) { if (tv) { so.rot = (tv.rot + 2) % 4; inFront(tv, 'rug', 2.1, 1.5, 0.01, 0.4); inFront(tv, 'coffeeTable', 1.0, 0.55, 0.42, 1.0); } sitOn(so, 3); }
				// a flat's living room is its kitchen too
				if (rm.flat) {
					const ct = against('counter', Math.min(3.0, Math.max(bw, bd) - 1.4), 0.63, 0.92, { long: true, clear: 0.9, noWindow: true, extra: { uppers: 0.6 } });
					if (ct) { ct.sink = ct.c - ct.w * 0.2; ct.range = ct.c + ct.w * 0.25; stand(ct.x + faceOf(ct.rot)[0] * 0.7, ct.z + faceOf(ct.rot)[1] * 0.7, -faceOf(ct.rot)[0], -faceOf(ct.rot)[1]); }
					against('fridge', 0.85, 0.72, 1.8, { corner: true, clear: 0.9 });
					const tb = standing('diningTable', cx + (rnd() - 0.5), cz + (rnd() - 0.5), 1.2, 0.8, 0.76, bw > bd ? 0 : 1, 0.6, { chairs: 4 });
					if (tb) { placed.pop(); placed.push(tb.box.map((v, i) => v + (i < 2 ? -0.6 : 0.6))); chairs(tb); }
				}
			}
			against('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 });
			const ac = items[items.length - 1];
			if (ac?.type === 'armchair' && ac.room === rm.id) sitOn(ac, 1);
			against('bookcase', 0.9, 0.34, 1.9, { clear: 0.7 });
			against('floorLamp', 0.35, 0.35, 1.6, { corner: true, clear: 0 });
			against('plant', 0.45, 0.45, 1.2, { corner: true, clear: 0 });
			if (rm.bay) items.push({ type: 'plant', x: (rm.bay[0] + rm.bay[1]) / 2 + 0.6, z: rm.z1 + 0.55, y: y0, rot: 0, w: 0.4, d: 0.4, h: 1.1, v: rnd() }, { type: 'windowSeat', x: (rm.bay[0] + rm.bay[1]) / 2, z: rm.z1 + ST.ext + 0.72, y: y0, rot: 2, w: Math.min(2.2, rm.bay[1] - rm.bay[0]), d: 0.5, h: 0.45, v: rnd() });
			art(victorian ? 3 : 2); light(victorian ? 'chandelier' : 'flush');
			if (victorian) items.push({ type: 'crown', room: rm.id, y: y0, x0: rm.x0, z0: rm.z0, x1: rm.x1, z1: rm.z1, ceil: L.h, rot: 0, w: 0, d: 0, h: 0, v: rnd() });
		} else if (t === 'dining') {
			const tw = Math.min(2.0, bw - 1.9, bd - 1.0), td = Math.min(1.0, Math.min(bw, bd) - 1.9);
			if (tw > 0.9 && td > 0.7) { const tb = standing('diningTable', cx, cz, tw, td, 0.76, bw >= bd ? 0 : 1, 0, { chairs: Math.max(2, Math.min(6, Math.floor(tw / 0.6) * 2)) }); if (tb) chairs(tb); }
			against('sideboard', 1.5, 0.45, 0.85, { long: true, clear: 0.5 });
			if (victorian) against('bookcase', 1.0, 0.4, 2.1, { clear: 0.6 });
			art(2); light('chandelier');
			if (victorian) items.push({ type: 'crown', room: rm.id, y: y0, x0: rm.x0, z0: rm.z0, x1: rm.x1, z1: rm.z1, ceil: L.h, wainscot: true, rot: 0, w: 0, d: 0, h: 0, v: rnd() });
		} else if (t === 'kitchen') {
			// counters along the back wall and one side, the fridge at an end, a table
			const back = sides.filter((s) => s.walled && s.axis === 'x').sort((a, b) => (b.ext ? 1 : 0) - (a.ext ? 1 : 0))[0];
			if (back) {
				const len = Math.min(back.e - back.s - 1.2, 4.2);
				const ct = against('counter', len, 0.63, 0.92, { side: (s) => s === back, clear: 1.0, extra: { uppers: 1 } });
				if (ct) { const win = back.open.find((o) => o.type === 'window' && o.s0 > ct.c - len / 2 && o.s1 < ct.c + len / 2); ct.sink = win ? (win.s0 + win.s1) / 2 : ct.c - len * 0.25; ct.range = ct.c + len * 0.3; ct.win = win ? [win.s0, win.s1] : null; ct.uppers = win ? 0 : 1; stand(ct.x + faceOf(ct.rot)[0] * 0.7, ct.z + faceOf(ct.rot)[1] * 0.7, -faceOf(ct.rot)[0], -faceOf(ct.rot)[1]); }
			}
			against('fridge', 0.9, 0.75, 1.8, { corner: true, clear: 0.9 });
			against('counter', Math.min(2.4, bd - 2), 0.63, 0.92, { side: (s) => s.axis === 'z', clear: 0.9, extra: { uppers: 0.6 } });
			const tb = standing('diningTable', cx, cz + 0.2, 1.1, 0.8, 0.76, bw >= bd ? 0 : 1, 0.55, { chairs: 4 });
			if (tb) { placed.pop(); placed.push(tb.box.map((v, i) => v + (i < 2 ? -0.55 : 0.55))); chairs(tb); }
			against('plant', 0.35, 0.35, 0.8, { corner: true, clear: 0 });
			light('pendants');
		} else if (t === 'master' || t === 'bed') {
			const kid = t === 'bed' && rnd() < 0.5;
			const bwid = t === 'master' ? (bw > 3.6 && bd > 3.6 ? 1.8 : 1.5) : kid ? 1.0 : 1.4, blen = kid ? 1.95 : 2.05;
			const bed = against('bed', bwid, blen, 0.6, { clear: 0.5, centre: true, score: (s) => (s.ext ? 0 : 0.6) + (s.e - s.s) * 0.1 });
			if (bed) {
				sitOn(bed, 1, 0.52, blen * 0.25);
				for (const sg of [-1, 1]) { const c = bed.c + sg * (bwid / 2 + 0.3), sd = bed.side; const box = sd.axis === 'x' ? [c - 0.24, Math.min(sd.pos, sd.pos + sd.n * 0.42), c + 0.24, Math.max(sd.pos, sd.pos + sd.n * 0.42)] : [Math.min(sd.pos, sd.pos + sd.n * 0.42), c - 0.24, Math.max(sd.pos, sd.pos + sd.n * 0.42), c + 0.24]; if (!hit(box) && inside(box)) { placed.push(box); items.push({ type: 'nightstand', y: y0, x: (box[0] + box[2]) / 2, z: (box[1] + box[3]) / 2, rot: bed.rot, w: 0.48, d: 0.42, h: 0.6, v: rnd(), box, ceil: L.h }); } }
				inFront(bed, 'rug', bwid + 0.8, 1.1, 0.01, -1.1);
			}
			against('closet', Math.min(2.2, Math.max(1.2, 0.22 * (bw + bd))), 0.62, 2.2, { clear: 0.7, score: (s) => (s.ext ? -1 : 1), extra: { wallCol: [0.9, 0.88, 0.84] } });
			against('dresser', t === 'master' ? 1.4 : 1.0, 0.5, t === 'master' ? 0.8 : 1.1, { clear: 0.7, noWindow: true });
			if (kid) { against('desk', 1.1, 0.55, 0.75, { clear: 0.8 }); against('toys', 0.6, 0.4, 0.4, { corner: true, clear: 0 }); }
			else against('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 });
			against('laundryBasket', 0.45, 0.35, 0.5, { corner: true, clear: 0 });
			art(t === 'master' ? 2 : 1); light(t === 'master' && victorian ? 'chandelier' : 'flush');
		} else if (t === 'bath' || t === 'powder') {
			if (t === 'bath') against(victorian ? 'clawTub' : 'tub', 1.55, 0.78, victorian ? 0.75 : 1.95, { clear: 0.45, corner: true });
			against(t === 'powder' ? 'pedestalSink' : 'vanity', t === 'powder' ? 0.5 : 0.9, t === 'powder' ? 0.45 : 0.56, 0.86, { clear: 0.55, noWindow: true });
			against('toilet', 0.45, 0.72, 0.78, { clear: 0.5 });
			against('bathMat', 0.8, 0.5, 0.01, { clear: 0 });
			light('bar');
		} else if (t === 'laundry') {
			against('washer', 0.68, 0.7, 0.95, { clear: 0.7 }); against('dryer', 0.68, 0.7, 0.95, { clear: 0.7 });
			against('shelf', 0.9, 0.35, 1.8, { clear: 0.6 }); against('waterHeater', 0.6, 0.6, 1.55, { corner: true, clear: 0 });
			clutter(2); light('tube');
		} else if (t === 'garage') {
			// the car nosed up to the garage door, clear of the way in from the hall at the back
			if (bw > 2.6 && bd > 5.95) { const z = rm.z1 - 2.6; items.push({ type: 'car', x: cx, z, y: y0, rot: 0, w: 1.85, d: 4.6, h: 1.45, v: rnd(), box: [cx - 0.95, z - 2.1, cx + 0.95, z + 2.5] }); placed.push([cx - 1.2, z - 2.4, cx + 1.2, z + 2.6]); }
			against('shelves', Math.min(2.2, bd - 1), 0.5, 1.9, { clear: 0.5, side: (s) => s.axis === 'z' });
			against('bins', 1.4, 0.7, 1.1, { clear: 0.4 }); against('bikes', 1.7, 0.5, 1.0, { clear: 0.4 }); against('workbench', 1.5, 0.6, 0.92, { clear: 0.6 });
			clutter(2); light('tube');
		} else if (t === 'den' || t === 'office' || t === 'family') {
			if (t === 'family') { const so = against('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.2 }); if (so) { sitOn(so, 3); inFront(so, 'coffeeTable', 1.0, 0.55, 0.42, 0.45); } against('tvConsole', 1.5, 0.45, 0.55, { clear: 1.5 }); }
			else { const dk = against('desk', 1.3, 0.6, 0.75, { clear: 0.9, score: (s) => (s.ext ? 1 : 0) }); if (dk) sitOn(dk, 1, 0.47, 0.55); }
			against('bookcase', 0.9, 0.34, 1.9, { clear: 0.6 }); against('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 });
			against('plant', 0.4, 0.4, 1.0, { corner: true, clear: 0 }); against('rug', Math.min(2.2, bw - 1), Math.min(1.6, bd - 1.5), 0.01, { clear: 0, centre: true });
			art(1); light(t === 'family' ? 'fan' : 'flush');
		} else if (t === 'storage') {
			against('shelves', Math.min(2.2, Math.max(bw, bd) - 1), 0.5, 1.9, { clear: 0.6 }); against('shelves', 1.6, 0.5, 1.9, { clear: 0.6 });
			clutter(4); light('tube');
		} else if (t === 'lobby') {
			against('mailboxes', Math.min(2.2, bw * 0.3), 0.3, 1.5, { clear: 0.8, side: (s) => !s.ext, noWindow: true });
			const be = against('bench', 1.6, 0.5, 0.45, { clear: 0.8 });
			if (be) sitOn(be, 2, 0.45, 0.05);
			against('plant', 0.5, 0.5, 1.4, { corner: true, clear: 0 }); against('plant', 0.5, 0.5, 1.4, { corner: true, clear: 0 });
			standing('rug', cx, cz, Math.min(3, bw - 2), Math.min(2, bd - 2), 0.01);
			stand(cx + 1, cz, 0, 1); art(2); light('chandelier');
		} else if (t === 'shop') shopFit(rm);
		else if (t === 'visitor') {
			// a visitor centre's lobby: the information desk, a bench, the map of the park
			const desk = against('shopCounter', Math.min(2.6, bd - 2), 0.7, 1.0, { side: (s) => s.axis === 'z', clear: 1.2, extra: { kind: 'info' } });
			if (desk) { const [fx, fz] = faceOf(desk.rot); stand(desk.x - fx * 0.55, desk.z - fz * 0.55, fx, fz); }
			against('exhibitPanel', 1.6, 0.12, 2.0, { clear: 1.0, side: (s) => s.axis === 'x' });
			const be = against('bench', 1.6, 0.5, 0.45, { clear: 0.8 });
			if (be) sitOn(be, 2, 0.45, 0.05);
			against('plant', 0.5, 0.5, 1.4, { corner: true, clear: 0 });
			stand(cx, cz + 1, 0, -1); light('pendant');
		} else if (t === 'gallery') {
			// a museum's room: cases of rocks, fossils and old things along the walls, panels
			// standing out in the room, the mountain in relief where there is space for it, a bench
			const big = bw > 4.2 && bd > 4.2;
			if (big) { const m = standing('reliefModel', cx, cz, Math.min(2.4, bw - 2.6), Math.min(1.6, bd - 2.6), 1.0, 0, 0.9); if (m) for (const [fx, fz] of [[0, 1], [0, -1]]) stand(m.x - fx * (m.d / 2 + 0.55), m.z - fz * (m.d / 2 + 0.55), fx, fz); }
			for (let n = 0; n < 5; n++) { const c = against('exhibitCase', 1.5, 0.7, 1.05, { clear: 1.0 }); if (c && n % 2 === 0) { const [fx, fz] = faceOf(c.rot); stand(c.x + fx * 1.0, c.z + fz * 1.0, -fx, -fz); } }
			for (let n = 0; n < 3; n++) against('exhibitPanel', 1.4, 0.12, 2.0, { clear: 0.9, score: (s) => (s.ext ? 0 : 1) });
			if (big) for (const sz of [-1, 1]) standing('exhibitPanel', cx + (bw > bd ? sz * bw * 0.3 : 0), cz + (bw > bd ? 0 : sz * bd * 0.3), 1.6, 0.12, 2.0, bw > bd ? 1 : 0, 0.8);
			const be = against('bench', 1.6, 0.5, 0.45, { clear: 1.0 });
			if (be) sitOn(be, 2, 0.45, 0.05);
			for (let x = rm.x0 + 1.5; x < rm.x1 - 1; x += 3) for (let z = rm.z0 + 1.2; z < rm.z1 - 0.8; z += 3) items.push({ type: 'ceilingLight', kind: 'flush', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 0.5, cz, rm.id]);
		} else if (t === 'market') {
			// a marketplace down a nave: stalls along both walls, an island of them down the middle
			// with aisles either side, tables to eat at by the doors
			for (const sd of sides) if (sd.walled && sd.axis === 'z' ? false : sd.walled) for (let k = 0; k < 60; k++) { const st = against('stall', 3.4, 2.2, 3.0, { side: (q) => q === sd, clear: 2.2, extra: { kind: Math.floor(rnd() * 6) } }); if (!st) break; const [fx, fz] = faceOf(st.rot); stand(st.x + fx * 1.5, st.z + fz * 1.5, -fx, -fz); }
			const along = bw > bd;
			for (let u = (along ? rm.x0 : rm.z0) + 8; u < (along ? rm.x1 : rm.z1) - 8; u += 7.5) {
				const st = standing('stall', along ? u : cx, along ? cz : u, 4.2, 2.6, 3.0, along ? 0 : 1, 1.6, { kind: Math.floor(rnd() * 6), island: true });
				if (!st) { const tb = standing('cafeTable', along ? u : cx, along ? cz : u, 0.6, 0.6, 0.75, 0, 0.6); if (tb) chairs(tb); }
			}
			for (let x = rm.x0 + 3; x < rm.x1 - 2; x += 8) for (let z = rm.z0 + 3; z < rm.z1 - 2; z += 8) items.push({ type: 'ceilingLight', kind: 'pendant', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 1, cz, rm.id]);
		} else if (t === 'rotunda' || t === 'mezzanine' || t === 'exhibition' || t === 'towerLobby') {
			// the great public rooms: benches along the walls, plants, a desk by the doors; in a
			// gallery, the panels and cases of a show; in a tower's, the lift's doors
			if (t === 'rotunda' || t === 'towerLobby') { const desk = against('shopCounter', Math.min(3.2, bw - 2), 0.8, 1.05, { clear: 1.4, extra: { kind: 'info' } }); if (desk) { const [fx, fz] = faceOf(desk.rot); stand(desk.x - fx * 0.6, desk.z - fz * 0.6, fx, fz); } }
			if (t === 'towerLobby') for (let k = 0; k < 2; k++) against('liftDoors', 1.4, 0.15, 2.4, { clear: 1.4, side: (q) => !q.ext || q.axis === 'x' });
			if (t === 'exhibition') {
				for (let k = 0; k < 8; k++) against('exhibitPanel', 2.4, 0.12, 2.4, { clear: 1.4 });
				if (rm.model === 'ring') standing('campusModel', cx, cz, Math.min(9, bw - 6), Math.min(9, bd - 6), 1.0, 0, 1.4);
				else for (let x = rm.x0 + 6; x < rm.x1 - 5; x += 9) for (let z = rm.z0 + 6; z < rm.z1 - 5; z += 9) standing(rnd() < 0.5 ? 'exhibitCase' : 'reliefModel', x, z, 1.6, 1.0, 1.0, 0, 1.2);
			}
			for (let k = 0; k < (bw * bd > 400 ? 10 : 4); k++) { const be = against('bench', 2.0, 0.55, 0.45, { clear: 1.2, score: (q) => (q.ext ? 1 : 0) }); if (!be) break; sitOn(be, 2, 0.45, 0.05); }
			for (let k = 0; k < 4; k++) against('plant', 0.6, 0.6, 1.6, { corner: true, clear: 0 });
			art(t === 'mezzanine' ? 6 : 3);
			for (let k = 0; k < 6; k++) stand(rm.x0 + 2 + rnd() * (bw - 4), rm.z0 + 2 + rnd() * (bd - 4), rnd() - 0.5, rnd() - 0.5);
			for (let x = rm.x0 + 3; x < rm.x1 - 2; x += 7) for (let z = rm.z0 + 3; z < rm.z1 - 2; z += 7) items.push({ type: 'ceilingLight', kind: t === 'rotunda' ? 'chandelier' : 'flush', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 1, cz, rm.id]);
		} else if (t === 'chamber') {
			// a council chamber: the dais across the far end, rows of seats facing it
			const dais = against('dais', Math.min(8, bw - 2), 1.6, 1.0, { clear: 2.4, score: (q) => (q.axis === 'x' && q.n > 0 ? 2 : 0) });
			const [fx, fz] = dais ? faceOf(dais.rot) : [0, 1];
			for (let k = 1; k < 9; k++) {
				const d = 2.6 + k * 1.2, x = dais ? dais.x + fx * d : cx, z = dais ? dais.z + fz * d : cz;
				const be = standing('bench', x, z, Math.min(9, (fz ? bw : bd) - 3), 0.55, 0.45, fz > 0 ? 2 : fz < 0 ? 0 : fx > 0 ? 3 : 1, 0.3);
				if (be) sitOn(be, 5, 0.45, 0.05);
			}
			art(2); light('chandelier');
		} else if (t === 'cellhouse') {
			// the cell blocks, three tiers high, down either side of Broadway; their galleries
			const len = Math.min(bd - 16, 64);
			// (each block in lengths of a few cells, drawn one at a time)
			const seg = 6 * 1.55, nS = Math.max(1, Math.round(len / seg));
			for (const sg of [-1, 1]) for (let i = 0; i < nS; i++) standing('cellBlock', cx + sg * 6.6, cz - 2 - nS * seg / 2 + (i + 0.5) * seg, 9, seg, 8.4, 0, 0, { cap0: i === 0, cap1: i === nS - 1 });
			for (let k = 0; k < 8; k++) stand(cx + (rnd() - 0.5) * 3, cz + (rnd() - 0.5) * len, 0, rnd() < 0.5 ? 1 : -1);
			for (let z = rm.z0 + 4; z < rm.z1 - 2; z += 8) for (const x of [cx - 15.5, cx, cx + 15.5]) items.push({ type: 'ceilingLight', kind: 'tube', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 1, cz, rm.id]);
		} else if (t === 'messhall') {
			// the dining hall: long steel tables with their fixed stools, the serving counter
			against('shopCounter', Math.min(12, bw - 4), 0.8, 1.0, { clear: 2, score: (q) => (q.axis === 'x' && q.n > 0 ? 2 : 0), extra: { kind: 'cafe' } });
			for (let x = rm.x0 + 3; x < rm.x1 - 2.5; x += 3.2) for (let z = rm.z0 + 3.4; z < rm.z1 - 2; z += 3.6) { const tb = standing('messTable', x, z, 2.4, 0.8, 0.76, 1, 0.5, { chairs: 6 }); if (tb) chairs(tb); }
			light('tube');
		} else if (t === 'casemate') {
			// a casemate: the gun at its embrasure in the outer wall, shot and a cask beside it
			const gun = against('cannon', 1.6, 3.2, 1.3, { clear: 0.8, score: (q) => (q.ext ? 3 : 0), centre: true });
			if (gun) { const [fx, fz] = faceOf(gun.rot); stand(gun.x + fx * 2.4 + fz * 1.2, gun.z + fz * 2.4 + fx * 1.2, -fx, -fz); }
			against('crates', 1.0, 0.8, 0.8, { corner: true, clear: 0 });
			light('flush');
		} else if (t === 'courtyard') {
			standing('flagpole', cx, cz, 0.3, 0.3, 14, 0, 0.6);
			for (let k = 0; k < 6; k++) stand(rm.x0 + 2 + rnd() * (bw - 4), rm.z0 + 2 + rnd() * (bd - 4), rnd() - 0.5, rnd() - 0.5);
		} else if (t === 'library' || t === 'reading') {
			if (t === 'library') {
				// the stacks in their rows across the room, an aisle down the middle
				for (let z = rm.z0 + 1.6; z < rm.z1 - 1.4; z += 2.4) for (const sg of [-1, 1]) standing('stack', cx + sg * (bw / 4 + 0.6), z, Math.min(bw / 2 - 3, 8), 0.6, 2.0, 0, 0.1);
				against('shopCounter', 3.4, 0.8, 1.05, { clear: 1.4, extra: { kind: 'info' } });
			} else {
				for (let x = rm.x0 + 2.6; x < rm.x1 - 2; x += 4) { const tb = standing('diningTable', x, cz, 2.6, 1.1, 0.76, 0, 0.7, { chairs: 6 }); if (tb) chairs(tb); }
				for (let k = 0; k < 3; k++) { const ac = against('armchair', 0.8, 0.8, 0.85, { clear: 0.8 }); if (ac) sitOn(ac, 1); }
				against('rug', 3, 2.2, 0.01, { clear: 0, corner: true });
				against('toys', 0.8, 0.5, 0.4, { corner: true, clear: 0 });
			}
			for (let x = rm.x0 + 2.5; x < rm.x1 - 2; x += 5) for (let z = rm.z0 + 2.5; z < rm.z1 - 2; z += 5) items.push({ type: 'ceilingLight', kind: 'flush', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 1, cz, rm.id]);
		} else if (t === 'arcade') {
			// the arcade: rows of games back to back, the prize counter, the claw machines by the doors
			against('shopCounter', 8, 0.8, 1.05, { clear: 1.6, score: (q) => (q.axis === 'x' && q.n > 0 ? 2 : 0), extra: { kind: 'prize' } });
			for (let x = rm.x0 + 4; x < rm.x1 - 3.5; x += 8) for (let i = 0, z = rm.z0 + 4; z < rm.z1 - 4; z += 1.0, i++) if (i % 7 < 6) standing('arcadeCabinet', x, z, 0.9, 0.9, 1.9, i % 2 ? 3 : 1, 0);
			for (let k = 0; k < 10; k++) against('arcadeCabinet', 0.9, 0.9, 1.9, { clear: 1.2 });
			for (let k = 0; k < 10; k++) stand(rm.x0 + 2 + rnd() * (bw - 4), rm.z0 + 2 + rnd() * (bd - 4), rnd() - 0.5, rnd() - 0.5);
			for (let x = rm.x0 + 3; x < rm.x1 - 2; x += 6) for (let z = rm.z0 + 3; z < rm.z1 - 2; z += 6) items.push({ type: 'ceilingLight', kind: 'pendant', level: 0, y: y0, x, z, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 1, cz, rm.id]);
		} else if (t === 'ballroom') {
			// the ballroom: the bandstand at the end, tables round the dance floor
			against('dais', Math.min(10, bd - 4), 3, 0.8, { clear: 3, centre: true, side: (q) => q.axis === 'z', extra: { band: true } });
			for (let x = rm.x0 + 3; x < rm.x1 - 2; x += 3.2) for (const z of [rm.z0 + 2.6, rm.z1 - 2.6]) { const tb = standing('cafeTable', x, z, 0.8, 0.8, 0.75, 0, 0.6, { chairs: 2 }); if (tb) chairs(tb); }
			items.push({ type: 'rug', x: cx, z: cz, y: y0, rot: 0, w: Math.max(4, bw - 9), d: Math.max(4, bd - 9), h: 0.01, v: rnd(), floorShine: true });
			for (let x = rm.x0 + 4; x < rm.x1 - 3; x += 8) items.push({ type: 'ceilingLight', kind: 'chandelier', level: 0, y: y0, x, z: cz, rot: 0, w: 0.3, d: 0.3, h: 0, v: rnd(), ceil: L.h });
			lights.push([cx, y0 + L.h - 1, cz, rm.id]);
		} else if (t === 'barn') {
			// a barn: stalls down one side, bales stacked on the other, the tractor by the doors
			for (let k = 0; k < 8; k++) against('barnStall', 3.0, 3.2, 1.5, { clear: 2.4, side: (q) => q.axis === 'z' && q.n > 0 });
			for (let k = 0; k < 10; k++) against('hay', 1.2, 0.6, 0.5 + (k % 3) * 0.5, { clear: 0.4, side: (q) => q.axis === 'z' && q.n < 0 });
			standing('tractor', cx + bw * 0.15, rm.z1 - 4, 1.8, 3.2, 2.4, 0, 0.5);
			light('tube');
		} else if (t === 'dining' && rm.big) {
			// (a big room to dine in: tables round it)
			for (let x = rm.x0 + 2.5; x < rm.x1 - 2; x += 3.4) for (let z = rm.z0 + 2.5; z < rm.z1 - 2; z += 3.4) { const tb = standing('diningTable', x, z, 1.4, 1.4, 0.76, 0, 0.6, { chairs: 4 }); if (tb) chairs(tb); }
			light('chandelier');
		} else if (t === 'closet') {
			against('shelves', Math.min(2.2, Math.max(bw, bd) - 0.6), 0.45, 1.9, { clear: 0.4 }); clutter(2); light('tube');
		}
		else if (t === 'classroom') {
			const bb = against('blackboard', Math.min(4, bw - 1.5), 0.08, 1.2, { side: (s) => s.axis === 'x' && !s.ext, clear: 2.4, centre: true });
			const fz = bb ? faceOf(bb.rot)[1] : 1;
			for (let x = rm.x0 + 1.1; x < rm.x1 - 0.9; x += 1.3) for (let z = fz > 0 ? rm.z0 + 3.4 : rm.z1 - 3.4; fz > 0 ? z < rm.z1 - 1.2 : z > rm.z0 + 1.2; z += fz > 0 ? 1.4 : -1.4) { const it = standing('schoolDesk', x, z, 0.7, 0.5, 0.72, fz > 0 ? 2 : 0, 0.1); if (it) seats.push({ x, z: z - fz * 0.45, y: y0, fx: 0, fz: -fz, sit: true, h: 0.44, room: rm.id, table: true }); }
			if (bb) inFront(bb, 'desk', 1.2, 0.6, 0.75, 0.9);
			light('tube');
		} else if (t === 'warehouse' || t === 'store' || t === 'parking' || t === 'garage2' || t === 'shed' || t === 'office' || t === 'school') bigFit(rm);
		else light();

	}
	return P;
}
