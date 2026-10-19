// What people do with their whole body when they play: the pitch and the swing, the keeper's
// ready crouch and full stretch, the kick, the throw, the rider astride a horse with a lance
// couched, the archer's draw, arms up on a roller coaster, the crowd's cheer, a drummer's
// hands. Each is a few key poses over its progress u (0..1), eased from one to the next;
// motion.js lays the result over the walk: the arms (every joint), the spine's turn and
// bend, the hips' turn and how low they sink, where the feet go (in the body's own frame:
// x to its left, y up from the ground, z ahead), a tilt of the whole body, the head.

const arm = (o) => Object.assign({ abd: 0.06, flex: 0.02, roll: 0, bend: 0.2, pro: 1.57, wflex: 0.05, curl: 0, shrug: 0 }, o);
const ARM_KEYS = ['abd', 'flex', 'roll', 'bend', 'pro', 'wflex', 'curl', 'shrug'];
const smooth = (x) => x * x * (3 - 2 * x);

// keys: [u, { L, R: arms; sp: [yaw, pitch, roll] of the chest; hp: [yaw, pitch, roll, drop] of
// the hips; fL, fR: feet [x, y, z] or null for the walk's own; rt: [pitch, roll] of the whole
// body; hd: [yaw, pitch, roll] }]
// a long arm at the ready: both hands on it (tuned so the hands land on its grip and guard)
const CARRY_R = arm({ abd: 0.57, flex: -0.117, roll: 0.947, bend: 1.45, pro: 0.6, wflex: -0.1, curl: 0.6 });
const CARRY_L = arm({ abd: 0.073, flex: 0.62, roll: 0.803, bend: 0.753, pro: 1.065, wflex: 0.1, curl: 0.55 });
// the chest bladed to the gun side and leaning into it, as a rifleman stands: the support
// shoulder forward so that hand reaches the guard, the strong elbow down by the side instead
// of winging out (the head stays on the way they face)
const CARRY_SP = [-0.4, 0.1, 0], RELOAD_SP = [-0.35, 0.16, 0];
// fists up (combat/melee.js)
const GUARD_L = arm({ abd: 0.22, flex: 0.95, roll: 0.95, bend: 2.15, pro: 0.4, curl: 1 });
const GUARD_R = arm({ abd: 0.25, flex: 0.75, roll: 0.9, bend: 2.2, pro: 0.4, curl: 1 });
const HANDS_SET = arm({ abd: 0.12, flex: 0.9, roll: 0.95, bend: 2.0, pro: 0.6, curl: 0.6 });
export const ACTIONS = {
	// a right-hander's pitch from the stretch: set, the leg kick, the stride, the arm whipping
	// over the top, the follow-through
	pitch: { loop: false, keys: [
		[0, { L: HANDS_SET, R: HANDS_SET, sp: [0, 0, 0], hp: [-0.6, 0, 0, 0], fL: [0.12, 0, 0.1], fR: [-0.12, 0, -0.1], hd: [0.5, 0, 0] }],
		[0.3, { L: HANDS_SET, R: HANDS_SET, sp: [-0.2, -0.05, 0], hp: [-1.25, 0, 0.05, 0.02], fL: [0.05, 0.42, 0.18], fR: [-0.08, 0, -0.08], hd: [1.1, 0, 0] }],
		[0.55, { L: arm({ abd: 0.5, flex: 1.35, roll: 0.3, bend: 0.5, pro: 0.3, curl: 0.4 }), R: arm({ abd: 1.45, flex: -0.5, roll: -1.2, bend: 1.7, pro: 1.2, curl: 0.8 }), sp: [-0.55, 0, -0.1], hp: [-1.0, 0, 0, 0.12], fL: [0.1, 0, 0.5], fR: [-0.1, 0, -0.3], hd: [1.2, 0, 0] }],
		[0.7, { L: arm({ abd: 0.3, flex: 0.5, roll: 1.2, bend: 1.9, pro: 0.3, curl: 0.6 }), R: arm({ abd: 0.6, flex: 2.1, roll: 0.3, bend: 0.3, pro: 1.0, curl: 0.3 }), sp: [0.45, 0.35, 0], hp: [-0.1, 0.1, 0, 0.14], fL: [0.1, 0, 0.5], fR: [-0.12, 0.12, -0.3], hd: [0.2, 0.1, 0] }],
		[1, { L: arm({ abd: 0.25, flex: 0.4, roll: 1.1, bend: 1.8, pro: 0.3, curl: 0.5 }), R: arm({ abd: 0.2, flex: 0.55, roll: 1.25, bend: 0.8, pro: 0.6, curl: 0.3 }), sp: [0.6, 0.5, 0], hp: [0.2, 0.15, 0, 0.1], fL: [0.1, 0, 0.5], fR: [-0.2, 0, 0.2], hd: [0, 0.15, 0] }],
	] },
	// the batter: set side-on with the bat up at the back shoulder, then the swing and the finish
	bat: { loop: false, keys: [
		[0, { L: arm({ abd: 0.25, flex: 0.95, roll: 0.95, bend: 1.7, pro: 0.9, curl: 1 }), R: arm({ abd: 0.55, flex: 0.9, roll: 0.9, bend: 2.3, pro: 0.9, curl: 1 }), sp: [-0.25, 0.1, 0], hp: [0, 0.05, 0, 0.08], fL: [0.4, 0, 0.05], fR: [-0.35, 0, 0], hd: [1.25, 0, 0] }],
		[0.35, { L: arm({ abd: 0.25, flex: 0.9, roll: 0.95, bend: 1.6, pro: 0.9, curl: 1 }), R: arm({ abd: 0.6, flex: 0.95, roll: 0.95, bend: 2.3, pro: 0.9, curl: 1 }), sp: [-0.35, 0.1, 0], hp: [-0.1, 0.05, 0, 0.1], fL: [0.55, 0.06, 0.08], fR: [-0.35, 0, 0], hd: [1.3, 0, 0] }],
		[0.6, { L: arm({ abd: 0.9, flex: 1.2, roll: 0.3, bend: 0.2, pro: 0.9, curl: 1 }), R: arm({ abd: 0.3, flex: 1.3, roll: 1.1, bend: 0.8, pro: 0.9, curl: 1 }), sp: [0.8, 0.2, 0], hp: [0.9, 0.05, 0, 0.12], fL: [0.6, 0, 0.1], fR: [-0.3, 0.05, 0], hd: [0.6, 0.05, 0] }],
		[1, { L: arm({ abd: 0.9, flex: 2.2, roll: -0.6, bend: 1.3, pro: 0.9, curl: 1 }), R: arm({ abd: 0.2, flex: 2.0, roll: 1.5, bend: 1.6, pro: 0.9, curl: 1 }), sp: [1.3, 0.1, 0.1], hp: [1.3, 0, 0, 0.08], fL: [0.6, 0, 0.1], fR: [-0.25, 0.1, 0.12], hd: [0.2, 0, 0] }],
	] },
	// the catcher, down in the crouch with the mitt up
	crouch: { loop: false, keys: [
		[0, { L: arm({ abd: 0.3, flex: 1.2, roll: 0.3, bend: 1.2, pro: 1.2, curl: 0.3 }), R: arm({ abd: 0.2, flex: 0.4, roll: 0.6, bend: 1.4, pro: 0.6, curl: 0.8 }), sp: [0, 0.35, 0], hp: [0, 0.2, 0, 0.5], fL: [0.28, 0, 0.1], fR: [-0.28, 0, 0.1], hd: [0, -0.35, 0] }],
	] },
	// down on one knee behind cover, the gun still in both hands (no arms here: the carry or
	// the aim the fighter already holds stays on): the right knee near the ground, the left
	// foot planted ahead, the chest low over the thigh, the legs as the holder's (combat/ai-squads.js)
	kneel: { loop: false, keys: [
		[0, { sp: [0.05, 0.22, 0], hp: [0, 0.1, 0, 0.42], fL: [0.2, 0, 0.25], fR: [-0.18, 0.08, -0.5], hd: [0, -0.12, 0] }],
	] },
	// a fielder or a keeper, ready on the balls of the feet
	ready: { loop: false, keys: [
		[0, { L: arm({ abd: 0.45, flex: 0.55, roll: 0.2, bend: 1.0, pro: 1.9, curl: 0.2 }), R: arm({ abd: 0.45, flex: 0.55, roll: 0.2, bend: 1.0, pro: 1.9, curl: 0.2 }), sp: [0, 0.25, 0], hp: [0, 0.15, 0, 0.16], fL: [0.26, 0, 0.05], fR: [-0.26, 0, 0.05], hd: [0, -0.2, 0] }],
	] },
	// the keeper's full stretch: arms straight up past the head, the body long (the game
	// tips the whole body over into the dive)
	reach: { loop: false, keys: [
		[0, { L: arm({ abd: 0.3, flex: 2.95, roll: 0, bend: 0.1, pro: 1.9, curl: 0.1 }), R: arm({ abd: 0.3, flex: 2.95, roll: 0, bend: 0.1, pro: 1.9, curl: 0.1 }), sp: [0, -0.1, 0], hp: [0, 0, 0, -0.02], fL: [0.14, 0, -0.05], fR: [-0.08, 0.25, -0.1], hd: [0, -0.15, 0] }],
	] },
	// a kick: the plant foot beside the ball, the kicking leg back, then through and up
	kick: { loop: false, keys: [
		[0, { L: arm({ abd: 0.3 }), R: arm({ abd: 0.3 }), sp: [0, 0, 0], hp: [0, 0, 0, 0], fL: [0.12, 0, 0], fR: [-0.12, 0, -0.1], hd: [0, 0.2, 0] }],
		[0.45, { L: arm({ abd: 1.1, flex: 0.4, bend: 0.5 }), R: arm({ abd: 0.5, flex: -0.5, bend: 0.4 }), sp: [0.3, -0.1, 0], hp: [0.35, -0.1, 0, 0.08], fL: [0.2, 0, 0.35], fR: [-0.12, 0.45, -0.55], hd: [0, 0.35, 0] }],
		[0.7, { L: arm({ abd: 1.2, flex: 0.1, bend: 0.4 }), R: arm({ abd: 0.4, flex: 0.9, bend: 0.5 }), sp: [-0.2, 0.05, 0], hp: [-0.3, -0.15, 0, 0.06], fL: [0.2, 0, 0.35], fR: [-0.05, 0.22, 0.55], hd: [0, 0.35, 0] }],
		[1, { L: arm({ abd: 0.9, flex: 0.3, bend: 0.5 }), R: arm({ abd: 0.3, flex: 0.9, bend: 0.6 }), sp: [-0.35, -0.15, 0], hp: [-0.4, -0.2, 0, 0.04], fL: [0.2, 0.05, 0.35], fR: [0, 0.75, 0.75], hd: [0, 0.1, 0] }],
	] },
	// an overarm throw (right-handed)
	throw: { loop: false, keys: [
		[0, { L: arm({ abd: 0.4, flex: 1.2, bend: 0.6, roll: 0.2 }), R: arm({ abd: 1.4, flex: -0.4, roll: -1.2, bend: 1.6, pro: 1.2, curl: 0.8 }), sp: [-0.7, -0.05, 0], hp: [-0.7, 0, 0, 0.05], fL: [0.1, 0, 0.45], fR: [-0.12, 0, -0.2], hd: [0.9, 0, 0] }],
		[0.45, { L: arm({ abd: 0.3, flex: 0.5, roll: 1.2, bend: 1.8, curl: 0.6 }), R: arm({ abd: 0.6, flex: 2.1, roll: 0.3, bend: 0.3, pro: 1.0, curl: 0.3 }), sp: [0.4, 0.3, 0], hp: [0, 0.1, 0, 0.1], fL: [0.1, 0, 0.5], fR: [-0.12, 0.1, -0.2], hd: [0.1, 0.1, 0] }],
		[1, { L: arm({ abd: 0.25, flex: 0.4, roll: 1.1, bend: 1.6, curl: 0.5 }), R: arm({ abd: 0.2, flex: 0.6, roll: 1.2, bend: 0.8, pro: 0.6 }), sp: [0.55, 0.35, 0], hp: [0.2, 0.1, 0, 0.08], fL: [0.1, 0, 0.5], fR: [-0.15, 0, 0.2], hd: [0, 0.1, 0] }],
	] },
	// the football holder, down on one knee with a finger on the ball's tip
	hold: { loop: false, keys: [
		[0, { L: arm({ abd: 0.2, flex: 0.95, roll: 0.3, bend: 0.4, pro: 1.0, curl: 0.2 }), R: arm({ abd: 0.3, flex: 0.6, roll: 0.3, bend: 0.8, pro: 1.2, curl: 0.4 }), sp: [0, 0.35, 0], hp: [0, 0.1, 0, 0.42], fL: [0.2, 0, 0.25], fR: [-0.18, 0.08, -0.5], hd: [0, 0.35, 0] }],
	] },
	// astride a horse, a lance couched under the right arm, the shield on the left
	joust: { loop: false, keys: [
		[0, { L: arm({ abd: 0.35, flex: 0.7, roll: 0.9, bend: 1.5, pro: 0.3, curl: 0.9 }), R: arm({ abd: 0.12, flex: 0.25, roll: 0.25, bend: 1.45, pro: 1.1, curl: 1 }), sp: [0.05, 0.12, 0], hp: [0, 0.1, 0, 0], fL: [0.34, -0.62, 0.12], fR: [-0.34, -0.62, 0.12], hd: [0, 0.05, 0] }],
	] },
	// in the saddle, reins in both hands
	ride: { loop: false, keys: [
		[0, { L: arm({ abd: 0.2, flex: 0.65, roll: 0.5, bend: 1.3, pro: 0.6, curl: 0.9 }), R: arm({ abd: 0.2, flex: 0.65, roll: 0.5, bend: 1.3, pro: 0.6, curl: 0.9 }), sp: [0, 0.08, 0], hp: [0, 0.05, 0, 0], fL: [0.34, -0.62, 0.12], fR: [-0.34, -0.62, 0.12], hd: [0, 0, 0] }],
	] },
	// the archer (right-handed): side-on to the butt, bow arm out at it, the string drawn back
	// to the jaw; u 0 bow down, 0.35 raised, 1 full draw
	draw: { loop: false, keys: [
		[0, { L: arm({ abd: 0.35, flex: 0.4, roll: 0.1, bend: 0.3, pro: 1.57, curl: 0.9 }), R: arm({ abd: 0.3, flex: 0.5, roll: 0.9, bend: 1.3, pro: 0.6, curl: 0.6 }), sp: [0, 0, 0], hp: [0, 0, 0, 0], fL: [0.2, 0, 0], fR: [-0.2, 0, 0], hd: [1.3, 0, 0] }],
		[0.35, { L: arm({ abd: 1.5, flex: 0.1, roll: 0, bend: 0.1, pro: 1.57, curl: 0.9 }), R: arm({ abd: 1.3, flex: 0.9, roll: 1.4, bend: 1.9, pro: 1.0, curl: 0.7 }), sp: [0.1, 0, 0], hp: [0, 0, 0, 0], fL: [0.22, 0, 0], fR: [-0.22, 0, 0], hd: [1.45, 0, 0] }],
		[1, { L: arm({ abd: 1.55, flex: 0.05, roll: 0, bend: 0.05, pro: 1.57, curl: 0.9 }), R: arm({ abd: 1.5, flex: 0.1, roll: 1.55, bend: 2.65, pro: 1.2, curl: 0.75 }), sp: [0.15, 0, 0.05], hp: [0, 0, 0, 0], fL: [0.22, 0, 0], fR: [-0.22, 0, 0], hd: [1.5, 0.02, 0] }],
	] },
	// arms up on the drop (both hands high, open), or hands on the lap bar
	coaster: { loop: false, keys: [
		[0, { L: arm({ abd: 0.2, flex: 0.95, roll: 0.3, bend: 0.8, pro: 0.9, curl: 0.9 }), R: arm({ abd: 0.2, flex: 0.95, roll: 0.3, bend: 0.8, pro: 0.9, curl: 0.9 }), sp: [0, 0, 0], hd: [0, 0, 0] }],
		[1, { L: arm({ abd: 0.45, flex: 2.85, roll: -0.2, bend: 0.25, pro: 1.9, curl: 0.05 }), R: arm({ abd: 0.45, flex: 2.85, roll: -0.2, bend: 0.25, pro: 1.9, curl: 0.05 }), sp: [0, -0.15, 0], hd: [0, -0.25, 0] }],
	] },
	// a cheer: arms up and pumping (loops)
	cheer: { loop: true, keys: [
		[0, { L: arm({ abd: 0.5, flex: 2.5, roll: 0.2, bend: 0.7, pro: 1.9, curl: 0.8 }), R: arm({ abd: 0.5, flex: 2.5, roll: 0.2, bend: 0.7, pro: 1.9, curl: 0.8 }), sp: [0, -0.1, 0], hd: [0, -0.2, 0] }],
		[0.5, { L: arm({ abd: 0.45, flex: 2.95, roll: 0, bend: 0.15, pro: 1.9, curl: 0.9 }), R: arm({ abd: 0.45, flex: 2.95, roll: 0, bend: 0.15, pro: 1.9, curl: 0.9 }), sp: [0, -0.15, 0], hd: [0, -0.25, 0] }],
		[1, { L: arm({ abd: 0.5, flex: 2.5, roll: 0.2, bend: 0.7, pro: 1.9, curl: 0.8 }), R: arm({ abd: 0.5, flex: 2.5, roll: 0.2, bend: 0.7, pro: 1.9, curl: 0.8 }), sp: [0, -0.1, 0], hd: [0, -0.2, 0] }],
	] },
	// clapping (loops)
	clap: { loop: true, keys: [
		[0, { L: arm({ abd: 0.3, flex: 0.95, roll: 1.0, bend: 1.5, pro: 0.2, curl: 0.1 }), R: arm({ abd: 0.3, flex: 0.95, roll: 1.0, bend: 1.5, pro: 0.2, curl: 0.1 }) }],
		[0.5, { L: arm({ abd: 0.4, flex: 0.95, roll: 0.6, bend: 1.4, pro: 0.2, curl: 0.1 }), R: arm({ abd: 0.4, flex: 0.95, roll: 0.6, bend: 1.4, pro: 0.2, curl: 0.1 }) }],
		[1, { L: arm({ abd: 0.3, flex: 0.95, roll: 1.0, bend: 1.5, pro: 0.2, curl: 0.1 }), R: arm({ abd: 0.3, flex: 0.95, roll: 1.0, bend: 1.5, pro: 0.2, curl: 0.1 }) }],
	] },
	// a hand drum between the knees: the hands falling in turn (loops)
	drum: { loop: true, keys: [
		[0, { L: arm({ abd: 0.3, flex: 0.75, roll: 0.5, bend: 1.2, pro: 0.3, curl: 0.2 }), R: arm({ abd: 0.3, flex: 1.05, roll: 0.5, bend: 1.5, pro: 0.3, curl: 0.2 }), sp: [0, 0.25, 0], hd: [0, 0.2, 0] }],
		[0.5, { L: arm({ abd: 0.3, flex: 1.05, roll: 0.5, bend: 1.5, pro: 0.3, curl: 0.2 }), R: arm({ abd: 0.3, flex: 0.75, roll: 0.5, bend: 1.2, pro: 0.3, curl: 0.2 }), sp: [0, 0.25, 0], hd: [0, 0.2, 0] }],
		[1, { L: arm({ abd: 0.3, flex: 0.75, roll: 0.5, bend: 1.2, pro: 0.3, curl: 0.2 }), R: arm({ abd: 0.3, flex: 1.05, roll: 0.5, bend: 1.5, pro: 0.3, curl: 0.2 }), sp: [0, 0.25, 0], hd: [0, 0.2, 0] }],
	] },
	// standing on a surfboard: side-on, knees soft, arms out for the balance
	surf: { loop: false, keys: [
		[0, { L: arm({ abd: 1.0, flex: 0.5, bend: 0.4, pro: 1.0 }), R: arm({ abd: 0.9, flex: -0.2, bend: 0.5, pro: 1.0 }), sp: [0.3, 0.2, 0], hp: [0, 0.1, 0, 0.22], fL: [0.25, 0, 0.3], fR: [-0.25, 0, -0.3], hd: [0.9, 0, 0] }],
	] },
	// lying on the board, paddling (loops)
	paddle: { loop: true, keys: [
		[0, { L: arm({ abd: 0.3, flex: 2.8, bend: 0.2 }), R: arm({ abd: 0.3, flex: 0.4, bend: 0.3 }), sp: [0, -0.4, 0], rt: [1.5, 0], fL: [0.12, 0.2, -0.3], fR: [-0.12, 0.2, -0.3], hd: [0, -0.7, 0] }],
		[0.5, { L: arm({ abd: 0.3, flex: 0.4, bend: 0.3 }), R: arm({ abd: 0.3, flex: 2.8, bend: 0.2 }), sp: [0, -0.4, 0], rt: [1.5, 0], fL: [0.12, 0.2, -0.3], fR: [-0.12, 0.2, -0.3], hd: [0, -0.7, 0] }],
		[1, { L: arm({ abd: 0.3, flex: 2.8, bend: 0.2 }), R: arm({ abd: 0.3, flex: 0.4, bend: 0.3 }), sp: [0, -0.4, 0], rt: [1.5, 0], fL: [0.12, 0.2, -0.3], fR: [-0.12, 0.2, -0.3], hd: [0, -0.7, 0] }],
	] },
	// on a skateboard: side-on, knees bent, arms loose and out; u is how deep the crouch
	skate: { loop: false, keys: [
		[0, { L: arm({ abd: 0.6, flex: 0.3, bend: 0.5, pro: 1.2 }), R: arm({ abd: 0.5, flex: -0.1, bend: 0.5, pro: 1.2 }), sp: [0.2, 0.15, 0], hp: [0, 0.1, 0, 0.12], fL: [0.2, 0.08, 0.25], fR: [-0.2, 0.08, -0.25], hd: [1.0, 0, 0] }],
		[1, { L: arm({ abd: 0.9, flex: 0.6, bend: 0.7, pro: 1.2 }), R: arm({ abd: 0.8, flex: 0.1, bend: 0.8, pro: 1.2 }), sp: [0.2, 0.45, 0], hp: [0, 0.2, 0, 0.42], fL: [0.22, 0.08, 0.25], fR: [-0.22, 0.08, -0.25], hd: [1.0, -0.2, 0] }],
	] },
	// (roll turns the forearm in across the body: near 0 the forearms rise in front, as in a
	// guard; at 0.5 and more they lie across the chest)
	// the hero's own (people/hero.js), after the concept sheet's action row: a sprint, driving off
	// the back foot with the other knee high and the arms pumping; a leap, the legs tucked and
	// the arms out for the landing; a scout's crouch, one knee down, a hand down to the ground,
	// the other forearm across the raised knee, the head up and turned; a fighting stance with
	// the hands open, the lead one forward; a climber's reach, one arm high on a hold, a foot up
	sprint: { loop: false, keys: [[0, { L: arm({ abd: 0.12, flex: 0.6, roll: 0.08, bend: 1.6, pro: 1.3, curl: 0.55 }), R: arm({ abd: 0.14, flex: -0.7, roll: 0.05, bend: 1.4, pro: 1.3, curl: 0.55 }), sp: [0.15, 0.38, 0], hp: [-0.12, 0.2, 0, -0.02], fL: [0.1, 0.06, -0.34], fR: [-0.1, 0.36, 0.26], hd: [-0.08, -0.36, 0] }]] },
	leap: { loop: false, keys: [[0, { L: arm({ abd: 1.05, flex: 0.65, roll: 0.25, bend: 0.5, pro: 1.5, curl: 0.25 }), R: arm({ abd: 0.95, flex: -0.45, roll: 0.25, bend: 0.65, pro: 1.5, curl: 0.25 }), sp: [0.25, 0.3, 0.05], hp: [0.1, 0.25, 0, 0.02], fL: [0.12, 0.55, 0.3], fR: [-0.12, 0.42, -0.28], hd: [0.35, -0.25, 0] }]] },
	scout: { loop: false, keys: [[0, { L: arm({ abd: 0.2, flex: 0.75, roll: 0.55, bend: 1.35, pro: 0.9, wflex: 0.1, curl: 0.45 }), R: arm({ abd: 0.3, flex: 0.45, roll: 0.15, bend: 0.1, pro: 1.0, wflex: -1.1, curl: 0.12 }), sp: [-0.1, 0.62, -0.06], hp: [0.1, 0.3, 0, 0.5], fL: [0.2, 0, 0.32], fR: [-0.15, 0.05, -0.42], hd: [0.6, -0.55, 0] }]] },
	stance: { loop: false, keys: [[0, { L: arm({ abd: 0.25, flex: 1.15, roll: 0.2, bend: 1.35, pro: 0.9, wflex: -0.35, curl: 0.3 }), R: arm({ abd: 0.3, flex: 0.65, roll: 0.25, bend: 2.15, pro: 0.8, wflex: -0.2, curl: 0.35 }), sp: [0.25, 0.14, 0], hp: [0.3, 0.06, 0, 0.2], fL: [0.24, 0, 0.32], fR: [-0.28, 0, -0.26], hd: [-0.25, 0.04, 0] }]] },
	climb: { loop: false, keys: [[0, { L: arm({ abd: 0.4, flex: 0.25, roll: 0.15, bend: 0.4, pro: 1.3, curl: 0.25 }), R: arm({ abd: 0.42, flex: 2.85, roll: 0, bend: 0.12, pro: 1.7, wflex: -0.25, curl: 0.8 }), sp: [0.12, -0.08, 0.1], hp: [-0.1, 0.05, 0, 0.02], fL: [0.12, 0.42, 0.3], fR: [-0.1, 0, -0.06], hd: [-0.2, -0.5, 0] }]] },
	// a walking stride held at its two extremes (the far crowd blends between them)
	stride: { loop: false, keys: [
		[0, { L: arm({ abd: 0.08, flex: -0.3, bend: 0.25 }), R: arm({ abd: 0.08, flex: 0.35, bend: 0.45 }), fL: [0.09, 0, 0.3], fR: [-0.09, 0.06, -0.28], hp: [0.08, 0, 0, 0.03] }],
		[1, { L: arm({ abd: 0.08, flex: 0.35, bend: 0.45 }), R: arm({ abd: 0.08, flex: -0.3, bend: 0.25 }), fL: [0.09, 0.06, -0.28], fR: [-0.09, 0, 0.3], hp: [-0.08, 0, 0, 0.03] }],
	] },
	// a long arm carried at the ready (crysis/held-items.js): the right hand on the grip at the
	// hip, the left forward under the guard
	carry: { loop: false, keys: [[0, { L: CARRY_L, R: CARRY_R, sp: CARRY_SP, hd: [-0.1, 0, 0] }]] },
	// its reload: the support hand down to the cell, away to a pouch at the hip, back, and up
	// to the guard again
	reload: { loop: false, keys: [
		[0, { L: CARRY_L, R: CARRY_R, sp: CARRY_SP, hd: [-0.1, 0, 0] }],
		[0.25, { L: { ...CARRY_L, flex: CARRY_L.flex - 0.2, bend: CARRY_L.bend + 0.35, roll: CARRY_L.roll + 0.15 }, R: { ...CARRY_R, roll: CARRY_R.roll + 0.15 }, sp: RELOAD_SP, hd: [-0.1, 0.2, 0] }],
		[0.5, { L: arm({ abd: 0.3, flex: -0.15, roll: 0.3, bend: 0.7, pro: 1.2, curl: 0.7 }), R: { ...CARRY_R, roll: CARRY_R.roll + 0.15 }, sp: RELOAD_SP, hd: [-0.1, 0.2, 0] }],
		[0.78, { L: { ...CARRY_L, flex: CARRY_L.flex - 0.2, bend: CARRY_L.bend + 0.35, roll: CARRY_L.roll + 0.15 }, R: { ...CARRY_R, roll: CARRY_R.roll + 0.15 }, sp: RELOAD_SP, hd: [-0.1, 0.2, 0] }],
		[1, { L: CARRY_L, R: CARRY_R, sp: CARRY_SP, hd: [-0.1, 0, 0] }],
	] },
	// a fistfight (combat/melee.js): the guard, fists up and chin down; a jab with the lead hand,
	// a cross from the back one, a hook round the side; a two-handed shove; a grab; a bat or
	// bottle swung from the back shoulder; a reel from a blow taken
	guard: { loop: false, keys: [[0, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }]] },
	jab: { loop: false, keys: [
		[0, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.35, { L: arm({ abd: 0.12, flex: 1.5, roll: 0.25, bend: 0.12, pro: 0.15, curl: 1 }), R: GUARD_R, sp: [0.45, 0.1, 0], hp: [0.3, 0, 0, 0.06], fL: [0.13, 0, 0.26], fR: [-0.13, 0, -0.14], hd: [-0.35, 0.08, 0] }],
		[1, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
	] },
	cross: { loop: false, keys: [
		[0, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.4, { L: GUARD_L, R: arm({ abd: 0.12, flex: 1.5, roll: 0.35, bend: 0.12, pro: 0.15, curl: 1 }), sp: [-0.45, 0.12, 0], hp: [-0.3, 0, 0, 0.07], fL: [0.13, 0, 0.18], fR: [-0.13, 0.04, -0.1], hd: [0.3, 0.08, 0] }],
		[1, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
	] },
	hook: { loop: false, keys: [
		[0, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.28, { L: GUARD_L, R: arm({ abd: 0.95, flex: 0.55, roll: 0.25, bend: 1.6, pro: 0.5, curl: 1 }), sp: [0.45, 0.04, 0], hp: [0.3, 0, 0, 0.06], hd: [-0.25, 0.05, 0] }],
		[0.55, { L: GUARD_L, R: arm({ abd: 1.15, flex: 1.35, roll: 1.25, bend: 1.5, pro: 0.3, curl: 1 }), sp: [-0.75, 0.1, 0], hp: [-0.45, 0, 0, 0.08], fR: [-0.13, 0.05, -0.08], hd: [0.35, 0.08, 0] }],
		[1, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
	] },
	shove: { loop: false, keys: [
		[0, { L: GUARD_L, R: GUARD_R, sp: [0, 0.05, 0] }],
		[0.4, { L: arm({ abd: 0.22, flex: 1.45, roll: 0.15, bend: 0.25, pro: 0.1, wflex: -0.9, curl: 0.15 }), R: arm({ abd: 0.22, flex: 1.45, roll: 0.15, bend: 0.25, pro: 0.1, wflex: -0.9, curl: 0.15 }), sp: [0, 0.22, 0], hp: [0, 0.08, 0, 0.06], fL: [0.12, 0, 0.3], fR: [-0.12, 0, -0.2] }],
		[1, { L: arm({}), R: arm({}), sp: [0, 0, 0] }],
	] },
	grab: { loop: false, keys: [[0, { L: arm({ abd: 0.3, flex: 1.15, roll: 0.55, bend: 1.0, pro: 0.6, curl: 0.85 }), R: arm({ abd: 0.3, flex: 1.15, roll: 0.55, bend: 1.0, pro: 0.6, curl: 0.85 }), sp: [0, 0.18, 0], hp: [0, 0.1, 0, 0.1], fL: [0.16, 0, 0.2], fR: [-0.16, 0, -0.2] }]] },
	swing: { loop: false, keys: [
		[0, { L: arm({ abd: 0.55, flex: 0.55, roll: 1.35, bend: 1.9, pro: 0.6, curl: 1 }), R: arm({ abd: 0.75, flex: 0.45, roll: 1.2, bend: 1.95, pro: 0.6, curl: 1 }), sp: [0.75, 0, 0], hp: [0.4, 0, 0, 0.05], fL: [0.15, 0, 0.18], fR: [-0.15, 0, -0.16], hd: [-0.5, 0, 0] }],
		[0.45, { L: arm({ abd: 0.3, flex: 1.3, roll: 0.25, bend: 0.45, pro: 0.6, curl: 1 }), R: arm({ abd: 0.35, flex: 1.25, roll: 0.3, bend: 0.5, pro: 0.6, curl: 1 }), sp: [-0.55, 0.12, 0], hp: [-0.35, 0, 0, 0.08], hd: [0.2, 0.05, 0] }],
		[1, { L: arm({ abd: 0.4, flex: 0.9, roll: 1.1, bend: 1.2, pro: 0.6, curl: 1 }), R: arm({ abd: 0.5, flex: 0.85, roll: 1.0, bend: 1.3, pro: 0.6, curl: 1 }), sp: [-0.9, 0.1, 0], hp: [-0.5, 0, 0, 0.06], hd: [0.4, 0, 0] }],
	] },
	reel: { loop: false, keys: [
		[0, { sp: [0, 0, 0], hd: [0, 0, 0] }],
		[0.3, { L: arm({ abd: 0.6, flex: 0.3, bend: 0.9, curl: 0.5 }), R: arm({ abd: 0.5, flex: 0.5, bend: 1.1, curl: 0.5 }), sp: [0.25, -0.28, 0.12], hp: [0, -0.1, 0, 0.04], hd: [0.35, -0.35, 0.1] }],
		[1, { sp: [0, 0, 0], hd: [0, 0, 0] }],
	] },
	// close combat (combat/melee.js, melee-foes.js): forearms up round the face; a boxer's
	// shuffle (the guard, the feet taking small steps in turn, looping) while circling; a
	// haymaker drawn back from the rear shoulder and thrown through; a two-handed overhead
	// with a bat or a pipe; flinching from a blow nearby; up off the ground after a fall; a
	// choke from behind and the one choked; hands behind the back for the cuffs
	block: { loop: false, keys: [[0, { L: arm({ abd: 0.12, flex: 1.35, roll: 1.25, bend: 2.55, pro: 0.25, curl: 1 }), R: arm({ abd: 0.12, flex: 1.3, roll: 1.25, bend: 2.55, pro: 0.25, curl: 1 }), sp: [0.1, 0.16, 0], hp: [0.1, 0.04, 0, 0.07], fL: [0.13, 0, 0.14], fR: [-0.13, 0, -0.16], hd: [0, 0.22, 0] }]] },
	shuffle: { loop: true, keys: [
		[0, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.06], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.25, { L: GUARD_L, R: GUARD_R, sp: [0.27, 0.07, 0.02], hp: [0.2, 0, 0.02, 0.07], fL: [0.15, 0.06, 0.2], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.5, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.75, { L: GUARD_L, R: GUARD_R, sp: [0.23, 0.07, -0.02], hp: [0.2, 0, -0.02, 0.07], fL: [0.13, 0, 0.16], fR: [-0.15, 0.06, -0.1], hd: [-0.2, 0.08, 0] }],
		[1, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.06], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
	] },
	haymaker: { loop: false, keys: [
		[0, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
		[0.5, { L: arm({ abd: 0.3, flex: 1.1, roll: 1.0, bend: 1.9, pro: 0.4, curl: 1 }), R: arm({ abd: 1.05, flex: -0.15, roll: 0.7, bend: 2.0, pro: 0.5, curl: 1 }), sp: [0.75, -0.06, 0.04], hp: [0.5, -0.04, 0, 0.08], fL: [0.13, 0, 0.2], fR: [-0.15, 0, -0.26], hd: [-0.55, 0.05, 0] }],
		[0.64, { L: arm({ abd: 0.25, flex: 0.7, roll: 1.1, bend: 2.1, pro: 0.4, curl: 1 }), R: arm({ abd: 0.9, flex: 1.45, roll: 1.25, bend: 0.75, pro: 0.3, curl: 1 }), sp: [-0.85, 0.18, -0.04], hp: [-0.5, 0.05, 0, 0.1], fL: [0.13, 0, 0.32], fR: [-0.13, 0.05, -0.1], hd: [0.45, 0.1, 0] }],
		[1, { L: GUARD_L, R: GUARD_R, sp: [0.25, 0.06, 0], hp: [0.2, 0, 0, 0.05], fL: [0.13, 0, 0.16], fR: [-0.13, 0, -0.14], hd: [-0.2, 0.08, 0] }],
	] },
	overhead: { loop: false, keys: [
		[0, { L: arm({ abd: 0.4, flex: 0.9, roll: 1.1, bend: 1.2, pro: 0.6, curl: 1 }), R: arm({ abd: 0.5, flex: 0.85, roll: 1.0, bend: 1.3, pro: 0.6, curl: 1 }), sp: [0.2, 0, 0], hp: [0.1, 0, 0, 0.05], fL: [0.15, 0, 0.18], fR: [-0.15, 0, -0.16] }],
		[0.5, { L: arm({ abd: 0.35, flex: 2.7, roll: 0.3, bend: 1.4, pro: 0.6, curl: 1 }), R: arm({ abd: 0.4, flex: 2.8, roll: 0.3, bend: 1.5, pro: 0.6, curl: 1 }), sp: [0.1, -0.2, 0], hp: [0.05, -0.05, 0, 0.04], fL: [0.15, 0, 0.2], fR: [-0.15, 0, -0.2], hd: [0, -0.15, 0] }],
		[0.66, { L: arm({ abd: 0.3, flex: 1.0, roll: 0.6, bend: 0.3, pro: 0.6, curl: 1 }), R: arm({ abd: 0.3, flex: 1.0, roll: 0.6, bend: 0.35, pro: 0.6, curl: 1 }), sp: [0, 0.5, 0], hp: [0, 0.15, 0, 0.14], fL: [0.15, 0, 0.36], fR: [-0.15, 0, -0.18], hd: [0, 0.25, 0] }],
		[1, { L: arm({ abd: 0.4, flex: 0.9, roll: 1.1, bend: 1.2, pro: 0.6, curl: 1 }), R: arm({ abd: 0.5, flex: 0.85, roll: 1.0, bend: 1.3, pro: 0.6, curl: 1 }), sp: [0.2, 0, 0], hp: [0.1, 0, 0, 0.05], fL: [0.15, 0, 0.18], fR: [-0.15, 0, -0.16] }],
	] },
	flinch: { loop: false, keys: [
		[0, { sp: [0, 0, 0], hd: [0, 0, 0] }],
		[0.25, { L: arm({ abd: 0.35, flex: 1.5, roll: 1.2, bend: 2.3, pro: 0.6, curl: 0.4, shrug: 0.6 }), R: arm({ abd: 0.35, flex: 1.45, roll: 1.2, bend: 2.3, pro: 0.6, curl: 0.4, shrug: 0.6 }), sp: [0, 0.25, 0], hp: [0, 0.1, 0, 0.12], hd: [0, 0.35, 0] }],
		[1, { sp: [0, 0, 0], hd: [0, 0, 0] }],
	] },
	getup: { loop: false, keys: [
		[0, { L: arm({ abd: 0.5, flex: 1.2, bend: 0.6, pro: 0.2 }), R: arm({ abd: 0.5, flex: 1.2, bend: 0.6, pro: 0.2 }), sp: [0, 0.2, 0], hp: [0, 0.3, 0, 0.72], rt: [1.35, 0], fL: [0.14, 0.05, -0.55], fR: [-0.14, 0.05, -0.55], hd: [0, -0.5, 0] }],
		[0.45, { L: arm({ abd: 0.3, flex: 0.6, bend: 0.4, pro: 0.6 }), R: arm({ abd: 0.3, flex: 0.9, bend: 0.5, pro: 0.6 }), sp: [0, 0.45, 0], hp: [0, 0.2, 0, 0.45], rt: [0.35, 0], fL: [0.16, 0, 0.3], fR: [-0.14, 0.12, -0.3], hd: [0, 0.1, 0] }],
		[1, { sp: [0, 0, 0], hp: [0, 0, 0, 0], rt: [0, 0], hd: [0, 0, 0] }],
	] },
	choke: { loop: false, keys: [[0, { L: arm({ abd: 0.35, flex: 1.15, roll: 1.35, bend: 2.2, pro: 0.6, curl: 0.9 }), R: arm({ abd: 0.25, flex: 1.25, roll: 1.5, bend: 2.35, pro: 0.3, curl: 0.8 }), sp: [0, 0.2, 0], hp: [0, 0.05, 0, 0.12], fL: [0.16, 0, 0.12], fR: [-0.16, 0, -0.2], hd: [0.2, 0.15, 0] }]] },
	choked: { loop: true, keys: [
		[0, { L: arm({ abd: 0.3, flex: 1.7, roll: 1.1, bend: 2.4, pro: 0.6, curl: 0.8 }), R: arm({ abd: 0.3, flex: 1.6, roll: 1.1, bend: 2.3, pro: 0.6, curl: 0.8 }), sp: [0, -0.18, 0], hp: [0, -0.05, 0, 0.1], hd: [0.1, -0.35, 0] }],
		[0.5, { L: arm({ abd: 0.4, flex: 1.5, roll: 1.0, bend: 2.2, pro: 0.6, curl: 0.9 }), R: arm({ abd: 0.25, flex: 1.75, roll: 1.2, bend: 2.45, pro: 0.6, curl: 0.7 }), sp: [0.1, -0.22, 0.05], hp: [0, -0.06, 0, 0.12], hd: [-0.1, -0.4, 0.05] }],
		[1, { L: arm({ abd: 0.3, flex: 1.7, roll: 1.1, bend: 2.4, pro: 0.6, curl: 0.8 }), R: arm({ abd: 0.3, flex: 1.6, roll: 1.1, bend: 2.3, pro: 0.6, curl: 0.8 }), sp: [0, -0.18, 0], hp: [0, -0.05, 0, 0.1], hd: [0.1, -0.35, 0] }],
	] },
	cuffed: { loop: false, keys: [[0, { L: arm({ abd: 0.18, flex: -0.6, roll: -0.7, bend: 1.4, pro: 0.4, curl: 0.6 }), R: arm({ abd: 0.18, flex: -0.6, roll: -0.7, bend: 1.4, pro: 0.4, curl: 0.6 }), sp: [0, 0.12, 0], hd: [0, 0.3, 0] }]] },
	// the building crews' work (structures/crewpeople.js), each held at a progress the site
	// drives: a block carried in front in both hands; a bar on the right shoulder, the hand up
	// on it; a pane carried upright at the right side, one hand under it, the other steadying
	// it; hammering (u 0 the blow landed, 1 drawn right up), bent to the work; shovelling (dug
	// in, lifted, turned and thrown, back); guiding a load in with the left arm up, looking up
	// at it; holding the mixer's chute; laying blocks down on one knee (a block taken up, set)
	crewCarry: { loop: false, keys: [[0, { L: arm({ abd: 0.14, flex: 0.42, roll: 0.5, bend: 1.05, pro: 0.15, wflex: 0.15, curl: 0.6 }), R: arm({ abd: 0.14, flex: 0.42, roll: 0.5, bend: 1.05, pro: 0.15, wflex: 0.15, curl: 0.6 }), sp: [0, -0.08, 0] }]] },
	crewShoulder: { loop: false, keys: [[0, { R: arm({ abd: 0.3, flex: 1.3, roll: 0.1, bend: 1.85, pro: 1.0, wflex: -0.2, curl: 0.85 }), sp: [0, 0, -0.06], hd: [0.12, 0, 0.05] }]] },
	crewPane: { loop: false, keys: [[0, { R: arm({ abd: 0.22, flex: 0.12, roll: 0.05, bend: 0.3, pro: 2.3, curl: 0.4 }), L: arm({ abd: 0.02, flex: 0.95, roll: 1.25, bend: 1.0, pro: 0.6, curl: 0.4 }), sp: [-0.1, 0, 0.06], hd: [-0.15, 0, 0] }]] },
	crewHammer: { loop: false, keys: [
		[0, { R: arm({ abd: 0.2, flex: 0.75, roll: 0.25, bend: 0.45, pro: 1.0, wflex: 0.2, curl: 1 }), L: arm({ abd: 0.25, flex: 0.85, roll: 0.5, bend: 1.0, pro: 0.6, curl: 0.5 }), sp: [-0.08, 0.32, 0], hp: [0, 0.12, 0, 0.06], fL: [0.17, 0, 0.16], fR: [-0.14, 0, -0.1], hd: [0, 0.3, 0] }],
		[1, { R: arm({ abd: 0.3, flex: 2.0, roll: 0.15, bend: 1.7, pro: 1.0, wflex: -0.35, curl: 1 }), L: arm({ abd: 0.25, flex: 0.85, roll: 0.5, bend: 1.0, pro: 0.6, curl: 0.5 }), sp: [0.05, 0.22, 0], hp: [0, 0.1, 0, 0.05], fL: [0.17, 0, 0.16], fR: [-0.14, 0, -0.1], hd: [0, 0.25, 0] }],
	] },
	crewShovel: { loop: true, keys: [
		[0, { R: arm({ abd: 0.12, flex: 0.15, roll: 0.35, bend: 1.0, pro: 0.9, curl: 1 }), L: arm({ abd: 0.05, flex: 0.62, roll: 0.75, bend: 0.3, pro: 0.9, curl: 1 }), sp: [-0.2, 0.32, 0], hp: [-0.1, 0.1, 0, 0.08], fL: [0.2, 0, 0.24], fR: [-0.17, 0, -0.12], hd: [0, 0.35, 0] }],
		[0.25, { R: arm({ abd: 0.12, flex: 0.05, roll: 0.35, bend: 0.85, pro: 0.9, curl: 1 }), L: arm({ abd: 0.05, flex: 0.55, roll: 0.75, bend: 0.2, pro: 0.9, curl: 1 }), sp: [-0.2, 0.62, 0], hp: [-0.1, 0.22, 0, 0.2], fL: [0.2, 0, 0.24], fR: [-0.17, 0, -0.12], hd: [0, 0.3, 0] }],
		[0.5, { R: arm({ abd: 0.12, flex: 0.35, roll: 0.35, bend: 1.2, pro: 0.9, curl: 1 }), L: arm({ abd: 0.05, flex: 0.95, roll: 0.7, bend: 0.5, pro: 0.9, curl: 1 }), sp: [-0.15, 0.3, 0], hp: [-0.05, 0.1, 0, 0.08], fL: [0.2, 0, 0.24], fR: [-0.17, 0, -0.12], hd: [0, 0.2, 0] }],
		[0.68, { R: arm({ abd: 0.2, flex: 0.55, roll: 0.3, bend: 1.2, pro: 0.9, curl: 1 }), L: arm({ abd: 0.15, flex: 1.2, roll: 0.5, bend: 0.4, pro: 0.9, curl: 1 }), sp: [0.45, 0.22, 0], hp: [0.3, 0.06, 0, 0.05], fL: [0.2, 0, 0.24], fR: [-0.17, 0, -0.12], hd: [0.4, 0.15, 0] }],
		[1, { R: arm({ abd: 0.12, flex: 0.15, roll: 0.35, bend: 1.0, pro: 0.9, curl: 1 }), L: arm({ abd: 0.05, flex: 0.62, roll: 0.75, bend: 0.3, pro: 0.9, curl: 1 }), sp: [-0.2, 0.32, 0], hp: [-0.1, 0.1, 0, 0.08], fL: [0.2, 0, 0.24], fR: [-0.17, 0, -0.12], hd: [0, 0.35, 0] }],
	] },
	crewGuide: { loop: true, keys: [
		[0, { L: arm({ abd: 0.3, flex: 2.95, roll: 0, bend: 0.1, pro: 1.9, curl: 0.15 }), R: arm({ abd: 0.3, flex: 0.55, roll: 0.15, bend: 0.3, pro: 1.6, curl: 0.2 }), sp: [0, -0.08, 0], hd: [0, -0.5, 0] }],
		[0.5, { L: arm({ abd: 0.3, flex: 2.95, roll: 0, bend: 0.75, pro: 1.9, curl: 0.15 }), R: arm({ abd: 0.3, flex: 0.55, roll: 0.15, bend: 0.3, pro: 1.6, curl: 0.2 }), sp: [0, -0.08, 0], hd: [0.08, -0.45, 0] }],
		[1, { L: arm({ abd: 0.3, flex: 2.95, roll: 0, bend: 0.1, pro: 1.9, curl: 0.15 }), R: arm({ abd: 0.3, flex: 0.55, roll: 0.15, bend: 0.3, pro: 1.6, curl: 0.2 }), sp: [0, -0.08, 0], hd: [0, -0.5, 0] }],
	] },
	crewPour: { loop: false, keys: [[0, { L: arm({ abd: 0.15, flex: 0.95, roll: 0.35, bend: 0.65, pro: 0.6, curl: 0.95 }), R: arm({ abd: 0.15, flex: 0.95, roll: 0.35, bend: 0.65, pro: 0.6, curl: 0.95 }), sp: [0, 0.24, 0], hp: [0, 0.08, 0, 0.04], fL: [0.17, 0, 0.18], fR: [-0.15, 0, -0.12], hd: [0, 0.35, 0] }]] },
	crewLay: { loop: true, keys: [
		[0, { L: arm({ abd: 0.15, flex: 0.55, roll: 0.5, bend: 0.75, pro: 0.3, curl: 0.55 }), R: arm({ abd: 0.15, flex: 0.55, roll: 0.5, bend: 0.75, pro: 0.3, curl: 0.55 }), sp: [0, 0.35, 0], hp: [0, 0.12, 0, 0.42], fL: [0.2, 0, 0.25], fR: [-0.18, 0.08, -0.5], hd: [0, 0.35, 0] }],
		[0.5, { L: arm({ abd: 0.15, flex: 0.9, roll: 0.5, bend: 0.55, pro: 0.3, curl: 0.55 }), R: arm({ abd: 0.15, flex: 0.9, roll: 0.5, bend: 0.55, pro: 0.3, curl: 0.55 }), sp: [0, 0.6, 0], hp: [0, 0.2, 0, 0.44], fL: [0.2, 0, 0.25], fR: [-0.18, 0.08, -0.5], hd: [0, 0.4, 0] }],
		[1, { L: arm({ abd: 0.15, flex: 0.55, roll: 0.5, bend: 0.75, pro: 0.3, curl: 0.55 }), R: arm({ abd: 0.15, flex: 0.55, roll: 0.5, bend: 0.75, pro: 0.3, curl: 0.55 }), sp: [0, 0.35, 0], hp: [0, 0.12, 0, 0.42], fL: [0.2, 0, 0.25], fR: [-0.18, 0.08, -0.5], hd: [0, 0.35, 0] }],
	] },
	// a wave (the keeper's hello, a spectator)
	wave: { loop: true, keys: [
		[0, { R: arm({ abd: 0.9, flex: 0.2, roll: -1.3, bend: 1.7, pro: 1.9, curl: 0.05 }) }],
		[0.5, { R: arm({ abd: 0.9, flex: 0.2, roll: -1.9, bend: 1.7, pro: 1.9, curl: 0.05 }) }],
		[1, { R: arm({ abd: 0.9, flex: 0.2, roll: -1.3, bend: 1.7, pro: 1.9, curl: 0.05 }) }],
	] },
};

// an action at progress u: the pose, eased between its keys (null for anything a key leaves out)
const out = { L: arm({}), R: arm({}), sp: [0, 0, 0], hp: [0, 0, 0, 0], fL: [0, 0, 0], fR: [0, 0, 0], rt: [0, 0], hd: [0, 0, 0], has: {} };
export function actionAt(name, u) {
	const A = ACTIONS[name];
	if (!A) return null;
	const K = A.keys;
	u = A.loop ? ((u % 1) + 1) % 1 : Math.max(0, Math.min(1, u));
	let i = 0;
	while (i < K.length - 2 && u > K[i + 1][0]) i++;
	const [u0, a] = K[i], [u1, b] = K[Math.min(i + 1, K.length - 1)];
	const t = u1 > u0 ? smooth(Math.max(0, Math.min(1, (u - u0) / (u1 - u0)))) : 0;
	for (const k of ['L', 'R']) {
		out.has[k] = !!(a[k] || b[k]);
		if (!out.has[k]) continue;
		const A0 = a[k] || b[k], A1 = b[k] || a[k];
		for (const q of ARM_KEYS) out[k][q] = A0[q] + (A1[q] - A0[q]) * t;
	}
	for (const k of ['sp', 'hp', 'fL', 'fR', 'rt', 'hd']) {
		out.has[k] = !!(a[k] || b[k]);
		if (!out.has[k]) continue;
		const A0 = a[k] || b[k], A1 = b[k] || a[k];
		for (let j = 0; j < A0.length; j++) out[k][j] = A0[j] + (A1[j] - A0[j]) * t;
	}
	return out;
}
