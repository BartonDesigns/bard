// The fingers' solve for a held item (crysis/finger-pose.js), packed as plain data so it runs
// off the main thread.
//
// Fitting every finger of both hands onto a rifle's own surface asks the item's shape how far
// a point is from it a few hundred thousand times: seconds of work, which on a phone froze the
// game when a rifle first came out. So the view (crysis/viewmodel.js) packs the job (both
// hands' rigs, the item's triangles in item space, where each hand holds, the grip plans) and a
// worker (crysis/finger-worker.js) solves it while the game runs; the hands hold the item by
// their grips until the answer comes. Each answer is kept on the device for that body and item
// (localStorage), so the next time the item comes to hand its fingers are on it at once.
//
//   packMeshes(parts)          -> the triangles of [mesh, matrix] pairs as one Float64Array
//   solveJob(job)              -> { L: {...}, R: {...}, ms }: frames as 16 numbers, params as 20
//   solveLater(job)            -> a promise of the same, from the worker (or here, if no worker)
//   fingerKey(job), kept(key), keep(key, out): the answers kept on the device
import * as THREE from 'three';
import { contactField, solveHand } from './finger-pose.js';

// (bump with any change to the solve, the job or the answer, so kept answers and a cached
// worker are never mixed with a newer one)
export const FINGER_SOLVE = 1;

// [mesh, matrix (mesh to item space)] pairs as one run of triangles in item space
export function packMeshes(parts) {
	let n = 0;
	for (const [mesh] of parts) { const g = mesh.geometry; n += g.index ? g.index.count : g.attributes.position.count; }
	const out = new Float64Array(n * 3), v = new THREE.Vector3();
	let k = 0;
	for (const [mesh, m] of parts) {
		const g = mesh.geometry, p = g.attributes.position, ix = g.index, c = ix ? ix.count : p.count;
		for (let i = 0; i < c; i++) { v.fromBufferAttribute(p, ix ? ix.getX(i) : i).applyMatrix4(m); out[k++] = v.x; out[k++] = v.y; out[k++] = v.z; }
	}
	return out;
}

// plain copies (as structured cloning leaves them) made THREE's again
function revive(o) {
	if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || o.isVector3 || o.isMatrix4) return o;
	if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = revive(o[i]); return o; }
	const k = Object.keys(o);
	if (k.length === 3 && typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number') return new THREE.Vector3(o.x, o.y, o.z);
	if (k.length === 1 && Array.isArray(o.elements) && o.elements.length === 16) return new THREE.Matrix4().fromArray(o.elements);
	for (const key of k) o[key] = revive(o[key]);
	return o;
}
const M4 = (e) => new THREE.Matrix4().fromArray(e);
const box = (m, size) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3().setFromMatrixPosition(m), new THREE.Vector3(size, size, size));
// a run of triangles as the one mesh contactField reads, already in item space
const soup = (tris) => [[{ geometry: { attributes: { position: new THREE.BufferAttribute(tris, 3) }, index: null } }, new THREE.Matrix4()]];
const plain = (r) => r && { params: Array.from(r.params), frame: r.frame.toArray(), shift: r.shift, clearanceMm: r.clearanceMm, missMm: r.missMm };

