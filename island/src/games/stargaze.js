// Stargazing: lie back and join the dots. Six constellations as they really sit among the
// stars (drawn from the real right ascensions and declinations of their stars), one at a
// time, with a sprinkle of fainter stars around them to make it honest.
//   press on a star and drag to another to draw the line between them; lift and press
//     again to carry on. Only the constellation's real lines stick; a wrong line fades.
//   finish a figure to see its name drawn in; quicker and cleaner scores higher.
// The place for it is somewhere dark: the Chabot Space & Science Center's telescopes up
// in the Oakland hills, or Mount Tamalpais on an astronomy night, but any sky will do.

import { makeKit, clamp, rand } from './kit.js';

// [name, stars [RA hours, Dec degrees, magnitude], lines as star index pairs]
const SKY = [
	['The Big Dipper', [[11.06, 61.75, 1.8], [11.03, 56.38, 2.4], [11.9, 53.69, 2.4], [12.26, 57.03, 3.3], [12.9, 55.96, 1.8], [13.4, 54.93, 2.2], [13.79, 49.31, 1.9]], [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]],
	['Cassiopeia', [[0.15, 59.15, 2.3], [0.68, 56.54, 2.2], [0.95, 60.72, 2.2], [1.43, 60.24, 2.7], [1.91, 63.67, 3.4]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
	['Orion', [[5.92, 7.41, 0.5], [5.42, 6.35, 1.6], [5.68, -1.94, 1.8], [5.6, -1.2, 1.7], [5.53, -0.3, 2.2], [5.8, -9.67, 2.1], [5.24, -8.2, 0.1], [5.59, 9.93, 3.4]], [[7, 0], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]]],
	['Cygnus, the Northern Cross', [[20.69, 45.28, 1.3], [20.37, 40.26, 2.2], [19.51, 27.96, 3.1], [20.77, 33.97, 2.5], [19.75, 45.13, 2.9]], [[0, 1], [1, 2], [3, 1], [1, 4]]],
	['Leo', [[10.14, 11.97, 1.4], [10.12, 16.76, 3.5], [10.33, 19.84, 2.0], [10.28, 23.42, 3.4], [9.88, 26.01, 3.9], [9.76, 23.77, 3.0], [11.24, 20.52, 2.6], [11.82, 14.57, 2.1], [11.24, 15.43, 3.3]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 0]]],
	['Lyra', [[18.62, 38.78, 0.0], [18.75, 37.61, 4.3], [18.91, 36.9, 4.3], [18.98, 32.69, 3.2], [18.83, 33.36, 3.5]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]]],
];
const DOME = 40;

