// The insides of the businesses, by what they are (economy/frontage.js fit): a café's counter
// with the espresso machine and the pastry case, its little tables, the kitchen behind; a
// restaurant's tables and booths, the host's stand by the door, the pass at the back with
// the kitchen through it (the ranges, the prep tables, the fryer); a pub's bar with its
// stools, the back bar's bottles; a bookshop's cases; a hardware store's gondolas; an
// outfitter's wall of rods and its canoe; a salon's chairs at their mirrors and the basin at
// the back; a garage's lift with a car up on it, the tool chests and the tyres; a guest
// house's front desk with the keys behind it, the breakfast room, the luggage racks upstairs.
//
// The same fit-outs serve the three kinds of building that are built inside: the flats over
// shops and the halls (interiors/plan.js and furnish.js), and the houses that became
// businesses (bay/houseplan.js, which re-types their ground floor). Each is handed the room
// and its helpers (K: against, standing, inFront, stand, sitOn, chairs, light, rnd...).
// Nothing here touches lighting or materials: where a lamp would hang it leaves an anchor
// (K.anchor: a pendant over the counter or a table, a heat lamp over the pass, track over
// the shelves, a sconce by a mirror), for whoever lights the rooms to use.
//
// Pure (no three): the houses' plan (bay/houseplan.js) is checked on its own in node. The
// drawings of the new things (booths, the pass, ranges, the front desk...) are estab-kit.js.


// ---------- the fit-outs ----------
// what the back room of each is (a kitchen behind a café or a restaurant, a bakehouse, the
// stockroom, a workshop), and what each room of a house becomes in a house that is a business
export const BACK = { cafe: 'kitchen', bakery: 'bakehouse', counter: 'kitchen', restaurant: 'kitchen', pizzeria: 'kitchen', diner: 'kitchen', sushi: 'kitchen', pub: 'kitchen', tasting: 'stock', garage: 'workshop', workshop: 'workshop', repair: 'workshop', bike: 'workshop', tailor: 'workshop', bnb: null, reception: 'office', fishmarket: 'stock', butcher: 'kitchen' };
const FOOD = new Set(['cafe', 'bakery', 'counter', 'restaurant', 'pizzeria', 'diner', 'sushi', 'pub', 'tasting']);
// a house's ground floor, re-typed: the room by the front door is the business's front; the
// dining room and family room more of it (or a breakfast room, a waiting room); the kitchen
// its kitchen or stockroom; a den its office; the garage its workshop or store; a bedroom
// down there its office (a kitchen's dry store), the laundry its stockroom: nobody sleeps
// behind the shop (a bed and breakfast's rooms are its guests', and stay)
export function houseRoles(fit, roomType) {
	if (!fit) return null;
	if (roomType === 'living' || roomType === 'entry') return { fit, role: 'front' };
	if (roomType === 'dining') return fit === 'bnb' ? { fit: 'breakfast', role: 'more' } : FOOD.has(fit) ? { fit, role: 'more' } : fit === 'clinic' || fit === 'dental' || fit === 'office' || fit === 'studio' ? { fit, role: 'more' } : { fit, role: 'more' };
	if (roomType === 'family') return fit === 'bnb' ? { fit: 'lounge', role: 'more' } : FOOD.has(fit) ? { fit, role: 'more' } : { fit: fit === 'clinic' || fit === 'dental' ? fit : 'stock', role: fit === 'clinic' || fit === 'dental' ? 'more' : 'back' };
	if (roomType === 'kitchen') return fit === 'bnb' ? null : { fit: BACK[fit] || 'stock', role: 'back' };
	if (roomType === 'den' || roomType === 'office') return fit === 'bnb' ? null : { fit: 'office', role: 'back' };
	if (roomType === 'garage') return { fit: fit === 'garage' || fit === 'workshop' || fit === 'bike' ? 'workshop' : 'stock', role: 'back', garage: fit === 'garage' };
	if (roomType === 'master' || roomType === 'bed') return fit === 'bnb' ? null : { fit: roomType === 'bed' && BACK[fit] === 'kitchen' ? 'stock' : 'office', role: 'back' };
	if (roomType === 'laundry') return fit === 'bnb' ? null : { fit: 'stock', role: 'back' };
	return null;
}

