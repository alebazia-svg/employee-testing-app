import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTerminalFiscalAutoRunCli, terminalFiscalAutomaticPeriod } from '../lib/terminal-fiscal-auto-run';

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
