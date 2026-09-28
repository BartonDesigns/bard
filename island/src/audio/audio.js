// The world's audio, put together each frame: what is underfoot and round you (sensing.js),
// the room's sound (acoustics.js), your footsteps and the people's (footsteps.js), and the
// places' ambience (ambience.js). Crysis.audio() reads what it is doing.

import { createSensing } from './sensing.js';
import { createFootsteps } from './footsteps.js';
import { createAmbience } from './ambience.js';
import { acoustics, mix } from './acoustics.js';

export function createWorldAudio({ getWorld, camera, people, busy, planet }) {
	const sense = createSensing(), feet = createFootsteps(), amb = createAmbience();
	let room = null, meters = null, last = { under: false, night: 0, hours: 12, rain: 0 };

	// o: { under, night, hours, rain }
	function update(dt, o) {
		last = o;
		const W = getWorld();
		// (nothing to hear from nowhere: a camera not yet placed)
		if (!W || !Number.isFinite(camera.position.x + camera.position.y + camera.position.z)) return;
		const P = W.player.state, S = sense.update(dt, W, camera, P, people, o.hours ?? 12, o.night || 0, planet());
		room = acoustics(dt, { name: o.under ? 'open' : S.room, k: S.roomK, slap: S.slap });
		const indoor = !!S.place.indoor || ['room', 'office', 'shop', 'hall', 'lobby', 'cave', 'dungeon'].includes(S.room);
		feet.update(dt, { P, surface: S.surface, busy: busy(), rain: o.rain, indoor, under: o.under });
		// the people's footfalls near you (people.js): heard, then let go
		const list = people?.steps;
		if (list) { feet.people(dt, list, camera, S.surface, indoor); list.length = 0; }
		const alt = camera.position.y - (P.flying ? W.island.heightAt(camera.position.x, camera.position.z) : camera.position.y - 1.7);
		amb.update(dt, { place: S.place, room: S.room, cam: camera, people, rain: indoor ? 0 : o.rain, under: o.under, alt });
	}
	// a meter on each of the mix's buses (made the first time they are read)
	function levels() {
		const A = mix();
		if (!A) return null;
		if (!meters || meters.ctx !== A.ctx) {
			const an = (node) => { const a = A.ctx.createAnalyser(); a.fftSize = 2048; node.connect(a); return a; };
			meters = { ctx: A.ctx, feet: an(A.feet), amb: an(A.amb), room: an(A.ret) };
		}
		const out = {}, buf = new Float32Array(2048);
		for (const k of ['feet', 'amb', 'room']) {
			meters[k].getFloatTimeDomainData(buf);
			let pk = 0, s = 0;
			for (const v of buf) { pk = Math.max(pk, Math.abs(v)); s += v * v; }
			const db = (x) => Math.round(20 * Math.log10(Math.max(1e-6, x)));
			out[k] = { peakDb: db(pk), rmsDb: db(Math.sqrt(s / buf.length)) };
		}
		return out;
	}
	function debug() {
		const S = sense.state, F = feet.info, M = amb.info, A = mix();
		return {
			running: !!A, surface: S.surface, underfoot: S.why, room: S.room, roomK: +(+S.roomK).toFixed(2), reverb: room,
			place: { kind: S.place.kind, indoor: !!S.place.indoor, busy: +(S.place.busy || 0).toFixed(2), near: +(S.place.near || 0).toFixed(2), talk: +(S.place.talk || 0).toFixed(2), kids: +(S.place.kids || 0).toFixed(2), planet: S.place.planet },
			steps: { count: F.steps, interval: F.interval, cadence: F.cadence, speed: F.speed, level: F.level, peers: F.others },
			beds: { ...M.beds }, crowd: M.crowd, chat: M.chat, voices: M.voices, events: { ...M.events },
			masters: A ? { amb: A.amb.gain.value, feet: A.feet.gain.value } : null,
			levels: levels(), baking: A ? A.B.pending() : [],
		};
	}
	// set the buses' levels: Crysis.audio.set({ amb: 0.8, feet: 1, steps: 0.055 })
	function set(v = {}) {
		const A = mix();
		if (A && v.amb !== undefined) A.amb.gain.value = +v.amb;
		if (A && v.feet !== undefined) A.feet.gain.value = +v.feet;
		if (v.steps !== undefined) feet.info.level = +v.steps;
		return debug();
	}
	// record the world's sound (our buses) for a few seconds: { sr, l, r } (for tests)
	function record(secs = 3) {
		const A = mix();
		if (!A) return Promise.resolve(null);
		const ctx = A.ctx, n = Math.floor(secs * ctx.sampleRate), l = new Float32Array(n), r = new Float32Array(n);
		const sum = ctx.createGain(), sp = ctx.createScriptProcessor(4096, 2, 2), mute = ctx.createGain();
		mute.gain.value = 0;
		for (const b of [A.feet, A.amb, A.ret, A.slap]) b.connect(sum);
		sum.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
		let at = 0;
		return new Promise((done) => {
			sp.onaudioprocess = (e) => {
				const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.getChannelData(1), k = Math.min(a.length, n - at);
				l.set(a.subarray(0, k), at); r.set(b.subarray(0, k), at); at += k;
				if (at >= n) { sp.onaudioprocess = null; for (const x of [A.feet, A.amb, A.ret, A.slap]) x.disconnect(sum); sp.disconnect(); done({ sr: ctx.sampleRate, l, r }); }
			};
		});
	}
	// one step of it by hand, for tests (with the frame's last conditions)
	return { update, debug, set, record, tick: (dt, o) => update(dt, { ...last, ...o }) };
}
