import { prisma } from '@/lib/prisma';
import { parseOptions } from '@/lib/attestation';

export async function PATCH(req: Request, { params }: { params: { questionId: string } }) {
  const body = await req.json();
  const question = await prisma.question.update({
    where: { id: Number(params.questionId) },
    data: {
      text: body.text,
      options: JSON.stringify(body.options),
      correctIndex: Number(body.correctIndex),
    },
  });

  return Response.json({ ...question, options: parseOptions(question.options) });
}

export async function DELETE(_: Request, { params }: { params: { questionId: string } }) {
  await prisma.question.delete({ where: { id: Number(params.questionId) } });

  return Response.json({ ok: true });
}
