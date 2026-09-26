// The village's fishing boat, built like one: a hull lofted through stations from a
// broad transom to a fine raked bow, a V bottom (deadrise) that flattens aft, topsides
// flaring out, the sheer rising toward the bow; antifouling red below the waterline, a
// boot stripe, a rub rail; a real deck inside bulwarks with a cap rail; a wheelhouse with
// framed windows and a door aft; a mast with a boom, fenders, cleats, a life ring,
// a net and buoys. Bow toward -z, the stern at +z (as boat.js sails it). About 8 m long.

import * as THREE from 'three';

const L0 = -4.6, L1 = 3.3;                 // bow tip, transom
const NS = 22, NC = 9;                      // stations along, points round each half-section

// the hull at station t (0 bow .. 1 stern): half-beam at the sheer and chine, keel depth,
// sheer height
function station(t) {
	const bowK = Math.pow(Math.min(1, t / 0.55), 0.6);                               // the bow's fine entry
	const beam = 1.52 * bowK * (1 - Math.pow(Math.max(0, t - 0.85) / 0.15, 2) * 0.06);
	const chine = beam * (0.78 + 0.1 * t);
	const keel = -0.55 + 0.15 * Math.pow(1 - t, 2) + 0.05 * t;                     // the forefoot rises
	const sheer = 1.55 + 0.55 * Math.pow(1 - t, 2.2);                             // higher at the bow
	const dead = 0.42 * (1 - t) + 0.14;                                            // deadrise, sharper forward
	return { beam, chine, keel, sheer, dead, z: L0 + (L1 - L0) * t };
}
// a half-section's points from the keel up to the sheer (x >= 0)
function section(t) {
	const S = station(t), pts = [];
	for (let i = 0; i <= NC; i++) {
		const u = i / NC;
		let x, y;
		if (u < 0.45) { x = S.chine * u / 0.45; y = S.keel + S.dead * x; }             // the bottom: straight out at the deadrise
		else { const k = (u - 0.45) / 0.55, e = Math.sin(k * Math.PI / 2); x = S.chine + (S.beam - S.chine) * e; y = (S.keel + S.dead * S.chine) + (S.sheer - (S.keel + S.dead * S.chine)) * k; }
		pts.push([x, y]);
	}
	return { pts, S };
}

