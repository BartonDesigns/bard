// A bounded survey of actual procedural wells, not invented quest destinations.
import { wellAt, GATHER_R, WELL_BACK, strandsShowing } from './aether.js';

const CELL = 420;
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function surveyWells({ position, seed, heightAt, ground = heightAt, light = 0.5, gathered = {}, wells = [], now = Date.now() }) {
	if (!position || ![position.x, position.y, position.z, seed, light, now].every(Number.isFinite) || typeof heightAt !== 'function') return [];
	const seen = new Set(wells.map(w => w?.key)), show = strandsShowing(light), result = [];
	const ci = Math.floor(position.x / CELL), cj = Math.floor(position.z / CELL);
	// At most 25 candidates per request; no world generation, particles or textures.
	for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
		const w = wellAt(i, j, seed, heightAt);
		if (!w) continue;
		const dx = w.x - position.x, dz = w.z - position.z, distance = Math.hypot(dx, dz);
		// Match the gathering system's actual floor at touching distance; avoid distant collision queries.
		const y = (distance <= GATHER_R + 1.2 ? ground(w.x, w.z) : heightAt(w.x, w.z)) + 0.4;
		if (!Number.isFinite(y)) continue;
		const at = gathered[w.key];
		const waitMs = Number.isFinite(at) && at > 0 ? Math.max(0, WELL_BACK - (now - at)) : 0;
		const bearing = DIRECTIONS[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8];
		result.push({ ...w, y, seed, distance, bearing, discovered: seen.has(w.key), waitMs,
			visible: !!show[w.strand], inReach: distance <= GATHER_R + 1.2 && Math.abs(y - (position.y - 0.9)) <= 3 });
	}
	return result.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
}

// Unlike gathering, the rite does not consume fabric or wait for a depleted well to refill.
// Its caller still checks all seven trials, level and twilight using riteBlock/ascend.
export function riteSite(survey) {
	return survey.find(w => w.inReach) || null;
}
