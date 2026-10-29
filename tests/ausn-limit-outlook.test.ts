import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePortalReport } from '../lib/ausn-portal-view';
import { limitOutlook } from '../lib/ausn-limit-outlook';
import { ownerFullReport } from '../app/taxes-development-preview/owner-scenario';

const report = parsePortalReport(ownerFullReport, 'ausn-executive-full-20261025T074847.md');

test('cautious pace uses the strongest full month and gives an earlier date and a decision date', () => {
  const outlook = limitOutlook(report, '2026-10-25')!;
  assert.equal(outlook.state, 'decide_by');
  assert.equal(outlook.usual.date, '2026-12-15');
  assert.equal(outlook.cautious.month, '2026-08');
  assert.ok(outlook.cautious.date! < outlook.usual.date!);
  assert.equal(outlook.decisionDate, new Date(Date.parse(`${outlook.cautious.date}T00:00:00Z`) - 45 * 86_400_000).toISOString().slice(0, 10));
  assert.equal(limitOutlook(report, outlook.decisionDate!)!.state, 'decide_now');
});

test('no outlook is invented without a valid report', () => {
  assert.equal(limitOutlook(undefined, '2026-10-25'), undefined);
});
