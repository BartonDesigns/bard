// Secrets and surprises: the things the world keeps for those who look.
//   the Bard's lost verses: five scrolls hidden across the Bay (Fort Point under the
//     Golden Gate, the Sutro Baths ruins, Rock City's wind caves, the pole on Mission
//     Peak, Mt Tam's East Peak). Each glints from afar; walk up to one to read its line.
//     Find all five and the sky celebrates. Ask the guide about "the Bard's verses" for
//     a riddle to the next one.
//   fireworks: on the Fourth of July and New Year's Eve after dark, over the nearest
//     water or town; for the verses; and for anyone who types ↑↑↓↓←→←→BA or asks the
//     guide for them
//   the Golden Gate's foghorns, low and two-toned, when the weather closes in or on a
//     grey morning near the bridge
//   the calendar (calendar.js): Halloween porches, holiday lights, the Diablo beacon on
//     7 December, the Perseids and Geminids
//   and a welcome when you walk up to your own front door

import * as THREE from 'three';
import { toWorld } from './bay/geo.js';
import { occasions } from './calendar.js';

const VERSES = [
	{ id: 'fortpoint', lat: 37.81045, lon: -122.47700, place: 'Fort Point', line: 'Where the red span meets the cold Pacific swell,', clue: 'Under the red span’s southern foot, where the old brick fort watches the tide.' },
	{ id: 'sutro', lat: 37.78020, lon: -122.51330, place: 'Sutro Baths', line: 'the old baths hold the sea they could not sell;', clue: 'In the ruins at Land’s End, where the sea was once let indoors to swim in.' },
	{ id: 'rockcity', lat: 37.84555, lon: -121.93930, place: 'Rock City', line: 'the wind has carved its chambers in the stone,', clue: 'Among the wind caves of Mt Diablo’s sandstone city.' },
	{ id: 'missionpeak', lat: 37.51275, lon: -121.88035, place: 'Mission Peak', line: 'a lone pole marks the summit hikers own;', clue: 'By the pole on Mission Peak, where every hiker takes a picture.' },
	{ id: 'tam', lat: 37.92895, lon: -122.57745, place: 'Mt Tamalpais', line: 'climb high, look back: each little light is home.', clue: 'On the East Peak of the Sleeping Lady, below the fire lookout.' },
];
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const GG = toWorld(37.8199, -122.4783);

