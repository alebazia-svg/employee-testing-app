import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { normalizePlatformaOfdReceipt, normalizePlatformaOfdZReport } from '../lib/terminal-fiscal-ofd-adapter';

test('normalizes the confirmed nested production Platforma OFD proxy DTO', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/platforma-ofd-confirmed.normalized.json'), 'utf8'));
  const receipt = normalizePlatformaOfdReceipt(fixture);
  assert.deepEqual(receipt, {
    fiscalDriveNumber: 'TEST_FN_001',
    fiscalDocumentNumber: '12345',
    fiscalSign: '000987654',
    operationType: 1,
    receiptAt: '2026-08-09T09:15:00.000Z',
    kktRegistrationNumber: 'TEST_KKT_001',
    totalKopecks: 125000,
    electronicKopecks: 125000,
    items: [{ name: 'Тестовый товар модель 15', quantity: 1, priceKopecks: 125000, sumKopecks: 125000 }],
  });
});

test('rejects the obsolete flat DTO so adapter drift fails closed', () => {
  assert.equal(normalizePlatformaOfdReceipt({
    fiscalDriveNumber: 'FN', fiscalDocumentNumber: 'FD', fiscalSign: 'FP',
    kktRegistrationNumber: 'KKT', totalKopecks: 1, electronicKopecks: 1,
  }), null);
});

test('normalizes a complete Platforma OFD Z report', () => {
  assert.deepEqual(normalizePlatformaOfdZReport({
    kkt: { registrationNumber: '0010475338013250', fiscalDriveNumber: '7384441001649597' },
    shiftNumber: 12,
    openedAt: '2026-08-25T05:30:00.000Z',
    closedAt: '2026-08-25T14:57:00.000Z',
    documentLink: 'https://example.test/z-report',
  }), {
    kktRegistrationNumber: '0010475338013250',
    fiscalDriveNumber: '7384441001649597',
    shiftNumber: '12',
    openedAt: '2026-08-25T05:30:00.000Z',
    closedAt: '2026-08-25T14:57:00.000Z',
    documentLink: 'https://example.test/z-report',
  });
});

test('rejects an incomplete Z report instead of confirming closure', () => {
  assert.equal(normalizePlatformaOfdZReport({
    kkt: { registrationNumber: '0010475338013250', fiscalDriveNumber: '7384441001649597' },
    shiftNumber: 12,
    openedAt: '2026-08-25T05:30:00.000Z',
  }), null);
});
