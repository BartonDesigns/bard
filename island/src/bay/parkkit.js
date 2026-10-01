// The Bay Area's parks furnished the way their agencies furnish them (the parks & rec
// agent's survey, nature/parks.js): at each real park, built when you come near, its
// entrance sign in its agency's style (State Parks' routed redwood, the East Bay Regional
// Park District's brown and cream, the NPS arrowhead brown, San Ramon's blue panel on stone),
// a trailhead kiosk with its map boards at each trailhead, picnic tables with grills under
// the trees, benches facing the view, a drinking fountain and trash and recycling cans, a
// restroom in the agency's colours set back from the lot, and where the park has them a
// playground (decks, a slide, swings, rubber surfacing) and courts (the ball fields are
// sportsfields.js's, and all this keeps off them). Everything a park holds is merged per material into a few draws.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { restroomParts, walkIns } from '../interiors/restroom.js';
import { PARKS, AGENCY_STYLE } from '../nature/parks.js';
import { toWorld } from './geo.js';
import { inClearing } from '../sportsfields.js';
import { onLandmark } from './footprints.js';

const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const SITES = PARKS.map((p) => ({ ...p, ...toWorld(p.lat, p.lon), trails: (p.trailheads || []).map((t) => ({ ...t, ...toWorld(t.lat, t.lon) })) }));
export const PARK_SITES = SITES;

