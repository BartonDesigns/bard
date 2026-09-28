// A realm on another world (plan.js sites it): built here and kept alive. The castle,
// the town, the mills, the watchtowers and the stones are each one mesh of the building
// kit (kit.js, build.js); banners and flags move in the wind, the mills turn, torches and
// lanterns and lit windows come on at dusk. Below, the dungeons (dungeon.js) join the
// caves; the dead walk in them (foes.js). The people (folk.js) have errands for you
// (quests.js).
//
// It joins the world as the others do: its floors and walls through island.extraFloor /
// extraPush, its dungeons through island.underFloor / underPush ahead of the caves', its
// dark through the underworld's own measure of how far down you are.

import * as THREE from 'three';
import { mulberry32, smoothstep, clamp } from '../../noise.js';
import { createMedievalInteriors } from '../../interiors/medieval.js';
import { Kit, M, kitUniforms, kitMaterial, flameMaterial, flameGeometry, haloMaterial, armsTexture, bannerMaterial, bannerGeo, riverMaterial } from './kit.js';
import { createCollide } from './collide.js';
import { buildCastle, buildHouse, buildSmithy, buildChapel, buildStall, buildSquare, buildWindmill, buildWatermill, buildWatchtower, buildStones, buildBridge, buildField, riverGeometry } from './build.js';
import { buildDungeons, buildStairHead } from './dungeon.js';
import { createFolk, makeOne } from './folk.js';
import { createFoes, createDust } from './foes.js';
import { createQuests, markTexture } from './quests.js';
import { createMotion } from '../../people/motion.js';

const EYE = 1.68;

