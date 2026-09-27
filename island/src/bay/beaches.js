// The beaches and viewpoints along Highway 1, from Pacifica to Año Nuevo, laid out the way
// the state parks lay them out: a lot on the bluff above with a brown routed-wood park
// sign at its entrance and a concrete restroom, a path down to the sand. Some are busy
// (Linda Mar's surf, the Half Moon Bay campground, San Gregorio's driftwood forts on a
// Sunday); some are kept quiet (Gray Whale Cove, Martins, Tunitas Creek, Bean Hollow, the
// elephant seal beaches at Año Nuevo), with a small lot or none and few people.
// Where people camp: dome, tunnel and A-frame tents and pop-up shades, each with its gear
// inside (a cooler, sleeping bags, a lantern that glows at night) and chairs out front round
// a stone fire ring whose fire flickers after dark. Where people surf: the lifeguards'
// checkered surf-zone flags on the sand and surfers waiting and riding in the lineup.
// Pigeon Point's lighthouse stands on its point. Each beach is built when you come near.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { carGeometry, carMaterial } from './cars.js';

// [name, lat, lon, {lot cars, restroom, tents, fires, surf surfers, quiet, forts, seals, light}]
const SITES = [
	['Linda Mar Beach', 37.5945, -122.5028, { lot: 34, restroom: 1, surf: 9 }],
	['Montara State Beach', 37.5450, -122.5150, { lot: 14, restroom: 1, surf: 3 }],
	['Gray Whale Cove State Beach', 37.5645, -122.5132, { lot: 6, quiet: 1 }],
	['Mavericks · Pillar Point', 37.4945, -122.4985, { lot: 16, restroom: 1, surf: 4, big: 1 }],
	['Half Moon Bay State Beach', 37.4660, -122.4452, { lot: 26, restroom: 1, tents: 16, fires: 6 }],
	['Poplar Beach', 37.4560, -122.4470, { lot: 10, quiet: 1 }],
	['Martins Beach', 37.3740, -122.4060, { quiet: 1 }],
	['Tunitas Creek Beach', 37.3580, -122.4005, { lot: 4, quiet: 1 }],
	['San Gregorio State Beach', 37.3225, -122.4020, { lot: 22, restroom: 1, forts: 7, fires: 2, tents: 3 }],
	['Pomponio State Beach', 37.2990, -122.4060, { lot: 8, restroom: 1, quiet: 1 }],
	['Pescadero State Beach', 37.2665, -122.4125, { lot: 14, restroom: 1, surf: 2 }],
	['Bean Hollow State Beach', 37.2262, -122.4095, { lot: 5, quiet: 1 }],
	['Pigeon Point Light Station', 37.1820, -122.3935, { lot: 12, restroom: 1, light: 1 }],
	['Año Nuevo State Park', 37.1105, -122.3300, { lot: 18, restroom: 1, quiet: 1, seals: 30 }],
].map(([name, lat, lon, o]) => ({ name, lat, lon, ...o, ...toWorld(lat, lon) }));
export const BEACHES = SITES;

