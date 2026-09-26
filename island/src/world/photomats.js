// Photographic materials from the generated texture atlases in /textures (see
// ASSET_NOTES191.md, ASSET_NOTES193.md): each atlas is a grid of material swatches.
// A swatch is cut out, made to tile without seams (cross-faded with a copy of itself
// shifted by half, one axis at a time), and turned into
//   map:       a grey detail map around a set brightness, so a material's own colour
//              (and each vertex's tint) still decides the hue;
//   normalMap: gentle relief derived from the swatch's brightness.
// They load in the background; until they arrive (or if they never do) the painted
// canvas textures stay.

import * as THREE from 'three';

const BASE = new URL('../../textures/', import.meta.url);
const images = new Map();
function image(path) {
	let p = images.get(path);
	if (!p) {
		p = new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = no; im.src = new URL(path, BASE).href; });
		images.set(path, p);
	}
	return p;
}

const sm = (t) => t * t * (3 - 2 * t);
// cross-fade toward a copy shifted by half, near the edges of one axis
function tileAxis(src, S, axis) {
	const out = new Float32Array(src.length), band = 0.28 * S;
	for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
		const u = axis ? y : x, d = Math.min(u, S - 1 - u), w = d < band ? 1 - sm(d / band) : 0;
		const sx = axis ? x : (x + S / 2) % S, sy = axis ? (y + S / 2) % S : y;
		const i = (y * S + x) * 3, j = (sy * S + sx) * 3;
		for (let c = 0; c < 3; c++) out[i + c] = src[i + c] * (1 - w) + src[j + c] * w;
	}
	return out;
}

// one swatch: atlas path, grid [cols, rows], cell [col, row]
// opt: mean (the detail map's average, 0-1 in sRGB), contrast, colour (keep the hue),
//      normal (relief strength; 0 for none), size
const tiles = new Map();
export function swatch(path, grid, cell, opt = {}) {
	const key = JSON.stringify([path, grid, cell, opt]);
	let p = tiles.get(key);
	if (p) return p;
	p = image(path).then((im) => {
		const S = opt.size || 512, inset = 6;
		const cw = im.width / grid[0], ch = im.height / grid[1];
		const cv = document.createElement('canvas');
		cv.width = cv.height = S;
		const g = cv.getContext('2d', { willReadFrequently: true });
		g.drawImage(im, cell[0] * cw + inset, cell[1] * ch + inset, cw - 2 * inset, ch - 2 * inset, 0, 0, S, S);
		const px = g.getImageData(0, 0, S, S);
		let f = new Float32Array(S * S * 3);
		for (let i = 0, k = 0; i < px.data.length; i += 4, k += 3) { f[k] = px.data[i] / 255; f[k + 1] = px.data[i + 1] / 255; f[k + 2] = px.data[i + 2] / 255; }
		f = tileAxis(tileAxis(f, S, 0), S, 1);
		// brightness, its average
		const L = new Float32Array(S * S);
		let m = 0;
		for (let i = 0; i < L.length; i++) { L[i] = f[i * 3] * 0.3 + f[i * 3 + 1] * 0.59 + f[i * 3 + 2] * 0.11; m += L[i]; }
		m /= L.length;
		const mean = opt.mean ?? 0.9, k = opt.contrast ?? 1;
		for (let i = 0, j = 0; i < L.length; i++, j += 4) {
			const l = Math.min(1, Math.max(0, mean + (L[i] - m) * k));
			if (opt.colour) { const s = l / Math.max(1e-3, L[i]); for (let c = 0; c < 3; c++) px.data[j + c] = Math.min(255, f[i * 3 + c] * s * 255); }
			else px.data[j] = px.data[j + 1] = px.data[j + 2] = l * 255;
			px.data[j + 3] = 255;
		}
		g.putImageData(px, 0, 0);
		const map = new THREE.CanvasTexture(cv);
		map.colorSpace = THREE.SRGBColorSpace;
		map.wrapS = map.wrapT = THREE.RepeatWrapping;
		map.anisotropy = 8;
		let normalMap = null;
		if (opt.normal) {
			const N = document.createElement('canvas');
			N.width = N.height = S;
			const ng = N.getContext('2d'), nd = ng.createImageData(S, S), st = opt.normal;
			const h = (x, y) => L[((y + S) % S) * S + ((x + S) % S)];
			for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
				const dx = (h(x - 1, y) - h(x + 1, y)) * st, dy = (h(x, y - 1) - h(x, y + 1)) * st, l = Math.hypot(dx, dy, 1), j = (y * S + x) * 4;
				nd.data[j] = (dx / l * 0.5 + 0.5) * 255; nd.data[j + 1] = (-dy / l * 0.5 + 0.5) * 255; nd.data[j + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[j + 3] = 255;
			}
			ng.putImageData(nd, 0, 0);
			normalMap = new THREE.CanvasTexture(N);
			normalMap.colorSpace = THREE.NoColorSpace;
			normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
			normalMap.anisotropy = 8;
		}
		return { map, normalMap };
	});
	tiles.set(key, p);
	return p;
}

