// The towns far off read as trees and roofs, not as a lake (Josh 2026-10-24, Mt Diablo from San
// Ramon: south Danville 4-5 km out drew as shiny blue-grey plates). Past the trees city.js stands
// round you, the coarse maps carry their trees' crowns in the alpha (bay/canopy.js), the ground
// paints them, more of them the lower you look, and the maps are mipmapped so a far block is its
// mean, not one cell in so many crawling in streaks.
//   node --test island/tools/far-crowns.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canopyInto, canopyAt, FAR_CROWNS } from '../src/bay/canopy.js';
import { generateTown } from '../src/crysis/civgen.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const terrain = fs.readFileSync(path.join(here, '../src/bay/terrain.js'), 'utf8');
const realcity = fs.readFileSync(path.join(here, '../src/bay/realcity.js'), 'utf8');

// a map of w x h cells of `step` m, every cell residential (G = 16) and on the map (A = 255)
const blank = (w, h, step = 10, lu = 1) => {
	const px = new Uint8Array(w * h * 4);
	for (let k = 0; k < w * h; k++) { px[k * 4 + 1] = lu * 16; px[k * 4 + 3] = 255; }
	return { px, w, h, x0: 0, z0: 0, step };
};

test('a map\'s alpha becomes how much of each cell the crowns cover', () => {
	const M = blank(8, 8);
	M.px[(7 * 8 + 7) * 4 + 3] = 0;                                  // (a cell off the map)
	canopyInto(M, [{ x: 40, z: 40, h: 10 }, { x: 70, z: 70, h: 10 }, { x: 15, z: 15, h: 1.2, shrub: true }]);
	assert.equal(M.px[(7 * 8 + 7) * 4 + 3], 0, 'off the map stays off it, whatever stands there');
	const floor = canopyAt(M, 5, 75);
	assert.equal(floor, 0, 'a neighbourhood has the trees its map has, no more');
	const P = blank(2, 2, 10, 2);
	canopyInto(P, []);
	assert.ok(canopyAt(P, 5, 5) > 0.02 && canopyAt(P, 5, 5) < 0.05, 'a park has a few whatever its map says');
	// a 10 m tree's crown (4 m round, 50 m2) over the four cells round its trunk at 40, 40
	let sum = 0;
	for (const [x, z] of [[35, 35], [45, 35], [35, 45], [45, 45]]) sum += canopyAt(M, x, z) - floor;
	assert.ok(Math.abs(sum - Math.PI * 16 / 100) < 0.03, 'its crown\'s area spread over them: ' + sum);
	assert.ok(Math.abs(canopyAt(M, 15, 15) - floor) < 1e-9, 'a shrub is not a crown');
	assert.equal(canopyAt(M, -5, 5), null);
});

test('a grown town carries its trees in its map, and the real regions theirs', () => {
	const heightAt = (x, z) => 20 + Math.sin(x / 900) * 3 + Math.cos(z / 700) * 3;
	const T = generateTown({ seed: 7, cx: 0, cz: 0, radius: 900, heightAt, style: 'suburb', name: 'Leafton', ang: 0.2 });
	assert.ok(T.map.canopy, 'the map says its crowns are in');
	let res = 0, cov = 0, off = 0;
	for (let k = 0; k < T.map.w * T.map.h; k++) {
		const lu = Math.round(T.map.px[k * 4 + 1] / 16), a = T.map.px[k * 4 + 3];
		assert.ok(a >= 1, 'every cell of a grown town\'s map is on it');
		if (lu === 1) { res++; cov += (a - 1) / 254; } else if (lu === 0) off += (a - 1) / 254;
	}
	assert.ok(res > 1000, 'the town has its neighbourhoods');
	assert.ok(cov / res > 0.08, 'its yards and streets are planted: ' + (cov / res).toFixed(3));
	// (and the baked regions put theirs in as they load, and the composed map keeps them)
	assert.match(realcity, /const CS = canopySteps\(map, own\);\s*while \(!CS\.next\(\)\.done\) await breathe\(\);/);
	assert.match(realcity, /comp\.px\[d \+ 3\] = M\.px\[s \+ 3\];/);
	assert.match(realcity, /if \(!M\.canopy\) \{ canopyInto\(M, D\.trees \|\| \[\]\); M\.canopy = true; \}/);
});

