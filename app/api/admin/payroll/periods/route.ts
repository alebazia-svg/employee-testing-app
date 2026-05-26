import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const periods = await prisma.payrollPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
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

  return Response.json(periods);
}
