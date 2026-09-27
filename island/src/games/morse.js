// The lamp at Point Bonita: fog rolls in through the Golden Gate, and ships feeling their way
// past the headland signal with their lamps. Answer each one in Morse before it's too
// close to the rocks. Ninety seconds.
//   the word to send is on the card, with its dots and dashes; tap the screen for a dot,
//     hold for a dash. Pause and the letter is sent; a wrong letter buzzes, send it again.
//   the lighthouse lamp flashes as you key; the ship comes on through the fog while you
//     work, so the quicker the better.
// Timing is forgiving: anything shorter than a quarter of a second is a dot, anything
// longer a dash, and a gap of more than half a second ends the letter.

import { makeKit, rand } from './kit.js';

const TIME = 90, DASH = 0.25, GAP = 0.55;
const CODE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
const WORDS = ['SOS', 'FOG', 'BAY', 'GATE', 'SHIP', 'TAM', 'PIER', 'SEAL', 'HORN', 'MIST', 'TIDE', 'KARL', 'MARIN', 'CRAB', 'NORTH', 'LIGHT'];
const pretty = (c) => c.replace(/\./g, '•').replace(/-/g, '—');

export const GAME = {
	id: 'morse',
	title: 'Lighthouse Morse',
	blurb: 'Signal the ships in the fog from Point Bonita: tap dots, hold dashes, before they reach the rocks.',
	where: { kind: 'site', sites: [{ name: 'Point Bonita Lighthouse', lat: 37.8157, lon: -122.5297, r: 150 }, { name: 'Fort Point', lat: 37.8106, lon: -122.4771, r: 100 }, { name: 'Alcatraz lighthouse', lat: 37.8262, lon: -122.4222, r: 120 }, { name: 'Point Reyes Lighthouse', lat: 37.9956, lon: -123.0233, r: 150 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffe27a', dist: 1.5, span: [3, 3] });
		const { THREE } = ctx;
		let lamp, beam, ship, shipLamp, card, fogs = [], S = {};

		function build() {
			// the lighthouse beside you, the headland rocks, the sea, the fog banks, the ship
			K.cyl(0.9, 1.1, 5, '#f4f4f0', 2.5, 2.5, -1);
			K.cyl(0.7, 0.7, 1.2, '#2a2a2a', 2.5, 5.6, -1);
			lamp = K.ball(0.45, K.mat('#fff2b0', { glow: 0.2 }), 2.5, 5.6, -1);
			K.mesh(new THREE.ConeGeometry(1, 0.7, 16), '#b83a2a', 2.5, 6.55, -1);
			beam = K.mesh(new THREE.ConeGeometry(2.5, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 2.5, 5.6, -16);
			beam.rotation.x = Math.PI / 2;
			for (let i = 0; i < 7; i++) K.mesh(new THREE.DodecahedronGeometry(rand(1, 2.2), 0), K.mat('#3a3630', { rough: 1 }), rand(-6, 6), -1, rand(-4, -1)).scale.y = 0.6;
			K.mesh(new THREE.PlaneGeometry(200, 160), K.mat('#2a4a58', { rough: 0.3, metal: 0.2 }), 0, -1.5, -80).rotation.x = -Math.PI / 2;
			for (let i = 0; i < 6; i++) {
				const f = K.mesh(new THREE.PlaneGeometry(60, 14), new THREE.MeshBasicMaterial({ color: 0xc8d0d4, transparent: true, opacity: 0.35, depthWrite: false }), rand(-20, 20), 4, -18 - i * 12);
				f.userData.x0 = f.position.x; fogs.push(f);
			}
			ship = K.group();
			K.box(6, 1.2, 1.8, '#3a2a22', 0, 0, 0, ship);
			K.box(2.2, 1.2, 1.4, '#e8e4dc', -0.8, 1.2, 0, ship);
			K.cyl(0.25, 0.25, 1.2, '#b83a2a', -0.4, 2.3, 0, ship);
			shipLamp = K.ball(0.25, K.mat('#ffd060', { glow: 0.3 }), 1.6, 1.3, 0.9, ship);
			card = K.el('position:absolute;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:10px 16px;border-radius:16px;background:rgba(8,20,26,.85);border:1px solid rgba(255,255,255,.18);color:#eafaf6;font:13px system-ui;text-align:center;pointer-events:none;min-width:220px');
		}
		function reset() {
			S = { time: TIME, score: 0, sent: 0, state: 'play', word: '', li: 0, keyed: '', down: false, downT: 0, upT: 0, dist: 0, errors: 0, flash: 0, log: [] };
			nextWord();
		}
		function nextWord() {
			let w;
			do w = WORDS[Math.floor(Math.random() * WORDS.length)]; while (w === S.word);
			S.word = w; S.li = 0; S.keyed = ''; S.dist = 1; S.wordT = 0;
			draw();
		}
		function draw() {
			const letters = [...S.word].map((c, i) => `<span style="display:inline-block;margin:0 5px;${i < S.li ? 'color:#6bd66b' : i === S.li ? 'color:#ffe27a' : 'opacity:.6'}"><b style="font-size:22px">${c}</b><br><span style="font-size:13px">${pretty(CODE[c])}</span></span>`).join('');
			card.innerHTML = `<div style="opacity:.75;margin-bottom:4px">Signal the ship:</div>${letters}<div style="margin-top:6px;min-height:18px;font:600 16px system-ui;letter-spacing:3px">${pretty(S.keyed) || '<span style="opacity:.5;font-size:12px;letter-spacing:0">tap • · hold —</span>'}</div>`;
		}
		function press(down) {
			if (S.state !== 'play') return;
			if (down && !S.down) { S.down = true; S.downT = 0; S.release = K.hum(620, 0.07); }
			else if (!down && S.down) {
				S.down = false;
				S.keyed += S.downT < DASH ? '.' : '-';
				S.upT = 0;
				S.release?.(); S.release = null;
				draw();
			}
		}
		function letterDone() {
			const want = CODE[S.word[S.li]];
			if (S.keyed === want) {
				S.li++; S.keyed = ''; K.tone(880, 0.1, { vol: 0.06 });
				if (S.li >= S.word.length) {
					const pts = Math.round(30 * S.word.length + 60 * Math.max(0, S.dist));
					S.score += pts; S.sent++; S.log.push(S.word);
					K.say(`${S.word} received! +${pts}`, 1300);
					S.shipFlash = 1.2;
					nextWord(); return;
				}
			} else {
				S.errors++; S.keyed = '';
				K.tone(140, 0.25, { type: 'square', vol: 0.05 });
				K.say(`That was ${Object.keys(CODE).find((k) => CODE[k] === S.keyedLast) || '?'}: try ${S.word[S.li]} again`, 1100);
			}
			draw();
		}
		function update(dt) {
			if (S.state === 'play') {
				S.time -= dt; S.wordT += dt;
				// the ship closes in; if it reaches the rocks, it sounds its horn and turns away
				S.dist -= dt / 22;
				if (S.dist <= 0) { K.say('Too slow: the ship sheers off with a blast of its horn.', 1600); K.tone(110, 1.2, { type: 'sawtooth', vol: 0.06 }); nextWord(); }
				if (S.down) S.downT += dt;
				else if (S.keyed) { S.upT += dt; if (S.upT > GAP) { S.keyedLast = S.keyed; letterDone(); } }
				if (S.time <= 0) {
					S.state = 'over';
					K.finish(S.score, { unit: 'pts', line: `${S.sent} ship${S.sent === 1 ? '' : 's'} answered${S.errors ? `, ${S.errors} letters resent` : ', not a letter wrong'}`, rows: [['Words', S.log.join(', ') || '–']] });
				}
			}
			// the lamp burns while the key is down; the ship's lamp blinks back when it hears you
			S.flash += ((S.down ? 1 : 0) - S.flash) * Math.min(1, dt * 25);
			lamp.material.emissiveIntensity = 1 + S.flash * 5;
			beam.material.opacity = S.flash * 0.25;
			S.shipFlash = Math.max(0, (S.shipFlash || 0) - dt);
			shipLamp.visible = S.shipFlash > 0 ? Math.floor(S.shipFlash * 8) % 2 === 0 : Math.floor(K.time * 1.5) % 3 === 0;
			ship.position.set(-8 + (1 - S.dist) * 10, -0.9 + Math.sin(K.time * 0.8) * 0.1, -50 + (1 - S.dist) * 34);
			ship.rotation.z = Math.sin(K.time * 0.6) * 0.04;
			for (const f of fogs) f.position.x = f.userData.x0 + Math.sin(K.time * 0.05 + f.position.z) * 8;
			K.hud(`${Math.max(0, Math.ceil(S.time))} s · ${S.score} pts · ships answered ${S.sent}`);
			K.cam(-0.5, 3.2, 3, 0, 1.5, -30, 2);
		}
		function end() { S.release?.(); }
		return K.wrap({ build, reset, update, press, end });
	},
};
