import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { expenseObject, isExpenseRef, parseExpenseCommand, readNativeExpenseCard, readNativeExpenseState, type ExpenseCommand, type NativeExpenseCard, type NativeExpenseState } from './expense-request-command';

export class ExpenseNativeError extends Error {
  constructor(message: string, readonly uncertain = false, readonly status = 502) { super(message); }
}
type Transport = (params: { method: 'GET' | 'POST'; query?: URLSearchParams; body?: Record<string, unknown> }) => Promise<unknown>;

const messages: Record<string, string> = {
  field_readback_failed: '1С не подтвердила новое значение поля после пробной записи. Проверьте, подходит ли оно выбранной операции. Исправьте или отмените изменения.',
  version_conflict: 'Заявка изменилась в 1С. Обновите её перед сохранением.',
  request_not_pending: 'Статус заявки изменился. Обновите карточку.',
  native_approval_validation_failed: '1С не разрешила согласование. Проверьте обязательные поля.',
  native_payable_validation_failed: '1С не разрешила утверждение к оплате. Проверьте обязательные поля и право на утверждение.',
  obsolete_approval_action: 'Обновите карточку: требуется утверждение к оплате.',
  native_fill_validation_failed: '1С не разрешила сохранение. Проверьте обязательные поля.',
  preview_expired: 'Проверка изменений устарела. Обновите заявку.',
  test_base_only: 'Запись пока доступна только в тестовой базе 1С.',
  expense_base_not_allowed: 'База 1С не разрешена для команд заявок. Проверьте подключение.',
  command_identity_conflict: 'Идентификатор действия уже использован. Обновите заявку.',
  execution_data_incomplete: '1С не подтвердила сведения об исполнении. Повторите проверку позже.',
};

export const expenseNativeTransport: Transport = async ({ method, query, body }) => {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new ExpenseNativeError('Связь с 1С не настроена.', false, 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const confirming = body?.confirm === true;
  let commandSent = false;
  try {
    if (method === 'POST') {
      const response = await fetch(`${env.baseUrl}/version`, {
        cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
      });
      const version = expenseObject(await response.json().catch(() => null));
      const isolated = process.env.PORTAL_ISOLATED_DEMO === '1';
      const environment = isolated ? 'test' : 'production';
      const base = isolated ? 'trade83_ut11_Test' : 'Teleinvest_UT11';
      if (!response.ok || version?.environment !== environment || version?.base !== base) throw new ExpenseNativeError('Подключена другая база 1С. Запись не отправлена.', false, 503);
      const capabilities = expenseObject(version.expense_request_commands);
      if (!isolated && (capabilities?.contract !== 'expense-request-admin-v1' || !Array.isArray(capabilities.actions) || !capabilities.actions.includes(body?.action))) throw new ExpenseNativeError('В рабочей 1С ещё не установлен модуль команд заявок. Запись не отправлена.', false, 503);
    }
    // 1C preserves '+' in query parameters instead of treating it as a space.
    const encodedQuery = query?.toString().replace(/\+/g, '%20');
    commandSent = method === 'POST';
    const response = await fetch(`${env.baseUrl}/expense-request-admin${encodedQuery ? `?${encodedQuery}` : ''}`, {
      method, cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = expenseObject(await response.json().catch(() => null));
    if (!response.ok || payload?.ok !== true) {
      const raw = typeof payload?.error === 'string' ? payload.error : '';
      const code = Object.keys(messages).find(key => raw.includes(key));
      const details = Array.isArray(payload?.messages) ? payload.messages.filter(m => typeof m === 'string').slice(0, 10).join('\n').slice(0, 3000) : '';
      throw new ExpenseNativeError(details || (code ? messages[code] : response.status === 404 ? 'В 1С ещё не установлен модуль работы с заявками.' : '1С не подтвердила действие. Обновите карточку и проверьте состояние.'),
        payload?.committed === true || (confirming && (!payload || response.status >= 500)), response.status === 409 ? 409 : 502);
    }
    return payload;
  } catch (error) {
    if (error instanceof ExpenseNativeError) throw error;
    throw new ExpenseNativeError(confirming && commandSent ? 'Ответ на сохранение не получен. Проверьте результат в 1С перед следующим действием.' : 'Не удалось получить ответ от 1С. Изменение не подтверждено.', confirming && commandSent);
  } finally { clearTimeout(timer); }
};

export function createExpenseAdminClient(transport: Transport = expenseNativeTransport) {
  return {
    async card(ref: string): Promise<NativeExpenseCard> {
      if (!isExpenseRef(ref)) throw new ExpenseNativeError('Некорректная ссылка заявки.', false, 400);
      return readNativeExpenseCard(await transport({ method: 'GET', query: new URLSearchParams({ ref }) }), ref);
    },
    async preview(ref: string, command: ExpenseCommand, actor: string) {
      if (command.action === 'approve') throw new ExpenseNativeError('Обновите карточку для утверждения к оплате.', false, 409);
      if (!isExpenseRef(ref) || !actor.trim() || actor.length > 200) throw new ExpenseNativeError('Некорректные параметры действия.', false, 400);
      const plan = { ...parseExpenseCommand(command), request_ref: ref, actor };
      const result = expenseObject(await transport({ method: 'POST', body: { ...plan, confirm: false } }));
      if (result?.contract !== 'expense-request-admin-v1') throw new ExpenseNativeError('1С не подтвердила формат проверки.');
      if (result.committed === true && result.replayed === true) {
        const state = readNativeExpenseState(result.state, ref);
        if (result.verified === true && command.action === 'mark_payable' && state.document.status.key !== 'payable') throw new ExpenseNativeError('1С не подтвердила статус «К оплате». Обновите карточку.', true);
        return { kind: 'committed' as const, state, verified: result.verified === true };
      }
      if (result.committed !== false || result.transaction_rolled_back !== true || !isExpenseRef(result.preview_token)) throw new ExpenseNativeError('1С не подтвердила отмену пробной записи.');
      const after = readNativeExpenseState(result.proposed_after, ref);
      if (command.action === 'mark_payable' && after.document.status.key !== 'payable') throw new ExpenseNativeError('1С не подтвердила переход в статус «К оплате».');
      return { kind: 'preview' as const, token: result.preview_token, before: readNativeExpenseState(result.before, ref), after };
    },
    async confirm(ref: string, command: ExpenseCommand, actor: string, token: string): Promise<{ state: NativeExpenseState; verified: boolean }> {
      if (command.action === 'approve') throw new ExpenseNativeError('Обновите карточку для утверждения к оплате.', false, 409);
      if (!isExpenseRef(ref) || !isExpenseRef(token) || !actor.trim() || actor.length > 200) throw new ExpenseNativeError('Некорректное подтверждение.', false, 400);
      const result = expenseObject(await transport({ method: 'POST', body: { ...parseExpenseCommand(command), request_ref: ref, actor, confirm: true, preview_token: token } }));
      if (result?.contract !== 'expense-request-admin-v1' || result.committed !== true) throw new ExpenseNativeError('Результат записи не подтверждён. Проверьте заявку в 1С.', true);
      try {
        const state = readNativeExpenseState(result.state, ref);
        if (result.verified === true && command.action === 'mark_payable' && state.document.status.key !== 'payable') throw new Error('payable_not_confirmed');
        return { state, verified: result.verified === true };
      }
      catch { throw new ExpenseNativeError('Запись выполнена, но результат не удалось проверить. Обновите заявку.', true); }
    },
  };
}
