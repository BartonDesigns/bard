// The creature models for the game: each one tools/monsters/build.py made (a GLB and its
// meta.json), its textures to WebP, its mesh quantised and meshopt-compressed, and its meta
// (the rig's joints, how it moves, its bones' thickness) laid in the scene's extras so the game
// loads one file (creatures/models.js).
//   node island/tools/monsters/pack.mjs <built dir> <name> [name ...]
// (<built dir>/<name>/<name>.glb and meta.json in, island/assets/creatures/<name>.glb out)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [src, ...names] = process.argv.slice(2);
if (!src || !names.length) { console.error('pack.mjs <built dir> <name> [name ...]'); process.exit(1); }
const dst = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/creatures');
fs.mkdirSync(dst, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

for (const name of names) {
	const doc = await io.read(path.join(src, name, name + '.glb'));
	const meta = JSON.parse(fs.readFileSync(path.join(src, name, 'meta.json'), 'utf8'));
	meta.id = name;
	doc.getRoot().getDefaultScene().setExtras({ creature: meta });
	await doc.transform(
		prune(),
		dedup(),
		// (the paint a little finer than the bumps and the glow, which forgive more)
		textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColor/, quality: 88 }),
		textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(normal|emissive)/, quality: 82 }),
		quantize({ quantizeTexcoord: 14 }),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
	);
	const out = path.join(dst, name + '.glb');
	await io.write(out, doc);
	console.log(name, Math.round(fs.statSync(out).size / 1024), 'KB');
}
