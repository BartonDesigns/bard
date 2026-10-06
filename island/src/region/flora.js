// The plants of the region round you, close by: the kit's own (flora: [form, weight]) grown
// in the cells of the latitude and longitude within a few hundred metres, in a dozen forms:
// conifers (heavy with snow in winter), broadleaf trees (turning in autumn, the cherries and
// plums in blossom in spring), palms, the flat-topped acacia, the baobab, the banyan on its
// prop roots, the rainforest's emergent giants on their buttresses, bamboo, bananas, ferns,
// tussocks and steppe grass, shrubs, cactus. The globe's woods (globetrees.js) are the
// forest at large; these are the region's signature at your feet. Never in a house or a
// lane, never in the water. The great trees the villages keep (a banyan's platform, a sacred
// tree, an old baobab: structures.js) stand here too, where the settlement puts them.
//
// They are built as the Bay's plants are (world/vegetation.js): bark and leaf-cluster cards,
// frond and blade strips, swaying, tinted per tree. Each form is a few instanced parts in two
// tiers, the whole plant close by and a lighter one further off, dissolving into each other
// and out at the edge (world/lodfade.js); made only for the forms the kit grows.

import * as THREE from 'three';
import { hardwood, conifer, shrub, palm, banana, fern, swayMaterial, Builder, tube, card, V } from '../world/vegetation.js';
import * as TX from '../world/textures.js';
import { addLodFade } from '../world/lodfade.js';
import { mulberry32 } from '../noise.js';

// each kit's word for a plant -> its form, its colour, its size (m), and for a broadleaf its crown
const FORM = {
	spruce: ['conifer', '#2e4a32', 14], pine: ['conifer', '#36502e', 13], larch: ['conifer', '#5a7a3a', 14], juniper: ['shrub', '#3a5236', 2.5], cypress: ['column', '#2e4430', 12],
	birch: ['broad', '#7a9a48', 11, 'weeping'], oak: ['broad', '#4e6a32', 13, 'oak'], lime: ['broad', '#58783a', 13, 'round'], apple: ['broad', '#5a7a3a', 5, 'oak'], maple: ['broad', '#5a7a32', 9, 'round'], cottonwood: ['broad', '#6a8a3a', 15, 'round'],
	neem: ['broad', '#4a6e2e', 10, 'round'], mango: ['broad', '#365a26', 11, 'oak'], citrus: ['broad', '#3e6a2e', 4, 'oak'], planetree: ['broad', '#5a7838', 15, 'round'], eucalyptus: ['broad', '#7a8a6a', 16, 'layered'], gum: ['broad', '#7a8a6a', 12, 'layered'],
	breadfruit: ['broad', '#3e6a2a', 10, 'oak'], olive: ['broad', '#7a8a62', 5, 'oak'], blossom: ['broad', '#5a7a3a', 7, 'oak'], banyan: ['banyan', '#3a5a26', 16], baobab: ['baobab', '#5a6a32', 14],
	datepalm: ['palm', '#5a7a3a', 13], coconut: ['palm', '#4a7a32', 15], palm: ['palm', '#4a7a32', 9], acacia: ['flattop', '#5a6a2e', 7], emergent: ['emergent', '#3a5a26', 38],
	bamboo: ['bamboo', '#6a8a3a', 9], banana: ['banana', '#4a8a32', 4], fern: ['fern', '#3a6a2a', 1.2], liana: ['fern', '#3a6a2a', 1.6], tea: ['shrub', '#2e5a26', 1],
	tussock: ['grass', '#8a8a5a', 0.5], steppegrass: ['grass', '#9a9a5a', 0.45], feathergrass: ['grass', '#b8b080', 0.6], savannagrass: ['grass', '#b8a05a', 0.9], spinifex: ['grass', '#a8a060', 0.7], ichu: ['grass', '#b8a868', 0.8], barley: ['grass', '#b8b070', 0.7],
	saltbush: ['shrub', '#8a9a7a', 1.2], sagebrush: ['shrub', '#8a9a80', 1], hedge: ['shrub', '#3e5e2e', 1.8], hibiscus: ['shrub', '#3e6a2a', 2], euphorbia: ['cactus', '#5a7a3a', 4, 'candelabra'], vine: ['shrub', '#5a7a32', 1.4],
	quinoa: ['shrub', '#a85a3a', 1.2], sugarcane: ['bamboo', '#7a9a48', 3], tamarisk: ['shrub', '#7a8a6a', 4], cactus: ['cactus', '#4a6a3a', 3, 'saguaro'], flowers: ['grass', '#8aa050', 0.4],
	// the villages' great trees and their garden beds (structures.js)
	sacredfig: ['banyan', '#34562a', 20], oldbaobab: ['baobab', '#5a6a32', 18],
	greens: ['shrub', '#4a7a32', 0.9],
};
// the colour each form's leaves are built in: a kit colour of this is no tint at all
const REF = { conifer: '#36502e', column: '#36502e', palm: '#4a7a32', banana: '#4a8a32', fern: '#3a6a2a', grass: '#9a9a5a', shrub: '#4a6a32', cactus: '#4a6a3a' };
// forms with a far tier (the rest are small, and simply fade out where they stop mattering)
const TALL = new Set(['broad', 'conifer', 'column', 'palm', 'flattop', 'baobab', 'banyan', 'emergent', 'bamboo']);
const LOW = new Set(['grass', 'fern']);

