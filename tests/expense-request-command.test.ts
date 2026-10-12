import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpenseCommand, validateExpenseCommandAgainstCard, readNativeExpenseCard, supportsExpenseAction, type NativeExpenseCard, type ExpenseCommand } from '../lib/expense-request-command';
import { createExpenseAdminClient, expenseNativeTransport, ExpenseNativeError } from '../lib/expense-request-admin-client';

const ref = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const token = '33333333-3333-4333-8333-333333333333';

test('native lookup sends spaces as percent-20 and preserves literal plus signs', async (context) => {
  const env = { '1C_BASE_URL': 'http://127.0.0.1:1', '1C_API_USER': 'test-only', '1C_API_PASSWORD': 'test-only' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  context.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let requestedUrl = '';
  context.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return Response.json({ ok: true, items: [] });
  });
  await expenseNativeTransport({ method: 'GET', query: new URLSearchParams({ type: 'Статья расходов', q: 'Бумага + картридж' }) });
  const query = new URL(requestedUrl).search.slice(1);
  assert.ok(!query.includes('+'));
  const nativeParams = Object.fromEntries(query.split('&').map(pair => pair.split('=').map(decodeURIComponent)));
  assert.equal(nativeParams.type, 'Статья расходов');
  assert.equal(nativeParams.q, 'Бумага + картридж');
});
function card(): NativeExpenseCard {
  const cell = { type: 'Строка', filled: true, value: 'Тестовый комментарий', name: '', ref: '', xml: 'Тестовый комментарий' };
  return { ok: true, contract: 'expense-request-admin-v1', state: {
    document: { ref, version_token: 'native-v1', amount: 300, number: 'TEST-1', date: '2026-09-29', posted: true, deletion_mark: false, status: { key: 'not_approved', name: 'Не согласована', ref: '' } },
    header: { Комментарий: cell }, lines: [{ line_number: 1, fields: { Комментарий: cell } }], execution: { complete: true }, linked_cash_expense_orders: { complete: true, rows: [] },
  }, schema: [{ scope: 'header', name: 'Комментарий', label: 'Комментарий', types: [{ type: 'Строка', kind: 'scalar' }] }], history: { source: 'portal_commands_only', rows: [], truncated: false } };
}
function command(): ExpenseCommand { return { command_id: id, version_token: 'native-v1', action: 'save', changes: [{ scope: 'header', line_number: 0, field: 'Комментарий', type: 'Строка', xml: 'Исправлено' }] }; }

