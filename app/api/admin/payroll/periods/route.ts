import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const periods = await prisma.payrollPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
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
          sourceSummary: true,
          createdAt: true,
        },
      },
    },
  });

  return Response.json(periods);
}
