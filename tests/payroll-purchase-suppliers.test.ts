import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASTEMIR_APPROVED_SUPPLIERS_AUGUST_2026,
  ASTEMIR_EXCLUDED_SUPPLIERS_AUGUST_2026,
  buildPayrollPurchaseSupplierPreview,
  normalizePayrollSupplierName,
  type PayrollPurchaseSupplierRuleValue,
  type PayrollSupplierSettlement,
} from '../lib/payroll-purchase-suppliers';

const augustAmounts: Record<string, number> = {
  'П37': 1290533.49,
  Tural: 964000,
  '3-11 Курбан': 636400,
  Luxo: 529198.50,
  Remax: 443188.15,
  'П17': 410422.81,
  Breaking: 309031,
  'Б89': 189750,
  Usbmag: 139455.92,
  'П43/45 Муртаза': 122509.80,
  'А100 Миво': 117220,
  'В12': 65822.26,
  'Смарт 05': 54536,
  'Set Sail Film пленки': 38063.85,
  'Baseus Jackson': 33580.74,
  'Daben Ada': 30528,
  'Глазурь Ростов': 25220,
  'МегаАкс АбдулХалик': 20620,
  'Phone26 Горяч': 18000,
  'Керефова Альбина': 8050,
  'Кештов Амирби Юрьевич': 582,
};

function rule(supplierName: string, isActive: boolean, id: number): PayrollPurchaseSupplierRuleValue {
  return {
    id,
    supplierName,
    normalizedName: normalizePayrollSupplierName(supplierName),
    isActive,
    source: 'test',
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
  };
}

function settlement(supplierName: string, debtIncrease: number): PayrollSupplierSettlement {
  return { supplierName, debtIncrease, organizationName: 'ОФФОНИКА', currency: 'руб', sourceRows: 1 };
}

describe('Astemir supplier payroll scope', () => {
  it('reproduces the approved August purchase base exactly', () => {
    const rules = ASTEMIR_APPROVED_SUPPLIERS_AUGUST_2026.map((name, index) => rule(name, true, index + 1));
    const settlements = Object.entries(augustAmounts).map(([name, amount]) => settlement(name, amount));
    const preview = buildPayrollPurchaseSupplierPreview(settlements, rules);
    assert.equal(preview.approvedBase, 5446712.52);
    assert.equal(preview.approvedSupplierCount, 21);
    assert.equal(preview.newSupplierCount, 0);
    assert.equal(preview.ready, true);
  });

  it('never includes a new supplier before an explicit decision', () => {
    const preview = buildPayrollPurchaseSupplierPreview(
      [settlement('Новый поставщик', 900000)],
      [],
    );
    assert.equal(preview.approvedBase, 0);
    assert.equal(preview.newSupplierCount, 1);
    assert.equal(preview.rows[0].includedInPayrollBase, false);
    assert.equal(preview.ready, false);
  });

  it('keeps known August exclusions out and allows a reversible decision', () => {
    const name = ASTEMIR_EXCLUDED_SUPPLIERS_AUGUST_2026[0];
    const excluded = buildPayrollPurchaseSupplierPreview([settlement(name, 4295300)], [rule(name, false, 1)]);
    assert.equal(excluded.approvedBase, 0);
    assert.equal(excluded.rows[0].status, 'EXCLUDED');

    const approved = buildPayrollPurchaseSupplierPreview([settlement(name, 4295300)], [rule(name, true, 1)]);
    assert.equal(approved.approvedBase, 4295300);
    assert.equal(approved.rows[0].status, 'APPROVED');
  });

  it('matches harmless whitespace and letter case without broad fuzzy matching', () => {
    const preview = buildPayrollPurchaseSupplierPreview(
      [settlement('  SET   SAIL film ПЛЕНКИ ', 100)],
      [rule('Set Sail Film пленки', true, 1)],
    );
    assert.equal(preview.approvedBase, 100);
    assert.equal(preview.rows[0].status, 'APPROVED');
  });
});
