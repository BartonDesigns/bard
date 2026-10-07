import * as THREE from 'three';
import { createOrbitFrame, ORBIT, MOON, SUN, GARGANTUA, companionOf, musicThrust } from './frame.js';
import { createOrbitView } from './view.js';
import { createNav, distanceLabel, speedReadout } from './nav.js';
import { flightMultiplier, speedLabel } from '../flight-speed.js';
import { planetProfile } from '../planet/profile.js';

// Worlds the warp list reaches beyond this one; each lands through the usual world build.
const WORLDS = ['TERRAN', 'OCEAN', 'ARID', 'ICE', 'MAGMA', 'TOXIC', 'MYSTICAL', 'GAS', 'SHEPHERD', 'SINGULARITY', 'MEDIEVAL', 'TROPICAL'];
const SPACE = 100000;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function createOrbitalFlight({ renderer, camera, dom, world, earth, seed, profile, shared, location, sun, departed, hint, voyage }) {
	const type = earth ? 'EARTH' : profile?.type || 'TROPICAL';
	const radius = earth ? ORBIT.radius : type === 'MOON' ? MOON.radius : 2400000 + (seed % 3400) * 1000;
	const companion = companionOf(type, earth);
	const frame = createOrbitFrame({ earth, radius, companion });
	const view = createOrbitView({ renderer, earth, seed, radius, profile, shared, companion });
	const P = world.player.state, up = new THREE.Vector3(), marker = new THREE.Vector3();
	const isTouch = dom.mount.classList.contains('l99-touch');
	const hud = document.createElement('div');
	hud.dataset.orbitHud = '';
	hud.style.cssText = 'position:absolute;top:max(18px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);pointer-events:none;text-align:center;color:#eafaf6;font:12px system-ui;letter-spacing:.08em;text-shadow:0 1px 5px #000;display:none;white-space:pre-line;';
	const bearing = document.createElement('div');
	bearing.style.cssText = 'position:absolute;pointer-events:none;display:none;color:#a5f6e2;font:12px system-ui;text-align:center;text-shadow:0 1px 5px #000;transform:translate(-50%,-50%);';
	bearing.textContent = '◇\nDeparture';
	dom.mount.append(hud, bearing);
	const homeName = earth ? 'Earth' : type === 'MOON' ? 'The Moon' : title(profile?.name || 'this world');
	const nav = createNav({ mount: dom.mount, isTouch, onWarp: (what, d) => what === 'list' ? destinations() : warpTo(d), onTarget: (id) => { const d = destinations().find((q) => q.id === id); if (d) hint(`${d.name} targeted. ${isTouch ? 'Tap ⤳ Warp' : 'Press J'} to warp there.`, 3000); } });
	let wasSpace = false, text = '', disposed = false, gear = 1, warp = null, bounce = null, landing = false, heat = 0, warned = '';
	const spot = new THREE.Vector3(), heading = new THREE.Vector3(0, 0, -1);
	const deep = () => !!frame.anchor && frame.altitude(P.pos) >= SPACE;
	const course = () => P.vel.lengthSq() > 1 ? heading.copy(P.vel).normalize() : camera.getWorldDirection(heading);
	const controls = {
		speed: (run, boost, agl) => frame.speed(P.pos, run, frame.anchor ? gear : boost, agl, course()) * musicThrust(shared.uBass.value, shared.uPulse.value),
		up: (out) => frame.up(P.pos, out),
		surface: (pos, vel) => frame.surface(pos, vel),
		high: () => !!frame.anchor && frame.altitude(P.pos) > ORBIT.start,
		deep,
	};
	P.orbit = controls;
	// Local bodies are world positions in this frame; other worlds load through voyage().
	function bodies() {
		const list = [{ id: 'home', name: homeName, pos: frame.center.clone(), size: radius }];
		list.push({ id: 'companion', name: companion.name, pos: frame.moonCenter(new THREE.Vector3()), size: companion.radius });
		list.push({ id: 'sun', name: 'The Sun', pos: frame.sunCenter(), size: SUN.radius });
		list.push({ id: 'gargantua', name: 'Gargantua', pos: frame.gargCenter(), size: GARGANTUA.rs });
		for (const b of list) b.distance = Math.max(0, P.pos.distanceTo(b.pos) - b.size);
		return list;
	}
	function destinations() {
		const near = bodies().map((b) => ({ ...b, note: distanceLabel(b.distance) }));
		const far = [];
		if (!earth && type !== 'MOON') far.push({ id: 'w-EARTH', name: 'Earth', note: 'land', remote: { earth: true } });
		if (!earth && type !== 'MOON') far.push({ id: 'w-MOON', name: 'The Moon', note: 'land', remote: { type: 'MOON', seed: 1969 } });
		WORLDS.forEach((t, i) => { if (t !== type) far.push({ id: `w-${t}`, name: title(planetProfile(t).name), note: t.toLowerCase(), remote: { type: t, seed: 4242 + i * 1013 } }); });
		return [...near, ...far];
	}
	// Where a warp drops out: a safe distance on the near side of the body.
	function dropPoint(d) {
		const b = bodies().find((q) => q.id === d.id);
		const stand = { home: radius + 400000, companion: companion.radius * 4, sun: SUN.safe * 2.5, gargantua: GARGANTUA.rs * 60 }[d.id];
		const dir = P.pos.clone().sub(b.pos);
		if (dir.lengthSq() < 1) dir.set(0, 1, 0);
		return { center: b.pos, at: b.pos.clone().addScaledVector(dir.normalize(), stand) };
	}
	function warpTo(d) {
		if (!deep()) { hint('Warp needs open space: climb above 100 km first.', 3500); return; }
		if (warp || bounce || landing) return;
		const from = P.pos.clone();
		const w = { d, t: 0, from, yaw: P.yaw, pitch: P.pitch, roll: P.roll || 0 };
		if (d.remote) {
			camera.getWorldDirection(heading); w.dir = heading.clone(); w.face = w.dir.clone();
		} else {
			const p = dropPoint(d); w.to = p.at; w.dir = p.at.clone().sub(from).normalize(); w.face = p.center.clone().sub(p.at).normalize();
			if (from.distanceTo(p.at) < 1000) { hint(`Already at ${d.name}.`, 2500); return; }
		}
		warp = w; P.climbAssist = false; P.flyUp = P.flyDown = false;
		hint(`Warp to ${d.name}…`, 2500);
	}
	function stepWarp(dt) {
		const w = warp; w.t += dt;
		// spool (0-0.8 s) turns to face the course, the tunnel runs 0.8-2.8 s, the drop-out fades by 3.4 s
		const turn = smooth(0, .8, w.t);
		const ty = Math.atan2(-w.dir.x, -w.dir.z), tp = Math.asin(Math.max(-1, Math.min(1, w.dir.y)));
		let dy = ty - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
		P.yaw = w.yaw + dy * turn; P.pitch = w.pitch + (tp - w.pitch) * turn; P.roll = w.roll * (1 - turn);
		const before = P.pos.clone();
		if (w.d.remote) {
			P.pos.addScaledVector(w.dir, 2e6 * dt * turn);
			if (w.t > 2.4 && !w.sent) {
				w.sent = true;
				Promise.resolve(voyage?.({ ...w.d.remote, name: w.d.name, orbit: 160000 })).catch((err) => { console.warn('[warp]', err); hint('The warp could not reach that world.', 3500); warp = null; });
			}
			if (w.t > 12 && !disposed) { warp = null; hint('Still charting that world. Try the warp again.', 3500); }
		} else {
			// exponential through the distance: fast in the middle, gentle at each end
			const e = smooth(.8, 2.8, w.t);
			if (w.t >= 2.8) P.pos.copy(w.to);
			else P.pos.copy(w.to).addScaledVector(w.from.clone().sub(w.to), Math.exp(e * Math.log(1e-7)));
			if (w.t >= 3.4) {
				warp = null;
				const b = bodies().find((q) => q.id === w.d.id);
				// look at what you came for
				P.yaw = Math.atan2(-w.face.x, -w.face.z); P.pitch = Math.asin(Math.max(-1, Math.min(1, w.face.y))); P.vel.set(0, 0, 0);
				const land = (w.d.id === 'companion' && companion.land) || w.d.id === 'home' ? ' Descend (C) to land.' : '';
				hint(`Dropped out ${distanceLabel(b.distance)} from ${w.d.name}.${land}`, 5000);
			}
		}
		P.vel.copy(P.pos).sub(before).divideScalar(Math.max(dt, 1e-3));
		if (warp) heading.copy(w.dir);
	}
	// A short, eased push back out to a safe distance from the Sun, the black hole or a giant.
	function startBounce(center, safe, message) {
		const n = P.pos.clone().sub(center); if (n.lengthSq() < 1) n.set(0, 1, 0);
		n.normalize();
		bounce = { t: 0, from: P.pos.clone(), to: center.clone().addScaledVector(n, safe * 1.6) };
		P.vel.set(0, 0, 0); if (P.boost > 9) P.boost = 9;
		hint(message, 5000);
	}
	function hazards() {
		const sunAt = frame.sunCenter(spot), ds = P.pos.distanceTo(sunAt);
		heat = smooth(SUN.heat, SUN.safe * 1.4, ds);
		if (ds < SUN.safe) { startBounce(sunAt, SUN.safe, 'Heat shields at their limit. The ship pulls back to a safe distance from the Sun.'); return; }
		if (heat > .05 && warned !== 'sun') { warned = 'sun'; hint('Approaching the Sun. Heat is rising; shields are holding.', 4000); }
		const g = frame.gargCenter(spot), dg = P.pos.distanceTo(g);
		if (dg < GARGANTUA.safe) { startBounce(g, GARGANTUA.safe, 'Gargantua\'s tides are too strong. The ship pulls back to a safe distance.'); return; }
		if (dg < GARGANTUA.safe * 4 && warned !== 'garg') { warned = 'garg'; hint('Tidal stress rising near Gargantua.', 3500); }
		if (heat <= .05 && dg > GARGANTUA.safe * 4) warned = '';
		const ma = frame.moonAltitude(P.pos);
		if (!companion.land && ma < companion.radius * .05) { startBounce(frame.moonCenter(spot), companion.radius, 'A gas giant has no surface to land on. Holding a safe distance.'); return; }
		// touching down on the companion: the usual world landing, then you are on its ground
		if (companion.land && ma < 25000 && !landing) {
			landing = true;
			hint(`Touching down on ${companion.name}…`, 4000);
			Promise.resolve(voyage?.(companion.land === 'EARTH' ? { earth: true, name: 'Earth' } : { type: 'MOON', seed: earth ? 1969 : (seed ^ 0x6d6f6f6e) >>> 0, name: companion.name })).catch((err) => { console.warn('[landing]', err); landing = false; });
		}
	}
	function before() {
		if (!frame.anchor && P.flying && P.pos.y >= ORBIT.start) {
			const at = location();
			frame.capture(P, at);
			frame.setSun(sun());
			view.anchor(at.lat, at.lon, sun());
			departed?.(frame.anchor);
			hint('Leaving the atmosphere. Keep flying; descend to return here.', 4000);
		}
		if (controls.high()) P.flying = true;
	}
	function after(dt = 1 / 60) {
		if (!P.flying || P.locked) return;
		// the booster gear eases between tiers in proportion, so ×1,000 to ×10,000 is a smooth surge
		const want = flightMultiplier(P.boost);
		gear = Math.exp(Math.log(gear) + (Math.log(want) - Math.log(gear)) * (1 - Math.exp(-Math.max(0, dt) * 2.2)));
		if (warp) stepWarp(dt);
		else if (bounce) {
			bounce.t += dt;
			P.pos.lerpVectors(bounce.from, bounce.to, smooth(0, 1.4, bounce.t)); P.vel.set(0, 0, 0);
			if (bounce.t >= 1.4) bounce = null;
		} else if (frame.anchor) {
			if (frame.update(P)) hint('Returning to your departure area. You have control.', 3500);
			// a hard limit on top of the guard: never close on a surface faster than three times the gap per second
			const v = P.vel.length(), gap = v > 1 ? frame.clearance(P.pos, course()) * 3 : Infinity;
			if (v > 1000 && v > gap) P.vel.multiplyScalar(Math.max(gap, 1000) / v);
			hazards();
			if (P.boost > 9 && !deep()) { P.boost = 9; gear = Math.min(gear, 9); hint('Booster back to ×9 near the planet.', 2500); }
		}
		if (frame.altitude(P.pos) < ORBIT.end && P.roll) P.roll *= Math.exp(-Math.max(0, dt) * 1.5);
		if (frame.anchor && frame.altitude(P.pos) < ORBIT.start * .65) {
			frame.reset(); wasSpace = false;
			hint('Back above your departure area.', 3000);
		}
		camera.position.copy(P.pos);
		camera.rotation.set(P.pitch, P.yaw, P.roll || 0, 'YXZ');
	}
	function updateHud() {
		const h = frame.altitude(P.pos), on = !!frame.anchor;
		hud.style.display = on ? 'block' : 'none';
		bearing.style.display = on ? 'block' : 'none';
		nav.showButton(on && h >= SPACE);
		if (!on) { nav.update(camera, [], false); return; }
		const v = P.vel.length();
		const phase = warp ? `WARP → ${warp.d.name.toUpperCase()}` : h >= SPACE ? 'SPACE' : 'ATMOSPHERE';
		const where = h < 1e7 ? `${(h / 1000).toFixed(h < 1e6 ? 1 : 0)} km` : distanceLabel(h);
		const hazard = heat > .02 ? `\n☀ HEAT ${Math.round(heat * 100)}% · SHIELDS ${Math.round((1 - heat) * 100)}%` : '';
		const next = `${phase} · ${where}\n${speedLabel(flightMultiplier(P.boost))} · ${speedReadout(v)}${hazard}`;
		if (text !== next) { text = next; hud.textContent = next; hud.style.color = heat > .5 ? '#ffc08a' : '#eafaf6'; }
		if (h >= SPACE && !wasSpace) { wasSpace = true; hint(`Space. B: faster gears up to ×100k. ${isTouch ? '⤳ Warp' : 'J'}: warp to a moon, planet, the Sun or Gargantua. C descends.`, 6000); }
		camera.updateMatrixWorld();
		// Point toward the planet above orbit; near the ground, toward the exact saved exit.
		marker.set(frame.anchor.x, 0, frame.anchor.z);
		if (h > ORBIT.entry) marker.copy(frame.center);
		up.copy(marker).sub(P.pos).applyQuaternion(camera.quaternion.clone().invert());
		marker.project(camera);
		const behind = up.z > 0;
		const x = behind ? (up.x >= 0 ? .94 : .06) : THREE.MathUtils.clamp(marker.x * .5 + .5, .06, .94);
		const y = behind ? .82 : THREE.MathUtils.clamp(.5 - marker.y * .5, .12, .82);
		bearing.style.left = `${x * 100}%`; bearing.style.top = `${y * 100}%`;
		bearing.textContent = `${behind ? (up.x >= 0 ? '→' : '←') : '◇'}\nDeparture`;
		// labelled markers on the far bodies (the planet below keeps the departure marker)
		nav.update(camera, h >= SPACE ? bodies().filter((b) => b.id !== 'home' || h > 2e7) : [], h >= SPACE && !warp);
	}
	function onKey(e) {
		if (!frame.anchor || window._KEYS_PLAY_ON || e.target?.closest?.('input,textarea,[contenteditable]')) return;
		if (nav.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
		if ((e.key === 'j' || e.key === 'J') && !e.repeat) {
			e.preventDefault();
			if (!deep()) hint('Warp needs open space: climb above 100 km first.', 3000); else nav.toggle();
		}
	}
	addEventListener('keydown', onKey, true);
	function fx() {
		const w = warp ? (warp.t < .8 ? warp.t / .8 : warp.d.remote ? 1 : 1 - smooth(2.6, 3.4, warp.t)) : 0;
		const v = P.vel.length();
		if (!warp && v > 1) heading.copy(P.vel).divideScalar(v);
		const streak = Math.max(w, Math.min(1, Math.max(0, (Math.log10(Math.max(v, 1)) - 5.4) / 2.2)));
		return { warp: w, streak, heading, heat };
	}
	return {
		before, after, updateHud,
		active: () => !!frame.anchor,
		blend: () => frame.blend(P.pos),
		space: () => !!frame.anchor && frame.blend(P.pos) >= 1,
		render: (time) => { if (!disposed) view.render(frame, P, camera, time, fx()); },
		face: (id) => { const b = bodies().find((q) => q.id === id); if (!b) return false; const d = b.pos.sub(P.pos).normalize(); P.yaw = Math.atan2(-d.x, -d.z); P.pitch = Math.asin(d.y); P.roll = 0; return true; },
		warp: (id) => { const d = destinations().find((q) => q.id === id); if (d) warpTo(d); return !!d; },
		destinations: () => destinations().map(({ id, name, note }) => ({ id, name, note })),
		info: () => ({ ...frame.info(P.pos), speed: P.vel.length(), gear, boost: P.boost, radius, type, companion: companion.name, warping: !!warp, warpTime: warp?.t ?? 0, bouncing: !!bounce, landing, heat, target: nav.target, gargantuaVisible: !!view.gargantua?.visible, music: { bass: shared.uBass.value, mid: shared.uMid.value, high: shared.uHigh.value, thrust: musicThrust(shared.uBass.value, shared.uPulse.value) } }),
		cancel: () => { frame.reset(); warp = bounce = null; landing = false; P.roll = 0; P.climbAssist = false; hud.style.display = bearing.style.display = 'none'; nav.showButton(false); nav.update(camera, [], false); },
		dispose() { disposed = true; removeEventListener('keydown', onKey, true); delete P.orbit; hud.remove(); bearing.remove(); nav.dispose(); view.dispose(); },
	};
}
