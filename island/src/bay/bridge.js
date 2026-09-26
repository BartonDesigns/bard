// The Golden Gate Bridge, at its real dimensions: towers 227 m above the water, a
// 1,280 m main span and two 343 m side spans, the roadway some 67 m over the strait,
// main cables sagging 144 m between the tower tops, a suspender every 15.24 m, the
// stiffening truss under the deck, the art-deco portal struts stacked up each tower.
// International Orange. At night the towers are floodlit, sodium lamps run along the
// deck and red lights burn on the tower tops. You can walk and drive across it.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ORANGE = new THREE.Color('#c0362c');
const MAIN = 1280, SIDE = 343, TOWER_H = 227, HALF_W = 13.7, LEG_T = 14.6;
// midspan, and the bridge's heading (degrees east of north): it runs NNW to Marin
const MID = { lat: 37.81992, lon: -122.47829 }, BEARING = -10.8;

export function createGoldenGate(shared, scene, heightAt) {
	const group = new THREE.Group();
	group.name = 'golden-gate';
	const c = toWorld(MID.lat, MID.lon);
	const b = BEARING * Math.PI / 180;
	const ax = new THREE.Vector2(Math.sin(b), -Math.cos(b));           // along the bridge, toward Marin
	const lat = new THREE.Vector2(-ax.y, ax.x);                          // across it
	// bridge frame -> world: s along, t across
	const W = (s, t, y) => new THREE.Vector3(c.x + ax.x * s + lat.x * t, y, c.z + ax.y * s + lat.y * t);
	group.position.set(0, 0, 0);
	const END = MAIN / 2 + SIDE;                                        // anchorages
	// the roadway rises gently to midspan
	const deckY = (s) => 64 + 5.5 * Math.max(0, 1 - (s / END) * (s / END));
	const cableY = (s) => {
		const a = Math.abs(s);
		if (a <= MAIN / 2) { const u = a / (MAIN / 2); return deckY(s) + 6 + (TOWER_H - 3 - deckY(s) - 6) * u * u; }
		// side spans: a shallow sag from the tower top down to the anchorage
		const u = (a - MAIN / 2) / SIDE, top = TOWER_H - 3, low = deckY(END) + 10;
		return top + (low - top) * u - 22 * u * (1 - u);
	};

	const steel = new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.55, metalness: 0.25 });
	const concrete = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.9 });
	const road = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.85, side: THREE.DoubleSide });
	// every box goes into one merged mesh per material (a few draws for the whole bridge)
	const parts = new Map();
	const heading = Math.atan2(ax.x, ax.y);
	const box = (s, t, y, ls, lt, ly, mat, rotZ = 0) => {
		const g = new THREE.BoxGeometry(lt, ly, ls);
		const m4 = new THREE.Matrix4().compose(W(s, t, y), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1));
		g.applyMatrix4(m4);
		if (!parts.has(mat)) parts.set(mat, []);
		parts.get(mat).push(g);
	};

	// ---------- towers ----------
	for (const s0 of [-MAIN / 2, MAIN / 2]) {
		const base = Math.min(0, heightAt(W(s0, 0, 0).x, W(s0, 0, 0).z));
		// the pier and fender ring at the water
		box(s0, 0, base / 2 - 2 + 6, 42, 60, Math.abs(base) + 16, concrete);
		// two legs, stepping in at each portal
		const steps = [[8, 16, 10.5], [60, 15, 10], [100, 13.5, 9], [135, 12, 8], [170, 10.5, 7.2], [205, 9.5, 6.6], [TOWER_H, 9, 6.2]];
		for (const sd of [-1, 1]) {
			let y0 = 8;
			for (const [y1, ls, lt] of steps.slice(1)) {
				box(s0, sd * LEG_T, (y0 + y1) / 2, ls, lt, y1 - y0, steel);
				// recessed art-deco fluting on the outer faces: darker vertical panels
				box(s0, sd * (LEG_T + lt / 2 + 0.05), (y0 + y1) / 2, ls * 0.55, 0.3, (y1 - y0) * 0.86, steel);
				y0 = y1;
			}
		}
		// portal struts above the deck, and the cap
		for (const [y, hgt] of [[98, 9], [132, 8], [167, 7.5], [201, 7], [TOWER_H - 3, 6]]) {
			box(s0, 0, y, 7, LEG_T * 2, hgt, steel);
			// stepped art-deco panel on each strut face
			box(s0, 0, y, 7.6, LEG_T * 1.2, hgt * 0.55, steel);
		}
		// below the deck: a strut and X-bracing between the legs
		box(s0, 0, 52, 8, LEG_T * 2, 6, steel);
		for (const sg of [-1, 1]) box(s0, 0, 30, 3, 34, 2.4, steel, sg * 0.75);
		// saddles on top where the cables ride over
		for (const sd of [-1, 1]) box(s0, sd * HALF_W, TOWER_H + 1, 10, 3, 3, steel);
	}
	// ---------- anchorages and approach piers ----------
	for (const sg of [-1, 1]) {
		const s = sg * END, p = W(s, 0, 0), g = heightAt(p.x, p.z);
		box(s, 0, (g + deckY(s) + 10) / 2, 40, 45, Math.max(8, deckY(s) + 10 - g), concrete);
		// approach viaduct piers onto the land
		for (let k = 1; k <= 4; k++) { const s2 = s + sg * k * 45, q = W(s2, 0, 0), g2 = heightAt(q.x, q.z); if (deckY(s2) - g2 > 3) box(s2, 0, (g2 + deckY(s2)) / 2, 5, 22, deckY(s2) - g2, steel); }
	}

	// ---------- the deck: roadway, sidewalks, rails, and the stiffening truss ----------
	const S0 = -END - 190, S1 = END + 190, STEP = 15.24;
	{
		const P = [], I = [], N = [], ring = (s) => {
			const y = deckY(Math.max(-END, Math.min(END, s)));
			return [W(s, -HALF_W, y), W(s, HALF_W, y)];
		};
		const top = new THREE.BufferGeometry(), pts = [];
		for (let s = S0; s <= S1 + 0.1; s += STEP) pts.push(ring(s));
		for (const [a, b2] of pts) { P.push(a.x, a.y + 0.6, a.z, b2.x, b2.y + 0.6, b2.z); N.push(0, 1, 0, 0, 1, 0); }
		for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
		top.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); top.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); top.setIndex(I);
		const roadMesh = new THREE.Mesh(top, road);
		roadMesh.receiveShadow = true;
		group.add(roadMesh);
		// the truss: two 7.6 m deep sides of Warren trusses, drawn with a texture
		const tc = document.createElement('canvas'); tc.width = 256; tc.height = 64;
		const g2 = tc.getContext('2d'); g2.clearRect(0, 0, 256, 64); g2.strokeStyle = '#fff'; g2.lineWidth = 5;
		g2.strokeRect(2, 3, 252, 58);
		g2.beginPath(); for (let i = 0; i <= 4; i++) { g2.moveTo(i * 64, 60); g2.lineTo(i * 64 + 32, 4); g2.lineTo(i * 64 + 64, 60); } g2.stroke();
		g2.beginPath(); for (let i = 0; i <= 8; i++) { g2.moveTo(i * 32, 4); g2.lineTo(i * 32, 60); } g2.lineWidth = 2.5; g2.stroke();
		const tt = new THREE.CanvasTexture(tc); tt.wrapS = THREE.RepeatWrapping; tt.colorSpace = THREE.SRGBColorSpace;
		const trussMat = new THREE.MeshStandardMaterial({ color: ORANGE, map: tt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.2 });
		for (const sd of [-1, 1]) {
			const P2 = [], U2 = [], I2 = [];
			pts.forEach(([a, b2], k) => { const e = sd < 0 ? a : b2; P2.push(e.x, e.y + 0.6, e.z, e.x, e.y - 7.6, e.z); U2.push(k * STEP / 30.5, 1, k * STEP / 30.5, 0); });
			for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; I2.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
			const gg = new THREE.BufferGeometry();
			gg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2)); gg.setIndex(I2); gg.computeVertexNormals();
			const tm = new THREE.Mesh(gg, trussMat); tm.castShadow = true; group.add(tm);
		}
		// the underside and the rails
		for (const [t, y, w, h] of [[0, -7.6, HALF_W * 2, 0.8], [-HALF_W + 0.4, 1.4, 0.3, 1.3], [HALF_W - 0.4, 1.4, 0.3, 1.3], [-10.5, 0.9, 0.5, 0.6], [10.5, 0.9, 0.5, 0.6]]) {
			for (let k = 0; k < pts.length - 1; k++) {
				const s = S0 + (k + 0.5) * STEP, y0 = deckY(Math.max(-END, Math.min(END, s)));
				if (t === 0 && Math.abs(s) > END) continue;
				box(s, t, y0 + y, STEP + 0.05, w, h, steel);
			}
		}
	}

	// ---------- main cables and suspenders ----------
	const suspenders = [];
	for (const sd of [-1, 1]) {
		const curvePts = [];
		for (let s = -END; s <= END + 0.1; s += STEP) curvePts.push(W(s, sd * HALF_W, cableY(s)));
		const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), curvePts.length * 2, 0.46, 8, false), steel);
		tube.castShadow = true;
		group.add(tube);
		for (let s = -END + STEP; s < END; s += STEP) {
			if (Math.abs(Math.abs(s) - MAIN / 2) < 8) continue;
			const y0 = deckY(s) + 0.6, y1 = cableY(s);
			if (y1 - y0 > 1.5) suspenders.push({ p: W(s, sd * HALF_W, (y0 + y1) / 2), h: y1 - y0 });
		}
	}
	{
		const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 5), steel, suspenders.length);
		const m4 = new THREE.Matrix4();
		suspenders.forEach((o, i) => im.setMatrixAt(i, m4.makeScale(1, o.h, 1).setPosition(o.p)));
		group.add(im);
	}

	// ---------- night: floodlit towers, deck lamps, red lights on top ----------
	const lampPos = [], redPos = [];
	for (let s = -END; s <= END; s += 30.5) for (const sd of [-1, 1]) { const p = W(s, sd * (HALF_W - 0.5), deckY(s) + 9); lampPos.push(p.x, p.y, p.z); }
	for (const s0 of [-MAIN / 2, MAIN / 2]) for (const sd of [-1, 1]) { const p = W(s0, sd * LEG_T, TOWER_H + 3); redPos.push(p.x, p.y, p.z); }
	const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
	const pointsOf = (arr, color, size) => {
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
		const m = new THREE.PointsMaterial({ color, size, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: true, toneMapped: false });
		const pts = new THREE.Points(g, m); pts.frustumCulled = false; group.add(pts); return m;
	};
	const lamps = pointsOf(lampPos, 0xffb05a, 9), reds = pointsOf(redPos, 0xff2010, 14);

	for (const [mat, list] of parts) {
		const m = new THREE.Mesh(mergeGeometries(list), mat);
		m.castShadow = true; m.receiveShadow = true;
		group.add(m);
	}
	scene.add(group);

	// walking and driving on the deck: the floor under (x, z) at height y, or -Infinity
	function deckFloor(x, z, y) {
		const dx = x - c.x, dz = z - c.z, s = dx * ax.x + dz * ax.y, t = dx * lat.x + dz * lat.y;
		if (Math.abs(t) > HALF_W - 0.6 || s < S0 || s > S1) return -Infinity;
		const d = deckY(Math.max(-END, Math.min(END, s))) + 0.6;
		return y > d - 3 ? d : -Infinity;
	}
	function update(t, night) {
		group.visible = true;
		lamps.opacity = night;
		reds.opacity = night * (0.6 + 0.4 * (Math.sin(t * 3) > 0 ? 1 : 0.2));
		steel.emissive.copy(ORANGE).multiplyScalar(0.18 * night);
		// the anchorages catch the floodlights and the deck lamps' spill (unlit, they read as black holes)
		concrete.emissive.setRGB(0.16, 0.14, 0.11).multiplyScalar(night);
	}
	return { group, update, deckFloor, centre: c, axis: ax, length: S1 - S0 };
}
