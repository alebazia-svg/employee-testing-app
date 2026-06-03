import { prisma } from '@/lib/prisma';
import { parseExtendedVgp } from '@/lib/analytics/extended-vgp';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function asString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file');
  const period = asString(formData.get('period'));

  if (!period) {
    return Response.json({ error: 'Период обязателен.' }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: 'Загрузите файл расширенного ВВП.' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const parsed = parseExtendedVgp(buffer);

  if (!parsed.rows.length) {
    return Response.json({
      error: 'Не удалось распознать строки расширенного ВВП.',
      warnings: parsed.warnings,
      sheetName: parsed.sheetName,
    }, { status: 400 });
  }

  const report = await prisma.salesAnalyticsReport.create({
    data: {
      period,
      sourceReportType: 'extended_vgp',
      fileName: file.name,
      rowsCount: parsed.rows.length,
      rows: {
        create: parsed.rows.map((row) => ({
          sourceReportType: row.sourceReportType,
          employeeName: row.employeeName,
          department: row.department,
          location: row.location,
          client: row.client,
          category: row.category,
          nomenclatureType: row.nomenclatureType,
          itemName: row.itemName,
          article: row.article,
          quantity: row.quantity,
          revenue: row.revenue,
          cost: row.cost,
          grossProfit: row.grossProfit,
          marginPercent: row.marginPercent,
          markupPercent: row.markupPercent,
          documentName: row.documentName,
          documentType: row.documentType,
          documentDate: row.documentDate,
          unitRevenue: row.unitRevenue,
          unitCost: row.unitCost,
          unitGrossProfit: row.unitGrossProfit,
          isCredit: row.isCredit,
          isReturn: row.isReturn,
          isRealReturn: row.isRealReturn,
          isNegative: row.isNegative,
          problemFlags: row.problemFlags as Prisma.InputJsonValue,
          checkReason: row.checkReason,
        })),
      },
    },
    select: {
      id: true,
      fileName: true,
      period: true,
      rowsCount: true,
      uploadedAt: true,
    },
  });

  const revenue = parsed.rows.reduce((sum, row) => sum + row.revenue, 0);
  const grossProfit = parsed.rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const realReturnCount = parsed.rows.filter((row) => row.documentType === 'RETURN').length;
  const negativeCount = parsed.rows.filter((row) => row.isNegative).length;

  return Response.json({
    ...report,
    sourceReportType: 'extended_vgp',
    sheetName: parsed.sheetName,
    warnings: parsed.warnings,
    diagnostics: {
      revenue,
      grossProfit,
      realReturnCount,
      negativeCount,
    },
  }, { status: 201 });
}
