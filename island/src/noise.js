// Seeded value noise shared by generation (CPU) and mirrored where shaders need it.

export function mulberry32(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function hash2(x, z, seed) {
	let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1440662683);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * (3 - 2 * t);

export function makeNoise(seed) {
	function vnoise(x, z) {
		const xi = Math.floor(x), zi = Math.floor(z);
		const xf = fade(x - xi), zf = fade(z - zi);
		const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
		const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
		return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
	}
	function fbm(x, z, octaves = 5, lac = 2.03, gain = 0.5) {
		let amp = 0.5, sum = 0, norm = 0;
		for (let i = 0; i < octaves; i++) {
			sum += amp * vnoise(x, z);
			norm += amp;
			x = x * lac + 17.13;
			z = z * lac - 9.71;
			amp *= gain;
		}
		return sum / norm;
	}
	function ridged(x, z, octaves = 5) {
		let amp = 0.5, sum = 0, norm = 0, weight = 1;
		for (let i = 0; i < octaves; i++) {
			let n = 1 - Math.abs(vnoise(x, z) * 2 - 1);
			n *= n * weight;
			weight = Math.min(1, n * 1.6);
			sum += amp * n;
			norm += amp;
			x = x * 2.07 + 5.3;
			z = z * 2.07 + 11.9;
			amp *= 0.5;
		}
		return sum / norm;
	}
	return { vnoise, fbm, ridged };
}

export const smoothstep = (a, b, v) => {
	const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
