// The real calendar, for the days the world keeps: the Fourth of July and New Year's
// fireworks, Halloween porches, lights on the houses through the holidays, the beacon on
// Mt Diablo lit for Pearl Harbor Day, the nights of the great meteor showers.
// (?date=2026-07-04 in the address tries another day.) The month can be chosen in the Sky &
// World panel: the world's seasons then keep that month (the day and the weekday stay today's).

const MONTH_KEY = 'l99-month';
let picked = 0;                      // 0: live (today's); 1..12: that month
try { picked = Math.max(0, Math.min(12, parseInt(localStorage.getItem(MONTH_KEY) || '0', 10) || 0)); } catch { picked = 0; }
const watchers = new Set();

export function today() {
	const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('date');
	let d = q ? new Date(q + 'T12:00:00') : new Date();
	if (isNaN(d)) d = new Date();
	if (picked && !q) d = new Date(d.getFullYear(), picked - 1, Math.min(d.getDate(), 28), d.getHours(), d.getMinutes());
	return d;
}
// the chosen month (0 for live), choosing another, and hearing when it changes
export const monthPicked = () => picked;
export function pickMonth(m) {
	picked = Math.max(0, Math.min(12, m | 0));
	try { localStorage.setItem(MONTH_KEY, String(picked)); } catch { /* private mode: for this visit only */ }
	for (const fn of watchers) fn(today());
}
export function onMonth(fn) { watchers.add(fn); return () => watchers.delete(fn); }

export function occasions(d = today()) {
	const m = d.getMonth() + 1, day = d.getDate();
	return {
		july4: m === 7 && day === 4,
		newYear: (m === 12 && day === 31) || (m === 1 && day === 1),
		halloween: m === 10 && day >= 24,
		holidays: (m === 12 && day >= 1) || (m === 1 && day <= 6),
		beacon: m === 12 && day === 7,                            // lit at sunset since 1964
		meteors: (m === 8 && day >= 10 && day <= 14) ? 'Perseids' : (m === 12 && day >= 12 && day <= 15) ? 'Geminids' : null,
	};
}
