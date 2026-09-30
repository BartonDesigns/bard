// Someone fading in or out (0 gone .. 1 there), so nobody pops into being or out of it in
// plain sight. Their own materials (skin, clothes, hair) dissolve by a stochastic alpha,
// which needs no sorting; the small shared things (eyes, lashes and brows, bits and pieces)
// go while faint.
export function fadePerson(P, k) {
	k = Math.max(0, Math.min(1, k));
	const on = k < 0.999;
	if (P.fadeK === k && k >= 0.6) return;
	P.fadeK = k;
	for (const m of [P.skin?.material, P.cloth?.material, P.hair?.material]) {
		if (!m) continue;
		if (m.alphaHash !== on) { m.alphaHash = on; m.needsUpdate = true; }
		m.opacity = on ? k : 1;
	}
	// (shown again by P.lod as they come near)
	if (k < 0.6) { for (const e of P.eyes || []) e.visible = false; if (P.acc) P.acc.visible = false; if (P.detail) P.detail.visible = false; }
	P.root.visible = k > 0.01;
}
