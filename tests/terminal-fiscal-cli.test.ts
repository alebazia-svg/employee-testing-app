import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTerminalFiscalRunCli } from '../lib/terminal-fiscal-cli';

const args = ['--mapping-id', 'm1', '--from', '2026-08-09T00:00:00.000Z', '--to', '2026-08-10T00:00:00.000Z'];

test('CLI is non-persisting unless the exact audit confirmation flag is present', () => {
  assert.equal(parseTerminalFiscalRunCli(args).persist, false);
  assert.equal(parseTerminalFiscalRunCli([...args, '--confirm-audit-write']).persist, true);
  assert.equal(parseTerminalFiscalRunCli([...args, '--confirm']).persist, false);
});

test('CLI rejects invalid and over-seven-day periods', () => {
  assert.throws(() => parseTerminalFiscalRunCli(['--mapping-id', 'm1']), /Usage/);
  assert.throws(() => parseTerminalFiscalRunCli(['--mapping-id', 'm1', '--from', '2026-08-01T00:00:00.000Z', '--to', '2026-08-09T00:00:00.000Z']), /OUT_OF_RANGE/);
});