// the atlases, by name: [path, grid, cell]
export const PHOTO = {
	limestone: ['realism191/geology.webp', [2, 2], [0, 0]], granite: ['realism191/geology.webp', [2, 2], [1, 0]],
	basalt: ['realism191/geology.webp', [2, 2], [0, 1]], sandstone: ['realism191/geology.webp', [2, 2], [1, 1]],
	moss: ['realism191/ground.webp', [2, 2], [0, 0]], loam: ['realism191/ground.webp', [2, 2], [1, 0]],
	sand: ['realism191/ground.webp', [2, 2], [0, 1]], riverbed: ['realism191/ground.webp', [2, 2], [1, 1]],
	plaster: ['realism191/architecture.webp', [2, 2], [0, 0]], masonry: ['realism191/architecture.webp', [2, 2], [1, 0]],
	slate: ['realism191/architecture.webp', [2, 2], [0, 1]], cedar: ['realism191/architecture.webp', [2, 2], [1, 1]],
	brass: ['realism191/instrument.webp', [2, 2], [0, 0]], aluminium: ['realism191/instrument.webp', [2, 2], [1, 0]],
	enamel: ['realism191/instrument.webp', [2, 2], [0, 1]], walnut: ['realism191/instrument.webp', [2, 2], [1, 1]],
	linen: ['people193/fibers.webp', [2, 2], [0, 0]], wool: ['people193/fibers.webp', [2, 2], [1, 0]],
	leather: ['people193/fibers.webp', [2, 2], [0, 1]], suede: ['people193/fibers.webp', [2, 2], [1, 1]],
	bark: ['materials-f924d3f2d2.webp', [4, 5], [0, 2]], birch: ['materials-f924d3f2d2.webp', [4, 5], [1, 2]],
	lichen: ['materials-f924d3f2d2.webp', [4, 5], [1, 3]],
	// the house atlases (ASSET_PROMPTS_HOUSES.md), used when they are there
	oak: ['houses/floors.webp', [2, 2], [0, 0]], carpet: ['houses/floors.webp', [2, 2], [1, 0]], floorTile: ['houses/floors.webp', [2, 2], [0, 1]], slab: ['houses/floors.webp', [2, 2], [1, 1]],
	drywall: ['houses/interior.webp', [2, 2], [0, 0]], subway: ['houses/interior.webp', [2, 2], [1, 0]], quartz: ['houses/interior.webp', [2, 2], [0, 1]], cabinet: ['houses/interior.webp', [2, 2], [1, 1]],
	stucco: ['houses/exterior.webp', [2, 2], [0, 0]], garageDoor: ['houses/exterior.webp', [2, 2], [1, 0]], driveway: ['houses/exterior.webp', [2, 2], [0, 1]], fence: ['houses/exterior.webp', [2, 2], [1, 1]],
	roofTile: ['houses/roofs.webp', [2, 2], [0, 0]], roofS: ['houses/roofs.webp', [2, 2], [1, 0]], shingle: ['houses/roofs.webp', [2, 2], [0, 1]], shake: ['houses/roofs.webp', [2, 2], [1, 1]],
	dryGrass: ['houses/hills.webp', [2, 2], [0, 0]], springGrass: ['houses/hills.webp', [2, 2], [1, 0]], oakLitter: ['houses/hills.webp', [2, 2], [0, 1]], trail: ['houses/hills.webp', [2, 2], [1, 1]],
};
export const photo = (name, opt) => { const [p, g, c] = PHOTO[name]; return swatch(p, g, c, opt); };

// put a swatch on a material once it has loaded. choices: [[swatch name, metres one tile
// covers (the material's uvs being in metres), detail options, relief], ...], the first
// that loads wins; if none does, the material keeps what it had
export async function usePhoto(mat, choices) {
	for (const [name, metres, opt = {}, normalScale = 0.6] of choices) {
		let t;
		try { t = await photo(name, opt); } catch { continue; }
		// (clones share the image, so one upload serves every scale; metres may be [u, v]
		// tiles for surfaces whose uvs are not in metres, like trunks)
		const map = t.map.clone(), normalMap = t.normalMap?.clone() || null;
		const [ru, rv] = Array.isArray(metres) ? metres : [1 / metres, 1 / metres];
		map.repeat.set(ru, rv);
		const hadMap = !!mat.map, hadN = !!mat.normalMap;
		mat.map = map;
		if (normalMap) { normalMap.repeat.set(ru, rv); mat.normalMap = normalMap; mat.normalScale.set(normalScale, normalScale); }
		if (!hadMap || (normalMap && !hadN)) mat.needsUpdate = true;
		return name;
	}
	return null;
}

// for shaders of their own: a uniform holding a swatch once it loads (a grey pixel till
// then) and a 0-1 flag to fade it in by
const grey = (() => { let t = null; return () => { if (!t) { t = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1); t.needsUpdate = true; } return t; }; })();
export function photoUniform(name, opt = {}) {
	const u = { value: grey() }, k = { value: 0 };
	photo(name, opt).then((t) => { u.value = t.map; k.value = 1; }).catch(() => {});
	return [u, k];
}
// sampled from world position on the three planes, blended by the surface's facing
export const TRI_GLSL = /* glsl */`
vec3 triPhoto(sampler2D t, vec3 p, vec3 n, float s){
	vec3 w = pow(abs(n), vec3(4.0)); w /= w.x + w.y + w.z;
	return texture2D(t, p.zy * s).rgb * w.x + texture2D(t, p.xz * s).rgb * w.y + texture2D(t, p.xy * s).rgb * w.z;
}
`;
