// What the auto music listens to in the game (sense), and how that becomes a mood for the
// composer (adapt): how fast you are going and how, where you are, the hour, the weather,
// the kind of world, the volcano, a mushroom trip, a minigame.

import { regionalNow } from '../region/here.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the game, a couple of times a second
export function sense(W, x) {
	const out = { move: 'idle', speed: 0, place: 'wild', night: 0, rain: 0, storm: false, planet: 'TROPICAL', volcano: 'quiet', trip: 0, tripPhase: 'sober', game: false, alt: 0 };
	if (!W) return out;
	const P = W.player?.state, cam = x.camera.position;
	const v = P?.vel ? Math.hypot(P.vel.x, P.vel.z) : 0;
	out.speed = v;
	if (x.drive?.active?.()) { out.move = 'drive'; out.speed = Math.abs(x.drive.state?.v || 0); }
	else if (W.boat?.boarded?.()) out.move = 'boat';
	else if (P?.flying) out.move = P.boost ? 'boost' : 'fly';
	else if (P?.swimming) out.move = 'swim';
	else out.move = v > 5.5 ? 'run' : v > 0.6 ? 'walk' : 'idle';
	out.game = !!x.arcade?.active?.();
	// where: under the sea, in a cave, indoors, a city or the village, the beach, the sea,
	// a summit, or the wild land between
	let ground = 0;
	try { ground = W.island.heightAt(cam.x, cam.z); } catch { ground = 0; }
	out.alt = cam.y - ground;
	const caveK = W.underworld?.inside?.() || 0;
	const urban = W.bayArea?.loaded?.() ? (W.bayArea.urbanAt(cam.x, cam.z)?.u || 0) : 0;
	const vil = W.island?.village;
	if (x.shared.uUnder.value > 0.5) out.place = 'underwater';
	else if (caveK > 0.4 || (cam.y < ground - 3 && ground > 0)) out.place = 'cave';
	else if (W.weather?.state?.sheltered) out.place = 'indoors';
	else if (out.move === 'fly' || out.move === 'boost') out.place = out.alt > 250 ? 'sky' : urban > 0.3 ? 'city' : ground < -1 ? 'sea' : 'wild';
	else if (urban > 0.3) out.place = 'city';
	else if (vil && Math.hypot(cam.x - vil.x, cam.z - vil.z) < 110) out.place = 'town';
	else if (ground < -1) out.place = 'sea';
	else if (ground > 380) out.place = 'peak';
	else if (ground < 5 && nearWater(W, cam)) out.place = 'beach';
	// the hour and the weather
	const sy = x.shared.uSunDir.value.y;
	out.night = smooth(0.05, -0.14, sy);
	out.rain = W.weather?.state?.rainHere || 0;
	out.storm = W.weather?.state?.mode === 'storm' || (W.weather?.state?.flash || 0) > 0.2;
	out.planet = x.shared.planet?.type || 'TROPICAL';
	const V = W.volcano?.state?.();
	if (V) out.volcano = V.phase;
	// the place's own colour, out in the world (region/kits.js music): never the faceplate itself
	out.regional = regionalNow()?.kit?.music || null;
	const T = W.shrooms?.state?.();
	if (T && T.phase !== 'sober') { out.trip = T.k || 0.5; out.tripPhase = T.phase; }
	return out;
}
function nearWater(W, cam) {
	for (let k = 0; k < 8; k++) {
		const a = k / 8 * Math.PI * 2;
		try { if (W.island.heightAt(cam.x + Math.cos(a) * 40, cam.z + Math.sin(a) * 40) < -0.5) return true; } catch { return false; }
	}
	return false;
}

const MOVE = {
	idle: { e: 0.24, t: 0.94 }, walk: { e: 0.38, t: 1 }, run: { e: 0.58, t: 1.06 }, swim: { e: 0.3, t: 0.95 },
	fly: { e: 0.6, t: 1.05 }, boost: { e: 0.82, t: 1.1 }, drive: { e: 0.66, t: 1.08 }, boat: { e: 0.42, t: 0.97 },
};

