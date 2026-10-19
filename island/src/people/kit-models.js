// The soldiers' head kit as real models (tools/blender/soldier_kit.py): a high-cut ballistic
// helmet with its rails, shroud and loop panels; night vision stowed up on its mount with the
// battery pouch behind, its cable and a strobe; an electronic headset hung from the rails;
// the plate carrier's pouches, magazines, radio, talk switch, tourniquet, back panel, drag
// handle and buckles (each in its own frame: its back at the origin, +z out); the combat boot;
// and the combat glove's and the knight's gauntlet's detail, baked onto the hand's own skin
// stood off.
// Modelled once to a reference head, each piece's detail (bevels, slots, screw heads, ribbed
// rings, grit, weave) baked into one atlas: colour, normals, and occlusion, roughness, metal
// and how much of the wearer's colour it takes (assets/kit). Loaded with the people's assets;
// garment.js fits each piece to a head and lays it into the person's kit mesh, so it is still
// one draw per person. Without them (a failed load) the kit is built as before, in code.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// the kit material's id for a vertex of these models (propkit.js reads the atlas for it)
export const KIT_MODEL = 11;
const url = (f) => new URL(`../assets/kit/${f}`, import.meta.url).href;
let kit = null, ready = null;
// the kit if it is in already (no waiting)
export const kitModelsNow = () => ready;
// { parts: { helmet, nvg, headset (indexed geometry in the kit frame: metres, origin at the
// skull's middle at eye height, +y up, +z forward), mag, magpouch, admin, ... (each in its own) }, ref (the reference head: rx, rz, top
// over the eyes), foot (the reference foot the boot is made to: heel, toe, medial, lateral, sole,
// shin), glove ({ proud, L, R }: each hand's body faces under the combat glove, by index into the
// body's faces, and the atlas at their corners), gauntlet (the knight's, the same with a lift at
// each corner where its plates are), tex: { albedo, normal, orm } }; a phone takes its own
// copies of the maps at half size
// (kit-*-phone.webp: decoding the full ones first and shrinking them after held three 2048
// bitmaps and their canvases at once, as the page was finishing its load)
export function loadKitModels(phone = false) {
	if (kit) return kit;
	kit = (async () => {
		const loader = new THREE.TextureLoader();
		const map = (n, srgb) => loader.loadAsync(url(`kit-${n}${phone ? '-phone' : ''}.webp`)).then((t) => {
			t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
			return t;
		});
		const [gltf, info, albedo, normal, orm] = await Promise.all([new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url('soldier-kit.glb')), fetch(url('soldier-kit.json')).then((r) => r.json()), map('albedo', true), map('normal', false), map('orm', false)]);
		const parts = {};
		gltf.scene.updateMatrixWorld(true);
		gltf.scene.traverse((o) => {
			if (!o.isMesh) return;
			// (out of their packed form into plain floats, then placed: the files are quantised)
			const g = new THREE.BufferGeometry();
			for (const k of ['position', 'normal', 'uv']) {
				const a = o.geometry.attributes[k], f = new Float32Array(a.count * a.itemSize);
				for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
				g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
			}
			g.setIndex(o.geometry.index ? Array.from(o.geometry.index.array) : null);
			g.applyMatrix4(o.matrixWorld);
			parts[o.name] = g;
		});
		// (the gloves' tables, little-endian arrays sent as base64: per hand the body's faces under
		// the glove, the atlas at each of their corners as 0..65535, and for the gauntlet how much
		// further each corner stands off, in twentieths of a millimetre)
		const b64 = (str, T) => { const bin = atob(str), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
		const hand = (h) => ({ faces: b64(h.faces, Uint32Array), uv: b64(h.uv, Uint16Array), lift: h.lift ? b64(h.lift, Uint8Array) : null });
		const table = (t) => (t ? { proud: t.proud, L: hand(t.L), R: hand(t.R) } : null);
		const glove = table(info.glove), gauntlet = table(info.gauntlet);
		ready = { parts, ref: info.meta, foot: info.foot, glove, gauntlet, tex: { albedo, normal, orm } };
		return ready;
	})();
	return kit;
}
