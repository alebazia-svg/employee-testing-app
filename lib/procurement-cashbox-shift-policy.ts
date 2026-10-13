export type CashboxShift = {
  state: 'active' | 'not_started' | 'completed' | 'unknown' | 'shared';
  employee: string;
  checkedAt: string;
  version: string;
};
export function cashboxShiftLabel(shift?: CashboxShift) {
  if (shift?.state === 'shared') return 'Общая касса · ручной выбор';
  return shift?.state === 'active' ? 'На смене' : shift?.state === 'not_started' ? 'Смена не начата' : shift?.state === 'completed' ? 'Смена завершена' : 'Смена не подтверждена';
}
export function cashboxShiftWarning(shift?: CashboxShift) {
  if (shift?.state === 'shared') return 'После создания заявки поручение получат менеджеры розницы на смене. Выдачу оформляет один сотрудник.';
  if (shift?.state === 'active') return '';
  if (!shift || shift.state === 'unknown') return 'Не удалось подтвердить сотрудника и его смену. Обновите данные или проверьте привязку кассы.';
  return `${shift.employee}: ${shift.state === 'completed' ? 'смена завершена' : 'смена не начата'}. Поручение появится после начала смены. Для выдачи сейчас выберите другую кассу.`;
}
