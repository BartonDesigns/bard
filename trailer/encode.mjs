#!/usr/bin/env node
// Cuts the captured frames into the trailer, on the soundtrack's bar lines: each shot with
// its caption, hard cuts on the downbeat (a white flash where the faceplate hands off to the
// world), the title over the faceplate, the end card on the last two bars, and the
// soundtrack the Bard itself played (trailer/soundtrack.mjs: song.wav, with a little room
// added here). H.264 yuv420p, +faststart. Also a poster frame and a 10 s teaser.
//
//   node trailer/encode.mjs [--frames dir] [--cards dir] [--song file] [--out dir]
//                           [--w 1920 --h 1080] [--crf 18] [--ffmpeg path] [--skip id,id]
//
// A shot with no frames on disk is held on black for its bars (and said so), so the cut
// always stays on the music.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, FPS, CAPTIONS, BAR, START, END_BARS } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const framesDir = arg('frames', '/tmp/claude-0/trailer/frames');
const cards = arg('cards', '/tmp/claude-0/trailer/cards');
const song = arg('song', '/tmp/claude-0/trailer/song.wav');
const outDir = arg('out', here);
const W = +arg('w', 1920), H = +arg('h', 1080), crf = +arg('crf', 18);
const skip = String(arg('skip', '')).split(',').filter(Boolean);
const ff = arg('ffmpeg', process.env.FFMPEG || '/tmp/claude-0/ff/node_modules/ffmpeg-static/ffmpeg');
// the title over the faceplate's last two bars; the end card's ring-out past the last bar
const TITLE = [BAR * 2 + 0.2, BAR * 4 - 0.35], TAIL = 1.4;

function frames(s) {
	const d = path.join(framesDir, s.id);
	const need = Math.round(s.dur * FPS) + (s.pre || 0);
	if (skip.includes(s.id) || !fs.existsSync(d)) return null;
	const f = fs.readdirSync(d).filter((n) => /^f\d{5}\.(png|jpg)$/.test(n)).sort();
	if (f.length < need) { console.log(`shot ${s.id}: ${f.length}/${need} frames, held on black`); return null; }
	return path.join(d, 'f%05d.' + f[0].split('.').pop());
}

