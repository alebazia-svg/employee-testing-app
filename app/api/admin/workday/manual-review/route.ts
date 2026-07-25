import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const maxCommentLength = 1000;

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const taskId = Number(body.taskId);
  const checkId = String(body.checkId ?? '').trim();
  const checkLabel = String(body.checkLabel ?? '').trim();
  const decision = String(body.decision ?? '').trim();
  const comment = String(body.comment ?? '').trim();

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return Response.json({ error: 'Некорректная задача чек-листа.' }, { status: 400 });
  }
  if (!checkId || checkId.length > 120 || !checkLabel || checkLabel.length > 200) {
    return Response.json({ error: 'Некорректная автоматическая проверка.' }, { status: 400 });
  }
  if (!checkId.endsWith(`-${taskId}`)) {
    return Response.json({ error: 'Проверка не относится к выбранной задаче.' }, { status: 400 });
  }
  if (decision !== 'confirmed_ok' && decision !== 'confirmed_issue') {
    return Response.json({ error: 'Выберите результат ручной проверки.' }, { status: 400 });
  }
  if (!comment) {
    return Response.json({ error: 'Комментарий обязателен.' }, { status: 400 });
  }
  if (comment.length > maxCommentLength) {
    return Response.json({ error: `Комментарий должен быть не длиннее ${maxCommentLength} символов.` }, { status: 400 });
  }

  const task = await prisma.shiftControlTask.findUnique({
    where: { id: taskId },
    select: { id: true },
  });
  if (!task) {
    return Response.json({ error: 'Задача чек-листа не найдена.' }, { status: 404 });
  }

  const review = await prisma.shiftControlManualReview.create({
    data: {
      taskId,
      checkId,
      checkLabel,
      decision,
      comment,
      reviewedById: admin.id,
    },
    include: {
      reviewedBy: {
        select: {
          id: true,
          name: true,
          login: true,
        },
      },
    },
  });

  return Response.json({
    review: {
      id: review.id,
      taskId: review.taskId,
      checkId: review.checkId,
      checkLabel: review.checkLabel,
      decision: review.decision,
      comment: review.comment,
      reviewedAt: review.reviewedAt.toISOString(),
      reviewedBy: review.reviewedBy,
    },
  });
}
