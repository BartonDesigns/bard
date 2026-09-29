// The games of the other worlds' arenas (arenas.js), one engine in each world's clothes. You
// stand at the spot, the ball comes to you, and a swipe from it sends it at the goal: the end
// of the swipe is where you aim, its speed how hard. Ten shots a round. Each world bends it:
//   Magma Ball: a molten ball tossed up out of the moat; it cools as you hold it (shoot it
//     white-hot for three points, red for one, too late and it's stone). In an eruption the
//     volcano's bombs come down round you, shown by a ring where each will land: sidestep
//     (the arrows, or swipe sideways). A bomb that lands is a fresh ball. Balls the volcano
//     dropped on the arena before you came are extra shots.
//   Toxic Dodge: an acid ball; the keeper in the hazmat suit lobs a glob back after each
//     shot, and the sludge spits: sidestep the splash or lose a point.
//   Ice Puck: the puck slides and keeps sliding; ice blocks come out on the rink as the
//     round goes on, and a shot banked off one scores double.
//   Sandball: bowl at the stone wicket across the hardpan, with the wind across you and a
//     dust devil wandering the pitch; the middle stump is two.
//   Orb Ball: a glowing orb in a gentle gravity, floated through a rune ring that drifts
//     and shrinks; through the middle is two.
//   Reef Water Polo: thrown at a floating goal past a keeper treading water; skip it off
//     the water and in for two.
//   Low-G Ball: a sixth of a gravity on the sky platform: slow, floaty, and off the edge is
//     gone; in off a bounce is two.
//   Archery at the Butts (the tourney ground): drag back to draw, the sight opposite, and
//     let go; a full draw flies flat, a short one drops. The wind carries it. Rings 10 to 1.

import { makeKit, clamp, rand } from './kit.js';
import { fieldStage, player, trail, onWall } from './fieldgame.js';
import { suitFor } from '../people/wardrobe.js';
import { THEMES, hotBalls, moltenTex, bombGeometry } from '../arenas.js';

// the arenas of a theme round a point
const venue = (theme) => ({
	kind: 'dynamic',
	sites: (W, x, z, R) => (W?.fields?.near?.(x, z, R) || []).filter((f) => f.kind === 'arena' && f.theme === theme).map((f) => f.site),
});

const ARROW = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d > 0 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}"/></svg>`;

// each game: its look and its rules
const CFG = {
	magma: {
		title: 'Magma Ball', blurb: 'Shoot molten balls while they glow; in an eruption, dodge the bombs.', accent: '#ff8a3a',
		mode: 'goal', br: 0.2, g: 9.8, bounce: 0.35, speed: [14, 30], heat: true, hazard: 'bombs', move: true,
		keeper: { shirt: '#1a1310', pants: '#1a1310', skin: '#ff6a1a', scale: 1.2, glow: '#ff5a10' },
		trail: [1, 0.5, 0.12], spark: [1, 0.78, 0.3], halo: '#ff7a2a',
	},
	toxic: {
		title: 'Toxic Dodge', blurb: 'Sink the acid ball past the hazmat keeper, and sidestep what he throws back.', accent: '#9dff3a',
		mode: 'goal', br: 0.2, g: 9.8, bounce: 0.3, speed: [14, 30], hazard: 'acid', move: true,
		keeper: { shirt: '#e8cf22', pants: '#e8cf22', skin: '#20262a', cap: '#e8cf22', scale: 1.05 },
		trail: [0.45, 1, 0.15], spark: [0.6, 1, 0.3], halo: '#8aff30',
	},
	ice: {
		title: 'Ice Puck', blurb: 'Slide the puck past the keeper on the frozen lake; bank it off the ice blocks.', accent: '#8fdcff',
		mode: 'goal', br: 0.12, slide: true, speed: [9, 26], blocks: true,
		keeper: { shirt: '#2a5aa8', pants: '#18202e', skin: '#e0b090', cap: '#e8eef2', scale: 1 },
		trail: [0.75, 0.9, 1], spark: [0.9, 0.95, 1],
	},
	arid: {
		title: 'Sandball', blurb: 'Bowl at the stone wicket across the hardpan; mind the wind and the dust devil.', accent: '#ffc46a',
		mode: 'wicket', br: 0.12, g: 9.8, bounce: 0.5, speed: [14, 28], wind: 2.4, devil: true,
		trail: [0.85, 0.7, 0.45], dust: true,
	},
	mystic: {
		title: 'Orb Ball', blurb: 'Float the glowing orb through the drifting rune ring.', accent: '#c09cff',
		mode: 'ring', br: 0.24, g: 2.4, bounce: 0.5, drag: 0.15, speed: [6.5, 15],
		trail: [0.72, 0.55, 1], spark: [0.6, 0.9, 1], halo: '#b890ff',
	},
	ocean: {
		title: 'Reef Water Polo', blurb: 'Throw past the keeper into the floating goal; skip it off the water for two.', accent: '#4fe0d0',
		mode: 'goal', br: 0.11, g: 9.8, bounce: 0.3, speed: [11, 24], water: true,
		keeper: { shirt: '#e8e8e8', pants: '#1a3a6a', skin: '#b0764a', cap: '#d02020', scale: 1 },
		trail: [0.7, 0.95, 1], spark: [0.85, 0.97, 1],
	},
	sky: {
		title: 'Low-G Ball', blurb: 'Kick in a sixth of a gravity on the sky platform: slow, floaty, and off the edge is gone.', accent: '#7fe8ff',
		mode: 'goal', br: 0.2, g: 1.62, bounce: 0.62, speed: [8, 20],
		keeper: { shirt: '#c8d0d8', pants: '#8a929a', skin: '#40d8ff', scale: 1.05, glow: '#40d8ff' },
		trail: [0.3, 0.85, 1], spark: [0.6, 0.95, 1], halo: '#40d8ff',
	},
	tourney: {
		title: 'Archery at the Butts', blurb: 'Ten arrows at the straw butts: drag back to draw, let go to loose, allow for the wind.', accent: '#ffd76a',
		mode: 'butt', br: 0.03, g: 9.8, speed: [34, 62], wind: 3,
		trail: [1, 0.95, 0.8],
	},
};
const SHOTS = 10;

