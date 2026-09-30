// Fishing, anywhere there is water to fish: Lake Annabel, the bay, the Pacific shore, the
// island's lagoon. Walk up to the water and the Fish button appears (R on a keyboard).
//   cast: the rod swings, the line flies out, the bobber lands and rides the water;
//   wait: it twitches now and then; when it goes under, strike (tap);
//   fight: hold to reel. The line's tension climbs while you reel and the fish pulls
//     harder when it runs; keep it in the green, let go when it runs, or it snaps. Bring
//     it in and it's yours: a card with the fish, its weight, and your best.
// What bites depends on the water: bluegill, bass and catfish in the lakes and reservoirs;
// rainbow trout, smallmouth bass and pikeminnow in the rivers and creeks; striped bass,
// halibut and leopard sharks in the bay; rockfish, surfperch and lingcod off the coast;
// snapper and trevally round the island. Every catch is kept in a log on this device.

import * as THREE from 'three';
import { PARKS } from './nature/parks.js';
import { today } from './calendar.js';

const SPECIES = {
	lake: [['bluegill', 0.34, 0.1, 0.8, '#6f8a52', '#d98a2b'], ['largemouth bass', 0.24, 0.6, 6, '#56703d', '#e8e2c8'], ['redear sunfish', 0.14, 0.2, 1.2, '#7d8a4a', '#c9602a'], ['channel catfish', 0.14, 1, 8, '#6d6a62', '#d8d4c8'], ['common carp', 0.14, 2, 14, '#a88a45', '#e3cf94']],
	river: [['rainbow trout', 0.34, 0.4, 4, '#7d8a6a', '#e8c4c8'], ['smallmouth bass', 0.2, 0.5, 4, '#7a6a3a', '#e6d8b0'], ['Sacramento pikeminnow', 0.16, 0.5, 6, '#6e7a5e', '#e4e0cc'], ['green sunfish', 0.18, 0.1, 0.6, '#5e7a4a', '#e0b050'], ['Sacramento sucker', 0.12, 1, 5, '#7a6a52', '#e8dcc4']],
	bay: [['striped bass', 0.3, 3, 25, '#7f8b95', '#eef0f0'], ['California halibut', 0.2, 2, 20, '#8a7a5c', '#f2efe6'], ['leopard shark', 0.14, 6, 25, '#7b7d7a', '#e6e2da'], ['jacksmelt', 0.24, 0.3, 1.2, '#7aa0a8', '#eaf2f2'], ['bat ray', 0.12, 5, 40, '#4e4a45', '#e8e4dc']],
	ocean: [['blue rockfish', 0.26, 0.8, 3.5, '#3d5570', '#b8c6d4'], ['barred surfperch', 0.26, 0.4, 2.5, '#9a9a82', '#e9e6d6'], ['lingcod', 0.16, 4, 30, '#6b6a4c', '#d8d0a8'], ['cabezon', 0.14, 2, 12, '#6d4a3a', '#c9a28a'], ['California halibut', 0.18, 2, 20, '#8a7a5c', '#f2efe6']],
	island: [['red snapper', 0.3, 1, 10, '#c9443a', '#f6d8cc'], ['giant trevally', 0.18, 5, 40, '#8b9aa6', '#e8eef2'], ['parrotfish', 0.28, 1, 8, '#3aa38a', '#f0a8c8'], ['bonefish', 0.24, 2, 10, '#b8c4c8', '#f4f6f6']],
};
// the local catch at a real park's water, by month (nature/parks.js), when there is one:
// a card for each kind that may come up, and the posted limits
const LOCAL = {
	'rainbow trout': [0.5, 4, '#7d8a6a', '#e8c4c8'], 'striped bass': [3, 25, '#7f8b95', '#eef0f0'], 'largemouth bass': [0.6, 6, '#56703d', '#e8e2c8'], 'smallmouth bass': [0.5, 4, '#7a6a3a', '#e6d8b0'],
	'channel catfish': [1, 8, '#6d6a62', '#d8d4c8'], 'bluegill': [0.1, 0.8, '#6f8a52', '#d98a2b'], 'black crappie': [0.3, 2, '#6a6a5a', '#e8e4d4'], 'jacksmelt': [0.3, 1.2, '#7aa0a8', '#eaf2f2'],
	'leopard shark': [6, 25, '#7b7d7a', '#e6e2da'], 'Dungeness crab': [1, 3, '#b0603a', '#e8c49a'], 'king salmon': [8, 30, '#6a7a8a', '#e8eef2'], 'surfperch': [0.4, 2.5, '#9a9a82', '#e9e6d6'], 'halibut': [2, 20, '#8a7a5c', '#f2efe6'],
};
const LIMITS = { 'rainbow trout': '5 a day', 'striped bass': '2 a day, 18 in minimum', 'largemouth bass': '5 a day', 'California halibut': '3 a day, 22 in minimum', 'halibut': '3 a day, 22 in minimum', 'leopard shark': '3 a day, 36 in minimum', 'Dungeness crab': '10 a day, 5\u00be in across the shell (Nov\u2013Jun)', 'surfperch': '20 a day, combined' };
const localKey = (name) => Object.keys(LOCAL).find((k) => name.toLowerCase().includes(k.toLowerCase().split(' ').slice(-2).join(' ').toLowerCase())) || Object.keys(LOCAL).find((k) => name.toLowerCase().includes(k.toLowerCase()));

