import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const runtime = new URL('runtime/flight-179.js.gz', root);
const start = '// BEGIN GARGANTUA228\n', end = '// END GARGANTUA228\n';
const source = fs.readFileSync(new URL('runtime/gargantua228.mjs', root), 'utf8').replace(/^export /gm, '');
let flight = gunzipSync(fs.readFileSync(runtime)).toString();
const a = flight.indexOf(start), b = flight.indexOf(end);
if (a >= 0 && b > a) flight = flight.slice(0, a) + flight.slice(b + end.length);
const anchor = 'function _makeAbyssalAccretion(rand, bhR) {';
if (!flight.includes(anchor)) throw new Error('Flight black-hole factory is missing');
flight = flight.replace(anchor, start + source + '\n' + end + anchor);
const oldCall = 'window._galacticBH = _makeAbyssalAccretion(() => Math.random(), 18000);';
const newCall = 'window._galacticBH = createGalacticGargantua228(THREE, 18000);';
if (!flight.includes(oldCall) && !flight.includes(newCall)) throw new Error('Galactic black-hole call is missing');
flight = flight.replace(oldCall, newCall);
// The new kernel supplies its own shadow and lens. The old pass still serves
// the smaller anomalies and the interior, without bending the new disk twice.
const oldLens = 'if (window._galacticBH && cockpitCamera && window._lensPass) {';
const newLens = 'if (window._galacticBH && !window._galacticBH.userData.gargantua228 && cockpitCamera && window._lensPass) {';
if (!flight.includes(oldLens) && !flight.includes(newLens)) throw new Error('Galactic lens handoff is missing');
flight = flight.replace(oldLens, newLens);
fs.writeFileSync(runtime, gzipSync(flight, { level: 9 }));
const hash = createHash('sha256').update(fs.readFileSync(runtime)).digest('hex').slice(0, 12);
const page = new URL('index.html', root);
fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace(/flight-179\.js\.gz(?:\?v=[0-9a-f]+)?/g, 'flight-179.js.gz?v=' + hash));
const manifestUrl = new URL('site-manifest.json', root);
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));
for (const path of ['index.html', 'runtime/flight-179.js.gz']) {
  const bytes = fs.readFileSync(new URL(path, root));
  manifest[path] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
fs.writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log('Packed central black-hole renderer:', hash);