function makeGame(theme) {
	const C = CFG[theme], T = THEMES[theme];
	const GAME = {
		id: T.game, title: C.title, blurb: C.blurb, where: venue(theme),
		create(ctx) {
			const F = fieldStage(ctx, 'arena', theme);
			const K = makeKit(ctx, GAME, { accent: C.accent, pose: F.pose, dist: 1, span: [40, T.shot + 8, 12], flat: 2, backdrop: null });
			const { THREE } = ctx;
			const GZ = -T.shot, GW = T.gw, GH = T.gh, BR = C.br, KZ = GZ + 0.5, W2 = F.field.d.W / 2;
			let ball, halo = null, haze = null, keeper = null, tr, fx, dust = null, S = {};
			let archer = null, bow = null, ring = null, stumps = [], bails = [], devil = null, reticle = null, flash = null, heatM = null, hzBtn = null;
			const arrows = [], blocks = [], bombs = [], warns = {}, own = [], tv = new THREE.Vector3();
			// the floor under a stage point: the court (a raised one), or the pool's water
			const floorY = (x, z) => K.groundY(x, z) + (T.water ?? T.lift);

			// ---------- the look ----------
			function build() {
				F.lay(K);
				fx = sparks(K, THREE, 360, true);
				if (C.dust) dust = sparks(K, THREE, 160, false);
				// (the arrows are nocked one by one)
				ball = C.mode === 'butt' ? null : makeBall();
				if (C.halo) {
					halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(K), color: new THREE.Color(C.halo), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
					halo.scale.setScalar(BR * 7); K.root.add(halo);
				}
				if (C.heat) { haze = shimmer(K, THREE); heatM = K.meter('Heat', 'linear-gradient(90deg,#3a1a10,#b0300a 35%,#ff7a1a 65%,#fff0b0)'); }
				if (C.keeper) {
					// the keeper: a real person in this world's gear (a heat suit, a hazmat suit, a
					// goalie's kit, a water polo cap, a pressure suit), some of another world's skin
					const Q = C.keeper, suit = { magma: 'heat', toxic: 'hazmat', sky: 'sky', ocean: 'dive', ice: 'ice' }[theme];
					keeper = theme === 'ice' || theme === 'ocean' ? player(K, { a: Q.shirt, b: Q.pants, c: Q.cap || Q.pants, pants: Q.pants, pat: theme === 'ocean' ? 'hoops' : 'block' }, { sport: 'other', number: 1, extra: { sleeves: theme === 'ice' ? 'long' : 'none', legs: theme === 'ice' ? 'long' : 'brief' }, seed: 30, height: 1.8 * (Q.scale || 1) })
						: K.person({ seed: 31, age: 28, height: 1.82 * (Q.scale || 1), skin: Q.glow ? { col: Q.skin, glow: 0.6 } : undefined, style: () => suitFor(suit, Q.shirt, Q.cap || Q.pants) });
					if (theme === 'ice') { const pad = K.mat('#e8eef2'); for (const s of [-1, 1]) K.box(0.24, 0.7, 0.1, pad, s * 0.13, 0.36, -0.14, keeper.g); }
				}
				if (C.mode === 'ring') {
					ring = K.group();
					K.mesh(new THREE.TorusGeometry(1, 0.06, 10, 48), K.mat('#c9a8ff', { glow: 1.6 }), 0, 0, 0, ring);
					const disc = K.mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9a70ff'), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0, ring);
					disc.renderOrder = 2;
				}
				if (C.mode === 'wicket') {
					const y = floorY(0, GZ), m = K.mat('#9a8670', { rough: 1 });
					for (const x of [-0.36, 0, 0.36]) { const s = K.cyl(0.08, 0.09, GH, m, x, y + GH / 2, GZ, null, 7); s.userData.x = x; stumps.push(s); }
					for (const x of [-0.18, 0.18]) bails.push(K.box(0.36, 0.06, 0.07, m, x, y + GH + 0.03, GZ));
				}
				if (C.devil) devil = dustDevil(K, THREE);
				if (C.mode === 'butt') {
					reticle = K.el('position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid #ffd76a;border-radius:50%;display:none;box-shadow:0 0 6px #000;',
						'<div style="position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;background:#ffd76a;border-radius:2px"></div>');
					K.fov(20);
					// the archer: you, side-on to the butt on the left of the shot, in the tourney's
					// cloth, the bow in the left hand
					archer = K.person({ seed: 41, age: 26, style: (d, r) => ({ gen: 'medieval', top: { kind: 'tunic', col: ['#2f4a38', '#6a2331', '#1f2a44', '#7a5a44'][Math.floor(r() * 4)], acc: '#d0a126', pat: 'hem', fit: 'regular', sleeves: 'long', fab: 'wool' }, outer: { kind: 'jerkin', col: '#4e3226', pat: 'plain', fit: 'regular', sleeves: 'none', open: false, fab: 'leather' }, bottom: { kind: 'hose', col: '#33231c', pat: 'plain', legs: 'long', fit: 'tight', fab: 'wool' }, shoes: { kind: 'boot', col: '#3a2a1c', sole: '#2a1c12' }, acc: [] }) });
					archer.g.position.set(-0.55, floorY(-0.55, 1.0), 1.0);
					archer.g.rotation.y = -Math.PI / 2;
					archer.act('draw', 0.35);
					bow = K.group();
					const limb = K.mesh(new THREE.TorusGeometry(0.72, 0.014, 5, 20, 1.9), K.mat('#6b4423', { rough: 0.6 }), 0, 0, 0, bow);
					limb.rotation.set(0, Math.PI / 2, Math.PI - 0.95);
					bow.userData.string = K.mesh(new THREE.CylinderGeometry(0.002, 0.002, 1.18, 4), K.mat('#e8e0c8'), 0, 0, 0, bow);
				}
				if (C.move) {
					K.button(ARROW(-1), (d) => { if (d) step(-1); }, 'left:16px;bottom:calc(24px + env(safe-area-inset-bottom));');
					K.button(ARROW(1), (d) => { if (d) step(1); }, 'right:16px;bottom:calc(24px + env(safe-area-inset-bottom));');
				}
				if (C.hazard === 'bombs') hzBtn = K.button('', (d) => { if (d) { S.hz = !S.hz; hzLabel(); } }, 'left:16px;top:calc(64px + env(safe-area-inset-top));font-size:13px;');
				flash = K.el('position:absolute;inset:0;opacity:0;transition:opacity .5s;background:radial-gradient(circle,transparent 30%,#ff4010 120%);');
				tr = trail(K, C.accent);
			}
			function makeBall() {
				if (theme === 'magma') { const sk = moltenTex(); own.push(sk.map, sk.glow); const m = K.mat('#ffffff', { map: sk.map, rough: 0.5 }); m.emissiveMap = sk.glow; m.emissive.set('#ff8a30'); return K.ball(BR, m, 0, BR, 0); }
				if (theme === 'toxic') {
					const b = K.ball(BR, K.mat('#6aff20', { glow: 0.9, opacity: 0.72, rough: 0.1 }), 0, BR, 0);
					K.ball(BR * 0.55, K.mat('#e8ffa0', { glow: 2 }), 0, 0, 0, b);
					return b;
				}
				if (theme === 'ice') return K.cyl(0.12, 0.12, 0.05, K.mat('#141418', { rough: 0.3, glow: 0 }), 0, 0.025, 0);
				if (theme === 'mystic') return K.ball(BR, K.mat('#f4ecff', { glow: 2.2 }), 0, BR, 0);
				if (theme === 'tourney') {
					const a = K.group(), wood = K.mat('#b08a58'), feather = K.mat('#d83030', { side: THREE.DoubleSide });
					const sh = K.cyl(0.008, 0.008, 0.78, wood, 0, 0, 0, a, 6); sh.rotation.x = Math.PI / 2;
					const hd = K.mesh(new THREE.ConeGeometry(0.018, 0.07, 6), K.mat('#888c90', { metal: 0.6 }), 0, 0, -0.42, a); hd.rotation.x = -Math.PI / 2;
					for (let k = 0; k < 3; k++) { const fl = K.mesh(new THREE.PlaneGeometry(0.03, 0.12), feather, 0, 0, 0.33, a); fl.rotation.set(Math.PI / 2, 0, k / 3 * Math.PI * 2); fl.translateX(0.015); }
					return a;
				}
				// the rest: a painted ball
				const skin = K.canvas(128, 64, (g) => {
					const [a, b] = theme === 'ocean' ? ['#f0d020', '#2050c0'] : theme === 'sky' ? ['#b8c0c8', '#40d8ff'] : ['#c8a070', '#6a4a2a'];
					g.fillStyle = a; g.fillRect(0, 0, 128, 64); g.strokeStyle = b; g.lineWidth = theme === 'arid' ? 2 : 6;
					for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.bezierCurveTo(k * 32 + 16, 20, k * 32 - 16, 44, k * 32, 64); g.stroke(); }
				});
				return K.ball(BR, K.mat('#ffffff', { map: skin, rough: 0.6, glow: theme === 'sky' ? 0.6 : 0.1 }), 0, BR, 0);
			}
			function hzLabel() { if (hzBtn) hzBtn.textContent = S.hz ? 'Bombs: on' : 'Bombs: off'; }

			// ---------- the round ----------
			function reset() {
				S = { n: 0, of: SHOTS, score: 0, state: 'wait', t: 0, log: [], p: new THREE.Vector3(), v: new THREE.Vector3(), px: 0, pxT: 0, heat: 1, hz: false, kp: { x: 0, lean: 0, react: 0 }, hits: 0, spin: 0 };
				for (const a of arrows) K.drop(a); arrows.length = 0;
				for (const b of bombs) K.drop(b.o); bombs.length = 0;
				// the volcano's gifts: fresh balls it dropped on the arena are extra shots; in an eruption, the bombs are on
				if (theme === 'magma') {
					const W = ctx.getWorld?.(), now = performance.now() / 1000;
					const hot = F.real ? hotBalls(F.field, now) : [];
					if (hot.length) { S.of += Math.min(3, hot.length); F.field.hot = []; K.say(`The volcano left ${hot.length === 1 ? 'a fresh magma ball' : `${Math.min(3, hot.length)} fresh magma balls`} on the arena: extra shots`, 2600); }
					S.hz = W?.volcano?.state?.().phase === 'erupting';
					S.vent = W?.volcano?.vent ? K.local(W.volcano.vent) : null;
					S.bombT = 2.5;
					hzLabel();
				}
				if (theme === 'toxic') S.spitT = rand(5, 8);
				ready();
			}
			function ready() {
				S.state = C.mode === 'butt' ? 'aim' : 'deliver'; S.t = 0; S.result = null; S.crossed = false; S.bounced = false; S.banked = false; S.bonus = 0;
				S.kp = { x: 0, lean: 0, react: 0 };
				S.heat = 1;
				S.wind = C.wind ? rand(-C.wind, C.wind) : 0;
				if (C.mode === 'ring') { S.ringR = Math.max(0.75, 1.4 - S.n * 0.07); S.ringA = 0.4 + S.n * 0.35; }
				if (C.mode === 'wicket') for (const s of stumps) { s.rotation.set(0, 0, 0); s.position.x = s.userData.x; s.position.y = floorY(0, GZ) + GH / 2; }
				if (C.mode === 'wicket') bails.forEach((b, i) => { b.position.set(i ? 0.18 : -0.18, floorY(0, GZ) + GH + 0.03, GZ); b.rotation.set(0, 0, 0); b.userData.v = null; });
				if (C.blocks) placeBlocks();
				if (C.mode === 'butt') { ball = makeBall(); arrows.push(ball); const hnd = archer?.at('wrist.L'); if (hnd) { K.local(hnd, hnd); S.p.set(hnd.x, hnd.y + 0.05, hnd.z - 0.05); } else S.p.set(-0.55, floorY(0, 0) + 1.45, 0.25); S.draw = 0; }
				else {
					// where it comes from: the moat, a puddle, the side, a hatch, out of the air
					const s = Math.random() < 0.5 ? -1 : 1;
					S.from = theme === 'magma' ? new THREE.Vector3(s * (W2 + 5), floorY(0, 0), rand(-6, 2)) : theme === 'mystic' ? new THREE.Vector3(S.px, floorY(S.px, 0) + 2.5, -1)
						: theme === 'sky' ? new THREE.Vector3(0, floorY(0, 3), 3) : new THREE.Vector3(s * 9, floorY(0, 0), rand(-4, 1));
					S.arc = theme === 'magma' ? 7 : theme === 'ice' ? 0 : theme === 'arid' ? 0.4 : theme === 'mystic' ? 0 : 3;
					ball.visible = true; ball.scale.setScalar(1);
				}
				hud();
			}
			function hud() {
				const what = C.mode === 'butt' ? 'Arrow' : theme === 'magma' ? 'Ball' : theme === 'ice' ? 'Shot' : C.mode === 'wicket' ? 'Ball' : 'Shot';
				const wind = S.wind ? ` · wind ${Math.abs(S.wind).toFixed(1)} ${S.wind > 0 ? '→' : '←'}` : '';
				const tip = S.state !== 'aim' ? '' : C.mode === 'butt' ? '\nDrag back to draw, let go to loose' : C.move ? '\nSwipe up from the ball to shoot; sideways to step' : '\nSwipe from the ball to where you aim';
				K.hud(`${what} ${Math.min(S.of, S.n + 1)} of ${S.of} · ${S.score} point${S.score === 1 ? '' : 's'}${wind}${tip}`);
			}
			// a step sideways (you can dodge while the ball's away too)
			function step(d) { if (S.state === 'over') return; S.pxT = clamp(S.pxT + d * 2.2, -6.6, 6.6); K.noise(0.05, { vol: 0.08, f: 500 }); }

			function press(down, x, y) {
				if (C.mode === 'butt') return pressBow(down, x, y);
				if (down) return;
				const sw = K.swipe(), r = K.size();
				// sideways: a step
				if (C.move && Math.abs(sw.dx) > 40 && Math.abs(sw.dx) > Math.abs(sw.dy) * 1.3) { step(Math.sign(sw.dx)); return; }
				if (S.state !== 'aim' || sw.dy > -30 || sw.time > 1.5) return;
				tr.draw();
				const b = K.toScreen(S.p), aim = aimAt(b.x + sw.dx * 1.15, b.y + sw.dy * 1.15);
				if (!aim) return;
				const k = clamp((Math.hypot(sw.vx, sw.vy) / r.height - 0.6) / 5, 0, 1), speed = C.speed[0] + (C.speed[1] - C.speed[0]) * k;
				// struck too hard it flies high
				const over = Math.max(0, k - 0.8) * 3;
				const tx = clamp(aim.x + rand(-0.1, 0.1) * (1 + over * 2), -W2, W2), ty = clamp(aim.y + over + rand(-0.06, 0.06), BR, 8);
				shoot(tx, ty, speed);
			}
			function shoot(tx, ty, speed) {
				const dx = tx - S.p.x, dz = GZ - S.p.z, dist = Math.hypot(dx, dz), Tf = dist / speed;
				if (C.slide) S.v.set(dx / dist * speed, 0, dz / dist * speed);
				else S.v.set(dx / Tf, (floorY(tx, GZ) + ty - S.p.y + 0.5 * C.g * Tf * Tf) / Tf, dz / Tf);
				S.shotHeat = S.heat;
				S.state = 'fly'; S.t = 0; S.n++;
				// the keeper: reads it (more often as the round goes on), or guesses
				S.kp.react = (theme === 'ocean' ? 0.22 : 0.18) - S.n * 0.006;
				S.kp.vmax = 2.4 + S.n * 0.2;
				S.kp.guess = Math.random() < 0.3 + S.n * 0.05 ? null : rand(-GW / 2, GW / 2);
				K.noise(0.08, { vol: 0.3, f: C.slide ? 1800 : 280, type: C.slide ? 'bandpass' : 'lowpass' });
				if (theme === 'magma') K.noise(0.35, { vol: 0.12, f: 900, q: 0.5 });
				if (theme === 'mystic') K.tone(660, 0.4, { vol: 0.08, to: 990 });
				hud();
			}
			// the bow: drag back, the sight goes the other way; its length is the draw
			function pressBow(down, x, y) {
				if (S.state !== 'aim') return;
				if (down) { S.draw0 = [x, y]; S.hold = 0; return; }
				const r = K.size(), sw = K.swipe();
				const dl = Math.hypot(sw.dx, sw.dy) / (r.height * 0.3);
				reticle.style.display = 'none';
				if (dl < 0.12) return;
				const aim = sight(x, y);
				if (!aim) return;
				const draw = clamp(dl, 0.2, 1), speed = C.speed[0] + (C.speed[1] - C.speed[0]) * draw;
				// aimed at the sight: a full draw gets there (bar the wind), a weaker one falls short
				const dx = aim.x - S.p.x, dz = GZ - S.p.z, Tf = Math.hypot(dx, dz) / C.speed[1];
				const need = (aim.y - S.p.y + 0.5 * C.g * Tf * Tf) / Tf, k = speed / C.speed[1];
				S.v.set(dx / Tf * k, need * k - (1 - k) * 2, dz / Tf * k);
				S.state = 'fly'; S.t = 0; S.n++;
				K.noise(0.12, { vol: 0.25, f: 700, q: 2 }); K.tone(180, 0.18, { type: 'triangle', vol: 0.12, to: 90 });
				hud();
			}
			function sight(x, y) {
				const r = K.size(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.45;
				const [x0, y0] = S.draw0 || [x, y];
				const wob = Math.max(0, S.hold - 2) * 6 + 3;
				const sx = cx + (x0 - x) * 0.6 + Math.sin(K.time * 2.3) * wob, sy = cy + (y0 - y) * 0.6 + Math.cos(K.time * 1.7) * wob;
				reticle.style.left = sx - r.left + 'px'; reticle.style.top = sy - r.top + 'px'; reticle.style.display = 'block';
				return onWall(K, sx, sy, GZ);
			}
			function move(x, y) {
				if (K.ptr.down) tr.draw();
				if (C.mode === 'butt' && K.ptr.down && S.state === 'aim') sight(x, y);
			}
			const aimAt = (x, y) => { const p = onWall(K, x, y, GZ); if (p) p.y -= floorY(p.x, GZ); return p; };

			// ---------- the flight ----------
			function physics(dt) {
				const z0 = S.p.z, x0 = S.p.x, y0 = S.p.y;
				if (!C.slide) S.v.y -= C.g * dt;
				if (S.wind && S.p.z > GZ) S.v.x += S.wind * dt * (C.mode === 'butt' ? 0.9 : 0.5);
				if (C.drag) S.v.multiplyScalar(1 - C.drag * dt);
				// the dust devil turns what passes near it
				if (devil) { const dx = S.p.x - devil.x, dz = S.p.z - devil.z, d = Math.hypot(dx, dz); if (d < 2 && S.p.y - floorY(S.p.x, S.p.z) < 4) { S.v.x += (-dz / (d + 0.3)) * 9 * dt; S.v.z += (dx / (d + 0.3)) * 4 * dt; if (!S.whirl) { S.whirl = true; K.noise(0.4, { vol: 0.12, f: 600, q: 0.4 }); } } }
				S.p.addScaledVector(S.v, dt);
				const g = floorY(S.p.x, S.p.z);
				// the ice blocks: the puck glances off
				for (const b of blocks) {
					const dx = S.p.x - b.x, dz = S.p.z - b.z, d = Math.hypot(dx, dz), R = b.r + BR;
					if (d < R && d > 1e-4) {
						const nx = dx / d, nz = dz / d, vn = S.v.x * nx + S.v.z * nz;
						if (vn < 0) { S.v.x -= 1.8 * vn * nx; S.v.z -= 1.8 * vn * nz; S.banked = true; K.tone(1400, 0.08, { vol: 0.08, type: 'triangle' }); burst(S.p.x, S.p.y, S.p.z, 8, 2, C.spark, 0.12, 0.4); }
						S.p.x = b.x + nx * R; S.p.z = b.z + nz * R;
					}
				}
				// the keeper's line
				if (keeper && !S.result && z0 > KZ && S.p.z <= KZ) {
					const reach = theme === 'ice' ? 0.6 : 0.85, top = theme === 'ocean' ? 1.3 : (C.keeper.scale || 1) * 2.05;
					if (Math.abs(S.p.x - S.kp.x) < reach + BR && S.p.y - g < top) {
						S.result = 'save'; S.v.set(S.v.x * 0.3 + rand(-2, 2), C.slide ? 0 : Math.abs(S.v.y) * 0.3 + 2, -S.v.z * 0.35);
						K.noise(0.1, { vol: 0.3, f: 300, type: 'lowpass' }); burst(S.p.x, S.p.y, S.p.z, 14, 3, C.spark || C.trail, 0.14, 0.5);
					}
				}
				// the goal line: in, off the frame, or wide; the ring; the wicket; the butt
				if (!S.crossed && z0 > GZ && S.p.z <= GZ) {
					S.crossed = true;
					const t = (z0 - GZ) / (z0 - S.p.z), cx = x0 + (S.p.x - x0) * t, cy = y0 + (S.p.y - y0) * t - floorY(cx, GZ);
					if (C.mode === 'goal' && !S.result) {
						const ax = Math.abs(cx);
						if (Math.abs(ax - GW / 2) < BR + 0.06 && cy < GH + 0.06) { S.result = 'post'; S.v.set(-S.v.x * 0.6 + Math.sign(cx) * 1.5, S.v.y * 0.5, -S.v.z * 0.4); S.p.z = GZ + 0.1; K.tone(520, 0.3, { type: 'triangle', vol: 0.12 }); }
						else if (Math.abs(cy - GH) < BR + 0.06 && ax < GW / 2) { S.result = 'bar'; S.v.set(S.v.x * 0.6, -Math.abs(S.v.y) * 0.4 - 1, -S.v.z * 0.4); S.p.z = GZ + 0.1; K.tone(480, 0.3, { type: 'triangle', vol: 0.12 }); }
						else S.result = ax < GW / 2 - BR && cy < GH - BR ? 'goal' : cy > GH ? 'over' : 'wide';
						if (S.result === 'goal') burst(cx, S.p.y, GZ, 40, 5, C.spark || C.trail, 0.2, 0.9);
					} else if (C.mode === 'ring' && !S.result) {
						const d = Math.hypot(cx - ring.position.x, cy + floorY(cx, GZ) - ring.position.y), R = S.ringR;
						if (d < R - BR) { S.result = 'through'; S.bonus = d < R * 0.35 ? 1 : 0; burst(cx, ring.position.y, GZ, 50, 3, C.spark, 0.2, 1.2); K.tone(880, 0.5, { vol: 0.1 }); K.tone(1320, 0.6, { vol: 0.08, at: 0.1 }); }
						else if (d < R + BR) { S.result = 'rim'; S.v.z = -S.v.z * 0.4; S.v.x += (cx - ring.position.x) * 2; S.p.z = GZ + 0.1; K.tone(440, 0.3, { vol: 0.1, type: 'triangle' }); }
						else S.result = 'miss';
					} else if (C.mode === 'wicket' && !S.result) {
						if (Math.abs(cx) < 0.45 + BR && cy < GH + BR) {
							S.result = 'wicket'; S.bonus = Math.abs(cx) < 0.12 ? 1 : 0;
							for (const s of stumps) s.userData.hit = Math.sign(s.userData.x - cx + 1e-3) * (1 - Math.min(1, Math.abs(s.userData.x - cx) / 0.6));
							for (const b of bails) b.userData.v = new THREE.Vector3(rand(-2, 2) + S.v.x * 0.2, rand(3, 5), S.v.z * 0.15);
							S.v.set(S.v.x * 0.3, Math.abs(S.v.y) * 0.3, -S.v.z * 0.2); S.p.z = GZ + 0.15;
							K.noise(0.2, { vol: 0.3, f: 1600, q: 1.5 }); K.tone(300, 0.2, { type: 'square', vol: 0.05 });
						} else S.result = 'miss';
					} else if (C.mode === 'butt' && !S.result) {
						const d = Math.hypot(cx, cy - (GH + 0.1));
						if (d < 0.9) { S.result = 'hit'; S.ring = d < 0.82 ? 10 - Math.min(9, Math.floor(d / 0.082)) : 0; S.p.set(cx, cy + floorY(cx, GZ), GZ + 0.12); S.v.set(0, 0, 0); S.stuck = true; K.noise(0.08, { vol: 0.3, f: 400, type: 'lowpass' }); }
						else S.result = 'miss';
					}
				}
				// the net takes a goal; the curtain of heat melts a magma ball into it
				if (S.result === 'goal' && S.p.z < GZ - 0.3) { S.v.multiplyScalar(Math.exp(-dt * 9)); if (S.p.z < GZ - 1.3) { S.p.z = GZ - 1.3; S.v.z = Math.abs(S.v.z) * 0.1; } }
				if (S.stuck) return;
				// the ground (or the water)
				if (S.p.y < g + (C.slide ? 0.025 : BR)) {
					S.p.y = g + (C.slide ? 0.025 : BR);
					// (an arrow sticks where it comes down)
					if (C.mode === 'butt') { S.stuck = true; S.v.set(0, 0, 0); if (!S.result) S.result = 'miss'; return; }
					if (C.water) {
						const sp = Math.hypot(S.v.x, S.v.z);
						if (S.v.y < -1.5 && sp > 8 && !S.crossed) { S.v.y = -S.v.y * 0.45; S.v.x *= 0.8; S.v.z *= 0.8; S.bounced = true; splash(S.p.x, g, S.p.z, 14); }
						else { if (S.v.y < -1) splash(S.p.x, g, S.p.z, 20); S.v.y = 0; S.v.x *= Math.exp(-dt * 2.5); S.v.z *= Math.exp(-dt * 2.5); }
					} else if (C.slide) { const sp = Math.hypot(S.v.x, S.v.z), k = sp > 0 ? Math.max(0, sp - 0.35 * dt) / sp : 0; S.v.x *= k; S.v.z *= k; }
					else if (S.v.y < -0.8) {
						S.v.y = -S.v.y * C.bounce; S.v.x *= 0.93; S.v.z *= 0.93;
						if (!S.crossed) S.bounced = true;
						if (C.dust) puff(S.p.x, g, S.p.z, 10);
						else burst(S.p.x, g + 0.05, S.p.z, theme === 'magma' ? 16 : 6, 2.5, C.spark || C.trail, 0.1, 0.5);
						if (theme === 'magma') K.noise(0.1, { vol: 0.15, f: 1200 });
					} else { S.v.y = 0; const k = Math.exp(-dt * (C.dust ? 1.6 : 0.7)); S.v.x *= k; S.v.z *= k; }
				}
				// off the sky platform: gone
				if (theme === 'sky' && (Math.abs(S.p.x) > W2 + 1.5) && !S.result) S.result = 'edge';
			}
			// ---------- the archer ----------
			function archerAt() {
				// the draw follows your drag; loosed, the bow arm holds as the arrow flies
				const r = K.size(), dl = K.ptr.down && S.state === 'aim' && S.draw0 ? clamp(Math.hypot(K.ptr.x - S.draw0[0], K.ptr.y - S.draw0[1]) / (r.height * 0.3), 0, 1) : 0;
				S.drawK = (S.drawK || 0) + ((S.state === 'aim' ? 0.35 + dl * 0.65 : S.state === 'fly' ? 0.4 : 0.1) - (S.drawK || 0)) * 0.25;
				archer.act('draw', S.drawK);
				const hnd = archer.at('wrist.L', tv);
				if (!hnd) { bow.visible = false; return; }
				bow.visible = true;
				K.local(hnd, bow.position);
				bow.position.y += 0.04;
				const str = bow.userData.string;
				str.position.set(0, 0, 0.26 + (S.drawK - 0.35) * 0.5);
				// the arrow nocked on the string until it is loosed
				if (S.state === 'aim' && ball) { S.p.copy(bow.position); ball.position.copy(S.p); ball.position.z -= 0.3; }
			}
			// ---------- the keeper ----------
			function keeperAt(dt) {
				const P = S.kp;
				if (S.state === 'fly' && !S.result && S.v.z < -0.1) {
					P.react -= dt;
					if (P.react < 0) {
						const want = clamp(P.guess ?? S.p.x + S.v.x * (KZ - S.p.z) / S.v.z, -GW / 2 - 0.3, GW / 2 + 0.3);
						const dx = want - P.x, mv = Math.sign(dx) * Math.min(Math.abs(dx), P.vmax * dt);
						P.x += mv; P.lean = clamp(P.lean + mv * 2.5, -0.9, 0.9);
					}
				} else if (S.state === 'aim' || S.state === 'deliver') { P.x += (Math.sin(K.time * 1.3) * 0.8 - P.x) * Math.min(1, dt * 2); P.lean *= Math.exp(-dt * 4); }
				const y = theme === 'ocean' ? floorY(P.x, KZ) - 0.75 + Math.sin(K.time * 2) * 0.05 : floorY(P.x, KZ);
				keeper.g.position.set(P.x, y + (S.state === 'aim' ? Math.abs(Math.sin(K.time * 4)) * 0.05 : 0), KZ - 0.1);
				keeper.g.rotation.set(0, Math.PI, -P.lean);
				// ready, arms wide; at full stretch while the ball is coming
				const up = S.state === 'fly' && !S.result ? 1 : 0.2;
				if (S.throwT > 0) S.throwT -= dt;
				else keeper.act(up > 0.5 ? 'reach' : 'ready', 0);
			}

			// ---------- the hazards ----------
			function bombAt(tx, tz, kind) {
				const g = K.group(), hot = kind === 'bomb';
				// (a bomb as the volcano throws them: a clot, crust over the glow)
				const mat = hot ? K.mat('#ffa050', { basic: true }) : K.mat('#7dff2a', { glow: 1.2, opacity: 0.85 });
				if (hot) { mat.vertexColors = true; K.mesh(bombGeometry(0.42, bombs.length + 3), mat, 0, 0, 0, g); }
				else K.ball(0.28, mat, 0, 0, 0, g);
				// the ring on the ground where it will land
				const col = hot ? '#ff3a10' : '#7dff2a', warn = K.decal(2.4, 2.4, warns[col] ||= warnTex(K, col), tx, floorY(tx, tz) + 0.08, tz, { basic: true, opacity: 0.9 });
				warn.renderOrder = 3;
				const from = hot ? (S.vent ? new THREE.Vector3(S.vent.x, 0, S.vent.z).setY(0).normalize().multiplyScalar(60).setY(55) : new THREE.Vector3(rand(-30, 30), 50, -70))
					: new THREE.Vector3(S.kp.x, floorY(S.kp.x, KZ) + 1.8, KZ);
				const dur = hot ? rand(1.7, 2.2) : 1.15;
				bombs.push({ o: g, warn, from, to: new THREE.Vector3(tx, floorY(tx, tz), tz), t: 0, dur, kind, arc: hot ? 10 : 3.5 });
			}
			function hazards(dt) {
				if (theme === 'magma' && S.hz && S.state !== 'over') {
					S.bombT -= dt;
					if (S.bombT < 0) { S.bombT = rand(2.2, 3.8); bombAt(clamp(S.pxT + (Math.random() < 0.5 ? 0 : rand(-2.5, 2.5)), -6.5, 6.5), rand(-1, 1.5), 'bomb'); }
				}
				if (theme === 'toxic' && S.state !== 'over') {
					S.spitT -= dt;
					if (S.spitT < 0) { S.spitT = rand(6, 9); bombAt(clamp(S.pxT + rand(-1, 1), -6.5, 6.5), rand(-0.5, 1), 'acid'); }
				}
				for (let i = bombs.length - 1; i >= 0; i--) {
					const b = bombs[i];
					b.t += dt;
					const u = Math.min(1, b.t / b.dur);
					b.o.position.lerpVectors(b.from, b.to, u).y += Math.sin(Math.PI * u) * b.arc * (b.kind === 'bomb' ? 0.4 : 1);
					b.o.rotation.x += dt * 5; b.o.rotation.z += dt * 3;
					b.warn.scale.setScalar(0.6 + 0.4 * u + Math.sin(K.time * 18) * 0.05 * u);
					// its trail: smoke and embers behind a bomb, drips behind a glob
					if (Math.random() < dt * 40) fx.emit(b.o.position.x, b.o.position.y, b.o.position.z, rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), b.kind === 'bomb' ? C.trail : [0.45, 1, 0.15], 0.35, 0.6, 1);
					if (u < 1) continue;
					// down: a burst, and whoever stands there is caught
					const hit = Math.abs(S.px - b.to.x) < 1.25 && Math.abs(b.to.z) < 1.6;
					burst(b.to.x, b.to.y + 0.2, b.to.z, b.kind === 'bomb' ? 50 : 30, b.kind === 'bomb' ? 6 : 3.5, b.kind === 'bomb' ? C.spark : [0.5, 1, 0.2], 0.22, 1);
					K.noise(b.kind === 'bomb' ? 0.5 : 0.25, { vol: 0.3, f: b.kind === 'bomb' ? 180 : 700, type: 'lowpass' });
					if (hit) {
						S.score = Math.max(0, S.score - 1); S.hits++;
						K.say(b.kind === 'bomb' ? 'Scorched! −1' : 'Splashed! −1', 900);
						flash.style.background = `radial-gradient(circle,transparent 30%,${b.kind === 'bomb' ? '#ff4010' : '#60ff20'} 120%)`;
						flash.style.transition = 'none'; flash.style.opacity = '0.8'; void flash.offsetWidth; flash.style.transition = 'opacity .6s'; flash.style.opacity = '0';
						hud();
					} else if (b.kind === 'bomb' && (S.state === 'aim' || S.state === 'deliver') && S.heat < 0.6) {
						// a bomb that lands clear is a fresh ball: it rolls to you
						S.state = 'deliver'; S.t = 0; S.from = b.to.clone(); S.arc = 0.3; S.heat = 1;
						K.say('A fresh magma ball!', 900);
					}
					K.drop(b.o); K.drop(b.warn);
					bombs.splice(i, 1);
				}
			}
			function placeBlocks() {
				for (const b of blocks) K.drop(b.o);
				blocks.length = 0;
				const n = S.n < 3 ? 0 : S.n < 6 ? 1 : 2;
				for (let i = 0; i < n; i++) {
					const x = rand(-3.5, 3.5), z = rand(GZ * 0.75, GZ * 0.35), r = rand(0.45, 0.7);
					const o = K.box(r * 1.6, r * 1.3, r * 1.6, K.mat('#bfe8f8', { rough: 0.1, opacity: 0.8, glow: 0.3 }), x, floorY(x, z) + r * 0.6, z);
					o.rotation.y = rand(0, 3);
					blocks.push({ x, z, r, o });
				}
			}

			// ---------- the effects ----------
			const burst = (x, y, z, n, sp, col, size, life) => { for (let i = 0; i < n; i++) fx.emit(x, y, z, rand(-sp, sp), rand(0.2, 1.3) * sp, rand(-sp, sp), col, size * rand(0.6, 1.3), life * rand(0.6, 1.2), 1); };
			const puff = (x, y, z, n) => { for (let i = 0; i < n; i++) dust.emit(x, y + 0.1, z, rand(-1.2, 1.2), rand(0.2, 1), rand(-1.2, 1.2), [0.72, 0.58, 0.4], rand(0.4, 0.9), rand(0.8, 1.6), -0.3); };
			const splash = (x, y, z, n) => { for (let i = 0; i < n; i++) fx.emit(x, y + 0.05, z, rand(-1.5, 1.5), rand(1.5, 4), rand(-1.5, 1.5), [0.8, 0.95, 1], rand(0.08, 0.16), rand(0.5, 0.9), 1); K.noise(0.2, { vol: 0.15, f: 900, q: 0.6 }); };

			// ---------- each frame ----------
			function update(dt) {
				S.t += dt;
				tr.tick(dt);
				F.tick?.(dt, K.camera);
				S.px += (S.pxT - S.px) * Math.min(1, dt * 10);
				if (S.state === 'deliver') deliver();
				else if (S.state === 'aim') {
					if (C.mode !== 'butt') S.p.set(S.px, floorY(S.px, 0) + (C.slide ? 0.025 : BR) + (theme === 'mystic' ? 0.9 + Math.sin(K.time * 2) * 0.1 : 0), 0);
					if (C.heat) {
						S.heat = Math.max(0, S.heat - dt * 0.12);
						if (S.heat <= 0) { S.n++; S.log.push('cold'); K.say('It cooled to stone', 1100); S.state = 'after'; S.t = 0; S.result = 'cold'; hud(); }
					}
					if (C.mode === 'butt' && K.ptr.down) S.hold += dt;
				} else if (S.state === 'fly') {
					const sub = C.mode === 'butt' ? 10 : 6;
					for (let i = 0; i < sub; i++) physics(dt / sub);
					if (!S.stuck) trailFx(dt);
					if (C.slide) ball.rotation.y += dt * 6;
					else if (C.mode !== 'butt') { ball.rotation.x -= dt * S.v.z * 3; ball.rotation.z -= dt * S.v.x * 2; }
					const slow = S.v.length() < 0.3 && S.t > 1;
					if (S.stuck ? S.t > 0.9 : S.t > (C.g < 5 ? 4.5 : C.slide ? 3.2 : 2.6) || slow || S.p.y < floorY(0, 0) - 6) settle();
				} else if (S.state === 'after') {
					if (theme === 'magma' && S.result === 'goal') ball.scale.multiplyScalar(Math.exp(-dt * 2.5));
					if (S.t > 1.2) { if (S.n >= S.of) over(); else ready(); }
				}
				if (keeper) keeperAt(dt);
				hazards(dt);
				// the ring drifts; the wicket falls; the devil wanders
				if (ring) { ring.position.set(Math.sin(K.time * 0.45) * S.ringA, floorY(0, GZ) + 1.7 + Math.sin(K.time * 0.7) * Math.min(0.9, S.ringA * 0.4), GZ); ring.scale.setScalar(S.ringR); ring.rotation.z = K.time * 0.2; }
				for (const s of stumps) if (s.userData.hit && S.result === 'wicket') s.rotation.z = clamp(s.rotation.z - s.userData.hit * dt * 4, -1.2, 1.2);
				for (const b of bails) if (b.userData.v) { b.userData.v.y -= 9.8 * dt; b.position.addScaledVector(b.userData.v, dt); b.rotation.x += dt * 8; const g = floorY(b.position.x, b.position.z) + 0.03; if (b.position.y < g) { b.position.y = g; b.userData.v.set(0, 0, 0); b.userData.v = null; } }
				if (devil) { devil.x = Math.sin(K.time * 0.23) * 5; devil.z = GZ * 0.5 + Math.sin(K.time * 0.31) * 3; devil.g.position.set(devil.x, floorY(devil.x, devil.z), devil.z); devil.g.rotation.y += dt * 3; if (Math.random() < dt * 30) puff(devil.x + rand(-0.6, 0.6), floorY(devil.x, devil.z), devil.z + rand(-0.6, 0.6), 1); }
				if (dust && S.wind && Math.random() < dt * 8) dust.emit(rand(-12, 12), floorY(0, 0) + rand(0, 1), rand(GZ, 4), S.wind * 2, 0.1, 0, [0.8, 0.65, 0.45], 0.5, 2.5, 0);
				// the ball's look: its glow by its heat, its halo, the haze of heat over it
				ball.position.copy(S.p);
				if (C.mode === 'butt' && !S.stuck && S.state === 'fly') ball.lookAt(K.world(tv.copy(S.p).sub(S.v)));
				if (C.heat && ball.material?.emissive) { const h = S.state === 'fly' ? S.shotHeat : S.heat; ball.material.emissive.setRGB(1, 0.2 + 0.6 * h, 0.05 + 0.4 * h * h).multiplyScalar(0.25 + 1.8 * h); heatM.set(h, h > 0.66 ? 'White hot · 3 points' : h > 0.33 ? 'Glowing · 2 points' : h > 0 ? 'Crusting · 1 point' : 'Stone'); }
				if (halo) { halo.position.copy(S.p); halo.visible = ball.visible; halo.material.opacity = C.heat ? 0.25 + 0.7 * (S.state === 'fly' ? S.shotHeat : S.heat) : 0.8 + Math.sin(K.time * 3) * 0.15; }
				if (haze) { haze.set(S.p, K.camera, C.heat ? (S.state === 'fly' ? S.shotHeat : S.heat) : 0, K.time); haze.mesh.visible = ball.visible; }
				fx.tick(dt, K); dust?.tick(dt, K);
				if (archer) archerAt();
				camera();
			}
			function deliver() {
				const D = theme === 'mystic' ? 1.2 : 0.9, u = Math.min(1, S.t / D), to = new THREE.Vector3(S.px, floorY(S.px, 0) + (C.slide ? 0.025 : BR) + (theme === 'mystic' ? 0.9 : 0), 0);
				S.p.lerpVectors(S.from, to, u).y += Math.sin(Math.PI * u) * S.arc;
				if (theme === 'mystic') { ball.scale.setScalar(Math.max(0.05, u)); if (Math.random() < 0.5) burst(S.p.x, S.p.y, S.p.z, 2, 1, C.spark, 0.1, 0.6); }
				if (theme === 'magma' && Math.random() < 0.6) fx.emit(S.p.x, S.p.y, S.p.z, rand(-0.4, 0.4), rand(0, 1), rand(-0.4, 0.4), C.spark, 0.12, 0.5, 1);
				if (u >= 1) { S.state = 'aim'; S.t = 0; if (theme === 'magma') { burst(S.p.x, S.p.y, S.p.z, 12, 2, C.spark, 0.1, 0.5); K.noise(0.12, { vol: 0.12, f: 400, type: 'lowpass' }); } hud(); }
			}
			function trailFx(dt) {
				const n = theme === 'magma' ? 3 : theme === 'mystic' || theme === 'toxic' ? 2 : 1;
				if (C.mode === 'butt' || (C.dust && !S.bounced)) return;
				for (let i = 0; i < n; i++) if (Math.random() < dt * 40) fx.emit(S.p.x + rand(-0.05, 0.05), S.p.y, S.p.z, rand(-0.3, 0.3), rand(-0.1, theme === 'magma' ? 1 : 0.3), rand(-0.3, 0.3), C.trail, theme === 'magma' ? 0.22 : 0.14, theme === 'magma' ? 0.6 : 0.45, theme === 'toxic' ? -1 : 0.3);
			}
			function camera() {
				const g = floorY(0, 0), cx = S.px * 0.7;
				if (C.mode === 'butt') { K.cam(0.6, g + 1.75, 3.2, 0, g + GH + 0.1, GZ, 3); return; }
				const cam = K.camera, hw = Math.atan(Math.tan((cam.fov || 50) * Math.PI / 360) * (cam.aspect || 1));
				const span = Math.max(GW, 5) + 1.6, D = clamp(span / 2 / Math.tan(hw) / 0.93, 15, 32);
				const bz = S.state === 'fly' ? clamp(S.p.z, GZ + 1, 0) * 0.15 : 0;
				// (behind the spot, however long the shot)
				const cz = Math.max(GZ + D, 5.5) + bz;
				K.cam(cx, g + 1.6 + (cz - GZ) * 0.12 + (theme === 'mystic' ? 0.8 : 0), cz, cx * 0.5, g + 0.9 + (C.mode === 'ring' ? 0.8 : 0), GZ * 0.55, 3);
			}
			function settle() {
				const R = S.result || (C.mode === 'goal' ? 'wide' : 'miss');
				let pts = 0, say;
				if (R === 'goal') {
					pts = theme === 'magma' ? 1 + (S.shotHeat > 0.33) + (S.shotHeat > 0.66) : 1;
					if (theme === 'ice' && S.banked) { pts = 2; say = 'Bank shot! Goal!'; }
					else if (theme === 'ocean' && S.bounced) { pts = 2; say = 'Skip shot! Goal!'; }
					else if (theme === 'sky' && S.bounced) { pts = 2; say = 'Off the bounce! Goal!'; }
					else say = theme === 'magma' ? `Goal! ${pts} point${pts > 1 ? 's' : ''}` : 'Goal!';
					K.noise(0.5, { vol: 0.12, f: 900, q: 0.4 }); K.tone(660, 0.12, { vol: 0.1 }); K.tone(880, 0.25, { vol: 0.1, at: 0.12 });
				} else if (R === 'through') { pts = 1 + S.bonus; say = S.bonus ? 'Through the heart of it!' : 'Through!'; }
				else if (R === 'wicket') { pts = 1 + S.bonus; say = S.bonus ? 'Middle stump!' : 'Bowled!'; }
				else if (R === 'hit') { pts = S.ring; say = S.ring >= 10 ? 'Gold! 10' : S.ring ? `${S.ring}` : 'On the straw'; }
				else say = { save: 'Saved!', post: 'Off the post!', bar: 'Off the bar!', over: 'Over', wide: 'Wide', rim: 'Off the rim', miss: C.mode === 'butt' ? 'Missed the butt' : 'Missed', edge: 'Off the edge!' }[R] || 'Missed';
				S.score += pts;
				S.log.push(C.mode === 'butt' ? String(pts) : pts ? `${R}${pts > 1 ? '+' : ''}` : R);
				K.say(say, 1100);
				S.state = 'after'; S.t = 0; S.stuck = false; S.whirl = false;
				// the keeper throws one back
				if (theme === 'toxic') { keeper.play('throw', 0.7, true); S.throwT = 0.7; }
				if (theme === 'toxic') bombAt(clamp(S.pxT + rand(-0.8, 0.8), -6.5, 6.5), rand(-0.4, 0.8), 'acid');
				hud();
			}
			function over() {
				S.state = 'over';
				heatM?.hide();
				const best = C.mode === 'butt' ? `${S.log.filter((x) => x === '10').length} golds` : `${S.log.filter((x) => /goal|through|wicket/.test(x)).length} of ${S.of} in`;
				K.finish(S.score, { unit: 'points', line: best + (S.hits ? `, caught ${S.hits} time${S.hits > 1 ? 's' : ''}` : ''), rows: [[C.mode === 'butt' ? 'Arrows' : 'Shots', S.log.join(' · ')]] });
			}
			return K.wrap({ build, reset, update, press, move, end() { F.unlay(); for (const t of own) t.dispose(); } });
		},
	};
	return GAME;
}

