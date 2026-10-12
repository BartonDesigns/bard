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
export const FLOOR_HEIGHT = .045;
const crossed = { L: [-.18, 0, .38, -1.0], R: [.18, 0, .48, 1.0] };
const openKnees = { L: [1,.08,.25], R: [-1,.08,.25] };
export const FLOOR_POSES = Object.freeze([
 {name:'slouched',feet:crossed,knees:openKnees,lean:.27,roll:.05},
 {name:'cross-legged',feet:crossed,knees:openKnees,lean:.10,roll:-.10},
 {name:'one knee up',feet:{L:[.18,0,.56,-.25],R:[.12,0,.35,.9]},knees:{L:[.3,1,.4],R:[-1,.05,.3]},lean:.16,roll:.03},
 {name:'loose cross-legged',feet:{L:[-.13,0,.47,-.8],R:[.16,0,.34,1.0]},knees:openKnees,lean:.13,roll:-.12},
 {name:'slouched to the side',feet:crossed,knees:openKnees,lean:.25,roll:.20},
 {name:'knees relaxed',feet:{L:[.20,0,.60,-.2],R:[-.22,0,.55,.2]},knees:{L:[.6,.5,1],R:[-.6,.5,1]},lean:.22,roll:.02},
 {name:'leaning left',feet:crossed,knees:openKnees,lean:-.08,roll:-.30,support:'L'},
 {name:'leaning right',feet:{L:[-.20,0,.38,-.9],R:[.16,0,.47,.9]},knees:openKnees,lean:-.04,roll:.30,support:'R'},
]);
// One friend stretches their legs at a time. Long pauses keep this a relaxed gathering.
export function picnicActivity(elapsed, index) {
 const t=((elapsed-12-index*14)%128+128)%128;
 if(t<2)return 'rise';
 if(t<4.5)return 'shuffle-out';
 if(t<6)return 'stand';
 if(t<9)return 'shuffle-back';
 if(t<10)return 'turn';
 if(t<12)return 'settle';
 return 'seated';
}
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
