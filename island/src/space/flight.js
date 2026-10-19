import { SOUL_SITE } from '../reputation/sanctuary.js';
import * as THREE from 'three';
import { createOrbitFrame, ORBIT, MOON, SUN, GARGANTUA, companionOf, musicThrust } from './frame.js';
import { createOrbitView } from './view.js';
import { createNav, distanceLabel, speedReadout } from './nav.js';
import { flightMultiplier, speedLabel } from '../flight-speed.js';
import { COLONY } from '../planet/colony/styles.js';
import { planetProfile } from '../planet/profile.js';
import { beyondFound, beyondSeed } from '../planet/beyond.js';
import { regionNote, kmBetween, LAT_LIMIT } from './landing.js';
import { loadAtlas } from '../earth/atlas.js';

// Worlds the warp list reaches beyond this one; each lands through the usual world build.
const WORLDS = ['TERRAN', 'OCEAN', 'ARID', 'ICE', 'MAGMA', 'TOXIC', 'MYSTICAL', 'GAS', 'SHEPHERD', 'SINGULARITY', 'MEDIEVAL', 'TROPICAL'];
const SPACE = 100000;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Earth: a place this close to the anchor comes down on the ground kept there; the charting hold
// keeps the ship this high (still all orbit, no ground drawn) until the new place's ground is in
const SAME_KM = 25, HOLD = 62000;

