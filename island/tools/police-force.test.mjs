// The police of the place you are in (law/force.js): the Bay's city departments and county
// sheriffs, the state patrols, the national forces abroad, the faction's name and officers
// following the force, the stations named for it, and the borders that decide which country.
// node island/tools/police-force.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as ATLAS_DATA from '../src/earth/data/index.js';
import { useAtlasData } from '../src/earth/atlas.js';
import { forceAt, bayForce, localForce, setLocalForce, onForceChange, setForceLocator, forceAtXZ, inCanada, inMexico, usState, GENERIC } from '../src/law/force.js';
import { FACTIONS } from '../src/combat/factions.js';
import { serviceName, signOf } from '../src/services/names.js';
import { establish } from '../src/economy/establishments.js';

useAtlasData(ATLAS_DATA);

const at = (lat, lon) => forceAt(lat, lon);

test('nobody is the Harbour Police any more', () => {
	for (const F of [GENERIC, at(37.76, -122.418), at(53.35, -6.26), at(48.8566, 2.3522)]) {
		for (const v of [F.name, F.word, F.sub, F.officer, F.tac, F.air, F.station]) assert.ok(!/harbou?r/i.test(v), v);
	}
});

test('a Bay city is policed by its own department', () => {
	const sf = at(37.76, -122.418);
	assert.equal(sf.name, 'San Francisco Police');
	assert.equal(sf.word, 'POLICE');
	assert.equal(sf.sub, 'SAN FRANCISCO');
	assert.equal(sf.officer, 'a San Francisco Police officer');
	assert.match(sf.station, /^San Francisco Police, .+ Station$/);
	assert.equal(at(37.844, -122.251).name, 'Oakland Police');
	assert.equal(at(37.69, -122.47).name, 'Daly City Police');
	assert.equal(at(37.906, -122.065).name, 'Walnut Creek Police');
	assert.equal(at(37.3382, -121.8863).name, 'San Jose Police');
	assert.equal(at(37.702, -121.936).name, 'Dublin Police Services');
	assert.equal(at(37.369, -122.036).name, 'Sunnyvale Public Safety');
	assert.equal(at(37.934, -122.535).name, 'Central Marin Police');
});

test('outside city limits, and in the towns that hire it, the county sheriff', () => {
	const cv = at(37.694, -122.086);
	assert.equal(cv.name, 'Alameda County Sheriff');
	assert.equal(cv.word, 'SHERIFF');
	assert.equal(cv.sub, 'ALAMEDA COUNTY');
	assert.equal(cv.officer, 'an Alameda County Sheriff\'s deputy');
	assert.equal(at(37.85, -122.032).name, 'Contra Costa County Sheriff');
	assert.equal(at(37.323, -122.032).name, 'Santa Clara County Sheriff');
	assert.equal(at(37.4636, -122.4286).name, 'San Mateo County Sheriff');
	assert.equal(at(37.882, -121.914).name, 'Contra Costa County Sheriff');
});

test('the rest of the United States: a city\'s police, the state patrol on the open road', () => {
	assert.equal(bayForce(38.58, -121.49), null);
	assert.equal(at(38.58, -121.49).name, 'Sacramento Police');
	assert.equal(at(34.05, -118.25).name, 'LAPD');
	assert.equal(at(40.71, -74.0).word, 'NYPD');
	assert.equal(at(36.9, -120.3).name, 'California Highway Patrol');
	assert.equal(at(31.0, -100.0).name, 'Texas Highway Patrol');
	assert.equal(at(39.1, -119.95).name, 'Nevada Highway Patrol');
	assert.equal(at(39.1, -120.05).name, 'California Highway Patrol');
	assert.equal(usState(42.36, -71.06)[0], 'Massachusetts');
});