// an agency's sign face
function signTexture(style, lines) {
	const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
	const g = cv.getContext('2d'), S = style.sign;
	g.fillStyle = S.bg; g.fillRect(0, 0, 512, 192);
	for (let y = 0; y < 192; y += 3) { g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`; g.fillRect(0, y, 512, 1); }
	g.strokeStyle = S.border || S.fg; g.lineWidth = 6; g.strokeRect(9, 9, 494, 174);
	g.fillStyle = S.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
	const L = lines.filter(Boolean).slice(0, 3);
	L.forEach((t, i) => {
		const big = i === 0, sz = big ? (t.length > 20 ? 34 : 44) : 22;
		g.font = `${big ? 'bold ' : ''}${sz}px ${(S.font || 'Georgia, serif').replace(/^bold\s+/, '').replace(/^\d+px\s+/, '')}`;
		g.fillText(big ? t.toUpperCase() : t, 256, L.length === 1 ? 96 : 60 + i * (L.length === 2 ? 70 : 46));
	});
	const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
	return tx;
}
// a court's painted lines
function courtTexture(kind) {
	const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
	const g = cv.getContext('2d');
	g.fillStyle = kind === 'basketball' ? '#8a8378' : '#5e8f5f'; g.fillRect(0, 0, 256, 512);
	g.fillStyle = kind === 'pickleball' ? '#2f5d8c' : kind === 'basketball' ? '#8a8378' : '#3d7a4a'; g.fillRect(32, 48, 192, 416);
	g.strokeStyle = '#f4f4f0'; g.lineWidth = 4; g.strokeRect(32, 48, 192, 416);
	g.beginPath(); g.moveTo(32, 256); g.lineTo(224, 256); g.stroke();
	if (kind === 'basketball') { g.beginPath(); g.arc(128, 256, 36, 0, 6.3); g.stroke(); for (const y of [48, 464]) { g.strokeRect(96, y === 48 ? 48 : 384, 64, 80); g.beginPath(); g.arc(128, y === 48 ? 48 : 464, 130, y === 48 ? 0.2 : 3.35, y === 48 ? 2.94 : 6.08); g.stroke(); } }
	else { g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 384); g.moveTo(52, 128); g.lineTo(204, 128); g.moveTo(52, 384); g.lineTo(204, 384); g.stroke(); g.strokeRect(52, 48, 152, 416); }
	const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
	return tx;
}

export function createParkKit(scene, bay, real, { isPhone = false, lake = null } = {}) {
	const root = new THREE.Group();
	root.name = 'parkkit';
	scene.add(root);
	const built = new Map();
	const M = (hex, rough = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, ...extra });
	const mat = {
		redwood: M('#8a5a3c'), green: M('#2f5d3a', 0.6), concrete: M('#b8b2a6', 0.9), black: M('#1d1d1d', 0.5, { metalness: 0.4 }), steel: M('#9aa0a4', 0.4, { metalness: 0.6 }),
		post: M('#5a3d26', 0.85), roofB: M('#4e3b2c', 0.8), board: M('#e9e2cf', 0.7), mapBoard: M('#7f9aa8', 0.5), trashB: M('#5a3d26'), recyc: M('#2f5d8c'), compost: M('#3f7a3a'),
		playG: M('#3f7a3a', 0.5), playB: M('#2f6f9a', 0.5), slide: M('#e8c23a', 0.35), slideR: M('#c23a2a', 0.35), rubber: M('#a8543a', 0.95), rubberB: M('#3a6ea8', 0.95), chain: M('#b8bcc0', 0.3, { metalness: 0.8 }),
		net: M('#f4f4f0', 0.8, { transparent: true, opacity: 0.7 }), fence: M('#2a2a2a', 0.6, { metalness: 0.5, transparent: true, opacity: 0.55 }),
	};
	// (the restrooms are walked into: interiors/restroom.js)
	mat.tile = M('#e6e2d8', 0.5); mat.porcelain = M('#f4f3ef', 0.25); mat.mirror = M('#c8d0d4', 0.08, { metalness: 0.9 });
	const rooms = walkIns();
	const courtTex = { tennis: courtTexture('tennis'), pickleball: courtTexture('pickleball'), basketball: courtTexture('basketball') };
	const g = (x, z) => bay.heightAt(x, z);
	const slope = (x, z) => Math.hypot(g(x + 4, z) - g(x - 4, z), g(x, z + 4) - g(x, z - 4)) / 8;
	const onRoad = (x, z, pad) => real?.near ? real.near('roads', x, z, 40).some((r) => { if (!r.drive) return false; const p = r.pts; for (let i = 0; i + 3 < p.length; i += 2) { const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r.w / 2 + pad) return true; } return false; }) : false;
	const inBuilding = (x, z) => { const L = real?.landAt?.(x, z); return !!L && L.roof > 0.15; };
	const wet = (x, z) => g(x, z) < 0.6 || (lake && lake.waterAt(x, z) != null);

	function build(P) {
		const parts = new Map(), B = { P, group: new THREE.Group() };
		const add = (m, geo) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(geo.index ? geo.toNonIndexed() : geo); };
		let seed = 1;
		const rnd = () => hh(P.x * 0.011 + seed++ * 0.73, P.z * 0.013 - seed * 0.29);
		const used = [];
		// a free, level, dry spot near (x, z) for something r across
		const spot = (x, z, spread, r, maxSlope = 0.1) => {
			for (let k = 0; k < 80; k++) {
				const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * spread, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
				if (wet(px, pz) || slope(px, pz) > maxSlope || used.some((u) => Math.hypot(u.x - px, u.z - pz) < u.r + r)) continue;
				if (inBuilding(px, pz) || onRoad(px, pz, r) || inClearing(px, pz, r) || onLandmark(px, pz, r)) continue;
				used.push({ x: px, z: pz, r });
				return { x: px, z: pz, y: g(px, pz) };
			}
			return null;
		};
		// a box in a local frame at (o, yaw)
		const frame = (o, yaw) => new THREE.Matrix4().makeRotationY(yaw).setPosition(o.x, o.y, o.z);
		const box = (F, m, w, h, d, x = 0, y = 0, z = 0, rz = 0) => { const geo = new THREE.BoxGeometry(w, h, d); if (rz) geo.rotateZ(rz); geo.translate(x, y + h / 2, z); geo.applyMatrix4(F); add(m, geo); };
		const cyl = (F, m, r, h, x = 0, y = 0, z = 0, seg = 8) => { const geo = new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z); geo.applyMatrix4(F); add(m, geo); };
		const style = AGENCY_STYLE[P.agency] || AGENCY_STYLE['ca-state-parks'];
		const tableM = P.kind === 'city' ? mat.green : P.kind === 'beach' ? mat.concrete : mat.redwood;
		const has = (a) => P.amenities.includes(a);
		const facing = (o) => { let best = 0, bh = 1e9; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, h = g(o.x + Math.sin(a) * 60, o.z + Math.cos(a) * 60); if (h < bh) { bh = h; best = a; } } return best; };    // (downhill: the view)

		// the entrance sign
		const sgn = spot(P.x, P.z, 120, 3, 0.2);
		if (sgn) {
			const F = frame(sgn, facing(sgn) + Math.PI), S = style.sign;
			if (P.agency === 'city-sanramon' || /city/.test(P.agency)) box(F, M('#b8a47e', 0.95), 3.6, 0.7, 0.7);          // stone base
			for (const u of [-1.5, 1.5]) box(F, M(S.post || '#4a3322'), 0.2, 2.3, 0.2, u, 0, -0.1);
			const face = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 0.12), [M(S.post || '#4a3322'), M(S.post || '#4a3322'), M(S.post || '#4a3322'), M(S.post || '#4a3322'), new THREE.MeshStandardMaterial({ map: signTexture(style, (S.text && S.text.length ? [P.name, ...S.text.slice(1)] : [P.name])), roughness: 0.7 }), M(S.post || '#4a3322')]);
			face.applyMatrix4(F); face.position.y += 1.5; face.castShadow = !isPhone;
			B.group.add(face);
		}
		// trailhead kiosks with their map boards, a trash can and a bench beside
		for (const T of P.trails.slice(0, 3)) {
			const k = spot(T.x, T.z, 40, 2.5, 0.15);
			if (!k) continue;
			const F = frame(k, facing(k));
			for (const u of [-1.1, 1.1]) box(F, mat.post, 0.15, 2.5, 0.15, u, 0, 0);
			box(F, mat.mapBoard, 2.2, 1, 0.06, 0, 1.05, 0.08); box(F, mat.board, 2.25, 1.05, 0.04, 0, 1.03, 0.05);
			const roof = new THREE.ConeGeometry(1.9, 0.6, 4).rotateY(Math.PI / 4).scale(1.2, 1, 0.55).translate(0, 2.75, 0); roof.applyMatrix4(F); add(mat.roofB, roof);
			box(F, mat.trashB, 0.6, 1, 0.6, 2, 0, 0.6); box(F, mat.recyc, 0.6, 1, 0.6, 2.7, 0, 0.6);
		}
		// picnic tables with grills, in a cluster
		const nTables = has('picnic') || has('bbq') ? (isPhone ? 4 : 7) : 0;
		const pc = nTables && spot(P.x + 40, P.z - 20, 160, 10, 0.08);
		if (pc) for (let i = 0; i < nTables; i++) {
			const t = i === 0 ? pc : spot(pc.x, pc.z, 35, 3, 0.1);
			if (!t) continue;
			const F = frame(t, rnd() * 6.28);
			box(F, tableM, 1.83, 0.05, 0.76, 0, 0.71); for (const s of [-0.62, 0.62]) box(F, tableM, 1.83, 0.05, 0.25, 0, 0.41, s);
			for (const u of [-0.7, 0.7]) { box(F, mat.black, 0.06, 0.72, 0.06, u, 0, 0); box(F, mat.black, 0.06, 0.06, 1.5, u, 0.38, 0); }
			if (has('bbq')) { cyl(F, mat.black, 0.05, 0.85, 0, 0, 2.2); box(F, mat.black, 0.6, 0.25, 0.45, 0, 0.8, 2.2); }
		}
		// benches facing the view
		for (let i = 0; i < (isPhone ? 3 : 5); i++) {
			const b = spot(P.x, P.z, 200, 2, 0.12);
			if (!b) continue;
			const F = frame(b, facing(b));
			box(F, mat.redwood, 1.8, 0.05, 0.42, 0, 0.43); box(F, mat.redwood, 1.8, 0.4, 0.05, 0, 0.5, -0.22);
			for (const u of [-0.8, 0.8]) box(F, mat.black, 0.06, 0.45, 0.45, u, 0, -0.02);
		}
		// a drinking fountain (a high and a low bowl, and one for dogs)
		const fnt = spot(P.x - 20, P.z + 25, 120, 1.5);
		if (fnt) { const F = frame(fnt, 0); box(F, mat.concrete, 1.8, 0.1, 1.2); box(F, style.building ? M(P.kind === 'city' ? '#2f5d3a' : '#5a3d26') : mat.green, 0.35, 0.97, 0.35, -0.4, 0.1); box(F, M('#2f5d3a'), 0.35, 0.76, 0.35, 0.4, 0.1); cyl(F, mat.steel, 0.12, 0.08, 0.7, 0.15, 0.3, 10); }
		// the restroom, in the agency's colours
		if (has('restroom') || has('restroom-vault') || has('restroom-flush')) {
			const r = spot(P.x + 60, P.z + 40, 180, 6, 0.1);
			if (r) {
				const Bd = style.building || { wall: '#c8b89a', roof: '#5b4a3c', trim: '#3a2e24' }, big = has('restroom-flush') || P.kind === 'city';
				const W = big ? 8 : 3.2, D = big ? 6 : 2.4, yaw = facing(r);
				// its floor over the highest ground under it, on a footing down to the lowest
				let hi = -1e9, lo = 1e9;
				for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) { const h = g(r.x + Math.cos(yaw) * a * W / 2 + Math.sin(yaw) * b * D / 2, r.z - Math.sin(yaw) * a * W / 2 + Math.cos(yaw) * b * D / 2); hi = Math.max(hi, h); lo = Math.min(lo, h); }
				const F = frame({ x: r.x, y: hi + 0.12, z: r.z }, yaw), RR = restroomParts(W, D, 2.6, big ? 2 : 1);
				box(F, mat.concrete, W + 0.2, hi + 0.12 - lo + 0.4, D + 0.2, 0, lo - hi - 0.52);
				const RM = { wall: M(Bd.wall, 0.9), tile: mat.tile, floor: mat.concrete, fixture: mat.porcelain, steel: mat.steel, mirror: mat.mirror, door: M(Bd.trim || '#3a2e24', 0.6) };
				for (const k in RR.parts) for (const geo of RR.parts[k]) { geo.applyMatrix4(F); add(RM[k], geo); }
				const rf = new THREE.BoxGeometry(W + 0.8, 0.25, D + 0.8).rotateX(0.1).translate(0, 2.75, 0); rf.applyMatrix4(F); add(M(Bd.roof, 0.8), rf);
				if (!big) cyl(F, mat.black, 0.1, 1.2, 0.9, 2.6, -0.6);
				rooms.add(F, RR.solids, W, D, P);
			}
		}
		// a playground: rubber surfacing, a deck structure with a slide and a tube slide, swings
		if (has('playground') || has('playground-tot')) {
			const pg = spot(P.x - 50, P.z - 40, 160, 14, 0.06);
			if (pg) {
				const F = frame(pg, rnd() * 6.28), frameM = rnd() < 0.5 ? mat.playG : mat.playB;
				box(F, mat.rubber, 18, 0.12, 14); box(F, mat.rubberB, 6, 0.13, 5, -5, 0, 3);
				for (const [dx, dz, h] of [[-3, -2, 1.2], [-1.8, -2, 1.8], [-3, -0.8, 1.2]]) { for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(F, frameM, 0.11, h + 1.1, 0.11, dx + a, 0, dz + b); box(F, frameM, 1.25, 0.08, 1.25, dx, h, dz); box(F, M('#c23a2a', 0.5), 1.3, 0.1, 1.3, dx, h + 1.1, dz); }
				// the straight slide off the tall deck, and a tube slide
				{ const sl = new THREE.BoxGeometry(0.6, 0.05, 3.2).rotateX(-0.52).translate(-1.8, 0.95, -0.2 + 1.2); sl.applyMatrix4(F); add(mat.slide, sl); }
				{ const tube = new THREE.CylinderGeometry(0.42, 0.42, 3.4, 14, 1, true).rotateX(Math.PI / 2 - 0.4).translate(-4.6, 0.75, -2.2); tube.applyMatrix4(F); add(mat.slideR, tube); }
				// swings: an A-frame beam, two bays of two seats
				box(F, mat.steel, 6, 0.1, 0.1, 4, 2.6, 2);
				for (const u of [1.1, 6.9]) for (const s of [-0.9, 0.9]) box(F, mat.steel, 0.08, 2.75, 0.08, u, 0, 2 + s, (u < 4 ? 1 : -1) * 0.12);
				for (let k = 0; k < 4; k++) { const sx = 2.1 + k * 1.2; box(F, mat.chain, 0.02, 2.1, 0.02, sx - 0.2, 0.5, 2); box(F, mat.chain, 0.02, 2.1, 0.02, sx + 0.2, 0.5, 2); box(F, M('#1d1d1d', 0.8), 0.45, 0.05, 0.18, sx, 0.48, 2); }
				// benches round it, facing in
				for (const [bx, bz, a] of [[-10.5, 0, Math.PI / 2], [10.5, 0, -Math.PI / 2]]) { const Fb = F.clone().multiply(new THREE.Matrix4().makeRotationY(a).setPosition(bx, 0, bz)); box(Fb, mat.redwood, 1.8, 0.05, 0.42, 0, 0.43); box(Fb, mat.redwood, 1.8, 0.4, 0.05, 0, 0.5, -0.22); }
			}
		}
		// courts: a fenced bank of two, lines painted
		for (const kind of ['tennis', 'pickleball', 'basketball']) {
			if (!has(kind)) continue;
			const c = spot(P.x + 80, P.z - 60, 220, 20, 0.04);
			if (!c) continue;
			const F = frame(c, rnd() < 0.5 ? 0 : Math.PI / 2), L = kind === 'tennis' ? 36.6 : kind === 'pickleball' ? 20 : 28, Wd = kind === 'tennis' ? 18.3 : 12;
			const slab = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.2, L), [mat.concrete, mat.concrete, new THREE.MeshStandardMaterial({ map: courtTex[kind], roughness: 0.85 }), mat.concrete, mat.concrete, mat.concrete]);
			slab.applyMatrix4(F); slab.position.y += 0.08; slab.receiveShadow = true; B.group.add(slab);
			if (kind === 'basketball') for (const s of [-1, 1]) { box(F, mat.steel, 0.15, 3.3, 0.15, 0, 0, s * (L / 2 - 0.4)); box(F, mat.board, 1.83, 1.07, 0.05, 0, 2.9, s * (L / 2 - 1.2)); }
			else { box(F, mat.net, Wd * 0.72, 0.9, 0.03, 0, 0.1, 0); box(F, mat.fence, Wd, 3.2, 0.05, 0, 0, L / 2); box(F, mat.fence, Wd, 3.2, 0.05, 0, 0, -L / 2); box(F, mat.fence, 0.05, 3.2, L, Wd / 2, 0, 0); box(F, mat.fence, 0.05, 3.2, L, -Wd / 2, 0, 0); }
		}
		for (const [m, list] of parts) { const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = !isPhone && m !== mat.fence && m !== mat.net; mesh.receiveShadow = true; B.group.add(mesh); }
		root.add(B.group);
		built.set(P, B);
	}
	function drop(P) {
		const B = built.get(P);
		B.group.traverse((o) => o.geometry?.dispose());
		root.remove(B.group);
		built.delete(P);
		rooms.drop(P);
	}
	// the generated towns' parks, furnished as a city furnishes them
	let genV = -1, GEN = [];
	function genSites() {
		const v = real?.version ? real.version() : 0;
		if (v === genV) return GEN;
		for (const P of GEN) if (built.has(P)) drop(P);
		genV = v;
		GEN = (real?.genParks ? real.genParks() : []).map((q, i) => ({ id: 'gen' + i, name: `${q.town} ${['Community Park', 'Park', 'Commons', 'Green'][i % 4]}`, x: q.x, z: q.z, agency: 'city-sanramon', kind: 'city', trails: [], note: 'A neighbourhood park: the playground, the picnic tables, the path round the lawn.', amenities: ['playground', 'playground-tot', 'picnic', 'bbq', 'bench', 'drinking-fountain', ...(q.big ? ['restroom', 'soccer', 'basketball'] : [])] }));
		return GEN;
	}
	let cool = 0;
	function update(dt, camera) {
		cool -= dt;
		const x = camera.position.x, z = camera.position.z;
		for (const P of [...SITES, ...genSites()]) {
			const d = Math.hypot(P.x - x, P.z - z);
			if (!built.has(P) && d < 1600 && camera.position.y < 1500 && cool <= 0 && bay.loaded()) { try { build(P); } catch (e) { console.warn('park', P.name, e); built.set(P, { P, group: new THREE.Group() }); } cool = 0.5; }
			else if (built.has(P) && d > 2600) drop(P);
		}
	}
	// the park you are in, for a note
	const parkAt = (x, z) => SITES.find((P) => Math.hypot(P.x - x, P.z - z) < 300) || GEN.find((P) => Math.hypot(P.x - x, P.z - z) < 120) || null;
	return { group: root, update, parkAt, count: () => built.size, push: rooms.push, floor: rooms.floor, restrooms: rooms.where };
}
