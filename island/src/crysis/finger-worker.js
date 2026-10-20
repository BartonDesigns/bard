// The fingers' solve for a held item, off the main thread (crysis/finger-solve.js packs the job
// and reads the answer).
import { FINGER_SOLVE, solveJob } from './finger-solve.js';

self.onmessage = (e) => {
	const { id, v, job } = e.data || {};
	if (v !== FINGER_SOLVE) { self.postMessage({ id, error: `finger solve ${v} asked of ${FINGER_SOLVE}` }); return; }
	try { self.postMessage({ id, out: solveJob(job) }); }
	catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
