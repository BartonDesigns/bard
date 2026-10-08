// What a fight looks like, all from fixed pools made once (nothing is created while you fire):
// tracers and flying bolts (one instanced streak mesh each), sparks, embers, fire and flashes
// (additive points), smoke and dust (soft points), debris and glass shards (small instanced
// chips that bounce on the ground), marks on walls (an instanced decal of a chipped hole or a
// scorch), blood where a person is struck (a dark puff and a stain on the ground that fades;
// nothing more), the Spark's shimmer round a warded child, and the bosses' warnings (rings on
// the ground, beams). Lights are never added (that would recompile every material in the
// scene); glow is drawn.

import * as THREE from 'three';

const TRACER_COL = [new THREE.Color(1.0, 0.78, 0.42), new THREE.Color(1.0, 0.92, 0.7), new THREE.Color(0.45, 0.95, 1.0), new THREE.Color(0.9, 0.85, 0.7), new THREE.Color(1.0, 0.35, 0.25), new THREE.Color(0.75, 0.55, 1.0)];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _c = new THREE.Color();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

// soft round points, sized in metres, one buffer each for additive glow and for smoke
function pointsPool(n, additive) {
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
	const m = new THREE.ShaderMaterial({
		uniforms: { scale: { value: 600 } },
		vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
		fragmentShader: additive
			? 'varying vec4 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; float a = (1.0 - r); a *= a; gl_FragColor = vec4(vC.rgb * a * vC.a, 1.0); }'
			: 'varying vec4 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r) * (1.0 - r * 0.5)); }',
		transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
	});
	const pts = new THREE.Points(g, m);
	pts.frustumCulled = false; pts.renderOrder = additive ? 3 : 2;
	const P = [];
	for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0.1, s1: 0.1, r: 1, gC: 1, b: 1, a: 1 });
	let next = 0;
	function emit(x, y, z, vx, vy, vz, life, s0, s1, r, gC, b, a = 1, grav = 0, drag = 1) {
		const p = P[next]; next = (next + 1) % n;
		p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.r = r; p.gC = gC; p.b = b; p.a = a; p.g = grav; p.drag = drag;
	}
	function update(dt) {
		let live = 0;
		for (let i = 0; i < n; i++) {
			const p = P[i];
			if (p.life <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
			live++;
			p.life -= dt;
			const k = Math.exp(-p.drag * dt);
			p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			const u = 1 - Math.max(0, p.life) / p.max;
			pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
			size[i] = p.life > 0 ? p.s0 + (p.s1 - p.s0) * u : 0;
			const fade = additive ? (1 - u) : Math.min(1, u * 6) * (1 - u);
			col[i * 4] = p.r; col[i * 4 + 1] = p.gC; col[i * 4 + 2] = p.b; col[i * 4 + 3] = p.a * fade;
		}
		g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = true;
		return live;
	}
	return { pts, emit, update, m };
}

// an instanced pool of one shape; slot() hands out the oldest
function instPool(geo, mat, n) {
	const mesh = new THREE.InstancedMesh(geo, mat, n);
	mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	mesh.frustumCulled = false;
	for (let i = 0; i < n; i++) mesh.setMatrixAt(i, HIDE);
	mesh.setColorAt(0, _c.setRGB(1, 1, 1));
	let next = 0;
	return { mesh, n, slot: () => { const i = next; next = (next + 1) % n; return i; } };
}

