// The spells' sounds (magic/sound.js): every piece renders clean, carries real weight under
// 120 Hz, and no two schools' casts sound alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIECES, renderSpellSound, pieceOf, createSpellSound } from '../src/magic/sound.js';

const SR = 24000;
// the share of a piece's energy below f Hz (a one-pole lowpass against the whole)
function lowShare(d, sr, f) {
	const a = 1 - Math.exp(-2 * Math.PI * f / sr);
	let y = 0, low = 0, all = 0;
	for (const x of d) { y += (x - y) * a; low += y * y; all += x * x; }
	return low / Math.max(1e-9, all);
}
// a coarse shape of the body above the sub: log energy in 12 bands from 250 Hz to 8 kHz, over
// four slices of time (so a swell and a strike differ too), normalised
function shape(d, sr) {
	const a = Math.exp(-2 * Math.PI * 250 / sr), x = new Float32Array(d.length);
	let y = 0, x1 = 0;
	for (let i = 0; i < d.length; i++) { y = a * (y + d[i] - x1); x1 = d[i]; x[i] = y; }
	const out = new Float64Array(48), q = Math.floor(x.length / 4);
	for (let b = 0; b < 12; b++) {
		const f = 250 * Math.pow(1.37, b), w = 2 * Math.PI * f / sr, r = 0.99, c = 2 * r * Math.cos(w), r2 = r * r;
		let y1 = 0, y2 = 0;
		for (let s = 0; s < 4; s++) { let e = 0; for (let i = s * q; i < (s + 1) * q; i++) { const v = x[i] + c * y1 - r2 * y2; y2 = y1; y1 = v; e += v * v; } out[s * 12 + b] = Math.log10(1e-6 + e / q); }
	}
	const m = out.reduce((s, v) => s + v, 0) / 48;
	let n = 0;
	for (let i = 0; i < 48; i++) { out[i] -= m; n += out[i] * out[i]; }
	n = Math.sqrt(n) || 1;
	return out.map((v) => v / n);
}

test('every piece renders finite, normalised and the right length', () => {
	assert.equal(PIECES.length, 11 * 3 + 6);
	for (const p of PIECES) {
		const d = renderSpellSound(p, SR);
		let peak = 0;
		for (const x of d) { assert.ok(Number.isFinite(x), `${p} has a bad sample`); peak = Math.max(peak, Math.abs(x)); }
		assert.ok(peak > 0.85 && peak <= 0.9001, `${p} peaks at ${peak}`);
		assert.ok(d.length >= SR * 0.4 && d.length <= SR * 2, `${p} is ${d.length} samples`);
		// (it ends in silence: no click at the tail)
		let tail = 0;
		for (let i = d.length - 50; i < d.length; i++) tail = Math.max(tail, Math.abs(d[i]));
		assert.ok(tail < 0.08, `${p} ends at ${tail}`);
	}
});

test('every cast, hit and blast carries weight under 120 Hz, a blast the most', () => {
	for (const s of ['radiance', 'restoration', 'warding', 'dawn', 'shadow', 'void', 'blight', 'umbral', 'storm', 'chrono', 'primal']) {
		const cast = lowShare(renderSpellSound(s, SR), SR, 120), hit = lowShare(renderSpellSound(`${s}-hit`, SR), SR, 120), blast = lowShare(renderSpellSound(`${s}-blast`, SR), SR, 120);
		assert.ok(cast > 0.08, `${s} cast is thin: ${cast.toFixed(3)} below 120 Hz`);
		assert.ok(hit > 0.12, `${s} hit is thin: ${hit.toFixed(3)}`);
		assert.ok(blast > 0.15, `${s} blast is thin: ${blast.toFixed(3)}`);
	}
	// (the void is the deepest of all)
	assert.ok(lowShare(renderSpellSound('void-blast', SR), SR, 120) > lowShare(renderSpellSound('radiance-blast', SR), SR, 120));
});

test('no two schools cast alike', () => {
	// (what each is beyond the craft they share: its shape with the mean of all of them taken out)
	const S = ['radiance', 'restoration', 'warding', 'dawn', 'shadow', 'void', 'blight', 'umbral', 'storm', 'chrono', 'primal'].map((s) => [s, shape(renderSpellSound(s, SR), SR)]);
	const mean = new Float64Array(48);
	for (const [, v] of S) for (let b = 0; b < 48; b++) mean[b] += v[b] / S.length;
	const R = S.map(([s, v]) => { const r = v.map((x, b) => x - mean[b]), n = Math.sqrt(r.reduce((a, x) => a + x * x, 0)) || 1; return [s, r.map((x) => x / n)]; });
	for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
		let dot = 0;
		for (let b = 0; b < 48; b++) dot += R[i][1][b] * R[j][1][b];
		assert.ok(dot < 0.8, `${R[i][0]} and ${R[j][0]} sound alike (${dot.toFixed(3)})`);
	}
});

test('names map to pieces; unknown names fall to the sun; nothing plays without a bus', () => {
	assert.deepEqual(pieceOf('void-blast'), { school: 'void', kind: 'blast' });
	assert.deepEqual(pieceOf('storm'), { school: 'storm', kind: 'cast' });
	assert.deepEqual(pieceOf('level'), { small: 'level' });
	assert.deepEqual(pieceOf('nonsense'), { school: 'radiance', kind: 'cast' });
	const v = createSpellSound({ eye: () => ({ x: 0, y: 0, z: 0 }), yaw: () => 0 });
	assert.equal(v.play('void', { x: 3, y: 0, z: 0 }), false);
	assert.equal(v.playing, 0);
});