export function createMedieval(realm, o) {
	const { island, shared, scene, camera, isPhone, hint, mount } = o;
	const uw = o.underworld;
	const H = island.heightAt;
	const rnd = mulberry32((realm.seed ^ 0x5eaf00d) >>> 0);
	const group = new THREE.Group();
	group.name = 'medieval';
	scene.add(group);
	const U = kitUniforms(shared);
	U.uSnow.value = realm.style.snow || 0;
	const mat = kitMaterial(U, { key: 's' });
	const col = createCollide();
	// (the barrow's turf takes the colour of this world's grass)
	const bD = realm.barrow, bio = bD ? island.biomes?.at(bD.x, bD.z)?.alt || 0 : 0, g0 = o.profile?.ground?.grass || [0.3, 0.46, 0.14], g1 = o.profile?.alt?.ground?.grass || g0;
	const turf = g0.map((v, i) => Math.min(1, (v * (1 - bio) + g1[i] * bio) * 1.1));
	const ctx = { turf, k: null, col, realm, st: realm.style, r: rnd, H, flames: [], lights: [], banners: [], flags: [], spinners: [], chimneys: [], coals: [], newKit: () => new Kit(), avoid: [], roadDist: realm.roadDist };
	for (const D of realm.dungeons) ctx.avoid.push({ x: D.hole.x, z: D.hole.z, r: D.hole.r + 1.8 });
	if (realm.chapel) ctx.avoid.push({ x: realm.chapel.x + Math.sin(realm.chapel.yaw) * 12, z: realm.chapel.z + Math.cos(realm.chapel.yaw) * 12, r: 3.5 });
	const C = realm.castle, T = realm.town;

	// ---------- the buildings, one mesh a place ----------
	const clusters = [];
	const cluster = (name, x, z, r, fn) => {
		const k = new Kit();
		ctx.k = k;
		fn(k);
		if (!k.count) return null;
		const m = new THREE.Mesh(k.build(), mat);
		m.castShadow = true; m.receiveShadow = true;
		m.matrixAutoUpdate = false;
		m.name = 'medieval-' + name;
		m.userData.material175 = 'stone';
		group.add(m);
		const c = { name, x, z, r, mesh: m, far: r > 80 ? 5000 : 1400 };
		clusters.push(c);
		return c;
	};
	const dByid = (id) => realm.dungeons.find((d) => d.id === id);
	cluster('castle', C.x, C.z, 60, (k) => {
		buildCastle(ctx);
		const D = dByid('cellar');
		if (D) buildStairHead(ctx, D, H);
		// the flagpoles
		k.at(0, 0, 0, 0);
		for (const f of ctx.flags) k.beam([f.x, f.y - 0.2, f.z], [f.x, f.y + f.h, f.z], 0.1, 0.1, M.TIMBER, [0.3, 0.22, 0.14]);
	});
	cluster('town', T.x, T.z, 100, () => {
		for (const b of realm.houses) {
			if (b.kind === 'chapel') buildChapel(ctx, b);
			else if (b.kind === 'smithy') buildSmithy(ctx, b);
			else buildHouse(ctx, b);
		}
		realm.innDoor = ctx.innDoor;
		for (const s of realm.stalls) buildStall(ctx, s);
		buildSquare(ctx);
		const D = dByid('crypt');
		if (D) buildStairHead(ctx, D, H);
	});
	if (realm.windmill) cluster('windmill', realm.windmill.x, realm.windmill.z, 14, () => buildWindmill(ctx, realm.windmill));
	if (realm.watermill) cluster('watermill', realm.watermill.x, realm.watermill.z, 14, () => buildWatermill(ctx, realm.watermill));
	realm.watchtowers.forEach((t, i) => cluster('watchtower' + i, t.x, t.z, 10, () => buildWatchtower(ctx, t)));
	if (realm.stones) cluster('stones', realm.stones.x, realm.stones.z, 14, () => buildStones(ctx, realm.stones));
	const hedge = [];
	if (realm.fields.length) {
		let cx = 0, cz = 0;
		for (const f of realm.fields) { cx += f.x; cz += f.z; }
		cx /= realm.fields.length; cz /= realm.fields.length;
		cluster('fields', cx, cz, 300, () => { for (const f of realm.fields) buildField(ctx, f, hedge); });
	}
	for (const [i, b] of realm.bridges.entries()) cluster('bridge' + i, b.x, b.z, b.len, () => buildBridge(ctx, b));
	const barrowD = dByid('barrow');
	if (barrowD) cluster('barrow', barrowD.x, barrowD.z, 20, () => buildStairHead(ctx, barrowD, H));

	// ---------- hedgerows: leafy clumps, instanced ----------
	if (hedge.length) {
		const k = new Kit();
		k.lathe([[0.5, -0.3], [0.8, 0.3], [0.78, 0.85], [0.5, 1.3], [0.1, 1.5]], 7, M.LEAF, [0.2, 0.32, 0.12], 0, Math.PI * 2);
		const g = k.build();
		const p = g.attributes.position;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.18 * Math.sin(x * 7 + y * 5) * Math.sin(z * 6 - y * 3); p.setXYZ(i, x * n, y, z * n); }
		g.computeVertexNormals();
		const im = new THREE.InstancedMesh(g, mat, hedge.length);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
		hedge.forEach((h, i) => { im.setMatrixAt(i, m4.compose(v.set(h.x, h.y, h.z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), s.set(h.s, h.s * (0.85 + rnd() * 0.3), h.s))); });
		im.computeBoundingSphere();
		im.castShadow = true; im.receiveShadow = true;
		group.add(im);
		clusters.push({ name: 'hedges', x: im.boundingSphere.center.x, z: im.boundingSphere.center.z, r: im.boundingSphere.radius, mesh: im, far: 1400 });
	}
	// ---------- sheep in the pasture ----------
	const pasture = realm.fields.find((f) => f.crop === 'pasture');
	if (pasture) {
		const k = new Kit();
		k.at(0, 0, 0, 0);
		const wool = [0.86, 0.84, 0.78], dark = [0.1, 0.09, 0.085];
		k.lathe([[0.05, 0.42], [0.3, 0.46], [0.36, 0.62], [0.33, 0.8], [0.18, 0.9], [0.02, 0.92]], 9, M.LEAF, wool);
		k.at(0, 0, 0, 0);
		const g0 = k.build();
		// (the body lies along z: squash the lathe into a long fleece)
		const p = g0.attributes.position;
		for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 0.95, p.getY(i), p.getZ(i) * 1.5);
		const k2 = new Kit();
		k2.box(-0.09, 0.62, 0.48, 0.09, 0.8, 0.72, M.PLAIN, dark);
		k2.box(-0.1, 0.72, 0.5, -0.02, 0.76, 0.58, M.PLAIN, dark);
		for (const [x, z] of [[-0.15, -0.3], [0.15, -0.3], [-0.15, 0.3], [0.15, 0.3]]) k2.box(x - 0.04, 0, z - 0.04, x + 0.04, 0.5, z + 0.04, M.PLAIN, dark);
		const g1 = k2.build();
		const kk = new Kit();
		kk.P = [...g0.attributes.position.array, ...g1.attributes.position.array];
		kk.N = [...g0.attributes.normal.array, ...g1.attributes.normal.array];
		kk.U = [...g0.attributes.uv.array, ...g1.attributes.uv.array];
		kk.C = [...g0.attributes.color.array, ...g1.attributes.color.array];
		kk.A = [...g0.attributes.aMat.array, ...g1.attributes.aMat.array];
		kk.I = [...g0.index.array, ...Array.from(g1.index.array, (i) => i + g0.attributes.position.count)];
		const g = kk.build();
		g.computeVertexNormals();
		const n = isPhone ? 6 : 9;
		const im = new THREE.InstancedMesh(g, mat, n);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), e = new THREE.Euler();
		for (let i = 0; i < n; i++) {
			const u = (rnd() - 0.5) * pasture.w * 0.8, w = (rnd() - 0.5) * pasture.d * 0.8;
			const x = pasture.x + u * Math.cos(pasture.yaw) + w * Math.sin(pasture.yaw), z = pasture.z - u * Math.sin(pasture.yaw) + w * Math.cos(pasture.yaw);
			im.setMatrixAt(i, m4.compose(v.set(x, H(x, z), z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), s.setScalar(0.9 + rnd() * 0.25)));
		}
		im.computeBoundingSphere();
		im.castShadow = true;
		group.add(im);
		clusters.push({ name: 'sheep', x: pasture.x, z: pasture.z, r: 40, mesh: im, far: 700 });
	}

	// ---------- the river ----------
	if (realm.river) {
		const rg = riverGeometry(realm.river), g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(rg.pos, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(rg.uv, 2));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(rg.pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
		g.setIndex(rg.idx);
		g.computeBoundingSphere();
		const m = new THREE.Mesh(g, riverMaterial(shared));
		m.renderOrder = 2;
		m.receiveShadow = true;
		group.add(m);
	}

	// ---------- wind: banners and flags; the mills ----------
	const armsTex = armsTexture(realm.arms);
	{
		const wd = shared.uWindDir.value, along = [wd.x, 0, wd.y], side = [-wd.y, 0, wd.x];
		const list = [...ctx.banners];
		for (const f of ctx.flags) list.push({ a: [f.x + along[0] * 0.08, f.y + f.h - 0.05, f.z + along[2] * 0.08], along, len: f.big ? 3.4 : 2.3, across: [0, -1, 0], wide: f.big ? 2.0 : 1.4, axis: side.map((q) => q * 0.8), flag: true });
		if (list.length) {
			const m = new THREE.Mesh(bannerGeo(list), bannerMaterial(shared, armsTex));
			m.castShadow = true;
			m.frustumCulled = false;
			group.add(m);
		}
	}
	const spin = [];
	for (const s of ctx.spinners) {
		const g = new THREE.Group();
		g.position.set(s.x, s.y, s.z);
		g.rotation.y = s.yaw;
		const m = new THREE.Mesh(s.kit.build(), mat);
		m.castShadow = true;
		g.add(m);
		group.add(g);
		spin.push({ m, axis: s.axis, speed: s.speed });
	}

	// the houses' ground floors, furnished as you come to them (interiors/medieval.js)
	const inner = createMedievalInteriors({ group, mat, col, houses: realm.houses, isPhone });

	// ---------- fire and light ----------
	const fm = flameMaterial(shared), fmAlways = flameMaterial(shared);
	const flNight = ctx.flames.filter((f) => !f.always), flDay = ctx.flames.filter((f) => f.always);
	const nightFlames = flNight.length ? new THREE.Mesh(flameGeometry(flNight), fm) : null;
	const dayFlames = flDay.length ? new THREE.Mesh(flameGeometry(flDay), fmAlways) : null;
	for (const f of [nightFlames, dayFlames]) if (f) { f.renderOrder = 6; group.add(f); }
	const haloM = haloMaterial(shared);
	let halos = null;
	if (ctx.lights.length) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(ctx.lights.flatMap((l) => [l.x, l.y, l.z]), 3));
		g.setAttribute('aSize', new THREE.Float32BufferAttribute(ctx.lights.map((l) => (l.hearth ? 2.4 : 1.2)), 1));
		halos = new THREE.Points(g, haloM);
		halos.frustumCulled = false;
		halos.renderOrder = 7;
		group.add(halos);
	}
	const lamp = new THREE.PointLight(0xffa050, 0, 16, 1.6);
	group.add(lamp);
	// the beacons on the watchtowers, lit by a quest
	const beacons = realm.watchtowers.map((t) => ({ door: { x: t.door[0], y: t.door[1], z: t.door[2] }, top: { x: t.beacon[0], y: t.beacon[1], z: t.beacon[2] }, fire: null }));
	const bm = flameMaterial(shared);
	function lightBeacon(i) {
		const b = beacons[i];
		if (!b || b.fire) return;
		b.fire = new THREE.Mesh(flameGeometry([{ ...b.top, s: 1.3 }, { x: b.top.x + 0.3, y: b.top.y, z: b.top.z - 0.2, s: 1.0 }, { x: b.top.x - 0.3, y: b.top.y, z: b.top.z + 0.25, s: 0.9 }]), bm);
		b.fire.renderOrder = 6;
		group.add(b.fire);
		ctx.lights.push({ x: b.top.x, y: b.top.y + 1, z: b.top.z, r: 22, always: true, beacon: true });
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute([b.top.x, b.top.y + 1.2, b.top.z], 3));
		g.setAttribute('aSize', new THREE.Float32BufferAttribute([9], 1));
		const hm = haloMaterial(shared);
		hm.uniforms.uK.value = 1;
		const p = new THREE.Points(g, hm);
		p.frustumCulled = false;
		b.halo = p;
		group.add(p);
	}

	// ---------- the dungeons ----------
	const DG = uw?.lighting ? buildDungeons(realm, { st: realm.style, rnd }) : [];
	const U2 = kitUniforms(shared);
	U2.uTorchK.value = 0;
	const dmat = DG.length ? uw.lighting.lit(kitMaterial(U2, { key: 'd' }), 'medkit') : null;
	const dfm = flameMaterial(shared);
	const dgroups = [];
	for (const d of DG) {
		const g = new THREE.Group();
		g.name = 'dungeon-' + d.D.id;
		const m = new THREE.Mesh(d.kit.build(), dmat);
		m.matrixAutoUpdate = false;
		m.receiveShadow = true;
		m.userData.material175 = 'stone';
		g.add(m);
		if (d.flames.length) { const f = new THREE.Mesh(flameGeometry(d.flames), dfm); f.renderOrder = 6; g.add(f); }
		for (const l of d.lights) uw.addGlow(l.x, l.y, l.z, 10, [1.0, 0.6, 0.28], 1.6, 0.3, true);
		// the chest, its lid on a hinge
		if (d.props.chest) {
			const c = d.props.chest, k = new Kit();
			k.box(-0.6, 0, -0.38, 0.6, 0.55, 0.38, M.PLANK, [0.42, 0.3, 0.18]);
			for (const x of [-0.45, 0, 0.45]) k.box(x - 0.05, -0.01, -0.39, x + 0.05, 0.56, 0.39, M.IRON, [0.2, 0.2, 0.21]);
			const body = new THREE.Mesh(k.build(), dmat);
			body.position.set(c.x, c.y, c.z); body.rotation.y = c.yaw;
			const lk = new Kit();
			lk.box(-0.6, 0, 0, 0.6, 0.2, 0.76, M.PLANK, [0.44, 0.31, 0.19]);
			for (const x of [-0.45, 0, 0.45]) lk.box(x - 0.05, -0.01, -0.01, x + 0.05, 0.21, 0.77, M.IRON, [0.2, 0.2, 0.21]);
			const lid = new THREE.Mesh(lk.build(), dmat);
			lid.position.set(0, 0.55, -0.38);
			body.add(lid);
			g.add(body);
			d.lid = lid;
		}
		// the portcullis, down until its lever is pulled
		if (d.props.gate) {
			const G = d.props.gate, gm = new THREE.Mesh(G.kit.build(), dmat);
			gm.position.set(G.x, G.y, G.z); gm.rotation.y = G.yaw;
			g.add(gm);
			G.mesh = gm;
		}
		if (d.props.lever) {
			const L = d.props.lever, k = new Kit();
			k.beam([0, 0, 0], [0, 0.55, 0.12], 0.05, 0.05, M.IRON, [0.2, 0.2, 0.21]);
			k.box(-0.06, 0.5, 0.06, 0.06, 0.62, 0.18, M.PLANK, [0.35, 0.24, 0.15]);
			const lm = new THREE.Mesh(k.build(), dmat);
			lm.position.set(L.x, L.y, L.z); lm.rotation.y = L.yaw;
			lm.rotation.x = -0.5;
			g.add(lm);
			L.mesh = lm;
		}
		group.add(g);
		dgroups.push({ d, g });
	}
	shared.moreHoles = realm.dungeons.map((D) => D.hole);
	uw?.openHoles?.();

	// ---------- where one stands and what one walks into ----------
	const boxes = DG.flatMap((d) => d.boxes.map((b) => ({ b, d })));
	const floorOf = (b, lz) => b.fy + (lz + b.hd) * b.slope;
	const localOf = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };
	// the dungeon box a foot at y is in, and its floor there
	function dungeonAt(x, z, y, pad = 0.3) {
		let best = null;
		for (const { b, d } of boxes) {
			const [lx, lz] = localOf(b, x, z);
			if (Math.abs(lx) > b.hw + pad || lz < -b.hd - pad || lz > b.hd + pad) continue;
			const f = floorOf(b, clamp(lz, -b.hd, b.hd));
			if (y < f - 1.4 || y > f + b.h - 0.35) continue;
			if (!best || (f <= y + 0.7 && f > best.f) || best.f > y + 0.7) best = { b, d, f };
		}
		return best;
	}
	function dungeonFloor(x, z, y) {
		const a = dungeonAt(x, z, y);
		if (!a) return null;
		const s = a.d.col.floor(x, z, y);
		return Math.max(a.f, s);
	}
	function dungeonPush(p, footY) {
		const R = 0.34;
		let best = null, bd = 1e9;
		for (const { b } of boxes) {
			const [lx, lz] = localOf(b, p.x, p.z);
			const f = floorOf(b, clamp(lz, -b.hd, b.hd));
			if (footY < f - 1.4 || footY > f + b.h - 0.35) continue;
			if (Math.abs(lx) > b.hw + 1.2 || lz < -b.hd - 1.2 || lz > b.hd + 1.2) continue;
			const cx = clamp(lx, -b.hw + R, b.hw - R), cz = clamp(lz, b.openA ? -1e9 : -b.hd + R, b.openB ? 1e9 : b.hd - R);
			const dd = Math.hypot(cx - lx, cz - lz);
			if (dd < 1e-5) { best = null; bd = 0; break; }
			if (dd < bd) { bd = dd; best = { b, cx, cz }; }
		}
		if (best) { const b = best.b; p.x = b.x + best.cx * b.c + best.cz * b.s; p.z = b.z - best.cx * b.s + best.cz * b.c; }
		for (const d of DG) d.col.push(p, footY, R);
	}
	const surfFloor = (x, z, y) => col.floor(x, z, y);
	const ground = (x, z, y) => { const h = H(x, z), f = col.floor(x, z, y == null ? h + 1.2 : y + 0.5); return Math.max(h, f); };
	// under the ground (a dungeon, else the caves), else the surface
	const anyGround = (x, z, y) => dungeonFloor(x, z, y) ?? island.underFloor?.(x, z, y) ?? ground(x, z, y);

	// ---------- people, and the dead ----------
	const folk = createFolk({ realm, scene, camera, ground, isPhone, arms: armsTex });
	const dust = createDust(scene, shared);
	const foeList = DG.flatMap((d) => d.foes);
	let quests = null;
	const foes = foeList.length ? createFoes({ scene, list: foeList, material: dmat, camera, where: (x, z, y) => { const a = dungeonAt(x, z, y, -0.3); return a ? a.f : null; }, dust: (x, y, z, k) => dust.puff(x, y, z, k), onHit: () => quests?.hurtBy(), onFall: (f) => { if (quests) { (quests.S.cleared[f.dungeon] ||= []).push(f.i); try { localStorage.setItem(`crysis-realm-${realm.seed}`, JSON.stringify(quests.S)); } catch { /* storage off */ } } } }) : null;

	// the child lost in the caves: past a dungeon's breach, or down a cave's own mouth
	const breachD = DG.find((d) => d.D.id === 'cellar' && d.D.breach) || DG.find((d) => d.D.breach);
	let lostSpot = null;
	if (breachD) { const t = breachD.D.breach.cave; lostSpot = { x: t.x, y: t.y, z: t.z, via: breachD.D.name.replace(/^The /, 'the '), dungeon: breachD }; }
	else if (uw?.entrances?.length && uw.plan) { const e = uw.plan.entrances[0], p = e.tunnel.pts[Math.min(e.tunnel.pts.length - 1, 10)]; lostSpot = { x: p.x, y: p.y, z: p.z, via: uw.entrances[0].name, dungeon: null }; }
	let child = null;
	async function spawnChild() {
		if (child || !lostSpot) return;
		child = { building: true };
		try {
			const P = await makeOne(realm, (realm.seed ^ 0x3a7) >>> 0, { age: 9, sex: 'm', kind: 'child' }, armsTex);
			if (uw?.lighting) P.root.traverse((q) => { if (q.material && !q.isSprite) { q.material = q.material.clone(); uw.lighting.lit(q.material, 'wat-' + q.uuid.slice(0, 4)); } });
			const Mo = createMotion(P, (x, z) => anyGround(x, z, P.root.position.y + 0.3));
			const y = anyGround(lostSpot.x, lostSpot.z, lostSpot.y + 0.5);
			Mo.place(lostSpot.x, y, lostSpot.z, 0);
			Mo.setPose('crossed');
			scene.add(P.root);
			child = { P, M: Mo, lead: null, home: false, x: lostSpot.x, y, z: lostSpot.z, name: 'Wat', title: 'a lost boy', id: 'wat' };
		} catch (e) { console.warn('[medieval] child', e); child = null; }
	}
	folk.extra.push((dt, t) => {
		if (!child?.M) return;
		const Mo = child.M, S = Mo.S.pos, pl = o.player();
		if (child.lead && pl) {
			const fx = pl.pos.x + Math.sin(pl.yaw) * 1.2, fz = pl.pos.z + Math.cos(pl.yaw) * 1.2;
			const dx = fx - S.x, dz = fz - S.z, dd = Math.hypot(dx, dz);
			Mo.want.heading = Math.atan2(dx, dz);
			Mo.want.speed = dd > 0.6 ? Math.min(3, dd * 1.4) : 0;
			Mo.want.run = dd > 3 ? 1 : 0;
			if (dd > 9) { const y = anyGround(fx, fz, pl.pos.y - EYE); Mo.place(fx, y, fz, Mo.want.heading); }
		} else if (child.home) {
			const m = folk.byId.mother;
			if (m) { const tx = m.M.S.pos.x + 0.9, tz = m.M.S.pos.z + 0.4, dx = tx - S.x, dz = tz - S.z, dd = Math.hypot(dx, dz); Mo.want.heading = Math.atan2(dx, dz); Mo.want.speed = dd > 0.4 ? Math.min(2, dd) : 0; }
		} else {
			Mo.want.speed = 0;
			if ((child.t = (child.t || 0) - dt) < 0) { child.t = 3 + Math.random() * 3; Mo.gesture(Math.random() < 0.5 ? 'think' : 'shrug'); }
		}
		Mo.S.look.target = Math.hypot(camera.position.x - S.x, camera.position.z - S.z) < 6 ? camera.position : null;
		Mo.update(dt, t, camera.position);
		child.x = S.x; child.y = S.y; child.z = S.z;
	});

	// ---------- the marks over heads ----------
	const markTex = { offer: markTexture('offer'), ready: markTexture('ready') };
	const marks = new Map(), want = new Map();
	function mark(id, kind) { if (!kind) return; const w = want.get(id); if (!w || kind === 'ready') want.set(id, kind); }
	function drawMarks(t) {
		for (const [id, s] of marks) if (!want.has(id)) s.visible = false;
		for (const [id, kind] of want) {
			const p = folk.byId[id];
			if (!p || !p.P.root.visible || p.talking > 0) { if (marks.get(id)) marks.get(id).visible = false; continue; }
			let s = marks.get(id);
			if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex[kind], depthWrite: false, transparent: true })); s.scale.set(0.42, 0.42, 1); s.renderOrder = 9; group.add(s); marks.set(id, s); }
			s.material.map = markTex[kind];
			s.visible = true;
			s.position.set(p.M.S.pos.x, p.M.S.pos.y + p.P.height + 0.32 + Math.sin(t * 2.4 + id.length) * 0.06, p.M.S.pos.z);
		}
		want.clear();
	}

	// ---------- the player's sword ----------
	const sword = (() => {
		const k = new Kit();
		k.box(-0.022, 0.12, -0.006, 0.022, 0.86, 0.006, M.IRON, [0.78, 0.8, 0.84]);
		k.face([[-0.022, 0.86, 0], [0.022, 0.86, 0], [0, 0.95, 0]], [0, 0, 1], M.IRON, [0.78, 0.8, 0.84]);
		k.face([[0.022, 0.86, 0], [-0.022, 0.86, 0], [0, 0.95, 0]], [0, 0, -1], M.IRON, [0.78, 0.8, 0.84]);
		k.box(-0.11, 0.09, -0.02, 0.11, 0.13, 0.02, M.IRON, [0.55, 0.45, 0.25]);
		k.box(-0.018, -0.06, -0.018, 0.018, 0.09, 0.018, M.PLANK, [0.28, 0.16, 0.1]);
		k.box(-0.03, -0.1, -0.03, 0.03, -0.06, 0.03, M.IRON, [0.55, 0.45, 0.25]);
		const m = new THREE.Mesh(k.build(), mat);
		m.scale.setScalar(0.8);
		m.visible = false;
		m.renderOrder = 10;
		group.add(m);
		return m;
	})();
	let swing = 0, cool = 0;
	const armedNow = () => !!foes && !!foes.nearest(camera.position, 14);
	function strike() {
		if (cool > 0) return;
		cool = 0.45; swing = 1;
		const P = o.player();
		if (!P || !foes) return;
		setTimeout(() => { const n = foes.strike(camera.position, P.yaw); if (n) dust.puff(camera.position.x - Math.sin(P.yaw) * 1.6, camera.position.y - 0.6, camera.position.z - Math.cos(P.yaw) * 1.6, 0.2); }, 140);
	}
	const qv = new THREE.Quaternion(), ev = new THREE.Euler(), ov = new THREE.Vector3();
	function drawSword(dt, armed) {
		cool -= dt;
		sword.visible = armed || swing > 0;
		if (!sword.visible) return;
		swing = Math.max(0, swing - dt * 2.6);
		const s = swing > 0 ? Math.sin((1 - swing) * Math.PI) : 0;
		// held low at the right, the point forward; a strike sweeps it across and down
		ov.set(0.34 - s * 0.4, -0.42 + s * 0.14, -0.55).applyQuaternion(camera.quaternion);
		sword.position.copy(camera.position).add(ov);
		qv.setFromEuler(ev.set(-1.25 + s * 0.5, 0.25 - s * 1.1, 0.35 + s * 1.0));
		sword.quaternion.copy(camera.quaternion).multiply(qv);
	}

	// ---------- the quests ----------
	const inDungeon = () => { const a = dungeonAt(camera.position.x, camera.position.z, camera.position.y - EYE, 0.5); return a ? a.d.D.id : null; };
	const R = {
		realm, mount, isPhone, hint, camera, folk, dungeons: DG, beacons,
		foesIn: (id) => (foes ? foes.foes.filter((f) => f.dungeon === id) : []),
		lostSpot, spawnChild,
		child: () => (child?.M ? child : null),
		childNear: (p) => !!(child?.M && p && Math.hypot(child.x - p.M.S.pos.x, child.z - p.M.S.pos.z) < 6),
		leadChild: () => { if (child?.M) { child.lead = true; child.M.setPose('rest'); } },
		childHome: () => { if (child?.M) { child.lead = null; child.home = true; } },
		mark, strike, armed: armedNow,
		openChest: (d) => { d.opening = 0.001; },
		openGate: (d) => { if (d.props.gate) d.props.gate.want = 1; if (d.props.lever?.mesh) d.props.lever.mesh.rotation.x = 0.6; },
		lightBeacon,
		inDungeon, inCave: () => (uw?.inside?.() || 0) > 0.3 && !inDungeon(),
		nearInn: () => !!realm.innDoor && Math.hypot(realm.innDoor[0] - camera.position.x, realm.innDoor[2] - camera.position.z) < 5,
		personAt: (id) => { const c = folk.cast.find((q) => q.id === id); return c ? { x: c.at.x, z: c.at.z, label: c.name } : null; },
		wakeAtInn: () => { const P = o.player(); if (!P || !realm.innDoor) return; const x = realm.innDoor[0], z = realm.innDoor[2]; P.flying = false; P.vel.set(0, 0, 0); P.pos.set(x, ground(x, z) + EYE, z); P.yaw = realm.inn.yaw + Math.PI; camera.position.copy(P.pos); uw?.settle?.(); },
	};
	quests = createQuests(R);
	// what was done before, as it was left
	const S = quests.S;
	S.beacons.forEach((lit, i) => { if (lit) lightBeacon(i); });
	if (foes) for (const [id, list] of Object.entries(S.cleared || {})) for (const i of list) { const f = foes.foes.find((q) => q.i === i && q.dungeon === id); if (f) { f.alive = false; f.fall = 99; f.B.root.visible = false; } }
	for (const d of DG) { if (d.props.lever && S.lever) { d.props.lever.pulled = true; R.openGate(d); } if (S.opened.ring && d.lid && quests.Q.ring?.where === d) d.opening = 1; }
	if (['active', 'lead'].includes(quests.state('lost'))) { if (quests.state('lost') === 'lead') quests.debug.set('lost', 'active'); spawnChild(); }
	if (quests.state('lost') === 'done') { /* Wat is home */ }

	// ---------- each frame ----------
	let lightT = 0, dk = 0, lastNight = -1;
	const P4 = U.uTorchP.value;
	if (uw) uw.extraInside = () => dk;
	function update(dt, t, sk) {
		const cam = camera.position, P = o.player();
		const lit = clamp((sk?.night ?? 0) * 1.6 + (sk?.setK ?? 0) * 0.3, 0, 1);
		U.uNight.value = lit;
		// how far down in a dungeon the camera is (the underworld darkens by it)
		const a = dungeonAt(cam.x, cam.z, cam.y - EYE, 0.5);
		dk = a ? smoothstep(0.5, 6.5, H(cam.x, cam.z) - cam.y) : 0;
		const deep = (uw?.inside?.() || 0) > 0.9;
		// the places: near enough to matter, and not while deep underground
		for (const c of clusters) { const on = !deep && Math.hypot(c.x - cam.x, c.z - cam.z) < c.far + c.r; if (c.mesh.visible !== on) c.mesh.visible = on; }
		for (const { d, g } of dgroups) {
			const near = d.boxes.some((b) => Math.hypot(b.x - cam.x, b.z - cam.z) < Math.hypot(b.hw, b.hd) + 70);
			if (g.visible !== near) g.visible = near;
			if (d.opening > 0 && d.opening < 1) { d.opening = Math.min(1, d.opening + dt * 1.2); }
			if (d.lid) d.lid.rotation.x = -(d.opening || 0) * 1.7;
			const G = d.props.gate;
			if (G?.mesh) { G.open += (G.want - G.open) * Math.min(1, dt * 0.9); G.mesh.position.y = G.y + G.open * 2.6; G.solid.off = G.open > 0.55; }
		}
		// the mills turn
		for (const s of spin) s.m.rotation[s.axis] += s.speed * dt * (0.7 + (shared.uWind.value || 0.5) * 0.6);
		// fire by night
		if (nightFlames) { nightFlames.visible = lit > 0.02 && !deep; fm.uniforms.uK.value = lit; }
		if (halos) { halos.visible = lit > 0.02; haloM.uniforms.uK.value = lit; haloM.uniforms.uPx.value = o.renderer?.getPixelRatio?.() || 1; }
		// the nearest lights warm the stone round them (every quarter second)
		lightT -= dt;
		if (lightT < 0 || Math.abs(lit - lastNight) > 0.05) {
			lightT = 0.25; lastNight = lit;
			const cand = [];
			for (const l of ctx.lights) {
				if (!l.always && lit < 0.25) continue;
				const d = Math.hypot(l.x - cam.x, l.y - cam.y, l.z - cam.z);
				if (d < 70) cand.push([d, l]);
			}
			cand.sort((p, q) => p[0] - q[0]);
			for (let i = 0; i < P4.length; i++) { const l = cand[i]?.[1]; if (l) P4[i].set(l.x, l.y, l.z, l.r * (l.always ? 1 : lit)); else P4[i].set(0, 0, 0, 0); }
			U.uTorchK.value = 1;
			const n = cand[0];
			if (n && n[0] < 22 && !deep) { lamp.position.set(n[1].x, n[1].y, n[1].z); lamp.intensity = (n[1].always ? 1 : lit) * 3.2; lamp.distance = n[1].r * 1.3; } else lamp.intensity = 0;
		}
		if (lamp.intensity > 0) lamp.intensity *= 0.97 + Math.random() * 0.06;
		inner.update(dt, cam);
		folk.update(dt, t, P, lit);
		const armed = armedNow() && !!P && !P.flying;
		foes?.update(dt, t, P);
		dust.update(dt);
		quests.update(dt, P);
		drawMarks(t);
		drawSword(dt, armed);
		// a word as you step into a dungeon
		const inD = a?.d.D.name || null;
		if (inD && inD !== update.named && dk > 0.3) { update.named = inD; hint(`${inD}\nOld stone and torchlight. Mind your step.`, 3500); }
		if (!a) update.named = null;
	}

	// ---------- going places (for looking round, and the Crysis console) ----------
	function place(x, z, yaw, y = null, pitch = 0) {
		const P = o.player();
		if (!P) return;
		P.flying = false; P.diving = false; P.swimming = false; P.vel.set(0, 0, 0);
		P.pos.set(x, (y ?? ground(x, z)) + EYE, z);
		P.yaw = yaw; P.pitch = pitch;
		camera.position.copy(P.pos);
		uw?.settle?.();
	}
	const face = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
	function go(what = 'castle') {
		const P = o.player();
		const view = (tx, tz, dist, height, ang) => { const x = tx + Math.sin(ang) * dist, z = tz + Math.cos(ang) * dist; P.flying = true; P.pos.set(x, H(x, z) + height, z); P.yaw = face(x, z, tx, tz); P.pitch = -Math.atan2(height - 10, dist) * 0.8; P.vel.set(0, 0, 0); camera.position.copy(P.pos); return what; };
		const g = C.gate;
		if (what === 'castle') return view(C.x, C.z, 150, 45, g.yaw + 0.5);
		if (what === 'realm') return view((C.x + T.x) / 2, (C.z + T.z) / 2, 420, 150, g.yaw + 0.8);
		if (what === 'gate') { const x = g.x + Math.sin(g.yaw) * 18, z = g.z + Math.cos(g.yaw) * 18; place(x, z, face(x, z, g.x, g.z), null, 0.12); return what; }
		if (what === 'keep') { const K = C.keep, x = K.x + Math.sin(K.yaw) * 4.5, z = K.z + Math.cos(K.yaw) * 4.5; place(x, z, face(x, z, K.x, K.z), C.y + 0.02, 0.05); return what; }
		if (what === 'wall') { place(C.verts[0].x * 0.9 + C.x * 0.1, C.verts[0].z * 0.9 + C.z * 0.1, face(C.x, C.z, T.x, T.z), C.y + 9, -0.05); return what; }
		if (what === 'town' || what === 'street') { const L = T.lanes[0], p = L.pts[Math.min(L.pts.length - 1, 12)]; place(p.x, p.z, face(p.x, p.z, T.x, T.z), null, 0.02); return what; }
		if (what === 'square') { const x = T.x + 8, z = T.z + 8; place(x, z, face(x, z, T.x - 6, T.z - 6), null, 0); return what; }
		if (what === 'chapel' && realm.chapel) { const c = realm.chapel, x = c.x + Math.sin(c.yaw) * 14 + Math.cos(c.yaw) * 5, z = c.z + Math.cos(c.yaw) * 14 - Math.sin(c.yaw) * 5; place(x, z, face(x, z, c.x, c.z)); return what; }
		if (what === 'windmill' && realm.windmill) return view(realm.windmill.x, realm.windmill.z, 28, 6, realm.windmill.yaw + 0.25);
		if (what === 'watermill' && realm.watermill) return view(realm.watermill.x, realm.watermill.z, 30, 6, realm.watermill.yaw + 0.9);
		if (what === 'bridge' && realm.bridges[0]) return view(realm.bridges[0].x, realm.bridges[0].z, 26, 5, realm.bridges[0].yaw + 1.3);
		if (what === 'stones' && realm.stones) return view(realm.stones.x, realm.stones.z, 30, 6, 0.4);
		if (what === 'barrow' && barrowD) { const x = barrowD.x - Math.sin(barrowD.yaw) * 12, z = barrowD.z - Math.cos(barrowD.yaw) * 12; place(x, z, face(x, z, barrowD.x, barrowD.z), null, 0.05); return what; }
		if (what === 'watchtower' && realm.watchtowers[0]) return view(realm.watchtowers[0].x, realm.watchtowers[0].z, 30, 8, 0.3);
		if (what === 'fields' && realm.fields[0]) return view(realm.fields[0].x, realm.fields[0].z, 50, 14, realm.fields[0].yaw);
		return 'castle, realm, gate, keep, wall, town, square, chapel, windmill, watermill, bridge, stones, barrow, watchtower, fields';
	}
	// into a dungeon: its first room, looking along it; or its breach into the caves
	function dungeonGo(i = 0, where = 'room') {
		const d = DG[((i % DG.length) + DG.length) % DG.length];
		if (!d) return 'no dungeons here';
		// (from the caves' side, looking back at the broken masonry)
		if (where === 'cave' && d.D.breach) {
			const Bp = d.D.breach.pts, p = Bp[Math.max(0, Bp.length - 2)], a = d.D.breach.yaw;
			place(p.x, p.z, a, island.underFloor?.(p.x, p.z, p.y + 1) ?? p.y, 0.02);
			for (const { g } of dgroups) g.visible = true;
			return d.D.name + ', from the caves';
		}
		const b = where === 'breach' && d.D.breach ? d.D.breach.box : where === 'stair' ? d.D.stair : d.D.rooms[where === 'last' ? d.D.rooms.length - 1 : 0];
		const back = where === 'breach' ? b.hd - 5 : where === 'stair' ? -b.hd + 3 : -b.hd + 1.2;
		const x = b.x + back * b.s, z = b.z + back * b.c, y = floorOf(b, back);
		place(x, z, b.yaw + Math.PI, y, where === 'stair' ? -0.3 : 0);
		for (const { g } of dgroups) g.visible = true;
		return d.D.name + (where === 'breach' && !d.D.breach ? ' (no breach)' : '');
	}
	function info() {
		return {
			name: realm.name, castle: realm.castleName, lord: realm.lord, arms: realm.arms,
			at: { castle: [Math.round(C.x), Math.round(C.z)], town: [Math.round(T.x), Math.round(T.z)] },
			houses: realm.houses.length, fields: realm.fields.length, watchtowers: realm.watchtowers.length, river: !!realm.river, bridges: realm.bridges.length,
			dungeons: DG.map((d) => ({ id: d.D.id, name: d.D.name, rooms: d.D.rooms.map((r) => r.kind), breach: !!d.D.breach, foes: d.foes.length })),
			people: folk.folk.length, clusters: clusters.map((c) => c.name),
			tris: clusters.reduce((s, c) => s + (c.mesh.geometry.index ? c.mesh.geometry.index.count / 3 : 0) * (c.mesh.count || 1), 0),
		};
	}
	function dispose() {
		folk.dispose(); foes?.dispose(); dust.dispose(); quests.dispose();
		if (child?.P) scene.remove(child.P.root);
		scene.remove(group);
		group.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material) [].concat(q.material).forEach((m) => m.dispose()); });
		armsTex.dispose();
		shared.moreHoles = null;
		if (uw) uw.extraInside = null;
	}
	return { interiors: inner,
		update, dispose, go, dungeonGo, info, quests, folk, foes,
		floor: (x, z, y) => surfFloor(x, z, y),
		push: (p, footY) => col.push(p, footY),
		// the dungeons, ahead of the caves
		underFloor: (under) => (x, z, y) => dungeonFloor(x, z, y) ?? (under ? under(x, z, y) : null),
		underPush: (under) => (p, footY) => { if (dungeonAt(p.x, p.z, footY, 0.4)) dungeonPush(p, footY); else under?.(p, footY); },
		inside: () => dk,
		dungeonAt, realm, group,
	};
}
