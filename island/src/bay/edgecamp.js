// The people of the small camps, when you come near one. Ordinary people getting on with
// the day: someone reading in a camp chair, two talking (one sat on a crate), someone
// cooking on a one-burner stove, someone walking a cart along the fence, someone asleep in
// a bag under the tarp; at night most are asleep. Bodies and motion are the people
// system's (people/), in plain, worn clothes. A radio plays softly in some camps, and
// there is the murmur of talk when they talk; both only close by, both low.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { sleeperGeo, bookGeo, cartFrameGeo, cartWireGeo, wireTex } from './edgekit.js';
import { mix } from '../audio/acoustics.js';
import { noise } from '../world/soundbus.js';

const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// plain clothes, worn and faded: greys, olive, navy gone soft, browns, a washed-out red
const TOPS = [[0.3, 0.29, 0.27], [0.34, 0.33, 0.26], [0.22, 0.24, 0.22], [0.38, 0.35, 0.31], [0.24, 0.26, 0.32], [0.42, 0.38, 0.32], [0.32, 0.26, 0.21], [0.45, 0.24, 0.2], [0.55, 0.54, 0.5]];
const JACKETS = [[0.2, 0.21, 0.2], [0.3, 0.3, 0.22], [0.26, 0.22, 0.18], [0.18, 0.2, 0.26], [0.36, 0.34, 0.3], [0.28, 0.3, 0.24]];
const BOTTOMS = [[0.2, 0.24, 0.32], [0.26, 0.28, 0.3], [0.3, 0.28, 0.24], [0.14, 0.14, 0.15], [0.36, 0.33, 0.27], [0.24, 0.26, 0.2]];
const SHOES = [[0.1, 0.09, 0.09], [0.24, 0.2, 0.16], [0.35, 0.35, 0.35], [0.5, 0.48, 0.45]];
const BAGS = [[0.2, 0.3, 0.45], [0.35, 0.2, 0.15], [0.25, 0.3, 0.2], [0.5, 0.22, 0.12], [0.3, 0.3, 0.32]];
const NEAR = 75, MAXB = 4;

// a short loop of a small radio across the way: plucked chords over a walking bass, as
// music sounds through a little speaker (made once, a few milliseconds)
function radioBuffer(ctx) {
	const sr = 22050, beat = 60 / 88, bars = 8, len = Math.floor(sr * beat * 4 * bars), d = new Float32Array(len);
	const R = rng(99), midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
	const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
	// a plucked string: Karplus-Strong
	const pluck = (f, at, amp, decay = 0.996) => {
		const n = Math.max(2, Math.round(sr / f)), buf = new Float32Array(n);
		for (let i = 0; i < n; i++) buf[i] = (R() * 2 - 1) * amp;
		const start = Math.floor(at * sr), dur = Math.min(len - start, Math.floor(sr * 2.2));
		let k = 0;
		for (let i = 0; i < dur; i++) { const v = buf[k], nk = (k + 1) % n; buf[k] = decay * 0.5 * (v + buf[nk]); d[(start + i) % len] += v; k = nk; }
	};
	for (let b = 0; b < bars; b++) {
		const ch = prog[b % 4], t0 = b * 4 * beat;
		for (let q = 0; q < 4; q++) {
			pluck(midi(ch[0] - 12 + (q === 2 ? 7 : 0)), t0 + q * beat, 0.5, 0.994);
			for (let s = 0; s < 3; s++) pluck(midi(ch[s] + 12), t0 + q * beat + (q % 2 ? 0.5 : 0) * beat + s * 0.018, 0.22, 0.992);
		}
	}
	// the little speaker: no lows, no highs, a touch of grit
	let lp = 0, hp = 0, prev = 0;
	for (let i = 0; i < len; i++) { const x = Math.tanh(d[i] * 1.6); lp += (x - lp) * 0.35; hp = 0.985 * (hp + lp - prev); prev = lp; d[i] = hp * 0.5 + (R() - 0.5) * 0.004; }
	const B = ctx.createBuffer(1, len, sr);
	B.getChannelData(0).set(d);
	return B;
}

