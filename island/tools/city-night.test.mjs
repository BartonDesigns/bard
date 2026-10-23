// A town by night (src/world/sky.js, src/island-frame.js): the light of its lamps off the low
// sky and the lit streets fills every shade in town, so a wall turned from the moon is still
// there to see, and the far painted blocks and the buildings built up close share one night.
// The walk-in shops' outside walls take the lamps near them (src/bay/commercial.js), as the
// painted block they take over from does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

test('the town light fills the shade by night, from how built up it is round you', () => {
	const frame = src('island-frame.js'), sky = src('world/sky.js');
	assert.match(frame, /shared\.uCityLight \|\| \(shared\.uCityLight = \{ value: 0 \}\)/);
	// (the Bay's town map, and out on the globe the town grown round you: earth/globetowns.js)
	assert.match(frame, /for \(const \[dx, dz\] of CITY_AT\) \{[^\n]*u \+= Math\.max\(W\.bayArea\.urbanAt\(x, z\)\.u, low > 0 \? GT\.urbanAt\(x, z\) \* low : 0\)/);
	// (by night only, and none in vacuum)
	assert.match(sky, /const cityK = night \* \(shared\.uCityLight\?\.value \|\| 0\) \* \(vacuum \? 0 : 1\);/);
	// from above and below: the hemisphere light every building's material already takes, so near
	// and far stay alike, and no light of three's is added (a phone's lamp count never changes)
	assert.match(sky, /hemi\.color\.r \+= CITY_SKY\.r \* cityK/);
	assert.match(sky, /hemi\.groundColor\.r \+= CITY_GROUND\.r \* cityK/);
	assert.ok(sky.indexOf('cityK') < sky.indexOf('shared.uAmbient.value.copy(hemi.color)'), 'the far trees\' ambient follows it');
	assert.doesNotMatch(sky.slice(sky.indexOf('const cityK')), /new THREE\.(Point|Spot)Light/);
});

test('a walk-in shop\'s outside walls take the lamps near them', () => {
	const c = src('bay/commercial.js');
	assert.match(c, /import \{ addNightField \} from '\.\.\/world\/nightfield\.js';/);
	assert.match(c, /const outside = mats\.wall\.clone\(\);[^\n]*\n[^\n]*\n[^\n]*\n\t\taddNightField\(outside\);/);
});
