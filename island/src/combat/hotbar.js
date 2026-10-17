// The weapons on the keys 1 to 5. Each key holds one of your weapons (an instance, by its uid):
// the weapons you own fill the empty keys as you come by them, the best of each kind first, in
// the order of the field arms (combat/weapons.js); a weapon sold or traded away leaves its key.
// Press a key to take that weapon in hand; press it again to put it away. Pure but for the key
// handler in createHotbar.

import { WEAPONS } from './weapons.js';

export const HOT_SLOTS = 5;
const ORDER = Object.keys(WEAPONS);

// the keys' weapons from the inventory (arms state: { instances, hand }) and the keys as they
// were (uids, or null): those still owned stay where they are; the rest of your weapons fill
// the empty keys
export function hotbarBinds(inv, prev = []) {
	const own = Object.values(inv?.instances || {}).filter((x) => WEAPONS[x.i]);
	const has = new Set(own.map((x) => x.u));
	const binds = [...Array(HOT_SLOTS)].map((_, i) => (prev[i] && has.has(prev[i]) ? prev[i] : null));
	const bound = new Set(binds.filter(Boolean));
	// (each kind's best first, then the spares)
	const rest = own.filter((x) => !bound.has(x.u)).sort((a, b) => ORDER.indexOf(a.i) - ORDER.indexOf(b.i) || b.t - a.t || b.l - a.l || (a.u < b.u ? -1 : 1));
	const seenKind = new Set(binds.filter(Boolean).map((u) => inv.instances[u].i));
	const firsts = rest.filter((x) => !seenKind.has(x.i) && (seenKind.add(x.i), true)), spares = rest.filter((x) => !firsts.includes(x));
	for (const x of [...firsts, ...spares]) { const i = binds.indexOf(null); if (i < 0) break; binds[i] = x.u; }
	return binds;
}
// what pressing key i does: { hold: uid } to take it up, { hold: null } to put it away, or null
export function hotbarPress(binds, i, hand) {
	const u = binds[i];
	if (!u) return null;
	return { hold: u === hand ? null : u };
}

// arms: crysis/arms-runtime.js; store: { get(k), set(k, v) }; ok(): may the keys be used now
export function createHotbar({ arms, store, ok = () => true, hint = () => {} }) {
	let binds = [];
	try { binds = JSON.parse(store.get('l99-hotbar') || '[]'); } catch { binds = []; }
	let sig = '';
	function refresh() {
		const inv = arms.state();
		const next = hotbarBinds(inv, binds), s = next.join(',');
		if (s !== sig) { sig = s; binds = next; try { store.set('l99-hotbar', JSON.stringify(binds)); } catch { /* private mode */ } }
		return binds;
	}
	function press(i) {
		refresh();
		const inv = arms.state(), act = hotbarPress(binds, i, inv.hand);
		if (!act) { hint(`Nothing on ${i + 1}. Weapons you own fill the keys 1 to 5.`, 1600); return false; }
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
		slots() { const inv = arms.state(); refresh(); return binds.map((u) => (u && inv.instances[u] ? { uid: u, id: inv.instances[u].i, name: WEAPONS[inv.instances[u].i].name, held: inv.hand === u } : null)); },
		dispose() { removeEventListener('keydown', onKey); },
	};
}