// ---------- the forms Builder makes here ----------
const BARK = new THREE.Color(0.62, 0.55, 0.47);
const leafC = (sh, k = [1, 1, 1]) => ({ r: 0.24 * sh * k[0], g: 0.38 * sh * k[1], b: 0.14 * sh * k[2] });
// a leaf card lying nearly flat, for the plates of an umbrella crown
function flatCard(b, c, size, r, color, sway) {
	const a = r() * 6.283, tx = (r() - 0.5) * 0.5, tz = (r() - 0.5) * 0.5, ca = Math.cos(a), sa = Math.sin(a), h = size / 2;
	const n = V(-tx, 1, -tz).normalize(), tone = 0.82 + r() * 0.36, col = { r: color.r * tone, g: color.g * tone, b: color.b * tone };
	const ids = [[-1, -1, 0, 0], [1, -1, 0.96, 0], [1, 1, 0.96, 0.96], [-1, 1, 0, 0.96]].map(([u, v, s, t]) => {
		const x = (u * ca - v * sa) * h, z = (u * sa + v * ca) * h;
		return b.vert(V(c.x + x, c.y + x * tx + z * tz, c.z + z), n, [s, t], col, sway);
	});
	b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
}
// a crown of rounded leaf clumps round centre c: per cards to a clump, darker toward the heart
function clumps(b, list, c, R, per, size, r, k) {
	for (const cl of list) {
		const out = cl.c.clone().sub(c).normalize();
		for (let i = 0; i < per; i++) {
			const dir = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().add(out.clone().multiplyScalar(0.6)).add(V(0, 0.3, 0)).normalize();
			const p = cl.c.clone().add(dir.clone().multiplyScalar(cl.rad * (0.45 + r() * 0.5)));
			const depth = Math.min(1, p.distanceTo(c) / R), sh = (0.4 + 0.6 * depth) * (0.62 + 0.38 * (dir.y * 0.5 + 0.5));
			card(b, p, size * (0.8 + r() * 0.45), r, leafC(sh, k), 0.75 + 0.25 * depth, c, dir.clone().multiplyScalar(0.65).add(p.clone().sub(c).normalize().multiplyScalar(0.35)).normalize());
		}
	}
}
// a ribbed, round-topped stem (a cactus): the rings swell and pinch round the ribs
function ribbed(b, path, rad, sides, ribs, color) {
	// close the top with a rounded cap
	const e = path[path.length - 1], d = e.clone().sub(path[path.length - 2]).normalize(), r0 = rad[rad.length - 1];
	const P = [...path, e.clone().add(d.clone().multiplyScalar(r0 * 0.45)), e.clone().add(d.clone().multiplyScalar(r0 * 0.8)), e.clone().add(d.clone().multiplyScalar(r0 * 0.97))];
	const Rr = [...rad, r0 * 0.88, r0 * 0.58, r0 * 0.2];
	let side = null;
	const rings = [];
	for (let k = 0; k < P.length; k++) {
		const dir = P[Math.min(P.length - 1, k + 1)].clone().sub(P[Math.max(0, k - 1)]).normalize();
		if (!side) side = Math.abs(dir.y) > 0.95 ? V(1, 0, 0) : dir.clone().cross(V(0, 1, 0)).normalize();
		else { side.sub(dir.clone().multiplyScalar(side.dot(dir))); if (side.lengthSq() < 1e-6) side = V(1, 0, 0); side.normalize(); }
		const up2 = side.clone().cross(dir).normalize(), ring = [];
		for (let s = 0; s <= sides; s++) {
			const a = s / sides * 6.2832, rib = Math.cos(a * ribs), n = side.clone().multiplyScalar(Math.cos(a)).add(up2.clone().multiplyScalar(Math.sin(a)));
			const tone = 0.8 + 0.2 * rib;
			ring.push(b.vert(P[k].clone().add(n.clone().multiplyScalar(Rr[k] * (1 + 0.09 * rib))), n.clone().add(V(0, 0.15, 0)).normalize(), [s / sides, k / P.length], { r: color.r * tone, g: color.g * tone, b: color.b * tone }, 0.02 * k / P.length));
		}
		rings.push(ring);
	}
	for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) { const a = rings[k][s], bb = rings[k][s + 1], c = rings[k + 1][s], dd = rings[k + 1][s + 1]; b.tri(a, c, bb); b.tri(bb, c, dd); }
}

