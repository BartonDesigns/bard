// Headwear, fitted to the head it is worn on: a six-panel baseball cap low on the head with a
// curved bill, a visor, a bucket hat, a sunhat, a cuffed beanie and a fedora. Each is measured
// off the skull (ga.fitTube over the skin) and sits where a hat sits: its sweatband a finger or
// two above the brows, lower at the back, the crown only a knit's or a felt's thickness proud
// of the head. The brims are slabs with real thickness, curved as cloth and felt curve, never
// flat discs. Moved out of people/garment.js's accessoryGeometry; what it needs of it comes from
// ga (see garment-armour.js). Pure numbers for the rims and the hair under them in hatRim().

import * as THREE from 'three';

// where a hat's edge sits on the head, in metres above the eyes, at the front, the sides and
// the back; and where the hair under it is cut (body.js clips the hair above eyeY + clip, a
// little above the rim, so the hat always covers the hair's end)
export function hatRim(kind) {
	switch (kind) {
		case 'cap': return { front: 0.038, side: 0.033, back: 0.027, clip: 0.043 };
		case 'visor': return { front: 0.038, side: 0.032, back: 0.03, clip: 99 };
		case 'beanie': return { front: 0.03, side: 0.004, back: 0.016, clip: 0.034 };
		case 'bucket': return { front: 0.036, side: 0.026, back: 0.022, clip: 0.042 };
		case 'sunhat': return { front: 0.04, side: 0.03, back: 0.026, clip: 0.046 };
		case 'fedora': case 'trilby': return { front: 0.042, side: 0.034, back: 0.03, clip: 0.048 };
		default: return { front: 0.045, side: 0.045, back: 0.045, clip: 0.05 };
	}
}
export const HAT_KINDS = /^(cap|visor|beanie|bucket|sunhat|fedora|trilby)$/;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

