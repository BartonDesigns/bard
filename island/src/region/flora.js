// The plants of the region round you, close by: the kit's own (flora: [form, weight]) grown
// in the cells of the latitude and longitude within a few hundred metres, as instanced
// shapes in a dozen forms: conifers (heavy with snow in winter), broadleaf trees (turning in
// autumn, the cherries and plums in blossom in spring), palms, the flat-topped acacia, the
// baobab, the rainforest's emergent giants on their buttresses, bamboo, bananas, ferns,
// tussocks and steppe grass, shrubs, cactus. The globe's woods (globetrees.js) are the
// forest at large; these are the region's signature at your feet. Never in a house or a
// lane, never in the water.

import * as THREE from 'three';
import { Geo, shade } from './geo.js';

// each kit's word for a plant -> its form, its colour, its size (m)
const FORM = {
	spruce: ['conifer', '#2e4a32', 14], pine: ['conifer', '#36502e', 13], larch: ['conifer', '#5a7a3a', 14], juniper: ['shrub', '#3a5236', 2.5], cypress: ['column', '#2e4430', 12],
	birch: ['broad', '#7a9a48', 11], oak: ['broad', '#4e6a32', 13], lime: ['broad', '#58783a', 13], apple: ['broad', '#5a7a3a', 5], maple: ['broad', '#5a7a32', 9], cottonwood: ['broad', '#6a8a3a', 15],
	neem: ['broad', '#4a6e2e', 10], mango: ['broad', '#365a26', 11], citrus: ['broad', '#3e6a2e', 4], planetree: ['broad', '#5a7838', 15], eucalyptus: ['broad', '#7a8a6a', 16], gum: ['broad', '#7a8a6a', 12],
	breadfruit: ['broad', '#3e6a2a', 10], olive: ['broad', '#7a8a62', 5], blossom: ['broad', '#5a7a3a', 7], banyan: ['banyan', '#3a5a26', 16], baobab: ['baobab', '#5a6a32', 14],
	datepalm: ['palm', '#5a7a3a', 13], coconut: ['palm', '#4a7a32', 15], palm: ['palm', '#4a7a32', 9], acacia: ['flattop', '#5a6a2e', 7], emergent: ['emergent', '#3a5a26', 38],
	bamboo: ['bamboo', '#6a8a3a', 9], banana: ['banana', '#4a8a32', 4], fern: ['fern', '#3a6a2a', 1.2], liana: ['fern', '#3a6a2a', 1.6], tea: ['shrub', '#2e5a26', 1],
	tussock: ['grass', '#8a8a5a', 0.5], steppegrass: ['grass', '#9a9a5a', 0.45], feathergrass: ['grass', '#b8b080', 0.6], savannagrass: ['grass', '#b8a05a', 0.9], spinifex: ['grass', '#a8a060', 0.7], ichu: ['grass', '#b8a868', 0.8], barley: ['grass', '#b8b070', 0.7],
	saltbush: ['shrub', '#8a9a7a', 1.2], sagebrush: ['shrub', '#8a9a80', 1], hedge: ['shrub', '#3e5e2e', 1.8], hibiscus: ['shrub', '#3e6a2a', 2], euphorbia: ['cactus', '#5a7a3a', 4], vine: ['shrub', '#5a7a32', 1.4],
	quinoa: ['shrub', '#a85a3a', 1.2], sugarcane: ['bamboo', '#7a9a48', 3], tamarisk: ['shrub', '#7a8a6a', 4], cactus: ['cactus', '#4a6a3a', 3], flowers: ['grass', '#8aa050', 0.4],
};
const FORMS = ['conifer', 'column', 'broad', 'banyan', 'baobab', 'palm', 'flattop', 'emergent', 'bamboo', 'banana', 'fern', 'grass', 'shrub', 'cactus'];

