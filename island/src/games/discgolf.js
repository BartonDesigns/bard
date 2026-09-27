// Disc golf, three holes laid out across the real ground where you stand (built for the
// course in Golden Gate Park, where the fairways wind between the cypress and eucalyptus).
//   swipe up to throw: the swipe's speed is the throw's power, its slant the line, and a
//     swipe that curls at the end puts a turn on the disc (curl right and it drifts right).
//     Inside ten metres the throw becomes a putt, softer and truer.
// The disc flies like a disc: lift holds it up while it is fast, drag slows it, it turns a
// little while fast and fades left as it slows, and it drops when it has nothing left. It
// skids on landing. Trees knock it down. It counts when it hits the chains under the
// basket's band. Par is three on every hole; lower is better.

import { makeKit, clamp, rand } from './kit.js';

const HOLES = [[0, 34, 'Cypress Row'], [0.9, 42, 'The Eucalyptus'], [-0.8, 38, 'Home Basket']];

export const GAME = {
	id: 'discgolf',
	title: 'Disc Golf',
	blurb: 'Three holes over the real ground: flick to throw, curl it round the trees.',
	where: { kind: 'site', sites: [{ name: 'Golden Gate Park Disc Golf Course', lat: 37.7704, lon: -122.4893, r: 200 }, { name: 'Stern Grove / Pine Lake', lat: 37.7362, lon: -122.4839, r: 150 }, { name: 'Anywhere with room to throw', lat: 37.8039, lon: -122.4636, r: 120 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffd23f', dist: 1, span: [2, 2] });
		const { THREE } = ctx;
		let disc, basket, trail, holeG = null, S = {};

		function build() {
			disc = K.group();
			const d = K.cyl(0.105, 0.09, 0.025, '#ff4f9a', 0, 0, 0, disc, 24);
			K.cyl(0.07, 0.07, 0.026, '#ffffff', 0, 0, 0, d, 20);
			basket = K.group();
			K.cyl(0.025, 0.025, 1.4, '#b8bcc4', 0, 0.7, 0, basket);
			K.cyl(0.3, 0.28, 0.14, '#b8bcc4', 0, 0.6, 0, basket, 20);
			K.cyl(0.32, 0.32, 0.06, '#ffd23f', 0, 1.36, 0, basket, 20);
			const chains = K.cyl(0.3, 0.12, 0.6, K.mat('#d8dce4', { metal: 0.8, rough: 0.3 }), 0, 1.05, 0, basket, 16);
			chains.material.wireframe = true;
			const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, () => new THREE.Vector3()));
			trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
			trail.frustumCulled = false;
			K.root.add(trail);
		}
		function reset() {
			S = { hole: 0, strokes: [], n: 0, tee: [0, 0], state: 'aim', p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, hist: [] };
			layHole();
		}
		// a hole: its basket out from the last one, trees scattered along the fairway
		function layHole() {
			if (holeG) K.drop(holeG);
			holeG = K.group();
			const [turn, len, name] = HOLES[S.hole];
			const head = (S.head || 0) + turn;
			S.head = head;
			const [tx, tz] = S.tee;
			S.basket = [tx - Math.sin(head) * len, tz - Math.cos(head) * len];
			basket.position.set(S.basket[0], K.groundY(...S.basket), S.basket[1]);
			K.box(1.2, 0.05, 2.4, '#9a9a92', tx, K.groundY(tx, tz) + 0.02, tz, holeG).rotation.y = head;
			S.trees = [];
			for (let i = 0; i < 9; i++) {
				const k = rand(0.2, 0.85), side = (i % 2 ? 1 : -1) * rand(1.5, 7);
				const x = tx - Math.sin(head) * len * k + Math.cos(head) * side, z = tz - Math.cos(head) * len * k - Math.sin(head) * side;
				const gy = K.groundY(x, z), tall = rand(6, 11);
				K.cyl(0.18, 0.28, tall, '#5a4632', x, gy + tall / 2, z, holeG, 8);
				const crown = K.mesh(new THREE.ConeGeometry(rand(1.4, 2.4), tall * 0.75, 8), K.mat(i % 3 ? '#2f5a36' : '#4a6a3a', { rough: 1 }), x, gy + tall * 0.7, z, holeG);
				crown.userData.tree = true;
				S.trees.push([x, z, 0.3, gy + tall]);
			}
			S.n = 0; S.state = 'aim'; S.p.set(tx, K.groundY(tx, tz) + 1.2, tz);
			K.say(`Hole ${S.hole + 1}: ${name} · ${len} m · par 3`, 1800);
		}
		const toBasket = () => Math.hypot(S.p.x - S.basket[0], S.p.z - S.basket[1]);
		function press(down) {
			if (down || S.state !== 'aim') return;
			const sw = K.swipe();
			if (sw.vy > -200 || sw.dy > -30) return;
			const h = sw.hist, mid = h[Math.floor(h.length / 2)] || h[0], a = h[0], b = h[h.length - 1];
			const curl = clamp(Math.atan2(b[0] - mid[0], mid[1] - b[1] || 1) - Math.atan2(mid[0] - a[0], a[1] - mid[1] || 1), -0.8, 0.8);
			const putt = toBasket() < 10;
			const speed = putt ? clamp(-sw.vy / 220, 2, 11) : clamp(-sw.vy / 110, 8, 27);
			// aim: along the line to the basket, turned by the swipe's slant
			const head = Math.atan2(S.basket[0] - S.p.x, S.basket[1] - S.p.z) - clamp(sw.dx / Math.max(60, -sw.dy), -0.8, 0.8) * (putt ? 0.15 : 0.3);
			const up = putt ? 0.12 : 0.16;
			S.v.set(Math.sin(head) * Math.cos(up) * speed, Math.sin(up) * speed, Math.cos(head) * Math.cos(up) * speed);
			S.curl = putt ? 0 : curl; S.v0 = speed; S.putt = putt;
			S.state = 'fly'; S.t = 0; S.n++; S.hist = [];
			K.noise(0.25, { vol: 0.1, f: 1500, q: 0.6 });
		}
		function step(dt) {
			const sp = S.v.length(), hsp = Math.hypot(S.v.x, S.v.z) || 1;
			// lift (less as it slows), drag, and the turn then the fade, sideways to its path
			S.v.y += (-9.8 + Math.min(8, 0.018 * sp * sp)) * dt;
			S.v.multiplyScalar(1 - 0.007 * sp * dt);
			const slow = clamp(1 - sp / S.v0, 0, 1), side = S.curl * 5 * (1 - slow) - (S.putt ? 0 : 3.2 * slow * slow);
			const rx = -S.v.z / hsp, rz = S.v.x / hsp;
			S.v.x += rx * side * dt; S.v.z += rz * side * dt;
			S.p.addScaledVector(S.v, dt);
			for (const [x, z, r, top] of S.trees) {
				if (S.p.y < top && Math.hypot(S.p.x - x, S.p.z - z) < r + 0.1) {
					S.v.set(-S.v.x * 0.15, -1, -S.v.z * 0.15);
					if (!S.hitTree) K.noise(0.15, { vol: 0.2, f: 600 });
					S.hitTree = true;
				}
			}
			// the chains
			const gb = K.groundY(...S.basket), db = Math.hypot(S.p.x - S.basket[0], S.p.z - S.basket[1]);
			if (db < 0.34 && S.p.y > gb + 0.55 && S.p.y < gb + 1.4) { S.state = 'chains'; S.t = 0; K.noise(0.9, { vol: 0.3, f: 4200, q: 1.5 }); return; }
			const gy = K.groundY(S.p.x, S.p.z);
			if (S.p.y < gy + 0.03) { S.p.y = gy + 0.03; S.state = 'skid'; S.v.y = 0; S.v.multiplyScalar(0.35); K.noise(0.12, { vol: 0.1, f: 400 }); }
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'fly') {
				for (let i = 0; i < 4; i++) { step(dt / 4); if (S.state !== 'fly') break; }
				if (S.t > 9) S.state = 'skid';
				S.hist.push(S.p.clone());
				if (S.hist.length > 40) S.hist.shift();
			} else if (S.state === 'skid') {
				const hs = Math.hypot(S.v.x, S.v.z);
				if (hs > 0.05) { const k = Math.max(0, hs - 5 * dt) / hs; S.v.x *= k; S.v.z *= k; S.p.x += S.v.x * dt; S.p.z += S.v.z * dt; S.p.y = K.groundY(S.p.x, S.p.z) + 0.03; }
				else {
					S.hitTree = false;
					if (S.n >= 6) { K.say('Six throws: picked up.', 1400); holeOut(); }
					else { S.state = 'aim'; S.p.y += 1.2; K.say(`${Math.round(toBasket())} m to the basket`, 1200); }
				}
			} else if (S.state === 'chains') {
				S.p.x += (S.basket[0] - S.p.x) * dt * 5; S.p.z += (S.basket[1] - S.p.z) * dt * 5; S.p.y += (K.groundY(...S.basket) + 0.65 - S.p.y) * dt * 5;
				if (S.t > 1.2) holeOut();
			}
			disc.position.copy(S.p);
			disc.rotation.set(S.state === 'fly' ? -S.curl * 0.3 : 0, K.time * 20, 0);
			const pos = trail.geometry.attributes.position;
			for (let i = 0; i < 40; i++) { const q = S.hist[Math.max(0, S.hist.length - 40 + i)] || S.p; pos.setXYZ(i, q.x, q.y, q.z); }
			pos.needsUpdate = true;
			trail.visible = S.state === 'fly' || S.state === 'skid';
			K.hud(`Hole ${S.hole + 1} of 3 · throw ${S.n + (S.state === 'aim' ? 1 : 0)} · ${Math.round(toBasket())} m${S.state === 'aim' && toBasket() < 10 ? ' · putt' : ''}`);
			// the camera: behind the disc, looking down the line to the basket
			const bx = S.basket[0] - S.p.x, bz = S.basket[1] - S.p.z, bd = Math.hypot(bx, bz) || 1;
			if (S.state === 'aim') K.cam(S.p.x - bx / bd * 3, S.p.y + 0.9, S.p.z - bz / bd * 3, S.p.x + bx / bd * 12, S.p.y - 0.4, S.p.z + bz / bd * 12, 3);
			else { const vh = Math.hypot(S.v.x, S.v.z) || 1; K.cam(S.p.x - S.v.x / vh * 4, S.p.y + 1.6, S.p.z - S.v.z / vh * 4, S.p.x, S.p.y, S.p.z, 2); }
		}
		function holeOut() {
			S.strokes.push(S.n);
			const d = S.n - 3;
			K.say(S.n === 1 ? 'Ace!' : d < 0 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : `${S.n}`, 1600);
			if (S.hole < HOLES.length - 1) { S.hole++; S.tee = [S.basket[0] + 2, S.basket[1] + 2]; layHole(); return; }
			S.state = 'done';
			const tot = S.strokes.reduce((a, b) => a + b, 0);
			K.finish(tot, { lower: true, unit: 'throws', line: tot < 9 ? `${9 - tot} under par` : tot === 9 ? 'Level par' : `${tot - 9} over par`, rows: HOLES.map((h, i) => [`${i + 1}. ${h[2]} (${h[1]} m)`, S.strokes[i]]) });
		}
		function end() { holeG = null; }
		return K.wrap({ build, reset, update, press, end });
	},
};
