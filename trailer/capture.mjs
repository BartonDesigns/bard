#!/usr/bin/env node
// Frame-exact trailer capture for the Crysis engine (Level 99 Bard).
//
// Drives island/dev.html in headless Chromium on a virtual clock (cine-runtime.js): the
// engine is stepped exactly 1/fps per frame, the camera is posed by the shot's spline
// rig (cine-camera.js through the Crysis.cine hook), and each frame is read straight off
// the WebGL canvas (so no DOM UI is ever captured). Frames already on disk are skipped
// (the world is still simulated through them, unrendered), so an interrupted render
// resumes where it stopped.
//
//   node trailer/capture.mjs [--w 1920 --h 1080] [--fps 60] [--only id,id] [--frames dir]
//                            [--gpu] [--jpeg] [--limit n] [--every n] [--force]
//
//   --w/--h     the canvas size rendered (the master is scaled to 1080p/2160p at encode)
//   --gpu       use the machine's GPU (default is SwiftShader, the software renderer)
//   --limit n   only the first n frames of each shot (quick looks); --every n: every nth
//   --list      print the shot list with timings and exit
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, FPS } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
	for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch { /* next */ } }
	throw new Error('playwright not found: npm i -g playwright && npx playwright install chromium');
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const W = +arg('w', 1920), H = +arg('h', 1080), fps = +arg('fps', FPS);
const only = arg('only', '') ? String(arg('only')).split(',') : null;
const framesDir = arg('frames', process.env.TRAILER_FRAMES || '/tmp/claude-0/trailer/frames');
const base = arg('url', process.env.TRAILER_URL || 'http://localhost:8765/island/dev.html');
const limit = +arg('limit', 0), every = +arg('every', 1), force = !!arg('force', false), jpeg = !!arg('jpeg', false);
const gpu = !!arg('gpu', false);

if (arg('list', false)) {
	let t = 0;
	for (const s of SHOTS) { console.log(`${s.id.padEnd(16)} ${String(t.toFixed(2)).padStart(6)}s  ${s.dur.toFixed(2)}s  ${Math.round(s.dur * fps)} fr  ${s.dom ? 'faceplate' : s.world || 'earth'}`); t += s.dur; }
	console.log(`total ${t.toFixed(2)} s, ${Math.round(t * fps)} frames at ${fps} fps`);
	process.exit(0);
}

const runtime = fs.readFileSync(path.join(here, 'cine-runtime.js'), 'utf8');
const rig = fs.readFileSync(path.join(here, 'cine-camera.js'), 'utf8');
const musicRig = fs.readFileSync(path.join(here, 'cine-music.js'), 'utf8');
// the soundtrack's note timeline (trailer/soundtrack.mjs): what the taps and the bands follow
const tlFile = arg('timeline', process.env.TRAILER_TIMELINE || '/tmp/claude-0/trailer/timeline.json');
const timeline = fs.existsSync(tlFile) ? fs.readFileSync(tlFile, 'utf8') : 'null';
const src = (f) => (f ? f.toString() : null);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// shots grouped by the world they need, in order of first appearance
// (the faceplate's shots are the page's own UI: trailer/faceplate.mjs captures those)
const want = SHOTS.filter((s) => !s.dom && (!only || only.includes(s.id)));
const groups = new Map();
for (const s of want) { const k = s.world || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }

