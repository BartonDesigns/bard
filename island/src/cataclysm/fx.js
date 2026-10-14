// What a catastrophe looks like, drawn from fixed pools made once (nothing allocated as it
// runs): flames (an instanced billboard each, licking and leaning in the wind), smoke (soft
// lit puffs that climb, spread and drift downwind, warm underneath where the fire lights them),
// embers and ash (bright sparks thrown up and carried, or grey flakes coming down), the
// spray of a hose, and marks on the ground (scorched earth where the fire has been, the
// cracks a quake opens in the street). Phones get smaller pools.

import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _v2 = new THREE.Vector2();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

const NOISE = /* glsl */`
float ch(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
float cn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }
float cf(vec2 p) { return cn(p) * 0.55 + cn(p * 2.1 + 1.7) * 0.3 + cn(p * 4.3 - 2.3) * 0.15; }
`;

// ---------- flames ----------
function flameMaterial(uTime) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime, uFar: { value: 900 } },
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
		vertexShader: /* glsl */`
			attribute float aSeed; attribute float aHeat;
			uniform float uTime; uniform float uFar;
			varying vec2 vUv; varying float vSeed; varying float vHeat; varying float vFade;
			void main() {
				vUv = uv; vSeed = aSeed; vHeat = aHeat;
				vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
				float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
				vec3 toCam = cameraPosition - c; toCam.y = 0.0;
				vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4, 0.0, 0.0))));
				float lean = sin(uTime * 2.3 + aSeed * 17.0) * 0.12 + 0.18;
				vec3 w = c + right * (position.x * sx + lean * position.y * position.y * sx) + vec3(0.0, position.y * sy, 0.0);
				vFade = 1.0 - smoothstep(uFar * 0.6, uFar, length(cameraPosition - c));
				gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
			}`,
		fragmentShader: /* glsl */`
			uniform float uTime;
			varying vec2 vUv; varying float vSeed; varying float vHeat; varying float vFade;
			${NOISE}
			void main() {
				vec2 uv = vUv;
				float n = cf(vec2(uv.x * 3.2 + vSeed * 9.0, uv.y * 2.4 - uTime * 2.6 - vSeed * 5.0));
				float w = 0.48 * pow(1.0 - uv.y, 0.55) + 0.02;
				float d = abs(uv.x - 0.5 + (n - 0.5) * 0.35 * uv.y) / w;
				float body = smoothstep(1.0, 0.45, d) * smoothstep(1.0, 0.35, uv.y + (n - 0.5) * 0.55);
				body *= smoothstep(0.0, 0.08, uv.y);
				if (body < 0.01) discard;
				float t = body * (1.15 - uv.y * 0.8);
				vec3 col = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.36, 0.05), smoothstep(0.1, 0.5, t));
				col = mix(col, vec3(1.0, 0.78, 0.32), smoothstep(0.5, 0.85, t));
				col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.85, 1.1, t));
				gl_FragColor = vec4(col * body * (0.6 + vHeat * 1.1) * vFade, 1.0);
			}`,
	});
}

