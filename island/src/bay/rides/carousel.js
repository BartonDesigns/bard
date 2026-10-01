// The Looff Carousel (1911, Charles I. D. Looff): three rows of hand-carved horses under a
// crown of mirrors, painted panels and bulbs, the outer row standing to reach the brass
// ring arm, the inner rows jumping on their brass poles; two chariots for those who would
// rather sit. The 1894 Ruth band organ plays a waltz beside it. Ridden, you take an outer
// horse; each time round, the ring arm comes by: grab a ring, and now and then it is brass.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DECK, merger, bulbs, paint, rng } from './kit.js';

const PLAT = DECK + 0.45, CROWN = DECK + 4.7, RIM = 8.9;
// the bays of the house left open, its doorways (0 and 15 either side of the boarding place)
const DOORS = new Set([15, 0, 4, 8, 11]);
const ROWS = [[7.7, 22, false], [6.5, 18, true], [5.3, 14, true]];      // radius, horses, jumpers
const COATS = [0xf4efe4, 0xf2ead8, 0xe9e2d2, 0x7a4a2a, 0x3b2a20, 0xd9c7a0, 0xf6f3ee, 0x9a6b44, 0x202020, 0xeeeeee];
const TRAPS = [0xc8323a, 0x2656a8, 0x2e8b57, 0xe8a030, 0x7a3c9a, 0x1e8c8c, 0xd85a8a];

