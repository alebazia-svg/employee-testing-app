import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decideWorkdayCloseException } from '@/lib/workday-close-decision';

const decisions = new Set(['approved', 'rejected']);

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getCurrentUser();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await req.json().catch(() => ({}));
  const status = typeof payload.status === 'string' ? payload.status : '';
  const decisionComment = String(payload.decisionComment ?? '').replace(/\s+/g, ' ').trim();
  if (!decisions.has(status)) return Response.json({ error: 'Выберите решение' }, { status: 400 });
  if (status === 'rejected' && !decisionComment) return Response.json({ error: 'Коротко укажите причину отказа' }, { status: 400 });
  if (decisionComment.length > 1000) return Response.json({ error: 'Комментарий должен быть не длиннее 1000 символов' }, { status: 400 });

  const result = await decideWorkdayCloseException(prisma, {
    requestId: params.id, adminId: admin.id,
    status: status as 'approved' | 'rejected', decisionComment,
  });
  if (!result) return Response.json({ error: 'Запрос не найден' }, { status: 404 });
  return Response.json(result);
}
