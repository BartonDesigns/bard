// How a blow feels through your own eyes: the world holding still a few frames as it lands
// (hit-stop), the view kicked by it (a blow you land nods the view into it; one you take snaps
// it away from where it came from; a block shoves it back), and a faint flash at the edges of
// the screen on the hardest ones, warm for what you land and red for what you take. Your own
// strikes move it too: the shoulders turn the view a degree with a jab and a few with a cross;
// a heavy held back coils it away with a growing tremble and sway, and thrown it turns hard and
// lunges forward, then leaves you wobbling (a roll that rocks and settles) a moment. Springs on
// a few numbers each frame and one element animated only when something happens: nothing is
// made per frame. A phone gets a gentler flash.

// (critically damped, stepped in small slices so a slow frame cannot throw it)
class Spring {
	constructor(w) { this.v = 0; this.dv = 0; this.w = w; }
	step(dt) {
		const w = this.w;
		while (dt > 1e-6) { const h = Math.min(dt, 1 / 240), a = -w * w * this.v - 2 * w * this.dv; this.dv += a * h; this.v += this.dv * h; dt -= h; }
		return this.v;
	}
}

export function createMeleeFeel({ camera, mount, isPhone = false }) {
	const pitch = new Spring(30), yaw = new Spring(30), roll = new Spring(26), turn = new Spring(14), lunge = new Spring(16);
	let stop = 0, coilK = 0, coiling = false, clock = 0, wobT = 0, wobDur = 1, wobRoll = 0, wobPh = 0;
	const fwd = { x: 0, y: 0, z: 0 };
	// the flash: an inset glow over the whole view, faded in and out by the browser
	const flash = document.createElement('div');
	flash.setAttribute('aria-hidden', 'true');
	flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5;mix-blend-mode:screen;';
	mount?.appendChild(flash);
	const strength = isPhone ? 0.55 : 1;
	let last = '';
	function glow(kind, k) {
		const css = kind === 'hurt' ? 'radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(170,20,10,.55) 100%)' : kind === 'parry' ? 'radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 40%,rgba(200,230,255,.45) 100%)' : 'radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 50%,rgba(255,220,170,.4) 100%)';
		if (css !== last) { flash.style.background = css; last = css; }
		try { flash.animate([{ opacity: Math.min(0.9, k * strength) }, { opacity: 0 }], { duration: kind === 'hurt' ? 260 : 150, easing: 'ease-out' }); } catch { /* no animations */ }
	}
	return {
		// a blow you landed: the view dips into it and rolls with the swing (side: -1 left .. 1 right)
		landed(heavy, side = 0, result = 'hit') {
			const k = heavy ? 1.8 : 1;
			if (result === 'block') { pitch.dv += 0.6; return; }
			pitch.dv -= 1.0 * k; roll.dv += side * 1.2 * k; yaw.dv -= side * 0.5 * k;
			if (heavy || result === 'parry') glow(result === 'parry' ? 'parry' : 'land', heavy ? 0.5 : 0.35);
		},
		// a blow you took from a side (-1 left .. 1 right), at strength k (0..1+)
		took(side, k = 1, result = 'hit') {
			if (result === 'parry') { pitch.dv += 0.8; glow('parry', 0.45); return; }
			if (result === 'block' || result === 'break') { pitch.dv += result === 'break' ? 3.2 : 1.4; yaw.dv += side * 0.8; return; }
			pitch.dv += 3.0 * k; yaw.dv += side * 3.0 * k; roll.dv -= side * 2.4 * k;
			glow('hurt', 0.25 + 0.35 * Math.min(1, k));
		},
		// a strike of yours on its way: the shoulders turn the view with it (the jab off the lead
		// hand a touch right, the cross a few degrees left), a heavy turns hard and lunges
		thrown(name, m, c = 0) {
			if (m.kind === 'heavy') { turn.dv += 3.2 + 1.6 * c; lunge.dv += 3.0 + 2.0 * c; pitch.dv -= 1.2 + 0.8 * c; return; }
			if (name === 'jab') { turn.dv -= 0.5; return; }
			if (name === 'cross') { turn.dv += 2.0; pitch.dv -= 0.3; return; }
			turn.dv += m.item ? 1.6 : 0.8;
		},
		// a heavy being held back (c: how far charged): the view coils away, trembling
		coil(c, on) { coiling = on; if (!on) return; coilK += (c - coilK) * 0.25; },
		// off balance for t seconds, rolling about this far
		wobble(t, r) { wobT = wobDur = t; wobRoll = r; wobPh = 0; },
		// a small nudge (the dodge's lean, a swing's follow-through)
		nudge(p, y, r) { pitch.dv += p; yaw.dv += y; roll.dv += r; },
		// the world holds still this long (the larger of what is asked and what is left)
		stop(t) { stop = Math.max(stop, t); },
		// the time factor for things that hold still on a blow (your fists, the struck)
		get held() { return stop > 0; },
		// each frame, after the view has been set: dt is real time; returns the hit-stop factor
		update(dt, apply = true) {
			stop = Math.max(0, stop - dt);
			clock += dt;
			if (!coiling) coilK = Math.max(0, coilK - dt * 6);
			let p = pitch.step(dt), y = yaw.step(dt) + turn.step(dt), r = roll.step(dt);
			const lz = lunge.step(dt);
			// coiled: turned away and down a little, the hand's tremble in the view, a slow sway
			if (coilK > 1e-3) {
				const c = coilK, tr = Math.sin(clock * 43) * 0.0016 + Math.sin(clock * 31 + 1) * 0.0011;
				y -= 0.035 * c; p -= 0.012 * c; r += 0.01 * c + Math.sin(clock * 2.3) * 0.006 * c;
				p += tr * c; y += tr * 0.7 * c;
			}
			// wobbling: a roll that rocks from side to side and settles, the head dropping a touch
			if (wobT > 0) {
				wobT = Math.max(0, wobT - dt); wobPh += dt * 9;
				const env = Math.min(1, (wobDur - wobT) / 0.08) * (wobT / wobDur);
				r += Math.sin(wobPh) * wobRoll * env; p -= Math.abs(Math.sin(wobPh * 0.5)) * wobRoll * 0.35 * env; y += Math.sin(wobPh * 0.5 + 0.8) * wobRoll * 0.25 * env;
			}
			if (apply && (Math.abs(p) + Math.abs(y) + Math.abs(r) > 1e-5)) { camera.rotation.x += p; camera.rotation.y += y; camera.rotation.z += r; }
			if (apply && Math.abs(lz) > 1e-4) {
				// (the lunge: the eye carried forward along the way you face, flat)
				const a = camera.rotation.y; fwd.x = -Math.sin(a); fwd.z = -Math.cos(a);
				camera.position.x += fwd.x * lz; camera.position.z += fwd.z * lz;
			}
			return stop > 0 ? 0.05 : 1;
		},
		clear() { pitch.v = pitch.dv = yaw.v = yaw.dv = roll.v = roll.dv = turn.v = turn.dv = lunge.v = lunge.dv = 0; stop = 0; coilK = 0; wobT = 0; },
		// (for the tests and checks)
		info: () => ({ coil: +coilK.toFixed(2), wobble: +wobT.toFixed(2), turn: +turn.v.toFixed(3), lunge: +lunge.v.toFixed(3) }),
		dispose() { flash.remove(); },
	};
}
