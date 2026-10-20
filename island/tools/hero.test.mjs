// Your hero (people/hero.js): two bodies made by hand, a man and a woman, carried to friends
// in the seed alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_TAG, heroSeed, heroOf, heroDNA, lookDNA, heroChoice, setHeroChoice } from '../src/people/hero.js';
import { personDNA } from '../src/people/body.js';
import { cleanLook } from '../src/net/protocol.js';
import { ACTIONS } from '../src/people/actions.js';

test('a hero is a seed of its own, which the room passes on as it is', () => {
	for (const sex of ['male', 'female']) {
		const s = heroSeed(sex);
		assert.equal(heroOf(s), sex);
		assert.equal(cleanLook({ seed: s }).seed, s, 'the room keeps it');
		assert.equal(heroOf(cleanLook({ seed: s }).seed), sex);
	}
	// (every seed a townsperson or an older visit was given is below 2^31: never a hero)
	for (let i = 0; i < 2000; i++) assert.equal(heroOf((Math.random() * 2 ** 31) >>> 0), null);
	assert.equal(heroOf(HERO_TAG), null);
	assert.equal(heroOf(HERO_TAG | 9), null);
});

test('he and she are tall, athletic, sure of themselves, and look it', () => {
	const m = heroDNA('male'), f = heroDNA('female');
	assert.ok(m.male && m.sex > 0.9 && !f.male && f.sex < 0.1);
	assert.ok(m.height > 1.8 && f.height > 1.68, 'tall');
	assert.ok(m.muscle >= 0.25 && m.muscle <= 0.45 && f.muscle > 0.15 && m.weight < 0.1 && f.weight < 0.1, 'athletic, not inflated');
	for (const d of [m, f]) assert.ok(d.build.head < 0 && d.build.legs > 0, 'a smaller head, longer legs');
	for (const d of [m, f]) assert.ok(d.lean > 0.1 && d.lean < 0.4, 'leaner than the average body, within what the target bears');
	assert.match(fs.readFileSync(new URL('../src/people/body.js', import.meta.url), 'utf8'), /d\.weight - \(d\.lean \|\| 0\)/, 'the weight target taken away');
	assert.notDeepEqual(f.build, m.build, 'her build her own');
	assert.ok(f.freckles && !m.freckles && f.brows.dens < m.brows.dens, 'her freckles; groomed brows');
	assert.ok(m.style.top.tuck && f.style.top.tuck, 'tops tucked: no boxy hang');
	assert.ok(f.style.outer.drape < 0.5 && f.style.outer.open, 'an open overshirt that hangs a little');
	assert.ok(m.temper.confident > 0.9 && m.gait.posture < 0, 'chest up');
	assert.equal(m.age, 29);
	// (no feature pushed far: a face near the base mesh's even average, which reads handsome)
	for (const d of [m, f]) for (const [k, v] of Object.entries(d.face)) assert.ok(Math.abs(v) <= 0.45, `${k} ${v}`);
	assert.ok(m.face.jaw > 0.2 && m.face['brow-ridge'] > 0.1, 'his jaw and brow');
	assert.ok(f.face.cheekbones > 0.3 && f.face['lower-lip'] > 0.15 && f.face.jaw < 0, 'her cheekbones and lips');
	// (dressed to move in, groomed, and never grey)
	assert.equal(m.style.outer, null, 'no jacket to balloon on him');
	assert.equal(f.style.outer.kind, 'flannel'); assert.equal(f.style.outer.pat, 'plaid'); assert.equal(f.style.outer.fit, 'fitted', 'a fitted plaid overshirt');
	assert.ok(m.style.bottom.tuck && m.style.shoes.tall && f.style.bottom.tuck && !f.style.shoes.tall && m.style.shoes.built && f.style.shoes.built, 'into boots built over the feet: his tall, hers mid-height');
	assert.ok(Math.max(...m.hairColour) < 0.1 && f.hairColour[0] > 2 * f.hairColour[1], 'dark chestnut; auburn');
	for (const d of [m, f]) { assert.ok(d.style.bottom.hull && d.style.bottom.hull.taper > 0.03 && d.style.bottom.pat === 'tech', 'tailored over the legs, seams and pockets in the cloth'); assert.equal(d.style.bottom.kind, 'cargo', 'trousers with room, not leggings'); }
	assert.equal(m.style.shoes.kind, 'boot');
	assert.ok(m.style.acc.some((q) => q.kind === 'carrier' && q.compact) && m.style.acc.some((q) => q.kind === 'belt') && m.style.acc.some((q) => q.kind === 'cargo'), 'his compact carrier, a belt, bellows pockets');
	assert.ok(m.build.shoulders > f.build.shoulders && m.build.waist > 0 && f.build.waist > 0, 'the V');
	assert.equal(f.style.shoes.kind, 'boot');
	const src0 = fs.readFileSync(new URL('../src/people/garment.js', import.meta.url), 'utf8');
	assert.match(src0, /F\?\.built \? \(F\.tall \? 0\.12 : 0\.045\)/, 'trousers end inside the boots\' shafts');
	assert.match(src0, /if \(s === 3 && o\.shoes\?\.built\) continue;/, 'no sock under a built boot');
	assert.match(src0, /F\.tall \? 0\.17 : 0\.09/, 'tall boots');
	assert.match(src0, /const legHang = B\?\.hang/, 'a straight hang');
	// (the belt and the pockets are built in the loop where the torso's surface can be measured,
	// never in the one before it is declared: that threw, and every hero build with it)
	const kf = src0.indexOf('const kitField'), bk = src0.indexOf("q.kind === 'belt'"), ck = src0.indexOf("q.kind === 'cargo'");
	assert.ok(kf > 0 && bk > kf && ck > kf, 'the belt and the pockets built after the torso is measured');
	// (their hair grown as fluff for their cuts, people/hair-fluff.js: no sheets by name)
	assert.equal(m.style.hair.style, undefined);
	assert.equal(m.style.hair.cut, 'swept');
	assert.equal(m.style.hair.beard, 'stubble');
	assert.equal(f.style.hair.style, undefined);
	assert.equal(f.style.hair.cut, 'pony');
	assert.deepEqual(f.style.hair.brush.bangs, [null], 'swept back off her forehead');
	assert.equal(f.style.hair.brush.frame, 2, 'strands framing her face');
	assert.equal(f.style.hair.beard, '');
	assert.equal(m.style.hair.recede, 0);
	assert.ok(m.greyShift < 0);
	// (the same every time)
	assert.deepEqual(heroDNA('female'), heroDNA('female'));
});

