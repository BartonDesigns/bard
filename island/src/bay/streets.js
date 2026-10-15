// The streets by era and by season, gathered: potholes you feel and report and the crews
// that fill them (potholes.js, roadcrew.js), the street trees' stakes, grates and fallen
// leaves (streettrees.js), the holiday lights (holidaylights.js), the evening's porch, path,
// solar, tree and facade lights (nightlights.js), the morning sprinklers
// (sprinklers.js), and the calendar's hand on the lawns (seasons.js). The trees themselves
// are planted by the city (city.js, streettrees.js), the lamps by the street life
// (streetlife.js), the sidewalks, kerbs and holes painted by the ground (realcity.js, the
// paint layer; terrain.js and weathering.js draw them). The pothole favour is asked by people
// (people/errands.js) and by the businesses on the economy's board (economy/requests.js). One
// update a frame from main.js.

import { eraMap } from './streetera.js';
import { createPotholes } from './potholes.js';
import { createRoadCrew } from './roadcrew.js';
import { createStreetDecor } from './streettrees.js';
import { createHolidayLights } from './holidaylights.js';
import { createNightLights } from './nightlights.js';
import { createSprinklers } from './sprinklers.js';
import { apply as applySeason } from './seasons.js';
import { today, onMonth } from '../calendar.js';
import { setPotholeSource } from '../economy/requests.js';

export function createStreets({ scene, camera, world, drive, isPhone = false, hint = () => {} }) {
	const W = world(), real = W.real, city = W.city;
	const E = eraMap(real);
	const ground = (x, z) => world()?.island?.heightAt(x, z) ?? 0;
	const potholes = createPotholes({ real, eraOf: (r) => E.ofRoad(r), carAt: () => drive.carAt(), physics: () => (drive.active() ? drive.physics() : null), camera, repaint: () => real.R?.repaint?.() });
	const crew = createRoadCrew({ scene, potholes, ground, camera, isPhone, hint });
	const decor = createStreetDecor(scene, city, { isPhone });
	const lights = createHolidayLights(scene, city, { isPhone });
	const evening = createNightLights(scene, city, { isPhone, ground, world });
	const sprinklers = createSprinklers(scene, city, real, { isPhone, ground });
	applySeason(today());
	const unMonth = onMonth((d) => { applySeason(d); lights.rebuild(); });
	function update(dt, night, hours) {
		potholes.update(dt);
		crew.update(dt, night);
		decor.update(camera);
		lights.update(dt, camera, night);
		evening.update(dt, camera, night, hours);
		sprinklers.update(dt, camera, hours);
	}
	// the pothole favour (people/errands.js): the nearest hole not yet reported, and a report
	const nearest = (x, z, R) => potholes.nearest(x, z, R);
	function report(h) { if (!h) return false; potholes.report(h); return crew.dispatch(h); }
	// ...and the businesses ask it too, on the economy's board (economy/requests.js)
	setPotholeSource({ near: nearest, report });
	// for the console: the era where you stand, and everything's counts
	function info() {
		const c = camera.position, e = E.at(c.x, c.z);
		return { era: e.key, neglect: +e.neglect.toFixed(2), potholes: potholes.info(), crews: crew.info(), decor: decor.info(), lights: lights.info(), evening: evening.info(), sprinklers: sprinklers.info() };
	}
	function dispose() { unMonth(); setPotholeSource(null); }
	return { update, nearest, report, info, dispose, potholes, crew, lights, evening, sprinklers, decor, eraAt: (x, z) => E.at(x, z) };
}
