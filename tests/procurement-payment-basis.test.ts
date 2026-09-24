import assert from 'node:assert/strict';
import test from 'node:test';
import { mixedPaymentBasisSuppliers } from '../lib/procurement-payment-basis';

test('same supplier cannot combine order and total debt in either sequence', () => {
  const rows = [{ supplierPartner: 'Курбан', basis: 'ORDER' as const }, { supplierPartner: 'Курбан', basis: 'DEBT' as const }];
  assert.deepEqual(mixedPaymentBasisSuppliers(rows), ['Курбан']);
  assert.deepEqual(mixedPaymentBasisSuppliers(rows.reverse()), ['Курбан']);
});
test('different suppliers and multiple orders remain allowed', () => {
  assert.deepEqual(mixedPaymentBasisSuppliers([
    { supplierPartner: 'Курбан', basis: 'ORDER' }, { supplierPartner: 'Курбан', basis: 'ORDER' },
    { supplierPartner: 'Remax', basis: 'DEBT' },
  ]), []);
});
test('cosmetic label differences cannot bypass the overlap guard', () => {
  assert.equal(mixedPaymentBasisSuppliers([
    { supplierPartner: ' Зелим  Чечня ', basis: 'DEBT' },
    { supplierPartner: 'зелим чечня', basis: 'ORDER' },
  ]).length, 1);
});
test('removing the conflicting choice clears the guard without changing money', () => {
  assert.deepEqual(mixedPaymentBasisSuppliers([{ supplierPartner: 'Курбан', basis: 'ORDER' }]), []);
  assert.deepEqual(mixedPaymentBasisSuppliers([]), []);
});
