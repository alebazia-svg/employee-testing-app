import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';

test('handover endpoint persists both departments without duplicating confirmed transfers', {
  skip: process.env.HANDOVER_EXTERNAL_QA !== '1',
}, async () => {
  assert.match(process.env.DATABASE_URL ?? '', /^postgresql:\/\/postgres:handover-local-only@127\.0\.0\.1:\d+\/handover_qa$/);
  const prisma = new PrismaClient();
  let employee: { id: number; name: string; department: string };
  let kkmReady = true;
  let beforeFinalWrite: (() => Promise<void>) | undefined;
  const mocks: Record<string, unknown> = {
    'next/server': { after() {} },
    '@/lib/prisma': { prisma },
    '@/lib/auth': { getCurrentUser: async () => employee },
    '@/lib/one-c': {
      getCashStatementDimensions: async () => ({ ok: false, error: 'QA: 1С отключена' }),
      createOneCCashExpenseOrder: async () => assert.fail('unexpected financial write'),
    },
    '@/lib/workday-required-issues': {
      findOpenRequiredWorkdayIssues: async () => { await beforeFinalWrite?.(); return []; },
      findApprovedCloseException: async () => null,
    },
    '@/lib/handover-cash-expense-snapshot': { loadHandoverCashExpenses: async () => null },
    '@/lib/terminal-fiscal-handover': { refreshHandoverReceipts: async () => {}, escalateHandoverReceipts: async () => {} },
    '@/lib/employee-handover-audit-server': { scheduleHandoverCheckAudit() {} },
    '@/lib/kkm-shift-close-control': {
      prefetchEmployeeKkmClose: async () => {}, syncKkmShiftCloseIssue: async () => {},
      firstKkmCloseEvidence: (_: unknown, evidence: unknown) => evidence,
      readKkmShiftCloseSimulation: () => null, kkmShiftCloseAllowsHandover: () => kkmReady,
      verifyEmployeeKkmShiftClose: async () => ({
        status: kkmReady ? 'confirmed' : 'unavailable', checkedAt: new Date().toISOString(),
      }),
    },
  };
  const bundle = await build({
    entryPoints: ['app/api/employee/shift-control/tasks/[id]/route.ts'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'handover-qa', setup(api) {
      api.onResolve({ filter: /.*/ }, arg => arg.path in mocks ? { path: arg.path, external: true } : undefined);
    } }],
  });
  const mod = { exports: {} as { PATCH(req: Request, props: { params: Promise<{ id: string }> }): Promise<Response> } };
  const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
    (key: string) => key in mocks ? mocks[key] : require(key), mod, mod.exports,
  );

  try {
    for (const scenario of [
      ['wholesale', 'deposit_safe', true], ['retail', 'deposit_safe', true],
      ['retail', 'phone_reserve', true], ['wholesale', 'deposit_safe', false],
      ['retail', 'phone_reserve', false], ['retail', 'deposit_safe', false],
    ] as const) {
      const [department, direction, external] = scenario;
      employee = await prisma.user.create({ data: {
        login: randomUUID(), name: 'QA', department, role: 'EMPLOYEE', passwordHash: 'none',
      } });
      const date = '2026-11-27';
      const day = await prisma.workDayEntry.create({ data: {
        userId: employee.id, department, date, shiftCode: department === 'retail' ? '11_20' : '09_19',
        shiftLabel: 'QA', startedAt: new Date('2026-11-27T08:00:00Z'), status: 'active',
      } });
      const run = await prisma.shiftControlRun.create({ data: {
        userId: employee.id, workDayEntryId: day.id, date, department, status: 'active',
        tasks: { create: { category: 'handover', title: 'Сдать смену', sortOrder: 1, status: 'pending', handoverData: {
          draft: true, cashCountStartedAt: '2026-11-27T16:33:00Z',
          personalCash: { cashBalance: 77870 }, reserveCash: { cashBalance: 10000 },
          photos: { encashmentDocument: { storagePath: 'fixture-photo.jpg' } },
        } } },
      }, include: { tasks: true } });
      const task = run.tasks[0];
      const operation = await prisma.cashOperation.create({ data: {
        userId: employee.id, workDayEntryId: day.id, date, department, direction, amount: 77000,
        photoPath: 'fixture-photo.jpg', idempotencyKey: external ? randomUUID() : `h${task.id}`,
        status: external ? 'pending_1c' : 'posted_1c_pair', createdAt: new Date('2026-11-27T16:34:00Z'),
        oneCDocumentRef: 'fixture-rko', oneCReceiptDocumentRef: 'fixture-pko',
      } });
      if (!external) {
        const { claimCashOperationSubmission } = await import('../lib/cash-operation-submission');
        const separate = await claimCashOperationSubmission(prisma, {
          userId: employee.id, workDayEntryId: day.id, date, department,
          direction, amount: 77000, idempotencyKey: randomUUID(), comment: '',
          distinctFromOperationId: null,
          intent: { baselineId: null, photoSha256: 'a'.repeat(64), photoBytes: 100 },
        }, async () => assert.fail('a stale separate form must not save another photo'));
        assert.equal(separate.kind, 'duplicate');
        if (separate.kind === 'duplicate') assert.equal(separate.operation.id, operation.id);
      }
      const send = async (fields: Record<string, string>, status: number | number[]) => {
        const body = new FormData();
        for (const [key, value] of Object.entries(fields)) body.set(key, value);
        const result = await mod.exports.PATCH(new Request('http://localhost', { method: 'PATCH', body }), {
          params: Promise.resolve({ id: String(task.id) }),
        });
        const payload = await result.json();
        assert.ok([status].flat().includes(result.status), JSON.stringify({ scenario, status: result.status, payload }));
        return { ...payload, httpStatus: result.status };
      };
      const fresh = {
        personalCashBalance: external ? '870' : '77870',
        reserveCashBalance: department === 'retail' ? direction === 'phone_reserve' && external ? '87000' : '10000' : '',
        encashmentAmount: external ? '' : '77000', encashmentDirection: direction,
        externalCashIds: external ? String(operation.id) : '',
      };
      if (external) {
        await send({ ...fresh, intent: 'draft' }, 409);
        await prisma.cashOperation.update({ where: { id: operation.id }, data: { status: 'posted_1c_pair' } });
        await send({ ...fresh, externalCashIds: '' }, 409);
        if (department === 'retail' && direction === 'phone_reserve') {
          await send({ ...fresh, reserveCashBalance: '' }, 409);
          await send({ ...fresh, reserveCashBalance: '', intent: 'draft' }, 200);
        }
      }
      if (department === 'retail') {
        kkmReady = false;
        assert.equal((await send(fresh, 409)).code, 'OPEN_REQUIRED_ISSUES');
        kkmReady = true;
      }
      if (!external && department === 'wholesale') {
        let raceId: number | undefined;
        beforeFinalWrite = async () => {
          beforeFinalWrite = undefined;
          const { claimCashOperationSubmission } = await import('../lib/cash-operation-submission');
          const result = await claimCashOperationSubmission(prisma, {
            userId: employee.id, workDayEntryId: day.id, date, department,
            direction: 'deposit_safe', amount: 70000, idempotencyKey: randomUUID(), comment: '',
            distinctFromOperationId: null,
          }, async () => 'fixture-race-photo.jpg');
          assert.equal(result.kind, 'created');
          if (result.kind === 'created') raceId = result.operation.id;
        };
        await send(fresh, 409);
        assert.ok(raceId);
        await prisma.cashOperation.update({ where: { id: raceId }, data: { status: 'cancelled' } });
      }
      const attempts = await Promise.all([send(fresh, [200, 404, 409]), send(fresh, [200, 404, 409])]);
      assert.ok(attempts.some(attempt => attempt.httpStatus === 200));
      assert.ok((await prisma.workDayEntry.findUniqueOrThrow({ where: { id: day.id } })).endedAt);
      assert.equal(await prisma.cashOperation.count({ where: { workDayEntryId: day.id, status: { not: 'cancelled' } } }), 1);
      await send(fresh, 404);
    }
  } finally {
    await prisma.$disconnect();
  }
});
