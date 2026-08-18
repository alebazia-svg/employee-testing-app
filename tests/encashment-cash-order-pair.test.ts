import assert from 'node:assert/strict';
import test from 'node:test';
import { createOneCCashExpenseOrder } from '../lib/one-c';

const expense = {
  ref: '00000000-0000-4000-8000-000000000001', number: 'РКО-1', datetime: '2026-08-18 16:00:00', posted: true,
  cashbox: { ref: 'source', name: 'Source' }, target_cashbox: { ref: 'target', name: 'Target' },
  amount: 1000, operation: 'Выдача денежных средств в другую кассу',
};
const receipt = {
  ref: '00000000-0000-4000-8000-000000000002', number: 'ПКО-1', datetime: '2026-08-18 16:00:00', posted: true,
  cashbox: { ref: 'target', name: 'Target' }, source_cashbox: { ref: 'source', name: 'Source' },
  base_document: { ref: expense.ref, name: 'РКО-1' }, amount: 1000, operation: 'Поступление денежных средств из другой кассы',
};

function params() {
  return {
    idempotencyKey: '00000000-0000-4000-8000-000000000003', organizationRef: 'organization',
    cashboxRef: 'source', targetCashboxRef: 'target', employeeName: 'Employee', amount: 1000,
    direction: 'deposit_safe' as const, employeeComment: 'Полный комментарий сотрудника',
  };
}

test('portal accepts only a complete posted RKO/PKO pair', async () => {
  process.env['1C_BASE_URL'] = 'https://one-c.test/hs/agent';
  process.env['1C_API_USER'] = 'test';
  process.env['1C_API_PASSWORD'] = 'test';
  const originalFetch = global.fetch;
  const calls: Array<Record<string, unknown>> = [];
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    if (calls.length === 1) return new Response(JSON.stringify({ ok: true, transaction_rolled_back: true, preview_token: 'pair-token', pair_complete_preview: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, pair_complete: true, document: expense, receipt_document: receipt }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await createOneCCashExpenseOrder(params());
    assert.equal(result.ok, true);
    assert.equal(result.pairComplete, true);
    assert.equal(result.document?.posted, true);
    assert.equal(result.receiptDocument?.posted, true);
    assert.equal(result.receiptDocument?.baseDocument.ref, expense.ref);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.confirm, false);
    assert.equal(calls[1]?.confirm, true);
    assert.equal(calls[1]?.preview_token, 'pair-token');
    assert.equal(calls[0]?.employee_comment, 'Полный комментарий сотрудника');
  } finally {
    global.fetch = originalFetch;
  }
});

test('portal rejects a successful HTTP response without the posted PKO', async () => {
  process.env['1C_BASE_URL'] = 'https://one-c.test/hs/agent';
  process.env['1C_API_USER'] = 'test';
  process.env['1C_API_PASSWORD'] = 'test';
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = (async () => {
    call += 1;
    if (call === 1) return new Response(JSON.stringify({ ok: true, transaction_rolled_back: true, preview_token: 'pair-token', pair_complete_preview: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, pair_complete: false, document: expense }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await createOneCCashExpenseOrder(params());
    assert.equal(result.ok, false);
    assert.equal(result.pairComplete, false);
    assert.equal(result.receiptDocument, null);
    assert.match(result.error ?? '', /complete posted RKO\/PKO pair/);
  } finally {
    global.fetch = originalFetch;
  }
});