// the decal: a chipped hole with a scuffed ring, or a scorch (two cells of one small canvas)
function decalTexture() {
	const c = document.createElement('canvas'); c.width = 128; c.height = 64;
	const x = c.getContext('2d');
	for (let k = 0; k < 2; k++) {
		const cx = 32 + k * 64, cy = 32;
		const g = x.createRadialGradient(cx, cy, 0, cx, cy, 30);
		if (k === 0) { g.addColorStop(0, 'rgba(10,10,10,1)'); g.addColorStop(0.18, 'rgba(25,24,22,0.95)'); g.addColorStop(0.3, 'rgba(70,68,64,0.6)'); g.addColorStop(0.55, 'rgba(120,118,112,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
		else { g.addColorStop(0, 'rgba(8,6,5,0.95)'); g.addColorStop(0.5, 'rgba(20,16,12,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
		x.fillStyle = g; x.fillRect(k * 64, 0, 64, 64);
		if (k === 0) { x.strokeStyle = 'rgba(30,30,28,0.7)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; x.beginPath(); x.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); x.lineTo(cx + Math.cos(a + 0.2) * 14, cy + Math.sin(a + 0.2) * 14); x.stroke(); } }
	}
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

export function createFx({ isPhone = false, ground = () => -1e9 } = {}) {
	const group = new THREE.Group();
	group.name = 'combat-fx';
	const glow = pointsPool(isPhone ? 320 : 900, true), smoke = pointsPool(isPhone ? 200 : 520, false);
	group.add(glow.pts, smoke.pts);

	// streaks: tracers and bolts (a unit box from z 0 to 1, stretched)
	const streakGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
	const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
	const streaks = instPool(streakGeo, streakMat, isPhone ? 48 : 96);
	group.add(streaks.mesh);
	const S = [];
	for (let i = 0; i < streaks.n; i++) S.push({ life: 0, ax: 0, ay: 0, az: 0, dx: 0, dy: 0, dz: 0, len: 0, at: 0, speed: 0, w: 0.02, tail: 6, ci: 0, held: false });

	// debris chips and glass shards
	const chipGeo = new THREE.BoxGeometry(1, 1, 1);
	const chips = instPool(chipGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }), isPhone ? 60 : 140);
	const shardGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, -0.35, -0.4, 0, 0.4, -0.3, 0, 0, 0.5, 0, 0.4, -0.3, 0, -0.35, -0.4, 0], 3));
	shardGeo.computeVertexNormals();
	const shards = instPool(shardGeo, new THREE.MeshStandardMaterial({ color: 0xcfe8f0, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), isPhone ? 48 : 110);
	group.add(chips.mesh, shards.mesh);
	const bits = [];
	const makeBits = (pool, list) => { for (let i = 0; i < pool.n; i++) list.push({ pool, i, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0.1 }); };
	const chipBits = [], shardBits = [];
	makeBits(chips, chipBits); makeBits(shards, shardBits);
	bits.push(...chipBits, ...shardBits);

	// marks on walls
	const decalTex = decalTexture();
	const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
	// (one pool for the chipped holes, one for the scorches: each its half of the canvas)
	const decalPools = [0, 0.5].map((u0) => {
		const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv;
		for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5);
		return instPool(g, decalMat, isPhone ? (u0 ? 16 : 64) : (u0 ? 32 : 160));
	});
	group.add(decalPools[0].mesh, decalPools[1].mesh);
	// stains on the ground where someone was struck: they fade after a while
	const bloodTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 7; i++) { const r = 6 + Math.random() * 14, px = 32 + (Math.random() - 0.5) * 26, py = 32 + (Math.random() - 0.5) * 26, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(70,6,8,0.9)'); g.addColorStop(0.7, 'rgba(60,4,6,0.6)'); g.addColorStop(1, 'rgba(50,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
	const blood = instPool(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: bloodTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), isPhone ? 16 : 40);
	const bloodLife = new Float32Array(blood.n), bloodAt = [];
	group.add(blood.mesh);
	// the Spark: a shimmering shell round a warded child
	const wardMat = new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
	const wards = [];
	for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), wardMat.clone()); m.visible = false; group.add(m); wards.push({ m, life: 0 }); }

	// warnings: rings on the ground and beams
	const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
	const rings = [];
	for (let i = 0; i < 16; i++) {
		const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48, 1).rotateX(-Math.PI / 2), ringMat.clone());
		const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), ringMat.clone());
		fill.material.opacity = 0.18; m.add(fill);
		m.visible = false; m.renderOrder = 4; group.add(m);
		rings.push({ m, fill, life: 0, max: 1, r: 1, grow: false });
	}
	const beams = [];
	for (let i = 0; i < 6; i++) {
		const m = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
		m.visible = false; group.add(m);
		beams.push({ m, life: 0, max: 1, w: 0.1 });
	}

	// ---------- the effects ----------
	function streakAt(i, ax, ay, az, dx, dy, dz, len, w) {
		_p.set(ax, ay, az); _d.set(dx, dy, dz);
		_q.setFromUnitVectors(_z, _d);
		_m.compose(_p, _q, _s.set(w, w, Math.max(0.01, len)));
		streaks.mesh.setMatrixAt(i, _m);
	}
	// a shot's streak from a to b (style: TRACER_COL index)
	function tracer(a, b, style = 0, speed = 520) {
		const i = streaks.slot(), T = S[i];
		const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1;
		Object.assign(T, { life: L / speed + 0.05, ax: a.x, ay: a.y, az: a.z, dx: dx / L, dy: dy / L, dz: dz / L, len: L, at: 0, speed, w: style === 2 ? 0.05 : style === 3 ? 0.012 : 0.022, tail: style === 2 ? 4 : style === 3 ? 0.7 : 7, ci: style, held: false });
		streaks.mesh.setColorAt(i, TRACER_COL[style] || TRACER_COL[0]);
		streaks.mesh.instanceColor.needsUpdate = true;
	}
	// a streak placed by its owner each frame (projectiles): returns its slot; free() lets go
	function held(style = 0, w = 0.03) {
		const i = streaks.slot();
		S[i].held = true; S[i].life = 1e9; S[i].w = w; S[i].ci = style;
		streaks.mesh.setColorAt(i, TRACER_COL[style] || TRACER_COL[0]); streaks.mesh.instanceColor.needsUpdate = true;
		return i;
	}
	function place(i, x, y, z, dx, dy, dz, len) { if (S[i].held) streakAt(i, x, y, z, dx, dy, dz, len, S[i].w); }
	function free(i) { if (i == null) return; S[i].held = false; S[i].life = 0; streaks.mesh.setMatrixAt(i, HIDE); }

	function sparks(p, n = 8, nrm = null, r = 1, g = 0.75, b = 0.35, speed = 6) {
		for (let k = 0; k < n; k++) {
			let vx = (Math.random() - 0.5) * 2, vy = Math.random() * 1.4, vz = (Math.random() - 0.5) * 2;
			if (nrm) { vx += nrm.x * 1.5; vy += nrm.y * 1.5; vz += nrm.z * 1.5; }
			const s = speed * (0.4 + Math.random());
			glow.emit(p.x, p.y, p.z, vx * s, vy * s, vz * s, 0.15 + Math.random() * 0.25, 0.05, 0.02, r, g, b, 1, 9, 2);
		}
		glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.06, 0.35, 0.5, r, g, b, 0.8);
	}
	function dust(p, n = 4, r = 0.55, g = 0.52, b = 0.48, size = 0.5, up = 0.6) {
		for (let k = 0; k < n; k++) smoke.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 1.2, Math.random() * up + 0.2, (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.6, size * 0.4, size * (1.2 + Math.random()), r, g, b, 0.55, -0.3, 1.5);
	}
	function smokePuff(p, dark = 0.2, size = 1.4, life = 2.4) {
		smoke.emit(p.x + (Math.random() - 0.5) * 0.5, p.y, p.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6, life * (0.7 + Math.random() * 0.5), size * 0.5, size * 2.2, dark, dark * 0.95, dark * 0.9, 0.5, -0.2, 0.6);
	}
	function flame(p, k = 1) {
		glow.emit(p.x + (Math.random() - 0.5) * 0.8 * k, p.y, p.z + (Math.random() - 0.5) * 0.8 * k, (Math.random() - 0.5) * 0.5, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.35, 0.6 * k, 0.15, 1, 0.45 + Math.random() * 0.2, 0.12, 0.9, -1, 1);
	}
	function chunks(list, p, n, col, speed, size) {
		for (let k = 0; k < n; k++) {
			const B = list.find((x) => x.life <= 0) || list[Math.floor(Math.random() * list.length)];
			B.life = 2.5 + Math.random() * 1.5; B.s = size * (0.5 + Math.random());
			B.p.set(p.x + (Math.random() - 0.5) * 0.4, p.y + (Math.random() - 0.5) * 0.4, p.z + (Math.random() - 0.5) * 0.4);
			B.v.set((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.3, (Math.random() - 0.5) * 2).multiplyScalar(speed);
			B.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); B.w.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
			if (col) B.pool.mesh.setColorAt(B.i, _c.set(col));
		}
		if (col) list[0].pool.mesh.instanceColor.needsUpdate = true;
	}
	const debris = (p, n = 6, col = 0x8a8278, speed = 4, size = 0.12) => chunks(chipBits, p, n, col, speed, size);
	const glass = (p, n = 14, speed = 3.5, size = 0.22) => chunks(shardBits, p, n, null, speed, size);

	function decal(p, n, size = 0.18, kind = 0) {
		const D = decalPools[kind ? 1 : 0], i = D.slot();
		_p.set(p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01);
		_q.setFromUnitVectors(_z, _d.set(n.x, n.y, n.z));
		_q.multiply(new THREE.Quaternion().setFromAxisAngle(_z, Math.random() * 6.283));
		_m.compose(_p, _q, _s.setScalar(size * (0.8 + Math.random() * 0.4)));
		D.mesh.setMatrixAt(i, _m);
		D.mesh.instanceMatrix.needsUpdate = true;
	}

	// what a shot looks like where it lands, by what it struck
	function impact(p, n, surf = 'stone', energy = false) {
		const N = n || { x: 0, y: 1, z: 0 };
		if (energy) { sparks(p, 10, N, 0.4, 0.9, 1, 5); return; }
		if (surf === 'metal' || surf === 'machine') { sparks(p, 9, N, 1, 0.8, 0.45, 7); if (n && surf === 'metal') decal(p, N, 0.12, 0); return; }
		if (surf === 'glass') { glass(p, 5, 2.5, 0.12); sparks(p, 3, N, 0.8, 0.9, 1, 3); return; }
		if (surf === 'crystal') { sparks(p, 10, N, 0.75, 0.55, 1, 6); glass(p, 3, 3, 0.15); return; }
		if (surf === 'person') { bleed(p, N); return; }
		if (surf === 'creature') { sparks(p, 6, N, 0.5, 1, 0.6, 4); dust(p, 2, 0.4, 0.45, 0.35, 0.3, 0.3); return; }
		if (surf === 'wood') { debris(p, 3, 0x8a6a45, 3, 0.05); dust(p, 2, 0.6, 0.52, 0.4, 0.3); if (n) decal(p, N, 0.1, 0); return; }
		if (surf === 'ground') { dust(p, 4, 0.5, 0.46, 0.4, 0.5, 1); debris(p, 2, 0x6a6258, 3, 0.04); return; }
		dust(p, 3, 0.62, 0.6, 0.57, 0.35, 0.6); debris(p, 3, 0x9a958c, 3.5, 0.04); sparks(p, 2, N, 1, 0.85, 0.6, 3);
		if (n) decal(p, N, 0.16, 0);
	}
	// a person struck: a dark red puff, and a stain on the ground below that fades
	function bleed(p, n) {
		for (let k = 0; k < 6; k++) smoke.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 1.5 + (n?.x || 0), Math.random() * 0.8, (Math.random() - 0.5) * 1.5 + (n?.z || 0), 0.35 + Math.random() * 0.3, 0.06, 0.28, 0.35, 0.02, 0.03, 0.8, 3, 3);
		const gy = ground(p.x, p.z);
		if (!Number.isFinite(gy) || p.y - gy > 2.2) return;
		const i = blood.slot();
		bloodLife[i] = 40; bloodAt[i] = { x: p.x + (Math.random() - 0.5) * 0.4, y: gy + 0.025, z: p.z + (Math.random() - 0.5) * 0.4, s: 0.5 + Math.random() * 0.5, r: Math.random() * 6.283 };
		const B = bloodAt[i];
		_m.compose(_p.set(B.x, B.y, B.z), _q.setFromAxisAngle(_d.set(0, 1, 0), B.r), _s.setScalar(B.s));
		blood.mesh.setMatrixAt(i, _m); blood.mesh.instanceMatrix.needsUpdate = true;
	}
	// the Spark turning harm aside: a shimmer round them and a burst of light where it struck
	function ward(c, r = 0.9, at = null) {
		const W = wards.find((w) => w.life <= 0) || wards[0];
		W.life = 0.9; W.m.position.set(c.x, c.y, c.z); W.m.scale.setScalar(r); W.m.visible = true;
		const q = at || c;
		for (let k = 0; k < 14; k++) glow.emit(q.x, q.y, q.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.5 + Math.random() * 0.4, 0.08, 0.02, 0.65, 0.95, 1, 1, -1, 2);
		glow.emit(q.x, q.y, q.z, 0, 0, 0, 0.25, 0.4, 1.2, 1, 0.92, 0.6, 0.9);
	}
	// a blast: a flash, a fireball, smoke, debris and a scorch on the ground under it
	function explosion(p, r = 3, scorch = true) {
		glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.18, r * 1.6, r * 2.6, 1, 0.85, 0.55, 1);
		for (let k = 0; k < 26; k++) {
			const a = Math.random() * 6.283, e = Math.random() * 1.2, s = r * (1.5 + Math.random() * 2.5);
			glow.emit(p.x, p.y + 0.3, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1, Math.sin(a) * Math.cos(e) * s, 0.4 + Math.random() * 0.5, r * 0.5, r * 0.15, 1, 0.5 + Math.random() * 0.3, 0.12, 1, -0.5, 3);
		}
		for (let k = 0; k < 12; k++) smokePuff({ x: p.x + (Math.random() - 0.5) * r, y: p.y + Math.random() * r * 0.6, z: p.z + (Math.random() - 0.5) * r }, 0.16, r * 0.9, 3.5);
		sparks(p, 16, null, 1, 0.7, 0.3, 12);
		debris(p, 10, 0x2a2622, 7, 0.14);
		const gy = ground(p.x, p.z);
		if (scorch && Number.isFinite(gy) && p.y - gy < r) decal({ x: p.x, y: gy + 0.03, z: p.z }, { x: 0, y: 1, z: 0 }, r * 1.6, 1);
	}
	// a muzzle's flash (third person and friends: the view draws its own in first person)
	function muzzle(p, d, style = 0) {
		const C = TRACER_COL[style] || TRACER_COL[0];
		glow.emit(p.x + d.x * 0.1, p.y + d.y * 0.1, p.z + d.z * 0.1, d.x * 2, d.y * 2, d.z * 2, 0.05, 0.25, 0.4, C.r, C.g, C.b, 0.9);
	}
	function ring(x, y, z, r, life = 1.5, color = 0xff5a3a, grow = false) {
		const R = rings.find((q) => q.life <= 0) || rings[0];
		R.life = R.max = life; R.r = r; R.grow = grow;
		R.m.position.set(x, y + 0.08, z); R.m.scale.setScalar(grow ? 0.01 : r);
		R.m.material.color.set(color); R.fill.material.color.set(color);
		R.m.visible = true;
		return R;
	}
	function beam(a, b, life = 1, color = 0xff3a2a, w = 0.1) {
		const B = beams.find((q) => q.life <= 0) || beams[0];
		B.life = B.max = life; B.w = w; B.m.material.color.set(color);
		setBeam(B, a, b);
		B.m.visible = true;
		return B;
	}
	function setBeam(B, a, b) {
		_d.set(b.x - a.x, b.y - a.y, b.z - a.z);
		const L = _d.length() || 1;
		B.m.position.set(a.x, a.y, a.z); B.m.quaternion.setFromUnitVectors(_z, _d.multiplyScalar(1 / L)); B.m.scale.set(B.w, B.w, L);
	}

	let streakDirty = false;
	function update(dt, time = performance.now() / 1000) {
		glow.update(dt); smoke.update(dt);
		for (let i = 0; i < S.length; i++) {
			const T = S[i];
			if (T.held) { streakDirty = true; continue; }
			if (T.life <= 0) continue;
			T.life -= dt; T.at += T.speed * dt;
			streakDirty = true;
			if (T.life <= 0 || T.at - T.tail > T.len) { T.life = 0; streaks.mesh.setMatrixAt(i, HIDE); continue; }
			const head = Math.min(T.len, T.at), tail = Math.max(0, head - T.tail);
			streakAt(i, T.ax + T.dx * tail, T.ay + T.dy * tail, T.az + T.dz * tail, T.dx, T.dy, T.dz, head - tail, T.w);
		}
		if (streakDirty) { streaks.mesh.instanceMatrix.needsUpdate = true; streakDirty = false; }
		let moved = false;
		for (const B of bits) {
			if (B.life <= 0) continue;
			B.life -= dt; moved = true;
			if (B.life <= 0) { B.pool.mesh.setMatrixAt(B.i, HIDE); continue; }
			B.v.y -= 9.8 * dt;
			B.p.addScaledVector(B.v, dt);
			const gy = ground(B.p.x, B.p.z);
			if (Number.isFinite(gy) && B.p.y < gy + B.s * 0.3) { B.p.y = gy + B.s * 0.3; B.v.y *= -0.25; B.v.x *= 0.6; B.v.z *= 0.6; B.w.multiplyScalar(0.7); }
			B.r.x += B.w.x * dt; B.r.y += B.w.y * dt; B.r.z += B.w.z * dt;
			_q.setFromEuler(B.r);
			const fade = Math.min(1, B.life * 2);
			_m.compose(B.p, _q, _s.setScalar(B.s * fade));
			B.pool.mesh.setMatrixAt(B.i, _m);
		}
		if (moved) { chips.mesh.instanceMatrix.needsUpdate = true; shards.mesh.instanceMatrix.needsUpdate = true; }
		let bl = false;
		for (let i = 0; i < blood.n; i++) {
			if (bloodLife[i] <= 0) continue;
			bloodLife[i] -= dt;
			if (bloodLife[i] < 4) { const B = bloodAt[i], k = Math.max(0, bloodLife[i] / 4); _m.compose(_p.set(B.x, B.y, B.z), _q.setFromAxisAngle(_d.set(0, 1, 0), B.r), _s.setScalar(B.s * k)); blood.mesh.setMatrixAt(i, k > 0 ? _m : HIDE); bl = true; }
		}
		if (bl) blood.mesh.instanceMatrix.needsUpdate = true;
		for (const W of wards) {
			if (W.life <= 0) continue;
			W.life -= dt;
			W.m.material.opacity = Math.max(0, W.life) * 0.5 * (0.7 + 0.3 * Math.sin(time * 40));
			W.m.rotation.y += dt * 3;
			if (W.life <= 0) W.m.visible = false;
		}
		for (const R of rings) {
			if (R.life <= 0) continue;
			R.life -= dt;
			if (R.life <= 0) { R.m.visible = false; continue; }
			const u = 1 - R.life / R.max;
			const pulse = 0.5 + 0.5 * Math.sin(time * 14);
			R.m.material.opacity = 0.35 + 0.45 * pulse * (0.4 + u * 0.6);
			R.fill.material.opacity = 0.08 + 0.22 * u;
			if (R.grow) R.m.scale.setScalar(Math.max(0.01, R.r * u));
		}
		for (const B of beams) {
			if (B.life <= 0) continue;
			B.life -= dt;
			if (B.life <= 0) { B.m.visible = false; continue; }
			B.m.material.opacity = 0.4 + 0.4 * Math.sin(time * 30) ** 2;
		}
	}
	function clear() {
		for (let i = 0; i < S.length; i++) { S[i].life = 0; S[i].held = false; streaks.mesh.setMatrixAt(i, HIDE); }
		for (const B of bits) { B.life = 0; B.pool.mesh.setMatrixAt(B.i, HIDE); }
		for (const D of decalPools) { for (let i = 0; i < D.n; i++) D.mesh.setMatrixAt(i, HIDE); D.mesh.instanceMatrix.needsUpdate = true; }
		for (const R of rings) { R.life = 0; R.m.visible = false; }
		for (const B of beams) { B.life = 0; B.m.visible = false; }
		streaks.mesh.instanceMatrix.needsUpdate = chips.mesh.instanceMatrix.needsUpdate = shards.mesh.instanceMatrix.needsUpdate = true;
	}
	// the points' size on screen follows the viewport's height
	const resize = (h, fov) => { const k = h / (2 * Math.tan((fov * Math.PI) / 360)); glow.m.uniforms.scale.value = smoke.m.uniforms.scale.value = k; };
	return { group, tracer, held, place, free, sparks, dust, smokePuff, flame, debris, glass, decal, impact, explosion, muzzle, ring, beam, setBeam, bleed, ward, update, clear, resize, TRACER_COL };
}
