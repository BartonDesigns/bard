// Embeds the editable black-hole renderer (runtime/gargantua228.mjs) in the flight engine source
// (runtime/src/flight.js), hands the galactic black hole to it, and packs the engine again.
// Run after editing runtime/gargantua228.mjs:  node tools/build-gargantua.mjs
import fs from 'node:fs';
import { pack } from './pack-runtimes.mjs';

const root = new URL('../', import.meta.url);
const file = new URL('runtime/src/flight.js', root);
const start = '// BEGIN GARGANTUA228\n', end = '// END GARGANTUA228\n';
const source = fs.readFileSync(new URL('runtime/gargantua228.mjs', root), 'utf8').replace(/^export /gm, '');
let flight = fs.readFileSync(file, 'utf8');
const a = flight.indexOf(start), b = flight.indexOf(end);
if (a >= 0 && b > a) flight = flight.slice(0, a) + flight.slice(b + end.length);
const anchor = 'function _makeAbyssalAccretion(rand, bhR) {';
if (!flight.includes(anchor)) throw new Error('Flight black-hole factory is missing');
flight = flight.replace(anchor, () => start + source + '\n' + end + anchor);
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
fs.writeFileSync(file, flight);
pack();
console.log('Embedded the central black-hole renderer in runtime/src/flight.js');
