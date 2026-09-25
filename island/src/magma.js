// The heart of the drowned volcano, still alive. A vent at the summit of the cone
// throws up a fountain of embers into a dark rising plume; molten rivulets run down
// the cone through black rock that glows along its cracks; and a lava tube leaves
// the vent and runs out across the crater floor, a rock tunnel you can swim through,
// lit orange by the molten stream along its floor, sunlight falling in through the
// holes where its roof has collapsed. It all breathes with the music's low end.

import * as THREE from 'three';
import { mulberry32, makeNoise } from './noise.js';
import { glow } from './world/textures.js';

// shared GLSL: value noise and the glowing crack pattern used by rock and lava
const NOISE = /* glsl */`
float mh(vec2 p){ p = mod(p, 512.0); vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float mn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mh(i), mh(i + vec2(1, 0)), f.x), mix(mh(i + vec2(0, 1)), mh(i + vec2(1, 1)), f.x), f.y); }
float mf(vec2 p){ return mn(p) * 0.5 + mn(p * 2.03 + 3.1) * 0.3 + mn(p * 4.1 - 1.7) * 0.2; }
// thin bright seams where the noise crosses its middle: cracks in cooling crust
float seams(vec2 p){ float v = abs(mf(p) - 0.5); return 1.0 - smoothstep(0.0, 0.028, v); }
`;

// rock that glows from inside along its cracks, hotter toward the vent and low down
function magmaRock(shared, vent, heatRange) {
	const m = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.9, flatShading: false });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uBass = shared.uBass;
		sh.uniforms.uVent = { value: vent }; sh.uniforms.uHeatR = { value: heatRange };
		sh.vertexShader = 'attribute float aHeat; varying float vHeat; varying vec3 vM;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vHeat = aHeat;
			{ vec4 q = vec4(transformed, 1.0);
			#ifdef USE_INSTANCING
			q = instanceMatrix * q;
			#endif
			vM = (modelMatrix * q).xyz; }`);
		sh.fragmentShader = 'varying float vHeat; varying vec3 vM; uniform float uTime, uBass, uHeatR; uniform vec3 uVent;\n' + NOISE + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				diffuseColor.rgb *= 0.55 + 0.7 * mf(vM.xz * 1.3 + vM.y * 0.9);
				diffuseColor.rgb *= 1.0 - 0.35 * step(0.82, mh(floor(vM.xz * 7.0 + vM.y * 5.0)));   // vesicles`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				{
					// heat: vertex colour red channel marks how hot this part is (1 = molten edge),
					// then distance to the vent and height above the floor fade it
					float heat = vHeat * (1.0 - smoothstep(uHeatR * 0.3, uHeatR, distance(vM.xz, uVent.xz)));
					float s = seams(vM.xz * 2.1 + vM.y * 1.4) + seams(vM.yz * 2.6 + vM.x * 0.9) * 0.6;
					float pulse = 0.75 + 0.25 * sin(uTime * 1.3 + mf(vM.xz) * 8.0) + uBass * 0.5;
					// saturated reds and oranges, kept below the tone curve's white shoulder
					totalEmissiveRadiance += vec3(0.95, 0.2, 0.015) * s * heat * pulse * 0.95
						+ vec3(0.35, 0.06, 0.005) * heat * heat * 0.3 * pulse;          // the underside lit from the melt
				}`);
	};
	m.customProgramCacheKey = () => 'magmarock231';
	return m;
}

// flowing lava: plates of dark crust riding on a bright current, running along uv.y
function lavaFlow(shared) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uBass: shared.uBass },
		transparent: true, depthWrite: false, side: THREE.DoubleSide,
		polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
		vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime, uBass; varying vec2 vU;
			${NOISE}
			void main(){
				vec2 q = vec2(vU.x * 2.0, vU.y * 0.9 - uTime * 0.35);
				float crust = mf(q * 2.2);
				float crack = seams(q * 2.6) + smoothstep(0.52, 0.34, crust);
				float edge = smoothstep(0.0, 0.22, vU.x) * smoothstep(1.0, 0.78, vU.x);
				float pulse = 0.8 + 0.2 * sin(uTime * 1.7 + vU.y * 3.0) + uBass * 0.4;
				vec3 hot = mix(vec3(0.85, 0.12, 0.0), vec3(1.0, 0.45, 0.04), clamp(crack, 0.0, 1.0));
				vec3 col = mix(vec3(0.04, 0.03, 0.025), hot * 1.25 * pulse, clamp(crack * 1.2, 0.0, 1.0) * edge);
				// the centre of the stream stays molten, the banks crust over
				col += vec3(0.9, 0.22, 0.01) * smoothstep(0.35, 0.5, 1.0 - abs(vU.x - 0.5) * 2.0) * 0.45 * pulse * edge;
				gl_FragColor = vec4(col, edge);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`,
	});
}