// the shapes, unit-sized (about 1 m tall; scaled by size), coloured grey-green so the tint sets the hue
function shape(form, snowy) {
	const g = new Geo(), bark = [0.42, 0.34, 0.26], leaf = [0.85, 0.9, 0.8], snow = [1.3, 1.3, 1.35];
	g.jit = 0.12;
	switch (form) {
		case 'conifer':
			g.cyl(0, 0, 0, 0.035, 0.02, 0.25, bark, { n: 5 });
			for (let k = 0; k < 4; k++) { const y = 0.15 + k * 0.2, r = 0.3 - k * 0.06; g.cyl(0, y, 0, r, 0.02, 0.3, leaf, { n: 7, top: false }); if (snowy) g.cyl(0, y + 0.12, 0, r * 0.6, 0.02, 0.18, snow, { n: 7, top: false }); }
			break;
		case 'column': g.cyl(0, 0, 0, 0.03, 0.03, 0.1, bark, { n: 5 }); g.cyl(0, 0.08, 0, 0.12, 0.02, 0.92, leaf, { n: 7, top: false }); break;
		case 'broad':
			g.cyl(0, 0, 0, 0.045, 0.03, 0.45, bark, { n: 5 });
			g.dome(0, 0.35, 0, 0.38, leaf, { k: 0.9, n: 8, rings: 3 }).dome(0.15, 0.45, 0.1, 0.25, shade(leaf, 0.9), { k: 1, n: 7, rings: 2 }).dome(-0.12, 0.5, -0.1, 0.22, shade(leaf, 1.05), { k: 1, n: 7, rings: 2 });
			break;
		case 'banyan': g.cyl(0, 0, 0, 0.12, 0.08, 0.5, bark, { n: 7 }); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.cyl(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35, 0.02, 0.02, 0.5, bark, { n: 4 }); } g.dome(0, 0.45, 0, 0.6, leaf, { k: 0.5, n: 10, rings: 3 }); break;
		case 'baobab': g.cyl(0, 0, 0, 0.16, 0.11, 0.65, [0.6, 0.52, 0.44], { n: 8 }); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.beam(0, 0.62, 0, Math.cos(a) * 0.28, 0.85, Math.sin(a) * 0.28, 0.05, [0.58, 0.5, 0.42]); } g.dome(0, 0.8, 0, 0.32, leaf, { k: 0.4, n: 8, rings: 2 }); break;
		case 'palm': {
			let px = 0, py = 0;
			for (let k = 0; k < 6; k++) { const nx = (k + 1) * 0.012 * (k + 1) * 0.3, ny = (k + 1) / 6 * 0.92; g.beam(px, py, 0, nx, ny, 0, 0.035, [0.6, 0.53, 0.43]); px = nx; py = ny; }
			for (let f = 0; f < 9; f++) { const a = f * 2.39996, d = 0.32, ex = px + Math.cos(a) * d, ez = Math.sin(a) * d; g.face([[px, py, 0], [ex + Math.sin(a) * 0.05, py - 0.08, ez - Math.cos(a) * 0.05], [ex * 1.3 - px * 0.3, py - 0.22, ez * 1.3], [ex - Math.sin(a) * 0.05, py - 0.08, ez + Math.cos(a) * 0.05]], leaf); }
			break;
		}
		case 'flattop': g.beam(0, 0, 0, 0.05, 0.55, 0.02, 0.04, bark).beam(0.05, 0.5, 0.02, -0.2, 0.75, 0, 0.025, bark).beam(0.05, 0.5, 0.02, 0.25, 0.78, 0.05, 0.025, bark); g.dome(0, 0.72, 0, 0.55, leaf, { k: 0.22, n: 10, rings: 2 }); break;
		case 'emergent':
			g.cyl(0, 0, 0, 0.03, 0.02, 0.85, [0.6, 0.55, 0.48], { n: 6 });
			for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.4; g.face([[0, 0.12, 0], [Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09], [0, 0, 0]], [0.55, 0.5, 0.42]); }
			g.dome(0, 0.8, 0, 0.28, leaf, { k: 0.4, n: 9, rings: 2 }).dome(0.18, 0.78, 0.05, 0.16, shade(leaf, 0.9), { k: 0.5, n: 7, rings: 2 });
			break;
		case 'bamboo': for (let i = 0; i < 8; i++) { const a = i * 2.4, r = 0.04 + (i % 3) * 0.03, x = Math.cos(a) * r, z = Math.sin(a) * r; g.beam(x, 0, z, x * 3, 1, z * 3, 0.012, [0.62, 0.7, 0.4]); g.dome(x * 3, 0.9, z * 3, 0.1, leaf, { k: 1.4, n: 5, rings: 2 }); } break;
		case 'banana': g.cyl(0, 0, 0, 0.08, 0.06, 0.45, [0.5, 0.58, 0.32], { n: 6 }); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.sheet([[0, 0.45, 0], [Math.cos(a) * 0.45 - Math.sin(a) * 0.12, 0.7, Math.sin(a) * 0.45 + Math.cos(a) * 0.12], [Math.cos(a) * 0.62, 0.6, Math.sin(a) * 0.62], [Math.cos(a) * 0.45 + Math.sin(a) * 0.12, 0.7, Math.sin(a) * 0.45 - Math.cos(a) * 0.12]], leaf); } break;
		case 'fern': for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; g.sheet([[0, 0.05, 0], [Math.cos(a) * 0.5 - Math.sin(a) * 0.1, 0.65, Math.sin(a) * 0.5 + Math.cos(a) * 0.1], [Math.cos(a) * 0.95, 0.35, Math.sin(a) * 0.95], [Math.cos(a) * 0.5 + Math.sin(a) * 0.1, 0.65, Math.sin(a) * 0.5 - Math.cos(a) * 0.1]], leaf); } break;
		case 'grass': for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28, r = 0.25; g.sheet([[Math.cos(a) * 0.05 - Math.sin(a) * 0.03, 0, Math.sin(a) * 0.05 + Math.cos(a) * 0.03], [Math.cos(a) * 0.05 + Math.sin(a) * 0.03, 0, Math.sin(a) * 0.05 - Math.cos(a) * 0.03], [Math.cos(a) * r, 1, Math.sin(a) * r], [Math.cos(a) * r, 1, Math.sin(a) * r]], leaf); } break;
		case 'shrub': g.dome(0, 0, 0, 0.55, leaf, { k: 1.4, n: 7, rings: 3 }).dome(0.3, 0, 0.2, 0.35, shade(leaf, 0.9), { k: 1.3, n: 6, rings: 2 }); break;
		case 'cactus': g.cyl(0, 0, 0, 0.09, 0.08, 1, leaf, { n: 7 }).beam(0.08, 0.45, 0, 0.25, 0.5, 0, 0.08, leaf).beam(0.25, 0.5, 0, 0.27, 0.8, 0, 0.08, leaf).beam(-0.08, 0.55, 0, -0.22, 0.6, 0, 0.08, leaf).beam(-0.22, 0.6, 0, -0.23, 0.82, 0, 0.08, leaf); break;
	}
	return g.geometry();
}

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

