// Where you are: a quiet notation fades in at the top of the screen as you cross into
// a new place - every city, town and neighbourhood of the nine Bay Area counties, the
// waters (the Golden Gate, the bays and straits, the open Pacific) and the landmarks.

import { PLACES, ZONES } from './places.js';
import { toWorld } from './geo.js';

export function createLabels(mount, bay, bridge) {
	const box = document.createElement('div');
	box.style.cssText = 'position:absolute;left:50%;top:calc(18px + env(safe-area-inset-top));transform:translateX(-50%);text-align:center;pointer-events:none;opacity:0;transition:opacity 1.4s ease;color:#f4f1ea;text-shadow:0 1px 12px rgba(0,0,0,.55);max-width:86vw;';
	const title = document.createElement('div');
	title.style.cssText = 'font:300 26px/1.15 Georgia,"Times New Roman",serif;letter-spacing:.04em;';
	const sub = document.createElement('div');
	sub.style.cssText = 'margin-top:5px;font:600 10.5px/1.3 system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase;opacity:.82;';
	box.append(title, sub);
	mount.append(box);

	const places = PLACES.map((p) => ({ name: p[0], ...toWorld(p[1], p[2]), county: p[3], pop: p[4], hood: p[5], r: p[5] ? 700 : Math.max(650, 380 * Math.pow(p[4], 0.45)) }));
	const zones = ZONES.map((z) => ({ name: z[0], ...toWorld(z[1], z[2]), sub: z[3], r: z[4] }));
	const WATER = new Set(['Pacific Ocean', 'Golden Gate', 'San Francisco Bay', 'Richardson Bay', 'Raccoon Strait', 'San Pablo Bay', 'Carquinez Strait', 'Suisun Bay', 'South Bay']);
	const gate = zones.find((z) => z.name === 'Golden Gate');

	function where(x, z, y, onIsland) {
		if (onIsland) return null;
		const g = bay.heightAt(x, z), water = g < 0;
		if (bridge && bridge.deckFloor(x, z, y) > -Infinity) return { name: 'Golden Gate Bridge', sub: 'San Francisco · Marin County' };
		// landmarks and waters that contain you, the smallest first
		let best = null;
		for (const zn of zones) {
			if (!zn.r || WATER.has(zn.name) !== water) continue;
			const d = Math.hypot(x - zn.x, z - zn.z);
			if (d < zn.r && (!best || zn.r < best.r)) best = zn;
		}
		if (best) return { name: best.name, sub: best.sub + (water ? '' : ` · ${Math.round(Math.max(0, g))} m`) };
		if (water) {
			// east of the Golden Gate is the bay; outside it, the open ocean
			const gx = x - gate.x;
			return gx > 1500 ? { name: 'San Francisco Bay', sub: 'California' } : { name: 'Pacific Ocean', sub: x < gate.x - 12000 ? 'Gulf of the Farallones' : 'Off the Golden Gate' };
		}
		// on land: the place whose reach you are deepest inside
		let pick = null, pd = 1e9;
		for (const p of places) {
			const d = Math.hypot(x - p.x, z - p.z) / p.r * (p.hood ? 0.8 : 1);
			if (d < pd) { pd = d; pick = p; }
		}
		if (!pick) return null;
		if (pd > 1.6) return { name: pick.county, sub: 'California' };
		const sub = pick.hood ? `${pick.county === 'San Francisco' ? 'San Francisco' : 'San Jose'} · California` : pick.county === 'San Francisco' ? 'City and County of San Francisco' : `${pick.county} · California`;
		return { name: pick.name, sub };
	}

	let shown = '', pending = '', since = 0, hideAt = 0, acc = 0;
	function update(dt, t, cam, onIsland) {
		acc += dt;
		if (acc < 0.4) return;
		acc = 0;
		if (!bay.loaded()) return;
		const w = where(cam.x, cam.z, cam.y, onIsland);
		const key = w ? w.name : '';
		if (key !== pending) { pending = key; since = t; }
		// only once you have been somewhere a moment, so crossing a corner does not flicker
		if (pending !== shown && t - since > 1.2) {
			shown = pending;
			if (w) {
				title.textContent = w.name; sub.textContent = w.sub;
				box.style.opacity = '1';
				hideAt = t + 5.5;
			} else box.style.opacity = '0';
		}
		if (hideAt && t > hideAt) { box.style.opacity = '0'; hideAt = 0; }
	}
	return { update, where };
}
