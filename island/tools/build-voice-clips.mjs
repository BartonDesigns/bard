// Makes the voice clips: every line in the bank (tools/voice-bank.mjs), in each of the local
// voices (guide/local-speech-plan.js VOICES), as small MP3 files under assets/voices/ with a
// manifest the game reads to know which pieces it has.
//
//   node tools/build-voice-clips.mjs --lines
//     writes assets/voices/lines.json (clip id -> words), no model needed
//   node tools/build-voice-clips.mjs --render [--kokoro <dir>] [--voices af_heart,am_michael] [--bitrate 32k]
//     makes the clips that are missing, removes ones no longer in the bank, writes the manifest
//
// Rendering needs kokoro-js installed somewhere (mkdir /tmp/kokoro && cd /tmp/kokoro &&
// npm i kokoro-js@1.2.1), the Kokoro model from Hugging Face (fetched on first use) and ffmpeg.
// MP3, 24 kHz mono: every browser decodes it, Safari on iPhone included.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { voiceBank } from './voice-bank.mjs';
import { VOICES } from '../src/guide/local-speech-plan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/voices');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };

const bank = voiceBank();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'lines.json'), JSON.stringify(Object.fromEntries([...bank.chunks].sort((a, b) => a[0].localeCompare(b[0]))), null, '\t') + '\n');
console.log(`${bank.lines.length} lines, ${bank.chunks.size} pieces`);

// which clips are on disk, voice by voice: the manifest the game reads
function writeManifest() {
	const voices = {};
	let bytes = 0;
	for (const voice of VOICES) {
		const dir = path.join(OUT, voice);
		if (!fs.existsSync(dir)) continue;
		const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).filter((id) => bank.chunks.has(id)).sort();
		for (const id of ids) bytes += fs.statSync(path.join(dir, id + '.mp3')).size;
		if (ids.length) voices[voice] = ids;
	}
	fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ version: 1, format: 'mp3', voices }) + '\n');
	console.log(`manifest: ${Object.keys(voices).length} voices, ${(bytes / 1048576).toFixed(1)} MB`);
}

if (args.includes('--render')) {
	const require = createRequire(path.join(path.resolve(opt('kokoro', process.cwd())), 'package.json'));
	const { KokoroTTS } = await import(pathToFileURL(require.resolve('kokoro-js')).href);
	const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
	const voices = opt('voices', VOICES.join(',')).split(',').filter((v) => VOICES.includes(v));
	const bitrate = opt('bitrate', '32k');
	for (const voice of voices) {
		const dir = path.join(OUT, voice);
		fs.mkdirSync(dir, { recursive: true });
		// pieces no longer in the bank go
		for (const f of fs.readdirSync(dir)) if (!bank.chunks.has(f.replace(/\.mp3$/, ''))) fs.unlinkSync(path.join(dir, f));
		let made = 0;
		for (const [id, words] of bank.chunks) {
			const file = path.join(dir, id + '.mp3');
			if (fs.existsSync(file)) continue;
			// the same speed and voice the game asks the model for; the pitch is the player's
			const audio = await tts.generate(words, { voice, speed: 1 });
			const pcm = Buffer.from(new Float32Array(audio.audio).buffer);
			const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(audio.sampling_rate), '-ac', '1', '-i', 'pipe:0', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', bitrate, '-y', file], { input: pcm });
			if (r.status !== 0) throw new Error(`ffmpeg failed on ${id}: ${r.stderr}`);
			if (++made % 50 === 0) console.log(`${voice}: ${made} made`);
		}
		console.log(`${voice}: ${made} made`);
	}
}
writeManifest();
