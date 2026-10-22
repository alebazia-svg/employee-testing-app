import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as snapshots from '../lib/payroll-attendance-snapshot';
import * as summaries from '../lib/payroll-attendance-summary';
import * as sources from '../lib/payroll-attendance-source';

const source = readFileSync(new URL('../lib/payroll-attendance-refresh.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/admin/payroll/attendance-preview/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.slice(source.indexOf('function pad')) + route.slice(route.indexOf('export async function GET(')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const employee = 'Хурзокова Лиана';
const savedPayload = snapshots.createPayrollAttendanceSnapshotPayload({
  period: { monthIndex: 9, year: 2026, periodKey: '2026-10' }, attendanceMode: 'google-sheets', attendanceMessage: '', scheduleMode: 'google-sheets', scheduleMessage: '',
  formSummaries: [{ employee, formRows: 1, uniqueFormDates: 1, workedDays: 1, lateCount: 0 }], scheduleSummaries: [{ employee, scheduleDays: 1 }],
});
async function run(options: { denied?: boolean; appError?: boolean; googleError?: boolean; emptyGoogle?: boolean; noSaved?: boolean; get?: boolean; month?: number } = {}) {
  const calls: string[] = [];
  const saved = options.noSaved ? null : { payload: savedPayload, sourceCheckedAt: new Date('2026-10-18T06:00:00Z'), updatedAt: new Date('2026-10-18T06:00:00Z') };
  const dependencies = {
    withPayrollSourceLock: async (task: () => Promise<Response>) => task(),
    ...snapshots, ...summaries, ...sources,
    getMoscowDateKey: () => '2026-10-19',
    requireAdminApi: async () => options.denied ? { ok: false, response: Response.json({}, { status: 403 }) } : { ok: true },
    getAttendanceRows: async () => { calls.push('google'); if (options.googleError) throw Error('unavailable'); return { mode: 'google-sheets', message: '', rows: options.emptyGoogle ? [] : [{ timestamp: '18.10.2026 08:50:00', employee, date: '2026-10-18', action: 'Начало рабочего дня', time: '08:50', shift: '09:00–19:00', comment: '' }] }; },
    getScheduleRows: async () => ({ mode: 'google-sheets', message: '', rows: [{ date: '18.10.2026', employee, plannedWork: true }] }),
    prisma: {
      payrollAttendanceSnapshot: { findUnique: async () => saved, upsert: async () => { calls.push('save-source-snapshot'); return { updatedAt: new Date() }; } },
      user: { findMany: async () => { calls.push('pwa'); if(options.appError) throw Error('DB read failed'); return [{ id: 8, name: employee, payrollName: employee, workDays: ['18','19'].map((day) => ({ userId: 8, date: `2026-10-${day}`, startedAt: new Date(`2026-10-${day}T08:46:00+03:00`), status: day === '18' ? 'completed' : 'active' })) }]; } },
    },
    console: { error: () => undefined },
  };
  const exports: Record<string, (r: Request) => Promise<Response>> = {};
  new Function('exports', ...Object.keys(dependencies), compiled)(exports, ...Object.values(dependencies));
  const response = await exports[options.get ? 'GET' : 'POST'](new Request(`https://local/api?year=2026&month=${options.month ?? 9}`));
  return { body: await response.json(), response, calls };
}

test('refresh writes one source snapshot with unique PWA/Google days; payroll runs are never accessed', async () => {
  const result = await run();
  assert.equal(result.body.formSummaries[0].uniqueFormDates, 2);
  assert.equal(result.body.attendanceMode, 'google-sheets+pwa');
  assert.deepEqual(result.calls, ['google', 'pwa', 'save-source-snapshot']);
});

test('source failures retain last-good snapshot without writing partial days', async () => {
  for (const options of [{ appError: true }, { googleError: true }, { emptyGoogle: true }]) {
    const result = await run(options);
    assert.equal(result.body.snapshot.servedFrom, 'stored');
    assert.ok(result.body.snapshot.refreshError);
    assert.deepEqual(result.body.formSummaries, savedPayload.formSummaries);
    assert.ok(!result.calls.includes('save-source-snapshot'));
  }
});

test('failed first load returns an error instead of fabricated zero payroll', async () => {
  const result = await run({ noSaved: true, appError: true });
  assert.equal(result.response.status, 502);
  assert.ok(!result.calls.includes('save-source-snapshot'));
});

test('GET is a historical read without refreshing or rewriting existing snapshots', async () => {
  const result = await run({ get: true });
  assert.deepEqual(result.body.formSummaries, savedPayload.formSummaries);
  assert.deepEqual(result.calls, []);
});

test('authorization is checked before source access or writes', async () => {
  for (const get of [true, false]) {
    const result = await run({ denied: true, get });
    assert.equal(result.response.status, 403);
    assert.deepEqual(result.calls, []);
  }
});

test('pre-cutover refresh never reads PWA', async () => {
  const result = await run({ month: 8, noSaved: true });
  assert.ok(!result.calls.includes('pwa'));
  assert.equal(result.body.attendanceMode, 'google-sheets');
});
