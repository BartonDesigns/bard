// Sea caves. Out on the drowned slopes, the old lava flows left hollow tubes: rock
// tunnels you can swim through, swelling into chambers and pinching to throats, roofs
// broken open here and there so a shaft of daylight falls through. Their walls are
// banded and crusted, fringed with teeth of rock above and below, and deep inside,
// where the daylight fails, small living lights glow blue-green on the walls.
// Short natural arches stand on the ridges between the valleys.

import * as THREE from 'three';
import { mulberry32, makeNoise } from './noise.js';

// rock for the tunnels: banded, crusted, darkening inward, with living specks
function caveRock(shared) {
	const m = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.92, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uBass = shared.uBass;
		sh.vertexShader = 'attribute float aIn; varying float vIn; varying vec3 vC; varying vec3 vCN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vIn = aIn;
			vC = (modelMatrix * vec4(transformed, 1.0)).xyz;
			vCN = normalize(mat3(modelMatrix) * objectNormal);`);
		sh.fragmentShader = 'vec3 bio233 = vec3(0.0);\nvarying float vIn; varying vec3 vC; varying vec3 vCN; uniform float uTime, uBass;\n'
			+ 'float ch(vec3 p){ p = mod(p, 256.0); return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n'
			+ 'float cn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(ch(i), ch(i + vec3(1,0,0)), f.x), mix(ch(i + vec3(0,1,0)), ch(i + vec3(1,1,0)), f.x), f.y), mix(mix(ch(i + vec3(0,0,1)), ch(i + vec3(1,0,1)), f.x), mix(ch(i + vec3(0,1,1)), ch(i + vec3(1,1,1)), f.x), f.y), f.z); }\n'
			+ sh.fragmentShader
				.replace('#include <color_fragment>', `#include <color_fragment>
					{
						// flow banding: old lava laid down in layers, gently wavy
						float band = sin(vC.y * 3.1 + cn(vC * 0.35) * 5.0) * 0.5 + 0.5;
						diffuseColor.rgb *= 0.7 + 0.35 * band + 0.3 * (cn(vC * 1.7) - 0.5);
						// crust: rust and ochre stains, pale coralline patches on the upward faces
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.11, 0.06), smoothstep(0.55, 0.8, cn(vC * 0.6 + 7.0)) * 0.6);
						float up = clamp(vCN.y, 0.0, 1.0);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.22, 0.26), smoothstep(0.62, 0.78, cn(vC * 1.3 + 3.0)) * up * 0.7);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.14, 0.07), smoothstep(0.5, 0.9, up) * 0.4);
						// the deep inside keeps little light
						diffuseColor.rgb *= 1.0 - vIn * 0.55;
					}`)
				.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
					{
						// living lights: tiny specks, thickest where it is darkest, breathing slowly
						vec3 cell = floor(vC * 5.0);
						float s = step(0.965, ch(cell));
						float f = 1.0 - smoothstep(0.05, 0.22, length(fract(vC * 5.0) - 0.5));
						float breathe = 0.55 + 0.45 * sin(uTime * (0.5 + ch(cell + 3.0)) + ch(cell + 9.0) * 6.28) + uBass * 0.4;
						vec3 tint = mix(vec3(0.1, 0.9, 0.75), vec3(0.35, 0.55, 1.0), ch(cell + 5.0));
						bio233 = tint * s * f * breathe * smoothstep(0.25, 0.8, vIn) * 0.9;
					}`)
				.replace('#include <fog_fragment>', `#include <fog_fragment>
					gl_FragColor.rgb += bio233 * exp(-length(vC - cameraPosition) * 0.04);`);
	};
	m.customProgramCacheKey = () => 'caverock233';
	return m;
}

