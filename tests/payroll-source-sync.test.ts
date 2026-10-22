import assert from 'node:assert/strict';
import test from 'node:test';
import { payrollSyncPeriods, syncPayrollSources } from '../lib/payroll-source-sync';

test('only current and previous Moscow months, including year rollover', () => {
  assert.deepEqual(payrollSyncPeriods(new Date('2026-12-31T21:30:00Z')).map(p => [p.periodKey, p.monthIndex]), [['2027-01', 0], ['2026-12', 11]]);
});

test('ineligible periods do not access sources; no payroll data is synthesized', async () => {
  const rows = await syncPayrollSources(new Date('2026-10-22T10:00:00Z'), {
    eligible: async () => false,
    sales: async () => { throw Error('must not read'); },
    attendance: async () => { throw Error('must not read'); },
  });
  assert.deepEqual(rows.map(row => row.state), ['skipped', 'skipped']);
});

test('uses the same source period without forced historical rereads', async () => {
  const queries: string[] = [];
  const source = async (request: Request) => {
    queries.push(new URL(request.url).search);
    return Response.json({ ok: true, snapshot: { servedFrom: 'refreshed' }, period: { verifiedThrough: '2026-10-20' } });
  };
  const rows = await syncPayrollSources(new Date('2026-10-22T10:00:00Z'), {
    eligible: async period => period.periodKey === '2026-10', sales: source, attendance: source,
  });
  assert.deepEqual(queries, ['?year=2026&month=9', '?year=2026&month=9']);
  assert.equal(rows[0].state, 'updated');
  assert.equal(rows[0].verifiedThrough, '2026-10-20');
});

test('failed attendance fallback is incomplete, not a successful fresh zero', async () => {
  const rows = await syncPayrollSources(new Date('2026-10-22T10:00:00Z'), {
    eligible: async () => true,
    sales: async () => Response.json({ ok: true, snapshot: { servedFrom: 'stored' } }),
    attendance: async () => Response.json({ snapshot: { servedFrom: 'stored', refreshError: 'source unavailable' } }),
  });
  assert.ok(rows.every(row => row.state === 'incomplete' && row.sales && !row.attendance));
});

test('source failure neither aborts the other adapter nor invents coverage', async () => {
  let attendanceReads = 0;
  const rows = await syncPayrollSources(new Date('2026-10-22T10:00:00Z'), {
    eligible: async () => true,
    sales: async () => { throw Error('unavailable'); },
    attendance: async () => { attendanceReads++; return Response.json({ snapshot: { servedFrom: 'refreshed' } }); },
  });
  assert.equal(attendanceReads, 2);
  assert.ok(rows.every(row => row.state === 'incomplete' && !row.sales && row.attendance && !row.verifiedThrough));
});
