import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const payrollRunStatuses = ['DRAFT', 'CHECKED', 'FINAL'] as const;
type PayrollRunStatus = (typeof payrollRunStatuses)[number];

type RouteContext = {
  params: {
    id: string;
  };
};

function isPayrollRunStatus(value: unknown): value is PayrollRunStatus {
  return typeof value === 'string' && payrollRunStatuses.includes(value as PayrollRunStatus);
}

function isAllowedTransition(currentStatus: string, nextStatus: PayrollRunStatus) {
  if (currentStatus === nextStatus) return true;
  if (currentStatus === 'DRAFT' && (nextStatus === 'CHECKED' || nextStatus === 'FINAL')) return true;
  if (currentStatus === 'CHECKED' && nextStatus === 'FINAL') return true;
  return false;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'Invalid payroll run id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const nextStatus = body.status;

  if (!isPayrollRunStatus(nextStatus)) {
    return Response.json({ error: 'Invalid payroll run status.' }, { status: 400 });
  }

  const updatedRun = await prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findUnique({
      where: { id },
      include: { period: true },
    });

    if (!run) {
      return { error: 'NOT_FOUND' as const };
    }

    if (run.period.status === 'CLOSED') {
      return { error: 'PERIOD_CLOSED' as const };
    }

    if (!isAllowedTransition(run.status, nextStatus)) {
      return { error: 'INVALID_TRANSITION' as const };
    }

    if (nextStatus === 'FINAL') {
      const existingFinal = await tx.payrollRun.findFirst({
        where: {
          periodId: run.periodId,
          status: 'FINAL',
          id: { not: run.id },
        },
        select: { id: true, runNumber: true },
      });

      if (existingFinal) {
        return { error: 'FINAL_EXISTS' as const, existingFinal };
      }
    }

    return tx.payrollRun.update({
      where: { id },
      data: {
        status: nextStatus,
        checkedAt: nextStatus === 'CHECKED' || nextStatus === 'FINAL' ? new Date() : run.checkedAt,
      },
      include: { period: true },
    });
  });

  if ('error' in updatedRun) {
    if (updatedRun.error === 'NOT_FOUND') return Response.json({ error: 'Payroll run not found.' }, { status: 404 });
    if (updatedRun.error === 'PERIOD_CLOSED') return Response.json({ error: 'Период закрыт' }, { status: 409 });
    if (updatedRun.error === 'INVALID_TRANSITION') return Response.json({ error: 'Недопустимый переход статуса' }, { status: 409 });
    if (updatedRun.error === 'FINAL_EXISTS') {
      return Response.json({ error: 'Финальный расчёт за этот период уже существует', existingFinal: updatedRun.existingFinal }, { status: 409 });
    }
  }

  return Response.json(updatedRun);
}