// a fish drawn for the catch card: body, tail, fins, eye, its colours and markings
function fishPicture(name, back, belly) {
	const c = document.createElement('canvas'); c.width = 280; c.height = 130;
	const g = c.getContext('2d');
	const ray = /ray/.test(name), shark = /shark/.test(name), flat = /halibut/.test(name);
	g.translate(140, 65);
	if (ray) {
		g.fillStyle = back; g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, -60, 70, 0); g.quadraticCurveTo(0, 60, -10, 0); g.fill();
		g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(-60, -40, -30, 0); g.quadraticCurveTo(-60, 40, -10, 0); g.fill();
		g.strokeStyle = back; g.lineWidth = 3; g.beginPath(); g.moveTo(-30, 0); g.lineTo(-120, 4); g.stroke();
	} else {
		const L = shark ? 120 : 100, H = flat ? 34 : shark ? 22 : 34;
		const grad = g.createLinearGradient(0, -H, 0, H); grad.addColorStop(0, back); grad.addColorStop(0.55, back); grad.addColorStop(1, belly);
		g.fillStyle = grad;
		g.beginPath(); g.moveTo(L * 0.62, 0); g.bezierCurveTo(L * 0.5, -H * 1.2, -L * 0.45, -H, -L * 0.6, -4); g.lineTo(-L * 0.6, 4); g.bezierCurveTo(-L * 0.45, H, L * 0.5, H * 1.2, L * 0.62, 0); g.fill();
		g.fillStyle = back;
		g.beginPath(); g.moveTo(-L * 0.58, 0); g.lineTo(-L * 0.95, -H * 0.9); g.lineTo(-L * 0.85, 0); g.lineTo(-L * 0.95, H * 0.9); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(L * 0.1, -H * 0.9); g.lineTo(-L * 0.05, -H * (shark ? 2 : 1.4)); g.lineTo(-L * 0.3, -H * 0.8); g.fill();
		if (/bass|perch|rockfish|snapper/.test(name)) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let i = -3; i <= 2; i++) { g.beginPath(); g.moveTo(i * 14, -H * 0.7); g.lineTo(i * 14 + 4, H * 0.3); g.stroke(); } }
		if (/leopard/.test(name)) { g.fillStyle = 'rgba(30,25,20,0.55)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(-L * 0.4 + (i % 7) * 16, (i < 7 ? -8 : 4), 5, 3, 0, 0, 6.28); g.fill(); } }
		if (/bluegill|redear/.test(name)) { g.fillStyle = /redear/.test(name) ? '#b8342a' : '#1d2a44'; g.beginPath(); g.ellipse(L * 0.3, -2, 7, 5, 0, 0, 6.28); g.fill(); }
		g.fillStyle = '#fff'; g.beginPath(); g.arc(L * 0.45, -H * 0.2, 5, 0, 6.28); g.fill();
		g.fillStyle = '#111'; g.beginPath(); g.arc(L * 0.46, -H * 0.2, 2.6, 0, 6.28); g.fill();
	}
	return c.toDataURL();
}

