import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { createExpenseAdminClient, expenseNativeTransport, ExpenseNativeError } from '@/lib/expense-request-admin-client';
import { expenseObject, parseExpenseCommand, validateExpenseCommandAgainstCard } from '@/lib/expense-request-command';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const client = createExpenseAdminClient();
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  if (error instanceof ExpenseNativeError) return Response.json({ error: error.message, uncertain: error.uncertain }, { status: error.status, headers });
  return Response.json({ error: 'Не удалось проверить данные заявки. Обновите карточку.' }, { status: 502, headers });
}

export async function GET(request: Request, context: Context) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const item = await prisma.expenseRequestAdminCase.findUnique({ where: { id: (await context.params).id }, select: { oneCRequestRef: true } });
  if (!item) return Response.json({ error: 'Заявка не найдена.' }, { status: 404, headers });
  try {
    const query = new URL(request.url).searchParams;
    if (query.get('mode') === 'choices') {
      const scope = query.get('scope'), field = query.get('field'), type = query.get('type'), search = query.get('q') || '';
      const card = await client.card(item.oneCRequestRef);
      if (!card.schema.some(col => col.scope === scope && col.name === field && col.types.some(t => t.type === type && t.kind === 'reference')) || search.length > 100) {
        return Response.json({ error: 'Неверное поле справочника.' }, { status: 400, headers });
      }
      const result = await expenseNativeTransport({ method: 'GET', query: new URLSearchParams({ mode: 'choices', scope: scope!, field: field!, type: type!, q: search }) });
      return Response.json(result, { headers });
    }
    return Response.json({ card: await client.card(item.oneCRequestRef), writesEnabled: process.env.EXPENSE_REQUEST_NATIVE_WRITES === '1' }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  try {
    const origin = new URL(request.headers.get('origin') || '');
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== (request.headers.get('host') || new URL(request.url).host)) throw new Error();
  } catch { return Response.json({ error: 'Обновите страницу перед сохранением.' }, { status: 403, headers }); }
  if (process.env.EXPENSE_REQUEST_NATIVE_WRITES !== '1') return Response.json({ error: 'Сохранение в 1С ещё не включено.' }, { status: 503, headers });
  let body: Record<string, unknown>;
  let command;
  try {
    if (Number(request.headers.get('content-length') || 0) > 65_536) throw new Error();
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 65_536) throw new Error();
    const input = expenseObject(JSON.parse(raw));
    if (!input || !['preview', 'confirm'].includes(String(input.stage)) || Object.keys(input).some(k => !['stage', 'command', 'previewToken'].includes(k))) throw new Error();
    body = input;
    command = parseExpenseCommand(body.command);
    if (command.action === 'approve') return Response.json({ error: 'Промежуточное согласование больше не используется. Обновите карточку для утверждения к оплате.' }, { status: 409, headers });
  } catch { return Response.json({ error: 'Проверьте состав изменений.' }, { status: 400, headers }); }
  const item = await prisma.expenseRequestAdminCase.findUnique({ where: { id: (await context.params).id }, select: { oneCRequestRef: true } });
  if (!item) return Response.json({ error: 'Заявка не найдена.' }, { status: 404, headers });
  // Identity is always derived from the authenticated administrator, never body input.
  const actor = `portal:${access.user.id} ${access.user.name}`.slice(0, 200);
  try {
    if (body.stage === 'preview') {
      const card = await client.card(item.oneCRequestRef);
      if (!card.history.rows.some(row => row.command_id === command.command_id)) {
        try { validateExpenseCommandAgainstCard(command, card); }
        catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Заявка изменилась.' }, { status: 409, headers }); }
      }
      return Response.json(await client.preview(item.oneCRequestRef, command, actor), { headers });
    }
    if (typeof body.previewToken !== 'string') return Response.json({ error: 'Сначала проверьте изменения.' }, { status: 400, headers });
    const result = await client.confirm(item.oneCRequestRef, command, actor, body.previewToken);
    // Successful writes are not fabricated in the portal cache. The existing
    // read-only synchronizer will import the independently read native status.
    return Response.json({ kind: 'committed', ...result }, { headers });
  } catch (error) { return failure(error); }
}
