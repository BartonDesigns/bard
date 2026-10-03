// The sky and regional seasons share one geometric solar cycle. The clock keeps the
// island's Pacific-time convention; travelling changes the latitude, never the slider.
const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const BAY_LATITUDE = 37.8;
export const solarLatitude = (lat) => Number.isFinite(lat) ? clamp(lat, -90, 90) : BAY_LATITUDE;
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

export function advanceSolarClock(hours, dt, speed, sun) {
	const daylight = clamp(sun.set - sun.rise, 0, 24);
	const brightHours = daylight === 0 ? 0 : Math.min(24, daylight + 0.8);
	const day = ((hours - sun.rise + 0.3) % 24 + 24) % 24 < brightHours;
	const rate = day ? brightHours / 540 : (24 - brightHours) / 150;
	return ((hours + dt * speed * rate) % 24 + 24) % 24;
}
