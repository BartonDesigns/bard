// The weather of a place this month, from the atlas's climate (its coldest and warmest
// months' mean, its rain, its snow): the temperature now, whether snow is lying, the
// season by the place's own reckoning (winter and summer away from the tropics; the wet and
// the dry within them; the monsoon where it comes), the polar night and the midnight sun.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// at: atlas regionAt(); month: 0..11.99 (fractional); elev: metres; hours: 0..24
export function climateNow(at, month, elev = 0, hours = 13) {
	const lat = at?.lat || 0, mix = at?.mix || {}, T = mix.temp || [10, 20], south = lat < 0;
	const mid = (T[0] + T[1]) / 2, amp = (T[1] - T[0]) / 2;
	const c = Math.cos(2 * Math.PI * (month - 0.5) / 12);
	let temp = south ? mid + amp * c : mid - amp * c;
	if (elev > 900) temp -= (elev - 900) * 0.0055;
	// the day's swing: cool before dawn, warm mid-afternoon (wider where it is dry)
	const swing = (3 + (mix.rain < 400 ? 5 : mix.rain < 900 ? 2.5 : 1)) * (1 - 0.7 * clamp((Math.abs(lat) - 55) / 20, 0, 1));
	const now = temp + swing * Math.cos(2 * Math.PI * (hours - 15) / 24);
	const snow = clamp((0.5 - temp) / 5, 0, 1) * (mix.rain > 60 || temp < -10 ? 1 : 0.4);
	const id = at?.id || '', alat = Math.abs(lat), mm = Math.floor(((month % 12) + 12) % 12);
	const north = (m) => (south ? (m + 6) % 12 : m);
	const nm = north(mm);
	let season;
	const monsoon = /^as\.(india|lanka|sea|afpak|himalaya\.kathmandu)|^af\.(west|sahel)/.test(id);
	if (alat < 23.5 || (monsoon && alat < 31)) {
		const wetN = monsoon ? nm >= 5 && nm <= 8 : nm >= 4 && nm <= 9;
		season = alat < 5 && !monsoon ? (mix.rain > 1800 ? 'wet' : 'warm') : wetN ? (monsoon ? 'monsoon' : 'wet') : 'dry';
	} else season = nm <= 1 || nm === 11 ? 'winter' : nm <= 4 ? 'spring' : nm <= 7 ? 'summer' : 'autumn';
	const polar = alat > 66.5 ? (nm === 11 || nm <= 0 ? 'night' : nm >= 5 && nm <= 6 ? 'sun' : null) : null;
	return { temp: Math.round(temp), now: Math.round(now), snow, season, polar, rain: mix.rain || 0, hot: now > 30, cold: now < 0, south, f: /^na\.|^atl\.carib\.(pr)/.test(id) && !/^na\.(can|mx|cam)/.test(id) };
}
// how cold it feels for dressing (0 warm .. 1 bitter)
export const coldOf = (C) => clamp((18 - (C?.now ?? 15)) / 30, 0, 1);
