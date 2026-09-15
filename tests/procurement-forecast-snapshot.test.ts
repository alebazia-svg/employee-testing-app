import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProcurementForecastSnapshot,
  compareProcurementForecastSnapshots,
  procurementForecastSnapshotHash,
  procurementForecastSnapshotReady,
} from '../lib/procurement-forecast-snapshot';

const sourceStatus = {
  ownerMoney: true,
  supplierOrders: true,
  supplierDebts: true,
  payroll: true,
  tbank: 'verified' as const,
  procurementManagerMapping: true,
};

function snapshot(input?: Partial<Parameters<typeof buildProcurementForecastSnapshot>[0]>) {
  return buildProcurementForecastSnapshot({
    asOf: '2026-09-15',
    sourceStatus,
    accounts: [
      { name: 'Сейф Депозитный', balanceMinor: 20_000_000 },
      { name: 'Банк ВТБ КБР', balanceMinor: 35_000_000 },
    ],
    salaryPayableMinor: 31_630_000,
    rentEstimateMinor: 23_500_000,
    plans: [],
    orders: [],
    debts: [],
    tbank: {
      renewsOn: '2026-09-22',
      transferredMinor: 240_000_000,
      packagesPurchased: 2,
      freeRemainingMinor: 0,
      tierOneRemainingMinor: 80_000_000,
      tierFiveRemainingMinor: 120_000_000,
      currentRateBps: 100,
    },
    ...input,
  });
}

test('stores separate supplier debt and order exposure without adding them together', () => {
  const payload = snapshot({
    orders: [
      { supplier: 'Турал', orderPaymentGapMinor: 100_000_000 },
      { supplier: 'Турал', orderPaymentGapMinor: 200_000_000 },
    ],
    debts: [{ supplier: 'Турал', debtMinor: 72_718_959, verified: false }],
  });
  assert.equal(payload.suppliers.length, 1);
  assert.deepEqual(payload.suppliers[0], {
    key: 'турал',
    name: 'Турал',
    openOrderCount: 2,
    openOrdersMinor: 300_000_000,
    medianOrderMinor: 150_000_000,
    debtMinor: 72_718_959,
    debtVerified: false,
    level: 'urgent',
    attentionThresholdMinor: 30_000_000,
    urgentThresholdMinor: 300_000_000,
  });
});

test('normalizes ordering so the same financial state has the same hash', () => {
  const first = snapshot({
    orders: [
      { supplier: 'P17', orderPaymentGapMinor: 10_000_000 },
      { supplier: 'Luxo', orderPaymentGapMinor: 20_000_000 },
    ],
  });
  const second = snapshot({
    accounts: [...first.liquidity.accounts].reverse(),
    orders: [
      { supplier: 'Luxo', orderPaymentGapMinor: 20_000_000 },
      { supplier: 'P17', orderPaymentGapMinor: 10_000_000 },
    ],
  });
  assert.equal(procurementForecastSnapshotHash(first), procurementForecastSnapshotHash(second));
});

test('does not claim a liquidity total when owner money is incomplete', () => {
  const payload = snapshot({ sourceStatus: { ...sourceStatus, ownerMoney: false } });
  assert.equal(payload.liquidity.totalMinor, null);
  assert.equal(payload.liquidity.accounts.length, 2);
  assert.equal(procurementForecastSnapshotReady(payload), false);
});

test('allows persistence only with verified core sources and manager mapping', () => {
  assert.equal(procurementForecastSnapshotReady(snapshot()), true);
  assert.equal(procurementForecastSnapshotReady(snapshot({
    sourceStatus: { ...sourceStatus, supplierOrders: false },
  })), false);
  assert.equal(procurementForecastSnapshotReady(snapshot({
    sourceStatus: { ...sourceStatus, procurementManagerMapping: false },
  })), false);
});

test('compares balances, outstanding requests and supplier measures separately', () => {
  const previous = snapshot({
    plans: [{
      id: 'one', code: 'ZP-1', supplier: 'Турал', date: '2026-09-17', status: 'APPROVED',
      requestedMinor: 70_000_000, issuedMinor: 0, outstandingMinor: 70_000_000,
      paymentMethod: 'USDT', currency: 'RUB',
    }],
    orders: [{ supplier: 'Турал', orderPaymentGapMinor: 100_000_000 }],
    debts: [{ supplier: 'Турал', debtMinor: 50_000_000, verified: true }],
  });
  const current = snapshot({
    accounts: [
      { name: 'Сейф Депозитный', balanceMinor: 15_000_000 },
      { name: 'Банк ВТБ КБР', balanceMinor: 35_000_000 },
    ],
    plans: [{
      id: 'one', code: 'ZP-1', supplier: 'Турал', date: '2026-09-17', status: 'APPROVED',
      requestedMinor: 70_000_000, issuedMinor: 30_000_000, outstandingMinor: 40_000_000,
      paymentMethod: 'USDT', currency: 'RUB',
    }],
    orders: [{ supplier: 'Турал', orderPaymentGapMinor: 80_000_000 }],
    debts: [{ supplier: 'Турал', debtMinor: 20_000_000, verified: true }],
  });
  const change = compareProcurementForecastSnapshots(previous, current);
  assert.equal(change.liquidityDeltaMinor, -5_000_000);
  assert.equal(change.tbankTransferCapacityDeltaMinor, 0);
  assert.equal(change.planOutstandingDeltaMinor, -30_000_000);
  assert.deepEqual(change.planChanges, [{
    id: 'one', code: 'ZP-1', supplier: 'Турал', date: '2026-09-17', status: 'APPROVED',
    paymentMethod: 'USDT', currency: 'RUB', previousOutstandingMinor: 70_000_000,
    currentOutstandingMinor: 40_000_000, deltaMinor: -30_000_000, kind: 'reduced',
  }]);
  assert.deepEqual(change.supplierChanges[0], {
    key: 'турал', name: 'Турал', openOrdersDeltaMinor: -20_000_000,
    debtDeltaMinor: -30_000_000, previousLevel: 'urgent', currentLevel: 'attention',
  });
});

test('reports a new request independently from the total outstanding change', () => {
  const previous = snapshot({
    plans: [{
      id: 'old', code: 'ZP-1', supplier: 'Luxo', date: '2026-09-16', status: 'APPROVED',
      requestedMinor: 70_000_000, issuedMinor: 0, outstandingMinor: 70_000_000,
      paymentMethod: 'CASH', currency: 'RUB',
    }],
  });
  const current = snapshot({
    plans: [{
      id: 'new', code: 'ZP-2', supplier: 'Турал', date: '2026-09-18', status: 'SUBMITTED',
      requestedMinor: 70_000_000, issuedMinor: 0, outstandingMinor: 70_000_000,
      paymentMethod: 'USDT', currency: 'RUB',
    }],
  });
  const change = compareProcurementForecastSnapshots(previous, current);
  assert.equal(change.planOutstandingDeltaMinor, 0);
  assert.deepEqual(change.planChanges.map((row) => [row.id, row.kind]), [
    ['new', 'new'],
    ['old', 'closed'],
  ]);
});

test('does not invent deltas for incomplete supplier or salary sources', () => {
  const previous = snapshot();
  const current = snapshot({ sourceStatus: { ...sourceStatus, supplierDebts: false, payroll: false } });
  const change = compareProcurementForecastSnapshots(previous, current);
  assert.equal(change.salaryDeltaMinor, null);
  assert.equal(change.tbankTransferCapacityDeltaMinor, 0);
  assert.deepEqual(change.supplierChanges, []);
});
