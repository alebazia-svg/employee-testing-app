import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveExpenseRequestLifecycle,
  expenseRequestSourceHash,
  expenseRequestSyncRunKey,
  normalizeExpenseRequestForAudit,
  type ExistingExpenseRequestCaseLifecycle,
} from '../lib/expense-request-admin-lifecycle';
import { validateExpenseRequestFeedback } from '../lib/expense-request-admin-feedback';
import { expenseRequestInboxBody, expenseRequestInboxEventKey } from '../lib/admin-inbox';
import { expenseRequestDateOrNull } from '../lib/expense-request-admin-sync';
import type { ExpenseRequestSourceRow } from '../lib/expense-request-source';
import { lifecycleFixture } from './fixtures/expense-request-admin-lifecycle';

function existing(overrides: Partial<ExistingExpenseRequestCaseLifecycle> = {}): ExistingExpenseRequestCaseLifecycle {
  return {
    isNotApproved: true, notApprovedCycle: 1, enteredNotApprovedAt: new Date(lifecycleFixture.created.at),
    seenAt: null, seenById: null, reviewedAt: null, reviewedById: null, ...overrides,
  };
}

function row(overrides: Partial<ExpenseRequestSourceRow> = {}): ExpenseRequestSourceRow {
  return {
    ref: lifecycleFixture.ref, number: 'REQ-1', date: lifecycleFixture.created.at, amount: 1000,
    status: { key: 'not_approved', name: 'Не согласована' }, requested_by: { ref: 'manager-1', name: 'Менеджер' },
    comment: 'Доставка товара', completeness: { complete: true },
    supporting_documents: { complete: true, rows: [] }, attached_files: { complete: true, rows: [] },
    execution: { complete: true, state: 'not_executed' }, ...overrides,
  };
}

test('new live not_approved is detected once and starts unread cycle 1', () => {
  const first = deriveExpenseRequestLifecycle({ existing: null, statusKey: 'not_approved', now: new Date(lifecycleFixture.created.at), baseline: false });
  assert.equal(first.notApprovedCycle, 1);
  assert.equal(first.newlyEnteredNotApproved, true);
  assert.equal(first.seenAt, null);
  const repeated = deriveExpenseRequestLifecycle({ existing: first, statusKey: 'not_approved', now: new Date('2026-08-17T07:01:00Z'), baseline: false });
  assert.equal(repeated.notApprovedCycle, 1);
  assert.equal(repeated.newlyEnteredNotApproved, false);
});

test('baseline import does not create a false unread notification', () => {
  const value = deriveExpenseRequestLifecycle({ existing: null, statusKey: 'not_approved', now: new Date(lifecycleFixture.created.at), baseline: true });
  assert.equal(value.notApprovedCycle, 1);
  assert.equal(value.newlyEnteredNotApproved, false);
  assert.ok(value.seenAt);
});

test('seen request keeps audit state after status changes away from not_approved', () => {
  const value = deriveExpenseRequestLifecycle({
    existing: existing({ seenAt: new Date(lifecycleFixture.seen.at), seenById: lifecycleFixture.seen.adminId }),
    statusKey: lifecycleFixture.payable.statusKey, now: new Date(lifecycleFixture.payable.at), baseline: false,
  });
  assert.equal(value.isNotApproved, false);
  assert.equal(value.notApprovedCycle, 1);
  assert.equal(value.seenById, lifecycleFixture.seen.adminId);
});

test('return from payable to not_approved opens exactly one new unread cycle', () => {
  const payable = existing({ isNotApproved: false, seenAt: new Date(lifecycleFixture.seen.at), seenById: 1, reviewedAt: new Date(lifecycleFixture.seen.at), reviewedById: 1 });
  const returned = deriveExpenseRequestLifecycle({ existing: payable, statusKey: lifecycleFixture.returned.statusKey, now: new Date(lifecycleFixture.returned.at), baseline: false });
  assert.equal(returned.notApprovedCycle, 2);
  assert.equal(returned.newlyEnteredNotApproved, true);
  assert.equal(returned.seenAt, null);
  assert.equal(returned.reviewedAt, null);
  const repeated = deriveExpenseRequestLifecycle({ existing: returned, statusKey: 'not_approved', now: new Date('2026-08-17T07:21:00Z'), baseline: false });
  assert.equal(repeated.notApprovedCycle, 2);
  assert.equal(repeated.newlyEnteredNotApproved, false);
});

