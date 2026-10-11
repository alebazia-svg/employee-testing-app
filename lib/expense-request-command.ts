import type { ExpenseBreakdownValue } from './expense-request-breakdown';

export type NativeExpenseValue = ExpenseBreakdownValue & { xml: string };
export type ExpenseField = { scope: 'header' | 'line'; name: string; label: string; types: { type: string; kind: 'scalar' | 'reference' }[] };
export type ExpenseChange = { scope: 'header' | 'line'; line_number: number; field: string; type: string; xml: string };
export type ExpenseCommand = { command_id: string; version_token: string; action: 'save' | 'approve' | 'mark_payable'; changes: ExpenseChange[] };
export type NativeExpenseState = {
  document: { ref: string; number: string; date: string; amount: number; version_token: string; posted: boolean; deletion_mark: boolean;
    status: { key: string; name: string; ref: string }; [key: string]: unknown };
  header: Record<string, NativeExpenseValue>;
  lines: { line_number: number; fields: Record<string, NativeExpenseValue> }[];
  execution: Record<string, unknown>;
  linked_cash_expense_orders: Record<string, unknown>;
};
export type NativeExpenseCard = { ok: true; contract: 'expense-request-admin-v1'; state: NativeExpenseState; schema: ExpenseField[]; supported_actions?: ('save' | 'mark_payable')[];
  history: { source: 'portal_commands_only'; rows: { command_id: string; action: string; actor: string; at: string; before: NativeExpenseState; after: NativeExpenseState }[]; truncated: boolean } };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isExpenseRef(value: unknown): value is string { return typeof value === 'string' && uuid.test(value) && value !== '00000000-0000-0000-0000-000000000000'; }
export function expenseObject(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)); }
const headerFields = new Set(['НазначениеПлатежа', 'Комментарий', 'СтатьяДвиженияДенежныхСредств', 'Подразделение']);
const lineFields = new Set(['Партнер', 'Заказ', 'СтатьяРасходов', 'АналитикаРасходов', 'СтатьяДвиженияДенежныхСредств', 'Комментарий', 'Подразделение', 'НаправлениеДеятельности', 'АналитикаАктивовПассивов', 'ДоговорКредитаДепозита', 'ТипСуммыКредитаДепозита']);

export function parseExpenseCommand(value: unknown): ExpenseCommand {
  const input = expenseObject(value);
  if (!input || !exactKeys(input, ['command_id', 'version_token', 'action', 'changes'])
    || !isExpenseRef(input.command_id) || typeof input.version_token !== 'string' || !input.version_token.trim() || input.version_token.length > 200
    || !['save', 'approve', 'mark_payable'].includes(String(input.action)) || !Array.isArray(input.changes) || input.changes.length > 100
    || (input.action === 'save' && !input.changes.length)) throw new Error('Проверьте состав изменения заявки.');
  const seen = new Set<string>();
  const changes = input.changes.map(raw => {
    const change = expenseObject(raw);
    if (!change || !exactKeys(change, ['scope', 'line_number', 'field', 'type', 'xml']) || !['header', 'line'].includes(String(change.scope))
      || typeof change.line_number !== 'number' || !Number.isSafeInteger(change.line_number) || change.line_number < 0 || change.line_number > 200
      || (change.scope === 'header' ? change.line_number !== 0 : change.line_number === 0)
      || typeof change.field !== 'string' || !(change.scope === 'header' ? headerFields : lineFields).has(change.field)
      || typeof change.type !== 'string' || !change.type || change.type.length > 200 || typeof change.xml !== 'string' || change.xml.length > 1000) throw new Error('Это поле нельзя изменить из портала.');
    const key = `${change.scope}:${change.line_number}:${change.field}`;
    if (seen.has(key)) throw new Error('Поле передано дважды.');
    seen.add(key);
    return change as ExpenseChange;
  });
  return { command_id: input.command_id, version_token: input.version_token, action: input.action as ExpenseCommand['action'], changes };
}

export function validateExpenseCommandAgainstCard(command: ExpenseCommand, card: NativeExpenseCard) {
  if (command.action === 'approve') throw new Error('Промежуточное согласование больше не используется. Обновите карточку для утверждения к оплате.');
  if (!supportsExpenseAction(card, command.action)) throw new Error('Для утверждения к оплате требуется обновление модуля 1С.');
  if (command.version_token !== card.state.document.version_token) throw new Error('Заявка изменилась в 1С. Обновите её перед сохранением.');
  const allowed = card.state.document.status.key === 'not_approved' || (command.action === 'mark_payable' && card.state.document.status.key === 'approved');
  if (card.state.document.deletion_mark || !allowed) throw new Error('Текущий статус заявки не допускает это действие. Обновите её.');
  for (const change of command.changes) {
    const schema = card.schema.find(field => field.scope === change.scope && field.name === change.field);
    if (!schema?.types.some(t => t.type === change.type)) throw new Error('Тип значения не соответствует полю 1С.');
    const fields = change.scope === 'header' ? card.state.header : card.state.lines.find(line => line.line_number === change.line_number)?.fields;
    if (!fields || !Object.hasOwn(fields, change.field)) throw new Error('Строка или поле больше не существует в 1С.');
  }
}

