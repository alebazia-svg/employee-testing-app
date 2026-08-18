export function issueSource(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function workdayIssueView(value: { title: string; detail: string; sourceData: unknown; ruleKey?: string }) {
  const source = issueSource(value.sourceData);
  const documentNumber = text(source.documentNumber);
  const amountKopecks = integer(source.amountKopecks);
  const reasonCode = text(source.reasonCode);
  const receiptDelayMinutes = integer(source.receiptDelayMinutes);
  const receiptCashierName = text(source.receiptCashierName);
  const amount = amountKopecks === null ? '' : `${(amountKopecks / 100).toLocaleString('ru-RU')} ₽`;
  const isCreditRealization = value.ruleKey === 'credit_realization_mismatch';
  const instruction = reasonCode === 'REQUIRED_FISCAL_RECEIPT_MISSING'
    ? 'Правильный чек пока не подтверждён. Проверьте оформление в 1С.'
    : value.detail;
  return {
    documentNumber,
    amount,
    reasonCode,
    instruction,
    receiptDelayMinutes,
    receiptCashierName,
    summaryTitle: isCreditRealization ? 'Чек по кредитной продаже' : value.title,
    summaryMeta: [documentNumber, amount].filter(Boolean).join(' · '),
    notificationBody: isCreditRealization && documentNumber
      ? `Реализация ${documentNumber}${amount ? ` · ${amount}` : ''}. Чек не найден. Проверьте оформление в 1С.`
      : value.detail,
  };
}
