// Plate armour, moved out of people/garment.js's accessoryGeometry: the close helm, and the
// harness of breastplate, lames and pauldrons, designed in shape and only sized to the body.
// What it uses from garment.js's accessoryGeometry comes from ga: what is set up before it can run,
// once at the top of each call; the rest as ga.name at each use. A name not yet there needs a
// getter in accessoryGeometry's ga.

import * as THREE from 'three';

export function garmentCloseHelm(ga, q, c) {
	const { ARMOUR, cut, cx, cz, eyeY, fitTube, P0, rivet, roundProf, rx, rz, sweep, top, V3, WOOL } = ga;
	const yc = eyeY + 0.01, yNape = cut.neck + 0.018, yBrow = eyeY + 0.014, ySight = eyeY + 0.004, yChin = eyeY - 0.08, yThroat = cut.neck + 0.02;
	const UP = V3(0, 1, 0), O = V3(cx, cut.neck - 0.01, cz), head = () => 'head', hk = (th) => Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
	const Mh = fitTube({ o: O, axis: UP, t0: 0, t1: top + 0.02 - O.y, dt: 0.008, seg: 48, smooth: 4, give: 0, wall: 0, bone: head, draw: false, skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.01 && Math.hypot(x - cx, z - cz) < 0.16 });
	const Ms = fitTube({ o: O, axis: UP, t0: 0, t1: top + 0.02 - O.y, dt: 0.008, seg: 48, smooth: 14, give: 0, wall: 0, bone: head, draw: false, skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.01 && Math.hypot(x - cx, z - cz) < 0.16 });
	if (!Mh || !Ms) return;
	const hr = (y, th, M = Mh) => M.rad(Math.max(0, Math.min(top + 0.02 - O.y, y - O.y)), th);
	// (close over the head, as on a statue: a skull a finger's width off it, not a bucket)
	const ax = rx + 0.002, azF = rz + 0.004, azB = rz + 0.006, ay = top - yc + 0.006;
	const ell = (th) => { const c0 = Math.cos(th), s0 = Math.sin(th), az = c0 > 0 ? azF : azB; return 1 / Math.sqrt((c0 / az) ** 2 + (s0 / ax) ** 2); };
	const TH = 0.003;
	// (the skull: its sides and back down to the nape, the front only to the brow)
	// hard moulding, not a round shell: each level's section drawn as the planes laid on it
	// (six, their creases down the middle front and back and at the cheeks), the corners
	// eased a hair; outside what it is laid on everywhere, as the planes only touch it
	const FAC = [-5, -3, -1, 1, 3, 5].map((k) => (k * Math.PI) / 6);
	const facet = (base, ease = 900) => {
		const cache = new Map();
		return (y, th) => {
			const key = Math.round(y * 1e4);
			let R = cache.get(key);
			if (!R) {
				R = FAC.map((c) => { let m = 0; for (let i = 0; i < 40; i++) { const a = c - 1.2 + (2.4 * i) / 39; m = Math.max(m, base(y, a) * Math.cos(a - c)); } return m; });
				cache.set(key, R);
			}
			let sum = 0;
			for (let j = 0; j < FAC.length; j++) { const d = Math.cos(th - FAC[j]); if (d > 0.05) sum += Math.exp(-ease * (R[j] / d)); }
			return sum > 0 ? -Math.log(sum) / ease : base(y, th);
		};
	};
	// (under the planes: an egg drawn tight over the head, its crown brought up to a point)
	const skullBase = (y, th) => {
		const k = y >= yc ? Math.pow(Math.max(0, 1 - ((y - yc) / ay) ** 2), 0.62) : 1 - 0.16 * ((yc - y) / (yc - yNape)) ** 2 * (1 - Math.max(0, Math.cos(th)));
		return Math.max(ell(th) * k, y < top - 0.01 ? hr(y, th, Ms) + 0.0065 : 0);
	};
	const skullF = facet(skullBase);
	const skullR = (y, th) => {
		let r = skullF(y, th);
		const x = Math.abs(r * Math.sin(th)), xb = Math.abs(r * Math.sin(th - Math.PI));
		// (a keel stood up along the crease front and back over the crown, and a heavy brow
		// jutting over the sight)
		const up = Math.max(0, Math.min(1, (y - yBrow - 0.012) / 0.03));
		r += 0.0045 * Math.max(0, 1 - x / 0.007) * up * (Math.cos(th) > 0 ? 1 : 0) + 0.0035 * Math.max(0, 1 - xb / 0.007) * (y > yc ? 1 : 0);
		r += 0.006 * Math.max(0, Math.cos(th)) ** 3 * (1 - Math.max(0, Math.min(1, (y - yBrow) / 0.026)));
		return Math.max(r, y < top - 0.01 ? hr(y, th) + 0.004 : 0);
	};
	const skullLo = (th) => { const f = hk(th), u = Math.max(0, Math.min(1, (f - 0.9) / 0.55)); return yBrow + (yNape - yBrow) * u * u * (3 - 2 * u); };
	const yPole = yc + ay;
	const skull = fitTube({ o: O, axis: UP, t0: yNape - O.y, t1: yPole - O.y, dt: 0.007, seg: 64, span: (th) => [skullLo(th) - O.y, yPole - O.y], floor: (t, th) => skullR(O.y + t, th), skin: () => false, smooth: 0, wall: 0, minR: 0.0004, closeB: 0.001, col: c, thick: TH, rim: 0.0014, bone: head });
	// (the brow over the sight, its edge rolled; the skull's lower edge rolled behind)
	if (skull) {
		const pts = []; for (let i = 0; i <= 64; i++) { const th = -Math.PI + (i / 64) * Math.PI * 2; pts.push(skull.at(skullLo(th) - O.y + 0.003, th, 0.0012)); }
		pts.pop(); sweep(pts, roundProf(0.0038, 8), c, ARMOUR, 0, 1, true);
	}
	// (the visor: wider than the skull, so its sides lie over it, drawn out to a beak below the
	// sight; its lower edge sweeping up to the pivots)
	// (the face's reach forward at each height, the nose and the chin taken in one smooth curve)
	const faceD = (y) => { let m = 0; for (let k = -3; k <= 3; k++) m = Math.max(m, hr(y + k * 0.01, 0, Ms)); return m; };
	const W = 1.52, prow = (y) => 0.003 + 0.024 * Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, (ySight + 0.004 - y) / (ySight - yChin + 0.02)))), 0.75);
	const visorR0 = (y, th) => {
		const k = y >= yc ? 1 : 1 - 0.13 * ((yc - y) / (yc - yChin)) ** 2, c0 = Math.cos(th), s0 = Math.sin(th);
		const a = ax * k + 0.0055, b = c0 > 0 ? Math.max(azF * k + 0.0055, faceD(y) + 0.0105) : azB + 0.0055, n = 2.2;
		let r = Math.pow(Math.pow(Math.abs(c0 / b), n) + Math.pow(Math.abs(s0 / a), n), -1 / n);
		const x = Math.abs(r * s0);
		if (c0 > 0) r += prow(y) * Math.max(0, 1 - x / 0.058) * c0;
		return Math.max(r, hr(y, th, Ms) + 0.016);
	};
	// (the visor in planes too, its beak a crease)
	const visorR = facet(visorR0);
	const visLo = (th) => yChin + (ySight - 0.028 - yChin) * Math.pow(Math.abs(th) / W, 2.2), visHi = (th) => ySight - 0.004 * (th / W) ** 2;
			const visor = fitTube({
		o: O, axis: UP, t0: yChin - O.y, t1: ySight - O.y, dt: 0.0045, seg: 72, arc: [-W, W], span: (th) => [visLo(th) - O.y, visHi(th) - O.y],
		floor: (t, th) => visorR(O.y + t, th), skin: () => false, smooth: 0, wall: 0, minR: 0.0004, col: c, thick: TH, rim: 0.0012, bone: head,
	});
	if (visor) {
		// (its upper edge turned out in a lip over the sight)
		const lip = []; for (let i = 0; i <= 48; i++) { const th = -W + 0.04 + (i / 48) * (W * 2 - 0.08); lip.push(visor.at(visHi(th) - O.y - 0.002, th, 0.0015)); }
		sweep(lip, [[-0.003, -0.001], [0.003, -0.001], [0.003, 0.004], [-0.002, 0.005]], c, ARMOUR, 0, 1);
		// (the breaths: slots punched in the right cheek, dark behind)
		for (let r = 0; r < 5; r++) {
			const y = eyeY - 0.06 + r * 0.0105, pts = [];
			for (let i = 0; i <= 10; i++) pts.push(visor.at(y - O.y, -1.1 + i * 0.058, 0.0003));
			sweep(pts, [[-0.0022, 0], [0.0022, 0], [0.0022, 0.0004], [-0.0022, 0.0004]], '#0b0a09', 0.02, 0, 0);
		}
		for (const s of [1, -1]) { const B = visor.at(ySight - 0.024 - O.y, s * (W - 0.06), 0.0005); rivet(B, 0.0085, c, 0.45); rivet({ p: B.p.clone().addScaledVector(B.n, 0.0035), n: B.n, bone: B.bone }, 0.003, c, 0.8); }
	}
	// (the bevor: from under the visor's lower edge to the throat, the beak's line carried down)
	const bevLo = (th) => yThroat + 0.012 * (th / 1.6) ** 2, bevHi = (th) => yChin + 0.022 + (ySight - 0.045 - yChin - 0.022) * Math.pow(Math.abs(th) / 1.6, 2.2);
	fitTube({
		o: O, axis: UP, t0: yThroat - O.y, t1: ySight - O.y, dt: 0.006, seg: 64, arc: [-1.6, 1.6], span: (th) => [bevLo(th) - O.y, bevHi(th) - O.y],
		floor: (t, th) => {
			const y = O.y + t, u = Math.max(0, Math.min(1, (y - yThroat) / (yChin + 0.02 - yThroat)));
			let r = Math.max(hr(y, th, Ms) + 0.013, visorR(Math.min(y, yChin + 0.02), th) * u + (hr(y, th, Ms) + 0.018) * (1 - u) - 0.0055);
			r += 0.006 * Math.max(0, 1 - Math.abs(r * Math.sin(th)) / 0.05) * Math.max(0, Math.cos(th));
			// (tucked under the visor where they lap)
			return y > visLo(th) - 0.003 ? Math.min(r, visorR(y, th) - TH - 0.0025) : r;
		},
		skin: () => false, smooth: 0, wall: 0, minR: 0.0004, col: c, thick: TH, rim: 0.0016, bone: head,
	});
	// (the padded lining and collar, seen through the sight and the breaths and between the helm
	// and the gorget)
	fitTube({
		o: O, axis: UP, t0: cut.neck - 0.035 - O.y, t1: eyeY + 0.03 - O.y, dt: 0.012, seg: 32, wall: 0.005, smooth: 6, col: '#17140f', gloss: WOOL, thick: 0, edge: () => 0, stain: false,
		skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.05 && y < eyeY + 0.05 && Math.hypot(x - cx, z - cz) < 0.16, bone: (t) => (O.y + t > cut.neck + 0.02 ? 'head' : 'neck01'),
	});
}

