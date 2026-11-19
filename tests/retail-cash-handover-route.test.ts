import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('employee POST schedules initial accounting after the committed handoff or confirmation', async () => {
  const jobs: Array<() => Promise<void>> = [];
  const calls: unknown[][] = [];
  const db = { workDayEntry: { findFirst: async () => ({ id: 12, date: '2026-11-19' }) } };
  let result: { status: string; handedAt: Date | null };
  const server = {
    recountRetailCash: async () => result, confirmRetailCash: async () => result,
    prepareRetailCash: async () => result, serializeRetailHandover: () => result,
    processRetailCash: async (...args: unknown[]) => { calls.push(args); },
  };
  const mocks: Record<string, unknown> = {
    'next/server': { after: (job: () => Promise<void>) => jobs.push(job) },
    '@/lib/retail-cash-handover-environment': { handoverEnvironment: () => true },
    '@/lib/auth': { getCurrentUser: () => ({ id: 7 }) },
    '@/lib/prisma': { prisma: db },
    '@/lib/workday': { usesRetailCashHandover: () => true, getMoscowDateKey: () => '2026-11-19' },
    '@/lib/retail-cash-handover-server': server,
  };
  const bundle = await build({
    entryPoints: ['app/api/employee/workday/cash-handover/route.ts'],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: Object.keys(mocks),
  });
  const mod = { exports: {} as { POST(req: Request): Promise<Response> } };
  const fallback = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
    (id: string) => mocks[id] ?? fallback(id), mod, mod.exports);
  for (const [action, status, handed, shouldSchedule] of [
    ['handoff', 'confirmed', true, true], ['confirm', 'confirmed', true, true],
    ['count', 'zero', false, false], ['prepare', 'ready', false, false],
    ['handoff', 'review', true, false], ['handoff', 'posted', true, false],
    ['handoff', 'error', true, false], ['confirm', 'confirmed', false, false],
  ] as const) {
    result = { status, handedAt: handed ? new Date() : null };
    const response = await mod.exports.POST(new Request('http://localhost/?workDayId=12', {
      method: 'POST', body: JSON.stringify({ action, token: 'offer', handed }),
    }));
    assert.equal(response.status, 200);
    assert.equal(jobs.length, Number(shouldSchedule));
    assert.equal(calls.length, 0);
    if (shouldSchedule) {
      await jobs.shift()!();
      const args = calls.shift()!;
      assert.deepEqual(args.slice(0, 3), [db, 7, 12]);
      assert.equal(args[5], 'initial');
    }
  }
});
