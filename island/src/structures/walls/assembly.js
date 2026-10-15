// What a wall is made of, layer by layer, from the room to the street. Every wall the builders
// make (bay/houses.js, interiors/build.js) is given an assembly here from what the building is,
// when it went up and where it stands: a Californian tract house's outside wall is paper-faced
// drywall, 2x4 studs at 16 inch centres with pink batts between them, building paper, wire lath
// and three coats of stucco; a 1920s house has plaster on wood lath, no insulation and board
// sheathing under its siding; a partition is drywall both sides of empty studs (now and then a
// cable or a pipe in it); an old apartment block is plaster on two wythes of brick, a warehouse
// concrete block, an office concrete with its bars. Each layer says how much it takes from a
// fist, a round or a blast, and how much of a round gets through it.
//
// Plain numbers only (no three.js): the tests choose assemblies and push rounds through them
// (island/tools/destruction-walls.test.mjs).

// the materials. t: thickness (m); blunt: a cell's strength against blows (a punch is 8 to
// 24, a bat's heavy swing 34); ball: against rounds (a rifle's 58 puts about a third of itself
// into the cell it strikes); pass: the share of a round that goes on through it; hard: a fist
// that meets it is hurt; soft: you can push through it (it never stops a body)
export const MAT = Object.freeze({
	drywall: { t: 0.0127, blunt: 20, ball: 24, pass: 0.92, sound: 'drywall', chip: 'gypsum' },
	plaster: { t: 0.022, blunt: 34, ball: 40, pass: 0.84, sound: 'plaster', chip: 'plaster' },
	render: { t: 0.016, blunt: 70, ball: 45, pass: 0.8, sound: 'plaster', chip: 'plaster', hard: true },
	paper: { t: 0.0015, blunt: 2, ball: 1, pass: 1, soft: true, sound: 'drywall', chip: 'paper' },
	osb: { t: 0.011, blunt: 110, ball: 50, pass: 0.86, sound: 'wood', chip: 'splinter' },
	plywood: { t: 0.012, blunt: 120, ball: 55, pass: 0.85, sound: 'wood', chip: 'splinter' },
	boards: { t: 0.019, blunt: 150, ball: 60, pass: 0.8, sound: 'wood', chip: 'splinter' },
	siding: { t: 0.018, blunt: 95, ball: 45, pass: 0.85, sound: 'wood', chip: 'splinter' },
	stucco: { t: 0.022, blunt: 150, ball: 70, pass: 0.62, sound: 'stucco', chip: 'stucco', hard: true },
	gap: { t: 0.025, blunt: 0, ball: 0, pass: 1, soft: true, sound: 'none', chip: 'none' },
	brick: { t: 0.1, blunt: 900, ball: 300, pass: 0.05, sound: 'brick', chip: 'brick', hard: true, unit: [0.215, 0.065, 0.01] },
	block: { t: 0.19, blunt: 800, ball: 260, pass: 0.12, sound: 'brick', chip: 'block', hard: true, unit: [0.39, 0.19, 0.01] },
	concrete: { t: 0.2, blunt: 2600, ball: 520, pass: 0, sound: 'concrete', chip: 'concrete', hard: true },
	// what fills a stud bay, and the studs themselves
	batt: { blunt: 14, ball: 6, pass: 0.97, soft: true, sound: 'batt', chip: 'tuft' },
	rockwool: { blunt: 18, ball: 8, pass: 0.95, soft: true, sound: 'batt', chip: 'tuft' },
	air: { blunt: 0, ball: 0, pass: 1, soft: true, sound: 'none', chip: 'none' },
	stud: { w: 0.038, blunt: 260, ball: 150, pass: 0.5, sound: 'wood', chip: 'splinter', hard: true },
	steel: { w: 0.041, blunt: 700, ball: 90, pass: 0.7, sound: 'steel', chip: 'none', hard: true },
	// what is embedded in a layer: the stucco's wire, the old plaster's wooden strips, the bars
	wire: { blunt: 220, ball: 400 },
	lath: { blunt: 90, ball: 60 },
	rebar: { blunt: 9000, ball: 4000, spacing: 0.2 },
});

