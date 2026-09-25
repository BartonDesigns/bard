// Beneath the bay: the drowned crater of an old volcano. Black basalt boulders on
// its rim and walls, dark kelp columns swaying up toward the light, hot vents on the
// crater floor breathing streams of bubbles, and at the heart of the cone, fissures
// still glowing with lava. Diving, the water fills with drifting motes and shafts of
// sunlight, and a hard stroke leaves a trail of bubbles.

import * as THREE from 'three';
import { mulberry32, makeNoise } from './noise.js';
import { glow } from './world/textures.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function createUnderwater(island, shared, scene, camera, player, keepClear = []) {
	const clear = (x, z, pad) => keepClear.some((q) => Math.hypot(q.x - x, q.z - z) < pad);
	const bay = island.village.bay;
	const group = new THREE.Group();
	group.name = 'underwater';
	scene.add(group);
	const r = mulberry32(island.seed ^ 0xca1de7a);
	const nz = makeNoise(island.seed + 77);
	const uw = { uTime: shared.uTime, uBass: shared.uBass };
	if (!bay) return { update() {} };

	// ---------- basalt: rough black boulders on the rim and the crater walls ----------
	const rockGeo = (() => {
		const g = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv')), p = g.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
			const k = 0.75 + nz.fbm(x * 1.4 + 5, z * 1.4 + y * 1.1, 4) * 0.55;
			p.setXYZ(i, x * k * 1.3, y * k * 0.8, z * k);
		}
		g.computeVertexNormals();
		return g;
	})();
	const rockMat = new THREE.MeshStandardMaterial({ color: 0x100f0e, roughness: 0.95, flatShading: false });
	rockMat.customProgramCacheKey = () => 'basalt230';
	rockMat.onBeforeCompile = (sh) => {
		sh.vertexShader = 'varying vec3 vB; varying vec3 vBN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvB = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvBN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);');
		sh.fragmentShader = 'varying vec3 vB; varying vec3 vBN;\nfloat bh(vec3 p){ p = mod(p, 256.0); return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			// vesicular basalt: pocked, with green-brown growth on the upward faces
			float pock = step(0.86, bh(floor(vB * 9.0)));
			diffuseColor.rgb *= 1.0 - pock * 0.5;
			float up = clamp(vBN.y, 0.0, 1.0);
			diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.13, 0.06), smoothstep(0.55, 0.9, up) * 0.55);`);
	};
	const rocks = [];
	for (let i = 0; i < 520; i++) {
		const a = r() * Math.PI * 2, t = Math.pow(r(), 0.8) * 0.62;
		const x = bay.x + Math.cos(a) * t * bay.r, z = bay.z + Math.sin(a) * t * bay.r, h = island.heightAt(x, z);
		if (h > -1.2 || t < 0.07 || clear(x, z, 5)) continue;   // keep the vent and the lava tube clear
		// thickest on the rim and the walls, scattered on the floor
		const wall = Math.exp(-Math.pow((t - 0.47) / 0.1, 2)) + Math.exp(-Math.pow(t / 0.12, 2)) * 0.8 + 0.15;
		if (r() > wall) continue;
		rocks.push({ x, y: h, z, s: 0.5 + Math.pow(r(), 2) * 3.2, rot: r() * 6.28 });
	}
	const rockIM = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
	rocks.forEach((k, i) => { e.set((r() - 0.5) * 0.5, k.rot, (r() - 0.5) * 0.5); q.setFromEuler(e); sc.set(k.s, k.s * (0.6 + r() * 0.5), k.s); p3.set(k.x, k.y - k.s * 0.25, k.z); rockIM.setMatrixAt(i, m4.compose(p3, q, sc)); });
	rockIM.receiveShadow = true;
	rockIM.userData.material175 = 'stone';
	group.add(rockIM);

	// ---------- kelp: long ribbons from the rocks toward the surface ----------
	const K = 340, SEG = 12;
	const kelpGeo = (() => {
		const P = [], U = [], I = [];
		for (let s = 0; s <= SEG; s++) { const t = s / SEG; P.push(-0.5, t, 0, 0.5, t, 0); U.push(0, t, 1, t); }
		for (let s = 0; s < SEG; s++) { const a = s * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
		g.setIndex(I);
		return g;
	})();
	const kelpMat = new THREE.MeshLambertMaterial({ color: 0x3a4a1c, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3 });
	kelpMat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uw);
		sh.vertexShader = 'uniform float uTime, uBass; varying vec2 vK;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			vec3 transformed = position;
			vK = uv;
			float t = uv.y;
			vec3 ip = vec3(instanceMatrix[3]);
			float ph = ip.x * 0.37 + ip.z * 0.23;
			// the swell rocks the whole column; the top wanders further than the root
			transformed.x *= 0.5 * (1.0 - t * 0.25) + 0.12 * sin(t * 18.0 + ph);
			transformed.x += sin(uTime * 0.7 + ph + t * 2.2) * t * t * 0.9 + uBass * t * 0.4;
			transformed.z += cos(uTime * 0.55 + ph * 1.3 + t * 1.7) * t * t * 0.7;`);
		sh.fragmentShader = 'varying vec2 vK;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			// blades are leathery olive-brown, lighter and translucent at the edges
			float edge = abs(vK.x - 0.5) * 2.0;
			diffuseColor.rgb *= 0.6 + 0.5 * smoothstep(0.4, 1.0, edge) + 0.25 * vK.y;
			diffuseColor.a = 1.0 - smoothstep(0.85, 1.0, edge) * step(0.97, fract(vK.y * 7.0 + vK.x));`);
	};
	const kelp = new THREE.InstancedMesh(kelpGeo, kelpMat, K);
	let kn = 0;
	for (let i = 0; i < 4000 && kn < K; i++) {
		const src = rocks[Math.floor(r() * rocks.length)];
		if (!src || src.y > -2.5 || clear(src.x, src.z, 5)) continue;
		const a = r() * 6.28, x = src.x + Math.cos(a) * src.s * 0.8, z = src.z + Math.sin(a) * src.s * 0.8, h = island.heightAt(x, z);
		const len = Math.max(2.5, (-h - 0.4) * (0.7 + r() * 0.3));
		e.set(0, r() * 6.28, 0); q.setFromEuler(e); sc.set(0.5 + r() * 0.7, len, 1); p3.set(x, h - 0.1, z);
		kelp.setMatrixAt(kn++, m4.compose(p3, q, sc));
	}
	kelp.count = kn;
	kelp.frustumCulled = false;
	group.add(kelp);

	// ---------- vents and lava ----------
	const vents = [];
	const floorAt = (x, z) => island.heightAt(x, z);
	for (let i = 0; i < 7; i++) {
		const a = r() * 6.28, t = 0.12 + r() * 0.3, x = bay.x + Math.cos(a) * t * bay.r, z = bay.z + Math.sin(a) * t * bay.r;
		vents.push({ x, y: floorAt(x, z), z, lava: false });
	}
	// the heart of the cone: glowing fissures
	const cx = bay.x, cz = bay.z, cy = floorAt(cx, cz);
	vents.push({ x: cx, y: cy, z: cz, lava: true });
	const chimGeo = new THREE.CylinderGeometry(0.25, 0.8, 1.6, 9, 3, true);
	const chimMat = new THREE.MeshStandardMaterial({ color: 0x3b332d, roughness: 1, side: THREE.DoubleSide });
	for (const v of vents) {
		if (v.lava) continue;
		const c = new THREE.Mesh(chimGeo, chimMat);
		c.position.set(v.x, v.y + 0.6, v.z);
		c.scale.setScalar(0.8 + r() * 0.8);
		group.add(c);
	}
	// lava: a crust with bright cracks, pulsing slowly (and with the music's low end)
	const lavaMat = new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uBass: shared.uBass },
		vertexShader: 'varying vec2 vU; void main(){ vU = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime, uBass; varying vec2 vU;
			float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
			void main(){
				float n = vn(vU * 1.3) * 0.6 + vn(vU * 3.1 + 4.0) * 0.4;
				float crack = 1.0 - smoothstep(0.0, 0.14, abs(n - 0.5));
				float seep = smoothstep(0.35, 0.0, length(vU) / 7.0) * 0.6;
				float fade = 1.0 - smoothstep(2.0, 5.5, length(vU));
				float pulse = 0.75 + 0.25 * sin(uTime * 0.9 + n * 6.0) + uBass * 0.4;
				vec3 hot = mix(vec3(0.9, 0.12, 0.0), vec3(1.0, 0.45, 0.05), crack * crack);
				float k = clamp(crack * fade + seep * crack, 0.0, 1.0);
				vec3 col = hot * 1.6 * pulse * k + vec3(0.5, 0.08, 0.0) * seep * pulse * 0.3;
				// only the glowing fissures are drawn; the crust between them is the cone itself
				gl_FragColor = vec4(col, clamp(k * 2.2 + seep * 0.45, 0.0, 1.0));
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`,
	});
	// the glowing heart drapes over the cone's own summit
	const lavaGeo = new THREE.CircleGeometry(7, 48, 0, Math.PI * 2).rotateX(-Math.PI / 2);
	{ const lp = lavaGeo.attributes.position; for (let i = 0; i < lp.count; i++) lp.setY(i, island.heightAt(cx + lp.getX(i), cz + lp.getZ(i)) + 0.25); }
	lavaMat.transparent = true; lavaMat.depthWrite = false; lavaMat.polygonOffset = true; lavaMat.polygonOffsetFactor = -4; lavaMat.polygonOffsetUnits = -8;
	const lava = new THREE.Mesh(lavaGeo, lavaMat);
	lava.position.set(cx, 0, cz);
	lavaGeo.computeBoundingSphere();
	group.add(lava);
	// the vent's light lives in magma.js
	const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xff6a22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
	halo.position.set(cx, island.heightAt(cx, cz) + 1.2, cz);
	halo.scale.set(11, 5, 1);
	group.add(halo);

	// ---------- bubbles: vent streams and your own ----------
	const B = 420, bPos = new Float32Array(B * 3), bubbles = [];
	for (let i = 0; i < B; i++) bubbles.push({ x: 0, y: -999, z: 0, v: 0, life: 0, w: r() * 6.28 });
	const bGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(bPos, 3));
	const bMat = new THREE.PointsMaterial({ map: bubbleTex(), size: 0.09, transparent: true, depthWrite: false, opacity: 0.85 });
	const bPts = new THREE.Points(bGeo, bMat);
	bPts.frustumCulled = false;
	group.add(bPts);
	let bi = 0;
	function emit(x, y, z, spread, speed) {
		const b = bubbles[bi++ % B];
		b.x = x + (Math.random() - 0.5) * spread; b.y = y; b.z = z + (Math.random() - 0.5) * spread;
		b.v = speed * (0.7 + Math.random() * 0.6); b.life = 0;
	}

	// ---------- motes and sun shafts (only while you are under) ----------
	const M = 500, mPos = new Float32Array(M * 3), motes = [];
	for (let i = 0; i < M; i++) motes.push([Math.random() * 30 - 15, Math.random() * 14 - 10, Math.random() * 30 - 15]);
	const mGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mPos, 3));
	const motesPts = new THREE.Points(mGeo, new THREE.PointsMaterial({ map: glow(), color: 0xcfe8e0, size: 0.05, transparent: true, depthWrite: false, opacity: 0.55 }));
	motesPts.frustumCulled = false;
	motesPts.visible = false;
	scene.add(motesPts);
	const shaftMat = new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uSunDir: shared.uSunDir, uK: { value: 0 } },
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
		vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime, uK; varying vec2 vU;
			void main(){
				float s = sin(vU.x * 23.0 + uTime * 0.3) * 0.5 + sin(vU.x * 51.0 - uTime * 0.2) * 0.3 + sin(vU.x * 9.0 + uTime * 0.1) * 0.2;
				float a = smoothstep(0.35, 1.0, s) * (1.0 - vU.y) * smoothstep(0.0, 0.15, vU.y) * smoothstep(0.0, 0.2, vU.x) * smoothstep(1.0, 0.8, vU.x);
				gl_FragColor = vec4(vec3(0.55, 0.85, 0.8) * a * 0.22 * uK, 1.0);
			}`,
	});
	const shafts = new THREE.Mesh(new THREE.PlaneGeometry(40, 30, 1, 1), shaftMat);
	shafts.renderOrder = -1;
	shafts.frustumCulled = false;
	shafts.visible = false;
	scene.add(shafts);

	const last = new THREE.Vector3().copy(camera.position);
	let trail = 0;
	function update(dt, t, under, surface) {
		// vents breathe; the lava heart sends up a thicker column
		for (const v of vents) {
			const rate = v.lava ? 22 : 7;
			const n = Math.random() < rate * dt % 1 ? Math.ceil(rate * dt) : Math.floor(rate * dt);
			for (let k = 0; k < n; k++) emit(v.x, v.y + (v.lava ? 0.5 : 1.3), v.z, v.lava ? 2.5 : 0.3, v.lava ? 1.4 : 1.1);
		}
		// you: a burst when you swim hard, a trickle from your breath
		const sp = camera.position.distanceTo(last) / Math.max(dt, 1e-3);
		last.copy(camera.position);
		if (under) {
			trail += dt * (sp > 2.2 ? 40 : 2.5);
			while (trail > 1) { trail -= 1; const f = -Math.sin(player.state.yaw), g = -Math.cos(player.state.yaw); emit(camera.position.x + f * 0.9, camera.position.y - 0.6, camera.position.z + g * 0.9, 0.7, 0.9); }
		}
		for (let i = 0; i < B; i++) {
			const b = bubbles[i];
			if (b.y < -900) { bPos[i * 3 + 1] = -999; continue; }
			b.life += dt;
			b.y += b.v * dt;
			b.x += Math.sin(t * 3 + b.w + b.life * 4) * 0.12 * dt;
			if (b.y > surface - 0.05 || b.life > 18) b.y = -999;
			bPos[i * 3] = b.x; bPos[i * 3 + 1] = b.y; bPos[i * 3 + 2] = b.z;
		}
		bGeo.attributes.position.needsUpdate = true;
		motesPts.visible = shafts.visible = under;
		if (under) {
			const c = camera.position;
			for (let i = 0; i < M; i++) {
				const m = motes[i];
				m[0] += Math.sin(t * 0.3 + i) * 0.05 * dt; m[1] += 0.03 * dt;
				mPos[i * 3] = c.x + ((m[0] + 15 - c.x * 0) % 30 + 30) % 30 - 15;
				mPos[i * 3 + 1] = Math.min(surface - 0.1, c.y + ((m[1] % 14) + 14) % 14 - 10);
				mPos[i * 3 + 2] = c.z + ((m[2] + 15) % 30 + 30) % 30 - 15;
			}
			mGeo.attributes.position.needsUpdate = true;
			// shafts hang from the surface, turned to face you, leaning with the sun
			const sd = shared.uSunDir.value;
			shafts.position.set(c.x + Math.sin(player.state.yaw) * -9, surface - 15, c.z + Math.cos(player.state.yaw) * -9);
			shafts.rotation.set(0, player.state.yaw, Math.atan2(sd.x, Math.max(0.2, sd.y)) * 0.3);
			shaftMat.uniforms.uK.value = Math.max(0, sd.y) * (1 - Math.min(1, Math.max(0, (surface - c.y) / 25)));
		}
	}
	return { update, group };
}

function bubbleTex() {
	const S = 64, c = document.createElement('canvas');
	c.width = c.height = S;
	const g = c.getContext('2d');
	const gr = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.48);
	gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.75, 'rgba(220,245,255,0.35)'); gr.addColorStop(0.92, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S * 0.48, 0, 7); g.fill();
	g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(S * 0.38, S * 0.36, S * 0.08, 0, 7); g.fill();
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