export function supportsExpenseAction(card: NativeExpenseCard, action: 'save' | 'mark_payable') {
  // Older r4 supports saving but can only set the intermediate approval status.
  return (card.supported_actions ?? ['save']).includes(action);
}

function validCells(value: unknown): value is Record<string, NativeExpenseValue> {
  const fields = expenseObject(value);
  return !!fields && Object.keys(fields).length <= 100 && Object.entries(fields).every(([key, raw]) => {
    const cell = expenseObject(raw);
    return !['__proto__', 'constructor', 'prototype'].includes(key) && !!cell && typeof cell.type === 'string'
      && typeof cell.filled === 'boolean' && typeof cell.name === 'string' && typeof cell.ref === 'string' && typeof cell.xml === 'string'
      && (cell.value === null || typeof cell.value === 'string' || typeof cell.value === 'boolean' || (typeof cell.value === 'number' && Number.isFinite(cell.value)));
  });
}
export function readNativeExpenseState(value: unknown, ref: string): NativeExpenseState {
  const state = expenseObject(value), doc = expenseObject(state?.document), status = expenseObject(doc?.status);
  if (!state || !doc || doc.ref !== ref || typeof doc.version_token !== 'string' || !doc.version_token
    || typeof doc.amount !== 'number' || !Number.isFinite(doc.amount) || doc.amount < 0 || typeof doc.posted !== 'boolean' || typeof doc.deletion_mark !== 'boolean'
    || typeof doc.number !== 'string' || typeof doc.date !== 'string' || !status || typeof status.name !== 'string'
    || !['not_approved', 'approved', 'payable', 'rejected', 'unknown'].includes(String(status.key)) || !validCells(state.header)
    || !Array.isArray(state.lines) || state.lines.length > 200 || !expenseObject(state.execution) || !expenseObject(state.linked_cash_expense_orders)) throw new Error('1С вернула неполные сведения о заявке.');
  const seen = new Set<number>();
  for (const row of state.lines) {
    const line = expenseObject(row);
    if (!line || typeof line.line_number !== 'number' || !Number.isSafeInteger(line.line_number) || line.line_number < 1 || seen.has(line.line_number) || !validCells(line.fields)) throw new Error('1С вернула неполную расшифровку.');
    seen.add(line.line_number);
  }
  return state as NativeExpenseState;
}

export function readNativeExpenseCard(value: unknown, ref: string): NativeExpenseCard {
  const card = expenseObject(value), history = expenseObject(card?.history);
  if (!card || card.ok !== true || card.contract !== 'expense-request-admin-v1' || !Array.isArray(card.schema) || card.schema.length > 100
    || !history || history.source !== 'portal_commands_only' || typeof history.truncated !== 'boolean' || !Array.isArray(history.rows) || history.rows.length > 200) throw new Error('В 1С ещё не доступна рабочая карточка заявки.');
  readNativeExpenseState(card.state, ref);
  if (card.supported_actions !== undefined && (!Array.isArray(card.supported_actions)
    || !card.supported_actions.every(action => ['save', 'mark_payable'].includes(String(action))))) throw new Error('Не удалось проверить доступные действия 1С.');
  const names = new Set<string>();
  for (const raw of card.schema) {
    const field = expenseObject(raw);
    if (!field || !['header', 'line'].includes(String(field.scope)) || typeof field.name !== 'string'
      || !(field.scope === 'header' ? headerFields : lineFields).has(field.name) || typeof field.label !== 'string'
      || !Array.isArray(field.types) || !field.types.length || !field.types.every(t => expenseObject(t) && typeof t.type === 'string' && ['scalar', 'reference'].includes(t.kind))) throw new Error('Не удалось проверить поля 1С.');
    const key = `${field.scope}:${field.name}`;
    if (names.has(key)) throw new Error('1С вернула повторяющееся поле.');
    names.add(key);
  }
  for (const raw of history.rows) {
    const row = expenseObject(raw);
    if (!row || !isExpenseRef(row.command_id) || !['save', 'approve', 'mark_payable'].includes(String(row.action)) || typeof row.actor !== 'string'
      || typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))) throw new Error('Не удалось проверить историю изменений.');
    readNativeExpenseState(row.before, ref); readNativeExpenseState(row.after, ref);
  }
  return card as NativeExpenseCard;
}
