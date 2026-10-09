// Pure siting/scheduling rules for the optional woodland jam.
export const PICNIC = Object.freeze({ scan: 60, chance: 0.09, cooldown: 30 * 60, duration: 8 * 60, hear: 44, leave: 110 });
export const CAST = Object.freeze([
 { name: 'Misha', age: 41, role: 'strings', color: [0.22, 0.32, 0.39] },
 { name: 'Lev', age: 36, role: 'strings', color: [0.40, 0.15, 0.075] },
 { name: 'Sasha', age: 47, role: 'sky-shot', color: [0.69, 0.71, 0.62] },
 { name: 'Nikolai', age: 53, role: 'sky-shot', color: [0.28, 0.43, 0.34] },
 { name: 'Yuri', age: 39, role: 'strings', color: [0.15, 0.20, 0.31] },
 { name: 'Pavel', age: 32, role: 'clap', color: [0.44, 0.23, 0.15] },
 { name: 'Oleg', age: 58, role: 'laugh', color: [0.36, 0.39, 0.25] },
 { name: 'Viktor', age: 45, role: 'listen', color: [0.24, 0.18, 0.29] },
]);
export const PICNIC_ARMS = Object.freeze(['mossback-scout-rifle', 'warden-spark-carbine', 'aurora-trail-rifle']);
// Half-beats, deliberately loose percussion. Each friend's turn has its own pause.
export function shotOnBeat(beat, performer) {
 const n = ((beat % 32) + 32) % 32;
 return performer === 2 ? n === 10 || n === 26 : performer === 3 && (n === 15 || n === 30);
}
export function eligiblePicnic({ type, hours, flying, submerged, underground, busy }) {
 return !busy && !flying && !submerged && !underground && hours >= 10 && hours < 19 && ['EARTH', 'TROPICAL', 'TERRAN'].includes(String(type).toUpperCase());
}
// Check the full blanket, seated bodies and walking margin, not just its centre.
export function picnicGround(x, z, heightAt, blocked = () => false) {
 const y = heightAt(x, z);
 if (!Number.isFinite(y) || y < 1.5) return null;
 for (let dx = -3.5; dx <= 3.5; dx += 1) for (let dz = -3.5; dz <= 3.5; dz += 1) {
  const h = heightAt(x + dx, z + dz);
  if (!Number.isFinite(h) || Math.abs(h - y) > 0.24 || blocked(x + dx, z + dz, h)) return null;
 }
 return { x, y, z };
}
export function findPicnicSpot(cam, yaw, heightAt, blocked, random = Math.random) {
 // Out behind a shoulder, so an encounter is discovered by sound, not seen spawning.
 for (let i = 0; i < 16; i++) {
  const a = yaw + (random() - 0.5) * 1.5, d = 28 + random() * 12;
  const q = picnicGround(cam.x + Math.sin(a) * d, cam.z + Math.cos(a) * d, heightAt, blocked);
  if (q) return q;
 }
 return null;
}
export const picnicSeats = (count = CAST.length) => Array.from({ length: count }, (_, i) => {
 const a = (i / count) * Math.PI * 2 + Math.PI / 4;
 return { x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, yaw: a + Math.PI };
});
export function picnicDue(elapsed, lastAt, now, random = Math.random) {
 return elapsed >= PICNIC.scan && now - lastAt >= PICNIC.cooldown * 1000 && random() < PICNIC.chance;
}
