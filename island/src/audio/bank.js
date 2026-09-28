// The sounds synth.js makes, kept as Web Audio buffers, made once per context and shared.
// Footfalls are made at once when first wanted (a few ms); the voices, the babble and the
// rooms are baked a little at a time, a few ms a frame, so nothing stutters: until one is
// ready, get() hands back null and whoever asked just waits.

import { renderStep, renderLand, renderBabble, renderPhrase, renderLaugh, renderCall, renderClink, renderTyping, renderRoom } from './synth.js';

const STEP_SR = 32000, VOICE_SR = 22050;
export const STEP_VARIANTS = 4;

const banks = new WeakMap();
export function bank(ctx) {
	let B = banks.get(ctx);
	if (B) return B;
	const bufs = new Map(), jobs = [], queued = new Set();
	const make = (chans, sr) => {
		const b = ctx.createBuffer(chans.length, chans[0].length, sr);
		chans.forEach((d, i) => b.getChannelData(i).set(d));
		return b;
	};
	// the recipes, by name
	const RECIPES = {
		babbleFar: () => renderBabble(VOICE_SR, 7, 7, 1, { far: 0.6 }),
		babbleNear: () => renderBabble(VOICE_SR, 3, 6, 2, { talk: 0.7 }),
		typing: function* () { return renderTyping(VOICE_SR, 6, 3); },
	};
	for (let i = 0; i < 6; i++) RECIPES['phrase' + i] = () => renderPhrase(VOICE_SR, i + 1);
	for (let i = 0; i < 3; i++) RECIPES['laugh' + i] = () => renderLaugh(VOICE_SR, i + 1, i === 2 ? 'woman' : 'child');
	for (let i = 0; i < 2; i++) RECIPES['call' + i] = () => renderCall(VOICE_SR, i + 1);
	for (let i = 0; i < 4; i++) RECIPES['clink' + i] = function* () { return renderClink(STEP_SR, i + 1); };

	B = {
		ctx,
		// one footfall: surface, variant, running
		step(surface, v, run) {
			const key = `step:${surface}:${v}:${run ? 1 : 0}`;
			let b = bufs.get(key);
			if (!b) bufs.set(key, b = make([renderStep(surface, v, STEP_SR, run)], STEP_SR));
			return b;
		},
		land(surface) {
			const key = 'land:' + surface;
			let b = bufs.get(key);
			if (!b) bufs.set(key, b = make([renderLand(surface, STEP_SR)], STEP_SR));
			return b;
		},
		// a room's reverberation (stereo), or null while it is being made
		room(name, decay, tone, size) {
			const key = 'room:' + name;
			if (!RECIPES[key]) RECIPES[key] = () => renderRoom(ctx.sampleRate, decay, tone, size, name.length * 97 + 5);
			return B.get(key, true);
		},
		// a baked sound by name, or null (and queued) while it is being made
		get(name, urgent = false) {
			const b = bufs.get(name);
			if (b) return b;
			if (!queued.has(name) && RECIPES[name]) { queued.add(name); const J = { name, gen: RECIPES[name]() }; if (urgent) jobs.unshift(J); else jobs.push(J); }
			return null;
		},
		ready: (name) => bufs.has(name),
		// work on the queue for about `ms`
		work(ms = 3) {
			const t0 = performance.now();
			while (jobs.length && performance.now() - t0 < ms) {
				const J = jobs[0], r = J.gen.next();
				if (!r.done) continue;
				jobs.shift();
				const room = J.name.startsWith('room:');
				bufs.set(J.name, make(room ? r.value : [r.value], room ? ctx.sampleRate : J.name.startsWith('clink') ? STEP_SR : VOICE_SR));
			}
			return jobs.length;
		},
		pending: () => jobs.map((j) => j.name),
		size: () => bufs.size,
	};
	banks.set(ctx, B);
	return B;
}
