// The world's factions, all fictional: who they are, where they hold ground, their colours and
// emblem, how they fight, and how they stand with each other and with you. Standings move:
// an attack sours a faction on its attacker, a common enemy warms two sides to each other, and
// with time everything drifts back toward the old feelings. Membership is mixed, as anywhere;
// no faction stands for any real people, place, belief or group. Pure data and rules.

// zones: earth-urban, earth-rural, earth-coast, earth-desert, arid (ARID worlds), wild (other
// worlds' open ground), village (round a settlement), deep (the Deep)
export const FACTIONS = Object.freeze({
	copperline: { name: 'Copperline Kings', kind: 'gang', zones: ['earth-urban'], colors: ['#c8733a', '#16181b'], emblem: 'crown over a rail', gun: 'mossback-scout-rifle', hp: 100, armour: 10, acc: 0.38, aggression: 0.5 },
	glasshouse: { name: 'Glasshouse Crew', kind: 'gang', zones: ['earth-urban'], colors: ['#2fb5a8', '#eef3f2'], emblem: 'a cracked pane', gun: 'warden-spark-carbine', hp: 100, armour: 10, acc: 0.36, aggression: 0.55 },
	ridgeback: { name: 'Ridgeback Volunteers', kind: 'militia', zones: ['earth-rural', 'wild'], colors: ['#5b6a3a', '#c9b98a'], emblem: 'an antler', gun: 'aurora-trail-rifle', hp: 110, armour: 30, acc: 0.45, aggression: 0.3 },
	ashfang: { name: 'Ashfang Raiders', kind: 'raiders', zones: ['arid', 'earth-desert', 'wild'], colors: ['#b8462c', '#2a2e33'], emblem: 'a broken fang', gun: 'aurora-trail-rifle', hp: 100, armour: 35, acc: 0.42, aggression: 0.85, masked: true },
	dunecutters: { name: 'Dune Cutters', kind: 'raiders', zones: ['arid', 'earth-desert'], colors: ['#d9b46a', '#2c3566'], emblem: 'a kite over dunes', gun: 'warden-spark-carbine', hp: 95, armour: 25, acc: 0.4, aggression: 0.8, masked: true },
	saltjack: { name: 'Saltjack Smugglers', kind: 'smugglers', zones: ['earth-coast'], colors: ['#24324a', '#e8e0cc'], emblem: 'a knotted anchor', gun: 'mossback-scout-rifle', hp: 100, armour: 15, acc: 0.4, aggression: 0.35 },
	halcyon: { name: 'Halcyon Contractors', kind: 'mercs', zones: [], colors: ['#6d737a', '#f2c230'], emblem: 'a hex shield', gun: 'aurora-trail-rifle', hp: 120, armour: 60, acc: 0.5, aggression: 0.7 },
	hearthguard: { name: 'Hearthguard', kind: 'villagers', zones: ['village'], colors: ['#3f7a4a', '#efe6cf'], emblem: 'a lantern', gun: 'reedline-hunting-bow', hp: 90, armour: 10, acc: 0.4, aggression: 0.1 },
	patrol: { name: 'Bay Patrol', kind: 'law', zones: ['earth-urban'], colors: ['#1d2a45', '#d9c46a'], emblem: 'a lighthouse', gun: 'mossback-scout-rifle', hp: 100, armour: 30, acc: 0.45, aggression: 0, lawful: true },
	rangers: { name: 'Frontier Rangers', kind: 'law', zones: ['earth-rural', 'wild'], colors: ['#2f4a33', '#c9b27a'], emblem: 'an oak leaf', gun: 'aurora-trail-rifle', hp: 110, armour: 30, acc: 0.48, aggression: 0, lawful: true },
	rogue: { name: 'Rogue drones', kind: 'machines', zones: ['wild', 'arid'], colors: ['#3a3f46', '#ff4a2a'], emblem: 'none', hp: 60, armour: 0, acc: 0.5, aggression: 1 },
	gloom: { name: 'Gloomcrawlers', kind: 'creatures', zones: ['deep'], colors: ['#b9c2c8', '#7affc8'], emblem: 'none', hp: 70, armour: 0, acc: 0.6, aggression: 1 },
	civ: { name: 'Townsfolk', kind: 'civilians', zones: [], colors: ['#ffffff', '#ffffff'], emblem: 'none', aggression: 0 },
	village: { name: 'Villagers', kind: 'civilians', zones: ['village'], colors: ['#ffffff', '#ffffff'], emblem: 'none', aggression: 0 },
});
export const PLAYER = 'player';
export const HOSTILE = -30, ALLIED = 30;

