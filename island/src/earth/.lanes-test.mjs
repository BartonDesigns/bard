import * as THREE from 'three';
import { createGlobeLanes, gridSnap, surveyAt } from './globelanes.js';
import { setFrame, toXZ, toLL, FAR } from './globeframe.js';
import { createSettlements } from '../region/settle.js';
import { KITS } from '../region/kits.js';
const [lat, lon] = process.argv.slice(2).map(Number);
setFrame(lat, lon);
const height = { out: { land: 1 }, atLL: (la, lo) => +(process.env.H0 || 250) + 3 * Math.sin(la * 300) + 3 * Math.cos(lo * 250) };
const groundAt = (x, z) => { const p = toLL(x, z); return height.atLL(p.lat, p.lon); };
const scene = new THREE.Scene();
let lanes = null;
const S = createSettlements({ scene, ground: groundAt, wet: () => false, toXZ, F: (await import('./globeframe.js')).F, lanes: { keepOff: (x, z, m) => lanes.keepOff(x, z, m), gridAt: (x, z) => lanes.gridAt(x, z), onRoad: (x, z, m) => lanes.onRoad(x, z, m) } });
lanes = createGlobeLanes({ scene, height, groundAt, isPhone: false, highways: { near() {}, onRoad: () => false }, settlements: S });
console.log('survey', surveyAt(lat, lon)?.id);
// a few farms and villages round the point
for (let k = 0; k < 8; k++) {
	let la = lat + (Math.sin(k * 7.1) * 0.02), lo = lon + Math.cos(k * 3.3) * 0.025;
	const g = gridSnap(la, lo), kit = surveyAt(lat, lon) ? 'farm' : 'village';
	if (g) { la = g.lat; lo = g.lon; }
	S.add({ key: (k < 6 ? 'farm:' : 'vil:') + k, kind: k < 6 ? 'farm' : 'village', lat: la, lon: lo, kit, kitObj: KITS[kit], kitId: kit, pop: -1, name: 'P' + k, palette: null, opts: {}, env: { snow: 0 }, align: g ? { axis: g.axis } : null });
}
const cam = { position: new THREE.Vector3(FAR.x, 200, FAR.z) };
for (let k = 0; k < 5; k++) S.update(0.6, cam, { budget: 2000 });
const t0 = performance.now();
lanes.settle(cam);
console.log('settle ms', Math.round(performance.now() - t0), JSON.stringify(lanes.info()));
let onGrid = 0; for (const s of S.sites.values()) if (s.planned?.onGrid) onGrid++;
console.log('farms on grid', onGrid, 'sites', S.sites.size);
const out = []; lanes.near('roads', cam.position.x, cam.position.z, 3000, out);
const cls = {}; for (const r of out) cls[r.cls] = (cls[r.cls] || 0) + 1;
console.log('roads near', out.length, JSON.stringify(cls));
// junctions: how many road ends meet another road's end
let ends = 0, met = 0;
for (const r of out) for (const k of [0, r.pts.length - 2]) { ends++; if (out.some((q) => q !== r && [0, q.pts.length - 2].some((j) => Math.hypot(q.pts[j] - r.pts[k], q.pts[j + 1] - r.pts[k + 1]) < 2.5))) met++; }
console.log('ends', ends, 'joined', met);
for (let k = 0; k < 10; k++) S.update(0.6, cam, { budget: 2000 });
console.log('cells', JSON.stringify(S.info()), [...S.sites.values()].map((s) => s.key + ':' + s.cells.size + ':' + Math.round(Math.hypot(s.x - cam.position.x, s.z - cam.position.z))).join(' '));
