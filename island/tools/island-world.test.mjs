// createIslandWorld (main.js) shares its bindings with the modules that hold its biggest phases
// (island-build.js, island-frame.js, island-panel.js, island-teardown.js) through one object,
// iw, made of a getter (and for what changes, a setter) per binding. A name a module takes from
// iw that has no getter there would silently be undefined, so these keep the two in step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const MODULES = ['island-build.js', 'island-frame.js', 'island-panel.js', 'island-teardown.js'];
const main = src('main.js');
const block = main.slice(main.indexOf('\tconst iw = {'), main.indexOf('\n\t};', main.indexOf('\tconst iw = {')));
const getters = new Set([...block.matchAll(/get ([A-Za-z_$][\w$]*)\(\)/g)].map((m) => m[1]));
const setters = new Set([...block.matchAll(/set ([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]));
const uses = MODULES.map((f) => {
	const text = src(f);
	const taken = new Set((/const \{([^}]*)\} = iw;/.exec(text)?.[1] || '').split(',').map((s) => s.trim()).filter(Boolean));
	const read = new Set([...text.matchAll(/\biw\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
	const written = new Set([
		...[...text.matchAll(/\biw\.([A-Za-z_$][\w$]*)\s*(?:[-+*/%]?=(?!=)|\+\+|--)/g)].map((m) => m[1]),
		...[...text.matchAll(/(?:\+\+|--)iw\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
	]);
	return { f, taken, read, written };
});

test('main.js makes the island world, and each moved phase hands over to its module', () => {
	assert.ok(getters.size > 50);
	for (const [name, as] of [['buildWorld', 'islandBuild'], ['tick', 'islandFrame'], ['buildPanel', 'islandPanel'], ['teardown', 'islandTeardown']]) {
		assert.match(main, new RegExp(`function ${name}\\(([\\w, ]*)\\) \\{ return ${as}\\(iw`));
	}
});

test('everything a module takes from iw has a getter, and everything it sets has a setter', () => {
	for (const { f, taken, read, written } of uses) {
		for (const n of [...taken, ...read]) assert.ok(getters.has(n), `${f} uses iw.${n}, which main.js does not provide`);
		for (const n of written) assert.ok(setters.has(n), `${f} sets iw.${n}, which main.js cannot set`);
		// a binding that changes is never copied out at the top: the copy would go stale
		for (const n of taken) assert.ok(!setters.has(n), `${f} copies ${n}, which changes`);
	}
});

test('iw provides nothing that no module uses', () => {
	const used = new Set(uses.flatMap(({ taken, read }) => [...taken, ...read]));
	for (const n of getters) assert.ok(used.has(n), `iw.${n} is provided but unused`);
});
