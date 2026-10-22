import 'server-only';
import { Prisma, type PrismaClient } from '@prisma/client';
import { payrollDraftFingerprint, validatePayrollDraft, type PayrollDraftRead, type validatePayrollDraftWrite } from './payroll-draft';

type Db = Pick<PrismaClient, '$transaction'>;
export class PayrollDraftConflict extends Error {}
export async function savePayrollDraft(db: Db, input: ReturnType<typeof validatePayrollDraftWrite>, actor: number): Promise<PayrollDraftRead> {
  try {
    return await db.$transaction(async tx => {
      const period = await tx.payrollPeriod.upsert({ where: { periodKey: input.period }, update: {}, create: {
        periodKey: input.period, year: Number(input.period.slice(0, 4)), month: Number(input.period.slice(5)) - 1,
      } });
      const lock = await tx.$queryRaw<Array<{ status: string }>>`SELECT "status" FROM "PayrollPeriod" WHERE "id" = ${period.id} FOR UPDATE`;
      const locked = lock[0]?.status === 'CLOSED' || await tx.payrollRun.count({ where: { periodId: period.id, status: 'FINAL' } }) > 0;
      const current = await tx.payrollDraftRevision.findFirst({ where: { periodKey: input.period }, orderBy: { revision: 'desc' } });
      const priorRequest = await tx.payrollDraftRevision.findUnique({ where: { periodKey_requestId: { periodKey: input.period, requestId: input.requestId } } });
      if (priorRequest) {
        if (priorRequest.createdByUserId !== actor || priorRequest.revision !== input.revision + 1
          || payrollDraftFingerprint(priorRequest.payload) !== payrollDraftFingerprint(input.payload)) throw new PayrollDraftConflict('REQUEST_REUSED');
        // A lost response may be retried. Return latest state, never report an old write as current.
        return { periodKey: input.period, revision: current!.revision, savedAt: current!.createdAt.toISOString(), payload: validatePayrollDraft(current!.payload), locked };
      }
      if (locked) throw new PayrollDraftConflict('PERIOD_LOCKED');
      if ((current?.revision ?? 0) !== input.revision) throw new PayrollDraftConflict('REVISION_CONFLICT');
      const saved = await tx.payrollDraftRevision.create({ data: {
        periodKey: input.period, revision: input.revision + 1, requestId: input.requestId,
        payload: input.payload as unknown as Prisma.InputJsonValue, createdByUserId: actor,
      } });
      return { periodKey: input.period, revision: saved.revision, savedAt: saved.createdAt.toISOString(), payload: validatePayrollDraft(saved.payload), locked: false };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new PayrollDraftConflict('REVISION_CONFLICT');
    throw error;
  }
}
