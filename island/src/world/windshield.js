// The rain on the glass when you drive in it. From the driver's seat the glass is the nearest
// thing there is: drops land on the windshield and sit as splats, swell, run down and are
// gone, and the wipers sweep them off; on the side windows the drops are drawn back along
// the glass by the wind of your speed into streaks; the glass mists (Josh's photo through a
// wet windshield on a rainy freeway at dawn: the tree line and the tail lights blurred
// behind a wet sheet of glass). One quad over the whole view, drawn last, only while you sit
// in a car in the rain. Its fragment casts the eye's ray out in the car's frame and finds
// which glass it leaves through, so the drops are stuck to the glass and stay put when you
// turn your head: the windshield (with its wipers) ahead, a side window when you look out
// of it, nothing where the ray meets the dash, a pillar or the roof. A few hashes a pixel,
// nothing read back from the scene; the drops take the haze's colour, which is what the sky
// and the far road are through them.

import * as THREE from 'three';
import { glassOf, seatsOf } from '../bay/cars.js';

const VS = /* glsl */`
	varying vec2 vUv;
	void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.5, 1.0); }`;
const FS = /* glsl */`
	uniform float uRain, uTime, uSpeed, uDim; uniform vec3 uTint;
	uniform vec2 uProj; uniform mat3 uRel; uniform vec3 uEye;
	uniform vec2 uFoot, uHead, uHw; uniform vec4 uSide, uSideZ, uWipe;
	varying vec2 vUv;
	const float TAU = 6.2831853;
	float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	// a wiper: its pivot pv on the glass (metres across, up), sweeping from angle a0 to a1
	// (0 pointing right across the glass, up through half pi), reaching L. For a point g: how
	// long ago (s) the blade last passed it (a long time if never, or out of its reach), and
	// the blade's own dark mark where it is now
	float wiper(vec2 g, vec2 pv, float a0, float a1, float L, inout float blade){
		vec2 d = g - pv; float rad = length(d), ang = atan(d.y, -d.x);
		float p = (ang - a0) / (a1 - a0);
		float a = 0.5 - 0.5 * cos(TAU * uWipe.x);
		if (rad > L || rad < 0.03 || p < -0.08 || p > 1.08) return 1e4;
		// the blade: a dark line along the arm where it is now
		float da = (p - a) * (a1 - a0) * rad;
		blade = max(blade, (1.0 - smoothstep(0.005, 0.013, abs(da))) * smoothstep(0.03, 0.08, rad));
		if (p <= 0.0 || p >= 1.0) return 1e4;
		float u1 = acos(1.0 - 2.0 * p) / TAU, u2 = 1.0 - u1, fu = fract(uWipe.x);
		float s = fu >= u2 ? fu - u2 : fu >= u1 ? fu - u1 : fu + 1.0 - u2;
		// (only once it has been past at all)
		return uWipe.x - s > 0.0 ? s * uWipe.y + uWipe.z : 1e4;
	}
	// the drops on the windshield: cells s metres across, one drop each, born at its own
	// moment of every life seconds; a splat with a ragged rim and a satellite or two, sitting,
	// then (the big ones) running down the glass; blown up the glass a little at speed. since:
	// how long ago the wipers passed this cell (a drop born before that is gone). Returns the
	// drop's cover (x), its bright side (y), its runnel (z)
	vec3 splats(vec2 g, float s, float seed, float life, float since){
		vec2 c = floor(g / s), f = g / s - c;
		float h0 = h21(c + seed), h1 = h21(c + seed + 7.3), h2 = h21(c + seed + 3.1), h3 = h21(c + seed + 11.7);
		if (h3 > uRain * 0.3 + 0.02) return vec3(0.0);
		float t = fract(uTime / life + h2);
		if (t * life > since) return vec3(0.0);
		float born = smoothstep(0.0, 0.06, t), gone = 1.0 - smoothstep(0.85, 1.0, t);
		float run = smoothstep(0.55, 1.0, t) * (0.3 + 0.7 * h1) * step(0.45, h1);
		float r = 0.05 + 0.09 * h1 * h1;
		vec2 o = vec2(0.25 + 0.5 * h0, 0.72 - 0.5 * run);
		vec2 q = f - o;
		// the drop: round sitting, drawn out when it runs, pushed up the glass by the wind
		q.y /= 1.0 + run * 0.9 + uSpeed * 0.7;
		q.x *= 1.0 + run * 0.3;
		float d = length(q), ang = atan(q.y, q.x);
		// a splat's rim is ragged
		float rr = r * (1.0 + (0.1 * sin(ang * 3.0 + h0 * TAU) + 0.06 * sin(ang * 7.0 + h2 * TAU)) * (1.0 - run));
		float body = (1.0 - smoothstep(rr * 0.8, rr, d)) * born * gone;
		// its rim (the glass bends the light at the edge) and a bright side
		float rim = smoothstep(rr * 0.45, rr * 0.8, d) * body;
		float bright = (1.0 - smoothstep(0.0, r * 0.55, length(q - vec2(-0.3, 0.35) * r))) * body;
		// a satellite droplet or two flung out when it hit
		vec2 sat = o + vec2(cos(h2 * TAU), sin(h2 * TAU)) * r * 1.7;
		float satK = (1.0 - smoothstep(r * 0.22, r * 0.34, length(f - sat))) * born * gone * step(0.35, h3 * 3.0);
		sat = o + vec2(cos(h1 * TAU + 2.0), sin(h1 * TAU + 2.0)) * r * 1.4;
		satK = max(satK, (1.0 - smoothstep(r * 0.16, r * 0.26, length(f - sat))) * born * gone * step(0.5, h0));
		// its runnel: a thin wet line it has left above it as it ran
		float trail = (1.0 - smoothstep(0.0, r * 0.3, abs(f.x - o.x))) * step(o.y, f.y) * (1.0 - smoothstep(o.y, o.y + 0.45 + 0.3 * run, f.y)) * run * born * gone;
		return vec3(body + rim * 1.5 + satK * 1.2, bright, trail);
	}
	// the drops on a side window (g: along the car, up): each one drawn back along the glass
	// by the wind into a streak as long as the speed, sitting round and running down slowly
	// when the car stands
	vec3 sideDrops(vec2 g, float s, float seed, float life){
		vec2 c = floor(g / s), f = g / s - c;
		float h0 = h21(c + seed), h1 = h21(c + seed + 7.3), h2 = h21(c + seed + 3.1), h3 = h21(c + seed + 11.7);
		if (h3 > uRain * 0.3 + 0.02) return vec3(0.0);
		float t = fract(uTime / life + h2);
		float born = smoothstep(0.0, 0.08, t), gone = 1.0 - smoothstep(0.85, 1.0, t);
		float run = smoothstep(0.55, 1.0, t) * (0.3 + 0.7 * h1) * (1.0 - uSpeed);
		float r = 0.06 + 0.1 * h1 * h1;
		// the head of the drop, its tail drawn back (to -z, behind the car) at speed
		float L = uSpeed * (1.2 + 2.0 * h1);
		vec2 o = vec2(0.3 + 0.45 * h0, 0.72 - 0.5 * run);
		vec2 q = f - o;
		float along = clamp(-q.x / max(L, 1e-3), 0.0, 1.0) * step(0.001, L);
		vec2 near = vec2(-along * L, 0.0);
		float rr = r * (1.0 - 0.6 * along);
		float d = length(q - near);
		float body = (1.0 - smoothstep(rr * 0.75, rr, d)) * born * gone;
		float rim = smoothstep(rr * 0.4, rr * 0.75, d) * body;
		float bright = (1.0 - smoothstep(0.0, r * 0.5, length(q - vec2(0.3, 0.3) * r))) * body * (1.0 - along);
		float trail = (1.0 - smoothstep(0.0, r * 0.3, abs(f.x - o.x))) * step(o.y, f.y) * (1.0 - smoothstep(o.y, o.y + 0.5, f.y)) * run * born * gone;
		return vec3(body + rim * 1.4, bright, trail);
	}
	void main(){
		// the eye's ray out through this pixel, in the car's frame (forward is +z, left +x)
		vec3 r = uRel * normalize(vec3((vUv.x * 2.0 - 1.0) * uProj.x, (vUv.y * 2.0 - 1.0) * uProj.y, -1.0));
		// which glass it leaves through: the windshield (a plane from its foot up to its header,
		// narrowing toward the top), else a side window (a plane out beside the eye, from the
		// belt to the roof, from the A pillar back), else none: the dash, a pillar, the roof
		vec3 P0 = vec3(0.0, uFoot.x, uFoot.y), dv = vec3(0.0, uHead.x, uHead.y) - P0;
		float Lg = length(dv); dv /= Lg;
		vec3 n = normalize(vec3(0.0, uFoot.y - uHead.y, uHead.x - uFoot.x));
		float rn = dot(r, n), which = 0.0, edge = 0.0;
		vec2 g = vec2(0.0);
		if (rn > 1e-4) {
			float t = dot(P0 - uEye, n) / rn;
			vec3 H = uEye + r * t;
			float gy = dot(H - P0, dv), hw = mix(uHw.x, uHw.y, clamp(gy / Lg, 0.0, 1.0));
			if (t > 0.0 && gy > 0.0 && gy < Lg && abs(H.x) < hw) { which = 1.0; g = vec2(H.x, gy); edge = min(min(gy, Lg - gy), hw - abs(H.x)); }
		}
		if (which < 0.5 && abs(r.x) > 1e-4) {
			float sx = sign(r.x), t = (sx * mix(uSide.z, uSide.w, 0.55) - uEye.x) / r.x;
			vec3 H = uEye + r * t;
			// the window's outline: the belt below; the roof line above, coming down the rear glass
			// behind the C pillar's start; the A pillar ahead (the windshield's rake, less its
			// width); the C pillar behind; and the B pillar's width between the doors
			float roofY = mix(uSide.y, uSide.x, clamp((uSideZ.y - H.z) / max(uSideZ.y - uSideZ.z, 0.1), 0.0, 1.0));
			float zA = uFoot.y + (uHead.y - uFoot.y) * clamp((H.y - uSide.x) / max(uHead.x - uSide.x, 0.1), 0.0, 1.0) - 0.06;
			float pillar = abs(H.z - uSideZ.w) - 0.06;
			if (t > 0.0 && H.y > uSide.x + 0.02 && H.y < roofY && H.z > uSideZ.x && H.z < zA && pillar > 0.0) { which = 2.0; g = vec2(H.z, H.y - uSide.x); edge = min(min(min(H.y - uSide.x - 0.02, roofY - H.y), min(H.z - uSideZ.x, zA - H.z)), pillar); }
		}
		if (which < 0.5) discard;
		float cover = 0.0, blade = 0.0; vec3 a = vec3(0.0);
		if (which < 1.5) {
			// the windshield: two wipers (pivots low on the glass, the driver's reaching further
			// and sweeping over to the left), the drops cleared behind them
			float hw0 = uHw.x;
			float s1 = wiper(g, vec2(hw0 * 0.3, -0.05), 0.12, 2.05, Lg * 0.72, blade);
			float s2 = wiper(g, vec2(-hw0 * 0.42, -0.05), 0.12, 1.7, Lg * 0.62, blade);
			float since = min(s1, s2);
			// (drops of 2-5 mm on the glass, and a finer scatter of 1-3 mm)
			a = splats(g, 0.036, 0.0, 9.0, since) + splats(g + vec2(0.013, 0.007), 0.021, 5.0, 6.0, since) * vec3(0.6, 0.6, 0.4);
			// at speed the rain streaks up the glass in fast fine lines, and the wet film the
			// blade leaves glints for a moment behind it
			float col = floor(g.x * 140.0 + 0.5), hc = h21(vec2(col, 2.0));
			float sy = fract(g.y * 1.2 - uTime * (2.0 + 2.0 * hc) + hc * 7.0);
			float streak = (1.0 - smoothstep(0.0, 0.45, abs(fract(g.x * 140.0 + 0.5) - 0.5) * 2.0)) * smoothstep(0.0, 0.25, sy) * (1.0 - smoothstep(0.25, 0.6, sy)) * step(0.6, h21(vec2(col, 9.0))) * uSpeed * uRain * step(2.0, since);
			float mist = (0.03 + 0.03 * h21(floor(g * 60.0))) * uRain * smoothstep(0.0, 8.0, since) * (0.6 + 0.4 * smoothstep(0.7, 1.0, g.y / Lg));
			float film = exp(-since * 14.0) * 0.12 * uRain;
			cover = a.x * 0.17 + a.y * 0.35 + a.z * 0.22 + streak * 0.3 + mist + film;
		} else {
			// a side window: the drops streaked back along the glass by the wind, and at speed
			// fine wet lines racing back
			a = sideDrops(g, 0.034, 1.0, 10.0) + sideDrops(g + vec2(0.011, 0.016), 0.02, 6.0, 7.0) * vec3(0.6, 0.6, 0.4);
			float row = floor(g.y * 110.0 + 0.5), hr = h21(vec2(row, 4.0));
			float sz = fract(g.x * (0.9 + 0.6 * hr) + uTime * (3.0 + 3.0 * hr) * uSpeed + hr * 7.0);
			float streak = (1.0 - smoothstep(0.0, 0.45, abs(fract(g.y * 110.0 + 0.5) - 0.5) * 2.0)) * smoothstep(0.0, 0.3, sz) * (1.0 - smoothstep(0.3, 0.75, sz)) * step(0.55, h21(vec2(row, 8.0))) * uSpeed * uRain;
			float mist = (0.04 + 0.03 * h21(floor(g * 60.0))) * uRain;
			cover = a.x * 0.17 + a.y * 0.35 + a.z * 0.22 + streak * 0.35 + mist;
		}
		cover = clamp(cover, 0.0, 0.6) * smoothstep(0.0, 0.03, edge);
		// (the body of a drop mostly lets the view through, its rim a shade darker, its bright side the sky)
		vec3 c = uTint * (0.7 + 0.6 * a.y / max(a.x * 0.17 + a.y * 0.35, 1e-3) * 0.35 * step(0.01, a.x));
		c *= 1.0 - 0.35 * smoothstep(1.0, 1.8, a.x);
		// the wiper blade: dark rubber and its arm over everything on the glass
		blade *= uWipe.w;
		c = mix(c, vec3(0.012, 0.012, 0.014), blade);
		gl_FragColor = vec4(c, max(cover, blade * 0.92) * uDim);
		#include <colorspace_fragment>
	}`;

