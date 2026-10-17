// A beam, as a blast. It gathers first (CHARGE: light drawn spiralling into the hands, a ball
// of it swelling there, a rising whine), then lets go all at once: a punch of light out from the
// hands, its head racing to the end (FIRE), and a column that roars while it is held. The column is
// a white-hot core in a sheath of the school's colour, swelling and pinching as pressure surges
// down it, with rings of shock thrown off at the hands, motes streaming along it, and the end
// spraying sparks back the way it came. Let go, it thins to a thread and is gone (FADE).
//
// One column, two shells (the core, the sheath) on one open cylinder, drawn additive like the
// motes (magic/fx.js); a few are made at the start and reused, for your own beam and friends'
// (keyed by who casts it), so nothing is made while you cast and no lights are added.

import * as THREE from 'three';

export const CHARGE = 0.32;          // s of gathering before a beam lets go
export const MIN_BLAST = 0.3;        // s a beam pours at the least, once it has let go
const FIRE = 0.12, FADE = 0.2;

// the column's shape at an age (s since it let go; < 0 gathering) and when dying (s since let go
// of, or -1): { out: how far its head has reached (0..1), r: its width (×), a: its light (×) }
export function beamShape(age, dying = -1) {
	if (age < 0) return { out: 0, r: 0, a: 0 };
	const out = Math.min(1, age / FIRE);
	// (the punch as it lets go: wider for a moment, then settling)
	let r = 1 + 0.6 * Math.exp(-age * 10), a = 1 + 0.5 * Math.exp(-age * 8);
	if (dying >= 0) { const k = Math.max(0, 1 - dying / FADE); r *= k * k; a *= k; }
	return { out, r, a };
}

const VS = `
uniform float uTime, uLen, uR, uOut, uFlare;
varying float vU, vA; varying vec3 vN, vW;
void main(){
	float u = position.y, m = u * uLen * uOut;
	vU = u; vA = atan(position.z, position.x);
	float swell = 1.0 + 0.16 * sin(m * 1.3 - uTime * 38.0) + 0.07 * sin(m * 3.1 - uTime * 61.0);
	float flare = 1.0 + uFlare * exp(-m * 2.2);
	// (widening as it goes, as a blast does, so it stays great far off)
	float r = uR * swell * flare * min(2.6, 1.0 + 0.04 * m);
	vec4 w = modelMatrix * vec4(position.x * r, m, position.z * r, 1.0);
	vW = w.xyz; vN = normalize(mat3(modelMatrix) * vec3(position.x, 0.0, position.z));
	gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = `
