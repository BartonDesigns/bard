#!/usr/bin/env node
// The trailer's soundtrack, played by the Bard itself: the faceplate page (index.html) is
// loaded headless, and its Studio's own export path (window.L99Studio181: plan215, the
// phrase generator, auto bass and renderStep, the same calls as EXPORT DRY WAV) renders an
// arrangement offline. The same plan is written out as a note timeline (every lead note,
// bass note and drum hit, in seconds), which the capture follows for its taps and bands,
// so picture and sound come from one list of notes.
//
//   node trailer/soundtrack.mjs [--face BARD] [--bpm 100] [--out /tmp/claude-0/trailer]
//
// Two faceplates play it: BARD, then MAESTRO (the orchestra) from bar 15 (ARRANGEMENT).
//
// Writes song.wav (stereo 44.1 kHz, 16-bit, dry: the room is added at encode) and
// timeline.json ({ bpm, bar, start, lead: [{ t, degree, v }], bass, kick, snare, hat, sections }).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
	for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch { /* next */ } }
	throw new Error('playwright not found');
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const FACE = arg('face', 'BARD'), BPM = +arg('bpm', 100), out = arg('out', '/tmp/claude-0/trailer');
const url = arg('url', 'http://localhost:8765/index.html');
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// the arrangement, two bars a phrase: [phrase, drums, faceplate]
//   phrases: the Studio's generator (seed, density, contour) and an octave shift
//   drums: 'none', 'full' (the faceplate's own Studio groove), 'end' (one hit on the one)
//   faceplate: BARD (its synth voices) or MAESTRO (the orchestra's recorded samples: the
//   lead on violins, doubled by horns an octave down, a choir under each bar)
export const PHRASES = {
	intro: { seed: 211, density: 0.3, contour: 'rise', octave: 0 },
	intro2: { seed: 227, density: 0.45, contour: 'call', octave: 0 },
	verse: { seed: 186, density: 0.5, contour: 'call', octave: 0 },
	verse2: { seed: 287, density: 0.55, contour: 'call', octave: 0 },
	lift: { seed: 305, density: 0.6, contour: 'rise', octave: 0 },
	chorus: { seed: 419, density: 0.72, contour: 'call', octave: 1 },
	chorus2: { seed: 523, density: 0.78, contour: 'fall', octave: 1 },
	end: { seed: 0, density: 0, contour: 'root', octave: 0 },
};
export const ARRANGEMENT = [
	['intro', 'none', 'BARD'], ['intro2', 'none', 'BARD'],          // bars 1-4: the faceplate alone
	['verse', 'full', 'BARD'], ['verse2', 'full', 'BARD'],          // bars 5-8: into the world, the taps
	['verse', 'full', 'BARD'], ['lift', 'full', 'BARD'],            // bars 9-12
	['verse2', 'full', 'BARD'],                                     // bars 13-14
	['chorus', 'full', 'MAESTRO'], ['chorus2', 'full', 'MAESTRO'],  // bars 15-18: the switch, the worlds
	['chorus', 'full', 'MAESTRO'], ['chorus2', 'full', 'MAESTRO'],  // bars 19-22
	['lift', 'full', 'MAESTRO'], ['chorus', 'full', 'MAESTRO'],     // bars 23-26
	['end', 'end', 'MAESTRO'],                                      // bars 27-28: the end card
];
const ORCHESTRA = { lead: 'VIOLIN-SECTION', double: 'FRENCH-HORNS', pad: 'SYMPHONIC-CHOIR' };

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-gpu'] });
try {
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	page.on('pageerror', (e) => log('PAGEERROR', e.message.slice(0, 200)));
	await page.addInitScript(() => { try { localStorage.clear(); } catch { /* none */ } });
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForFunction(() => !!window.L99Studio181?.plan215, null, { timeout: 180000, polling: 500 });
	// each faceplate the song uses, chosen as a player would, and its Studio settings kept
	await page.evaluate(() => { window.__faces = {}; });
	for (const f of [...new Set(ARRANGEMENT.map((a) => a[2]))].filter((q) => q !== FACE).concat(FACE)) {
		await page.click(`.tab-btn[data-face="${f}"]`, { timeout: 20000 }).catch((e) => log('face tab:', e.message.split('\n')[0]));
		await page.waitForFunction((q) => window.L99Studio181.settings()?.face === q, f, { timeout: 60000, polling: 500 }).catch(() => log('Studio face not', f));
		const got = await page.evaluate((q) => { window.__faces[q] = JSON.parse(JSON.stringify(window.L99Studio181.settings())); return window.__faces[q].sound; }, f);
		log(`faceplate ${f}: lead ${got}`);
	}
	// the orchestra's recorded samples, loaded before anything is rendered
	const orch = await page.evaluate(async (types) => {
		const L = window.L99Samples220;
		if (!L) return 'no sample bank';
		L.prepare(types);
		for (let k = 0; k < 240 && !types.every((t) => L.ready(t)); k++) await new Promise((r) => setTimeout(r, 1000));
		return types.map((t) => t + (L.ready(t) ? ' ready' : ' NOT READY')).join(', ');
	}, Object.values(ORCHESTRA));
	log('orchestra: ' + orch);
	const res = await page.evaluate(async ({ PHRASES, ARRANGEMENT, BPM, FACE, ORCHESTRA }) => {
		const S = window.L99Studio181, base = window.__faces[FACE];
		const clone = (o) => JSON.parse(JSON.stringify(o));
		const face = base.face || FACE, n = base.scaleSize || 7;
		// each faceplate's own Studio groove (its pattern(face)): kick, snare on two and four, hats
		const grooves = {};
		const phrase = (spec, drums, f) => {
			const groove = grooves[f] || (grooves[f] = S.pattern(f));
			let p = spec.density > 0 ? S.generate(face, spec.seed, { density: spec.density, contour: spec.contour, scaleSize: n }) : Array.from({ length: 32 }, () => ({ on: false, degree: 0, gate: 1, velocity: 0.8, ratchet: 1, color: 0.4 }));
			if (spec.contour === 'root' && spec.density === 0) { p[0] = { ...p[0], on: true, degree: 0, gate: 1.8, velocity: 0.9 }; p[2] = { ...p[2], on: true, degree: n, gate: 1.8, velocity: 0.7 }; }
			p = p.map((q, i) => ({ ...q, degree: q.degree + spec.octave * n, kick: 0, snare: 0, hat: 0, ...(drums === 'full' ? { kick: groove[i].kick, snare: groove[i].snare, hat: groove[i].hat } : drums === 'light' ? { kick: i % 16 === 0 ? 1 : 0, hat: i % 4 === 2 ? 0.4 : 0 } : drums === 'end' ? { kick: i === 0 ? 1 : 0, snare: i === 0 ? 0.8 : 0 } : {}) }));
			return p;
		};
		// one plan per faceplate over the whole arrangement (each in the same key and scale),
		// each section then rendered from its own faceplate's plan
		const plans = {};
		for (const f of new Set(ARRANGEMENT.map((a) => a[2]))) {
			const config = clone(window.__faces[f] || base);
			Object.assign(config, { bpm: BPM, swing: 0, playScope: 'arrangement', muted: { lead: false, bass: false, drums: false }, leadLevel: 1, drumLevel: 1, preview: false, scaleHz: base.scaleHz, scaleSize: n, transpose: 0, octave: 0 });
			config.phrases = ARRANGEMENT.map(([k, d]) => ({ name: k, pattern: phrase(PHRASES[k], d, f) }));
			config.arrangement = ARRANGEMENT.map((_, i) => i);
			config.pattern = config.phrases[0].pattern;
			config.activePhrase = 0;
			plans[f] = S.plan215(config, 'arrangement');
		}
		const config = plans[FACE].config, plan = plans[FACE];
		// make sure the instruments are loaded: a voice that is not ready yet asks for its
		// samples and answers { unavailable }
		const bassConf = S.bassSettings({ ...config, pattern: config.phrases[2].pattern });
		const sounds = new Set([config.sound, bassConf.sound]);
		for (const f in plans) sounds.add(S.bassSettings({ ...plans[f].config, pattern: plans[f].config.phrases[2].pattern }).sound);
		if (plans.MAESTRO) for (const q of Object.values(ORCHESTRA)) sounds.add(q);
		const missing = [];
		for (let k = 0; k < 120; k++) {
			missing.length = 0;
			const c = new OfflineAudioContext(2, 4410, 44100), g = c.createGain();
			for (const q of sounds) { const v = S.voice(c, q, 220, g, 0); v.stop?.(); if (v.unavailable) missing.push(q); }
			if (!missing.length) break;
			await new Promise((r) => setTimeout(r, 1000));
		}
		// render: exactly the Studio's bounce, over the whole arrangement
		const rate = 44100, dt = 60 / BPM / 4, start = 0.05, length = plan.total * dt + 3;
		const c = new OfflineAudioContext(2, Math.ceil(length * rate), rate);
		const bus = c.createGain(), drums = c.createGain(), comp = c.createDynamicsCompressor();
		comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.14;
		bus.gain.value = 0.8; drums.gain.value = 0.8; bus.connect(comp); drums.connect(comp); comp.connect(c.destination);
		const TL = { bpm: BPM, bar: dt * 16, start, face, sound: config.sound, bassSound: bassConf.sound, orchestra: ORCHESTRA, lead: [], bass: [], kick: [], snare: [], hat: [], sections: [] };
		for (let j = 0; j < plan.total; j++) {
			const f = ARRANGEMENT[Math.floor(j / 32)][2], P = plans[f];
			const sec = P.sections[Math.floor(j / 32)], i = j % 32;
			const cf = { ...P.config, pattern: sec.pattern, bassPattern: sec.bassPattern };
			cf.bassSettings = S.bassSettings(cf);
			const t = start + S.offset215(j, 0) * dt;
			if (f === 'MAESTRO') {
				// the orchestra: violins on the line, horns an octave under it, a choir on each bar
				S.renderStep(c, bus, drums, i, t, { ...cf, sound: ORCHESTRA.lead }, P.frequency);
				const dbl = { ...cf, sound: ORCHESTRA.double, mix: cf.mix * 0.55, bassAuto: false, muted: { lead: false, bass: true, drums: true }, pattern: cf.pattern.map((q) => ({ ...q, degree: q.degree - n })) };
				S.renderStep(c, bus, drums, i, t, dbl, P.frequency);
				if (i % 16 === 0) {
					const root = cf.bassPattern?.[i]?.degree ?? 0;
					const pad = { ...cf, sound: ORCHESTRA.pad, mix: cf.mix * 0.5, bassAuto: false, muted: { lead: false, bass: true, drums: true }, pattern: cf.pattern.map((q, k) => (k === i ? { ...q, on: true, degree: root, gate: 15, velocity: 0.7, ratchet: 1 } : { ...q, on: false })) };
					S.renderStep(c, bus, drums, i, t, pad, P.frequency);
				}
			} else S.renderStep(c, bus, drums, i, t, cf, P.frequency);
			const s = sec.pattern[i];
			if (i === 0) TL.sections.push({ t, name: ARRANGEMENT[Math.floor(j / 32)][0], face: f });
			if (s.on) for (let r = 0; r < (s.ratchet || 1); r++) TL.lead.push({ t: +(t + dt * r / (s.ratchet || 1)).toFixed(4), degree: s.degree, v: +s.velocity.toFixed(3) });
			const b = sec.bassPattern?.[i];
			if (b?.on) TL.bass.push({ t: +(t + dt * (b.offset || 0)).toFixed(4), degree: b.degree, v: +(b.velocity ?? 0.8).toFixed(3) });
			for (const k of ['kick', 'snare', 'hat']) if (s[k]) TL[k].push({ t: +t.toFixed(4), v: +s[k].toFixed(3) });
		}
		const buf = await c.startRendering();
		const L = buf.getChannelData(0), R = buf.getChannelData(1);
		let peak = 0;
		for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
		// loudness per section, to catch a silent instrument
		const rms = TL.sections.map((q) => { let e = 0; const a = Math.floor(q.t * rate), m = Math.floor(TL.bar * 2 * rate); for (let i = a; i < a + m && i < buf.length; i++) e += L[i] * L[i]; return +Math.sqrt(e / m).toFixed(4); });
		const scale = Math.min(1, Math.pow(10, -1 / 20) / Math.max(1e-9, peak));
		const pcm = new Int16Array(buf.length * 2);
		for (let i = 0; i < buf.length; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i] * scale)) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i] * scale)) * 32767; }
		const bytes = new Uint8Array(pcm.buffer);
		let bin = '';
		for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
		return { TL, b64: btoa(bin), frames: buf.length, rate, peak, rms, sounds: [...sounds], missing };
	}, { PHRASES, ARRANGEMENT, BPM, FACE, ORCHESTRA });
	const pcm = Buffer.from(res.b64, 'base64');
	const hdr = Buffer.alloc(44);
	hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
	hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(res.rate, 24);
	hdr.writeUInt32LE(res.rate * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
	fs.writeFileSync(path.join(out, 'song.wav'), Buffer.concat([hdr, pcm]));
	fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(res.TL));
	log(`song.wav ${(res.frames / res.rate).toFixed(1)} s, peak ${res.peak.toFixed(3)}, face ${res.TL.face}, lead ${res.TL.sound}, bass ${res.TL.bassSound}`);
	log(`notes: lead ${res.TL.lead.length}, bass ${res.TL.bass.length}, kick ${res.TL.kick.length}, snare ${res.TL.snare.length}, hat ${res.TL.hat.length}`);
	log('rms by section: ' + res.rms.join(' '));
	log('instruments: ' + res.sounds.join(', ') + (res.missing.length ? '; NOT READY: ' + res.missing.join(', ') : ''));
} finally { await browser.close(); }
