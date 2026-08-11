import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOneCDateTime } from '../lib/terminal-fiscal-one-c-adapter';

test('normalizes production 1C Russian and compact dates as Europe/Moscow', () => {
  assert.equal(normalizeOneCDateTime('09.08.2026 13:15:30'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('20260809131530'), '2026-08-09T10:15:30.000Z');
});

test('preserves explicit offsets and rejects invalid dates', () => {
  assert.equal(normalizeOneCDateTime('2026-08-09T10:15:30.000Z'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('invalid'), '');
});
