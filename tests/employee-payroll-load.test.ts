import assert from 'node:assert/strict';
import test from 'node:test';
import { EmployeePayrollAccessError, loadEmployeePayroll } from '../lib/employee-payroll-load';
import type { EmployeePayrollView } from '../lib/employee-payroll-view';

const salary: EmployeePayrollView = { month: '2026-10', state: 'current_estimate', estimatedAccrued: 30000,
  earnings: [{ label: 'Выходы', amount: 30000 }], savedAdvance: null };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

test('cold stored read and slow refresh have independent budgets; saved salary is published first', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = deferred<Response>(), fresh = deferred<Response>();
  let calls = 0; const shown: EmployeePayrollView[] = [];
  const result = loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: false,
    request: async () => ++calls === 1 ? saved.promise : fresh.promise, onStored: value => shown.push(value) });
  t.mock.timers.tick(12000); saved.resolve(Response.json(salary)); await flush();
  assert.deepEqual(shown, [salary]); assert.equal(calls, 2);
  t.mock.timers.tick(14000); await flush();
  fresh.resolve(Response.json({ ...salary, savedAdvance: 9500 }));
  assert.equal((await result).savedAdvance, 9500, '26 seconds overall is valid: neither phase exceeded its own deadline');
});

test('a failed or missing stored read still permits live recovery', async () => {
  for (const response of [Response.json({ month: salary.month, state: 'unavailable' }), new Response(null, { status: 503 }), Response.json({ wrong: true })]) {
    let calls = 0, published = false;
    assert.deepEqual(await loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: false,
      request: async () => ++calls === 1 ? response : Response.json(salary), onStored: () => { published = true; } }), salary);
    assert.equal(published, false); assert.equal(calls, 2);
  }
});

test('a stuck stored request is bounded even if transport ignores abort; late data cannot overwrite the live result', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const old = deferred<Response>(); let calls = 0, published = false;
  const result = loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: false,
    request: async () => ++calls === 1 ? old.promise : Response.json(salary), onStored: () => { published = true; } });
  t.mock.timers.tick(15000); await flush(); assert.deepEqual(await result, salary);
  old.resolve(Response.json(salary)); await flush(); assert.equal(published, false);
});

test('live failure preserves the previously published snapshot; unknown advances never become zero', async () => {
  const shown: EmployeePayrollView[] = []; let calls = 0;
  await assert.rejects(loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: false,
    request: async () => ++calls === 1 ? Response.json(salary) : new Response(null, { status: 503 }), onStored: value => shown.push(value) }));
  assert.deepEqual(shown, [salary]); assert.equal(shown[0].savedAdvance, null);
});

test('cold outage cannot manufacture a salary or a zero payment', async () => {
  let calls = 0;
  await assert.rejects(loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: false,
    request: async () => { calls++; return new Response(null, { status: 503 }); },
    onStored: () => assert.fail('no verified amount exists') }));
  assert.equal(calls, 2);
});

test('reentry with an account-scoped saved value skips the stored request; a hung refresh is bounded', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const urls: string[] = [];
  const result = loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: true,
    request: async url => { urls.push(url); return new Promise(() => {}); }, onStored: () => assert.fail('not needed') });
  const rejected = assert.rejects(result, /Не удалось обновить расчёт/);
  t.mock.timers.tick(25000); await rejected;
  assert.deepEqual(urls, ['/api/employee/payroll?month=2026-10']);
});

test('lost access stops both reads and requires clearing account data', async () => {
  for (const status of [401, 403, 404, 410]) {
    let calls = 0;
    await assert.rejects(loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: false,
      request: async () => { calls++; return new Response(null, { status }); }, onStored: () => assert.fail('no private result') }), EmployeePayrollAccessError);
    assert.equal(calls, 1);
  }
});

test('month change or unmount cancels the chain and cannot publish a late previous-month result', async () => {
  const controller = new AbortController(), old = deferred<Response>(); let calls = 0;
  const result = loadEmployeePayroll({ month: salary.month, signal: controller.signal, hasSaved: false,
    request: async () => { calls++; return old.promise; }, onStored: () => assert.fail('cancelled result') });
  const rejected = assert.rejects(result, /отменена/); controller.abort(); await rejected;
  old.resolve(Response.json(salary)); await flush(); assert.equal(calls, 1);
});

test('a changed live source may invalidate an old snapshot; foreign-month responses are rejected', async () => {
  assert.deepEqual(await loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: true,
    request: async () => Response.json({ month: salary.month, state: 'unavailable' }), onStored: () => {} }), { month: salary.month, state: 'unavailable' });
  await assert.rejects(loadEmployeePayroll({ month: salary.month, signal: new AbortController().signal, hasSaved: true,
    request: async () => Response.json({ ...salary, month: '2026-09' }), onStored: () => {} }), /Расчёт пока недоступен/);
});
