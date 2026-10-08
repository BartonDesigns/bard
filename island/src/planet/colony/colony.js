// An off-world colony, built from its plan (plan.js) with the kit's pieces (parts.js):
// the hub, the spaceport, the outposts and the maglev, each site merged into a mesh or
// two and dropped by distance; the solar panels, radiator fins, rovers and colonists
// instanced and moved each frame; lamps, windows and running lights waking at night.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, skyEnvironment, beamMaterial, beamGeo, frame, sweep, box } from '../alienkit.js';
import { colliders } from '../alien.js';
import { mulberry32 } from '../../noise.js';
import { shellMaterial, glassMaterial, poolMaterial, colonyUniforms } from './mats.js';
import { hub, port, mine, relay, scrubbers, solarFarm, railLine, station, trainGeometry, roverGeometry, suitGeometry, crewGeometry, panelGeometry, finGeometry, wreck, plaza, observatory, shelter, footing } from './parts.js';
import { createColonyInteriors } from './interiors.js';
import { createColonyLife } from './life.js';
import { COLONY } from './styles.js';
import { planCrew, createCrew } from './crew-life.js';
import { createErrands } from './errands.js';
import { personaOf, byId } from './crew.js';

const TAU = Math.PI * 2;
const BUILD = { mine, relay, scrubbers, wreck, plaza, observatory, shelter };