test('the coarse maps are mipmapped, and read with the ground\'s own footprint', () => {
	assert.match(realcity, /tex\.minFilter = THREE\.LinearMipmapLinearFilter; tex\.generateMipmaps = true;/);
	assert.equal((realcity.match(/mapFilter\((comp\.tex|tex|G\.tex)\)/g) || []).length, 2, 'the composed map and a grown town\'s');
	// (the derivatives taken where every pixel runs, before the branches that read the map)
	const dx = terrain.indexOf('vec2 bwDx = dFdx(vBW), bwDy = dFdy(vBW);'), branch = terrain.indexOf('if (inRealAny(vBW)) {', dx);
	assert.ok(dx > 0 && branch > dx, 'footprint taken before the town branches');
	assert.match(terrain, /vec4 M = mainR \? textureGrad\(uRealMap, uvM, bwDx \/ \(uRealR\.z \* MS\), bwDy \/ \(uRealR\.z \* MS\)\) : vec4\(0\.0\);/);
	// (the crowns' cover over the stretch a low look crosses under them: the trees in front hide a roof too)
	assert.match(terrain, /textureLod\(uRealMap, uvM, log2\(max\(max\(12\.0 \* cotV, length\(bwDx\) \+ length\(bwDy\)\), 8\.0\) \/ uRealR\.z\)\)\.a/);
});

// the shader's townSeen, in JS
const townSeen = (cov, roof, sinE) => {
	const cotE = Math.min(Math.sqrt(Math.max(1 - sinE * sinE, 0)) / Math.max(sinE, 0.01), 4.5);
	return [1 - Math.exp(-cov * (1.2 + 0.9 * cotE)), 1 - Math.exp(-roof * (1 + 0.25 * cotE))];
};

test('looked at from low down, a leafy suburb is crowns with roofs in it; from above, its yards show', () => {
	assert.match(terrain, /float cotE = min\(sqrt\(max\(1\.0 - sinE \* sinE, 0\.0\)\) \/ max\(sinE, 0\.01\), 4\.5\);\s*return vec2\(1\.0 - exp\(-cov \* \(1\.2 \+ 0\.9 \* cotE\)\), 1\.0 - exp\(-roof \* \(1\.0 \+ 0\.25 \* cotE\)\)\);/, 'the JS copy matches the shader');
	// Danville from the hills over San Ramon: 4.7 km off, 210 m below (the eastbay map's residential mean: crowns 0.23, roofs 0.45)
	const [cr, rf] = townSeen(0.23, 0.45 * 0.9, 210 / 4700);
	assert.ok(cr > 0.6 && cr < 0.85, 'mostly crowns: ' + cr.toFixed(2));
	const roofs = (1 - cr) * rf, ground = (1 - cr) * (1 - rf);
	assert.ok(roofs > 0.12, 'roofs showing through: ' + roofs.toFixed(2));
	assert.ok(ground < 0.15, 'hardly a yard or a street: ' + ground.toFixed(2));
	// straight down from a plane, the crowns are about what they cover
	const [top] = townSeen(0.23, 0.4, 1);
	assert.ok(Math.abs(top - 0.23) < 0.05, 'from above, what they cover: ' + top.toFixed(2));
	// a new subdivision, few trees yet: roofs more than crowns even from low down
	const [nc, nr] = townSeen(0.06, 0.5, 0.045);
	assert.ok(nc < 0.4 && (1 - nc) * nr > nc, 'young streets read as roofs');
});

test('the painted crowns come in where the trees\' far pictures go', () => {
	const city = fs.readFileSync(path.join(here, '../src/bay/city.js'), 'utf8');
	const far = city.match(/far: \[(\d+), (\d+), (\d+), (\d+)\], shrub:/g).map((s) => s.match(/\d+/g).map(Number));
	// (phone, computer: city.js LOD.far)
	assert.equal(far.length, 2);
	for (const [, , out0, out1] of far) assert.ok(FAR_CROWNS[1] >= out0 - 400 && FAR_CROWNS[0] < out1, 'crowns overlap the dissolve ' + out0 + '-' + out1 + ': ' + FAR_CROWNS);
	assert.match(terrain, /float asph = mix\(M\.r \* 0\.85 \* groundSeen, RM\.r, edge\)/, 'far streets only where nothing hides them');
});

test('the far roofs wear the houses\' own colours, not a pale grey the haze turns to water', () => {
	const city = fs.readFileSync(path.join(here, '../src/bay/city.js'), 'utf8');
	const roofs = JSON.parse(city.match(/const REAL_ROOF = (\[\[.*?\]\]);/)[1]);
	const mean = [0, 1, 2].map((k) => roofs.reduce((s, r) => s + r[k], 0) / roofs.length);
	const m = terrain.match(/vec3 roofC = mix\(vec3\(([\d., ]+)\), vec3\(([\d., ]+)\), gnR\)/);
	assert.ok(m, 'the far roofs\' colour');
	const a = m[1].split(',').map(Number), b = m[2].split(',').map(Number);
	for (let k = 0; k < 3; k++) assert.ok(Math.abs((a[k] + b[k]) / 2 - mean[k]) < 0.03, 'channel ' + k + ': ' + ((a[k] + b[k]) / 2).toFixed(3) + ' vs the houses\' ' + mean[k].toFixed(3));
});
