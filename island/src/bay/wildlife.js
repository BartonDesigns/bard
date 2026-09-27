// The Bay Area's wild animals, the ones you notice without looking for them (with the
// naturalist's field guide, nature/fieldguide.js, for who is about when): turkey vultures
// rocking in kettles over the ridges on the midday thermals and a red-tailed hawk circling
// alone; brown pelicans in a line just above the surf (May to December); western gulls
// wheeling over the bay and the beaches; black-tailed deer out at the edges of the grass at
// dawn and dusk, heads down grazing until you come close, then away in bounds.
// Spot one (near enough, in front of you) and it goes in your field journal.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES, TRAILS } from '../nature/fieldguide.js';
import { toWorld } from './geo.js';

const GUIDE = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const inHours = (s, h) => { const [a, b] = s.hours; return a <= b ? h >= a && h < b : h >= a || h < b; };
const TRAIL_AT = TRAILS.map((t) => ({ ...t, ...toWorld(t.lat, t.lon) }));
const about = (id, h, month) => { const s = GUIDE[id]; return !!s && s.months.includes(month) && inHours(s, h); };

// a bird: body, head, and wings held out (dihedral for the vultures' V)
function birdGeo(span, dihedral, body = 0.12) {
	const g = [new THREE.CapsuleGeometry(body, span * 0.28, 3, 6).rotateX(Math.PI / 2), new THREE.SphereGeometry(body * 0.8, 6, 5).translate(0, 0.02, span * 0.2)];
	for (const s of [-1, 1]) {
		const w = new THREE.BoxGeometry(span / 2, 0.02, span * 0.16).translate(s * span / 4, 0, 0);
		w.rotateZ(s * dihedral);
		g.push(w);
	}
	g.push(new THREE.BoxGeometry(span * 0.14, 0.02, span * 0.12).translate(0, 0, -span * 0.22));
	return mergeGeometries(g.map((q) => q.toNonIndexed()));
}
function deerGeo() {
	const g = [new THREE.CapsuleGeometry(0.28, 0.8, 4, 8).rotateX(Math.PI / 2).translate(0, 0.95, 0),
		new THREE.CylinderGeometry(0.09, 0.12, 0.55, 6).rotateX(-0.7).translate(0, 1.3, 0.55),
		new THREE.CapsuleGeometry(0.1, 0.22, 3, 6).rotateX(Math.PI / 2 - 0.4).translate(0, 1.52, 0.78),
		new THREE.ConeGeometry(0.05, 0.16, 4).translate(0.09, 1.66, 0.7), new THREE.ConeGeometry(0.05, 0.16, 4).translate(-0.09, 1.66, 0.7),
		new THREE.ConeGeometry(0.06, 0.2, 5).rotateX(Math.PI / 2 + 0.6).translate(0, 1.05, -0.62)];
	for (const [x, z] of [[-0.16, 0.42], [0.16, 0.42], [-0.16, -0.42], [0.16, -0.42]]) g.push(new THREE.CylinderGeometry(0.04, 0.035, 0.8, 5).translate(x, 0.4, z));
	return mergeGeometries(g.map((q) => q.toNonIndexed()));
}

