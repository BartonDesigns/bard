// Packs the soldier kit made by tools/blender/soldier_kit.py for the game: its maps to WebP,
// the model and its notes copied, into assets/kit (people/kit-models.js loads them). The
// colour lossy; the normals near-lossless and the occlusion/roughness/metal-and-tint map
// lossless (lossy WebP shares its colour planes between channels, and these channels are
// not colours); that one at half size, as nothing in it is fine. A phone's copies are half
// again (kit-*-phone.webp): it loads those, never decoding the full maps (people/kit-models.js).
//   node island/tools/bake-soldier-kit.mjs <the Blender script's out dir>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/bake-soldier-kit.mjs <out dir>'); process.exit(1); }
const dst = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../assets/kit');
fs.mkdirSync(dst, { recursive: true });
const maps = { albedo: [{ quality: 88, smartSubsample: true }, 1], orm: [{ lossless: true }, 0.5], normal: [{ quality: 92, smartSubsample: true }, 1] };
for (const [name, [o, k]] of Object.entries(maps)) {
	const to = path.join(dst, `kit-${name}.webp`), im = sharp(path.join(src, `kit-${name}.png`)).removeAlpha();
	const { width } = await im.metadata();
	await (k < 1 ? im.resize(Math.round(width * k)) : im).webp({ ...o, effort: 6 }).toFile(to);
	console.log(to, (fs.statSync(to).size / 1024).toFixed(0) + ' KB');
	const toP = path.join(dst, `kit-${name}-phone.webp`);
	await sharp(path.join(src, `kit-${name}.png`)).removeAlpha().resize(Math.round(width * k / 2)).webp({ ...o, effort: 6 }).toFile(toP);
	console.log(toP, (fs.statSync(toP).size / 1024).toFixed(0) + ' KB');
}
// (the model quantised and meshopt-compressed; its UVs kept fine enough for the atlas)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(path.join(src, 'soldier-kit.glb'));
await doc.transform(quantize({ quantizeTexcoord: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
doc.createExtension(EXTMeshoptCompression).setRequired(true);
await io.write(path.join(dst, 'soldier-kit.glb'), doc);
console.log(path.join(dst, 'soldier-kit.glb'), (fs.statSync(path.join(dst, 'soldier-kit.glb')).size / 1024).toFixed(0) + ' KB');
for (const f of ['soldier-kit.json']) {
	fs.copyFileSync(path.join(src, f), path.join(dst, f));
	console.log(path.join(dst, f), (fs.statSync(path.join(dst, f)).size / 1024).toFixed(0) + ' KB');
}
