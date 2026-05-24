import { getCurrentUser } from '@/lib/auth';
import { calculateResult } from '@/lib/attestation';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const attestationId = Number(params.id);
  const existingResult = await prisma.result.findFirst({ where: { userId: user.id, attestationId } });

  if (existingResult) {
    return Response.json({ error: 'Аттестация уже пройдена' }, { status: 403 });
  }

  const { answers } = await req.json();
  const attestation = await prisma.attestation.findUnique({
    where: { id: attestationId },
    include: {
      sections: {
        include: {
          questions: { include: { section: true } },
        },
      },
    },
  });

  if (!attestation) return Response.json({ error: 'Аттестация не найдена' }, { status: 404 });

  const questions = attestation.sections.flatMap((section) => section.questions);
  const calculated = calculateResult(questions, answers ?? {});
  const status = calculated.percent >= attestation.passingScore ? 'Сдал' : 'Не сдал';

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.result.create({
      data: {
        userId: user.id,
        attestationId,
        percent: calculated.percent,
        status,
        correctCount: calculated.correctCount,
        totalQuestions: calculated.totalQuestions,
        mistakes: calculated.mistakes,
        details: JSON.stringify(calculated.details),
      },
    });

    await tx.attemptProgress.deleteMany({ where: { userId: user.id, attestationId } });

    return created;
  });

  const sectionStatsMap = calculated.details.reduce<Record<string, { sectionTitle: string; correct: number; total: number }>>((acc, detail) => {
    acc[detail.sectionTitle] = acc[detail.sectionTitle] ?? { sectionTitle: detail.sectionTitle, correct: 0, total: 0 };
    acc[detail.sectionTitle].total++;
    if (detail.isCorrect) acc[detail.sectionTitle].correct++;
    return acc;
  }, {});
  const sectionStats = Object.values(sectionStatsMap).map((item) => ({
    ...item,
    percent: item.total ? Math.round((item.correct * 100) / item.total) : 0,
  }));

  return Response.json({ result, sectionStats });
}
