// The planters' farthest level (bay/lantana.js): a third of the far one's triangles, still a bed
// (mounds, yellow heads, leaves and cards), standing within the bed as the others do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { plantingBed, BED_LEN, BED_DEPTH } from '../src/bay/lantana.js';

test('the planters\' farthest level: a third of the far one\'s triangles, within the bed', () => {
	const B = plantingBed(7311), tris = (T) => T.body.index.count / 3 + T.cards.index.count / 3;
	assert.ok(B.distant, 'four levels');
	assert.ok(tris(B.distant) * 2.5 < tris(B.far), `${tris(B.distant)} against ${tris(B.far)}`);
	assert.ok(tris(B.distant) > 40, 'still a bed: mounds, heads, leaves and cards');
	for (const T of [B.far, B.distant]) {
		T.body.computeBoundingBox();
		const bb = T.body.boundingBox;
		assert.ok(bb.min.x > -BED_LEN && bb.max.x < BED_LEN && bb.min.z > -BED_DEPTH && bb.max.z < BED_DEPTH && bb.max.y < 1.2);
	}
	// (its yellow heads: some of the far level's yellow, not none)
	const yellow = (g) => { const c = g.attributes.color.array; let n = 0; for (let i = 0; i < c.length; i += 3) if (c[i] > 0.5 && c[i + 1] > 0.3 && c[i + 2] < 0.2) n++; return n; };
	assert.ok(yellow(B.distant.body) > 0);
});
