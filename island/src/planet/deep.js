// The Deep Gate and the Deep below it. At the far end of a passage in the caves, beneath
// the summit, the way widens into a carved hall: old timbering at its mouth, lamps, worn
// steps, and five banded singing stones standing round a great stone seal in the floor.
// Strike one and the stones answer with a phrase of four notes; play it back and the seal
// grinds down and away. A rope goes down the shaft beneath into a cave with no bottom
// (deepfield.js), made a cube at a time as you come to it and let go behind you, its stone,
// light and air changing band by band as you go down. Waystones take you back up to the
// hall; the lift at the foot of the rope takes you down again to the deepest one you have
// touched. What you reached and what you restored is kept per world.
//
// The Deep hangs from the hall: its top is the foot of a 60 m shaft straight under the seal.
// Its rock is placed at depth y = -D in a frame of its own, and the whole of it is lifted
// 512 m at a time (shift) so that what is drawn and walked never goes more than about 600 m
// below the hall, however far down you are.

import * as THREE from 'three';
import { mulberry32, smoothstep, clamp } from '../noise.js';
import { meshChunk } from './cavenet.js';
import { rockMaterial, crystalMaterial, waterMaterial, lavaMaterial } from './cavemat.js';
import { BANDS, bandIndex, hueShift, makeDeepField, LM } from './deepfield.js';
import { ring, phrase, knock, createRipples } from './resonance.js';
import { soundBus } from '../world/soundbus.js';

const EYE = 1.68;
const CH = 24;
const STEP = 512, SHAFT = 60;
const STONE_DEG = [0, 1, 2, 4, 5];

// The gate's passage: a dead end dug on from the chamber nearest under the summit, sloping
// gently down and widening at its end into the hall. Added to the caves' plan (and its rock
// field made again) before anything is built from it, as the realm's dungeons are.
export function planDeep(island, plan, makeField) {
	if (!plan?.chambers?.length || !plan.field || !makeField) return null;
	const H = island.heightAt, pk = island.peak || { x: 0, z: 0 }, field = plan.field;
	const cands = plan.chambers.filter((c) => c.kind !== 'village').sort((a, b) => Math.hypot(a.x - pk.x, a.z - pk.z) - Math.hypot(b.x - pk.x, b.z - pk.z));
	for (const c of cands.slice(0, 8)) {
		const dPk = Math.hypot(pk.x - c.x, pk.z - c.z);
		// toward the summit; if already under it, up the steepest rise of the hill
		const e = 8, base = dPk > 30 ? Math.atan2(pk.z - c.z, pk.x - c.x) : Math.atan2(H(c.x, c.z + e) - H(c.x, c.z - e), H(c.x + e, c.z) - H(c.x - e, c.z));
		// as far on toward the summit as the rock allows, a mine's length at most
		const rim = Math.min(c.rx, c.rz) * 0.45, far = clamp(dPk - rim, 42, 170);
		for (const [off, len] of [[0, far], [0, far * 0.7], [0, 72], [0.4, 60], [-0.4, 60], [0.9, 50], [-0.9, 50], [1.5, 46], [-1.5, 46], [2.3, 46], [-2.3, 46], [Math.PI, 46]]) {
			if (len < 42) continue;
			const a = base + off, dx = Math.cos(a), dz = Math.sin(a);
			const n = Math.round(len / 3), pts = [];
			let ok = true;
			for (let i = 0; i <= n && ok; i++) {
				const u = i / n, along = rim + u * len, side = Math.sin(u * 5 + off * 3) * 2.2 * u * (1 - u) * 4;
				const x = c.x + dx * along - dz * side, z = c.z + dz * along + dx * side;
				const hall = smoothstep(0.74, 1, u), w = 2.6 + hall * 4.4, h = 3.9 + hall * 5.6;
				const y = c.fy - u * Math.min(len, 90) * 0.1;
				if (y < 3 || H(x, z) - (y + h) < 8) ok = false;
				// a dead end: nothing else of the caves near it once it has left its chamber
				if (along > rim + 12 && field.cave(x, y + h * 0.5, z) < w + 4) ok = false;
				pts.push({ x, y, z, w, h });
			}
			if (!ok) continue;
			const E = pts[n], P = pts[n - 1], ex = E.x - P.x, ez = E.z - P.z, el = Math.hypot(ex, ez) || 1;
			plan.tunnels.push({ pts, mouth: false, amp: 0.7, gate: true });
			plan.field = makeField({ chambers: plan.chambers, tunnels: plan.tunnels, shaft: plan.shaft, boulders: plan.boulders, H, n3: plan.n3, holes: plan.holes });
			return { x: E.x - ex / el * 0.5, z: E.z - ez / el * 0.5, y: E.y, dir: { x: ex / el, z: ez / el }, pts, chamber: c };
		}
	}
	return null;
}