export function createWindshield(scene, shared) {
	const U = {
		uRain: { value: 0 }, uTime: shared.uTime, uSpeed: { value: 0 }, uDim: { value: 0 }, uTint: { value: new THREE.Color(0.5, 0.53, 0.57) },
		uProj: { value: new THREE.Vector2(1, 0.7) }, uRel: { value: new THREE.Matrix3() }, uEye: { value: new THREE.Vector3(0.38, 1.4, 0.1) },
		uFoot: { value: new THREE.Vector2(1, 1) }, uHead: { value: new THREE.Vector2(1.6, 0.3) }, uHw: { value: new THREE.Vector2(0.85, 0.7) },
		uSide: { value: new THREE.Vector4(1, 1.55, 0.8, 0.7) }, uSideZ: { value: new THREE.Vector4(-1.3, -1.2, -2, 1e3) },
		// the wipers: their sweep clock (a stroke out and back each unit), its period (s), how
		// long they have stood parked (s), and whether they show
		uWipe: { value: new THREE.Vector4(0, 1.5, 1e4, 0) },
	};
	const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false });
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false; quad.renderOrder = 1001; quad.visible = false; quad.name = 'windshield';
	scene.add(quad);
	const last = new THREE.Vector3(), relQ = new THREE.Quaternion(), relM = new THREE.Matrix4();
	let placed = false, speed = 0, kind = null, wipeOn = false;
	function fit(k) {
		kind = k;
		const G = glassOf(k), eye = seatsOf(k).eye;
		U.uEye.value.set(eye[0], eye[1], eye[2]);
		U.uFoot.value.set(G.foot[0], G.foot[1]); U.uHead.value.set(G.head[0], G.head[1]); U.uHw.value.set(G.hwFoot, G.hwHead);
		U.uSide.value.set(G.belt, G.roof, G.sideOut[0], G.sideOut[1]); U.uSideZ.value.set(G.sideZ[0], G.sideZ[1], G.sideZ[2], G.sideZ[3]);
	}
	// seated: in the driver's seat of a car; rain: the rain where you are; fog: the haze's
	// colour (what the sky and the road are through the glass), as the fog has it; car: the
	// drive's state (carQ the body's turn, kind, speed m/s), so the glass is found in the
	// car's frame
	function update(dt, cam, { seated = false, rain = 0, fog = null, car = null } = {}) {
		if (placed) { const v = cam.position.distanceTo(last) / Math.max(dt, 1e-3); speed += (Math.min(1, v / 25) - speed) * Math.min(1, dt * 3); }
		last.copy(cam.position); placed = true;
		const want = seated ? Math.min(1, rain * 1.4) : 0;
		U.uDim.value += (want - U.uDim.value) * Math.min(1, dt * (seated ? 0.8 : 3));
		U.uRain.value = Math.min(1, rain * 1.2);
		U.uSpeed.value = seated ? (car && car.speed !== undefined ? Math.min(1, Math.abs(car.speed) / 25) : speed) : 0;
		if (fog) U.uTint.value.copy(fog);
		quad.visible = U.uDim.value > 0.01;
		if (!quad.visible) { U.uWipe.value.set(0, U.uWipe.value.y, 1e4, 0); return; }
		if (car && car.kind && car.kind !== kind) fit(car.kind);
		// the eye's frame in the car's
		if (car && car.carQ) relQ.copy(car.carQ).invert().multiply(cam.quaternion); else relQ.copy(cam.quaternion);
		U.uRel.value.setFromMatrix4(relM.makeRotationFromQuaternion(relQ));
		const th = Math.tan(cam.fov * Math.PI / 360);
		U.uProj.value.set(th * cam.aspect, th);
		// the wipers: on in rain, faster the harder it falls; a stroke under way is finished
		// before they park (the clock is left where it stopped, so what the blade cleared stays
		// cleared, and the parked time counts up from there)
		const W = U.uWipe.value, rainOn = Math.max(0, Math.min(1, (rain - 0.12) / 0.6));
		wipeOn = seated && rain > 0.12;
		W.y = 2.8 - 1.8 * rainOn;
		if (wipeOn) { W.x += dt / W.y; W.z = 0; }
		else if (W.x % 1 !== 0) W.x = Math.min(Math.ceil(W.x), W.x + dt / W.y);
		else W.z = Math.min(1e4, W.z + dt);
		W.w = 1;
	}
	function dispose() { scene.remove(quad); quad.geometry.dispose(); mat.dispose(); }
	return { update, dispose, quad, uniforms: U };
}
