import test from 'node:test';
import assert from 'node:assert/strict';
import { planningRequestOverlap } from '../lib/procurement-planning-overlap';
test('unfinished order/debt requests cannot reserve the same payment twice', () => {
  const existing = [{ id: 'one', status: 'APPROVED', supplierPartner: 'Поставщик', orderRefs: ['a'] }];
  assert.equal(planningRequestOverlap([{ supplierPartner: 'Поставщик', orderRefs: ['a'] }], existing, new Map()), true);
  assert.equal(planningRequestOverlap([{ supplierPartner: 'Поставщик', orderRefs: [] }], existing, new Map()), true);
  assert.equal(planningRequestOverlap([{ supplierPartner: 'Поставщик', orderRefs: ['b'] }], existing, new Map()), false);
  assert.equal(planningRequestOverlap([{ supplierPartner: 'Поставщик', orderRefs: ['a'] }], existing, new Map([['one', { state: 'PAID_BY_ONE_C' }]])), false);
  const evidence = Object.assign(new Map([['one', { state: 'PAID_BY_ONE_C' }]]), { versions: new Map([['one', 'old']]) });
  assert.equal(planningRequestOverlap([{ supplierPartner: 'Поставщик', orderRefs: ['a'] }], existing, evidence), true);
});
