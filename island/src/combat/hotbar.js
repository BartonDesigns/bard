// The weapons on the keys 1 to 5. Each key holds one of your weapons: a field arm you own (an
// instance, by its uid) or something picked up in the world and carried (a bat, a pipe, a
// bottle, a knife, a machete: combat/melee.js, by its id). They fill the empty keys as you come
// by them, the field arms first, the best of each kind first, in the order of the field arms
// (combat/weapons.js), then what you have picked up; one sold, traded away, broken or dropped
// leaves its key. Press a key to take that weapon in hand; press it again to put it away.
// Pure but for the key handler in createHotbar.

import { WEAPONS } from './weapons.js';

export const HOT_SLOTS = 5;
const ORDER = Object.keys(WEAPONS);

// the keys' weapons from the inventory (arms state: { instances, hand }) and the keys as they
// were (uids, or null): those still owned stay where they are; the rest of your weapons fill
// the empty keys
// carried: what is picked up and carried (combat/melee.js carried(): { id, kind })
export function hotbarBinds(inv, prev = [], carried = []) {
	const own = [...Object.values(inv?.instances || {}).filter((x) => WEAPONS[x.i]), ...carried.map((q) => ({ u: q.id, i: q.kind, t: 0, l: 0, melee: true }))];
	const byU = new Map(own.map((x) => [x.u, x]));
	const has = new Set(own.map((x) => x.u));
	const binds = [...Array(HOT_SLOTS)].map((_, i) => (prev[i] && has.has(prev[i]) ? prev[i] : null));
	const bound = new Set(binds.filter(Boolean));
	// (each kind's best first, then the spares)
	const rank = (x) => (x.melee ? 100 : ORDER.indexOf(x.i));
	const rest = own.filter((x) => !bound.has(x.u)).sort((a, b) => rank(a) - rank(b) || b.t - a.t || b.l - a.l || (a.u < b.u ? -1 : 1));
	const seenKind = new Set(binds.filter(Boolean).map((u) => byU.get(u).i));
	const firsts = rest.filter((x) => !seenKind.has(x.i) && (seenKind.add(x.i), true)), spares = rest.filter((x) => !firsts.includes(x));
	for (const x of [...firsts, ...spares]) { const i = binds.indexOf(null); if (i < 0) break; binds[i] = x.u; }
	return binds;
}
// what pressing key i does: { hold: uid } to take it up, { hold: null } to put it away, or null;
// hand: what is in hand (a field arm's uid or a carried thing's id)
export function hotbarPress(binds, i, hand) {
	const u = binds[i];
	if (!u) return null;
	return { hold: u === hand ? null : u };
}
const MELEE_NAME = { bat: 'Bat', pipe: 'Pipe', bottle: 'Bottle', knife: 'Hunting knife', machete: 'Machete' };

// arms: crysis/arms-runtime.js; melee(): combat/melee.js (what is picked up and carried);
// store: { get(k), set(k, v) }; ok(): may the keys be used now
export function createHotbar({ arms, melee = () => null, store, ok = () => true, hint = () => {} }) {
	let binds = [];
	try { binds = JSON.parse(store.get('l99-hotbar') || '[]'); } catch { binds = []; }
	let sig = '';
	const carried = () => melee()?.carried?.() || [];
	function refresh() {
		const inv = arms.state();
		const next = hotbarBinds(inv, binds, carried()), s = next.join(',');
		if (s !== sig) { sig = s; binds = next; try { store.set('l99-hotbar', JSON.stringify(binds)); } catch { /* private mode */ } }
		return binds;
	}
	function press(i) {
		refresh();
		const inv = arms.state(), M = melee(), inHand = carried().find((q) => q.held)?.id || inv.hand, act = hotbarPress(binds, i, inHand);
		if (!act) { hint(`Nothing on ${i + 1}. Weapons you own, and what you pick up, fill the keys 1 to 5.`, 1600); return false; }
		const isMelee = (u) => u && !inv.instances?.[u];
		// put away: the field arm, or the carried thing (stowed)
		if (act.hold === null) {
			if (isMelee(inHand)) return !!M?.stow() || (hint('No room to stow it.', 1400), false);
			const r = arms.hold(null);
			return !(r && r.ok === false);
		}
		if (isMelee(act.hold)) {
			// (a field arm in hand is put away first)
			if (inv.hand) { const r = arms.hold(null); if (r && r.ok === false) { hint(r.message || 'You cannot put that away now.', 1600); return false; } }
			return !!M?.draw(act.hold);
		}
		// (what you were swinging is stowed as the field arm comes up: combat/melee.js)
		const r = arms.hold(act.hold);
		if (r && r.ok === false) { hint(r.message || 'You cannot take that up now.', 1600); return false; }
		return true;
	}
	function onKey(e) {
		if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || window._KEYS_PLAY_ON || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable || !ok()) return;
		const m = /^Digit([1-5])$/.exec(e.code);
		if (!m) return;
		if (press(+m[1] - 1)) e.preventDefault();
	}
	addEventListener('keydown', onKey);
	return {
		refresh, press,
		// what is on each key: { uid, id, name, held }
		slots() {
			const inv = arms.state(), C = carried();
			refresh();
			return binds.map((u) => {
				if (u && inv.instances[u]) return { uid: u, id: inv.instances[u].i, name: WEAPONS[inv.instances[u].i].name, held: inv.hand === u };
				const c = u && C.find((q) => q.id === u);
				return c ? { uid: u, id: c.kind, name: MELEE_NAME[c.kind] || c.kind, held: c.held, melee: true } : null;
			});
		},
		dispose() { removeEventListener('keydown', onKey); },
	};
}