// one horse, jumping: coat (tinted per horse), trappings (tinted), and its gilding
function horseGeometry() {
	const coat = [], trap = [], gold = [];
	const tone = (g, k) => { const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(k); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
	const put = (list, g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, k = 1) => { g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); if (g.index) g = g.toNonIndexed(); list.push(list === coat ? tone(g, k) : g); };
	const limb = (list, a, b, r0, r1, k = 1) => {
		const g = new THREE.CylinderGeometry(r1, r0, 1, 7);
		const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
		g.scale(1, L, 1);
		g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
		g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
		list.push(list === coat ? tone(g.toNonIndexed(), k) : g.toNonIndexed());
	};
	const sph = () => new THREE.SphereGeometry(1, 14, 10);
	put(coat, sph(), 0, -0.24, 0, 0, 0, 0, 0.25, 0.29, 0.62);
	put(coat, sph(), 0, -0.14, 0.44, -0.3, 0, 0, 0.23, 0.27, 0.3);
	put(coat, sph(), 0, -0.2, -0.44, 0.2, 0, 0, 0.25, 0.27, 0.31);
	limb(coat, [0, -0.08, 0.55], [0, 0.4, 0.82], 0.17, 0.11);
	put(coat, sph(), 0, 0.46, 0.97, 0.75, 0, 0, 0.1, 0.13, 0.26);
	put(coat, sph(), 0, 0.3, 1.1, 0.75, 0, 0, 0.08, 0.09, 0.12);
	for (const sx of [-1, 1]) {
		put(coat, new THREE.ConeGeometry(0.035, 0.12, 5), sx * 0.05, 0.63, 0.86, -0.3);
		// the jump: forelegs tucked, hind legs stretched back
		limb(coat, [sx * 0.12, -0.34, 0.47], [sx * 0.13, -0.66, 0.62], 0.06, 0.045);
		limb(coat, [sx * 0.13, -0.66, 0.62], [sx * 0.12, -0.6, 0.86], 0.045, 0.035);
		limb(coat, [sx * 0.13, -0.34, -0.46], [sx * 0.14, -0.7, -0.62], 0.075, 0.05);
		limb(coat, [sx * 0.14, -0.7, -0.62], [sx * 0.13, -0.96, -0.86], 0.045, 0.035);
		put(coat, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 7), sx * 0.12, -0.61, 0.9, 1.3, 0, 0, 1, 1, 1, 0.18);
		put(coat, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 7), sx * 0.13, -0.99, -0.88, -0.9, 0, 0, 1, 1, 1, 0.18);
	}
	// mane and tail, a darker lock
	put(coat, new THREE.BoxGeometry(0.05, 0.12, 0.62), 0, 0.28, 0.7, -1.0, 0, 0, 1, 1, 1, 0.4);
	limb(coat, [0, -0.14, -0.72], [0, -0.52, -1.0], 0.07, 0.02, 0.4);
	// the saddle, its blanket, the breast collar and the bridle
	put(trap, new THREE.BoxGeometry(0.38, 0.07, 0.42), 0, 0.02, -0.02);
	put(trap, new THREE.CylinderGeometry(0.3, 0.3, 0.52, 14, 1, true, -Math.PI / 2, Math.PI), 0, -0.08, -0.02, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1);
	put(trap, new THREE.TorusGeometry(0.25, 0.03, 5, 14, Math.PI), 0, -0.16, 0.5, -1.2, 0, Math.PI);
	put(trap, new THREE.TorusGeometry(0.11, 0.018, 4, 10), 0, 0.42, 1.0, 0.8);
	put(trap, new THREE.BoxGeometry(0.1, 0.03, 0.2), 0, 0.1, 0.18, 0.2);
	// gilding: the jewels on the collar, the stirrups, the rosettes
	for (let i = -2; i <= 2; i++) put(gold, new THREE.SphereGeometry(0.035, 6, 4), Math.sin(i * 0.5) * 0.24, -0.16 - Math.cos(i * 0.5) * 0.08 + 0.08, 0.64 - Math.abs(i) * 0.03);
	for (const sx of [-1, 1]) { put(gold, new THREE.TorusGeometry(0.05, 0.012, 4, 8), sx * 0.3, -0.34, 0, 0, Math.PI / 2); put(gold, new THREE.SphereGeometry(0.03, 6, 4), sx * 0.1, 0.48, 1.02); }
	const clean = (list) => mergeGeometries(list.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.color) tone(g, 1); return g; }));
	return { coat: clean(coat), trap: clean(trap), gold: clean(gold) };
}
// the crown's painted band: panels of scenes between gilt frames, round mirrors between
function crownTexture() {
	const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 96;
	const g = cv.getContext('2d');
	const panels = 12, w = 1024 / panels;
	for (let i = 0; i < panels; i++) {
		const x = i * w;
		g.fillStyle = '#c9a449'; g.fillRect(x, 0, w, 96);
		const gr = g.createLinearGradient(0, 10, 0, 86); gr.addColorStop(0, ['#6fa9d8', '#e0a070', '#88c0a0'][i % 3]); gr.addColorStop(1, '#f4e4c0');
		g.fillStyle = gr; g.fillRect(x + 22, 12, w - 44, 72);
		g.fillStyle = 'rgba(40,90,50,0.8)'; g.beginPath(); g.moveTo(x + 22, 84); g.quadraticCurveTo(x + w / 2, 50 + (i % 3) * 8, x + w - 22, 84); g.fill();
		g.fillStyle = '#d8dde2'; g.beginPath(); g.arc(x + 11, 48, 8, 0, Math.PI * 2); g.fill();
		g.strokeStyle = '#8a6a20'; g.lineWidth = 3; g.strokeRect(x + 22, 12, w - 44, 72);
	}
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
	return t;
}

// a waltz for the band organ: melody [midi, beats], bass and chords by the bar
const MEL = [[76, 2], [79, 1], [84, 2], [83, 1], [81, 2], [79, 1], [77, 3], [74, 2], [77, 1], [83, 2], [81, 1], [79, 2], [76, 1], [72, 3],
	[77, 2], [81, 1], [84, 2], [81, 1], [79, 2], [76, 1], [79, 3], [77, 1], [76, 1], [74, 1], [71, 2], [74, 1], [72, 1], [76, 1], [79, 1], [84, 3]];
