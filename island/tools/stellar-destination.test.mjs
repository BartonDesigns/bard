import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';
import { planIslandFields } from '../src/sportsfields.js';
import { planColony } from '../src/planet/colony/plan.js';
import { planRealm } from '../src/planet/medieval/plan.js';
import { planArch } from '../src/planet/arch/plan.js';
import { planWaters } from '../src/planet/waters.js';
import { planCaves } from '../src/planet/cavenet.js';
import { planAlien } from '../src/planet/alien.js';

// The native horizon's first visit must create the actual realm gate after the
// production terrain planners have reserved their footprints and carved water.
for (const isPhone of [true, false]) test(`first horizon destination has an Event Ring (${isPhone ? 'phone' : 'desktop'})`, async () => {
 const seed = 2281969, profile = planetProfile('SINGULARITY', seed);
 const island = generateIsland({ seed, profile, resolution: isPhone ? 640 : 768 });
 const fields = planIslandFields(island, profile);
 const colony = planColony(island, profile, { avoid: fields.clear, isPhone });
 if (colony) fields.clear.push(...colony.clear);
 const realm = planRealm(island, profile, { fields: fields.clear, isPhone });
 const arch = planArch(island, profile, { avoid: [...fields.clear, ...(realm?.clear || [])], roads: realm?.roads, isPhone });
 if (arch) fields.clear.push(...arch.clear);
 const water = await planWaters(island, profile, { clear: [...fields.clear, ...(realm?.clear || [])], realm });
 if (water) island.inWater = water.inWater;
 const caves = planCaves(island, profile);
 assert.ok(!realm?.noAliens);
 const alien = planAlien(island, profile, { holes: caves?.holes, fields: [...fields.clear, ...(realm?.clear || [])], isPhone });
 assert.equal(alien.sites[0]?.kind, 'landmark');
 assert.match(alien.sites[0].name, /^Event Ring/);
 assert.ok(Number.isFinite(alien.sites[0].y));
});