export const GAME = {
	id: 'stargaze',
	title: 'Stargazing',
	blurb: 'Join the dots of six real constellations, from the Big Dipper to Lyra.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#9fc4ff', dist: 0, span: [6, 6, 6], flat: 3 });
		const { THREE } = ctx;
		let stars = [], lines, band, rubber, S = {}, starTex, figure = null;

		function build() {
			// a night dome of our own, so it's night whenever you look up
			// (it writes depth, so the world outside it stays hidden)
			K.mesh(new THREE.SphereGeometry(DOME + 5, 32, 16), new THREE.MeshBasicMaterial({ color: 0x050a1c, side: THREE.BackSide, fog: false }), 0, 1.6, 0);
			starTex = K.canvas(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(220,235,255,.9)'); r.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
			// the faint field: a thousand dim stars all over
			const field = [];
			for (let i = 0; i < 1200; i++) { const u = rand(-1, 1), a = rand(0, Math.PI * 2), s = Math.sqrt(1 - u * u); field.push(Math.cos(a) * s * DOME, 1.6 + Math.abs(u) * DOME, Math.sin(a) * s * DOME); }
			const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(field, 3));
			K.root.add(new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.18, map: starTex, transparent: true, depthWrite: false, fog: false, color: 0xaabbdd })));
			lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9fc4ff, fog: false }));
			K.root.add(lines);
			rubber = K.el('position:absolute;inset:0;pointer-events:none', '<svg width="100%" height="100%" style="position:absolute;inset:0"><line data-r x1="0" y1="0" x2="0" y2="0" stroke="#9fc4ff" stroke-width="2" stroke-dasharray="6 5" opacity="0"/></svg>');
			band = K.el('position:absolute;left:50%;top:32%;transform:translateX(-50%);font:italic 600 26px Georgia,serif;color:#dfe9ff;text-shadow:0 0 12px #6a8aff;pointer-events:none;opacity:0;transition:opacity .6s;white-space:nowrap');
		}
		// a constellation laid on the dome above you, centred where you're looking
		function layFigure(k) {
			if (figure) K.drop(figure);
			figure = K.group();
			const [, st] = SKY[k];
			const ra0 = st.reduce((a, s) => a + s[0], 0) / st.length, de0 = st.reduce((a, s) => a + s[1], 0) / st.length;
			const dr = Math.PI / 180, c0 = Math.cos(de0 * dr);
			// gnomonic projection about the figure's centre, scaled to fill the view
			const pts = st.map(([ra, de]) => { const x = -(ra - ra0) * 15 * c0 * Math.cos(de * dr) / Math.cos(de0 * dr), y = de - de0; return [x, y]; });
			// sized to the screen: most of its width and height, whichever runs out first
			const half = (ctx.camera.fov || 60) * dr / 2, limY = half * 0.7, limX = Math.atan(Math.tan(half) * (ctx.camera.aspect || 1)) * 0.75;
			const spanX = Math.max(...pts.map(([x]) => Math.abs(x))) * dr || 1, spanY = Math.max(...pts.map(([, y]) => Math.abs(y))) * dr || 1;
			const sc = Math.min(limX / spanX, limY / spanY) * dr;
			stars = st.map(([, , mag], i) => {
				const [x, y] = pts[i], el = 0.95 + y * sc, az = x * sc;
				const p = new THREE.Vector3(Math.sin(az) * Math.cos(el) * DOME, 1.6 + Math.sin(el) * DOME, -Math.cos(az) * Math.cos(el) * DOME);
				const size = clamp(3.2 - mag * 0.55, 1, 3.4);
				const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffffff, fog: false, depthWrite: false }));
				sp.position.copy(p); sp.scale.setScalar(size); figure.add(sp);
				return { p, sp };
			});
			S.done = []; S.wrong = 0; S.t = 0; S.sel = -1;
			drawLines();
			K.hud(`${k + 1} of ${SKY.length} · ${SKY[k][2].length} lines to find · ${S.score} pts`);
		}
		function drawLines() {
			const arr = [];
			for (const [a, b] of S.done) arr.push(...stars[a].p.toArray(), ...stars[b].p.toArray());
			lines.geometry.dispose();
			lines.geometry = new THREE.BufferGeometry();
			lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
		}
		function reset() {
			S = { k: 0, score: 0, state: 'play', log: [] };
			layFigure(0);
		}
		// the star nearest a screen point, within a fingertip
		function starAt(x, y) {
			let best = -1, bd = 42;
			stars.forEach((s, i) => { const q = K.toScreen(s.p); const d = Math.hypot(q.x - x, q.y - y); if (q.front && d < bd) { bd = d; best = i; } });
			return best;
		}
		function press(down, x, y) {
			if (S.state !== 'play') return;
			const i = starAt(x, y);
			if (down) { if (i >= 0) { S.sel = i; K.tone(1200, 0.08, { vol: 0.05 }); } return; }
			rubberLine(null);
			if (i >= 0 && S.sel >= 0 && i !== S.sel) join(S.sel, i);
			if (i >= 0) S.sel = i;
		}
		function move(x, y) { if (S.state === 'play' && K.ptr.down && S.sel >= 0) rubberLine(K.toScreen(stars[S.sel].p), x, y); }
		function rubberLine(from, x, y) {
			const l = rubber.querySelector('[data-r]');
			if (!l) return;
			if (!from) { l.setAttribute('opacity', '0'); return; }
			const r = K.size();
			l.setAttribute('x1', String(from.x - r.left)); l.setAttribute('y1', String(from.y - r.top)); l.setAttribute('x2', String(x - r.left)); l.setAttribute('y2', String(y - r.top)); l.setAttribute('opacity', '0.8');
		}
		function join(a, b) {
			const want = SKY[S.k][2], ok = want.some(([p, q]) => (p === a && q === b) || (p === b && q === a)), have = S.done.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
			if (have) return;
			if (!ok) { S.wrong++; K.tone(200, 0.15, { vol: 0.05 }); K.say('Not a line of this one', 700); return; }
			S.done.push([a, b]); drawLines();
			K.tone(660 + S.done.length * 60, 0.25, { vol: 0.07 });
			if (S.done.length === want.length) {
				const pts = Math.max(20, Math.round(150 - S.t * 3 - S.wrong * 10));
				S.score += pts; S.log.push([SKY[S.k][0], pts]);
				band.textContent = SKY[S.k][0]; band.style.opacity = '1';
				S.state = 'named'; S.t = 0;
				K.tone(523, 0.4, { vol: 0.07 }); K.tone(659, 0.4, { vol: 0.07, at: 0.15 }); K.tone(784, 0.6, { vol: 0.07, at: 0.3 });
			}
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'named' && S.t > 2.2) {
				band.style.opacity = '0';
				S.k++;
				if (S.k < SKY.length) { S.state = 'play'; layFigure(S.k); }
				else { S.state = 'over'; K.finish(S.score, { unit: 'pts', line: 'Clear skies.', rows: S.log }); }
			}
			if (S.state === 'play') K.hud(`${S.k + 1} of ${SKY.length} · ${S.done.length} of ${SKY[S.k][2].length} lines · ${S.score} pts`);
			for (const s of stars) s.sp.material.opacity = 0.75 + Math.sin(K.time * 3 + s.p.x) * 0.25;
			K.cam(0, 1.6, 0.01, 0, 1.6 + Math.sin(0.95) * 10, -Math.cos(0.95) * 10, 3);
		}
		function end() { figure = null; stars = []; }
		return K.wrap({ build, reset, update, press, move, end });
	},
};
