export const terminalFiscalReasonLabels: Record<string, string> = {
  SOURCE_TBANK_INCOMPLETE: 'Т-Банк передал данные не полностью',
  SOURCE_ONE_C_INCOMPLETE: '1С передала данные не полностью',
  SOURCE_OFD_INCOMPLETE: 'Платформа ОФД временно передала неполные данные',
  TERMINAL_MAPPING_MISSING: 'Не настроена связь терминала с ККМ и ККТ',
  TERMINAL_MAPPING_CONFLICT: 'Для терминала одновременно действуют несколько связей',
  BANK_OPERATION_DUPLICATE: 'Банковская операция продублирована',
  BANK_OPERATION_UNSUPPORTED: 'Тип банковской операции пока не поддерживается',
  BANK_OPERATION_INVALID: 'В банковской операции не хватает обязательных данных',
  ONE_C_CANDIDATE_NOT_FOUND: 'Для оплаты не найден подходящий чек 1С',
  ONE_C_MULTIPLE_CANDIDATES: 'В 1С найдено несколько подходящих чеков',
  ONE_C_CHECK_REUSED: 'Один чек 1С связан с несколькими оплатами',
  ONE_C_MULTIPLE_CARD_PAYMENTS: 'В чеке 1С несколько карточных оплат',
  ONE_C_UNSUPPORTED_DOCUMENT: 'Документ 1С требует отдельной проверки',
  FISCAL_DATA_UNCONFIRMED: 'Фискальные данные 1С не подтверждены',
  FISCAL_KEY_CONFLICT: '1С вернула конфликтующие фискальные данные',
  OFD_RECEIPT_NOT_FOUND: 'Чек не найден в ОФД по точному фискальному ключу',
  OFD_RECEIPT_DUPLICATE: 'В ОФД найдено несколько чеков с одним фискальным ключом',
  OFD_OPERATION_TYPE_MISMATCH: 'В ОФД отличается тип операции',
  OFD_TOTAL_AMOUNT_MISMATCH: 'В ОФД отличается общая сумма чека',
  OFD_ELECTRONIC_AMOUNT_MISMATCH: 'В ОФД отличается сумма оплаты картой',
  OFD_KKT_MISMATCH: 'В ОФД отличается ККТ',
  OFD_ITEM_PRESENTATION_DIFFERENCE: 'Отличается представление наименований в чеке',
  OFD_ITEM_VALUES_MISMATCH: 'Отличаются количество, цена или сумма позиций',
  OFD_ITEMS_MISMATCH: 'Состав чека требует проверки',
};

export function terminalFiscalReasonLabel(reasonCode: string) {
  return terminalFiscalReasonLabels[reasonCode] ?? 'Причина требует технической расшифровки';
}

export function terminalFiscalReasonTimes(records: Array<{ reasonCode: string; bankOperationAt: string | Date | null }>, reasonCode: string) {
  return records
    .filter((record) => record.reasonCode === reasonCode && record.bankOperationAt)
    .map((record) => new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit',
    }).format(new Date(record.bankOperationAt!)));
}

export function terminalFiscalSourceIncomplete(reasonCode: string) {
  return reasonCode === 'SOURCE_TBANK_INCOMPLETE'
    || reasonCode === 'SOURCE_ONE_C_INCOMPLETE'
    || reasonCode === 'SOURCE_OFD_INCOMPLETE';
}

export function terminalFiscalSourceContext(reasonCode: string) {
  if (reasonCode === 'SOURCE_TBANK_INCOMPLETE') return 'Данные Т-Банка за этот период получены не полностью.';
  if (reasonCode === 'SOURCE_ONE_C_INCOMPLETE') return 'Данные Т-Банка получены, но 1С передала сведения не полностью.';
  if (reasonCode === 'SOURCE_OFD_INCOMPLETE') return 'Данные Т-Банка и 1С получены, но ОФД не завершил полное чтение.';
  return '';
}

export function terminalFiscalConfigurationProblem(reasonCode: string) {
  return reasonCode === 'TERMINAL_MAPPING_MISSING' || reasonCode === 'TERMINAL_MAPPING_CONFLICT';
}
