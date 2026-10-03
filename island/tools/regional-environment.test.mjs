import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadAtlas, regionAt } from '../src/earth/atlas.js';
import { kitAt } from '../src/region/choose.js';
import { KITS } from '../src/region/kits.js';
import { climateNow } from '../src/region/climate.js';
import { airKindNow, createAir } from '../src/region/air.js';
import { iceCover, auroraStrength, createIce } from '../src/region/ice.js';
import { createFlora } from '../src/region/flora.js';

await loadAtlas();
const samples = [
  ['Svalbard', 78.2232, 15.6469, 15, 1, 'polar'],
  ['Marrakesh', 31.63, -7.98, 460, 3, 'bazaar'],
  ['Istanbul', 41.01, 28.98, 40, 5, 'bazaar'],
  ['Kyoto', 35.01, 135.77, 50, 3, 'eastcity'],
  ['Manaus', -3.12, -60.02, 80, 3, 'jungle'],
  ['Ulaanbaatar', 47.92, 106.92, 1350, 3, 'steppe'],
  ['Zermatt', 46.02, 7.75, 1600, 1, 'alpine'],
  ['Iqaluit', 63.746, -68.517, 20, 1, 'polar'],
];

test('the eight authored regional checkpoints retain their distinct kits', () => {
  for (const [name, lat, lon, elev, pop, expected] of samples) {
    const at = regionAt(lat, lon), selected = kitAt(at, { elev, pop });
    assert.equal(selected.id, expected, name);
    assert.ok(Math.abs(selected.weights.reduce((a, b) => a + b.w, 0) - 1) < 1e-6, name);
  }
});

test('polar daylight follows latitude and fractional season, with opposite hemispheres', () => {
  const climate = (lat, month) => climateNow({ lat, mix: { temp: [-20, 6], rain: 200 } }, month);
  assert.equal(climate(78.2232, 4).polar, 'sun'); // Svalbard, May
  assert.equal(climate(78.2232, 10).polar, 'night'); // November
  assert.equal(climate(67, 4).polar, null); // same month, close to polar circle
  assert.equal(climate(67, 5.67).polar, 'sun');
  assert.equal(climate(-78.2232, 4).polar, 'night');
  assert.equal(climate(-78.2232, 10).polar, 'sun');
  assert.equal(climate(0, 5.67).daylight, 12);
  for (const lat of [-90, -78, -30, 0, 30, 78, 90]) for (let month = 0; month < 12; month += 0.25) {
    const C = climate(lat, month), opposite = climate(-lat, month);
    assert.ok(Number.isFinite(C.daylight) && C.daylight >= 0 && C.daylight <= 24);
    assert.ok(Math.abs(C.daylight + opposite.daylight - 24) < 1e-8);
    assert.ok(Math.abs(C.daylight - climate(lat, month + 12).daylight) < 1e-8);
  }
});

test('Svalbard thaw, Antarctic seasons and polar sea ice retain opposite annual cycles', () => {
  const sval = regionAt(78.2232, 15.6469);
  assert.equal(climateNow(sval, 0.5).snow, 1);
  assert.equal(climateNow(sval, 6.5).snow, 0);
  const antarctic = regionAt(-77.85, 166.67);
  assert.equal(kitAt(antarctic).id, 'station');
  assert.equal(climateNow(antarctic, 0.5).season, 'summer');
  assert.equal(climateNow(antarctic, 6.5).season, 'winter');
  assert.ok(iceCover(72, 20, 2.5) > iceCover(72, 20, 8.5));
  assert.ok(iceCover(-65, 20, 8.5) > iceCover(-65, 20, 2.5));
});

test('regional air suppresses snow in warm rain and pollen in winter', () => {
  assert.equal(airKindNow(KITS.polar, { now: 8, snow: 1 }, { rain: 1 }, 0), null);
  assert.equal(airKindNow(KITS.polar, { now: -4, snow: 1 }, { rain: 0 }, 0), 'snow');
  assert.equal(airKindNow({ air: { kind: 'pollen' } }, { season: 'winter', now: 0 }, {}, 0), null);
  assert.equal(airKindNow({ air: { kind: 'pollen' } }, { season: 'spring', now: 14 }, {}, 0), 'pollen');
  assert.equal(airKindNow(KITS.jungle, { season: 'wet', now: 26 }, {}, 1), 'fireflies');
  assert.equal(airKindNow(KITS.jungle, { season: 'wet', now: 3 }, {}, 1), 'mist');
});

test('air fades between active particles and no particles without keeping frozen opacity', () => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), air = createAir(scene, { isPhone: true });
  const particles = scene.getObjectByName('regional air');
  assert.equal(particles.geometry.getAttribute('aSeed').count, 700);
  air.update(2, cam, { kit: KITS.polar, climate: { now: -4, snow: 1 } });
  const before = particles.material.uniforms.uK.value;
  assert.ok(before > 0);
  air.update(1, cam, { on: false });
  assert.equal(particles.material.uniforms.uK.value, before * 0.5);
  air.update(2, cam, { on: false });
  assert.equal(particles.visible, false);
  air.dispose();assert.equal(scene.children.length, 0);
});

test('brighter aurora stays bounded and respects daylight, cloud and latitude gates', () => {
  for (const lat of [-90, -78, -66, -30, 0, 30, 66, 78, 90]) for (const night of [0, 0.5, 0.8, 1]) for (const cloud of [0, 0.5, 1]) {
    const value = auroraStrength(lat, night, cloud, 1);
    assert.ok(value >= 0 && value <= 1);
    assert.equal(value, auroraStrength(-lat, night, cloud, 1));
    if (night <= 0.55 || cloud >= 0.85 || Math.abs(lat) <= 54) assert.equal(value, 0);
  }
  assert.equal(auroraStrength(66, 1, 0, 0), 0.55);
  assert.equal(auroraStrength(66, 1, 0, 1), 1);
});

function watchDispose(scene) {
  const counts = new Map();
  scene.traverse((o) => {
    for (const resource of [o.isInstancedMesh ? o : null, o.geometry, o.material]) if (resource && !counts.has(resource)) {
      counts.set(resource, 0);resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
    }
  });
  return () => { for (const [resource, count] of counts) assert.equal(count, 1, resource.type || 'resource'); };
}

test('Svalbard flora stays treeless and bounded; flora and ice release their instance buffers', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const lat = 78.2232, lon = 15.6469, meters = 111000, longitude = meters * Math.cos(lat * Math.PI / 180);
  const toLL = (x, z) => ({ lat: lat - z / meters, lon: lon + x / longitude });
  const toXZ = (a, b) => ({ x: (b - lon) * longitude, z: (lat - a) * meters });
  const flora = createFlora(scene, { isPhone: true, ground: () => 10, wet: () => false, blocked: () => false, toLL });
  flora.update(camera, { kit: KITS.polar, climate: climateNow(regionAt(lat, lon), 6.5) });
  const plants = flora.info();
  assert.ok(plants.grass > 0 && plants.grass <= 1000);
  assert.deepEqual(Object.keys(plants), ['grass']);
  const ice = createIce(scene, { isPhone: true, height: { at: () => -20, out: { land: 0 } }, toLL, toXZ });
  ice.update(2, camera, { lat, month: 2.5, night: 1, cover: 0 });
  const info = ice.info();
  assert.ok(info.floes > 0 && info.floes <= 900);
  assert.ok(info.ridges <= 800 && info.bergs <= 90);
  const releaseCheck = watchDispose(scene);
  flora.dispose();ice.dispose();releaseCheck();
  assert.equal(scene.children.length, 0);
});
