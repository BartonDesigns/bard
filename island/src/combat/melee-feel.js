// How a blow feels through your own eyes: the world holding still a few frames as it lands
// (hit-stop), the view kicked by it (a blow you land nods the view into it; one you take snaps
// it away from where it came from; a block shoves it back), and a faint flash at the edges of
// the screen on the hardest ones, warm for what you land and red for what you take. Springs on
// three numbers each frame and one element animated only when something happens: nothing is
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
	const pitch = new Spring(30), yaw = new Spring(30), roll = new Spring(26);
	let stop = 0;
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
		// a small nudge (the dodge's lean, a swing's follow-through)
		nudge(p, y, r) { pitch.dv += p; yaw.dv += y; roll.dv += r; },
		// the world holds still this long (the larger of what is asked and what is left)
		stop(t) { stop = Math.max(stop, t); },
		// the time factor for things that hold still on a blow (your fists, the struck)
		get held() { return stop > 0; },
		// each frame, after the view has been set: dt is real time; returns the hit-stop factor
		update(dt, apply = true) {
			stop = Math.max(0, stop - dt);
			const p = pitch.step(dt), y = yaw.step(dt), r = roll.step(dt);
			if (apply && (Math.abs(p) + Math.abs(y) + Math.abs(r) > 1e-5)) { camera.rotation.x += p; camera.rotation.y += y; camera.rotation.z += r; }
			return stop > 0 ? 0.05 : 1;
		},
		clear() { pitch.v = pitch.dv = yaw.v = yaw.dv = roll.v = roll.dv = 0; stop = 0; },
		dispose() { flash.remove(); },
	};
}
