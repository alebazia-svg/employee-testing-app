import { Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/admin-api-auth';
import {
  canReplacePayrollFinal,
  isAllowedPayrollRunTransition,
  isPayrollRunStatus,
} from '@/lib/payroll-run-status';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, props: RouteContext) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'Invalid payroll run id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const nextStatus = body.status;
  const replaceExistingFinal = body.replaceExistingFinal === true;

  if (!isPayrollRunStatus(nextStatus) || nextStatus === 'SUPERSEDED') {
    return Response.json({ error: 'Invalid payroll run status.' }, { status: 400 });
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({
        where: { id },
        include: { period: true },
      });

      if (!run) return { error: 'NOT_FOUND' as const };
      if (run.period.status === 'CLOSED') return { error: 'PERIOD_CLOSED' as const };
      if (!isAllowedPayrollRunTransition(run.status, nextStatus)) {
        return { error: 'INVALID_TRANSITION' as const };
      }

      const changedAt = new Date();
      let replacedFinal: { id: number; runNumber: number; netPay: number; createdAt: Date } | null = null;

      if (nextStatus === 'FINAL') {
        const existingFinal = await tx.payrollRun.findFirst({
          where: {
            periodId: run.periodId,
            status: 'FINAL',
            id: { not: run.id },
          },
          select: { id: true, runNumber: true, netPay: true, createdAt: true },
        });

        if (existingFinal && !replaceExistingFinal) {
          return { error: 'FINAL_EXISTS' as const, existingFinal };
        }

        if (existingFinal) {
          if (!canReplacePayrollFinal(run.status)) {
            return { error: 'INVALID_REPLACEMENT' as const };
          }

          await tx.payrollRun.update({
            where: { id: existingFinal.id },
            data: {
              status: 'SUPERSEDED',
              supersededAt: changedAt,
              supersededByUserId: access.user.id,
              supersededByRunId: run.id,
            },
          });
          replacedFinal = existingFinal;
        }
      }

      const updatedRun = await tx.payrollRun.update({
        where: { id },
        data: {
          status: nextStatus,
          checkedAt: nextStatus === 'CHECKED' || nextStatus === 'FINAL' ? changedAt : run.checkedAt,
          finalizedAt: nextStatus === 'FINAL' ? run.finalizedAt ?? changedAt : run.finalizedAt,
          finalizedByUserId: nextStatus === 'FINAL' ? run.finalizedByUserId ?? access.user.id : run.finalizedByUserId,
        },
        include: { period: true },
      });

      return { updatedRun, replacedFinal };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ('error' in outcome) {
      if (outcome.error === 'NOT_FOUND') return Response.json({ error: 'Payroll run not found.' }, { status: 404 });
      if (outcome.error === 'PERIOD_CLOSED') return Response.json({ error: 'Период закрыт' }, { status: 409 });
      if (outcome.error === 'INVALID_TRANSITION') return Response.json({ error: 'Недопустимый переход статуса' }, { status: 409 });
      if (outcome.error === 'INVALID_REPLACEMENT') return Response.json({ error: 'Этот расчёт нельзя назначить вместо финального' }, { status: 409 });
      if (outcome.error === 'FINAL_EXISTS') {
        return Response.json({ error: 'Финальный расчёт за этот период уже существует', existingFinal: outcome.existingFinal }, { status: 409 });
      }
    }

    return Response.json({ ...outcome.updatedRun, replacedFinal: outcome.replacedFinal });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      return Response.json({ error: 'Финальный расчёт изменился. Обновите список и повторите действие.' }, { status: 409 });
    }
    throw error;
  }
}
