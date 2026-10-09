import test from 'node:test';
import assert from 'node:assert/strict';
import { BOW_ID, BOW_DRAW_SECONDS, BOW_MIN_DRAW, bowPower, weaponStats, createWeaponState, trigger, cancelTrigger, stepWeapon, startReload, cancelReload, completeReload, drawRounds } from '../src/combat/weapons.js';

const instance = (i = BOW_ID, l = 1, t = 0) => ({ i, u: 'bow-test', l, t, x: 0 });
const bow = (n = 1) => createWeaponState(instance(), n);
function draw(w, q = 1) { trigger(w, true); return stepWeapon(w, BOW_DRAW_SECONDS * q); }
function release(w, options) { trigger(w, false); return stepWeapon(w, 0, options); }

test('every bow tier has exactly one arrow, including stale saved magazines and view overrides', () => {
  for (let t = 0; t < 5; t++) for (const l of [1, 5, 10]) {
    assert.equal(weaponStats(instance(BOW_ID, l, t), { mag: 50 }).mag, 1);
    assert.equal(createWeaponState(instance(BOW_ID, l, t), 50).mag, 1);
    assert.equal(weaponStats(instance(BOW_ID, l, t)).reload, .9);
  }
});
test('hold reaches full draw without spending ammunition; release fires only once', () => {
  const w = bow(); assert.equal(draw(w).fired, 0); assert.equal(w.draw, 1); assert.equal(w.mag, 1);
  assert.equal(stepWeapon(w, 5).fired, 0); assert.equal(w.mag, 1);
  const r = release(w); assert.equal(r.fired, 1); assert.equal(r.charge, 1); assert.equal(w.mag, 0); assert.equal(w.shots, 1);
  assert.equal(stepWeapon(w, 2).fired, 0);
});
test('short taps let down; the minimum usable draw releases a partial-power arrow', () => {
  const w = bow(); draw(w, BOW_MIN_DRAW / 2); assert.equal(release(w).fired, 0); assert.equal(w.mag, 1);
  draw(w, BOW_MIN_DRAW); const r = release(w); assert.equal(r.fired, 1); assert.ok(Math.abs(r.charge - BOW_MIN_DRAW) < 1e-9);
  const partial = bowPower(r.charge), full = bowPower(1);
  assert.ok(partial.speed < full.speed); assert.ok(partial.damage < full.damage);
  assert.deepEqual(full, { damage: 1, speed: 1 });
});
test('cancellation never becomes an arrow release, including a queued release', () => {
  for (const queued of [false, true]) {
    const w = bow(); draw(w); if (queued) trigger(w, false); cancelTrigger(w);
    assert.equal(stepWeapon(w, 1).fired, 0); assert.equal(w.mag, 1); assert.equal(w.draw, 0); assert.equal(w.drawing, false);
    trigger(w, false); assert.equal(stepWeapon(w, 1).fired, 0);
  }
});
test('a refused or throwing view spends no arrow and advances no shot/cooldown', () => {
  for (const accept of [() => false, () => { throw Error('renderer unavailable'); }]) {
    const w = bow(); draw(w); const r = release(w, { accept });
    assert.equal(r.fired, 0); assert.equal(w.mag, 1); assert.equal(w.shots, 0); assert.equal(w.cool, 0);
    draw(w); assert.equal(release(w).fired, 1, 'a fresh draw works after recovery');
  }
});
test('nocking transfers one reserve arrow once after .9 seconds and allows the next draw', () => {
  const w = bow(); draw(w); release(w); assert.ok(startReload(w, 2));
  assert.equal(stepWeapon(w, .89, { reserve: 2 }).loaded, 0);
  assert.equal(stepWeapon(w, .02, { reserve: 2 }).loaded, 1); assert.equal(w.mag, 1);
  assert.equal(stepWeapon(w, 2, { reserve: 1 }).loaded, 0);
  const rounds = drawRounds(0, 1, 1, w.S); assert.deepEqual(rounds, { open: 1, loose: 11 });
  draw(w); assert.equal(w.draw, 1); assert.equal(release(w).fired, 1);
});
test('nocking cannot duplicate arrows through repeated reload or stale animation callbacks', () => {
  const w = bow(0); assert.ok(startReload(w, 2)); const old = w.reloadSerial;
  assert.equal(startReload(w, 2), false); cancelReload(w);
  assert.equal(completeReload(w, old), false); assert.equal(stepWeapon(w, 2, { reserve: 2 }).loaded, 0);
  assert.ok(startReload(w, 2)); assert.equal(completeReload(w, old), false);
  assert.ok(completeReload(w, w.reloadSerial)); assert.equal(stepWeapon(w, .01, { reserve: 2 }).loaded, 1);
  assert.equal(completeReload(w, w.reloadSerial), false); assert.equal(stepWeapon(w, 1, { reserve: 2 }).loaded, 0);
});
test('the final arrow fires and an empty bow cannot draw, fire or reload without reserve', () => {
  const w = bow(); draw(w); release(w); assert.equal(startReload(w, 0), false);
  const r = draw(w); assert.equal(r.empty, true); assert.equal(w.drawing, false); assert.equal(release(w).fired, 0);
});
test('holding through nock cannot auto-fire or start an accidental draw', () => {
  const w = bow(0); startReload(w, 2); trigger(w, true);
  stepWeapon(w, 1, { reserve: 2 }); assert.equal(w.mag, 1);
  assert.equal(stepWeapon(w, 2).fired, 0); assert.equal(w.drawing, false); assert.equal(release(w).fired, 0);
  draw(w); assert.equal(release(w).fired, 1);
});
test('gun fire acceptance prevents ammunition loss and preserves its automatic cadence', () => {
  const w = createWeaponState(instance('warden-spark-carbine')); trigger(w, true);
  const before = w.mag; assert.equal(stepWeapon(w, .1, { accept: () => false }).fired, 0); assert.equal(w.mag, before);
  let n = 0; for (let i = 0; i < 60; i++) n += stepWeapon(w, 1 / 60).fired;
  assert.ok(n >= 5 && n <= 7); assert.equal(w.mag, before - n);
});
test('view bridge distinguishes absent view from refused/undefined/throwing implementations', async () => {
  const originalListener = globalThis.addEventListener;
  globalThis.addEventListener = () => {};
  const { createWeaponView } = await import('../src/combat/weapon-view.js');
  if (originalListener) globalThis.addEventListener = originalListener; else delete globalThis.addEventListener;
  const absent = createWeaponView({ gear: () => null }); assert.equal(absent.fire(), null);
  for (const fire of [() => false, () => undefined, () => { throw Error('expected refusal'); }]) {
    const v = createWeaponView({ gear: () => ({ weapon: { fire } }) });
    const old = console.warn; console.warn = () => {};
    try { assert.equal(v.fire(), false); } finally { console.warn = old; }
  }
  const v = createWeaponView({ gear: () => ({ weapon: { fire: () => true } }) }); assert.equal(v.fire(), true);
});