test('source hash is stable and run key is independent of row order', () => {
  const first = row();
  const second = row({ ref: 'request-fixture-2', number: 'REQ-2' });
  assert.equal(expenseRequestSourceHash(first), expenseRequestSourceHash({ ...first }));
  const input = { from: new Date('2026-08-17T00:00:00Z'), to: new Date('2026-08-18T00:00:00Z'), checkedAt: '2026-08-18T00:01:00Z', complete: true };
  assert.equal(expenseRequestSyncRunKey({ ...input, rows: [first, second] }), expenseRequestSyncRunKey({ ...input, rows: [second, first] }));
  assert.notEqual(expenseRequestSyncRunKey({ ...input, rows: [first] }), expenseRequestSyncRunKey({ ...input, checkedAt: '2026-08-18T00:02:00Z', rows: [first] }));
  assert.notEqual(expenseRequestSourceHash(first), expenseRequestSourceHash({ ...first, status: { key: 'payable', name: 'К оплате' } }));
});

test('audit snapshot excludes unknown secret and card fields', () => {
  const input = { ...row(), token: 'secret', cardNumber: '4111111111111111' } as ExpenseRequestSourceRow & { token: string; cardNumber: string };
  const serialized = JSON.stringify(normalizeExpenseRequestForAudit(input));
  assert.doesNotMatch(serialized, /secret|411111/);
});

test('overall feedback is one quick decision and comment is required only for rule changes', () => {
  assert.equal(validateExpenseRequestFeedback({ decision: 'normal', scope: 'overall', reasonCode: null, comment: '' }), null);
  assert.equal(validateExpenseRequestFeedback({ decision: 'clarification_required', scope: 'overall', reasonCode: null, comment: '' }), null);
  assert.equal(validateExpenseRequestFeedback({ decision: 'hint_unnecessary', scope: 'overall', reasonCode: null, comment: '' }), null);
  assert.equal(validateExpenseRequestFeedback({ decision: 'rule_change_required', scope: 'overall', reasonCode: null, comment: '' }), 'Опишите, как нужно изменить правило.');
  assert.equal(validateExpenseRequestFeedback({ decision: 'rule_change_required', scope: 'overall', reasonCode: null, comment: 'Не требовать основание.' }), null);
});

test('reason feedback remains optional but must reference one reason', () => {
  assert.equal(validateExpenseRequestFeedback({ decision: 'normal', scope: 'reason', reasonCode: null, comment: '' }), 'Выберите конкретную подсказку.');
  assert.equal(validateExpenseRequestFeedback({ decision: 'normal', scope: 'reason', reasonCode: 'CATEGORY_UNDETERMINED', comment: '' }), null);
});

test('shared admin inbox event is cycle-scoped and contains only a short business summary', () => {
  assert.equal(expenseRequestInboxEventKey('request-1', 1), 'expense_request:not_approved:request-1:1');
  assert.notEqual(expenseRequestInboxEventKey('request-1', 1), expenseRequestInboxEventKey('request-1', 2));
  const body = expenseRequestInboxBody({ requestedByName: 'Менеджер', amount: 1500, operation: 'Доставка', comment: 'Товар со склада' });
  assert.match(body, /Менеджер · 1 500,00 ₽ · Доставка · Товар со склада/);
  assert.ok(body.length < 180);
});

test('1C date in DD.MM.YYYY format is interpreted as Moscow time', () => {
  assert.equal(expenseRequestDateOrNull('16.08.2026 23:08:07')?.toISOString(), '2026-08-16T20:08:07.000Z');
  assert.equal(expenseRequestDateOrNull('2026-08-17T09:15:00+03:00')?.toISOString(), '2026-08-17T06:15:00.000Z');
  assert.equal(expenseRequestDateOrNull('not-a-date'), null);
});
