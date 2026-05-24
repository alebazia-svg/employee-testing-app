import { prisma } from '@/lib/prisma';
import { parseOptions } from '@/lib/attestation';

export async function POST(req: Request, { params }: { params: { sectionId: string } }) {
  const body = await req.json();
  const sectionId = Number(params.sectionId);
  const count = await prisma.question.count({ where: { sectionId } });
  const question = await prisma.question.create({
    data: {
      sectionId,
      text: body.text,
      options: JSON.stringify(body.options),
      correctIndex: Number(body.correctIndex),
      order: count,
    },
  });

  return Response.json({ ...question, options: parseOptions(question.options) });
}
