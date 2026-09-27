// A world is never one landscape. Earth has snow, desert, forest and beach at once, and so
// does every planet here: each has its main biome and a second one it breaks into in broad
// regions (a green world's dry savanna, a desert's oases, an ice world's tundra, a volcanic
// world's old flows gone green with moss), plus a cold side where the snow comes down low.
// The field is baked once into a small texture the ground, grass and plants all read:
//   r: how much of the second biome, g: how cold.

import * as THREE from 'three';
import { makeNoise, smoothstep } from '../noise.js';

const RES = 256;

export function createBiomes(island, profile) {
	const data = new Uint8Array(RES * RES * 4);
	const nz = makeNoise((island.seed ^ 0xb10e5) >>> 0);
	const a0 = (island.seed % 628) / 100, px = Math.cos(a0), pz = Math.sin(a0);
	const has = !!profile?.alt, cold = profile?.cold || 0;
	const S = island.half * 2;
	// how much of the island the second biome takes (a desert's oases are few)
	const lo = 0.62 - (profile?.alt?.share ?? 0.5) * 0.2;
	const field = (x, z) => {
		if (!has && !cold) return [0, 0];
		// broad regions of the second biome, their edges wandering
		let a = has ? smoothstep(lo, lo + 0.1, nz.fbm(x * 0.0024 + 17, z * 0.0024 - 5, 4)) : 0;
		// a volcano's cone stays bare: the old greened flows lie out on the lower ground
		if (profile?.relief === 'volcano' && island.peak) a *= smoothstep(island.peak.r * 0.55, island.peak.r * 1.15, Math.hypot(x - island.peak.x, z - island.peak.z));
		// the cold side of the island, and cold pockets in the hills
		const toward = (x * px + z * pz) / (island.R || 800);
		const c = cold * Math.min(1, smoothstep(-0.1, 0.9, toward) * (0.7 + 0.5 * nz.fbm(x * 0.002 - 9, z * 0.002 + 3, 3)));
		return [a, c];
	};
	for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
		const x = -island.half + (i + 0.5) / RES * S, z = -island.half + (j + 0.5) / RES * S;
		const [a, c] = field(x, z), k = (j * RES + i) * 4;
		data[k] = Math.round(a * 255); data[k + 1] = Math.round(c * 255); data[k + 3] = 255;
	}
	const tex = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.UnsignedByteType);
	tex.magFilter = tex.minFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	// the same, for placing things on the CPU
	const at = (x, z) => {
		const i = Math.min(RES - 1, Math.max(0, Math.floor((x + island.half) / S * RES)));
		const j = Math.min(RES - 1, Math.max(0, Math.floor((z + island.half) / S * RES)));
		const k = (j * RES + i) * 4;
		return { alt: data[k] / 255, cold: data[k + 1] / 255 };
	};
	// how much snow lies here: the planet's own, the second biome's, the cold side's
	const snowAt = (x, z, h) => {
		const b = at(x, z);
		const amt = Math.min(1, (profile?.snow || 0) * (1 - b.alt) + (profile?.alt?.snow || 0) * b.alt + b.cold * cold);
		if (amt < 0.01) return 0;
		const line = 175 + (2.6 - 175) * amt;
		return smoothstep(line, line + 8, h);
	};
	return { tex, at, snowAt };
}
