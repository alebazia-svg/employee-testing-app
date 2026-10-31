import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readEmployeePayroll, type PersonalPayrollRun, type PayrollViewer } from '../lib/employee-payroll-read';

const viewer = { id: 7, role: 'EMPLOYEE', isActive: true, portalArea: 'WORKDAY' };
const run: PersonalPayrollRun = { status: 'FINAL', period: { periodKey: '2026-09' }, employeeResults: [
  { userId: 7, grossPay: 66528.68, advance: 2000 },
  { userId: 8, grossPay: 999999, advance: 10000 },
] };
const query = () => new URLSearchParams('month=2026-09');
const deps = (value: PersonalPayrollRun | null = run) => ({ currentPeriod: () => '2026-10', findFinal: async () => value,
  findSettlement: async () => ({ accrued: 66000, paid: 66000, remaining: 0 }) });

test('only the signed-in employee receives authoritative settlement, not automatic gross or internal details', async () => {
  let received: unknown;
  const result = await readEmployeePayroll(viewer, query(), { ...deps(), findFinal: async (...args) => { received = args; return run; } });
  assert.deepEqual(received, ['2026-09', 7]);
  assert.deepEqual(result, { status: 200, body: { month: '2026-09', state: 'confirmed', accrued: 66000, paid: 66000, remaining: 0 } });
});
test('missing 1C accrual never falls back to automatic FINAL gross', async () => {
  const result = await readEmployeePayroll(viewer, query(), { ...deps(), findSettlement: async () => null });
  assert.deepEqual(result.body, { month: '2026-09', state: 'unavailable' });
});
test('authentication and role checks happen before any payroll read', async () => {
  for (const user of [null, { ...viewer, isActive: false }, { ...viewer, role: 'ADMIN' },
    { ...viewer, portalArea: 'PROCUREMENT' }, { ...viewer, portalArea: '' }, { ...viewer, portalArea: 'UNKNOWN' }]) {
    const result = await readEmployeePayroll(user as PayrollViewer | null, query(), { ...deps(), findFinal: async () => { throw Error('must not read'); } });
    assert.equal(result.status, user ? 403 : 401);
  }
});
test('rejects identity overrides, duplicate months, invalid and future periods before read', async () => {
  for (const value of ['userId=8', 'employee=someone', 'month=2026-13', 'month=2026-11', 'month=2026-09&month=2026-10']) {
    assert.equal((await readEmployeePayroll(viewer, new URLSearchParams(value), deps())).status, 400);
  }
});
test('missing, duplicate, unbound, draft or wrong-month evidence is unavailable, never zero', async () => {
  for (const value of [null, { ...run, employeeResults: [] }, { ...run, employeeResults: [run.employeeResults[0], run.employeeResults[0]] },
    { ...run, employeeResults: [{ ...run.employeeResults[0], userId: null }] }, { ...run, status: 'DRAFT' },
    { ...run, period: { periodKey: '2026-08' } }, { ...run, employeeResults: [{ ...run.employeeResults[0], grossPay: NaN }] }]) {
    assert.deepEqual((await readEmployeePayroll(viewer, query(), deps(value))).body, { month: '2026-09', state: 'unavailable' });
  }
});
test('database failure exposes no diagnostic or personal data', async () => {
  const result = await readEmployeePayroll(viewer, query(), { ...deps(), findFinal: async () => { throw Error('private database details'); } });
  assert.equal(result.status, 503);
  assert.ok(!JSON.stringify(result).includes('private database'));
});
test('current month uses private server calculation only when no final exists', async () => {
  const current = { userId: 7, periodKey: '2026-10', grossPay: 63321,
    earnings: [{ label: 'Оптовые продажи' as const, amount: 60321 }],
    verifiedThrough: '2026-10-19', attendanceCheckedAt: '2026-10-20T09:00:00Z', draftRevision: 3 };
  const result = await readEmployeePayroll(viewer, new URLSearchParams(), { ...deps(null), findCurrent: async () => current });
  assert.deepEqual(result.body, { month: '2026-10', state: 'current_estimate', estimatedAccrued: 60300,
    earnings: [{ label: 'Оптовые продажи', amount: 60300 }], verifiedThrough: '2026-10-19', savedAdvance: null });
  for (const patch of [{ userId: 8 }, { periodKey: '2026-09' }, { grossPay: NaN }, { verifiedThrough: '2026-09-30' }]) {
    const rejected = await readEmployeePayroll(viewer, new URLSearchParams(), { ...deps(null), findCurrent: async () => ({ ...current, ...patch }) });
    assert.ok('state' in rejected.body); assert.equal(rejected.body.state, 'unavailable');
  }
  const historical = await readEmployeePayroll(viewer, query(), { ...deps(null), findCurrent: async () => { throw Error('must not recompute history'); } });
  assert.ok('state' in historical.body); assert.equal(historical.body.state, 'unavailable');
});
test('missing earnings never falls back to gross with hidden bonuses; verified advances remain separate', async () => {
  const daily = { userId: 7, periodKey: '2026-10', grossPay: 60000, dayPay: 6000,
    verifiedThrough: '2026-10-17', attendanceCheckedAt: '2026-10-22T09:00:00Z', draftRevision: 3 };
  const read = (patch: object) => readEmployeePayroll(viewer, new URLSearchParams(), {
    ...deps(null), findCurrent: async () => ({ ...daily, ...patch }) });
  assert.deepEqual((await read({})).body, { month: '2026-10', state: 'unavailable' });
  for (const advance of [0, 13000, null]) {
    const result = await read({ earnings: [{ label: 'Выходы', amount: 6000 }, { label: 'Оптовые продажи', amount: 51000 }], advance });
    assert.equal((result.body as any).estimatedAccrued, 57000);
    assert.equal((result.body as any).savedAdvance, advance);
    assert.ok(!JSON.stringify(result.body).includes('grossPay'));
  }
});
test('confirmed first payment does not replace full posted salary, unknown payments never become zero', async () => {
  for (const settlement of [{ accrued: 66500, paid: 12000, remaining: 54500 },
    { accrued: 66500, paid: null, remaining: null }, { accrued: 66500, paid: 66500, remaining: 0 }]) {
    const result = await readEmployeePayroll(viewer, query(), { ...deps(), findSettlement: async () => settlement });
    assert.deepEqual(result.body, { month: '2026-09', state: 'confirmed', ...settlement });
  }
});
test('verified earlier credit is disclosed, not added to cash paid or removed from accrued', async () => {
  const settlement = { accrued: 89100, paid: 89000, remaining: 0, creditedFromEarlier: 100 };
  assert.deepEqual((await readEmployeePayroll(viewer, query(), { ...deps(), findSettlement: async () => settlement })).body,
    { month: '2026-09', state: 'confirmed', ...settlement });
  for (const creditedFromEarlier of [-1, NaN, 50, 200]) {
    const result = await readEmployeePayroll(viewer, query(), { ...deps(), findSettlement: async () => ({ ...settlement, creditedFromEarlier }) });
    assert.equal((result.body as any).remaining, null);
    assert.equal((result.body as any).creditedFromEarlier, undefined);
  }
});

test('missing-day state is allowlisted only for the current projection; FINAL takes precedence', async () => {
  const daily = {userId:7,periodKey:'2026-10',grossPay:1234.56,verifiedThrough:'2026-10-23',
    attendanceCheckedAt:'2026-10-24T09:00:00Z',draftRevision:1,daysUnmarked:true,
    earnings:[{label:'Финбокс' as const,amount:1234.56}]};
  const result = await readEmployeePayroll(viewer,new URLSearchParams(),{...deps(null),findCurrent:async()=>daily});
  assert.equal((result.body as any).daysUnmarked,true);
  assert.equal((result.body as any).estimatedAccrued,1200);
  const final = await readEmployeePayroll(viewer,query(),{...deps(),findCurrent:async()=>{throw Error('must not read');}});
  assert.equal((final.body as any).state,'confirmed'); assert.equal((final.body as any).daysUnmarked,undefined);
});
