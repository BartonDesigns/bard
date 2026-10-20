// Five big functions share their bindings with the modules their biggest parts moved to, each
// through one object made of a getter (and for what changes, a setter) per binding:
// createIslandWorld's iw, createCity's cc, accessoryGeometry's ga, createGuide's gd and
// createCombat's cb. A name a module takes from the object that has no getter there would
// silently be undefined, so these keep each object and its modules in step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// (whole-line comments left out: they name the object too)
const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
const SPLITS = [
	{ owner: 'main.js', ctx: 'iw', modules: ['island-build.js', 'island-frame.js', 'island-panel.js', 'island-teardown.js'] },
	{ owner: 'bay/city.js', ctx: 'cc', modules: ['bay/city-blocks.js', 'bay/city-dressing.js'] },
	{ owner: 'people/garment.js', ctx: 'ga', modules: ['people/garment-gloves.js', 'people/garment-tube.js', 'people/garment-armour.js'] },
	{ owner: 'guide/guide.js', ctx: 'gd', modules: ['guide/guide-screens.js', 'guide/guide-ask.js'] },
	{ owner: 'combat/combat.js', ctx: 'cb', modules: ['combat/combat-shots.js', 'combat/combat-director.js'] },
];

function read({ owner, ctx, modules }) {
	const text = src(owner), open = `\tconst ${ctx} = {`, at = text.indexOf(open);
	assert.ok(at > 0, `${owner} makes ${ctx}`);
	const block = text.slice(at, text.indexOf('\n\t};', at));
	const getters = new Set([...block.matchAll(/get ([A-Za-z_$][\w$]*)\(\)/g)].map((m) => m[1]));
	const setters = new Set([...block.matchAll(/set ([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]));
	const uses = modules.map((f) => {
		const t = src(f);
		const taken = new Set([...t.matchAll(new RegExp(`const \\{([^}]*)\\} = ${ctx};`, 'g'))].flatMap((m) => m[1].split(',')).map((s) => s.trim()).filter(Boolean));
		const reads = new Set([...t.matchAll(new RegExp(`\\b${ctx}\\.([A-Za-z_$][\\w$]*)`, 'g'))].map((m) => m[1]));
		const written = new Set([
			...[...t.matchAll(new RegExp(`\\b${ctx}\\.([A-Za-z_$][\\w$]*)\\s*(?:[-+*/%]?=(?!=)|\\+\\+|--)`, 'g'))].map((m) => m[1]),
			...[...t.matchAll(new RegExp(`(?:\\+\\+|--)${ctx}\\.([A-Za-z_$][\\w$]*)`, 'g'))].map((m) => m[1]),
		]);
		const exported = [...t.matchAll(new RegExp(`export (?:async )?function ([A-Za-z_$][\\w$]*)\\(${ctx}\\b`, 'g'))].map((m) => m[1]);
		return { f, taken, reads, written, exported };
	});
	return { text, getters, setters, uses };
}

for (const split of SPLITS) {
	const { owner, ctx } = split;
	const { text, getters, setters, uses } = read(split);

	test(`${owner}: each moved part hands over to its module with ${ctx}`, () => {
		assert.ok(getters.size > 10);
		for (const { f, exported } of uses) {
			assert.ok(exported.length, `${f} exports its parts`);
			for (const as of exported) assert.ok(text.includes(`${as}(${ctx}`), `${owner} never hands over to ${as}`);
		}
	});

	test(`${owner}: everything a module takes from ${ctx} has a getter, and everything it sets has a setter`, () => {
		for (const { f, taken, reads, written } of uses) {
			for (const n of [...taken, ...reads]) assert.ok(getters.has(n), `${f} uses ${ctx}.${n}, which ${owner} does not provide`);
			for (const n of written) assert.ok(setters.has(n), `${f} sets ${ctx}.${n}, which ${owner} cannot set`);
			// a binding that changes is never copied out at the top: the copy would go stale
			for (const n of taken) assert.ok(!setters.has(n), `${f} copies ${n}, which changes`);
		}
	});

	test(`${owner}: ${ctx} provides nothing that no module uses`, () => {
		const used = new Set(uses.flatMap(({ taken, reads }) => [...taken, ...reads]));
		for (const n of getters) assert.ok(used.has(n), `${ctx}.${n} is provided but unused`);
	});
}