// (helpers over K's own: an item's extra fields after it is placed, wherever it was placed)
function helpers(K) {
	const ag = (type, w, d, h, opt = {}, extra = null) => { const it = K.against(type, w, d, h, opt); if (it && extra) Object.assign(it, extra); return it; };
	const st = (type, x, z, w, d, h, rot = 0, pad = 0, extra = null) => { const it = K.standing(type, x, z, w, d, h, rot, pad); if (it && extra) Object.assign(it, extra); return it; };
	const face = (rot) => [[0, 1], [1, 0], [0, -1], [-1, 0]][rot];
	// someone working behind a thing that stands against a wall (between it and the wall: no;
	// in front of it facing it, as at a range; or behind a counter, facing the room)
	const behind = (it, k = 0.55) => { if (!it) return; const [fx, fz] = face(it.rot); K.stand(it.x - fx * k, it.z - fz * k, fx, fz, true); };
	const atFront = (it, k = 0.6) => { if (!it) return; const [fx, fz] = face(it.rot); K.stand(it.x + fx * (it.d / 2 + k), it.z + fz * (it.d / 2 + k), -fx, -fz, true); };
	const lamp = (kind, x, z, drop = 0.6) => K.anchor(kind, x, K.y0 + K.ceil - drop, z);
	const front = K.sides.find((s) => s.axis === 'x' && s.n < 0 && s.ext) || K.sides.find((s) => s.axis === 'x' && s.n < 0);
	const backS = K.sides.find((s) => s.axis === 'x' && s.n > 0);
	const notFront = (s) => s !== front;
	return { ag, st, face, behind, atFront, lamp, front, backS, notFront };
}
// tables in a grid over the free floor, chairs round each, a pendant over each
function tables(K, h, type, w, d, step, nMax, chairs = 2) {
	const { st, lamp } = h;
	let n = 0;
	for (let z = K.rm.z1 - 1.5; z > K.rm.z0 + 1.2 && n < nMax; z -= step) for (let x = K.rm.x0 + 1.0; x < K.rm.x1 - 0.8 && n < nMax; x += step) {
		const tb = st(type, x, z, w, d, 0.75, 0, 0.55, { chairs });
		if (!tb) continue;
		n++;
		K.chairs(tb);
		lamp('pendant', x, z, 0.9);
	}
	return n;
}
// the front of the house of each kind of business
export function fitFront(fit, K) {
	const h = helpers(K), { ag, st, behind, atFront, lamp, front, backS, notFront } = h, r = K.rnd;
	const big = K.bw * K.bd > 22, long = Math.max(K.bw, K.bd);
	const counterAt = (kind, w = Math.min(3.2, long - 1.4)) => {
		// (against the back wall or a side; failing that anywhere but the front, closer in; or a shorter one)
		const c = ag('shopCounter', w, 0.7, 1.0, { side: (s) => s === backS || (s.axis === 'z' && notFront(s)), clear: 1.1, score: (s) => (s === backS ? 1 : 0) }, { kind })
			|| ag('shopCounter', Math.min(w, 2.2), 0.7, 1.0, { side: notFront, clear: 0.8 }, { kind })
			|| ag('shopCounter', 1.6, 0.65, 1.0, { clear: 0.7 }, { kind });
		behind(c);
		if (c) lamp('counter', c.x, c.z);
		return c;
	};
	// (what is on them: the goods' sheet's, by the shop: build.js stocks them)
	const shelvesRound = (type, n, hgt = 1.8, w = 1.2) => { for (let k = 0; k < n; k++) { const s = ag(type, w, 0.45, hgt, { side: notFront, clear: 0.9 }, { stock: fit }); if (s && k % 2 === 0) lamp('track', s.x, s.z, 0.3); } };
	const browsers = (n) => { for (let k = 0; k < n; k++) K.stand(K.rm.x0 + 1 + r() * (K.bw - 2), K.rm.z0 + 1.2 + r() * (K.bd - 2.4), r() - 0.5, r() - 0.5, false); };
	switch (fit) {
		case 'cafe': case 'counter': {
			const c = counterAt(fit === 'cafe' ? 'cafe' : 'bar');
			if (c) h.ag('menuBoard', Math.min(2.4, c.w), 0.05, 0.01, { side: (s) => s === c.side, clear: 0, noWindow: true });
			ag('displayCase', 1.3, 0.6, 1.1, { clear: 0.8, side: notFront });
			if (big && fit === 'cafe') { const b = ag('booth', 1.6, 1.5, 1.15, { side: (s) => s.axis === 'z', clear: 0.4 }); if (b) { K.sitOn(b, 1, 0.5, 0.45); lamp('pendant', b.x, b.z, 0.9); } }
			tables(K, h, 'cafeTable', 0.6, 0.6, 1.8, big ? 8 : 4);
			break;
		}
		case 'bakery': {
			const c = counterAt('cafe');
			ag('displayCase', 1.6, 0.6, 1.1, { clear: 0.9, side: (s) => s.axis === 'z' || s === backS });
			ag('displayCase', 1.2, 0.6, 1.1, { clear: 0.9, side: notFront });
			for (let k = 0; k < 2; k++) ag('breadRack', 1.2, 0.45, 1.9, { side: (s) => s === (c ? c.side : backS) || s.axis === 'z', clear: 0.6 });
			tables(K, h, 'cafeTable', 0.6, 0.6, 1.8, 2);
			break;
		}
		case 'restaurant': case 'pizzeria': case 'diner': case 'sushi': {
			// the host by the door, booths down a side wall, tables, the pass or the counter at the back
			const hs = front ? st('hostStand', front.s + 0.9 < K.cx ? K.rm.x0 + 0.7 : K.rm.x1 - 0.7, K.rm.z1 - 1.2, 0.6, 0.44, 1.1, 2, 0.3) : null;
			if (hs) K.stand(hs.x, hs.z - 0.45, 0, 1, true);
			if (fit === 'sushi') { const bar = ag('barCounter', Math.min(4.2, long - 1.6), 0.7, 1.08, { side: (s) => s === backS || s.axis === 'z', clear: 1.4 }, { kind: 'sushi' }); behind(bar); if (bar) for (let k = 0; k < Math.floor(bar.w / 0.65); k++) { const [fx, fz] = h.face(bar.rot), u = -bar.w / 2 + 0.35 + k * 0.65, ax = [fz, -fx]; const s2 = st('barStool', bar.x + ax[0] * u + fx * (bar.d / 2 + 0.35), bar.z + ax[1] * u + fz * (bar.d / 2 + 0.35), 0.4, 0.4, 0.75, 0, 0); if (s2) K.seat(s2.x, s2.z, -fx, -fz, 0.75); lamp('pendant', bar.x + ax[0] * u, bar.z + ax[1] * u, 0.8); } }
			else if (fit === 'pizzeria') { const ov = ag('pizzaOven', 1.5, 1.5, 1.8, { side: (s) => s === backS || s.axis === 'z', clear: 1.2 }); atFront(ov); counterAt('cafe', Math.min(2.4, long - 2)); }
			else if (fit === 'diner') { const c = ag('barCounter', Math.min(4.5, long - 1.6), 0.7, 1.08, { side: (s) => s === backS, clear: 1.6 }); behind(c, 0.6); if (c) { const [fx, fz] = h.face(c.rot), ax = [fz, -fx]; for (let k = 0; k < Math.floor(c.w / 0.7); k++) { const u = -c.w / 2 + 0.35 + k * 0.7; const s2 = st('barStool', c.x + ax[0] * u + fx * (c.d / 2 + 0.35), c.z + ax[1] * u + fz * (c.d / 2 + 0.35), 0.4, 0.4, 0.75); if (s2) K.seat(s2.x, s2.z, -fx, -fz, 0.75); } lamp('pendant', c.x, c.z); } }
			else { const p = K.passSide ? ag('pass', Math.min(2.2, long - 2), 0.55, 1.6, { side: (s) => s === K.passSide, clear: 1.2 }) : null; if (p) { lamp('heatlamp', p.x, p.z, 1.3); atFront(p, 0.4); } else counterAt('bar', Math.min(2.4, long - 2)); }
			for (let k = 0; k < (fit === 'diner' ? 3 : big ? 2 : 1); k++) { const b = ag('booth', 1.4, 1.5, 1.15, { side: (s) => s.axis === 'z' && s.walled !== false, clear: 0.5 }); if (b) { K.sitOn(b, 1, 0.5, 0.45); lamp('pendant', b.x, b.z, 0.9); } }
			tables(K, h, 'diningTable', 0.9, 0.9, 2.2, big ? 10 : 4, 2);
			break;
		}
		case 'pub': case 'tasting': {
			const bb = ag('backBar', Math.min(3.6, long - 1.6), 0.45, 2.2, { side: (s) => s === backS || (s.axis === 'z' && notFront(s)), clear: 1.9 });
			const bar = bb ? K.inFront(bb, 'barCounter', bb.w, 0.7, 1.08, 0.95) : ag('barCounter', 3, 0.7, 1.08, { clear: 1.4 });
			if (bar) {
				if (bb) bar.rot = bb.rot;
				K.stand(bb ? (bb.x + bar.x) / 2 : bar.x, bb ? (bb.z + bar.z) / 2 : bar.z, ...h.face((bar.rot) % 4), true);
				const [fx, fz] = h.face(bar.rot), ax = [fz, -fx];
				for (let k = 0; k < Math.floor(bar.w / 0.7); k++) { const u = -bar.w / 2 + 0.35 + k * 0.7; const s2 = st('barStool', bar.x + ax[0] * u + fx * (bar.d / 2 + 0.35), bar.z + ax[1] * u + fz * (bar.d / 2 + 0.35), 0.4, 0.4, 0.75); if (s2) K.seat(s2.x, s2.z, -fx, -fz, 0.75); }
				lamp('pendant', bar.x, bar.z);
			}
			const b = ag('booth', 1.5, 1.5, 1.15, { side: (s) => s.axis === 'z', clear: 0.5 });
			if (b) K.sitOn(b, 1, 0.5, 0.45);
			tables(K, h, fit === 'tasting' ? 'cafeTable' : 'diningTable', 0.8, 0.8, 2.0, big ? 6 : 3, 2);
			break;
		}
		case 'books': case 'records': {
			shelvesRound('bookcase', 8, 2.0, 1.0);
			for (let x = K.rm.x0 + 1.8; x < K.rm.x1 - 1.4; x += 2.2) st('bookTable', x, K.cz + 0.3, 0.9, Math.min(1.8, K.bd - 4), 0.85, 0, 0.7, { stock: fit });
			counterAt('books', 1.8);
			const ac = ag('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 }); if (ac) K.sitOn(ac, 1);
			browsers(3);
			break;
		}
		case 'florist': {
			for (let k = 0; k < 7; k++) ag('flowers', 0.6, 0.5, 0.9, { clear: 0.7 });
			for (let x = K.rm.x0 + 1.5; x < K.rm.x1 - 1; x += 1.6) st('flowers', x, K.cz, 0.8, 0.8, 0.9, 0, 0.6);
			const c = counterAt('florist', 1.6); void c;
			ag('workbench', 1.4, 0.6, 0.92, { clear: 0.7, side: notFront });
			break;
		}
		case 'grocer': case 'general': {
			shelvesRound('shopShelf', 6);
			const runs = [];
			for (let x = K.rm.x0 + 1.9; x < K.rm.x1 - 1.5; x += 2.2) { const g = st(fit === 'grocer' ? 'produce' : 'shopShelf', x, K.cz + 0.4, 0.9, Math.min(3.6, K.bd - 4), 1.2, 0, 0.7, { stock: fit }); if (g) { h.lamp('track', g.x, g.z, 0.3); runs.push(g); } }
			// the aisle markers hung over the aisles between the gondolas, read from the door
			// (signage/ draws them: K.sign leaves the place)
			for (let k = 0; k + 1 < runs.length; k++) K.sign?.('aisle', (runs[k].x + runs[k + 1].x) / 2, K.y0 + Math.min(K.ceil - 0.55, 2.6), runs[k].z - runs[k].d * 0.3, { n: k + 1, fit, nx: 0, nz: -1 });
			counterAt('grocer', 1.8);
			if (fit === 'general') ag('crates', 1.0, 0.8, 0.8, { corner: true, clear: 0 });
			browsers(3);
			break;
		}
		case 'hardware': case 'pharmacy': case 'pet': case 'liquor': case 'gift': case 'antiques': {
			shelvesRound('shopShelf', 7, fit === 'antiques' ? 1.6 : 1.9);
			for (let x = K.rm.x0 + 1.9; x < K.rm.x1 - 1.5; x += 2.3) st(fit === 'gift' || fit === 'antiques' ? 'bookTable' : 'shopShelf', x, K.cz + 0.4, 0.9, Math.min(3.6, K.bd - 4), fit === 'gift' ? 0.9 : 1.6, 0, 0.75, { stock: fit });
			counterAt(fit === 'pharmacy' ? 'info' : 'grocer', 1.8);
			if (fit === 'gift') ag('postcards', 0.5, 0.5, 1.6, { corner: true, clear: 0.6 });
			if (fit === 'antiques') { const ac = ag('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.6 }); if (ac) K.sitOn(ac, 1); }
			browsers(2);
			break;
		}
		case 'gear': case 'bait': {
			for (let k = 0; k < 3; k++) { const g = ag('gearWall', Math.min(2.4, long - 1.5), 0.45, 2.2, { side: notFront, clear: 1.0 }); if (g) lamp('track', g.x, g.z, 0.3); }
			if (fit === 'gear' && K.bw > 4) ag('canoeRack', Math.min(4.5, long - 0.8), 0.6, 2.1, { side: (s) => s.axis === 'z' || s === backS, clear: 0, noWindow: true });
			if (fit === 'bait') ag('fishCase', 1.6, 0.8, 1.0, { clear: 1.0 }, { live: true });
			st('clothesRack', K.cx, K.cz + 0.4, Math.min(1.6, K.bw - 2.5), 0.5, 1.55, 0, 0.7);
			counterAt('grocer', 1.8);
			browsers(2);
			break;
		}
		case 'clothes': case 'tailor': {
			for (let x = K.rm.x0 + 1.6; x < K.rm.x1 - 1.2; x += 1.9) st('clothesRack', x, K.cz, 1.3, 0.5, 1.55, 1, 0.6);
			for (let k = 0; k < 2; k++) ag('mannequin', 0.45, 0.45, 1.8, { side: (s) => s === front, clear: 0.3 });
			shelvesRound('shopShelf', 2, 1.8);
			ag('mirrorStation', 0.9, 0.12, 2.0, { side: notFront, clear: 0.9, noWindow: true });
			if (fit === 'tailor') { const wb = ag('workbench', 1.6, 0.7, 0.92, { side: notFront, clear: 0.8 }); behind(wb, -0.55); }
			counterAt('grocer', 1.6);
			browsers(2);
			break;
		}
		case 'butcher': case 'fishmarket': {
			for (let k = 0; k < 3; k++) { const c = ag(fit === 'fishmarket' ? 'fishCase' : 'displayCase', 1.8, 0.85, 1.0, { side: notFront, clear: 1.1 }); if (c) behind(c, 0.6); }
			if (fit === 'fishmarket') for (let x = K.rm.x0 + 2.2; x < K.rm.x1 - 1.8; x += 2.6) st('fishCase', x, K.cz, 0.9, Math.min(3, K.bd - 5), 1.0, 0, 0.8);
			counterAt('grocer', 1.4);
			browsers(2);
			break;
		}
		case 'salon': case 'barber': {
			const n = Math.max(1, Math.min(4, Math.floor((long - 1.5) / 1.3)));
			for (let k = 0; k < n; k++) {
				const m = ag('mirrorStation', 1.0, 0.3, 2.05, { side: (s) => s.axis === 'z', clear: 1.6, noWindow: true });
				if (!m) break;
				const c = K.inFront(m, 'salonChair', 0.6, 0.6, 1.2, 0.35);
				if (c) { c.rot = (m.rot + 2) % 4; K.seat(c.x, c.z, ...h.face(m.rot).map((v) => -v), 0.5); const [fx, fz] = h.face(m.rot); K.stand(c.x + fx * 0.7 + fz * 0.3, c.z + fz * 0.7 - fx * 0.3, -fx, -fz, true); }
				lamp('sconce', m.x, m.z, 0.9);
			}
			if (fit === 'salon') ag('washBasin', 0.6, 0.9, 0.85, { side: (s) => s === backS, clear: 0.8 });
			const w = ag('waitingChairs', 1.6, 0.5, 0.9, { side: (s) => s === front || s.axis === 'z', clear: 0.6 }); if (w) K.sitOn(w, 2, 0.46, 0.05);
			counterAt('info', 1.2);
			break;
		}
		case 'laundromat': {
			for (const s of K.sides) if (s.walled !== false && s !== front) for (let k = 0; k < 8; k++) ag(k % 2 ? 'dryer' : 'washer', 0.7, 0.72, 0.95, { side: (q) => q === s, clear: 1.0 });
			const be = st('bench', K.cx, K.rm.z1 - 1.8, 1.6, 0.5, 0.45, 2, 0.3); if (be) K.sitOn(be, 2, 0.45, 0.05);
			break;
		}
		case 'gym': case 'yoga': {
			if (fit === 'gym') {
				for (let k = 0; k < 2; k++) ag('weightRack', 1.6, 1.4, 2.1, { side: notFront, clear: 0.6 });
				for (let x = K.rm.x0 + 1.0; x < K.rm.x1 - 0.8; x += 1.1) st('treadmill', x, K.rm.z1 - 1.6, 0.8, 1.9, 1.45, 2, 0.15);
			} else for (let z = K.rm.z1 - 1.4; z > K.rm.z0 + 1; z -= 1.0) for (let x = K.rm.x0 + 0.9; x < K.rm.x1 - 0.7; x += 2.2) st('yogaMat', x, z, 1.8, 0.62, 0.01, 1, 0.15);
			counterAt('info', 1.2);
			ag('mirrorStation', Math.min(3, long - 2), 0.15, 2.0, { side: notFront, clear: 0.6, noWindow: true });
			browsers(3);
			break;
		}
		case 'clinic': case 'dental': case 'office': case 'studio': case 'reception': case 'bnb': {
			// a reception: the desk facing the door, chairs to wait on, the rest by its kind
			const desk = ag('frontDesk', Math.min(2.2, long - 2), 0.7, 1.1, { side: (s) => s === backS || (s.axis === 'z' && notFront(s)), clear: 1.4, score: (s) => (s === backS ? 1 : 0) }, { keys: fit === 'bnb' || fit === 'reception' })
				|| ag('frontDesk', 1.5, 0.65, 1.1, { side: notFront, clear: 0.9 }, { keys: fit === 'bnb' || fit === 'reception' });
			behind(desk);
			if (desk) lamp('pendant', desk.x, desk.z);
			if (fit === 'bnb' || fit === 'reception') {
				for (let k = 0; k < 2; k++) { const ac = ag('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 }); if (ac) K.sitOn(ac, 1); }
				ag('luggageRack', 0.7, 0.45, 0.75, { side: (s) => s === front, clear: 0.3 });
				ag('plant', 0.5, 0.5, 1.3, { corner: true, clear: 0 });
				ag('rug', Math.min(2.4, K.bw - 1.2), Math.min(1.6, K.bd - 1.6), 0.01, { clear: 0, centre: true });
			} else {
				const w = ag('waitingChairs', Math.min(2.2, long - 2), 0.5, 0.9, { side: (s) => s.axis === 'z' || s === front, clear: 0.7 }); if (w) K.sitOn(w, 3, 0.46, 0.05);
				if (fit === 'dental') { const c = st('dentalChair', K.cx, K.cz, 0.6, 1.3, 1.0, 0, 0.6); if (c) { K.stand(c.x + 0.7, c.z, -1, 0, true); lamp('task', c.x, c.z, 0.9); } }
				else if (fit === 'clinic') { const c = ag('examTable', 0.7, 1.9, 0.8, { side: notFront, clear: 0.9 }); if (c) lamp('task', c.x, c.z, 0.9); }
				else {
					// a few desks, not a hall of them; a coffee point on a wall
					let n = 0;
					for (let x = K.rm.x0 + 1.2; x < K.rm.x1 - 1.2 && n < 3; x += 1.9) { const d = st('officeDesk', x, K.cz - 0.3, 1.5, 0.75, 0.76, 0, 0.45); if (d) { n++; K.seat(x, K.cz - 0.92, 0, 1, 0.47); lamp('pendant', x, K.cz - 0.3, 0.6); } }
					ag('coffeeBar', 1.8, 0.62, 2.15, { side: notFront, clear: 0.9 });
				}
				ag('plant', 0.5, 0.5, 1.3, { corner: true, clear: 0 });
			}
			break;
		}
		case 'breakfast': {
			// a guest house's breakfast room: small tables, the sideboard with the coffee
			ag('sideboard', 1.6, 0.5, 0.9, { long: true, clear: 0.7 });
			tables(K, h, 'cafeTable', 0.7, 0.7, 1.7, 4);
			break;
		}
		case 'lounge': {
			const so = ag('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.2 }); if (so) { K.sitOn(so, 3); K.inFront(so, 'coffeeTable', 1.0, 0.55, 0.42, 0.45); }
			for (let k = 0; k < 2; k++) { const ac = ag('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 }); if (ac) K.sitOn(ac, 1); }
			ag('bookcase', 0.9, 0.34, 1.9, { clear: 0.7 });
			break;
		}
		case 'garage': case 'workshop': case 'repair': case 'bike': {
			if (fit === 'garage' && K.bw > 4.4 && K.bd > 6) {
				const lift = r() < 0.6 ? 1.6 : 0.1;
				const L = st('carLift', K.cx, K.cz + 0.2, 3.4, 1.0, 2.6, 0, 0.3, { lift });
				if (L) { K.items.push({ type: 'car', x: K.cx, z: K.cz + 0.2, y: K.y0 + lift, rot: 0, w: 1.85, d: 4.6, h: 1.45, v: r(), raised: lift > 1, box: [K.cx - 0.95, K.cz - 2.1, K.cx + 0.95, K.cz + 2.5] }); K.stand(K.cx + 0.4, K.cz + 1.6, 0, -1, true); }
			}
			ag('gearWall', Math.min(2.4, long - 1.5), 0.3, 2.2, { side: notFront, clear: 0.9 }, { kind: 'tools' });
			ag('toolChest', 1.0, 0.5, 1.0, { side: notFront, clear: 0.8 });
			const wb = ag('workbench', 1.8, 0.7, 0.92, { side: notFront, clear: 0.8 }); if (wb) { atFront(wb, 0.5); lamp('task', wb.x, wb.z, 0.8); }
			if (fit === 'garage') ag('tyres', 0.65, 0.65, 0.9, { corner: true, clear: 0 });
			if (fit === 'repair' || fit === 'bike') counterAt('grocer', 1.6);
			if (fit === 'bike') for (let k = 0; k < 2; k++) ag('bikes', 1.6, 0.5, 1.0, { clear: 0.5 });
			break;
		}
		case 'daycare': {
			ag('rug', Math.min(3, K.bw - 1.2), Math.min(2.2, K.bd - 1.4), 0.01, { clear: 0, centre: true });
			for (let k = 0; k < 3; k++) ag('toys', 0.7, 0.45, 0.45, { corner: k === 0, clear: 0.3 });
			for (let x = K.rm.x0 + 1.2; x < K.rm.x1 - 1; x += 1.6) st('schoolDesk', x, K.cz, 0.7, 0.5, 0.55, 0, 0.4);
			if (K.bw * K.bd > 14) ag('cribs', 1.2, 0.65, 0.9, { side: notFront, clear: 0.4 });
			K.stand(K.cx, K.cz + 0.8, 0, -1, true);
			break;
		}
		default: return false;
	}
	ag('plant', 0.45, 0.45, 1.2, { corner: true, clear: 0 });
	K.light(FOOD.has(fit) ? 'pendant' : 'flush');
	return true;
}
// the back of the house: the kitchen (ranges along the wall, the prep tables in the middle,
// the fryer, the fridge, the shelves), the bakehouse, the stockroom, the workshop, the office
export function fitBack(kind, K) {
	const h = helpers(K), { ag, st, atFront, lamp } = h;
	switch (kind) {
		case 'kitchen': {
			const rg = ag('range', Math.min(1.8, Math.max(K.bw, K.bd) - 1.6), 0.85, 0.92, { clear: 1.1, long: true, noWindow: true }) || ag('range', 1.2, 0.8, 0.92, { clear: 0.9 });
			atFront(rg, 0.45);
			if (rg) lamp('hood', rg.x, rg.z, 0.7);
			ag('fryer', 0.8, 0.75, 0.92, { clear: 1.0, noWindow: true });
			ag('fridge', 0.9, 0.75, 1.9, { corner: true, clear: 0.9 });
			const p = st('prepTable', K.cx, K.cz, Math.min(1.8, K.bw - 2.2), 0.75, 0.92, K.bw >= K.bd ? 0 : 1, 0.75);
			if (p) { K.stand(p.x, p.z + (K.bw >= K.bd ? -0.65 : 0), 0, 1, true); lamp('task', p.x, p.z, 0.7); }
			ag('shelves', 1.2, 0.5, 1.9, { clear: 0.7 });
			K.light('tube');
			return true;
		}
		case 'bakehouse': {
			const ov = ag('deckOven', 1.6, 1.0, 1.85, { clear: 1.2, noWindow: true }); atFront(ov, 0.5);
			ag('breadRack', 1.2, 0.5, 1.9, { clear: 0.8 });
			const p = st('prepTable', K.cx, K.cz, Math.min(2.0, K.bw - 2.2), 0.8, 0.92, 0, 0.75); if (p) K.stand(p.x, p.z - 0.7, 0, 1, true);
			K.light('tube');
			return true;
		}
		case 'stock': {
			for (let k = 0; k < 3; k++) ag('shelves', Math.min(2.2, Math.max(K.bw, K.bd) - 1), 0.5, 1.9, { clear: 0.7 });
			for (let k = 0; k < 3; k++) ag('boxes', 0.5, 0.45, 0.5 + K.rnd() * 0.5, { corner: true, clear: 0 });
			K.light('tube');
			return true;
		}
		case 'workshop': {
			const wb = ag('workbench', 1.8, 0.7, 0.92, { clear: 0.9 }); atFront(wb, 0.5);
			ag('gearWall', Math.min(2.2, Math.max(K.bw, K.bd) - 1.5), 0.3, 2.2, { clear: 0.8 }, { kind: 'tools' });
			ag('toolChest', 1.0, 0.5, 1.0, { clear: 0.8 });
			ag('shelves', 1.6, 0.5, 1.9, { clear: 0.6 });
			if (K.garage && K.bw > 2.8 && K.bd > 5.6) K.items.push({ type: 'car', x: K.cx, z: K.rm.z1 - 2.6, y: K.y0, rot: 0, w: 1.85, d: 4.6, h: 1.45, v: K.rnd(), box: [K.cx - 0.95, K.rm.z1 - 4.9, K.cx + 0.95, K.rm.z1 - 0.3] });
			K.light('tube');
			return true;
		}
		case 'office': {
			const d = ag('desk', 1.4, 0.65, 0.75, { clear: 0.9 }); if (d) K.deskSeat(d);
			ag('bookcase', 0.9, 0.34, 1.9, { clear: 0.6 });
			ag('boxes', 0.5, 0.45, 0.6, { corner: true, clear: 0 });
			K.light('flush');
			return true;
		}
		default: return false;
	}
}
