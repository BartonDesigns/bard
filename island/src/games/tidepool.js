// Tide pooling at low tide: the Fitzgerald Marine Reserve at Moss Beach, or Duxbury Reef.
// Kneel over a pool and find what lives in it before the tide turns (sixty seconds).
//   the card lists the creatures in this pool; tap one when you spot it.
//   the sun glints off the water and the surge ripples it; the sculpin and the octopus are
//     the colour of the rocks, and the hermit crab won't stay still.
// Rarer finds are worth more: an ochre star is easy, a nudibranch takes looking for, and
// an octopus is the find of the day. Look, don't touch: nothing is picked up.

import { makeKit, rand } from './kit.js';

const TIME = 60;
const CRITTERS = [
	['Ochre sea star', 20], ['Giant green anemone', 20], ['Purple sea urchin', 30], ['Hermit crab', 40], ['Black turban snail', 30],
	['Gumboot chiton', 50], ['Opalescent nudibranch', 80], ['Tidepool sculpin', 70], ['Red octopus', 150], ['Aggregating anemones', 20], ['Shore crab', 40],
];

export const GAME = {
	id: 'tidepool',
	title: 'Tide Pools',
	blurb: 'Kneel over a rock pool at low tide and spot the sea stars, nudibranchs and the octopus.',
	where: { kind: 'site', sites: [{ name: 'Fitzgerald Marine Reserve, Moss Beach', lat: 37.5232, lon: -122.5163, r: 200 }, { name: 'Duxbury Reef, Bolinas', lat: 37.8936, lon: -122.6972, r: 250 }, { name: 'Pillar Point, Half Moon Bay', lat: 37.4955, lon: -122.4990, r: 200 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ff8a5a', dist: 1.2, span: [3, 2, 2], flat: 0.8, backdrop: 'sea', dome: 20, hole: 1.5, lift: 0.17 });
		const { THREE } = ctx;
		let glare, list, S = {}, found = [], marks = [];

		// each creature, built from a few shapes, returned as a group
		function critter(name) {
			const g = K.group();
			if (name === 'Ochre sea star') for (let i = 0; i < 5; i++) { const a = K.box(0.03, 0.02, 0.12, '#b0508a', 0, 0.01, 0, g); a.rotation.y = i * Math.PI * 2 / 5; a.translateZ(0.05); }
			else if (name === 'Giant green anemone') { K.cyl(0.07, 0.08, 0.04, '#3ea36a', 0, 0.02, 0, g, 16); K.cyl(0.035, 0.035, 0.041, '#9ad86a', 0, 0.021, 0, g, 16); }
			else if (name === 'Aggregating anemones') for (let i = 0; i < 6; i++) K.cyl(0.02, 0.025, 0.03, '#8aa86a', rand(-0.05, 0.05), 0.015, rand(-0.05, 0.05), g, 10);
			else if (name === 'Purple sea urchin') { K.ball(0.045, '#5a2a7a', 0, 0.02, 0, g); for (let i = 0; i < 14; i++) { const s = K.cyl(0.003, 0.001, 0.06, '#7a3aa0', 0, 0.02, 0, g, 4); s.rotation.set(rand(0, 3), rand(0, 3), 0); } }
			else if (name === 'Hermit crab') { K.mesh(new THREE.ConeGeometry(0.03, 0.06, 10), '#6a5a4a', 0, 0.02, 0, g).rotation.x = Math.PI / 2; K.ball(0.012, '#c0503a', 0, 0.01, -0.035, g); }
			else if (name === 'Black turban snail') K.mesh(new THREE.ConeGeometry(0.02, 0.03, 10), '#1a1a1a', 0, 0.015, 0, g);
			else if (name === 'Gumboot chiton') K.mesh(new THREE.SphereGeometry(0.06, 12, 6), '#7a3a2a', 0, 0, 0, g).scale.set(0.7, 0.25, 1.2);
			else if (name === 'Opalescent nudibranch') { K.mesh(new THREE.SphereGeometry(0.02, 10, 6), '#e8e0f0', 0, 0.008, 0, g).scale.set(0.6, 0.4, 1.8); for (let i = 0; i < 6; i++) K.ball(0.006, '#ff9a3a', rand(-0.01, 0.01), 0.015, -0.025 + i * 0.01, g); }
			else if (name === 'Tidepool sculpin') { K.mesh(new THREE.SphereGeometry(0.025, 10, 6), '#6a6452', 0, 0.01, 0, g).scale.set(0.6, 0.5, 2); K.box(0.001, 0.02, 0.02, '#6a6452', 0, 0.015, 0.05, g); }
			else if (name === 'Red octopus') { K.mesh(new THREE.SphereGeometry(0.035, 12, 8), '#6a5a4c', 0, 0.02, 0, g).scale.set(1, 0.7, 1.2); for (let i = 0; i < 8; i++) { const a = K.box(0.008, 0.005, 0.07, '#6a5a4c', 0, 0.005, 0, g); a.rotation.y = i * Math.PI / 4; a.translateZ(0.05); } }
			else if (name === 'Shore crab') { K.mesh(new THREE.SphereGeometry(0.03, 10, 6), '#3a4a2a', 0, 0.01, 0, g).scale.set(1.3, 0.4, 1); for (const s of [-1, 1]) K.ball(0.01, '#3a4a2a', s * 0.04, 0.01, -0.02, g); }
			return g;
		}
		function build() {
			// the pool: a rocky rim, a sandy and cobbled floor, a skin of water with glare on it
			const floor = K.canvas(256, 256, (g) => {
				g.fillStyle = '#5a5448'; g.fillRect(0, 0, 256, 256);
				for (let i = 0; i < 160; i++) { g.fillStyle = `hsl(${30 + rand(-10, 20)},${rand(5, 20)}%,${rand(22, 45)}%)`; g.beginPath(); g.ellipse(rand(0, 256), rand(0, 256), rand(4, 18), rand(3, 12), rand(0, 3), 0, 7); g.fill(); }
				for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(60,120,60,${rand(0.3, 0.7)})`; g.lineWidth = rand(2, 5); g.beginPath(); const x = rand(0, 256), y = rand(0, 256); g.moveTo(x, y); g.quadraticCurveTo(x + rand(-20, 20), y - 20, x + rand(-30, 30), y - rand(20, 40)); g.stroke(); }
			});
			K.mesh(new THREE.CircleGeometry(1.1, 40), K.mat('#ffffff', { map: floor, rough: 1 }), 0, -0.14, 0).rotation.x = -Math.PI / 2;
			for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = rand(0.18, 0.3); const rock = K.mesh(new THREE.DodecahedronGeometry(r, 0), K.mat('#4a463e', { rough: 1 }), Math.cos(a) * 1.2, -0.02, Math.sin(a) * 1.2); rock.rotation.set(rand(0, 3), rand(0, 3), 0); rock.scale.y = 0.6; }
			K.mesh(new THREE.CircleGeometry(1.12, 40), K.mat('#6ab0c0', { opacity: 0.18, rough: 0.05, metal: 0.4 }), 0, -0.02, 0).rotation.x = -Math.PI / 2;
			const gl = K.canvas(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 5, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,.85)'); r.addColorStop(0.4, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
			glare = K.mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: gl, transparent: true, depthWrite: false }), 0, -0.015, 0);
			glare.rotation.x = -Math.PI / 2;
			list = K.el('position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom));padding:8px 12px;border-radius:14px;background:rgba(8,20,26,.8);border:1px solid rgba(255,255,255,.18);color:#eafaf6;font:12px/1.5 system-ui;pointer-events:none;max-width:60vw');
		}
		function reset() {
			for (const f of found) K.drop(f.g);
			for (const m of marks) K.drop(m);
			found = []; marks = [];
			// this pool: seven kinds (the octopus only sometimes), hidden about the floor
			const pool = CRITTERS.filter(([n]) => n !== 'Red octopus' && n !== 'Shore crab').sort(() => Math.random() - 0.5).slice(0, 6);
			if (Math.random() < 0.6) pool.push(CRITTERS.find(([n]) => n === 'Red octopus'));
			else pool.push(CRITTERS.find(([n]) => n === 'Shore crab'));
			for (const [name, pts] of pool) {
				const g = critter(name), a = rand(0, Math.PI * 2), r = rand(0.1, 0.85);
				g.position.set(Math.cos(a) * r, -0.13, Math.sin(a) * r);
				g.rotation.y = rand(0, 6.3);
				found.push({ name, pts, g, seen: false, a, r });
			}
			S = { time: TIME, score: 0, state: 'look', t: 0 };
			drawList();
		}
		function drawList() {
			list.innerHTML = '<div style="font-weight:700;color:#ff8a5a;margin-bottom:2px">In this pool</div>' + found.map((f) => `<div style="${f.seen ? 'opacity:.55;text-decoration:line-through' : ''}">${f.seen ? '✓' : '·'} ${f.name} <span style="opacity:.6">${f.pts}</span></div>`).join('');
		}
		function press(down, x, y) {
			if (!down || S.state !== 'look') return;
			const hit = K.pick(x, y, found.filter((f) => !f.seen).map((f) => f.g));
			let f = hit ? found.find((q) => { let o = hit.object; while (o && o !== q.g) o = o.parent; return !!o; }) : null;
			if (!f) {
				// a fingertip is bigger than a nudibranch: count a tap close enough on screen
				let bd = 34;
				for (const q of found) if (!q.seen) { const p = K.toScreen(q.g.position); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; f = q; } }
			}
			if (!f) { K.noise(0.08, { vol: 0.05, f: 900 }); return; }
			f.seen = true; S.score += f.pts;
			const ring = K.mesh(new THREE.RingGeometry(0.08, 0.095, 24), K.mat('#ffe066', { basic: true, opacity: 0.9 }), f.g.position.x, -0.01, f.g.position.z);
			ring.rotation.x = -Math.PI / 2;
			marks.push(ring);
			K.say(`${f.name}! +${f.pts}`, 1100);
			K.tone(880 + f.pts * 3, 0.15, { vol: 0.1 });
			drawList();
			if (found.every((q) => q.seen)) { S.score += Math.ceil(S.time) * 5; K.say('You found them all! Time bonus.', 1600); over(); }
		}
		function over() {
			S.state = 'over';
			const n = found.filter((f) => f.seen).length;
			K.finish(S.score, { unit: 'pts', line: `${n} of ${found.length} found${found.some((f) => f.name === 'Red octopus' && f.seen) ? ', including the octopus!' : ''}`, rows: found.filter((f) => !f.seen).map((f) => ['Missed', f.name]) });
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'look') { S.time -= dt; if (S.time <= 0) over(); }
			// the surge rocks the glare about; the hermit crab wanders; the sculpin darts now and then
			glare.position.set(Math.sin(K.time * 0.37) * 0.45, -0.015, Math.cos(K.time * 0.29) * 0.4);
			glare.scale.setScalar(1 + Math.sin(K.time * 1.3) * 0.2);
			for (const f of found) {
				if (f.name === 'Hermit crab' && !f.seen) { f.a += dt * 0.12; f.g.position.set(Math.cos(f.a) * f.r, -0.13, Math.sin(f.a) * f.r); f.g.rotation.y = -f.a; }
				if (f.name === 'Tidepool sculpin' && !f.seen && Math.random() < dt * 0.25) { f.a += rand(-0.6, 0.6); f.r = Math.min(0.85, Math.max(0.1, f.r + rand(-0.2, 0.2))); f.g.position.set(Math.cos(f.a) * f.r, -0.13, Math.sin(f.a) * f.r); }
			}
			K.hud(`${Math.max(0, Math.ceil(S.time))} s · ${S.score} pts`);
			K.cam(0, 1.25, 0.55, 0, -0.1, -0.05, 3);
		}
		return K.wrap({ build, reset, update, press });
	},
};
