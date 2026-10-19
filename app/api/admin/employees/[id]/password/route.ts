import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { PasswordAccessError, passwordRequestAllowed, resetEmployeePassword } from '@/lib/password-access';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  if (!passwordRequestAllowed(request)) return Response.json({ error: 'Недопустимый запрос.' }, { status: 403 });
  const userId = Number((await props.params).id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return Response.json({ error: 'Некорректный сотрудник.' }, { status: 400 });
  let payload;
  try { payload = await request.json(); } catch { return Response.json({ error: 'Некорректный запрос.' }, { status: 400 }); }
  if (!Number.isSafeInteger(payload?.sessionVersion) || payload.sessionVersion < 0) return Response.json({ error: 'Обновите список сотрудников.' }, { status: 400 });
  try {
    const result = await resetEmployeePassword(prisma, userId, access.user.id, payload.sessionVersion);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } });
  } catch (error) {
    if (error instanceof PasswordAccessError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Не удалось завершить выдачу доступа. Обновите список сотрудников и проверьте состояние перед повторным сбросом.' }, { status: 503 });
  }
}
