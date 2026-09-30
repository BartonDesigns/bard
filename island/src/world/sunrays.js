// Sunbeams through the trees in mist (the Tyndall effect): bright slanting shafts where
// the sun comes through gaps in the canopy, cut into streaks by trunks and leaves, and
// looking up toward the sun a radial burst of rays.
//
// Three parts, all reading the sun's own shadow map (sky.js), so a beam is exactly where
// the light gets through:
// - the shafts: a few screen-filling sheets at set depths in front of you, each summing
//   the sunlit mist over its stretch of the view ray. They are depth tested against the
//   world, so a trunk in front of a beam cuts it. Seen side-on they are slanted beams;
//   toward the sun they converge on it.
// - the burst (not on low-end devices): a quarter-size radial blur of the bright sky
//   toward the sun's place on screen, added over the frame.
// - motes: specks of dust and droplets drifting round you, seen only inside a beam.
//
// Strongest in the morning and at golden hour, in fog, after rain and in the redwood fog
// belt; fading out at noon on a clear day. Only under or near a canopy: none in the
// open, in caves, indoors or under water. On another world the light takes its air's colour.

import * as THREE from 'three';

const MAX_SLICES = 10;
const ss = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the shadow map lookup shared by the sheets and the motes: 1 in sunlight, 0 in shade,
// uOpen outside the map's box
const SHADOW_GLSL = /* glsl */`
uniform sampler2DShadow uShadow; uniform mat4 uShadowM; uniform float uOpen;
float sunLit(vec3 p){
	vec4 sc = uShadowM * vec4(p, 1.0);
	if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return uOpen;
	return texture(uShadow, vec3(sc.xy, sc.z - 0.0006));
}
`;

// a small tiling 3D noise for the mist's lumps (32 cubed, blurred with wrap-around)
function mistNoise() {
	const S = 32, n = S * S * S;
	let a = new Float32Array(n), b = new Float32Array(n);
	let s = 1234567;
	for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; }
	const at = (x, y, z) => ((z & 31) * S + (y & 31)) * S + (x & 31);
	for (let pass = 0; pass < 3; pass++) {
		for (let axis = 0; axis < 3; axis++) {
			for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
				const d = [axis === 0, axis === 1, axis === 2];
				let v = 0;
				for (let k = -2; k <= 2; k++) v += a[at(x + d[0] * k, y + d[1] * k, z + d[2] * k)];
				b[at(x, y, z)] = v / 5;
			}
			[a, b] = [b, a];
		}
	}
	// stretch the blurred values back out to the full range
	let lo = 1, hi = 0;
	for (let i = 0; i < n; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
	const data = new Uint8Array(n);
	for (let i = 0; i < n; i++) data[i] = Math.round((a[i] - lo) / (hi - lo) * 255);
	const t = new THREE.Data3DTexture(data, S, S, S);
	t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
	t.minFilter = t.magFilter = THREE.LinearFilter;
	t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
	t.unpackAlignment = 1;
	t.needsUpdate = true;
	return t;
}

