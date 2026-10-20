// A body's build past what the base mesh's targets give (people/body.js): its muscle target
// fills every part out at once, which reads as puffed up, not strong. A build reshapes the
// frame instead: the shoulders broadened (the arms carried out with them whole, by how much
// each vertex belongs to an arm, so nothing bends), the chest and back widening up to them,
// and the waist drawn in: the V of the hero (people/hero.js); fuller arms; a smaller head (a hero stands
// near eight heads tall, the base mesh nearer seven), scaled about the top of the neck so it
// stays on it; and longer legs (all below the hip drawn down, and the whole then scaled back to
// its height, so the trunk and the head are a little shorter). In the shape's own units,
// before it is scaled to its height; the bones, the clothes and the hair are all fitted to it
// afterwards. Pure (tools/hero.test.mjs).

import { smoothstep as sstep } from '../noise.js';

const ARM = /^(upperarm|lowerarm|wrist|metacarpal|finger)/;

// p: positions (x across the body, y up), A: { bones: [{ name }], ids, weights } (4 per vertex);
// build: { shoulders: each side out by this share of the height, waist: drawn in by this share,
// head: its size changed by this share (-0.05 smaller), legs: longer by this share, arms:
// [upper arm, forearm] fuller by these shares at their fullest }
export function shapeBuild(p, A, build) {
	if (!build || (!build.shoulders && !build.waist && !build.head && !build.legs && !build.arms)) return;
	const n = p.length / 3;
	let min = Infinity, top = -Infinity;
	for (let i = 1; i < p.length; i += 3) { min = Math.min(min, p[i]); top = Math.max(top, p[i]); }
	const H = top - min, S = (build.shoulders || 0) * H, W = build.waist || 0;
	// (how much each bone is the arm: the clavicle half, the shoulder mostly)
	const armK = A.bones.map((b) => (ARM.test(b.name) ? 1 : /^shoulder01/.test(b.name) ? 0.85 : /^clavicle/.test(b.name) ? 0.5 : 0));
	for (let v = 0; v < n; v++) {
		let sw = 0, aw = 0;
		for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; sw += w; aw += w * armK[A.ids[v * 4 + q]]; }
		const a = sw ? aw / sw : 0, x = p[v * 3], h = (p[v * 3 + 1] - min) / H, side = x < 0 ? -1 : 1;
		// the chest and back widen toward the shoulders (not the neck), more at the sides
		const band = sstep(0.6, 0.78, h) * (1 - sstep(0.84, 0.88, h)), edge = Math.min(1, Math.abs(x) / (0.12 * H));
		const nx = x + side * S * (a + (1 - a) * band * edge);
		// the waist drawn in, front to back a little too
		const wb = (1 - a) * Math.exp(-(((h - 0.585) / 0.05) ** 2)) * W;
		p[v * 3] = nx * (1 - wb);
		p[v * 3 + 2] *= 1 - wb * 0.5;
	}
	if (build.arms) {
		// the arms filled out about their own bones, each part by how much it belongs to them: the
		// upper arm fullest at its middle (the biceps and triceps), the forearm a third of the way
		// down (its muscles near the elbow), nothing at the joints, so nothing seams: more arm, not
		// more of everything
		const joint = (name) => {
			const ids = A.bones.find((b) => b.name === name)?.ids || [];
			if (!ids.length) return null;
			const c = [0, 0, 0];
			for (const id of ids) for (let k = 0; k < 3; k++) c[k] += p[id * 3 + k] / ids.length;
			return c;
		};
		for (const side of ['L', 'R']) {
			const sh = joint('upperarm01.' + side), el = joint('lowerarm01.' + side), wr = joint('wrist.' + side);
			if (!sh || !el || !wr) continue;
			const segs = [[sh, el, build.arms[0] || 0, /^upperarm0[12]\./, (t) => Math.sin(Math.PI * t)], [el, wr, build.arms[1] || 0, /^lowerarm0[12]\./, (t) => Math.sin(Math.PI * t ** 0.6)]];
			for (const [a, b, g, re, prof] of segs) {
				if (!g) continue;
				const own = A.bones.map((q) => re.test(q.name) && q.name.endsWith('.' + side));
				const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz || 1;
				for (let v = 0; v < n; v++) {
					let sw = 0, bw = 0;
					for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; sw += w; if (own[A.ids[v * 4 + q]]) bw += w; }
					if (!bw) continue;
					const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2], t = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / l2;
					if (t <= 0 || t >= 1) continue;
					const k = g * (bw / sw) * prof(t), cx = a[0] + dx * t, cy = a[1] + dy * t, cz = a[2] + dz * t;
					p[v * 3] = cx + (x - cx) * (1 + k); p[v * 3 + 1] = cy + (y - cy) * (1 + k); p[v * 3 + 2] = cz + (z - cz) * (1 + k);
				}
			}
		}
	}
	if (build.head) {
		// the head (and half the neck) scaled about the neck's top: its bone's joint
		const hb = A.bones.findIndex((b) => b.name === 'head'), nb = A.bones.findIndex((b) => b.name === 'neck01');
		const piv = [0, 0, 0], ids = A.bones[hb]?.ids || [];
		for (const id of ids) for (let c = 0; c < 3; c++) piv[c] += p[id * 3 + c] / (ids.length || 1);
		if (ids.length) for (let v = 0; v < n; v++) {
			let sw = 0, hw = 0;
			for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q], b = A.ids[v * 4 + q]; sw += w; hw += b === hb ? w : b === nb ? w * 0.5 : 0; }
			const k = 1 + build.head * (sw ? hw / sw : 0);
			if (k !== 1) for (let c = 0; c < 3; c++) p[v * 3 + c] = piv[c] + (p[v * 3 + c] - piv[c]) * k;
		}
	}
	if (build.legs) {
		// all below the hip drawn down (the feet stay on the ground: the shape is lifted after)
		const hipY = min + 0.5 * H;
		for (let v = 0; v < n; v++) { const y = p[v * 3 + 1]; p[v * 3 + 1] = y < hipY ? hipY - (hipY - y) * (1 + build.legs) : y; }
	}
}
