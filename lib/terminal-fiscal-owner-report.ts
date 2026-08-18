export type OwnerFiscalReportInput = {
  day: string;
  openCount: number;
  openAmountKopecks: number;
  resolvedLateCount: number;
  resolvedLateAmountKopecks: number;
  confirmed: number;
  total: number;
  sourcesComplete: boolean;
};

function rubles(kopecks: number) {
  return (kopecks / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function terminalFiscalOwnerMessage(input: OwnerFiscalReportInput) {
  const ok = input.openCount === 0 && input.sourcesComplete;
  const lines = [
    `${ok ? '✅' : '⚠️'} Контроль оплат по терминалу за ${input.day}`,
    `Сверено точно: ${input.confirmed} из ${input.total}`,
    input.openCount > 0
      ? `Без подтверждённого чека 1С: ${input.openCount} на ${rubles(input.openAmountKopecks)} ₽`
      : 'Оплат без подтверждённого чека 1С: нет',
    input.resolvedLateCount > 0
      ? `Пробито с опозданием: ${input.resolvedLateCount} на ${rubles(input.resolvedLateAmountKopecks)} ₽`
      : 'Поздних исправлений за день: нет',
    input.sourcesComplete ? 'Данные Т-Банка, 1С и ОФД получены полностью.' : 'Не все источники доступны — итог предварительный.',
  ];
  lines.push(input.openCount > 0
    ? 'Что делать: проверить указанные оплаты в портале и пробить отсутствующие чеки.'
    : 'Что делать: ничего, расхождений по чекам нет.');
  return lines.join('\n');
}
