import type { NativeExpenseState, NativeExpenseValue } from './expense-request-command';

export function expenseOperationKind(state: NativeExpenseState) {
  const operation = namedExpenseValue(state.document.business_operation);
  if (state.document.is_accountable_issue === true || operation === 'Выдача ДС подотчетнику') return 'accountable';
  if (operation === 'Прочий расход ДС') return 'other';
  if (operation === 'Оплата поставщику' || operation === 'Возврат оплаты клиенту') return 'settlement';
  return 'unknown';
}
export function namedExpenseValue(value: unknown): string {
  return value && typeof value === 'object' && 'name' in value ? String(value.name || '') : '';
}
export function expenseRecipient(state: NativeExpenseState) {
  if (state.document.multiple_recipients === true) return 'Несколько получателей — состав в 1С';
  // A partner is not a substitute for the legal recipient/counterparty.
  return namedExpenseValue(expenseOperationKind(state) === 'accountable' ? state.document.accountable_person : state.document.counterparty);
}
export const expenseFormLabels: Record<string, string> = {
  СтатьяДвиженияДенежныхСредств: 'Статья движения денег', СтатьяРасходов: 'Статья расходов и активов',
  Подразделение: 'Подразделение расходов', Партнер: 'Партнёр', Заказ: 'Основание / заказ',
  АналитикаРасходов: 'Уточнение статьи расходов', АналитикаАктивовПассивов: 'Уточнение статьи активов и пассивов',
  НаправлениеДеятельности: 'Направление деятельности', Комментарий: 'Комментарий к расходу',
};
// These are operational review hints, not a copy of 1C's conditional posting
// validation. The native preview remains the authority for mandatory fields.
export function expenseReviewFields(state: NativeExpenseState) {
  const kind = expenseOperationKind(state);
  return ['СтатьяДвиженияДенежныхСредств', ...(kind === 'other' ? ['СтатьяРасходов', 'Подразделение'] : kind === 'settlement' ? ['Партнер', 'Заказ'] : [])];
}
export function expenseVisibleLineFields(state: NativeExpenseState, fields: Record<string, NativeExpenseValue>, editableNames: string[], showConditional = false) {
  const primary = expenseReviewFields(state).filter(key => Object.hasOwn(fields, key));
  const conditional = expenseOperationKind(state) === 'other'
    ? ['АналитикаРасходов', 'АналитикаАктивовПассивов', 'НаправлениеДеятельности'] : [];
  const rest = editableNames.filter(key => !primary.includes(key) && fields[key]
    && (fields[key].filled || showConditional && conditional.includes(key)));
  // Unknown operations keep their editable fields available; do not infer a
  // mandatory-field rule from a familiar-looking name or an empty sample.
  if (expenseOperationKind(state) === 'unknown') return [...new Set([...primary, ...editableNames.filter(key => fields[key])])];
  return [...primary, ...rest];
}