const HARM = ['C', 'C', 'G', 'G', 'G', 'G', 'C', 'C', 'F', 'F', 'C', 'C', 'G', 'G', 'C', 'C'];
const CH = { C: [48, [64, 67]], G: [43, [65, 71]], F: [41, [65, 69]] };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createCarousel({ group, sound, isPhone, at: [U, V] }) {
	const root = new THREE.Group();
	root.name = 'looff-carousel';
	root.position.set(U, 0, V);
	group.add(root);
	const r = rng(1911);
	// ---------- the building: sixteen posts, arches, a roof with its lantern ----------
	const Mg = merger(), lights = bulbs(), BR = 12.4;
	Mg.cyl(BR + 0.3, BR + 0.3, 0.12, 'plank', 0, DECK + 0.06, 0, 32);
	for (let i = 0; i < 16; i++) {
		const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2;
		const x = Math.sin(a) * BR, z = Math.cos(a) * BR, x2 = Math.sin(b) * BR, z2 = Math.cos(b) * BR;
		Mg.box(0.45, 5.6, 0.45, 'cream', x, DECK + 2.8, z, 0, a);
		// the arch between: a beam and its curve in a string of bulbs
		Mg.box(Math.hypot(x2 - x, z2 - z), 0.7, 0.3, 'cream', (x + x2) / 2, DECK + 5.25, (z + z2) / 2, 0, (a + b) / 2);
		for (let k = 0; k <= 8; k++) { const t = k / 8, h = Math.sin(t * Math.PI) * 0.9; lights.add(x + (x2 - x) * t, DECK + 3.9 + h, z + (z2 - z) * t); }
	}
	// its walls between the posts, windows in them, but for the doorways (one each side of the
	// boarding place, three more round it); a ceiling under the roof; the walls kept to
	const walls = [];
	for (let i = 0; i < 16; i++) {
		if (DOORS.has(i)) continue;
		const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2, x = Math.sin(a) * BR, z = Math.cos(a) * BR, x2 = Math.sin(b) * BR, z2 = Math.cos(b) * BR, L = Math.hypot(x2 - x, z2 - z), m = (a + b) / 2;
		Mg.box(L - 0.4, 4.9, 0.25, 'cream', (x + x2) / 2, DECK + 2.45, (z + z2) / 2, 0, m);
		Mg.box(L - 1.6, 1.8, 0.3, 'glass', (x + x2) / 2, DECK + 2.5, (z + z2) / 2, 0, m);
		for (let t = 0.1; t < 0.95; t += 0.09) walls.push([U + x + (x2 - x) * t, V + z + (z2 - z) * t, 0.25]);
	}
	for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; walls.push([U + Math.sin(a) * BR, V + Math.cos(a) * BR, 0.3]); }
	Mg.geo(new THREE.RingGeometry(2.4, BR + 0.3, 32).rotateX(Math.PI / 2), 'cream', 0, DECK + 5.6, 0);
	const roof = new THREE.ConeGeometry(BR + 1.4, 4.2, 16, 1, true);
	Mg.geo(roof, 'tile', 0, DECK + 7.7, 0, 0, Math.PI / 16);
	Mg.cyl(2.0, 2.0, 1.6, 'cream', 0, DECK + 10.4, 0, 16).geo(new THREE.ConeGeometry(2.5, 1.6, 16), 'tile', 0, DECK + 12.0, 0);
	Mg.cyl(0.08, 0.08, 1.6, 'gold', 0, DECK + 13.4, 0, 6);
	// the band organ against the wall: its gilt front, the pipes, the drum
	{
		const a = Math.PI * 0.8, ox = Math.sin(a) * (BR - 1.4), oz = Math.cos(a) * (BR - 1.4);
		Mg.box(3.4, 2.9, 1.1, 'darkred', ox, DECK + 1.45, oz, 0, a);
		for (let k = 0; k < 11; k++) { const t = (k - 5) / 5, px = ox + Math.cos(a) * t * 1.3, pz = oz - Math.sin(a) * t * 1.3; const ph = 0.9 + (1 - Math.abs(t)) * 0.9; Mg.cyl(0.06, 0.06, ph, 'gold', px + Math.sin(a) * 0.58, DECK + 1.5 + ph / 2, pz + Math.cos(a) * 0.58, 8); }
		Mg.box(3.6, 0.35, 1.2, 'gold', ox, DECK + 3.05, oz, 0, a);
		Mg.cyl(0.4, 0.4, 0.3, 'cream', ox + Math.sin(a) * 0.62, DECK + 0.8, oz + Math.cos(a) * 0.62, 16, Math.PI / 2, a, 0);
	}
	// the brass ring arm: a post outside the outer row, the arm reaching in over the riders
	const RING_A = Math.PI * 1.35;
	{
		const x = Math.sin(RING_A) * 10.2, z = Math.cos(RING_A) * 10.2, xi = Math.sin(RING_A) * 8.7, zi = Math.cos(RING_A) * 8.7;
		Mg.cyl(0.1, 0.12, 3.6, 'darkred', x, DECK + 1.8, z, 8);
		Mg.rod([x, DECK + 3.4, z], [xi, DECK + 2.9, zi], 0.05, 'gold');
		Mg.cyl(0.09, 0.09, 0.35, 'brass', xi, DECK + 2.75, zi, 8);
	}
	Mg.done(root, { shadow: !isPhone });

	// ---------- the machine: turning platform, centre column, crown ----------
	const spin = new THREE.Group();
	root.add(spin);
	const Sp = merger();
	Sp.cyl(RIM - 0.4, RIM - 0.4, 0.35, 'plank', 0, PLAT - 0.17, 0, 48);
	Sp.cyl(RIM - 0.35, RIM - 0.35, 0.12, 'gold', 0, PLAT - 0.3, 0, 48);
	Sp.cyl(1.7, 1.7, CROWN - PLAT, 'darkred', 0, (PLAT + CROWN) / 2, 0, 16);
	for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; Sp.box(0.62, 1.1, 0.04, 'mirror', Math.sin(a) * 1.72, PLAT + 2.2, Math.cos(a) * 1.72, 0, a); Sp.box(0.62, 0.9, 0.04, 'gold', Math.sin(a) * 1.72, PLAT + 0.8, Math.cos(a) * 1.72, 0, a); }
	// the crown: a shallow cone from the column out to the rim, its band of panels
	const cone = new THREE.CylinderGeometry(1.8, RIM, 1.1, 36, 1, true);
	Sp.geo(cone, 'cream', 0, CROWN + 0.55, 0);
	for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; Sp.rod([Math.sin(a) * 1.8, CROWN + 0.2, Math.cos(a) * 1.8], [Math.sin(a) * RIM, CROWN - 0.05, Math.cos(a) * RIM], 0.06, 'gold'); }
	const paints = { band: new THREE.MeshStandardMaterial({ map: crownTexture(), roughness: 0.5, side: THREE.DoubleSide }) };
	Sp.geo(new THREE.CylinderGeometry(RIM, RIM, 0.95, 48, 1, true), 'band', 0, CROWN - 0.25, 0);
	for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; lights.add(Math.sin(a) * (RIM + 0.05), CROWN + 0.26, Math.cos(a) * (RIM + 0.05)); }
	// (the crown's bulbs turn with it: a second set on the spinning group)
	const turning = bulbs();
	for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; turning.add(Math.sin(a) * (RIM + 0.06), CROWN - 0.76, Math.cos(a) * (RIM + 0.06)); }
	for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; for (let k = 1; k <= 4; k++) { const rr = 1.8 + (RIM - 1.8) * k / 4; turning.add(Math.sin(a) * rr, CROWN + 1.05 - k / 4 * 0.95, Math.cos(a) * rr); } }
	// the horses: where each stands, its pole, and the two chariots on the inner row
	const H = [];
	for (const [rad, count, jump] of ROWS) for (let i = 0; i < count; i++) {
		const a = (i + (rad < 6 ? 0.5 : 0)) / count * Math.PI * 2;
		const chariot = rad < 6 && (i === 3 || i === 10);
		H.push({ a, rad, jump, chariot, ph: r() * Math.PI * 2, coat: COATS[Math.floor(r() * COATS.length)], trap: TRAPS[Math.floor(r() * TRAPS.length)] });
		Sp.cyl(0.035, 0.035, CROWN - PLAT, 'brass', Math.sin(a) * rad, (PLAT + CROWN) / 2, Math.cos(a) * rad, 8);
		if (chariot) {
			const cx = Math.sin(a) * rad, cz = Math.cos(a) * rad;
			Sp.box(1.2, 0.8, 1.6, 'darkred', cx, PLAT + 0.4, cz, 0, a + Math.PI / 2).box(1.3, 0.2, 1.7, 'gold', cx, PLAT + 0.9, cz, 0, a + Math.PI / 2).box(1.0, 0.12, 0.5, 'seat', cx, PLAT + 0.55, cz, 0, a + Math.PI / 2);
		}
	}
	Sp.done(spin, { shadow: !isPhone, paints });
	turning.done(spin, 0.7);
	const lit = lights.done(root, 0.8);
	const HG = horseGeometry();
	const vc = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.35 });
	const horses = H.filter((h) => !h.chariot);
	const coatM = new THREE.InstancedMesh(HG.coat, vc, horses.length), trapM = new THREE.InstancedMesh(HG.trap, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), horses.length), goldM = new THREE.InstancedMesh(HG.gold, paint('gold'), horses.length);
	const col = new THREE.Color();
	horses.forEach((h, i) => { coatM.setColorAt(i, col.set(h.coat)); trapM.setColorAt(i, col.set(h.trap)); });
	for (const m of [coatM, trapM, goldM]) { m.castShadow = !isPhone; spin.add(m); m.frustumCulled = false; }
	const hm = new THREE.Matrix4(), hq = new THREE.Quaternion(), hs = new THREE.Vector3(1, 1, 1), hp = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
	const lift = (h, t) => h.jump ? 0.22 + Math.sin(t * 1.6 + h.ph) * 0.2 : 0.1;
	function placeHorses(t) {
		horses.forEach((h, i) => {
			hp.set(Math.sin(h.a) * h.rad, PLAT + 1.05 + lift(h, t), Math.cos(h.a) * h.rad);
			hq.setFromAxisAngle(Y, h.a + Math.PI / 2);
			hm.compose(hp, hq, hs);
			coatM.setMatrixAt(i, hm); trapM.setMatrixAt(i, hm); goldM.setMatrixAt(i, hm);
		});
		coatM.instanceMatrix.needsUpdate = trapM.instanceMatrix.needsUpdate = goldM.instanceMatrix.needsUpdate = true;
	}

	// ---------- turning and playing ----------
	const S = { w: 0, ang: 0, run: true, timer: 100, rider: -1, done: false, rings: 0, brass: 0, ringReady: true, next: 0, beat: 0, lastLap: 0 };
	const OMEGA = Math.PI * 2 / 12;                // once round every twelve seconds
	function drive(dt) {
		S.timer -= dt;
		if (S.timer <= 0) {
			if (S.rider >= 0 && S.run) { S.run = false; S.timer = 1e9; }
			else if (S.rider < 0) { S.run = !S.run; S.timer = S.run ? 150 : 30; }
		}
		S.w += ((S.run ? OMEGA : 0) - S.w) * Math.min(1, dt * 0.35);
		if (S.rider >= 0 && !S.run && S.w < 0.01) S.done = true;
		S.ang += S.w * dt;
		spin.rotation.y = S.ang;
	}
	// the organ: a beat at a time, scheduled a moment ahead; heard from about the building
	function organ(level) {
		if (level < 0.02 || S.w < OMEGA * 0.3) { S.next = 0; return; }
		const now = sound.now();
		if (!now) return;
		if (!S.next || S.next < now) S.next = now + 0.05;
		const BEAT = 0.38;
		while (S.next < now + 0.25) {
			const at = S.next - now, bar = Math.floor(S.beat / 3) % 16, b = S.beat % 3;
			const [bass, chord] = CH[HARM[bar]];
			if (b === 0) { sound.pipe(hz(bass), at, BEAT * 0.9, 0.07 * level, 'bass'); sound.click(0.1 * level, 120, 1, 0.12, at); }
			else { for (const m of chord) sound.pipe(hz(m), at, BEAT * 0.6, 0.022 * level); sound.click(0.035 * level, 5200, 2, 0.05, at); }
			// the melody: which note sounds on this beat
			let acc = 0, idx = 0;
			const pos = S.beat % 48;
			while (idx < MEL.length && acc + MEL[idx][1] <= pos) { acc += MEL[idx][1]; idx++; }
			if (idx < MEL.length && acc === pos) {
				const [m, len] = MEL[idx];
				sound.pipe(hz(m), at, BEAT * len * 0.92, 0.05 * level);
				if (bar % 4 === 2) sound.pipe(hz(m + 12), at, BEAT * len, 0.03 * level, 'bell');
			}
			S.beat++;
			S.next += BEAT;
		}
	}
	// ---------- riding: an outer-row horse by the gate ----------
	const eye = new THREE.Vector3(), cq = new THREE.Quaternion(), tq = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), m4 = new THREE.Matrix4();
	let camInit = false, mine = null;
	function begin() {
		// the horse nearest the gate (on the midway side), once it stops
		let best = null, bd = 1e9;
		for (const h of horses) if (h.rad > 7) { const a = h.a + S.ang, d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (d < bd) { bd = d; best = h; } }
		mine = best; S.rider = 0; S.run = true; S.timer = 150; S.done = false; S.rings = 0; S.brass = 0; camInit = false;
		return true;
	}
	function pose(dt, t, out) {
		drive(dt); placeHorses(t);
		const h = mine, a = h.a + S.ang;
		hp.set(Math.sin(a) * h.rad, PLAT + 1.05 + lift(h, t), Math.cos(a) * h.rad);
		// sat in the saddle behind the pole, looking ahead round the ring and a little in
		const fwd = a + Math.PI / 2;
		eye.set(hp.x - Math.sin(fwd) * 0.2, hp.y + 0.82, hp.z - Math.cos(fwd) * 0.2).applyMatrix4(root.matrix);
		out.pos.copy(eye);
		tq.setFromAxisAngle(Y, fwd + Math.PI + 0.12).multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.1));
		if (!camInit) { cq.copy(tq); camInit = true; }
		cq.slerp(tq, Math.min(1, dt * 8));
		out.quat.copy(cq);
		out.fov = 72;
		// the ring arm comes by once a turn
		const d = Math.atan2(Math.sin(a - RING_A), Math.cos(a - RING_A));
		S.ringNear = d > -0.18 && d < 0.05 && S.w > OMEGA * 0.5;
		if (d > 0.3) S.ringReady = true;
		return !S.done;
	}
	function grab() {
		if (!S.ringNear || !S.ringReady) return null;
		S.ringReady = false; S.rings++;
		const brass = Math.random() < 0.12;
		if (brass) S.brass++;
		sound.click(0.3, 3000, 12, 0.3);
		return brass ? 'The brass ring!' : 'A steel ring';
	}
	const riders = {
		count: horses.length,
		at(i, m) {
			const h = horses[i];
			if (h === mine && S.rider >= 0) return null;
			if (i % 3 === 1) return null;
			const a = h.a + S.ang;
			m.makeRotationY(a + Math.PI / 2).setPosition(Math.sin(a) * h.rad, PLAT + 1.05 + lift(h, performance.now() / 1000) - 0.82, Math.cos(a) * h.rad);
			return m.premultiply(root.matrix).multiply(m4.makeTranslation(0, 0, -0.18));
		},
		sit: 0.8, pose: 'lap',
	};
	return {
		id: 'carousel', name: 'Looff Carousel', icon: 'carousel', root,
		blurb: '1911 hand-carved horses, the band organ, and the brass ring',
		board: { u: U, v: V + BR - 0.5, r: 3.5 }, exit: { u: U + 1.5, v: V + BR + 1.2, yaw: Math.PI },
		lights: lit,
		solid: [], round: [[U, V, RIM - 0.2], ...walls],
		update(dt, t, info) {
			if (S.rider < 0) { drive(dt); if (info.near < 160) placeHorses(t); }
			organ(S.rider >= 0 ? 1 : Math.max(0, 1 - info.near / 90) ** 1.5);
		},
		begin, pose, riders,
		status() { return S.ringNear && S.ringReady ? 'The ring arm! Grab a ring' : `Rings ${S.rings}${S.brass ? ` · brass ${S.brass}` : ''}`; },
		action: { label: 'Grab the ring', key: ' ', ready: () => S.ringNear && S.ringReady, run: grab },
		end() { S.rider = -1; mine = null; S.timer = 60; S.run = true; S.done = false; },
		dispose() { root.traverse((o) => o.geometry?.dispose()); },
	};
}
