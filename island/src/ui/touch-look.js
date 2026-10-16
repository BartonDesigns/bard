// Looking round on a touch screen: the drag's acceleration curve, invert up and down, the
// gyro that adds to the drag, and the pitch easing back to level while you walk. The player
// (player.js) asks this module; the Sky and World panel shows the two switches on a touch
// screen. The look drag itself is still player.js's: the left thumb's stick in the lower
// left, the right thumb anywhere else on the world (two thumbs at once, by pointer id), and a
// touch that starts on a button is the button's.

const KEYS = { invertY: 'l99-invert-y', gyro: 'l99-gyro' };
const read = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
export const lookPrefs = { invertY: read(KEYS.invertY), gyro: read(KEYS.gyro) };
export function setLookPref(name, on) {
	lookPrefs[name] = !!on;
	try { localStorage.setItem(KEYS[name], on ? '1' : '0'); } catch { /* this visit only */ }
}

// The drag's gain by its speed (px per ms, smoothed): a slow drag is fine (0.7x), an ordinary
// one as set (1x at 0.6 px/ms), a fast swipe turns far (up to 2.6x).
export function lookGain(speed) {
	return 0.7 + 0.5 * Math.min(Math.max(speed || 0, 0), 3.8);
}

// The pitch eased back toward level while walking with no look input (radians a second's
// share): nothing for the first 1.5 s after the last look, then a slow drift.
export const LEVEL = { pitch: -0.04, after: 1500, rate: 0.9 };
export function levelPitch(pitch, dt) {
	return pitch + (LEVEL.pitch - pitch) * (1 - Math.exp(-dt * LEVEL.rate));
}

// The device's turn rate (DeviceMotionEvent.rotationRate, degrees a second about the device's
// own axes) as yaw and pitch rates about the screen's, for the way the screen is turned.
export function screenRates(rate, angle = 0) {
	const a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360, b = rate.beta || 0, g = rate.gamma || 0;
	if (a === 90) return { yaw: b, pitch: -g };
	if (a === 270) return { yaw: -b, pitch: g };
	if (a === 180) return { yaw: -g, pitch: -b };
	return { yaw: g, pitch: b };
}

// The gyro: off until asked for, and on iOS only after a tap grants it (DeviceMotionEvent.
// requestPermission). fns get (yaw, pitch) turns in radians.
const fns = new Set();
let listening = false, lastT = 0;
const D2R = Math.PI / 180;
function onMotion(e) {
	const r = e.rotationRate;
	if (!r || !lookPrefs.gyro) return;
	const now = performance.now(), dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
	lastT = now;
	if (!dt) return;
	const angle = screen.orientation?.angle ?? (typeof window.orientation === 'number' ? window.orientation : 0);
	const q = screenRates(r, angle);
	for (const fn of fns) fn(q.yaw * D2R * dt, q.pitch * D2R * dt);
}
export function onGyro(fn) { fns.add(fn); return () => fns.delete(fn); }
// (call from a tap: iOS asks for permission then; resolves whether the gyro is on)
export async function startGyro() {
	if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return false;
	try {
		const ask = window.DeviceMotionEvent.requestPermission;
		if (typeof ask === 'function' && (await ask.call(window.DeviceMotionEvent)) !== 'granted') return false;
	} catch { return false; }
	if (!listening) { addEventListener('devicemotion', onMotion); listening = true; lastT = 0; }
	return true;
}
export function stopGyro() { if (listening) { removeEventListener('devicemotion', onMotion); listening = false; } }

// With the gyro switched on in an earlier visit, the first tap on the world starts it again
// (iOS will only ask from a tap).
export function resumeGyro(mount) {
	if (!lookPrefs.gyro) return;
	const go = () => { mount.removeEventListener('touchend', go); startGyro(); };
	mount.addEventListener('touchend', go, { passive: true });
}

// The two switches, for the Sky and World panel on a touch screen
export function touchLookRows(panel, button) {
	const row = (label, name, after) => {
		const b = button();
		const draw = () => { b.textContent = `${label}: ${lookPrefs[name] ? 'on' : 'off'}`; b.setAttribute('aria-pressed', String(lookPrefs[name])); };
		b.onclick = async () => {
			const on = !lookPrefs[name];
			if (after && on && !(await after())) { b.textContent = `${label}: not available`; return; }
			setLookPref(name, on);
			if (name === 'gyro' && !on) stopGyro();
			draw();
		};
		draw(); panel.appendChild(b);
	};
	row('Invert look up and down', 'invertY');
	row('Gyro aiming', 'gyro', startGyro);
}
