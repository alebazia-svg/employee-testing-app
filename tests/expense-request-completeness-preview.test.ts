import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('preview emits aggregates only and does not expose request identity or free text', () => {
  const fixture = {
    rows: [{
      ref: 'sensitive-request-ref',
      amount: 12_345,
      comment: 'Доставка телефона от чувствительного поставщика',
      requested_by: { ref: 'sensitive-requester-ref', name: 'Чувствительное имя' },
      completeness: { complete: true },
      supporting_documents: { complete: true, rows: [] },
      attached_files: { complete: true, rows: [] },
      execution: { complete: true, state: 'not_executed' },
    }],
  };
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/expense-request-completeness-preview.ts'], {
    cwd: process.cwd(), input: JSON.stringify(fixture), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /sensitive-request-ref|sensitive-requester-ref|Чувствительное имя|чувствительного поставщика|12345/);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.source.rows, 1);
  assert.equal(summary.completenessStates.needs_clarification, 1);
  assert.equal(summary.precheck.confirmedEmployeeQuestions ?? 0, 0);
  assert.equal(summary.precheck.adminOnly, 1);
  assert.equal(summary.reasonPolicy.confirmedBusinessRules.DELIVERY_DESTINATION_MISSING, 1);
});
