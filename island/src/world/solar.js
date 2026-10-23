// The sky and regional seasons share one geometric solar cycle. The clock keeps the
// island's Pacific-time convention as the hour of the sun: away from the Bay it is the local
// hour, an hour on for each 15° east (clockZone), so the sun stands at a place's hour where it
// stands on the Bay at the same hour, and a city seen in the night from orbit is in the night
// when you land there.

import { clamp } from '../noise.js';

const RAD = Math.PI / 180;
export const BAY_LATITUDE = 37.8;
export const BAY_LONGITUDE = -122.4;
export const solarLatitude = (lat) => Number.isFinite(lat) ? clamp(lat, -90, 90) : BAY_LATITUDE;
export const wrapHours = (h) => ((h % 24) + 24) % 24;
// how many hours the clock at a longitude runs ahead of the Bay's (wrapped to within half a day)
export const clockZone = (lon) => Number.isFinite(lon) ? wrapHours((lon - BAY_LONGITUDE) / 15 + 12) - 12 : 0;
export const fractionalMonth = (date) => date.getMonth() + (date.getDate() - 1) / 30;
export const solarDeclination = (month) => 23.44 * RAD * Math.cos(2 * Math.PI * (month - 5.67) / 12);

// Geometric daylight by default; the visible sunrise uses the sun's radius/refraction.
export function solarDaylight(latitude, declination, horizon = 0) {
	const lat = clamp(solarLatitude(latitude), -89.9999, 89.9999) * RAD;
	const crossing = (Math.sin(horizon * RAD) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
	return { daylight: 24 * Math.acos(clamp(crossing, -1, 1)) / Math.PI, polar: crossing >= 1 ? 'night' : crossing <= -1 ? 'sun' : null };
}

export function solarTimes(latitude, dec, noon) {
	const lat = solarLatitude(latitude), { daylight, polar } = solarDaylight(lat, dec);
	const visible = solarDaylight(lat, dec, -0.833).daylight;
	return { lat, daylight, polar, rise: noon - visible / 2, set: noon + visible / 2 };
}

export function solarDate(date) {
	const year = date.getFullYear(), month = date.getMonth(), day = date.getDate();
	const N = Math.floor((Date.UTC(year, month, day) - Date.UTC(year, 0, 0)) / 864e5);
	const dec = solarDeclination(fractionalMonth(date));
	const jan = new Date(year, 0, 1).getTimezoneOffset(), jul = new Date(year, 6, 1).getTimezoneOffset();
	const dst = date.getTimezoneOffset() < Math.max(jan, jul) ? 1 : (N > 69 && N < 307 ? 1 : 0);
	const B = 2 * Math.PI * (N - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
	const noon = 12 + dst + (122.4 - 120) / 15 - eot / 60;
	const n = (Date.UTC(year, month, day, 12) - Date.UTC(2000, 0, 1, 12)) / 864e5;
	const g = (357.528 + 0.9856003 * n) * RAD, lam = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
	const ra = ((Math.atan2(Math.cos(23.439 * RAD) * Math.sin(lam), Math.cos(lam)) / Math.PI * 12) + 24) % 24;
	return { dec, noon, ra, day: N, date: day, month, year };
}

// East is +x, north is -z, up is +y. The same rotation also places the catalogue stars.
export function solarDirection(latitude, dec, hours, noon, out = {}) {
	const lat = solarLatitude(latitude) * RAD, ha = (hours - noon) / 12 * Math.PI;
	const cd = Math.cos(dec), sd = Math.sin(dec), cl = Math.cos(lat), sl = Math.sin(lat);
	out.x = -cd * Math.sin(ha);
	out.y = sl * sd + cl * cd * Math.cos(ha);
	out.z = sl * cd * Math.cos(ha) - cl * sd;
	return out;
}

// The Moon tonight: where it is among the stars and how much of it is lit, from the date and
// the clock (the low-precision lunar theory: the main terms of the longitude and latitude, good
// to about a quarter of a degree, plenty for the sky and the moonlight). date: the calendar day
// (local), hours: the clock, noon: the day's solar noon on that clock (solarDate). Returns
// { ra (hours), dec (radians), lit (0 new .. 1 full), waxing, age (days since new, 0..29.5) }.
export function lunarPosition(date, hours, noon, out = {}) {
	const n0 = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) - Date.UTC(2000, 0, 1, 12)) / 864e5;
	// (solar noon on the Bay is about 20:10 UT: the clock's hours from it, as days from noon UT)
	const n = n0 + (hours - noon + 8.16) / 24;
	const Lp = 218.3164477 + 13.17639648 * n, D = (297.8501921 + 12.19074912 * n) * RAD, M = (357.5291092 + 0.98560028 * n) * RAD;
	const Mp = (134.9633964 + 13.06499295 * n) * RAD, F = (93.272095 + 13.22935024 * n) * RAD;
	const lam = (Lp + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F)) * RAD;
	const bet = (5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(Mp - F) + 0.173 * Math.sin(2 * D - F)) * RAD;
	const g = (357.528 + 0.9856003 * n) * RAD, sun = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
	const eps = 23.4393 * RAD, cb = Math.cos(bet);
	const x = cb * Math.cos(lam), y = cb * Math.sin(lam) * Math.cos(eps) - Math.sin(bet) * Math.sin(eps), z = cb * Math.sin(lam) * Math.sin(eps) + Math.sin(bet) * Math.cos(eps);
	out.ra = ((Math.atan2(y, x) / Math.PI * 12) + 24) % 24;
	out.dec = Math.asin(clamp(z, -1, 1));
	const el = Math.acos(clamp(cb * Math.cos(lam - sun), -1, 1));
	out.lit = (1 - Math.cos(el)) / 2;
	const dl = ((lam - sun) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
	out.waxing = dl < Math.PI;
	out.age = dl / (2 * Math.PI) * 29.530589;
	return out;
}
// How much light the Moon gives, as a share of the full moon's (the opposition surge makes a
// half moon about a tenth of the full, not a half)
export const moonlightShare = (lit) => Math.pow(clamp(lit, 0, 1), 2.4);

export function advanceSolarClock(hours, dt, speed, sun) {
	const daylight = clamp(sun.set - sun.rise, 0, 24);
	const brightHours = daylight === 0 ? 0 : Math.min(24, daylight + 0.8);
	const day = ((hours - sun.rise + 0.3) % 24 + 24) % 24 < brightHours;
	const rate = day ? brightHours / 540 : (24 - brightHours) / 150;
	return ((hours + dt * speed * rate) % 24 + 24) % 24;
}