// the game's state as a mood the composer reads
export function adapt(g) {
	const mv = MOVE[g.move] || MOVE.idle;
	const M = {
		energy: mv.e, tempoK: mv.t, density: 0.72, sparse: 0, dark: 0, drums: 1, reg: 0, bassShift: 0, padShift: 0,
		echo: 0, arp: 0, dream: 0, tension: 0, climax: false, dissonance: 0, drone: 0, half: 0, slowHarmony: false,
		lydian: 0, phrygian: 0, swingAdd: 0,
	};
	if (g.move === 'boat') M.swingAdd += 0.1;
	if (g.move === 'swim') M.arp += 0.3;
	switch (g.place) {
		case 'city': M.energy += 0.1; M.drums *= 1.1; M.swingAdd += 0.06; M.density *= 1.05; break;
		case 'town': M.energy += 0.05; M.swingAdd += 0.04; break;
		case 'beach': M.tempoK *= 0.97; M.swingAdd += 0.08; M.density *= 0.85; M.drums *= 0.8; M.arp += 0.2; break;
		case 'wild': M.drums *= 0.72; M.density *= 0.9; M.arp += 0.1; break;
		case 'peak': M.sparse += 0.3; M.slowHarmony = true; M.drums *= 0.6; M.reg += 3; break;
		case 'sea': M.arp += 0.3; M.drums *= 0.7; break;
		case 'sky': M.reg += 3; M.slowHarmony = true; M.sparse += 0.1; break;
		case 'cave': M.tempoK *= 0.82; M.energy *= 0.6; M.reg -= 5; M.padShift -= 3; M.sparse += 0.5; M.echo += 0.7; M.drums *= 0.4; M.half = 1; M.dark += 0.5; break;
		case 'underwater': M.tempoK *= 0.8; M.energy *= 0.4; M.sparse += 0.6; M.drums *= 0.15; M.echo += 0.5; M.reg -= 3; M.slowHarmony = true; break;
		case 'indoors': M.energy *= 0.8; M.drums *= 0.7; M.echo += 0.15; break;
	}
	// the hour: night slower, darker, lower, fewer drums
	const n = g.night;
	M.tempoK *= 1 - 0.07 * n; M.density *= 1 - 0.2 * n; M.dark += 0.4 * n; M.reg -= 2 * n; M.drums *= 1 - 0.25 * n;
	// the weather
	const r = g.rain;
	M.density *= 1 - 0.25 * r; M.drums *= 1 - 0.35 * r; M.sparse += 0.25 * r; M.tempoK *= 1 - 0.05 * r; M.dark += 0.2 * r;
	if (g.storm) { M.tension = Math.max(M.tension, 0.45); M.dark += 0.3; }
	// the kind of world
	switch (g.planet) {
		case 'MYSTICAL': case 'SINGULARITY': M.lydian = 1; M.arp += 0.3; M.echo += 0.2; M.reg += 2; break;
		case 'TOXIC': M.dissonance = 0.6; M.dark += 0.3; break;
		case 'ICE': M.sparse += 0.4; M.reg += 5; M.drums *= 0.5; M.echo += 0.3; M.arp += 0.2; M.density *= 0.7; M.slowHarmony = true; break;
		case 'MAGMA': M.reg -= 4; M.bassShift -= 4; M.half = 1; M.drums *= 1.15; M.energy += 0.1; M.dark += 0.3; M.tempoK *= 0.94; break;
		case 'ARID': M.drone = 0.7; M.phrygian = 1; M.swingAdd += 0.05; break;
		case 'GAS': M.sparse += 0.35; M.slowHarmony = true; M.drums *= 0.55; M.echo += 0.25; M.density *= 0.75; break;
		case 'OCEAN': M.arp += 0.3; M.swingAdd += 0.05; break;
	}
	// the place's colour: a pentatonic in East Asia and the steppe, a phrygian edge in the souk,
	// a drone under the desert and the Himalaya, space in the north (the faceplate's own key)
	const RC = g.regional;
	if (RC) {
		if ((RC.phrygian || 0) > 0.5) M.phrygian = 1;
		if ((RC.lydian || 0) > 0.25) M.lydian = Math.max(M.lydian, RC.lydian > 0.5 ? 1 : 0);
		M.penta = RC.penta || 0;
		M.drone = Math.max(M.drone, RC.drone || 0);
		M.sparse += (RC.sparse || 0) * 0.6; M.swingAdd += RC.swing || 0; M.reg += RC.reg || 0; M.arp += RC.arp || 0;
	}
	// the volcano: a rumble builds, an eruption is the climax
	if (g.volcano === 'rumble') { M.tension = Math.max(M.tension, 0.75); M.energy += 0.2; }
	else if (g.volcano === 'erupting') { M.climax = true; M.energy = Math.max(M.energy, 0.95); M.drums *= 1.2; M.tension = Math.max(M.tension, 0.5); }
	else if (g.volcano === 'cooling') { M.energy -= 0.1; M.sparse += 0.2; }
	// a mushroom trip: slower, echoing, a lydian shimmer
	if (g.trip > 0) {
		const k = clamp(g.trip, 0, 1);
		M.dream = k; M.tempoK *= 1 - 0.15 * k; M.drums *= 1 - 0.4 * k; M.echo += 0.5 * k; M.arp += 0.4 * k; M.sparse += 0.2 * k; M.reg += 2 * k;
		if (k > 0.3) M.lydian = 1;
	}
	if (g.game) { M.energy += 0.2; M.tempoK *= 1.06; M.drums *= 1.1; }
	M.energy = clamp(M.energy, 0.05, 1);
	M.sparse = clamp(M.sparse, 0, 1);
	M.dark = clamp(M.dark, 0, 1);
	M.drums = clamp(M.drums, 0, 1.3);
	M.echo = clamp(M.echo, 0, 1);
	M.arp = clamp(M.arp, 0, 1);
	M.density = clamp(M.density * (0.85 + M.energy * 0.3) * (1 - M.sparse * 0.35), 0.18, 1);
	M.tempoK = clamp(M.tempoK, 0.7, 1.18);
	const reg = Math.round(clamp(M.reg, -9, 8));
	// registers in semitones over the faceplate's root (and each lead's own octave)
	M.melLoS = reg; M.melHiS = 19 + reg;
	M.cLoS = Math.max(0, 4 + reg); M.arpLoS = Math.max(0, 7 + reg);
	M.padCenter = clamp(-3 + M.padShift + Math.round(reg / 3), -9, -1);
	M.bassHi = clamp(-7 + M.bassShift + Math.min(0, Math.round(reg / 2)), -14, -5);
	return M;
}
