#!/usr/bin/env node
// The trailer's type: the opening title (transparent, laid over the first shot), a place
// caption per shot (transparent, lower left) and the end card (opaque), drawn by headless
// Chromium from plain HTML into PNGs at the trailer's size.
//
//   node trailer/cards.mjs [--w 1920 --h 1080] [--out /tmp/claude-0/trailer/cards]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { CAPTIONS } from './shots.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
	for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch { /* next */ } }
	throw new Error('playwright not found');
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const W = +arg('w', 1920), H = +arg('h', 1080), out = arg('out', '/tmp/claude-0/trailer/cards');
fs.mkdirSync(out, { recursive: true });

// type scales with the frame (designed at 1080p)
const s = H / 1080;
const base = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
body{font-family:'Liberation Serif','DejaVu Serif',serif;color:#fff8ec}
.sh{text-shadow:0 ${2 * s}px ${18 * s}px rgba(0,0,0,.55),0 0 ${4 * s}px rgba(0,0,0,.35)}`;

const pages = {
	title: `<style>${base}
		.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
		h1{font-weight:700;font-size:${124 * s}px;letter-spacing:${0.28 * 124 * s}px;margin-right:${-0.28 * 124 * s}px}
		.rule{width:${360 * s}px;height:${1.5 * s}px;background:linear-gradient(90deg,transparent,#ffe2b0,transparent);margin:${26 * s}px 0 ${22 * s}px}
		p{font-size:${30 * s}px;letter-spacing:${0.42 * 30 * s}px;margin-right:${-0.42 * 30 * s}px;text-transform:uppercase;color:#ffe9c9}
		.v{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,.28),rgba(0,0,0,0) 62%)}</style>
		<div class="v"></div><div class="c sh"><h1>LEVEL 99 BARD</h1><div class="rule"></div><p>The Bay Area and worlds beyond</p></div>`,
	end: `<style>${base}
		body{background:radial-gradient(ellipse at 50% 45%,#1d2433 0%,#0b0d14 60%,#050608 100%)}
		.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
		h1{font-weight:700;font-size:${132 * s}px;letter-spacing:${0.28 * 132 * s}px;margin-right:${-0.28 * 132 * s}px;color:#fff4e0}
		.rule{width:${420 * s}px;height:${1.5 * s}px;background:linear-gradient(90deg,transparent,#e8b86a,transparent);margin:${30 * s}px 0 ${28 * s}px}
		p{font-family:'Liberation Sans','DejaVu Sans',sans-serif;font-size:${40 * s}px;letter-spacing:${0.16 * 40 * s}px;margin-right:${-0.16 * 40 * s}px;color:#e8b86a}
		small{margin-top:${22 * s}px;font-family:'Liberation Sans','DejaVu Sans',sans-serif;font-size:${22 * s}px;letter-spacing:${0.4 * 22 * s}px;margin-right:${-0.4 * 22 * s}px;text-transform:uppercase;color:#9aa3b5}</style>
		<div class="c"><h1>LEVEL 99 BARD</h1><div class="rule"></div><p>level99bard.com</p><small>Play in your browser</small></div>`,
};
for (const [id, [a, b]] of Object.entries(CAPTIONS)) {
	pages['cap-' + id] = `<style>${base}
		.c{position:absolute;left:${96 * s}px;bottom:${88 * s}px}
		h2{font-weight:400;font-size:${46 * s}px;letter-spacing:${0.08 * 46 * s}px}
		.rule{width:${64 * s}px;height:${2 * s}px;background:#e8b86a;margin:${14 * s}px 0 ${12 * s}px}
		p{font-family:'Liberation Sans','DejaVu Sans',sans-serif;font-size:${22 * s}px;letter-spacing:${0.22 * 22 * s}px;text-transform:uppercase;color:#ffe9c9}</style>
		<div class="c sh"><h2>${a}</h2><div class="rule"></div><p>${b}</p></div>`;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
	for (const [id, html] of Object.entries(pages)) {
		await page.setContent('<!doctype html><meta charset="utf-8">' + html);
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: path.join(out, id + '.png'), omitBackground: id !== 'end' });
		console.log('card', id);
	}
} finally { await browser.close(); }
