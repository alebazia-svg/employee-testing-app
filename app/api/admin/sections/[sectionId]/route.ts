import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export async function PATCH(req: Request, props: { params: Promise<{ sectionId: string }> }) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { title } = await req.json();
  const section = await prisma.section.update({
    where: { id: Number(params.sectionId) },
    data: { title },
  });

  return Response.json(section);
}

export async function DELETE(_: Request, props: { params: Promise<{ sectionId: string }> }) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  await prisma.section.delete({ where: { id: Number(params.sectionId) } });

  return Response.json({ ok: true });
}
