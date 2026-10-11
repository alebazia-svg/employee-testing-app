import { requireAdminApi } from '@/lib/admin-api-auth';
import { deliveryCreateEnabled } from '@/lib/procurement-delivery-create-source';
import { deliveryCreationState, actDeliveryCreation } from '@/lib/procurement-delivery-create';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  if (!deliveryCreateEnabled()) return Response.json({ enabled: false }, { headers });
  try { return Response.json({ enabled: true, ...await deliveryCreationState() }, { headers }); }
  catch { return Response.json({ error: 'Не удалось проверить создание заявки.' }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  if (!deliveryCreateEnabled()) return Response.json({ error: 'Создание заявок через портал ещё не включено.' }, { status: 403, headers });
  try { const origin = new URL(request.headers.get('origin') || ''); if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== (request.headers.get('host') || new URL(request.url).host)) throw Error(); }
  catch { return Response.json({ error: 'Обновите страницу.' }, { status: 403, headers }); }
  try {
    const body = await request.text(); if (body.length > 2048) throw Error('INPUT');
    const input = JSON.parse(body);
    if (!['preview', 'confirm', 'recover'].includes(input.action) || typeof input.reminderId !== 'string') throw Error('INPUT');
    return Response.json({ enabled: true, reminderId: input.reminderId, ...await actDeliveryCreation(input, access.user.id) }, { headers });
  } catch (error) {
    const messages: Record<string, string> = { CASHBOX_SHIFT_UNAVAILABLE: 'Не удалось подтвердить сотрудника и смену выбранной кассы. Обновите данные или проверьте привязку.', CASHBOX_SHIFT_CHANGED: 'Статус смены или сотрудник кассы изменились. Заявка не отправлена на создание. Проверьте выбранную кассу заново.', EXISTING_OR_UNVERIFIED_REQUEST: 'Заявка уже связана с 1С либо её отсутствие пока не подтверждено. Обновите данные.', CREATION_COMMAND_NOT_INSTALLED: 'В 1С ещё не установлена совместимая команда создания заявки.', CREATION_BASE_MISMATCH: 'Подключена другая база 1С. Создание заявки не отправлено.', CASHBOX_REVIEW_REQUIRED: 'Остатки или заявки изменились. Обновите кассы и проверьте неясные обязательства.', REQUEST_CHANGED: 'Запрос сотрудника изменился. Обновите страницу.', REPORT_DATE_REQUIRED: 'Укажите дату, до которой нужно отчитаться.', insufficient_cash: 'В выбранной кассе больше не хватает свободного остатка.', existing_accountable_request: 'В 1С уже есть незавершённая подотчётная заявка. Проверьте её.', selected_cashbox_obligations_invalid: 'По выбранной кассе не удалось подтвердить обязательства. Выберите другую кассу или проверьте данные в 1С.', unallocated_obligations: 'В 1С установлена предыдущая версия проверки кассы. Требуется обновление расширения.', accountable_cashflow_article_missing: 'В 1С не настроена статья ДДС для выдачи под отчёт.', report_date_before_payment: 'Дата отчёта не может быть раньше даты выдачи.', preview_expired: 'Предпросмотр устарел. Проверьте результат и подготовьте заявку заново.' };
    return Response.json({ error: messages[error instanceof Error ? error.message : ''] || 'Операция не подтверждена. Проверьте результат; новую заявку пока не создавайте.' }, { status: 409, headers });
  }
}