// the fish itself, in 3D, for holding up when you land it: a body shaded from its back to
// its belly, a tail and fins that move, an eye; a ray flat with a whip tail, a shark long
// and slim, a halibut flat and deep, a crab with its legs and claws. Length from weight
// (a fish's weight goes roughly as the cube of its length). Returns { group, tail, len }.
function fishModel(name, back, belly, lb) {
	const len = Math.max(0.14, Math.min(1.3, 0.24 * Math.cbrt(Math.max(0.1, lb)) * (/shark/.test(name) ? 1.5 : /ray/.test(name) ? 0.9 : 1)));
	const cB = new THREE.Color(back), cL = new THREE.Color(belly), tmpC = new THREE.Color();
	const shade = (geo, y0, y1) => {
		const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
		for (let i = 0; i < pos.count; i++) { const k = THREE.MathUtils.smoothstep(pos.getY(i), y0, y1); tmpC.copy(cL).lerp(cB, k); col.set([tmpC.r, tmpC.g, tmpC.b], i * 3); }
		geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
		return geo;
	};
	// wet: glossy, a little sheen
	const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.15 });
	const fin = new THREE.MeshStandardMaterial({ color: cB.clone().multiplyScalar(0.85), roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
	const group = new THREE.Group(), tail = new THREE.Group();
	const eye = (x, y, z, r) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.1, metalness: 0.3 })); e.position.set(x, y, z); const w = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e2c8, roughness: 0.3 })); w.position.set(x - r * 0.25, y, z - Math.sign(z) * r * 0.25); group.add(w, e); };
	const tri = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]); return new THREE.ShapeGeometry(sh); };
	if (/crab/.test(name)) {
		const w = len * 0.9;
		group.add(new THREE.Mesh(shade(new THREE.SphereGeometry(1, 20, 12).scale(w * 0.5, w * 0.17, w * 0.36), -w * 0.1, w * 0.12), skin));
		const leg = new THREE.MeshStandardMaterial({ color: cB, roughness: 0.4 });
		for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const L = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.025, w * 0.02, w * 0.5, 6).translate(0, -w * 0.25, 0), leg); L.position.set(-w * 0.2 + k * w * 0.13, 0, sd * w * 0.3); L.rotation.set(sd * 1.9, 0, 0.3); tail.add(L); }
		for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(w * 0.11, 10, 8).scale(1.6, 0.8, 1), leg); c.position.set(w * 0.5, 0, sd * w * 0.22); group.add(c); }
		group.add(tail);
		return { group, tail, len: w };
	}
	if (/ray/.test(name)) {
		group.add(new THREE.Mesh(shade(new THREE.SphereGeometry(1, 24, 12).scale(len * 0.45, len * 0.06, len * 0.55), -len * 0.03, len * 0.03), skin));
		const t = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.005, len * 0.02, len * 0.9, 6).rotateZ(Math.PI / 2).translate(-len * 0.45, 0, 0), fin);
		tail.position.x = -len * 0.35; t.position.x = -len * 0.1; tail.add(t); group.add(tail);
		eye(len * 0.25, len * 0.05, len * 0.12, len * 0.018); eye(len * 0.25, len * 0.05, -len * 0.12, len * 0.018);
		return { group, tail, len };
	}
	const shark = /shark/.test(name), flat = /halibut/.test(name), deep = /bluegill|redear|sunfish|crappie|perch|parrot/.test(name);
	const H = len * (shark ? 0.09 : flat ? 0.2 : deep ? 0.22 : 0.13), W = len * (flat ? 0.04 : shark ? 0.08 : 0.07);
	const body = shade(new THREE.SphereGeometry(1, 28, 16).scale(len * 0.5, H, W), -H * 0.35, H * 0.45);
	// taper the back half toward the tail, and blunt the head
	{ const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (len * 0.5); const k = x < 0 ? 1 - Math.pow(-x, 1.6) * 0.72 : 1 - Math.pow(x, 3) * 0.15; p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k); } body.computeVertexNormals(); }
	group.add(new THREE.Mesh(body, skin));
	// markings: dark bars on a bass or a perch, spots on a leopard shark
	if (/bass|perch|rockfish|snapper/.test(name) || /leopard/.test(name)) {
		const mk = new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.4, transparent: true, opacity: 0.35 });
		for (let k = -3; k <= 2; k++) for (const sd of [-1, 1]) { const m = new THREE.Mesh(/leopard/.test(name) ? new THREE.CircleGeometry(H * 0.18, 8) : new THREE.PlaneGeometry(len * 0.025, H * 0.9), mk); m.position.set(k * len * 0.07, H * 0.15, sd * W * 0.92); if (sd < 0) m.rotation.y = Math.PI; group.add(m); }
	}
	const tf = new THREE.Mesh(tri(shark ? [[0, 0], [-len * 0.2, H * 2.2], [-len * 0.12, 0], [-len * 0.16, -H * 1.1]] : [[0, 0], [-len * 0.16, H * 1.3], [-len * 0.11, 0], [-len * 0.16, -H * 1.3]]), fin);
	tail.position.x = -len * 0.46; tail.add(tf); group.add(tail);
	const df = new THREE.Mesh(tri(shark ? [[len * 0.08, H * 0.8], [-len * 0.02, H * 2.4], [-len * 0.1, H * 0.8]] : [[len * 0.15, H * 0.85], [len * 0.05, H * 1.6], [-len * 0.25, H * 1.2], [-len * 0.3, H * 0.6]]), fin);
	group.add(df);
	for (const sd of [-1, 1]) { const pf = new THREE.Mesh(tri([[0, 0], [-len * 0.09, -H * 0.5], [-len * 0.03, -H * 0.1]]), fin); pf.position.set(len * 0.25, -H * 0.2, sd * W * 0.9); pf.rotation.y = sd * 0.5; group.add(pf); }
	eye(len * 0.38, H * 0.25, W * 0.72, Math.max(0.006, H * 0.13)); eye(len * 0.38, H * 0.25, -W * 0.72, Math.max(0.006, H * 0.13));
	return { group, tail, len };
}

