import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, props: RouteContext) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'Invalid payroll run id.' }, { status: 400 });
  }

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      period: true,
      sourceFiles: { orderBy: { uploadedAt: 'asc' } },
      manualInputs: { orderBy: [{ inputType: 'asc' }, { employeeName: 'asc' }] },
      employeeResults: {
        orderBy: { order: 'asc' },
        include: {
          calculationDetails: { orderBy: { order: 'asc' } },
          adjustments: { orderBy: { createdAt: 'asc' } },
        },
      },
      adjustments: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!run) {
    return Response.json({ error: 'Payroll run not found.' }, { status: 404 });
  }

  return Response.json(run);
}