// a cypress: a short trunk inside a dense dark spindle of foliage
function cypress(seed, far) {
	const r = mulberry32(seed), trunk = new Builder(), crown = new Builder(), H = 12 * (0.9 + r() * 0.2), W = H * (0.09 + r() * 0.03);
	tube(trunk, [V(0, -0.3, 0), V(0, H * 0.3, 0), V(0, H * 0.85, 0)], [0.22, 0.15, 0.05], far ? 4 : 6, BARK, (t) => t * 0.1);
	const n = far ? 30 : 110, size = far ? 2.6 : 1.5;
	for (let i = 0; i < n; i++) {
		const t = 0.06 + 0.94 * Math.pow(r(), 0.85), w = W * Math.pow(Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5 + 0.2), 0.7) * (1 - t * 0.75), a = r() * 6.283, d = w * (0.55 + r() * 0.45);
		const p = V(Math.cos(a) * d, H * t, Math.sin(a) * d), sh = 0.45 + 0.4 * (d / Math.max(w, 0.01)) + 0.15 * t;
		card(crown, p, size * (1 - t * 0.4), r, { r: 0.13 * sh, g: 0.22 * sh, b: 0.12 * sh }, 0.3 + 0.7 * t, V(0, p.y, 0), V(Math.cos(a), 0.4, Math.sin(a)).normalize());
	}
	return [trunk.geometry(), crown.geometry()];
}
// an acacia: a short trunk forking into limbs that hold up flat plates of leaves
function acacia(seed, far) {
	const r = mulberry32(seed), wood = new Builder(), leaf = new Builder(), H = 7 * (0.9 + r() * 0.25), W = H * (0.7 + r() * 0.2), la = r() * 6.28;
	const fork = V(Math.cos(la) * 0.4, H * 0.42, Math.sin(la) * 0.4);
	tube(wood, [V(0, -0.3, 0), V(0, H * 0.15, 0), V(fork.x * 0.6, H * 0.3, fork.z * 0.6), fork], [0.24, 0.18, 0.15, 0.12], far ? 4 : 6, BARK, (t) => t * 0.1);
	const nL = 3 + Math.floor(r() * 2), ends = [];
	for (let i = 0; i < nL; i++) {
		const a = i / nL * 6.283 + r() * 0.6, d = W * (0.35 + r() * 0.3), e = V(Math.cos(a) * d, H * (0.78 + r() * 0.08), Math.sin(a) * d);
		const m = fork.clone().lerp(e, 0.5).add(V(0, H * 0.06, 0));
		tube(wood, [fork.clone(), m, e], [0.1, 0.07, 0.035], far ? 3 : 5, BARK, (t) => 0.1 + t * 0.4);
		if (!far) for (let k = 0; k < 2; k++) { const b2 = a + (r() - 0.5) * 1.6, d2 = 0.8 + r() * 1.2; tube(wood, [m.clone().lerp(e, 0.6), V(e.x + Math.cos(b2) * d2, e.y + 0.1, e.z + Math.sin(b2) * d2)], [0.035, 0.015], 3, BARK, () => 0.5); }
		ends.push(e);
	}
	// the plates: one or two tiers over each limb end and a broad top, with air between
	const top = H * 0.86, per = far ? 6 : 22, size = far ? 2.6 : 1.5;
	for (const e of ends) for (let i = 0; i < per; i++) {
		const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.42, tier = r() < 0.7 ? 0 : -0.5;
		const p = V(e.x + Math.cos(a) * d, top + tier + (r() - 0.5) * 0.25 - d * 0.08, e.z + Math.sin(a) * d), sh = tier ? 0.6 : 0.8 + r() * 0.25;
		flatCard(leaf, p, size * (0.8 + r() * 0.5), r, leafC(sh, [1.05, 1, 0.9]), 0.6);
	}
	for (let i = 0; i < (far ? 4 : 14); i++) { const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.5; flatCard(leaf, V(Math.cos(a) * d, top + 0.25 + (r() - 0.5) * 0.2, Math.sin(a) * d), size * 1.1, r, leafC(0.9, [1.05, 1, 0.9]), 0.7); }
	return [wood.geometry(), leaf.geometry()];
}
// a baobab: a fat swollen trunk, stubby branches like roots in the sky, a few tufts of leaves
function baobab(seed, far) {
	const r = mulberry32(seed), wood = new Builder(), leaf = new Builder(), H = 14 * (0.9 + r() * 0.2), R = H * (0.15 + r() * 0.03);
	const BK = new THREE.Color(0.78, 0.7, 0.64), path = [], radii = [];
	for (const t of [0, 0.04, 0.15, 0.3, 0.45, 0.58, 0.66]) { path.push(V((r() - 0.5) * R * 0.1, H * t - (t ? 0 : 0.4), (r() - 0.5) * R * 0.1)); radii.push(R * (1.12 - 0.2 * t + 0.25 * Math.exp(-t * 25) - 0.9 * Math.max(0, t - 0.45))); }
	tube(wood, path, radii, far ? 7 : 14, BK, () => 0);
	const top = path[path.length - 1], nB = far ? 5 : 7 + Math.floor(r() * 3);
	for (let i = 0; i < nB; i++) {
		const a = i / nB * 6.283 + r() * 0.4, L = H * (0.18 + r() * 0.12), o = top.clone().add(V(Math.cos(a) * R * 0.3, -H * 0.03, Math.sin(a) * R * 0.3));
		const e = o.clone().add(V(Math.cos(a) * L, L * (0.35 + r() * 0.4), Math.sin(a) * L)), m = o.clone().lerp(e, 0.5).add(V(0, L * 0.12, 0));
		tube(wood, [o, m, e], [R * 0.3, R * 0.17, R * 0.06], far ? 4 : 6, BK, (t) => t * 0.2);
		const twigs = far ? 0 : 2;
		for (let k = 0; k < twigs; k++) { const b2 = a + (r() - 0.5) * 1.8, e2 = e.clone().add(V(Math.cos(b2) * L * 0.35, L * 0.25, Math.sin(b2) * L * 0.35)); tube(wood, [m.clone().lerp(e, 0.7), e2], [R * 0.06, R * 0.02], 4, BK, () => 0.4); card(leaf, e2.clone().add(V(0, 0.3, 0)), 2.2, r, leafC(0.85), 0.8, top); }
		for (let k = 0; k < (far ? 1 : 3); k++) card(leaf, e.clone().add(V((r() - 0.5) * 1.6, 0.4 + r() * 0.6, (r() - 0.5) * 1.6)), far ? 3.2 : 2.4, r, leafC(0.75 + r() * 0.3), 0.8, top);
	}
	return [wood.geometry(), leaf.geometry()];
}
// a banyan: a trunk of fused stems, long level limbs held up by prop roots, a vast low dome
function banyan(seed, far) {
	const r = mulberry32(seed), wood = new Builder(), leaf = new Builder(), H = 16 * (0.9 + r() * 0.2), W = H * (0.85 + r() * 0.2), BK = new THREE.Color(0.66, 0.6, 0.54);
	const nS = far ? 2 : 5;
	for (let i = 0; i < nS; i++) { const a = i / nS * 6.283 + r() * 0.5, d = H * 0.035; tube(wood, [V(Math.cos(a) * d * 1.8, -0.4, Math.sin(a) * d * 1.8), V(Math.cos(a) * d, H * 0.15, Math.sin(a) * d), V(Math.cos(a) * d * 0.6, H * 0.38, Math.sin(a) * d * 0.6)], [H * 0.04, H * 0.03, H * 0.022], far ? 5 : 7, BK, (t) => t * 0.05); }
	const c = V(0, H * 0.62, 0), nL = far ? 5 : 8, ends = [];
	for (let i = 0; i < nL; i++) {
		const a = i / nL * 6.283 + r() * 0.5, L = W * (0.55 + r() * 0.35), y0 = H * (0.34 + r() * 0.05), o = V(0, y0, 0);
		const e = V(Math.cos(a) * L, H * (0.42 + r() * 0.12), Math.sin(a) * L), m = o.clone().lerp(e, 0.5).add(V(0, H * 0.05, 0));
		tube(wood, [o, m, e], [H * 0.022, H * 0.014, H * 0.006], far ? 4 : 5, BK, (t) => t * 0.3);
		ends.push(e, m);
		// the prop roots: dropped from the limb into the ground, thickening into trunks of their own
		if (!far) for (const f of [0.45, 0.75]) { if (r() < 0.25) continue; const p = o.clone().lerp(e, f); p.y -= 0.2; tube(wood, [p, V(p.x + (r() - 0.5) * 0.3, p.y * 0.5, p.z + (r() - 0.5) * 0.3), V(p.x, -0.3, p.z)], [0.06, 0.08, 0.14 + r() * 0.1], 4, BK, () => 0); }
	}
	const list = ends.map((e) => ({ c: e.clone().add(V(0, H * 0.06, 0)), rad: H * 0.12 }));
	for (let i = 0; i < (far ? 6 : 14); i++) { const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.85; list.push({ c: V(Math.cos(a) * d, c.y + H * 0.08 * (1 - d / W) + (r() - 0.5) * H * 0.06, Math.sin(a) * d), rad: H * (0.1 + r() * 0.05) }); }
	clumps(leaf, list, c, W, far ? 2 : 6, far ? 5 : 3.2, r, [0.95, 1, 0.95]);
	for (let i = 0; i < (far ? 2 : 8); i++) card(leaf, c.clone().add(V((r() - 0.5) * W, (r() - 0.6) * H * 0.12, (r() - 0.5) * W)), 4, r, { r: 0.07, g: 0.12, b: 0.05 }, 0.6, c);
	return [wood.geometry(), leaf.geometry()];
}
// a fin of a buttress root: from the trunk high up, curving down to the ground
function fin(b, a, r0, h0, out, color) {
	const dir = V(Math.cos(a), 0, Math.sin(a)), side = V(-dir.z, 0, dir.x), th = 0.08, rows = [];
	for (let k = 0; k <= 6; k++) {
		const t = k / 6, x = r0 * 0.6 + (out - r0 * 0.6) * t, y = h0 * Math.pow(1 - t, 2.2);
		const lo = dir.clone().multiplyScalar(x * 0.7 + r0 * 0.3), hi = dir.clone().multiplyScalar(x).setY(y);
		rows.push([lo.setY(-0.3), hi]);
	}
	for (const s of [-1, 1]) {
		const n = side.clone().multiplyScalar(s), off = side.clone().multiplyScalar(s * th), ids = rows.map(([lo, hi], k) => [b.vert(lo.clone().add(off), n, [k / 6, 0], color, 0), b.vert(hi.clone().add(off), n, [k / 6, 0.5], color, 0)]);
		for (let k = 0; k < 6; k++) { const [a0, a1] = ids[k], [b0, b1] = ids[k + 1]; if (s > 0) { b.tri(a0, b0, a1); b.tri(a1, b0, b1); } else { b.tri(a0, a1, b0); b.tri(a1, b1, b0); } }
	}
}
// an emergent: a straight pale column far above the canopy, plank buttresses at its foot,
// a broad flat crown on a few great limbs
function emergent(seed, far) {
	const r = mulberry32(seed), wood = new Builder(), leaf = new Builder(), H = 38 * (0.9 + r() * 0.2), R0 = H * 0.017, BK = new THREE.Color(0.8, 0.76, 0.7);
	const top = V((r() - 0.5) * 1.2, H * 0.78, (r() - 0.5) * 1.2);
	tube(wood, [V(0, -0.3, 0), V(0, H * 0.05, 0), V(top.x * 0.3, H * 0.4, top.z * 0.3), top], [R0 * 1.4, R0 * 1.1, R0 * 0.85, R0 * 0.6], far ? 5 : 8, BK, (t) => t * 0.05);
	const nF = far ? 0 : 4 + Math.floor(r() * 2);
	for (let i = 0; i < nF; i++) fin(wood, i / nF * 6.283 + r() * 0.5, R0, H * (0.08 + r() * 0.05), H * (0.06 + r() * 0.04), BK);
	const W = H * (0.22 + r() * 0.06), c = top.clone().add(V(0, H * 0.1, 0)), list = [];
	for (let i = 0; i < (far ? 3 : 5); i++) {
		const a = i / 5 * 6.283 + r() * 0.6, e = top.clone().add(V(Math.cos(a) * W * 0.7, H * (0.08 + r() * 0.08), Math.sin(a) * W * 0.7));
		tube(wood, [top.clone(), top.clone().lerp(e, 0.5).add(V(0, H * 0.04, 0)), e], [R0 * 0.5, R0 * 0.32, R0 * 0.15], far ? 4 : 5, BK, (t) => 0.1 + t * 0.3);
		list.push({ c: e.clone().add(V(0, H * 0.03, 0)), rad: W * 0.35 });
	}
	for (let i = 0; i < (far ? 3 : 8); i++) { const a = r() * 6.283, d = Math.sqrt(r()) * W; list.push({ c: c.clone().add(V(Math.cos(a) * d, (r() - 0.3) * H * 0.04, Math.sin(a) * d)), rad: W * (0.25 + r() * 0.12) }); }
	clumps(leaf, list, c, W, far ? 3 : 8, far ? 6 : 4, r, [0.95, 1, 0.9]);
	return [wood.geometry(), leaf.geometry()];
}
// a clump of bamboo: thin green culms arching out from one root mass, feathered with sprays of leaves
function bamboo(seed, far) {
	const r = mulberry32(seed), culms = new Builder(), leaf = new Builder(), H = 9 * (0.9 + r() * 0.2), n = 12 + Math.floor(r() * 6);
	for (let i = 0; i < n; i++) {
		const a = r() * 6.283, d = Math.sqrt(r()) * 0.7, h = H * (0.65 + r() * 0.4), lean = 0.08 + r() * 0.2, pts = [], rad = [];
		const segs = far ? 3 : 6;
		for (let k = 0; k <= segs; k++) { const t = k / segs, o = d + lean * h * t * t; pts.push(V(Math.cos(a) * o, h * t - (k ? 0 : 0.3), Math.sin(a) * o)); rad.push(0.055 - 0.035 * t); }
		const tone = 0.85 + r() * 0.3;
		tube(culms, pts, rad, far ? 3 : 5, new THREE.Color(0.52 * tone, 0.6 * tone, 0.3 * tone), (t) => t * t * 1.1);
		const nL = far ? 3 : 7;
		for (let k = 0; k < nL; k++) {
			const t = 0.42 + 0.58 * (k + r()) / nL, o = d + lean * h * t * t;
			const p = V(Math.cos(a) * o + (r() - 0.5) * 0.8, h * t + (r() - 0.3) * 0.5, Math.sin(a) * o + (r() - 0.5) * 0.8);
			card(leaf, p, (far ? 2 : 1.3) * (0.8 + r() * 0.4), r, leafC(0.75 + 0.35 * t, [1.1, 1.05, 0.9]), 0.4 + t, V(0, p.y - 1, 0));
		}
	}
	return [culms.geometry(), leaf.geometry()];
}
// a tuft of grass: crossed cards of fine blades, splaying from a tight base
function tuft(seed) {
	const r = mulberry32(seed), b = new Builder(), n = 7;
	for (let i = 0; i < n; i++) {
		const a = i / n * 3.1416 + r() * 0.3, c = Math.cos(a), s = Math.sin(a), w = 0.32 + r() * 0.12, h = 0.8 + r() * 0.3, lean = (r() - 0.5) * 0.35;
		const ox = (r() - 0.5) * 0.12, oz = (r() - 0.5) * 0.12, nx = -s * lean, nz = c * lean, ids = [];
		const tone = 0.85 + r() * 0.25, col = { r: 0.62 * tone, g: 0.62 * tone, b: 0.38 * tone };
		for (let k = 0; k <= 2; k++) {
			const t = k / 2, spread = 0.55 + 0.45 * t, bow = lean * t * t;
			for (const u of [-1, 1]) ids.push(b.vert(V(ox + c * u * w * spread * 0.5 - s * bow, h * t * (1 - 0.1 * t), oz + s * u * w * spread * 0.5 + c * bow), V(nx, 1, nz).normalize(), [u * 0.5 + 0.5, t], col, t * t));
		}
		for (let k = 0; k < 2; k++) { b.tri(ids[k * 2], ids[k * 2 + 1], ids[k * 2 + 2]); b.tri(ids[k * 2 + 1], ids[k * 2 + 3], ids[k * 2 + 2]); }
	}
	return [b.geometry()];
}
// cactus: a saguaro (a column with a few upturned arms) or a candelabra euphorbia (many arms
// rising from a short trunk), smooth and ribbed, no leaves
function cactus(seed, kind) {
	const r = mulberry32(seed), b = new Builder(), C = new THREE.Color(0.3, 0.44, 0.27);
	if (kind === 'candelabra') {
		const H = 4 * (0.85 + r() * 0.3), T = H * 0.3, R = H * 0.05;
		tube(b, [V(0, -0.3, 0), V(0, T * 0.5, 0), V(0, T, 0)], [R * 1.1, R, R * 0.9], 8, new THREE.Color(0.45, 0.4, 0.3), () => 0);
		const n = 6 + Math.floor(r() * 4);
		for (let i = 0; i < n; i++) {
			const a = i / n * 6.283 + r() * 0.4, d = H * (0.12 + r() * 0.12), h = H * (0.7 + r() * 0.3), o = V(0, T * (0.8 + r() * 0.2), 0);
			ribbed(b, [o, V(Math.cos(a) * d * 0.7, o.y + H * 0.04, Math.sin(a) * d * 0.7), V(Math.cos(a) * d, o.y + H * 0.15, Math.sin(a) * d), V(Math.cos(a) * d, h, Math.sin(a) * d)], [R * 0.5, R * 0.55, R * 0.6, R * 0.55], 10, 4, C);
		}
	} else {
		const H = 3 * (0.85 + r() * 0.4), R = H * 0.085, pts = [], rad = [];
		for (let k = 0; k <= 5; k++) { pts.push(V(0, H * k / 5 - (k ? 0 : 0.3), 0)); rad.push(R * (1 - 0.12 * k / 5)); }
		ribbed(b, pts, rad, 16, 12, C);
		const nA = Math.floor(r() * 3.3);
		for (let i = 0; i < nA; i++) {
			const a = r() * 6.283, y = H * (0.35 + r() * 0.25), d = R * (2 + r() * 1.2), top = y + H * (0.2 + r() * 0.2), dir = V(Math.cos(a), 0, Math.sin(a));
			ribbed(b, [dir.clone().multiplyScalar(R * 0.3).setY(y), dir.clone().multiplyScalar(d * 0.7).setY(y + R * 0.15), dir.clone().multiplyScalar(d).setY(y + R * 1.2), dir.clone().multiplyScalar(d).setY(top)], [R * 0.6, R * 0.62, R * 0.65, R * 0.6], 12, 10, C);
		}
	}
	return [b.geometry()];
}

