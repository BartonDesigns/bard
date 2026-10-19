// The hospital's patients, from the door to the bill. Plain data and functions, so the
// runtime (services/index.js), the tests and a server can all run the same rules.
//
//   arrive    brought in by ambulance or walked in: triaged at once, a priority from how bad
//             it is (a child ahead of a grown-up as bad as them)
//   waiting   for a bed: the ward's beds go by priority, then by who came first
//   treating  in a bed, cared for over time: the more doctors and nurses on, the quicker
//   recovering a while longer in the bed, watched
//   discharged and billed: the bill by how much care it took. A child is never billed and
//             never turned away; a grown-up who cannot pay still goes home mended, the debt
//             kept on the record (charge() is the wallet's say, the morality ledger's at merge)
//
// Nobody here is ever hurt by the hospital: care only ever mends, and a patient only leaves
// mended (or carried on to a bigger hospital when this one has no bed for too long).

import { clamp } from '../noise.js';

export const CARE = {
	base: 40,          // credits a stay costs at the least
	perSecond: 0.6,    // ...and for each second of care it took
	cap: 900,          // the most one stay is ever billed
	recover: 40,       // seconds watched in the bed after the care is done
	transfer: 600,     // seconds waiting for a bed before going on to another hospital
};

const finite = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// severity 0..1 (a scrape to the gravest), a minor or not: how soon they are seen
export function priorityOf({ severity = 0.3, minor = false } = {}) {
	return clamp(finite(severity, 0.3), 0, 1) * 10 + (minor ? 1.5 : 0);
}
// the care it takes, in seconds of a full team's work
export const careNeed = (severity) => 30 + clamp(finite(severity, 0.3), 0, 1) * 210;
// how fast care goes with who is on: a doctor and two nurses a bed is a full team
export function careRate({ doctors = 0, nurses = 0 } = {}, beds = 1) {
	const d = Math.max(0, finite(doctors)), n = Math.max(0, finite(nurses)), per = Math.max(1, beds);
	if (d + n <= 0) return 0;
	return clamp(Math.min(d / per, 1) * 0.6 + Math.min(n / (2 * per), 1) * 0.4 + 0.15, 0.15, 1.15);
}
export function billFor(rec) {
	if (rec.minor) return 0;
	return Math.min(CARE.cap, Math.round(CARE.base + rec.need * CARE.perSecond));
}

// one hospital's ward. opts: { beds, charge(patientId, credits, rec) -> true when paid,
// onEvent({ type, patient }) }
export function createWard({ id = 'hospital', beds = 6, charge = () => true, onEvent = () => {} } = {}) {
	const patients = new Map();
	let seq = 0, clock = 0;
	const ledger = { billed: 0, paid: 0, owed: 0, waived: 0, treated: 0 };
	const emit = (type, patient, extra = {}) => { try { onEvent({ type, patient: { ...patient }, ward: id, ...extra }); } catch { /* observers never stop the ward */ } };
	// in: { who (a person's id), name, minor, severity, cause, by ('ambulance' | 'walk-in') }
	function admit(p = {}) {
		const who = String(p.who || `p${++seq}`);
		for (const q of patients.values()) if (q.who === who && q.state !== 'discharged') return q;
		const severity = clamp(finite(p.severity, 0.3), 0.02, 1);
		const rec = {
			id: `${id}:${++seq}`, who, name: String(p.name || 'A patient').slice(0, 40), minor: !!p.minor, severity, cause: String(p.cause || 'injury'),
			by: p.by === 'ambulance' ? 'ambulance' : 'walk-in', state: 'waiting', priority: priorityOf({ severity, minor: p.minor }), need: careNeed(severity),
			care: 0, recover: 0, arrived: clock, waited: 0, bed: -1, bill: 0, paid: false, owed: 0,
		};
		patients.set(rec.id, rec);
		emit('admitted', rec);
		place();
		return rec;
	}
	const inBed = () => [...patients.values()].filter((q) => q.state === 'treating' || q.state === 'recovering');
	// the free beds to whoever needs them most, then who came first
	function place() {
		const used = new Set(inBed().map((q) => q.bed));
		const queue = [...patients.values()].filter((q) => q.state === 'waiting').sort((a, b) => b.priority - a.priority || a.arrived - b.arrived);
		for (const q of queue) {
			let b = 0;
			while (used.has(b) && b < beds) b++;
			if (b >= beds) break;
			used.add(b); q.bed = b; q.state = 'treating';
			emit('bed', q);
		}
	}
	// time passing: staff ({ doctors, nurses }) on now
	function tick(dt, staff = { doctors: 1, nurses: 2 }) {
		dt = clamp(finite(dt), 0, 5);
		clock += dt;
		const rate = careRate(staff, Math.max(1, inBed().length));
		for (const q of [...patients.values()]) {
			if (q.state === 'waiting') {
				q.waited += dt;
				// (no bed for too long: carried on to another hospital, never left untreated)
				if (q.waited > CARE.transfer) { q.state = 'discharged'; q.transferred = true; emit('transferred', q); patients.delete(q.id); }
			} else if (q.state === 'treating') {
				q.care = Math.min(q.need, q.care + dt * rate);
				if (q.care >= q.need) { q.state = 'recovering'; emit('treated', q); ledger.treated++; }
			} else if (q.state === 'recovering') {
				q.recover += dt;
				if (q.recover >= CARE.recover) discharge(q);
			}
		}
		place();
	}
	function discharge(q) {
		q.state = 'discharged'; q.bed = -1;
		q.bill = billFor(q);
		if (q.minor || q.bill === 0) { ledger.waived += q.minor ? billFor({ ...q, minor: false }) : 0; q.paid = true; }
		else {
			let ok = false;
			try { ok = !!charge(q.who, q.bill, { ...q }); } catch { ok = false; }
			q.paid = ok; q.owed = ok ? 0 : q.bill;
			ledger.billed += q.bill; if (ok) ledger.paid += q.bill; else ledger.owed += q.bill;
		}
		emit('discharged', q);
		emit('billed', q, { amount: q.bill, paid: q.paid });
		patients.delete(q.id);
	}
	return {
		id, admit, tick, ledger,
		get beds() { return beds; },
		set beds(n) { beds = Math.max(1, Math.floor(finite(n, beds))); place(); },
		list: () => [...patients.values()].map((q) => ({ ...q })),
		count: (state) => [...patients.values()].filter((q) => !state || q.state === state).length,
		inBed: () => inBed().map((q) => ({ ...q })),
		find: (who) => { for (const q of patients.values()) if (q.who === who) return { ...q }; return null; },
	};
}

// you, at the desk: what mending or bringing you round costs, from how hurt you are (0..1 of
// your health gone); a child's is free, and nobody below a third of their health is refused
export function playerCare({ missing = 0, down = false, credits = 0, minor = false } = {}) {
	const m = clamp(finite(missing), 0, 1);
	const price = minor ? 0 : Math.round((down ? 120 : 0) + m * 160);
	const urgent = down || m > 0.66;
	if (!down && m <= 0.01) return { ok: false, price: 0, why: 'You are not hurt.' };
	if (credits >= price || urgent) return { ok: true, price: Math.min(price, Math.max(0, finite(credits))), owed: Math.max(0, price - Math.max(0, finite(credits))) };
	return { ok: false, price, why: `Treatment is ${price} credits.` };
}