test('only explicit accounting edits are accepted, never amount or browser actor/ref injection', () => {
  assert.deepEqual(parseExpenseCommand(command()), command());
  assert.throws(() => parseExpenseCommand({ ...command(), actor: 'owner' }));
  assert.throws(() => parseExpenseCommand({ ...command(), request_ref: ref }));
  assert.throws(() => parseExpenseCommand({ ...command(), changes: [{ ...command().changes[0], field: 'Сумма' }] }));
  assert.throws(() => parseExpenseCommand({ ...command(), changes: [command().changes[0], command().changes[0]] }));
  assert.throws(() => parseExpenseCommand({ ...command(), changes: [{ ...command().changes[0], line_number: 1 }] }));
});
test('fresh native version, row and field type must match before preview', () => {
  validateExpenseCommandAgainstCard(command(), card());
  assert.throws(() => validateExpenseCommandAgainstCard({ ...command(), version_token: 'old' }, card()));
  const changed = card(); changed.state.document.status.key = 'approved';
  assert.throws(() => validateExpenseCommandAgainstCard(command(), changed));
  assert.throws(() => validateExpenseCommandAgainstCard({ ...command(), changes: [{ ...command().changes[0], type: 'Число' }] }, card()));
});
test('payment authorization requires native support and permits pending or agreed requests only', () => {
  const c = card();
  const pay: ExpenseCommand = { ...command(), action: 'mark_payable', changes: [] };
  assert.deepEqual(parseExpenseCommand(pay), pay);
  assert.equal(supportsExpenseAction(c, 'mark_payable'), false);
  assert.throws(() => validateExpenseCommandAgainstCard(pay, c), /обновление модуля/);
  c.supported_actions = ['save', 'mark_payable'];
  validateExpenseCommandAgainstCard(pay, c);
  c.state.document.status.key = 'approved';
  validateExpenseCommandAgainstCard(pay, c);
  assert.throws(() => validateExpenseCommandAgainstCard(command(), c));
  for (const status of ['payable', 'rejected', 'unknown']) {
    c.state.document.status.key = status;
    assert.throws(() => validateExpenseCommandAgainstCard(pay, c));
  }
  c.state.document.status.key = 'approved'; c.state.document.deletion_mark = true;
  assert.throws(() => validateExpenseCommandAgainstCard(pay, c));
});
test('intermediate approval commands cannot be sent again from an old browser', async () => {
  let calls = 0;
  const client = createExpenseAdminClient(async () => { calls++; return {}; });
  const legacy: ExpenseCommand = { ...command(), action: 'approve', changes: [] };
  await assert.rejects(client.preview(ref, legacy, 'portal:1 Test'));
  await assert.rejects(client.confirm(ref, legacy, 'portal:1 Test', token));
  assert.equal(calls, 0);
});
test('approved never passes as payable in preview or a verified committed response', async () => {
  const pay: ExpenseCommand = { ...command(), action: 'mark_payable', changes: [] };
  const after = card().state; after.document.status.key = 'approved';
  const client = createExpenseAdminClient(async () => ({ ok: true, contract: 'expense-request-admin-v1', committed: false, transaction_rolled_back: true, preview_token: token, before: card().state, proposed_after: after }));
  await assert.rejects(client.preview(ref, pay, 'portal:1 Test'), /К оплате/);
  after.document.status.key = 'payable';
  assert.equal((await client.preview(ref, pay, 'portal:1 Test')).kind, 'preview');
  const writer = createExpenseAdminClient(async () => ({ ok: true, contract: 'expense-request-admin-v1', committed: true, verified: true, state: after }));
  assert.equal((await writer.confirm(ref, pay, 'portal:1 Test', token)).state.document.status.key, 'payable');
  after.document.status.key = 'approved';
  await assert.rejects(writer.confirm(ref, pay, 'portal:1 Test', token), (e: unknown) => e instanceof ExpenseNativeError && e.uncertain);
});
test('legacy approval history remains readable beside payment authorization history', () => {
  const c = card(); c.supported_actions = ['save', 'mark_payable'];
  c.history.rows = ['approve', 'mark_payable'].map((action, index) => ({ command_id: index ? token : id, action, actor: 'portal:1 Test', at: '2026-10-01T17:00:00Z', before: card().state, after: card().state }));
  assert.equal(readNativeExpenseCard(c, ref).history.rows.length, 2);
  assert.throws(() => readNativeExpenseCard({ ...c, supported_actions: ['approve'] }, ref));
});
test('wrong native identity, missing cells and incomplete schema cannot become an editable card', () => {
  assert.equal(readNativeExpenseCard(card(), ref).state.document.amount, 300);
  assert.throws(() => readNativeExpenseCard(card(), id));
  const malformed = card(); delete (malformed.state.header.Комментарий as Partial<typeof malformed.state.header.Комментарий>).xml;
  assert.throws(() => readNativeExpenseCard(malformed, ref));
  assert.throws(() => readNativeExpenseCard({ ...card(), history: null }, ref));
});
test('preview never sends confirm and refuses a response without confirmed rollback', async () => {
  const calls: unknown[] = [];
  const client = createExpenseAdminClient(async call => { calls.push(call); return { ok: true, contract: 'expense-request-admin-v1', committed: false, transaction_rolled_back: false, preview_token: token, before: card().state, proposed_after: card().state }; });
  await assert.rejects(client.preview(ref, command(), 'portal:1 Test'));
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { body: { confirm: boolean } }).body.confirm, false);
});
test('confirmation requires a token and must report a committed validated result', async () => {
  let count = 0;
  const client = createExpenseAdminClient(async () => { count++; return { ok: true, contract: 'expense-request-admin-v1', committed: false }; });
  await assert.rejects(client.confirm(ref, command(), 'portal:1 Test', ''), ExpenseNativeError);
  assert.equal(count, 0);
  await assert.rejects(client.confirm(ref, command(), 'portal:1 Test', token), (e: unknown) => e instanceof ExpenseNativeError && e.uncertain);
  assert.equal(count, 1);
});
test('already committed command returns readback without sending another confirmation', async () => {
  let count = 0;
  const client = createExpenseAdminClient(async () => { count++; return { ok: true, contract: 'expense-request-admin-v1', committed: true, replayed: true, verified: true, state: card().state }; });
  const result = await client.preview(ref, command(), 'portal:1 Test');
  assert.equal(result.kind, 'committed');
  assert.equal(count, 1);
});
test('uncertain network failure is never retried automatically with another command id', async () => {
  let count = 0;
  const client = createExpenseAdminClient(async () => { count++; throw new ExpenseNativeError('Timeout', true); });
  await assert.rejects(client.confirm(ref, command(), 'portal:1 Test', token), (e: unknown) => e instanceof ExpenseNativeError && e.uncertain);
  assert.equal(count, 1);
});

