// Surfing at Ocean Beach: three waves, each one yours if you can catch it.
//   paddle: tap, tap, tap as the wave comes in; you need to be moving when it reaches you
//     or it goes by without you.
//   ride: your finger's height on the screen is where you want to be on the face: up near
//     the top of the screen to climb to the lip, down low to drop to the bottom. Take your
//     finger off and you trim along low on the face.
// The ride runs on energy: dropping down the face makes speed and climbing spends it, and
// the wave pushes hardest just ahead of the curl, where it breaks (inside the whitewater it
// only slows you). The curl doesn't run at one speed: where a section closes out it races,
// and only pumping (up, down, up) keeps you ahead of it. Stay just ahead of the curl (in
// the pocket) for double points, tuck in under the lip right beside it for the barrel (four
// times), carve up and down for style, and hit the lip fast to boost an air. Let the curl
// catch you and you're under; drift out onto the flat shoulder or bog down and the ride
// ends.

import { makeKit, clamp } from './kit.js';

const H = 2.2, CURL_V = 5.5, FACE = [[0.3, -10.5], [0.9, -11.8], [1.6, -12.6], [2.1, -13.2]];
const PROFILE = [[0, -2], [0.05, -8], [0.3, -10.5], [0.9, -11.8], [1.6, -12.6], [2.1, -13.2], [2.3, -13.8], [2.0, -15], [1, -18], [0, -24]];

// where a height on the face (0 bottom, 1 lip) sits: [y, z]
function facePt(h) {
	const k = clamp(h, 0, 1) * (FACE.length - 1), i = Math.min(FACE.length - 2, Math.floor(k)), f = k - i;
	return [FACE[i][0] + (FACE[i + 1][0] - FACE[i][0]) * f, FACE[i][1] + (FACE[i + 1][1] - FACE[i][1]) * f];
}

