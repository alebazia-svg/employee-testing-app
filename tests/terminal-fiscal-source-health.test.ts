import assert from 'node:assert/strict';
import test from 'node:test';
import { syncTerminalFiscalSourceHealth } from '../lib/terminal-fiscal-source-health';

test('source health sends one outage and one recovery event without repeated noise', async () => {
  const events: any[] = [], receipts: any[] = [];
  const db: any = {
    user: { findMany: async () => [{ id: 1 }] },
    adminInboxEvent: {
      findFirst: async ({ where }: any) => [...events].reverse().find((row) => row.sourceId === where.sourceId) ?? null,
      create: async ({ data }: any) => { const row = { id: String(events.length + 1), ...data }; events.push(row); return row; },
    },
    adminInboxReceipt: {
      createMany: async ({ data }: any) => { receipts.push(...data); return { count: data.length }; },
      updateMany: async ({ where, data }: any) => {
        const rows = receipts.filter((row) => row.eventId === where.eventId && row.readAt == null);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
  };
  const base = { mappingId: 'm1', mappingLabel: 'Рабочее место Миланы', checkedAt: new Date('2026-09-10T10:00:00Z') };
  const down = { aqsi: { complete: false, errorCode: 'AQSI_REQUEST_FAILED' }, oneC: { complete: true }, ofd: { complete: true } };
  await syncTerminalFiscalSourceHealth(db, { ...base, sources: down });
  await syncTerminalFiscalSourceHealth(db, { ...base, checkedAt: new Date('2026-09-10T10:05:00Z'), sources: down });
  assert.equal(events.length, 1);
  assert.match(events[0].body, /aQsi/);
  await syncTerminalFiscalSourceHealth(db, { ...base, checkedAt: new Date('2026-09-10T10:10:00Z'), sources: { ...down, aqsi: { complete: true } } });
  assert.equal(events.length, 2);
  assert.equal(events[1].type, 'dependency.recovered');
  assert.equal(receipts[0].readAt.toISOString(), '2026-09-10T10:10:00.000Z');
  assert.equal(receipts.length, 2);
});
