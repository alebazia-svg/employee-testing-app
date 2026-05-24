import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shuffleIds } from '@/lib/attestation';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const attestationId = Number(params.id);
  const existingResult = await prisma.result.findFirst({ where: { userId: user.id, attestationId } });

  if (existingResult) {
    return Response.json({ error: 'Аттестация уже пройдена' }, { status: 403 });
  }

  const attestation = await prisma.attestation.findFirst({
    where: { id: attestationId, status: 'ACTIVE' },
    include: { sections: { include: { questions: true }, orderBy: { order: 'asc' } } },
  });

  if (!attestation) return Response.json({ error: 'Аттестация не найдена' }, { status: 404 });

  const questionIds = attestation.sections.flatMap((section) => shuffleIds(section.questions.map((question) => question.id)));
  const progress = await prisma.attemptProgress.upsert({
    where: { userId_attestationId: { userId: user.id, attestationId } },
    update: {},
    create: {
      userId: user.id,
      attestationId,
      questionOrder: JSON.stringify(shuffleIds(questionIds)),
      answers: '{}',
      currentIndex: 0,
    },
  });

  return Response.json(progress);
}