// the assemblies, room side first. A cavity layer is the studs and what fills between them
// (fill, facing: the kraft paper on a faced batt); lath and rebar ride in their layer.
const L = (m, o = {}) => ({ m, t: o.t ?? MAT[m].t, ...o });
const CAV = (o = {}) => ({ m: 'cavity', t: 0.089, stud: 'stud', fill: 'batt', spacing: 0.406, ...o });
export const ASSEMBLY = Object.freeze({
	// a tract house: drywall, studs and batts, paper, wire, stucco (no sheathing: California's
	// three coats over open framing)
	stuccoTract: { kind: 'wood', layers: [L('drywall'), CAV({ facing: 'kraft' }), L('paper'), L('stucco', { lath: 'wire' })] },
	// a new house: the same with OSB sheathing and a house wrap
	stuccoNew: { kind: 'wood', layers: [L('drywall'), CAV({ facing: null }), L('osb'), L('paper'), L('stucco', { lath: 'wire' })] },
	// postwar: drywall over studs with nothing in the bays, paper, wire, stucco
	stuccoPostwar: { kind: 'wood', layers: [L('drywall'), CAV({ fill: 'air' }), L('paper'), L('stucco', { lath: 'wire' })] },
	// before the war: plaster on wood lath, empty bays, board sheathing, paper, stucco
	stuccoPrewar: { kind: 'wood', layers: [L('plaster', { lath: 'lath' }), CAV({ fill: 'air' }), L('boards'), L('paper'), L('stucco', { lath: 'wire' })] },
	// sided houses
	sidingPrewar: { kind: 'wood', layers: [L('plaster', { lath: 'lath' }), CAV({ fill: 'air' }), L('boards'), L('paper'), L('siding')] },
	sidingTract: { kind: 'wood', layers: [L('drywall'), CAV({ facing: 'kraft' }), L('plywood'), L('paper'), L('siding')] },
	sidingNew: { kind: 'wood', layers: [L('drywall'), CAV({ facing: null }), L('osb'), L('paper'), L('siding')] },
	// a brick veneer house: one wythe tied on outside the sheathing, an air gap behind it
	veneer: { kind: 'wood', layers: [L('drywall'), CAV({ facing: 'kraft' }), L('osb'), L('paper'), L('gap'), L('brick', { t: 0.09 })] },
	// partitions: drywall both sides of empty studs; plaster and lath in the old houses; steel
	// studs in offices and shops
	partition: { kind: 'wood', layers: [L('drywall'), CAV({ fill: 'air' }), L('drywall')] },
	partitionPlaster: { kind: 'wood', layers: [L('plaster', { lath: 'lath' }), CAV({ fill: 'air' }), L('plaster', { lath: 'lath' })] },
	partitionSteel: { kind: 'steel', layers: [L('drywall'), CAV({ stud: 'steel', fill: 'batt', facing: null, t: 0.092, spacing: 0.61 }), L('drywall')] },
	// masonry
	brick: { kind: 'brick', layers: [L('plaster'), L('brick'), L('brick')] },
	brickRender: { kind: 'brick', layers: [L('plaster'), L('brick'), L('brick'), L('render')] },
	block: { kind: 'block', layers: [L('paper', { t: 0.002, paint: true }), L('block')] },
	blockPartition: { kind: 'block', layers: [L('paper', { t: 0.002, paint: true }), L('block'), L('paper', { t: 0.002, paint: true })] },
	concrete: { kind: 'concrete', layers: [L('drywall'), L('gap', { t: 0.02 }), L('concrete', { rebar: 0.2 })] },
	concreteBare: { kind: 'concrete', layers: [L('concrete', { rebar: 0.2 })] },
	// a Japanese town's light timber walls: plaster board, studs, wool, board, plaster render
	timberJp: { kind: 'wood', layers: [L('drywall'), CAV({ fill: 'rockwool', facing: null, t: 0.1, spacing: 0.455 }), L('plywood'), L('paper'), L('render')] },
});

// the age of a building from whatever its builder knows: the houses' eras (bay/decor.js
// houseEra), the streets' (bay/streetera.js) or the interiors' styles (interiors/build.js)
const AGE = {
	historic: 'old', prewar: 'old', victorian: 'old', edwardian: 'old', mission: 'old',
	ranch: 'mid', split: 'mid', postwar: 'mid', sunset: 'mid',
	tract: 'late', plain: 'late',
	modern: 'new', new: 'new',
};
export const ageOf = (era) => AGE[era] || 'late';

