// What flies when a building breaks: chunks of wall and slab, real rigid bodies in a small
// physics world of their own (Rapier, as the cars use: vehicles/physics.js), tumbling off the
// break, striking the ground and the walls near and coming to rest; the dust that billows up
// and rolls out along the street, hangs a long while and settles; the fires that burn in a
// wreck and the smoke off them; and glass, shards spinning down from a pane to skitter on the
// pavement. All from fixed pools (one instanced mesh each, two point clouds), capped lower on
// a phone; the oldest gives way when a new one is wanted.

import * as THREE from 'three';
import { loadRapier } from '../vehicles/physics.js';

const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), EU = new THREE.Euler(), CO = new THREE.Color();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

export function createDebris(scene, { isPhone = false, ground, solids = () => [] } = {}) {
	const group = new THREE.Group();
	group.name = 'structures-debris';
	scene.add(group);
	// ---------- chunks: rigid bodies ----------
	const CAP = isPhone ? 36 : 96;
	const chunkMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 });
	const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
	// (a chunk's corners knocked off a little: broken concrete, not a brick)
	{ const p = chunkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + ((i * 7919) % 13) / 13 * 0.18; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (1.8 - k), p.getZ(i) * k); } chunkGeo.computeVertexNormals(); }
	const chunks = new THREE.InstancedMesh(chunkGeo, chunkMat, CAP);
	chunks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
	chunks.count = CAP; chunks.frustumCulled = false; chunks.castShadow = true; chunks.receiveShadow = true;
	for (let i = 0; i < CAP; i++) chunks.setMatrixAt(i, HIDE);
	group.add(chunks);
	const C = Array.from({ length: CAP }, () => ({ live: false, body: null, age: 0, still: 0, size: [1, 1, 1], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, fade: 1 }));
	let next = 0, R = null, world = null, field = null, fx = 1e9, fz = 1e9, fixed = [], acc = 0;
	// (the physics is fetched the first time something breaks, as the cars fetch it the first time
	// you drive; until it is here the chunks fly on their own simple arcs)
	let asked = false;
	function ensureWorld() {
		if (!asked) { asked = true; Promise.resolve(loadRapier()).then((r) => { R = r; }).catch(() => { R = null; }); }
		if (world || !R) return !!world;
		world = new R.World({ x: 0, y: -9.81, z: 0 });
		world.timestep = 1 / 60;
		return true;
	}
	// the ground round a break as a height field, and the buildings near it as fixed boxes
	function regrid(x, z) {
		if (!world) return;
		const N = 28, CELL = 2.5, half = N * CELL / 2;
		fx = Math.round(x / CELL) * CELL; fz = Math.round(z / CELL) * CELL;
		const H = new Float32Array((N + 1) * (N + 1));
		for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[i + j * (N + 1)] = ground(fx - half + j * CELL, fz - half + i * CELL);
		if (field) world.removeCollider(field, false);
		field = world.createCollider(R.ColliderDesc.heightfield(N, N, H, { x: N * CELL, y: 1, z: N * CELL }).setTranslation(fx, 0, fz).setFriction(0.9));
		for (const c of fixed) world.removeCollider(c, false);
		fixed = [];
		for (const b of solids(x, z, 45)) {
			const h = Math.max(0.5, b.h || 6);
			fixed.push(world.createCollider(R.ColliderDesc.cuboid(b.w / 2, h / 2, b.d / 2).setTranslation(b.x, b.y + h / 2, b.z).setRotation({ x: 0, y: Math.sin(-b.a / 2), z: 0, w: Math.cos(-b.a / 2) }).setFriction(0.7)));
		}
	}
	function free(c, i) {
		if (c.body && world) world.removeRigidBody(c.body);
		c.body = null; c.live = false;
		chunks.setMatrixAt(i, HIDE);
	}
	// a chunk at (x, y, z) flying off with (vx, vy, vz), size [w, h, d], colour [r, g, b] linear
	function chunk(x, y, z, vx, vy, vz, size, col) {
		const i = next; next = (next + 1) % CAP;
		const c = C[i];
		if (c.live) free(c, i);
		Object.assign(c, { live: true, age: 0, still: 0, size, x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wx: (Math.random() - 0.5) * 8, wy: (Math.random() - 0.5) * 8, wz: (Math.random() - 0.5) * 8, fade: 1 });
		chunks.setColorAt(i, CO.setRGB(col[0], col[1], col[2]));
		chunks.instanceColor.needsUpdate = true;
		if (ensureWorld()) body(c);
	}
	function body(c) {
		if (Math.hypot(c.x - fx, c.z - fz) > 22) regrid(c.x, c.z);
		const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(c.x, c.y, c.z).setRotation(QT.setFromEuler(EU.set(c.rx, c.ry, c.rz))).setLinvel(c.vx, c.vy, c.vz).setAngvel({ x: c.wx, y: c.wy, z: c.wz }).setLinearDamping(0.05).setAngularDamping(0.4).setCcdEnabled(c.size[0] * c.size[1] * c.size[2] < 0.05));
		world.createCollider(R.ColliderDesc.cuboid(c.size[0] / 2 * 0.9, c.size[1] / 2 * 0.9, c.size[2] / 2 * 0.9).setDensity(2.2).setFriction(0.8).setRestitution(0.12), b);
		c.body = b;
	}
	function stepChunks(dt) {
		let any = false;
		for (const c of C) if (c.live) { any = true; break; }
		if (!any) return;
		// (the physics arrived while they flew: they become bodies where they are)
		if (!world && R && ensureWorld()) for (const c of C) if (c.live && !c.body && c.still < 0.5) body(c);
		if (world) {
			acc += Math.min(dt, 0.1);
			let n = 0;
			while (acc >= world.timestep && n < 3) { world.step(); acc -= world.timestep; n++; }
		}
		for (let i = 0; i < CAP; i++) {
			const c = C[i];
			if (!c.live) continue;
			c.age += dt;
			if (c.body) {
				const t = c.body.translation(), r = c.body.rotation();
				c.x = t.x; c.y = t.y; c.z = t.z;
				QT.set(r.x, r.y, r.z, r.w);
				const v = c.body.linvel();
				c.still = Math.hypot(v.x, v.y, v.z) < 0.15 ? c.still + dt : 0;
				// (fallen through, or far below anything: gone)
				if (c.y < ground(c.x, c.z) - 4) c.age = 99;
			} else {
				// (before the physics has loaded: thrown, falling, resting where it lands)
				c.vy -= 9.81 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
				const g = ground(c.x, c.z) + c.size[1] / 2;
				if (c.y < g) { c.y = g; c.vy = Math.abs(c.vy) > 1.5 ? -c.vy * 0.25 : 0; c.vx *= 0.6; c.vz *= 0.6; c.wx *= 0.5; c.wy *= 0.5; c.wz *= 0.5; }
				c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
				c.still = Math.hypot(c.vx, c.vy, c.vz) < 0.2 ? c.still + dt : 0;
				QT.setFromEuler(EU.set(c.rx, c.ry, c.rz));
			}
			// at rest a while (the rubble below stays: the building's own, structures/shell.js):
			// shrunk away and freed
			if (c.still > 6 || c.age > 24) c.fade -= dt * 0.8;
			if (c.fade <= 0) { free(c, i); continue; }
			const k = Math.max(0, c.fade);
			chunks.setMatrixAt(i, M4.compose(P3.set(c.x, c.y, c.z), QT, S3.set(c.size[0] * k, c.size[1] * k, c.size[2] * k)));
		}
		chunks.instanceMatrix.needsUpdate = true;
	}

	// ---------- dust and smoke ----------
	const DN = isPhone ? 200 : 520;
	const dPos = new Float32Array(DN * 3), dCol = new Float32Array(DN * 4), dSize = new Float32Array(DN);
	const dg = new THREE.BufferGeometry();
	dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3).setUsage(THREE.DynamicDrawUsage));
	dg.setAttribute('color', new THREE.BufferAttribute(dCol, 4).setUsage(THREE.DynamicDrawUsage));
	dg.setAttribute('size', new THREE.BufferAttribute(dSize, 1).setUsage(THREE.DynamicDrawUsage));
	const dm = new THREE.ShaderMaterial({
		uniforms: { scale: { value: 600 } },
		vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(420.0, size * scale / max(0.5, -mv.z)); gl_Position = projectionMatrix * mv; }',
		// (a soft puff, lumpy at its edge, lit from above)
		fragmentShader: 'varying vec4 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); float lump = 0.82 + 0.18 * sin(atan(q.y, q.x) * 5.0 + vC.a * 40.0); if (r > lump) discard; float a = vC.a * (1.0 - r / lump) * (1.0 - r * 0.35); gl_FragColor = vec4(vC.rgb * (0.78 + 0.3 * (1.0 - q.y * 0.5 - 0.5)), a); }',
		transparent: true, depthWrite: false,
	});
	const dust = new THREE.Points(dg, dm);
	dust.frustumCulled = false; dust.renderOrder = 2;
	dust.onBeforeRender = (...args) => { const [r, , cam] = args; dm.uniforms.scale.value = r.getSize(V2).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)); };
	const V2 = new THREE.Vector2();
	group.add(dust);
	const D = Array.from({ length: DN }, () => ({ life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 3, c: 0.7, a: 0.55, sink: 0, drag: 0.9, warm: 0 }));
	let dn = 0;
	// n puffs about (x, y, z) over a spread, k their size; o: { life (s), roll (out along the ground
	// at this speed), smoke (dark, rising), alpha }
	function puff(x, y, z, n, spread = 2, k = 1, tint = 0.72, o = null) {
		const life = o?.life ?? (3.5 + 5 * Math.sqrt(k)), roll = o?.roll ?? 0, smoke = !!o?.smoke;
		for (let j = 0; j < n; j++) {
			const p = D[dn]; dn = (dn + 1) % DN;
			const a = Math.random() * Math.PI * 2, r = Math.random() * spread, out = roll ? roll * (0.6 + Math.random() * 0.6) : (0.6 + Math.random()) * k;
			Object.assign(p, {
				life: 0, max: life * (0.6 + Math.random() * 0.7), x: x + Math.cos(a) * r, y: y + (roll ? Math.random() * 0.8 : Math.random() * spread * 0.4), z: z + Math.sin(a) * r,
				vx: Math.cos(a) * out, vy: smoke ? 1.2 + Math.random() * 1.4 : roll ? 0.15 + Math.random() * 0.5 : 0.3 + Math.random() * 0.9 * k, vz: Math.sin(a) * out,
				s0: (0.8 + Math.random()) * k, s1: (smoke ? 5 + Math.random() * 5 : 3 + Math.random() * 4) * k, c: tint * (0.85 + Math.random() * 0.2),
				a: o?.alpha ?? (smoke ? 0.5 : 0.55), sink: smoke ? 0 : roll ? 0.5 : 0.3, drag: roll ? 1.5 : 0.9, warm: smoke ? 1 : 0,
			});
		}
	}
	function stepDust(dt) {
		for (let i = 0; i < DN; i++) {
			const p = D[i];
			if (p.life >= p.max) { dCol[i * 4 + 3] = 0; dSize[i] = 0; continue; }
			p.life += dt;
			const t = p.life / p.max, drag = Math.exp(-dt * p.drag);
			// (rising while it is warm, then hanging, then sinking back to settle)
			p.vx *= drag; p.vz *= drag;
			p.vy = p.vy * Math.exp(-dt * 0.6) + (p.warm ? 0.35 * (1 - t) : t < 0.3 ? 0.05 : -0.12 * p.sink) * dt;
			p.x += (p.vx + 0.25 + p.warm * 0.4) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			const size = p.s0 + (p.s1 - p.s0) * Math.sqrt(t), g = ground(p.x, p.z) + size * 0.2;
			if (p.y < g) { p.y = g; p.vy = Math.max(0, p.vy); }
			dPos[i * 3] = p.x; dPos[i * 3 + 1] = p.y; dPos[i * 3 + 2] = p.z;
			const c = p.warm ? p.c * (0.6 + 0.4 * t) : p.c;
			dCol[i * 4] = c; dCol[i * 4 + 1] = c * 0.95; dCol[i * 4 + 2] = c * (p.warm ? 0.92 : 0.86); dCol[i * 4 + 3] = Math.min(1, t * 10) * Math.pow(1 - t, 1.3) * p.a;
			dSize[i] = size;
		}
		for (const k of ['position', 'color', 'size']) dg.attributes[k].needsUpdate = true;
	}

	// ---------- fire ----------
	const FN = isPhone ? 90 : 240;
	const fPos = new Float32Array(FN * 3), fCol = new Float32Array(FN * 4), fSize = new Float32Array(FN);
	const fgeo = new THREE.BufferGeometry();
	fgeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
	fgeo.setAttribute('color', new THREE.BufferAttribute(fCol, 4).setUsage(THREE.DynamicDrawUsage));
	fgeo.setAttribute('size', new THREE.BufferAttribute(fSize, 1).setUsage(THREE.DynamicDrawUsage));
	const fm = new THREE.ShaderMaterial({
		uniforms: dm.uniforms,
		vertexShader: dm.vertexShader,
		// (a tongue of flame: bright at its root, licking up)
		fragmentShader: 'varying vec4 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; q.x *= 1.0 + q.y * 0.6; float r = dot(q, q); if (r > 1.0) discard; float a = vC.a * pow(1.0 - r, 1.6); gl_FragColor = vec4(vC.rgb * a, a); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const flames = new THREE.Points(fgeo, fm);
	flames.frustumCulled = false; flames.renderOrder = 3;
	flames.onBeforeRender = dust.onBeforeRender;
	group.add(flames);
	const Fl = Array.from({ length: FN }, () => ({ life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1 }));
	let fn = 0;
	function flame(x, y, z, k) {
		const p = Fl[fn]; fn = (fn + 1) % FN;
		Object.assign(p, { life: 0, max: 0.5 + Math.random() * 0.6, x: x + (Math.random() - 0.5) * k, y: y + Math.random() * 0.3, z: z + (Math.random() - 0.5) * k, vx: (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random() * 2 * k, vz: (Math.random() - 0.5) * 0.6, s: (0.7 + Math.random() * 0.8) * k });
	}
	function stepFlames(dt) {
		for (let i = 0; i < FN; i++) {
			const p = Fl[i];
			if (p.life >= p.max) { fCol[i * 4 + 3] = 0; fSize[i] = 0; continue; }
			p.life += dt;
			const t = p.life / p.max;
			p.x += (p.vx + 0.3) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			fPos[i * 3] = p.x; fPos[i * 3 + 1] = p.y; fPos[i * 3 + 2] = p.z;
			// (white-yellow at the root, orange, a dull red as it goes)
			fCol[i * 4] = 1; fCol[i * 4 + 1] = Math.max(0.15, 0.85 - t * 0.75); fCol[i * 4 + 2] = Math.max(0, 0.45 - t * 0.9); fCol[i * 4 + 3] = Math.min(1, t * 6) * (1 - t) * 0.9;
			fSize[i] = p.s * (1 - t * 0.55);
		}
		for (const k of ['position', 'color', 'size']) fgeo.attributes[k].needsUpdate = true;
	}
	// what burns and what hangs on: by owner, a list of { x, y, z, k } fires, or a haze of dust
	// over a fresh wreck for a while; each gives off its flames and smoke (or dust) every frame
	const burning = new Map();
	let hazes = [];
	function burn(id, spots) {
		if (!spots || !spots.length) burning.delete(id);
		else burning.set(id, spots.slice(0, 6).map((q) => ({ ...q, acc: Math.random(), sm: Math.random() })));
	}
	function haze(x, y, z, r, seconds) {
		hazes.push({ x, y, z, r, until: performance.now() + seconds * 1000, acc: 0 });
		if (hazes.length > 6) hazes.shift();
	}
	function stepEmitters(dt) {
		let n = 0;
		for (const spots of burning.values()) for (const q of spots) {
			if (n++ > 18) break;
			q.acc += dt * (isPhone ? 9 : 22) * q.k;
			while (q.acc > 1) { q.acc -= 1; flame(q.x, q.y, q.z, q.k); }
			q.sm += dt * (isPhone ? 0.8 : 1.6) * q.k;
			if (q.sm > 1) { q.sm -= 1; puff(q.x, q.y + 1.2 * q.k, q.z, 1, 0.4, 0.8 + q.k * 0.6, 0.16, { smoke: true, life: 9 + 5 * q.k }); }
		}
		const now = performance.now();
		hazes = hazes.filter((h) => h.until > now);
		for (const h of hazes) {
			h.acc += dt * (isPhone ? 0.5 : 1.2);
			if (h.acc > 1) { h.acc -= 1; puff(h.x, h.y, h.z, 1, h.r, 1.6, 0.7, { life: 14, alpha: 0.3 }); }
		}
	}

	// ---------- glass shards ----------
	const SN = isPhone ? 140 : 300;
	const shardGeo = new THREE.BufferGeometry();
	shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.4, 0, 0.5, -0.5, 0, 0.1, 0.6, 0, 0.5, -0.5, 0, -0.5, -0.4, 0, 0.1, 0.6, 0], 3));
	shardGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
	const shardMat = new THREE.MeshStandardMaterial({ color: 0xcfe6ee, metalness: 0.9, roughness: 0.06, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
	const shards = new THREE.InstancedMesh(shardGeo, shardMat, SN);
	shards.count = SN; shards.frustumCulled = false; shards.renderOrder = 1;
	for (let i = 0; i < SN; i++) shards.setMatrixAt(i, HIDE);
	group.add(shards);
	const S = Array.from({ length: SN }, () => ({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 0.1, age: 0, rest: 0 }));
	let sn = 0;
	// n shards from a pane: centre (x, y, z), its half width and height, its outward normal,
	// and a push (a shot's direction, a body's or a car's velocity)
	function shatter(x, y, z, hw, hh, nx, nz, n, push = null) {
		const tx = -nz, tz = nx;
		for (let j = 0; j < n; j++) {
			const s = S[sn]; sn = (sn + 1) % SN;
			const u = (Math.random() * 2 - 1) * hw, v = (Math.random() * 2 - 1) * hh, out = (Math.random() - 0.3) * 2.2;
			const px = push ? push[0] : 0, py = push ? push[1] : 0, pz = push ? push[2] : 0;
			Object.assign(s, { live: true, age: 0, rest: 0, x: x + tx * u, y: y + v, z: z + tz * u, vx: nx * out + px * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5), vy: py * 0.3 + Math.random() * 1.2, vz: nz * out + pz * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5), rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18, wz: (Math.random() - 0.5) * 18, s: 0.04 + Math.pow(Math.random(), 2) * 0.32 });
		}
	}
	function stepShards(dt) {
		let any = false;
		for (let i = 0; i < SN; i++) {
			const s = S[i];
			if (!s.live) continue;
			any = true;
			s.age += dt;
			if (s.rest < 1) {
				s.vy -= 9.81 * dt;
				// (thin glass sails a little as it falls)
				s.vx *= 1 - dt * 0.4; s.vz *= 1 - dt * 0.4; s.vy = Math.max(s.vy, -14);
				s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
				s.rx += s.wx * dt; s.ry += s.wy * dt; s.rz += s.wz * dt;
				const g = ground(s.x, s.z) + 0.01;
				if (s.y < g) {
					s.y = g;
					if (s.vy < -2) { s.vy = -s.vy * 0.22; s.vx *= 0.5; s.vz *= 0.5; s.wx *= 0.3; s.wy *= 0.3; s.wz *= 0.3; }
					else { s.rest = 1; s.rx = Math.PI / 2; s.rz = 0; }
				}
			}
			const k = s.age > 9 ? Math.max(0, 1 - (s.age - 9) / 2) : 1;
			if (k <= 0) { s.live = false; shards.setMatrixAt(i, HIDE); continue; }
			QT.setFromEuler(EU.set(s.rx, s.ry, s.rz));
			shards.setMatrixAt(i, M4.compose(P3.set(s.x, s.y, s.z), QT, S3.set(s.s * k, s.s * k, s.s * k)));
		}
		if (any) shards.instanceMatrix.needsUpdate = true;
	}

	function update(dt) { stepChunks(dt); stepEmitters(dt); stepDust(dt); stepFlames(dt); stepShards(dt); }
	const counts = () => ({ chunks: C.filter((c) => c.live).length, physics: !!world, dust: D.filter((p) => p.life < p.max).length, flames: Fl.filter((p) => p.life < p.max).length, fires: [...burning.values()].reduce((a, q) => a + q.length, 0), hazes: hazes.length, shards: S.filter((s) => s.live).length });
	function dispose() { scene.remove(group); chunkGeo.dispose(); chunkMat.dispose(); dg.dispose(); dm.dispose(); fgeo.dispose(); fm.dispose(); shardGeo.dispose(); shardMat.dispose(); world?.free(); world = null; }
	return { group, chunk, puff, haze, burn, shatter, update, counts, dispose, cap: CAP };
}
