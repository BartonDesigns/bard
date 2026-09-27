// How busy a place is at an hour of the day, by what the place is. Offices fill in the
// morning, empty at lunch onto the pavements and go home at five; cafés are busiest over
// breakfast; shops through the afternoon; restaurants and bars from dusk to late; the
// neighbourhoods have dog walkers and joggers early and late; industry keeps working hours
// and little foot traffic; the quiet places (trails, remote beaches) stay quiet.
// crowd() gives how full (0..1) and what people are mostly doing: waiting (queues,
// people outside a café), chatting in pairs, jogging, or just walking.

import { STYLE } from '../bay/styles.js';

// a bump in the day: peak hour, width in hours
const bump = (h, at, w) => Math.exp(-(((h - at) / w) ** 2));
const clamp = (v) => Math.max(0, Math.min(1, v));

export const ZONE = { downtown: 'downtown', office: 'office', retail: 'retail', dining: 'dining', neighbourhood: 'neighbourhood', industrial: 'industrial', trail: 'trail', beach: 'beach', quiet: 'quiet' };

// what kind of place a city cell is (from the town map's style and downtown weight)
export function zoneOf(U) {
	if (!U) return ZONE.quiet;
	if (U.s === STYLE.industry) return ZONE.industrial;
	if (U.s === STYLE.sf || U.d > 0.35) return ZONE.downtown;
	if (U.s === STYLE.office) return ZONE.office;
	if (U.s === STYLE.retail) return ZONE.retail;
	if (U.s === STYLE.older && U.d > 0.1) return ZONE.dining;           // an old main street
	return ZONE.neighbourhood;
}

// weekends: offices near empty, parks, trails and beaches half as busy again, the dining
// streets a little livelier (the parks & rec survey)
const WEEKEND = { office: 0.18, industrial: 0.3, trail: 1.7, beach: 1.6, quiet: 1.4, dining: 1.2, retail: 1.25, neighbourhood: 1.2, downtown: 0.85 };
export const isWeekend = (d = new Date()) => d.getDay() === 0 || d.getDay() === 6;
export function crowd(zone, h, weekend = isWeekend()) {
	const c = crowdDay(zone, h);
	if (weekend) c.k = clamp(c.k * (WEEKEND[zone] ?? 1));
	return c;
}
function crowdDay(zone, h) {
	switch (zone) {
		case ZONE.office: return { k: clamp(0.1 + bump(h, 8.6, 1.1) * 0.8 + bump(h, 12.4, 0.9) * 0.9 + bump(h, 17.4, 0.9) * 0.7 - (h < 6 || h > 20 ? 0.1 : 0)), wait: 0.25, chat: 0.2, jog: 0.03, what: h < 11 ? 'coffee' : h < 14 ? 'lunch' : 'commute' };
		case ZONE.retail: return { k: clamp(bump(h, 14.5, 3.6) * 0.9 + bump(h, 19, 1.5) * 0.35), wait: 0.2, chat: 0.25, jog: 0.02, what: 'shopping' };
		case ZONE.dining: return { k: clamp(bump(h, 8, 1.2) * 0.55 + bump(h, 12.5, 1) * 0.6 + bump(h, 19.6, 2) * 1.0), wait: h > 17 ? 0.35 : 0.2, chat: h > 17 ? 0.4 : 0.25, jog: 0.03, what: h < 11 ? 'coffee' : h > 17 ? 'dinner' : 'lunch' };
		case ZONE.downtown: return { k: clamp(0.25 + bump(h, 8.7, 1.2) * 0.6 + bump(h, 12.5, 1.2) * 0.7 + bump(h, 17.6, 1.1) * 0.6 + bump(h, 20, 2) * 0.55 - (h < 5.5 ? 0.2 : 0)), wait: h > 18 ? 0.3 : 0.2, chat: h > 18 ? 0.35 : 0.22, jog: 0.05, what: h < 10.5 ? 'coffee' : h < 14 ? 'lunch' : h < 18.5 ? 'commute' : 'dinner' };
		case ZONE.industrial: return { k: clamp(bump(h, 11, 3.5) * 0.35), wait: 0.3, chat: 0.25, jog: 0, what: 'work' };
		case ZONE.trail: return { k: clamp(bump(h, 9, 2) * 0.8 + bump(h, 16.5, 2) * 0.6), wait: 0.15, chat: 0.1, jog: 0.15, what: 'hike' };
		case ZONE.beach: return { k: clamp(bump(h, 14, 3) * 0.7 + bump(h, 7.5, 1) * 0.3), wait: 0.35, chat: 0.25, jog: 0.12, what: 'beach' };
		case ZONE.quiet: return { k: clamp(bump(h, 11, 3) * 0.15), wait: 0.3, chat: 0.1, jog: 0.05, what: 'quiet' };
		default: return { k: clamp(0.12 + bump(h, 7.6, 1.2) * 0.5 + bump(h, 18.3, 1.6) * 0.6), wait: 0.1, chat: 0.2, jog: 0.18, what: 'neighbourhood' };
	}
}
