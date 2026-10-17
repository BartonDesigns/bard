// A body's build past what the base mesh's targets give (people/body.js): its muscle target
// fills every part out at once, which reads as puffed up, not strong. A build reshapes the
// frame instead: the shoulders broadened (the arms carried out with them whole, by how much
// each vertex belongs to an arm, so nothing bends), the chest and back widening up to them,
// and the waist drawn in: the V of the hero (people/hero.js). In the shape's own units,
// before it is scaled to its height; the bones, the clothes and the hair are all fitted to it
// afterwards. Pure (tools/hero.test.mjs).

const ARM = /^(upperarm|lowerarm|wrist|metacarpal|finger)/;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// p: positions (x across the body, y up), A: { bones: [{ name }], ids, weights } (4 per vertex);
// build: { shoulders: each side out by this share of the height, waist: drawn in by this share }
export function shapeBuild(p, A, build) {
	if (!build || (!build.shoulders && !build.waist)) return;
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
}