// builds a hat of kind q.kind in colour c (band or bill in a2); true when it was one of ours
export function garmentHat(ga, q, c, a2) {
	if (!HAT_KINDS.test(q.kind)) return false;
	const { cut, cx, cz, eyeY, fitTube, P0, V3, WOOL, put, skinP, nSkin } = ga;
	const lo = !!P0.lo, SEG = lo ? 20 : 36;
	// the top of the skull, from the skin itself (the cut's skull box also holds the base mesh's
	// helper geometry, which stands above the scalp)
	let top = -1e9;
	for (let i = 0, v = 0; i < nSkin; i += 3, v++) if (P0.part[v] === 0 && skinP[i + 1] > eyeY && Math.hypot(skinP[i] - cx, skinP[i + 2] - cz) < 0.1) top = Math.max(top, skinP[i + 1]);
	if (!(top > eyeY)) top = ga.top;
	// the skull's reach from its axis at each height and angle (th 0 forward, +-pi behind), the
	// ears and the hair's roots included: what the hat is pulled over
	const O = V3(cx, cut.neck, cz), UP = V3(0, 1, 0), span = top + 0.03 - O.y;
	const M = fitTube({ o: O, axis: UP, t0: 0, t1: span, dt: 0.008, seg: 48, smooth: 6, give: 0, wall: 0, bone: () => 'head', draw: false, skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.01 && Math.hypot(x - cx, z - cz) < 0.16 });
	if (!M) return true;
	// (the measure is only good where there is skin at a height: over the crown, where the skin
	// thins out to a point, an elliptical cap closes it from the last good ring)
	const yK = top - 0.028, rK = (th) => M.rad(yK - O.y, th);
	const skull = (y, th) => y <= yK ? M.rad(clamp(y - O.y, 0, span), th) : rK(th) * Math.sqrt(Math.max(0, 1 - Math.pow((y - yK) / (top - yK), 2)));
	// a hat's surface grow metres over the skull: over the crown it is the skull's cap grown
	// outward, so it closes smoothly at top + grow rather than standing as a stub
	const hatR = (y, th, grow) => y <= yK ? skull(y, th) + grow : (rK(th) + grow) * Math.sqrt(Math.max(0, 1 - Math.pow((y - yK) / (top + grow - yK), 2)));
	const R = hatRim(q.kind);
	// how far the hat stands off the skull: its cloth over the hair's roots, and over the hair
	// itself below where the hat cuts it (body.js: at eyeY + R.clip), where the hair stands out
	const over = (grow, y) => grow + 0.01 * smooth((eyeY + R.clip + 0.015 - y) / 0.03);
	// the rim's height round the head: front, sides, back, blended round
	const rimY = (th) => { const cth = Math.cos(th), f = smooth(cth), b = smooth(-cth); return eyeY + R.side + (R.front - R.side) * f + (R.back - R.side) * b; };
	// the widest the head gets above the rim (what a crown that does not follow the skull closely
	// must clear): at each angle
	const wide = (th, grow) => { let r = 0; for (let y = rimY(th); y < top - 0.01; y += 0.01) r = Math.max(r, skull(y, th) + over(grow, y)); return r; };
	const at = (r, y, th) => V3(cx + Math.sin(th) * r, y, cz + Math.cos(th) * r);

	// a closed surface over rings of points: rows[i][j] (i up the hat, j round it, j wraps);
	// the top row may be a single point (the crown's button)
	const shell = (rows, col, gloss = 0, fab = 0, bothSides = false) => {
		const V = [], I = [], idx = rows.map((row) => row.map((p) => { V.push(p.x, p.y, p.z); return V.length / 3 - 1; }));
		for (let i = 0; i < rows.length - 1; i++) {
			const a = idx[i], b = idx[i + 1], n = Math.max(a.length, b.length);
			for (let j = 0; j < n; j++) {
				const a0 = a[j % a.length], a1 = a[(j + 1) % a.length], b0 = b[j % b.length], b1 = b[(j + 1) % b.length];
				if (a0 !== a1) I.push(a0, a1, b0);
				if (b0 !== b1) I.push(a1, b1, b0);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I);
		orient(g);
		if (bothSides) { const back = g.clone(); const ix = back.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } put(back, 'head', col, gloss, fab); }
		put(g, 'head', col, gloss, fab);
	};
	// (wound so the faces look out from the head's axis)
	const orient = (g) => {
		const p = g.attributes.position, ix = g.index.array, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), out = new THREE.Vector3();
		let dot = 0;
		for (let k = 0; k < ix.length; k += 3) {
			A.fromBufferAttribute(p, ix[k]); B.fromBufferAttribute(p, ix[k + 1]); C.fromBufferAttribute(p, ix[k + 2]);
			N.crossVectors(B.clone().sub(A), C.clone().sub(A));
			out.set((A.x + B.x + C.x) / 3 - cx, (A.y + B.y + C.y) / 3 - (eyeY + 0.03), (A.z + B.z + C.z) / 3 - cz);
			dot += N.dot(out);
		}
		if (dot < 0) for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
	};
	// a brim or a bill as a slab: a surface f(s, t) (s round or across, t out from the crown, 0..1)
	// with its thickness under it and a closed edge; wrap when s runs round the hat
	const slab = (f, ns, nt, thick, col, { wrap = false, gloss = 0, fab = 0 } = {}) => {
		const P = [], N = [];
		for (let i = 0; i <= nt; i++) { P.push([]); N.push([]); for (let j = 0; j <= ns; j++) { const s = wrap ? (j / ns) * Math.PI * 2 : (j / ns) * 2 - 1, t = i / nt; P[i].push(f(s, t)); } }
		const ds = (i, j) => P[i][clamp(j + 1, 0, ns)].clone().sub(P[i][clamp(j - 1, 0, ns)]), dt = (i, j) => P[clamp(i + 1, 0, nt)][j].clone().sub(P[clamp(i - 1, 0, nt)][j]);
		for (let i = 0; i <= nt; i++) for (let j = 0; j <= ns; j++) {
			let a = ds(i, j), b = dt(i, j);
			if (wrap) a = P[i][(j + 1) % ns].clone().sub(P[i][(j - 1 + ns) % ns]);
			if (i === 0 && nt > 0) b = P[1][j].clone().sub(P[0][j]);
			const n = new THREE.Vector3().crossVectors(a, b).normalize();
			if (n.y < 0) n.negate();
			N[i].push(n);
		}
		const V = [], I = [], top = [], bot = [];
		const push = (p) => { V.push(p.x, p.y, p.z); return V.length / 3 - 1; };
		for (let i = 0; i <= nt; i++) { top.push([]); bot.push([]); for (let j = 0; j <= ns; j++) { top[i].push(push(P[i][j])); bot[i].push(push(P[i][j].clone().addScaledVector(N[i][j], -thick))); } }
		for (let i = 0; i < nt; i++) for (let j = 0; j < ns; j++) {
			const j1 = j + 1;
			I.push(top[i][j], top[i + 1][j], top[i][j1], top[i][j1], top[i + 1][j], top[i + 1][j1]);
			I.push(bot[i][j], bot[i][j1], bot[i + 1][j], bot[i][j1], bot[i + 1][j1], bot[i + 1][j]);
		}
		// the edges: the outer edge (t 1), and the two ends when it does not wrap
		for (let j = 0; j < ns; j++) I.push(top[nt][j], top[nt][j + 1], bot[nt][j], top[nt][j + 1], bot[nt][j + 1], bot[nt][j]);
		if (!wrap) for (let i = 0; i < nt; i++) { I.push(top[i][0], bot[i][0], top[i + 1][0], top[i + 1][0], bot[i][0], bot[i + 1][0]); I.push(top[i][ns], top[i + 1][ns], bot[i][ns], top[i + 1][ns], bot[i + 1][ns], bot[i][ns]); }
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I);
		g.computeVertexNormals();
		put(g, 'head', col, gloss, fab);
	};
	// a hat band or a cuff round the crown: between two heights, a little proud of it
	const band = (r, y0, y1, proud, col, gloss = 0, fab = 0) => {
		const rows = [];
		for (const [y, k] of [[y0, 0.4], [y0 + 0.002, 1], [y1 - 0.002, 1], [y1, 0.4]]) { const row = []; for (let j = 0; j < SEG; j++) { const th = (j / SEG) * Math.PI * 2; row.push(at(r(th, y) + proud * k, y, th)); } rows.push(row); }
		shell(rows, col, gloss, fab);
	};
	const pickTh = (j) => (j / SEG) * Math.PI * 2;

	if (q.kind === 'cap') {
		// a six-panel cap: the crown drawn close over the head (a cloth's thickness and the hair
		// under it), low, its top a little squarer than the skull, a button at the crown; a curved
		// bill out over the eyes, its sides turned down, pitched a little down
		const grow = 0.009, rows = [], m = lo ? 7 : 11, crownY = top + grow;
		// (the panels keep a little fullness over the upper head where the skull falls away: a
		// structured cap's crown, squarer than the head)
		const full = (u) => 0.005 * smooth((u - 0.4) / 0.4) * (1 - smooth((u - 0.82) / 0.18));
		const capAt = (u, th) => { const y0 = rimY(th), y = y0 + (crownY - y0) * Math.sin(u * Math.PI / 2); return at(hatR(y, th, over(grow, y) - grow) + full(u), y, th); };
		for (let i = 0; i < m; i++) { const row = []; for (let j = 0; j < SEG; j++) row.push(capAt(i / m, pickTh(j))); rows.push(row); }
		rows.push([at(0, crownY, 0)]);
		shell(rows, c);
		// the button at the crown
		const btn = new THREE.SphereGeometry(0.0075, lo ? 8 : 12, lo ? 5 : 8, 0, Math.PI * 2, 0, Math.PI / 2); btn.scale(1, 0.5, 1); btn.translate(cx, crownY - 0.0005, cz); put(btn, 'head', c);
		// the panel seams as fine welts from the button down to the rim (six, offset from the front)
		if (!lo) for (let k = 0; k < 6; k++) {
			const th = (k + 0.5) * Math.PI / 3, pts = [];
			for (let i = 0; i <= 10; i++) { const q0 = capAt(0.97 - 0.97 * i / 10, th), out = V3(q0.x - cx, 0, q0.z - cz).normalize(); pts.push(q0.addScaledVector(out, 0.001)); }
			const welt = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0013, 5, false); put(welt, 'head', c);
		}
		// the bill: a half-oval in plan, 7 cm out at the middle, curved down at its sides and tilted
		// down ahead; hinged on the rim between the temples
		const half = 1.1;
		slab((s, t) => {
			const th = s * half, r0 = skull(rimY(th), th) + over(grow, rimY(th)), out = 0.072 * Math.sqrt(Math.max(0, 1 - s * s)) * t;
			const x = Math.sin(th) * (r0 + out * 0.15), z = Math.cos(th) * r0 + out;
			const y = rimY(th) + 0.004 - out * 0.3 - 0.03 * s * s * t * t - 0.004 * t;
			return V3(cx + x, y, cz + z);
		}, lo ? 10 : 18, lo ? 3 : 5, 0.0035, q.faded ? new THREE.Color(a2).lerp(new THREE.Color(c), 0.5).getHex() : q.bill || c);
	} else if (q.kind === 'visor') {
		// a sun visor: a band round the head, open over the crown, and the bill
		const grow = 0.008, rows = [];
		for (const dy of [0, 0.002, 0.03, 0.034]) { const row = []; for (let j = 0; j < SEG; j++) { const th = pickTh(j), y = rimY(th) + dy; row.push(at(skull(y, th) + grow + 0.004 + (dy > 0 && dy < 0.03 ? 0.0015 : 0), y, th)); } rows.push(row); }
		shell(rows, c, 0, 0, true);
		slab((s, t) => {
			const th = s * 1.1, r0 = skull(rimY(th), th) + grow + 0.004, out = 0.075 * Math.sqrt(Math.max(0, 1 - s * s)) * t;
			return V3(cx + Math.sin(th) * (r0 + out * 0.15), rimY(th) + 0.004 - out * 0.2 - 0.025 * s * s * t * t, cz + Math.cos(th) * r0 + out);
		}, lo ? 10 : 18, lo ? 3 : 5, 0.0035, a2);
	} else if (q.kind === 'beanie') {
		// a cuffed beanie: knit pulled down over the ears and the brow, a cuff turned up round it,
		// the crown's spare length slouching back off the top of the head
		const grow = 0.011, rows = [], m = lo ? 8 : 12, crownY = top + grow + 0.03, lean = 0.028;
		for (let i = 0; i < m; i++) {
			const u = i / m, row = [];
			for (let j = 0; j < SEG; j++) {
				const th = pickTh(j), y0 = rimY(th), yHead = top + grow - 0.012, ys = y0 + (yHead - y0) * Math.min(1, u / 0.7);
				// (over the head the knit follows it; above it the spare length slouches back,
				// narrowing to its top)
				const slouch = smooth((u - 0.7) / 0.3), rr = u <= 0.7 ? hatR(ys, th, over(grow, ys) - grow) : hatR(yHead, th, grow) * (1 - slouch * slouch * 0.9);
				const y = u <= 0.7 ? ys : yHead + (crownY - yHead) * Math.sin(slouch * Math.PI / 2);
				const p = at(rr, y, th); p.z -= lean * slouch;
				row.push(p);
			}
			rows.push(row);
		}
		rows.push([V3(cx, crownY + 0.002, cz - lean - 0.004)]);
		shell(rows, c, 0, 0);
		// the cuff: a thicker turn of knit from the rim up
		band((th, y) => hatR(y, th, over(grow, y)), rimY(Math.PI) - 0.001, rimY(0) + 0.044, 0.004, c, 0, 0);
	} else if (q.kind === 'bucket' || q.kind === 'sunhat') {
		// a bucket hat: a crown of straight sides over the head, narrowing a little to a flat top,
		// and a short brim sloping down all round; a sunhat the same with a taller crown, a wide
		// soft brim that dips and waves, and a band
		const sun = q.kind === 'sunhat', grow = 0.011, rows = [], m = lo ? 6 : 9, capY = top + grow + (sun ? 0.016 : 0.008);
		const base = Array.from({ length: SEG }, (_, j) => wide(pickTh(j), grow));
		for (let i = 0; i <= m; i++) {
			const u = i / m, row = [];
			for (let j = 0; j < SEG; j++) {
				const th = pickTh(j), y0 = rimY(th), yTop = capY - 0.012;
				// (straight up with a slight taper, then rounds over the top edge)
				const edge = smooth((u - 0.8) / 0.2), y = y0 + (yTop - y0) * Math.min(1, u / 0.8) + 0.012 * Math.sin(edge * Math.PI / 2);
				const r = base[j] * (1 - 0.16 * Math.min(1, u / 0.8)) * (1 - edge * edge * 0.9);
				row.push(at(r, y, th));
			}
			rows.push(row);
		}
		rows.push([at(0, capY, 0)]);
		shell(rows, c);
		const w = sun ? 0.088 : 0.05, slope = sun ? 0.42 : 0.6, thick = sun ? 0.0028 : 0.0035;
		slab((th, t) => {
			const j = th / (Math.PI * 2) * SEG, r0 = base[Math.round(j) % SEG] - 0.001, out = w * t;
			const wave = sun ? 0.007 * Math.sin(th * 3 + 0.7) * t * t : 0;
			return at(r0 + out * Math.cos(slope * t), rimY(th) + 0.001 - out * Math.sin(slope * t) - 0.01 * t * t + wave, th);
		}, SEG, lo ? 3 : 5, thick, c, { wrap: true });
		if (sun) band((th, y) => base[Math.round(th / (Math.PI * 2) * SEG) % SEG] * (1 - 0.16 * clamp((y - rimY(th)) / (capY - 0.012 - rimY(th)))), rimY(Math.PI) + 0.004, rimY(0) + 0.028, 0.0025, a2);
	} else if (q.kind === 'fedora' || q.kind === 'trilby') {
		// a fedora: a tall crown pinched at the front with a crease down its top, a grosgrain band,
		// and a brim snapped down at the front and up at the back (a trilby's shorter)
		const trilby = q.kind === 'trilby', grow = 0.012, rows = [], m = lo ? 8 : 13, tall = top + grow + (trilby ? 0.012 : 0.022) - rimY(0);
		const base = Array.from({ length: SEG }, (_, j) => wide(pickTh(j), grow));
		const crownY = rimY(0) + tall;
		for (let i = 0; i <= m; i++) {
			const u = i / m, row = [];
			for (let j = 0; j < SEG; j++) {
				const th = pickTh(j), y0 = rimY(th), c0 = Math.cos(th), s0 = Math.sin(th);
				// the pinch: the front corners pressed in, more towards the top
				const pinch = Math.exp(-Math.pow((Math.abs(th) - 0.62) / 0.42, 2)) * (c0 > -0.2 ? 1 : 0) * 0.018 * smooth((u - 0.3) / 0.6);
				// the crease along the top: the crown dipping where the fingers took it
				const edge = smooth((u - 0.78) / 0.22), dent = 0.02 * edge * (1 - Math.abs(s0)) * (1 - Math.max(0, Math.abs(c0) - 0.85) / 0.15);
				const yTop = crownY - 0.014, y = y0 + (yTop - y0) * Math.min(1, u / 0.78) + 0.014 * Math.sin(edge * Math.PI / 2) - dent;
				const taper = 1 - 0.1 * Math.min(1, u / 0.78);
				const r = Math.max(0.004, (base[j] * taper - pinch) * (1 - edge * edge * 0.9));
				row.push(at(r, y, th));
			}
			rows.push(row);
		}
		rows.push([at(0, crownY - 0.018, 0)]);
		shell(rows, c, WOOL);
		band((th, y) => base[Math.round(th / (Math.PI * 2) * SEG) % SEG] * (1 - 0.1 * clamp((y - rimY(th)) / tall)), rimY(Math.PI) + 0.003, rimY(0) + 0.032, 0.003, a2);
		const w = trilby ? 0.04 : 0.056;
		slab((th, t) => {
			const r0 = base[Math.round(th / (Math.PI * 2) * SEG) % SEG] - 0.001, out = w * t, snap = Math.cos(th);
			// (down at the front, up at the back, flat at the sides; the edge curled a little)
			return at(r0 + out, rimY(th) + 0.002 - out * 0.38 * snap - 0.004 * t * t * Math.max(0, snap) + 0.006 * t * t * Math.max(0, -snap), th);
		}, SEG, lo ? 3 : 5, 0.003, c, { wrap: true, gloss: WOOL });
	}
	return true;
}
