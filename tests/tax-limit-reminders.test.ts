import test from 'node:test';
import assert from 'node:assert/strict';
import { taxLimitReminderEventKey } from '../lib/tax-document-reminders';

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