export function createCaverns(island, shared, scene, camera, keepClear = []) {
	const group = new THREE.Group();
	group.name = 'caverns';
	scene.add(group);
	const r = mulberry32(island.seed ^ 0x5eaca7e);
	const nz = makeNoise(island.seed + 233);
	const H = (x, z) => island.heightAt(x, z);
	const lim = island.half * 0.92;

	// ---------- finding where caves go ----------
	// walk a meandering line over the seabed; keep it if the water stays deep enough
	// over the whole run, and prefer lines that cross ridges and valleys
	const walk = (x, z, a, steps, step, R) => {
		const pts = [];
		for (let k = 0; k <= steps; k++) {
			if (Math.abs(x) > lim || Math.abs(z) > lim) return null;
			pts.push({ x, z, y: H(x, z) });
			a += (nz.vnoise(k * 0.3 + x * 0.01, 3.1 + z * 0.01) - 0.5) * 0.5;
			x += Math.cos(a) * step; z += Math.sin(a) * step;
		}
		// the floor line rides the high points so the ground never fills the tunnel
		const y = pts.map((p, k) => Math.max(p.y, pts[Math.max(0, k - 1)].y, pts[Math.min(pts.length - 1, k + 1)].y));
		for (let pass = 0; pass < 2; pass++) for (let k = 1; k < y.length - 1; k++) y[k] = Math.max(y[k], (y[k - 1] + y[k] * 2 + y[k + 1]) / 4);
		let lo = 1e9, hi = -1e9;
		for (let k = 0; k < pts.length; k++) {
			pts[k].y = y[k];
			// the roof stays well under the waves, and nothing too deep to find
			if (y[k] + R * 1.3 > -3 || y[k] < -34) return null;
			if (keepClear.some((q) => Math.hypot(q.x - pts[k].x, q.z - pts[k].z) < R + 8)) return null;
			lo = Math.min(lo, H(pts[k].x, pts[k].z)); hi = Math.max(hi, H(pts[k].x, pts[k].z));
		}
		pts.score = hi - lo;
		return pts;
	};
	const taken = [];
	const farFromTaken = (pts, pad) => !taken.some((o) => o.some((q) => pts.some((p) => Math.hypot(p.x - q.x, p.z - q.z) < pad)));
	// candidate starts: the slopes around the island, bay first
	const bay = island.village.bay;
	const start = (nearBay) => {
		if (nearBay && bay) {
			const a = r() * 6.283, t = 0.3 + r() * 0.5;
			return { x: bay.x + Math.cos(a) * bay.r * t, z: bay.z + Math.sin(a) * bay.r * t };
		}
		const a = r() * 6.283, t = 0.85 + r() * 0.4;
		return { x: Math.cos(a) * island.R * t, z: Math.sin(a) * island.R * t };
	};
	const pick = (count, nearBay, steps, step, R, tries) => {
		const out = [];
		for (let c = 0; c < count; c++) {
			let best = null;
			for (let i = 0; i < tries; i++) {
				const s = start(nearBay), pts = walk(s.x, s.z, r() * 6.283, steps, step, R);
				if (pts && farFromTaken(pts, R * 4 + 6) && (!best || pts.score > best.score)) best = pts;
			}
			if (best) { taken.push(best); out.push(best); }
		}
		return out;
	};
	const tunnels = [...pick(2, true, 26, 1.9, 3.4, 160), ...pick(2, false, 30, 2, 3.8, 160)];
	const arches = [...pick(3, true, 3, 2.2, 4.8, 60), ...pick(3, false, 3, 2.4, 5.5, 60)];

	// ---------- building one ----------
	// a closed ring swept along the line: the floor half sinks into the seabed, the
	// radius swells into chambers and pinches to throats, and some roof panels are gone
	const mat = caveRock(shared);
	const spikes = [], lights = [], holes = [], glows = [], boulders = [];
	const build = (pts, R0, opts) => {
		const P = [], IN = [], I = [], rows = [], orows = [], SIDES = 22, n = pts.length;
		for (let k = 0; k < n; k++) {
			const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
			const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nzv = dx / l;
			const u = k / (n - 1);
			// chambers and throats along the run, flaring at the two mouths
			const chamber = opts.arch ? 1 : 0.75 + 0.6 * Math.pow(nz.vnoise(k * 0.22 + opts.seed, 4.4), 1.5) * 1.6;
			const mouth = 1 + 0.35 * (Math.pow(1 - u * 2, 8));
			const R = R0 * chamber * mouth;
			// how far inside: dark and full of living lights in the middle
			const inside = opts.arch ? 0.15 : Math.min(1, Math.min(k, n - 1 - k) / 5);
			const row = [], orow = [];
			for (let s = 0; s <= SIDES; s++) {
				const th = (s / SIDES) * Math.PI * 2;
				const bump = 0.78 + 0.44 * nz.fbm(k * 0.35 + Math.cos(th) * 1.3 + opts.seed, s * 0.27 + k * 0.12, 3);
				const side = Math.cos(th) * R * 1.15 * bump;
				let up = Math.sin(th) * R * 0.9 * bump;
				const cy = pts[k].y + R * 0.35;                 // the axis rides above the floor line
				const x = pts[k].x + nx * side, z = pts[k].z + nzv * side;
				// the lower half follows the ground down into it
				let y = cy + up;
				if (up < 0) y = Math.min(y, H(x, z) - 0.4);
				P.push(x, y, z);
				IN.push(inside);
				row.push(P.length / 3 - 1);
				// the outer skin: the rock is thick, lumpier outside than in
				const T = R * (0.35 + 0.6 * nz.fbm(k * 0.9 + s * 0.7 + 40 + opts.seed, s * 0.6 - k * 0.4, 4));
				const oside = Math.cos(th) * (R * 1.15 * bump + T), oup = Math.sin(th) * (R * 0.9 * bump + T);
				const ox = pts[k].x + nx * oside, oz = pts[k].z + nzv * oside;
				let oy = cy + oup;
				if (oup < 0) oy = Math.min(oy, H(ox, oz) - 0.6);
				P.push(ox, oy, oz);
				IN.push(0);
				orow.push(P.length / 3 - 1);
				if (oup > -R * 0.2 && r() < (opts.arch ? 0.5 : 0.22)) boulders.push({ x: ox, y: oy, z: oz, s: 0.5 + Math.pow(r(), 2) * R * 0.45 });
				// teeth: a fringe of spikes from the roof, and some rising to meet them
				if (!opts.arch && s % 2 === 0 && k > 1 && k < n - 2 && r() < 0.35) {
					const roof = Math.sin(th);
					if (roof > 0.55) spikes.push({ x, y, z, len: (0.5 + r() * 1.6) * R * 0.3, down: true, r: 0.12 + r() * 0.2 });
					else if (roof < -0.2 && r() < 0.5) { const g = H(x * 0.85 + pts[k].x * 0.15, z * 0.85 + pts[k].z * 0.15); spikes.push({ x: x * 0.85 + pts[k].x * 0.15, y: g, z: z * 0.85 + pts[k].z * 0.15, len: (0.3 + r() * 0.9) * R * 0.25, down: false, r: 0.15 + r() * 0.2 }); }
				}
			}
			rows.push(row);
			orows.push(orow);
		}
		// skylights: a fallen stretch of roof every so often in the long tunnels
		// (ragged: the broken edge wanders from row to row)
		const hole = (k, s) => !opts.arch && k > 3 && k < n - 4 && ((k + opts.seed * 7) % 11 === 0 || (k + opts.seed * 7) % 11 === 1)
			&& s > SIDES * (0.1 + 0.1 * nz.vnoise(k * 0.9, opts.seed + 0.5)) && s < SIDES * (0.3 + 0.12 * nz.vnoise(k * 0.9 + 5, opts.seed));
		const quad = (a, b, c, d) => I.push(a, b, c, b, d, c);
		for (let k = 0; k < n - 1; k++) for (let s = 0; s < SIDES; s++) {
			if (!hole(k, s)) {
				quad(rows[k][s], rows[k][s + 1], rows[k + 1][s], rows[k + 1][s + 1]);
				quad(orows[k][s], orows[k + 1][s], orows[k][s + 1], orows[k + 1][s + 1]);
				continue;
			}
			// the broken edges of a skylight show the rock's thickness
			if (!hole(k, s - 1)) quad(rows[k][s], rows[k + 1][s], orows[k][s], orows[k + 1][s]);
			if (!hole(k, s + 1)) quad(rows[k][s + 1], rows[k + 1][s + 1], orows[k][s + 1], orows[k + 1][s + 1]);
			if (!hole(k - 1, s)) quad(rows[k][s], rows[k][s + 1], orows[k][s], orows[k][s + 1]);
			if (!hole(k + 1, s)) quad(rows[k + 1][s], rows[k + 1][s + 1], orows[k + 1][s], orows[k + 1][s + 1]);
		}
		// the lips of the two mouths
		for (const k of [0, n - 1]) for (let s = 0; s < SIDES; s++) quad(rows[k][s], rows[k][s + 1], orows[k][s], orows[k][s + 1]);
		if (!opts.arch) for (let k = 4; k < n - 4; k++) if ((k + opts.seed * 7) % 11 === 0) holes.push({ x: pts[k].x, y: pts[k].y, z: pts[k].z, R: R0 });
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('aIn', new THREE.Float32BufferAttribute(IN, 1));
		g.setIndex(I);
		g.computeVertexNormals();
		const mesh = new THREE.Mesh(g, mat);
		mesh.castShadow = true; mesh.receiveShadow = true;
		mesh.userData.material175 = 'stone';
		group.add(mesh);
		// living lights clustered on the deep walls, and a soft glow to fill the chamber
		if (!opts.arch) {
			const mid = pts[Math.floor(n / 2)];
			lights.push({ x: mid.x, y: mid.y + R0 * 0.6, z: mid.z });
			for (let k = 3; k < n - 3; k++) for (let j = 0; j < 9; j++) {
				const th = Math.PI * (1.1 + r() * 0.8) + (r() < 0.5 ? 0 : Math.PI * 0.7);
				const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
				const side = Math.cos(th) * R0 * 0.9, x = pts[k].x - (b.z - a.z) / l * side, z = pts[k].z + (b.x - a.x) / l * side;
				glows.push({ x, y: H(x, z) + 0.04 + r() * 0.1, z, s: 0.025 + r() * 0.05, c: r() });
			}
		}
	};
	tunnels.forEach((pts, i) => build(pts, 3.4 + (i > 1 ? 0.4 : 0), { seed: i + 1, arch: false }));
	arches.forEach((pts, i) => build(pts, 4.8 + r() * 1.2, { seed: i + 11, arch: true }));

	const instRock = () => {
		const m = caveRock(shared);
		// instanced: the shader's world position must include the instance
		m.onBeforeCompile = ((f) => (sh) => { f(sh); sh.vertexShader = sh.vertexShader.replace('vC = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vC = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;'); })(m.onBeforeCompile);
		m.customProgramCacheKey = () => 'caverock233i';
		return m;
	};

	// ---------- boulders heaped on the outside, so it reads as rock, not a shell ----------
	if (boulders.length) {
		const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.75 + nz.fbm(x * 1.3 + 9, z * 1.3 + y, 3) * 0.5; p.setXYZ(i, x * k * 1.2, y * k * 0.75, z * k); }
		geo.computeVertexNormals();
		geo.setAttribute('aIn', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
		const im = new THREE.InstancedMesh(geo, instRock(), boulders.length);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
		boulders.forEach((o, i) => { e.set((r() - 0.5) * 0.8, r() * 6.28, (r() - 0.5) * 0.8); q.setFromEuler(e); s.set(o.s, o.s * (0.6 + r() * 0.5), o.s); v.set(o.x, o.y - o.s * 0.3, o.z); im.setMatrixAt(i, m4.compose(v, q, s)); });
		im.castShadow = true; im.receiveShadow = true;
		im.userData.material175 = 'stone';
		group.add(im);
	}

	// ---------- teeth ----------
	if (spikes.length) {
		const cone = new THREE.ConeGeometry(1, 1, 7, 3);
		{ const p = cone.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.8 + 0.4 * Math.sin(i * 1.7); p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k); } cone.computeVertexNormals(); }
		cone.translate(0, 0.5, 0);
		cone.setAttribute('aIn', new THREE.Float32BufferAttribute(new Float32Array(cone.attributes.position.count).fill(0.6), 1));
		const im = new THREE.InstancedMesh(cone, instRock(), spikes.length);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
		spikes.forEach((o, i) => {
			e.set(o.down ? Math.PI + (r() - 0.5) * 0.3 : (r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3);
			q.setFromEuler(e); s.set(o.r, o.len, o.r); p.set(o.x, o.down ? o.y + 0.3 : o.y - 0.15, o.z);
			im.setMatrixAt(i, m4.compose(p, q, s));
		});
		im.castShadow = true;
		im.userData.material175 = 'stone';
		group.add(im);
	}

	// ---------- living lights on the floor: small glowing sea anemones ----------
	if (glows.length) {
		const g = new THREE.SphereGeometry(1, 8, 6);
		const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
		const im = new THREE.InstancedMesh(g, m, glows.length);
		const m4 = new THREE.Matrix4(), c = new THREE.Color();
		glows.forEach((o, i) => {
			im.setMatrixAt(i, m4.makeScale(o.s, o.s * 0.7, o.s).setPosition(o.x, o.y, o.z));
			im.setColorAt(i, c.setRGB(0.1 + o.c * 0.25, 0.7 - o.c * 0.25, 0.6 + o.c * 0.3));
		});
		group.add(im);
	}

	// ---------- daylight falling through the broken roofs ----------
	const shaftMat = new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime },
		vertexShader: 'varying vec2 vU; varying float vY; void main(){ vU = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime; varying vec2 vU;
			void main(){
				float edge = sin(vU.x * 3.14159 * 6.0) * 0.5 + 0.5;
				float ray = 0.6 + 0.4 * sin(vU.x * 23.0 + uTime * 0.4) * sin(vU.x * 9.0 - uTime * 0.25);
				float a = smoothstep(0.0, 0.35, vU.y) * smoothstep(1.0, 0.7, vU.y) * ray * (0.5 + 0.5 * edge) * 0.16;
				gl_FragColor = vec4(vec3(0.55, 0.85, 0.8) * a, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	for (const h of holes) {
		const top = -0.5, len = top - h.y;
		const cyl = new THREE.CylinderGeometry(h.R * 0.7, h.R * 0.95, len, 16, 1, true);
		const m = new THREE.Mesh(cyl, shaftMat);
		m.position.set(h.x, h.y + len / 2, h.z);
		m.renderOrder = 8;
		group.add(m);
	}

	// one soft blue-green light that follows you to the nearest chamber
	// (the light count never changes, so no shader rebuild)
	const glowLight = new THREE.PointLight(0x40e0c8, 0, 18, 1.8);
	group.add(glowLight);

	function update(dt, t, under) {
		const cam = camera.position;
		let best = null, bd = 1e9;
		for (const L of lights) { const d = Math.hypot(L.x - cam.x, L.y - cam.y, L.z - cam.z); if (d < bd) { bd = d; best = L; } }
		if (best && under && bd < 40) {
			glowLight.position.set(best.x, best.y, best.z);
			glowLight.intensity = (6 + Math.sin(t * 0.7) * 1.5 + shared.uBass.value * 4) * Math.min(1, (40 - bd) / 15);
		} else glowLight.intensity = 0;
	}
	return { update, group, tunnels, arches };
}
