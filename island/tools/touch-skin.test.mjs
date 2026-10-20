// The touch skin's names to glyphs: every control the game makes on a touch screen gets an icon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, glyphFor, firstTime } from '../src/ui/touch-skin.js';

// [aria-label or title, the button's words, the glyph it should show]
const CONTROLS = [
	['Back to the Bard faceplate', '◀ Bard', 'back'], ['Sky and world settings', '☀', 'sun'], ['Auto music: a generative score', '', 'music'],
	['All controls', '•••', 'more'], ['Your account and saved progress', '', 'cloud'], ['Heavy strike', '', 'heavy'], ['Fly (F)', '✈', 'plane'], ['Gear and trade (I)', '', 'bag'], ['Teleport to a place', '', 'pin'],
	['Jump', '⤒', 'jump'], ['Fly up (hold); double-tap to land', '✈', 'plane'], ['Climb', '⇡', 'climb'], ['Dive', '⤓', 'dive'], ['Swim up', '⇡', 'swimup'], ['Descend', '⇣', 'descend'], ['Crouch (C); from a sprint, slide', '', 'crouch'],
	['Fire', '', 'fire'], ['Draw', '', 'bow'], ['Release', '', 'bow'], ['Reload', 'R', 'reload'], ['Mode', 'AUTO', 'auto'], ['Mode', 'SEMI', 'semi'], ['Mode', 'BURST', 'burst'],
	['Aim', '', 'aim'], ['Aim held item', 'Aim', 'aim'], ['Strike', '', 'fist'], ['Swing', '', 'swing'], ['Slash', '', 'slash'], ['Block', '', 'block'], ['Dodge', '', 'dodge'],
	['Grab', '', 'grab'], ['Takedown', '', 'takedown'], ['Throw', '', 'throw'], ['Surrender', '✋ Surrender', 'surrender'],
	['Drive the road (V)', '', 'road'], ['Stop driving (V)', '', 'exit'], ['Which car (N)', 'Sedan ▸', 'car'], ['Let the road steer (M)', 'Assist', 'assist'],
	['Drive it yourself (M)', 'Drive', 'wheel'], ["Camera: from behind or the driver's seat (C)", '', 'camera'],
	['Steer left', '◀', 'left'], ['Steer right', '▶', 'right'], ['Go', '▲', 'up'], ['Brake and reverse', '▼', 'down'],
	['Turn left next', '◀', 'left'], ['Straight on', '▲', 'up'], ['Turn round', '▼', 'down'],
	['Cannon', 'Cannon', 'cannon'], ['Up', 'Up', 'climb'], ['Down', 'Down', 'descend'],
	['Take the boat out', '⛵ Board', 'boat'], ['Step off the boat', '⛵ Leave boat', 'exit'], ['Fish (H)', 'H', 'rod'],
	['Cast', 'Cast (R)', 'cast'], ['Strike!', 'Strike! (R)', 'hook'], ['Reel in', 'Reel in (R)', 'reel'], ['Hold to reel', '', 'reel'],
	['Talk (Enter)', '💬 Talk', 'talk'], ['Talk (Enter)', '🤝 Help', 'help'], ['Use what you hold (U)', '🩹 Use', 'use'], ['Open the door (E)', '🚪 Open door', 'door'],
	['Pick up the shell (E)', '🐚', 'pickup'], ['Throw it (T)', 'Throw', 'throw'], ['Put it down (E)', 'Put down', 'putdown'], ['Tattoo studio (T)', '', 'pen'],
	['Field contracts · 0 completed', '', 'contract'], ['Warp to a planet, moon, the Sun or the black hole (J)', '⤳ Warp', 'warp'],
];

test('every touch control has a glyph, and every glyph a drawing', () => {
	for (const [a, t, g] of CONTROLS) assert.equal(glyphFor(a, t), g, `${a} (${t})`);
	for (const [, , g] of CONTROLS) assert.ok(GLYPHS[g], `no drawing for ${g}`);
	// (a name nothing knows has no glyph of its own: the skin gives it the general one, never words)
	assert.equal(glyphFor('Accept contract', 'Accept contract'), null);
	assert.ok(GLYPHS.tap);
	for (const [a, g] of [['Return to orbit', 'exit'], ['Leave the horizon', 'exit'], ['Join the rhythm', 'music']]) assert.equal(glyphFor(a, a), g);
});

test('a first-use tip shows once', () => {
	assert.equal(firstTime('l99-test-tip'), true);
	assert.equal(firstTime('l99-test-tip'), false);
});