const inputs = [], fc = [];
const nIn = () => inputs.filter((x) => x === '-i').length;
const image = (file, dur) => { inputs.push('-loop', '1', '-framerate', String(FPS), '-t', dur.toFixed(4), '-i', file); return nIn() - 1; };
const labels = [];
let t = 0;
SHOTS.forEach((s, i) => {
	const pattern = frames(s), n = Math.round(s.dur * FPS);
	if (pattern) {
		inputs.push('-framerate', String(FPS), '-start_number', String(s.pre || 0), '-i', pattern);
		fc.push(`[${nIn() - 1}:v]trim=end_frame=${n},setpts=PTS-STARTPTS,scale=${W}:${H}:flags=lanczos,setsar=1,format=yuva420p[s${i}]`);
	} else {
		inputs.push('-f', 'lavfi', '-t', s.dur.toFixed(4), '-i', `color=c=black:s=${W}x${H}:r=${FPS}`);
		fc.push(`[${nIn() - 1}:v]setsar=1,format=yuva420p[s${i}]`);
	}
	let v = `s${i}`;
	const cap = CAPTIONS[s.id] && path.join(cards, `cap-${s.id}.png`);
	if (cap && fs.existsSync(cap)) {
		// in a beat after the cut, out a little before the next
		const a = Math.min(0.45, s.dur * 0.15), b = s.dur - Math.min(0.45, s.dur * 0.12), f = Math.min(0.4, (b - a) / 4);
		const k = image(cap, s.dur);
		fc.push(`[${k}:v]scale=${W}:${H},format=rgba,fade=in:st=${a.toFixed(3)}:d=${f.toFixed(3)}:alpha=1,fade=out:st=${(b - f).toFixed(3)}:d=${f.toFixed(3)}:alpha=1[c${i}]`);
		fc.push(`[${v}][c${i}]overlay=0:0:format=auto[o${i}]`);
		v = `o${i}`;
	}
	if (s.id === 'face' && fs.existsSync(path.join(cards, 'title.png'))) {
		const k = image(path.join(cards, 'title.png'), s.dur);
		fc.push(`[${k}:v]scale=${W}:${H},format=rgba,fade=in:st=${TITLE[0].toFixed(3)}:d=0.8:alpha=1,fade=out:st=${(TITLE[1] - 0.5).toFixed(3)}:d=0.5:alpha=1[ti]`);
		fc.push(`[${v}][ti]overlay=0:0:format=auto,fade=in:st=0:d=0.6[t${i}]`);
		v = `t${i}`;
	}
	// the hand-off from the faceplate to the world: the first world frame flashes from white
	if (i > 0 && SHOTS[i - 1].dom && !s.dom) { fc.push(`[${v}]fade=in:st=0:d=0.35:color=white[w${i}]`); v = `w${i}`; }
	fc.push(`[${v}]format=yuv420p,fps=${FPS}[v${i}]`);
	labels.push(`[v${i}]`);
	t += s.dur;
});
// the end card, on the last bars and the ring-out
const END = END_BARS * BAR + TAIL;
const ke = image(path.join(cards, 'end.png'), END);
fc.push(`[${ke}:v]scale=${W}:${H},format=yuv420p,setsar=1,fade=in:st=0:d=0.25,fade=out:st=${(END - 1.0).toFixed(3)}:d=1,fps=${FPS}[vend]`);
labels.push('[vend]');
fc.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[vout]`);
const total = t + END;
// the soundtrack from its first downbeat, with a small room round it; or silence
if (fs.existsSync(song)) {
	inputs.push('-i', song);
	fc.push(`[${nIn() - 1}:a]atrim=start=${START},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo,asplit[dry][wet0]`);
	fc.push('[wet0]aecho=0.8:0.6:43|71|113:0.28|0.2|0.14,lowpass=f=6000,volume=0.5[wet]');
	fc.push(`[dry][wet]amix=inputs=2:weights=1 0.6:normalize=0,alimiter=limit=0.95,afade=out:st=${(total - 1.2).toFixed(3)}:d=1.2,apad=whole_dur=${total.toFixed(3)}[aout]`);
} else {
	console.log(`no soundtrack at ${song}: silent`);
	inputs.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
	fc.push(`[${nIn() - 1}:a]anull[aout]`);
}

function run(args, what) {
	console.log(`ffmpeg: ${what}`);
	const r = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
	if (r.status !== 0) throw new Error(`ffmpeg failed: ${what}`);
}
fs.mkdirSync(outDir, { recursive: true });
const main = path.join(outDir, `level99bard-trailer-${H}p${FPS}.mp4`);
fs.writeFileSync(path.join(framesDir, '..', 'filter.txt'), fc.join(';\n'));
run([...inputs, '-filter_complex', fc.join(';'), '-map', '[vout]', '-map', '[aout]',
	'-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
	'-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', total.toFixed(3), main], `trailer ${total.toFixed(1)} s, ${SHOTS.length} shots`);
// the poster: the title over the faceplate, fully up
run(['-ss', ((TITLE[0] + TITLE[1]) / 2).toFixed(2), '-i', main, '-frames:v', '1', '-q:v', '2', path.join(outDir, 'poster.jpg')], 'poster');
// the teaser: the faceplate, the title and the hand-off into the world, faded out
run(['-i', main, '-t', '10', '-vf', 'fade=out:st=9:d=1', '-af', 'afade=out:st=8.5:d=1.5', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf + 1), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(outDir, 'teaser-10s.mp4')], 'teaser');
console.log(`done: ${main} (${total.toFixed(2)} s)`);