export function createOrbitalFlight({ renderer, camera, dom, world, earth, seed, profile, shared, location, sun, departed, hint, voyage, chart, goHome }) {
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
	let passage = null, passageToken = 0, passageCooldown = 0, solarDepth = 0;
	const leaveStar = document.createElement('button'); leaveStar.dataset.stellarExit = '';
	leaveStar.textContent = 'Return to orbit'; leaveStar.style.cssText = 'display:none;position:absolute;top:110px;left:50%;transform:translateX(-50%);padding:10px 14px;background:#23180de8;color:#fff;border:1px solid #ddaf75;border-radius:18px;font:14px system-ui;pointer-events:auto;z-index:25';
	for (const ev of ['pointerdown', 'touchstart', 'click']) leaveStar.addEventListener(ev,e=>e.stopPropagation());
	leaveStar.addEventListener('click', exitStellar); dom.mount.append(leaveStar);
	// Earth: the place under the ship, and the way down: land there, or go back to where you left
	const card = document.createElement('div'); card.dataset.landingCard = '';
	card.style.cssText = 'position:absolute;left:50%;' + 'bottom:calc(' + (isTouch ? 'var(--l99-low, 88px) + 76px' : '92px') + ' + env(safe-area-inset-bottom));' + 'transform:translateX(-50%);width:min(88vw,400px);box-sizing:border-box;display:none;padding:10px 12px 12px;border-radius:12px;background:rgba(6,16,22,.84);border:1px solid rgba(165,246,226,.32);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#eafaf6;font:13px system-ui;text-align:left;pointer-events:auto;z-index:6;box-shadow:0 8px 24px rgba(0,0,0,.45);';
	const cardHead = document.createElement('div'); cardHead.style.cssText = 'font:600 11px system-ui;letter-spacing:.12em;color:#a5f6e2;';
	const cardTitle = document.createElement('div'); cardTitle.style.cssText = 'font:600 16px system-ui;margin:2px 0 3px;';
	const cardSub = document.createElement('div'); cardSub.style.cssText = 'font:12px/1.4 system-ui;color:rgba(234,250,246,.76);';
	const cardRow = document.createElement('div'); cardRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
	const BTN = 'flex:1;min-height:44px;padding:8px 10px;border-radius:9px;font:600 13px system-ui;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
	const hereBtn = document.createElement('button'); hereBtn.dataset.landHere = '';
	hereBtn.style.cssText = BTN + 'border:none;color:#fff;background:linear-gradient(135deg,#01a982,#10b981);box-shadow:0 4px 12px rgba(1,169,130,.3);';
	const homeBtn = document.createElement('button'); homeBtn.dataset.landHome = '';
	homeBtn.style.cssText = BTN + 'border:1px solid rgba(255,255,255,.22);color:#eafaf6;background:rgba(255,255,255,.04);';
	cardRow.append(hereBtn, homeBtn); card.append(cardHead, cardTitle, cardSub, cardRow);
	for (const el of [card, hereBtn, homeBtn]) for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation());
	hereBtn.addEventListener('click', (e) => { e.stopPropagation(); landHere(); });
	homeBtn.addEventListener('click', (e) => { e.stopPropagation(); returnHome(); });
	if (earth) dom.mount.append(card);
	let below = null, note = null, homeNote = null, anchorNote = null, noteT = 0, glide = null, charting = null, fresh = false, choice = null, cardText = '';
	const lastPos = new THREE.Vector3(); let lastOk = false;
	const spot = new THREE.Vector3(), heading = new THREE.Vector3(0, 0, -1);
	const deep = () => !!frame.anchor && frame.altitude(P.pos) >= SPACE;
	const course = () => P.vel.lengthSq() > 1 ? heading.copy(P.vel).normalize() : camera.getWorldDirection(heading);
	const controls = {
		speed: (run, boost, agl) => passage ? 0 : frame.speed(P.pos, run, frame.anchor ? gear : boost, agl, course()) * musicThrust(shared.uBass.value, shared.uPulse.value),
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
		far.push({ id: 'w-SOUL', name: "Gargantua’s island", note: 'The Quiet Well', remote: { type: SOUL_SITE.type, seed: SOUL_SITE.seed, name: "Gargantua’s island" } });
		// the Moon's colony: warp straight down to its spaceport
		far.push({ id: 'w-COLONY', name: `Moon: ${COLONY.MOON.name}`, note: 'spaceport', remote: { type: 'MOON', seed: 1969, colony: true } });
		if (!earth && type !== 'MOON') far.push({ id: 'w-EARTH', name: 'Earth', note: 'land', remote: { earth: true } });
		if (!earth && type !== 'MOON') far.push({ id: 'w-MOON', name: 'The Moon', note: 'land', remote: { type: 'MOON', seed: 1969 } });
		// the realm beyond the dark star's horizon, once found (planet/beyond.js)
		if (beyondFound()) far.push({ id: 'w-BEYOND', name: 'Beyond the horizon', note: 'found', remote: { type: 'SINGULARITY', seed: beyondSeed(), beyond: true } });
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
		if (warp || bounce || landing || disposed) return;
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
				Promise.resolve(voyage?.({ ...w.d.remote, name: w.d.name, orbit: 160000 })).then(ok => { if (!disposed && warp === w && ok === false) { warp = null; hint('The warp could not reach that world.', 3500); } }).catch((err) => { if (disposed || warp !== w) return; console.warn('[warp]', err); hint('The warp could not reach that world.', 3500); warp = null; });
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
	// A gas companion has no ground; stars and horizons use the entry path below.
	function startBounce(center, safe, message) {
		const n = P.pos.clone().sub(center); if (n.lengthSq() < 1) n.set(0, 1, 0);
		n.normalize();
		bounce = { t: 0, from: P.pos.clone(), to: center.clone().addScaledVector(n, safe * 1.6) };
		P.vel.set(0, 0, 0); if (P.boost > 9) P.boost = 9;
		hint(message, 5000);
	}
	function stopPassage(restore = false) {
		passageToken++;
		if (passage) { if (restore) P.pos.copy(passage.from); P.locked = false; P.flying = true; P.vel.set(0, 0, 0); }
		passage = null; landing = false; passageCooldown = 5;
	}
	function exitStellar() {
		if (disposed) return;
		stopPassage(true);
		warpTo({ id: 'home', name: homeName });
	}
	function enterHorizon(center) {
		if (landing || passage || passageCooldown > 0) return;
		const outward = P.pos.clone().sub(center).normalize();
		if (!outward.lengthSq()) outward.set(0, 1, 0);
		passage = { center: center.clone(), from: P.pos.clone(), to: center.clone().addScaledVector(outward, GARGANTUA.rs * 1.08), t: 0, sent: false, token: ++passageToken };
		P.locked = true; P.vel.set(0, 0, 0); P.flyUp = P.flyDown = P.climbAssist = false; landing = true;
		hint('Crossing Gargantua’s photon ring. Beyond the horizon lies the Held Note. Return to orbit to turn back.', 6500);
	}
	function stepPassage(dt) {
		const q = passage; q.t += dt;
		P.pos.lerpVectors(q.from, q.to, smooth(0, 3.2, q.t));
		const d = q.center.clone().sub(P.pos).normalize();
		P.yaw = Math.atan2(-d.x, -d.z); P.pitch = Math.asin(d.y); P.roll *= Math.exp(-dt * 2);
		if (q.t >= 3.2 && !q.sent) {
			q.sent = true;
			Promise.resolve(voyage?.({ type: 'SINGULARITY', seed: beyondSeed() || 2281969, name: 'Beyond Gargantua', beyond: true })).then(ok => {
				if (disposed || q.token !== passageToken) return;
				if (!ok) { stopPassage(true); hint('The horizon could not open. You have control; warp to return.', 4500); }
			}).catch(err => {
				if (disposed || q.token !== passageToken) return;
				console.warn('[horizon]', err); stopPassage(true); hint('The horizon could not open. You have control; warp to return.', 4500);
			});
		}
		if (q.t > 20 && passage === q && !disposed) { stopPassage(true); hint('The horizon is still forming. You have control.', 4500); }
	}
	function hazards() {
		const sunAt = frame.sunCenter(spot), ds = P.pos.distanceTo(sunAt);
		heat = smooth(SUN.heat, SUN.radius * 1.4, ds);
		solarDepth = Math.max(0, Math.min(1, (SUN.radius * 1.06 - ds) / (SUN.radius * .14)));
		if (solarDepth > 0 && warned !== 'inside-sun') { warned = 'inside-sun'; hint('Inside the Sun. The shields hold through the molten light. Keep flying, or return to orbit.', 6500); }
		else if (heat > .05 && solarDepth === 0 && warned !== 'sun') { warned = 'sun'; hint('Approaching the Sun. Heat is rising; shields are holding.', 4000); }
		const g = frame.gargCenter(spot), dg = P.pos.distanceTo(g);
		if (dg < GARGANTUA.rs * 1.8) { enterHorizon(g); return; }
		if (dg < GARGANTUA.safe * 4 && warned !== 'garg') { warned = 'garg'; hint('Gargantua ahead. Fly through the disk and photon ring to cross the horizon.', 5000); }
		if (heat <= .05 && dg > GARGANTUA.safe * 4) warned = '';
		const ma = frame.moonAltitude(P.pos);
		if (!companion.land && ma < companion.radius * .05) { startBounce(frame.moonCenter(spot), companion.radius, 'A gas giant has no surface to land on. Holding a safe distance.'); return; }
		if (companion.land && ma < 25000 && !landing) {
			landing = true; const token = ++passageToken;
			hint(`Touching down on ${companion.name}…`, 4000);
			Promise.resolve(voyage?.(companion.land === 'EARTH' ? { earth: true, name: 'Earth' } : { type: 'MOON', seed: earth ? 1969 : (seed ^ 0x6d6f6f6e) >>> 0, name: companion.name })).then(ok => { if (!disposed && token === passageToken && ok === false) landing = false; }).catch((err) => { if (disposed || token !== passageToken) return; console.warn('[landing]', err); landing = false; });
		}
	}
	// ---------- Earth: coming down where you are, or back where you left ----------
	const clampLL = (at) => ({ lat: Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, at.lat)), lon: at.lon });
	function look() {
		if (!earth || !frame.anchor) return;
		below = frame.below(P.pos); note = regionNote(below.lat, below.lon);
		const home = frame.home;
		if (home && (!homeNote || homeNote.kind === 'unknown')) homeNote = regionNote(home.lat, home.lon);
		if (fresh && (!anchorNote || anchorNote.kind === 'unknown') && Number.isFinite(frame.anchor.lat)) anchorNote = regionNote(frame.anchor.lat, frame.anchor.lon);
	}
	function landHere() {
		if (!earth || !frame.anchor || warp || passage) return;
		glide = null; choice = 'here';
		look();
		P.flying = true; P.climbAssist = false; P.descendAssist = true;
		hint(`Descending to ${note?.title || 'the place below'}. ${isTouch ? 'Steer' : 'Steer or press a key'} to take control.`, 3500);
	}
	function returnHome() {
		const home = frame.home;
		if (!earth || !frame.anchor || !home || warp || passage) return;
		if (fresh) {
			// already coming down somewhere new: straight back, behind the travel veil
			if (goHome) { charting = null; goHome(home, homeNote?.title || 'Your departure'); }
			return;
		}
		if (frame.altitude(P.pos) < ORBIT.entry) { choice = 'home'; P.climbAssist = false; P.descendAssist = true; return; }
		startGlide(home);
	}
	// round the planet at a steady height to above the departure, looking down the way ahead
	function startGlide(home) {
		const h = frame.altitude(P.pos);
		const n0 = P.pos.clone().sub(frame.center).normalize(), n1 = frame.dirOf(home.lat, home.lon);
		const angle = n0.angleTo(n1);
		glide = { t: 0, T: 1.4 + angle * 1.3, n0, n1, r0: radius + h, r1: radius + Math.min(Math.max(h, 160000), 1500000), q: new THREE.Quaternion().setFromUnitVectors(n0, n1), from: camera.quaternion.clone() };
		choice = 'home';
		P.climbAssist = P.descendAssist = P.flyUp = P.flyDown = false; P.vel.set(0, 0, 0);
		hint(`Back to ${homeNote?.title || 'your departure'}…`, 2500);
	}
	const gq = new THREE.Quaternion(), gm = new THREE.Matrix4(), gn = new THREE.Vector3(), ga = new THREE.Vector3(), gt = new THREE.Vector3(), ge = new THREE.Euler(0, 0, 0, 'YXZ');
	function stepGlide(dt) {
		const G = glide; G.t += dt;
		const s = smooth(0, G.T, G.t), before = P.pos.clone();
		gn.copy(G.n0).applyQuaternion(gq.identity().slerp(G.q, s));
		P.pos.copy(frame.center).addScaledVector(gn, G.r0 + (G.r1 - G.r0) * s);
		// look at the ground a little ahead along the way, the planet's up kept up
		ga.copy(G.n0).applyQuaternion(gq.identity().slerp(G.q, Math.min(1, s + .3)));
		gt.copy(frame.center).addScaledVector(ga, radius);
		gm.lookAt(P.pos, gt, gn);
		gq.setFromRotationMatrix(gm);
		gq.copy(G.from).slerp(gq, smooth(0, .7, G.t));
		ge.setFromQuaternion(gq, 'YXZ'); P.pitch = ge.x; P.yaw = ge.y; P.roll = ge.z;
		P.vel.copy(P.pos).sub(before).divideScalar(Math.max(dt, 1e-3));
		if (G.t >= G.T) {
			glide = null; P.vel.set(0, 0, 0); P.descendAssist = true;
			hint(`Over ${homeNote?.title || 'your departure'}. Coming down.`, 3500);
		}
	}
	// Through the entry height on the way down: the ground is laid where the ship is over.
	// Close to the anchor, the kept ground (frame.update's exact return); elsewhere, the new place.
	function gate(h) {
		if (!earth || charting || !frame.returning || h >= ORBIT.entry || P.vel.dot(frame.up(P.pos, gt)) >= 0) return;
		const a = frame.anchor, home = frame.home, target = clampLL(frame.below(P.pos));
		if (Number.isFinite(a.lat) && kmBetween(target, a) < SAME_KM) return;
		startChart(home && kmBetween(target, home) < SAME_KM ? home : target);
	}
	function startChart(target) {
		const n = regionNote(target.lat, target.lon);
		let place = null;
		try { place = chart?.(target.lat, target.lon); } catch (err) { console.warn('[landing]', err); }
		if (!place || !Number.isFinite(place.x) || !Number.isFinite(place.z)) return;
		frame.land(P, { lat: target.lat, lon: target.lon, x: place.x, z: place.z, name: n.title });
		fresh = true; anchorNote = n; lastOk = false; P.climbAssist = false;
		const q = charting = { t: 0, ready: false, calm: 0 };
		Promise.resolve(place.ready).then(() => { q.ready = true; }, (err) => { console.warn('[landing]', err); q.ready = true; });
		hint(`Coming down over ${n.title}.`, 3500);
	}
	// hold above the new place, still in orbit, until its ground is in and has had a moment to settle
	function holdChart(dt) {
		const q = charting, a = frame.anchor;
		if (frame.returning) { charting = null; return; }
		q.t += dt; if (q.ready) q.calm += dt;
		if ((q.ready && q.calm > 1.2) || q.t > 25) {
			charting = null;
			if (!q.ready) hint('Still charting: the ground fills in as you come down.', 3500);
			return;
		}
		if (P.pos.y < HOLD) { P.pos.set(a.x, HOLD, a.z); P.vel.set(0, Math.max(0, P.vel.y), 0); }
	}
	function before() {
		if (!frame.anchor && P.flying && P.pos.y >= ORBIT.start) {
			const at = location();
			frame.capture(P, at);
			frame.setSun(sun());
			view.anchor(at.lat, at.lon, sun());
			departed?.(frame.anchor);
			fresh = false; charting = glide = choice = null; homeNote = anchorNote = null; lastOk = false;
			if (earth) loadAtlas().catch(() => {});
			hint(earth ? 'Leaving the atmosphere. Keep climbing to orbit Earth; descend here to return.' : 'Leaving the atmosphere. Keep flying; descend to return here.', 4000);
		}
		if (controls.high()) P.flying = true;
	}
	function after(dt = 1 / 60) {
		if (disposed) return;
		passageCooldown = Math.max(0, passageCooldown - dt);
		if (passage) { lastOk = false; stepPassage(dt); camera.position.copy(P.pos); camera.rotation.set(P.pitch, P.yaw, P.roll || 0, 'YXZ'); return; }
		if (!P.flying || P.locked) { lastOk = false; return; }
		// the booster gear eases between tiers in proportion, so ×1,000 to ×10,000 is a smooth surge
		const want = flightMultiplier(P.boost);
		gear = Math.exp(Math.log(gear) + (Math.log(want) - Math.log(gear)) * (1 - Math.exp(-Math.max(0, dt) * 2.2)));
		if (warp) stepWarp(dt);
		else if (glide) stepGlide(dt);
		else if (bounce) {
			bounce.t += dt;
			P.pos.lerpVectors(bounce.from, bounce.to, smooth(0, 1.4, bounce.t)); P.vel.set(0, 0, 0);
			if (bounce.t >= 1.4) bounce = null;
		} else if (frame.anchor) {
			const h0 = frame.altitude(P.pos);
			// level flight round the planet stays level (fading out far from it)
			if (lastOk && h0 > ORBIT.entry) frame.transport(P, lastPos, 1 - smooth(5e6, 2e7, h0));
			gate(h0);
			if (frame.update(P)) hint('Returning to your departure area. You have control.', 3500);
			if (charting) holdChart(dt);
			// a hard limit on top of the guard: never close on a surface faster than three times the gap per second
			const v = P.vel.length(), gap = v > 1 ? frame.clearance(P.pos, course()) * 3 : Infinity;
			const stellar = frame.stellarSpeed(P.pos, course());
			if (v > 1000 && v > Math.min(gap, stellar)) P.vel.multiplyScalar(Math.max(Math.min(gap, stellar), 1000) / v);
			hazards();
			if (P.boost > 9 && !deep()) { P.boost = 9; gear = Math.min(gear, 9); hint('Booster back to ×9 near the planet.', 2500); }
		}
		if (frame.altitude(P.pos) < ORBIT.end && P.roll) P.roll *= Math.exp(-Math.max(0, dt) * 1.5);
		if (frame.anchor && frame.altitude(P.pos) < ORBIT.start * .65) {
			const there = fresh ? anchorNote?.title : '';
			frame.reset(); wasSpace = false;
			fresh = false; charting = glide = choice = null; P.descendAssist = false;
			hint(there ? `${there}. You have control.` : 'Back above your departure area.', 3000);
		}
		lastPos.copy(P.pos); lastOk = !!frame.anchor && !warp && !glide && !bounce;
		camera.position.copy(P.pos);
		camera.rotation.set(P.pitch, P.yaw, P.roll || 0, 'YXZ');
	}
	function updateCard(h) {
		const show = earth && !!frame.home && !warp && !passage && solarDepth === 0 && h < 5e7 && (h >= ORBIT.entry || fresh || !!glide);
		if (!show) { if (card.style.display !== 'none') card.style.display = 'none'; return; }
		const now = performance.now();
		if (now >= noteT || !note || glide) { noteT = now + 300; look(); }
		const home = (homeNote?.title || 'your departure').replace(/^The /, 'the ');
		let head, name, sub, here = '', back = '';
		if (glide) { head = 'RETURNING'; name = homeNote?.title || 'Your departure'; sub = 'Gliding round the planet to where you left.'; }
		else if (fresh) {
			head = charting ? 'CHARTING THE GROUND BELOW' : 'COMING DOWN';
			name = anchorNote?.title || ''; sub = anchorNote?.sub || '';
			back = `↩ Back to ${home}`;
		} else {
			const atHome = kmBetween(below, frame.home) < SAME_KM;
			head = atHome ? 'BELOW · WHERE YOU LEFT' : choice === 'here' && P.descendAssist ? 'DESCENDING TO' : 'BELOW';
			name = note.title; sub = note.sub;
			here = atHome ? '⤓ Descend here' : '⤓ Land here';
			back = atHome ? '' : `↩ Back to ${home}`;
		}
		const text = [head, name, sub, here, back].join('|');
		if (text !== cardText) {
			cardText = text;
			cardHead.textContent = head; cardTitle.textContent = name; cardSub.textContent = sub;
			hereBtn.textContent = here; hereBtn.style.display = here ? '' : 'none';
			homeBtn.textContent = back; homeBtn.style.display = back ? '' : 'none';
			homeBtn.title = back ? `Return to ${home}, where you left the ground` : '';
			cardRow.style.display = here || back ? 'flex' : 'none';
		}
		if (card.style.display !== 'block') card.style.display = 'block';
	}
	function updateHud() {
		const h = frame.altitude(P.pos), on = !!frame.anchor;
		leaveStar.style.display = on && (solarDepth > 0 || passage) && !warp ? 'block' : 'none';
		hud.style.display = on ? 'block' : 'none';
		bearing.style.display = on ? 'block' : 'none';
		nav.showButton(on && h >= SPACE);
		if (!on) { nav.update(camera, [], false); if (card.style.display !== 'none') card.style.display = 'none'; return; }
		const v = P.vel.length();
		const phase = passage ? 'CROSSING THE HORIZON' : warp ? `WARP → ${warp.d.name.toUpperCase()}` : solarDepth > 0 ? 'SOLAR INTERIOR' : glide ? 'RETURNING' : charting ? 'CHARTING' : h >= SPACE ? 'SPACE' : 'ATMOSPHERE';
		const where = h < 1e7 ? `${(h / 1000).toFixed(h < 1e6 ? 1 : 0)} km` : distanceLabel(h);
		const hazard = heat > .02 ? `\n☀ HEAT ${Math.round(heat * 100)}% · SHIELDS HOLDING` : '';
		const next = `${phase} · ${where}\n${speedLabel(flightMultiplier(P.boost))} · ${speedReadout(v)}${hazard}`;
		if (text !== next) { text = next; hud.textContent = next; hud.style.color = heat > .5 ? '#ffc08a' : '#eafaf6'; }
		if (h >= SPACE && !wasSpace) { wasSpace = true; hint(earth ? `Orbit. Fly level to circle the Earth; B for faster gears. Over any place, Land here, or go back to your departure. ${isTouch ? '⤳ Warp' : 'J'}: warp further.` : `Space. B: faster gears up to ×100k. ${isTouch ? '⤳ Warp' : 'J'}: warp to a moon, planet, the Sun or Gargantua. C descends.`, 6000); }
		updateCard(h);
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
		bearing.textContent = `${behind ? (up.x >= 0 ? '→' : '←') : '◇'}\n${fresh ? anchorNote?.title || 'Landing' : 'Departure'}`;
		// labelled markers on the far bodies (the planet below keeps the departure marker)
		nav.update(camera, h >= SPACE ? bodies().filter((b) => b.id !== 'home' || h > 2e7) : [], h >= SPACE && !warp);
	}
	function onKey(e) {
		if (!frame.anchor || window._KEYS_PLAY_ON || e.target?.closest?.('input,textarea,[contenteditable]')) return;
		if (e.key === 'Escape' && (passage || solarDepth > 0)) { exitStellar(); e.preventDefault(); e.stopImmediatePropagation(); return; }
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
		// the bodies round the ship, where they are now (explore.js steers by them)
		bodies,
		landHere, returnHome,
		// above a place in orbit, looking down at it (tests, and the console: Crysis.orbitOver)
		over: (lat, lon, alt = 400000) => {
			if (!earth || !frame.anchor || !Number.isFinite(+lat) || !Number.isFinite(+lon)) return false;
			const n = frame.dirOf(+lat, +lon);
			P.pos.copy(frame.center).addScaledVector(n, radius + Math.max(ORBIT.entry + 10000, alt));
			gm.lookAt(P.pos, frame.center, frame.dirOf(+lat + 10, +lon, ga)); gq.setFromRotationMatrix(gm); ge.setFromQuaternion(gq, 'YXZ');
			P.pitch = ge.x; P.yaw = ge.y; P.roll = ge.z; P.vel.set(0, 0, 0); P.flying = true; lastOk = false; glide = null; noteT = 0;
			if (frame.altitude(P.pos) > ORBIT.entry + 5000) frame.update(P);
			return true;
		},
		// the ground systems may stream while coming down on a newly chosen place (main.js)
		streams: () => earth && fresh && !!frame.anchor && !frame.returning && frame.altitude(P.pos) < ORBIT.entry,
		landing: () => ({ below: below && { ...below }, note: note && { ...note }, home: frame.home, homeName: homeNote?.title || null, choice, fresh, gliding: !!glide, charting: charting && { ...charting }, place: fresh ? anchorNote : null, card: card.style.display === 'block' ? cardText : null }),
		info: () => ({ ...frame.info(P.pos), speed: P.vel.length(), gear, boost: P.boost, radius, type, companion: companion.name, solarDepth, horizon: passage ? { time: passage.t, sent: passage.sent } : null, warping: !!warp, warpTime: warp?.t ?? 0, bouncing: !!bounce, landing, heat, target: nav.target, gargantuaVisible: !!view.gargantua?.visible, music: { bass: shared.uBass.value, mid: shared.uMid.value, high: shared.uHigh.value, thrust: musicThrust(shared.uBass.value, shared.uPulse.value) } }),
		pause: () => { stopPassage(true); warp = bounce = glide = null; P.vel.set(0, 0, 0); P.flyUp = P.flyDown = P.climbAssist = false; leaveStar.style.display = 'none'; },
		cancel: () => { stopPassage(); solarDepth = heat = 0; leaveStar.style.display = 'none'; frame.reset(); warp = bounce = glide = charting = choice = null; fresh = false; lastOk = false; card.style.display = 'none'; P.descendAssist = false; landing = false; P.roll = 0; P.climbAssist = false; hud.style.display = bearing.style.display = 'none'; nav.showButton(false); nav.update(camera, [], false); },
		exitStellar,
		dispose() { stopPassage(); disposed = true; leaveStar.remove(); card.remove(); removeEventListener('keydown', onKey, true); delete P.orbit; hud.remove(); bearing.remove(); nav.dispose(); view.dispose(); },
	};
}
