import { prisma } from '@/lib/prisma';
import { parseOptions } from '@/lib/attestation';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const attestation = await prisma.attestation.findUnique({
    where: { id: Number(params.id) },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { questions: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!attestation) return Response.json({ error: 'Аттестация не найдена' }, { status: 404 });

  return Response.json({
    ...attestation,
    sections: attestation.sections.map((section) => ({
      ...section,
      questions: section.questions.map((question) => ({ ...question, options: parseOptions(question.options) })),
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const attestation = await prisma.attestation.update({
    where: { id: Number(params.id) },
    data: {
      title: body.title,
      passingScore: Number(body.passingScore),
      status: body.status,
      type: body.type,
    },
  });

  return Response.json(attestation);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.attestation.delete({ where: { id: Number(params.id) } });

  return Response.json({ ok: true });
}