// each variant's parts and the materials they take
function build(key, seed, far, mid, snow) {
	const [form, sub] = key.split(':');
	switch (form) {
		case 'broad': return { parts: hardwood(seed, far, mid, { height: 10, crown: sub, bark: [1, 1, 1], leaf: [1, 1.04, 0.92] }).parts, mats: ['bark', 'leaf'] };
		case 'conifer': return { parts: conifer(seed, far, mid, { height: 18, bark: [0.82, 0.74, 0.68], leaf: [0.85, 1, 0.85], snow }).parts, mats: ['bark', 'leaf'] };
		case 'column': return { parts: cypress(seed, far), mats: ['bark', 'leaf'] };
		case 'palm': return { parts: palm(seed, far, { height: sub === 'date' ? 11 : 9, lean: sub === 'date' ? 0 : 0.8, frondTint: sub === 'date' ? [1.05, 0.95, 0.9] : [1, 1, 1], fronds: sub === 'date' ? 18 : 14 }).parts, mats: ['palmbark', 'frond'] };
		case 'flattop': return { parts: acacia(seed, far), mats: ['bark', 'leaf'] };
		case 'baobab': return { parts: baobab(seed, far), mats: ['bark', 'leaf'] };
		case 'banyan': return { parts: banyan(seed, far), mats: ['bark', 'leaf'] };
		case 'emergent': return { parts: emergent(seed, far), mats: ['bark', 'leaf'] };
		case 'bamboo': return { parts: bamboo(seed, far), mats: ['stem', 'leaf'] };
		case 'banana': return { parts: banana(seed).parts, mats: ['bstem', 'banana'] };
		case 'fern': return { parts: fern(seed).parts, mats: ['fern'] };
		case 'grass': return { parts: tuft(seed), mats: ['grass'] };
		case 'shrub': return { parts: shrub(seed).parts, mats: ['bark', 'leaf'] };
		case 'cactus': return { parts: cactus(seed, sub), mats: ['cactus'] };
	}
	return null;
}
const TINTED = new Set(['leaf', 'frond', 'banana', 'fern', 'grass', 'cactus']);

