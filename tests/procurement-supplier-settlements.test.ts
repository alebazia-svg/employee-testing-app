import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupplierSettlement, summarizeSupplierSettlements } from '@/lib/procurement-supplier-settlements';

test('negative 1C settlement balance is supplier debt', () => {
  const summary = summarizeSupplierSettlements([
    { supplierPartner: 'Tural', supplierCounterparty: 'Tural', currency: 'руб', closingBalance: -984377.35 },
  ], ['Tural']);
  assert.equal(summary.bySupplier.Tural.debt, 984377.35);
  assert.equal(summary.bySupplier.Tural.advance, 0);
  assert.equal(summary.debtTotal, 984377.35);
});

test('contracts are netted within one supplier before debt and advance are separated', () => {
  const summary = summarizeSupplierSettlements([
    { supplierPartner: 'В12', supplierCounterparty: 'В12', currency: 'руб', closingBalance: 281258 },
    { supplierPartner: 'В12', supplierCounterparty: 'В12', currency: 'руб', closingBalance: -150999.86 },
  ], ['В12']);
  assert.equal(summary.bySupplier['В12'].debt, 0);
  assert.equal(summary.bySupplier['В12'].advance, 130258.14);
});

test('supplier names are matched after harmless whitespace normalization', () => {
  const row = normalizeSupplierSettlement({ supplier_partner: 'Kuzoom Lucy ', currency: 'руб', closing_balance: -1200 });
  assert.ok(row);
  const summary = summarizeSupplierSettlements([row], ['Kuzoom Lucy']);
  assert.equal(summary.debtTotal, 1200);
});
