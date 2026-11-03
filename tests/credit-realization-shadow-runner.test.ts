import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automaticCreditShadowPeriod,
  creditShadowRunKey,
  persistCreditRealizationShadowSnapshot,
  type CreditShadowSnapshot,
} from '../lib/credit-realization-shadow-runner';

function snapshot(overrides: Partial<CreditShadowSnapshot> = {}): CreditShadowSnapshot {
  return {
    checkedAt: new Date('2026-08-18T10:18:00.000Z'),
    periodFrom: new Date('2026-08-04T10:18:00.000Z'),
    periodTo: new Date('2026-08-18T10:18:00.000Z'),
    complete: true,
    oneCComplete: true,
    ofdComplete: true,
    errorCode: null,
    rows: [],
    ...overrides,
  };
}

function fakePrisma() {
  const runs: Array<Record<string, unknown>> = [];
  let transactions = 0;
  return {
    runs,
    get transactions() { return transactions; },
    creditRealizationControlRun: {
      findUnique: async ({ where }: { where: { runKey: string } }) => runs.find((run) => run.runKey === where.runKey) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const run = { id: `run-${runs.length + 1}`, ...data };
        runs.push(run);
        return run;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      transactions += 1;
      await fn({
        creditRealizationControlRun: { update: async () => ({}) },
        creditRealizationControlCase: {
          findUnique: async () => null,
          upsert: async () => ({ id: 'case-1' }),
        },
        creditRealizationControlEvaluation: { upsert: async () => ({}) },
      });
    },
  };
}

test('automatic shadow period is minute-aligned and rolling', () => {
  const period = automaticCreditShadowPeriod(new Date('2026-08-18T10:18:42.900Z'), 14);
  assert.equal(period.periodTo.toISOString(), '2026-08-18T10:18:00.000Z');
  assert.equal(period.periodFrom.toISOString(), '2026-08-04T10:18:00.000Z');
  assert.equal(creditShadowRunKey(period.periodFrom, period.periodTo), creditShadowRunKey(period.periodFrom, period.periodTo));
});

test('an incomplete read records only the run and never mutates cases', async () => {
  const prisma = fakePrisma();
  const result = await persistCreditRealizationShadowSnapshot(prisma as never, snapshot({ complete: false, ofdComplete: false, errorCode: 'OFD_SOURCE_INCOMPLETE' }));
  assert.equal(result.persisted, true);
  assert.equal(prisma.transactions, 0);
  assert.equal(prisma.runs[0].status, 'incomplete');
});

test('the same minute window is idempotent', async () => {
  const prisma = fakePrisma();
  const first = await persistCreditRealizationShadowSnapshot(prisma as never, snapshot());
  const second = await persistCreditRealizationShadowSnapshot(prisma as never, snapshot());
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(prisma.runs.length, 1);
  assert.equal(prisma.transactions, 1);
});

test('a delayed older poll cannot overwrite a newer confirmed case',async()=>{
 const db=fakePrisma();let writes=0;
 const original=db.$transaction;
 db.$transaction=async(fn:any)=>original(async(tx:any)=>{
  tx.creditRealizationControlCase.findUnique=async()=>({id:'newer',status:'confirmed',lastCheckedAt:new Date('2026-08-18T10:19:00Z')});
  tx.creditRealizationControlCase.upsert=async()=>{writes++;throw Error('OLDER_CASE_WRITTEN');};
  return fn(tx);
 });
 const row:any={document:{ref:'realization',date:'18.08.2026 10:00:00'},result:{status:'mismatch',reasonCodes:['PAYMENT_DOCUMENT_NOT_POSTED']}};
 await persistCreditRealizationShadowSnapshot(db as never,snapshot({rows:[row]}));
 assert.equal(writes,0);
});