export const GAME = {
	id: 'surf',
	title: 'Surfing',
	blurb: 'Paddle into an Ocean Beach wave, then ride the pocket, carve, and find the barrel.',
	where: { kind: 'site', sites: [{ name: 'Ocean Beach', lat: 37.7594, lon: -122.5107, r: 400 }, { name: 'Linda Mar, Pacifica', lat: 37.5947, lon: -122.5024, r: 250 }, { name: 'Fort Point', lat: 37.8106, lon: -122.4771, r: 120 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#39d0ff', dist: 2, span: [40, 30, 6], place: 'water', backdrop: 'sea', dome: 120 });
		const { THREE } = ctx;
		let wave, foam, surfer, board, body, S = {}, meter;

		function build() {
			// the sea and the sand (the real ones, when you're at the beach: set up at sea level
			// the stage rides on the ocean itself); the wave, a long moving ridge of water; its
			// broken whitewater
			if (!K.wet) {
				K.mesh(new THREE.PlaneGeometry(160, 90), K.mat('#1f5d7a', { rough: 0.25, metal: 0.2 }), 0, 0, -40).rotation.x = -Math.PI / 2;
				K.mesh(new THREE.PlaneGeometry(160, 12), K.mat('#d9c7a0', { rough: 1 }), 0, 0.05, 6).rotation.x = -Math.PI / 2;
			}
			const pts = [], idx = [], X0 = -60, X1 = 100, NX = 64;
			for (let i = 0; i <= NX; i++) for (const [y, z] of PROFILE) pts.push(X0 + (X1 - X0) * i / NX, y, z);
			const n = PROFILE.length;
			for (let i = 0; i < NX; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + n; idx.push(a, a + 1, b, b, a + 1, b + 1); }
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
			const cols = [];
			for (let i = 0; i <= NX; i++) for (const [y] of PROFILE) { const c = new THREE.Color('#1f6d86').lerp(new THREE.Color('#5fc4c0'), y / 2.3); cols.push(c.r, c.g, c.b); }
			g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
			wave = K.group();
			K.mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide, emissive: 0x0a2530 }), 0, 0, 0, wave);
			foam = K.mesh(new THREE.CylinderGeometry(1.3, 1.5, 1, 14), K.mat('#f4f8fa', { rough: 1, glow: 0.4 }), 0, 1.4, -12.4, wave);
			foam.rotation.z = Math.PI / 2;
			surfer = K.group();
			board = K.box(1.9, 0.06, 0.5, '#f7f1e3', 0, 0, 0, surfer);
			K.box(1.7, 0.062, 0.05, '#e2552a', 0, 0.001, 0, board);
			// the surfer: a real person in a wetsuit (Ocean Beach is cold), paddling on the
			// board, then up and riding side-on
			body = K.person({ parent: surfer, seed: 61, age: 24, still: true, style: (d, r) => ({ gen: 'z', top: { kind: 'suit', col: '#15161a', acc: ['#2354c7', '#3fc2c0', '#f07a28'][Math.floor(r() * 3)], pat: 'block', fit: 'tight', sleeves: 'long', fab: 'tech' }, outer: null, bottom: { kind: 'suit', col: '#15161a', pat: 'plain', legs: 'long', fit: 'tight', fab: 'tech' }, shoes: { kind: 'barefoot' }, acc: [] }) });
			meter = K.meter('Tap to paddle!', 'linear-gradient(90deg,#c8321c,#d9a21c 45%,#01a982 55%,#01a982)');
		}
		function reset() {
			S = { waveN: 0, score: 0, best: 0, log: [] };
			newWave();
		}
		function newWave() {
			Object.assign(S, { state: 'paddle', t: 0, paddle: 0, x: 0, h: 0, v: 0, c: -8, ride: 0, carves: 0, dir: 0, lastTurn: 0, air: 0, rideScore: 0, barrel: 0, want: null, saidBarrel: false });
			wave.position.z = -26;
			hud();
		}
		function hud() { K.hud(`Wave ${S.waveN + 1} of 3 · ${Math.round(S.score)} pts${S.state === 'ride' ? ` · this ride ${Math.round(S.rideScore)}` : ''}`); }
		function press(down, x, y) {
			if (S.state === 'paddle' && down) { S.paddle = Math.min(1.2, S.paddle + 0.13); K.noise(0.12, { vol: 0.06, f: 700 }); }
			if (S.state === 'ride') aim(down ? y : null);
		}
		function move(x, y) { if (S.state === 'ride' && K.ptr.down) aim(y); }
		function aim(y) {
			if (y === null) { S.want = null; return; }
			const r = K.size();
			S.want = clamp(1 - ((y - r.top) / r.height - 0.2) / 0.6, 0, 1);
		}
		function endRide(msg) {
			S.state = 'done'; S.t = 0;
			S.score += S.rideScore; S.best = Math.max(S.best, S.rideScore); S.log.push(Math.round(S.rideScore));
			K.say(`${msg} · ride ${Math.round(S.rideScore)}`, 1800);
			hud();
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'paddle') {
				S.paddle = Math.max(0, S.paddle - dt * 0.28);
				meter.set(S.paddle, S.paddle > 0.55 ? 'Paddling hard: ready!' : 'Tap to paddle!');
				wave.position.z = Math.min(0, -26 + S.t * 6.5);
				if (wave.position.z >= 0) {
					meter.hide();
					if (S.paddle > 0.55) { S.state = 'ride'; S.t = 0; S.h = 0.55; S.v = 6.5; S.c = -6; K.say('Up and riding!', 1000); K.noise(0.6, { vol: 0.12, f: 900 }); }
					else { S.state = 'missed'; S.t = 0; K.say('Missed it: paddle harder.', 1500); }
				}
			} else if (S.state === 'ride') {
				S.ride += dt;
				// the curl runs along the wave, faster where a section closes out
				S.c += (CURL_V + 2.2 * Math.sin(S.ride * 0.9) + 1.2 * Math.sin(S.ride * 2.3 + 1)) * dt;
				// up or down the face toward where your finger wants, as fast as the board turns
				const target = S.want ?? 0.3, prevH = S.h;
				if (S.air > 0) { S.air -= dt; S.h = 1.05 + Math.sin((0.8 - S.air) / 0.8 * Math.PI) * 0.5; if (S.air <= 0) { S.h = 0.85; K.say('Landed it! +150', 900); S.rideScore += 150; } }
				else S.h += clamp(target - S.h, -1.4 * dt, 1.4 * dt);
				const dh = (S.h - prevH) / dt;
				// energy: climbing costs speed, dropping makes it (a little more than it cost:
				// that's pumping); the pocket pushes
				const gap = S.x - S.c, push = 3.4 * (gap < 3 ? clamp(gap / 3, 0, 1) : clamp(1 - (gap - 3) / 9, 0, 1));
				S.v += (-9.8 * dh * H / Math.max(2, S.v) * (dh < 0 ? 0.65 : 0.5) + push - 0.4 * S.v) * dt;
				S.v = clamp(S.v, 0, 14);
				S.x += S.v * dt;
				// carves: each turn from climbing to dropping, with some height in it
				const d = Math.sign(Math.round(dh * 3));
				if (d && d !== S.dir) { if (S.dir && Math.abs(S.h - S.lastTurn) > 0.35) { S.carves++; S.rideScore += 25; K.say('Carve +25', 600); } S.dir = d; S.lastTurn = S.h; }
				if (S.air <= 0 && S.h > 0.96 && S.v > 7.5) { S.air = 0.8; K.say('Air!', 700); }
				const barrel = gap < 2.8 && S.h > 0.35 && S.h < 0.75;
				const mult = barrel ? 4 : gap < 6 ? 2 : 1;
				if (barrel) S.barrel += dt;
				S.rideScore += dt * 12 * mult;
				if (barrel && S.barrel > 0.8 && !S.saidBarrel) { S.saidBarrel = true; K.say('In the barrel! ×4', 1000); }
				if (!barrel) S.saidBarrel = false;
				if (gap < 0.4) { K.noise(0.9, { vol: 0.25, f: 600, type: 'lowpass' }); endRide('Wiped out by the curl'); }
				else if (gap > 22) endRide('Rode it out onto the shoulder');
				else if (S.v < 1.5) endRide('Bogged down and fell off the back');
				else if (S.ride > 25) endRide('Rode it all the way in');
				hud();
			} else if ((S.state === 'done' && S.t > 2.2) || (S.state === 'missed' && S.t > 2)) {
				S.waveN++;
				if (S.waveN < 3) newWave();
				else { S.state = 'over'; K.finish(Math.round(S.score), { unit: 'pts', line: `Best ride ${Math.round(S.best)}`, rows: [['Rides', S.log.join(' · ') || 'none caught']] }); }
			}
			// the whitewater spreads along behind the curl
			const len = Math.max(0.01, S.c + 60);
			foam.scale.set(1, len, 1); foam.position.x = -60 + len / 2;
			foam.visible = S.state === 'ride' || S.state === 'done';
			// the surfer: lying and paddling, then up on the board on the face
			let y = 0.05, z = -10;
			if (S.state === 'ride' || S.state === 'done') [y, z] = facePt(Math.min(1, S.h));
			if (S.air > 0) y = H * S.h;
			surfer.position.set(S.x, y + 0.05, z);
			const pitch = S.state === 'ride' ? clamp((S.h - (S.prevH ?? S.h)) * 30, -0.6, 0.6) : 0;
			S.prevH = S.h;
			surfer.rotation.set(0, 0, pitch);
			board.rotation.x = S.state === 'ride' ? 0.55 : 0;
			const prone = S.state === 'paddle' || S.state === 'missed' || S.state === 'wait';
			if (prone) { body.play('paddle', 1.1); body.g.position.set(0.85, 0.02, 0); body.g.rotation.y = Math.PI / 2; }
			else { body.act('surf', 0); body.g.position.set(0, 0.03, 0); body.g.rotation.y = 0; }
			if (S.state === 'paddle' || S.state === 'missed') K.cam(S.x - 1, 2.4, -2, S.x, 1.2, -26, 3);
			else K.cam(S.x - 3, 3.2, -3.5, S.x + 3, 1.2, -12, 3);
		}
		return K.wrap({ build, reset, update, press, move });
	},
};
