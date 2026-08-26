import assert from 'node:assert/strict';
import test from 'node:test';
import { moscowDateKey, normalizeOneCDateTime, oneCDateTimestamp, parseOneCDateTime } from '../lib/one-c-date';

test('parses Russian 1C date and time as Moscow local time', () => {
  assert.equal(parseOneCDateTime('12.06.2026 14:05:09')?.toISOString(), '2026-06-12T11:05:09.000Z');
  assert.equal(parseOneCDateTime('1.6.2026, 9:05')?.toISOString(), '2026-06-01T06:05:00.000Z');
});

test('does not let a Russian date change month and day through Date.parse', () => {
  const parsed = parseOneCDateTime('12.06.2026');
  assert.equal(parsed?.toISOString(), '2026-06-11T21:00:00.000Z');
  assert.equal(parsed && moscowDateKey(parsed), '2026-06-12');
});

test('parses timezone-less ISO and compact 1C values as Moscow time', () => {
  assert.equal(normalizeOneCDateTime('2026-08-09 13:15:30'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('20260809131530'), '2026-08-09T10:15:30.000Z');
});

test('preserves explicit timezone instants', () => {
  assert.equal(normalizeOneCDateTime('2026-08-09T10:15:30.000Z'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('2026-08-09T13:15:30+03:00'), '2026-08-09T10:15:30.000Z');
});

test('rejects impossible or unsupported values instead of rolling dates', () => {
  assert.equal(parseOneCDateTime('31.02.2026 10:00:00'), null);
  assert.equal(parseOneCDateTime('not-a-date'), null);
  assert.equal(oneCDateTimestamp(''), null);
});
