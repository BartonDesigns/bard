#!/usr/bin/env node
// The faceplate's shots: the Bard's own UI (index.html), played. Each frame is a screenshot
// of the page (the DOM this time, not the world's canvas) on the same virtual clock as the
// world's shots, so the page's own animation runs frame-exactly. The lead notes of the
// soundtrack's timeline (trailer/soundtrack.mjs) press the lead pads as a player would
// (the pad's own key), a soft touch mark shows the finger, and the view pushes in slowly
// (screenshots at twice the size, cropped closer each frame).
//
//   node trailer/faceplate.mjs [--only face,maestro] [--frames dir] [--every n] [--force]
//
//   face      bars 1-4 on BARD: the pads played, then the world button (⧉) pressed on the last beat
//   maestro   bar 15: the MAESTRO tab touched and the faceplate turning orchestral, a few notes
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, FPS } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
	for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch { /* next */ } }
	throw new Error('playwright not found');
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const W = +arg('w', 1920), H = +arg('h', 1080), SCALE = +arg('scale', 2);
const framesDir = arg('frames', '/tmp/claude-0/trailer/frames');
const url = arg('url', 'http://localhost:8765/index.html');
const every = +arg('every', 1), force = !!arg('force', false);
const only = arg('only', '') ? String(arg('only')).split(',') : null;
const tlFile = arg('timeline', '/tmp/claude-0/trailer/timeline.json');
const TL = JSON.parse(fs.readFileSync(tlFile, 'utf8'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// per shot: the faceplate, when the view is at its closest (zoom), and scripted touches
// besides the notes ({ at: seconds into the shot, sel: element, click: really press it })
const PLAN = {
	face: { face: 'BARD', zoom: 1.18, touches: [{ at: 9.0, sel: '#island-btn', click: false }] },
	maestro: { face: 'BARD', zoom: 1.12, touches: [{ at: 0.15, sel: '.tab-btn[data-face="MAESTRO"]', click: true }] },
};
const shots = SHOTS.filter((s) => s.dom && PLAN[s.id] && (!only || only.includes(s.id)));

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
	for (const s of shots) {
		const P = PLAN[s.id], dir = path.join(framesDir, s.id), n = Math.round(s.dur * FPS);
		fs.mkdirSync(dir, { recursive: true });
		const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
		page.on('pageerror', (e) => log('PAGEERROR', e.message.slice(0, 160)));
		await page.addInitScript(() => { try { localStorage.clear(); } catch { /* none */ } });
		await page.goto(url, { waitUntil: 'load', timeout: 180000 });
		await page.waitForTimeout(6000);
		// the faceplate as a player first sees it: past the start and audio prompts
		await page.evaluate(() => {
			for (const id of ['audio-unlock-overlay']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
			document.getElementById('btn-start')?.click();
		});
		await page.waitForTimeout(1500);
		await page.click(`.tab-btn[data-face="${P.face}"]`, { timeout: 20000 }).catch((e) => log('face tab:', e.message.split('\n')[0]));
		await page.waitForTimeout(2500);
		// the touch mark: a soft ring where the finger lands
		await page.addStyleTag({ content: '.trailer-touch{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;pointer-events:none;z-index:2147483647;background:radial-gradient(circle,rgba(255,255,255,.55) 0,rgba(255,255,255,.18) 45%,rgba(255,255,255,0) 70%);box-shadow:0 0 0 2px rgba(255,255,255,.35);transform:scale(.6);opacity:0}' });
		// where the view closes in: the lead pads
		const focus = await page.evaluate(() => {
			const r = document.getElementById('lead-pads')?.getBoundingClientRect();
			return r ? [r.left + r.width / 2, r.top + r.height / 2] : [innerWidth / 2, innerHeight / 2];
		});
		await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'cine-runtime.js'), 'utf8').replace('window.__cine = C;', 'window.__cine = C; C.begin();') }).catch(() => {});
		const notes = TL.lead.filter((q) => q.t >= s.song - 1e-3 && q.t < s.song + s.dur - 1e-3).map((q) => ({ ...q, at: q.t - s.song }));
		log(`${s.id}: ${n} frames, ${notes.length} notes, focus ${focus.map((v) => v.toFixed(0))}`);
		let ni = 0, ti = 0, done = 0;
		const down = [];
		for (let f = 0; f < n; f++) {
			const t = f / FPS;
			// notes due by this frame: press the pad for the degree (its key), release after a beat's quarter
			while (ni < notes.length && notes[ni].at <= t + 1e-6) {
				const q = notes[ni++];
				const key = await page.evaluate(({ degree }) => {
					const pads = [...document.querySelectorAll('#lead-pads .pad')];
					if (!pads.length) return null;
					const n2 = pads.length, d = ((degree % n2) + n2) % n2;
					const p = pads.find((e) => +e.dataset.degree === degree) || pads[d];
					const r = p.getBoundingClientRect(), k = p.dataset.key;
					document.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: 'Key' + k.toUpperCase(), bubbles: true }));
					const m = document.createElement('div');
					m.className = 'trailer-touch';
					m.style.left = r.left + r.width / 2 + 'px'; m.style.top = r.top + r.height * 0.55 + 'px';
					document.body.appendChild(m);
					m.animate([{ opacity: 0.95, transform: 'scale(.55)' }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
					setTimeout(() => m.remove(), 600);
					return k;
				}, q);
				if (key) down.push({ key, until: t + 0.16 });
			}
			for (let i = down.length - 1; i >= 0; i--) {
				if (down[i].until <= t) { const k = down[i].key; down.splice(i, 1); await page.evaluate((k2) => document.dispatchEvent(new KeyboardEvent('keyup', { key: k2, code: 'Key' + k2.toUpperCase(), bubbles: true })), k); }
			}
			while (ti < P.touches.length && P.touches[ti].at <= t) {
				const q = P.touches[ti++];
				await page.evaluate(({ sel, click }) => {
					const e = document.querySelector(sel);
					if (!e) return;
					const r = e.getBoundingClientRect(), m = document.createElement('div');
					m.className = 'trailer-touch';
					m.style.left = r.left + r.width / 2 + 'px'; m.style.top = r.top + r.height / 2 + 'px';
					document.body.appendChild(m);
					m.animate([{ opacity: 0.95, transform: 'scale(.55)' }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 520, easing: 'ease-out', fill: 'forwards' });
					e.animate([{ filter: 'brightness(1.8)', transform: 'scale(.92)' }, { filter: 'none', transform: 'none' }], { duration: 380, easing: 'ease-out' });
					if (click) e.click();
				}, q);
			}
			await page.evaluate(() => window.__cine?.step(1 / 60));
			const file = path.join(dir, `f${String(f).padStart(5, '0')}.jpg`);
			if (f % every !== 0 || (!force && fs.existsSync(file))) continue;
			// the push-in: from the whole faceplate toward the pads, easing
			const k = t / s.dur, e = k * k * (3 - 2 * k), z = 1 + (P.zoom - 1) * e;
			const cw = W / z, ch = H / z;
			const cx = Math.min(W - cw / 2, Math.max(cw / 2, W / 2 + (focus[0] - W / 2) * e));
			const cy = Math.min(H - ch / 2, Math.max(ch / 2, H / 2 + (focus[1] - H / 2) * e));
			await page.screenshot({ path: file + '.tmp.jpg', type: 'jpeg', quality: 92, clip: { x: cx - cw / 2, y: cy - ch / 2, width: cw, height: ch }, animations: 'allow' });
			fs.renameSync(file + '.tmp.jpg', file);
			if (++done % 60 === 1) log(`  ${s.id} f${f}/${n}`);
		}
		await page.close();
		log(`${s.id}: done`);
	}
} finally { await browser.close(); }
