import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { reconcileTerminalFiscalMvp } from '../lib/terminal-fiscal-matching';

const fixturePath = path.join(process.cwd(), '.wip', 'platforma-ofd-live', '2026-08-10', '2026-08-09', 'receipts-2026-08-09.raw.json');

test('local dry-run accepts a live OFD receipt fixture without persisting source data', { skip: !fs.existsSync(fixturePath) }, () => {
  const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { receipts?: Array<Record<string, unknown>> };
  const source = payload.receipts?.[0];
  assert.ok(source);
  const receiptDate = String(source.receiptDate);
  const dateMatch = receiptDate.match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2}:\d{2})/);
  assert.ok(dateMatch);
  const receiptAt = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}+03:00`).toISOString();
  const totalKopecks = Number(source.totalSum);
  const items = (source.items as Array<Record<string, unknown>>).map((item) => ({
    name: String(item.name), quantity: Number(item.quantity), priceKopecks: Number(item.price), sumKopecks: Number(item.sum),
  }));
  const fiscal = {
    fiscalDriveNumber: String(source.fiscalDriveNumber),
    fiscalDocumentNumber: String(source.fiscalDocumentNumber),
    fiscalSign: String(source.fiscalSign),
  };
  const output = reconcileTerminalFiscalMvp({
    now: '2026-08-10T12:00:00.000Z',
    sources: {
      tbank: { complete: true, checkedAt: '2026-08-10T12:00:00.000Z' },
      oneC: { complete: true, checkedAt: '2026-08-10T12:00:00.000Z' },
      ofd: { complete: true, checkedAt: '2026-08-10T12:00:00.000Z' },
    },
    mappings: [{ id: 'local-fixture', terminalKey: 'terminal', oneCAcquiringTerminalRef: 'acquiring', oneCCashRegisterRef: 'cash', kktRegistrationNumber: String(source.kktRegId), activeFrom: '2026-08-01T00:00:00.000Z' }],
    bankOperations: [{ terminalKey: 'terminal', rrn: 'synthetic-for-local-dry-run', transactionDate: receiptAt, amountKopecks: totalKopecks, type: Number(source.operationType) === 2 ? 'Credit' : 'Debit' }],
    oneCChecks: [{
      sourceRef: 'synthetic-1c-for-local-dry-run', sourceType: Number(source.operationType) === 2 ? 'refund_check' : 'sale_check',
      operationType: Number(source.operationType) === 2 ? 'refund' : 'sale', dateTime: receiptAt,
      cashRegisterRef: 'cash', kktRegistrationNumber: String(source.kktRegId), totalKopecks,
      electronicKopecks: Number(source.ecashTotalSum),
      cardPayments: [{ lineNumber: '1', amountKopecks: totalKopecks, acquiringTerminalRef: 'acquiring', referenceNumber: '', authorizationCode: '', terminalReceiptNumber: '' }],
      items, fiscalState: 'confirmed', fiscalStateMeaning: 'data_state_only', ...fiscal,
    }],
    ofdReceipts: [{ ...fiscal, operationType: Number(source.operationType), receiptAt, kktRegistrationNumber: String(source.kktRegId), totalKopecks, electronicKopecks: Number(source.ecashTotalSum), items }],
  });
  assert.equal(output.records.length, 1);
  assert.equal(output.records[0].status, 'confirmed');
  assert.equal(output.records[0].reasonCode, 'MATCH_CONFIRMED');
});
