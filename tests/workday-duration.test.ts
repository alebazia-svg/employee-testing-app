import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDurationWithSeconds } from '../lib/workday-duration';

test('active timer always includes hours, including the first hour', () => {
  for (const [ms, expected] of [
    [-1000, '00:00:00'],
    [0, '00:00:00'],
    [999, '00:00:00'],
    [1000, '00:00:01'],
    [2839000, '00:47:19'],
    [3599999, '00:59:59'],
    [3600000, '01:00:00'],
    [12569000, '03:29:29'],
    [90000000, '25:00:00'],
  ] as const) {
    assert.equal(formatDurationWithSeconds(ms), expected);
  }
});