// the season's colour on a tree: blossom in spring, gold and red in autumn, bare in winter
function seasonal(word, base, C, culture) {
	const s = C?.season, c = new THREE.Color(base);
	if (word === 'blossom') { if (s === 'spring') return c.set(culture === 'japanese' || culture === 'korean' ? '#f2c6d2' : C.temp < 6 ? '#f4eef0' : '#f0bccb'); if (s === 'winter') return c.set('#6a5a4a'); }
	if (word === 'maple' && s === 'autumn') return c.set('#c8442a');
	if ((word === 'birch' || word === 'larch' || word === 'cottonwood' || word === 'lime') && s === 'autumn') return c.set('#c8a83a');
	if ((word === 'oak' || word === 'apple' || word === 'birch' || word === 'lime' || word === 'maple' || word === 'cottonwood') && s === 'winter') return c.set('#6a5e50');
	if (/grass|ichu|spinifex/.test(word) && (s === 'dry' || s === 'winter' || s === 'summer')) return c.lerp(new THREE.Color('#b8a868'), 0.6);
	return c;
}
// a kit colour as a tint on leaves built in the form's own colour (in sRGB terms, pushed a
// little so the hues carry, and held to a sane brightness)
const C0 = new THREE.Color(), C1 = new THREE.Color();
function tintOf(col, form, out) {
	C0.copy(col).convertLinearToSRGB(); C1.set(REF[form] || '#5a7a3a').convertLinearToSRGB();
	out.setRGB(Math.pow(C0.r / C1.r, 1.6), Math.pow(C0.g / C1.g, 1.6), Math.pow(C0.b / C1.b, 1.6));
	const l = out.r * 0.3 + out.g * 0.55 + out.b * 0.15, cap = 1.45;
	if (l > cap) out.multiplyScalar(cap / l);
	return out;
}