// a ribbon laid on the ground along a path, width w, uv.y running downstream
function ribbon(island, pts, w, lift) {
	const P = [], U = [], I = [];
	let along = 0;
	for (let k = 0; k < pts.length; k++) {
		const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
		const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
		if (k) along += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
		const ww = w * (pts[k].w || 1);
		for (const s of [-1, 1]) {
			const x = pts[k].x + nx * ww * 0.5 * s, z = pts[k].z + nz * ww * 0.5 * s;
			P.push(x, (pts[k].y ?? island.heightAt(x, z)) + lift, z);
			U.push(s < 0 ? 0 : 1, along / 6);
		}
	}
	for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
	g.setIndex(I);
	g.computeBoundingSphere();
	return g;
}

export function createMagma(island, shared, scene, camera) {
	const bay = island.village.bay;
	if (!bay) return { update() {} };
	const r = mulberry32(island.seed ^ 0x3a63a);
	const nz = makeNoise(island.seed + 911);
	const group = new THREE.Group();
	group.name = 'magma';
	scene.add(group);
	const cx = bay.x, cz = bay.z, summit = island.heightAt(cx, cz);
	const vent = new THREE.Vector3(cx, summit, cz);

	// ---------- the vent: a ring of jagged spires round the throat ----------
	const spireGeo = (() => {
		const g = new THREE.ConeGeometry(1, 1, 9, 8, false), p = g.attributes.position, c = [];
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
			const k = 0.75 + nz.fbm(x * 2 + 4, z * 2 + y * 3, 3) * 0.6, t = y + 0.5;
			p.setXYZ(i, x * k * (1 - t * 0.35), y, z * k * (1 - t * 0.35));
			c.push(1 - t * 0.7, 0, 0);             // hot at the base, cooling up the spire
		}
		g.setAttribute('aHeat', new THREE.Float32BufferAttribute(c.filter((_, i) => i % 3 === 0), 1));
		g.computeVertexNormals();
		return g;
	})();
	const rockMat = magmaRock(shared, vent, 22);
	const spires = [];
	for (let i = 0; i < 16; i++) {
		const a = i / 16 * 6.283 + r() * 0.3, d = 2.2 + r() * 3.2;
		const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
		spires.push({ x, z, y: island.heightAt(x, z), h: 1.5 + r() * 3.8 * (1 - d / 7), w: 0.7 + r() * 1.1, tilt: (r() - 0.5) * 0.5, a });
	}
	const spireIM = new THREE.InstancedMesh(spireGeo, rockMat, spires.length);
	{
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
		spires.forEach((o, i) => { e.set(o.tilt * Math.sin(o.a), r() * 6.28, o.tilt * Math.cos(o.a)); q.setFromEuler(e); s.set(o.w, o.h, o.w); p.set(o.x, o.y + o.h * 0.42, o.z); spireIM.setMatrixAt(i, m4.compose(p, q, s)); });
	}
	spireIM.userData.material175 = 'stone';
	group.add(spireIM);

	// scattered blocks of cooling lava round the cone, glowing in their cracks
	const blockGeo = (() => {
		const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, c = [];
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.7 + nz.fbm(x * 1.8 - 2, z * 1.8 + y, 3) * 0.6;
			p.setXYZ(i, x * k * 1.2, y * k * 0.7, z * k);
			c.push(0.55 + 0.45 * Math.max(0, -y), 0, 0);
		}
		g.setAttribute('aHeat', new THREE.Float32BufferAttribute(c.filter((_, i) => i % 3 === 0), 1));
		g.computeVertexNormals();
		return g;
	})();
	const blocks = [];
	for (let i = 0; i < 90; i++) {
		const a = r() * 6.283, d = 4 + Math.pow(r(), 1.4) * 20, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
		blocks.push({ x, z, y: island.heightAt(x, z), s: 0.35 + Math.pow(r(), 2) * 1.6 });
	}
	const blockIM = new THREE.InstancedMesh(blockGeo, rockMat, blocks.length);
	{
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
		blocks.forEach((o, i) => { e.set(r() * 0.6, r() * 6.28, r() * 0.6); q.setFromEuler(e); s.setScalar(o.s); p.set(o.x, o.y - o.s * 0.15, o.z); blockIM.setMatrixAt(i, m4.compose(p, q, s)); });
	}
	group.add(blockIM);

	// ---------- molten rivulets down the flanks of the cone ----------
	const flowMat = lavaFlow(shared);
	const rivulets = [];
	for (let i = 0; i < 5; i++) {
		let a = i / 5 * 6.283 + r() * 0.8, x = cx + Math.cos(a) * 1.5, z = cz + Math.sin(a) * 1.5;
		const pts = [];
		for (let k = 0; k < 26; k++) {
			pts.push({ x, z, w: 0.6 + 0.4 * Math.sin(k * 0.7 + i) });
			// flow downhill, meandering
			const e2 = 0.8, gx = island.heightAt(x + e2, z) - island.heightAt(x - e2, z), gz = island.heightAt(x, z + e2) - island.heightAt(x, z - e2);
			const dl = Math.hypot(gx, gz) || 1;
			a = Math.atan2(-gz / dl, -gx / dl) * 0.7 + a * 0.3 + (nz.vnoise(k * 0.4, i * 3.1) - 0.5) * 0.9;
			x += Math.cos(a) * 0.9; z += Math.sin(a) * 0.9;
		}
		const m = new THREE.Mesh(ribbon(island, pts, 1.1, 0.12), flowMat);
		group.add(m);
		rivulets.push(pts);
	}

	// ---------- the lava tube ----------
	// it leaves the vent, runs out across the crater floor and opens at a broken mouth;
	// an arched rock tunnel you can swim through, a molten stream along its floor
	const tube = [];
	{
		let a = r() * 6.283, x = cx + Math.cos(a) * 5, z = cz + Math.sin(a) * 5;
		for (let k = 0; k <= 30; k++) {
			tube.push({ x, z, y: island.heightAt(x, z) });
			a += (nz.vnoise(k * 0.25, 7.7) - 0.5) * 0.35;
			x += Math.cos(a) * 1.8; z += Math.sin(a) * 1.8;
		}
		// smooth the floor line so the tunnel does not step
		for (let pass = 0; pass < 3; pass++) for (let k = 1; k < tube.length - 1; k++) tube[k].y = (tube[k - 1].y + tube[k].y * 2 + tube[k + 1].y) / 4;
	}
	const tubeGeo = (() => {
		const P = [], C = [], I = [], SIDES = 14, R = 3.4;
		const rowsAt = [];
		for (let k = 0; k < tube.length; k++) {
			const a = tube[Math.max(0, k - 1)], b = tube[Math.min(tube.length - 1, k + 1)];
			const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nzv = dx / l;
			const row = [];
			const rk = R * (0.85 + 0.3 * nz.vnoise(k * 0.3, 1.3)) * (k === tube.length - 1 ? 1.25 : 1);
			for (let s = 0; s <= SIDES; s++) {
				// an arch from floor to floor, a little flattened and lumpy
				const th = Math.PI * (s / SIDES);
				const bump = 0.8 + 0.4 * nz.fbm(k * 0.4 + s * 0.3, s * 0.21 + k * 0.1, 3);
				const side = Math.cos(th) * rk * 1.1 * bump, up = Math.sin(th) * rk * 0.85 * bump;
				P.push(tube[k].x + nx * side, tube[k].y + up - 0.4, tube[k].z + nzv * side);
				C.push(Math.max(0, 1 - up / (rk * 0.7)), 0, 0);        // lower walls lit hot
				row.push(P.length / 3 - 1);
			}
			rowsAt.push(row);
		}
		// holes: every so often a roof section has fallen in, and light comes down
		for (let k = 0; k < tube.length - 1; k++) for (let s = 0; s < SIDES; s++) {
			const roof = s > SIDES * 0.3 && s < SIDES * 0.7;
			if (roof && (k % 9 === 4 || k % 9 === 5)) continue;
			const a = rowsAt[k][s], b = rowsAt[k][s + 1], c = rowsAt[k + 1][s], d = rowsAt[k + 1][s + 1];
			I.push(a, b, c, b, d, c);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('aHeat', new THREE.Float32BufferAttribute(C.filter((_, i) => i % 3 === 0), 1));
		g.setIndex(I);
		g.computeVertexNormals();
		return g;
	})();
	const tubeMat = magmaRock(shared, vent, 80);
	tubeMat.side = THREE.DoubleSide;
	const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
	tubeMesh.userData.material175 = 'stone';
	group.add(tubeMesh);
	// the stream on its floor, out of the vent and spilling from the mouth in a fan
	const streamPts = tube.map((p, k) => ({ x: p.x, z: p.z, y: Math.max(island.heightAt(p.x, p.z), p.y - 0.3) + 0.12, w: k > tube.length - 4 ? 1.6 + (k - tube.length + 4) * 0.8 : 1 }));
	group.add(new THREE.Mesh(ribbon(island, streamPts, 2.2, 0.0), flowMat));

	// ---------- lights: the vent, and inside the tunnel ----------
	const ventLight = new THREE.PointLight(0xff5a18, 0, 34, 1.5);
	ventLight.position.set(cx, summit + 3.5, cz);
	const mid = tube[Math.floor(tube.length * 0.55)];
	const tubeLight = new THREE.PointLight(0xff4a10, 0, 22, 1.6);
	tubeLight.position.set(mid.x, mid.y + 1.2, mid.z);
	group.add(ventLight, tubeLight);
	// the throat glows up into the water
	const throat = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xff4a10, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
	throat.position.set(cx, summit + 1.5, cz); throat.scale.set(9, 7, 1);
	group.add(throat);

	// ---------- embers: a fountain of glowing sparks, slowed by the water ----------
	const E = 700, ePos = new Float32Array(E * 3), eLife = new Float32Array(E), embers = [];
	for (let i = 0; i < E; i++) embers.push({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), life: 99, max: 1 });
	const eGeo = new THREE.BufferGeometry();
	eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
	eGeo.setAttribute('aLife', new THREE.BufferAttribute(eLife, 1));
	const eMat = new THREE.ShaderMaterial({
		uniforms: { uMap: { value: glow() }, uScale: { value: 900 } },
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
		vertexShader: `attribute float aLife; varying float vL; uniform float uScale;
			void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
			gl_PointSize = max(2.0, (0.07 + 0.12 * (1.0 - aLife)) * uScale / max(0.5, -mv.z)); }`,
		fragmentShader: `uniform sampler2D uMap; varying float vL;
			void main(){ vec4 t = texture2D(uMap, gl_PointCoord);
				vec3 c = mix(vec3(1.0, 0.85, 0.45), vec3(0.9, 0.18, 0.02), smoothstep(0.0, 0.7, vL));
				gl_FragColor = vec4(c * 1.3 * t.a * (1.0 - smoothstep(0.6, 1.0, vL)), 1.0); }`,
	});
	const emberPts = new THREE.Points(eGeo, eMat);
	emberPts.frustumCulled = false;
	group.add(emberPts);

	// ---------- the plume: dark billowing water rising from the throat ----------
	const plumeTex = (() => {
		const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), rr = mulberry32(3);
		for (let i = 0; i < 26; i++) {
			const x = S / 2 + (rr() - 0.5) * S * 0.45, y = S / 2 + (rr() - 0.5) * S * 0.45, rad = S * (0.12 + rr() * 0.2);
			const gr = g.createRadialGradient(x, y, 0, x, y, rad);
			gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = gr; g.fillRect(0, 0, S, S);
		}
		const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
	})();
	const puffs = [];
	for (let i = 0; i < 34; i++) {
		const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: plumeTex, color: 0x1a1512, transparent: true, depthWrite: false, opacity: 0 }));
		m.userData = { age: i / 34 * 9, drift: new THREE.Vector2(r() - 0.5, r() - 0.5), spin: (r() - 0.5) * 0.4 };
		group.add(m);
		puffs.push(m);
	}

	// ---------- a low rumble, only under water and near ----------
	let rumble = null;
	function rumbleAt(level) {
		const b = window.leadBus227, c = b && b.context;
		if (!c || c.state !== 'running') return;
		if (!rumble) {
			const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
			let last = 0; for (let i = 0; i < d.length; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = last * 6; }
			const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
			const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
			const g = c.createGain(); g.gain.value = 0;
			src.connect(lp).connect(g).connect(b); src.start();
			rumble = { g, c };
		}
		rumble.g.gain.setTargetAtTime(level, rumble.c.currentTime, 0.4);
	}

	const tmp = new THREE.Vector3();
	let spawn = 0;
	function update(dt, t, under, surface) {
		const cam = camera.position, near = cam.distanceTo(vent), active = near < 140;
		group.visible = active;
		const bass = shared.uBass.value;
		// light only when close (the light count never changes, so no shader rebuild)
		ventLight.intensity = active ? 55 + Math.sin(t * 1.1) * 12 + bass * 40 : 0;
		tubeLight.intensity = active ? 26 + Math.sin(t * 1.6 + 1) * 6 + bass * 16 : 0;
		rumbleAt(under && active ? Math.max(0, 1 - near / 60) * 0.16 : 0);
		if (!active) return;
		dt = Math.min(dt, 0.05);
		// the fountain: bursts, stronger with the bass
		spawn += dt * (140 + bass * 420 + (Math.sin(t * 0.7) > 0.8 ? 300 : 0));
		for (let i = 0; i < E && spawn >= 1; i++) {
			const e = embers[i];
			if (e.life < e.max) continue;
			spawn -= 1;
			e.p.set(cx + (Math.random() - 0.5) * 1.6, summit + 0.8, cz + (Math.random() - 0.5) * 1.6);
			const a = Math.random() * 6.283, s = Math.random() * 2.2;
			e.v.set(Math.cos(a) * s, 6 + Math.random() * 7, Math.sin(a) * s);
			e.life = 0; e.max = 1.4 + Math.random() * 2.2;
		}
		spawn = Math.min(spawn, 40);
		for (let i = 0; i < E; i++) {
			const e = embers[i];
			if (e.life >= e.max) { ePos[i * 3 + 1] = -999; continue; }
			e.life += dt;
			// the water drags them to a drift, then they sink and die
			e.v.multiplyScalar(Math.exp(-dt * 1.6));
			e.v.y -= 1.4 * dt;
			e.p.addScaledVector(e.v, dt);
			if (e.p.y > surface - 0.3) e.life = e.max;
			ePos[i * 3] = e.p.x; ePos[i * 3 + 1] = e.p.y; ePos[i * 3 + 2] = e.p.z;
			eLife[i] = e.life / e.max;
		}
		eGeo.attributes.position.needsUpdate = true;
		eGeo.attributes.aLife.needsUpdate = true;
		// the plume rises, spreads, cools from lit-orange at the throat to dark
		const top = surface - 1.5;
		for (const m of puffs) {
			const u = m.userData;
			u.age += dt;
			const life = 9, k = (u.age % life) / life;
			const h = summit + 1 + k * Math.max(4, top - summit - 1);
			m.position.set(cx + u.drift.x * k * 10 + Math.sin(t * 0.3 + u.spin * 9) * k * 1.5, h, cz + u.drift.y * k * 10);
			const sz = 2.5 + k * 11;
			m.scale.set(sz, sz, 1);
			m.material.rotation += u.spin * dt;
			m.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.9;
			tmp.set(1, 0.3, 0.05).multiplyScalar(Math.max(0, 1 - k * 2.5) * 1.3);
			m.material.color.setRGB(0.05 + tmp.x, 0.045 + tmp.y * 0.6, 0.04 + tmp.z * 0.3);
		}
	}
	return { update, group, tube };
}
