// The real calendar, for the days the world keeps: the Fourth of July and New Year's
// fireworks, Halloween porches, lights on the houses through the holidays, the beacon on
// Mt Diablo lit for Pearl Harbor Day, the nights of the great meteor showers.
// (?date=2026-07-04 in the address tries another day.)

export function today() {
	const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('date');
	const d = q ? new Date(q + 'T12:00:00') : new Date();
	return isNaN(d) ? new Date() : d;
}

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
