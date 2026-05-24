import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { sectionId: string } }) {
  const { title } = await req.json();
  const section = await prisma.section.update({
    where: { id: Number(params.sectionId) },
    data: { title },
  });

  return Response.json(section);
}

export async function DELETE(_: Request, { params }: { params: { sectionId: string } }) {
  await prisma.section.delete({ where: { id: Number(params.sectionId) } });

  return Response.json({ ok: true });
}
