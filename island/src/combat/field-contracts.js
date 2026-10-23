// Authored local contracts. One transaction grants the completion reward; retries use its ID.
export const FIELD_CONTRACTS = Object.freeze([
	{ name: 'First light', brief: 'Locate an abandoned ranger cache, collect your first field kit, and return to the rally point.', waves: [], weapon: 'aurora-trail-rifle', tier: 0, level: 2, credits: 120 },
	{ name: 'Broken supply line', brief: 'Scout the stolen cache. Drive off its guards, recover the supplies, and return.', waves: [['flanker', 'marksman']], weapon: 'warden-spark-carbine', tier: 1, level: 4, credits: 240 },
	{ name: 'The last relay', brief: 'Secure the relay cache against two squads. Recover its upgraded weapon and return to the rally point.', waves: [['suppressor', 'flanker'], ['marksman', 'suppressor']], weapon: 'mossback-scout-rifle', tier: 2, level: 6, credits: 420 },
	{ name: 'Perimeter survey', brief: 'Inspect three marked points around the cache, collect the survey kit, and report back.', checkpoints: 3, waves: [], weapon: 'aurora-trail-rifle', tier: 1, level: 4, credits: 220 },
	{ name: 'Hold the clearing', brief: 'Drive off the approaching squad, hold the cache perimeter for twenty seconds, then recover the kit.', holdSeconds: 20, waves: [['suppressor', 'flanker']], weapon: 'warden-spark-carbine', tier: 2, level: 5, credits: 320 },
	{ name: 'Crossfire ridge', brief: 'Break a pair of marksmen covering the supply point. Recover the kit and return.', waves: [['marksman', 'marksman']], weapon: 'mossback-scout-rifle', tier: 2, level: 5, credits: 340 },
	{ name: 'Quiet approach', brief: 'Scout two perimeter points before clearing a small guard team and recovering the field kit.', checkpoints: 2, waves: [['flanker']], weapon: 'aurora-trail-rifle', tier: 1, level: 4, credits: 280 },
	{ name: 'Rolling blockade', brief: 'Break through a mobile squad, then clear its reinforcements before opening the cache.', waves: [['flanker', 'flanker'], ['suppressor']], weapon: 'warden-spark-carbine', tier: 2, level: 6, credits: 400 },
	{ name: 'Relay watch', brief: 'Inspect the relay perimeter, clear its guards, and stay on site while the twenty-second transmission completes.', checkpoints: 2, holdSeconds: 20, waves: [['marksman', 'flanker']], weapon: 'mossback-scout-rifle', tier: 2, level: 6, credits: 420 },
]);
export function contractFor(completed = 0) {
	const n = Math.max(0, Math.floor(Number(completed) || 0));
	const d = FIELD_CONTRACTS[n < 3 ? n : 1 + ((n - 1) % (FIELD_CONTRACTS.length - 1))];
	return { ...d, waves: d.waves.map((w) => [...w]), tier: n >= 5 ? 3 : d.tier, level: Math.min(8, d.level + Math.max(0, n - 2)), credits: d.credits + Math.min(300, Math.max(0, n - 2) * 60) };
}
export function createFieldContract({ id, completed = 0, site, rally }) {
	return { id, def: contractFor(completed), site: { ...site }, rally: { ...rally }, stage: 'travel', wave: 0, checkpoint: 0, hold: 0, rewardClaimed: false };
}
export function advanceContract(m, event) {
	if (!m) return false;
	const before = m.stage;
	if (m.stage === 'travel' && event === 'arrive') m.stage = m.def.checkpoints ? 'survey' : m.def.waves.length ? 'secure' : 'recover';
	else if (m.stage === 'survey' && event === 'inspected') {
		m.checkpoint++; if (m.checkpoint >= m.def.checkpoints) m.stage = m.def.waves.length ? 'secure' : 'recover';
		return true;
	}
	else if (m.stage === 'hold' && event === 'held' && m.hold >= m.def.holdSeconds) m.stage = 'recover';
	else if (m.stage === 'secure' && event === 'cleared') {
		m.wave++;
		if (m.wave >= m.def.waves.length) m.stage = m.def.holdSeconds ? 'hold' : 'recover';
		return true;
	} else if (m.stage === 'recover' && event === 'collected') m.stage = 'return';
	else if (m.stage === 'return' && event === 'paid') { m.stage = 'complete'; m.rewardClaimed = true; }
	else if (event === 'abandon' && m.stage !== 'complete') m.stage = 'abandoned';
	return before !== m.stage;
}
export function contractReward(m) {
	if (m?.stage !== 'return') return null;
	return { id: `contract:${m.id}`, kind: 'trade', peer: 'frontier-contracts', give: { credits: 0, items: [] }, get: { credits: m.def.credits, items: [{ u: `${m.id}r`, i: 'repair-roll', l: 1, t: 0, x: 0 }] } };
}

