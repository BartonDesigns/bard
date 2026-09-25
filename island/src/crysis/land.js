// Crysis land ecology. The same pattern as the sea: the seed gives the island a
// land profile (rain, wind exposure, soil age, how volcanic), the profile decides
// which roles exist and how many species fill them, and each species gets a genome
// that the vegetation and fauna builders grow from.
//
// Flora: canopy trees (several species with their own crown architecture, leaf and
// bark tint, height and habitat), the coconut palm, screw pines on the strand,
// tree ferns in the gullies, elephant-ear taro in the damp, wildflowers in the
// meadows, and the understory. Trees form stands: a coarse community field picks
// which species dominates a stretch of forest, as in the old flight build.
// Fauna: butterflies that visit the flowers, songbirds that flit between crowns and
// hop on the ground, a parrot flock, sandpipers working the swash line, ghost crabs
// on the beach, lizards basking on warm rock; the gulls and fireflies stay.

import { mulberry32, makeNoise } from '../noise.js';

const SYL_A = ['kai', 'mal', 'ano', 'tev', 'ulu', 'ris', 'pan', 'ora', 'sel', 'vai', 'hel', 'moa', 'tar', 'ise', 'lua', 'nem'];
const SYL_B = ['ria', 'eth', 'oma', 'ika', 'unu', 'ela', 'aru', 'ine', 'opa', 'ita', 'ahe', 'ule'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function landProfile(seed) {
	const r = mulberry32((seed ^ 0x1a4d) >>> 0);
	const P = {
		rain: 0.45 + r() * 0.5,            // wet islands: denser forest, more ferns and taro
		exposure: 0.2 + r() * 0.7,         // windward: lower, wind-shaped crowns, more palms
		soilAge: 0.2 + r() * 0.8,          // old soils: taller trees, more canopy species
		volcanic: 0.8,
		bloom: 0.3 + r() * 0.7,            // how much is in flower
	};
	const w = [P.rain > 0.75 ? 'rain-soaked' : P.rain < 0.55 ? 'dry-season' : 'green', P.exposure > 0.65 ? 'wind-combed' : 'sheltered', P.soilAge > 0.7 ? 'old-forested' : 'young volcanic'];
	P.thesis = `A ${w.join(', ')} island${P.bloom > 0.7 ? ' in full flower' : ''}.`;
	return P;
}

// harmonious natural colour: leaf greens drift yellow or blue, flowers pick from
// the tropical range, animals are camouflaged or loud
const leafTint = (r, P) => { const y = (r() - 0.5) * 0.12, l = 0.85 + r() * 0.3; return [ (0.95 + y) * l, (1.0 - Math.abs(y) * 0.3) * l, (0.9 - y * 1.2 - P.rain * 0.1) * l ]; };
const FLOWER = [[1.0, 0.28, 0.35], [0.98, 0.55, 0.15], [1.0, 0.85, 0.2], [0.92, 0.3, 0.75], [0.62, 0.4, 0.95], [1.0, 0.95, 0.9], [0.95, 0.45, 0.55]];

export function buildLandEcology(seed) {
	const P = landProfile(seed);
	const r = mulberry32((seed ^ 0x7ee5) >>> 0);
	const taken = new Set();
	const genus = () => { for (let i = 0; i < 40; i++) { const n = cap(SYL_A[(r() * SYL_A.length) | 0] + SYL_B[(r() * SYL_B.length) | 0]); if (!taken.has(n)) { taken.add(n); return n; } } return 'Incerta'; };

	// ---------- canopy trees ----------
	const CROWNS = ['round', 'umbrella', 'columnar', 'layered', 'weeping'];
	const nTrees = 2 + Math.round(P.soilAge * 1.6 + P.rain * 0.6);
	const trees = [];
	const crowns = [...CROWNS].sort(() => r() - 0.5);
	for (let i = 0; i < nTrees; i++) {
		const crown = crowns[i % crowns.length];
		trees.push({
			kind: 'tree', key: 'tree' + i, genus: genus(), crown,
			common: { round: 'rain tree', umbrella: 'monkeypod', columnar: 'spire tree', layered: 'tropical almond', weeping: 'weeping fig' }[crown],
			height: (8 + r() * 5) * (0.8 + P.soilAge * 0.35) * (1 - P.exposure * 0.15) * (crown === 'columnar' ? 1.25 : crown === 'umbrella' ? 0.9 : 1),
			leaf: leafTint(r, P), bark: [0.9 + r() * 0.25, 0.85 + r() * 0.2, 0.8 + r() * 0.2],
			// habitat: where this species does best (forest core, edge, gully, ridge)
			likes: { core: r(), edge: r() * 0.6, gully: crown === 'weeping' ? 0.9 : r() * 0.6, ridge: crown === 'umbrella' ? 0.8 : r() * 0.4 },
		});
	}
	const palm = { kind: 'palm', key: 'palm', genus: genus(), common: 'coconut palm', height: 7.5 + r() * 2 + P.exposure * 1.5, fronds: 14 + ((r() * 5) | 0), frondTint: leafTint(r, P), lean: 1 + P.exposure * 1.8 };
	const understory = [
		{ kind: 'fern', key: 'fern', genus: genus(), common: 'ground fern', tint: leafTint(r, P), size: 0.8 + P.rain * 0.4 },
		{ kind: 'treefern', key: 'treefern', genus: genus(), common: 'tree fern', height: 2.2 + r() * 1.8 + P.rain, tint: leafTint(r, P), fronds: 9 + ((r() * 5) | 0) },
		{ kind: 'taro', key: 'taro', genus: genus(), common: 'elephant ear', size: 0.8 + r() * 0.5, tint: leafTint(r, P), veins: r() < 0.5 },
		{ kind: 'pandanus', key: 'pandanus', genus: genus(), common: 'screw pine', height: 3 + r() * 2, tint: leafTint(r, P), stilts: 5 + ((r() * 4) | 0) },
	];
	const nFlowers = 2 + Math.round(P.bloom * 2);
	const flowers = [];
	const fc = [...FLOWER].sort(() => r() - 0.5);
	for (let i = 0; i < nFlowers; i++) flowers.push({ kind: 'flower', key: 'flower' + i, genus: genus(), colour: fc[i % fc.length], petals: 4 + ((r() * 4) | 0), height: 0.45 + r() * 0.45, heads: 1 + ((r() * 4) | 0), habit: r() < 0.5 ? 'meadow' : 'edge', common: `${['scarlet', 'tangerine', 'buttercup', 'orchid', 'violet', 'white', 'rose'][FLOWER.indexOf(fc[i % fc.length])]} ${['star', 'bell', 'daisy', 'lily'][(r() * 4) | 0]}` });

	// ---------- fauna ----------
	const butterflies = [];
	for (let i = 0; i < 3; i++) {
		const c = FLOWER[(r() * FLOWER.length) | 0];
		butterflies.push({ kind: 'butterfly', genus: genus(), wing: [c[0] * (0.7 + r() * 0.3), c[1] * (0.7 + r() * 0.3), c[2] * (0.7 + r() * 0.3)], edge: r() < 0.5 ? [0.05, 0.04, 0.03] : [1, 0.98, 0.9], size: 0.05 + r() * 0.05, flap: 9 + r() * 6, glide: r() < 0.35, n: 10 + ((r() * 12) | 0) });
		butterflies[i].common = butterflies[i].glide ? 'glider' : 'swallowtail';
	}
	const birds = [
		{ kind: 'songbird', genus: genus(), common: 'honeyeater', body: [0.25 + r() * 0.3, 0.3 + r() * 0.3, 0.12], head: [0.9, 0.75 + r() * 0.2, 0.15], size: 0.14 + r() * 0.06, n: 10 },
		{ kind: 'songbird', genus: genus(), common: 'fantail', body: [0.35, 0.28, 0.22], head: [0.12, 0.1, 0.1], size: 0.12 + r() * 0.05, n: 8 },
		{ kind: 'parrot', genus: genus(), common: 'lorikeet', body: [0.1 + r() * 0.2, 0.65, 0.2 + r() * 0.3], head: FLOWER[(r() * 5) | 0], size: 0.22, n: 12 + ((r() * 10) | 0) },
		{ kind: 'shorebird', genus: genus(), common: 'sandpiper', body: [0.62, 0.56, 0.46], head: [0.9, 0.88, 0.84], size: 0.16, n: 14 },
	];
	const crabs = { kind: 'crab', genus: genus(), common: 'ghost crab', colour: [0.85, 0.78, 0.62], size: 0.07 + r() * 0.03, n: 40 };
	const lizards = { kind: 'lizard', genus: genus(), common: r() < 0.5 ? 'skink' : 'gecko', colour: [0.3 + r() * 0.3, 0.4 + r() * 0.2, 0.15 + r() * 0.2], stripe: r() < 0.6, size: 0.18 + r() * 0.1, n: 24 };
	const eco = { profile: P, trees, palm, understory, flowers, butterflies, birds, crabs, lizards, community: communityField(seed) };
	return eco;
}

// which tree species dominates a stand: a coarse field picks a centre in "species
// space", a finer one allows an accent species here and there
export function communityField(seed) {
	const nz = makeNoise(seed + 4471);
	return (x, z) => ({ primary: nz.fbm(x / 260, z / 260, 2), secondary: nz.vnoise(x / 60 + 11, z / 60 - 7) });
}

export function describeLand(L) {
	const lines = [L.profile.thesis, '', 'Canopy:'];
	for (const t of L.trees) lines.push(`  ${t.genus} (${t.common}, ${t.crown} crown) ~${t.height.toFixed(0)} m`);
	lines.push(`  ${L.palm.genus} (${L.palm.common})`, 'Understory and ground:');
	for (const u of [...L.understory, ...L.flowers]) lines.push(`  ${u.genus} (${u.common})`);
	lines.push('Animals:');
	for (const b of L.butterflies) lines.push(`  ${b.genus} (${b.common} butterfly) - pollinator, visits the flowers`);
	for (const b of L.birds) lines.push(`  ${b.genus} (${b.common}) - ${{ songbird: 'insect eater, hops between crowns and the ground', parrot: 'fruit and nectar eater, travels in a flock', shorebird: 'works the swash line for sand-dwellers' }[b.kind]}`);
	lines.push(`  ${L.crabs.genus} (${L.crabs.common}) - scavenger on the beach, bolts for its burrow`);
	lines.push(`  ${L.lizards.genus} (${L.lizards.common}) - insect eater, basks on warm rock`);
	return lines.join('\n');
}
