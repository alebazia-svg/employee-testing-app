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
  const paymentDocumentNumber = text(source.paymentDocumentNumber);
  const paymentAmountKopecks = integer(source.paymentAmountKopecks);
  const expectedCreditKopecks = integer(source.expectedCreditKopecks);
  const amount = amountKopecks === null ? '' : `${(amountKopecks / 100).toLocaleString('ru-RU')} ₽`;
  const isCreditRealization = value.ruleKey === 'credit_realization_mismatch';
  const paymentAmount = paymentAmountKopecks === null ? '' : `${(paymentAmountKopecks / 100).toLocaleString('ru-RU')} ₽`;
  const expectedCredit = expectedCreditKopecks === null ? '' : `${(expectedCreditKopecks / 100).toLocaleString('ru-RU')} ₽`;
  const exactPaymentSuffix = [paymentAmount && `${paymentAmount} первоначальный взнос`, expectedCredit && `${expectedCredit} в кредит`].filter(Boolean).join(', ');
  const missingReceiptInstructions: Record<string, string> = {
    REQUIRED_FISCAL_RECEIPT_MISSING: 'Чек по реализации не найден. Откройте документ в 1С и проверьте оформление продажи.',
    REQUIRED_REALIZATION_FISCAL_RECEIPT_MISSING: `Откройте реализацию ${documentNumber} в 1С и пробейте чек с передачей всей суммы ${amount} в кредит.`,
    REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING: `Откройте ПКО ${paymentDocumentNumber || 'по этой реализации'} в 1С и пробейте чек из него${exactPaymentSuffix ? `: ${exactPaymentSuffix}` : ''}.`,
    REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING: `Откройте эквайринговую операцию ${paymentDocumentNumber || 'по этой реализации'} в 1С и пробейте чек из неё${exactPaymentSuffix ? `: ${exactPaymentSuffix}` : ''}.`,
  };
  const instruction = missingReceiptInstructions[reasonCode] ?? value.detail;
  const actionTitle = reasonCode === 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING'
    ? 'Пробейте чек из ПКО'
    : reasonCode === 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING'
      ? 'Пробейте чек из эквайринговой операции'
      : reasonCode === 'REQUIRED_REALIZATION_FISCAL_RECEIPT_MISSING'
        ? 'Пробейте чек из реализации'
        : isCreditRealization ? 'Исправьте кредитный чек' : value.title;
  const notFoundLabel = reasonCode === 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING'
    ? 'Не нахожу ПКО'
    : reasonCode === 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING'
      ? 'Не нахожу операцию'
      : 'Не нахожу реализацию';
  return {
    documentNumber,
    amount,
    reasonCode,
    instruction,
    actionTitle,
    notFoundLabel,
    receiptDelayMinutes,
    receiptCashierName,
    paymentDocumentNumber,
    paymentAmount,
    expectedCredit,
    summaryTitle: isCreditRealization ? 'Чек по кредитной продаже' : value.title,
    summaryMeta: [documentNumber, amount].filter(Boolean).join(' · '),
    notificationBody: isCreditRealization && documentNumber
      ? `Реализация ${documentNumber}${amount ? ` · ${amount}` : ''}. Чек не найден — откройте проверку.`
      : value.detail,
  };
}