export function createWildlife(scene, bay, { isPhone = false, hint = () => {}, say = () => {} } = {}) {
	const group = new THREE.Group();
	group.name = 'wildlife';
	scene.add(group);
	const mk = (geo, color, n) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), n); m.count = 0; m.frustumCulled = false; group.add(m); return m; };
	const vult = mk(birdGeo(1.8, 0.18), 0x2a2522, 16), hawk = mk(birdGeo(1.25, 0.03), 0x6a4a30, 3);
	const pel = mk(birdGeo(2.1, 0.0, 0.16), 0x5d5a55, 12), gull = mk(birdGeo(1.35, 0.06, 0.1), 0xe8e8e4, 14), deer = mk(deerGeo(), 0x7a5e44, 8);
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
	const g = (x, z) => bay.heightAt(x, z);
	let seed = 1;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

	// ---------- the field journal ----------
	let journal = {};
	try { journal = JSON.parse(localStorage.getItem('crysis-field') || '{}'); } catch { journal = {}; }
	function spot(id) {
		if (journal[id]) return;
		journal[id] = Date.now();
		try { localStorage.setItem('crysis-field', JSON.stringify(journal)); } catch { /* private window */ }
		const s = GUIDE[id];
		hint(`Field journal: ${s.name} ✓\n${s.note}`, 6500);
		say(`${s.name}: ${s.note}`, 'note');
	}
	const seen = (cam, x, y, z, range) => {
		const dx = x - cam.position.x, dy = y - cam.position.y, dz = z - cam.position.z, d = Math.hypot(dx, dy, dz);
		if (d > range) return false;
		const f = new THREE.Vector3(); cam.getWorldDirection(f);
		return (dx * f.x + dy * f.y + dz * f.z) / d > 0.85;
	};

	// ---------- who is about, placed round you now and then ----------
	let kettles = [], pels = null, gulls = [], herd = [], cx = 1e9, cz = 1e9, lastH = -1, hawkK = null;
	function place(cam, h, month) {
		cx = cam.position.x; cz = cam.position.z; lastH = h;
		seed = (Math.floor(cx / 900) * 7919 + Math.floor(cz / 900) * 104729 + 17) >>> 0 || 1;
		// vultures over the highest ground near you, on the midday thermals
		kettles = [];
		if (about('turkey_vulture', h, month)) for (let k = 0; k < 40 && kettles.length < (isPhone ? 2 : 3); k++) {
			const x = cx + (rnd() - 0.5) * 3000, z = cz + (rnd() - 0.5) * 3000, gh = g(x, z);
			if (gh > 120) kettles.push({ x, z, y: gh + 80 + rnd() * 150, r: 30 + rnd() * 60, n: 3 + Math.floor(rnd() * 4), ph: rnd() * 6, drift: rnd() * 6.28 });
		}
		hawkK = about('red_tailed_hawk', h, month) ? (() => { for (let k = 0; k < 30; k++) { const x = cx + (rnd() - 0.5) * 1400, z = cz + (rnd() - 0.5) * 1400, gh = g(x, z); if (gh > 20) return { x, z, y: gh + 60 + rnd() * 60, r: 40 + rnd() * 30, ph: rnd() * 6 }; } return null; })() : null;
		// pelicans: find the surf line near you, and fly along it
		pels = null;
		if (about('brown_pelican', h, month)) for (let k = 0; k < 60 && !pels; k++) {
			const x = cx + (rnd() - 0.5) * 2400, z = cz + (rnd() - 0.5) * 2400, gh = g(x, z);
			if (gh < -1 && gh > -8) {
				const gx = g(x + 30, z) - g(x - 30, z), gz = g(x, z + 30) - g(x, z - 30), l = Math.hypot(gx, gz);
				if (l < 0.5) continue;
				pels = { x, z, tx: -gz / l, tz: gx / l, n: 5 + Math.floor(rnd() * 7), t0: performance.now() / 1000, dir: rnd() < 0.5 ? 1 : -1 };
			}
		}
		// gulls over any water near you
		gulls = [];
		if (about('western_gull', h, month)) for (let k = 0; k < 50 && gulls.length < (isPhone ? 7 : 14); k++) {
			const x = cx + (rnd() - 0.5) * 900, z = cz + (rnd() - 0.5) * 900;
			if (g(x, z) < 0.5) gulls.push({ x, z, y: 8 + rnd() * 25, r: 15 + rnd() * 40, sp: (0.15 + rnd() * 0.25) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6 });
		}
		// deer at dawn and dusk, on open grassy ground off the streets
		herd = [];
		if (about('black_tailed_deer', h, month) && (h > 16.5 || h < 8.5)) for (let k = 0; k < 80 && herd.length < (isPhone ? 4 : 7); k++) {
			const x = cx + (rnd() - 0.5) * 360, z = cz + (rnd() - 0.5) * 360, gh = g(x, z);
			if (gh < 8 || bay.urbanAt(x, z).u > 0.35 || Math.hypot(x - cx, z - cz) < 40) continue;
			const sl = Math.hypot(g(x + 5, z) - g(x - 5, z), g(x, z + 5) - g(x, z - 5)) / 10;
			if (sl > 0.4) continue;
			const n = 1 + Math.floor(rnd() * 3);
			for (let i = 0; i < n && herd.length < 7; i++) herd.push({ x: x + (rnd() - 0.5) * 12, z: z + (rnd() - 0.5) * 12, yaw: rnd() * 6.28, ph: rnd() * 10, flee: 0, vx: 0, vz: 0 });
		}
	}

	// at a trailhead: the naturalist's note, and what is out today (three likely, one to hope for)
	let trailSeen = null;
	function outToday(T, h, month) {
		const now = (s) => s.months.includes(month) && inHours(s, h) && s.kind !== 'rock' && s.kind !== 'plant';
		const here = (s) => !s.where || s.where.some(([la, lo, r]) => { const w = toWorld(la, lo); return Math.hypot(w.x - T.x, w.z - T.z) < r + 400; });
		const local = SPECIES.filter((s) => now(s) && s.where && here(s)), common = SPECIES.filter((s) => now(s) && !s.where && s.rarity <= 2);
		const pickN = (L, n) => L.map((s, i) => [Math.sin(i * 12.9898 + T.x * 0.001) % 1, s]).sort((a, b) => a[0] - b[0]).slice(0, n).map((q) => q[1]);
		const likely = [...pickN(local.filter((s) => s.rarity <= 3), 3), ...pickN(common, 3)].slice(0, 3);
		const rare = pickN(SPECIES.filter((s) => now(s) && here(s) && s.rarity >= 4), 1)[0];
		return { likely, rare };
	}
	function update(dt, t, cam, hours) {
		const month = new Date().getMonth() + 1;
		const tr = cam.position.y - g(cam.position.x, cam.position.z) < 60 ? TRAIL_AT.find((T) => Math.hypot(T.x - cam.position.x, T.z - cam.position.z) < 250) : null;
		if (tr && tr !== trailSeen) {
			const { likely, rare } = outToday(tr, hours, month);
			hint(`${tr.name}\n${tr.note}${likely.length ? '\nOut today: ' + likely.map((s) => s.name).join(', ') : ''}${rare ? '\nIf you are lucky: ' + rare.name : ''}`, 9000);
		}
		trailSeen = tr || (trailSeen && Math.hypot(trailSeen.x - cam.position.x, trailSeen.z - cam.position.z) < 400 ? trailSeen : null);
		const onBay = bay.loaded() && Math.max(Math.abs(cam.position.x), Math.abs(cam.position.z)) > 1600 && cam.position.y < 2500;
		group.visible = onBay;
		if (!onBay) return;
		if (Math.hypot(cam.position.x - cx, cam.position.z - cz) > 900 || Math.abs(hours - lastH) > 0.75) place(cam, hours, month);
		// vultures: rocking in the V, circling, the kettle drifting downwind
		let n = 0;
		for (const K of kettles) for (let i = 0; i < K.n && n < 16; i++) {
			const a = t * 0.12 * (i % 2 ? 1 : 0.9) + K.ph + i * 1.3, r = K.r * (0.6 + (i % 3) * 0.25);
			const x = K.x + Math.cos(a) * r + Math.cos(K.drift) * t * 0.3 % 400, z = K.z + Math.sin(a) * r + Math.sin(K.drift) * t * 0.3 % 400, y = K.y + i * 6 + Math.sin(t * 0.2 + i) * 4;
			e.set(0, -a, 0.28 + Math.sin(t * 1.7 + i) * 0.12); q.setFromEuler(e);
			vult.setMatrixAt(n++, m4.compose(p.set(x, y, z), q, s1));
			if (n === 1 && seen(cam, x, y, z, 260)) spot('turkey_vulture');
		}
		vult.count = n; vult.instanceMatrix.needsUpdate = true;
		if (hawkK) {
			const a = t * 0.16 + hawkK.ph, x = hawkK.x + Math.cos(a) * hawkK.r, z = hawkK.z + Math.sin(a) * hawkK.r;
			e.set(0, -a, 0.2); q.setFromEuler(e);
			hawk.setMatrixAt(0, m4.compose(p.set(x, hawkK.y, z), q, s1)); hawk.count = 1; hawk.instanceMatrix.needsUpdate = true;
			if (seen(cam, x, hawkK.y, z, 200)) spot('red_tailed_hawk');
		} else hawk.count = 0;
		// pelicans: a line gliding a metre or two over the water, along the surf, one after another
		if (pels) {
			const u = ((t - pels.t0) * 11) % 1400 - 700;
			for (let i = 0; i < pels.n; i++) {
				const d = (u - i * 7) * pels.dir, x = pels.x + pels.tx * d, z = pels.z + pels.tz * d;
				e.set(0, Math.atan2(pels.tx * pels.dir, pels.tz * pels.dir), Math.sin(t + i) * 0.05); q.setFromEuler(e);
				pel.setMatrixAt(i, m4.compose(p.set(x, 1.6 + Math.sin(t * 0.8 + i * 0.6) * 0.5, z), q, s1));
				if (i === 0 && seen(cam, x, 1.6, z, 260)) spot('brown_pelican');
			}
			pel.count = pels.n; pel.instanceMatrix.needsUpdate = true;
		} else pel.count = 0;
		gulls.forEach((G, i) => {
			const a = t * G.sp + G.ph, x = G.x + Math.cos(a) * G.r, z = G.z + Math.sin(a) * G.r, y = G.y + Math.sin(t * 0.5 + i) * 3;
			e.set(Math.sin(t * 3 + i) * 0.1, -a + (G.sp > 0 ? Math.PI : 0), (G.sp > 0 ? -1 : 1) * 0.35); q.setFromEuler(e);
			gull.setMatrixAt(i, m4.compose(p.set(x, y, z), q, s1));
			if (i === 0 && seen(cam, x, y, z, 120)) spot('western_gull');
		});
		gull.count = gulls.length; gull.instanceMatrix.needsUpdate = true;
		// deer: grazing, heads up now and then; closer than 30 m and they bound off
		herd.forEach((D, i) => {
			const dx = D.x - cam.position.x, dz = D.z - cam.position.z, d = Math.hypot(dx, dz);
			if (d < 30 && !D.flee) { D.flee = 3.5; D.vx = dx / d * 9; D.vz = dz / d * 9; D.yaw = Math.atan2(dx, dz); }
			let hop = 0, pitch = Math.sin(t * 0.4 + D.ph) > 0.3 ? 0.35 : 0;          // grazing, head down
			if (D.flee > 0) { D.flee -= dt; D.x += D.vx * dt; D.z += D.vz * dt; hop = Math.abs(Math.sin(t * 7 + D.ph)) * 0.7; pitch = -0.15; }
			e.set(pitch * 0.2, D.yaw, 0); q.setFromEuler(e);
			deer.setMatrixAt(i, m4.compose(p.set(D.x, g(D.x, D.z) + hop, D.z), q, s1));
			if (d < 90 && seen(cam, D.x, g(D.x, D.z) + 1, D.z, 90)) spot('black_tailed_deer');
		});
		deer.count = herd.length; deer.instanceMatrix.needsUpdate = true;
	}
	return { group, update, journal: () => Object.keys(journal).map((id) => GUIDE[id]?.name).filter(Boolean) };
}