// ---------- the shared effects ----------
// sparks, embers, drips and dust: points that fly, fall and fade (additive, or not for dust)
function sparks(K, THREE, N, add) {
	const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), P = [];
	for (let i = 0; i < N; i++) P.push({ v: [0, 0, 0], age: 1, life: 1, g: 0, s: 0, c: [1, 1, 1] });
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
	const mat = new THREE.ShaderMaterial({
		uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
		vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; }',
		fragmentShader: add ? 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * 1.4, a); }'
			: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, smoothstep(0.5, 0.1, d) * 0.45); }',
	});
	const pts = new THREE.Points(geo, mat);
	pts.frustumCulled = false; pts.renderOrder = 5;
	K.root.add(pts);
	let head = 0;
	return {
		emit(x, y, z, vx, vy, vz, c, s, life, g) {
			const p = P[head], i = head; head = (head + 1) % N;
			pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
			p.v[0] = vx; p.v[1] = vy; p.v[2] = vz; p.age = 0; p.life = life; p.g = g * 9.8; p.s = s; p.c = c;
		},
		tick(dt, Kit) {
			const cam = Kit.camera;
			mat.uniforms.uScale.value = Kit.size().height / (2 * Math.tan((cam.fov || 50) * Math.PI / 360));
			for (let i = 0; i < N; i++) {
				const p = P[i];
				if (p.age >= p.life) { size[i] = 0; continue; }
				p.age += dt; p.v[1] -= p.g * dt;
				pos[i * 3] += p.v[0] * dt; pos[i * 3 + 1] += p.v[1] * dt; pos[i * 3 + 2] += p.v[2] * dt;
				const k = 1 - p.age / p.life;
				size[i] = Math.max(0, p.s * (add ? k : 1 + (1 - k)));
				col[i * 3] = p.c[0] * (add ? k : 1); col[i * 3 + 1] = p.c[1] * (add ? k * k : 1); col[i * 3 + 2] = p.c[2] * (add ? k * k : 1);
			}
			geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true;
		},
	};
}
// the heat haze over a molten ball: a wavering veil of warm light, turned to the camera
function shimmer(K, THREE) {
	const mat = new THREE.ShaderMaterial({
		uniforms: { uT: { value: 0 }, uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
		vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uT, uK; varying vec2 vU;
			void main(){
				float w = sin(vU.y * 22.0 - uT * 7.0 + sin(vU.x * 9.0 + uT * 3.0) * 1.8) * 0.5 + 0.5;
				float edge = smoothstep(0.0, 0.3, vU.x) * smoothstep(1.0, 0.7, vU.x) * smoothstep(0.0, 0.2, vU.y) * smoothstep(1.0, 0.35, vU.y);
				gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * w * edge * uK * 0.22, 1.0);
			}`,
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6).translate(0, 0.8, 0), mat);
	mesh.renderOrder = 6;
	K.root.add(mesh);
	const q = new THREE.Quaternion();
	return {
		mesh,
		set(p, cam, k, t) {
			mesh.position.copy(p);
			K.root.getWorldQuaternion(q).invert();
			mesh.quaternion.copy(q.multiply(cam.quaternion));
			mat.uniforms.uK.value = k; mat.uniforms.uT.value = t;
		},
	};
}
// a dust devil: a leaning funnel of dust, turning
function dustDevil(K, THREE) {
	const tex = K.canvas(64, 128, (g) => {
		const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(200,160,110,0)'); gr.addColorStop(0.5, 'rgba(200,160,110,0.35)'); gr.addColorStop(1, 'rgba(190,150,100,0.55)');
		g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
		g.strokeStyle = 'rgba(120,90,60,0.25)'; g.lineWidth = 3;
		for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 12, 0); g.lineTo(i * 12 + 30, 128); g.stroke(); }
	});
	const g = K.group();
	const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
	for (let k = 0; k < 2; k++) K.mesh(new THREE.CylinderGeometry(1.4 - k * 0.3, 0.25, 6 - k, 14, 1, true).translate(0, (6 - k) / 2, 0), m, 0, 0, 0, g).rotation.y = k;
	return { g, x: 0, z: 0 };
}
// a soft round glow
const glowTex = (K) => K.canvas(64, 64, (g) => {
	const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
// a warning ring where something is coming down
const warnTex = (K, col) => K.canvas(64, 64, (g) => {
	g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 27, 0, Math.PI * 2); g.stroke();
	g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.stroke();
	g.fillStyle = col; g.beginPath(); g.arc(32, 32, 4, 0, Math.PI * 2); g.fill();
});

export const MAGMABALL = makeGame('magma');
export const TOXICDODGE = makeGame('toxic');
export const ICEPUCK = makeGame('ice');
export const SANDBALL = makeGame('arid');
export const ORBBALL = makeGame('mystic');
export const WATERPOLO = makeGame('ocean');
export const MOONBALL = makeGame('sky');
export const ARCHERY = makeGame('tourney');