export function createFlora(scene, { ground, wet, blocked, isPhone = false, toLL }) {
	const group = new THREE.Group();
	group.name = 'regional plants';
	scene.add(group);
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
	const CAP = isPhone ? 500 : 1400;
	const meshes = {};
	let snowy = false;
	function meshesFor(snow) {
		for (const f of FORMS) {
			if (meshes[f] && (f !== 'conifer' || snow === snowy)) continue;
			if (meshes[f]) { group.remove(meshes[f]); meshes[f].geometry.dispose(); meshes[f].dispose(); }
			const cap = f === 'grass' || f === 'fern' ? CAP * 2 : CAP, m = new THREE.InstancedMesh(shape(f, snow), mat, cap);
			m.count = 0; m.frustumCulled = false; m.castShadow = !isPhone && !/grass|fern/.test(f); m.receiveShadow = true;
			m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
			meshes[f] = m; group.add(m);
		}
		snowy = snow;
	}
	meshesFor(false);
	let at = null;
	const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
	const DENS = { jungle: 2.2, island: 1, eastvillage: 1.1, southasia: 0.8, southcity: 0.15, eastcity: 0.15, bazaar: 0.2, mediterranean: 0.9, village: 0.9, farm: 0.4, alpine: 1, snow: 1, polar: 0.5, himalaya: 0.6, andes: 0.6, steppe: 1.6, savanna: 1.1, sahel: 0.6, desert: 0.25, pueblo: 0.5, outback: 0.7 };

	function layout(cx, cz, kit, C, culture) {
		const counts = Object.fromEntries(FORMS.map((f) => [f, 0]));
		const flora = kit.flora || [], tot = flora.reduce((a, b) => a + b[1], 0), dens = DENS[kit.id] ?? 0.8;
		const S = 16, R = isPhone ? 200 : 300, K = Math.ceil(R / S), ll = toLL(cx, cz);
		const dl = S / 111000, dn = S / (111000 * Math.max(0.05, Math.cos(ll.lat * Math.PI / 180)));
		const i0 = Math.floor(ll.lat / dl), j0 = Math.floor(ll.lon / dn);
		if (tot) for (let a = -K; a <= K; a++) for (let b = -K; b <= K; b++) {
			let h = (Math.imul(i0 + a, 73856093) ^ Math.imul(j0 + b, 19349663)) >>> 0;
			const r = () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
			let n = Math.floor(dens + r());
			while (n-- > 0) {
				let x = r() * tot, word = flora[0][0];
				for (const [w, wt] of flora) { if ((x -= wt) < 0) { word = w; break; } }
				const F = FORM[word];
				if (!F) continue;
				const [form, base, size] = F;
				if (counts[form] >= meshes[form].instanceMatrix.count) continue;
				const lat = (i0 + a + r()) * dl, lon = (j0 + b + r()) * dn;
				const dx = (lon - ll.lon) * 111000 * Math.cos(ll.lat * Math.PI / 180), dz = -(lat - ll.lat) * 111000, px = cx + dx, pz = cz + dz;
				if (Math.hypot(dx, dz) > R || wet(px, pz) || blocked(px, pz, form === 'grass' || form === 'fern' ? 1 : 3)) continue;
				const y = ground(px, pz), e = 3, s = Math.max(Math.abs(ground(px + e, pz) - y), Math.abs(ground(px, pz + e) - y)) / e;
				if (s > 0.8) continue;
				const sz = size * (0.6 + r() * 0.7);
				Q.setFromAxisAngle(UP, r() * Math.PI * 2); SC.set(sz, sz, sz);
				M4.compose(V.set(px, y - 0.1, pz), Q, SC);
				const m = meshes[form], k = counts[form]++;
				m.setMatrixAt(k, M4);
				seasonal(word, base, C, culture).toArray(m.instanceColor.array, k * 3);
			}
		}
		for (const f of FORMS) { const m = meshes[f]; m.count = counts[f]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
	}
	function update(cam, { kit, climate, culture, on = true, epoch = 0 }) {
		group.visible = on && !!kit;
		if (!group.visible) { at = null; return; }
		const x = cam.position.x, z = cam.position.z, key = kit.id + ':' + climate?.season + ':' + (climate?.snow > 0.5) + ':' + epoch;
		if (!at || Math.hypot(x - at[0], z - at[1]) > 60 || at[2] !== key) {
			meshesFor((climate?.snow || 0) > 0.5);
			at = [x, z, key];
			layout(x, z, kit, climate, culture);
		}
	}
	function dispose() { scene.remove(group); for (const m of Object.values(meshes)) m.geometry.dispose(); mat.dispose(); }
	return { update, dispose, info: () => Object.fromEntries(FORMS.map((f) => [f, meshes[f].count]).filter((e) => e[1])) };
}