export function garmentHarness(ga, q, c) {
	const { angGap, ARMOUR, cut, fitTube, heads, kH, LEATHER, limbGirth, map, nSkin, P0, put, rivet,
		roundProf, skinP, strapProf, sweep, thetaOf, V3, WOOL } = ga;
	const part = P0.part, tz = (cut.frontZ + cut.backZ) / 2, armpit = cut.chest - 0.02, yN = cut.neck;
	const knee = heads[map['lowerleg01.L']], legL = heads[map['upperleg01.L']];
	if (!part || !knee || !legL) return;
	const yo = knee.y + 0.02, sL = Math.sign(legL.x) || 1;
	const inArm = (x) => Math.abs(x) > cut.shoulderX * 0.78;
	const O = V3(0, yo, tz), UP = V3(0, 1, 0), fOf = (th) => Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
	// (the body measured round the trunk, the thighs below the hip: the plate is sized to the
	// body itself, and what is worn under it pressed in under the plate, as the plate would)
	const M = fitTube({
		o: O, axis: UP, t0: 0, t1: yN - yo, dt: 0.01, seg: 48, smooth: 3, give: 0, wall: 0, bone: () => 'spine01', draw: false,
		skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && !(y > armpit && inArm(x)),
	});
	if (!M) return;
	// (and the same broadly smoothed, for cloth hung over it)
	const M2 = fitTube({
		o: O, axis: UP, t0: 0, t1: yN - yo, dt: 0.01, seg: 48, smooth: 24, give: 0, wall: 0, bone: () => 'spine01', draw: false,
		skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && !(y > armpit && inArm(x)),
		cloth: (x, y, z, slot, limb) => limb !== 1 && !(y > armpit && inArm(x)),
	});
	const NY = Math.round((yN - yo) / 0.01) + 1, X = new Float32Array(NY), F = new Float32Array(NY), Bk = new Float32Array(NY);
	for (let i = 0; i < NY; i++) for (let j = 0; j < 96; j++) {
		const th = (j / 96) * Math.PI * 2, r = M.rad(Math.min(yN - yo, i * 0.01), th);
		X[i] = Math.max(X[i], r * Math.abs(Math.sin(th)));
		if (Math.cos(th) > 0) F[i] = Math.max(F[i], r * Math.cos(th)); else Bk[i] = Math.max(Bk[i], -r * Math.cos(th));
	}
	const sm = (A) => { for (let p = 0; p < 3; p++) { const C = A.slice(); for (let i = 0; i < NY; i++) A[i] = (C[Math.max(0, i - 2)] + C[Math.max(0, i - 1)] * 2 + C[i] * 2 + C[Math.min(NY - 1, i + 1)] * 2 + C[Math.min(NY - 1, i + 2)]) / 8; } };
	sm(X); sm(F); sm(Bk);
	const at1 = (A, y) => { const f = Math.max(0, Math.min(NY - 1.001, (y - yo) / 0.01)), i = Math.floor(f), u = f - i; return A[i] * (1 - u) + A[i + 1] * u; };
	const cl = 0.022, yP = cut.chest - 0.035, yW = cut.waist;
	const ss = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
	// (the breast at its fullest a little under the chest, drawn in from there to the waist and
	// toward the neck in one curve; the back flatter; the waist taken in)
	let fP = 0; for (let y = yP - 0.04; y <= yP + 0.04; y += 0.01) fP = Math.max(fP, at1(F, y));
	fP += cl + 0.014;
	const kDown = Math.max(0, (fP - at1(F, yW) - cl) / (yP - yW) ** 2);
	const front = (y) => Math.max(at1(F, y) + cl, fP - kDown * (y < yP ? 1 : 0.85) * (y - yP) ** 2);
	// (close at the sides under the arms, where they hang against it)
	const side = (y) => at1(X, y) + cl - 0.016 * ss((armpit + 0.03 - y) / 0.05), back = (y) => at1(Bk, y) + cl;
	const keel = (y) => 0.011 * Math.max(0, Math.min(1, (yN - 0.03 - y) / 0.1));
	const shape = (y, th) => {
		const c0 = Math.cos(th), s0 = Math.sin(th), a = side(y), b = c0 > 0 ? front(y) : back(y), n = c0 > 0 ? 2.15 : 2.6;
		let r = Math.pow(Math.pow(Math.abs(c0 / b), n) + Math.pow(Math.abs(s0 / a), n), -1 / n);
		if (c0 > 0) r += keel(y) * Math.max(0, 1 - Math.abs(r * s0) / 0.075) * c0;
		return r;
	};
	// (never closer to the body than a finger's width: measured broadly smoothed, so where the
	// shape runs close, under the arms, the plate does not take up the body's every bump)
	const Ms = fitTube({ o: O, axis: UP, t0: 0, t1: yN - yo, dt: 0.01, seg: 48, smooth: 18, give: 0, wall: 0, bone: () => 'spine01', draw: false, skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && !(y > armpit && inArm(x)) });
	const shell = (y, th) => Math.max(shape(y, th), Ms.rad(Math.max(0, Math.min(yN - yo, y - yo)), th) + 0.009);
	// the breastplate and backplate: cut high round the neck, scooped deep for the arms (mail shows
	// in the armpit, where the arm lies against the body), the breast
	// coming to a shallow point at the waist; the back's edges under the breast's at the sides
	const bell = (f) => { const d = Math.abs(f - Math.PI / 2); return d < 1.0 ? Math.pow(Math.cos((d / 1.0) * Math.PI / 2), 0.55) : 0; };
	const yTop = (th) => { const f = fOf(th), base = yN - 0.045 + 0.012 * (1 - Math.cos(f)) / 2 - 0.016 * Math.exp(-((f / 0.4) ** 2)); return base - bell(f) * (base - armpit + 0.03); };
	const yBot = (th) => { const f = fOf(th), u = (1 - Math.cos(f)) / 2; return (yW - 0.03 - 0.024 * Math.exp(-((f / 0.35) ** 2))) * (1 - u) + (yW - 0.005) * u; };
	const plateBone = (t) => { const u = Math.max(0, Math.min(1, (cut.chest - yo - t) / 0.2)); return [['spine01', 1 - u * 0.45], ['spine02', u * 0.45]]; };
	const T0 = yW - 0.06 - yo, T1 = yN - 0.02 - yo, TH = 0.0035;
	// (the plackart: a second plate over the belly, its top rising to a point under the tabard
	// and sweeping down toward the sides, lapped over the breastplate's lower edge; the
	// breastplate stops a hand's width under that edge, so the two read as two plates and the
	// belly can bend between them)
	const ym = (yP + yW) / 2, PG = TH + 0.0015, OVL = 0.028;
	const plTop = (th) => { const f = fOf(th); return ym - 0.032 + 0.11 * Math.exp(-((f / 0.6) ** 2)) - 0.01 * Math.max(0, (f - 1.2) / 0.6); };
	// (the plackart wraps only the front: under the arms, where they hang against the body, the
	// breastplate alone runs down to the waist)
	const PA = 1.38, brBot = (th) => { const u = 1 - plUnder(th); return (plTop(th) - OVL) * (1 - u) + yBot(th) * u; };
	// (the breastplate drawn in under the plackart's edge, and the plackart's edge turned out over
	// it, so the step between them throws a shadow)
	const plUnder = (th) => 1 - ss((fOf(th) - PA + 0.12) / 0.2);
	const tuck = (y, th) => 0.006 * plUnder(th) * ss((plTop(th) + 0.004 - y) / 0.02), flare = (y, th) => 0.005 * ss((y - plTop(th) + 0.016) / 0.016);
	const breast = fitTube({ o: O, axis: UP, t0: ym - 0.09 - yo, t1: T1, dt: 0.011, seg: 64, arc: [-1.78, 1.78], span: (th) => [brBot(th) - yo, yTop(th) - yo], floor: (t, th) => shell(yo + t, th) - tuck(yo + t, th), skin: () => false, smooth: 0, wall: 0.001, minR: 0.001, col: c, rim: 0.0012, thick: TH, bone: plateBone });
	const backP = fitTube({ o: O, axis: UP, t0: T0, t1: T1, dt: 0.011, seg: 56, arc: [1.42, Math.PI * 2 - 1.42], span: (th) => [yBot(th) - yo, yTop(th) - yo], floor: (t, th) => shell(yo + t, th) - TH - 0.0015, skin: () => false, smooth: 0, wall: 0.001, minR: 0.001, col: c, rim: 0.0012, thick: TH, bone: plateBone });
	// (their edges rolled: a round bead along the neck and the arm holes)
	const edgeRun = (P, a0, a1, tAt, n, off = 0) => { const pts = []; for (let i = 0; i <= n; i++) { const th = a0 + ((a1 - a0) * i) / n, S = P.at(tAt(th), th, off); pts.push(S); } return pts; };
	const bead = (pts, r = 0.0042) => sweep(pts.map((S) => ({ p: S.p.clone().addScaledVector(S.n, r * 0.35), n: S.n, bone: S.bone })), roundProf(r, 8), c, ARMOUR, 0, 1);
	if (breast) bead(edgeRun(breast, -1.74, 1.74, (th) => yTop(th) - yo - 0.003, 56));
	const plack = fitTube({ o: O, axis: UP, t0: T0, t1: ym + 0.06 - yo, dt: 0.011, seg: 52, arc: [-PA, PA], span: (th) => [yBot(th) - yo, plTop(th) - yo], floor: (t, th) => shell(yo + t, th) + PG + flare(yo + t, th), skin: () => false, smooth: 0, wall: 0.001, minR: 0.001, col: c, rim: 0.0012, thick: TH, bone: plateBone });
	// (its top edge turned out in a roll, and riveted to the breastplate under it at the sides)
	if (plack) {
		// (only beside the tabard: under it the roll would show through the cloth)
		for (const s of [1, -1]) bead(edgeRun(plack, s * 0.36, s * (PA - 0.03), (th) => plTop(th) - yo - 0.003, 24), 0.005);
		for (const th of [-1.2, -0.75, 0.75, 1.2]) rivet(plack.at(plTop(th) - yo - 0.014, th, 0.0005), 0.0036);
	}
	if (backP) bead(edgeRun(backP, 1.46, Math.PI * 2 - 1.46, (th) => yTop(th) - yo - 0.003, 48));
	// (leather straps buckling the back to the breast under each arm, set behind where the arm
	// hangs so it does not lie on them: from the breast's edge across onto the backplate)
	const strapC = q.acc || '#3a2a1e', buckleC = '#4a4842';
	if (breast && backP) for (const s of [1, -1]) {
		const y0 = armpit - 0.05, on = (y, a, h) => (Math.abs(a) <= 1.76 ? breast.at(y, a, h) : backP.at(y, a, h + TH + 0.0015));
		const pts = []; for (let i = 0; i <= 6; i++) pts.push(on(y0 - yo - i * 0.012, s * (1.66 + i * 0.045), TH + 0.002));
		sweep(pts, strapProf(0.02, 0.0025), strapC, LEATHER, 0, 0.5);
		const B0 = on(y0 - yo - 0.024, s * 1.72, TH + 0.004), fr = new THREE.TorusGeometry(0.011, 0.002, 4, 4);
		fr.rotateZ(Math.PI / 4); fr.lookAt(B0.n); fr.translate(B0.p.x, B0.p.y, B0.p.z); put(fr, B0.bone, buckleC, ARMOUR);
	}
	// the fauld: lames hung from the breastplate's lower edge to the hips, each flaring a little
	// and lapping over the one below, riveted at the sides
	const nL = P0.lo ? 3 : 4, yF = cut.hip - 0.035, hL = ((yBot(0) + yBot(Math.PI)) / 2 - yF) / nL;
	const fauldTop = (k, th) => yBot(th) + 0.012 - k * hL, FL = 0.15, OV = 0.014;
	// (lame k's outside at y: tucked in under the plate above it where they lap, a gap's width
	// inside that plate's inside, flaring out only below its edge, so no lame cuts through
	// the one over it)
	const lameR = (k, y, th) => {
		const tp = fauldTop(k, th), above = k ? lameR(k - 1, tp, th) : shell(tp, th) + 0.001 + (Math.abs(th) > 1.42 ? -(TH + 0.0015) : Math.abs(th) <= PA ? PG : 0);
		return above - TH - 0.0015 + shell(y, th) - shell(tp, th) + FL * Math.max(0, tp - OV - y);
	};
	const fauldR = (y, th) => {
		let r = 0;
		for (let k = 0; k < nL; k++) { const tp = fauldTop(k, th); if (y <= tp && y >= tp - hL - 0.012) r = Math.max(r, lameR(k, y, th)); }
		return r;
	};
	// (the inside of the innermost plate at each height and way round, for what is under it)
	const plateIn = (y, th) => {
		let r = y >= yBot(th) ? shell(y, th) + 0.001 - TH - tuck(y, th) - (Math.abs(th) > 1.42 ? TH + 0.0015 : 0) : Infinity;
		for (let k = 0; k < nL; k++) { const tp = fauldTop(k, th); if (y <= tp && y >= tp - hL - 0.012) r = Math.min(r, lameR(k, y, th) - TH); }
		return r === Infinity ? 0 : r;
	};
	const lameBone = (k) => (k === 0 ? [['spine02', 0.5], ['spine04', 0.5]] : k === nL - 1 ? [['spine04', 0.3], ['root', 0.7]] : [['spine04', 0.7], ['root', 0.3]]);
	for (let k = 0; k < nL; k++) {
		const L = fitTube({
			o: O, axis: UP, t0: yF - hL - 0.04 - yo, t1: yBot(Math.PI) + 0.02 - yo, dt: 0.008, seg: 72, span: (th) => [fauldTop(k, th) - hL - 0.012 - yo, fauldTop(k, th) - yo], rows: Math.ceil((hL + 0.012) / 0.008) + 1,
			floor: (t, th) => lameR(k, yo + t, th), skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH, bone: () => lameBone(k),
		});
		if (L) for (const th of [1.32, -1.32, Math.PI - 0.5, 0.5 - Math.PI]) rivet(L.at(fauldTop(k, th) - hL * 0.45 - yo, th, 0.0005), 0.0038);
	}
	if (plack) for (const th of [-1.2, -0.65, 0.65, 1.2]) rivet(plack.at(yBot(th) - yo + 0.008, th, 0.0005), 0.0036);
	// (the outermost plate at each height and way round, for what is worn over it)
	const armR = (y, th) => Math.max(y >= yBot(th) - 0.002 ? shell(y, th) + TH + (y <= plTop(th) + 0.002 && Math.abs(th) <= PA ? PG + flare(y, th) : 0) : 0, fauldR(y, th));
	// (the mail and cloth under the plate pressed in under it, the shift in how the clothes
	// meet the body moved with them, cloth-collide.js)
	const cp = P0.cloth?.attributes.position, ci = P0.cloth?.attributes.clothInset, slot = P0.cloth?.attributes.slot;
	if (cp) for (let i = 0; i < cp.count; i++) {
		const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), dz = z - tz, r = Math.hypot(x, dz);
		if (y > yN || y < yF - hL || (slot && slot.getX(i) % 10 === 1) || r < 1e-4 || (y > armpit - 0.03 && inArm(x))) continue;
		const th = Math.atan2(x, dz), inner = plateIn(y, th) - 0.003;
		if (y > yTop(th) + 0.01 || inner <= 0 || r <= inner) continue;
		const k = inner / r;
		cp.setXYZ(i, x * k, y, tz + dz * k);
		if (ci) ci.setX(i, ci.getX(i) + (r - inner));
	}
	// the tasset: a plate of two lames over the front of each thigh, strapped to the lowest lame
	for (const sd of ['L', 'R']) {
		const ub = 'upperleg01.' + sd, U = heads[map[ub]], Lk = heads[map['lowerleg01.' + sd]]; if (!U || !Lk) continue;
		const sx = Math.sign(U.x) || 1, au = Lk.clone().sub(U).normalize(), out0 = thetaOf(au, V3(sx, 0, 0)), mine = (x) => Math.sign(x) === sx;
		const tA = U.y - yF + 0.015, tL = 0.075;
		const thM = fitTube({ o: U, axis: au, t0: 0.0, t1: 0.3, dt: 0.012, seg: 32, smooth: 20, give: 0, wall: 0, draw: false, skin: (v, x) => part[v] === 4 && mine(x), cloth: (x, y, z, slot, limb) => limb === 2 && mine(x), bone: () => ub });
		if (!thM) continue;
		const thR = (t, th) => thM.rad(Math.max(0, Math.min(0.3, t)), th);
		for (let k = 0; k < 2; k++) {
			const a0 = tA + k * (tL - 0.012);
			fitTube({
				o: U, axis: au, t0: a0, t1: a0 + tL, dt: 0.008, seg: 30, arc: out0 > 0 ? [-0.6, out0 + 0.2] : [out0 - 0.2, 0.6], skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH,
				span: (th) => [a0 + 0.008 * Math.cos(th), a0 + tL - 0.012 * Math.cos(th)],
				floor: (t, th) => thR(t, th) + 0.02 + k * 0.0065 + 0.06 * (t - a0), bone: () => [[ub, 0.8], ['root', 0.2]],
			});
		}
	}
	// the tabard: front and back panels from the neck, over the plate, gathered at the belt and
	// falling in heavy folds below it to a worn, ragged hem at the knee; the order's device on the
	// breast and the skirt, in the weave
	const yBelt = yW - 0.04, beltH = 0.042, tabTop = yN - 0.06;
	let tabR = null;
	if (q.tabard) {
		const cloth = new THREE.Color(q.tabard), trim = new THREE.Color(q.trim || '#8c7a4e'), yc = cut.chest - 0.03;
		const under = (y, th) => Math.max(armR(y, th), M2.rad(Math.max(0, Math.min(yN - yo, y - yo)), th) + 0.014);
		// (below the belt the cloth falls straight from whatever stands furthest out above it)
		const drape = (y, th) => { let r = 0; for (let yy = y; yy < yBelt - beltH / 2; yy += 0.012) r = Math.max(r, under(yy, th)); return Math.max(r, under(yBelt - beltH / 2, th)); };
		const hash = (x) => { const h = Math.sin(x * 127.1) * 43758.5453; return h - Math.floor(h); };
		const hem = (th) => yo + 0.04 + 0.008 * hash(Math.round(th * 26)) + 0.012 * Math.sin(th * 11.3 + 0.7) + 0.007 * Math.sin(th * 29.1) + 0.045 * Math.max(0, Math.sin(th * 6.1 + 0.4) - 0.88) / 0.12;
		const fold = (th) => 0.5 + 0.5 * Math.sin(th * 21 + 1.3 * Math.sin(th * 5.3));
		tabR = (y, th) => {
			const b = y - yBelt;
			// (pressed flat under the belt, puffed a little either side of it, easing out to hang)
			const pinch = armR(yBelt, th) + 0.0015, e = Math.abs(b) - beltH / 2, u = Math.max(0, Math.min(1, (e + 0.004) / 0.03)), w = u * u * (3 - 2 * u);
			const puff = 0.005 * Math.exp(-(((e - 0.01) / 0.01) ** 2));
			if (b > 0) return pinch + (under(y, th) + 0.003 - pinch) * w + puff;
			const g = Math.min(1, Math.max(0, e) / 0.2);
			return pinch + (drape(y, th) + 0.003 - pinch) * w + puff + 0.016 * g * fold(th);
		};
		const w0 = 0.42, w1 = 0.74, lift = (t, th) => { const y = yo + t; if (y > yBelt - beltH / 2) return null; const g = Math.min(1, (yBelt - beltH / 2 - y) / 0.2), f = fold(th); return { tone: 1 - g * (1 - f) * 0.28, dirt: g * (1 - f) * 0.5 }; };
		const paint = (mid) => (t, th, p) => {
			if (mid || Math.abs(th) > 0.5) return null;
			// the order's device, a sword point down on the breast, its cross on the skirt
			const dx = Math.abs(p.x), dy = p.y - yc;
			if ((dx < 0.012 && dy > -0.11 && dy < 0.06) || (dx < 0.055 && Math.abs(dy - 0.045) < 0.01) || Math.hypot(dx, dy - 0.08) < 0.015) return trim;
			const ys = yBelt - 0.16;
			if ((dx < 0.012 && Math.abs(p.y - ys) < 0.06) || (dx < 0.045 && Math.abs(p.y - ys - 0.015) < 0.011)) return trim;
			return null;
		};
		const tabBone = (t, th) => {
			const y = yo + t;
			if (y > cut.hip) return y > cut.chest - 0.08 ? 'spine01' : y > yBelt ? [['spine01', 0.5], ['spine02', 0.5]] : [['spine02', 0.4], ['spine04', 0.6]];
			const u = Math.min(1, (cut.hip - y) / 0.2), wl = Math.max(0, Math.min(1, 0.5 + Math.sin(th) * sL * 1.4));
			return [['spine04', 1 - u * 0.85], ['upperleg01.L', u * 0.85 * wl], ['upperleg01.R', u * 0.85 * (1 - wl)]];
		};
		const cloth0 = { skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: q.tabard, gloss: WOOL, fab: 0, thick: 0.004, stain: false, edge: () => 0, rimCol: cloth.clone().multiplyScalar(0.62), lift, bone: tabBone, floor: (t, th) => tabR(yo + t, th) };
		for (const mid of [0, Math.PI]) {
			// (the breast panel, its top under the gorget; the skirt, its top under the belt)
			fitTube({ ...cloth0, o: O, axis: UP, t0: yBelt - 0.015 - yo, t1: tabTop - yo, dt: 0.013, seg: 24, arc: [mid - w0, mid + w0], paint: paint(mid) });
			fitTube({ ...cloth0, o: O, axis: UP, t0: 0, t1: yBelt + 0.012 - yo, dt: 0.013, seg: 48, arc: [mid - w1, mid + w1], span: (th) => [hem(th) - yo, yBelt + 0.012 - yo], paint: paint(mid) });
		}
	}
	// the belt, buckled at the front, its tongue hanging
	// (round everything under its whole width, the plate's edges and the tabard's sides, then
	// eased round the waist so it never steps where what is under it does)
	const NB = 96, BR = [];
	for (let i = 0; i < NB; i++) {
		const th = (i / NB) * Math.PI * 2;
		let r = 0; for (let k = -2; k <= 2; k++) r = Math.max(r, armR(yBelt + (k * beltH) / 4, th));
		if (tabR && Math.abs(Math.sin(th)) < 0.72) r = Math.max(r, tabR(yBelt, th) + 0.004);
		BR.push(r + 0.001);
	}
	for (let it = 0; it < 5; it++) { const c0 = BR.slice(); for (let i = 0; i < NB; i++) BR[i] = Math.max(c0[i], (c0[(i + NB - 1) % NB] + c0[i] * 2 + c0[(i + 1) % NB]) / 4); }
	const beltR = (th) => { const f = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * NB, i = Math.floor(f) % NB, u = f - Math.floor(f); return BR[i] * (1 - u) + BR[(i + 1) % NB] * u; };
	const beltBone = [['spine02', 0.4], ['spine04', 0.6]], dirR = (th) => V3(Math.sin(th), 0, Math.cos(th));
	const beltPts = []; for (let i = 0; i < 96; i++) { const th = (i / 96) * Math.PI * 2, d = dirR(th); beltPts.push({ p: V3(d.x * beltR(th), yBelt, tz + d.z * beltR(th)), n: d, bone: beltBone }); }
	sweep(beltPts, strapProf(beltH, 0.005), q.belt || '#2e2219', LEATHER, 0, 0.6, true);
	{
		const r0 = beltR(0) + 0.006, fr = new THREE.TorusGeometry(0.026, 0.0048, 6, 4);
		fr.rotateZ(Math.PI / 4); fr.scale(1, 1.2, 1); fr.translate(0, yBelt, tz + r0); put(fr, beltBone, '#4b4944', ARMOUR);
		const tongue = new THREE.CylinderGeometry(0.0028, 0.0028, 0.034, 6); tongue.translate(0, yBelt, tz + r0 + 0.001); put(tongue, beltBone, '#4b4944', ARMOUR);
		const tip = []; for (let i = 0; i <= 8; i++) { const th = 0.1 + i * 0.004, y = yBelt - 0.005 - i * 0.012, d = dirR(th), r = beltR(th) + 0.006 + i * 0.0006; tip.push({ p: V3(d.x * r, y, tz + d.z * r), n: d, bone: beltBone }); }
		sweep(tip, strapProf(0.034, 0.005), q.belt || '#2e2219', LEATHER, 0, 0.6);
	}
	// the gorget: three lames round the neck, each lapping the one below, the lowest over the
	// breastplate's collar and the tabard's top
	{
		const gTop = cut.neck + 0.035, gBot = yN - 0.078, hG = (gTop - gBot) / 3;
		const Mn = fitTube({ o: O, axis: UP, t0: gBot - yo - 0.03, t1: gTop - yo + 0.03, dt: 0.008, seg: 48, smooth: 12, give: 0, wall: 0, bone: () => 'neck01', draw: false, skin: (v, x, y) => part[v] === 0 && y > gBot - 0.04 && y < gTop + 0.04 && Math.abs(x) < 0.085 });
		const plateR = (y, th) => (y >= yBot(th) && y <= yTop(th) + 0.008 ? shell(y, th) + TH + 0.0075 : 0);
		const tabTopR = (y, th) => (tabR && y < tabTop + 0.006 && (fOf(th) < 0.47 || fOf(th) > Math.PI - 0.47) ? tabR(y, th) + 0.007 : 0);
		// (each lame's reach round the neck, never under what it laps over below it, smoothed
		// round so it runs clean)
		const NT = 96, reachK = (k) => {
			const tp = gTop - k * hG, R = new Float32Array(NT);
			for (let j = 0; j < NT; j++) {
				const th = (j / NT) * Math.PI * 2;
				let r = Mn.rad(Math.max(gBot - yo - 0.03, Math.min(gTop - yo + 0.03, tp - hG / 2 - yo)), th) + 0.012 + k * 0.008;
				for (let y = tp - hG - 0.012; y <= tp; y += 0.004) r = Math.max(r, plateR(y, th), tabTopR(y, th));
				R[j] = r;
			}
			for (let p = 0; p < 6; p++) { const C = R.slice(); for (let j = 0; j < NT; j++) R[j] = Math.max(C[j] - 0.002, (C[(j + NT - 1) % NT] + C[j] * 2 + C[(j + 1) % NT]) / 4); }
			return (th) => { const f = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * NT, j = Math.floor(f) % NT, u = f - Math.floor(f); return R[j] * (1 - u) + R[(j + 1) % NT] * u; };
		};
		if (Mn) for (let k = 0; k < 3; k++) {
			const tp = gTop - k * hG, rk = reachK(k);
			const L = fitTube({
				o: O, axis: UP, t0: tp - hG - 0.012 - yo, t1: tp - yo, dt: 0.006, seg: 56, skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH,
				floor: (t, th) => rk(th) + 0.2 * (tp - yo - t) - 0.002,
				bone: () => (k === 0 ? 'neck01' : k === 1 ? [['neck01', 0.5], ['spine01', 0.5]] : 'spine01'),
			});
			if (L && k === 2) for (const th of [0.9, -0.9]) rivet(L.at(tp - hG * 0.5 - yo, th, 0.0004), 0.0038);
		}
	}
	// the pauldrons: a dome round each shoulder joint, its rim rolled, and three lames lapping
	// down the arm under it, each riveted at its ends; plate down the upper arm below them
	for (const sd of ['L', 'R']) {
		const ub = 'upperarm01.' + sd, S = heads[map[ub]], E = heads[map['lowerarm01.' + sd]]; if (!S || !E) continue;
		const sx = Math.sign(S.x) || 1, len = S.distanceTo(E), ax = E.clone().sub(S).normalize(), outA = thetaOf(ax, V3(sx, 0, 0));
		const mine = (x) => x * sx > Math.abs(S.x) * 0.5;
		// (the cap: an ellipsoid over the joint, flatter than it is wide and longer front to back
		// than across, grown until it holds every bit of the shoulder under it, then stood off it)
		const C = S.clone().add(V3(-sx * 0.012, -0.012, 0)), d = V3(sx * 0.5, 0.86, 0).normalize();
		const f0 = V3(0, 0, 1).projectOnPlane(d).normalize(), s0 = V3(0, 0, 0).crossVectors(d, f0), fb = 1.16;
		let e = 0;
		for (let i = 0, v = 0; i < nSkin; i += 3, v++) {
			if ((part[v] !== 0 && part[v] !== 1) || !mine(skinP[i])) continue;
			const px = skinP[i] - C.x, py = skinP[i + 1] - C.y, pz = skinP[i + 2] - C.z;
			if (px * px + py * py + pz * pz > 0.095 * 0.095 || px * sx < -0.02) continue;
			const t = px * d.x + py * d.y + pz * d.z; if (t < -0.015) continue;
			const a = px * f0.x + py * f0.y + pz * f0.z, b = px * s0.x + py * s0.y + pz * s0.z;
			e = Math.max(e, Math.sqrt((t / 0.75) ** 2 + (a / fb) ** 2 + b * b));
		}
		const Rp = Math.min(0.085 * kH, Math.max(0.05, e)) + 0.022, Rd = Rp * 0.75;
		const inA = thetaOf(d, V3(-sx, 0, 0));
		const capLo = (th) => -Rd * 0.55 + Rd * 0.62 * Math.max(0, Math.cos(angGap(th, inA))) ** 2;
		const cap = fitTube({
			o: C, axis: d, t0: -Rd * 0.6, t1: Rd, dt: 0.0065, seg: 56, span: (th) => [capLo(th), Rd],
			floor: (t, th) => { const k = Math.sqrt(Math.max(0, 1 - (t / Rd) ** 2)), c0 = Math.cos(th), s1 = Math.sin(th); return k / Math.sqrt((c0 / (Rp * fb)) ** 2 + (s1 / Rp) ** 2); },
			skin: () => false, smooth: 0, wall: 0, minR: 0.0003, closeB: 0.001, col: c, thick: TH, rim: 0.0015,
			// (its inner side, toward the neck, rides the collarbone more than the arm, so it does not
			// swing into the backplate as the arm swings)
			bone: (t, th) => { const m = Math.max(0, Math.cos(angGap(th, inA))) ** 2; return [['shoulder01.' + sd, 0.4 + 0.45 * m], [ub, 0.6 - 0.45 * m]]; },
		});
		if (cap) { const pts = edgeRun(cap, 0, Math.PI * 2, (th) => capLo(th) + 0.003, 56); pts.pop(); sweep(pts.map((S2) => ({ p: S2.p.clone().addScaledVector(S2.n, 0.0016), n: S2.n, bone: S2.bone })), roundProf(0.0045, 8), c, ARMOUR, 0, 1, true); }
		// (the lames, measured round the arm, each lapping over the next)
		const gA = limbGirth(ub, 1, 0.08, 0.16).skinR;
		for (let k = 0; k < 3; k++) {
			const tk = 0.035 + k * 0.032, w = 1.5 - k * 0.12;
			const L = fitTube({
				o: S, axis: ax, t0: tk - 0.01, t1: tk + 0.05, dt: 0.0065, seg: 40, arc: [outA - w, outA + w], skin: () => false, smooth: 0, wall: 0, minR: 0.001,
				span: (th) => { const u = (angGap(th, outA) / w) ** 2; return [tk + 0.006 * u, tk + 0.042 - 0.012 * u]; },
				floor: (t) => gA + 0.034 - k * 0.0065 + 0.08 * (t - tk), col: c, thick: TH, bone: () => [['shoulder01.' + sd, 0.3 - k * 0.1], [ub, 0.7 + k * 0.1]],
			});
			if (L) for (const s2 of [1, -1]) rivet(L.at(tk + 0.02, outA + s2 * (w - 0.16), 0.0004), 0.0034);
		}
		// (the rerebrace: a tube round the arm's own flesh, measured from the arm alone so the
		// armpit and the side of the body under it are not taken in (they swell it into a flap
		// that swings into the breastplate when the arm hangs), close on the side toward the
		// body and a little fuller outside, the sleeve pressed in under it)
		const nearArm = (x, y, z) => { const dx = x - S.x, dy = y - S.y, dz = z - S.z, t = dx * ax.x + dy * ax.y + dz * ax.z; return Math.hypot(dx - ax.x * t, dy - ax.y * t, dz - ax.z * t) < 0.075 * kH; };
		const uaM = fitTube({ o: S, axis: ax, t0: 0.1, t1: len - 0.02, dt: 0.01, seg: 28, smooth: 10, give: 0, wall: 0, draw: false, bone: () => ub, skin: (v, x, y, z) => part[v] === 1 && Math.sign(x) === sx && nearArm(x, y, z) });
		const rere = uaM && fitTube({
			o: S, axis: ax, t0: 0.12, t1: len - 0.04, dt: 0.01, col: c, seg: 28, thick: TH, skin: () => false, smooth: 0, wall: 0, minR: 0.001,
			floor: (t, th) => uaM.rad(t, th) + 0.005 + 0.009 * Math.max(0, Math.cos(angGap(th, outA))) + 0.006 * Math.max(0, (t - (len - 0.1)) / 0.06),
			lift: (t) => ({ seam: Math.abs(t - (len - 0.1)) < 0.003 ? 0.7 : 0 }),
			bone: () => ub,
		});
		rere?.press((x, y, z, slot, limb) => limb === 1 && Math.sign(x) === sx);
	}
	return armR;
}
