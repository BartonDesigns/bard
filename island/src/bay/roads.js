// The freeways and the Iron Horse Trail, laid on the real ground. Each route is a
// line of waypoints along its real course; between them the road is resampled every
// 25 m, its grade smoothed (cut and fill, never climbing a hillside), and drawn as a
// strip of asphalt with lane markings and shoulders. At night sodium lamps line the
// freeways and streams of headlights and tail lights move along them.

import * as THREE from 'three';
import { toWorld } from './geo.js';

// [lat, lon] waypoints, following the real alignments
export const ROUTES = {
	'I-680': [[37.9060, -122.0650], [37.8800, -122.0550], [37.8520, -122.0330], [37.8300, -122.0100], [37.8110, -121.9975], [37.7960, -121.9870], [37.7790, -121.9770], [37.7680, -121.9660], [37.7560, -121.9600], [37.7430, -121.9540], [37.7250, -121.9420], [37.7035, -121.9250], [37.6830, -121.9110], [37.6630, -121.8980], [37.6350, -121.8850], [37.6060, -121.8750], [37.5700, -121.8950], [37.5320, -121.9190], [37.4850, -121.9050], [37.4400, -121.8750], [37.3950, -121.8600], [37.3440, -121.8530]],
	'I-580': [[37.7010, -121.8000], [37.7040, -121.8700], [37.7035, -121.9250], [37.7000, -121.9700], [37.6960, -122.0200], [37.6960, -122.0720], [37.7150, -122.1100], [37.7400, -122.1400], [37.7620, -122.1680], [37.7850, -122.2050], [37.8050, -122.2380], [37.8150, -122.2650], [37.8250, -122.2930]],
	'SR-24': [[37.8990, -122.0630], [37.8960, -122.0900], [37.8920, -122.1180], [37.8850, -122.1550], [37.8800, -122.1850], [37.8680, -122.2020], [37.8570, -122.2140], [37.8450, -122.2400], [37.8270, -122.2680]],
	'I-80': [[37.8250, -122.2930], [37.8390, -122.2960], [37.8540, -122.2990], [37.8700, -122.3030], [37.8930, -122.3080], [37.9150, -122.3150], [37.9290, -122.3200], [37.9600, -122.3180], [37.9950, -122.2980], [38.0090, -122.2590], [38.0300, -122.2380], [38.0540, -122.2280]],
	'I-880': [[37.8000, -122.2900], [37.7850, -122.2600], [37.7700, -122.2350], [37.7400, -122.2050], [37.7100, -122.1800], [37.6800, -122.1450], [37.6500, -122.1100], [37.6000, -122.0650], [37.5500, -122.0200], [37.4900, -121.9500], [37.4300, -121.9200], [37.3700, -121.9200]],
	'US-101': [[37.7700, -122.4200], [37.7500, -122.4050], [37.7200, -122.3970], [37.6800, -122.3920], [37.6500, -122.4020], [37.6300, -122.4000], [37.6000, -122.3700], [37.5600, -122.3050], [37.5200, -122.2600], [37.4900, -122.2150], [37.4650, -122.1700], [37.4400, -122.1300], [37.4100, -122.0700], [37.3900, -121.9900], [37.3700, -121.9400], [37.3600, -121.9000]],
	'US-101 Marin': [[37.8330, -122.4830], [37.8450, -122.4900], [37.8580, -122.5000], [37.8700, -122.5130], [37.8900, -122.5150], [37.9250, -122.5150], [37.9500, -122.5200], [37.9700, -122.5250], [38.0200, -122.5400], [38.0900, -122.5500]],
	'I-280': [[37.7600, -122.3950], [37.7300, -122.4200], [37.7050, -122.4650], [37.6700, -122.4700], [37.6300, -122.4400], [37.6000, -122.4150], [37.5500, -122.3700], [37.5000, -122.3000], [37.4600, -122.2400], [37.4150, -122.1900], [37.3800, -122.1300], [37.3600, -122.1000], [37.3400, -122.0400], [37.3200, -121.9500]],
};
// the Iron Horse Trail: the old Southern Pacific line through the San Ramon Valley
export const TRAIL = [[37.9050, -122.0600], [37.8600, -122.0270], [37.8216, -121.9994], [37.8050, -121.9890], [37.7897, -121.9784], [37.7780, -121.9710], [37.7687, -121.9640], [37.7560, -121.9560], [37.7440, -121.9480], [37.7260, -121.9370], [37.7070, -121.9270]];

function resample(pts, step) {
	const out = [];
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i], b = pts[i + 1], p0 = pts[Math.max(0, i - 1)], p3 = pts[Math.min(pts.length - 1, i + 2)];
		const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / step));
		for (let k = 0; k < n; k++) {
			// Catmull-Rom through the waypoints: roads bend, they do not kink
			const t = k / n, t2 = t * t, t3 = t2 * t;
			const f = (q0, q1, q2, q4) => 0.5 * (2 * q1 + (-q0 + q2) * t + (2 * q0 - 5 * q1 + 4 * q2 - q4) * t2 + (-q0 + 3 * q1 - 3 * q2 + q4) * t3);
			out.push({ x: f(p0.x, a.x, b.x, p3.x), z: f(p0.z, a.z, b.z, p3.z) });
		}
	}
	out.push({ ...pts[pts.length - 1] });
	return out;
}

