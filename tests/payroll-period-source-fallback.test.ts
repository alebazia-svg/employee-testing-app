import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Execute the actual GET orchestration with isolated source/cache dependencies.
const source = readFileSync(new URL('../app/api/admin/payroll/daily-control/route.ts', import.meta.url), 'utf8');
const getSource = source.slice(source.indexOf('export async function GET('), source.indexOf('export async function POST('));
const compiled = ts.transpileModule(getSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
async function run(options: { final?: boolean; daily?: boolean; rawDaily?: boolean; current?: boolean; unauthorized?: boolean; cacheFails?: boolean } = {}) {
  const calls: string[] = [];
  const period = { periodKey: '2026-09', currentPeriod: !!options.current };
  const dependencies = {
    requireAdminApi: async () => options.unauthorized ? { ok: false, response: Response.json({}, { status: 403 }) } : { ok: true },
    readPeriod: () => period,
    prisma: {
      payrollPurchaseSupplierRule: { findMany: async () => [] },
      payrollClassificationRule: { findMany: async () => [] },
      payrollOneCControlSnapshot: { findUnique: async () => null },
    },
    getSourceKind: () => options.current ? 'DAILY' : 'FINAL',
    loadAggregateResponse: async (_p: unknown, _rules: unknown, kind = options.current ? 'DAILY' : 'FINAL') => {
      calls.push('aggregate:' + kind);
      return (kind === 'FINAL' ? options.final : options.daily) ? { snapshot: { kind, finalReconciled: kind === 'FINAL' }, period: { verifiedThrough: kind === 'FINAL' ? '2026-09-30' : '2026-09-15' } } : null;
    },
    loadStored: async (_p: unknown, kind = options.current ? 'DAILY' : 'FINAL') => {
      calls.push('rows:' + kind);
      return kind === 'DAILY' && options.rawDaily ? [{ kind: 'DAILY' }] : [];
    },
    buildControlResponse: (_p: unknown, rows: {kind: string}[]) => ({ snapshot: { kind: rows[0].kind, finalReconciled: false } }),
    presentControlResponse: (value: unknown) => value,
    aggregateSnapshotKey: (_p: unknown, kind: string) => { calls.push('key:' + kind); return {}; },
    buildAggregateWrite: async (...args: unknown[]) => { calls.push('write:' + args[5]); if(options.cacheFails) throw Error('cache unavailable'); },
    console: { error: () => undefined },
  };
  const exports: { GET?: (r: Request) => Promise<Response> } = {};
  new Function('exports', ...Object.keys(dependencies), compiled)(exports, ...Object.values(dependencies));
  const response = await exports.GET!(new Request('https://local/api?year=2026&month=8'));
  return { response, body: await response.json(), calls };
}
test('past month prefers final source, without combining daily rows', async () => {
  const r = await run({ final: true, daily: true });
  assert.deepEqual(r.calls, ['aggregate:FINAL']);
  assert.equal(r.body.snapshot.kind, 'FINAL');
});
test('month rollover serves the daily cache at its actual date, never marks it final', async () => {
  const r = await run({ daily: true });
  assert.equal(r.response.status, 200);
  assert.equal(r.body.snapshot.kind, 'DAILY');
  assert.equal(r.body.snapshot.finalReconciled, false);
  assert.equal(r.body.period.verifiedThrough, '2026-09-15');
});
test('raw daily fallback warms only DAILY cache', async () => {
  const r = await run({ rawDaily: true });
  assert.equal(r.response.status, 200);
  assert.ok(r.calls.includes('write:DAILY'));
  assert.ok(!r.calls.includes('write:FINAL'));
});
test('cache-write failure does not hide historical daily data', async () => {
  assert.equal((await run({ rawDaily: true, cacheFails: true })).response.status, 200);
});
test('absent source returns 404, not fabricated zero amounts', async () => {
  assert.equal((await run()).response.status, 404);
});
test('current month remains on DAILY and unauthorized reads stop before source access', async () => {
  assert.deepEqual((await run({ current: true, daily: true })).calls, ['aggregate:DAILY']);
  const denied = await run({ unauthorized: true });
  assert.equal(denied.response.status, 403);
  assert.deepEqual(denied.calls, []);
});
