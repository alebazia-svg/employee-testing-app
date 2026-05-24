import { getCurrentUser } from '@/lib/auth';
import { parseOptions } from '@/lib/attestation';
import { prisma } from '@/lib/prisma';

function sectionStatsFromDetails(details: string) {
  const parsed = JSON.parse(details) as { sectionTitle: string; isCorrect: boolean }[];
  const grouped = parsed.reduce<Record<string, { sectionTitle: string; correct: number; total: number }>>((acc, detail) => {
    acc[detail.sectionTitle] = acc[detail.sectionTitle] ?? { sectionTitle: detail.sectionTitle, correct: 0, total: 0 };
    acc[detail.sectionTitle].total++;
    if (detail.isCorrect) acc[detail.sectionTitle].correct++;
    return acc;
  }, {});

  return Object.values(grouped).map((item) => ({
    ...item,
    percent: item.total ? Math.round((item.correct * 100) / item.total) : 0,
  }));
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const attestationId = Number(params.id);
  const result = await prisma.result.findFirst({ where: { userId: user.id, attestationId }, orderBy: { date: 'desc' } });

  if (result) {
    return Response.json({ completed: true, result, sectionStats: sectionStatsFromDetails(result.details) });
  }

  const progress = await prisma.attemptProgress.findUnique({
    where: { userId_attestationId: { userId: user.id, attestationId } },
  });

  if (!progress) return Response.json({ error: 'Прогресс не найден' }, { status: 404 });

  const order = JSON.parse(progress.questionOrder) as number[];
  const questions = await prisma.question.findMany({
    where: { id: { in: order } },
    include: { section: true },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));

  return Response.json({
    completed: false,
    progress,
    answers: JSON.parse(progress.answers),
    questions: order
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((question) => ({
        id: question!.id,
        text: question!.text,
        options: parseOptions(question!.options),
        sectionTitle: question!.section.title,
        sectionId: question!.section.id,
      })),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const progress = await prisma.attemptProgress.update({
    where: { userId_attestationId: { userId: user.id, attestationId: Number(params.id) } },
    data: {
      answers: JSON.stringify(body.answers ?? {}),
      currentIndex: Number(body.currentIndex ?? 0),
    },
  });

  return Response.json(progress);
}
