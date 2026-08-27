import { getCurrentUser } from '@/lib/auth';
import { retryCashOperationInOneC } from '@/lib/cash-operation-one-c-retry';
import { prisma } from '@/lib/prisma';

const maxCommentLength = 1000;

function operationId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function appendControlNote(previous: string | null, note: string) {
  return [previous?.trim(), note.trim()].filter(Boolean).join('\n');
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const id = operationId(params.id);
  if (!id) return Response.json({ error: 'Некорректная операция.' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '').trim();
  const comment = String(body.comment ?? '').trim();
  if (comment.length > maxCommentLength) return Response.json({ error: 'Комментарий слишком длинный.' }, { status: 400 });

  if (action === 'take_manual') {
    const current = await prisma.cashOperation.findUnique({ where: { id }, select: { status: true, oneCError: true } });
    if (current?.status !== 'one_c_error') {
      return Response.json({ error: current?.status === 'retrying_1c' ? 'Операция сейчас повторно проводится автоматически.' : 'Операция уже изменила состояние.' }, { status: 409 });
    }
    const note = `Операцию взял в ручную администратор ${admin.name} (${new Date().toISOString()}). ${comment}`;
    const updated = await prisma.cashOperation.updateMany({
      where: { id, status: 'one_c_error' },
      data: {
        status: 'manual_in_progress',
        oneCError: appendControlNote(current.oneCError, note),
      },
    });
    if (updated.count !== 1) {
      const latest = await prisma.cashOperation.findUnique({ where: { id }, select: { status: true } });
      return Response.json({ error: latest?.status === 'retrying_1c' ? 'Операция сейчас повторно проводится автоматически.' : 'Операция уже изменила состояние.' }, { status: 409 });
    }
    return Response.json({ ok: true, status: 'manual_in_progress' });
  }

  if (action === 'release_automatic') {
    const current = await prisma.cashOperation.findUnique({ where: { id }, select: { status: true, oneCError: true } });
    if (current?.status !== 'manual_in_progress') return Response.json({ error: 'Операция уже изменила состояние.' }, { status: 409 });
    const note = `Возвращено в автоматическую обработку администратором ${admin.name} (${new Date().toISOString()}). ${comment}`;
    const updated = await prisma.cashOperation.updateMany({
      where: { id, status: 'manual_in_progress' },
      data: {
        status: 'one_c_error',
        oneCError: appendControlNote(current.oneCError, note),
      },
    });
    if (updated.count !== 1) return Response.json({ error: 'Операция уже изменила состояние.' }, { status: 409 });
    return Response.json({ ok: true, status: 'one_c_error' });
  }

  if (action === 'retry_now') {
    const result = await retryCashOperationInOneC(prisma, id);
    if (!result.ok) {
      const labels: Record<string, string> = {
        manual_control: 'Операция взята в ручную и не будет проведена автоматически.',
        one_c_error: result.operation?.oneCError || '1С пока не провела документы.',
        not_found: 'Операция не найдена.',
        not_retryable: 'Операция сейчас недоступна для повторного проведения.',
        not_claimed: 'Операция уже обрабатывается.',
      };
      return Response.json({ error: labels[result.reason] ?? 'Не удалось повторить проведение.' }, { status: result.reason === 'one_c_error' ? 502 : 409 });
    }
    return Response.json({ ok: true, status: result.operation.status });
  }

  return Response.json({ error: 'Неизвестное действие.' }, { status: 400 });
}