export function createDeep(island, shared, scene, camera, profile, opts = {}) {
	const { plan, underworld: UW, isPhone = false, hint, player, mount, bodyKey } = opts;
	const L = UW?.lighting;
	if (!plan || !L || !UW.addGlow) return null;
	const gy = UW.floor(plan.x, plan.z, plan.y + 2) ?? plan.y, BASE = gy - SHAFT;
	const dx0 = plan.dir.x, dz0 = plan.dir.z, side = { x: -dz0, z: dx0 };
	// the Deep's way starts straight under the seal
	const F0 = makeDeepField(island.seed >>> 0, { cx: 0, cz: 0 }), p00 = F0.path(0);
	const F = makeDeepField(island.seed >>> 0, { cx: plan.x - p00.x, cz: plan.z - p00.z, isPhone, shaft: SHAFT });
	const uwFloor = (x, z, y = gy + 2) => UW.floor(x, z, y) ?? gy;
	// the way in, for the guide: the cave mouth nearest the hall
	const via = (UW.entrances || []).reduce((b, e) => (!b || Math.hypot(e.x - plan.x, e.z - plan.z) < Math.hypot(b.x - plan.x, b.z - plan.z) ? e : b), null);

	// ---------- what is kept ----------
	const key = 'crysis-deep-v1:' + (bodyKey || 'seed:' + (island.seed >>> 0));
	let saved = { v: 1, open: false, deepest: 0, ways: [], alcoves: {} };
	try { const raw = localStorage.getItem(key); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) saved = { ...saved, ...s, ways: Array.isArray(s.ways) ? s.ways : [], alcoves: s.alcoves && typeof s.alcoves === 'object' ? s.alcoves : {} }; } } catch { /* private mode: this visit only */ }
	let saveT = 0, dirty = false;
	const save = () => { dirty = false; try { localStorage.setItem(key, JSON.stringify(saved)); return true; } catch { return false; } };

	// ---------- the gate hall ----------
	const gate = new THREE.Group();
	gate.name = 'deep-gate';
	scene.add(gate);
	const glowC = new THREE.Color(0.55, 0.9, 1);
	const cw = profile.caves || {};
	const rockC = new THREE.Color(...(cw.rock || [0.3, 0.28, 0.26]));
	const lit = (m, k) => L.lit(m, k);
	const r0 = mulberry32((island.seed >>> 0) ^ 0x6a7e);
	const stoneM = lit(new THREE.MeshStandardMaterial({ color: rockC.clone().multiplyScalar(1.3), roughness: 0.8 }), 'gatestone');
	const woodMat = lit(new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 }), 'gatewood');
	const stones = [];
	const menhirGeo = new THREE.CylinderGeometry(0.4, 0.58, 1, 6);
	menhirGeo.translate(0, 0.5, 0);
	const head = Math.atan2(dz0, dx0);
	for (let i = 0; i < 5; i++) {
		// in an arc round the far side of the seal, against the hall's walls
		const a = head + (i - 2) * 0.62, x = plan.x + Math.cos(a) * 5, z = plan.z + Math.sin(a) * 5, y = uwFloor(x, z);
		const h = 2.3 + [0, 0.35, 0.7, 0.35, 0][i] + i * 0.05;
		const mat = lit(new THREE.MeshStandardMaterial({ color: rockC.clone().multiplyScalar(1.1), roughness: 0.6, emissive: glowC, emissiveIntensity: 0.06 }), 'gatemenhir');
		const m = new THREE.Mesh(menhirGeo, mat);
		m.position.set(x, y - 0.25, z); m.scale.set(1, h, 1); m.rotation.y = -a;
		m.userData.material175 = 'stone';
		const bands = [];
		for (const f of [0.35, 0.62]) {
			const band = new THREE.Mesh(new THREE.TorusGeometry(0.52 - f * 0.12, 0.045, 4, 16), new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.35 }));
			band.rotation.x = Math.PI / 2; band.position.set(x, y - 0.25 + h * f, z);
			gate.add(band); bands.push(band);
		}
		gate.add(m);
		stones.push({ i, m, bands, x, z, y, h, flash: 0 });
	}
	// the seal: a great disc of carved stone, a ring of light, the four lights of the phrase
	const dais = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.28, 6, 40), stoneM);
	dais.rotation.x = Math.PI / 2; dais.position.set(plan.x, gy + 0.02, plan.z);
	const lid = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.05, 0.34, 32), lit(new THREE.MeshStandardMaterial({ color: rockC.clone().multiplyScalar(0.9), roughness: 0.85, emissive: glowC, emissiveIntensity: 0.03 }), 'gatelid'));
	lid.position.set(plan.x, gy - 0.12, plan.z);
	const glyph = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 4, 48), new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.4 }));
	glyph.rotation.x = Math.PI / 2; glyph.position.set(plan.x, gy + 0.07, plan.z);
	const marks = [];
	for (let i = 0; i < 4; i++) {
		const a = head + Math.PI + (i - 1.5) * 0.5, b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.15 }));
		b.position.set(plan.x + Math.cos(a) * 1.3, gy + 0.12, plan.z + Math.sin(a) * 1.3);
		marks.push(b);
	}
	// the open shaft: dark, a glowing rim, a windlass and its rope going down to the Deep
	const hole = new THREE.Group();
	const dark = new THREE.Mesh(new THREE.CircleGeometry(2.95, 32), new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: -4 }));
	dark.rotation.x = -Math.PI / 2; dark.position.set(plan.x, gy + 0.03, plan.z);
	const rim = new THREE.Mesh(new THREE.TorusGeometry(2.98, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: glowC }));
	rim.rotation.x = Math.PI / 2; rim.position.set(plan.x, gy + 0.06, plan.z);
	const post = new THREE.CylinderGeometry(0.11, 0.13, 3.6, 6);
	for (const s of [-1, 1]) { const m = new THREE.Mesh(post, woodMat); m.position.set(plan.x + side.x * s * 3.4, gy + 1.8, plan.z + side.z * s * 3.4); hole.add(m); }
	const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8), woodMat);
	bar.position.set(plan.x, gy + 3.4, plan.z); bar.rotation.set(0, -Math.atan2(side.z, side.x), Math.PI / 2);
	const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, SHAFT + 3.4, 4), new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 1 }));
	rope.position.set(plan.x, gy + 3.4 - (SHAFT + 3.4) / 2, plan.z);
	hole.add(dark, rim, bar, rope);
	// the mouth of the hall: old timbering, a step or two worn into the floor, two lamps
	const pts = plan.pts, mi = Math.round(pts.length * 0.62), M = pts[Math.min(pts.length - 2, mi)], Mn = pts[Math.min(pts.length - 1, mi + 1)];
	const tdx = Mn.x - M.x, tdz = Mn.z - M.z, tl = Math.hypot(tdx, tdz) || 1, sx = -tdz / tl, sz = tdx / tl;
	const lamps = [];
	for (const [k, back] of [[0, 0], [1, -4]]) {
		const cx = M.x + tdx / tl * back, cz = M.z + tdz / tl * back, cy = uwFloor(cx, cz, M.y + 2), w = M.w * 0.85;
		for (const s of [-1, 1]) { const m = new THREE.Mesh(post, woodMat); m.scale.y = 1.05; m.position.set(cx + sx * s * w, cy + 1.8, cz + sz * s * w); gate.add(m); }
		const lintel = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.6, 0.28, 0.32), woodMat);
		lintel.position.set(cx, cy + 3.7, cz); lintel.rotation.y = -Math.atan2(sz, sx);
		gate.add(lintel);
		if (k === 0) for (const s of [-1, 1]) {
			const lx = cx + sx * s * (w - 0.3), lz = cz + sz * s * (w - 0.3), ly = cy + 2.9;
			const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
			lamp.position.set(lx, ly, lz); gate.add(lamp);
			lamps.push(UW.addGlow(lx, ly, lz, 13, [1, 0.68, 0.38], 0.55, 0.25));
		}
	}
	for (let i = 0; i < 3; i++) {
		const t = (pts.length - 1) * 0.62 + 1.2 + i * 0.9, a = pts[Math.floor(t)], b = pts[Math.min(pts.length - 1, Math.floor(t) + 1)], f = t - Math.floor(t);
		const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, y = uwFloor(x, z, a.y + 2);
		const st = new THREE.Mesh(new THREE.BoxGeometry(a.w * 1.3, 0.16, 0.7), stoneM);
		st.position.set(x, y + 0.02, z); st.rotation.y = -Math.atan2(sz, sx);
		gate.add(st);
	}
	gate.add(dais, lid, glyph, ...marks, hole);
	hole.visible = saved.open;
	if (saved.open) { lid.visible = false; glyph.visible = false; for (const b of marks) b.visible = false; }
	const sealGlow = UW.addGlow(plan.x, gy + 2.2, plan.z, 14, [glowC.r, glowC.g, glowC.b], 0.2);
	const surfaceRipples = createRipples(gate, 6);
	// the call: four of the five, never the same twice running
	const call = [];
	while (call.length < 4) { const s = Math.floor(r0() * 5); if (s !== call[call.length - 1]) call.push(s); }
	const puzzle = { heard: false, at: 0, playing: 0, sink: saved.open ? 1 : 0, opening: false, announced: false, wrongAt: 0 };
	function playCall(delay = 0.6) {
		puzzle.playing = 1;
		call.forEach((s, i) => setTimeout(() => { if (disposed) return; stones[s].flash = 1; ring(STONE_DEG[s], { vel: 0.5, dur: 1.4 }); surfaceRipples.spawn(new THREE.Vector3(stones[s].x, stones[s].y + 0.05, stones[s].z), glowC, 4); }, (delay + i * 0.55) * 1000));
		setTimeout(() => { puzzle.playing = 0; }, (delay + call.length * 0.55) * 1000);
	}
	const tmpV = new THREE.Vector3();
	function strikeGate(s) {
		s.flash = 1;
		ring(STONE_DEG[s.i], { vel: 0.6, dur: 1.8 });
		surfaceRipples.spawn(tmpV.set(s.x, s.y + 0.05, s.z), glowC, 5);
		if (saved.open || puzzle.opening) return;
		if (!puzzle.heard) {
			puzzle.heard = true; puzzle.at = 0;
			hint?.('The stones answer with a phrase of four. Strike them in the same order.', 6000);
			playCall(0.9);
			return;
		}
		if (puzzle.playing) return;
		if (call[puzzle.at] === s.i) {
			puzzle.at++;
			if (puzzle.at === call.length) openGate();
		} else {
			puzzle.at = 0;
			setTimeout(knock, 150);
			if (performance.now() - puzzle.wrongAt > 4000) hint?.('Not that one. The stones play their phrase again.', 3500);
			puzzle.wrongAt = performance.now();
			playCall(1.1);
		}
	}
	function openGate() {
		puzzle.opening = true;
		setTimeout(() => phrase([0, 2, 4, 7, 9], 0.16, { vel: 0.55, dur: 2.8 }), 350);
		grind();
		surfaceRipples.spawn(tmpV.set(plan.x, gy + 0.1, plan.z), glowC, 16, 2.6);
		saved.open = true; save();
		hint?.('The seal grinds down and away. A rope hangs into the shaft beneath: there is no known bottom.', 6500);
	}
	// stone on stone: a long low grinding as the seal goes down
	function grind() {
		const S = soundBus();
		if (!S) return;
		const ctx = S.ctx, t = ctx.currentTime, src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
		const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
		let v = 0;
		for (let i = 0; i < n; i++) { v = v * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = v * (0.6 + 0.4 * Math.sin(i / ctx.sampleRate * 23)); }
		src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 320;
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.6, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
		src.connect(lp).connect(g).connect(S.out); src.start(t);
	}

	// ---------- the deep ----------
	const group = new THREE.Group();
	group.name = 'deep';
	group.visible = false;
	scene.add(group);
	// the dark beyond the rock: where a far cube is not made yet you see nothing, not the sky
	const backdrop = new THREE.Mesh(new THREE.SphereGeometry(260, 16, 8), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false }));
	backdrop.visible = false; backdrop.frustumCulled = false;
	scene.add(backdrop);
	const mats = new Map();
	function bandMat(D) {
		const bi = bandIndex(D), hs = hueShift(D), k = bi + ':' + hs;
		let m = mats.get(k);
		if (!m) {
			const b = BANDS[bi], glow = new THREE.Color(...b.glow);
			if (hs) glow.offsetHSL(hs, 0, 0);
			m = rockMaterial(L, { caves: { rock: b.rock, glow: [glow.r, glow.g, glow.b], water: b.water, ice: b.ice, lava: b.lava, crystals: b.crystals }, ground: profile.ground, grass: 0 }, { isPhone, glowK: b.glowK });
			mats.set(k, m);
		}
		return m;
	}
	// what grows on the rock, band by band (one instanced draw per chunk)
	const propGeo = {
		drip: (() => { const g = new THREE.ConeGeometry(0.22, 1, 6); g.translate(0, 0.5, 0); return g; })(),
		crystal: (() => { const g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.45, 1.6, 0.45); g.translate(0, 0.55, 0); return g; })(),
		shroom: (() => { const cap = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.55, 1); cap.translate(0, 0.75, 0); const st = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 5); st.translate(0, 0.4, 0); return mergeGeos([st, cap]); })(),
		ember: (() => { const g = new THREE.DodecahedronGeometry(0.45, 0); g.translate(0, 0.2, 0); return g; })(),
		shard: (() => { const g = new THREE.OctahedronGeometry(0.6, 0); g.translate(0, 1.6, 0); return g; })(),
	};
	const propMats = new Map();
	function propMat(kind, D) {
		const bi = bandIndex(D), hs = hueShift(D), k = kind + ':' + bi + ':' + hs;
		let m = propMats.get(k);
		if (m) return m;
		const b = BANDS[bi], c = new THREE.Color(...b.glow);
		if (hs) c.offsetHSL(hs, 0, 0);
		if (kind === 'crystal' || kind === 'shard') m = crystalMaterial(L, [c.r, c.g, c.b]);
		else if (kind === 'drip') m = L.lit(new THREE.MeshStandardMaterial({ color: new THREE.Color(...b.rock).multiplyScalar(1.5), roughness: 0.5 }), 'deepdrip');
		else m = L.lit(new THREE.MeshStandardMaterial({ color: kind === 'ember' ? 0x221410 : 0x6a5a48, roughness: 0.8, emissive: c, emissiveIntensity: kind === 'ember' ? 1.4 : 1.1 }), 'deepglow');
		propMats.set(k, m);
		return m;
	}

	const chunks = new Map();
	let shift = BASE, active = false, depth = 0, lastBand = -1, wantT = 0;
	const wantAt = new THREE.Vector3(1e9, 0, 0);
	const NEAR = isPhone ? 34 : 46, KEEP = isPhone ? 78 : 104, VF = isPhone ? 1.25 : 1.0, VC = 2.0;
	const virt = new THREE.Vector3();
	const cv = () => virt.set(camera.position.x, camera.position.y - shift, camera.position.z);
	function wanted(vc) {
		const out = new Set(), Dp = -vc.y;
		const add = (x0, x1, y0, y1, z0, z1) => {
			for (let k = Math.floor(z0 / CH); k <= Math.floor(z1 / CH); k++) for (let j = Math.floor(y0 / CH); j <= Math.floor(y1 / CH); j++) for (let i = Math.floor(x0 / CH); i <= Math.floor(x1 / CH); i++) out.add(i + ',' + j + ',' + k);
		};
		for (let D = Math.max(-2, Dp - 45); D < Dp + 70; D += 2.5) {
			const p = F.path(D), w = F.halfW(D) + 3.5, h = F.tall(D) + 3;
			if (Math.hypot(p.x - vc.x, p.y - vc.y, p.z - vc.z) > KEEP + 20) continue;
			add(p.x - w, p.x + w, p.y - 3, p.y + h, p.z - w, p.z + w);
		}
		const L0 = Math.floor((Dp - 45) / LM);
		for (let l = L0 - 1; l <= L0 + 1; l++) {
			const m = F.landmark(l);
			if (!m) continue;
			const R = Math.max(m.rx, m.rz) + 4;
			add(m.ox - (m.kind === 'chasm' ? 28 : R), m.ox + (m.kind === 'chasm' ? 28 : R), m.y - (m.kind === 'chasm' ? 36 : 5), m.y + m.h + 5, m.oz - (m.kind === 'chasm' ? 28 : R), m.oz + (m.kind === 'chasm' ? 28 : R));
		}
		if (Dp < 60) { const p = F.path(0); add(p.x - 13, p.x + 13, -4, 12, p.z - 13, p.z + 13); add(p.x - 4, p.x + 4, 0, SHAFT + 16, p.z - 4, p.z + 4); }
		// only what is within reach of you
		for (const k of out) {
			const [i, j, kk] = k.split(',').map(Number);
			if (Math.hypot((i + 0.5) * CH - vc.x, (j + 0.5) * CH - vc.y, (kk + 0.5) * CH - vc.z) > KEEP) out.delete(k);
		}
		return out;
	}
	function dropChunk(c) {
		if (c.mesh) { group.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
		if (c.props) { group.remove(c.props); c.props.dispose(); c.props = null; }
		c.gen?.return?.(); c.gen = null;
	}
	function startGen(c, v) {
		c.genV = v;
		const ox = c.i * CH, oy = c.j * CH, oz = c.k * CH;
		// meshed in the chunk's own frame: small numbers, however deep
		const local = { out: F.out, inHole: () => false, solid: (x, y, z) => F.solid(x + ox, y + oy, z + oz) };
		c.gen = meshChunk(local, 0, 0, 0, CH, v);
	}
	function finishGen(c, m) {
		const v = c.genV;
		c.gen = null;
		if (c.mesh) { group.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
		c.v = v; c.built = true;
		if (!m) return;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
		g.setAttribute('aInfo', new THREE.BufferAttribute(m.info, 2));
		g.setIndex(new THREE.BufferAttribute(m.idx, 1));
		g.computeBoundingSphere();
		const mesh = new THREE.Mesh(g, bandMat(-(c.j + 0.5) * CH));
		mesh.position.set(c.i * CH, c.j * CH, c.k * CH);
		mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
		mesh.userData.material175 = 'stone';
		group.add(mesh);
		c.mesh = mesh;
		if (!c.props && !c.noProps) makeProps(c);
	}
	// a few things growing on the rock of a chunk: deterministic, from the chunk's key
	const dummy = new THREE.Object3D();
	function makeProps(c) {
		c.noProps = true;
		const D = -(c.j + 0.5) * CH, b = BANDS[bandIndex(D)], kind = b.prop;
		const r = mulberry32(((island.seed >>> 0) ^ Math.imul(c.i, 73856093) ^ Math.imul(c.j, 19349663) ^ Math.imul(c.k, 83492791)) >>> 0);
		const list = [];
		for (let n = 0; n < (isPhone ? 10 : 16); n++) {
			const x = c.i * CH + r() * CH, y = c.j * CH + r() * CH, z = c.k * CH + r() * CH;
			if (F.solid(x, y, z) > -0.5) continue;
			const hang = kind === 'drip' && r() < 0.5;
			const at = hang ? F.roof(x, z, y, CH) : F.floor(x, z, y);
			if (at == null || at < c.j * CH - 2 || at > (c.j + 1) * CH + 2) continue;
			// keep the middle of the way clear underfoot
			const t = F.path(-at);
			if (!hang && Math.hypot(x - t.x, z - t.z) < 2.2) continue;
			const s = kind === 'drip' ? 0.6 + r() * 1.8 : kind === 'shroom' ? 0.6 + r() * 1.6 : 0.6 + r() * 1.2;
			list.push({ x, y: hang ? at + 0.2 : at - 0.1, z, s, hang, rot: r() * 6.28 });
		}
		if (!list.length) return;
		const im = new THREE.InstancedMesh(propGeo[kind], propMat(kind, D), list.length);
		list.forEach((p, i) => {
			dummy.position.set(p.x, p.y, p.z);
			dummy.rotation.set(p.hang ? Math.PI : 0, p.rot, 0);
			dummy.scale.set(p.s, p.s * (kind === 'drip' ? 1.8 : 1), p.s);
			dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
		});
		im.computeBoundingSphere();
		group.add(im);
		c.props = im;
		// the glowing things light the rock round them
		if (kind !== 'drip') {
			const m = list[Math.floor(list.length / 2)], col = new THREE.Color(...b.glow);
			c.glow = { x: m.x, y: m.y + 1, z: m.z, r: 9 + list.length, c: col.offsetHSL(hueShift(D), 0, 0), k: kind === 'ember' ? 0.9 : 0.6, key: kind === 'ember' };
		}
	}
	function stream(dt, vc) {
		wantT -= dt;
		if (wantT <= 0 || vc.distanceTo(wantAt) > 4) {
			wantT = 0.5; wantAt.copy(vc);
			const want = wanted(vc);
			for (const [k, c] of chunks) if (!want.has(k)) { dropChunk(c); chunks.delete(k); }
			for (const k of want) if (!chunks.has(k)) { const [i, j, kk] = k.split(',').map(Number); chunks.set(k, { i, j, k: kk, mesh: null, props: null, gen: null, built: false, v: 0, d: 0 }); }
			for (const c of chunks.values()) c.d = Math.hypot((c.i + 0.5) * CH - vc.x, (c.j + 0.5) * CH - vc.y, (c.k + 0.5) * CH - vc.z);
		}
		// the nearest first; near ones finely, far ones coarsely (and refined as you come)
		const t0 = performance.now(), budget = isPhone ? 2.5 : 4.5;
		let job = null;
		for (const c of chunks.values()) {
			const want = c.d < NEAR ? VF : c.d > NEAR + 14 ? VC : c.v || VC;
			c.want = want;
			if (c.gen || !c.built || c.v !== want) { const pri = c.d + (c.built ? 200 : 0) - (c.gen ? 5 : 0); if (!job || pri < job.pri) job = { c, pri }; }
		}
		while (job && performance.now() - t0 < budget) {
			const c = job.c;
			if (!c.gen || c.genV !== c.want) { c.gen?.return?.(); startGen(c, c.want); }
			const s = c.gen.next();
			if (s.done) {
				finishGen(c, s.value);
				job = null;
				for (const o of chunks.values()) if (o.gen || !o.built || o.v !== o.want) { const pri = o.d + (o.built ? 200 : 0); if (!job || pri < job.pri) job = { c: o, pri }; }
			}
		}
	}
	// make everything near at once (arriving, or in the tests)
	function buildNear(vc, r = 40) {
		stream(0, vc);
		for (const c of chunks.values()) if (c.d < r && (!c.built || c.v !== VF)) { if (!c.gen || c.genV !== VF) startGen(c, VF); let s; while (!(s = c.gen.next()).done); finishGen(c, s.value); }
	}

	// ---------- landmarks: their things, and the waystones ----------
	const built = new Map();
	const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.85 });
	L.lit(stoneMat, 'deepstone');
	const boxGeo = new THREE.BoxGeometry(1, 1, 1);
	const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
	const wayGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.6, 5);
	wayGeo.translate(0, 1.3, 0);
	const beadGeo = new THREE.IcosahedronGeometry(0.15, 0);
	const ripples = createRipples(group, 6);
	function addMesh(mk, geo, mat, x, y, z, sx, sy, sz, ry = 0) {
		const m = new THREE.Mesh(geo, mat);
		m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
		mk.group.add(m);
		return m;
	}
	function buildMark(m) {
		const mk = { m, group: new THREE.Group(), glows: [], pushes: [], floors: [], targets: [], update: null, mats: [] };
		const b = BANDS[m.band], col = new THREE.Color(...b.glow).offsetHSL(hueShift(m.D), 0, 0);
		const r = mulberry32(m.seed);
		const fl = (x, z, y = m.y + 4) => F.floor(x, z, y) ?? m.y;
		if (m.kind === 'lake') {
			const bed = fl(m.lake.x, m.lake.z, m.y + 6), lvl = bed + 1.25;
			m.lake.y = lvl;
			const lava = b.lava > 0.5;
			const mat = lava ? lavaMaterial(shared) : waterMaterial(L, b.water > 0.9 ? [0.02, 0.06, 0.08] : [0.03, 0.04, 0.05], false);
			mk.mats.push(mat);
			const w = new THREE.Mesh(new THREE.CircleGeometry(m.lake.r * 1.15, 40), mat);
			w.rotation.x = -Math.PI / 2; w.position.set(m.lake.x, lvl, m.lake.z);
			mk.group.add(w);
			if (lava) { mk.pushes.push({ x: m.lake.x, z: m.lake.z, r: m.lake.r * 0.9 }); mk.glows.push({ x: m.lake.x, y: lvl + 2, z: m.lake.z, r: 28, c: new THREE.Color(1, 0.4, 0.1), k: 1.4, key: true }); }
			else mk.glows.push({ x: m.lake.x, y: lvl + 3, z: m.lake.z, r: 18, c: col, k: 0.35 });
		} else if (m.kind === 'chasm') {
			// the bridge: from where the way leaves the slot's lip to where it meets it again
			const ends = [];
			for (const s of [-1, 1]) {
				let D = m.D;
				for (let i = 0; i < 40; i++) { const p = F.path(D); if (Math.abs((p.x - m.x) * m.tx + (p.z - m.z) * m.tz) > 6.2) break; D += s * 0.25; }
				const p = F.path(D);
				ends.push({ x: p.x, z: p.z, y: fl(p.x, p.z, p.y + 2) });
			}
			const [A, B] = ends, len = Math.hypot(B.x - A.x, B.z - A.z), ry = Math.atan2(B.x - A.x, B.z - A.z), mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, my = (A.y + B.y) / 2;
			const deck = addMesh(mk, boxGeo, woodMat, mx, my - 0.08, mz, 2.2, 0.16, len + 1);
			deck.rotation.set(Math.atan2(A.y - B.y, len), ry, 0, 'YXZ');
			for (const s of [-1, 1]) {
				const rail = addMesh(mk, boxGeo, woodMat, mx + Math.cos(ry) * s * 1.1, my + 0.9, mz - Math.sin(ry) * s * 1.1, 0.06, 0.06, len + 1);
				rail.rotation.set(Math.atan2(A.y - B.y, len), ry, 0, 'YXZ');
				for (const E of [A, B]) addMesh(mk, cylGeo, woodMat, E.x + Math.cos(ry) * s * 1.1, E.y + 0.5, E.z - Math.sin(ry) * s * 1.1, 0.16, 1.1, 0.16);
			}
			mk.floors.push({ A, B, len, half: 1.25 });
			m.bridge = { A, B };
			// far below, a glow in the mist
			mk.glows.push({ x: m.x, y: m.y - 30, z: m.z, r: 40, c: col, k: 0.9 });
			const mist = new THREE.Mesh(new THREE.CircleGeometry(20, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
			mk.mats.push(mist.material);
			mist.rotation.x = -Math.PI / 2; mist.position.set(m.x, m.y - 26, m.z);
			mk.group.add(mist);
		} else if (m.kind === 'cathedral') {
			// lamps of living light hung high in the vault
			for (let i = 0; i < 4; i++) {
				const x = m.x + m.nx * (i - 1.5) * 8, z = m.z + m.nz * (i - 1.5) * 8, y = m.y + 18 + r() * 10;
				const orb = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: col }));
				orb.scale.setScalar(5 + r() * 3); orb.position.set(x, y, z);
				mk.mats.push(orb.material);
				mk.group.add(orb);
				mk.glows.push({ x, y, z, r: 40, c: col, k: 0.7 });
			}
		} else if (m.kind === 'ruins') {
			// those who came down this far: their columns and a doorway, fallen and standing
			for (let i = 0; i < 8; i++) {
				const s = i % 2 ? 1 : -1, al = (Math.floor(i / 2) - 1.5) * 5, ac = s * (6 + r() * 2);
				const x = m.x + m.tx * al + m.nx * ac, z = m.z + m.tz * al + m.nz * ac, y = fl(x, z);
				const h = r() < 0.35 ? 0.8 + r() : 3 + r() * 3;
				addMesh(mk, cylGeo, stoneMat, x, y + h / 2, z, 1.1, h, 1.1);
				mk.pushes.push({ x, z, r: 0.75 });
			}
			const al = 8, x = m.x + m.tx * al, z = m.z + m.tz * al, y = fl(x, z);
			for (const s of [-1, 1]) { addMesh(mk, boxGeo, stoneMat, x + m.nx * s * 2.6, y + 2.2, z + m.nz * s * 2.6, 0.9, 4.4, 0.9, Math.atan2(m.tx, m.tz)); mk.pushes.push({ x: x + m.nx * s * 2.6, z: z + m.nz * s * 2.6, r: 0.7 }); }
			addMesh(mk, boxGeo, stoneMat, x, y + 4.7, z, 0.9, 0.7, 6.4, Math.atan2(m.nx, m.nz));
			mk.glows.push({ x, y: y + 2, z, r: 16, c: new THREE.Color(1, 0.75, 0.45), k: 0.5, flick: 0.3 });
		} else if (m.kind === 'alcove') buildChorus(mk, col, fl);
		// a waystone: touch it and it remembers you; it takes you back up
		if (m.way) {
			const ac = -(m.kind === 'alcove' ? 3 : m.rz * 0.4), x = m.x + m.nx * ac, z = m.z + m.nz * ac, y = fl(x, z);
			const mat = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6, emissive: new THREE.Color(0.55, 0.9, 1), emissiveIntensity: saved.ways.includes(m.L) ? 0.9 : 0.25 });
			L.lit(mat, 'deepway');
			mk.mats.push(mat);
			const ws = addMesh(mk, wayGeo, mat, x, y - 0.1, z, 1, 1, 1, r() * 6);
			mk.pushes.push({ x, z, r: 0.6 });
			mk.glows.push({ x, y: y + 2, z, r: 12, c: new THREE.Color(0.55, 0.9, 1), k: 0.5 });
			mk.way = { x, y, z, mat, mesh: ws };
			mk.targets.push({ local: new THREE.Vector3(x, y + 1.4, z), r: 0.8, mesh: ws, label: 'Return to the surface', icon: '⬆', color: 0xaef0ff, reach: 3, act: () => leave() });
		}
		group.add(mk.group);
		return mk;
	}
	// an alcove of three singing stones (as in the caves above: cave-elements.js)
	function buildChorus(mk, col, fl) {
		const m = mk.m, mask0 = saved.alcoves[m.L] | 0, site = { mask: mask0 & 7, stones: [], beads: [], reveal: 1, flash: 0, last: -1, lastAt: 0 };
		const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...BANDS[m.band].rock).multiplyScalar(1.4), roughness: 0.6, emissive: col, emissiveIntensity: 0.12 });
		L.lit(mat, 'deepchorus');
		mk.mats.push(mat);
		const sx = m.ox + m.nx * 2.5, sz = m.oz + m.nz * 2.5;
		for (let i = 0; i < 3; i++) {
			const x = sx + m.tx * (i - 1) * 1.1, z = sz + m.tz * (i - 1) * 1.1, y = fl(x, z, m.y + 5), h = 0.9 + i * 0.25;
			const st = addMesh(mk, cylGeo, mat, x, y + h / 2, z, 0.75, h, 0.75);
			const bandM = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25 });
			mk.mats.push(bandM);
			const rg = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 4, 12), bandM);
			rg.rotation.x = Math.PI / 2; rg.position.set(x, y + h + 0.06, z);
			mk.group.add(rg);
			site.stones.push({ st, rg, x, y, z, h, ping: 0 });
			mk.pushes.push({ x, z, r: 0.45 });
			mk.targets.push({ local: new THREE.Vector3(x, y + h * 0.6, z), r: 0.5 + h * 0.3, mesh: st, color: col, label: 'Strike the stone', icon: '🔔', act: () => strikeChorus(site, i, m, col) });
		}
		for (let j = 0; j < 8; j++) {
			const q = j / 7, x = sx + (m.x - sx) * q * 1.6, z = sz + (m.z - sz) * q * 1.6, y = fl(x, z, m.y + 5);
			const bm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06 });
			mk.mats.push(bm);
			const bead = new THREE.Mesh(beadGeo, bm);
			bead.position.set(x, y + 0.22, z);
			mk.group.add(bead); site.beads.push(bead);
		}
		mk.chorus = site;
		mk.glows.push(site.glow = { x: sx, y: fl(sx, sz, m.y + 5) + 2, z: sz, r: 14, c: col, k: site.mask === 7 ? 0.8 : 0.08 });
		mk.update = (dt) => {
			site.flash *= Math.exp(-dt * 3);
			if (site.reveal < 1) site.reveal = Math.min(1, site.reveal + dt / 1.6);
			for (const [i, o] of site.stones.entries()) {
				o.ping *= Math.exp(-dt * 2.5);
				o.rg.material.opacity = Math.min(1, (site.mask & (1 << i) ? 0.75 : 0.2 + site.flash * 0.5) + o.ping * 0.5);
				o.rg.scale.setScalar(1 + o.ping * 0.8);
			}
			mat.emissiveIntensity = 0.12 + (site.mask === 7 ? 0.4 : 0) + site.flash * 0.6;
			site.beads.forEach((bd, j) => { bd.material.opacity = site.mask === 7 && site.reveal >= j / site.beads.length ? 0.85 : 0.06; });
			site.glow.k = site.mask === 7 ? 0.8 * (0.6 + 0.4 * site.reveal) : 0.08 + site.flash * 0.6;
		};
	}
	function strikeChorus(site, i, m, col) {
		const now = performance.now();
		if (site.last === i && now - site.lastAt < 180) return;
		site.last = i; site.lastAt = now;
		const o = site.stones[i];
		ring([0, 2, 4][i] + (m.band % 2 ? 7 : 0), { vel: 0.6, dur: 2.2 });
		o.ping = 1; site.flash = 1;
		ripples.spawn(tmpV.set(o.x, o.y + 0.06, o.z), col, 5);
		if (site.mask & (1 << i)) return;
		site.mask |= 1 << i;
		saved.alcoves[m.L] = site.mask; save();
		if (site.mask === 7) {
			site.reveal = 0;
			setTimeout(() => phrase([0, 2, 4, 7], 0.18, { vel: 0.5, dur: 2.6 }), 420);
			ripples.spawn(tmpV.set(o.x, o.y + 0.06, o.z), col, 14, 2.4);
			hint?.(`The chorus at ${Math.round(m.D)} m is restored. ${restored()} deep alcove${restored() === 1 ? '' : 's'} sing again.`, 5000);
		} else hint?.(`Deep chorus: ${[1, 2, 4].filter((b) => site.mask & b).length}/3 stones tuned. Strike the others.`, 4000);
	}
	const restored = () => Object.values(saved.alcoves).filter((v) => v === 7).length;
	function dropMark(mk) {
		group.remove(mk.group);
		mk.group.traverse((o) => { if (o.geometry && o.geometry !== boxGeo && o.geometry !== cylGeo && o.geometry !== wayGeo && o.geometry !== beadGeo) o.geometry.dispose(); });
		for (const m of mk.mats) m.dispose();
	}
	function marksNear(Dp) {
		const L0 = Math.floor((Dp - 45) / LM), keep = new Set();
		for (let l = L0 - 1; l <= L0 + 1; l++) {
			const m = F.landmark(l);
			if (!m) continue;
			keep.add(l);
			if (!built.has(l)) built.set(l, buildMark(m));
		}
		for (const [l, mk] of built) if (!keep.has(l)) { dropMark(mk); built.delete(l); }
	}
	// the foot of the rope: the way up, and the lift down to the deepest waystone reached
	const landing = new THREE.Group();
	group.add(landing);
	let landingTargets = [];
	{
		const p = F.path(0), y = F.floor(p.x, p.z, 3) ?? 0;
		const cage = new THREE.Group();
		const iron = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.5, metalness: 0.6 });
		L.lit(iron, 'deepiron');
		for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const bar = new THREE.Mesh(cylGeo, iron); bar.scale.set(0.1, 2.6, 0.1); bar.position.set(dx, 1.3, dz); cage.add(bar); }
		const top = new THREE.Mesh(boxGeo, iron); top.scale.set(1.8, 0.12, 1.8); top.position.y = 2.6; cage.add(top);
		const base = new THREE.Mesh(boxGeo, iron); base.scale.set(1.8, 0.12, 1.8); base.position.y = 0.06; cage.add(base);
		const chain = new THREE.Mesh(cylGeo, iron); chain.scale.set(0.05, 30, 0.05); chain.position.y = 17.6; cage.add(chain);
		const [tx, tz] = F.tangent(0), cx = p.x - tz * 4.5, cz = p.z + tx * 4.5;
		cage.position.set(cx, F.floor(cx, cz, 3) ?? y, cz);
		landing.add(cage);
		landingTargets = [
			{ local: new THREE.Vector3(p.x, y + 1.3, p.z), r: 0.5, label: 'Climb the rope up', icon: '⬆', color: 0xffe2b0, reach: 3, act: () => climbUp() },
			{ local: new THREE.Vector3(cx, cage.position.y + 1.3, cz), r: 1.1, label: 'Take the lift down', icon: '⬇', color: 0xaef0ff, reach: 3, act: () => {
				const L1 = Math.max(-1, ...saved.ways);
				if (L1 < 0) { hint?.('The lift goes down only as far as a waystone you have touched. Walk down and find one.', 5000); return; }
				const m = F.landmark(L1);
				veilTo(`Down to ${Math.round(m.D)} m`, () => placeAt(m.D, m));
			} },
		];
		landing.userData.floorY = y;
	}

	// ---------- walking down here ----------
	// (in the deep's own frame; the caller converts)
	function vFloor(x, z, y) {
		let g = F.floor(x, z, y);
		for (const mk of built.values()) for (const f of mk.floors) {
			const ux = f.B.x - f.A.x, uz = f.B.z - f.A.z, t = ((x - f.A.x) * ux + (z - f.A.z) * uz) / (f.len * f.len);
			if (t < -0.02 || t > 1.02) continue;
			const px = f.A.x + ux * t, pz = f.A.z + uz * t;
			if (Math.hypot(x - px, z - pz) > f.half) continue;
			const dy = f.A.y + (f.B.y - f.A.y) * clamp(t, 0, 1);
			if (y > dy - 1.4 && (g == null || dy > g)) g = dy;
		}
		return g;
	}
	function vPush(p, footY) {
		for (const hy of [0.95, 1.55]) {
			const y = footY + hy, f = F.solid(p.x, y, p.z), R = 0.35;
			if (f <= -R) continue;
			const e = 0.25, gx = (F.solid(p.x + e, y, p.z) - F.solid(p.x - e, y, p.z)) / (2 * e), gz = (F.solid(p.x, y, p.z + e) - F.solid(p.x, y, p.z - e)) / (2 * e);
			const gl = Math.hypot(gx, gz);
			if (gl < 0.25) continue;
			const m = Math.min(0.5, (f + R) / gl);
			p.x -= gx / gl * m; p.z -= gz / gl * m;
		}
		for (const mk of built.values()) for (const o of mk.pushes) {
			const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + 0.35;
			if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
		}
	}
	const vp = new THREE.Vector3();
	const floor = (x, z, y) => { const g = vFloor(x, z, y - shift); return g == null ? y - 100 : g + shift; };
	const push = (p, footY) => { vp.set(p.x, p.y - shift, p.z); vPush(vp, footY - shift); p.x = vp.x; p.z = vp.z; };
	// in the hall: its stones stand in the way, and the open shaft is not walked into
	function gatePush(p, footY) {
		if (climb || Math.abs(p.x - plan.x) > 12 || Math.abs(p.z - plan.z) > 12 || Math.abs(footY - gy) > 4) return;
		for (const s of stones) {
			const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), min = 0.9;
			if (d < min && d > 1e-4) { p.x = s.x + dx / d * min; p.z = s.z + dz / d * min; }
		}
		if (saved.open) {
			const dx = p.x - plan.x, dz = p.z - plan.z, d = Math.hypot(dx, dz), min = 3.1;
			if (d < min) { const ux = d > 1e-4 ? dx / d : -dx0, uz = d > 1e-4 ? dz / d : -dz0; p.x = plan.x + ux * min; p.z = plan.z + uz * min; }
		}
	}

	// ---------- going down, coming up ----------
	const veil = document.createElement('div');
	veil.style.cssText = 'position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;transition:opacity .3s ease;background:#020405;display:flex;align-items:center;justify-content:center;color:#d8f4ff;font:600 15px system-ui;letter-spacing:.08em;text-align:center;padding:24px;';
	mount?.appendChild(veil);
	const meter = document.createElement('div');
	meter.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top));z-index:4;pointer-events:none;display:none;padding:6px 12px;border-radius:12px;background:rgba(4,12,16,.6);border:1px solid rgba(255,255,255,.18);color:#dff6ff;font:600 12px system-ui;letter-spacing:.04em;white-space:nowrap;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
	mount?.appendChild(meter);
	let busy = false;
	function veilTo(label, move) {
		if (busy) return;
		busy = true;
		veil.textContent = label; veil.style.opacity = '1';
		setTimeout(() => { try { move(); } finally { setTimeout(() => { veil.style.opacity = '0'; busy = false; }, 350); } }, 320);
	}
	let lastSafe = null, safeT = 0;
	// stand at a depth on the way (at a landmark's waystone, if given)
	function placeAt(D, m) {
		const P = player?.();
		if (!P) return 'no player';
		const was = active;
		if (!was) activate();
		const n = Math.max(0, Math.floor(Math.max(0, D) / STEP));
		shift = BASE + STEP * n; group.position.y = shift; group.updateMatrixWorld(true);
		let x, z, yaw;
		if (m?.way) { const mk = built.get(m.L) || (marksNear(m.D), built.get(m.L)); const w = mk.way; const [tx, tz] = F.tangent(m.D); x = w.x + m.nx * 1.6; z = w.z + m.nz * 1.6; yaw = Math.atan2(-tx, -tz); }
		else { const p = F.path(Math.max(0, D)), [tx, tz] = F.tangent(Math.max(0, D)); x = p.x; z = p.z; yaw = Math.atan2(-tx, -tz); if (D <= 0) { x += tx * 2; z += tz * 2; } }
		const vy = F.floor(x, z, -Math.max(0, D) + 3) ?? -D;
		P.flying = false; P.diving = false; P.swimming = false; P.vel.set(0, 0, 0);
		P.pos.set(x, vy + shift + EYE, z); P.yaw = yaw; P.pitch = -0.1;
		camera.position.copy(P.pos);
		depth = Math.max(0, -vy);
		marksNear(depth);
		buildNear(cv(), isPhone ? 30 : 40);
		lastSafe = { x, y: vy, z };
		UW.settle?.();
		return `at ${Math.round(depth)} m`;
	}
	let prevInside = null;
	function activate() {
		if (active) return;
		active = true; group.visible = true;
		prevInside = UW.extraInside; UW.extraInside = () => Math.max(prevInside?.() || 0, active ? 1 : 0);
	}
	// on the rope: down the shaft from the hall to the Deep's first chamber, or back up
	let climb = null;
	const ropeAt = () => ({ x: plan.x - dx0 * 0.55, z: plan.z - dz0 * 0.55 });
	function climbDown() {
		const P = player?.();
		if (!P || climb || busy) return;
		activate();
		shift = BASE; group.position.y = shift; group.updateMatrixWorld(true);
		const p0 = F.path(0), lf = F.floor(p0.x, p0.z, 3) ?? 0;
		marksNear(0);
		buildNear(new THREE.Vector3(p0.x, lf + EYE, p0.z), isPhone ? 26 : 34);
		const at = ropeAt();
		P.locked = true; P.flying = false; P.vel.set(0, 0, 0);
		P.yaw = Math.atan2(-dx0, -dz0); P.pitch = -0.35;
		climb = { up: false, t: 0, dur: 6.5, x: at.x, z: at.z, from: gy + EYE, to: lf + shift + EYE };
		hint?.('Down the rope, hand under hand…', 3000);
	}
	function climbUp() {
		const P = player?.();
		if (!P || climb || busy) return;
		const at = ropeAt();
		P.locked = true; P.vel.set(0, 0, 0); P.pitch = 0.35;
		climb = { up: true, t: 0, dur: 6.5, x: at.x, z: at.z, from: P.pos.y, to: gy + EYE };
	}
	function stepClimb(dt, P) {
		climb.t = Math.min(1, climb.t + dt / climb.dur);
		const k = smoothstep(0, 1, climb.t);
		P.pos.set(climb.x, climb.from + (climb.to - climb.from) * k, climb.z);
		P.vel.set(0, 0, 0);
		camera.position.copy(P.pos);
		camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
		if (climb.t < 1) return;
		const up = climb.up;
		climb = null; P.locked = false;
		if (up) { deactivate(); standInHall(P); hint?.('Back in the gate hall.', 2500); }
		else {
			lastSafe = { x: P.pos.x, y: P.pos.y - EYE - shift, z: P.pos.z };
			// off the rope, a step onto the floor
			const [tx, tz] = F.tangent(0);
			P.pos.x += tx * 1.6; P.pos.z += tz * 1.6;
			P.yaw = Math.atan2(-tx, -tz); P.pitch = -0.08;
			hint?.(`The Deep · ${BANDS[0].name}\nWaystones take you back up to the hall. Your deepest is ${Math.round(saved.deepest)} m.`, 6000);
		}
	}
	function standInHall(P, d = 4.4) {
		const x = plan.x - dx0 * d, z = plan.z - dz0 * d;
		P.flying = false; P.vel.set(0, 0, 0);
		P.pos.set(x, uwFloor(x, z) + EYE, z);
		P.yaw = Math.atan2(-(plan.x - x), -(plan.z - z)); P.pitch = -0.15;
		camera.position.copy(P.pos);
		UW.settle?.();
	}
	function leave() {
		veilTo('Up to the gate hall…', () => { deactivate(); const P = player?.(); if (P) standInHall(P); });
	}
	function deactivate() {
		if (!active) return;
		active = false; group.visible = false; meter.style.display = 'none';
		if (climb) { climb = null; const P = player?.(); if (P) P.locked = false; }
		UW.extraInside = prevInside; prevInside = null;
		for (const c of chunks.values()) dropChunk(c);
		chunks.clear();
		for (const mk of built.values()) dropMark(mk);
		built.clear();
		for (const g of pool) g.k = 0;
		if (dirty) save();
	}

	// ---------- the light: a few of the caves' glowing places, moved to the near ones ----------
	const pool = [];
	for (let i = 0; i < 8; i++) { const g = UW.addGlow(0, -1e5, 0, 1, [0, 0, 0], 0); pool.push(g); }
	function light(vc) {
		const cand = [];
		for (const c of chunks.values()) if (c.glow && c.mesh) cand.push(c.glow);
		for (const mk of built.values()) cand.push(...mk.glows);
		for (const g of cand) g.d = Math.hypot(g.x - vc.x, g.y - vc.y, g.z - vc.z) - g.r;
		cand.sort((a, b) => a.d - b.d);
		pool.forEach((g, i) => {
			const s = cand[i];
			if (!s || s.d > 50) { g.k = 0; g.y = -1e5; return; }
			g.x = s.x; g.y = s.y + shift; g.z = s.z; g.r = s.r; g.c.copy(s.c); g.k = s.k; g.flick = s.flick || 0; g.key = !!s.key;
		});
	}

	// ---------- each frame ----------
	const fogC = new THREE.Color();
	const fogFn = UW.fog;
	UW.fog = () => (active ? [fogC.r, fogC.g, fogC.b] : fogFn());
	let disposed = false, t0 = 0;
	function update(dt, t) {
		if (disposed) return;
		t0 = t;
		const P = player?.();
		// the gate hall
		const dg = Math.hypot(camera.position.x - plan.x, camera.position.y - gy, camera.position.z - plan.z);
		gate.visible = dg < 160;
		if (gate.visible) {
			const band = shared.uBass?.value || 0;
			for (const s of stones) {
				s.flash *= Math.exp(-dt * 2.6);
				s.m.material.emissiveIntensity = 0.06 + s.flash * 1.1 + (saved.open ? 0.22 : 0) + band * 0.1;
				for (const b of s.bands) b.material.opacity = 0.3 + s.flash * 0.7;
			}
			if (puzzle.opening && puzzle.sink < 1) {
				puzzle.sink = Math.min(1, puzzle.sink + dt / 3.2);
				const k = smoothstep(0, 1, puzzle.sink);
				lid.position.y = gy - 0.12 - k * 2.6; lid.rotation.y = k * 1.6;
				glyph.material.opacity = 0.4 + Math.sin(k * Math.PI) * 0.6;
				hole.visible = k > 0.15;
				if (puzzle.sink >= 1) { lid.visible = false; glyph.visible = false; for (const b of marks) b.visible = false; }
			}
			marks.forEach((b, i) => { b.material.opacity = i < puzzle.at ? 0.95 : 0.15; });
			rim.material.color.copy(glowC).multiplyScalar(0.6 + 0.4 * Math.sin(t * 1.7));
			// (the dark over the shaft only from above: from below the shaft is open)
			dark.visible = !active;
			sealGlow.k = saved.open ? 0.7 : 0.15 + puzzle.at * 0.12 + stones.reduce((a, s) => a + s.flash, 0) * 0.4;
			if (dg < 16 && !active && !puzzle.announced) { puzzle.announced = true; hint?.(saved.open ? 'The Deep Gate. The rope goes down into the Deep.' : 'The Deep Gate: five singing stones round a great sealed stone. Strike one and listen.', 6000); }
			if (dg > 40) puzzle.announced = false;
			surfaceRipples.update(dt);
		}
		if (climb && P) stepClimb(dt, P);
		backdrop.visible = active;
		if (!active) return;
		backdrop.position.copy(camera.position);
		backdrop.material.color.copy(fogC);
		// teleported away: the deep lets you go
		if (P && !climb && (P.pos.y > BASE + SHAFT + 20 || Math.hypot(P.pos.x - plan.x, P.pos.z - plan.z) > 700)) { deactivate(); return; }
		// keep what is drawn within reach of the origin: lift the deep 512 m at a time
		if (P && !climb) {
			const real = P.pos.y - EYE;
			let d = 0;
			if (real < BASE - STEP - 40) d = STEP; else if (real > BASE + 40 && shift > BASE) d = -STEP;
			if (d) {
				shift += d; group.position.y = shift; group.updateMatrixWorld(true);
				P.pos.y += d; camera.position.y += d;
				for (const g of pool) g.y += d;
			}
		}
		const vc = cv();
		depth = Math.max(0, -(vc.y - EYE));
		marksNear(depth);
		stream(dt, vc);
		light(vc);
		for (const mk of built.values()) mk.update?.(dt, t);
		ripples.update(dt);
		// the band you are in: its air, a word on arriving
		const bi = bandIndex(depth), b = BANDS[bi];
		const nb = BANDS[Math.min(BANDS.length - 1, bi + 1)], k = nb === b ? 0 : smoothstep(nb.from - 60, nb.from, depth);
		fogC.setRGB(b.fog[0] + (nb.fog[0] - b.fog[0]) * k, b.fog[1] + (nb.fog[1] - b.fog[1]) * k, b.fog[2] + (nb.fog[2] - b.fog[2]) * k);
		if (hueShift(depth)) fogC.offsetHSL(hueShift(depth), 0, 0);
		if (bi !== lastBand) { if (lastBand >= 0) hint?.(`${b.name} · ${Math.round(depth)} m`, 4000); lastBand = bi; }
		// how deep you have been; the waystones you touch
		if (depth > saved.deepest + 1) { saved.deepest = Math.floor(depth); dirty = true; }
		for (const mk of built.values()) if (mk.way && !saved.ways.includes(mk.m.L) && Math.hypot(vc.x - mk.way.x, vc.z - mk.way.z) < 4 && Math.abs(vc.y - EYE - mk.way.y) < 3) {
			saved.ways.push(mk.m.L); mk.way.mat.emissiveIntensity = 0.9; dirty = true;
			phrase([0, 4, 7], 0.14, { vel: 0.45, dur: 2 });
			hint?.(`A waystone at ${Math.round(mk.m.D)} m wakes to your touch. From the foot of the rope the lift will bring you here again.`, 5500);
		}
		saveT -= dt;
		if (dirty && saveT <= 0) { saveT = 2; save(); }
		// a fall: from the bridge into the chasm, or out of the rock altogether
		if (P && !climb) {
			const foot = vc.y - EYE;
			safeT -= dt;
			if (P.grounded && safeT <= 0) { safeT = 0.5; const f = F.floor(vc.x, vc.z, foot + 0.5); if (f != null && Math.abs(f - foot) < 0.6) lastSafe = { x: vc.x, y: foot, z: vc.z }; }
			let fell = lastSafe && foot < lastSafe.y - 24;
			for (const mk of built.values()) if (mk.m.bridge && foot < mk.m.y - 7 && foot > mk.m.y - 40 && Math.hypot(vc.x - mk.m.x, vc.z - mk.m.z) < 30) { fell = true; lastSafe = { ...mk.m.bridge.A }; }
			if (fell && lastSafe) {
				P.pos.set(lastSafe.x, lastSafe.y + shift + EYE + 0.2, lastSafe.z); P.vel.set(0, 0, 0); camera.position.copy(P.pos);
				hint?.('You catch hold of the rock and haul yourself back up.', 3000);
			}
		}
		const text = `⬇ ${Math.round(depth)} m · ${b.name}${hueShift(depth) ? ' ' + romanOf(Math.floor((depth - 2200) / 800) + 1) : ''} · deepest ${Math.round(saved.deepest)} m`;
		if (meter.style.display !== 'block') meter.style.display = 'block';
		if (meter.textContent !== text) meter.textContent = text;
	}
	const romanOf = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][(n - 1) % 10] + (n > 10 ? '·' + Math.ceil(n / 10) : '');

	// ---------- what the strike prompt offers ----------
	const gateTargets = stones.map((s) => ({ pos: new THREE.Vector3(s.x, s.y + s.h * 0.55, s.z), r: 0.7, mesh: s.m, color: 0xbff6ff, label: 'Strike the stone', icon: '🔔', reach: 3.4, act: () => strikeGate(s) }));
	const descend = { pos: new THREE.Vector3(plan.x, gy + 0.9, plan.z), r: 2.6, label: 'Climb down the rope into the Deep', icon: '⬇', color: 0xaef0ff, reach: 2.4, act: () => climbDown() };
	const wp = new THREE.Vector3();
	function targets() {
		if (disposed || busy || climb) return [];
		if (!active) {
			if (Math.hypot(camera.position.x - plan.x, camera.position.y - gy - EYE, camera.position.z - plan.z) > 14) return [];
			return saved.open && puzzle.sink >= 1 ? [...gateTargets, descend] : gateTargets;
		}
		const out = [];
		const add = (t) => { t.pos = wp.copy(t.local).setY(t.local.y + shift).clone(); out.push(t); };
		if (depth < 40) landingTargets.forEach(add);
		for (const mk of built.values()) mk.targets.forEach(add);
		return out;
	}

	function dispose() {
		if (disposed) return;
		deactivate();
		disposed = true;
		UW.fog = fogFn;
		scene.remove(gate, group, backdrop);
		backdrop.geometry.dispose(); backdrop.material.dispose();
		gate.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
		for (const g of [...lamps, sealGlow]) g.k = 0;
		for (const m of mats.values()) m.dispose();
		for (const m of propMats.values()) m.dispose();
		for (const g of Object.values(propGeo)) g.dispose();
		for (const g of [boxGeo, cylGeo, wayGeo, beadGeo]) g.dispose();
		stoneMat.dispose(); ripples.dispose();
		landing.traverse((o) => { if (o.material && o.material !== rope.material) o.material.dispose?.(); if (o.geometry && o.geometry !== boxGeo && o.geometry !== cylGeo) o.geometry.dispose(); });
		veil.remove(); meter.remove();
		for (const g of pool) g.k = 0;
	}

	return {
		gate: { x: plan.x, z: plan.z, y: gy, via: via && { name: via.name, x: via.x, z: via.z, y: via.y } },
		active: () => active,
		inside: () => (active ? 1 : 0),
		floor, push, gatePush, update, targets, dispose,
		// for the guide and the tests
		info: () => ({ open: saved.open, active, depth: Math.round(depth), deepest: saved.deepest, band: BANDS[bandIndex(depth)].name, waystones: saved.ways.length, alcoves: restored(), shift, chunks: chunks.size, meshes: [...chunks.values()].filter((c) => c.mesh).length, fine: [...chunks.values()].filter((c) => c.mesh && c.v === VF).length, tris: [...chunks.values()].reduce((s, c) => s + (c.mesh ? c.mesh.geometry.index.count / 3 : 0), 0), landmarks: [...built.values()].map((mk) => mk.m.kind + '@' + Math.round(mk.m.D)), heard: puzzle.heard, progress: puzzle.at, climbing: !!climb, gate: { x: Math.round(plan.x), y: Math.round(gy), z: Math.round(plan.z) }, time: t0 }),
		// Crysis.deep('gate' | 'open' | depth): stand at the gate, open it, or go to a depth
		go(where) {
			if (where === 'gate') { deactivate(); const P = player?.(); if (!P) return 'no player'; standInHall(P, 7); return 'in the gate hall'; }
			if (where === 'down') { climbDown(); return 'climbing down'; }
			if (where === 'up') { climbUp(); return 'climbing up'; }
			if (where === 'open') { if (!saved.open) { puzzle.opening = true; puzzle.sink = 0.999; saved.open = true; save(); } return 'open'; }
			const D = Math.max(0, +where || 0);
			const L1 = Math.floor((D - 45) / LM), m = F.landmark(L1);
			return placeAt(D, m && Math.abs(m.D - D) < 3 ? m : null);
		},
		// the call the ring plays (for the tests): stone indices in order
		strikeStone: (i) => strikeGate(stones[i]),
		call: () => call.slice(),
		chorus: () => [...built.values()].filter((mk) => mk.chorus).map((mk) => ({ L: mk.m.L, D: Math.round(mk.m.D), mask: mk.chorus.mask, strike: (i) => strikeChorus(mk.chorus, i, mk.m, new THREE.Color(...BANDS[mk.m.band].glow)) })),
		landmark: (L) => F.landmark(L),
		field: F,
	};
}

// a few geometries as one (positions, normals, index)
function mergeGeos(list) {
	const pos = [], nrm = [], idx = [];
	let base = 0;
	for (const g0 of list) {
		const g = g0.index ? g0 : g0.toNonIndexed();
		const p = g.attributes.position, n = g.attributes.normal;
		for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); }
		if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
		else for (let i = 0; i < p.count; i++) idx.push(i + base);
		base += p.count;
		g0.dispose();
	}
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
	out.setIndex(idx);
	return out;
}
