import assert from 'node:assert/strict';
import test from 'node:test';

import { fiscalKey, mergeOfdReceipts, normalizePlatformaReceipt, type AusnOfdReceipt } from '../lib/ausn-ofd';

function receipt(source: 'saby' | 'platforma_ofd', overrides: Partial<AusnOfdReceipt> = {}): AusnOfdReceipt {
  return {
    fiscalDocumentNumber: '42', fiscalDriveNumber: '00123', fiscalSign: '000456',
    kktRegistrationNumber: '000789', date: '2026-08-01T10:00:00Z', operationType: 1,
    receiptCode: 3, amountUnit: 'RUB', totalSum: 100, cashTotalSum: 100,
    ecashTotalSum: 0, creditSum: 0, prepaidSum: 0, items: [], sources: [source], ...overrides,
  };
}

test('canonical fiscal key ignores numeric leading zeroes', () => {
  assert.equal(fiscalKey(receipt('saby')), '123:42:456');
});

test('merges the same fiscal fact from SABY and Platforma once', () => {
  const result = mergeOfdReceipts([receipt('saby')], [receipt('platforma_ofd', { fiscalDriveNumber: '123', fiscalSign: '456' })]);
  assert.equal(result.receipts.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.receipts[0].sources.sort(), ['platforma_ofd', 'saby']);
  assert.deepEqual(result.conflicts, []);
});

test('does not hide a conflicting fiscal fact', () => {
  const result = mergeOfdReceipts([receipt('saby')], [receipt('platforma_ofd', { totalSum: 101 })]);
  assert.equal(result.receipts.length, 1);
  assert.equal(result.duplicateCount, 0);
  assert.equal(result.conflicts.length, 1);
});

test('keeps different KKT and fiscal drive histories side by side', () => {
  const result = mergeOfdReceipts([receipt('saby')], [receipt('platforma_ofd', { fiscalDriveNumber: '999', fiscalDocumentNumber: '1', fiscalSign: '2', kktRegistrationNumber: '555' })]);
  assert.equal(result.receipts.length, 2);
  assert.deepEqual(result.conflicts, []);
});

test('normalizes confirmed production Platforma DTO to AUSN rubles', () => {
  const normalized = normalizePlatformaReceipt({
    fiscal: { driveNumber: '123', documentNumber: 42, sign: 456 },
    kkt: { registrationNumber: '789' }, receiptAt: '2026-08-01T07:00:00Z',
    operationType: 1, receiptCode: 3,
    money: { totalKopecks: 12345, cashKopecks: 10000, electronicKopecks: 2345, creditKopecks: 0, prepaidKopecks: 0 },
    items: [],
  });
  assert.equal(normalized?.totalSum, 123.45);
  assert.equal(normalized?.ecashTotalSum, 23.45);
});
