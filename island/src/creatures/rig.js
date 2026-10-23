// A creature's body as solid pieces, for when it goes limp (people/ragdoll.js takes them):
// which of its bones become a piece, how heavy each is, what it hangs from, and which joints
// are hinges. Read off the rig that came with the model (creatures/models.js meta: the bones,
// their joint lines in model space and their flesh's radius), so every kind made by
// tools/monsters gets its ragdoll without a hand-made table: the hound's legs fold at the
// knees, its neck and tail flop, the goblin's arms swing.
//
// Pure: no three, no DOM.

const LIMB_END = /^(rider_)?(shin|forearm|foot|hand|toe|arm2b)_|^leg\db_/;   // the lower half of a limb: a hinge
const LIMB_MID = /^(rider_)?(shin|forearm|arm2b)_|^leg\db_/;                   // (the knee's and the elbow's own piece)
const TRUNK = /^(rider_)?(hips|spine|chest|abdomen)/;
const HEAD = /^(rider_)?(neck|head)/;
const LIMB_TOP = /^(rider_)?(thigh|upperarm|arm2)_|^leg\da_|^wing/;

// pieces(meta, parentOf, { scale, max }) -> { pieces: [{ n, up, r, m, hinge, tone, len }], mass, root }
//   parentOf(name)  the bone a bone hangs from (null at the root)
//   scale           the body's scale in the world (creatures/models.js vary(): its size)
//   max             how many pieces at most (the smallest are left to ride their parents: ears, toes)
// The pieces come parent first. m is each piece's share of the whole (they sum to 1); the mass
// is the whole body's, in kg, from the flesh the capsules hold.
export function ragdollPieces(meta, parentOf, { scale = 1, max = 22 } = {}) {
	const J = meta.joints || {}, Rr = meta.radii || {}, props = new Set(meta.props || []);
	const spider = meta.rig === 'spider';
	const all = [];
	for (const n of meta.bones || []) {
		if (props.has(n)) continue;
		const j = J[n];
		if (!j) continue;
		const len = Math.hypot(j[1][0] - j[0][0], j[1][1] - j[0][1], j[1][2] - j[0][2]) * scale;
		const r = Math.max(0.02, (Rr[n] || 0.08) * scale);
		// (a capsule's flesh: the barrel and its two caps)
		all.push({ n, len, r, vol: Math.PI * r * r * (len + r * 4 / 3) });
	}
	if (!all.length) return { pieces: [], mass: 0, root: null };
	// the root: the first bone with no parent among the body's own (the hips)
	const names = new Set(all.map((p) => p.n));
	const up = (n) => { let p = parentOf(n); while (p && !names.has(p)) p = parentOf(p); return p || null; };
	const root = all.find((p) => !up(p.n)) || all[0];
	// the ones that matter make the cut (the trunk and the head, then the legs from the top
	// down, before ears, manes, tails and cloaks), the biggest of each first; what is left rides
	// its parent as it was posed
	const rank = (n) => (TRUNK.test(n) || HEAD.test(n) || LIMB_TOP.test(n) ? 3 : LIMB_MID.test(n) ? 2.5 : LIMB_END.test(n) ? 1 : /tail1/.test(n) ? 1.2 : 0.5) * (/^rider_/.test(n) ? 0.6 : 1);
	const keep = new Set([root.n]);
	for (const p of [...all].sort((a, b) => b.vol * rank(b.n) - a.vol * rank(a.n))) { if (keep.size >= max) break; keep.add(p.n); }
	const kept = all.filter((p) => keep.has(p.n));
	const upKept = (n) => { let p = parentOf(n); while (p && !keep.has(p)) p = parentOf(p); return p && p !== n ? p : null; };
	const total = kept.reduce((a, p) => a + p.vol, 0);
	// (nothing too light for the solver, a piece weighs at least a fiftieth of the body, and
	// nothing so heavy the rest are dragged about by it: a robe's great capsule)
	let shares = kept.map((p) => Math.max(0.02, p.vol / total));
	for (let pass = 0; pass < 3; pass++) {
		const sum = shares.reduce((a, b) => a + b, 0);
		shares = shares.map((m) => Math.min(0.45, m / sum));
	}
	const sum = shares.reduce((a, b) => a + b, 0);
	shares = shares.map((m) => m / sum);
	const pieces = kept.map((p, i) => {
		const u = p.n === root.n ? null : upKept(p.n) || root.n;
		const hinge = u && LIMB_END.test(p.n) ? (spider ? 'z' : 'x') : null;
		const tone = TRUNK.test(p.n) ? 1 : HEAD.test(p.n) ? 0.7 : /^(robe|cloak|mane)/.test(p.n) ? 0.6 : LIMB_TOP.test(p.n) ? 0.5 : /tail/.test(p.n) ? 0.3 : 0.4;
		return { n: p.n, up: u, r: p.r, m: shares[i], hinge, tone, len: p.len };
	});
	// parent first, so a chain is built and posed from the hips out
	const order = [], seen = new Set();
	const byName = new Map(pieces.map((p) => [p.n, p]));
	const visit = (p) => { if (seen.has(p.n)) return; if (p.up) visit(byName.get(p.up)); seen.add(p.n); order.push(p); };
	for (const p of pieces) visit(p);
	// flesh at about half water (fur, air in the chest, the capsules a little generous)
	const mass = Math.max(8, total * 450);
	return { pieces: order, mass, root: root.n };
}