// the assembly of one wall. use: what the building is (house, row, apt, shop, office, store,
// warehouse, school, garage2, parking, shed, site); era: as above; ext: an outside wall;
// siding: the house's outside ('stucco', 'lap', 'batten', 'shingle', 'brick'); region: 'us',
// 'eu' (the European villages: masonry rendered), 'jp' (the Japanese towns: light timber)
export function assemblyFor({ use = 'house', era = 'tract', ext = false, siding = 'stucco', region = 'us' } = {}) {
	const age = ageOf(era);
	if (region === 'eu') return ext ? 'brickRender' : age === 'new' ? 'partition' : 'partitionPlaster';
	if (region === 'jp') return ext ? 'timberJp' : 'partition';
	const homes = use === 'house' || use === 'row';
	if (homes) {
		if (!ext) return age === 'old' ? 'partitionPlaster' : 'partition';
		if (siding === 'brick') return age === 'old' ? 'brick' : 'veneer';
		// (a city row house is clapboard over boards, but for the Sunset's stucco fronts)
		const sided = use === 'row' ? era !== 'sunset' : siding && siding !== 'stucco';
		if (age === 'old') return sided ? 'sidingPrewar' : 'stuccoPrewar';
		if (age === 'mid') return sided ? 'sidingTract' : 'stuccoPostwar';
		if (age === 'new') return sided ? 'sidingNew' : 'stuccoNew';
		return sided ? 'sidingTract' : 'stuccoTract';
	}
	if (use === 'apt') {
		if (!ext) return age === 'old' ? 'partitionPlaster' : 'partition';
		return age === 'old' ? 'brick' : age === 'new' ? 'stuccoNew' : 'stuccoTract';
	}
	if (use === 'shop') {
		if (!ext) return age === 'old' ? 'partitionPlaster' : 'partitionSteel';
		return age === 'old' ? 'brick' : 'block';
	}
	if (use === 'office' || use === 'site') return ext ? 'concrete' : 'partitionSteel';
	if (use === 'store' || use === 'school') return ext ? 'block' : use === 'school' ? 'blockPartition' : 'partitionSteel';
	if (use === 'warehouse' || use === 'parking') return ext ? 'concreteBare' : 'blockPartition';
	if (use === 'garage2' || use === 'shed') return ext ? 'block' : 'partition';
	return ext ? 'stuccoTract' : 'partition';
}

// the layers laid across a wall of thickness T between a0 and a1 (the builder's coordinate
// across it): room side first, the core stretched or squeezed to make up the thickness.
// inside: +1 if the room (side A) is at a1, -1 if at a0. A partition's side A is a0.
export function layersFor(id, a0, a1, inside = -1) {
	const A = ASSEMBLY[id] || ASSEMBLY.partition, T = Math.abs(a1 - a0);
	const sum = A.layers.reduce((s, l) => s + l.t, 0);
	// (the core: the cavity, else the thickest)
	let core = A.layers.findIndex((l) => l.m === 'cavity');
	if (core < 0) core = A.layers.reduce((b, l, i) => (l.t > A.layers[b].t ? i : b), 0);
	const extra = T - sum;
	const out = [];
	let a = inside > 0 ? Math.max(a0, a1) : Math.min(a0, a1);
	const dir = inside > 0 ? -1 : 1;
	for (let i = 0; i < A.layers.length; i++) {
		const l = A.layers[i];
		let t = l.t + (i === core ? extra : 0);
		if (t < 0.0008) t = 0.0008;
		const b = a + dir * t;
		out.push({ ...l, i, lo: Math.min(a, b), hi: Math.max(a, b), t });
		a = b;
	}
	return { id, kind: A.kind, layers: out, dir, core };
}

// where the studs stand in a run of wall from u0 to u1: one at each end (the end studs at a
// corner or beside an opening) and every spacing from the wall's own start s
export function studsFor(u0, u1, s, spacing = 0.406, w = 0.038) {
	const out = [u0 + w / 2];
	const first = s + Math.ceil((u0 + w * 1.5 - s) / spacing) * spacing;
	for (let u = first; u < u1 - w * 1.5; u += spacing) out.push(u);
	out.push(u1 - w / 2);
	return out;
}

// a round through the layers at a cell: dmg in, side 0 (from the low-a face) or 1 (the high-a face); broken(i)
// says whether layer i is already broken there; onStud whether the cell is over a stud.
// Returns { out (what goes on), stoppedIn (the layer that stopped it, or -1), spent: per layer }
export function penetrate(stack, dmg, side = 0, broken = () => false, onStud = false) {
	const asc = [...stack.layers].sort((a, b) => a.lo - b.lo), ls = side ? asc.reverse() : asc;
	let d = dmg, stoppedIn = -1;
	const spent = [];
	for (const l of ls) {
		if (d <= 0) { spent.push(0); continue; }
		let pass;
		if (broken(l.i)) pass = 1;
		else if (l.m === 'cavity') pass = onStud ? MAT[l.stud].pass : MAT[l.fill].pass;
		else pass = MAT[l.m].pass;
		const left = d * pass;
		spent.push(d - left);
		d = left;
		if (d < 4) { stoppedIn = l.i; d = 0; }
	}
	// (spent: by the layers' own order)
	const byIndex = stack.layers.map(() => 0);
	ls.forEach((l, k) => { byIndex[l.i] = spent[k]; });
	return { out: d, stoppedIn, spent: byIndex };
}

// how strong layer l is at a cell against a kind of blow ('blunt' or 'ball')
export function strength(l, kind, onStud = false) {
	if (l.m === 'cavity') return onStud ? MAT[l.stud][kind] : MAT[l.fill][kind];
	return MAT[l.m][kind];
}
// is a layer hard to a fist at a cell (a stud behind thin board counts)
export const hardAt = (l, onStud) => (l.m === 'cavity' ? onStud : !!MAT[l.m].hard);
// is it something a body cannot push through while it stands (cells of it unbroken)
export const solidTo = (l, onStud) => (l.m === 'cavity' ? onStud : !MAT[l.m].soft);
