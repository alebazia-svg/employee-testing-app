import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const report = await prisma.salesAnalyticsReport.findFirst({
    where: { sourceReportType: 'extended_vgp' },
    orderBy: { uploadedAt: 'desc' },
  });

  if (!report) {
    return Response.json(null);
  }

  const [totals, documentTypeGroups, negativeDocumentTypeGroups, documentNameCount, examples] = await Promise.all([
    prisma.salesAnalyticsRow.aggregate({
      where: { reportId: report.id },
      _count: { _all: true },
      _sum: { revenue: true, grossProfit: true },
    }),
    prisma.salesAnalyticsRow.groupBy({
      by: ['documentType'],
      where: { reportId: report.id },
      _count: { _all: true },
      _sum: { revenue: true, grossProfit: true },
    }),
    prisma.salesAnalyticsRow.groupBy({
      by: ['documentType'],
      where: { reportId: report.id, isNegative: true },
      _count: { _all: true },
    }),
    prisma.salesAnalyticsRow.count({
      where: { reportId: report.id, documentName: { not: null } },
    }),
    prisma.salesAnalyticsRow.findMany({
      where: {
        reportId: report.id,
        OR: [
          { documentName: { not: null } },
          { documentType: { in: ['UNKNOWN', 'RETURN'] } },
          { isNegative: true },
        ],
      },
      orderBy: [{ documentType: 'asc' }, { id: 'asc' }],
      take: 20,
      select: {
        id: true,
        documentDate: true,
        documentType: true,
        documentName: true,
        employeeName: true,
        client: true,
        nomenclatureType: true,
        itemName: true,
        article: true,
        quantity: true,
        revenue: true,
        cost: true,
        grossProfit: true,
      },
    }),
  ]);

  const negativeCounts = new Map(negativeDocumentTypeGroups.map((item) => [item.documentType, item._count._all]));
  const documentTypes = ['SALE', 'RETAIL_SALE', 'RETURN', 'UNKNOWN'].map((documentType) => {
    const group = documentTypeGroups.find((item) => item.documentType === documentType);
    return {
      documentType,
      rowsCount: group?._count._all ?? 0,
      revenue: group?._sum.revenue ?? 0,
      grossProfit: group?._sum.grossProfit ?? 0,
      negativeCount: negativeCounts.get(documentType) ?? 0,
    };
  });

  const realReturnCount = documentTypes.find((item) => item.documentType === 'RETURN')?.rowsCount ?? 0;
  const negativeCount = negativeDocumentTypeGroups.reduce((sum, item) => sum + item._count._all, 0);
  const documentNameMissingCount = Math.max((totals._count._all ?? 0) - documentNameCount, 0);

  return Response.json({
    id: report.id,
    period: report.period,
    sourceReportType: report.sourceReportType,
    fileName: report.fileName,
    uploadedAt: report.uploadedAt,
    rowsCount: report.rowsCount,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    diagnostics: {
      revenue: totals._sum.revenue ?? 0,
      grossProfit: totals._sum.grossProfit ?? 0,
      realReturnCount,
      negativeCount,
      documentNameCount,
      documentNameMissingCount,
      documentTypes,
      examples,
    },
  });
}
