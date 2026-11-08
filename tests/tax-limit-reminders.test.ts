import test from 'node:test';
import assert from 'node:assert/strict';
import { taxLimitReminderEventKey, taxLimitRegimeEnded } from '../lib/tax-document-reminders';

test('limit reminders are stable within a year and risk level', () => {
  assert.equal(taxLimitReminderEventKey({ level: 'early', dataCutoff: '2026-10-24' }), 'tax_limit:2026:early');
  assert.equal(taxLimitReminderEventKey({ level: 'early', dataCutoff: '2026-11-02' }), 'tax_limit:2026:early');
});

test('a stronger risk level creates a new reminder', () => {
  assert.notEqual(
    taxLimitReminderEventKey({ level: 'early', dataCutoff: '2026-10-24' }),
    taxLimitReminderEventKey({ level: 'plan', dataCutoff: '2026-10-24' }),
  );
});


test('missing archive or failed document read never retires a limit reminder', async () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const missing = { taxControlDocument: { findMany: async () => [] } };
  const failed = { taxControlDocument: { findMany: async () => { throw new Error('source unavailable'); } } };
  assert.equal(await taxLimitRegimeEnded(missing as never, now, '2026'), false);
  assert.equal(await taxLimitRegimeEnded(failed as never, now, '2026'), false);
});
