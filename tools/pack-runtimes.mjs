// The V1 runtimes are plain source in runtime/src, already carrying every change the page
// used to make to them at load. This packs each one into the gzipped file the page fetches,
// stamps its address in index.html with a hash of the packed bytes (so a browser never keeps
// an old copy) and records it in site-manifest.json.
//   node tools/pack-runtimes.mjs          pack and stamp after editing runtime/src
//   node tools/pack-runtimes.mjs --check  report any packed file or stamp out of step
// To change a V1 runtime, edit its source here and pack it. Do not add a patch to index.html.
import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

// each runtime: the file the page fetches, and the text it must hold
export const RUNTIMES = [
	{
		// the shared world core, executed one block a frame: one source file per block
		out: 'runtime/world-core-235.json.gz',
		text: () => {
			const dir = new URL('runtime/src/world-core/', root);
			return JSON.stringify(fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(new URL(f, dir), 'utf8')));
		},
	},
	{
		// the flight engine, imported as one module (tools/build-gargantua.mjs keeps its black hole current)
		out: 'runtime/flight-235.js.gz',
		text: () => read('runtime/src/flight.js'),
	},
];

const hashOf = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const name = (r) => r.out.slice(r.out.lastIndexOf('/') + 1);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// everything out of step, as sentences; empty when all is well
export function check() {
	const problems = [], page = read('index.html');
	for (const r of RUNTIMES) {
		const file = new URL(r.out, root);
		if (!fs.existsSync(file)) { problems.push(`${r.out} is missing`); continue; }
		const bytes = fs.readFileSync(file);
		if (gunzipSync(bytes).toString('utf8') !== r.text()) problems.push(`${r.out} does not hold its source`);
		const refs = page.match(new RegExp(escape(name(r)) + '(?:\\?v=[0-9a-f]+)?', 'g')) || [];
		if (!refs.length) problems.push(`index.html does not load ${name(r)}`);
		else if (!refs.every((u) => u === name(r) + '?v=' + hashOf(bytes))) problems.push(`index.html loads ${name(r)} with a stale stamp`);
	}
	return problems;
}

export function pack() {
	let page = read('index.html');
	const manifestUrl = new URL('site-manifest.json', root);
	const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));
	for (const r of RUNTIMES) {
		const file = new URL(r.out, root), text = r.text();
		// keep the packed bytes when they already hold the source, so stamps only move on a change
		const same = fs.existsSync(file) && gunzipSync(fs.readFileSync(file)).toString('utf8') === text;
		if (!same) fs.writeFileSync(file, gzipSync(Buffer.from(text, 'utf8'), { level: 9 }));
		const bytes = fs.readFileSync(file), hash = hashOf(bytes);
		page = page.replace(new RegExp(escape(name(r)) + '(?:\\?v=[0-9a-f]+)?', 'g'), name(r) + '?v=' + hash);
		manifest[r.out] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
		console.log(`${r.out}: ${same ? 'unchanged' : 'packed'} ${hash}`);
	}
	fs.writeFileSync(new URL('index.html', root), page);
	const bytes = fs.readFileSync(new URL('index.html', root));
	manifest['index.html'] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
	// a runtime that was replaced leaves the record too
	for (const path of Object.keys(manifest)) if (!fs.existsSync(new URL(path, root))) delete manifest[path];
	const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
	fs.writeFileSync(manifestUrl, JSON.stringify(sorted, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
	if (process.argv.includes('--check')) {
		const problems = check();
		for (const p of problems) console.log(p);
		process.exitCode = problems.length ? 1 : 0;
	} else pack();
}
