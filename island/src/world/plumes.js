// Columns of smoke and steam you can see from across the land: a burning building or wreck
// sends one up a hundred metres and more, it leans over with the wind and spreads as it
// rises, and it hangs on, thinning, long after the flames are out; far off, a refinery's
// stacks steam over the Bay, a town's chimneys smoke at its hearths, a camp's fire smokes
// on a far hill. They are the landmarks of distance: something rising out of the haze.
//
// All drawn by one instanced quad mesh, moved on the GPU: each puff climbs its column on a
// loop (its phase), so nothing is emitted or sorted on the CPU. A column is a slot:
// { x, y, z, h (height), r (radius at the base), spread (how much wider at the top), shade
// (0 black smoke .. 1 white steam), k (how thick, eased toward want), rise (m/s) }.
// The quads face the camera, are shaded toward the sun, and fogged with the rest of the
// air (world/airfog.js).

import * as THREE from 'three';

const MAX = 16, PUFFS = 44;

function puffTexture() {
	const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
	const x = c.getContext('2d');
	// a soft lumpy ball: overlapping blobs, densest in the middle
	let r = 9;
	const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
	for (let i = 0; i < 26; i++) {
		const a = rnd() * 6.283, d = rnd() * 14, px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d, rr = 9 + rnd() * 12;
		const g = x.createRadialGradient(px, py, 0, px, py, rr);
		g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
		x.fillStyle = g; x.fillRect(0, 0, S, S);
	}
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.NoColorSpace;
	return t;
}

