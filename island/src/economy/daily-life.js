// The working day as the people walking about see it (people/people.js asks through
// addLife): the staff's spots out front of the businesses that are open now (a server by the
// tables, the mechanic at the car, the fisher at the boat: economy/layer.js puts them there),
// and the doors people go in and come out of: in to work in the morning, out to lunch, the
// customers, out again at closing and home. What share of the people take which errand at an
// hour is frontage.js lifeAt; this only says where.
//
// Cheap: looked over once a second at most, within 90 m of you, into lists kept from one look
// to the next (no garbage in the frame loop); a phone fills fewer staff spots, and a lower
// quality tier fewer again (its people share, world/governor.js peopleCap).

import { stateAt, lifeAt, POST_CAP } from './frontage.js';
import { peopleCap } from '../world/governor.js';

export function createDailyLife(economy, { isPhone = false } = {}) {
	const near = [], posts = [], doors = [], st = {};
	const out = { posts, doors, life: null, cap: isPhone ? POST_CAP.phone : POST_CAP.desktop, hours: 12 };
	let lastT = -1e9, lx = 1e9, lz = 1e9;
	// a business's door as the walkers use it: just in at the facade, out at the kerb
	function doorOf(E) {
		const F = E.face;
		if (!F || !E.door) return null;
		const D = E.lifeDoor || (E.lifeDoor = { E, x: 0, z: 0, y: 0, inX: 0, inZ: 0, outX: 0, outZ: 0, heading: 0, open: false, phase: '' });
		D.x = E.door[0]; D.z = E.door[1]; D.y = E.ground ?? 0;
		D.inX = D.x - F.nx * 1.15; D.inZ = D.z - F.nz * 1.15;
		D.outX = D.x + F.nx * 1.8; D.outZ = D.z + F.nz * 1.8;
		D.heading = Math.atan2(F.nx, F.nz);
		return D;
	}
	// at(x, z, hours, now, dow): the posts and doors round a point now
	function at(x, z, hours, now, dow = 3) {
		if (now - lastT < 1 && Math.abs(x - lx) + Math.abs(z - lz) < 12 && Math.abs(hours - out.hours) < 0.05) return out;
		lastT = now; lx = x; lz = z; out.hours = hours;
		out.cap = peopleCap(isPhone ? POST_CAP.phone : POST_CAP.desktop, 1);
		out.life = lifeAt(hours, dow === 0 || dow === 6);
		economy.raw(x, z, 90, near);
		posts.length = 0; doors.length = 0;
		for (const E of near) {
			stateAt(E, hours, dow, st);
			const D = doorOf(E);
			if (D) { D.open = st.open; D.phase = st.phase; doors.push(D); }
			// (the staff are out front only while it is open; a break now and then)
			if (st.open && E.posts) for (const q of E.posts) if (!q.brk || ((Math.floor(hours * 4) + (q.x * 7 | 0)) & 3) === 0) posts.push(q);
		}
		return out;
	}
	return { at };
}