const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const M = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// the park sign's face: brown routed wood, cream letters
function signTexture(lines) {
	const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
	const g = cv.getContext('2d');
	g.fillStyle = '#4a3222'; g.fillRect(0, 0, 512, 160);
	for (let y = 0; y < 160; y += 3) { g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; g.fillRect(0, y, 512, 1); }
	g.strokeStyle = '#e9dcb8'; g.lineWidth = 4; g.strokeRect(10, 10, 492, 140);
	g.fillStyle = '#efe3c2'; g.textAlign = 'center'; g.textBaseline = 'middle';
	const big = lines[0].length > 22 ? 34 : 42;
	g.font = `bold ${big}px Georgia, serif`; g.fillText(lines[0].toUpperCase(), 256, lines[1] ? 62 : 80);
	if (lines[1]) { g.font = '24px Georgia, serif'; g.fillText(lines[1], 256, 112); }
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
// the lot's painted stalls
function lotTexture() {
	const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
	const g = cv.getContext('2d');
	g.fillStyle = '#4b4a48'; g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
	g.fillStyle = '#d8d6cf';
	for (let x = 0; x <= 256; x += 256 / 10) { g.fillRect(x - 1, 0, 3, 88); g.fillRect(x - 1, 168, 3, 88); }
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

export function createBeaches(scene, bay, real, shared, { isPhone = false } = {}) {
	const root = new THREE.Group();
	root.name = 'beaches';
	scene.add(root);
	const built = new Map();
	const night = { value: 0 };
	const mats = {
		concrete: M(0xb8b2a6, 0.9), roof: M(0x5b4a3c, 0.8), door: M(0x3d4a52, 0.6), post: M(0x3a2a1c, 0.9), rock: M(0x5e5850, 0.95, { flatShading: true }),
		log: M(0x5a3e28, 0.95), drift: M(0x9c9486, 0.95), cooler: M(0x2f6fb0, 0.5), lid: M(0xf2f2ee, 0.5), bag: M(0x2e5a3a, 0.8), chair: M(0x324a6a, 0.7),
		lantern: M(0x222222, 0.5, { emissive: new THREE.Color(0xffc070), emissiveIntensity: 0 }), flame: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
		pole: M(0x9a9a9a, 0.4, { metalness: 0.6 }), board: M(0xf4efe4, 0.4), wetsuit: M(0x111214, 0.6), seal: M(0x6b6660, 0.5), white: M(0xf2f0ea, 0.6), black: M(0x1b1c1e, 0.5),
	};
	const tentCols = [0xd9772b, 0x2d6fa6, 0x5b8a3a, 0xc9b23a, 0xb03a3a, 0x7a5aa0, 0x3a8a8a, 0xe0e0d8];
	const carMat = carMaterial(night), carKinds = ['sedan', 'suv', 'pickup', 'van', 'hatch'];
	const carGeo = Object.fromEntries(carKinds.map((k) => [k, carGeometry(k, 24, 10)]));
	const lotTex = lotTexture();
	const Y = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();

	// the ground's slope round a point
	const g = (x, z) => bay.heightAt(x, z);
	const slope = (x, z) => Math.hypot(g(x + 6, z) - g(x - 6, z), g(x, z + 6) - g(x, z - 6)) / 12;

	function build(S) {
		const B = { S, group: new THREE.Group(), fires: [], lanterns: [], surfers: [], seals: [] };
		root.add(B.group);
		const G = B.group, add = (mesh) => { mesh.castShadow = !isPhone; mesh.receiveShadow = true; G.add(mesh); return mesh; };
		let seed = 1;
		const rnd = () => hh(S.x * 0.013 + seed++ * 0.71, S.z * 0.017 - seed * 0.37);
		// the sand, the sea beyond it, and the bluff behind
		let sand = null, sea = null, lot = null, bestL = 1e9;
		for (let k = 0; k < 900; k++) {
			const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 380, x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r, h = g(x, z);
			if (h > 0.5 && h < 3.2 && slope(x, z) < 0.12 && (!sand || r < sand.r)) sand = { x, z, r };
			if (h < -2.5 && h > -9 && (!sea || r < sea.r)) sea = { x, z, r };
		}
		if (!sand) sand = { x: S.x, z: S.z };
		if (S.lot) {
			const roads = real?.near ? real.near('roads', sand.x, sand.z, 500).filter((r) => r.drive) : [];
			for (let k = 0; k < 700; k++) {
				const a = rnd() * Math.PI * 2, r = 30 + Math.sqrt(rnd()) * 360, x = sand.x + Math.cos(a) * r, z = sand.z + Math.sin(a) * r, h = g(x, z);
				if (h < 3.5 || h > 60 || slope(x, z) > 0.07) continue;
				let dRoad = 200;
				for (const rd of roads) for (let i = 0; i < rd.pts.length; i += 2) dRoad = Math.min(dRoad, Math.hypot(rd.pts[i] - x, rd.pts[i + 1] - z));
				if (dRoad < 14) continue;
				const cost = r + dRoad * 1.5;
				if (cost < bestL) { bestL = cost; lot = { x, z, h, dRoad }; }
			}
		}
		const toSea = sea ? Math.atan2(sea.x - sand.x, sea.z - sand.z) : 0;

		// ---------- the lot, its cars, the sign and the restroom ----------
		if (lot) {
			const face = Math.atan2(sand.x - lot.x, sand.z - lot.z), W = S.lot > 16 ? 44 : 30, D = 26;
			let top = -1e9;
			for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const c = Math.cos(face), s = Math.sin(face); top = Math.max(top, g(lot.x + (u * W / 2) * c + (v * D / 2) * s, lot.z - (u * W / 2) * s + (v * D / 2) * c)); }
			const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 1.6, D), [mats.concrete, mats.concrete, new THREE.MeshStandardMaterial({ map: lotTex, roughness: 0.92 }), mats.concrete, mats.concrete, mats.concrete]);
			slab.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = v * (W / 30); });
			slab.position.set(lot.x, top + 0.08 - 0.8, lot.z); slab.rotation.y = face;
			add(slab);
			B.lotTop = top + 0.08; B.lot = { x: lot.x, z: lot.z, W, D, face };
			// cars in the stalls, by how busy the beach is
			const byKind = {};
			const fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face)), side = new THREE.Vector3(Math.cos(face), 0, -Math.sin(face));
			for (let i = 0; i < Math.min(S.lot, 20); i++) {
				if (rnd() < (S.quiet ? 0.6 : 0.25)) continue;
				const row = i % 2 ? 1 : -1, col = Math.floor(i / 2), u = -W / 2 + (col + 0.5) * (W / 10);
				if (Math.abs(u) > W / 2 - 1) continue;
				const k = carKinds[Math.floor(rnd() * carKinds.length)];
				(byKind[k] ||= []).push([lot.x + side.x * u + fwd.x * row * (D / 2 - 3.2), lot.z + side.z * u + fwd.z * row * (D / 2 - 3.2), face + (row > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.06, rnd()]);
			}
			for (const [k, L] of Object.entries(byKind)) {
				const im = new THREE.InstancedMesh(carGeo[k], carMat, L.length);
				im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.length * 3), 3);
				const PAINT = [[0.92, 0.92, 0.91], [0.06, 0.06, 0.07], [0.36, 0.37, 0.39], [0.66, 0.67, 0.69], [0.12, 0.22, 0.45], [0.55, 0.08, 0.07], [0.3, 0.36, 0.26]];
				L.forEach(([x, z, a, r], i) => { im.setMatrixAt(i, m4.compose(p.set(x, B.lotTop, z), q.setFromAxisAngle(Y, a), sc.set(1, 1, 1))); const c = PAINT[Math.floor(r * PAINT.length)]; im.instanceColor.setXYZ(i, c[0], c[1], c[2]); });
				add(im);
			}
			// the park sign, at the lot's entrance on the road side
			const sx = lot.x - fwd.x * (D / 2 + 3) + side.x * (W / 2 - 4), sz = lot.z - fwd.z * (D / 2 + 3) + side.z * (W / 2 - 4), sy = g(sx, sz);
			const sign = new THREE.Group();
			const face2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.06, 0.14), [mats.post, mats.post, mats.post, mats.post, new THREE.MeshStandardMaterial({ map: signTexture(S.quiet ? [S.name, 'Natural area · please stay on the trail'] : S.big ? [S.name, 'Big-wave surf · experts only'] : S.surf ? [S.name, 'Surfing · swimming at your own risk'] : [S.name, 'California State Parks']), roughness: 0.8 }), mats.post]);
			face2.position.y = 1.4; sign.add(face2);
			for (const u of [-1.4, 1.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), mats.post); post.position.set(u, 0.95, -0.12); sign.add(post); }
			sign.position.set(sx, sy, sz); sign.rotation.y = face + Math.PI;
			add(sign);
			// the restroom: a concrete block with a shed roof, men's and women's doors
			if (S.restroom) {
				const rx = lot.x + side.x * (W / 2 + 6), rz = lot.z + side.z * (W / 2 + 6), ry = Math.max(g(rx, rz), B.lotTop - 0.2);
				const rr = new THREE.Group();
				const body = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3, 4.4), mats.concrete); body.position.y = 1.5; rr.add(body);
				const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 5.4), mats.roof); roof.position.y = 3.2; roof.rotation.x = 0.12; rr.add(roof);
				for (const u of [-1.5, 1.5]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.08), mats.door); d.position.set(u, 1.05, 2.22); rr.add(d); }
				const found = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 5.2), mats.concrete); found.position.y = -0.7; rr.add(found);
				rr.position.set(rx, ry, rz); rr.rotation.y = face;
				add(rr);
			}
		}

		// ---------- camps: tents with their gear, chairs, a fire ring ----------
		const camps = [];
		const spot = (near, spread, lo, hi) => {
			for (let k = 0; k < 60; k++) {
				const a = rnd() * Math.PI * 2, r = rnd() * spread, x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r, h = g(x, z);
				if (h > lo && h < hi && slope(x, z) < 0.12 && camps.every((c) => Math.hypot(c.x - x, c.z - z) > 7)) { const c = { x, z, h }; camps.push(c); return c; }
			}
			return null;
		};
		const fireAt = (x, z, h) => {
			const ring = new THREE.Group();
			for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + hh(i, x) * 0.08, 0), mats.rock); st.position.set(Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72); ring.add(st); }
			for (let i = 0; i < 3; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 6), mats.log); lg.rotation.set(Math.PI / 2 - 0.35, i * 2.1, 0); lg.position.y = 0.22; ring.add(lg); }
			const flames = new THREE.Group();
			for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.04, 0.8 - i * 0.12, 6), mats.flame); f.position.set((i - 1) * 0.12, 0.55, (i % 2) * 0.1); flames.add(f); }
			ring.add(flames);
			ring.position.set(x, h, z);
			add(ring);
			B.fires.push({ flames, ph: hh(x, z) * 10 });
		};
		const tent = (x, z, h, face, kind, col) => {
			const T = new THREE.Group(), fab = M(col, 0.85, { side: THREE.DoubleSide });
			let w = 2.4, d = 2.4, top = 1.3;
			if (kind === 0) {           // a dome, its rain fly
				const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), fab); dome.scale.set(1, 0.95, 1.05); T.add(dome);
				const door = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12, 0, Math.PI), mats.black); door.position.set(0, 0.02, 1.36); T.add(door);
			} else if (kind === 1) {    // a tunnel tent
				const tun = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.6, 12, 1, true, -Math.PI / 2, Math.PI), fab); tun.rotation.z = Math.PI / 2; tun.rotation.y = Math.PI / 2; T.add(tun); w = 2; d = 3.6; top = 1;
			} else if (kind === 2) {    // an old A-frame
				const sh = new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, 1.25)]);
				const a = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2), fab); T.add(a); w = 2.2; top = 1.25;
			} else {                    // a pop-up shade over a table
				const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.5, 4, 1, true).rotateY(Math.PI / 4), fab); canopy.position.y = 2.35; T.add(canopy);
				for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), mats.pole); pl.position.set(u * 1.45, 1.1, v * 1.45); T.add(pl); }
				const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.7), mats.white); table.position.y = 0.72; T.add(table);
				top = 2.4;
			}
			// the gear: a cooler, rolled sleeping bags, a lantern (inside, or on the table)
			const cooler = new THREE.Group();
			const cb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.38), mats.cooler); cb.position.y = 0.18; cooler.add(cb);
			const cl = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.07, 0.4), mats.lid); cl.position.y = 0.38; cooler.add(cl);
			cooler.position.set(w * 0.25, 0, d * 0.15); T.add(cooler);
			for (let i = 0; i < (kind === 3 ? 0 : 2); i++) { const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 10), i ? mats.chair : mats.bag); bag.rotation.z = Math.PI / 2; bag.position.set(-0.4, 0.17, -0.3 + i * 0.4); T.add(bag); }
			const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 8), mats.lantern); lan.position.set(0.1, kind === 3 ? 0.87 : 0.12, 0.3); T.add(lan);
			B.lanterns.push(lan);
			// two chairs out front
			for (const u of [-0.7, 0.7]) { const ch = new THREE.Group(); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.48), mats.chair); seat.position.y = 0.4; ch.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), mats.chair); back.position.set(0, 0.68, -0.22); back.rotation.x = -0.15; ch.add(back); ch.position.set(u, 0, d / 2 + 1.4); ch.rotation.y = Math.PI + (u > 0 ? -0.3 : 0.3); T.add(ch); }
			T.position.set(x, h, z); T.rotation.y = face;
			T.userData.top = top;
			add(T);
		};
		const back = { x: sand.x - Math.sin(toSea) * 40, z: sand.z - Math.cos(toSea) * 40 };
		// a mapped campground's loop roads: the sites are pitched along them
		const loops = [];
		if (S.tents && real?.near) for (const r of real.near('roads', sand.x, sand.z, 420)) {
			if (r.cls !== 'service' && r.cls !== 'unclassified') continue;
			for (let i = 0; i + 3 < r.pts.length; i += 2) { const ax = r.pts[i], az = r.pts[i + 1], bx = r.pts[i + 2], bz = r.pts[i + 3], l = Math.hypot(bx - ax, bz - az); if (l > 4 && Math.hypot(ax - sand.x, az - sand.z) < 420) loops.push([ax, az, (bz - az) / l, -(bx - ax) / l, l]); }
		}
		const siteOnLoop = () => {
			for (let k = 0; k < 30; k++) {
				const [ax, az, nx, nz, l] = loops[Math.floor(rnd() * loops.length)], t = rnd(), side = rnd() < 0.5 ? 1 : -1, off = 7 + rnd() * 3;
				// (along the road t of the way, then off to one side into the site)
				const ux = ax + t * l * -nz, uz = az + t * l * nx;
				const cx = ux + nx * off * side, cz = uz + nz * off * side, h = g(cx, cz);
				if (h > 1 && h < 40 && slope(cx, cz) < 0.12 && camps.every((c) => Math.hypot(c.x - cx, c.z - cz) > 7)) { const c = { x: cx, z: cz, h, face: Math.atan2(-nx * side, -nz * side) }; camps.push(c); return c; }
			}
			return null;
		};
		let fires = S.fires || 0;
		for (let i = 0; i < (S.tents || 0); i++) {
			const c = loops.length > 6 ? siteOnLoop() : spot(back, 110, 1.2, 14);
			if (!c) break;
			tent(c.x, c.z, c.h, (c.face ?? toSea + Math.PI) + (rnd() - 0.5) * 0.8, Math.floor(rnd() * 4), tentCols[Math.floor(rnd() * tentCols.length)]);
			if (fires > 0 && i % 3 === 0) { fires--; fireAt(c.x + Math.sin(toSea) * 4, c.z + Math.cos(toSea) * 4, g(c.x + Math.sin(toSea) * 4, c.z + Math.cos(toSea) * 4)); }
		}
		// San Gregorio's driftwood forts: lean-tos of grey logs up the back of the beach
		for (let i = 0; i < (S.forts || 0); i++) {
			const c = spot(back, 140, 1, 6);
			if (!c) break;
			const F = new THREE.Group();
			for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2, lg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3 + hh(k, c.x) * 1.4, 6), mats.drift); lg.position.set(Math.cos(a) * 0.9, 1.3, Math.sin(a) * 0.9); lg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); F.add(lg); }
			F.position.set(c.x, c.h, c.z);
			add(F);
			if (fires > 0) { fires--; fireAt(c.x + 3, c.z + 1, g(c.x + 3, c.z + 1)); }
		}
		while (fires-- > 0) { const c = spot(back, 80, 1, 8); if (c) fireAt(c.x, c.z, c.h); }

		// ---------- surf: the checkered flags, and the lineup ----------
		if (S.surf && sea) {
			const flagTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g2 = cv.getContext('2d'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g2.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f0'; g2.fillRect(i * 8, j * 8, 8, 8); } const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; return t; })();
			const flagM = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
			const along = toSea + Math.PI / 2;
			for (const u of [-45, 45]) {
				const fx = sand.x + Math.sin(along) * u + Math.sin(toSea) * 10, fz = sand.z + Math.cos(along) * u + Math.cos(toSea) * 10, fy = Math.max(0.3, g(fx, fz));
				const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), mats.pole); pole.position.set(fx, fy + 1.6, fz); add(pole);
				const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), flagM); fl.position.set(fx + 0.45, fy + 2.85, fz); add(fl);
			}
			const surfer = () => {
				const s = new THREE.Group();
				const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, (S.big ? 2.6 : 1.7), 4, 8).scale(1, 1, 0.16).rotateX(Math.PI / 2).rotateY(Math.PI / 2), mats.board); board.rotation.set(0, 0, 0); s.add(board);
				const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.6, 4, 8), mats.wetsuit); body.position.y = 0.55; s.add(body);
				const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mats.wetsuit); head.position.y = 1.05; s.add(head);
				return { s, body, head };
			};
			const n = isPhone ? Math.ceil(S.surf / 2) : S.surf, out = S.big ? 260 : 70;
			for (let i = 0; i < n; i++) {
				const o = surfer(), u = (rnd() - 0.5) * 80, d0 = out + rnd() * 30;
				add(o.s);
				B.surfers.push({ ...o, u, d0, ph: rnd() * 40, along, toSea, sx: sand.x, sz: sand.z });
			}
		}
		// ---------- Año Nuevo's elephant seals, hauled out on the sand ----------
		for (let i = 0; i < (S.seals || 0) * (isPhone ? 0.5 : 1); i++) {
			const c = spot(sand, 160, 0.4, 3.5);
			if (!c) break;
			const big = rnd() < 0.2, L = big ? 4.2 : 2.6 + rnd() * 0.6;
			const seal = new THREE.Mesh(new THREE.CapsuleGeometry(L * 0.19, L * 0.6, 4, 10).rotateX(Math.PI / 2), mats.seal);
			seal.scale.set(1, 0.72, 1); seal.position.set(c.x, c.h + L * 0.13, c.z); seal.rotation.y = rnd() * 6.28;
			add(seal);
			B.seals.push({ seal, ph: rnd() * 20, y: c.h + L * 0.13 });
		}
		// ---------- Pigeon Point's lighthouse: 35 m of white brick, the black lantern ----------
		if (S.light) {
			const L = new THREE.Group(), lh = Math.max(g(S.x, S.z), 8);
			const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.6, 32, 20), mats.white); tower.position.y = 16; L.add(tower);
			const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.4, 20), mats.black); gallery.position.y = 32.2; L.add(gallery);
			const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 14), M(0x9fb2b8, 0.1, { metalness: 0.5, emissive: new THREE.Color(0xfff2c0), emissiveIntensity: 0 })); lantern.position.y = 34; L.add(lantern);
			const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2, 14), mats.black); cap.position.y = 36.5; L.add(cap);
			const keeper = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 9), mats.white); keeper.position.set(14, 3, 6); L.add(keeper);
			const kroof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 3, 4).rotateY(Math.PI / 4), M(0x8a3a2a)); kroof.scale.set(1, 1, 0.75); kroof.position.set(14, 7.5, 6); L.add(kroof);
			L.position.set(S.x, lh, S.z);
			add(L);
			B.beacon = lantern;
		}
		built.set(S, B);
	}
	function drop(S) {
		const B = built.get(S);
		B.group.traverse((o) => { if (o.geometry && !Object.values(carGeo).includes(o.geometry)) o.geometry.dispose(); });
		root.remove(B.group);
		built.delete(S);
	}

	let cool = 0;
	function update(dt, t, camera, nightK) {
		night.value = nightK;
		cool -= dt;
		const cx = camera.position.x, cz = camera.position.z;
		for (const S of SITES) {
			const d = Math.hypot(cx - S.x, cz - S.z);
			if (!built.has(S) && d < 2600 && camera.position.y < 2000 && cool <= 0 && bay.loaded()) { build(S); cool = 0.6; }
			else if (built.has(S) && d > 4000) drop(S);
		}
		mats.lantern.emissiveIntensity = nightK * 2.2;
		for (const B of built.values()) {
			for (const F of B.fires) {
				// by day a small fire, at dusk it takes; it flickers
				const k = 0.45 + nightK * 0.55, fl = 0.85 + Math.sin(t * 13 + F.ph) * 0.1 + Math.sin(t * 7.3 + F.ph * 2) * 0.08;
				F.flames.scale.set(k, k * fl, k);
			}
			mats.flame.opacity = 0.55 + nightK * 0.4;
			for (const Sf of B.surfers) {
				// waiting in the lineup, then catching one in toward the beach, paddling back out
				const c = (t + Sf.ph) % 40, riding = c > 28 && c < 36, u = riding ? (c - 28) / 8 : 0;
				const d = Sf.d0 * (1 - u * 0.75), sx = Sf.sx + Math.sin(Sf.toSea) * d + Math.sin(Sf.along) * Sf.u, sz = Sf.sz + Math.cos(Sf.toSea) * d + Math.cos(Sf.along) * Sf.u;
				Sf.s.position.set(sx, 0.05 + Math.sin(t * 1.3 + Sf.ph) * 0.25 + (riding ? Math.sin(u * Math.PI) * 0.5 : 0), sz);
				Sf.s.rotation.y = riding ? Sf.toSea + Math.PI + 0.5 : Sf.toSea;
				Sf.body.position.y = riding ? 0.75 : 0.45; Sf.body.rotation.x = riding ? 0 : 0.2; Sf.head.position.y = riding ? 1.3 : 0.95;
			}
			for (const E of B.seals) { E.seal.position.y = E.y + Math.max(0, Math.sin(t * 0.3 + E.ph)) * 0.05; }
			if (B.beacon) B.beacon.material.emissiveIntensity = nightK * (Math.sin(t * 1.2) > 0.6 ? 6 : 1.2);
		}
	}
	// which beach you are at (for zoning and hints)
	const beachAt = (x, z) => SITES.find((S) => Math.hypot(x - S.x, z - S.z) < 450) || null;
	// the lot's slab under you, to walk and drive onto
	function floor(x, z, y) {
		for (const B of built.values()) {
			const L = B.lot;
			if (!L) continue;
			const dx = x - L.x, dz = z - L.z, c = Math.cos(L.face), s = Math.sin(L.face);
			if (Math.abs(dx * c - dz * s) < L.W / 2 && Math.abs(dx * s + dz * c) < L.D / 2 && y > B.lotTop - 1.5) return B.lotTop;
		}
		return -1e9;
	}
	return { group: root, update, beachAt, floor, sites: SITES, debug: () => [...built.values()].map((B) => ({ name: B.S.name, lot: !!B.lot, fires: B.fires.length, lanterns: B.lanterns.length, surfers: B.surfers.length, kids: B.group.children.length })) };
}
