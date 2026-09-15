import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupplierIntelligence } from '../lib/procurement-supplier-intelligence';

test('uses 300 thousand as the ordinary attention floor and adapts urgency to order scale', () => {
  const rows = buildSupplierIntelligence({
    orders: [
      { supplier: 'Tural', orderPaymentGapMinor: 184_364_500 },
      { supplier: 'Tural', orderPaymentGapMinor: 146_232_000 },
      { supplier: 'Remax', orderPaymentGapMinor: 39_089_369 },
    ],
    debts: [
      { supplier: 'Tural', debtMinor: 72_718_959, verified: false },
      { supplier: 'Remax', debtMinor: 0, verified: true },
    ],
  });
  const tural = rows.find((row) => row.supplier === 'Tural');
  const remax = rows.find((row) => row.supplier === 'Remax');
  assert.equal(tural?.level, 'urgent');
  assert.equal(tural?.confidence, 'needs_review');
  assert.equal(tural?.urgentThresholdMinor, 330_596_500);
  assert.equal(remax?.level, 'attention');
  assert.equal(remax?.attentionThresholdMinor, 30_000_000);
});

test('keeps the separate 95-RU scale', () => {
  const below = buildSupplierIntelligence({
    orders: [{ supplier: '95‑RU', orderPaymentGapMinor: 90_000_000 }], debts: [],
  });
  const urgent = buildSupplierIntelligence({
    orders: [], debts: [{ supplier: '95-RU', debtMinor: 200_000_000, verified: true }],
  });
  assert.equal(below.length, 0);
  assert.equal(urgent[0]?.level, 'urgent');
  assert.equal(urgent[0]?.attentionThresholdMinor, 100_000_000);
});

test('does not invent a supplier signal below the ordinary floor', () => {
  const rows = buildSupplierIntelligence({
    orders: [{ supplier: 'Luxo', orderPaymentGapMinor: 22_519_014 }],
    debts: [{ supplier: 'Luxo', debtMinor: 0, verified: true }],
  });
  assert.deepEqual(rows, []);
});

test('treats a single ordinary-supplier order above one million as urgent without history', () => {
  const rows = buildSupplierIntelligence({
    orders: [{ supplier: 'Новый крупный поставщик', orderPaymentGapMinor: 120_000_000 }],
    debts: [],
  });
  assert.equal(rows[0]?.level, 'urgent');
  assert.equal(rows[0]?.urgentThresholdMinor, 100_000_000);
});