// the old feelings between them (unlisted pairs are 0, neutral; listed both ways)
const BASE = [
	['copperline', 'glasshouse', -70], ['copperline', 'patrol', -45], ['glasshouse', 'patrol', -45], ['copperline', 'civ', -5], ['glasshouse', 'civ', -5],
	['ashfang', 'dunecutters', -60], ['ashfang', 'village', -70], ['dunecutters', 'village', -60], ['ashfang', 'hearthguard', -80], ['dunecutters', 'hearthguard', -75],
	['ashfang', 'rangers', -70], ['dunecutters', 'rangers', -60], ['ashfang', 'ridgeback', -50], ['ridgeback', 'rangers', -10], ['ridgeback', 'hearthguard', 35],
	['hearthguard', 'village', 90], ['hearthguard', 'rangers', 40], ['patrol', 'civ', 60], ['rangers', 'village', 50], ['patrol', 'rangers', 70],
	['saltjack', 'patrol', -40], ['saltjack', 'copperline', 20], ['halcyon', 'patrol', 10],
	['rogue', 'ashfang', -60], ['rogue', 'dunecutters', -60], ['rogue', 'village', -60], ['rogue', 'hearthguard', -60], ['rogue', 'rangers', -60], ['rogue', 'ridgeback', -60],
	['gloom', 'village', -80],
];
// how each sees you to begin with
const PLAYER_BASE = { copperline: -10, glasshouse: -10, ashfang: -60, dunecutters: -50, rogue: -100, gloom: -100, saltjack: 0, halcyon: 0, patrol: 20, rangers: 20, hearthguard: 30, village: 40, civ: 40, ridgeback: 0 };

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const clamp = (v) => Math.max(-100, Math.min(100, v));

export function createRelations(saved = null) {
	const base = new Map();
	for (const [a, b, v] of BASE) base.set(key(a, b), v);
	for (const [f, v] of Object.entries(PLAYER_BASE)) base.set(key(PLAYER, f), v);
	const now = new Map(base);
	if (saved && typeof saved === 'object') for (const [k, v] of Object.entries(saved)) if (Number.isFinite(v) && /^[a-z]+\|[a-z]+$/.test(k)) now.set(k, clamp(v));
	const get = (a, b) => (a === b ? 100 : now.get(key(a, b)) ?? base.get(key(a, b)) ?? 0);
	const set = (a, b, v) => { if (a !== b) now.set(key(a, b), clamp(v)); };
	return {
		get, set,
		hostile: (a, b) => a !== b && get(a, b) <= HOSTILE,
		allied: (a, b) => a === b || get(a, b) >= ALLIED,
		stance: (a, b) => { const v = get(a, b); return v <= HOSTILE ? 'hostile' : v >= ALLIED ? 'allied' : 'neutral'; },
		// a attacked b: b and b's allies sour on a; a's own enemies warm a little to a
		attacked(a, b, k = 1) {
			if (a === b) return;
			set(b, a, get(b, a) - 25 * k);
			for (const f of Object.keys(FACTIONS)) {
				if (f === a || f === b) continue;
				if (get(f, b) >= ALLIED) set(f, a, get(f, a) - 10 * k);
				else if (get(f, b) <= HOSTILE) set(f, a, get(f, a) + 5 * k);
			}
		},
		// a helped b (struck b's enemy, defended them)
		helped(a, b, k = 1) { if (a !== b) set(a, b, get(a, b) + 8 * k); },
		// time: every standing eases back toward its old value (about a tenth a minute)
		drift(dt) {
			const k = Math.min(1, dt * 0.0018);
			for (const [kk, v] of now) { const b0 = base.get(kk) ?? 0; if (v !== b0) now.set(kk, v + (b0 - v) * k); }
		},
		save() { const o = {}; for (const [k, v] of now) if (Math.abs(v - (base.get(k) ?? 0)) > 0.5) o[k] = Math.round(v * 10) / 10; return o; },
		player: () => Object.fromEntries(Object.keys(FACTIONS).map((f) => [f, Math.round(get(PLAYER, f))])),
	};
}

// which factions belong where you are (zone names above)
export const factionsFor = (zone) => Object.entries(FACTIONS).filter(([, F]) => F.zones.includes(zone) && F.kind !== 'civilians').map(([id]) => id);
// a colour pair for a faction's look
export const colorsOf = (id) => FACTIONS[id]?.colors || ['#444', '#888'];
