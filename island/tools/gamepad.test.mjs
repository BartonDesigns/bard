// Game controllers (ui/gamepad.js): which pad is which, and the layout the menu shows.
// The pad in a browser: tools/gamepad-browser.cjs; in the real game: gamepad-game-browser.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { padFamily, padName, glyphHTML, GLYPHS, LAYOUT } from '../src/ui/gamepad.js';

test('pads: Xbox and PlayStation told apart by what the browser names them', () => {
	assert.equal(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
	assert.equal(padFamily('045e-02fd-Xbox Wireless Controller'), 'xbox');
	assert.equal(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'ps');
	assert.equal(padFamily('054c-09cc-Wireless Controller'), 'ps');
	assert.equal(padFamily('Wireless Controller Extended Gamepad'), 'ps');
	assert.equal(padFamily('8BitDo Pro 2'), 'xbox');
	assert.equal(padName('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'DualSense controller');
	assert.equal(padName('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'Xbox controller');
});

test('glyphs: every button the layout names has one on both pads', () => {
	for (const [, rows] of LAYOUT) for (const [bs, what] of rows) {
		assert.ok(what.length > 3);
		for (const b of bs) for (const f of ['xbox', 'ps']) assert.ok(GLYPHS[f][b], `${f} ${b}`);
	}
	assert.match(glyphHTML('A', 'ps'), /✕/);
	assert.match(glyphHTML('A', 'xbox'), />A</);
	assert.match(glyphHTML('RT', 'ps'), /R2/);
});
