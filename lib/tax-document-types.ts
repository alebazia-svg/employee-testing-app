export const taxDocumentTypes = {
  USN_DECLARATION: 'Декларация УСН до перехода',
  USN_DECLARATION_RECEIPT: 'Квитанция о приёме декларации УСН',
  AUSN_TRANSITION_NOTICE: 'Подтверждение перехода на АУСН',
  AUSN_INCOME: 'Доходы АУСН из ЛК ФНС',
  AUSN_KKT: 'Детализация ККТ из ЛК ФНС',
  ENS_OPERATIONS: 'Операции ЕНС',
  AUSN_CALCULATION: 'Справка о доходах АУСН',
  CORRECTION_EVIDENCE: 'Корректировки и возвраты',
} as const;