// ---------- points: smoke (lit, soft) and sparks (embers, ash, spray) ----------
function pointsMaterial(kind) {
	const smoke = kind === 'smoke';
	return new THREE.ShaderMaterial({
		uniforms: { uScale: { value: 400 }, uLight: { value: new THREE.Color(1, 1, 1) }, uFire: { value: new THREE.Color(1, 0.42, 0.12) } },
		transparent: true, depthWrite: false, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: !smoke ? false : true,
		vertexShader: /* glsl */`
			attribute float aSize; attribute vec4 aCol; attribute float aSeed;
			uniform float uScale;
			varying vec4 vCol; varying float vSeed;
			void main() {
				vCol = aCol; vSeed = aSeed;
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = aCol.a <= 0.0 ? 0.0 : clamp(aSize * uScale / max(0.5, -mv.z), ${smoke ? '0.0' : '1.6'}, 480.0);
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: smoke ? /* glsl */`
			uniform vec3 uLight; uniform vec3 uFire;
			varying vec4 vCol; varying float vSeed;
			${NOISE}
			void main() {
				vec2 p = gl_PointCoord * 2.0 - 1.0;
				float r = dot(p, p);
				if (r > 1.0) discard;
				float n = cf(gl_PointCoord * 2.6 + vSeed * 13.0);
				float a = pow(1.0 - r, 1.4) * (0.45 + 0.85 * n) * vCol.a;
				// (rgb: grey shade, warmth from the fire below, how lit by the sky)
				vec3 col = vec3(vCol.r) * uLight * (0.75 + 0.35 * (1.0 - p.y));
				col = mix(col, uFire * (0.6 + vCol.g), vCol.g * (1.0 - r) * 0.85);
				gl_FragColor = vec4(col, a);
			}` : /* glsl */`
			varying vec4 vCol; varying float vSeed;
			void main() {
				vec2 p = gl_PointCoord * 2.0 - 1.0;
				float r = dot(p, p);
				if (r > 1.0) discard;
				float a = (1.0 - r) * (1.0 - r);
				gl_FragColor = vec4(vCol.rgb * a * vCol.a, 1.0);
			}`,
	});
}
function pointsPool(n, kind) {
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 4), seed = new Float32Array(n);
	for (let i = 0; i < n; i++) seed[i] = Math.random();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
	g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
	const mat = pointsMaterial(kind);
	const pts = new THREE.Points(g, mat);
	pts.frustumCulled = false;
	pts.renderOrder = kind === 'smoke' ? 3 : 4;
	// per particle: x y z vx vy vz age life s0 s1 r g b a0 drag rise
	const S = 16, P = new Float32Array(n * S);
	let next = 0, live = 0, dirty = false;
	function emit(x, y, z, vx, vy, vz, life, s0, s1, r, gg, b, a0, drag = 0.6, rise = 0) {
		const i = next; next = (next + 1) % n;
		const o = i * S;
		P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = vx; P[o + 4] = vy; P[o + 5] = vz; P[o + 6] = 0; P[o + 7] = life;
		P[o + 8] = s0; P[o + 9] = s1; P[o + 10] = r; P[o + 11] = gg; P[o + 12] = b; P[o + 13] = a0; P[o + 14] = drag; P[o + 15] = rise;
		dirty = true;
	}
	// wind (wx, wz m/s) carries everything; rise: buoyancy (+) or fall (-), m/s^2
	let was = 0;
	function step(dt, wx, wz, flicker = false) {
		// (nothing alive now or last frame: nothing to move or upload)
		if (!live && !was && !dirty) return;
		was = live; dirty = false;
		live = 0;
		for (let i = 0; i < n; i++) {
			const o = i * S;
			if (P[o + 7] <= 0 || P[o + 6] >= P[o + 7]) { if (col[i * 4 + 3] !== 0) { col[i * 4 + 3] = 0; size[i] = 0; } continue; }
			live++;
			P[o + 6] += dt;
			const t = P[o + 6] / P[o + 7], k = Math.exp(-dt * P[o + 14]);
			P[o + 3] = (P[o + 3] - wx) * k + wx; P[o + 5] = (P[o + 5] - wz) * k + wz; P[o + 4] = P[o + 4] * k + P[o + 15] * dt;
			P[o] += P[o + 3] * dt; P[o + 1] += P[o + 4] * dt; P[o + 2] += P[o + 5] * dt;
			pos[i * 3] = P[o]; pos[i * 3 + 1] = P[o + 1]; pos[i * 3 + 2] = P[o + 2];
			size[i] = P[o + 8] + (P[o + 9] - P[o + 8]) * Math.sqrt(t);
			const fadeIn = Math.min(1, t * 7), a = P[o + 13] * fadeIn * (1 - t) * (flicker ? 0.6 + 0.4 * Math.sin(P[o + 6] * 23 + i) : 1);
			col[i * 4] = P[o + 10]; col[i * 4 + 1] = P[o + 11] * (kind === 'smoke' ? Math.max(0, 1 - t * 2.2) : 1); col[i * 4 + 2] = P[o + 12]; col[i * 4 + 3] = a;
		}
		g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aCol.needsUpdate = true;
	}
	function clear() { P.fill(0); col.fill(0); size.fill(0); g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true; }
	return { pts, mat, emit, step, clear, n, live: () => live };
}

// ---------- marks on the ground: scorch and cracks ----------
function markMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: { uFar: { value: 700 } },
		transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
		vertexShader: /* glsl */`
			attribute vec2 aMark;
			uniform float uFar;
			varying vec2 vUv; varying vec2 vMark; varying float vFade;
			void main() {
				vUv = uv; vMark = aMark;
				vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
				vFade = 1.0 - smoothstep(uFar * 0.6, uFar, length(cameraPosition - wp.xyz));
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */`
			varying vec2 vUv; varying vec2 vMark; varying float vFade;
			${NOISE}
			void main() {
				vec2 p = vUv * 2.0 - 1.0;
				float a; vec3 col;
				if (vMark.x < 0.5) {
					// scorched ground: blackened at the heart, brown ash and singed grass at the edge
					float n = cf(vUv * 3.0 + vMark.y * 31.0);
					float r = length(p) + (n - 0.5) * 0.55;
					a = smoothstep(1.0, 0.55, r);
					col = mix(vec3(0.16, 0.12, 0.08), vec3(0.03, 0.028, 0.025), smoothstep(0.85, 0.3, r));
					col += vec3(0.08) * step(0.82, cn(vUv * 24.0 + vMark.y * 7.0)) * smoothstep(0.7, 0.2, r);
					a *= 0.92;
				} else {
					// a crack in the ground: a jagged dark line along u, splitting at its ends
					float n = cn(vec2(vUv.x * 9.0 + vMark.y * 13.0, 0.5)) - 0.5;
					float n2 = cn(vec2(vUv.x * 31.0 + vMark.y * 5.0, 1.5)) - 0.5;
					float y = p.y - n * 0.55 - n2 * 0.12;
					float w = 0.07 + 0.11 * (1.0 - abs(p.x)) ;
					a = smoothstep(w, w * 0.35, abs(y)) * smoothstep(1.0, 0.82, abs(p.x));
					float lip = smoothstep(w * 2.6, w, abs(y)) * smoothstep(1.0, 0.8, abs(p.x)) * 0.35;
					col = mix(vec3(0.35, 0.33, 0.3), vec3(0.02, 0.018, 0.016), a / max(0.001, a + lip));
					a = max(a, lip);
				}
				if (a < 0.02) discard;
				gl_FragColor = vec4(col, a * vFade);
			}`,
	});
}

export function createFx(scene, { isPhone = false, ground = () => 0 } = {}) {
	const group = new THREE.Group();
	group.name = 'cataclysm-fx';
	group.visible = false;
	scene.add(group);
	const uTime = { value: 0 };
	// flames
	const FN = isPhone ? 56 : 180;
	const fGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
	const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(FN), 1), aHeat = new THREE.InstancedBufferAttribute(new Float32Array(FN), 1);
	for (let i = 0; i < FN; i++) aSeed.array[i] = Math.random();
	fGeo.setAttribute('aSeed', aSeed); fGeo.setAttribute('aHeat', aHeat);
	const flames = new THREE.InstancedMesh(fGeo, flameMaterial(uTime), FN);
	flames.frustumCulled = false; flames.count = 0; flames.renderOrder = 5;
	group.add(flames);
	let fn = 0;
	// smoke, sparks
	const smoke = pointsPool(isPhone ? 140 : 520, 'smoke'), sparks = pointsPool(isPhone ? 120 : 420, 'sparks');
	group.add(smoke.pts, sparks.pts);
	// marks
	const MN = isPhone ? 90 : 320;
	const mGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const aMark = new THREE.InstancedBufferAttribute(new Float32Array(MN * 2), 2);
	mGeo.setAttribute('aMark', aMark);
	const marks = new THREE.InstancedMesh(mGeo, markMaterial(), MN);
	marks.frustumCulled = false; marks.count = MN; marks.renderOrder = 1;
	for (let i = 0; i < MN; i++) marks.setMatrixAt(i, HIDE);
	group.add(marks);
	let mn = 0, marksUsed = 0;
	const markKeys = new Map();     // key -> slot (so a mark is laid once)

	// ---------- drawing, each frame ----------
	// a flame this frame at (x, y, z), its height h and width w, heat 0..1
	function flame(x, y, z, h, w, heat) {
		if (fn >= FN) return false;
		_m.makeScale(w, h, w); _m.setPosition(x, y, z);
		flames.setMatrixAt(fn, _m);
		aHeat.array[fn] = heat;
		fn++;
		return true;
	}
	// a mark on the ground (kind 0 scorch, 1 crack), its size, its turn; laid once per key
	function mark(key, kind, x, z, w, d, yaw = 0) {
		if (markKeys.has(key)) return markKeys.get(key);
		const i = mn; mn = (mn + 1) % MN;
		for (const [k, v] of markKeys) if (v === i) { markKeys.delete(k); break; }
		// (sat on the ground, tilted with it)
		const y = ground(x, z), e = Math.max(1, Math.min(w, d) * 0.5);
		const dx = ground(x + e, z) - ground(x - e, z), dz = ground(x, z + e) - ground(x, z - e);
		_n.set(-dx / (2 * e), 1, -dz / (2 * e)).normalize();
		_q.setFromUnitVectors(_up, _n).multiply(_q2.setFromAxisAngle(_up, yaw));
		_m.compose(_p.set(x, y + 0.06, z), _q, _s.set(w, 1, d));
		marks.setMatrixAt(i, _m);
		marks.instanceMatrix.needsUpdate = true;
		aMark.array[i * 2] = kind; aMark.array[i * 2 + 1] = Math.random();
		aMark.needsUpdate = true;
		markKeys.set(key, i);
		marksUsed = Math.min(MN, marksUsed + 1);
		return i;
	}
	function clearMarks() { for (let i = 0; i < MN; i++) marks.setMatrixAt(i, HIDE); marks.instanceMatrix.needsUpdate = true; markKeys.clear(); marksUsed = 0; mn = 0; }
	// the frame begins: the flames are laid again by whoever draws them
	function begin() { fn = 0; }
	// the frame ends: everything moves on. light: { color (the sky's light), day 0..1 }, wind m/s
	function end(dt, camera, renderer, light, wind) {
		uTime.value += dt;
		flames.count = fn;
		flames.instanceMatrix.needsUpdate = true; aHeat.needsUpdate = true;
		smoke.step(dt, wind.x * 0.9, wind.z * 0.9);
		sparks.step(dt, wind.x, wind.z, true);
		// points sized in pixels: the drawing buffer's height against the camera's view
		const h = renderer ? renderer.getDrawingBufferSize(_v2).y : innerHeight;
		const scale = h * 0.5 / Math.tan((camera.fov || 60) * Math.PI / 360);
		smoke.mat.uniforms.uScale.value = scale; sparks.mat.uniforms.uScale.value = scale;
		smoke.mat.uniforms.uLight.value.copy(light.color).multiplyScalar(0.25 + 0.75 * light.day);
		group.visible = fn > 0 || smoke.live() > 0 || sparks.live() > 0 || marksUsed > 0;
	}
	function clear() { fn = 0; flames.count = 0; smoke.clear(); sparks.clear(); clearMarks(); group.visible = false; }
	function dispose() { clear(); scene.remove(group); fGeo.dispose(); flames.material.dispose(); smoke.pts.geometry.dispose(); smoke.mat.dispose(); sparks.pts.geometry.dispose(); sparks.mat.dispose(); mGeo.dispose(); marks.material.dispose(); }
	return {
		group, flame, mark, clearMarks, begin, end, clear, dispose,
		// smoke: (x, y, z), its rise, life, sizes, grey shade, warmth (lit by fire underneath), alpha
		smoke: (x, y, z, vy, life, s0, s1, shade, warm, a) => smoke.emit(x, y, z, (Math.random() - 0.5) * 1.2, vy, (Math.random() - 0.5) * 1.2, life, s0, s1, shade, warm, 0, a, 0.35, 0.15),
		// an ember: thrown up hot, flickering, carried on the wind
		ember: (x, y, z, k = 1) => sparks.emit(x, y, z, (Math.random() - 0.5) * 3, 3 + Math.random() * 5 * k, (Math.random() - 0.5) * 3, 2.5 + Math.random() * 3, 0.12, 0.05, 1, 0.45 + Math.random() * 0.3, 0.1, 1.4, 0.8, 0.6),
		// a hazard light's blink (a car alarm going)
		blink: (x, y, z) => sparks.emit(x, y, z, 0, 0, 0, 0.3, 0.4, 0.4, 1, 0.55, 0.1, 1.3, 0, 0),
		// ash coming down
		ash: (x, y, z) => sparks.emit(x, y, z, (Math.random() - 0.5) * 0.6, -0.6 - Math.random() * 0.8, (Math.random() - 0.5) * 0.6, 6 + Math.random() * 5, 0.07, 0.07, 0.42, 0.4, 0.38, 0.5, 1.2, -0.05),
		// a hose's water from (x, y, z) towards (tx, ty, tz): droplets and mist
		spray(x, y, z, tx, ty, tz, n = 3) {
			const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.max(1, Math.hypot(dx, dy, dz)), sp = Math.min(22, 8 + d * 0.9);
			for (let k = 0; k < n; k++) {
				const j = 0.08;
				sparks.emit(x, y, z, dx / d * sp + (Math.random() - 0.5) * sp * j, dy / d * sp + 3 + Math.random() * 2, dz / d * sp + (Math.random() - 0.5) * sp * j, 1.1 + Math.random() * 0.5, 0.09, 0.05, 0.55, 0.72, 0.9, 0.5, 0.15, -9.8);
			}
			if (Math.random() < 0.5) smoke.emit(tx + (Math.random() - 0.5) * 2, ty + 0.5, tz + (Math.random() - 0.5) * 2, 0, 1.2, 0, 1.6, 1, 3.5, 0.95, 0, 0, 0.3, 0.6, 0.4);
		},
		counts: () => ({ flames: fn, smoke: smoke.live(), sparks: sparks.live(), marks: marksUsed }),
		caps: { flames: FN, smoke: smoke.n, sparks: sparks.n, marks: MN },
	};
}
