import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type PayrollRunPayload = {
  period?: {
    year?: unknown;
    month?: unknown;
  };
  totals?: Record<string, unknown>;
  sourceSummary?: unknown;
  sourceFiles?: Array<Record<string, unknown>>;
  manualInputs?: Array<Record<string, unknown>>;
  employeeResults?: Array<Record<string, unknown> & { calculationDetails?: Array<Record<string, unknown>> }>;
};

function asNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function buildPeriodKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  const payload = (await req.json()) as PayrollRunPayload;
  const year = asNumber(payload.period?.year);
  const month = asNumber(payload.period?.month, -1);

  if (!year || month < 0 || month > 11) {
    return Response.json({ error: 'Invalid payroll period.' }, { status: 400 });
  }

  if (!payload.employeeResults?.length) {
    return Response.json({ error: 'Payroll run has no employee results.' }, { status: 400 });
  }

  const employeeResults = payload.employeeResults;
  const user = await getCurrentUser();
  const periodKey = buildPeriodKey(year, month);
  const totals = payload.totals ?? {};

  try {
  const createdRun = await prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.upsert({
      where: { periodKey },
      update: {},
      create: {
        year,
        month,
        periodKey,
      },
    });

    if (period.status === 'CLOSED') {
      throw new Error('PAYROLL_PERIOD_CLOSED');
    }

    const lastRun = await tx.payrollRun.findFirst({
      where: { periodId: period.id },
      orderBy: { runNumber: 'desc' },
      select: { runNumber: true },
    });

    return tx.payrollRun.create({
      data: {
        periodId: period.id,
        runNumber: (lastRun?.runNumber ?? 0) + 1,
        status: 'DRAFT',
        employeeCount: asNumber(totals.employeeCount),
        reviewCount: asNumber(totals.reviewCount),
        grossPay: asNumber(totals.grossPay),
        netPay: asNumber(totals.netPay),
        advance: asNumber(totals.advance),
        deductions: asNumber(totals.deductions),
        dayPay: asNumber(totals.dayPay),
        salesBonus: asNumber(totals.salesBonus),
        disciplineBonus: asNumber(totals.disciplineBonus),
        sourceSummary: asJson(payload.sourceSummary),
        createdByUserId: user?.id ?? null,
        sourceFiles: {
          create: (payload.sourceFiles ?? []).map((file) => ({
            type: asString(file.type, 'unknown'),
            originalName: asString(file.originalName),
            extension: asString(file.extension),
            mimeType: asString(file.mimeType) || null,
            sizeBytes: asNullableNumber(file.sizeBytes),
            sha256: asString(file.sha256) || null,
            selectedSheet: asString(file.selectedSheet) || null,
            rowCount: asNullableNumber(file.rowCount),
            parsedRowCount: asNullableNumber(file.parsedRowCount),
            status: asString(file.status, 'UPLOADED'),
            warnings: asJson(file.warnings),
            metadata: asJson(file.metadata),
          })),
        },
        manualInputs: {
          create: (payload.manualInputs ?? []).map((input) => ({
            employeeName: asString(input.employeeName),
            inputType: asString(input.inputType, 'manual'),
            workedDays: asString(input.workedDays) || null,
            lateCount: asString(input.lateCount) || null,
            advance: asString(input.advance) || null,
            agentCreditCommission: asString(input.agentCreditCommission) || null,
            fixedBonus: asString(input.fixedBonus) || null,
            fixedDeduction: asString(input.fixedDeduction) || null,
            purchaseAdvance: asString(input.purchaseAdvance) || null,
            purchaseDeduction: asString(input.purchaseDeduction) || null,
            comment: asString(input.comment),
            source: asString(input.source) || null,
          })),
        },
        employeeResults: {
          create: employeeResults.map((row, index) => ({
            employeeName: asString(row.employeeName),
            userId: asNullableNumber(row.userId),
            department: asString(row.department),
            payrollDepartment: asString(row.payrollDepartment),
            position: asString(row.position),
            salaryType: asString(row.salaryType),
            salaryRule: asString(row.salaryRule),
            workedDays: asNullableNumber(row.workedDays),
            lateCount: asNullableNumber(row.lateCount),
            daysSource: asString(row.daysSource),
            dayRate: asNumber(row.dayRate),
            dayPay: asNumber(row.dayPay),
            revenue: asNumber(row.revenue),
            grossProfit: asNumber(row.grossProfit),
            creditBonus: asNumber(row.creditBonus),
            filmBonus: asNumber(row.filmBonus),
            plotterBonus: asNumber(row.plotterBonus),
            techBonus: asNumber(row.techBonus),
            accessoryBonus: asNumber(row.accessoryBonus),
            wholesaleBonus: asNumber(row.wholesaleBonus),
            salesBonus: asNumber(row.salesBonus),
            totalBonus: asNumber(row.totalBonus),
            disciplineBonus: asNumber(row.disciplineBonus),
            fixedSalary: asNumber(row.fixedSalary),
            fixedBonus: asNumber(row.fixedBonus),
            fixedDeduction: asNumber(row.fixedDeduction),
            purchaseBase: asNullableNumber(row.purchaseBase),
            purchasePercent: asNumber(row.purchasePercent),
            purchasePercentAmount: asNumber(row.purchasePercentAmount),
            purchaseTargetAdjustment: asNumber(row.purchaseTargetAdjustment),
            purchaseTargetSalary: asNumber(row.purchaseTargetSalary),
            agentCreditCommission: asNumber(row.agentCreditCommission),
            advance: asNumber(row.advance),
            grossPay: asNumber(row.grossPay),
            netPay: asNumber(row.netPay),
            status: asString(row.status, 'DRAFT'),
            reasons: asJson(row.reasons),
            comment: asString(row.comment),
            order: asNumber(row.order, index),
            calculationDetails: {
              create: (row.calculationDetails ?? []).map((detail, detailIndex) => ({
                component: asString(detail.component),
                base: asNullableNumber(detail.base),
                formula: asString(detail.formula),
                amount: asNumber(detail.amount),
                comment: asString(detail.comment),
                order: asNumber(detail.order, detailIndex),
              })),
            },
          })),
        },
      },
      include: {
        period: true,
        employeeResults: { select: { id: true } },
        sourceFiles: { select: { id: true } },
      },
    });
  });

  return Response.json(createdRun, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYROLL_PERIOD_CLOSED') {
      return Response.json({ error: 'Период закрыт' }, { status: 409 });
    }
    throw error;
  }
}