export function createCamps(scene, { world, H }) {
	const group = new THREE.Group();
	group.name = 'edge-camps';
	scene.add(group);
	const byTile = new Map();
	let A = null, failed = false, building = false;
	const bodies = [];                                          // { P, M, busy }
	let active = null;                                         // { camp, roles: [...] }

	// the things that belong to whoever is there: the sleepers, a book, a cart being pushed, the flame
	const soft = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
	const hard = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
	const sleepers = [0, 1].map(() => { const m = new THREE.Mesh(sleeperGeo(), soft.clone()); m.castShadow = m.receiveShadow = true; m.visible = false; group.add(m); return m; });
	const book = new THREE.Mesh(bookGeo(), hard); book.visible = false; group.add(book);
	const cart = new THREE.Group();
	cart.add(new THREE.Mesh(cartFrameGeo(), hard), new THREE.Mesh(cartWireGeo(), new THREE.MeshStandardMaterial({ map: wireTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 })));
	const load = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.8 }));
	load.scale.set(1.3, 0.8, 0.9); load.position.set(0, 1.05, 0); cart.add(load);
	cart.visible = false; group.add(cart);
	const flame = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
	flame.scale.set(0.12, 0.08, 1); flame.visible = false; group.add(flame);

	async function ensure() { if (A || failed) return; try { A = await loadPeopleAssets(); } catch (e) { failed = true; console.warn('[camps]', e); } }
	// a body, dressed plainly; built one at a time
	function grow(seed) {
		if (building || !A || bodies.length >= MAXB) return;
		building = true;
		try {
			const r = rng(seed);
			const d = personDNA(seed, { age: 24 + r() * 44 });
			const o = d.outfit, P2 = (L) => L[Math.floor(r() * L.length)];
			o.top = P2(TOPS); o.jacket = r() < 0.65 ? P2(JACKETS) : null; o.bottom = P2(BOTTOMS); o.shoes = P2(SHOES); o.legs = 'long';
			if (o.jacket) o.sleeves = 'long';
			const P = buildPerson(A, d);
			let M = null;
			M = createMotion(P, (x, z) => H(x, z));
			P.root.visible = false;
			group.add(P.root);
			bodies.push({ P, M, busy: false });
		} finally { building = false; }
	}

	// who is about, and doing what, by the hour
	function cast(c, hours) {
		const r = rng(c.seed), night = hours < 6.5 || hours > 22.5, roles = [];
		const seats = c.seats.slice();
		const takeSeat = (pref) => { let i = seats.findIndex((s) => s.kind === pref); if (i < 0) i = 0; return seats.length ? seats.splice(i, 1)[0] : null; };
		const sleepN = night ? 1 + (r() < 0.6 ? 1 : 0) : r() < 0.35 ? 1 : 0;
		if (!night) {
			const menu = ['read', 'talk', 'cook', 'cart', 'sit'].sort(() => r() - 0.5);
			let n = 1 + Math.floor(r() * 2.4);
			for (const k of menu) {
				if (n <= 0) break;
				if (k === 'read' && seats.length) { roles.push({ k, seat: takeSeat('chair') }); n--; }
				else if (k === 'talk' && seats.length && n >= 1) { roles.push({ k, seat: takeSeat('crate') }); n -= 2; }
				else if (k === 'cook' && c.stove && seats.length) { let best = 0; for (let i = 1; i < seats.length; i++) if (Math.hypot(seats[i].x - c.stove.x, seats[i].z - c.stove.z) < Math.hypot(seats[best].x - c.stove.x, seats[best].z - c.stove.z)) best = i; const s = seats.splice(best, 1)[0]; roles.push({ k, seat: { ...s, yaw: Math.atan2(c.stove.x - s.x, c.stove.z - s.z) } }); n--; }
				else if (k === 'cart' && c.route) { roles.push({ k }); n--; }
				else if (k === 'sit' && seats.length) { roles.push({ k, seat: takeSeat('bucket') }); n--; }
			}
		} else if (seats.length && r() < 0.5) roles.push({ k: 'sit', seat: takeSeat('chair') });
		return { roles, sleepN, radio: r() < 0.6 && hours > 7 && hours < 23, t: 0, bag: BAGS[Math.floor(r() * BAGS.length)] };
	}
	function release() {
		for (const b of bodies) { b.busy = false; b.P.root.visible = false; b.M.stand(); b.M.S.sitK.v = 0; b.M.S.talk = 0; b.M.S.look.target = null; b.M.setPose('rest'); b.role = null; }
		for (const s of sleepers) s.visible = false;
		book.visible = cart.visible = flame.visible = false;
		active = null;
	}
	function place(b, x, z, yaw, seatH) {
		b.M.place(x, H(x, z), z, yaw);
		if (seatH) b.M.sit(seatH, true); else { b.M.stand(); b.M.S.sitK.v = 0; }
		b.P.root.visible = true; b.busy = true;
	}
	function activate(c, hours) {
		release();
		const K = cast(c, hours);
		active = { c, ...K, people: [] };
		const free = () => bodies.find((b) => !b.busy);
		const sp = [c.sleep, c.sleep && { x: c.sleep.x + Math.cos(c.sleep.yaw) * 0.8, z: c.sleep.z - Math.sin(c.sleep.yaw) * 0.8, yaw: c.sleep.yaw + 0.1 }];
		for (let k = 0; k < K.sleepN && sp[k]; k++) {
			const s = sleepers[k], q = sp[k];
			s.position.set(q.x, H(q.x, q.z) + 0.02, q.z); s.rotation.set(0, q.yaw, 0);
			const col = BAGS[(c.seed + k) % BAGS.length];
			s.material.color.setRGB(col[0] * 2.2, col[1] * 2.2, col[2] * 2.2);
			s.visible = true;
		}
		for (const R of K.roles) {
			const b = free();
			if (!b) break;
			b.role = R; R.b = b;
			if (R.k === 'cart') {
				const [ax, az, bx, bz] = c.route;
				R.t = 0.3; R.dir = 1; R.pause = 0;
				place(b, ax + (bx - ax) * R.t, az + (bz - az) * R.t, Math.atan2(bx - ax, bz - az), 0);
				b.M.setPose('push');
			} else if (R.seat) {
				place(b, R.seat.x, R.seat.z, R.seat.yaw, R.seat.h);
				b.M.setPose(R.k === 'read' ? 'read' : R.k === 'cook' ? 'cook' : 'lap');
				if (R.k === 'talk') {
					const o = free();
					if (o) {
						// the other stands a little way off, facing them
						const fx = Math.sin(R.seat.yaw), fz = Math.cos(R.seat.yaw), x = R.seat.x + fx * 1.4 + fz * 0.3, z = R.seat.z + fz * 1.4 - fx * 0.3;
						place(o, x, z, Math.atan2(R.seat.x - x, R.seat.z - z), 0);
						o.M.setPose('pockets'); o.role = { k: 'talk2' }; R.other = o;
					}
				}
			}
		}
		active.people = bodies.filter((b) => b.busy);
		active.need = K.roles.length + (K.roles.some((R) => R.k === 'talk') ? 1 : 0); active.nb = bodies.length;
	}

	// the living camp: each at what they are doing
	const V = new THREE.Vector3(), V2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
	const head = (b) => new THREE.Vector3(b.M.S.pos.x, b.M.S.pos.y + b.P.height * (b.M.S.sitK.v > 0.5 ? 0.62 : 0.93), b.M.S.pos.z);
	function live(dt, t, cam) {
		const K = active;
		K.t += dt;
		book.visible = cart.visible = flame.visible = false;
		for (const R of K.roles) {
			const b = R.b;
			if (!b) continue;
			const S = b.M.S;
			if (R.k === 'read') {
				// a page turned now and then; a glance up
				S.look.target = null;
				R.g = (R.g ?? 4 + Math.random() * 6) - dt;
				if (R.g < 0) { R.g = 6 + Math.random() * 12; if (Math.random() < 0.3) b.M.gesture('think'); }
				const wl = b.P.bones[b.P.map['wrist.L']], wr = b.P.bones[b.P.map['wrist.R']];
				if (wl && wr) {
					wl.getWorldPosition(V); wr.getWorldPosition(V2);
					book.position.addVectors(V, V2).multiplyScalar(0.5);
					const h = head(b);
					book.position.y += 0.03;
					book.quaternion.setFromUnitVectors(UP, h.sub(book.position).normalize());
					book.visible = true;
				}
			} else if (R.k === 'talk' && R.other) {
				// they take turns, the speaker's hands going, the listener nodding
				const o = R.other, turn = Math.sin(K.t * 0.33 + (active.c.seed % 7)) > 0;
				for (const [p, q, speaking] of [[b, o, turn], [o, b, !turn]]) {
					p.M.S.look.target = head(q);
					p.M.S.talk = speaking && Math.sin(K.t * 1.1 + (p === b ? 0 : 2)) > -0.3 ? 1 : 0;
					p.gT = (p.gT ?? Math.random() * 3) - dt;
					if (p.gT < 0) { p.gT = 2 + Math.random() * 4; if (Math.random() < 0.55) p.M.gesture((speaking ? ['explain', 'open', 'shrug', 'think'] : ['nod', 'nod', 'laugh', 'think'])[Math.floor(Math.random() * 4)]); }
				}
				if (o.M.S.talk) o.M.setPose('rest'); else o.M.setPose('pockets');
			} else if (R.k === 'cook') {
				const st = active.c.stove;
				S.look.target = V.set(st.x, st.y + 0.2, st.z).clone();
				flame.position.set(st.x, st.y + 0.13, st.z);
				flame.material.opacity = 0.55 + Math.sin(t * 23) * 0.12 + Math.sin(t * 37) * 0.08;
				flame.visible = true;
			} else if (R.k === 'cart') {
				const [ax, az, bx, bz] = active.c.route, L = Math.hypot(bx - ax, bz - az) || 1;
				if (R.pause > 0) { R.pause -= dt; b.M.want.speed = 0; }
				else {
					R.t += R.dir * 0.75 * dt / L;
					if (R.t > 1 || R.t < 0) { R.t = Math.max(0, Math.min(1, R.t)); R.dir = -R.dir; R.pause = 4 + Math.random() * 8; }
					const tx = ax + (bx - ax) * R.t, tz = az + (bz - az) * R.t;
					b.M.want.heading = Math.atan2(tx - S.pos.x + (bx - ax) * R.dir * 0.02, tz - S.pos.z + (bz - az) * R.dir * 0.02);
					b.M.want.speed = Math.min(0.75, Math.hypot(tx - S.pos.x, tz - S.pos.z) * 2 + 0.3);
				}
				// the cart ahead of their hands
				const hd = S.heading, cx = S.pos.x + Math.sin(hd) * 0.85, cz = S.pos.z + Math.cos(hd) * 0.85;
				cart.position.set(cx, H(cx, cz), cz); cart.rotation.set(0, hd - Math.PI / 2, 0);
				cart.visible = true;
			} else if (R.k === 'sit') {
				S.look.target = null;
			}
		}
		for (const b of K.people) b.M.update(dt, t, cam);
	}

	// ---------- sound: a radio playing softly, and their voices ----------
	const snd = { radio: null, talk: null, hiss: null };
	function bedTo(A2, name, level, pan, make) {
		let n = snd[name];
		if (!n && level > 1e-4) { n = snd[name] = make(A2); if (!n) return; }
		if (!n) return;
		const t = A2.ctx.currentTime;
		n.g.gain.setTargetAtTime(level, t, 0.6);
		n.p.pan.setTargetAtTime(pan, t, 0.3);
		if (level <= 1e-4) { n.idle = (n.idle || 0) + 1; if (n.idle > 400) { snd[name] = null; setTimeout(() => { try { n.s.stop(); } catch { /* stopped */ } n.g.disconnect(); }, 2000); } } else n.idle = 0;
	}
	const loop = (A2, buf, lp) => {
		if (!buf) return null;
		const ctx = A2.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(), f = ctx.createBiquadFilter();
		s.buffer = buf; s.loop = true; g.gain.value = 0; f.type = 'lowpass'; f.frequency.value = lp;
		s.connect(f).connect(g).connect(p).connect(A2.amb);
		const sg = ctx.createGain(); sg.gain.value = 0.4; p.connect(sg).connect(A2.send);
		s.start(0, Math.random() * buf.duration);
		return { s, g, p };
	};
	let radioBuf = null;
	function sound(cam, hush) {
		const A2 = mix();
		if (!A2) return;
		const K = active, c = K?.c;
		const d = c ? Math.hypot(c.x - cam.position.x, c.z - cam.position.z) : 1e9;
		const e = cam.matrixWorld.elements, side = (x, z) => { const dx = x - cam.position.x, dz = z - cam.position.z, dd = Math.hypot(dx, dz) || 1; return Math.max(-1, Math.min(1, (e[0] * dx + e[2] * dz) / (Math.hypot(e[0], e[2]) || 1) / dd)); };
		const pan = c ? side(c.x, c.z) * 0.7 : 0;
		if (K?.radio && !radioBuf) radioBuf = radioBuffer(A2.ctx);
		bedTo(A2, 'radio', K?.radio ? 0.022 * hush / (1 + (d / 7) ** 2) : 0, pan, (a) => loop(a, radioBuf, 3200));
		const talking = K?.roles.some((R) => R.k === 'talk' && R.other);
		bedTo(A2, 'talk', talking ? 0.045 * hush / (1 + (d / 5) ** 2) : 0, pan, (a) => loop(a, a.B.get('babbleNear'), 2600));
		const cook = K?.roles.some((R) => R.k === 'cook');
		bedTo(A2, 'hiss', cook ? 0.004 * hush / (1 + (d / 3) ** 2) : 0, pan, (a) => { const ctx = a.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(), f = ctx.createBiquadFilter(); s.buffer = noise(ctx, 'white'); s.loop = true; f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.8; g.gain.value = 0; s.connect(f).connect(g).connect(p).connect(a.amb); s.start(); return { s, g, p }; });
	}

	function update(dt, t, cam, night, on) {
		const W = world(), hours = W?.sky?.state?.hours ?? 12;
		// the nearest camp within reach
		let best = null, bd = NEAR;
		if (on) for (const list of byTile.values()) for (const c of list) { const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z); if (d < bd) { bd = d; best = c; } }
		if (best && !A && !failed) ensure();
		if (best && A && bodies.length < MAXB && !building) grow((best.seed ^ (bodies.length * 7919 + 13)) >>> 0);
		if (!best) { if (active) release(); }
		// (cast again when it is a new camp, or when more of its people have been built)
		else if (bodies.length && (!active || active.c !== best || (active.people.length < active.need && bodies.length > active.nb))) activate(best, hours);
		// a new cast when the hour changes a lot (morning, night)
		if (active && Math.abs(((hours - (active.h0 ?? hours)) + 36) % 24 - 12) > 3) activate(active.c, hours);
		if (active) { active.h0 = active.h0 ?? hours; live(dt, t, cam); }
		sound(cam, on ? 1 : 0);
	}
	return {
		add: (k, list) => { if (list?.length) byTile.set(k, list); },
		drop: (k) => { if (active && byTile.get(k)?.includes(active.c)) release(); byTile.delete(k); },
		update,
		all: () => [...byTile.values()].flat(),
		info: () => ({ known: [...byTile.values()].reduce((a, l) => a + l.length, 0), bodies: bodies.length, active: active ? { why: active.c.why, roles: active.roles.map((R) => R.k), sleep: active.sleepN, radio: active.radio } : null }),
	};
}
