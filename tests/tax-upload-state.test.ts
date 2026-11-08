import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaxUploadStore } from '../lib/tax-upload-state';

test('parallel files retain their names, result, owner and visibility regardless of completion order', () => {
  const store = createTaxUploadStore();
  const a = store.begin('income', 'income.xlsx');
  store.update(a, { progress: 'processing', ownerVisible: true });
  const b = store.begin('ens', 'ens.zip');
  store.update(b, { progress: 'processing', ownerVisible: true });
  store.update(a, { ownerVisible: false }); // refresh removed only A's form
  store.update(a, { progress: 'failed', message: 'Wrong columns' });
  const [first, second] = store.getSnapshot();
  assert.equal(first.fileName, 'income.xlsx');
  assert.equal(first.progress, 'failed');
  assert.equal(first.ownerVisible, false);
  assert.equal(second.fileName, 'ens.zip');
  assert.equal(second.progress, 'processing');
  assert.equal(second.ownerVisible, true);
  store.update(b, { progress: 'done', changes: ['Updated'] });
  assert.equal(store.getSnapshot()[0].message, 'Wrong columns');
  assert.deepEqual(store.getSnapshot()[1].changes, ['Updated']);
});

test('late completion of an earlier attempt cannot change a replacement upload', () => {
  const store = createTaxUploadStore();
  const old = store.begin('income', 'old.xlsx');
  store.update(old, { progress: 'waiting' });
  assert.equal(store.isBusy('income'), false);
  const current = store.begin('income', 'new.xlsx');
  const snapshot = store.getSnapshot();
  store.update(old, { progress: 'failed', ownerVisible: false });
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(store.getSnapshot()[0].attempt, current);
  assert.equal(store.getSnapshot()[0].progress, 'sending');
});

test('a failed send releases only its own form and subscribers can unsubscribe', () => {
  const store = createTaxUploadStore();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  const a = store.begin('a', 'a.pdf');
  const b = store.begin('b', 'b.pdf');
  assert.equal(store.isBusy('a'), true);
  store.update(a, { progress: '' });
  assert.equal(store.isBusy('a'), false);
  assert.equal(store.isBusy('b'), true);
  unsubscribe();
  store.update(b, { progress: 'done' });
  assert.equal(notifications, 3);
});