export function buildBoat(glassMat, woodMat) {
	const boat = new THREE.Group();
	// ---- the hull shell: both halves, painted by height (bottom red, boot stripe, white) ----
	const P = [], C = [], I = [];
	const red = [0.48, 0.12, 0.1], white = [0.93, 0.92, 0.88], stripe = [0.12, 0.2, 0.34], wl = -0.05;
	const colAt = (y, sheer) => (y < wl ? red : y < wl + 0.16 ? stripe : y > sheer - 0.22 ? [0.2, 0.3, 0.45] : white);
	const rows = [];
	for (let s = 0; s <= NS; s++) {
		const t = s / NS, { pts, S } = section(t), row = [];
		for (const side of [1, -1]) for (let i = side > 0 ? 0 : 1; i <= NC; i++) {
			const [x, y] = pts[i];
			row.push([x * side, y, S.z, colAt(y, S.sheer), side, i]);
		}
		rows.push(row);
	}
	// index rows: each row is [right keel..sheer, left keel+1..sheer]; build quads per side
	const idx = (s, side, i) => s * (2 * NC + 1) + (side > 0 ? i : NC + i);
	for (const row of rows) for (const [x, y, z, c] of row) { P.push(x, y, z); C.push(...c); }
	for (let s = 0; s < NS; s++) for (let i = 0; i < NC; i++) {
		// right side
		let a = idx(s, 1, i), b = idx(s, 1, i + 1), c = idx(s + 1, 1, i), d = idx(s + 1, 1, i + 1);
		I.push(a, c, b, b, c, d);
		// left side (point i on the left is index NC + i for i >= 1; i = 0 shares the keel)
		a = i === 0 ? idx(s, 1, 0) : idx(s, -1, i); b = idx(s, -1, i + 1); c = i === 0 ? idx(s + 1, 1, 0) : idx(s + 1, -1, i); d = idx(s + 1, -1, i + 1);
		I.push(a, b, c, b, d, c);
	}
	const shell = new THREE.BufferGeometry();
	shell.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	shell.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	shell.setIndex(I);
	shell.computeVertexNormals();
	const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide });
	boat.add(new THREE.Mesh(shell, hullMat));
	// the transom: the last section closed flat
	{
		const { pts, S } = section(1), sh = new THREE.Shape();
		sh.moveTo(0, pts[0][1]);
		for (const [x, y] of pts) sh.lineTo(x, y);
		for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(-pts[i][0], pts[i][1]);
		const tg = new THREE.ShapeGeometry(sh); tg.translate(0, 0, S.z);
		const tr = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xeeece6, roughness: 0.5, side: THREE.DoubleSide }));
		boat.add(tr);
		// her name on it
		const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
		const g = cv.getContext('2d'); g.fillStyle = '#1d2f4a'; g.font = 'bold italic 34px Georgia, serif'; g.textAlign = 'center'; g.fillText('ANNABEL', 128, 30); g.font = '16px Georgia, serif'; g.fillText('HALF MOON BAY', 128, 54);
		const nt = new THREE.CanvasTexture(cv); nt.colorSpace = THREE.SRGBColorSpace;
		const name = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: nt, transparent: true }));
		name.position.set(0, 0.75, S.z + 0.01); boat.add(name);
	}
	// ---- the deck, bulwark tops and rub rail, following the sheer ----
	const deckY = (t) => station(t).sheer - 0.55;
	const deckShape = new THREE.Shape(), cap = [], rub = [];
	for (let s = 0; s <= NS; s++) { const t = s / NS, S = station(t); deckShape[s ? 'lineTo' : 'moveTo'](S.beam - 0.12, S.z); }
	for (let s = NS; s >= 0; s--) { const t = s / NS, S = station(t); deckShape.lineTo(-(S.beam - 0.12), S.z); }
	const dg = new THREE.ShapeGeometry(deckShape, 1);
	// lay it flat and lift each vertex to the deck's height where it is
	dg.rotateX(Math.PI / 2);
	{ const p = dg.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), t = (z - L0) / (L1 - L0); p.setY(i, deckY(Math.max(0, Math.min(1, t)))); } dg.computeVertexNormals(); }
	const deckTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#b89a73'; g.fillRect(0, 0, 64, 256); for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(60,40,20,${0.25 + (i % 3) * 0.1})`; g.fillRect(i * 8, 0, 1, 256); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,55,30,0.18)'; g.fillRect(Math.random() * 64, Math.random() * 256, 1, 20 + Math.random() * 40); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
	{ const p = dg.attributes.position, uv = []; for (let i = 0; i < p.count; i++) uv.push(p.getX(i) * 1.2, p.getZ(i) * 0.4); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }
	boat.add(new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.8, side: THREE.DoubleSide })));
	// the bulwark's inner face, the cap rail on it, the rub rail outside
	for (const side of [1, -1]) {
		const inner = [], cp = [], rb = [];
		for (let s = 0; s <= NS; s++) { const t = s / NS, S = station(t); inner.push(new THREE.Vector3(side * (S.beam - 0.08), S.sheer, S.z)); cp.push(new THREE.Vector3(side * (S.beam - 0.02), S.sheer + 0.04, S.z)); rb.push(new THREE.Vector3(side * (S.beam + 0.04), S.sheer - 0.28, S.z)); }
		const wallP = [], wallI = [];
		for (let s = 0; s <= NS; s++) { const t = s / NS, v = inner[s]; wallP.push(v.x, v.y, v.z, v.x, deckY(t), v.z); if (s) { const a = (s - 1) * 2; wallI.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
		const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wallP, 3)); wg.setIndex(wallI); wg.computeVertexNormals();
		boat.add(new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.6, side: THREE.DoubleSide })));
		cap.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 40, 0.07, 6), woodMat));
		rub.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rb), 40, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 })));
	}
	for (const m of [...cap, ...rub]) boat.add(m);
	// ---- the wheelhouse ----
	const wh = new THREE.Group(), whZ = -0.6, whY = deckY((whZ - L0) / (L1 - L0));
	const whMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.55 }), frame = new THREE.MeshStandardMaterial({ color: 0x223a52, roughness: 0.5 });
	const W = 1.9, D = 2.1, H = 1.95;
	const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); wh.add(o); return o; };
	// walls: a lower band, window posts, a header, so the windows are real openings
	add(new THREE.BoxGeometry(W, 0.95, D), whMat, 0, 0.475, 0);
	add(new THREE.BoxGeometry(W, 0.28, D), whMat, 0, H - 0.14, 0);
	for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, -D / 2]]) add(new THREE.BoxGeometry(0.1, H - 1.2, 0.1), whMat, x, 0.95 + (H - 1.23) / 2, z);
	// glass (the front raked back a little), framed
	const front = add(new THREE.PlaneGeometry(W - 0.12, H - 1.24), glassMat, 0, 0.95 + (H - 1.24) / 2, -D / 2 - 0.01); front.rotation.x = -0.12; front.rotation.y = Math.PI;
	for (const sx of [-1, 1]) { const g = add(new THREE.PlaneGeometry(D - 0.12, H - 1.24), glassMat, sx * (W / 2 + 0.01), 0.95 + (H - 1.24) / 2, 0); g.rotation.y = sx * Math.PI / 2; }
	add(new THREE.BoxGeometry(W, H - 1.23, 0.06), whMat, 0, 0.95 + (H - 1.23) / 2, D / 2);
	add(new THREE.BoxGeometry(0.66, 1.62, 0.05), frame, 0.45, 0.83, D / 2 + 0.04);                // the door
	add(new THREE.BoxGeometry(0.4, 0.3, 0.02), glassMat, 0.45, 1.3, D / 2 + 0.07);
	// the roof, overhanging, with a light and a whip antenna
	add(new THREE.BoxGeometry(W + 0.35, 0.1, D + 0.5), frame, 0, H + 0.05, -0.05);
	add(new THREE.BoxGeometry(W + 0.39, 0.05, D + 0.54), new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.5 }), 0, H + 0.12, -0.05);
	add(new THREE.CylinderGeometry(0.012, 0.02, 1.8, 5), frame, -0.7, H + 1.0, 0.4);
	add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe8b0, emissiveIntensity: 0.2 }), 0.5, H + 0.2, -0.7);
	wh.position.set(0, whY, whZ);
	boat.add(wh);
	// ---- mast and boom, gear ----
	const mastZ = -2.4, my = deckY((mastZ - L0) / (L1 - L0));
	const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.6, 10), woodMat); mast.position.set(0, my + 2.3, mastZ); boat.add(mast);
	const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.2, 8), woodMat); boom.rotation.x = Math.PI / 2 - 0.35; boom.position.set(0, my + 2.0, mastZ + 1.4); boat.add(boom);
	const stay = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, my + 4.5, mastZ), new THREE.Vector3(0, station(0.02).sheer, L0 + 0.25), new THREE.Vector3(0, my + 4.5, mastZ), new THREE.Vector3(0, my + 1.4, mastZ + 2.9)]);
	boat.add(new THREE.LineSegments(stay, new THREE.LineBasicMaterial({ color: 0x333333 })));
	const buoyM = new THREE.MeshStandardMaterial({ color: 0xe8541c, roughness: 0.5 }), fenderM = new THREE.MeshStandardMaterial({ color: 0x1c3552, roughness: 0.4 });
	for (const sx of [-1, 1]) for (const t of [0.35, 0.65]) {
		const S = station(t), f = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.35, 4, 10), fenderM);
		f.position.set(sx * (S.beam + 0.13), S.sheer - 0.55, S.z); boat.add(f);
	}
	for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), buoyM); const t = 0.86 + k * 0.03, S = station(t); b.position.set(-0.8 + k * 0.32, deckY(t) + 0.18, S.z - 0.2); boat.add(b); }
	// a coil of net on the aft deck
	const net = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 8, 20), new THREE.MeshStandardMaterial({ color: 0x3b6a4a, roughness: 0.95 })); net.rotation.x = Math.PI / 2; net.position.set(0.55, deckY(0.9) + 0.14, 2.3); boat.add(net);
	// a life ring on the wheelhouse back
	const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 20), new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5 })); ring.position.set(-0.45, whY + 1.3, whZ + D / 2 + 0.08); boat.add(ring);
	for (const cl of [[0.9, L1 - 0.35], [-0.9, L1 - 0.35], [0, L0 + 0.7]]) { const t = (cl[1] - L0) / (L1 - L0), c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.07), frame); c.position.set(cl[0], deckY(t) + 0.08, cl[1]); boat.add(c); }
	// bow rail
	{
		const pts = [];
		for (let s = 0; s <= 6; s++) { const t = s / 6 * 0.3, S = station(t); pts.push(new THREE.Vector3(S.beam - 0.1, S.sheer + 0.55, S.z)); }
		const left = pts.map((v) => new THREE.Vector3(-v.x, v.y, v.z)).reverse();
		const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...left, ...pts]), 30, 0.025, 6), new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9 }));
		boat.add(rail);
		for (const v of [...left, ...pts]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), rail.material); post.position.set(v.x, v.y - 0.27, v.z); boat.add(post); }
	}
	boat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
	return boat;
}
