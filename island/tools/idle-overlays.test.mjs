// ui/idle-overlays.js: a screen-sized overlay left at opacity 0 is hidden after a moment, shown
// again the frame its opacity moves, and nothing else of the mount's children is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdleOverlays } from '../src/ui/idle-overlays.js';

const el = (opacity = '', visibility = '') => ({ style: { opacity, visibility } });
const mount = (...kids) => ({ children: kids });

test('an overlay at opacity 0 is hidden once it has sat there long enough, not before', () => {
	const veil = el('0'), m = mount(veil), O = createIdleOverlays(m);
	O.sweep(0); O.sweep(500); O.sweep(1100);
	assert.equal(veil.style.visibility, '', 'a fade-out still running is left alone');
	O.sweep(1300);
	assert.equal(veil.style.visibility, 'hidden');
	assert.deepEqual(O.info(), { hidden: 1, children: 1 });
});

test('shown again the frame its opacity moves, and the clock starts over when it fades again', () => {
	const veil = el('0'), m = mount(veil), O = createIdleOverlays(m);
	O.sweep(0); O.sweep(2000);
	assert.equal(veil.style.visibility, 'hidden');
	veil.style.opacity = '0.6'; O.sweep(2016);
	assert.equal(veil.style.visibility, '');
	veil.style.opacity = '0'; O.sweep(2032); O.sweep(3000);
	assert.equal(veil.style.visibility, '', 'not yet: the fade-out may still be running');
	O.sweep(3300);
	assert.equal(veil.style.visibility, 'hidden');
});

test('only inline opacity 0 counts, and only what it hid is shown again', () => {
	const hint = el('', 'hidden'), button = el('1'), half = el('0.5'), m = mount(hint, button, half), O = createIdleOverlays(m);
	for (let t = 0; t < 5000; t += 100) O.sweep(t);
	assert.equal(hint.style.visibility, 'hidden', 'hidden by its own code, left so');
	assert.equal(button.style.visibility, '');
	assert.equal(half.style.visibility, '');
	assert.deepEqual(O.info(), { hidden: 0, children: 3 });
});

test('wake shows one at once, ahead of the sweep', () => {
	const flash = el('0'), m = mount(flash), O = createIdleOverlays(m);
	O.sweep(0); O.sweep(2000);
	assert.equal(flash.style.visibility, 'hidden');
	flash.style.opacity = '1'; O.wake(flash);
	assert.equal(flash.style.visibility, '');
});
