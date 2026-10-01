// The Earth atlas's facts, gathered: bundled on their own (dist/earth-atlas.js, see
// build.mjs) and loaded by ../atlas.js only when first asked for.

import * as NA from './na.js';
import * as ATL from './atlantic.js';
import * as EU from './europe.js';
import * as AF from './africa.js';
import * as AS from './asia.js';
import * as EA from './eastasia.js';
import * as REST from './rest.js';
import * as POLAR from './polar.js';

const PARTS = [NA, ATL, EU, AF, AS, EA, REST, POLAR];
export const VERSION = 1;
export const REGIONS = PARTS.flatMap((p) => p.REGIONS);
export const CITIES = PARTS.flatMap((p) => p.CITIES);