export function createPlumes(scene, shared, { isPhone = false } = {}) {
	const geo = new THREE.InstancedBufferGeometry();
	const base = new THREE.PlaneGeometry(1, 1);
	geo.index = base.index;
	geo.setAttribute('position', base.attributes.position);
	geo.setAttribute('uv', base.attributes.uv);
	const n = MAX * PUFFS, aPuff = new Float32Array(n * 4);
	for (let c = 0; c < MAX; c++) for (let i = 0; i < PUFFS; i++) {
		const k = (c * PUFFS + i) * 4;
		aPuff[k] = c; aPuff[k + 1] = i / PUFFS + Math.random() * 0.5 / PUFFS; aPuff[k + 2] = Math.random(); aPuff[k + 3] = Math.random();
	}
	geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(aPuff, 4));
	geo.instanceCount = n;
	const colA = Array.from({ length: MAX }, () => new THREE.Vector4(0, -1e5, 0, 0));
	const colB = Array.from({ length: MAX }, () => new THREE.Vector4(1, 1, 0.5, 0));
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
		uTime: { value: 0 }, uWind: { value: new THREE.Vector3(1, 0, 0.4) },
		uSunV: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.55, 0.6) },
	}]);
	// (arrays of vectors are kept by reference: written in place each frame)
	uniforms.uColA = { value: colA };
	uniforms.uColB = { value: colB };
	uniforms.uTex = { value: puffTexture() };
	const mat = new THREE.ShaderMaterial({
		uniforms, fog: true, transparent: true, depthWrite: false,
		vertexShader: /* glsl */`
			#define MAX ${MAX}
			attribute vec4 aPuff;
			uniform vec4 uColA[MAX], uColB[MAX];
			uniform float uTime; uniform vec3 uWind;
			varying vec2 vUv; varying float vA, vShade, vRot; varying vec2 vQ;
			#include <fog_pars_vertex>
			void main(){
				int ci = int(aPuff.x + 0.5);
				vec4 A = uColA[ci], B = uColB[ci];
				// (A: x y z, height; B: base radius, spread, shade, thickness)
				float H = max(A.w, 1.0);
				float rise = 2.0 + H * 0.025;
				float t = fract(aPuff.y + uTime * rise / H * (0.8 + aPuff.z * 0.4));
				float u = pow(t, 0.85);
				vec3 c = A.xyz + vec3(0.0, H * u, 0.0);
				// leaning over with the wind, most up high where it is free of the ground
				c.xz += uWind.xz * uWind.y * H * 0.55 * pow(u, 1.6);
				float r = B.x * (1.0 + B.y * u);
				float a = aPuff.z * 6.283;
				c.xz += vec2(cos(a), sin(a)) * r * 0.35 * (0.4 + aPuff.w);
				c.y += (aPuff.w - 0.5) * r * 0.3;
				float size = r * (1.3 + aPuff.w * 0.7);
				vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
				float rot = aPuff.w * 6.283 + uTime * (aPuff.z - 0.5) * 0.15;
				vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;
				mvPosition.xy += q * size;
				gl_Position = projectionMatrix * mvPosition;
				vUv = uv; vQ = position.xy * 2.0; vRot = rot;
				// thin at the base (it starts as a narrow plume), whole a little up, fading out at the top
				vA = B.w * smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.45, 1.0, u)) * (0.65 + aPuff.z * 0.35);
				vShade = B.z;
				#include <fog_vertex>
			}`,
		fragmentShader: /* glsl */`
			uniform sampler2D uTex; uniform vec3 uSunV, uSunCol, uAmb;
			varying vec2 vUv; varying float vA, vShade, vRot; varying vec2 vQ;
			#include <common>
			#include <fog_pars_fragment>
			void main(){
				float d = texture2D(uTex, vUv).r;
				float a = vA * d * (1.0 - smoothstep(0.75, 1.0, length(vQ)));
				if (a < 0.004) discard;
				// lit from the sun's side: the puff's surface as if it were a ball
				vec3 n = normalize(vec3(vQ * 0.8, 0.6));
				float lit = clamp(dot(n, uSunV) * 0.5 + 0.5, 0.0, 1.0);
				vec3 body = mix(vec3(0.06, 0.055, 0.05), vec3(0.92, 0.93, 0.95), vShade);
				vec3 col = body * (uAmb + uSunCol * lit * (0.35 + 0.5 * vShade));
				gl_FragColor = vec4(col, min(1.0, a));
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
				#include <fog_fragment>
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.renderOrder = 1;
	mesh.name = 'plumes';
	scene.add(mesh);

	// the columns: id -> slot
	const slots = Array.from({ length: MAX }, () => ({ id: null, k: 0, want: 0, life: 0, fade: 0, x: 0, y: 0, z: 0, h: 0, r: 0, spread: 0, shade: 0 }));
	const byId = new Map();
	// a column stood up (or kept up) at id: life seconds at full, then fade seconds thinning out
	// (a fire refreshes its own each frame it burns; a blast's smoke is given its life once)
	function set(id, o) {
		let S = byId.get(id);
		if (!S) {
			S = slots.find((q) => !q.id) || slots.filter((q) => !q.ambient).sort((p, q) => p.want + p.k - q.want - q.k)[0];
			if (!S) return null;
			if (S.id) byId.delete(S.id);
			S.id = id; S.k = 0; byId.set(id, S);
		}
		Object.assign(S, { x: o.x, y: o.y, z: o.z, h: o.h ?? 120, r: o.r ?? 4, spread: o.spread ?? 5, shade: o.shade ?? 0.2, want: o.k ?? 1, life: o.life ?? 1, fade: o.fade ?? 60, ambient: !!o.ambient });
		return S;
	}
	function drop(id) { const S = byId.get(id); if (S) S.life = 0; }
	function clear() { for (const S of slots) { S.id = null; S.k = 0; S.want = 0; colA[slots.indexOf(S)].set(0, -1e5, 0, 0); } byId.clear(); }

	const _v = new THREE.Vector3();
	function update(dt, camera, sky) {
		uniforms.uTime.value += dt;
		const wd = shared.uWindDir?.value, w = shared.uWind?.value ?? 0.5;
		if (wd) { const l = Math.hypot(wd.x, wd.y) || 1; uniforms.uWind.value.set(wd.x / l, 0.25 + w * 0.6, wd.y / l); }
		// the sun in the view's frame, its light and the sky's fill
		if (sky?.sun) {
			_v.copy(sky.sun.position).sub(sky.sun.target.position).normalize().transformDirection(camera.matrixWorldInverse);
			uniforms.uSunV.value.copy(_v);
			uniforms.uSunCol.value.copy(sky.sun.color).multiplyScalar(Math.min(1.4, sky.sun.intensity * 0.35));
			uniforms.uAmb.value.copy(sky.hemi.color).multiplyScalar(0.25 + sky.hemi.intensity * 0.45);
		}
		for (let i = 0; i < MAX; i++) {
			const S = slots[i];
			if (!S.id) continue;
			if (S.life > 0) S.life -= dt;
			// (past its life it thins away over its fade)
			const target = S.life > 0 ? S.want : 0;
			S.k += (target - S.k) * Math.min(1, dt * (target > S.k ? 0.5 : 1 / Math.max(1, S.fade) * 3));
			if (S.life <= 0 && S.k < 0.01) { byId.delete(S.id); S.id = null; colA[i].set(0, -1e5, 0, 0); colB[i].w = 0; continue; }
			// out of sight (too far for the fog to leave anything): not drawn
			const d = Math.hypot(S.x - camera.position.x, S.z - camera.position.z);
			const far = d > camera.far * 0.95;
			colA[i].set(S.x, far ? -1e5 : S.y, S.z, S.h);
			colB[i].set(S.r, S.spread, S.shade, S.k * (isPhone ? 0.85 : 1));
		}
	}
	function dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); uniforms.uTex.value.dispose(); }
	return { mesh, set, drop, clear, update, dispose, slots };
}

// the far columns a world keeps: real stacks on Earth, chimneys over a realm's town and a
// village's hearths, a camp's fire on a far hill elsewhere (none on a world with no air)
export function ambientPlumes(plumes, { island, profile, earth, realm }) {
	if (profile?.airless) return;
	let r = (island.seed ^ 0x5307e) >>> 0 || 1;
	const rnd = () => { r = (Math.imul(r, 16807) >>> 0) % 2147483647; return r / 2147483647; };
	const H = (x, z) => island.heightAt(x, z);
	if (earth) {
		// the Bay's refineries and the old power station: their stacks steam all day
		const kx = 111320 * Math.cos(37.76 * Math.PI / 180);
		const at = (lat, lon) => ({ x: (lon + 122.57) * kx, z: (37.76 - lat) * 110996 });
		const STACKS = [[37.9405, -122.3985, 220], [38.0185, -122.1115, 240], [38.0425, -122.2570, 180], [38.0655, -122.1380, 200], [38.0405, -121.8905, 160]];
		STACKS.forEach(([lat, lon, h], i) => { const p = at(lat, lon); plumes.set('stack:' + i, { x: p.x, y: 30, z: p.z, h, r: 14, spread: 4, shade: 0.95, k: 0.85, life: 1e9, ambient: true }); });
		return;
	}
	const hearth = (id, x, z, h = 70) => plumes.set(id, { x, y: Math.max(0, H(x, z)) + 6, z, h, r: 2.2, spread: 6, shade: 0.55, k: 0.55, life: 1e9, ambient: true });
	// a realm: its town's chimneys and the castle's kitchens
	if (realm?.town) {
		const T = realm.town, houses = realm.houses || [];
		for (let i = 0; i < 3; i++) {
			const h = houses.length ? houses[Math.floor(rnd() * houses.length)] : null;
			hearth('town:' + i, h?.x ?? T.x + (rnd() - 0.5) * T.r, h?.z ?? T.z + (rnd() - 0.5) * T.r, 50 + rnd() * 40);
		}
		if (realm.castle) hearth('castle', realm.castle.x + (rnd() - 0.5) * 20, realm.castle.z + (rnd() - 0.5) * 20, 90);
	}
	// the village's cooking fires
	const V = island.village;
	if (V && !profile?.noVillage) hearth('village', V.x + (rnd() - 0.5) * 30, V.z + (rnd() - 0.5) * 30, 55);
	// a camp's fire, or a far fire burning on its own, on high ground away from the middle
	const half = island.half || 1200, fires = profile?.type === 'MAGMA' || profile?.type === 'TOXIC' ? 3 : 2;
	for (let k = 0, made = 0; k < 60 && made < fires; k++) {
		const a = rnd() * 6.283, d = half * (0.45 + rnd() * 0.45), x = Math.cos(a) * d, z = Math.sin(a) * d;
		if (H(x, z) < 12) continue;
		const wild = profile?.type === 'MAGMA' || profile?.type === 'TOXIC' || rnd() < 0.35;
		plumes.set('far:' + made, { x, y: H(x, z) + 2, z, h: wild ? 260 + rnd() * 160 : 90 + rnd() * 50, r: wild ? 9 : 3, spread: wild ? 4 : 6, shade: wild ? 0.12 : 0.5, k: wild ? 0.9 : 0.6, life: 1e9, ambient: true });
		made++;
	}
}