// job: { kind: 'long' | 'bow', rigs: { L, R } (fingerRig), body (packMeshes of the item's body,
// charger and cell, or its body for a bow), cell (the cell in its own space, or null),
// holdR, holdL (HOLDS' frames, 16 numbers), cellHold, chargeHold (16 numbers), home (the
// charging knob's place, or null), plan (GRIPS[id]) }
export function solveJob(job) {
	const t0 = performance.now(), J = revive(job), R = J.rigs.R, L = J.rigs.L, plan = J.plan, out = { L: {}, R: {}, ms: 0 };
	const holdR = M4(J.holdR), holdL = M4(J.holdL), body = soup(J.body);
	if (J.kind === 'long') {
		const fR = contactField(body, box(holdR, 0.24)), fL = contactField(body, box(holdL, 0.26));
		const ready = solveHand(R, fR, holdR, plan.R.ready);
		out.R.ready = ready; out.R.trigger = solveHand(R, fR, ready.frame, plan.R.trigger, { fit: false });
		out.L.fore = solveHand(L, fL, holdL, plan.L.fore);
		const cellHold = M4(J.cellHold);
		if (J.cell) out.L.cell = solveHand(L, contactField(soup(J.cell), box(cellHold, 0.2)), cellHold, plan.L.cell);
		if (J.home) {
			// the knob's frame in item space, and the hand's frame back in the knob's
			const home = new THREE.Matrix4().makeTranslation(...J.home), at = home.clone().multiply(M4(J.chargeHold));
			const specs = plan.L.charge.map((sp) => sp.target ? { ...sp, target: sp.target.clone().applyMatrix4(home) } : sp);
			const c = solveHand(L, contactField(body, box(at, 0.2)), at, specs);
			c.frame.premultiply(home.invert()); out.L.charge = c;
		}
		out.L.open = solveHand(L, null, holdL, plan.L.open, { fit: false });
	} else if (J.kind === 'bow') {
		out.L.riser = solveHand(L, contactField(body, box(holdL, 0.24)), holdL, plan.L.riser, { firm: true });
		// the draw hand on the string as main had it (the fingers closed round it the way the
		// body's own curl closed them), its thumb now flexed toward the palm, never back
		out.R.draw = solveHand(R, null, new THREE.Matrix4(), plan.R.draw, { fit: false });
	}
	for (const side of [out.L, out.R]) for (const k of Object.keys(side)) side[k] = plain(side[k]);
	out.ms = +(performance.now() - t0).toFixed(1);
	return out;
}

// ---------- the worker ----------
let worker = null, failed = false, seq = 0;
const waiting = new Map();
function startWorker() {
	if (worker || failed || typeof Worker === 'undefined') return worker;
	try {
		worker = new Worker(new URL(`./finger-worker.js?v=${FINGER_SOLVE}`, import.meta.url), { type: 'module' });
		worker.onmessage = (e) => { const w = waiting.get(e.data?.id); if (!w) return; waiting.delete(e.data.id); if (e.data.out) w.ok(e.data.out); else w.here(); };
		// (no worker after all: what is waiting is solved here instead)
		worker.onerror = (e) => { e.preventDefault?.(); failed = true; worker?.terminate(); worker = null; for (const [, w] of waiting) w.here(); waiting.clear(); };
	} catch { failed = true; worker = null; }
	return worker;
}
export function solveLater(job) {
	return new Promise((ok, no) => {
		const here = () => { try { ok(solveJob(job)); } catch (e) { no(e); } };
		const w = startWorker();
		if (!w) { setTimeout(here, 0); return; }
		const id = ++seq;
		waiting.set(id, { ok, no, here });
		try { w.postMessage({ id, v: FINGER_SOLVE, job }); } catch { waiting.delete(id); setTimeout(here, 0); }
	});
}

// ---------- the answers kept on the device ----------
const STORE = 'l99-fingers', KEEP = 16;
// (a short hash of the numbers that decide the answer: the body's hands and the plan, rounded
// to a hundredth of a millimetre)
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const round = (k, v) => typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : ArrayBuffer.isView(v) ? Array.from(v, (x) => Math.round(x * 1e5) / 1e5) : v;
export function fingerKey(item, job) {
	let tris = 0;
	for (const a of [job.body, job.cell]) if (a) for (let i = 0; i < a.length; i += 97) tris = (tris + Math.round(a[i] * 1e5)) | 0;
	const hands = hash(JSON.stringify([job.rigs.L, job.rigs.R], round)), plan = hash(JSON.stringify([job.plan, job.holdR, job.holdL, job.cellHold, job.chargeHold, job.home], round));
	return `${FINGER_SOLVE}:${item}:${job.body.length}:${tris}:${hands}:${plan}`;
}
function store() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } }
export function kept(key) { const s = store()[key]; return s && s.L && s.R ? s : null; }
export function keep(key, out) {
	try {
		const s = store();
		delete s[key]; s[key] = out;
		const keys = Object.keys(s);
		for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete s[k];
		localStorage.setItem(STORE, JSON.stringify(s));
	} catch { /* (private browsing, or full: solved again next time) */ }
}
