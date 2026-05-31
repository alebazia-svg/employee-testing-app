import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'Invalid rule id.' }, { status: 400 });
  }

  const payload = await req.json();
  const data: { isActive?: boolean } = {};

  if (typeof payload.isActive === 'boolean') {
    data.isActive = payload.isActive;
  }

  if (!Object.keys(data).length) {
    return Response.json({ error: 'No supported fields to update.' }, { status: 400 });
  }

  const rule = await prisma.payrollClassificationRule.update({
    where: { id },
    data,
  });

  return Response.json(rule);
}
