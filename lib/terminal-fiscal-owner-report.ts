export type OwnerFiscalReportInput = {
  day: string;
  openCount: number;
  openAmountKopecks: number;
  resolvedLateCount: number;
  resolvedLateAmountKopecks: number;
  linkedLateCount: number;
  confirmed: number;
  coveredByDayTotal: number;
  itemReview: number;
  pending: number;
  unavailable: number;
  mismatches: number;
  total: number;
  sourcesComplete: boolean;
};

function rubles(kopecks: number) {
  return (kopecks / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function terminalFiscalOwnerMessage(input: OwnerFiscalReportInput) {
  const financialProblems = input.openCount + input.mismatches;
  const ok = financialProblems === 0 && input.sourcesComplete;
  const lines = [
    `${ok ? '✅' : '⚠️'} Контроль оплат по терминалу за ${input.day}`,
    ok ? 'Итог: денежного расхождения не найдено.' : 'Итог: есть операции, которые требуют проверки.',
    `Операций банка: ${input.total}`,
    `• подтверждены отдельными чеками: ${input.confirmed}`,
    `• подтверждены общей суммой за день: ${input.coveredByDayTotal}`,
    input.openCount > 0
      ? `• без подтверждённого чека 1С: ${input.openCount} на ${rubles(input.openAmountKopecks)} ₽`
      : '• без подтверждённого чека 1С: 0',
    input.itemReview > 0 ? `• проверить только состав товаров: ${input.itemReview} (на сумму не влияет)` : '',
    input.pending > 0 ? `• ещё ожидают данные: ${input.pending}` : '',
    input.unavailable > 0 ? `• источник был недоступен: ${input.unavailable}` : '',
    input.mismatches > 0 ? `• подтверждённых денежных расхождений: ${input.mismatches}` : '',
    input.linkedLateCount > 0 ? `Чеков, связанных с оплатой после задержки: ${input.linkedLateCount}` : 'Поздних чеков за день: нет',
    input.resolvedLateCount > 0 ? `Из них после напоминания: ${input.resolvedLateCount} на ${rubles(input.resolvedLateAmountKopecks)} ₽` : '',
    input.sourcesComplete ? 'Данные Т-Банка, 1С и ОФД получены полностью.' : 'Не все источники доступны — итог предварительный.',
  ].filter(Boolean);
  lines.push(input.openCount > 0
    ? 'Что делать: проверить указанные оплаты в портале и пробить отсутствующие чеки.'
    : 'Что делать: ничего, расхождений по чекам нет.');
  return lines.join('\n');
}