export function createFlora(scene, { ground, wet, blocked, isPhone = false, toLL, shared = null, extra = null }) {
	const group = new THREE.Group();
	group.name = 'regional plants';
	scene.add(group);
	// (the sway reads the wind's uniforms; with none given, a still day)
	const S = shared || { uTime: { value: 0 }, uWind: { value: 0 }, uBass: { value: 0 }, uGust: { value: 0 }, uWindT: { value: 0 } };
	const R = isPhone ? 200 : 300, NEAR = isPhone ? 80 : 130;
	// how far each small form is drawn (m), and how many of each part one mesh holds
	const REACH = { grass: isPhone ? 60 : 90, fern: isPhone ? 60 : 90, banana: isPhone ? 80 : 160, shrub: isPhone ? 150 : 220, cactus: R };
	const CAP = isPhone ? { near: 260, far: 500, low: 700 } : { near: 700, far: 1300, low: 1800 };
	const SEEDS = isPhone ? 1 : 2;

	// ---------- materials, made as first wanted ----------
	const tex = {};
	const texOf = (k) => tex[k] ||= k === 'bark' ? (() => { const t = TX.woodBark(); t.repeat.set(2, 3); return t; })() : k === 'palmbark' ? (() => { const t = TX.palmBark(); t.repeat.set(1, 7); return t; })()
		: { leaf: TX.leafCluster, frond: TX.palmFrond, banana: TX.bananaLeaf, fern: TX.fernFrond, grass: TX.grassStrip, bstem: TX.bananaStem }[k]();
	const PARAMS = {
		bark: () => [{ map: texOf('bark'), roughness: 0.95 }, 1],
		palmbark: () => [{ map: texOf('palmbark'), roughness: 0.9 }, 1],
		stem: () => [{ roughness: 0.7 }, 1],
		bstem: () => [{ map: texOf('bstem'), roughness: 0.7 }, 1],
		cactus: () => [{ roughness: 0.75 }, 0.2],
		leaf: () => [{ map: texOf('leaf'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, 0.8],
		frond: () => [{ map: texOf('frond'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }, 1],
		banana: () => [{ map: texOf('banana'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }, 1.2],
		fern: () => [{ map: texOf('fern'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }, 1.2],
		grass: () => [{ map: texOf('grass'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }, 1.2],
	};
	const mats = new Map();
	function matOf(name, band) {
		const k = name + '|' + band.join(',');
		let m = mats.get(k);
		if (!m) { const [p, stiff] = PARAMS[name](); m = swayMaterial(p, S, stiff); addLodFade(m.material, 'uniform', band); mats.set(k, m); }
		return m;
	}

	// ---------- the variants: a few seeds of each form, each in its tiers ----------
	const variants = new Map();
	function tierOf(parts, names, cap, band, shadow, tintAll) {
		return parts.map((g, n) => {
			const M = matOf(names[n], band), im = new THREE.InstancedMesh(g, M.material, cap);
			im.count = 0; im.castShadow = shadow; im.receiveShadow = true;
			if (shadow && M.depth) im.customDepthMaterial = M.depth;
			if (tintAll || TINTED.has(names[n])) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
			group.add(im);
			return im;
		});
	}
	function variantOf(key, kitId) {
		let v = variants.get(key);
		if (v) { v.kit = kitId; return v; }
		const form = key.split(':')[0], tall = TALL.has(form), low = LOW.has(form), snow = key.endsWith(':snow');
		const shadow = !isPhone && !low && form !== 'bamboo';
		const reach = tall ? R : REACH[form] || R;
		const nearBand = tall ? [-2, -1, NEAR - 25, NEAR] : [-2, -1, reach * 0.75, reach], farBand = [NEAR - 25, NEAR, R - 50, R];
		const seeds = tall || form === 'shrub' ? SEEDS : 1, models = [];
		for (let s = 0; s < seeds; s++) {
			const seed = 7301 + s * 37 + ([...key].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 0) >>> 0) % 997;
			const near = build(key, seed, false, isPhone, snow), far = tall ? build(key, seed, true, false, snow) : null;
			const H = Math.max(...near.parts.map((g) => (g.computeBoundingBox(), g.boundingBox.max.y))) || 1;
			models.push({ H, near: tierOf(near.parts, near.mats, low ? CAP.low : CAP.near, nearBand, shadow, false), far: far ? tierOf(far.parts, far.mats, CAP.far, farBand, false, false) : null });
		}
		v = { key, form, reach, models, kit: kitId };
		variants.set(key, v);
		return v;
	}
	function dropVariant(v) {
		for (const m of v.models) for (const t of [m.near, m.far]) if (t) for (const im of t) { group.remove(im); im.geometry.dispose(); im.dispose(); }
		variants.delete(v.key);
	}
	const keyOf = (word, form, sub, snow) => form === 'broad' ? 'broad:' + (sub || 'round') : form === 'conifer' ? (snow ? 'conifer:snow' : 'conifer') : form === 'palm' ? (word === 'datepalm' ? 'palm:date' : 'palm:coco') : form === 'cactus' ? 'cactus:' + (sub || 'saguaro') : form;

	let at = null;
	const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), TC = new THREE.Color();
	const DENS = { jungle: 2.2, island: 1, eastvillage: 1.1, southasia: 0.8, southcity: 0.15, eastcity: 0.15, bazaar: 0.2, mediterranean: 0.9, village: 0.9, farm: 0.4, alpine: 1, snow: 1, polar: 0.5, himalaya: 0.6, andes: 0.6, steppe: 1.6, savanna: 1.1, sahel: 0.6, desert: 0.25, pueblo: 0.5, outback: 0.7 };
	const counts = new Map();
	// one plant: into the tier(s) its distance puts it in
	function put(v, mi, d, x, y, z, yaw, size, word, base, C, culture, t) {
		const m = v.models[mi], s = size / m.H;
		Q.setFromAxisAngle(UP, yaw); SC.setScalar(s); M4.compose(P.set(x, y, z), Q, SC);
		const col = tintOf(seasonal(word, base, C, culture), v.form, TC);
		const tone = 0.85 + t * 0.3;
		col.multiplyScalar(tone);
		// (in autumn each tree turns in its own time: some still green)
		if (C?.season === 'autumn' && v.form === 'broad' && t < 0.35) col.lerp(tintOf(new THREE.Color(base), v.form, new THREE.Color()), 1 - t / 0.35);
		const tiers = m.far ? [[m.near, d < NEAR], [m.far, d > NEAR - 25]] : [[m.near, true]];
		for (const [T, on] of tiers) {
			if (!on) continue;
			const ck = T[0].uuid, k = counts.get(ck) || 0;
			if (k >= T[0].instanceMatrix.count) continue;
			counts.set(ck, k + 1);
			for (const im of T) { im.setMatrixAt(k, M4); if (im.instanceColor) col.toArray(im.instanceColor.array, k * 3); }
		}
	}
	function layout(cx, cz, kit, C, culture) {
		counts.clear();
		const snow = (C?.snow || 0) > 0.5;
		const flora = kit.flora || [], tot = flora.reduce((a, b) => a + b[1], 0), dens = DENS[kit.id] ?? 0.8;
		const S16 = 16, K = Math.ceil(R / S16), ll = toLL(cx, cz);
		const dl = S16 / 111000, dn = S16 / (111000 * Math.max(0.05, Math.cos(ll.lat * Math.PI / 180)));
		const i0 = Math.floor(ll.lat / dl), j0 = Math.floor(ll.lon / dn);
		const used = new Set();
		if (tot) for (let a = -K; a <= K; a++) for (let b = -K; b <= K; b++) {
			let h = (Math.imul(i0 + a, 73856093) ^ Math.imul(j0 + b, 19349663)) >>> 0;
			const r = () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
			let n = Math.floor(dens + r());
			while (n-- > 0) {
				let x = r() * tot, word = flora[0][0];
				for (const [w, wt] of flora) { if ((x -= wt) < 0) { word = w; break; } }
				const F = FORM[word];
				if (!F) continue;
				const [form, base, size, sub] = F;
				const lat = (i0 + a + r()) * dl, lon = (j0 + b + r()) * dn, mi = r(), yaw = r() * Math.PI * 2, t = r(), sz = size * (0.6 + r() * 0.7);
				const dx = (lon - ll.lon) * 111000 * Math.cos(ll.lat * Math.PI / 180), dz = -(lat - ll.lat) * 111000, d = Math.hypot(dx, dz);
				const v = variantOf(keyOf(word, form, sub, snow), kit.id);
				if (d > v.reach) continue;
				// (grass and ferns come in drifts of a few tufts)
				const nT = LOW.has(form) ? (isPhone ? 1 : 3) + Math.floor(t * 3) : 1;
				for (let q = 0; q < nT; q++) {
					const px = cx + dx + (q ? (r() - 0.5) * 4 : 0), pz = cz + dz + (q ? (r() - 0.5) * 4 : 0);
					if (wet(px, pz) || blocked(px, pz, LOW.has(form) ? 1 : Math.max(3, size * 0.45))) continue;
					const y = ground(px, pz), e = 3, s = Math.max(Math.abs(ground(px + e, pz) - y), Math.abs(ground(px, pz + e) - y)) / e;
					if (s > 0.8) continue;
					put(v, Math.floor(mi * v.models.length), d, px, y - 0.1, pz, yaw + q * 2.1, sz * (q ? 0.7 + r() * 0.5 : 1), word, base, C, culture, t);
				}
				used.add(v.key);
			}
		}
		// the villages' own great trees, where they stand
		for (const T of extra?.() || []) {
			const F = FORM[T.word], d = Math.hypot(T.x - cx, T.z - cz);
			if (!F || d > R || wet(T.x, T.z)) continue;
			const v = variantOf(keyOf(T.word, F[0], F[3], snow), kit.id);
			put(v, 0, d, T.x, ground(T.x, T.z) - 0.1, T.z, T.yaw || 0, T.size || F[2], T.word, F[1], C, culture, 0.6);
			used.add(v.key);
		}
		// what this kit no longer grows is let go
		for (const v of [...variants.values()]) if (!used.has(v.key) && v.kit !== kit.id) dropVariant(v);
		for (const v of variants.values()) for (const m of v.models) for (const T of [m.near, m.far]) {
			if (!T) continue;
			const n = counts.get(T[0].uuid) || 0;
			for (const im of T) {
				im.count = n; im.visible = n > 0;
				im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
				if (n) { im.boundingSphere = null; im.computeBoundingSphere(); im.boundingSphere.radius += 2; }
			}
		}
	}
	function update(cam, { kit, climate, culture, on = true, epoch = 0 }) {
		group.visible = on && !!kit;
		if (!group.visible) { at = null; return; }
		const x = cam.position.x, z = cam.position.z, key = kit.id + ':' + climate?.season + ':' + (climate?.snow > 0.5) + ':' + epoch;
		if (!at || Math.hypot(x - at[0], z - at[1]) > 60 || at[2] !== key) {
			at = [x, z, key];
			layout(x, z, kit, climate, culture);
		}
	}
	function dispose() {
		scene.remove(group);
		for (const v of [...variants.values()]) dropVariant(v);
		for (const m of mats.values()) { m.material.dispose(); m.depth?.dispose(); }
		for (const t of Object.values(tex)) t.dispose();
	}
	const info = () => {
		const o = {};
		for (const v of variants.values()) for (const m of v.models) { const n = m.near[0].count + (m.far ? m.far[0].count : 0); if (n) o[v.form] = (o[v.form] || 0) + n; }
		return o;
	};
	return { update, dispose, info };
}