const { chromium } = loadPlaywright();
const gl = gpu ? ['--use-gl=angle', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

for (const [world, shots] of groups) {
	const todo = shots.filter((s) => force || !done(s));
	if (!todo.length) { log(`world ${world || 'earth'}: all shots on disk`); continue; }
	const browser = await chromium.launch({ args: [...gl, '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
	try {
		const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
		page.on('pageerror', (e) => log('PAGEERROR', e.message));
		page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE', m.text().slice(0, 300)); });
		await page.addInitScript(runtime);
		await page.addInitScript(`window.__TL = ${timeline};`);
		// no stored place to resume, no welcome: a clean world every run
		await page.addInitScript(() => { try { localStorage.clear(); } catch { /* none */ } });
		const t0 = Date.now();
		await page.goto(base + world, { timeout: 180000 });
		await page.waitForFunction((earth) => {
			const w = window.L99Island?.world?.();
			return !!w && (!earth || (w.real?.loaded?.() && w.bridge));
		}, !world, { timeout: 600000, polling: 1000 });
		await page.waitForTimeout(world ? 8000 : 4000);
		await page.addScriptTag({ content: rig });
		await page.addScriptTag({ content: musicRig });
		await page.evaluate(() => {
			const R = window.L99Island.renderer(), render = R.render.bind(R);
			R.render = (s, c) => { if (!window.__cine.noRender) render(s, c); };
			const w = window.CINE.W();
			w.sky.state.speed = 0;
			window.CINE.attach();
			window.__cine.begin();
		});
		await page.waitForTimeout(400);
		log(`world ${world || 'earth'} ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
		for (const s of todo) await shoot(page, s);
	} finally { await browser.close(); }
}
log('capture done');

function dirOf(s) { return path.join(framesDir, s.id); }
function nFrames(s) { return Math.round(s.dur * fps) + (s.pre || 0) + (s.post || 0); }
function fileOf(s, f) { return path.join(dirOf(s), `f${String(f).padStart(5, '0')}.${jpeg ? 'jpg' : 'png'}`); }
function done(s) {
	const n = nFrames(s);
	for (let f = 0; f < n; f += 1) if (want1(s, f) && !fs.existsSync(fileOf(s, f))) return false;
	return true;
}
function want1(s, f) { return (!limit || f < limit) && f % every === 0; }

async function shoot(page, s) {
	fs.mkdirSync(dirOf(s), { recursive: true });
	const n = nFrames(s), dt = 1 / fps, pre = s.pre || 0;
	log(`shot ${s.id}: ${n} frames (${s.dur}s${pre ? ` + ${pre} pre` : ''}${s.post ? ` + ${s.post} post` : ''})`);
	// set the scene: world state, the camera's keys
	const info = await page.evaluate(async ({ setup, cam, opts, seed, dur }) => {
		window.__cine.seed(seed);
		const C = window.CINE, w = C.W();
		const ctx = setup ? await new Function('return (' + setup + ')')()(w, C) : {};
		window.SHOT = ctx || {};
		const keys = new Function('return (' + cam + ')')()(window.SHOT, w, C);
		// the move fills the shot, however long the keys were written for
		if (Array.isArray(keys) && opts?.fit !== false) { const T = keys[keys.length - 1].t; if (T > 0) for (const k of keys) k.t *= dur / T; }
		C.pose = typeof keys === 'function' ? keys : C.path(keys, opts || {});
		C.t = (opts && opts.t0) || 0;
		C.hold = false;
		return window.SHOT.info || 'ok';
	}, { setup: src(s.setup), cam: src(s.cam), opts: s.opts || {}, seed: s.seed || 7, dur: s.dur });
	log(`  setup: ${typeof info === 'string' ? info : JSON.stringify(info)}`);
	// settle: the world streams in round the first pose (sim only, a few rendered)
	const warm = s.warm ?? 90;
	const tw = Date.now();
	for (let k = 0; k < warm; k++) {
		// the last few drawn and read back, so every shader is compiled before frame 0 (else it can come out black)
		const render = k >= warm - 8;
		await page.evaluate(({ t, dt, render, frame, song }) => {
			window.CINE.t = t; window.__cine.noRender = !render;
			if (frame) new Function('return (' + frame + ')')()(t, window.SHOT, window.CINE.W(), -1);
			if (song !== null) window.TRAILER.tick(song - dt, song, null);
			window.__cine.step(dt);
			if (render) window.__cine.grab('image/jpeg', 0.5);
		}, { t: -pre * dt, dt, render, frame: null, song: s.song != null ? s.song - (warm - k) * dt - pre * dt : null });
		if (s.settle && k % 10 === 0) await page.waitForTimeout(s.settle * 100);
	}
	log(`  warm ${warm} steps in ${((Date.now() - tw) / 1000).toFixed(0)} s`);
	const onFrame = src(s.frame);
	let rendered = 0, lastMs = [0, 0]; const tr = Date.now();
	for (let f = 0; f < n; f++) {
		const t = (f - pre) * dt, file = fileOf(s, f);
		const grab = want1(s, f) && (force || !fs.existsSync(file));
		const url = await page.evaluate(({ t, dt, grab, frame, jpeg, song, taps, kind }) => {
			window.CINE.t = t; window.__cine.noRender = !grab;
			if (frame) new Function('return (' + frame + ')')()(t, window.SHOT, window.CINE.W(), t);
			// the song at this frame: its bands into the world, its lead notes struck on the shot's taps
			if (song !== null) window.TRAILER.tick(song + t - dt, song + t, taps, kind);
			const R = window.__cine.real, a = R();
			window.__cine.step(dt);
			const b = R(), u = grab ? window.__cine.grab(jpeg ? 'image/jpeg' : 'image/png', 0.96) : null;
			return { u, ms: [Math.round(b - a), Math.round(R() - b)] };
		}, { t, dt, grab, frame: onFrame, jpeg, song: s.song ?? null, taps: s.taps || null, kind: s.kind || null }).then((r) => { lastMs = r.ms; return r.u; });
		if (grab && url) {
			fs.writeFileSync(file + '.tmp', Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
			fs.renameSync(file + '.tmp', file);
			rendered++;
			if (rendered % 30 === 1 || process.env.VERBOSE) log(`  ${s.id} f${f}/${n}  ${((Date.now() - tr) / 1000 / rendered).toFixed(2)} s/frame (step ${lastMs[0]} ms, grab ${lastMs[1]} ms)`);
		}
		if (limit && f >= limit - 1) break;
	}
	log(`  ${s.id}: ${rendered} frames in ${((Date.now() - tr) / 1000).toFixed(0)} s`);
}
