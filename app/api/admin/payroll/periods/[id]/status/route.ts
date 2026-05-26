import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const payrollPeriodStatuses = ['OPEN', 'CLOSED'] as const;
type PayrollPeriodStatus = (typeof payrollPeriodStatuses)[number];

type RouteContext = {
  params: {
    id: string;
  };
};

function isPayrollPeriodStatus(value: unknown): value is PayrollPeriodStatus {
  return typeof value === 'string' && payrollPeriodStatuses.includes(value as PayrollPeriodStatus);
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'Invalid payroll period id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const nextStatus = body.status;

  if (!isPayrollPeriodStatus(nextStatus)) {
    return Response.json({ error: 'Invalid payroll period status.' }, { status: 400 });
  }

  const updatedPeriod = await prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.findUnique({
      where: { id },
      include: {
        runs: {
          where: { status: 'FINAL' },
          select: { id: true },
        },
      },
    });

    if (!period) {
      return { error: 'NOT_FOUND' as const };
    }

    if (nextStatus === 'CLOSED' && period.runs.length === 0) {
      return { error: 'NO_FINAL_RUN' as const };
    }

    return tx.payrollPeriod.update({
      where: { id },
      data: {
        status: nextStatus,
        closedAt: nextStatus === 'CLOSED' ? new Date() : null,
      },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            runNumber: true,
            status: true,
            employeeCount: true,
            reviewCount: true,
            grossPay: true,
            netPay: true,
            createdAt: true,
          },
        },
      },
    });
  });

  if ('error' in updatedPeriod) {
    if (updatedPeriod.error === 'NOT_FOUND') return Response.json({ error: 'Payroll period not found.' }, { status: 404 });
    if (updatedPeriod.error === 'NO_FINAL_RUN') return Response.json({ error: 'Нельзя закрыть период без финального расчёта' }, { status: 409 });
  }

  return Response.json(updatedPeriod);
}