test('a friend is drawn as their hero, or as the townsperson an older visit made them', () => {
	assert.equal(lookDNA(heroSeed('female')).hero, 'female');
	assert.deepEqual(lookDNA(1234), personDNA(1234, { age: 30 }));
});

test('the choice is kept, and your seed with it', () => {
	const m = new Map(), st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
	assert.equal(heroChoice(st), 'male', 'a man until chosen');
	assert.equal(setHeroChoice('female', st), 'female');
	assert.equal(heroChoice(st), 'female');
	assert.equal(+m.get('l99-me'), heroSeed('female'));
	assert.equal(setHeroChoice('wizard', st), 'male');
});

test('your body, its hands, friends and the settings all use the hero', () => {
	const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
	assert.match(src('people/avatar.js'), /const d = heroDNA\(hero, \{ look \}\);\n\t\tif \(d\.style\) d\.style = dressInGear\(d\.style, worn\);\n\t\tconst P = buildPerson\(A, d\);/);
	assert.match(src('people/avatar.js'), /async function setHero\(sex, nextLook = null\)/);
	assert.match(src('net/remotes.js'), /lookDNA\(r\.seed\)/);
	assert.match(src('net/multiplayer.js'), /const seed = heroSeed\(heroChoice\(\)\)/);
	assert.match(src('crysis/viewmodel.js'), /arms\.me !== avatar\.me/, 'the gun hands made again');
	assert.match(src('island-panel.js'), /'Your hero'/);
	assert.match(src('people/self.js'), /hero \? 'ready' : 'rest'/, 'they stand ready');
	assert.match(src('people/motion.js'), /ready: \{ both: arm/);
	assert.match(src('people/self.js'), /me\.M\.act\(leap \? 'leap' : null/, 'in the air, the legs tucked');
	assert.match(src('people/body.js'), /P\.acc\.visible = dist < 90 \|\| P\.accKeep/, 'built boots are the feet: kept at any distance');
});

test('a build broadens the shoulders, carries the arms out whole, and draws the waist in', async () => {
	const { shapeBuild } = await import('../src/people/build.js');
	// four vertices on a body 2 high: an arm's (all upper arm), the chest's middle, the chest's
	// side, the waist's side; the feet and the head mark the height
	const A = { bones: [{ name: 'spine01' }, { name: 'upperarm01.L' }], ids: new Uint8Array(24), weights: new Uint16Array(24) };
	const at = [[0.4, 1.5, 0], [0, 1.55, 0.1], [0.2, 1.55, 0.05], [0.15, 1.17, 0.1], [0, 0, 0], [0, 2, 0]];
	const p = Float32Array.from(at.flat());
	for (let v = 0; v < 6; v++) { A.ids[v * 4] = v === 0 ? 1 : 0; A.weights[v * 4] = 1000; }
	shapeBuild(p, A, { shoulders: 0.02, waist: 0.1 });
	assert.ok(Math.abs(p[0] - (0.4 + 0.04)) < 1e-6, 'the arm out whole, by 2% of the height');
	assert.ok(Math.abs(p[3]) < 1e-6, 'the middle of the chest stays');
	assert.ok(p[6] > 0.2 + 0.03, 'the side of the chest out with the shoulders');
	assert.ok(p[9] < 0.15 * 0.95 && p[11] < 0.1, 'the waist drawn in');
	assert.ok(p[13] === 0 && p[16] === 2, 'its height kept');
	const q = Float32Array.from(at.flat());
	shapeBuild(q, A, null);
	assert.deepEqual([...q], at.flat().map(Math.fround), 'no build, no change');
});

test('a build makes the head smaller about the top of the neck, and the legs longer', async () => {
	const { shapeBuild } = await import('../src/people/build.js');
	// vertices: a foot, the hip, the neck's top (the head's joint), the crown (all head), the chin (half neck)
	const at = [[0, 0, 0], [0, 1, 0], [0, 1.7, 0], [0, 2, 0], [0, 1.75, 0.1]];
	const A = { bones: [{ name: 'spine01', ids: [] }, { name: 'head', ids: [2] }, { name: 'neck01', ids: [] }], ids: new Uint8Array(20), weights: new Uint16Array(20) };
	const own = [0, 0, 1, 1, 2];
	for (let v = 0; v < 5; v++) { A.ids[v * 4] = own[v]; A.weights[v * 4] = 1000; }
	const p = Float32Array.from(at.flat());
	shapeBuild(p, A, { head: -0.1 });
	assert.ok(Math.abs(p[3 * 3 + 1] - (1.7 + 0.3 * 0.9)) < 1e-5, 'the crown 10% nearer the neck');
	assert.ok(Math.abs(p[2 * 3 + 1] - 1.7) < 1e-6, 'the neck joint stays');
	assert.ok(Math.abs(p[4 * 3 + 2] - 0.1 * 0.95) < 1e-5, 'the chin, half neck, half as much');
	const q = Float32Array.from(at.flat());
	shapeBuild(q, A, { legs: 0.1 });
	assert.ok(Math.abs(q[1] - (1 - 1.1)) < 1e-6 && q[4] === 1 && q[7] === Math.fround(1.7), 'below the hip drawn down, the rest kept');
});

test('a build fills the arms out about their bones, fullest mid-segment, nothing at the joints', async () => {
	const { shapeBuild } = await import('../src/people/build.js');
	// an arm along x: shoulder joint at 0.2, elbow at 0.5, wrist at 0.75 (each joint's marker a
	// vertex of its own); skin 4 cm off the axis at the middle of the upper arm, at the elbow, and
	// a third down the forearm; a torso point and the feet and head for the height
	const at = [[0.2, 1.5, 0], [0.5, 1.5, 0], [0.75, 1.5, 0], [0.35, 1.5, 0.04], [0.5, 1.5, 0.04], [0.583, 1.5, 0.04], [0, 1.5, 0.1], [0, 0, 0], [0, 2, 0]];
	const A = { bones: [{ name: 'spine01', ids: [] }, { name: 'upperarm01.L', ids: [0] }, { name: 'lowerarm01.L', ids: [1] }, { name: 'wrist.L', ids: [2] }, { name: 'upperarm02.L', ids: [] }], ids: new Uint8Array(36), weights: new Uint16Array(36) };
	const own = [1, 2, 3, 4, 2, 2, 0, 0, 0];
	for (let v = 0; v < at.length; v++) { A.ids[v * 4] = own[v]; A.weights[v * 4] = 1000; }
	const p = Float32Array.from(at.flat());
	shapeBuild(p, A, { arms: [0.1, 0.08] });
	assert.ok(Math.abs(p[3 * 3 + 2] - 0.044) < 1e-4, 'the upper arm 10% fuller at its middle: ' + p[11]);
	assert.ok(Math.abs(p[4 * 3 + 2] - 0.04) < 1e-4, 'nothing at the elbow');
	assert.ok(p[5 * 3 + 2] > 0.04 * 1.07, 'the forearm fuller near the elbow');
	assert.ok(p[6 * 3 + 2] === Math.fround(0.1), 'the torso untouched');
	assert.deepEqual([p[0], p[3], p[6]].map((x) => +x.toFixed(6)), [0.2, 0.5, 0.75], 'the joints stay');
});

test('the hero moves as the concept sheet does: sprint, leap, crouch, stance, reach', () => {
	for (const name of ['sprint', 'leap', 'scout', 'stance', 'climb']) {
		const k = ACTIONS[name]?.keys?.[0]?.[1];
		assert.ok(k && k.L && k.R && k.fL && k.fR && k.hp && k.sp && k.hd, name);
	}
	const { scout, stance, climb, leap, sprint } = Object.fromEntries(['scout', 'stance', 'climb', 'leap', 'sprint'].map((n) => [n, ACTIONS[n].keys[0][1]]));
	assert.ok(scout.hp[3] > 0.4 && scout.fR[2] < -0.3, 'down on one knee, the other foot back');
	assert.ok(scout.R.wflex < -0.8 && scout.R.bend < 0.3, 'a hand flat to the ground, the arm long');
	assert.ok(stance.L.curl < 0.5 && stance.R.curl < 0.5 && stance.fL[2] > 0.2, 'the hands open, the lead foot forward');
	assert.ok(climb.R.flex > 2.6 && climb.fL[1] > 0.3, 'one arm high, a foot up');
	assert.ok(leap.fL[1] > 0.4 && leap.fR[1] > 0.3, 'the legs tucked');
	assert.ok(sprint.fR[1] > 0.3 && sprint.fL[2] < -0.3, 'a knee high, driving off the back foot');
});