export const FIELD_ROLES = Object.freeze({
	flanker: { name: 'Flanker', tactic: 'flank', gun: 'warden-spark-carbine', speed: 4.7, range: 48, dmg: 5, acc: .32, burst: [2, 3], gap: [1.6, 2.3], rate: .2, hp: 85, armour: 10, distance: [12, 17] },
	marksman: { name: 'Marksman', tactic: 'suppress', gun: 'mossback-scout-rifle', speed: 2.8, range: 95, dmg: 16, acc: .62, burst: [1, 1], gap: [2.4, 3.5], rate: .8, hp: 90, armour: 15, distance: [32, 42] },
	suppressor: { name: 'Suppressor', tactic: 'suppress', gun: 'aurora-trail-rifle', speed: 2.7, range: 65, dmg: 6, acc: .38, burst: [3, 4], gap: [1.8, 2.7], rate: .3, hp: 130, armour: 50, distance: [21, 28] },
});

// Small, level survey route within the already validated contract clearing.
export function contractPoint(m) {
	if (m.stage === 'return') return m.rally;
	if (m.stage !== 'survey') return m.site;
	const angle = m.checkpoint * Math.PI * 2 / m.def.checkpoints;
	return { x: m.site.x + Math.cos(angle) * 8, y: m.site.y, z: m.site.z + Math.sin(angle) * 8 };
}

// What the Quests list shows of a contract (combat/contracts-view.js journal()).
const ROLE_PLURAL = { marksman: 'marksmen' };
function roleWords(roles) {
	const n = {};
	for (const r of roles) n[r] = (n[r] || 0) + 1;
	return Object.entries(n).map(([r, k]) => { const w = FIELD_ROLES[r].name.toLowerCase(); return k === 1 ? `a ${w}` : `${k === 2 ? 'two' : k} ${ROLE_PLURAL[r] || w + 's'}`; }).join(' and ');
}
// every step of a contract, in order (advanceContract above walks the same way)
export function contractSteps(d) {
	const list = [{ stage: 'travel', text: 'Reach the supply cache' }];
	for (let i = 0; i < (d.checkpoints || 0); i++) list.push({ stage: 'survey', text: `Inspect perimeter point ${i + 1} of ${d.checkpoints}` });
	d.waves.forEach((roles) => list.push({ stage: 'secure', text: `Drive off ${roleWords(roles)}` }));
	if (d.holdSeconds) list.push({ stage: 'hold', text: `Hold the clearing for ${d.holdSeconds} seconds` });
	list.push({ stage: 'recover', text: 'Take the cache’s weapon' }, { stage: 'return', text: 'Return to the rally point for payment' });
	return list;
}
// which of those steps a contract is on (the length of the list once it is complete)
export function contractCursor(m) {
	const c = m.def.checkpoints || 0, w = m.def.waves.length, h = m.def.holdSeconds ? 1 : 0;
	return { travel: 0, survey: 1 + m.checkpoint, secure: 1 + c + m.wave, hold: 1 + c + w, recover: 1 + c + w + h, return: 2 + c + w + h }[m.stage] ?? 3 + c + w + h;
}
