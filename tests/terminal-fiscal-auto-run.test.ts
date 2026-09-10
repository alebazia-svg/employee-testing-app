import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseTerminalFiscalAutoRunCli, terminalFiscalAutomaticPeriod, terminalFiscalAutomaticPeriods, terminalFiscalShouldRunUnresolvedSweep, terminalFiscalUnresolvedPeriods } from '../lib/terminal-fiscal-auto-run';

test('automatic current period uses Moscow midnight and a completed five-minute bucket after source delay', () => {
  const period = terminalFiscalAutomaticPeriod('current', new Date('2026-08-13T09:28:00.000Z'));
  assert.deepEqual(period, {
    periodFrom: new Date('2026-08-12T21:00:00.000Z'),
    periodTo: new Date('2026-08-13T09:15:00.000Z'),
  });
});

test('five-minute buckets make a safe operation visible within fifteen minutes', () => {
  const period = terminalFiscalAutomaticPeriod('current', new Date('2026-08-13T09:24:00.000Z'));
  assert.equal(period?.periodTo.toISOString(), '2026-08-13T09:10:00.000Z');
});

test('automatic current period safely skips before the first delayed bucket', () => {
  assert.equal(terminalFiscalAutomaticPeriod('current', new Date('2026-08-12T21:08:00.000Z')), null);
});

test('automatic previous period is exactly one completed Moscow calendar day', () => {
  assert.deepEqual(terminalFiscalAutomaticPeriod('previous', new Date('2026-08-13T21:12:00.000Z')), {
    periodFrom: new Date('2026-08-12T21:00:00.000Z'),
    periodTo: new Date('2026-08-13T21:00:00.000Z'),
  });
});

test('automatic runner remains non-persisting without the explicit audit flag', () => {
  assert.deepEqual(parseTerminalFiscalAutoRunCli(['--mode', 'current']), { mode: 'current', persist: false });
  assert.deepEqual(parseTerminalFiscalAutoRunCli(['--mode', 'previous', '--confirm-audit-write']), { mode: 'previous', persist: true });
  assert.throws(() => parseTerminalFiscalAutoRunCli(['--mode', 'other']), /Usage/);
});

test('production current-day audit runs every five minutes', () => {
  const timer = readFileSync('ops/systemd/offonika-terminal-fiscal-current.timer', 'utf8');
  assert.match(timer, /OnCalendar=\*-\*-\* \*:02\/5:00 Europe\/Moscow/);
});

test('current automation also revisits the previous day for late checks', () => {
  assert.deepEqual(terminalFiscalAutomaticPeriods('current', new Date('2026-08-13T09:28:00.000Z')), [
    { periodFrom: new Date('2026-08-11T21:00:00.000Z'), periodTo: new Date('2026-08-12T21:00:00.000Z') },
    { periodFrom: new Date('2026-08-12T21:00:00.000Z'), periodTo: new Date('2026-08-13T09:15:00.000Z') },
  ]);
});

test('unresolved reviews add unique completed days from the rolling seven-day window', () => {
  assert.deepEqual(terminalFiscalUnresolvedPeriods([
    new Date('2026-08-07T10:00:00.000Z'),
    new Date('2026-08-08T10:00:00.000Z'),
    new Date('2026-08-08T12:00:00.000Z'),
    new Date('2026-08-11T10:00:00.000Z'),
    new Date('2026-08-12T10:00:00.000Z'),
  ], new Date('2026-08-13T09:28:00.000Z')), [
    { periodFrom: new Date('2026-08-06T21:00:00.000Z'), periodTo: new Date('2026-08-07T21:00:00.000Z') },
    { periodFrom: new Date('2026-08-07T21:00:00.000Z'), periodTo: new Date('2026-08-08T21:00:00.000Z') },
    { periodFrom: new Date('2026-08-10T21:00:00.000Z'), periodTo: new Date('2026-08-11T21:00:00.000Z') },
  ]);
});

test('rolling unresolved sweep is limited to one five-minute slot per hour', () => {
  assert.equal(terminalFiscalShouldRunUnresolvedSweep(new Date('2026-08-13T09:02:00.000Z')), true);
  assert.equal(terminalFiscalShouldRunUnresolvedSweep(new Date('2026-08-13T09:07:00.000Z')), false);
});