function glowTexture() {
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,0.55)'); gr.addColorStop(1, 'rgba(255,190,80,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

// ---------- fireworks: shells, their sparks, and the boom after the light ----------
function createFireworks(scene, isPhone) {
	const MAX = isPhone ? 2600 : 7000;
	const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), size = new Float32Array(MAX);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
	const mat = new THREE.ShaderMaterial({
		uniforms: { uScale: { value: 400 } },
		vertexShader: `attribute float aSize; varying vec3 vC; uniform float uScale;
			void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 48.0); }`,
		fragmentShader: `varying vec3 vC;
			void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(vC * (1.0 - r) * (1.0 - r), 1.0); }`,
		vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
	});
	const pts = new THREE.Points(geo, mat);
	pts.frustumCulled = false; pts.renderOrder = 3;
	scene.add(pts);
	const P = [];            // live particles
	const PAL = [[1, 0.25, 0.2], [0.3, 0.6, 1], [1, 0.85, 0.3], [0.4, 1, 0.5], [1, 0.4, 0.9], [1, 1, 1], [0.95, 0.55, 0.15]];
	const spark = (x, y, z, vx, vy, vz, c, life, sz, drag, grav, kind = 0) => { if (P.length < MAX) P.push({ x, y, z, vx, vy, vz, c, life, max: life, sz, drag, grav, kind, trail: 0 }); };
	let audio = null;
	function boom(x, y, z, cam, big) {
		if (!audio || audio.state !== 'running') return;
		const d = Math.hypot(x - cam.position.x, y - cam.position.y, z - cam.position.z), t0 = audio.currentTime + d / 343;
		const len = audio.sampleRate * 1.6, buf = audio.createBuffer(1, len, audio.sampleRate), ch = buf.getChannelData(0);
		for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * (0.18 + big * 0.2)));
		const s = audio.createBufferSource(); s.buffer = buf;
		const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260 + 900 * Math.max(0, 1 - d / 2500);
		const g = audio.createGain(); g.gain.value = Math.min(0.9, 700 / (d + 200)) * (0.6 + big * 0.5);
		s.connect(lp).connect(g).connect(audio.destination);
		s.start(t0);
	}
	function burst(x, y, z, cam, n, pal, shape) {
		const c1 = PAL[pal % PAL.length], c2 = PAL[(pal + 3) % PAL.length], v = shape === 'sparkle' ? 2.2 : 72 + Math.random() * 30;      // real shells open 150-300 m across
		for (let i = 0; i < n; i++) {
			// directions spread evenly over the sphere (a golden spiral), or round a ring
			let dx, dy, dz;
			if (shape === 'ring') { const a = i / n * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a) * 0.25; dz = Math.sin(a); }
			else { const k = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - k * k), a = i * 2.39996; dx = Math.cos(a) * r; dy = k; dz = Math.sin(a) * r; }
			if (shape === 'sparkle') { const sp = v * (0.4 + Math.random()); spark(x, y, z, dx * sp, dy * sp + 1, dz * sp, [1, 0.85, 0.45], 0.9 + Math.random() * 0.8, 0.06, 1.5, -0.6, 1); continue; }
			const c = shape === 'willow' ? [1, 0.72, 0.3] : (i % 2 ? c1 : c2), sp = v * (0.9 + Math.random() * 0.2);
			spark(x, y, z, dx * sp, dy * sp, dz * sp, c, shape === 'willow' ? 3.4 + Math.random() : 1.8 + Math.random() * 0.9, shape === 'willow' ? 3.2 : 4.2, shape === 'willow' ? 1.5 : 1.0, shape === 'willow' ? 8 : 5, 1);
		}
		if (shape !== 'sparkle') boom(x, y, z, cam, n > 120 ? 1 : 0.5);
	}
	function launch(x, g, z) {
		const vy = 78 + Math.random() * 22;
		spark(x, g + 2, z, (Math.random() - 0.5) * 6, vy, (Math.random() - 0.5) * 6, [1, 0.8, 0.5], 2.3 + Math.random() * 0.7, 3.5, 0.2, 9.8, 2);
	}
	let show = null;
	function start(seconds, cam, heightAt, finale = true) {
		// in front of you, a kilometre or so off, over the water or the town
		const d = new THREE.Vector3();
		cam.getWorldDirection(d); d.y = 0;
		if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
		d.normalize();
		const dist = 800 + Math.random() * 400, x = cam.position.x + d.x * dist, z = cam.position.z + d.z * dist;
		show = { x, z, g: Math.max(0, heightAt(x, z)), t: 0, end: seconds, next: 0, finale, side: new THREE.Vector3(-d.z, 0, d.x) };
	}
	function update(dt, cam) {
		if (show) {
			show.t += dt; show.next -= dt;
			if (show.next <= 0) {
				const fin = show.finale && show.t > show.end - 6;
				for (let k = 0, n = fin ? 3 : 1; k < n; k++) { const o = (Math.random() - 0.5) * 500; launch(show.x + show.side.x * o, show.g, show.z + show.side.z * o); }
				show.next = fin ? 0.35 + Math.random() * 0.3 : 0.7 + Math.random() * 1.6;
			}
			if (show.t > show.end) show = null;
		}
		if (!P.length) { pts.visible = false; return; }
		pts.visible = true;
		let n = 0;
		for (let i = P.length - 1; i >= 0; i--) {
			const p = P[i];
			p.life -= dt;
			if (p.life <= 0) {
				if (p.kind === 2) { const r = Math.random(); burst(p.x, p.y, p.z, cam, (isPhone ? 70 : 140) + Math.floor(Math.random() * 40), Math.floor(Math.random() * 7), r < 0.2 ? 'ring' : r < 0.4 ? 'willow' : 'peony'); }
				P[i] = P[P.length - 1]; P.pop();
				continue;
			}
			const k = Math.exp(-p.drag * dt);
			p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			// the rocket leaves a short trail of sparks
			if (p.kind === 2 && (p.trail += dt) > 0.03) { p.trail = 0; spark(p.x, p.y, p.z, 0, -2, 0, [1, 0.6, 0.3], 0.5, 2.2, 2, 2, 0); }
		}
		for (const p of P) {
			if (n >= MAX) break;
			const f = p.life / p.max, tw = p.kind === 1 && f < 0.35 ? (Math.random() < 0.5 ? 0.3 : 1) : 1;       // crackle as they die
			const b = Math.min(1, f * 1.6) * tw * (p.kind === 1 ? 2.2 : 1.6);
			pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
			col[n * 3] = p.c[0] * b; col[n * 3 + 1] = p.c[1] * b; col[n * 3 + 2] = p.c[2] * b;
			size[n] = p.sz * (0.6 + 0.4 * f);
			n++;
		}
		geo.setDrawRange(0, n);
		for (const a of ['position', 'color', 'aSize']) geo.attributes[a].needsUpdate = true;
	}
	return { start, update, burst, busy: () => !!show, setAudio: (a) => { audio = a; }, count: () => P.length, dbg: () => ({ show: show && { x: Math.round(show.x), z: Math.round(show.z), g: show.g, t: show.t.toFixed(1) }, p: P.slice(0, 3).map((q) => [Math.round(q.x), Math.round(q.y), Math.round(q.z), q.life.toFixed(2), q.kind]) }) };
}

