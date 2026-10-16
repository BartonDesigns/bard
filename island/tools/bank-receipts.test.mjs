import test from 'node:test';
import assert from 'node:assert/strict';
import { createBank } from '../src/economy/bank.js';

function memory() {
  const values = new Map(); let fails = false;
  return { getItem: k => values.get(k) || null, setItem: (k, v) => { if (fails) throw Error('quota'); values.set(k, v); }, fail: v => { fails = v; }, raw: values };
}
const clock = () => Date.UTC(2026, 9, 14, 12);

test('merchant receipt credits one business and survives reload and history truncation', () => {
  const storage = memory(), bank = createBank({ storage, clock });
  assert.equal(bank.earnOnce('deal:one', 'biz:shop1', 120, 'sale', 'player').ok, true);
  assert.equal(bank.balance('biz:shop1'), 120);
  assert.equal(bank.earnOnce('deal:one', 'biz:shop1', 120, 'sale', 'player').duplicate, true);
  for (let i = 0; i < 25; i++) bank.earn('biz:shop1', 1, 'sale', 'player');
  bank.flush();
  const next = createBank({ storage, clock });
  assert.equal(next.earnOnce('deal:one', 'biz:shop1', 120, 'sale', 'player').duplicate, true);
  assert.equal(next.balance('biz:shop1'), 145);
  assert.equal(next.info().pending, 26);
});

test('receipt reuse with another amount or owner is rejected instead of minted twice', () => {
  const bank = createBank({ storage: memory(), clock });
  bank.earnOnce('deal:one', 'biz:shop1', 120, 'sale', 'player');
  assert.equal(bank.earnOnce('deal:one', 'biz:shop1', 121, 'sale', 'player').code, 'receipt-conflict');
  assert.equal(bank.earnOnce('deal:one', 'biz:shop2', 120, 'sale', 'player').code, 'receipt-conflict');
  assert.equal(bank.balance('biz:shop1'), 120); assert.equal(bank.balance('biz:shop2'), 0);
});

test('receipt save failure mutates neither balance nor queue and can retry safely', () => {
  const storage = memory(), bank = createBank({ storage, clock });
  storage.fail(true); assert.equal(bank.earnOnce('deal:one', 'biz:shop', 20).code, 'save-failed');
  assert.equal(bank.balance('biz:shop'), 0); assert.equal(bank.info().pending, 0);
  storage.fail(false); assert.equal(bank.earnOnce('deal:one', 'biz:shop', 20).ok, true); assert.equal(bank.balance('biz:shop'), 20);
});

test('receipt storage supports preexisting bank saves without losing accounts or queued wages', () => {
  const storage = memory(), bank = createBank({ storage, clock });
  bank.earn('biz:shop', 50, 'wage'); bank.flush();
  const old = JSON.parse(storage.getItem('crysis-bank-v1')); delete old.once; storage.setItem('crysis-bank-v1', JSON.stringify(old));
  const migrated = createBank({ storage, clock });
  assert.equal(migrated.earnOnce('deal:new', 'biz:shop', 20).ok, true);
  assert.equal(migrated.balance('biz:shop'), 70); assert.equal(migrated.info().pending, 2);
});

test('missing/corrupted storage and stale bank instances fail closed for receipt payments', () => {
  assert.equal(createBank({ storage: null, clock }).earnOnce('deal:one', 'biz:shop', 20).code, 'storage-unavailable');
  const storage = memory(); storage.setItem('crysis-bank-v1', '{bad');
  assert.equal(createBank({ storage, clock }).earnOnce('deal:one', 'biz:shop', 20).code, 'storage-unavailable');
  storage.setItem('crysis-bank-v1', 'null');
  const empty = memory(), one = createBank({ storage: empty, clock }), two = createBank({ storage: empty, clock });
  one.earnOnce('deal:one', 'biz:shop', 20);
  assert.equal(two.earnOnce('deal:two', 'biz:shop', 20).code, 'save-conflict'); assert.equal(one.balance('biz:shop'), 20);
});


test('an old tab’s ordinary delayed flush cannot erase a newly saved receipt', () => {
  const storage = memory(), old = createBank({ storage, clock }), current = createBank({ storage, clock });
  old.earn('biz:other', 5, 'tip');
  current.earnOnce('deal:saved', 'biz:shop', 20);
  old.flush();
  const reloaded = createBank({ storage, clock });
  assert.equal(reloaded.earnOnce('deal:saved', 'biz:shop', 20).duplicate, true);
  assert.equal(reloaded.balance('biz:shop'), 20);
});
