#!/usr/bin/env node
// Cuts the captured frames into the trailer: each shot with its place caption, crossfades
// between shots, the title over the opening shot, the end card, an ambient pad synthesised
// by ffmpeg itself (no recorded audio), H.264 yuv420p with +faststart. Also a poster frame
// and a 10 s teaser.
//
//   node trailer/encode.mjs [--frames dir] [--cards dir] [--out dir] [--w 1920 --h 1080]
//                           [--crf 18] [--ffmpeg path] [--skip id,id]
//
// Shots with no frames on disk are left out (and said so).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, FPS, CAPTIONS } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const framesDir = arg('frames', '/tmp/claude-0/trailer/frames');
const cards = arg('cards', '/tmp/claude-0/trailer/cards');
const outDir = arg('out', here);
const W = +arg('w', 1920), H = +arg('h', 1080), crf = +arg('crf', 18);
const skip = String(arg('skip', '')).split(',').filter(Boolean);
const ff = arg('ffmpeg', process.env.FFMPEG || '/tmp/claude-0/ff/node_modules/ffmpeg-static/ffmpeg');
const XF = 0.5, TITLE_END = 4.4, END_DUR = 5;

function frames(s) {
	const d = path.join(framesDir, s.id);
	if (!fs.existsSync(d)) return null;
	const f = fs.readdirSync(d).filter((n) => /^f\d{5}\.(png|jpg)$/.test(n)).sort();
	const need = Math.round(s.dur * FPS) + (s.pre || 0) + (s.post || 0);
	if (f.length < need) { console.log(`shot ${s.id}: ${f.length}/${need} frames, left out`); return null; }
	return { pattern: path.join(d, 'f%05d.' + f[0].split('.').pop()), n: need };
}
const shots = SHOTS.filter((s) => !skip.includes(s.id)).map((s) => ({ s, f: frames(s) })).filter((x) => x.f);
if (!shots.length) { console.log('no shots on disk'); process.exit(1); }

const inputs = [], fc = [];
let t = 0;
const offsets = [];
shots.forEach(({ s, f }, i) => {
	inputs.push('-framerate', String(FPS), '-start_number', String(s.pre || 0), '-i', f.pattern);
	const ki = inputs.filter((x) => x === '-i').length - 1;
	const dur = s.dur, cap = CAPTIONS[s.id] && fs.existsSync(path.join(cards, `cap-${s.id}.png`));
	let v = `[${ki}:v]trim=end_frame=${Math.round(dur * FPS)},setpts=PTS-STARTPTS,scale=${W}:${H}:flags=lanczos,format=yuva420p,setsar=1`;
	fc.push(`${v}[s${i}]`);
	v = `s${i}`;
	if (cap) {
		// the caption: in after half a second, out before the cut (the opener's waits for the title)
		const a = i === 0 ? TITLE_END + 0.1 : 0.45, b = dur - 0.55;
		if (b - a > 0.9) {
			inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', path.join(cards, `cap-${s.id}.png`));
			const k = inputs.filter((x) => x === '-i').length - 1;
			fc.push(`[${k}:v]scale=${W}:${H},format=rgba,fade=in:st=${a}:d=0.5:alpha=1,fade=out:st=${b - 0.5}:d=0.5:alpha=1[c${i}]`);
			fc.push(`[${v}][c${i}]overlay=0:0:format=auto[o${i}]`);
			v = `o${i}`;
		}
	}
	if (i === 0 && fs.existsSync(path.join(cards, 'title.png'))) {
		inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', path.join(cards, 'title.png'));
		const k = inputs.filter((x) => x === '-i').length - 1;
		fc.push(`[${k}:v]scale=${W}:${H},format=rgba,fade=in:st=0.5:d=0.9:alpha=1,fade=out:st=${TITLE_END - 0.8}:d=0.8:alpha=1[ti]`);
		fc.push(`[${v}][ti]overlay=0:0:format=auto,fade=in:st=0:d=0.8[t0]`);
		v = 't0';
	}
	fc.push(`[${v}]format=yuv420p,fps=${FPS}[v${i}]`);
	offsets.push(t);
	t += dur - XF;
});
// the end card
inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(END_DUR), '-i', path.join(cards, 'end.png'));
const ke = inputs.filter((x) => x === '-i').length - 1;
fc.push(`[${ke}:v]scale=${W}:${H},format=yuv420p,setsar=1,fade=out:st=${END_DUR - 1}:d=1,fps=${FPS}[vend]`);
// the chain of crossfades
let cur = 'v0', acc = shots[0].s.dur;
const all = [...shots.map((_, i) => `v${i}`).slice(1), 'vend'];
all.forEach((lab, j) => {
	const next = j === all.length - 1 ? 'vout' : `x${j}`;
	const d = lab === 'vend' ? 1.0 : XF;
	fc.push(`[${cur}][${lab}]xfade=transition=fade:duration=${d}:offset=${(acc - d).toFixed(4)}[${next}]`);
	acc += (lab === 'vend' ? END_DUR : shots[j + 1].s.dur) - d;
	cur = next;
});
const total = acc;
// the pad: a slow A-minor-ish chord of detuned sines, breathing, low-passed, with a sub
// swell under the reveal and a fade at both ends
const notes = [110, 164.81, 220, 261.63, 329.63, 440];
const expr = notes.map((f, i) => `${(0.16 / (1 + i * 0.35)).toFixed(3)}*sin(2*PI*${f}*t)*(0.6+0.4*sin(2*PI*${(0.05 + i * 0.013).toFixed(3)}*t+${i}))+${(0.08 / (1 + i * 0.35)).toFixed(3)}*sin(2*PI*${(f * 1.004).toFixed(3)}*t)`).join('+');
inputs.push('-f', 'lavfi', '-i', `aevalsrc='${expr}+0.12*sin(2*PI*55*t)*min(1,t/6)':s=48000:d=${total.toFixed(3)}`);
const ka = inputs.filter((x) => x === '-i').length - 1;
fc.push(`[${ka}:a]lowpass=f=1800,aecho=0.8:0.7:120|260:0.35|0.25,volume=0.9,afade=in:st=0:d=2.5,afade=out:st=${(total - 3).toFixed(3)}:d=3,aformat=channel_layouts=stereo[aout]`);

function run(args, what) {
	console.log(`ffmpeg: ${what}`);
	const r = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
	if (r.status !== 0) throw new Error(`ffmpeg failed: ${what}`);
}
const main = path.join(outDir, `level99bard-trailer-${H}p${FPS}.mp4`);
fs.writeFileSync(path.join(framesDir, '..', 'filter.txt'), fc.join(';\n'));
run([...inputs, '-filter_complex', fc.join(';'), '-map', '[vout]', '-map', '[aout]',
	'-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
	'-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', total.toFixed(3), main], `trailer ${total.toFixed(1)} s, ${shots.length} shots`);
// the poster: the opening title over the first shot, a moment after it lands
run(['-ss', '2.6', '-i', main, '-frames:v', '1', '-q:v', '2', path.join(outDir, 'poster.jpg')], 'poster');
// the teaser: the first 10 s (the title and the bridge, into the next cut), faded out
run(['-i', main, '-t', '10', '-vf', 'fade=out:st=9:d=1', '-af', 'afade=out:st=8.5:d=1.5', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf + 1), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(outDir, 'teaser-10s.mp4')], 'teaser');
console.log(`done: ${main} (${total.toFixed(2)} s; shots ${shots.map(({ s }) => s.id).join(', ')})`);
