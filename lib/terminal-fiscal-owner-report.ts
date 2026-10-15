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
  terminalCountExpected: number;
  terminalCountReported: number;
  sourcesComplete: boolean;
  terminals?: Array<{
    label: string;
    aqsiKopecks: number;
    oneCKopecks: number;
    differenceKopecks: number;
    complete: boolean;
  }>;
};

export type OwnerOneCEvidence = {
  sourceType: string;
  sourceRef: string;
  dateTime: string;
  cashRegisterRef: string;
  operationType: string;
  cardPayments: Array<{ amountKopecks: number; acquiringTerminalRef: string }>;
};

export function ownerOneCTerminalAmount(input: {
  evidence: OwnerOneCEvidence[];
  cashRegisterRef: string;
  acquiringTerminalRef: string;
  matchedAcquiringSourceRefs: ReadonlySet<string>;
  periodFrom: Date;
  periodTo: Date;
}) {
  return input.evidence.reduce((sum, evidence) => {
    if (evidence.sourceType === 'acquiring_operation') {
      // A single 1C acquiring terminal may serve several aQsi devices. Attribute
      // an acquiring document only to the mapping whose latest audit matched it.
      if (!input.matchedAcquiringSourceRefs.has(evidence.sourceRef)) return sum;
    } else if (evidence.cashRegisterRef !== input.cashRegisterRef) {
      return sum;
    }
    const at = new Date(evidence.dateTime);
    if (!(at >= input.periodFrom && at < input.periodTo)) return sum;
    const payments = evidence.cardPayments
      .filter((payment) => payment.acquiringTerminalRef === input.acquiringTerminalRef)
      .reduce((paymentSum, payment) => paymentSum + payment.amountKopecks, 0);
    return sum + (evidence.operationType === 'refund' ? -payments : payments);
  }, 0);
}

function rubles(kopecks: number) {
  return (kopecks / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function terminalFiscalOwnerMessage(input: OwnerFiscalReportInput) {
  const terminalDifferenceCount = input.terminals?.filter((terminal) => terminal.complete && terminal.differenceKopecks !== 0).length ?? 0;
  const financialProblems = input.openCount + input.mismatches + terminalDifferenceCount;
  const ok = financialProblems === 0 && input.sourcesComplete;
  const lines = [
    `${ok ? '✅' : '⚠️'} Контроль оплат по терминалу за ${input.day}`,
    ok ? 'Итог: денежного расхождения не найдено.' : 'Итог: есть операции, которые требуют проверки.',
    `Аппараты aQsi в отчёте: ${input.terminalCountReported}/${input.terminalCountExpected}`,
    `Операций aQsi: ${input.total}`,
    `• подтверждены отдельными чеками: ${input.confirmed}`,
    `• подтверждены общей суммой за день: ${input.coveredByDayTotal}`,
    input.openCount > 0
      ? `• без подтверждающего документа 1С: ${input.openCount} на ${rubles(input.openAmountKopecks)} ₽`
      : '• без подтверждающего документа 1С: 0',
    input.itemReview > 0 ? `• проверить только состав товаров: ${input.itemReview} (на сумму не влияет)` : '',
    input.pending > 0 ? `• ещё ожидают данные: ${input.pending}` : '',
    input.unavailable > 0 ? `• источник был недоступен: ${input.unavailable}` : '',
    input.mismatches > 0 ? `• подтверждённых денежных расхождений: ${input.mismatches}` : '',
    terminalDifferenceCount > 0 ? `• расхождение сумм aQsi ↔ 1С: ${terminalDifferenceCount}` : '',
    input.linkedLateCount > 0 ? `Чеков, связанных с оплатой после задержки: ${input.linkedLateCount}` : 'Поздних чеков за день: нет',
    input.resolvedLateCount > 0 ? `Автоматически закрыто напоминаний: ${input.resolvedLateCount} на ${rubles(input.resolvedLateAmountKopecks)} ₽` : '',
    input.sourcesComplete
      ? 'Данные обоих аппаратов aQsi, 1С и ОФД получены полностью.'
      : 'Не все аппараты aQsi или связанные источники доступны — итог предварительный.',
  ].filter(Boolean);
  if (input.terminals?.length) {
    lines.push('Суммы aQsi ↔ 1С:');
    for (const terminal of input.terminals) {
      lines.push(terminal.complete
        ? `• ${terminal.label}: aQsi ${rubles(terminal.aqsiKopecks)} ₽ · 1С ${rubles(terminal.oneCKopecks)} ₽ · разница ${rubles(terminal.differenceKopecks)} ₽`
        : `• ${terminal.label}: итог предварительный — aQsi или 1С получены не полностью`);
    }
    lines.push('Банковское возмещение проверяется отдельно после фактического зачисления: сроки и комиссия не относятся к контролю пробития чеков.');
  }
  lines.push(input.openCount > 0
    ? 'Что делать: проверить указанные оплаты в портале и документы 1С.'
    : terminalDifferenceCount > 0
      ? 'Что делать: проверить распределение подтверждающих документов 1С по аппаратам aQsi.'
    : !input.sourcesComplete
      ? 'Что делать: восстановить данные отсутствующего аппарата или источника и дождаться повторной сверки.'
      : 'Что делать: ничего, расхождений по чекам нет.');
  return lines.join('\n');
}