test('abroad, each country\'s own pattern and script', () => {
	const ie = at(53.29, -6.36);
	assert.equal(ie.name, 'Garda');
	assert.equal(ie.word, 'GARDA');
	assert.equal(ie.officer, 'a Garda');
	assert.equal(ie.shout, 'Garda');
	assert.equal(at(54.6, -5.93).name, 'PSNI');
	assert.equal(at(51.51, -0.13).name, 'Metropolitan Police');
	assert.equal(at(53.48, -2.24).name, 'Greater Manchester Police');
	assert.equal(at(55.95, -3.19).name, 'Police Scotland');
	assert.equal(at(48.8566, 2.3522).name, 'Police Nationale');
	assert.equal(at(47.5, 1.5).name, 'Gendarmerie');
	assert.equal(at(40.42, -3.70).name, 'Policía Nacional');
	assert.equal(at(39.5, -4.5).name, 'Guardia Civil');
	assert.equal(at(41.39, 2.17).name, 'Mossos d\'Esquadra');
	assert.equal(at(41.9, 12.5).name, 'Polizia di Stato');
	assert.equal(at(43.2, 11.4).name, 'Carabinieri');
	assert.equal(at(52.52, 13.4).name, 'Polizei Berlin');
	assert.equal(at(35.68, 139.69).word, '警視庁');
	assert.equal(at(55.76, 37.62).word, 'ПОЛИЦИЯ');
	assert.equal(at(-33.87, 151.21).name, 'NSW Police');
	assert.equal(at(-33.45, -70.67).name, 'Carabineros');
	assert.equal(at(43.65, -79.38).name, 'Toronto Police');
	assert.equal(at(50.5, -122.5).name, 'RCMP');
	assert.equal(at(19.43, -99.13).name, 'Policía de la Ciudad');
	assert.equal(at(-90, 0), GENERIC);
});

test('the borders decide where the atlas\'s boxes overlap', () => {
	assert.equal(inCanada(43.65, -79.38), true);
	assert.equal(inCanada(42.89, -78.88), false);
	assert.equal(inCanada(45.5, -73.57), true);
	assert.equal(inCanada(44.48, -73.21), false);
	assert.equal(inCanada(48.43, -123.37), true);
	assert.equal(inCanada(47.6, -122.33), false);
	assert.equal(inMexico(32.72, -117.16), false);
	assert.equal(inMexico(32.52, -117.03), true);
	assert.equal(inMexico(31.76, -106.49), false);
	assert.equal(inMexico(31.69, -106.42), true);
});

test('the faction, its officers and its tactical team follow the local force', () => {
	const seen = [];
	const off = onForceChange((F) => seen.push(F.name));
	setLocalForce(at(37.76, -122.418));
	assert.equal(FACTIONS.police.name, 'San Francisco Police');
	assert.equal(FACTIONS.police.officer, 'a San Francisco Police officer');
	assert.match(FACTIONS.swat.name, /^San Francisco Police /);
	assert.equal(setLocalForce(at(37.76, -122.418)), false);
	setLocalForce(at(53.35, -6.26));
	assert.equal(FACTIONS.police.name, 'Garda');
	assert.equal(FACTIONS.swat.officer, 'a Garda ERU officer');
	assert.equal(localForce().word, 'GARDA');
	assert.deepEqual(seen, ['San Francisco Police', 'Garda']);
	off();
});

test('police stations are named for the force that keeps them', () => {
	setForceLocator(() => ({ lat: 37.694, lon: -122.086 }));
	assert.equal(forceAtXZ(0, 0).name, 'Alameda County Sheriff');
	assert.equal(serviceName('police', 10, 10), 'Alameda County Sheriff\'s Office, Castro Valley Station');
	assert.deepEqual(signOf('police', 10, 10), { top: 'SHERIFF', sub: 'ALAMEDA COUNTY' });
	setForceLocator(() => ({ lat: 53.35, lon: -6.26 }));
	assert.equal(serviceName('police', 10, 10), 'Dublin Garda Station');
	setForceLocator(() => ({ lat: 37.906, lon: -122.065 }));
	// (a station the economy plans where no service claimed the building)
	let E = null;
	for (let i = 0; i < 4000 && !E; i++) { const e = establish({ x: i * 37.1, z: i * 11.3, w: 30, d: 24, h: 9, use: 'shop', down: 0.2, a: 0 }); if (e?.type === 'police') E = e; }
	assert.ok(E, 'a police station among the offices');
	assert.equal(E.name, 'Walnut Creek Police Department');
	assert.equal(E.tag, 'POLICE');
	setForceLocator(null);
	assert.equal(forceAtXZ(0, 0), null);
	for (let i = 0; i < 40; i++) assert.ok(!/harbou?r/i.test(serviceName('police', i * 400, i * 800) + signOf('police', i * 400, i * 800).sub));
});