uniform vec3 uColor; uniform float uTime, uLen, uOut, uAlpha, uCore, uNear;
varying float vU, vA; varying vec3 vN, vW;
void main(){
	vec3 V = normalize(cameraPosition - vW);
	float f = abs(dot(normalize(vN), V));
	float body = pow(f, uCore);
	float m = vU * uLen * uOut;
	float streak = 0.72 + 0.28 * sin(m * 0.9 - uTime * 55.0 + 5.0 * vA) * sin(m * 0.37 - uTime * 23.0 - 3.0 * vA);
	float near = smoothstep(uNear * 0.3, uNear, distance(cameraPosition, vW));
	float tip = 1.0 - smoothstep(0.93, 1.0, vU);
	vec3 col = mix(uColor, vec3(1.0), smoothstep(0.5, 0.95, body));
	float a = uAlpha * body * streak * near * tip;
	gl_FragColor = vec4(col * a, 1.0);
}`;

// a soft round glow for the balls of light at either end
function glowTexture() {
	const cv = document.createElement('canvas');
	cv.width = cv.height = 64;
	const g = cv.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.75)'); r.addColorStop(0.6, 'rgba(255,255,255,0.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = r; g.fillRect(0, 0, 64, 64);
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Color();
const WHITE = [1, 1, 1];

export function createBeams(scene, fx, { isPhone = false } = {}) {
	const geo = new THREE.CylinderGeometry(1, 1, 1, isPhone ? 10 : 16, isPhone ? 24 : 48, true);
	geo.translate(0, 0.5, 0);
	const tex = glowTexture();
	const shell = (core) => new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uLen: { value: 1 }, uR: { value: 0.3 }, uOut: { value: 0 }, uFlare: { value: 0.8 }, uAlpha: { value: 1 }, uCore: { value: core ? 0.5 : 1.6 }, uNear: { value: 2 } },
		vertexShader: VS, fragmentShader: FS,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	const glow = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.renderOrder = 4; return s; };
	const pool = [];
	for (let i = 0; i < 3; i++) {
		const grp = new THREE.Group();
		grp.name = 'magic-beam'; grp.visible = false;
		const sheath = new THREE.Mesh(geo, shell(false)), core = new THREE.Mesh(geo, shell(true));
		for (const m of [sheath, core]) { m.frustumCulled = false; m.renderOrder = 4; grp.add(m); }
		const muzzle = glow(), impact = glow();
		scene.add(grp, muzzle, impact);
		muzzle.visible = impact.visible = false;
		pool.push({ grp, sheath, core, muzzle, impact, key: null, from: new THREE.Vector3(), to: new THREE.Vector3(), c: WHITE, near: false, charge: 0, age: -1, left: 0, dying: -1, ringT: 0, dustT: 0, time: 0 });
	}
	// a beam seen this frame: key (who casts it), from the hands to where it ends, the school's
	// colour; charging (still gathering), near (your own, a breath from your eyes), ttl (s it is
	// seen for without being shown again: a friend's, told of a few times a second)
	function show(key, from, to, c, { charging = false, near = false, ttl = 0.06 } = {}) {
		let B = pool.find((q) => q.key === key) || pool.find((q) => q.key === null);
		if (!B) { B = pool.filter((q) => q.key !== 'me').sort((p, q) => p.left - q.left)[0]; if (!B) return; reset(B); }
		if (B.key === null || B.dying >= 0) { reset(B); B.key = key; B.charge = 0; B.age = charging ? -CHARGE : 0; }
		B.from.copy(from); B.to.copy(to); B.c = c; B.near = near; B.left = ttl;
		// (gathering told of after it has let go is a friend's late word: ignored)
		if (!charging && B.age < 0) B.age = 0;
	}
	function reset(B) { B.key = null; B.dying = -1; B.age = -1; B.charge = 0; B.grp.visible = B.muzzle.visible = B.impact.visible = false; }
	const R = (s) => (Math.random() - 0.5) * s;
	// light thrown out around the beam, across it: n points on a ring of radius r about the axis
	function ringAcross(at, d, r, n, v, along, c, life, s) {
		_a.set(-d.z, 0, d.x); if (_a.lengthSq() < 1e-4) _a.set(1, 0, 0); _a.normalize();
		_b.crossVectors(d, _a).normalize();
		const o = Math.random() * 6.283;
		for (let k = 0; k < n; k++) {
			const q = o + k / n * 6.283, cx = Math.cos(q), sy = Math.sin(q);
			const ux = _a.x * cx + _b.x * sy, uy = _a.y * cx + _b.y * sy, uz = _a.z * cx + _b.z * sy;
			fx.emit(at.x + ux * r, at.y + uy * r, at.z + uz * r, ux * v + d.x * along, uy * v + d.y * along, uz * v + d.z * along, life, s, s * 0.3, c, 1, 0, 2);
		}
	}
	function update(dt) {
		const lite = isPhone ? 0.4 : 1;
		for (const B of pool) {
			if (B.key === null) continue;
			B.left -= dt; B.time += dt;
			if (B.left < 0 && B.dying < 0) B.dying = 0;
			if (B.dying >= 0) { B.dying += dt; if (B.dying >= FADE) { reset(B); continue; } }
			_d.subVectors(B.to, B.from);
			const len = Math.max(0.1, _d.length());
			_d.divideScalar(len);
			const c = B.c, hot = [c[0] * 0.5 + 0.5, c[1] * 0.5 + 0.5, c[2] * 0.5 + 0.5];
			const was = B.age;
			B.age += B.dying >= 0 ? 0 : dt;
			const sc = B.near ? 0.7 : 1;
			// ---- gathering: light drawn in, spiralling, a ball swelling in the hands ----
			if (B.age < 0) {
				const k = 1 + B.age / CHARGE;
				B.grp.visible = B.impact.visible = false;
				B.muzzle.visible = true;
				B.muzzle.position.copy(B.from);
				B.muzzle.scale.setScalar((B.near ? 0.5 : 1) * (0.12 + 0.4 * k * k) * (0.9 + Math.random() * 0.2));
				B.muzzle.material.color.setRGB(hot[0], hot[1], hot[2]);
				const n = Math.ceil(5 * lite);
				for (let i = 0; i < n; i++) {
					_a.set(R(2), R(2), R(2)).normalize();
					const r = sc * (0.5 + Math.random() * 0.7), life = 0.16;
					_b.crossVectors(_a, UP).normalize().multiplyScalar(r * 4);
					fx.emit(B.from.x + _a.x * r, B.from.y + _a.y * r, B.from.z + _a.z * r, -_a.x * r / life + _b.x, -_a.y * r / life + _b.y, -_a.z * r / life + _b.z, life, 0.05, 0.14, c, 1, 0, 0);
				}
				continue;
			}
			// ---- let go: the punch ----
			if (was < 0 || (was === 0 && B.time <= dt + 1e-6)) {
				ringAcross(B.from, _d, 0.15 * sc, Math.ceil(28 * lite), 7, 3, hot, 0.35, 0.28 * sc);
				fx.burst(B.from, c, Math.ceil(18 * lite), 4, 0.35, 0.22 * sc, 0);
			}
			const S = beamShape(B.age, B.dying);
			B.grp.visible = true;
			B.grp.position.copy(B.from);
			B.grp.quaternion.setFromUnitVectors(UP, _d);
			const flick = 0.92 + Math.random() * 0.16;
			for (const [m, r, al, col] of [[B.sheath, B.near ? 0.3 : 0.4, 0.7, c], [B.core, B.near ? 0.09 : 0.13, 1.5, hot]]) {
				const U = m.material.uniforms;
				U.uTime.value = B.time; U.uLen.value = len; U.uOut.value = S.out;
				U.uR.value = r * S.r; U.uFlare.value = B.near ? 0.25 : 0.9;
				U.uAlpha.value = al * S.a * flick; U.uNear.value = B.near ? 1.6 : 0.5;
				U.uColor.value.setRGB(col[0], col[1], col[2]);
			}
			// (the balls of light: in the hands, and where it strikes)
			B.muzzle.visible = true;
			B.muzzle.position.copy(B.from);
			B.muzzle.scale.setScalar((B.near ? 0.22 : 0.6) * S.r * flick);
			_b.copy(B.from).addScaledVector(_d, len * S.out);
			B.impact.visible = S.out >= 1;
			B.impact.position.copy(_b).addScaledVector(_d, -0.3);
			B.impact.scale.setScalar((1.6 + 0.4 * Math.sin(B.time * 50)) * S.r * (0.85 + Math.random() * 0.3));
			_c.setRGB(hot[0], hot[1], hot[2]);
			B.muzzle.material.color.copy(_c); B.impact.material.color.setRGB(c[0], c[1], c[2]);
			if (B.dying >= 0) continue;
			// (rings of shock thrown off at the hands, running down the beam)
			B.ringT -= dt;
			if (B.ringT <= 0) { B.ringT = 0.06; _a.copy(B.from).addScaledVector(_d, 0.5 * sc); ringAcross(_a, _d, 0.25 * sc, Math.ceil(12 * lite), 3.5, 32, c, 0.22, 0.16 * sc); }
			// (motes streaming along it)
			for (let i = 0, n = Math.ceil(5 * lite); i < n; i++) {
				const u = Math.random() * S.out;
				fx.emit(B.from.x + _d.x * len * u + R(0.5), B.from.y + _d.y * len * u + R(0.5), B.from.z + _d.z * len * u + R(0.5), _d.x * 45, _d.y * 45, _d.z * 45, 0.12, 0.22, 0.05, hot, 1, 0, 0);
			}
			if (S.out < 1) continue;
			// (where it strikes: sparks sprayed back the way it came, dust thrown about)
			for (let i = 0, n = Math.ceil(5 * lite); i < n; i++) {
				fx.emit(_b.x, _b.y, _b.z, -_d.x * 6 + R(8), -_d.y * 6 + R(8) + 2, -_d.z * 6 + R(8), 0.45, 0.14, 0.02, Math.random() < 0.5 ? c : hot, 1, 9, 1);
			}
			B.dustT -= dt;
			if (B.dustT <= 0) { B.dustT = 0.18; fx.ring(_b, 2.4, c, Math.ceil(14 * lite), 0.3, 0.3); }
		}
	}
	// whether a beam is seen now (key: whose)
	const live = (key) => pool.some((q) => q.key === key && q.dying < 0);
	function clear() { for (const B of pool) reset(B); }
	function dispose() { for (const B of pool) { scene.remove(B.grp, B.muzzle, B.impact); B.sheath.material.dispose(); B.core.material.dispose(); B.muzzle.material.dispose(); B.impact.material.dispose(); } geo.dispose(); tex.dispose(); }
	return { show, update, live, clear, dispose };
}
