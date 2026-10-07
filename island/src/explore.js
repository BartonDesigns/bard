// Explore: a hands-free cruise through the scenery, with the auto music composing to it and a
// camera that films it like a music video. O or the button starts and stops it. Esc, W/S,
// ↑/↓, Space, C or the stick held hand control back; A/D or ←/→ nudge the course, and
// dragging still looks round. On foot it walks (B: walk or run), flying it flies at the
// chosen speed, on a road it picks the turns, and in space it cruises from body to body.
// The camera changes shot on the music's bars and phrases (music/automusic.js pulse()).

import * as THREE from 'three';
import { flightMultiplier } from './flight-speed.js';

const EYE = 1.68;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the ground under a point (flying, the sea's surface is the floor)
const gnd = (I, fly, x, z) => Math.max(I.heightAt(x, z), fly ? 0 : -1e9);
// the headings weighed at each look ahead, either side of the one you are on
const OFFS = [-1.25, -0.8, -0.45, -0.2, 0, 0.2, 0.45, 0.8, 1.25];
const WALK_D = [4, 9, 16, 26];
const TRAIL = new Set(['track', 'path', 'footway', 'cycleway', 'pedestrian', 'bridleway']);
// the shots, round the subject: a (angle from behind), d (distance), h (height over the feet),
// lh (height looked at), ahead (how far ahead of the subject is looked at), spin (rad/s round it)
const WALK = [
	{ id: 'chase', a: 0, d: 4.6, h: 2.1, lh: 1.3, ahead: 1.5, spin: 0, w: 3 },
	{ id: 'low', a: 0.45, d: 3.2, h: 0.35, lh: 1.5, ahead: 0.5, spin: 0, w: 2 },
	{ id: 'high', a: 0.35, d: 8, h: 10, lh: 0.6, ahead: 4, spin: 0.025, w: 2 },
	{ id: 'dolly', a: 1.5, d: 5, h: 1.3, lh: 1.2, ahead: 0.6, spin: 0, w: 2 },
	{ id: 'orbit', a: 0, d: 5.5, h: 2, lh: 1.2, ahead: 0, spin: 0.14, w: 2 },
	{ id: 'lead', a: 2.8, d: 5.5, h: 1.5, lh: 1.3, ahead: 0, spin: 0, w: 1.5 },
	{ id: 'wide', a: 0.9, d: 16, h: 5, lh: 1, ahead: 3, spin: 0, w: 1.5 },
	{ id: 'pov', pov: true, w: 1 },
];
// flying there is no body: the shots look ahead along the way (in units of the speed's scale)
const FLY = [
	{ id: 'pov', pov: true, w: 2 },
	{ id: 'chase', a: 0, d: 1, h: 0.35, lh: -0.4, ahead: 4, spin: 0, w: 2 },
	{ id: 'high', a: 0.2, d: 0.8, h: 1.6, lh: -1, ahead: 5, spin: 0.02, w: 2 },
	{ id: 'low', a: 0.6, d: 0.6, h: -0.35, lh: -0.3, ahead: 4, spin: 0, w: 1.5 },
	{ id: 'side', a: 1.4, d: 1, h: 0.2, lh: -0.25, ahead: 3, spin: 0, w: 1.5 },
	{ id: 'orbit', a: 0, d: 1, h: 0.5, lh: -0.3, ahead: 0.6, spin: 0.1, w: 1 },
];
const SPACE = [{ id: 'ahead', w: 2 }, { id: 'gaze', w: 3 }, { id: 'side', w: 1.5 }, { id: 'drift', w: 1.5 }];
// a new place: the music moves to another key (semitones over the faceplate's root) and section
const KEYS = [5, -2, 3, -4, 2, -5, 0];
const LIFT = ['build', 'chorus', 'bridge', 'verse'];
const ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>';
const CSS = '#l99-island-mount.l99-xhide :is(.l99-rail,.l99-thumb,.l99-left,.l99-joy,.l99-pair),#l99-island-mount.l99-xhide>button:not(.l99-x){opacity:0!important;pointer-events:none!important;}#l99-island-mount :is(.l99-rail,.l99-thumb,.l99-left,.l99-pair),#l99-island-mount>button{transition:opacity .8s;}';

export function createExplore({ world, camera, drive, music, you, avatar, mount, button, hint, busy, isPhone }) {
	const H = {
		on: false, mode: '', heading: 0, rate: 0, base: 0, ph: 0, target: 0, pitch: 0, roll: 0, run: false,
		look: 0, lookP: 0, lookT: 0, setYaw: null, setPitch: null, thinkAt: 0, flyY: 0, stuckAt: 0, stuckX: 0, stuckZ: 0,
		turnAt: 0, regionAt: 0, region: '', cand: '', candT: 0, key: 0, hudAt: 0, holdT: 0,
		body: null, aim: new THREE.Vector3(), axis: new THREE.Vector3(), passR: 0, passT: 0, bodyAt: 0, lastBody: '',
		prevMusic: false, prevThird: false,
	};
	// the camera's own state: offsets from the subject, eased
	const C = {
		shot: null, list: WALK, bars: 0, lastBars: -1, clockAt: 0, punch: 0, yaw: 0, spin: 0, off: new THREE.Vector3(), lookOff: new THREE.Vector3(),
		lift: 0, cut: true, kind: '', energy: 0.4, barMs: 2400, barAt: 0,
	};
	const S = { dist: 0, minAgl: Infinity, minCam: Infinity, blocked: 0, frames: 0, shots: [], speed: 0, want: 0, tier: 1, mode: '' };
	const AUTO = { x: 0, z: -1, run: false };
	const BIAS = { energy: 0, tempo: 1 };
	const V = new THREE.Vector3(), V2 = new THREE.Vector3(), F = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), DIR = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), QZ = new THREE.Quaternion(), ZAX = new THREE.Vector3(0, 0, 1), ORIGIN = new THREE.Vector3();
	let lastX = 0, lastZ = 0, lastY = 0;

	// ---- the controls
	const style = document.createElement('style');
	style.textContent = CSS;
	document.head.appendChild(style);
	const btn = button('', 'Explore: cruise hands-free to the music (O)', 'width:44px;padding:6px 10px;align-items:center;justify-content:center;display:flex;', 'mode 18');
	btn.classList.add('l99-x');
	btn.innerHTML = ICON;
	btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); btn.blur(); });
	for (const ev of ['pointerdown', 'touchstart', 'keydown']) btn.addEventListener(ev, (e) => e.stopPropagation());
	mount.appendChild(btn);
	// the place's name, low on the left, as a new area comes into view
	const third = document.createElement('div');
	third.className = 'l99-x';
	third.style.cssText = 'position:absolute;left:calc(28px + env(safe-area-inset-left));bottom:calc(22% + env(safe-area-inset-bottom));pointer-events:none;color:#fff;opacity:0;transition:opacity 1.6s, transform 1.6s;transform:translateX(-8px);text-shadow:0 1px 8px rgba(0,0,0,.55);font-family:system-ui;max-width:70vw;';
	const tName = document.createElement('div'), tSub = document.createElement('div');
	tName.style.cssText = 'font:300 24px/1.15 system-ui;letter-spacing:.06em;';
	tSub.style.cssText = 'font:12px system-ui;letter-spacing:.14em;text-transform:uppercase;opacity:.75;margin-top:4px;border-top:1px solid rgba(255,255,255,.5);padding-top:5px;display:inline-block;';
	third.append(tName, tSub);
	mount.appendChild(third);
	let thirdT = 0;
	function lowerThird(name, sub) {
		tName.textContent = name; tSub.textContent = sub || '';
		third.style.opacity = '1'; third.style.transform = 'translateX(0)';
		clearTimeout(thirdT);
		thirdT = setTimeout(() => { third.style.opacity = '0'; third.style.transform = 'translateX(-8px)'; }, 6000);
	}

	function sync() {
		btn.setAttribute('aria-pressed', H.on ? 'true' : 'false');
		btn.style.background = H.on ? '#01a982' : 'rgba(8,20,26,.55)';
	}
	function showHud() { H.hudAt = performance.now(); mount.classList.remove('l99-xhide'); }

	function toggle() { return H.on ? stop('toggle') : start(); }
	function start() {
		const W = world(), P = W?.player?.state;
		if (!P || H.on) return false;
		if (busy()) { hint('Explore waits until this is done.', 2000); return false; }
		if (W.boat?.boarded?.()) { hint('Explore cruises on foot, flying, on the road and in space; not from the boat.', 3000); return false; }
		if (drive.active() && drive.state.mode === 'free') drive.setMode('assist');
		if (drive.active() && drive.state.mode === 'free') { hint('No road here for Explore to follow.', 2500); return false; }
		H.on = true; H.mode = '';
		H.heading = H.target = H.base = P.yaw; H.rate = 0; H.ph = Math.random() * 6; H.pitch = P.pitch; H.roll = 0;
		H.look = H.lookP = 0; H.setYaw = H.setPitch = null; H.thinkAt = 0; H.flyY = P.pos.y; H.region = ''; H.cand = ''; H.regionAt = 0; H.body = null; H.lastBody = '';
		H.stuckAt = 0; H.stuckX = P.pos.x; H.stuckZ = P.pos.z; H.turnAt = performance.now() + 6000;
		H.prevMusic = music.on(); H.prevThird = !!you.state.third;
		if (!H.prevMusic) music.auto(true, true);
		music.bias(BIAS);
		C.shot = null; C.lastBars = -1; C.seen = null; C.bars = 0; C.yaw = H.heading; C.spin = 0; C.lift = 0; C.punch = 0; C.kind = '';
		C.off.copy(camera.position).sub(P.pos); C.lookOff.set(-Math.sin(P.yaw) * 4, 0, -Math.cos(P.yaw) * 4);
		S.dist = 0; S.minAgl = S.minCam = Infinity; S.blocked = 0; S.frames = 0; S.shots.length = 0;
		lastX = P.pos.x; lastZ = P.pos.z; lastY = P.pos.y;
		showHud(); sync();
		hint(isPhone ? 'Exploring. Drag to look; the stick or the button hands back control.' : 'Exploring. A/D nudge, drag to look, B walk or run on foot; O, Esc or moving yourself hands back control.', 4500);
		return true;
	}
	function stop(why) {
		if (!H.on) return false;
		H.on = false;
		const W = world(), P = W?.player?.state;
		if (P) {
			if (P.auto === AUTO) P.auto = null;
			P.yaw = H.heading + (C.kind === 'space' ? 0 : H.look);
			if (!P.orbit?.high?.()) P.roll = 0;
			P.pitch = clamp(P.pitch, -0.6, 0.6);
		}
		you.state.third = H.prevThird;
		music.bias(null); music.shift(0);
		if (!H.prevMusic) music.auto(false, true);
		mount.classList.remove('l99-xhide');
		clearTimeout(thirdT); third.style.opacity = '0';
		sync();
		if (why !== 'quiet') hint('Explore off.', 1400);
		return true;
	}

	// ---- input: looking stays yours; a deliberate move takes the controls back
	const ENDS = new Set(['w', 's', 'arrowup', 'arrowdown', ' ', 'c', 'escape']);
	addEventListener('keydown', (e) => {
		if (mount.style.display === 'none' || e.metaKey || e.ctrlKey || window._KEYS_PLAY_ON || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
		const k = e.key.toLowerCase();
		if (k === 'o' && !e.repeat) { toggle(); e.preventDefault(); return; }
		if (!H.on) return;
		showHud();
		// (on the road the arrows pick the turns, as ever)
		if (drive.active() && k.startsWith('arrow')) return;
		if (ENDS.has(k)) { stop('key'); return; }
		if (k === 'b' && !e.repeat && H.mode === 'walk') { H.run = !H.run; hint(H.run ? 'Exploring at a run.' : 'Exploring at a walk.', 1200); return; }
		const n = k === 'a' || k === 'arrowleft' ? 1 : k === 'd' || k === 'arrowright' ? -1 : 0;
		if (n) { H.base += n * 0.5; H.target += n * 0.35; H.thinkAt = performance.now() + 900; }
	});
	mount.addEventListener('pointerdown', () => { if (H.on) showHud(); }, true);

	// ---- the bar clock: the auto music's, or a steady one of our own while it is silent
	function clock(now) {
		const P = music.pulse();
		if (P.playing) {
			C.barMs = P.stepMs * 16; C.energy = P.energy || C.energy;
			if (P.bars !== C.lastBars) { C.lastBars = P.bars; C.barAt = P.at; bar(now, P.bars, P.fresh, P.at); }
			return;
		}
		if (now - C.clockAt >= C.barMs) { C.clockAt = now; C.barAt = now; bar(now, ++C.bars, false, now); }
	}
	// (bars counted from the last one seen: a slow frame may step over several)
	function bar(now, n, fresh, at) {
		C.punch = 1;
		const prev = C.seen ?? n - 1;
		C.seen = n;
		C.age = (C.age || 0) + Math.max(1, n - prev);
		if (!C.shot) { pick(now, n, true, at); return; }
		// (a cut on a phrase or a new section; an eased move on the bars between)
		if (C.age >= 4 && (fresh || Math.floor(n / 8) > Math.floor(prev / 8))) pick(now, n, true, at);
		else if (C.age >= 3 && Math.floor(n / 4) > Math.floor(prev / 4)) pick(now, n, false, at);
	}
	function pick(now, n, cut, at) {
		const list = C.list;
		let sum = 0;
		for (const s of list) if (s !== C.shot) sum += s.w;
		let r = Math.random() * sum, next = list[0];
		for (const s of list) { if (s === C.shot) continue; r -= s.w; if (r <= 0) { next = s; break; } }
		// (into or out of the eyes is always a cut)
		const pov = next.pov || C.shot?.pov;
		C.cut = cut || !!pov || !C.shot;
		C.shot = next; C.age = 0; C.spin = 0;
		if (S.shots.length < 400) S.shots.push({ shot: next.id, cut: C.cut, bar: n, ms: Math.round(now - at), mode: C.kind });
	}

	// ---- steering, before the player moves
	function steer(dt) {
		if (!H.on) return;
		const W = world(), P = W?.player?.state;
		if (!P) { stop('quiet'); return; }
		if (busy() || W.boat?.boarded?.()) { stop(); return; }
		const now = performance.now();
		const space = !!W.orbit?.active?.();
		const mode = drive.active() ? 'drive' : space ? 'space' : P.flying ? 'fly' : 'walk';
		if (mode !== H.mode) { H.mode = mode; H.thinkAt = 0; H.heading = H.target = H.base = mode === 'drive' ? drive.state.yaw : P.yaw; H.rate = 0; C.shot = null; C.list = mode === 'space' ? SPACE : mode === 'fly' ? FLY : WALK; C.kind = mode; }
		S.mode = mode;
		// your own look: what the drag turned since we last set the heading
		if (H.setYaw !== null && mode !== 'drive') {
			const dl = wrap(P.yaw - H.setYaw), dp = P.pitch - H.setPitch;
			if (Math.abs(dl) > 1e-4 || Math.abs(dp) > 1e-4) { H.look = wrap(H.look + dl); H.lookP = clamp(H.lookP + dp, -0.9, 0.9); H.lookT = now; }
		}
		if (now - H.lookT > 4000) { const k = 1 - Math.min(1, dt * 0.7); H.look *= k; H.lookP *= k; }
		// the stick held hands control back; a touch of it only nudges
		if (now - (H.inAt || 0) > 200) {
			H.inAt = now;
			const I = W.player.input();
			H.holdT = Math.abs(I.mz) > 0.35 ? H.holdT + 0.2 : 0;
			if (H.holdT > 1 && mode !== 'drive') { stop('stick'); return; }
		}
		if (mode === 'drive') { steerDrive(now); return; }
		if (mode === 'space') steerSpace(dt, now, W, P);
		else steerGround(dt, now, W, P, mode === 'fly');
		H.setYaw = P.yaw; H.setPitch = P.pitch;
	}
	// on the road: drive.js carries you; now and then a turn is asked for at the next junction
	function steerDrive(now) {
		const D = drive.state;
		H.heading = D.yaw;
		if (now > H.turnAt && D.queue === 'straight') {
			const r = Math.random();
			D.queue = r < 0.55 ? 'straight' : r < 0.78 ? 'left' : 'right';
			H.turnAt = now + 8000 + Math.random() * 12000;
		}
	}
	function steerGround(dt, now, W, P, fly) {
		if (now >= H.thinkAt) { H.thinkAt = now + (isPhone ? 330 : 250); think(W, P, fly, now); }
		// ease the turn: a rate that itself eases, so the course never jerks
		const want = clamp(wrap(H.target - H.heading) * 0.7, fly ? -0.22 : -0.55, fly ? 0.22 : 0.55);
		H.rate += (want - H.rate) * Math.min(1, dt * 1.4);
		H.heading = wrap(H.heading + H.rate * dt);
		P.yaw = H.heading;
		AUTO.z = -1; AUTO.x = 0; AUTO.run = !fly && H.run;
		P.auto = AUTO;
		if (fly) {
			// keep a pleasant height over what is ahead, climbing and sinking gently, banked in the turns
			const v = Math.max(Math.hypot(P.vel.x, P.vel.z), 8);
			const climb = clamp((H.flyY - P.pos.y) / 3, -v * 0.22, v * 0.4);
			const pw = Math.asin(clamp(climb / v, -0.33, 0.42));
			H.pitch += (pw - H.pitch) * Math.min(1, dt * 0.9);
			P.pitch = H.pitch;
			H.roll += (clamp(H.rate * 1.3, -0.3, 0.3) - H.roll) * Math.min(1, dt * 1.2);
			P.roll = H.roll;
		} else {
			H.pitch += (-0.06 - H.pitch) * Math.min(1, dt);
			P.pitch = H.pitch;
			// stuck against something: turn well away
			// (counted in game time: a slow frame is not a wall)
			H.stuckAt += dt;
			if (H.stuckAt > 1.6) {
				const moved = Math.hypot(P.pos.x - H.stuckX, P.pos.z - H.stuckZ), expect = (P.swimming ? 2.2 : H.run ? 10 : 5.2) * H.stuckAt;
				if (moved < expect * 0.25) { S.blocked++; H.base = H.heading + (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random()); H.target = H.base; }
				H.stuckAt = 0; H.stuckX = P.pos.x; H.stuckZ = P.pos.z;
			}
		}
	}
	// weigh the headings ahead: the wandering course, the way already going, and what is there
	function think(W, P, fly, now) {
		const I = W.island, x = P.pos.x, z = P.pos.z, t = now / 1000;
		// the base course drifts after where you are going, so a detour is not undone
		H.base = H.base + wrap(H.heading - H.base) * 0.02;
		const wander = H.base + 0.9 * Math.sin(t * 0.023 + H.ph) + 0.45 * Math.sin(t * 0.061 + H.ph * 2.1);
		const wet = (px, pz) => {
			const g = I.heightAt(px, pz);
			if (g < 0.2) return true;
			const r = I.waterAt?.(px, pz);
			return (r != null && r > g + 0.2) || W.lake?.waterAt?.(px, pz) != null;
		};
		// a trail or a quiet road near you, walking: drawn along it
		let rdx = 0, rdz = 0, rw = 0;
		const real = W.real?.loaded?.() ? W.real : null;
		if (!fly && real) {
			let bd = 45;
			for (const q of real.near('roads', x, z, 45)) {
				if (q.cls === 'motorway' || q.cls === 'trunk' || q.cls === 'primary') continue;
				const p = q.pts;
				for (let i = 0; i + 3 < p.length; i += 2) {
					const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1, u = clamp(((x - p[i]) * dx + (z - p[i + 1]) * dz) / l2, 0, 1);
					const cx = p[i] + dx * u, cz = p[i + 1] + dz * u, d = Math.hypot(x - cx, z - cz);
					if (d >= bd) continue;
					bd = d;
					const l = Math.sqrt(l2), fx = -Math.sin(H.heading), fz = -Math.cos(H.heading), sg = dx * fx + dz * fz < 0 ? -1 : 1;
					// along it the way you face, and back onto it when off to one side
					rdx = dx / l * sg + (cx - x) / Math.max(d, 1) * Math.min(1, d / 10) * 0.8;
					rdz = dz / l * sg + (cz - z) / Math.max(d, 1) * Math.min(1, d / 10) * 0.8;
					rw = TRAIL.has(q.cls) ? 1.1 : 0.55;
				}
			}
		}
		const boxes = !fly && real ? real.near('boxes', x, z, 32) : null;
		const trees = !fly ? W.vegetation.obstacles(x - Math.sin(H.heading) * 6, z - Math.cos(H.heading) * 6, 6, P.pos.y - EYE) : null;
		const v = fly ? Math.max(16, Math.hypot(P.vel.x, P.vel.z)) : 0;
		let best = -1e9, bestA = H.heading, top = -1e9;
		for (const off of OFFS) {
			const a = H.heading + off, dx = -Math.sin(a), dz = -Math.cos(a);
			let s = Math.cos(wrap(a - wander)) + 0.55 * Math.cos(off);
			if (rw) s += rw * (dx * rdx + dz * rdz) / (Math.hypot(rdx, rdz) || 1);
			if (!fly) {
				let gp = I.heightAt(x, z), dp = 0;
				for (let i = 0; i < WALK_D.length; i++) {
					const d = WALK_D[i], px = x + dx * d, pz = z + dz * d, g = I.heightAt(px, pz), k = 1 - i * 0.18;
					const slope = (g - gp) / (d - dp);
					if (slope > 0.5) s -= 3 * k; else if (slope < -0.8) s -= 2.5 * k;
					if (wet(px, pz)) s -= (P.swimming ? 0.5 : 4) * k; else if (P.swimming) s += 0.8 * k;
					if (boxes) for (const b of boxes) if (Math.hypot(px - b.x, pz - b.z) < Math.max(b.w, b.d) * 0.45 + 1.5) { s -= 3 * k; break; }
					if (i < 2 && trees) for (const o of trees) if (Math.hypot(px - o.x, pz - o.z) < o.r + 1.2) { s -= 1.4 * k; break; }
					gp = g; dp = d;
				}
				// the coast and the ridgelines: a little drawn to them
				const cx = x + dx * 30, cz = z + dz * 30, g30 = I.heightAt(cx, cz);
				if (!wet(cx, cz) && (wet(cx + dz * 25, cz - dx * 25) || wet(cx - dz * 25, cz + dx * 25))) s += 0.6;
				s += clamp((g30 - 0.5 * (I.heightAt(cx + dz * 20, cz - dx * 20) + I.heightAt(cx - dz * 20, cz + dx * 20))) * 0.05, 0, 0.4);
			} else {
				const d1 = v * 3, d2 = v * 6, px = x + dx * d2, pz = z + dz * d2, g = I.heightAt(px, pz);
				const coast = wet(px, pz) !== wet(px + dz * d1 * 0.5, pz - dx * d1 * 0.5) || wet(px, pz) !== wet(px - dz * d1 * 0.5, pz + dx * d1 * 0.5);
				if (coast) s += 0.9;
				const r = I.waterAt?.(px, pz);
				if (r != null && r > g) s += 0.5;
				s += clamp((g - 0.5 * (I.heightAt(px + dz * d1, pz - dx * d1) + I.heightAt(px - dz * d1, pz + dx * d1))) * 0.004, 0, 0.6);
				// far out over open sea, the land draws you back; a small world's edge too
				if (g < -2 && I.heightAt(x + dx * d2 * 2, z + dz * d2 * 2) < -2) s -= 0.5;
				if (!W.bayArea && I.half && (Math.abs(px) > I.half * 0.85 || Math.abs(pz) > I.half * 0.85)) s -= 2;
			}
			if (s > best) { best = s; bestA = a; }
			if (off === 0) top = s;
		}
		// (a small gain is not worth a turn: keep on unless something is clearly better)
		if (best > top + 0.15) H.target = bestA;
		else H.target = H.heading + wrap(H.target - H.heading) * 0.5;
		if (fly) {
			// the height to keep: over the highest ground ahead, more at the faster tiers
			const mult = flightMultiplier(P.boost), fx = -Math.sin(H.heading), fz = -Math.cos(H.heading);
			let g = 0;
			for (let i = 0; i <= 8; i++) { const d = v * 5 * i / 8; g = Math.max(g, I.heightAt(x + fx * d, z + fz * d)); }
			if (real && v < 120) for (const b of real.near('boxes', x + fx * v * 2, z + fz * v * 2, v * 2 + 40)) g = Math.max(g, I.heightAt(b.x, b.z) + (b.wallH || 10) + 4);
			const clear = 28 + 22 * Math.log2(mult);
			H.flyY = Math.min(g + clear, I.flyCeiling ? Math.max(I.flyCeiling(x, z), g + 40) : 900);
		}
	}
	// space: from body to body, a slow pass round each at a respectful distance
	function steerSpace(dt, now, W, P) {
		if (now >= H.bodyAt) {
			H.bodyAt = now + 1000;
			const list = W.orbit.bodies?.() || [];
			let B = H.body ? list.find((b) => b.id === H.body.id) : null;
			if (B) H.body.pos.copy(B.pos);
			const d = B ? P.pos.distanceTo(B.pos) : 0;
			if (B && d < H.passR * 1.4) H.passT += 1;
			// done with this one (or none yet): the next, never the same twice
			if (!B || H.passT > 75 || (H.passT > 10 && d > H.passR * 2.5)) {
				const pool = list.filter((b) => b.id !== H.lastBody);
				const w = pool.map((b) => (b.id === 'companion' ? 3 : b.id === 'home' ? 2.5 : b.id === 'sun' ? 1 : 1.2));
				let r = Math.random() * w.reduce((a, c) => a + c, 0), i = 0;
				while (i < pool.length - 1 && (r -= w[i]) > 0) i++;
				B = pool[i];
				if (B) {
					H.body = { id: B.id, name: B.name, pos: B.pos.clone() }; H.lastBody = B.id; H.passT = 0;
					H.passR = B.size * (B.id === 'sun' ? 48 : B.id === 'gargantua' ? 32 : 2.6);
					// pass it on one side: an axis square to the way to it
					DIR.copy(B.pos).sub(P.pos).normalize();
					H.axis.crossVectors(DIR, V.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)).normalize();
					lowerThird(B.name, 'Cruising toward');
				}
			}
		}
		const B = H.body;
		// where to point: past the body's limb, or round it once close
		if (B) {
			V.copy(P.pos).sub(B.pos);
			const d = V.length();
			if (d < H.passR * 1.6) {
				// round it: along the orbit, eased back to the pass's height
				V.divideScalar(d || 1);
				DIR.crossVectors(H.axis, V).normalize().addScaledVector(V, clamp((H.passR - d) / H.passR, -0.4, 0.4)).normalize();
			} else {
				V2.crossVectors(H.axis, V).normalize();
				H.aim.copy(B.pos).addScaledVector(V2, H.passR);
				DIR.copy(H.aim).sub(P.pos).normalize();
			}
		} else DIR.set(-Math.sin(H.heading), 0, -Math.cos(H.heading));
		// turn the ship toward it, slowly
		F.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
		const ang = F.angleTo(DIR), k = ang > 1e-4 ? Math.min(1, 0.09 * dt / ang) : 1;
		F.lerp(DIR, k).normalize();
		P.yaw = Math.atan2(-F.x, -F.z); P.pitch = Math.asin(clamp(F.y, -1, 1));
		H.heading = P.yaw;
		AUTO.z = -1; AUTO.x = 0; AUTO.run = false;
		P.auto = AUTO;
	}

	// ---- the camera, after everything has moved
	function shoot(dt) {
		if (!H.on) return;
		const W = world(), P = W?.player?.state;
		if (!P) return;
		const now = performance.now();
		S.frames++;
		// what was travelled, and how close to the ground
		const step = Math.hypot(P.pos.x - lastX, P.pos.z - lastZ, H.mode === 'space' ? P.pos.y - lastY : 0);
		if (step < 5e7) S.dist += step;
		S.speed = step / Math.max(dt, 1e-3);
		lastX = P.pos.x; lastZ = P.pos.z; lastY = P.pos.y;
		clock(now);
		C.punch *= Math.exp(-dt * 2.6);
		// the music hears the speed: the tier picked, or the pace on the road
		const mult = H.mode === 'fly' || H.mode === 'space' ? flightMultiplier(P.boost) : H.mode === 'drive' ? Math.max(1, (drive.state.v || 0) / 6) : H.run ? 2 : 1;
		S.tier = mult;
		const tk = H.mode === 'space' ? 0.4 + 0.6 * clamp(Math.log10(mult) / 5, 0, 1) : clamp(Math.log(mult) / Math.log(9), 0, 1);
		BIAS.energy = 0.05 + 0.25 * tk; BIAS.tempo = 1 + 0.1 * tk;
		if (H.mode !== 'space') region(now, W, P);
		if (now - H.hudAt > 7000 && !mount.classList.contains('l99-xhide')) mount.classList.add('l99-xhide');
		if (!C.shot) pick(now, -1, true, C.barAt || now);
		if (H.mode === 'space') { shootSpace(dt, now, P); return; }
		const fly = H.mode === 'fly', I = W.island;
		if (fly) S.minAgl = Math.min(S.minAgl, P.pos.y - gnd(I, fly, P.pos.x, P.pos.z));
		// the subject: your feet (or the car's wheels), or the point you fly through
		const feet = H.mode === 'drive' ? P.pos.y - (drive.state.onTrail ? 1.65 : 1.45) : P.swimming ? P.pos.y - 0.4 : P.pos.y - EYE;
		const sy = fly ? P.pos.y : feet;
		const scale = fly ? clamp(Math.hypot(P.vel.x, P.vel.z) * 0.9, 14, 600) : H.mode === 'drive' && !drive.state.onTrail ? 1.7 : 1;
		const sh = C.shot;
		// your body in the shot, on foot; not in your own eyes
		you.state.third = !fly && H.mode === 'walk' && !sh.pov;
		if (you.state.third && !avatar.me) avatar.ready();
		C.yaw += wrap(H.heading - C.yaw) * Math.min(1, dt * (fly ? 0.9 : 1.3));
		C.spin += (sh.spin || 0) * dt;
		const e = C.energy, ph = ((now - C.barAt) / C.barMs) % 1;
		if (sh.pov) {
			camera.position.copy(P.pos);
			camera.rotation.set((fly ? P.pitch : -0.04) + H.lookP, H.heading + H.look, (fly ? H.roll : 0) + Math.sin(ph * Math.PI * 2) * 0.006 * e, 'YXZ');
			C.off.set(0, P.pos.y - sy, 0); C.lookOff.set(-Math.sin(H.heading) * 4 * scale, P.pos.y - sy, -Math.cos(H.heading) * 4 * scale);
			track(camera.position.y - gnd(I, fly, camera.position.x, camera.position.z));
			return;
		}
		// where the shot wants the camera, round the subject's eased heading
		const th = C.yaw + (sh.a || 0) + C.spin + H.look * 0.8, bx = Math.sin(th), bz = Math.cos(th);
		const d = sh.d * scale * (1 - 0.05 * C.punch * (0.5 + e)), h = sh.h * scale + C.lift;
		V.set(bx * d, h, bz * d);
		const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw);
		V2.set(fx * sh.ahead * scale, sh.lh * scale + H.lookP * 3 * scale, fz * sh.ahead * scale);
		const k = C.cut ? 1 : 1 - Math.exp(-dt * 0.7);
		C.off.lerp(V, k); C.lookOff.lerp(V2, k);
		C.cut = false;
		// a sway with the music's energy, across the line of sight
		const sw = Math.sin(ph * Math.PI * 2) * 0.05 * scale * e;
		const cx = P.pos.x + C.off.x + fz * -sw, cz = P.pos.z + C.off.z - fx * -sw;
		let cy = sy + C.off.y;
		// never under the ground (nor behind a hill from the subject: lifted until clear)
		const gmin = gnd(I, fly, cx, cz) + (fly ? Math.max(4, 0.12 * scale) : 0.35);
		if (cy < gmin) cy = gmin;
		let hidden = false;
		for (let i = 1; i <= 3; i++) { const u = i / 4; if (gnd(I, fly, P.pos.x + (cx - P.pos.x) * u, P.pos.z + (cz - P.pos.z) * u) > sy + (cy - sy) * u + 0.3) hidden = true; }
		C.lift = hidden ? Math.min(C.lift + dt * 4 * scale, 25 * scale) : Math.max(0, C.lift - dt * 1.2 * scale);
		camera.position.set(cx, cy, cz);
		F.set(P.pos.x + C.lookOff.x, sy + C.lookOff.y, P.pos.z + C.lookOff.z);
		camera.up.set(0, 1, 0);
		camera.lookAt(F);
		// a whisper of roll: the bank in flight, breathing on foot
		camera.rotateZ((fly ? H.roll * 0.5 : 0) + Math.sin(now * 0.00041) * 0.008);
		track(cy - gnd(I, fly, cx, cz));
	}
	function track(clear) { S.minCam = Math.min(S.minCam, clear); }
	// in space there is no ship to film: the shots are where you look as you cruise
	function shootSpace(dt, now, P) {
		const sh = C.shot, B = H.body, e = C.energy;
		F.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
		DIR.copy(F);
		if (B && (sh.id === 'gaze' || sh.id === 'side')) {
			V.copy(B.pos).sub(P.pos).normalize();
			if (sh.id === 'gaze') DIR.lerp(V, 0.75).normalize();
			else DIR.lerp(V2.crossVectors(V, UP).normalize(), 0.5).normalize();
		} else if (sh.id === 'drift') {
			V.crossVectors(F, UP).normalize();
			DIR.addScaledVector(V, Math.sin(now * 0.00013) * 0.45).normalize();
		}
		// your own look on top
		if (H.look || H.lookP) { V.crossVectors(DIR, UP).normalize(); DIR.addScaledVector(V, -Math.sin(H.look)).addScaledVector(UP, Math.sin(H.lookP)).normalize(); }
		if (P.orbit?.up) P.orbit.up(V2); else V2.set(0, 1, 0);
		M4.lookAt(ORIGIN, DIR, V2);
		Q.setFromRotationMatrix(M4);
		QZ.setFromAxisAngle(ZAX, (sh.id === 'drift' ? Math.sin(now * 0.0001) * 0.12 : 0) + Math.sin(((now - C.barAt) / C.barMs) * Math.PI * 2) * 0.004 * e);
		Q.multiply(QZ);
		const k = C.cut ? 1 : 1 - Math.exp(-dt * 0.5);
		C.cut = false;
		camera.quaternion.slerp(Q, k);
		camera.position.copy(P.pos);
	}
	// a new area: its name low on the left, and the music moves to a new key and section
	function region(now, W, P) {
		if (now < H.regionAt || !W.labels?.where) return;
		H.regionAt = now + 1000;
		let w = null;
		try { w = W.labels.where(P.pos.x, P.pos.z, P.pos.y, Math.max(Math.abs(P.pos.x), Math.abs(P.pos.z)) < W.island.half); } catch { w = null; }
		const key = w?.name || '';
		if (key !== H.cand) { H.cand = key; H.candT = now; return; }
		if (!key || key === H.region || now - H.candT < 1800) return;
		const first = !H.region;
		H.region = key;
		lowerThird(w.name, w.sub);
		if (first) return;
		H.key = (H.key + 1) % KEYS.length;
		music.shift(KEYS[H.key]);
		music.queue(LIFT[Math.floor(Math.random() * LIFT.length)], false);
	}

	function info() {
		const P = world()?.player?.state;
		return {
			on: H.on, mode: H.mode, shot: C.shot?.id || null, dist: Math.round(S.dist), minAgl: Number.isFinite(S.minAgl) ? +S.minAgl.toFixed(1) : null, minCam: Number.isFinite(S.minCam) ? +S.minCam.toFixed(2) : null,
			blocked: S.blocked, speed: +S.speed.toFixed(1), tier: S.tier, run: H.run, music: music.on(), shift: music.shift(), region: H.region, body: H.body?.name || null,
			heading: +H.heading.toFixed(3), pitch: P ? +P.pitch.toFixed(3) : null, hudHidden: mount.classList.contains('l99-xhide'), shots: S.shots.slice(-40),
		};
	}
	return { start, stop, toggle, steer, shoot, on: () => H.on, info };
}
