import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { title } = await req.json();
  const attestationId = Number(params.id);
  const count = await prisma.section.count({ where: { attestationId } });
  const section = await prisma.section.create({
    data: { title, attestationId, order: count },
  });

  return Response.json(section);
}