test('native field readback mismatch gives an actionable error without confirming the command', async (context) => {
  const env = { '1C_BASE_URL': 'http://127.0.0.1:1', '1C_API_USER': 'test-only', '1C_API_PASSWORD': 'test-only' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  context.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  context.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => String(url).endsWith('/version')
    ? Response.json({ environment: 'production', base: 'Teleinvest_UT11', expense_request_commands: { contract: 'expense-request-admin-v1', actions: ['save'] } })
    : Response.json({ ok: false, error: 'field_readback_failed: СтатьяРасходов', committed: false, messages: [] }, { status: 409 }));
  await assert.rejects(expenseNativeTransport({ method: 'POST', body: { action: 'save', confirm: false } }), error => {
    assert.ok(error instanceof ExpenseNativeError);
    assert.equal(error.uncertain, false);
    assert.equal(error.status, 409);
    assert.match(error.message, /выбранной операции/);
    assert.doesNotMatch(error.message, /field_readback_failed/);
    return true;
  });
});


test('payment breakdown edits preserve header versus line scope and native row numbers', async () => {
  const c = card(); c.supported_actions = ['save', 'mark_payable'];
  const empty = (type: string) => ({ type, filled: false, value: null, name: '', ref: '', xml: '' });
  c.state.header.СтатьяДвиженияДенежныхСредств = empty('Статья движения денежных средств');
  c.state.lines = [1, 3].map(line_number => ({ line_number, fields: {
    СтатьяДвиженияДенежныхСредств: empty('Статья движения денежных средств'),
    СтатьяРасходов: empty('Статья расходов'),
    Подразделение: empty('Подразделение'),
  } }));
  c.schema = [
    { scope: 'header', name: 'СтатьяДвиженияДенежныхСредств', label: 'Статья ДДС', types: [{ type: 'Статья движения денежных средств', kind: 'reference' }] },
    ...Object.entries(c.state.lines[0].fields).map(([name, cell]) => ({ scope: 'line' as const, name, label: name, types: [{ type: cell.type, kind: 'reference' as const }] })),
  ];
  const edit: ExpenseCommand = { ...command(), action: 'mark_payable', changes: [
    { scope: 'header', line_number: 0, field: 'СтатьяДвиженияДенежныхСредств', type: 'Статья движения денежных средств', xml: id },
    { scope: 'line', line_number: 3, field: 'СтатьяДвиженияДенежныхСредств', type: 'Статья движения денежных средств', xml: token },
    { scope: 'line', line_number: 3, field: 'СтатьяРасходов', type: 'Статья расходов', xml: ref },
  ] };
  validateExpenseCommandAgainstCard(parseExpenseCommand(edit), readNativeExpenseCard(c, ref));
  const after = structuredClone(c.state); after.document.status.key = 'payable';
  let sent: unknown;
  const client = createExpenseAdminClient(async params => {
    sent = params.body;
    return { ok: true, contract: c.contract, committed: false, transaction_rolled_back: true, preview_token: token, before: c.state, proposed_after: after };
  });
  await client.preview(ref, edit, 'portal:1 Test');
  assert.deepEqual(sent, { ...edit, request_ref: ref, actor: 'portal:1 Test', confirm: false });
  assert.throws(() => validateExpenseCommandAgainstCard({ ...edit, changes: [{ ...edit.changes[2], line_number: 2 }] }, c), /Строка или поле/);
  assert.throws(() => parseExpenseCommand({ ...edit, changes: [{ ...edit.changes[2], scope: 'header', line_number: 0 }] }));
});