// San Francisco Bay, San Pablo Bay and the South Bay inside the Golden Gate (roughly): the
// water outside it is the open Pacific (Ocean Beach, Pacifica, the San Mateo coast)
const BAY = [[37.8105, -122.477], [37.83, -122.479], [37.87, -122.5], [37.95, -122.5], [38.1, -122.5], [38.12, -122.25], [38.06, -122.0], [38.05, -121.85], [37.9, -122.3], [37.8, -122.27], [37.45, -121.93], [37.45, -122.12], [37.6, -122.38], [37.71, -122.39], [37.806, -122.46]]
	.map(([a, b]) => [(b + 122.57) * 111320 * Math.cos(37.76 * Math.PI / 180), -(a - 37.76) * 110996]);
function inBay(x, z) {
	let r = false;
	for (let i = 0, j = BAY.length - 1; i < BAY.length; j = i++) { const [ax, az] = BAY[i], [bx, bz] = BAY[j]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) r = !r; }
	return r;
}

export function createFishing({ scene, camera, getWorld, hint, mount }) {
	let log = [];
	try { log = JSON.parse(localStorage.getItem('crysis-fish-log') || '[]') || []; } catch { log = []; }
	const save = () => { try { localStorage.setItem('crysis-fish-log', JSON.stringify(log.slice(-300))); } catch { /* private mode */ } };

	// ---- the tackle ----
	const rod = new THREE.Group();
	const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.018, 2.1, 6).translate(0, 1.05, 0), new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.4 }));
	const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 8).translate(0, 0.17, 0), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }));
	const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.3, metalness: 0.8 }));
	reel.rotation.z = Math.PI / 2; reel.position.set(0.04, 0.32, 0);
	rod.add(blank, grip, reel);
	rod.visible = false;
	camera.add(rod);
	if (!camera.parent) scene.add(camera);
	const bobber = new THREE.Group();
	const bt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd8261c, roughness: 0.4 })); bt.position.y = 0.03;
	const bw = new THREE.Mesh(new THREE.SphereGeometry(0.061, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.4 })); bw.position.y = 0.03;
	const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4), bt.material); stick.position.y = 0.12;
	bobber.add(bt, bw, stick);
	bobber.visible = false;
	scene.add(bobber);
	const NL = 24, linePos = new Float32Array(NL * 3);
	const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
	const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xe6ecee, transparent: true, opacity: 0.7 }));
	line.frustumCulled = false; line.visible = false;
	scene.add(line);
	const splash = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
	splash.rotation.x = -Math.PI / 2; scene.add(splash);
	// your other hand, and the catch in it (hung from its jaw, before your eyes)
	const hand = new THREE.Group();
	{
		const sk = new THREE.MeshStandardMaterial({ color: 0xc99a7a, roughness: 0.6 });
		hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.095).translate(0, 0, 0.02), sk));
		for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateX(Math.PI / 2).translate(0, 0, -0.03), sk); f.position.set(-0.03 + k * 0.02, -0.012, -0.03); f.rotation.x = 1.2; hand.add(f); }
		const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.04, 3, 6).rotateX(Math.PI / 2), sk); th.position.set(0.05, -0.01, 0.0); th.rotation.set(0.9, 0.7, 0); hand.add(th);
		// the wrist
		hand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, 0.085), sk));
	}
	hand.visible = false;
	camera.add(hand);
	const H = { fish: null, t: 0, energy: 0, flop: 0, toss: null };
	// ---- the UI ----
	const btn = document.createElement('button');
	btn.style.cssText = 'position:absolute;left:50%;bottom:calc(74px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:12px 22px;border-radius:24px;border:1px solid rgba(255,255,255,.25);background:rgba(8,20,26,.78);color:#eafaf6;font:600 15px system-ui;display:none;z-index:4;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;';
	const meter = document.createElement('div');
	meter.style.cssText = 'position:absolute;left:50%;bottom:calc(128px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(280px,70vw);display:none;z-index:4;pointer-events:none;font:12px system-ui;color:#eafaf6;text-align:center;';
	meter.innerHTML = '<div data-t style="margin-bottom:4px">Hold to reel · keep it in the green</div><div style="position:relative;height:12px;border-radius:6px;background:linear-gradient(90deg,#2b5f8a 0%,#01a982 35%,#01a982 72%,#d9a21c 85%,#c8321c 100%);"><div data-k style="position:absolute;top:-3px;width:4px;height:18px;border-radius:2px;background:#fff;left:0"></div></div><div style="margin-top:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.15)"><div data-p style="height:100%;width:0;border-radius:3px;background:#eafaf6"></div></div>';
	const card = document.createElement('div');
	card.style.cssText = 'position:absolute;left:50%;top:18%;transform:translateX(-50%);width:min(320px,84vw);padding:14px 16px;border-radius:16px;background:rgba(8,20,26,.9);border:1px solid rgba(255,255,255,.18);color:#eafaf6;font:13px system-ui;text-align:center;display:none;z-index:6;';
	for (const el of [btn, meter, card]) { for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation()); mount?.appendChild(el); }
	card.addEventListener('click', () => { card.style.display = 'none'; });

	const F = { state: 'off', t: 0, at: new THREE.Vector3(), bite: 0, water: 'lake', level: 0, fish: null, tension: 0, prog: 0, hold: false, run: 0, swing: 0 };
	const setBtn = (t) => { if (btn.textContent !== t) btn.textContent = t; };

	// where the water is near you, and what water it is
	function waterNear(W, x, z) {
		const lake = W.lake;
		for (let r = 1.5; r <= 12; r += 1.5) for (let k = 0; k < 12; k++) {
			const a = k / 12 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
			const lv = lake?.waterAt(px, pz);
			if (lv !== null && lv !== undefined) return { kind: 'lake', level: lv, x: px, z: pz };
			// (every other lake, reservoir, river and creek: bay/water.js)
			const wk = W.water?.kindAt(px, pz);
			if (wk) return { kind: wk, level: W.water.waterAt(px, pz), x: px, z: pz };
			if (W.island.heightAt(px, pz) < -0.4) {
				const isl = Math.max(Math.abs(px), Math.abs(pz)) < W.island.half;
				return { kind: isl ? 'island' : inBay(px, pz) ? 'bay' : 'ocean', level: 0, x: px, z: pz };
			}
		}
		return null;
	}
	const isWater = (W, x, z) => (F.water === 'lake' || F.water === 'river' ? (W.lake?.waterAt(x, z) ?? W.water?.waterAt(x, z)) != null : W.island.heightAt(x, z) < -0.3);

	function cast(W) {
		const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize();
		let x = 0, z = 0, ok = false;
		for (let r = 16; r >= 4; r -= 1) { x = camera.position.x + d.x * r; z = camera.position.z + d.z * r; if (isWater(W, x, z)) { ok = true; break; } }
		if (!ok) { const w = F.near; const ex = w.x - camera.position.x, ez = w.z - camera.position.z, l = Math.hypot(ex, ez) || 1; x = w.x + ex / l * 5; z = w.z + ez / l * 5; if (!isWater(W, x, z)) { x = w.x; z = w.z; } }
		F.at.set(x, F.level, z); F.state = 'cast'; F.t = 0; F.swing = 1;
		F.bite = 3 + Math.random() * 7;
		bobber.visible = line.visible = true;
	}
	// the park whose water this is, if any, and what bites there this month
	function localList() {
		const W = getWorld(), m = today().getMonth() + 1;
		const P = PARKS.find((q) => q.fishing?.length && Math.hypot((q.lon + 122.57) * 111320 * Math.cos(37.76 * Math.PI / 180) - F.at.x, -(q.lat - 37.76) * 110996 - F.at.z) < 900);
		if (!P || !W) return null;
		const now = P.fishing.filter((f) => f.months.includes(m)).map((f) => { const k = localKey(f.species); return k ? [f.species.replace(/\s*\(.*\)/, ''), 1, ...LOCAL[k]] : null; }).filter(Boolean);
		if (!now.length) return null;
		for (const q of now) q[1] = 1 / now.length;
		return { list: now, park: P };
	}
	function strike() {
		const loc = F.water !== 'island' ? localList() : null;
		const list = loc && Math.random() < 0.7 ? loc.list : SPECIES[F.water];
		F.where = loc?.park || null;
		let u = Math.random(), sp = list[0];
		for (const s of list) { if (u < s[1]) { sp = s; break; } u -= s[1]; }
		const lb = +(sp[2] + Math.pow(Math.random(), 2.2) * (sp[3] - sp[2])).toFixed(1);
		F.fish = { sp, lb, power: 0.35 + Math.min(1, lb / sp[3]) * 0.55 };
		F.state = 'fight'; F.t = 0; F.tension = 0.3; F.prog = 0; F.run = 0;
		meter.style.display = 'block';
		hint?.('Fish on!', 1200);
	}
	function land() {
		const { sp, lb } = F.fish;
		log.push({ fish: sp[0], lb, water: F.water, t: Date.now() }); save();
		const mine = log.filter((c) => c.fish === sp[0]), best = Math.max(...mine.map((c) => c.lb));
		card.innerHTML = `<img src="${fishPicture(sp[0], sp[4], sp[5])}" style="width:100%;max-width:260px;display:block;margin:0 auto 6px"><div style="font:700 17px system-ui">${sp[0][0].toUpperCase() + sp[0].slice(1)}</div><div style="margin:4px 0 8px;opacity:.85">${lb} lb${lb >= best && mine.length > 1 ? ' · your biggest yet!' : mine.length === 1 ? ' · your first!' : ` · best ${best} lb`}</div>${F.where ? `<div style="opacity:.75;font-size:12px;margin-bottom:4px">${F.where.name}${LIMITS[sp[0]] ? ' · posted limit: ' + LIMITS[sp[0]] : ''}</div>` : ''}${/pier/i.test(F.where?.name || '') ? '<div style="opacity:.75;font-size:12px;margin-bottom:4px">No fishing licence needed on a public pier</div>' : ''}<div style="opacity:.6;font-size:12px">${log.length} fish caught in all · tap to close</div>`;
		card.style.display = 'block';
		setTimeout(() => { card.style.display = 'none'; }, 7000);
		hold(sp, lb);
		stop('landed');
	}
	let lastWhy = '';
	function stop(why) {
		lastWhy = why;
		if (why === 'snap') hint?.('Snap! The line broke.', 2200);
		else if (why === 'lost') hint?.('It got away.', 2000);
		else if (why === 'early') hint?.('Reeled in: nothing on it.', 2000);
		F.state = 'ready'; F.fish = null; bobber.visible = line.visible = false; meter.style.display = 'none';
	}
	function press(down) {
		const W = getWorld();
		if (!W) return;
		if (F.state === 'ready') { if (down) cast(W); }
		else if (F.state === 'wait' || F.state === 'cast') { if (down) stop('early'); }
		else if (F.state === 'bite') { if (down) strike(); }
		else if (F.state === 'fight') F.hold = down;
	}
	btn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(true); });
	for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => { if (F.state === 'fight') F.hold = false; });
	addEventListener('keydown', (e) => { if ((e.key === 'r' || e.key === 'R') && !e.repeat && btn.style.display !== 'none' && document.activeElement?.tagName !== 'INPUT') press(true); });
	addEventListener('keyup', (e) => { if (e.key === 'r' || e.key === 'R') { if (F.state === 'fight') F.hold = false; } });

	// ---- the catch in your hand: it flops, thrashes now and then, tires; then you let it go
	// (thrown back in a low arc to the water, a splash, and it is gone)
	function hold(sp, lb) {
		letGo(true);
		const m = fishModel(sp[0], sp[4], sp[5], lb);
		// hung from the jaw: head up at the hand, the body hanging below it
		m.group.rotation.z = Math.PI / 2;
		m.group.position.set(0, -m.len * 0.42, 0);
		const pivot = new THREE.Group(); pivot.add(m.group);
		hand.add(pivot);
		hand.position.set(-0.1, -0.02 + Math.min(0.16, m.len * 0.3), -0.42 - m.len * 0.35);
		hand.rotation.set(0.25, 0.35, 0.1);
		hand.visible = true;
		H.fish = { ...m, pivot }; H.t = 0; H.energy = 1; H.flop = 0.6;
	}
	function letGo(now = false) {
		if (!H.fish) return;
		const f = H.fish; H.fish = null;
		hand.remove(f.pivot);
		if (now) { hand.visible = false; return; }
		// back to the water it came from
		f.pivot.updateMatrixWorld();
		const at = new THREE.Vector3(); f.group.getWorldPosition(at);
		const q = new THREE.Quaternion(); f.group.getWorldQuaternion(q);
		f.group.position.copy(at); f.group.quaternion.copy(q); scene.add(f.group);
		const to = F.at.lengthSq() ? F.at.clone() : at.clone().add(new THREE.Vector3(0, -1, -3));
		to.x += (Math.random() - 0.5) * 2; to.z += (Math.random() - 0.5) * 2; to.y = F.level;
		H.toss = { g: f.group, tail: f.tail, from: at, to, t: 0 };
		hand.visible = false;
	}
	card.addEventListener('click', () => letGo());
	function animateCatch(dt, t) {
		if (H.fish) {
			H.t += dt;
			// tiring: big thrashes early, then now and then a burst
			H.energy = Math.max(0.25, H.energy - dt * 0.12);
			H.flop -= dt;
			if (H.flop < 0) { H.flop = 0.8 + Math.random() * 2.2; H.burst = 0.5 + Math.random() * 0.4; }
			H.burst = Math.max(0, (H.burst || 0) - dt);
			const e = H.energy * (H.burst > 0 ? 1.6 : 0.5);
			const f = H.fish;
			f.pivot.rotation.x = Math.sin(t * 11) * 0.35 * e;
			f.pivot.rotation.z = Math.sin(t * 7.3) * 0.18 * e + (H.burst > 0 ? Math.sin(t * 23) * 0.25 : 0);
			f.tail.rotation.y = Math.sin(t * 19) * 0.7 * e;
			f.group.rotation.x = Math.sin(t * 5.1) * 0.12 * e;
			// the hand steadies itself against it
			hand.position.x = -0.1 + Math.sin(t * 7.3) * 0.01 * e;
			if (H.t > 7.5) letGo();
		}
		if (H.toss) {
			const T = H.toss; T.t += dt;
			const k = Math.min(1, T.t / 0.9);
			T.g.position.lerpVectors(T.from, T.to, k); T.g.position.y += Math.sin(k * Math.PI) * 1.6;
			T.g.rotation.x += dt * 9; T.tail.rotation.y = Math.sin(t * 25) * 0.8;
			if (k >= 1) { splashAt(T.to, 0.7); scene.remove(T.g); T.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); H.toss = null; }
		}
	}

	const tmp = new THREE.Vector3(), tip = new THREE.Vector3();
	function update(dt, t, onFoot) {
		animateCatch(dt, t);
		const W = getWorld();
		if (!W) return;
		// near water, on foot: the rod comes out
		const near = onFoot ? waterNear(W, camera.position.x, camera.position.z) : null;
		if (near) { F.near = near; if (F.state === 'off') { F.state = 'ready'; F.water = near.kind; F.level = near.level; } }
		else if (F.state !== 'off' && (!onFoot || F.state === 'ready' || !F.near || Math.hypot(camera.position.x - F.at.x, camera.position.z - F.at.z) > 30)) { if (F.state !== 'ready') stop('lost'); F.state = 'off'; }
		const on = F.state !== 'off';
		rod.visible = on;
		btn.style.display = on ? 'block' : 'none';
		if (!on) return;
		if (F.state === 'ready') { F.water = near.kind; F.level = near.level; }
		setBtn({ ready: '🎣 Cast', cast: '🎣 …', wait: '🎣 Reel in', bite: '🎣 Strike!', fight: F.hold ? '🎣 Reeling…' : '🎣 Hold to reel' }[F.state] || '🎣 Cast');
		// the rod in your hands: out to the right, tipped up; swung forward on the cast; bent
		// by a fighting fish
		F.swing = Math.max(0, F.swing - dt * 2.2);
		const bend = F.state === 'fight' ? 0.25 + F.tension * 0.35 : F.state === 'bite' ? 0.12 : 0;
		rod.position.set(0.32, -0.42, -0.55);
		rod.rotation.set(-0.95 + Math.sin(F.swing * Math.PI) * -0.9 + bend, -0.25, -0.18 + Math.sin(t * 1.3) * 0.01);
		rod.updateMatrixWorld();
		tip.set(0, 2.1 * 0.62, 0).applyMatrix4(rod.matrixWorld);
		// the bobber: flying out, riding, twitching, going under
		F.t += dt;
		let bob = F.at.clone();
		if (F.state === 'cast') {
			const k = Math.min(1, F.t / 0.7);
			bob = tmp.copy(tip).lerp(F.at, k); bob.y += Math.sin(k * Math.PI) * 4;
			if (k >= 1) { F.state = 'wait'; F.t = 0; splashAt(F.at, 0.8); }
		} else if (F.state === 'wait') {
			bob.y += Math.sin(t * 2.1) * 0.015 + (Math.sin(t * 7 + F.t) > 0.97 ? -0.02 : 0);
			if (F.t > F.bite) { F.state = 'bite'; F.t = 0; splashAt(F.at, 0.5); hint?.('A bite! Strike!', 1400); }
		} else if (F.state === 'bite') {
			bob.y -= 0.09 + Math.sin(F.t * 22) * 0.04;
			if (F.t > 1.5) stop('lost');
		} else if (F.state === 'fight') {
			// the fish runs now and then; the tension climbs while you reel, faster when it runs
			F.run = Math.max(0, F.run - dt);
			if (F.run <= 0 && Math.random() < dt * 0.5 * F.fish.power) F.run = 0.8 + Math.random() * 1.6 * F.fish.power;
			const pull = F.run > 0 ? F.fish.power * 1.1 : F.fish.power * 0.25;
			F.tension += ((F.hold ? 0.3 : -0.55) + pull * (F.hold ? 0.55 : 0.3)) * dt;
			F.tension = Math.max(0, F.tension);
			if (F.hold && F.tension > 0.25 && F.tension < 0.85) F.prog += dt * (0.3 - F.fish.power * 0.12) * (F.run > 0 ? 0.35 : 1);
			if (!F.hold && F.run > 0) F.prog = Math.max(0, F.prog - dt * 0.05);
			if (F.tension >= 1) stop('snap');
			else if (F.tension <= 0.02 && F.run > 0) stop('lost');
			else if (F.prog >= 1) land();
			if (F.fish) {
				// the fish drags the bobber about and comes in as you win
				const home = tmp.copy(camera.position).setY(F.level);
				bob = F.at.clone().lerp(home, Math.min(0.85, F.prog * 0.85));
				bob.x += Math.sin(t * 3.1) * 0.6 * (F.run > 0 ? 1.6 : 0.5); bob.z += Math.cos(t * 2.3) * 0.5 * (F.run > 0 ? 1.6 : 0.5); bob.y -= 0.05;
				if (Math.random() < dt * 3) splashAt(bob, 0.4);
				meter.querySelector('[data-k]').style.left = `calc(${Math.min(1, F.tension) * 100}% - 2px)`;
				meter.querySelector('[data-p]').style.width = `${F.prog * 100}%`;
				meter.querySelector('[data-t]').textContent = F.run > 0 ? 'It runs! Ease off…' : F.hold ? 'Reeling…' : 'Hold to reel · keep it in the green';
			}
		}
		if (bobber.visible) {
			bobber.position.copy(bob);
			// the line: from the rod tip to the bobber, sagging (taut in a fight)
			const sag = F.state === 'fight' ? 0.1 : F.state === 'cast' ? 0 : 0.9;
			for (let i = 0; i < NL; i++) { const k = i / (NL - 1); tmp.copy(tip).lerp(bobber.position, k); tmp.y -= Math.sin(k * Math.PI) * sag * Math.min(2.5, tip.distanceTo(bobber.position) * 0.12); linePos.set([tmp.x, tmp.y, tmp.z], i * 3); }
			lineGeo.attributes.position.needsUpdate = true;
		}
		if (splash.material.opacity > 0) { splash.material.opacity -= dt * 0.8; splash.scale.multiplyScalar(1 + dt * 2.5); }
	}
	function splashAt(p, k) { splash.position.set(p.x, F.level + 0.02, p.z); splash.scale.setScalar(k); splash.material.opacity = 0.8; }
	// (for a look at a catch: Crysis.fishing.showCatch('bay', 1), no fight)
	const showCatch = (water = 'lake', i = 1, lb) => { const sp = SPECIES[water][i]; hold(sp, lb ?? (sp[2] + sp[3]) / 3); };
	// (a game or a jump elsewhere: the catch goes back in the water at once)
	return { update, showCatch, drop: () => letGo(true), log: () => log.slice(), state: () => F.state, tension: () => F.tension, last: () => lastWhy };
}