export function createColony(island, shared, scene, camera, profile, plan, opts = {}) {
	const none = { update() {}, floor: () => -Infinity, push() {}, go: () => 'no colony on this world', dispose() {}, info: () => null, port: null };
	if (!plan) return none;
	const S = plan.style, P = plan.parts, isPhone = !!opts.isPhone;
	const H = (x, z) => island.heightAt(x, z);
	const group = new THREE.Group();
	group.name = 'colony';
	scene.add(group);
	const U = colonyUniforms(shared, S);
	const air = profile?.air?.tint || [0.1, 0.1, 0.12], rock = profile?.ground?.rock || [0.3, 0.3, 0.3];
	const envRT = skyEnvironment(opts.renderer, air.map((v) => v * 0.3), air.map((v) => v * 0.6), rock.map((v) => v * 0.4));
	const env = envRT?.texture || null;
	const mats = { shell: shellMaterial(U, { env }), glass: glassMaterial({ color: S.glass, env }), air: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1, 0.45) }) };
	const roomMat = shellMaterial(U, { inside: true }), crewMat = shellMaterial(U, { walk: true, hop: 0.02, inside: true });
	const walkMat = shellMaterial(U, { walk: true, hop: profile?.gravity < 0.5 ? 0.22 : 0.04 });
	const col = colliders();
	const X = { S, P, H, col, r: mulberry32((plan.seed ^ 0x5c1f1) >>> 0), det: isPhone ? 0.6 : 1, pools: [], plumes: [], panels: [], radiators: [], doors: [], railH: 6,
		rooms: { modules: [], towers: [], cab: null, dome: null }, vol: [], spots: [], terminals: [], lifts: [], airlocks: [] };
	const sites = [];
	const site = (name, at, r, far, make) => {
		X.K = new Kit();
		try { make(); } catch (err) { console.error('[colony] ' + name, err); return; }
		const g = new THREE.Group();
		g.name = 'colony:' + name;
		const meshes = X.K.build(mats, g, far === Infinity);
		group.add(g);
		sites.push({ name, x: at.x, z: at.z, y: at.y, r, g, meshes, far, nearD: 380 });
	};
	const t0 = performance.now();
	const hb = plan.hub;
	site(plan.name, hb, hb.r + 20, 3200, () => hub(X, hb));
	if (plan.port) site(plan.port.name, plan.port, plan.port.r, 3200, () => port(X, plan.port));
	for (const o of plan.outposts) site(o.name, o, o.r + 10, 2600, () => BUILD[o.kind](X, o));
	for (const [i, s] of plan.solar.entries()) site('Solar farm ' + (i + 1), s, s.r, 2200, () => solarFarm(X, s));
	// out past the land: the far sites, each on its own footing
	for (const o of plan.outer || []) site(o.name, o, o.r + 30, 4800, () => { if (o.kind === 'mine' || o.kind === 'relay') footing(X, frame(o.x, o.y, o.z, o.yaw), 30, 30); BUILD[o.kind](X, o); });
	// the maglev lines and their stations, and a train on each
	const trains = [];
	for (const [i, line] of plan.rail.entries()) {
		let path = null;
		const a = line[0], b = line[1], yaw = Math.atan2(b.x - a.x, b.z - a.z);
		site('Maglev ' + (i + 1), { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: H(a.x, a.z) }, Math.hypot(b.x - a.x, b.z - a.z) / 2, Infinity, () => {
			path = railLine(X, line);
			station(X, frame(a.x, H(a.x, a.z), a.z, yaw));
			station(X, frame(b.x, H(b.x, b.z), b.z, yaw));
		});
		if (!path) continue;
		const cum = [0];
		for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
		const mesh = new THREE.Mesh(trainGeometry(S), mats.shell);
		mesh.castShadow = mesh.receiveShadow = true;
		mesh.name = 'colony:train';
		group.add(mesh);
		trains.push({ path, cum, len: cum[cum.length - 1], s: X.r() * cum[cum.length - 1], dir: 1, wait: 0, mesh });
	}
	// coolant runs along the roads (the volcanic worlds' colonies), lifted on low trestles
	if (P.pipes) site('Coolant lines', hb, 600, Infinity, () => {
		for (const rd of plan.roads.slice(0, -1)) {
			const pts = rd.filter((p, k) => k % 3 === 0 || k === rd.length - 1).map((p) => new THREE.Vector3(p.x + 4, H(p.x + 4, p.z) + 1.3, p.z));
			if (pts.length < 2) continue;
			X.K.add('shell', sweep(pts, 0.42, 6, { step: 4 }), { tint: S.pipe || S.accent, glow: 7 });
			for (const p of pts) X.K.add('shell', box(0.3, 1.3, 0.3).translate(p.x, p.y - 0.65, p.z), { tint: S.trim, glow: 0 });
		}
	});
	// the plumes over the scrubber stacks
	let plumeMat = null;
	if (X.plumes.length) {
		plumeMat = beamMaterial({ uTime: shared.uTime, uBass: { value: 0 } });
		const geo = mergeGeometries(X.plumes.map((q) => beamGeo(q.p, q.h, 1.8, 7, 1, [0.75, 0.9, 0.45])));
		const m = new THREE.Mesh(geo, plumeMat);
		m.frustumCulled = false; m.renderOrder = 3; m.name = 'colony:plumes';
		group.add(m);
	}
	// the lamps' light on the ground
	const poolMat = poolMaterial(U);
	if (X.pools.length) {
		const geos = X.pools.map((q) => {
			const g = new THREE.PlaneGeometry(q.r * 2, q.r * 2).rotateX(-Math.PI / 2).translate(q.x, Math.max(q.y, H(q.x, q.z)) + 0.12, q.z);
			const n = g.attributes.position.count, c = new Float32Array(n * 3);
			for (let i = 0; i < n; i++) c.set(q.c, i * 3);
			g.setAttribute('color', new THREE.BufferAttribute(c, 3));
			return g;
		});
		const m = new THREE.Mesh(mergeGeometries(geos), poolMat);
		m.renderOrder = 2; m.name = 'colony:pools';
		group.add(m);
	}
	// instanced: the panels and fins, the rovers, the colonists
	const inst = (geo, mat, n, name) => {
		const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
		m.count = n; m.castShadow = m.receiveShadow = true; m.name = 'colony:' + name;
		m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		m.frustumCulled = false;
		group.add(m);
		return m;
	};
	const panels = inst(panelGeometry(S), mats.shell, X.panels.length, 'solar');
	const fins = inst(finGeometry(S), mats.shell, X.radiators.length, 'radiators');
	const poly = (rd) => {
		const cum = [0];
		for (let k = 1; k < rd.length; k++) cum.push(cum[k - 1] + Math.hypot(rd[k].x - rd[k - 1].x, rd[k].z - rd[k - 1].z));
		return { pts: rd, cum, len: cum[cum.length - 1] };
	};
	const roads = [...plan.roads, ...(plan.tracks || [])].filter((rd) => rd.length > 2).map(poly);
	const rovers = [];
	for (let i = 0; i < (roads.length ? P.rovers + (plan.tracks?.length ? 3 : 0) : 0); i++) { const rd = roads[(i * 3) % roads.length]; rovers.push({ rd, s: X.r() * rd.len, dir: X.r() < 0.5 ? 1 : -1, v: 5 + X.r() * 4, yaw: 0, wait: 0 }); }
	const roverMesh = inst(roverGeometry(S), mats.shell, rovers.length, 'rovers');
	// the rover tracks out to the far sites: twin ruts pressed dark into the regolith
	if (plan.tracks?.length) {
		const P3 = [];
		for (const rd of plan.tracks) for (let k = 0; k < rd.length - 1; k++) {
			const a = rd[k], b = rd[k + 1], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = dz / l, nz = -dx / l;
			for (const off of [-0.85, 0.85]) {
				const q = [[a, off - 0.22], [a, off + 0.22], [b, off - 0.22], [b, off + 0.22]].map(([p, o2]) => { const x = p.x + nx * o2, z = p.z + nz * o2; return [x, H(x, z) + 0.06, z]; });
				P3.push(...q[0], ...q[2], ...q[1], ...q[1], ...q[2], ...q[3]);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3));
		g.computeVertexNormals();
		const c = S.berm.map((v2) => v2 * 0.38);
		const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
		m.receiveShadow = true; m.name = 'colony:tracks';
		group.add(m);
	}
	// people: suited colonists outside, the crew at work indoors, and some going between,
	// out of the suit or into it at the airlock (each walks a line back and forth)
	const walkers = [];
	// the Moon's named crew take their places first (crew-life.js); the figures fill the rest
	const crewPlan = S === COLONY.MOON && !opts.noCrew ? planCrew(X, plan, (x, z, y) => Math.max(H(x, z), col.floor(x, z, y + 1.5))) : null;
	const walker = (pts, suitAt, work = false) => { const L = poly(pts); walkers.push({ ...L, s: X.r() * L.len, dir: 1, wait: X.r() * 3, v: 1.0 + X.r() * 0.4, ph: X.r() * TAU, yaw: 0, suitAt, work }); };
	for (let i = 0; i < P.walkers; i++) {
		if (plan.port && i % 3 === 2) {
			const pd = plan.port.pads[i % plan.port.pads.length];
			walker([{ x: plan.port.station.x, z: plan.port.station.z }, { x: pd.x + (X.r() - 0.5) * 8, z: pd.z + (X.r() - 0.5) * 8 }], -1);
		} else if (X.doors.length) {
			const d = X.doors[i % X.doors.length], ang = d.a + (X.r() - 0.5) * 1.6, L = 8 + X.r() * 16;
			// every other one comes from inside, through the airlock
			if (i % 2) walker([d.inner, d.lock, { x: d.x + Math.sin(ang) * L, z: d.z + Math.cos(ang) * L }], Math.hypot(d.lock.x - d.inner.x, d.lock.z - d.inner.z) - 2);
			else walker([{ x: d.x, z: d.z }, { x: d.x + Math.sin(ang) * L, z: d.z + Math.cos(ang) * L }], -1);
		}
	}
	for (const [k, sp] of X.spots.entries()) {
		if (k >= (isPhone ? 10 : 22)) break;
		if (sp.taken) continue;
		const b = { x: sp.x + Math.cos(sp.yaw) * 1.8, z: sp.z - Math.sin(sp.yaw) * 1.8 };
		walker([{ x: sp.x, z: sp.z }, b], Infinity, true);
	}
	const people = (geo, mat, name) => {
		const at = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, walkers.length) * 2), 2);
		at.setUsage(THREE.DynamicDrawUsage);
		geo.setAttribute('aPh', at);
		const m = inst(geo, mat, walkers.length, name);
		return { m, at, n: 0 };
	};
	const suitsI = people(suitGeometry(S), walkMat, 'colonists'), crewI = people(crewGeometry(S), crewMat, 'crew');
	crewI.m.castShadow = crewI.m.receiveShadow = false;
	// inside: the rooms, and what you do there
	const interiors = createColonyInteriors(X, { S, camera, isPhone, group, roomMat, glassMat: mats.glass, terminals: X.terminals, windows: [] });
	const siteList = () => {
		const P0 = camera.position, list = [];
		list.push({ name: plan.name, x: hb.x, z: hb.z, y: hb.y, main: true, r: hb.r });
		if (plan.port) list.push({ name: plan.port.name, x: plan.port.x, z: plan.port.z, y: plan.port.y, main: true, rail: plan.rail.length > 0, r: plan.port.r, port: true });
		for (const o of [...plan.outposts, ...(plan.outer || [])]) list.push({ name: o.name, x: o.x, z: o.z, y: o.y, far: !!o.far, rail: !o.far && plan.rail.some((l) => Math.hypot(l[1].x - o.x, l[1].z - o.z) < 60), r: o.r, yaw: o.yaw });
		for (const s of list) s.dist = Math.hypot(s.x - P0.x, s.z - P0.z);
		return list;
	};
	let errands = null;
	const life = createColonyLife(X, { errands: () => errands, camera, hint: opts.hint, mount: opts.mount, isTouch: opts.isTouch, airMat: mats.air, player: opts.player, terminals: X.terminals, name: plan.name, give: opts.give, sites: siteList, go: (i) => goTo(siteList()[i]) });
	const buildMs = performance.now() - t0;

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
	const floorAt = (x, z, y) => Math.max(H(x, z), col.floor(x, z, y + 1.5));
	// the named crew, and the errands they have for you
	const crew = crewPlan ? createCrew(X, crewPlan, {
		camera, scene, isPhone, plan, floor: floorAt, hours: () => opts.world?.()?.sky?.state?.hours,
		holds: (id) => errands?.holds(id), mark: (id) => errands?.markFor(id), watching: (id) => errands?.watching(id),
		talkOpen: (id) => errands?.talkOpen(id), talkReply: (id, text) => errands?.talkReply(id, text),
		resident: (id, now) => ({ id: 'colony:' + id, source: 'colony', persona: personaOf(byId[id], { colony: plan.name, now, quest: errands?.questLine(id), news: errands?.news() }) }),
	}) : null;
	errands = crew ? createErrands({
		plan, X, C: crewPlan, crew, camera, isPhone, mount: opts.mount, isTouch: opts.isTouch, hint: opts.hint, arms: opts.arms, social: opts.social, world: opts.world, player: opts.player,
		ride: (name) => { const i = siteList().findIndex((q) => q.name === name); if (i >= 0) life.ride(i); }, terminalNear: () => !!life.terminal(),
	}) : null;
	// a point along a polyline by distance, and its heading
	const along = (pts, cum, s, out) => {
		let k = 1;
		while (k < cum.length - 1 && cum[k] < s) k++;
		const a = pts[k - 1], b = pts[k], t = Math.min(1, Math.max(0, (s - cum[k - 1]) / Math.max(1e-3, cum[k] - cum[k - 1])));
		out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t;
		if (a.y !== undefined) out.y = a.y + (b.y - a.y) * t;
		out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
		out.pitch = a.y !== undefined ? Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)) : 0;
		return out;
	};
	const pt = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
	let sunT = 1, lookT = 0;
	// the sites you have come to, kept in this browser per world
	const SEEN = `crysis-colony-seen-${plan.seed}`;
	let seen;
	try { seen = new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { seen = new Set(); }
	const saw = (name) => { if (seen.has(name)) return; seen.add(name); try { localStorage.setItem(SEEN, JSON.stringify([...seen])); } catch { /* storage off */ } };
	function track(cx, cz) {
		const sd = shared.uSunDir.value, az = Math.atan2(sd.x, sd.z), el = Math.asin(Math.max(-1, Math.min(1, sd.y)));
		// panels face the sun (stowed flat by night); fins turn edge-on to it
		const tilt = el > 0.02 ? Math.PI / 2 - el : 0;
		for (let i = 0; i < X.panels.length; i++) {
			const p = X.panels[i];
			e.set(tilt, az, 0); q.setFromEuler(e);
			m4.compose(v.set(p.x, p.y, p.z), q, one); panels.setMatrixAt(i, m4);
		}
		for (let i = 0; i < X.radiators.length; i++) {
			const p = X.radiators[i];
			e.set(0, az, 0); q.setFromEuler(e);
			m4.compose(v.set(p.x, p.y, p.z), q, one); fins.setMatrixAt(i, m4);
		}
		panels.instanceMatrix.needsUpdate = fins.instanceMatrix.needsUpdate = true;
		panels.visible = fins.visible = Math.hypot(cx - hb.x, cz - hb.z) < 1800;
	}
	function update(dt) {
		const cx = camera.position.x, cz = camera.position.z;
		const sy = shared.uSunDir.value.y, night = 1 - THREE.MathUtils.smoothstep(sy, -0.12, 0.1);
		U.uNight.value = night;
		U.uLampK.value = 0.7 + night * 1.6;
		mats.glass.emissive.setRGB(S.window[0], S.window[1], S.window[2]).multiplyScalar(0.12 * night);
		if (plumeMat) plumeMat.uniforms.uBeamK.value = 0.12 + night * 0.25;
		// far sites drop their fine detail, and past a distance are left out
		for (const G of sites) {
			const d = Math.hypot(cx - G.x, cz - G.z) - G.r, vis = d < G.far;
			if (G.g.visible !== vis) G.g.visible = vis;
			if (vis) for (const m of G.meshes) if (m.userData.near) m.visible = d < G.nearD;
		}
		sunT += dt;
		if (sunT > 0.5) { sunT = 0; track(cx, cz); }
		// the trains: along the line, easing into each station, a pause, back
		for (const T of trains) {
			if (T.wait > 0) { T.wait -= dt; continue; }
			const edge = Math.min(T.s, T.len - T.s), sp = 4 + Math.min(1, edge / 120) * 26;
			T.s += T.dir * sp * dt;
			if (T.s <= 0 || T.s >= T.len) { T.s = Math.max(0, Math.min(T.len, T.s)); T.dir *= -1; T.wait = 6; }
			const c = Math.max(18, Math.min(T.len - 18, T.s));
			along(T.path, T.cum, c, pt);
			T.mesh.position.set(pt.x, pt.y, pt.z);
			T.mesh.rotation.set(-pt.pitch, pt.yaw, 0, 'YXZ');
		}
		interiors.update(dt);
		life.update(dt);
		crew?.update(dt);
		errands?.update(dt);
		// the rovers along the roads and tracks
		const near = Math.hypot(cx - hb.x, cz - hb.z) < 2400;
		suitsI.m.visible = crewI.m.visible = near;
		for (let i = 0; i < rovers.length; i++) {
			const R = rovers[i];
			if (R.wait > 0) R.wait -= dt;
			else {
				R.s += R.dir * R.v * dt;
				if (R.s <= 0 || R.s >= R.rd.len) { R.s = Math.max(0, Math.min(R.rd.len, R.s)); R.dir *= -1; R.wait = 4 + (i % 3) * 3; }
			}
			along(R.rd.pts, R.rd.cum, R.s, pt);
			const yaw = pt.yaw + (R.dir < 0 ? Math.PI : 0);
			let dy = yaw - R.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
			R.yaw += dy * Math.min(1, dt * 3);
			// keep to the right of the road's middle
			const ox = Math.cos(R.yaw) * -1.6, oz = -Math.sin(R.yaw) * -1.6;
			const x = pt.x + ox, z = pt.z + oz, fx = Math.sin(R.yaw) * 2, fz = Math.cos(R.yaw) * 2;
			const pitch = Math.atan2(H(x + fx, z + fz) - H(x - fx, z - fz), 4);
			e.set(-pitch, R.yaw, 0); q.setFromEuler(e);
			m4.compose(v.set(x, floorAt(x, z, H(x, z)), z), q, one); roverMesh.setMatrixAt(i, m4);
		}
		roverMesh.instanceMatrix.needsUpdate = true;
		// the people: walk, stop a while (longer at work), walk back
		if (near) {
			suitsI.n = crewI.n = 0;
			for (let i = 0; i < walkers.length; i++) {
				const W = walkers[i];
				let moving = 1;
				if (W.wait > 0) { W.wait -= dt; moving = 0; } else {
					W.s += W.dir * W.v * dt;
					if (W.s <= 0 || W.s >= W.len) { W.s = Math.max(0, Math.min(W.len, W.s)); W.dir *= -1; W.wait = W.work ? 6 + (i % 5) * 2 : 2 + (i % 4) * 1.5; }
				}
				along(W.pts, W.cum, W.s, pt);
				const yaw = pt.yaw + (W.dir < 0 ? Math.PI : 0);
				let dy = yaw - W.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
				W.yaw += dy * Math.min(1, dt * 4);
				e.set(0, W.yaw, 0); q.setFromEuler(e);
				m4.compose(v.set(pt.x, floorAt(pt.x, pt.z, H(pt.x, pt.z) + 1), pt.z), q, one);
				const I = W.s > W.suitAt ? suitsI : crewI;
				I.m.setMatrixAt(I.n, m4); I.at.setXY(I.n, W.ph, moving); I.n++;
			}
			for (const I of [suitsI, crewI]) { I.m.count = I.n; I.m.instanceMatrix.needsUpdate = I.at.needsUpdate = true; }
		}
		// arriving at a site: its name
		lookT += dt;
		if (lookT > 0.5 && opts.hint) {
			lookT = 0;
			for (const G of sites) {
				if (seen.has(G.name) || G.far === Infinity) continue;
				if (Math.hypot(cx - G.x, cz - G.z) < G.r + 30 && camera.position.y < G.y + 120) {
					saw(G.name);
					opts.hint(`${G.name}\n${profile.name.replace(/^\w/, (c) => c.toUpperCase())}`, 5000);
				}
			}
		}
	}
	// arrive at the spaceport: on the apron, the tower ahead
	function go() {
		const p = plan.port || hb, Pl = opts.player?.();
		if (!Pl) return plan.name;
		const F = frame(p.x, p.y, p.z, p.yaw || 0), at = F.p(-(p.r || 30) * 0.3, 0, -(p.r || 30) * 0.7);
		Pl.flying = false; Pl.diving = false; Pl.vel?.set(0, 0, 0);
		Pl.pos.set(at.x, floorAt(at.x, at.z, p.y) + 1.7, at.z);
		const to = plan.port ? plan.port.pads[0] : hb;
		Pl.yaw = Math.atan2(-(to.x - at.x), -(to.z - at.z));
		Pl.pitch = 0.12;
		camera.position.copy(Pl.pos);
		saw(p.name || plan.name);
		opts.hint?.(`${plan.port ? plan.port.name : plan.name}\n${plan.name}`, 5000);
		return plan.name;
	}
	// arrive at any site: on open ground before it, looking at it (the hub: outside an airlock)
	function goTo(s) {
		const Pl = opts.player?.();
		if (!s || !Pl) return null;
		if (s.port) return go();
		let at;
		if (s.main && X.doors.length) { const d = X.doors[0]; at = { x: d.x + Math.sin(d.a) * 6, z: d.z + Math.cos(d.a) * 6 }; }
		else { const a = Math.atan2(hb.x - s.x, hb.z - s.z), d = (s.r || 15) + 18; at = { x: s.x + Math.sin(a) * d, z: s.z + Math.cos(a) * d }; }
		Pl.flying = false; Pl.diving = false; Pl.vel?.set(0, 0, 0);
		Pl.pos.set(at.x, floorAt(at.x, at.z, H(at.x, at.z) + 1) + 1.7, at.z);
		Pl.yaw = Math.atan2(-(s.x - at.x), -(s.z - at.z));
		Pl.pitch = 0.08;
		camera.position.copy(Pl.pos);
		saw(s.name);
		opts.hint?.(`${s.name}\n${plan.name}`, 5000);
		return s.name;
	}
	const push = (p, footY) => { col.push(p, footY); interiors.push(p, footY); };
	function dispose() {
		envRT?.dispose();
		interiors.dispose();
		life.dispose();
		crew?.dispose();
		errands?.dispose();
		for (const m of [mats.shell, mats.glass, mats.air, walkMat, crewMat, roomMat, poolMat, plumeMat]) m?.dispose();
		group.traverse((o) => o.geometry?.dispose());
		scene.remove(group);
	}
	const info = () => {
		let tris = 0, meshes = 0;
		group.traverse((o) => { if (o.isMesh) { meshes++; tris += o.geometry.attributes.position.count / 3 * (o.isInstancedMesh ? o.count : 1); } });
		return { name: plan.name, hub: { x: Math.round(hb.x), y: Math.round(hb.y), z: Math.round(hb.z), r: Math.round(hb.r) }, sites: sites.map((s) => s.name), habs: P.habs, towers: P.towers, pads: plan.port?.pads.length || 0, outposts: plan.outposts.map((o) => o.kind), solar: X.panels.length, radiators: X.radiators.length, trains: trains.length, rovers: rovers.length, colonists: walkers.length, roads: plan.roads.length, outer: (plan.outer || []).map((o) => o.name), tracks: plan.tracks?.length || 0, rooms: X.rooms.modules.map((m) => m.role), lifts: X.lifts.length, airlocks: X.airlocks.length, terminals: X.terminals.map((t) => t.name), interiors: interiors.info(), suited: life.suited(), crew: crew?.info() || null, errands: errands?.info() || null, seen: [...seen], meshes, tris: Math.round(tris), buildMs: Math.round(buildMs) };
	};
	const portAt = plan.port ? { name: `${profile.name.replace(/^the /, '').replace(/^\w/, (c) => c.toUpperCase())}: ${plan.name}`, x: plan.port.x, z: plan.port.z, y: plan.port.y } : null;
	const crewApi = errands ? { mark: errands.mark, journal: errands.journal, errands, people: crew } : null;
	return { crew: crewApi, update, floor: col.floor, push, go, goTo, sites: siteList, life, interiors, rooms: X.rooms, lifts: X.lifts, airlocks: X.airlocks, terminals: X.terminals, dispose, info, group, port: portAt };
}
