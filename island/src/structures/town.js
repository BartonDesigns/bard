// A grown town (crysis/civgen.js) finished the way the surveyed regions are: its buildings
// settled clear of each other and of its streets (structures/overlap.js), and service alleys
// laid behind its rows of shops and downtown blocks (structures/alleys.js), added to its roads
// so the land-use map paints them and the cars and people use them like any other lane.

import { settleBoxes } from './overlap.js';
import { planAlleys } from './alleys.js';

export function finishTown(boxes, roads, seed = 1) {
	const settled = settleBoxes(boxes, roads, null, false);
	const alleys = planAlleys(boxes, roads, { seed });
	for (const r of alleys) roads.push(r);
	return { settled, alleys: alleys.length };
}
