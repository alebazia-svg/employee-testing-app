const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('scheduled cash-operation command is read-only and never calls the 1C retry writer', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/retry-failed-cash-operations.ts'), 'utf8');
  assert.match(source, /automaticRetryDisabled:\s*true/);
  assert.doesNotMatch(source, /retryCashOperationInOneC/);
  assert.doesNotMatch(source, /--confirm-1c-write/);
});

test('only the explicit administrator endpoint owns the retry writer', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/api/admin/workday/cash-operations/[id]/control/route.ts'), 'utf8');
  assert.match(source, /action === 'retry_now'/);
  assert.match(source, /retryCashOperationInOneC\(prisma, id\)/);
});

test('cash operation review presents a dedicated two-action decision instead of the generic manual-review form', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx'), 'utf8');
  assert.match(source, /check\.cashOperation \? 'Выбрать действие' : 'Подтвердить вручную'/);
  assert.match(source, /Инкассация не проведена/);
  assert.match(source, /Провести автоматически/);
  assert.match(source, /Проведу вручную/);
  assert.match(source, /cashOperationDecisionSummary\(manualReviewTarget\.summary\)/);
  assert.match(source, /<span className='font-extrabold'>Причина:<\/span>/);
  assert.match(source, /manualReviewTarget\.cashOperation \? \(/);
  assert.match(source, /\) : <>\s*<fieldset className='mt-4'>/);
});
