// Bakes the openly licensed vehicle models (assets/vehicles/CREDITS.md) for the web:
// turned to face +z with the tyres on y = 0, scaled to the real length, logos and plates
// blanked, materials sorted into the parts the game paints itself (paint, glass, lamps) and
// the rest folded into a few vertex-coloured solids, wheels split out on their hubs, then
// welded, simplified, textures to WebP and meshopt-compressed. Two files per model: the
// full one for close by and a much lighter one for the middle distance.
//
//   node tools/bake-vehicles.mjs <src dir> <out dir> [id ...]
//
// (needs the gltf-transform packages, meshoptimizer and sharp: npm i -D in island/)

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, join, flatten, textureCompress, quantize, meshopt, transformMesh, unpartition, cloneDocument } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// src: the file under <src dir>; len: the real length in metres; front: a node whose
// centre lies toward the nose; drop: parts left out (logos, plates, hidden cages);
// paint/glass/lamp: material names; mask: which pixels of a painted texture are paint
export const MODELS = {
	sports: { src: 'CarConcept/CarConcept.glb', len: 4.45, front: /^BodyHeadlights$/, drop: /Emblem|License|Logo|InteriorCage|Engine|Axles|Wipers$/, paint: /^Paint|^Panel Sides/, glass: /^Glass$/, lamp: /light$/i, fold: /Interior|Floormat|Mechanical|Disc/, near: 0.35, mid: 0.05 },
	delivery: { src: 'van/scene.gltf', len: 5.4, front: /glass_windshield_ply$/, drop: /logo|plate/i, paint: /body_shd/, mask: (r, g, b) => r > 140 && g > r * 0.68 && b < r * 0.72 && r - b > 40, ref: 225, glass: /glass_shd/, lamp: /^$/, near: 1, mid: 0.2 },
	crossover: { src: 'redcar/scene.gltf', len: 4.6, front: null, drop: /^$/, paint: /^initialShadingGroup$/, mask: (r, g, b) => r > 80 && r > g * 1.8 && r > b * 1.8, ref: 180, glass: /^$/, lamp: /^$/, near: 0.5, mid: 0.1 },
	bus: { src: 'bus/scene.gltf', len: 11.2, front: null, drop: /^1616862037160$/, paint: /^$/, glass: /^glass$/, lamp: /^light$/, near: 0.6, mid: 0.12, midError: 0.4 },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// the material's colour as one value, for folding it into vertex colours
const factor = (m) => { const c = m.getBaseColorFactor(); return [c[0], c[1], c[2]]; };
async function averageTexture(tex) {
	const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(8, 8).raw().toBuffer({ resolveWithObject: true });
	const s = [0, 0, 0];
	for (let i = 0; i < data.length; i += info.channels) for (let k = 0; k < 3; k++) s[k] += data[i + k];
	const n = data.length / info.channels, lin = (v) => Math.pow(v / 255 / n, 2.2);
	return [lin(s[0]), lin(s[1]), lin(s[2])];
}

async function bake(id, M, srcDir, outDir) {
	const doc = await io.read(path.join(srcDir, M.src)), R = doc.getRoot();
	// (the paint colours to choose between: the game chooses its own)
	for (const e of R.listExtensionsUsed()) if (e.extensionName === 'KHR_materials_variants') e.dispose();
	await doc.transform(unpartition(), flatten());
	// leave out the logos, the plates, the parts nobody sees
	for (const n of R.listNodes()) if (M.drop.test(n.getName())) { n.getMesh()?.dispose(); n.dispose(); }
	for (const m of R.listMaterials()) if (M.drop.test(m.getName())) for (const mesh of R.listMeshes()) for (const p of mesh.listPrimitives()) if (p.getMaterial() === m) p.dispose();
	await doc.transform(prune());
	// facing +z, tyres on the ground, centred, at its real length
	const scene = R.listScenes()[0];
	let b = getBounds(scene);
	const sz = b.max.map((v, i) => v - b.min[i]);
	const alongX = sz[0] > sz[2];
	let yaw = alongX ? -Math.PI / 2 : 0;
	if (M.front) {
		const fn = R.listNodes().find((n) => M.front.test(n.getName()) && n.getMesh());
		if (fn) {
			const fb = getBounds(fn), c = fb.min.map((v, i) => (v + fb.max[i]) / 2), mid = b.min.map((v, i) => (v + b.max[i]) / 2);
			const ahead = alongX ? c[0] - mid[0] : c[2] - mid[2];
			if (alongX ? ahead < 0 : ahead < 0) yaw += Math.PI;
		}
	} else if (M.flip) yaw += Math.PI;
	const k = M.len / Math.max(sz[0], sz[2]);
	// bake every node's transform into its mesh, then turn and scale the whole
	for (const n of R.listNodes()) {
		const mesh = n.getMesh();
		if (!mesh) continue;
		transformMesh(mesh, n.getWorldMatrix());
	}
	for (const n of R.listNodes()) { n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]); }
	const c = Math.cos(yaw), s = Math.sin(yaw), cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
	// (column-major: rotate about y, scale, and move the centre to the origin, the ground to 0)
	const T = [c * k, 0, -s * k, 0, 0, k, 0, 0, s * k, 0, c * k, 0, 0, 0, 0, 1];
	T[12] = -(c * cx + s * cz) * k; T[13] = -b.min[1] * k; T[14] = -(-s * cx + c * cz) * k;
	for (const mesh of R.listMeshes()) transformMesh(mesh, T);
	b = getBounds(scene);

	// a body painted in its texture: the paint's own pixels become a grey the game tints,
	// marked in the alpha (the rest, trim and tyres and lamps, keep their colours)
	if (M.mask) for (const m of R.listMaterials()) {
		const t = m.getBaseColorTexture();
		if (!t || !M.paint.test(m.getName())) continue;
		const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i], g = data[i + 1], b2 = data[i + 2];
			if (M.mask(r, g, b2)) { const v = Math.min(255, Math.max(r, g, b2) / M.ref * 225); data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; } else data[i + 3] = 0;
		}
		t.setImage(new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer())).setMimeType('image/png');
	}
	// the roles: the game paints the body, the glass and the lamps itself; every other
	// untextured material becomes a vertex colour on one of three solids
	const role = (m) => M.paint.test(m.getName()) ? 'paint' : M.glass.test(m.getName()) ? 'glass' : M.lamp.test(m.getName()) ? 'lamp' : null;
	const solids = {};
	const solid = (key, rough, metal) => solids[key] || (solids[key] = doc.createMaterial(key).setRoughnessFactor(rough).setMetallicFactor(metal).setBaseColorFactor([1, 1, 1, 1]));
	const roleMat = {};
	for (const mesh of R.listMeshes()) for (const p of mesh.listPrimitives()) {
		const m = p.getMaterial();
		if (!m) continue;
		const r = role(m);
		if (r) {
			if (!roleMat[r]) roleMat[r] = doc.createMaterial(r).setBaseColorFactor(r === 'paint' ? [1, 1, 1, 1] : [0.05, 0.06, 0.07, 1]).setRoughnessFactor(r === 'glass' ? 0.05 : r === 'paint' ? 0.28 : 0.2).setMetallicFactor(0);
			// a lamp keeps its own colour (white heads, red tails, amber signals) as a vertex colour
			if (r === 'lamp') addColor(doc, p, m.getBaseColorTexture() ? await averageTexture(m.getBaseColorTexture()) : factor(m));
			else if (r === 'paint' && m.getBaseColorTexture()) { roleMat[r].setBaseColorTexture(m.getBaseColorTexture()); roleMat[r].setBaseColorFactor(m.getBaseColorFactor()); }
			p.setMaterial(roleMat[r]);
			continue;
		}
		const textured = m.getBaseColorTexture() || m.getNormalTexture();
		if (textured && !M.fold?.test(m.getName())) continue;
		const rough = m.getRoughnessFactor(), metal = m.getMetallicFactor();
		// (a small textured part, the seats or the dash, folded in by its average colour)
		const tc = m.getBaseColorTexture() ? await averageTexture(m.getBaseColorTexture()) : [1, 1, 1];
		addColor(doc, p, factor(m).map((v, i) => v * tc[i]));
		p.setMaterial(metal > 0.5 ? solid('chrome', Math.min(rough, 0.35), 1) : rough < 0.45 ? solid('gloss', 0.3, 0) : solid('matte', 0.8, 0));
	}
	// wheels: every loose piece down at a corner that is round side on (tyre, rim, disc) is
	// lifted out onto a node of its own at that corner, its mesh centred on the hub
	const wheels = splitWheels(doc, scene, b);
	await doc.transform(prune(), dedup(), weld());
	const report = { id, bounds: { min: b.min.map((v) => +v.toFixed(3)), max: b.max.map((v) => +v.toFixed(3)) }, wheels };
	const out = async (file, ratio, tex) => {
		const d = cloneDocument(doc);
		await d.transform(
			join({ keepNamed: true }),
			weld(),
			...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: ratio < 0.25 ? M.midError ?? 0.03 : 0.004 })] : []),
			prune(),
			textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80 }),
			quantize(),
			meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
		);
		d.createExtension(EXTTextureWebP).setRequired(true);
		d.createExtension(EXTMeshoptCompression).setRequired(true);
		await io.write(path.join(outDir, file), d);
		let tris = 0;
		for (const mesh of d.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
		return { file, bytes: fs.statSync(path.join(outDir, file)).size, tris: Math.round(tris), materials: d.getRoot().listMaterials().map((m) => m.getName()) };
	};
	report.near = await out(id + '.glb', M.near, 1024);
	// the middle distance: small textures
	report.mid = await out(id + '-mid.glb', M.mid, 256);
	return report;
}

