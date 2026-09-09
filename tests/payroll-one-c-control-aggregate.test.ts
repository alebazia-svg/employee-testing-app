import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPayrollOneCControlAggregate,
  getPayrollOneCAggregateKind,
  getPayrollOneCSourceFingerprint,
  getPayrollOneCSupplierRulesFingerprint,
  readPayrollOneCControlAggregate,
} from '../lib/payroll-one-c-control-aggregate';

test('aggregate kind keeps current and final month caches separate', () => {
  assert.equal(getPayrollOneCAggregateKind('DAILY'), 'AGGREGATE_DAILY');
  assert.equal(getPayrollOneCAggregateKind('FINAL'), 'AGGREGATE_FINAL');
});

test('supplier fingerprint is stable across query ordering and changes with a decision', () => {
  const first = getPayrollOneCSupplierRulesFingerprint([
    { normalizedName: 'бета', isActive: false, updatedAt: '2026-09-01T12:00:00.000Z' },
    { normalizedName: 'альфа', isActive: true, updatedAt: '2026-09-01T10:00:00.000Z' },
  ]);
  const reordered = getPayrollOneCSupplierRulesFingerprint([
    { normalizedName: 'альфа', isActive: true, updatedAt: new Date('2026-09-01T10:00:00.000Z') },
    { normalizedName: 'бета', isActive: false, updatedAt: new Date('2026-09-01T12:00:00.000Z') },
  ]);
  const changed = getPayrollOneCSupplierRulesFingerprint([
    { normalizedName: 'альфа', isActive: true, updatedAt: '2026-09-01T10:00:00.000Z' },
    { normalizedName: 'бета', isActive: true, updatedAt: '2026-09-01T12:00:00.000Z' },
  ]);

  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('source fingerprint changes when a daily source revision changes', () => {
  const rows = [
    { kind: 'DAILY', dateFrom: '2026-09-01', dateTo: '2026-09-01', contentHash: 'a', revision: 1 },
    { kind: 'DAILY', dateFrom: '2026-09-02', dateTo: '2026-09-02', contentHash: 'b', revision: 1 },
  ];
  const first = getPayrollOneCSourceFingerprint(rows);
  const reordered = getPayrollOneCSourceFingerprint([...rows].reverse());
  const changed = getPayrollOneCSourceFingerprint([{ ...rows[0], contentHash: 'c', revision: 2 }, rows[1]]);

  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('cached response is accepted only for the same period, source kind and supplier rules', () => {
  const response = { ok: true, period: { periodKey: '2026-09' } };
  const envelope = createPayrollOneCControlAggregate({
    periodKey: '2026-09',
    sourceKind: 'DAILY',
    sourceFingerprint: 'source-v1',
    supplierRulesFingerprint: 'rules-v1',
    response,
  });
  const isResponse = (value: unknown): value is typeof response => Boolean(
    value && typeof value === 'object' && (value as typeof response).ok === true,
  );

  assert.deepEqual(readPayrollOneCControlAggregate(envelope, {
    periodKey: '2026-09', sourceKind: 'DAILY', supplierRulesFingerprint: 'rules-v1',
  }, isResponse)?.response, response);
  assert.equal(readPayrollOneCControlAggregate(envelope, {
    periodKey: '2026-08', sourceKind: 'DAILY', supplierRulesFingerprint: 'rules-v1',
  }, isResponse), null);
  assert.equal(readPayrollOneCControlAggregate(envelope, {
    periodKey: '2026-09', sourceKind: 'FINAL', supplierRulesFingerprint: 'rules-v1',
  }, isResponse), null);
  assert.equal(readPayrollOneCControlAggregate(envelope, {
    periodKey: '2026-09', sourceKind: 'DAILY', supplierRulesFingerprint: 'rules-v2',
  }, isResponse), null);
});
