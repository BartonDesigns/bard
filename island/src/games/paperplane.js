// Paper planes, thrown from wherever you stand, over the real ground: best from a hilltop
// (Twin Peaks, Bernal Heights, the top of Coit Tower's hill) with the whole city below.
// Three throws; your score is the longest flight, rings included.
//   swipe up to throw (harder is faster).
//   in flight, hold anywhere to lift the nose, let go to let it dive; slide your finger
//     left or right while holding to bank and turn.
// The plane is a glider: holding the nose up trades speed for height, and too slow it
// stalls and drops its nose; diving builds speed back. A smooth, gentle glide goes
// furthest. Gold rings float along the way: fly through one for 25 m of bonus. It lands
// when it meets the ground (or the water).

import { makeKit, clamp, rand } from './kit.js';

const LIFT = 0.27, G = 9.8;

export const GAME = {
	id: 'paperplane',
	title: 'Paper Plane',
	blurb: 'Fold, throw, glide: fly a paper plane off wherever you stand and see how far it goes.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffffff', dist: 0.2, span: [1, 1] });
		const { THREE } = ctx;
		let plane, ring, trail, S = {};

		function build() {
			plane = K.group();
			const paper = K.canvas(64, 64, (g) => { g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#9ab'; for (let y = 8; y < 64; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); } });
			const m = K.mat('#ffffff', { map: paper, side: THREE.DoubleSide, rough: 0.9, glow: 0.3 });
			// two wings with a little dihedral, and the keel folded underneath
			for (const s of [-1, 1]) {
				const g = new THREE.BufferGeometry();
				g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.16, s * 0.12, 0.025, 0.12, 0, 0, 0.12], 3));
				g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, s < 0 ? 0 : 1, 0, 0.5, 0], 2));
				g.computeVertexNormals();
				K.mesh(g, m, 0, 0, 0, plane);
			}
			const k = new THREE.BufferGeometry();
			k.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.16, 0, 0, 0.12, 0, -0.035, 0.1], 3));
			k.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0], 2));
			k.computeVertexNormals();
			K.mesh(k, m, 0, 0, 0, plane);
			ring = K.mesh(new THREE.TorusGeometry(2, 0.12, 8, 28), K.mat('#ffd23f', { glow: 0.7, metal: 0.4 }), 0, -999, 0);
			const tg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 60 }, () => new THREE.Vector3()));
			trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
			trail.frustumCulled = false;
			K.root.add(trail);
		}
		function reset() {
			S = { throwN: 0, best: 0, log: [], state: 'aim', p: new THREE.Vector3(), V: 0, gam: 0, psi: 0, phi: 0, hold: false, t: 0, rings: 0, hist: [] };
			ready();
		}
		function ready() {
			S.state = 'aim'; S.p.set(0.25, K.groundY(0, 0) + 1.6, -0.3); S.psi = 0; S.gam = 0; S.phi = 0; S.rings = 0; S.hist = [];
			ring.position.y = -999;
			K.hud(`Throw ${S.throwN + 1} of 3 · swipe up to throw${S.best ? ` · longest ${Math.round(S.best)} m` : ''}`);
		}
		// the ground under a point, or the water, whichever is higher
		const floorAt = (x, z) => Math.max(K.groundY(x, z), -K.root.position.y);
		function placeRing() {
			const d = rand(35, 60), a = S.psi + rand(-0.3, 0.3);
			const x = S.p.x - Math.sin(a) * d, z = S.p.z - Math.cos(a) * d;
			const y = Math.max(floorAt(x, z) + 4, S.p.y - d * 0.12 + rand(-2, 2));
			ring.position.set(x, y, z);
			ring.rotation.set(0, a, 0);
		}
		function press(down) {
			if (S.state === 'aim') {
				if (down) return;
				const sw = K.swipe();
				if (sw.vy > -200 || sw.dy > -30) return;
				S.V = clamp(-sw.vy / 220, 5, 13); S.gam = 0.05; S.psi = -clamp(sw.dx / Math.max(60, -sw.dy), -0.5, 0.5) * 0.3;
				S.state = 'fly'; S.t = 0; S.start = S.p.clone();
				placeRing();
				K.noise(0.2, { vol: 0.06, f: 2000, q: 0.5 });
				return;
			}
			if (S.state === 'fly') { S.hold = down; S.bankX = K.ptr.x0; }
		}
		function step(dt) {
			// the glider: lift across the wings, drag (more when the nose is pulled up), gravity
			const cl = S.hold ? 1.4 : 0.8, L = LIFT * S.V * S.V * cl, D = LIFT / 7 * S.V * S.V * (1 + 0.6 * (cl - 1) ** 2);
			S.V += (-D - G * Math.sin(S.gam)) * dt;
			let dg = (L * Math.cos(S.phi) - G * Math.cos(S.gam)) / Math.max(1.5, S.V);
			if (S.V < 3) dg -= (3 - S.V) * 1.5; // stall: the nose drops
			S.gam = clamp(S.gam + dg * dt, -1.2, 0.9);
			S.psi -= L * Math.sin(S.phi) / Math.max(1.5, S.V * Math.cos(S.gam)) * dt; // bank right, turn right
			S.V = Math.max(1, S.V);
			const h = S.V * Math.cos(S.gam);
			S.p.x += -Math.sin(S.psi) * h * dt; S.p.z += -Math.cos(S.psi) * h * dt; S.p.y += S.V * Math.sin(S.gam) * dt;
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'fly') {
				// bank from how far your finger has slid while holding
				const want = S.hold ? clamp((K.ptr.x - (S.bankX ?? K.ptr.x)) / 110, -1, 1) * 0.6 : 0;
				S.phi += (want - S.phi) * Math.min(1, dt * 3);
				for (let i = 0; i < 4; i++) step(dt / 4);
				if (S.p.distanceTo(ring.position) < 2.1) { S.rings++; K.say('Through the ring! +25 m', 900); K.tone(990, 0.15, { vol: 0.1 }); placeRing(); }
				const behind = new THREE.Vector3(Math.sin(S.psi), 0, Math.cos(S.psi));
				if (ring.position.clone().sub(S.p).dot(behind) > 8) placeRing();
				S.hist.push(S.p.clone()); if (S.hist.length > 60) S.hist.shift();
				const dist = Math.hypot(S.p.x - S.start.x, S.p.z - S.start.z) + S.rings * 25;
				K.hud(`Throw ${S.throwN + 1} of 3 · ${Math.round(dist)} m · ${S.V.toFixed(1)} m/s${S.V < 3 ? ' · stalling!' : ''}`);
				const fl = floorAt(S.p.x, S.p.z);
				if (S.p.y < fl + 0.05 || S.t > 120) {
					S.p.y = fl + 0.05; S.state = 'landed'; S.t = 0; S.dist = dist;
					K.noise(0.1, { vol: 0.1, f: fl <= -K.root.position.y + 0.01 ? 500 : 1500 });
					K.say(`${Math.round(dist)} m${S.rings ? ` (${S.rings} ring${S.rings > 1 ? 's' : ''})` : ''}`, 1500);
				}
			} else if (S.state === 'landed' && S.t > 2) {
				S.log.push(Math.round(S.dist)); S.best = Math.max(S.best, S.dist); S.throwN++;
				if (S.throwN < 3) ready();
				else { S.state = 'over'; K.finish(Math.round(S.best), { unit: 'm', line: S.best > 150 ? 'Somebody down the hill is going to find that.' : 'A good fold.', rows: [['Flights', S.log.map((d) => d + ' m').join(' · ')]] }); }
			}
			plane.position.copy(S.p);
			plane.rotation.set(0, 0, 0);
			plane.rotateY(S.psi); plane.rotateX(S.gam); plane.rotateZ(-S.phi);
			const pos = trail.geometry.attributes.position;
			for (let i = 0; i < 60; i++) { const q = S.hist[Math.max(0, S.hist.length - 60 + i)] || S.p; pos.setXYZ(i, q.x, q.y, q.z); }
			pos.needsUpdate = true;
			ring.rotation.z += dt;
			const bx = Math.sin(S.psi), bz = Math.cos(S.psi);
			if (S.state === 'aim') K.cam(S.p.x + 0.1, S.p.y + 0.25, S.p.z + 1.1, S.p.x - bx * 20, S.p.y - 2, S.p.z - bz * 20, 4);
			else K.cam(S.p.x + bx * 3, S.p.y + 0.9, S.p.z + bz * 3, S.p.x - bx * 4, S.p.y - 0.2, S.p.z - bz * 4, 3);
		}
		return K.wrap({ build, reset, update, press });
	},
};