export function createSunRays(scene, shared, renderer, { isPhone = false, sun, air } = {}) {
	// what this device draws: sheets, steps along each, motes, and whether the burst runs
	const lowEnd = isPhone && ((navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3);
	const TIERS = {
		high: { slices: 8, steps: 4, motes: 700, burst: true },
		phone: { slices: 6, steps: 3, motes: 320, burst: true },
		low: { slices: 5, steps: 3, motes: 200, burst: false },
	};
	let tierName = isPhone ? (lowEnd ? 'low' : 'phone') : 'high';
	let tier = TIERS[tierName];

	const noise = mistNoise();
	const U = {
		uShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() }, uOpen: { value: 0.35 },
		uSunDir: shared.uSunDir, uColor: { value: new THREE.Color() }, uDens: { value: 0.01 },
		uGround: { value: 0 }, uTop: { value: 40 }, uNear: { value: 1 }, uFar: { value: 60 }, uCount: { value: tier.slices },
		uNoise: { value: noise }, uDrift: { value: new THREE.Vector3() }, uTime: shared.uTime,
	};

	// ---------- the shafts: sheets across the view at growing depths ----------
	const sheetGeo = new THREE.BufferGeometry();
	{
		const pos = [], k = [], idx = [];
		for (let i = 0; i < MAX_SLICES; i++) {
			for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(x, y, 0); k.push(i); }
			const o = i * 4;
			idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
		}
		sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		sheetGeo.setAttribute('aSlice', new THREE.Float32BufferAttribute(k, 1));
		sheetGeo.setIndex(idx);
	}
	const sheetMat = new THREE.ShaderMaterial({
		uniforms: U, transparent: true, depthWrite: false, depthTest: true,
		blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
		defines: { STEPS: tier.steps },
		vertexShader: /* glsl */`
			attribute float aSlice; uniform float uNear, uFar, uCount;
			varying vec3 vRay; varying vec2 vD; varying float vK;
			void main(){
				// this sheet sums the stretch [d0, d1] of each view ray and stands at d1, so
				// anything nearer than d1 hides it
				float d0 = uNear * pow(uFar / uNear, aSlice / uCount), d1 = uNear * pow(uFar / uNear, (aSlice + 1.0) / uCount);
				vD = vec2(d0, d1); vK = aSlice;
				// the view ray through this corner, one unit deep, turned into the world
				vRay = transpose(mat3(viewMatrix)) * vec3(position.x / projectionMatrix[0][0], position.y / projectionMatrix[1][1], -1.0);
				float zc = projectionMatrix[2][2] * -d1 + projectionMatrix[3][2];
				gl_Position = aSlice < uCount ? vec4(position.xy * d1, zc, d1) : vec4(0.0, 0.0, 2.0, 1.0);
			}`,
		fragmentShader: /* glsl */`
			precision highp sampler2DShadow; precision highp sampler3D;
			uniform vec3 uSunDir, uColor, uDrift; uniform float uDens, uGround, uTop, uTime;
			uniform sampler3D uNoise;
			varying vec3 vRay; varying vec2 vD; varying float vK;
			${SHADOW_GLSL}
			void main(){
				// interleaved gradient noise: each pixel starts its steps somewhere else, so
				// the few steps read as fine grain, not bands
				float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + vK * 0.618);
				float dl = (vD.y - vD.x) / float(STEPS);
				float acc = 0.0;
				for (int i = 0; i < STEPS; i++) {
					vec3 p = cameraPosition + vRay * (vD.x + (float(i) + j) * dl);
					float h = p.y - uGround;
					// mist lies thickest low among the trunks and thins up into the crowns
					float m = (0.45 + 0.55 * exp(-max(h, 0.0) / 14.0)) * (1.0 - smoothstep(uTop * 0.75, uTop * 1.25, h));
					acc += sunLit(p) * m;
				}
				vec3 mid = cameraPosition + vRay * (vD.x + vD.y) * 0.5;
				// lumps and wisps drifting on the air
				float n = texture(uNoise, mid * vec3(0.045, 0.07, 0.045) + uDrift).r;
				float n2 = 0.5;
				#if STEPS > 3
				n2 = texture(uNoise, mid * 0.13 - uDrift * 1.7).r;
				#endif
				acc *= dl * length(vRay) * uDens * (0.25 + 1.5 * n * n + 0.5 * n2);
				// forward scattering: bright looking toward the sun, still plain from the side
				float c = dot(normalize(vRay), uSunDir);
				// (Henyey-Greenstein, g 0.6, scaled to 1 straight at the sun)
				const float g = 0.6;
				float hg = pow((1.0 - g) / sqrt(1.0 + g * g - 2.0 * g * c), 3.0);
				vec3 col = uColor * acc * (0.35 + 0.65 * hg);
				// (shafts, not a white-out: they are held well short of the sky's own light)
				col = 0.7 * col / (1.0 + col * 1.4);
				gl_FragColor = vec4(col + (j - 0.5) / 255.0, 1.0);
			}`,
	});
	const sheets = new THREE.Mesh(sheetGeo, sheetMat);
	sheets.frustumCulled = false;
	sheets.renderOrder = 8;
	sheets.name = 'sunrays';
	sheets.visible = false;
	scene.add(sheets);

	// ---------- motes: dust and droplets lit only inside the beams ----------
	const MOTE_MAX = 700;
	const moteGeo = new THREE.BufferGeometry();
	{
		const seed = new Float32Array(MOTE_MAX * 4);
		for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
		moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MOTE_MAX * 3), 3));
		moteGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
	}
	const moteU = { ...U, uPx: { value: 800 }, uMote: { value: 0 } };
	const moteMat = new THREE.ShaderMaterial({
		uniforms: moteU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
		vertexShader: /* glsl */`
			precision highp sampler2DShadow;
			attribute vec4 aSeed; uniform vec3 uDrift, uSunDir; uniform float uTime, uPx, uGround, uTop, uMote;
			varying float vA;
			${SHADOW_GLSL}
			void main(){
				const vec3 box = vec3(26.0, 14.0, 26.0);
				vec3 p = aSeed.xyz * box + uDrift * 22.0 * (0.6 + aSeed.w * 0.8);
				p += vec3(sin(uTime * 0.23 + aSeed.w * 40.0), sin(uTime * 0.17 + aSeed.x * 31.0) * 0.6, cos(uTime * 0.19 + aSeed.y * 23.0)) * 0.5;
				// the box wraps round you, so the motes are always about you
				p = mod(p - cameraPosition + box * 0.5, box) - box * 0.5 + cameraPosition;
				p.y = max(p.y, uGround + 0.2 + aSeed.w * 2.0);
				vec4 mv = viewMatrix * vec4(p, 1.0);
				float d = -mv.z;
				float lit = sunLit(p) * (1.0 - smoothstep(uTop * 0.6, uTop, p.y - uGround));
				float c = max(dot(normalize(p - cameraPosition), uSunDir), 0.0);
				vA = lit * uMote * smoothstep(0.6, 1.5, d) * (1.0 - smoothstep(9.0, 13.0, d)) * (0.35 + 2.0 * pow(c, 6.0)) * (0.5 + aSeed.w);
				gl_Position = projectionMatrix * mv;
				gl_PointSize = vA > 0.002 ? clamp(uPx * 0.0045 / d, 1.0, 5.0) : 0.0;
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uColor; varying float vA;
			void main(){
				float r = length(gl_PointCoord - 0.5);
				gl_FragColor = vec4(uColor * vA * smoothstep(0.5, 0.1, r), 1.0);
			}`,
	});
	const motes = new THREE.Points(moteGeo, moteMat);
	motes.frustumCulled = false;
	motes.renderOrder = 9;
	motes.name = 'sunmotes';
	motes.visible = false;
	scene.add(motes);

	// ---------- the burst: a radial blur toward the sun, at a quarter size ----------
	const tri = new THREE.BufferGeometry();
	tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
	const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const postScene = new THREE.Scene();
	const quad = new THREE.Mesh(tri, null);
	quad.frustumCulled = false;
	postScene.add(quad);
	const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
	const PU = { uSrc: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uStep: { value: 1 }, uThr: { value: 0.55 }, uColor: { value: new THREE.Color() } };
	const maskMat = new THREE.ShaderMaterial({
		uniforms: PU, depthTest: false, depthWrite: false, toneMapped: false, vertexShader: VS,
		fragmentShader: /* glsl */`
			uniform sampler2D uSrc; uniform vec2 uSun; uniform float uAspect, uThr; varying vec2 vUv;
			void main(){
				// the bright sky seen through the leaves, near the sun
				vec3 c = texture2D(uSrc, vUv).rgb;
				float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
				vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
				float m = smoothstep(uThr, uThr + 0.3, l) * exp(-dot(d, d) * 3.0);
				gl_FragColor = vec4(vec3(m), 1.0);
			}`,
	});
	const blurMat = new THREE.ShaderMaterial({
		uniforms: PU, depthTest: false, depthWrite: false, toneMapped: false, vertexShader: VS,
		fragmentShader: /* glsl */`
			uniform sampler2D uSrc; uniform vec2 uSun; uniform float uStep; varying vec2 vUv;
			void main(){
				// sixteen taps along the line to the sun; the second pass takes longer steps,
				// so the two together sum a couple of hundred
				vec2 dv = (uSun - vUv) * uStep / 16.0;
				float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
				vec2 uv = vUv + dv * j;
				float s = 0.0, w = 1.0, ws = 0.0;
				for (int i = 0; i < 16; i++) { s += texture2D(uSrc, uv).r * w; ws += w; w *= 0.94; uv += dv; }
				gl_FragColor = vec4(vec3(s / ws), 1.0);
			}`,
	});
	const compMat = new THREE.ShaderMaterial({
		uniforms: PU, depthTest: false, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, vertexShader: VS,
		fragmentShader: /* glsl */`
			uniform sampler2D uSrc; uniform vec3 uColor; varying vec2 vUv;
			void main(){
				float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
				float r = texture2D(uSrc, vUv).r;
				vec3 c = uColor * r;
				gl_FragColor = vec4(c / (1.0 + c) + (j - 0.5) / 255.0, 1.0);
			}`,
	});
	let fbTex = null, rtA = null, rtB = null;
	const dbs = new THREE.Vector2();
	function targets() {
		renderer.getDrawingBufferSize(dbs);
		const w = dbs.x | 0, h = dbs.y | 0;
		if (fbTex && fbTex.image.width === w && fbTex.image.height === h) return;
		fbTex?.dispose(); rtA?.dispose(); rtB?.dispose();
		fbTex = new THREE.FramebufferTexture(w, h);
		fbTex.minFilter = fbTex.magFilter = THREE.LinearFilter;
		const q = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
		rtA = new THREE.WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), q);
		rtB = new THREE.WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), q);
	}

	// ---------- when and how strongly ----------
	const S = {
		enabled: true, strength: 1, force: false, burst: null, snap: true, adapt: true,
		k: 0, canopy: 0, tall: 0, mist: 0, timeK: 0, burstK: 0, slow: 0,
	};
	let probeT = 0, canopyT = 0, tallT = 0;
	const tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), tint = new THREE.Color();

	// how much canopy stands round a point: the Bay Area's trees (city.js) and the
	// generated worlds' forest map (vegetation.js writes it into the island's masks)
	function probe(W, x, z) {
		let canopy = 0, tall = 0;
		const city = W.city;
		if (city?.treesNear && W.bayArea?.loaded?.()) {
			let n = 0, r = 0;
			for (const t of city.treesNear(x, z, 32)) if (!t.shrub && !t.fern && t.h > 7) { n++; if (t.cone && t.h > 20) r++; }
			canopy = ss(n, 1, 8);
			tall = Math.min(1, r / 5);
		}
		const I = W.island;
		if (I?.maskAt && Math.max(Math.abs(x), Math.abs(z)) < I.half - 40) {
			let m = 0;
			for (let q = 0; q < 9; q++) { const a = q * 0.698, r = q ? 22 : 0; m += I.maskAt(x + Math.cos(a) * r, z + Math.sin(a) * r, 3); }
			canopy = Math.max(canopy, ss(m / 9, 0.2, 0.6) * Math.min(1, shared.planet?.trees ?? 1));
		}
		return { canopy, tall };
	}

	function update(dt, camera, { W, wx, caveK = 0, under = false, hours = 12, frameMs = 16 }) {
		const sd = shared.uSunDir.value, map = sun?.shadow?.map?.depthTexture;
		const cx = camera.position.x, cz = camera.position.z;
		const ground = W.island.heightAt(cx, cz);
		const agl = camera.position.y - ground;
		probeT -= dt;
		if (probeT <= 0) {
			probeT = 0.4;
			const p = probe(W, cx, cz);
			canopyT = p.canopy; tallT = p.tall;
		}
		// (arriving somewhere, or told from the console: no easing in)
		if (S.snap) { S.canopy = canopyT; S.tall = tallT; }
		S.canopy += (canopyT - S.canopy) * Math.min(1, dt * 1.2);
		S.tall += (tallT - S.tall) * Math.min(1, dt * 1.2);
		// the mist: morning, the fog belt by the sea, the redwoods, rain just gone, a hazy world
		const earth = !!W.bayArea;
		const fq = Math.min(1, Math.max(0, (cx - 22000) / 36000));
		const belt = earth ? 1 - fq * fq * (3 - 2 * fq) : 0;
		const rise = W.sky.state.sun?.rise ?? 6.5;
		const morning = hours > rise - 0.5 ? 1 - ss(hours, rise + 2.5, rise + 5.5) : 0;
		const wet = shared.uWet?.value || 0, gloom = wx?.gloom || 0, haze = W.island.profileHaze || 1;
		S.mist = Math.min(1.6, 0.3 + 0.35 * belt + 0.45 * S.tall + 0.55 * morning + 0.5 * wet + 0.35 * gloom + Math.max(0, haze - 1) * 0.4);
		// the low sun makes the long slanting beams; at noon on a clear day they are gone
		const elev = sd.y;
		const lowSun = 1 - ss(elev, 0.3, 0.8);
		S.timeK = ss(elev, 0.0, 0.07) * Math.max(lowSun, Math.min(1, 0.3 * (S.mist - 0.3) + 0.15 * wet));
		const sunVis = Math.min(wx?.sunVis ?? 1, 1 - ss(W.weather.state.cover ?? 0, 0.6, 0.95) * 0.85);
		const open = (1 - caveK) * (W.weather.state.sheltered ? 0 : 1) * (under ? 0 : 1) * (1 - ss(agl, 45, 110));
		let k = S.canopy * S.timeK * sunVis * open * Math.min(1.25, 0.45 + 0.55 * S.mist);
		if (S.force) k = Math.max(k, open * ss(elev, 0.0, 0.07));
		if (!S.enabled || !map || !renderer.shadowMap.enabled) k = 0;
		S.k += (k - S.k) * Math.min(1, dt * 0.8);
		if (S.force || S.snap || S.k < 0.003) S.k = k;
		S.snap = false;
		// frames slow for a while: the burst goes first, then a sheet or two
		S.slow = S.adapt ? S.slow + ((frameMs > 24 ? 1 : 0) - S.slow) * Math.min(1, dt * 0.2) : 0;
		const on = S.k * S.strength > 0.005;
		sheets.visible = motes.visible = on;
		if (!on) { S.burstK = 0; return S; }

		U.uShadow.value = map;
		U.uShadowM.value.copy(sun.shadow.matrix);
		U.uGround.value = ground;
		// the crowns' height: redwoods stand tall
		U.uTop.value = 30 + 40 * S.tall;
		U.uNear.value = Math.max(0.8, camera.near * 1.3);
		U.uFar.value = 42;
		const n = Math.max(3, tier.slices - (S.slow > 0.7 ? 2 : 0));
		U.uCount.value = n;
		sheetGeo.setDrawRange(0, n * 6);
		// the sky's own light outside the shadow box: gaps are about as common as the canopy is thin
		U.uOpen.value = 0.45 * (1 - S.canopy * 0.6);
		// (under an open sky the sunlit mist is everywhere and shows as haze, not shafts: thinner)
		U.uDens.value = 0.05 * S.mist * (0.3 + 0.7 * Math.min(1, S.canopy * 1.6));
		// the mist drifts with the wind, slowed among the trunks (in the noise's units: 22 m)
		const w = W.weather.windV;
		U.uDrift.value.x = (U.uDrift.value.x + ((w?.x || 4) * 0.05 + 0.1) * dt * 0.045) % 64;
		U.uDrift.value.y = (U.uDrift.value.y + 0.06 * dt * 0.045) % 64;
		U.uDrift.value.z = (U.uDrift.value.z + (w?.z || 0) * 0.05 * dt * 0.045) % 64;
		// the sun's colour (golden when low), in this world's air
		const a = air?.value;
		tint.setRGB(1, 1, 1);
		if (a && a.w > 0) tint.lerp(tmpV.set(a.x, a.y, a.z), a.w);
		U.uColor.value.copy(shared.uSunColor.value).multiply(tint).multiplyScalar(S.k * S.strength);
		moteU.uPx.value = renderer.getDrawingBufferSize(dbs).y;
		moteU.uMote.value = 0.9;
		const mc = Math.round(tier.motes * Math.min(1, 0.4 + S.mist * 0.6));
		moteGeo.setDrawRange(0, mc);

		// the burst, when the sun is ahead
		camera.getWorldDirection(fwd);
		const facing = fwd.dot(sd);
		const burstOn = (S.burst ?? tier.burst) && S.slow < 0.5;
		S.burstK = burstOn && facing > 0.15 ? ss(facing, 0.15, 0.6) * S.k * S.strength : 0;
		if (S.burstK > 0.01) {
			tmpV.copy(camera.position).addScaledVector(sd, 1000).project(camera);
			PU.uSun.value.set(tmpV.x * 0.5 + 0.5, tmpV.y * 0.5 + 0.5);
			PU.uColor.value.copy(shared.uSunColor.value).multiply(tint).multiplyScalar(S.burstK * (0.8 + 0.4 * S.mist));
			// in thick fog the whole scene is bright: only the brightest sky counts
			PU.uThr.value = 0.5 + 0.12 * Math.min(1, S.mist);
		}
		return S;
	}

	// after the frame is drawn: the burst over it
	function post() {
		if (S.burstK <= 0.01 || !sheets.visible) return;
		targets();
		const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
		renderer.copyFramebufferToTexture(fbTex);
		renderer.autoClear = false;
		PU.uAspect.value = fbTex.image.width / fbTex.image.height;
		quad.material = maskMat; PU.uSrc.value = fbTex;
		renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
		quad.material = blurMat; PU.uSrc.value = rtA.texture; PU.uStep.value = 0.12;
		renderer.setRenderTarget(rtB); renderer.render(postScene, postCam);
		PU.uSrc.value = rtB.texture; PU.uStep.value = 0.9;
		renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
		quad.material = compMat; PU.uSrc.value = rtA.texture;
		renderer.setRenderTarget(prevTarget); renderer.render(postScene, postCam);
		renderer.autoClear = prevAuto;
	}

	// main.js's quality: 'low' drops the burst and draws fewer sheets
	function quality(mode) {
		tierName = mode === 'low' ? 'low' : mode === 'high' ? 'high' : isPhone ? (lowEnd ? 'low' : 'phone') : 'high';
		tier = TIERS[tierName];
		if (sheetMat.defines.STEPS !== tier.steps) { sheetMat.defines.STEPS = tier.steps; sheetMat.needsUpdate = true; }
	}

	// Crysis.rays(): 'on' / 'off' / 'force' / a strength / { burst: false }; tells how it stands
	function control(v) {
		S.snap = true;
		probeT = 0;
		if (v === 'off' || v === false) { S.enabled = false; S.force = false; }
		else if (v === 'on' || v === true) { S.enabled = true; S.force = false; }
		else if (v === 'force') { S.enabled = true; S.force = true; }
		else if (typeof v === 'number') { S.enabled = true; S.strength = Math.max(0, Math.min(4, v)); }
		else if (v && typeof v === 'object') {
			if ('burst' in v) S.burst = v.burst === null ? null : !!v.burst;
			if ('strength' in v) S.strength = Math.max(0, Math.min(4, +v.strength));
			if ('force' in v) S.force = !!v.force;
			if ('adapt' in v) S.adapt = !!v.adapt;
			if ('tier' in v && TIERS[v.tier]) { tier = TIERS[tierName = v.tier]; sheetMat.defines.STEPS = tier.steps; sheetMat.needsUpdate = true; }
		}
		return info();
	}
	const r2 = (x) => Math.round(x * 100) / 100;
	function info() {
		return { enabled: S.enabled, force: S.force, strength: S.strength, tier: tierName, k: r2(S.k), canopy: r2(S.canopy), redwoods: r2(S.tall), mist: r2(S.mist), time: r2(S.timeK), burst: r2(S.burstK), sheets: sheets.visible ? U.uCount.value : 0 };
	}

	function dispose() {
		fbTex?.dispose(); rtA?.dispose(); rtB?.dispose();
		noise.dispose(); tri.dispose(); maskMat.dispose(); blurMat.dispose(); compMat.dispose();
	}
	return { update, post, quality, control, info, dispose, sheets, motes, state: S };
}
