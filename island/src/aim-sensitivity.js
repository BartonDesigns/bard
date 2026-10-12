// One device preference shared by mouse, touch look, and dragging Fire/Aim.
export const DEFAULT_AIM_SENSITIVITY = 1.15;
const KEY = 'l99-aim-sensitivity';

function normalize(value) {
	const n = Number(value);
	return value == null || value === '' || !Number.isFinite(n)
		? DEFAULT_AIM_SENSITIVITY : Math.max(0.5, Math.min(2, n));
}

export function loadAimSensitivity() {
	try { return normalize(localStorage.getItem(KEY)); }
	catch { return DEFAULT_AIM_SENSITIVITY; }
}

export function saveAimSensitivity(value) {
	const sensitivity = normalize(value);
	try { localStorage.setItem(KEY, String(sensitivity)); } catch { /* still works for this session */ }
	return sensitivity;
}
