import assert from 'node:assert/strict';
import test from 'node:test';
import {
	SITE_CATALOG,
	SITE_CHANNELS,
	SITE_KINDS,
	SITE_SUPPLY,
	normalizeSiteKind,
	resolveSiteAccess,
	resolveSiteItem,
	siteDefinition,
	siteKindOf,
	siteStock,
} from '../src/world/site-catalog.js';

test('site aliases resolve to stable categories', () => {
	assert.equal(normalizeSiteKind('Police Station'), SITE_KINDS.POLICE_STATION);
	assert.equal(normalizeSiteKind('precinct'), SITE_KINDS.POLICE_STATION);
	assert.equal(normalizeSiteKind('barracks'), SITE_KINDS.ARMORY);
	assert.equal(normalizeSiteKind('home-supply store'), SITE_KINDS.HOME_SUPPLY);
	assert.equal(normalizeSiteKind('outdoor_store'), SITE_KINDS.OUTFITTER);
	assert.equal(normalizeSiteKind('player-market'), SITE_KINDS.PLAYER_VENDOR);
	assert.equal(normalizeSiteKind('not a site'), null);
});

test('generated records prefer the first known site field', () => {
	assert.equal(siteKindOf({ siteKind: 'supermarket', type: 'office' }), SITE_KINDS.SUPERMARKET);
	assert.equal(siteKindOf({ type: 'merchant' }), SITE_KINDS.NPC_VENDOR);
	assert.equal(siteKindOf({ use: 'hunting' }), SITE_KINDS.HUNTING_AREA);
	assert.equal(siteKindOf(null), null);
	assert.equal(siteKindOf('house'), SITE_KINDS.HOUSE);
});

test('definitions are detached and the catalog stays immutable', () => {
	assert.ok(Object.isFrozen(SITE_CATALOG));
	assert.ok(Object.isFrozen(SITE_CATALOG.police_station));
	assert.ok(Object.isFrozen(SITE_SUPPLY));
	const one = siteDefinition('supermarket');
	one.stock.push('temporary_test_item');
	assert.equal(siteDefinition('supermarket').stock.includes('temporary_test_item'), false);
	assert.equal(SITE_CATALOG.supermarket.stock.includes('temporary_test_item'), false);
});

test('police station exposes a fictional high-consequence theft branch', () => {
	const rifle = resolveSiteItem('police', 'field_rifle');
	assert.equal(rifle.known, true);
	assert.equal(rifle.available, true);
	assert.deepEqual(rifle.channels, [SITE_CHANNELS.THEFT, SITE_CHANNELS.SCAVENGE]);
	assert.equal(rifle.risk, 'high');
	assert.ok(rifle.failure.includes('alarm'));
	assert.ok(rifle.requires.includes('world_consequence_system'));
	assert.ok(rifle.failure.every((value) => !/bypass|entry|route|lockpick/i.test(value)));

	const locked = resolveSiteItem('police_station', 'field_rifle', { siteSecurityState: 'locked' });
	assert.equal(locked.available, false);
	assert.deepEqual(locked.channels, []);
	assert.deepEqual(locked.failure, ['site_locked']);
});

test('retail sites expose purchase for equipment and home supplies', () => {
	const market = resolveSiteItem('supermarket', 'utility_carbine');
	assert.equal(market.available, true);
	assert.deepEqual(market.channels, [SITE_CHANNELS.PURCHASE]);
	assert.deepEqual(market.requires, ['stock', 'currency']);
	assert.equal(market.meta.role, 'home_defense');

	const supplies = siteStock('home supply');
	assert.ok(supplies.some((item) => item.id === 'lock_repair_kit'));
	assert.ok(supplies.some((item) => item.id === 'first_aid_kit'));
	assert.equal(resolveSiteItem('supermarket', 'field_rifle').available, true);
});

test('NPC and player vendors remain distinct acquisition channels', () => {
	const npc = resolveSiteItem('merchant', 'field_rifle');
	assert.deepEqual(npc.channels, [SITE_CHANNELS.NPC_TRADE, SITE_CHANNELS.QUEST_REWARD]);
	assert.ok(npc.requires.includes('vendor_relationship'));

	const player = resolveSiteItem('player-market', 'field_rifle');
	assert.deepEqual(player.channels, [SITE_CHANNELS.PLAYER_TRADE]);
	assert.ok(player.requires.includes('player_confirmation'));

	const dynamic = resolveSiteItem('npc_vendor', 'utility_carbine', { stock: ['utility_carbine'] });
	assert.equal(dynamic.available, true);
	const missing = resolveSiteItem('npc_vendor', 'utility_carbine', { stock: [] });
	assert.equal(missing.available, false);
	assert.deepEqual(missing.failure, ['not_listed']);
});

test('field sites provide use and hunt channels without inventing stock', () => {
	const area = resolveSiteAccess('wilderness');
	assert.deepEqual(area.channels, [SITE_CHANNELS.USE, SITE_CHANNELS.HUNT]);
	assert.deepEqual(siteStock('hunting area'), []);
	const noWeapon = resolveSiteItem('hunting area', 'field_rifle');
	assert.equal(noWeapon.available, false);
	assert.deepEqual(noWeapon.failure, ['not_listed']);
});

test('unknown sites and items fail closed', () => {
	assert.deepEqual(resolveSiteAccess('unmapped site'), {
		kind: null, known: false, channels: [], requires: [], failure: ['unknown_site'],
	});
	const unknown = resolveSiteItem('supermarket', 'imaginary_weapon');
	assert.equal(unknown.known, true);
	assert.equal(unknown.available, false);
	assert.deepEqual(unknown.channels, []);
	assert.deepEqual(unknown.failure, ['not_listed']);
});
