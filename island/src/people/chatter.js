// Walk past people and they notice you: a word, a nod, a look, in their own voice and from
// where they stand. Two people talking go on talking as you pass, and you catch a line each.
// The voice is made while they are still a few steps off, so it is ready as you reach them.
import * as THREE from 'three';
import { remarkFor, exchangeFor } from './chatter-lines.js';
import { awarenessContext } from './world-awareness.js';

const NOTICE = 11, SAY = 4.6, EARSHOT = 14;
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _h = new THREE.Vector3();

export function createChatter({ mount, camera, world, people, talkers, voice, combat, driving, isPhone, frameMs = () => 16, errands = () => null }) {
	// how the world takes you: the compass's standing and the favours you have done
	const standing = () => { try { const R = combat()?.morality?.reactions?.(); return { rep: R?.reputation ?? 0, bounty: R?.bounty ?? 0, favours: errands()?.info?.()?.done ?? 0 }; } catch { return {}; } };
	const said = new WeakMap(), bumped = new WeakMap();
	let checkT = 0, quietUntil = 0, pending = null, n = 0, last = null, speed = 0;
	const lastPos = new THREE.Vector3().copy(camera.position);

	// the words over the speaker's head, for anyone playing with the sound off
	const cap = document.createElement('div');
	cap.style.cssText = 'position:absolute;left:0;top:0;will-change:transform;max-width:220px;padding:5px 10px;border-radius:10px;background:rgba(10,10,10,.68);border:1px solid rgba(255,255,255,.12);color:#fff;font:13px/1.35 -apple-system,system-ui,sans-serif;text-align:center;pointer-events:none;opacity:0;transition:opacity .35s;z-index:4;';
	cap.setAttribute('aria-live', 'polite');
	mount.appendChild(cap);
	let capFor = null, capUntil = 0, capW = 1, capH = 1, sizeT = 0;
	function caption(p, text, seconds) { if (!text) return; capFor = p; capUntil = performance.now() + Math.max(1.6, seconds) * 1000 + 500; cap.textContent = text; cap.style.opacity = '1'; }
	function head(p, out) { const S = p.M.S; return out.set(S.pos.x, S.pos.y + (p.P.height || 1.7) * 0.93, S.pos.z); }

	function listening() { return voice.on() && !voice.talking(); }
	function busy(p) { return !p.active || p.demo !== undefined || p.engaged || p.override || p.P?.ragdoll || !p.P?.root?.visible || p.M?.S?.remark; }

	// a remark: body first (they look round), then the voice when it is made. They look at
	// you (the camera itself, so their eyes follow you past) unless told whom to look at.
	function say(p, line, done, look = camera.position) {
		const S = p.M.S;
		S.remark = { until: performance.now() + (line.text ? 4000 : 1400), speaking: false, look };
		if (line.gesture) p.M.gesture(line.gesture);
		if (line.feel) for (const k in line.feel) S.feel[k] = Math.max(S.feel[k] || 0, line.feel[k]);
		const dna = p.P.dna;
		const begin = (seconds) => { S.remark = { until: performance.now() + seconds * 1000 + 250, speaking: true, look }; caption(p, line.text, seconds); };
		if (!line.text) { done?.(false); return; }
		// little ones get the words and the wave, not a borrowed grown-up's voice
		const silent = () => { const s = 0.6 + line.text.length * 0.06; begin(s); setTimeout(() => done?.(false), s * 1000); };
		if (dna.child || !listening()) { silent(); return; }
		if (voice.mode() === 'device') {
			if (!('speechSynthesis' in window) || speechSynthesis.speaking) { silent(); return; }
			const u = new SpeechSynthesisUtterance(line.text), d = head(p, _v).distanceTo(camera.position);
			u.volume = Math.max(0.15, Math.min(1, 2.4 / Math.max(d, 1)));
			u.pitch = dna.male ? 0.92 : 1.1; u.rate = 1.03;
			u.onend = u.onerror = () => done?.(true);
			speechSynthesis.speak(u);
			begin(0.6 + line.text.length * 0.065);
			return;
		}
		// On a phone the local voices are only used once a conversation has loaded them: their
		// first download is about 100 MB and making a voice costs the processor the world needs.
		// Until then a remark is its caption. A computer loads them in the background.
		if (isPhone && !voice.ready()) { silent(); return; }
		voice.warm();
		const ok = voice.remark(line.text, dna, {
			at: () => head(p, _h),
			audible: () => p.active && p.P.root.visible && p.M.S.pos.distanceTo(camera.position) < EARSHOT,
			started: begin,
			done: (played) => done?.(played),
		});
		if (!ok) silent();
	}

	function sceneNow() {
		const W = world();
		return { hour: W?.sky?.state?.hours ?? 12, rain: W?.weather?.state?.rainHere ?? 0, storm: W?.weather?.state?.storm ?? 0 };
	}
	function awareOf(p) {
		try { return awarenessContext({ ...combat()?.perception?.(p), work: p.workContext, seed: p.P.dna.seed || 0 }); } catch { return {}; }
	}
	function selfOf(p) {
		const d = p.P.dna, T = d.temper || {}, S = p.M.S;
		return {
			child: !!d.child, outgoing: T.outgoing, warmth: T.warmth, mood: p.persona?.mood || null,
			role: p.role === 'jog' ? 'jog' : p.route?.kind === 'seat' ? 'seat' : p.role,
			phone: S.pose === 'phone', work: !!p.workContext, vendor: p.workContext?.role === 'vendor',
		};
	}

	// who you are about to pass: near, or closing and going to come within a few steps
	function choose(cam, vel) {
		let best = null, bs = 1e9;
		for (const p of [...people.pool, ...talkers()]) {
			if (busy(p)) continue;
			const S = p.M.S, dx = S.pos.x - cam.x, dz = S.pos.z - cam.z, d = Math.hypot(dx, dz);
			if (d > NOTICE || Math.abs(S.pos.y + 1.6 - cam.y) > 3) continue;
			// walked right into them: they say so, whatever they said before (once in a while)
			if (d < 0.95 && speed > 1.2 && performance.now() - (bumped.get(p.P) || -1e9) > 20000) { p.bump = true; return p; }
			const when = performance.now() - (said.get(p.P) || -1e9);
			if (when < 150000) continue;
			// the nearest the two of you will come in the next few seconds, at the pace you are going
			const sp = S.speed.v || 0, vx = Math.sin(S.heading) * sp - vel.x, vz = Math.cos(S.heading) * sp - vel.z, vv = vx * vx + vz * vz;
			const t = vv > 0.01 ? Math.max(0, Math.min(4, -(dx * vx + dz * vz) / vv)) : 0;
			const pass = Math.hypot(dx + vx * t, dz + vz * t);
			if (d > SAY && pass > SAY) continue;
			const sc = pass + t * 0.6;
			if (sc < bs) { bs = sc; best = p; }
		}
		return best;
	}

	function remark(p, now) {
		const aware = awareOf(p), scene = sceneNow();
		said.set(p.P, now);
		// a pair mid-conversation (out walking, or across a table or a desk): you overhear them
		// rather than being spoken to
		const o = companion(p);
		if (o && !aware.afraid) {
			said.set(o.P, now);
			const [a, b] = exchangeFor({ seed: p.P.dna.seed, n: n++, ...scene, work: p.workContext || o.workContext ? (p.workContext || o.workContext).role || 'work' : null, seated: p.route?.kind === 'seat' });
			const atP = head(p, new THREE.Vector3()), atO = head(o, new THREE.Vector3());
			pending = p;
			say(p, { text: a, gesture: 'explain' }, () => {
				// the friend is still listening when the reply comes
				o.M.S.remark = null;
				say(o, { text: b, gesture: Math.random() < 0.5 ? 'laugh' : 'nod' }, () => finish(9 + Math.random() * 8), atP);
				p.M.S.remark = { until: performance.now() + 4000, speaking: false, look: atO };
			}, atO);
			o.M.S.remark = { until: performance.now() + 9000, speaking: false, look: atP };
			return;
		}
		const bump = !!p.bump; p.bump = false;
		if (bump) bumped.set(p.P, now);
		// now and then, instead of a word in passing, they ask you for a favour (errands.js)
		const ask = !bump && errands()?.maybeAsk(p, { afraid: aware.afraid });
		if (ask) { pending = p; say(p, ask, () => finish(isPhone ? 20 : 10)); return; }
		const line = remarkFor({ seed: p.P.dna.seed, n: n++, self: selfOf(p), you: { speed, vehicle: driving(), aware, bump, standing: standing() }, scene });
		if (!line) { finish(1); return; }
		pending = p;
		say(p, line, () => finish(line.text ? (isPhone ? 18 : 7) + Math.random() * (isPhone ? 12 : 7) : 2.5));
	}
	// who they are talking with: a walking partner, or someone sitting or working beside them
	function companion(p) {
		if (p.role === 'chat' && p.partner && !busy(p.partner) && p.partner.M.S.pos.distanceTo(p.M.S.pos) < 2.2) return p.partner;
		if (p.route?.kind !== 'seat' && !p.workContext) return null;
		let best = null, bd = 2.4;
		for (const q of [...people.pool, ...talkers()]) {
			if (q === p || busy(q) || q.P.dna.child || (q.route?.kind !== 'seat' && !q.workContext)) continue;
			const d = q.M.S.pos.distanceTo(p.M.S.pos);
			if (d < bd) { bd = d; best = q; }
		}
		return best;
	}
	function finish(rest) { pending = null; quietUntil = performance.now() + rest * 1000; }

	function update(dt, on = true) {
		const cam = camera.position, now = performance.now();
		// how fast you are going: your own stride on foot (the camera sways and settles even
		// when you stand still); in a car, how far the camera travelled
		const P0 = world()?.player?.state, foot = P0?.vel && !driving();
		const vel = foot ? _v.set(P0.vel.x, 0, P0.vel.z) : _v.set(cam.x - lastPos.x, 0, cam.z - lastPos.z).multiplyScalar(1 / Math.max(dt, 1e-3));
		speed += (Math.min(Math.hypot(vel.x, vel.z), 60) - speed) * Math.min(1, dt * 4);
		lastPos.copy(cam);
		// (the ear only moves while a remark is playing: nothing to do the rest of the time)
		if (voice.remarking) voice.place(cam, camera.getWorldDirection(_f));
		// the caption follows the speaker (the page size read once a second, not every frame)
		if (now > sizeT) { sizeT = now + 1000; capW = mount.clientWidth; capH = mount.clientHeight; }
		if (capFor) {
			const S = capFor.M.S;
			_f.set(S.pos.x, S.pos.y + (capFor.P.height || 1.7) + 0.35, S.pos.z).project(camera);
			const vis = now < capUntil && _f.z < 1 && capFor.active;
			if (vis) cap.style.transform = `translate3d(${((_f.x * 0.5 + 0.5) * capW).toFixed(1)}px,${((-_f.y * 0.5 + 0.5) * capH).toFixed(1)}px,0) translate(-50%,-100%)`;
			else { cap.style.opacity = '0'; capFor = null; }
		}
		checkT -= dt;
		if (!on || pending || checkT > 0) return;
		checkT = isPhone ? 0.3 : 0.2;
		const P = world()?.player?.state;
		if (!P || P.flying || voice.talking()) return;
		// the world is struggling to keep up: nobody starts talking until it recovers
		if (frameMs() > (isPhone ? 30 : 34)) return;
		const p = choose(cam, vel);
		if (!p) return;
		// fear does not wait its turn; small talk does
		const quietLeft = quietUntil - now;
		if (quietLeft > 0 && !p.bump && !(quietLeft < 6000 && awareOf(p).afraid)) { p.bump = false; return; }
		last = p;
		remark(p, now);
	}
	return { update, say, info: () => ({ pending: !!pending, last: last?.persona?.name || null, quietFor: Math.max(0, Math.round((quietUntil - performance.now()) / 100) / 10), speed: +speed.toFixed(1) }) };
}