export function createRoads(shared, scene, bay) {
	const group = new THREE.Group();
	group.name = 'bay-roads';
	scene.add(group);
	const night = { value: 0 };
	const roadMat = new THREE.MeshStandardMaterial({ color: 0x3b3b3d, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	roadMat.onBeforeCompile = (sh) => {
		sh.uniforms.uNightR = night;
		sh.vertexShader = 'attribute vec2 aRoad; varying vec2 vRoad;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvRoad = aRoad;');
		sh.fragmentShader = 'uniform float uNightR; varying vec2 vRoad;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				// vRoad.x across (0..1), vRoad.y along (metres); trail is flagged by y < -1e5
				float across = vRoad.x;
				if (vRoad.y > -1e5) {
					float lanes = 8.0, lane = fract(across * lanes);
					float dash = step(0.5, fract(vRoad.y / 12.0));
					float mark = step(lane, 0.03) * dash * step(0.08, across) * step(across, 0.92) * (1.0 - step(0.47, across) * step(across, 0.53));
					float edge = step(abs(across - 0.06), 0.008) + step(abs(across - 0.94), 0.008);
					float median = step(0.47, across) * step(across, 0.53);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.9, 0.85), clamp(mark + edge, 0.0, 1.0));
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.56), median);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.48, 0.44), step(across, 0.04) + step(0.96, across));
				} else diffuseColor.rgb = vec3(0.5, 0.47, 0.42);
			}`);
	};
	roadMat.customProgramCacheKey = () => 'bayroad';

	const lampPos = [], carPos = [], carDir = [], carCol = [];
	const build = (latlon, width, trail) => {
		const pts = resample(latlon.map(([a, b]) => toWorld(a, b)), 25);
		// grade: follow the ground, smoothed hard so the road cuts through bumps and bridges dips
		let y = pts.map((p) => Math.max(bay.heightAt(p.x, p.z), 1.5));
		for (let pass = 0; pass < 6; pass++) y = y.map((v, i) => (y[Math.max(0, i - 2)] + y[Math.max(0, i - 1)] + v + y[Math.min(y.length - 1, i + 1)] + y[Math.min(y.length - 1, i + 2)]) / 5);
		const P = [], R = [], I = [];
		let along = 0;
		pts.forEach((p, i) => {
			const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
			const nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
			if (i) along += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
			// sit on the ground where it is higher at the edges, so the strip is never buried
			for (const s of [-1, 1]) {
				const ex = p.x + nx * width / 2 * s, ez = p.z + nz * width / 2 * s;
				P.push(ex, Math.max(y[i], bay.heightAt(ex, ez) + 0.3) + 0.35, ez);
				R.push(s < 0 ? 0 : 1, trail ? -2e5 : along);
			}
			if (i) { const k = (i - 1) * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
			if (!trail && i % 3 === 0) {
				for (const s of [-1, 1]) lampPos.push(p.x + nx * (width / 2 + 1) * s, y[i] + 11, p.z + nz * (width / 2 + 1) * s);
				// traffic: a car every so often on each side
				for (const s of [-1, 1]) if ((i * 7 + (s > 0 ? 3 : 0)) % 5 < 2) { carPos.push(p.x + nx * width * 0.25 * s, y[i] + 1.1, p.z + nz * width * 0.25 * s); carDir.push((b.x - a.x) / l * -s, (b.z - a.z) / l * -s, i); carCol.push(s > 0 ? 1 : 0); }
			}
		});
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('aRoad', new THREE.Float32BufferAttribute(R, 2));
		g.setIndex(I);
		g.computeVertexNormals();
		const m = new THREE.Mesh(g, roadMat);
		m.receiveShadow = true;
		group.add(m);
	};
	for (const k in ROUTES) build(ROUTES[k], 34, false);
	build(TRAIL, 4, true);

	// sodium lamps along the freeways, and moving car lights
	const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
	const lampG = new THREE.BufferGeometry(); lampG.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
	const lampM = new THREE.PointsMaterial({ color: 0xffa040, size: 10, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
	const lamps = new THREE.Points(lampG, lampM); lamps.frustumCulled = false; group.add(lamps);
	// cars: each point slides back and forth along its own stretch of road
	const carG = new THREE.BufferGeometry();
	const base = new Float32Array(carPos), cur = new Float32Array(carPos), cols = [];
	for (const c of carCol) cols.push(...(c ? [1, 0.95, 0.85] : [1, 0.12, 0.06]));
	carG.setAttribute('position', new THREE.BufferAttribute(cur, 3));
	carG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
	const carM = new THREE.PointsMaterial({ size: 5, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
	const cars = new THREE.Points(carG, carM); cars.frustumCulled = false; group.add(cars);

	function update(t, nightK) {
		night.value = nightK;
		lampM.opacity = nightK;
		carM.opacity = 0.2 + nightK * 0.8;
		// traffic moves at about 25 m/s, looping over 75 m so it never leaves its road
		const n = cur.length / 3;
		for (let i = 0; i < n; i++) {
			const d = ((t * 25 + carDir[i * 3 + 2] * 13) % 75) - 37.5;
			cur[i * 3] = base[i * 3] + carDir[i * 3] * d; cur[i * 3 + 2] = base[i * 3 + 2] + carDir[i * 3 + 1] * d;
		}
		carG.attributes.position.needsUpdate = true;
	}
	return { group, update };
}
