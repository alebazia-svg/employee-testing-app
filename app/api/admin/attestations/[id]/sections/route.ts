import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { title } = await req.json();
  const attestationId = Number(params.id);
  const count = await prisma.section.count({ where: { attestationId } });
  const section = await prisma.section.create({
    data: { title, attestationId, order: count },
  });

  return Response.json(section);
}