function splitWheels(doc, scene, b) {
	const R = doc.getRoot(), halfW = (b.max[0] - b.min[0]) / 2, H = b.max[1] - b.min[1];
	const quads = [[], [], [], []];                      // FL FR RL RR: [primitive, triangle list]
	for (const mesh of R.listMeshes()) for (const p of mesh.listPrimitives()) {
		const pos = p.getAttribute('POSITION'), idx = p.getIndices();
		if (!pos || !idx) continue;
		const n = pos.getCount(), P = new Float32Array(n * 3), e = [];
		for (let i = 0; i < n; i++) { pos.getElement(i, e); P[i * 3] = e[0]; P[i * 3 + 1] = e[1]; P[i * 3 + 2] = e[2]; }
		// vertices at the same place are one (the seams in the UVs split them)
		const key = new Map(), root = new Int32Array(n);
		for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 2000) + ',' + Math.round(P[i * 3 + 1] * 2000) + ',' + Math.round(P[i * 3 + 2] * 2000); if (!key.has(k)) key.set(k, i); root[i] = key.get(k); }
		const par = Int32Array.from({ length: n }, (_, i) => i);
		const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
		const T = idx.getCount();
		for (let t = 0; t < T; t += 3) { const a = find(root[idx.getScalar(t)]); for (let k = 1; k < 3; k++) { const c = find(root[idx.getScalar(t + k)]); if (c !== a) par[c] = a; } }
		const box = new Map();
		for (let i = 0; i < n; i++) { const r = find(root[i]); let q = box.get(r); if (!q) box.set(r, q = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]); for (let k = 0; k < 3; k++) { q[k] = Math.min(q[k], P[i * 3 + k]); q[k + 3] = Math.max(q[k + 3], P[i * 3 + k]); } }
		const wheelOf = new Map();
		for (const [r, q] of box) {
			const cy = (q[1] + q[4]) / 2, ey = q[4] - q[1], ez = q[5] - q[2], ex = q[3] - q[0], cx = (q[0] + q[3]) / 2, cz = (q[2] + q[5]) / 2;
			if (cy > H * 0.4 || cy > 0.75 || ey < 0.25 || ey > 1.3 || Math.abs(ey - ez) > 0.2 * ey || ex > 0.5 || Math.abs(cx) < halfW * 0.35) continue;
			wheelOf.set(r, (cz > 0 ? 0 : 2) + (cx > 0 ? 0 : 1));
		}
		if (!wheelOf.size) continue;
		const keep = [], lift = [[], [], [], []];
		for (let t = 0; t < T; t += 3) { const w = wheelOf.get(find(root[idx.getScalar(t)])); const dst = w === undefined ? keep : lift[w]; for (let k = 0; k < 3; k++) dst.push(idx.getScalar(t + k)); }
		const mk = (list) => doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(list)).setBuffer(R.listBuffers()[0]);
		lift.forEach((list, w) => { if (list.length) { const q = p.clone(); q.setIndices(mk(list)); quads[w].push([q, P, list]); } });
		p.setIndices(mk(keep));
	}
	const wheels = [];
	quads.forEach((parts, w) => {
		if (!parts.length) return;
		let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
		for (const [, P, list] of parts) for (const i of list) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
		const hub = lo.map((v, i) => (v + hi[i]) / 2);
		const mesh = doc.createMesh('wheel' + w);
		for (const [q] of parts) mesh.addPrimitive(q);
		transformMesh(mesh, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -hub[0], -hub[1], -hub[2], 1]);
		const node = doc.createNode(['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'][w]).setMesh(mesh).setTranslation(hub);
		scene.addChild(node);
		wheels.push({ name: node.getName(), x: +hub[0].toFixed(3), y: +hub[1].toFixed(3), z: +hub[2].toFixed(3), r: +((hi[1] - lo[1]) / 2).toFixed(3) });
	});
	return wheels;
}

function addColor(doc, p, rgb) {
	const n = p.getAttribute('POSITION').getCount(), a = new Float32Array(n * 3);
	const old = p.getAttribute('COLOR_0');
	for (let i = 0; i < n; i++) { a[i * 3] = rgb[0]; a[i * 3 + 1] = rgb[1]; a[i * 3 + 2] = rgb[2]; }
	if (old) old.dispose();
	p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(a).setBuffer(doc.getRoot().listBuffers()[0]));
}

if (process.argv[1] && process.argv[1].endsWith('bake-vehicles.mjs')) {
	const [srcDir, outDir, ...only] = process.argv.slice(2);
	await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
	fs.mkdirSync(outDir, { recursive: true });
	for (const [id, M] of Object.entries(MODELS)) {
		if (only.length && !only.includes(id)) continue;
		const r = await bake(id, M, srcDir, outDir);
		console.log(JSON.stringify(r));
	}
}
