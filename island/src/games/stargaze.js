// Stargazing: after dark, lie back and join the dots of the constellations that are really up
// tonight, on the real stars where they stand (world/sky.js turns the sky for the date and
// the hour; world/constellations.js has the figures). By day there is nothing to see:
// come back when it is dark.
//   press on a star and drag to another to draw the line between them; lift and press
//     again to carry on. Only the constellation's real lines stick; a wrong line fades.
//   finish a figure to see its name drawn in; quicker and cleaner scores higher.
// The place for it is somewhere dark: the Chabot Space & Science Center's telescopes up
// in the Oakland hills, or Mount Tamalpais on an astronomy night, but any clear sky will do.

import { makeKit, clamp } from './kit.js';
import { constellations } from '../world/constellations.js';

const DOME = 40, MAX = 6;

export const GAME = {
	id: 'stargaze',
	title: 'Stargazing',
	blurb: 'After dark: join the dots of the real constellations up tonight.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#9fc4ff', dist: 0, span: [6, 6, 6], flat: 3 });
		const { THREE } = ctx;
		const sky = () => ctx.getWorld()?.sky;
		let stars = [], lines, rubber, band, S = {}, starTex, figure = null, up = [];
		const look = new THREE.Vector3(), q = new THREE.Vector3();

		function build() {
			starTex = K.canvas(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(220,235,255,.9)'); r.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
			lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9fc4ff, fog: false, transparent: true, opacity: 0.85 }));
			K.root.add(lines);
			rubber = K.el('position:absolute;inset:0;pointer-events:none', '<svg width="100%" height="100%" style="position:absolute;inset:0"><line data-r x1="0" y1="0" x2="0" y2="0" stroke="#9fc4ff" stroke-width="2" stroke-dasharray="6 5" opacity="0"/></svg>');
			band = K.el('position:absolute;left:50%;top:32%;transform:translateX(-50%);font:italic 600 26px Georgia,serif;color:#dfe9ff;text-shadow:0 0 12px #6a8aff;pointer-events:none;opacity:0;transition:opacity .6s;white-space:nowrap');
		}
		// a direction on the sky tonight, in the game's own frame (turned with you)
		function local(ra, de, out) {
			sky().celestial(ra, de, out);
			return out.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -K.root.rotation.y);
		}
		// the figures up tonight, highest first: every star well above the horizon
		function tonight() {
			return constellations()
				.map((C) => { const lo = Math.min(...C.stars.map(([ra, de]) => local(ra, de, q).y)); const c = C.stars.reduce((a, [ra, de]) => a.add(local(ra, de, q)), new THREE.Vector3()).normalize(); return { C, lo, c }; })
				.filter((f) => f.lo > 0.2)
				.sort((a, b) => b.c.y - a.c.y)
				.slice(0, MAX);
		}
		// a constellation's stars where they really are, brightened to be picked out
		function layFigure(k) {
			if (figure) K.drop(figure);
			figure = K.group();
			const F = up[k];
			stars = F.C.stars.map(([ra, de, mag]) => {
				const p = local(ra, de, new THREE.Vector3()).multiplyScalar(DOME).add(new THREE.Vector3(0, 1.6, 0));
				const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffffff, fog: false, depthWrite: false, transparent: true }));
				sp.position.copy(p); sp.scale.setScalar(clamp(2.4 - mag * 0.35, 0.9, 2.6)); figure.add(sp);
				return { p, sp };
			});
			look.copy(F.c);
			S.done = []; S.wrong = 0; S.t = 0; S.sel = -1;
			drawLines();
			K.hud(`${k + 1} of ${up.length} · ${F.C.name.split(',')[0]} · ${F.C.lines.length} lines to find · ${S.score} pts`);
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
			// only after dark, and only what is up
			if (!sky()?.dark()) { S.state = 'over'; K.finish(0, { unit: 'pts', line: 'The stars come out after dark. Come back tonight.' }); return; }
			up = tonight();
			if (!up.length) { S.state = 'over'; K.finish(0, { unit: 'pts', line: 'Nothing well up just now. Try again later tonight.' }); return; }
			layFigure(0);
		}
		// the star nearest a screen point, within a fingertip
		function starAt(x, y) {
			let best = -1, bd = 42;
			stars.forEach((s, i) => { const p = K.toScreen(s.p); const d = Math.hypot(p.x - x, p.y - y); if (p.front && d < bd) { bd = d; best = i; } });
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
			const want = up[S.k].C.lines, ok = want.some(([p, r]) => (p === a && r === b) || (p === b && r === a)), have = S.done.some(([p, r]) => (p === a && r === b) || (p === b && r === a));
			if (have) return;
			if (!ok) { S.wrong++; K.tone(200, 0.15, { vol: 0.05 }); K.say('Not a line of this one', 700); return; }
			S.done.push([a, b]); drawLines();
			K.tone(660 + S.done.length * 60, 0.25, { vol: 0.07 });
			if (S.done.length === want.length) {
				const pts = Math.max(20, Math.round(150 - S.t * 3 - S.wrong * 10));
				S.score += pts; S.log.push([up[S.k].C.name.split(',')[0], pts]);
				band.textContent = up[S.k].C.name; band.style.opacity = '1';
				S.state = 'named'; S.t = 0;
				K.tone(523, 0.4, { vol: 0.07 }); K.tone(659, 0.4, { vol: 0.07, at: 0.15 }); K.tone(784, 0.6, { vol: 0.07, at: 0.3 });
			}
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'named' && S.t > 2.2) {
				band.style.opacity = '0';
				S.k++;
				if (S.k < up.length) { S.state = 'play'; layFigure(S.k); }
				else { S.state = 'over'; K.finish(S.score, { unit: 'pts', line: 'Clear skies.', rows: S.log }); }
			}
			if (S.state === 'play') K.hud(`${S.k + 1} of ${up.length} · ${S.done.length} of ${up[S.k].C.lines.length} lines · ${S.score} pts`);
			for (const s of stars) s.sp.material.opacity = 0.75 + Math.sin(K.time * 3 + s.p.x) * 0.25;
			// lying back, looking at the figure
			K.cam(0, 1.6, 0.01, look.x * 10, 1.6 + look.y * 10, look.z * 10, 3);
		}
		function end() { figure = null; stars = []; up = []; }
		return K.wrap({ build, reset, update, press, move, end });
	},
};