export function createSurprises({ scene, camera, getWorld, hint, say, isPhone = false }) {
	const occ = occasions();
	const fw = createFireworks(scene, isPhone);
	let audio = null;
	const wake = () => {
		if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
		try { audio = new (window.AudioContext || window.webkitAudioContext)(); fw.setAudio(audio); } catch { audio = null; }
	};
	for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { passive: true });

	// ---------- sounds ----------
	function chime() {
		if (!audio || audio.state !== 'running') return;
		const t = audio.currentTime;
		[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
			const o = audio.createOscillator(), g = audio.createGain();
			o.type = 'sine'; o.frequency.value = f;
			g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.12, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.4);
			o.connect(g).connect(audio.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.5);
		});
	}
	// the Golden Gate's foghorns: a two-tone diaphone, the high note then the low
	function foghorn(gain) {
		if (!audio || audio.state !== 'running') return;
		const t = audio.currentTime;
		const echo = audio.createDelay(1); echo.delayTime.value = 0.42;
		const fb = audio.createGain(); fb.gain.value = 0.3;
		const out = audio.createGain(); out.gain.value = gain;
		echo.connect(fb).connect(echo); echo.connect(out); out.connect(audio.destination);
		for (const [f, at, dur] of [[196, 0, 1.7], [155, 2.1, 2.3]]) {
			const o1 = audio.createOscillator(), o2 = audio.createOscillator(), lp = audio.createBiquadFilter(), g = audio.createGain();
			o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = f; o2.frequency.value = f * 1.004;
			lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 1.4;
			g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(0.5, t + at + 0.18); g.gain.setValueAtTime(0.5, t + at + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + at + dur);
			o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out); g.connect(echo);
			for (const o of [o1, o2]) { o.start(t + at); o.stop(t + at + dur + 0.05); }
		}
	}

	// ---------- the verses ----------
	let found = {};
	try { found = JSON.parse(localStorage.getItem('crysis-verses') || '{}') || {}; } catch { found = {}; }
	const glowTex = glowTexture();
	const scrolls = [];
	const parchment = new THREE.MeshStandardMaterial({ color: 0xe9d9ae, roughness: 0.8, emissive: 0x3a2a10 });
	const knob = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 });
	const ribbon = new THREE.MeshStandardMaterial({ color: 0xa01818, roughness: 0.5 });
	function makeScroll() {
		const g = new THREE.Group();
		const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 16), parchment); body.rotation.z = Math.PI / 2; g.add(body);
		for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), knob); k.position.x = s * 0.24; g.add(k); }
		const rb = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.012, 6, 20), ribbon); rb.rotation.y = Math.PI / 2; g.add(rb);
		const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
		halo.scale.setScalar(1.4); g.add(halo);
		g.userData.halo = halo;
		return g;
	}
	const count = () => VERSES.filter((v) => found[v.id]).length;
	function poem() { return VERSES.map((v) => v.line).join('\n'); }
	function collect(v) {
		found[v.id] = Date.now();
		try { localStorage.setItem('crysis-verses', JSON.stringify(found)); } catch { /* private mode: kept for this visit */ }
		const n = count();
		chime();
		const s = scrolls.find((q) => q.v === v);
		if (s) { fw.burst(s.g.position.x, s.g.position.y, s.g.position.z, camera, isPhone ? 50 : 90, 2, 'sparkle'); s.g.visible = false; }
		hint(`The Bard’s lost verse ${n} of ${VERSES.length} · ${v.place}\n“${v.line}”`, 8000);
		say?.(`You found a lost verse at ${v.place}: “${v.line}” (${n} of ${VERSES.length})`, 'note');
		if (n === VERSES.length) setTimeout(() => {
			hint('All five of the Bard’s verses, found:\n' + poem(), 16000);
			say?.('The Bard’s lost verses, complete:\n' + poem(), 'note');
			fw.start(40, camera, (x, z) => getWorld()?.island.heightAt(x, z) ?? 0);
		}, 3500);
	}
	function placeScrolls(W) {
		for (const v of VERSES) {
			const p = toWorld(v.lat, v.lon), g = makeScroll();
			const y = Math.max(0.3, W.island.heightAt(p.x, p.z)) + 1.25;
			g.position.set(p.x, y, p.z);
			g.visible = !found[v.id];
			scene.add(g);
			scrolls.push({ v, g, y, ph: Math.random() * 6 });
			// the pole on Mission Peak, that everyone photographs themselves beside
			if (v.id === 'missionpeak') {
				const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.35, metalness: 0.8 }));
				pole.position.set(p.x + 1.6, y - 1.25 + 1.2, p.z + 0.8);
				scene.add(pole);
			}
		}
	}

	// ---------- a welcome home ----------
	let home = null, welcomed = false;
	try { const h = JSON.parse(localStorage.getItem('crysis-home') || 'null'); if (h) home = { ...toWorld(h.lat, h.lon), name: h.name || 'Home' }; } catch { home = null; }

	// ---------- keys ----------
	const keys = [];
	addEventListener('keydown', (e) => {
		keys.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
		if (keys.length > KONAMI.length) keys.shift();
		if (keys.join() === KONAMI.join()) { keys.length = 0; celebrate('↑↑↓↓←→←→BA · Level 99 Bard'); }
	});
	function celebrate(msg) {
		hint(msg, 5000);
		fw.start(30, camera, (x, z) => getWorld()?.island.heightAt(x, z) ?? 0);
	}

	// ---------- the guide's secrets: returns a reply, or null to let the guide answer ----------
	function secret(text) {
		const q = text.toLowerCase();
		if (/firework|celebrat/.test(q)) { celebrate('Look up.'); return 'Look up. ✦'; }
		if (/level ?99/.test(q)) { celebrate('Level 99 Bard'); return 'Level 99. You knew the words. ✦'; }
		if (/verse|scroll|bard'?s? (poem|secret)|lost poem|riddle/.test(q)) {
			const next = VERSES.find((v) => !found[v.id]);
			if (!next) return 'You found all five of the Bard’s verses:\n' + poem();
			return `The Bard lost five verses across the Bay; you have found ${count()}. The next one waits here: ${next.clue} Look for a glint of gold.`;
		}
		return null;
	}

	// ---------- the calendar's greetings, once a visit ----------
	let greeted = false;
	function greet() {
		const lines = [];
		if (occ.july4) lines.push('Happy Fourth of July. Stay out after dark.');
		if (occ.newYear) lines.push('Happy New Year. Stay out after dark.');
		if (occ.halloween) lines.push('Happy Halloween: the pumpkins are out on the porches.');
		if (occ.holidays && !occ.newYear) lines.push('The lights are up on the houses.');
		if (occ.beacon) lines.push('Tonight the beacon on Mt Diablo is lit, as it has been every 7 December since 1964.');
		if (occ.meteors) lines.push(`The ${occ.meteors} are falling tonight: look up after dark.`);
		if (lines.length) { hint(lines.join('\n'), 7000); say?.(lines.join(' '), 'note'); }
	}

	let hornT = 8, showT = 0, placed = false;
	function update(dt, sky, weather) {
		const W = getWorld();
		if (!W) return;
		const cam = camera.position;
		const night = sky?.night ?? 0;
		if (!greeted && W.bayArea?.loaded()) { greeted = true; setTimeout(greet, 6000); }
		if (!placed && W.bayArea?.loaded()) { placed = true; placeScrolls(W); }
		// the showers and the beacon
		if (W.sky?.uniforms?.uMeteor) W.sky.uniforms.uMeteor.value = occ.meteors ? 1 : 0;
		W.diablo?.setBeaconDay?.(occ.beacon);
		// the scrolls: bob, turn, glint from afar; walk up to take one
		for (const s of scrolls) {
			if (!s.g.visible) continue;
			const d = Math.hypot(cam.x - s.g.position.x, cam.y - s.g.position.y, cam.z - s.g.position.z);
			if (d > 2500) continue;
			s.ph += dt;
			s.g.position.y = s.y + Math.sin(s.ph * 1.6) * 0.12;
			s.g.rotation.y += dt * 0.6;
			// a glint that stays a few pixels across however far away
			s.g.userData.halo.scale.setScalar(Math.min(40, Math.max(1.3, d * 0.012)) * (0.85 + 0.15 * Math.sin(s.ph * 3)));
			s.g.userData.halo.material.opacity = 0.55 + 0.45 * Math.sin(s.ph * 2.2) ** 2;
			if (d < 4.5) collect(s.v);
		}
		// fireworks on the nights for them
		if ((occ.july4 || occ.newYear) && night > 0.6 && W.bayArea?.loaded()) {
			showT -= dt;
			if (!fw.busy() && showT <= 0) { fw.start(70, camera, (x, z) => W.island.heightAt(x, z)); showT = 100; }
		}
		fw.update(dt, camera);
		// the foghorns, near the bridge in grey weather or on a grey morning
		const dg = Math.hypot(cam.x - GG.x, cam.z - GG.z), hours = W.sky?.state?.hours ?? 12;
		const grey = (weather?.gloom || 0) > 0.25 || (weather?.rainHere || 0) > 0.1 || (hours > 5 && hours < 9.5);
		if (W.bayArea?.loaded() && dg < 7000 && cam.y < 600 && grey) {
			hornT -= dt;
			if (hornT <= 0) { hornT = 28 + Math.random() * 6; foghorn(0.32 * Math.pow(1 - dg / 7000, 1.5) + 0.02); }
		} else hornT = Math.min(hornT, 6);
		// your own front door
		if (home && !welcomed && W.bayArea?.loaded() && Math.hypot(cam.x - home.x, cam.z - home.z) < 25 && cam.y - W.island.heightAt(cam.x, cam.z) < 5) {
			welcomed = true;
			hint(`Welcome home${home.name && home.name !== 'Home' ? ', ' + home.name : ''}.`, 5000);
			chime();
		}
	}
	return { update, secret, fireworks: (s = 30) => { celebrate('✦'); return s; }, verses: () => ({ found: count(), of: VERSES.length, poem: count() === VERSES.length ? poem() : null }), occasions: occ, fw };
}
